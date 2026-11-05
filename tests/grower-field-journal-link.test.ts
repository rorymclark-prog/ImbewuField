import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { createJournalEntry, editJournalEntry, normaliseJournal, inspectJournalGrowerLink,
  normaliseGrowerJournalLink, type GrowerJournalLink, type JournalEntryInput } from '../lib/field-journal.ts';
import { resolveGrowerJournalLink, taskHarvestHref, taskJournalHref } from '../lib/task-record-link.ts';
import { buildJournalCsv, buildJournalHtml } from '../lib/journal-export.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { BoardTask } from '../lib/task-board.ts';

// Synthetic engineering inputs exercise the real planning/projector boundary.
// Their values are test data and supply no agricultural recommendations.
const stamp = '2026-11-04T12:00:00.000Z';
const scope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } as const;
const bed = { id: 'measured-test-bed', label: 'Synthetic bed', areaM2: 8 };
const geometryFingerprint = '1'.repeat(64);
const context: GrowerCycleContext = { scope, beds: [bed], geometryFingerprint };
const provided = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
function fixture(plantingId = 'persistent-test-planting', year = 2028, method: 'direct' | 'transplant' = 'transplant') {
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'test-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: provided(1, 'plants/m2'), yieldKgPerM2: provided(2, 'kg/m2/cycle'), establishment: provided(method, 'method'),
    nurseryDays: method === 'transplant' ? provided(2, 'days') : { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: provided(2, 'days'), pickingDays: provided(2, 'days'),
    fieldOccupancyDays: provided(4, 'days'), turnaroundDays: provided(1, 'days'), allowedEntryMonths: provided([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint, profiles: [profile],
    beds: [{ bed, scope, measuredAreaM2: provided(bed.areaM2, 'm2') }],
    planningStart: provided(`${year}-02-01`, 'utc-date'), planningEndExclusive: provided(`${year}-03-01`, 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: provided({ start: `${year}-02-01`, endExclusive: `${year}-03-01` }, 'utc-date-window') }],
    demands: [{ demandId: 'test-demand', profileId: profile.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: `${year}-02-10`, endExclusive: `${year}-02-12` }, 'utc-date-window') }],
    reserved: [], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId, acceptedAt: stamp, geometryFingerprint });
  assert.ok(row);
  const cycle = projectGrowerCycles([row], context).ownCycles[0];
  assert.ok(cycle);
  const event = cycle.plannedEvents.find(event => event.kind === 'field-entry')!;
  const link: GrowerJournalLink = { version: 1, scope, plantingId: row.id, bedId: row.bedId,
    eventKind: event.kind, plannedDate: event.date };
  return { row, cycle, link };
}
const observation = (link?: unknown): JournalEntryInput => ({ date: '2026-11-03', title: 'Synthetic observation',
  notes: 'A grower-entered observation.', category: 'maintenance', bedId: bed.id,
  ...(link === undefined ? {} : { growerCycleLink: link }) });

test('a field note stores its explicitly observed day separately from the original planned event day', () => {
  const { row, link } = fixture();
  const note = createJournalEntry(observation(link), 1000);
  assert.equal(note.date, '2026-11-03');
  const inspected = inspectJournalGrowerLink(note);
  assert.equal(inspected.status, 'linked');
  if (inspected.status !== 'linked') return;
  assert.equal(inspected.link.plannedDate, link.plannedDate);
  assert.notEqual(note.date, inspected.link.plannedDate);
  const resolved = resolveGrowerJournalLink([row], [context], inspected.link);
  assert.deepEqual(resolved, { status: 'ready', link, cropKey: row.cropKey, bedId: row.bedId });
  assert.deepEqual(Object.keys(resolved).sort(), ['bedId', 'cropKey', 'link', 'status']);
  for (const key of ['kg', 'quantity', 'stock', 'completed', 'actualHarvest', 'consent']) assert.equal(key in note, false);
});

test('strict reference decoding detaches the six known identity fields and freezes its scope', () => {
  const { link } = fixture();
  const raw = structuredClone(link), decoded = normaliseGrowerJournalLink(raw);
  assert.deepEqual(decoded, link); assert.notEqual(decoded, raw); assert.notEqual(decoded?.scope, raw.scope);
  assert.ok(Object.isFrozen(decoded)); assert.ok(Object.isFrozen(decoded?.scope));
  assert.equal(raw.scope.kind, 'mapped-site');
  if (raw.scope.kind === 'mapped-site') (raw.scope as { siteId: string }).siteId = 'site:0.00000,1.00000';
  assert.deepEqual(decoded?.scope, scope);
  assert.equal(Object.isFrozen(raw), false);
});

test('unknown versions, extra facts, malformed scopes and invalid planned days remain held references', () => {
  const { link } = fixture();
  for (const value of [null, false, 1, [], {}, { ...link, version: 2 }, { ...link, quantity: 99 },
    { ...link, plannedDate: '2026-02-30' }, { ...link, eventKind: 'completed' }, { ...link, plantingId: '' },
    { ...link, bedId: 'bed\nother' }, { ...link, scope: { kind: 'mapped-site', siteId: 'site:0,0' } },
    { ...link, scope: { ...scope, workspaceId: 'design:other' } }]) {
    assert.equal(normaliseGrowerJournalLink(value), null);
    const created = createJournalEntry(observation(value), 1000);
    assert.ok(Object.hasOwn(created, 'growerCycleLink'));
    assert.equal(inspectJournalGrowerLink(created).status, 'held');
    assert.equal(resolveGrowerJournalLink([], [context], value).status, 'held');
  }
});

test('normalization and legacy note edits retain malformed original marker evidence instead of downgrading it', () => {
  const { link } = fixture();
  for (const marker of [null, { version: 99, retained: { futureEvidence: ['keep', 0, false] } }, { ...link, plannedDate: 'tampered' }]) {
    const original = createJournalEntry(observation(marker), 1000);
    const loaded = normaliseJournal(JSON.parse(JSON.stringify([original])))[0];
    assert.ok(Object.hasOwn(loaded, 'growerCycleLink'));
    assert.deepEqual(loaded.growerCycleLink, marker);
    const edited = editJournalEntry(loaded, { ...observation(link), title: 'Ordinary correction' }, 2000);
    assert.deepEqual(edited.growerCycleLink, marker, 'A legacy editor must not replace original held evidence with a new valid-looking marker');
    assert.equal(inspectJournalGrowerLink(edited).status, 'held');
  }
});

test('valid original linkage survives legacy edits that never knew the new input field', () => {
  const { link } = fixture();
  const original = createJournalEntry(observation(link), 1000);
  const edited = editJournalEntry(original, { ...observation(), title: 'Corrected title', date: '2026-11-02' }, 2000);
  assert.deepEqual(edited.growerCycleLink, link); assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, 1000); assert.equal(edited.updatedAt, 2000); assert.equal(edited.date, '2026-11-02');
  assert.equal(inspectJournalGrowerLink(edited).status, 'linked');
  const retagged = editJournalEntry(original, { ...observation(), bedId: 'another-bed' }, 2000);
  assert.deepEqual(retagged.growerCycleLink, link);
  assert.deepEqual(inspectJournalGrowerLink(retagged), { status: 'held', reason: 'bed-changed' });
});

test('ordinary unlinked notes stay legacy and new reference fields never appear by default', () => {
  const created = createJournalEntry(observation(), 1000);
  const loaded = normaliseJournal(JSON.parse(JSON.stringify([created])))[0];
  const edited = editJournalEntry(loaded, { ...observation(), notes: 'Updated observation' }, 2000);
  for (const row of [created, loaded, edited]) {
    assert.equal(Object.hasOwn(row, 'growerCycleLink'), false);
    assert.deepEqual(inspectJournalGrowerLink(row), { status: 'legacy' });
  }
});

test('stored marker evidence is detached while unknown future JSON members remain exactly represented', () => {
  const marker = { version: 99, retained: { futureEvidence: ['keep', 0, false] }, constructor: { metadata: true } };
  const raw = { ...createJournalEntry(observation(), 1000), growerCycleLink: marker };
  const loaded = normaliseJournal([raw])[0];
  assert.deepEqual(loaded.growerCycleLink, marker);
  marker.retained.futureEvidence[0] = 'changed outside';
  assert.equal((loaded.growerCycleLink as typeof marker).retained.futureEvidence[0], 'keep');
  assert.equal(Object.isFrozen(marker), false);
});

test('accessor and inherited references hold without executing link, scope or entry getters', () => {
  const { link } = fixture(); let getters = 0;
  const accessor = { enumerable: true, get() { getters++; throw Error('Must not read'); } };
  for (const key of Object.keys(link)) {
    const raw = { ...link }; Object.defineProperty(raw, key, accessor);
    assert.equal(normaliseGrowerJournalLink(raw), null);
  }
  const rawScope = { ...scope }; Object.defineProperty(rawScope, 'siteId', accessor);
  assert.equal(normaliseGrowerJournalLink({ ...link, scope: rawScope }), null);
  const inherited = Object.create(link);
  assert.equal(normaliseGrowerJournalLink(inherited), null);
  const inheritedEntry = Object.assign(Object.create({ growerCycleLink: link }), observation());
  assert.equal(inspectJournalGrowerLink(inheritedEntry).status, 'held');
  const rawEntry = createJournalEntry(observation(), 1000); Object.defineProperty(rawEntry, 'growerCycleLink', accessor);
  assert.equal(inspectJournalGrowerLink(rawEntry).status, 'held');
  const heldEntry = normaliseJournal([rawEntry])[0];
  assert.ok(Object.hasOwn(heldEntry, 'growerCycleLink')); assert.equal(inspectJournalGrowerLink(heldEntry).status, 'held');
  assert.equal(getters, 0);
});

test('nested active marker data and cyclic evidence stay explicitly held through creation', () => {
  const nested = Object.defineProperty({}, 'evidence', { enumerable: true, get() { throw Error('Must not run'); } });
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  for (const marker of [nested, cycle, undefined]) {
    const input = { ...observation(), growerCycleLink: marker };
    const entry = createJournalEntry(input, 1000);
    assert.ok(Object.hasOwn(entry, 'growerCycleLink'));
    assert.equal(inspectJournalGrowerLink(entry).status, 'held');
    assert.doesNotThrow(() => JSON.stringify(entry));
  }
});

test('a persistent planting ID selects the correct row even when two accepted proposals reuse a cycle ordinal', () => {
  const later = fixture('later-persistent-row', 2029), earlier = fixture('earlier-persistent-row', 2028);
  assert.equal(later.row.growerCycle.cycleId, earlier.row.growerCycle.cycleId);
  const rows = [earlier.row, later.row];
  assert.equal(projectGrowerCycles(rows, context).ownCycles.length, 2);
  const result = resolveGrowerJournalLink(rows, [context], later.link);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.link.plantingId, later.row.id);
  assert.deepEqual(resolveGrowerJournalLink(rows, [context], { ...later.link, plantingId: 'unknown-row' }),
    { status: 'held', reason: 'cycle-unavailable' });
});

test('whole-book duplicate identities and conflicting reservations hold without filtering away the damaged neighbor', () => {
  const { row, link } = fixture();
  const overlap = fixture('another-reservation').row;
  for (const rows of [[row, { id: row.id }], [{ id: row.id }, row], [row, { ...row }], [row, overlap]]) {
    assert.deepEqual(resolveGrowerJournalLink(rows, [context], link), { status: 'held', reason: 'cycle-unavailable' });
  }
});

test('foreign, missing and duplicated current scope contexts never pick a convenient source', () => {
  const { row, link } = fixture();
  assert.deepEqual(resolveGrowerJournalLink([row], [], link), { status: 'held', reason: 'scope-unavailable' });
  assert.deepEqual(resolveGrowerJournalLink([row], [{ ...context, scope: { kind: 'unmapped-workspace', workspaceId: 'design:other' } }], link),
    { status: 'held', reason: 'scope-unavailable' });
  assert.deepEqual(resolveGrowerJournalLink([row], [context, structuredClone(context)], link), { status: 'held', reason: 'scope-ambiguous' });
  assert.deepEqual(resolveGrowerJournalLink([row], [context], { ...link, scope: { kind: 'mapped-site', siteId: 'site:0.00000,1.00000' } }),
    { status: 'held', reason: 'scope-unavailable' });
});

test('stale geometry, changed measured beds and a mismatched exact bed identity hold the link', () => {
  const { row, link } = fixture();
  for (const current of [{ ...context, geometryFingerprint: '2'.repeat(64) }, { ...context, beds: [] },
    { ...context, beds: [{ ...bed, areaM2: 9 }] }, { ...context, beds: [bed, { ...bed }] }]) {
    assert.equal(resolveGrowerJournalLink([row], [current], link).status, 'held');
  }
  assert.equal(resolveGrowerJournalLink([row], [context], { ...link, bedId: 'different-bed' }).status, 'held');
});

test('the exact planned event and day must still exist and exclusive boundaries stay planned context', () => {
  const { row, link, cycle } = fixture();
  assert.deepEqual(resolveGrowerJournalLink([row], [context], { ...link, plannedDate: '2028-02-20' }),
    { status: 'held', reason: 'event-changed' });
  for (const event of cycle.plannedEvents) {
    const result = resolveGrowerJournalLink([row], [context], { ...link, eventKind: event.kind, plannedDate: event.date });
    assert.equal(result.status, 'ready');
  }
  const direct = fixture('direct-row', 2028, 'direct');
  assert.deepEqual(resolveGrowerJournalLink([direct.row], [context], { ...direct.link, eventKind: 'nursery-start' }),
    { status: 'held', reason: 'event-changed' });
  const pickingEnd = cycle.plannedEvents.find(event => event.kind === 'picking-end')!;
  assert.equal(pickingEnd.endExclusive, true);
  const note = createJournalEntry(observation({ ...link, eventKind: pickingEnd.kind, plannedDate: pickingEnd.date }), 1000);
  assert.equal(note.date, observation().date);
  assert.equal('fieldCleared' in note, false);
});

test('downloaded notes distinguish the observed day from the planned reference while excluding private planting and site identity', () => {
  const { link } = fixture('unique-private-planting-marker');
  const note = createJournalEntry(observation(link), 1000);
  for (const output of [buildJournalCsv([note]), buildJournalHtml([note])]) {
    assert.ok(output.includes(note.title));
    // The shared summary deliberately exposes the planned DAY separately from
    // the observation date, but it never exports canonical IDs or scope.
    assert.ok(output.includes(note.date));
    assert.ok(output.includes(link.plannedDate));
    assert.match(output, /own observed date/);
    assert.match(output, /not been rechecked against current saved plantings/);
    for (const privateText of [link.plantingId, scope.siteId, 'growerCycleLink', 'eventKind']) {
      assert.equal(output.includes(privateText), false, privateText);
    }
  }
});

test('an own-cycle task gains no legacy catalogue journal URL, harvest quantity or completion from linkage', () => {
  const { link } = fixture();
  const task: BoardTask = { id: 'opaque-task-id', kind: 'grower-cycle', title: 'Planned event', subtitle: 'Own estimate', icon: '',
    dueMonth: 2, monthsAway: 0, completed: false, dueDate: link.plannedDate, growerEventKind: link.eventKind, bedId: link.bedId };
  assert.equal(taskJournalHref(task), null); assert.equal(taskHarvestHref(task), null);
  createJournalEntry(observation(link), 1000);
  assert.equal(task.completed, false);
});
