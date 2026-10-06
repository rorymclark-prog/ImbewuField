import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { nativeOrdinaryBeforeFinalBatch, nativeOrdinaryPresentationBeforeFinalBatch } from './native-ordinary-final-history-checks.ts';

const packet = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/market-ordinary-completion-2026-10-06/final-root-reviewed-candidates.json', import.meta.url), 'utf8'));
const orderPrecision = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/market-ordinary-completion-2026-10-06/sesotho-order-noun-precision.json', import.meta.url), 'utf8'));
// Phone review exposed an inherited commercial-order ambiguity. The frozen
// original packet stays intact; this exact two-field layer is checked first.
export function marketOrdinaryAppliedTarget(row: any): string {
  const repair = orderPrecision.rows.find((item: any) => item.id === row.id);
  if (repair) {
    assert.equal(repair.sourceEnglish, row.sourceEnglish);
    assert.equal(repair.before, row.changed ? row.proposedTarget : row.currentTarget);
    return repair.target;
  }
  return row.changed ? row.proposedTarget : row.currentTarget;
}
const languageKeys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
type MarketLanguage = keyof typeof languageKeys;
const sourceModule = COURSE_MODULES.find(module => module.id === packet.moduleId)!;

// Root authorized this one status change after noticing the resolver correctly
// hid the approved false seed-sharing distractor while it was still held.
const appliedStatusOverride = {
  id: 'ts:market-community-l3:quiz.0.options.2',
  from: 'hold',
  to: 'machine-draft',
  sourceEnglish: 'Assume sharing automatically improves every seed lot',
  reason: 'The reviewed target preserves the exact false automatic-improvement claim and is meant to be visible as an unreviewed draft.',
} as const;

function lessonFor(container: any, lessonId: string) {
  const lesson = container.lessons.find((item: any) => item.id === lessonId);
  assert.ok(lesson, `${container.language}/${lessonId}: native lesson exists`);
  return lesson;
}
function pairFor(container: any, row: any) {
  if (!row.lessonId) return container[row.fieldPath];
  const lesson = lessonFor(container, row.lessonId);
  if (row.fieldPath === 'title' || row.fieldPath === 'infographicAlt' || row.fieldPath === 'body') return lesson[row.fieldPath];
  let match = row.fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return lesson.keyPoints[Number(match[1])];
  match = row.fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/);
  assert.ok(match, `${row.id}: recognized field path`);
  const question = lesson.quiz[Number(match[1])];
  if (match[2] === 'q') return question.question;
  if (match[2] === 'rationale') return question.rationale;
  return question.options[Number(match[3])];
}
function sourceFor(row: any) {
  if (!row.lessonId) return sourceModule[row.fieldPath as 'title' | 'description'];
  const lesson = sourceModule.lessons.find(item => item.id === row.lessonId)!;
  if (row.fieldPath === 'title') return lesson.title;
  if (row.fieldPath === 'infographicAlt') return lesson.infographicAlt;
  if (row.fieldPath.startsWith('body.')) return lesson.body.split('\n\n')[Number(row.fieldPath.slice(5))];
  let match = row.fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return lesson.keyPoints[Number(match[1])];
  match = row.fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/)!;
  const quiz = lesson.quiz[Number(match[1])];
  if (match[2] === 'q') return quiz.q;
  if (match[2] === 'rationale') return quiz.rationale;
  return quiz.options[Number(match[3])];
}
function expectedApplied(language: MarketLanguage) {
  const expected = structuredClone(packet.proposedOnlyNativeSnapshots[language]);
  if (language === 'st') {
    for (const repair of orderPrecision.rows) {
      const row = packet.rows.find((item: any) => item.id === repair.id);
      const pair = pairFor(expected, row);
      assert.equal(pair.sourceEnglish, repair.sourceEnglish);
      assert.equal(pair.sesothoDraft, repair.before);
      pair.sesothoDraft = marketOrdinaryAppliedTarget(row);
    }
  }
  if (language === 'ts') {
    const option = expected.lessons.find((item: any) => item.id === 'market-community-l3')!.quiz[0].options[2];
    assert.equal(option.sourceEnglish, appliedStatusOverride.sourceEnglish);
    assert.equal(option.reviewStatus, appliedStatusOverride.from);
    option.reviewStatus = appliedStatusOverride.to;
  }
  return expected;
}

/** Validate the exact final overlay, then reconstruct the state before this dated batch. */
export function validateAndRewindMarketOrdinary<T extends { lessons: readonly any[]; language: MarketLanguage }>(native: T, language: MarketLanguage): T {
  // 6 October: require the complete source-bound 28-field overlay to match before
  // reconstructing this earlier Market snapshot.
  native = nativeOrdinaryBeforeFinalBatch(native);
  assert.equal(packet.baselineCommit, 'b2c81e32458f83cff951250e3b9065d2b1314206');
  assert.equal(packet.reviewStatus, 'root-repaired data-only packet; pending root review; no fluency approval');
  assert.deepEqual(native, expectedApplied(language), `${language}: current full registry equals only the approved overlay plus the explicit status override`);
  assert.deepEqual(sourceModule, packet.canonicalSnapshot, 'canonical Market source remains unchanged');
  assert.deepEqual(native.lessons.map((item: any) => item.id), packet.nativeRegistryLessonOrders[language], `${language}: native lesson order is unchanged`);

  for (const row of packet.rows.filter((item: any) => item.language === language)) {
    assert.equal(sourceFor(row), row.sourceEnglish, `${row.id}: exact canonical source binding`);
    if (row.fieldPath.startsWith('body.')) {
      const index = Number(row.fieldPath.slice(5));
      const body = pairFor(native, { ...row, fieldPath: 'body' });
      const sourceBody = sourceModule.lessons.find(item => item.id === row.lessonId)!.body;
      assert.equal(body.sourceEnglish, sourceBody, `${row.id}: full native body remains paired to the full canonical body`);
      const target = body[languageKeys[language]].split('\n\n')[index];
      assert.equal(target, row.changed ? row.proposedTarget : row.currentTarget, `${row.id}: paragraph order and target`);
      assert.equal(body.reviewStatus, row.changed ? row.proposedReviewStatus : row.currentReviewStatus, `${row.id}: body review status`);
      continue;
    }
    const pair = pairFor(native, row);
    assert.equal(pair.sourceEnglish, row.sourceEnglish, `${row.id}: native source pair`);
    assert.equal(pair[languageKeys[language]], marketOrdinaryAppliedTarget(row), `${row.id}: native target with exact documented order-noun layer`);
    const expectedStatus = row.id === appliedStatusOverride.id ? appliedStatusOverride.to
      : row.changed ? row.proposedReviewStatus : row.currentReviewStatus;
    assert.equal(pair.reviewStatus, expectedStatus, `${row.id}: visible review status`);
  }
  for (const binding of packet.quizIndexBindings.filter((item: any) => item.language === language)) {
    const quiz = native.lessons.find((item: any) => item.id === binding.lessonId)!.quiz[binding.questionIndex];
    const canonicalQuiz = sourceModule.lessons.find(item => item.id === binding.lessonId)!.quiz[binding.questionIndex];
    assert.equal(quiz.sourceCorrectIndex, binding.proposedCorrectIndex, `${language}/${binding.lessonId}: keyed answer index is unchanged`);
    assert.equal(canonicalQuiz.correct, binding.sourceCorrectIndex, `${language}/${binding.lessonId}: canonical keyed answer index is unchanged`);
    assert.deepEqual(quiz.options.map((option: any) => option.sourceEnglish), canonicalQuiz.options,
      `${language}/${binding.lessonId}: quiz option order and source strings are unchanged`);
  }
  return structuredClone(packet.nativeBeforeSnapshots[language]) as T;
}

/** Validate live resolver output and reconstruct the visible state before this batch for historical tests. */
export function rewindMarketOrdinaryPresentation<T extends { content: any; status: string }>(original: T, lessonId: string, language: MarketLanguage): T {
  // 2026-10-06: validate and rewind the final native/residual layer before
  // testing the older 79-row source-bound presentation claim.
  const result = nativeOrdinaryPresentationBeforeFinalBatch(original, lessonId, language);
  if (language === 'st' && lessonId === 'market-community-l2') {
    assert.equal(result.content.quiz[1].correct, orderPrecision.correctIndex);
    for (const repair of orderPrecision.rows) {
      const field = repair.id.endsWith('.q') ? 'q' : 'rationale';
      assert.equal(result.content.quiz[1][field], repair.target, `${repair.id}: exact live order-noun repair before historical reconstruction`);
      result.content.quiz[1][field] = repair.before;
    }
  }
  const rows = packet.rows.filter((item: any) => item.language === language && item.lessonId === lessonId && item.changed);
  for (const row of rows) {
    let target: any;
    if (row.fieldPath === 'title') target = result.content.title;
    else if (row.fieldPath === 'infographicAlt') target = result.content.infographicAlt;
    else if (row.fieldPath.startsWith('body.')) target = result.content.body.split('\n\n')[Number(row.fieldPath.slice(5))];
    else if (row.fieldPath.startsWith('keyPoints.')) target = result.content.keyPoints[Number(row.fieldPath.split('.')[1])];
    else {
      const m = row.fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/)!;
      const quiz = result.content.quiz[Number(m[1])];
      target = m[2] === 'q' ? quiz.q : m[2] === 'rationale' ? quiz.rationale : quiz.options[Number(m[3])];
    }
    assert.equal(target, row.proposedTarget, `${row.id}: resolver shows the approved unreviewed target`);
  }
  for (const row of rows) {
    if (row.fieldPath.startsWith('body.')) {
      const paragraphs = result.content.body.split('\n\n');
      paragraphs[Number(row.fieldPath.slice(5))] = row.currentTarget;
      result.content.body = paragraphs.join('\n\n');
    } else if (row.fieldPath === 'title') result.content.title = row.currentTarget;
    else if (row.fieldPath === 'infographicAlt') result.content.infographicAlt = row.currentTarget;
    else if (row.fieldPath.startsWith('keyPoints.')) result.content.keyPoints[Number(row.fieldPath.split('.')[1])] = row.currentTarget;
    else {
      const m = row.fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/)!;
      const quiz = result.content.quiz[Number(m[1])];
      if (m[2] === 'q') quiz.q = row.currentTarget;
      else if (m[2] === 'rationale') quiz.rationale = row.currentTarget;
      else quiz.options[Number(m[3])] = row.currentTarget;
    }
  }
  return result;
}
