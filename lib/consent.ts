/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FARMER CONSENT — precondition (C) of lib/network.ts                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Before this module, `NetworkFarmer.consent` was the literal string `'demo'`
 * for every row in the build, and nothing anywhere asked a farmer whether
 * their income, expenses, training record or homestead coordinate could be
 * shown to a funder. That is the POPIA exposure on exactly the screen the
 * funder dashboard sells.
 *
 * THE RULES THIS MODULE ENCODES
 *
 *  1. CONSENT IS PER-SCOPE. A farmer may be happy for an NGO to see that they
 *     finished eight training modules and unwilling to open their books. One
 *     global yes/no would force them to over-share to participate at all.
 *
 *  2. ABSENCE IS REFUSAL. `null` consent — no doc, unreachable, malformed —
 *     grants nothing. Every helper here fails closed, so the outcome of doing
 *     nothing is the private one.
 *
 *  3. REVOCATION IS IMMEDIATE AND COMPLETE. `revoked_at` set, or the doc
 *     deleted, withdraws every scope at once regardless of the flags left in
 *     `scopes`. A farmer revoking should not have to reason about which
 *     toggles they also need to flip.
 *
 *  4. WITHHELD IS NOT ZERO. {@link applyConsent} sets a withheld metric to
 *     `null` and its coverage flag to `false`, never to 0 — the same contract
 *     lib/network.ts already uses for an unreadable source. A funder card
 *     reading "R0 income, 0% training" is read as evidence the farmer did
 *     nothing, which would punish exactly the farmers who exercised a right.
 *
 * WHAT THIS MODULE IS NOT. It is a projection, not a boundary. The security
 * boundary is firestore.rules (which makes the consent record trustworthy by
 * letting only the farmer write it) plus the server-side check in
 * lib/network-access.ts. Applying this in a browser that already holds the raw
 * documents protects nobody.
 *
 * Pure module: no I/O, no React, no Firestore.
 */

import type {
  NetworkConsent,
  NetworkFarmer,
  NetworkFarmerMetrics,
  NetworkFarmerSummary,
} from './network';

/** One independently grantable slice of a farmer's record. */
export type ConsentScope =
  | 'production'
  | 'sales'
  | 'expenses'
  | 'training'
  | 'surveys'
  | 'location';

export interface ConsentScopeInfo {
  id: ConsentScope;
  /** Farmer-facing label. Written in the second person, plain language, no jargon. */
  label: string;
  /** What the funder actually sees if this is on. Concrete, not reassuring. */
  detail: string;
}

/**
 * The catalogue the consent screen renders. Order is deliberate: the two money
 * scopes sit together and first, because they are the ones a farmer is most
 * likely to refuse and should not have to hunt for.
 */
export const CONSENT_SCOPES: readonly ConsentScopeInfo[] = [
  { id: 'sales',      label: 'What you sold',        detail: 'Your crop sales and the money you earned from them.' },
  { id: 'expenses',   label: 'What you spent',       detail: 'What you paid for seed, tools and inputs.' },
  { id: 'production', label: 'What you harvested',   detail: 'Your harvest weights per crop.' },
  { id: 'training',   label: 'Your training',        detail: 'Which course modules you have finished.' },
  { id: 'surveys',    label: 'Your survey answers',  detail: 'The answers you gave in programme surveys.' },
  { id: 'location',   label: 'Where your farm is',   detail: 'Your exact plot location. With this off, only the district is shown.' },
] as const;

export interface FarmerConsent {
  /** Firebase Auth uid. Also the document id — /farmer_consents/{uid}. */
  uid: string;
  /** The org the consent is granted TO. Pinned to the farmer's own org by the rules. */
  org_id: string | null;
  scopes: Partial<Record<ConsentScope, boolean>>;
  /** ISO. First time any scope was granted. */
  granted_at: string | null;
  /** ISO. Set => every scope is withdrawn, whatever `scopes` still says. */
  revoked_at: string | null;
  /** ISO. Rules require this on every write. */
  updated_at: string;
}

/** A fresh record granting nothing. What a farmer starts with. */
export function emptyConsent(uid: string, orgId: string | null, now: string): FarmerConsent {
  return { uid, org_id: orgId, scopes: {}, granted_at: null, revoked_at: null, updated_at: now };
}

/** True only if this exact scope is granted and the record is live. Fails closed. */
export function hasConsent(consent: FarmerConsent | null | undefined, scope: ConsentScope): boolean {
  if (!consent) return false;
  if (consent.revoked_at) return false;
  return consent.scopes?.[scope] === true;
}

export function grantedScopes(consent: FarmerConsent | null | undefined): ConsentScope[] {
  return CONSENT_SCOPES.map((s) => s.id).filter((id) => hasConsent(consent, id));
}

/**
 * The summary value for {@link NetworkFarmer.consent}. `'demo'` is passed
 * through by the caller for sample rows; this only ever describes real people.
 */
export function consentState(consent: FarmerConsent | null | undefined): NetworkConsent {
  if (!consent) return 'unknown';
  if (consent.revoked_at) return 'withheld';
  return grantedScopes(consent).length > 0 ? 'granted' : 'withheld';
}

/** Toggle one scope, maintaining granted_at/revoked_at. Returns a new record. */
export function setScope(
  consent: FarmerConsent, scope: ConsentScope, value: boolean, now: string,
): FarmerConsent {
  const scopes = { ...consent.scopes, [scope]: value };
  const anyOn = CONSENT_SCOPES.some((s) => scopes[s.id] === true);
  return {
    ...consent,
    scopes,
    // Turning a scope back on un-revokes: the farmer is granting again, and leaving
    // revoked_at set would silently swallow the new grant (rule 3 cuts both ways).
    revoked_at: anyOn ? null : consent.revoked_at,
    granted_at: consent.granted_at ?? (anyOn ? now : null),
    updated_at: now,
  };
}

/** Withdraw everything at once, without clearing the record of what was once granted. */
export function revokeAll(consent: FarmerConsent, now: string): FarmerConsent {
  return { ...consent, revoked_at: now, updated_at: now };
}

/** Which metric fields each scope controls. Anything not listed is always visible. */
const SCOPE_FIELDS: Record<ConsentScope, (keyof NetworkFarmerMetrics)[]> = {
  production: ['producedKg', 'keptKg', 'harvestedKg', 'harvestedVsPlannedPct', 'plannedKg'],
  sales:      ['soldKg', 'soldPct', 'incomeZar', 'estimatedValueZar'],
  expenses:   ['expensesZar'],
  training:   ['modulesDone', 'trainingPct'],
  surveys:    ['surveysAnswered', 'surveyFilled', 'surveyTotal', 'surveyPct'],
  location:   [],
};

/** Coverage flags to clear alongside them, so the UI says "not shared", not 0. */
const SCOPE_COVERAGE: Record<ConsentScope, (keyof NetworkFarmerSummary['metrics']['coverage'])[]> = {
  production: ['production'],
  sales:      ['sales'],
  expenses:   ['expenses'],
  training:   ['courses'],
  surveys:    ['surveys'],
  location:   [],
};

/**
 * Strip everything this farmer has not agreed to share.
 *
 * `netZar` is special-cased: it is income minus expenses, so it silently
 * reconstructs a withheld half whenever the other half is visible. It survives
 * only if BOTH money scopes are granted.
 *
 * @param coarsen supplied by the caller (lib/network.ts#coarsenFarmerLocation)
 *        so this module stays free of geography maths.
 */
export function applyConsent(
  summary: NetworkFarmerSummary,
  consent: FarmerConsent | null | undefined,
  coarsen: (f: NetworkFarmer) => NetworkFarmer,
): NetworkFarmerSummary {
  const metrics: NetworkFarmerMetrics = { ...summary.metrics, coverage: { ...summary.metrics.coverage } };

  for (const { id } of CONSENT_SCOPES) {
    if (hasConsent(consent, id)) continue;
    for (const field of SCOPE_FIELDS[id]) {
      (metrics as unknown as Record<string, unknown>)[field] = null;
    }
    for (const flag of SCOPE_COVERAGE[id]) {
      metrics.coverage[flag] = false;
    }
  }

  if (!(hasConsent(consent, 'sales') && hasConsent(consent, 'expenses'))) {
    metrics.netZar = null;
  }

  const farmer: NetworkFarmer = {
    ...summary.farmer,
    consent: summary.farmer.isDemo ? 'demo' : consentState(consent),
  };

  return {
    farmer: hasConsent(consent, 'location') ? farmer : coarsen(farmer),
    metrics,
  };
}
