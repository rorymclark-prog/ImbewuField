import { saskatchewanCabbageNurseryCandidates, saskatchewanNurseryFactReuse, saskatchewanNurseryResultQualifier, USASK_CABBAGE_ORIGINAL_SHA256 } from '../lib/international/providers/usask-saskatchewan-cabbage.ts';
import { canadaCabbageCandidates, canadaCabbageFactReuse, AAFC_CANADA_CABBAGE_SOURCE, AAFC_CABBAGE_PDF_SHA256, AAFC_CABBAGE_QUALIFIER } from '../lib/international/providers/aafc-canada-cabbage.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CROPS } from '../lib/crop-catalog.ts';
import { sourceEvidenceState, sourcePublicationIsKnownBy, sourcePublicationText, evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';
import { WORLDVEG_KENYA_CABBAGE_SOURCE, worldvegKenyaCabbageCandidates } from '../lib/international/providers/worldveg-kenya-cabbage.ts';
import { worldvegKenyaCowpeaCandidates, worldvegKenyaCowpeaSpacing } from '../lib/international/providers/worldveg-kenya-cowpea.ts';
import { usdaGreatLakesCabbageCandidates } from '../lib/international/providers/usda-great-lakes-cabbage.ts';
import { usdaGreatLakesTomatoCandidates, usdaGreatLakesTomatoReference, USDA_TOMATO_NURSERY } from '../lib/international/providers/usda-great-lakes-tomato.ts';
import { southeastMissouriOatsCandidates, southeastMissouriOatsReference, MISSOURI_OATS_PDF_SHA256, USDA_SOUTHEAST_MISSOURI_OATS_SOURCE } from '../lib/international/providers/usda-southeast-missouri-oats.ts';
import { worldvegKenyaTomatoCandidates, WORLDVEG_TOMATO_NURSERY } from '../lib/international/providers/worldveg-kenya-tomato.ts';
import { buildProvisionalCropPreviewHtml, provisionalFieldCanUseMissingRow, provisionalLabels } from '../lib/international/provisional-crop-export.ts';
import { normaliseGrowerPlanningProfile, assessGrowerPlanning } from '../lib/international/grower-planning.ts';
import { createSavedProvisionalProfile, readSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import { createProvisionalCycleContext, reviewProvisionalCycleProfile } from '../lib/international/provisional-profile.ts';
import { syntheticTemperatureEvidence, syntheticTemperatureInput } from './fixtures/provisional-temperature.ts';
import { provisionalTemperatureEvidenceKey } from '../lib/international/provisional-temperature.ts';
import { resolvePlantingBasis } from '../lib/international/grower-cycle.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import type { CountrySource } from '../lib/international/countries/types.ts';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest, type ProvisionalFieldCandidate } from '../lib/international/provisional-crop-planning.ts';

// Software fixtures, not source research, farming defaults, or recommendations.
const recordedAt = '2026-11-10T12:00:00.000Z';
const source: CountrySource = {
  id: 'synthetic-source', category: 'agricultural-extension', authority: 'Engineering fixture',
  title: 'Synthetic test table', url: 'https://example.invalid/test-table', coverage: 'Synthetic scope only',
  resolution: { status: 'unknown', reason: 'fixture' }, units: { status: 'unknown', reason: 'fixture' },
  updateCadence: { status: 'unknown', reason: 'fixture' },
  licence: { status: 'known', value: 'Synthetic test permission, not an actual licence' }, attribution: 'Fixture',
  accessRequirements: { status: 'unknown', reason: 'fixture' }, missingDataBehavior: 'Unknown',
  verification: 'content-read', accessedOn: '2026-11-10', publishedOn: '2026-01-01', reviewDueOn: '2027-01-01',
  verifiedClaim: 'No real-world claim', limitations: 'Engineering fixture only',
};
const values = {
  establishment: ['direct', 'method'], plantsPerM2: [2.5, 'plants/m2'], yieldKgPerM2: [4, 'kg/m2/cycle'],
  nurseryDays: [0, 'days'], fieldEntryToFirstHarvestDays: [3, 'days'], pickingDays: [2, 'days'],
  fieldOccupancyDays: [8, 'days'], turnaroundDays: [1, 'days'], allowedEntryMonths: [[2, 12], 'utc-months'],
} as const;

function candidate(field: ProvisionalFieldCandidate['field'], value?: unknown,
  changes: Partial<ProvisionalFieldCandidate> = {}): ProvisionalFieldCandidate {
  const [initial, unit] = values[field];
  return { id: `source-${field}`, field, cropKey: CROPS[0].key, tier: 'local-public-evidence',
    input: { state: 'provided', value: value ?? initial, unit,
      provenance: { kind: 'external-reference', recordedAt, reference: 'Synthetic table row', sourceUrl: source.url } },
    geography: { kind: 'country', countryCode: 'KE' }, establishment: 'any', waterRegime: 'any',
    temporalScope: { kind: 'recurring-season' }, source, reuseReview: 'reviewed',
    positiveWindowEvidence: true, assumptions: [], ...changes };
}

function request(changes: Partial<ProvisionalDraftRequest> = {}): ProvisionalDraftRequest {
  return { profileId: 'synthetic-profile', cropKey: CROPS[0].key,
    context: { scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' },
      countryCode: 'KE', agriculturalRegionReference: 'synthetic-region', establishment: 'direct', waterRegime: 'irrigated' },
    recordedAt, asOf: '2026-11-11', candidates: Object.keys(values).map(field => candidate(field as keyof typeof values)),
    measuredAreaM2: { state: 'provided', value: 10.5, unit: 'm2', provenance: { kind: 'grower-record', recordedAt, reference: 'Synthetic area' } },
    fieldEntryDate: { state: 'provided', value: '2028-02-28', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt } },
    ...changes };
}

function resolved(input = request()) {
  const result = resolveProvisionalCropPlan(input);
  if (result.status !== 'resolved') assert.fail(`Expected a resolved draft, got ${result.status}`);
  return result;
}

function temperatureRequest(month = 1): ProvisionalDraftRequest {
  const at = '2026-11-13T12:00:00.000Z';
  return request({ cropKey: 'tomatoes', recordedAt: at, asOf: '2026-11-13',
    context: { ...request().context, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' }, establishment: 'transplant' },
    candidates: [candidate('establishment', 'transplant'), candidate('plantsPerM2', 2.5), candidate('nurseryDays', 28)]
      .map(row => ({ ...row, cropKey: 'tomatoes' })),
    temperatureComparison: syntheticTemperatureInput(),
    fieldEntryDate: { state: 'provided', value: `2027-${String(month).padStart(2, '0')}-10`, unit: 'utc-date',
      provenance: { kind: 'grower-estimate', recordedAt: at } },
  });
}

test('a source-compatible monthly comparison is automatic but never becomes a planting window or destroys independent arithmetic', () => {
  for (const [month, valueC, expected] of [[1, 18, 'within-reported-optimum'], [2, 25, 'within-reported-optimum'],
    [3, 17.999, 'outside-reported-optimum'], [4, 25.001, 'outside-reported-optimum'],
    [5, 0, 'outside-reported-optimum'], [6, -5, 'outside-reported-optimum']] as const) {
    const input = temperatureRequest(month), r = resolved(input);
    assert.equal(r.temperatureComparison?.state, expected); assert.equal(r.temperatureComparison?.valueC, valueC);
    assert.equal(r.assessment.entryWindow, 'unknown');
    assert.equal(r.assessment.estimatedPlantCount.value, 26); assert.equal(r.assessment.estimatedYieldKg.value, null);
    assert.equal(r.assessment.schedule.nurseryStartDate.status, 'ready');
    const { temperatureComparison: _, ...legacy } = input;
    const before = resolved(legacy);
    assert.deepEqual(r.profile, before.profile); assert.deepEqual(r.assessment, before.assessment);
    assert.notEqual(r.fingerprint, before.fingerprint);
    assert.equal(Object.hasOwn(before, 'temperatureComparison'), false, 'legacy requests keep their exact result shape');
  }
});

test('missing months, source/metric/scope mismatches and unchosen irrigation leave the comparison unknown rather than assuming20C', () => {
  const input = temperatureRequest();
  const missing = syntheticTemperatureEvidence({ months: [null, 19] });
  const r = resolved({ ...input, temperatureComparison: syntheticTemperatureInput(missing) });
  assert.equal(r.temperatureComparison?.reason, 'target-month-temperature-missing');
  assert.equal(r.temperatureComparison?.valueC, null); assert.equal(r.assessment.estimatedPlantCount.value, 26);
  assert.equal(resolved({ ...temperatureRequest(2), temperatureComparison: syntheticTemperatureInput(missing) }).temperatureComparison?.valueC, 19);
  for (const evidence of [null, { ...syntheticTemperatureEvidence(), countryCode: 'US' },
    { ...syntheticTemperatureEvidence(), scopeKey: 'mapped-site:site:1.00000,0.00000' },
    { ...syntheticTemperatureEvidence(), receipt: { ...syntheticTemperatureEvidence().receipt, units: 'K' } },
    { ...syntheticTemperatureEvidence(), snapshot: { ...syntheticTemperatureEvidence().snapshot, responseJsonSha256: 'a'.repeat(64) } }]) {
    const next = resolved({ ...input, temperatureComparison: { ...input.temperatureComparison!, evidence } as ProvisionalDraftRequest['temperatureComparison'] });
    assert.equal(next.temperatureComparison?.state, 'unknown'); assert.equal(next.assessment.estimatedPlantCount.value, 26);
    assert.equal(next.assessment.entryWindow, 'unknown');
  }
  for (const waterRegime of ['rain-fed', null] as const) {
    assert.equal(resolved({ ...input, context: { ...input.context, waterRegime } }).temperatureComparison?.reason, 'irrigated-field-context-required');
  }
  assert.equal(resolveProvisionalCropPlan({ ...input, knownPlantingRestriction: true }).status, 'restricted');
});

test('temperature source and comparison survive an actual v2 saved origin and export while changed cycle evidence needs a new preview', () => {
  const input = temperatureRequest(), at = '2026-11-13T12:00:00.000Z';
  const measured = input.measuredAreaM2 as { value: number };
  const workflowSource: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: 'site:0.00000,0.00000',
    scope: input.context.scope, sourceKey: 'studio-canvas:fixture', resourceSiteId: 'site:0.00000,0.00000',
    geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64), freshness: 'device-saved-copy', sourceVerification: 'not-verified',
    beds: [{ id: 'bed', label: 'Synthetic bed', areaM2: measured.value }],
    measuredAreas: [{ bedId: 'bed', areaM2: measured.value, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
  // Save's area proof uses the actual bed provenance, as a real UI request does.
  const requestToSave = { ...input, measuredAreaM2: { ...input.measuredAreaM2 as object,
    provenance: { kind: 'grower-record', recordedAt: at, reference: 'bed' } } };
  const saved = createSavedProvisionalProfile(requestToSave, 'temperature-profile', at, workflowSource, 'bed', 'Synthetic bed');
  assert.ok(saved); assert.equal(saved.provisionalOrigin?.version, 2); assert.equal(saved.provisionalOrigin?.resolver, 'provisional-crop-v2');
  const read = readSavedProvisionalProfile(JSON.parse(JSON.stringify(saved))); assert.ok(read);
  assert.equal(read.result.temperatureComparison?.valueC, 18);
  assert.equal(read.result.temperatureComparison?.evidence?.snapshot.responseJsonSha256, input.temperatureComparison!.evidence!.snapshot.responseJsonSha256);
  const html = buildProvisionalCropPreviewHtml(requestToSave, { bedLabel: 'Synthetic bed', sample: true })!.html;
  assert.match(html, /Historical temperature comparison/); assert.match(html, /within-reported-optimum/);
  assert.match(html, /2001-01 to 2025-12/); assert.match(html, /Document licence not established/);
  assert.match(html, /Entry window:<\/strong> unknown/); assert.doesNotMatch(html, /synthetic-policy|responseJson&quot;/);
  const conditions = { countryCode: 'KE', agriculturalRegionReference: input.context.agriculturalRegionReference,
    policyFingerprint: 'synthetic-policy', knownPlantingRestriction: null,
    temperatureEvidenceKey: provisionalTemperatureEvidenceKey(input.temperatureComparison!.evidence!) };
  const context = createProvisionalCycleContext(workflowSource, conditions, at); assert.ok(context);
  const binding = { bedId: 'bed' };
  assert.equal(reviewProvisionalCycleProfile(saved, context, requestToSave.measuredAreaM2, input.fieldEntryDate, binding).status, 'ready');
  for (const changed of [{ ...context, temperatureEvidenceKey: 'c'.repeat(64) }, { ...context, policyFingerprint: 'changed' }]) {
    assert.equal(reviewProvisionalCycleProfile(saved, changed, requestToSave.measuredAreaM2, input.fieldEntryDate, binding).status, 'held');
  }
  assert.equal(reviewProvisionalCycleProfile(saved, context, requestToSave.measuredAreaM2, temperatureRequest(3).fieldEntryDate, binding).status, 'held');
  const legacy = { ...requestToSave }; delete legacy.temperatureComparison;
  const oldSaved = createSavedProvisionalProfile(legacy, 'legacy-profile', at, workflowSource, 'bed', 'Synthetic bed');
  assert.equal(oldSaved?.provisionalOrigin?.version, 1); assert.equal(oldSaved?.provisionalOrigin?.resolver, 'provisional-crop-v1');
});

test('Kenya tomato nursery endpoints produce conditional seed-start dates without turning source temperature or hardening into a calendar', () => {
  const at = '2026-11-13T12:00:00.000Z';
  const context = { ...request().context, countryCode: 'KE', establishment: null, agriculturalRegionReference: null };
  for (const [basis, days, date] of [['lower-bound', 28, '2026-12-13'], ['upper-bound', 42, '2026-11-29']] as const) {
    const entries = worldvegKenyaTomatoCandidates(context, 'tomatoes', at, true, { purpose: 'protected-nursery-to-outdoor-transplant', basis });
    assert.deepEqual(entries.map(c => c.field), ['establishment', 'nurseryDays']);
    const input = request({ cropKey: 'tomatoes', context, recordedAt: at, asOf: '2026-11-13', candidates: entries,
      fieldEntryDate: { state: 'provided', value: '2027-01-10', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt: at } } });
    const value = resolved(input); assert.equal(value.activeEstablishment, 'transplant');
    assert.equal(value.assessment.schedule.nurseryStartDate.value, date);
    assert.equal(value.fields.nurseryDays.activeInput.state, 'provided');
    assert.deepEqual(entries[1].reportedRange, [28, 42]); assert.equal(entries[1].planningValueBasis, basis);
    assert.equal(value.assessment.entryWindow, 'unknown'); assert.equal(value.assessment.estimatedPlantCount.value, null);
    assert.equal(value.assessment.estimatedYieldKg.value, null); assert.equal(value.assessment.schedule.firstHarvestDate.value, null);
    const html = buildProvisionalCropPreviewHtml(input, { bedLabel: 'Synthetic bed', sample: true })!.html;
    assert.ok(html.includes(date)); assert.match(html, /2024-06 \(day unknown\)/); assert.match(html, /CC BY-SA/);
    assert.match(html, new RegExp(`protected-nursery-to-outdoor-transplant:${basis}:`));
    assert.ok(html.includes(WORLDVEG_TOMATO_NURSERY.pdfSha256)); assert.match(html, /No hardening days are added/);
    assert.match(html, /Neither endpoint is preferred/); assert.match(html, /not a source calendar/);
    const active = value.fields.nurseryDays.activeInput;
    assert.equal(active.state === 'provided' ? active.value : null, days);
  }
  const use = { purpose: 'protected-nursery-to-outdoor-transplant', basis: 'lower-bound' } as const;
  for (const v of [null, { ...use, basis: '' }, { ...use, basis: 'midpoint' }, { ...use, purpose: 'purchased-seedlings' }]) {
    assert.deepEqual(worldvegKenyaTomatoCandidates(context, 'tomatoes', at, true, v as typeof use), []);
  }
  for (const countryCode of ['US', 'ZA', 'GB', 'OTHER', null]) {
    assert.deepEqual(worldvegKenyaTomatoCandidates({ ...context, countryCode }, 'tomatoes', at, true, use), []);
  }
  assert.deepEqual(worldvegKenyaTomatoCandidates(context, 'tomatoes', at, false, use), []);
  assert.deepEqual(worldvegKenyaTomatoCandidates(context, 'cabbage', at, true, use), []);
  assert.deepEqual(worldvegKenyaTomatoCandidates({ ...context, establishment: 'direct' }, 'tomatoes', at, true, use), []);
});

test('the actual Missouri oats panel supplies only grouped cover-crop method and positive months, with no catalogue agronomy', () => {
  const at = '2026-11-13T12:00:00.000Z';
  const context = { ...request().context, countryCode: 'US', agriculturalRegionReference: 'Southeast Missouri', establishment: null };
  for (const oatType of ['spring', 'winter'] as const) {
    const entries = southeastMissouriOatsCandidates(context, 'oats', at, true, { purpose: 'cover-crop-establishment', oatType });
    assert.deepEqual(entries.map(c => c.field), ['establishment', 'allowedEntryMonths']);
    assert.ok(entries.every(c => c.tier === 'climate-crop-derived' && c.temporalScope.kind === 'historical-transfer'));
    assert.equal(entries[1].entryMonthCoverage, 'positive-only');
    for (const [month, expected] of [[2, 'unknown'], [3, 'reported-positive'], [4, 'reported-positive'], [5, 'unknown'],
      [7, 'unknown'], [8, 'reported-positive'], [9, 'reported-positive'], [10, 'unknown']] as const) {
      const input = request({ cropKey: 'oats', context, recordedAt: at, asOf: '2026-11-13', candidates: entries,
        fieldEntryDate: { state: 'provided', value: `2027-${String(month).padStart(2, '0')}-15`, unit: 'utc-date',
          provenance: { kind: 'grower-estimate', recordedAt: at } } });
      const value = resolved(input);
      assert.equal(value.profile.version, 2); assert.equal(value.assessment.entryWindow, expected);
      assert.equal(value.activeEstablishment, 'direct'); assert.equal(value.assessment.estimatedPlantCount.value, null);
      assert.equal(value.assessment.estimatedYieldKg.value, null);
      assert.ok(Object.values(value.assessment.schedule).every(r => r.value === null));
      assert.equal(value.assessment.schedule.nurseryStartDate.status, 'not-applicable');
      assert.equal(value.fields.allowedEntryMonths.sourceBindings[0].publishedMonth, '2014-03');
      assert.equal(value.fields.allowedEntryMonths.sourceBindings[0].publishedOn, null);
      assert.equal(value.fields.allowedEntryMonths.sourceBindings[0].evidenceState, 'available-reference');
      const html = buildProvisionalCropPreviewHtml(input, { bedLabel: 'Synthetic bed', sample: true })!.html;
      assert.match(html, /2014-03 \(day unknown\)/); assert.match(html, /cover-crop establishment/);
      assert.match(html, new RegExp(`cover-crop-establishment:${oatType}:`)); assert.ok(html.includes(MISSOURI_OATS_PDF_SHA256));
      assert.match(html, /not a separately validated cultivar calendar/); assert.match(html, /other months remain unknown/);
      assert.doesNotMatch(html, /166 days|70kg|35 pounds|50 pounds/);
    }
    const undated = resolved(request({ cropKey: 'oats', context, recordedAt: at, asOf: '2026-11-13', candidates: entries,
      fieldEntryDate: { state: 'missing', reason: 'not-entered' } }));
    assert.equal(undated.assessment.entryWindow, 'missing-date');
  }
  assert.equal(USDA_SOUTHEAST_MISSOURI_OATS_SOURCE.reviewDueOn, null);
});

test('Missouri oats cannot infer source use, type, region or method from a country or the winter-cover crop label', () => {
  const context = { ...request().context, countryCode: 'US', agriculturalRegionReference: 'Southeast Missouri', establishment: null };
  const use = { purpose: 'cover-crop-establishment', oatType: 'spring' } as const;
  for (const changes of [{ countryCode: 'KE' }, { countryCode: null }, { countryCode: 'OTHER' },
    { agriculturalRegionReference: null }, { agriculturalRegionReference: 'Missouri' }, { agriculturalRegionReference: 'Great Lakes States' },
    { establishment: 'transplant' as const }]) {
    assert.deepEqual(southeastMissouriOatsCandidates({ ...context, ...changes }, 'oats', recordedAt, true, use), []);
  }
  assert.deepEqual(southeastMissouriOatsCandidates(context, 'oats', recordedAt, false, use), []);
  for (const value of [null, { ...use, oatType: '' }, { ...use, purpose: 'grain-harvest' }, { ...use, oatType: 'unknown' }]) {
    assert.deepEqual(southeastMissouriOatsCandidates(context, 'oats', recordedAt, true, value as typeof use), []);
  }
  assert.equal(southeastMissouriOatsReference('US', 'cabbage'), null);
  assert.deepEqual(southeastMissouriOatsCandidates(context, 'cabbage', recordedAt, true, use), []);
  const spring = resolved(request({ cropKey: 'oats', context, recordedAt: '2026-11-13T12:00:00.000Z', asOf: '2026-11-13',
    candidates: southeastMissouriOatsCandidates(context, 'oats', '2026-11-13T12:00:00.000Z', true, use) }));
  const winter = resolved(request({ cropKey: 'oats', context, recordedAt: '2026-11-13T12:00:00.000Z', asOf: '2026-11-13',
    candidates: southeastMissouriOatsCandidates(context, 'oats', '2026-11-13T12:00:00.000Z', true, { ...use, oatType: 'winter' }) }));
  assert.notEqual(spring.fingerprint, winter.fingerprint, 'equal month values must not erase the chosen oat type');
});

test('positive source months preserve unknown omissions and conditional dates instead of inventing exclusions', () => {
  for (const [month, status] of [[6, 'unknown'], [7, 'reported-positive'], [9, 'reported-positive'], [10, 'unknown']] as const) {
    const input = request();
    const day = `2028-${String(month).padStart(2, '0')}-15`;
    const r = resolved({ ...input, candidates: input.candidates.map(c => c.field === 'allowedEntryMonths'
      ? candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' }) : c),
      fieldEntryDate: { ...input.fieldEntryDate as object, value: day } });
    assert.equal(r.assessment.entryWindow, status);
    assert.equal(r.profile.version, 2); assert.equal(r.profile.entryMonthCoverage, 'positive-only');
    assert.equal(r.assessment.schedule.firstHarvestDate.value, day.slice(0, -2) + '18');
    assert.equal(r.assessment.estimatedPlantCount.value, 26);
    assert.equal(r.assessment.status, 'partial-ready');
    const full = assessGrowerPlanning({ profile: r.profile, scope: input.context.scope,
      measuredAreaM2: input.measuredAreaM2, fieldEntryDate: { ...input.fieldEntryDate as object, value: day } });
    assert.equal(full.status, 'missing-inputs');
    if (full.status === 'missing-inputs') assert.deepEqual(full.issues, ['needs-grower-entry-window']);
    const html = buildProvisionalCropPreviewHtml({ ...input, candidates: input.candidates.map(c => c.field === 'allowedEntryMonths'
      ? candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' }) : c),
      fieldEntryDate: { ...input.fieldEntryDate as object, value: day } }, { bedLabel: 'Synthetic bed', sample: true })!.html;
    assert.match(html, /other months remain unknown/); assert.match(html, /conditional calculations/);
    assert.doesNotMatch(html, /Entry window<\/strong>:\s*excluded/);
  }
});

test('a deliberate grower month override replaces active coverage while retaining the positive source baseline', () => {
  const input = request({ candidates: [candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' })] });
  const baseline = resolved(input);
  assert.equal(baseline.profile.version, 2);
  for (const [value, status] of [[[], 'excluded'], [[2], 'allowed']] as const) {
    const r = resolved({ ...input, overrides: { allowedEntryMonths: { state: 'provided', value, unit: 'utc-months',
      provenance: { kind: 'grower-estimate', recordedAt } } } });
    assert.equal(r.profile.version, 1); assert.equal(r.profile.entryMonthCoverage, undefined);
    assert.equal(r.assessment.entryWindow, status);
    assert.equal(r.fields.allowedEntryMonths.defaultEntryMonthCoverage, 'positive-only');
    assert.equal(r.fields.allowedEntryMonths.defaultOptions[0].scope.entryMonthCoverage, 'positive-only');
    assert.notEqual(r.fingerprint, baseline.fingerprint);
  }
  const withheld = resolved({ ...input, overrides: { allowedEntryMonths: { state: 'missing', reason: 'not-entered' } } });
  assert.equal(withheld.profile.version, 1); assert.equal(withheld.assessment.entryWindow, 'unknown');
  const invalid = resolved({ ...input, overrides: { allowedEntryMonths: { state: 'provided', value: [99], unit: 'utc-months' } } });
  assert.equal(invalid.fields.allowedEntryMonths.status, 'invalid-override'); assert.equal(invalid.profile.version, 1);
  assert.equal(resolved(input).fingerprint, baseline.fingerprint, 'reset is removal of the deliberate override');
});

test('coverage conflicts and rejected candidates never mark another month default as positive-only', () => {
  const positive = candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' });
  const closed = candidate('allowedEntryMonths', [7, 8, 9], { id: 'closed-window' });
  const conflict = resolved(request({ candidates: [positive, closed] }));
  assert.equal(conflict.fields.allowedEntryMonths.status, 'conflict'); assert.equal(conflict.profile.version, 1);
  assert.equal(conflict.assessment.entryWindow, 'unknown');
  const rejected = resolved(request({ candidates: [{ ...positive, geography: { kind: 'country', countryCode: 'US' } }, closed] }));
  assert.equal(rejected.profile.version, 1); assert.equal(rejected.fields.allowedEntryMonths.defaultEntryMonthCoverage, undefined);
  for (const changes of [{ field: 'nurseryDays', input: candidate('nurseryDays').input }, { tier: 'grower-estimate' },
    { entryMonthCoverage: 'invented' }, { input: candidate('allowedEntryMonths', []).input }]) {
    const r = resolved(request({ candidates: [{ ...positive, ...changes } as ProvisionalFieldCandidate] }));
    assert.equal(r.profile.version, 1); assert.equal(r.fields.allowedEntryMonths.activeInput.state, 'missing');
    assert.ok(r.rejected.some(c => c.reason === 'invalid-entry-month-coverage'));
  }
});

test('normalisation cannot drop positive month semantics or convert grower estimates into source evidence', () => {
  const p = resolved(request({ candidates: [candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' })] })).profile;
  assert.deepEqual(normaliseGrowerPlanningProfile(JSON.parse(JSON.stringify(p))), p);
  assert.equal(normaliseGrowerPlanningProfile({ ...p, version: 1 }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...p, entryMonthCoverage: undefined }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...p, inputs: { ...p.inputs, allowedEntryMonths: { state: 'missing', reason: 'not-known' } } }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...p, inputs: { ...p.inputs, allowedEntryMonths: { state: 'provided', value: [], unit: 'utc-months',
    provenance: { kind: 'external-reference', recordedAt, sourceUrl: source.url, reference: 'Fixture' } } } }), null);
  assert.equal(normaliseGrowerPlanningProfile({ ...p, inputs: { ...p.inputs, allowedEntryMonths: { state: 'provided', value: [7], unit: 'utc-months',
    provenance: { kind: 'grower-estimate', recordedAt } } } }), null);
});

test('the frozen pre-extension saved profile and adopted cycle retain exact replay identity', () => {
  const { base, fixture } = JSON.parse(readFileSync(new URL('./fixtures/provisional-month-coverage/legacy-v1.json', import.meta.url), 'utf8'));
  assert.equal(base, '51872cdfe7cc93855667f92b69c5e9e77f9ccf15');
  assert.deepEqual(normaliseGrowerPlanningProfile(fixture.saved), fixture.saved);
  const saved = readSavedProvisionalProfile(fixture.saved); assert.ok(saved);
  assert.equal(saved.result.fingerprint, fixture.saved.provisionalOrigin.previewFingerprint);
  assert.equal(resolvePlantingBasis(fixture.row, fixture.context).kind, 'grower-dated-cycle');
});

test('saved positive source coverage and an explicit replacement window both replay without changing their baseline', () => {
  const input = request({ asOf: recordedAt.slice(0, 10), candidates: [candidate('establishment'), candidate('allowedEntryMonths', [7, 8, 9], { entryMonthCoverage: 'positive-only' })] });
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: 'virtual-bed', sourceKey: 'synthetic-saved-source',
    resourceSiteId: 'virtual-bed', scope: input.context.scope, geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64),
    freshness: 'device-saved-copy', sourceVerification: 'not-verified', beds: [{ id: 'synthetic-bed', label: 'Synthetic bed', areaM2: 10.5 }],
    measuredAreas: [{ bedId: 'synthetic-bed', areaM2: 10.5, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
  for (const overrides of [undefined, { allowedEntryMonths: { state: 'provided', value: [2], unit: 'utc-months',
    provenance: { kind: 'grower-estimate', recordedAt } } }]) {
    const saved = createSavedProvisionalProfile({ ...input, overrides }, 'new-positive-profile', recordedAt, source, 'synthetic-bed', 'Synthetic bed');
    assert.ok(saved);
    assert.equal(saved.version, overrides ? 1 : 2);
    const read = readSavedProvisionalProfile(JSON.parse(JSON.stringify(saved))); assert.ok(read);
    assert.equal(read.result.fields.allowedEntryMonths.defaultEntryMonthCoverage, 'positive-only');
    assert.equal(read.result.assessment.entryWindow, overrides ? 'allowed' : 'unknown');
    assert.deepEqual(read.profile, saved);
  }
});

test('the undated Great Lakes tomato row supplies only its chosen transplant lead time, not a local calendar or crop forecast', () => {
  const at = '2026-11-13T12:00:00.000Z';
  const context = { ...request().context, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: null };
  const entries = usdaGreatLakesTomatoCandidates(context, 'tomatoes', at, true);
  assert.deepEqual(entries.map(row => row.field), ['establishment', 'nurseryDays']);
  assert.equal(USDA_TOMATO_NURSERY.days, 56);
  const input = request({ recordedAt: at, asOf: '2026-11-13', cropKey: 'tomatoes', context, candidates: entries,
    fieldEntryDate: { state: 'provided', value: '2027-01-10', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt: at } } });
  const value = resolved(input);
  assert.equal(value.assessment.schedule.nurseryStartDate.value, '2026-11-15');
  assert.equal(value.fields.nurseryDays.defaultPlanningValueBasis, 'reported-point');
  assert.equal(value.fields.nurseryDays.sourceBindings[0].evidenceState, 'undated');
  assert.equal(value.fields.nurseryDays.sourceBindings[0].publishedOn, null);
  assert.equal(value.fields.nurseryDays.sourceBindings[0].accessedOn, '2026-11-13');
  assert.equal(value.assessment.entryWindow, 'unknown');
  assert.equal(value.assessment.estimatedPlantCount.value, null);
  assert.equal(value.assessment.estimatedYieldKg.value, null);
  assert.equal(value.assessment.schedule.firstHarvestDate.value, null);
  assert.equal(value.assessment.schedule.fieldClearDate.value, null);
  const html = buildProvisionalCropPreviewHtml(input, { bedLabel: 'Synthetic bed', sample: true })!.html;
  assert.match(html, /56 days/); assert.match(html, /usda-nrcs-great-lakes-tomato/);
  assert.match(html, /seed-starting lead time/); assert.match(html, /not time after emergence/);
  assert.match(html, /publication and revision dates unknown/);
  assert.match(html, /ff7a1dfea4582f69/);
});

test('tomato reference needs the existing crop, declared Great Lakes region and explicit source choice; direct sowing cannot use it', () => {
  const context = { ...request().context, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: null };
  for (const other of [{ countryCode: 'KE' }, { countryCode: null }, { countryCode: 'OTHER' },
    { agriculturalRegionReference: null }, { agriculturalRegionReference: 'Michigan' }, { establishment: 'direct' as const }]) {
    assert.deepEqual(usdaGreatLakesTomatoCandidates({ ...context, ...other }, 'tomatoes', recordedAt, true), []);
  }
  assert.deepEqual(usdaGreatLakesTomatoCandidates(context, 'cabbage', recordedAt, true), []);
  assert.deepEqual(usdaGreatLakesTomatoCandidates(context, 'tomatoes', recordedAt, false), []);
  assert.equal(usdaGreatLakesTomatoReference('KE', 'tomatoes'), null);
  assert.equal(usdaGreatLakesTomatoReference('US', 'cabbage'), null);
});

test('a deliberately chosen USDA nursery bound derives only seed-start time and preserves the original range and unknown calendar', () => {
  const base = request({ cropKey: 'cabbage', recordedAt: '2026-11-13T12:00:00.000Z', asOf: '2026-11-13' });
  const context = { ...base.context, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: null };
  const input = { ...base, context, fieldEntryDate: { state: 'provided', value: '2027-01-10', unit: 'utc-date',
    provenance: { kind: 'grower-estimate', recordedAt: base.recordedAt } } };
  const blank = resolved({ ...input, candidates: usdaGreatLakesCabbageCandidates(context, 'cabbage', base.recordedAt, true) });
  assert.equal(blank.assessment.schedule.nurseryStartDate.value, null);
  for (const [basis, days, start] of [['lower-bound', 28, '2026-12-13'], ['upper-bound', 42, '2026-11-29']] as const) {
    const candidates = usdaGreatLakesCabbageCandidates(context, 'cabbage', base.recordedAt, true, basis);
    const value = resolved({ ...input, candidates });
    assert.equal(value.fields.nurseryDays.activeInput.state, 'provided');
    if (value.fields.nurseryDays.activeInput.state === 'provided') assert.equal(value.fields.nurseryDays.activeInput.value, days);
    assert.deepEqual(value.fields.nurseryDays.defaultReportedRange, [28, 42]);
    assert.equal(value.fields.nurseryDays.defaultPlanningValueBasis, basis);
    assert.equal(value.assessment.schedule.nurseryStartDate.value, start);
    assert.equal(value.assessment.schedule.firstHarvestDate.value, null);
    assert.equal(value.assessment.estimatedYieldKg.value, null);
    assert.equal(value.assessment.estimatedPlantCount.value, null);
    assert.equal(value.assessment.entryWindow, 'unknown');
    const html = buildProvisionalCropPreviewHtml({ ...input, candidates }, { bedLabel: 'Synthetic bed', sample: true })!.html;
    assert.match(html, /4–6 weeks before transplanting/); assert.match(html, /reported range 28–42/);
    assert.ok(html.includes(basis)); assert.ok(html.includes(start));
    assert.match(html, /ff7a1dfea4582f69d8349e150e7e875b02df32c01bc1eef957aded6fa2a9483e/);
    assert.deepEqual(usdaGreatLakesCabbageCandidates(context, 'cabbage', base.recordedAt, false, basis), []);
    assert.deepEqual(usdaGreatLakesCabbageCandidates({ ...context, countryCode: 'KE' }, 'cabbage', base.recordedAt, true, basis), []);
    assert.deepEqual(usdaGreatLakesCabbageCandidates({ ...context, agriculturalRegionReference: 'Elsewhere' }, 'cabbage', base.recordedAt, true, basis), []);
    const direct = resolved({ ...input, context: { ...context, establishment: 'direct' }, candidates });
    assert.equal(direct.fields.nurseryDays.activeInput.state, 'missing');
    const undated = resolved({ ...input, candidates, fieldEntryDate: { state: 'missing', reason: 'not-entered' } });
    assert.equal(undated.assessment.schedule.nurseryStartDate.value, null);
  }
});

test('Kenya cowpea method binds declared leaf purpose and habit; source spacing and seed counts never become density', () => {
  const base = request({ cropKey: 'cowpea', recordedAt: '2026-11-12T12:00:00.000Z', asOf: '2026-11-12' });
  const context = { ...base.context, establishment: null };
  for (const habit of ['spreading', 'erect-or-semi-erect'] as const) {
    const conditions = { purpose: 'leaves' as const, habit };
    const candidates = worldvegKenyaCowpeaCandidates(context, 'cowpea', base.recordedAt, true, conditions);
    assert.deepEqual(candidates.map(c => c.field), ['establishment']);
    const result = resolved({ ...base, context, candidates });
    assert.deepEqual(result.fields.establishment.activeInput.state, 'provided');
    assert.equal(result.fields.establishment.activeTier, 'local-public-evidence');
    assert.equal(result.fields.plantsPerM2.activeInput.state, 'missing');
    assert.equal(result.assessment.estimatedPlantCount.value, null);
    assert.equal(result.assessment.estimatedYieldKg.value, null);
    assert.equal(result.assessment.schedule.firstHarvestDate.value, null);
    assert.ok(result.fields.establishment.assumptions.some(s => s.includes(worldvegKenyaCowpeaSpacing(conditions)!)));
    const html = buildProvisionalCropPreviewHtml({ ...base, context, candidates }, { bedLabel: 'Synthetic bed', sample: true })!.html;
    assert.match(html, /2–3 seeds per hill/); assert.match(html, /not a final surviving plant count/);
    assert.match(html, /CC BY-SA 3.0/); assert.match(html, /2024-06 \(day unknown\)/);
    assert.match(html, /pp21–22/); assert.match(html, /declared conditions/);
    for (const purpose of ['', 'pods-or-grain'] as const) {
      assert.deepEqual(worldvegKenyaCowpeaCandidates(context, 'cowpea', base.recordedAt, true, { habit, purpose }), []);
    }
    assert.deepEqual(worldvegKenyaCowpeaCandidates(context, 'cowpea', base.recordedAt, false, conditions), []);
    assert.deepEqual(worldvegKenyaCowpeaCandidates({ ...context, countryCode: 'ZA' }, 'cowpea', base.recordedAt, true, conditions), []);
    assert.deepEqual(worldvegKenyaCowpeaCandidates(context, 'cabbage', base.recordedAt, true, conditions), []);
    const explicitMethod = resolved({ ...base, context: { ...context, establishment: 'transplant' }, candidates });
    assert.equal(explicitMethod.fields.establishment.activeInput.state, 'missing');
  }
  assert.equal(worldvegKenyaCowpeaSpacing({ purpose: 'leaves', habit: '' }), null);
});

test('a source-qualified non-SA draft generates arithmetic and UTC dates without claiming agronomy approval', () => {
  const result = resolved();
  assert.equal(result.assessment.status, 'ready');
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
  assert.equal(result.assessment.schedule.firstHarvestDate.value, '2028-03-02');
  assert.equal(result.assessment.schedule.harvestEndExclusiveDate.value, '2028-03-04');
  assert.equal(result.countryOrRegionApproval, false);
  assert.equal(result.knownPlantLegalityEstablished, false);
  assert.equal(result.sourceVerification, 'not-verified');
});

test('a missing yield preserves independently supported counts and dates rather than borrowing catalogue yield', () => {
  const input = request();
  const result = resolved({ ...input, candidates: input.candidates.filter(row => row.field !== 'yieldKgPerM2') });
  assert.equal(result.assessment.status, 'partial-ready');
  assert.equal(result.assessment.estimatedYieldKg.value, null);
  assert.equal(result.fields.yieldKgPerM2.status, 'missing');
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.assessment.schedule.firstHarvestDate.value, '2028-03-02');
});

test('a missing density preserves yield and dates while count remains unknown', () => {
  const input = request();
  const result = resolved({ ...input, candidates: input.candidates.filter(row => row.field !== 'plantsPerM2') });
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
  assert.equal(result.assessment.schedule.firstHarvestDate.value, '2028-03-02');
});

test('unknown entry months stay unknown while dates remain conditional on the explicitly entered date', () => {
  const input = request();
  const result = resolved({ ...input, candidates: input.candidates.filter(row => row.field !== 'allowedEntryMonths') });
  assert.equal(result.assessment.entryWindow, 'unknown');
  assert.ok(result.assessment.uncertainties.includes('entry-window-unknown'));
  assert.equal(result.fields.allowedEntryMonths.activeInput.state, 'missing');
  assert.equal(result.assessment.status, 'partial-ready');
});

test('local applicable evidence outranks a disclosed grower estimate without erasing the chosen source', () => {
  const input = request();
  const estimate = candidate('plantsPerM2', 7, { id: 'grower-density', tier: 'grower-estimate',
    input: { state: 'provided', value: 7, unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt } } });
  const result = resolved({ ...input, candidates: [...input.candidates, estimate] });
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.fields.plantsPerM2.activeTier, 'local-public-evidence');
  assert.deepEqual(result.fields.plantsPerM2.sourceReferences, [source.url]);
});

test('same-rank conflicting density values remain unresolved instead of being averaged or selected by order', () => {
  const input = request();
  const candidates = [...input.candidates, candidate('plantsPerM2', 7, { id: 'other-local-density' })];
  const first = resolved({ ...input, candidates });
  const reversed = resolved({ ...input, candidates: [...candidates].reverse() });
  assert.equal(first.fields.plantsPerM2.status, 'conflict');
  assert.equal(first.assessment.estimatedPlantCount.value, null);
  assert.equal(first.assessment.estimatedYieldKg.value, 42);
  assert.equal(first.fingerprint, reversed.fingerprint);
});

test('wrong country and region references cannot populate a local field', () => {
  for (const geography of [{ kind: 'country', countryCode: 'GB' },
    { kind: 'region', countryCode: 'KE', regionReference: 'a-different-region' }] as const) {
    const input = request();
    const candidates = input.candidates.map(row => row.field === 'plantsPerM2' ? { ...row, geography } : row);
    const result = resolved({ ...input, candidates });
    assert.equal(result.fields.plantsPerM2.status, 'missing');
    assert.ok(result.rejected.some(row => row.id === 'source-plantsPerM2' && row.reason === 'scope-mismatch'));
  }
});

test('unlisted countries do not share local evidence merely because both use OTHER', () => {
  const input = request();
  for (const geography of [{ kind: 'country', countryCode: 'OTHER' },
    { kind: 'region', countryCode: 'OTHER', regionReference: 'synthetic-region' }] as const) {
    const result = resolved({ ...input, context: { ...input.context, countryCode: 'OTHER' },
      candidates: [candidate('plantsPerM2', undefined, { geography })] });
    assert.equal(result.fields.plantsPerM2.status, 'missing');
    assert.equal(result.assessment.estimatedPlantCount.value, null);
    assert.ok(result.rejected.some(row => row.reason === 'scope-mismatch'));
  }
});

test('an unknown country can still receive an explicitly disclosed grower-estimate component', () => {
  const input = request();
  const result = resolved({ ...input, context: { ...input.context, countryCode: 'OTHER' },
    candidates: [candidate('plantsPerM2', undefined, { tier: 'grower-estimate',
      geography: { kind: 'explicit-transfer', assumption: 'Synthetic grower estimate for this workspace only' },
      input: { state: 'provided', value: 2.5, unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt } } })] });
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.fields.plantsPerM2.activeTier, 'grower-estimate');
  assert.equal(result.assessment.entryWindow, 'unknown');
  assert.equal(result.countryOrRegionApproval, false);
});

test('method and water assumptions are matched before using a duration or yield', () => {
  for (const changes of [{ establishment: 'transplant' }, { waterRegime: 'rain-fed' }] as const) {
    const input = request();
    const candidates = input.candidates.map(row => row.field === 'yieldKgPerM2' ? { ...row, ...changes } : row);
    const result = resolved({ ...input, candidates });
    assert.equal(result.assessment.estimatedYieldKg.value, null);
    assert.equal(result.assessment.estimatedPlantCount.value, 26);
  }
});

test('an automatic method cannot silently replace the explicitly requested method', () => {
  const input = request();
  const candidates = input.candidates.map(row => row.field === 'establishment'
    ? candidate('establishment', 'transplant') : row);
  const result = resolved({ ...input, candidates });
  assert.equal(result.fields.establishment.status, 'missing');
  assert.ok(result.rejected.some(row => row.reason === 'requested-method-mismatch'));
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  const unknownContext = resolved({ ...input, candidates, context: { ...input.context, establishment: null } });
  assert.equal(unknownContext.fields.establishment.activeInput.state, 'provided');
  assert.notEqual(result.fingerprint, unknownContext.fingerprint);
});

test('unknown method context can use an applicable automatic method but contradictory capsules are rejected', () => {
  const input = request();
  const candidates = input.candidates.map(row => row.field === 'establishment'
    ? candidate('establishment', 'transplant', { establishment: 'transplant' }) : row);
  const result = resolved({ ...input, candidates, context: { ...input.context, establishment: null } });
  assert.equal(result.profile.inputs.establishment.state, 'provided');
  assert.equal(result.profile.inputs.establishment.state === 'provided' && result.profile.inputs.establishment.value, 'transplant');
  assert.equal(result.requestedEstablishment, null);
  assert.equal(result.activeEstablishment, 'transplant');
  const contradictory = resolved({ ...input, candidates: input.candidates.map(row => row.field === 'establishment'
    ? candidate('establishment', 'transplant', { establishment: 'direct' }) : row) });
  assert.equal(contradictory.fields.establishment.status, 'missing');
  assert.ok(contradictory.rejected.some(row => row.reason === 'contradictory-method-candidate'));
});

test('the fingerprint retains the requested method even when the same automatic method is selected', () => {
  const input = request();
  const explicit = resolved(input);
  const automatic = resolved({ ...input, context: { ...input.context, establishment: null } });
  assert.deepEqual(explicit.profile, automatic.profile);
  assert.notEqual(explicit.fingerprint, automatic.fingerprint);
  assert.equal(explicit.requestedEstablishment, 'direct');
  assert.equal(automatic.requestedEstablishment, null);
});

test('an explicit method edit retains its baseline and re-evaluates dependent evidence under the edited method', () => {
  const input = request();
  const result = resolved({ ...input, candidates: input.candidates.map(row => row.field === 'plantsPerM2'
    ? { ...row, establishment: 'direct' } : row.field === 'yieldKgPerM2'
      ? { ...row, establishment: 'transplant' } : row), overrides: {
    establishment: { state: 'provided', value: 'transplant', unit: 'method', provenance: { kind: 'grower-estimate', recordedAt } },
  } });
  assert.equal(result.fields.establishment.status, 'overridden');
  assert.equal(result.fields.establishment.baselineDefault?.state === 'provided' && result.fields.establishment.baselineDefault.value, 'direct');
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
});

test('an unresolved automatic method cannot enable method-qualified dependent evidence', () => {
  const input = request();
  const candidates = input.candidates.map(row => row.field === 'plantsPerM2'
    ? { ...row, establishment: 'direct' as const } : row);
  const result = resolved({ ...input, context: { ...input.context, establishment: null }, candidates: [
    ...candidates, candidate('establishment', 'transplant', { id: 'other-method' }),
  ] });
  assert.equal(result.fields.establishment.status, 'conflict');
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
});

test('sparse month evidence or edits are rejected without losing independent calculations', () => {
  const input = request();
  const sparse = Array(1);
  const result = resolved({ ...input, candidates: input.candidates.map(row => row.field === 'allowedEntryMonths'
    ? candidate('allowedEntryMonths', sparse) : row) });
  assert.equal(result.fields.allowedEntryMonths.status, 'missing');
  assert.ok(result.profile);
  assert.equal(result.assessment.estimatedPlantCount.value, 26);
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
  const edit = resolved({ ...input, overrides: { allowedEntryMonths: { state: 'provided', value: sparse,
    unit: 'utc-months', provenance: { kind: 'grower-estimate', recordedAt } } } });
  assert.equal(edit.fields.allowedEntryMonths.status, 'invalid-override');
  assert.equal(edit.assessment.estimatedPlantCount.value, 26);
  assert.equal(edit.assessment.estimatedYieldKg.value, 42);
});

test('an explicitly empty planting window stays an exclusion rather than a missing or malformed month list', () => {
  const input = request();
  const result = resolved({ ...input, candidates: input.candidates.map(row => row.field === 'allowedEntryMonths'
    ? candidate('allowedEntryMonths', []) : row) });
  assert.equal(result.fields.allowedEntryMonths.status, 'selected');
  assert.equal(result.assessment.entryWindow, 'excluded');
});

test('an explicit edit changes only its dependent output and retains the automatic baseline', () => {
  const result = resolved(request({ overrides: { plantsPerM2: { state: 'provided', value: 3, unit: 'plants/m2',
    provenance: { kind: 'external-reference', recordedAt, reference: 'Cannot promote an edit', sourceUrl: source.url } } } }));
  assert.equal(result.assessment.estimatedPlantCount.value, 31);
  assert.equal(result.fields.plantsPerM2.status, 'overridden');
  assert.equal(result.fields.plantsPerM2.activeTier, 'grower-estimate');
  assert.equal(result.fields.plantsPerM2.baselineDefault?.state, 'provided');
  assert.equal(result.assessment.estimatedYieldKg.value, 42);
});

test('a malformed override does not silently restore an automatic default', () => {
  const result = resolved(request({ overrides: { plantsPerM2: { state: 'provided', value: 3, unit: 'kg' } } }));
  assert.equal(result.fields.plantsPerM2.status, 'invalid-override');
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.fields.plantsPerM2.baselineDefault?.state, 'provided');
});

test('an exclusion-only climate screen is not promoted to a positive sowing window', () => {
  const input = request();
  const candidates = input.candidates.map(row => row.field === 'allowedEntryMonths' ? { ...row, positiveWindowEvidence: false } : row);
  const result = resolved({ ...input, candidates });
  assert.equal(result.assessment.entryWindow, 'unknown');
  assert.ok(result.rejected.some(row => row.reason === 'positive-window-evidence-missing'));
});

test('stale, unread and unlicensed sources stay unavailable without blocking unrelated outputs', () => {
  for (const changes of [{ reviewDueOn: '2026-01-01' }, { verification: 'snippet-only' },
    { licence: { status: 'unknown', reason: 'Not reviewed' } }] as const) {
    const input = request();
    const candidates = input.candidates.map(row => row.field === 'yieldKgPerM2' ? { ...row, source: { ...source, ...changes } } : row);
    const result = resolved({ ...input, candidates });
    assert.equal(result.assessment.estimatedYieldKg.value, null);
    assert.equal(result.assessment.estimatedPlantCount.value, 26);
  }
});

test('a dated table is not applied outside its stated period', () => {
  const input = request();
  const candidates = input.candidates.map(row => row.field === 'plantsPerM2' ? { ...row,
    temporalScope: { kind: 'dated', fromDate: '2026-01-01', throughDate: '2026-12-31' } as const } : row);
  const result = resolved({ ...input, candidates });
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.ok(result.rejected.some(row => row.reason === 'time-scope-mismatch'));
});

test('a known planting restriction is not overridden by a general provisional warning', () => {
  const result = resolveProvisionalCropPlan(request({ knownPlantingRestriction: true }));
  assert.equal(result.status, 'restricted');
  assert.equal(result.assessment, null);
});

test('sparse candidate arrays and duplicate evidence IDs never select an arbitrary value', () => {
  assert.equal(resolveProvisionalCropPlan(request({ candidates: Array(1) as ProvisionalFieldCandidate[] })).status, 'invalid-context');
  const input = request();
  const result = resolved({ ...input, candidates: [...input.candidates, candidate('plantsPerM2', 7)] });
  assert.equal(result.fields.plantsPerM2.status, 'missing');
});

test('generating a frozen draft does not mutate or freeze the caller’s original data', () => {
  const input = request();
  const before = JSON.stringify(input);
  const result = resolved(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input.candidates), false);
  assert.equal(Object.isFrozen(input.candidates[0].assumptions), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.fields), true);
});


test('month-only source dates stay truthful without borrowing an announcement day', () => {
  const monthSource = { ...source, publishedOn: null, publishedMonth: '2024-06' };
  assert.equal(sourcePublicationText(monthSource), '2024-06 (day unknown)');
  assert.equal(sourceEvidenceState(monthSource, '2026-11-11'), 'available-reference');
  assert.equal(sourcePublicationIsKnownBy(monthSource, '2024-06-30'), false, 'Do not invent a publication day within its known month');
  assert.equal(sourcePublicationIsKnownBy(monthSource, '2024-07-01'), true);
  for (const publishedMonth of ['2024-00', '2024-13', '2024-6', '0000-06', '2027-01', '2024-06-26']) {
    assert.equal(sourceEvidenceState({ ...monthSource, publishedMonth }, '2026-11-11'), 'undated', publishedMonth);
  }
  assert.equal(sourcePublicationText({ publishedOn: '2024-06-26', publishedMonth: '2024-06' }), 'Unknown');
  assert.equal(sourceEvidenceState({ ...monthSource, publishedOn: '2024-06-26' }, '2026-11-11'), 'undated');
  assert.equal(sourceEvidenceState({ ...monthSource, reviewDueOn: '2026-01-01' }, '2026-11-11'), 'stale');
  assert.equal(sourceEvidenceState({ ...monthSource, accessedOn: '2027-01-01' }, '2026-11-11'), 'undated');
  assert.equal(sourceEvidenceState({ ...monthSource, verification: 'snippet-only' }, '2026-11-11'), 'missing');
});

test('WorldVeg method requires explicit choice and region, never converts seedbed preparation or spacing into numbers', () => {
  const base = request({ cropKey: 'cabbage', recordedAt: '2026-11-12T21:00:00.000Z', asOf: '2026-11-12', candidates: [] });
  const context = { ...base.context, agriculturalRegionReference: 'Central Kenya', establishment: null };
  assert.deepEqual(worldvegKenyaCabbageCandidates(context, 'cabbage', base.recordedAt, false), []);
  for (const change of [{ countryCode: 'ZA' }, { countryCode: 'OTHER' }, { countryCode: null },
    { agriculturalRegionReference: null }, { agriculturalRegionReference: 'Kenya' }, { agriculturalRegionReference: 'Nairobi' }]) {
    assert.deepEqual(worldvegKenyaCabbageCandidates({ ...context, ...change }, 'cabbage', base.recordedAt, true), []);
  }
  assert.deepEqual(worldvegKenyaCabbageCandidates(context, CROPS[0].key === 'cabbage' ? CROPS[1].key : CROPS[0].key, base.recordedAt, true), []);
  const candidates = worldvegKenyaCabbageCandidates(context, 'cabbage', base.recordedAt, true);
  assert.equal(candidates.length, 1);
  const input = { ...base, context, candidates };
  const result = resolved(input);
  assert.equal(result.activeEstablishment, 'transplant');
  for (const [field, value] of Object.entries(result.fields)) {
    if (field !== 'establishment') assert.equal(value.activeInput.state, 'missing', field);
  }
  assert.equal(result.assessment.estimatedPlantCount.value, null);
  assert.equal(result.assessment.estimatedYieldKg.value, null);
  assert.equal(result.assessment.schedule.nurseryStartDate.value, null);
  assert.equal(result.assessment.schedule.firstHarvestDate.value, null);
  assert.equal(result.assessment.entryWindow, 'unknown');
  assert.match(result.fields.establishment.assumptions.join(' '), /growth stage, not a number of nursery days/);
  assert.equal(result.fields.establishment.sourceBindings[0].publishedOn, null);
  assert.equal(result.fields.establishment.sourceBindings[0].publishedMonth, '2024-06');
  assert.equal(result.fields.establishment.sourceBindings[0].evidenceState, 'available-reference');
  const html = buildProvisionalCropPreviewHtml(input, { bedLabel: 'Synthetic bed', sample: true })!.html;
  assert.match(html, /2024-06 \(day unknown\)/);
  assert.doesNotMatch(html, /2024-06-01|2024-06-26/);
  assert.match(html, /Rapando N/); assert.match(html, /CC BY-SA 3.0/); assert.match(html, /creativecommons.org/);
  assert.match(html, /not an exclusive boundary or site certification/);
  assert.match(html, /no plant density is derived/);
  const override = resolved({ ...input, overrides: { establishment: { state: 'provided', value: 'direct', unit: 'method',
    provenance: { kind: 'grower-estimate', recordedAt: base.recordedAt } } } });
  assert.equal(override.activeEstablishment, 'direct');
  assert.equal(override.fields.establishment.status, 'overridden');
  assert.equal(override.fields.establishment.baselineDefault?.state, 'provided');
  assert.equal(override.fields.establishment.sourceBindings[0].id, WORLDVEG_KENYA_CABBAGE_SOURCE.id);
  assert.equal(evaluateCountryReadiness({ countryCode: 'KE' }, base.asOf).localReviewComplete, false);
});


function canadaRequest(month = 4): ProvisionalDraftRequest {
  const at = '2026-11-14T12:00:00.000Z';
  const context = { ...request().context, countryCode: 'CA', establishment: 'transplant' as const, varietyReference: null };
  return request({ cropKey: 'cabbage', context, recordedAt: at, asOf: '2026-11-14',
    candidates: canadaCabbageCandidates(context, 'cabbage', at, true),
    overrides: { establishment: { state: 'provided', value: 'transplant', unit: 'method', provenance: { kind: 'grower-estimate', recordedAt: at } } },
    fieldEntryDate: { state: 'provided', value: `2027-${String(month).padStart(2, '0')}-15`, unit: 'utc-date',
      provenance: { kind: 'grower-estimate', recordedAt: at } } });
}

test('Canadian cabbage month facts preserve aggregate, April and copyright limits through actual resolution and export', () => {
  for (let month = 1; month <= 12; month++) {
    const input = canadaRequest(month), result = resolved(input);
    assert.equal(result.profile.version, 2);
    assert.equal(result.assessment.entryWindow, month >= 4 && month <= 7 ? 'reported-positive' : 'unknown');
    assert.equal(result.fields.allowedEntryMonths.activeTier, 'historical-public-reference');
    assert.equal(result.activeEstablishment, 'transplant');
    assert.equal(result.assessment.estimatedPlantCount.value, null); assert.equal(result.assessment.estimatedYieldKg.value, null);
    assert.ok(Object.values(result.assessment.schedule).every(row => row.value === null));
    assert.equal(result.temperatureComparison, undefined);
    const binding = result.fields.allowedEntryMonths.sourceBindings[0];
    assert.equal(binding.publishedYear, 2025); assert.equal(binding.publishedMonth, null); assert.equal(binding.publishedOn, null);
    assert.equal(AAFC_CANADA_CABBAGE_SOURCE.licence.status, 'unknown');
    assert.match(binding.reuseTerms, /Limited independently worded month facts/);
    const html = buildProvisionalCropPreviewHtml(input, { bedLabel: 'Synthetic Canadian bed', sample: true })!.html;
    assert.ok(html.includes(AAFC_CABBAGE_PDF_SHA256)); assert.ok(html.includes(AAFC_CABBAGE_QUALIFIER));
    assert.match(html, /2025 \(month\/day unknown\)/); assert.match(html, /document reproduction permission is not established/);
    assert.ok(html.indexOf('Canadian source conditions') < html.indexOf('<h2>Evidence and grower edits'));
  }
});

test('Canadian fact admission requires exact data-only reviewed capsules, unchanged qualifiers and scope', () => {
  const req = canadaRequest(), original = req.candidates[0];
  const changes: Array<(c: any) => void> = [
    c => { c.input.value = [3, 4, 5, 6, 7]; }, c => { c.field = 'nurseryDays'; c.input.value = 28; c.input.unit = 'days'; },
    c => { c.assumptions = []; }, c => { c.source.licence = { status: 'known', value: 'open licence' }; },
    c => { c.source.publishedOn = '2025-01-01'; }, c => { c.source.publishedYear = 2024; },
    c => { c.source.url += '?other'; }, c => { c.entryMonthCoverage = undefined; },
    c => { c.temporalScope.kind = 'recurring-season'; }, c => { c.geography.countryCode = 'US'; },
    c => { c.tier = 'local-public-evidence'; }, c => { c.assumptions[1] = 'changed hash'; },
    c => { c.input.provenance.recordedAt = '2026-11-13T12:00:00.000Z'; },
  ];
  for (const change of changes) {
    const candidate = structuredClone(original); change(candidate);
    assert.equal(canadaCabbageFactReuse(candidate, req.context, req.recordedAt), null);
    assert.equal(resolved({ ...req, candidates: [candidate] }).fields.allowedEntryMonths.activeTier, null);
  }
  const accessor = structuredClone(original); let invoked = 0;
  Object.defineProperty(accessor, 'assumptions', { enumerable: true, get() { invoked++; return original.assumptions; } });
  assert.equal(canadaCabbageFactReuse(accessor, req.context, req.recordedAt), null); assert.equal(invoked, 0);
  const reordered = Object.fromEntries(Object.entries(structuredClone(original)).reverse()) as unknown as ProvisionalFieldCandidate;
  assert.ok(canadaCabbageFactReuse(reordered, req.context, req.recordedAt));
  for (const context of [{ ...req.context, countryCode: 'US' }, { ...req.context, establishment: 'direct' as const },
    { ...req.context, establishment: null }, { ...req.context, varietyReference: 'named cultivar' }]) {
    assert.deepEqual(canadaCabbageCandidates(context, 'cabbage', req.recordedAt, true), []);
    assert.equal(resolved({ ...req, context }).fields.allowedEntryMonths.activeTier, null);
  }
  assert.deepEqual(canadaCabbageCandidates(req.context, 'cabbage', req.recordedAt, false), []);
  assert.deepEqual(canadaCabbageCandidates(req.context, 'tomatoes', req.recordedAt, true), []);
});

test('Canadian source-only windows remain unadoptable while independently entered estimates and edits stay useful', () => {
  const input = canadaRequest(8);
  const supplied = (value: unknown, unit: string) => ({ state: 'provided', value, unit,
    provenance: { kind: 'grower-estimate', recordedAt: input.recordedAt } });
  const next = { ...input, overrides: { ...input.overrides, nurseryDays: supplied(20, 'days'), plantsPerM2: supplied(2, 'plants/m2') } };
  const value = resolved(next);
  assert.equal(value.assessment.estimatedPlantCount.value, 21); assert.equal(value.assessment.schedule.nurseryStartDate.value, '2027-07-26');
  assert.equal(value.assessment.entryWindow, 'unknown'); assert.equal(value.profile.version, 2);
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: 'virtual-bed', sourceKey: 'synthetic-saved-source',
    resourceSiteId: 'virtual-bed', scope: input.context.scope, geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64),
    freshness: 'device-saved-copy', sourceVerification: 'not-verified', beds: [{ id: 'bed-1', label: 'Synthetic Canadian bed', areaM2: 10.5 }],
    measuredAreas: [{ bedId: 'bed-1', areaM2: 10.5, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
  const saved = createSavedProvisionalProfile(next, 'canada-synthetic', input.recordedAt, source, 'bed-1', 'Synthetic Canadian bed');
  assert.ok(saved); const read = readSavedProvisionalProfile(saved); assert.ok(read);
  assert.equal(read.result.fingerprint, value.fingerprint); assert.ok(read.result.fields.allowedEntryMonths.assumptions.includes(AAFC_CABBAGE_QUALIFIER));
  assert.equal(resolved({ ...next, overrides: { ...next.overrides, allowedEntryMonths: supplied([], 'utc-months') } }).assessment.entryWindow, 'excluded');
  const own = resolved({ ...next, overrides: { ...next.overrides, allowedEntryMonths: supplied([8], 'utc-months') } });
  assert.equal(own.assessment.entryWindow, 'allowed'); assert.equal(own.profile.version, 1);
  assert.deepEqual(own.fields.allowedEntryMonths.baselineDefault, value.fields.allowedEntryMonths.baselineDefault);
});

test('year-only publication is precise, conservative and cannot bypass conflicting or future dates', () => {
  const source = AAFC_CANADA_CABBAGE_SOURCE;
  assert.equal(sourcePublicationIsKnownBy(source, '2025-12-31'), false);
  assert.equal(sourcePublicationIsKnownBy(source, '2026-01-01'), true);
  assert.equal(sourcePublicationText(source), '2025 (month/day unknown)');
  for (const bad of [{ publishedYear: 2026 }, { publishedYear: 0 }, { publishedYear: 2025.5 },
    { publishedOn: '2025-01-01' }, { publishedMonth: '2025-03' }]) {
    assert.equal(sourcePublicationIsKnownBy({ ...source, ...bad }, '2026-01-01'), false);
  }
  assert.equal(sourcePublicationText({ ...source, publishedMonth: '2025-03' }), 'Unknown');
});


test('historical fallback cannot reinterpret a future, malformed or conflicting supplied year as an undated source', () => {
  const make = (year: unknown) => candidate('plantsPerM2', 2, { tier: 'historical-public-reference',
    temporalScope: { kind: 'historical-transfer', period: 'Historical engineering fixture', assumption: 'Explicit fixture transfer' },
    assumptions: ['Fixture only'], source: { ...source, publishedOn: null, publishedYear: year } as CountrySource });
  for (const year of [2027, 0, '2025', 2025.5]) assert.equal(resolved(request({ candidates: [make(year)] })).fields.plantsPerM2.activeTier, null);
  assert.equal(resolved(request({ candidates: [make(2025)] })).fields.plantsPerM2.activeTier, 'historical-public-reference');
  const conflict = make(2025); conflict.source!.publishedMonth = '2025-03';
  assert.equal(resolved(request({ candidates: [conflict] })).fields.plantsPerM2.activeTier, null);
  const recurring = { ...make(2025), temporalScope: { kind: 'recurring-season' as const } };
  assert.equal(resolved(request({ candidates: [recurring] })).fields.plantsPerM2.activeTier, null);
});


test('actual Canadian source capsule cannot grant full planning permission even with otherwise complete own estimates', () => {
  const input = canadaRequest(4);
  const overrides = Object.fromEntries(Object.entries(values).filter(([key]) => !['allowedEntryMonths', 'establishment', 'nurseryDays'].includes(key))
    .map(([key, [value, unit]]) => [key, { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: input.recordedAt } }]));
  const result = resolved({ ...input, overrides: { ...input.overrides, ...overrides,
    nurseryDays: { state: 'provided', value: 20, unit: 'days', provenance: { kind: 'grower-estimate', recordedAt: input.recordedAt } } } });
  const full = assessGrowerPlanning({ profile: result.profile, scope: input.context.scope,
    measuredAreaM2: input.measuredAreaM2, fieldEntryDate: input.fieldEntryDate });
  assert.equal(full.status, 'missing-inputs');
  if (full.status === 'missing-inputs') assert.deepEqual(full.issues, ['needs-grower-entry-window']);
});


test('saved-cycle review context stays held rather than throwing before site conditions arrive', () => {
  const source = { freshness: 'device-saved-copy', kind: 'studio-canvas', sourceKey: 'fixture',
    sourceRevision: 'a'.repeat(64), geometryFingerprint: 'b'.repeat(64) } as GrowerWorkflowSource;
  assert.equal(createProvisionalCycleContext(source, undefined, recordedAt), null);
  assert.equal(createProvisionalCycleContext(source, null, recordedAt), null);
  assert.equal(createProvisionalCycleContext(source, { countryCode: null, agriculturalRegionReference: null,
    policyFingerprint: 'fixture-policy', knownPlantingRestriction: null }, 'not-a-date'), null);
});


function saskatchewanRequest(basis: 'lower-bound' | 'upper-bound' = 'lower-bound'): ProvisionalDraftRequest {
  const base = canadaRequest(5), context = { ...base.context, agriculturalRegionReference: 'Saskatoon', varietyReference: 'grower-named variety, unvalidated' };
  return { ...base, context, candidates: saskatchewanCabbageNurseryCandidates(context, 'cabbage', base.recordedAt, true,
    { purpose: 'seed-raised-nursery-to-outdoor', basis }),
    fieldEntryDate: { state: 'provided', value: '2027-05-20', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt: base.recordedAt } } };
}

test('USask endpoints give conditional seed-start dates with independent unknowns and source-specific visible export qualifications', () => {
  for (const [basis, days, date] of [['lower-bound', 35, '2027-04-15'], ['upper-bound', 42, '2027-04-08']] as const) {
    const input = saskatchewanRequest(basis), r = resolved(input);
    assert.deepEqual(input.candidates.map(c => c.field), ['nurseryDays']); assert.equal(r.activeEstablishment, 'transplant');
    assert.equal(r.fields.nurseryDays.activeTier, 'historical-public-reference');
    assert.equal(r.fields.nurseryDays.activeInput.state, 'provided');
    if (r.fields.nurseryDays.activeInput.state === 'provided') assert.equal(r.fields.nurseryDays.activeInput.value, days);
    assert.deepEqual(r.fields.nurseryDays.defaultReportedRange, [35, 42]); assert.equal(r.fields.nurseryDays.defaultPlanningValueBasis, basis);
    assert.equal(r.assessment.schedule.nurseryStartDate.value, date); assert.equal(r.assessment.entryWindow, 'unknown');
    assert.equal(r.assessment.estimatedPlantCount.value, null); assert.equal(r.assessment.estimatedYieldKg.value, null);
    assert.equal(r.assessment.schedule.firstHarvestDate.value, null); assert.equal(r.assessment.schedule.nextFieldEntryDate.value, null);
    assert.equal(r.profile.version, 1); assert.equal(r.fields.nurseryDays.sourceBindings[0].evidenceState, 'undated');
    const full = assessGrowerPlanning({ profile: r.profile, scope: input.context.scope, measuredAreaM2: input.measuredAreaM2, fieldEntryDate: input.fieldEntryDate });
    assert.equal(full.status, 'missing-inputs');
    const html = buildProvisionalCropPreviewHtml(input, { sample: true, bedLabel: 'Synthetic nursery bed' })!.html;
    assert.ok(html.includes(USASK_CABBAGE_ORIGINAL_SHA256)); assert.match(html, /approximately 5–6 weeks/);
    assert.match(html, new RegExp(`Source choice: ${basis}, ${days} days`)); assert.match(html, /several consecutive nights/);
    assert.match(html, /monthly means cannot substitute/); assert.match(html, /Publication\/revision unknown/);
    // A full-width qualification cannot squeeze every output label into a tiny column.
    assert.match(html, /<tr class="nursery-reference"><td colspan="2"><p><strong>Nursery start \(UTC\):/);
    assert.ok(html.indexOf('Nursery source conditions') < html.indexOf('Evidence and grower edits'));
    assert.equal(input.candidates[0].source!.licence.status, 'unknown');
    assert.match(saskatchewanNurseryResultQualifier(r.fields)!, /not proof of readiness/);
  }
});

test('USask admission is exact and cannot borrow known-licence or AAFC permissions for altered ranges, fields or scope', () => {
  const input = saskatchewanRequest(), original = input.candidates[0];
  const mutations: Array<(c: any) => void> = [
    c => { c.input.value = 38.5; }, c => { c.reportedRange = [28, 42]; }, c => { c.planningValueBasis = 'reported-point'; },
    c => { c.field = 'fieldEntryToFirstHarvestDays'; }, c => { c.field = 'establishment'; c.input.value = 'transplant'; c.input.unit = 'method'; },
    c => { c.assumptions = []; }, c => { c.assumptions[1] = 'unknown hash'; }, c => { c.source.licence = { status: 'known', value: 'open' }; },
    c => { c.source.publishedOn = '2026-01-01'; }, c => { c.source.id = 'other'; c.source.licence = { status: 'known', value: 'open' }; },
    c => { c.temporalScope.kind = 'recurring-season'; }, c => { c.geography.regionReference = 'Saskatchewan'; },
    c => { c.input.provenance.recordedAt = '2026-11-13T12:00:00.000Z'; }, c => { c.assumptions[2] = 'purchased seedlings'; },
  ];
  for (const mutate of mutations) {
    const c = structuredClone(original); mutate(c);
    assert.equal(saskatchewanNurseryFactReuse(c, input.context, input.recordedAt), null);
    assert.equal(resolved({ ...input, candidates: [c] }).fields.nurseryDays.activeTier, null);
  }
  let accessed = 0; const accessor = structuredClone(original);
  Object.defineProperty(accessor, 'planningValueBasis', { enumerable: true, get() { accessed++; return 'lower-bound'; } });
  assert.equal(saskatchewanNurseryFactReuse(accessor, input.context, input.recordedAt), null); assert.equal(accessed, 0);
  const use = { purpose: 'seed-raised-nursery-to-outdoor' as const, basis: 'lower-bound' as const };
  for (const context of [{ ...input.context, countryCode: 'US' }, { ...input.context, agriculturalRegionReference: null },
    { ...input.context, agriculturalRegionReference: 'Ontario' }, { ...input.context, agriculturalRegionReference: 'Saskatchewan' },
    { ...input.context, establishment: null }, { ...input.context, establishment: 'direct' as const }]) {
    assert.deepEqual(saskatchewanCabbageNurseryCandidates(context, 'cabbage', input.recordedAt, true, use), []);
    assert.equal(resolved({ ...input, context }).fields.nurseryDays.activeTier, null);
  }
  assert.deepEqual(saskatchewanCabbageNurseryCandidates(input.context, 'cabbage', input.recordedAt, false, use), []);
  assert.deepEqual(saskatchewanCabbageNurseryCandidates(input.context, 'cabbage', input.recordedAt, true, null), []);
  assert.deepEqual(saskatchewanCabbageNurseryCandidates(input.context, 'cabbage', input.recordedAt, true, { ...use, purpose: 'purchased' } as any), []);
  assert.deepEqual(saskatchewanCabbageNurseryCandidates(input.context, 'tomatoes', input.recordedAt, true, use), []);
  const raw = { ...input.context, agriculturalRegionReference: '  SASKATCHEWAN   PRAIRIE  ' };
  const entries = saskatchewanCabbageNurseryCandidates(raw, 'cabbage', input.recordedAt, true, use);
  assert.equal(entries[0].geography.kind, 'region'); if (entries[0].geography.kind === 'region') assert.equal(entries[0].geography.regionReference, raw.agriculturalRegionReference);
});

test('USask independent overrides stay distinct from the retained source endpoint and unrelated exclusions still hold', () => {
  const input = saskatchewanRequest();
  const provided = (value: unknown, unit: string) => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: input.recordedAt } });
  const own = resolved({ ...input, overrides: { ...input.overrides, nurseryDays: provided(40, 'days') } });
  assert.equal(own.assessment.schedule.nurseryStartDate.value, '2027-04-10');
  assert.match(saskatchewanNurseryResultQualifier(own.fields)!, /Active nursery duration is a grower edit/);
  assert.equal(own.fields.nurseryDays.baselineDefault?.state, 'provided');
  const clear = resolved({ ...input, overrides: { ...input.overrides, nurseryDays: { state: 'missing', reason: 'not-entered' } } });
  assert.equal(clear.assessment.schedule.nurseryStartDate.value, null);
  assert.equal(resolved(input).assessment.schedule.nurseryStartDate.value, '2027-04-15');
  const excluded = resolved({ ...input, overrides: { ...input.overrides, allowedEntryMonths: provided([], 'utc-months') } });
  assert.equal(excluded.assessment.entryWindow, 'excluded'); assert.equal(excluded.assessment.schedule.nurseryStartDate.value, null);
});


test('two admissible USask endpoint capsules conflict rather than selecting or averaging a nursery lead', () => {
  const input = saskatchewanRequest();
  const r = resolved({ ...input, candidates: [...input.candidates, ...saskatchewanRequest('upper-bound').candidates] });
  assert.equal(r.fields.nurseryDays.status, 'conflict'); assert.equal(r.assessment.schedule.nurseryStartDate.value, null);
  assert.match(saskatchewanNurseryResultQualifier(r.fields)!, /Conflicting nursery endpoints remain unresolved/);
});


test('print compaction keeps only untouched unknowns short and fails closed for evidence-bearing metadata', () => {
  const input = request({ candidates: [] }), field = resolved(input).fields.plantsPerM2;
  assert.equal(provisionalFieldCanUseMissingRow('plantsPerM2', field, input), true);
  const changed = [
    { status: 'overridden' }, { activeInput: { state: 'missing', reason: 'withheld' } },
    { activeInput: { state: 'missing', reason: 'not-known', note: 'new metadata' } },
    { activeTier: 'grower-estimate' }, { baselineDefault: { state: 'missing', reason: 'not-known' } },
    { defaultConflict: true }, { defaultCandidateIds: ['candidate'] }, { defaultOptions: [{}] },
    { sourceReferences: ['https://example.invalid/reference'] }, { sourceBindings: [{}] },
    { assumptions: ['Unverified condition'] }, { defaultReportedRange: [0, 1] },
    { defaultPlanningValueBasis: 'lower-bound' }, { defaultEntryMonthCoverage: 'positive-only' },
    { futureEvidence: 'Do not hide new semantics' },
  ];
  for (const change of changed) assert.equal(provisionalFieldCanUseMissingRow('plantsPerM2',
    { ...field, ...change } as typeof field, input), false, JSON.stringify(change));
  assert.equal(provisionalFieldCanUseMissingRow('plantsPerM2', field,
    { ...input, overrides: { plantsPerM2: undefined } }), false);
  assert.equal(provisionalFieldCanUseMissingRow('plantsPerM2', field,
    { ...input, candidates: [candidate('plantsPerM2', 2, { reuseReview: 'not-reviewed' } as never)] }), false);
  assert.equal(provisionalFieldCanUseMissingRow('plantsPerM2', field,
    { ...input, candidates: [{ field: 'unmappable' } as never] }), false);
});

test('printed unknown rows retain each meaning while zero, withheld, invalid, exclusion and rejected defaults stay detailed', () => {
  const empty = request({ candidates: [] });
  const render = (input: ProvisionalDraftRequest) => buildProvisionalCropPreviewHtml(input,
    { sample: true, bedLabel: 'Synthetic bed' })!;
  const before = JSON.stringify(empty), result = resolved(empty), document = render(empty);
  assert.equal(document.fingerprint, result.fingerprint); assert.equal(JSON.stringify(empty), before);
  for (const key of Object.keys(values)) {
    assert.ok(document.html.includes(`<th scope="row">${provisionalLabels[key]}</th><td>missing</td>`));
  }
  assert.equal((document.html.match(/<td>Unknown<\/td>/g) ?? []).length, 27, 'three explicit unknown meanings per missing input');
  const own = (value: unknown, unit: string) => ({ state: 'provided', value, unit,
    provenance: { kind: 'grower-estimate', recordedAt } });
  for (const override of [own(0, 'days'), { state: 'missing', reason: 'not-known' }, own(-1, 'days')]) {
    const html = render({ ...empty, overrides: { nurseryDays: override } }).html;
    assert.ok(html.includes('<h3>Nursery duration (days)</h3>'));
    assert.ok(!html.includes('<th scope="row">Nursery duration (days)</th>'));
    if ('value' in override && override.value === 0) assert.match(html, /0 days/);
    else assert.match(html, /Grower withheld this value|Invalid override/);
  }
  assert.ok(render({ ...empty, overrides: { allowedEntryMonths: own([], 'utc-months') } }).html.includes('<h3>Field-entry months</h3>'));
  const rejected = render({ ...empty, candidates: [candidate('plantsPerM2', 2, { geography: { kind: 'country', countryCode: 'US' } })] }).html;
  assert.ok(rejected.includes('<h3>Plant density (plants per m²)</h3>'));
  assert.match(rejected, /Evidence not used/);
  const conflict = render({ ...empty, candidates: [candidate('plantsPerM2', 2), candidate('plantsPerM2', 3, { id: 'other-density' })] }).html;
  assert.match(conflict, /Conflicting defaults remain unresolved/);
  assert.match(conflict, /Default source-plantsPerM2/); assert.match(conflict, /Default other-density/);
});
