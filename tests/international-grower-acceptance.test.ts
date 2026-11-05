import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { sanitiseNurserySettings } from '../lib/nursery-settings.ts';
import { resolvePlantingBasis, createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type PrepareGrowerWorkflowAcceptanceInput, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';

// Engineering fixtures only. These short durations and quantities are not crop guidance.
const recordedAt = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic arithmetic fixture.' } });
async function fixture(siteId = 'site:1.00000,1.00000', bedPrefix = 'current') {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId;
  canvas.frame.centerLat = Number(siteId.slice(5).split(',')[0]); canvas.frame.centerLng = Number(siteId.split(',')[1]);
  const first = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [1, 2].map(index => ({ ...first, id: `${bedPrefix}-${index}`, x: index / 3, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'synthetic-private-source-receipt' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic source fixture was held');
  const scope = { kind: 'mapped-site', siteId } as const;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'profile-a', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const target: HarvestTarget = { id: 'target-a', siteId, cropKey: profile.cropKey, startMonth: '2028-02', endMonth: '2028-02', weeklyKg: 7, marketablePercent: 50 };
  const book: CropPlanState = { version: 1, plantings: [], growerPlanningProfiles: [profile], harvestTargets: [target], updatedAt: 123,
    planNotes: [{ kind: 'basis', text: 'Preserve this accepted explanation.' }], planNotesAt: Date.UTC(2026, 10, 5) };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: target.id, profileId: profile.profileId }], available: source.beds.map(bed => ({ bedId: bed.id,
      start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true })), assumptionsConfirmed: true };
  return { scope, source, book, draft, recordedAt, profile, target, canvas };
}
const acceptedAt = '2026-11-05T12:01:00.000Z';
async function acceptanceFixture() {
  const f = await fixture();
  const review = assembleGrowerWorkflowReview(f);
  assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('Synthetic review held');
  assert.equal(review.proposal.status, 'ready');
  const input: PrepareGrowerWorkflowAcceptanceInput = { review, binding: { source: f.source, draft: f.draft, recordedAt },
    scope: f.scope, source: f.source, book: f.book, acceptedAt,
    plantingIds: review.proposal.cycles.map((cycle, i) => ({ cycleId: cycle.cycleId, plantingId: `persistent-fixture-${i}` })) };
  return { ...f, input, review };
}
function held(input: PrepareGrowerWorkflowAcceptanceInput, reason?: string) {
  const result = prepareGrowerWorkflowAcceptance(input);
  assert.equal(result.status, 'held');
  if (result.status !== 'held') throw Error('Unexpected prepared result');
  if (reason) assert.ok(result.reasons.includes(reason), result.reasons.join(','));
  assert.equal('book' in result, false); assert.equal('rows' in result, false);
  return result;
}

test('acceptance prepares every canonical cycle through actual arithmetic without mutating or freezing the input book', async () => {
  const f = await acceptanceFixture(), before = JSON.stringify(f.input);
  const result = prepareGrowerWorkflowAcceptance(f.input);
  assert.equal(result.status, 'prepared');
  if (result.status !== 'prepared') throw Error('Synthetic acceptance held');
  assert.equal(result.rows.length, f.review.proposal.cycles.length);
  assert.ok(result.rows.length > 1);
  assert.equal(result.book.updatedAt, Date.parse(acceptedAt));
  for (const [i, row] of result.rows.entries()) {
    assert.equal(row.id, f.input.plantingIds[i].plantingId);
    assert.equal(row.harvestTargetId, f.review.proposal.cycles[i].demandId);
    assert.equal(row.growerCycle.acceptedAt, acceptedAt);
    const basis = resolvePlantingBasis(row, { scope: f.scope, beds: f.source.beds, geometryFingerprint: f.source.geometryFingerprint });
    assert.equal(basis.kind, 'grower-dated-cycle');
    if (basis.kind === 'grower-dated-cycle') assert.deepEqual(basis.assessment, f.review.proposal.cycles[i].assessment);
    assert.equal(row.existing, undefined); assert.equal(row.confirmedOnceSowing, undefined);
  }
  assert.equal(JSON.stringify(f.input), before);
  assert.equal(Object.isFrozen(f.book), false); assert.equal(Object.isFrozen(f.book.plantings), false);
  assert.ok(Object.isFrozen(result.book)); assert.ok(Object.isFrozen(result.rows));
  f.book.planNotes![0].text = 'Later editor change';
  assert.notEqual(result.book.planNotes![0].text, f.book.planNotes![0].text);
});

test('fresh whole-book metadata, foreign rows, groups and JSON-safe held nursery records survive without sanitisation', async () => {
  const f = await acceptanceFixture();
  const foreign = await fixture('site:2.00000,2.00000', 'foreign');
  const foreignReview = assembleGrowerWorkflowReview(foreign); assert.equal(foreignReview.status, 'review');
  if (foreignReview.status !== 'review') throw Error('Foreign review held');
  const row = createGrowerCyclePlanting(foreignReview.proposal.cycles[0], { plantingId: 'foreign-existing', acceptedAt: recordedAt, geometryFingerprint: foreign.source.geometryFingerprint })!;
  const nursery = sanitiseNurserySettings({ version: 1, spaces: [
    { id: 'ambiguous-space', siteId: f.scope.siteId, name: 'Current raw claim', usableM2: 2, extra: { retained: true } },
    { id: 'ambiguous-space', siteId: foreign.scope.siteId, name: 'Foreign raw claim', usableM2: 3 },
  ], containers: [], profiles: [] });
  assert.equal(nursery.heldInputs?.length, 1);
  assert.equal(nursery.heldInputs![0].rows.length, 2);
  const book = { ...f.book, plantings: [row], groups: [{ id: 'foreign-group', values: [null, 'retained'] }], nursery } as typeof f.book;
  const review = assembleGrowerWorkflowReview({ ...f, book }); assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('Fresh book held');
  const input = { ...f.input, book, review };
  const before = JSON.stringify(book), result = prepareGrowerWorkflowAcceptance(input);
  assert.equal(result.status, 'prepared');
  if (result.status !== 'prepared') throw Error('Metadata acceptance held');
  assert.equal(JSON.stringify({ ...result.book, plantings: result.book.plantings.slice(0,1), updatedAt: book.updatedAt }), before);
  assert.notEqual(result.book.plantings[0], row);
  assert.equal(JSON.stringify(book), before);
});

test('every reviewed request, proposal and diagnostic field is rederived rather than trusting a fingerprint alone', async () => {
  const f = await acceptanceFixture();
  const mutations: ((review: any) => void)[] = [
    r => r.request.requestedAt = acceptedAt,
    r => r.request.demands[0].totalKg.value++,
    r => r.proposal.cycles[0].assessment.capacity.estimatedYieldKg++,
    r => r.proposal.cycles[0].cycleId = 'different-local-ordinal',
    r => r.proposal.demandResults[0].estimatedAllocatedKg++,
    r => r.proposal.evaluationsUsed++,
    r => r.targetMetadata[0].buyerTotalKg++,
    r => r.targetMetadata.push(structuredClone(r.targetMetadata[0])),
    r => r.blockedBeds.push({ bedId: 'invented', reasons: [] }),
    r => r.existingOwnCycles.push({ plantingId: 'invented' }),
    r => r.issues.push('invented-diagnostic'),
    r => r.extraClaim = true,
  ];
  for (const mutate of mutations) {
    const review = structuredClone(f.review); mutate(review);
    assert.notDeepEqual(review, f.review);
    held({ ...f.input, review });
  }
});

test('equal-area source moves, raw revision changes, different resource namespaces and scope switches withhold acceptance', async () => {
  const f = await acceptanceFixture();
  for (const source of [
    { ...f.source, geometryFingerprint: f.source.geometryFingerprint+'-moved' },
    { ...f.source, sourceRevision: f.source.sourceRevision+'-new-receipt' },
    { ...f.source, resourceSiteId: 'design:different-namespace' },
    { ...f.source, sourceId: 'different-source' },
  ]) held({ ...f.input, source }, 'source-changed');
  const moved = structuredClone(f.canvas); moved.items[0].x += 0.1;
  const movedSource = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: f.scope.siteId,
    raw: moved, sourceRevision: 'new-private-receipt' }));
  assert.equal(movedSource.status, 'ready');
  if (movedSource.status === 'ready') { assert.equal(movedSource.beds[0].areaM2, f.source.beds[0].areaM2); held({ ...f.input, source: movedSource }, 'source-changed'); }
  held({ ...f.input, scope: { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } }, 'acceptance-scope-mismatch');
  held({ ...f.input, source: null }, 'source-unavailable');
  held({ ...f.input, source: { status: 'held', reasons: [] } as any }, 'source-unavailable');
});

test('changed targets, profiles and original review bindings cannot borrow the former exact review', async () => {
  const f = await acceptanceFixture();
  held({ ...f.input, book: { ...f.book, harvestTargets: [{ ...f.target, weeklyKg: f.target.weeklyKg+1 }] } });
  held({ ...f.input, book: { ...f.book, growerPlanningProfiles: [{ ...f.profile, inputs: { ...f.profile.inputs, pickingDays: own(3, 'days') } }] } });
  held({ ...f.input, binding: { ...f.input.binding, recordedAt: acceptedAt } }, 'review-binding-mismatch');
  held({ ...f.input, binding: { ...f.input.binding, draft: { ...f.draft, planningStart: '2028-02-02' } } });
  held({ ...f.input, binding: { ...f.input.binding, source: { ...f.source, resourceSiteId: 'design:wrong-targets' } } }, 'source-changed');
});

test('fresh current-bed legacy occupancy or unrelated corrupt foreign duplicates cannot be overwritten by accepting', async () => {
  const f = await acceptanceFixture();
  const legacy = { id: 'occupied', bedId: f.source.beds[0].id, cropKey: f.profile.cropKey, sowMonth: 2 };
  held({ ...f.input, book: { ...f.book, plantings: [legacy] } }, 'availability-bed-blocked');
  const foreign = { ...legacy, id: 'same-book-id', bedId: 'foreign-bed' };
  held({ ...f.input, book: { ...f.book, plantings: [foreign,{ ...foreign, growerCycle: null }] } }, 'ambiguous-planting-identities');
  held({ ...f.input, book: { ...f.book, plantings: [{ ...foreign, growerCycle: null }] } });
});

test('persistent IDs must map the full proposal exactly once and cannot collide anywhere in the book', async () => {
  const f = await acceptanceFixture(), ids = f.input.plantingIds;
  held({ ...f.input, plantingIds: ids.slice(1) }, 'planting-id-mapping-incomplete');
  held({ ...f.input, plantingIds: [...ids,{ cycleId: 'invented', plantingId: 'new' }] }, 'planting-id-mapping-incomplete');
  held({ ...f.input, plantingIds: ids.map((r,i) => i ? r : { ...r, cycleId: ids[1].cycleId }) }, 'planting-id-mapping-incomplete');
  held({ ...f.input, plantingIds: ids.map(r => ({ ...r, plantingId: 'same-new-id' })) }, 'planting-id-duplicate');
  for (const id of ['', ' padded ', 'x'.repeat(201), 'bad\u0000id']) held({ ...f.input, plantingIds: ids.map((r,i) => i ? r : { ...r, plantingId: id }) }, 'planting-id-invalid');
  const foreign = { id: ids[0].plantingId, bedId: 'foreign-bed', cropKey: f.profile.cropKey, sowMonth: 2 };
  const book = { ...f.book, plantings: [foreign] }, review = assembleGrowerWorkflowReview({ ...f, book });
  assert.equal(review.status, 'review');
  if (review.status === 'review') held({ ...f.input, book, review }, 'planting-id-duplicate');
});

test('an already recorded full or partial proposal is rejected instead of appended or silently replaced', async () => {
  const f = await acceptanceFixture(), result = prepareGrowerWorkflowAcceptance(f.input);
  assert.equal(result.status, 'prepared'); if (result.status !== 'prepared') throw Error('Acceptance held');
  held({ ...f.input, book: result.book }, 'proposal-already-recorded');
  held({ ...f.input, book: { ...f.book, plantings: [result.rows[0]] } }, 'proposal-already-recorded');
  assert.equal(f.book.plantings.length, 0);
});

test('incomplete, exhausted or zero-cycle proposals never produce a claimed saved empty result', async () => {
  const f = await acceptanceFixture();
  for (const status of ['with-gaps','work-limit-exceeded','missing-inputs']) held({ ...f.input, review: { ...f.review, proposal: { ...f.review.proposal, status } } as any }, 'proposal-not-complete');
  held({ ...f.input, review: { ...f.review, proposal: { ...f.review.proposal, cycles: [] } } }, 'no-proposed-cycles');
  const draft = { ...f.draft, maxAssessments: '1' }, review = assembleGrowerWorkflowReview({ ...f, draft });
  assert.equal(review.status, 'review');
  if (review.status === 'review') { assert.equal(review.proposal.status, 'work-limit-exceeded'); held({ ...f.input, review, binding: { ...f.input.binding, draft } }, 'proposal-not-complete'); }
});

test('acceptance time is explicit and cannot predate review or repair invalid metadata through serialization', async () => {
  const f = await acceptanceFixture();
  for (const acceptedAt of ['', '2026-11-04T12:00:00.000Z','2026-11-05']) held({ ...f.input, acceptedAt }, 'acceptance-time-invalid');
  for (const nursery of [{ raw: undefined },{ raw: NaN },{ raw: ()=>1 }]) held({ ...f.input, book: { ...f.book, nursery } as any }, 'unsafe-acceptance-input');
  let reads=0;const book={ ...f.book };Object.defineProperty(book,'nursery',{enumerable:true,get(){reads++;return{};}});
  held({ ...f.input, book }, 'unsafe-acceptance-input');assert.equal(reads,0);
  assert.equal('actorIsCurrent' in f.input,false,'the pure data API cannot establish actual Firebase or mounted-account ownership');
});

test('actual no-availability capacity gaps are held and object key order cannot change the exact reviewed meaning', async () => {
  const f = await acceptanceFixture(), draft = { ...f.draft, available: [] };
  const review = assembleGrowerWorkflowReview({ ...f, draft }); assert.equal(review.status, 'review');
  if (review.status === 'review') { assert.equal(review.proposal.status, 'with-gaps'); held({ ...f.input, review, binding: { ...f.input.binding, draft } }, 'proposal-not-complete'); }
  const request = Object.fromEntries(Object.entries(f.review.request).reverse());
  const reordered = prepareGrowerWorkflowAcceptance({ ...f.input, review: { ...f.review, request } as typeof f.review });
  assert.equal(reordered.status, 'prepared');
});

test('unserialisable unrelated nursery arrays remain held instead of losing holes or extra own data', async () => {
  const f = await acceptanceFixture(), sparse = new Array(1); Object.assign(sparse, { extra: 'would disappear in JSON' });
  held({ ...f.input, book: { ...f.book, nursery: { raw: sparse } } as any }, 'unsafe-acceptance-input');
});

test('a new complete review can coexist with an earlier own cycle that reused the same local ordinal', async () => {
  const f = await acceptanceFixture();
  const prior = createGrowerCyclePlanting(f.review.proposal.cycles[0], { plantingId: 'prior-canonical-own', acceptedAt: recordedAt, geometryFingerprint: f.source.geometryFingerprint })!;
  const book = { ...f.book, plantings: [prior] }, review = assembleGrowerWorkflowReview({ ...f, book });
  assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('New review held');
  assert.equal(review.proposal.status, 'ready');
  assert.ok(review.proposal.cycles.some(c => c.cycleId === prior.growerCycle.cycleId));
  const result = prepareGrowerWorkflowAcceptance({ ...f.input, book, review,
    plantingIds: review.proposal.cycles.map((c,i) => ({ cycleId: c.cycleId, plantingId: `next-persistent-${i}` })) });
  assert.equal(result.status, 'prepared');
  if (result.status !== 'prepared') throw Error('Valid later ordinal was treated as replay');
  assert.deepEqual(result.book.plantings[0], prior);
  const projected = assembleGrowerWorkflowReview({ ...f, book: result.book });
  assert.equal(projected.status, 'review');
  assert.equal(projected.existingOwnCycles.length, result.book.plantings.length);
  assert.equal(projected.blockedBeds.length, 0, 'appended own reservations have no conflicting interval');
});

test('a zero weekly target cannot bypass the actual canonical target guard into a claimed acceptance', async () => {
  const f = await acceptanceFixture(), book = { ...f.book, harvestTargets: [{ ...f.target, weeklyKg: 0 }] };
  // The engine supports zero demand, but canonical weekly targets currently
  // require a positive quantity. Preserve that real adapter guard, not a
  // fictional ready-zero path through this assembler.
  const review = assembleGrowerWorkflowReview({ ...f, book });
  assert.equal(review.status, 'held'); assert.ok(review.issues.includes('target-invalid-source'));
  held({ ...f.input, book }, 'review-no-longer-current');
});
