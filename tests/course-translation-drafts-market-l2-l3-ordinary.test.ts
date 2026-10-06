import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { reconstructMarketBeforeL2L3Completion } from './market-l2-l3-completion-checks.ts';
import { rewindMarketOrdinaryPresentation, validateAndRewindMarketOrdinary } from './market-ordinary-completion-history-checks.ts';

const reviewDir = path.join(process.cwd(), 'docs/study-translation-reviews');
const baseline = JSON.parse(readFileSync(path.join(reviewDir, 'MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-BASELINE-2026-10-05.json'), 'utf8'));
const applied = JSON.parse(readFileSync(path.join(reviewDir, 'MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-APPLIED-2026-10-05.json'), 'utf8'));
const moduleSource = COURSE_MODULES.find(module => module.id === 'market-community')!;
// This dated test preserves the 2026-10-05 batch claim. Validate the exact newer
// 2026-10-06 overlay first, then reconstruct the state this historical packet describes.
const regional = {
  st: validateAndRewindMarketOrdinary(SESOTHO_MARKET_COMMUNITY_DRAFT, 'st'),
  ve: validateAndRewindMarketOrdinary(TSHIVENDA_MARKET_COMMUNITY_DRAFT, 've'),
  ts: validateAndRewindMarketOrdinary(XITSONGA_MARKET_COMMUNITY_DRAFT, 'ts'),
};
const resolveBeforeOrdinaryResidual = (...args: Parameters<typeof resolveLearnerLessonPresentation>) => {
  const result = resolveLearnerLessonPresentation(...args);
  const [lesson, language] = args;
  return result.status === 'draft' && ['st', 've', 'ts'].includes(language)
    ? rewindMarketOrdinaryPresentation(result, lesson.id, language as keyof typeof targetKey)
    : result;
};
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const lessonIds = ['market-community-l2', 'market-community-l3'];

function getSourceField(lesson: (typeof moduleSource.lessons)[number], fieldPath: string): string {
  if (fieldPath === 'title' || fieldPath === 'body') return lesson[fieldPath];
  let match = fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return lesson.keyPoints[Number(match[1])];
  match = fieldPath.match(/^quiz(?:\[(\d+)\]|\.(\d+))\.(question|q|rationale|options)(?:\[(\d+)\]|\.(\d+))?$/);
  if (!match) throw new Error(`Unknown Market field path: ${fieldPath}`);
  const question = lesson.quiz[Number(match[1] ?? match[2])];
  const field = match[3];
  const index = match[4] === undefined && match[5] === undefined ? null : Number(match[4] ?? match[5]);
  if (field === 'options') return question.options[index!];
  if (field === 'question' || field === 'q') return question.q;
  return question.rationale;
}

function getTargetField(content: ReturnType<typeof resolveLearnerLessonPresentation>['content'], fieldPath: string): string {
  if (fieldPath === 'title' || fieldPath === 'body') return content[fieldPath];
  let match = fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return content.keyPoints[Number(match[1])];
  match = fieldPath.match(/^quiz(?:\[(\d+)\]|\.(\d+))\.(question|q|rationale|options)(?:\[(\d+)\]|\.(\d+))?$/);
  if (!match) throw new Error(`Unknown Market field path: ${fieldPath}`);
  const question = content.quiz[Number(match[1] ?? match[2])];
  const field = match[3];
  const index = match[4] === undefined && match[5] === undefined ? null : Number(match[4] ?? match[5]);
  if (field === 'options') return question.options[index!];
  if (field === 'question' || field === 'q') return question.q;
  return question.rationale;
}

function setRegionalTarget(lesson: any, language: keyof typeof targetKey, fieldPath: string, value: string): void {
  const key = targetKey[language];
  if (fieldPath === 'title' || fieldPath === 'body') {
    lesson[fieldPath][key] = value;
    return;
  }
  let match = fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) {
    lesson.keyPoints[Number(match[1])][key] = value;
    return;
  }
  match = fieldPath.match(/^quiz(?:\[(\d+)\]|\.(\d+))\.(question|q|rationale|options)(?:\[(\d+)\]|\.(\d+))?$/);
  if (!match) throw new Error(`Unknown Market field path: ${fieldPath}`);
  const question = lesson.quiz[Number(match[1] ?? match[2])];
  const field = match[3];
  const index = match[4] === undefined && match[5] === undefined ? null : Number(match[4] ?? match[5]);
  const pair = field === 'options' ? question.options[index!] : field === 'question' || field === 'q' ? question.question : question[field];
  pair[key] = value;
}

function getRegionalField(lesson: any, language: keyof typeof targetKey, fieldPath: string): string {
  const clone = structuredClone(lesson);
  const marker = '__regional_target_marker__';
  setRegionalTarget(clone, language, fieldPath, marker);
  // Locate the pair selected by the same field-path parser and read its prior target.
  function selected(before: any, after: any): string | undefined {
    if (after && typeof after === 'object') {
      for (const key of Object.keys(after)) {
        if (after[key] === marker) return before[key];
        const nested = selected(before[key], after[key]);
        if (nested !== undefined) return nested;
      }
    }
    return undefined;
  }
  const value = selected(lesson, clone);
  assert.ok(value !== undefined, `regional field exists: ${fieldPath}`);
  return value;
}

function bodyParagraph(language: string, lessonId: string, index: number): string {
  const entry = applied.fields.find((field: any) => field.language === language && field.lessonId === lessonId && field.fieldPath === 'body');
  return entry.appliedTarget.split('\n\n')[index];
}

test('Market L2/L3 draft targets stay bound to all 36 accepted English sources', () => {
  assert.equal(applied.fields.length, 36);
  const seen = new Set<string>();
  for (const field of applied.fields) {
    const identity = `${field.language}|${field.lessonId}|${field.fieldPath}`;
    assert.equal(seen.has(identity), false, `duplicate source-bound field ${identity}`);
    seen.add(identity);
    const sourceLesson = moduleSource.lessons.find(lesson => lesson.id === field.lessonId)!;
    assert.equal(getSourceField(sourceLesson, field.fieldPath), field.sourceEnglish, `${identity} canonical source`);
    const priorLesson = baseline.regionalDrafts[field.language].find((item: any) => item.id === field.lessonId);
    const priorResolved = priorLesson ? getRegionalField(priorLesson, field.language as keyof typeof targetKey, field.fieldPath) : undefined;
    assert.equal(priorResolved, field.currentTarget, `${identity} immutable prior target`);
    assert.notEqual(field.appliedTarget, field.currentTarget, `${identity} is a real target change`);
    const result = resolveBeforeOrdinaryResidual(sourceLesson, field.language);
    assert.equal(result.status, 'draft', `${identity} remains visibly a draft`);
    assert.equal(getTargetField(result.content, field.fieldPath), field.appliedTarget, `${identity} resolved target`);
  }
  assert.equal(seen.size, 36);
});

test('Market L2/L3 changes preserve canonical lessons and every unlisted regional field', () => {
  assert.deepEqual(moduleSource.lessons.filter(lesson => lessonIds.includes(lesson.id)), baseline.canonicalSource.lessons);
  for (const language of ['st', 've', 'ts'] as const) {
    const expected = structuredClone(baseline.regionalDrafts[language]);
    for (const field of applied.fields.filter((entry: any) => entry.language === language)) {
      const lesson = expected.find((item: any) => item.id === field.lessonId)!;
      setRegionalTarget(lesson, language, field.fieldPath, field.appliedTarget);
    }
    const actual = regional[language].lessons.filter(lesson => lessonIds.includes(lesson.id));
    assert.deepEqual(actual, expected, `${language} L2/L3 equals baseline plus the 36 accepted field targets`);
  }
  assert.equal(applied.bodyRows.length, 6);
  for (const body of applied.bodyRows) {
    const field = applied.fields.find((item: any) => item.language === body.language && item.lessonId === body.lessonId && item.fieldPath === 'body');
    const source = field.sourceEnglish.split('\n\n');
    const before = field.currentTarget.split('\n\n');
    const after = field.appliedTarget.split('\n\n');
    assert.equal(source.length, 12);
    assert.equal(before.length, 12);
    assert.equal(after.length, 12);
    const changed = after.flatMap((value: string, index: number) => value === before[index] ? [] : [index]);
    assert.deepEqual(changed, body.changedParagraphs, `${body.language}/${body.lessonId} actual changed paragraphs`);
    const unchanged = source.flatMap((_: string, index: number) => changed.includes(index) ? [] : [index]);
    assert.deepEqual(unchanged, body.unlistedParagraphs);
    for (const index of unchanged) assert.equal(after[index], before[index]);
    assert.equal(body.sourceParagraphCount, 12);
    assert.equal(body.currentParagraphCount, 12);
    assert.equal(body.finalParagraphCount, 12);
    assert.equal(body.unlistedParagraphsPreserved, true);
  }
});

test('Market L2/L3 retains supply conditions, income, seed permissions and comparison scope', () => {
  for (const language of ['st', 've', 'ts']) {
    assert.match(bodyParagraph(language, 'market-community-l2', 6), /reliably supply|fulufhedzea|tshamiseka/i);
    assert.match(bodyParagraph(language, 'market-community-l2', 5), /only when|feela ha|fhedzi musi|ntsena/i);
    assert.match(bodyParagraph(language, 'market-community-l2', 3), /retain more of the sale price/);
    assert.match(bodyParagraph(language, 'market-community-l3', 2), /permission/i);
    assert.match(bodyParagraph(language, 'market-community-l3', 8), /nearest buyer.*best return/, 'nearest keeps the superlative buyer scope and best-return condition');
    assert.match(bodyParagraph(language, 'market-community-l3', 8), /ka mehla|dzula|minkarhi hinkwato/, 'the always qualifier remains in the comparison');
  }
  assert.match(bodyParagraph('st', 'market-community-l2', 8), /income/);
  assert.match(bodyParagraph('ts', 'market-community-l2', 8), /does not predict income/);
  assert.match(bodyParagraph('ts', 'market-community-l3', 0), /different varieties/);
  const tsSeed = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 'ts').content.quiz[0];
  assert.equal(tsSeed.options[0], 'Hlanganisa all varieties without labels.');
  assert.equal(tsSeed.correct, 1);
  assert.doesNotMatch(tsSeed.options[0], /writing|ku tsala/, 'absence of labels stays broader than not writing them');

  const stHighest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 'st').content.quiz[1].options[0];
  const veHighest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 've').content.quiz[1].options[0];
  const tsHighest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 'ts').content.quiz[1].options[0];
  const stShortest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 'st').content.quiz[1].options[1];
  const veShortest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 've').content.quiz[1].options[1];
  const tsShortest = resolveBeforeOrdinaryResidual(moduleSource.lessons.find(lesson => lesson.id === 'market-community-l3')!, 'ts').content.quiz[1].options[1];
  assert.match(stHighest, /e phahameng ka ho fetisisa/);
  assert.match(veHighest, /ya nṱhesa/);
  assert.match(tsHighest, /the highest headline price/);
  assert.match(stShortest, /e kgutshwane ka ho fetisisa/);
  assert.match(veShortest, /shortest journey/);
  assert.match(tsShortest, /the shortest journey/);
});

test('Market L2/L3 source drift withdraws the regional draft', () => {
  const source = moduleSource.lessons.find(lesson => lesson.id === 'market-community-l2')!;
  const drifted = { ...source, body: `${source.body} Source wording changed.` };
  const result = resolveBeforeOrdinaryResidual(drifted, 'st');
  assert.equal(result.status, 'english-fallback');
  assert.equal(result.content.body, drifted.body);
});

test('Historical Market reconstruction rejects an altered final target or English source pair', () => {
  const changedTarget = structuredClone(SESOTHO_MARKET_COMMUNITY_DRAFT);
  changedTarget.lessons.find(lesson => lesson.id === 'market-community-l2')!.body.sesothoDraft += ' Added advice.';
  assert.throws(() => reconstructMarketBeforeL2L3Completion(changedTarget, 'st'), /current full registry equals only the approved overlay/);
  const changedPair = structuredClone(SESOTHO_MARKET_COMMUNITY_DRAFT);
  changedPair.lessons.find(lesson => lesson.id === 'market-community-l2')!.body.sourceEnglish += ' Altered English.';
  assert.throws(() => reconstructMarketBeforeL2L3Completion(changedPair, 'st'), /current full registry equals only the approved overlay/);
});


test('Market L2/L3 keeps the five accepted unchanged fields and all bounded repairs source paired', () => {
  assert.equal(applied.unchangedProvenance.length, 5);
  assert.equal(applied.fields.length + applied.unchangedProvenance.length, 41);
  for (const field of applied.unchangedProvenance) {
    const source = moduleSource.lessons.find(lesson => lesson.id === field.lessonId)!;
    assert.equal(getSourceField(source, field.fieldPath), field.sourceEnglish);
    const prior = baseline.regionalDrafts[field.language].find((item: any) => item.id === field.lessonId);
    assert.equal(getRegionalField(prior, field.language, field.fieldPath), field.currentTarget);
    assert.equal(getTargetField(resolveBeforeOrdinaryResidual(source, field.language).content, field.fieldPath), field.currentTarget);
  }
  assert.equal(applied.boundedRepairs.length, 25);
  for (const repair of applied.boundedRepairs) {
    const paragraph = repair.fieldPath.match(/^body\.paragraphs\.(\d+)$/);
    const fieldPath = paragraph ? 'body' : repair.fieldPath;
    const source = moduleSource.lessons.find(lesson => lesson.id === repair.lessonId)!;
    const actual = getTargetField(resolveBeforeOrdinaryResidual(source, repair.language).content, fieldPath);
    assert.equal(paragraph ? actual.split('\n\n')[Number(paragraph[1])] : actual, repair.reviewedTarget);
    assert.ok(repair.reason.length > 0, 'bounded repair carries its source meaning reason');
  }
});
