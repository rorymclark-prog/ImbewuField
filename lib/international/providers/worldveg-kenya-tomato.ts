import { WORLDVEG_KENYA_CABBAGE_SOURCE } from './worldveg-kenya-cabbage';
import { WORLDVEG_COWPEA_PDF_SHA256 } from './worldveg-kenya-cowpea';
import type { CountrySource } from '../countries/types';
import type { ProvisionalEvidenceContext, ProvisionalFieldCandidate } from '../provisional-crop-planning';

export type KenyaTomatoNurseryBasis = 'lower-bound' | 'upper-bound';
export interface KenyaTomatoNurseryUse {
  readonly purpose: 'protected-nursery-to-outdoor-transplant';
  readonly basis: KenyaTomatoNurseryBasis;
}
const tomatoWeeks = Object.freeze([4, 6] as const);
export const WORLDVEG_TOMATO_NURSERY = Object.freeze({
  weeks: tomatoWeeks, days: Object.freeze([tomatoWeeks[0] * 7, tomatoWeeks[1] * 7] as const), pdfSha256: WORLDVEG_COWPEA_PDF_SHA256,
});

/** The tomato paragraph concerns nursery raising, unlike the cabbage section's
 * similarly worded bed-preparation interval. Neither endpoint is preferred. */
export const WORLDVEG_KENYA_TOMATO_SOURCE: CountrySource = {
  ...WORLDVEG_KENYA_CABBAGE_SOURCE,
  id: 'worldveg-ke-24-1077-tomato-nursery',
  coverage: 'Kenya field manual; tomato seeds in a protected nursery before outdoor transplanting. No site or cultivar suitability certification.',
  units: { status: 'known', value: '4–6 weeks before outdoor transplanting; exactly 28–42 days. Grower chooses a reported endpoint.' },
  attribution: 'Rapando N, Pawera L, Barare M, Wangungu C, Ramasamy S. 2024. Agroecological vegetable production. A field manual for Kenya. World Vegetable Center. Publication 24-1077, p31 (PDF35). CC BY-SA 3.0 Unported, https://creativecommons.org/licenses/by-sa/3.0/ . Nursery facts adapted and weeks converted to days by ImbewuField; original source unchanged. Adapted source material retains CC BY-SA terms. The publisher requests a copy of citing work; no copy has been sent.',
  accessedOn: '2026-11-13', publishedOn: null, publishedMonth: '2024-06', reviewDueOn: null,
  verifiedClaim: 'The tomato seeding/transplanting paragraph describes a protected nursery for 4–6 weeks before outdoor transplanting; seedlings are hardened before transplanting without a specified hardening duration.',
  missingDataBehavior: 'No point duration until an endpoint is explicitly chosen. No density, final stand, yield, entry month, field-harvest duration, occupancy, turnaround or water-demand default is supplied.',
  limitations: 'Conditional seed-to-outdoor-transplant nursery reference, not a source planting calendar, direct seeding, greenhouse crop duration or elapsed age of purchased seedlings. Both endpoints are grower choices within the source range, not source preferences or guarantees of readiness. Hardening is unquantified; no extra days are added. Current farm, variety, temperature and water suitability, frost safety and planting permission are unverified.',
};

export function worldvegKenyaTomatoReference(country: string | null, crop: string) {
  return country === 'KE' && crop === 'tomatoes' ? WORLDVEG_KENYA_TOMATO_SOURCE : null;
}

export function worldvegKenyaTomatoCandidates(context: ProvisionalEvidenceContext, crop: string,
  recordedAt: string, useReference: boolean, use: KenyaTomatoNurseryUse | null): readonly ProvisionalFieldCandidate[] {
  if (!useReference || !worldvegKenyaTomatoReference(context.countryCode, crop) || context.establishment === 'direct'
    || use?.purpose !== 'protected-nursery-to-outdoor-transplant' || !['lower-bound', 'upper-bound'].includes(use.basis)) return [];
  const days = WORLDVEG_TOMATO_NURSERY.days[use.basis === 'lower-bound' ? 0 : 1];
  const binding = `${use.purpose}:${use.basis}:${WORLDVEG_TOMATO_NURSERY.pdfSha256}`;
  const provenance = { kind: 'external-reference' as const, recordedAt, sourceUrl: WORLDVEG_KENYA_TOMATO_SOURCE.url,
    reference: `24-1077, p31 (PDF35), Tomato, Seeding and transplanting; ${binding}` };
  const common = {
    cropKey: 'tomatoes', tier: 'local-public-evidence' as const,
    geography: { kind: 'country' as const, countryCode: 'KE' }, establishment: 'transplant' as const, waterRegime: 'any' as const,
    ...(context.varietyReference ? { varietyReference: context.varietyReference } : {}),
    temporalScope: { kind: 'recurring-season' as const }, source: WORLDVEG_KENYA_TOMATO_SOURCE, reuseReview: 'reviewed' as const,
    assumptions: [
      `Reference-use binding: ${binding}. Grower explicitly chose protected-nursery seeding followed by outdoor transplanting.`,
      `Reported nursery interval: 4–6 weeks, exactly 4 × 7 = 28 to 6 × 7 = 42 days. Grower chose ${use.basis}: ${days} days. Neither endpoint is preferred by the source.`,
      'Nursery start is conditional arithmetic from the separately entered field-entry date, not a source calendar or guarantee of seedling readiness.',
      'The source also calls for hardening before transplanting but gives no duration or separate additional interval. No hardening days are added.',
      'Kenya is the manual context, not a verified local site, cultivar or regional suitability determination. No source temperature range is converted into planting months. Water regime any does not prove water adequacy.',
      WORLDVEG_KENYA_TOMATO_SOURCE.missingDataBehavior, WORLDVEG_KENYA_TOMATO_SOURCE.limitations,
    ],
  };
  return [
    { ...common, id: `worldveg-ke-tomato-${binding}-transplant`, field: 'establishment',
      input: { state: 'provided', value: 'transplant', unit: 'method', provenance } },
    { ...common, id: `worldveg-ke-tomato-${binding}-nursery`, field: 'nurseryDays', reportedRange: WORLDVEG_TOMATO_NURSERY.days,
      planningValueBasis: use.basis, input: { state: 'provided', value: days, unit: 'days', provenance } },
  ];
}
