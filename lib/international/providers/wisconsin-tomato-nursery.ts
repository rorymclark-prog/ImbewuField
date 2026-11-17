import { exactReviewedFactMatch, freezeReferenceData } from './reviewed-fact-capsule';
import { unknown, type CountrySource } from '../countries/types';
import { isUsdaWisconsinTomatoFactCandidate, usdaWisconsinTomatoFactReuse } from './usda-great-lakes-tomato';
import type { ProvisionalDraftRequest, ProvisionalEvidenceContext, ProvisionalFieldCandidate, ResolvedProvisionalField } from '../provisional-crop-planning';

export type WisconsinTomatoNurseryBasis = 'lower-bound' | 'upper-bound';
export interface WisconsinTomatoNurseryUse {
  readonly purpose: 'seed-raised-nursery-to-outdoor';
  readonly basis: WisconsinTomatoNurseryBasis;
}
const SOURCE_ID = 'uw-extension-wisconsin-tomato-nursery-2017';
export const WISCONSIN_TOMATO_ORIGINAL_SHA256 = 'd411bbb6eed9232af1fff28ef1b149b81db27a752a79ee98af9a5e3ac2397db2';
export const WISCONSIN_TOMATO_NURSERY = freezeReferenceData({ weeks: [4, 8] as const, days: [28, 56] as const });
export const WISCONSIN_TOMATO_QUALIFIER = 'Historical Wisconsin reference, article revised April 2017: approximately 4–8 weeks (28–56 days) from seed sowing indoors or in a small greenhouse to outdoor transplanting. The grower chooses an endpoint; neither endpoint is preferred by the source. This is not current local evidence, a planting calendar, frost clearance or a guarantee of seedling readiness. Local site, cultivar and present applicability remain unverified. No extra germination or hardening interval is added.';
const REUSE = 'Limited independently paraphrased numeric seed-starting fact and necessary phase attribution only. The university document licence and commercial article-reproduction permission remain unknown. No article prose, arrangement, images, logos or endorsement is reproduced. This source-specific fact-use review is not an open licence or legal-permission conclusion.';
export const WISCONSIN_TOMATO_NURSERY_SOURCE: CountrySource = freezeReferenceData({
  id: SOURCE_ID, category: 'agricultural-extension', authority: 'University of Wisconsin–Madison Division of Extension / Wisconsin Horticulture',
  title: 'Homegrown Tomatoes for Wisconsin', url: 'https://hort.extension.wisc.edu/articles/home-grown-tomatoes-wisconsin/',
  coverage: 'Explicitly declared Wisconsin, United States; seed-grown tomatoes raised indoors or in a small greenhouse before outdoor transplanting. No mapped applicability boundary.',
  resolution: unknown('No site or cultivar validation or mapped applicability boundary.'),
  units: { status: 'known', value: 'Approximately 4–8 weeks from seed sowing to outdoor transplanting; exact conversion by 7 days/week gives endpoints 28–56 days.' },
  updateCadence: unknown('Article revised April 2017; original publication date and present agronomic update interval are unknown.'),
  licence: unknown('University copyright; no open or commercial article-reproduction licence established. Limited independently paraphrased fact-use review is separate.'),
  attribution: 'H.C. Harrison and Kristin Krokowski, University of Wisconsin–Madison Division of Extension / Wisconsin Horticulture. Homegrown Tomatoes for Wisconsin, Using healthy plants > Seed starting. Revised April 2017, original publication date unknown; accessed 16 November 2026. Numeric fact independently paraphrased and weeks converted to days by ImbewuField; no university endorsement.',
  accessRequirements: { status: 'known', value: 'Public original article; no sign-in.' },
  missingDataBehavior: 'No endpoint selected automatically. No field-entry calendar, frost clearance, density, yield, first-harvest, picking, occupancy, turnaround or water-demand default.',
  verification: 'content-read', accessedOn: '2026-11-16', publishedOn: null, publishedMonth: null, reviewDueOn: null,
  verifiedClaim: 'Seed starting subsection gives approximately 4–8 weeks from sowing indoors or in a small greenhouse to intended outdoor transplanting.',
  limitations: WISCONSIN_TOMATO_QUALIFIER + ' Not time after emergence, purchased seedling age, direct field sowing or protected-production harvest. The separate hardening paragraph does not change the seed-to-outdoor interval.',
});
/** Deliberately exact declared region; not an inferred climate or administrative coverage map. */
export function wisconsinTomatoRegionMatches(region: string | null): boolean {
  return typeof region === 'string' && region.trim().toLowerCase() === 'wisconsin';
}
export function wisconsinTomatoNurseryReference(country: string | null, crop: string) {
  return country === 'US' && crop === 'tomatoes' ? WISCONSIN_TOMATO_NURSERY_SOURCE : null;
}
export function wisconsinTomatoNurseryCandidates(context: ProvisionalEvidenceContext, crop: string, recordedAt: string,
  useReference: boolean, use: WisconsinTomatoNurseryUse | null): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !wisconsinTomatoNurseryReference(context.countryCode, crop)
    || !wisconsinTomatoRegionMatches(context.agriculturalRegionReference) || context.establishment !== 'transplant'
    || use?.purpose !== 'seed-raised-nursery-to-outdoor' || !['lower-bound', 'upper-bound'].includes(use.basis)) return [];
  const days = WISCONSIN_TOMATO_NURSERY.days[use.basis === 'lower-bound' ? 0 : 1];
  const binding = `${use.purpose}:${use.basis}:${WISCONSIN_TOMATO_ORIGINAL_SHA256}`;
  return freezeReferenceData([{
    id: `${SOURCE_ID}:${binding}`, field: 'nurseryDays', cropKey: 'tomatoes', tier: 'historical-public-reference',
    geography: { kind: 'region', countryCode: 'US', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant', waterRegime: 'any', ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'historical-transfer', period: 'Article revised April 2017; original publication date and current agronomic revision unknown',
      assumption: 'Grower explicitly chose this historical Wisconsin seed-starting reference for seed-raised outdoor transplants. Present site and cultivar applicability are unverified.' },
    source: WISCONSIN_TOMATO_NURSERY_SOURCE, reuseReview: 'reviewed', reportedRange: WISCONSIN_TOMATO_NURSERY.days,
    planningValueBasis: use.basis,
    input: { state: 'provided', value: days, unit: 'days', provenance: { kind: 'external-reference', recordedAt,
      sourceUrl: WISCONSIN_TOMATO_NURSERY_SOURCE.url, reference: `Using healthy plants > Seed starting; ${binding}` } },
    assumptions: [WISCONSIN_TOMATO_QUALIFIER,
      `Reference-use binding: ${binding}; approximate source range 4–8 weeks; 4 × 7 = 28 and 8 × 7 = 56 days. Chosen ${use.basis}: ${days} days.`,
      'The declared Wisconsin region is a product restriction, not a validated climate boundary. Purpose is seed sowing in a protected nursery before outdoor transplanting, not purchased plant age or production under cover.',
      'A conditional nursery start uses the separately entered field-entry date. This source does not approve that date. Hardening and seedling readiness remain unchecked; no germination or hardening days are added or subtracted.',
      `Original retained article SHA256: ${WISCONSIN_TOMATO_ORIGINAL_SHA256}; revision month is not an original publication date.`,
      REUSE, WISCONSIN_TOMATO_NURSERY_SOURCE.missingDataBehavior],
  }]);
}
export function isWisconsinTomatoNurseryFactCandidate(candidate: ProvisionalFieldCandidate): boolean {
  return candidate.source?.id === SOURCE_ID || candidate.source?.url === WISCONSIN_TOMATO_NURSERY_SOURCE.url
    || candidate.id.startsWith(`${SOURCE_ID}:`);
}
export function wisconsinTomatoNurseryFactReuse(candidate: ProvisionalFieldCandidate, context: ProvisionalEvidenceContext,
  recordedAt: string): string | null {
  return (['lower-bound', 'upper-bound'] as const).some(basis =>
    wisconsinTomatoNurseryCandidates(context, 'tomatoes', recordedAt, true, { purpose: 'seed-raised-nursery-to-outdoor', basis })
      .some(expected => exactReviewedFactMatch(candidate, expected))) ? REUSE : null;
}
/** New-source-only presentation receipt: lower-tier facts come from the original
 * consented capsules, never from a fabricated resolver selection or global schema change. */
export function wisconsinTomatoReferenceReceipt(request: ProvisionalDraftRequest,
  fields: Readonly<Record<string, ResolvedProvisionalField>>) {
  if (request.cropKey !== 'tomatoes') return null;
  const nursery = fields.nurseryDays;
  if (!nursery) return null;
  const accepted = request.candidates.filter(candidate => candidate.field === 'nurseryDays'
    && (isWisconsinTomatoNurseryFactCandidate(candidate)
      ? !!wisconsinTomatoNurseryFactReuse(candidate, request.context, request.recordedAt)
      : isUsdaWisconsinTomatoFactCandidate(candidate) && !!usdaWisconsinTomatoFactReuse(candidate, request.context, request.recordedAt)));
  if (!accepted.length) return null;
  const references = accepted.map(candidate => {
    const source = candidate.source!;
    const selected = nursery.defaultCandidateIds.includes(candidate.id) && !nursery.defaultConflict;
    const reuseTerms = isWisconsinTomatoNurseryFactCandidate(candidate) ? REUSE : source.licence.status === 'known' ? source.licence.value : '';
    const input = candidate.input as { value: number };
    return { id: source.id, title: source.title, url: source.url, days: input.value, tier: candidate.tier,
      basis: candidate.planningValueBasis, selected, accessedOn: source.accessedOn,
      reason: selected ? (nursery.status === 'overridden' || nursery.status === 'invalid-override'
        ? 'Selected source baseline retained; active nursery duration is a grower edit or withheld.' : 'Selected source baseline.')
        : nursery.defaultConflict ? 'Not selected: source endpoint conflict remains unresolved.'
        : nursery.activeTier === 'historical-public-reference' || nursery.defaultOptions.some(option => option.candidateId.startsWith(`${SOURCE_ID}:`))
          ? 'Not selected: the separately consented Wisconsin historical reference has higher evidence precedence than the explicit USDA transfer.'
          : 'Not selected as this result’s source baseline; this consented fact is retained for comparison only.',
      attribution: source.attribution, limitations: source.limitations, reuseTerms };
  }).sort((a, b) => a.id.localeCompare(b.id) || a.days - b.days);
  return freezeReferenceData({ qualifier: accepted.some(isWisconsinTomatoNurseryFactCandidate) ? WISCONSIN_TOMATO_QUALIFIER
    : 'Explicit grower-chosen transfer of the undated USDA Great Lakes seed-starting fact: 8 weeks (56 days) before outdoor transplanting. This is not current local evidence, a Wisconsin planting calendar or proof of seedling readiness; present local applicability remains unverified. No Wisconsin article endpoint was consented in this request.', references });
}
