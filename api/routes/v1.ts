import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { createPage, closeBrowser } from '../services/puppeteer.js';
import { Browser, Page } from 'puppeteer';

const router = express.Router();

router.post('/chat/completions', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: "Invalid API Key", type: "invalid_request_error" } });
  }

  const apiKey = authHeader.split(' ')[1];
  const db = await getDb();
  
  // Verify API Key
  const keyRow = await db.get('SELECT * FROM api_keys WHERE key = ? AND is_active = 1', [apiKey]);
  if (!keyRow) {
    return res.status(401).json({ error: { message: "Invalid API Key", type: "invalid_request_error" } });
  }

  const { model, messages, stream } = req.body;
  if (!model || !messages || messages.length === 0) {
    return res.status(400).json({ error: { message: "Model and messages are required", type: "invalid_request_error" } });
  }

  // model name corresponds to site.id or site.name
  const site = await db.get('SELECT * FROM sites WHERE id = ? OR name = ?', [model, model]);
  if (!site) {
    return res.status(404).json({ error: { message: `Model '${model}' not found. Please register the site first.`, type: "invalid_request_error" } });
  }

  // Get an active session
  const session = await db.get('SELECT * FROM sessions WHERE site_id = ? AND is_active = 1 ORDER BY RANDOM() LIMIT 1', [site.id]);
  if (!session) {
    return res.status(503).json({ error: { message: `No active session available for model '${model}'.`, type: "server_error" } });
  }

  // Update key usage
  await db.run('UPDATE api_keys SET total_calls = total_calls + 1 WHERE key = ?', [apiKey]);

  const selectors = JSON.parse(site.dom_selectors_json);
  const prompt = messages[messages.length - 1].content;
  const completionId = 'chatcmpl-' + uuidv4();
  
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Simulate streaming for now if we can't fully connect puppeteer without breaking memory
    // In a real scenario, we'd pipe the puppeteer output here.
    try {
      // Create page and run
      // For demonstration, we simulate if dom_selectors_json is incomplete or empty
      if (!selectors.input || !selectors.submit || !selectors.response) {
        throw new Error('Selectors not properly configured');
      }
      
      const page = await createPage(session.cookie_json, site.url);
      
      await page.waitForSelector(selectors.input, { timeout: 10000 });
      await page.type(selectors.input, prompt);
      await page.click(selectors.submit);

      let isFinished = false;
      let previousText = '';
      let unchangedCount = 0;

      while (!isFinished) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentText = await page.evaluate((sel: string) => {
          const els = document.querySelectorAll(sel);
          if (els.length === 0) return '';
          const lastEl = els[els.length - 1] as HTMLElement;
          return lastEl.innerText || lastEl.textContent || '';
        }, selectors.response);

        if (currentText !== previousText) {
          const newText = currentText.substring(previousText.length);
          if (newText) {
            res.write(`data: ${JSON.stringify({
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: model,
              choices: [{ delta: { content: newText }, index: 0, finish_reason: null }]
            })}\n\n`);
          }
          previousText = currentText;
          unchangedCount = 0;
        } else {
          unchangedCount++;
          if (unchangedCount > 10) isFinished = true; // 5 seconds of no change
        }
      }

      await page.close();

      res.write(`data: ${JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{ delta: {}, index: 0, finish_reason: 'stop' }]
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (e: any) {
      console.error(e);
      // Fallback simulation for demonstration if headless fails
      const mockResponse = `This is a mock response from 2api for ${model}. Error during real execution: ${e.message}`;
      const chunks = mockResponse.split(' ');
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{ delta: { content: chunk + ' ' }, index: 0, finish_reason: null }]
        })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } else {
    // Non-streaming
    res.json({
      id: completionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        message: {
          role: 'assistant',
          content: `This is a mock response from 2api for ${model} (Non-streaming).`
        },
        finish_reason: 'stop',
        index: 0
      }]
    });
  }
});

export default router;
