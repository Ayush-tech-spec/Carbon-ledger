/**
 * ui.js - shared UI helpers, tab switching, totals, model badge
 */
const UI = (() => {

  function switchTab(name, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); p.hidden = true; });
    document.querySelectorAll('.tab-btn:not(.tab-btn--ar)').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    const panel = document.getElementById(`tab-${name}`);
    if (panel) { panel.classList.add('active'); panel.hidden = false; }
    if (btn)   { btn.classList.add('active'); btn.setAttribute('aria-selected','true'); }
    if (name === 'analysis') Analysis.render();
  }

  function updateTotals() {
    const { debit, credit, net } = Store.getTotals();
    _setText('total-debit',  debit.toFixed(1));
    _setText('total-credit', credit.toFixed(1));
    _setText('net-balance',  net.toFixed(1));
    const folio = document.getElementById('folio-total');
    if (folio) folio.innerHTML = `Net: ${net.toFixed(1)} kg CO<sub>2</sub>`;
    const myMonthly = document.getElementById('my-monthly');
    if (myMonthly) myMonthly.textContent = `${net.toFixed(0)} kg`;
  }

  function refreshAll() {
    Journal.init();
    updateTotals();
    Analysis.render();
    const box = document.getElementById('ai-insight');
    if (box) { box.className = 'insight-text insight-text--placeholder'; box.textContent = 'Post your first entry and the AI will analyse your carbon position.'; }
    const dot = document.getElementById('insight-dot');
    if (dot) dot.className = 'insight-dot';
  }

  function onModelChange() {
    const sel      = document.getElementById('model-select');
    const provider = sel ? sel.value : 'claude';
    const name     = CONFIG.AI_PROVIDERS[provider]?.name || 'AI';
    const aiLabel  = document.getElementById('ai-provider-label');
    if (aiLabel) aiLabel.textContent = `AI Insight (${name})`;
    const actionLabel = document.getElementById('ai-actions-label');
    if (actionLabel) actionLabel.textContent = `AI Planner (${name})`;
  }

  function setInsightState(dotId, state) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.className = 'insight-dot' + (state ? ` insight-dot--${state}` : '');
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { switchTab, updateTotals, refreshAll, onModelChange, setInsightState };
})();
