/**
 * @fileoverview Carbon Ledger backend proxy server.
 * Sits between the browser and AI provider APIs so that API keys
 * are never exposed to the client. Forwards prompts from the frontend
 * to Claude (Anthropic) or Groq (Llama3) and returns the AI response.
 *
 * Security measures:
 * - CORS restricted to the configured FRONTEND_URL origin only
 * - Rate limiting: 30 AI requests per minute per IP
 * - Input length capped server-side (system 2000 chars, message 3000 chars)
 * - HTTP security headers on every response
 * - API keys only read from process.env; never logged or returned
 *
 * @module server
 * @version 1.0.0
 */

'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const fetch     = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('X-XSS-Protection',          '1; mode=block');
  res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '20kb' }));
app.options('*', cors());

/** @type {string[]} Permitted CORS origins */
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not permitted`));
  },
  methods:        ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

/**
 * Rate limiter: max 30 AI requests per IP per minute.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const aiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  message:         { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * GET /health
 * Returns server status and provider key availability.
 */
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    providers: {
      claude: Boolean(process.env.CLAUDE_API_KEY),
      grok:   Boolean(process.env.GROK_API_KEY),
    },
  });
});

/**
 * Validates and sanitises common AI request body fields.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @returns {{ system: string, safeMessage: string }|null}
 */
function _validateBody(req, res) {
  const { system, userMessage } = req.body;
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    res.status(400).json({ error: 'userMessage is required and must be a non-empty string.' });
    return null;
  }
  return {
    system:      String(system || '').slice(0, 2000),
    safeMessage: String(userMessage).slice(0, 3000),
  };
}

/**
 * POST /api/claude
 * Proxies the request to Anthropic Claude API.
 * Injects CLAUDE_API_KEY server-side; never returned to client.
 */
app.post('/api/claude', aiLimiter, async (req, res) => {
  if (!process.env.CLAUDE_API_KEY) {
    return res.status(503).json({ error: 'Claude API key not configured on server.' });
  }

  const validated = _validateBody(req, res);
  if (!validated) return;
  const { system, safeMessage } = validated;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: Math.min(Number(req.body.maxTokens) || 1000, 1000),
        system,
        messages: [{ role: 'user', content: safeMessage }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({
        error: err?.error?.message || `Claude API error ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const text = data?.content?.find(b => b.type === 'text')?.text || '';
    if (!text) return res.status(502).json({ error: 'Claude returned an empty response.' });
    res.json({ text });

  } catch (_err) {
    res.status(500).json({ error: 'Failed to reach Claude API. Please try again.' });
  }
});

/**
 * POST /api/grok
 * Proxies the request to Groq API (Llama3, OpenAI-compatible format).
 * Injects GROK_API_KEY server-side; never returned to client.
 */
app.post('/api/grok', aiLimiter, async (req, res) => {
  if (!process.env.GROK_API_KEY) {
    return res.status(503).json({ error: 'Grok API key not configured on server.' });
  }

  const validated = _validateBody(req, res);
  if (!validated) return;
  const { system, safeMessage } = validated;

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model:      'llama3-8b-8192',
        max_tokens: Math.min(Number(req.body.maxTokens) || 1000, 1000),
        messages: [
          { role: 'system', content: system      },
          { role: 'user',   content: safeMessage },
        ],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({
        error: err?.error?.message || `Grok API error ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) return res.status(502).json({ error: 'Grok returned an empty response.' });
    res.json({ text });

  } catch (_err) {
    res.status(500).json({ error: 'Failed to reach Grok API. Please try again.' });
  }
});

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// Global error handler
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  process.stdout.write(`Carbon Ledger backend on port ${PORT}\n`);
  process.stdout.write(`Claude: ${process.env.CLAUDE_API_KEY ? 'set' : 'MISSING'}\n`);
  process.stdout.write(`Grok:   ${process.env.GROK_API_KEY   ? 'set' : 'MISSING'}\n`);
});
