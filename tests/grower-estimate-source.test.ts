import test from 'node:test';
import assert from 'node:assert/strict';
import { growerEstimateDensityToCanonical, growerEstimateSourceQuantity,
  normaliseGrowerEstimateSourceReceipt, type GrowerEstimateSourceReceipt } from '../lib/grower-estimate-units.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { assessGrowerPlanning, growerPlanningScopeKey, normaliseGrowerPlanningProfile,
  isGrowerPlanningAssessmentCurrent, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { normaliseGrowerMeasuredAreaInput } from '../lib/international/grower-planning.ts';
import { nurseryDimensionToCanonical } from '../lib/length-units.ts';
import { normaliseGrowerCycleAttachment } from '../lib/international/grower-cycle.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import { generateGrowerAutoPlan, isGrowerAutoPlanCurrent } from '../lib/international/grower-autoplan.ts';

const owner = { scopeKey: 'unmapped-workspace:design:synthetic-workspace', profileId: 'synthetic-profile', cropKey: 'synthetic-crop', field: 'plantsPerM2' as const };
const row = (decimal = '1.2') => ({ ...owner, version: 1, conversion: 'density-si-v1', decimal, unit: 'plants/ft2' });
const canonical = growerEstimateDensityToCanonical(1.2, 'plants/ft2')!;

test('source capture retains the actual entered decimal beyond binary precision and is rebound on reload', () => {
  const source = row('1.20000000000000000001');
  const receipt = normaliseGrowerEstimateSourceReceipt(source, owner, canonical);
  assert.ok(receipt);
  assert.deepEqual(growerEstimateSourceQuantity(receipt), { digits: BigInt('120000000000000000001'), exponent: -20 });
  assert.notEqual(receipt, source);
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(growerEstimateSourceQuantity(receipt)));
  const reloaded = JSON.parse(JSON.stringify(receipt));
  assert.equal(growerEstimateSourceQuantity(reloaded), null, 'JSON alone cannot manufacture the private validation proof');
  const rebound = normaliseGrowerEstimateSourceReceipt(reloaded, owner, canonical);
  assert.ok(rebound);
  assert.deepEqual(growerEstimateSourceQuantity(rebound), growerEstimateSourceQuantity(receipt));
});

test('a source must agree with the exact established projection, kind and current ownership without epsilon', () => {
  assert.equal(normaliseGrowerEstimateSourceReceipt(row(), owner, canonical + Number.EPSILON * canonical), null);
  for (const key of ['scopeKey', 'profileId', 'cropKey', 'field'] as const) {
    assert.equal(normaliseGrowerEstimateSourceReceipt({ ...row(), [key]: 'different' }, owner, canonical), null, key);
  }
  for (const unit of ['kg/m2/cycle', 'lb/ft2/cycle', 'survey-ft2', 'plants/m2']) {
    assert.equal(normaliseGrowerEstimateSourceReceipt({ ...row(), unit }, owner, canonical), null, unit);
  }
  for (const value of [NaN, Infinity, -1]) assert.equal(normaliseGrowerEstimateSourceReceipt(row(), owner, value), null);
});

test('shared plain decimal grammar owns source admission, including a complete trailing separator', () => {
  for (const decimal of ['1.2', '1,2', '+1.2', ' 1.2 ', '01.20']) {
    const receipt = normaliseGrowerEstimateSourceReceipt(row(decimal), owner, canonical);
    assert.ok(receipt, decimal);
    assert.equal(receipt.decimal, decimal);
  }
  const two = growerEstimateDensityToCanonical(2, 'plants/ft2')!;
  assert.ok(normaliseGrowerEstimateSourceReceipt(row('2.'), owner, two));
  for (const decimal of ['', ' ', '.', '-', '1,000.2', '1e3', '1/2', '-1.2', `0.${'0'.repeat(400)}1`]) {
    assert.equal(normaliseGrowerEstimateSourceReceipt(row(decimal), owner, canonical), null, decimal);
  }
  for (const decimal of ['0', '-0', '0,0']) {
    const receipt = normaliseGrowerEstimateSourceReceipt(row(decimal), owner, 0);
    assert.ok(receipt);
    assert.equal(growerEstimateSourceQuantity(receipt)?.digits, BigInt(0));
  }
});

test('malformed, oversized or accessor-bearing receipts cannot execute getters or silently become valid source', () => {
  let calls = 0;
  const accessor = { ...row() };
  Object.defineProperty(accessor, 'decimal', { enumerable: true, get() { calls++; return '1.2'; } });
  const symbol = Symbol('hidden');
  for (const source of [null, [], { ...row(), version: 2 }, { ...row(), conversion: 'unknown' }, { ...row(), extra: true },
    { ...row(), [symbol]: true }, accessor, row('1.' + '0'.repeat(1024)), { ...row(), decimal: undefined }]) {
    assert.equal(normaliseGrowerEstimateSourceReceipt(source, owner, canonical), null);
  }
  assert.equal(calls, 0);
  assert.equal(growerEstimateSourceQuantity(row() as GrowerEstimateSourceReceipt), null);
});

const recordedAt = '2026-11-04T00:00:00.000Z';
function provided<T, U extends string>(value: T, unit: U): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } };
}
function profile(): GrowerPlanningProfile {
  return { version: 1, profileId: owner.profileId, cropKey: CROPS[0].key,
    // A synthetic design still uses the real workspace identity grammar.
    scope: { kind: 'unmapped-workspace', workspaceId: 'design:synthetic-workspace' },
    inputs: { plantsPerM2: provided(canonical, 'plants/m2'), yieldKgPerM2: provided(1, 'kg/m2/cycle'),
      establishment: provided('direct', 'method'), nurseryDays: { state: 'missing', reason: 'not-applicable' },
      fieldEntryToFirstHarvestDays: provided(1, 'days'), pickingDays: provided(1, 'days'),
      fieldOccupancyDays: provided(2, 'days'), turnaroundDays: provided(0, 'days'), allowedEntryMonths: provided([2], 'utc-months') } };
}
function profileSource(value: GrowerPlanningProfile, decimal = '1.2') {
  return { ...row(decimal), scopeKey: growerPlanningScopeKey(value.scope)!, profileId: value.profileId, cropKey: value.cropKey };
}

test('the one profile normalizer preserves valid source metadata and rejects present corruption rather than borrowing legacy semantics', () => {
  const original = profile();
  assert.deepEqual(normaliseGrowerPlanningProfile(original), original, 'genuine legacy absence remains absence');
  const source = profileSource(original);
  const normal = normaliseGrowerPlanningProfile({ ...original, exactDensitySources: { plantsPerM2: source } });
  assert.ok(normal?.exactDensitySources?.plantsPerM2);
  assert.deepEqual(normal.exactDensitySources.plantsPerM2, source);
  assert.ok(growerEstimateSourceQuantity(normal.exactDensitySources.plantsPerM2));
  assert.deepEqual(normaliseGrowerPlanningProfile(JSON.parse(JSON.stringify(normal))), normal);
  for (const exactDensitySources of [undefined, null, {}, [], { plantsPerM2: null }, { plantsPerM2: undefined },
    { plantsPerM2: { ...source, profileId: 'different' } }, { plantsPerM2: { ...source, decimal: '9' } },
    { plantsPerM2: source, unknown: source }, { yieldKgPerM2: source }]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...original, exactDensitySources }), null);
  }
  assert.equal(normaliseGrowerPlanningProfile({ ...original, exactDensitySources: { plantsPerM2: source },
    inputs: { ...original.inputs, plantsPerM2: { state: 'missing', reason: 'not-entered' } } }), null);
});

test('source digits participate in the real assessment fingerprint even when their numeric canonical projection is identical', () => {
  const original = profile();
  const request = (decimal: string) => ({ profile: { ...original, exactDensitySources: { plantsPerM2: profileSource(original, decimal) } },
    scope: original.scope, measuredAreaM2: provided(1, 'm2'), fieldEntryDate: provided('2028-02-01', 'utc-date') });
  const left = assessGrowerPlanning(request('1.2')), right = assessGrowerPlanning(request('1.20000000000000000001'));
  assert.equal(left.status, 'ready'); assert.equal(right.status, 'ready');
  assert.notEqual(left.fingerprint, right.fingerprint, 'canonical-value equality cannot bless changed original source digits');
});

test('real assessment floors source density before Number conversion and never invents old imperial origin', () => {
  // Engineering fixtures only. These are not crop density recommendations.
  for (const [areaFt2, densityText, expected] of [[11, '5', 55], [2.5, '1.2', 3], [1, '13', 13]] as const) {
    const value = profile(), density = growerEstimateDensityToCanonical(Number(densityText), 'plants/ft2')!;
    const candidate = { ...value, inputs: { ...value.inputs, plantsPerM2: provided(density, 'plants/m2') },
      exactDensitySources: { plantsPerM2: profileSource(value, densityText) } };
    const request = { profile: candidate, scope: value.scope,
      measuredAreaM2: provided(nurseryDimensionToCanonical(areaFt2, 'ft2')!, 'm2'), fieldEntryDate: provided('2028-02-01', 'utc-date') };
    const result = assessGrowerPlanning(request);
    assert.equal(result.status, 'ready');
    if (result.status === 'ready') assert.equal(result.capacity.estimatedPlantCount, expected);
    const legacy = assessGrowerPlanning({ ...request, profile: { ...value, inputs: candidate.inputs } });
    assert.equal(legacy.status, 'ready');
    if (areaFt2 === 2.5 && legacy.status === 'ready') assert.equal(legacy.capacity.estimatedPlantCount, 2, 'declared canonical decimals below three have no original feet receipt');
  }
});

test('legacy canonical decimal semantics fix both integer boundaries without snapping a real fractional remainder upward', () => {
  for (const [area, density, expected] of [[0.58, 100, 58], [0.75, 1.3333333333333333, 0], [0.58, 99.99999999999999, 57]] as const) {
    const value = profile(), result = assessGrowerPlanning({ profile: { ...value, inputs: { ...value.inputs, plantsPerM2: provided(density, 'plants/m2') } },
      scope: value.scope, measuredAreaM2: provided(area, 'm2'), fieldEntryDate: provided('2028-02-01', 'utc-date') });
    assert.equal(result.status, 'ready');
    if (result.status === 'ready') assert.equal(result.capacity.estimatedPlantCount, expected);
  }
});

test('reviews and saved cycle markers made under float arithmetic cannot silently inherit the new count semantics', () => {
  const value = profile(), request = { profile: value, scope: value.scope, measuredAreaM2: provided(1, 'm2'), fieldEntryDate: provided('2028-02-01', 'utc-date') };
  const result = assessGrowerPlanning(request); assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  const { countArithmetic: _newSemantics, ...oldSnapshot } = result.snapshot;
  const oldFingerprint = JSON.stringify(oldSnapshot);
  assert.equal(isGrowerPlanningAssessmentCurrent({ ...result, fingerprint: oldFingerprint }, request), false);
  assert.equal(normaliseGrowerCycleAttachment({ kind: 'grower-dated-cycle', version: 1, plantingId: 'synthetic-planting', cycleId: 'synthetic-cycle',
    demandId: 'synthetic-demand', bedId: 'synthetic-bed', acceptedAt: recordedAt, geometryFingerprint: 'synthetic-geometry',
    assessmentSnapshot: oldSnapshot, assessmentFingerprint: oldFingerprint }), null);
});

test('the automatic proposal currentness check also rejects an outer review without the new counting semantics', () => {
  const value = profile(), scope = value.scope;
  const request = { requestedAt: recordedAt, scope, geometryFingerprint: 'synthetic-geometry', profiles: [value],
    beds: [{ scope, bed: { id: 'synthetic-bed', label: 'Synthetic bed', areaM2: 1 }, measuredAreaM2: provided(1, 'm2') }],
    planningStart: provided('2028-02-01', 'utc-date'), planningEndExclusive: provided('2028-02-05', 'utc-date'), reserved: [],
    availability: [{ bedId: 'synthetic-bed', scope, window: provided({ start: '2028-02-01', endExclusive: '2028-02-05' }, 'utc-date-window') }],
    demands: [{ demandId: 'synthetic-demand', profileId: value.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: '2028-02-02', endExclusive: '2028-02-05' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request);
  assert.ok(proposal.status === 'ready' || proposal.status === 'with-gaps');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') return;
  assert.equal(isGrowerAutoPlanCurrent(proposal, request), true);
  const oldSnapshot = Object.fromEntries(Object.entries(proposal.snapshot).filter(([key]) => key !== 'countArithmetic'));
  assert.equal(isGrowerAutoPlanCurrent({ ...proposal, fingerprint: JSON.stringify(oldSnapshot) }, request), false,
    'unchanged inputs do not prove a review made before the arithmetic change is current');
});

test('a present area arithmetic basis must reproduce the actual numeric projection and cannot execute accessor fields', () => {
  const area = provided(0.58, 'm2'), arithmeticBasis = { kind: 'saved-rectangle-metres-v1', widthM: 0.58, heightM: 1 };
  assert.deepEqual(normaliseGrowerMeasuredAreaInput({ ...area, arithmeticBasis }), { ...area, arithmeticBasis });
  let calls = 0;
  const accessor = { ...arithmeticBasis };
  Object.defineProperty(accessor, 'widthM', { enumerable: true, get() { calls++; return 0.58; } });
  for (const value of [null, undefined, {}, { ...arithmeticBasis, widthM: 0.6 }, { ...arithmeticBasis, widthM: Infinity },
    { ...arithmeticBasis, widthM: 0 }, { ...arithmeticBasis, widthM: Number.MIN_VALUE, heightM: Number.MIN_VALUE },
    { ...arithmeticBasis, kind: 'original-feet-guessed' }, { ...arithmeticBasis, extra: 1 }, accessor]) {
    assert.equal(normaliseGrowerMeasuredAreaInput({ ...area, arithmeticBasis: value }), null);
  }
  assert.equal(normaliseGrowerMeasuredAreaInput({ state: 'missing', reason: 'not-entered', arithmeticBasis }), null);
  // Direct callers must hold the same inherited marker that the saved-source
  // workflow holds, rather than silently switching capacity arithmetic.
  const inherited = Object.assign(Object.create({ arithmeticBasis }), area);
  assert.equal(normaliseGrowerMeasuredAreaInput(inherited), null);
  const inheritedAccessor = Object.assign(Object.create(Object.defineProperty({}, 'arithmeticBasis', {
    get() { calls++; return arithmeticBasis; },
  })), area);
  assert.equal(normaliseGrowerMeasuredAreaInput(inheritedAccessor), null);
  assert.equal(calls, 0);
});

test('actual measured source and automatic planner use unrounded bed dimensions without changing legacy display or saved geometry', async () => {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = 'site:0.00000,0.00000'; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [{ ...bed, id: 'synthetic-small-bed', wM: 0.58, hM: 1 }]; canvas.zones = []; canvas.lines = [];
  const before = JSON.stringify(canvas);
  assert.equal(bedsFromDesignCanvas(canvas)[0].areaM2, 0.6, 'the unchanged legacy display path is a meaningful rounding control');
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId,
    raw: canvas, sourceRevision: before }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') return;
  assert.equal(source.beds[0].areaM2, 0.58);
  assert.deepEqual(source.measuredAreas[0].arithmeticBasis, { kind: 'saved-rectangle-metres-v1', widthM: 0.58, heightM: 1 });
  const scope = source.scope, value = profile();
  const planningProfile = { ...value, scope, inputs: { ...value.inputs, plantsPerM2: provided(100, 'plants/m2') } };
  const target = { id: 'synthetic-target', siteId: source.resourceSiteId, cropKey: value.cropKey,
    startMonth: '2028-02', endMonth: '2028-02', weeklyKg: 0.07, marketablePercent: 100 };
  const input: Parameters<typeof assembleGrowerWorkflowReview>[0] = { scope, source, recordedAt,
    book: { version: 1, plantings: [], growerPlanningProfiles: [planningProfile], harvestTargets: [target], updatedAt: 1 },
    draft: { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000', assumptionsConfirmed: true,
      targetProfiles: [{ targetId: target.id, profileId: value.profileId }], available: [{ bedId: source.beds[0].id,
        start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true }] } };
  const review = assembleGrowerWorkflowReview(input);
  assert.equal(review.status, 'review'); if (review.status !== 'review') return;
  assert.ok(review.proposal.cycles.length > 0);
  assert.equal(review.proposal.cycles[0].assessment.capacity.estimatedPlantCount, 58);
  assert.deepEqual(review.proposal.cycles[0].assessment.snapshot.measuredAreaM2.arithmeticBasis, source.measuredAreas[0].arithmeticBasis);
  assert.equal(review.proposal.sourceVerification, 'not-verified');
  assert.equal(JSON.stringify(canvas), before, 'no saved geometry or measurements are rewritten');
  // These are deliberately damaged pure inputs, not a claim that the actual
  // source inspector or live account checks produced this metadata.
  for (const arithmeticBasis of [null, undefined, false, { kind: 'saved-rectangle-metres-v1', widthM: 0.6, heightM: 1 }]) {
    const damaged = { ...source, measuredAreas: source.measuredAreas.map(row => ({ ...row, arithmeticBasis })) };
    const result = assembleGrowerWorkflowReview({ ...input, source: damaged as typeof source });
    assert.equal(result.status, 'held'); assert.ok(result.issues.includes('source-measures-invalid'));
  }
  const moved = structuredClone(canvas); moved.items[0].wM = 0.29; moved.items[0].hM = 2;
  const changed = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: moved.siteId,
    raw: moved, sourceRevision: JSON.stringify(moved) }));
  assert.equal(changed.status, 'ready');
  if (changed.status === 'ready') { assert.equal(changed.beds[0].areaM2, source.beds[0].areaM2); assert.notEqual(changed.geometryFingerprint, source.geometryFingerprint); }
});

test('saved dimension factors are floored exactly even when their numeric area projection rounded a sub-integer upward', () => {
  const value = profile(), widthM = 0.75, heightM = 1.3333333333333333;
  assert.equal(widthM * heightM, 1, 'the intermediate Number really erases the fractional boundary');
  const result = assessGrowerPlanning({ profile: { ...value, inputs: { ...value.inputs, plantsPerM2: provided(1, 'plants/m2') } }, scope: value.scope,
    measuredAreaM2: { ...provided(1, 'm2'), arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM, heightM } },
    fieldEntryDate: provided('2028-02-01', 'utc-date') });
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.capacity.estimatedPlantCount, 0);
});
