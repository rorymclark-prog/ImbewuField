import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';

test('Vegetables and Staple Crops Sesotho draft keeps exact sources, agronomic figures and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples');
  assert.ok(source, 'the source module must remain available');
  const draft = SESOTHO_VEGETABLES_STAPLES_DRAFT;
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: keep draft text in Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve source figures exactly`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: held text must remain exact English`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all four lessons must be paired');
  const holds: string[] = [];
  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    const path = `lessons[${lessonIndex}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source infographic text needs a pair`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (lesson.infographicAlt.reviewStatus === 'hold') holds.push(`${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: keep source paragraph boundaries`);
    if (lesson.body.reviewStatus === 'hold') holds.push(`${path}.body`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
      if (point.reviewStatus === 'hold') holds.push(`${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      if (question.question.reviewStatus === 'hold') holds.push(`${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
        if (option.reviewStatus === 'hold') holds.push(`${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must stay unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct option must still point to the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
      if (question.rationale.reviewStatus === 'hold') holds.push(`${questionPath}.rationale`);
    }
  }
  assert.deepEqual(holds, [
    'lessons[0] vegetables-staples-l1.body',
    'lessons[0] vegetables-staples-l1.quiz[1].options[1]',
    'lessons[1] vegetables-staples-l2.quiz[0].question',
    'lessons[2] vegetables-staples-l3.body',
    'lessons[2] vegetables-staples-l3.keyPoints[2]',
    'lessons[3] vegetables-staples-l4.infographicAlt',
    'lessons[3] vegetables-staples-l4.body',
    'lessons[3] vegetables-staples-l4.quiz[0].options[1]',
    'lessons[3] vegetables-staples-l4.quiz[0].rationale',
    'lessons[3] vegetables-staples-l4.quiz[1].question',
  ], 'uncertain crop and pest passages stay exact English until reviewed');
});
