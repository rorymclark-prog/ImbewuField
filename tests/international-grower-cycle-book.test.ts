import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import { CROPS, hasPlanningYield } from '../lib/crop-catalog.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, hasGrowerCycleMarker, resolvePlantingBasis } from '../lib/international/grower-cycle.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import { createProvisionalCycleContext, createSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === './firebase/init' && context.parentURL?.endsWith('/lib/account-local-storage.ts')) return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const isBackendConfigured=()=>false;export const getFirebase=()=>null;'),
  };
  return next(specifier, context);
} });
class Storage {
  rows = new Map<string, string>(); fail = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw Error('quota'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.fail = false; }
}
const local = new Storage(), session = new Storage();
Object.assign(globalThis, { Storage, localStorage: local, sessionStorage: session,
  window: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }) });
const book = await import('../lib/crop-plan.ts');
const { enterSampleMode, exitSampleMode, getSandboxCropPlan, setSandboxCropPlan } = await import('../lib/sample-mode.ts');
after(() => hooks.deregister());
const crop = CROPS.find(crop => !crop.transplant && crop.timingVerified !== false && hasPlanningYield(crop) && crop.fieldSpacingVerified !== false)!;
assert.ok(crop, 'positive legacy controls need an existing verified direct crop');
const bed = { id: 'fixture-bed', label: 'Measured storage fixture', areaM2: 12 };
const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
const context = { scope, beds: [bed], geometryFingerprint: 'fixture-source-geometry' };
const recordedAt = '2024-11-01T00:00:00.000Z';
const storageKey = 'imbewu_crop_plan_v2';
const provided = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
function ownFixture() {
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'saved-fixture-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: provided(2, 'plants/m2'), yieldKgPerM2: provided(3, 'kg/m2/cycle'),
    establishment: provided('transplant', 'method'), nurseryDays: provided(10, 'days'),
    fieldEntryToFirstHarvestDays: provided(2, 'days'), pickingDays: provided(3, 'days'),
    fieldOccupancyDays: provided(5, 'days'), turnaroundDays: provided(1, 'days'), allowedEntryMonths: provided([12], 'utc-months'),
  } };
  const proposal = generateGrowerAutoPlan({ requestedAt: recordedAt, scope, geometryFingerprint: context.geometryFingerprint,
    profiles: [profile], beds: [{ bed, scope, measuredAreaM2: provided(bed.areaM2, 'm2') }],
    planningStart: provided('2024-12-01', 'utc-date'), planningEndExclusive: provided('2025-02-01', 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: provided({ start: '2024-12-01', endExclusive: '2025-02-01' }, 'utc-date-window') }], reserved: [],
    demands: [{ demandId: 'fixture-demand', profileId: profile.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: '2025-01-02', endExclusive: '2025-01-05' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'own-fixture-row', acceptedAt: recordedAt, geometryFingerprint: context.geometryFingerprint });
  assert.ok(row); return { row, profile };
}
function plan(plantings: Planting[], profiles?: GrowerPlanningProfile[]): CropPlanState {
  return { version: 1, plantings, updatedAt: 7, ...(profiles ? { growerPlanningProfiles: profiles } : {}) };
}
async function reset() { releaseCropPlanFixture(); exitSampleMode(); local.clear(); session.clear(); await initialiseCropPlanFixture(); }
const legacy = (): Planting => ({ id: 'legacy-fixture', bedId: bed.id, cropKey: crop.key, sowMonth: crop.sowMonths.summer[0] ?? 1 });

test('the canonical writer retains an explicitly added provisional profile and its adopted dated review through raw storage and reload', async () => {
  await reset(); const ordinary = ownFixture().profile;
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: scope.siteId, sourceKey: `studio-canvas:${scope.siteId}`,
    resourceSiteId: scope.siteId, scope, beds: [bed], measuredAreas: [{ bedId: bed.id, areaM2: bed.areaM2, basis: 'explicit-saved-dimensions' }],
    heldBeds: [], sourceRevision: 'b'.repeat(64), geometryFingerprint: 'a'.repeat(64), freshness: 'device-saved-copy', sourceVerification: 'not-verified' };
  const saved = createSavedProvisionalProfile({ profileId: 'provisional-preview', cropKey: ordinary.cropKey,
    context: { scope, countryCode: 'DE', agriculturalRegionReference: null, establishment: 'transplant', waterRegime: 'irrigated' },
    candidates: [], overrides: ordinary.inputs, recordedAt, asOf: recordedAt.slice(0, 10), measuredAreaM2: provided(12, 'm2'),
    fieldEntryDate: provided('2024-12-31', 'utc-date') }, 'saved-marked-profile', '2024-11-01T00:01:00.000Z', source, bed.id, bed.label);
  assert.ok(saved); assert.equal(book.saveCropPlan(plan([])), true);
  const initial = book.loadCropPlanWithWriteAdmission(), withProfile = { ...initial.book, growerPlanningProfiles: [saved] };
  const permit = book.createGrowerProfileChangePermit(initial.admission, initial.book, withProfile, { kind: 'edit', profileId: saved.profileId, expectedProfile: null });
  assert.ok(permit); assert.equal(book.saveCropPlanWithReceipt(withProfile, { growerProfileChange: permit }).saved, true);
  const reviewedAt = '2024-11-02T00:00:00.000Z';
  const current = createProvisionalCycleContext(source, { countryCode: 'DE', agriculturalRegionReference: null,
    policyFingerprint: 'Synthetic policy context', knownPlantingRestriction: null }, reviewedAt); assert.ok(current);
  const proposal = generateGrowerAutoPlan({ requestedAt: reviewedAt, scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [saved], provisionalContext: current, beds: [{ bed, scope, measuredAreaM2: provided(12, 'm2') }],
    planningStart: provided('2024-12-01', 'utc-date'), planningEndExclusive: provided('2025-02-01', 'utc-date'), reserved: [],
    availability: [{ bedId: bed.id, scope, window: provided({ start: '2024-12-01', endExclusive: '2025-02-01' }, 'utc-date-window') }],
    demands: [{ demandId: 'marked-demand', profileId: saved.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: '2025-01-02', endExclusive: '2025-01-05' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready', proposal.issues.join(',')); assert.equal(proposal.cycles.length, 1);
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'marked-record', acceptedAt: '2024-11-02T00:01:00.000Z', geometryFingerprint: source.geometryFingerprint });
  assert.ok(row); const beforeAppend = book.loadCropPlanWithWriteAdmission();
  assert.equal(book.saveCropPlanWithReceipt({ ...beforeAppend.book, plantings: [row] }, {
    writeIsCurrent: () => book.cropPlanWriteToken() === beforeAppend.token }).saved, true);
  const raw = JSON.parse(readCanonicalCropPlanFixtureRaw()), loaded = book.loadCropPlan();
  assert.deepEqual(raw.growerPlanningProfiles, [saved]); assert.deepEqual(raw.plantings, [row]);
  assert.deepEqual(loaded.growerPlanningProfiles, [saved]); assert.deepEqual(loaded.plantings, [row]);
  const resolution = resolvePlantingBasis(loaded.plantings[0], { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint, provisionalContext: current });
  assert.equal(resolution.kind, 'grower-dated-cycle');
  if (resolution.kind === 'grower-dated-cycle') {
    assert.equal(resolution.assessment.schedule.fieldEntryDate, '2024-12-31');
    assert.equal(resolution.assessment.capacity.estimatedPlantCount, 24);
    assert.deepEqual(resolution.assessment.snapshot.profile, saved);
  }
});

test('actual canonical save/load retains an old own cycle without confirming, finishing or retiming it',async()=>{
  await reset(); const { row, profile } = ownFixture(); const before = JSON.stringify(row);
  assert.equal(book.saveCropPlan(plan([row], [profile])), true);
  const stored = JSON.parse(readCanonicalCropPlanFixtureRaw()); assert.deepEqual(stored.plantings[0], row);
  const loaded = book.loadCropPlan(); assert.equal(JSON.stringify(loaded.plantings[0]), before);
  assert.equal(resolvePlantingBasis(loaded.plantings[0], context).kind, 'grower-dated-cycle');
  for (const flag of ['existing', 'inNursery', 'confirmedOnceSowing', 'finishedOnceSowing', 'awaitingSowingConfirmation']) assert.equal(flag in loaded.plantings[0], false);
  const withoutProfile = { ...loaded, growerPlanningProfiles: [] };
  assert.equal(book.saveCropPlan(withoutProfile), true); assert.equal(JSON.stringify(book.loadCropPlan().plantings[0]), before);
  const changedProfile = { ...profile, inputs: { ...profile.inputs, fieldOccupancyDays: provided(800, 'days') } };
  assert.equal(book.saveCropPlan({ ...loaded, growerPlanningProfiles: [changedProfile] }), true);
  assert.equal(JSON.stringify(book.loadCropPlan().plantings[0]), before); assert.equal(JSON.stringify(row), before);
});

test('malformed and undefined own markers survive real JSON writes and never reload as catalogue rows',async()=>{
  await reset();
  for (const marker of [undefined, null, false, {}, { kind: 'grower-dated-cycle', version: 99 }]) {
    const row = { ...legacy(), once: '2024-01', growerCycle: marker };
    assert.equal(book.saveCropPlan(plan([row])), true);
    const stored = JSON.parse(readCanonicalCropPlanFixtureRaw()); assert.equal(hasGrowerCycleMarker(stored.plantings[0]), true);
    const loaded = book.loadCropPlan().plantings[0]; assert.equal(hasGrowerCycleMarker(loaded), true);
    assert.equal(resolvePlantingBasis(loaded, context).kind, 'held'); assert.equal(loaded.awaitingSowingConfirmation, undefined);
    assert.equal(loaded.once, '2024-01'); assert.equal(row.growerCycle, marker, 'the writer must not mutate the supplied row');
    assert.deepEqual(book.tasksForPlan([loaded], [bed]), []);
    const benchmark = book.buildPlanYieldBenchmark([loaded], [bed]); assert.equal(benchmark.knownKg, null);
    assert.deepEqual(benchmark.heldGrowerPlantingIds, [loaded.id]);
  }
});

test('sample book saves and reads preserve own markers without touching the real device book',async()=>{
  await reset(); const { row } = ownFixture(); assert.equal(book.saveCropPlan(plan([row])), true);
  const realBytes = local.getItem(storageKey), physicalBefore = [...local.rows.entries()]; assert.equal(enterSampleMode(), true);
  try {
    const malformed = { ...row, id: 'sample-held-row', growerCycle: undefined };
    assert.equal(book.saveCropPlan(plan([malformed])), true);
    assert.equal(hasGrowerCycleMarker(getSandboxCropPlan().plantings[0]), true);
    assert.equal(resolvePlantingBasis(book.loadCropPlan().plantings[0], context).kind, 'held');
    // Sample mode intentionally redirects getItem through its privacy shim.
    // Check the physical backing map, not a read of the isolated sample view.
    assert.deepEqual([...local.rows.entries()], physicalBefore);
    setSandboxCropPlan(plan([malformed]));
    const projected = book.loadCropPlan().plantings[0];
    assert.equal(hasGrowerCycleMarker(JSON.parse(JSON.stringify(projected))), true, 'sample reads also make undefined markers durably held');
    assert.equal(projected.awaitingSowingConfirmation, undefined);
  } finally { exitSampleMode(); }
  assert.equal(local.getItem(storageKey), realBytes); assert.deepEqual(book.loadCropPlan().plantings[0], row);
});

test('legacy settlement, manual confirmation and restamping leave every tagged lifecycle untouched',async()=>{
  await reset(); const { row } = ownFixture();
  for (const tagged of [row, { ...row, growerCycle: null, existing: true, inNursery: '2024-12', confirmedOnceSowing: '2024-12' }]) {
    const before = JSON.stringify(tagged);
    assert.equal(book.settleOnceRows([tagged], 2035, 6)[0], tagged);
    assert.equal(book.confirmOnceSowing(tagged, 2035, 6), tagged);
    assert.equal(book.restampEditedOnce(tagged, 2035, 6), tagged);
    assert.equal(JSON.stringify(tagged), before);
    assert.equal(book.datedPlantingSowIndex(tagged, 2035 * 12 + 5), null);
  }
  const old = { ...legacy(), once: '2024-01', sowMonth: 1 };
  assert.equal(book.settleOnceRows([old], 2035, 6)[0].awaitingSowingConfirmation, true);
  const confirmed = book.confirmOnceSowing(old, 2035, 6); assert.equal(confirmed.existing, true); assert.equal(confirmed.once, undefined);
});

test('all contextless catalogue arithmetic excludes tagged rows, while real legacy calculations keep their behavior',async()=>{
  await reset(); const { row } = ownFixture(); const old = legacy();
  assert.ok(book.tasksForPlan([old], [bed]).length > 0); assert.ok(book.estimatedYieldKg(old, bed.areaM2) > 0);
  assert.ok(book.occupiedMonthsForPlanting(old).length > 0); assert.ok(book.seedBoqBatchesForPlan([old], [bed]).length > 0);
  assert.ok(book.buildFoodAvailability([old], [bed]).flat().length > 0); assert.ok(book.buildFieldUtilizationByMonth([old], [bed]).some(value => value > 0));
  for (const tagged of [row, { ...row, growerCycle: undefined }, { ...row, growerCycle: null }, { ...row, growerCycle: { version: 99 } }]) {
    assert.deepEqual(book.tasksForPlan([tagged], [bed]), []); assert.deepEqual(book.occupiedMonthsForPlanting(tagged), []);
    assert.deepEqual(book.plantingBedEntryOffsets(tagged, 1), []); assert.equal(book.plantingIsActiveOrPlanned(tagged, 1), false);
    assert.deepEqual(book.recurringPlanPlantings([tagged]), []); assert.equal(book.estimatedYieldKg(tagged, bed.areaM2), 0);
    assert.equal(book.estimatedYieldKgAdjusted(tagged, bed.areaM2, [tagged]), 0); assert.deepEqual(book.yieldByCrop([tagged], [bed]), []);
    assert.deepEqual(book.seedBoqBatchesForPlan([tagged], [bed]), []); assert.deepEqual(book.seedBoqForPlan([tagged], [bed]), []);
    assert.deepEqual(book.buildFoodAvailability([tagged], [bed]), Array.from({ length: 13 }, () => []));
    assert.deepEqual(book.buildFieldUtilizationByMonth([tagged], [bed]), Array<number>(13).fill(0));
    assert.deepEqual(book.buildFoodAvailability([tagged], [bed], 12, 24), Array.from({ length: 24 }, () => []));
    assert.deepEqual(book.buildFieldUtilizationByMonth([tagged], [bed], 12, 24), Array<number>(24).fill(0));
    assert.equal(book.bedHasUnverifiedTiming(bed.id, [tagged]), true); assert.equal(book.suggestSubstituteCrop(tagged, [tagged]), null);
    assert.deepEqual(book.unverifiedYieldCropNames([tagged]), [], 'own basis holds are distinct from missing catalogue benchmarks');
    assert.equal(book.isGenuinelyIntercropped({ ...tagged, areaFraction: 0.5 }, [old, tagged]), false);
    assert.equal(book.bedOverlapFraction(bed.id, 1, 12, [tagged]), 0);
    assert.deepEqual(book.benchmarkAreaConflictBedLabels([tagged], [bed], 1), []);
    assert.deepEqual(book.benchmarkAreaConflictDetails([tagged], [bed], 1), []);
    assert.deepEqual(book.tasksForPlan([old, tagged], [bed]), book.tasksForPlan([old], [bed]));
    assert.deepEqual(book.buildFoodAvailability([old, tagged], [bed]), book.buildFoodAvailability([old], [bed]));
  }
});

test('mixed-book benchmark totals remain unknown with explicit own diagnostics, never a partial or zero harvest claim',async()=>{
  await reset(); const { row } = ownFixture(); const old = legacy();
  const legacyOnly = book.buildPlanYieldBenchmark([old], [bed]); assert.ok(legacyOnly.knownKg! > 0);
  for (const rows of [[row], [old, row]]) {
    const result = book.buildPlanYieldBenchmark(rows, [bed], 1);
    assert.equal(result.knownKg, null); assert.equal(result.kgPerM2, null); assert.deepEqual(result.byCrop, []);
    assert.deepEqual(result.byCropBeds, []); assert.deepEqual(result.byCropPlots, []);
    assert.deepEqual(result.heldGrowerPlantingIds, [row.id]); assert.equal(result.growingAreaM2, bed.areaM2);
    assert.match(book.buildYearReport(rows, [bed]).join(' '), /catalogue comparison is unavailable/);
  }
  assert.deepEqual(book.buildPlanYieldBenchmark([old, { ...row, bedId: 'another-farm' }], [bed]), legacyOnly);
  const cover = CROPS.find(crop => crop.yieldKgPerM2 === 0)!; assert.ok(cover);
  const coverRow = { ...legacy(), cropKey: cover.key }; assert.deepEqual(book.nonFoodCropNames([coverRow]), [cover.name]);
  assert.deepEqual(book.nonFoodCropNames([{ ...coverRow, growerCycle: null }]), []);
});

test('failed canonical writes preserve the previous stored basis and receipt rather than claiming success',async()=>{
  await reset(); const { row } = ownFixture(); assert.equal(book.saveCropPlan(plan([row])), true);
  const bytes = local.getItem(storageKey), token = book.cropPlanWriteToken(); local.fail = true;
  try {
    assert.deepEqual(book.saveCropPlanWithReceipt(plan([{ ...row, growerCycle: undefined }])), { saved: false, token: null });
    assert.equal(local.getItem(storageKey), bytes); assert.equal(book.cropPlanWriteToken(), token);
  } finally { local.fail = false; }
});
