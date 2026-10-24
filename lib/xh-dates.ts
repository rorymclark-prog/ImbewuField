// isiXhosa date lines. Browsers' locale packs fall back to English for 'xh-ZA', so the app
// writes isiXhosa dates from its own month names (the same ones as the homeMonth* keys in
// lib/locales/xh.ts and components/journal/journal-labels.ts). Pure: no React, no Intl.

const MONTHS_LONG = ['Janyuwari', 'Februwari', 'Matshi', 'Epreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septemba', 'Okthobha', 'Novemba', 'Disemba'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mat', 'Epr', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'];

export interface XhosaDateOptions {
  day?: boolean;
  month: 'short' | 'long';
  year?: boolean;
  /** Append HH:MM:SS (24 hour, device-local time). */
  time?: boolean;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** '24 Okt 2026', '24 Okthobha 2026', '24 Okt 2026 14:05:09' — day, month, year order. */
export function formatXhosaDate(date: Date, opts: XhosaDateOptions): string {
  if (Number.isNaN(date.getTime())) return '';
  const names = opts.month === 'long' ? MONTHS_LONG : MONTHS_SHORT;
  const parts: string[] = [];
  if (opts.day) parts.push(String(date.getDate()));
  parts.push(names[date.getMonth()]);
  if (opts.year) parts.push(String(date.getFullYear()));
  let out = parts.join(' ');
  if (opts.time) out += ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return out;
}

/**
 * toLocaleDateString for a screen language: isiXhosa gets its own month names when the options
 * ask for a month; every other language (and a month-less numeric xh date) is exactly
 * `date.toLocaleDateString(fallbackLocale, intlOptions)`.
 */
export function localeDate(lang: string, date: Date, intlOptions: Intl.DateTimeFormatOptions, fallbackLocale: string): string {
  if (lang === 'xh' && (intlOptions.month === 'short' || intlOptions.month === 'long')) {
    return formatXhosaDate(date, { day: !!intlOptions.day, month: intlOptions.month, year: !!intlOptions.year });
  }
  return date.toLocaleDateString(fallbackLocale, intlOptions);
}
