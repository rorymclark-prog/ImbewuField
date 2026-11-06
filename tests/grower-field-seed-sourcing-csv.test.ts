import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { reviewGrowerFieldSeedSourcing, type GrowerFieldSeedSourcingInput } from '../lib/international/grower-seed-sourcing.ts';
import { buildGrowerFieldSeedSourcingCsv } from '../lib/nursery-export.ts';

// A separately constructed accepted-cycle source keeps exporter verification
// independent of any manually assembled projected review or nursery DTO.
const stamp = '2026-11-06T12:00:00.000Z';
const crop = CROPS.find(row => knownVegetativePropagationUnit(row.key) === null)!;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
async function fixture() {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0, 1].map(index => ({ ...template, id: `private-csv-bed-${index}`, x: (index + 1) / 3, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-csv-source' }));
  if (source.status !== 'ready') throw Error('Synthetic source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-csv-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-entered' }, fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })), planningStart: own('2028-02-01', 'utc-date'),
    planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'private-csv-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Synthetic proposal unavailable');
  assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-csv-planting-${index}`, acceptedAt: stamp,
      geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
    return { ...row, variety: 'private-variety', notes: 'private-actor-label', nurseryBatchReference: {
      kind: 'planned-nursery-reference', version: 1, plantingId: row.id, scope,
      assessmentFingerprint: row.growerCycle!.assessmentFingerprint, seedLotReference: 'private-lot', raisingBatchReference: 'private-raising',
    } };
  });
  const cycleContext: GrowerCycleContext = { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  return { rows, cycleContext };
}
const base = await fixture();
const requirement = (plantingId: string, grossRequiredSeeds: unknown = 100) => ({ plantingId,
  materialDeclaration: 'botanical-seed', grossRequiredSeeds, grossRequirementConfirmed: true });
const group = (plantingIds = base.rows.map(row => row.id), patch: Record<string, unknown> = {}) => ({ id: 'private-csv-group',
  label: '  My supply plan  ', plantingIds, interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100, ...patch });
const input = (patch: Partial<GrowerFieldSeedSourcingInput> = {}): GrowerFieldSeedSourcingInput => ({ ...structuredClone(base),
  requirements: base.rows.map(row => requirement(row.id)), groups: [group()], ...patch });
function parse(csv: string) {
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.endsWith('\r\n'));
  const table: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const raw = csv.slice(1);
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\r' && raw[i + 1] === '\n' && !quoted) { row.push(cell); table.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  assert.equal(quoted, false); assert.deepEqual(row, []); assert.equal(cell, '');
  const header = table.shift()!; assert.equal(new Set(header).size, header.length);
  return { header, rows: table.map(values => { assert.equal(values.length, header.length);
    return Object.fromEntries(header.map((name, index) => [name, values[index]])); }) };
}
const quantities = (row: Record<string, string>) => ['known_required_seed_subtotal', 'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds'].map(key => row[key]);
function privateExcluded(csv: string) {
  assert.doesNotMatch(csv, /private-|site:|plantingId|planting_ids|group_id|bed_id|profileId|assessmentFingerprint|geometryFingerprint|seedLotReference|raisingBatchReference|variety/);
}

test('the field worksheet describes entered gross counts and canonical public identities without any nursery horizon or private joins', () => {
  const data = input(), before = JSON.stringify(data), projection = reviewGrowerFieldSeedSourcing(data);
  const csv = buildGrowerFieldSeedSourcingCsv(data), { header, rows } = parse(csv);
  assert.doesNotMatch(header.join(','), /horizon|nursery_review|batch|planting|group_id|site|actor|variety|lot/);
  assert.equal(rows.length, 2); assert.equal(rows[0].record_type, 'guidance'); assert.equal(rows[1].record_type, 'supply_group');
  assert.equal(rows[1].requirement_basis, 'entered-gross-whole-seed-count');
  assert.equal(rows[1].coverage, 'represented-accepted-non-nursery-cycles-only'); assert.equal(rows[1].whole_farm_coverage, 'not-assessed');
  assert.equal(rows[1].source_verification, 'not-verified'); assert.equal(rows[1].represented_cycle_count, '2');
  assert.equal(rows[1].selected_cycle_count, '2'); assert.equal(rows[1].assigned_cycle_count, '2');
  assert.deepEqual(quantities(rows[1]), ['200', '200', '180', '2', '200']);
  assert.equal(rows[1].entered_supply_group_label, '  My supply plan  '); assert.deepEqual(JSON.parse(rows[1].public_crop_names), [crop.name]);
  assert.equal(rows[1].identification_description, projection.groups[0].identification.description);
  assert.equal(rows[1].guidance, projection.guidance); assert.match(rows[1].plan_basis, /Entered gross whole-seed/);
  privateExcluded(csv); assert.equal(JSON.stringify(data), before); assert.equal(Object.isFrozen(data.rows), false);
});

test('formula-safe entered labels retain exact Unicode, whitespace, quotes and newlines through the existing serializer', () => {
  for (const label of ['  家庭 বাংলা e\u0301  ', '=SUM(1,2), "chosen"\r\nnext', '+SUM(1,2)', '-SUM(1,2)', '@name', '\tchosen']) {
    const csv = buildGrowerFieldSeedSourcingCsv(input({ groups: [group(undefined, { label })] }));
    const row = parse(csv).rows.find(row => row.record_type === 'supply_group')!;
    assert.equal(row.entered_supply_group_label, /^[=+\-@\t]/.test(label) ? "'" + label : label);
    assert.equal(row.label_status, 'provided'); assert.deepEqual(JSON.parse(row.public_crop_names), [crop.name]); privateExcluded(csv);
  }
});

test('blank, missing and invalid labels keep their presentation status without altering required seed counts', () => {
  for (const [label, expected] of [[' \t ', 'not-recorded'], [undefined, 'not-recorded'], [null, 'invalid']] as const) {
    const row = parse(buildGrowerFieldSeedSourcingCsv(input({ groups: [group(undefined, { label })] }))).rows[1];
    assert.equal(row.label_status, expected); assert.equal(row.entered_supply_group_label, typeof label === 'string' ? label : '');
    assert.deepEqual(quantities(row), ['200', '200', '180', '2', '200']);
  }
});

test('zero, missing gross counts, held declarations and overflow export distinctly without fallback quantities', () => {
  const ids = base.rows.map(row => row.id);
  const zero = parse(buildGrowerFieldSeedSourcingCsv(input({ requirements: ids.map(id => requirement(id, 0)) }))).rows[1];
  assert.deepEqual(quantities(zero), ['0', '0', '0', '0', '0']); assert.equal(zero.group_status, 'complete');
  const unknown = parse(buildGrowerFieldSeedSourcingCsv(input({ requirements: [requirement(ids[0], null), requirement(ids[1], 7)] }))).rows[1];
  assert.deepEqual(quantities(unknown), ['7', 'unknown', 'unknown', 'unknown', 'unknown']); assert.equal(unknown.group_status, 'unknown');
  const held = parse(buildGrowerFieldSeedSourcingCsv(input({ requirements: [{ ...requirement(ids[0]), materialDeclaration: null }], groups: [group([ids[0]])] }))).rows[1];
  assert.deepEqual(quantities(held), Array(5).fill('unknown')); assert.equal(held.group_status, 'held');
  const overflow = parse(buildGrowerFieldSeedSourcingCsv(input({ requirements: ids.map(id => requirement(id, Number.MAX_SAFE_INTEGER)) }))).rows[1];
  assert.deepEqual(quantities(overflow), Array(5).fill('unknown')); assert.equal(overflow.group_status, 'overflow');
});

test('held and legacy source rows produce explicit public source-review counts rather than disappearing from coverage', () => {
  const id = base.rows[0].id;
  const data = input({ rows: [base.rows[0], { ...base.rows[1], growerCycle: undefined },
    { id: 'private-old', bedId: base.rows[0].bedId, cropKey: crop.key, sowMonth: 2 }], requirements: [requirement(id)], groups: [group([id])] });
  const csv = buildGrowerFieldSeedSourcingCsv(data), rows = parse(csv).rows;
  assert.equal(rows.length, 3); const source = rows.find(row => row.record_type === 'source_review'); assert.ok(source);
  assert.equal(source.held_source_row_count, '1'); assert.equal(source.legacy_source_row_count, '1'); assert.equal(source.review_status, 'partial');
  assert.match(source.issues, /source-has-held-rows/); assert.equal(rows.find(row => row.record_type === 'supply_group')!.required_seeds, '100');
  privateExcluded(csv);
});

test('every sample row is visibly marked and field-only options still yield a truthful empty worksheet', () => {
  const rows = parse(buildGrowerFieldSeedSourcingCsv(input(), { sample: true })).rows;
  assert.ok(rows.every(row => row.plan_basis.startsWith('DEMO —')));
  const empty = parse(buildGrowerFieldSeedSourcingCsv(input({ requirements: [], groups: [] }))).rows;
  assert.equal(empty.length, 1); assert.equal(empty[0].represented_cycle_count, '2'); assert.equal(empty[0].assigned_cycle_count, '0');
  assert.equal(empty[0].unassigned_cycle_count, '2'); assert.equal(empty[0].review_status, 'partial');
  assert.equal(empty[0].required_seeds, ''); assert.match(empty[0].issues, /represented-cycles-unassigned/);
});

test('export replays raw accepted rows and rejects unreadable sources rather than trusting a former caller projection', () => {
  const data = input(), old = reviewGrowerFieldSeedSourcing(data); assert.equal(old.groups[0].requiredSeeds, 200);
  const id = base.rows[0].id;
  const changed = input({ rows: [], requirements: [requirement(id)], groups: [group([id])] });
  const row = parse(buildGrowerFieldSeedSourcingCsv(changed)).rows[1];
  assert.equal(row.group_status, 'held'); assert.equal(row.required_seeds, 'unknown'); assert.equal(row.selected_cycle_count, '0');
  assert.throws(() => buildGrowerFieldSeedSourcingCsv(input({ rows: null })), RangeError);
  let getters = 0;
  const unsafe = Object.defineProperty(input(), 'rows', { enumerable: true, get() { getters++; return base.rows; } });
  assert.throws(() => buildGrowerFieldSeedSourcingCsv(unsafe), RangeError); assert.equal(getters, 0);
});

test('formatting never rereads raw memberships or authored requirements after the canonical projection has finished', () => {
  let forbidden = false, lateReads = 0;
  const watch = <T extends object>(value: T): T => new Proxy(value, {
    get(target, key, receiver) { if (forbidden) { lateReads++; throw Error('Raw input read after projection'); } return Reflect.get(target, key, receiver); },
    ownKeys(target) { if (forbidden) { lateReads++; throw Error('Raw input enumerated after projection'); } return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { if (forbidden) { lateReads++; throw Error('Raw descriptor read after projection'); } return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const requirements = watch(base.rows.map(row => watch(requirement(row.id))));
  const groups = watch([watch(group(undefined, { plantingIds: watch(base.rows.map(row => row.id)) }))]);
  try {
    const csv = buildGrowerFieldSeedSourcingCsv(input({ requirements, groups }), { get sample() { forbidden = true; return false; } });
    assert.deepEqual(quantities(parse(csv).rows[1]), ['200', '200', '180', '2', '200']); privateExcluded(csv); assert.equal(lateReads, 0);
  } finally { forbidden = false; }
});
