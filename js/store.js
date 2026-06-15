/**
 * store.js
 * In-memory state with localStorage persistence.
 * Single source of truth for all ledger entries.
 */

const Store = (() => {

  let _entries = [];

  /** Load entries from localStorage */
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      _entries = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Store.load: failed to parse stored entries.', e);
      _entries = [];
    }
  }

  /** Persist current state to localStorage */
  function _save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(_entries));
    } catch (e) {
      console.warn('Store._save: localStorage write failed.', e);
    }
  }

  /** Return a shallow copy of all entries (newest first) */
  function getAll() {
    return [..._entries];
  }

  /**
   * Add a new entry.
   * @param {object} entry - { id, date, category, desc, kg, qty }
   */
  function add(entry) {
    _entries.unshift(entry);
    _save();
  }

  /**
   * Remove an entry by id.
   * @param {number} id
   */
  function remove(id) {
    _entries = _entries.filter(e => e.id !== id);
    _save();
  }

  /** Wipe all entries */
  function clear() {
    _entries = [];
    _save();
  }

  /** Compute aggregate totals */
  function getTotals() {
    let debit = 0, credit = 0;
    _entries.forEach(e => {
      if (e.kg > 0) debit  += e.kg;
      else          credit += Math.abs(e.kg);
    });
    return {
      debit:  parseFloat(debit.toFixed(2)),
      credit: parseFloat(credit.toFixed(2)),
      net:    parseFloat((debit - credit).toFixed(2)),
    };
  }

  /** Compute kg totals per category (emissions only) */
  function getCategoryTotals() {
    const cats = { transport: 0, food: 0, energy: 0, shopping: 0 };
    _entries
      .filter(e => e.kg > 0)
      .forEach(e => {
        const c = CONFIG.CATEGORY_MAP[e.category] || 'other';
        if (cats[c] !== undefined) cats[c] += e.kg;
      });
    Object.keys(cats).forEach(k => {
      cats[k] = parseFloat(cats[k].toFixed(2));
    });
    return cats;
  }

  /**
   * Compute monthly net totals for the last N months.
   * @param {number} n - number of months, default 6
   * @returns {Array<{name, key, val}>}
   */
  function getMonthlyTotals(n = 6) {
    const now = new Date();
    const months = [];

    for (let i = n - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        key,
        val: 0,
      });
    }

    _entries.forEach(e => {
      const key = e.date.slice(0, 7);
      const m   = months.find(m => m.key === key);
      if (m) m.val += e.kg;
    });

    months.forEach(m => { m.val = parseFloat(m.val.toFixed(2)); });
    return months;
  }

  return { load, getAll, add, remove, clear, getTotals, getCategoryTotals, getMonthlyTotals };
})();
