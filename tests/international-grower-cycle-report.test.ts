import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { assessGrowerPlanning, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { createGrowerCyclePlanting, hasGrowerCycleMarker, resolvePlantingBasis } from '../lib/international/grower-cycle.ts';
import type { GrowerAutoPlanCycle } from '../lib/international/grower-autoplan.ts';
import { normaliseReportSiteFacts, type FactCropPlan } from '../lib/report-site-facts.ts';
import {
  captureReportCropPlan, normaliseReportCropSnapshot, reportCropSignature, reportCropRows, reportCropCalendar,
  reportCropWorkingInput, reportSowingCalendar, reportProductionYear,
} from '../lib/report-crop-plan.ts';

const recordedAt = '2026-11-02T21:00:00.000Z';
const capturedAt = new Date('2027-12-01T00:00:00.000Z');
const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
function provided<T, U extends string>(value: T, unit: U): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance: { kind: 'grower-record', recordedAt, reference: 'Synthetic report fixture, not farming advice.' } };
}
function fixture(method: 'direct' | 'transplant' = 'direct', fieldEntry = '2028-02-29') {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = scope.siteId;
  canvas.items = [canvas.items.find(item => item.defId === 'veg_bed')!];
  canvas.items[0] = { ...canvas.items[0], id: 'own-report-bed', wM: 3, hM: 4 };
  canvas.zones = []; canvas.lines = [];
  const bed = bedsFromDesignCanvas(canvas)[0];
  const crop = CROPS.find(crop => Boolean(crop.transplant) !== (method === 'transplant'))!;
  // Direct establishment deliberately opposes the catalogue flag. Zero yield is
  // recorded data; report preservation must not invent food, a cover or a sale.
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'report-inputs', cropKey: crop.key, scope, inputs: {
    plantsPerM2: provided(4, 'plants/m2'), yieldKgPerM2: provided(0, 'kg/m2/cycle'), establishment: provided(method, 'method'),
    nurseryDays: method === 'transplant' ? provided(10, 'days') : { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: provided(1, 'days'),
    pickingDays: provided(2, 'days'), fieldOccupancyDays: provided(5, 'days'), turnaroundDays: provided(1, 'days'),
    allowedEntryMonths: provided([Number(fieldEntry.slice(5, 7))], 'utc-months'),
  } };
  const assessment = assessGrowerPlanning({ profile, scope, measuredAreaM2: provided(bed.areaM2, 'm2'), fieldEntryDate: provided(fieldEntry, 'utc-date') });
  assert.equal(assessment.status, 'ready');
  if (assessment.status !== 'ready') throw Error('Synthetic report input must reach real arithmetic');
  const cycle: GrowerAutoPlanCycle = { cycleId: 'review-cycle', demandId: 'recorded-demand', profileId: profile.profileId,
    cropKey: crop.key, bedId: bed.id, scope, requestFingerprint: 'synthetic-request', fingerprint: 'synthetic-cycle', assessment };
  const row = createGrowerCyclePlanting(cycle, { plantingId: 'own-report-row', acceptedAt: recordedAt, geometryFingerprint: 'saved-source-v1' });
  assert.ok(row);
  const plan: CropPlanState = { version: 1, plantings: [structuredClone(row)], updatedAt: 123,
    planNotes: [{ kind: 'basis', text: 'Accepted prior plan explanation.' }], planNotesAt: Date.UTC(2026, 10, 2) };
  return { canvas, plan, row, bed };
}
function crop(snapshot: ReturnType<typeof captureReportCropPlan>): FactCropPlan {
  return { plantingCount: snapshot.plantings.length, bedsPlanted: snapshot.beds.length,
    crops: snapshot.plantings.map(planting => ({ name: CROPS.find(crop => crop.key === planting.cropKey)?.name ?? planting.cropKey,
      sowMonths: [], bedLabels: [snapshot.beds.find(bed => bed.id === planting.bedId)!.label], alreadyGrowing: false, firstSeasonOnlyMonths: [] })), snapshot };
}

test('report capture and actual facts JSON normalisation retain detached own dates, provenance and zero inputs', () => {
  const { canvas, plan, row } = fixture();
  const before = JSON.stringify(canvas);
  const captured = captureReportCropPlan(canvas, plan, scope.siteId, capturedAt, { allowCataloguePlanning: false });
  const clean = normaliseReportSiteFacts(JSON.parse(JSON.stringify({ crop: crop(captured) })))!.crop!.snapshot!;
  assert.deepEqual((clean.plantings[0] as typeof row).growerCycle, row.growerCycle);
  assert.equal(reportCropSignature(clean), reportCropSignature(captured));
  assert.equal(JSON.stringify(canvas), before, 'report work cannot change any saved geometry');
  const capturedBytes = JSON.stringify(captured);
  const raw = plan.plantings[0] as unknown as { growerCycle: { assessmentSnapshot: { profile: { inputs: { yieldKgPerM2: { value: number } } } } } };
  raw.growerCycle.assessmentSnapshot.profile.inputs.yieldKgPerM2.value = 999;
  assert.equal(JSON.stringify(captured), capturedBytes, 'capture must detach nested accepted inputs');
  const cleanBefore = JSON.stringify(clean);
  (captured.plantings[0] as typeof raw).growerCycle.assessmentSnapshot.profile.inputs.yieldKgPerM2.value = 555;
  assert.equal(JSON.stringify(clean), cleanBefore, 'normalisation must detach nested archived inputs too');
  assert.equal(resolvePlantingBasis(clean.plantings[0]).kind, 'held', 'a saved report cannot certify current geometry');
});

test('raw own report rows show absolute planned dates and an unverified basis rather than observed or annually repeating activity', () => {
  const { canvas, plan } = fixture();
  const snapshot = normaliseReportCropSnapshot(captureReportCropPlan(canvas, plan, scope.siteId, capturedAt))!;
  const rows = reportCropRows(crop(snapshot));
  assert.equal(rows.length, 1);
  assert.match(rows[0].status, /Grower-planned dated cycle/);
  assert.match(rows[0].status, /current geometry.*unverified/);
  assert.match(rows[0].sow, /planned field entry 2028-02-29/);
  assert.match(rows[0].sow, /estimated first harvest 2028-03-01/);
  assert.doesNotMatch(rows[0].status, /Planned annual|Recorded as growing|In nursery|First season only/);
  assert.doesNotMatch(rows[0].sow, /nursery start/);
});

test('archived own transplant dates retain their entered nursery interval across New Year despite the catalogue method', () => {
  const { canvas, plan } = fixture('transplant', '2028-01-04');
  const snapshot = normaliseReportCropSnapshot(captureReportCropPlan(canvas, plan, scope.siteId, capturedAt))!;
  const row = reportCropRows(crop(snapshot))[0];
  assert.match(row.sow, /Planned nursery start 2027-12-25/);
  assert.match(row.sow, /planned field entry 2028-01-04/);
  assert.match(row.sow, /estimated first harvest 2028-01-05/);
  assert.match(row.status, /archived inputs/);
  assert.equal(reportCropWorkingInput(snapshot, 'Synthetic').plantings.length, 0);
});

test('null, unknown and unserialisable markers remain held raw report records after both capture and normalisation', () => {
  const circular: Record<string, unknown> = {}; circular.self = circular;
  for (const marker of [undefined, null, false, {}, { kind: 'grower-dated-cycle', version: 999 }, () => undefined, circular]) {
    const { canvas, plan, row } = fixture();
    plan.plantings = [{ id: row.id, bedId: row.bedId, cropKey: row.cropKey, sowMonth: row.sowMonth,
      once: row.once, growerCycle: marker } as Planting];
    const captured = captureReportCropPlan(canvas, plan, scope.siteId, capturedAt);
    const clean = normaliseReportCropSnapshot(JSON.parse(JSON.stringify(captured)))!;
    assert.ok(clean);
    assert.equal(hasGrowerCycleMarker(clean.plantings[0]), true);
    assert.equal(resolvePlantingBasis(clean.plantings[0]).kind, 'held');
    const rows = reportCropRows(crop(clean));
    assert.match(rows[0].status, /Grower cycle held/);
    assert.match(rows[0].sow, /compatibility month/);
    assert.doesNotMatch(rows[0].status, /Planned annual|Recorded as growing|First season only/);
  }
});

test('even false legacy lifecycle flags survive own snapshot normalisation and prevent a false valid own-date label', () => {
  const { canvas, plan } = fixture();
  plan.plantings[0] = { ...plan.plantings[0], existing: false };
  const clean = normaliseReportCropSnapshot(captureReportCropPlan(canvas, plan, scope.siteId, capturedAt))!;
  assert.equal(clean.plantings[0].existing, false);
  assert.match(reportCropRows(crop(clean))[0].status, /Grower cycle held/);
  assert.equal(resolvePlantingBasis(clean.plantings[0]).kind, 'held');
});

test('an unreadable marker getter is captured as durable held metadata instead of throwing or becoming legacy', () => {
  const { canvas, plan, row } = fixture();
  const raw = { id: row.id, bedId: row.bedId, cropKey: row.cropKey, sowMonth: row.sowMonth, once: row.once };
  Object.defineProperty(raw, 'growerCycle', { enumerable: true, get() { throw Error('Unreadable source marker'); } });
  plan.plantings = [raw];
  const snapshot = normaliseReportCropSnapshot(JSON.parse(JSON.stringify(captureReportCropPlan(canvas, plan, scope.siteId, capturedAt))))!;
  assert.equal(hasGrowerCycleMarker(snapshot.plantings[0]), true);
  assert.match(reportCropRows(crop(snapshot))[0].status, /Grower cycle held/);
  assert.equal(reportCropWorkingInput(snapshot, 'Synthetic').plantings.length, 0);
});

test('report cache identity changes with basis, provenance, dates, malformed versions and lifecycle flags', () => {
  const { canvas, plan } = fixture();
  const snapshot = captureReportCropPlan(canvas, plan, scope.siteId, capturedAt);
  const original = reportCropSignature(snapshot);
  const changes: Array<(row: Record<string, unknown>) => void> = [
    row => { delete row.growerCycle; }, row => { row.growerCycle = null; },
    row => { row.growerCycle = { kind: 'grower-dated-cycle', version: 2 }; }, row => { row.existing = false; },
    row => { (row.growerCycle as { acceptedAt: string }).acceptedAt = '2026-11-03T21:00:00.000Z'; },
    row => { const attachment = row.growerCycle as { assessmentSnapshot: { fieldEntryDate: { value: string } } }; attachment.assessmentSnapshot.fieldEntryDate.value = '2028-03-01'; },
  ];
  for (const change of changes) {
    const changed = structuredClone(snapshot);
    change(changed.plantings[0] as unknown as Record<string, unknown>);
    assert.notEqual(reportCropSignature(changed), original);
  }
});

test('all regenerated report catalogue builders exclude own tagged rows while keeping a positive legacy control', () => {
  const { canvas, plan, row } = fixture();
  const legacy: Planting = { id: 'legacy-report-row', bedId: row.bedId, cropKey: CROPS[0].key, sowMonth: 12 };
  const baseline = captureReportCropPlan(canvas, { ...plan, plantings: [legacy] }, scope.siteId, capturedAt);
  const mixed = captureReportCropPlan(canvas, { ...plan, plantings: [legacy, row, { ...row, id: 'invalid-own', growerCycle: null } as Planting] }, scope.siteId, capturedAt);
  assert.ok(reportCropWorkingInput(baseline, 'Synthetic').tasks.length > 0);
  assert.ok(reportSowingCalendar(baseline).rows.length > 0);
  assert.ok(reportProductionYear(baseline, []).rows.length > 0);
  assert.deepEqual(reportCropCalendar(mixed), reportCropCalendar(baseline));
  assert.deepEqual(reportSowingCalendar(mixed), reportSowingCalendar(baseline));
  assert.deepEqual(reportProductionYear(mixed, []), reportProductionYear(baseline, []));
  assert.deepEqual(mixed.annualProduction, baseline.annualProduction);
  const input = reportCropWorkingInput(mixed, 'Synthetic');
  assert.deepEqual(input.plantings, [legacy]);
  assert.deepEqual(input.tasks, reportCropWorkingInput(baseline, 'Synthetic').tasks);
  assert.equal(input.planNotes, undefined, 'an inherited whole-plan explanation cannot silently approve held own rows');
  assert.equal(input.planNotesAt, undefined);
  assert.equal(reportCropRows(crop(mixed)).length, 3, 'archived raw rows must remain readable');
});
