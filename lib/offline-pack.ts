// What one module costs to take home, and exactly which files that is.
//
// THE PROBLEM THIS SOLVES: a farmer in KZN goes to town once or twice a month. That trip is when
// data is affordable and signal is good. Everything else — every lesson, every slide, every clip —
// happens on a homestead where opening one 700 KB animation is a decision. Streaming a course to
// that person does not work, and no amount of caching-on-visit fixes it, because the visit itself
// is the expensive part.
//
// So the download is deliberate: the learner presses a button, in town, and the module is theirs.
//
// PURE MODULE — no browser APIs. The URL list and the byte total are computed here and tested
// without a browser; lib/offline-cache.ts does the actual fetching.

import { COURSE_MODULES } from '@/lib/course-modules';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_DECKS, slideImageUrl } from '@/lib/course-deck';
import { COURSE_ASSET_SIZES } from '@/lib/course-asset-sizes';

export interface PackEntry {
  url: string;
  bytes: number;
  kind: 'slide' | 'audio' | 'animation' | 'poster' | 'image';
}

export interface OfflinePack {
  moduleId: string;
  lang: string;
  entries: PackEntry[];
  bytes: number;
  /**
   * Files the manifests name but public/ does not have.
   *
   * NOT thrown, and not silently dropped. A missing file is a production problem — a farmer would
   * get a download that reports success with a hole in it — so it travels with the pack and the
   * test asserts it is empty. Dropping it quietly is how a broken module ships looking finished.
   */
  missing: string[];
}

/** Sizes come from the generated manifest; anything absent is a real gap, not a zero. */
function entry(url: string, kind: PackEntry['kind'], missing: string[]): PackEntry | null {
  const bytes = COURSE_ASSET_SIZES[url];
  if (bytes === undefined) {
    missing.push(url);
    return null;
  }
  return { url, bytes, kind };
}

/**
 * Everything needed to work through one module offline, in one language.
 *
 * ONE LANGUAGE, DELIBERATELY. A learner reads isiZulu or English, not both, and packing both
 * doubles the download to serve a person who does not exist. That is a bigger saving than any
 * quality setting — which is why this takes a lang and there is no "all languages" option.
 *
 * `full.mp3` is excluded on the same principle: it is the slide clips concatenated, so including
 * it would spend another 6–7 MB of a farmer's data on a second copy of audio they already have.
 */
export function offlinePack(moduleId: string, lang: string): OfflinePack {
  const missing: string[] = [];
  const entries: PackEntry[] = [];
  const push = (e: PackEntry | null) => { if (e) entries.push(e); };

  const deck = COURSE_DECKS[moduleId];
  if (deck) {
    for (const slide of deck.slides) {
      // Per slide, not per deck. isiZulu is missing exactly one of Seeds' 24 slides, and the
      // player falls back to English on that one alone — so the pack has to contain the English
      // file for it, or the module reads as complete offline and shows a gap on slide 13.
      const own = slideImageUrl(moduleId, lang, slide.slide);
      const url = own ?? slideImageUrl(moduleId, 'en', slide.slide);
      if (url) push(entry(url, 'slide', missing));

      if (slide.animation) {
        push(entry(`/course-animations/${moduleId}/${slide.animation.src}.mp4`, 'animation', missing));
        push(entry(`/course-animations/${moduleId}/posters/${slide.animation.poster}.jpg`, 'poster', missing));
      }
    }
  }

  const narration = COURSE_NARRATION[moduleId];
  if (narration?.languages.includes(lang)) {
    for (const track of narration.tracks) {
      push(entry(`/course-audio/${moduleId}/${lang}/slide-${String(track.slide).padStart(2, '0')}.mp3`, 'audio', missing));
    }
  }

  for (const lesson of COURSE_MODULES.find((m) => m.id === moduleId)?.lessons ?? []) {
    if (lesson.infographicUrl) push(entry(lesson.infographicUrl, 'image', missing));
  }

  // A slide can be reached twice — its own file plus an English fallback pointing at the same
  // path — and an animation shared between modules would be fetched once per module.
  const seen = new Set<string>();
  const unique = entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));

  return {
    moduleId,
    lang,
    entries: unique,
    bytes: unique.reduce((sum, e) => sum + e.bytes, 0),
    missing,
  };
}

/** Every module that has anything to download, with its size in this language. */
export function downloadableModules(lang: string): Array<{ moduleId: string; bytes: number; count: number }> {
  return COURSE_MODULES
    .map((m) => {
      const pack = offlinePack(m.id, lang);
      return { moduleId: m.id, bytes: pack.bytes, count: pack.entries.length };
    })
    .filter((p) => p.count > 0);
}

/** The whole course in one language — what "download everything" actually costs. */
export function wholeCourseBytes(lang: string): number {
  return downloadableModules(lang).reduce((sum, m) => sum + m.bytes, 0);
}

/**
 * "12.4 MB" / "1.2 GB".
 *
 * Deliberately not the same helper as course-deck's formatBytes, which stops at MB because a
 * single clip never reaches a gigabyte. A whole-course download can, and "1043.7 MB" is a number
 * nobody can weigh against a data bundle sold in gigabytes.
 */
export function formatPackSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
