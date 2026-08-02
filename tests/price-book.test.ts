import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRICE_BOOK,
  costForAreaLine,
  costForMeasuredAreaLine,
  costForItem,
  costForLine,
  isAreaPricedItem,
  formatZar,
  totalZar,
  type CostLine,
} from '@/lib/price-book';

function priced(line: CostLine | null, label: string): CostLine {
  assert.ok(line, `${label} should have a price-book line`);
  assert.ok(Number.isFinite(line.zar), `${label} produced a non-finite cost`);
  return line;
}

test('a zero quantity remains an explicit R0 line for every measured unit', () => {
  const lines = [
    priced(costForLine('fence', 0), 'zero-length fence'),
    priced(costForAreaLine('driveway', 0), 'zero-area driveway'),
    priced(costForItem('bed', 0, 1), 'zero-area bed'),
  ];

  for (const line of lines) assert.equal(line.zar, 0);
});

test('a missing area stays unpriced while a measured zero remains an explicit R0 row', () => {
  assert.equal(
    costForMeasuredAreaLine('driveway', undefined),
    null,
    'missing polygon geometry was silently presented as a free driveway',
  );
  assert.equal(
    priced(costForMeasuredAreaLine('driveway', 0), 'measured zero-area driveway').zar,
    0,
  );
});

test('the BOQ total is exactly the sum of its rounded lines', () => {
  // These two raw products both have fractions of a rand. Summing the raw
  // products and rounding once gives a different answer, so this fixture
  // catches an implementation that lets rounding drift down the column.
  const lines = [
    priced(costForLine('pipe', 0.125), 'pipe'),
    priced(costForLine('drip', 0.125), 'drip line'),
  ];
  const rawAggregateRounded = Math.round(
    0.125 * PRICE_BOOK.pipe_per_m.zar + 0.125 * PRICE_BOOK.drip_per_m.zar,
  );
  const sumOfDisplayedLines = lines.reduce((sum, line) => sum + line.zar, 0);

  assert.notEqual(rawAggregateRounded, sumOfDisplayedLines, 'fixture must expose aggregate-rounding drift');
  assert.equal(totalZar(lines), sumOfDisplayedLines);
});

test('priced lines state the unit that their quantity actually measures', () => {
  const cases: Array<[string, CostLine, CostLine['unit']]> = [
    ['fence', priced(costForLine('fence', 3), 'fence'), 'm'],
    ['driveway', priced(costForAreaLine('driveway', 3), 'driveway'), 'm²'],
    ['vegetable bed', priced(costForItem('bed', 3, 2), 'vegetable bed'), 'm²'],
    ['compost bay', priced(costForItem('compost', 1, 1), 'compost bay'), 'each'],
    ['water tank', priced(costForItem('tank', 1, 1, 5000), 'water tank'), 'each'],
  ];

  for (const [label, line, expected] of cases) {
    assert.equal(line.unit, expected, `${label} should be counted in ${expected}`);
  }
});

test('missing price-book entries are unpriced, never silently R0', () => {
  const unknownItem = costForItem('solar-powered-time-machine', 2, 2);
  const unknownLine = costForLine('teleporter-cable', 10);
  const unknownArea = costForAreaLine('landing-pad', 10);

  assert.equal(unknownItem, null);
  assert.equal(unknownLine, null);
  assert.equal(unknownArea, null);
  assert.notDeepEqual(unknownItem, { zar: 0 }, 'unpriced must remain distinct from free');
});

test('ZAR formatting is deterministic and independent of browser locale', () => {
  assert.equal(formatZar(0), 'R0');
  assert.equal(formatZar(12_500.4), 'R12 500');
  assert.equal(formatZar(-1_234.6), '-R1 235');
  assert.doesNotMatch(formatZar(1_000_000), /[,.]/, 'locale punctuation leaked into ZAR output');
});

test('every published rate is usable without pinning today’s prices', () => {
  const validUnits = new Set(['each', 'per_m', 'per_m2']);

  assert.ok(Object.keys(PRICE_BOOK).length > 0);
  for (const [key, entry] of Object.entries(PRICE_BOOK)) {
    assert.ok(entry.label.trim(), `${key} has no farmer-facing label`);
    assert.ok(validUnits.has(entry.unit), `${key} has an unsupported unit`);
    assert.ok(Number.isFinite(entry.zar) && entry.zar > 0, `${key} has an unusable rate`);
  }
});

test('quantity changes cost according to the measurement unit', () => {
  const oneMetre = priced(costForLine('fence', 1), 'one metre of fence');
  const twoMetres = priced(costForLine('fence', 2), 'two metres of fence');
  assert.equal(twoMetres.zar, oneMetre.zar * 2);

  const oneSquare = priced(costForItem('bed', 1, 1), 'one-square-metre bed');
  const fourSquares = priced(costForItem('bed', 2, 2), 'four-square-metre bed');
  assert.equal(fourSquares.zar, oneSquare.zar * 4);

  const oneBay = priced(costForItem('compost', 1, 1), 'one compost bay');
  const oddlySizedBay = priced(costForItem('compost', 99, 0), 'oddly sized compost bay');
  assert.equal(oddlySizedBay.zar, oneBay.zar, 'each-priced items must ignore drawing dimensions');
});

test('aliases resolve to the same priced work', () => {
  assert.deepEqual(costForItem('bed', 3, 2), costForItem('veg_bed', 3, 2));
  assert.deepEqual(costForItem('compost', 1, 1), costForItem('compost_bay', 1, 1));
  assert.deepEqual(costForItem('hive', 1, 1), costForItem('beehive', 1, 1));
});

test('invalid measurements stay unpriced instead of leaking non-finite or negative totals', () => {
  const invalid = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1];

  for (const value of invalid) {
    assert.equal(costForLine('fence', value), null, `line accepted ${value}`);
    assert.equal(costForAreaLine('driveway', value), null, `area accepted ${value}`);
    assert.equal(costForItem('bed', value, 1), null, `item width accepted ${value}`);
    assert.equal(costForItem('bed', 1, value), null, `item height accepted ${value}`);
    assert.equal(costForItem('tank', 1, 1, value), null, `tank accepted ${value}`);
  }
});

test('a tank request uses one of the published tank sizes and keeps the requested volume visible', () => {
  const requestedLitres = 7_500;
  const line = priced(costForItem('tank', 1, 1, requestedLitres), 'tank');
  const tankLabels = Object.entries(PRICE_BOOK)
    .filter(([key]) => /^tank_\d+$/.test(key))
    .map(([, entry]) => entry.label);

  assert.ok(tankLabels.some((label) => line.basis.startsWith(label)));
  assert.match(line.basis, new RegExp(`${requestedLitres}L`));
});

test('non-finite values are never formatted as plausible currency', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(formatZar(value), '—');
    assert.doesNotMatch(formatZar(value), /NaN|Infinity|R/);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE PRINTED BILL OF QUANTITIES OVERSTATED WHAT A FARMER MUST PAY.
// Three defects, all on the pack that goes to a funder, all making the printed total higher than
// the on-screen budget for the same design. These pin the arithmetic the print page now relies on.

test('a bank of tanks costs the sum of its tanks, never the price of their combined litres', () => {
  // The print page summed every tank's litres into one figure, passed THAT to costForItem — which
  // snapped it to the nearest size in the book — and then multiplied the result by the tank count.
  const one5k = costForItem('tank', 2, 2, 5000);
  const combined = costForItem('tank', 2, 2, 15000);
  assert.ok(one5k && combined, 'guard: both tank sizes are priced');

  // Three 5 000 L tanks.
  assert.equal(one5k!.zar * 3, 21000);
  // What the bug produced: 15 000 L snaps UP to the 10 000 L rate, then x3.
  assert.equal(combined!.zar * 3, 39000);
  assert.notEqual(combined!.zar * 3, one5k!.zar * 3);

  // A MIXED bank is why an average of the litres is not a fix either: one 2 500 and one 10 000
  // average to two 5 000s, which is wrong in both directions.
  const small = costForItem('tank', 2, 2, 2500)!;
  const large = costForItem('tank', 2, 2, 10000)!;
  const avg = costForItem('tank', 2, 2, (2500 + 10000) / 2)!;
  assert.notEqual(small.zar + large.zar, avg.zar * 2);
});

test('isAreaPricedItem answers for every per_m2 entry, including swalew', () => {
  // The print page kept its own hardcoded list of area-priced types and had already lost `swalew`
  // — the one per-m2 entry missing from it — so every swale was costed on the wrong basis.
  assert.equal(isAreaPricedItem('swalew'), true);
  for (const type of ['bed', 'hugel', 'foodforest', 'nursery', 'greenhouse', 'tunnel', 'shed', 'reedbed', 'pond', 'firebreak']) {
    assert.equal(isAreaPricedItem(type), true, `${type} is priced by area`);
  }
  // Per-unit and unpriced things are not area-priced, and a tank is never area-priced.
  assert.equal(isAreaPricedItem('tank'), false);
  assert.equal(isAreaPricedItem('well'), false);
  assert.equal(isAreaPricedItem('not-a-real-type'), false);
});

test('isAreaPricedItem agrees with what costForItem actually charges', () => {
  // The invariant that matters, asserted through the public API rather than by exporting internals:
  // the predicate the print page branches on must agree with the unit the price book bills in. If
  // these two ever disagree, an item is measured one way and charged another.
  const TYPES = [
    'bed', 'hugel', 'foodforest', 'nursery', 'greenhouse', 'tunnel', 'shed', 'reedbed',
    'pond', 'firebreak', 'swalew', 'well', 'biogas', 'beehive', 'chicken_coop', 'tank',
  ];
  for (const type of TYPES) {
    const line = costForItem(type, 10, 10, type === 'tank' ? 5000 : undefined);
    if (!line) continue;
    assert.equal(
      isAreaPricedItem(type),
      line.unit === 'm²',
      `${type}: predicate says ${isAreaPricedItem(type)}, price book bills in ${line.unit}`,
    );
  }
});
