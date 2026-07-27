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
    // 24 slides, re-recorded 2026-07-28 to match the rewritten home-study scripts in
    // docs/narration/. The earlier 10-clip take was cut from a 10-slide deck written in
    // FACILITATOR voice — it addressed "the participants" and told the listener to pause the
    // animation so the group could discuss, on a module a farmer studies alone on a phone.
    // Voices: en-ZA-LeahNeural and zu-ZA-ThandoNeural at rate 0.88. Verified here rather than
    // trusted: each clip's duration divided by its script block's word count came out at
    // 2.00 w/s (sd 0.15) for English and 1.19 w/s (sd 0.07) for isiZulu. The isiZulu figure is
    // lower because the language is agglutinative — one word carries what English needs three
    // or four for — and the TIGHTNESS, not the rate, is what proves no clip was cut from the
    // wrong block.
    tracks: [
      { slide: 1,   lesson: null,                        title: 'Title',                                       titleByLang: { zu: 'Isihloko' } },
      { slide: 2,   lesson: 'seeds-sovereignty-l1',      title: 'Why Saving Seed Matters',                     titleByLang: { zu: 'Kungani Ukulondoloza Imbewu Kubalulekile' } },
      { slide: 3,   lesson: null,                        title: 'Learning Outcomes',                           titleByLang: { zu: 'Imiphumela Yokufunda' } },
      { slide: 4,   lesson: 'seeds-sovereignty-l1',      title: 'Open-Pollinated Seed and F1 Seed',            titleByLang: { zu: 'Imbewu Evulekele Impova Ne-F1' } },
      { slide: 5,   lesson: 'seeds-sovereignty-l1',      title: 'Watch: Open-Pollinated Seed and F1 Seed',     titleByLang: { zu: 'Buka: Imbewu Evulekele Impova Ne-F1' } },
      { slide: 6,   lesson: 'seeds-sovereignty-l1',      title: 'Seed Sovereignty',                            titleByLang: { zu: 'Ubukhosi Bembewu' } },
      { slide: 7,   lesson: 'seeds-sovereignty-l1',      title: 'Watch: Household Seed Network',               titleByLang: { zu: 'Buka: Inethiwekhi Yembewu Yasemakhaya' } },
      { slide: 8,   lesson: 'seeds-sovereignty-l1',      title: 'Select Several Parent Plants',                titleByLang: { zu: 'Khetha Izitshalo Zabazali Eziningana' } },
      { slide: 9,   lesson: 'seeds-sovereignty-l1',      title: 'Control Pollination',                         titleByLang: { zu: 'Lawula Impova' } },
      { slide: 10,  lesson: 'seeds-sovereignty-l1',      title: 'Watch: Self-Pollination and Crossing',        titleByLang: { zu: 'Buka: Ukuzithuthela Impova Nokuxubana' } },
      { slide: 11,  lesson: 'seeds-sovereignty-l2',      title: 'Dry and Wet Processing',                      titleByLang: { zu: 'Indlela Eyomile Nendlela Emanzi' } },
      { slide: 12,  lesson: 'seeds-sovereignty-l2',      title: 'Process Dry Seed',                            titleByLang: { zu: 'Lungisa Imbewu Eyomile' } },
      { slide: 13,  lesson: 'seeds-sovereignty-l2',      title: 'Watch: Dry Processing',                       titleByLang: { zu: 'Buka: Indlela Eyomile' } },
      { slide: 14,  lesson: 'seeds-sovereignty-l2',      title: 'Wet Processing for Tomato Seed',              titleByLang: { zu: 'Indlela Emanzi Katamatisi' } },
      { slide: 15,  lesson: 'seeds-sovereignty-l2',      title: 'Watch: Wet Processing for Tomato Seed',       titleByLang: { zu: 'Buka: Indlela Emanzi Katamatisi' } },
      { slide: 16,  lesson: 'seeds-sovereignty-l2',      title: 'Practical Activity',                          titleByLang: { zu: 'Umsebenzi Wokwenza' } },
      { slide: 17,  lesson: 'seeds-sovereignty-l3',      title: 'Dry First, Seal Later',                       titleByLang: { zu: 'Yomisa Kuqala, Vala Kamuva' } },
      { slide: 18,  lesson: 'seeds-sovereignty-l3',      title: 'Protect Seed from Heat, Light and Moisture',  titleByLang: { zu: 'Vikela Imbewu Ekushiseni, Ekukhanyeni Nakwumswakama' } },
      { slide: 19,  lesson: 'seeds-sovereignty-l3',      title: 'Label Every Packet',                          titleByLang: { zu: 'Bhala Imininingwane Ephaketheni' } },
      { slide: 20,  lesson: 'seeds-sovereignty-l3',      title: 'Ten-Seed Germination Test',                   titleByLang: { zu: 'Hlola Ukuhluma Kwembewu Eyishumi' } },
      { slide: 21,  lesson: 'seeds-sovereignty-l3',      title: 'Watch: Ten-Seed Germination Test',            titleByLang: { zu: 'Buka: Ukuhlolwa Kwembewu Eyishumi' } },
      { slide: 22,  lesson: 'seeds-sovereignty-l3',      title: 'Share Seed with Its Information',             titleByLang: { zu: 'Yabelana Ngembewu Kanye Nolwazi' } },
      { slide: 23,  lesson: null,                        title: 'Field Assignment',                            titleByLang: { zu: 'Umsebenzi Wasensimini' } },
      { slide: 24,  lesson: null,                        title: 'Field Action',                                titleByLang: { zu: 'Isenzo Sasensimini' } },
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
