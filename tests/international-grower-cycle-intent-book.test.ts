import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import {
  createGrowerCyclePlanting, hasGrowerCycleMarker, normaliseGrowerCycleAttachment, preserveGrowerCycleMarker,
  resolvePlantingBasis, type GrowerCycleOrigin,
} from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';

// Same storage harness as tests/international-grower-cycle-book.test.ts (copied so that file stays untouched).
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
const { exitSampleMode } = await import('../lib/sample-mode.ts');
const report = await import('../lib/report-crop-plan.ts');
after(() => hooks.deregister());

// Synthetic engineering fixtures only; no value is crop, household or nutrition guidance.
const bed = { id: 'fixture-bed', label: 'Measured storage fixture', areaM2: 12 };
const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
const context = { scope, beds: [bed], geometryFingerprint: 'fixture-source-geometry' };
const recordedAt = '2024-11-01T00:00:00.000Z';
const storageKey = 'imbewu_crop_plan_v2';
const provided = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const household: GrowerCycleOrigin = { kind: 'grower-entered', purpose: 'household', entryId: 'entry-1' };
const trial: GrowerCycleOrigin = { kind: 'grower-entered', purpose: 'trial', entryId: 'entry-1' };
function ownRow(demandId: string, origin?: GrowerCycleOrigin, plantingId = 'own-fixture-row') {
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'saved-fixture-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: provided(2, 'plants/m2'), yieldKgPerM2: provided(3, 'kg/m2/cycle'),
    establishment: provided('transplant', 'method'), nurseryDays: provided(10, 'days'),
    fieldEntryToFirstHarvestDays: provided(2, 'days'), pickingDays: provided(3, 'days'),
    fieldOccupancyDays: provided(5, 'days'), turnaroundDays: provided(1, 'days'), allowedEntryMonths: provided([12], 'utc-months') } };
  const proposal = generateGrowerAutoPlan({ requestedAt: recordedAt, scope, geometryFingerprint: context.geometryFingerprint,
    profiles: [profile], beds: [{ bed, scope, measuredAreaM2: provided(bed.areaM2, 'm2') }],
    planningStart: provided('2024-12-01', 'utc-date'), planningEndExclusive: provided('2025-02-01', 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: provided({ start: '2024-12-01', endExclusive: '2025-02-01' }, 'utc-date-window') }], reserved: [],
    demands: [{ demandId, profileId: profile.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: '2025-01-02', endExclusive: '2025-01-05' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId, acceptedAt: recordedAt, geometryFingerprint: context.geometryFingerprint,
    ...(origin ? { origin } : {}) });
  assert.ok(row); return { row, profile };
}
const plan = (plantings: Planting[]): CropPlanState => ({ version: 1, plantings, updatedAt: 7 });
async function reset() { releaseCropPlanFixture(); exitSampleMode(); local.clear(); session.clear(); await initialiseCropPlanFixture(); }
const originOf = (row: unknown) => {
  const resolved = resolvePlantingBasis(row, context);
  assert.equal(resolved.kind, 'grower-dated-cycle');
  return resolved.kind === 'grower-dated-cycle' ? resolved.attachment.origin : 'held';
};

test('household and trial origins survive the actual canonical save, raw bytes, load and projection', async () => {
  await reset();
  const { row: home } = ownRow('grower-entered:entry-1', household, 'home-row');
  const { row: plot } = ownRow('grower-entered:entry-2', { ...trial, entryId: 'entry-2' }, 'trial-row');
  const receipt = book.saveCropPlanWithReceipt(plan([home]));
  assert.equal(receipt.saved, true);
  const raw = JSON.parse(readCanonicalCropPlanFixtureRaw());
  assert.deepEqual(raw.plantings[0].growerCycle.origin, household);
  const loaded = book.loadCropPlan().plantings[0];
  assert.equal(JSON.stringify(loaded), JSON.stringify(home));
  assert.deepEqual(originOf(loaded), household);
  assert.deepEqual(projectGrowerCycles([loaded], context).ownCycles[0].origin, { status: 'recorded', origin: household });
  assert.equal(book.saveCropPlan(plan([plot])), true);
  assert.deepEqual(originOf(book.loadCropPlan().plantings[0]), { ...trial, entryId: 'entry-2' });
  assert.equal('harvestTargetId' in book.loadCropPlan().plantings[0], false);
});

test('old buyer and old unknown rows round-trip byte-identically and stay not-recorded', async () => {
  await reset();
  const { row: unknown } = ownRow('fixture-demand');
  const { row: oldBuyer } = ownRow('target-a', undefined, 'old-buyer-row');
  for (const row of [unknown, { ...oldBuyer, harvestTargetId: 'target-a' }]) {
    assert.equal(book.saveCropPlan(plan([row])), true);
    const loaded = book.loadCropPlan().plantings[0];
    assert.equal(JSON.stringify(loaded), JSON.stringify(row));
    assert.equal(originOf(loaded), undefined);
    assert.deepEqual(projectGrowerCycles([loaded], context).ownCycles[0].origin, { status: 'not-recorded' });
  }
});

test('null, undefined, unknown and conflicting origins survive real JSON writes as held and never reload as legacy', async () => {
  await reset();
  const { row } = ownRow('grower-entered:entry-1', household);
  const bad: Planting[] = [
    { ...row, growerCycle: { ...row.growerCycle, origin: null } },
    { ...row, growerCycle: { ...row.growerCycle, origin: undefined } },
    { ...row, growerCycle: { ...row.growerCycle, origin: { ...household, purpose: 'sale' } } },
  ];
  // (A forged buyer link on an entered row is covered without storage in the origin and workflow-intent tests.)
  for (const candidate of bad) {
    const before = JSON.stringify(candidate);
    assert.equal(book.saveCropPlan(plan([candidate])), true);
    const loaded = book.loadCropPlan().plantings[0];
    assert.equal(hasGrowerCycleMarker(loaded), true);
    assert.equal(resolvePlantingBasis(loaded, context).kind, 'held');
    assert.deepEqual(projectGrowerCycles([loaded], context).ownCycles, []);
    assert.deepEqual(book.tasksForPlan([loaded], [bed]), []);
    assert.equal(JSON.stringify(candidate), before, 'the writer must not mutate the supplied row');
  }
});

test('a failed write keeps the prior origin bytes and receipt; an external write changes the receipt; a fresh write recovers', async () => {
  await reset();
  const { row: home } = ownRow('grower-entered:entry-1', household);
  const { row: switched } = ownRow('grower-entered:entry-1', trial);
  const first = book.saveCropPlanWithReceipt(plan([home]));
  assert.equal(first.saved, true);
  const bytes = local.getItem(storageKey), token = book.cropPlanWriteToken();
  local.fail = true;
  try {
    assert.deepEqual(book.saveCropPlanWithReceipt(plan([switched])), { saved: false, token: null });
    assert.equal(local.getItem(storageKey), bytes); assert.equal(book.cropPlanWriteToken(), token);
    assert.deepEqual(originOf(book.loadCropPlan().plantings[0]), household, 'no partial purpose change after a failed write');
  } finally { local.fail = false; }
  // Another writer (a second tab) replaces the canonical book: the earlier receipt is no longer current.
  assert.equal(book.saveCropPlan(plan([switched])), true);
  assert.notEqual(book.cropPlanWriteToken(), first.token);
  assert.deepEqual(originOf(book.loadCropPlan().plantings[0]), trial);
  // Recovery is a new deliberate write with its own receipt, never a retry of the old one.
  const recovered = book.saveCropPlanWithReceipt(plan([home]));
  assert.equal(recovered.saved, true); assert.equal(book.cropPlanWriteToken(), recovered.token);
  assert.deepEqual(originOf(book.loadCropPlan().plantings[0]), household);
});

test('report snapshot copying keeps the recorded origin and still renders the cycle as an archived own cycle', async () => {
  await reset();
  const { row } = ownRow('grower-entered:entry-1', household);
  assert.equal(book.saveCropPlan(plan([row])), true);
  const loaded = book.loadCropPlan().plantings[0];
  const snapshot = report.normaliseReportCropSnapshot(JSON.parse(JSON.stringify({ siteId: scope.siteId, capturedAt: recordedAt,
    planUpdatedAt: 7, beds: [bed], plantings: [loaded], outlines: [] })));
  assert.ok(snapshot);
  const copied = snapshot.plantings[0];
  assert.deepEqual(normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(copied).growerCycle)?.origin, household);
  const rows = report.reportCropRows({ snapshot } as unknown as Parameters<typeof report.reportCropRows>[0]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].status, /^Grower-planned dated cycle/);
});
