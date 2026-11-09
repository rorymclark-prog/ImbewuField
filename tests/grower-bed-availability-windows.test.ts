import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance,
  type AssembleGrowerWorkflowReviewInput, type GrowerWorkflowDraft,
  type PrepareGrowerWorkflowAcceptanceInput } from '../lib/international/grower-workflow.ts';

// Synthetic engineering fixtures only: these dates, dimensions and short cycles
// exercise interval boundaries and are not growing instructions or local advice.
const recordedAt = '2026-11-05T12:00:00.000Z', acceptedAt = '2026-11-05T12:01:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic interval test only.' } });
type Available = GrowerWorkflowDraft['available'][number];
const interval = (start: string, endExclusive: string, bedId = 'bed-a', confirmed = true): Available =>
  ({ bedId, start, endExclusive, confirmed });
async function fixture(available: readonly Available[] = [interval('2028-02-01', '2028-02-05')], weeklyKg = 1) {
  const siteId = 'site:1.00000,1.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 1; canvas.frame.centerLng = 1;
  const first = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = ['bed-a', 'bed-b'].map((id, index) => ({ ...first, id, x: (index + 1) / 3, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'synthetic-original-source' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic measured source held');
  const scope = { kind: 'mapped-site', siteId } as const;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'),
    allowedEntryMonths: own([2], 'utc-months'),
  } };
  const target: HarvestTarget = { id: 'buyer-target', siteId, cropKey: profile.cropKey,
    startMonth: '2028-02', endMonth: '2028-02', weeklyKg, marketablePercent: 100 };
  const book: CropPlanState = { version: 1, plantings: [], growerPlanningProfiles: [profile], harvestTargets: [target], updatedAt: 123,
    planNotes: [{ kind: 'basis', text: 'Retain this original note.' }] };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: target.id, profileId: profile.profileId }], available, assumptionsConfirmed: true };
  return { scope, source, book, draft, recordedAt, profile, target, canvas };
}
function review(input: AssembleGrowerWorkflowReviewInput) {
  const result = assembleGrowerWorkflowReview(input);
  assert.equal(result.status, 'review', result.issues.join(','));
  if (result.status !== 'review') throw Error('Expected real workflow review');
  return result;
}
function held(input: AssembleGrowerWorkflowReviewInput, issue: string) {
  const result = assembleGrowerWorkflowReview(input);
  assert.equal(result.status, 'held'); assert.ok(result.issues.includes(issue), result.issues.join(','));
  assert.equal('request' in result, false);
}
const schedules = (result: ReturnType<typeof review>) => result.proposal.cycles.map(cycle => ({ bedId: cycle.bedId,
  start: cycle.assessment.schedule.fieldEntryDate, endExclusive: cycle.assessment.schedule.nextFieldEntryDate }));
function acceptance(f: Awaited<ReturnType<typeof fixture>>, result = review(f)): PrepareGrowerWorkflowAcceptanceInput {
  return { review: result, binding: { source: f.source, draft: f.draft, recordedAt }, scope: f.scope,
    source: f.source, book: f.book, acceptedAt,
    plantingIds: result.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `persistent-${index}` })) };
}
function acceptanceHeld(input: PrepareGrowerWorkflowAcceptanceInput, reason: string) {
  const result = prepareGrowerWorkflowAcceptance(input);
  assert.equal(result.status, 'held');
  if (result.status !== 'held') throw Error('Expected original acceptance guard');
  assert.ok(result.reasons.includes(reason), result.reasons.join(','));
  assert.equal('book' in result, false); assert.equal('rows' in result, false);
}

test('a single confirmed interval retains the existing complete-cycle and acceptance result', async () => {
  const f = await fixture(), result = review(f), before = JSON.stringify(f);
  assert.equal(result.proposal.status, 'ready');
  assert.deepEqual(schedules(result), [{ bedId: 'bed-a', start: '2028-02-01', endExclusive: '2028-02-05' }]);
  const prepared = prepareGrowerWorkflowAcceptance(acceptance(f, result));
  assert.equal(prepared.status, 'prepared');
  assert.equal(JSON.stringify(f), before);
});

test('a too-short first window does not hide a later disjoint window that contains the whole cycle', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-04'), interval('2028-02-10', '2028-02-14')]);
  const result = review(f);
  assert.equal(result.proposal.status, 'ready');
  assert.deepEqual(schedules(result), [{ bedId: 'bed-a', start: '2028-02-10', endExclusive: '2028-02-14' }]);
  assert.equal(result.request.availability.length, 2);
});

test('disjoint windows never grant the intervening gap or claim uncovered demand is complete', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-10', '2028-02-14')], 7);
  const result = review(f);
  assert.deepEqual(schedules(result), [
    { bedId: 'bed-a', start: '2028-02-01', endExclusive: '2028-02-05' },
    { bedId: 'bed-a', start: '2028-02-10', endExclusive: '2028-02-14' },
  ]);
  assert.equal(result.proposal.status, 'with-gaps');
  assert.equal(result.proposal.demandResults[0].estimatedAllocatedKg, 24);
  assert.equal(result.proposal.demandResults[0].unmetKg, 5);
  acceptanceHeld(acceptance(f, result), 'proposal-not-complete');
});

test('field occupancy plus turnaround must fit one window even when picking would finish before its end', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-04'), interval('2028-02-10', '2028-02-13')]);
  const result = review(f);
  assert.deepEqual(result.proposal.cycles, []);
  assert.equal(result.proposal.status, 'with-gaps');
  assert.ok(result.proposal.demandResults[0].reasons.includes('availability-or-horizon'));
});

test('touching exclusive boundaries are allowed but short adjacent intervals cannot be bridged for a cycle', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-03'), interval('2028-02-03', '2028-02-05')]);
  const result = review(f);
  assert.equal(result.request.availability.length, 2); assert.equal(result.proposal.cycles.length, 0);
  assert.equal(result.proposal.status, 'with-gaps');
  const exact = review({ ...f, draft: { ...f.draft, available: [interval('2028-02-01', '2028-02-05'), interval('2028-02-05', '2028-02-09')] } });
  assert.equal(exact.proposal.status, 'ready');
  assert.deepEqual(schedules(exact), [{ bedId: 'bed-a', start: '2028-02-01', endExclusive: '2028-02-05' }]);
});

test('exact duplicates, partial overlaps and nested confirmed windows are held in either input order', async () => {
  const first = interval('2028-02-02', '2028-02-10');
  for (const second of [first, interval('2028-02-08', '2028-02-14'), interval('2028-02-04', '2028-02-06'),
    interval('2028-02-01', '2028-02-11')]) {
    for (const available of [[first, second], [second, first]]) {
      const f = await fixture(available), before = JSON.stringify(f.draft);
      held(f, 'availability-window-overlap'); assert.equal(JSON.stringify(f.draft), before);
    }
  }
});

test('each confirmed interval still requires valid independently ordered real calendar dates', async () => {
  for (const second of [interval('', '2028-02-14'), interval('2028-02-10', ''), interval('2028-02-30', '2028-03-02'),
    interval('2028-02-10', '2028-02-10'), interval('2028-02-14', '2028-02-10'), interval('2028-02-10T00:00:00Z', '2028-02-14')]) {
    held(await fixture([interval('2028-02-01', '2028-02-05'), second]), 'availability-window-invalid');
  }
});

test('unconfirmed duplicate, invalid and unknown-bed rows never grant or block confirmed availability', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-01', '2028-02-05', 'bed-a', false),
    interval('', '', 'bed-a', false), interval('2028-02-01', '2028-03-01', 'unknown-bed', false)]);
  const result = review(f); assert.equal(result.request.availability.length, 1); assert.equal(result.proposal.status, 'ready');
  const none = review({ ...f, draft: { ...f.draft, available: f.draft.available.map(row => ({ ...row, confirmed: false })) } });
  assert.equal(none.request.availability.length, 0); assert.equal(none.proposal.cycles.length, 0);
  held({ ...f, draft: { ...f.draft, available: [{ ...f.draft.available[0], confirmed: null }] as unknown as Available[] } }, 'availability-invalid');
  held({ ...f, draft: { ...f.draft, available: [interval('2028-02-01', '2028-02-05', 'unknown-bed')] } }, 'availability-bed-unavailable');
});

test('equal date ranges on different measured beds remain independent availability', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-01', '2028-02-05', 'bed-b')], 5);
  const result = review(f); assert.equal(result.proposal.status, 'ready');
  assert.deepEqual(schedules(result).map(row => row.bedId), ['bed-a', 'bed-b']);
});

test('out-of-order disjoint drafts remain separate and preserve source arrays and request order', async () => {
  const available = [interval('2028-02-10', '2028-02-14'), interval('2028-02-01', '2028-02-05')];
  const f = await fixture(available), before = JSON.stringify(f);
  const result = review(f);
  assert.deepEqual(result.request.availability.map(row => row.window.state === 'provided' && row.window.value),
    available.map(({ start, endExclusive }) => ({ start, endExclusive })));
  assert.equal(JSON.stringify(f), before); assert.equal(Object.isFrozen(f.draft.available), false);
  assert.equal(Object.isFrozen(available[0]), false);
  assert.deepEqual(schedules(result), [{ bedId: 'bed-a', start: '2028-02-01', endExclusive: '2028-02-05' }]);
});

test('an existing own reservation including turnaround still excludes its interval from every claimed window', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-10', '2028-02-14')]);
  const original = review(f), row = createGrowerCyclePlanting(original.proposal.cycles[0], { plantingId: 'prior-own', acceptedAt: recordedAt,
    geometryFingerprint: f.source.geometryFingerprint });
  assert.ok(row);
  const book = { ...f.book, plantings: [row] }, result = review({ ...f, book });
  assert.equal(result.request.reserved.length, 1);
  assert.deepEqual(result.request.reserved[0].window.state === 'provided' && result.request.reserved[0].window.value,
    { start: '2028-02-01', endExclusive: '2028-02-05' });
  assert.deepEqual(schedules(result), [{ bedId: 'bed-a', start: '2028-02-10', endExclusive: '2028-02-14' }]);
  assert.equal(book.plantings[0], row);
});

test('legacy occupancy, raw whole-book ambiguity and malformed associations remain held before availability can approve them', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-10', '2028-02-14')]);
  const row = { id: 'occupied', bedId: 'bed-a', cropKey: f.profile.cropKey, sowMonth: 2 };
  held({ ...f, book: { ...f.book, plantings: [row] } }, 'availability-bed-blocked');
  held({ ...f, book: { ...f.book, plantings: [row, { ...row, bedId: 'foreign-bed' }] } }, 'ambiguous-planting-identities');
  held({ ...f, book: { ...f.book, plantings: [null] } as unknown as CropPlanState }, 'unresolved-row-association');
  assert.equal(f.book.plantings.length, 0);
});

test('multi-window acceptance still binds the original geometry, interval draft, full book and persistent replay identity', async () => {
  const f = await fixture([interval('2028-02-01', '2028-02-05'), interval('2028-02-10', '2028-02-14')]);
  const input = acceptance(f), before = JSON.stringify(f), prepared = prepareGrowerWorkflowAcceptance(input);
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') throw Error('Original multi-window acceptance held');
  assert.equal(prepared.rows.length, input.review.proposal.cycles.length);
  assert.deepEqual(prepared.book.planNotes, f.book.planNotes);
  acceptanceHeld({ ...input, source: { ...f.source, sourceRevision: 'later-source' } }, 'source-changed');
  acceptanceHeld({ ...input, source: { ...f.source, geometryFingerprint: f.source.geometryFingerprint + '-moved' } }, 'source-changed');
  acceptanceHeld({ ...input, binding: { ...input.binding, draft: { ...f.draft,
    available: [interval('2028-02-01', '2028-02-04'), interval('2028-02-10', '2028-02-14')] } } }, 'review-no-longer-current');
  acceptanceHeld({ ...input, book: { ...f.book, plantings: [{ id: 'later-legacy', bedId: 'bed-a', cropKey: f.profile.cropKey, sowMonth: 2 }] } }, 'availability-bed-blocked');
  acceptanceHeld({ ...input, book: prepared.book }, 'proposal-already-recorded');
  assert.equal(JSON.stringify(f), before);
});
