/**
 * utils.test.js
 * Tests for security helpers, input validation, date utilities.
 */

// Inline the helpers we want to test (mirrors journal.js and ai.js internals)

function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidAmount(val) {
  const n = parseFloat(val);
  return !isNaN(n) && isFinite(n) && n > 0;
}

function isValidCategory(cat) {
  return Object.prototype.hasOwnProperty.call(CONFIG.EMISSION_FACTORS, cat);
}

function clampDescription(str, maxLen = 120) {
  return String(str || '').slice(0, maxLen);
}

// --- Tests ---

TestRunner.describe('Security: HTML Escaping', () => {

  it('escapes < and >', () => {
    TestRunner.assertEqual(escHtml('<script>'), '&lt;script&gt;');
  });

  it('escapes & ampersand', () => {
    TestRunner.assertEqual(escHtml('cats & dogs'), 'cats &amp; dogs');
  });

  it('escapes double quotes', () => {
    TestRunner.assertEqual(escHtml('"hello"'), '&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    TestRunner.assert(escHtml("it's").includes('&#x27;'));
  });

  it('neutralises XSS script injection attempt', () => {
    const evil   = '<script>alert("xss")</script>';
    const result = escHtml(evil);
    TestRunner.assert(!result.includes('<script>'), 'Should not contain raw <script>');
    TestRunner.assert(!result.includes('</script>'));
  });

  it('neutralises img onerror XSS', () => {
    const evil   = '<img src=x onerror=alert(1)>';
    const result = escHtml(evil);
    TestRunner.assert(!result.includes('<img'), 'Should not contain raw <img>');
  });

  it('leaves safe text unchanged', () => {
    TestRunner.assertEqual(escHtml('Car trip to office'), 'Car trip to office');
  });

  it('handles empty string', () => {
    TestRunner.assertEqual(escHtml(''), '');
  });

  it('handles non-string input (coerces to string)', () => {
    TestRunner.assertEqual(escHtml(42), '42');
    TestRunner.assertEqual(escHtml(null), 'null');
  });

});

TestRunner.describe('Input Validation: Amount', () => {

  it('accepts positive integers', () => {
    TestRunner.assert(isValidAmount(100));
    TestRunner.assert(isValidAmount('50'));
  });

  it('accepts positive decimals', () => {
    TestRunner.assert(isValidAmount(10.5));
    TestRunner.assert(isValidAmount('3.14'));
  });

  it('rejects zero', () => {
    TestRunner.assert(!isValidAmount(0));
  });

  it('rejects negative numbers', () => {
    TestRunner.assert(!isValidAmount(-5));
    TestRunner.assert(!isValidAmount('-100'));
  });

  it('rejects NaN and empty string', () => {
    TestRunner.assert(!isValidAmount(NaN));
    TestRunner.assert(!isValidAmount(''));
    TestRunner.assert(!isValidAmount('abc'));
  });

  it('rejects Infinity', () => {
    TestRunner.assert(!isValidAmount(Infinity));
  });

});

TestRunner.describe('Input Validation: Date', () => {

  it('accepts valid ISO date string', () => {
    TestRunner.assert(isValidDate('2026-06-14'));
  });

  it('rejects wrong format', () => {
    TestRunner.assert(!isValidDate('14/06/2026'));
    TestRunner.assert(!isValidDate('June 14 2026'));
  });

  it('rejects empty string', () => {
    TestRunner.assert(!isValidDate(''));
  });

  it('rejects null and undefined', () => {
    TestRunner.assert(!isValidDate(null));
    TestRunner.assert(!isValidDate(undefined));
  });

  it('rejects impossible dates', () => {
    TestRunner.assert(!isValidDate('2026-13-99'));
  });

});

TestRunner.describe('Input Validation: Category', () => {

  it('accepts all valid debit categories', () => {
    ['car','flight','meatmeal','vegmeal','electricbill','gasbill','online_order','custom_debit'].forEach(cat => {
      TestRunner.assert(isValidCategory(cat), `"${cat}" should be valid`);
    });
  });

  it('accepts all valid credit categories', () => {
    ['tree','transit','solar','custom_credit'].forEach(cat => {
      TestRunner.assert(isValidCategory(cat), `"${cat}" should be valid`);
    });
  });

  it('rejects unknown categories', () => {
    TestRunner.assert(!isValidCategory('bitcoin'));
    TestRunner.assert(!isValidCategory(''));
    TestRunner.assert(!isValidCategory(null));
  });

  it('is case-sensitive (rejects wrong case)', () => {
    TestRunner.assert(!isValidCategory('Car'));
    TestRunner.assert(!isValidCategory('FLIGHT'));
  });

});

TestRunner.describe('Input Validation: Description Clamping', () => {

  it('allows descriptions under 120 chars', () => {
    const s = 'Drive to office';
    TestRunner.assertEqual(clampDescription(s), s);
  });

  it('truncates descriptions over 120 chars', () => {
    const s = 'a'.repeat(200);
    TestRunner.assertEqual(clampDescription(s).length, 120);
  });

  it('handles null/undefined gracefully', () => {
    TestRunner.assertEqual(clampDescription(null),      '');
    TestRunner.assertEqual(clampDescription(undefined), '');
  });

});

TestRunner.describe('CONFIG: AI Provider Security', () => {

  it('all AI endpoints use HTTPS', () => {
    Object.entries(CONFIG.AI_PROVIDERS).forEach(([name, p]) => {
      TestRunner.assert(
        p.endpoint.startsWith('https://'),
        `Provider "${name}" must use HTTPS`
      );
    });
  });

  it('no API keys hardcoded in CONFIG', () => {
    const configStr = JSON.stringify(CONFIG);
    TestRunner.assert(!configStr.includes('sk-ant-'), 'Claude key must not be in CONFIG');
    TestRunner.assert(!configStr.includes('xai-'),    'Grok key must not be in CONFIG');
  });

});
