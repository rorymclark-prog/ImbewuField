import { exactReviewedFactMatch, freezeReferenceData } from './reviewed-fact-capsule';
import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate, ResolvedProvisionalField } from '../provisional-crop-planning';

export type SaskatchewanNurseryBasis = 'lower-bound' | 'upper-bound';
export interface SaskatchewanNurseryUse {
  readonly purpose: 'seed-raised-nursery-to-outdoor';
  readonly basis: SaskatchewanNurseryBasis;
}
const SOURCE_ID = 'usask-saskatchewan-cabbage-nursery-undated';
export const USASK_CABBAGE_ORIGINAL_SHA256 = '8531dc6fc4c02f1c2dda9ef06b7d51f3ac7d1c71cd9d9c373eba1a48b4b32009';
export const USASK_CABBAGE_NURSERY = freezeReferenceData({ weeks: [5, 6] as const, days: [35, 42] as const });
export const USASK_CABBAGE_QUALIFIER = 'Undated Saskatchewan prairie nursery reference: approximately 5–6 weeks (35–42 days) from seed-start to outdoor entry. The chosen endpoint is a planning estimate, not proof of readiness. Check hardening (source: at least 3 days; no extra lead inferred), sturdy seedlings and developed roots. The source requires actual daytime temperature reaching 10 °C and nights at least −2 °C over several consecutive nights; monthly means cannot substitute. Those conditions have not been checked. Local site and cultivar suitability and frost safety remain unverified.';
const REUSE = 'Limited independently worded nursery timing and necessary phase/readiness facts only. University document licence and commercial reproduction permission are unknown. No article prose, arrangement, images, logos or endorsement is reproduced. Fact/expression basis: https://ised-isde.canada.ca/site/ised/en/about-copyright . Disclaimer is not a reuse licence: https://www.usask.ca/disclaimer.php .';
export const USASK_SASKATCHEWAN_CABBAGE_SOURCE: CountrySource = freezeReferenceData({
  id: SOURCE_ID, category: 'agricultural-extension', authority: 'University of Saskatchewan, College of Agriculture and Bioresources',
  title: 'Cabbage — Gardening at USask',
  url: 'https://gardening.usask.ca/gardening-advice/gardenline-nested-pages/food-plant-pages/vegetables/cabbage.php',
  coverage: 'Canadian prairie outdoor gardening; initially offered for explicitly declared Saskatchewan prairie or Saskatoon context. No mapped scientific boundary or cultivar validation.',
  resolution: unknown('No mapped applicability boundary or local nursery trial.'),
  units: { status: 'known', value: 'Approximately 5–6 weeks seed-start lead before outdoor entry; endpoints converted by 7 days/week to 35–42 days.' },
  updateCadence: unknown('Article revision date and update interval unknown.'),
  licence: unknown('University copyright; no open or commercial article-reproduction licence established. Limited independently worded fact-use review is separate.'),
  attribution: 'University of Saskatchewan, College of Agriculture and Bioresources. Cabbage — Gardening at USask; Growing outdoors > Transplants > Starting your own cabbage plants from seed, and Planting > Timing. Publication/revision unknown; accessed 13 November 2026 UTC. Numerical facts independently worded and weeks converted to days by ImbewuField; no university endorsement.',
  accessRequirements: { status: 'known', value: 'Public article with topic tabs; no sign-in.' },
  missingDataBehavior: 'No endpoint is selected automatically. No method, density, yield, field-entry date/month, harvest duration, occupancy, turnaround or water-demand default.',
  verification: 'content-read', accessedOn: '2026-11-13', publishedOn: null, reviewDueOn: null,
  verifiedClaim: 'The seed-start subsection gives an approximate 5–6-week lead before outdoor transplanting; hardening, seedling condition and actual day/night temperatures also govern readiness.',
  limitations: USASK_CABBAGE_QUALIFIER + ' This is seed-raised nursery preparation, not direct field sowing, purchased seedling age or protected-production harvest. Approximate Saskatoon seasonal examples do not define entry dates or allowed months. No source monthly-mean comparison is supported.',
});

/** Deliberately narrow product scope, not a geospatial or scientific boundary. */
export function saskatchewanPrairieRegionMatches(region: string | null): boolean {
  return typeof region === 'string' && ['saskatchewan prairie', 'saskatchewan prairies', 'saskatchewan prairie garden',
    'saskatoon', 'saskatoon prairie garden'].includes(region.trim().toLowerCase().replace(/\s+/g, ' '));
}
export function saskatchewanCabbageNurseryReference(country: string | null, crop: string) {
  return country === 'CA' && crop === 'cabbage' ? USASK_SASKATCHEWAN_CABBAGE_SOURCE : null;
}
export function saskatchewanCabbageNurseryCandidates(context: ProvisionalEvidenceContext, crop: string, recordedAt: string,
  useReference: boolean, use: SaskatchewanNurseryUse | null): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !saskatchewanCabbageNurseryReference(context.countryCode, crop)
    || !saskatchewanPrairieRegionMatches(context.agriculturalRegionReference) || context.establishment !== 'transplant'
    || use?.purpose !== 'seed-raised-nursery-to-outdoor' || !['lower-bound', 'upper-bound'].includes(use.basis)) return [];
  const days = USASK_CABBAGE_NURSERY.days[use.basis === 'lower-bound' ? 0 : 1];
  const binding = `${use.purpose}:${use.basis}:${USASK_CABBAGE_ORIGINAL_SHA256}`;
  return [{
    id: `${SOURCE_ID}:${binding}`, field: 'nurseryDays', cropKey: 'cabbage', tier: 'historical-public-reference',
    geography: { kind: 'region', countryCode: 'CA', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant', waterRegime: 'any',
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'historical-transfer', period: 'Undated institutional prairie gardening article; publication and revision unknown',
      assumption: 'Grower explicitly chose this undated prairie nursery reference for seed-raised plants entering an outdoor garden. Current site and cultivar applicability are unverified.' },
    source: USASK_SASKATCHEWAN_CABBAGE_SOURCE, reuseReview: 'reviewed', reportedRange: USASK_CABBAGE_NURSERY.days,
    planningValueBasis: use.basis,
    input: { state: 'provided', value: days, unit: 'days', provenance: { kind: 'external-reference', recordedAt,
      sourceUrl: USASK_SASKATCHEWAN_CABBAGE_SOURCE.url, reference: `Growing outdoors > Transplants, seed-start; ${binding}` } },
    assumptions: [USASK_CABBAGE_QUALIFIER,
      `Reference-use binding: ${binding}; source range approximately 5–6 weeks; 5 × 7 = 35 and 6 × 7 = 42 days. Chosen ${use.basis}: ${days} days. Neither endpoint is preferred by the source.`,
      'Purpose: seeds raised in a protected/home nursery before outdoor entry, not purchased seedling age or direct field sowing. The declared region is a product restriction, not a validated climate boundary.',
      'Hardening is required; the source describes at least 3 days in a sheltered frost-free place. No extra days are added to or subtracted from the reported lead. Age alone is not readiness.',
      'Source entry conditions concern actual daytime temperature reaching 10 °C and nights at least −2 °C over several consecutive nights, with hardening and developed roots/sturdy growth. These are not monthly-mean criteria or frost clearance; this calculation has not checked them.',
      'Saskatoon seasonal date examples are approximate and do not supply a field-entry date or planting window. The article has differing general direct-sowing statements; this capsule imports only the seed-raised transplant lead.',
      REUSE, USASK_SASKATCHEWAN_CABBAGE_SOURCE.missingDataBehavior],
  }];
}
export function isSaskatchewanNurseryFactCandidate(candidate: ProvisionalFieldCandidate): boolean {
  return candidate.source?.id === SOURCE_ID || candidate.source?.url === USASK_SASKATCHEWAN_CABBAGE_SOURCE.url
    || candidate.id.startsWith(`${SOURCE_ID}:`);
}
export function saskatchewanNurseryFactReuse(candidate: ProvisionalFieldCandidate, context: ProvisionalEvidenceContext,
  recordedAt: string): string | null {
  return (['lower-bound', 'upper-bound'] as const).some(basis =>
    saskatchewanCabbageNurseryCandidates(context, 'cabbage', recordedAt, true,
      { purpose: 'seed-raised-nursery-to-outdoor', basis })
      .some(expected => exactReviewedFactMatch(candidate, expected))) ? REUSE : null;
}
export function saskatchewanNurseryResultQualifier(fields: Readonly<Record<string, ResolvedProvisionalField>>): string | null {
  const field = fields.nurseryDays;
  if (!field?.sourceBindings.some(source => source.id === SOURCE_ID)) return null;
  const chosen = field.baselineDefault?.state === 'provided' ? `Source choice: ${field.defaultPlanningValueBasis}, ${field.baselineDefault.value} days. ` : '';
  return chosen + (field.status === 'conflict' ? 'Conflicting nursery endpoints remain unresolved; no source endpoint is active. '
    : field.status === 'overridden' || field.status === 'invalid-override'
    ? 'Active nursery duration is a grower edit or withheld; the source range remains a reference. ' : '') + USASK_CABBAGE_QUALIFIER;
}
