import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import test from 'node:test';

import {
  COURSE_DECKS, animationUrls, deckAnimationBytes, deckFor, deckSlideCount, formatBytes,
  hasDeck, resolveDeckLang, slideAudioUrl, slideImageFor, slideImageUrl,
} from '@/lib/course-deck';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_TRANSCRIPTS } from '@/lib/course-transcripts';
import { collectTranscripts } from '../scripts/gen-course-transcripts.mjs';

const PUBLIC = new URL('../public/', import.meta.url);
const onDisk = (url: string) => existsSync(new URL(url.replace(/^\//, ''), PUBLIC));

test('sound-off learners get the complete current script, including its final instruction', () => {
  // A beautiful picture cannot replace words a learner cannot hear. This fails on a missing
  // paragraph, stale edit, shifted slide, or accidentally published draft-language transcript.
  assert.deepEqual(COURSE_TRANSCRIPTS, collectTranscripts());
  for (const [moduleId, narration] of Object.entries(COURSE_NARRATION)) {
    assert.deepEqual(Object.keys(COURSE_TRANSCRIPTS[moduleId]).sort(), [...narration.languages].sort());
    for (const lang of narration.languages) {
      for (const track of narration.tracks) {
        const paragraphs = COURSE_TRANSCRIPTS[moduleId][lang][track.slide];
        assert.ok(paragraphs.length > 0, `${moduleId}/${lang}/${track.slide} has no readable words`);
        assert.ok(paragraphs.every(p => !/\[pause\]|^---\s*$/m.test(p)), 'stage directions are not learner text');
      }
    }
  }
});

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
  // Water now has a deck; absence is a lookup rule, not a permanent module status.
  assert.equal(hasDeck('no-such-module'), false);
  assert.equal(deckFor('no-such-module'), null);
  assert.equal(resolveDeckLang('no-such-module', 'en'), null);
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

test('every registered deck can load its slides and clips at the advertised data cost', () => {
  // New modules must receive the same missing-file and byte checks as Seeds and Guilds.
  for (const [id, deck] of Object.entries(COURSE_DECKS)) {
    for (const lang of deck.slideLanguages) {
      for (const slide of deck.slides) {
        const picture = slideImageFor(id, lang, slide.slide);
        assert.ok(picture && onDisk(picture.url), `${id}/${lang}/${slide.slide}: missing slide`);
        const audio = slideAudioUrl(id, lang, slide.slide);
        if (audio) assert.ok(onDisk(audio), `missing narration: ${audio}`);
        const clip = animationUrls(id, slide.slide, lang);
        if (!clip) continue;
        assert.ok(onDisk(clip.video), `missing clip: ${clip.video}`);
        assert.ok(onDisk(clip.poster), `missing poster: ${clip.poster}`);
        assert.equal(statSync(new URL(clip.video.slice(1), PUBLIC)).size, clip.bytes);
        assert.ok(clip.seconds > 0);
      }
    }
  }
});

// The old guild recording had 20 tracks while the revised teaching deck had 51 frames.
// Check the actual files and teaching slots so a partial import cannot reach learners.
test('the guild deck has a real image and matching narration entry for every slide', () => {
  const deck = deckFor('plant-guilds');
  assert.ok(deck);
  const tracks = COURSE_NARRATION['plant-guilds'].tracks;
  assert.deepEqual(deck.slides.map(s => s.slide), tracks.map(t => t.slide));
  for (const s of deck.slides) {
    assert.ok(onDisk(slideImageUrl('plant-guilds', 'en', s.slide)!));
    assert.ok(onDisk(slideAudioUrl('plant-guilds', 'en', s.slide)!));
  }
  const clips = deck.slides.flatMap(s => s.animation ? [s.animation.src] : []);
  assert.equal(new Set(clips).size, clips.length, 'each illustration is used once');
  for (const s of deck.slides.filter(s => s.animation)) {
    const urls = animationUrls('plant-guilds', s.slide)!;
    assert.ok(onDisk(urls.video));
    assert.ok(onDisk(urls.poster));
    assert.equal(statSync(new URL(urls.video.slice(1), PUBLIC)).size, urls.bytes);
  }
});

test('the branch-pruning clip is not presented as whole-plant thinning', () => {
  const deck = deckFor('plant-guilds')!;
  const pruning = deck.slides.find(s => s.title === 'Chop-and-Drop for Light and Mulch' && s.animation);
  assert.ok(pruning?.animation?.src.includes('Pruning-trimmed'));
  const thinning = deck.slides.filter(s => s.title === 'Thin as the Fruit Tree Grows');
  assert.equal(thinning.length, 1);
  assert.equal(thinning[0].animation, undefined, 'do not reuse the branch cut to claim a whole plant was removed');
});

test('isiZulu guild slides, audio and labelled video are delivered in the selected language', () => {
  for (const slide of deckFor('plant-guilds')!.slides) {
    assert.ok(onDisk(slideImageUrl('plant-guilds', 'zu', slide.slide)!));
    assert.ok(onDisk(slideAudioUrl('plant-guilds', 'zu', slide.slide)!));
    const animation = animationUrls('plant-guilds', slide.slide, 'zu');
    if (animation) {
      assert.ok(onDisk(animation.video));
      assert.ok(onDisk(animation.poster));
      assert.equal(statSync(new URL(animation.video.slice(1), PUBLIC)).size, animation.bytes);
    }
  }
  assert.match(animationUrls('plant-guilds', 23, 'zu')!.video, /Labelled-zu/);
  assert.doesNotMatch(animationUrls('plant-guilds', 23, 'en')!.video, /Labelled-zu/);
});

// Exercise the actual player with media-device stubs. The browser check separately verifies
// decoding and motion; these event-order checks catch a short voice cutting off a longer clip.
test('Water playback respects language gaps, download choice and the whole animation', async t => {
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  for (const videoFirst of [false, true]) {
    const videoDevice = { ended: false, currentTime: 0, play: () => Promise.resolve() };
    const audioDevice = { currentTime: 0, pause() {}, play: () => Promise.resolve() };
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(DeckPlayer, { moduleId: 'water-harvesting', lang: 'zu' }), {
      createNodeMock: element => element.type === 'video' ? videoDevice : element.type === 'audio' ? audioDevice : null,
    }); });
    try {
      assert.match(view.root.findByType('audio').props.src, /water-harvesting\/en\/slide-01.mp3$/);
      const messages = view.root.findAllByType('p').map(p => p.children.join('')).join(' ');
      assert.match(messages, /Narration is in English/);
      assert.match(messages, /isiZulu narration is not available/);
      assert.doesNotMatch(messages, /spoken lesson is in your language/);
      for (let i = 0; i < 3; i++) act(() => view.root.findAllByType('button').find(b => b.children.join('') === 'Next ›')!.props.onClick());
      assert.equal(view.root.findByType('h3').children.join(''), 'Watch: A Swale Sinks Water');
      assert.equal(view.root.findAllByType('video').length, 0, 'opening a Watch slide must not download video');
      const watch = view.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.join('').startsWith('Watch · ')))!;
      assert.ok(watch);
      act(() => watch.props.onClick());
      const clip = view.root.findByType('video');
      assert.equal(clip.parent!.props.style.aspectRatio, 824 / 720);
      assert.equal(clip.props.loop, false, 'a selected animation must be able to finish under play-through');
      const title = view.root.findByType('h3').children.join('');
      if (videoFirst) {
        videoDevice.ended = true;
        act(() => clip.props.onEnded());
      } else {
        act(() => view.root.findByType('audio').props.onEnded());
      }
      assert.equal(view.root.findByType('h3').children.join(''), title, 'wait for both teaching streams');
      if (videoFirst) act(() => view.root.findByType('audio').props.onEnded());
      else { videoDevice.ended = true; act(() => clip.props.onEnded()); }
      assert.match(view.root.findByType('audio').props.src, /slide-05.mp3$/, 'advance exactly one slide once both finish');
    } finally { act(() => view.unmount()); }
  }
});

test('a timed tour follows the voice after late loading, pause and seeking, then preserves its final hold', async t => {
  const componentUrl = new URL('../components/course/DeckPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'DeckPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    return nextLoad(url, context);
  } });
  const { default: DeckPlayer } = await import('../components/course/DeckPlayer.tsx');
  hooks.deregister();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const audio = { currentTime: 0, paused: true, ended: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  const video = { currentTime: 0, duration: 33.291667, readyState: 0, paused: true, ended: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(DeckPlayer, { moduleId: 'food-forest', lessonId: 'food-forest-l3', lang: 'en' }), {
    createNodeMock: element => element.type === 'video' ? video : element.type === 'audio' ? audio : null,
  }); });
  try {
    act(() => view.root.findAllByType('button').find(b => b.children.join('') === 'Next ›')!.props.onClick());
    assert.equal(view.root.findAllByType('video').length, 0, 'timed tours still require a download choice');
    audio.currentTime = 18;
    const watch = view.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.join('').startsWith('Watch · ')))!;
    act(() => watch.props.onClick());
    assert.equal(audio.currentTime, 0, 'choosing Watch during speech restarts this scene together');
    const clip = view.root.findByType('video');
    assert.equal(clip.props.controls, false, 'one set of playback controls governs the timed pair');
    audio.currentTime = 8;
    act(() => clip.props.onCanPlay());
    assert.equal(video.currentTime, 0, 'do not seek unloaded media');
    video.readyState = 4;
    act(() => clip.props.onCanPlay());
    assert.equal(video.currentTime, 8, 'late-loaded pictures must catch up to the spoken feature');
    assert.equal(video.paused, false);
    audio.paused = true;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.paused, true, 'paused speech must not leave highlights running');
    audio.currentTime = 18;
    act(() => view.root.findByType('audio').props.onSeeked());
    assert.equal(video.currentTime, 18, 'seeking speech must seek the matching visual');
    audio.paused = false;
    act(() => view.root.findByType('audio').props.onPlaying());
    assert.equal(video.paused, false);
    video.currentTime = 15;
    act(() => view.root.findByType('audio').props.onTimeUpdate());
    assert.equal(video.currentTime, 18, 'a stalled picture must not remain behind the voice');
    act(() => view.root.findByType('audio').props.onWaiting());
    assert.equal(video.paused, true, 'buffering speech must not let the visual run ahead');
    act(() => view.root.findAllByType('button').find(b => b.props['aria-label'] === 'Stop the lesson')!.props.onClick());
    assert.equal(view.root.findByType('video').props.controls, true, 'silent watching keeps its own controls');
    audio.currentTime = 12; audio.paused = false;
    act(() => view.root.findByType('audio').props.onPlaying());
    assert.equal(video.currentTime, 12, 'the native audio Play control must also synchronize the picture');
    assert.equal(view.root.findByType('video').props.controls, false);
    assert.equal(view.root.findByType('video').props.loop, false, 'a narrated tour must not loop behind the closing words');
    audio.paused = true;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.paused, true);
    act(() => view.root.findAllByType('button').find(b => b.props['aria-label'] === 'Play the lesson')!.props.onClick());
    audio.currentTime = 32.04; audio.paused = true; audio.ended = true; video.currentTime = 32;
    act(() => view.root.findByType('audio').props.onPause());
    assert.equal(video.currentTime, 32, 'the final hold must not jump back to a word boundary');
    assert.equal(video.paused, false, 'the final hold must be able to finish');
    act(() => view.root.findByType('audio').props.onEnded());
    assert.match(view.root.findByType('h3').children.join(''), /Young Food Forest/);
    video.ended = true;
    act(() => clip.props.onEnded());
    assert.equal(view.root.findByType('h3').children.join(''), 'Prepare a Manageable First Area');
  } finally { act(() => view.unmount()); }
});
