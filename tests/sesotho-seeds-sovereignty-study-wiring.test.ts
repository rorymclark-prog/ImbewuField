import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-st-seeds-sovereignty.ts';

const STUDENT_PAGE = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');

test('Sesotho seed lesson labels are paired drafts and every teaching field stays exact English', () => {
  const draft = SESOTHO_SEEDS_SOVEREIGNTY_DRAFT;
  const module = COURSE_MODULES.find(candidate => candidate.id === draft.id);
  assert.ok(module, 'the canonical Seeds and Seed Sovereignty module must remain available');

  assert.equal(draft.title.sourceEnglish, module.title, 'the card title stays paired to its exact English source');
  assert.equal(draft.title.reviewStatus, 'hold', 'Seed Sovereignty stays exact English');
  assert.equal(draft.title.sesothoDraft, module.title, 'the module title remains exact English');
  assert.equal(draft.description.sourceEnglish, module.description, 'the card description stays paired to its exact English source');
  assert.equal(draft.description.reviewStatus, 'hold', 'uncertain storage wording remains held');
  assert.equal(draft.description.sesothoDraft, module.description, 'the module description remains exact English');
  const modulePresentation = resolveCourseModulePresentation(module, 'st');
  assert.equal(modulePresentation.status, 'english-fallback', 'an all-English card must not claim to be translated');
  assert.equal(modulePresentation.title, module.title);
  assert.equal(modulePresentation.description, module.description);
  assert.equal(draft.lessons.length, 3, 'all three lesson headings are available');
  assert.equal(draft.lessons[0].title.sesothoDraft, 'Bohlokoa ba ho Boloka Lipeo', 'L1 keeps the checked generic heading draft');
  assert.equal(draft.lessons[1].title.reviewStatus, 'hold', 'the technical methods title stays held');
  assert.equal(draft.lessons[1].title.sesothoDraft, module.lessons[1].title, 'the L2 title remains exact English');
  assert.equal(draft.lessons[2].title.sesothoDraft, 'Ho Omisa, ho Boloka le ho Arolelana Lipeo', 'L3 keeps the checked generic heading draft');
  assert.equal(draft.lessons[0].title.reviewStatus, 'machine-draft');
  assert.equal(draft.lessons[2].title.reviewStatus, 'machine-draft');

  for (const lesson of module.lessons) {
    const sourceDraft = draft.lessons.find(candidate => candidate.id === lesson.id);
    assert.ok(sourceDraft, `${lesson.id}: matching paired draft must exist`);
    const presentation = resolveLearnerLessonPresentation(lesson, 'st');
    assert.equal(presentation.status, sourceDraft.title.reviewStatus === 'machine-draft' ? 'draft' : 'english-fallback',
      `${lesson.id}: only lessons with translated headings are marked as drafts`);
    assert.equal(sourceDraft.title.sourceEnglish, lesson.title, `${lesson.id}: preserve the exact English title`);
    assert.equal(presentation.content.title,
      sourceDraft.title.reviewStatus === 'hold' ? lesson.title : sourceDraft.title.sesothoDraft,
      `${lesson.id}: held technical title stays English and generic headings remain drafts`);

    assert.equal(sourceDraft.body.reviewStatus, 'hold', `${lesson.id}: teaching copy stays held`);
    assert.equal(sourceDraft.body.sourceEnglish, lesson.body, `${lesson.id}: preserve the exact English body source`);
    assert.equal(sourceDraft.body.sesothoDraft, lesson.body, `${lesson.id}: do not translate lesson advice`);
    assert.equal(presentation.content.body, lesson.body, `${lesson.id}: learners receive exact English teaching copy`);
    assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints, `${lesson.id}: key points remain exact English`);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, `${lesson.id}: questions, choices and rationales remain exact English`);

    if (lesson.infographicAlt) {
      assert.equal(sourceDraft.infographicAlt?.reviewStatus, 'hold', `${lesson.id}: image description stays held`);
      assert.equal(presentation.content.infographicAlt, lesson.infographicAlt, `${lesson.id}: image description remains exact English`);
    }

    const changedTitle = { ...lesson, title: `${lesson.title} changed` };
    assert.equal(resolveLearnerLessonPresentation(changedTitle, 'st').status, 'english-fallback',
      `${lesson.id}: changed source title withdraws the paired draft`);
  }

  const changedDescription = { ...module, description: `${module.description} changed` };
  assert.equal(resolveCourseModulePresentation(changedDescription, 'st').status, 'english-fallback',
    'changed English module description withdraws the paired card draft');

  assert.match(STUDENT_PAGE, /regionalDraft && <span[\s\S]*?AI draft · review pending/,
    'the lesson label remains visibly marked as pending review');
  assert.match(STUDENT_PAGE, /Unreviewed \{lang === 'st' \? 'Sesotho'[\s\S]*?Exact English source is shown alongside the lesson and answers\. Slides and narration remain in English\./,
    'learners are told the English lesson and media are still the reference');
  assert.match(STUDENT_PAGE, /modulePresentation\.status === 'draft' \? `\$\{lang === 've' \? 'Tshivenda ' : ''\}AI draft · review pending` : 'English module'/,
    'an all-English module card is visibly identified as English');
  assert.match(STUDENT_PAGE, /<p className="font-semibold">Exact English source<\/p>\s*<p><span className="font-semibold">Title:<\/span> \{lesson\.title\}<\/p>/,
    'the lesson title appears with its exact English source');
});
