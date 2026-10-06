import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';

export type VegetablesLanguage = 'st' | 've' | 'ts';
const folder = '../docs/study-translation-reviews/vegetables-l3-ordinary-residual-2026-10-06/';
const pins = {
  'native-before.json': '074d984815704f80cbb261cfe43ba627fcaa1a69d42a9533bd16b5a0cfbf00c9',
  'native-final-after.json': '83ef0299b7de8289f624ec80d1a674e73be69bc26c4d42af86ece68a2a1f8a34',
  'deck-before.json': '493aad5d8db76dbcfa272b7c7a760c59184c57f5709fbde720ece8ee799b9f43',
  'deck-final-after.json': 'ae2fa08b9dd82af33744de6c6cbefc52fe4183b50567e72bd7387f028c63ada7',
  'accepted-seven-composed.json': '4d206533fe7353aab5baf1bdc77ab6a1cd9a7203d0973c4927af9f6d592a58a3',
  'accepted-final-composed.json': '77daf7d818b0f93aa6d1a09ed64431ddca22830beccd433ec80017be00030b95',
};
const json = (name: keyof typeof pins): any => {
  const bytes = readFileSync(new URL(folder + name, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pins[name], `${name}: immutable accepted source/target authority`);
  return JSON.parse(bytes.toString());
};
export const ordinaryBefore = json('native-before.json');
export const ordinaryAfter = json('native-final-after.json');
export const ordinaryDeckBefore = json('deck-before.json');
export const ordinaryDeckAfter = json('deck-final-after.json');
export const originalSevenRows: any[] = json('accepted-seven-composed.json').rows;
export const ordinaryRows: any[] = json('accepted-final-composed.json').paragraphRows;
export const ordinarySpanRows: any[] = json('accepted-final-composed.json').spanRows;
export const ordinaryDrafts = { st, ve, ts };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };
const lessonAt = (registry: any) => registry.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l3');
const sourceModule = () => COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;

/** 6 October: validate the complete accepted 11-paragraph/12-span layer before older English-hold claims. */
export function vegetablesBeforeL3Ordinary<T>(language: VegetablesLanguage, actual: T): T {
  assert.deepEqual(sourceModule(), ordinaryBefore.canonical, 'all canonical Vegetables content and answer indices remain exact');
  if (language === 'ts' && (actual as any).lessons.every((lesson: any) => lesson.id === 'vegetables-staples-l2')) {
    // The separate L2 registry is validated by the older assessment helper; its caller
    // must also observe the complete current L3 layer before exposing older history.
    vegetablesBeforeL3Ordinary('ts', ordinaryDrafts.ts);
    return structuredClone(actual);
  }
  const previous = ordinaryBefore.drafts[language];
  const expected = structuredClone(previous);
  const lesson = lessonAt(expected);
  const source = sourceModule().lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
  for (const row of ordinaryRows.filter(row => row.language === language)) {
    const paragraphs = lesson.body[keys[language]].split('\n\n');
    assert.equal(source.body.split('\n\n')[row.paragraphIndex], row.exactCanonicalSourceParagraph);
    assert.equal(lesson.body.sourceEnglish, source.body, `${row.candidateId}: literal full-body source binding`);
    assert.equal(paragraphs[row.paragraphIndex], row.exactCurrentResolvedTargetParagraph);
    if (row.spanRepairs) {
      let composed = row.exactCurrentResolvedTargetParagraph;
      for (const span of row.spanRepairs) {
        assert.ok(row.exactCanonicalSourceParagraph.includes(span.sourceEnglishSpan));
        assert.equal(composed.split(span.currentTargetSpan).length - 1, 1, `${span.id}: replace exactly one disjoint span`);
        composed = composed.replace(span.currentTargetSpan, span.recommendedTargetSpan);
      }
      assert.equal(composed, row.proposedTarget, `${row.candidateId}: cumulative accepted span composition`);
    } else assert.equal(row.proposedTarget, row.currentTargetPrefixPreserveByteForByte + row.candidateTargetSpan + row.currentTargetSuffixPreserveByteForByte);
    assert.equal(lesson.body.reviewStatus, 'machine-draft');
    paragraphs[row.paragraphIndex] = row.proposedTarget;
    lesson.body[keys[language]] = paragraphs.join('\n\n');
  }
  assert.deepEqual(expected, ordinaryAfter.drafts[language], `${language}: only accepted twelve spans compose the complete fixed after`);
  assert.deepEqual(actual, expected, `${language}: actual full native source/status/order/indices/unlisted match accepted after`);
  const restored: any = structuredClone(actual);
  for (const row of ordinaryRows.filter(row => row.language === language)) {
    const paragraphs = lessonAt(restored).body[keys[language]].split('\n\n');
    assert.equal(paragraphs[row.paragraphIndex], row.proposedTarget);
    paragraphs[row.paragraphIndex] = row.exactCurrentResolvedTargetParagraph;
    lessonAt(restored).body[keys[language]] = paragraphs.join('\n\n');
  }
  assert.deepEqual(restored, previous, `${language}: exact 11-paragraph/12-span rewind preserves every other native field`);
  return restored;
}

export function vegetablesDeckBeforeL3Ordinary<T>(language: VegetablesLanguage, actual: T): T {
  vegetablesBeforeL3Ordinary(language, ordinaryDrafts[language]);
  const expected = structuredClone(ordinaryDeckBefore[language]);
  for (const row of ordinaryRows.filter(row => row.language === language)) {
    const { slide, bodyIndex } = row.deckComposition;
    const field = expected.slides[slide - 1];
    assert.equal(field.english.body[bodyIndex], row.exactCanonicalSourceParagraph);
    assert.deepEqual(field.target.body[bodyIndex], row.deckComposition.currentTargetPair);
    assert.equal(field.target.body[bodyIndex].status, 'draft');
    field.target.body[bodyIndex].text = row.proposedTarget;
    assert.notEqual(row.proposedTarget, field.english.body[bodyIndex], 'never expose exact English identity as translated draft');
  }
  assert.deepEqual(expected, ordinaryDeckAfter[language], `${language}: accepted source-bound paragraph reuse only`);
  assert.deepEqual(actual, expected, `${language}: actual whole paired deck preserves all unlisted source/target/status fields`);
  const restored: any = structuredClone(actual);
  for (const row of ordinaryRows.filter(row => row.language === language)) {
    restored.slides[row.deckComposition.slide - 1].target.body[row.deckComposition.bodyIndex] = structuredClone(row.deckComposition.currentTargetPair);
  }
  assert.deepEqual(restored, ordinaryDeckBefore[language], `${language}: eleven exact deck slots rewind to full previous deck`);
  return restored;
}

export function vegetablesL3PresentationBeforeOrdinary(lesson: Lesson, language: VegetablesLanguage) {
  vegetablesBeforeL3Ordinary(language, ordinaryDrafts[language]);
  const shown = structuredClone(resolveLearnerLessonPresentation(lesson, language));
  if (lesson.id !== 'vegetables-staples-l3' || shown.status !== 'draft') return shown;
  const paragraphs = shown.content.body.split('\n\n');
  for (const row of ordinaryRows.filter(row => row.language === language)) {
    assert.equal(paragraphs[row.paragraphIndex], row.proposedTarget, `${row.candidateId}: actual learner sees accepted span`);
    paragraphs[row.paragraphIndex] = row.exactCurrentResolvedTargetParagraph;
  }
  shown.content.body = paragraphs.join('\n\n');
  return shown;
}
