/**
 * @fileoverview Journal module for Carbon Ledger.
 * Handles form submission, ledger table rendering, entry deletion,
 * and AI insight triggering. All user-supplied strings are HTML-escaped
 * before insertion into the DOM to prevent XSS.
 *
 * @module journal
 * @version 1.0.0
 */

'use strict';

/**
 * Journal — singleton module using the Revealing Module Pattern.
 * @namespace Journal
 */
const Journal = (() => {
  'use strict';

  /** @type {boolean} Guards against concurrent AI requests */
  let _isAIThinking = false;

  // ── Private helpers ────────────────────────────────────────

  /**
   * Calculates the CO2-equivalent in kg for a given activity and quantity.
   * Uses emission factors from CONFIG; unknown categories return 0.
   *
   * @private
   * @param {string} category - Activity key (e.g. 'car', 'flight')
   * @param {number} qty      - Quantity in the activity's native unit
   * @returns {number} CO2e in kg, rounded to 3 decimal places
   */
  function _calcKg(category, qty) {
    const factor = CONFIG.EMISSION_FACTORS[category] ?? 0;
    return parseFloat((factor * qty).toFixed(3));
  }

  /**
   * Escapes HTML special characters in a string to prevent XSS injection.
   * Applied to all user-supplied text before inserting into innerHTML.
   *
   * @private
   * @param {string} str - Raw user input string
   * @returns {string} HTML-safe escaped string
   */
  function _escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }

  /**
   * Returns today's date as an ISO string (YYYY-MM-DD).
   * @private
   * @returns {string} Today's date
   */
  function _today() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Displays a validation error message in the form error element.
   * @private
   * @param {HTMLElement} el  - The error display element
   * @param {string}      msg - Error message to display
   * @returns {void}
   */
  function _showError(el, msg) {
    el.textContent = msg;
    el.hidden      = false;
  }

  // ── Table rendering ────────────────────────────────────────

  /**
   * Re-renders the full ledger table from current Store state.
   * Shows an empty-state row when no entries exist.
   * All entry descriptions are HTML-escaped before rendering.
   *
   * @private
   * @returns {void}
   */
  function _renderTable() {
    const tbody   = document.getElementById('ledger-tbody');
    const entries = Store.getAll();

    if (!entries.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">
            No entries yet. Log your first transaction above.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = entries.map(e => {
      const cat     = CONFIG.CATEGORY_MAP[e.category] || 'other';
      const tagCls  = CONFIG.TAG_CLASS[cat]            || 'tag-transport';
      const isDebit = e.kg > 0;

      return `
        <tr>
          <td class="entry-date">${_escHtml(e.date)}</td>
          <td class="entry-desc">
            ${_escHtml(e.desc)}
            <span class="entry-tag ${tagCls}" aria-label="${cat} category">${cat}</span>
          </td>
          <td class="debit-amount">${isDebit ? Math.abs(e.kg).toFixed(2) : ''}</td>
          <td class="credit-amount">${!isDebit ? Math.abs(e.kg).toFixed(2) : ''}</td>
          <td style="text-align:center;">
            <button
              class="btn-remove"
              onclick="Journal.removeEntry(${e.id})"
              aria-label="Remove entry: ${_escHtml(e.desc)}"
              title="Remove this entry">
              &#x2715;
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  // ── AI insight ─────────────────────────────────────────────

  /**
   * Triggers an AI insight request for the most recently posted entry.
   * Displays a loading animation while awaiting the response.
   * Gracefully falls back to a static message if the AI call fails.
   * Debounced by the _isAIThinking flag to prevent concurrent requests.
   *
   * @private
   * @async
   * @param {import('./store').LedgerEntry} entry - The newly posted entry
   * @returns {Promise<void>}
   */
  async function _triggerAIInsight(entry) {
    if (_isAIThinking) return;
    _isAIThinking = true;

    const box          = document.getElementById('ai-insight');
    const providerKey  = document.getElementById('model-select')?.value || 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    // Update provider label
    const labelEl = document.getElementById('ai-provider-label');
    if (labelEl) labelEl.textContent = `AI Insight (${providerName})`;

    // Show loading state
    box.className = 'insight-text';
    box.innerHTML = `
      <span class="ai-thinking">
        Analysing
        <span class="dot-pulse" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </span>`;
    UI.setInsightState('insight-dot', 'thinking');

    // Build prompts
    const totals    = Store.getTotals();
    const catTotals = Store.getCategoryTotals();
    const system    = AI.buildInsightSystem(totals, catTotals);
    const sign      = entry.kg > 0 ? '+' : '';
    const prompt    = `The user just logged: "${entry.desc}" (${sign}${entry.kg.toFixed(2)} kg CO2). Provide your insight.`;

    try {
      const text  = await AI.ask(system, prompt);
      box.className   = 'insight-text';
      box.textContent = text;
      UI.setInsightState('insight-dot', 'done');
    } catch (err) {
      const net = Store.getTotals().net;
      box.className   = 'insight-text insight-text--placeholder';
      box.textContent = `Entry posted. ${err.message || 'AI insight unavailable.'} Net: ${net.toFixed(1)} kg CO\u2082.`;
      UI.setInsightState('insight-dot', 'error');
    } finally {
      _isAIThinking = false;
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Handles the entry form submission event.
   * Validates all fields, constructs a LedgerEntry, adds it to the Store,
   * updates the UI, and triggers an AI insight.
   *
   * @param {Event} e - The form submit event
   * @returns {void}
   */
  function postEntry(e) {
    e.preventDefault();

    const category = document.getElementById('entry-category').value;
    const amount   = parseFloat(document.getElementById('entry-amount').value);
    const desc     = document.getElementById('entry-desc').value.trim().slice(0, CONFIG.MAX_DESC_LENGTH);
    const date     = document.getElementById('entry-date').value;
    const errEl    = document.getElementById('form-error');

    // Reset previous error
    errEl.hidden = true;

    // Validate inputs
    if (!category || !CONFIG.EMISSION_FACTORS.hasOwnProperty(category)) {
      _showError(errEl, 'Please select a valid category.');
      return;
    }

    if (!amount || amount <= 0 || !isFinite(amount)) {
      _showError(errEl, 'Please enter a valid positive amount.');
      return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      _showError(errEl, 'Please select a valid date.');
      return;
    }

    const kg = _calcKg(category, amount);

    /** @type {import('./store').LedgerEntry} */
    const entry = {
      id:       Date.now(),
      date,
      category,
      desc:     desc || `${CONFIG.NAMES[category]} (${amount} ${CONFIG.UNITS[category]})`,
      kg,
      qty:      amount,
    };

    Store.add(entry);
    UI.updateTotals();
    _renderTable();
    _triggerAIInsight(entry);

    // Reset form to clean state
    document.getElementById('entry-form').reset();
    document.getElementById('entry-date').value    = _today();
    document.getElementById('unit-hint').textContent = 'select a category first';
  }

  /**
   * Removes a single entry from the Store by its ID and refreshes all UI.
   *
   * @param {number} id - The unique entry ID to remove
   * @returns {void}
   */
  function removeEntry(id) {
    Store.remove(id);
    UI.updateTotals();
    _renderTable();
    Analysis.render();
  }

  /**
   * Updates the unit hint label when the user changes the category selector.
   * Helps users understand what quantity unit to enter.
   *
   * @returns {void}
   */
  function onCategoryChange() {
    const sel  = document.getElementById('entry-category');
    const hint = document.getElementById('unit-hint');
    if (!sel || !hint) return;
    hint.textContent = sel.value
      ? `unit: ${CONFIG.UNITS[sel.value]}`
      : 'select a category first';
  }

  /**
   * Initialises the Journal module.
   * Sets default date, attaches the category change listener, and renders
   * any previously persisted entries from the Store.
   * Must be called after Store.load() during application bootstrap.
   *
   * @returns {void}
   */
  function init() {
    const dateInput = document.getElementById('entry-date');
    if (dateInput) dateInput.value = _today();

    const catSelect = document.getElementById('entry-category');
    if (catSelect) catSelect.addEventListener('change', onCategoryChange);

    _renderTable();
  }

  /** @public */
  return Object.freeze({ init, postEntry, removeEntry });
})();
