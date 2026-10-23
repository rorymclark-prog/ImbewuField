import assert from 'node:assert/strict';
import { fairSharingNativeBefore } from './intro-fair-sharing-history-checks.ts';
import { precisionNativeBefore } from './study-precision-history-checks.ts';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ts.ts';

export type IntroLanguage = 've' | 'ts';
const folder = new URL('../docs/study-translation-reviews/intro-full-ordinary-completion-2026-10-06/', import.meta.url);
export const introFullRead = (name: string) => readFileSync(new URL(name, folder), 'utf8');
export const introFullDigest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const introFullFixtureHashes: Record<string, string> = {
  "accepted-targets.json": "982d6151e95ba3ac522ed26754d4ce35c85797eb880c98163de56b01f2d8f785",
  "accepted-paired-objects.json": "1fea568b5c3926bbb42c7d08cd27504598a271212e3c299432aa4108e97a56a9",
  "accepted-ts-hold-metadata-amendment.json": "f3a26283d97c506ebc3bb636e8a78e8b58da961c6e15e9ec9b2dafdb2f7bb6af",
  "native-before.json": "1aac497c420d9fcf9fe5252482c6655809a74e79b200e610264fa8c3dba9430f",
  "native-after.json": "b564e7ed377f616ae996e49e118c40b99f0f407388d61c999a509d6b4546e4ca",
  "canonical-before.json": "0c2a888bda6308e28d22bb15a0edc87c7630da184378ed5ee0d0d0cd7b8c1f02",
  "ve-paired-before.json": "b933e501e5e77a6e15ab63ae270d16c56552d1cf1e08d927a02cb43a70dfb9d5",
  "ts-paired-before.json": "10d0f9ede93fc7c323d60dab330b670d4c21b30720e073426598d27f8e444603",
  "st-paired-before.json": "50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9",
  "ve-paired-after.json": "8f0b681a7661804affd9038bdd8ba09a080f7eaf9509a740070db5ac4005e80b",
  "ts-paired-after.json": "2773290f06d9d9e48c638cd63e2c29d01281a666a6f42294c06b71db0e053e3d",
  "st-paired-after.json": "50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9",
  "protected-st-intro.json": "c18392e966a76e80b5c701082463ea0c35a02b62f6b14c5f1e92bb7261249c74",
  "source-file-before-hashes.json": "a1bd47e2dfd7a7f5ca68eee974661f9ce5d9aeee52a18689848f68d3b110fc34"
};
export function introFullFixture(name: string) {
  const raw = introFullRead(name);
  assert.equal(introFullDigest(raw), introFullFixtureHashes[name], `${name}: immutable root-reviewed fixture`);
  return JSON.parse(raw);
}
export const introFullNativeBefore = introFullFixture('native-before.json');
export const introFullNativeAfter = introFullFixture('native-after.json');
export const introFullCanonicalBefore = introFullFixture('canonical-before.json');
export const introFullTargets = introFullFixture('accepted-targets.json');
export const introFullMetadata = introFullFixture('accepted-ts-hold-metadata-amendment.json');
export const readCurrentIntroNative = (): Record<IntroLanguage, any> => ({
  ve: precisionNativeBefore('ve', TSHIVENDA_INTRO_PERMACULTURE_DRAFT), ts: fairSharingNativeBefore(XITSONGA_INTRO_PERMACULTURE_DRAFT),
});
export function introFullField(object: any, path: string): any {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((value: any, key: string) => value[key], object);
}
const keyFor = (language: IntroLanguage) => language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';

// 6 October 2026: accepted ordinary prose supersedes 21 complete native leaves,
// including two paragraphs of the same TS body. Validate the entire real current
// overlay before returning any old wording; otherwise dated claims conceal drift.
export function validateAndRewindIntroFullNative(language: IntroLanguage, current = readCurrentIntroNative()[language]) {
  assert.deepEqual(COURSE_MODULES.find(module => module.id === 'intro-permaculture'), introFullCanonicalBefore,
    'all canonical English, fields, numbers and correct answers stay exact');
  const before = introFullNativeBefore[language];
  const expected = structuredClone(before);
  const rows = introFullTargets.actualDeltaRows.filter((row: any) => row.language === language && row.nativeMapping);
  assert.equal(rows.length, language === 've' ? 8 : 14);
  const paths = new Set<string>();
  for (const row of rows) {
    const mapping = row.nativeMapping;
    const old = introFullField(before, mapping.fieldPath);
    assert.deepEqual(old, mapping.fullBeforeLeaf, `${row.id}: full genuine before source/target/status`);
    const leaf = introFullField(expected, mapping.fieldPath);
    assert.equal(leaf.sourceEnglish, mapping.fullFieldSourceEnglish);
    if (row.locator.paragraphIndex !== undefined) {
      const at = row.locator.paragraphIndex;
      assert.equal(old.sourceEnglish.split('\n\n')[at], row.exactSource);
      assert.equal(old[keyFor(language)].split('\n\n')[at], row.exactCurrentTarget);
      const paragraphs = leaf[keyFor(language)].split('\n\n');
      paragraphs[at] = row.finalRecommendedTarget;
      leaf[keyFor(language)] = paragraphs.join('\n\n');
    } else {
      assert.equal(old.sourceEnglish, row.exactSource);
      assert.equal(old[keyFor(language)], row.exactCurrentTarget);
      leaf[keyFor(language)] = row.finalRecommendedTarget;
    }
    leaf.reviewStatus = 'machine-draft';
    paths.add(mapping.fieldPath);
  }
  assert.equal(paths.size, language === 've' ? 8 : 13);
  if (language === 'ts') {
    assert.deepEqual(before.holds, introFullMetadata.originalFullHoldArray);
    expected.holds = structuredClone(introFullMetadata.proposedHoldArray);
    assert.equal(expected.holds.length, 3);
    assert.deepEqual(expected.holds, before.holds.filter((hold: any) =>
      !(hold.field === 'keyPoints[1]' && hold.sourceText === 'People Care') &&
      !(hold.field === 'quiz[0].q' && hold.sourceText === 'seed saving')));
  }
  assert.deepEqual(expected, introFullNativeAfter[language], 'accepted after snapshot independently composes only authorized rows/metadata');
  assert.deepEqual(current, expected, 'whole actual native, every unlisted status/source/index/metadata, equals accepted overlay');
  assert.deepEqual(current.lessons.map((lesson: any) => lesson.id), introFullCanonicalBefore.lessons.map((lesson: any) => lesson.id));
  for (const [index, lesson] of current.lessons.entries()) {
    const original = introFullCanonicalBefore.lessons[index];
    for (const field of ['title', 'body', 'infographicAlt']) assert.equal(lesson[field].sourceEnglish, original[field]);
    assert.deepEqual(lesson.keyPoints.map((pair: any) => pair.sourceEnglish), original.keyPoints);
    lesson.quiz.forEach((quiz: any, at: number) => {
      assert.equal(quiz.question.sourceEnglish, original.quiz[at].q);
      assert.deepEqual(quiz.options.map((pair: any) => pair.sourceEnglish), original.quiz[at].options);
      assert.equal(quiz.rationale.sourceEnglish, original.quiz[at].rationale);
      assert.equal(quiz.sourceCorrectIndex, original.quiz[at].correct);
    });
  }
  const restored = structuredClone(current);
  for (const path of paths) Object.assign(introFullField(restored, path), structuredClone(introFullField(before, path)));
  if (language === 'ts') restored.holds = structuredClone(before.holds);
  assert.deepEqual(restored, before, 'only approved21 leaves and exact2 metadata removals rewind; all unlisted fields remain exact');
  return restored;
}

// Later ordinary prose changes literal historical presentation strings too.
// Keep real current source-drift fallback behavior; only matched Intro drafts
// receive the validated dated native wording used by older assertions.
export function introPresentationBeforeFullOrdinary(lesson: import('../lib/course-modules.ts').Lesson,
  language: string,
  presentation: import('../lib/course-localization.ts').LearnerLessonPresentation) {
  if (!lesson.id.startsWith('intro-permaculture-') || (language !== 've' && language !== 'ts')) return presentation;
  const native = validateAndRewindIntroFullNative(language);
  if (presentation.status !== 'draft') return presentation;
  const historical = native.lessons.find((item: any) => item.id === lesson.id);
  assert.ok(historical);
  const text = (pair: any) => pair.reviewStatus === 'hold' ? pair.sourceEnglish : pair[keyFor(language)];
  return { ...presentation, content: {
    title: text(historical.title), body: text(historical.body), infographicAlt: text(historical.infographicAlt),
    keyPoints: historical.keyPoints.map(text),
    quiz: historical.quiz.map((quiz: any) => ({ q: text(quiz.question), options: quiz.options.map(text),
      correct: quiz.sourceCorrectIndex, rationale: text(quiz.rationale) })),
  } };
}
