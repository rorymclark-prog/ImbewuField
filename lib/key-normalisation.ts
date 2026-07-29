export type LookupKeySeparator = '-' | '_';

/**
 * Canonicalise a persisted lookup key without rewriting the saved value.
 *
 * Water symbols use hyphenated keys while catalogue and structure tables use underscores.
 * Sharing the boundary rule but keeping the separator explicit prevents either table from
 * silently inheriting the other table's key format.
 */
export function normaliseLookupKey(
  raw: unknown,
  separator: LookupKeySeparator,
): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, separator);
}
