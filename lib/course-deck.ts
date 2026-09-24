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
  /** Silent clip — narration plays over it. Some clips contain labels in the deck language. */
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
  /** Preserve a teaching diagram's full frame without shrinking it into a widescreen box. */
  aspectRatio?: number;
  /** Authored against this slide's narration word timings; follow its playhead. */
  narrationTimed?: boolean;
  /** Let a self-contained teaching sequence hold its final state after a manual Watch. */
  playOnce?: boolean;
  /** Exact text-labelled variants; wordless clips share their base asset. */
  byLang?: Record<string, Omit<DeckAnimation, 'byLang'>>;
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
   * A whole-deck fallback would be a lie here. If one localized asset is absent, only that slide
   * should fall back to English; showing English for every slide would take a finished lesson
   * away from the person it was made for.
   */
  missingSlides?: Record<string, number[]>;
  slides: DeckSlide[];
}

const SEEDS_ANIMATIONS: Record<number, DeckAnimation> = {
  // Matched to slides by watching the clips, not by reading their filenames.
  //
  // SAMPLING ONE MID-CLIP FRAME IS NOT ENOUGH, and this is the proof. Slide 13 teaches the DRY
  // method — mature, collect, clean, dry — and carried `imbewu_isiZulu_video_04` because its
  // middle frame shows seed being pressed on a plate, which reads exactly like dry processing.
  // Watched end to end, that clip opens on tomato pulp going into a sieve: it is the WET method,
  // and a shorter duplicate of the back half of slide 15's clip. A farmer following slide 13 was
  // being shown one method while the voice taught another. (Rory: "you forgot to put part a into
  // this animation ... its here a few slides forward".)
  //
  // Meanwhile slide 8's clip ran ten seconds and taught two different lessons: selection in the
  // field, then threshing, winnowing and drying. It is now cut at 5.2s, where the farmer stops
  // choosing plants and starts processing seed, so slide 8 gets the selection and slide 13 gets
  // the dry process its narration actually describes. Both cuts come from the high-res original.
  //
  // `bytes` is the EXACT size of the file on disk, and tests/course-deck.test.ts stats each one and
  // fails on any difference. These were hand-rounded before, which meant re-encoding the clips
  // turned every play button into a wrong promise about somebody's data allowance — the one number
  // on this screen a farmer is asked to trust.
  5:  { src: 'imbewu_isiZulu_video_01', poster: 'imbewu_isiZulu_video_01', bytes: 420_204,   seconds: 10 }, // uniform vs varied seedlings
  7:  { src: 'imbewu_isiZulu_video_02', poster: 'imbewu_isiZulu_video_02', bytes: 738_328,   seconds: 10 }, // households exchanging packets
  8:  { src: 'seed-selecting-parents', poster: 'seed-selecting-parents', bytes: 248_394, seconds: 5 }, // walking the rows, choosing, harvesting
  10: { src: 'imbewu_isiZulu_video_03', poster: 'imbewu_isiZulu_video_03', bytes: 399_404,   seconds: 10 }, // maize tassels, crossing
  13: { src: 'seed-dry-processing', poster: 'seed-dry-processing', bytes: 311_237,   seconds: 5 }, // threshing, winnowing, drying on the mat
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

// Approved guild clips each occupy one teaching slot; whole-plant thinning is slide 43.
const GUILD_ANIMATIONS: Record<number, DeckAnimation> = {
  "15": {
    byLang: { zu: { src: "Imbewu-Guilds-03-Pigeon-pea-food", poster: "Imbewu-Guilds-03-Pigeon-pea-food-zu", bytes: 7277042, seconds: 8.0 } },
    "src": "Imbewu-Guilds-03-Pigeon-pea-food",
    "poster": "Imbewu-Guilds-03-Pigeon-pea-food",
    "bytes": 7277042,
    "seconds": 8.0
  },
  "23": {
    byLang: { zu: { src: "Imbewu-Guilds-09-Labelled-zu", poster: "Imbewu-Guilds-09-Labelled-zu", bytes: 3639293, seconds: 8 } },
    "src": "Imbewu-Guilds-09-Labelled",
    "poster": "Imbewu-Guilds-09-Labelled",
    "bytes": 4174276,
    "seconds": 8.0
  },
  "27": {
    byLang: { zu: { src: "Imbewu-Guilds-02-Pruning-trimmed", poster: "Imbewu-Guilds-02-Pruning-trimmed-zu", bytes: 3373640, seconds: 5.0 } },
    "src": "Imbewu-Guilds-02-Pruning-trimmed",
    "poster": "Imbewu-Guilds-02-Pruning-trimmed",
    "bytes": 3373640,
    "seconds": 5.0
  },
  "29": {
    byLang: { zu: { src: "Imbewu-Guilds-01-Mulch-ring", poster: "Imbewu-Guilds-01-Mulch-ring-zu", bytes: 3173759, seconds: 8.0 } },
    "src": "Imbewu-Guilds-01-Mulch-ring",
    "poster": "Imbewu-Guilds-01-Mulch-ring",
    "bytes": 3173759,
    "seconds": 8.0
  },
  "33": {
    byLang: { zu: { src: "Imbewu-Guilds-04-Helpful-insects", poster: "Imbewu-Guilds-04-Helpful-insects-zu", bytes: 3933234, seconds: 5.5 } },
    "src": "Imbewu-Guilds-04-Helpful-insects",
    "poster": "Imbewu-Guilds-04-Helpful-insects",
    "bytes": 3933234,
    "seconds": 5.5
  },
  "37": {
    byLang: { zu: { src: "Imbewu-Guilds-05-Guild-overview", poster: "Imbewu-Guilds-05-Guild-overview-zu", bytes: 9200096, seconds: 8.0 } },
    "src": "Imbewu-Guilds-05-Guild-overview",
    "poster": "Imbewu-Guilds-05-Guild-overview",
    "bytes": 9200096,
    "seconds": 8.0
  },
  "41": {
    byLang: { zu: { src: "Imbewu-Guilds-06-Succession-establish", poster: "Imbewu-Guilds-06-Succession-establish-zu", bytes: 3900208, seconds: 8.0 } },
    "src": "Imbewu-Guilds-06-Succession-establish",
    "poster": "Imbewu-Guilds-06-Succession-establish",
    "bytes": 3900208,
    "seconds": 8.0
  },
  "45": {
    byLang: { zu: { src: "Imbewu-Guilds-08-Succession-carry-mulch", poster: "Imbewu-Guilds-08-Succession-carry-mulch-zu", bytes: 8354154, seconds: 8.0 } },
    "src": "Imbewu-Guilds-08-Succession-carry-mulch",
    "poster": "Imbewu-Guilds-08-Succession-carry-mulch",
    "bytes": 8354154,
    "seconds": 8.0
  }
};

// Keep only the source footage and Flow result. Rory has not cleared the locally drawn concept
// animations, so their lesson stills carry those teaching steps until reviewed replacements exist.
const WATER_ANIMATIONS: Record<number, DeckAnimation> = {
  // The swale and overflow extracts on slides 4/7 imply site outcomes that their lesson cannot
  // establish. Keep their stills until the teaching and visual review are resolved together.
  14: { src: 'flow-roof-rain', poster: 'flow-roof-rain', bytes: 3828056, seconds: 8 },
};

// The three locally drawn Introduction clips await Rory's visual clearance.
const INTRO_ANIMATIONS: Record<number, DeckAnimation> = {
  4: { src: 'flow-earth-care', poster: 'flow-earth-care', bytes: 5177501, seconds: 8 },
};

// Locally drawn Reading the Landscape scenes stay out of the player pending visual clearance.
const LANDSCAPE_ANIMATIONS: Record<number, DeckAnimation> = {
  6: { src: 'flow-a-frame', poster: 'flow-a-frame', bytes: 1808880, seconds: 6 },
};

// Keep the reviewed Flow compost actions; the remaining locally authored soil clips await review.
const SOIL_ANIMATIONS: Record<number, DeckAnimation> = {
  // The farmer visibly places dry leaves and straw over fresh green trimmings, then spreads them.
  // Moisture, decomposition and finished compost remain in the narration and later slides.
  10: { src: 'flow-build-compost-heap', poster: 'flow-build-compost-heap', bytes: 7619537, seconds: 8, playOnce: true },
  11: { src: 'flow-compost-materials', poster: 'flow-compost-materials', bytes: 4290981, seconds: 8 },
};

// Slide 6 keeps the direct-sowing-versus-transplanting still as its poster. The reviewed Flow
// footage completes only the transplant action; the choice between methods stays in the
// narration and still. The locally drawn diagrams remain held for Rory's visual clearance.
const VEGETABLE_ANIMATIONS: Record<number, DeckAnimation> = {
  6: { src: 'flow-transplant-root-plug', poster: 'flow-transplant-root-plug', bytes: 6707780, seconds: 8, playOnce: true },
};

// Keep the reviewed Flow hand action; the three locally authored scenes await visual clearance.
const FOREST_ANIMATIONS: Record<number, DeckAnimation> = {
  // The close-up visibly moves mulch onto cardboard and holds the final layer order. The earlier
  // wide Flow film stopped before this action, and the authored composite awaits Rory's review.
  16: { src: 'flow-sheet-mulching-closeup', poster: 'flow-sheet-mulching-closeup', bytes: 6248424, seconds: 8, playOnce: true },
};

// Keep the real footage and Flow results. The bee close-up shows one continuous move between two
// blossoms; the lesson still retains the wider hive-to-crops context. The nutrient diagram waits.
const LIVESTOCK_ANIMATIONS: Record<number, DeckAnimation> = {
  7: { src: 'flow-ducks-understorey', poster: 'flow-ducks-understorey', bytes: 7613902, seconds: 8 },
  4: { src: 'hens-pecking-pexels-5563939', poster: 'hens-pecking-pexels-5563939', bytes: 5058477, seconds: 8 },
  9: { src: 'flow-bee-between-blossoms', poster: 'flow-bee-between-blossoms', bytes: 2126645, seconds: 8, playOnce: true },
};

// Keep the Flow seed-sharing film; locally drawn market diagrams await visual clearance.
const MARKET_ANIMATIONS: Record<number, DeckAnimation> = {
  15: { src: 'flow-seed-sharing', poster: 'flow-seed-sharing', bytes: 3024675, seconds: 8 },
};

export const COURSE_DECKS: Record<string, ModuleDeck> = {
  'market-community': {
    slideLanguages: ['en', 'zu'],
    slides: slidesFromNarration('market-community', MARKET_ANIMATIONS),
  },
  'small-livestock': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('small-livestock', LIVESTOCK_ANIMATIONS),
  },
  'food-forest': {
    slideLanguages: ['en', 'zu'],
    slides: slidesFromNarration('food-forest', FOREST_ANIMATIONS),
  },
  'vegetables-staples': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('vegetables-staples', VEGETABLE_ANIMATIONS),
  },
  'soil-health': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('soil-health', SOIL_ANIMATIONS),
  },
  'reading-landscape': {
    slideLanguages: ['en', 'zu'],
    slides: slidesFromNarration('reading-landscape', LANDSCAPE_ANIMATIONS),
  },
  'intro-permaculture': {
    slideLanguages: ['en', 'zu'],
    slides: slidesFromNarration('intro-permaculture', INTRO_ANIMATIONS),
  },
  'water-harvesting': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('water-harvesting', WATER_ANIMATIONS),
  },
  'plant-guilds': {
    slideLanguages: ['en', 'zu'],
    slides: slidesFromNarration('plant-guilds', GUILD_ANIMATIONS),
  },
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
 * PER SLIDE, not per deck. Falling the whole module back to English because one localized asset
 * is missing would take a finished lesson away from the person it was made for. `exact: false` is
 * returned only on the fallback slide, so the UI's explanation appears where it is true.
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

export function animationUrls(moduleId: string, slide: number, lang = 'en'): { video: string; poster: string; bytes: number; seconds: number; aspectRatio?: number; narrationTimed?: boolean; playOnce?: boolean } | null {
  const base = COURSE_DECKS[moduleId]?.slides.find((s) => s.slide === slide)?.animation;
  if (!base) return null;
  const a = base.byLang?.[lang] ?? base;
  return {
    video: `/course-animations/${moduleId}/${a.src}.mp4`,
    poster: `/course-animations/${moduleId}/posters/${a.poster}.jpg`,
    bytes: a.bytes,
    seconds: a.seconds,
    ...(a.aspectRatio ? { aspectRatio: a.aspectRatio } : {}),
    ...(a.narrationTimed ? { narrationTimed: true } : {}),
    ...(a.playOnce ? { playOnce: true } : {}),
  };
}

/** Late video loading must not show an earlier feature than the learner hears.
 * Only word-timed tours opt in; independent demonstration clips keep their own timing.
 * After speech ends, let the final visual hold finish so play-through can advance.
 */
export function timedAnimationSync(
  audio: { currentTime: number; paused: boolean; ended: boolean },
  video: { currentTime: number; duration: number; readyState: number; ended: boolean },
): { seekTo: number | null; playing: boolean } | null {
  if (video.readyState < 2 || !Number.isFinite(video.duration) || video.duration <= 0) return null;
  if (audio.ended) return { seekTo: null, playing: !video.ended };
  const time = Math.max(0, Math.min(audio.currentTime, video.duration));
  return { seekTo: Math.abs(video.currentTime - time) > .25 ? time : null, playing: !audio.paused && time < video.duration };
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
