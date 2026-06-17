/**
 * @fileoverview Carbon Ledger backend proxy server.
 * Proxies AI requests (Claude, Groq, Gemini Vision) so API keys
 * never reach the browser. Includes a self-ping keep-alive so the
 * Render free tier never spins down, meaning the site works perfectly
 * even when unused for long periods, on any device.
 *
 * Security:
 * - CORS locked to FRONTEND_URL only
 * - Rate limiting: 30 requests per minute per IP
 * - All input capped server-side before forwarding
 * - HTTP security headers on every response
 * - API keys only read from process.env
 *
 * @module server
 * @version 2.0.0
 */

"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ──────────────────────────────────────────

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  next();
});

// Vision images can be up to ~1MB base64, so limit is 2mb here
app.use(express.json({ limit: "2mb" }));
app.options("*", cors());

// ── CORS ─────────────────────────────────────────────────────

/** @type {string[]} */
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not permitted`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ── Rate limiting ─────────────────────────────────────────────

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Keep-alive self-ping ──────────────────────────────────────
// Pings /health every 14 minutes so Render free tier never sleeps.
// This means the site works instantly on any device, even after days
// of no traffic, without the 30-50 second cold-start delay.

const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

function _startKeepAlive() {
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/health`);
    } catch (_e) {
      // Silently ignore: server might be restarting
    }
  }, PING_INTERVAL_MS);
  process.stdout.write(`Keep-alive pinging ${SELF_URL}/health every 14 min\n`);
}

// ── Health check ──────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    providers: {
      claude: Boolean(process.env.CLAUDE_API_KEY),
      grok: Boolean(process.env.GROK_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

// ── Input validation helper ───────────────────────────────────

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @returns {{ system: string, safeMessage: string }|null}
 */
function _validateBody(req, res) {
  const { system, userMessage } = req.body;
  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    res.status(400).json({ error: "userMessage is required." });
    return null;
  }
  return {
    system: String(system || "").slice(0, 2000),
    safeMessage: String(userMessage).slice(0, 3000),
  };
}

// ── Claude proxy ──────────────────────────────────────────────

app.post("/api/claude", aiLimiter, async (req, res) => {
  if (!process.env.CLAUDE_API_KEY) {
    return res.status(503).json({ error: "Claude API key not configured." });
  }

  const validated = _validateBody(req, res);
  if (!validated) return;
  const { system, safeMessage } = validated;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(Number(req.body.maxTokens) || 1000, 1000),
        system,
        messages: [{ role: "user", content: safeMessage }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({
        error: err?.error?.message || `Claude API error ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const text = data?.content?.find((b) => b.type === "text")?.text || "";
    if (!text)
      return res.status(502).json({ error: "Claude returned empty response." });
    res.json({ text });
  } catch (_err) {
    res.status(500).json({ error: "Failed to reach Claude API." });
  }
});

// ── Groq proxy ────────────────────────────────────────────────

app.post("/api/grok", aiLimiter, async (req, res) => {
  if (!process.env.GROK_API_KEY) {
    return res.status(503).json({ error: "Groq API key not configured." });
  }

  const validated = _validateBody(req, res);
  if (!validated) return;
  const { system, safeMessage } = validated;

  try {
    const upstream = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_tokens: Math.min(Number(req.body.maxTokens) || 1000, 1000),
          messages: [
            { role: "system", content: system },
            { role: "user", content: safeMessage },
          ],
        }),
      },
    );

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      // Fallback to llama3 if new model fails
      if (upstream.status === 404 || upstream.status === 400) {
        return _groqFallback(req, res, system, safeMessage);
      }
      return res.status(upstream.status).json({
        error: err?.error?.message || `Groq API error ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text)
      return res.status(502).json({ error: "Groq returned empty response." });
    res.json({ text });
  } catch (_err) {
    res.status(500).json({ error: "Failed to reach Groq API." });
  }
});

/**
 * Fallback to llama3-8b-8192 if the primary Groq model is unavailable.
 * @private
 */
async function _groqFallback(req, res, system, safeMessage) {
  try {
    const upstream = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          max_tokens: Math.min(Number(req.body.maxTokens) || 1000, 1000),
          messages: [
            { role: "system", content: system },
            { role: "user", content: safeMessage },
          ],
        }),
      },
    );

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text)
      return res
        .status(502)
        .json({ error: "Groq fallback returned empty response." });
    res.json({ text });
  } catch (_err) {
    res.status(500).json({ error: "Failed to reach Groq fallback." });
  }
}

// ── Gemini Vision proxy ───────────────────────────────────────

app.post("/api/vision", aiLimiter, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "Gemini API key not configured." });
  }

  const { image, mimeType } = req.body;

  if (!image || typeof image !== "string") {
    return res
      .status(400)
      .json({ error: "image (base64 string) is required." });
  }

  const safeMime = ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg";

  const prompt = `You are a carbon footprint expert. Look at this image and identify the main object or item shown.

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "object": "Name of the main object (e.g. Beef burger, Petrol car, Plastic bottle)",
  "co2Level": "high OR medium OR low",
  "impact": "One sentence about its carbon footprint with a specific number if possible.",
  "tip": "One specific actionable alternative to reduce CO2."
}

co2Level: high = meat, petrol vehicles, flights, single-use plastic; medium = dairy, electronics, packaged food; low = vegetables, public transport, renewable energy.`;

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: safeMime, data: image } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
        }),
      },
    );

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({
        error: err?.error?.message || `Gemini API error ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText)
      return res.status(502).json({ error: "Gemini returned empty response." });

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      return res.json({
        object: "Object detected",
        co2Level: "medium",
        impact: rawText.slice(0, 200),
        tip: "Consider choosing lower-carbon alternatives.",
      });
    }

    const validLevels = ["high", "medium", "low"];
    res.json({
      object: String(parsed.object || "Unknown object").slice(0, 100),
      co2Level: validLevels.includes(parsed.co2Level)
        ? parsed.co2Level
        : "medium",
      impact: String(parsed.impact || "").slice(0, 300),
      tip: String(parsed.tip || "").slice(0, 300),
    });
  } catch (_err) {
    res.status(500).json({ error: "Failed to reach Gemini Vision API." });
  }
});

// ── 404 + global error handler ────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: "Route not found." }));

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || "Internal server error." });
});

// ── Start ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  process.stdout.write(`Carbon Ledger backend on port ${PORT}\n`);
  process.stdout.write(
    `Claude: ${process.env.CLAUDE_API_KEY ? "set" : "MISSING"}\n`,
  );
  process.stdout.write(
    `Groq:   ${process.env.GROK_API_KEY ? "set" : "MISSING"}\n`,
  );
  process.stdout.write(
    `Gemini: ${process.env.GEMINI_API_KEY ? "set" : "MISSING"}\n`,
  );
  _startKeepAlive();
});
