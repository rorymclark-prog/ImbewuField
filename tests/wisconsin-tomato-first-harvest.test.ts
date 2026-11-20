import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProvisionalCropPreviewHtml } from '../lib/international/provisional-crop-export.ts';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest } from '../lib/international/provisional-crop-planning.ts';
import { createSavedProvisionalProfile, readSavedProvisionalProfile } from '../lib/international/provisional-profile.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import {
  wisconsinTomatoFirstHarvestCandidates, type WisconsinTomatoFirstHarvestBasis,
} from '../lib/international/providers/wisconsin-tomato-first-harvest.ts';

const recordedAt = '2026-11-19T08:00:00.000Z';
const baseContext = {
  scope: { kind: 'unmapped-workspace', workspaceId: 'design:synthetic-wisconsin' },
  countryCode: 'US', agriculturalRegionReference: 'Wisconsin', establishment: 'transplant', waterRegime: null,
} as const;

function contextFor(basis: WisconsinTomatoFirstHarvestBasis): ProvisionalDraftRequest['context'] {
  return { ...baseContext, wisconsinTomatoFirstHarvest: { version: 1, purpose: 'outdoor-fresh-market-transplant', basis } };
}

function request(context = contextFor('lower-bound')): ProvisionalDraftRequest {
  return {
    profileId: 'historical-reference-fixture', cropKey: 'tomatoes', context, recordedAt, asOf: '2026-11-19',
    candidates: wisconsinTomatoFirstHarvestCandidates(context, 'tomatoes', recordedAt),
    measuredAreaM2: { state: 'missing', reason: 'not-known' },
    fieldEntryDate: { state: 'provided', value: '2026-06-01', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt } },
  };
}

function resolved(input: ProvisionalDraftRequest) {
  const outcome = resolveProvisionalCropPlan(input);
  if (outcome.status !== 'resolved') assert.fail(`Expected a resolved provisional result, got ${outcome.status}`);
  return outcome;
}

test('the chosen historical first-harvest endpoint gives only the supported partial date', () => {
  for (const [endpoint, date] of [['lower-bound', '2026-08-05'], ['upper-bound', '2026-08-20']] as const) {
    const outcome = resolved(request(contextFor(endpoint)));
    const field = outcome.fields.fieldEntryToFirstHarvestDays;
    assert.equal(outcome.assessment.schedule.firstHarvestDate.value, date);
    assert.equal(outcome.assessment.schedule.nurseryStartDate.value, null);
    assert.equal(outcome.assessment.schedule.harvestEndExclusiveDate.value, null);
    assert.equal(outcome.assessment.schedule.fieldClearDate.value, null);
    assert.equal(outcome.assessment.estimatedYieldKg.value, null);
    assert.equal(outcome.assessment.entryWindow, 'unknown');
    assert.equal(field.activeTier, 'historical-public-reference');
    assert.deepEqual(field.defaultReportedRange, [65, 80]);
    assert.equal(field.sourceBindings[0]?.publishedYear, 1997);
    assert.equal(field.sourceBindings[0]?.publishedMonth, null);
  }
});

test('replaying a candidate without its declared scope and consent leaves first harvest unknown', () => {
  const supplied = request();
  const wrongChoices = [baseContext, { ...supplied.context, agriculturalRegionReference: 'Oregon' },
    { ...supplied.context, countryCode: 'CA' }, { ...supplied.context, establishment: 'direct' as const }, contextFor('upper-bound')];
  for (const context of wrongChoices) {
    const outcome = resolved({ ...supplied, context });
    assert.equal(outcome.fields.fieldEntryToFirstHarvestDays.activeInput.state, 'missing');
    assert.equal(outcome.assessment.schedule.firstHarvestDate.value, null);
  }
  assert.equal(resolveProvisionalCropPlan({ ...supplied, context: { ...supplied.context,
    wisconsinTomatoFirstHarvest: { version: 1, purpose: 'protected-production', basis: 'lower-bound' } as never,
  } }).status, 'invalid-context');
});

test('altering the source capsule cannot turn the reference into an admitted harvest estimate', () => {
  const input = request();
  const original = input.candidates[0];
  const changed = { ...original, source: { ...original.source!, limitations: 'Suitable for all sites', licence: { status: 'known' as const, value: 'Open licence' } } };
  const outcome = resolved({ ...input, candidates: [changed] });
  assert.equal(outcome.assessment.schedule.firstHarvestDate.value, null);
  assert.equal(outcome.rejected[0]?.reason, 'source-or-reuse-unverified');
});

test('saved review and actual printable HTML retain the historical choice and its limits', () => {
  const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
  const bed = { id: 'synthetic-bed', label: 'Synthetic Wisconsin bed', areaM2: 6 };
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: scope.siteId,
    sourceKey: `studio-canvas:${scope.siteId}`, resourceSiteId: scope.siteId, scope, beds: [bed],
    measuredAreas: [{ bedId: bed.id, areaM2: bed.areaM2, basis: 'explicit-saved-dimensions' }], heldBeds: [],
    sourceRevision: 'b'.repeat(64), geometryFingerprint: 'a'.repeat(64), freshness: 'device-saved-copy', sourceVerification: 'not-verified' };
  const draft: ProvisionalDraftRequest = { ...request({ ...contextFor('lower-bound'), scope }), profileId: 'provisional-preview',
    measuredAreaM2: { state: 'provided', value: bed.areaM2, unit: 'm2', provenance: { kind: 'grower-record', recordedAt, reference: bed.id } } };
  const saved = createSavedProvisionalProfile(draft, 'saved-harvest-fixture', recordedAt, source, bed.id, bed.label);
  assert.ok(saved?.provisionalOrigin);
  const reopened = readSavedProvisionalProfile(JSON.parse(JSON.stringify(saved)));
  assert.ok(reopened);
  assert.deepEqual(reopened.request.context.wisconsinTomatoFirstHarvest, draft.context.wisconsinTomatoFirstHarvest);
  assert.equal(reopened.result.assessment.schedule.firstHarvestDate.value, '2026-08-05');
  const html = buildProvisionalCropPreviewHtml(reopened.request, { bedLabel: bed.label, sample: true });
  assert.ok(html);
  assert.match(html.html, /2026-08-05/);
  assert.match(html.html, /First harvest \(UTC\):<\/strong> 2026-08-05 \(ready\)<\/p><p>Conditional estimate from the 1997 Wisconsin/);
  assert.match(html.html, /Table 3/);
  assert.match(html.html, /Using transplant entry as the interval start is an interpretation/);
  assert.match(html.html, /Document and table reproduction permissions remain unknown/);
  const { wisconsinTomatoFirstHarvest: _consent, ...withoutConsent } = draft.context;
  const forged = { ...saved, provisionalOrigin: { ...saved.provisionalOrigin,
    originalRequestJson: JSON.stringify({ ...draft, context: withoutConsent }) } };
  assert.equal(readSavedProvisionalProfile(forged), null);
});
