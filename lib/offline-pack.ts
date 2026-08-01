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
  quality: PackQuality;
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

/**
 * Which set of files a download pulls.
 *
 * 'standard' is what a farmer on metered KZN data gets, and remains the default everywhere.
 * 'high' is for facilitators, funders and anyone training from a laptop on wifi — the same
 * lesson, at the quality the assets were made at, at roughly double the size.
 */
export type PackQuality = 'standard' | 'high';

/**
 * The high-quality twin of an asset, where one exists.
 *
 * Higher-quality files live in a `hi/` folder beside their standard versions, so the two are
 * always found by the same path with one segment inserted. NOT EVERY ASSET HAS ONE and that is
 * deliberate rather than an oversight: the narration is 24 kbps mono because that is how it was
 * recorded, the English slides were only ever rendered at 960px, and the rebuilt isiZulu slide 13
 * was composited from a 960px source. Upscaling any of those would grow the download without
 * adding a single pixel of real detail. Anything with no twin silently falls back to standard, so
 * a "high quality" download is honestly the best that exists — never padding.
 */
function hiVariant(url: string): string | null {
  const cut = url.lastIndexOf('/');
  if (cut < 0) return null;
  const hi = `${url.slice(0, cut)}/hi${url.slice(cut)}`;
  return COURSE_ASSET_SIZES[hi] === undefined ? null : hi;
}

/** Sizes come from the generated manifest; anything absent is a real gap, not a zero. */
function entry(url: string, kind: PackEntry['kind'], missing: string[], quality: PackQuality = 'standard'): PackEntry | null {
  const chosen = quality === 'high' ? (hiVariant(url) ?? url) : url;
  const bytes = COURSE_ASSET_SIZES[chosen];
  if (bytes === undefined) {
    missing.push(chosen);
    return null;
  }
  return { url: chosen, bytes, kind };
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
export function offlinePack(moduleId: string, lang: string, quality: PackQuality = 'standard'): OfflinePack {
  const missing: string[] = [];
  const entries: PackEntry[] = [];
  const push = (e: PackEntry | null) => { if (e) entries.push(e); };
  const at = (url: string, kind: PackEntry['kind']) => entry(url, kind, missing, quality);

  const deck = COURSE_DECKS[moduleId];
  if (deck) {
    for (const slide of deck.slides) {
      // Per slide, not per deck. The player falls back to English when a localized image is
      // absent, so the pack must include that fallback too or the module has a gap offline.
      const own = slideImageUrl(moduleId, lang, slide.slide);
      const url = own ?? slideImageUrl(moduleId, 'en', slide.slide);
      if (url) push(at(url, 'slide'));

      if (slide.animation) {
        push(at(`/course-animations/${moduleId}/${slide.animation.src}.mp4`, 'animation'));
        push(at(`/course-animations/${moduleId}/posters/${slide.animation.poster}.jpg`, 'poster'));
      }
    }
  }

  const narration = COURSE_NARRATION[moduleId];
  if (narration?.languages.includes(lang)) {
    for (const track of narration.tracks) {
      push(at(`/course-audio/${moduleId}/${lang}/slide-${String(track.slide).padStart(2, '0')}.mp3`, 'audio'));
    }
  }

  for (const lesson of COURSE_MODULES.find((m) => m.id === moduleId)?.lessons ?? []) {
    if (lesson.infographicUrl) push(at(lesson.infographicUrl, 'image'));
  }

  // A slide can be reached twice — its own file plus an English fallback pointing at the same
  // path — and an animation shared between modules would be fetched once per module.
  const seen = new Set<string>();
  const unique = entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));

  return {
    moduleId,
    lang,
    quality,
    entries: unique,
    bytes: unique.reduce((sum, e) => sum + e.bytes, 0),
    missing,
  };
}

/** Every module that has anything to download, with its size in this language. */
export function downloadableModules(lang: string, quality: PackQuality = 'standard'): Array<{ moduleId: string; bytes: number; count: number }> {
  return COURSE_MODULES
    .map((m) => {
      const pack = offlinePack(m.id, lang, quality);
      return { moduleId: m.id, bytes: pack.bytes, count: pack.entries.length };
    })
    .filter((p) => p.count > 0);
}

/** The whole course in one language — what "download everything" actually costs. */
export function wholeCourseBytes(lang: string, quality: PackQuality = 'standard'): number {
  return downloadableModules(lang, quality).reduce((sum, m) => sum + m.bytes, 0);
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
