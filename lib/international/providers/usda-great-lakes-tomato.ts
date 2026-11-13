import { USDA_GREAT_LAKES_CABBAGE_SOURCE, USDA_CABBAGE_PDF_SHA256, usdaGreatLakesRegionMatches } from './usda-great-lakes-cabbage';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

/** Original pp1/5/9 read on 13 November. This row is seed-starting lead time,
 * not days after emergence, a field-entry window or a current local recommendation. */
export const USDA_GREAT_LAKES_TOMATO_SOURCE = {
  ...USDA_GREAT_LAKES_CABBAGE_SOURCE,
  id: 'usda-nrcs-great-lakes-tomato-nursery',
  coverage: 'Great Lakes States, United States; existing tomato bedding plants started for garden transplanting.',
  units: { status: 'known' as const, value: 'Weeks before transplanting; 1 week = 7 days exactly. Establishment is transplanting.' },
  attribution: 'U.S. Department of Agriculture, Natural Resources Conservation Service. Community Garden Guide — Season Extension — Seed Starting, pp1,5,9. Tomato row lead time converted from weeks to days by ImbewuField. No USDA endorsement.',
  accessedOn: '2026-11-13',
  verifiedClaim: 'Page5, Tomato row, WEEKS BEFORE TRANSPLANTING: 8 weeks (56 days).',
  missingDataBehavior: 'No plant density, final stand, yield, field-entry month, harvest duration, occupancy or water-demand default is supplied.',
  limitations: 'Undated regional guide, not current local evidence or a US-wide default. Variety, growth habit, seed-starting conditions and local frost dates are unknown. Eight weeks is a source planning reference, not a guarantee of seedling readiness. The planting-cell footnote (3) describes cell size, not surviving plants. No plant count, yield, physical layout or local suitability is established.',
};

const tomatoWeeks = 8;
export const USDA_TOMATO_NURSERY = Object.freeze({ weeks: tomatoWeeks, days: tomatoWeeks * 7, pdfSha256: USDA_CABBAGE_PDF_SHA256 });

export function usdaGreatLakesTomatoReference(country: string | null, crop: string) {
  return country === 'US' && crop === 'tomatoes' ? USDA_GREAT_LAKES_TOMATO_SOURCE : null;
}

export function usdaGreatLakesTomatoCandidates(context: ProvisionalEvidenceContext, crop: string,
  recordedAt: string, useReference: boolean): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !usdaGreatLakesTomatoReference(context.countryCode, crop)
    || !usdaGreatLakesRegionMatches(context.agriculturalRegionReference) || context.establishment === 'direct') return [];
  const common = {
    cropKey: 'tomatoes', tier: 'climate-crop-derived' as const,
    geography: { kind: 'region' as const, countryCode: 'US', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant' as const, waterRegime: 'any' as const,
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'historical-transfer' as const, period: 'Undated original guide; publication and revision dates unknown',
      assumption: 'Grower explicitly chose this undated Great Lakes tomato seed-starting reference; present local applicability is unverified.' },
    source: USDA_GREAT_LAKES_TOMATO_SOURCE, reuseReview: 'reviewed' as const,
    assumptions: [
      'The Great Lakes States region is declared by the grower, not inferred from country or coordinates.',
      `Original USDA PDF SHA256: ${USDA_TOMATO_NURSERY.pdfSha256}; page5, Tomato row, WEEKS BEFORE TRANSPLANTING.`,
      'The source gives 8 weeks before transplanting; conversion is exactly 8 × 7 = 56 days. This is seed-starting lead time, not time after emergence or germination duration.',
      'A conditional nursery start uses the separately entered field-entry date. That date is not approved by this source; frost safety and seedling readiness remain unverified. No extra hardening-off interval is added.',
      USDA_GREAT_LAKES_TOMATO_SOURCE.missingDataBehavior, USDA_GREAT_LAKES_TOMATO_SOURCE.limitations,
    ],
  };
  const provenance = { kind: 'external-reference' as const, recordedAt, sourceUrl: USDA_GREAT_LAKES_TOMATO_SOURCE.url,
    reference: 'Community Garden Guide, page5, Tomato row; bedding-plant seed-starting lead time' };
  return [
    { ...common, id: 'usda-nrcs-great-lakes-tomato-transplant', field: 'establishment',
      input: { state: 'provided', value: 'transplant', unit: 'method', provenance } },
    { ...common, id: 'usda-nrcs-great-lakes-tomato-nursery', field: 'nurseryDays', planningValueBasis: 'reported-point',
      input: { state: 'provided', value: USDA_TOMATO_NURSERY.days, unit: 'days', provenance } },
  ];
}
