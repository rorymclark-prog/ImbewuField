import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Sesotho Market L3 pairs safe prompts and keeps seed and return guidance exact English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l3');
  assert.ok(source);
  const draft = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the third source lesson must be paired');

  assert.deepEqual(SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.map(lesson => lesson.id),
    sourceModule.lessons.map(lesson => lesson.id), 'all lesson ids and order must follow the source');
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.reviewStatus, 'machine-draft');

  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.sesothoDraft, source.body);
  assert.equal(draft.body.reviewStatus, 'hold', 'seed, postharvest and selling guidance stay exact English');

  assert.deepEqual(draft.keyPoints.map(pair => pair.sourceEnglish), source.keyPoints);
  assert.deepEqual(draft.keyPoints.map(pair => pair.reviewStatus), ['hold', 'machine-draft', 'hold', 'hold']);
  assert.equal(draft.keyPoints[0].sesothoDraft, source.keyPoints[0], 'seed permission remains exact English');
  assert.equal(draft.keyPoints[2].sesothoDraft, source.keyPoints[2], 'net return advice remains exact English');
  assert.equal(draft.keyPoints[3].sesothoDraft, source.keyPoints[3], 'qualification for technical help remains exact English');

  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, questionIndex) => {
    const original = source.quiz[questionIndex];
    assert.equal(question.question.sourceEnglish, original.q);
    assert.equal(question.question.reviewStatus, 'machine-draft');
    assert.equal(question.options.length, original.options.length);
    question.options.forEach((option, optionIndex) => {
      assert.equal(option.sourceEnglish, original.options[optionIndex]);
      assert.equal(option.sesothoDraft, original.options[optionIndex]);
      assert.equal(option.reviewStatus, 'hold', 'all choices remain exact English to preserve quiz meaning');
    });
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
    assert.equal(question.rationale.sourceEnglish, original.rationale);
    assert.equal(question.rationale.sesothoDraft, original.rationale);
    assert.equal(question.rationale.reviewStatus, 'hold');
  });

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.title, draft.title.sesothoDraft);
  assert.equal(presentation.content.infographicAlt, draft.infographicAlt?.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, draft.keyPoints.map(pair => pair.sesothoDraft));
  assert.deepEqual(presentation.content.quiz, source.quiz.map((question, index) => ({
    q: draft.quiz[index].question.sesothoDraft,
    options: question.options,
    correct: question.correct,
    rationale: question.rationale,
  })));

  const changedSource = { ...source, title: `${source.title} ` };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(stalePresentation.status, 'english-fallback', 'source edits withdraw stale paired fields');
  assert.equal(stalePresentation.content.title, changedSource.title);
});
