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
  function _setPlannerState(state) {
    const box = document.getElementById('ai-action-answer');
    if (box) {
      box.className = 'insight-text';
      box.replaceChildren();
      
      if (state === 'thinking') {
        box.appendChild(UI.createThinkingLoader('Thinking'));
      }
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

    grid.replaceChildren();

    CONFIG.ACTIONS.forEach((action, i) => {
      const btn = document.createElement('button');
      btn.className = 'action-card';
      btn.dataset.actionIndex = i;
      btn.type = 'button';
      btn.setAttribute('aria-label', `${action.description}. Estimated saving: ${action.saving}`);

      const saving = document.createElement('div');
      saving.className = 'action-saving';
      saving.textContent = action.saving;

      const desc = document.createElement('div');
      desc.className = 'action-desc';
      desc.textContent = action.description;

      const diff = document.createElement('div');
      diff.className = 'action-difficulty';
      diff.textContent = `Difficulty: ${action.difficulty} \u2022 Ask AI \u2197`;

      btn.appendChild(saving);
      btn.appendChild(desc);
      btn.appendChild(diff);
      grid.appendChild(btn);
    });

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

    const providerKey  = UI.getCurrentModel();
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';
    UI.updateAILabels(providerName);

    _setPlannerState('thinking');

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
