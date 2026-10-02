import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-st-seeds-sovereignty.ts';
import { XITSONGA_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-ts-seeds-sovereignty.ts';
import { assertKeeps, checkCompleteLessonDraft, checkCompleteModuleDraft, draftText, FORBIDDEN_WORDS } from './regional-full-draft-checks.ts';

const STUDENT_PAGE = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');

test('Seeds lesson 3 drafts translate storage and germination guidance and keep every storage condition', () => {
  const sourceLesson = COURSE_MODULES.find(module => module.id === 'seeds-sovereignty')!.lessons.find(lesson => lesson.id === 'seeds-sovereignty-l3')!;
  // 2 October 2026: the storage and germination paragraphs held in exact English are now translated after a
  // blind back-translation and an independent semantic check. Each draft must still say: never direct sun,
  // seed fully dry before sealing, a sealed container, a cool and dark place.
  const check = (language: 'st' | 'ts', paired: Parameters<typeof checkCompleteLessonDraft>[1], conditions: string[]) => {
    checkCompleteLessonDraft(sourceLesson, paired, language);
    assertKeeps(draftText(paired.body, language), conditions, `${language} seed storage conditions`);
  };
  check('st', SESOTHO_SEEDS_SOVEREIGNTY_DRAFT.lessons.find(lesson => lesson.id === sourceLesson.id)!,
    ['o se ke wa e beha letsatsing', 'e omileng ka botlalo', 'setshelong se kwetsweng', 'se phodileng', 'se lefifi']);
  check('ts', XITSONGA_SEEDS_SOVEREIGNTY_DRAFT.lessons.find(lesson => lesson.id === sourceLesson.id)!,
    ['u nga tshuki u yi veka eka dyambu', 'leyi omeke hi ku helela', 'lexi pfaleke', 'yo titimela', 'yo munyama']);
});

test('Sesotho Seeds learner prose is paired, visibly unreviewed, and source changes withdraw it', () => {
  const draft = SESOTHO_SEEDS_SOVEREIGNTY_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the canonical Seeds and Seed Sovereignty module must remain available');
  // 2 October 2026: the quizzes, key points and held genetics paragraphs are now complete machine drafts with
  // canonical answer indices; until now the quizzes stayed exact English.
  checkCompleteModuleDraft(module, draft, 'st', FORBIDDEN_WORDS.st);
  for (const lesson of module.lessons) {
    const sourceDraft = draft.lessons.find(candidate => candidate.id === lesson.id)!;
    if (lesson.infographicAlt) assert.equal(resolveLearnerLessonPresentation(lesson, 'st').content.infographicAlt,
      sourceDraft.infographicAlt?.sesothoDraft, `${lesson.id}: the learner sees the paired illustration description`);
    const changedTitle = { ...lesson, title: `${lesson.title} changed` };
    assert.equal(resolveLearnerLessonPresentation(changedTitle, 'st').status, 'english-fallback',
      `${lesson.id}: changed English source withdraws the paired draft`);
  }
  assert.match(STUDENT_PAGE, /regionalDraft && <span[\s\S]*?AI draft · review pending/,
    'the visible review-pending learner label remains in place');
  assert.ok(STUDENT_PAGE.includes('<p className="font-semibold">Exact English source</p>') &&
    STUDENT_PAGE.includes('<p><span className="font-semibold">Title:</span> {lesson.title}</p>'),
    'learners can see the exact English title beside the draft');
});

test('the Xitsonga Seeds edition translates the genetics quizzes and keeps the technical terms in English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'seeds-sovereignty');
  assert.ok(source);
  // 2 October 2026: the genetics quizzes were exact English; they are now machine drafts in the same order with
  // the same correct answers, and the seed-genetics terms stay English inside the translated sentences.
  checkCompleteModuleDraft(source, XITSONGA_SEEDS_SOVEREIGNTY_DRAFT, 'ts', FORBIDDEN_WORDS.ts);
  assert.deepEqual(XITSONGA_SEEDS_SOVEREIGNTY_DRAFT.holds, [], 'no English holds remain');
  const shown = resolveLearnerLessonPresentation(source.lessons[0], 'ts');
  for (const term of ['open-pollinated', 'stable variety', 'F1 hybrid', 'pollination']) {
    assert.ok(shown.content.body.includes(term), `${term} remains English`);
  }
  assert.ok(!shown.content.body.includes('thyakisa'), 'pollination must not read as pollution');
  const quiz = shown.content.quiz.flatMap(question => [question.q, ...question.options, question.rationale]).join(' ');
  assert.match(quiz, /\bF1\b/, 'the F1 distinction stays explicit in the translated quiz');
});
