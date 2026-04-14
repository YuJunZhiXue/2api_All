# 2api：公网AI模型站点 to API平台 - 详细设计文档

版本：V1（初稿）
日期：2026-04-14
适用范围：2api 核心研发团队与架构委员会

## 0. 读者指南
本文档旨在将“2api”的核心愿景——**“输入任何带有 AI 模型的公网网站 URL，自动分析并将其转化为可调用的标准 API”**——落地为可执行、可扩展、抗封锁的工程架构方案。

### 0.1 快速结论（核心定位）
- **从内网走向公网**：废弃原有的内网穿透与反向 Runner 架构。2api 面向全球公网，直面复杂的反爬虫（Cloudflare/WAF）与高并发场景。
- **自动分析与 DOM 自愈**：不再依赖脆弱的硬编码 XPath。通过“视觉大模型 + DOM 语义解析”，让系统像人类一样理解网页的输入框、发送按钮和输出流。
- **标准化输出**：无论目标网站是什么奇葩结构，2api 最终向用户交付的都是**兼容 OpenAI 规范的 RESTful API**（支持 SSE 流式输出）。

---

## 1. 背景与目标

### 1.1 产品一句话定义
**2api 是一台“万物皆可 API”的公网 AI 转化引擎。** 
只需将任何带有 AI 模型的网站（如各种套壳站、官方 Web 端、图像生成站）“扔”给 2api，平台将自动接管前端交互，并向开发者吐出一个纯粹的 API 接口。

### 1.2 核心目标
1. **所见即 API**：打破各家 AI Web 站点的封闭围墙，让没有官方 API 的 AI 模型也能被程序化调用。
2. **免维护的稳定性**：目标网站前端频繁改版？2api 必须具备自动感知与自愈能力，确保 API 调用不断供。
3. **极简接入**：对调用者而言，只需替换 BaseURL 和 API Key，即可将 2api 作为 OpenAI 的平替直接接入现有业务。

### 1.3 非目标
- 不做单纯的爬虫代理（侧重于 AI 对话与生成逻辑的深度封装）。
- 不触碰用户业务数据的长期存储（流式转发，阅后即焚，保障隐私）。

---

## 2. 核心架构与关键设计

### 2.1 总体架构分层
2api 平台分为四大核心层级：
1. **网关与计费层 (API Gateway)**：负责接收外部 `POST /v1/chat/completions` 请求，处理鉴权、并发控制、以及基于 Token/次数的计费扣减。
2. **路由与调度层 (Dispatcher)**：将请求路由到对应目标站点的“会话池（Session Pool）”。
3. **隐匿执行层 (Stealth Render Engine)**：挂载全球住宅代理 IP 的无头浏览器集群。负责指纹伪装、绕过 CAPTCHA/Cloudflare，维持与目标网站的 Web Socket/长连接。
4. **认知解析引擎 (Cognitive Parser)**：2api 的灵魂。利用轻量级 VLM（视觉语言模型）实时分析页面截图与 DOM 树，自动定位交互元素，并监听 DOM 变化以捕获流式文本。

### 2.2 自动感知与生成逻辑 (Magic of 2api)
当用户首次输入一个全新 AI 网站 URL 时，2api 执行以下流水线：
1. **探测阶段**：隐匿浏览器打开站点，`Cognitive Parser` 扫描页面。
2. **元素绑定**：自动识别 `Role: ChatInput`（输入框）、`Role: SubmitButton`（发送键）、`Role: ResponseStream`（回答渲染区）。
3. **模板生成**：生成该站点的专属 Connector 描述文件（包含元素置信度与备用特征）。
4. **API 发布**：瞬间为该站点生成对外可用的 Endpoint。

### 2.3 核心对抗技术 (Anti-Bot & Evasion)
在公网环境下，AI 站点防御极度森严。2api 必须具备：
- **指纹随机化 (Fingerprint Spoofing)**：动态修改 WebGL、Canvas、AudioContext、TLS JA3/JA4 指纹，确保每个浏览器实例看起来像真实的物理机。
- **验证码外包与 AI 破解**：无缝对接 Turnstile/hCaptcha 自动识别方案。
- **住宅代理池 (Residential Proxies)**：IP 轮换策略，避免单 IP 并发过高导致整池被封。

### 2.4 流式响应拦截 (SSE Intercept)
为了让 API 支持 OpenAI 的 `stream: true` 体验，2api 提供双重捕获机制：
- **网络层拦截**：直接 Hook 底层 Fetch/WebSocket，解析原始 JSON 数据流（最稳定，但需对抗加密）。
- **UI 层观测 (MutationObserver)**：如果网络层被强加密，则监听前端 DOM 的文本增量变化，将每次新增的字串组装成 SSE 格式实时推给 API 调用方（终极兜底方案）。

---

## 3. 会话池与凭证管理

### 3.1 会话隔离策略
- **Account Pool**：用户可将目标站点的多组账号密码/Cookie 托管至 2api。
- 平台通过后台任务自动保活（Keep-alive），定期刷新 Token。
- 每个会话绑定独立的浏览器上下文（Browser Context）和独立 IP，绝对禁止跨账号的 Cookie 污染。

### 3.2 动态扩缩容
当某个 AI 站点的 API 请求量激增时，调度层自动在 K8s 集群中拉起更多携带有效 Session 的无头浏览器 Pod，实现秒级响应。

---

## 4. 数据模型 (核心表结构)

- **TargetSite (目标站点)**：`id`, `url`, `name`, `auth_type`, `parser_version`
- **Connector (转换器)**：`id`, `site_id`, `dom_selectors_json`, `status`
- **SessionPool (会话池)**：`id`, `site_id`, `cookie_json`, `proxy_ip`, `is_active`, `last_used_at`
- **ApiRoute (路由映射)**：`id`, `endpoint_path`, `connector_id`, `billing_rate`

---

## 5. 演进路线 (Roadmap)

### V1 阶段：文本模型征服者
- 重点支持公网主流的文本类 AI 站点（ChatGPT, Claude, 各种大模型套壳站）。
- 实现自动 DOM 识别、流式 API 输出、基础并发与计费。

### V2 阶段：多模态与视觉引擎
- 支持图像生成站点（Midjourney Web, 各种生图工具）。
- 实现任务异步回调（Webhook）、图像对象存储自动转存。

### V3 阶段：Zero-Config 自治网络
- 完全零人工干预：输入网址 -> AI 引擎自我博弈破解登录逻辑 -> 自动生成 OpenAPI 文档 -> 直接投入生产环境使用。
