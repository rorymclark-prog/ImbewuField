import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  COURSE_NARRATION, allTracks, formatClock, fullNarrationUrl, hasNarration,
  moduleLevelTracks, narrationFor, resolveNarrationLang, trackTitle, tracksForLesson, trackUrl,
} from '../lib/course-audio.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';

const PUBLIC_AUDIO = join(process.cwd(), 'public', 'course-audio');
const pad2 = (n: number) => String(n).padStart(2, '0');

test('a module with no recording is a normal state, not an error', () => {
  assert.equal(hasNarration('intro-permaculture'), false);
  assert.equal(narrationFor('intro-permaculture'), null);
  assert.deepEqual(allTracks('intro-permaculture'), []);
  assert.deepEqual(tracksForLesson('intro-permaculture', 'intro-permaculture-l1'), []);
  assert.equal(trackUrl('intro-permaculture', 'zu', 1), null);
  assert.equal(resolveNarrationLang('intro-permaculture', 'zu'), null);
});

test('the seeds module is recorded in isiZulu and English', () => {
  assert.equal(hasNarration('seeds-sovereignty'), true);
  const n = narrationFor('seeds-sovereignty');
  assert.ok(n);
  assert.deepEqual([...n.languages].sort(), ['en', 'zu']);
  assert.equal(n.tracks.length, 10);
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

test('slides group under their lesson, with intro and recap held at module level', () => {
  assert.deepEqual(tracksForLesson('seeds-sovereignty', 'seeds-sovereignty-l1').map((t) => t.slide), [2, 3]);
  assert.deepEqual(tracksForLesson('seeds-sovereignty', 'seeds-sovereignty-l2').map((t) => t.slide), [4, 5, 6]);
  assert.deepEqual(tracksForLesson('seeds-sovereignty', 'seeds-sovereignty-l3').map((t) => t.slide), [7, 8, 9]);
  assert.deepEqual(moduleLevelTracks('seeds-sovereignty').map((t) => t.slide), [1, 10]);
  // Every slide is accounted for exactly once — no clip is orphaned out of the lesson view.
  assert.equal(allTracks('seeds-sovereignty').length, 10);
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
