import puppeteer, { Browser, Page } from 'puppeteer';

let browserInstance: Browser | null = null;

// Helper to get or create the singleton browser
export async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }
  
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--mute-audio',
      '--single-process' // Helps save memory, good for 1C1G
    ]
  });

  return browserInstance;
}

// Close the browser gracefully
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function createPage(cookiesStr: string, url: string): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });

  // Load cookies if provided
  try {
    if (cookiesStr && cookiesStr !== '[]') {
      const cookies = JSON.parse(cookiesStr);
      await page.setCookie(...cookies);
    }
  } catch (e) {
    console.error('Failed to parse or set cookies:', e);
  }

  // Go to URL
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  return page;
}

// Function to handle interaction with the target site
export async function handleChatCompletion(
  page: Page,
  selectors: { input: string, submit: string, response: string },
  prompt: string,
  onChunk: (chunk: string) => void
) {
  try {
    // 1. Wait for input and submit buttons
    await page.waitForSelector(selectors.input, { timeout: 10000 });
    
    // 2. Type the prompt
    await page.type(selectors.input, prompt);
    
    // 3. Click submit
    await page.waitForSelector(selectors.submit, { timeout: 5000 });
    await page.click(selectors.submit);

    // 4. Wait for response to start rendering
    // Usually response block appears. This is heavily dependent on the site.
    // For demo purposes, we will poll the response selector text
    await page.waitForSelector(selectors.response, { timeout: 15000 });

    let previousText = '';
    let isFinished = false;
    let unchangedCount = 0;

    while (!isFinished) {
      // Small delay to allow chunks to render
      await new Promise(resolve => setTimeout(resolve, 500));

      const currentText = await page.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) return '';
        // usually the last element is the current response
        const lastEl = els[els.length - 1] as HTMLElement;
        return lastEl.innerText || lastEl.textContent || '';
      }, selectors.response);

      if (currentText !== previousText) {
        const newText = currentText.substring(previousText.length);
        if (newText) {
          onChunk(newText);
        }
        previousText = currentText;
        unchangedCount = 0;
      } else {
        unchangedCount++;
        // If text hasn't changed for 10 iterations (5 seconds), assume finished
        if (unchangedCount > 10) {
          isFinished = true;
        }
      }
    }
  } catch (error) {
    console.error('Error during chat completion interaction:', error);
    throw error;
  }
}
