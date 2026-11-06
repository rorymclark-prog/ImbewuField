import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { crop, samples, ownRow, reset, cleanup, stamp } from './international-grower-operations-fixture.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { createGrowerCyclePlanting, normaliseGrowerCycleAttachment, preserveGrowerCycleMarker,
  resolvePlantingBasis, type GrowerCycleCreation } from '../lib/international/grower-cycle.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint } from '../lib/international/grower-nursery.ts';

beforeEach(reset);
after(cleanup);
const enteredId = 'grower-entered:boundary-entry';
const origin = { kind: 'grower-entered', purpose: 'household', entryId: 'boundary-entry' } as const;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> =>
  ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });

// Reuse the existing measured-source fixture. All quantities and durations below
// are engineering inputs, not recommendations or observations from a farm.
async function fixture(demandId = enteredId) {
  const original = await ownRow();
  const { source } = original;
  const savedProfile = original.row.growerCycle.assessmentSnapshot.profile;
  const profile: GrowerPlanningProfile = { ...savedProfile, inputs: { ...savedProfile.inputs,
    establishment: own('transplant', 'method'), nurseryDays: own(2, 'days') } };
  const window = { start: '2028-12-01', endExclusive: '2029-01-01' };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope,
    geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own(window.start, 'utc-date'), planningEndExclusive: own(window.endExclusive, 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own(window, 'utc-date-window') })),
    reserved: [], maxAssessments: 1000, demands: [{ demandId, profileId: profile.profileId, scope: source.scope,
      totalKg: own(1, 'kg-total'), harvestWindow: own({ start: '2028-12-10', endExclusive: '2028-12-12' }, 'utc-date-window') }] };
  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const options: GrowerCycleCreation = { plantingId: 'boundary-row', acceptedAt: stamp,
    geometryFingerprint: source.geometryFingerprint };
  const cycle = proposal.cycles[0];
  const row = createGrowerCyclePlanting(cycle, options);
  assert.ok(row);
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  return { source, profile, request, options, cycle, row, context, window };
}

test('an existing buyer identity is not retroactively reserved by the new entered-demand namespace', async () => {
  const f = await fixture();
  const target: HarvestTarget = { id: enteredId, siteId: f.source.resourceSiteId, cropKey: f.profile.cropKey,
    startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 1, marketablePercent: 100 };
  const book: CropPlanState = { version: 1, updatedAt: 1, plantings: [],
    harvestTargets: [target], growerPlanningProfiles: [f.profile] };
  const draft: GrowerWorkflowDraft = { planningStart: f.window.start, planningEndExclusive: f.window.endExclusive,
    maxAssessments: '1000', targetProfiles: [{ targetId: target.id, profileId: f.profile.profileId }],
    assumptionsConfirmed: true, available: f.source.beds.map(bed => ({ bedId: bed.id, ...f.window, confirmed: true })) };
  const review = assembleGrowerWorkflowReview({ scope: f.source.scope, source: f.source, book, draft, recordedAt: stamp });
  assert.equal(review.status, 'review');
  if (review.status !== 'review') throw Error('The synthetic buyer review was held');
  assert.equal(review.proposal.status, 'ready');
  const prepared = prepareGrowerWorkflowAcceptance({ scope: f.source.scope, source: f.source, book, review,
    binding: { source: f.source, draft, recordedAt: stamp }, acceptedAt: stamp,
    plantingIds: review.proposal.cycles.map((cycle, index) => ({ cycleId: cycle.cycleId, plantingId: `boundary-buyer-${index}` })) });
  assert.equal(prepared.status, 'prepared', prepared.status === 'held' ? prepared.reasons.join(',') : '');
  if (prepared.status !== 'prepared') return;
  assert.ok(prepared.rows.length > 0);
  for (const row of prepared.rows) {
    assert.equal(row.harvestTargetId, target.id);
    assert.deepEqual(row.growerCycle.origin, { kind: 'buyer-target', harvestTargetId: target.id });
    assert.equal(resolvePlantingBasis(row, f.context).kind, 'grower-dated-cycle');
  }
});

test('inherited creation intent is held rather than silently recorded as unknown, with no getter calls', async () => {
  const f = await fixture(); let calls = 0;
  for (const inherited of [{ origin }, Object.defineProperty({}, 'origin', { get() { calls++; return origin; } })]) {
    const options = Object.assign(Object.create(inherited), f.options) as GrowerCycleCreation;
    assert.equal(createGrowerCyclePlanting(f.cycle, options), null);
  }
  assert.equal(calls, 0);
  assert.ok(createGrowerCyclePlanting(f.cycle, f.options), 'genuinely absent legacy origin remains supported');
});

test('a hidden origin stays held through marker copies instead of disappearing into the legacy path', async () => {
  const f = await fixture();
  for (const value of [origin, null, undefined]) {
    const attachment = Object.defineProperty({ ...f.row.growerCycle }, 'origin', { value, enumerable: false });
    assert.equal(normaliseGrowerCycleAttachment(attachment), null);
    const raw = { ...f.row, growerCycle: attachment };
    const stored = JSON.parse(JSON.stringify({ ...raw, ...preserveGrowerCycleMarker(raw) }));
    assert.equal(resolvePlantingBasis(stored, f.context).kind, 'held');
  }
});

test('the actual sample raw receipt retains held nested intent while harmless optional metadata still omits normally', async () => {
  const f = await fixture(); assert.equal(samples.enterSampleMode(), true);
  for (const badOrigin of [undefined, { ...origin, extra: undefined }]) {
    const row = { ...f.row, growerCycle: { ...f.row.growerCycle, origin: badOrigin } };
    samples.setSandboxCropPlan({ version: 1, updatedAt: 1, plantings: [row], planNotes: undefined } as unknown as CropPlanState);
    const receipt = crop.readRawCropPlanReceipt();
    assert.equal(receipt.status, 'ready', 'safe malformed marker evidence remains available for a held projection');
    if (receipt.status !== 'ready') throw Error('The synthetic sample receipt was held');
    const kept = (receipt.raw as CropPlanState).plantings[0];
    assert.equal(resolvePlantingBasis(kept, f.context).kind, 'held');
    assert.equal((samples.getSandboxCropPlan()!.plantings[0] as typeof row).growerCycle.origin, badOrigin,
      'reading must not repair the original sample evidence');
  }
  const valid = createGrowerCyclePlanting(f.cycle, { ...f.options, origin }); assert.ok(valid);
  samples.setSandboxCropPlan({ version: 1, updatedAt: 1, plantings: [valid], planNotes: undefined });
  const receipt = crop.readRawCropPlanReceipt(); assert.equal(receipt.status, 'ready');
  if (receipt.status !== 'ready') return;
  assert.equal(resolvePlantingBasis((receipt.raw as CropPlanState).plantings[0], f.context).kind, 'grower-dated-cycle');
  assert.equal('planNotes' in (receipt.raw as object), false);
});

test('saved nursery source snapshots cannot omit undefined intent and turn held rows into raising batches', async () => {
  const f = await fixture();
  const settings = { version: 1 as const, containers: [], spaces: [], profiles: [] };
  const forecast = (row: unknown) => buildGrowerNurseryForecast({ source: { kind: 'saved-cycles', rows: [row], cycleContext: f.context },
    resourceContext: f.source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own(f.window, 'utc-date-window'), availability: own([], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') });
  const valid = createGrowerCyclePlanting(f.cycle, { ...f.options, origin }); assert.ok(valid);
  assert.equal(forecast(valid).batches.length, 1, 'the same valid transplant must reach the real batch reader');
  for (const badOrigin of [undefined, { ...origin, extra: undefined }]) {
    const raw: { growerCycle: Record<string, unknown> } = { ...valid, growerCycle: { ...valid.growerCycle, origin: badOrigin } };
    const result = forecast(raw);
    assert.equal(result.batches.length, 0);
    assert.ok(result.issues.length > 0);
    assert.equal(raw.growerCycle.origin, badOrigin);
  }
});
