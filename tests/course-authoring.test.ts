import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';

// These guards are for the person WRITING a lesson, not for the code that renders one.
//
// course-content.test.ts already protects the shape of the collection — unique ids, cross-links
// that resolve, an infographic never without its alt text. What it does not check is whether a
// lesson is answerable, and that is the half that breaks when somebody adds or edits content.
//
// The worst case is specific and silent. `quiz.correct` is an index into `options`, and it travels
// untouched from the data to <QuizQuestion correct={q.correct}> in app/student/page.tsx. Nothing
// between them looks at it. Write `correct: 3` against three options — an ordinary off-by-one, and
// the single easiest mistake to make when reordering answers — and the lesson still builds, still
// renders, still looks completely normal, and no farmer can ever get it right. There is no error
// anywhere; the only symptom is a student failing a quiz they answered correctly.
//
// The images fail quietly in a second way. A lesson counts as "illustrated" in course-readiness.ts
// on the strength of the URL STRING alone, so `npm run course:status` will report a module fully
// illustrated whose files do not exist — the one dashboard that says what is left to produce,
// confidently wrong. The same URL is also pushed into the offline download bundle by
// offline-pack.ts, so a typo ships a 404 inside the pack a farmer downloaded precisely because
// they have no connection to re-fetch it with.
//
// Everything here passed on the day it was written (33 images present, 66 quiz questions valid).
// That is the point: it is not fixing content, it is making sure the NEXT edit cannot break it
// without saying so.

const allLessons: { module: string; lesson: Lesson }[] = COURSE_MODULES.flatMap((m) =>
  m.lessons.map((lesson) => ({ module: m.id, lesson })),
);

test('every quiz question has a correct answer that actually exists', () => {
  const broken: string[] = [];
  for (const { module, lesson } of allLessons) {
    lesson.quiz.forEach((q, i) => {
      const ok = Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length;
      if (!ok) {
        broken.push(
          `${module}/${lesson.id} q${i + 1}: correct=${q.correct} but there are ` +
            `${q.options.length} options (valid 0..${q.options.length - 1})`,
        );
      }
    });
  }
  assert.deepEqual(broken, [], 'a quiz no farmer can pass');
});

test('every quiz question offers a real choice', () => {
  const bad: string[] = [];
  for (const { module, lesson } of allLessons) {
    lesson.quiz.forEach((q, i) => {
      const where = `${module}/${lesson.id} q${i + 1}`;
      if (q.options.length < 2) bad.push(`${where}: only ${q.options.length} option(s)`);
      if (q.options.some((o) => !o || !o.trim())) bad.push(`${where}: has a blank option`);
      if (new Set(q.options).size !== q.options.length) bad.push(`${where}: repeats an option`);
      // A repeated option is worse than untidy: two identical answers mean one of them is marked
      // wrong, so a farmer picking the right words still loses the mark.
      if (!q.q?.trim()) bad.push(`${where}: has no question text`);
      if (!q.rationale?.trim()) bad.push(`${where}: has no rationale — the student learns nothing`);
    });
  }
  assert.deepEqual(bad, [], 'unanswerable quiz question');
});

test('every lesson has the parts the student page renders', () => {
  // app/student/page.tsx renders body, keyPoints and quiz unconditionally. A lesson missing any of
  // them is not a short lesson, it is an empty panel with a heading over it.
  const thin: string[] = [];
  for (const { module, lesson } of allLessons) {
    const where = `${module}/${lesson.id}`;
    if (!lesson.title?.trim()) thin.push(`${where}: no title`);
    if (!lesson.body?.trim()) thin.push(`${where}: no body`);
    if (!lesson.keyPoints?.length) thin.push(`${where}: no key points`);
    if (lesson.keyPoints?.some((k) => !k?.trim())) thin.push(`${where}: a blank key point`);
    if (!lesson.quiz?.length) thin.push(`${where}: no quiz`);
  }
  assert.deepEqual(thin, [], 'lesson would render as an empty panel');
});

test('every illustrated lesson points at an image that is really there', () => {
  // Checked against disk, not against the string — see the note at the top about course:status
  // reporting a module illustrated when the files are absent, and about the offline pack.
  const missing: string[] = [];
  for (const { module, lesson } of allLessons) {
    if (!lesson.infographicUrl) continue;
    if (!existsSync(new URL(`../public${lesson.infographicUrl}`, import.meta.url))) {
      missing.push(`${module}/${lesson.id}: ${lesson.infographicUrl}`);
    }
  }
  assert.deepEqual(missing, [], 'infographicUrl does not resolve to a file in public/');
});

test('the guards actually catch bad data (synthetic fixture)', () => {
  // Mirrors the fixture test in course-content.test.ts. A guard that has only ever seen good data
  // has not been shown to work — and every assertion above currently passes, so without this the
  // whole file could be inert and look identical.
  const offByOne = { q: 'Which?', options: ['a', 'b', 'c'], correct: 3, rationale: 'because' };
  const isValid = (q: { options: string[]; correct: number }) =>
    Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length;

  assert.equal(isValid(offByOne), false, 'an out-of-range correct index must be rejected');
  assert.equal(isValid({ ...offByOne, correct: 2 }), true, 'the last valid index must be accepted');
  assert.equal(isValid({ ...offByOne, correct: -1 }), false);

  const dupes = ['mulch', 'mulch', 'compost'];
  assert.notEqual(new Set(dupes).size, dupes.length, 'the duplicate-option check must fire');

  assert.equal(
    existsSync(new URL('../public/course-images/__definitely-not-here.jpg', import.meta.url)),
    false,
    'the image check must be able to fail',
  );
});
