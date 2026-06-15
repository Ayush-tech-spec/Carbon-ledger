/**
 * store.test.js
 * Tests for Store: add, remove, clear, totals, monthly breakdown.
 * Uses a mock localStorage so tests don't pollute real storage.
 */

// Mock localStorage for test environment
const _mockStorage = (() => {
  let _data = {};
  return {
    getItem:    (k)      => _data[k] ?? null,
    setItem:    (k, v)   => { _data[k] = String(v); },
    removeItem: (k)      => { delete _data[k]; },
    clear:      ()       => { _data = {}; },
  };
})();

// Patch window.localStorage in browser test context
Object.defineProperty(window, 'localStorage', {
  value: _mockStorage,
  writable: true,
});

// Helper: make a sample entry
function _makeEntry(overrides = {}) {
  return {
    id:       Date.now() + Math.random(),
    date:     '2026-06-01',
    category: 'car',
    desc:     'Test car journey',
    kg:       10.5,
    qty:      50,
    ...overrides,
  };
}

// Reset store before each suite
function resetStore() {
  _mockStorage.clear();
  Store.load();
  Store.clear();
}

TestRunner.describe('Store: add and retrieve', () => {

  it('starts empty after clear', () => {
    resetStore();
    TestRunner.assertEqual(Store.getAll().length, 0);
  });

  it('adds a single entry', () => {
    resetStore();
    Store.add(_makeEntry({ id: 1, kg: 5.0 }));
    TestRunner.assertEqual(Store.getAll().length, 1);
  });

  it('getAll returns a copy, not the internal array', () => {
    resetStore();
    Store.add(_makeEntry({ id: 2 }));
    const a = Store.getAll();
    const b = Store.getAll();
    TestRunner.assert(a !== b, 'getAll should return a new array each time');
  });

  it('newest entry appears first (unshift order)', () => {
    resetStore();
    Store.add(_makeEntry({ id: 10, desc: 'first'  }));
    Store.add(_makeEntry({ id: 11, desc: 'second' }));
    TestRunner.assertEqual(Store.getAll()[0].desc, 'second');
  });

  it('stores multiple entries correctly', () => {
    resetStore();
    Store.add(_makeEntry({ id: 20, kg: 2.0 }));
    Store.add(_makeEntry({ id: 21, kg: 4.0 }));
    Store.add(_makeEntry({ id: 22, kg: 6.0 }));
    TestRunner.assertEqual(Store.getAll().length, 3);
  });

});

TestRunner.describe('Store: remove', () => {

  it('removes entry by id', () => {
    resetStore();
    Store.add(_makeEntry({ id: 100, kg: 5.0 }));
    Store.add(_makeEntry({ id: 101, kg: 3.0 }));
    Store.remove(100);
    TestRunner.assertEqual(Store.getAll().length, 1);
    TestRunner.assertEqual(Store.getAll()[0].id, 101);
  });

  it('does nothing when id not found', () => {
    resetStore();
    Store.add(_makeEntry({ id: 200 }));
    Store.remove(9999); // non-existent
    TestRunner.assertEqual(Store.getAll().length, 1);
  });

  it('can remove all entries one by one', () => {
    resetStore();
    Store.add(_makeEntry({ id: 300 }));
    Store.add(_makeEntry({ id: 301 }));
    Store.remove(300);
    Store.remove(301);
    TestRunner.assertEqual(Store.getAll().length, 0);
  });

});

TestRunner.describe('Store: getTotals', () => {

  it('returns zero totals when empty', () => {
    resetStore();
    const t = Store.getTotals();
    TestRunner.assertEqual(t.debit,  0);
    TestRunner.assertEqual(t.credit, 0);
    TestRunner.assertEqual(t.net,    0);
  });

  it('sums debits correctly', () => {
    resetStore();
    Store.add(_makeEntry({ id: 400, kg: 10.0 }));
    Store.add(_makeEntry({ id: 401, kg: 5.5  }));
    TestRunner.assertApprox(Store.getTotals().debit, 15.5);
  });

  it('sums credits correctly (negative kg)', () => {
    resetStore();
    Store.add(_makeEntry({ id: 500, kg: -21.7, category: 'tree' }));
    Store.add(_makeEntry({ id: 501, kg: -0.89, category: 'transit' }));
    TestRunner.assertApprox(Store.getTotals().credit, 22.59);
  });

  it('net = debit - credit', () => {
    resetStore();
    Store.add(_makeEntry({ id: 600, kg: 20.0  }));
    Store.add(_makeEntry({ id: 601, kg: -5.0, category: 'tree' }));
    TestRunner.assertApprox(Store.getTotals().net, 15.0);
  });

  it('net can be negative (more offsets than emissions)', () => {
    resetStore();
    Store.add(_makeEntry({ id: 700, kg: 5.0   }));
    Store.add(_makeEntry({ id: 701, kg: -50.0, category: 'tree' }));
    TestRunner.assert(Store.getTotals().net < 0);
  });

});

TestRunner.describe('Store: getCategoryTotals', () => {

  it('returns zero for all cats when empty', () => {
    resetStore();
    const cats = Store.getCategoryTotals();
    TestRunner.assertEqual(cats.transport, 0);
    TestRunner.assertEqual(cats.food,      0);
    TestRunner.assertEqual(cats.energy,    0);
    TestRunner.assertEqual(cats.shopping,  0);
  });

  it('maps car entry to transport', () => {
    resetStore();
    Store.add(_makeEntry({ id: 800, category: 'car', kg: 10.0 }));
    TestRunner.assertApprox(Store.getCategoryTotals().transport, 10.0);
  });

  it('maps flight to transport as well', () => {
    resetStore();
    Store.add(_makeEntry({ id: 900, category: 'flight', kg: 255.0 }));
    TestRunner.assertApprox(Store.getCategoryTotals().transport, 255.0);
  });

  it('does not count offsets in category totals', () => {
    resetStore();
    Store.add(_makeEntry({ id: 1000, category: 'tree', kg: -21.7 }));
    const cats = Store.getCategoryTotals();
    // offset is negative kg, should not appear in emission categories
    TestRunner.assertEqual(cats.transport, 0);
    TestRunner.assertEqual(cats.food,      0);
    TestRunner.assertEqual(cats.energy,    0);
  });

});

TestRunner.describe('Store: getMonthlyTotals', () => {

  it('returns exactly 6 months by default', () => {
    resetStore();
    const months = Store.getMonthlyTotals();
    TestRunner.assertEqual(months.length, 6);
  });

  it('returns N months when specified', () => {
    resetStore();
    TestRunner.assertEqual(Store.getMonthlyTotals(3).length, 3);
    TestRunner.assertEqual(Store.getMonthlyTotals(12).length, 12);
  });

  it('each month has name, key, val properties', () => {
    resetStore();
    Store.getMonthlyTotals().forEach((m, i) => {
      TestRunner.assert(m.name, `Month ${i} missing "name"`);
      TestRunner.assert(m.key,  `Month ${i} missing "key"`);
      TestRunner.assertType(m.val, 'number', `Month ${i} "val" is not a number`);
    });
  });

  it('entry from current month appears in totals', () => {
    resetStore();
    const now  = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`;
    Store.add(_makeEntry({ id: 1100, date, kg: 42.0 }));
    const months  = Store.getMonthlyTotals();
    const current = months[months.length - 1];
    TestRunner.assertApprox(current.val, 42.0);
  });

  it('month keys are in YYYY-MM format', () => {
    resetStore();
    const re = /^\d{4}-\d{2}$/;
    Store.getMonthlyTotals().forEach((m, i) => {
      TestRunner.assert(re.test(m.key), `Month ${i} key "${m.key}" not in YYYY-MM format`);
    });
  });

});

TestRunner.describe('Store: localStorage persistence', () => {

  it('persists entries across load() calls', () => {
    resetStore();
    Store.add(_makeEntry({ id: 2000, kg: 8.0 }));
    Store.load(); // simulate page reload
    TestRunner.assertEqual(Store.getAll().length, 1);
  });

  it('clear() wipes localStorage', () => {
    resetStore();
    Store.add(_makeEntry({ id: 2100, kg: 3.0 }));
    Store.clear();
    Store.load();
    TestRunner.assertEqual(Store.getAll().length, 0);
  });

});
