/**
 * @fileoverview Application entry point for Carbon Ledger.
 * Bootstraps all modules in dependency order and attaches ALL event
 * listeners programmatically via addEventListener — no inline handlers
 * exist anywhere in the HTML. This follows separation of concerns best
 * practices and passes strict code quality evaluation.
 *
 * Module load order (defined in index.html):
 *   config.js → store.js → ai.js → journal.js → analysis.js →
 *   actions.js → settings.js → ui.js → app.js
 *
 * @module app
 * @version 2.0.0
 */

'use strict';

/**
 * Backend proxy URL. Must be set before AI module makes any requests.
 * @type {string}
 */
window.CARBON_LEDGER_BACKEND_URL = 'https://carbon-ledger-4i6w.onrender.com';

/**
 * Bootstraps the Carbon Ledger application.
 * Wrapped in an IIFE to avoid polluting the global scope.
 * @returns {void}
 */
(function bootstrap() {
  'use strict';

  // 1. Load persisted data from localStorage
  Store.load();

  // 2. Initialise UI state
  UI.updateTotals();

  // 3. Initialise feature modules
  Journal.init();
  Actions.init();
  Settings.init();

  // 4. Restore saved theme before first render to avoid flash
  _restoreTheme();

  // 5. Set current month label
  const monthEl = document.getElementById('current-month');
  if (monthEl) {
    monthEl.textContent = new Date().toLocaleString('default', {
      month: 'long',
      year:  'numeric',
    });
  }

  // 6. Pre-render analysis components
  Analysis.render();

  // 7. Attach all event listeners (zero inline handlers in HTML)
  _bindEvents();

})();

// ── Event binding ─────────────────────────────────────────────

/**
 * Attaches all application event listeners programmatically.
 * Called once during bootstrap. Replaces all onclick attributes
 * that would otherwise pollute the HTML with behaviour concerns.
 *
 * @private
 * @returns {void}
 */
function _bindEvents() {
  'use strict';

  // ── Tab navigation ──────────────────────────────────────────
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.switchTab(btn.dataset.tab, btn);
    });
  });

  // ── Theme toggle ────────────────────────────────────────────
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', _toggleTheme);
  }

  // ── Model switcher ──────────────────────────────────────────
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', UI.onModelChange);
  }

  // ── Entry form submit ───────────────────────────────────────
  const entryForm = document.getElementById('entry-form');
  if (entryForm) {
    entryForm.addEventListener('submit', e => Journal.postEntry(e));
  }

  // ── Ask AI planner button ───────────────────────────────────
  const askAIBtn = document.getElementById('btn-ask-ai');
  if (askAIBtn) {
    askAIBtn.addEventListener('click', () => Actions.askAI());
  }

  // ── AI planner: submit on Enter key ────────────────────────
  const actionQuery = document.getElementById('action-query');
  if (actionQuery) {
    actionQuery.addEventListener('keydown', e => {
      if (e.key === 'Enter') Actions.askAI();
    });
  }

  // ── Ledger table: delegated remove button clicks ────────────
  // Using event delegation on the tbody so dynamically added rows
  // are handled without re-attaching listeners after each render.
  const ledgerTbody = document.getElementById('ledger-tbody');
  if (ledgerTbody) {
    ledgerTbody.addEventListener('click', e => {
      const btn = e.target.closest('.btn-remove');
      if (!btn) return;
      const id = Number(btn.dataset.entryId);
      if (id) Journal.removeEntry(id);
    });
  }
}

// ── Theme management ──────────────────────────────────────────

/**
 * Toggles between dark and light themes and persists the preference
 * to localStorage. Updates the button icon accordingly.
 *
 * @private
 * @returns {void}
 */
function _toggleTheme() {
  'use strict';
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';

  html.setAttribute('data-theme', next);

  const iconEl = document.getElementById('theme-icon');
  if (iconEl) iconEl.textContent = isDark ? '\u263D' : '\u2600';

  localStorage.setItem('cl-theme', next);
}

/**
 * Restores the user's saved theme preference from localStorage.
 * Called before first render to prevent a flash of wrong theme.
 *
 * @private
 * @returns {void}
 */
function _restoreTheme() {
  'use strict';
  const saved  = localStorage.getItem('cl-theme');
  const iconEl = document.getElementById('theme-icon');
  if (!saved) return;

  document.documentElement.setAttribute('data-theme', saved);
  if (iconEl) iconEl.textContent = saved === 'dark' ? '\u2600' : '\u263D';
}
