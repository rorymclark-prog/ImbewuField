import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

/** Original PDF pp1/5/9 inspected. Metadata is not a publication date; this
 * undated regional table must not become current US-wide farming advice. */
export const USDA_GREAT_LAKES_CABBAGE_SOURCE: CountrySource = {
  id: 'usda-nrcs-great-lakes-cabbage', category: 'agricultural-extension',
  authority: 'USDA Natural Resources Conservation Service',
  title: 'Community Garden Guide — Season Extension — Seed Starting',
  url: 'https://www.nrcs.usda.gov/plantmaterials/mipmcar9781.pdf',
  coverage: 'Great Lakes States, United States; community-garden cabbage bedding plants transplanted into rows.',
  resolution: unknown('The guide supplies no administrative boundary or site certification.'),
  units: { status: 'known', value: 'Transplant spacing in inches; converted using 1 inch = 2.54 cm exactly.' },
  updateCadence: unknown('Publication and agronomic revision dates are not established.'),
  licence: { status: 'known', value: 'USDA public-domain information policy, with credit and exceptions for protected materials: https://www.usda.gov/about-usda/policies-and-links . Numerical table facts only; no logos, photos, CAD artwork or implied endorsement.' },
  attribution: 'U.S. Department of Agriculture, Natural Resources Conservation Service. Community Garden Guide — Season Extension — Seed Starting, pp1,5,9. Spacing facts converted and interpreted by ImbewuField; no USDA endorsement.',
  accessRequirements: { status: 'known', value: 'Public original PDF; no sign-in required.' },
  missingDataBehavior: 'No final surviving stand, density, yield, calendar, harvest duration or site suitability is supplied by this adapter.',
  verification: 'content-read', accessedOn: '2026-11-12', publishedOn: null, publishedMonth: null, reviewDueOn: null,
  verifiedClaim: 'The cabbage row on page5 gives transplant spacing of 18–24 inches within rows and 30 inches between rows.',
  limitations: 'Undated regional reference, not current local evidence. Cultivar, head size and final stand are unknown. The planting-cell key (1) is a cell-size footnote, not one surviving plant per station. Conversion precision is not agronomic precision. No country-wide or global default.',
};
export const USDA_CABBAGE_SPACING_VERSION = 'usda-nrcs-great-lakes-cabbage-spacing-v1' as const;
export const USDA_CABBAGE_PDF_SHA256 = 'ff7a1dfea4582f69d8349e150e7e875b02df32c01bc1eef957aded6fa2a9483e';
export function usdaGreatLakesRegionMatches(region: string | null): boolean {
  return typeof region === 'string' && region.trim().toLowerCase() === 'great lakes states';
}
export function usdaGreatLakesCabbageReference(country: string | null, crop: string) {
  return country === 'US' && crop === 'cabbage' ? USDA_GREAT_LAKES_CABBAGE_SOURCE : null;
}
export const USDA_CABBAGE_SPACING = Object.freeze({
  rowCm: Object.freeze([76.2, 76.2] as const), inRowCm: Object.freeze([45.72, 60.96] as const),
  version: USDA_CABBAGE_SPACING_VERSION, pdfSha256: USDA_CABBAGE_PDF_SHA256,
  source: USDA_GREAT_LAKES_CABBAGE_SOURCE,
  display: '30 inches between rows (76.2 cm); 18–24 inches within rows (45.72–60.96 cm). Conversion precision is not agronomic precision.',
});
export function usdaGreatLakesCabbageCandidates(context: ProvisionalEvidenceContext, crop: string,
  recordedAt: string, useReference: boolean): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !usdaGreatLakesCabbageReference(context.countryCode, crop)
    || !usdaGreatLakesRegionMatches(context.agriculturalRegionReference)) return [];
  return [{ id: 'usda-nrcs-great-lakes-cabbage-transplant', field: 'establishment', cropKey: 'cabbage',
    tier: 'climate-crop-derived', input: { state: 'provided', value: 'transplant', unit: 'method',
      provenance: { kind: 'external-reference', recordedAt, sourceUrl: USDA_GREAT_LAKES_CABBAGE_SOURCE.url,
        reference: 'Community Garden Guide, page5, Cabbage row, TRANSPLANT SPACING' } },
    geography: { kind: 'region', countryCode: 'US', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant', waterRegime: 'any',
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'historical-transfer', period: 'Undated guide; publication and revision date unknown',
      assumption: 'Grower explicitly chose this undated Great Lakes transplant reference; present local applicability is unverified.' },
    source: USDA_GREAT_LAKES_CABBAGE_SOURCE, reuseReview: 'reviewed', assumptions: [
      'Grower explicitly chose cabbage bedding transplants for the declared Great Lakes States region. That declaration is not independently verified.',
      USDA_CABBAGE_SPACING.display,
      'No point spacing or final surviving plants per station is selected. The cell-size footnote (1) is not a final stand.',
      USDA_GREAT_LAKES_CABBAGE_SOURCE.missingDataBehavior, USDA_GREAT_LAKES_CABBAGE_SOURCE.limitations,
    ] }];
}
