/**
 * @fileoverview Actions module for Carbon Ledger.
 * Renders the high-impact reduction action cards and powers the
 * AI planner, which answers free-text carbon reduction questions
 * in the context of the user's current ledger state.
 *
 * @module actions
 * @version 1.0.0
 */

'use strict';

/**
 * Actions — singleton module using the Revealing Module Pattern.
 * @namespace Actions
 */
const Actions = (() => {
  'use strict';

  /** @type {boolean} Guards against concurrent AI planner requests */
  let _isThinking = false;

  // ── Private helpers ────────────────────────────────────────

  /**
   * Updates the AI planner answer box to reflect a given state.
   *
   * @private
   * @param {'thinking'|'done'|'error'|null} state - Visual state for the dot indicator
   * @param {string} html - HTML content to render inside the answer box
   * @returns {void}
   */
  function _setPlannerState(state, html) {
    const box = document.getElementById('ai-action-answer');
    if (box) {
      box.className = state === 'error' || state === 'thinking'
        ? 'insight-text'
        : 'insight-text';
      box.innerHTML = html;
    }
    UI.setInsightState('planner-dot', state);
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Initialises the Actions tab by rendering all action cards from CONFIG.
   * Each card is a button that pre-fills the AI planner query on click.
   * Must be called during application bootstrap.
   *
   * @returns {void}
   */
  function init() {
    const grid = document.getElementById('actions-grid');
    if (!grid) return;

    grid.innerHTML = CONFIG.ACTIONS.map((action, i) => `
      <button
        class="action-card"
        onclick="Actions.triggerAction(${i})"
        type="button"
        aria-label="${action.description} — estimated saving: ${action.saving}">
        <div class="action-saving">${action.saving}</div>
        <div class="action-desc">${action.description}</div>
        <div class="action-difficulty">
          Difficulty: ${action.difficulty} &bull; Ask AI &nearr;
        </div>
      </button>`
    ).join('');
  }

  /**
   * Pre-fills the AI planner input with a preset action query and triggers it.
   * Called by clicking one of the action cards.
   *
   * @param {number} index - Index into CONFIG.ACTIONS array
   * @returns {void}
   */
  function triggerAction(index) {
    const action = CONFIG.ACTIONS[index];
    if (!action) return;

    const input = document.getElementById('action-query');
    if (input) input.value = action.query;

    askAI();
  }

  /**
   * Sends the current AI planner query to the backend and displays the response.
   * Reads the query from the #action-query input element.
   * Debounced by the _isThinking flag to prevent concurrent requests.
   *
   * @async
   * @returns {Promise<void>}
   */
  async function askAI() {
    if (_isThinking) return;

    const input = document.getElementById('action-query');
    const query = input ? input.value.trim() : '';

    if (!query) {
      if (input) input.focus();
      return;
    }

    _isThinking = true;

    const providerKey  = document.getElementById('model-select')?.value || 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    const labelEl = document.getElementById('ai-actions-label');
    if (labelEl) labelEl.textContent = `AI Planner (${providerName})`;

    _setPlannerState('thinking', `
      <span class="ai-thinking">
        Thinking
        <span class="dot-pulse" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </span>`);

    const system      = AI.buildPlannerSystem();
    const totals      = Store.getTotals();
    const contextNote = `User context: current net carbon balance is ${totals.net.toFixed(1)} kg CO2. `;

    try {
      const text = await AI.ask(system, contextNote + query);
      _setPlannerState('done', '');
      const box = document.getElementById('ai-action-answer');
      if (box) { box.className = 'insight-text'; box.textContent = text; }
    } catch (err) {
      _setPlannerState('error', '');
      const box = document.getElementById('ai-action-answer');
      if (box) {
        box.className   = 'insight-text insight-text--placeholder';
        box.textContent = err.message || 'AI unavailable. Please check your backend connection.';
      }
    } finally {
      _isThinking = false;
    }
  }

  /** @public */
  return Object.freeze({ init, triggerAction, askAI });
})();
