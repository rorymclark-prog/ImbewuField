import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/WATER-LEARNER-REVIEWED-PRECISION-2026-10-05.json', import.meta.url), 'utf8'));
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const drafts = { st: SESOTHO_WATER_HARVESTING_DRAFT, ve: TSHIVENDA_WATER_HARVESTING_DRAFT, ts: XITSONGA_WATER_HARVESTING_DRAFT };
const source = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;

// 2026-10-06 ordinary completion supersedes the nine mixed literal targets. Verify
// the entire accepted live layer before returning a clone of its full prior state;
// the original PR957 source, index, withdrawal and unlisted checks remain below.
// Final74 TS and its one bounded physical-bank hold are included in the same guard.
type WaterDraft = (typeof drafts)[keyof typeof drafts];
export function waterNativeBeforeOrdinary(language: 'st' | 've' | 'ts'): WaterDraft {
  const ts = language === 'ts';
  const ve = language === 've';
  const packetPath = ts
    ? 'docs/study-translation-reviews/water-ordinary-ts-2026-10-06/root-reviewed-candidates.json'
    : ve
    ? 'docs/study-translation-reviews/water-ordinary-ve-2026-10-06/root-reviewed-candidates.json'
    : 'docs/study-translation-reviews/ST-WATER-ORDINARY-COMPLETION-ACCEPTED-2026-10-06.json';
  const bytes = readFileSync(packetPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ts
    ? '3996b26f5a40dcbff2cd8b2a6ca1f0b876562e93cb62ac6dc1661397910fb19a'
    : ve
    ? 'ba100aa5be8dadd3f2ac6de4b63cbae44cb6bb144990cfaaa1ae0593deb5cb02'
    : '2b6391d649e4feba3f74b315919fc93e756938db1b6d2ba9824cde6709f5346e');
  const packet = JSON.parse(bytes.toString());
  const saved = JSON.parse(readFileSync(ts
    ? 'docs/study-translation-reviews/water-ordinary-ts-2026-10-06/native-before.json'
    : ve
    ? 'docs/study-translation-reviews/water-ordinary-ve-2026-10-06/native-before.json'
    : 'docs/study-translation-reviews/ST-WATER-ORDINARY-COMPLETION-PROOF-2026-10-06.json', 'utf8'));
  const before = ts ? saved.registry : ve ? saved.draft : saved.nativeBeforeSnapshot;
  const expected = structuredClone(before);
  if (ve) assert.deepEqual(source, saved.canonical);
  const rows = ve ? packet.rows : packet.candidates;
  for (const row of rows) {
    if (row.fieldPath === 'body' || row.nativePairPresent === false) continue;
    const owner = row.lessonId
      ? expected.lessons.find((lesson: any) => lesson.id === row.lessonId) : expected;
    const path = row.fieldPath === 'moduleTitle' ? 'title' : row.fieldPath === 'moduleDescription' ? 'description' : row.fieldPath;
    const pair = path.replace(/\[(\d+)\]/g, '.$1').split('.')
      .reduce((value: any, key: string) => value[key], owner);
    assert.equal(pair.sourceEnglish, row.sourceEnglish);
    assert.equal(pair[keys[language]], row.currentTarget);
    const proposed = ts ? row.proposed : row.proposedTarget;
    if (proposed !== row.currentTarget) {
      pair[keys[language]] = proposed;
      pair.reviewStatus = 'machine-draft';
    }
  }
  for (const body of ts ? packet.allFourBodyCompositions : packet.bodyCompositions) {
    const pair = expected.lessons.find((lesson: any) => lesson.id === body.lessonId).body;
    assert.equal(pair.sourceEnglish, body.sourceEnglish);
    assert.equal(pair[keys[language]], body.currentTarget);
    assert.equal(source.lessons.find(lesson => lesson.id === body.lessonId)!.body, body.sourceEnglish);
    pair[keys[language]] = ts ? body.proposed : body.proposedTarget;
  }
  assert.deepEqual(drafts[language], expected,
    `${language}: all current accepted and unlisted fields checked before ordinary-layer rewind`);
  if (!ve && !ts) assert.deepEqual(expected, saved.nativeAppliedSnapshot);
  return structuredClone(before);
}

export function checkWaterReviewedPrecision() {
  assert.equal(proof.rows.length, 9);
  assert.equal(new Set(proof.rows.map((row: any) => row.id)).size, 9);
  for (const language of ['st', 've', 'ts'] as const) {
    const restored = waterNativeBeforeOrdinary(language);
    for (const row of proof.rows.filter((row: any) => row.language === language)) {
      const lesson = source.lessons.find(lesson => lesson.id === row.lessonId)!;
      const native = restored.lessons.find((lesson: WaterDraft['lessons'][number]) => lesson.id === row.lessonId)!;
      assert.equal(native.body.sourceEnglish, lesson.body);
      assert.equal(lesson.body.split('\n\n')[row.bodyParagraphIndex], row.sourceEnglish);
      const paragraphs = (native.body as any)[keys[language]].split('\n\n');
      assert.equal(paragraphs.length, lesson.body.split('\n\n').length);
      assert.equal(paragraphs[row.bodyParagraphIndex], row.safeBoundedCandidate, row.id);
      assert.equal(native.body.reviewStatus, 'machine-draft');
      const visible = resolveLearnerLessonPresentation(lesson, language);
      assert.equal(visible.status, 'draft');
      assert.equal(visible.content.body, (drafts[language].lessons.find(item => item.id === row.lessonId)!.body as any)[keys[language]]);
      const changedSource = { ...lesson, body: lesson.body.replace(row.sourceEnglish, row.sourceEnglish + ' changed source') };
      const withdrawn = resolveLearnerLessonPresentation(changedSource, language);
      assert.equal(withdrawn.status, 'english-fallback', 'changed source withdraws the whole draft');
      assert.equal(withdrawn.content.body, changedSource.body);
      paragraphs[row.bodyParagraphIndex] = row.currentTarget;
      (native.body as any)[keys[language]] = paragraphs.join('\n\n');
    }
    assert.deepEqual(restored, proof.baselineNativeDrafts[language], 'rewinding only nine paragraphs preserves all unlisted text, metadata, source pairs, statuses and quiz indexes');
  }
}

// The paired-deck test records an earlier learner completion. Validate today's
// nine exact predicates before reconstructing that dated body for its snapshot.
export function waterBodyBeforeReviewedPrecision(body: string, language: string, lessonId: string) {
  assert.ok(language === 'st' || language === 've' || language === 'ts');
  const live = drafts[language].lessons.find(lesson => lesson.id === lessonId)!;
  assert.equal(body, (live.body as any)[keys[language]], 'passed current body must be the actual native resolver body');
  const before = waterNativeBeforeOrdinary(language).lessons.find((lesson: any) => lesson.id === lessonId)!;
  const paragraphs = (before.body as any)[keys[language]].split('\n\n');
  for (const row of proof.rows.filter((row: any) => row.language === language && row.lessonId === lessonId)) {
    assert.equal(paragraphs[row.bodyParagraphIndex], row.safeBoundedCandidate);
    paragraphs[row.bodyParagraphIndex] = row.currentTarget;
  }
  return paragraphs.join('\n\n');
}
