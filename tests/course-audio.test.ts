import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { APP_GUIDES, appGuideNarrationSections } from '../lib/course-app-guides.ts';
import { join } from 'node:path';

import {
  APP_GUIDE_NARRATION, appGuideTrack, COURSE_NARRATION, availableNarrationLanguages, allTracks, formatClock, fullNarrationUrl, hasNarration,
  moduleLevelTracks, narrationFor, requiresExplicitNarrationChoice, resolveNarrationLang, trackTitle, tracksForLesson, trackUrl,
} from '../lib/course-audio.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { narrationReviewPending, REGIONAL_NARRATION_DRAFTS } from '../lib/narration-blockers.ts';

const PUBLIC_AUDIO = join(process.cwd(), 'public', 'course-audio');
const pad2 = (n: number) => String(n).padStart(2, '0');

test('a module with no recording is a normal state, not an error', () => {
  // The example used to be 'intro-permaculture', which flipped this test the day that module WAS
  // recorded — and every real module is on the recording schedule, so any real id here is a time
  // bomb. The behaviour under test is "absent from the manifest answers empty, never throws",
  // and these lookups never consult COURSE_MODULES, so an id no module will ever use pins it
  // permanently.
  const unrecorded = 'module-with-no-recording';
  assert.equal(hasNarration(unrecorded), false);
  assert.equal(narrationFor(unrecorded), null);
  assert.deepEqual(allTracks(unrecorded), []);
  assert.deepEqual(tracksForLesson(unrecorded, 'intro-permaculture-l1'), []);
  assert.equal(trackUrl(unrecorded, 'zu', 1), null);
  assert.equal(resolveNarrationLang(unrecorded, 'zu'), null);
});

test('the seeds module is recorded in isiZulu and English', () => {
  assert.equal(hasNarration('seeds-sovereignty'), true);
  const n = narrationFor('seeds-sovereignty');
  assert.ok(n);
  assert.deepEqual([...n.languages].sort(), ['en', 'zu']);

  // Slide numbers must be 1..N with no gap and no repeat. This replaced a hardcoded
  // `tracks.length === 10`, which was a snapshot of one recording rather than a rule: when the
  // module was re-cut from 10 slides to 24 the assertion failed while nothing was actually
  // wrong, and a test that cries wolf on a legitimate re-record teaches people to edit the
  // number and move on. A GAP is the thing worth catching — it means a missing clip, which is
  // a dead player button for a farmer on a metered connection.
  const slides = n.tracks.map((t) => t.slide);
  assert.deepEqual(slides, [...slides].sort((a, b) => a - b), 'tracks must be in slide order');
  assert.deepEqual(slides, Array.from({ length: slides.length }, (_, i) => i + 1), 'slides must run 1..N with no gaps');
});

test('Market isiZulu audio is exposed as a pending review draft with all slide mappings', () => {
  const narration = narrationFor('market-community');
  assert.ok(narration);
  assert.ok(narration.languages.includes('zu'));
  assert.equal(narrationReviewPending('market-community', 'zu'), true);
  assert.equal(narrationReviewPending('market-community', 'en'), false);
  assert.deepEqual(narration.tracks.map((track) => track.slide), Array.from({ length: 20 }, (_, i) => i + 1));
  const script = readFileSync(join(process.cwd(), 'docs/narration/market-community.zu.md'), 'utf8');
  const zuluHeadings = new Map(
    [...script.matchAll(/^\*\*Ikhasi\s+(\d+)\s+[—-]\s+(.+?)\s+\(Slide\s+\d+\s+[—-][^)]+\)\*\*$/gm)]
      .map((heading) => [Number(heading[1]), heading[2]] as const),
  );
  for (const track of narration.tracks) {
    assert.equal(trackTitle(track, 'zu'), zuluHeadings.get(track.slide),
      `slide ${track.slide}: the isiZulu player caption must match the current narration heading`);
  }
  assert.deepEqual(
    narration.tracks.map((track) => track.lesson),
    [null, null, null, ...Array(5).fill('market-community-l1'), ...Array(5).fill('market-community-l2'), ...Array(5).fill('market-community-l3'), null, null],
  );
});

test('language resolution prefers the app language, then English, and reports the swap', () => {
  assert.deepEqual(resolveNarrationLang('seeds-sovereignty', 'zu'), { lang: 'zu', exact: true });
  assert.deepEqual(resolveNarrationLang('seeds-sovereignty', 'en'), { lang: 'en', exact: true });
  // Sesotho is not recorded — fall back to English, and say it is not exact so the UI can
  // tell the learner rather than quietly playing the wrong language at them.
  assert.deepEqual(resolveNarrationLang('seeds-sovereignty', 'st'), { lang: 'en', exact: false });
});

test('URLs exist for current exact clips, while held ZU words cannot bypass the per-slide review gate', () => {
  assert.equal(trackUrl('seeds-sovereignty', 'zu', 7), '/course-audio/seeds-sovereignty/zu/slide-07.mp3');
  assert.equal(trackUrl('seeds-sovereignty', 'en', 1), '/course-audio/seeds-sovereignty/en/slide-01.mp3');
  assert.equal(trackUrl('seeds-sovereignty', 'zu', 11), null,
    'a clip containing the independently flagged boiling/fermentation mismatch is not offered');
  assert.equal(fullNarrationUrl('seeds-sovereignty', 'zu'), null,
    'the continuous isiZulu track would bypass multiple held slide boundaries');
  assert.equal(fullNarrationUrl('seeds-sovereignty', 'en'), '/course-audio/seeds-sovereignty/en/full.mp3');
  assert.equal(existsSync(join(PUBLIC_AUDIO, 'seeds-sovereignty', 'zu', 'full.mp3')), true,
    'the review gate withholds the URL without deleting or rewriting the recorded file');
  assert.equal(trackUrl('seeds-sovereignty', 'st', 1), null, 'unrecorded language must not produce a url');
  assert.equal(trackUrl('seeds-sovereignty', 'zu', 99), null, 'unknown slide must not produce a url');
  assert.equal(trackUrl('no-such-module', 'zu', 1), null);
});

async function loadAudioPlayer() {
  const componentUrl = new URL('../components/course/CourseAudioPlayer.tsx', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      fileName: 'CourseAudioPlayer.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
    return nextLoad(url, context);
  } });
  const { default: CourseAudioPlayer } = await import('../components/course/CourseAudioPlayer.tsx');
  hooks.deregister();
  return CourseAudioPlayer;
}

// Exercise the player instead of pinning its source spelling: a green regex
// could leave autoplay speaking the withheld recording despite a disabled row.
test('the audio player stops before held isiZulu rows and English remains an explicit choice', async () => {
  const CourseAudioPlayer = await loadAudioPlayer();
  let plays = 0;
  const device = { src: '', paused: true, currentTime: 0, pause() { this.paused = true; }, play() { plays++; this.paused = false; return Promise.resolve(); }, load() {}, removeAttribute() { this.src = ''; } };
  const tracks = COURSE_NARRATION['seeds-sovereignty'].tracks.filter(track => [10, 11, 12].includes(track.slide));
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(CourseAudioPlayer, { moduleId: 'seeds-sovereignty', appLang: 'zu', tracks }), {
    createNodeMock: element => element.type === 'audio' ? device : null,
  }); });
  try {
    const rows = () => view.root.findAllByType('li').map(row => row.findByType('button'));
    assert.equal(rows()[0].props.disabled, false);
    assert.equal(rows()[1].props.disabled, true);
    assert.equal(rows()[2].props.disabled, true);
    act(() => rows()[0].props.onClick());
    assert.match(device.src, /zu\/slide-10.mp3$/);
    assert.equal(plays, 1);
    act(() => view.root.findByType('audio').props.onEnded());
    assert.equal(plays, 1, 'autoplay cannot speak held slide 11 or skip it to another instruction');
    act(() => rows()[1].props.onClick());
    assert.equal(plays, 1, 'even a stale click handler cannot play the held row');
    const voices = view.root.findByProps({ role: 'group', 'aria-label': 'Narration language' }).findAllByType('button');
    act(() => voices.find(button => button.children.join('') === 'isiNgisi')!.props.onClick());
    assert.equal(rows()[1].props.disabled, false);
    act(() => rows()[1].props.onClick());
    assert.match(device.src, /en\/slide-11.mp3$/);
    assert.equal(plays, 2, 'English only starts after the learner explicitly selects and plays it');
  } finally { act(() => view.unmount()); }
});

test('track titles fall back to English when a language has no translated title', () => {
  const t = { slide: 1, title: 'Recap', titleByLang: { zu: 'Ukubuyekeza' }, lesson: null };
  assert.equal(trackTitle(t, 'zu'), 'Ukubuyekeza');
  assert.equal(trackTitle(t, 'en'), 'Recap');
  assert.equal(trackTitle(t, 'st'), 'Recap');
  assert.equal(trackTitle({ slide: 2, title: 'Only English', lesson: null }, 'zu'), 'Only English');
});

test('slides group under their lesson, with intro and field work held at module level', () => {
  // The partition is what matters, not which slide lands where. This used to assert the exact
  // slide list per lesson, which is a snapshot of one deck: re-cutting the module from 10 slides
  // to 24 broke it while everything was correct. The rule that actually protects a learner is
  // that every recorded clip is reachable from exactly one place in the UI — a clip belonging to
  // two lessons plays twice, and a clip belonging to none is paid-for narration nobody can hear.
  const all = allTracks('seeds-sovereignty').map((t) => t.slide);
  assert.ok(all.length >= 3, 'the module is recorded');

  const lessonSlides = ['l1', 'l2', 'l3'].flatMap((l) =>
    tracksForLesson('seeds-sovereignty', `seeds-sovereignty-${l}`).map((t) => t.slide),
  );
  const moduleSlides = moduleLevelTracks('seeds-sovereignty').map((t) => t.slide);
  const covered = [...lessonSlides, ...moduleSlides].sort((a, b) => a - b);

  assert.deepEqual(covered, [...all].sort((a, b) => a - b), 'every slide is reachable exactly once');
  assert.equal(new Set(covered).size, covered.length, 'no slide appears under two lessons');

  // Lessons must not INTERLEAVE — everything in l1 comes before everything in l2, and so on.
  //
  // Not "consecutive": that stricter rule was tried first and was wrong. Slide 3 is Learning
  // Outcomes and sits at module level BETWEEN l1's slides 2 and 4, which is exactly how the deck
  // should read. A lesson's slides may legitimately have module-level slides threaded through
  // them. What would be a genuine defect is a lesson reaching back past another one — that means
  // a mis-mapped `lesson:` field, and the learner sees a track from lesson 3 sitting inside
  // lesson 1.
  const ranges = ['l1', 'l2', 'l3']
    .map((l) => tracksForLesson('seeds-sovereignty', `seeds-sovereignty-${l}`).map((t) => t.slide))
    .filter((s) => s.length > 0);

  for (let i = 1; i < ranges.length; i++) {
    const prevMax = Math.max(...ranges[i - 1]);
    const thisMin = Math.min(...ranges[i]);
    assert.ok(prevMax < thisMin, `lesson ${i + 1} starts at slide ${thisMin}, before lesson ${i} ends at ${prevMax}`);
  }
});

test('formatClock survives what an <audio> element reports before metadata loads', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(9), '0:09');
  assert.equal(formatClock(92), '1:32');
  assert.equal(formatClock(3600), '60:00');
  assert.equal(formatClock(Number.NaN), '0:00');
  assert.equal(formatClock(Number.POSITIVE_INFINITY), '0:00');
  assert.equal(formatClock(-5), '0:00');
});

// ─── Guards against the manifest and the real files drifting apart ───────────

test('every module and lesson id in the manifest is real', () => {
  const moduleIds = new Set(COURSE_MODULES.map((m) => m.id));
  const lessonIds = new Set(COURSE_MODULES.flatMap((m) => (m.lessons ?? []).map((l) => l.id)));
  for (const [moduleId, n] of Object.entries(COURSE_NARRATION)) {
    assert.ok(moduleIds.has(moduleId), `narration references unknown module: ${moduleId}`);
    for (const track of n.tracks) {
      if (track.lesson === null) continue;
      assert.ok(lessonIds.has(track.lesson), `slide ${track.slide} references unknown lesson: ${track.lesson}`);
    }
  }
});

test('slide numbers are unique within a module', () => {
  for (const [moduleId, n] of Object.entries(COURSE_NARRATION)) {
    const slides = n.tracks.map((t) => t.slide);
    assert.equal(new Set(slides).size, slides.length, `duplicate slide number in ${moduleId}`);
  }
});

test('every clip the manifest promises exists on disk', () => {
  for (const [moduleId, n] of Object.entries(COURSE_NARRATION)) {
    if (n.baseUrl) continue; // hosted elsewhere — nothing local to check
    for (const lang of n.languages) {
      for (const track of n.tracks) {
        const file = join(PUBLIC_AUDIO, moduleId, lang, `slide-${pad2(track.slide)}.mp3`);
        assert.ok(existsSync(file), `manifest promises a clip that is not on disk: ${file}`);
      }
      assert.ok(
        existsSync(join(PUBLIC_AUDIO, moduleId, lang, 'full.mp3')),
        `missing full narration for ${moduleId}/${lang}`,
      );
    }
  }
});

test('every clip on disk is claimed by the manifest', () => {
  if (!existsSync(PUBLIC_AUDIO)) return;
  for (const moduleId of readdirSync(PUBLIC_AUDIO)) {
    const n = COURSE_NARRATION[moduleId];
    assert.ok(n, `audio on disk for a module the manifest does not know: ${moduleId}`);
    const modDir = join(PUBLIC_AUDIO, moduleId);
    for (const lang of readdirSync(modDir)) {
      assert.ok(n.languages.includes(lang), `${moduleId}: audio for unlisted language ${lang}`);
      const known = new Set(n.tracks.map((t) => `slide-${pad2(t.slide)}.mp3`));
      known.add('full.mp3');
      for (const file of readdirSync(join(modDir, lang))) {
        if (!file.endsWith('.mp3')) continue;
        assert.ok(known.has(file), `${moduleId}/${lang}: orphan clip not in the manifest: ${file}`);
      }
    }
  }
});

test('regional machine narration stays bound to its paired source and the published audio bytes', () => {
  // A text correction must invalidate the recording. This catches a real learner-facing drift:
  // a slide can show a safer English hold while an older voice still speaks the rejected draft.
  for (const [key, draft] of Object.entries(REGIONAL_NARRATION_DRAFTS)) {
    const [moduleId, lang] = key.split('.');
    const pairedBytes = readFileSync(join(process.cwd(), draft.sourcePair));
    assert.equal(createHash('sha256').update(pairedBytes).digest('hex'), draft.sourcePairSha256);
    const paired = JSON.parse(pairedBytes.toString('utf8'));
    const record = JSON.parse(readFileSync(join(process.cwd(), draft.verificationRecord), 'utf8'));
    assert.equal(record.reviewStatus, 'unreviewed-machine-audio');
    assert.equal(record.fluentReview, 'pending');
    assert.equal(record.localFarmingReview, 'pending');
    assert.equal(record.listeningReview, 'pending');
    assert.equal(record.sourcePairSha256, draft.sourcePairSha256);
    assert.equal(record.slides.length, paired.slides.length);
    assert.ok(COURSE_NARRATION[moduleId].languages.includes(lang));
    assert.equal(narrationReviewPending(moduleId, lang), true);
    let translated = 0, held = 0;
    for (const slide of record.slides) {
      const source = paired.slides[slide.slide - 1];
      const spoken = source.target.body.map((body: { status: string; text?: string }, index: number) =>
        body.status === 'draft' ? body.text : source.english.body[index]).join('\n\n');
      assert.equal(slide.spokenText, spoken, `slide ${slide.slide}: voice text must match the pictured source pair`);
      translated += slide.draftParagraphs;
      held += slide.englishHolds;
      assert.equal(createHash('sha256').update(readFileSync(join(PUBLIC_AUDIO, moduleId, lang,
        `slide-${pad2(slide.slide)}.mp3`))).digest('hex'), slide.audioSha256);
    }
    assert.equal(translated, draft.draftParagraphs);
    assert.equal(held, draft.englishHolds);
    assert.equal(createHash('sha256').update(readFileSync(join(PUBLIC_AUDIO, moduleId, lang, 'full.mp3')))
      .digest('hex'), record.fullNarration.audioSha256);
  }
});


const GUIDE_AUDIO = join(process.cwd(), 'public', 'app-guide-audio');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

test('every app guide has complete narration matching its current instructions and audio bytes', () => {
  assert.deepEqual(Object.keys(APP_GUIDE_NARRATION).sort(), APP_GUIDES.map(g => g.id).sort());
  for (const guide of APP_GUIDES) {
    const recording = APP_GUIDE_NARRATION[guide.id];
    const sections = appGuideNarrationSections(guide);
    assert.equal(recording.language, 'en', 'do not silently offer an English recording as isiZulu');
    assert.deepEqual(recording.tracks.map(t => t.section), sections.map(s => s.id), `${guide.id}: missing, duplicated or reordered section`);
    for (const section of sections) {
      const track = appGuideTrack(guide.id, section.id);
      assert.ok(track, `${guide.id}/${section.id}: missing player source`);
      assert.equal(track.sourceSha256, hash(section.text), `${guide.id}/${section.id}: narration is stale after a text change`);
      // The version query is a cache identity, not part of the public filename.
      const bytes = readFileSync(join(process.cwd(), 'public', new URL(track.url, 'https://field.test').pathname));
      assert.equal(track.bytes, bytes.length, 'the learner must see the actual download size');
      assert.equal(track.audioSha256, hash(bytes), `${guide.id}/${section.id}: audio changed after its verification`);
      assert.ok(Number.isFinite(track.seconds) && track.seconds > 0);
    }
  }
});

test('unclaimed guide recordings cannot silently ship or create dead player links', () => {
  const promised = new Set(Object.entries(APP_GUIDE_NARRATION).flatMap(([guide, n]) => n.tracks.map(t => `${guide}/${t.section}.mp3`)));
  const actual = new Set(readdirSync(GUIDE_AUDIO, { recursive: true }).filter(p => typeof p === 'string' && p.endsWith('.mp3')));
  assert.deepEqual(actual, promised);
  assert.equal(appGuideTrack('unknown-guide', 'prepare'), null);
  assert.equal(appGuideTrack(APP_GUIDES[0].id, 'unknown-section'), null);
});

test('the question recording excludes feedback and each feedback clip belongs to its chosen answer', () => {
  for (const guide of APP_GUIDES) {
    const sections = appGuideNarrationSections(guide);
    const question = sections.find(s => s.id === 'practice')!;
    for (const [index, choice] of guide.practice.choices.entries()) {
      assert.ok(question.text.includes(choice.label));
      assert.ok(!question.text.includes(choice.feedback), `${guide.id}: the question gives away feedback before an answer`);
      const feedback = sections.find(s => s.afterChoice === index);
      assert.ok(feedback);
      assert.equal(feedback.text, choice.feedback);
    }
  }
});

test('every regional module without a compatible current voice requires selection while English and isiZulu keep defaults', () => {
  for (const [moduleId, narration] of Object.entries(COURSE_NARRATION)) {
    for (const appLang of ['en', 'zu', 'st', 've', 'ts']) {
      // 2026-10-06: archived recordings remain owned; only the current pair authorizes a voice.
      const own = availableNarrationLanguages(moduleId).includes(appLang);
      const explicit = requiresExplicitNarrationChoice(moduleId, appLang);
      assert.equal(explicit, ['st', 've', 'ts'].includes(appLang) && !own, `${moduleId}/${appLang}`);
      const choice = explicit ? null : resolveNarrationLang(moduleId, appLang)?.lang;
      if (['en', 'zu'].includes(appLang) || own) assert.equal(choice, resolveNarrationLang(moduleId, appLang)?.lang);
      else assert.equal(choice, null, 'fallback availability cannot select English for a regional reader');
    }
  }
  assert.equal(requiresExplicitNarrationChoice('intro-permaculture', 'st'), true);
  assert.ok(COURSE_NARRATION['intro-permaculture'].languages.includes('st'), 'archived voice remains owned');
  assert.equal(trackUrl('intro-permaculture', 'st', 22), null);
});

test('regional playlist stays visible and silent until a voice is selected, and stale playback cannot survive an app-language change', async () => {
  const CourseAudioPlayer = await loadAudioPlayer();
  for (const initialLang of ['st', 've', 'ts']) {
    let plays = 0;
    let finishPlay!: () => void;
    let failPlay!: (reason: Error) => void;
    const device = {
      src: '', paused: true, currentTime: 0,
      pause() { this.paused = true; },
      play() { plays++; this.paused = false; return new Promise<void>((resolve, reject) => { finishPlay = resolve; failPlay = reject; }); },
      load() {}, removeAttribute() { this.src = ''; },
    };
    const tracks = COURSE_NARRATION['soil-health'].tracks.slice(0, 2);
    let view!: ReactTestRenderer;
    const props = (appLang: string) => ({ moduleId: 'soil-health', appLang, tracks });
    act(() => { view = create(createElement(CourseAudioPlayer, props(initialLang)), { createNodeMock: e => e.type === 'audio' ? device : null }); });
    const rows = () => view.root.findAllByType('li').map(row => row.findByType('button'));
    const voice = (text: string) => view.root.findAllByType('button').find(b => b.children.join('') === text)!;
    try {
      assert.equal(voice('English source narration').props['aria-pressed'], false);
      assert.equal(voice('No narration').props['aria-pressed'], true);
      assert.ok(rows().every(row => row.props.disabled));
      assert.equal(view.root.findByType('audio').props.preload, 'none');
      act(() => rows()[0].props.onClick());
      assert.equal(plays, 0, 'even a stale enabled-row callback cannot select fallback audio');
      assert.equal(device.src, '');
      act(() => voice('English source narration').props.onClick());
      assert.equal(voice('English source narration').props['aria-pressed'], true);
      assert.equal(plays, 0, 'choosing English does not fetch or play a track');
      assert.ok(rows().every(row => !row.props.disabled));
      const oldPlay = rows()[0].props.onClick;
      act(() => oldPlay());
      assert.equal(plays, 1);
      assert.match(device.src, /soil-health\/en\/slide-01.mp3$/);
      const oldEnded = view.root.findByType('audio').props.onEnded;
      const oldOnPlay = view.root.findByType('audio').props.onPlay;
      const oldError = view.root.findByType('audio').props.onError;
      const oldTime = view.root.findByType('audio').props.onTimeUpdate;
      const oldMetadata = view.root.findByType('audio').props.onLoadedMetadata;
      const nextLang = initialLang === 'st' ? 've' : 'st';
      act(() => view.update(createElement(CourseAudioPlayer, props(nextLang))));
      assert.equal(device.paused, true);
      assert.equal(device.src, '', 'app-language changes remove the old URL, not only its pressed state');
      assert.equal(voice('English source narration').props['aria-pressed'], false);
      assert.equal(voice('No narration').props['aria-pressed'], true);
      act(() => { oldPlay(); oldEnded(); oldOnPlay(); oldError();
        oldTime({ currentTarget: { currentTime: 99 } });
        oldMetadata({ currentTarget: { duration: 999 } }); });
      await act(async () => {
        if (initialLang === 've') failPlay(new Error('Old request cancelled'));
        else finishPlay();
        await Promise.resolve();
      });
      assert.equal(plays, 1, 'old Play, ended and delayed play completion cannot resume or advance');
      assert.equal(device.src, '');
      assert.equal(device.paused, true, 'a late play event is paused when no voice was selected');
      assert.ok(rows().every(row => row.props.disabled));
      assert.ok(rows().every(row => row.props['aria-label'].startsWith('Play')));
    } finally { act(() => view.unmount()); }
  }
});

test('English and isiZulu retain own defaults while the new Sesotho Intro pair selects silence', async () => {
  const CourseAudioPlayer = await loadAudioPlayer();
  for (const appLang of ['en', 'zu', 'st']) {
    const device = { src: '', paused: true, pause() {}, load() {}, removeAttribute() { this.src = ''; } };
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(CourseAudioPlayer, { moduleId: 'intro-permaculture', appLang, tracks: COURSE_NARRATION['intro-permaculture'].tracks }), { createNodeMock: e => e.type === 'audio' ? device : null }); });
    try {
      const voices = view.root.findAllByType('button').filter(b => b.props['aria-pressed'] !== undefined);
      assert.equal(voices.filter(b => b.props['aria-pressed']).length, 1);
      assert.equal(voices.find(b => b.props['aria-pressed'])!.children.join(''), appLang === 'st' ? 'No narration' : appLang === 'zu' ? 'isiZulu' : 'English');
      assert.equal(device.src, '', 'selected own narration still does not preload');
      if (appLang === 'st') {
        assert.equal(view.root.findAllByType('li').length, 22);
        const copy = view.root.findAllByType('p').map(p => p.children.join('')).join('\n');
        assert.ok(view.root.findAllByType('li').every(row => row.findByType('button').props.disabled));
        assert.ok(!voices.some(b => b.children.join('') === 'Sesotho AI draft + English'), 'archived voice cannot label the updated pair');
        assert.equal(voices.find(b => b.children.join('') === 'English source narration')?.props['aria-pressed'], false);
      }
      if (appLang === 'zu') assert.match(view.root.findAllByType('p').map(p => p.children.join('')).join('\n'), /awaiting review|usalindele ukubuyekezwa/);
    } finally { act(() => view.unmount()); }
  }
});

test('No narration clears active English playback and ignores old ended/error/metadata callbacks without hiding the choices', async () => {
  const CourseAudioPlayer = await loadAudioPlayer();
  let plays = 0;
  const device = { src: '', paused: true, pause() { this.paused = true; }, play() { plays++; this.paused = false; return Promise.resolve(); }, load() {}, removeAttribute() { this.src = ''; } };
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(CourseAudioPlayer, { moduleId: 'soil-health', appLang: 'st', tracks: COURSE_NARRATION['soil-health'].tracks.slice(0, 2) }), { createNodeMock: e => e.type === 'audio' ? device : null }); });
  const rows = () => view.root.findAllByType('li').map(row => row.findByType('button'));
  const voice = (text: string) => view.root.findAllByType('button').find(b => b.children.join('') === text)!;
  try {
    act(() => voice('English source narration').props.onClick());
    assert.doesNotMatch(view.root.findAllByType('p').map(p => p.children.join('')).join('\n'), /playing English/);
    await act(async () => { rows()[0].props.onClick(); await Promise.resolve(); });
    assert.equal(device.paused, false);
    assert.ok(rows()[0].props['aria-label'].startsWith('Pause'));
    const old = view.root.findByType('audio').props;
    act(() => voice('No narration').props.onClick());
    assert.equal(device.paused, true);
    assert.equal(device.src, '');
    act(() => {
      old.onEnded(); old.onError(); old.onPlay();
      old.onTimeUpdate({ currentTarget: { currentTime: 99 } });
      old.onLoadedMetadata({ currentTarget: { duration: 999 } });
    });
    assert.equal(plays, 1);
    assert.equal(device.src, '');
    assert.ok(rows().every(row => row.props.disabled));
    assert.equal(voice('English source narration').props['aria-pressed'], false);
    assert.equal(voice('No narration').props['aria-pressed'], true);
    const text = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : node?.children ? text(node.children) : '';
    const output = text(view.toJSON());
    assert.doesNotMatch(output, /playing English|99|999|Could not play/);
    act(() => voice('English source narration').props.onClick());
    assert.ok(rows().every(row => !row.props.disabled));
    assert.equal(plays, 1, 'selecting the optional voice still requires Play');
  } finally { act(() => view.unmount()); }
});

test('Sesotho Intro advances optional English only after explicit selection and Play', async () => {
  const CourseAudioPlayer = await loadAudioPlayer();
  let plays = 0;
  const device = { src: '', paused: true, pause() { this.paused = true; }, play() { plays++; this.paused = false; return Promise.resolve(); }, load() {}, removeAttribute() { this.src = ''; } };
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(CourseAudioPlayer, { moduleId: 'intro-permaculture', appLang: 'st', tracks: COURSE_NARRATION['intro-permaculture'].tracks.slice(0, 2) }), { createNodeMock: e => e.type === 'audio' ? device : null }); });
  try {
    // 2026-10-06: new silent pair cannot use the archived ST recording; playlist behavior remains covered.
    assert.equal(device.src, '');
    assert.ok(view.root.findAllByType('li').every(row => row.findByType('button').props.disabled));
    act(() => view.root.findAllByType('button').find(b => b.children.join('') === 'English source narration')!.props.onClick());
    assert.equal(plays, 0);
    await act(async () => { view.root.findAllByType('li')[0].findByType('button').props.onClick(); await Promise.resolve(); });
    assert.equal(device.src, '/course-audio/intro-permaculture/en/slide-01.mp3');
    await act(async () => { view.root.findByType('audio').props.onEnded(); await Promise.resolve(); });
    assert.equal(device.src, '/course-audio/intro-permaculture/en/slide-02.mp3');
    assert.equal(plays, 2);
    act(() => view.root.findByType('audio').props.onEnded());
    assert.equal(plays, 2, 'the playlist stops at its end');
  } finally { act(() => view.unmount()); }
});
