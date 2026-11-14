import { exactReviewedFactMatch, freezeReferenceData } from './reviewed-fact-capsule';
import { unknown, type CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate, ResolvedProvisionalField } from '../provisional-crop-planning';

export const AAFC_CABBAGE_PDF_SHA256 = 'fd69162fd641a77a212fb70fd806241ca27f45247f86791ba4c389eedac68121';
const SOURCE_ID = 'aafc-canada-cabbage-aggregate-2025';
export const AAFC_CABBAGE_QUALIFIER = 'Historical Canadian multi-variety field-transplant reference: April concerns early varieties after hardening; May–July covers successive varieties, not every cultivar in every month. Local region, cultivar and weather applicability are unverified. Other months are unknown.';
export const AAFC_CABBAGE_FACT_REUSE = 'Limited independently worded month facts and qualifiers only; document reproduction permission is not established. Fact/expression basis: https://ised-isde.canada.ca/site/ised/en/about-copyright and https://www.canada.ca/en/canadian-heritage/services/crown-copyright-request.html . No copied table, prose, images, logos or endorsement. This is not an AAFC commercial document licence.';
export const AAFC_CANADA_CABBAGE_SOURCE: CountrySource = freezeReferenceData({
  id: SOURCE_ID, category: 'agricultural-extension', authority: 'Agriculture and Agri-Food Canada, Pest Management Centre',
  title: 'Crop Profile for Brassica Vegetables in Canada, 2024 — sixth edition, 2025',
  url: 'https://agriculture.canada.ca/sites/default/files/documents/2026-01/Brassica%20CP%202024%20EN.pdf',
  coverage: 'Canadian general brassica field-transplant programme across varieties; labelled reference for head cabbage only.',
  resolution: unknown('No province-specific calendar, mapped boundary or individual cultivar window.'),
  units: { status: 'known', value: 'Positive-mentioned calendar months for field transplanting only.' },
  updateCadence: unknown('Current revision interval unknown.'),
  licence: unknown('Crown-protected document. Commercial reproduction permission not established; AAFC terms: https://agriculture.canada.ca/en/about-our-department/terms-and-conditions .'),
  attribution: 'Agriculture and Agri-Food Canada. Crop Profile for Brassica Vegetables in Canada, 2024, sixth edition 2025, Table 3, printed page 4/PDF page 9; context printed pages 2–3 and continuation page 5. Catalogue A118-10/33-2025E-PDF. Independently worded factual reference; no AAFC endorsement.',
  accessRequirements: { status: 'known', value: 'Public original PDF; no sign-in.' },
  missingDataBehavior: 'No sowing-to-entry duration, field duration, harvest, density, yield, temperature comparison or water-demand default.',
  verification: 'content-read', accessedOn: '2026-11-13', publishedOn: null, publishedYear: 2025, reviewDueOn: null,
  verifiedClaim: 'Table 3 mentions field transplanting in April, May, June and July across a general programme of varieties; April concerns early varieties after hardening.',
  limitations: AAFC_CABBAGE_QUALIFIER + ' The 2024 reference-data year does not date every practice; the 2026-01 hosting path is not a publication date. No current local agronomic validation.',
});

export function canadaCabbageReference(country: string | null, crop: string) {
  return country === 'CA' && crop === 'cabbage' ? AAFC_CANADA_CABBAGE_SOURCE : null;
}

export function canadaCabbageCandidates(context: ProvisionalEvidenceContext, crop: string, recordedAt: string,
  useProgramme: boolean): readonly ProvisionalFieldCandidate[] {
  if (!useProgramme || !canadaCabbageReference(context.countryCode, crop) || context.establishment !== 'transplant'
    || context.varietyReference != null && context.varietyReference.trim() !== '') return [];
  const common = {
    cropKey: 'cabbage', tier: 'historical-public-reference' as const,
    geography: { kind: 'country' as const, countryCode: 'CA' }, establishment: 'transplant' as const,
    waterRegime: 'any' as const, source: AAFC_CANADA_CABBAGE_SOURCE, reuseReview: 'reviewed' as const,
    temporalScope: { kind: 'historical-transfer' as const, period: '2025 sixth edition; month/day unknown; 2024 reference-data year',
      assumption: 'Grower explicitly chose the historical Canadian unnamed multi-variety field-transplant programme for comparison. This does not establish local or single-cultivar suitability.' },
    assumptions: [AAFC_CABBAGE_QUALIFIER, `Original PDF SHA256: ${AAFC_CABBAGE_PDF_SHA256}; Table 3, PDF page 9, context pages 7–8 and 10.`,
      'Reference-use choice: unnamed multi-variety field-transplant programme. March nursery seeding is not field entry. No calendar exclusion or planting permission is inferred.',
      AAFC_CABBAGE_FACT_REUSE, AAFC_CANADA_CABBAGE_SOURCE.missingDataBehavior],
  };
  const provenance = { kind: 'external-reference' as const, recordedAt, sourceUrl: common.source.url,
    reference: `AAFC sixth edition 2025, Table 3 PDF page 9; multi-variety programme; ${AAFC_CABBAGE_PDF_SHA256}` };
  return [
    { ...common, id: `${SOURCE_ID}:months`, field: 'allowedEntryMonths', positiveWindowEvidence: true, entryMonthCoverage: 'positive-only',
      input: { state: 'provided', value: [4, 5, 6, 7], unit: 'utc-months', provenance } },
  ];
}

/** Reserved capsules cannot borrow a general document-licence admission. */
export function isCanadaCabbageFactCandidate(candidate: ProvisionalFieldCandidate): boolean {
  return candidate.source?.id === SOURCE_ID || candidate.source?.url === AAFC_CANADA_CABBAGE_SOURCE.url
    || candidate.id.startsWith(`${SOURCE_ID}:`);
}
/** Narrow reviewed fact use, not a licence for arbitrary protected sources. Exact
 * data-only comparison keeps field, scope, source hash and every qualifier bound. */
export function canadaCabbageFactReuse(candidate: ProvisionalFieldCandidate, context: ProvisionalEvidenceContext,
  recordedAt: string): string | null {
  try {
    return canadaCabbageCandidates(context, 'cabbage', recordedAt, true)
      .some(expected => exactReviewedFactMatch(candidate, expected)) ? AAFC_CABBAGE_FACT_REUSE : null;
  } catch { return null; }
}

export function canadaCabbageResultQualifier(fields: Readonly<Record<string, ResolvedProvisionalField>>): string | null {
  return Object.values(fields).some(field => field.sourceBindings.some(source => source.id === SOURCE_ID))
    ? AAFC_CABBAGE_QUALIFIER : null;
}
