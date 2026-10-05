import { vegetablesL3BeforeCompletion } from './vegetables-l3-completion-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Language = 'st' | 'ts' | 've';
const read = (suffix: string) => JSON.parse(readFileSync(new URL(`../docs/study-translation-reviews/VEGETABLES-L1-FULLER-ORDINARY-2026-10-05-${suffix}.json`, import.meta.url), 'utf8'));
const applied = read('APPLIED');
const baseline = read('BASELINE');
const l4Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L4-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
const l2Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
const l2Baseline = read('BASELINE');
const keys = { st: 'sesothoDraft', ts: 'xitsongaDraft', ve: 'tshivendaDraft' };
function pairAt(draft: any, field: string, lessonId = 'vegetables-staples-l1'): any {
  const parts = field.split('.');
  const lesson = draft.lessons.find((lesson: any) => lesson.id === lessonId);
  if (parts[0] === 'module') return draft[parts[1]];
  if (parts[0] === 'body') return lesson.body;
  if (parts[0] === 'keyPoints') return lesson.keyPoints[Number(parts[1])];
  const question = lesson.quiz[Number(parts[1])];
  return parts[2] === 'options' ? question.options[Number(parts[3])] : question[parts[2] === 'q' ? 'question' : parts[2]];
}
export function vegetablesFullerTarget(language: Language, field: string): string {
  const row = applied.fields.find((row: any) => row.language === language && row.fieldPath === field);
  assert.ok(row, `${language}/${field}: final reviewed source-bound field must exist`);
  return row.appliedTarget;
}
// The L1 snapshots predate two source-bound completion batches. Invert both batches so
// historical assertions still check the frozen pre-L1 registry; current targets are
// verified before inversion and no unlisted field is rewritten.
export function vegetablesBeforeFuller<T>(language: Language, actual: T): T {
  // 6 October: verify and invert only the accepted L3 assessment leaves before older whole-module snapshots.
  const reconstructed: any = vegetablesL3BeforeCompletion(language, actual);
  const key = keys[language];
  // 5 October 2026: the final L2 batch was applied after the L1/L4 snapshots.
  // Validate its exact targets, then invert only those source-bound fields before
  // checking the older whole-module fixture.
  for (const row of l2Applied.fields.filter((row: any) => row.language === language && row.language !== 'ts')) {
    const pair = pairAt(reconstructed, row.fieldPath, row.lessonId);
    const original = pairAt(l2Baseline.drafts[language], row.fieldPath, row.lessonId);
    assert.equal(pair.reviewStatus, row.appliedReviewStatus,
      `${language}/${row.fieldPath}: current final status is checked before reconstruction`);
    assert.equal(original.reviewStatus, row.currentReviewStatus,
      `${language}/${row.fieldPath}: frozen before-state status remains exact`);
    if (row.fieldPath.startsWith('body.')) {
      const index = Number(row.fieldPath.split('.')[2]);
      const paragraphs = pair[key].split('\n\n');
      const originalParagraphs = original[key].split('\n\n');
      assert.equal(originalParagraphs[index], row.currentTarget,
        `${language}/${row.fieldPath}: frozen before-state target remains exact`);
      assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish,
        `${language}/${row.fieldPath}: current source remains exact before historical reconstruction`);
      assert.equal(paragraphs[index], row.appliedTarget,
        `${language}/${row.fieldPath}: final L2 target is checked before historical reconstruction`);
      paragraphs[index] = row.currentTarget;
      pair[key] = paragraphs.join('\n\n');
    } else {
      assert.equal(pair.sourceEnglish, row.sourceEnglish);
      assert.equal(original[key], row.currentTarget,
        `${language}/${row.fieldPath}: frozen before-state target remains exact`);
      assert.equal(pair[key], row.appliedTarget,
        `${language}/${row.fieldPath}: final L2 target is checked before historical reconstruction`);
      pair[key] = row.currentTarget;
    }
    pair.reviewStatus = row.currentReviewStatus;
  }
  // The dedicated Xitsonga L2 registry is separate from the legacy module object
  // used by these historical L1 snapshots; its exact state is checked in the L2 test.
  for (const row of l2Applied.restoredToBaseline.filter((row: any) => row.language === language && row.language !== 'ts')) {
    const pair = pairAt(reconstructed, row.fieldPath, row.lessonId);
    const index = Number(row.fieldPath.split('.')[2]);
    const paragraphs = pair[key].split('\n\n');
    const frozen = pairAt(l2Baseline.drafts[language], row.fieldPath, row.lessonId);
    assert.equal(paragraphs[index], row.restoredTarget,
      `${language}/${row.fieldPath}: final reconciliation preserves the existing localized wording`);
    assert.equal(frozen[key].split('\n\n')[index], row.restoredTarget,
      `${language}/${row.fieldPath}: no false translation change is introduced`);
  }
  for (const row of applied.fields.filter((row: any) => row.language === language)) {
    const pair = pairAt(reconstructed, row.fieldPath);
    const original = pairAt(baseline.drafts[language], row.fieldPath);
    assert.equal(pair.reviewStatus, 'machine-draft');
    if (row.fieldPath.startsWith('body.')) {
      const index = Number(row.fieldPath.split('.')[2]);
      const paragraphs = pair[key].split('\n\n');
      assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish);
      assert.equal(paragraphs[index], row.appliedTarget);
      paragraphs[index] = row.currentTarget;
      pair[key] = paragraphs.join('\n\n');
    } else {
      assert.equal(pair.sourceEnglish, row.sourceEnglish);
      assert.equal(pair[key], row.appliedTarget);
      pair[key] = row.currentTarget;
    }
    pair.reviewStatus = original.reviewStatus;
  }
  for (const row of l4Applied.fields.filter((row: any) => row.language === language && row.changedFromCurrent)) {
    const pair = pairAt(reconstructed, row.fieldPath, 'vegetables-staples-l4');
    if (row.fieldPath.startsWith('body.')) {
      const index = Number(row.fieldPath.split('.')[2]);
      const paragraphs = pair[key].split('\n\n');
      assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish);
      assert.equal(paragraphs[index], row.appliedTarget,
        `${language}/${row.fieldPath}: current L4 target is checked before reconstructing the older L1 snapshot`);
      paragraphs[index] = row.currentTarget;
      pair[key] = paragraphs.join('\n\n');
    } else {
      assert.equal(pair.sourceEnglish, row.sourceEnglish);
      assert.equal(pair[key], row.appliedTarget,
        `${language}/${row.fieldPath}: current L4 target is checked before reconstructing the older L1 snapshot`);
      pair[key] = row.currentTarget;
    }
    pair.reviewStatus = row.currentReviewStatus;
  }
  assert.deepEqual(reconstructed, baseline.drafts[language], `${language}: preserve whole pre-completion registry, not merely a prefix`);
  return reconstructed as T;
}
