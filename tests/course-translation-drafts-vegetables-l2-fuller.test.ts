import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';

const evidence = (name: string) => JSON.parse(readFileSync(
  new URL(`../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-${name}.json`, import.meta.url), 'utf8'));
const baseline = evidence('BASELINE');
const applied = evidence('APPLIED');
const drafts = { st, ve, ts } as const;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
type Language = keyof typeof drafts;
const canonicalModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const canonicalLesson = canonicalModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;

function pairAt(draft: any, fieldPath: string): any {
  const lesson = draft.lessons.find((item: any) => item.id === 'vegetables-staples-l2');
  const [kind, first, second, third] = fieldPath.split('.');
  if (kind === 'body') return lesson.body;
  if (kind === 'keyPoints') return lesson.keyPoints[Number(first)];
  if (kind === 'quiz') {
    const question = lesson.quiz[Number(first)];
    return second === 'options' ? question.options[Number(third)] : question[second === 'q' ? 'question' : second];
  }
  throw new Error(`Unsupported Vegetables L2 field: ${fieldPath}`);
}

function canonicalSource(fieldPath: string): string {
  const [kind, first, second, third] = fieldPath.split('.');
  if (kind === 'body') return canonicalLesson.body.split('\n\n')[Number(second)];
  if (kind === 'keyPoints') return canonicalLesson.keyPoints[Number(first)];
  const question = canonicalLesson.quiz[Number(first)];
  return second === 'options' ? question.options[Number(third)] : (question as any)[second === 'q' ? 'q' : second];
}

function targetText(pair: any, language: Language, fieldPath: string): string {
  const value = pair[targetKey[language]];
  return fieldPath.startsWith('body.') ? value.split('\n\n')[Number(fieldPath.split('.')[2])] : value;
}

function setTarget(pair: any, language: Language, row: any): void {
  const key = targetKey[language];
  if (row.fieldPath.startsWith('body.')) {
    const paragraphs = pair[key].split('\n\n');
    paragraphs[Number(row.fieldPath.split('.')[2])] = row.appliedTarget;
    pair[key] = paragraphs.join('\n\n');
  } else pair[key] = row.appliedTarget;
  pair.reviewStatus = row.appliedReviewStatus;
}

test('Vegetables L2 fuller drafts retain the 27 final source-bound fields and exact lesson source', () => {
  assert.deepEqual(canonicalModule, baseline.canonical,
    'learner wording must not change canonical lesson text, questions, answer order, or module data');
  assert.equal(applied.fields.length, 27);
  assert.equal(applied.summary.changedLearnerFields, 27);

  for (const language of Object.keys(drafts) as Language[]) {
    const expected = structuredClone(baseline.drafts[language]);
    for (const row of applied.fields.filter((item: any) => item.language === language)) {
      const prior = pairAt(baseline.drafts[language], row.fieldPath);
      const source = canonicalSource(row.fieldPath);
      const live = pairAt(drafts[language], row.fieldPath);
      assert.equal(row.sourceEnglish, source, `${language}/${row.fieldPath}: checked source must still match canonical English`);
      assert.equal(prior.sourceEnglish, row.fieldPath.startsWith('body.') ? canonicalLesson.body : row.sourceEnglish,
        `${language}/${row.fieldPath}: original full source pair is retained`);
      assert.equal(targetText(prior, language, row.fieldPath), row.currentTarget,
        `${language}/${row.fieldPath}: recorded before-state matches the frozen registry`);
      assert.equal(prior.reviewStatus, row.currentReviewStatus,
        `${language}/${row.fieldPath}: recorded prior status matches the frozen registry`);
      assert.equal(live.sourceEnglish, row.fieldPath.startsWith('body.') ? canonicalLesson.body : source,
        `${language}/${row.fieldPath}: live pair remains bound to exact English`);
      assert.equal(targetText(live, language, row.fieldPath), row.appliedTarget,
        `${language}/${row.fieldPath}: checked target reaches the intended learner field`);
      assert.equal(live.reviewStatus, row.appliedReviewStatus,
        `${language}/${row.fieldPath}: target status is retained as an unreviewed draft`);
      setTarget(pairAt(expected, row.fieldPath), language, row);
    }
    assert.deepEqual(drafts[language], expected,
      `${language}: every unlisted lesson, paragraph, key point, assessment, and status remains unchanged`);

    const presentation = resolveLearnerLessonPresentation(canonicalLesson, language);
    assert.equal(presentation.status, 'draft', `${language}: wording remains visibly marked as draft`);
    assert.equal(canonicalLesson.body.split('\n\n').length, 23,
      '2026-10-05 L2 completion must retain all 23 ordered source paragraphs');
    const lessonDraft = drafts[language].lessons.find(item => item.id === canonicalLesson.id)!;
    assert.equal((lessonDraft.body as any).sourceEnglish, canonicalLesson.body,
      `${language}: the complete English body stays paired after field replacements`);
    assert.equal((lessonDraft.body as any)[targetKey[language]].split('\n\n').length, 23,
      `${language}: every source paragraph keeps its position`);
    assert.deepEqual(presentation.content.quiz.map((question: any) => question.correct), [1, 1],
      `${language}: both source answer positions remain in order`);
  }
  const tsBody = (ts.lessons.find(item => item.id === canonicalLesson.id)!.body as any).xitsongaDraft.split('\n\n');
  const tsBaselineBody = (baseline.drafts.ts.lessons.find((item: any) => item.id === canonicalLesson.id)!.body as any).xitsongaDraft.split('\n\n');
  assert.equal(tsBody[19], tsBaselineBody[19],
    '2026-10-05 reconciliation restores the existing localized “loko” wording instead of adding an English “when”');
  assert.match(tsBody[9], /^Mavhiki mambirhi ku ya eka manharhu i starting rhythm, a hi nawu\./,
    'the checked interval stays localized while only the uncertain technical phrase remains English');
});

test('A changed Vegetables L2 source withdraws the complete regional draft', () => {
  const changed = {
    ...canonicalLesson,
    body: canonicalLesson.body.replace('Plant a short row every two to three weeks.', 'Plant a longer row every two to three weeks.'),
  };
  assert.notEqual(changed.body, canonicalLesson.body, 'fixture must change the source instruction');
  for (const language of Object.keys(drafts) as Language[]) {
    const result = resolveLearnerLessonPresentation(changed, language);
    assert.equal(result.status, 'english-fallback', `${language}: stale wording must not survive source drift`);
    assert.equal(result.content.body, changed.body, `${language}: fallback preserves the changed canonical instruction`);
  }
});

test('Vegetables L2 keeps sowing limits, the harvest caveat, and the original quiz key', () => {
  assert.equal(canonicalLesson.quiz[0].correct, 1);
  assert.equal(canonicalLesson.quiz[1].correct, 1);
  const caveat = canonicalLesson.body.split('\n\n')[4];
  const candidates = {
    st: (st.lessons.find(item => item.id === canonicalLesson.id)!.body as any).sesothoDraft,
    ve: (ve.lessons.find(item => item.id === canonicalLesson.id)!.body as any).tshivendaDraft,
    ts: (ts.lessons.find(item => item.id === canonicalLesson.id)!.body as any).xitsongaDraft,
  };
  for (const language of Object.keys(drafts) as Language[]) {
    const paragraphs = candidates[language].split('\n\n');
    const baselineBody = (baseline.drafts[language].lessons.find((item: any) => item.id === canonicalLesson.id)!.body as any)[targetKey[language]];
    assert.equal(paragraphs[4], baselineBody.split('\n\n')[4], `${language}: existing harvest caveat wording remains unchanged`);
    assert.match(caveat, /They do not guarantee a harvest if difficult conditions continue\./);
    assert.equal(pairAt(drafts[language], 'quiz.0.options.1').sourceEnglish, canonicalLesson.quiz[0].options[1]);
    assert.equal(pairAt(drafts[language], 'quiz.0.rationale').sourceEnglish, canonicalLesson.quiz[0].rationale);
  }
});
