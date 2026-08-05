// How finished is a module, really?
//
// WHY THIS EXISTS: Rory wants to show the app to people before the course is finished. Right now
// one module — Seeds — is genuinely complete: illustrated, narrated in both languages, with its
// slide deck and animations. The other nine are lesson text and pictures only. A viewer clicking
// around cannot tell those apart, so either the whole course looks half-built or the finished
// module gets mistaken for the standard and the rest look broken.
//
// It is also locked behind five modules he has to complete first, so he cannot reach the one thing
// he actually wants to show.
//
// DERIVED, NEVER DECLARED. There is no `ready: true` field to set, because a hand-maintained flag
// is a promise someone forgets to withdraw — and the promise here is "this is finished", made to
// somebody being shown the product. Readiness is computed from what is genuinely on disk: a deck,
// narration in both languages, and a picture for every lesson. Delete the audio and the badge
// disappears by itself.

import { COURSE_MODULES } from '@/lib/course-modules';
import { hasNarration, narrationFor } from '@/lib/course-audio';
import { hasDeck } from '@/lib/course-deck';

export type ModuleReadiness = 'complete' | 'in-progress';

export interface ReadinessDetail {
  readiness: ModuleReadiness;
  hasDeck: boolean;
  /** Languages the narration is recorded in — [] when there is none. */
  narrationLanguages: string[];
  illustratedLessons: number;
  totalLessons: number;
}

/**
 * A module counts as COMPLETE when a learner could work through it exactly as intended:
 * every lesson illustrated, the narration recorded, and the slide deck built.
 *
 * Narration must cover MORE THAN ONE language. The audience is isiZulu-first, and a module
 * narrated only in English is not finished for the person it was written for — calling it
 * complete would be a comfortable lie told in the direction of the people with the least say.
 */
export function moduleReadinessDetail(moduleId: string): ReadinessDetail {
  const mod = COURSE_MODULES.find((m) => m.id === moduleId);
  const totalLessons = mod?.lessons.length ?? 0;
  const illustratedLessons = mod?.lessons.filter((l) => l.infographicUrl && l.infographicAlt).length ?? 0;
  const narrationLanguages = hasNarration(moduleId) ? (narrationFor(moduleId)?.languages ?? []) : [];
  const deck = hasDeck(moduleId);

  const complete =
    totalLessons > 0 &&
    illustratedLessons === totalLessons &&
    narrationLanguages.length >= 2 &&
    deck;

  return {
    readiness: complete ? 'complete' : 'in-progress',
    hasDeck: deck,
    narrationLanguages,
    illustratedLessons,
    totalLessons,
  };
}

export function moduleReadiness(moduleId: string): ModuleReadiness {
  return moduleReadinessDetail(moduleId).readiness;
}

export function isModuleComplete_Content(moduleId: string): boolean {
  return moduleReadiness(moduleId) === 'complete';
}

/** Every module that is genuinely finished, in curriculum order. */
export function completeModuleIds(): string[] {
  return COURSE_MODULES.map((m) => m.id).filter(isModuleComplete_Content);
}

/**
 * What to show on the module card.
 *
 * The in-progress wording deliberately says what IS there rather than what is missing. Every one
 * of these modules has real, reviewed lesson content a farmer can use today; they are missing the
 * narration and slides, not the teaching. "Coming soon" would be false — the lessons are already
 * there to read.
 */
export function readinessLabel(moduleId: string): { text: string; detail: string } | null {
  const d = moduleReadinessDetail(moduleId);
  if (d.readiness === 'complete') {
    return {
      text: 'Fully built',
      detail: `All ${d.totalLessons} lessons illustrated, narrated in ${d.narrationLanguages.length} languages, with slides and animations.`,
    };
  }
  // DERIVED, like everything else in this file. The constant that used to sit here went stale the
  // moment a module gained anything.
  //
  // It read "Reading and pictures are ready. Narration and slides are still being made." That was
  // true of all nine in-progress modules the day it was written. It stopped being true on
  // 2026-08-03 when nine of them gained English narration, and it became flatly wrong for the first
  // module to get a generated deck: the card announced that the slides were still being made while
  // the learner was one tap away from watching them. A label attached to a module has to read the
  // module.
  const has = ['Reading and pictures are ready'];
  if (d.narrationLanguages.length > 0) has.push(`narration is recorded in ${languageList(d.narrationLanguages)}`);
  if (d.hasDeck) has.push('the slide deck is built');

  const toCome: string[] = [];
  if (!d.hasDeck) toCome.push('slides');
  // isiZulu specifically, not "a second language". moduleReadinessDetail sets two languages as the
  // bar for the reason stated there — this audience is isiZulu-first — and English-only narration
  // is progress, not arrival.
  if (!d.narrationLanguages.includes('zu')) toCome.push('isiZulu narration');
  if (d.illustratedLessons < d.totalLessons) toCome.push('lesson pictures');

  return {
    text: d.hasDeck ? 'Lessons and slides' : 'Lessons only',
    detail: `${has.join(', ')}.${toCome.length ? ` Still to come: ${toCome.join(', ')}.` : ''}`,
  };
}

/** "English", or "English and isiZulu". Only the two languages the course is produced in are
 *  named; anything else shows as its code rather than as a guess at what it is called. */
function languageList(codes: string[]): string {
  const names = codes.map((c) => ({ en: 'English', zu: 'isiZulu' }[c] ?? c));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}
