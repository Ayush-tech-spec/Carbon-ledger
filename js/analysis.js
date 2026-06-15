/**
 * analysis.js
 * Renders the Analysis tab: category bars, monthly history, benchmark.
 */

const Analysis = (() => {

  /** Render all analysis components */
  function render() {
    _renderCategoryBars();
    _renderMonthlyGrid();
    _renderBenchmark();
  }

  /** Horizontal bar chart per emission category */
  function _renderCategoryBars() {
    const container = document.getElementById('category-bars');
    const cats      = Store.getCategoryTotals();
    const maxVal    = Math.max(...Object.values(cats), 1);

    const hasData = Object.values(cats).some(v => v > 0);
    if (!hasData) {
      container.innerHTML = '<p class="empty-state">Log entries to see breakdown.</p>';
      return;
    }

    const categories = ['transport', 'food', 'energy', 'shopping'];
    container.innerHTML = categories.map(cat => {
      const val = cats[cat] || 0;
      const pct = Math.round(val / maxVal * 100);
      return `<div class="impact-row">
        <div class="impact-cat">${cat}</div>
        <div class="impact-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${cat}: ${val.toFixed(1)} kg CO2">
          <div class="impact-bar-fill fill-${cat}" style="width: ${pct}%"></div>
        </div>
        <div class="impact-val">${val.toFixed(1)} kg</div>
      </div>`;
    }).join('');
  }

  /** Monthly net CO2 mini-grid for the last 6 months */
  function _renderMonthlyGrid() {
    const grid   = document.getElementById('monthly-grid');
    const months = Store.getMonthlyTotals(6);
    const maxAbs = Math.max(...months.map(m => Math.abs(m.val)), 1);

    grid.innerHTML = months.map(m => {
      const pct   = Math.round(Math.abs(m.val) / maxAbs * 100);
      const color = m.val > 0 ? '#c0392b' : m.val < 0 ? '#1a5c35' : '#ccc';
      const label = m.val !== 0 ? m.val.toFixed(0) : '0';
      return `<div class="month-cell" title="${m.name}: ${m.val.toFixed(1)} kg CO\u2082">
        <div class="month-name">${m.name}</div>
        <div class="month-val">${label}</div>
        <div class="month-bar" style="width: ${pct}%; background: ${color};"></div>
      </div>`;
    }).join('');
  }

  /** Update the "your monthly net" benchmark figure */
  function _renderBenchmark() {
    const net = Store.getTotals().net;
    const el  = document.getElementById('my-monthly');
    if (el) el.textContent = `${net.toFixed(0)} kg`;
  }

  return { render };
})();
