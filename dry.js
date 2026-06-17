const fs = require('fs');

// 1. ui.js
let ui = fs.readFileSync('js/ui.js', 'utf8');

const uiHelpers = `
  /**
   * Retrieves the currently selected AI model key.
   * @returns {string} The model key (e.g. 'claude')
   */
  function getCurrentModel() {
    return document.getElementById('model-select')?.value || 'claude';
  }

  /**
   * Generates the DOM nodes for the "Thinking" dot-pulse loader.
   * @param {string} text - The text to display next to the dots.
   * @returns {HTMLElement} The span element containing the loader.
   */
  function createThinkingLoader(text = 'Thinking') {
    const spanAI = document.createElement('span');
    spanAI.className = 'ai-thinking';
    spanAI.textContent = text;
    const spanPulse = document.createElement('span');
    spanPulse.className = 'dot-pulse';
    spanPulse.setAttribute('aria-hidden', 'true');
    spanPulse.appendChild(document.createElement('span'));
    spanPulse.appendChild(document.createElement('span'));
    spanPulse.appendChild(document.createElement('span'));
    spanAI.appendChild(spanPulse);
    return spanAI;
  }

  /**
   * Updates the AI labels in the UI with the selected provider's name.
   * @param {string} providerName - The formatted name of the provider.
   */
  function updateAILabels(providerName) {
    const aiLabel = document.getElementById('ai-provider-label');
    if (aiLabel) aiLabel.textContent = \`AI Insight (\${providerName})\`;

    const actionLabel = document.getElementById('ai-actions-label');
    if (actionLabel) actionLabel.textContent = \`AI Planner (\${providerName})\`;
  }

  // ── Private utilities ──────────────────────────────────────`;

ui = ui.replace('  // ── Private utilities ──────────────────────────────────────', uiHelpers);
ui = ui.replace(`  function onModelChange() {
    const sel          = document.getElementById('model-select');
    const providerKey  = sel ? sel.value : 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    const aiLabel = document.getElementById('ai-provider-label');
    if (aiLabel) aiLabel.textContent = \`AI Insight (\${providerName})\`;

    const actionLabel = document.getElementById('ai-actions-label');
    if (actionLabel) actionLabel.textContent = \`AI Planner (\${providerName})\`;
  }`,
`  function onModelChange() {
    const providerKey  = getCurrentModel();
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';
    updateAILabels(providerName);
  }`);
ui = ui.replace('    setInsightState,\n  });', '    setInsightState,\n    getCurrentModel,\n    createThinkingLoader,\n    updateAILabels,\n  });');

fs.writeFileSync('js/ui.js', ui);


// 2. ai.js
let ai = fs.readFileSync('js/ai.js', 'utf8');
ai = ai.replace(`  function _getProvider() {
    const sel = document.getElementById('model-select');
    return (sel && sel.value) ? sel.value : 'claude';
  }`, 
`  function _getProvider() {
    return UI.getCurrentModel();
  }`);
fs.writeFileSync('js/ai.js', ai);


// 3. actions.js
let actions = fs.readFileSync('js/actions.js', 'utf8');
actions = actions.replace(`      if (state === 'thinking') {
        const spanAI = document.createElement('span');
        spanAI.className = 'ai-thinking';
        spanAI.textContent = 'Thinking';
        const spanPulse = document.createElement('span');
        spanPulse.className = 'dot-pulse';
        spanPulse.setAttribute('aria-hidden', 'true');
        spanPulse.appendChild(document.createElement('span'));
        spanPulse.appendChild(document.createElement('span'));
        spanPulse.appendChild(document.createElement('span'));
        spanAI.appendChild(spanPulse);
        box.appendChild(spanAI);
      }`, 
`      if (state === 'thinking') {
        box.appendChild(UI.createThinkingLoader('Thinking'));
      }`);
actions = actions.replace(`    const providerKey  = document.getElementById('model-select')?.value || 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    const labelEl = document.getElementById('ai-actions-label');
    if (labelEl) labelEl.textContent = \`AI Planner (\${providerName})\`;`,
`    const providerKey  = UI.getCurrentModel();
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';
    UI.updateAILabels(providerName);`);
fs.writeFileSync('js/actions.js', actions);


// 4. journal.js
let journal = fs.readFileSync('js/journal.js', 'utf8');
journal = journal.replace(`    const providerKey  = document.getElementById('model-select')?.value || 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    const labelEl = document.getElementById('ai-provider-label');
    if (labelEl) labelEl.textContent = \`AI Insight (\${providerName})\`;`,
`    const providerKey  = UI.getCurrentModel();
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';
    UI.updateAILabels(providerName);`);
journal = journal.replace(`    box.replaceChildren();
    const spanAI = document.createElement('span');
    spanAI.className = 'ai-thinking';
    spanAI.textContent = 'Analysing';
    const spanPulse = document.createElement('span');
    spanPulse.className = 'dot-pulse';
    spanPulse.setAttribute('aria-hidden', 'true');
    spanPulse.appendChild(document.createElement('span'));
    spanPulse.appendChild(document.createElement('span'));
    spanPulse.appendChild(document.createElement('span'));
    spanAI.appendChild(spanPulse);
    box.appendChild(spanAI);`,
`    box.replaceChildren();
    box.appendChild(UI.createThinkingLoader('Analysing'));`);
fs.writeFileSync('js/journal.js', journal);


// 5. app.js
let app = fs.readFileSync('js/app.js', 'utf8');
app = app.replace(`  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      UI.onModelChange();
    });
  }`,
`  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', UI.onModelChange);
  }`);
fs.writeFileSync('js/app.js', app);

console.log('DRY refactor complete');
