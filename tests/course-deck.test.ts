import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

// The real generator, not a re-implementation of its rules. A test that reasoned about what the
// renderer OUGHT to emit would pass while the renderer did something else entirely.
import { renderDeck } from '../scripts/render-course-deck.mjs';

import {
  COURSE_DECKS, animationUrls, deckAnimationBytes, deckFor, deckSlideCount, formatBytes,
  hasDeck, resolveDeckLang, slideAudioUrl, slideImageFor, slideImageUrl,
} from '@/lib/course-deck';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_MODULES } from '@/lib/course-modules';

const PUBLIC = new URL('../public/', import.meta.url);
const onDisk = (url: string) => existsSync(new URL(url.replace(/^\//, ''), PUBLIC));

const normalizeText = (s: string) => s
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

function englishNarrationBlocks(moduleId: string) {
  const source = readFileSync(new URL(`../docs/narration/${moduleId}.en.md`, import.meta.url), 'utf8');
  const headings = [...source.matchAll(/^\*\*Slide\s+(\d+)\s+[—-][^\n]*\*\*\s*$/gm)];
  return new Map(headings.map((heading, index) => {
    const body = source.slice(heading.index! + heading[0].length, headings[index + 1]?.index).split(/^#{1,6}\s/m)[0];
    const [before, after = ''] = body.split(/\[pause\]/i);
    const paragraphs = (text: string) => text.replace(/^---\s*$/gm, '').split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return [Number(heading[1]), { before: paragraphs(before), after: paragraphs(after) }];
  }));
}

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
  //
  // EVERY DECK, not just Seeds. This was pinned to deckFor('seeds-sovereignty') while Seeds was the
  // only deck, which meant it would keep passing while covering nothing the day a second one landed
  // — the same shape of hole that had to be dug out of tests/offline-pack.test.ts on 2026-08-04,
  // where a loop over one key stayed green through a regression spanning nine modules.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of deck.slideLanguages) {
      const known = deck.missingSlides?.[lang] ?? [];
      for (const s of deck.slides) {
        const url = slideImageUrl(moduleId, lang, s.slide);
        if (known.includes(s.slide)) {
          // A slide DECLARED missing must return nothing, so slideImageFor falls back rather than
          // emitting a url to a file that is not there. Declared-and-absent is a known state;
          // undeclared-and-absent is the broken image this test exists to catch.
          assert.equal(url, null, `${moduleId}/${lang} slide ${s.slide} is declared missing but produced a url`);
          continue;
        }
        assert.ok(url, `no url for ${moduleId}/${lang} slide ${s.slide}`);
        assert.ok(onDisk(url!), `missing file: ${url}`);
      }
    }
  }
});

test('a declared-missing slide is really absent, and nothing else is', () => {
  // Guards the manifest against drifting from the folder in either direction: a slide declared
  // missing that later gets exported would stay hidden behind an English fallback forever, and a
  // slide quietly deleted from the folder would 404 on a farmer's phone.
  //
  // The path is built from the deck's own imageExt rather than a literal '.jpg'. Hard-coding the
  // extension would have made this test quietly vacuous for an SVG deck — every file it looked for
  // would be absent, so it would have demanded that every slide be declared missing.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of deck.slideLanguages) {
      const declared = new Set(deck.missingSlides?.[lang] ?? []);
      for (const s of deck.slides) {
        const path = `/course-decks/${moduleId}/${lang}/slide-${String(s.slide).padStart(2, '0')}.${deck.imageExt ?? 'jpg'}`;
        assert.equal(
          onDisk(path), !declared.has(s.slide),
          declared.has(s.slide)
            ? `${moduleId}/${lang} slide ${s.slide} is declared missing but the file now exists — remove it from missingSlides`
            : `${moduleId}/${lang} slide ${s.slide} is missing from disk and not declared`,
        );
      }
    }
  }
});

test('a generated deck still matches the content it was generated from', () => {
  // These slides are DERIVED — from docs/narration/<module>.<lang>.md and the narration manifest —
  // so editing a script without re-rendering leaves a farmer reading the old wording while the
  // voice reads the new one. That is the same class of defect as an animation matched to the wrong
  // narration, and it is invisible on disk: every file is present and every size agrees, the deck
  // just says something the course no longer says.
  //
  // Re-rendering in-process and comparing bytes is also what proves the renderer is deterministic.
  // If it were not — a clock, a hash seed, an unstable iteration order — this would fail at random,
  // which is a far better outcome than a deck nobody can reproduce.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    if (deck.imageExt !== 'svg') continue; // a painted deck has no generator to re-run
    for (const lang of deck.slideLanguages) {
      const rendered = renderDeck(moduleId, lang) as { slide: number; file: string; svg: string; dropped: number; continuation: boolean }[];
      const cards = rendered.filter((r) => !r.continuation);
      assert.equal(cards.length, deck.slides.length, `${moduleId}/${lang}: renderer and manifest disagree on narration-block count`);
      assert.ok(rendered.every((r) => r.dropped === 0), `${moduleId}/${lang}: a supporting line was dropped instead of continuing the card`);
      for (const r of rendered) {
        const url = `/course-decks/${moduleId}/${lang}/${r.file}`;
        assert.equal(
          readFileSync(new URL(url.replace(/^\//, ''), PUBLIC), 'utf8'), r.svg,
          `${moduleId}/${lang} ${r.file} is stale — re-run: npm run course:render-deck -- ${moduleId} ${lang}`,
        );
      }

      // A continuation is not allowed to be a cosmetically correct empty card. Compare its SVG
      // text to the independently parsed script: the point that did not fit and the reflection
      // (when the first card gave points priority) must be in one of the two actual SVG files.
      // This would have caught the old first-sentence fallback even if the renderer reported zero
      // dropped lines, because its missing words were absent from both rendered byte strings.
      if (lang === 'en') {
        const blocks = englishNarrationBlocks(moduleId);
        for (const continuation of rendered.filter((r) => r.continuation)) {
          assert.match(continuation.svg, /CONTINUED/, `${moduleId}/${lang} ${continuation.file} does not identify itself as a continuation`);
          const block = blocks.get(continuation.slide);
          assert.ok(block, `${moduleId}/${lang} slide ${continuation.slide} has no source block`);
          const frameText = normalizeText(rendered.filter((r) => r.slide === continuation.slide).map((r) => r.svg).join(' '));
          for (const paragraph of [...block!.before, ...block!.after.slice(0, 1)]) {
            assert.ok(
              frameText.includes(normalizeText(paragraph)),
              `${moduleId}/${lang} slide ${continuation.slide} lost authored text: ${paragraph}`,
            );
          }
        }
      }
    }
  }
});

test('a generated slide is small enough to be worth sending', () => {
  // The whole argument for rendering these as vector is the data bill. Seeds' painted stills are
  // 47–152 KB each because they are artwork; a slide made of type and rules has no business being
  // anywhere near that, and if one ever is, something has gone wrong in the renderer rather than in
  // the design. 12 KB sits far above where these actually land (~2 KB) and far below where any
  // raster would, so it catches a regression without objecting to a redesign.
  for (const [moduleId, deck] of Object.entries(COURSE_DECKS)) {
    if (deck.imageExt !== 'svg') continue;
    for (const lang of deck.slideLanguages) {
      for (const s of deck.slides) {
        const url = slideImageUrl(moduleId, lang, s.slide)!;
        const bytes = statSync(new URL(url.replace(/^\//, ''), PUBLIC)).size;
        assert.ok(bytes < 12_000, `${url} is ${bytes} B — a generated slide should be a few KB`);
      }
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
  // dropped slide 13, "Buka: Indlela Eyomile". Falling the whole module back to English because of
  // one missing slide would take a finished isiZulu lesson away from the person it was made for,
  // and would apologise 23 times for something true once.
  //
  // That slide has since been rebuilt, so Seeds no longer exercises the fallback. This test now
  // asserts the MECHANISM on a synthetic gap instead of on Seeds' history — otherwise filling the
  // gap would have quietly deleted the only coverage of per-slide fallback, right before the next
  // module arrives with a gap of its own.
  const zu5 = slideImageFor('seeds-sovereignty', 'zu', 5);
  assert.deepEqual(zu5, { url: '/course-decks/seeds-sovereignty/zu/slide-05.jpg', lang: 'zu', exact: true });

  const deck = deckFor('seeds-sovereignty')!;
  const saved = deck.missingSlides;
  try {
    deck.missingSlides = { zu: [13] };
    assert.deepEqual(
      slideImageFor('seeds-sovereignty', 'zu', 13),
      { url: '/course-decks/seeds-sovereignty/en/slide-13.jpg', lang: 'en', exact: false },
      'a declared gap must fall back to English for THAT slide',
    );
    // Every OTHER slide stays exact, or the note would appear where it does not belong.
    const inexact = deck.slides
      .map((s) => ({ n: s.slide, r: slideImageFor('seeds-sovereignty', 'zu', s.slide) }))
      .filter((x) => x.r && !x.r.exact)
      .map((x) => x.n);
    assert.deepEqual(inexact, [13], 'only the declared slide falls back');
  } finally {
    deck.missingSlides = saved;
  }

  // With nothing declared missing, which is the state Seeds is actually in, nothing falls back.
  const stillInexact = deck.slides
    .map((s) => slideImageFor('seeds-sovereignty', 'zu', s.slide))
    .filter((r) => r && !r.exact);
  assert.deepEqual(stillInexact, [], 'Seeds is complete in isiZulu — no slide should fall back');

  // A language with no deck at all still falls back wholesale, which is the right behaviour there.
  assert.deepEqual(resolveDeckLang('seeds-sovereignty', 'st'), { lang: 'en', exact: false });

  // The narration is isiZulu on every slide, including the one whose picture is English.
  assert.equal(slideAudioUrl('seeds-sovereignty', 'zu', 13), '/course-audio/seeds-sovereignty/zu/slide-13.mp3');
});

test('unknown modules and slides produce no url rather than a broken one', () => {
  // The unknown-module path, asserted on all three lookups rather than just deckFor. These do not
  // depend on which modules happen to have decks, which is what keeps this test from going vacuous
  // now that every curriculum module has one.
  assert.equal(deckFor('no-such-module'), null);
  assert.equal(hasDeck('no-such-module'), false);
  assert.equal(resolveDeckLang('no-such-module', 'en'), null);
  assert.equal(slideImageUrl('no-such-module', 'en', 1), null);

  // A MODULE WITHOUT A DECK MUST ADVERTISE NOTHING — derived, not named. This used to pin the rule
  // to 'water-harvesting' as the stand-in for "the module that has no deck", which meant the day
  // that module GAINED one the test failed on the improvement and the fix was to swap in another
  // module id — a snapshot of a fact, maintained by hand, about a rule that was never about
  // water-harvesting. Derived, it covered every deckless module at once and needed no edit as the
  // remaining decks landed. It is empty today, because they all have decks; that is the goal
  // arriving, not coverage quietly lost, and the unknown-module assertions above still hold the
  // "no deck means no url" rule down.
  for (const mod of COURSE_MODULES) {
    if (hasDeck(mod.id)) continue;
    assert.equal(deckFor(mod.id), null, `${mod.id} has no slides yet deckFor returned a deck`);
    assert.equal(resolveDeckLang(mod.id, 'en'), null, `${mod.id} has no deck yet resolved a slide language`);
    assert.equal(slideImageUrl(mod.id, 'en', 1), null, `${mod.id} has no deck yet produced a slide url`);
  }

  assert.equal(slideImageUrl('seeds-sovereignty', 'en', 99), null);
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 99), null);
  // Slide 13 used to be asserted null here — the gap the PowerPoint repair left. It has been
  // rebuilt, so the honest assertion is now the opposite one.
  assert.equal(slideImageUrl('seeds-sovereignty', 'zu', 13), '/course-decks/seeds-sovereignty/zu/slide-13.jpg');
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

  // The module total must be reachable so a screen can warn before a "play all" rather than after.
  //
  // This used to pin the total inside a 10–12 MB window, which is a snapshot of a constant, not a
  // rule: it passed while the numbers were right, and then FAILED when the clips were legitimately
  // re-encoded from 10.9 MB down to 5.1 MB — flagging the improvement instead of a defect. It could
  // never have caught the thing that actually went wrong, which was the manifest disagreeing with
  // the files. So the rule is: the advertised total is the sum of the real files, and the ceiling
  // is the one that would genuinely hurt — the 101 MB of animated GIF that arrived once before.
  const total = deckAnimationBytes('seeds-sovereignty');
  const fromDisk = (COURSE_DECKS['seeds-sovereignty'].slides)
    .filter((s) => s.animation)
    .reduce((sum, s) => sum + statSync(new URL(`course-animations/seeds-sovereignty/${s.animation!.src}.mp4`, PUBLIC)).size, 0);
  assert.equal(total, fromDisk, 'the advertised total is not what the files actually weigh');
  assert.ok(total < 20_000_000, `a module's clips now total ${formatBytes(total)} — too much to offer a farmer`);
});

test('only modules that really have a deck advertise one', () => {
  assert.equal(hasDeck('seeds-sovereignty'), true);
  for (const id of Object.keys(COURSE_DECKS)) {
    assert.ok(COURSE_DECKS[id].slides.length > 0, `${id} is registered with no slides`);
    assert.ok(COURSE_DECKS[id].slideLanguages.length > 0, `${id} has no rendered language`);
  }
});
