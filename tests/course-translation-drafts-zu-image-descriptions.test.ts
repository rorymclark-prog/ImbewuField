import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import {
  courseTranslationReviewState,
  resolveLearnerLessonPresentation,
  type LocalizedLessonContent,
} from '../lib/course-localization.ts';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { ISIZULU_REVIEW_DRAFT_SOURCE_SNAPSHOTS } from '../lib/course-translation-draft-sources-zu.ts';

type AppliedRow = {
  moduleId: string;
  lessonId: string;
  field: 'lesson.imageDescription';
  sourceEnglish: string;
  sourceSha256: string;
  priorRegistryAlt: null;
  priorResolvedAlt: null;
  priorRenderedAltFallback: string;
  priorPresentationStatus: 'draft';
  isizuluDraft: string;
  reviewStatus: 'machine-draft';
  technicalEnglishRetained: string[];
  image: {
    url: string;
    repositoryPath: string;
    bytes: number;
    sha256: string;
    width: number;
    height: number;
    gitBlobOid: string;
  };
};

const applied = JSON.parse(readFileSync(new URL(
  '../docs/study-translation-reviews/ISIZULU-IMAGE-DESCRIPTIONS-2026-10-05-APPLIED.json', import.meta.url,
), 'utf8')) as {
  scopeCount: number;
  records: AppliedRow[];
  baselineRegistrySha256: string;
  expectedAppliedRegistrySha256: string;
  reviewLimit: string;
  rootIndependentSemanticReview: { recordsRead: number; fluencyApproval: boolean };
};
const baseline = JSON.parse(readFileSync(new URL(
  '../docs/study-translation-reviews/ISIZULU-IMAGE-DESCRIPTIONS-2026-10-05-BASELINE.json', import.meta.url,
), 'utf8')) as {
  scopeCount: number;
  baselineRegistrySha256: string;
  registryRecordCount: number;
  registryRecords: Array<{
    lessonId: string;
    draftSha256: string;
    unlistedFieldsSha256: string;
    priorInfographicAlt: string | null;
  }>;
  selectedRows: Array<Pick<AppliedRow, 'moduleId' | 'lessonId' | 'field' | 'sourceEnglish' | 'sourceSha256' | 'priorRegistryAlt' | 'priorResolvedAlt' | 'priorRenderedAltFallback' | 'priorPresentationStatus' | 'image'>>;
};

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value);
const lessons = new Map(COURSE_MODULES.flatMap(module => module.lessons.map(lesson => [
  lesson.id,
  { moduleId: module.id, lesson },
] as const)));
const sourceContent = (lesson: typeof COURSE_MODULES[number]['lessons'][number]): LocalizedLessonContent => ({
  title: lesson.title,
  body: lesson.body,
  keyPoints: lesson.keyPoints,
  quiz: lesson.quiz,
  infographicAlt: lesson.infographicAlt,
});

test('all 32 isiZulu image descriptions bind the frozen English and exact reviewed image without approval', () => {
  assert.equal(applied.scopeCount, 32);
  assert.equal(applied.records.length, 32);
  assert.equal(baseline.scopeCount, 32);
  assert.equal(new Set(applied.records.map(row => row.lessonId)).size, 32);
  assert.equal(new Set(applied.records.map(row => row.image.url)).size, 32);
  assert.equal(applied.rootIndependentSemanticReview.recordsRead, 32);
  assert.equal(applied.rootIndependentSemanticReview.fluencyApproval, false);
  assert.match(applied.reviewLimit, /unreviewed machine drafts/i);
  assert.match(applied.reviewLimit, /no fluent-speaker or local-farming approval/i);

  for (const row of applied.records) {
    const found = lessons.get(row.lessonId);
    assert.ok(found, `${row.lessonId}: canonical lesson exists`);
    assert.equal(found.moduleId, row.moduleId, `${row.lessonId}: module identity is stable`);
    const { lesson } = found;
    const snapshot = ISIZULU_REVIEW_DRAFT_SOURCE_SNAPSHOTS[row.lessonId];
    assert.ok(snapshot, `${row.lessonId}: frozen English snapshot exists`);
    assert.equal(lesson.infographicAlt, row.sourceEnglish, `${row.lessonId}: source-bound English alt`);
    assert.equal(sha256(lesson.infographicAlt), row.sourceSha256, `${row.lessonId}: source text hash`);
    assert.equal(snapshot.infographicAlt, row.sourceEnglish, `${row.lessonId}: source snapshot remains exact`);
    assert.equal(row.field, 'lesson.imageDescription');
    assert.equal(row.priorRegistryAlt, null);
    assert.equal(row.priorResolvedAlt, null);
    assert.equal(row.priorRenderedAltFallback, row.sourceEnglish);
    assert.equal(row.isizuluDraft, COURSE_TRANSLATION_DRAFTS[row.lessonId].infographicAlt);
    assert.equal(row.reviewStatus, 'machine-draft');
    for (const technicalTerm of row.technicalEnglishRetained) {
      assert.ok(row.isizuluDraft.toLocaleLowerCase().includes(technicalTerm.toLocaleLowerCase()),
        `${row.lessonId}: uncertain technical phrase stays as exact English: ${technicalTerm}`);
    }
    assert.equal(courseTranslationReviewState(row.lessonId).status, 'review-draft');

    const imagePath = new URL(`../${row.image.repositoryPath.replace(/^\//, '')}`, import.meta.url);
    const image = readFileSync(imagePath);
    assert.equal(lesson.infographicUrl, row.image.url, `${row.lessonId}: existing image URL remains bound`);
    assert.equal(image.length, row.image.bytes, `${row.lessonId}: image bytes remain unchanged`);
    assert.equal(sha256(image), row.image.sha256, `${row.lessonId}: image hash remains unchanged`);
    assert.ok(row.image.width > 0 && row.image.height > 0, `${row.lessonId}: reviewed image dimensions are recorded`);
    assert.match(row.image.gitBlobOid, /^[0-9a-f]{40}$/);

    const shown = resolveLearnerLessonPresentation(lesson, 'zu');
    assert.equal(shown.status, 'draft', `${row.lessonId}: remains visibly unreviewed`);
    assert.equal(shown.content.infographicAlt, row.isizuluDraft, `${row.lessonId}: learner resolver returns the checked description`);
  }
});

test('the 32 alt additions preserve every other isiZulu draft field and the whole frozen registry', () => {
  assert.equal(baseline.registryRecordCount, 33);
  assert.deepEqual(Object.keys(COURSE_TRANSLATION_DRAFTS).sort(), baseline.registryRecords.map(row => row.lessonId).sort(),
    'The existing checked draft registry keeps its same lesson set');
  const rowsById = new Map(applied.records.map(row => [row.lessonId, row]));
  const reconstructedBaseline = structuredClone(COURSE_TRANSLATION_DRAFTS);
  for (const record of baseline.registryRecords) {
    const actual = COURSE_TRANSLATION_DRAFTS[record.lessonId];
    assert.ok(actual, `${record.lessonId}: existing proposal remains present`);
    const withoutAlt = structuredClone(actual);
    delete withoutAlt.infographicAlt;
    assert.equal(sha256(json(withoutAlt)), record.unlistedFieldsSha256,
      `${record.lessonId}: title, body, key points, quiz and all other fields are unchanged`);
    if (rowsById.has(record.lessonId)) {
      const row = rowsById.get(record.lessonId)!;
      assert.equal(record.priorInfographicAlt, null, `${record.lessonId}: field was absent in the frozen baseline`);
      assert.equal(record.draftSha256, sha256(json(withoutAlt)), `${record.lessonId}: baseline included no unrelated prior alt`);
      delete reconstructedBaseline[record.lessonId].infographicAlt;
      assert.equal(actual.infographicAlt, row.isizuluDraft);
    } else {
      assert.equal(actual.infographicAlt ?? null, record.priorInfographicAlt,
        `${record.lessonId}: existing image description remains unchanged`);
      assert.equal(sha256(json(actual)), record.draftSha256,
        `${record.lessonId}: entire unselected draft stays byte-for-byte equivalent as JSON`);
    }
  }
  for (const row of applied.records) delete reconstructedBaseline[row.lessonId].infographicAlt;
  assert.equal(sha256(json(reconstructedBaseline)), baseline.baselineRegistrySha256,
    'Reversing only the 32 accepted fields reconstructs the frozen full registry');
  assert.equal(sha256(json(COURSE_TRANSLATION_DRAFTS)), applied.expectedAppliedRegistrySha256,
    'The complete current registry matches the recorded applied packet');
  assert.equal(applied.baselineRegistrySha256, baseline.baselineRegistrySha256);
});

test('changing any paired image-description source withdraws the whole lesson draft', () => {
  for (const row of applied.records) {
    const lesson = lessons.get(row.lessonId)!.lesson;
    const changed = { ...lesson, infographicAlt: `${lesson.infographicAlt} Source changed.` };
    const shown = resolveLearnerLessonPresentation(changed, 'zu');
    assert.equal(shown.status, 'english-fallback', `${row.lessonId}: stale image text is withdrawn`);
    assert.deepEqual(shown.content, sourceContent(changed), `${row.lessonId}: all fields fall back to current English`);
  }
});
