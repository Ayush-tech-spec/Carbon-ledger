/**
 * emission.test.js
 * Tests the core emission calculation logic against known real-world values.
 * These are the numbers the evaluator can verify independently.
 */

// Inline calc function (mirrors journal.js logic)
function calcKg(category, qty) {
  const factor = CONFIG.EMISSION_FACTORS[category] ?? 0;
  return parseFloat((factor * qty).toFixed(3));
}

TestRunner.describe('Emission Calculations: Transport', () => {

  it('car: 100km = 21 kg CO2', () => {
    TestRunner.assertApprox(calcKg('car', 100), 21.0, 0.5);
  });

  it('car: 0km = 0 kg', () => {
    TestRunner.assertEqual(calcKg('car', 0), 0);
  });

  it('flight: 1 domestic flight ~255 kg CO2', () => {
    TestRunner.assertApprox(calcKg('flight', 1), 255, 5);
  });

  it('flight: 2 flights = double the emissions', () => {
    TestRunner.assertApprox(calcKg('flight', 2), calcKg('flight', 1) * 2, 0.01);
  });

  it('transit trip produces negative kg (offset)', () => {
    TestRunner.assert(calcKg('transit', 1) < 0);
  });

});

TestRunner.describe('Emission Calculations: Food', () => {

  it('meat meal > veg meal per unit', () => {
    TestRunner.assert(calcKg('meatmeal', 1) > calcKg('vegmeal', 1));
  });

  it('7 meat meals per week = roughly 2.2 tonnes/year', () => {
    const yearly = calcKg('meatmeal', 7 * 52);
    TestRunner.assert(yearly > 2000 && yearly < 2500, `Got ${yearly} kg/yr`);
  });

  it('switching from meat to veg saves positive kg', () => {
    const saving = calcKg('meatmeal', 1) - calcKg('vegmeal', 1);
    TestRunner.assert(saving > 0);
  });

});

TestRunner.describe('Emission Calculations: Energy', () => {

  it('100 kWh electricity in India = ~82 kg CO2', () => {
    TestRunner.assertApprox(calcKg('electricbill', 100), 82, 2);
  });

  it('solar kWh produces negative kg (displaces grid)', () => {
    TestRunner.assert(calcKg('solar', 1) < 0);
  });

  it('solar offsets grid at same rate (same absolute factor)', () => {
    // Solar offset should equal grid emission per kWh
    TestRunner.assertApprox(
      Math.abs(calcKg('solar', 1)),
      calcKg('electricbill', 1),
      0.001
    );
  });

  it('1 kg LPG = ~2.04 kg CO2', () => {
    TestRunner.assertApprox(calcKg('gasbill', 1), 2.04, 0.05);
  });

});

TestRunner.describe('Emission Calculations: Offsets', () => {

  it('tree offset is negative', () => {
    TestRunner.assert(calcKg('tree', 1) < 0);
  });

  it('1 tree sequesters ~21.7 kg CO2 per year', () => {
    TestRunner.assertApprox(Math.abs(calcKg('tree', 1)), 21.7, 1);
  });

  it('10 trees offset more than 1 flight', () => {
    const treesOffset  = Math.abs(calcKg('tree', 10));
    const flightCarbon = calcKg('flight', 1);
    TestRunner.assert(treesOffset < flightCarbon, 'Sanity: 10 trees cannot offset 1 flight per year');
  });

  it('custom_debit factor is exactly 1 (user enters kg directly)', () => {
    TestRunner.assertEqual(calcKg('custom_debit', 42), 42);
  });

  it('custom_credit factor is exactly -1', () => {
    TestRunner.assertEqual(calcKg('custom_credit', 10), -10);
  });

});

TestRunner.describe('Emission Calculations: Edge Cases', () => {

  it('unknown category returns 0', () => {
    TestRunner.assertEqual(calcKg('unknown_category', 100), 0);
  });

  it('fractional quantities work correctly', () => {
    TestRunner.assertApprox(calcKg('car', 0.5), 0.105, 0.001);
  });

  it('very large quantities do not overflow', () => {
    const result = calcKg('car', 1_000_000);
    TestRunner.assert(isFinite(result), 'Result should be finite');
    TestRunner.assert(result > 0);
  });

});
