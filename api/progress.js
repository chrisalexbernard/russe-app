// api/progress.js
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'russe:state';
const TOTAL = 28;

function clamp(n) {
  const i = parseInt(n, 10);
  return Number.isFinite(i) ? Math.min(TOTAL, Math.max(0, i)) : 0;
}

async function upstashGet(key) {
  const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REST_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Upstash GET ${res.status}`);
  const body = await res.json();
  return body.result; // string | null
}

async function upstashSet(key, value) {
  const res = await fetch(`${REST_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    body: value
  });
  if (!res.ok) throw new Error(`Upstash SET ${res.status}`);
}

async function readState() {
  const raw = await upstashGet(KEY);
  if (!raw) return { lessonsDone: 0, dates: {} };
  try {
    const parsed = JSON.parse(raw);
    return {
      lessonsDone: clamp(parsed.lessonsDone),
      dates: parsed.dates && typeof parsed.dates === 'object' ? parsed.dates : {}
    };
  } catch (e) {
    return { lessonsDone: 0, dates: {} };
  }
}

module.exports = async function handler(req, res) {
  if (!REST_URL || !REST_TOKEN) {
    res.status(500).json({ error: 'Upstash not configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(await readState());
      return;
    }
    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const lessonsDone = parseInt(body.lessonsDone, 10);
      if (!Number.isFinite(lessonsDone) || lessonsDone < 0 || lessonsDone > TOTAL) {
        res.status(400).json({ error: 'lessonsDone must be an integer 0-28' });
        return;
      }
      const current = await readState();
      let dates = current.dates;
      if (typeof body.date === 'string' && body.date.trim()) {
        dates = { ...current.dates, [String(lessonsDone)]: body.date.trim().slice(0, 40) };
      }
      const next = { lessonsDone, dates };
      await upstashSet(KEY, JSON.stringify(next));
      res.status(200).json(next);
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
};
