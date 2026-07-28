import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  COURSE_DECKS, animationUrls, deckAnimationBytes, deckFor, deckSlideCount, formatBytes,
  hasDeck, resolveDeckLang, slideAudioUrl, slideImageFor, slideImageUrl,
} from '@/lib/course-deck';
import { COURSE_NARRATION } from '@/lib/course-audio';

const PUBLIC = new URL('../public/', import.meta.url);
const onDisk = (url: string) => existsSync(new URL(url.replace(/^\//, ''), PUBLIC));

test('the deck is derived from the narration manifest, never typed out twice', () => {
  // Two hand-maintained lists of the same 24 rows is this codebase's most repeated defect, and here
  // the drift would be a slide showing one thing while the voice says another. Deriving means the
  // two cannot disagree, and this asserts the derivation rather than the current values.
  const deck = deckFor('seeds-sovereignty');
  assert.ok(deck);
  const tracks = COURSE_NARRATION['seeds-sovereignty'].tracks;

  assert.equal(deck.slides.length, tracks.length);
  assert.deepEqual(deck.slides.map((s) => s.slide), tracks.map((t) => t.slide));
  assert.deepEqual(deck.slides.map((s) => s.title), tracks.map((t) => t.title));
  assert.deepEqual(deck.slides.map((s) => s.lesson), tracks.map((t) => t.lesson));
});

test('every promised slide image exists on disk', () => {
  // The other direction of the same rule tests/course-audio.test.ts enforces for narration: a
  // promised file that is missing is a broken image on a farmer's phone, and they have already
  // paid for the page load by the time they find out.
  const deck = deckFor('seeds-sovereignty')!;
  for (const lang of deck.slideLanguages) {
    const known = deck.missingSlides?.[lang] ?? [];
    for (const s of deck.slides) {
      const url = slideImageUrl('seeds-sovereignty', lang, s.slide);
      if (known.includes(s.slide)) {
        // A slide DECLARED missing must return nothing, so slideImageFor falls back rather than
        // emitting a url to a file that is not there. Declared-and-absent is a known state;
        // undeclared-and-absent is the broken image this test exists to catch.
        assert.equal(url, null, `${lang} slide ${s.slide} is declared missing but produced a url`);
        continue;
      }
      assert.ok(url, `no url for ${lang} slide ${s.slide}`);
      assert.ok(onDisk(url!), `missing file: ${url}`);
    }
  }
});

test('a declared-missing slide is really absent, and nothing else is', () => {
  // Guards the manifest against drifting from the folder in either direction: a slide declared
  // missing that later gets exported would stay hidden behind an English fallback forever, and a
  // slide quietly deleted from the folder would 404 on a farmer's phone.
  const deck = deckFor('seeds-sovereignty')!;
  for (const lang of deck.slideLanguages) {
    const declared = new Set(deck.missingSlides?.[lang] ?? []);
    for (const s of deck.slides) {
      const path = `/course-decks/seeds-sovereignty/${lang}/slide-${String(s.slide).padStart(2, '0')}.jpg`;
      assert.equal(
        onDisk(path), !declared.has(s.slide),
        declared.has(s.slide)
          ? `${lang} slide ${s.slide} is declared missing but the file now exists — remove it from missingSlides`
          : `${lang} slide ${s.slide} is missing from disk and not declared`,
      );
    }
  }
});

test('every animation and its poster exist, and the poster is the cheap one', () => {
  const deck = deckFor('seeds-sovereignty')!;
  const withAnim = deck.slides.filter((s) => s.animation);
  assert.equal(withAnim.length, 8, 'six deck animations plus the two Gemini clips');

  for (const s of withAnim) {
    const a = animationUrls('seeds-sovereignty', s.slide)!;
    assert.ok(onDisk(a.video), `missing clip: ${a.video}`);
    assert.ok(onDisk(a.poster), `missing poster: ${a.poster}`);
    assert.ok(a.bytes > 0 && a.seconds > 0, 'the play button prints both, so both must be real');
  }
});

test('a slide with no animation offers none — the still is the lesson', () => {
  assert.equal(animationUrls('seeds-sovereignty', 1), null);
  assert.equal(animationUrls('seeds-sovereignty', 2), null);
  assert.ok(animationUrls('seeds-sovereignty', 5));
});

test('the isiZulu fallback is PER SLIDE, not per module', () => {
  // The isiZulu deck came back from PowerPoint as "Repaired" with 23 of its 24 slides — the repair
  // dropped slide 13, "Watch: Dry Processing". Falling the whole module back to English because of
  // one missing slide would take a finished isiZulu lesson away from the person it was made for,
  // and would apologise 23 times for something true once.
  const zu5 = slideImageFor('seeds-sovereignty', 'zu', 5);
  assert.deepEqual(zu5, { url: '/course-decks/seeds-sovereignty/zu/slide-05.jpg', lang: 'zu', exact: true });

  const zu13 = slideImageFor('seeds-sovereignty', 'zu', 13);
  assert.deepEqual(zu13, { url: '/course-decks/seeds-sovereignty/en/slide-13.jpg', lang: 'en', exact: false });

  // Every OTHER slide must be exact, or the note would appear where it does not belong.
  const inexact = deckFor('seeds-sovereignty')!.slides
    .map((s) => ({ n: s.slide, r: slideImageFor('seeds-sovereignty', 'zu', s.slide) }))
    .filter((x) => x.r && !x.r.exact)
    .map((x) => x.n);
  assert.deepEqual(inexact, [13], 'only slide 13 falls back');

  // A language with no deck at all still falls back wholesale, which is the right behaviour there.
  assert.deepEqual(resolveDeckLang('seeds-sovereignty', 'st'), { lang: 'en', exact: false });

  // The narration is isiZulu on every slide, including the one whose picture is English.
  assert.equal(slideAudioUrl('seeds-sovereignty', 'zu', 13), '/course-audio/seeds-sovereignty/zu/slide-13.mp3');
});

test('unknown modules and slides produce no url rather than a broken one', () => {
  assert.equal(hasDeck('water-harvesting'), false);
  assert.equal(deckFor('no-such-module'), null);
  assert.equal(resolveDeckLang('water-harvesting', 'en'), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'en', 99), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 13), null, 'the one slide the repair dropped');
});

test('slides partition by lesson exactly as the narration does', () => {
  const deck = deckFor('seeds-sovereignty')!;
  const counted = ['l1', 'l2', 'l3'].reduce((n, l) => n + deckSlideCount('seeds-sovereignty', `seeds-sovereignty-${l}`), 0);
  const moduleLevel = deck.slides.filter((s) => s.lesson === null).length;
  assert.equal(counted + moduleLevel, deck.slides.length, 'every slide is reachable from exactly one place');
  assert.equal(deckSlideCount('seeds-sovereignty'), deck.slides.length);
});

test('the data cost is stated honestly, because the farmer is paying it', () => {
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(64_000), '63 KB');
  assert.equal(formatBytes(2_306_000), '2.2 MB');

  // Watching every clip in the module is ~11 MB. That number needs to be reachable so a screen can
  // warn before a "play all" rather than after it.
  const total = deckAnimationBytes('seeds-sovereignty');
  assert.ok(total > 10_000_000 && total < 12_000_000, `unexpected module total: ${formatBytes(total)}`);
});

test('only modules that really have a deck advertise one', () => {
  assert.equal(hasDeck('seeds-sovereignty'), true);
  for (const id of Object.keys(COURSE_DECKS)) {
    assert.ok(COURSE_DECKS[id].slides.length > 0, `${id} is registered with no slides`);
    assert.ok(COURSE_DECKS[id].slideLanguages.length > 0, `${id} has no rendered language`);
  }
});
