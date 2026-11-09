import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState, buildDemoFacilitatorState } from '../lib/demo-farm.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, type AssembleGrowerWorkflowReviewInput, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';

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
function review(input: AssembleGrowerWorkflowReviewInput) {
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
function accepted(input: Awaited<ReturnType<typeof fixture>>, id = 'existing-own') {
  const result = review(input);
  assert.ok(result.proposal.cycles.length > 0);
  const row = createGrowerCyclePlanting(result.proposal.cycles[0], { plantingId: id, acceptedAt: recordedAt,
    geometryFingerprint: input.source.geometryFingerprint });
  assert.ok(row); return row;
}

test('explicit target/profile priority reaches the real engine with separate buyer and gross-cycle totals', async () => {
  const f = await fixture();
  const profileB = { ...f.profile, profileId: 'profile-b', inputs: { ...f.profile.inputs, yieldKgPerM2: own(2, 'kg/m2/cycle') } };
  f.book.growerPlanningProfiles!.push(profileB);
  f.book.harvestTargets!.push({ ...f.target, id: 'target-b' });
  const result = review({ ...f, draft: { ...f.draft, targetProfiles: [{ targetId: 'target-b', profileId: 'profile-b' }, { targetId: 'target-a', profileId: 'profile-a' }] } });
  assert.deepEqual(result.request.demands.map(demand => [demand.demandId, demand.profileId]), [['target-b', 'profile-b'], ['target-a', 'profile-a']]);
  assert.deepEqual(result.targetMetadata.map(meta => [meta.targetId, meta.buyerTotalKg, meta.grossCapacityRequiredKg, meta.days, meta.saleablePercent]),
    [['target-b', 29, 58, 29, 50], ['target-a', 29, 58, 29, 50]]);
  assert.ok(result.proposal.cycles.length > 0);
  assert.ok(result.targetMetadata.every(meta => meta.deliveryDistribution === 'not-established' && meta.sourceVerification === 'not-verified'));
  for (const key of ['weeklyProductionKg', 'price', 'currency', 'revenue', 'observedHarvest', 'accept']) assert.equal(key in result, false);
});

test('selected targets are never skipped and missing profile choices, saleable share or pack weight stay held', async () => {
  const f = await fixture();
  held({ ...f, draft: { ...f.draft, targetProfiles: [] } }, 'selected-target-required');
  held({ ...f, draft: { ...f.draft, targetProfiles: [{ targetId: f.target.id, profileId: '' }] } }, 'selected-profile-required');
  const { marketablePercent: _share, ...unknownShare } = f.target;
  held({ ...f, book: { ...f.book, harvestTargets: [unknownShare] } }, 'target-saleable-share-missing');
  const { weeklyKg: _kg, ...base } = f.target;
  const pack = { ...base, weeklyQuantity: 7, unit: 'bunches' };
  held({ ...f, book: { ...f.book, harvestTargets: [pack] } as CropPlanState }, 'target-unit-weight-missing');
  const badSecond = { ...f.target, id: 'bad-selected-target', siteId: 'site:2.00000,2.00000' };
  held({ ...f, book: { ...f.book, harvestTargets: [f.target, badSecond] }, draft: { ...f.draft,
    targetProfiles: [...f.draft.targetProfiles, { targetId: badSecond.id, profileId: f.profile.profileId }] } }, 'target-scope-mismatch');
  held({ ...f, book: { ...f.book, growerPlanningProfiles: [{ ...f.profile, cropKey: CROPS[1].key }] } }, 'target-crop-identity-mismatch');
});

test('whole-book target and profile identity ambiguity cannot select the first matching source', async () => {
  const f = await fixture();
  held({ ...f, book: { ...f.book, harvestTargets: [f.target, { ...f.target, siteId: 'site:2.00000,2.00000' }] } }, 'selected-target-ambiguous');
  held({ ...f, book: { ...f.book, growerPlanningProfiles: [f.profile, { ...f.profile, version: 999 }] } as CropPlanState }, 'selected-profile-ambiguous');
  held({ ...f, draft: { ...f.draft, targetProfiles: [...f.draft.targetProfiles, ...f.draft.targetProfiles] } }, 'selected-target-ambiguous');
});

test('unchecked or absent dated availability never becomes a horizon-wide free interval', async () => {
  const f = await fixture();
  const result = review({ ...f, draft: { ...f.draft, available: f.draft.available.map(row => ({ ...row, start: '', endExclusive: '', confirmed: false })) } });
  assert.deepEqual(result.request.availability, []);
  assert.equal(result.proposal.cycles.length, 0);
  assert.equal(result.proposal.status, 'with-gaps');
  assert.ok(result.proposal.demandResults.some(row => row.reasons.includes('no-asserted-availability')));
  held({ ...f, draft: { ...f.draft, available: [{ ...f.draft.available[0], start: '' }] } }, 'availability-window-invalid');
});

test('zero or unknown own yield cannot borrow catalogue capacity or alter the buyer demand', async () => {
  const f = await fixture();
  for (const yieldInput of [own(0, 'kg/m2/cycle'), { state: 'missing', reason: 'not-known' } as const]) {
    const profile = { ...f.profile, inputs: { ...f.profile.inputs, yieldKgPerM2: yieldInput } };
    const result = review({ ...f, book: { ...f.book, growerPlanningProfiles: [profile] } });
    assert.deepEqual(result.request.profiles[0].inputs.yieldKgPerM2, yieldInput);
    assert.equal(result.proposal.cycles.length, 0);
    assert.equal(result.targetMetadata[0].buyerTotalKg, 29);
    assert.equal(result.targetMetadata[0].grossCapacityRequiredKg, 58);
    assert.equal(result.proposal.status, yieldInput.state === 'missing' ? 'missing-inputs' : 'with-gaps');
  }
});

test('all current own reservations remain in the request including a bed omitted from the available selection', async () => {
  const f = await fixture(); const row = accepted(f);
  f.book.plantings = [row];
  const result = review({ ...f, draft: { ...f.draft, available: f.draft.available.filter(available => available.bedId !== row.bedId) } });
  assert.equal(result.existingOwnCycles.length, 1);
  assert.equal(result.request.reserved.length, 1);
  const reserved = result.request.reserved[0];
  assert.equal(reserved.id, row.id); assert.equal(reserved.bedId, row.bedId);
  assert.deepEqual(reserved.window.state === 'provided' && reserved.window.value, result.existingOwnCycles[0].reservation);
  assert.equal(result.existingOwnCycles[0].reservation.endExclusive, result.existingOwnCycles[0].assessment.schedule.nextFieldEntryDate);
  const both = review(f);
  for (const cycle of both.proposal.cycles.filter(cycle => cycle.bedId === row.bedId)) {
    const schedule = cycle.assessment.schedule, window = both.existingOwnCycles[0].reservation;
    assert.ok(schedule.nextFieldEntryDate <= window.start || schedule.fieldEntryDate >= window.endExclusive, 'turnaround remains reserved too');
  }
});

test('legacy and held current-bed occupations block claimed availability without deleting the original book', async () => {
  const f = await fixture();
  const legacy = { id: 'old-sowing', bedId: f.source.beds[0].id, cropKey: f.profile.cropKey, sowMonth: 2 };
  for (const row of [legacy, { ...legacy, growerCycle: null }, { ...accepted(f), growerCycle: { kind: 'grower-dated-cycle', version: 999 } }]) {
    const input = { ...f, book: { ...f.book, plantings: [row] } };
    const before = JSON.stringify(input.book);
    const result = held(input, 'availability-bed-blocked');
    assert.ok(result.blockedBeds.some(bed => bed.bedId === row.bedId));
    const other = review({ ...input, draft: { ...f.draft, available: f.draft.available.filter(available => available.bedId !== row.bedId) } });
    assert.ok(other.proposal.cycles.length > 0);
    assert.ok(other.proposal.cycles.every(cycle => cycle.bedId !== row.bedId));
    assert.equal(JSON.stringify(input.book), before);
  }
});

test('unknown malformed associations hold the review even when they claim another scope', async () => {
  const f = await fixture();
  for (const row of [null, { id: 'unknown-place' }, { id: 'foreign-claim', bedId: 'not-current', growerCycle: {
    kind: 'grower-dated-cycle', version: 999, assessmentSnapshot: { scope: { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } } } }]) {
    held({ ...f, book: { ...f.book, plantings: [row] } as CropPlanState }, 'unresolved-row-association');
  }
});

test('duplicate canonical planting IDs are detected before foreign, corrupt or other-bed rows can be filtered', async () => {
  const f = await fixture(); const row = accepted(f);
  const duplicate = { id: row.id, bedId: 'another-place', growerCycle: { version: 999 } };
  for (const rows of [[row, duplicate], [duplicate, row], [duplicate, duplicate]]) {
    held({ ...f, book: { ...f.book, plantings: rows } as CropPlanState }, 'ambiguous-planting-identities');
  }
});

test('only intact own row identity in a distinct scope and disjoint bed permits a foreign exclusion', async () => {
  const f = await fixture(), foreign = await fixture('site:2.00000,2.00000', 'foreign');
  const foreignRow = accepted(foreign, 'foreign-own');
  const result = review({ ...f, book: { ...f.book, plantings: [foreignRow] } });
  assert.deepEqual(result.request.reserved, []);
  assert.ok(result.proposal.cycles.length > 0);
  held({ ...f, book: { ...f.book, plantings: [{ ...foreignRow, cropKey: CROPS[1].key }] } }, 'unresolved-row-association');
  const sharedIdentitySource = await fixture('site:2.00000,2.00000', 'current');
  const collision = accepted(sharedIdentitySource, 'foreign-collision');
  held({ ...f, book: { ...f.book, plantings: [collision] } }, 'availability-bed-blocked');
});

test('a well-shaped legacy record on a different bed remains unassessed without occupying or approving this source', async () => {
  const f = await fixture();
  const elsewhere = { id: 'legacy-other-bed', bedId: 'different-canonical-bed', cropKey: f.profile.cropKey, sowMonth: 2 };
  const result = review({ ...f, book: { ...f.book, plantings: [elsewhere] } });
  assert.deepEqual(result.request.reserved, []); assert.deepEqual(result.blockedBeds, []);
  assert.ok(result.proposal.cycles.length > 0);
});

test('a verified cloud source binds its exact design-keyed buyer target without relabelling it as coordinates', async () => {
  const f = await fixture();
  const data = buildDemoFacilitatorState();
  data.designId = 'cloud-fixture'; data.bgSite = { lat: 1, lon: 1, name: 'Synthetic source' };
  data.items = data.items.filter(item => item.type === 'bed').slice(0, 1).map(item => ({ ...item, id: 'current-1', wM: 3, hM: 4 }));
  data.lines = []; data.sectors = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'facilitator-cloud', sourceId: data.designId,
    raw: { id: data.designId, owner_id: 'synthetic-owner', data }, sourceRevision: 'synthetic-cloud-read-receipt' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic cloud source was held');
  const target = { ...f.target, siteId: 'design:cloud-fixture' };
  const input = { ...f, source, book: { ...f.book, harvestTargets: [target] }, draft: { ...f.draft, available: [f.draft.available[0]] } };
  const before = JSON.stringify(input.book);
  const result = review(input);
  assert.deepEqual(result.request.scope, f.scope);
  assert.equal(result.request.demands[0].demandId, target.id);
  assert.equal(JSON.stringify(input.book), before);
  assert.equal(input.book.harvestTargets[0].siteId, 'design:cloud-fixture');
  held({ ...input, book: { ...input.book, harvestTargets: [{ ...target, siteId: 'design:other' }] } }, 'target-scope-mismatch');
  held({ ...input, source: { ...source, resourceSiteId: 'design:other' } }, 'source-resource-mismatch');
});

test('review timestamps and provenance stay fixed across unchanged rechecks and no input editor is frozen or written', async () => {
  const f = await fixture();
  f.book.growerPlanningProfiles = [{ ...f.profile, inputs: { ...f.profile.inputs, yieldKgPerM2: {
    ...own(1, 'kg/m2/cycle'), provenance: { kind: 'grower-estimate', recordedAt: '2020-01-01T00:00:00.000Z' } } } }];
  const originalBook = JSON.stringify(f.book), originalDraft = JSON.stringify(f.draft);
  const first = review(f), second = review(f);
  assert.equal(first.proposal.fingerprint, second.proposal.fingerprint);
  assert.deepEqual(first.request, second.request);
  assert.equal(first.request.requestedAt, recordedAt);
  const ownYield = first.request.profiles[0].inputs.yieldKgPerM2;
  assert.equal(ownYield.state === 'provided' && ownYield.provenance.recordedAt, '2020-01-01T00:00:00.000Z');
  assert.equal(first.request.planningStart.state === 'provided' && first.request.planningStart.provenance.recordedAt, recordedAt);
  assert.ok(first.request.beds.every(bed => bed.measuredAreaM2.state === 'provided' && bed.measuredAreaM2.provenance.recordedAt === recordedAt));
  assert.ok(first.request.beds.every(bed => bed.measuredAreaM2.state === 'provided' && bed.measuredAreaM2.provenance.kind === 'grower-record'
    && bed.measuredAreaM2.provenance.reference.includes('not independently verified field area')));
  assert.equal(JSON.stringify(f.book), originalBook); assert.equal(JSON.stringify(f.draft), originalDraft);
  assert.equal(Object.isFrozen(f.book), false); assert.equal(Object.isFrozen(f.profile.inputs), false);
  assert.ok(Object.isFrozen(first.request)); assert.ok(Object.isFrozen(first.proposal));
});

test('scope, source measures, confirmation and explicit software budget are required rather than silently defaulted', async () => {
  const f = await fixture();
  held({ ...f, scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' } }, 'mapped-site-required');
  held({ ...f, source: null }, 'source-unavailable');
  held({ ...f, source: { ...f.source, measuredAreas: [] } }, 'source-measures-invalid');
  held({ ...f, source: { ...f.source, scope: { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } } }, 'source-scope-mismatch');
  held({ ...f, draft: { ...f.draft, assumptionsConfirmed: false } }, 'assumptions-confirmation-required');
  held({ ...f, draft: { ...f.draft, maxAssessments: '' } }, 'work-budget-required');
  held({ ...f, draft: { ...f.draft, maxAssessments: '10001' } }, 'work-budget-invalid');
  const limited = review({ ...f, draft: { ...f.draft, maxAssessments: '1' } });
  assert.equal(limited.request.maxAssessments, 1); assert.equal(limited.proposal.status, 'work-limit-exceeded');
  assert.equal(limited.proposal.cycles.length, 0);
});
