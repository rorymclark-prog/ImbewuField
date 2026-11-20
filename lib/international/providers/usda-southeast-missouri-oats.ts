import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

export type MissouriOatType = 'spring' | 'winter';
export interface MissouriOatsReferenceUse {
  readonly purpose: 'cover-crop-establishment';
  readonly oatType: MissouriOatType;
}
export const MISSOURI_OATS_PDF_SHA256 = 'de0f2d394e0c3ca96ef1c6bc56ade6b32158ec617b420ff45864956395c14656';
export const MISSOURI_OATS_POSITIVE_MONTHS = Object.freeze([3, 4, 8, 9]);

/** Both original pages and the spatially separate oats panel were inspected.
 * Its grouped month statement supplies neither cultivar validation nor exclusions. */
export const USDA_SOUTHEAST_MISSOURI_OATS_SOURCE: CountrySource = {
  id: 'usda-nrcs-southeast-missouri-oats-cover', category: 'agricultural-extension',
  authority: 'USDA Natural Resources Conservation Service, Missouri',
  title: 'Cover Crop Basics for Southeast Missouri',
  url: 'https://www.nrcs.usda.gov/plantmaterials/mopmsbr12100.pdf',
  coverage: 'Southeast Missouri, United States; grouped spring or winter oats cover-crop establishment.',
  resolution: unknown('No mapped regional boundary or site certification is supplied.'),
  units: { status: 'known', value: 'Calendar months for direct cover-crop seeding. No seed rate or plant density is imported.' },
  updateCadence: unknown('Current agronomic revision and update interval are unknown.'),
  licence: { status: 'known', value: 'USDA public-information policy with protected-material exceptions: https://www.usda.gov/about-usda/policies-and-links . Reviewed use is limited to attributed numerical month facts and method; no images, layout, logos, recipes, chemical instructions or endorsement.' },
  attribution: 'USDA Natural Resources Conservation Service, Missouri. Cover Crop Basics for Southeast Missouri, March 2014, page2, Spring or Winter Oats panel. Numerical month facts restated by ImbewuField; no USDA endorsement.',
  accessRequirements: { status: 'known', value: 'Public original two-page PDF; no sign-in required.' },
  verification: 'content-read', accessedOn: '2026-11-13', publishedOn: null, publishedMonth: '2014-03', reviewDueOn: null,
  verifiedClaim: 'The grouped Spring or Winter Oats panel reports seeding during March-April and August-September.',
  missingDataBehavior: 'No density, final stand, yield, nursery, harvest or termination duration, occupancy, turnaround or water-demand default is supplied.',
  limitations: 'Historical 2014 cover-crop reference, not present local agronomic validation, grain/food harvest advice or a separate validated calendar for each oat type or cultivar. Spring versus winter type is declared by the grower; the existing crop label does not establish it. Winter survival and termination requirements are unverified. Reported months are positive-only; omitted months and water-regime suitability remain unknown. Source availability is not current suitability or planting permission.',
};

export function southeastMissouriRegionMatches(region: string | null): boolean {
  return typeof region === 'string' && region.trim().toLowerCase() === 'southeast missouri';
}
export function southeastMissouriOatsReference(country: string | null, crop: string) {
  return country === 'US' && crop === 'oats' ? USDA_SOUTHEAST_MISSOURI_OATS_SOURCE : null;
}

export function southeastMissouriOatsCandidates(context: ProvisionalEvidenceContext, crop: string,
  recordedAt: string, useReference: boolean, use: MissouriOatsReferenceUse | null): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !southeastMissouriOatsReference(context.countryCode, crop)
    || !southeastMissouriRegionMatches(context.agriculturalRegionReference) || context.establishment === 'transplant'
    || use?.purpose !== 'cover-crop-establishment' || !['spring', 'winter'].includes(use.oatType)) return [];
  const binding = `cover-crop-establishment:${use.oatType}:${MISSOURI_OATS_PDF_SHA256}`;
  const common = {
    cropKey: 'oats', tier: 'climate-crop-derived' as const,
    geography: { kind: 'region' as const, countryCode: 'US', regionReference: context.agriculturalRegionReference! },
    establishment: 'direct' as const, waterRegime: 'any' as const,
    temporalScope: { kind: 'historical-transfer' as const, period: 'March 2014; publication day and current revision unknown',
      assumption: `Grower explicitly chose the historical grouped oats cover-crop reference for declared ${use.oatType} oat type; present local applicability is unverified.` },
    source: USDA_SOUTHEAST_MISSOURI_OATS_SOURCE, reuseReview: 'reviewed' as const,
    assumptions: [
      `Reference-use binding: ${binding}. This is cover-crop establishment only, not grain or food harvest.`,
      'Southeast Missouri is explicitly declared by the grower; no country-wide or coordinate-derived applicability is inferred.',
      'The source groups spring and winter oats under the same seeding period. The selected type is a grower declaration, not a separately validated cultivar calendar, winter-survival guarantee or termination schedule.',
      'The month list is positive-only. Other months remain unknown. Water regime is unconditioned source metadata, not proof that irrigation or rainfall is adequate.',
      'The climate-crop-derived tier records an explicitly chosen historical transfer, not a calculated climate model. Available-reference metadata means the document is available, not that its agronomy is current.',
      USDA_SOUTHEAST_MISSOURI_OATS_SOURCE.missingDataBehavior, USDA_SOUTHEAST_MISSOURI_OATS_SOURCE.limitations,
    ],
  };
  const provenance = { kind: 'external-reference' as const, recordedAt, sourceUrl: common.source.url,
    reference: `March 2014, page2, grouped Spring or Winter Oats panel; ${binding}` };
  return [
    { ...common, id: `usda-mo-oats-${binding}-direct`, field: 'establishment',
      input: { state: 'provided', value: 'direct', unit: 'method', provenance } },
    { ...common, id: `usda-mo-oats-${binding}-months`, field: 'allowedEntryMonths', positiveWindowEvidence: true, entryMonthCoverage: 'positive-only',
      input: { state: 'provided', value: [...MISSOURI_OATS_POSITIVE_MONTHS], unit: 'utc-months', provenance } },
  ];
}
