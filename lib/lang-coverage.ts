import type { Dict } from '@/lib/i18n-pending';

// A language counts as complete once it renders at least this share of the English UI
// dictionary in its own words — the owner's bar for hiding the "partly in English" notice in
// Settings' language picker (components/ThemePanel.tsx).
export const LANG_COVERAGE_COMPLETE_THRESHOLD = 0.95;

export interface LangCoverage {
  /** Keys the locale renders differently from the English source. */
  translated: number;
  /** Keys in the English dictionary. */
  total: number;
  /** translated / total (1 when there are no keys to translate). */
  ratio: number;
  /** ratio >= LANG_COVERAGE_COMPLETE_THRESHOLD. */
  complete: boolean;
}

/**
 * How much of `englishDict` a locale's dictionary actually translates.
 *
 * A key counts as translated only when the locale defines it AND its value differs from the
 * English source. Every locale spreads the same *_ENGLISH_PENDING blocks English itself spreads
 * (lib/i18n-pending.ts, lib/learner-ui-english.ts), so still-pending copy is identical across
 * every locale on purpose — counting that as "translated" would make every partial language look
 * complete.
 */
export function coverageOf(englishDict: Dict, localeDict: Dict): LangCoverage {
  const keys = Object.keys(englishDict);
  const total = keys.length;
  if (total === 0) return { translated: 0, total: 0, ratio: 1, complete: true };
  let translated = 0;
  for (const key of keys) {
    const value = localeDict[key];
    if (value !== undefined && value !== englishDict[key]) translated += 1;
  }
  const ratio = translated / total;
  return { translated, total, ratio, complete: ratio >= LANG_COVERAGE_COMPLETE_THRESHOLD };
}
