import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, isGrowerNurseryForecastCurrent, nurserySettingsFingerprint, projectGrowerNurseryPreparation,
  type GrowerNurseryRequest, type GrowerNurseryResult } from '../lib/international/grower-nursery.ts';
import { buildGrowerNurseryCsv, buildGrowerNurseryPreparationCsv } from '../lib/nursery-export.ts';

// Synthetic arithmetic controls, not crop recommendations or an actual seed order.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
const crop = CROPS.find(row => !row.transplant)!;
async function fixture() {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...template, id: `private-preparation-bed-${index}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-preparation-source-receipt' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-preparation-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-preparation-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Fixture proposal unavailable');
  assert.equal(proposal.cycles.length, 2);
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Fixture container', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Fixture surface', usableM2: 10 }],
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const review: GrowerNurseryRequest = { source: { kind: 'proposal', proposal, currentRequest: request, competingDemand: 'assessed-none' }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(review); assert.equal(result.status, 'ready', result.issues.join(','));
  return { result, review, source, settings, proposal };
}
const fixtures = await fixture();
const freshResult = () => structuredClone(fixtures.result);
function readCsv(csv: string): Record<string, string>[] {
  const table: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const content = csv.replace(/^\uFEFF/, '');
  for (let index = 0; index < content.length; index++) {
    const ch = content[index];
    if (ch === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; ++index; } else quoted = !quoted; }
    else if (!quoted && ch === ',') { row.push(cell); cell = ''; }
    else if (!quoted && ch === '\r' && content[index + 1] === '\n') { row.push(cell); table.push(row); row = []; cell = ''; ++index; }
    else cell += ch;
  }
  assert.equal(quoted, false); const headers = table.shift()!;
  return table.map(values => { assert.equal(values.length, headers.length); return Object.fromEntries(headers.map((header, index) => [header, values[index]])); });
}

test('the actual two-bed forecast sums each already-rounded raising batch once, keeping field stand, starts and seeds distinct', () => {
  const result = freshResult(), before = JSON.stringify(result), projection = projectGrowerNurseryPreparation(result);
  assert.equal(projection.status, 'available'); assert.equal(projection.groups.length, 1); assert.equal(projection.representedBatchCount, 2);
  const group = projection.groups[0];
  assert.deepEqual(result.batches.map(batch => [batch.targetPositions, batch.starts, batch.seeds]), [[48, 60, 160], [48, 60, 160]]);
  assert.equal(group.fieldPositions.total, 96); assert.equal(group.startsToRaise.total, 120); assert.equal(group.seedsToSow.total, 320);
  for (const [field, metric] of [['targetPositions', group.fieldPositions], ['starts', group.startsToRaise], ['seeds', group.seedsToSow]] as const) {
    const independent = result.batches.reduce((sum, batch) => sum + BigInt(batch[field]!), BigInt(0));
    assert.equal(BigInt(metric.total!), independent); assert.equal(metric.status, 'complete');
  }
  assert.deepEqual(group.batchIds, result.batches.map(batch => batch.id));
  assert.deepEqual(group.members.map(member => member.endDateExclusive), result.batches.map(batch => batch.endDateExclusive));
  assert.equal(projection.fingerprint, result.fingerprint); assert.equal(projection.sourceContext?.resourceSiteId, fixtures.source.resourceSiteId);
  assert.deepEqual(projection.horizon, { start: '2028-02-01', endExclusive: '2028-03-15' });
  assert.equal(JSON.stringify(result), before); assert.equal(Object.isFrozen(result), false); assert.equal(Object.isFrozen(projection.groups[0].members), true);
});

test('same-name crops never merge different exact planning profiles or raising start dates', () => {
  const result = freshResult();
  (result.batches[1] as { profileId: string }).profileId = 'private-other-profile';
  assert.equal(projectGrowerNurseryPreparation(result).groups.length, 2);
  const next = freshResult(); (next.batches[1] as { startDate: string }).startDate = '2028-02-10';
  assert.equal(projectGrowerNurseryPreparation(next).groups.length, 2);
  assert.equal(isGrowerNurseryForecastCurrent(next, fixtures.review), false, 'a projection does not authenticate a changed displayed result');
});

test('unknown seed quantities preserve known starts and explicit represented-batch subtotals without claiming a complete requirement', () => {
  const result = freshResult(); (result.batches[1] as { seeds: number | null }).seeds = null;
  const group = projectGrowerNurseryPreparation(result).groups[0];
  assert.equal(group.fieldPositions.total, 96); assert.equal(group.startsToRaise.total, 120);
  assert.deepEqual(group.seedsToSow, { status: 'unknown', knownSubtotal: 160, total: null, knownBatchCount: 1, unknownBatchCount: 1, unknownBatchIds: [result.batches[1].id] });
  for (const batch of result.batches) (batch as { seeds: number | null }).seeds = null;
  const allUnknown = projectGrowerNurseryPreparation(result).groups[0].seedsToSow;
  assert.equal(allUnknown.total, null); assert.equal(allUnknown.knownSubtotal, null); assert.equal(allUnknown.knownBatchCount, 0);
});

test('a real measured-tray review retains zero seeds and known starts while missing seed measurements remain independent', () => {
  const settings = structuredClone(fixtures.settings);
  settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 20, seedsPerTray: 0 };
  let review = { ...fixtures.review, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
  let projection = projectGrowerNurseryPreparation(buildGrowerNurseryForecast(review));
  assert.equal(projection.groups[0].seedsToSow.total, 0); assert.equal(projection.groups[0].seedsToSow.status, 'complete');
  delete settings.profiles[0].seedsPerTray;
  review = { ...review, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
  projection = projectGrowerNurseryPreparation(buildGrowerNurseryForecast(review));
  assert.equal(projection.reviewStatus, 'partial'); assert.equal(projection.groups[0].startsToRaise.total, 120);
  assert.equal(projection.groups[0].seedsToSow.status, 'unknown'); assert.equal(projection.groups[0].seedsToSow.total, null);
});

test('held/omitted source demand keeps whole-review coverage partial even when represented count metrics are complete', () => {
  if (fixtures.review.source.kind !== 'proposal') throw Error('Fixture kind');
  const result = buildGrowerNurseryForecast({ ...fixtures.review, source: { ...fixtures.review.source, competingDemand: 'unresolved' } });
  const projection = projectGrowerNurseryPreparation(result);
  assert.equal(projection.reviewStatus, 'partial'); assert.equal(projection.reviewIncomplete, true);
  assert.equal(projection.groups[0].seedsToSow.status, 'complete');
  assert.equal(projection.coverage, 'represented-transplant-raising-batches-only');
  assert.ok(projection.issues.includes('competing-nursery-demand-unresolved')); assert.match(projection.guidance, /Direct sowings and unresolved or omitted work are not included/);
});

test('malformed or duplicate batch identity/date/count evidence cannot silently become a deduplicated complete group', () => {
  const changes: Array<(result: GrowerNurseryResult) => void> = [
    result => { (result.batches[1] as { id: string }).id = result.batches[0].id; },
    result => { (result.batches[1] as { id: string }).id = result.batches[0].id; (result.batches[1] as { profileId: string }).profileId = 'different-group'; },
    result => { (result.batches[1] as { targetPositions: number }).targetPositions = 0.5; },
    result => { (result.batches[1] as unknown as { starts: undefined }).starts = undefined; },
    result => { (result.batches[1] as { profileId: string }).profileId = ''; },
    result => { (result.batches[1] as { startDate: string }).startDate = '2028-02-30'; },
    result => { (result.batches[1] as { endDateExclusive: string }).endDateExclusive = '2028-01-01'; },
    result => { (result.batches[1] as { sourceStatus: string }).sourceStatus = 'saved-planned'; },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(value => (result: GrowerNurseryResult) => { (result.batches[1] as { seeds: number }).seeds = value; }),
  ];
  for (const change of changes) {
    const result = freshResult(); change(result); const projection = projectGrowerNurseryPreparation(result);
    assert.equal(projection.status, 'unavailable'); assert.deepEqual(projection.groups, []); assert.equal(projection.projectionIncomplete, true);
  }
});

test('safe integer overflow cannot become a rounded total or a plausible partial zero', () => {
  const result = freshResult();
  (result.batches[0] as { seeds: number }).seeds = Number.MAX_SAFE_INTEGER;
  (result.batches[1] as { seeds: number }).seeds = 1;
  const projection = projectGrowerNurseryPreparation(result), metric = projection.groups[0].seedsToSow;
  assert.equal(metric.status, 'overflow'); assert.equal(metric.total, null); assert.equal(metric.knownSubtotal, null);
  assert.equal(metric.knownBatchCount, 2); assert.equal(projection.projectionIncomplete, true);
  assert.equal(projection.groups[0].startsToRaise.total, 120);
  const boundary = freshResult();
  (boundary.batches[0] as { seeds: number }).seeds = Number.MAX_SAFE_INTEGER - 1;
  (boundary.batches[1] as { seeds: number }).seeds = 1;
  const exact = projectGrowerNurseryPreparation(boundary).groups[0].seedsToSow;
  assert.equal(exact.status, 'complete'); assert.equal(exact.total, Number.MAX_SAFE_INTEGER);
});

test('exclusive field-entry dates and out-of-horizon members stay intact instead of silently clipping or moving them', () => {
  const result = freshResult(); (result.batches[1] as { endDateExclusive: string }).endDateExclusive = '2028-03-20';
  const group = projectGrowerNurseryPreparation(result).groups[0];
  assert.equal(group.members[1].endDateExclusive, '2028-03-20'); assert.equal(group.outsideReviewHorizon, true);
  assert.equal(group.seedsToSow.total, 320); assert.ok(group.issues.includes('nursery-cycle-outside-review-horizon'));
  const zero = freshResult(); (zero.batches[0] as { endDateExclusive: string }).endDateExclusive = zero.batches[0].startDate;
  const unresolved = projectGrowerNurseryPreparation(zero).groups[0];
  assert.equal(unresolved.incomplete, true); assert.ok(unresolved.issues.includes('positive-target-zero-nursery-interval'));
});

test('missing or invalid reviews provide no groups or complete-zero claim; a real empty transplant review stays explicitly limited', () => {
  for (const value of [undefined, null, {}, { ...freshResult(), snapshot: null }, { ...freshResult(), status: 'stale-source' }]) {
    const projection = projectGrowerNurseryPreparation(value as GrowerNurseryResult);
    assert.equal(projection.status, 'unavailable'); assert.deepEqual(projection.groups, []); assert.equal(projection.projectionIncomplete, true);
    const csv = readCsv(buildGrowerNurseryPreparationCsv(value as GrowerNurseryResult));
    assert.equal(csv.length, 1); assert.equal(csv[0].represented_batch_count, 'unknown');
  }
  if (fixtures.review.source.kind !== 'proposal') throw Error('Fixture kind');
  const currentRequest = { ...fixtures.review.source.currentRequest, demands: [] };
  const proposal = generateGrowerAutoPlan(currentRequest);
  assert.ok(proposal.status === 'ready' || proposal.status === 'with-gaps');
  const empty = buildGrowerNurseryForecast({ ...fixtures.review, source: { kind: 'proposal', proposal, currentRequest, competingDemand: 'assessed-none' } });
  const projection = projectGrowerNurseryPreparation(empty); assert.equal(projection.status, 'available'); assert.equal(projection.representedBatchCount, 0);
  assert.deepEqual(projection.groups, []); assert.match(projection.guidance, /do not establish whole-farm seed demand/);
});

test('saved-planned cycles remain planned and retain exact private membership internally', () => {
  const rows = fixtures.proposal.cycles.map((cycle, index) => createGrowerCyclePlanting(cycle, {
    plantingId: `private-preparation-planting-${index}`, acceptedAt: stamp, geometryFingerprint: fixtures.source.geometryFingerprint,
  })!);
  const result = buildGrowerNurseryForecast({ ...fixtures.review, source: { kind: 'saved-cycles', rows,
    cycleContext: { scope: fixtures.source.scope, beds: fixtures.source.beds, geometryFingerprint: fixtures.source.geometryFingerprint } } });
  const projection = projectGrowerNurseryPreparation(result);
  assert.equal(projection.status, 'available'); assert.equal(projection.sourceStatus, 'saved-planned');
  assert.deepEqual(projection.groups[0].members.flatMap(member => member.plantingIds), rows.map(row => row.id));
  assert.match(projection.guidance, /not observed sowings/);
});

test('the worksheet CSV formats the same exact projection, UTC scope and independent known/unknown metric statuses', () => {
  const result = freshResult(); (result.batches[1] as { seeds: number | null }).seeds = null;
  const projection = projectGrowerNurseryPreparation(result), entries = readCsv(buildGrowerNurseryPreparationCsv(result, { sample: true }));
  assert.match(entries[0].plan_basis, /DEMO/); assert.equal(entries[0].source_verification, 'not-verified'); assert.equal(entries[0].coverage, projection.coverage);
  const metrics = entries.filter(row => row.record_type === 'preparation_group_metric'); assert.equal(metrics.length, 3);
  for (const [name, metric] of [['field_positions', projection.groups[0].fieldPositions], ['starts_to_raise', projection.groups[0].startsToRaise], ['seeds_to_sow', projection.groups[0].seedsToSow]] as const) {
    const row = metrics.find(item => item.metric === name)!;
    assert.equal(row.known_subtotal, String(metric.knownSubtotal)); assert.equal(row.represented_batch_total, metric.total === null ? 'unknown' : String(metric.total));
    assert.equal(row.metric_status, metric.status); assert.equal(row.unknown_batch_count, String(metric.unknownBatchCount));
    assert.equal(row.raising_start_date_utc, projection.groups[0].startDate);
    assert.equal(row.field_entry_dates_exclusive_utc, projection.groups[0].members.map(member => member.endDateExclusive).join(' | '));
  }
});

test('shareable preparation never includes private identities, fingerprints, raw issue text or untrusted source labels', () => {
  const result = freshResult(), marker = 'private-preparation-secret-marker';
  (result.issues as string[]).push(`unrecognised:${marker}`);
  (result.batches[0] as { cropName: string }).cropName = `=HYPERLINK("${marker}")`;
  (result.batches[0].issues as string[]).push(`unrecognised:${marker}`);
  const before = JSON.stringify(result), csv = buildGrowerNurseryPreparationCsv(result);
  for (const secret of [marker, 'private-preparation', 'private-tray', 'private-bench', 'private-recipe', result.fingerprint!, fixtures.source.geometryFingerprint,
    ...result.batches.map(batch => batch.id)]) assert.ok(!csv.includes(secret), `Private data escaped: ${secret.slice(0, 40)}`);
  assert.equal(JSON.stringify(result), before);
  const rows = readCsv(csv); assert.match(rows[0].issues, /required nursery inputs or source checks remain unresolved/);
  assert.ok(rows.every(row => !('profile_id' in row) && !('batch_id' in row) && !('site_name' in row)));
  assert.doesNotMatch(csv, /HYPERLINK|acceptedAt|sourceRevision|geometryFingerprint|stock_available|pack_weight|unit_price/);
});

test('the existing own nursery CSV remains its original batch/resource schema', () => {
  const csv = buildGrowerNurseryCsv(fixtures.result, fixtures.source.beds);
  const first = Object.keys(readCsv(csv)[0]).join(',');
  assert.equal(first, 'record_type,site_name,plan_basis,source_status,review_status,headroom,crop_name,growing_spaces,start_date,end_date_exclusive,target_final_positions,starts,seeds,trays,area_m2,nursery_model,resource_type,resource_name,recorded_capacity,peak_known_min,peak_known_max,shortage_upper_end,availability_quantity,availability_complete,incomplete,assumptions,issues');
  const rows = readCsv(csv); assert.equal(rows.filter(row => row.record_type === 'dated_raising_batch').length, 2);
  assert.ok(rows.every(row => row.record_type !== 'preparation_group_metric'));
});
