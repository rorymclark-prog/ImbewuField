/**
 * crop-identity.ts — deciding WHICH crop a written name refers to, in one place.
 *
 * WHY THIS FILE EXISTS. Logging forms write the CATALOGUE name from a picker, while several crop
 * fields are free text a farmer types — /finances "Money in" has no picker at all. So one avocado
 * tree routinely arrives as "Avocado" (picked) and "Avocados" (sold). That is the ORDINARY path,
 * not an edge case, and any code that groups, keys, totals or labels a group by raw text splits
 * one tree into two: a grower who never sells beside a seller who never grows. Each row is true.
 * The pair is a lie about how many trees the farm has.
 *
 * On 2026-08-23 that same split was found and fixed FIVE times on five screens, each one found
 * only by looking at the live build after fixing the previous one — and a sixth instance was still
 * sitting in the one document that leaves the app and gets handed to a bank. Five copies of an
 * identity rule is not a rule, it is five chances to miss one. So it lives here, once, and every
 * caller routes through it.
 *
 * PURE. Catalogue lookups only — no storage, no Firestore, no view state. Both callers
 * (lib/farm-metrics.ts, lib/credit-pack.ts) promise purity in their own headers and keep it.
 */

import { cropByKey } from './crop-catalog';
import { buildCropAliasIndex, matchCropKey } from './harvest-reconciliation';
import { perennialKeyForName, perennialProduceByKey } from './perennial-produce';

export interface CropIdentity {
  /** A catalogue key when either catalogue recognised the name, null when neither did. */
  key: string | null;
  /** What to print: the catalogue's own name, or the farmer's exact words when it is theirs. */
  label: string;
}

export type CropAliasIndex = ReturnType<typeof buildCropAliasIndex>;

export { buildCropAliasIndex };

/**
 * The written name a farmer's row carries, resolved to one identity.
 *
 * BOTH catalogues are asked, the annual one first, because it is the schedulable one and a name
 * that resolves to a plannable crop must keep resolving to it.
 *
 * A name in NEITHER catalogue keeps the farmer's exact words (never title-cased, never guessed at)
 * and is keyed on its own lowercased text, so two spellings of something the app has never heard
 * of stay two rows rather than being merged on a hunch.
 */
export function cropIdentityOf(label: string, aliases: CropAliasIndex): CropIdentity {
  const key = matchCropKey(label, aliases);
  if (key) return { key, label: cropByKey(key)?.name ?? label.trim() };
  const perennialKey = perennialKeyForName(label);
  // Perennial keys are namespaced precisely so they can never collide with a CROPS key here.
  if (perennialKey) return { key: perennialKey, label: perennialProduceByKey(perennialKey)?.label ?? label.trim() };
  return { key: null, label: label.trim() || 'Unnamed crop' };
}

/** The map key to group by. Never the raw text — that is the bug this module exists to stop. */
export function cropIdentityMapKey(identity: CropIdentity): string {
  return identity.key ? `crop:${identity.key}` : `written:${identity.label.toLocaleLowerCase()}`;
}
