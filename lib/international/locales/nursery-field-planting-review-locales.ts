/** Worksheet choices only: neither this list nor a draft comparison enables an app language. */
export const NURSERY_REVIEW_LANGUAGES = [
  { locale: 'fr', label: 'French · Français', direction: 'ltr' },
  { locale: 'es', label: 'Spanish · Español', direction: 'ltr' },
  { locale: 'pt-BR', label: 'Brazilian Portuguese · Português (Brasil)', direction: 'ltr' },
  { locale: 'sw', label: 'Swahili · Kiswahili', direction: 'ltr' },
  { locale: 'hi', label: 'Hindi · हिन्दी', direction: 'ltr' },
  { locale: 'bn', label: 'Bengali · বাংলা', direction: 'ltr' },
  { locale: 'id', label: 'Indonesian · Bahasa Indonesia', direction: 'ltr' },
  { locale: 'ar', label: 'Arabic · العربية', direction: 'rtl' },
  { locale: 'ur', label: 'Urdu · اردو', direction: 'rtl' },
  { locale: 'ne', label: 'Nepali · नेपाली', direction: 'ltr' },
  { locale: 'vi', label: 'Vietnamese · Tiếng Việt', direction: 'ltr' },
] as const;
export type NurseryReviewLocale = typeof NURSERY_REVIEW_LANGUAGES[number]['locale'];
export const NURSERY_REVIEW_LOCALES = NURSERY_REVIEW_LANGUAGES.map(language => language.locale);
