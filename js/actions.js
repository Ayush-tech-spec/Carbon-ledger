/**
 * actions.js
 * Renders suggested reduction actions and handles the AI planner.
 */

const Actions = (() => {

  let _isThinking = false;

  /** Render the action cards from CONFIG */
  function init() {
    const grid = document.getElementById('actions-grid');
    if (!grid) return;

    grid.innerHTML = CONFIG.ACTIONS.map((action, i) => `
      <button class="action-card" onclick="Actions.triggerAction(${i})" type="button" aria-label="${action.description}">
        <div class="action-saving">${action.saving}</div>
        <div class="action-desc">${action.description}</div>
        <div class="action-difficulty">Difficulty: ${action.difficulty} &bull; Ask AI &nearr;</div>
      </button>
    `).join('');
  }

  /**
   * Trigger AI planner for a preset action card.
   * @param {number} index - index into CONFIG.ACTIONS
   */
  function triggerAction(index) {
    const action = CONFIG.ACTIONS[index];
    if (!action) return;
    document.getElementById('action-query').value = action.query;
    askAI();
  }

  /** Ask the AI planner with the current query input */
  async function askAI() {
    if (_isThinking) return;

    const query = document.getElementById('action-query').value.trim();
    if (!query) {
      document.getElementById('action-query').focus();
      return;
    }

    _isThinking = true;

    const answerEl = document.getElementById('ai-action-answer');
    const labelEl  = document.getElementById('ai-actions-label');

    const providerKey  = document.getElementById('model-select')?.value || 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    answerEl.className = 'ai-insight-text';
    answerEl.innerHTML = `<span class="ai-thinking">Thinking <span class="dot-pulse"><span></span><span></span><span></span></span></span>`;
    labelEl.textContent = `AI planner (${providerName})`;

    const system = AI.buildPlannerSystem();
    const totals = Store.getTotals();
    const contextNote = `User context: net carbon balance is ${totals.net.toFixed(1)} kg CO2. `;

    try {
      const text = await AI.ask(system, contextNote + query);
      answerEl.className = 'ai-insight-text';
      answerEl.textContent = text;
    } catch (err) {
      answerEl.className = 'ai-insight-text ai-insight-text--placeholder';
      answerEl.textContent = err.message || 'AI unavailable. Check your API key in Settings.';
    }

    _isThinking = false;
  }

  return { init, triggerAction, askAI };
})();
