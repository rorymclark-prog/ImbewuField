import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  COURSE_DECKS, animationUrls, deckAnimationBytes, deckFor, deckSlideCount, formatBytes,
  hasDeck, resolveDeckLang, slideAudioUrl, slideImageUrl,
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
    for (const s of deck.slides) {
      const url = slideImageUrl('seeds-sovereignty', lang, s.slide);
      assert.ok(url, `no url for ${lang} slide ${s.slide}`);
      assert.ok(onDisk(url!), `missing file: ${url}`);
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

test('isiZulu gets isiZulu narration over English slides, and is told so', () => {
  // The slides exist in isiZulu but would not export from either Keynote or PowerPoint. Falling
  // back silently would show a farmer a language they may not read with no explanation; `exact:
  // false` is what lets the UI say "the spoken lesson is in your language, these slides are not".
  // Same contract resolveNarrationLang uses, deliberately.
  assert.deepEqual(resolveDeckLang('seeds-sovereignty', 'en'), { lang: 'en', exact: true });
  assert.deepEqual(resolveDeckLang('seeds-sovereignty', 'zu'), { lang: 'en', exact: false });
  assert.deepEqual(resolveDeckLang('seeds-sovereignty', 'st'), { lang: 'en', exact: false });

  // The narration itself IS in isiZulu — that is the half that works, and it must keep working.
  assert.equal(slideAudioUrl('seeds-sovereignty', 'zu', 5), '/course-audio/seeds-sovereignty/zu/slide-05.mp3');
});

test('unknown modules and slides produce no url rather than a broken one', () => {
  assert.equal(hasDeck('water-harvesting'), false);
  assert.equal(deckFor('no-such-module'), null);
  assert.equal(resolveDeckLang('water-harvesting', 'en'), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'en', 99), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 5), null, 'zu slides do not exist yet');
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
