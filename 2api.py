"""
ChatAiBot.pro 2API 服务（单文件版）
- OpenAI 兼容的对话 + 图片生成 API
- 账号池自动注册 + 邀请系统
- 透明代理端点 /proxy/
- 邮箱使用 mail.chatgpt.org.uk
- 代理自动检测（端口 7890/10808/10818）

用法:
  python nanobanana.py --key sk-xxx
  python nanobanana.py --proxy http://127.0.0.1:7890 --key sk-xxx
  python nanobanana.py --proxy http://127.0.0.1:7890 --max-invites 15 --pool 10 --key sk-xxx
"""

import json
import re
import random
import string
import argparse
import threading
import time
import sys
from pathlib import Path
import requests
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from flask import Flask, request, jsonify, Response
from waitress import serve

import asyncio

# curl_cffi 用于 mail.chatgpt.org.uk 邮箱（模仿 xxx3.py）
try:
    from curl_cffi import requests as cffi_requests
    HAS_CFFI = True
except ImportError:
    HAS_CFFI = False
    print("[!] curl_cffi 未安装，邮箱将使用 requests 降级模式（pip install curl_cffi）")

try:
    from camoufox.async_api import AsyncCamoufox
    HAS_CAMOUFOX = True
except ImportError:
    HAS_CAMOUFOX = False
    print("[!] camoufox 未安装，浏览器注册不可用 (pip install camoufox)")


# ==========================================
# 常量配置
# ==========================================

NORMAL_INITIAL_QUOTA = 65
REGISTER_INTERVAL = 15  # 每次注册间隔（秒），避免触发限流

UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz"
NUMBER_CHARS = "0123456789"
SPECIAL_CHARS = "!@#$%^&*()-_+="
ALL_PASSWORD_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS + SPECIAL_CHARS

CHATAIBOT_API_BASE = "https://chataibot.pro/api"

# 图片模型路由（OpenAI 兼容名 → ChatAiBot 参数）
IMAGE_MODEL_ROUTER = {
    "gpt-image-1.5": {"provider": "GPT_IMAGE_1_5", "version": "", "cost": 12},
    "gpt-image-1.5-high": {"provider": "GPT_IMAGE_1_5_HIGH", "version": "", "cost": 40},
    "ideogram": {"provider": "IDEOGRAM", "version": "", "cost": 8},
    "google-nano-banana-pro": {"provider": "GOOGLE", "version": "nano-banana-pro", "cost": 60},
    "google-nano-banana": {"provider": "GOOGLE", "version": "nano-banana", "cost": 15},
    "google-nano-banana-2": {"provider": "GOOGLE", "version": "nano-banana-2", "cost": 30},
    "midjourney-7": {"provider": "MIDJOURNEY", "version": "7", "cost": 20},
    "qwen-lora": {"provider": "QWEN", "version": "lora", "cost": 2},
    "bytedance-seedream": {"provider": "BYTEDANCE", "version": "seedream-5-lite", "cost": 14},
}

# 对话模型路由（用户传入的模型名 → ChatAiBot 接受的 chatModel 值）
# 从 JS 逆向 + 网页截图完整梳理
CHAT_MODEL_ROUTER = {
    # === OpenAI 系列 ===
    "gpt-5.4":              {"chatModel": "gpt-5.4", "cost": 3},
    "gpt-5.4-high":         {"chatModel": "gpt-5.4-high", "cost": 5},
    "gpt-5.4-mini":         {"chatModel": "gpt-5.4-mini", "cost": 2},
    "gpt-5.4-nano":         {"chatModel": "gpt-5.4-nano", "cost": 1},
    "gpt-5.4-pro":          {"chatModel": "gpt-5.4-pro", "cost": 8},
    "gpt-5.2":              {"chatModel": "gpt-5.2", "cost": 3},
    "gpt-5.2-high":         {"chatModel": "gpt-5.2-high", "cost": 5},
    "gpt-5.1":              {"chatModel": "gpt-5.1", "cost": 3},
    "gpt-5.1-high":         {"chatModel": "gpt-5.1-high", "cost": 5},
    "gpt-5-pro":            {"chatModel": "gpt-5-pro", "cost": 8},
    "gpt-4.1":              {"chatModel": "gpt-4.1", "cost": 2},
    "gpt-4.1-mini":         {"chatModel": "gpt-4.1-mini", "cost": 1},
    "gpt-4.1-nano":         {"chatModel": "gpt-4.1-nano", "cost": 1},
    "gpt-4o":               {"chatModel": "gpt-4o", "cost": 2},
    "gpt-4o-mini":          {"chatModel": "gpt-4o-mini", "cost": 1},
    "gpt-4o-search-preview": {"chatModel": "gpt-4o-search-preview", "cost": 2},
    "gpt-4-turbo":          {"chatModel": "gpt-4-turbo", "cost": 2},
    "gpt-4":                {"chatModel": "gpt-4", "cost": 2},
    "gpt-3.5-turbo":        {"chatModel": "gpt-3.5-turbo-0125", "cost": 1},
    "gpt-3.5-turbo-0125":   {"chatModel": "gpt-3.5-turbo-0125", "cost": 1},
    # === OpenAI o 系列 ===
    "o4-mini":              {"chatModel": "o4-mini", "cost": 3},
    "o4-mini-high":         {"chatModel": "o4-mini-high", "cost": 5},
    "o4-mini-deep-research": {"chatModel": "o4-mini-deep-research", "cost": 8},
    "o3":                   {"chatModel": "o3", "cost": 5},
    "o3-mini":              {"chatModel": "o3-mini", "cost": 3},
    "o3-mini-high":         {"chatModel": "o3-mini-high", "cost": 5},
    "o3-pro":               {"chatModel": "o3-pro", "cost": 8},
    "o1":                   {"chatModel": "o1", "cost": 3},
    "o1-mini":              {"chatModel": "o1-mini", "cost": 2},
    "o1-preview":           {"chatModel": "o1-preview", "cost": 3},
    # === Anthropic Claude 系列 ===
    "claude-4.6-opus":      {"chatModel": "claude-4.6-opus", "cost": 8},
    "claude-4.6-sonnet":    {"chatModel": "claude-4.6-sonnet", "cost": 3},
    "claude-4.6-sonnet-high": {"chatModel": "claude-4.6-sonnet-high", "cost": 5},
    "claude-4.5-opus":      {"chatModel": "claude-4.5-opus", "cost": 8},
    "claude-4.5-haiku":     {"chatModel": "claude-4.5-haiku", "cost": 1},
    "claude-3-opus":        {"chatModel": "claude-3-opus-20240229", "cost": 5},
    "claude-3-sonnet":      {"chatModel": "claude-3-5-sonnet-20240620", "cost": 2},
    "claude-3-sonnet-high": {"chatModel": "claude-3-sonnet-high", "cost": 3},
    "claude-3-haiku":       {"chatModel": "claude-3-haiku-20240307", "cost": 1},
    "claude-3-opus-20240229": {"chatModel": "claude-3-opus-20240229", "cost": 5},
    "claude-3-5-sonnet-20240620": {"chatModel": "claude-3-5-sonnet-20240620", "cost": 2},
    "claude-3-haiku-20240307": {"chatModel": "claude-3-haiku-20240307", "cost": 1},
    # === Google Gemini 系列 ===
    "gemini-3.1-pro":       {"chatModel": "gemini-3.1-pro", "cost": 5},
    "gemini-3-pro":         {"chatModel": "gemini-3-pro", "cost": 3},
    "gemini-3-pro-search":  {"chatModel": "gemini-3-pro-search", "cost": 3},
    "gemini-3-flash":       {"chatModel": "gemini-3-flash", "cost": 1},
    "gemini-3-flash-search": {"chatModel": "gemini-3-flash-search", "cost": 1},
    "gemini-2-flash-search": {"chatModel": "gemini-2-flash-search", "cost": 1},
    "gemini-1.5-pro":       {"chatModel": "gemini-1.5-pro", "cost": 2},
    "gemini-1.5-pro-preview-0409": {"chatModel": "gemini-1.5-pro-preview-0409", "cost": 2},
    "gemini-1.5-flash":     {"chatModel": "gemini-1.5-flash", "cost": 1},
    "gemini-pro":           {"chatModel": "gemini-1.5-pro", "cost": 2},
    "gemini-flash":         {"chatModel": "gemini-1.5-flash", "cost": 1},
    # === DeepSeek 系列 ===
    "deepseek-r1":          {"chatModel": "DeepSeek-R1", "cost": 2},
    "deepseek-v3.2":        {"chatModel": "deepseek-v3.2", "cost": 2},
    "DeepSeek-R1":          {"chatModel": "DeepSeek-R1", "cost": 2},
    "DeepSeek-V3.2":        {"chatModel": "deepseek-v3.2", "cost": 2},
    # === Grok xAI ===
    "grok":                 {"chatModel": "grok", "cost": 2},
    # === Perplexity ===
    "perplexity":           {"chatModel": "Perplexity", "cost": 2},
    "perplexity-pro":       {"chatModel": "perplexity-pro", "cost": 3},
    # === Qwen 系列 ===
    "qwen3":                {"chatModel": "Qwen3", "cost": 1},
    "qwen3.5":              {"chatModel": "qwen3.5", "cost": 2},
    "qwen3.5-plus":         {"chatModel": "qwen3.5-plus", "cost": 3},
    "qwen3-max":            {"chatModel": "qwen3-max", "cost": 3},
}

# 默认对话模型
DEFAULT_CHAT_MODEL = "gpt-3.5-turbo-0125"

# 全局变量
pool_size_global = 5
port_global = 8080
api_client: Optional["APIClient"] = None
email_session: Optional["EmailSession"] = None
api_key_global = ""
reg_proxy_pool: Optional["ProxyPool"] = None
global_proxy_url: Optional[str] = None


# ==========================================
# 注册代理池
# ==========================================

class ProxyPool:
    """从 grab_proxies.py 生成的 md 文件中加载 HTTP + SOCKS5 代理，轮流分配给注册请求"""

    def __init__(self, http_file: str = None, socks5_file: str = None):
        # 每项: (address, type)  type = 'http' | 'socks5'
        self._proxies: List[Tuple[str, str]] = []
        self._idx = 0
        self._lock = threading.Lock()
        if http_file:
            self._load(http_file, "http")
        if socks5_file:
            self._load(socks5_file, "socks5")
        # 打乱顺序，让 HTTP/SOCKS5 交替使用
        import random as _random
        _random.shuffle(self._proxies)

    def _load(self, md_file: str, kind: str):
        p = Path(md_file)
        if not p.exists():
            print(f"[ProxyPool] 文件不存在: {md_file}")
            return
        count = 0
        with open(p, encoding="utf-8") as f:
            for line in f:
                m = re.search(r'`(\d+\.\d+\.\d+\.\d+:\d+)`', line)
                if m:
                    self._proxies.append((m.group(1), kind))
                    count += 1
        print(f"[ProxyPool] 已加载 {count} 个 {kind.upper()} 代理 from {md_file}")

    def next(self) -> Optional[Dict[str, str]]:
        """轮询取下一个代理，返回 requests 格式的 proxies dict"""
        with self._lock:
            if not self._proxies:
                return None
            addr, kind = self._proxies[self._idx % len(self._proxies)]
            self._idx += 1
        if kind == "socks5":
            url = f"socks5://{addr}"
        else:
            url = f"http://{addr}"
        return {"http": url, "https": url}

    def next_one_raw(self) -> Optional[Tuple[str, str]]:
        """返回 (address, kind)，用于直连启动时选一个全局代理"""
        with self._lock:
            if not self._proxies:
                return None
            return self._proxies[0]

    def __len__(self):
        return len(self._proxies)


# ==========================================
# 工具函数
# ==========================================

def generate_secure_password(length: int) -> str:
    try:
        return "".join(random.choice(ALL_PASSWORD_CHARS) for _ in range(length))
    except Exception:
        return "a9dkIikaj12"


def _generate_browser_password(length: int = 16) -> str:
    import secrets as _secrets
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    pwd = [
        _secrets.choice(string.ascii_uppercase),
        _secrets.choice(string.ascii_lowercase),
        _secrets.choice(string.digits),
        _secrets.choice("!@#$%^&*"),
    ]
    pwd += [_secrets.choice(chars) for _ in range(length - 4)]
    _secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


_SIGNUP_URL = "https://chataibot.pro/app/auth/sign-up?variant=new"


async def _browser_register(email: str, email_session, proxy: Optional[str] = None, timeout_sec: int = 180) -> Optional[str]:
    if not HAS_CAMOUFOX:
        return None

    job_start = time.time()

    def log(msg):
        print(f"[Browser] [{time.time() - job_start:5.1f}s] {msg}", flush=True)

    def check_timeout():
        if time.time() - job_start > timeout_sec:
            raise TimeoutError(f"注册超时 ({timeout_sec}s)")

    camoufox_kwargs = {"headless": True, "humanize": False, "block_webrtc": True, "i_know_what_im_doing": True}
    if proxy:
        camoufox_kwargs["proxy"] = {"server": proxy}
        # geoip=True 需要 pip install camoufox[geoip]，按需开启
        try:
            from camoufox.locale import geoip_allowed
            geoip_allowed()
            camoufox_kwargs["geoip"] = True
        except Exception:
            pass

    camoufox_obj = None
    browser = None
    context = None
    page = None

    try:
        log(f"启动 Camoufox, 邮箱: {email}")
        camoufox_obj = AsyncCamoufox(**camoufox_kwargs)
        browser = await camoufox_obj.__aenter__()
        context = await browser.new_context()
        page = await context.new_page()

        check_timeout()
        log("打开注册页面...")
        await page.goto(_SIGNUP_URL, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(3)

        email_selector = 'input[data-test-id="sign_up_form_email"], input[name="email"][type="email"]'
        try:
            await page.wait_for_selector(email_selector, timeout=30000)
        except Exception:
            log("[-] 等待邮箱输入框超时")
            return None

        check_timeout()
        log(f"填入邮箱: {email}")
        email_input = page.locator(email_selector).first
        await email_input.click()
        await asyncio.sleep(0.5)
        await email_input.fill(email)
        await asyncio.sleep(1)

        password = _generate_browser_password()
        password_selector = 'input[type="password"], input[name="password"]'

        check_timeout()
        log("点击注册按钮（提交邮箱）...")
        submit_btn = page.locator(
            "button[type='submit'], "
            "button:has-text('Создать аккаунт'), "
            "button:has-text('Create account'), "
            "button:has-text('Register')"
        ).first
        await submit_btn.click()
        log("已点击注册按钮")

        # 等待密码框出现（最多15秒）
        log("等待密码输入框...")
        try:
            await page.wait_for_selector(password_selector, timeout=15000)
            log("✓ 密码输入框已出现")
        except Exception:
            log("密码输入框未出现，继续")

        await asyncio.sleep(1)
        if await page.locator(password_selector).count() > 0:
            log(f"填入密码: {password[:4]}...")
            await page.locator(password_selector).first.fill(password)
            await asyncio.sleep(1)
            # 提交密码，最多重试3次
            for _retry in range(3):
                pw_btn = page.locator(
                    "button[type='submit'], button:has-text('Создать аккаунт'), "
                    "button:has-text('Create account'), button:has-text('Continue')"
                ).first
                await pw_btn.scroll_into_view_if_needed()
                await asyncio.sleep(0.3)
                try:
                    await pw_btn.click(force=True)
                except Exception:
                    await page.evaluate("document.querySelector('button[type=\'submit\']').click()")
                log(f"已提交密码（第{_retry+1}次）")
                await asyncio.sleep(4)
                if await page.locator(password_selector).count() == 0:
                    log("✓ 密码页已跳转")
                    break
                log("仍在密码页，重试...")

        check_timeout()
        log("等待验证码输入框...")
        code_selector = (
            'input[data-test-id="sign_up_form_token"], '
            'input[name="token"], '
            'input[type="number"][maxlength], '
            'input[placeholder*="код"], '
            'input[placeholder*="code"]'
        )
        try:
            await page.wait_for_selector(code_selector, timeout=30000)
            log("✓ 验证码输入框已出现")
        except Exception:
            current_url = page.url
            log(f"未找到验证码框，当前URL: {current_url}")
            if "verify" not in current_url and "token" not in current_url:
                log("[-] 未进入验证码页面，注册可能失败")
                try:
                    page_text = await page.evaluate("document.body.innerText")
                    log(f"页面文本: {page_text[:500]}")
                except Exception:
                    pass
                return None

        check_timeout()
        log("从邮箱获取验证码...")
        verify_code = await asyncio.to_thread(email_session.get_verify_code, email)
        if not verify_code:
            log("[-] 未获取到验证码")
            return None
        log(f"✓ 获取到验证码: {verify_code}")

        check_timeout()
        log("填入验证码...")
        code_input = page.locator(code_selector).first
        await code_input.click()
        await asyncio.sleep(0.5)
        await code_input.fill(verify_code)
        await asyncio.sleep(1)
        await page.locator(
            "button[type='submit'], button:has-text('Подтвердить'), button:has-text('Confirm'), button:has-text('Verify')"
        ).first.click()
        log("已提交验证码")
        await asyncio.sleep(5)

        check_timeout()
        log("提取 JWT token...")
        for cookie in await context.cookies():
            if cookie.get("name") == "token" and cookie.get("value"):
                log(f"✓ 从 cookie 获取 JWT: {cookie['value'][:30]}...")
                return cookie["value"]

        try:
            jwt = await page.evaluate(
                "() => localStorage.getItem('token') || localStorage.getItem('jwt') || "
                "document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('token='))?.split('=')[1] || ''"
            )
            if jwt:
                log(f"✓ 从 localStorage 获取 JWT: {jwt[:30]}...")
                return jwt
        except Exception as e:
            log(f"localStorage 提取失败: {e}")

        await asyncio.sleep(5)
        for cookie in await context.cookies():
            if cookie.get("name") == "token" and cookie.get("value"):
                log(f"✓ 跳转后从 cookie 获取 JWT: {cookie['value'][:30]}...")
                return cookie["value"]

        log(f"[-] 未能提取 JWT token，最终URL: {page.url}")
        return None

    except TimeoutError as e:
        print(f"[Browser] 超时: {e}", flush=True)
        return None
    except Exception as e:
        import traceback
        print(f"[Browser] 异常: {e}\n{traceback.format_exc()}", flush=True)
        return None
    finally:
        try:
            if page: await page.close()
            if context: await context.close()
            if browser and camoufox_obj: await camoufox_obj.__aexit__(None, None, None)
        except Exception:
            pass


def create_account_browser(email_session, proxy: Optional[str] = None) -> Tuple[bool, str]:
    if not HAS_CAMOUFOX:
        return False, ""
    email, _ = email_session.get_email_and_token()
    if not email:
        print("[-] 浏览器注册：无法获取临时邮箱", flush=True)
        return False, ""
    print(f"[Browser] 开始浏览器注册: {email}", flush=True)
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        jwt = loop.run_until_complete(_browser_register(email, email_session, proxy=proxy))
        loop.close()
    except Exception as e:
        print(f"[-] 浏览器注册事件循环异常: {e}", flush=True)
        return False, ""
    if jwt:
        print(f"[Browser] 注册成功！JWT: {jwt[:30]}...", flush=True)
        return True, jwt
    print("[-] 浏览器注册失败", flush=True)
    return False, ""


def parse_ratio(size: str) -> str:
    size_map = {
        "1024x1024": "1:1", "1:1": "1:1",
        "1024x1792": "9:16", "9:16": "9:16",
        "1792x1024": "16:9", "16:9": "16:9",
    }
    return size_map.get(size, "auto")


def get_working_proxy(specified_proxy: Optional[str] = None) -> Optional[Dict[str, str]]:
    """自动检测可用代理（模仿 xxx3.py）"""
    if specified_proxy:
        return {"http": specified_proxy, "https": specified_proxy}

    candidate_ports = [7890, 10808, 10818]
    print("[*] 未指定代理，正在自动检测本地代理端口...")
    for port in candidate_ports:
        proxy_url = f"http://127.0.0.1:{port}"
        proxies = {"http": proxy_url, "https": proxy_url}
        try:
            resp = requests.get("https://cloudflare.com/cdn-cgi/trace", proxies=proxies, timeout=3)
            if resp.status_code == 200:
                print(f"[*] 自动检测并使用可用代理: {proxy_url}")
                return proxies
        except Exception:
            pass
    print("[-] 未检测到本地可用代理。")
    return None


# ==========================================
# mail.chatgpt.org.uk 邮箱客户端（移植自 xxx3.py）
# ==========================================

MAIL_BASE = "https://mail.chatgpt.org.uk"


class EmailSession:
    """mail.chatgpt.org.uk 邮箱客户端（完全移植自 xxx3.py）"""

    def __init__(self, proxies=None):
        if HAS_CFFI:
            self._session = cffi_requests.Session(proxies=proxies, impersonate="chrome")
        else:
            self._session = requests.Session()
            if proxies:
                self._session.proxies.update(proxies)
        self._session.headers.update({
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        self._current_token = ""
        self._token_expires_at = 0
        self._initialized = False

    def _init_session(self):
        try:
            resp = self._session.get(f"{MAIL_BASE}/", timeout=15)
            if resp.status_code != 200:
                print(f"[Session] 首页请求失败: {resp.status_code}")
                return False

            match = re.search(r'window\.__BROWSER_AUTH\s*=\s*(\{[^}]+\})', resp.text)
            if match:
                auth_data = json.loads(match.group(1))
                self._current_token = auth_data.get("token", "")
                self._token_expires_at = auth_data.get("expires_at", 0)
                self._initialized = True
                return True
            return False
        except Exception as e:
            print(f"[Session] 初始化异常: {e}")
            return False

    def _ensure_token(self):
        if not self._initialized or not self._current_token or time.time() > self._token_expires_at - 120:
            return self._init_session()
        return True

    def get_email_and_token(self) -> Tuple[str, str]:
        """动态获取邮箱，摆脱硬编码的Cookie和Token"""
        if not self._ensure_token():
            return "", ""

        try:
            resp = self._session.get(
                f"{MAIL_BASE}/api/generate-email",
                headers={
                    "accept": "*/*",
                    "content-type": "application/json",
                    "referer": f"{MAIL_BASE}/",
                    "x-inbox-token": self._current_token,
                },
                timeout=15,
            )

            if resp.status_code == 401:
                self._initialized = False
                if not self._init_session():
                    return "", ""
                resp = self._session.get(
                    f"{MAIL_BASE}/api/generate-email",
                    headers={"accept": "*/*", "referer": f"{MAIL_BASE}/", "x-inbox-token": self._current_token},
                    timeout=15,
                )

            data = resp.json()
            if not data.get("success"):
                print(f"[Error] 邮箱生成失败: {data.get('error')}")
                return "", ""

            email = str(data.get("data", {}).get("email", "")).strip()
            self._current_token = str(data.get("auth", {}).get("token", "")).strip()
            self._token_expires_at = data.get("auth", {}).get("expires_at", 0)

            return email, self._current_token
        except Exception as e:
            print(f"[Error] 获取邮箱出错: {e}")
            return "", ""

    def get_verify_code(self, email: str, exclude_code: str = None) -> str:
        """轮询获取验证码（与 xxx3.py get_oai_code 一模一样的逻辑 + ChatAiBot token= 兼容）"""
        regex = r"(?<!\d)(\d{6})(?!\d)"
        token_regex = r"token=(?:3D)?(\d+)"
        print(f"[*] 正在等待邮箱 {email} 的验证码...", end="", flush=True)

        for _ in range(24):  # 增加到 24 次，总等待时间 120 秒（2 分钟）
            print(".", end="", flush=True)
            try:
                resp = self._session.get(
                    f"{MAIL_BASE}/api/emails",
                    params={"email": email},
                    headers={
                        "accept": "*/*",
                        "referer": f"{MAIL_BASE}/",
                        "x-inbox-token": self._current_token,
                    },
                    timeout=15,
                )

                if resp.status_code == 401:
                    self._initialized = False
                    self._init_session()
                    time.sleep(5)
                    continue

                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        new_token = data.get("auth", {}).get("token", "")
                        if new_token:
                            self._current_token = new_token
                            self._token_expires_at = data.get("auth", {}).get("expires_at", 0)

                        email_list = data.get("data", {}).get("emails", [])

                        # 收集所有匹配的验证码（兼容两种格式）
                        found_codes = []
                        for msg in email_list:
                            # 拼接所有可能包含验证码的字段
                            all_text = " ".join([
                                str(msg.get("subject", "")),
                                str(msg.get("content", "")),
                                str(msg.get("html_content", "")),
                                str(msg.get("body", "")),
                                str(msg.get("text", "")),
                            ])

                            # 方式1: token=XXXXX（ChatAiBot 链接格式）
                            m2 = re.search(token_regex, all_text)
                            if m2:
                                found_codes.append(m2.group(1))

                            # 方式2: 6 位数字（通用 OTP 格式）
                            m1 = re.search(regex, all_text)
                            if m1 and m1.group(1) not in found_codes:
                                found_codes.append(m1.group(1))

                        # 过滤掉排除的验证码
                        valid_codes = [c for c in found_codes if c != exclude_code]
                        if valid_codes:
                            print(" 抓到啦! 验证码:", valid_codes[0])
                            return valid_codes[0]
            except Exception:
                pass
            time.sleep(5)

        print(" 超时，未收到验证码")
        return ""


# ==========================================
# ChatAiBot API 客户端
# ==========================================

class APIClient:
    """ChatAiBot API 客户端（注册/对话/图片/邀请）"""

    def __init__(self, proxies: Optional[Dict[str, str]] = None):
        # 优先用 curl_cffi 伪装浏览器，绕过反爬虫
        if HAS_CFFI:
            self.http_client = cffi_requests.Session(proxies=proxies, impersonate="chrome")
            print("[*] 使用 curl_cffi 模拟浏览器（Chrome）", flush=True)
        else:
            self.http_client = requests.Session()
            if proxies:
                self.http_client.proxies.update(proxies)
            print("[!] curl_cffi 未安装，降级使用 requests（可能被反爬虫拒绝）", flush=True)
        self.proxies = proxies

    def _headers(self, jwt_token: str = "") -> Dict[str, str]:
        h = {
            "Content-Type": "application/json",
            "x-distribution-channel": "web",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36",
        }
        if jwt_token:
            h["Cookie"] = f"token={jwt_token}"
        return h

    def _get_current_ip(self) -> str:
        """获取当前出口 IP（用于日志显示代理地址）"""
        try:
            resp = self.http_client.get("https://api.ipify.org?format=json", timeout=5)
            if resp.status_code == 200:
                return resp.json().get("ip", "")
        except Exception:
            pass
        return ""

    # --- 注册/验证 ---

    def send_register_request(self, email: str) -> Tuple[bool, str]:
        password = generate_secure_password(16)
        payload = {
            "email": email, "password": password,
            "isAdvertisingAccepted": False,
            "mainSiteUrl": "https://chataibot.pro/api",
            "utmSource": "", "utmCampaign": "",
            "connectBusiness": "", "yandexClientId": "1774357327418729490",
        }
        # 获取当前出口 IP
        current_ip = self._get_current_ip()
        if current_ip:
            print(f"[*] 注册: {email} (代理IP: {current_ip})")
        else:
            print(f"[*] 注册: {email}")

        print(f"[DEBUG] 发送注册请求到: {CHATAIBOT_API_BASE}/register")
        print(f"[DEBUG] Payload: {payload}")

        try:
            resp = self.http_client.post(f"{CHATAIBOT_API_BASE}/register", json=payload, headers=self._headers())
            print(f"[DEBUG] 响应状态码: {resp.status_code}")
            print(f"[DEBUG] 响应内容: {resp.text[:500]}")

            resp.raise_for_status()
            if resp.json().get("success", False):
                print("[+] 注册请求成功，等待验证码...")
                return True, password
            print(f"[-] 注册失败: {resp.text[:200]}")
            return False, ""
        except Exception as e:
            print(f"[-] 注册请求失败: {type(e).__name__}: {e}")
            import traceback
            print(f"[DEBUG] 异常堆栈: {traceback.format_exc()}")
            return False, ""

    def verify_account(self, email: str, code: str) -> str:
        payload = {"email": email, "token": code, "connectBusiness": ""}
        try:
            print(f"[*] 提交验证码 [{code}]...")
            resp = self.http_client.post(f"{CHATAIBOT_API_BASE}/register/verify", json=payload, headers=self._headers())
            resp.raise_for_status()
            jwt = resp.json().get("jwtToken", "")
            if jwt:
                print("[+] 账号激活成功！")
                return jwt
            print(f"[-] 验证失败: {resp.text[:200]}")
            return ""
        except Exception as e:
            print(f"[-] 验证失败: {e}")
            return ""

    # --- 额度/设置 ---

    def get_count(self, jwt_token: str) -> int:
        try:
            resp = self.http_client.get(f"{CHATAIBOT_API_BASE}/user/answers-count/v2", headers=self._headers(jwt_token))
            resp.raise_for_status()
            return resp.json().get("leftAnswersCount", 0)
        except Exception:
            return -1  # -1 表示网络错误，区别于真实额度为0

    def update_user_settings(self, jwt_token: str, aspect_ratio: str) -> bool:
        try:
            resp = self.http_client.post(
                f"{CHATAIBOT_API_BASE}/user/update",
                json={"settings": {"imageAspectRatio": aspect_ratio}},
                headers=self._headers(jwt_token),
            )
            return resp.status_code == 200
        except Exception:
            return False

    # --- 邀请 ---

    def get_referrer_link(self, jwt_token: str) -> Tuple[str, str]:
        try:
            resp = self.http_client.get(
                f"{CHATAIBOT_API_BASE}/user/referrer",
                params={"isInternational": "true"},
                headers=self._headers(jwt_token),
            )
            resp.raise_for_status()
            data = resp.json()
            link = data.get("referrerLink", "")
            if link:
                qs = parse_qs(urlparse(link).query)
                utm = qs.get("utm_source", [""])[0]
                print(f"[+] 邀请码: {utm}，已邀请: {data.get('referralsCount', 0)}")
                return link, utm
            return "", ""
        except Exception as e:
            print(f"[-] 获取邀请链接失败: {e}")
            return "", ""

    # --- 图片生成 ---

    def generate_image(self, prompt: str, provider: str, version: str, jwt_token: str, image: str = None, images: list = None) -> Tuple[bool, str]:
        payload = {"text": prompt, "from": 1, "generationType": provider, "isInternational": True}
        if version:
            payload["version"] = version
        if image:
            payload["image"] = image
        if images:
            payload["images"] = images
        try:
            s = requests.Session()
            s.timeout = 5 * 60
            if self.proxies:
                s.proxies.update(self.proxies)
            resp = s.post(f"{CHATAIBOT_API_BASE}/image/generate", json=payload, headers=self._headers(jwt_token))
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                url = data[0].get("imageUrl", "")
                if url:
                    return True, url
            return False, ""
        except Exception as e:
            return False, str(e)

    # --- 对话 ---

    def create_chat_context(self, jwt_token: str, chat_model: str, title: str = "chat") -> Optional[int]:
        """创建聊天上下文，返回 chatId"""
        payload = {"title": title, "chatModel": chat_model, "from": 1}
        try:
            resp = self.http_client.post(
                f"{CHATAIBOT_API_BASE}/message/context",
                json=payload,
                headers=self._headers(jwt_token),
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("id")
            print(f"[-] 创建聊天上下文失败: {resp.status_code} {resp.text[:200]}")
            return None
        except Exception as e:
            print(f"[-] 创建聊天上下文异常: {e}")
            return None

    def send_chat_message(self, jwt_token: str, chat_id: int, chat_model: str, text: str) -> Optional[str]:
        """发送对话消息（非流式），返回回复文本"""
        payload = {
            "text": text,
            "chatModel": chat_model,
            "from": 1,
            "isInternational": True,
            "chatId": chat_id,
        }
        try:
            s = requests.Session()
            s.timeout = 120
            if self.proxies:
                s.proxies.update(self.proxies)
            resp = s.post(f"{CHATAIBOT_API_BASE}/message", json=payload, headers=self._headers(jwt_token))
            if resp.status_code == 200:
                data = resp.json()
                return data.get("answer", "")
            print(f"[-] 对话失败: {resp.status_code} {resp.text[:300]}")
            # 返回带状态码的错误元组，便于上层区分
            return (resp.status_code, resp.text[:500])
        except Exception as e:
            print(f"[-] 对话异常: {e}")
            return None

    # --- 透明代理 ---

    def proxy_request(self, jwt_token: str, method: str, path: str, body: Any = None, params: dict = None) -> requests.Response:
        """透明代理请求到 ChatAiBot API"""
        url = f"{CHATAIBOT_API_BASE}/{path.lstrip('/')}"
        h = self._headers(jwt_token)
        s = requests.Session()
        s.timeout = 120
        if self.proxies:
            s.proxies.update(self.proxies)
        return s.request(method, url, json=body, params=params, headers=h)


# ==========================================
# 数据结构
# ==========================================

@dataclass
class Account:
    jwt: str
    quota: int


class AccountStore:
    """账号持久化存储，JSON 文件格式：
    [
        {"jwt": "eyJ...", "quota": 65, "email": "xxx@xx.com", "created_at": "2026-03-25T14:00:00"},
        ...
    ]
    """

    def __init__(self, file_path: str = "accounts.json"):
        self.file_path = file_path
        self.lock = threading.Lock()

    def load(self) -> List[Account]:
        """从文件加载账号列表"""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            accounts = []
            for item in data:
                jwt = item.get("jwt", "")
                quota = item.get("quota", 0)
                if jwt:
                    accounts.append(Account(jwt=jwt, quota=quota))
            print(f"[*] 从 {self.file_path} 加载了 {len(accounts)} 个账号", flush=True)
            return accounts
        except FileNotFoundError:
            return []
        except Exception as e:
            print(f"[-] 加载账号文件失败: {e}", flush=True)
            return []

    def save(self, accounts: List[Account]):
        """保存账号列表到文件"""
        with self.lock:
            data = []
            for acc in accounts:
                data.append({"jwt": acc.jwt, "quota": acc.quota})
            try:
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"[-] 保存账号文件失败: {e}", flush=True)

    def append(self, acc: Account):
        """追加一个账号到文件（不覆盖已有的）"""
        with self.lock:
            data = []
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                data = []
            data.append({"jwt": acc.jwt, "quota": acc.quota})
            try:
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"[-] 追加账号失败: {e}", flush=True)

    def refresh_and_save(self, accounts: List[Account], api: "APIClient"):
        """刷新所有账号余额并保存，剔除失效账号"""
        valid = []
        for acc in accounts:
            q = api.get_count(acc.jwt)
            if q > 0:
                acc.quota = q
                valid.append(acc)
        self.save(valid)
        return valid


# 全局账号存储
account_store: Optional[AccountStore] = None


# (邀请链管理器已移除，直接注册账号)


# ==========================================
# 账户池（按需注册）
# ==========================================

class SimplePool:
    def __init__(self, max_size: int):
        self.used_pool: List[Account] = []
        self.max_size = max_size
        self.lock = threading.Lock()
        self._new_accounts: List[Account] = []
        self._deliver_cv = threading.Condition()
        self._demand_cv = threading.Condition()
        self._waiting_count = 0

    def _deliver(self, account: Account):
        with self._deliver_cv:
            self._new_accounts.append(account)
            self._deliver_cv.notify()

    def _wait_for_new(self) -> Account:
        with self._deliver_cv:
            while len(self._new_accounts) == 0:
                self._deliver_cv.wait()
            return self._new_accounts.pop(0)

    def demand_count(self) -> int:
        with self._demand_cv:
            return self._waiting_count

    def wait_for_demand(self, timeout: float = 30.0) -> bool:
        with self._demand_cv:
            if self._waiting_count > 0:
                return True
            self._demand_cv.wait(timeout=timeout)
            return self._waiting_count > 0

    def _signal_demand(self):
        with self._demand_cv:
            self._waiting_count += 1
            self._demand_cv.notify_all()

    def acquire(self, cost: int) -> Account:
        """获取额度最高的账号，池空时等待注册"""
        with self.lock:
            best_idx = -1
            for i, acc in enumerate(self.used_pool):
                if acc.quota >= cost:
                    if best_idx == -1 or acc.quota > self.used_pool[best_idx].quota:
                        best_idx = i
            if best_idx != -1:
                return self.used_pool.pop(best_idx)

        print("[*] 池中无可用账号，等待注册新号...", flush=True)
        with self._demand_cv:
            self._waiting_count += 1
            self._demand_cv.notify_all()
        try:
            return self._wait_for_new()
        finally:
            with self._demand_cv:
                self._waiting_count = max(0, self._waiting_count - 1)

    def release(self, acc: Account):
        """释放账号：实时查余额，归还池中；耗尽则移除并触发补充注册"""
        q = api_client.get_count(acc.jwt)
        if q == -1:
            # 网络错误，保留账号原有额度，直接归还
            print(f"[!] 查询余额网络错误，保留账号 (quota={acc.quota})", flush=True)
        else:
            acc.quota = q
        if acc.quota < 2:
            print(f"[*] 账号额度耗尽 ({acc.quota})，移除并触发补充", flush=True)
            self._save_to_file()
            self._signal_demand()
            return
        with self.lock:
            self.used_pool.append(acc)
        self._save_to_file()
        # 如果池低于最大值，也触发补充
        with self.lock:
            current = len(self.used_pool)
        if current < self.max_size:
            self._signal_demand()

    def _save_to_file(self):
        """保存池中额度>=2的账号到文件，自动剔除耗尽账号"""
        if account_store:
            with self.lock:
                valid = [a for a in self.used_pool if a.quota >= 2]
            account_store.save(valid)

    def pool_status(self) -> str:
        with self.lock:
            total = sum(a.quota for a in self.used_pool)
            return f"池中: {len(self.used_pool)}/{self.max_size}, 余额: {total}"

# ==========================================
# 账户创建
# ==========================================

def create_account() -> Tuple[bool, str]:
    # 每次注册使用独立代理（来自代理池），实现 IP 隔离
    reg_proxies = reg_proxy_pool.next() if reg_proxy_pool and len(reg_proxy_pool) > 0 else None
    proxy_url = reg_proxies['http'] if reg_proxies else (global_proxy_url or None)
    if reg_proxies:
        print(f"[*] 注册使用代理: {proxy_url}")
        cur_email_session = EmailSession(proxies=reg_proxies)
        cur_api_client = APIClient(proxies=reg_proxies)
    else:
        cur_email_session = email_session
        cur_api_client = api_client

    # 优先使用浏览器注册（绕过反爬虫）
    if HAS_CAMOUFOX:
        print("[*] 使用 Camoufox 浏览器注册...", flush=True)
        success, jwt = create_account_browser(cur_email_session, proxy=proxy_url)
        if success and jwt:
            return True, jwt
        print("[!] 浏览器注册失败，回退到 API 注册...", flush=True)

    # 回退：API 直接注册
    email_addr, _ = cur_email_session.get_email_and_token()
    if not email_addr:
        return False, ""

    success, password = cur_api_client.send_register_request(email_addr)
    if not success:
        return False, ""

    code = cur_email_session.get_verify_code(email_addr)
    if not code:
        return False, ""

    jwt = cur_api_client.verify_account(email_addr, code)
    if not jwt:
        return False, ""
    return True, jwt


# ==========================================
# 账户池启动
# ==========================================

def start_pool(pool_size: int, init_count: int = 20) -> SimplePool:
    p = SimplePool(pool_size)

    # 从文件加载已有账号
    loaded_accounts = []
    if account_store:
        loaded_accounts = account_store.load()
        if loaded_accounts:
            print(f"[*] 正在验证已有 {len(loaded_accounts)} 个账号的余额...", flush=True)
            valid = []
            for acc in loaded_accounts:
                q = api_client.get_count(acc.jwt)
                if q > 0:
                    acc.quota = q
                    valid.append(acc)
                    print(f"  ✓ 余额: {q}", flush=True)
                elif q == -1:
                    # 网络错误，保留账号
                    valid.append(acc)
                    print(f"  ? 查询余额失败（网络），保留账号 quota={acc.quota}", flush=True)
                else:
                    print(f"  ✗ 已失效，移除", flush=True)
            loaded_accounts = valid
            account_store.save(valid)
            print(f"[*] 有效账号: {len(valid)} 个", flush=True)

            with p.lock:
                for acc in loaded_accounts[:pool_size]:
                    p.used_pool.append(acc)
            print(f"[*] 已从文件恢复 {p.pool_status()}", flush=True)

    def register_one(phase_tag: str) -> bool:
        success, jwt = create_account()
        if not success:
            return False

        actual_quota = api_client.get_count(jwt)
        if actual_quota <= 0:
            actual_quota = NORMAL_INITIAL_QUOTA

        print(f"[+] {phase_tag} 账号就绪，额度: {actual_quota}", flush=True)
        acc = Account(jwt=jwt, quota=actual_quota)
        if account_store:
            account_store.append(acc)

        if p.demand_count() > 0:
            p._deliver(acc)
            print(f"[*] 账号已交付给等待中的请求", flush=True)
        else:
            with p.lock:
                if len(p.used_pool) < p.max_size:
                    p.used_pool.append(acc)
            print(f"[*] 账号入池 {p.pool_status()}", flush=True)
        return True

    def worker():
        sys.stdout.reconfigure(line_buffering=True)

        has_loaded = len(loaded_accounts) > 0
        if has_loaded:
            print(f"[*] 已有 {len(loaded_accounts)} 个账号从文件恢复，跳过初始注册", flush=True)
        else:
            print(f"[*] 初始化注册 {init_count} 个账号...", flush=True)
            registered = 0
            while registered < init_count:
                try:
                    idx = registered + 1
                    print(f"[*] 正在注册第 {idx}/{init_count} 个账号...", flush=True)
                    if register_one(f"[初始化 {idx}/{init_count}]"):
                        registered += 1
                        time.sleep(REGISTER_INTERVAL)  # 注册间隔，避免触发限流
                    else:
                        print(f"[-] 第 {idx} 个注册失败，15秒后重试...", flush=True)
                        time.sleep(15)
                except Exception as e:
                    print(f"[-] 初始化异常: {e}", flush=True)
                    time.sleep(15)

        print(f"[*] 初始化完成！{p.pool_status()}", flush=True)

        while True:
            try:
                # 检查池是否低于最大值，不足则主动注册补充
                with p.lock:
                    current = len(p.used_pool)
                if current < pool_size:
                    print(f"[*] 池不满 ({current}/{pool_size})，主动补充注册", flush=True)
                    if not register_one(f"[补充 {current+1}/{pool_size}]"):
                        time.sleep(5)
                    else:
                        time.sleep(REGISTER_INTERVAL)  # 注册间隔，避免触发限流
                    continue
                # 池满时等待需求信号
                if not p.wait_for_demand(timeout=30):
                    continue
                if p.demand_count() <= 0:
                    continue
                print(f"[*] 按需注册 (等待: {p.demand_count()}) {p.pool_status()}", flush=True)
                if not register_one("[按需]"):
                    time.sleep(5)
                else:
                    time.sleep(REGISTER_INTERVAL)  # 注册间隔，避免触发限流
            except Exception as e:
                print(f"[-] Worker 异常: {e}", flush=True)
                time.sleep(5)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    return p


# ==========================================
# 工具调用辅助函数
# ==========================================

def _extract_text_from_content(content) -> str:
    """从消息 content 字段提取纯文本（兼容 str / list 格式）"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if not isinstance(part, dict):
                continue
            t = part.get("type", "")
            if t == "text":
                parts.append(part.get("text", ""))
            elif t == "tool_use":
                # 助手发起工具调用，序列化为可读文本
                parts.append(f"[tool_use name={part.get('name')} id={part.get('id')} input={json.dumps(part.get('input', {}), ensure_ascii=False)}]")
            elif t == "tool_result":
                # 工具结果，提取文本
                inner = part.get("content", "")
                if isinstance(inner, str):
                    parts.append(f"[tool_result tool_use_id={part.get('tool_use_id')}]\n{inner}")
                elif isinstance(inner, list):
                    result_texts = [p.get("text", "") for p in inner if isinstance(p, dict) and p.get("type") == "text"]
                    parts.append(f"[tool_result tool_use_id={part.get('tool_use_id')}]\n{''.join(result_texts)}")
        return "\n".join(parts)
    return ""


def _build_prompt(system_prompt: str, messages: list, tools: list) -> str:
    """把 system、对话历史、tools 定义拼成单个 prompt，控制在 2400 字符内"""
    MAX_CHARS = 2400

    # 1. 系统提示（截断到400字符）
    sys_part = ""
    if system_prompt:
        trimmed = system_prompt[:400]
        sys_part = f"<system>\n{trimmed}\n</system>"

    # 2. 工具定义（只保留名称+简短描述，最多300字符）
    tools_part = ""
    if tools:
        tool_names_list = [t.get('name','') for t in tools if t.get('name')]
        tool_lines = [
            f"You may ONLY call one of these exact tools: {', '.join(tool_names_list)}",
            "To call a tool output ONLY this JSON (nothing else, no explanation):",
            '{"type":"tool_use","name":"TOOL_NAME","id":"toolu_1","input":{...params...}}',
            "TOOL_NAME must be one of the listed tools above. Do NOT invent tool names.",
            "",
        ]
        for tool in tools:
            name = tool.get("name", "")
            desc = tool.get("description", "")[:60]
            tool_lines.append(f"- {name}: {desc}")
        tools_part = "\n".join(tool_lines)[:400]

    # 3. 计算对话历史可用字符数
    overhead = len(sys_part) + len(tools_part) + 50  # 50 给分隔符和 "Assistant:"
    history_budget = MAX_CHARS - overhead

    # 从最新消息往前取，保证最后一条 user 消息完整
    history_parts = []
    budget_used = 0
    for msg in reversed(messages):
        role = msg.get("role", "")
        if role not in ("user", "assistant"):
            continue
        text = _extract_text_from_content(msg.get("content", ""))
        # tool_result 内容可能很长，截断
        if len(text) > 800:
            text = text[:800] + "...[truncated]"
        prefix = "Human: " if role == "user" else "Assistant: "
        line = f"{prefix}{text}"
        if budget_used + len(line) + 2 > history_budget and history_parts:
            break  # 预算用完，但至少保留最后一条
        history_parts.insert(0, line)
        budget_used += len(line) + 2

    # 4. 组装
    final_parts = []
    if sys_part:
        final_parts.append(sys_part)
    if tools_part:
        final_parts.append(tools_part)
    final_parts.extend(history_parts)
    final_parts.append("Assistant:")
    return "\n\n".join(final_parts)

def _find_tool_use_json(text: str, tool_names: set):
    """在文本中扫描所有 { 开头的位置，尝试解析合法 JSON，返回 (start, tool_call) 或 None"""
    i = 0
    while i < len(text):
        pos = text.find('{', i)
        if pos == -1:
            break
        # 尝试从 pos 开始解析 JSON
        depth = 0
        for j in range(pos, len(text)):
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[pos:j+1]
                    try:
                        obj = json.loads(candidate)
                        if (isinstance(obj, dict)
                                and obj.get("type") == "tool_use"
                                and obj.get("name") in tool_names):
                            return pos, obj
                    except (json.JSONDecodeError, ValueError):
                        pass
                    break
        i = pos + 1
    return None


def _parse_tool_calls(answer: str, tools: list):
    """解析模型回复，提取工具调用或普通文本，返回 (content_blocks, stop_reason)"""
    if not tools:
        return [{"type": "text", "text": answer}], "end_turn"

    tool_names = {t.get("name") for t in tools if t.get("name")}

    # 先去掉 ```json ... ``` 包装再扫描
    stripped = re.sub(r'```json\s*\n?', '', answer)
    stripped = re.sub(r'\n?```', '', stripped)

    result = _find_tool_use_json(stripped, tool_names)
    if result:
        pos, tool_call = result
        # 找原始 answer 中对应的前缀文本
        prefix = stripped[:pos].strip()
        tool_id = tool_call.get("id") or f"toolu_{int(time.time())}"
        blocks = []
        if prefix:
            blocks.append({"type": "text", "text": prefix})
        blocks.append({
            "type": "tool_use",
            "id": tool_id,
            "name": tool_call["name"],
            "input": tool_call.get("input", {}),
        })
        return blocks, "tool_use"

    return [{"type": "text", "text": answer}], "end_turn"


def _generate_sse(resp_data, content_blocks, msg_id, model_name, full_prompt, answer):
    """生成 Anthropic SSE 流，支持 text 和 tool_use 两种 block"""
    stop_reason = resp_data["stop_reason"]
    yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'model': model_name, 'content': [], 'stop_reason': None, 'stop_sequence': None, 'usage': {'input_tokens': len(full_prompt), 'output_tokens': 0}}})}\n\n"

    for idx, block in enumerate(content_blocks):
        if block["type"] == "text":
            yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': idx, 'content_block': {'type': 'text', 'text': ''}})}\n\n"
            chunk_size = 20
            text = block["text"]
            for i in range(0, len(text), chunk_size):
                yield f"event: content_block_delta\ndata: {json.dumps({'type': 'content_block_delta', 'index': idx, 'delta': {'type': 'text_delta', 'text': text[i:i+chunk_size]}})}\n\n"
            yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': idx})}\n\n"
        elif block["type"] == "tool_use":
            yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': idx, 'content_block': {'type': 'tool_use', 'id': block['id'], 'name': block['name'], 'input': {}}})}\n\n"
            input_str = json.dumps(block.get("input", {}), ensure_ascii=False)
            yield f"event: content_block_delta\ndata: {json.dumps({'type': 'content_block_delta', 'index': idx, 'delta': {'type': 'input_json_delta', 'partial_json': input_str}})}\n\n"
            yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': idx})}\n\n"

    yield f"event: message_delta\ndata: {json.dumps({'type': 'message_delta', 'delta': {'stop_reason': stop_reason, 'stop_sequence': None}, 'usage': {'output_tokens': len(answer)}})}\n\n"
    yield f"event: message_stop\ndata: {json.dumps({'type': 'message_stop'})}\n\n"


def _is_incomplete(text: str) -> bool:
    """判断模型回答是否未完成，需要续写"""
    text = text.rstrip()
    if not text:
        return False
    # 代码块未闭合
    if text.count('```') % 2 != 0:
        return True
    # 明确说要继续
    incomplete_hints = ["continue", "continued", "to be continued", "(continues)",
                        "未完", "续", "接下来", "..."]
    last100 = text[-100:].lower()
    if any(h in last100 for h in incomplete_hints[:4]):
        return True
    # 句子中途截断（末尾不是常见结束符）
    if len(text) > 200 and text[-1] not in '.!?。！？`"\'':
        return True
    return False


# ==========================================
# Flask 应用
# ==========================================

def verify_api_key():
    if not api_key_global:
        return None
    # OpenAI 格式: Authorization: Bearer sk-xxx
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:].strip() == api_key_global:
        return None
    # Anthropic 格式: x-api-key: sk-xxx
    xkey = request.headers.get("x-api-key", "")
    if xkey.strip() == api_key_global:
        return None
    return jsonify({"error": {"message": "Invalid API key", "type": "invalid_request_error"}}), 401


def create_app(account_pool: SimplePool) -> Flask:
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

    # --- 服务状态 ---
    @app.route("/", methods=["GET"])
    @app.route("/v1", methods=["GET"])
    def service_status():
        with account_pool.lock:
            total_quota = sum(a.quota for a in account_pool.used_pool)
            count = len(account_pool.used_pool)
        return jsonify({
            "status": "ok",
            "service": "ChatAiBot 2API",
            "endpoints": [
                "POST /v1/chat/completions",
                "POST /v1/images/generations",
                "POST /v1/messages",
                "GET  /v1/models",
                "GET  /status",
                "ANY  /proxy/{path}",
            ],
            "pool": {"accounts": count, "total_quota": total_quota},
        }), 200

    # --- 模型列表 ---
    @app.route("/v1/models", methods=["GET"])
    def list_models():
        err = verify_api_key()
        if err:
            return err
        models = []
        for mid in IMAGE_MODEL_ROUTER:
            models.append({"id": mid, "object": "model", "created": 1700000000, "owned_by": "chataibot-image"})
        for mid in CHAT_MODEL_ROUTER:
            models.append({"id": mid, "object": "model", "created": 1700000000, "owned_by": "chataibot-chat"})
        return jsonify({"object": "list", "data": models}), 200

    # --- 图片生成 ---
    @app.route("/v1/images/generations", methods=["POST"])
    def image_handler():
        err = verify_api_key()
        if err:
            return err
        try:
            req_data = request.get_json()
            if not req_data:
                return jsonify({"error": {"message": "Invalid request body"}}), 400

            prompt = req_data.get("prompt", "")
            model = req_data.get("model", "gpt-image-1.5")
            if model not in IMAGE_MODEL_ROUTER:
                return jsonify({"error": {"message": f"Unsupported image model: {model}"}}), 400

            cfg = IMAGE_MODEL_ROUTER[model]
            ratio = parse_ratio(req_data.get("size", "1024x1024"))
            image = req_data.get("image", None)
            images = req_data.get("images", None)

            acc = account_pool.acquire(cfg["cost"])
            try:
                api_client.update_user_settings(acc.jwt, ratio)
                ok, img_url = api_client.generate_image(prompt, cfg["provider"], cfg["version"], acc.jwt, image=image, images=images)
                if not ok:
                    return jsonify({"error": {"message": f"Generation failed: {img_url}"}}), 500
                return jsonify({"created": int(datetime.now().timestamp()), "data": [{"url": img_url}]}), 200
            finally:
                account_pool.release(acc)
        except Exception as e:
            return jsonify({"error": {"message": str(e)}}), 500

    # --- 对话（真正的 2API）---

    # --- 对话（OpenAI 兼容）---
    @app.route("/v1/chat/completions", methods=["POST"])
    def chat_completions():
        err = verify_api_key()
        if err:
            return err
        try:
            req_data = request.get_json()
            if not req_data:
                return jsonify({"error": {"message": "Invalid request body"}}), 400

            model_name = req_data.get("model", DEFAULT_CHAT_MODEL)
            messages = req_data.get("messages", [])
            tools = req_data.get("tools", [])
            stream = req_data.get("stream", False)

            model_cfg = CHAT_MODEL_ROUTER.get(model_name)
            if not model_cfg:
                if model_name in IMAGE_MODEL_ROUTER:
                    return _chat_as_image(req_data, account_pool)
                model_cfg = CHAT_MODEL_ROUTER[DEFAULT_CHAT_MODEL]

            chat_model = model_cfg["chatModel"]
            cost = model_cfg["cost"]

            # 提取 system prompt，其余消息传入 _build_prompt
            system_prompt = ""
            hist_messages = []
            for msg in messages:
                if msg.get("role") == "system" and not system_prompt:
                    c = msg.get("content", "")
                    system_prompt = c if isinstance(c, str) else _extract_text_from_content(c)
                else:
                    hist_messages.append(msg)

            full_prompt = _build_prompt(system_prompt, hist_messages, tools)

            acc = account_pool.acquire(cost)
            try:
                chat_id = api_client.create_chat_context(acc.jwt, chat_model, title=full_prompt[:30])
                if not chat_id:
                    return jsonify({"error": {"message": "Failed to create chat context"}}), 500

                answer = api_client.send_chat_message(acc.jwt, chat_id, chat_model, full_prompt)
                if answer is None:
                    return jsonify({"error": {"message": "Chat request failed"}}), 500
                if isinstance(answer, tuple):
                    status_code, err_body = answer
                    return jsonify({"error": {"message": err_body}}), status_code

                # 自动续写
                segments = [answer]
                for _ in range(3):
                    if not _is_incomplete(segments[-1]):
                        break
                    print("[*] 续写...", flush=True)
                    _q = api_client.get_count(acc.jwt)
                    if _q != -1:
                        acc.quota = _q
                    if acc.quota < cost:
                        break
                    cont = api_client.send_chat_message(acc.jwt, chat_id, chat_model, "continue")
                    if not cont:
                        break
                    segments.append(cont)
                answer = "".join(segments)

                cid = f"chatcmpl-{int(time.time())}"
                finish_reason = "stop"
                tool_calls_list = None

                # 解析工具调用（OpenAI function calling 格式，兼容裸 JSON 和代码块）
                if tools:
                    tool_names = {t.get("name") for t in tools if t.get("name")}
                    _stripped = re.sub(r'```json\s*\n?', '', answer)
                    _stripped = re.sub(r'\n?```', '', _stripped)
                    _result = _find_tool_use_json(_stripped, tool_names)
                    if _result:
                        _pos, tc = _result
                        finish_reason = "tool_calls"
                        tool_calls_list = [{
                            "id": tc.get("id") or f"call_{int(time.time())}",
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc.get("input", {}), ensure_ascii=False),
                            },
                        }]
                        answer = _stripped[:_pos].strip()

                msg_obj = {"role": "assistant", "content": answer if not tool_calls_list else None}
                if tool_calls_list:
                    msg_obj["tool_calls"] = tool_calls_list

                if stream:
                    def gen_openai_sse():
                        yield f"data: {json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': model_name, 'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}]})}"
                        if tool_calls_list:
                            yield f"data: {json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': model_name, 'choices': [{'index': 0, 'delta': {'tool_calls': tool_calls_list}, 'finish_reason': None}]})}"
                        else:
                            chunk_size = 20
                            for i in range(0, len(answer), chunk_size):
                                yield f"data: {json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': model_name, 'choices': [{'index': 0, 'delta': {'content': answer[i:i+chunk_size]}, 'finish_reason': None}]})}"
                        yield f"data: {json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': model_name, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish_reason}]})}"
                        yield "data: [DONE]"
                    return Response(gen_openai_sse(), mimetype="text/event-stream",
                                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

                return jsonify({
                    "id": cid,
                    "object": "chat.completion",
                    "created": int(datetime.now().timestamp()),
                    "model": model_name,
                    "choices": [{"index": 0, "message": msg_obj, "finish_reason": finish_reason}],
                    "usage": {
                        "prompt_tokens": len(full_prompt),
                        "completion_tokens": len(answer),
                        "total_tokens": len(full_prompt) + len(answer),
                    },
                }), 200
            finally:
                account_pool.release(acc)
        except Exception as e:
            return jsonify({"error": {"message": str(e)}}), 500

    def _chat_as_image(req_data, pool):
        """当 chat/completions 传入图片模型时，走图片生成"""
        model = req_data.get("model")
        cfg = IMAGE_MODEL_ROUTER[model]
        messages = req_data.get("messages", [])
        prompt = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                c = msg.get("content", "")
                prompt = c if isinstance(c, str) else _extract_text_from_content(c)
                break
        if not prompt:
            return jsonify({"error": {"message": "No prompt"}}), 400
        ratio = parse_ratio(req_data.get("size", "1024x1024"))
        acc = pool.acquire(cfg["cost"])
        try:
            api_client.update_user_settings(acc.jwt, ratio)
            ok, img_url = api_client.generate_image(prompt, cfg["provider"], cfg["version"], acc.jwt)
            if not ok:
                return jsonify({"error": {"message": "Image generation failed"}}), 500
            return jsonify({
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(datetime.now().timestamp()),
                "model": model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": f"![image]({img_url})"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": len(prompt), "completion_tokens": 1, "total_tokens": len(prompt) + 1},
            }), 200
        finally:
            pool.release(acc)

    # --- 透明代理 ---
    @app.route("/proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    def proxy_handler(path):
        """透明代理到 ChatAiBot API，自动注入 JWT"""
        err = verify_api_key()
        if err:
            return err
        try:
            acc = account_pool.acquire(1)
            try:
                body = request.get_json(silent=True)
                params = request.args.to_dict()
                resp = api_client.proxy_request(acc.jwt, request.method, path, body=body, params=params)
                excluded_headers = ["content-encoding", "transfer-encoding", "connection"]
                headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded_headers]
                return Response(resp.content, status=resp.status_code, headers=headers, content_type=resp.headers.get("Content-Type"))
            finally:
                account_pool.release(acc)
        except Exception as e:
            return jsonify({"error": {"message": str(e)}}), 500

    # --- 状态查看 ---
    @app.route("/status", methods=["GET"])
    def status():
        err = verify_api_key()
        if err:
            return err
        with account_pool.lock:
            accounts = []
            total_quota = 0
            for i, acc in enumerate(account_pool.used_pool):
                # 实时查询余额
                live_quota = api_client.get_count(acc.jwt)
                acc.quota = live_quota
                total_quota += live_quota
                accounts.append({
                    "index": i,
                    "quota": live_quota,
                    "jwt_prefix": acc.jwt[:20] + "...",
                })
        return jsonify({
            "pool_size": account_pool.max_size,
            "accounts_count": len(accounts),
            "total_quota": total_quota,
            "waiting_requests": account_pool.demand_count(),
            "accounts": accounts,
        }), 200

    # --- Anthropic /v1/messages 兼容端点（Claude Code 用这个）---
    @app.route("/v1/messages", methods=["POST"])
    def anthropic_messages():
        err = verify_api_key()
        if err:
            return err
        try:
            req_data = request.get_json()
            if not req_data:
                return jsonify({"type": "error", "error": {"type": "invalid_request_error", "message": "Invalid request body"}}), 400

            model_name = req_data.get("model", DEFAULT_CHAT_MODEL)
            messages = req_data.get("messages", [])
            tools = req_data.get("tools", [])
            system_prompt = req_data.get("system", "")
            if isinstance(system_prompt, list):
                system_prompt = " ".join(p.get("text", "") for p in system_prompt if isinstance(p, dict))

            model_cfg = CHAT_MODEL_ROUTER.get(model_name)
            if not model_cfg:
                model_cfg = CHAT_MODEL_ROUTER[DEFAULT_CHAT_MODEL]

            chat_model = model_cfg["chatModel"]
            cost = model_cfg["cost"]

            full_prompt = _build_prompt(system_prompt, messages, tools)

            acc = account_pool.acquire(cost)
            try:
                chat_id = api_client.create_chat_context(acc.jwt, chat_model, title=full_prompt[:30])
                if not chat_id:
                    return jsonify({"type": "error", "error": {"type": "api_error", "message": "Failed to create chat"}}), 500

                # 第一次请求
                answer = api_client.send_chat_message(acc.jwt, chat_id, chat_model, full_prompt)
                if answer is None:
                    return jsonify({"type": "error", "error": {"type": "api_error", "message": "Chat failed"}}), 500
                if isinstance(answer, tuple):
                    status_code, err_body = answer
                    return jsonify({"type": "error", "error": {"type": "api_error", "message": err_body}}), status_code

                # 自动续写：检测回答是否未完成，最多续写 3 次
                MAX_CONTINUE = 3
                segments = [answer]
                for _ in range(MAX_CONTINUE):
                    if not _is_incomplete(segments[-1]):
                        break
                    print("[*] 回答未完成，自动续写...", flush=True)
                    _q = api_client.get_count(acc.jwt)
                    if _q != -1:
                        acc.quota = _q
                    if acc.quota < cost:
                        print("[-] 续写额度不足，停止", flush=True)
                        break
                    cont = api_client.send_chat_message(acc.jwt, chat_id, chat_model, "continue")
                    if not cont or isinstance(cont, tuple):
                        break
                    segments.append(cont)

                answer = "".join(segments)
                msg_id = f"msg_{int(time.time())}"
                content_blocks, stop_reason = _parse_tool_calls(answer, tools)

                resp_data = {
                    "id": msg_id,
                    "type": "message",
                    "role": "assistant",
                    "model": model_name,
                    "content": content_blocks,
                    "stop_reason": stop_reason,
                    "stop_sequence": None,
                    "usage": {"input_tokens": len(full_prompt), "output_tokens": len(answer)},
                }

                if req_data.get("stream"):
                    return Response(
                        _generate_sse(resp_data, content_blocks, msg_id, model_name, full_prompt, answer),
                        mimetype="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                    )

                return jsonify(resp_data), 200
            finally:
                account_pool.release(acc)
        except Exception as e:
            return jsonify({"type": "error", "error": {"type": "api_error", "message": str(e)}}), 500

    # --- 图片生成 UI ---
    @app.route("/image_gen.html", methods=["GET"])
    def image_gen_ui():
        import os
        html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "image_gen.html")
        with open(html_path, "r", encoding="utf-8") as f:
            return Response(f.read(), mimetype="text/html")

    return app


# ==========================================
# 主入口
# ==========================================

def main():
    global pool_size_global, port_global, api_client, email_session, api_key_global, account_store, reg_proxy_pool, global_proxy_url

    parser = argparse.ArgumentParser(description="ChatAiBot 2API 服务（对话+图片+透明代理）")
    parser.add_argument("--pool", type=int, default=20, help="账户池大小")
    parser.add_argument("--port", type=int, default=8888, help="服务监听端口")
    parser.add_argument("--proxy", type=str, default=None, help="代理地址，如 http://127.0.0.1:7890")
    parser.add_argument("--key", type=str, default="sk-nanobanana2api", help="API Key（Bearer Token）")
    parser.add_argument("--init-count", type=int, default=20, help="启动时初始注册账号数（默认20）")
    parser.add_argument("--accounts", type=str, default="accounts.json", help="账号持久化文件路径（默认 accounts.json）")
    parser.add_argument("--reg-proxy-http", type=str, default="http_proxies.md", help="HTTP 注册代理池文件（默认 http_proxies.md）")
    parser.add_argument("--reg-proxy-socks5", type=str, default="socks5_proxies.md", help="SOCKS5 注册代理池文件（默认 socks5_proxies.md）")
    args = parser.parse_args()

    pool_size_global = args.pool
    port_global = args.port

    # 注册代理池（HTTP + SOCKS5 合并）
    reg_proxy_pool = ProxyPool(
        http_file=args.reg_proxy_http,
        socks5_file=args.reg_proxy_socks5,
    )
    if len(reg_proxy_pool) > 0:
        print(f"[*] 注册代理池: {len(reg_proxy_pool)} 个代理（HTTP+SOCKS5 混合，每次注册独立 IP）")
    else:
        print("[!] 注册代理池为空，将尝试直连")
        reg_proxy_pool = None

    # 全局代理：优先用 --proxy 参数，其次从代理池取第一个，最后自动检测本地
    if args.proxy:
        proxies = {"http": args.proxy, "https": args.proxy}
        global_proxy_url = args.proxy
        print(f"[*] 全局代理: {args.proxy}")
    elif reg_proxy_pool and len(reg_proxy_pool) > 0:
        raw = reg_proxy_pool.next_one_raw()
        addr, kind = raw
        proxy_url = f"socks5://{addr}" if kind == "socks5" else f"http://{addr}"
        proxies = {"http": proxy_url, "https": proxy_url}
        print(f"[*] 全局代理（来自代理池）: {proxy_url}")
    else:
        proxies = get_working_proxy(None)
        if proxies:
            print(f"[*] 自动检测代理: {list(proxies.values())[0]}")
        else:
            print("[*] 直连模式")

    # 邮箱客户端（mail.chatgpt.org.uk）
    email_session = EmailSession(proxies=proxies)
    print("[*] 邮箱服务: mail.chatgpt.org.uk")

    # API 客户端
    api_client = APIClient(proxies=proxies)

    # 检测当前代理的出口 IP
    current_outbound_ip = api_client._get_current_ip()
    if current_outbound_ip:
        print(f"[*] 当前代理出口 IP: {current_outbound_ip}")
    else:
        print("[!] 无法检测出口 IP（可能网络问题或代理不可用）")

    # 账号持久化
    account_store = AccountStore(args.accounts)
    print(f"[*] 账号文件: {args.accounts}")

    # API Key（未指定则自动生成）
    api_key_global = args.key
    print(f"[*] API Key: {api_key_global}")

    # 账户池
    account_pool = start_pool(pool_size_global, init_count=args.init_count)
    print(f"[*] 号池启动（初始 {args.init_count} 个，账号耗尽自动注册）")

    # Flask
    app = create_app(account_pool)
    print(f"[*] 服务启动在 {port_global} 端口")
    print(f"[*] 端点:")
    print(f"    POST /v1/chat/completions  — 对话（真 2API）")
    print(f"    POST /v1/images/generations — 图片生成")
    print(f"    GET  /v1/models             — 模型列表")
    print(f"    ANY  /proxy/{{path}}          — 透明代理")
    print(f"[*] New API 配置: Base URL = http://IP:{port_global}, Key = {api_key_global}")
    serve(app, host="0.0.0.0", port=port_global, threads=8)


if __name__ == "__main__":
    main()
