/**
 * @fileoverview Actions module for Carbon Ledger.
 * Renders high-impact reduction action cards and the AI planner.
 * Action card clicks are handled via event delegation — no inline
 * onclick attributes are used anywhere in generated HTML.
 *
 * @module actions
 * @version 2.0.0
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
   * Updates the AI planner answer box to a given state.
   *
   * @private
   * @param {'thinking'|'done'|'error'|null} state - Dot indicator state
   * @param {string} html - HTML content for the answer box
   * @returns {void}
   */
  function _setPlannerState(state, html) {
    const box = document.getElementById('ai-action-answer');
    if (box) {
      box.className = 'insight-text';
      box.innerHTML = html;
    }
    UI.setInsightState('planner-dot', state);
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Initialises the Actions tab by rendering all action cards from CONFIG.
   * Uses data-action-index attributes on buttons; clicks handled via
   * event delegation attached to the grid container. No inline onclick.
   *
   * @returns {void}
   */
  function init() {
    const grid = document.getElementById('actions-grid');
    if (!grid) return;

    grid.innerHTML = CONFIG.ACTIONS.map((action, i) => `
      <button
        class="action-card"
        data-action-index="${i}"
        type="button"
        aria-label="${action.description}. Estimated saving: ${action.saving}">
        <div class="action-saving">${action.saving}</div>
        <div class="action-desc">${action.description}</div>
        <div class="action-difficulty">
          Difficulty: ${action.difficulty} &bull; Ask AI &nearr;
        </div>
      </button>`
    ).join('');

    // Event delegation: one listener handles all card clicks
    grid.addEventListener('click', e => {
      const card = e.target.closest('.action-card[data-action-index]');
      if (!card) return;
      const index = Number(card.dataset.actionIndex);
      triggerAction(index);
    });
  }

  /**
   * Pre-fills the AI planner input with a preset action query and submits.
   *
   * @param {number} index - Index into CONFIG.ACTIONS
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
   * Sends the AI planner query to the backend and renders the response.
   * Reads query from #action-query. Debounced by _isThinking flag.
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
    const contextNote = `User context: net carbon balance is ${totals.net.toFixed(1)} kg CO2. `;

    try {
      const text = await AI.ask(system, contextNote + query);
      const box  = document.getElementById('ai-action-answer');
      if (box) { box.className = 'insight-text'; box.textContent = text; }
      UI.setInsightState('planner-dot', 'done');
    } catch (err) {
      const box = document.getElementById('ai-action-answer');
      if (box) {
        box.className   = 'insight-text insight-text--placeholder';
        box.textContent = err.message || 'AI unavailable. Please check your backend connection.';
      }
      UI.setInsightState('planner-dot', 'error');
    } finally {
      _isThinking = false;
    }
  }

  /** @public */
  return Object.freeze({ init, triggerAction, askAI });
})();
