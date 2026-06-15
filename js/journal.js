/**
 * journal.js
 * Handles posting, rendering, and removing ledger entries.
 */

const Journal = (() => {

  let _isAIThinking = false;

  /** Calculate kg CO2 for a given category and quantity */
  function _calcKg(category, qty) {
    const factor = CONFIG.EMISSION_FACTORS[category] ?? 0;
    return parseFloat((factor * qty).toFixed(3));
  }

  /**
   * Called on form submit. Validates input, adds entry, updates UI.
   * @param {Event} e
   */
  function postEntry(e) {
    e.preventDefault();

    const category = document.getElementById('entry-category').value;
    const amount   = parseFloat(document.getElementById('entry-amount').value);
    const desc     = document.getElementById('entry-desc').value.trim();
    const date     = document.getElementById('entry-date').value;
    const errEl    = document.getElementById('form-error');

    // Validation
    errEl.hidden = true;
    if (!category) {
      _showError(errEl, 'Please select a category.');
      return;
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
      _showError(errEl, 'Enter a valid positive amount.');
      return;
    }
    if (!date) {
      _showError(errEl, 'Please select a date.');
      return;
    }

    const kg = _calcKg(category, amount);
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

    // Reset form
    document.getElementById('entry-form').reset();
    document.getElementById('entry-date').value = _today();
    document.getElementById('unit-hint').textContent = 'select a category first';
  }

  function _showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  /** Render all ledger entries into the table */
  function _renderTable() {
    const tbody = document.getElementById('ledger-tbody');
    const entries = Store.getAll();

    if (!entries.length) {
      tbody.innerHTML = `<tr id="empty-row"><td colspan="5" class="empty-row">No entries yet. Post your first transaction above.</td></tr>`;
      return;
    }

    tbody.innerHTML = entries.map(e => {
      const cat     = CONFIG.CATEGORY_MAP[e.category] || 'other';
      const tagCls  = CONFIG.TAG_CLASS[cat] || 'tag-transport';
      const isDebit = e.kg > 0;

      return `<tr>
        <td class="entry-date">${e.date}</td>
        <td class="entry-desc">
          ${_escHtml(e.desc)}
          <span class="entry-tag ${tagCls}">${cat}</span>
        </td>
        <td class="debit-amount">${isDebit ? Math.abs(e.kg).toFixed(2) : ''}</td>
        <td class="credit-amount">${!isDebit ? Math.abs(e.kg).toFixed(2) : ''}</td>
        <td style="text-align:center;">
          <button class="btn-remove" onclick="Journal.removeEntry(${e.id})" aria-label="Remove entry" title="Remove">&#x2715;</button>
        </td>
      </tr>`;
    }).join('');
  }

  /**
   * Remove an entry by ID and refresh UI.
   * @param {number} id
   */
  function removeEntry(id) {
    Store.remove(id);
    UI.updateTotals();
    _renderTable();
    Analysis.render();
  }

  /** Trigger AI insight for latest entry */
  async function _triggerAIInsight(entry) {
    if (_isAIThinking) return;
    _isAIThinking = true;

    const box = document.getElementById('ai-insight');
    box.className = 'ai-insight-text';
    box.innerHTML = `<span class="ai-thinking">Analysing <span class="dot-pulse"><span></span><span></span><span></span></span></span>`;

    const providerName = CONFIG.AI_PROVIDERS[document.getElementById('model-select')?.value || 'claude']?.name || 'AI';
    document.getElementById('ai-provider-label').textContent = `AI insight (${providerName})`;

    const totals    = Store.getTotals();
    const catTotals = Store.getCategoryTotals();
    const system    = AI.buildInsightSystem(totals, catTotals);
    const prompt    = `The user just logged: "${entry.desc}" (${entry.kg > 0 ? '+' : ''}${entry.kg.toFixed(2)} kg CO2). Give your insight now.`;

    try {
      const text = await AI.ask(system, prompt);
      box.textContent = text;
    } catch (err) {
      const net = Store.getTotals().net;
      box.className = 'ai-insight-text ai-insight-text--placeholder';
      box.textContent = `Entry posted. ${err.message || 'AI insight unavailable.'} Net position: ${net.toFixed(1)} kg CO\u2082.`;
    }

    _isAIThinking = false;
  }

  /** Update unit hint when category changes */
  function onCategoryChange() {
    const sel  = document.getElementById('entry-category');
    const hint = document.getElementById('unit-hint');
    const cat  = sel.value;
    hint.textContent = cat ? `unit: ${CONFIG.UNITS[cat]}` : 'select a category first';
  }

  function _today() {
    return new Date().toISOString().split('T')[0];
  }

  function _escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /** Public init: attach listeners, render initial state */
  function init() {
    document.getElementById('entry-date').value = _today();
    document.getElementById('entry-category').addEventListener('change', onCategoryChange);
    _renderTable();
  }

  return { init, postEntry, removeEntry };
})();
