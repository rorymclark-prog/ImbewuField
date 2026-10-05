import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/WATER-LEARNER-REVIEWED-PRECISION-2026-10-05.json', import.meta.url), 'utf8'));
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const drafts = { st: SESOTHO_WATER_HARVESTING_DRAFT, ve: TSHIVENDA_WATER_HARVESTING_DRAFT, ts: XITSONGA_WATER_HARVESTING_DRAFT };
const source = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;

export function checkWaterReviewedPrecision() {
  assert.equal(proof.rows.length, 9);
  assert.equal(new Set(proof.rows.map((row: any) => row.id)).size, 9);
  for (const language of ['st', 've', 'ts'] as const) {
    const restored = structuredClone(drafts[language]);
    for (const row of proof.rows.filter((row: any) => row.language === language)) {
      const lesson = source.lessons.find(lesson => lesson.id === row.lessonId)!;
      const native = restored.lessons.find(lesson => lesson.id === row.lessonId)!;
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
  const paragraphs = body.split('\n\n');
  for (const row of proof.rows.filter((row: any) => row.language === language && row.lessonId === lessonId)) {
    assert.equal(paragraphs[row.bodyParagraphIndex], row.safeBoundedCandidate);
    paragraphs[row.bodyParagraphIndex] = row.currentTarget;
  }
  return paragraphs.join('\n\n');
}
