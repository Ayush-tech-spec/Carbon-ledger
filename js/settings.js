/**
 * settings.js
 * Data management only. API keys are handled server-side.
 */

const Settings = (() => {

  function init() {
    // Nothing to load: keys live on the backend now
  }

  /** Clear all ledger entries after confirmation */
  function clearData() {
    if (!confirm('This will delete all your ledger entries. Are you sure?')) return;
    Store.clear();
    UI.updateTotals();
    UI.refreshAll();

    const msgEl = document.getElementById('settings-msg');
    if (msgEl) {
      msgEl.textContent   = 'All data cleared.';
      msgEl.style.color   = 'var(--debit)';
      msgEl.hidden        = false;
      setTimeout(() => { msgEl.hidden = true; }, 3000);
    }
  }

  return { init, clearData };
})();
