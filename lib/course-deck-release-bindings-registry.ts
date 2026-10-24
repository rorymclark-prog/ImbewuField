import { createCourseDeckReleaseBindings, type CourseDeckRelease, type CourseDeckReleaseBindings, type DeckReleaseSource, type ReleasePair } from './course-deck-release-bindings';
import stSilentPair from '../docs/narration/intro-permaculture.st.silent-draft.json' with { type: 'json' };
import { COURSE_DECK_RELEASE_ROWS, COURSE_DECK_RELEASE_EXPECTED_COUNTS } from './course-deck-release-bindings-data';
import { XH_DECK_RELEASE_EXPECTED_COUNTS, XH_DECK_RELEASE_ROWS } from './course-deck-release-bindings-xh-data';

// An invalid declared replacement stays active and unavailable; it cannot expose legacy media.
const SESOTHO_AND_EARLIER_BINDINGS = createCourseDeckReleaseBindings(
  COURSE_DECK_RELEASE_ROWS, COURSE_DECK_RELEASE_EXPECTED_COUNTS,
  path => path === 'docs/narration/intro-permaculture.st.silent-draft.json' ? stSilentPair : undefined,
);
/**
 * The source-paired draft a release row was built from, rebuilt from the row itself: a target equal
 * to its English is an English hold, anything else a draft. Bundling the isiXhosa pair files as well
 * would ship every slide's wording twice; tests/xh-deck-release.test.ts proves each rebuilt pair is
 * exactly its docs/narration file, so the live check still compares the actual pair statuses.
 */
export function pairFromRelease(row: CourseDeckRelease): ReleasePair {
  const field = (target: string, source: string) => target === source
    ? { status: 'english-hold' } : { status: 'draft', text: target };
  return {
    language: row.language, sourceLanguage: 'en', reviewStatus: row.reviewStatus,
    slides: row.slides.map(slide => ({
      n: slide.slide,
      english: { heading: slide.sourceHeading, body: [...slide.sourceEnglish] },
      target: { heading: field(slide.targetHeading, slide.sourceHeading),
        body: slide.targetText.map((text, i) => field(text, slide.sourceEnglish[i])) },
    })),
  };
}
const XH_PAIRS = new Map(XH_DECK_RELEASE_ROWS.map(row => [row.pairPath, pairFromRelease(row)]));
// isiXhosa cards are a separate registry, so a fault in one isiXhosa row withdraws only the
// isiXhosa cards (each falls back to its English slide) and never the Sesotho release.
const ISIXHOSA_BINDINGS = createCourseDeckReleaseBindings(
  XH_DECK_RELEASE_ROWS, XH_DECK_RELEASE_EXPECTED_COUNTS, path => XH_PAIRS.get(path),
);
export const CURRENT_DECK_RELEASE_BINDINGS: CourseDeckReleaseBindings = Object.freeze({
  has: (moduleId: string, language: string) => language === 'xh'
    ? ISIXHOSA_BINDINGS.has(moduleId, language) : SESOTHO_AND_EARLIER_BINDINGS.has(moduleId, language),
  resolve: (moduleId: string, language: string, sourceFor: DeckReleaseSource) => language === 'xh'
    ? ISIXHOSA_BINDINGS.resolve(moduleId, language, sourceFor) : SESOTHO_AND_EARLIER_BINDINGS.resolve(moduleId, language, sourceFor),
});
export function hasCurrentDeckRelease(moduleId: string, language: string): boolean {
  return CURRENT_DECK_RELEASE_BINDINGS.has(moduleId, language);
}
export function currentDeckRelease(moduleId: string, language: string, sourceFor: DeckReleaseSource) {
  return CURRENT_DECK_RELEASE_BINDINGS.resolve(moduleId, language, sourceFor);
}
