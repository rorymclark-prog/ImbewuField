import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bedsFromDesign,
  buildCropAliasIndex,
  buildReconciliation,
  intendedKgByCropCycle,
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
      ...(row.intendedKg === null ? [] : [row.intendedKg]),
      row.harvestedKg,
      row.soldKg,
      ...(row.keptKg === null ? [] : [row.keptKg]),
    ]),
    ...result.notYetHarvested.flatMap((row) => [
      ...(row.intendedKg === null ? [] : [row.intendedKg]),
      row.harvestedKg,
      row.soldKg,
      ...(row.keptKg === null ? [] : [row.keptKg]),
    ]),
    ...result.unmatchedPlanned.flatMap((row) => [
      ...(row.intendedKg === null ? [] : [row.intendedKg]),
      row.harvestedKg,
      row.soldKg,
      ...(row.keptKg === null ? [] : [row.keptKg]),
    ]),
    ...result.unplannedActivity.flatMap((row) => [
      row.harvestedKg,
      row.soldKg,
    ]),
  ];
}

test('crop-cycle benchmarks preserve each planting total without inventing monthly shares', () => {
  const plantings = [
    planting('lettuce-a', 'lettuce', 'bed-a'),
    planting('chard-b', 'swiss-chard', 'bed-b', { areaFraction: 0.5 }),
  ];
  const intended = intendedKgByCropCycle(plantings, BEDS);

  for (const p of plantings) {
    const bed = BEDS.find((candidate) => candidate.id === p.bedId);
    assert.ok(bed);
    const expected = estimatedYieldKgAdjusted(p, bed.areaM2, plantings);
    assert.equal(intended.get(p.cropKey), expected);
  }
});

test('an unresolved shared-bed layout withholds reconciliation benchmark kg through the plan authority', () => {
  const plantings = [
    planting('legacy-maize', 'maize', 'bed-a', { sowMonth: 11, existing: true }),
    planting('carrots', 'carrots', 'bed-a', { sowMonth: 3 }),
  ];

  assert.deepEqual(
    [...intendedKgByCropCycle(plantings, BEDS)],
    [],
    'unknown maize timing cannot become zero overlap and grant both crops a full-bed benchmark',
  );

  const result = buildReconciliation(
    plantings,
    BEDS,
    [production('carrot-log', 'Carrots', 5)],
    [],
    'year',
    NOW,
  );
  assert.equal(result.matched.length, 1, 'actual records remain visible when planning kg is withheld');
  assert.equal(result.matched[0].cropKey, 'carrots');
  assert.equal(result.matched[0].intendedKg, null);
  assert.deepEqual(result.notYetHarvested, []);
});

test('month and season reconciliation expose no intended kg when sources only give crop-cycle totals', () => {
  const onions = [planting('onion-a', 'onions', 'bed-a', { sowMonth: 4 })];
  for (const period of ['month', 'season'] as const) {
    const result = buildReconciliation(
      onions,
      BEDS,
      [production(`${period}-harvest`, 'Onions', 3)],
      [],
      period,
      NOW,
    );
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].intendedKg, null);
    assert.equal(result.matched[0].harvestedKg, 3, 'actual logs remain available');
    assert.equal(result.matched[0].yieldGap, false, 'no monthly allocation means no partial-period gap claim');
  }
});

test('partial-period views never create an expected-yield row when nothing was logged', () => {
  const plantings = [planting('chard-a', 'swiss-chard', 'bed-a', { sowMonth: 9 })];
  for (const period of ['month', 'season'] as const) {
    const result = buildReconciliation(plantings, BEDS, [], [], period, NOW);
    assert.deepEqual(result, {
      matched: [],
      notYetHarvested: [],
      unmatchedPlanned: [],
      unplannedActivity: [],
    });
  }
});

test('annual view keeps each crop-cycle benchmark separate without calling a partial cycle a shortfall', () => {
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
  assert.equal(lettuce.yieldGap, false, 'the planting has no dated completed-cycle marker');
  assert.equal(chard.yieldGap, false);
});

test('sales accounting stays separate from a non-date-aligned crop-cycle benchmark', () => {
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
  assert.equal(result.matched[0].keptKg, harvested - sold);
  assert.equal(result.matched[0].yieldGap, false);
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

test('invalid planting geometry withholds the bed benchmark instead of salvaging a partial total', () => {
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
  assert.equal(rows.length, 0, 'an invalid share makes the whole bed allocation unresolved');
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
      { id: 'overflow', type: 'bed', x: 0, y: 0, wM: Number.MAX_VALUE, hM: Number.MAX_VALUE, rotation: 0 },
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

test('one persisted log id contributes once even when local and remote copies repeat it', () => {
  const plantings = [planting('lettuce-a', 'lettuce', 'bed-a')];
  const harvest = production('same-harvest', 'Lettuce', 7);
  const sold = sale('same-sale', 'Lettuce', 2);
  const result = buildReconciliation(
    plantings,
    BEDS,
    [harvest, { ...harvest }, production('different-harvest', 'Lettuce', 3)],
    [sold, { ...sold }, sale('different-sale', 'Lettuce', 1)],
    'year',
    NOW,
  );

  assert.equal(result.matched[0].harvestedKg, 10);
  assert.equal(result.matched[0].soldKg, 3);
});

test('overflowing log totals and malformed crop labels remain finite and visible', () => {
  const malformed = production('unnamed', 'placeholder', 4);
  malformed.crop = null as unknown as string;
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [
      production('huge-one', 'Lettuce', Number.MAX_VALUE),
      production('huge-two', 'Lettuce', Number.MAX_VALUE),
      malformed,
    ],
    [],
    'year',
    NOW,
  );

  assert.ok(Number.isFinite(result.matched[0].harvestedKg));
  assert.equal(result.unplannedActivity[0].label, 'Unnamed');
  assert.equal(result.unplannedActivity[0].harvestedKg, 4);
  assert.ok(everyNumber(result).every(Number.isFinite));
});

test('an invalid clock cannot invent intended activity for an arbitrary season', () => {
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [production('harvest', 'Lettuce', 7)],
    [],
    'season',
    new Date(Number.NaN),
  );
  assert.deepEqual(monthsForPeriod('season', new Date(Number.NaN)), []);
  assert.deepEqual(result, {
    matched: [],
    notYetHarvested: [],
    unmatchedPlanned: [],
    unplannedActivity: [],
  });
});

test('crop aliases match exactly, while ambiguous names are never guessed', () => {
  const index = buildCropAliasIndex();
  assert.equal(matchCropKey('Sample — Swiss chard!', index), 'swiss-chard');
  assert.equal(matchCropKey('spinach', index), 'swiss-chard');

  const beanCandidates = matchCropCandidates('beans', index);
  assert.ok(beanCandidates.length > 1);
  assert.equal(matchCropKey('beans', index), null);
});

/* ── Selling more than you logged picking ────────────────────────────────────
   The clamp these replace failed in the direction that mattered. Measured against
   the sample books with the harvest log at 30% — the common case, because money is
   memorable and picking is not — the app told a subsistence farmer she had kept
   0.5 kg when the honest figure was 10.5 kg, and fired four "the plan expected X,
   you only got Y" warnings blaming her for a logging artefact. */

test('kept is unknown, not zero, when more was sold than logged as harvested', () => {
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [production('harvest', 'Lettuce', 9)],
    [sale('sale', 'Lettuce', 37.5)],
    'year',
    NOW,
  );

  assert.equal(result.matched.length, 1);
  const row = result.matched[0];
  assert.equal(row.soldExceedsHarvested, true);
  assert.equal(row.keptKg, null, 'a clamp would report 0 kg kept here, which is a confident lie');
  assert.equal(row.keptGap, false, 'no kept figure means nothing to explain');
});

test('neither incomplete books nor an undated cycle can be evidence the plan was missed', () => {
  // Same rows as above. The old code raised a yield gap because harvestedKg (9) sits far below
  // the crop-cycle benchmark — true arithmetic, false accusation: the harvest total is missing
  // rows and the planting has no dated completion marker.
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [production('harvest', 'Lettuce', 9)],
    [sale('sale', 'Lettuce', 37.5)],
    'year',
    NOW,
  );

  const row = result.matched[0];
  assert.ok(row.intendedKg !== null && row.intendedKg > row.harvestedKg, 'the arithmetic gap is real');
  assert.equal(row.yieldGap, false, 'but it is withheld while the harvest log is provably short');
});

test('nothing logged as harvested, sales complete: still unknown, never zero', () => {
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [],
    [sale('sale', 'Lettuce', 37.5)],
    'year',
    NOW,
  );

  const row = result.matched[0];
  assert.equal(row.harvestedKg, 0);
  assert.equal(row.soldExceedsHarvested, true);
  assert.equal(row.keptKg, null);
  assert.equal(row.yieldGap, false);
});

test('both books complete: kept is a real number and the flag stays down', () => {
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [production('harvest', 'Lettuce', 48)],
    [sale('sale', 'Lettuce', 37.5)],
    'year',
    NOW,
  );

  const row = result.matched[0];
  assert.equal(row.soldExceedsHarvested, false);
  assert.equal(row.keptKg, 10.5, 'harvested minus sold, stated plainly');
});

test('selling exactly what you harvested is complete books, not an unknown', () => {
  const result = buildReconciliation(
    [planting('lettuce-a', 'lettuce', 'bed-a')],
    BEDS,
    [production('harvest', 'Lettuce', 20)],
    [sale('sale', 'Lettuce', 20)],
    'year',
    NOW,
  );

  const row = result.matched[0];
  assert.equal(row.soldExceedsHarvested, false, 'equal is not "more sold than harvested"');
  assert.equal(row.keptKg, 0, 'kept really is zero here, and saying so is correct');
});
