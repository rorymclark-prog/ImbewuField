import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { APP_GUIDES, appGuideNarrationSections } from '../lib/course-app-guides.ts';
import { join } from 'node:path';

import {
  APP_GUIDE_NARRATION, appGuideTrack, COURSE_NARRATION, allTracks, formatClock, fullNarrationUrl, hasNarration,
  moduleLevelTracks, narrationFor, resolveNarrationLang, trackTitle, tracksForLesson, trackUrl,
} from '../lib/course-audio.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { narrationReviewPending } from '../lib/narration-blockers.ts';

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

test('urls are only produced for a language and slide that actually exist', () => {
  assert.equal(trackUrl('seeds-sovereignty', 'zu', 7), '/course-audio/seeds-sovereignty/zu/slide-07.mp3');
  assert.equal(trackUrl('seeds-sovereignty', 'en', 1), '/course-audio/seeds-sovereignty/en/slide-01.mp3');
  assert.equal(fullNarrationUrl('seeds-sovereignty', 'zu'), '/course-audio/seeds-sovereignty/zu/full.mp3');
  assert.equal(trackUrl('seeds-sovereignty', 'st', 1), null, 'unrecorded language must not produce a url');
  assert.equal(trackUrl('seeds-sovereignty', 'zu', 99), null, 'unknown slide must not produce a url');
  assert.equal(trackUrl('no-such-module', 'zu', 1), null);
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
