import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation as resolveCurrent } from '../lib/course-localization.ts';
import { nativeOrdinaryBeforeFinalBatch, nativeOrdinaryPresentationBeforeFinalBatch } from './native-ordinary-final-history-checks.ts';

// This dated 79-row claim is checked after validating the later full native layer.
const resolveLearnerLessonPresentation: typeof resolveCurrent = (...args) => {
  const result = resolveCurrent(...args);
  return result.status === 'draft'
    ? nativeOrdinaryPresentationBeforeFinalBatch(result, args[0].id, args[1]) as typeof result
    : result;
};
import { SESOTHO_MARKET_COMMUNITY_DRAFT as st } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT as ve } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT as ts } from '../lib/course-translation-drafts-ts-market-community.ts';
import { marketOrdinaryAppliedTarget, validateAndRewindMarketOrdinary } from './market-ordinary-completion-history-checks.ts';

const packet = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/market-ordinary-completion-2026-10-06/final-root-reviewed-candidates.json', import.meta.url), 'utf8'));
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/market-ordinary-completion-2026-10-06/applied-proof.json', import.meta.url), 'utf8'));
const drafts = { st, ve, ts } as const;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const moduleSource = COURSE_MODULES.find(module => module.id === 'market-community')!;
const sourceLesson = (lessonId: string) => moduleSource.lessons.find(lesson => lesson.id === lessonId)!;

function resolvedField(content: any, row: any): string {
  if (row.fieldPath === 'title') return content.title;
  if (row.fieldPath === 'infographicAlt') return content.infographicAlt;
  if (row.fieldPath.startsWith('body.')) return content.body.split('\n\n')[Number(row.fieldPath.slice(5))];
  let match = row.fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return content.keyPoints[Number(match[1])];
  match = row.fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/);
  assert.ok(match, `${row.id}: recognized resolver field`);
  const question = content.quiz[Number(match[1])];
  return match[2] === 'q' ? question.q : match[2] === 'rationale' ? question.rationale : question.options[Number(match[3])];
}
function draftTarget(language: keyof typeof targetKey, lessonId: string, fieldPath: string): string {
  const lesson: any = nativeOrdinaryBeforeFinalBatch(drafts[language]).lessons.find(item => item.id === lessonId)!;
  if (fieldPath === 'title') return lesson.title[targetKey[language]];
  if (fieldPath === 'infographicAlt') return lesson.infographicAlt[targetKey[language]];
  if (fieldPath.startsWith('body.')) return lesson.body[targetKey[language]].split('\n\n')[Number(fieldPath.slice(5))];
  let match = fieldPath.match(/^keyPoints\.(\d+)$/);
  if (match) return lesson.keyPoints[Number(match[1])][targetKey[language]];
  match = fieldPath.match(/^quiz\.(\d+)\.(q|rationale|options\.(\d+))$/);
  assert.ok(match);
  const question = lesson.quiz[Number(match[1])];
  return match[2] === 'q' ? question.question[targetKey[language]]
    : match[2] === 'rationale' ? question.rationale[targetKey[language]]
      : question.options[Number(match[3])][targetKey[language]];
}

test('Market ordinary residual applies exactly the 79 reviewed fields and preserves complete before snapshots', () => {
  assert.equal(packet.baselineCommit, 'b2c81e32458f83cff951250e3b9065d2b1314206');
  assert.equal(packet.rows.length, 291, 'the full source and unlisted field inventory remains in the authority packet');
  assert.equal(packet.rows.filter((row: any) => row.changed).length, 79);
  assert.deepEqual(packet.counts.changedByLanguage, { st: 24, ve: 29, ts: 26 });
  assert.equal(packet.bodyCompositions.length, 9);
  assert.equal(proof.changedAtomicRows, 79);
  assert.equal(proof.canonicalSnapshotMatches, true);
  assert.deepEqual(proof.appliedStatusOverride, {
    id: 'ts:market-community-l3:quiz.0.options.2',
    from: 'hold',
    to: 'machine-draft',
    sourceEnglish: 'Assume sharing automatically improves every seed lot',
    reason: 'The reviewed target preserves the exact false automatic-improvement claim and is meant to be visible as an unreviewed draft.',
  });
  for (const language of ['st', 've', 'ts'] as const) {
    const before = validateAndRewindMarketOrdinary(drafts[language], language);
    assert.deepEqual(before, packet.nativeBeforeSnapshots[language], `${language}: full native pre-batch snapshot is exact`);
    assert.deepEqual(drafts[language].lessons.map(lesson => lesson.id), packet.nativeRegistryLessonOrders[language],
      `${language}: historical native lesson order is exact`);
  }
  assert.deepEqual(moduleSource, packet.canonicalSnapshot, 'canonical English module and indices remain unchanged');
});

test('Market resolver exposes all approved pairs and withdraws them when their English source changes', () => {
  const seen = new Set<string>();
  for (const row of packet.rows.filter((item: any) => item.changed)) {
    const identity = row.id;
    assert.equal(seen.has(identity), false, `${identity}: unique row`);
    seen.add(identity);
    assert.equal(draftTarget(row.language, row.lessonId, row.fieldPath), marketOrdinaryAppliedTarget(row), `${identity}: native target including documented phone-review noun repair`);
    const result = resolveLearnerLessonPresentation(sourceLesson(row.lessonId), row.language);
    assert.equal(result.status, 'draft', `${identity}: draft remains visibly unreviewed`);
    assert.equal(resolvedField(result.content, row), marketOrdinaryAppliedTarget(row), `${identity}: resolver shows approved target`);
  }
  assert.equal(seen.size, 79);
  for (const language of ['st', 've', 'ts'] as const) {
    const source = sourceLesson('market-community-l2');
    const changed = { ...source, body: `${source.body} English source changed.` };
    const result = resolveLearnerLessonPresentation(changed, language);
    assert.equal(result.status, 'english-fallback', `${language}: changed body source withdraws every paired translation`);
    assert.equal(result.content.body, changed.body);
  }
});

test('Market order terms, cost comparisons, labour and seed-sharing conditions keep their source limits', () => {
  const stOrders = resolveLearnerLessonPresentation(sourceLesson('market-community-l2'), 'st').content.quiz[1];
  assert.match(stOrders.q, /^Regular orders tseo ho dumellanweng ka tsona/,
    'the less contextual quiz keeps the commercial order noun distinct from instructions');
  assert.match(stOrders.rationale, /^Confirmed orders di fana/);
  assert.equal(stOrders.correct, 2);
  for (const language of ['st', 've', 'ts'] as const) {
    const l2 = drafts[language].lessons.find(item => item.id === 'market-community-l2')!;
    const l2Source = sourceLesson('market-community-l2');
    const l2Shown = resolveLearnerLessonPresentation(l2Source, language);
    const customerNeeds = l2Shown.content.body.split('\n\n')[0];
    assert.match(customerNeeds, /product|tshibveledzwa|xihumisiwa|sehlahiswa/i, `${language}: requested product stays in the buyer's list`);
    assert.match(customerNeeds, /quantity|tshivhalo|nhlayo|bongata/i, `${language}: quantity stays in order`);
    assert.match(customerNeeds, /quality|kwalithi|khwalithi|boleng/i, `${language}: quality stays in order`);
    assert.match(customerNeeds, /delivery|u isa|ku yisa|ho tliswa/i, `${language}: delivery stays in order`);
    assert.match(customerNeeds, /payment date|ḓuvha ḽa (payment|mbadelo)|siku ra ku hakela|letsatsi la tefo/i, `${language}: payment date stays in order`);
    const agreement = l2Shown.content.body.split('\n\n')[5];
    assert.match(agreement, /only when|feela ha|fhedzi musi|ntsena loko/i, `${language}: regular-order planning remains conditional`);
    assert.match(agreement, /customers|bareki|vharengi|vaxavi/i, `${language}: customers remain one party to the agreement`);
    assert.match(agreement, /growers|balemi|vhalimi|varimi/i, `${language}: growers remain the other party`);
  }

  const l1Source = sourceLesson('market-community-l1');
  const stL1 = resolveLearnerLessonPresentation(l1Source, 'st').content.body.split('\n\n');
  const veL1 = resolveLearnerLessonPresentation(l1Source, 've').content.body.split('\n\n');
  const tsL1 = resolveLearnerLessonPresentation(l1Source, 'ts').content.body.split('\n\n');
  assert.match(stL1[11], /ditjeo tsa tlhahiso.*ho paka le ho rekisa.*mosebetsi le dipalangoang/,
    'Sesotho keeps production, packing, selling, labour and transport within the cost list');
  assert.match(veL1[11], /masheleni a u bveledza.*mushumo na transport/,
    'Tshivenda keeps labour and transport alongside production wording');
  assert.match(tsL1[11], /costs.*labour ni vutleketli/,
    'the Xitsonga cost noun remains exact English alongside labour and transport');
  for (const [language, body] of [['st', stL1], ['ve', veL1], ['ts', tsL1]] as const) {
    assert.match(body[12], /R18/);
    assert.match(body[12], /R15/);
    assert.match(body[12], /kilogram/);
    assert.match(body[12], /cost|ditjeo|mutengo|ntsengo|ntengo/i, `${language}: cost stays distinct from sale price`);
    assert.match(body[12], /sell|rekis|reng|xavisiwa/i, `${language}: sale/revenue side remains explicit`);
  }

  const seedSource = sourceLesson('market-community-l3');
  for (const language of ['st', 've', 'ts'] as const) {
    const result = resolveLearnerLessonPresentation(seedSource, language);
    const quiz = result.content.quiz[0];
    assert.equal(quiz.correct, 1, `${language}: seed permission answer index remains fixed`);
    assert.match(quiz.options[1], /permission/,
      `${language}: applicable permission is still checked before sharing`);
    assert.match(quiz.options[2], /automatically|boy its own|ka boyona|nga u tou ita zwenezwo/,
      `${language}: the false claim that sharing automatically improves every seed lot stays false`);
    assert.match(result.content.body.split('\n\n')[2], /permission/,
      `${language}: seed sharing does not imply permission`);
  }
});
