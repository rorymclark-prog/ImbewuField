import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';

// Rewritten 2 October 2026: every Food Forest field now has a Sesotho machine draft, so Study shows a
// labelled draft for each one. The old per-lesson hold lists and the pins on nine L1 sentences are
// replaced by a check that every displayed field is its draft (never the English, never a hold); the
// presentation wiring and the source-drift fallbacks are checked exactly as before.
test('Food Forest Sesotho appears in Study as a labelled source-paired draft in every field', () => {
  const draft = SESOTHO_FOOD_FOREST_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the source module must exist');
  assert.equal(draft.reviewStatus, 'machine-draft');

  const modulePresentation = resolveCourseModulePresentation(module, 'st');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.sesothoDraft);
  assert.equal(modulePresentation.description, draft.description.sesothoDraft);
  assert.equal(draft.title.sourceEnglish, module.title);
  assert.equal(draft.description.sourceEnglish, module.description);
  assert.equal(draft.sourceMetadata.durationMins, module.durationMins);
  assert.equal(draft.sourceMetadata.category, module.category);

  assert.equal(draft.lessons.length, module.lessons.length);
  const shownDraft = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, source: string, path: string) => {
    assert.equal(pair.sourceEnglish, source, `${path}: retain the exact English source`);
    assert.equal(pair.reviewStatus, 'machine-draft', `${path}: shown as an unreviewed machine draft, not held in English`);
    assert.notEqual(pair.sesothoDraft.trim(), source.trim(), `${path}: the draft is translated, not a copy of the English`);
    return pair.sesothoDraft;
  };

  for (const [lessonIndex, lesson] of module.lessons.entries()) {
    const translation = draft.lessons[lessonIndex];
    const prefix = `lessons[${lessonIndex}] ${lesson.id}`;
    assert.equal(translation.id, lesson.id, `${prefix}: retain lesson order and ID`);
    const presentation = resolveLearnerLessonPresentation(lesson, 'st');
    assert.equal(presentation.status, 'draft', `${prefix}: never claim approval`);
    assert.equal(presentation.content.title, shownDraft(translation.title, lesson.title, `${prefix}.title`));
    assert.equal(presentation.content.body, shownDraft(translation.body, lesson.body, `${prefix}.body`));
    assert.equal(presentation.content.body.split('\n\n').length, lesson.body.split('\n\n').length,
      `${prefix}: keep the source's paragraph breaks`);
    assert.equal(translation.keyPoints.length, lesson.keyPoints.length, `${prefix}: key-point count/order`);
    for (const [pointIndex, point] of translation.keyPoints.entries()) {
      assert.equal(presentation.content.keyPoints[pointIndex],
        shownDraft(point, lesson.keyPoints[pointIndex], `${prefix}.keyPoints[${pointIndex}]`));
    }
    assert.equal(translation.quiz.length, lesson.quiz.length, `${prefix}: quiz count/order`);
    for (const [questionIndex, question] of translation.quiz.entries()) {
      const source = lesson.quiz[questionIndex];
      const questionPath = `${prefix}.quiz[${questionIndex}]`;
      const shown = presentation.content.quiz[questionIndex];
      assert.equal(question.sourceCorrectIndex, source.correct, `${questionPath}: preserve answer index`);
      assert.equal(shown.correct, source.correct, `${questionPath}: displayed answer still matches source`);
      assert.equal(shown.q, shownDraft(question.question, source.q, `${questionPath}.question`));
      assert.equal(shown.rationale, shownDraft(question.rationale, source.rationale, `${questionPath}.rationale`));
      assert.equal(question.options.length, source.options.length, `${questionPath}: option count/order`);
      for (const [optionIndex, option] of question.options.entries()) {
        assert.equal(shown.options[optionIndex], shownDraft(option, source.options[optionIndex], `${questionPath}.options[${optionIndex}]`));
      }
    }
    if (lesson.infographicAlt) {
      assert.ok(translation.infographicAlt, `${prefix}: keep the source image description`);
      assert.equal(presentation.content.infographicAlt,
        shownDraft(translation.infographicAlt, lesson.infographicAlt, `${prefix}.infographicAlt`));
    }
  }

  assert.equal(resolveCourseModulePresentation({ ...module, description: `${module.description} changed` }, 'st').status,
    'english-fallback', 'changed module description must withdraw the card draft');
  assert.equal(resolveCourseModulePresentation({ ...module, durationMins: module.durationMins + 1 }, 'st').status,
    'english-fallback', 'changed module metadata must withdraw the card draft');
  assert.equal(resolveLearnerLessonPresentation({ ...module.lessons[2], body: `${module.lessons[2].body} changed` }, 'st').status,
    'english-fallback', 'changed lesson text must withdraw the whole draft and quiz');
  assert.equal(resolveLearnerLessonPresentation({ ...module.lessons[0], quiz: module.lessons[0].quiz.map((question, index) =>
    index === 0 ? { ...question, correct: (question.correct + 1) % question.options.length } : question) }, 'st').status,
  'english-fallback', 'changed quiz answers must withdraw the whole draft');
});
