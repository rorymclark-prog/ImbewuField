import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildCropBoardTasks, buildGrowerBoardTasks, buildTaskIcs, getGrowerTaskJournalLink, resolveTaskDate, resolveGrowerTaskIdentities } from '../lib/task-board.ts';
import { resolveAbsoluteTaskDate } from '../lib/crop-calendar-ics.ts';
import { taskHarvestHref, taskJournalHref } from '../lib/task-record-link.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import type { GrowerInput, GrowerPlanningProfile, GrowerPlanningScope } from '../lib/international/grower-planning.ts';

// All quantities/durations are synthetic engineering inputs, not crop advice.
const at = '2026-11-04T12:00:00.000Z';
const scope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' };
const bed = { id: 'operations-fixture-bed', label: 'Own measured bed', areaM2: 12 };
const geometryFingerprint = 'synthetic-operations-geometry:1';
const context: GrowerCycleContext = { scope, beds: [bed], geometryFingerprint };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt: at } });
const now = new Date('2028-02-01T12:00:00.000Z');
function fixture(method: 'direct' | 'transplant' = 'transplant', crossing = false, current = context, id = 'own-operations-row', totalKg = 12) {
  const crop = CROPS.find(crop => Boolean(crop.transplant) !== (method === 'transplant'))!;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-operations-profile', cropKey: crop.key, scope: current.scope!, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(method, 'method'),
    nurseryDays: method === 'transplant' ? own(10, 'days') : { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own(crossing ? [1] : [2, 3], 'utc-months') } };
  const start = crossing ? '2027-12-01' : '2028-02-01', end = crossing ? '2028-01-20' : '2028-03-20';
  const request: GrowerAutoPlanRequest = { requestedAt: at, scope: current.scope!, geometryFingerprint: current.geometryFingerprint!,
    profiles: [profile], beds: [{ bed: current.beds[0], scope: current.scope!, measuredAreaM2: own(current.beds[0].areaM2, 'm2') }],
    planningStart: own(start, 'utc-date'), planningEndExclusive: own(end, 'utc-date'),
    availability: [{ bedId: bed.id, scope: current.scope!, window: own({ start, endExclusive: end }, 'utc-date-window') }],
    reserved: [], maxAssessments: 1000, demands: [{ demandId: 'operations-demand', profileId: profile.profileId, scope: current.scope!,
      totalKg: own(totalKg, 'kg-total'), harvestWindow: own({ start: crossing ? '2028-01-05' : '2028-02-29', endExclusive: end }, 'utc-date-window') }] };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready'); assert.ok(proposal.cycles.length);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: index === 0 ? id : `${id}:${index}`, acceptedAt: at,
      geometryFingerprint: current.geometryFingerprint! }); assert.ok(row); return row;
  });
  return { row: rows[0], rows, crop, profile, proposal };
}
const simpleEvents = (rows: unknown, contexts: readonly GrowerCycleContext[] = [context], clock = now) => {
  const result = buildGrowerBoardTasks(rows, contexts, clock, new Set());
  return { ...result, events: result.tasks.map(task => [task.growerEventKind, task.dueDate]) };
};
const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');

test('real saved transplant cycles produce only their six exact shared-projector events despite the opposite catalogue method', () => {
  const { row, crop } = fixture(); assert.equal(Boolean(crop.transplant), false);
  const before = JSON.stringify(row); const result = simpleEvents([row]);
  assert.equal(result.heldPlantings, 0);
  assert.deepEqual(result.events, [['nursery-start', '2028-02-18'], ['field-entry', '2028-02-28'], ['first-pick', '2028-02-29'],
    ['picking-end', '2028-03-02'], ['field-clear', '2028-03-02'], ['next-entry', '2028-03-03']]);
  for (const task of result.tasks) {
    assert.equal(task.kind, 'grower-cycle'); assert.equal(task.action, undefined); assert.equal(task.bedId, bed.id);
    assert.match(task.title, /Planned/); assert.match(task.subtitle, /own estimates/);
  }
  assert.match(result.tasks.find(t => t.growerEventKind === 'picking-end')!.subtitle, /Exclusive end boundary/);
  assert.match(result.tasks.find(t => t.growerEventKind === 'next-entry')!.subtitle, /not a new planting or confirmation/);
  assert.equal(JSON.stringify(row), before);
});

test('own direct establishment never invents nursery, preparation or weeding tasks from catalogue inputs', () => {
  const { row, crop } = fixture('direct'); assert.equal(crop.transplant, true);
  const result = simpleEvents([row]); assert.equal(result.tasks.length, 5);
  assert.equal(result.tasks.some(task => task.growerEventKind === 'nursery-start'), false);
  assert.equal(buildCropBoardTasks([row], [bed], 2, new Set()).length, 0, 'the marked row cannot re-enter catalogue task generation');
  const broken = JSON.parse(JSON.stringify(row)); broken.growerCycle.assessmentSnapshot.profile.inputs.fieldOccupancyDays = { state: 'missing', reason: 'not-known' };
  const held = simpleEvents([broken]); assert.equal(held.heldPlantings, 1); assert.deepEqual(held.tasks, []);
});

test('past and year-crossing own tasks retain absolute dates and signed display offsets instead of moving to another year', () => {
  const { row } = fixture('transplant', true);
  const result = simpleEvents([row], [context], new Date('2031-06-01T00:00:00Z'));
  assert.deepEqual(result.events, [['nursery-start', '2027-12-25'], ['field-entry', '2028-01-04'], ['first-pick', '2028-01-05'],
    ['picking-end', '2028-01-07'], ['field-clear', '2028-01-07'], ['next-entry', '2028-01-08']]);
  assert.ok(result.tasks.every(task => task.monthsAway < 0));
  const nursery = result.tasks[0]; assert.equal(resolveTaskDate(nursery, new Date('2040-01-01')).toISOString(), '2027-12-25T00:00:00.000Z');
  const ics = unfold(buildTaskIcs(nursery, new Date('2040-01-01T12:00:00Z')));
  assert.match(ics, /DTSTART;VALUE=DATE:20271225\r\n/); assert.match(ics, /DTEND;VALUE=DATE:20271226\r\n/);
  assert.doesNotMatch(ics, /RRULE|VALARM|whole month|marker for the month|Any time during/);
});

test('leap-day and New Year all-day exports use exclusive UTC next days and preserve stable completion identities', () => {
  const { row } = fixture(); const result = simpleEvents([row]);
  const firstPick = result.tasks.find(task => task.growerEventKind === 'first-pick')!;
  const done = buildGrowerBoardTasks([row], [context], now, new Set([firstPick.id]));
  assert.equal(done.tasks.filter(task => task.completed).length, 1); assert.equal(done.tasks.find(t => t.id === firstPick.id)!.completed, true);
  const ics = unfold(buildTaskIcs(firstPick, new Date('2040-12-31T00:00:00Z')));
  assert.match(ics, /DTSTART;VALUE=DATE:20280229\r\n/); assert.match(ics, /DTEND;VALUE=DATE:20280301\r\n/);
  assert.match(ics, /planned cycle from your own estimates/); assert.match(ics, /not recorded work/);
  const december = unfold(buildTaskIcs({ ...firstPick, dueDate: '2028-12-31' }, now));
  assert.match(december, /DTSTART;VALUE=DATE:20281231\r\n/); assert.match(december, /DTEND;VALUE=DATE:20290101\r\n/);
  assert.deepEqual(resolveAbsoluteTaskDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
});

test('missing, malformed and noncanonical own dates never borrow a month marker in calendar export', () => {
  const task = simpleEvents([fixture().row]).tasks[0];
  for (const dueDate of [undefined, '', '2027-02-29', '2028-2-29', '2028-02-29T00:00:00Z']) {
    assert.equal(resolveAbsoluteTaskDate(dueDate), null);
    assert.equal(Number.isNaN(resolveTaskDate({ ...task, dueDate }, now).getTime()), true);
    assert.equal(buildTaskIcs({ ...task, dueDate }, now), '');
  }
  assert.deepEqual(resolveAbsoluteTaskDate('9999-12-31'), { year: 9999, month: 12, day: 31 });
  assert.equal(buildTaskIcs({ ...task, dueDate: '9999-12-31' }, now), '', 'exclusive end beyond the four-digit RFC year is not exportable');
});

test('a day skipped by a local time-zone change still exports its exact recorded UTC calendar day', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Apia';
    const task = { ...simpleEvents([fixture().row]).tasks[0], dueDate: '2011-12-30' };
    const ics = unfold(buildTaskIcs(task, now));
    assert.equal(resolveTaskDate(task, now).toISOString(), '2011-12-30T00:00:00.000Z');
    assert.match(ics, /DTSTART;VALUE=DATE:20111230\r\n/); assert.match(ics, /DTEND;VALUE=DATE:20111231\r\n/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('fresh source scope, geometry and unambiguous beds are required for every own operational event', () => {
  const { row } = fixture();
  for (const contexts of [[], [{ ...context, geometryFingerprint: 'moved-source' }], [{ ...context, beds: [] }],
    [{ ...context, beds: [bed, { ...bed }] }], [{ ...context, beds: [{ ...bed, areaM2: 13 }] }],
    [{ ...context, scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } }], [context, { ...context }]]) {
    const result = simpleEvents([row], contexts as GrowerCycleContext[]);
    assert.equal(result.heldPlantings, 1); assert.deepEqual(result.tasks, []);
  }
  const invalidClock = simpleEvents([row], [context], new Date(NaN)); assert.equal(invalidClock.heldPlantings, 1); assert.deepEqual(invalidClock.tasks, []);
});

test('identical bed IDs in separately named scopes do not borrow current contexts, labels, completions or reservations', () => {
  const second: GrowerCycleContext = { scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' }, beds: [{ ...bed, label: 'Second source label' }], geometryFingerprint };
  const a = fixture().row; const b = fixture('transplant', false, second, 'other-own-row').row;
  const absent = simpleEvents([a, b], [context]); assert.equal(absent.heldPlantings, 1); assert.equal(absent.tasks.length, 6);
  const both = simpleEvents([a, b], [context, second]); assert.equal(both.heldPlantings, 0); assert.equal(both.tasks.length, 12);
  assert.equal(new Set(both.tasks.map(task => task.id)).size, 12);
  assert.equal(both.tasks.filter(task => task.bedLabel === 'Second source label').length, 6);
});

test('whole-book duplicate IDs across own, other-scope, legacy and malformed rows hold every implicated own row', () => {
  const a = fixture().row;
  const second: GrowerCycleContext = { ...context, scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } };
  const b = fixture('transplant', false, second, a.id).row;
  for (const duplicate of [b, { ...a }, { id: a.id, bedId: bed.id, cropKey: a.cropKey, sowMonth: 1 }, { id: a.id, growerCycle: null }]) {
    for (const rows of [[a, duplicate], [duplicate, a]]) {
      const result = simpleEvents(rows, [context, second]); assert.deepEqual(result.tasks, []);
      assert.equal(result.heldPlantings, rows.filter(row => 'growerCycle' in row).length);
    }
  }
});

test('overlapping own whole-bed reservations are held, while touching cycles remain separate planned events', () => {
  const { row, rows } = fixture('transplant', false, context, 'multi-own', 24);
  assert.equal(rows.length, 2);
  const touching = simpleEvents(rows); assert.equal(touching.heldPlantings, 0); assert.equal(touching.tasks.length, 12);
  const duplicateCycle = JSON.parse(JSON.stringify(row)); duplicateCycle.id = 'overlapping-row'; duplicateCycle.growerCycle.plantingId = duplicateCycle.id;
  const held = simpleEvents([row, duplicateCycle]); assert.equal(held.heldPlantings, 2); assert.deepEqual(held.tasks, []);
});

test('claimed projected DTOs are never trusted as canonical saved cycles, and malformed markers remain held', () => {
  const { row } = fixture(); const claimed = projectGrowerCycles([row], context).ownCycles[0];
  assert.deepEqual(simpleEvents([claimed]).tasks, []);
  for (const marker of [null, undefined, false, {}]) {
    const result = simpleEvents([{ ...row, growerCycle: marker }]); assert.equal(result.heldPlantings, 1); assert.deepEqual(result.tasks, []);
  }
  assert.equal(simpleEvents('bad row list').heldPlantings, 1);
  const legacy = { id: 'legacy-fixture', bedId: bed.id, cropKey: row.cropKey, sowMonth: 1 };
  assert.deepEqual(simpleEvents([legacy]).tasks, []); assert.equal(simpleEvents([legacy]).heldPlantings, 0);
});

test('own task journal/harvest handoffs never fabricate catalogue actions even with stale action metadata attached', () => {
  const tasks = simpleEvents([fixture().row]).tasks;
  for (const task of tasks) {
    assert.equal(taskJournalHref(task), null); assert.equal(taskHarvestHref(task), null);
    assert.equal(taskJournalHref({ ...task, action: 'harvest' }), null); assert.equal(taskHarvestHref({ ...task, action: 'harvest' }), null);
  }
});

test('opaque calendar task identities retain persistent planting/event identity across dates and source revisions without disclosing scope', () => {
  const a = fixture().row;
  const revisedContext = { ...context, geometryFingerprint: 'private-new-source-revision', beds: [{ ...bed, label: 'Renamed measured bed' }] };
  const b = fixture('transplant', true, revisedContext, a.id).row;
  const first = simpleEvents([a]); const revised = simpleEvents([b], [revisedContext]);
  assert.deepEqual(new Map(first.tasks.map(t => [t.growerEventKind, t.id])), new Map(revised.tasks.map(t => [t.growerEventKind, t.id])));
  assert.notDeepEqual(first.events, revised.events);
  const completed = buildGrowerBoardTasks([b], [revisedContext], now, new Set([first.tasks[0].id]));
  assert.equal(completed.tasks.find(t => t.growerEventKind === 'nursery-start')!.completed, true);
  for (const task of revised.tasks) {
    assert.match(task.id, /^grower-cycle-v1-[a-f0-9]{32}$/);
    const ics = unfold(buildTaskIcs(task, now));
    assert.doesNotMatch(ics, /mapped-site|site:|0\.00000|private-new-source|operations-fixture-bed|own-operations-row/);
  }
});

test('a digest collision holds all tasks of every implicated cycle rather than sharing one completion identity', () => {
  const result = resolveGrowerTaskIdentities([
    { rowIndex: 0, plantingId: 'A', kind: 'field-entry' }, { rowIndex: 0, plantingId: 'A', kind: 'first-pick' },
    { rowIndex: 1, plantingId: 'B', kind: 'field-entry' }, { rowIndex: 2, plantingId: 'C', kind: 'field-entry' },
  ], input => input.includes('"C"') ? '1'.repeat(32) : '0'.repeat(32));
  assert.deepEqual([...result.heldRows].sort(), [0, 1]);
  assert.deepEqual(result.ids.slice(0, 3), [null, null, null]); assert.equal(typeof result.ids[3], 'string');
});

test('own task translations fall back to explicit English estimates, and exact-date ICS escapes and folds free-text labels', () => {
  const { row } = fixture();
  const result = buildGrowerBoardTasks([row], [context], now, new Set(), key => key);
  assert.match(result.tasks[0].title, /Planned nursery start/); assert.doesNotMatch(result.tasks[0].subtitle, /taskGrower/);
  const renamed = { ...result.tasks[0], subtitle: 'Long, label; with\\slash\nand ' + 'ü'.repeat(100) };
  const text = buildTaskIcs(renamed, now); const unfolded = unfold(text);
  assert.match(unfolded, /Long\\, label\\; with\\\\slash\\nand/);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const unlabelled = buildGrowerBoardTasks([row], [{ ...context, beds: [{ ...bed, label: '' }] }], now, new Set());
  assert.ok(unlabelled.tasks.every(task => task.bedLabel === 'Measured bed' && !task.subtitle.includes(bed.id)));
});


test('a dated work task keeps its journal identity private and attached only to the exact task', () => {
  const { row } = fixture();
  const result = simpleEvents([row]);
  const task = result.tasks[0];
  const link = getGrowerTaskJournalLink(task);
  assert.deepEqual(link, { version: 1, plantingId: row.id, cycleId: row.growerCycle.cycleId, bedId: bed.id, scope });
  assert.ok(Object.isFrozen(link));
  assert.ok(Object.isFrozen(link!.scope));
  assert.equal(getGrowerTaskJournalLink({ ...task }), null);
  assert.equal(getGrowerTaskJournalLink({ ...task, kind: 'survey' }), null);
  assert.equal(taskJournalHref(task), null);
  for (const output of [JSON.stringify(task), buildTaskIcs(task, now)]) {
    assert.ok(!output.includes(row.id));
    assert.ok(!output.includes('site:0.00000,0.00000'));
  }
  assert.equal(simpleEvents([row, { id: row.id }]).tasks.length, 0);
});
