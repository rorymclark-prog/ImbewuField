export interface FormattingContext {
  requested: string;
  canonical: string | null;
  status: 'supported' | 'fallback' | 'invalid';
  numberLocale: string;
  dateLocale: string;
  pluralLocale: string;
  reason: string | null;
}
type Available = (locale: string) => boolean;
const supported: Available = (locale) => Intl.NumberFormat.supportedLocalesOf([locale], { localeMatcher: 'lookup' }).length > 0
  && Intl.DateTimeFormat.supportedLocalesOf([locale], { localeMatcher: 'lookup' }).length > 0
  && Intl.PluralRules.supportedLocalesOf([locale], { localeMatcher: 'lookup' }).length > 0;

/** Expose actual runtime/ICU resolution instead of treating silent fallback as coverage. */
export function formattingContext(requested: string, available: Available = supported): FormattingContext {
  let canonical: string | null = null;
  try { canonical = Intl.getCanonicalLocales(requested)[0] ?? null; } catch { /* Invalid tags are a reportable state. */ }
  const valid = canonical !== null;
  const usable = valid && available(canonical!);
  const locale = usable ? canonical! : 'en';
  return { requested, canonical, status: !valid ? 'invalid' : usable ? 'supported' : 'fallback',
    numberLocale: new Intl.NumberFormat(locale, { localeMatcher: 'lookup' }).resolvedOptions().locale,
    dateLocale: new Intl.DateTimeFormat(locale, { localeMatcher: 'lookup' }).resolvedOptions().locale,
    pluralLocale: new Intl.PluralRules(locale, { localeMatcher: 'lookup' }).resolvedOptions().locale,
    reason: !valid ? 'Invalid locale tag; English formatting is shown explicitly.'
      : !usable ? 'Requested locale unavailable in this runtime; English formatting is shown explicitly.' : null };
}

export function formatNumber(value: number, context: FormattingContext, maximumFractionDigits = 2): string | null {
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 20) return null;
  return new Intl.NumberFormat(context.numberLocale, { maximumFractionDigits }).format(value);
}

export function calendarDateParts(iso: string, context: FormattingContext): Intl.DateTimeFormatPart[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return new Intl.DateTimeFormat(context.dateLocale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).formatToParts(date);
}
export function formatCalendarDate(iso: string, context: FormattingContext): string | null {
  return calendarDateParts(iso, context)?.map((part) => part.value).join('') ?? null;
}

export interface RecordedMoney { amount: number; currency: string }
function validMoney(value: RecordedMoney): boolean {
  return Number.isFinite(value.amount) && /^[A-Z]{3}$/.test(value.currency);
}
/** This only changes presentation; it does not convert or relabel a recorded denomination. */
export function formatRecordedMoney(value: RecordedMoney, context: FormattingContext): { text: string; currency: string } | null {
  if (!validMoney(value)) return null;
  return { text: new Intl.NumberFormat(context.numberLocale, { style: 'currency', currency: value.currency, currencyDisplay: 'code' }).format(value.amount), currency: value.currency };
}
export type MoneyTotal = { status: 'empty' } | { status: 'invalid' } | { status: 'single-currency'; total: RecordedMoney }
  | { status: 'mixed-currencies'; subtotals: RecordedMoney[] };
export function totalRecordedMoney(values: readonly RecordedMoney[]): MoneyTotal {
  if (!values.length) return { status: 'empty' };
  const totals = new Map<string, number>();
  for (const value of values) {
    if (!validMoney(value)) return { status: 'invalid' };
    const total = (totals.get(value.currency) ?? 0) + value.amount;
    if (!Number.isFinite(total)) return { status: 'invalid' };
    totals.set(value.currency, total);
  }
  const subtotals = [...totals].map(([currency, amount]) => ({ amount, currency }));
  return subtotals.length === 1 ? { status: 'single-currency', total: subtotals[0] } : { status: 'mixed-currencies', subtotals };
}
