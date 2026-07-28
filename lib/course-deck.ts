// A module's slide deck — the form the course was actually authored in.
//
// WHY THIS EXISTS: Seeds was written as 24 slides, in a deliberate teaching order, with six of
// them built as near-empty frames because an animation carries the idea better than a still. The
// app only had lesson pages, so all of that collapsed into three long lessons and the animations
// had nowhere to live at all. A farmer got the words and lost the sequence.
//
// The deck does not replace the lesson pages. Someone who wants to read still reads; someone who
// wants to be taught presses play. Both come from the same authored content.
//
// PURE MODULE — no react, no firebase, no fetch. Just the manifest and lookups over it, so the
// player can be tested without a browser.

import { COURSE_NARRATION, trackUrl, type NarrationTrack } from '@/lib/course-audio';

export interface DeckAnimation {
  /** Wordless clip, audio stripped — narration plays over it. */
  src: string;
  /**
   * A still from the clip, shown until the farmer asks for it.
   *
   * NOTHING AUTOPLAYS AND NOTHING PRELOADS. lib/course-modules.ts already states the rule for this
   * audience — video is never given an inline player because KZN connectivity cannot stream it per
   * visit — and these clips are 0.6–2.6 MB against lesson stills of 60–140 KB. A poster is ~50 KB,
   * so the page costs what a picture costs, and the farmer decides whether the clip is worth the
   * rest. The size is shown on the button; guessing with someone else's data is not ours to do.
   */
  poster: string;
  /** Bytes, shown on the play button so the choice is an informed one. */
  bytes: number;
  seconds: number;
}

export interface DeckSlide {
  slide: number;
  /** English title. The narration manifest carries the isiZulu one. */
  title: string;
  lesson: string | null;
  animation?: DeckAnimation;
}

export interface ModuleDeck {
  /** Languages with their OWN rendered slides. Others fall back — see resolveDeckLang. */
  slideLanguages: string[];
  /**
   * Slides a language is missing, by slide number.
   *
   * A whole-deck fallback would be a lie here. The isiZulu deck has 23 of the 24 slides — every
   * one of them correct — and showing English for all 24 because ONE is absent would take a
   * finished isiZulu lesson away from the person it was made for.
   */
  missingSlides?: Record<string, number[]>;
  slides: DeckSlide[];
}

const SEEDS_ANIMATIONS: Record<number, DeckAnimation> = {
  // Verified by content rather than filename order: each clip was sampled mid-way and matched to
  // the slide it teaches. Assuming video_01..06 mapped to the animation slides in order would have
  // been right here, but a wrong animation under a farming instruction is not a cosmetic error.
  //
  // `bytes` is the EXACT size of the file on disk, and tests/course-deck.test.ts stats each one and
  // fails on any difference. These were hand-rounded before, which meant re-encoding the clips
  // turned every play button into a wrong promise about somebody's data allowance — the one number
  // on this screen a farmer is asked to trust.
  5:  { src: 'imbewu_isiZulu_video_01', poster: 'imbewu_isiZulu_video_01', bytes: 420_204,   seconds: 10 }, // uniform vs varied seedlings
  7:  { src: 'imbewu_isiZulu_video_02', poster: 'imbewu_isiZulu_video_02', bytes: 738_328,   seconds: 10 }, // households exchanging packets
  8:  { src: 'new_seed-selection-and-drying', poster: 'new_seed-selection-and-drying', bytes: 530_021, seconds: 10 },
  10: { src: 'imbewu_isiZulu_video_03', poster: 'imbewu_isiZulu_video_03', bytes: 399_404,   seconds: 10 }, // maize tassels, crossing
  13: { src: 'imbewu_isiZulu_video_04', poster: 'imbewu_isiZulu_video_04', bytes: 736_559,   seconds: 10 }, // cleaning seed on a plate
  15: { src: 'imbewu_isiZulu_video_05', poster: 'imbewu_isiZulu_video_05', bytes: 1_377_407, seconds: 20 }, // tomato in a jar — the long one
  18: { src: 'new_seed-storage-jar-vs-bag', poster: 'new_seed-storage-jar-vs-bag', bytes: 474_949, seconds: 10 },
  21: { src: 'imbewu_isiZulu_video_06', poster: 'imbewu_isiZulu_video_06', bytes: 439_958,   seconds: 10 }, // germination test on cloth
};

/**
 * Slides are derived from the narration manifest rather than typed out again.
 *
 * lib/course-audio.ts already holds the slide numbers, titles, isiZulu titles and lesson mapping,
 * and it is the file the recording is checked against. A second hand-maintained list of the same
 * 24 rows is this codebase's most repeated bug — two places answering one question and drifting —
 * and here the drift would be a slide showing one thing while its narration says another.
 */
function slidesFromNarration(moduleId: string, animations: Record<number, DeckAnimation>): DeckSlide[] {
  const narration = COURSE_NARRATION[moduleId];
  if (!narration) return [];
  return narration.tracks.map((t: NarrationTrack) => ({
    slide: t.slide,
    title: t.title,
    lesson: t.lesson,
    ...(animations[t.slide] ? { animation: animations[t.slide] } : {}),
  }));
}

export const COURSE_DECKS: Record<string, ModuleDeck> = {
  'seeds-sovereignty': {
    slideLanguages: ['en', 'zu'],
    // ALL 24 SLIDES NOW EXIST IN BOTH LANGUAGES. The history is kept because the failure was
    // invisible and the next deck can fail the same way.
    //
    // PowerPoint opened the isiZulu deck as "Repaired" and reported 23 slides where the file
    // contains 24 slide parts — the repair dropped one. Aligning the export against the English
    // titles identified it exactly: slide 13, "Buka: Indlela Eyomile". Everything after it was
    // therefore shifted by one, and the pages were renumbered on import to their TRUE slide
    // numbers. Wiring the 23 pages in order would instead have put the wrong narration under
    // eleven consecutive slides — a farmer hearing the tomato wet method while looking at dry seed
    // cleaning, with nothing visibly broken to warn anyone.
    //
    // The missing slide was rebuilt from the standalone isiZulu PowerPoint Rory supplied: its
    // eyebrow, title and caption are that file's own text, composited onto the English slide's
    // artwork, with the type geometry solved against zu/slide-05 and zu/slide-07 so it sits
    // unnoticed among its neighbours. No isiZulu was written or translated by the app.
    //
    // `missingSlides` stays in the type on purpose — resolveDeckLang and slideImageFor still
    // implement per-slide fallback, and the next module's deck will very likely need it.
    slides: slidesFromNarration('seeds-sovereignty', SEEDS_ANIMATIONS),
  },
};

export function deckFor(moduleId: string): ModuleDeck | null {
  return COURSE_DECKS[moduleId] ?? null;
}

export function hasDeck(moduleId: string): boolean {
  const d = COURSE_DECKS[moduleId];
  return Boolean(d && d.slides.length > 0);
}

/**
 * Which language's slides to show, and whether it is the one asked for.
 *
 * Mirrors resolveNarrationLang deliberately: `exact: false` exists so the UI can TELL the learner
 * it is showing English, instead of quietly serving a language they may not read. A farmer who
 * cannot read the slide should know that is the app's gap, not their own.
 */
export function resolveDeckLang(moduleId: string, want: string): { lang: string; exact: boolean } | null {
  const deck = COURSE_DECKS[moduleId];
  if (!deck || deck.slides.length === 0) return null;
  if (deck.slideLanguages.includes(want)) return { lang: want, exact: true };
  if (deck.slideLanguages.includes('en')) return { lang: 'en', exact: false };
  return null;
}

export function slideImageUrl(moduleId: string, lang: string, slide: number): string | null {
  const deck = COURSE_DECKS[moduleId];
  if (!deck || !deck.slideLanguages.includes(lang)) return null;
  if (!deck.slides.some((s) => s.slide === slide)) return null;
  if (deck.missingSlides?.[lang]?.includes(slide)) return null;
  return `/course-decks/${moduleId}/${lang}/slide-${String(slide).padStart(2, '0')}.jpg`;
}

/**
 * The image to show for one slide, and whether it is in the language asked for.
 *
 * PER SLIDE, not per deck. isiZulu has 23 of 24 slides; falling the whole module back to English
 * because one is missing would take a finished isiZulu lesson away from the person it was made
 * for. This way exactly one slide shows English, and `exact: false` is returned only on that
 * slide, so the UI's explanation appears where it is true and nowhere else.
 */
export function slideImageFor(
  moduleId: string,
  lang: string,
  slide: number,
): { url: string; lang: string; exact: boolean } | null {
  const own = slideImageUrl(moduleId, lang, slide);
  if (own) return { url: own, lang, exact: true };
  const fallback = lang === 'en' ? null : slideImageUrl(moduleId, 'en', slide);
  return fallback ? { url: fallback, lang: 'en', exact: false } : null;
}

export function animationUrls(moduleId: string, slide: number): { video: string; poster: string; bytes: number; seconds: number } | null {
  const a = COURSE_DECKS[moduleId]?.slides.find((s) => s.slide === slide)?.animation;
  if (!a) return null;
  return {
    video: `/course-animations/${moduleId}/${a.src}.mp4`,
    poster: `/course-animations/${moduleId}/posters/${a.poster}.jpg`,
    bytes: a.bytes,
    seconds: a.seconds,
  };
}

/** Narration for a slide, in the learner's language where it exists. */
export function slideAudioUrl(moduleId: string, lang: string, slide: number): string | null {
  return trackUrl(moduleId, lang, slide);
}

/** "2.2 MB" — shown on the play button. Farmers on metered data decide with the number in front of them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Total cost of watching every clip in a module — so "play all" is never a surprise. */
export function deckAnimationBytes(moduleId: string): number {
  return (COURSE_DECKS[moduleId]?.slides ?? []).reduce((sum, s) => sum + (s.animation?.bytes ?? 0), 0);
}

/** How many slides a given lesson owns — shown on the "Watch and listen" button so the learner
 *  knows the size of what they are opening before they open it. */
export function deckSlideCount(moduleId: string, lessonId?: string): number {
  const slides = COURSE_DECKS[moduleId]?.slides ?? [];
  return lessonId ? slides.filter((s) => s.lesson === lessonId).length : slides.length;
}
