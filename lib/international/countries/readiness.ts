import { COUNTRY_PROFILES } from './registry';
import { EVIDENCE_CATEGORIES, type CountryContext, type CountryProfile, type CountrySource } from './types';

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function sourceEvidenceState(source: CountrySource, asOf: string): 'available-reference' | 'missing' | 'stale' | 'undated' {
  if (!validDate(asOf)) throw new RangeError('A real assessment date is required.');
  if (source.verification !== 'content-read') return 'missing';
  if (!validDate(source.accessedOn) || source.accessedOn > asOf || !validDate(source.publishedOn)
    || source.publishedOn > asOf || (source.reviewDueOn !== null && !validDate(source.reviewDueOn))) return 'undated';
  if (source.reviewDueOn !== null && source.reviewDueOn < asOf) return 'stale';
  return 'available-reference';
}

export function evaluateCountryReadiness(context: CountryContext, asOf: string, profiles: readonly CountryProfile[] = COUNTRY_PROFILES) {
  if (!validDate(asOf)) throw new RangeError('A real assessment date is required.');
  const country = profiles.find((profile) => profile.code === context.countryCode.toUpperCase());
  const gaps: string[] = [];
  if (!country) gaps.push('This country has no reviewed dossier in this foundation.');
  const region = country?.regions.find((entry) => entry.id === context.agriculturalRegionId);
  if (!region) gaps.push('An agricultural region has not been identified and reviewed.');
  else if (region.status !== 'reviewed') gaps.push('The selected agricultural region is reference-only.');
  const evidence = EVIDENCE_CATEGORIES.map((category) => {
    const sources = country?.sources.filter((source) => source.category === category) ?? [];
    const available = sources.filter((source) => sourceEvidenceState(source, asOf) === 'available-reference');
    if (!available.length) gaps.push(`Current verified ${category} reference evidence is missing.`);
    return { category, sources, availableCount: available.length };
  });
  const review = country?.agronomyReview;
  const localReviewComplete = !!review && review.status === 'reviewed' && !!region && region.status === 'reviewed'
    && !!country?.sources.some((source) => source.id === region.definitionSourceId && sourceEvidenceState(source, asOf) === 'available-reference')
    && review.regionId === region.id && !!review.reviewer?.trim() && validDate(review.reviewedOn) && review.reviewedOn <= asOf
    && validDate(review.validThrough) && review.validThrough >= asOf && review.sourceIds.length > 0
    && EVIDENCE_CATEGORIES.every((category) => evidence.find((entry) => entry.category === category)?.sources
      .some((source) => review.sourceIds.includes(source.id) && sourceEvidenceState(source, asOf) === 'available-reference'));
  if (!localReviewComplete) gaps.push('Local agronomy has not passed a dated review for this region and source scope.');
  return { country: country ?? null, region: region ?? null, interfaceLanguage: context.interfaceLanguage ?? null,
    evidence, localReviewComplete, productionPlanSupported: false as const, southAfricanFallbackAllowed: false as const,
    status: localReviewComplete ? 'reviewed-evidence-only' as const : country ? 'reference-only' as const : 'unsupported-country' as const,
    gaps, limitation: 'This foundation does not enable an international crop engine. A working reference API or translated interface does not validate local sowing dates, yields or plant legality.' };
}
