import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
import { vegetablesDeckBeforePestPrecision } from './vegetables-pest-precision-checks.ts';

const evidence = (name: string) => JSON.parse(readFileSync(
  new URL(`../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-DECK-${name}.json`, import.meta.url), 'utf8'));
const baseline = evidence('BASELINE');
const applied = evidence('APPLIED');
const currentFiles = {
  st: 'vegetables-staples.st.paired-draft.json',
  ve: 'vegetables-staples.ve.paired-draft.json',
  ts: 'vegetables-staples.ts.paired-draft.json',
} as const;
const currentLive = Object.fromEntries(Object.entries(currentFiles).map(([language, filename]) => [
  language,
  JSON.parse(readFileSync(new URL(`../docs/narration/${filename}`, import.meta.url), 'utf8')),
])) as Record<keyof typeof currentFiles, any>;
const current = Object.fromEntries(Object.entries(currentLive).map(([language, deck]) => [
  language,
  vegetablesDeckBeforePestPrecision(language as Language, deck),
])) as Record<keyof typeof currentFiles, any>;
const learnerDrafts = { st, ve, ts } as const;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
type Language = keyof typeof learnerDrafts;
const canonicalLesson = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons
  .find(lesson => lesson.id === 'vegetables-staples-l2')!;

test('Vegetables L2 paired cards reuse only nine complete source-matched learner rows', () => {
  assert.equal(applied.entries.length, 9);
  assert.deepEqual(applied.summary.changedSlides, { st: [10], ve: [8, 10], ts: [8, 9, 10] });
  const expected = structuredClone(baseline.decks);
  for (const row of applied.entries) {
    const language = row.language as Language;
    const sourceParagraph = canonicalLesson.body.split('\n\n')[Number(row.learnerFieldPath.split('.')[2])];
    const slideBefore = baseline.decks[language].slides[row.slideArrayIndex];
    const slideNow = current[language].slides[row.slideArrayIndex];
    assert.equal(row.exactWholeRowMatch, true);
    assert.equal(row.sourceEnglish, sourceParagraph, `${language}/slide${row.slideNumber}: exact canonical paragraph source`);
    assert.equal(slideBefore.n, row.slideNumber);
    assert.equal(slideNow.n, row.slideNumber);
    assert.equal(slideBefore.english.body[row.bodyIndex], row.sourceEnglish);
    assert.equal(slideNow.english.body[row.bodyIndex], row.sourceEnglish,
      `${language}/slide${row.slideNumber}: English remains the exact complete source row`);
    assert.deepEqual(slideBefore.target.body[row.bodyIndex], row.currentTarget,
      `${language}/slide${row.slideNumber}: recorded before-state is exact`);
    assert.deepEqual(slideNow.target.body[row.bodyIndex], row.proposedTarget,
      `${language}/slide${row.slideNumber}: only the reviewed target row is replaced`);
    const learner = learnerDrafts[language].lessons.find(item => item.id === row.lessonId)!;
    const learnerParagraph = (learner.body as any)[targetKey[language]].split('\n\n')[Number(row.learnerFieldPath.split('.')[2])];
    assert.equal(learnerParagraph, row.proposedTarget.text,
      `${language}/slide${row.slideNumber}: slide text exactly reuses its matching learner target`);
    assert.equal(row.proposedTarget.status, 'draft');
    expected[language].slides[row.slideArrayIndex].target.body[row.bodyIndex] = row.proposedTarget;
  }
  assert.deepEqual(current, expected,
    'all other headings, body rows, counters, language metadata, statuses, and source text remain unchanged');
});

test('Unchanged Xitsonga slide rows keep their existing localized text and source pairing', () => {
  for (const [slideNumber, bodyIndex] of [[11, 1]]) {
    const before = baseline.decks.ts.slides.find((slide: any) => slide.n === slideNumber)!;
    const after = current.ts.slides.find((slide: any) => slide.n === slideNumber)!;
    assert.deepEqual(after.english.body[bodyIndex], before.english.body[bodyIndex]);
    assert.deepEqual(after.target.body[bodyIndex], before.target.body[bodyIndex],
      `TS slide ${slideNumber} body ${bodyIndex}: preserve the existing localized prefix and remaining segments`);
  }
});
