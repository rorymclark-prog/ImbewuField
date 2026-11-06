import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { crop, samples, ownRow, reset, cleanup, stamp } from './international-grower-operations-fixture.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';
import { growerCycleDemandSnapshotView, growerCycleOriginView, normaliseGrowerCycleAttachment,
  preserveGrowerCycleMarker, resolvePlantingBasis, type GrowerCycleOrigin } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint } from '../lib/international/grower-nursery.ts';
import { normaliseReportCropSnapshot } from '../lib/report-crop-plan.ts';

beforeEach(reset);
after(cleanup);
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> =>
  ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });

// Existing measured-source fixture; every quantity and duration is synthetic.
// Demand deliberately differs from a whole bed's capacity so inference is visible.
async function fixture(purpose: 'household' | 'trial' = 'household') {
  const original = await ownRow();
  const { source } = original;
  const saved = original.row.growerCycle.assessmentSnapshot.profile;
  const profile: GrowerPlanningProfile = { ...saved, inputs: { ...saved.inputs,
    establishment: own('transplant', 'method'), nurseryDays: own(2, 'days') } };
  const book: CropPlanState = { version: 1, updatedAt: 1, plantings: [], harvestTargets: [], growerPlanningProfiles: [profile] };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
    targetProfiles: [], demands: [{ kind: 'grower-entered', entryId: 'traceable-entry', purpose, profileId: profile.profileId,
      cropKey: profile.cropKey, grossKg: '1.25', harvestStart: '2028-12-10', harvestEndExclusive: '2028-12-14' }],
    available: source.beds.map(bed => ({ bedId: bed.id, start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true })),
    assumptionsConfirmed: true };
  const review = assembleGrowerWorkflowReview({ scope: source.scope, source, book, draft, recordedAt: stamp });
  assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('Synthetic entered review held');
  assert.equal(review.proposal.status, 'ready');
  const prepare = (bindingDraft = draft, currentReview = review) => prepareGrowerWorkflowAcceptance({ scope: source.scope, source,
    book, review: currentReview, binding: { source, draft: bindingDraft, recordedAt: stamp }, acceptedAt: stamp,
    plantingIds: currentReview.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `traceable-row-${index}` })) });
  const prepared = prepare();
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') throw Error('Synthetic acceptance held');
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const settings = { version: 1 as const, containers: [], spaces: [], profiles: [] };
  const nursery = (row: unknown) => buildGrowerNurseryForecast({ source: { kind: 'saved-cycles', rows: [row], cycleContext: context },
    resourceContext: source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window'),
    availability: own([], 'nursery-resource-windows'), otherReservations: own([], 'nursery-resource-reservations') });
  return { source, profile, book, draft, review, prepare, prepared, context, nursery };
}
const snapshotOf = (row: Planting) => {
  const attachment = normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(row).growerCycle);
  assert.ok(attachment);
  const view = growerCycleDemandSnapshotView(attachment);
  assert.equal(view.status, 'recorded');
  return view.status === 'recorded' ? view.demand : null;
};

for (const purpose of ['household', 'trial'] as const) test(`${purpose} acceptance retains the whole requested demand through actual book, projection, nursery and report copies`, async () => {
  const f = await fixture(purpose), row = f.prepared.rows[0], expected = f.review.request.demands[0];
  assert.equal(row.harvestTargetId, undefined);
  assert.equal(expected.totalKg.state, 'provided');
  assert.equal(expected.harvestWindow.state, 'provided');
  assert.deepEqual(snapshotOf(row), expected);
  if (expected.totalKg.state !== 'provided' || expected.harvestWindow.state !== 'provided') return;
  assert.equal(expected.totalKg.value, 1.25);
  assert.equal(expected.totalKg.unit, 'kg-total');
  assert.equal(expected.totalKg.provenance.kind, 'grower-estimate');
  assert.deepEqual(expected.harvestWindow.value, { start: '2028-12-10', endExclusive: '2028-12-14' });
  assert.equal(expected.harvestWindow.provenance.kind, 'grower-estimate');
  const written = crop.saveCropPlanWithReceipt(f.prepared.book);
  assert.equal(written.saved, true);
  const raw = crop.readRawCropPlanReceipt(); assert.equal(raw.status, 'ready');
  if (raw.status !== 'ready') return;
  assert.deepEqual(snapshotOf((raw.raw as CropPlanState).plantings[0]), expected);
  const loaded = crop.loadCropPlan().plantings[0];
  assert.deepEqual(snapshotOf(loaded), expected);
  const projected = projectGrowerCycles([loaded], f.context).ownCycles[0];
  assert.notEqual(projected.totalCycleKg, expected.totalKg.value, 'allocated output must not substitute for requested input');
  assert.notEqual(projected.assessment.schedule.harvestEndExclusiveDate, expected.harvestWindow.value.endExclusive,
    'the requested window must not shrink to this cycle’s picking interval');
  assert.equal(projected.origin?.status, 'recorded');
  if (projected.origin?.status === 'recorded' && projected.origin.origin.kind === 'grower-entered') {
    assert.equal(projected.origin.origin.purpose, purpose);
    assert.deepEqual(projected.origin.origin.demandSnapshot, expected);
  }
  const nursery = f.nursery(loaded);
  assert.equal(nursery.batches.length, 1);
  assert.deepEqual(nursery.batches[0].origin, { status: 'recorded', origin: row.growerCycle.origin });
  const report = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1,
    beds: f.source.beds, plantings: [loaded], outlines: [] });
  assert.ok(report);
  assert.deepEqual(snapshotOf(report.plantings[0]), expected);
});

test('a legacy purpose-only origin explicitly lacks requested input and is never filled from its planned cycle', async () => {
  const f = await fixture(), row = f.prepared.rows[0];
  const origin = row.growerCycle.origin;
  assert.ok(origin?.kind === 'grower-entered');
  // Historical purpose-only records predate both the snapshot and authored unit/text.
  // Keeping the new unit/text without its snapshot would represent damaged new evidence.
  const { demandSnapshot: _snapshot, quantityEntry: _quantity, ...oldOrigin } = origin;
  const old = { ...row, growerCycle: { ...row.growerCycle, origin: oldOrigin } };
  const attachment = normaliseGrowerCycleAttachment(old.growerCycle); assert.ok(attachment);
  assert.deepEqual(growerCycleDemandSnapshotView(attachment), { status: 'not-recorded' });
  assert.equal(crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [old] }).saved, true);
  const loaded = crop.loadCropPlan().plantings[0];
  const stored = normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(loaded).growerCycle); assert.ok(stored);
  assert.deepEqual(growerCycleDemandSnapshotView(stored), { status: 'not-recorded' });
  assert.equal('demandSnapshot' in stored.origin!, false);
  assert.equal('quantityEntry' in stored.origin!, false);
  assert.equal(f.nursery(loaded).batches[0].origin?.status, 'recorded', 'known purpose is independent of missing request input');
});

test('present malformed, lossy or mismatched demand snapshots hold through marker and nursery copies', async () => {
  const f = await fixture(), row = f.prepared.rows[0], expected = f.review.request.demands[0];
  const changed = (patch: Record<string, unknown>) => ({ ...structuredClone(expected), ...patch });
  const malformed: unknown[] = [null, undefined, false, {}, changed({ extra: 'unrecognised' }), changed({ extra: undefined }), changed({ demandId: 'other-demand' }),
    changed({ profileId: 'other-profile' }), changed({ scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } }),
    changed({ totalKg: own(0, 'kg-total') }), changed({ totalKg: { state: 'missing', reason: 'not-entered' } }),
    changed({ harvestWindow: { state: 'missing', reason: 'not-entered' } }),
    changed({ harvestWindow: own({ start: '2028-12-20', endExclusive: '2028-12-24' }, 'utc-date-window') }),
    changed({ totalKg: { ...own(1.25, 'kg-total'), provenance: { kind: 'grower-record', recordedAt: stamp, reference: 'not an entered estimate' } } })];
  for (const demandSnapshot of malformed) {
    const damaged = { ...row, growerCycle: { ...row.growerCycle,
      origin: { ...row.growerCycle.origin, demandSnapshot } } };
    assert.equal(normaliseGrowerCycleAttachment(damaged.growerCycle), null);
    const copy = JSON.parse(JSON.stringify({ ...damaged, ...preserveGrowerCycleMarker(damaged) }));
    assert.equal(resolvePlantingBasis(copy, f.context).kind, 'held');
    const projection = projectGrowerCycles([copy], f.context);
    assert.equal(projection.ownCycles.length, 0); assert.equal(projection.legacyRows.length, 0);
    assert.equal(f.nursery(damaged).batches.length, 0);
    const written = crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [damaged as unknown as Planting] });
    assert.equal(written.saved, true, 'safe malformed evidence is retained, not repaired or discarded');
    const loaded = crop.loadCropPlan().plantings[0];
    assert.equal(resolvePlantingBasis(loaded, f.context).kind, 'held');
    assert.equal(f.nursery(loaded).batches.length, 0);
  }
});

test('equivalent JSON key order remains readable without mutating or freezing the saved request', async () => {
  const f = await fixture(), row = f.prepared.rows[0], demand = f.review.request.demands[0];
  const reorder = (_key: string, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).reverse()) : value;
  const demandSnapshot = JSON.parse(JSON.stringify(demand, reorder));
  const raw = { ...row.growerCycle, origin: { ...row.growerCycle.origin, demandSnapshot } };
  const parsed = normaliseGrowerCycleAttachment(raw); assert.ok(parsed);
  assert.deepEqual(growerCycleDemandSnapshotView(parsed), { status: 'recorded', demand });
  assert.equal(Object.isFrozen(demandSnapshot), false);
  assert.equal(Object.isFrozen(demandSnapshot.scope), false);
});

test('snapshot accessors execute zero times and optional sample omission cannot erase malformed request presence', async () => {
  const f = await fixture(), row = f.prepared.rows[0]; let calls = 0;
  const origin = { ...row.growerCycle.origin } as Record<string, unknown>;
  Object.defineProperty(origin, 'demandSnapshot', { enumerable: true, get() { calls++; return f.review.request.demands[0]; } });
  assert.equal(normaliseGrowerCycleAttachment({ ...row.growerCycle, origin }), null);
  assert.equal(calls, 0);
  assert.equal(samples.enterSampleMode(), true);
  const damaged = { ...row, growerCycle: { ...row.growerCycle, origin: { ...row.growerCycle.origin, demandSnapshot: undefined } } };
  samples.setSandboxCropPlan({ version: 1, updatedAt: 1, plantings: [damaged] } as unknown as CropPlanState);
  const receipt = crop.readRawCropPlanReceipt(); assert.equal(receipt.status, 'ready');
  if (receipt.status !== 'ready') return;
  assert.equal(resolvePlantingBasis((receipt.raw as CropPlanState).plantings[0], f.context).kind, 'held');
  assert.equal(damaged.growerCycle.origin.demandSnapshot, undefined);
});

test('request views detach nested intent rather than freeze or alias a caller editor', async () => {
  const f = await fixture(), row = f.prepared.rows[0];
  const editable = structuredClone(row.growerCycle.origin) as unknown as { demandSnapshot: { totalKg: { value: number } } };
  const attachment = { origin: editable as unknown as GrowerCycleOrigin };
  const view = growerCycleDemandSnapshotView(attachment), originView = growerCycleOriginView(attachment);
  assert.equal(Object.isFrozen(editable), false);
  editable.demandSnapshot.totalKg.value = 99;
  assert.equal(view.status, 'recorded');
  if (view.status === 'recorded' && view.demand.totalKg.state === 'provided') assert.equal(view.demand.totalKg.value, 1.25);
  assert.equal(originView.status, 'recorded');
  if (originView.status === 'recorded' && originView.origin.kind === 'grower-entered'
    && originView.origin.demandSnapshot?.totalKg.state === 'provided') assert.equal(originView.origin.demandSnapshot.totalKg.value, 1.25);
});

test('post-review purpose, weight or window edits require a fresh review and do not mint stale demand intent', async () => {
  const f = await fixture(), before = JSON.stringify(f.book), first = f.draft.demands![0];
  assert.equal(first.kind, 'grower-entered');
  if (first.kind !== 'grower-entered') return;
  // This fixture edits the legacy kg branch. Adding grossKg to a unit-bearing
  // request would instead test the deliberately held ambiguous-entry shape.
  assert.equal(Object.hasOwn(first, 'quantityEntry'), false);
  if (typeof first.grossKg !== 'string') throw Error('Expected the legacy kg fixture');
  for (const patch of [{ purpose: 'trial' as const }, { grossKg: '2.5' }, { harvestEndExclusive: '2028-12-15' }]) {
    const draft = { ...f.draft, demands: [{ ...first, ...patch }] };
    const held = f.prepare(draft); assert.equal(held.status, 'held');
    if (held.status === 'held') assert.ok(held.reasons.includes('review-no-longer-current'));
    const fresh = assembleGrowerWorkflowReview({ scope: f.source.scope, source: f.source, book: f.book, draft, recordedAt: stamp });
    assert.equal(fresh.status, 'review');
    if (fresh.status !== 'review') return;
    const prepared = f.prepare(draft, fresh); assert.equal(prepared.status, 'prepared');
    if (prepared.status === 'prepared') assert.deepEqual(snapshotOf(prepared.rows[0]), fresh.request.demands[0]);
  }
  for (const grossKg of ['', '0']) {
    const draft: GrowerWorkflowDraft = { ...f.draft, demands: [{ ...first, grossKg }] };
    const review = assembleGrowerWorkflowReview({ scope: f.source.scope, source: f.source, book: f.book, draft, recordedAt: stamp });
    assert.equal(review.status, 'review');
    if (review.status !== 'review') return;
    assert.equal(review.proposal.cycles.length, 0);
    assert.equal(f.prepare(draft, review).status, 'held');
  }
  assert.equal(JSON.stringify(f.book), before);
});
