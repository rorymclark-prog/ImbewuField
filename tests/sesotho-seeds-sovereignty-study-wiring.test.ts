import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-st-seeds-sovereignty.ts';
import { XITSONGA_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-ts-seeds-sovereignty.ts';

const STUDENT_PAGE = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');

test('Sesotho Seeds learner prose is paired, visibly unreviewed, and source changes withdraw it', () => {
  const draft = SESOTHO_SEEDS_SOVEREIGNTY_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the canonical Seeds and Seed Sovereignty module must remain available');
  assert.equal(draft.title.sourceEnglish, module.title);
  assert.equal(draft.description.sourceEnglish, module.description);
  const modulePresentation = resolveCourseModulePresentation(module, 'st');
  assert.equal(modulePresentation.status, 'draft', 'regional card copy remains visibly a draft');
  assert.equal(modulePresentation.title, draft.title.sesothoDraft);
  assert.equal(modulePresentation.description, draft.description.sesothoDraft);
  assert.equal(draft.lessons.length, 3);

  for (const lesson of module.lessons) {
    const sourceDraft = draft.lessons.find(candidate => candidate.id === lesson.id);
    assert.ok(sourceDraft, `${lesson.id}: matching source-paired draft must exist`);
    assert.equal(sourceDraft.title.sourceEnglish, lesson.title);
    assert.equal(sourceDraft.body.sourceEnglish, lesson.body);
    assert.equal(sourceDraft.keyPoints.length, lesson.keyPoints.length);
    sourceDraft.keyPoints.forEach((point, index) => assert.equal(point.sourceEnglish, lesson.keyPoints[index]));
    assert.equal(sourceDraft.quiz.length, lesson.quiz.length);
    sourceDraft.quiz.forEach((question, index) => {
      assert.equal(question.sourceCorrectIndex, lesson.quiz[index].correct);
      assert.equal(question.question.sourceEnglish, lesson.quiz[index].q);
      assert.equal(question.rationale.sourceEnglish, lesson.quiz[index].rationale);
      question.options.forEach((option, optionIndex) => assert.equal(option.sourceEnglish, lesson.quiz[index].options[optionIndex]));
    });
    const presentation = resolveLearnerLessonPresentation(lesson, 'st');
    assert.equal(presentation.status, [sourceDraft.title, sourceDraft.body, ...sourceDraft.keyPoints].some(pair => pair.reviewStatus === 'machine-draft') ? 'draft' : 'english-fallback');
    assert.equal(presentation.content.title, sourceDraft.title.reviewStatus === 'hold' ? lesson.title : sourceDraft.title.sesothoDraft);
    assert.equal(presentation.content.body, sourceDraft.body.reviewStatus === 'hold' ? lesson.body : sourceDraft.body.sesothoDraft);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, 'untranslated genetics assessment keeps its canonical wording and answer');
    assert.deepEqual(presentation.content.keyPoints,
      sourceDraft.keyPoints.map((point, index) => point.reviewStatus === 'hold' ? lesson.keyPoints[index] : point.sesothoDraft));

    if (lesson.infographicAlt) assert.equal(presentation.content.infographicAlt, lesson.infographicAlt,
      'the unreviewed illustration description remains exact English');
    const changedTitle = { ...lesson, title: `${lesson.title} changed` };
    assert.equal(resolveLearnerLessonPresentation(changedTitle, 'st').status, 'english-fallback',
      `${lesson.id}: changed English source withdraws the paired draft`);
  }

  const changedDescription = { ...module, description: `${module.description} changed` };
  assert.equal(resolveCourseModulePresentation(changedDescription, 'st').status, 'english-fallback',
    'changed English module description withdraws the paired card draft');
  assert.match(STUDENT_PAGE, /regionalDraft && <span[\s\S]*?AI draft · review pending/,
    'the visible review-pending learner label remains in place');
  assert.ok(STUDENT_PAGE.includes('<p className="font-semibold">Exact English source</p>') &&
    STUDENT_PAGE.includes('<p><span className="font-semibold">Title:</span> {lesson.title}</p>'),
    'learners can see the exact English title beside the draft');
});

test('the Xitsonga Seeds lesson shows its draft while genetics quizzes remain exact English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'seeds-sovereignty');
  assert.ok(source);
  const draft = XITSONGA_SEEDS_SOVEREIGNTY_DRAFT;
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(resolveCourseModulePresentation(source, 'ts').title, draft.title.xitsongaDraft);
  const lesson = source.lessons[0];
  const paired = draft.lessons[0];
  assert.equal(paired.body.sourceEnglish, lesson.body);
  const shown = resolveLearnerLessonPresentation(lesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, paired.body.xitsongaDraft);
  assert.deepEqual(shown.content.quiz, lesson.quiz);
  for (const term of ['open-pollinated', 'stable variety', 'F1 hybrid', 'pollination']) {
    assert.ok(shown.content.body.includes(term), `${term} remains English`);
  }
  assert.ok(!shown.content.body.includes('thyakisa'), 'pollination must not read as pollution');
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: lesson.body + ' Changed.' }, 'ts').status,
    'english-fallback', 'a changed English source withdraws the draft');
});
