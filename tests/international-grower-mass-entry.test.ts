import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { crop, samples, ownRow, reset, cleanup, stamp } from './international-grower-operations-fixture.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerEnteredDemandEntry } from '../lib/international/grower-entered-demand.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';
import { growerCycleQuantityEntryView, normaliseGrowerCycleAttachment, normaliseGrowerCycleOrigin, preserveGrowerCycleMarker, resolvePlantingBasis } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint } from '../lib/international/grower-nursery.ts';
import { normaliseReportCropSnapshot } from '../lib/report-crop-plan.ts';
import { readMassQuantityEntry, type MassQuantityEntry } from '../lib/mass-units.ts';

beforeEach(reset);
after(cleanup);
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> =>
  ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });

// All amounts, dates and estimate inputs below are engineering fixtures using
// the existing catalogue. They are not household or agronomic recommendations.
async function fixture(weight: { quantityEntry: MassQuantityEntry } | { grossKg: string } = { quantityEntry: { unit: 'lb', text: ' 00.10 ' } }) {
  const original = await ownRow(), { source } = original;
  const saved = original.row.growerCycle.assessmentSnapshot.profile;
  const profile: GrowerPlanningProfile = { ...saved, inputs: { ...saved.inputs,
    establishment: own('transplant', 'method'), nurseryDays: own(2, 'days') } };
  const book: CropPlanState = { version: 1, updatedAt: 1, plantings: [], harvestTargets: [], growerPlanningProfiles: [profile] };
  const entry: GrowerEnteredDemandEntry = { kind: 'grower-entered', entryId: 'mass-entry', purpose: 'household',
    profileId: profile.profileId, cropKey: profile.cropKey, harvestStart: '2028-12-10', harvestEndExclusive: '2028-12-14', ...weight };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
    targetProfiles: [], demands: [entry], assumptionsConfirmed: true,
    available: source.beds.map(bed => ({ bedId: bed.id, start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true })) };
  const reviewFor = (currentDraft: GrowerWorkflowDraft) => assembleGrowerWorkflowReview({ scope: source.scope, source, book, draft: currentDraft, recordedAt: stamp });
  const review = reviewFor(draft);
  assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('Synthetic mass review held');
  assert.equal(review.proposal.status, 'ready');
  const prepare = (currentDraft = draft, currentReview = review) => prepareGrowerWorkflowAcceptance({ scope: source.scope, source, book,
    review: currentReview, binding: { source, draft: currentDraft, recordedAt: stamp }, acceptedAt: stamp,
    plantingIds: currentReview.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `mass-row-${index}` })) });
  const prepared = prepare();
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') throw Error('Synthetic mass acceptance held');
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const settings = { version: 1 as const, containers: [], spaces: [], profiles: [] };
  const nursery = (row: unknown) => buildGrowerNurseryForecast({ source: { kind: 'saved-cycles', rows: [row], cycleContext: context },
    resourceContext: source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window'),
    availability: own([], 'nursery-resource-windows'), otherReservations: own([], 'nursery-resource-reservations') });
  return { source, profile, book, entry, draft, review, prepared, prepare, reviewFor, context, nursery };
}

for (const weight of [{ quantityEntry: { unit: 'lb' as const, text: ' 00.10 ' } },
  { quantityEntry: { unit: 'kg' as const, text: '0,12500000' } }, { grossKg: '001.250000' }]) {
  test(`fresh ${'grossKg' in weight ? 'legacy kg' : weight.quantityEntry.unit} authorship survives actual JSON book, projection, nursery and report readback`, async () => {
    const f = await fixture(weight), row = f.prepared.rows[0];
    const expected = 'grossKg' in weight ? { unit: 'kg' as const, text: weight.grossKg } : weight.quantityEntry;
    const mass = readMassQuantityEntry(expected); assert.equal(mass.status, 'provided');
    const demand = f.review.request.demands[0]; assert.equal(demand.totalKg.state, 'provided');
    if (mass.status !== 'provided' || demand.totalKg.state !== 'provided') return;
    assert.equal(demand.totalKg.value, mass.kilograms);
    assert.equal(demand.totalKg.provenance.kind, 'grower-estimate');
    assert.deepEqual(f.review.enteredDemandMetadata?.[0].quantityEntry, expected);
    const read = (value: unknown) => {
      const attachment = normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(value).growerCycle);
      assert.ok(attachment);
      assert.deepEqual(growerCycleQuantityEntryView(attachment), { status: 'recorded', entry: expected });
      assert.equal(attachment.origin?.kind, 'grower-entered');
      if (attachment.origin?.kind === 'grower-entered') assert.deepEqual(attachment.origin.demandSnapshot, demand);
    };
    read(row); assert.equal(row.harvestTargetId, undefined);
    assert.equal(crop.saveCropPlanWithReceipt(f.prepared.book).saved, true);
    const raw = crop.readRawCropPlanReceipt(); assert.equal(raw.status, 'ready');
    if (raw.status === 'ready') read((raw.raw as CropPlanState).plantings[0]);
    const loaded = crop.loadCropPlan().plantings[0]; read(loaded);
    const projected = projectGrowerCycles([loaded], f.context).ownCycles[0];
    assert.equal(projected.origin?.status, 'recorded');
    if (projected.origin?.status === 'recorded') assert.deepEqual(growerCycleQuantityEntryView({ origin: projected.origin.origin }),
      { status: 'recorded', entry: expected });
    const batch = f.nursery(loaded).batches[0];
    assert.equal(batch.origin?.status, 'recorded');
    if (batch.origin?.status === 'recorded') assert.deepEqual(growerCycleQuantityEntryView({ origin: batch.origin.origin }),
      { status: 'recorded', entry: expected });
    const report = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1,
      beds: f.source.beds, plantings: [loaded], outlines: [] });
    assert.ok(report); read(report.plantings[0]);
    assert.equal(Object.isFrozen(weight), false, 'entry reading must not freeze the caller editor');
  });
}

test('equivalent canonical kg with changed authored text or unit still requires a fresh review', async () => {
  const f = await fixture({ quantityEntry: { unit: 'lb', text: '1' } });
  const { grossKg: _legacy, quantityEntry: _authored, ...common } = f.entry;
  const canonical = f.review.request.demands[0].totalKg;
  assert.equal(canonical.state, 'provided'); if (canonical.state !== 'provided') return;
  for (const quantityEntry of [{ unit: 'lb' as const, text: '1.0' }, { unit: 'kg' as const, text: String(canonical.value) }]) {
    const draft: GrowerWorkflowDraft = { ...f.draft, demands: [{ ...common, quantityEntry }] };
    const stale = f.prepare(draft); assert.equal(stale.status, 'held');
    if (stale.status === 'held') assert.ok(stale.reasons.includes('review-no-longer-current'));
    const review = f.reviewFor(draft); assert.equal(review.status, 'review');
    if (review.status !== 'review') continue;
    assert.deepEqual(review.request, f.review.request, 'authored spelling changes despite identical canonical engine input');
    const prepared = f.prepare(draft, review); assert.equal(prepared.status, 'prepared');
    if (prepared.status === 'prepared') assert.deepEqual(growerCycleQuantityEntryView(prepared.rows[0].growerCycle),
      { status: 'recorded', entry: quantityEntry });
  }
});

test('actual assembly and replay hold mixed or present-undefined quantity branches before JSON can omit them', async () => {
  const f = await fixture();
  const { quantityEntry: _quantity, ...common } = f.entry;
  const invalidEntries = [{ ...f.entry, grossKg: '' }, { ...f.entry, grossKg: undefined },
    { ...common, grossKg: '1', quantityEntry: undefined }, { ...common, quantityEntry: undefined },
    { ...common, quantityEntry: { unit: 'lb', text: undefined } },
    { ...common, quantityEntry: { unit: 'lb', text: '1', extra: undefined } }];
  let calls = 0;
  const accessor = { ...common };
  Object.defineProperty(accessor, 'quantityEntry', { enumerable: true, get() { calls++; return { unit: 'lb', text: '1' }; } });
  for (const entry of [...invalidEntries, accessor]) {
    const draft = { ...f.draft, demands: [entry] } as unknown as GrowerWorkflowDraft;
    assert.equal(f.reviewFor(draft).status, 'held');
    assert.equal(f.prepare(draft).status, 'held');
  }
  assert.equal(calls, 0);
  for (const text of ['', '  ', '0']) {
    const { grossKg: _legacy, quantityEntry: _authored, ...entry } = f.entry;
    const draft: GrowerWorkflowDraft = { ...f.draft, demands: [{ ...entry, quantityEntry: { unit: 'lb', text } }] };
    const review = f.reviewFor(draft); assert.equal(review.status, 'review');
    if (review.status !== 'review') continue;
    assert.equal(review.request.demands[0].totalKg.state, text.trim() ? 'provided' : 'missing');
    assert.equal(review.proposal.cycles.length, 0);
    assert.equal(f.prepare(draft, review).status, 'held');
  }
});

test('old origin and canonical snapshot rows explicitly lack original unit/text rather than infer it from kg', async () => {
  const f = await fixture(), row = f.prepared.rows[0], origin = row.growerCycle.origin;
  assert.ok(origin?.kind === 'grower-entered');
  const { quantityEntry: _entry, ...snapshotOnly } = origin;
  const { demandSnapshot: _snapshot, ...purposeOnly } = snapshotOnly;
  for (const oldOrigin of [snapshotOnly, purposeOnly]) {
    const old = { ...row, growerCycle: { ...row.growerCycle, origin: oldOrigin } };
    const attachment = normaliseGrowerCycleAttachment(old.growerCycle); assert.ok(attachment);
    assert.deepEqual(growerCycleQuantityEntryView(attachment), { status: 'not-recorded' });
    assert.equal(crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [old] }).saved, true);
    const loaded = crop.loadCropPlan().plantings[0];
    const saved = normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(loaded).growerCycle); assert.ok(saved);
    assert.deepEqual(growerCycleQuantityEntryView(saved), { status: 'not-recorded' });
    assert.equal(f.nursery(loaded).batches[0].origin?.status, 'recorded');
  }
  assert.equal(normaliseGrowerCycleAttachment({ ...row.growerCycle, origin: { ...purposeOnly, quantityEntry: origin.quantityEntry } }), null,
    'authored evidence without its canonical demand cannot be checked');
  assert.equal(normaliseGrowerCycleOrigin({ kind: 'buyer-target', harvestTargetId: 'buyer-1',
    quantityEntry: origin.quantityEntry }, 'buyer-1'), null, 'buyer targets cannot acquire entered-demand evidence');
});

test('malformed authored evidence stays held through actual canonical, sample, projection, nursery and report copies', async () => {
  const f = await fixture(), row = f.prepared.rows[0];
  const malformed: unknown[] = [null, undefined, false, {}, { unit: 'oz', text: '1' }, { unit: 'lb', text: '2' },
    { unit: 'kg', text: '10.1234567890123' }, { unit: 'lb', text: '10.1234567890123' },
    { unit: 'lb', text: '0' }, { unit: 'lb', text: '' }, { unit: 'lb', text: '0.1', extra: undefined }];
  let calls = 0;
  const accessor = { unit: 'lb' };
  Object.defineProperty(accessor, 'text', { enumerable: true, get() { calls++; return '0.1'; } });
  malformed.push(accessor);
  const hidden = { unit: 'lb' };
  Object.defineProperty(hidden, 'text', { value: '0.1', enumerable: false }); malformed.push(hidden);
  for (const quantityEntry of malformed) {
    const damaged = { ...row, growerCycle: { ...row.growerCycle, origin: { ...row.growerCycle.origin, quantityEntry } } };
    assert.equal(normaliseGrowerCycleAttachment(damaged.growerCycle), null);
    const copy = JSON.parse(JSON.stringify({ ...damaged, ...preserveGrowerCycleMarker(damaged) }));
    assert.equal(resolvePlantingBasis(copy, f.context).kind, 'held');
    const projection = projectGrowerCycles([copy], f.context);
    assert.equal(projection.ownCycles.length, 0); assert.equal(projection.legacyRows.length, 0);
    assert.equal(f.nursery(damaged).batches.length, 0);
    if (quantityEntry === accessor || quantityEntry === hidden) {
      // A canonical writer must refuse unsafe authored descriptors. The
      // existing marker boundary produces a detached durable hold; persisting
      // that copy is separate from permission to evaluate the original source.
      const before = crop.readRawCropPlanReceipt(); assert.equal(before.status, 'ready');
      const descriptor = Object.getOwnPropertyDescriptor(quantityEntry, 'text');
      assert.equal(crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [damaged as unknown as Planting] }).saved, false);
      const after = crop.readRawCropPlanReceipt(); assert.equal(after.status, 'ready');
      if (before.status === 'ready' && after.status === 'ready') {
        assert.equal(after.token, before.token);
        assert.deepEqual(after.raw, before.raw);
      }
      assert.deepEqual(Object.getOwnPropertyDescriptor(quantityEntry, 'text'), descriptor);
      assert.equal(calls, 0);
      assert.equal(crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [copy] }).saved, true);
    } else {
      assert.equal(crop.saveCropPlanWithReceipt({ ...f.prepared.book, plantings: [damaged as unknown as Planting] }).saved, true);
    }
    const loaded = crop.loadCropPlan().plantings[0];
    assert.equal(resolvePlantingBasis(loaded, f.context).kind, 'held');
    const report = normaliseReportCropSnapshot({ siteId: f.source.resourceSiteId, capturedAt: stamp, planUpdatedAt: 1,
      beds: f.source.beds, plantings: [damaged as unknown as Planting], outlines: [] });
    assert.ok(report); assert.equal(resolvePlantingBasis(report.plantings[0], f.context).kind, 'held');
    assert.equal(samples.enterSampleMode(), true);
    samples.setSandboxCropPlan({ ...f.prepared.book, plantings: [damaged as unknown as Planting] });
    const sample = crop.readRawCropPlanReceipt();
    if (sample.status === 'ready') assert.equal(resolvePlantingBasis((sample.raw as CropPlanState).plantings[0], f.context).kind, 'held');
    else assert.equal(sample.status, 'held');
    samples.exitSampleMode();
  }
  assert.equal(calls, 0);
});
