import { reportDocumentText, REPORT_DOCUMENT_LANGUAGES } from './report-localisation';
import { ASSURANCE_ONE_LINE, planAssuranceText } from './plan-assurance';

export const isNativePdfLanguage = (language: string): boolean => REPORT_DOCUMENT_LANGUAGES.some(code => code === language);
export const SITE_PDF_REVIEW_SOURCE = 'Export labels are unreviewed translations. Saved report text stays in its recorded language.';

/** Only known document furniture is translated; values and already-recorded prose are not templates. */
export function sitePdfText(source: string, language = 'en', values: Record<string, string | number> = {}, legacyZulu?: string): string {
  if (language === 'zu' && legacyZulu !== undefined) {
    return legacyZulu.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
  }
  return reportDocumentText(source, language, values);
}

/** The complete source caution is shared by the site report and its working-plan appendix. */
export const sitePdfAssurance = (language = 'en'): string => planAssuranceText(ASSURANCE_ONE_LINE, language);
