/**
 * server.js
 * Carbon Ledger - AI proxy backend
 * Keeps API keys server-side. Frontend never sees them.
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const fetch      = require('node-fetch');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────

app.use(express.json({ limit: '20kb' }));

// Allow requests from your Netlify frontend only
const allowedOrigins = [
  process.env.FRONTEND_URL,       // e.g. https://carbon-ledger-xyz.netlify.app
  'http://localhost:5500',         // live server local dev
  'http://127.0.0.1:5500',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl) only in dev
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['POST', 'GET'],
}));

// Rate limiting: 30 AI requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Health check ────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    providers: {
      claude: !!process.env.CLAUDE_API_KEY,
      grok:   !!process.env.GROK_API_KEY,
    },
  });
});

// ─── Claude proxy ────────────────────────────────────────────

app.post('/api/claude', aiLimiter, async (req, res) => {
  const { system, userMessage, maxTokens } = req.body;

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(503).json({ error: 'Claude API key not configured on server.' });
  }

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required.' });
  }

  // Sanitize: trim and cap length
  const safeSystem  = String(system  || '').slice(0, 2000);
  const safeMessage = String(userMessage).slice(0, 3000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: Math.min(maxTokens || 1000, 1000),
        system:     safeSystem,
        messages:   [{ role: 'user', content: safeMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Claude API error:', err);
      return res.status(response.status).json({
        error: err?.error?.message || 'Claude API error',
      });
    }

    const data = await response.json();
    const text = data?.content?.find(b => b.type === 'text')?.text || '';
    res.json({ text });

  } catch (err) {
    console.error('Claude proxy error:', err.message);
    res.status(500).json({ error: 'Failed to reach Claude API.' });
  }
});

// ─── Grok proxy ──────────────────────────────────────────────

app.post('/api/grok', aiLimiter, async (req, res) => {
  const { system, userMessage, maxTokens } = req.body;

  if (!process.env.GROK_API_KEY) {
    return res.status(503).json({ error: 'Grok API key not configured on server.' });
  }

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required.' });
  }

  const safeSystem  = String(system  || '').slice(0, 2000);
  const safeMessage = String(userMessage).slice(0, 3000);

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model:      'grok-3-mini',
        max_tokens: Math.min(maxTokens || 1000, 1000),
        messages: [
          { role: 'system', content: safeSystem  },
          { role: 'user',   content: safeMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Grok API error:', err);
      return res.status(response.status).json({
        error: err?.error?.message || 'Grok API error',
      });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    res.json({ text });

  } catch (err) {
    console.error('Grok proxy error:', err.message);
    res.status(500).json({ error: 'Failed to reach Grok API.' });
  }
});

// ─── 404 catch-all ───────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ─── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Carbon Ledger backend running on port ${PORT}`);
  console.log(`Claude key: ${process.env.CLAUDE_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`Grok key:   ${process.env.GROK_API_KEY   ? 'set' : 'MISSING'}`);
});
