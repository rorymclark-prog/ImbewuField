import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest } from '../lib/international/grower-nursery.ts';
import { reviewGrowerFieldSeedSourcing, reviewGrowerSeedSourcing, type GrowerFieldSeedSourcingInput } from '../lib/international/grower-seed-sourcing.ts';
import { buildGrowerFieldSeedSourcingCsv, buildGrowerSeedSourcingCsv } from '../lib/nursery-export.ts';
import { csvCell } from '../lib/journal-export.ts';

// Explicitly synthetic arithmetic controls through the real accepted-cycle path:
// autoplan -> accepted planting -> canonical projection -> review -> CSV. Counts,
// dates and windows are fixtures, not seed rates, allowances or farming advice.
const stamp = '2026-11-06T12:00:00.000Z';
const botanical = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) === null)!;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
async function fixture(cropKey = botanical.key, establishment: 'direct' | 'transplant' = 'direct',
  harvestStarts = ['2028-02-10', '2028-02-20'], bedCount = 2) {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = Array.from({ length: bedCount }, (_, index) => ({ ...bed, id: `private-breakdown-bed-${index}`,
    x: (index + 1) / (bedCount + 1), y: 0.5, wM: 3, hM: 4 })); canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    sourceRevision: 'private-breakdown-source', raw: canvas }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-breakdown-profile', cropKey, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(establishment, 'method'),
    nurseryDays: establishment === 'transplant' ? own(10, 'days') : { state: 'missing', reason: 'not-entered' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const plusTwo = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: [], demands: harvestStarts.map((start, index) => ({ demandId: `private-breakdown-demand-${index}`, profileId: profile.profileId, scope,
      totalKg: own(1, 'kg-total'), harvestWindow: own({ start, endExclusive: plusTwo(start) }, 'utc-date-window') })), maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Synthetic proposal unavailable');
  assert.equal(proposal.cycles.length, harvestStarts.length);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-breakdown-planting-${index}`, acceptedAt: stamp,
      geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
    return { ...row, variety: 'private-variety', notes: 'private-actor-label' };
  });
  const overlappingRow = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-breakdown-overlap', acceptedAt: stamp,
    geometryFingerprint: source.geometryFingerprint }); assert.ok(overlappingRow);
  const cycleContext: GrowerCycleContext = { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  return { rows, cycleContext, overlappingRow };
}
const base = await fixture(), ids = base.rows.map(row => row.id);
/** Expected public facts come from the real projector, keyed by the internal handle. */
const plannedEntry = (rows: unknown, cycleContext: GrowerCycleContext) => new Map(projectGrowerCycles(rows, cycleContext).ownCycles
  .map(cycle => [cycle.plantingId, cycle.plannedEvents.find(event => event.kind === 'field-entry')!.date]));
const dates = plannedEntry(base.rows, base.cycleContext), early = dates.get(ids[0])!, late = dates.get(ids[1])!;
const entered: Record<string, number> = { [ids[0]]: 130, [ids[1]]: 70 };
const requirement = (plantingId: string, grossRequiredSeeds: unknown = entered[plantingId], extra: Record<string, unknown> = {}) => ({
  plantingId, materialDeclaration: 'botanical-seed', grossRequiredSeeds, grossRequirementConfirmed: true, ...extra });
const group = (plantingIds: unknown[] = [...ids], extra: Record<string, unknown> = {}) => ({ id: 'private-breakdown-group',
  label: '  Synthetic supply A  ', plantingIds, interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100, ...extra });
const input = (patch: Partial<GrowerFieldSeedSourcingInput> = {}): GrowerFieldSeedSourcingInput => ({
  ...structuredClone({ rows: base.rows, cycleContext: base.cycleContext }), requirements: ids.map(id => requirement(id)), groups: [group()], ...patch });

const priorColumns = ['record_type', 'plan_basis', 'source_verification', 'requirement_basis', 'coverage', 'whole_farm_coverage', 'review_status',
  'represented_cycle_count', 'assigned_cycle_count', 'unassigned_cycle_count', 'held_source_row_count', 'legacy_source_row_count',
  'excluded_nursery_cycle_count', 'supply_group_number', 'selected_cycle_count', 'group_status', 'known_required_seed_subtotal',
  'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds', 'entered_supply_group_label',
  'label_status', 'public_crop_names', 'identification_description', 'issues', 'guidance'];
const appendedColumns = ['cycle_number', 'planned_field_entry_date_utc', 'entered_gross_whole_seeds', 'cycle_requirement_status',
  'counted_in_group_subtotal', 'related_cycle_numbers', 'cycle_relation_status'];
type Row = Record<string, string>;
function parse(csv: string) {
  assert.ok(csv.startsWith('﻿')); assert.ok(csv.endsWith('\r\n'));
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
  const header = table.shift()!; assert.deepEqual(header, [...priorColumns, ...appendedColumns]);
  return table.map(values => { assert.equal(values.length, header.length); return Object.fromEntries(header.map((name, index) => [name, values[index]])) as Row; });
}
const exportRows = (data: GrowerFieldSeedSourcingInput, sample = false) => parse(buildGrowerFieldSeedSourcingCsv(data, { sample }));
const cyclesOf = (rows: Row[]) => rows.filter(row => row.record_type === 'represented_cycle');
const groupsOf = (rows: Row[]) => rows.filter(row => row.record_type === 'supply_group');
const quantities = (row: Row) => ['known_required_seed_subtotal', 'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds'].map(key => row[key]);
function privateExcluded(csv: string) {
  assert.doesNotMatch(csv, /private-|site:|plantingId|planting_ids|group_id|bed_id|profileId|assessmentFingerprint|geometryFingerprint|seedLotReference|raisingBatchReference|variety/);
}
type Expected = { date: string; entered: string; status: string; counted: 'yes' | 'no'; group: string; relation: string };
/** The traceability checker: numbered rows, each carrying its own planned date and entry. */
function assertBreakdown(rows: Row[], expected: readonly Expected[]) {
  const cycles = cyclesOf(rows);
  assert.deepEqual(cycles.map(row => row.cycle_number), expected.map((_, index) => String(index + 1)));
  cycles.forEach((row, index) => {
    assert.deepEqual({ date: row.planned_field_entry_date_utc, entered: row.entered_gross_whole_seeds, status: row.cycle_requirement_status,
      counted: row.counted_in_group_subtotal, group: row.supply_group_number, relation: row.cycle_relation_status }, expected[index]);
    // Group quantity columns never repeat on a cycle row, so no seed is listed twice.
    assert.deepEqual(quantities(row), ['', '', '', '', '']); assert.equal(row.entered_supply_group_label, '');
  });
}
/** Groups list exactly their related numbers, and their known subtotal is the sum of counted entries. */
function assertGroupTrace(rows: Row[]) {
  const cycles = cyclesOf(rows), groups = groupsOf(rows);
  for (const row of groups) {
    const members = cycles.filter(cycle => cycle.supply_group_number === row.supply_group_number);
    if (row.cycle_relation_status === 'membership-held') { assert.equal(row.related_cycle_numbers, ''); assert.equal(members.length, 0); continue; }
    assert.equal(row.related_cycle_numbers, members.map(cycle => cycle.cycle_number).join(' | '));
    const counted = members.filter(cycle => cycle.counted_in_group_subtotal === 'yes');
    if (row.group_status === 'held' || row.known_required_seed_subtotal === 'unknown') assert.equal(counted.length, 0);
    else assert.equal(String(counted.reduce((sum, cycle) => sum + Number(cycle.entered_gross_whole_seeds), 0)), row.known_required_seed_subtotal);
  }
  for (const cycle of cycles.filter(row => row.counted_in_group_subtotal === 'yes')) {
    assert.equal(cycle.cycle_requirement_status, 'entered-count'); assert.match(cycle.entered_gross_whole_seeds, /^(0|[1-9]\d*)$/);
    assert.equal(groups.filter(row => row.supply_group_number === cycle.supply_group_number && row.group_status !== 'held').length, 1);
  }
}
function frozen(value: unknown) {
  if (value && typeof value === 'object') { assert.equal(Object.isFrozen(value), true); for (const child of Object.values(value)) frozen(child); }
}
const related = (date: string, value: string, extra: Partial<Expected> = {}): Expected => ({ date, entered: value, status: 'entered-count',
  counted: 'yes', group: '1', relation: 'related', ...extra });
const mainExpected = [related(early, '130'), related(late, '70')];

test('two represented cycles in one group keep their own planned dates and entered gross counts, traceable to the group total', () => {
  assert.notEqual(early, late, 'synthetic fixture must give the two cycles different planned field-entry dates');
  const data = input(), review = reviewGrowerFieldSeedSourcing(data), csv = buildGrowerFieldSeedSourcingCsv(data), rows = parse(csv);
  assert.deepEqual(review.cycleBreakdown.map(row => [row.cycleNumber, row.plannedFieldEntryDate, row.enteredGrossRequiredSeeds]), [[1, early, 130], [2, late, 70]]);
  assert.deepEqual(review.cycleBreakdown.map(row => row.plannedFieldEntryDate), review.cycles.map(row => row.plannedFieldEntryDate));
  assert.deepEqual(review.groups[0].cycleNumbers, [1, 2]); assert.equal(review.groups[0].cycleRelation, 'related');
  assert.ok(review.cycleBreakdown.every(row => !('plantingId' in row) && row.cropName === botanical.name && row.issues.length === 0));
  assert.deepEqual(rows.map(row => row.record_type), ['guidance', 'supply_group', 'represented_cycle', 'represented_cycle']);
  const [groupRow] = groupsOf(rows);
  assert.deepEqual(quantities(groupRow), ['200', '200', '180', '2', '200']); assert.equal(groupRow.related_cycle_numbers, '1 | 2');
  assert.equal(groupRow.cycle_relation_status, 'related'); assert.equal(groupRow.selected_cycle_count, '2');
  assertBreakdown(rows, mainExpected); assertGroupTrace(rows);
  for (const cycle of cyclesOf(rows)) {
    assert.deepEqual(JSON.parse(cycle.public_crop_names), [botanical.name]); assert.equal(cycle.issues, '');
    assert.equal(cycle.represented_cycle_count, '2'); assert.match(cycle.guidance, /Cycle numbers are positions in this review only/);
  }
  assert.ok(rows.every(row => ['guidance', 'supply_group'].includes(row.record_type) ? row.cycle_number === '' && row.planned_field_entry_date_utc === '' : true));
  privateExcluded(csv);
});

test('damaged negative control: the checker fails for a missing breakdown and for swapped counts, dates or relations', () => {
  const rows = exportRows(input());
  assertBreakdown(rows, mainExpected); assertGroupTrace(rows);
  const copy = () => rows.map(row => ({ ...row }));
  const damaged = {
    // The frozen-base worksheet shape: guidance and group rows only.
    missingBreakdown: copy().filter(row => row.record_type !== 'represented_cycle'),
    swappedCounts: (() => { const table = copy(), [a, b] = cyclesOf(table);
      [a.entered_gross_whole_seeds, b.entered_gross_whole_seeds] = [b.entered_gross_whole_seeds, a.entered_gross_whole_seeds]; return table; })(),
    swappedDates: (() => { const table = copy(), [a, b] = cyclesOf(table);
      [a.planned_field_entry_date_utc, b.planned_field_entry_date_utc] = [b.planned_field_entry_date_utc, a.planned_field_entry_date_utc]; return table; })(),
  };
  for (const [name, table] of Object.entries(damaged)) assert.throws(() => assertBreakdown(table, mainExpected), assert.AssertionError, name);
  const relation = copy(); groupsOf(relation)[0].related_cycle_numbers = '1';
  const uncounted = copy(); cyclesOf(uncounted)[1].counted_in_group_subtotal = 'no';
  const inflated = copy(); cyclesOf(inflated)[0].entered_gross_whole_seeds = '131';
  for (const table of [relation, uncounted, inflated]) assert.throws(() => assertGroupTrace(table), assert.AssertionError);
});

test('confirmed zero, explicit unknown, unrecorded, unconfirmed, undeclared and invalid entries stay distinct and never become zero or counted', () => {
  const zeroUnknown = exportRows(input({ requirements: [requirement(ids[0], 0), requirement(ids[1], null)] }));
  assert.deepEqual(quantities(groupsOf(zeroUnknown)[0]), ['0', 'unknown', 'unknown', 'unknown', 'unknown']);
  assertBreakdown(zeroUnknown, [related(early, '0'), related(late, 'unknown', { status: 'unknown', counted: 'no' })]); assertGroupTrace(zeroUnknown);
  const zero = exportRows(input({ requirements: ids.map(id => requirement(id, 0)) }));
  assert.equal(groupsOf(zero)[0].group_status, 'complete'); assertBreakdown(zero, [related(early, '0'), related(late, '0')]); assertGroupTrace(zero);
  const unselected: Expected = { date: late, entered: 'not-recorded', status: 'not-recorded', counted: 'no', group: '', relation: 'not-selected' };
  const cases: [unknown[], Expected][] = [
    [[requirement(ids[0], 55, { materialDeclaration: null })], related(early, '55', { status: 'material-not-confirmed', counted: 'no' })],
    [[requirement(ids[0], 55, { materialDeclaration: 'seed' })], related(early, '55', { status: 'material-not-confirmed', counted: 'no' })],
    [[requirement(ids[0], 55, { materialDeclaration: 'vegetative' })], related(early, '55', { status: 'vegetative-declared', counted: 'no' })],
    [[requirement(ids[0], 55, { grossRequirementConfirmed: false })], related(early, '55', { status: 'count-not-confirmed', counted: 'no' })],
    [[requirement(ids[0], 55, { grossRequirementConfirmed: 'true' })], related(early, '55', { status: 'count-not-confirmed', counted: 'no' })],
    [[requirement(ids[0], null, { grossRequirementConfirmed: false })], related(early, 'unknown', { status: 'count-not-confirmed', counted: 'no' })],
    [[requirement(ids[0], -1)], related(early, 'invalid', { status: 'count-invalid', counted: 'no' })],
    [[requirement(ids[0], 0.5)], related(early, 'invalid', { status: 'count-invalid', counted: 'no' })],
    [[requirement(ids[0], '100')], related(early, 'invalid', { status: 'count-invalid', counted: 'no' })],
    [[{ plantingId: ids[0], grossRequiredSeeds: 55 }], related(early, 'invalid', { status: 'requirement-invalid', counted: 'no' })],
    [[requirement(ids[0], 55, { note: 'private-extra' })], related(early, 'invalid', { status: 'requirement-invalid', counted: 'no' })],
    [[], related(early, 'not-recorded', { status: 'not-recorded', counted: 'no' })],
  ];
  for (const [requirements, expected] of cases) {
    const csv = buildGrowerFieldSeedSourcingCsv(input({ requirements, groups: [group([ids[0]])] })), rows = parse(csv);
    assert.equal(groupsOf(rows)[0].group_status, 'held'); assert.equal(groupsOf(rows)[0].required_seeds, 'unknown');
    assertBreakdown(rows, [expected, unselected]); assertGroupTrace(rows); privateExcluded(csv);
    assert.ok(cyclesOf(rows).every(row => row.entered_gross_whole_seeds !== '0' && row.entered_gross_whole_seeds !== ''));
    assert.equal(rows[0].assigned_cycle_count, '0');
  }
  const review = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(ids[0], 55, { materialDeclaration: null, grossRequirementConfirmed: false })], groups: [group([ids[0]])] }));
  assert.equal(review.cycleBreakdown[0].requirementStatus, 'material-not-confirmed');
  assert.ok(review.cycleBreakdown[0].issues.includes('botanical-material-not-confirmed') && review.cycleBreakdown[0].issues.includes('gross-requirement-not-confirmed'));
  assert.equal(review.cycleBreakdown[0].countedInGroupSubtotal, false); assert.equal(review.cycleBreakdown[1].issues[0], 'field-requirement-not-recorded');
});

test('ambiguous or malformed memberships in either order, repeats, duplicate group ids and duplicate entries relate no arbitrary winner', () => {
  const heldCycle = (date: string, value: string): Expected => ({ date, entered: value, status: 'entered-count', counted: 'no', group: '', relation: 'membership-held' });
  const notSelected = (date: string, value: string): Expected => ({ date, entered: value, status: 'entered-count', counted: 'no', group: '', relation: 'not-selected' });
  const good = group([ids[0]]), malformed = group([ids[0]], { id: null, plantingIds: [ids[0], null] });
  const scenarios: [unknown[], Expected[]][] = [
    [[good, malformed], [heldCycle(early, '130'), notSelected(late, '70')]],
    [[malformed, good], [heldCycle(early, '130'), notSelected(late, '70')]],
    [[group([ids[0], ids[0]])], [heldCycle(early, '130'), notSelected(late, '70')]],
    [[group([ids[0]]), group([ids[1]])], [heldCycle(early, '130'), heldCycle(late, '70')]],
    [[group([...ids]), group([ids[1]], { id: 'private-breakdown-other' })], [heldCycle(early, '130'), heldCycle(late, '70')]],
  ];
  for (const [groups, expected] of scenarios) {
    const rows = exportRows(input({ groups })), review = reviewGrowerFieldSeedSourcing(input({ groups }));
    assert.ok(groupsOf(rows).every(row => row.group_status === 'held' && row.cycle_relation_status === 'membership-held' && row.related_cycle_numbers === ''));
    assert.ok(review.groups.every(row => row.cycleNumbers === null)); assert.equal(rows[0].assigned_cycle_count, '0');
    assertBreakdown(rows, expected); assertGroupTrace(rows);
  }
  const duplicate = buildGrowerFieldSeedSourcingCsv(input({ requirements: [requirement(ids[0], 100), requirement(ids[0], 999), requirement(ids[1])] }));
  const rows = parse(duplicate);
  assertBreakdown(rows, [related(early, 'ambiguous', { status: 'duplicate-requirement', counted: 'no' }), related(late, '70', { counted: 'no' })]);
  assertGroupTrace(rows); assert.equal(groupsOf(rows)[0].group_status, 'held'); assert.equal(groupsOf(rows)[0].known_required_seed_subtotal, 'unknown');
  assert.ok(cyclesOf(rows)[0].issues.includes('field-requirement-duplicate')); assert.doesNotMatch(duplicate, /999|"100"/);
});

test('held, unavailable, foreign, legacy, nursery and known vegetative cycles keep their holds and never gain a counted number', async () => {
  const nursery = await fixture(botanical.key, 'transplant', ['2028-02-20'], 1);
  const legacy = { id: 'private-breakdown-legacy', bedId: base.rows[0].bedId, cropKey: botanical.key, sowMonth: 2 };
  const held = { ...structuredClone(base.rows[1]), growerCycle: undefined };
  const rows = [base.rows[0], legacy, held, ...nursery.rows.map(row => ({ ...row, id: 'private-breakdown-nursery-mismatch' }))];
  for (const foreign of ['private-breakdown-foreign', legacy.id, held.id, 'private-breakdown-nursery-mismatch']) {
    const csv = buildGrowerFieldSeedSourcingCsv(input({ rows, requirements: [requirement(ids[0]), requirement(foreign, 70)], groups: [group([ids[0], foreign])] }));
    const table = parse(csv), [groupRow] = groupsOf(table);
    assert.equal(groupRow.group_status, 'held'); assert.equal(groupRow.cycle_relation_status, 'related-with-unrepresented-selections');
    assert.equal(groupRow.related_cycle_numbers, '1'); assert.equal(groupRow.selected_cycle_count, '1');
    assertBreakdown(table, [related(early, '130', { counted: 'no' })]); assertGroupTrace(table);
    assert.equal(table[0].represented_cycle_count, '1'); assert.equal(table[0].legacy_source_row_count, '1'); privateExcluded(csv);
    assert.notEqual(table.find(row => row.record_type === 'source_review')!.issues, '');
  }
  const onlyNursery = parse(buildGrowerFieldSeedSourcingCsv({ ...nursery, requirements: [requirement(nursery.rows[0].id, 70)], groups: [group([nursery.rows[0].id])] }));
  assert.equal(cyclesOf(onlyNursery).length, 0); assert.equal(onlyNursery[0].excluded_nursery_cycle_count, '1');
  assert.equal(groupsOf(onlyNursery)[0].related_cycle_numbers, ''); assert.equal(groupsOf(onlyNursery)[0].cycle_relation_status, 'related-with-unrepresented-selections');
  const known = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) !== null); assert.ok(known);
  const vegetative = await fixture(known.key, 'direct', ['2028-02-20'], 1), id = vegetative.rows[0].id;
  const date = plannedEntry(vegetative.rows, vegetative.cycleContext).get(id)!;
  const table = parse(buildGrowerFieldSeedSourcingCsv({ ...vegetative, requirements: [requirement(id, 100)], groups: [group([id])] }));
  assertBreakdown(table, [related(date, '100', { status: 'known-vegetative-material', counted: 'no' })]); assertGroupTrace(table);
  assert.match(cyclesOf(table)[0].issues, /known-vegetative-material-not-seeds/); assert.deepEqual(JSON.parse(cyclesOf(table)[0].public_crop_names), [known.name]);
  assert.equal(groupsOf(table)[0].group_status, 'held');
});

test('source changes re-derive public numbers from the current replay and never carry a stale date or count association', () => {
  const reversed = exportRows(input({ rows: structuredClone(base.rows).reverse() }));
  assertBreakdown(reversed, [related(late, '70'), related(early, '130')]); assertGroupTrace(reversed);
  assert.equal(groupsOf(reversed)[0].known_required_seed_subtotal, '200');
  for (const cycleContext of [{ ...base.cycleContext, geometryFingerprint: 'private-breakdown-other-fingerprint' }, { ...base.cycleContext, beds: [] }]) {
    const rows = exportRows(input({ cycleContext }));
    assert.equal(cyclesOf(rows).length, 0); assert.equal(rows[0].held_source_row_count, '2'); assertGroupTrace(rows);
    assert.equal(groupsOf(rows)[0].related_cycle_numbers, ''); assert.equal(groupsOf(rows)[0].group_status, 'held');
  }
  const overlapping = exportRows(input({ rows: [base.rows[0], base.overlappingRow], requirements: [requirement(ids[0]), requirement(base.overlappingRow.id, 70)],
    groups: [group([ids[0], base.overlappingRow.id])] }));
  assert.equal(cyclesOf(overlapping).length, 0); assert.match(overlapping.find(row => row.record_type === 'source_review')!.issues, /overlapping-own-reservation/);
  const before = reviewGrowerFieldSeedSourcing(input()), snapshot = JSON.stringify(before);
  const changed = exportRows(input({ requirements: [requirement(ids[0], 131), requirement(ids[1])] }));
  assertBreakdown(changed, [related(early, '131'), related(late, '70')]); assertGroupTrace(changed);
  assert.equal(JSON.stringify(before), snapshot); assert.equal(before.cycleBreakdown[0].enteredGrossRequiredSeeds, 130);
});

test('the breakdown is detached and frozen while caller inputs stay mutable and unread by later presentation', () => {
  const data = input(), before = JSON.stringify(data), review = reviewGrowerFieldSeedSourcing(data), original = JSON.stringify(review);
  assert.equal(JSON.stringify(data), before); frozen(review); frozen(review.cycleBreakdown);
  assert.doesNotMatch(JSON.stringify(review.cycleBreakdown), /private-|site:/);
  assert.ok(Array.isArray(data.requirements) && Array.isArray(data.groups) && Array.isArray(data.rows));
  (data.requirements[0] as { grossRequiredSeeds: unknown }).grossRequiredSeeds = 999;
  (data.groups[0] as { plantingIds: unknown[] }).plantingIds.reverse(); data.rows.reverse();
  assert.equal(JSON.stringify(review), original); assert.equal(Object.isFrozen(data.rows), false); assert.equal(Object.isFrozen(data.requirements), false);
  assert.deepEqual(review.cycleBreakdown.map(row => row.enteredGrossRequiredSeeds), [130, 70]);
  const unsafe = Object.defineProperty(input(), 'requirements', { enumerable: true, get() { throw Error('private getter'); } });
  assert.deepEqual(reviewGrowerFieldSeedSourcing(unsafe).cycleBreakdown, []); assert.throws(() => buildGrowerFieldSeedSourcingCsv(unsafe), RangeError);
});

test('post-projection trap: the exporter calls the real review once, then formats only its result through the existing csvCell', async () => {
  // Wrappers only observe the real authorities; they supply no projection, count or row.
  const exporterUrl = new URL('../lib/nursery-export.ts', import.meta.url).href + '?field-cycle-breakdown-canonical-only';
  const reviewUrl = new URL('../lib/international/grower-seed-sourcing.ts', import.meta.url).href;
  const cellsUrl = new URL('../lib/journal-export.ts', import.meta.url).href;
  const trace = { calls: 0, cells: 0, forbidRaw: false, rawReads: 0 }, key = '__fieldCycleBreakdownActualAuthority';
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value: trace });
  const dataModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === exporterUrl && specifier === './international/grower-seed-sourcing') return dataModule(`
      import {reviewGrowerFieldSeedSourcing as actual} from ${JSON.stringify(reviewUrl)};
      export {reviewGrowerSeedSourcing} from ${JSON.stringify(reviewUrl)};
      export function reviewGrowerFieldSeedSourcing(input){const t=globalThis.${key};t.calls++;const result=actual(input);t.forbidRaw=true;return result;}`);
    if (context.parentURL === exporterUrl && specifier === './journal-export') return dataModule(`
      import {csvCell as actual} from ${JSON.stringify(cellsUrl)};
      export function csvCell(value){globalThis.${key}.cells++;return actual(value);}`);
    return next(specifier, context);
  } });
  try {
    const exporter = await import(exporterUrl) as typeof import('../lib/nursery-export.ts');
    const rawRead = () => { if (trace.forbidRaw) { trace.rawReads++; throw Error('Exporter reread raw rows, entries or groups after review'); } };
    const watch = <T extends object>(value: T): T => new Proxy(value, {
      get(target, property, receiver) { rawRead(); return Reflect.get(target, property, receiver); },
      ownKeys(target) { rawRead(); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, property) { rawRead(); return Reflect.getOwnPropertyDescriptor(target, property); },
    });
    const plain = input();
    const trapped: GrowerFieldSeedSourcingInput = watch({ rows: watch(structuredClone(base.rows).map(row => watch(row))),
      cycleContext: watch(structuredClone(base.cycleContext)), requirements: watch(ids.map(id => watch(requirement(id)))),
      groups: watch([watch({ ...group(), plantingIds: watch([...ids]) })]) });
    const csv = exporter.buildGrowerFieldSeedSourcingCsv(trapped, { sample: true }), rows = parse(csv);
    assert.equal(trace.calls, 1); assert.equal(trace.rawReads, 0);
    assert.equal(trace.cells, (priorColumns.length + appendedColumns.length) * (rows.length + 1));
    assertBreakdown(rows, mainExpected); assertGroupTrace(rows); privateExcluded(csv);
    trace.forbidRaw = false;
    assert.equal(csv, buildGrowerFieldSeedSourcingCsv(plain, { sample: true }), 'observation must not change a byte');
  } finally {
    trace.forbidRaw = false; hooks.deregister();
    if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key);
  }
});

test('exact Unicode and formula-safe labels, DEMO on every record and no private identities across the per-cycle worksheet', () => {
  for (const label of ['  家庭 বাংলা é  ', '=SUM(1,2), "chosen"\r\nnext', '+1', '-1', '@name', '\tchosen']) {
    for (const sample of [false, true]) {
      const csv = buildGrowerFieldSeedSourcingCsv(input({ groups: [group(undefined, { label })] }), { sample }), rows = parse(csv);
      assert.equal(groupsOf(rows)[0].entered_supply_group_label, /^[=+\-@\t]/.test(label) ? "'" + label : label);
      assert.ok(cyclesOf(rows).every(row => row.entered_supply_group_label === '' && row.label_status === ''));
      assertBreakdown(rows, mainExpected); assertGroupTrace(rows); privateExcluded(csv);
      assert.equal(rows.length, 4);
      assert.ok(rows.every(row => sample ? row.plan_basis.startsWith('DEMO —') : !row.plan_basis.includes('DEMO')), 'DEMO marks every record including cycle rows');
      assert.ok(csv.includes('"1 | 2"') && csv.includes(`"${early}"`) && csv.includes('"130"'));
    }
  }
});

test('the separate 24-column nursery seed worksheet keeps its exact header and canonical byte encoding', async () => {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState(), crop = CROPS[0];
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0, 1].map(index => ({ ...template, id: `private-nursery-bed-${index}`, x: (index + 1) / 3, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw: canvas, sourceRevision: 'private-nursery-source' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-nursery-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months') } };
  const proposal = generateGrowerAutoPlan({ requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })), planningStart: own('2028-02-01', 'utc-date'),
    planningEndExclusive: own('2028-03-15', 'utc-date'), reserved: [], maxAssessments: 1000,
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    demands: [{ demandId: 'private-nursery-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }] });
  if (proposal.status !== 'ready') throw Error('Synthetic nursery proposal unavailable');
  const rows = proposal.cycles.map((cycle, index) => createGrowerCyclePlanting(cycle, { plantingId: `private-nursery-planting-${index}`,
    acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint })!);
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Private container label', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Private surface label', usableM2: 10 }],
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const currentRequest: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows, cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint } },
    resourceContext: source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(currentRequest); assert.equal(result.sourceStatus, 'saved-planned');
  const nurseryColumns = ['record_type', 'plan_basis', 'source_verification', 'coverage', 'whole_farm_coverage', 'review_status', 'nursery_review_status',
    'horizon_start_utc', 'horizon_end_exclusive_utc', 'represented_batch_count', 'assigned_batch_count', 'unassigned_batch_count', 'supply_group_number',
    'group_status', 'known_required_seed_subtotal', 'required_seeds', 'additional_seeds_needed', 'planned_packs', 'planned_pack_seeds', 'guidance',
    'entered_supply_group_label', 'label_status', 'public_crop_names', 'identification_description'];
  assert.equal(nurseryColumns.length, 24);
  for (const sample of [false, true]) {
    const groups = [{ id: 'private-nursery-group', label: '=Nursery supply', batchIds: result.batches.map(batch => batch.id), interchangeabilityConfirmed: true, allocatedToPlanSeeds: 20, seedsPerPack: 100 }];
    const csv = buildGrowerSeedSourcingCsv(result, currentRequest, groups, { sample }), review = reviewGrowerSeedSourcing({ result, currentRequest, groups });
    const context = [sample ? 'DEMO — planned seed sourcing estimates' : 'Planned seed sourcing estimates', review.sourceVerification, review.coverage,
      review.wholeFarmCoverage, review.status, review.nurseryReviewStatus, review.horizon?.start ?? 'unknown', review.horizon?.endExclusive ?? 'unknown',
      review.representedBatchCount, review.assignedBatchCount, review.unassignedBatchIds.length];
    const expected = [nurseryColumns, ['guidance', ...context, '', '', '', '', '', '', '', review.guidance, '', '', '', ''],
      ...review.groups.map(row => ['supply_group', ...context, row.index + 1, row.status, row.knownRequiredSeedsSubtotal ?? 'unknown', row.requiredSeeds ?? 'unknown',
        row.counts?.neededSeeds ?? 'unknown', row.counts?.packsNeeded ?? 'unknown', row.counts?.plannedPackSeeds ?? 'unknown', review.guidance,
        row.identification.enteredLabel ?? '', row.identification.labelStatus, JSON.stringify(row.identification.cropNames), row.identification.description])];
    assert.equal(csv, `﻿${expected.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
    assert.doesNotMatch(csv.split('\r\n')[0], /cycle_number|planned_field_entry|entered_gross|cycle_requirement|counted_in|related_cycle|cycle_relation/);
  }
});
