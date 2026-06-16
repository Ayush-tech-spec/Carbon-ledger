/**
 * @fileoverview Analysis module for Carbon Ledger.
 * Renders the Analysis tab components: category bar chart,
 * monthly history grid, and benchmark comparison table.
 * All rendering is driven by Store data; no state is held locally.
 *
 * @module analysis
 * @version 1.0.0
 */

'use strict';

/**
 * Analysis — singleton module using the Revealing Module Pattern.
 * @namespace Analysis
 */
const Analysis = (() => {
  'use strict';

  // ── Private renderers ──────────────────────────────────────

  /**
   * Renders horizontal bar chart showing kg CO2 per emission category.
   * Each bar width is proportional to the category's share of the maximum.
   * Falls back to a placeholder message when no emission entries exist.
   *
   * @private
   * @returns {void}
   */
  function _renderCategoryBars() {
    const container = document.getElementById('category-bars');
    if (!container) return;

    const cats   = Store.getCategoryTotals();
    const maxVal = Math.max(...Object.values(cats), 1);
    const hasData = Object.values(cats).some(v => v > 0);

    if (!hasData) {
      container.innerHTML = '<p class="empty-state">Log entries to see breakdown.</p>';
      return;
    }

    const categories = /** @type {Array<keyof typeof cats>} */ (['transport', 'food', 'energy', 'shopping']);

    container.innerHTML = categories.map(cat => {
      const val = cats[cat] || 0;
      const pct = Math.round((val / maxVal) * 100);
      return `
        <div class="impact-row">
          <div class="impact-cat">${cat}</div>
          <div
            class="impact-bar-track"
            role="progressbar"
            aria-valuenow="${val.toFixed(1)}"
            aria-valuemin="0"
            aria-valuemax="${maxVal.toFixed(1)}"
            aria-label="${cat}: ${val.toFixed(1)} kg CO2">
            <div class="impact-bar-fill fill-${cat}" style="width:${pct}%"></div>
          </div>
          <div class="impact-val" aria-live="polite">${val.toFixed(1)} kg</div>
        </div>`;
    }).join('');
  }

  /**
   * Renders a 6-column grid of monthly net CO2 totals.
   * Bar heights are proportional to the maximum absolute value in the set.
   * Green bars indicate net negative (carbon-positive) months.
   *
   * @private
   * @returns {void}
   */
  function _renderMonthlyGrid() {
    const grid = document.getElementById('monthly-grid');
    if (!grid) return;

    const months = Store.getMonthlyTotals(6);
    const maxAbs = Math.max(...months.map(m => Math.abs(m.val)), 1);

    grid.innerHTML = months.map(m => {
      const pct   = Math.round((Math.abs(m.val) / maxAbs) * 100);
      const color = m.val > 0 ? '#c06040' : m.val < 0 ? '#4a8040' : '#555';
      return `
        <div class="month-cell" title="${m.name}: ${m.val.toFixed(1)} kg CO\u2082">
          <div class="month-name">${m.name}</div>
          <div class="month-val">${m.val !== 0 ? m.val.toFixed(0) : '0'}</div>
          <div class="month-bar" style="width:${pct}%; background:${color};"></div>
        </div>`;
    }).join('');
  }

  /**
   * Updates the "Your monthly net" cell in the benchmark comparison table
   * to reflect the current Store net total.
   *
   * @private
   * @returns {void}
   */
  function _renderBenchmark() {
    const el = document.getElementById('my-monthly');
    if (el) el.textContent = `${Store.getTotals().net.toFixed(0)} kg`;
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Renders all Analysis tab components from current Store state.
   * Safe to call multiple times; each call fully replaces previous output.
   * Automatically called when the user switches to the Analysis tab.
   *
   * @returns {void}
   */
  function render() {
    _renderCategoryBars();
    _renderMonthlyGrid();
    _renderBenchmark();
  }

  /** @public */
  return Object.freeze({ render });
})();
