/**
 * @fileoverview Application entry point for Carbon Ledger.
 * Bootstraps all modules in dependency order, sets the backend URL,
 * and attaches global event listeners. This script is loaded last.
 *
 * Module load order (defined in index.html):
 *   config.js → store.js → ai.js → journal.js → analysis.js →
 *   actions.js → settings.js → ui.js → app.js
 *
 * @module app
 * @version 1.0.0
 */

'use strict';

/**
 * Backend proxy URL. Must be set before AI module makes any requests.
 * Points to the Render deployment; falls back handled inside ai.js.
 * @type {string}
 */
window.CARBON_LEDGER_BACKEND_URL = 'https://carbon-ledger-4i6w.onrender.com';

/**
 * Bootstraps the Carbon Ledger application.
 * Wrapped in an IIFE to avoid polluting the global scope.
 *
 * @returns {void}
 */
(function bootstrap() {
  'use strict';

  // 1. Load persisted data from localStorage
  Store.load();

  // 2. Initialise UI to reflect loaded data
  UI.updateTotals();

  // 3. Initialise feature modules
  Journal.init();
  Actions.init();
  Settings.init();

  // 4. Attach model switcher change listener
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', UI.onModelChange);
  }

  // 5. Set the current month label in the header
  const monthEl = document.getElementById('current-month');
  if (monthEl) {
    monthEl.textContent = new Date().toLocaleString('default', {
      month: 'long',
      year:  'numeric',
    });
  }

  // 6. Pre-render analysis components (populates monthly grid on first load)
  Analysis.render();

  // 7. Restore saved theme preference
  _restoreTheme();

})();

/**
 * Restores the user's saved dark/light theme preference from localStorage.
 * Applies the data-theme attribute and updates the toggle button icon.
 *
 * @private
 * @returns {void}
 */
function _restoreTheme() {
  const saved    = localStorage.getItem('cl-theme');
  const iconEl   = document.getElementById('theme-icon');
  if (!saved) return;

  document.documentElement.setAttribute('data-theme', saved);
  if (iconEl) iconEl.textContent = saved === 'dark' ? '\u2600' : '\u263D';
}

/**
 * Toggles between dark and light themes and persists the preference.
 * Called by the theme toggle button in the header (onclick attribute).
 *
 * @returns {void}
 */
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';

  html.setAttribute('data-theme', next);

  const iconEl = document.getElementById('theme-icon');
  if (iconEl) iconEl.textContent = isDark ? '\u263D' : '\u2600';

  localStorage.setItem('cl-theme', next);
}
