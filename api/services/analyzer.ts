import puppeteer, { Page } from 'puppeteer';

export async function analyzeAndOnboard(url: string, email?: string, password?: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const networkRequests: any[] = [];
    let capturedToken = '';

    // 开启网络拦截 (抓包)
    await page.setRequestInterception(true);
    page.on('request', request => {
      const headers = request.headers();
      // 尝试捕获 Bearer Token 或者其他鉴权头
      if (headers['authorization']) {
        capturedToken = headers['authorization'];
      }
      request.continue();
    });

    page.on('response', async response => {
      const req = response.request();
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        networkRequests.push({
          url: req.url(),
          method: req.method(),
          status: response.status()
        });
      }
    });

    console.log(`[Analyzer] Navigating to ${url} ...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 启发式寻找登录或注册按钮
    console.log(`[Analyzer] Looking for Login/Signup buttons...`);
    const authButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(el => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('log in') || text.includes('sign in') || text.includes('登录') || text.includes('sign up') || text.includes('注册');
      });
    });

    if (authButton && authButton.asElement()) {
      console.log(`[Analyzer] Found Auth Button, clicking...`);
      await authButton.asElement()?.click();
      await new Promise(r => setTimeout(r, 2000)); // 等待表单渲染
    }

    // 寻找输入框并填写账号密码
    if (email && password) {
      console.log(`[Analyzer] Trying to fill credentials...`);
      const emailInput = await page.$('input[type="email"], input[name*="email"], input[name*="user"]');
      const passwordInput = await page.$('input[type="password"]');

      if (emailInput && passwordInput) {
        await emailInput.type(email);
        await passwordInput.type(password);

        // 寻找提交按钮
        const submitBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button[type="submit"], button'));
          return btns.find(b => {
            const t = b.textContent?.toLowerCase() || '';
            return t.includes('submit') || t.includes('log in') || t.includes('sign in') || t.includes('登录') || t.includes('continue');
          });
        });

        if (submitBtn && submitBtn.asElement()) {
          console.log(`[Analyzer] Submitting form...`);
          await submitBtn.asElement()?.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
            // 如果没有发生导航，而是 AJAX 请求，等待 3 秒
            return new Promise(r => setTimeout(r, 3000));
          });
        }
      } else {
        console.log(`[Analyzer] Could not find email/password inputs.`);
      }
    }

    // 抓取 Cookie 和 LocalStorage
    console.log(`[Analyzer] Capturing Session Data...`);
    const cookies = await page.cookies();
    const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));

    // 分析抓到的接口，寻找可能的对话/补全接口
    const apiCandidates = networkRequests.filter(r => r.method === 'POST' && (r.url.includes('chat') || r.url.includes('completion') || r.url.includes('generate')));

    // 智能推断 DOM Selectors (简单的后备)
    const domSelectors = await page.evaluate(() => {
      let input = 'textarea';
      let submit = 'button[type="submit"]';
      let response = '.prose, .markdown, .message';
      return { input, submit, response };
    });

    await browser.close();

    return {
      success: true,
      data: {
        cookies,
        localStorageData,
        capturedToken,
        apiCandidates,
        domSelectors,
        logs: `分析完成。捕获到了 ${cookies.length} 个 Cookie，拦截到了 ${networkRequests.length} 个网络请求，找到了 ${apiCandidates.length} 个潜在的 API 端点。`
      }
    };

  } catch (error: any) {
    await browser.close();
    console.error('[Analyzer Error]', error);
    return {
      success: false,
      error: error.message
    };
  }
}
