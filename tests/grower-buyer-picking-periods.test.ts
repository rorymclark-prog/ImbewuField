import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import {
  addGrowerUtcDays, type GrowerInput, type GrowerPlanningInputs, type GrowerPlanningProfile,
} from '../lib/international/grower-planning.ts';
import {
  generateGrowerAutoPlan, GROWER_AUTOPLAN_MAX_ASSESSMENTS,
  type GrowerAutoPlanDemand, type GrowerAutoPlanRequest,
} from '../lib/international/grower-autoplan.ts';
import {
  assembleGrowerWorkflowReview, type GrowerWorkflowReview, type GrowerWorkflowTargetMetadata,
} from '../lib/international/grower-workflow.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { growerDemandFromEnteredEntry } from '../lib/international/grower-entered-demand.ts';
import {
  projectGrowerBuyerPickingPeriods, growerDemandFromHarvestTarget,
  GROWER_BUYER_PICKING_PERIOD_DAYS, GROWER_BUYER_PICKING_MAX_OPERATIONS,
} from '../lib/international/grower-harvest-demand.ts';

// Synthetic arithmetic/date fixtures only; no input below is a growing recommendation.
const recordedAt = '2026-11-05T12:00:00.000Z';
const scope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } as const;
const missing = { state: 'missing', reason: 'not-entered' } as const;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> =>
  ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt, note: 'Engineering fixture only.' } });
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
const basis = { basis: 'proposed-picking-window-overlap', deliveryDistribution: 'not-established', sourceVerification: 'not-verified' };
function profile(inputs: Partial<GrowerPlanningInputs> = {}, profileId = 'profile-a'): GrowerPlanningProfile {
  return { version: 1, profileId, cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(2, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'),
    allowedEntryMonths: own([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'utc-months'), ...inputs,
  } };
}
function demand(demandId = 'buyer-a', totalKg = 6, start = '2028-02-01', endExclusive = '2028-03-01', profileId = 'profile-a'): GrowerAutoPlanDemand {
  return { demandId, profileId, scope, totalKg: own(totalKg, 'kg-total'),
    harvestWindow: own({ start, endExclusive }, 'utc-date-window') };
}
function request(patch: Partial<GrowerAutoPlanRequest> = {}): GrowerAutoPlanRequest {
  const bed = { id: 'engineering-bed', label: 'Engineering bed', areaM2: 3, kind: 'bed' as const };
  return { requestedAt: recordedAt, scope, geometryFingerprint: 'engineering-geometry-v1', profiles: [profile()],
    beds: [{ scope, bed, measuredAreaM2: own(3, 'm2') }],
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-01', 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-01' }, 'utc-date-window') }],
    reserved: [], demands: [demand()], maxAssessments: 1000, ...patch };
}
function targetMetadata(row: GrowerAutoPlanDemand): GrowerWorkflowTargetMetadata {
  assert.equal(row.totalKg.state, 'provided');
  if (row.totalKg.state !== 'provided') assert.fail('This fixture explicitly supplies its total');
  const days = row.harvestWindow.state === 'provided'
    ? (Date.parse(row.harvestWindow.value.endExclusive) - Date.parse(row.harvestWindow.value.start)) / 86400000 : 0;
  return { targetId: row.demandId, profileId: row.profileId, buyerTotalKg: row.totalKg.value,
    grossCapacityRequiredKg: row.totalKg.value, days, saleablePercent: 100,
    deliveryDistribution: 'not-established', sourceVerification: 'not-verified' };
}
function review(input = request(), buyers: readonly GrowerWorkflowTargetMetadata[] = input.demands.map(targetMetadata)): Review {
  const proposal = generateGrowerAutoPlan(input);
  return { status: 'review', recordedAt, request: input, proposal, targetMetadata: [...buyers],
    issues: [], blockedBeds: [], existingOwnCycles: [] };
}
function ready(value: unknown) {
  const result = projectGrowerBuyerPickingPeriods(value);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  if (result.status !== 'ready') assert.fail('The canonical usable engineering review must project');
  assert.equal(result.periodDays, 7);
  assert.equal(result.deliveryDistribution, 'not-established');
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(result.basis, 'proposed-picking-window-overlap');
  return result;
}
function held(value: unknown, reason?: string) {
  const result = projectGrowerBuyerPickingPeriods(value);
  assert.equal(result.status, 'held');
  if (result.status !== 'held') assert.fail('An unusable review cannot establish picking gaps');
  if (reason) assert.ok(result.reasons.includes(reason), JSON.stringify(result));
  assert.equal(Object.hasOwn(result, 'buyers'), false, 'a held report contains no surviving partial gap conclusions');
  assert.equal(result.basis, 'proposed-picking-window-overlap');
  assert.equal(result.deliveryDistribution, 'not-established');
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.reasons), true);
  return result;
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] { assert.ok(Array.isArray(value)); return value; }
function deepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    assert.ok(Object.hasOwn(descriptor, 'value'));
    deepFrozen(descriptor.value);
  }
}
async function assembledBuyer() {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = scope.siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const first = canvas.items.find(item => item.defId === 'veg_bed'); assert.ok(first);
  canvas.items = [{ ...first, id: 'assembled-engineering-bed', x: 0.5, wM: 3, hM: 4 }];
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas',
    sourceId: scope.siteId, raw: canvas, sourceRevision: 'engineering-source-receipt' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') assert.fail('The synthetic saved source is ready');
  const estimate = profile({ yieldKgPerM2: own(1, 'kg/m2/cycle'), fieldEntryToFirstHarvestDays: own(1, 'days'),
    fieldOccupancyDays: own(3, 'days'), allowedEntryMonths: own([2], 'utc-months') });
  const target: HarvestTarget = { id: 'buyer-a', siteId: scope.siteId, cropKey: estimate.cropKey,
    weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02', marketablePercent: 100 };
  const book: CropPlanState = { version: 1, updatedAt: 123, plantings: [],
    growerPlanningProfiles: [estimate], harvestTargets: [target] };
  const draft = { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: target.id, profileId: estimate.profileId }],
    available: source.beds.map(bed => ({ bedId: bed.id, start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true })),
    assumptionsConfirmed: true };
  const result = assembleGrowerWorkflowReview({ scope, source, book, draft, recordedAt });
  assert.equal(result.status, 'review');
  if (result.status !== 'review') assert.fail('The actual workflow assembler accepts the engineering records');
  return { result, target, estimate, book };
}

test('whole-window capacity covered by an actual assembled workflow can still leave later reporting periods without picking dates', async () => {
  const f = await assembledBuyer(), before = JSON.stringify(f.book);
  assert.equal(f.result.proposal.status, 'ready');
  assert.equal(f.result.proposal.demandResults[0].status, 'capacity-covered');
  const report = ready(f.result);
  assert.equal(report.buyers.length, 1);
  const buyer = report.buyers[0];
  assert.equal(buyer.targetId, f.target.id);
  assert.deepEqual(buyer.periods.map(period => [period.start, period.endExclusive]), [
    ['2028-02-01', '2028-02-08'], ['2028-02-08', '2028-02-15'], ['2028-02-15', '2028-02-22'],
    ['2028-02-22', '2028-02-29'], ['2028-02-29', '2028-03-01'],
  ]);
  assert.equal(buyer.periods[0].status, 'picking-window-present');
  assert.ok(buyer.periods.slice(2).every(period => period.status === 'no-proposed-picking-window'));
  assert.equal(JSON.stringify(f.book), before);
  assert.equal(report.deliveryDistribution, 'not-established');
});

test('the exported seven-day and reporting-work limits remain reporting/software bounds', () => {
  assert.equal(GROWER_BUYER_PICKING_PERIOD_DAYS, 7);
  assert.equal(GROWER_BUYER_PICKING_MAX_OPERATIONS, GROWER_AUTOPLAN_MAX_ASSESSMENTS);
});

test('overlap dates are clipped exactly at reporting boundaries and a short final period is retained', () => {
  const input = request({ profiles: [profile({ fieldEntryToFirstHarvestDays: own(0, 'days'), pickingDays: own(10, 'days'),
    fieldOccupancyDays: own(10, 'days'), turnaroundDays: own(0, 'days') })],
    demands: [demand('buyer-a', 6, '2028-02-01', '2028-02-20')] });
  const current = review(input), report = ready(current), cycle = current.proposal.cycles[0];
  assert.deepEqual(report.buyers[0].periods, [
    { start: '2028-02-01', endExclusive: '2028-02-08', status: 'picking-window-present',
      overlaps: [{ cycleId: cycle.cycleId, bedId: cycle.bedId, start: '2028-02-01', endExclusive: '2028-02-08' }] },
    { start: '2028-02-08', endExclusive: '2028-02-15', status: 'picking-window-present',
      overlaps: [{ cycleId: cycle.cycleId, bedId: cycle.bedId, start: '2028-02-08', endExclusive: '2028-02-11' }] },
    { start: '2028-02-15', endExclusive: '2028-02-20', status: 'no-proposed-picking-window', overlaps: [] },
  ]);
});

test('a picking interval ending at a period start does not leak through its exclusive boundary', () => {
  const current = review(request({ profiles: [profile({ fieldEntryToFirstHarvestDays: own(0, 'days'), pickingDays: own(7, 'days'),
    fieldOccupancyDays: own(20, 'days') })], demands: [demand('buyer-a', 6, '2028-02-01', '2028-02-22')] }));
  const report = ready(current);
  assert.equal(current.proposal.cycles[0].assessment.schedule.fieldClearDate, '2028-02-21');
  assert.deepEqual(report.buyers[0].periods.map(period => period.status), [
    'picking-window-present', 'no-proposed-picking-window', 'no-proposed-picking-window',
  ]);
  assert.deepEqual(report.buyers[0].periods[1].overlaps, [], 'field occupancy and clearing dates are not picking dates');
});

test('exact target-start anchoring handles leap days and year boundaries without Monday assumptions', () => {
  for (const [start, endExclusive, bins] of [
    ['2028-02-26', '2028-03-05', [['2028-02-26', '2028-03-04'], ['2028-03-04', '2028-03-05']]],
    ['2027-12-29', '2028-01-12', [['2027-12-29', '2028-01-05'], ['2028-01-05', '2028-01-12']]],
  ] as const) {
    const input = request({ planningStart: own(start, 'utc-date'), planningEndExclusive: own(endExclusive, 'utc-date'),
      availability: [{ bedId: 'engineering-bed', scope, window: own({ start, endExclusive }, 'utc-date-window') }],
      demands: [demand('buyer-a', 6, start, endExclusive)] });
    assert.deepEqual(ready(review(input)).buyers[0].periods.map(period => [period.start, period.endExclusive]), bins);
  }
});

test('a short final reporting bin clips at the valid UTC date-domain end before taking an out-of-domain weekly step', () => {
  const start = '9999-12-25', endExclusive = '9999-12-31';
  const current = review(request({ planningStart: own(start, 'utc-date'), planningEndExclusive: own(endExclusive, 'utc-date'),
    availability: [{ bedId: 'engineering-bed', scope, window: own({ start, endExclusive }, 'utc-date-window') }],
    demands: [demand('buyer-a', 6, start, endExclusive)] }));
  assert.equal(current.proposal.status, 'ready');
  assert.deepEqual(ready(current).buyers[0].periods.map(period => [period.start, period.endExclusive]), [[start, endExclusive]]);
});

test('bins not wholly inside the planning horizon remain explicitly unplanned even with partial intersections', () => {
  const current = review(request({ planningStart: own('2028-02-05', 'utc-date'), planningEndExclusive: own('2028-02-23', 'utc-date') }));
  const periods = ready(current).buyers[0].periods;
  assert.deepEqual(periods.map(period => period.status), [
    'not-fully-within-plan', 'picking-window-present', 'no-proposed-picking-window',
    'not-fully-within-plan', 'not-fully-within-plan',
  ]);
  assert.deepEqual(periods[0].overlaps.map(row => [row.start, row.endExclusive]), [['2028-02-07', '2028-02-08']]);
  assert.deepEqual(periods.at(-1)?.overlaps, []);
});

test('a present picking interval means some dates only and never introduces a weekly quantity or coverage percentage', () => {
  const report = ready(review());
  assert.deepEqual(Object.keys(report).sort(), ['basis', 'buyers', 'deliveryDistribution', 'periodDays', 'sourceVerification', 'status']);
  for (const buyer of report.buyers) {
    assert.deepEqual(Object.keys(buyer).sort(), ['periods', 'profileId', 'targetId', 'window', 'zeroDemand']);
    for (const period of buyer.periods) {
      assert.deepEqual(Object.keys(period).sort(), ['endExclusive', 'overlaps', 'start', 'status']);
      for (const overlap of period.overlaps) {
        assert.deepEqual(Object.keys(overlap).sort(), ['bedId', 'cycleId', 'endExclusive', 'start']);
      }
    }
  }
  assert.doesNotMatch(JSON.stringify(report), /rainfall|yieldKg|allocatedKg|weeklyKg|percentage|observedHarvest|nutrition/);
});

test('buyer order and profile bindings stay distinct from other buyers and actual household or trial demand adapters', () => {
  const excluded = profile({ allowedEntryMonths: own([], 'utc-months') }, 'excluded-profile');
  const producing = profile({}, 'producing-profile');
  const entered = (purpose: 'household' | 'trial') => {
    const row = growerDemandFromEnteredEntry({ scope, profile: producing, recordedAt, entry: {
      kind: 'grower-entered', entryId: `${purpose}-entry`, purpose, cropKey: producing.cropKey,
      profileId: producing.profileId, grossKg: '6', harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01',
    } });
    assert.equal(row.status, 'ready');
    if (row.status !== 'ready') assert.fail('The existing entered-demand adapter accepts this engineering row');
    return row;
  };
  const household = entered('household'), trial = entered('trial');
  const a = demand('buyer-a', 6, '2028-02-01', '2028-03-01', excluded.profileId);
  const b = demand('buyer-b', 6, '2028-02-01', '2028-03-01', producing.profileId);
  const current = { ...review(request({ profiles: [excluded, producing], demands: [a, b, household.demand, trial.demand] }),
    [targetMetadata(b), targetMetadata(a)]), enteredDemandMetadata: [household.metadata, trial.metadata] };
  const report = ready(current);
  assert.deepEqual(report.buyers.map(buyer => buyer.targetId), ['buyer-b', 'buyer-a']);
  assert.ok(report.buyers[1].periods.every(period => period.status === 'no-proposed-picking-window'));
  const proposedBuyerCycles = current.proposal.cycles.filter(cycle => cycle.demandId === b.demandId);
  assert.deepEqual(report.buyers[0].periods.flatMap(period => period.overlaps.map(overlap => overlap.cycleId)),
    proposedBuyerCycles.map(cycle => cycle.cycleId));
  assert.ok(current.proposal.cycles.some(cycle => cycle.demandId === household.demand.demandId));
  assert.ok(current.proposal.cycles.some(cycle => cycle.demandId === trial.demand.demandId));
});

test('valid colon-containing buyer and profile pairs cannot collide or borrow another buyer’s picking dates', () => {
  const excluded = profile({ allowedEntryMonths: own([], 'utc-months') }, 'profile');
  const producing = profile({}, 'a:profile');
  const first = demand('buyer:a', 6, '2028-02-01', '2028-03-01', excluded.profileId);
  const second = demand('buyer', 6, '2028-02-01', '2028-03-01', producing.profileId);
  assert.equal(`${first.demandId}:${first.profileId}`, `${second.demandId}:${second.profileId}`,
    'the independent fixture actually exercises a delimiter-key collision');
  assert.notDeepEqual([first.demandId, first.profileId], [second.demandId, second.profileId]);
  const current = review(request({ profiles: [excluded, producing], demands: [first, second] }));
  const report = ready(current);
  assert.deepEqual(report.buyers.map(buyer => [buyer.targetId, buyer.profileId]), [
    [first.demandId, first.profileId], [second.demandId, second.profileId],
  ]);
  assert.ok(report.buyers[0].periods.every(period => period.status === 'no-proposed-picking-window'));
  assert.deepEqual(report.buyers[0].periods.flatMap(period => period.overlaps), []);
  assert.ok(report.buyers[1].periods.some(period => period.status === 'picking-window-present'));
  assert.deepEqual(report.buyers[1].periods.flatMap(period => period.overlaps.map(overlap => overlap.cycleId)),
    current.proposal.cycles.filter(cycle => cycle.demandId === second.demandId).map(cycle => cycle.cycleId));
});

test('a valid household or trial-only actual workflow never becomes a buyer report', async () => {
  const f = await assembledBuyer();
  const sourceCanvas = buildDemoDesignCanvasState();
  sourceCanvas.siteId = scope.siteId; sourceCanvas.frame.centerLat = 0; sourceCanvas.frame.centerLng = 0;
  const bed = sourceCanvas.items.find(item => item.defId === 'veg_bed'); assert.ok(bed);
  sourceCanvas.items = [{ ...bed, id: 'entered-only-bed', x: 0.5, wM: 3, hM: 4 }];
  sourceCanvas.zones = []; sourceCanvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas',
    sourceId: scope.siteId, raw: sourceCanvas, sourceRevision: 'engineering-entered-source' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') assert.fail('The synthetic entered-only source is ready');
  const current = assembleGrowerWorkflowReview({ scope, source, recordedAt,
    book: { ...f.book, harvestTargets: [] }, draft: {
      planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000', targetProfiles: [],
      demands: [{ kind: 'grower-entered', entryId: 'household-only', purpose: 'household', cropKey: f.estimate.cropKey,
        profileId: f.estimate.profileId, grossKg: '6', harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01' }],
      available: source.beds.map(row => ({ bedId: row.id, start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true })),
      assumptionsConfirmed: true,
    } });
  assert.equal(current.status, 'review');
  assert.deepEqual(ready(current), { status: 'ready', ...basis, periodDays: 7, buyers: [] });
});

test('zero canonical buyer demand creates no false gaps and needs no invented growing estimates', () => {
  const noEstimates = profile({ plantsPerM2: missing, yieldKgPerM2: missing, establishment: missing, nurseryDays: missing,
    fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing,
    turnaroundDays: missing, allowedEntryMonths: missing });
  const current = review(request({ profiles: [noEstimates], demands: [demand('buyer-a', 0)] }));
  assert.equal(current.proposal.status, 'ready');
  assert.equal(current.proposal.cycles.length, 0);
  assert.deepEqual(ready(current).buyers, [{ targetId: 'buyer-a', profileId: 'profile-a',
    window: { start: '2028-02-01', endExclusive: '2028-03-01' }, zeroDemand: true, periods: [] }]);
  const withoutWindow = request({ profiles: [noEstimates], demands: [{ ...demand('buyer-a', 0), harvestWindow: missing }] });
  held(review(withoutWindow), 'target-demand-mismatch');
  for (const saleablePercent of [null, 0, 100]) {
    const row = current.targetMetadata[0];
    assert.equal(ready({ ...current, targetMetadata: [{ ...row, saleablePercent }] }).buyers[0].zeroDemand, true);
  }
});

test('held, malformed, missing-input and search-limit proposals never produce a partial missing-picking conclusion', () => {
  for (const value of [undefined, null, 0, false, '', [], {}, { status: 'held', issues: ['source-unavailable'] }]) held(value);
  held(review(request({ planningStart: missing })));
  held(review(request({ maxAssessments: 1 })));
  const changedTime = { ...review(), recordedAt: '2026-11-06T12:00:00.000Z' };
  held(changedTime);
  for (const metadataValue of [null, {}, 'buyer']) held({ ...review(), targetMetadata: metadataValue });
});

test('a matching fingerprint alone cannot approve edited proposal cycles, schedules, capacities or results', () => {
  const original = review(request({ demands: [demand('buyer-a', 12)] }));
  assert.ok(original.proposal.cycles.length > 1);
  const alterations: Array<(proposal: Record<string, unknown>) => void> = [
    proposal => { array(proposal.cycles).reverse(); },
    proposal => { array(proposal.cycles).pop(); },
    proposal => { record(array(proposal.cycles)[0]).bedId = 'changed-bed'; },
    proposal => { record(array(proposal.cycles)[0]).fingerprint = 'changed-cycle-fingerprint'; },
    proposal => { record(record(record(array(proposal.cycles)[0]).assessment).schedule).firstHarvestDate = '2028-02-20'; },
    proposal => { record(record(record(array(proposal.cycles)[0]).assessment).capacity).estimatedYieldKg = 0; },
    proposal => { record(array(proposal.demandResults)[0]).estimatedAllocatedKg = 0; },
    proposal => { record(proposal.snapshot).geometryFingerprint = 'changed-snapshot-geometry'; },
    proposal => { array(proposal.issues).push('changed-issue'); },
  ];
  for (const change of alterations) {
    const altered = structuredClone(original), proposal = record(altered.proposal);
    change(proposal);
    assert.equal(altered.proposal.fingerprint, original.proposal.fingerprint, 'the stale fingerprint is deliberately left unchanged');
    held(altered, 'stale-review');
  }
});

test('a changed request cannot borrow the old canonical proposal and a caller cycle cannot replace regeneration', () => {
  const original = review();
  const changedRequest = { ...original.request, geometryFingerprint: 'changed-request-geometry' };
  held({ ...original, request: changedRequest }, 'stale-review');
  const altered = structuredClone(original), proposal = record(altered.proposal);
  const copiedCycle = structuredClone(array(proposal.cycles)[0]); record(copiedCycle).cycleId = 'caller-injected-cycle';
  array(proposal.cycles).push(copiedCycle);
  held(altered, 'stale-review');
});

test('ambiguous or changed buyer metadata is held rather than silently filtered or matched to the first demand', () => {
  const current = review(), buyer = current.targetMetadata[0];
  const variants: unknown[] = [
    [buyer, { ...buyer }], [{ ...buyer, targetId: 'missing-demand' }], [{ ...buyer, profileId: 'missing-profile' }],
    [{ ...buyer, grossCapacityRequiredKg: 0 }], [{ ...buyer, days: buyer.days + 1 }],
    [{ ...buyer, deliveryDistribution: 'established' }], [{ ...buyer, sourceVerification: 'verified' }],
    [{ ...buyer, targetId: '' }], [{ ...buyer, profileId: '' }], [null],
  ];
  for (const targetMetadata of variants) held({ ...current, targetMetadata }, 'target-demand-mismatch');
  const entered = growerDemandFromEnteredEntry({ scope, profile: profile(), recordedAt, entry: {
    kind: 'grower-entered', entryId: 'collision-fixture', purpose: 'trial', cropKey: CROPS[0].key,
    profileId: 'profile-a', grossKg: '6', harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01',
  } });
  assert.equal(entered.status, 'ready');
  if (entered.status !== 'ready') assert.fail('The collision starts from actual entered-demand metadata');
  const collision = { ...current, enteredDemandMetadata: [{ ...entered.metadata, demandId: buyer.targetId }] };
  held(collision, 'target-demand-mismatch');
});

test('buyer saleable metadata must retain its actual nullable percentage type rather than missing or fabricated evidence', () => {
  const current = review(), buyer = current.targetMetadata[0];
  const { saleablePercent: _percent, ...missingPercent } = buyer;
  held({ ...current, targetMetadata: [missingPercent] }, 'target-demand-mismatch');
  for (const saleablePercent of [{}, [], '', '100', false, -1, 101]) {
    held({ ...current, targetMetadata: [{ ...buyer, saleablePercent }] }, 'target-demand-mismatch');
  }
  for (const saleablePercent of [undefined, NaN, Infinity]) {
    held({ ...current, targetMetadata: [{ ...buyer, saleablePercent }] }, 'invalid-review');
  }
});

test('reporting work exhaustion returns no partial buyer bins even when the canonical search itself is usable', () => {
  const start = '2028-01-01', endExclusive = addGrowerUtcDays(start, 1000); assert.ok(endExclusive);
  const demands = Array.from({ length: 80 }, (_, index) => demand(`buyer-${index}`, 1, start, endExclusive));
  const current = review(request({ planningStart: own(start, 'utc-date'), planningEndExclusive: own(endExclusive, 'utc-date'),
    availability: [], demands, maxAssessments: GROWER_AUTOPLAN_MAX_ASSESSMENTS }));
  assert.equal(current.proposal.status, 'with-gaps');
  assert.equal(current.proposal.cycles.length, 0);
  assert.ok(demands.length * Math.ceil(1000 / 7) > GROWER_BUYER_PICKING_MAX_OPERATIONS,
    'period rows alone exceed the reporting budget without an expensive candidate search');
  held(current, 'report-work-limit');
});

test('unsafe review getters, hooks, cycles and nonfinite extras are held without executing any caller code', () => {
  let calls = 0;
  const getter = { enumerable: true, configurable: true, get() { calls++; throw Error('Unsafe review getter'); } };
  const values: unknown[] = [];
  for (const key of ['request', 'proposal', 'targetMetadata', 'ignoredExtra']) {
    const value = structuredClone(review()); Object.defineProperty(value, key, getter); values.push(value);
  }
  const nested = structuredClone(review()); Object.defineProperty(nested.proposal, 'cycles', getter); values.push(nested);
  const metadata = structuredClone(review()); Object.defineProperty(metadata.targetMetadata[0], 'grossCapacityRequiredKg', getter); values.push(metadata);
  const row = structuredClone(review()); Object.defineProperty(row.request.demands, '0', getter); values.push(row);
  const cyclic = record(structuredClone(review())); cyclic.self = cyclic; values.push(cyclic);
  const hook = record(structuredClone(review())); hook.toJSON = () => { calls++; return review(); }; values.push(hook);
  const nonfinite = record(structuredClone(review())); nonfinite.extra = NaN; values.push(nonfinite);
  const undefinedExtra = record(structuredClone(review())); undefinedExtra.extra = undefined; values.push(undefinedExtra);
  for (const value of values) held(value, 'invalid-review');
  assert.equal(calls, 0);
});

test('output is deeply frozen detached data while the supplied mutable review remains unfrozen and unchanged', () => {
  const input = structuredClone(review()), before = JSON.stringify(input);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.targetMetadata[0]), false);
  const first = ready(input), second = ready(input);
  deepFrozen(first); deepFrozen(second);
  assert.notEqual(first, second); assert.notEqual(first.buyers, second.buyers);
  assert.notEqual(first.buyers[0], second.buyers[0]);
  assert.notEqual(first.buyers[0].window, second.buyers[0].window);
  assert.notEqual(first.buyers[0].window, record(input.request.demands[0].harvestWindow).value);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.request), false);
  assert.equal(Object.isFrozen(input.targetMetadata[0]), false);
  assert.equal(JSON.stringify(input), before);
  record(input.targetMetadata[0]).targetId = 'changed-after-review';
  assert.equal(second.buyers[0].targetId, 'buyer-a');
});

test('the existing saved-target adapter keeps whole-window demand and its explicit weekly-distribution limitation', async () => {
  const f = await assembledBuyer();
  const result = growerDemandFromHarvestTarget({ target: f.target, profile: f.estimate, scope, recordedAt });
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') assert.fail('The original saved buyer adapter remains usable');
  assert.equal(result.buyerTotalKg, 29); assert.equal(result.grossCapacityRequiredKg, 29); assert.equal(result.days, 29);
  assert.equal(result.deliveryDistribution, 'not-established'); assert.equal(result.sourceVerification, 'not-verified');
  assert.deepEqual(result.demand.harvestWindow.state === 'provided' && result.demand.harvestWindow.value,
    { start: '2028-02-01', endExclusive: '2028-03-01' });
});
