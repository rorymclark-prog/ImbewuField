import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT as draft } from '../lib/course-translation-drafts-ts.ts';

const source = COURSE_MODULES.find(module => module.id === 'intro-permaculture')!;
const digits = (value: string) => value.match(/\d+/g) ?? [];

test('the Xitsonga draft preserves all Introduction source pairs and quiz answer indexes', () => {
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 'ts');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.equal(draft.lessons.length, 3);

  for (const [index, lesson] of draft.lessons.entries()) {
    const original = source.lessons[index];
    assert.ok(original);
    assert.equal(lesson.id, original.id);
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.body.sourceEnglish, original.body);
    assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), original.keyPoints);
    assert.equal(lesson.quiz.length, original.quiz.length);

    for (const [quizIndex, item] of lesson.quiz.entries()) {
      const sourceItem = original.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceItem.q);
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceItem.options);
      assert.equal(item.rationale.sourceEnglish, sourceItem.rationale);
      assert.equal(item.sourceCorrectIndex, sourceItem.correct, `${lesson.id} quiz ${quizIndex} answer index changed`);
    }
  }
});

test('held Xitsonga fields stay exact English until fluent review resolves them', () => {
  assert.ok(draft.holds.length > 0);
  const lessons = new Map(draft.lessons.map(lesson => [lesson.id, lesson]));

  for (const hold of draft.holds) {
    const lesson = lessons.get(hold.lessonId);
    assert.ok(lesson, `hold points to unknown lesson ${hold.lessonId}`);
    const match = hold.field.match(/^(body)|^keyPoints\[(\d+)\]$|^quiz\[(\d+)\](?:\.(q|rationale)|\.options\[(\d+)\])$/);
    assert.ok(match, `unsupported held field ${hold.field}`);
    const [, bodyField, keyPointIndex, quizIndex, part, optionIndexText] = match;
    let pair;
    if (bodyField) pair = lesson.body;
    if (keyPointIndex !== undefined) pair = lesson.keyPoints[Number(keyPointIndex)];
    if (quizIndex !== undefined) {
      const quiz = lesson.quiz[Number(quizIndex)];
      if (part === 'q') pair = quiz?.question;
      else if (part === 'rationale') pair = quiz?.rationale;
      else if (optionIndexText !== undefined) pair = quiz?.options[Number(optionIndexText)];
    }
    assert.ok(pair, `${hold.lessonId} ${hold.field} must resolve to a source pair`);
    if (bodyField) assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field} must retain the exact held source phrase`);
    else assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exactly as sourced`);
    if (!bodyField) assert.equal(pair.reviewStatus, 'hold');
    assert.ok(hold.reason.length > 0);
  }
});

test('the draft retains source digits and named authors in paired fields', () => {
  for (const lesson of draft.lessons) {
    assert.deepEqual(digits(lesson.body.xitsongaDraft), digits(lesson.body.sourceEnglish), `${lesson.id} body digits changed`);
    for (const [index, point] of lesson.keyPoints.entries()) {
      assert.deepEqual(digits(point.xitsongaDraft), digits(point.sourceEnglish), `${lesson.id} key point ${index} digits changed`);
    }
    for (const [index, item] of lesson.quiz.entries()) {
      assert.deepEqual(digits(item.question.xitsongaDraft), digits(item.question.sourceEnglish), `${lesson.id} quiz ${index} question digits changed`);
      assert.deepEqual(digits(item.rationale.xitsongaDraft), digits(item.rationale.sourceEnglish), `${lesson.id} quiz ${index} rationale digits changed`);
      for (const [optionIndex, option] of item.options.entries()) {
        assert.deepEqual(digits(option.xitsongaDraft), digits(option.sourceEnglish), `${lesson.id} quiz ${index} option ${optionIndex} digits changed`);
      }
    }
  }

  const l2 = draft.lessons.find(lesson => lesson.id === 'intro-permaculture-l2')!;
  for (const name of ['David Holmgren', 'Bill Mollison', 'Essence of Permaculture']) {
    assert.ok(l2.body.xitsongaDraft.includes(name), `source name ${name} should remain visible`);
  }
});
