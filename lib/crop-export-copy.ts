import { CROP_EXPORT_COPY } from './crop-export-copy-data';
import { recordsMonthShort } from './records-months';
import type { PreservedFoodMethod } from './production-records';

export const CROP_EXPORT_DRAFT_LANGUAGES = ['zu', 'st', 'ts', 've'] as const;
export type CropExportDraftLanguage = typeof CROP_EXPORT_DRAFT_LANGUAGES[number];
export const isCropExportDraftLanguage = (language: string): language is CropExportDraftLanguage =>
  CROP_EXPORT_DRAFT_LANGUAGES.some(code => code === language);

const exportCopy = new Map<string, typeof CROP_EXPORT_COPY[number]>(CROP_EXPORT_COPY.map(row => [row.english, row]));

/** Values are recorded data. Interpolate once so a bed named {count} stays that bed. */
export function cropExportText(source: string, language = 'en', values: Record<string, string | number> = {}): string {
  const row = exportCopy.get(source);
  const wording = row && isCropExportDraftLanguage(language) ? row[language] : source;
  return wording.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
}

const preservedMethodSources: Record<PreservedFoodMethod, string> = { stored: 'Stored', frozen: 'Frozen', dried: 'Dried', fermented: 'Fermented', processed: 'Processed' };
export function cropPreservedMethodText(method: PreservedFoodMethod, language = 'en'): string {
  if (!Object.hasOwn(preservedMethodSources, method)) return method;
  return isCropExportDraftLanguage(language) ? cropExportText(preservedMethodSources[method], language) : method;
}

/** Only generated projection periods enter here; private record dates/names are never reparsed. */
export function cropProjectionPeriodText(source: string, language = 'en'): string {
  if (!isCropExportDraftLanguage(language)) return source;
  const period = /^([A-Za-z]+) (\d{4}) ([–-]) ([A-Za-z]+) (\d{4})$/.exec(source);
  if (!period) return source;
  const months = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString('en-ZA', { month: 'short' }));
  const first = months.indexOf(period[1]), last = months.indexOf(period[4]);
  if (first < 0 || last < 0) return source;
  return `${recordsMonthShort(language, first + 1)} ${period[2]} ${period[3]} ${recordsMonthShort(language, last + 1)} ${period[5]}`;
}

const escapeSourcePattern = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const generatedIssuePatterns = CROP_EXPORT_COPY.filter(row => 'generatedScope' in row && row.generatedScope === 'production-issue').map(row => {
  const keys: string[] = [];
  const parts = row.english.split(/(\{\w+\})/g).map(part => {
    if (!/^\{\w+\}$/.test(part)) return escapeSourcePattern(part);
    const key = part.slice(1, -1); keys.push(key);
    return key === 'date' ? '(\\d{1,4}-\\d{2})' : '(.+?)';
  });
  return { source: row.english, keys, pattern: new RegExp('^' + parts.join('') + '$') };
});

/** Match the producer's complete source sentence, then interpolate recorded values exactly once. */
export function cropProductionIssueText(source: string, language = 'en'): string {
  if (!isCropExportDraftLanguage(language)) return source;
  for (const row of generatedIssuePatterns) {
    const match = row.pattern.exec(source);
    if (!match) continue;
    const values = Object.fromEntries(row.keys.map((key, index) => [key, match[index + 1]]));
    if (values.period) values.period = cropProjectionPeriodText(values.period, language);
    if (values.unit && ['eggs', 'litres', 'items'].includes(values.unit)) values.unit = cropExportText({ eggs: 'Eggs', litres: 'Litres', items: 'Items' }[values.unit]!, language).toLowerCase();
    return cropExportText(row.source, language, values);
  }
  return cropExportText('Original message: {message}', language, { message: source });
}
