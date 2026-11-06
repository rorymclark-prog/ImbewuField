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
import { reviewGrowerSeedSourcing, type GrowerSeedSourcingReview } from '../lib/international/grower-seed-sourcing.ts';
import { buildGrowerSeedSourcingCsv } from '../lib/nursery-export.ts';
import { csvCell } from '../lib/journal-export.ts';

// Canonical accepted-cycle controls, using only existing catalog identities.
// Fixture quantities are arithmetic controls, never recommendations or stock.
const stamp = '2026-11-05T12:00:00.000Z';
const crop = CROPS[0];
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
const priorColumns = ['record_type', 'plan_basis', 'source_verification', 'coverage', 'whole_farm_coverage',
  'review_status', 'nursery_review_status', 'horizon_start_utc', 'horizon_end_exclusive_utc', 'represented_batch_count',
  'assigned_batch_count', 'unassigned_batch_count', 'supply_group_number', 'group_status', 'known_required_seed_subtotal',
  'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds', 'guidance'] as const;
const identificationColumns = ['entered_supply_group_label', 'label_status', 'public_crop_names', 'identification_description'] as const;

async function fixture(bedCount = 2, mixedRecipe = false) {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = Array.from({ length: bedCount }, (_, index) => ({ ...template,
    id: `private-sourcing-bed-${index}`, x: (index + 1) / (bedCount + 1), y: 0.5, wM: 3, hM: 4,
  }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-sourcing-source-receipt' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-sourcing-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const profiles = mixedRecipe ? [profile, { ...profile, profileId: 'private-other-profile', cropKey: CROPS[1].key }] : [profile];
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles,
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: profiles.map((entry, index) => ({ demandId: `private-sourcing-demand-${index}`, profileId: entry.profileId, scope,
      totalKg: own(mixedRecipe ? 1 : 12 * (bedCount - 1) + 1, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') })), maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Fixture proposal unavailable');
  assert.equal(proposal.cycles.length, bedCount);
  const rows = proposal.cycles.map((cycle, index) => createGrowerCyclePlanting(cycle, {
    plantingId: `private-sourcing-planting-${index}`, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint,
  })!);
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Private container label', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Private surface label', usableM2: 10 }],
    profiles: profiles.map((entry, index) => ({ id: `private-recipe-${index}`, siteId: source.resourceSiteId, cropKey: entry.cropKey, model: 'seed-cell',
      containerId: 'private-tray', spaceId: 'private-bench', fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 })) };
  const currentRequest: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows,
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint } }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(currentRequest);
  assert.equal(result.sourceStatus, 'saved-planned'); assert.equal(result.batches.length, bedCount);
  assert.equal(result.status, 'ready', result.issues.join(','));
  return { currentRequest, result, settings, proposal, request };
}
const base = await fixture();
const fresh = () => structuredClone({ currentRequest: base.currentRequest, result: base.result });
function group(batchIds = base.result.batches.map(batch => batch.id), extra: Record<string, unknown> = {}) {
  return { id: 'private-supply-group', batchIds, interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100, ...extra };
}
function arithmetic(value: GrowerSeedSourcingReview) {
  return { ...value, groups: value.groups.map(({ identification: _identification, ...row }) => row) };
}
function publicNames(data: { result: typeof base.result }) {
  return [...new Set(data.result.batches.map(batch => {
    const entry = CROPS.find(row => row.key === batch.cropKey); assert.ok(entry, 'Canonical crop identity must already exist'); return entry.name;
  }))];
}
function table(csv: string) {
  const records: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const raw = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\r' && raw[i + 1] === '\n' && !quoted) { row.push(cell); records.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  assert.equal(quoted, false); const header = records.shift()!;
  assert.deepEqual(header.slice(0, 20), [...priorColumns]); assert.deepEqual(header.slice(20), [...identificationColumns]);
  for (const values of records) assert.equal(values.length, 24);
  return { header, rows: records.map(values => Object.fromEntries(header.map((key, i) => [key, values[i]]))) };
}
function escapeValue(text: string) {
  // Decode the single authoritative serializer cell rather than maintaining a
  // second formula-safety implementation in this test's expected value.
  const encoded = csvCell(text); return encoded.slice(1, -1).replace(/""/g, '"');
}

test('exact entered labels and canonical crop names add public identification without changing any prior arithmetic or review status', () => {
  const data = fresh(), raw = '  My supplies — 家庭 / familia  ', input = { ...data, groups: [group(undefined, { label: raw })] };
  const before = JSON.stringify(input), baseline = reviewGrowerSeedSourcing({ ...data, groups: [group()] }), result = reviewGrowerSeedSourcing(input);
  assert.deepEqual(arithmetic(result), arithmetic(baseline)); assert.equal(result.groups[0].status, 'complete');
  assert.equal(result.groups[0].requiredSeeds, 320); assert.equal(result.groups[0].counts?.neededSeeds, 300);
  const identification = result.groups[0].identification;
  assert.equal(identification.enteredLabel, raw); assert.equal(identification.labelStatus, 'provided');
  assert.deepEqual(identification.cropNames, publicNames(data)); assert.equal(identification.cropIdentityCount, 1); assert.equal(identification.cropStatus, 'complete');
  assert.ok(identification.description.trim()); assert.equal(JSON.stringify(input), before); assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(identification), true); assert.equal(Object.isFrozen(identification.cropNames), true);
  assert.doesNotMatch(JSON.stringify(identification), /private-|site:0\.00000|fingerprint|plantingIds|batchIds|profileId/);
});

test('missing, empty and whitespace-only labels remain explicitly not recorded while every supplied primitive string retains its exact spelling', () => {
  const data = fresh(), baseline = reviewGrowerSeedSourcing({ ...data, groups: [group()] });
  const absent = baseline.groups[0].identification; assert.equal(absent.enteredLabel, null); assert.equal(absent.labelStatus, 'not-recorded');
  assert.match(absent.description, /label|identif/i);
  // Optional presentation fields follow ordinary undefined-object omission;
  // explicit null remains invalid evidence in the next control.
  const optional = reviewGrowerSeedSourcing({ ...data, groups: [group(undefined, { label: undefined })] });
  assert.deepEqual(arithmetic(optional), arithmetic(baseline));
  assert.equal(optional.groups[0].identification.enteredLabel, null);
  assert.equal(optional.groups[0].identification.labelStatus, 'not-recorded');
  for (const raw of ['', '   ', '\t \n', 'x', '  0007  ', 'é e\u0301 हिंदी বাংলা']) {
    const result = reviewGrowerSeedSourcing({ ...data, groups: [group(undefined, { label: raw })] });
    assert.deepEqual(arithmetic(result), arithmetic(baseline)); assert.equal(result.groups[0].identification.enteredLabel, raw);
    assert.equal(result.groups[0].identification.labelStatus, raw.trim() ? 'provided' : 'not-recorded');
  }
});

test('safe nonstring label evidence is invalid presentation rather than a numeric hold or a coerced user label', () => {
  const data = fresh(), baseline = reviewGrowerSeedSourcing({ ...data, groups: [group()] });
  for (const value of [null, 7, false, {}, [], { label: 'not a primitive' }]) {
    const result = reviewGrowerSeedSourcing({ ...data, groups: [group(undefined, { label: value })] });
    assert.deepEqual(arithmetic(result), arithmetic(baseline));
    assert.equal(result.groups[0].identification.enteredLabel, null); assert.equal(result.groups[0].identification.labelStatus, 'invalid');
    assert.match(result.groups[0].identification.description, /label|identif/i);
  }
});

test('unsafe label descriptors and functions retain the existing full input hold without invoking getters or conversion hooks', () => {
  let calls = 0;
  const getter = { ...group() };
  Object.defineProperty(getter, 'label', { enumerable: true, get() { calls++; throw Error('must not execute'); } });
  for (const candidate of [getter, group(undefined, { label: () => { calls++; return 'unsafe'; } }),
    group(undefined, { label: { toString() { calls++; return 'unsafe'; } } })]) {
    const result = reviewGrowerSeedSourcing({ ...fresh(), groups: [candidate] });
    assert.equal(result.status, 'unavailable'); assert.deepEqual(result.groups, []); assert.equal(calls, 0);
  }
});

test('multiple known crop identities are identified and warned about without inventing a compatibility prohibition or changing the confirmed arithmetic', async () => {
  const data = await fixture(2, true), ids = data.result.batches.map(batch => batch.id);
  assert.equal(new Set(data.result.batches.map(batch => batch.cropKey)).size, 2);
  const baseline = reviewGrowerSeedSourcing({ ...data, groups: [group(ids)] });
  const result = reviewGrowerSeedSourcing({ ...data, groups: [group(ids, { label: 'My explicit combined planning group' })] });
  assert.equal(baseline.groups[0].status, 'complete'); assert.equal(result.groups[0].status, 'complete');
  assert.deepEqual(arithmetic(result), arithmetic(baseline)); assert.equal(result.groups[0].requiredSeeds, 320);
  const identification = result.groups[0].identification;
  assert.equal(identification.cropIdentityCount, 2); assert.equal(identification.cropStatus, 'complete');
  assert.deepEqual([...identification.cropNames].sort(), publicNames(data).sort());
  assert.match(identification.description, /multiple|more than one|different crop/i);
  assert.match(`${identification.description} ${result.guidance}`, /not verified|not verify|not.*interchangeab|does not.*interchangeab/i);
});

test('foreign and missing memberships expose only the ready canonical known subset and never turn raw handles into crop names', () => {
  const data = fresh(), known = data.result.batches[0].id, foreign = 'private-foreign-batch-crop-name';
  const mixed = reviewGrowerSeedSourcing({ ...data, groups: [group([known, foreign], { label: 'Entered review label' })] }).groups[0];
  assert.equal(mixed.status, 'held'); assert.equal(mixed.counts, null);
  assert.deepEqual(mixed.identification.cropNames, publicNames(data)); assert.equal(mixed.identification.cropStatus, 'incomplete');
  assert.equal(mixed.identification.cropIdentityCount, null);
  const missing = reviewGrowerSeedSourcing({ ...data, groups: [group([foreign])] }).groups[0];
  assert.deepEqual(missing.identification.cropNames, []); assert.equal(missing.identification.cropStatus, 'unavailable');
  assert.equal(missing.identification.cropIdentityCount, null);
  assert.doesNotMatch(JSON.stringify([mixed.identification, missing.identification]), /private-|site:|fingerprint/);
});

test('held saved reference evidence cannot supply a crop label and changed displayed names cannot bypass replay', async () => {
  const data = await fixture(2, true), currentRequest = structuredClone(data.currentRequest);
  if (currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(currentRequest.source.rows)) throw Error('Fixture source kind');
  const target = currentRequest.source.rows[0];
  Object.defineProperty(target, 'nurseryBatchReference', { value: undefined, enumerable: true, configurable: true });
  const result = buildGrowerNurseryForecast(currentRequest), held = reviewGrowerSeedSourcing({ result, currentRequest, groups: [group([target.id])] }).groups[0];
  assert.equal(held.status, 'held'); assert.equal(held.counts, null); assert.deepEqual(held.identification.cropNames, []);
  assert.equal(held.identification.cropStatus, 'unavailable'); assert.equal(held.identification.cropIdentityCount, null);
  const tampered = fresh(); (tampered.result.batches[0] as { cropName: string }).cropName = 'private-pretend-public-name';
  const rejected = reviewGrowerSeedSourcing({ ...tampered, groups: [group()] });
  assert.equal(rejected.status, 'unavailable'); assert.deepEqual(rejected.groups, []);
});

test('the exact old twenty-column prefix is followed by four identification cells with JSON crop names and the existing CSV escaping authority', () => {
  const data = fresh(), baseline = reviewGrowerSeedSourcing({ ...data, groups: [group()] });
  for (const label of ['  Family supplies  ', '=FORMULA("x"), "quoted"\r\nnext', '@name', '\tstarts with tab', 'बंगाली বাংলা e\u0301']) {
    const groups = [group(undefined, { label })], projection = reviewGrowerSeedSourcing({ ...data, groups });
    assert.deepEqual(arithmetic(projection), arithmetic(baseline));
    const csv = buildGrowerSeedSourcingCsv(data.result, data.currentRequest, groups), parsed = table(csv), row = parsed.rows[1];
    assert.equal(parsed.rows.length, 2); assert.equal(csv.split('\r\n')[0], '\uFEFF' + [...priorColumns, ...identificationColumns].map(csvCell).join(','));
    assert.equal(row.entered_supply_group_label, escapeValue(label)); assert.equal(row.label_status, 'provided');
    assert.deepEqual(JSON.parse(row.public_crop_names), publicNames(data)); assert.equal(row.identification_description, projection.groups[0].identification.description);
    assert.deepEqual([row.known_required_seed_subtotal, row.required_seeds, row.additional_seeds_needed, row.planned_packs, row.planned_pack_seeds], ['320', '320', '300', '3', '300']);
    assert.doesNotMatch(csv, /private-|site:0\.00000|fingerprint|plantingIds|batchIds|profileId/);
  }
});

test('identification leaves actual zero, unknown and held quantities separate in both canonical review and appended worksheet fields', () => {
  for (const seedsPerTray of [0, undefined]) {
    const settings = structuredClone(base.settings);
    settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 60 };
    if (seedsPerTray !== undefined) settings.profiles[0].seedsPerTray = seedsPerTray;
    const currentRequest: GrowerNurseryRequest = { ...structuredClone(base.currentRequest), settings,
      settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
    const result = buildGrowerNurseryForecast(currentRequest), plain = [group(undefined, { allocatedToPlanSeeds: 0 })], labelled = [{ ...plain[0], label: 'Explicit planning supply' }];
    const before = reviewGrowerSeedSourcing({ result, currentRequest, groups: plain }), after = reviewGrowerSeedSourcing({ result, currentRequest, groups: labelled });
    assert.deepEqual(arithmetic(after), arithmetic(before));
    const row = table(buildGrowerSeedSourcingCsv(result, currentRequest, labelled)).rows[1];
    assert.equal(row.required_seeds, seedsPerTray === 0 ? '0' : 'unknown'); assert.equal(row.label_status, 'provided');
    assert.equal(row.group_status, seedsPerTray === 0 ? 'complete' : 'unknown');
    const held = [{ ...labelled[0], interchangeabilityConfirmed: false }];
    const heldRow = table(buildGrowerSeedSourcingCsv(result, currentRequest, held)).rows[1];
    assert.equal(heldRow.group_status, 'held'); assert.equal(heldRow.required_seeds, 'unknown');
  }
});

test('saved variety, seed-lot, raising references and internal identifiers do not become automatic public worksheet labels', () => {
  const saved = base.currentRequest.source;
  if (saved.kind !== 'saved-cycles' || !saved.cycleContext) throw Error('Fixture saved context missing');
  const context = saved.cycleContext;
  const rows = base.proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-reference-${index}`, acceptedAt: stamp, geometryFingerprint: base.request.geometryFingerprint });
    assert.ok(row);
    return { ...row, variety: `private-variety-${index}`, nurseryBatchReference: { kind: 'planned-nursery-reference', version: 1,
      plantingId: row.id, scope: context.scope, assessmentFingerprint: row.growerCycle.assessmentFingerprint,
      seedLotReference: `private-lot-${index}`, raisingBatchReference: `private-raising-${index}` } };
  });
  const currentRequest: GrowerNurseryRequest = { ...base.currentRequest, source: { ...saved, rows } }, result = buildGrowerNurseryForecast(currentRequest);
  const groups = [group(result.batches.map(batch => batch.id))], projection = reviewGrowerSeedSourcing({ result, currentRequest, groups });
  assert.equal(projection.groups[0].status, 'complete'); assert.equal(projection.groups[0].identification.labelStatus, 'not-recorded');
  const csv = buildGrowerSeedSourcingCsv(result, currentRequest, groups); table(csv);
  assert.doesNotMatch(csv, /private-|site:0\.00000|fingerprint|seedLotReference|raisingBatchReference|plantingId/);
  assert.equal(projection.groups[0].identification.enteredLabel, null);
});
