export type LocalAdviceMode = 'general-help' | 'personal-site';

/** Request metadata describes the intended scope; it never supplies country authority. */
export type LocalAdviceRequestContext =
  | { mode: 'general-help' }
  | { mode: 'personal-site'; siteId: string; countryFingerprint: string };

export const LOCAL_ADVICE_CODES = {
  invalidContext: 'LOCAL_ADVICE_INVALID_CONTEXT',
  personalContextNotAllowed: 'LOCAL_ADVICE_PERSONAL_CONTEXT_NOT_ALLOWED',
  siteMismatch: 'LOCAL_ADVICE_SITE_MISMATCH',
  countryUnavailable: 'LOCAL_ADVICE_COUNTRY_UNAVAILABLE',
  countrySourceUnavailable: 'LOCAL_ADVICE_COUNTRY_SOURCE_UNAVAILABLE',
  contextChanged: 'LOCAL_ADVICE_CONTEXT_CHANGED',
} as const;

export type LocalAdviceCode = typeof LOCAL_ADVICE_CODES[keyof typeof LOCAL_ADVICE_CODES];
export interface LocalAdviceWireError {
  code: LocalAdviceCode;
  error: string;
}

export type LocalAdviceDecision =
  | { allowed: true; mode: 'general-help'; fingerprint: string }
  | { allowed: true; mode: 'personal-site'; siteId: string; countryFingerprint: string; fingerprint: string }
  | ({ allowed: false; status: 400 | 409 | 422 | 503 } & LocalAdviceWireError);

export interface LocalAdvicePolicyInput {
  adviceContext: unknown;
  location?: unknown;
  /** Derived by the route from actual supplied fields, never from a request flag.
   * General help permits only absent/null/empty or language-only chat context.
   * A personal field, even null, or an image/record/geometry makes this true. */
  hasSiteInputs: boolean;
}
