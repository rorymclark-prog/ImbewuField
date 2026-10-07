import { mapNativeBefore, mapPresentationBefore } from './reading-map-comparisons-history-checks.ts';
import assert from 'node:assert/strict';
import { followupNativeBefore, followupPresentationBefore, followupSourceBefore } from './core-reading-vegetables-followup-history-checks.ts';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { precisionSourceBytesBefore } from './study-precision-history-checks.ts';
import { comparisonsNativeBefore, comparisonsPresentationBefore } from './reading-comparisons-history-checks.ts';
import { coreHeldOrdinaryPairBefore, coreHeldOrdinaryPairBeforeHistory, coreHeldOrdinaryPairBytesBefore, coreHeldOrdinaryAssetBefore, ensureCoreHeldOrdinaryText } from './core-held-ordinary-history-checks.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { veReadingFrostNativeBefore, veReadingFrostPairBefore, veReadingFrostSourceBefore } from './ve-reading-frost-history-checks.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as tsL2 } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
const folder = 'docs/study-translation-reviews/final-language-next-2026-10-06/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(folder + 'applied-plan.json');
assert.equal(sha(planBytes), '3b8a863dfbb288465084a39f480dbffa9e92938f0465e101f9a37b1f034a4370', 'root-accepted 48-field composition and schema-only split are immutable');
export const finalLanguageNextPlan = JSON.parse(planBytes.toString());
const plan = finalLanguageNextPlan;
const beforeNative = JSON.parse(readFileSync(folder + 'before/native-registries.json', 'utf8'));
const canonicalBefore = JSON.parse(readFileSync(folder + 'before/canonical-modules.json', 'utf8'));
const beforePairs: Record<string, any> = {};
const expectedPairs: Record<string, any> = {};
const expectedNative = structuredClone(beforeNative);
export const finalLanguageNextNativeFiles: Record<string, any> = {
  'lib/course-translation-drafts-ve-vegetables-staples.ts': ve,
  'lib/course-translation-drafts-ts-vegetables-staples.ts': ts,
  'lib/course-translation-drafts-ts-vegetables-staples-l2.ts': tsL2,
};
const get = (object: any, parts: (string | number)[]) => parts.reduce((value, key) => value[key], object);
for (const row of plan.nativePlans) {
  const current = get(expectedNative[row.file].lessons[row.lessonArrayIndex], row.parts);
  assert.deepEqual(current, row.beforeObject, 'native starting object is exact, including status/source');
  Object.assign(current, row.afterObject);
}
for (const file of new Set<string>(plan.pairPlans.map((row: any) => row.file))) {
  const bytes = readFileSync(folder + 'before/' + file.replaceAll('/', '__') + '.txt');
  const row = plan.pairPlans.find((row: any) => row.file === file);
  assert.equal(sha(bytes), row.actualBeforeFileSHA, 'whole paired baseline is frozen');
  beforePairs[file] = JSON.parse(bytes.toString());
  expectedPairs[file] = structuredClone(beforePairs[file]);
}
for (const row of plan.pairPlans) {
  const slide = expectedPairs[row.file].slides.find((slide: any) => slide.n === row.slide);
  if (row.kind === 'heading') slide.target.heading = row.afterObject;
  else slide.target.body[row.index] = row.afterObject;
}
export function readFinalLanguageNextInputs() {
  return { native: structuredClone(finalLanguageNextNativeFiles), paired: Object.fromEntries(Object.keys(expectedPairs).map(file => [file, JSON.parse(readFileSync(file, 'utf8'))])) };
}
export function validateFinalLanguageNextText(input = readFinalLanguageNextInputs()) {
  // 7 October adds 109 reviewed paired leaves. Validate that complete newer
  // layer before preserving these older 39-field claims against their baseline.
  input = {
    ...input,
    native: Object.fromEntries(Object.entries(input.native).map(([file, value]: [string, any]) => {
      value = followupNativeBefore(value);
      return [file, value.language === 've' && value.id === 'reading-landscape' ? veReadingFrostNativeBefore('ve', value) : value];
    })),
    paired: Object.fromEntries(Object.entries(input.paired).map(([file, value]) => [file, coreHeldOrdinaryPairBefore(file, veReadingFrostPairBefore(file, value))]))
  };
  assert.deepEqual(COURSE_MODULES, canonicalBefore, 'all canonical English and indices stay exact');
  assert.equal(sha(readFileSync('lib/course-modules.ts')), plan.canonicalFileSHA256);
  assert.equal(plan.nativePlans.length, 9); assert.equal(plan.pairPlans.length, 39);
  assert.deepEqual(input.native, expectedNative, 'complete current native 9-field overlay and every unlisted field');
  assert.deepEqual(input.paired, expectedPairs, 'complete current 39-field paired overlay/source/status/provenance and unlisted objects');
  for (const row of plan.nativePlans) {
    const canonical = COURSE_MODULES.find(module => module.id === row.moduleId)!.lessons.find(lesson => lesson.id === row.lessonId)!;
    assert.equal(get(canonical, row.parts.map((key: string | number) => key === 'question' ? 'q' : key)), row.canonicalSource.exact);
  }
  for (const module of Object.values(input.native) as any[]) for (const lesson of module.lessons) {
    const canonical = COURSE_MODULES.find(item => item.id === module.id)!.lessons.find(item => item.id === lesson.id)!;
    lesson.quiz.forEach((question: any, index: number) => assert.equal(question.sourceCorrectIndex, canonical.quiz[index].correct));
  }
  for (const row of plan.pairPlans) {
    const slide = input.paired[row.file].slides.find((slide: any) => slide.n === row.slide);
    const source = row.kind === 'heading' ? slide.english.heading : slide.english.body[row.index];
    const target = row.kind === 'heading' ? slide.target.heading : slide.target.body[row.index];
    assert.equal(source, row.source);
    assert.equal(target.status === 'mixed' ? target.segments.map((part: any) => part.status === 'english-hold' ? part.sourceEnglish : part.text).join('') : target.text, row.target);
    if (target.status === 'mixed') {
      assert.ok(target.segments.length >= 2);
      assert.equal(target.segments.map((part: any) => part.sourceEnglish).join(''), source);
      for (const part of target.segments) {
        if (part.status === 'english-hold') assert.ok(!('text' in part), 'literal English stays source-only');
        else assert.notEqual(part.text, part.sourceEnglish, 'source-copy cannot masquerade as a translated segment');
      }
    }
  }
  // Whole native file bytes also protect other exports after module import.
  for (const [file, digest] of Object.entries({"lib/course-translation-drafts-ve-vegetables-staples.ts": "811401edf7fe0a2ec6048406999fa519c748954e6cc7621a742e392db98fbdad", "lib/course-translation-drafts-ts-vegetables-staples-l2.ts": "e85fbc6aca65654f4154399ce77616f186532bed5f73db7b38422daa813e05f4", "lib/course-translation-drafts-ts-vegetables-staples.ts": "d41a4f1273cfcc1faa68b618d427418edb838f4728787a4ea4e9f167084ab78d"})) {
    const predecessor = followupSourceBefore(file, readFileSync(file));
    assert.equal(sha(predecessor), digest, 'complete native file bytes after the newest exact file layer is projected');
  }
  // Only active silent text changes; archive/audio remain actual byte checks.
  for (const item of plan.protectedInventory) {
    const bytes = readFileSync(item.path);
    assert.equal(coreHeldOrdinaryAssetBefore(item.path,bytes)?.sha256 ?? sha(coreHeldOrdinaryPairBytesBefore(item.path,bytes)), item.sha256, 'ST archives and audio remain exact; checked active silent cards expose their predecessor');
  }
}
// Historical accessors cache validation only while all relevant disk signatures
// remain unchanged; explicit caller objects are always compared in full.
let lastSignature = '';
export function ensureFinalLanguageNextCurrent() {
  ensureCoreHeldOrdinaryText();
  const files = [...Object.keys(expectedPairs), ...Object.keys(expectedNative), 'lib/course-modules.ts', ...plan.protectedInventory.map((item: any) => item.path)];
  const signature = files.map(file => { const s = statSync(file, { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':'); }).join('|');
  if (signature !== lastSignature) { validateFinalLanguageNextText(); lastSignature = signature; }
}
export function finalLanguageNextNativeBefore<T>(actual: T): T {
  actual = followupNativeBefore(actual);
  if ((actual as any)?.language === 've' && (actual as any)?.id === 'reading-landscape') actual = veReadingFrostNativeBefore('ve', actual);
  // Reading's later ten-field layer independently validates the whole registry
  // before this dated native-language release reconstructs its predecessor.
  const identity = actual as any;
  if (identity?.id === 'reading-landscape' && identity.language === 'st') actual = mapNativeBefore('st', actual);
  if (identity?.id === 'reading-landscape' && (identity.language === 've' || identity.language === 'ts')) {
    actual = comparisonsNativeBefore(identity.language, actual);
  }
  ensureFinalLanguageNextCurrent();
  const module = actual as any;
  const file = Object.keys(expectedNative).find(file => expectedNative[file].language === module?.language && expectedNative[file].lessons.map((lesson: any) => lesson.id).join('|') === module?.lessons?.map((lesson: any) => lesson.id).join('|'));
  if (!file) return actual;
  assert.deepEqual(actual, expectedNative[file], 'caller supplies the complete accepted latest native layer, not a pre-rewound/mutated module');
  return structuredClone(beforeNative[file]);
}
export function finalLanguageNextDeckBefore<T>(file: string, actual: T): T {
  actual = veReadingFrostPairBefore(file, actual);
  ensureFinalLanguageNextCurrent(); if (!(file in expectedPairs)) return coreHeldOrdinaryPairBefore(file, actual);
  actual = coreHeldOrdinaryPairBefore(file, actual);
  assert.deepEqual(actual, expectedPairs[file], 'caller supplies the complete accepted latest paired layer');
  return structuredClone(beforePairs[file]);
}
export function finalLanguageNextDeckBeforeCurrent<T>(actual: T): T {
  const deck = actual as any;
  const file = Object.keys(expectedPairs).find(file => expectedPairs[file].language === deck?.language && expectedPairs[file].slides[0].english.heading === deck?.slides?.[0]?.english?.heading);
  return file ? finalLanguageNextDeckBefore(file, actual) : actual;
}
export function finalLanguageNextPairedBytesBefore(file: string, bytes: Uint8Array | string): string {
  const suppliedCurrent = Buffer.from(bytes).toString();
  assert.equal(suppliedCurrent, readFileSync(file, 'utf8'), 'passed paired bytes are actual current bytes');
  bytes = veReadingFrostSourceBefore(file, bytes);
  bytes = precisionSourceBytesBefore(file, bytes);
  ensureFinalLanguageNextCurrent(); if (!(file in expectedPairs)) return Buffer.from(coreHeldOrdinaryPairBytesBefore(file,Buffer.from(bytes))).toString();
  const actual = coreHeldOrdinaryPairBefore(file, JSON.parse(Buffer.from(bytes).toString()));
  assert.deepEqual(actual, expectedPairs[file], 'whole listed paired bytes match accepted source/target/status before dated hash view');
  return readFileSync(folder + 'before/' + file.replaceAll('/', '__') + '.txt', 'utf8');
}

/** 6 October: validate the actual complete learner presentation before restoring
 * only the nine later native leaves for dated assessment claims. */
export function finalLanguageNextPresentationBefore<T extends { status: string; content: any }>(result: T, lessonId: string, language: string): T {
  result = followupPresentationBefore(result, lessonId, language);
  if (lessonId === 'reading-landscape-l2' && language === 've') {
    const live = resolveLearnerLessonPresentation(COURSE_MODULES.flatMap(module => module.lessons).find(lesson => lesson.id === lessonId)!, 've');
    assert.deepEqual(result, live, 'complete current VE learner presentation before accepted frost locative projection');
    const restored = structuredClone(result);
    const parts = restored.content.body.split('\n\n');
    assert.match(parts[2], /Ni songo vhea zwimela zwi sa konḓeleliho kha known low frost pockets\./);
    parts[2] = parts[2].replace('Ni songo vhea zwimela zwi sa konḓeleliho kha known low frost pockets.', 'Ni songo vhea zwimela zwi sa konḓeleliho known low frost pockets.');
    restored.content.body = parts.join('\n\n');
    result = restored;
  }
  result = mapPresentationBefore(result, lessonId, language);
  result = comparisonsPresentationBefore(result, lessonId, language);
  ensureFinalLanguageNextCurrent();
  const rows = plan.nativePlans.filter((row: any) => row.lessonId === lessonId && expectedNative[row.file].language === language);
  if (!rows.length || result.status !== 'draft') return result;
  const canonical = COURSE_MODULES.find(module => module.id === rows[0].moduleId)!.lessons.find(lesson => lesson.id === lessonId)!;
  // The complete actual newest resolver is guarded first; this dated owner compares its exact predecessor.
  assert.deepEqual(result, followupPresentationBefore(resolveLearnerLessonPresentation(canonical, language as any), lessonId, language), 'entire actual learner presentation source/status/index/unlisted matches accepted latest native layer');
  const restored = structuredClone(result);
  const key = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  for (const row of rows) {
    const parts = row.parts.map((part: string | number) => part === 'question' ? 'q' : part);
    const parent = get(restored.content, parts.slice(0, -1));
    assert.equal(parent[parts.at(-1)], row.afterObject[key], 'listed current presentation target matches accepted source-bound pair');
    parent[parts.at(-1)] = row.beforeObject.reviewStatus === 'machine-draft' ? row.beforeObject[key] : row.beforeObject.sourceEnglish;
  }
  return restored;
}

/** Composition entry for dated layers: live full files are validated first;
 * a higher dated layer may already have restored these exact listed objects.
 * The older caller still validates its complete predecessor, including unlisted data. */
export function finalLanguageNextDeckBeforeHistory<T>(file: string, actual: T): T {
  // Historical consumers may arrive with exact leaves from an older dated
  // snapshot already restored. Validate the live newest batch, then compose
  // through the explicit history projection whose predecessor owner checks
  // the complete older pair.
  ensureFinalLanguageNextCurrent();
  actual = coreHeldOrdinaryPairBeforeHistory(file, actual);
  const restored: any = structuredClone(actual);
  for (const row of plan.pairPlans.filter((row: any) => row.file === file)) {
    const slide = restored.slides.find((slide: any) => slide.n === row.slide);
    const source = row.kind === 'heading' ? slide.english.heading : slide.english.body[row.index];
    assert.equal(source, row.source, 'dated composition retains exact latest source');
    const cell = row.kind === 'heading' ? slide.target.heading : slide.target.body[row.index];
    if (JSON.stringify(cell) !== JSON.stringify(row.beforeObject)) assert.deepEqual(cell, row.afterObject, 'dated caller contains only exact accepted latest or exact predecessor objects');
    if (row.kind === 'heading') slide.target.heading = structuredClone(row.beforeObject);
    else slide.target.body[row.index] = structuredClone(row.beforeObject);
  }
  return restored;
}
