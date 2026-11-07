import { CURRENT_DECK_RELEASE_BINDINGS } from '@/lib/course-deck-release-bindings-registry';
import { COURSE_DECKS, currentRegionalDeckSlide, resolveDeckLang } from '@/lib/course-deck';
import { availableNarrationLanguages, requiresExplicitNarrationChoice } from '@/lib/course-audio';

/**
 * resolveDeckLang, plus the languages whose slides ship only as source-paired silent cards
 * (isiXhosa: lib/course-deck-release-bindings-xh-data.ts) rather than as a slide folder. The cards
 * count as the learner's own slides only while the current release still resolves against the live
 * English source; a drifted release reads as English slides, as each slide then shows its English
 * still (slideImageFor).
 */
export function resolveLearnerDeckLang(moduleId: string, want: string): { lang: string; exact: boolean } | null {
  const first = COURSE_DECKS[moduleId]?.slides[0]?.slide;
  if (want === 'xh' && first !== undefined && CURRENT_DECK_RELEASE_BINDINGS.has(moduleId, want)
    && currentRegionalDeckSlide(moduleId, want, first)) return { lang: want, exact: true };
  return resolveDeckLang(moduleId, want);
}

/**
 * requiresExplicitNarrationChoice, plus isiXhosa: like the Sesotho, Xitsonga and Tshivenda
 * readers, an isiXhosa reader with no isiXhosa recording chooses English source narration or none,
 * rather than having an English voice start over their isiXhosa cards.
 */
export function requiresLearnerNarrationChoice(moduleId: string, appLang: string): boolean {
  if (appLang === 'xh') return !availableNarrationLanguages(moduleId).includes(appLang);
  return requiresExplicitNarrationChoice(moduleId, appLang);
}
