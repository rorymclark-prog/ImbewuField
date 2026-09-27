import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-st-plant-guilds.ts';

test('Plant Guilds Sesotho appears in Study with source-paired labels and held advice in English', () => {
  const draft = SESOTHO_PLANT_GUILDS_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the canonical Plant Guilds module must remain available');

  const modulePresentation = resolveCourseModulePresentation(module, 'st');
  assert.equal(modulePresentation.status, 'draft', 'the marked Sesotho module draft must be available');
  assert.equal(modulePresentation.title, draft.title.sesothoDraft);
  assert.equal(modulePresentation.description, draft.description.sesothoDraft);
  assert.equal(draft.title.sourceEnglish, module.title, 'the module label keeps its exact English source');
  assert.equal(draft.description.sourceEnglish, module.description, 'the module summary keeps its exact English source');
  assert.equal(draft.lessons.length, module.lessons.length, 'all three lessons must be wired');

  const resolved = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, source: string, path: string) => {
    assert.equal(pair.sourceEnglish, source, `${path}: preserve the exact English source beside the draft`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.sesothoDraft, source, `${path}: held advice stays exact English`);
      return source;
    }
    assert.equal(pair.reviewStatus, 'machine-draft', `${path}: draft must remain visibly unapproved`);
    return pair.sesothoDraft;
  };

  for (const [lessonIndex, lesson] of module.lessons.entries()) {
    const translation = draft.lessons[lessonIndex];
    assert.equal(translation.id, lesson.id, `${lesson.id}: preserve lesson order and ID`);
    const presentation = resolveLearnerLessonPresentation(lesson, 'st');
    assert.equal(presentation.status, 'draft', `${lesson.id}: keep the pending-review status`);
    assert.equal(presentation.content.title, resolved(translation.title, lesson.title, `${lesson.id}.title`));
    assert.equal(presentation.content.body, resolved(translation.body, lesson.body, `${lesson.id}.body`));
    if (lesson.infographicAlt) {
      assert.ok(translation.infographicAlt, `${lesson.id}: preserve the paired image description`);
      assert.equal(presentation.content.infographicAlt,
        resolved(translation.infographicAlt, lesson.infographicAlt, `${lesson.id}.infographicAlt`));
    }

    assert.equal(translation.keyPoints.length, lesson.keyPoints.length, `${lesson.id}: keep every source label`);
    for (const [index, point] of translation.keyPoints.entries()) {
      assert.equal(presentation.content.keyPoints[index], resolved(point, lesson.keyPoints[index], `${lesson.id}.keyPoints[${index}]`));
    }

    assert.equal(translation.quiz.length, lesson.quiz.length, `${lesson.id}: keep every source question`);
    for (const [index, question] of translation.quiz.entries()) {
      const source = lesson.quiz[index];
      assert.equal(question.sourceCorrectIndex, source.correct, `${lesson.id}.quiz[${index}]: preserve the correct answer`);
      assert.equal(presentation.content.quiz[index].q,
        resolved(question.question, source.q, `${lesson.id}.quiz[${index}].question`));
      assert.equal(presentation.content.quiz[index].rationale,
        resolved(question.rationale, source.rationale, `${lesson.id}.quiz[${index}].rationale`));
      assert.equal(question.options.length, source.options.length, `${lesson.id}.quiz[${index}]: keep every answer label`);
      for (const [optionIndex, option] of question.options.entries()) {
        assert.equal(presentation.content.quiz[index].options[optionIndex],
          resolved(option, source.options[optionIndex], `${lesson.id}.quiz[${index}].options[${optionIndex}]`));
      }
    }
  }

  const changedSource = { ...module.lessons[0], title: `${module.lessons[0].title} changed` };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'source drift withdraws the entire paired learner draft');
});
