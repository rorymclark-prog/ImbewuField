import { detachJsonData } from '../../lossless-json';

/** The reviewed source must not drift through a shared mutable export. */
export function freezeReferenceData<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeReferenceData); Object.freeze(value); }
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Comparison only: each source adapter owns its separate reviewed admission.
 * This grants no reuse permission to a matching URL, ID or caller assertion. */
export function exactReviewedFactMatch(actual: unknown, expected: unknown): boolean {
  try { return canonical(detachJsonData(actual)) === canonical(detachJsonData(expected)); }
  catch { return false; }
}
