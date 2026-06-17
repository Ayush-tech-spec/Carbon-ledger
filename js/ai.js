/**
 * @fileoverview AI abstraction layer for Carbon Ledger.
 * Routes AI requests through the backend proxy server so API keys
 * are never exposed in the browser. Supports Claude (Anthropic) and
 * Grok (Groq/Llama3) via a unified interface.
 *
 * @module ai
 * @version 1.0.0
 */

'use strict';

/**
 * AI — singleton module using the Revealing Module Pattern.
 * All network calls go to the backend proxy, never directly to AI providers.
 * @namespace AI
 */
const AI = (() => {
  'use strict';

  /**
   * Base URL of the backend proxy server.
   * Resolved at runtime from window.CARBON_LEDGER_BACKEND_URL (set in app.js)
   * with a fallback to the production Render deployment.
   * @type {string}
   * @private
   */
  const BACKEND_URL = (
    (typeof window !== 'undefined' && window.CARBON_LEDGER_BACKEND_URL) ||
    'https://carbon-ledger-4i6w.onrender.com'
  );

  /**
   * Returns the currently selected AI provider key from the model selector.
   * Defaults to 'claude' if the DOM element is absent.
   * @private
   * @returns {'claude'|'grok'} Provider key
   */
  function _getProvider() {
    return UI.getCurrentModel();
  }

  /**
   * Sends a structured prompt to the backend proxy and returns the AI response.
   * The proxy injects the appropriate API key server-side before forwarding.
   *
   * @async
   * @param {string} systemPrompt - System-level instruction for the AI
   * @param {string} userMessage  - User-facing message or query
   * @returns {Promise<string>} Resolved AI text response
   * @throws {Error} If the network request fails or the backend returns an error
   */
  async function ask(systemPrompt, userMessage) {
    const provider = _getProvider();
    const endpoint = `${BACKEND_URL}/api/${provider}`;

    /** @type {Response} */
    let response;

    try {
      response = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          system:      String(systemPrompt).slice(0, 2000),
          userMessage: String(userMessage).slice(0, CONFIG.MAX_PROMPT_LENGTH),
          maxTokens:   1000,
        }),
      });
    } catch (_networkErr) {
      throw new Error('Could not reach the backend. Please try again shortly.');
    }

    /** @type {Object} */
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Backend error ${response.status}`);
    }

    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Backend returned an empty response.');
    }

    return data.text;
  }

  /**
   * Builds the system prompt used for per-entry AI insights.
   * Includes the user's current ledger state and their top emission category
   * so the AI response is contextually relevant.
   *
   * @param {import('./store').Totals}         totals    - Current aggregate totals
   * @param {import('./store').CategoryTotals} catTotals - Per-category emission totals
   * @returns {string} Fully constructed system prompt
   */
  function buildInsightSystem(totals, catTotals) {
    const topEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCat   = topEntry
      ? `${topEntry[0]} at ${topEntry[1].toFixed(1)} kg CO2`
      : 'none recorded yet';

    return (
      `You are a carbon accountant giving concise, direct insights for an Indian user. ` +
      `Current ledger: emitted ${totals.debit.toFixed(1)} kg, ` +
      `offset ${totals.credit.toFixed(1)} kg, ` +
      `net ${totals.net.toFixed(1)} kg CO2. ` +
      `Biggest emission source: ${topCat}. ` +
      `India monthly average is ~133 kg CO2 per person. ` +
      `Write exactly 2-3 sentences: ` +
      `(1) Comment on the logged entry with a concrete real-world comparison. ` +
      `(2) One specific, actionable reduction tip for that category. ` +
      `Be direct. No bullet points. No markdown. Under 70 words total.`
    );
  }

  /**
   * Builds the system prompt used for the Actions tab AI planner.
   * Instructs the model to give India-specific, cost-aware carbon advice.
   *
   * @returns {string} System prompt string for the planner context
   */
  function buildPlannerSystem() {
    return (
      `You are a carbon reduction advisor for users in India. ` +
      `Give practical, specific, cost-aware advice relevant to the Indian context. ` +
      `Quantify savings in kg CO2 per year where possible. ` +
      `Keep the response under 120 words. Plain prose only, no markdown or bullet points.`
    );
  }

  /** @public */
  return Object.freeze({ ask, buildInsightSystem, buildPlannerSystem });
})();
