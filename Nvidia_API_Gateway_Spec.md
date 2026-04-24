# 英伟达高并发聚合网关与密钥池架构白皮书 (Nvidia API Empire Spec)

## 1. 系统概述 (System Overview)
本系统旨在为一个拥有大量英伟达免费 API Key 的超级管理员（Admin），提供一个**高并发、防封锁、无缝故障转移**的 LLM API 代理网关。
核心目标：对外暴露统一且标准的 OpenAI 兼容接口；对内实现对几十/上百个 API Key 的极限压榨与并发调度；在遇到并发限制（429）、额度耗尽（403/401）时，实现对客户端**零感知**的自动重试与队列等待。

---

## 2. 核心架构分层 (Architecture Layers)

### 2.1 核心网关层 (Gateway)
- **技术栈**: Go (Golang) + Fiber/Gin + `httputil.ReverseProxy`
- **职责**: 接收客户端请求，校验 Master Key，解析 Token 预估，劫持并修改 HTTP 状态码，处理 SSE (Server-Sent Events) 流式数据的转发与中断标记。

### 2.2 调度引擎与状态机 (Scheduler & State Machine)
- **技术栈**: Redis + Lua Scripts
- **职责**: 维护所有 Nvidia API Key 的生命周期。通过单线程 Lua 脚本保证并发扣减、冷却时间设置、权重轮询的**绝对原子性**。

### 2.3 代理网络层 (Proxy Pool)
- **技术栈**: 动态 HTTP/SOCKS5 代理池 (ISP Proxies)
- **职责**: 为每一个被调度的 API Key 绑定特定的出口 IP，防止因单 IP 高频访问英伟达接口导致账号被批量连坐封禁。

### 2.4 管理控制面板 (Management Dashboard)
- **技术栈**: Next.js + TailwindCSS + PostgreSQL (或 SQLite)
- **职责**: 可视化管理 Key 库、实时监控 QPS、查看报错归因（Trace-ID）、配置 Master Key 的配额（Quota）和限流（Rate Limit）。

---

## 3. 核心机制详解 (Core Mechanisms)

### 3.1 客户端鉴权与隔离 (Master Authentication)
- **Master Key**: 网关不直接暴露，客户端必须使用系统颁发的 Master Key 发起请求。
- **速率漏桶 (Token Bucket)**: 在 Go 内存或 Redis 中对 Master Key 进行 RPM（每分钟请求）和 TPM（每分钟 Token）的双重限流。
- **配额熔断 (Quota Circuit Breaker)**: 每个 Master Key 可设置硬性消耗上限，触达后立即拒绝服务（返回 402 Payment Required 或 429）。

### 3.2 零毫秒无缝切换与首包拦截 (Pre-stream Failover)
- **请求缓冲 (Body Buffering)**: 网关在内存中完整 Copy 客户端的请求 Body。
- **首包拦截**: 向 Nvidia 发起请求后，拦截响应头。如果状态码为 `429 Too Many Requests`，网关**绝不**将其返回给客户端，而是立即将该 Key 标记为冷却，并携带原缓冲的 Body 寻找下一个可用 Key 重新发起请求。
- **半途断流处理 (Mid-stream Interrupt)**: 如果 SSE 流输出中途断开，网关无法静默重试。此时网关向客户端的流中注入特殊标记（如 `data: {"error": "[STREAM_INTERRUPTED_BY_UPSTREAM]"}`），由客户端业务层捕获并执行断点续传。

### 3.3 并发控制与 Lua 原子锁 (Concurrency & Atomicity)
- **状态流转**: Key 的状态分为 `Idle`（空闲）、`Active`（使用中）、`Cooling`（冷却中）、`Dead`（封禁）。
- **原子扣减**: 请求到来时，执行 Lua 脚本：`获取权重最高且非冷却的 Key -> 检查当前并发是否小于安全阈值(如 3) -> 并发数 +1 -> 返回 Key`。
- **防死锁 (Deadlock Prevention)**: 每个并发锁必须携带 TTL（如 60 秒），防止网关进程意外崩溃导致 Redis 中的并发数永远不释放。

### 3.4 Token 精准预估与权重分配 (Token Estimation & Routing)
- **宽容性预估**: 引入 `tiktoken-go`，对请求体进行本地 Token 估算，并加上 20% 的安全冗余 Buffer。
- **超载拦截**: 预估 Token 若超过模型硬限制（如 8K/128K），直接在网关层驳回，保护 Key 资源。
- **加权路由 (Weighted Routing)**: 调度器优先将高 Token 请求分配给剩余并发额度最大、历史稳定性最高的 Key。

### 3.5 异步阻塞队列与客户端保活 (Queueing & Keep-Alive)
- **Channel 队列**: 当所有 Key 都处于满载或冷却时，请求进入 Go 的 `chan` 队列挂起。
- **事件驱动唤醒**: 独立的 Scheduler 协程监听 Redis 的 Key 释放事件（Pub/Sub），一旦有 Key 空闲，立即从队列弹出请求并执行。
- **SSE 保活心跳**: 挂起期间，每 15 秒向客户端发送 `: keep-alive\n\n` 的注释包，防止客户端 Nginx 或 HTTP 库触发超时断开。队列最大等待时间设为 45 秒，超时返回 503。

### 3.6 主动健康探测与僵尸清理 (Active Probing)
- **旁路探针**: 后台 Goroutine 每隔 5 分钟对处于 `Dead` 或长时间未使用的 Key 发起极低消耗的探测请求（如获取模型列表）。
- **死牢隔离**: 一旦英伟达返回 401/403，永久移出活跃池。对于 429 的 Key，冷却期结束后必须由探针探测成功，才能重新放回活跃池。

### 3.7 语义级缓存拦截 (Semantic Caching)
- **条件触发**: 仅当请求体中的 `temperature` 为 0 时启用缓存。
- **精确哈希**: 对 Messages 数组和 Model 名称进行 SHA-256 哈希。命中 Redis 缓存后，网关将缓存字符串模拟成 SSE 格式逐块吐给客户端。

### 3.8 模型重定向与兼容层 (Model Translation)
- **名称映射**: 客户端请求 `gpt-4o`，网关底层替换为 `meta/llama-3.1-70b-instruct`。
- **参数清洗**: 剔除英伟达不支持的 OpenAI 特有参数（如 `logit_bias`）。
- **错误统一**: 将英伟达的异构报错信息，序列化为 OpenAI 官方格式的 JSON 错误对象。

---

## 4. 灾备、安全与运维 (Security & DevOps)

### 4.1 数据安全与加密 (Data Security)
- **密钥加密落盘**: 数据库中存储的 Nvidia API Key 必须使用 AES-256-GCM 进行对称加密，网关启动时通过环境变量注入的主密钥（Root Key）进行解密。**绝对禁止明文存 Key**。

### 4.2 自动化报警 (Alerting)
- **Webhook 钩子**: 接入 Telegram / 飞书 机器人。
- **触发条件**: 可用 Key 比例跌破 20%、队列长度连续 1 分钟超过 50、出现未知的 5xx 级别网关崩溃。

### 4.3 零停机热重载 (Zero-Downtime)
- 新增或删除 Key 时，通过管理面板修改数据库。网关提供一个内部的 `/api/system/reload` 接口，收到信号后，平滑更新内存中的 Key 池，不中断正在执行的请求。

---

## 5. 硬件与资源清单 (Required Materials & Quantities)
- **网关服务器**: Linux (Ubuntu/Debian) 2C4G x 1 (承载 Go 网关与 Next.js 后台)
- **内存数据库**: Redis 实例 (至少 256MB，建议开启 AOF 持久化) x 1
- **关系型数据库**: PostgreSQL x 1 (用于持久化 Key 库、Master Key、日志)
- **网络资源**: 动态家庭宽带代理 IP (ISP Proxies) x 10~50 (按需配置轮换策略)
- **通知系统**: Telegram Bot Token 或飞书 Webhook URL x 1
- **API 资源**: Nvidia 免费 API Keys x N (N >= 10)