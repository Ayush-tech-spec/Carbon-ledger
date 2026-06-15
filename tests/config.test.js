/**
 * config.test.js
 * Tests for CONFIG constants: completeness, data types, value ranges.
 */

TestRunner.describe('CONFIG: Emission Factors', () => {

  it('exists and is an object', () => {
    TestRunner.assert(typeof CONFIG === 'object', 'CONFIG not defined');
    TestRunner.assert(typeof CONFIG.EMISSION_FACTORS === 'object');
  });

  it('every factor is a non-zero number', () => {
    Object.entries(CONFIG.EMISSION_FACTORS).forEach(([key, val]) => {
      TestRunner.assertType(val, 'number', `Factor "${key}" is not a number`);
      TestRunner.assert(val !== 0, `Factor "${key}" is zero`);
    });
  });

  it('debit categories have positive factors', () => {
    const debits = ['car','flight','meatmeal','vegmeal','electricbill','gasbill','online_order','custom_debit'];
    debits.forEach(key => {
      TestRunner.assert(CONFIG.EMISSION_FACTORS[key] > 0, `"${key}" should be positive`);
    });
  });

  it('credit/offset categories have negative factors', () => {
    const credits = ['tree','transit','solar','custom_credit'];
    credits.forEach(key => {
      TestRunner.assert(CONFIG.EMISSION_FACTORS[key] < 0, `"${key}" should be negative`);
    });
  });

  it('car emission factor is within realistic range (0.1 to 0.4 kg/km)', () => {
    TestRunner.assert(CONFIG.EMISSION_FACTORS.car >= 0.1);
    TestRunner.assert(CONFIG.EMISSION_FACTORS.car <= 0.4);
  });

  it('India grid intensity is within CEA reported range (0.6 to 1.0 kg/kWh)', () => {
    TestRunner.assert(CONFIG.EMISSION_FACTORS.electricbill >= 0.6);
    TestRunner.assert(CONFIG.EMISSION_FACTORS.electricbill <= 1.0);
  });

  it('meat meal has higher footprint than veg meal', () => {
    TestRunner.assert(
      CONFIG.EMISSION_FACTORS.meatmeal > CONFIG.EMISSION_FACTORS.vegmeal,
      'Meat meal should have higher footprint than veg'
    );
  });

});

TestRunner.describe('CONFIG: Category Map', () => {

  it('every emission factor key has a category mapping', () => {
    Object.keys(CONFIG.EMISSION_FACTORS).forEach(key => {
      TestRunner.assert(
        CONFIG.CATEGORY_MAP[key] !== undefined,
        `"${key}" missing from CATEGORY_MAP`
      );
    });
  });

  it('all categories are valid strings', () => {
    const valid = ['transport','food','energy','shopping','offset','other'];
    Object.entries(CONFIG.CATEGORY_MAP).forEach(([key, cat]) => {
      TestRunner.assert(valid.includes(cat), `"${key}" maps to unknown category "${cat}"`);
    });
  });

  it('flight maps to transport', () => {
    TestRunner.assertEqual(CONFIG.CATEGORY_MAP.flight, 'transport');
  });

  it('tree maps to offset', () => {
    TestRunner.assertEqual(CONFIG.CATEGORY_MAP.tree, 'offset');
  });

});

TestRunner.describe('CONFIG: Units and Names', () => {

  it('every key has a unit', () => {
    Object.keys(CONFIG.EMISSION_FACTORS).forEach(key => {
      TestRunner.assert(CONFIG.UNITS[key], `"${key}" missing from UNITS`);
    });
  });

  it('every key has a display name', () => {
    Object.keys(CONFIG.EMISSION_FACTORS).forEach(key => {
      TestRunner.assert(CONFIG.NAMES[key], `"${key}" missing from NAMES`);
    });
  });

  it('names are non-empty strings', () => {
    Object.entries(CONFIG.NAMES).forEach(([key, name]) => {
      TestRunner.assertType(name, 'string', `Name for "${key}" is not a string`);
      TestRunner.assert(name.length > 0, `Name for "${key}" is empty`);
    });
  });

});

TestRunner.describe('CONFIG: Benchmarks', () => {

  it('has India, global, and Paris benchmarks', () => {
    TestRunner.assert(CONFIG.BENCHMARKS.indiaAvg   > 0);
    TestRunner.assert(CONFIG.BENCHMARKS.globalAvg  > 0);
    TestRunner.assert(CONFIG.BENCHMARKS.parisTarget > 0);
  });

  it('global average is higher than India average', () => {
    TestRunner.assert(
      CONFIG.BENCHMARKS.globalAvg > CONFIG.BENCHMARKS.indiaAvg,
      'Global avg should exceed India avg'
    );
  });

  it('has at least 2 AI providers configured', () => {
    const providers = Object.keys(CONFIG.AI_PROVIDERS);
    TestRunner.assert(providers.length >= 2, 'Need at least Claude and Grok');
    TestRunner.assert(providers.includes('claude'));
    TestRunner.assert(providers.includes('grok'));
  });

  it('AI provider endpoints are valid URLs', () => {
    Object.entries(CONFIG.AI_PROVIDERS).forEach(([name, p]) => {
      TestRunner.assert(
        p.endpoint.startsWith('https://'),
        `Provider "${name}" endpoint is not HTTPS`
      );
    });
  });

  it('CONFIG is frozen (immutable)', () => {
    TestRunner.assert(Object.isFrozen(CONFIG), 'CONFIG should be frozen with Object.freeze()');
  });

});

TestRunner.describe('CONFIG: Actions', () => {

  it('has at least 4 suggested actions', () => {
    TestRunner.assert(Array.isArray(CONFIG.ACTIONS));
    TestRunner.assert(CONFIG.ACTIONS.length >= 4, 'Need at least 4 suggested actions');
  });

  it('every action has required fields', () => {
    CONFIG.ACTIONS.forEach((action, i) => {
      TestRunner.assert(action.saving,      `Action ${i} missing "saving"`);
      TestRunner.assert(action.description, `Action ${i} missing "description"`);
      TestRunner.assert(action.difficulty,  `Action ${i} missing "difficulty"`);
      TestRunner.assert(action.query,       `Action ${i} missing "query"`);
    });
  });

});
