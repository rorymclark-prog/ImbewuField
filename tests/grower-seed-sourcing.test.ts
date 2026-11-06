import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest } from '../lib/international/grower-nursery.ts';
import { reviewGrowerSeedSourcing, type GrowerSeedSourcingGroupInput } from '../lib/international/grower-seed-sourcing.ts';

// Reuse the established preparation arithmetic controls. These numbers are
// synthetic test inputs, never seed recommendations or observed inventory.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
const crop = CROPS.find(row => !row.transplant)!;
async function fixture() {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...template, id: `private-sourcing-bed-${index}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-sourcing-source-receipt' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-sourcing-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-sourcing-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Fixture proposal unavailable');
  assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, index) => createGrowerCyclePlanting(cycle, {
    plantingId: `private-sourcing-planting-${index}`, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint,
  })!);
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Fixture container', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Fixture surface', usableM2: 10 }],
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const review: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows,
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint } }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(review); assert.equal(result.status, 'ready', result.issues.join(','));
  assert.equal(result.sourceStatus, 'saved-planned'); assert.equal(result.batches.length, 2);
  return { review, result, settings, proposal, request };
}
const fixtures = await fixture();
const fresh = () => structuredClone({ result: fixtures.result, currentRequest: fixtures.review });
const group = (batchIds = fixtures.result.batches.map(batch => batch.id), extra: Partial<GrowerSeedSourcingGroupInput> = {}): GrowerSeedSourcingGroupInput => ({
  id: 'private-confirmed-group', batchIds, interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100, ...extra,
});
const project = (groups: unknown = [group()]) => reviewGrowerSeedSourcing({ ...fresh(), groups });
function measured(seedsPerTray?: number) {
  const settings = structuredClone(fixtures.settings);
  settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 60 };
  if (seedsPerTray !== undefined) settings.profiles[0].seedsPerTray = seedsPerTray;
  const currentRequest: GrowerNurseryRequest = { ...structuredClone(fixtures.review), settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
  return { currentRequest, result: buildGrowerNurseryForecast(currentRequest) };
}

test('explicit disjoint accepted nursery membership reuses each gross seed requirement once without a second loss allowance', () => {
  const input = { ...fresh(), groups: [group()] }, before = JSON.stringify(input), result = reviewGrowerSeedSourcing(input);
  assert.deepEqual(input.result.batches.map(batch => batch.seeds), [160, 160]);
  assert.equal(result.status, 'available'); assert.equal(result.groups[0].status, 'complete');
  assert.equal(result.groups[0].requiredSeeds, 320); assert.equal(result.groups[0].knownRequiredSeedsSubtotal, 320);
  assert.deepEqual(result.groups[0].counts, { status: 'complete', neededSeeds: 300, packsNeeded: 3, plannedPackSeeds: 300 });
  assert.equal(result.representedBatchCount, 2); assert.equal(result.assignedBatchCount, 2); assert.deepEqual(result.unassignedBatchIds, []);
  assert.equal(result.coverage, 'represented-saved-transplant-batches-only'); assert.equal(result.wholeFarmCoverage, 'not-assessed');
  assert.equal(result.sourceVerification, 'not-verified'); assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.result), false);
  assert.equal(Object.isFrozen(result.groups[0].batchIds), true); assert.equal(Object.isFrozen(result.groups[0].counts), true);
  assert.match(result.guidance, /not verified varieties or seed-lot identity/); assert.match(result.guidance, /not observed stock/);
  (input.groups[0].batchIds as string[])[0] = 'caller-edit'; assert.notEqual(result.groups[0].batchIds[0], 'caller-edit');
});

test('same crop or matching recipe never silently groups unassigned batches or confirms interchangeability', () => {
  const none = project([]); assert.equal(none.status, 'partial'); assert.equal(none.assignedBatchCount, 0);
  assert.deepEqual(none.unassignedBatchIds, fixtures.result.batches.map(batch => batch.id)); assert.deepEqual(none.groups, []);
  const missing = project([group(undefined, { interchangeabilityConfirmed: false })]);
  assert.equal(missing.groups[0].status, 'held'); assert.equal(missing.groups[0].counts, null); assert.equal(missing.assignedBatchCount, 0);
  assert.ok(missing.groups[0].issues.includes('interchangeability-not-confirmed'));
  const single = project([group([fixtures.result.batches[0].id])]);
  assert.equal(single.status, 'partial'); assert.equal(single.groups[0].requiredSeeds, 160); assert.equal(single.assignedBatchCount, 1);
  assert.deepEqual(single.unassignedBatchIds, [fixtures.result.batches[1].id]);
});

test('overlaps and duplicate group IDs hold all affected groups in either input order including malformed competitors', () => {
  const ids = fixtures.result.batches.map(batch => batch.id);
  const cases: unknown[][] = [
    [group(ids, { id: 'a' }), group([ids[0]], { id: 'b' })],
    [group([ids[0]], { id: 'same' }), group([ids[1]], { id: 'same' })],
    [group([ids[0]], { id: 'a' }), { ...group([ids[0]], { id: 'b' }), unexpected: true }],
  ];
  for (const groups of cases) for (const ordered of [groups, [...groups].reverse()]) {
    const result = project(ordered); assert.deepEqual(result.groups.map(row => row.status), ['held', 'held']);
    assert.ok(result.groups.every(row => row.requiredSeeds === null && row.counts === null)); assert.equal(result.assignedBatchCount, 0);
  }
  const duplicate = project([group([ids[0], ids[0]])]); assert.equal(duplicate.groups[0].status, 'held');
  assert.ok(duplicate.groups[0].issues.includes('batch-membership-duplicate'));
});

test('foreign membership and malformed allocation cannot acquire a plausible purchase amount', () => {
  const foreign = project([group(['not-a-current-batch'])]); assert.equal(foreign.groups[0].status, 'held');
  assert.ok(foreign.groups[0].issues.includes('batch-not-in-current-review'));
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '20', false, {}]) {
    const result = project([{ ...group(), allocatedToPlanSeeds: value }]); assert.equal(result.groups[0].status, 'held');
    assert.equal(result.groups[0].counts, null); assert.equal(result.assignedBatchCount, 0);
  }
  const absent = { ...group() } as Record<string, unknown>; delete absent.allocatedToPlanSeeds;
  assert.equal(project([absent]).groups[0].status, 'held');
  for (const value of [0, -1, 2.5, '100']) assert.equal(project([{ ...group(), seedsPerPack: value }]).groups[0].status, 'held');
});

test('unknown allocation or pack size stays distinct from actual zero allocation and a surplus allocation', () => {
  const allocationUnknown = project([group(undefined, { allocatedToPlanSeeds: null })]).groups[0];
  assert.equal(allocationUnknown.requiredSeeds, 320); assert.equal(allocationUnknown.status, 'unknown');
  assert.deepEqual(allocationUnknown.counts, { status: 'unknown', neededSeeds: null, packsNeeded: null, plannedPackSeeds: null });
  const packUnknown = project([group(undefined, { seedsPerPack: null })]).groups[0];
  assert.deepEqual(packUnknown.counts, { status: 'unknown', neededSeeds: 300, packsNeeded: null, plannedPackSeeds: null });
  assert.equal(project([group(undefined, { allocatedToPlanSeeds: 0 })]).groups[0].counts?.neededSeeds, 320);
  assert.deepEqual(project([group(undefined, { allocatedToPlanSeeds: 999 })]).groups[0].counts,
    { status: 'complete', neededSeeds: 0, packsNeeded: 0, plannedPackSeeds: 0 });
});

test('canonical measured-tray seed zero is retained while unmeasured seeds never become zero', () => {
  const zero = measured(0), known = reviewGrowerSeedSourcing({ ...zero, groups: [group()] });
  assert.deepEqual(zero.result.batches.map(batch => batch.seeds), [0, 0]);
  assert.equal(known.groups[0].requiredSeeds, 0); assert.equal(known.groups[0].knownRequiredSeedsSubtotal, 0);
  assert.deepEqual(known.groups[0].counts, { status: 'complete', neededSeeds: 0, packsNeeded: 0, plannedPackSeeds: 0 });
  const unknown = measured(), review = reviewGrowerSeedSourcing({ ...unknown, groups: [group()] });
  assert.equal(unknown.result.status, 'partial'); assert.deepEqual(unknown.result.batches.map(batch => batch.seeds), [null, null]);
  assert.equal(review.status, 'partial'); assert.equal(review.groups[0].status, 'unknown'); assert.equal(review.groups[0].requiredSeeds, null);
  assert.equal(review.groups[0].knownRequiredSeedsSubtotal, null); assert.equal(review.groups[0].counts?.neededSeeds, null);
  assert.equal(review.assignedBatchCount, 2); assert.ok(review.groups[0].issues.includes('seed-requirement-unknown'));
});

test('safe canonical batches cannot overflow a summed requirement or fabricate an exact pack product', () => {
  const data = measured(Number.MAX_SAFE_INTEGER);
  assert.deepEqual(data.result.batches.map(batch => batch.seeds), [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
  const total = reviewGrowerSeedSourcing({ ...data, groups: [group(undefined, { allocatedToPlanSeeds: 0 })] }).groups[0];
  assert.equal(total.status, 'overflow'); assert.equal(total.requiredSeeds, null); assert.equal(total.knownRequiredSeedsSubtotal, null); assert.equal(total.counts, null);
  const product = reviewGrowerSeedSourcing({ ...data, groups: [group([data.result.batches[0].id], {
    allocatedToPlanSeeds: 0, seedsPerPack: Number.MAX_SAFE_INTEGER - 1,
  })] }).groups[0];
  assert.equal(product.status, 'overflow'); assert.equal(product.requiredSeeds, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(product.counts, { status: 'overflow', neededSeeds: Number.MAX_SAFE_INTEGER, packsNeeded: 2, plannedPackSeeds: null });
});

test('unresolved omitted source demand keeps the complete represented group explicitly partial', () => {
  const currentRequest = structuredClone(fixtures.review);
  if (currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(currentRequest.source.rows)) throw Error('Fixture source kind');
  // The canonical projector recognises a legacy planting by its full legacy
  // shape. An id/crop-only object is malformed held evidence, not a legacy row.
  currentRequest.source.rows.push({ id: 'private-unassessed-legacy', bedId: 'private-legacy-bed', cropKey: crop.key, sowMonth: 2 });
  const result = buildGrowerNurseryForecast(currentRequest), review = reviewGrowerSeedSourcing({ result, currentRequest, groups: [group()] });
  assert.equal(result.status, 'partial'); assert.equal(review.status, 'partial'); assert.equal(review.groups[0].requiredSeeds, 320);
  assert.ok(review.sourceIssues.includes('legacy-nursery-demand-unassessed'));
  assert.match(review.guidance, /not direct sowings or unresolved, omitted or whole-farm seed demand/);
});

test('malformed held source rows remain unresolved demand instead of pretending to be a legacy planting or zero seeds', () => {
  const currentRequest = structuredClone(fixtures.review);
  if (currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(currentRequest.source.rows)) throw Error('Fixture source kind');
  currentRequest.source.rows.push({ id: 'private-malformed-row', cropKey: crop.key });
  const result = buildGrowerNurseryForecast(currentRequest), review = reviewGrowerSeedSourcing({ result, currentRequest, groups: [group()] });
  assert.equal(result.status, 'partial'); assert.equal(review.status, 'partial'); assert.equal(review.groups[0].requiredSeeds, 320);
  assert.ok(review.sourceIssues.includes('held-cycle-demand-unresolved'));
  assert.ok(!review.sourceIssues.includes('legacy-nursery-demand-unassessed'));
});

test('proposal, stale request, changed counts or fingerprint-only claims cannot become accepted saved requirements', () => {
  const proposalRequest: GrowerNurseryRequest = { ...structuredClone(fixtures.review), source: {
    kind: 'proposal', proposal: fixtures.proposal, currentRequest: fixtures.request, competingDemand: 'assessed-none',
  } };
  assert.equal(reviewGrowerSeedSourcing({ result: buildGrowerNurseryForecast(proposalRequest), currentRequest: proposalRequest, groups: [group()] }).status, 'unavailable');
  const changed = fresh(); (changed.result.batches[0] as { seeds: number | null }).seeds = 1;
  assert.equal(reviewGrowerSeedSourcing({ ...changed, groups: [group()] }).status, 'unavailable');
  const stale = fresh(), currentRequest = { ...stale.currentRequest,
    horizon: own({ start: '2028-02-02', endExclusive: '2028-03-15' }, 'utc-date-window') };
  assert.equal(reviewGrowerSeedSourcing({ result: stale.result, currentRequest, groups: [group()] }).status, 'unavailable');
  assert.equal(reviewGrowerSeedSourcing({ result: { fingerprint: fixtures.result.fingerprint, sourceStatus: 'saved-planned' }, currentRequest: fixtures.review, groups: [group()] }).status, 'unavailable');
});

test('invalid-present undefined saved markers survive descriptor probing instead of being cloned into valid absence', () => {
  const data = fresh();
  if (data.currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(data.currentRequest.source.rows)) throw Error('Fixture source kind');
  Object.defineProperty(data.currentRequest.source.rows[0], 'nurseryBatchReference', { value: undefined, enumerable: true, writable: true, configurable: true });
  const result = reviewGrowerSeedSourcing({ ...data, groups: [group()] });
  assert.equal(result.status, 'unavailable'); assert.deepEqual(result.groups, []);
  assert.equal(Object.hasOwn(data.currentRequest.source.rows[0], 'nurseryBatchReference'), true);
});

test('a display snapshot cannot hide an invalid-present reference behind JSON equality or missing labels', () => {
  const data = fresh(), snapshot = data.result.snapshot as unknown as { source: { rows: Record<string, unknown>[] } };
  Object.defineProperty(snapshot.source.rows[0], 'nurseryBatchReference', { value: undefined, enumerable: true, writable: true, configurable: true });
  const result = reviewGrowerSeedSourcing({ ...data, groups: [group()] });
  assert.notEqual(result.status, 'available');
  assert.ok(result.status === 'unavailable' || result.groups[0].status === 'held');
  assert.ok(result.groups.every(row => row.counts === null));
  assert.equal(project().groups[0].status, 'complete', 'ordinary absent seed labels must still permit explicit grower grouping');
});

test('actual absent optional handles and harmless owned undefined copies retain canonical known seed counts without blessing saved markers', () => {
  const settings = structuredClone(fixtures.settings);
  delete settings.profiles[0].containerId; delete settings.profiles[0].spaceId;
  const currentRequest: GrowerNurseryRequest = { ...structuredClone(fixtures.review), settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
  const result = buildGrowerNurseryForecast(currentRequest);
  assert.equal(result.status, 'partial'); assert.equal(result.batches.length, 2);
  // batchFor deliberately omits unresolved handles. An optional DTO copied by
  // a form can still own undefined; neither shape invents a resolved container.
  assert.equal(Object.hasOwn(result.batches[0], 'containerId'), false); assert.equal(result.batches[0].containerId, undefined);
  const review = reviewGrowerSeedSourcing({ result, currentRequest, groups: [group()] });
  assert.equal(review.status, 'partial'); assert.equal(review.groups[0].status, 'complete'); assert.equal(review.groups[0].requiredSeeds, 320);
  const copied = structuredClone(result);
  Object.defineProperty(copied.batches[0], 'containerId', { value: undefined, enumerable: true, writable: true, configurable: true });
  Object.defineProperty(copied.batches[0], 'spaceId', { value: undefined, enumerable: true, writable: true, configurable: true });
  assert.equal(Object.hasOwn(copied.batches[0], 'containerId'), true);
  const optional = reviewGrowerSeedSourcing({ result: copied, currentRequest, groups: [group()] });
  assert.equal(optional.status, 'partial'); assert.equal(optional.groups[0].status, 'complete'); assert.equal(optional.groups[0].requiredSeeds, 320);
  assert.equal(Object.hasOwn(result.batches[0], 'containerId'), false, 'the caller original stays absent and frozen by its own canonical builder');
});

test('unsafe getters, functions and undefined arrays are held without invoking user code or freezing caller originals', () => {
  for (const location of ['result', 'currentRequest', 'groups', 'batchIds', 'allocation'] as const) {
    let calls = 0; const input = { ...fresh(), groups: [{ ...group() }] };
    const getter = { enumerable: true, configurable: true, get() { ++calls; return undefined; } };
    if (location === 'result' || location === 'currentRequest' || location === 'groups') Object.defineProperty(input, location, getter);
    else Object.defineProperty(input.groups[0], location === 'allocation' ? 'allocatedToPlanSeeds' : 'batchIds', getter);
    assert.equal(reviewGrowerSeedSourcing(input).status, 'unavailable'); assert.equal(calls, 0); assert.equal(Object.isFrozen(input), false);
  }
  for (const groups of [[undefined], [() => null], [{ ...group(), batchIds: [undefined] }]]) {
    const result = project(groups); assert.equal(result.status, 'unavailable'); assert.deepEqual(result.groups, []);
  }
  const optional = { ...fresh(), groups: [group(undefined, { seedsPerPack: undefined })] };
  assert.equal(reviewGrowerSeedSourcing(optional).groups[0].status, 'unknown');
});
