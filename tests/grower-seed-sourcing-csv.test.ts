import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest } from '../lib/international/grower-nursery.ts';
import { reviewGrowerSeedSourcing, type GrowerSeedSourcingGroupInput } from '../lib/international/grower-seed-sourcing.ts';
import { buildGrowerSeedSourcingCsv } from '../lib/nursery-export.ts';
import { csvCell } from '../lib/journal-export.ts';

// Synthetic arithmetic controls reuse the real accepted-cycle/nursery pipeline.
// They are neither agronomic recommendations nor evidence of observed stock.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
const crop = CROPS[0];
const columns = [
  'record_type', 'plan_basis', 'source_verification', 'coverage', 'whole_farm_coverage',
  'review_status', 'nursery_review_status', 'horizon_start_utc', 'horizon_end_exclusive_utc',
  'represented_batch_count', 'assigned_batch_count', 'unassigned_batch_count',
  'supply_group_number', 'group_status', 'known_required_seed_subtotal', 'required_seeds',
  'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds', 'guidance',
] as const;
type Column = typeof columns[number];
type CsvRow = Record<Column, string>;
const quantities: readonly Column[] = ['known_required_seed_subtotal', 'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds'];

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
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const currentRequest: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows,
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint } }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(currentRequest);
  assert.equal(result.sourceStatus, 'saved-planned'); assert.equal(result.batches.length, bedCount);
  if (!mixedRecipe) assert.equal(result.status, 'ready', result.issues.join(','));
  return { currentRequest, result, settings, proposal, request };
}
const base = await fixture();
const fresh = () => structuredClone({ result: base.result, currentRequest: base.currentRequest });
function group(batchIds = base.result.batches.map(batch => batch.id), extra: Partial<GrowerSeedSourcingGroupInput> = {}): GrowerSeedSourcingGroupInput {
  return { id: 'private-confirmed-group', batchIds, interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100, ...extra };
}
function measured(data: Pick<typeof base, 'settings' | 'currentRequest'>, seedsPerTray?: number) {
  const settings = structuredClone(data.settings);
  settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 60 };
  if (seedsPerTray !== undefined) settings.profiles[0].seedsPerTray = seedsPerTray;
  const currentRequest: GrowerNurseryRequest = { ...structuredClone(data.currentRequest), settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint') };
  return { currentRequest, result: buildGrowerNurseryForecast(currentRequest) };
}

// Parse the emitted representation independently of csvCell. Requiring quotes,
// widths and record separators catches a comma inside guidance becoming a cell.
function read(csv: string): CsvRow[] {
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.endsWith('\r\n'));
  const records: string[][] = []; let fields: string[] = [], value = '', quoted = false, closed = false;
  for (let index = 1; index < csv.length; index++) {
    const char = csv[index];
    if (quoted) {
      if (char !== '"') value += char;
      else if (csv[index + 1] === '"') { value += '"'; index++; }
      else { quoted = false; closed = true; }
    } else if (!closed) { assert.equal(char, '"', 'every cell must use the existing quoted encoding'); quoted = true; }
    else if (char === ',') { fields.push(value); value = ''; closed = false; }
    else { assert.equal(char, '\r'); assert.equal(csv[++index], '\n'); fields.push(value); records.push(fields); fields = []; value = ''; closed = false; }
  }
  assert.equal(quoted, false); assert.deepEqual(fields, []); assert.equal(value, '');
  assert.deepEqual(records.shift(), [...columns]);
  for (const row of records) assert.equal(row.length, 20);
  return records.map(row => Object.fromEntries(columns.map((key, index) => [key, row[index]])) as CsvRow);
}
const numbers = (row: CsvRow) => quantities.map(key => row[key]);
function assertPrivate(csv: string, fingerprint?: string | null) {
  assert.doesNotMatch(csv, /private-|Private container|Private surface|site:0\.00000|fingerprint|seedLotReference|raisingBatchReference|batchIds/);
  if (fingerprint) assert.equal(csv.includes(fingerprint), false);
  assert.doesNotMatch(csv, /interchangeability-not-confirmed|batch-not-in-current-review|seed-requirement-unknown|legacy-nursery-demand-unassessed|group-input-invalid|pack-count-product-overflow|seed-requirement-overflow/);
}
function assertUnavailable(result: Parameters<typeof buildGrowerSeedSourcingCsv>[0], currentRequest: GrowerNurseryRequest, groups: unknown) {
  assert.throws(() => buildGrowerSeedSourcingCsv(result, currentRequest, groups), {
    name: 'RangeError', message: 'A current saved nursery review is required for seed sourcing export.',
  });
}

test('saved seed sourcing CSV keeps all twenty public columns, five distinct quantities and canonical guidance without mutating inputs', () => {
  const input = { ...fresh(), groups: [group()] }, before = JSON.stringify(input);
  const csv = buildGrowerSeedSourcingCsv(input.result, input.currentRequest, input.groups), rows = read(csv);
  assert.equal(csv.split('\r\n')[0], '\uFEFF' + columns.map(csvCell).join(','));
  assert.deepEqual(input.result.batches.map(batch => batch.seeds), [160, 160]);
  assert.equal(rows.length, 2); assert.equal(rows[0].record_type, 'guidance'); assert.equal(rows[1].record_type, 'supply_group');
  for (const key of ['supply_group_number', 'group_status', ...quantities] as const) assert.equal(rows[0][key], '');
  const canonical = reviewGrowerSeedSourcing(input);
  for (const row of rows) {
    assert.equal(row.plan_basis, 'Planned seed sourcing estimates'); assert.equal(row.source_verification, 'not-verified');
    assert.equal(row.coverage, 'represented-saved-transplant-batches-only'); assert.equal(row.whole_farm_coverage, 'not-assessed');
    assert.equal(row.review_status, 'available'); assert.equal(row.nursery_review_status, 'ready');
    assert.equal(row.horizon_start_utc, '2028-02-01'); assert.equal(row.horizon_end_exclusive_utc, '2028-03-15');
    assert.equal(row.represented_batch_count, '2'); assert.equal(row.assigned_batch_count, '2'); assert.equal(row.unassigned_batch_count, '0');
    assert.equal(row.guidance, canonical.guidance);
    assert.match(row.guidance, /not observed stock/); assert.match(row.guidance, /not verified varieties or seed-lot identity/);
    assert.match(row.guidance, /not direct sowings or unresolved, omitted or whole-farm seed demand/);
  }
  assert.equal(rows[1].supply_group_number, '1'); assert.equal(rows[1].group_status, 'complete');
  assert.deepEqual(numbers(rows[1]), ['320', '320', '300', '3', '300']);
  assert.equal(JSON.stringify(input), before); assert.equal(Object.isFrozen(input.groups), false);
  assertPrivate(csv, input.result.fingerprint);
});

test('empty and partial explicit memberships export honest unassigned counts, never silently grouped batches or whole-farm totals', () => {
  const data = fresh(), none = read(buildGrowerSeedSourcingCsv(data.result, data.currentRequest, []));
  assert.equal(none.length, 1); assert.equal(none[0].record_type, 'guidance'); assert.equal(none[0].review_status, 'partial');
  assert.equal(none[0].assigned_batch_count, '0'); assert.equal(none[0].unassigned_batch_count, '2');
  const csv = buildGrowerSeedSourcingCsv(data.result, data.currentRequest, [group([data.result.batches[0].id])]), rows = read(csv);
  for (const row of rows) { assert.equal(row.review_status, 'partial'); assert.equal(row.represented_batch_count, '2'); assert.equal(row.assigned_batch_count, '1'); assert.equal(row.unassigned_batch_count, '1'); }
  assert.deepEqual(numbers(rows[1]), ['160', '160', '140', '2', '200']); assertPrivate(csv);
});

test('unknown allocation and unknown pack size remain different from an explicit zero deficit', () => {
  for (const [extra, expected] of [
    [{ allocatedToPlanSeeds: null }, ['320', '320', 'unknown', 'unknown', 'unknown']],
    [{ seedsPerPack: null }, ['320', '320', '300', 'unknown', 'unknown']],
    [{ seedsPerPack: undefined }, ['320', '320', '300', 'unknown', 'unknown']],
    [{ allocatedToPlanSeeds: 0 }, ['320', '320', '320', '4', '400']],
    [{ allocatedToPlanSeeds: 999 }, ['320', '320', '0', '0', '0']],
  ] as const) {
    const data = fresh(), rows = read(buildGrowerSeedSourcingCsv(data.result, data.currentRequest, [group(undefined, extra)]));
    assert.deepEqual(numbers(rows[1]), [...expected]);
    assert.equal(rows[1].group_status, expected.some(value => value === 'unknown') ? 'unknown' : 'complete');
  }
});

test('a real measured zero exports five zeros while absent measurement stays five unknowns', () => {
  for (const [seedInput, expected, status] of [[0, '0', 'complete'], [undefined, 'unknown', 'unknown']] as const) {
    const data = measured(base, seedInput), csv = buildGrowerSeedSourcingCsv(data.result, data.currentRequest, [group()]), rows = read(csv);
    assert.deepEqual(data.result.batches.map(batch => batch.seeds), seedInput === 0 ? [0, 0] : [null, null]);
    assert.deepEqual(numbers(rows[1]), Array(5).fill(expected)); assert.equal(rows[1].group_status, status); assertPrivate(csv);
  }
});

test('known represented seeds are a subtotal rather than a fabricated complete requirement when another real batch is unresolved', async () => {
  const data = await fixture(2, true), groups = [group(data.result.batches.map(batch => batch.id))];
  assert.deepEqual(data.result.batches.map(batch => batch.seeds).sort((a, b) => Number(a) - Number(b)), [null, 160]);
  const canonical = reviewGrowerSeedSourcing({ ...data, groups });
  assert.equal(canonical.groups[0].knownRequiredSeedsSubtotal, 160); assert.equal(canonical.groups[0].requiredSeeds, null);
  const rows = read(buildGrowerSeedSourcingCsv(data.result, data.currentRequest, groups));
  assert.equal(rows[1].group_status, 'unknown'); assert.deepEqual(numbers(rows[1]), ['160', 'unknown', 'unknown', 'unknown', 'unknown']);
  assert.equal(rows[1].review_status, 'partial'); assert.equal(rows[1].assigned_batch_count, '2');
});

test('complete, unknown, held and overflowing groups all survive in caller order with no unsafe rounded pack product', async () => {
  const data = measured(await fixture(4), Number.MAX_SAFE_INTEGER), ids = data.result.batches.map(batch => batch.id), max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(data.result.batches.map(batch => batch.seeds), [max, max, max, max]);
  const groups = [
    group([ids[0]], { id: 'private-complete', allocatedToPlanSeeds: max, seedsPerPack: 1 }),
    group([ids[1]], { id: 'private-unknown', allocatedToPlanSeeds: null }),
    group([ids[2]], { id: 'private-held', interchangeabilityConfirmed: false }),
    group([ids[3]], { id: 'private-overflow', allocatedToPlanSeeds: 0, seedsPerPack: max - 1 }),
  ];
  const csv = buildGrowerSeedSourcingCsv(data.result, data.currentRequest, groups), rows = read(csv);
  const exactNeeded = BigInt(max), packSize = BigInt(max - 1);
  const exactPacks = exactNeeded / packSize + (exactNeeded % packSize === BigInt(0) ? BigInt(0) : BigInt(1));
  assert.equal(exactPacks, BigInt(2)); assert.ok(exactPacks * packSize > BigInt(max));
  assert.equal(rows.length, 5); assert.deepEqual(rows.slice(1).map(row => row.supply_group_number), ['1', '2', '3', '4']);
  assert.deepEqual(rows.slice(1).map(row => row.group_status), ['complete', 'unknown', 'held', 'overflow']);
  assert.deepEqual(rows.slice(1).map(numbers), [
    [String(max), String(max), '0', '0', '0'], [String(max), String(max), 'unknown', 'unknown', 'unknown'],
    Array(5).fill('unknown'), [String(max), String(max), String(max), '2', 'unknown'],
  ]);
  for (const row of rows) { assert.equal(row.review_status, 'partial'); assert.equal(row.represented_batch_count, '4'); assert.equal(row.assigned_batch_count, '3'); assert.equal(row.unassigned_batch_count, '1'); }
  assertPrivate(csv);
  const sum = read(buildGrowerSeedSourcingCsv(data.result, data.currentRequest, [group(ids.slice(0, 2), { allocatedToPlanSeeds: 0 })]));
  assert.equal(sum[1].group_status, 'overflow'); assert.deepEqual(numbers(sum[1]), Array(5).fill('unknown'));
});

test('unassessed saved legacy demand stays partial without leaking its private IDs or raw source issues', () => {
  const currentRequest = structuredClone(base.currentRequest);
  if (currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(currentRequest.source.rows)) throw Error('Fixture source kind');
  currentRequest.source.rows.push({ id: 'private-unassessed-legacy', bedId: 'private-legacy-bed', cropKey: crop.key, sowMonth: 2 });
  const result = buildGrowerNurseryForecast(currentRequest), csv = buildGrowerSeedSourcingCsv(result, currentRequest, [group()]), rows = read(csv);
  assert.equal(rows[1].review_status, 'partial'); assert.equal(rows[1].group_status, 'complete');
  assert.deepEqual(numbers(rows[1]), ['320', '320', '300', '3', '300']);
  assert.equal(reviewGrowerSeedSourcing({ result, currentRequest, groups: [group()] }).sourceIssues.includes('legacy-nursery-demand-unassessed'), true);
  assertPrivate(csv);
});

test('DEMO labels every row and malformed private labels remain held rather than becoming user-facing CSV cells', () => {
  const data = fresh(), groups = [{ ...group(), label: '=private-user-label, "secret"\r\nnext' }];
  const csv = buildGrowerSeedSourcingCsv(data.result, data.currentRequest, groups, { sample: true }), rows = read(csv);
  assert.equal(rows.length, 2); assert.equal(rows[1].group_status, 'held'); assert.deepEqual(numbers(rows[1]), Array(5).fill('unknown'));
  for (const row of rows) assert.equal(row.plan_basis, 'DEMO — planned seed sourcing estimates');
  assertPrivate(csv); assert.equal(csv.includes('secret'), false);
});

test('valid saved seed-lot, raising and variety references remain private even though the canonical review recognises them', () => {
  const saved = base.currentRequest.source;
  if (saved.kind !== 'saved-cycles' || !saved.cycleContext) throw Error('Fixture saved context missing');
  const context = saved.cycleContext;
  const rows = base.proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-labelled-member-${index}`, acceptedAt: stamp,
      geometryFingerprint: base.request.geometryFingerprint });
    assert.ok(row);
    return { ...row, variety: `private-variety-${index}`, nurseryBatchReference: { kind: 'planned-nursery-reference', version: 1,
      plantingId: row.id, scope: context.scope, assessmentFingerprint: row.growerCycle.assessmentFingerprint,
      seedLotReference: `private-lot-${index}`, raisingBatchReference: `private-raising-${index}` } };
  });
  const currentRequest: GrowerNurseryRequest = { ...base.currentRequest, source: { ...saved, rows } };
  const result = buildGrowerNurseryForecast(currentRequest), groups = [group(result.batches.map(batch => batch.id))];
  const canonical = reviewGrowerSeedSourcing({ result, currentRequest, groups });
  assert.equal(canonical.status, 'available'); assert.equal(canonical.groups[0].status, 'complete');
  const csv = buildGrowerSeedSourcingCsv(result, currentRequest, groups), exported = read(csv);
  assert.deepEqual(numbers(exported[1]), ['320', '320', '300', '3', '300']); assertPrivate(csv, result.fingerprint);
  const foreign = buildGrowerSeedSourcingCsv(result, currentRequest, [group(['private-foreign-batch'])]);
  assert.equal(read(foreign)[1].group_status, 'held'); assertPrivate(foreign);
});

test('proposal, stale horizon, altered requirement and fingerprint-only DTOs throw instead of exporting plausible saved counts', () => {
  const proposalRequest: GrowerNurseryRequest = { ...structuredClone(base.currentRequest), source: {
    kind: 'proposal', proposal: base.proposal, currentRequest: base.request, competingDemand: 'assessed-none',
  } };
  assertUnavailable(buildGrowerNurseryForecast(proposalRequest), proposalRequest, [group()]);
  const changed = fresh(); (changed.result.batches[0] as { seeds: number | null }).seeds = 1;
  assertUnavailable(changed.result, changed.currentRequest, [group()]);
  const stale = fresh(), staleRequest = { ...stale.currentRequest,
    horizon: own({ start: '2028-02-02', endExclusive: '2028-03-15' }, 'utc-date-window') };
  assertUnavailable(stale.result, staleRequest, [group()]);
  assertUnavailable({ fingerprint: base.result.fingerprint, sourceStatus: 'saved-planned' } as typeof base.result, base.currentRequest, [group()]);
  for (const groups of [[undefined], [() => null], [{ ...group(), batchIds: [undefined] }]]) assertUnavailable(base.result, base.currentRequest, groups);
});

test('invalid-present saved markers are not JSON-erased and unsafe result, request or group getters are never executed', () => {
  const marked = fresh();
  if (marked.currentRequest.source.kind !== 'saved-cycles' || !Array.isArray(marked.currentRequest.source.rows)) throw Error('Fixture source kind');
  Object.defineProperty(marked.currentRequest.source.rows[0], 'nurseryBatchReference', { value: undefined, enumerable: true, configurable: true });
  assertUnavailable(marked.result, marked.currentRequest, [group()]);
  assert.equal(Object.hasOwn(marked.currentRequest.source.rows[0], 'nurseryBatchReference'), true);
  for (const location of ['result', 'currentRequest', 'groups', 'batchIds', 'allocation'] as const) {
    let calls = 0; const data = fresh(), groups = [group()];
    const unsafe = { enumerable: true, configurable: true, get() { calls++; throw Error('private getter must not execute'); } };
    if (location === 'result' || location === 'currentRequest') Object.defineProperty(data[location], 'unsafe', unsafe);
    else if (location === 'groups') Object.defineProperty(groups, '0', unsafe);
    else Object.defineProperty(groups[0], location === 'allocation' ? 'allocatedToPlanSeeds' : 'batchIds', unsafe);
    assertUnavailable(data.result, data.currentRequest, groups); assert.equal(calls, 0); assert.equal(Object.isFrozen(groups), false);
  }
});

test('exporter uses the actual canonical projection once and existing csvCell for every cell without rereading raw groups afterwards', async () => {
  // These wrappers invoke both real authorities unchanged. Only observations
  // are added; no fake review, arithmetic, replay or seed requirement is supplied.
  const exporterUrl = new URL('../lib/nursery-export.ts', import.meta.url).href + '?seed-sourcing-canonical-only';
  const reviewUrl = new URL('../lib/international/grower-seed-sourcing.ts', import.meta.url).href;
  const cellsUrl = new URL('../lib/journal-export.ts', import.meta.url).href;
  const trace = { calls: 0, cells: 0, forbidRaw: false, rawReads: 0 };
  const key = '__seedSourcingCsvActualAuthority';
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value: trace });
  const dataModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === exporterUrl && specifier === './international/grower-seed-sourcing') return dataModule(`
      import {reviewGrowerSeedSourcing as actual} from ${JSON.stringify(reviewUrl)};
      export function reviewGrowerSeedSourcing(input){const t=globalThis.${key};t.calls++;const result=actual(input);t.forbidRaw=true;return result;}`);
    if (context.parentURL === exporterUrl && specifier === './journal-export') return dataModule(`
      import {csvCell as actual} from ${JSON.stringify(cellsUrl)};
      export function csvCell(value){globalThis.${key}.cells++;return actual(value);}`);
    return next(specifier, context);
  } });
  try {
    const exporter = await import(exporterUrl) as typeof import('../lib/nursery-export.ts');
    const rawRead = () => { if (trace.forbidRaw) { trace.rawReads++; throw Error('Exporter reread private raw groups after canonical review'); } };
    const watch = <T extends object>(value: T): T => new Proxy(value, {
      get(target, property, receiver) { rawRead(); return Reflect.get(target, property, receiver); },
      ownKeys(target) { rawRead(); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, property) { rawRead(); return Reflect.getOwnPropertyDescriptor(target, property); },
    });
    const raw = group(), row = watch({ ...raw, batchIds: watch([...raw.batchIds]) });
    const groups = watch([row]);
    const csv = exporter.buildGrowerSeedSourcingCsv(base.result, base.currentRequest, groups), rows = read(csv);
    assert.equal(trace.calls, 1); assert.equal(trace.rawReads, 0); assert.equal(trace.cells, 20 * 3);
    assert.equal(rows.length, 2); assert.deepEqual(numbers(rows[1]), ['320', '320', '300', '3', '300']); assertPrivate(csv);
  } finally {
    trace.forbidRaw = false; hooks.deregister();
    if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key);
  }
});
