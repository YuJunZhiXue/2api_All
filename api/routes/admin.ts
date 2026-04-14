import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { analyzeAndOnboard } from '../services/analyzer.js';

const router = express.Router();

// Get Status
router.get('/status', async (req, res) => {
  try {
    const db = await getDb();
    const sitesCount = await db.get('SELECT COUNT(*) as c FROM sites');
    const sessionsCount = await db.get('SELECT COUNT(*) as c FROM sessions');
    const keysCount = await db.get('SELECT COUNT(*) as c FROM api_keys');
    
    res.json({
      success: true,
      data: {
        qps: Math.random().toFixed(2), // Mock
        successRate: '99.9%', // Mock
        activeSessions: sessionsCount.c,
        totalSites: sitesCount.c,
        apiKeys: keysCount.c
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Sites CRUD
router.get('/sites', async (req, res) => {
  try {
    const db = await getDb();
    const sites = await db.all('SELECT * FROM sites');
    res.json({ success: true, data: sites });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/sites', async (req, res) => {
  try {
    const { name, url, dom_selectors_json } = req.body;
    const id = uuidv4();
    const db = await getDb();
    await db.run('INSERT INTO sites (id, name, url, dom_selectors_json) VALUES (?, ?, ?, ?)', [id, name, url, dom_selectors_json]);
    res.json({ success: true, data: { id, name, url, dom_selectors_json } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/sites/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM sites WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Sessions CRUD
router.get('/sessions', async (req, res) => {
  try {
    const db = await getDb();
    const sessions = await db.all(`
      SELECT s.*, st.name as site_name 
      FROM sessions s 
      JOIN sites st ON s.site_id = st.id
    `);
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { site_id, cookie_json } = req.body;
    const id = uuidv4();
    const db = await getDb();
    await db.run('INSERT INTO sessions (id, site_id, cookie_json, is_active, last_used_at) VALUES (?, ?, ?, 1, datetime("now"))', [id, site_id, cookie_json]);
    res.json({ success: true, data: { id, site_id, cookie_json, is_active: 1 } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Keys CRUD
router.get('/keys', async (req, res) => {
  try {
    const db = await getDb();
    const keys = await db.all('SELECT * FROM api_keys');
    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/keys', async (req, res) => {
  try {
    const id = 'sk-' + uuidv4().replace(/-/g, '');
    const db = await getDb();
    await db.run('INSERT INTO api_keys (key, total_calls, is_active) VALUES (?, 0, 1)', [id]);
    res.json({ success: true, data: { key: id, total_calls: 0, is_active: 1 } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/keys/:key', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM api_keys WHERE key = ?', [req.params.key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Auto Analyze & Onboard
router.post('/analyze', async (req, res) => {
  try {
    const { url, email, password } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL 是必填项" });
    }

    const result = await analyzeAndOnboard(url, email, password);

    if (!result.success || !result.data) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const db = await getDb();
    const siteId = uuidv4();
    const siteName = new URL(url).hostname.replace('www.', '').split('.')[0] + '-auto';
    
    // Save the analyzed site
    const domSelectorsJson = JSON.stringify(result.data.domSelectors);
    await db.run('INSERT INTO sites (id, name, url, dom_selectors_json) VALUES (?, ?, ?, ?)', [siteId, siteName, url, domSelectorsJson]);

    // Save the captured session
    const sessionId = uuidv4();
    const cookieJson = JSON.stringify(result.data.cookies || []);
    await db.run('INSERT INTO sessions (id, site_id, cookie_json, is_active, last_used_at) VALUES (?, ?, ?, 1, datetime("now"))', [sessionId, siteId, cookieJson]);

    res.json({ 
      success: true, 
      data: {
        siteId,
        siteName,
        sessionId,
        logs: result.data.logs,
        apiCandidates: result.data.apiCandidates
      } 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
