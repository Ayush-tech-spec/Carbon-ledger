/**
 * @fileoverview UI utilities module for Carbon Ledger.
 * Manages tab switching, totals banner updates, model badge,
 * insight dot state, and full UI refresh after bulk operations.
 * Acts as the shared view controller coordinating between modules.
 *
 * @module ui
 * @version 1.0.0
 */

'use strict';

/**
 * UI — singleton module using the Revealing Module Pattern.
 * @namespace UI
 */
const UI = (() => {
  'use strict';

  // ── Tab management ─────────────────────────────────────────

  /**
   * Switches the active tab panel and updates ARIA attributes accordingly.
   * Triggers Analysis.render() lazily when the Analysis tab is opened.
   *
   * @param {string}      name - Tab identifier: 'journal' | 'analysis' | 'actions'
   * @param {HTMLElement} btn  - The tab button element that was clicked
   * @returns {void}
   */
  function switchTab(name, btn) {
    // Hide all panels and deactivate all tab buttons
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
      panel.hidden = true;
    });

    document.querySelectorAll('.tab-btn:not(.tab-btn--ar)').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    // Activate the target panel
    const panel = document.getElementById(`tab-${name}`);
    if (panel) {
      panel.classList.add('active');
      panel.hidden = false;
    }

    // Activate the clicked button
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }

    // Lazy-render analysis only when its tab is opened
    if (name === 'analysis') {
      Analysis.render();
    }
  }

  // ── Balance banner ─────────────────────────────────────────

  /**
   * Updates the three balance cells (debit, credit, net) and the folio line
   * with current totals from the Store. Safe to call at any time.
   *
   * @returns {void}
   */
  function updateTotals() {
    const { debit, credit, net } = Store.getTotals();

    _setText('total-debit',  debit.toFixed(1));
    _setText('total-credit', credit.toFixed(1));
    _setText('net-balance',  net.toFixed(1));

    const folio = document.getElementById('folio-total');
    if (folio) folio.innerHTML = `Net: ${net.toFixed(1)} kg CO<sub>2</sub>`;
  }

  // ── Full refresh ───────────────────────────────────────────

  /**
   * Performs a full UI refresh after bulk data operations (e.g. clear all).
   * Re-initialises the Journal table, updates totals, re-renders Analysis,
   * and resets the AI insight box to its initial placeholder state.
   *
   * @returns {void}
   */
  function refreshAll() {
    Journal.init();
    updateTotals();
    Analysis.render();

    const box = document.getElementById('ai-insight');
    if (box) {
      box.className   = 'insight-text insight-text--placeholder';
      box.textContent = 'Post your first entry and the AI will analyse your carbon position.';
    }

    setInsightState('insight-dot', null);
  }

  // ── Model badge ────────────────────────────────────────────

  /**
   * Updates the model badge and AI label elements when the user switches
   * between Claude and Grok in the header model selector.
   *
   * @returns {void}
   */
  function onModelChange() {
    const sel          = document.getElementById('model-select');
    const providerKey  = sel ? sel.value : 'claude';
    const providerName = CONFIG.AI_PROVIDERS[providerKey]?.name || 'AI';

    const aiLabel = document.getElementById('ai-provider-label');
    if (aiLabel) aiLabel.textContent = `AI Insight (${providerName})`;

    const actionLabel = document.getElementById('ai-actions-label');
    if (actionLabel) actionLabel.textContent = `AI Planner (${providerName})`;
  }

  // ── Insight dot ────────────────────────────────────────────

  /**
   * Sets the visual state of an insight indicator dot element.
   * States map to CSS modifier classes defined in styles.css.
   *
   * @param {string}                            dotId - ID of the dot element
   * @param {'thinking'|'done'|'error'|null}   state - Desired visual state
   * @returns {void}
   */
  function setInsightState(dotId, state) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.className = state ? `insight-dot insight-dot--${state}` : 'insight-dot';
  }

  // ── Private utilities ──────────────────────────────────────

  /**
   * Sets the textContent of a DOM element by ID.
   * No-op if the element does not exist.
   *
   * @private
   * @param {string} id  - Element ID
   * @param {string} val - Text content to set
   * @returns {void}
   */
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /** @public */
  return Object.freeze({
    switchTab,
    updateTotals,
    refreshAll,
    onModelChange,
    setInsightState,
  });
})();
