import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRICE_BOOK,
  costForAreaLine,
  costForMeasuredAreaLine,
  costForItem,
  costForLine,
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
