import assert from 'node:assert/strict';
import test from 'node:test';
import { createSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import {
  addGrowerUtcDays, isGrowerRecordedAt, isGrowerUtcDate, normaliseGrowerInput,
  type GrowerInput, type GrowerInputProvenance, type GrowerPlanningInputs,
  type GrowerPlanningProfile, type GrowerPlanningScope,
} from '../lib/international/grower-planning.ts';
import {
  generateGrowerAutoPlan, isGrowerAutoPlanCurrent, GROWER_AUTOPLAN_MAX_HORIZON_DAYS,
  type GrowerAutoPlanBed, type GrowerAutoPlanDemand, type GrowerAutoPlanRequest,
  type GrowerBedAvailability, type GrowerBedReservation, type GrowerWindowInput,
} from '../lib/international/grower-autoplan.ts';

// All dates, dimensions and production figures below are synthetic engineering fixtures.
const requestedAt = '2026-11-04T12:00:00.000Z';
const scope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' };
const other: GrowerPlanningScope = { kind: 'unmapped-workspace', workspaceId: 'design:other' };
const provenance: GrowerInputProvenance = { kind: 'grower-record', recordedAt: requestedAt, reference: 'synthetic grower assertion' };
const missing = { state: 'missing', reason: 'not-known' } as const;
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit, provenance });
const window = (start: string, endExclusive: string): GrowerWindowInput => own({ start, endExclusive }, 'utc-date-window');
function profile(inputs: Partial<GrowerPlanningInputs> = {}): GrowerPlanningProfile {
  return { version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: missing, fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12, 1, 2], 'utc-months'), ...inputs } };
}
function bed(id = 'block-a', areaM2 = 3): GrowerAutoPlanBed {
  return { scope, bed: { id, label: id, areaM2, minDimM: 1, kind: id === 'block-a' ? 'plot' : 'bed' }, measuredAreaM2: own(areaM2, 'm2') };
}
function availability(bedId = 'block-a', start = '2027-12-28', endExclusive = '2028-01-03'): GrowerBedAvailability {
  return { bedId, scope, window: window(start, endExclusive) };
}
function demand(demandId = 'buyer-a', totalKg = 8, start = '2027-12-30', endExclusive = '2028-01-03'): GrowerAutoPlanDemand {
  return { demandId, profileId: 'own-profile', scope, totalKg: own(totalKg, 'kg-total'), harvestWindow: window(start, endExclusive) };
}
function request(values: Partial<GrowerAutoPlanRequest> = {}): GrowerAutoPlanRequest {
  return { requestedAt, scope, geometryFingerprint: 'synthetic-geometry-revision-1', profiles: [profile()],
    beds: [bed(), bed('bed-z', 2)], planningStart: own('2027-12-28', 'utc-date'), planningEndExclusive: own('2028-02-01', 'utc-date'),
    availability: [availability(), availability('bed-z')], reserved: [], demands: [demand()], maxAssessments: 1000, ...values };
}
function proposal(input: unknown = request()) {
  const result = generateGrowerAutoPlan(input);
  assert.ok(result.status === 'ready' || result.status === 'with-gaps', JSON.stringify(result));
  if (result.status !== 'ready' && result.status !== 'with-gaps') throw new Error('Held result');
  return result;
}
const intervals = (result: ReturnType<typeof proposal>) => result.cycles.map(cycle => ({
  bedId: cycle.bedId, entry: cycle.assessment.schedule.fieldEntryDate, released: cycle.assessment.schedule.nextFieldEntryDate,
}));

test('whole measured beds and field plots supply their own total cycle capacity with explicit excess', () => {
  const input = request(), before = JSON.stringify(input), result = proposal(input);
  assert.equal(result.status, 'ready');
  assert.deepEqual(intervals(result), [{ bedId: 'bed-z', entry: '2027-12-28', released: '2028-01-02' },
    { bedId: 'block-a', entry: '2027-12-28', released: '2028-01-02' }]);
  assert.deepEqual(result.demandResults, [{ demandId: 'buyer-a', profileId: 'own-profile', status: 'capacity-covered',
    requestedKg: 8, estimatedAllocatedKg: 10, unmetKg: 0, excessEstimatedKg: 2, reasons: [] }]);
  assert.deepEqual(result.cycles.map(cycle => cycle.assessment.capacity.measuredAreaM2), [2, 3]);
  assert.equal(JSON.stringify(input), before, 'proposal generation cannot resize saved beds or edit assertions');
  assert.equal(result.basis, 'grower-input-cycle-capacity');
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(result.cycles[0].assessment.snapshot.fieldEntryDate.state, 'provided');
  const entry = result.cycles[0].assessment.snapshot.fieldEntryDate;
  if (entry.state === 'provided') {
    assert.equal(entry.provenance.kind, 'grower-estimate');
    assert.match(entry.provenance.kind === 'grower-estimate' ? entry.provenance.note! : '', /Automatically selected/);
  }
});

test('demand order sets priority and capacity cannot be counted again for the next buyer', () => {
  const input = request({ beds: [bed()], availability: [availability()], demands: [demand('first', 6), demand('second', 6)] });
  const result = proposal(input);
  assert.equal(result.status, 'with-gaps');
  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0].demandId, 'first');
  assert.deepEqual(result.demandResults.map(row => [row.demandId, row.estimatedAllocatedKg, row.unmetKg]), [['first', 6, 0], ['second', 0, 6]]);
  const reversed = proposal({ ...input, demands: [...input.demands].reverse() });
  assert.equal(reversed.cycles[0].demandId, 'second');
  assert.notEqual(reversed.fingerprint, result.fingerprint);
});

test('buyers linked to different own profiles for one crop keep their distinct yields and timings', () => {
  const second = { ...profile({ yieldKgPerM2: own(1, 'kg/m2/cycle'), fieldEntryToFirstHarvestDays: own(0, 'days'),
    pickingDays: own(1, 'days'), fieldOccupancyDays: own(1, 'days'), turnaroundDays: own(0, 'days') }), profileId: 'second-profile' };
  const result = proposal(request({ profiles: [profile(), second], beds: [bed()], availability: [availability()],
    demands: [demand('first', 6), { ...demand('second', 3, '2028-01-02', '2028-01-03'), profileId: second.profileId }] }));
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.cycles.map(cycle => [cycle.profileId, cycle.assessment.capacity.estimatedYieldKg,
    cycle.assessment.schedule.fieldEntryDate, cycle.assessment.schedule.firstHarvestDate]),
  [['own-profile', 6, '2027-12-28', '2027-12-30'], ['second-profile', 3, '2028-01-02', '2028-01-02']]);
});

test('repeated cycles use separate explicitly available intervals without filling an unavailable gap', () => {
  const result = proposal(request({ beds: [bed()], availability: [availability('block-a', '2027-12-28', '2028-01-02'),
    availability('block-a', '2028-01-10', '2028-01-15')], demands: [demand('long-window', 12, '2027-12-30', '2028-01-15')] }));
  assert.deepEqual(intervals(result), [{ bedId: 'block-a', entry: '2027-12-28', released: '2028-01-02' },
    { bedId: 'block-a', entry: '2028-01-10', released: '2028-01-15' }]);
  assert.equal(result.demandResults[0].unmetKg, 0);
});

test('exact reservations block overlapping cycles but half-open adjacent reservations do not', () => {
  const reserved = (start: string, end: string): GrowerBedReservation => ({ id: 'existing-occupation', ...availability('block-a', start, end) });
  const base = request({ beds: [bed()], availability: [availability()], demands: [demand('buyer', 6)] });
  const blocked = proposal({ ...base, reserved: [reserved('2027-12-30', '2027-12-31')] });
  assert.equal(blocked.cycles.length, 0);
  assert.equal(blocked.demandResults[0].unmetKg, 6);
  assert.ok(blocked.demandResults[0].reasons.includes('reserved-interval'));
  for (const row of [reserved('2027-12-25', '2027-12-28'), reserved('2028-01-02', '2028-01-03')]) {
    assert.equal(proposal({ ...base, reserved: [row] }).cycles.length, 1);
  }
});

test('the whole picking interval and field turnaround must fit, without prorating yield into a narrow window', () => {
  const base = request({ beds: [bed()], demands: [demand('buyer', 6)] });
  const shortAvailability = proposal({ ...base, availability: [availability('block-a', '2027-12-28', '2028-01-01')] });
  assert.equal(shortAvailability.cycles.length, 0);
  assert.ok(shortAvailability.demandResults[0].reasons.includes('availability-or-horizon'));
  const shortHarvest = proposal({ ...base, availability: [availability()], demands: [demand('buyer', 6, '2027-12-30', '2027-12-31')] });
  assert.equal(shortHarvest.cycles.length, 0);
  assert.ok(shortHarvest.demandResults[0].reasons.includes('harvest-window'));
  const shifted = proposal({ ...base, availability: [availability()], demands: [demand('buyer', 6, '2027-12-31', '2028-01-03')] });
  assert.equal(shifted.cycles[0].assessment.schedule.fieldEntryDate, '2027-12-29');
  assert.equal(shifted.cycles[0].assessment.schedule.harvestEndExclusiveDate, '2028-01-02');
});

test('nursery start stays inside the planning horizon and the grower’s own entry months remain binding', () => {
  const base = request({ beds: [bed()], profiles: [profile({ establishment: own('transplant', 'method'), nurseryDays: own(4, 'days') })],
    availability: [availability('block-a', '2027-12-28', '2028-01-20')], demands: [demand('buyer', 6, '2027-12-30', '2028-01-20')] });
  const transplant = proposal(base);
  assert.equal(transplant.cycles[0].assessment.schedule.fieldEntryDate, '2028-01-01');
  assert.equal(transplant.cycles[0].assessment.schedule.nurseryStartDate, '2027-12-28');
  const january = proposal({ ...base, profiles: [profile({ allowedEntryMonths: own([1], 'utc-months') })] });
  assert.equal(january.cycles[0].assessment.schedule.fieldEntryDate, '2028-01-01');
  const excluded = proposal({ ...base, profiles: [profile({ allowedEntryMonths: own([], 'utc-months') })] });
  assert.equal(excluded.cycles.length, 0);
  assert.ok(excluded.demandResults[0].reasons.includes('own-entry-month-window'));
});

test('leap-day and year-crossing schedules come from the shared grower date authority', () => {
  const leap = proposal(request({ beds: [bed()], planningStart: own('2028-02-27', 'utc-date'), planningEndExclusive: own('2028-03-10', 'utc-date'),
    availability: [availability('block-a', '2028-02-27', '2028-03-10')], demands: [demand('leap', 6, '2028-02-29', '2028-03-05')] }));
  assert.equal(leap.cycles[0].assessment.schedule.firstHarvestDate, '2028-02-29');
  assert.equal(leap.cycles[0].assessment.schedule.harvestEndExclusiveDate, '2028-03-02');
  assert.equal(leap.cycles[0].assessment.schedule.nextFieldEntryDate, '2028-03-03');
  const year = proposal();
  assert.equal(year.cycles[0].assessment.schedule.harvestEndExclusiveDate, '2028-01-01');
});

test('no availability assertion never means an empty bed is free', () => {
  const result = proposal(request({ availability: [] }));
  assert.equal(result.status, 'with-gaps');
  assert.deepEqual(result.cycles, []);
  assert.equal(result.demandResults[0].unmetKg, 8);
  assert.ok(result.demandResults[0].reasons.includes('no-asserted-availability'));
});

test('unknown quantity, windows, measured area or own timings hold rather than inventing zero/defaults', () => {
  const cases = [request({ demands: [{ ...demand(), totalKg: missing }] }),
    request({ demands: [{ ...demand(), harvestWindow: missing }] }), request({ availability: [{ ...availability(), window: missing }] }),
    request({ reserved: [{ id: 'unknown-occupation', ...availability(), window: missing }] }),
    request({ beds: [{ ...bed(), measuredAreaM2: missing }], availability: [availability()] }), request({ profiles: [profile({ pickingDays: missing })] }),
    request({ planningStart: missing }), request({ planningEndExclusive: missing }), request({ beds: [], availability: [] })];
  for (const input of cases) {
    const result = generateGrowerAutoPlan(input);
    assert.equal(result.status, 'missing-inputs');
    assert.deepEqual(result.cycles, []);
    assert.equal(result.demandResults[0].estimatedAllocatedKg, null);
    assert.equal(result.demandResults[0].unmetKg, null);
  }
  const missingTotal = generateGrowerAutoPlan(cases[0]);
  assert.equal(missingTotal.demandResults[0].requestedKg, null);
});

test('provided zero demand needs no profile timing defaults, while zero yield/area/plant capacity give an honest gap', () => {
  const emptyInputs = Object.fromEntries(Object.keys(profile().inputs).map(key => [key, missing]));
  const empty = proposal({ ...request(), profiles: [{ ...profile(), inputs: emptyInputs }], beds: [], availability: [],
    demands: [{ ...demand(), totalKg: own(0, 'kg-total'), harvestWindow: missing }] });
  assert.equal(empty.status, 'ready'); assert.deepEqual(empty.cycles, []);
  assert.deepEqual(empty.demandResults[0], { demandId: 'buyer-a', profileId: 'own-profile', status: 'zero-demand',
    requestedKg: 0, estimatedAllocatedKg: 0, unmetKg: 0, excessEstimatedKg: 0, reasons: [] });
  for (const input of [request({ profiles: [profile({ yieldKgPerM2: own(0, 'kg/m2/cycle') })] }),
    request({ beds: [bed('block-a', 0)], availability: [availability()] }),
    request({ profiles: [profile({ plantsPerM2: own(0.1, 'plants/m2') })] })]) {
    const result = proposal(input);
    assert.equal(result.status, 'with-gaps'); assert.deepEqual(result.cycles, []);
    assert.equal(result.demandResults[0].unmetKg, 8);
    assert.ok(result.demandResults[0].reasons.includes('zero-estimated-cycle-capacity'));
  }
});

test('invalid provenance, dates and units or a changed measured-area claim cannot produce a partial usable proposal', () => {
  const raw = () => JSON.parse(JSON.stringify(request()));
  const cases = [() => { const r = raw(); r.demands[0].totalKg.provenance = null; return r; },
    () => { const r = raw(); r.demands[0].totalKg.unit = 'kg/week'; return r; },
    () => { const r = raw(); r.availability[0].window.value.start = '2027-02-29'; return r; },
    () => { const r = raw(); r.availability[0].window.provenance.reference = ''; return r; },
    () => { const r = raw(); r.reserved = [{ id: 'existing', ...r.availability[0], window: { ...r.availability[0].window, unit: 'months' } }]; return r; },
    () => { const r = raw(); r.beds[0].measuredAreaM2.value = 4; return r; },
    () => { const r = raw(); r.requestedAt = '2026-11-04'; return r; },
    () => { const r = raw(); r.demands[0].totalKg.value = NaN; return r; },
    () => { const r = raw(); r.profiles[0].inputs.pickingDays.value = 0; return r; }];
  for (const mutate of cases) {
    const result = generateGrowerAutoPlan(mutate());
    assert.equal(result.status, 'invalid-inputs'); assert.deepEqual(result.cycles, []);
  }
});

test('scope conflicts, ambiguous bed/demand/profile IDs and missing source identity cannot borrow another farm', () => {
  const base = request();
  for (const input of [request({ scope: other }), request({ beds: [{ ...bed(), scope: other }] }),
    request({ demands: [{ ...demand(), scope: other }] }), request({ availability: [{ ...availability(), scope: other }] }),
    request({ profiles: [{ ...profile(), scope: other }] }), request({ beds: [bed(), bed()] }),
    request({ demands: [demand(), demand()] }), request({ profiles: [profile(), profile()] }),
    request({ demands: [{ ...demand(), profileId: 'missing-profile' }] }),
    request({ availability: [availability('unknown-bed')] }), { ...base, geometryFingerprint: '' }]) {
    const result = generateGrowerAutoPlan(input);
    assert.equal(result.status, 'invalid-inputs'); assert.deepEqual(result.cycles, []);
  }
});

test('deterministic ties and canonical unordered input lists do not depend on original object/list order', () => {
  const input = request(), result = proposal(input);
  const reordered = { ...input, beds: [...input.beds].reverse(), availability: [...input.availability].reverse(),
    profiles: [profile({ allowedEntryMonths: own([2, 12, 1], 'utc-months') })] };
  const otherResult = proposal(Object.fromEntries(Object.entries(reordered).reverse()));
  assert.deepEqual(otherResult, result);
  assert.equal(isGrowerAutoPlanCurrent(result, reordered), true);
});

test('proposal and candidate snapshots are immutable copies that detect all acceptance-critical changes', () => {
  const raw = JSON.parse(JSON.stringify(request())), result = proposal(raw);
  raw.beds[0].bed.areaM2 = 999;
  raw.availability[0].window.value.endExclusive = '2028-01-31';
  raw.demands[0].harvestWindow.value.start = '2028-01-01';
  assert.equal(result.snapshot.beds.find(row => row.bed.id === 'block-a')!.bed.areaM2, 3);
  assert.equal(Reflect.set(result.snapshot.availability[0].window, 'state', 'missing'), false);
  assert.equal(Object.isFrozen(result.cycles[0].assessment.snapshot.profile.inputs), true);
  assert.equal(result.cycles[0].requestFingerprint, result.fingerprint);
  assert.notEqual(result.cycles[0].fingerprint, result.cycles[1].fingerprint);
  const changed = [request({ geometryFingerprint: 'same-area-moved-polygon' }),
    request({ beds: [{ ...bed(), bed: { ...bed().bed, minDimM: 2 } }, bed('bed-z', 2)] }),
    request({ profiles: [profile({ turnaroundDays: own(2, 'days') })] }), request({ demands: [demand('buyer-a', 9)] }),
    request({ availability: [availability('block-a', '2027-12-29'), availability('bed-z')] }),
    request({ reserved: [{ id: 'new-occupation', ...availability('block-a', '2027-12-28', '2028-01-02') }] }),
    request({ planningStart: own('2027-12-29', 'utc-date') }), request({ requestedAt: '2026-11-05T12:00:00.000Z' }),
    request({ beds: [{ ...bed(), measuredAreaM2: { state: 'provided', value: 3, unit: 'm2',
      provenance: { ...provenance, reference: 'another measurement record' } } }, bed('bed-z', 2)] })];
  for (const input of changed) assert.equal(isGrowerAutoPlanCurrent(result, input), false);
  assert.equal(isGrowerAutoPlanCurrent(generateGrowerAutoPlan(request({ planningStart: missing })), request()), false);
});

test('software work and horizon limits fail explicitly and never expose a truncated planting proposal', () => {
  const limited = generateGrowerAutoPlan(request({ maxAssessments: 9 }));
  assert.equal(limited.status, 'work-limit-exceeded'); assert.deepEqual(limited.cycles, []);
  assert.equal(limited.demandResults[0].estimatedAllocatedKg, null);
  // This budget allows one cycle, then expires while searching for its successor.
  // The caller must not mistake the discarded partial search for an accepted plan.
  const partial = generateGrowerAutoPlan(request({ beds: [bed()],
    availability: [availability('block-a', '2027-12-28', '2028-01-20')],
    demands: [demand('two-cycles', 12, '2027-12-30', '2028-01-20')], maxAssessments: 8 }));
  assert.equal(partial.status, 'work-limit-exceeded'); assert.deepEqual(partial.cycles, []);
  assert.equal(partial.evaluationsUsed, 8);
  assert.equal(partial.demandResults[0].estimatedAllocatedKg, null);
  const sufficient = proposal(request({ beds: [bed()],
    availability: [availability('block-a', '2027-12-28', '2028-01-20')],
    demands: [demand('two-cycles', 12, '2027-12-30', '2028-01-20')], maxAssessments: 9 }));
  assert.equal(sufficient.cycles.length, 2);
  const long = generateGrowerAutoPlan(request({ planningEndExclusive: own('2040-01-01', 'utc-date') }));
  assert.equal(long.status, 'work-limit-exceeded'); assert.deepEqual(long.cycles, []);
  assert.ok(GROWER_AUTOPLAN_MAX_HORIZON_DAYS > 0);
  for (const maxAssessments of [undefined, 0, -1, 1.5, Infinity, 10001]) {
    assert.equal(generateGrowerAutoPlan({ ...request(), maxAssessments }).status, 'invalid-inputs');
  }
});

test('capacity overflow and out-of-range arithmetic cannot return Infinity or rollover dates', () => {
  const overflow = generateGrowerAutoPlan(request({ profiles: [profile({ yieldKgPerM2: own(Number.MAX_VALUE, 'kg/m2/cycle') })] }));
  assert.equal(overflow.status, 'invalid-inputs'); assert.deepEqual(overflow.cycles, []);
  const dateOverflow = generateGrowerAutoPlan(request({ profiles: [profile({ fieldOccupancyDays: own(Number.MAX_SAFE_INTEGER, 'days') })] }));
  assert.equal(dateOverflow.status, 'invalid-inputs'); assert.deepEqual(dateOverflow.cycles, []);
});

test('catalogue agronomy cannot affect automatic proposals or fill a missing grower value', () => {
  const crop = CROPS[0], original = Object.getOwnPropertyDescriptors(crop), before = proposal();
  try {
    for (const key of Object.keys(crop).filter(key => key !== 'key')) Object.defineProperty(crop, key, {
      configurable: true, get() { throw new Error(`Automatic grower planning must not read catalogue ${key}`); },
    });
    assert.deepEqual(proposal(), before);
    const missingDuration = generateGrowerAutoPlan(request({ profiles: [profile({ fieldOccupancyDays: missing })] }));
    assert.equal(missingDuration.status, 'missing-inputs'); assert.deepEqual(missingDuration.cycles, []);
  } finally { Object.defineProperties(crop, original); }
});

test('new shared public validators reject invalid arguments without weakening earlier grower input semantics', () => {
  assert.equal(isGrowerRecordedAt(requestedAt), true);
  assert.equal(isGrowerRecordedAt('2026-02-30T12:00:00.000Z'), false);
  assert.equal(isGrowerUtcDate('2028-02-29'), true);
  assert.equal(isGrowerUtcDate('2027-02-29'), false);
  assert.equal(addGrowerUtcDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addGrowerUtcDays('2028-01-01', -1), '2027-12-31');
  assert.equal(addGrowerUtcDays('2028-02-30', 1), null);
  assert.equal(addGrowerUtcDays('2028-01-01', 0.5), null);
  assert.equal(addGrowerUtcDays('9999-12-31', 1), null);
  assert.equal(normaliseGrowerInput({ ...own(0, 'kg-total'), provenance: null }, 'kg-total', (v): v is number => typeof v === 'number'), null);
});


test('direct domain planning cannot accept a complete saved provisional receipt as current sowing authority', () => {
  const original = profile(), req = { profileId: 'provisional-preview', cropKey: original.cropKey,
    context: { scope, countryCode: 'ZA', agriculturalRegionReference: null, establishment: 'direct' as const, waterRegime: 'irrigated' as const },
    recordedAt: requestedAt, asOf: requestedAt.slice(0, 10), candidates: [], overrides: original.inputs,
    measuredAreaM2: own(3, 'm2'), fieldEntryDate: own('2027-12-28', 'utc-date') };
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: 'site:0.00000,0.00000', sourceKey: 'studio-canvas:site:0.00000,0.00000',
    resourceSiteId: 'site:0.00000,0.00000', scope, geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64),
    freshness: 'device-saved-copy', sourceVerification: 'not-verified', beds: [bed().bed],
    measuredAreas: [{ bedId: 'block-a', areaM2: 3, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
  const saved = createSavedProvisionalProfile(req, 'own-profile', '2026-11-04T12:01:00.000Z', source, 'block-a', 'block-a'); assert.ok(saved);
  const result = generateGrowerAutoPlan(request({ profiles: [saved] }));
  assert.equal(result.status, 'missing-inputs');
  if (result.status === 'missing-inputs') assert.ok(result.issues.some(issue => issue.includes('saved-provisional-context-needs-review')));
  assert.equal(generateGrowerAutoPlan(request()).status, 'ready', 'Unmarked legacy planning remains available.');
});
