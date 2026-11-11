import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { loadCropPlan, saveCropPlanWithReceipt, loadCropPlanWithWriteAdmission, cropPlanWriteAdmissionMatches,
  type CropPlanState } from '../lib/crop-plan.ts';
import { bindMountedAccountLocalStorageUid } from '../lib/account-local-storage.ts';
import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { growerPlanningScopeKey } from '../lib/international/grower-planning.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, projectGrowerNurseryPreparation, isGrowerNurseryForecastCurrent,
  inspectGrowerNurseryBatchReference, resolveGrowerNurseryBatchReference, prepareGrowerNurseryBatchReferenceChanges,
  type GrowerNurseryRequest, type GrowerNurseryBatchReferenceChange, type GrowerNurseryReferenceFields,
  type GrowerNurseryBatchReferenceView,
  type PrepareGrowerNurseryBatchReferenceChangesInput } from '../lib/international/grower-nursery.ts';

// Synthetic engineering fixtures only. Labels identify no real variety or seed
// lot, and the short cycle/count inputs are not agricultural recommendations.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt: stamp, note: 'Synthetic batch reference test.' } });
const emptyFields: GrowerNurseryReferenceFields = { variety: null, seedLotReference: null, raisingBatchReference: null };
const change = (plantingId: string, fields: Partial<GrowerNurseryReferenceFields> = {}): GrowerNurseryBatchReferenceChange =>
  ({ plantingId, ...emptyFields, ...fields });
async function fixture(direct = false) {
  const canvas = buildDemoDesignCanvasState(), siteId = 'site:0.00000,0.00000';
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...bed, id: `reference-bed-${index}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.lines = []; canvas.zones = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'synthetic-reference-source' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source held');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-reference-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(direct ? 'direct' : 'transplant', 'method'),
    nurseryDays: direct ? { state: 'missing', reason: 'not-applicable' } : own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'own-reference-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `persistent-batch-${index}`, acceptedAt: stamp,
      geometryFingerprint: source.geometryFingerprint }); assert.ok(row); return row;
  });
  const context: GrowerCycleContext = { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'reference-tray', siteId, name: 'Synthetic tray', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'reference-bench', siteId, name: 'Synthetic surface', usableM2: 10 }],
    profiles: [{ id: 'reference-recipe', siteId, cropKey: profile.cropKey, model: 'seed-cell', containerId: 'reference-tray', spaceId: 'reference-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const book: CropPlanState = { version: 1, plantings: rows, nursery: settings, growerPlanningProfiles: [profile], updatedAt: 1 };
  const nursery: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows, cycleContext: context }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'reference-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'reference-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  return { source, scope, context, rows, book, nursery, proposal, request };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function input(f: Fixture, changes: readonly GrowerNurseryBatchReferenceChange[], book = f.book): PrepareGrowerNurseryBatchReferenceChangesInput {
  return { book, originalRows: f.rows, originalContext: f.context, currentContext: f.context, changes };
}
function prepared(value: PrepareGrowerNurseryBatchReferenceChangesInput) {
  const result = prepareGrowerNurseryBatchReferenceChanges(value); assert.equal(result.status, 'prepared', result.status === 'held' ? result.reasons.join(',') : 'no change');
  if (result.status !== 'prepared') throw Error('Reference preparation held'); return result;
}
function held(value: PrepareGrowerNurseryBatchReferenceChangesInput, reason?: string) {
  const result = prepareGrowerNurseryBatchReferenceChanges(value); assert.equal(result.status, 'held');
  if (result.status !== 'held') throw Error('Expected reference hold');
  if (reason) assert.ok(result.reasons.includes(reason), result.reasons.join(','));
  assert.equal('book' in result, false);
}
const labelled = (f: Fixture) => prepared(input(f, [change(f.rows[0].id, { variety: 'User label A', seedLotReference: 'User lot A', raisingBatchReference: 'User raising A' }),
  change(f.rows[1].id, { variety: 'User label B', seedLotReference: 'User lot B', raisingBatchReference: 'User raising B' })]));
const nurseryFor = (f: Fixture, rows: unknown): GrowerNurseryRequest => ({ ...f.nursery, source: { kind: 'saved-cycles', rows, cycleContext: f.context } });

test('absent references retain the existing planting variety authority; present malformed metadata never becomes absent', async () => {
  const f = await fixture();
  assert.deepEqual(inspectGrowerNurseryBatchReference({ ...f.rows[0], variety: 'Existing user label' }),
    { status: 'absent', fields: { ...emptyFields, variety: 'Existing user label' } });
  for (const metadata of [null, undefined, false, {}, { kind: 'planned-nursery-reference', version: 99 }]) {
    assert.equal(inspectGrowerNurseryBatchReference({ ...f.rows[0], nurseryBatchReference: metadata }).status, 'held');
    assert.equal(resolveGrowerNurseryBatchReference([{ ...f.rows[0], nurseryBatchReference: metadata }, f.rows[1]], f.context, f.rows[0].id).status, 'held');
  }
});

test('bulk labels belong to exact accepted rows rather than crop, recipe, start date or repeating cycle ordinal', async () => {
  const f = await fixture(), before = JSON.stringify(f.book), result = labelled(f);
  assert.deepEqual(result.changedPlantingIds, f.rows.map(row => row.id));
  for (const [index, row] of result.book.plantings.entries()) {
    const resolved = resolveGrowerNurseryBatchReference(result.book.plantings, f.context, row.id);
    assert.equal(resolved.status, 'ready');
    if (resolved.status !== 'ready') throw Error('Accepted label unresolved');
    assert.equal(resolved.fields.seedLotReference, index ? 'User lot B' : 'User lot A');
    assert.equal(resolved.fields.variety, row.variety);
    assert.equal(Object.hasOwn(row.nurseryBatchReference as object, 'variety'), false);
    assert.deepEqual(row.growerCycle, f.rows[index].growerCycle);
  }
  const repeated = f.proposal.cycles.map(cycle => ({ ...cycle, cycleId: f.proposal.cycles[0].cycleId }));
  const rows = repeated.map((cycle, index) => createGrowerCyclePlanting(cycle, { plantingId: `repeated-ordinal-${index}`, acceptedAt: stamp,
    geometryFingerprint: f.source.geometryFingerprint })!);
  for (const row of rows) assert.equal(resolveGrowerNurseryBatchReference(rows, f.context, row.id).status, 'ready');
  assert.equal(JSON.stringify(f.book), before); assert.equal(Object.isFrozen(f.rows[0]), true, 'existing canonical creation is already immutable');
});

test('empty and unchanged changes are genuine no-ops and do not backfill a marker or grant persistence', async () => {
  const f = await fixture();
  for (const changes of [[], f.rows.map(row => change(row.id))]) {
    const result = prepareGrowerNurseryBatchReferenceChanges(input(f, changes));
    assert.equal(result.status, 'unchanged');
    assert.deepEqual(result.changedPlantingIds, []); assert.deepEqual(result.book, f.book);
    assert.ok(result.book.plantings.every(row => !Object.hasOwn(row, 'nurseryBatchReference')));
    assert.equal('saved' in result, false); assert.equal('token' in result, false);
  }
  const rows = [{ ...f.rows[0], variety: 'Existing variety' }, f.rows[1]], book = { ...f.book, plantings: rows };
  const result = prepareGrowerNurseryBatchReferenceChanges({ ...input(f, [change(rows[0].id, { variety: 'Existing variety' })], book), originalRows: rows });
  assert.equal(result.status, 'unchanged');
  assert.equal(Object.isFrozen(rows), false); assert.equal(Object.hasOwn(rows[0], 'nurseryBatchReference'), false);
});

test('explicit clearing affects only selected known labels and preserves unknown marker and row evidence', async () => {
  const f = await fixture(), first = labelled(f).book;
  const row = { ...first.plantings[0], privateRowMetadata: { retained: [null, 0] },
    nurseryBatchReference: { ...(first.plantings[0].nurseryBatchReference as object), futureMetadata: { retained: true } } };
  const rows = [row, first.plantings[1]], book = { ...first, plantings: rows };
  const clear = prepared({ ...input(f, [change(row.id)], book), originalRows: rows });
  assert.equal(clear.book.plantings[0].variety, undefined);
  assert.deepEqual((clear.book.plantings[0] as unknown as typeof row).privateRowMetadata, row.privateRowMetadata);
  assert.deepEqual((clear.book.plantings[0].nurseryBatchReference as typeof row.nurseryBatchReference).futureMetadata, { retained: true });
  assert.deepEqual(clear.book.plantings[1], rows[1]);
  const resolved = resolveGrowerNurseryBatchReference(clear.book.plantings, f.context, row.id);
  assert.deepEqual(resolved, { status: 'ready', plantingId: row.id, fields: emptyFields });
  const clean = prepared({ ...input(f, [change(first.plantings[1].id)], first), originalRows: first.plantings });
  assert.equal(Object.hasOwn(clean.book.plantings[1], 'nurseryBatchReference'), false);
});

test('each bulk change must state all three fields and valid bounded user text or explicit null', async () => {
  const f = await fixture();
  for (const bad of [{ plantingId: f.rows[0].id }, { ...change(f.rows[0].id), variety: undefined },
    { ...change(f.rows[0].id), seedLotReference: '' }, { ...change(f.rows[0].id), seedLotReference: ' '.repeat(3) },
    { ...change(f.rows[0].id), raisingBatchReference: 'x'.repeat(121) }, { ...change(f.rows[0].id), variety: 'bad\nlabel' },
    { ...change(f.rows[0].id), seedLotReference: 0 }, { ...change(f.rows[0].id), extra: true }]) {
    held(input(f, [bad as unknown as GrowerNurseryBatchReferenceChange]));
  }
  held(input(f, [change(f.rows[0].id), change(f.rows[0].id)]), 'reference-change-ambiguous');
  const unicode = prepared(input(f, [change(f.rows[0].id, { variety: 'User label α', seedLotReference: 'User, "lot"' })]));
  assert.equal(unicode.book.plantings[0].variety, 'User label α');
});

test('editing a known label preserves unknown nested scope metadata in the original bound attachment', async () => {
  const f = await fixture(), first = labelled(f).book;
  const old = first.plantings[0].nurseryBatchReference as { scope: object };
  const marker = { ...old, scope: { ...old.scope, privateScopeMetadata: { retained: [null, 0, 'Original claim'] } } };
  const rows = [{ ...first.plantings[0], nurseryBatchReference: marker }, first.plantings[1]], book = { ...first, plantings: rows };
  const result = prepared({ ...input(f, [change(rows[0].id, { variety: rows[0].variety!, seedLotReference: 'Changed lot', raisingBatchReference: 'User raising A' })], book), originalRows: rows });
  const saved = result.book.plantings[0].nurseryBatchReference as typeof marker;
  assert.deepEqual(saved.scope, marker.scope);
  assert.equal(resolveGrowerNurseryBatchReference(result.book.plantings, f.context, rows[0].id).status, 'ready');
  assert.deepEqual(rows[0].nurseryBatchReference, marker);
});

test('clearing known labels cannot delete unknown metadata nested inside the bound scope', async () => {
  const f = await fixture(), first = labelled(f).book;
  const old = first.plantings[0].nurseryBatchReference as { scope: object };
  const marker = { ...old, scope: { ...old.scope, privateScopeMetadata: { retained: true } } };
  const rows = [{ ...first.plantings[0], nurseryBatchReference: marker }, first.plantings[1]], book = { ...first, plantings: rows };
  const result = prepared({ ...input(f, [change(rows[0].id)], book), originalRows: rows });
  assert.equal(Object.hasOwn(result.book.plantings[0], 'nurseryBatchReference'), true);
  const saved = result.book.plantings[0].nurseryBatchReference as typeof marker;
  assert.deepEqual(saved.scope, marker.scope);
  assert.deepEqual(resolveGrowerNurseryBatchReference(result.book.plantings, f.context, rows[0].id),
    { status: 'ready', plantingId: rows[0].id, fields: emptyFields });
});

test('stale target data, assessment or source cannot inherit the original edit while same-value clones remain usable', async () => {
  const f = await fixture(), changes = [change(f.rows[0].id, { seedLotReference: 'Entered lot' })];
  const clone = JSON.parse(JSON.stringify(f.book)) as CropPlanState;
  assert.equal(prepareGrowerNurseryBatchReferenceChanges(input(f, changes, clone)).status, 'prepared');
  const changed = { ...f.book, plantings: [{ ...f.rows[0], notes: 'Later target edit' }, f.rows[1]] };
  held(input(f, changes, changed), 'reference-target-changed');
  const newer = createGrowerCyclePlanting(f.proposal.cycles[0], { plantingId: f.rows[0].id, acceptedAt: '2026-11-05T12:01:00.000Z',
    geometryFingerprint: f.source.geometryFingerprint })!;
  held(input(f, changes, { ...f.book, plantings: [newer, f.rows[1]] }), 'reference-target-changed');
  held({ ...input(f, changes), currentContext: { ...f.context, geometryFingerprint: 'changed-geometry' } }, 'reference-source-changed');
  assert.equal(resolveGrowerNurseryBatchReference(f.rows, { ...f.context, geometryFingerprint: 'changed-geometry' }, f.rows[0].id).status, 'held');
});

test('fresh unrelated book data and foreign legacy rows survive a targeted edit exactly', async () => {
  const f = await fixture();
  const foreign = { id: 'foreign-legacy', bedId: 'foreign-bed', cropKey: CROPS[0].key, sowMonth: 2, variety: 'Foreign user label',
    nurseryBatchReference: { version: 99, privateEvidence: 'Preserve foreign malformed reference' }, privateOther: [null, 0] };
  const book = { ...f.book, plantings: [f.rows[0], f.rows[1], foreign], updatedAt: 99,
    planNotes: [{ kind: 'basis' as const, text: 'Fresh unrelated book note.' }] };
  const result = prepared(input(f, [change(f.rows[0].id, { seedLotReference: 'Entered lot' })], book));
  assert.deepEqual(result.book.plantings.slice(1), book.plantings.slice(1));
  assert.deepEqual(result.book.planNotes, book.planNotes); assert.equal(result.book.updatedAt, 99);
  assert.equal(JSON.stringify(result.book.plantings[2]), JSON.stringify(foreign));
});

test('a reassessed nursery batch reusing the same planting ID cannot inherit the former batch labels', async () => {
  const f = await fixture(), saved = labelled(f).book;
  const request = { ...f.request, demands: f.request.demands.map(demand => ({ ...demand,
    harvestWindow: own({ start: '2028-02-21', endExclusive: '2028-02-23' }, 'utc-date-window') })) };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  const cycle = proposal.cycles.find(cycle => cycle.bedId === f.rows[0].bedId)!;
  assert.ok(cycle); assert.notEqual(cycle.assessment.fingerprint, f.rows[0].growerCycle.assessmentFingerprint);
  const replacement = createGrowerCyclePlanting(cycle, { plantingId: f.rows[0].id, acceptedAt: stamp,
    geometryFingerprint: f.source.geometryFingerprint })!;
  const changed = { ...replacement, variety: saved.plantings[0].variety, nurseryBatchReference: saved.plantings[0].nurseryBatchReference };
  const rows = [changed, saved.plantings[1]], book = { ...saved, plantings: rows };
  assert.deepEqual(resolveGrowerNurseryBatchReference(rows, f.context, changed.id), { status: 'held', reason: 'reference-binding-changed' });
  held({ ...input(f, [change(changed.id, { seedLotReference: 'New intent' })], book), originalRows: saved.plantings }, 'reference-binding-changed');
  held(input(f, [change(replacement.id, { seedLotReference: 'Old captured intent' })], { ...f.book, plantings: [replacement, f.rows[1]] }), 'reference-target-changed');
});

test('duplicate whole-book identities, wrong scope, direct cycles and absent planting IDs cannot select a saved nursery batch', async () => {
  const f = await fixture();
  const duplicate = { id: f.rows[0].id, bedId: 'foreign-bed', growerCycle: { version: 999 } };
  for (const rows of [[...f.rows, duplicate], [duplicate, ...f.rows]]) {
    assert.equal(resolveGrowerNurseryBatchReference(rows, f.context, f.rows[0].id).status, 'held');
    held(input(f, [change(f.rows[0].id)], { ...f.book, plantings: rows } as CropPlanState));
  }
  assert.equal(resolveGrowerNurseryBatchReference(f.rows, { ...f.context, scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } }, f.rows[0].id).status, 'held');
  assert.equal(resolveGrowerNurseryBatchReference(f.rows, { ...f.context, beds: [] }, f.rows[0].id).status, 'held');
  assert.equal(resolveGrowerNurseryBatchReference(f.rows, f.context, f.proposal.cycles[0].cycleId).status, 'held');
  const direct = await fixture(true);
  assert.equal(resolveGrowerNurseryBatchReference(direct.rows, direct.context, direct.rows[0].id).status, 'held');
});

test('malformed-present selected references cannot be silently repaired by clearing or relabeling them', async () => {
  const f = await fixture(), saved = labelled(f).book;
  for (const mutation of [null, { ...(saved.plantings[0].nurseryBatchReference as object), seedLotReference: 42 },
    { ...(saved.plantings[0].nurseryBatchReference as object), plantingId: f.rows[1].id },
    { ...(saved.plantings[0].nurseryBatchReference as object), assessmentFingerprint: 'different-assessment' }]) {
    const rows = [{ ...saved.plantings[0], nurseryBatchReference: mutation }, saved.plantings[1]], book = { ...saved, plantings: rows };
    for (const fields of [emptyFields, { ...emptyFields, seedLotReference: 'New label' }]) held({ ...input(f, [change(rows[0].id, fields)], book), originalRows: rows });
  }
});

test('reference labels do not change any seed, stand, tray, date, budget or preparation grouping arithmetic', async () => {
  const f = await fixture(), original = buildGrowerNurseryForecast(f.nursery), saved = labelled(f).book;
  const result = buildGrowerNurseryForecast(nurseryFor(f, saved.plantings));
  assert.equal(result.status, original.status); assert.equal(result.headroom, original.headroom);
  const quantities = (value: typeof result) => value.batches.map(({ reference: _reference, ...batch }) => batch);
  assert.deepEqual(quantities(result), quantities(original)); assert.deepEqual(result.resources, original.resources); assert.deepEqual(result.forecast, original.forecast);
  const before = projectGrowerNurseryPreparation(original), after = projectGrowerNurseryPreparation(result);
  assert.equal(after.groups.length, 1); assert.equal(after.groups[0].key, before.groups[0].key);
  assert.deepEqual(after.groups[0].fieldPositions, before.groups[0].fieldPositions);
  assert.deepEqual(after.groups[0].startsToRaise, before.groups[0].startsToRaise); assert.deepEqual(after.groups[0].seedsToSow, before.groups[0].seedsToSow);
  assert.deepEqual(after.groups[0].members.map(member => member.reference?.status === 'ready' && member.reference.fields.seedLotReference), ['User lot A', 'User lot B']);
  assert.equal(isGrowerNurseryForecastCurrent(result, nurseryFor(f, saved.plantings)), true);
  const changed = structuredClone(result); (changed.batches[0] as { reference?: GrowerNurseryBatchReferenceView }).reference = { status: 'ready', plantingId: saved.plantings[0].id,
    fields: { ...emptyFields, seedLotReference: 'Forged output' } };
  assert.equal(isGrowerNurseryForecastCurrent(changed, nurseryFor(f, saved.plantings)), false);
  assert.equal(projectGrowerNurseryPreparation(changed).groups[0].members[0].reference?.status, 'held');
});

test('held metadata remains in the raw source snapshot and reference failure does not erase known counts', async () => {
  const f = await fixture(), saved = labelled(f).book;
  const marker = { ...(saved.plantings[0].nurseryBatchReference as object), seedLotReference: 42 };
  const rows = [{ ...saved.plantings[0], nurseryBatchReference: marker }, saved.plantings[1]], request = nurseryFor(f, rows);
  const result = buildGrowerNurseryForecast(request), projection = projectGrowerNurseryPreparation(result);
  assert.equal(result.status, 'ready'); assert.equal(result.batches.length, 2); assert.equal(result.batches[0].reference?.status, 'held');
  assert.equal(projection.groups[0].fieldPositions.total, 96); assert.equal(projection.groups[0].startsToRaise.total, 120); assert.equal(projection.groups[0].seedsToSow.total, 320);
  assert.equal(projection.groups[0].members[0].reference?.status, 'held'); assert.match(JSON.stringify(result.snapshot?.source), /"seedLotReference":42/);
  const missing = structuredClone(result); delete (missing.batches[0] as { reference?: GrowerNurseryBatchReferenceView }).reference;
  assert.deepEqual(projectGrowerNurseryPreparation(missing).groups[0].members[0].reference, { status: 'held', reason: 'reference-unavailable' });
});

test('proposal batches stay explicitly non-persistent and cannot borrow proposed fingerprints as saved row identities', async () => {
  const f = await fixture(), result = buildGrowerNurseryForecast({ ...f.nursery,
    source: { kind: 'proposal', proposal: f.proposal, currentRequest: f.request, competingDemand: 'assessed-none' } });
  assert.equal(result.status, 'ready');
  assert.ok(result.batches.every(batch => batch.reference?.status === 'proposed' && batch.plantingIds.length === 0));
  assert.ok(projectGrowerNurseryPreparation(result).groups[0].members.every(member => member.reference?.status === 'proposed'));
  held(input(f, [change(result.batches[0].id, { seedLotReference: 'Unaccepted label' })]), 'reference-cycle-unavailable');
});

test('unsafe reference accessors, input getters and array elements are held with zero ordinary getter calls', async () => {
  const f = await fixture(); let getters = 0;
  const row = { ...f.rows[0] };
  Object.defineProperty(row, 'nurseryBatchReference', { enumerable: true, get() { getters++; return {}; } });
  assert.equal(inspectGrowerNurseryBatchReference(row).status, 'held');
  assert.equal(resolveGrowerNurseryBatchReference([row, f.rows[1]], f.context, row.id).status, 'held');
  held({ ...input(f, [change(row.id)]), originalRows: [row, f.rows[1]] });
  const executable = { ...input(f, [change(f.rows[0].id)]) };
  Object.defineProperty(executable, 'book', { enumerable: true, get() { getters++; return f.book; } }); held(executable);
  const rows = [f.rows[0], f.rows[1]];
  Object.defineProperty(rows, '0', { enumerable: true, get() { getters++; return f.rows[0]; } });
  assert.equal(resolveGrowerNurseryBatchReference(rows, f.context, f.rows[0].id).status, 'held');
  assert.equal(buildGrowerNurseryForecast(nurseryFor(f, rows)).status, 'invalid-inputs');
  assert.equal(getters, 0);
});

test('canonical crop-book save and reload preserve row references and unrelated existing variety without new storage', async () => {
  const f = await fixture(), book = labelled(f).book, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  const local = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: { getItem: () => null } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win }); bindMountedAccountLocalStorageUid('reference-fixture-owner');
  try {
    await initialiseCropPlanFixture();
    const receipt = saveCropPlanWithReceipt(book); assert.equal(receipt.saved, true);
    const loaded = loadCropPlanWithWriteAdmission();
    assert.equal(cropPlanWriteAdmissionMatches(loaded.admission, JSON.stringify(loaded.book), loaded.token), true);
    assert.deepEqual(loadCropPlan().plantings, book.plantings);
    assert.equal(saveCropPlanWithReceipt({ ...loaded.book, planNotes: [{ kind: 'basis', text: 'Unrelated ordinary edit' }] }).saved, true);
    const reopened = loadCropPlan(); assert.deepEqual(reopened.plantings, book.plantings);
    assert.equal(resolveGrowerNurseryBatchReference(reopened.plantings, f.context, f.rows[0].id).status, 'ready');
    assert.ok([...values.keys()].every(key => !key.includes('nursery_batch') && !key.includes('seed_lot')));
  } finally {
    releaseCropPlanFixture(); await Promise.resolve(); bindMountedAccountLocalStorageUid(null);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the real saved-source hook admits field-only accepted cycles without equipment or nursery evidence and retires their original private binding', async () => {
  const f = await fixture(true), bookApi = await import('../lib/crop-plan.ts');
  const account = await import('../lib/account-local-storage.ts'), samples = await import('../lib/sample-mode.ts');
  const previousOwner = account.activeAccountUid();
  const originals = new Map(['window', 'IS_REACT_ACT_ENVIRONMENT', '__fieldOnlySavedSourceBoundary']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>(); let writes = 0;
  const local = {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { writes++; values.set(key, value); },
    removeItem(key: string) { writes++; values.delete(key); },
  };
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: { getItem: () => null } });
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = f.source.resourceSiteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...template, id: `reference-bed-${index}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.lines = []; canvas.zones = [];
  const boundary = { raw: canvas, sourceReads: 0 };
  const initialSource = structuredClone(canvas), owner = 'field-only-source-owner';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  Object.defineProperty(globalThis, '__fieldOnlySavedSourceBoundary', { configurable: true, value: boundary });
  bindMountedAccountLocalStorageUid(owner);
  // Only the browser geometry transport is substituted. Production fingerprinting,
  // raw-book admission and the hook's private saved-view WeakMap execute below.
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts')) {
      if (specifier === '@/lib/design-canvas' || specifier === '@/lib/facilitator-design') return { shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent(`
          const read=()=>{const b=globalThis.__fieldOnlySavedSourceBoundary;b.sourceReads++;
            return {status:'ready',raw:structuredClone(b.raw),revision:JSON.stringify(b.raw),ownerUid:${JSON.stringify(owner)},sample:false};};
          export const readCanvasSourceReceipt=read;export const readFacilitatorSourceReceipt=read;
          export const DESIGN_CANVAS_CHANGED_EVENT='imbewu-design-canvas-changed';`) };
      if (specifier === '@/lib/db/queries') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        'export async function myDesigns(){throw Error("The field-only fixture must use its selected local geometry source");}') };
    }
    return next(specifier, context);
  } });
  let renderer: ReactTestRenderer | undefined;
  try {
    await initialiseCropPlanFixture();
    const { nursery: _equipment, ...fieldBook } = f.book;
    assert.equal(Object.hasOwn(fieldBook, 'nursery'), false);
    assert.equal(saveCropPlanWithReceipt(fieldBook).saved, true);
    const admitted = loadCropPlanWithWriteAdmission();
    assert.ok(admitted.token);
    const scopeKey = growerPlanningScopeKey(f.scope), siteId = f.source.resourceSiteId;
    const state = {
      plan: admitted.book, productionSiteId: siteId, growerOwner: owner, growerSample: false, growerScopeKey: scopeKey,
      growerBookContext: { current: { siteId, owner, sample: false, scopeKey } },
      planWriteBase: { current: { owner, sample: false, token: admitted.token, planKey: JSON.stringify(admitted.book), admission: admitted.admission } },
      planSaveConflict: false, activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode,
      isBackendConfigured: () => true, getFirebase: () => ({ auth: { currentUser: { uid: owner } } }),
      cropPlanWriteToken: bookApi.cropPlanWriteToken, readRawCropPlanReceipt: bookApi.readRawCropPlanReceipt,
      cropPlanWriteAdmissionMatches: bookApi.cropPlanWriteAdmissionMatches,
    };
    // Reuse the controller harness technique to execute the actual page reader
    // and actor checks rather than constructing a permissive receipt ourselves.
    const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'readCurrentGrowerBook'];
    const functions = new Map<string, string>();
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) functions.set(node.name.text, node.getText(page));
      ts.forEachChild(node, visit);
    };
    visit(page); assert.equal(functions.size, names.length);
    const source = ts.transpileModule([...functions.values()].join('\n'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const parent = new Function('context', `with(context){${source};return {${names.join(',')}}}`)(state) as {
      growerActorIsCurrent: () => boolean;
      readCurrentGrowerBook: () => import('../components/crops/useGrowerWorkflow.ts').GrowerWorkflowBookReceipt;
    };
    const initialRead = parent.readCurrentGrowerBook(); assert.equal(initialRead.status, 'ready');
    if (initialRead.status !== 'ready') throw Error('The actual parent did not admit the saved raw book');
    assert.equal(initialRead.book.nursery, undefined); assert.equal(initialRead.isCurrent?.(), true);
    const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
    let latest!: ReturnType<typeof useGrowerWorkflow>;
    const hookInput: Parameters<typeof useGrowerWorkflow>[0] = {
      selection: { kind: 'studio-canvas', sourceId: siteId }, scope: f.scope, resourceSiteId: siteId,
      book: admitted.book, actorIsCurrent: parent.growerActorIsCurrent, readCurrentBook: parent.readCurrentGrowerBook,
    };
    function Harness() { latest = useGrowerWorkflow(hookInput); return null; }
    act(() => { renderer = create(React.createElement(Harness)); });
    async function readOnly<T>(run: () => Promise<T>): Promise<T> {
      const before = JSON.stringify([...values]), beforeWrites = writes;
      let result!: T;
      await act(async () => { result = await run(); });
      assert.equal(JSON.stringify([...values]), before, 'acquisition/checking must not change saved bytes');
      assert.equal(writes, beforeWrites, 'acquisition/checking must not write a new permission, plan or stock record');
      return result;
    }
    function bindingCurrent(view: import('../components/crops/useGrowerWorkflow.ts').GrowerSavedNurseryReview): boolean {
      const before = JSON.stringify([...values]), beforeWrites = writes;
      const current: boolean = latest.onCheckSavedNurseryBindingCurrent(view);
      assert.equal(typeof current, 'boolean', 'the final handoff revocation check must not yield to another promise');
      assert.equal(JSON.stringify([...values]), before, 'binding revocation must not change saved bytes');
      assert.equal(writes, beforeWrites, 'a synchronous binding check cannot create fresh admission or write a record');
      return current;
    }
    const result = await readOnly(() => latest.onReadSavedNursery()); assert.equal(result.status, 'ready');
    if (result.status !== 'ready') throw Error('Field-only saved-source acquisition was held');
    const view = result.view;
    assert.equal(latest.savedNurseryReview, view); assert.deepEqual(view.rows, f.rows);
    assert.equal(view.references.length, 0); assert.deepEqual(view.horizon, { state: 'missing', reason: 'not-entered' });
    const projected = projectGrowerCycles(view.rows, view.cycleContext);
    assert.equal(projected.ownCycles.length, 2); assert.ok(projected.ownCycles.every(cycle => cycle.nurseryDemand === null));
    assert.equal(bindingCurrent(view), true);
    assert.equal(bindingCurrent(structuredClone(view)), false, 'matching bytes cannot recreate the original private binding');
    assert.equal(bindingCurrent({ kind: 'saved-nursery-review', source: view.source, rows: f.rows, cycleContext: f.context,
      horizon: { state: 'missing', reason: 'not-entered' }, references: [] }), false, 'fabricated saved-view fields grant no handoff authority');
    assert.equal(await readOnly(() => latest.onCheckSavedNurseryCurrent(view)), true);
    assert.equal(await readOnly(() => latest.onCheckSavedNurseryCurrent(structuredClone(view))), false,
      'matching public fields cannot reproduce the hook private saved-view binding');
    boundary.raw.items[0].wM = 4;
    assert.equal(bindingCurrent(view), false, 'source receipt retirement is visible synchronously before an async refresh');
    assert.equal(await readOnly(() => latest.onCheckSavedNurseryCurrent(view)), false, 'the original source receipt must still match');
    boundary.raw = structuredClone(initialSource);
    const renewed = await readOnly(() => latest.onReadSavedNursery()); assert.equal(renewed.status, 'ready');
    if (renewed.status !== 'ready') throw Error('Restored field-only source could not be explicitly recaptured');
    assert.notEqual(renewed.view, view); assert.equal(await readOnly(() => latest.onCheckSavedNurseryCurrent(renewed.view)), true);
    assert.equal(bindingCurrent(renewed.view), true); assert.equal(bindingCurrent(view), false, 'a later source capture cannot renew an older view');
    // This is a deliberate external fixture edit, outside the read-only window.
    // A subsequent check must reject it without attempting a compensating write.
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ ...fieldBook, planNotes: [{ kind: 'basis', text: 'Later source-book fixture edit' }], updatedAt: 2 }));
    assert.equal(bindingCurrent(renewed.view), false, 'a changed canonical raw book revokes handoff even without a React prop change');
    assert.equal(await readOnly(() => latest.onCheckSavedNurseryCurrent(renewed.view)), false, 'the admitted raw book token cannot be recaptured under an old view');
    assert.ok(boundary.sourceReads >= 6, 'acquisition and checks must reread the selected source around actual fingerprinting');
  } finally {
    if (renderer) act(() => renderer!.unmount());
    hooks.deregister(); releaseCropPlanFixture(); await Promise.resolve(); bindMountedAccountLocalStorageUid(previousOwner);
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
