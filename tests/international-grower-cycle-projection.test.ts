import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanCycle, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { resolveGrowerFieldNoteLink } from '../lib/international/grower-field-note-link.ts';
import { assessGrowerPlanning, type GrowerInput, type GrowerPlanningInputs, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';

// Synthetic engineering fixtures: none of these numbers are farming instructions.
const at = '2026-11-04T12:00:00.000Z';
const scope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } as const;
const bed = { id: 'measured-fixture', label: 'Measured fixture', areaM2: 12 };
const geometryFingerprint = 'synthetic-saved-geometry:1';
const context: GrowerCycleContext = { scope, beds: [bed], geometryFingerprint };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt: at } });
function fixture(method: 'direct' | 'transplant' = 'transplant', yearCrossing = false,
  inputs: Partial<GrowerPlanningInputs> = {}, totalKg = 12) {
  const crop = CROPS.find(candidate => Boolean(candidate.transplant) !== (method === 'transplant'))!;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-fixture', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(method, 'method'),
    nurseryDays: method === 'transplant' ? own(10, 'days') : { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own(yearCrossing ? [1] : [2, 3], 'utc-months'), ...inputs } };
  const start = yearCrossing ? '2027-12-01' : '2028-02-01', end = yearCrossing ? '2028-01-20' : '2028-03-20';
  const request: GrowerAutoPlanRequest = { requestedAt: at, scope, geometryFingerprint, profiles: [profile],
    beds: [{ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') }], planningStart: own(start, 'utc-date'),
    planningEndExclusive: own(end, 'utc-date'), availability: [{ bedId: bed.id, scope,
      window: own({ start, endExclusive: end }, 'utc-date-window') }], reserved: [], maxAssessments: 1000,
    demands: [{ demandId: 'buyer-fixture', profileId: profile.profileId, scope, totalKg: own(totalKg, 'kg-total'),
      harvestWindow: own({ start: yearCrossing ? '2028-01-05' : '2028-02-29', endExclusive: end }, 'utc-date-window') }] };
  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready');
  const cycles = proposal.cycles;
  assert.ok(cycles.length);
  const create = (cycle: GrowerAutoPlanCycle, id = 'own-row') => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: id, acceptedAt: at, geometryFingerprint }); assert.ok(row); return row;
  };
  return { crop, profile, request, cycles, create, row: create(cycles[0]) };
}
const events = (cycle: ReturnType<typeof projectGrowerCycles>['ownCycles'][number]) => cycle.plannedEvents.map(event => [event.kind, event.date]);

test('own transplant events and nursery targets follow the shared leap-year dates even against the catalogue method', () => {
  const { row, crop } = fixture();
  assert.equal(Boolean(crop.transplant), false, 'opposing catalogue method makes accidental borrowing observable');
  const result = projectGrowerCycles([row], context);
  assert.equal(result.ownCycles.length, 1); assert.deepEqual(result.heldRows, []); assert.deepEqual(result.legacyRows, []);
  const cycle = result.ownCycles[0];
  assert.deepEqual(events(cycle), [['nursery-start', '2028-02-18'], ['field-entry', '2028-02-28'],
    ['first-pick', '2028-02-29'], ['picking-end', '2028-03-02'], ['field-clear', '2028-03-02'], ['next-entry', '2028-03-03']]);
  assert.ok(cycle.plannedEvents.every(event => event.status === 'planned'));
  assert.equal(cycle.plannedEvents.find(event => event.kind === 'picking-end')!.endExclusive, true);
  assert.deepEqual(cycle.reservation, { start: '2028-02-28', endExclusive: '2028-03-03' });
  assert.equal(cycle.totalCycleKg, 12); assert.equal(cycle.targetPlantCount, 48);
  assert.deepEqual(cycle.nurseryDemand, { targetPositions: 48, interval: { start: '2028-02-18', endExclusive: '2028-02-28' },
    seedQuantity: null, trayQuantity: null, spaceM2: null });
  assert.equal(cycle.sourceVerification, 'not-verified');
});

test('own direct establishment produces no nursery phase despite the catalogue transplant flag', () => {
  const { row, crop } = fixture('direct');
  assert.equal(crop.transplant, true);
  const cycle = projectGrowerCycles([row], context).ownCycles[0];
  assert.deepEqual(events(cycle).map(event => event[0]), ['field-entry', 'first-pick', 'picking-end', 'field-clear', 'next-entry']);
  assert.equal(cycle.nurseryDemand, null);
  assert.equal(cycle.plannedEvents[0].date, '2028-02-28');
});

test('year-crossing nursery and field events remain exact one-time planned dates without recurrence', () => {
  const { row } = fixture('transplant', true);
  const cycle = projectGrowerCycles([row], context).ownCycles[0];
  assert.deepEqual(events(cycle), [['nursery-start', '2027-12-25'], ['field-entry', '2028-01-04'],
    ['first-pick', '2028-01-05'], ['picking-end', '2028-01-07'], ['field-clear', '2028-01-07'], ['next-entry', '2028-01-08']]);
  for (const key of ['recursAnnually', 'weeklyKg', 'monthlyKg', 'price', 'currency', 'actualStock']) assert.equal(key in cycle, false, key);
});

test('zero nursery duration retains its empty interval and does not invent trays, seeds or nursery space', () => {
  const { row } = fixture('transplant', false, { nurseryDays: own(0, 'days') });
  const cycle = projectGrowerCycles([row], context).ownCycles[0];
  assert.deepEqual(cycle.nurseryDemand, { targetPositions: 48, interval: { start: '2028-02-28', endExclusive: '2028-02-28' },
    seedQuantity: null, trayQuantity: null, spaceM2: null });
  assert.equal(cycle.plannedEvents[0].date, cycle.plannedEvents[1].date);
});

test('provided zero cycle yield remains known zero rather than becoming missing stock or an inferred sale', () => {
  const { cycles, create } = fixture('direct');
  const old = cycles[0].assessment.snapshot;
  const assessment = assessGrowerPlanning({ ...old, profile: { ...old.profile,
    inputs: { ...old.profile.inputs, yieldKgPerM2: own(0, 'kg/m2/cycle') } } });
  assert.equal(assessment.status, 'ready'); if (assessment.status !== 'ready') return;
  const row = create({ ...cycles[0], assessment });
  const result = projectGrowerCycles([row], context);
  assert.equal(result.ownCycles[0].totalCycleKg, 0);
  assert.equal(result.ownCycles[0].targetPlantCount, 48);
  assert.equal('actualStock' in result.ownCycles[0], false);
});

test('legacy and malformed own rows remain separate without approving legacy advice or land availability', () => {
  const { row, crop } = fixture();
  const legacy = { id: 'legacy', bedId: bed.id, cropKey: crop.key, sowMonth: 1, existing: true,
    callerMetadata: { value: 'retained' } };
  const held = { ...row, id: 'malformed-own', growerCycle: undefined };
  const result = projectGrowerCycles([legacy, row, held, null, { id: 'bad-month', bedId: bed.id, cropKey: crop.key, sowMonth: 13 }], context);
  assert.equal(result.legacyRows.length, 1); assert.equal(result.legacyRows[0].row, legacy);
  assert.equal(result.legacyRows[0].basis, 'legacy-unapproved');
  assert.equal(result.ownCycles.length, 1); assert.deepEqual(result.heldRows.map(value => value.rowIndex), [2, 3, 4]);
  assert.equal(result.heldRows[0].row, held);
  assert.equal(result.reservationCoverage, 'valid-own-cycles-only'); assert.equal(result.legacyOccupancy, 'not-assessed');
  assert.equal('availableBeds' in result, false);
  assert.equal(Object.isFrozen(legacy), false); assert.equal(Object.isFrozen(legacy.callerMetadata), false);
});

test('missing or stale current scope, moved geometry and ambiguous measured beds hold every own operational event', () => {
  const { row } = fixture();
  for (const current of [undefined, null, { ...context, scope: null }, { ...context, geometryFingerprint: null },
    { ...context, geometryFingerprint: 'same-area-moved-source' }, { ...context, beds: [] },
    { ...context, beds: [bed, { ...bed }] }, { ...context, beds: [{ ...bed, areaM2: 13 }] },
    { ...context, scope: { kind: 'unmapped-workspace', workspaceId: 'design:other' } }]) {
    const result = projectGrowerCycles([row], current as GrowerCycleContext | null | undefined);
    assert.deepEqual(result.ownCycles, []); assert.deepEqual(result.legacyRows, []);
    assert.equal(result.heldRows.length, 1); assert.ok(result.heldRows[0].reasons.length);
  }
});

test('malformed or missing own assessment values never fall back to catalogue timing or spacing', () => {
  const { row } = fixture();
  for (const marker of [null, false, {}, { kind: 'grower-dated-cycle', version: 2 }, undefined]) {
    const result = projectGrowerCycles([{ ...row, growerCycle: marker }], context);
    assert.equal(result.heldRows.length, 1); assert.deepEqual(result.ownCycles, []); assert.deepEqual(result.legacyRows, []);
  }
  const modified = JSON.parse(JSON.stringify(row));
  modified.growerCycle.assessmentSnapshot.profile.inputs.fieldOccupancyDays = { state: 'missing', reason: 'not-known' };
  assert.equal(projectGrowerCycles([modified], context).heldRows.length, 1);
  const malformed = projectGrowerCycles('not-a-row-list', context);
  assert.equal(malformed.heldRows[0].rowIndex, null); assert.deepEqual(malformed.heldRows[0].reasons, ['invalid-row-list']);
});

test('duplicate identities across own, legacy and malformed rows hold every involved row without choosing a winner', () => {
  const { row, crop } = fixture();
  for (const duplicate of [{ id: row.id, bedId: bed.id, cropKey: crop.key, sowMonth: 1 },
    { ...row }, { id: row.id, growerCycle: null }]) {
    for (const rows of [[row, duplicate], [duplicate, row]]) {
      const result = projectGrowerCycles(rows, context);
      assert.deepEqual(result.ownCycles, []); assert.deepEqual(result.legacyRows, []);
      assert.equal(result.heldRows.length, 2);
      assert.ok(result.heldRows.every(value => value.reasons.includes('ambiguous-planting-id')));
    }
  }
});

test('overlapping own reservations hold all affected rows while an adjacent valid cycle remains usable', () => {
  const { cycles, create } = fixture('direct', false, {}, 24);
  assert.equal(cycles.length, 2);
  const first = create(cycles[0], 'first'), duplicate = create(cycles[0], 'overlap'), adjacent = create(cycles[1], 'adjacent');
  const result = projectGrowerCycles([first, duplicate, adjacent], context);
  assert.deepEqual(result.ownCycles.map(value => value.plantingId), ['adjacent']);
  assert.deepEqual(result.heldRows.map(value => value.plantingId), ['first', 'overlap']);
  assert.ok(result.heldRows.every(value => value.reasons.includes('overlapping-own-reservation')));
  const long = fixture('direct', false, { fieldOccupancyDays: own(10, 'days') });
  const connected = projectGrowerCycles([long.create(long.cycles[0], 'long'), first, adjacent], context);
  assert.deepEqual(connected.ownCycles, []); assert.equal(connected.heldRows.length, 3);
});

test('own projections detach/freeze derived values and never freeze or rewrite the caller’s raw rows and measured geometry', () => {
  const { row } = fixture();
  const raw = JSON.parse(JSON.stringify(row)), localBed = { ...bed }, current = { ...context, beds: [localBed] };
  const before = JSON.stringify({ raw, current });
  const result = projectGrowerCycles([raw], current);
  assert.equal(JSON.stringify({ raw, current }), before);
  assert.equal(Object.isFrozen(raw), false); assert.equal(Object.isFrozen(localBed), false); assert.equal(Object.isFrozen(current.beds), false);
  assert.equal(Object.isFrozen(result.ownCycles[0].nurseryDemand!.interval), true);
  raw.growerCycle.assessmentSnapshot.profile.inputs.yieldKgPerM2.value = 999;
  assert.equal(result.ownCycles[0].totalCycleKg, 12);
  assert.equal(result.ownCycles[0].assessment.capacity.estimatedYieldKg, 12);
});

test('catalogue agronomy poisoning cannot change own projection or assign a schedule to legacy rows', () => {
  const { row, crop } = fixture();
  const legacy = { id: 'legacy', bedId: bed.id, cropKey: crop.key, sowMonth: 1 };
  const descriptors = Object.getOwnPropertyDescriptors(crop), before = projectGrowerCycles([row, legacy], context);
  try {
    for (const key of Object.keys(crop).filter(key => key !== 'key')) Object.defineProperty(crop, key, {
      configurable: true, get() { throw new Error(`Projection must not read catalogue ${key}`); },
    });
    const result = projectGrowerCycles([row, legacy], context);
    assert.deepEqual(result, before); assert.equal('plannedEvents' in result.legacyRows[0], false);
  } finally { Object.defineProperties(crop, descriptors); }
});


test('a field note links to the current saved planting, without inheriting planned dates or yields', () => {
  const row = structuredClone(fixture().row);
  const choice = { plantingId: row.id, cycleId: row.growerCycle.cycleId, bedId: bed.id, scope };
  const before = structuredClone(row);
  const result = resolveGrowerFieldNoteLink([row], context, { ...choice, date: '2028-02-29', actualKg: 12 });
  assert.deepEqual(result, { status: 'resolved', link: { version: 1, ...choice } });
  assert.deepEqual(row, before);
  assert.equal(Object.isFrozen(row), false);
  assert.notEqual(result.status === 'resolved' && result.link.scope, scope);
});

test('an ordinal, the wrong bed or the wrong site cannot authorize a field note link', () => {
  const { row } = fixture();
  const choice = { plantingId: row.id, cycleId: row.growerCycle.cycleId, bedId: bed.id, scope };
  assert.deepEqual(resolveGrowerFieldNoteLink([row], context, { cycleId: choice.cycleId, bedId: bed.id, scope }),
    { status: 'held', reason: 'invalid-selection' });
  assert.deepEqual(resolveGrowerFieldNoteLink([row], context, { ...choice, plantingId: 'unknown-row' }),
    { status: 'held', reason: 'cycle-unavailable' });
  assert.deepEqual(resolveGrowerFieldNoteLink([row], context, { ...choice, bedId: 'other-bed' }),
    { status: 'held', reason: 'selection-changed' });
  assert.deepEqual(resolveGrowerFieldNoteLink([row], context, { ...choice, cycleId: 'other-ordinal' }),
    { status: 'held', reason: 'selection-changed' });
  assert.deepEqual(resolveGrowerFieldNoteLink([row], context, { ...choice, scope: { kind: 'mapped-site', siteId: 'site:0.00000,1.00000' } }),
    { status: 'held', reason: 'scope-changed' });
});

test('duplicate planting IDs, reservation conflicts and changed geometry hold a link even when the chosen row still exists', () => {
  const { row, create, cycles } = fixture();
  const choice = { plantingId: row.id, cycleId: row.growerCycle.cycleId, bedId: bed.id, scope };
  const expected = { status: 'held', reason: 'cycle-unavailable' };
  assert.deepEqual(resolveGrowerFieldNoteLink([row, { id: row.id }], context, choice), expected);
  assert.deepEqual(resolveGrowerFieldNoteLink([row, create(cycles[0], 'other-reservation')], context, choice), expected);
  assert.deepEqual(resolveGrowerFieldNoteLink([row], { ...context, geometryFingerprint: 'changed' }, choice), expected);
  assert.deepEqual(resolveGrowerFieldNoteLink([row], { ...context, beds: [] }, choice), expected);
});


test('proposal-local ordinals can repeat without redirecting a note to a different saved planting', () => {
  const later = fixture().row;
  const earlier = fixture('transplant', true);
  const other = earlier.create(earlier.cycles[0], 'other-saved-planting');
  assert.equal(later.growerCycle.cycleId, other.growerCycle.cycleId, 'fixture repeats the ordinal across two proposals');
  const rows = [other, later];
  assert.equal(projectGrowerCycles(rows, context).ownCycles.length, 2);
  const result = resolveGrowerFieldNoteLink(rows, context,
    { plantingId: later.id, cycleId: later.growerCycle.cycleId, bedId: bed.id, scope });
  assert.equal(result.status, 'resolved');
  assert.equal(result.link.plantingId, later.id);
});


test('runtime accessors cannot substitute a planting or site identity for a field note', () => {
  const { row } = fixture();
  const choice = { plantingId: row.id, cycleId: row.growerCycle.cycleId, bedId: bed.id, scope };
  let getterCalls = 0;
  const getter = () => { getterCalls++; throw new Error('Selection getter'); };
  const ownAccessor = Object.defineProperty({ ...choice }, 'plantingId', { get: getter });
  const { plantingId: _plantingId, ...otherFields } = choice;
  const inheritedAccessor = Object.assign(Object.create(Object.defineProperty({}, 'plantingId', { get: getter })), otherFields);
  const nestedAccessor = { ...choice, scope: Object.defineProperty({ ...scope }, 'siteId', { get: getter }) };
  for (const input of [ownAccessor, inheritedAccessor, nestedAccessor]) {
    assert.deepEqual(resolveGrowerFieldNoteLink([row], context, input), { status: 'held', reason: 'invalid-selection' });
  }
  assert.equal(getterCalls, 0);
});
