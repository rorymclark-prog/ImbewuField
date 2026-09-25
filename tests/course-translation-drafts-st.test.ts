import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-st.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-st-seeds-sovereignty.ts';

test('the Sesotho Foundation draft retains exact paired source and complete course content shape', () => {
  const source = COURSE_MODULES.find(module => module.id === SESOTHO_INTRO_PERMACULTURE_DRAFT.id);
  assert.ok(source, 'the paired draft must resolve to its exact English source module');
  const draft = SESOTHO_INTRO_PERMACULTURE_DRAFT;

  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.ok(draft.title.sesothoDraft.trim());
  assert.ok(draft.description.sesothoDraft.trim());
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: paired English source must match course-modules.ts byte for byte`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: machine draft must not omit this source field`);
    assert.equal(pair.reviewStatus, 'machine-draft', `${path}: human review has not happened`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: draft must remain Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: placeholders must be preserved`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: numeric figures must be preserved`);
    if (/\bmaize\b/i.test(english)) {
      assert.match(pair.sesothoDraft, /\(maize\)/i, `${path}: keep the exact crop name beside its Sesotho rendering`);
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'every source lesson must be represented');

  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: source ID/order must be unchanged`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source infographic alt needs a paired draft`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
    } else {
      assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent image alt text`);
    }
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sourceEnglish.split('\n\n').length, lesson.body.sesothoDraft.split('\n\n').length,
      `${path}.body: paragraph structure must stay aligned for review`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz question count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must remain unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct answer must still point to the exact English correct option`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
    }
  }
});

test('Sesotho seed labels cannot change seed-saving instructions or quiz answers before review', () => {
  const draft = SESOTHO_SEEDS_SOVEREIGNTY_DRAFT;
  const source = COURSE_MODULES.find(module => module.id === draft.id);
  assert.ok(source);
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.deepEqual(draft.sourceMetadata, { durationMins: source.durationMins, category: source.category });
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  for (const [pair, english] of [
    [draft.title, source.title],
    [draft.description, source.description],
  ] as const) {
    assert.equal(pair.sourceEnglish, english);
    assert.equal(pair.reviewStatus, 'machine-draft');
    assert.ok(pair.sesothoDraft.trim());
  }

  const checkHold = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string) => {
    assert.equal(pair.sourceEnglish, english);
    assert.equal(pair.sesothoDraft, english);
    assert.equal(pair.reviewStatus, 'hold');
  };

  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.title.reviewStatus, 'machine-draft');
    assert.ok(lesson.title.sesothoDraft.trim());
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt);
      checkHold(lesson.infographicAlt, original.infographicAlt);
    } else {
      assert.equal(lesson.infographicAlt, undefined);
    }
    checkHold(lesson.body, original.body);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length);
    lesson.keyPoints.forEach((point, index) => checkHold(point, original.keyPoints[index]));
    assert.equal(lesson.quiz.length, original.quiz.length);
    lesson.quiz.forEach((question, index) => {
      const originalQuestion = original.quiz[index];
      checkHold(question.question, originalQuestion.q);
      assert.equal(question.options.length, originalQuestion.options.length);
      question.options.forEach((option, optionIndex) => checkHold(option, originalQuestion.options[optionIndex]));
      assert.equal(question.sourceCorrectIndex, originalQuestion.correct);
      checkHold(question.rationale, originalQuestion.rationale);
    });
  }
});
