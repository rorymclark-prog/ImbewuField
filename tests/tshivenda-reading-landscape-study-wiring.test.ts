import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';

test('Reading the Landscape keeps its Tshivenda draft source-paired and held answers English', () => {
  const draft = TSHIVENDA_READING_LANDSCAPE_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the draft module must exist in the canonical Study course');

  const modulePresentation = resolveCourseModulePresentation(module, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, draft.description.tshivendaDraft);

  assert.equal(module.lessons.length, 4);
  assert.equal(draft.lessons.length, module.lessons.length);
  for (const [index, sourceLesson] of module.lessons.entries()) {
    const draftLesson = draft.lessons[index];
    const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
    assert.equal(presentation.status, 'draft', sourceLesson.id);
    assert.equal(presentation.content.title, draftLesson.title.reviewStatus === 'hold'
      ? sourceLesson.title : draftLesson.title.tshivendaDraft, `${sourceLesson.id} title`);
    assert.equal(presentation.content.body, draftLesson.body.reviewStatus === 'hold'
      ? sourceLesson.body : draftLesson.body.tshivendaDraft, `${sourceLesson.id} body`);
    assert.deepEqual(presentation.content.keyPoints, draftLesson.keyPoints.map(point =>
      point.reviewStatus === 'hold' ? point.sourceEnglish : point.tshivendaDraft), `${sourceLesson.id} key points`);
    assert.deepEqual(presentation.content.quiz, draftLesson.quiz.map(question => ({
      q: question.question.reviewStatus === 'hold'
        ? question.question.sourceEnglish : question.question.tshivendaDraft,
      options: question.options.map(option => option.reviewStatus === 'hold'
        ? option.sourceEnglish : option.tshivendaDraft),
      correct: question.sourceCorrectIndex,
      rationale: question.rationale.reviewStatus === 'hold'
        ? question.rationale.sourceEnglish : question.rationale.tshivendaDraft,
    })), `${sourceLesson.id} quiz source pairs and answer indexes`);
  }

  const waterLesson = module.lessons[0];
  const heldWater = resolveLearnerLessonPresentation(waterLesson, 've');
  assert.equal(draft.lessons[0].body.reviewStatus, 'hold');
  assert.equal(heldWater.content.body, waterLesson.body,
    'the held water-safety body must remain exactly English');
  const heldAFrameAnswer = heldWater.content.quiz[0];
  assert.equal(draft.lessons[0].quiz[0].options[0].reviewStatus, 'hold');
  assert.equal(heldAFrameAnswer.options[0], waterLesson.quiz[0].options[0],
    'the held answer must stay English at its original correct index');
  assert.equal(heldAFrameAnswer.correct, 0);

  assert.equal(resolveCourseModulePresentation({ ...module, title: `${module.title} changed` }, 've').status,
    'english-fallback', 'changed module source must invalidate the card draft');
  assert.equal(resolveLearnerLessonPresentation({ ...waterLesson, body: `${waterLesson.body} changed` }, 've').status,
    'english-fallback', 'changed lesson source must invalidate its whole draft and answer key');
});
