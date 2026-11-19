import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { resolvePlanningSupport } from '../lib/international/planning-support.ts';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest, type ProvisionalFieldCandidate } from '../lib/international/provisional-crop-planning.ts';
import type { CountrySource } from '../lib/international/countries/types.ts';
import {
  assessGrowerPlanning, assessProvisionalGrowerPlanning, isGrowerPlanningAssessmentCurrent, normaliseGrowerPlanningProfile,
  normaliseGrowerPlanningScope, normaliseGrowerPlanningProfiles, growerPlanningScopeKey, type GrowerInput, type GrowerInputProvenance,
  type GrowerPlanningInputs, type GrowerPlanningProfile, type GrowerPlanningRequest,
  type GrowerPlanningScope,
} from '../lib/international/grower-planning.ts';

// Engineering fixtures only: these numbers are not agronomic recommendations.
const recordedAt = '2026-11-03T12:00:00.000Z';
const estimate: GrowerInputProvenance = { kind: 'grower-estimate', recordedAt };
const observation: GrowerInputProvenance = { kind: 'grower-record', recordedAt, reference: 'synthetic-record-1' };
const external: GrowerInputProvenance = { kind: 'external-reference', recordedAt,
  reference: 'synthetic citation, table 1', sourceUrl: 'https://example.org/fixture' };
const missing = { state: 'missing', reason: 'not-known' } as const;
const workspace: GrowerPlanningScope = { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' };
const mapped: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' };

function provided<T, U extends string>(value: T, unit: U, provenance = estimate): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance };
}

function profile(inputs: Partial<GrowerPlanningInputs> = {}, scope = workspace): GrowerPlanningProfile {
  return { version: 1, profileId: 'synthetic-profile', cropKey: CROPS[0].key, scope,
    inputs: { plantsPerM2: provided(2.5, 'plants/m2'), yieldKgPerM2: provided(4, 'kg/m2/cycle'),
      establishment: provided('transplant', 'method'), nurseryDays: provided(4, 'days'),
      fieldEntryToFirstHarvestDays: provided(3, 'days'), pickingDays: provided(2, 'days'),
      fieldOccupancyDays: provided(8, 'days'), turnaroundDays: provided(1, 'days'),
      allowedEntryMonths: provided([2, 12], 'utc-months'), ...inputs } };
}

function request(overrides: Partial<GrowerPlanningRequest> = {}): GrowerPlanningRequest {
  return { profile: profile(), scope: workspace, measuredAreaM2: provided(10.5, 'm2', observation),
    fieldEntryDate: provided('2028-02-28', 'utc-date'), ...overrides };
}

function ready(input = request()) {
  const result = assessGrowerPlanning(input);
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') throw new Error(JSON.stringify(result));
  return result;
}

test('own density and yield use the measured area unchanged and round only the estimated plant count', () => {
  const input = request();
  const before = JSON.stringify(input);
  const result = ready(input);
  assert.deepEqual(result.capacity, { measuredAreaM2: 10.5, estimatedPlantCount: 26,
    estimatedYieldKg: 42, densityEstimateNotLayoutClearance: true });
  assert.equal(result.basis, 'grower-input-arithmetic');
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(JSON.stringify(input), before, 'assessment must never resize or rewrite its measured source');
});

test('own durations cross a leap day and year boundary using UTC half-open intervals', () => {
  const leap = ready();
  assert.deepEqual(leap.schedule, { fieldEntryDate: '2028-02-28', nurseryStartDate: '2028-02-24',
    firstHarvestDate: '2028-03-02', harvestEndExclusiveDate: '2028-03-04',
    fieldClearDate: '2028-03-07', nextFieldEntryDate: '2028-03-08' });
  const year = ready(request({ fieldEntryDate: provided('2027-12-30', 'utc-date') }));
  assert.deepEqual(year.schedule, { fieldEntryDate: '2027-12-30', nurseryStartDate: '2027-12-26',
    firstHarvestDate: '2028-01-02', harvestEndExclusiveDate: '2028-01-04',
    fieldClearDate: '2028-01-07', nextFieldEntryDate: '2028-01-08' });
  const leapDay = ready(request({ fieldEntryDate: provided('2028-02-29', 'utc-date'),
    profile: profile({ fieldEntryToFirstHarvestDays: provided(0, 'days') }) }));
  assert.equal(leapDay.schedule.firstHarvestDate, '2028-02-29');
});

test('direct establishment does not invent a nursery phase and transplant requires its own duration', () => {
  const direct = ready(request({ profile: profile({ establishment: provided('direct', 'method'), nurseryDays: missing }) }));
  assert.equal(direct.schedule.nurseryStartDate, null);
  const result = assessGrowerPlanning(request({ profile: profile({ nurseryDays: missing }) }));
  assert.equal(result.status, 'missing-inputs');
  if (result.status === 'missing-inputs') assert.deepEqual(result.issues, ['nurseryDays']);
  const sameDay = ready(request({ profile: profile({ nurseryDays: provided(0, 'days', observation) }) }));
  assert.equal(sameDay.schedule.nurseryStartDate, sameDay.schedule.fieldEntryDate);
});

test('missing own inputs remain missing instead of borrowing catalogue values or an all-year window', () => {
  const absent = Object.fromEntries(Object.keys(profile().inputs).map(key => [key, missing]));
  const result = assessGrowerPlanning(request({ profile: { ...profile(), inputs: absent }, measuredAreaM2: missing, fieldEntryDate: missing }));
  assert.equal(result.status, 'missing-inputs');
  if (result.status !== 'missing-inputs') return;
  assert.deepEqual(result.issues, ['plantsPerM2', 'yieldKgPerM2', 'establishment', 'fieldEntryToFirstHarvestDays',
    'pickingDays', 'fieldOccupancyDays', 'turnaroundDays', 'allowedEntryMonths', 'measuredAreaM2', 'fieldEntryDate']);
  assert.equal('capacity' in result, false);
  assert.equal('schedule' in result, false);
  for (const key of Object.keys(profile().inputs) as Array<keyof GrowerPlanningInputs>) {
    if (key === 'nurseryDays') continue;
    const held = assessGrowerPlanning(request({ profile: profile({ [key]: missing }) }));
    assert.equal(held.status, 'missing-inputs', key);
    if (held.status === 'missing-inputs') assert.ok(held.issues.includes(key));
  }
});

test('an explicitly empty or excluded entry window never silently expands to twelve months', () => {
  for (const window of [[], [1, 3]]) {
    const result = assessGrowerPlanning(request({ profile: profile({ allowedEntryMonths: provided(window, 'utc-months') }) }));
    assert.equal(result.status, 'entry-window-excluded');
    assert.equal('schedule' in result, false);
  }
  const unknown = assessGrowerPlanning(request({ profile: profile({ allowedEntryMonths: missing }) }));
  assert.equal(unknown.status, 'missing-inputs');
});

test('zero observations remain provided data and zero required density/durations are invalid rather than unknown', () => {
  const zeroYield = ready(request({ profile: profile({ yieldKgPerM2: provided(0, 'kg/m2/cycle', observation),
    fieldEntryToFirstHarvestDays: provided(0, 'days'), pickingDays: provided(1, 'days'),
    fieldOccupancyDays: provided(1, 'days'), turnaroundDays: provided(0, 'days') }) }));
  assert.equal(zeroYield.capacity.estimatedYieldKg, 0);
  assert.equal(zeroYield.schedule.firstHarvestDate, zeroYield.schedule.fieldEntryDate);
  assert.equal(zeroYield.schedule.fieldClearDate, zeroYield.schedule.nextFieldEntryDate);
  const zeroArea = ready(request({ measuredAreaM2: provided(0, 'm2', observation) }));
  assert.deepEqual(zeroArea.capacity, { measuredAreaM2: 0, estimatedPlantCount: 0,
    estimatedYieldKg: 0, densityEstimateNotLayoutClearance: true });
  for (const key of ['plantsPerM2', 'pickingDays', 'fieldOccupancyDays'] as const) {
    const input = profile({ [key]: provided(0, key === 'plantsPerM2' ? 'plants/m2' : 'days', observation) });
    const normalized = normaliseGrowerPlanningProfile(input)!;
    assert.equal(normalized.inputs[key].state, 'provided');
    const result = assessGrowerPlanning(request({ profile: input }));
    assert.equal(result.status, 'invalid-inputs', key);
    assert.ok(result.snapshot, 'the invalid assessment must retain the recorded zero for correction');
    if (result.status === 'invalid-inputs') assert.ok(result.issues.includes(key));
  }
});

test('every supplied value needs exact units and provenance; records and references need source detail', () => {
  for (const source of [estimate, observation, external]) {
    const result = ready(request({ profile: profile({ yieldKgPerM2: provided(4, 'kg/m2/cycle', source) }) }));
    assert.deepEqual(result.snapshot.profile.inputs.yieldKgPerM2, provided(4, 'kg/m2/cycle', source));
    assert.equal(result.sourceVerification, 'not-verified');
  }
  const badSources = [null, {}, { kind: 'grower-estimate' }, { kind: 'grower-estimate', recordedAt: '2026-02-30T12:00:00.000Z' },
    { kind: 'grower-estimate', recordedAt: '2026-11-03T12:00:00Z' }, { kind: 'grower-estimate', recordedAt: 'yesterday' },
    { kind: 'grower-record', recordedAt }, { kind: 'grower-record', recordedAt, reference: ' ' },
    { kind: 'external-reference', recordedAt, reference: 'citation' }, { ...external, sourceUrl: 'file:///private/source' },
    { ...external, sourceUrl: 'https://user:password@example.org/source' }, { ...estimate, kind: 'verified-local-agronomy' }];
  for (const provenance of badSources) {
    const input = { ...profile(), inputs: { ...profile().inputs, plantsPerM2: { state: 'provided', value: 2.5, unit: 'plants/m2', provenance } } };
    assert.equal(normaliseGrowerPlanningProfile(input), null, JSON.stringify(provenance));
  }
  const baseline = profile();
  for (const [field, wrongUnit] of [['plantsPerM2', 'plants/ha'], ['yieldKgPerM2', 't/ha'], ['nurseryDays', 'weeks'],
    ['establishment', 'days'], ['allowedEntryMonths', 'zero-based-months']] as const) {
    assert.equal(normaliseGrowerPlanningProfile({ ...baseline,
      inputs: { ...baseline.inputs, [field]: { ...baseline.inputs[field], unit: wrongUnit } } }), null, field);
  }
  assert.equal(assessGrowerPlanning(request({ measuredAreaM2: { ...provided(10, 'm2'), unit: 'hectares' } })).status, 'invalid-inputs');
  assert.equal(assessGrowerPlanning(request({ fieldEntryDate: { ...provided('2028-02-28', 'utc-date'), provenance: null } })).status, 'invalid-inputs');
});

test('malformed imports cannot turn invalid numbers, dates, windows or mixed missing values into defaults', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, '2.5', null]) {
    assert.equal(assessGrowerPlanning(request({ measuredAreaM2: provided(value, 'm2') })).status, 'invalid-inputs');
    assert.equal(normaliseGrowerPlanningProfile({ ...profile(),
      inputs: { ...profile().inputs, plantsPerM2: provided(value, 'plants/m2') } }), null);
  }
  for (const value of [0.5, -1, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...profile(),
      inputs: { ...profile().inputs, pickingDays: provided(value, 'days') } }), null);
  }
  for (const date of ['2027-02-29', '2028-02-30', '2028-2-28', '2028-02-28T12:00:00Z', '2028-02-28\n', '0000-01-01']) {
    assert.equal(assessGrowerPlanning(request({ fieldEntryDate: provided(date, 'utc-date') })).status, 'invalid-inputs', date);
  }
  for (const window of [[0], [13], [2, 2], [1.5], ['2'], [NaN]]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...profile(),
      inputs: { ...profile().inputs, allowedEntryMonths: provided(window, 'utc-months') } }), null);
  }
  assert.equal(normaliseGrowerPlanningProfile({ ...profile(), inputs: { ...profile().inputs, plantsPerM2: undefined } }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...profile(),
    inputs: { ...profile().inputs, yieldKgPerM2: { ...missing, value: 0 } } }), null);
});

test('field occupancy must contain the whole picking interval and overflow never becomes a forecast', () => {
  const inconsistent = assessGrowerPlanning(request({ profile: profile({ fieldOccupancyDays: provided(4, 'days') }) }));
  assert.equal(inconsistent.status, 'invalid-inputs');
  if (inconsistent.status === 'invalid-inputs') assert.ok(inconsistent.issues.includes('fieldOccupancyDays'));
  const overflowCases = [request({ measuredAreaM2: provided(Number.MAX_VALUE, 'm2') }),
    request({ profile: profile({ yieldKgPerM2: provided(Number.MAX_VALUE, 'kg/m2/cycle') }) }),
    request({ profile: profile({ fieldOccupancyDays: provided(Number.MAX_SAFE_INTEGER, 'days') }) }),
    request({ fieldEntryDate: provided('9999-12-31', 'utc-date') }),
    request({ profile: profile({ allowedEntryMonths: provided([1], 'utc-months') }), fieldEntryDate: provided('0001-01-01', 'utc-date') })];
  for (const input of overflowCases) {
    const result = assessGrowerPlanning(input);
    assert.equal(result.status, 'invalid-inputs');
    assert.equal('capacity' in result, false);
    assert.equal('schedule' in result, false);
  }
});

test('mapped sites, virtual beds and each saved design keep distinct exact profile scopes', () => {
  const scopes: GrowerPlanningScope[] = [workspace, mapped,
    { kind: 'mapped-site', siteId: 'site:0.00001,0.00000' },
    { kind: 'unmapped-workspace', workspaceId: 'design:local' },
    { kind: 'unmapped-workspace', workspaceId: 'design:Saved-1' }];
  for (const source of scopes) {
    for (const target of scopes) {
      const result = assessGrowerPlanning(request({ profile: profile({}, source), scope: target }));
      assert.equal(result.status, source === target ? 'ready' : 'scope-mismatch');
    }
  }
  for (const value of [{ kind: 'mapped-site', siteId: 'site:0,0' }, { kind: 'mapped-site', siteId: 'site:91.00000,0.00000' },
    { ...mapped, workspaceId: 'virtual-bed' }, { ...workspace, siteId: mapped.siteId },
    { kind: 'unmapped-workspace', workspaceId: mapped.siteId }, { kind: 'unmapped-workspace', workspaceId: 'design:x\n' },
    { kind: 'unmapped-workspace', workspaceId: 'design:../x' }, null]) {
    assert.equal(normaliseGrowerPlanningScope(value), null, JSON.stringify(value));
    assert.equal(assessGrowerPlanning(request({ scope: value })).status, 'invalid-inputs');
  }
});

test('ambiguous duplicate profile identities cannot silently choose a winner during account-plan parsing', () => {
  const first = profile();
  const other = { ...profile({}, mapped), profileId: 'distinct-profile' };
  const zero = { ...profile({ plantsPerM2: provided(0, 'plants/m2', observation) }), profileId: 'zero-observation' };
  for (const duplicate of [first, profile({}, mapped), { profileId: first.profileId, version: 'corrupt' }]) {
    assert.deepEqual(normaliseGrowerPlanningProfiles([first, duplicate, other, zero]), [other, zero]);
    assert.deepEqual(normaliseGrowerPlanningProfiles([duplicate, first, other, zero]), [other, zero]);
  }
  for (const value of [undefined, null, {}, [null, 'legacy', { profileId: 'no-inputs' }]]) {
    assert.deepEqual(normaliseGrowerPlanningProfiles(value), []);
  }
  assert.equal(growerPlanningScopeKey(mapped), 'mapped-site:site:0.00000,0.00000');
  assert.equal(growerPlanningScopeKey(workspace), 'unmapped-workspace:virtual-bed');
  assert.equal(growerPlanningScopeKey({ kind: 'unmapped-workspace', workspaceId: 'design:local' }), 'unmapped-workspace:design:local');
  assert.equal(growerPlanningScopeKey({ ...mapped, workspaceId: 'virtual-bed' }), null);
});

test('assessment snapshots are detached, deeply immutable and canonical for unordered months and object keys', () => {
  const raw = JSON.parse(JSON.stringify(request()));
  const result = ready(raw);
  raw.profile.inputs.plantsPerM2.value = 99;
  raw.profile.inputs.allowedEntryMonths.value.push(4);
  raw.measuredAreaM2.value = 1000;
  assert.equal(result.capacity.measuredAreaM2, 10.5);
  assert.deepEqual(result.snapshot.profile.inputs.allowedEntryMonths, provided([2, 12], 'utc-months'));
  assert.equal(Reflect.set(result.snapshot.profile.inputs.plantsPerM2, 'value', 99), false);
  assert.equal(Reflect.set(result.snapshot.measuredAreaM2, 'value', 1000), false);
  assert.equal(Object.isFrozen(result.snapshot.profile.inputs.allowedEntryMonths), true);
  const window = result.snapshot.profile.inputs.allowedEntryMonths;
  if (window.state === 'provided') assert.equal(Object.isFrozen(window.value), true);
  const reordered = profile({ allowedEntryMonths: provided([12, 2], 'utc-months') });
  const reverseKeys = Object.fromEntries(Object.entries(reordered).reverse());
  assert.equal(ready(request({ profile: reverseKeys })).fingerprint, result.fingerprint);
  assert.equal(isGrowerPlanningAssessmentCurrent(result, request({ profile: reverseKeys })), true);
});

test('editing an assumption, provenance, measured area, date or scope invalidates an open review', () => {
  const result = ready();
  const changes = [request({ profile: profile({ plantsPerM2: provided(3, 'plants/m2') }) }),
    request({ profile: profile({ yieldKgPerM2: provided(4, 'kg/m2/cycle', observation) }) }),
    request({ profile: profile({ yieldKgPerM2: provided(4, 'kg/m2/cycle', { ...observation, recordedAt: '2026-11-04T12:00:00.000Z' }) }) }),
    request({ profile: profile({ allowedEntryMonths: provided([2], 'utc-months') }) }),
    request({ measuredAreaM2: provided(10.6, 'm2', observation) }), request({ fieldEntryDate: provided('2028-02-29', 'utc-date') }),
    request({ profile: profile({}, mapped), scope: mapped }), request({ profile: profile({ yieldKgPerM2: missing }) })];
  for (const input of changes) assert.equal(isGrowerPlanningAssessmentCurrent(result, input), false);
  const held = assessGrowerPlanning(request({ profile: profile({ yieldKgPerM2: missing }) }));
  assert.equal(isGrowerPlanningAssessmentCurrent(held, request()), false);
});

test('catalogue agronomy cannot affect grower arithmetic and unknown crop identities cannot be introduced', () => {
  const crop = CROPS[0];
  const before = ready();
  const descriptors = Object.getOwnPropertyDescriptors(crop);
  try {
    for (const key of Object.keys(crop).filter(key => key !== 'key')) {
      Object.defineProperty(crop, key, { configurable: true, get() { throw new Error(`Catalogue ${key} must not be read`); } });
    }
    assert.deepEqual(ready(), before);
    const held = assessGrowerPlanning(request({ profile: profile({ fieldEntryToFirstHarvestDays: missing }) }));
    assert.equal(held.status, 'missing-inputs');
  } finally { Object.defineProperties(crop, descriptors); }
  assert.equal(normaliseGrowerPlanningProfile({ ...profile(), cropKey: 'not-an-existing-crop-id' }), null);
});

test('complete grower arithmetic and forged approval flags never change country-planning authority', () => {
  const policyInput = { places: [], siteId: mapped.siteId, workspaceId: 'virtual-bed' };
  const before = resolvePlanningSupport(policyInput);
  assert.equal(before.allowCataloguePlanning, false);
  const result = ready(request({ profile: { ...profile({}, mapped), localAgronomyApproved: true, countryCode: 'ZA',
    productionPlanSupported: true }, scope: { ...mapped, localAgronomyApproved: true } }));
  assert.equal('localAgronomyApproved' in result, false);
  assert.equal('countryCode' in result.snapshot.profile, false);
  assert.equal('productionPlanSupported' in result.snapshot.profile, false);
  assert.deepEqual(resolvePlanningSupport(policyInput), before);
});


test('a provisional date plan survives missing yield without inventing harvest kilograms', () => {
  const input = request({ profile: profile({ yieldKgPerM2: missing }) });
  const before = JSON.stringify(input);
  const result = assessProvisionalGrowerPlanning(input);
  assert.equal(result.status, 'partial-ready');
  assert.equal(result.estimatedYieldKg.status, 'missing-inputs');
  assert.equal(result.estimatedYieldKg.value, null);
  assert.equal(result.estimatedPlantCount.value, 26);
  assert.equal(result.schedule.firstHarvestDate.value, '2028-03-02');
  assert.equal(result.schedule.nextFieldEntryDate.value, '2028-03-08');
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(JSON.stringify(input), before);
  assert.equal(assessGrowerPlanning(input).status, 'missing-inputs', 'legacy callers retain their full-input contract');
});

test('missing density leaves a supported provisional yield and date calculation available', () => {
  const result = assessProvisionalGrowerPlanning(request({ profile: profile({ plantsPerM2: missing }) }));
  assert.equal(result.estimatedPlantCount.value, null);
  assert.deepEqual(result.estimatedPlantCount.issues, ['plantsPerM2']);
  assert.equal(result.estimatedYieldKg.value, 42);
  assert.equal(result.schedule.firstHarvestDate.value, '2028-03-02');
});

test('partial capacity does not require a fabricated crop duration or all-year window', () => {
  const inputs: Record<string, unknown> = Object.fromEntries(Object.keys(profile().inputs).map(key => [key, missing]));
  inputs.plantsPerM2 = provided(2.5, 'plants/m2');
  const result = assessProvisionalGrowerPlanning(request({ profile: { ...profile(), inputs } }));
  assert.equal(result.status, 'partial-ready');
  assert.equal(result.estimatedPlantCount.value, 26);
  assert.equal(result.estimatedYieldKg.value, null);
  assert.equal(result.schedule.firstHarvestDate.value, null);
  assert.equal(result.entryWindow, 'unknown');
  assert.deepEqual(result.snapshot?.profile.inputs.allowedEntryMonths, missing);
});

test('valid zero area and zero entered yield remain arithmetic zeros rather than missing values', () => {
  const zeroArea = assessProvisionalGrowerPlanning(request({ measuredAreaM2: provided(0, 'm2', observation) }));
  assert.equal(zeroArea.estimatedPlantCount.value, 0);
  assert.equal(zeroArea.estimatedYieldKg.value, 0);
  const zeroYield = assessProvisionalGrowerPlanning(request({ profile: profile({ yieldKgPerM2: provided(0, 'kg/m2/cycle') }) }));
  assert.equal(zeroYield.estimatedPlantCount.value, 26);
  assert.equal(zeroYield.estimatedYieldKg.value, 0);
  assert.equal(zeroYield.estimatedYieldKg.status, 'ready');
});

test('a chosen date with an unknown window stays conditional and an explicitly excluded date stays excluded', () => {
  const conditional = assessProvisionalGrowerPlanning(request({ profile: profile({ allowedEntryMonths: missing }) }));
  assert.equal(conditional.entryWindow, 'unknown');
  assert.equal(conditional.status, 'partial-ready');
  assert.ok(conditional.uncertainties.includes('entry-window-unknown'));
  assert.equal(conditional.schedule.firstHarvestDate.value, '2028-03-02', 'offset arithmetic is conditional, not a sowing recommendation');
  for (const months of [[], [1]]) {
    const excluded = assessProvisionalGrowerPlanning(request({ profile: profile({ allowedEntryMonths: provided(months, 'utc-months') }) }));
    assert.equal(excluded.entryWindow, 'excluded');
    assert.equal(excluded.schedule.firstHarvestDate.status, 'excluded');
    assert.equal(excluded.schedule.firstHarvestDate.value, null);
    assert.equal(excluded.estimatedPlantCount.value, 26);
  }
});

test('missing turnaround holds only the next entry while known contradictory occupancy is rejected', () => {
  const partial = assessProvisionalGrowerPlanning(request({ profile: profile({ turnaroundDays: missing }) }));
  assert.equal(partial.schedule.fieldClearDate.value, '2028-03-07');
  assert.equal(partial.schedule.nextFieldEntryDate.value, null);
  const contradiction = assessProvisionalGrowerPlanning(request({ profile: profile({ fieldOccupancyDays: provided(4, 'days') }) }));
  assert.equal(contradiction.schedule.fieldClearDate.status, 'invalid-inputs');
  assert.equal(contradiction.schedule.nextFieldEntryDate.value, null);
  assert.equal(contradiction.estimatedPlantCount.value, 26);
});

test('scope mismatches and malformed provided values cannot produce partial planning outputs', () => {
  const mismatch = assessProvisionalGrowerPlanning(request({ scope: mapped }));
  assert.equal(mismatch.status, 'scope-mismatch');
  assert.equal(mismatch.estimatedPlantCount.value, null);
  assert.equal(mismatch.schedule.firstHarvestDate.value, null);
  const malformed = assessProvisionalGrowerPlanning(request({ profile: profile({ yieldKgPerM2: provided(-1, 'kg/m2/cycle') }) }));
  assert.equal(malformed.status, 'invalid-inputs');
  assert.equal(malformed.snapshot, null);
  assert.equal(malformed.estimatedPlantCount.value, null);
});

test('provisional snapshots and outputs are immutable and keep direct establishment free of invented nursery dates', () => {
  const result = assessProvisionalGrowerPlanning(request({ profile: profile({ establishment: provided('direct', 'method'), nurseryDays: missing }) }));
  assert.equal(result.schedule.nurseryStartDate.status, 'not-applicable');
  assert.equal(result.schedule.nurseryStartDate.value, null);
  assert.equal(result.status, 'ready');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.schedule));
  assert.ok(Object.isFrozen(result.snapshot?.profile.inputs));
});


// Synthetic source metadata and values below exercise contracts, never regional farming advice.
const provisionalSource: CountrySource = {
  id: 'engineering-fixture', category: 'agricultural-extension', authority: 'Engineering fixture',
  title: 'Synthetic evidence, not application data', url: 'https://example.org/fixture', coverage: 'Synthetic scope',
  resolution: { status: 'unknown', reason: 'Synthetic fixture' }, units: { status: 'known', value: 'Explicit fixture units' },
  updateCadence: { status: 'unknown', reason: 'Synthetic fixture' },
  licence: { status: 'known', value: 'Synthetic reuse fixture; no real rights assertion' },
  attribution: 'Engineering fixture', accessRequirements: { status: 'known', value: 'Synthetic only' },
  missingDataBehavior: 'Unknown', verification: 'content-read', accessedOn: '2026-11-03',
  publishedOn: '2026-01-01', reviewDueOn: '2027-01-01', verifiedClaim: 'Synthetic values only', limitations: 'Not for application use',
};

function provisionalCandidate(id: string, input: unknown = provided(2.5, 'plants/m2', external),
  changes: Partial<ProvisionalFieldCandidate> = {}): ProvisionalFieldCandidate {
  return { id, field: 'plantsPerM2', input, tier: 'local-public-evidence', cropKey: CROPS[0].key,
    geography: { kind: 'country', countryCode: 'KE' }, establishment: 'any', waterRegime: 'any',
    temporalScope: { kind: 'recurring-season' }, source: provisionalSource, reuseReview: 'reviewed', assumptions: [], ...changes };
}
function provisionalRequest(candidates: ProvisionalFieldCandidate[], changes: Partial<ProvisionalDraftRequest> = {}): ProvisionalDraftRequest {
  return { profileId: 'synthetic-provisional', cropKey: CROPS[0].key, context: { scope: mapped, countryCode: 'KE',
    agriculturalRegionReference: null, establishment: 'transplant', waterRegime: 'irrigated' },
    recordedAt, asOf: '2026-11-10', candidates, measuredAreaM2: provided(10.5, 'm2', observation),
    fieldEntryDate: provided('2028-02-28', 'utc-date'), ...changes };
}
function resolvedDraft(input: ProvisionalDraftRequest) {
  const result = resolveProvisionalCropPlan(input);
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') throw new Error('Expected resolved provisional draft');
  return result;
}

test('applicable local defaults outrank labelled transfers without certifying a provisional draft', () => {
  const local = provisionalCandidate('local');
  const transfer = provisionalCandidate('transfer', provided(3, 'plants/m2', external), { tier: 'climate-crop-derived',
    geography: { kind: 'explicit-transfer', assumption: 'Synthetic transfer, not local evidence' }, assumptions: ['Synthetic uncertainty'] });
  const result = resolvedDraft(provisionalRequest([transfer, local]));
  assert.equal(result.fields.plantsPerM2.activeTier, 'local-public-evidence');
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.countryOrRegionApproval, false);
  assert.equal(result.knownPlantLegalityEstablished, false);
  assert.equal(result.sourceVerification, 'not-verified');
  assert.equal(result.densityEstimateNotLayoutClearance, true);
});

test('a deliberate grower override is used while the original source default remains available', () => {
  const result = resolvedDraft(provisionalRequest([provisionalCandidate('local')], {
    overrides: { plantsPerM2: provided(5, 'plants/m2', external) },
  }));
  const field = result.fields.plantsPerM2;
  assert.equal(field.status, 'overridden');
  assert.equal(field.activeInput.state, 'provided');
  if (field.activeInput.state === 'provided') assert.equal(field.activeInput.provenance.kind, 'grower-estimate');
  assert.equal(field.baselineDefault?.state, 'provided');
  if (field.baselineDefault?.state === 'provided') assert.equal(field.baselineDefault.value, 2.5);
  assert.equal(result.assessment.estimatedPlantCount.value, 52);
  assert.deepEqual(field.sourceReferences, ['https://example.org/fixture']);
});

test('invalid grower edits never silently restore the automatic default', () => {
  const result = resolvedDraft(provisionalRequest([provisionalCandidate('local')], {
    overrides: { plantsPerM2: provided(Number.NaN, 'plants/m2') },
  }));
  assert.equal(result.fields.plantsPerM2.status, 'invalid-override');
  assert.equal(result.fields.plantsPerM2.baselineDefault?.state, 'provided');
  assert.equal(result.assessment.estimatedPlantCount.value, null);
});

test('equal-priority evidence conflicts are visible and independent of source array order', () => {
  const candidates = [provisionalCandidate('a'), provisionalCandidate('b', provided(3.5, 'plants/m2', external))];
  const result = resolvedDraft(provisionalRequest(candidates));
  const reversed = resolvedDraft(provisionalRequest([...candidates].reverse()));
  assert.equal(result.fields.plantsPerM2.status, 'conflict');
  assert.equal(result.fields.plantsPerM2.defaultConflict, true);
  assert.equal(result.fields.plantsPerM2.defaultOptions.length, 2);
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.fingerprint, reversed.fingerprint);
});

test('country, region, method, water and variety mismatches cannot populate automatic defaults', () => {
  const candidates = [
    provisionalCandidate('country', undefined, { geography: { kind: 'country', countryCode: 'GB' } }),
    provisionalCandidate('region', undefined, { geography: { kind: 'region', countryCode: 'KE', regionReference: 'different-region' } }),
    provisionalCandidate('method', undefined, { establishment: 'direct' }),
    provisionalCandidate('water', undefined, { waterRegime: 'rain-fed' }),
    provisionalCandidate('variety', undefined, { varietyReference: 'synthetic-variety-reference' }),
  ];
  const result = resolvedDraft(provisionalRequest(candidates));
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.rejected.length, 5);
  assert.ok(result.rejected.every(value => value.reason === 'scope-mismatch'));
});

test('stale sources and unreviewed reuse stay out of automatic defaults', () => {
  for (const source of [{ ...provisionalSource, reviewDueOn: '2026-01-02' }, { ...provisionalSource, publishedOn: null }]) {
    const result = resolvedDraft(provisionalRequest([provisionalCandidate('local', undefined, { source })]));
    assert.equal(result.assessment.estimatedPlantCount.value, null);
    assert.equal(result.rejected[0].reason, 'source-or-reuse-unverified');
  }
  const result = resolvedDraft(provisionalRequest([provisionalCandidate('local', undefined, { reuseReview: 'not-reviewed' })]));
  assert.equal(result.rejected[0].reason, 'source-or-reuse-unverified');
});

test('exclusion-only climate evidence cannot manufacture an all-year planting window', () => {
  const result = resolvedDraft(provisionalRequest([provisionalCandidate('window', provided([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'utc-months', external), {
    field: 'allowedEntryMonths', tier: 'climate-crop-derived', assumptions: ['Synthetic heat exclusion only'], positiveWindowEvidence: false,
  })]));
  assert.equal(result.profile.inputs.allowedEntryMonths.state, 'missing');
  assert.equal(result.rejected[0].reason, 'positive-window-evidence-missing');
});

test('known planting restrictions cannot be cleared by a grower override', () => {
  const input = provisionalRequest([provisionalCandidate('local')], { knownPlantingRestriction: true,
    overrides: { plantsPerM2: provided(5, 'plants/m2') } });
  const before = JSON.stringify(input);
  const result = resolveProvisionalCropPlan(input);
  assert.equal(result.status, 'restricted');
  assert.equal(result.profile, null);
  assert.equal(JSON.stringify(input), before);
});

test('country dossiers are not a blanket gate for clearly labelled grower-derived provisional arithmetic', () => {
  for (const countryCode of ['KE', 'GB', 'US', 'BR', 'OTHER', 'IN', 'CA']) {
    const candidate = provisionalCandidate('grower', provided(2.5, 'plants/m2'), { tier: 'grower-estimate', source: undefined,
      geography: { kind: 'explicit-transfer', assumption: 'Synthetic grower estimate; local suitability unknown' } });
    const input = provisionalRequest([candidate]);
    const result = resolvedDraft({ ...input, context: { ...input.context, countryCode } });
    assert.equal(result.assessment.estimatedPlantCount.value, 26);
    assert.equal(result.fields.plantsPerM2.activeTier, 'grower-estimate');
    assert.equal(result.countryOrRegionApproval, false);
  }
});

test('dated evidence and historical transfers retain their actual applicability limits', () => {
  const result = resolvedDraft(provisionalRequest([provisionalCandidate('dated', undefined, {
    temporalScope: { kind: 'dated', fromDate: '2026-01-01', throughDate: '2027-01-01' },
  })]));
  assert.equal(result.rejected[0].reason, 'time-scope-mismatch');
  const historical = resolvedDraft(provisionalRequest([provisionalCandidate('historical', undefined, {
    temporalScope: { kind: 'historical-transfer', period: 'Synthetic historical period', assumption: 'Synthetic transfer' },
  })]));
  assert.equal(historical.rejected[0].reason, 'historical-transfer-unjustified');
});

test('reported ranges remain visible and unsupported endpoint selection is rejected', () => {
  const range = [2, 4] as const;
  const candidate = provisionalCandidate('range', provided(2, 'plants/m2', external), { reportedRange: range, planningValueBasis: 'lower-bound' });
  const result = resolvedDraft(provisionalRequest([candidate]));
  assert.deepEqual(result.fields.plantsPerM2.defaultReportedRange, [2, 4]);
  assert.equal(result.assessment.estimatedPlantCount.value, 21);
  assert.equal(Object.isFrozen(range), false, 'freezing a draft must not mutate caller-owned evidence');
  const invalid = resolvedDraft(provisionalRequest([{ ...candidate, input: provided(2.5, 'plants/m2', external) }]));
  assert.equal(invalid.rejected[0].reason, 'range-or-selection-mismatch');
});

test('source metadata changes invalidate a provisional fingerprint even when the arithmetic value stays the same', () => {
  const first = resolvedDraft(provisionalRequest([provisionalCandidate('local')]));
  const second = resolvedDraft(provisionalRequest([provisionalCandidate('local', undefined, {
    source: { ...provisionalSource, publishedOn: '2026-01-02' },
  })]));
  assert.equal(first.assessment.estimatedPlantCount.value, second.assessment.estimatedPlantCount.value);
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(Object.isFrozen(first.fields.plantsPerM2.sourceBindings), true);
});


test('historical or undated evidence can inform a disclosed estimate without inventing a publication date', () => {
  const candidate = provisionalCandidate('historical-estimate', undefined, { tier: 'climate-crop-derived',
    geography: { kind: 'explicit-transfer', assumption: 'Synthetic transfer, not current local evidence' },
    temporalScope: { kind: 'historical-transfer', period: 'Undated synthetic reference', assumption: 'Applicability remains uncertain' },
    assumptions: ['Synthetic estimate from an undated source'], source: { ...provisionalSource, publishedOn: null } });
  const result = resolvedDraft(provisionalRequest([candidate]));
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.fields.plantsPerM2.activeTier, 'climate-crop-derived');
  assert.equal(result.fields.plantsPerM2.sourceBindings[0].publishedOn, null);
  assert.equal(result.fields.plantsPerM2.sourceBindings[0].evidenceState, 'undated');
  assert.ok(result.fields.plantsPerM2.assumptions.includes('Applicability remains uncertain'));
  const future = resolvedDraft(provisionalRequest([{ ...candidate, source: { ...provisionalSource, accessedOn: '2027-01-01' } }]));
  assert.equal(future.assessment.estimatedPlantCount.value, null);
});
