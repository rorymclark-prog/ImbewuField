import { finalLanguageNextPresentationBefore } from './final-language-next-checks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { assessmentBefore, assessmentRows, assessmentDrafts, vegetablesBeforeAssessmentOrdinary } from './vegetables-assessment-ordinary-checks.ts';

test('Vegetables18 assessment leaves preserve whole canonical/source/order/indices/status and all unlisted native fields', () => {
  assert.equal(assessmentRows.length, 18);
  assert.equal(assessmentRows.filter(row => row.language === 've').length, 8);
  for (const [key, registry] of Object.entries(assessmentDrafts)) {
    const language = key === 'tsL2' ? 'ts' : key as 'st' | 've' | 'ts';
    assert.deepEqual(vegetablesBeforeAssessmentOrdinary(language, registry), assessmentBefore.drafts[key]);
  }
  for (const row of assessmentRows) {
    const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === row.lessonId)!;
    const shown = finalLanguageNextPresentationBefore(resolveLearnerLessonPresentation(source, row.language), source.id, row.language);
    assert.equal(shown.status, 'draft');
    const question = shown.content.quiz[row.questionIndex];
    const actual = row.fieldId.endsWith('.question') ? question.q : row.fieldId.endsWith('.rationale') ? question.rationale : question.options[Number(row.optionIndex)];
    assert.equal(actual, row.recommendedTarget);
    assert.equal(question.correct, source.quiz[row.questionIndex].correct);
  }
});

test('Vegetables assessment guards reject modal/comparative/source/index and unrelated native drift before any rewind', () => {
  const mutate = (edit: (draft: any) => void) => { const draft = structuredClone(assessmentDrafts.ve); edit(draft); assert.throws(() => vegetablesBeforeAssessmentOrdinary('ve', draft)); };
  const l = (draft: any, n: number) => draft.lessons.find((lesson: any) => lesson.id === `vegetables-staples-l${n}`);
  mutate(draft => l(draft, 2).quiz[1].question.tshivendaDraft = l(draft, 2).quiz[1].question.tshivendaDraft.replace('i nga ', ''));
  mutate(draft => l(draft, 3).quiz[0].options[0].tshivendaDraft = 'Varieties dza open-pollinated yield many.');
  mutate(draft => l(draft, 3).quiz[1].rationale.sourceEnglish += ' now');
  mutate(draft => l(draft, 1).quiz[0].sourceCorrectIndex = 0);
  mutate(draft => l(draft, 1).keyPoints[0].tshivendaDraft += ' unrelated');
  mutate(draft => l(draft, 2).quiz[1].rationale.reviewStatus = 'hold');
});

test('Vegetables quiz source drift falls back while nitrogen/genetics/wet-ground and existing timing comparisons remain exact', () => {
  for (const row of assessmentRows) {
    const lesson = structuredClone(COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === row.lessonId)!);
    const quiz = lesson.quiz[row.questionIndex];
    if (row.fieldId.endsWith('.question')) quiz.q += ' changed';
    else if (row.fieldId.endsWith('.rationale')) quiz.rationale += ' changed';
    else quiz.options[Number(row.optionIndex)] += ' changed';
    assert.equal(resolveLearnerLessonPresentation(lesson, row.language).status, 'english-fallback', row.fieldId);
  }
  for (const language of ['ve','ts'] as const) {
    // Validate the whole latest presentation before this dated nonguarantee predicate.
    const lesson = (n: number) => { const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === `vegetables-staples-l${n}`)!; return finalLanguageNextPresentationBefore(resolveLearnerLessonPresentation(source, language), source.id, language).content; };
    assert.ok(lesson(3).quiz[0].options[0].includes('yield more'));
    assert.ok(lesson(2).quiz[1].rationale.includes('does not guarantee immediate feeding'));
    assert.ok(lesson(3).quiz[1].rationale.startsWith('Amadumbe actually prefers damper ground where maize would struggle —'));
    const oldKey = language === 've' ? 've' : 'ts';
    const old = assessmentBefore.drafts[oldKey].lessons.find((item: any) => item.id === 'vegetables-staples-l3');
    const targetKey = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
    assert.equal(lesson(3).quiz[1].options[3], old.quiz[1].options[3][targetKey], 'existing only/multiple-years native target stays exact');
    assert.equal(lesson(1).quiz[1].rationale, assessmentBefore.drafts[oldKey].lessons.find((item: any) => item.id === 'vegetables-staples-l1').quiz[1].rationale[targetKey], 'quick/sensitive-rooted technical first clause and remaining rationale stay exact');
  }
});
