import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Soil Health Sesotho draft preserves exact sources, safety holds, plant names and quiz indexes', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health');
  assert.ok(source, 'the translated module must have an English source');
  const draft = SESOTHO_SOIL_HEALTH_DRAFT;
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
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact-English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: review status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: draft must use Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve figures`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: held text must stay exact English`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all source lessons must be represented');

  const holds: string[] = [];
  const namedPlants = ['wattle', 'oats', 'lupins', 'sunn hemp', 'cowpea', 'maize'];
  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and lesson order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: infographic source must be paired`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (lesson.infographicAlt.reviewStatus === 'hold') holds.push(`${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: paragraph boundaries must match`);
    if (lesson.body.reviewStatus === 'hold') holds.push(`${path}.body`);
    for (const plant of namedPlants) {
      if (original.body.toLowerCase().includes(plant)) {
        assert.ok(lesson.body.sesothoDraft.toLowerCase().includes(plant), `${path}.body: preserve named plant ${plant}`);
      }
    }
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key-point count must match`);
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
      if (question.question.reviewStatus === 'hold') holds.push(`${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option order/count must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        const optionPath = `${questionPath}.options[${optionIndex}]`;
        checkPair(option, english.options[optionIndex], optionPath);
        if (option.reviewStatus === 'hold') holds.push(optionPath);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: keep the source answer index`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct choice must still reference the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
      if (question.rationale.reviewStatus === 'hold') holds.push(`${questionPath}.rationale`);
    }
  }

  assert.deepEqual(holds, [
    'lessons[0] soil-health-l1.infographicAlt',
    'lessons[0] soil-health-l1.body',
    'lessons[0] soil-health-l1.quiz[0].question',
    'lessons[0] soil-health-l1.quiz[0].options[1]',
    'lessons[0] soil-health-l1.quiz[0].rationale',
    'lessons[1] soil-health-l2.infographicAlt',
    'lessons[1] soil-health-l2.body',
    'lessons[1] soil-health-l2.keyPoints[1]',
    'lessons[1] soil-health-l2.quiz[0].question',
    'lessons[1] soil-health-l2.quiz[0].rationale',
    'lessons[1] soil-health-l2.quiz[1].rationale',
    'lessons[2] soil-health-l3.infographicAlt',
    'lessons[2] soil-health-l3.body',
    'lessons[2] soil-health-l3.keyPoints[3]',
    'lessons[2] soil-health-l3.quiz[0].options[2]',
    'lessons[2] soil-health-l3.quiz[0].rationale',
    'lessons[2] soil-health-l3.quiz[1].rationale',
  ], 'uncertain and untranslated fields must remain exact-English holds');

  const compostLesson = source.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostLesson);
  const compostDraft = draft.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostDraft);
  assert.equal(compostDraft.body.reviewStatus, 'hold');
  assert.equal(compostDraft.body.sesothoDraft, compostLesson.body);
  const presentation = resolveLearnerLessonPresentation(compostLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, compostLesson.body,
    'the visible draft must keep the whole compost procedure exact English until its sanitation wording is reviewed');
  assert.equal(presentation.content.keyPoints[1], compostLesson.keyPoints[1],
    'the visible summary must retain the exact sanitation claim until its Sesotho wording is reviewed');
});
