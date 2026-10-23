import { readingComparisonCanonicalBefore as canonicalBefore, readingComparisonAcceptedClause as acceptedClause, validateAndRewindReadingComparison as validateAndRewind } from './reading-comparison-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Sesotho frost comparison keeps can and nearby slopes without an invented intensity', () => {
  validateAndRewind(SESOTHO_READING_LANDSCAPE_DRAFT);
  const source = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  assert.deepEqual(source, canonicalBefore, 'the entire canonical module stays byte-equivalent as data');
  const draft = SESOTHO_READING_LANDSCAPE_DRAFT.lessons[2];
  const sourceClause = 'These places can be colder than nearby slopes.';
  assert.ok(source.lessons[2].body.includes(sourceClause));
  assert.equal(draft.body.sourceEnglish, source.lessons[2].body);
  const paragraph = draft.body.sesothoDraft.split('\n\n')[1];
  assert.ok(paragraph.includes(acceptedClause));
  assert.doesNotMatch(paragraph, /bata haholo ho feta/);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const presented = resolveLearnerLessonPresentation(source.lessons[2], 'st');
  assert.equal(presented.status, 'draft');
  assert.equal(presented.content.body, draft.body.sesothoDraft);
  const deck = JSON.parse(readFileSync(new URL('../docs/narration/reading-landscape.st.paired-draft.json', import.meta.url), 'utf8'));
  const slide = deck.slides.find((item: { n: number }) => item.n === 14);
  assert.ok(slide.english.body.some((text: string) => text.includes(sourceClause)));
  assert.ok(JSON.stringify(slide.target).includes(acceptedClause), 'the same-source paired deck already carries this conservative comparison');
});

test('comparison preservation rejects lost can, source changes and unrelated answer changes before rewind', () => {
  for (const mutate of [
    (draft: typeof SESOTHO_READING_LANDSCAPE_DRAFT) => { draft.lessons[2].body.sesothoDraft = draft.lessons[2].body.sesothoDraft.replace('di ka bata ho feta', 'di bata ho feta'); },
    (draft: typeof SESOTHO_READING_LANDSCAPE_DRAFT) => { draft.lessons[2].body.sourceEnglish += ' Changed.'; },
    (draft: typeof SESOTHO_READING_LANDSCAPE_DRAFT) => { draft.lessons[0].quiz[0].sourceCorrectIndex = 1; },
    (draft: typeof SESOTHO_READING_LANDSCAPE_DRAFT) => { draft.lessons[3].keyPoints[0].sesothoDraft += ' Changed.'; },
  ]) {
    const changed = structuredClone(SESOTHO_READING_LANDSCAPE_DRAFT);
    mutate(changed);
    assert.throws(() => validateAndRewind(changed), 'a reconstruction must never mask an unapproved change');
  }
});

test('changed English frost comparison withdraws the entire paired Sesotho lesson', () => {
  const source = COURSE_MODULES.find(module => module.id === 'reading-landscape')!.lessons[2];
  const changed = { ...source, body: source.body.replace('These places can be colder', 'These places are colder') };
  const fallback = resolveLearnerLessonPresentation(changed, 'st');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});
