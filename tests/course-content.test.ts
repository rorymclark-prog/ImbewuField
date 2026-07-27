// Guards over the optional visual-asset fields on Lesson (infographicUrl/Alt, videoUrl,
// relatedLessonIds) — see lib/course-modules.ts and docs/COURSE-VISUAL-ASSETS.md.
//
// These fields are free-form data added by hand, not generated, so nothing stops a typo'd
// lesson id or a missing alt text from being committed. This file is what catches that in CI
// instead of a farmer finding it as a dead button or a broken image on their phone.

import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES, LESSON_INDEX } from '../lib/course-modules.ts';

test('every module id is unique', () => {
  const ids = COURSE_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate module id found in COURSE_MODULES');
});

test('every lesson id is unique across all modules', () => {
  const ids = COURSE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length, 'duplicate lesson id found across modules');
});

test('every existing lesson still satisfies the base shape after extending Lesson with optional fields', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      assert.equal(typeof lesson.id, 'string');
      assert.ok(lesson.id.length > 0, `${mod.id}: a lesson has an empty id`);
      assert.equal(typeof lesson.title, 'string');
      assert.ok(lesson.title.length > 0, `${lesson.id}: empty title`);
      assert.equal(typeof lesson.body, 'string');
      assert.ok(lesson.body.length > 0, `${lesson.id}: empty body`);
      assert.ok(Array.isArray(lesson.keyPoints), `${lesson.id}: keyPoints is not an array`);
      assert.ok(Array.isArray(lesson.quiz), `${lesson.id}: quiz is not an array`);
    }
  }
});

test('infographicUrl is always paired with a non-empty infographicAlt', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      if (lesson.infographicUrl) {
        assert.ok(
          lesson.infographicAlt && lesson.infographicAlt.trim().length > 0,
          `${lesson.id}: infographicUrl is set but infographicAlt is missing or empty`,
        );
      }
      if (lesson.infographicAlt) {
        assert.ok(
          lesson.infographicUrl,
          `${lesson.id}: infographicAlt is set with no infographicUrl for it to describe`,
        );
      }
    }
  }
});

test('no lesson lists itself in relatedLessonIds', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      assert.ok(
        !(lesson.relatedLessonIds ?? []).includes(lesson.id),
        `${lesson.id} lists itself in relatedLessonIds`,
      );
    }
  }
});

test('every relatedLessonIds entry resolves to a real lesson somewhere in COURSE_MODULES', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      for (const relatedId of lesson.relatedLessonIds ?? []) {
        assert.ok(
          LESSON_INDEX.has(relatedId),
          `${lesson.id} references a related lesson that does not exist: "${relatedId}"`,
        );
      }
    }
  }
});

test('relatedLessonIds has no duplicate entries within one lesson', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      const ids = lesson.relatedLessonIds ?? [];
      assert.equal(new Set(ids).size, ids.length, `${lesson.id}: duplicate id in relatedLessonIds`);
    }
  }
});

test('LESSON_INDEX contains exactly the real lessons, keyed by id, pointing at their owning module', () => {
  const allIds = COURSE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(LESSON_INDEX.size, allIds.length);
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      const entry = LESSON_INDEX.get(lesson.id);
      assert.ok(entry, `LESSON_INDEX is missing ${lesson.id}`);
      assert.equal(entry.moduleId, mod.id);
      assert.equal(entry.lesson.id, lesson.id);
    }
  }
});

// ─── A synthetic fixture proves the guards above actually fire on bad data, not just pass ───
// vacuously on a real catalog that happens to set none of these optional fields yet.

test('the pairing and cross-link guards actually catch bad data (synthetic fixture)', () => {
  const badLessons = [
    { id: 'fx-1', title: 't', body: 'b', keyPoints: [], quiz: [], infographicUrl: '/x.jpg' }, // no alt
    { id: 'fx-2', title: 't', body: 'b', keyPoints: [], quiz: [], infographicAlt: 'alt only' }, // no url
    { id: 'fx-3', title: 't', body: 'b', keyPoints: [], quiz: [], relatedLessonIds: ['fx-3'] }, // self-reference
    { id: 'fx-4', title: 't', body: 'b', keyPoints: [], quiz: [], relatedLessonIds: ['nope-not-real'] }, // dangling
  ];
  const fixtureIndex = new Map(badLessons.map((l) => [l.id, l] as const));

  const pairingFailures = badLessons.filter(
    (l) => Boolean(l.infographicUrl) !== Boolean(l.infographicAlt),
  );
  assert.deepEqual(pairingFailures.map((l) => l.id).sort(), ['fx-1', 'fx-2'].sort());

  const selfRefFailures = badLessons.filter((l) => (l.relatedLessonIds ?? []).includes(l.id));
  assert.deepEqual(selfRefFailures.map((l) => l.id), ['fx-3']);

  const danglingFailures = badLessons.filter(
    (l) => (l.relatedLessonIds ?? []).some((id) => !fixtureIndex.has(id) && id !== l.id),
  );
  assert.deepEqual(danglingFailures.map((l) => l.id), ['fx-4']);
});
