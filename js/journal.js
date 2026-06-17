/**
 * @fileoverview Journal module for Carbon Ledger.
 * Handles form submission, ledger table rendering, entry deletion,
 * and AI insight triggering. All user-supplied strings are HTML-escaped
 * before insertion into the DOM to prevent XSS. Remove buttons use
 * data attributes instead of inline onclick handlers; clicks are
 * handled via event delegation in app.js.
 *
 * @module journal
 * @version 2.0.0
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
   * Escapes HTML special characters to prevent XSS injection.
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
   * Returns today's date formatted as YYYY-MM-DD.
   * @private
   * @returns {string}
   */
  function _today() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Shows a validation error message in the form error element.
   * @private
   * @param {HTMLElement} el  - Error display element
   * @param {string}      msg - Error message to show
   * @returns {void}
   */
  function _showError(el, msg) {
    el.textContent = msg;
    el.hidden      = false;
  }

  // ── Table rendering ────────────────────────────────────────

  /**
   * Re-renders the full ledger table from current Store state.
   * Remove buttons use data-entry-id attributes; clicks handled
   * via event delegation in app.js (no inline onclick).
   *
   * @private
   * @returns {void}
   */
  function _renderTable() {
    const tbody   = document.getElementById('ledger-tbody');
    const entries = Store.getAll();

    tbody.replaceChildren();

    if (!entries.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty-row';
      td.textContent = 'No entries yet. Log your first transaction above.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    entries.forEach(e => {
      const cat     = CONFIG.CATEGORY_MAP[e.category] || 'other';
      const tagCls  = CONFIG.TAG_CLASS[cat]            || 'tag-transport';
      const isDebit = e.kg > 0;

      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.className = 'entry-date';
      tdDate.textContent = e.date;

      const tdDesc = document.createElement('td');
      tdDesc.className = 'entry-desc';
      tdDesc.textContent = e.desc + ' ';
      const spanTag = document.createElement('span');
      spanTag.className = `entry-tag ${tagCls}`;
      spanTag.setAttribute('aria-label', `${cat} category`);
      spanTag.textContent = cat;
      tdDesc.appendChild(spanTag);

      const tdDebit = document.createElement('td');
      tdDebit.className = 'debit-amount';
      tdDebit.textContent = isDebit ? Math.abs(e.kg).toFixed(2) : '';

      const tdCredit = document.createElement('td');
      tdCredit.className = 'credit-amount';
      tdCredit.textContent = !isDebit ? Math.abs(e.kg).toFixed(2) : '';

      const tdAct = document.createElement('td');
      tdAct.style.textAlign = 'center';
      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.dataset.entryId = e.id;
      btn.setAttribute('aria-label', `Remove entry: ${e.desc}`);
      btn.title = 'Remove this entry';
      btn.type = 'button';
      btn.textContent = '✕';
      tdAct.appendChild(btn);

      tr.appendChild(tdDate);
      tr.appendChild(tdDesc);
      tr.appendChild(tdDebit);
      tr.appendChild(tdCredit);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }

  // ── AI insight ─────────────────────────────────────────────

  /**
   * Triggers an AI insight for the most recently posted entry.
   * Debounced by _isAIThinking flag to prevent concurrent requests.
   *
   * @private
   * @async
   * @param {import('./store').LedgerEntry} entry - Newly posted entry
   * @returns {Promise<void>}
   */
  async function _triggerAIInsight(entry) {
    if (_isAIThinking) return;
    _isAIThinking = true;

    const box          = document.getElementById('ai-insight');
    const providerKey  = UI.getCurrentModel();
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';
    UI.updateAILabels(providerName);

    box.className = 'insight-text';
    box.replaceChildren();
    box.appendChild(UI.createThinkingLoader('Analysing'));
    UI.setInsightState('insight-dot', 'thinking');

    const totals    = Store.getTotals();
    const catTotals = Store.getCategoryTotals();
    const system    = AI.buildInsightSystem(totals, catTotals);
    const sign      = entry.kg > 0 ? '+' : '';
    const prompt    = `The user just logged: "${entry.desc}" (${sign}${entry.kg.toFixed(2)} kg CO2). Provide your insight.`;

    try {
      const text = await AI.ask(system, prompt);
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
   * Handles the entry form submit event.
   * Validates all fields, constructs a LedgerEntry, persists it,
   * updates all UI components, and triggers an AI insight.
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

    errEl.hidden = true;

    if (!category || !Object.prototype.hasOwnProperty.call(CONFIG.EMISSION_FACTORS, category)) {
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

    document.getElementById('entry-form').reset();
    document.getElementById('entry-date').value     = _today();
    document.getElementById('unit-hint').textContent = 'select a category first';
  }

  /**
   * Removes a single entry from the Store by ID and refreshes all UI.
   * Called via event delegation in app.js when a remove button is clicked.
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
   * Updates the unit hint when the category selector changes.
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
   * Sets default date, attaches category change listener, renders table.
   * Must be called after Store.load().
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
