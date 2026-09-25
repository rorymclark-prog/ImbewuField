import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-st-plant-guilds.ts';

test('Plant Selection & Guilds Sesotho draft keeps exact sources, holds and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'plant-guilds');
  assert.ok(source, 'the canonical Plant Selection & Guilds module must remain available');
  const draft = SESOTHO_PLANT_GUILDS_DRAFT;
  assert.equal(draft.id, source.id);
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);

  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const holds: string[] = [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: keep exact English source`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact-English hold must exist`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: review status must be explicit`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve numeric claims`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.sesothoDraft, english, `${path}: held wording must remain exact English`);
      holds.push(path);
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all source lessons must be present');
  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    const path = `lessons[${lessonIndex}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source image description needs a pair`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent image text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: keep paragraph boundaries`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: keep key-point count/order`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: keep quiz count/order`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: keep option count/order`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must not change`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: keyed answer must still match its source`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
    }
  }

  assert.deepEqual(holds, [
    'lessons[0] plant-guilds-l1.infographicAlt',
    'lessons[0] plant-guilds-l1.body',
    'lessons[0] plant-guilds-l1.keyPoints[2]',
    'lessons[0] plant-guilds-l1.keyPoints[3]',
    'lessons[0] plant-guilds-l1.quiz[0].rationale',
    'lessons[0] plant-guilds-l1.quiz[1].rationale',
    'lessons[1] plant-guilds-l2.infographicAlt',
    'lessons[1] plant-guilds-l2.body',
    'lessons[1] plant-guilds-l2.keyPoints[2]',
    'lessons[2] plant-guilds-l3.infographicAlt',
    'lessons[2] plant-guilds-l3.body',
    'lessons[2] plant-guilds-l3.keyPoints[0]',
    'lessons[2] plant-guilds-l3.keyPoints[1]',
    'lessons[2] plant-guilds-l3.keyPoints[2]',
    'lessons[2] plant-guilds-l3.keyPoints[3]',
    'lessons[2] plant-guilds-l3.quiz[0].rationale',
    'lessons[2] plant-guilds-l3.quiz[1].rationale',
  ], 'operational guidance and source-sensitive fields stay exact English');

  assert.ok(draft.lessons[0].body.sesothoDraft.includes('Sesbania punicea'));
  assert.ok(draft.lessons[0].body.sesothoDraft.includes('Sesbania sesban'));
  assert.ok(draft.lessons[1].body.sesothoDraft.includes('Bocking 14'));
  assert.ok(draft.lessons[1].body.sesothoDraft.includes('Tulbaghia violacea'));
  assert.ok(draft.lessons[2].quiz[1].question.sourceEnglish.includes('sweet potato'));
  assert.equal(draft.lessons[2].quiz[1].question.sesothoDraft, 'Na sweet potato e dula e le molemo ho feta basin ya mulch ho potoloha sefate se senyane sa ditholwana?');
});
