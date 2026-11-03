import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest, type GrowerAutoPlanCycle } from '../lib/international/grower-autoplan.ts';
import { assessGrowerPlanning, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import {
  createGrowerCyclePlanting, hasGrowerCycleMarker, normaliseGrowerCycleAttachment, preserveGrowerCycleMarker,
  resolvePlantingBasis, type GrowerCycleContext,
} from '../lib/international/grower-cycle.ts';

const recordedAt = '2026-11-02T21:00:00.000Z';
const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
const bed = { id: 'fixture-bed', label: 'Synthetic measured fixture', areaM2: 12 };
const options = { plantingId: 'persistent-fixture-row', acceptedAt: recordedAt, geometryFingerprint: 'fixture-geometry:1' };
const context: GrowerCycleContext = { scope, beds: [bed], geometryFingerprint: options.geometryFingerprint };
function provided<T, U extends string>(value: T, unit: U): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } };
}
function fixture(method: 'direct' | 'transplant' = 'transplant', window = { month: 2, start: '2028-02-29', endExclusive: '2028-03-02' }) {
  // Synthetic arithmetic fixtures deliberately oppose the catalogue method;
  // a matching catalogue date/flag must not accidentally make this test pass.
  const crop = CROPS.find(crop => Boolean(crop.transplant) !== (method === 'transplant'))!;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'fixture-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: provided(4, 'plants/m2'), yieldKgPerM2: provided(1, 'kg/m2/cycle'),
    establishment: provided(method, 'method'), nurseryDays: method === 'transplant' ? provided(10, 'days') : { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: provided(1, 'days'), pickingDays: provided(2, 'days'),
    fieldOccupancyDays: provided(3, 'days'), turnaroundDays: provided(1, 'days'), allowedEntryMonths: provided([window.month], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: recordedAt, scope, geometryFingerprint: options.geometryFingerprint,
    profiles: [profile], beds: [{ bed, scope, measuredAreaM2: provided(12, 'm2') }],
    planningStart: provided('2027-12-01', 'utc-date'), planningEndExclusive: provided('2028-04-01', 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: provided({ start: '2027-12-01', endExclusive: '2028-04-01' }, 'utc-date-window') }], reserved: [],
    demands: [{ demandId: 'fixture-total-demand', profileId: profile.profileId, scope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: window.start, endExclusive: window.endExclusive }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const cycle = structuredClone(proposal.cycles[0]);
  const row = createGrowerCyclePlanting(cycle, options); assert.ok(row);
  return { row, cycle, profile, request };
}

test('an engine cycle becomes one canonical whole-bed dated row with the shared leap-day schedule', () => {
  const { row } = fixture();
  assert.equal(row.id, options.plantingId); assert.equal(row.areaFraction, 1);
  assert.equal(row.sowMonth, 2); assert.equal(row.once, '2028-02');
  for (const flag of ['existing', 'inNursery', 'confirmedOnceSowing', 'finishedOnceSowing', 'awaitingSowingConfirmation']) assert.equal(flag in row, false);
  assert.equal('schedule' in row.growerCycle, false); assert.equal('capacity' in row.growerCycle, false);
  const resolved = resolvePlantingBasis(row, context); assert.equal(resolved.kind, 'grower-dated-cycle');
  if (resolved.kind !== 'grower-dated-cycle') return;
  assert.deepEqual(resolved.reservation, { start: '2028-02-28', endExclusive: '2028-03-03' });
  assert.equal(resolved.assessment.schedule.nurseryStartDate, '2028-02-18');
  assert.equal(resolved.assessment.schedule.firstHarvestDate, '2028-02-29');
  assert.equal(resolved.assessment.capacity.estimatedPlantCount, 48);
  assert.equal(resolved.assessment.sourceVerification, 'not-verified');
});

test('persistent identities are supplied independently of review-local ordinal cycles', () => {
  const { cycle, row } = fixture();
  const second = createGrowerCyclePlanting(cycle, { ...options, plantingId: 'another-persistent-row' }); assert.ok(second);
  assert.notEqual(second.id, row.id); assert.equal(second.growerCycle.cycleId, row.growerCycle.cycleId);
  assert.equal(second.growerCycle.demandId, cycle.demandId);
  assert.equal(resolvePlantingBasis({ ...row, id: second.id }, context).kind, 'held');
});

test('compatibility sowing identity follows the own nursery date across New Year and altered accepted inputs stay held', () => {
  const { row } = fixture('transplant', { month: 1, start: '2028-01-05', endExclusive: '2028-01-07' });
  assert.equal(row.sowMonth, 12); assert.equal(row.once, '2027-12');
  const resolved = resolvePlantingBasis(row, context); assert.equal(resolved.kind, 'grower-dated-cycle');
  if (resolved.kind === 'grower-dated-cycle') {
    assert.equal(resolved.assessment.schedule.nurseryStartDate, '2027-12-25');
    assert.equal(resolved.assessment.schedule.fieldEntryDate, '2028-01-04');
  }
  const altered = structuredClone(row);
  (altered.growerCycle.assessmentSnapshot.profile.inputs.fieldOccupancyDays as { state: 'provided'; value: number }).value = 30;
  assert.equal(resolvePlantingBasis(altered, context).kind, 'held');
  assert.equal(normaliseGrowerCycleAttachment(altered.growerCycle), null);
});

test('creation rejects forged engine outputs, stale fingerprints, mismatched identity and invalid metadata', () => {
  const { cycle } = fixture();
  const changes = [
    { ...cycle, cropKey: 'unknown-fixture-crop' }, { ...cycle, profileId: 'wrong-profile' },
    { ...cycle, scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' } },
    { ...cycle, assessment: { ...cycle.assessment, fingerprint: 'stale' } },
    { ...cycle, assessment: { ...cycle.assessment, capacity: { ...cycle.assessment.capacity, estimatedYieldKg: 999 } } },
    { ...cycle, assessment: { ...cycle.assessment, schedule: { ...cycle.assessment.schedule, firstHarvestDate: '2028-01-01' } } },
  ];
  for (const changed of changes) assert.equal(createGrowerCyclePlanting(changed as GrowerAutoPlanCycle, options), null);
  for (const changed of [{ ...options, acceptedAt: '2026-11-02' }, { ...options, plantingId: '' }, { ...options, geometryFingerprint: '' }]) assert.equal(createGrowerCyclePlanting(cycle, changed), null);
});

test('only truly absent markers are legacy; malformed, null and unknown-version markers remain held after storage', () => {
  assert.equal(resolvePlantingBasis({ id: 'legacy' }).kind, 'legacy');
  for (const marker of [undefined, null, false, '', {}, { kind: 'grower-dated-cycle', version: 2 }]) {
    const raw = { id: 'own-record', growerCycle: marker };
    assert.equal(hasGrowerCycleMarker(raw), true); assert.equal(resolvePlantingBasis(raw, context).kind, 'held');
    const stored = JSON.parse(JSON.stringify({ ...raw, ...preserveGrowerCycleMarker(raw) }));
    assert.equal(hasGrowerCycleMarker(stored), true); assert.equal(resolvePlantingBasis(stored, context).kind, 'held');
  }
  assert.deepEqual(preserveGrowerCycleMarker({ id: 'legacy' }), {});
  for (const raw of [null, [], 1, 'invalid']) assert.equal(resolvePlantingBasis(raw).kind, 'held');
});

test('unserialisable and inherited markers cannot disappear into a legacy catalogue row', () => {
  const circular: Record<string, unknown> = {}; circular.self = circular;
  for (const marker of [() => undefined, Symbol('invalid'), BigInt(1), circular, { value: undefined }, { value: Number.NaN }]) {
    const stored = JSON.parse(JSON.stringify(preserveGrowerCycleMarker({ growerCycle: marker })));
    assert.equal(hasGrowerCycleMarker(stored), true); assert.equal(resolvePlantingBasis(stored).kind, 'held');
  }
  const inherited = Object.assign(Object.create({ growerCycle: undefined }), { id: 'inherited-fixture' });
  const stored = JSON.parse(JSON.stringify({ ...inherited, ...preserveGrowerCycleMarker(inherited) }));
  assert.equal(resolvePlantingBasis(stored).kind, 'held');
  const getter = Object.defineProperty({}, 'growerCycle', { get() { throw Error('unreadable marker'); } });
  assert.equal(resolvePlantingBasis(getter).kind, 'held');
});

test('accepted snapshots detach and freeze their inputs while later profile edits or deletion do not retime them', () => {
  const { row, cycle, profile, request } = fixture();
  const before = JSON.stringify(row);
  (cycle.assessment.snapshot.profile.inputs.fieldEntryToFirstHarvestDays as { state: 'provided'; value: number }).value = 700;
  (profile.inputs.fieldEntryToFirstHarvestDays as { state: 'provided'; value: number }).value = 800;
  (request.profiles as GrowerPlanningProfile[]).splice(0);
  assert.equal(JSON.stringify(row), before); assert.ok(Object.isFrozen(row)); assert.ok(Object.isFrozen(row.growerCycle.assessmentSnapshot.profile.inputs));
  assert.throws(() => { (row.growerCycle.assessmentSnapshot.profile.inputs.fieldEntryToFirstHarvestDays as { state: 'provided'; value: number }).value = 900; });
  const resolved = resolvePlantingBasis(row, context); assert.equal(resolved.kind, 'grower-dated-cycle');
  if (resolved.kind === 'grower-dated-cycle') assert.equal(resolved.assessment.schedule.firstHarvestDate, '2028-02-29');
});

test('JSON roundtrip preserves basis, provenance and one-time identity without annual recurrence or lifecycle mutation', () => {
  const { row } = fixture(); const roundtrip = JSON.parse(JSON.stringify({ ...row, ...preserveGrowerCycleMarker(row) }));
  const before = JSON.stringify(roundtrip), resolved = resolvePlantingBasis(roundtrip, context);
  assert.equal(resolved.kind, 'grower-dated-cycle'); assert.equal(JSON.stringify(roundtrip), before);
  assert.deepEqual(normaliseGrowerCycleAttachment(roundtrip.growerCycle), row.growerCycle);
  if (resolved.kind === 'grower-dated-cycle') {
    assert.equal(resolved.assessment.schedule.fieldEntryDate, '2028-02-28');
    assert.equal(resolved.attachment.assessmentSnapshot.fieldEntryDate.state, 'provided');
    assert.equal('recursAnnually' in resolved, false);
  }
});

test('operational use requires current matching scope, measured area and saved geometry even if the area stays equal', () => {
  const { row } = fixture();
  for (const changed of [undefined, null, { ...context, geometryFingerprint: null },
    { ...context, geometryFingerprint: 'same-area-moved-polygon' },
    { ...context, scope: { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } },
    { ...context, beds: [] }, { ...context, beds: [bed, { ...bed }] },
    { ...context, beds: [{ ...bed, areaM2: 13 }] }]) {
    assert.equal(resolvePlantingBasis(row, changed as GrowerCycleContext | undefined | null).kind, 'held');
  }
  assert.ok(normaliseGrowerCycleAttachment(row.growerCycle), 'an archived raw attachment remains readable without live approval');
});

test('row compatibility changes and legacy lifecycle flags never reinterpret grower cycles as catalogue or observed sowings', () => {
  const { row } = fixture();
  const changes = [{ id: 'wrong' }, { bedId: 'wrong' }, { cropKey: 'wrong' }, { sowMonth: 3 }, { once: '2029-02' },
    { areaFraction: undefined }, { areaFraction: 0.5 }, { existing: true }, { existing: false }, { inNursery: '2028-02' },
    { confirmedOnceSowing: '2028-02' }, { finishedOnceSowing: true }, { awaitingSowingConfirmation: true }];
  for (const change of changes) {
    const modified = { ...row, ...change }, before = JSON.stringify(modified);
    assert.equal(resolvePlantingBasis(modified, context).kind, 'held', JSON.stringify(change));
    assert.equal(JSON.stringify(modified), before);
  }
});

test('direct establishment ignores the catalogue transplant flag and retains explicitly entered zero yield', () => {
  const { cycle } = fixture('direct');
  const old = structuredClone(cycle.assessment.snapshot);
  const snapshot = { ...old, profile: { ...old.profile, inputs: { ...old.profile.inputs, yieldKgPerM2: provided(0, 'kg/m2/cycle') } } };
  const assessed = assessGrowerPlanning(snapshot); assert.equal(assessed.status, 'ready');
  if (assessed.status !== 'ready') return;
  const row = createGrowerCyclePlanting({ ...cycle, assessment: assessed }, options); assert.ok(row);
  assert.equal(row.once, '2028-02');
  const resolved = resolvePlantingBasis(row, context); assert.equal(resolved.kind, 'grower-dated-cycle');
  if (resolved.kind === 'grower-dated-cycle') {
    assert.equal(resolved.assessment.schedule.nurseryStartDate, null); assert.equal(resolved.assessment.capacity.estimatedYieldKg, 0);
  }
});
