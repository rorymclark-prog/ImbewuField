import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bedsFromDesign,
  buildCropAliasIndex,
  buildReconciliation,
  intendedKgByMonthPerCrop,
  matchCropCandidates,
  matchCropKey,
  monthsForPeriod,
  type ReconciliationResult,
} from '../lib/harvest-reconciliation.ts';
import {
  estimatedYieldKgAdjusted,
  type Planting,
  type PlanBed,
} from '../lib/crop-plan.ts';
import type { ProductionLog, SalesLog } from '../lib/db/types.ts';
import type { FacilitatorDesignState } from '../lib/facilitator-design.ts';

const NOW = new Date('2026-01-15T12:00:00Z');
const BEDS: PlanBed[] = [
  { id: 'bed-a', label: 'Bed A', areaM2: 100, minDimM: 10 },
  { id: 'bed-b', label: 'Bed B', areaM2: 100, minDimM: 10 },
];

function planting(
  id: string,
  cropKey: string,
  bedId: string,
  overrides: Partial<Planting> = {},
): Planting {
  return { id, cropKey, bedId, sowMonth: 1, ...overrides };
}

function production(
  id: string,
  crop: string,
  kg: number,
  loggedAt = '2026-01-10T12:00:00Z',
): ProductionLog {
  return {
    id,
    crop,
    kg,
    logged_at: loggedAt,
    created_at: loggedAt,
    profile_id: 'farmer',
    garden_id: 'garden',
    photo_url: null,
  };
}

function sale(
  id: string,
  crop: string,
  kg: number,
  soldAt = '2026-01-10T12:00:00Z',
): SalesLog {
  return {
    id,
    crop,
    kg,
    sold_at: soldAt,
    created_at: soldAt,
    profile_id: 'farmer',
    garden_id: 'garden',
    amount: 0,
    buyer: null,
  };
}

function everyNumber(result: ReconciliationResult): number[] {
  return [
    ...result.matched.flatMap((row) => [
      row.intendedKg,
      row.harvestedKg,
      row.soldKg,
      row.unaccountedKg,
    ]),
    ...result.notYetHarvested.flatMap((row) => [
      row.intendedKg,
      row.harvestedKg,
      row.soldKg,
      row.unaccountedKg,
    ]),
    ...result.unmatchedPlanned.flatMap((row) => [
      row.intendedKg,
      row.harvestedKg,
      row.soldKg,
      row.unaccountedKg,
    ]),
    ...result.unplannedActivity.flatMap((row) => [
      row.harvestedKg,
      row.soldKg,
    ]),
  ];
}

test('spreading a harvest across months preserves each planting total exactly once', () => {
  const plantings = [
    planting('lettuce-a', 'lettuce', 'bed-a'),
    planting('chard-b', 'swiss-chard', 'bed-b', { areaFraction: 0.5 }),
  ];
  const intended = intendedKgByMonthPerCrop(plantings, BEDS);

  for (const p of plantings) {
    const bed = BEDS.find((candidate) => candidate.id === p.bedId);
    assert.ok(bed);
    const expected = estimatedYieldKgAdjusted(p, bed.areaM2, plantings);
    const cropMonths = intended.get(p.cropKey);
    assert.ok(cropMonths);
    assert.equal(cropMonths.slice(1).reduce((sum, kg) => sum + kg, 0), expected);
  }
});

test('one crop surplus never averages away another crop shortfall', () => {
  const plantings = [
    planting('lettuce-a', 'lettuce', 'bed-a'),
    planting('chard-b', 'swiss-chard', 'bed-b'),
  ];
  const lettuceExpected = estimatedYieldKgAdjusted(plantings[0], BEDS[0].areaM2, plantings);
  const chardExpected = estimatedYieldKgAdjusted(plantings[1], BEDS[1].areaM2, plantings);
  const lettuceActual = lettuceExpected / 4;
  const result = buildReconciliation(
    plantings,
    BEDS,
    [
      production('lettuce-log', 'Lettuce', lettuceActual),
      production('chard-log', 'Spinach', chardExpected * 2),
    ],
    [],
    'year',
    NOW,
  );

  const lettuce = result.matched.find((row) => row.cropKey === 'lettuce');
  const chard = result.matched.find((row) => row.cropKey === 'swiss-chard');
  assert.ok(lettuce);
  assert.ok(chard);
  assert.equal(lettuce.intendedKg, lettuceExpected);
  assert.equal(lettuce.harvestedKg, lettuceActual);
  assert.equal(lettuce.yieldGap, true);
  assert.equal(chard.yieldGap, false);
});

test('sales accounting does not overwrite or disguise the harvested shortfall', () => {
  const plantings = [planting('lettuce-a', 'lettuce', 'bed-a')];
  const intended = estimatedYieldKgAdjusted(plantings[0], BEDS[0].areaM2, plantings);
  const harvested = intended / 3;
  const sold = harvested / 4;
  const result = buildReconciliation(
    plantings,
    BEDS,
    [production('harvest', 'Lettuce', harvested)],
    [sale('sale', 'Lettuce', sold)],
    'year',
    NOW,
  );

  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].intendedKg, intended);
  assert.equal(result.matched[0].harvestedKg, harvested);
  assert.equal(result.matched[0].soldKg, sold);
  assert.equal(result.matched[0].unaccountedKg, harvested - sold);
  assert.equal(result.matched[0].yieldGap, true);
});

test('the December-February season includes only the same crossing season', () => {
  assert.deepEqual(monthsForPeriod('season', NOW), [12, 1, 2]);
  const plantings = [planting('lettuce-a', 'lettuce', 'bed-a')];
  const result = buildReconciliation(
    plantings,
    BEDS,
    [
      production('previous-december', 'Lettuce', 3, '2025-12-15T12:00:00Z'),
      production('current-january', 'Lettuce', 5, '2026-01-15T12:00:00Z'),
      production('old-january', 'Lettuce', 100, '2025-01-15T12:00:00Z'),
    ],
    [],
    'season',
    NOW,
  );

  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].harvestedKg, 8);
});

test('invalid weights are ignored instead of erasing valid reconciliation data', () => {
  const plantings = [planting('lettuce-a', 'lettuce', 'bed-a')];
  const invalid = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -5,
  ];
  const result = buildReconciliation(
    plantings,
    BEDS,
    [
      production('valid', 'Lettuce', 7),
      ...invalid.map((kg, index) => production(`invalid-${index}`, 'Lettuce', kg)),
      ...invalid.map((kg, index) => production(`other-${index}`, 'Eggs', kg)),
    ],
    [
      sale('valid-sale', 'Lettuce', 2),
      ...invalid.map((kg, index) => sale(`invalid-sale-${index}`, 'Lettuce', kg)),
    ],
    'year',
    NOW,
  );

  assert.equal(result.matched[0].harvestedKg, 7);
  assert.equal(result.matched[0].soldKg, 2);
  for (const value of everyNumber(result)) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0);
  }
});

test('invalid planting geometry cannot put NaN or negative kg in the result', () => {
  const plantings = [
    planting('valid', 'lettuce', 'bed-a'),
    planting('nan-fraction', 'lettuce', 'bed-a', { areaFraction: Number.NaN }),
    planting('negative-fraction', 'lettuce', 'bed-a', { areaFraction: -1 }),
  ];
  const result = buildReconciliation(plantings, BEDS, [], [], 'year', NOW);
  const rows = [
    ...result.matched,
    ...result.notYetHarvested,
    ...result.unmatchedPlanned,
  ];
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].intendedKg,
    estimatedYieldKgAdjusted(plantings[0], BEDS[0].areaM2, [plantings[0]]),
  );
  for (const value of everyNumber(result)) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0);
  }
});

test('invalid design dimensions fall back to finite positive bed geometry', () => {
  const design = {
    version: 1,
    items: [
      { id: 'negative', type: 'bed', x: 0, y: 0, wM: -4, hM: 2, rotation: 0 },
      { id: 'nan', type: 'hugel', x: 0, y: 0, wM: Number.NaN, hM: 2, rotation: 0 },
    ],
    lines: [],
    sectors: [],
    pxPerM: 1,
    activeLayer: 'planting',
    hiddenLayers: [],
    savedAt: 0,
  } satisfies FacilitatorDesignState;

  for (const bed of bedsFromDesign(design)) {
    assert.ok(Number.isFinite(bed.areaM2));
    assert.ok(bed.areaM2 > 0);
    assert.ok(Number.isFinite(bed.minDimM));
    assert.ok((bed.minDimM ?? 0) > 0);
  }
});

test('crop aliases match exactly, while ambiguous names are never guessed', () => {
  const index = buildCropAliasIndex();
  assert.equal(matchCropKey('Sample — Swiss chard!', index), 'swiss-chard');
  assert.equal(matchCropKey('spinach', index), 'swiss-chard');

  const beanCandidates = matchCropCandidates('beans', index);
  assert.ok(beanCandidates.length > 1);
  assert.equal(matchCropKey('beans', index), null);
});
