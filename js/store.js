/**
 * @fileoverview Data layer for Carbon Ledger.
 * Manages the in-memory entry list with localStorage persistence.
 * Exposes a clean public API; all internal state is encapsulated via IIFE.
 *
 * @module store
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} LedgerEntry
 * @property {number} id         - Unique timestamp-based identifier
 * @property {string} date       - ISO date string (YYYY-MM-DD)
 * @property {string} category   - Activity key from CONFIG.EMISSION_FACTORS
 * @property {string} desc       - Human-readable description (XSS-safe)
 * @property {number} kg         - CO2e in kg; positive = debit, negative = credit
 * @property {number} qty        - Raw quantity entered by the user
 */

/**
 * @typedef {Object} Totals
 * @property {number} debit  - Total emissions in kg CO2e
 * @property {number} credit - Total offsets in kg CO2e (positive value)
 * @property {number} net    - Net balance: debit - credit
 */

/**
 * @typedef {Object} CategoryTotals
 * @property {number} transport - kg CO2e from transport activities
 * @property {number} food      - kg CO2e from food activities
 * @property {number} energy    - kg CO2e from energy activities
 * @property {number} shopping  - kg CO2e from shopping activities
 */

/**
 * @typedef {Object} MonthBucket
 * @property {string} name - Short month name (e.g. 'Jan')
 * @property {string} key  - Month key in YYYY-MM format
 * @property {number} val  - Net kg CO2e for that month
 */

/**
 * Store — singleton data manager using the Revealing Module Pattern.
 * @namespace Store
 */
const Store = (() => {
  'use strict';

  /** @type {LedgerEntry[]} Internal mutable entry list, newest-first */
  let _entries = [];

  /**
   * Loads persisted entries from localStorage into memory.
   * Silently recovers from JSON parse errors by resetting to empty state.
   * Should be called once during application bootstrap (app.js).
   * @returns {void}
   */
  function load() {
    try {
      const raw  = localStorage.getItem(CONFIG.STORAGE_KEY);
      _entries   = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(_entries)) _entries = [];
    } catch (_err) {
      _entries = [];
    }
  }

  /**
   * Serialises the current entry list to localStorage.
   * Called automatically after every mutation (add, remove, clear).
   * Silently swallows QuotaExceededError in private browsing contexts.
   * @private
   * @returns {void}
   */
  function _save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(_entries));
    } catch (_err) {
      // Storage unavailable (private mode or quota exceeded) — no-op
    }
  }

  /**
   * Returns a shallow copy of all entries in newest-first order.
   * Callers receive a copy; mutating it does not affect internal state.
   * @returns {LedgerEntry[]} Copied array of all ledger entries
   */
  function getAll() {
    return [..._entries];
  }

  /**
   * Prepends a new entry to the ledger and persists the updated list.
   * @param {LedgerEntry} entry - Fully constructed entry object
   * @returns {void}
   */
  function add(entry) {
    if (!entry || typeof entry !== 'object') return;
    _entries.unshift(entry);
    _save();
  }

  /**
   * Removes the entry with the given ID from the ledger and persists.
   * No-op if the ID is not found.
   * @param {number} id - The entry's unique identifier
   * @returns {void}
   */
  function remove(id) {
    _entries = _entries.filter(e => e.id !== id);
    _save();
  }

  /**
   * Deletes all entries from memory and clears localStorage.
   * @returns {void}
   */
  function clear() {
    _entries = [];
    _save();
  }

  /**
   * Computes aggregate debit, credit, and net totals across all entries.
   * Values are rounded to 2 decimal places to avoid floating-point drift.
   * @returns {Totals} Aggregate totals object
   */
  function getTotals() {
    let debit = 0;
    let credit = 0;

    _entries.forEach(e => {
      if (e.kg > 0) {
        debit  += e.kg;
      } else {
        credit += Math.abs(e.kg);
      }
    });

    return {
      debit:  parseFloat(debit.toFixed(2)),
      credit: parseFloat(credit.toFixed(2)),
      net:    parseFloat((debit - credit).toFixed(2)),
    };
  }

  /**
   * Computes total emission kg per visual category for debit entries only.
   * Offset/credit entries are excluded from this breakdown.
   * @returns {CategoryTotals} Totals keyed by category name
   */
  function getCategoryTotals() {
    const cats = { transport: 0, food: 0, energy: 0, shopping: 0 };

    _entries
      .filter(e => e.kg > 0)
      .forEach(e => {
        const c = CONFIG.CATEGORY_MAP[e.category] || 'other';
        if (Object.prototype.hasOwnProperty.call(cats, c)) {
          cats[c] += e.kg;
        }
      });

    Object.keys(cats).forEach(k => {
      cats[k] = parseFloat(cats[k].toFixed(2));
    });

    return cats;
  }

  /**
   * Builds a monthly net CO2 summary for the last N calendar months.
   * Months with no entries are included with val = 0.
   * @param {number} [n=6] - Number of months to include (default: 6)
   * @returns {MonthBucket[]} Array of month buckets, oldest-first
   */
  function getMonthlyTotals(n = 6) {
    const now    = new Date();
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
      const m   = months.find(bucket => bucket.key === key);
      if (m) m.val += e.kg;
    });

    months.forEach(m => { m.val = parseFloat(m.val.toFixed(2)); });
    return months;
  }

  /** @public */
  return Object.freeze({
    load,
    getAll,
    add,
    remove,
    clear,
    getTotals,
    getCategoryTotals,
    getMonthlyTotals,
  });
})();
