import { createCourseDeckReleaseBindings, type DeckReleaseSource } from './course-deck-release-bindings';
import stSilentPair from '../docs/narration/intro-permaculture.st.silent-draft.json' with { type: 'json' };
import { COURSE_DECK_RELEASE_ROWS, COURSE_DECK_RELEASE_EXPECTED_COUNTS } from './course-deck-release-bindings-data';

// An invalid declared replacement stays active and unavailable; it cannot expose legacy media.
export const CURRENT_DECK_RELEASE_BINDINGS = createCourseDeckReleaseBindings(
  COURSE_DECK_RELEASE_ROWS, COURSE_DECK_RELEASE_EXPECTED_COUNTS,
  path => path === 'docs/narration/intro-permaculture.st.silent-draft.json' ? stSilentPair : undefined,
);
export function hasCurrentDeckRelease(moduleId: string, language: string): boolean {
  return CURRENT_DECK_RELEASE_BINDINGS.has(moduleId, language);
}
export function currentDeckRelease(moduleId: string, language: string, sourceFor: DeckReleaseSource) {
  return CURRENT_DECK_RELEASE_BINDINGS.resolve(moduleId, language, sourceFor);
}
