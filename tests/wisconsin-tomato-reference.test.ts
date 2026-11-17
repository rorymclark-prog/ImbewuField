import { createSavedProvisionalProfile, createProvisionalCycleContext, reviewProvisionalCycleProfile, readSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import { buildProvisionalCycleEvidence, buildAdoptedProvisionalCycleHtml } from '../lib/international/provisional-crop-export.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, resolvePlantingBasis } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest, type ProvisionalFieldCandidate } from '../lib/international/provisional-crop-planning.ts';
import { WISCONSIN_TOMATO_NURSERY_SOURCE, WISCONSIN_TOMATO_NURSERY, wisconsinTomatoNurseryCandidates,
  wisconsinTomatoNurseryFactReuse, wisconsinTomatoReferenceReceipt, type WisconsinTomatoNurseryBasis } from '../lib/international/providers/wisconsin-tomato-nursery.ts';
import { usdaGreatLakesTomatoCandidates, usdaWisconsinTomatoCandidates, usdaWisconsinTomatoFactReuse } from '../lib/international/providers/usda-great-lakes-tomato.ts';

const at = '2026-11-17T12:00:00.000Z';
const context = { scope: { kind: 'unmapped-workspace' as const, workspaceId: 'design:wisconsin-fixture' }, countryCode: 'US',
  agriculturalRegionReference: 'Wisconsin', establishment: 'transplant' as const, waterRegime: 'irrigated' as const };
const purpose = 'seed-raised-nursery-to-outdoor' as const;
const wisconsin = (basis: WisconsinTomatoNurseryBasis = 'lower-bound') => wisconsinTomatoNurseryCandidates(context, 'tomatoes', at, true, { purpose, basis });
const transfer = () => usdaWisconsinTomatoCandidates(context, 'tomatoes', at, true, purpose);
function request(candidates: readonly ProvisionalFieldCandidate[] = [...wisconsin(), ...transfer()]): ProvisionalDraftRequest {
  return { profileId: 'wisconsin-fixture', cropKey: 'tomatoes', context, recordedAt: at, asOf: '2026-11-17', candidates,
    overrides: { establishment: { state: 'provided', value: 'transplant', unit: 'method', provenance: { kind: 'grower-estimate', recordedAt: at } } },
    measuredAreaM2: { state: 'missing', reason: 'not-known' },
    fieldEntryDate: { state: 'provided', value: '2027-06-01', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt: at } } };
}
function resolved(input = request()) {
  const result = resolveProvisionalCropPlan(input);
  if (result.status !== 'resolved') assert.fail(`Expected resolved partial result, got ${result.status}`);
  return result;
}

test('Wisconsin seed-to-outdoor interval is an explicit endpoint historical fact with unknown document licence', () => {
  assert.deepEqual(WISCONSIN_TOMATO_NURSERY, { weeks: [4, 8], days: [28, 56] });
  for (const basis of ['lower-bound', 'upper-bound'] as const) {
    const c = wisconsin(basis)[0];
    assert.equal(c.field, 'nurseryDays'); assert.equal(c.tier, 'historical-public-reference');
    assert.equal(c.planningValueBasis, basis); assert.deepEqual(c.reportedRange, [28, 56]);
    assert.equal((c.input as { value: number }).value, basis === 'lower-bound' ? 28 : 56);
    assert.match(wisconsinTomatoNurseryFactReuse(c, context, at)!, /licence.*unknown/);
    assert.ok(Object.isFrozen(c)); assert.ok(Object.isFrozen(c.source)); assert.ok(Object.isFrozen(c.assumptions));
  }
  assert.equal(WISCONSIN_TOMATO_NURSERY_SOURCE.licence.status, 'unknown');
  assert.equal(WISCONSIN_TOMATO_NURSERY_SOURCE.publishedOn, null);
  assert.equal(WISCONSIN_TOMATO_NURSERY_SOURCE.publishedMonth, null);
  assert.match(WISCONSIN_TOMATO_NURSERY_SOURCE.attribution, /Revised April 2017/);
});

test('Wisconsin requires confirmed country, exact declared region, existing crop, protected seed-to-outdoor purpose and deliberate endpoint', () => {
  for (const change of [{ countryCode: null }, { countryCode: 'CA' }, { countryCode: 'OTHER' },
    { agriculturalRegionReference: null }, { agriculturalRegionReference: 'Great Lakes States' },
    { agriculturalRegionReference: 'Michigan' }, { agriculturalRegionReference: 'Wisconsin prairie' },
    { establishment: null }, { establishment: 'direct' as const }]) {
    assert.deepEqual(wisconsinTomatoNurseryCandidates({ ...context, ...change }, 'tomatoes', at, true, { purpose, basis: 'lower-bound' }), []);
    assert.deepEqual(usdaWisconsinTomatoCandidates({ ...context, ...change }, 'tomatoes', at, true, purpose), []);
  }
  assert.deepEqual(wisconsinTomatoNurseryCandidates(context, 'cabbage', at, true, { purpose, basis: 'lower-bound' }), []);
  assert.deepEqual(wisconsinTomatoNurseryCandidates(context, 'tomatoes', at, false, { purpose, basis: 'lower-bound' }), []);
  assert.deepEqual(wisconsinTomatoNurseryCandidates(context, 'tomatoes', at, true, null), []);
  for (const use of [{ purpose, basis: null }, { purpose, basis: 'midpoint' }, { purpose: 'purchased-seedling-age', basis: 'lower-bound' },
    { purpose: 'protected-production-harvest', basis: 'lower-bound' }]) {
    assert.deepEqual(wisconsinTomatoNurseryCandidates(context, 'tomatoes', at, true, use as never), []);
  }
  assert.deepEqual(usdaWisconsinTomatoCandidates(context, 'tomatoes', at, false, purpose), []);
  assert.deepEqual(usdaWisconsinTomatoCandidates(context, 'tomatoes', at, true, null), []);
  assert.deepEqual(usdaWisconsinTomatoCandidates(context, 'tomatoes', at, true, 'purchased-seedling-age' as never), []);
  assert.deepEqual(usdaWisconsinTomatoCandidates(context, 'cabbage', at, true, purpose), []);
});

test('historical Wisconsin wins over separately consented USDA transfer independently of candidate order and equal endpoint values', () => {
  for (const basis of ['lower-bound', 'upper-bound'] as const) {
    const a = [...wisconsin(basis), ...transfer()];
    const forward = resolved(request(a)); const reverse = resolved(request([...a].reverse()));
    assert.equal(forward.fingerprint, reverse.fingerprint);
    for (const result of [forward, reverse]) {
      const field = result.fields.nurseryDays;
      assert.equal(field.activeTier, 'historical-public-reference');
      assert.deepEqual(field.defaultCandidateIds, [wisconsin(basis)[0].id]);
      assert.equal(field.sourceBindings[0].id, WISCONSIN_TOMATO_NURSERY_SOURCE.id);
      assert.equal(field.activeInput.state, 'provided');
      if (field.activeInput.state === 'provided') assert.equal(field.activeInput.value, basis === 'lower-bound' ? 28 : 56);
      assert.equal(result.assessment.schedule.nurseryStartDate.value, basis === 'lower-bound' ? '2027-05-04' : '2027-04-06');
      assert.equal(result.assessment.entryWindow, 'unknown');
      assert.equal(result.assessment.estimatedPlantCount.value, null); assert.equal(result.assessment.estimatedYieldKg.value, null);
      assert.equal(result.assessment.schedule.firstHarvestDate.value, null); assert.equal(result.assessment.schedule.fieldClearDate.value, null);
    }
  }
});

test('no-consent stays unknown and USDA-only explicit Wisconsin transfer remains rank two', () => {
  assert.equal(resolved(request([])).fields.nurseryDays.status, 'missing');
  const result = resolved(request(transfer()));
  assert.equal(result.fields.nurseryDays.activeTier, 'climate-crop-derived');
  assert.equal(result.assessment.schedule.nurseryStartDate.value, '2027-04-06');
  assert.match(usdaWisconsinTomatoFactReuse(transfer()[0], context, at)!, /Numerical table facts only/);
  assert.equal(result.fields.nurseryDays.sourceBindings[0].publishedOn, null);
  assert.equal(result.fields.nurseryDays.sourceBindings[0].evidenceState, 'undated');
  const receipt = wisconsinTomatoReferenceReceipt(request(transfer()), result.fields)!;
  assert.match(receipt.qualifier, /undated USDA Great Lakes/);
  assert.match(receipt.qualifier, /No Wisconsin article endpoint was consented/);
  assert.doesNotMatch(receipt.qualifier, /revised April 2017/);
  assert.equal(receipt.references.length, 1); assert.equal(receipt.references[0].selected, true);
});

test('grower edits change active duration while retaining the chosen historical baseline and reset is deterministic', () => {
  const base = request();
  const edited = resolved({ ...base, overrides: { ...base.overrides, nurseryDays: { state: 'provided', value: 40, unit: 'days',
    provenance: { kind: 'grower-estimate', recordedAt: at } } } });
  assert.equal(edited.fields.nurseryDays.status, 'overridden'); assert.equal(edited.fields.nurseryDays.activeTier, 'grower-estimate');
  assert.equal(edited.fields.nurseryDays.baselineDefault?.state, 'provided');
  if (edited.fields.nurseryDays.baselineDefault?.state === 'provided') assert.equal(edited.fields.nurseryDays.baselineDefault.value, 28);
  assert.equal(edited.assessment.schedule.nurseryStartDate.value, '2027-04-22');
  const withheld = resolved({ ...base, overrides: { ...base.overrides, nurseryDays: { state: 'missing', reason: 'not-known' } } });
  assert.equal(withheld.fields.nurseryDays.activeInput.state, 'missing');
  assert.equal(resolved(base).fingerprint, resolved(request()).fingerprint);
  const direct = resolved({ ...base, overrides: { establishment: { state: 'provided', value: 'direct', unit: 'method',
    provenance: { kind: 'grower-estimate', recordedAt: at } } } });
  assert.equal(direct.fields.nurseryDays.status, 'missing');
});

test('limited Wisconsin fact reuse rejects altered metadata, phase, range, value, source, date and scope capsules', () => {
  const edits: Array<(c: any) => void> = [
    c => { c.source.url += '?changed'; }, c => { c.source.id += '-changed'; }, c => { c.source.attribution = 'Unreviewed'; },
    c => { c.source.licence = { status: 'known', value: 'Invented open licence' }; },
    c => { c.source.accessedOn = '2020-01-01'; }, c => { c.source.publishedOn = '2017-04-01'; },
    c => { c.tier = 'local-public-evidence'; }, c => { c.tier = 'climate-crop-derived'; },
    c => { c.geography = { kind: 'country', countryCode: 'US' }; }, c => { c.input.value = 42; },
    c => { c.reportedRange = [28, 42]; }, c => { c.planningValueBasis = 'reported-point'; },
    c => { c.establishment = 'any'; }, c => { c.temporalScope.kind = 'recurring-season'; },
    c => { c.input.provenance.recordedAt = '2026-11-16T12:00:00.000Z'; },
    c => { c.id = c.id.replace(/d411bbb6/, '00000000'); }, c => { c.assumptions[0] = 'Purchased seedlings'; },
  ];
  for (const edit of edits) {
    const c = JSON.parse(JSON.stringify(wisconsin()[0])); edit(c);
    assert.equal(wisconsinTomatoNurseryFactReuse(c, context, at), null);
    assert.equal(resolved(request([c])).fields.nurseryDays.status, 'missing');
  }
  assert.equal(wisconsinTomatoNurseryFactReuse(wisconsin()[0], { ...context, agriculturalRegionReference: 'Michigan' }, at), null);
  assert.equal(wisconsinTomatoNurseryFactReuse(wisconsin()[0], context, '2026-11-18T12:00:00.000Z'), null);
});

test('Wisconsin transfer capsules cannot become general country evidence or claim an altered phase', () => {
  for (const edit of [(c: any) => { c.geography = { kind: 'country', countryCode: 'US' }; },
    (c: any) => { c.input.value = 28; }, (c: any) => { c.assumptions[0] = 'Automatic Wisconsin default'; },
    (c: any) => { c.source.licence.value = 'New terms'; }]) {
    const c = JSON.parse(JSON.stringify(transfer()[0])); edit(c);
    assert.equal(usdaWisconsinTomatoFactReuse(c, context, at), null);
    assert.equal(resolved(request([c])).fields.nurseryDays.status, 'missing');
  }
  assert.equal(usdaWisconsinTomatoFactReuse(transfer()[0], { ...context, agriculturalRegionReference: 'Michigan' }, at), null);
});

test('new receipt retains both consented facts and nonselection reason without changing resolver result shape', () => {
  const input = request(); const result = resolved(input); const before = JSON.stringify(result);
  const receipt = wisconsinTomatoReferenceReceipt(input, result.fields)!;
  assert.equal(receipt.references.length, 2);
  const local = receipt.references.find(r => r.id === WISCONSIN_TOMATO_NURSERY_SOURCE.id)!;
  const transferred = receipt.references.find(r => r.id !== WISCONSIN_TOMATO_NURSERY_SOURCE.id)!;
  assert.equal(local.selected, true); assert.equal(local.days, 28); assert.match(local.reuseTerms, /unknown/);
  assert.equal(transferred.selected, false); assert.equal(transferred.days, 56); assert.match(transferred.reason, /higher evidence precedence/);
  assert.equal(JSON.stringify(result), before); assert.ok(Object.isFrozen(receipt.references));
  assert.deepEqual(wisconsinTomatoReferenceReceipt(request([...input.candidates].reverse()), result.fields), receipt);
  const tampered = JSON.parse(JSON.stringify(input.candidates)); tampered[0].source.attribution = 'Unreviewed';
  assert.equal(wisconsinTomatoReferenceReceipt(request(tampered), result.fields)!.references.length, 1);
  assert.equal(wisconsinTomatoReferenceReceipt(request([]), resolved(request([])).fields), null);
});

test('original Great Lakes aliases and nullable-method behaviour stay separate from Wisconsin transfer', () => {
  assert.deepEqual(usdaGreatLakesTomatoCandidates(context, 'tomatoes', at, true), []);
  const legacy = { ...context, agriculturalRegionReference: ' Great Lakes States ', establishment: null };
  const entries = usdaGreatLakesTomatoCandidates(legacy, 'tomatoes', at, true);
  assert.deepEqual(entries.map(c => c.field), ['establishment', 'nurseryDays']);
  assert.equal(entries[1].id, 'usda-nrcs-great-lakes-tomato-nursery');
  assert.equal(entries[1].geography.kind, 'region'); assert.equal(entries[1].tier, 'climate-crop-derived');
  assert.equal((entries[1].input as { value: number }).value, 56);
  for (const region of ['Wisconsin', 'Michigan', 'Great Lakes', 'Great Lakes States Wisconsin']) {
    assert.deepEqual(usdaGreatLakesTomatoCandidates({ ...legacy, agriculturalRegionReference: region }, 'tomatoes', at, true), []);
  }
  assert.deepEqual(usdaWisconsinTomatoCandidates(legacy, 'tomatoes', at, true, purpose), []);
  const input = { ...request(entries), context: legacy };
  assert.equal(resolved(input).fields.nurseryDays.activeTier, 'climate-crop-derived');
  assert.equal(wisconsinTomatoReferenceReceipt(input, resolved(input).fields), null);
});


test('conflicting Wisconsin endpoints cannot be averaged or silently replaced by the lower-ranked USDA reference', () => {
  const candidates = [...wisconsin('lower-bound'), ...wisconsin('upper-bound'), ...transfer()];
  for (const ordered of [candidates, [...candidates].reverse()]) {
    const input = request(ordered), result = resolved(input), field = result.fields.nurseryDays;
    assert.equal(field.status, 'conflict'); assert.equal(field.defaultConflict, true);
    assert.equal(field.activeInput.state, 'missing'); assert.equal(field.baselineDefault, null);
    assert.equal(result.assessment.schedule.nurseryStartDate.value, null);
    assert.equal(field.defaultCandidateIds.length, 2);
    assert.ok(field.defaultCandidateIds.every(id => id.startsWith(WISCONSIN_TOMATO_NURSERY_SOURCE.id)));
    const receipt = wisconsinTomatoReferenceReceipt(input, result.fields)!;
    assert.equal(receipt.references.length, 3);
    assert.ok(receipt.references.every(reference => !reference.selected && /conflict/.test(reference.reason)));
  }
});


test('both consented nursery facts and their selection reason survive real saved-profile review, cycle adoption and public exports', () => {
  const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
  const bed = { id: 'private-wisconsin-bed', label: 'Synthetic Wisconsin integration bed', areaM2: 12 };
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: scope.siteId,
    sourceKey: `studio-canvas:${scope.siteId}`, resourceSiteId: scope.siteId, scope, beds: [bed],
    measuredAreas: [{ bedId: bed.id, areaM2: 12, basis: 'explicit-saved-dimensions' }], heldBeds: [],
    sourceRevision: 'b'.repeat(64), geometryFingerprint: 'a'.repeat(64), freshness: 'device-saved-copy', sourceVerification: 'not-verified' };
  const target = { ...context, scope };
  const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
    provenance: { kind: 'grower-estimate', recordedAt: at, note: 'Synthetic grower estimate for integration testing only; not a source default or farming advice.' } });
  // Complete-plan quantities, field/harvest durations and entry windows are
  // independent synthetic grower estimates; only nursery lead is sourced.
  const choices = { establishment: own('transplant', 'method'), plantsPerM2: own(2, 'plants/m2'), yieldKgPerM2: own(3, 'kg/m2/cycle'),
    fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(3, 'days'), fieldOccupancyDays: own(5, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([6], 'utc-months') };
  const area: GrowerInput<number, 'm2'> = { state: 'provided', value: bed.areaM2, unit: 'm2',
    provenance: { kind: 'grower-record', recordedAt: at, reference: bed.id } };
  const entry = own('2027-06-01', 'utc-date');
  const original: ProvisionalDraftRequest = { ...request(), profileId: 'provisional-preview', context: target,
    candidates: [...wisconsinTomatoNurseryCandidates(target, 'tomatoes', at, true, { purpose, basis: 'lower-bound' }),
      ...usdaWisconsinTomatoCandidates(target, 'tomatoes', at, true, purpose)],
    overrides: choices, measuredAreaM2: area, fieldEntryDate: entry };
  const saved = createSavedProvisionalProfile(original, 'private-wisconsin-profile', at, source, bed.id, bed.label);
  assert.ok(saved); assert.equal(saved.provisionalOrigin?.version, 1);
  const roundTrip = readSavedProvisionalProfile(JSON.parse(JSON.stringify(saved))); assert.ok(roundTrip);
  assert.deepEqual(roundTrip.request.candidates, original.candidates);
  assert.equal(roundTrip.result.fields.nurseryDays.activeTier, 'historical-public-reference');
  for (const key of Object.keys(choices) as Array<keyof typeof choices>) {
    const input: GrowerPlanningProfile['inputs'][keyof GrowerPlanningProfile['inputs']] = saved.inputs[key];
    assert.equal(input.state, 'provided');
    if (input.state === 'provided') assert.equal(input.provenance.kind, 'grower-estimate');
  }
  assert.equal(saved.inputs.nurseryDays.state, 'provided');
  if (saved.inputs.nurseryDays.state === 'provided') assert.equal(saved.inputs.nurseryDays.provenance.kind, 'external-reference');
  const current = createProvisionalCycleContext(source, { countryCode: 'US', agriculturalRegionReference: 'Wisconsin',
    policyFingerprint: 'private-wisconsin-synthetic-policy', knownPlantingRestriction: null }, at);
  assert.ok(current);
  assert.equal(reviewProvisionalCycleProfile(saved, current, area, entry, { bedId: bed.id }).status, 'ready');
  const proposal = generateGrowerAutoPlan({ requestedAt: at, scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [saved], provisionalContext: current, beds: [{ bed, scope, measuredAreaM2: area }],
    planningStart: own('2027-04-01', 'utc-date'), planningEndExclusive: own('2027-08-01', 'utc-date'), reserved: [],
    availability: [{ bedId: bed.id, scope, window: own({ start: '2027-04-01', endExclusive: '2027-08-01' }, 'utc-date-window') }],
    demands: [{ demandId: 'private-wisconsin-demand', profileId: saved.profileId, scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2027-06-03', endExclusive: '2027-06-06' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready', proposal.issues.join(',')); assert.equal(proposal.cycles.length, 1);
  assert.equal(proposal.cycles[0].assessment.schedule.nurseryStartDate, '2027-05-04');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-wisconsin-adopted-cycle',
    acceptedAt: at, geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
  const canonical = JSON.parse(JSON.stringify(row));
  const basis = resolvePlantingBasis(canonical, { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint, provisionalContext: current });
  assert.equal(basis.kind, 'grower-dated-cycle'); if (basis.kind !== 'grower-dated-cycle') return;
  const evidence = buildProvisionalCycleEvidence(basis.assessment.snapshot); assert.ok(evidence);
  const html = buildAdoptedProvisionalCycleHtml(canonical.growerCycle, { bedLabel: bed.label, sample: true }); assert.ok(html);
  for (const output of [evidence.lines.join('\n'), html.html]) {
    assert.match(output, /Historical Wisconsin reference, article revised April 2017/);
    assert.match(output, /Homegrown Tomatoes for Wisconsin: 28 days/);
    assert.match(output, /Community Garden Guide[^\n]*56 days/);
    assert.match(output, /Not selected: the separately consented Wisconsin historical reference has higher evidence precedence than the explicit USDA transfer/);
    assert.match(output, /commercial article-reproduction permission remain unknown/);
    assert.match(output, /grower-estimate/);
  }
  // Public cycle evidence omits all internal handles. The grower-downloaded
  // HTML separately preserves the declared measurement provenance reference;
  // that existing receipt must not be confused with private resolver handles.
  assert.doesNotMatch(evidence.lines.join('\n'), /private-wisconsin-|geometryFingerprint|sourceRevision/);
  assert.match(html.html, /reference private-wisconsin-bed/);
  assert.doesNotMatch(html.html, /private-wisconsin-(?:profile|synthetic-policy|demand|adopted-cycle)|geometryFingerprint|sourceRevision/);
});
