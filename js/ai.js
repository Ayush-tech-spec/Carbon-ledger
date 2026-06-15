/**
 * ai.js
 * AI abstraction layer. Calls your own backend proxy, not the AI APIs directly.
 * This means API keys stay on the server and never reach the browser.
 */

const AI = (() => {
  // Change this to your Render backend URL after deploying

  const BACKEND_URL =
    window.CARBON_LEDGER_BACKEND_URL ||
    "https://carbon-ledger-4i6w.onrender.com";

  /** Get the currently selected provider key ('claude' | 'grok') */
  function _getProvider() {
    const sel = document.getElementById("model-select");
    return sel ? sel.value : "claude";
  }

  /**
   * Send a prompt to your backend proxy.
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async function ask(systemPrompt, userMessage) {
    const provider = _getProvider();
    const endpoint = `${BACKEND_URL}/api/${provider}`;

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          userMessage: userMessage,
          maxTokens: 1000,
        }),
      });
    } catch (networkErr) {
      throw new Error("Could not reach the backend. Is it running?");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || `Backend error ${response.status}`);
    }

    if (!data.text) {
      throw new Error("Backend returned an empty response.");
    }

    return data.text;
  }

  /**
   * Build the system prompt for entry insights.
   */
  function buildInsightSystem(totals, catTotals) {
    const topEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCat = topEntry
      ? `${topEntry[0]} at ${topEntry[1].toFixed(1)} kg`
      : "none yet";

    return `You are a carbon accountant giving concise, direct insights for an Indian user. \
Ledger totals: emitted ${totals.debit.toFixed(1)} kg, offset ${totals.credit.toFixed(1)} kg, net ${totals.net.toFixed(1)} kg CO2. \
Biggest emission source: ${topCat}. India's monthly average is ~133 kg CO2. \
Write exactly 2-3 sentences: (1) comment on this entry with a real-world comparison to make it tangible, \
(2) one actionable reduction tip specific to this category. Be direct, no fluff, no bullet points. Under 70 words total.`;
  }

  /**
   * Build the system prompt for the actions planner.
   */
  function buildPlannerSystem() {
    return `You are a carbon reduction advisor for users in India. \
Give practical, specific, cost-aware advice. \
Mention realistic savings in kg CO2 per year. \
Keep the response under 120 words. Plain prose, no markdown.`;
  }

  return { ask, buildInsightSystem, buildPlannerSystem };
})();
