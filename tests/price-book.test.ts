import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRICE_BOOK,
  costForAreaLine,
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
