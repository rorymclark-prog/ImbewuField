/** Country, language, an agricultural region and evidence approval are separate
 * inputs. None is a substitute for the others when a grower acts on a plan. */
export const EVIDENCE_CATEGORIES = ['biodiversity', 'agricultural-extension', 'weather-frost', 'soils', 'plant-legality'] as const;
export type EvidenceCategory = typeof EVIDENCE_CATEGORIES[number];
export type Known<T> = { status: 'known'; value: T } | { status: 'unknown'; reason: string };
export interface CountrySource {
  id: string;
  category: EvidenceCategory;
  authority: string;
  title: string;
  url: string;
  coverage: string;
  resolution: Known<string>;
  units: Known<string>;
  updateCadence: Known<string>;
  licence: Known<string>;
  attribution: string;
  accessRequirements: Known<string>;
  missingDataBehavior: string;
  verification: 'content-read' | 'snippet-only' | 'unavailable' | 'not-checked';
  accessedOn: string | null;
  publishedOn: string | null;
  /** Month-only publication evidence stays month-only; never fabricate a day.
   * Mutually exclusive with a non-null publishedOn. */
  publishedMonth?: string | null;
  /** Page modification metadata is not evidence of publication. */
  lastModifiedOn?: string | null;
  reviewDueOn: string | null;
  verifiedClaim: string;
  limitations: string;
}
export interface AgriculturalRegion {
  id: string;
  name: string;
  definitionSourceId: string;
  status: 'reference-only' | 'reviewed';
}
export interface LocalAgronomyReview {
  status: 'not-reviewed' | 'reviewed';
  regionId: string | null;
  reviewedOn: string | null;
  validThrough: string | null;
  sourceIds: string[];
  reviewer: string | null;
}
export interface CountryProfile {
  code: string;
  name: string;
  stage: 'engineering-pilot' | 'research-queue';
  jurisdictionNote: string;
  regions: AgriculturalRegion[];
  sources: CountrySource[];
  agronomyReview: LocalAgronomyReview;
}
export interface CountryContext {
  countryCode: string;
  agriculturalRegionId?: string;
  interfaceLanguage?: string;
}
export const unknown = (reason: string): Known<never> => ({ status: 'unknown', reason });
