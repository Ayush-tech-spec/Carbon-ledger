/**
 * runner.js
 * Zero-dependency test runner. Works in browser and Node (via --experimental-vm-modules).
 * Usage: TestRunner.describe('Suite', () => { TestRunner.it('case', () => { TestRunner.assert(...) }) })
 *        TestRunner.run()
 */

const TestRunner = (() => {
  const _suites  = [];
  let   _current = null;

  function describe(name, fn) {
    _current = { name, tests: [] };
    _suites.push(_current);
    fn();
    _current = null;
  }

  function it(name, fn) {
    if (!_current) throw new Error('it() called outside describe()');
    _current.tests.push({ name, fn });
  }

  // --- Assertions -----------------------------------------------------------

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }

  function assertApprox(a, b, tolerance, msg) {
    tolerance = tolerance ?? 0.001;
    if (Math.abs(a - b) > tolerance) {
      throw new Error(msg || `Expected ~${b} (±${tolerance}), got ${a}`);
    }
  }

  function assertThrows(fn, msg) {
    try { fn(); throw new Error('Expected function to throw but it did not'); }
    catch (e) { if (e.message.startsWith('Expected function')) throw e; }
  }

  function assertArray(val, msg) {
    if (!Array.isArray(val)) throw new Error(msg || `Expected array, got ${typeof val}`);
  }

  function assertType(val, type, msg) {
    if (typeof val !== type) throw new Error(msg || `Expected ${type}, got ${typeof val}`);
  }

  // --- Run ------------------------------------------------------------------

  function run() {
    let totalPass = 0, totalFail = 0;
    const out = document.getElementById('output');

    _suites.forEach(suite => {
      const suiteEl = document.createElement('div');
      suiteEl.className = 'suite';
      suiteEl.innerHTML = `<div class="suite-name">${suite.name}</div>`;

      suite.tests.forEach(test => {
        let line;
        try {
          test.fn();
          totalPass++;
          line = `<div class="pass">  ✓ ${test.name}</div>`;
        } catch (err) {
          totalFail++;
          line = `<div class="fail">  ✗ ${test.name}</div><pre>${err.message}</pre>`;
        }
        suiteEl.innerHTML += line;
      });

      out.appendChild(suiteEl);
    });

    const summaryEl = document.getElementById('summary');
    const total     = totalPass + totalFail;
    summaryEl.className = `summary ${totalFail === 0 ? 'all-pass' : 'has-fail'}`;
    summaryEl.textContent = `${totalPass}/${total} passed${totalFail > 0 ? ` | ${totalFail} failed` : ' — all green!'}`;
  }

  return { describe, it, assert, assertEqual, assertApprox, assertThrows, assertArray, assertType, run };
})();
