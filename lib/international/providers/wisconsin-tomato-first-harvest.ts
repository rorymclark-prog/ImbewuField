import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate, ResolvedProvisionalField } from '../provisional-crop-planning';
import { exactReviewedFactMatch, freezeReferenceData } from './reviewed-fact-capsule';
import { wisconsinTomatoRegionMatches } from './wisconsin-tomato-nursery';

export type WisconsinTomatoFirstHarvestBasis = 'lower-bound' | 'upper-bound';

export interface WisconsinTomatoFirstHarvestUse {
  readonly version: 1;
  readonly purpose: 'outdoor-fresh-market-transplant';
  readonly basis: WisconsinTomatoFirstHarvestBasis;
}

type FirstHarvestContext = ProvisionalEvidenceContext & {
  readonly wisconsinTomatoFirstHarvest?: WisconsinTomatoFirstHarvestUse;
};

const SOURCE_ID = 'uw-extension-wisconsin-tomato-first-harvest-1997';
const ORIGINAL_SHA256 = 'a3191d09e3c0a38a8796666cedf7d80d332dc92581a29b2b5da6eee56aff3eda';
const DAYS = freezeReferenceData([65, 80] as const);
const TABLE = 'Table 3, Planting guide, tomato row, printed page 7 / PDF page 10';
const REUSE = 'Limited independently paraphrased numeric fact and necessary attribution. Document and table reproduction permissions remain unknown.';
const LIMITS = 'Historical fresh-market reference for explicitly declared Wisconsin outdoor tomato transplants. The table pairs outdoor planting of plants with days to first harvest. Using transplant entry as the interval start is an interpretation. Cultivar and production conditions affect timing. Present local applicability is unverified.';

export const WISCONSIN_TOMATO_FIRST_HARVEST_SOURCE: CountrySource = freezeReferenceData({
  id: SOURCE_ID,
  category: 'agricultural-extension',
  authority: 'University of Wisconsin-Extension, Cooperative Extension',
  title: 'Growing tomatoes, peppers, and eggplants in Wisconsin: A guide for fresh-market growers',
  url: 'https://barron.extension.wisc.edu/files/2023/02/Growing-Tomatoes-Peppers-and-Egg-Plants-in-Wisconsin.pdf',
  coverage: 'Declared Wisconsin, United States. Tomato, outdoor transplant establishment, fresh-market production, historical reference only.',
  resolution: unknown('The guide does not verify the grower’s site, cultivar or current growing conditions.'),
  units: { status: 'known', value: 'Days to first harvest, reported as 65–80 days.' },
  updateCadence: unknown('Copyright year 1997. No agronomic revision date established.'),
  licence: unknown('University copyright. Document and table reproduction terms are unknown.'),
  attribution: `K.A. Delahaut and A.C. Newenhouse, University of Wisconsin-Extension. ${TABLE}. Copyright 1997. Cover A3687, back imprint A3685. Original accessed 18 November 2026.`,
  accessRequirements: { status: 'known', value: 'Public original PDF.' },
  missingDataBehavior: 'Choose a reported endpoint explicitly. Planting window, frost clearance, density, yield, picking duration, field occupancy, turnaround and water demand remain unsupported by this reference.',
  verification: 'content-read',
  accessedOn: '2026-11-18',
  publishedOn: null,
  publishedMonth: null,
  publishedYear: 1997,
  reviewDueOn: null,
  verifiedClaim: 'The tomato row lists 65–80 days to first harvest alongside outdoor planting of plants. The guide notes that cultivar changes maturity timing.',
  limitations: LIMITS,
});

export function normaliseWisconsinTomatoFirstHarvestUse(value: unknown): WisconsinTomatoFirstHarvestUse | null {
  if (!value || typeof value !== 'object') return null;
  for (const basis of ['lower-bound', 'upper-bound'] as const) {
    const choice: WisconsinTomatoFirstHarvestUse = { version: 1, purpose: 'outdoor-fresh-market-transplant', basis };
    if (exactReviewedFactMatch(value, choice)) return Object.freeze(choice);
  }
  return null;
}

export function wisconsinTomatoFirstHarvestCandidates(context: FirstHarvestContext, cropKey: string,
  recordedAt: string): readonly ProvisionalFieldCandidate[] {
  if (context.countryCode !== 'US' || !wisconsinTomatoRegionMatches(context.agriculturalRegionReference)
    || context.establishment !== 'transplant' || cropKey !== 'tomatoes') return [];
  const choice = normaliseWisconsinTomatoFirstHarvestUse(context.wisconsinTomatoFirstHarvest);
  if (!choice) return [];
  const days = DAYS[choice.basis === 'lower-bound' ? 0 : 1];
  const binding = `v${choice.version}:${choice.purpose}:${choice.basis}:${ORIGINAL_SHA256}`;
  return freezeReferenceData([{
    id: `${SOURCE_ID}:${binding}`,
    field: 'fieldEntryToFirstHarvestDays',
    cropKey: 'tomatoes',
    tier: 'historical-public-reference',
    geography: { kind: 'region', countryCode: 'US', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant',
    waterRegime: 'any',
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'historical-transfer', period: '1997 reference, current applicability unverified',
      assumption: 'Grower explicitly chose a historical outdoor fresh-market tomato first-harvest endpoint.' },
    source: WISCONSIN_TOMATO_FIRST_HARVEST_SOURCE,
    reuseReview: 'reviewed',
    reportedRange: DAYS,
    planningValueBasis: choice.basis,
    input: { state: 'provided', value: days, unit: 'days', provenance: { kind: 'external-reference', recordedAt,
      sourceUrl: WISCONSIN_TOMATO_FIRST_HARVEST_SOURCE.url, reference: `${TABLE}; ${binding}` } },
    assumptions: [
      `Grower selected the ${choice.basis === 'lower-bound' ? 'lower' : 'upper'} endpoint of the 65–80 day interval for outdoor fresh-market transplants.`,
      'A first-harvest estimate adds the chosen interval to the grower’s own field-entry date. Nursery time is separate. The interval does not establish an entry window or plant readiness.',
      `Original PDF SHA256: ${ORIGINAL_SHA256}. Copyright year retained with month and day unknown.`,
    ],
  }]);
}

export function isWisconsinTomatoFirstHarvestFactCandidate(candidate: ProvisionalFieldCandidate): boolean {
  return candidate.source?.id === SOURCE_ID || candidate.source?.url === WISCONSIN_TOMATO_FIRST_HARVEST_SOURCE.url
    || candidate.id.startsWith(`${SOURCE_ID}:`);
}

export function wisconsinTomatoFirstHarvestFactReuse(candidate: ProvisionalFieldCandidate, context: FirstHarvestContext,
  recordedAt: string): string | null {
  return wisconsinTomatoFirstHarvestCandidates(context, candidate.cropKey, recordedAt)
    .some(expected => exactReviewedFactMatch(candidate, expected)) ? REUSE : null;
}

export function wisconsinTomatoFirstHarvestResultQualifier(field: ResolvedProvisionalField): string | null {
  if (field.status !== 'selected' || !field.defaultCandidateIds.some(id => id.startsWith(`${SOURCE_ID}:`))) return null;
  return 'Conditional estimate from the 1997 Wisconsin outdoor fresh-market tomato guide. Timing varies by cultivar. Current local suitability is unverified.';
}
