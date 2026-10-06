import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { nativeOrdinaryBeforeFinalBatch, nativeOrdinaryBeforeResidualLayer, nativeOrdinaryPresentationBeforeFinalBatch, validateNativeOrdinaryResidualLayer } from './native-ordinary-final-history-checks.ts';
import { vegetablesDeckBeforeNativePairedResidual } from './native-paired-residual-history-checks.ts';

const layerDir = path.join(process.cwd(), 'docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/native-paired-residual-layer-2026-10-06');
const proof = JSON.parse(readFileSync(path.join(layerDir, 'applied-fields.json'), 'utf8'));
const normalization = JSON.parse(readFileSync(path.join(layerDir, 'schema-normalization.json'), 'utf8'));
const before = JSON.parse(readFileSync(path.join(layerDir, 'before/native-registry-modules.json'), 'utf8'));
const after = JSON.parse(readFileSync(path.join(layerDir, 'after/native-registry-modules.json'), 'utf8'));
const oldApplied = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/applied-native-modules.json'), 'utf8'));
const originalBaseline = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/baseline-native-modules.json'), 'utf8'));
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

const actualModules: Record<string, any> = {
  SESOTHO_VEGETABLES_STAPLES_DRAFT,
  TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT,
  XITSONGA_VEGETABLES_STAPLES_DRAFT,
  SESOTHO_MARKET_COMMUNITY_DRAFT,
  TSHIVENDA_MARKET_COMMUNITY_DRAFT,
  XITSONGA_MARKET_COMMUNITY_DRAFT,
};
const actualPairedFiles: Record<string, any> = Object.fromEntries(proof.fields.map((row: any) => row.paired.path)
  .filter((file: string, index: number, all: string[]) => all.indexOf(file) === index)
  .map((file: string) => [file, JSON.parse(readFileSync(path.join(process.cwd(), file), 'utf8'))]));

function cloneState(): { modules: Record<string, any>; paired: Record<string, any> } {
  return { modules: structuredClone(actualModules), paired: structuredClone(actualPairedFiles) };
}

function assertNormalizedTarget(row: any, pairedFiles: Record<string, any>): void {
  const slide = pairedFiles[row.path].slides.find((item: any) => item.n === row.slide);
  const actual = slide.target.body[row.bodyIndex];
  assert.deepEqual(actual, { status: 'draft', text: row.targetText, provenance: row.originalSegmentedTarget.provenance },
    `${row.order}: whole-draft schema text preserves the exact accepted target and provenance`);
  assert.equal(row.originalSegmentedTarget.segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish,
    `${row.order}: normalization proof retains the exact ordered source partition`);
  assert.equal(row.originalSegmentedTarget.segments.map((segment: any) => segment.status === 'english-hold'
    ? segment.sourceEnglish : segment.text ?? '').join(''), row.targetText,
  `${row.order}: normalized text equals the lossless concatenation of all accepted segments`);
}

test('the newest 13 paired fields are source-bound and rewind before the immutable 28-field layer', () => {
  assert.equal(proof.counts.pairedTargetCells, 13);
  assert.equal(proof.counts.nativeTargetFields, 3);
  assert.equal(proof.counts.nativeOnlyNoopBindings, 10);
  assert.equal(proof.counts.pairedFiles, 6);
  assert.equal(proof.counts.nativeRegistryModules, 6);
  assert.equal(proof.status, 'unreviewed machine draft; no fluency or publication approval');
  validateNativeOrdinaryResidualLayer(actualModules, actualPairedFiles);

  for (const [exportName, actual] of Object.entries(actualModules)) {
    assert.deepEqual(actual, after[exportName], `${exportName}: full current module, including every unlisted field, equals the frozen newest layer`);
    const projected = nativeOrdinaryBeforeResidualLayer(actual);
    assert.deepEqual(projected, before[exportName], `${exportName}: newest rewind returns the exact prior 28-field layer`);
    assert.deepEqual(projected, oldApplied.modules[exportName], `${exportName}: newest prior layer is byte-structure-equal to the immutable 28-field proof`);
    assert.deepEqual(nativeOrdinaryBeforeFinalBatch(actual), originalBaseline.nativeModules[exportName]?.module,
      `${exportName}: sequential history rewind reaches the original pre-28-field baseline`);
  }

  for (const row of proof.fields) {
    assert.equal(row.paired.sourceJoin, row.sourceEnglish, `${row.order}: exact ordered source segment join`);
    assert.equal(row.paired.renderedTarget, row.native.appliedTarget, `${row.order}: full paired target equals the native target`);
    assert.equal(row.paired.sourceJoinExact, true);
    assert.equal(row.paired.renderedEqualsNative, true);
  }

  for (const row of proof.fields.filter((item: any) => item.native.changed)) {
    const sourceModule = COURSE_MODULES.find(module => module.id === row.moduleId)!;
    const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === row.native.lessonId)!;
    const currentPresentation = resolveLearnerLessonPresentation(sourceLesson, row.language);
    const originalPresentation = structuredClone(currentPresentation);
    const historical = nativeOrdinaryPresentationBeforeFinalBatch(currentPresentation, row.native.lessonId, row.language);
    const index = Number(row.native.fieldLocator.match(/\[(\d+)\]/)?.[1]);
    const projectedLesson = originalBaseline.nativeModules[row.native.registryExport].module.lessons.find((lesson: any) => lesson.id === row.native.lessonId);
    const expected = projectedLesson.body[targetKey[row.language as keyof typeof targetKey]].split('\n\n')[index];
    assert.equal(currentPresentation.content.body.split('\n\n')[index], row.native.appliedTarget,
      `${row.order}: current learner content presents the newest target before rewind`);
    assert.equal(historical.content.body.split('\n\n')[index], expected,
      `${row.order}: learner rewind crosses newest and prior layers to the frozen original field`);
    assert.deepEqual(currentPresentation, originalPresentation, `${row.order}: history projection never mutates caller-owned content`);
  }

  for (const order of [65, 66, 67]) {
    const row = proof.fields.find((item: any) => item.order === order);
    assert.equal(row.paired.appliedTarget.status, 'draft', `${order}: retained metric wording is not mislabeled as fully translated`);
    const rendered = row.paired.renderedTarget;
    assert.ok(rendered.includes('best yield per bed'), `${order}: exact accepted yield metric remains`);
    assert.ok(rendered.includes('the most return'), `${order}: exact accepted return metric remains`);
    assert.ok(normalization.rows.find((item: any) => item.order === order).originalSegmentedTarget.segments
      .some((segment: any) => segment.loanEnglishReviewReason?.includes('not fluent reviewed')),
      `${order}: retained metric wording carries its explicit review limitation`);
  }

  for (const order of [43, 48, 56]) {
    const row = proof.fields.find((item: any) => item.order === order);
    const segments = row.paired.appliedTarget.segments;
    assert.equal(segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish,
      `${order}: source prohibition remains an exact ordered partition`);
    const englishHolds = segments.filter((segment: any) => segment.status === 'english-hold').map((segment: any) => segment.sourceEnglish);
    assert.equal(englishHolds.at(-1), 'stronger doses', `${order}: the final source phrase is a bounded “stronger doses” hold`);
    assert.ok(segments.some((segment: any) => segment.sourceEnglish.trimStart() === 'Do not improvise ' && segment.status === 'draft'),
      `${order}: the shared negative “improvise” framing remains translated for both objects`);
  }

  const stBed = proof.fields.find((row: any) => row.order === 25);
  assert.ok(stBed.paired.renderedTarget.includes('moo metsi a hlokang'), 'order 25 preserves the already localized clause');
});

test('renderer accepts all six complete paired files and schema normalization preserves every annotated target', () => {
  assert.equal(normalization.rows.length, 6);
  const normalizationBytes = readFileSync(path.join(layerDir, 'schema-normalization.json'));
  assert.equal(createHash('sha256').update(normalizationBytes).digest('hex'), proof.authorityNormalization.sha256,
    'current implementation proof binds the frozen six-row normalization record');
  for (const file of Object.keys(actualPairedFiles)) {
    const language = file.match(/\.(st|ve|ts)\.paired-draft\.json$/)?.[1];
    const moduleId = file.includes('vegetables-staples') ? 'vegetables-staples' : 'market-community';
    const source = englishSlideRecords(readFileSync(`docs/narration/${moduleId}.en.md`, 'utf8'));
    assert.equal(validatePairedDraft(actualPairedFiles[file], source, language).length, source.length,
      `${file}: complete current paired deck passes the standard renderer validator`);
  }
  for (const row of normalization.rows) assertNormalizedTarget(row, actualPairedFiles);

  const blank = structuredClone(actualPairedFiles);
  const blankRow = normalization.rows[0];
  blank[blankRow.path].slides.find((item: any) => item.n === blankRow.slide).target.body[blankRow.bodyIndex].text = '';
  const blankSource = englishSlideRecords(readFileSync(`docs/narration/vegetables-staples.en.md`, 'utf8'));
  assert.throws(() => validatePairedDraft(blank[blankRow.path], blankSource, blankRow.language), /target draft text is missing/,
    'the standard validator rejects a lost normalized target');

  const changed = structuredClone(actualPairedFiles);
  const changedRow = normalization.rows[0];
  changed[changedRow.path].slides.find((item: any) => item.n === changedRow.slide).target.body[changedRow.bodyIndex].text += ' extra';
  assert.doesNotThrow(() => {
    const src = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
    validatePairedDraft(changed[changedRow.path], src, changedRow.language);
  }, 'the standard structural validator accepts draft wording without assessing its source-faithful content');
  assert.throws(() => assertNormalizedTarget(changedRow, changed), /whole-draft schema text preserves/,
    'the source-bound normalization proof catches a different target concatenation');
});

test('the newest layer rejects current source, target, status, index, and unlisted drift before rewind', () => {
  const sourceDrift = cloneState();
  sourceDrift.modules.SESOTHO_VEGETABLES_STAPLES_DRAFT.lessons[0].title.sesothoDraft += ' altered';
  assert.throws(() => validateNativeOrdinaryResidualLayer(sourceDrift.modules, sourceDrift.paired), /complete current registry/,
    'unlisted native target edits fail full module reconstruction');

  const pairTargetDrift = cloneState();
  const stPath = 'docs/narration/vegetables-staples.st.paired-draft.json';
  pairTargetDrift.paired[stPath].slides.find((slide: any) => slide.n === 5).target.body[4].segments[1].text += ' altered';
  assert.throws(() => validateNativeOrdinaryResidualLayer(pairTargetDrift.modules, pairTargetDrift.paired), /complete current paired file/,
    'a changed paired target fails the complete-file check');

  const sourceCellDrift = cloneState();
  sourceCellDrift.paired[stPath].slides.find((slide: any) => slide.n === 5).english.body[4] += ' altered';
  assert.throws(() => validateNativeOrdinaryResidualLayer(sourceCellDrift.modules, sourceCellDrift.paired), /complete current paired file/,
    'a changed paired source at an accepted index fails the complete-file check');

  const statusDrift = cloneState();
  const marketPath = 'docs/narration/market-community.st.paired-draft.json';
  statusDrift.paired[marketPath].slides.find((slide: any) => slide.n === 6).target.body[1].status = 'english-hold';
  assert.throws(() => validateNativeOrdinaryResidualLayer(statusDrift.modules, statusDrift.paired), /complete current paired file/,
    'changing the retained best/most loan phrase status fails the complete-file check');

  const indexDrift = cloneState();
  indexDrift.paired[marketPath].slides.find((slide: any) => slide.n === 6).target.body.reverse();
  assert.throws(() => validateNativeOrdinaryResidualLayer(indexDrift.modules, indexDrift.paired), /complete current paired file/,
    'paired body index/order changes fail the complete-file check');
});

test('Vegetables historical decks rewind only after all six newest paired files and thirteen source cells pass', () => {
  const pairedPath = 'docs/narration/vegetables-staples.st.paired-draft.json';
  const current = structuredClone(actualPairedFiles[pairedPath]);
  const prior = vegetablesDeckBeforeNativePairedResidual(current);
  const expectedPrior = JSON.parse(readFileSync(path.join(layerDir, 'before/paired-files/vegetables-staples.st.paired-draft.json'), 'utf8'));
  assert.deepEqual(prior, expectedPrior,
    'the complete accepted after-file projects to its frozen pre-residual deck, including every unlisted field');

  const targetDrift = structuredClone(current);
  targetDrift.slides.find((slide: any) => slide.n === 5).target.body[4].segments[1].text += ' drift';
  assert.throws(() => vegetablesDeckBeforeNativePairedResidual(targetDrift), /caller supplied the verified current deck/,
    'a changed target cannot be hidden by the historical projection');

  const sourceDrift = structuredClone(current);
  sourceDrift.slides.find((slide: any) => slide.n === 5).english.body[4] += ' drift';
  assert.throws(() => vegetablesDeckBeforeNativePairedResidual(sourceDrift), /caller supplied the verified current deck/,
    'a changed canonical paired source cannot be hidden by the historical projection');

  const indexDrift = structuredClone(current);
  indexDrift.slides[4].target.body.reverse();
  assert.throws(() => vegetablesDeckBeforeNativePairedResidual(indexDrift), /caller supplied the verified current deck/,
    'a reordered target index cannot be hidden by the historical projection');

  const unlistedDrift = structuredClone(current);
  unlistedDrift.slides[0].target.body[0].segments[0].text += ' drift';
  assert.throws(() => vegetablesDeckBeforeNativePairedResidual(unlistedDrift), /caller supplied the verified current deck/,
    'an unlisted title change cannot be hidden by the historical projection');
});
