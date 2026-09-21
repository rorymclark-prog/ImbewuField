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
  "44": {
    byLang: { zu: { src: "Imbewu-Guilds-08-Succession-carry-mulch", poster: "Imbewu-Guilds-08-Succession-carry-mulch-zu", bytes: 8354154, seconds: 8.0 } },
    "src": "Imbewu-Guilds-08-Succession-carry-mulch",
    "poster": "Imbewu-Guilds-08-Succession-carry-mulch",
    "bytes": 8354154,
    "seconds": 8.0
  }
};

// English-labelled Water clips: two Mzomoyethu extracts and four concept diagrams.
// isiZulu slides and narration remain in review; the player discloses its English fallback.
const WATER_ANIMATIONS: Record<number, DeckAnimation> = {
  14: { src: 'flow-roof-rain', poster: 'flow-roof-rain', bytes: 3828056, seconds: 8 },
  4: { src: 'watch-04-swale-infiltration', poster: 'watch-04-swale-infiltration', bytes: 881320, aspectRatio: 824 / 720, seconds: 16 },
  7: { src: 'watch-07-swale-overflow-pond', poster: 'watch-07-swale-overflow-pond', bytes: 2712641, aspectRatio: 824 / 720, seconds: 13 },
  9: { src: 'watch-09-vetiver-contour', poster: 'watch-09-vetiver-contour', bytes: 176130, aspectRatio: 824 / 720, seconds: 16 },
  12: { src: 'watch-12-dam-spillway', poster: 'watch-12-dam-spillway', bytes: 185495, aspectRatio: 824 / 720, seconds: 16 },
  16: { src: 'watch-16-first-flush-tank', poster: 'watch-16-first-flush-tank', bytes: 85731, aspectRatio: 824 / 720, seconds: 17 },
  21: { src: 'watch-21-greywater-mulch', poster: 'watch-21-greywater-mulch', bytes: 146959, aspectRatio: 824 / 720, seconds: 17 },
};

// English concept diagrams follow the three authored Introduction Watch passages.
const INTRO_ANIMATIONS: Record<number, DeckAnimation> = {
  4: { src: 'flow-earth-care', poster: 'flow-earth-care', bytes: 5177501, seconds: 8 },
  7: { src: 'watch-07-three-ethics', poster: 'watch-07-three-ethics', bytes: 211949, seconds: 23.416667 },
  13: { src: 'watch-13-diversity', poster: 'watch-13-diversity', bytes: 586357, seconds: 26.625 },
  19: { src: 'watch-19-windbreak', poster: 'watch-19-windbreak', bytes: 284869, seconds: 23.708008 },
};

// Reading the Landscape keeps its four authored Watch scenes in teaching order.
const LANDSCAPE_ANIMATIONS: Record<number, DeckAnimation> = {
  6: { src: 'flow-a-frame', poster: 'flow-a-frame', bytes: 1808880, seconds: 6 },
  5: { src: 'watch-05-water-movement', poster: 'watch-05-water-movement', bytes: 542138, seconds: 14 },
  9: { src: 'watch-09-sun-shadows', poster: 'watch-09-sun-shadows', bytes: 192487, seconds: 14 },
  13: { src: 'watch-13-wind-cold-air', poster: 'watch-13-wind-cold-air', bytes: 373296, seconds: 14 },
  17: { src: 'watch-17-site-map', poster: 'watch-17-site-map', bytes: 116306, seconds: 14 },
};

// Each Soil Health Watch scene follows its existing narration.
const SOIL_ANIMATIONS: Record<number, DeckAnimation> = {
  11: { src: 'flow-compost-materials', poster: 'flow-compost-materials', bytes: 4290981, seconds: 8 },
  5: { src: 'tour-soil-observation', poster: 'tour-soil-observation', bytes: 4874969, seconds: 29.833333, aspectRatio: 1600 / 1100, narrationTimed: true },
  10: { src: 'watch-10-compost-heap', poster: 'watch-10-compost-heap', bytes: 119193, seconds: 14.0 },
  14: { src: 'watch-14-mulch-protection', poster: 'watch-14-mulch-protection', bytes: 369446, seconds: 14.0 },
};

// Practical motion shows the root plug and planting action without adding data on arrival.
const VEGETABLE_ANIMATIONS: Record<number, DeckAnimation> = {
  6: { src: 'flow-seed-or-seedling', poster: 'flow-seed-or-seedling', bytes: 5423616, seconds: 8 },
};

// Each Food Forest Watch scene follows its existing narration.
const FOREST_ANIMATIONS: Record<number, DeckAnimation> = {
  16: { src: 'flow-sheet-mulching', poster: 'flow-sheet-mulching', bytes: 7483690, seconds: 8 },
  5: { src: 'tour-seven-layers', poster: 'tour-seven-layers', bytes: 7425984, seconds: 30.375, aspectRatio: 1600 / 1100, narrationTimed: true },
  10: { src: 'watch-10-climate-match', poster: 'watch-10-climate-match', bytes: 168094, seconds: 14.625 },
  15: { src: 'tour-young-forest', poster: 'tour-young-forest', bytes: 6436310, seconds: 33.291667, aspectRatio: 1600 / 1100, narrationTimed: true },
};

// Each Small Livestock Watch scene follows its existing narration.
const LIVESTOCK_ANIMATIONS: Record<number, DeckAnimation> = {
  7: { src: 'flow-ducks-understorey', poster: 'flow-ducks-understorey', bytes: 7613902, seconds: 8 },
  4: { src: 'flow-hens-foraging', poster: 'flow-hens-foraging', bytes: 5064928, seconds: 8 },
  9: { src: 'watch-09-bee-pollination', poster: 'watch-09-bee-pollination', bytes: 116723, seconds: 14.0 },
  14: { src: 'watch-14-nutrient-loop', poster: 'watch-14-nutrient-loop', bytes: 161586, seconds: 14.0 },
};

// Each Market Gardening Watch scene follows its existing narration.
const MARKET_ANIMATIONS: Record<number, DeckAnimation> = {
  15: { src: 'flow-seed-sharing', poster: 'flow-seed-sharing', bytes: 3024675, seconds: 8 },
  4: { src: 'watch-04-farm-record', poster: 'watch-04-farm-record', bytes: 112750, seconds: 14 },
  9: { src: 'watch-09-surplus-routes', poster: 'watch-09-surplus-routes', bytes: 118388, seconds: 14 },
  14: { src: 'watch-14-community-network', poster: 'watch-14-community-network', bytes: 170639, seconds: 14 },
};

export const COURSE_DECKS: Record<string, ModuleDeck> = {
  'market-community': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('market-community', MARKET_ANIMATIONS),
  },
  'small-livestock': {
    slideLanguages: ['en'],
    slides: slidesFromNarration('small-livestock', LIVESTOCK_ANIMATIONS),
  },
  'food-forest': {
    slideLanguages: ['en'],
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
    slideLanguages: ['en'],
    slides: slidesFromNarration('reading-landscape', LANDSCAPE_ANIMATIONS),
  },
  'intro-permaculture': {
    slideLanguages: ['en'],
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

export function animationUrls(moduleId: string, slide: number, lang = 'en'): { video: string; poster: string; bytes: number; seconds: number; aspectRatio?: number; narrationTimed?: boolean } | null {
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
