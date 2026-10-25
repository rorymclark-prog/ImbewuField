import { CROP_EXPORT_COPY } from './crop-export-copy-data';

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
