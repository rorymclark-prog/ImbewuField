import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { COURSE_ASSET_SIZES } from '@/lib/course-asset-sizes';
import { offlinePack, downloadableModules, wholeCourseBytes, formatPackSize } from '@/lib/offline-pack';
import { COURSE_DECKS, slideImageFor } from '@/lib/course-deck';
import { COURSE_NARRATION } from '@/lib/course-audio';

const PUBLIC = join(process.cwd(), 'public');

// The download button states a size and then spends somebody's data. Every number below is
// therefore checked against the filesystem rather than against another number in the codebase.

test('every size in the generated manifest matches the real file, to the byte', () => {
  // The manifest is generated, so it is correct the day it is written and wrong the first time
  // anyone re-encodes an asset without re-running the script. This is the check that turns that
  // from a silent lie into a failed build. Fix by running: node scripts/gen-asset-sizes.mjs
  const wrong: string[] = [];
  for (const [url, bytes] of Object.entries(COURSE_ASSET_SIZES)) {
    const path = join(PUBLIC, url.replace(/^\//, ''));
    if (!existsSync(path)) { wrong.push(`${url}: missing on disk`); continue; }
    const real = statSync(path).size;
    if (real !== bytes) wrong.push(`${url}: manifest ${bytes}, disk ${real}`);
  }
  assert.deepEqual(wrong, [], `stale asset sizes — run: node scripts/gen-asset-sizes.mjs`);
});

test('the deck manifest states each clip\'s true size — the play button is a promise', () => {
  // course-deck.ts carries its own `bytes` because the play button shows it before a farmer spends
  // the data. Hand-rounded values survived a re-encode once and every button on the page was then
  // overstating by 4x. Both numbers now come from the same disk.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    for (const slide of deck.slides) {
      if (!slide.animation) continue;
      const path = join(PUBLIC, 'course-animations', moduleId, `${slide.animation.src}.mp4`);
      assert.ok(existsSync(path), `${moduleId} slide ${slide.slide}: ${slide.animation.src}.mp4 missing`);
      assert.equal(
        slide.animation.bytes,
        statSync(path).size,
        `${moduleId} slide ${slide.slide}: manifest bytes disagree with the file`,
      );
    }
  }
});

test('a pack names no file that does not exist', () => {
  // `missing` travels with the pack rather than throwing, so this is where it has to be empty.
  // A download that reports success with a hole in it is worse than one that refuses to start.
  for (const moduleId of Object.keys(COURSE_DECKS)) {
    for (const lang of ['en', 'zu']) {
      assert.deepEqual(offlinePack(moduleId, lang).missing, [], `${moduleId}/${lang}`);
    }
  }
});

test('the pack excludes full.mp3 — it is the slide clips again', () => {
  // 6–7 MB per language of duplicate narration. Nothing in the app plays it, and even if something
  // did, a learner who has all 24 slide clips already has every second of it.
  const pack = offlinePack('seeds-sovereignty', 'zu');
  assert.ok(pack.entries.length > 0);
  assert.equal(pack.entries.filter((e) => e.url.endsWith('full.mp3')).length, 0);
});

test('one language, not both — packing both would double the download for nobody', () => {
  const en = offlinePack('seeds-sovereignty', 'en');
  const zu = offlinePack('seeds-sovereignty', 'zu');
  const enAudio = en.entries.filter((e) => e.kind === 'audio');
  const zuAudio = zu.entries.filter((e) => e.kind === 'audio');
  assert.ok(enAudio.length > 0 && zuAudio.length > 0);
  assert.ok(enAudio.every((e) => e.url.includes('/en/')), 'English pack must carry only English audio');
  assert.ok(zuAudio.every((e) => e.url.includes('/zu/')), 'isiZulu pack must carry only isiZulu audio');
});

test('a pack carries whatever the player will actually show, including any fallback', () => {
  // Packing only the learner's own language would produce a module that is complete on paper and
  // blank on any slide the player falls back to English for — discovered offline at a homestead,
  // which is exactly the situation the download exists to prevent.
  //
  // Written against the RULE rather than a specific gap. It was pinned to "zu is missing slide 13"
  // until that slide was rebuilt, at which point a correct test failed for the wrong reason. This
  // version keeps working whether a deck has gaps or not, which is the only way it can still be
  // guarding anything when the next module lands.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of deck.slideLanguages) {
      const urls = new Set(offlinePack(moduleId, lang).entries.map((e) => e.url));
      for (const slide of deck.slides) {
        const shown = slideImageFor(moduleId, lang, slide.slide);
        if (!shown) continue;
        assert.ok(urls.has(shown.url), `${moduleId}/${lang} slide ${slide.slide}: player shows ${shown.url}, pack does not carry it`);
      }
    }
  }
});

test('both languages of the finished module are whole — no slide falls back', () => {
  // Seeds is the module being shown to people as the finished sample. A farmer reading isiZulu
  // should not meet an English slide in it.
  const deck = COURSE_DECKS['seeds-sovereignty'];
  for (const lang of deck.slideLanguages) {
    for (const slide of deck.slides) {
      const shown = slideImageFor('seeds-sovereignty', lang, slide.slide);
      assert.ok(shown, `${lang} slide ${slide.slide} has no image at all`);
      assert.equal(shown!.exact, true, `${lang} slide ${slide.slide} falls back to ${shown!.lang}`);
    }
  }
});

test('a pack has one entry per file, even when two slides resolve to the same one', () => {
  const pack = offlinePack('seeds-sovereignty', 'zu');
  const urls = pack.entries.map((e) => e.url);
  assert.equal(new Set(urls).size, urls.length, 'duplicate URL in pack — it would be fetched twice');
  assert.equal(pack.bytes, pack.entries.reduce((s, e) => s + e.bytes, 0));
});

test('the pack covers every slide and every narration track', () => {
  // Under-packing is the failure that hides: the download succeeds, and the gap only appears in a
  // homestead with no signal. So the count is checked against the manifests, not eyeballed.
  const deck = COURSE_DECKS['seeds-sovereignty'];
  const pack = offlinePack('seeds-sovereignty', 'zu');
  assert.equal(pack.entries.filter((e) => e.kind === 'slide').length, deck.slides.length);
  assert.equal(
    pack.entries.filter((e) => e.kind === 'audio').length,
    COURSE_NARRATION['seeds-sovereignty'].tracks.length,
  );
  const withAnimation = deck.slides.filter((s) => s.animation).length;
  assert.equal(pack.entries.filter((e) => e.kind === 'animation').length, withAnimation);
  assert.equal(pack.entries.filter((e) => e.kind === 'poster').length, withAnimation);
});

test('a module with no deck and no audio is not offered as a download', () => {
  // Nine modules are lesson text and stills today. Offering "Download" on one and delivering a
  // couple of JPEGs would spend trust for nothing.
  const offered = downloadableModules('zu').map((m) => m.moduleId);
  for (const id of offered) assert.ok(offlinePack(id, 'zu').entries.length > 0);
});

test('the finished module fits a real trip to town', () => {
  // Not a style check. The whole design rests on one module being downloadable on a town
  // connection in a few minutes; if Seeds ever exceeds 25 MB the premise has quietly broken and
  // somebody needs to look at it before a farmer does.
  const zu = offlinePack('seeds-sovereignty', 'zu').bytes;
  const en = offlinePack('seeds-sovereignty', 'en').bytes;
  assert.ok(zu < 25 * 1024 * 1024, `isiZulu Seeds is ${formatPackSize(zu)} — too big for the trip it was designed around`);
  assert.ok(en < 25 * 1024 * 1024, `English Seeds is ${formatPackSize(en)}`);
});

test('formatPackSize reaches GB — a whole course is not quoted in megabytes', () => {
  assert.equal(formatPackSize(900), '900 B');
  assert.equal(formatPackSize(2048), '2 KB');
  assert.equal(formatPackSize(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatPackSize(1610612736), '1.50 GB');
  assert.ok(wholeCourseBytes('zu') > 0);
});

test('the high-quality pack is a real upgrade, never padding', () => {
  // For facilitators, funders and anyone training off wifi. It must be genuinely bigger where
  // better files exist and IDENTICAL where they do not — a "high quality" download that quietly
  // ships the same bytes at a bigger advertised number would be the exact dishonesty the size
  // label exists to prevent.
  for (const lang of ['en', 'zu']) {
    const std = offlinePack('seeds-sovereignty', lang, 'standard');
    const hi = offlinePack('seeds-sovereignty', lang, 'high');
    assert.deepEqual(hi.missing, [], `${lang}: high pack names a file that does not exist`);
    assert.equal(hi.entries.length, std.entries.length, `${lang}: the two tiers must cover the same lesson`);
    assert.ok(hi.bytes > std.bytes, `${lang}: high (${hi.bytes}) is not larger than standard (${std.bytes})`);

    // Every entry is either the standard file or a strictly larger hi/ twin — never smaller.
    const byKind = (p: typeof std, k: string) => p.entries.filter((e) => e.kind === k).reduce((s, e) => s + e.bytes, 0);
    for (const kind of ['slide', 'audio', 'animation', 'poster', 'image']) {
      assert.ok(byKind(hi, kind) >= byKind(std, kind), `${lang}/${kind}: high tier is smaller than standard`);
    }
  }
});

test('assets with no higher-quality original fall back instead of being upscaled', () => {
  // The narration is 24 kbps mono because that is how it was recorded, and the English slides were
  // only ever rendered at 960px. Inventing bigger versions would cost a facilitator data for zero
  // extra detail, so those entries must be byte-identical across the two tiers.
  const std = offlinePack('seeds-sovereignty', 'en', 'standard');
  const hi = offlinePack('seeds-sovereignty', 'en', 'high');
  const audio = (p: typeof std) => p.entries.filter((e) => e.kind === 'audio');
  assert.deepEqual(audio(hi).map((e) => e.url), audio(std).map((e) => e.url), 'audio must not have a hi variant');
  const slides = (p: typeof std) => p.entries.filter((e) => e.kind === 'slide').reduce((s, e) => s + e.bytes, 0);
  assert.equal(slides(hi), slides(std), 'English slides have no higher-res original');
});

test('standard stays the default everywhere — a farmer never opts in by accident', () => {
  const implicit = offlinePack('seeds-sovereignty', 'zu');
  const explicit = offlinePack('seeds-sovereignty', 'zu', 'standard');
  assert.equal(implicit.quality, 'standard');
  assert.equal(implicit.bytes, explicit.bytes);
  assert.ok(wholeCourseBytes('zu') < wholeCourseBytes('zu', 'high'));
  assert.equal(downloadableModules('zu').length, downloadableModules('zu', 'high').length);
});
