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

    container.replaceChildren();

    if (!hasData) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Log entries to see breakdown.';
      container.appendChild(p);
      return;
    }

    const categories = /** @type {Array<keyof typeof cats>} */ (['transport', 'food', 'energy', 'shopping']);

    categories.forEach(cat => {
      const val = cats[cat] || 0;
      const pct = Math.round((val / maxVal) * 100);

      const row = document.createElement('div');
      row.className = 'impact-row';

      const catEl = document.createElement('div');
      catEl.className = 'impact-cat';
      catEl.textContent = cat;

      const track = document.createElement('div');
      track.className = 'impact-bar-track';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuenow', val.toFixed(1));
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', maxVal.toFixed(1));
      track.setAttribute('aria-label', `${cat}: ${val.toFixed(1)} kg CO2`);

      const fill = document.createElement('div');
      fill.className = `impact-bar-fill fill-${cat}`;
      fill.style.width = `${pct}%`;
      track.appendChild(fill);

      const valEl = document.createElement('div');
      valEl.className = 'impact-val';
      valEl.setAttribute('aria-live', 'polite');
      valEl.textContent = `${val.toFixed(1)} kg`;

      row.appendChild(catEl);
      row.appendChild(track);
      row.appendChild(valEl);

      container.appendChild(row);
    });
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

    grid.replaceChildren();

    months.forEach(m => {
      const pct   = Math.round((Math.abs(m.val) / maxAbs) * 100);
      const color = m.val > 0 ? '#c06040' : m.val < 0 ? '#4a8040' : '#555';
      
      const cell = document.createElement('div');
      cell.className = 'month-cell';
      cell.title = `${m.name}: ${m.val.toFixed(1)} kg CO\u2082`;

      const nameEl = document.createElement('div');
      nameEl.className = 'month-name';
      nameEl.textContent = m.name;

      const valEl = document.createElement('div');
      valEl.className = 'month-val';
      valEl.textContent = m.val !== 0 ? m.val.toFixed(0) : '0';

      const bar = document.createElement('div');
      bar.className = 'month-bar';
      bar.style.width = `${pct}%`;
      bar.style.background = color;

      cell.appendChild(nameEl);
      cell.appendChild(valEl);
      cell.appendChild(bar);
      grid.appendChild(cell);
    });
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
