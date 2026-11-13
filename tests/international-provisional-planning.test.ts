import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS } from '../lib/crop-catalog.ts';
import { sourceEvidenceState, sourcePublicationIsKnownBy, sourcePublicationText, evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';
import { WORLDVEG_KENYA_CABBAGE_SOURCE, worldvegKenyaCabbageCandidates } from '../lib/international/providers/worldveg-kenya-cabbage.ts';
import { worldvegKenyaCowpeaCandidates, worldvegKenyaCowpeaSpacing } from '../lib/international/providers/worldveg-kenya-cowpea.ts';
import { usdaGreatLakesCabbageCandidates } from '../lib/international/providers/usda-great-lakes-cabbage.ts';
import { usdaGreatLakesTomatoCandidates, usdaGreatLakesTomatoReference, USDA_TOMATO_NURSERY } from '../lib/international/providers/usda-great-lakes-tomato.ts';
import { buildProvisionalCropPreviewHtml } from '../lib/international/provisional-crop-export.ts';
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
