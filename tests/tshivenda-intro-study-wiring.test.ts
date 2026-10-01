import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';

test('Tshivenda Introduction Study keeps source pairs, held L2 semantic risks and L3 flood/compass wording visible', () => {
  const draft = TSHIVENDA_INTRO_PERMACULTURE_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the draft module must exist in the canonical Study course');

  const modulePresentation = resolveCourseModulePresentation(module, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, draft.description.tshivendaDraft);

  for (const [index, sourceLesson] of module.lessons.entries()) {
    const draftLesson = draft.lessons[index];
    const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
    assert.equal(presentation.status, 'draft', sourceLesson.id);
    assert.equal(presentation.content.title, draftLesson.title.tshivendaDraft, `${sourceLesson.id} title`);
    assert.equal(presentation.content.body, draftLesson.body.tshivendaDraft, `${sourceLesson.id} body`);
    assert.deepEqual(presentation.content.keyPoints,
      draftLesson.keyPoints.map(point => point.reviewStatus === 'hold' ? point.sourceEnglish : point.tshivendaDraft),
      `${sourceLesson.id} key points`);
    assert.deepEqual(presentation.content.quiz, draftLesson.quiz.map(question => ({
      q: question.question.reviewStatus === 'hold' ? question.question.sourceEnglish : question.question.tshivendaDraft,
      options: question.options.map(option => option.reviewStatus === 'hold' ? option.sourceEnglish : option.tshivendaDraft),
      correct: question.sourceCorrectIndex,
      rationale: question.rationale.reviewStatus === 'hold' ? question.rationale.sourceEnglish : question.rationale.tshivendaDraft,
    })), `${sourceLesson.id} quiz pairs and answer indexes`);
  }

  const finalSourceLesson = module.lessons[2];
  const finalDraftLesson = draft.lessons[2];
  const finalPresentation = resolveLearnerLessonPresentation(finalSourceLesson, 've');
  assert.equal(finalDraftLesson.body.sourceEnglish, finalSourceLesson.body,
    'the observation draft must stay paired to the exact Study source');
  assert.equal(finalDraftLesson.body.reviewStatus, 'hold',
    'unreviewed field and compass instructions must remain exact English');
  assert.equal(finalDraftLesson.body.tshivendaDraft, finalSourceLesson.body);
  assert.equal(finalPresentation.content.body, finalSourceLesson.body);
  assert.equal(finalDraftLesson.quiz[1].question.reviewStatus, 'hold');
  assert.ok(finalDraftLesson.quiz[1].options.every(option => option.reviewStatus === 'hold'));
  assert.equal(finalDraftLesson.quiz[1].rationale.reviewStatus, 'hold');
  assert.equal(finalPresentation.content.quiz[1].q, finalSourceLesson.quiz[1].q,
    'the held compass question must stay English');
  assert.deepEqual(finalPresentation.content.quiz[1], finalSourceLesson.quiz[1],
    'the complete direction-dependent quiz item must stay exact English');

  const principleSource = module.lessons[1];
  const principleDraft = draft.lessons[1];
  const principlePresentation = resolveLearnerLessonPresentation(principleSource, 've');
  assert.equal(principleDraft.body.reviewStatus, 'machine-draft');
  assert.equal(principleDraft.body.sourceEnglish, principleSource.body);
  const paragraphs = principleDraft.body.tshivendaDraft.split('\n\n');
  const englishParagraphs = principleSource.body.split('\n\n');
  assert.equal(paragraphs.length, englishParagraphs.length);
  paragraphs.forEach((paragraph, index) => assert.notEqual(paragraph, englishParagraphs[index],
    'a full-body draft must not present an English-only paragraph as translated'));
  assert.equal(principlePresentation.content.body, principleDraft.body.tshivendaDraft);
  // The previous hold caught construction-only design and a causal hail claim.
  // Retain precise English terms inside local prose after repairing those meanings.
  for (const term of ['David Holmgren', 'Bill Mollison', 'Essence of Permaculture', 'design', 'major earthworks', 'biomass', '(strip)', 'planting bed', 'maize', 'growth stage']) {
    assert.ok(principleDraft.body.tshivendaDraft.includes(term), `retain source concept: ${term}`);
  }
  assert.match(paragraphs[1], /i ya nga storm na growth stage/, 'hail damage depends on storm/stage; stage does not cause hail');
  assert.ok(principlePresentation.content.title.includes('design'), 'the title must describe design rather than construction only');
  assert.match(principleDraft.keyPoints[3].tshivendaDraft, /^Hail injury kha maize i ya nga storm na growth stage ya crop\.?$/,
    'the keypoint must preserve the same dependence as the body, not a causal growth-stage claim');
  assert.equal(resolveLearnerLessonPresentation({ ...principleSource, body: `${principleSource.body} New condition.` }, 've').status,
    'english-fallback', 'source drift invalidates the complete principles body draft');
  assert.equal(principleDraft.quiz[0].sourceCorrectIndex, principleSource.quiz[0].correct,
    'the source answer index stays unchanged when a distractor is held');
  assert.equal(principleDraft.quiz[0].options[1].reviewStatus, 'machine-draft');
  assert.match(principleDraft.quiz[0].options[1].tshivendaDraft, /at least one wet season/,
    'the translated option keeps the minimum wet-season qualifier');
  assert.equal(principlePresentation.content.quiz[0].options[1], principleDraft.quiz[0].options[1].tshivendaDraft,
    'the source-paired wet-season option reaches the learner as a marked draft');

  assert.equal(resolveCourseModulePresentation({ ...module, title: `${module.title} changed` }, 've').status,
    'english-fallback', 'changed module source must invalidate the card draft');
  assert.equal(resolveLearnerLessonPresentation({ ...finalSourceLesson, body: `${finalSourceLesson.body} changed` }, 've').status,
    'english-fallback', 'changed lesson source must invalidate its whole draft');
});
