/**
 * @fileoverview Settings module for Carbon Ledger.
 * Manages user data operations (clear all entries).
 * API keys are stored server-side as environment variables;
 * this module contains no credential handling.
 *
 * @module settings
 * @version 1.0.0
 */

'use strict';

/**
 * Settings — singleton module using the Revealing Module Pattern.
 * @namespace Settings
 */
const Settings = (() => {
  'use strict';

  /**
   * Initialises the Settings module.
   * Currently a no-op since API keys are managed server-side.
   * Retained for future extensibility.
   *
   * @returns {void}
   */
  function init() {
    // API keys are environment variables on the backend.
    // No client-side key management is required or performed.
  }

  /**
   * Prompts the user for confirmation, then wipes all ledger entries
   * from both memory and localStorage. Refreshes the full UI afterward.
   * Displays a temporary status message on completion.
   *
   * @returns {void}
   */
  function clearData() {
    if (!window.confirm('This will permanently delete all your ledger entries. Are you sure?')) {
      return;
    }

    Store.clear();
    UI.updateTotals();
    UI.refreshAll();

    const msgEl = document.getElementById('settings-msg');
    if (msgEl) {
      msgEl.textContent   = 'All data cleared successfully.';
      msgEl.style.color   = 'var(--debit)';
      msgEl.hidden        = false;
      window.setTimeout(() => { msgEl.hidden = true; }, 3000);
    }
  }

  /** @public */
  return Object.freeze({ init, clearData });
})();
