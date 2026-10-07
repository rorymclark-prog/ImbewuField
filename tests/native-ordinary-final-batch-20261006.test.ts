import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { nativeOrdinaryBeforeFinalBatch, nativeOrdinaryBeforeResidualLayer, nativeOrdinaryPresentationBeforeFinalBatch, tsSharedSourceBeforeNativeOrdinary } from './native-ordinary-final-history-checks.ts';

type Language = 'st' | 've' | 'ts';
type Pair = { sourceEnglish: string; reviewStatus: string; sesothoDraft?: string; tshivendaDraft?: string; xitsongaDraft?: string };
type Field = {
  order: number;
  candidateIndexes: number[];
  field: { moduleId: string; language: Language; lessonId: string; fieldLocator: string };
  sourceEnglish: string;
  currentTarget: string;
  appliedTarget: string;
  appliedWholeTarget: string;
  targetKey: 'sesothoDraft' | 'tshivendaDraft' | 'xitsongaDraft';
  registryExport: string;
  registryFile: string;
  appliedPairSourceEnglish: string;
  appliedPairReviewStatus: string;
  previousReviewStatus: string;
};

const reviewDir = path.join(process.cwd(), 'docs/study-translation-reviews/final-native-ordinary-application-2026-10-06');
const baseline = JSON.parse(readFileSync(path.join(reviewDir, 'baseline-native-modules.json'), 'utf8'));
const applied = JSON.parse(readFileSync(path.join(reviewDir, 'applied-native-fields.json'), 'utf8')) as { fields: Field[]; heldFields: unknown[]; excludedNoops: unknown[] };
const actualModules: Record<string, any> = {
  SESOTHO_READING_LANDSCAPE_DRAFT,
  TSHIVENDA_READING_LANDSCAPE_DRAFT,
  XITSONGA_READING_LANDSCAPE_DRAFT,
  SESOTHO_VEGETABLES_STAPLES_DRAFT,
  TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT,
  XITSONGA_VEGETABLES_STAPLES_DRAFT,
  XITSONGA_VEGETABLES_STAPLES_L2_DRAFT,
  SESOTHO_MARKET_COMMUNITY_DRAFT,
  TSHIVENDA_MARKET_COMMUNITY_DRAFT,
  XITSONGA_MARKET_COMMUNITY_DRAFT,
};
const sourceModule = (id: string) => COURSE_MODULES.find(module => module.id === id)!;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

function lessonAt(module: any, lessonId: string): any {
  const lesson = module.lessons.find((item: any) => item.id === lessonId);
  assert.ok(lesson, `${module.id}/${lessonId} exists in the native registry`);
  return lesson;
}
function pairAt(module: any, field: Field): Pair {
  const lesson = lessonAt(module, field.field.lessonId);
  const locator = field.field.fieldLocator;
  if (locator === 'infographicAlt') return lesson.infographicAlt;
  if (locator.startsWith('body.paragraph[')) return lesson.body;
  const quizIndex = Number(locator.match(/^quiz\[(\d+)\]/)?.[1]);
  if (locator.endsWith('.rationale')) return lesson.quiz[quizIndex].rationale;
  const optionIndex = Number(locator.match(/\.option\[(\d+)\]/)?.[1]);
  return lesson.quiz[quizIndex].options[optionIndex];
}
function sourceAt(lesson: any, locator: string): string {
  if (locator === 'infographicAlt') return lesson.infographicAlt;
  if (locator.startsWith('body.paragraph[')) return lesson.body.split('\n\n')[Number(locator.match(/\[(\d+)\]/)?.[1])];
  const quizIndex = Number(locator.match(/^quiz\[(\d+)\]/)?.[1]);
  if (locator.endsWith('.rationale')) return lesson.quiz[quizIndex].rationale;
  const optionIndex = Number(locator.match(/\.option\[(\d+)\]/)?.[1]);
  return lesson.quiz[quizIndex].options[optionIndex];
}
function targetAt(content: any, locator: string): string {
  if (locator === 'infographicAlt') return content.infographicAlt;
  if (locator.startsWith('body.paragraph[')) return content.body.split('\n\n')[Number(locator.match(/\[(\d+)\]/)?.[1])];
  const quizIndex = Number(locator.match(/^quiz\[(\d+)\]/)?.[1]);
  if (locator.endsWith('.rationale')) return content.quiz[quizIndex].rationale;
  const optionIndex = Number(locator.match(/\.option\[(\d+)\]/)?.[1]);
  return content.quiz[quizIndex].options[optionIndex];
}
function setTarget(module: any, field: Field): void {
  const pair = pairAt(module, field);
  pair[field.targetKey] = field.appliedWholeTarget;
  pair.reviewStatus = 'machine-draft';
}
function numberTokens(value: string): string[] { return value.match(/\d+(?:[.,]\d+)?/g) ?? []; }

function assertThroughLocalFrostSeason(value: string): void {
  assert.ok(value.includes('ho pholletsa le sehla sa frost sa sebakeng seo') || value.includes('through the local frost season'));
}
function assertSiteSuitableWaterWorks(value: string): void {
  assert.match(value, /water works dzinwe na dzinwe dzine dza fanelea fhethu hono/);
}
function assertTreatmentScope(value: string, language: Language): void {
  const exactEnding = language === 'st'
    ? 'O se ke wa itirela metswako kapa stronger doses.'
    : language === 've'
      ? 'Ni songo ḓiitela misanganedzo kana stronger doses.'
      : 'U nga tiendleli swihlanganisi kumbe stronger doses.';
  assert.ok(value.endsWith(exactEnding), 'one negative must govern making up mixtures or stronger doses');
}
function assertL2Sequence(value: string): void {
  const harvested = value.indexOf('xa tshoveriwa');
  const sowing = value.indexOf('then a new sowing goes in beside a slower crop that is still growing');
  const neverEmpty = value.indexOf('leswaku bed yi nga tshuki yi sala yi nga ri na swimilana');
  assert.ok(harvested >= 0 && sowing >= 0 && neverEmpty >= 0 && harvested < sowing && sowing < neverEmpty,
    'the fast harvest, new sowing beside the still-growing slower crop, and never-empty result stay ordered');
}

test('The 28 native ordinary overlays stay source-bound, complete, ordered and visibly machine-draft', () => {
  assert.equal(applied.fields.length, 28);
  assert.equal(applied.heldFields.length, 1, 'the whether/if option remains held for a source-faithful rewrite');
  assert.equal(applied.excludedNoops.length, 1, 'the identical VE market rationale is not presented as an edit');
  assert.ok(applied.fields.every(field => ![64, 72].includes(field.order)));

  const expectedByRegistry: Record<string, any> = {};
  const historicalModules: Record<string, any> = {};
  for (const [exportName, snapshot] of Object.entries<any>(baseline.nativeModules)) {
    expectedByRegistry[exportName] = structuredClone(snapshot.module);
    historicalModules[exportName] = nativeOrdinaryBeforeResidualLayer(actualModules[exportName]);
  }
  const seen = new Set<string>();
  const changedSourceLessons = new Set<string>();
  for (const field of applied.fields) {
    const identity = `${field.field.moduleId}|${field.field.language}|${field.field.lessonId}|${field.field.fieldLocator}`;
    assert.equal(seen.has(identity), false, `duplicate native field ${identity}`);
    seen.add(identity);
    const canonical = sourceModule(field.field.moduleId).lessons.find(lesson => lesson.id === field.field.lessonId)!;
    assert.equal(sourceAt(canonical, field.field.fieldLocator), field.sourceEnglish, `${identity}: exact canonical source and index`);
    const native = historicalModules[field.registryExport];
    assert.ok(native, `${identity}: current native registry export is imported`);
    const pair = pairAt(native, field);
    assert.equal(pair.sourceEnglish, field.field.fieldLocator.startsWith('body.paragraph[') ? canonical.body : field.sourceEnglish,
      `${identity}: complete source pair still matches canonical source`);
    assert.equal(field.appliedPairSourceEnglish, pair.sourceEnglish);
    assert.equal(pair.reviewStatus, 'machine-draft', `${identity}: facilitator review remains pending`);
    assert.equal(field.appliedPairReviewStatus, 'machine-draft');
    assert.equal(typeof pair[field.targetKey], 'string', `${identity}: target is an actual string`);
    assert.ok(pair[field.targetKey]!.trim(), `${identity}: target is nonempty`);
    assert.equal(pair[field.targetKey], field.appliedWholeTarget, `${identity}: full registered target equals the accepted composition`);
    assert.equal(targetAt({
      title: '', body: pair[field.targetKey], infographicAlt: pair[field.targetKey],
      quiz: [{ rationale: pair[field.targetKey], options: [pair[field.targetKey]] }, { rationale: pair[field.targetKey], options: [pair[field.targetKey]] }],
    }, field.field.fieldLocator), field.appliedTarget, `${identity}: exact accepted field landed at the registered index`);
    assert.deepEqual(numberTokens(field.sourceEnglish), numberTokens(field.appliedTarget), `${identity}: source figures are unchanged`);

    const expectedModule = expectedByRegistry[field.registryExport];
    assert.ok(expectedModule, `${identity}: full baseline module snapshot exists`);
    setTarget(expectedModule, field);

    const canonicalLesson = sourceModule(field.field.moduleId).lessons.find(lesson => lesson.id === field.field.lessonId)!;
    const presentation = resolveLearnerLessonPresentation(canonicalLesson, field.field.language);
    assert.equal(presentation.status, 'draft', `${identity}: localized learner view remains labelled draft`);
    const liveTarget = targetAt(presentation.content, field.field.fieldLocator);
    if (liveTarget !== field.appliedTarget) {
      const supersededBedPhrase = field.field.moduleId === 'vegetables-staples' && field.field.language === 'st'
        && field.field.lessonId === 'vegetables-staples-l1' && field.field.fieldLocator === 'body.paragraph[8]';
      const supersededIncomeTerm = field.field.moduleId === 'market-community' && field.field.language === 'ts'
        && field.field.lessonId === 'market-community-l2' && field.field.fieldLocator === 'body.paragraph[8]';
      const supersededWhetherLandPhrase = field.field.moduleId === 'market-community' && field.field.language === 'ts'
        && field.field.lessonId === 'market-community-l3' && field.field.fieldLocator === 'body.paragraph[10]';
      const laterLayerField = supersededBedPhrase || supersededIncomeTerm || supersededWhetherLandPhrase;
      assert.ok(laterLayerField, `${identity}: only an explicitly listed later layer may supersede this accepted historical target`);
      const latestTarget = supersededBedPhrase
        ? 'Raised beds di loketse mobu o metsi, moo metsi a hlokang sebaka sa ho phallela teng.'
        : supersededIncomeTerm
          ? 'Vukulu bya ndhawu ya xirhapa kumbe nhlayo ya vaxavi ntsena a swi vhumbeli mali leyi nghenaka. Ringeta ndlela leyi u nga kotaka ku yi lawula, kutani u tsala leswi humeleleke.'
          : 'Tsala maendlelo, swiyimo ni mbuyelo leswaku van’wana va kota ku kambela whether swi nga ha faneleka eka land ya vona.';
      assert.equal(liveTarget, latestTarget,
        `${identity}: newest accepted source-bound target is exposed by the current learner resolver`);
      const projectedLesson = historicalModules[field.registryExport].lessons.find((lesson: any) => lesson.id === field.field.lessonId);
      const projectedTarget = field.field.fieldLocator.startsWith('body.paragraph[')
        ? projectedLesson.body[field.targetKey].split('\n\n')[Number(field.field.fieldLocator.match(/\[(\d+)\]/)?.[1])]
        : targetAt(projectedLesson, field.field.fieldLocator);
      assert.equal(projectedTarget, field.appliedTarget, `${identity}: immutable historical projection retains the earlier accepted target`);
    } else {
      assert.equal(liveTarget, field.appliedTarget, `${identity}: resolver exposes the exact registered field`);
    }
    changedSourceLessons.add(`${field.field.moduleId}|${field.field.language}|${field.field.lessonId}`);
  }
  assert.equal(seen.size, 28);

  for (const [exportName, expected] of Object.entries(expectedByRegistry)) {
    assert.deepEqual(historicalModules[exportName], expected, `${exportName}: projected 28-field layer equals baseline plus only listed targets`);
    const rewound = nativeOrdinaryBeforeFinalBatch(actualModules[exportName]);
    assert.deepEqual(rewound, baseline.nativeModules[exportName].module, `${exportName}: reusable latest-layer validator returns the exact baseline only after validation`);
    assert.notEqual(rewound, actualModules[exportName], `${exportName}: historical reconstruction never mutates the imported live registry`);
  }

  const checked = actualModules.TSHIVENDA_READING_LANDSCAPE_DRAFT;
  const changedUnlisted = structuredClone(checked);
  changedUnlisted.lessons[0].keyPoints[0].tshivendaDraft += ' extra';
  assert.throws(() => nativeOrdinaryBeforeFinalBatch(changedUnlisted), 'complete-object validation rejects an unlisted edit before rewind');
  const changedSource = structuredClone(checked);
  changedSource.lessons[0].body.sourceEnglish += ' extra';
  assert.throws(() => nativeOrdinaryBeforeFinalBatch(changedSource), 'complete-object validation rejects native source drift before rewind');
  const removedAnswer = structuredClone(checked);
  removedAnswer.lessons[0].quiz.pop();
  assert.throws(() => nativeOrdinaryBeforeFinalBatch(removedAnswer), 'complete-object validation rejects a missing ordered quiz item before rewind');

  for (const identity of changedSourceLessons) {
    const [moduleId, language, lessonId] = identity.split('|') as [string, Language, string];
    const lesson = sourceModule(moduleId).lessons.find(item => item.id === lessonId)!;
    const changedSource = { ...lesson, body: `${lesson.body} A changed source condition.` };
    const result = resolveLearnerLessonPresentation(changedSource, language);
    assert.equal(result.status, 'english-fallback', `${identity}: changed source withdraws the stale regional lesson`);
    assert.equal(result.content.body, changedSource.body, `${identity}: fallback shows the exact current English source`);
  }

  // Prove that the complete-object comparison notices an unlisted edit and source/index drift.
  const actual = actualModules[Object.keys(actualModules).find(name => expectedByRegistry[name])!];
  const wrongUnlisted = structuredClone(expectedByRegistry[Object.keys(actualModules).find(name => expectedByRegistry[name])!]);
  wrongUnlisted.lessons[0].id = 'wrong-lesson-order-or-identity';
  assert.throws(() => assert.deepEqual(actual, wrongUnlisted), 'the complete-object validator rejects unlisted lesson identity/order drift');
});

test('Native safeguards reject weakened duration, safety scope, numeric anchors and planting order', () => {
  const stBody = applied.fields.find(field => field.order === 15)!.appliedTarget;
  const stRationale = applied.fields.find(field => field.order === 16)!.appliedTarget;
  assertThroughLocalFrostSeason(stBody);
  assertThroughLocalFrostSeason(stRationale);
  assert.throws(() => assertThroughLocalFrostSeason(stBody.replace('ho pholletsa', 'nakong ya')),
    'during the season cannot replace the required through-the-full-season comparison');

  const waterWorks = applied.fields.find(field => field.order === 11)!.appliedTarget;
  assertSiteSuitableWaterWorks(waterWorks);
  assert.throws(() => assertSiteSuitableWaterWorks(waterWorks.replace(' dzine dza fanelea fhethu hono', '')),
    'an unqualified any-waterworks instruction fails the suitability guard');

  for (const order of [43, 48, 56]) {
    const field = applied.fields.find(item => item.order === order)!;
    assertTreatmentScope(field.appliedTarget, field.field.language);
    const mutation = field.field.language === 'st'
      ? field.appliedTarget.replace('O se ke wa itirela metswako kapa stronger doses.', 'Sebelisa mixtures kapa stronger doses.')
      : field.field.language === 've'
        ? field.appliedTarget.replace('Ni songo ḓiitela misanganedzo kana stronger doses.', 'Shumisani mixtures kana stronger doses.')
        : field.appliedTarget.replace('U nga tiendleli swihlanganisi kumbe stronger doses.', 'Tirhisa stronger doses ni endla mixtures.');
    assert.throws(() => assertTreatmentScope(mutation, field.field.language),
      `${field.field.language}: removing the shared negative or improvise scope must fail`);
  }

  const l2 = applied.fields.find(field => field.order === 38)!;
  assertL2Sequence(l2.appliedTarget);
  const sowingClause = 'then a new sowing goes in beside a slower crop that is still growing';
  const neverEmptyClause = 'leswaku bed yi nga tshuki yi sala yi nga ri na swimilana';
  const movedAfter = l2.appliedTarget.replace(`, ${sowingClause},`, ',').replace(neverEmptyClause, `${neverEmptyClause}, ${sowingClause}`);
  assert.throws(() => assertL2Sequence(movedAfter), 'the new sowing cannot move after the never-empty result');

  const width = applied.fields.find(field => field.order === 27)!;
  assert.deepEqual(numberTokens(width.sourceEnglish), numberTokens(width.appliedTarget));
  assert.throws(() => assert.deepEqual(numberTokens(width.sourceEnglish), numberTokens(width.appliedTarget.replace('1.2', '1.3'))),
    'changing the source bed-width figure must fail');
});

test('Presentation history rewind requires a correct current learner field and never mutates its caller', () => {
  const source = sourceModule('market-community').lessons.find(lesson => lesson.id === 'market-community-l1')!;
  const current = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(current.status, 'draft');
  const suppliedBefore = structuredClone(current);
  const historical = nativeOrdinaryPresentationBeforeFinalBatch(current, source.id, 'st');
  assert.notDeepEqual(historical.content.body, current.content.body, 'the verified accepted body field is reconstructed to its exact baseline target');
  assert.deepEqual(current, suppliedBefore, 'a successful reconstruction leaves the caller presentation byte-equivalent');

  const corrupted = structuredClone(suppliedBefore);
  const paragraphs = corrupted.content.body.split('\n\n');
  paragraphs[8] += ' changed';
  corrupted.content.body = paragraphs.join('\n\n');
  const corruptedBefore = structuredClone(corrupted);
  assert.throws(() => nativeOrdinaryPresentationBeforeFinalBatch(corrupted, source.id, 'st'),
    'a stale or changed supplied learner target cannot be hidden by rewinding');
  assert.deepEqual(corrupted, corruptedBefore, 'failed validation also leaves the caller presentation untouched');
});


test('later TS Reading projection preserves the complete Intro968 shared file and rejects caller or unlisted corruption', () => {
  const bytes = readFileSync('lib/course-translation-drafts-ts.ts', 'utf8');
  const restored = tsSharedSourceBeforeNativeOrdinary(bytes);
  assert.notEqual(restored, bytes, 'the single accepted Reading body is actually rewound');
  assert.match(restored, /Hlawula any water works for the site/);
  const unlistedBytes = bytes + '\n// Unapproved shared-source change.\n';
  assert.notEqual(unlistedBytes, bytes);
  // The later whole-file fairness guard now detects unlisted corruption first.
  assert.throws(() => tsSharedSourceBeforeNativeOrdinary(unlistedBytes), /entire current file matches the reviewed fairness layer/);
  const mutated = structuredClone(XITSONGA_READING_LANDSCAPE_DRAFT);
  mutated.lessons[0].body.sourceEnglish += ' Changed source.';
  assert.throws(() => tsSharedSourceBeforeNativeOrdinary(bytes, mutated), /imported current registry equals the complete reviewed applied object/);
  const alteredIndex = structuredClone(XITSONGA_READING_LANDSCAPE_DRAFT);
  alteredIndex.lessons[0].quiz[0].sourceCorrectIndex = 99;
  assert.throws(() => tsSharedSourceBeforeNativeOrdinary(bytes, alteredIndex), /imported current registry equals the complete reviewed applied object/);
  assert.throws(() => tsSharedSourceBeforeNativeOrdinary(restored), /entire current file matches the reviewed fairness layer/);
});
