import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

/** Original PDF read on 12 November 2026, pp34–35 (PDF pages38–39).
 * Its 30–45cm spacing has no named axes. Its 4–6 weeks concerns bed preparation,
 * not seedling age. Neither supports a density or nursery-duration default. */
export const WORLDVEG_KENYA_CABBAGE_SOURCE: CountrySource = {
  id: 'worldveg-ke-24-1077-cabbage', category: 'agricultural-extension',
  authority: 'World Vegetable Center, Kenya Country Office',
  title: 'Agroecological vegetable production. A field manual for Kenya. (24-1077)',
  url: 'https://worldveg.org/wp-content/uploads/2024/06/24-1077_Agroecology-Kenya_compressed-82.pdf',
  coverage: 'Kenya; cabbage discussion names central Kenya as a favourable context, without defining a boundary.',
  resolution: unknown('No geographic boundary or site suitability was established.'),
  units: { status: 'known', value: 'True-leaf stage for transplanting; no numeric planner defaults imported.' },
  updateCadence: unknown('No update schedule is stated in the inspected manual.'),
  licence: { status: 'known', value: 'CC BY-SA 3.0 Unported; https://creativecommons.org/licenses/by-sa/3.0/' },
  attribution: 'Rapando N, Pawera L, Barare M, Wangungu C, Ramasamy S. 2024. Agroecological vegetable production. A field manual for Kenya. World Vegetable Center. Publication 24-1077, pp34–35. Planning interpretation by ImbewuField; original source unchanged.',
  accessRequirements: { status: 'known', value: 'Public PDF; no sign-in required.' },
  missingDataBehavior: 'Density, yield, nursery duration, harvest duration, occupancy, turnaround and entry months remain unknown.',
  verification: 'content-read', accessedOn: '2026-11-12', publishedOn: null, publishedMonth: '2024-06', reviewDueOn: null,
  verifiedClaim: 'The cabbage section describes transplanting seedlings to the field at 4–5 true leaves.',
  limitations: 'Method reference only. Central Kenya is a favourable context, not an exclusive boundary or site certification. No dated local agronomy review, planting permission, density, yield or calendar default is established.',
};

export function worldvegKenyaCabbageReference(countryCode: string | null, cropKey: string) {
  return countryCode === 'KE' && cropKey === 'cabbage' ? WORLDVEG_KENYA_CABBAGE_SOURCE : null;
}

export function worldvegKenyaCabbageRegionMatches(region: string | null): boolean {
  // This matches an explicit grower description only. Do not infer central Kenya
  // from coordinates, county names, interface language, or country selection.
  return typeof region === 'string' && region.trim().toLowerCase() === 'central kenya';
}

/** An explicit preview choice, not automatic admission of handbook agronomy.
 * The grower's region description is unverified; downstream gates stay intact. */
export function worldvegKenyaCabbageCandidates(context: ProvisionalEvidenceContext, cropKey: string,
  recordedAt: string, useMethodReference: boolean): readonly ProvisionalFieldCandidate[] {
  if (!useMethodReference || !worldvegKenyaCabbageReference(context.countryCode, cropKey)
    || !worldvegKenyaCabbageRegionMatches(context.agriculturalRegionReference)) return [];
  return [{ id: 'worldveg-ke-24-1077-cabbage-transplant', field: 'establishment', cropKey: 'cabbage',
    tier: 'local-public-evidence', input: { state: 'provided', value: 'transplant', unit: 'method',
      provenance: { kind: 'external-reference', recordedAt, reference: 'Publication 24-1077, p35 (PDF page39), Transplanting',
        sourceUrl: WORLDVEG_KENYA_CABBAGE_SOURCE.url } },
    geography: { kind: 'region', countryCode: 'KE', regionReference: context.agriculturalRegionReference! },
    establishment: 'transplant', waterRegime: 'any', temporalScope: { kind: 'recurring-season' },
    source: WORLDVEG_KENYA_CABBAGE_SOURCE, reuseReview: 'reviewed', assumptions: [
      'Grower chose the WorldVeg method reference for this preview. The central Kenya region description is grower-supplied, not independently verified.',
      'The source describes field transplanting at 4–5 true leaves. This is a growth stage, not a number of nursery days.',
      'Spacing is variety-dependent and lacks named axes; no plant density is derived. Bed preparation lead time is not seedling age.',
      WORLDVEG_KENYA_CABBAGE_SOURCE.missingDataBehavior,
      WORLDVEG_KENYA_CABBAGE_SOURCE.limitations,
    ] }];
}
