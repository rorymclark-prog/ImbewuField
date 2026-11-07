// Number formatting shared by the Finance charts.
//
// en-ZA groups thousands with U+00A0, which survives copy-paste into a spreadsheet
// as a non-breaking space and quietly breaks the paste. The app has always
// normalised it to a plain space; these helpers are that rule in one place rather
// than re-typed in every card.

import { localeDate } from '@/lib/xh-dates';

/** 'R1 240' — whole rand, plain-space grouped. Negative reads '−R120', not 'R-120'. */
export function randLabel(amount: number): string {
  if (!Number.isFinite(amount)) return 'R0';
  const rounded = Math.round(amount);
  const body = numberLabel(Math.abs(rounded));
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

/**
 * '86 400' — a plain number with space-grouped thousands, identical on the server and in every
 * browser.
 *
 * THE BUG THIS EXISTS FOR. 82 call sites rendered figures with a bare `n.toLocaleString()`, which
 * formats in the RUNTIME's default locale — Node's on the server, the browser's on the client. On
 * /survey that produced a real, visible hydration failure: React logged "Text content did not
 * match. Server: 86 400, Client: 86,400" and the rain figure changed under the farmer after load.
 * A number that is the whole point of the screen cannot flicker.
 *
 * Pinning `toLocaleString('en-ZA')` is not the fix, and this file's header already says why: it
 * emits U+00A0, which breaks a spreadsheet paste, and its output still differs between ICU builds
 * so the two renders can still disagree. {@link kgTotalLabel}, `formatZar` in price-book.ts,
 * `formatInvoiceZar` in invoice-document.ts and `group()` in app/network/page.tsx had each
 * independently landed on regex grouping for exactly that reason. This is that rule, once, for
 * every plain figure — so there is one place to change if the house convention ever moves.
 *
 * Fractional digits pass through with a period, which is what the browser was already rendering
 * for the handful of non-integer call sites. Money keeps its own formatters: cents are a comma in
 * this app (`formatInvoiceZar`), and unifying the decimal mark across measurements and currency is
 * a product decision, not a formatting one.
 */
/**
 * 'R1 240,00' — whole-and-cents rand, space-grouped thousands, comma decimal mark: the same
 * convention `formatInvoiceZar` (lib/invoice-document.ts) already uses for invoice totals, so a
 * card quoting a rand figure with cents reads the same way wherever it sits on the page. Negative
 * reads '-R120,00'.
 *
 * ux-17: the records lender card used to format its Income/Costs tiles with a bare
 * `R ${numberLabel(value, 0)}` — space after 'R', no cents — while the figures above it on the
 * same screen read 'R8 172,00' through `formatInvoiceZar`. One screen, one convention.
 */
export function randCentsLabel(amount: number): string {
  if (!Number.isFinite(amount)) return 'R0,00';
  const sign = amount < 0 ? '-' : '';
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = (cents % 100).toString().padStart(2, '0');
  return `${sign}R${whole},${frac}`;
}

/**
 * '1 203,6 kg' — space-grouped thousands with a comma decimal, one decimal place, matching the
 * money figures' convention above instead of `quantity.toLocaleString('en-ZA')`: that call renders
 * differently across ICU builds and between server and client (the hydration-mismatch class
 * {@link numberLabel} documents), which is how a harvest total ended up reading '1,203.6 kg' —
 * US thousands commas with a period decimal — beside rand figures formatted the South African way.
 */
export function kgPreciseLabel(kg: number): string {
  if (!Number.isFinite(kg)) return '0,0 kg';
  const sign = kg < 0 ? '-' : '';
  const tenths = Math.round(Math.abs(kg) * 10);
  const whole = Math.floor(tenths / 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = (tenths % 10).toString();
  return `${sign}${whole},${frac} kg`;
}

export function numberLabel(n: number, maximumFractionDigits = 3): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const factor = 10 ** Math.max(0, Math.min(20, Math.trunc(maximumFractionDigits)));
  // Large entered values must not become Infinity merely while formatting decimals.
  const rounded = abs <= Number.MAX_VALUE / factor ? Math.round(abs * factor) / factor : abs;
  const [whole, frac] = rounded.toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * '15 Aug 2026' — the staff dashboards' shared date format (mentor, assessments, ngo). Raw
 * 'YYYY-MM-DD' strings were leaking straight onto the screen (e.g. 'Due 2026-08-01'); this is
 * the one place that turns such a string into something a staff member reads at a glance.
 *
 * `toLocaleDateString` is used deliberately rather than a hand-rolled month table — lib/
 * course-assignments.ts's `monthAbbrev` already takes that approach for the exact same reason,
 * and invoice-document.ts formats dates the same way for the exact same locale pair. Day/month
 * order (not en-ZA's month/day) is what a South African reader expects. isiXhosa has no browser
 * locale pack ('xh-ZA' falls back to English), so lang 'xh' uses lib/xh-dates.ts month names.
 */
export function formatStaffDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return localeDate(lang, date, { day: 'numeric', month: 'short', year: 'numeric' }, lang === 'zu' ? 'zu-ZA' : 'en-GB');
}

/** '15 Aug – 5 Sep 2026' — a staff date range, dropping the year from the first date when both
 *  fall in the same year so it isn't printed twice. Falls back to the single date when only one
 *  side of the range is known. */
export function formatStaffDateRange(fromIso: string | null | undefined, toIso: string | null | undefined, lang: string): string {
  if (!fromIso || !toIso) return formatStaffDate(fromIso ?? toIso, lang);
  const fromDate = new Date(`${fromIso}T00:00:00`);
  const toDate = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return `${fromIso} – ${toIso}`;
  const locale = lang === 'zu' ? 'zu-ZA' : 'en-GB';
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const fromLabel = localeDate(lang, fromDate, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }, locale);
  const toLabel = localeDate(lang, toDate, { day: 'numeric', month: 'short', year: 'numeric' }, locale);
  return `${fromLabel} – ${toLabel}`;
}
