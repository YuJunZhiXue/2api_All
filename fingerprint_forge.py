import time
import uuid
import json
import base64
from curl_cffi import requests as cffi_requests

def generate_hardware_fingerprint():
    """构造深度硬件指纹，完全模拟真实 PC (CPU, GPU, WebGL, Canvas 等)"""
    return {
        # 基础浏览器/系统信息
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "language": "zh-CN",
        "languages": ["zh-CN", "zh", "en-US", "en"],
        "colorDepth": 24,
        "deviceMemory": 8, # 内存(GB)
        "hardwareConcurrency": 16, # 逻辑处理器核心数 (CPU)
        
        # 屏幕与视口
        "screenResolution": [1920, 1080],
        "availableScreenResolution": [1920, 1040],
        "timezoneOffset": -480, # UTC+8
        "timezone": "Asia/Shanghai",
        
        # 会话与存储
        "sessionStorage": True,
        "localStorage": True,
        "indexedDb": True,
        "openDatabase": True,
        
        # 硬件/外设特征
        "cpuClass": "unknown", # Chrome 默认返回 undefined/unknown
        "platform": "Win32",
        "plugins": [
            "Chrome PDF Plugin", 
            "Chrome PDF Viewer", 
            "Native Client"
        ],
        
        # Canvas 渲染哈希 (伪造的独特指纹)
        "canvas": "canvas_hash_5a9b8c7d6e5f4",
        
        # WebGL 显卡硬件特征 (GPU)
        "webglVendorAndRenderer": "Google Inc. (NVIDIA)~NVIDIA GeForce RTX 4070 Ti SUPER/PCIe/SSE2",
        "webgl": {
            "vendor": "Google Inc. (NVIDIA)",
            "renderer": "NVIDIA GeForce RTX 4070 Ti SUPER/PCIe/SSE2",
            "version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
            "shadingLanguageVersion": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)"
        },
        
        # AudioContext 声卡指纹
        "audio": 124.04347527516,
        
        # 字体渲染特征
        "fonts": [
            "Arial", "Calibri", "Cambria", "Comic Sans MS", "Consolas", 
            "Courier New", "Georgia", "Impact", "Microsoft Sans Serif", 
            "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"
        ],
        
        # 触控与输入
        "touchSupport": [0, False, False], # 最大触控点, 触控事件, 触控点是否可用
        
        # WebRTC 泄露模拟 (内网 IP)
        "webrtc": "192.168.1.105",
        
        # 电池与网络状态
        "battery": {
            "charging": True,
            "level": 1.0
        },
        "network": {
            "downlink": 10,
            "effectiveType": "4g",
            "rtt": 50,
            "saveData": False
        },
        
        # 客户端生成时间与防篡改验证 (PoW 或简单哈希)
        "clientTimestamp": int(time.time() * 1000),
        "fingerprintVersion": "v1.4.2"
    }

def encode_payload(payload):
    """将指纹 JSON 转换为 Base64 (模拟常见的探针加密传输)"""
    json_str = json.dumps(payload, separators=(',', ':'))
    return base64.b64encode(json_str.encode('utf-8')).decode('utf-8')

def main():
    email = "sdonovan422@hyh.mfkth.de5.net"
    print(f"[*] 目标账号: {email}")
    print("[*] 正在生成深度硬件指纹 (CPU/GPU/WebGL/Canvas)...")
    
    fp = generate_hardware_fingerprint()
    print(f"[*] GPU 伪装为: {fp['webglVendorAndRenderer']}")
    print(f"[*] CPU 核心数伪装为: {fp['hardwareConcurrency']}")
    
    encoded_fp = encode_payload(fp)
    
    # 初始化具备底层 TLS 伪装的 Session
    session = cffi_requests.Session(impersonate="chrome120")
    
    headers = {
        "User-Agent": fp["userAgent"],
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin": "https://chataibot.pro",
        "Referer": "https://chataibot.pro/app/auth/sign-up?variant=new",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Content-Type": "application/json",
        "x-distribution-channel": "web",
    }
    
    print("\n[*] 步骤 1: 提交硬件指纹至风控探针...")
    tracking_payload = {
        "token": "phc_your_tracking_token", # 假设的探针项目 ID
        "distinct_id": str(uuid.uuid4()),
        "hardware_fingerprint": encoded_fp, # 核心伪装载荷
        "properties": {
            "$browser": "Chrome",
            "$browser_version": 120,
            "$os": "Windows",
            "$screen_height": fp["screenResolution"][1],
            "$screen_width": fp["screenResolution"][0],
            "$current_url": "https://chataibot.pro/app/auth/sign-up?variant=new",
        }
    }
    
    try:
        res = session.post("https://chataibot.ru/api/tracking/token", json=tracking_payload, headers=headers, timeout=5)
        print(f"[探针返回]: {res.status_code} - {res.text[:50]}")
    except Exception as e:
        print(f"[!] 探针提交失败或超时 (正常忽略): {e}")

    time.sleep(1)

    print("\n[*] 步骤 2: 携指纹状态发起注册突防...")
    # 模拟 Yandex Client ID (基于时间戳和随机数的生成规则)
    yandex_id = f"{int(time.time()*1000)}{str(uuid.uuid4().int)[:6]}"
    
    register_payload = {
        "email": email,
        "password": email,
        "isAdvertisingAccepted": False,
        "mainSiteUrl": "https://chataibot.pro/app/auth/sign-up?variant=new",
        "utmSource": "",
        "utmCampaign": "",
        "connectBusiness": "",
        "yandexClientId": yandex_id,
        # 有些风控要求在注册 payload 里直接附带指纹哈希
        "clientFingerprint": encoded_fp[:32] 
    }
    
    try:
        resp = session.post("https://chataibot.pro/api/register", json=register_payload, headers=headers, timeout=10)
        print(f"[注册状态码]: {resp.status_code}")
        print(f"[注册返回体]: {resp.text}")
        
        if resp.status_code == 200 and resp.json().get("success"):
            print("\n[+] LO！硬件级指纹伪装成功！纯 Python 突破防线！")
        else:
            print("\n[-] Yandex 风控比想象中深，可能存在阵列加密(如 array.js 里的 PoW 挑战) 未被完美模拟。")
    except Exception as e:
        print(f"\n[-] 注册请求崩溃: {e}")

if __name__ == "__main__":
    main()
