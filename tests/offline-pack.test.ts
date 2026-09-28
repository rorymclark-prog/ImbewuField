import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { COURSE_ASSET_SIZES } from '@/lib/course-asset-sizes';
import { appGuideOfflinePack, offlinePack, downloadableModules, wholeCourseBytes, formatPackSize } from '@/lib/offline-pack';
import { APP_GUIDES, appGuideNarrationSections } from '@/lib/course-app-guides';
import { COURSE_DECKS, animationUrls, slideImageFor } from '@/lib/course-deck';
import { COURSE_NARRATION, resolveNarrationLang, trackUrl } from '@/lib/course-audio';
import { COURSE_MODULES } from '@/lib/course-modules';
import { FINANCE_PATHWAY_MEDIA_URLS, STUDIES_PATHWAY_PACKS, STUDIES_PATHWAY_PAGES } from '@/lib/studies-pathway-pack';

const PUBLIC = join(process.cwd(), 'public');

test('public teaching-preview packs name every static reading route and the finance materials it links', () => {
  const finance = STUDIES_PATHWAY_PACKS.finance;
  const design = STUDIES_PATHWAY_PACKS.design;
  assert.ok(finance.pages.includes('/student'));
  assert.ok(finance.pages.includes('/student/finance/project/guided'));
  assert.ok(finance.pages.includes('/student/finance/project/independent'));
  assert.ok(finance.pages.includes('/student/finance/project/retry'));
  assert.ok(design.pages.includes('/student/design/case'));
  assert.ok(design.pages.includes('/student/design/folder'));
  assert.ok(design.pages.includes('/student/design/scale'));
  assert.ok(design.pages.includes('/student/design/worked'));
  assert.equal(finance.pages.filter(path => /^\/student\/finance\/f\d-\d$/.test(path)).length, 24);
  assert.equal(design.pages.filter(path => /^\/student\/design\/d\d-\d$/.test(path)).length, 18);
  assert.deepEqual(STUDIES_PATHWAY_PAGES, [...new Set([...finance.pages, ...design.pages])]);
  assert.deepEqual([...FINANCE_PATHWAY_MEDIA_URLS].sort(), finance.pack.entries.map(item => item.url).sort());
  const worker = readFileSync(join(process.cwd(), 'app/sw.js/route.ts'), 'utf8');
  assert.match(worker, /STUDIES_PATHWAY_PAGES/);
  assert.match(worker, /STUDIES_PATHWAY_PAGES\.includes\(path\)/);
  assert.match(worker, /finance-course/);
  for (const pathway of Object.values(STUDIES_PATHWAY_PACKS)) {
    assert.equal(new Set(pathway.pack.entries.map(item => item.url)).size, pathway.pack.entries.length);
    assert.equal(pathway.pack.bytes, pathway.pack.entries.reduce((sum, item) => sum + item.bytes, 0));
    for (const item of pathway.pack.entries) assert.equal(item.bytes, statSync(join(PUBLIC, item.url)).size, `${pathway.id}: ${item.url}`);
  }
});

test('every guide download contains its picture and every current recording, including unchosen feedback', () => {
  for (const guide of APP_GUIDES) {
    const pack = appGuideOfflinePack(guide.id);
    assert.deepEqual(pack.missing, [], guide.id);
    assert.ok(pack.entries.some(e => e.url === guide.image && e.kind === 'image'));
    const audio = pack.entries.filter(e => e.kind === 'audio');
    assert.equal(audio.length, appGuideNarrationSections(guide).length);
    for (const e of pack.entries) {
      const url = new URL(e.url, 'https://field.test');
      assert.equal(e.bytes, statSync(join(PUBLIC, url.pathname)).size);
      if (e.kind === 'audio') assert.match(url.searchParams.get('v')!, /^[a-f0-9]{64}$/);
    }
    assert.equal(pack.bytes, pack.entries.reduce((sum, e) => sum + e.bytes, 0));
  }
  assert.ok(appGuideOfflinePack('unknown').missing.length);
});

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
  //
  // EVERY module, not just the ones with slide decks. This loop used to iterate
  // Object.keys(COURSE_DECKS) — one key — so when nine modules gained English narration
  // (2026-08-04) and the generated size manifest was not rebuilt, offlinePack quietly
  // dropped all ~20 clips per module and the suite stayed green: farmers were offered a
  // "whole course" download that was infographics only. Iterating COURSE_MODULES is what
  // makes this test actually guard the promise in its own name.
  for (const { id: moduleId } of COURSE_MODULES) {
    for (const lang of ['en', 'zu']) {
      assert.deepEqual(offlinePack(moduleId, lang).missing, [], `${moduleId}/${lang}`);
    }
  }
});

test('Soil isiZulu offline packs use localized compost stills and Thando voice clips', () => {
  const zu = offlinePack('soil-health', 'zu');
  const english = offlinePack('soil-health', 'en');
  assert.deepEqual(zu.missing, []);
  assert.equal(zu.entries.filter((e) => e.kind === 'slide').length, 20);
  assert.equal(zu.entries.filter((e) => e.kind === 'audio').length, 20);
  assert.ok(zu.entries.some((e) => e.url === '/course-audio/soil-health/zu/slide-17.mp3'));
  assert.equal(zu.entries.some((e) => e.kind === 'animation'), false,
    'the mismatched English compost clips are not charged to the isiZulu pack');
  assert.ok(english.entries.some((e) => e.url === '/course-animations/soil-health/flow-build-compost-heap.mp4'));
  assert.ok(english.entries.some((e) => e.url === '/course-animations/soil-health/flow-compost-materials.mp4'));
});

test('every module a language claims narration for actually packs that narration', () => {
  // The complement of the test above: `missing` only catches a file the manifest forgot.
  // It cannot catch a pack that never ASKED for the audio, which is the other half of how
  // the 2026-08-04 regression stayed invisible — a stale manifest and an unasked-for asset
  // both look like "0 missing". COURSE_NARRATION is the promise; the pack must honour it.
  for (const [moduleId, narration] of Object.entries(COURSE_NARRATION)) {
    for (const lang of narration.languages) {
      const audio = offlinePack(moduleId, lang).entries.filter((e) => e.kind === 'audio');
      assert.equal(
        audio.length,
        narration.tracks.length,
        `${moduleId}/${lang}: narration promises ${narration.tracks.length} clips, pack carries ${audio.length}`,
      );
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

test('a learner can hear the player’s fallback narration after downloading in another app language', () => {
  for (const [moduleId, narration] of Object.entries(COURSE_NARRATION)) {
    for (const requested of ['en', 'zu', 'xh']) {
      const spoken = resolveNarrationLang(moduleId, requested);
      if (!spoken) continue;
      const audio = offlinePack(moduleId, requested).entries.filter(e => e.kind === 'audio');
      assert.deepEqual(audio.map(e => e.url), narration.tracks.map(t => trackUrl(moduleId, spoken.lang, t.slide)));
    }
  }
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

test('Sesotho intro lessons download paired images and their source-bound draft narration', () => {
  const pack = offlinePack('intro-permaculture', 'st');
  assert.deepEqual(pack.missing, [], 'a missing image would only surface after the learner went offline');
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  assert.equal(slides.filter((url) => url.endsWith('.webp')).length, 22);
  assert.ok(slides.includes('/course-decks/intro-permaculture/st/slide-22.webp'));
  assert.ok(!slides.some((url) => url.includes('/course-decks/intro-permaculture/en/')));
  assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
    entry.url === '/course-audio/intro-permaculture/st/slide-04.mp3'));
  assert.equal(pack.entries.filter((entry) => entry.kind === 'audio' &&
    entry.url.startsWith('/course-audio/intro-permaculture/st/slide-')).length, 22,
  'the offline pack carries each distinct slide clip once without redownloading full.mp3');
  assert.ok(!pack.entries.some((entry) => entry.url.endsWith('/full.mp3')));
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/intro-permaculture/en/')),
    'the offline pack should not silently add the English recording when Sesotho was chosen');
});

test('Sesotho Soil Health entry keeps paired stills and English source narration offline', () => {
  const pack = offlinePack('soil-health', 'st');
  assert.deepEqual(pack.missing, []);
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  assert.equal(slides.filter((url) => url.startsWith('/course-decks/soil-health/st/')).length, 20,
    'the complete source-paired Sesotho deck must be available offline');
  for (let n = 1; n <= 20; n++) {
    const number = String(n).padStart(2, '0');
    assert.ok(slides.includes(`/course-decks/soil-health/st/slide-${number}.webp`));
  }
  assert.ok(!slides.some((url) => url.includes('/course-decks/soil-health/en/')),
    'each Sesotho slide already includes its exact English source');
  assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
    entry.url === '/course-audio/soil-health/en/slide-04.mp3'));
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/soil-health/st/')));
  assert.ok(!pack.entries.some((entry) => entry.url.includes('/course-animations/soil-health/')),
    'English compost films cannot cover the paired Sesotho slides in the silent pack');
});

test('itsonga Soil Health keeps all 20 paired stills and only optional English source audio offline', () => {
  const pack = offlinePack('soil-health', 'ts');
  assert.deepEqual(pack.missing, []);
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  for (let n = 1; n <= 20; n++) {
    const number = String(n).padStart(2, '0');
    assert.ok(slides.includes(`/course-decks/soil-health/ts/slide-${number}.webp`),
      `the silent Xitsonga deck needs paired slide ${number}`);
  }
  assert.ok(!slides.some((url) => url.includes('/course-decks/soil-health/en/')),
    'every Xitsonga frame embeds its English source, so no separate fallback slide is needed');
  assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
    entry.url === '/course-audio/soil-health/en/slide-04.mp3'),
  'English source audio remains an explicit optional choice');
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/soil-health/ts/')));
});

test('Tshivenda Soil Health packs all paired frames and leaves English narration optional offline', () => {
  const pack = offlinePack('soil-health', 've');
  assert.deepEqual(pack.missing, [], 'all 20 regional stills and selected English audio assets exist');
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  assert.equal(slides.filter((url) => url.includes('/course-decks/soil-health/ve/')).length, 20,
    'the offline pack carries every Tshivenda source-paired frame');
  for (let slide = 1; slide <= 20; slide++) {
    const number = String(slide).padStart(2, '0');
    assert.ok(slides.includes(`/course-decks/soil-health/ve/slide-${number}.webp`));
  }
  assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
    entry.url === '/course-audio/soil-health/en/slide-01.mp3'),
  'English source narration remains available only as an optional player choice');
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/soil-health/ve/')),
    'the deck does not promise Tshivenda narration');
});

test('regional Introduction downloads every selected still and never promise regional audio', () => {
  for (const lang of ['ve', 'ts']) {
    const pack = offlinePack('intro-permaculture', lang);
    assert.deepEqual(pack.missing, []);
    const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
    const deck = COURSE_DECKS['intro-permaculture'];
    for (const { slide } of deck.slides) {
      const selected = slideImageFor('intro-permaculture', lang, slide);
      assert.ok(selected, `${lang} slide ${slide} must resolve to a regional or English frame`);
      assert.ok(slides.includes(selected.url), `offline pack must include the shown ${lang} slide ${slide}`);
      if (selected.exact) assert.equal(selected.lang, lang);
      else assert.equal(selected.lang, 'en', `${lang} slide ${slide} fallback must be the exact English source`);
    }
    assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
      entry.url === '/course-audio/intro-permaculture/en/slide-04.mp3'));
    if (lang === 've') {
      assert.equal(slides.filter((url) => url.endsWith('.webp')).length, 22,
        'all 22 source-paired Tshivenda frames must be included in its download');
      for (const n of [7, 10]) {
        assert.ok(slides.includes(`/course-decks/intro-permaculture/ve/slide-${String(n).padStart(2, '0')}.webp`),
          `Tshivenda slide ${n} should download its source-paired English hold frame`);
      }
    }
    assert.equal(COURSE_NARRATION['intro-permaculture'].languages.includes(lang), false,
      `${lang} slides must not promise an unreviewed narration track`);
    assert.ok(pack.entries.every((entry) => !entry.url.includes(`/course-audio/intro-permaculture/${lang}/`)));
  }
});

test('Tshivenda and Xitsonga slide-only packs contain every displayed still and poster, with no media', () => {
  for (const moduleId of Object.keys(COURSE_DECKS)) {
    const deck = COURSE_DECKS[moduleId];
    for (const lang of ['ve', 'ts']) {
      if (!deck.slideLanguages.includes(lang)) continue;
      const pack = offlinePack(moduleId, lang, 'standard', 'slides');
      assert.deepEqual(pack.missing, [], `${moduleId}/${lang}`);
      assert.deepEqual(pack.entries.filter((e) => e.kind === 'slide').map((e) => e.url).sort(),
        deck.slides.map(({ slide }) => slideImageFor(moduleId, lang, slide)!.url).sort(),
        `${moduleId}/${lang} includes the exact regional or English fallback stills shown by DeckPlayer`);
      const expectedPosters = deck.slides.flatMap(({ slide }) => {
        const animation = animationUrls(moduleId, slide, lang);
        return animation ? [animation.poster] : [];
      }).sort();
      assert.deepEqual(pack.entries.filter((e) => e.kind === 'poster').map((e) => e.url).sort(), expectedPosters,
        `${moduleId}/${lang} includes only posters its player can show`);
      assert.ok(pack.entries.every((e) => e.kind === 'slide' || e.kind === 'poster'),
        `${moduleId}/${lang} slide-only pack contains no narration, video, or lesson infographic`);
      assert.equal(pack.bytes, pack.entries.reduce((sum, e) => sum + e.bytes, 0));
      for (const item of pack.entries) {
        assert.equal(item.bytes, statSync(join(PUBLIC, item.url.replace(/^\//, ''))).size, item.url);
      }
    }
  }
});

test('Sesotho Food Forest saves all 20 paired stills without the English Flow poster', () => {
  const pack = offlinePack('food-forest', 'st');
  assert.deepEqual(pack.missing, []);
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  assert.equal(slides.length, 20);
  for (let n = 1; n <= 20; n++) {
    assert.ok(slides.includes(`/course-decks/food-forest/st/slide-${String(n).padStart(2, '0')}.webp`),
      `the source-paired Sesotho deck needs slide ${n} offline`);
  }
  assert.ok(!pack.entries.some((entry) => entry.kind === 'poster' || entry.kind === 'animation'),
    'the English Flow poster must not hide the source-paired Sesotho slide');
  assert.ok(pack.entries.some((entry) => entry.kind === 'audio' &&
    entry.url === '/course-audio/food-forest/en/slide-04.mp3'),
    'existing English source narration remains an available explicit choice');
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/food-forest/st/')),
    'no Sesotho narration is claimed or packed');
});

test('Sesotho Vegetables saves all 18 paired stills and never hides slide 6 under English animation', () => {
  const pack = offlinePack('vegetables-staples', 'st');
  assert.deepEqual(pack.missing, []);
  const slides = pack.entries.filter((entry) => entry.kind === 'slide').map((entry) => entry.url);
  assert.equal(slides.length, 18);
  for (let n = 1; n <= 18; n++) {
    assert.ok(slides.includes(`/course-decks/vegetables-staples/st/slide-${String(n).padStart(2, '0')}.webp`),
      `the source-paired Sesotho deck needs slide ${n} offline`);
  }
  assert.ok(!pack.entries.some((entry) => entry.kind === 'poster' || entry.kind === 'animation'),
    'an English animation poster must not hide the source-paired Sesotho still');
  assert.ok(pack.entries.every((entry) => !entry.url.includes('/course-audio/vegetables-staples/st/')),
    'no Sesotho narration is claimed or packed');
});

test('the optional full regional pack preserves legacy contents and its English source narration', () => {
  for (const lang of ['ve', 'ts']) {
    const legacy = offlinePack('intro-permaculture', lang);
    const explicitFull = offlinePack('intro-permaculture', lang, 'standard', 'full');
    const slidesOnly = offlinePack('intro-permaculture', lang, 'standard', 'slides');
    assert.deepEqual(explicitFull, legacy, `${lang} default remains the existing full pack`);
    assert.ok(explicitFull.entries.some((e) => e.kind === 'audio' &&
      e.url === '/course-audio/intro-permaculture/en/slide-04.mp3'),
      `${lang} full pack carries the available English source narration`);
    assert.ok(explicitFull.bytes > slidesOnly.bytes, `${lang} full pack quotes the larger actual total`);
  }
});

test('whole-course regional slide-only totals include every saved still without narration or video', () => {
  const moduleIds = COURSE_MODULES.map(({ id }) => id);
  for (const lang of ['ve', 'ts']) {
    const slidesOnly = moduleIds.map((id) => offlinePack(id, lang, 'standard', 'slides'))
      .filter((pack) => pack.entries.length > 0);
    const full = moduleIds.map((id) => offlinePack(id, lang, 'standard', 'full'))
      .filter((pack) => pack.entries.length > 0);
    const slidesOnlyBytes = slidesOnly.reduce((sum, pack) => sum + pack.bytes, 0);
    const fullBytes = full.reduce((sum, pack) => sum + pack.bytes, 0);
    assert.ok(slidesOnly.length > 0, `${lang} whole-course selection has downloadable deck files`);
    assert.ok(slidesOnly.every((pack) => pack.entries.every((e) => e.kind === 'slide' || e.kind === 'poster')));
    assert.equal(slidesOnlyBytes, slidesOnly.reduce((sum, pack) =>
      sum + pack.entries.reduce((packSum, entry) => packSum + entry.bytes, 0), 0));
    assert.ok(fullBytes > slidesOnlyBytes, `${lang} full course visibly costs more than slides only`);
    assert.ok(full.some((pack) => pack.entries.some((e) => e.kind === 'audio' && e.url.includes('/en/'))),
      `${lang} full course includes its available English source narration`);
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

test('the isiZulu guild offline pack contains all 51 local slides and tracks and the localized labels', () => {
  const pack = offlinePack('plant-guilds', 'zu');
  assert.deepEqual(pack.missing, []);
  assert.equal(pack.entries.filter(e => e.kind === 'slide').length, 51);
  assert.equal(pack.entries.filter(e => e.kind === 'audio').length, 51);
  assert.ok(pack.entries.filter(e => e.kind === 'slide' || e.kind === 'audio').every(e => e.url.includes('/zu/')));
  assert.ok(pack.entries.some(e => e.url.endsWith('Imbewu-Guilds-09-Labelled-zu.mp4')));
  assert.ok(!pack.entries.some(e => e.url.endsWith('Imbewu-Guilds-09-Labelled.mp4')));
});
