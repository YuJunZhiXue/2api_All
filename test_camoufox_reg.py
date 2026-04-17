import sys
import importlib.util
import asyncio
import nest_asyncio

nest_asyncio.apply()

spec = importlib.util.spec_from_file_location("api", "2api.py")
api = importlib.util.module_from_spec(spec)
sys.modules["api"] = api
spec.loader.exec_module(api)

async def main():
    print("[*] Initializing EmailSession...")
    email_session = api.EmailSession()
    email, token = email_session.get_email_and_token()
    
    if not email:
        print("[-] Failed to get email.")
        return
        
    print(f"[+] Got temporary email: {email}")
    print(f"[*] Overriding password to be the same as email: {email}")
    api._generate_browser_password = lambda *args: email

    print("[*] Starting browser registration via Camoufox...")
    success, jwt = api.create_account_browser(email_session)
    
    if success:
        print(f"[+] Registration Success! JWT: {jwt[:30]}...")
    else:
        print("[-] Registration Failed.")

if __name__ == "__main__":
    asyncio.run(main())
