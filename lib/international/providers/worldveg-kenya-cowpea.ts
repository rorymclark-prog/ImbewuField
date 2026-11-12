import { WORLDVEG_KENYA_CABBAGE_SOURCE } from './worldveg-kenya-cabbage';
import type { CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

/** Original 24-1077 PDF page26, printed page22, read on 12 November 2026.
 * Seed count is not a final stand, and a spacing range is not a chosen density. */
export const WORLDVEG_KENYA_COWPEA_SOURCE: CountrySource = {
  ...WORLDVEG_KENYA_CABBAGE_SOURCE,
  id: 'worldveg-ke-24-1077-cowpea',
  coverage: 'Kenya field manual; cowpea-leaf production section. No individual farm or variety suitability was established.',
  units: { status: 'known', value: 'Direct-sowing method; row and in-row spacing ranges in cm, conditional on growth habit.' },
  attribution: 'Rapando N, Pawera L, Barare M, Wangungu C, Ramasamy S. 2024. Agroecological vegetable production. A field manual for Kenya. World Vegetable Center. Publication 24-1077, pp21–22. Planning interpretation by ImbewuField; original source unchanged.',
  verifiedClaim: 'The cowpea-leaf section describes direct sowing and distinguishes spacing for spreading versus erect/semi-erect varieties.',
  missingDataBehavior: 'No density, yield or calendar is supplied. Seeds per hill do not establish final surviving plants per station.',
  limitations: 'Conditional method and spacing reference only. Growth habit and leaf-production purpose are grower-supplied, not verified variety identity or suitability. No numeric planner defaults, local agronomy review or planting permission is established.',
};

export type CowpeaReferenceConditions = {
  purpose: '' | 'leaves' | 'pods-or-grain';
  habit: '' | 'spreading' | 'erect-or-semi-erect';
};

export function worldvegKenyaCowpeaReference(countryCode: string | null, cropKey: string) {
  return countryCode === 'KE' && cropKey === 'cowpea' ? WORLDVEG_KENYA_COWPEA_SOURCE : null;
}

export const WORLDVEG_COWPEA_SPACING_VERSION = 'worldveg-ke-24-1077-cowpea-spacing-v1' as const;
export const WORLDVEG_COWPEA_PDF_SHA256 = 'd15d3279690547814b8d369337987f3a6a0893316cbe5cf7ea6afd82e790368c';
const spacingRanges = Object.freeze({
  spreading: Object.freeze({ rowCm: Object.freeze([50, 75] as const), inRowCm: Object.freeze([50, 75] as const) }),
  'erect-or-semi-erect': Object.freeze({ rowCm: Object.freeze([50, 50] as const), inRowCm: Object.freeze([15, 25] as const) }),
});

/** The original says between plants. Treating this as station spacing is a
 * separate grower declaration, never a source claim about multiple survivors. */
export function worldvegKenyaCowpeaSpacingReference(countryCode: string | null, cropKey: string,
  conditions: CowpeaReferenceConditions) {
  if (!worldvegKenyaCowpeaReference(countryCode, cropKey) || conditions.purpose !== 'leaves'
    || !Object.hasOwn(spacingRanges, conditions.habit)) return null;
  return Object.freeze({ ...spacingRanges[conditions.habit as keyof typeof spacingRanges],
    version: WORLDVEG_COWPEA_SPACING_VERSION, pdfSha256: WORLDVEG_COWPEA_PDF_SHA256,
    source: WORLDVEG_KENYA_COWPEA_SOURCE });
}

export function worldvegKenyaCowpeaSpacing(conditions: CowpeaReferenceConditions): string | null {
  const reference = worldvegKenyaCowpeaSpacingReference('KE', 'cowpea', conditions);
  if (!reference) return null;
  const range = ([min, max]: readonly [number, number]) => min === max ? `${min}` : `${min}–${max}`;
  return `${range(reference.rowCm)} cm between rows and ${range(reference.inRowCm)} cm between plants`;
}

export function worldvegKenyaCowpeaCandidates(context: ProvisionalEvidenceContext, cropKey: string,
  recordedAt: string, useReference: boolean, conditions: CowpeaReferenceConditions): readonly ProvisionalFieldCandidate[] {
  const spacing = worldvegKenyaCowpeaSpacing(conditions);
  if (!useReference || !spacing || !worldvegKenyaCowpeaReference(context.countryCode, cropKey)) return [];
  return [{ id: 'worldveg-ke-24-1077-cowpea-direct', field: 'establishment', cropKey: 'cowpea',
    tier: 'local-public-evidence', input: { state: 'provided', value: 'direct', unit: 'method',
      provenance: { kind: 'external-reference', recordedAt, reference: 'Publication 24-1077, p22 (PDF page26), Seeding/planting',
        sourceUrl: WORLDVEG_KENYA_COWPEA_SOURCE.url } },
    geography: { kind: 'country', countryCode: 'KE' }, establishment: 'direct', waterRegime: 'any',
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'recurring-season' }, source: WORLDVEG_KENYA_COWPEA_SOURCE, reuseReview: 'reviewed',
    assumptions: [
      `Grower selected leaf production and ${conditions.habit} growth habit. These are declared conditions, not verified variety characteristics.`,
      `Source spacing for that habit: ${spacing}. These ranges are references, not a selected spacing or calculated plant density.`,
      'The manual describes 2–3 seeds per hill. This is not a final surviving plant count; no density is inferred from it.',
      'Any density entered separately remains a grower estimate, including its final stand and use of the measured area. Leaf, pod and grain yields or timings are not interchangeable.',
      WORLDVEG_KENYA_COWPEA_SOURCE.missingDataBehavior, WORLDVEG_KENYA_COWPEA_SOURCE.limitations,
    ] }];
}
