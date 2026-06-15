/**
 * app.js
 * Bootstrap. Set CARBON_LEDGER_BACKEND_URL before anything else loads.
 */

// Set your Render backend URL here after deploying.
// During local dev this hits localhost:3001 automatically.
window.CARBON_LEDGER_BACKEND_URL = 'https://carbon-ledger-api.onrender.com';

(function bootstrap() {

  Store.load();
  UI.updateTotals();
  Journal.init();
  Actions.init();
  Settings.init();

  const modelSelect = document.getElementById('model-select');
  if (modelSelect) modelSelect.addEventListener('change', UI.onModelChange);

  const monthEl = document.getElementById('current-month');
  if (monthEl) monthEl.textContent = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  Analysis.render();
  _checkBackendStatus();

  console.info('Carbon Ledger initialised.');
})();

async function _checkBackendStatus() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  try {
    const res  = await fetch(`${window.CARBON_LEDGER_BACKEND_URL}/health`);
    const data = await res.json();

    if (data.status === 'ok') {
      dot.className  = 'status-dot status-dot--green';
      const keys = [
        data.providers.claude ? 'Claude' : null,
        data.providers.grok   ? 'Grok'   : null,
      ].filter(Boolean).join(' + ');
      text.textContent = `Backend connected. ${keys || 'No AI keys set'}.`;
    } else {
      throw new Error('bad status');
    }
  } catch {
    dot.className  = 'status-dot status-dot--red';
    text.textContent = 'Backend not reachable. AI insights will be unavailable.';
  }
}
