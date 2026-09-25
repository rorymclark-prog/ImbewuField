import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';

test('Tshivenda Introduction Study keeps source pairs, held flood and compass wording, and source drift visible', () => {
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
  assert.equal(finalDraftLesson.body.reviewStatus, 'hold');
  assert.equal(finalPresentation.content.body, finalSourceLesson.body,
    'the held flood wording must stay byte-for-byte English in Study');
  assert.equal(finalDraftLesson.quiz[1].question.reviewStatus, 'hold');
  assert.equal(finalDraftLesson.quiz[1].options[1].reviewStatus, 'hold');
  assert.equal(finalPresentation.content.quiz[1].q, finalSourceLesson.quiz[1].q,
    'the held compass question must stay English');
  assert.equal(finalPresentation.content.quiz[1].options[1], finalSourceLesson.quiz[1].options[1],
    'the held compass option must stay English');

  assert.equal(resolveCourseModulePresentation({ ...module, title: `${module.title} changed` }, 've').status,
    'english-fallback', 'changed module source must invalidate the card draft');
  assert.equal(resolveLearnerLessonPresentation({ ...finalSourceLesson, body: `${finalSourceLesson.body} changed` }, 've').status,
    'english-fallback', 'changed lesson source must invalidate its whole draft');
});
