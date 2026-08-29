// Number formatting shared by the Finance charts.
//
// en-ZA groups thousands with U+00A0, which survives copy-paste into a spreadsheet
// as a non-breaking space and quietly breaks the paste. The app has always
// normalised it to a plain space; these helpers are that rule in one place rather
// than re-typed in every card.

/** 'R1 240' — whole rand, plain-space grouped. Negative reads '−R120', not 'R-120'. */
export function randLabel(amount: number): string {
  if (!Number.isFinite(amount)) return 'R0';
  const rounded = Math.round(amount);
  const body = Math.abs(rounded).toLocaleString('en-ZA').replace(/ |,/g, ' ');
  return `${rounded < 0 ? '−' : ''}R${body}`;
}

/** '8.4 kg' below a hundred, '140 kg' above it — a tenth of a kilogram stops mattering. */
export function kgLabel(kg: number): string {
  if (!Number.isFinite(kg)) return '0 kg';
  return kg >= 100 ? `${Math.round(kg)} kg` : `${kg.toFixed(1)} kg`;
}

/** 'R1.2k' for a cramped axis, where the exact rand is in the readout instead. */
export function randTick(amount: number): string {
  if (!Number.isFinite(amount)) return 'R0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 10000) return `${sign}R${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}R${(abs / 1000).toFixed(1)}k`;
  return `${sign}R${Math.round(abs)}`;
}

/**
 * '27 090 kg' — whole kilograms, space-grouped, for a figure that adds up a whole cohort.
 *
 * {@link kgLabel} above is the per-farm figure and keeps a tenth of a kilogram below 100, which is
 * right when the number is one farmer's morning. Across sixteen farms over a year that decimal is
 * noise and the thousands separator is the thing that makes the number readable at a glance.
 *
 * Grouped by regex rather than `toLocaleString('en-ZA')` deliberately, matching the `group()`
 * helper on app/network/page.tsx: the locale route emits U+00A0 (see this file's header) and its
 * output differs between the server and the browser's ICU build, so a server-rendered total and
 * its first client render could disagree on a hydrated page.
 */
export function kgTotalLabel(kg: number): string {
  if (!Number.isFinite(kg)) return '0 kg';
  return `${Math.round(kg).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kg`;
}
