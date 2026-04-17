import requests

email = "sdonovan422@hyh.mfkth.de5.net"
password = email
payload = {
    "email": email,
    "password": password,
    "isAdvertisingAccepted": False,
    "mainSiteUrl": "https://chataibot.pro/api",
    "utmSource": "",
    "utmCampaign": "",
    "connectBusiness": "",
    "yandexClientId": "1774357327418729490"
}

headers = {
    "Content-Type": "application/json",
    "x-distribution-channel": "web",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0.0.0 Safari/537.36"
}

resp = requests.post("https://chataibot.pro/api/register", json=payload, headers=headers)
print("Status:", resp.status_code)
print("Body:", resp.text)
