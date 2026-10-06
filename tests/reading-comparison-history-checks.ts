import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { nativeOrdinaryBeforeFinalBatch } from './native-ordinary-final-history-checks.ts';

const folder = new URL('../docs/study-translation-reviews/reading-comparison-2026-10-06/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, folder), 'utf8');
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const readingComparisonBefore = JSON.parse(read('native-before.json')) as typeof SESOTHO_READING_LANDSCAPE_DRAFT;
export const readingComparisonCanonicalBefore = JSON.parse(read('canonical-before.json'));
const previousClause = 'Dibaka tsena di ka bata haholo ho feta matswapo a haufi.';
export const readingComparisonAcceptedClause = 'Dibaka tsena di ka bata ho feta matswapo a haufi.';

// 2026-10-06: source says can be colder, without an intensity qualifier.
// Validate the entire accepted overlay before rewinding the single reviewed word;
// otherwise a historical snapshot could hide unrelated source or assessment drift.
export function validateAndRewindReadingComparison(current: typeof SESOTHO_READING_LANDSCAPE_DRAFT) {
  // Later ordinary-prose fields legitimately changed this registry. Validate the
  // complete latest source/target/status overlay before testing the older one-word claim.
  const prior = nativeOrdinaryBeforeFinalBatch(current);
  assert.equal(digest(read('native-before.json')), 'b78779cd8f5d48214947cf6588b80ede94b0256a4b8dea5fd49740ea82be87f8');
  assert.equal(digest(read('canonical-before.json')), '5062622d592cef5675704cbcf1e15f3c6c1b923e025daa2aa4e5a048a4272454');
  assert.deepEqual(COURSE_MODULES.find(module => module.id === 'reading-landscape'), readingComparisonCanonicalBefore, 'canonical Reading module stays exact before historical reconstruction');
  const expected = structuredClone(readingComparisonBefore);
  const oldBody = expected.lessons[2].body.sesothoDraft;
  assert.equal(oldBody.split(previousClause).length, 2, 'only one historical comparison is eligible');
  expected.lessons[2].body.sesothoDraft = oldBody.replace(previousClause, readingComparisonAcceptedClause);
  assert.deepEqual(prior, expected, 'after validating later prose, only the root-accepted comparison word changes the historical registry');
  const restored = structuredClone(prior);
  restored.lessons[2].body.sesothoDraft = oldBody;
  assert.deepEqual(restored, readingComparisonBefore, 'all unlisted fields, statuses, source bindings and correct indices stay exact');
  return restored;
}

export function readingBodyBeforeComparison(currentBody: string) {
  const historical = validateAndRewindReadingComparison(SESOTHO_READING_LANDSCAPE_DRAFT);
  assert.equal(currentBody, SESOTHO_READING_LANDSCAPE_DRAFT.lessons[2].body.sesothoDraft, 'passed resolved body is the actual accepted current learner body');
  return historical.lessons[2].body.sesothoDraft;
}
