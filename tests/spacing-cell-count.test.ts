import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest } from '../lib/international/provisional-crop-planning.ts';
import { worldvegKenyaCowpeaCandidates } from '../lib/international/providers/worldveg-kenya-cowpea.ts';
import { assessGrowerPlanning, assessProvisionalGrowerPlanning, normaliseGrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { growerSpacingSourceQuantities } from '../lib/grower-estimate-units.ts';
import { buildProvisionalCropPreviewHtml } from '../lib/international/provisional-crop-export.ts';

const recordedAt = '2026-11-12T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const context = { scope, countryCode: 'KE', agriculturalRegionReference: null, establishment: 'direct' as const, waterRegime: null };
const supplied = (value: unknown, unit: string) => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } });
function request(): ProvisionalDraftRequest {
  return { profileId: 'synthetic-spacing', cropKey: 'cowpea', context, recordedAt, asOf: '2026-11-12',
    candidates: worldvegKenyaCowpeaCandidates(context, 'cowpea', recordedAt, true, { purpose: 'leaves', habit: 'spreading' }),
    measuredAreaM2: supplied(10.125, 'm2'), fieldEntryDate: supplied('2026-11-12', 'utc-date'),
    // Synthetic completeness inputs, never agronomic defaults.
    overrides: { yieldKgPerM2: supplied(0, 'kg/m2/cycle'), fieldEntryToFirstHarvestDays: supplied(1, 'days'),
      pickingDays: supplied(1, 'days'), fieldOccupancyDays: supplied(2, 'days'), turnaroundDays: supplied(0, 'days'),
      allowedEntryMonths: supplied([11], 'utc-months') },
    countBasis: { kind: 'spacing-cell-budget-v1', bedId: 'bed-1', purpose: 'leaves', habit: 'spreading', rowCm: '75', inRowCm: '75', finalStand: '1',
      interpretationConfirmed: true, wholeAreaConfirmed: true } };
}
function resolved(r = request()) { const result = resolveProvisionalCropPlan(r); assert.equal(result.status, 'resolved'); return result; }

// Independently generated Python Fraction expectations. Keep original decimal
// tokens: converting them here would make the boundary checks unable to fail.
const oracle = JSON.parse(readFileSync(new URL('./fixtures/spacing-cell-fraction-oracle.json', import.meta.url), 'utf8'));
for (const c of oracle.cases) test(`independent spacing oracle: ${c.id}`, () => {
  const r = request(), input = c.input, a = input.area;
  const area = a.kind === 'saved-rectangle-metres-v1' ? { ...supplied(a.savedAreaNumber, 'm2'),
    arithmeticBasis: { kind: a.kind, widthM: Number(a.widthMDecimal), heightM: Number(a.heightMDecimal) } }
    : a.valueDecimal === null ? { state: 'missing', reason: 'not-known' } : supplied(Number(a.valueDecimal), 'm2');
  const basis = { ...r.countBasis!, habit: input.habit, rowCm: input.rowCmDecimal ?? '', inRowCm: input.inRowCmDecimal ?? '', finalStand: input.finalStandDecimal ?? '' };
  const result = resolved({ ...r, measuredAreaM2: area, countBasis: basis,
    candidates: worldvegKenyaCowpeaCandidates(context, 'cowpea', recordedAt, true, basis) });
  for (const [actual, expected] of [[result.assessment.budgetedStations, c.expected.stations], [result.assessment.estimatedPlantCount, c.expected.plants]]) {
    assert.equal(actual.value, expected.value);
    assert.equal(actual.status, expected.state === 'held' ? 'invalid-inputs' : expected.state);
  }
  if (result.profile.plantCountOrigin) {
    const complete = assessGrowerPlanning({ profile: result.profile, scope, measuredAreaM2: area, fieldEntryDate: r.fieldEntryDate, countAreaBinding: { bedId: 'bed-1' } });
    if (c.expected.plants.state === 'ready') { assert.equal(complete.status, 'ready'); assert.equal(complete.capacity.estimatedPlantCount, c.expected.plants.value); }
    const reloaded = normaliseGrowerPlanningProfile(JSON.parse(JSON.stringify(result.profile))); assert.ok(reloaded);
    const after = assessProvisionalGrowerPlanning({ profile: reloaded, scope, measuredAreaM2: area, fieldEntryDate: r.fieldEntryDate, countAreaBinding: { bedId: 'bed-1' } });
    assert.deepEqual(after.estimatedPlantCount, result.assessment.estimatedPlantCount);
    assert.equal(after.fingerprint, result.assessment.fingerprint);
  }
});

test('spacing origin is required, bound to the bed and measured rectangle, and cannot become rounded density', () => {
  const r = request(), result = resolved(r), profile = result.profile;
  assert.equal(result.assessment.estimatedPlantCount.value, 18);
  assert.equal(profile.inputs.plantsPerM2.state, 'missing');
  const origin = profile.plantCountOrigin!; assert.ok(growerSpacingSourceQuantities(origin));
  assert.equal(growerSpacingSourceQuantities({ ...origin }), null);
  for (const patch of [{ countAreaBinding: undefined }, { countAreaBinding: { bedId: 'bed-2' } }, { measuredAreaM2: supplied(10, 'm2') }]) {
    const after = assessProvisionalGrowerPlanning({ profile, scope, measuredAreaM2: r.measuredAreaM2, fieldEntryDate: r.fieldEntryDate, countAreaBinding: { bedId: 'bed-1' }, ...patch });
    assert.equal(after.estimatedPlantCount.value, null);
  }
  for (const patch of [{ profileId: 'other' }, { cropKey: 'cabbage' }, { plantCountOrigin: undefined },
    { plantCountOrigin: { ...origin, rowCm: '50.00000000000000000001', habit: 'erect-or-semi-erect' } },
    { plantCountOrigin: { ...origin, referenceVersion: 'forged' } },
    { inputs: { ...profile.inputs, plantsPerM2: supplied(1.7777777777777777, 'plants/m2') } }]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...profile, ...patch }), null);
  }
  const { countBasis: _, ...manual } = r;
  const legacy = resolved({ ...manual, overrides: { ...manual.overrides, plantsPerM2: supplied(1.7777777777777777, 'plants/m2') } });
  assert.equal(legacy.assessment.estimatedPlantCount.value, 17);
});

test('spacing never bypasses applicability, declarations, restrictions or hidden manual defaults', () => {
  const r = request();
  for (const patch of [{ candidates: [] }, { context: { ...context, countryCode: 'ZA' } },
    { overrides: { ...r.overrides, establishment: supplied('transplant', 'method'), plantsPerM2: supplied(100, 'plants/m2') } },
    { countBasis: { ...r.countBasis!, wholeAreaConfirmed: false } }, { countBasis: { ...r.countBasis!, interpretationConfirmed: false } },
    { countBasis: { ...r.countBasis!, purpose: 'pods-or-grain' as const } }]) {
    const result = resolved({ ...r, ...patch }); assert.equal(result.assessment.estimatedPlantCount.value, null);
    assert.equal(result.assessment.estimatedYieldKg.value, 0, 'independent supported results remain useful');
  }
  assert.equal(resolveProvisionalCropPlan({ ...r, knownPlantingRestriction: true }).status, 'restricted');
  let gets = 0; const origin = { ...resolved().profile.plantCountOrigin! };
  Object.defineProperty(origin, 'rowCm', { enumerable: true, get() { gets++; return '75'; } });
  assert.equal(normaliseGrowerPlanningProfile({ ...resolved().profile, plantCountOrigin: origin }), null); assert.equal(gets, 0);
});

test('export carries original choices, source, formula and unknown stand without private authority', () => {
  const r = request(), left = resolved(r), changed = resolved({ ...r, countBasis: { ...r.countBasis!, rowCm: '74.99999999999999999999' } });
  assert.notEqual(left.fingerprint, changed.fingerprint);
  for (const finalStand of ['', '0', '2']) {
    const file = buildProvisionalCropPreviewHtml({ ...r, countBasis: { ...r.countBasis!, finalStand } }, { bedLabel: 'Chosen bed', sample: true }); assert.ok(file);
    for (const text of ['Conditional spacing-cell estimate', '75', '50–75', 'World Vegetable', 'CC BY-SA', 'whole budgeted stations', 'not a sourced density', 'seeds per hill']) assert.ok(file.html.includes(text), text);
    assert.doesNotMatch(file.html, /site:0\.00000|scopeKey|areaBasisKey|sourceRevision/);
    assert.ok(file.html.includes(finalStand === '' ? 'Unknown' : `station:</strong> ${finalStand}`));
  }
});


test('malformed present area origins remain invalid rather than becoming ordinary missing spacing inputs', () => {
  const r = request();
  for (const finalStand of ['0', '1']) for (const candidates of [r.candidates, []]) {
    const result = resolved({ ...r, candidates, countBasis: { ...r.countBasis!, finalStand },
      measuredAreaM2: { ...supplied(10.125, 'm2'), arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM: 2, heightM: 3 } } });
    assert.equal(result.spacingSelection?.status, 'invalid-inputs');
    assert.equal(result.assessment.estimatedPlantCount.status, 'invalid-inputs');
    assert.equal(result.assessment.estimatedPlantCount.value, null);
    assert.equal(result.assessment.budgetedStations.status, 'invalid-inputs');
  }
});
