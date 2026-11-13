// Explicit engineering dates/yield/density only; never a crop recommendation.
// The method source is real and already reviewed; no new fact or date default.
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { createSavedProvisionalProfile, createProvisionalCycleContext } from '../lib/international/provisional-profile.ts';
import { usdaGreatLakesCabbageCandidates } from '../lib/international/providers/usda-great-lakes-cabbage.ts';
import { assembleGrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { buildProvisionalCycleEvidence } from '../lib/international/provisional-crop-export.ts';
import type { GrowerInput } from '../lib/international/grower-planning.ts';

export async function provisionalCalendarFixture() {
  const recordedAt = '2026-11-12T12:00:00.000Z', reviewedAt = '2026-11-13T00:00:00.000Z';
  const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
    state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic calendar fixture; not farming advice.' },
  });
  const scope = { kind: 'mapped-site', siteId: 'site:42.70000,-84.60000' } as const;
  const canvas = buildDemoDesignCanvasState(); canvas.siteId = scope.siteId;
  canvas.frame.centerLat = 42.7; canvas.frame.centerLng = -84.6;
  canvas.items = [{ ...canvas.items.find(item => item.defId === 'veg_bed')!, id: 'private-calendar-bed', label: 'DEMO engineering bed', wM: 3, hM: 4 }];
  canvas.lines = []; canvas.zones = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
    raw: canvas, sourceRevision: 'private-calendar-source-receipt' }));
  if (source.status !== 'ready') throw Error('Synthetic calendar source held');
  const bed = source.beds[0];
  const conditions = { countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', policyFingerprint: 'private-calendar-policy', knownPlantingRestriction: null };
  const context = { scope, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: 'transplant' as const, waterRegime: 'irrigated' as const };
  const saved = createSavedProvisionalProfile({ profileId: 'private-preview', cropKey: 'cabbage', context,
    recordedAt, asOf: '2026-11-12', candidates: usdaGreatLakesCabbageCandidates(context, 'cabbage', recordedAt, true),
    overrides: { plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), nurseryDays: own(7, 'days'),
      fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
      turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months') },
    measuredAreaM2: { ...own(bed.areaM2, 'm2'), arithmeticBasis: source.measuredAreas[0].arithmeticBasis },
    fieldEntryDate: own('2028-02-08', 'utc-date') }, 'private-saved-profile', '2026-11-12T12:01:00.000Z', source, bed.id, bed.label);
  if (!saved) throw Error('Synthetic calendar profile held');
  const book = { version: 1 as const, plantings: [], growerPlanningProfiles: [saved], updatedAt: 1 };
  const review = assembleGrowerWorkflowReview({ source, scope, book, recordedAt: reviewedAt, provisionalSiteConditions: conditions,
    draft: { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000', targetProfiles: [],
      demands: [{ kind: 'grower-entered', entryId: 'private-calendar-demand', purpose: 'trial', cropKey: 'cabbage',
        profileId: saved.profileId, grossKg: '1', harvestStart: '2028-02-09', harvestEndExclusive: '2028-03-01' }],
      available: [{ bedId: bed.id, start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true }], assumptionsConfirmed: true } });
  if (review.status !== 'review') throw Error('Synthetic calendar workflow held: ' + review.issues.join(','));
  const row = createGrowerCyclePlanting(review.proposal.cycles[0], { plantingId: 'private-calendar-row',
    acceptedAt: '2026-11-13T00:01:00.000Z', geometryFingerprint: source.geometryFingerprint });
  const provisionalContext = createProvisionalCycleContext(source, conditions, reviewedAt);
  if (!row || !provisionalContext) throw Error('Synthetic calendar acceptance held');
  const evidence = buildProvisionalCycleEvidence(review.proposal.cycles[0].assessment.snapshot);
  if (!evidence) throw Error('Synthetic calendar public evidence held');
  return { row, source, saved, evidence, context: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint, provisionalContext } };
}
