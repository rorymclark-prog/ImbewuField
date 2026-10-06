import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { nativeOrdinaryBeforeFinalBatch } from './native-ordinary-final-history-checks.ts';

export type VegetablesL1Language = 'st' | 've' | 'ts';
const folder = '../docs/study-translation-reviews/vegetables-l1-ordinary-residual-2026-10-06/';
const pins = {
  'before.json': '099865ae01eba292a85a4e2ca2027bb3802a2503a72e5a55535a8f545aa4a7bc',
  'after.json': 'bc1958e3fb83012504d339a27dfc55a90e0ce7c1b37ea1e01385266a7100665d',
  'accepted-final.json': 'a1ee00a6b90454b48a49b2ff21ec824f134424fcef94e8369480548d2f7c4fbd',
  'first-independent-check.json': '0bca4d9f4b8605b805b52f84a2aa235eb9059e0ba324f3bdb6ac2908d640f2de',
  'semantic-refinement-provenance.json': 'a45d5e911b39aafeb285b10b7f7bf61664f19305ab14f3e0ae9696b611927a63',
  'current-binding-export.json': 'f6de628c5a10be575a080ba0974b4ae8e44db2a0bc4d98c5978f4dbfd130a441',
  'applied-proof.json': '379a5f9f01284f40b868a4fcf528676a088df0360e8371872219ab884f64be9d',
} as const;
const json = (name: keyof typeof pins): any => {
  const bytes = readFileSync(new URL(folder + name, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pins[name], `${name}: frozen accepted source/current/provenance`);
  return JSON.parse(bytes.toString());
};
export const vegetablesL1Before = json('before.json');
export const vegetablesL1After = json('after.json');
export const vegetablesL1Rows: any[] = json('applied-proof.json').rows;
export const vegetablesL1Drafts = { st, ve, ts };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const sourceModule = () => COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const lessonAt = (draft: any) => draft.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l1');
const visible = (pair: any): string => pair.status === 'mixed'
  ? pair.segments.map((segment: any) => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('')
  : pair.text;

/** Validate the entire current layer before restoring only its five reviewed native paragraphs. */
export function vegetablesBeforeL1Ordinary<T>(language: VegetablesL1Language, actual: T): T {
  // 6 October: validate and rewind the complete newest native overlay before this
  // historical five-paragraph snapshot is evaluated.
  actual = nativeOrdinaryBeforeFinalBatch(actual);
  const before = vegetablesL1Before;
  const after = vegetablesL1After;
  assert.deepEqual(sourceModule(), before.canonical, 'canonical Vegetables instructions, species and answer indices are unchanged');
  assert.deepEqual(sourceModule(), after.canonical, 'canonical source remains byte-structure identical after the L1 batch');
  assert.deepEqual(actual, after.drafts[language], `${language}: full native registry matches frozen accepted after-state before history rewind`);
  const expectedQuizIndices = [1, 2];
  assert.deepEqual(lessonAt(actual)?.quiz.map((question: any) => question.sourceCorrectIndex), expectedQuizIndices,
    `${language}: the two original answer positions remain B/C`);
  const restored: any = structuredClone(actual);
  for (const row of vegetablesL1Rows.filter((item: any) => item.language === language)) {
    const sourceParagraphs = sourceModule().lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.body.split('\n\n');
    const nativeLesson = lessonAt(actual);
    const expectedLesson = lessonAt(restored);
    const sourceIndex = row.bodyIndex;
    assert.equal(sourceParagraphs[sourceIndex], row.sourceEnglish, `${row.id}: exact canonical paragraph`);
    assert.equal(nativeLesson.body.sourceEnglish.split('\n\n')[sourceIndex], row.sourceEnglish, `${row.id}: exact native source binding`);
    assert.equal(nativeLesson.body[keys[language]].split('\n\n')[sourceIndex], row.afterTarget, `${row.id}: exact applied full composition`);
    assert.equal(nativeLesson.body.reviewStatus, 'machine-draft', `${row.id}: unreviewed status stays explicit`);
    const paragraphs = expectedLesson.body[keys[language]].split('\n\n');
    paragraphs[sourceIndex] = row.beforeTarget;
    expectedLesson.body[keys[language]] = paragraphs.join('\n\n');
  }
  assert.deepEqual(restored, before.drafts[language], `${language}: rewinding only the five accepted L1 target rows restores the full previous registry`);
  return restored;
}

/** Validate a whole current paired deck, then rewind only the accepted L1 card cells. */
export function vegetablesDeckBeforeL1Ordinary<T>(language: VegetablesL1Language, actual: T): T {
  vegetablesBeforeL1Ordinary(language, vegetablesL1Drafts[language]);
  const before = vegetablesL1Before;
  const after = vegetablesL1After;
  assert.deepEqual(actual, after.decks[language], `${language}: full paired deck matches accepted after-state before rewind`);
  const restored: any = structuredClone(actual);
  for (const row of vegetablesL1Rows.filter((item: any) => item.language === language)) {
    const slideIndex = row.slide - 1;
    const field = restored.slides[slideIndex];
    const currentPair = field.target.body[row.pairedBodyIndex];
    assert.equal(field.english.body[row.pairedBodyIndex], row.sourceEnglish, `${row.id}: slide source remains exact`);
    assert.deepEqual(currentPair, after.decks[language].slides[slideIndex].target.body[row.pairedBodyIndex], `${row.id}: exact current card status/segments`);
    assert.equal(visible(currentPair), row.afterTarget, `${row.id}: visible source-paired target equals native paragraph`);
    if (currentPair.status === 'mixed') {
      assert.equal(currentPair.segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish,
        `${row.id}: every English source span remains covered exactly once`);
    }
    field.target.body[row.pairedBodyIndex] = structuredClone(before.decks[language].slides[slideIndex].target.body[row.pairedBodyIndex]);
  }
  assert.deepEqual(restored, before.decks[language], `${language}: only accepted L1 deck slots were rewound; all other deck content/status is preserved`);
  return restored;
}
