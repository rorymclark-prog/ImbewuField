import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest } from '../lib/international/provisional-crop-planning.ts';
import { worldvegKenyaCowpeaCandidates } from '../lib/international/providers/worldveg-kenya-cowpea.ts';
import { assessGrowerPlanning, assessProvisionalGrowerPlanning, normaliseGrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { growerSpacingSourceQuantities } from '../lib/grower-estimate-units.ts';
import { buildProvisionalCropPreviewHtml } from '../lib/international/provisional-crop-export.ts';
import { createSavedProvisionalProfile, readSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { usdaGreatLakesCabbageCandidates, USDA_CABBAGE_SPACING_VERSION, USDA_CABBAGE_SPACING } from '../lib/international/providers/usda-great-lakes-cabbage.ts';

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

function usdaRequest(): ProvisionalDraftRequest {
  const original = request();
  const ctx = { ...context, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: 'transplant' as const };
  return { ...original, cropKey: 'cabbage', context: ctx,
    // Synthetic completeness input; the guide supplies no chosen nursery duration.
    overrides: { ...original.overrides, nurseryDays: supplied(10, 'days') },
    candidates: usdaGreatLakesCabbageCandidates(ctx, 'cabbage', recordedAt, true),
    countBasis: { ...original.countBasis!, purpose: 'cabbage-transplants', habit: 'not-applicable', rowCm: '76.2', inRowCm: '45.72', finalStand: '' } };
}

test('undated Great Lakes transplant spacing supports a conditional count without inventing stand, local currency or yield', () => {
  const r = usdaRequest();
  const result = resolved({ ...r, overrides: {} });
  assert.equal(result.fields.establishment.activeTier, 'climate-crop-derived');
  assert.equal(result.fields.establishment.sourceBindings[0].evidenceState, 'undated');
  assert.equal(result.fields.establishment.sourceBindings[0].publishedOn, null);
  assert.equal(result.assessment.budgetedStations.value, 29);
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.assessment.estimatedYieldKg.value, null);
  assert.equal(result.profile.inputs.nurseryDays.state, 'missing');
  assert.equal(result.profile.plantCountOrigin?.referenceVersion, USDA_CABBAGE_SPACING_VERSION);
  assert.equal(result.activeEstablishment, 'transplant');
  assert.equal(resolved({ ...r, overrides: { establishment: supplied('transplant', 'method') } }).assessment.budgetedStations.value, 29,
    'An explicit matching transplant choice must remain usable with the opted-in historical reference.');
  for (const stand of ['0', '1', '2']) {
    const withStand = resolved({ ...r, countBasis: { ...r.countBasis!, finalStand: stand } });
    assert.equal(withStand.assessment.estimatedPlantCount.value, 29 * Number(stand));
    const reload = normaliseGrowerPlanningProfile(JSON.parse(JSON.stringify(withStand.profile))); assert.ok(reload);
    const complete = assessGrowerPlanning({ profile: reload, scope, measuredAreaM2: r.measuredAreaM2,
      fieldEntryDate: r.fieldEntryDate, countAreaBinding: { bedId: 'bed-1' } });
    assert.equal(complete.status, 'ready');
    if (complete.status === 'ready') assert.equal(complete.capacity.estimatedPlantCount, 29 * Number(stand));
  }
});

test('USDA source cannot leak to a different country, undeclared region, crop purpose or sowing method', () => {
  const r = usdaRequest();
  for (const countryCode of ['ZA', 'KE', 'CA', 'OTHER', null]) {
    assert.deepEqual(usdaGreatLakesCabbageCandidates({ ...r.context, countryCode }, 'cabbage', recordedAt, true), []);
    assert.equal(resolved({ ...r, context: { ...r.context, countryCode } }).assessment.estimatedPlantCount.value, null);
  }
  for (const agriculturalRegionReference of [null, 'Michigan', 'Central Kenya', 'US']) {
    assert.deepEqual(usdaGreatLakesCabbageCandidates({ ...r.context, agriculturalRegionReference }, 'cabbage', recordedAt, true), []);
    assert.equal(resolved({ ...r, context: { ...r.context, agriculturalRegionReference } }).assessment.budgetedStations.value, null);
  }
  for (const patch of [{ candidates: [] }, { overrides: { establishment: supplied('direct', 'method') } },
    { countBasis: { ...r.countBasis!, purpose: 'leaves' as const } },
    { countBasis: { ...r.countBasis!, wholeAreaConfirmed: false } }]) {
    assert.equal(resolved({ ...r, ...patch }).assessment.budgetedStations.value, null);
  }
  const origin = resolved(r).profile.plantCountOrigin!;
  for (const patch of [{ countryCode: 'KE' }, { regionReference: null }, { cropKey: 'cowpea' },
    { referenceVersion: 'worldveg-ke-24-1077-cowpea-spacing-v1' }, { purpose: 'leaves' }]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...resolved(r).profile, plantCountOrigin: { ...origin, ...patch } }), null);
  }
});

test('converted source endpoints preserve their original exact decimal range, and exports identify the right regional source', () => {
  const r = usdaRequest();
  assert.deepEqual(USDA_CABBAGE_SPACING.rowCm, [76.2, 76.2]);
  assert.deepEqual(USDA_CABBAGE_SPACING.inRowCm, [45.72, 60.96]);
  for (const inRowCm of ['45.72', '60.96']) {
    const chosen = { ...r, countBasis: { ...r.countBasis!, inRowCm, finalStand: '1' } };
    assert.equal(resolved(chosen).spacingSelection?.status, 'ready');
    const file = buildProvisionalCropPreviewHtml(chosen, { bedLabel: 'Synthetic Great Lakes bed', sample: true }); assert.ok(file);
    for (const value of ['18–24 inches', '30 inches', 'USDA', 'undated', 'public-domain', '76.2', inRowCm]) assert.ok(file.html.includes(value), value);
    assert.doesNotMatch(file.html, /2–3 seeds|World Vegetable|worldveg-ke/);
    assert.match(file.html, /The source adapter selects no point spacing/);
    assert.match(file.html, /Grower choices are recorded separately/);
    assert.doesNotMatch(file.html, /No point spacing or final surviving plants per station is selected/);
  }
  for (const patch of [{ rowCm: '76.20000000000000000001' }, { rowCm: '76.19999999999999999999' },
    { inRowCm: '45.71999999999999999999' }, { inRowCm: '60.96000000000000000001' }, { finalStand: '1.00000000000000000001' }]) {
    assert.equal(resolved({ ...r, countBasis: { ...r.countBasis!, ...patch } }).spacingSelection?.status, 'invalid-inputs');
  }
});

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
    candidates: worldvegKenyaCowpeaCandidates(context, 'cowpea', recordedAt, true, { purpose: 'leaves', habit: input.habit }) });
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

// Independently generated before candidate inspection. Area values follow the
// existing saved-number API; exact spacing and stand tokens are never rounded.
// The untouched raw oracle and conversion receipt remain in the source packet.
const usdaOracle = JSON.parse(readFileSync(new URL('./fixtures/usda-saved-number-fraction-oracle.json', import.meta.url), 'utf8'));
for (const c of usdaOracle.cases) test(`independent USDA saved-number Fraction oracle: ${c.id}`, () => {
  const r = usdaRequest(), input = c.canonicalInput, a = input.area;
  const measuredAreaM2 = !a ? { state: 'missing', reason: 'not-known' }
    : a.kind === 'rectangle-m' ? { ...supplied(Number(a.length) * Number(a.width), 'm2'),
      arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM: Number(a.length), heightM: Number(a.width) } }
    : supplied(Number(a.value), 'm2');
  const result = resolved({ ...r, measuredAreaM2, countBasis: { ...r.countBasis!,
    inRowCm: input.withinRowCm ?? '', finalStand: input.survivorsPerStation ?? '' } });
  assert.equal(result.assessment.estimatedPlantCount.value, c.mappedExpected.plantCount);
  assert.equal(result.assessment.budgetedStations.value,
    c.countComparisonPolicy.stationCountDiagnosticOnlyWhenStandInvalid ? null : c.mappedExpected.stationCount);
  if (c.mappedExpected.spacing === 'invalid' || c.mappedExpected.stand === 'invalid') {
    assert.equal(result.spacingSelection?.status, 'invalid-inputs');
  }
  if (result.profile.plantCountOrigin) {
    const reload = normaliseGrowerPlanningProfile(JSON.parse(JSON.stringify(result.profile))); assert.ok(reload);
    const after = assessProvisionalGrowerPlanning({ profile: reload, scope, measuredAreaM2, fieldEntryDate: r.fieldEntryDate,
      countAreaBinding: { bedId: 'bed-1' } });
    assert.deepEqual(after.estimatedPlantCount, result.assessment.estimatedPlantCount);
    assert.deepEqual(after.budgetedStations, result.assessment.budgetedStations);
  }
});


function profileSource(r: ProvisionalDraftRequest): GrowerWorkflowSource {
  return { status: 'ready', kind: 'studio-canvas', sourceId: scope.siteId, sourceKey: `studio-canvas:${scope.siteId}`,
    resourceSiteId: scope.siteId, scope: r.context.scope, geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64),
    freshness: 'device-saved-copy', sourceVerification: 'not-verified', beds: [{ id: 'bed-1', label: 'Synthetic bed', areaM2: 10.125 }],
    measuredAreas: [{ bedId: 'bed-1', areaM2: 10.125, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
}
function adopted(r = usdaRequest()) {
  const profile = createSavedProvisionalProfile(r, 'new-saved-profile', '2026-11-12T12:01:00.000Z', profileSource(r), 'bed-1', 'Synthetic bed');
  assert.ok(profile); return profile;
}
test('saved partial evidence rebinds identity without erasing undated source, overrides, missing fields or exact spacing', () => {
  const r = { ...usdaRequest(), overrides: { yieldKgPerM2: supplied(0, 'kg/m2/cycle') } };
  const profile = adopted(r), saved = readSavedProvisionalProfile(JSON.parse(JSON.stringify(profile))); assert.ok(saved);
  assert.equal(profile.profileId, 'new-saved-profile'); assert.equal(profile.plantCountOrigin!.profileId, profile.profileId);
  assert.equal(profile.plantCountOrigin!.rowCm, '76.2'); assert.equal(profile.plantCountOrigin!.inRowCm, '45.72');
  assert.equal(profile.plantCountOrigin!.finalStand, null); assert.equal(profile.inputs.plantsPerM2.state, 'missing');
  assert.equal(saved.result.fields.establishment.activeTier, 'climate-crop-derived');
  assert.equal(saved.result.fields.establishment.sourceBindings[0].evidenceState, 'undated');
  assert.equal(saved.result.fields.establishment.sourceBindings[0].publishedOn, null);
  assert.equal(saved.result.fields.yieldKgPerM2.activeTier, 'grower-estimate');
  assert.equal(saved.result.assessment.estimatedYieldKg.value, 0); assert.equal(saved.result.assessment.estimatedPlantCount.value, null);
  assert.equal(saved.origin.savedAt, '2026-11-12T12:01:00.000Z'); assert.equal(saved.request.asOf, '2026-11-12');
  assert.deepEqual(saved.request, r); assert.notEqual(saved.request.profileId, profile.profileId, 'Original preview identity is retained separately.');
});

test('a present broken saved-evidence receipt or modified retained profile cannot become a legacy planning profile', () => {
  const profile = adopted(), receipt = profile.provisionalOrigin!;
  const altered = JSON.parse(receipt.originalRequestJson); altered.context.agriculturalRegionReference = 'Other region';
  const changedLimits = JSON.parse(receipt.originalRequestJson); changedLimits.candidates[0].source.limitations = 'Changed evidence with the same numbers';
  for (const provisionalOrigin of [undefined, null, { ...receipt, version: 2 }, { ...receipt, profileId: 'other' },
    { ...receipt, savedAt: '2026-11-13T12:01:00.000Z' }, { ...receipt, bedId: 'other-bed' },
    { ...receipt, previewFingerprint: receipt.previewFingerprint + 'x' }, { ...receipt, originalRequestJson: JSON.stringify(altered) },
    { ...receipt, originalRequestJson: JSON.stringify(changedLimits) },
    { ...receipt, source: { ...receipt.source, sourceRevision: 'forged' } }, { ...receipt, extra: true }]) {
    assert.equal(normaliseGrowerPlanningProfile({ ...profile, provisionalOrigin }), null);
  }
  assert.equal(normaliseGrowerPlanningProfile({ ...profile, inputs: { ...profile.inputs, yieldKgPerM2: supplied(99, 'kg/m2/cycle') } }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...profile, plantCountOrigin: { ...profile.plantCountOrigin!, profileId: 'old-preview-id' } }), null);
  let gets = 0; const withGetter = { ...receipt };
  Object.defineProperty(withGetter, 'originalRequestJson', { enumerable: true, get() { gets++; return receipt.originalRequestJson; } });
  assert.equal(normaliseGrowerPlanningProfile({ ...profile, provisionalOrigin: withGetter }), null); assert.equal(gets, 0);
});

test('even a complete saved provisional profile is held out of legacy sowing approval until current source context is revalidated', () => {
  const r = usdaRequest(), profile = adopted({ ...r, countBasis: { ...r.countBasis!, finalStand: '1' } });
  const assessment = assessGrowerPlanning({ profile, scope, measuredAreaM2: r.measuredAreaM2,
    fieldEntryDate: r.fieldEntryDate, countAreaBinding: { bedId: 'bed-1' } });
  assert.equal(assessment.status, 'missing-inputs');
  if (assessment.status === 'missing-inputs') assert.ok(assessment.issues.includes('saved-provisional-context-needs-review'));
  const saved = readSavedProvisionalProfile(profile); assert.ok(saved); assert.equal(saved.result.assessment.estimatedPlantCount.value, 29);
  assert.equal(resolved(r).profile.provisionalOrigin, undefined, 'Ordinary live previews have no saved evidence marker.');
});

test('saving refuses stale days, invalid selections and source/measurement mismatches without manufacturing a missing value', () => {
  const r = usdaRequest(), src = profileSource(r);
  for (const [req, id, date, source, bed] of [
    [r, r.profileId, '2026-11-12T12:01:00.000Z', src, 'bed-1'],
    [r, 'new', '2026-11-13T12:01:00.000Z', src, 'bed-1'],
    [{ ...r, knownPlantingRestriction: true }, 'new', '2026-11-12T12:01:00.000Z', src, 'bed-1'],
    [{ ...r, countBasis: { ...r.countBasis!, inRowCm: '45.71999999999999999' } }, 'new', '2026-11-12T12:01:00.000Z', src, 'bed-1'],
    [{ ...r, overrides: { yieldKgPerM2: supplied(-1, 'kg/m2/cycle') } }, 'new', '2026-11-12T12:01:00.000Z', src, 'bed-1'],
    [r, 'new', '2026-11-12T12:01:00.000Z', { ...src, measuredAreas: [{ ...src.measuredAreas[0], areaM2: 9 }] }, 'bed-1'],
    [r, 'new', '2026-11-12T12:01:00.000Z', src, 'another-bed'],
  ] as const) assert.equal(createSavedProvisionalProfile(req, id, date, source, bed, 'Synthetic bed'), null);
});
