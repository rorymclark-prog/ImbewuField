import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Language = 'st' | 'ts' | 've';
const read = (suffix: string) => JSON.parse(readFileSync(new URL(`../docs/study-translation-reviews/VEGETABLES-L1-FULLER-ORDINARY-2026-10-05-${suffix}.json`, import.meta.url), 'utf8'));
const applied = read('APPLIED');
const baseline = read('BASELINE');
const keys = { st: 'sesothoDraft', ts: 'xitsongaDraft', ve: 'tshivendaDraft' };
function pairAt(draft: any, field: string): any {
  const parts = field.split('.');
  const lesson = draft.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l1');
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
// 5 October: earlier tests record the original English holds and partially localized
// passages. They still protect that history; current accepted targets are checked before
// inversion, and every unscoped field must equal the frozen native module afterward.
export function vegetablesBeforeFuller<T>(language: Language, actual: T): T {
  const reconstructed: any = structuredClone(actual);
  const key = keys[language];
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
  assert.deepEqual(reconstructed, baseline.drafts[language], `${language}: preserve whole pre-completion registry, not merely a prefix`);
  return reconstructed as T;
}
