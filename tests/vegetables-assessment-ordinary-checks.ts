import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as tsL2 } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
const folder = '../docs/study-translation-reviews/vegetables-assessment-ordinary-2026-10-06/';
const read = (file: string) => readFileSync(new URL(folder + file, import.meta.url));
const pins = {
  'native-before.json': '5243ec72e5aff681577f47aea80696ea1c23492bce4bbf47b52d4e8a6a38722b',
  'native-after.json': 'd1be0db9cca313e436f6e8d23ddc824434692c56d9483040e8730c259ad33835',
  'root-accepted.json': '3209a9593292790ffa7e86ed89aac9940d07146b01ed16b10532709f5aed6c0e',
};
for (const [file, hash] of Object.entries(pins)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
export const assessmentBefore = JSON.parse(read('native-before.json').toString());
export const assessmentAfter = JSON.parse(read('native-after.json').toString());
export const assessmentRows = JSON.parse(read('root-accepted.json').toString()).acceptedRows as any[];
export const assessmentDrafts = { st, ve, ts, tsL2 };
export type AssessmentLanguage = 'st' | 've' | 'ts';
const sourceModule = () => COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const targetKey = (language: AssessmentLanguage) => language === 've' ? 'tshivendaDraft' : language === 'ts' ? 'xitsongaDraft' : 'sesothoDraft';
const rowsFor = (language: AssessmentLanguage, registry: any) => assessmentRows.filter(row => row.language === language && registry.lessons.some((lesson: any) => lesson.id === row.lessonId));
const fieldName = (row: any) => row.fieldId.endsWith('.question') ? 'question' : row.fieldId.endsWith('.rationale') ? 'rationale' : 'options';
const pairAt = (registry: any, row: any) => {
  const quiz = registry.lessons.find((lesson: any) => lesson.id === row.lessonId).quiz[row.questionIndex];
  return fieldName(row) === 'options' ? quiz.options[Number(row.optionIndex)] : quiz[fieldName(row)];
};
const registryName = (language: AssessmentLanguage, registry: any) => language === 'ts' && registry.lessons.every((lesson: any) => lesson.id === 'vegetables-staples-l2') ? 'tsL2' : language;

/** 6 October: validate the full actual approved layer before exposing any older pest or L3 snapshot. */
export function vegetablesBeforeAssessmentOrdinary<T>(language: AssessmentLanguage, actual: T): T {
  assert.deepEqual(sourceModule(), assessmentBefore.canonical, 'all canonical Vegetable source/indices stay exact');
  const key = registryName(language, actual);
  const previous = assessmentBefore.drafts[key];
  const expected = structuredClone(previous);
  for (const row of rowsFor(language, previous)) {
    const pair = pairAt(expected, row);
    const sourceQuiz = sourceModule().lessons.find(lesson => lesson.id === row.lessonId)!.quiz[row.questionIndex];
    const sourceText = fieldName(row) === 'options' ? sourceQuiz.options[Number(row.optionIndex)] : fieldName(row) === 'question' ? sourceQuiz.q : sourceQuiz.rationale;
    assert.equal(pair.sourceEnglish, row.sourceEnglish);
    assert.equal(sourceText, row.sourceEnglish);
    assert.equal(pair[targetKey(language)], row.currentTarget);
    pair[targetKey(language)] = row.recommendedTarget;
    pair.reviewStatus = 'machine-draft';
  }
  assert.deepEqual(expected, assessmentAfter.drafts[key], `${key}: fixed before plus accepted18-only overlay equals fixed after`);
  assert.deepEqual(actual, expected, `${key}: whole current source/targets/status/order/indices/unlisted match accepted after`);
  const restored: any = structuredClone(actual);
  for (const row of rowsFor(language, previous)) Object.assign(pairAt(restored, row), pairAt(previous, row));
  assert.deepEqual(restored, previous, `${key}: only accepted18 leaves rewind to the exact full prior registry`);
  return restored;
}

export function vegetablesAssessmentPresentationBeforeOrdinary(lesson: Lesson, language: AssessmentLanguage) {
  const registry = language === 'ts' && lesson.id === 'vegetables-staples-l2' ? tsL2 : assessmentDrafts[language];
  vegetablesBeforeAssessmentOrdinary(language, registry);
  const shown = structuredClone(resolveLearnerLessonPresentation(lesson, language));
  if (shown.status !== 'draft') return shown;
  for (const row of rowsFor(language, registry).filter(row => row.lessonId === lesson.id)) {
    const quiz = shown.content.quiz[row.questionIndex];
    const field = fieldName(row);
    const current = field === 'options' ? quiz.options[Number(row.optionIndex)] : field === 'question' ? quiz.q : quiz.rationale;
    assert.equal(current, row.recommendedTarget, `${row.fieldId}: actual resolved learner target matches accepted layer`);
    if (field === 'options') quiz.options[Number(row.optionIndex)] = row.currentTarget;
    else if (field === 'question') quiz.q = row.currentTarget;
    else quiz.rationale = row.currentTarget;
  }
  return shown;
}
