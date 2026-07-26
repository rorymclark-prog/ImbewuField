// Course narration — pre-recorded audio for a module, per language.
//
// WHY THIS EXISTS: lib/tts.ts reads lessons aloud with the browser's SpeechSynthesis API and
// its own header is honest that this barely works for South African languages — most devices
// ship no isiZulu voice at all, so isiZulu text gets read out in an English voice or not at
// all. Pre-recorded narration side-steps the device entirely. Where a recording exists it is
// always better than SpeechSynthesis; where one doesn't, the old path still stands.
//
// The recordings are narrated from the facilitator deck, one clip per slide, so a module's
// audio is a short ordered playlist rather than one long file. That is deliberate: a learner
// on a metered rural connection downloads the two minutes they want, not fifteen.
//
// Adding a module: run `node scripts/import-course-audio.mjs <moduleId> <exportDir>`, then
// paste the block it prints below and fill in the titles and lesson ids.
//
// PURE MODULE — no react, no firebase, no fetch. Just the manifest and lookups over it.

export interface NarrationTrack {
  /** Slide number in the facilitator deck. Also the filename: slide-07.mp3. */
  slide: number;
  /** English title. */
  title: string;
  /** Per-language title, so a learner listening in isiZulu reads isiZulu track names. */
  titleByLang?: Record<string, string>;
  /** Lesson this slide belongs to, or null for module-level intro/recap. */
  lesson: string | null;
}

export interface ModuleNarration {
  /** Recorded languages, best first. Codes match lib/tts.ts LANG_TO_BCP47 keys. */
  languages: string[];
  tracks: NarrationTrack[];
  /**
   * Optional absolute origin for the files. Unset = served from this app's own /public.
   * Set it when a module's audio moves to Firebase Storage or a CDN — the whole point of
   * routing every URL through trackUrl() is that the move is a one-line data change and no
   * component needs touching.
   */
  baseUrl?: string;
}

/** Keyed by module id from lib/course-modules.ts. A module absent here simply has no
 *  recording yet — that is the normal state, not an error. */
export const COURSE_NARRATION: Record<string, ModuleNarration> = {
  'seeds-sovereignty': {
    languages: ['zu', 'en'],
    tracks: [
      { slide: 1,  lesson: null,                   title: 'Title',                            titleByLang: { zu: 'Isihloko' } },
      { slide: 2,  lesson: 'seeds-sovereignty-l1', title: 'Two Kinds of Seed',                titleByLang: { zu: 'Izinhlobo Ezimbili Zembewu' } },
      { slide: 3,  lesson: 'seeds-sovereignty-l1', title: 'Choosing Which Plant to Save From', titleByLang: { zu: 'Ukukhetha Isitshalo Esifanele Ukugcina Imbewu Kuso' } },
      { slide: 4,  lesson: 'seeds-sovereignty-l2', title: 'Two Ways to Save Seed',            titleByLang: { zu: 'Izindlela Ezimbili Zokugcina Imbewu' } },
      { slide: 5,  lesson: 'seeds-sovereignty-l2', title: 'The Tomato Fermentation Method',   titleByLang: { zu: 'Indlela Yamatamatisi Yekubilisa' } },
      { slide: 6,  lesson: 'seeds-sovereignty-l2', title: 'Keeping a Variety Pure',           titleByLang: { zu: 'Ukugcina Uhlobo Lwembewu Luhlanzekile' } },
      { slide: 7,  lesson: 'seeds-sovereignty-l3', title: 'The Three Enemies of Stored Seed', titleByLang: { zu: 'Izitha Ezintathu Zembewu Egcinwe Enqolobane' } },
      { slide: 8,  lesson: 'seeds-sovereignty-l3', title: 'Test It Before You Plant',         titleByLang: { zu: 'Yihlolisise Ngaphambi Kokuba Uyitshale' } },
      { slide: 9,  lesson: 'seeds-sovereignty-l3', title: 'Seed Swaps',                       titleByLang: { zu: 'Ukushintshisana Ngembewu' } },
      { slide: 10, lesson: null,                   title: 'Recap',                            titleByLang: { zu: 'Ukubuyekeza' } },
    ],
  },
};

export function narrationFor(moduleId: string): ModuleNarration | null {
  return COURSE_NARRATION[moduleId] ?? null;
}

export function hasNarration(moduleId: string): boolean {
  const n = COURSE_NARRATION[moduleId];
  return Boolean(n && n.languages.length > 0 && n.tracks.length > 0);
}

export interface ResolvedLang {
  lang: string;
  /** false = we are playing a different language from the one the app is set to. The UI must
   *  say so rather than quietly playing English at someone who chose isiZulu. */
  exact: boolean;
}

/** Pick the language to actually play: the app language if it was recorded, else English,
 *  else whatever exists. Null when the module has no recording at all. */
export function resolveNarrationLang(moduleId: string, appLang: string): ResolvedLang | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || n.languages.length === 0) return null;
  if (n.languages.includes(appLang)) return { lang: appLang, exact: true };
  if (n.languages.includes('en')) return { lang: 'en', exact: false };
  return { lang: n.languages[0], exact: false };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function base(n: ModuleNarration, moduleId: string, lang: string): string {
  const root = n.baseUrl ? n.baseUrl.replace(/\/+$/, '') : '/course-audio';
  return `${root}/${moduleId}/${lang}`;
}

/** URL for one slide clip, or null if the module or slide isn't in the manifest. */
export function trackUrl(moduleId: string, lang: string, slide: number): string | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || !n.languages.includes(lang)) return null;
  if (!n.tracks.some((t) => t.slide === slide)) return null;
  return `${base(n, moduleId, lang)}/slide-${pad2(slide)}.mp3`;
}

/** URL for the single continuous narration of the whole module. */
export function fullNarrationUrl(moduleId: string, lang: string): string | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || !n.languages.includes(lang)) return null;
  return `${base(n, moduleId, lang)}/full.mp3`;
}

/** Track title in the requested language, falling back to the English title. */
export function trackTitle(track: NarrationTrack, lang: string): string {
  return track.titleByLang?.[lang] ?? track.title;
}

/** Tracks belonging to one lesson, in deck order. Empty when the lesson has no audio. */
export function tracksForLesson(moduleId: string, lessonId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return n.tracks.filter((t) => t.lesson === lessonId).sort((a, b) => a.slide - b.slide);
}

/** Intro/recap tracks that belong to the module rather than any one lesson. */
export function moduleLevelTracks(moduleId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return n.tracks.filter((t) => t.lesson === null).sort((a, b) => a.slide - b.slide);
}

/** All tracks in deck order. */
export function allTracks(moduleId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return [...n.tracks].sort((a, b) => a.slide - b.slide);
}

/** Human duration for the audio controls, e.g. 92 -> "1:32". Guards NaN/Infinity, which is
 *  what an <audio> element reports before metadata has loaded. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}
