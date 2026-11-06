import './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget, PlanBed } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { assessHarvestTarget } from '../lib/harvest-targets.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { resolvePlantingBasis, type GrowerCycleOrigin } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest, type GrowerNurseryResourceWindow } from '../lib/international/grower-nursery.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import {
  assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance,
  type AssembleGrowerWorkflowReviewInput, type GrowerWorkflowDraft, type GrowerWorkflowReview,
} from '../lib/international/grower-workflow.ts';

// Synthetic engineering fixtures only; no value is a crop, household, nutrition or nursery recommendation.
const recordedAt = '2026-11-05T12:00:00.000Z';
const acceptedAt = '2026-11-05T12:05:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic arithmetic fixture.' } });
async function fixture() {
  const siteId = 'site:1.00000,1.00000';
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 1; canvas.frame.centerLng = 1;
  const first = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [1, 2].map(index => ({ ...first, id: `current-${index}`, x: index / 3, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'synthetic-private-source-receipt' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic source fixture was held');
  const scope = { kind: 'mapped-site', siteId } as const;
  // Transplanted so saved cycles reach the nursery reader; three synthetic nursery days.
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'profile-a', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'),
    nurseryDays: own(3, 'days'), fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months') } };
  const target: HarvestTarget = { id: 'target-a', siteId, cropKey: profile.cropKey, startMonth: '2028-02', endMonth: '2028-02', weeklyKg: 7, marketablePercent: 50 };
  const book: CropPlanState = { version: 1, plantings: [], growerPlanningProfiles: [profile], harvestTargets: [target], updatedAt: 123 };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '2000',
    targetProfiles: [{ targetId: target.id, profileId: profile.profileId }], available: source.beds.map(bed => ({ bedId: bed.id,
      start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true })), assumptionsConfirmed: true };
  return { scope, source, book, draft, recordedAt, profile, target };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
const entered = (f: Fixture, entryId: string, purpose: 'household' | 'trial', grossKg = '12') => ({ kind: 'grower-entered', entryId, purpose,
  cropKey: f.profile.cropKey, profileId: f.profile.profileId, grossKg, harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01' });
const buyer = (f: Fixture) => ({ kind: 'buyer-target', targetId: f.target.id, profileId: f.profile.profileId });
const ordered = (f: Fixture, demands: unknown[]) => ({ ...f.draft, targetProfiles: [], demands }) as unknown as GrowerWorkflowDraft;
function review(input: AssembleGrowerWorkflowReviewInput): Review {
  const result = assembleGrowerWorkflowReview(input);
  assert.equal(result.status, 'review', result.issues.join(','));
  if (result.status !== 'review') throw Error('held');
  return result;
}
function accept(f: Fixture, result: Review, draft: GrowerWorkflowDraft, book = f.book) {
  const prepared = prepareGrowerWorkflowAcceptance({ review: result, binding: { source: f.source, draft, recordedAt }, scope: f.scope,
    source: f.source, book, acceptedAt, plantingIds: result.proposal.cycles.map((cycle, i) => ({ cycleId: cycle.cycleId, plantingId: `row-${i + 1}` })) });
  return prepared;
}
const originOf = (row: unknown) => (row as { growerCycle: { origin?: GrowerCycleOrigin } }).growerCycle.origin;
const context = (f: Fixture) => ({ scope: f.scope, beds: f.source.beds, geometryFingerprint: f.source.geometryFingerprint });

test('mixed household, trial and buyer acceptance records each origin from the fresh replay in priority order', async () => {
  const f = await fixture();
  const draft = ordered(f, [entered(f, 'h1', 'household'), entered(f, 't1', 'trial'), buyer(f)]);
  const result = review({ ...f, draft });
  assert.equal(result.proposal.status, 'ready');
  const prepared = accept(f, result, draft);
  assert.equal(prepared.status, 'prepared', prepared.status === 'held' ? prepared.reasons.join(',') : '');
  if (prepared.status !== 'prepared') return;
  // Purpose alone lost the original requested weight/window. The complete
  // origin must retain the independent replayed request, not allocated output.
  const expected: Record<string, GrowerCycleOrigin> = {
    'grower-entered:h1': { kind: 'grower-entered', purpose: 'household', entryId: 'h1',
      demandSnapshot: result.request.demands.find(demand => demand.demandId === 'grower-entered:h1')! },
    'grower-entered:t1': { kind: 'grower-entered', purpose: 'trial', entryId: 't1',
      demandSnapshot: result.request.demands.find(demand => demand.demandId === 'grower-entered:t1')! },
    'target-a': { kind: 'buyer-target', harvestTargetId: 'target-a' } };
  assert.deepEqual([...new Set(prepared.rows.map(row => row.growerCycle.demandId))], ['grower-entered:h1', 'grower-entered:t1', 'target-a']);
  for (const row of prepared.rows) {
    assert.deepEqual(row.growerCycle.origin, expected[row.growerCycle.demandId]);
    assert.equal(row.harvestTargetId, row.growerCycle.origin?.kind === 'buyer-target' ? 'target-a' : undefined);
    assert.equal(resolvePlantingBasis(row, context(f)).kind, 'grower-dated-cycle');
  }
  assert.equal(prepared.rows[0].growerCycle.origin?.kind, 'grower-entered', 'first priority keeps the first slot');
});

test('harvest-target coverage links only explicit buyer IDs; an entered cycle never counts as commercial coverage', async () => {
  const f = await fixture();
  const draft = ordered(f, [entered(f, 'h1', 'household', '24'), buyer(f)]);
  const prepared = accept(f, review({ ...f, draft }), draft);
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') return;
  const beds: PlanBed[] = f.source.beds.map(bed => ({ ...bed }));
  const now = { year: 2028, month: 1 };
  const enteredRows = prepared.rows.filter(row => row.growerCycle.origin?.kind === 'grower-entered');
  const buyerRows = prepared.rows.filter(row => row.growerCycle.origin?.kind === 'buyer-target');
  assert.ok(enteredRows.length > 0 && buyerRows.length > 0);
  const onlyEntered = assessHarvestTarget(f.target, beds, [...enteredRows], now)!;
  assert.deepEqual([onlyEntered.allocatedKg, onlyEntered.grossCycleKg, onlyEntered.excludedRows], [0, 0, 0], 'not linked at all');
  // Negative control (existing base behaviour): explicitly linked own cycles are seen as linked,
  // yet never earn catalogue kilograms, because tagged rows get no catalogue window or yield.
  const all = assessHarvestTarget(f.target, beds, [...prepared.rows], now)!;
  assert.equal(all.excludedRows, buyerRows.length);
  assert.equal(all.allocatedKg, 0);
  // A forged buyer link on an entered cycle holds operationally and still earns nothing.
  const forged = { ...enteredRows[0], harvestTargetId: f.target.id };
  assert.deepEqual(resolvePlantingBasis(forged, context(f)), { kind: 'held', reasons: ['origin-row-mismatch'] });
  assert.equal(assessHarvestTarget(f.target, beds, [forged], now)!.allocatedKg, 0);
  const blocked = assembleGrowerWorkflowReview({ ...f, book: { ...f.book, plantings: [forged] } });
  assert.equal(blocked.status, 'held'); assert.ok(blocked.issues.includes('availability-bed-blocked'));
  assert.ok(blocked.blockedBeds.some(row => row.bedId === forged.bedId && row.reasons.includes('origin-row-mismatch')));
});

test('saved entered cycles reserve land in later reviews and project their readable origin', async () => {
  const f = await fixture();
  const draft = ordered(f, [entered(f, 'h1', 'household')]);
  const originalReview = review({ ...f, draft });
  const prepared = accept(f, originalReview, draft);
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') return;
  const stored = JSON.parse(JSON.stringify(prepared.book)) as CropPlanState;
  const later = review({ ...f, book: stored });
  assert.deepEqual(later.request.reserved.map(row => row.id), prepared.rows.map(row => row.id));
  assert.deepEqual(later.existingOwnCycles.map(cycle => cycle.origin),
    prepared.rows.map(() => ({ status: 'recorded', origin: { kind: 'grower-entered', purpose: 'household', entryId: 'h1',
      demandSnapshot: originalReview.request.demands[0] } })));
  for (const cycle of later.proposal.cycles) for (const reserved of later.existingOwnCycles.filter(own => own.bedId === cycle.bedId)) {
    assert.ok(cycle.assessment.schedule.nextFieldEntryDate <= reserved.reservation.start
      || cycle.assessment.schedule.fieldEntryDate >= reserved.reservation.endExclusive);
  }
  assert.deepEqual(projectGrowerCycles(stored.plantings, context(f)).ownCycles.map(cycle => cycle.demandId), ['grower-entered:h1']);
});

test('intent edited after review cannot pass; the saved purpose always comes from a fresh review', async () => {
  const f = await fixture();
  const draft = ordered(f, [entered(f, 'h1', 'household')]);
  const result = review({ ...f, draft });
  const switched = ordered(f, [entered(f, 'h1', 'trial')]);
  assert.deepEqual(accept(f, result, switched), { status: 'held', reasons: ['review-no-longer-current'] });
  const renamed = ordered(f, [entered(f, 'h2', 'household')]);
  assert.deepEqual(accept(f, result, renamed), { status: 'held', reasons: ['review-no-longer-current'] });
  const fresh = accept(f, review({ ...f, draft: switched }), switched);
  assert.equal(fresh.status, 'prepared');
  if (fresh.status === 'prepared') assert.ok(fresh.rows.every(row => originOf(row)?.kind === 'grower-entered'
    && (originOf(row) as { purpose: string }).purpose === 'trial'));
  // Replaying the same accepted review against its own saved result is refused, not re-appended.
  const first = accept(f, result, draft);
  assert.equal(first.status, 'prepared');
  if (first.status === 'prepared') assert.deepEqual(accept(f, result, draft, first.book), { status: 'held', reasons: ['proposal-already-recorded'] });
});

test('saved nursery batches carry the recorded origin and still revalidate source, geometry and held rows', async () => {
  const f = await fixture();
  const draft = ordered(f, [entered(f, 'h1', 'household')]);
  const result = review({ ...f, draft });
  const prepared = accept(f, result, draft);
  assert.equal(prepared.status, 'prepared');
  if (prepared.status !== 'prepared') return;
  const namespace = f.source.resourceSiteId;
  const settings: NurserySettings = { version: 1, containers: [{ id: 'tray', siteId: namespace, name: 'Fixture trays', cells: 40, widthCm: 50, lengthCm: 40, owned: 5 }],
    spaces: [{ id: 'bench', siteId: namespace, name: 'Fixture bench', usableM2: 2 }],
    profiles: [{ id: 'recipe', siteId: namespace, cropKey: f.profile.cropKey, model: 'seed-cell', containerId: 'tray', spaceId: 'bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const nurseryWindow = { start: '2028-01-15', endExclusive: '2028-03-15' };
  const stored = JSON.parse(JSON.stringify(prepared.book.plantings));
  const windows: GrowerNurseryResourceWindow[] = [{ resourceKind: 'container', resourceId: 'tray', scope: f.scope, window: nurseryWindow, quantity: 5 },
    { resourceKind: 'space', resourceId: 'bench', scope: f.scope, window: nurseryWindow, quantity: 2 }];
  const request: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows: stored, cycleContext: context(f) }, resourceContext: f.source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'), horizon: own(nurseryWindow, 'utc-date-window'),
    availability: own(windows, 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const saved = buildGrowerNurseryForecast(request);
  assert.ok(['ready', 'partial'].includes(saved.status), saved.issues.join(','));
  assert.equal(saved.sourceStatus, 'saved-planned');
  assert.ok(saved.batches.length > 0);
  for (const batch of saved.batches) assert.deepEqual(batch.origin, { status: 'recorded',
    origin: { kind: 'grower-entered', purpose: 'household', entryId: 'h1', demandSnapshot: result.request.demands[0] } });
  assert.ok(saved.batches.every(batch => batch.demandId === 'grower-entered:h1'));
  // Moved geometry: the saved source is stale, so no batch (or origin) is produced.
  const moved = buildGrowerNurseryForecast({ ...request, source: { kind: 'saved-cycles', rows: stored,
    cycleContext: { ...context(f), geometryFingerprint: 'same-area-moved-source' } } });
  assert.equal(moved.status, 'stale-source'); assert.deepEqual(moved.batches, []);
  // A tampered origin holds the row; nursery reports unresolved own work instead of a household batch.
  const tampered = stored.map((row: { growerCycle: Record<string, unknown> }) => ({ ...row, growerCycle: { ...row.growerCycle,
    origin: { kind: 'grower-entered', purpose: 'sale', entryId: 'h1' } } }));
  const held = buildGrowerNurseryForecast({ ...request, source: { kind: 'saved-cycles', rows: tampered, cycleContext: context(f) } });
  assert.deepEqual(held.batches, []); assert.ok(held.issues.includes('held-cycle-demand-unresolved'));
  // A not-yet-accepted proposal has no recorded origin; the review metadata names intent instead.
  const proposed = buildGrowerNurseryForecast({ ...request, source: { kind: 'proposal', proposal: result.proposal,
    currentRequest: result.request, competingDemand: 'assessed-none' } });
  assert.ok(proposed.batches.length > 0 && proposed.batches.every(batch => batch.origin?.status === 'proposed'));
  assert.deepEqual(result.enteredDemandMetadata?.map(meta => [meta.demandId, meta.purpose]), [['grower-entered:h1', 'household']]);
});
