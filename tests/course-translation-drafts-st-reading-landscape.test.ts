import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';

test('Reading the Landscape Sesotho draft stays paired to every exact source field', () => {
  const source = COURSE_MODULES.find(module => module.id === 'reading-landscape');
  assert.ok(source, 'the translated module must have an English source');
  const draft = SESOTHO_READING_LANDSCAPE_DRAFT;
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: keep draft text in Latin script`);
    assert.doesNotMatch(pair.sesothoDraft, /lePREFIX/, `${path}: reject translation pipeline artifacts`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve figures and times`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.sesothoDraft, english, `${path}: a held phrase must remain exact English`);
    }
    for (const term of ['A-frame', 'pawpaw', 'citrus', 'tomatoes', 'late blight', 'khakibos', 'blackjack', 'KZN', 'Highveld']) {
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(english)) {
        assert.ok(pair.sesothoDraft.toLowerCase().includes(term.toLowerCase()), `${path}: preserve exact source term ${term}`);
      }
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all four source lessons must be represented');

  const holds: string[] = [];
  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: lesson IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: infographic alt must be paired`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
    } else {
      assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    }
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: paragraph structure must stay aligned`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      const pointPath = `${path}.keyPoints[${pointIndex}]`;
      checkPair(point, original.keyPoints[pointIndex], pointPath);
      if (point.reviewStatus === 'hold') holds.push(pointPath);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: source answer index must stay unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct option must still point to the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
    }
  }
  assert.deepEqual(holds, ['lessons[3] reading-landscape-l4.keyPoints[2]'], 'only the reviewed uncertain phrase remains held');
});
