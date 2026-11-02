import type { LanguageMetadata, TextDirection } from './types';

export const DRAFT_LANGUAGES: readonly LanguageMetadata[] = [
  { language: 'fr', englishName: 'French', nativeName: 'Français', direction: 'ltr', suggestedFormattingLocale: 'fr', readiness: 'unreviewed-draft' },
  { language: 'es', englishName: 'Spanish', nativeName: 'Español', direction: 'ltr', suggestedFormattingLocale: 'es', readiness: 'unreviewed-draft' },
  { language: 'pt', englishName: 'Portuguese', nativeName: 'Português', direction: 'ltr', suggestedFormattingLocale: 'pt', readiness: 'unreviewed-draft' },
  { language: 'sw', englishName: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', suggestedFormattingLocale: 'sw', readiness: 'unreviewed-draft' },
];

/** Direction is explicit metadata. A language tag never selects a country or currency. */
export function isolateText(value: string, direction: TextDirection | 'auto' = 'auto'): string {
  // Remove controls inside an untrusted value so it cannot escape its outer isolate.
  const clean = value.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
  return `${direction === 'rtl' ? '\u2067' : direction === 'ltr' ? '\u2066' : '\u2068'}${clean}\u2069`;
}
