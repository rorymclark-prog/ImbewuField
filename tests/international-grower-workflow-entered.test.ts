import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState, buildDemoFacilitatorState } from '../lib/demo-farm.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { GROWER_AUTOPLAN_MAX_ASSESSMENTS } from '../lib/international/grower-autoplan.ts';
import {
  assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance,
  type AssembleGrowerWorkflowReviewInput, type GrowerWorkflowDraft, type GrowerWorkflowReview,
} from '../lib/international/grower-workflow.ts';

// Engineering fixtures only. These short durations and quantities are not crop,
// household or nutrition guidance. This file deliberately does not import the new
// adapter module, so on the old base it loads and the new-support cases fail on
// assertions (old code holds them as 'selected-target-required').
const recordedAt = '2026-11-05T12:00:00.000Z';
const acceptedAt = '2026-11-05T12:05:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic arithmetic fixture.' } });
async function studioSource(siteId: string, bedPrefix: string, xOffset: number) {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId;
  canvas.frame.centerLat = Number(siteId.slice(5).split(',')[0]); canvas.frame.centerLng = Number(siteId.split(',')[1]);
  const first = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [1, 2].map(index => ({ ...first, id: `${bedPrefix}-${index}`, x: index / 3 + xOffset, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: `synthetic-private-source-receipt-${xOffset}` }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic source fixture was held');
  return source;
}
/** Same synthetic fixture as tests/international-grower-workflow.test.ts, copied so that file stays untouched. */
async function fixture(siteId = 'site:1.00000,1.00000', bedPrefix = 'current') {
  const source = await studioSource(siteId, bedPrefix, 0);
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
  return { scope, source, book, draft, recordedAt, profile, target };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
const household = (f: Fixture, changes: Record<string, unknown> = {}) => ({ kind: 'grower-entered', entryId: 'household-1', purpose: 'household',
  cropKey: f.profile.cropKey, profileId: f.profile.profileId, grossKg: '24', harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01', ...changes });
const buyer = (f: Fixture) => ({ kind: 'buyer-target', targetId: f.target.id, profileId: f.profile.profileId });
const ordered = (f: Fixture, demands: unknown[]) => ({ ...f.draft, targetProfiles: [], demands }) as unknown as GrowerWorkflowDraft;
const HOUSEHOLD_ID = 'grower-entered:household-1';

function review(input: AssembleGrowerWorkflowReviewInput): Review {
  const result = assembleGrowerWorkflowReview(input);
  assert.equal(result.status, 'review', result.issues.join(','));
  if (result.status !== 'review') throw Error('Synthetic review fixture was held');
  return result;
}
function held(input: AssembleGrowerWorkflowReviewInput, issue: string) {
  const result = assembleGrowerWorkflowReview(input);
  assert.equal(result.status, 'held'); assert.ok(result.issues.includes(issue), result.issues.join(','));
  assert.equal('request' in result, false);
  return result;
}
const plantingIds = (result: Review, prefix = 'planting') => result.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `${prefix}-${index + 1}` }));
function accept(f: Fixture, result: Review, draft: GrowerWorkflowDraft, changes: Record<string, unknown> = {}) {
  return prepareGrowerWorkflowAcceptance({ review: result, binding: { source: f.source, draft, recordedAt }, scope: f.scope,
    source: f.source, book: f.book, acceptedAt, plantingIds: plantingIds(result), ...changes });
}
const refused = (result: ReturnType<typeof prepareGrowerWorkflowAcceptance>) => result.status === 'held' ? result.reasons : ['prepared'];
const overlaps = (result: Review) => result.proposal.cycles.some((a, i) => result.proposal.cycles.some((b, j) => i < j && a.bedId === b.bedId
  && a.assessment.schedule.fieldEntryDate < b.assessment.schedule.nextFieldEntryDate
  && b.assessment.schedule.fieldEntryDate < a.assessment.schedule.nextFieldEntryDate));

test('household-only demand reaches the real engine as explicit gross kg-total with no buyer (old base: held selected-target-required)', async () => {
  const f = await fixture();
  const result = review({ ...f, book: { ...f.book, harvestTargets: [] }, draft: ordered(f, [household(f)]) });
  assert.deepEqual(result.request.demands.map(demand => [demand.demandId, demand.profileId]), [[HOUSEHOLD_ID, 'profile-a']]);
  const totalKg = result.request.demands[0].totalKg;
  assert.deepEqual(totalKg.state === 'provided' && [totalKg.value, totalKg.unit, totalKg.provenance.kind, totalKg.provenance.recordedAt],
    [24, 'kg-total', 'grower-estimate', recordedAt]);
  assert.equal(result.proposal.status, 'ready');
  assert.deepEqual(result.proposal.demandResults.map(row => [row.demandId, row.status, row.unmetKg]), [[HOUSEHOLD_ID, 'capacity-covered', 0]]);
  const yields = result.proposal.cycles.map(cycle => cycle.assessment.capacity.estimatedYieldKg);
  assert.ok(yields.length > 0 && yields.every(kg => kg > 0));
  assert.ok(yields.reduce((a, b) => a + b, 0) >= 24 && yields.slice(0, -1).reduce((a, b) => a + b, 0) < 24, 'first fit stops once covered');
  assert.ok(result.proposal.cycles.every(cycle => cycle.demandId === HOUSEHOLD_ID));
  assert.deepEqual(result.targetMetadata, []);
  assert.deepEqual(result.enteredDemandMetadata?.map(row => [row.purpose, row.grossCapacityKg, row.buyer, row.saleableOutput, row.nutritionSufficiency]),
    [['household', 24, 'none', 'not-applicable', 'not-assessed']]);
  for (const key of ['weeklyProductionKg', 'price', 'currency', 'revenue', 'observedHarvest', 'accept']) assert.equal(key in result, false);
});

test('trial demand uses the same measured-bed route and keeps its no-evidence label in the request provenance', async () => {
  const f = await fixture();
  const result = review({ ...f, draft: ordered(f, [household(f, { purpose: 'trial', grossKg: '12' })]) });
  const totalKg = result.request.demands[0].totalKg;
  assert.ok(totalKg.state === 'provided' && totalKg.provenance.kind === 'grower-estimate' && /not agronomic evidence/.test(totalKg.provenance.note ?? ''));
  assert.equal(result.enteredDemandMetadata?.[0].agronomicEvidence, 'not-established');
  assert.ok(result.proposal.cycles.length > 0);
});

test('known zero needs no window and creates no cycle; blank is reported missing and never treated as zero', async () => {
  const f = await fixture();
  const zero = review({ ...f, draft: ordered(f, [household(f, { grossKg: '0', harvestStart: '', harvestEndExclusive: '' })]) });
  assert.equal(zero.proposal.status, 'ready'); assert.equal(zero.proposal.cycles.length, 0);
  assert.deepEqual(zero.proposal.demandResults.map(row => [row.status, row.requestedKg, row.unmetKg]), [['zero-demand', 0, 0]]);
  assert.deepEqual(refused(accept(f, zero, ordered(f, [household(f, { grossKg: '0', harvestStart: '', harvestEndExclusive: '' })]))), ['no-proposed-cycles']);
  const blank = review({ ...f, draft: ordered(f, [household(f, { grossKg: '' })]) });
  assert.equal(blank.proposal.status, 'missing-inputs');
  assert.ok(blank.proposal.issues.includes(`demand:${HOUSEHOLD_ID}:totalKg`), blank.proposal.issues.join(','));
  assert.equal(blank.proposal.demandResults[0].requestedKg, null);
  assert.equal(blank.enteredDemandMetadata?.[0].grossCapacityKg, null);
  const noWindow = review({ ...f, draft: ordered(f, [household(f, { harvestStart: '', harvestEndExclusive: '' })]) });
  assert.equal(noWindow.proposal.status, 'missing-inputs');
  assert.ok(noWindow.proposal.issues.includes(`demand:${HOUSEHOLD_ID}:harvestWindow`), noWindow.proposal.issues.join(','));
});

test('invalid entered values, windows, scopes and profiles hold before any request and write nothing', async () => {
  const f = await fixture();
  const before = JSON.stringify(f.book);
  const draft = (changes: Record<string, unknown>) => ordered(f, [household(f, changes)]);
  held({ ...f, draft: draft({ grossKg: '-1' }) }, 'entered-gross-kg-negative');
  held({ ...f, draft: draft({ grossKg: 'Infinity' }) }, 'entered-gross-kg-format');
  held({ ...f, draft: draft({ grossKg: '9'.repeat(40) }) }, 'entered-gross-kg-range');
  held({ ...f, draft: draft({ harvestEndExclusive: '' }) }, 'entered-harvest-window-incomplete');
  held({ ...f, draft: draft({ harvestStart: '2028-03-01' }) }, 'entered-harvest-window-invalid');
  held({ ...f, draft: draft({ purpose: 'sale' }) }, 'entered-purpose-invalid');
  held({ ...f, draft: draft({ cropKey: CROPS[1].key }) }, 'entered-crop-identity-mismatch');
  held({ ...f, draft: draft({ profileId: 'not-saved' }) }, 'entered-profile-missing');
  held({ ...f, book: { ...f.book, growerPlanningProfiles: [f.profile, { ...f.profile, version: 999 }] } as CropPlanState, draft: draft({}) }, 'entered-profile-ambiguous');
  held({ ...f, book: { ...f.book, growerPlanningProfiles: [{ ...f.profile, scope: { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } }] }, draft: draft({}) }, 'entered-scope-mismatch');
  held({ ...f, draft: draft({ targetId: 'target-a' }) }, 'entered-entry-shape-invalid');
  // Unmapped workspaces stay held at the existing top-level gate, before any demand is read.
  held({ ...f, scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' }, draft: draft({}) }, 'mapped-site-required');
  assert.equal(JSON.stringify(f.book), before);
  assert.equal(Object.isFrozen(f.book), false); assert.equal(Object.isFrozen(f.profile.inputs), false);
});

test('ordered-list shape, duplicate rows and identity collisions hold instead of choosing a winner', async () => {
  const f = await fixture();
  held({ ...f, draft: { ...ordered(f, [household(f)]), targetProfiles: f.draft.targetProfiles } }, 'demand-selection-ambiguous');
  held({ ...f, draft: ordered(f, []) }, 'selected-demand-required');
  held({ ...f, draft: ordered(f, Array.from({ length: GROWER_AUTOPLAN_MAX_ASSESSMENTS + 1 }, (_, i) => household(f, { entryId: `row-${i}` }))) }, 'demand-row-limit');
  held({ ...f, draft: ordered(f, [{ kind: 'sale', targetId: f.target.id }]) }, 'demand-kind-invalid');
  held({ ...f, draft: ordered(f, [null]) }, 'demand-kind-invalid');
  held({ ...f, draft: ordered(f, [household(f), household(f, { purpose: 'trial' })]) }, 'entered-entry-ambiguous');
  held({ ...f, draft: ordered(f, [buyer(f), buyer(f)]) }, 'selected-target-ambiguous');
  // An unselected saved target spelled like a namespaced entered demand is a collision.
  const shadow = { ...f.target, id: HOUSEHOLD_ID };
  held({ ...f, book: { ...f.book, harvestTargets: [f.target, shadow] }, draft: ordered(f, [household(f)]) }, 'entered-demand-id-collision');
});

test('buyer-only selections are unchanged whether sent as the legacy list or the ordered list', async () => {
  const f = await fixture();
  const legacy = review(f);
  const viaOrdered = review({ ...f, draft: ordered(f, [buyer(f)]) });
  assert.deepEqual(viaOrdered, legacy);
  assert.equal(JSON.stringify(viaOrdered), JSON.stringify(legacy));
  assert.equal(viaOrdered.proposal.fingerprint, legacy.proposal.fingerprint);
  assert.equal('enteredDemandMetadata' in legacy, false);
  // A legacy row never gains entered meaning from a kind field.
  held({ ...f, draft: { ...f.draft, targetProfiles: [household(f)] } as unknown as GrowerWorkflowDraft }, 'selected-target-required');
  // Explicitly absent ordered list keeps the legacy path.
  assert.deepEqual(review({ ...f, draft: { ...f.draft, demands: undefined } }), legacy);
});

test('mixed demands follow the explicit priority order and never double-book a bed', async () => {
  const f = await fixture();
  for (const [first, second] of [[household(f), buyer(f)], [buyer(f), household(f)]] as const) {
    const firstId = first.kind === 'buyer-target' ? f.target.id : HOUSEHOLD_ID;
    const result = review({ ...f, draft: ordered(f, [first, second]) });
    assert.deepEqual(result.request.demands.map(demand => demand.demandId), first.kind === 'buyer-target' ? [f.target.id, HOUSEHOLD_ID] : [HOUSEHOLD_ID, f.target.id]);
    assert.deepEqual(result.proposal.demandResults.map(row => row.demandId), result.request.demands.map(demand => demand.demandId));
    assert.equal(result.proposal.cycles[0].demandId, firstId);
    assert.ok(result.proposal.cycles.some(cycle => cycle.demandId === firstId && cycle.assessment.schedule.fieldEntryDate === '2028-02-01'),
      'the first-priority demand gets the first entry date');
    assert.equal(overlaps(result), false);
    assert.deepEqual(result.targetMetadata.map(meta => meta.targetId), [f.target.id]);
    assert.deepEqual(result.enteredDemandMetadata?.map(meta => meta.demandId), [HOUSEHOLD_ID]);
  }
});

test('oversubscribed household demand reports a gap and cannot be accepted', async () => {
  const f = await fixture();
  const draft = ordered(f, [household(f, { grossKg: '1000' })]);
  const result = review({ ...f, draft });
  assert.equal(result.proposal.status, 'with-gaps');
  const [row] = result.proposal.demandResults;
  assert.equal(row.status, 'capacity-gap'); assert.ok((row.unmetKg ?? 0) > 0);
  assert.ok(row.reasons.includes('insufficient-cycle-capacity'));
  const before = JSON.stringify(f.book);
  assert.deepEqual(refused(accept(f, result, draft)), ['proposal-not-complete']);
  assert.equal(JSON.stringify(f.book), before);
});

test('unknown availability stays unavailable and existing occupations block entered demand like any other', async () => {
  const f = await fixture();
  const unconfirmed = review({ ...f, draft: { ...ordered(f, [household(f)]), available: f.draft.available.map(row => ({ ...row, confirmed: false })) } });
  assert.equal(unconfirmed.proposal.cycles.length, 0);
  assert.ok(unconfirmed.proposal.demandResults[0].reasons.includes('no-asserted-availability'));
  const legacy = { id: 'old-sowing', bedId: f.source.beds[0].id, cropKey: f.profile.cropKey, sowMonth: 2 };
  const occupied = { ...f, book: { ...f.book, plantings: [legacy] }, draft: ordered(f, [household(f)]) };
  held(occupied, 'availability-bed-blocked');
  const elsewhere = review({ ...occupied, draft: { ...occupied.draft, available: f.draft.available.filter(row => row.bedId !== legacy.bedId) } });
  assert.ok(elsewhere.proposal.cycles.length > 0 && elsewhere.proposal.cycles.every(cycle => cycle.bedId !== legacy.bedId));
});

test('accepted household cycles append without a buyer link and then reserve capacity for every later demand', async () => {
  const f = await fixture();
  const draft = ordered(f, [household(f)]);
  const result = review({ ...f, draft });
  const before = JSON.stringify(f.book);
  const prepared = accept(f, result, draft);
  assert.equal(prepared.status, 'prepared', refused(prepared).join(','));
  if (prepared.status !== 'prepared') return;
  assert.equal(JSON.stringify(f.book), before, 'preparation never edits the input book');
  assert.equal(prepared.rows.length, result.proposal.cycles.length);
  for (const [index, row] of prepared.rows.entries()) {
    assert.equal(row.id, `planting-${index + 1}`);
    assert.equal('harvestTargetId' in row, false);
    assert.equal(row.growerCycle.demandId, HOUSEHOLD_ID);
  }
  assert.deepEqual(prepared.book.plantings.slice(0, f.book.plantings.length), f.book.plantings);
  assert.equal(prepared.book.plantings.length, f.book.plantings.length + prepared.rows.length);
  assert.equal(prepared.book.updatedAt, Date.parse(acceptedAt));
  assert.deepEqual(prepared.book.planNotes, f.book.planNotes);
  assert.deepEqual(prepared.book.harvestTargets, f.book.harvestTargets);
  assert.ok(Object.isFrozen(prepared.book));
  // Negative control: buyer acceptance still links its saved target exactly as before.
  const commercial = accept(f, review(f), f.draft);
  assert.equal(commercial.status, 'prepared', refused(commercial).join(','));
  if (commercial.status === 'prepared') assert.ok(commercial.rows.every(row => row.harvestTargetId === f.target.id));
  // A saved own cycle reserves capacity whatever its purpose.
  const later = review({ ...f, book: prepared.book });
  assert.deepEqual(later.existingOwnCycles.map(cycle => cycle.plantingId).sort(), prepared.rows.map(row => row.id).sort());
  assert.deepEqual(later.request.reserved.map(row => row.id).sort(), prepared.rows.map(row => row.id).sort());
  for (const cycle of later.proposal.cycles) for (const reserved of later.existingOwnCycles.filter(own => own.bedId === cycle.bedId)) {
    assert.ok(cycle.assessment.schedule.nextFieldEntryDate <= reserved.reservation.start
      || cycle.assessment.schedule.fieldEntryDate >= reserved.reservation.endExclusive, 'household reservation is respected');
  }
});

test('edits and purpose switches after review are refused at acceptance; a fresh review recovers', async () => {
  const f = await fixture();
  const draft = ordered(f, [household(f)]);
  const result = review({ ...f, draft });
  for (const changed of [ordered(f, [household(f, { grossKg: '36' })]), ordered(f, [household(f, { purpose: 'trial' })])]) {
    assert.deepEqual(refused(accept(f, result, changed)), ['review-no-longer-current']);
    const fresh = review({ ...f, draft: changed });
    assert.notEqual(fresh.proposal.fingerprint, result.proposal.fingerprint);
    assert.equal(accept(f, fresh, changed).status, 'prepared');
  }
  // A saved estimate edit between review and acceptance also stales the review.
  const edited = { ...f.book, growerPlanningProfiles: [{ ...f.profile, inputs: { ...f.profile.inputs, yieldKgPerM2: own(2, 'kg/m2/cycle') } }] };
  assert.deepEqual(refused(accept(f, result, draft, { book: edited })), ['review-no-longer-current']);
});

test('source geometry, source identity and replayed receipts are rejected; recovery needs a fresh review', async () => {
  const f = await fixture();
  const draft = ordered(f, [household(f)]);
  const result = review({ ...f, draft });
  const moved = await studioSource('site:1.00000,1.00000', 'current', 0.05);
  assert.notEqual(moved.geometryFingerprint, f.source.geometryFingerprint);
  assert.deepEqual(refused(accept(f, result, draft, { source: moved })), ['source-changed']);
  const recovered = review({ ...f, source: moved, draft });
  const movedAcceptance = prepareGrowerWorkflowAcceptance({ review: recovered, binding: { source: moved, draft, recordedAt }, scope: f.scope,
    source: moved, book: f.book, acceptedAt, plantingIds: plantingIds(recovered) });
  assert.equal(movedAcceptance.status, 'prepared', refused(movedAcceptance).join(','));
  // A different source kind and resource namespace at the same mapped scope is not interchangeable.
  const data = buildDemoFacilitatorState();
  data.designId = 'cloud-fixture'; data.bgSite = { lat: 1, lon: 1, name: 'Synthetic source' };
  data.items = data.items.filter(item => item.type === 'bed').slice(0, 1).map(item => ({ ...item, id: 'current-1', wM: 3, hM: 4 }));
  data.lines = []; data.sectors = [];
  const cloud = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'facilitator-cloud', sourceId: data.designId,
    raw: { id: data.designId, owner_id: 'synthetic-owner', data }, sourceRevision: 'synthetic-cloud-read-receipt' }));
  assert.equal(cloud.status, 'ready');
  assert.deepEqual(refused(accept(f, result, draft, { source: cloud })), ['source-changed']);
  // Canonical replay: the same review cannot append twice, even with new planting IDs.
  const first = accept(f, result, draft);
  assert.equal(first.status, 'prepared');
  if (first.status !== 'prepared') return;
  const replay = prepareGrowerWorkflowAcceptance({ review: result, binding: { source: f.source, draft, recordedAt }, scope: f.scope,
    source: f.source, book: first.book, acceptedAt, plantingIds: plantingIds(result, 'second') });
  assert.deepEqual(refused(replay), ['proposal-already-recorded']);
  // Unsafe binding data is refused before it is copied; nothing is returned to write.
  const sneaky = { ...draft } as Record<string, unknown>;
  Object.defineProperty(sneaky, 'maxAssessments', { enumerable: true, get: () => '1000' });
  const unsafe = accept(f, result, sneaky as unknown as GrowerWorkflowDraft);
  assert.deepEqual(refused(unsafe), ['unsafe-acceptance-input']);
  assert.equal('book' in unsafe, false);
});
