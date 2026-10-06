import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT as readVe } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT as readTs } from '../lib/course-translation-drafts-ts.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT as readSt } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as vegSt } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as vegVe } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as vegTs } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as vegTsL2 } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT as marketSt } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT as marketVe } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT as marketTs } from '../lib/course-translation-drafts-ts-market-community.ts';

const root = '../docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/';
const baseline = JSON.parse(readFileSync(new URL(`${root}baseline-native-modules.json`, import.meta.url), 'utf8'));
const applied = JSON.parse(readFileSync(new URL(`${root}applied-native-modules.json`, import.meta.url), 'utf8'));
const fieldProof = JSON.parse(readFileSync(new URL(`${root}applied-native-fields.json`, import.meta.url), 'utf8'));
const residualRoot = `${root}native-paired-residual-layer-2026-10-06/`;
const residualBefore = JSON.parse(readFileSync(new URL(`${residualRoot}before/native-registry-modules.json`, import.meta.url), 'utf8'));
const residualApplied = JSON.parse(readFileSync(new URL(`${residualRoot}after/native-registry-modules.json`, import.meta.url), 'utf8'));
const residualProof = JSON.parse(readFileSync(new URL(`${residualRoot}applied-fields.json`, import.meta.url), 'utf8'));

const exportsByIdentity: Record<string, string> = {
  'reading-landscape:ve': 'TSHIVENDA_READING_LANDSCAPE_DRAFT',
  'reading-landscape:ts': 'XITSONGA_READING_LANDSCAPE_DRAFT',
  'reading-landscape:st': 'SESOTHO_READING_LANDSCAPE_DRAFT',
  'vegetables-staples:st': 'SESOTHO_VEGETABLES_STAPLES_DRAFT',
  'vegetables-staples:ve': 'TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT',
  'vegetables-staples:ts': 'XITSONGA_VEGETABLES_STAPLES_DRAFT',
  'vegetables-staples-l2:ts': 'XITSONGA_VEGETABLES_STAPLES_L2_DRAFT',
  'market-community:st': 'SESOTHO_MARKET_COMMUNITY_DRAFT',
  'market-community:ve': 'TSHIVENDA_MARKET_COMMUNITY_DRAFT',
  'market-community:ts': 'XITSONGA_MARKET_COMMUNITY_DRAFT',
};
const runtimeByExport: Record<string, any> = {
  TSHIVENDA_READING_LANDSCAPE_DRAFT: readVe, XITSONGA_READING_LANDSCAPE_DRAFT: readTs, SESOTHO_READING_LANDSCAPE_DRAFT: readSt,
  SESOTHO_VEGETABLES_STAPLES_DRAFT: vegSt, TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT: vegVe, XITSONGA_VEGETABLES_STAPLES_DRAFT: vegTs,
  XITSONGA_VEGETABLES_STAPLES_L2_DRAFT: vegTsL2, SESOTHO_MARKET_COMMUNITY_DRAFT: marketSt, TSHIVENDA_MARKET_COMMUNITY_DRAFT: marketVe,
  XITSONGA_MARKET_COMMUNITY_DRAFT: marketTs,
};
const keyFor = (language: string) => language === 've' ? 'tshivendaDraft' : language === 'ts' ? 'xitsongaDraft' : 'sesothoDraft';

function canonicalSource(moduleId: string, lessonId: string | undefined, locator: string): string {
  const module = COURSE_MODULES.find(item => item.id === moduleId);
  assert.ok(module, `${moduleId}: canonical module exists`);
  if (!lessonId) return (module as any)[locator];
  const lesson = module.lessons.find(item => item.id === lessonId);
  assert.ok(lesson, `${moduleId}/${lessonId}: canonical lesson exists`);
  if (locator === 'title' || locator === 'infographicAlt') return (lesson as any)[locator];
  let match = locator.match(/^body\.paragraph\[(\d+)\]$/);
  if (match) return lesson.body.split('\n\n')[Number(match[1])];
  match = locator.match(/^keyPoints\[(\d+)\]$/);
  if (match) return lesson.keyPoints[Number(match[1])];
  match = locator.match(/^quiz\[(\d+)\]\.(question|rationale|option\[(\d+)\])$/);
  assert.ok(match, `${locator}: recognized field locator`);
  const question = lesson.quiz[Number(match[1])];
  if (match[2] === 'question') return question.q;
  if (match[2] === 'rationale') return question.rationale;
  return question.options[Number(match[3])];
}

function nativeTarget(module: any, row: any): { pair?: any; target: string; set: (value: string) => void } {
  const { field } = row;
  if (!field.lessonId) {
    const pair = module[field.fieldLocator];
    const key = keyFor(field.language);
    return { pair, target: pair?.[key], set: value => { pair[key] = value; } };
  }
  const lesson = module.lessons.find((item: any) => item.id === field.lessonId);
  assert.ok(lesson, `${field.language}/${field.lessonId}: listed native lesson exists`);
  const key = keyFor(field.language);
  let match = field.fieldLocator.match(/^body\.paragraph\[(\d+)\]$/);
  if (match) {
    const index = Number(match[1]);
    const parts = lesson.body[key].split('\n\n');
    return { pair: lesson.body, target: parts[index], set: value => { const next = lesson.body[key].split('\n\n'); next[index] = value; lesson.body[key] = next.join('\n\n'); } };
  }
  match = field.fieldLocator.match(/^quiz\[(\d+)\]\.(question|rationale|option\[(\d+)\])$/);
  if (match) {
    const question = lesson.quiz[Number(match[1])];
    const pair = match[2] === 'question' ? question.question : match[2] === 'rationale' ? question.rationale : question.options[Number(match[3])];
    return { pair, target: pair[key], set: value => { pair[key] = value; } };
  }
  match = field.fieldLocator.match(/^keyPoints\[(\d+)\]$/);
  if (match) {
    const pair = lesson.keyPoints[Number(match[1])];
    return { pair, target: pair[key], set: value => { pair[key] = value; } };
  }
  const pair = lesson[field.fieldLocator];
  return { pair, target: pair?.[key], set: value => { pair[key] = value; } };
}

function presentationTarget(content: any, locator: string): string {
  let match = locator.match(/^body\.paragraph\[(\d+)\]$/);
  if (match) return content.body.split('\n\n')[Number(match[1])];
  match = locator.match(/^keyPoints\[(\d+)\]$/);
  if (match) return content.keyPoints[Number(match[1])];
  match = locator.match(/^quiz\[(\d+)\]\.(question|rationale|option\[(\d+)\])$/);
  if (match) {
    const question = content.quiz[Number(match[1])];
    if (match[2] === 'question') return question.q;
    if (match[2] === 'rationale') return question.rationale;
    return question.options[Number(match[3])];
  }
  return content[locator];
}

function setPresentationTarget(content: any, locator: string, value: string): void {
  let match = locator.match(/^body\.paragraph\[(\d+)\]$/);
  if (match) {
    const paragraphs = content.body.split('\n\n');
    paragraphs[Number(match[1])] = value;
    content.body = paragraphs.join('\n\n');
    return;
  }
  match = locator.match(/^keyPoints\[(\d+)\]$/);
  if (match) { content.keyPoints[Number(match[1])] = value; return; }
  match = locator.match(/^quiz\[(\d+)\]\.(question|rationale|option\[(\d+)\])$/);
  if (match) {
    const question = content.quiz[Number(match[1])];
    if (match[2] === 'question') question.q = value;
    else if (match[2] === 'rationale') question.rationale = value;
    else question.options[Number(match[3])] = value;
    return;
  }
  content[locator] = value;
}

const residualExports = new Set(Object.keys(residualApplied));
const residualPairedPaths = [...new Set(residualProof.fields.map((row: any) => row.paired.path))] as string[];

function readResidualPairedFiles(): Record<string, any> {
  return Object.fromEntries(residualPairedPaths.map(path => [path, JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))]));
}

/** Validate the complete newest overlay and its full paired files before exposing the prior layer. */
export function validateNativeOrdinaryResidualLayer(nativeModules: Record<string, any>, pairedFiles: Record<string, any>): void {
  for (const exportName of residualExports) {
    assert.deepEqual(nativeModules[exportName], residualApplied[exportName], `${exportName}: complete current registry equals the frozen newest layer`);
  }
  for (const path of residualPairedPaths) {
    const expected = JSON.parse(readFileSync(new URL(`${residualRoot}after/paired-files/${path.split('/').pop()}`, import.meta.url), 'utf8'));
    assert.deepEqual(pairedFiles[path], expected, `${path}: complete current paired file equals the frozen newest layer`);
  }
  for (const row of residualProof.fields) {
    const expectedSource = canonicalSource(row.moduleId, row.native.lessonId, row.native.fieldLocator);
    assert.equal(expectedSource, row.sourceEnglish, `${row.order}: newest native field is bound to the exact canonical source`);
    assert.equal(row.paired.sourceJoin, row.sourceEnglish, `${row.order}: paired source segments join to exact canonical source`);
    assert.equal(row.paired.sourceJoinExact, true, `${row.order}: source join proof is exact`);
    assert.equal(row.paired.renderedTarget, row.native.appliedTarget, `${row.order}: paired target renders to the complete native field`);
    assert.equal(row.paired.renderedEqualsNative, true, `${row.order}: rendered and native targets are identical`);
    const doc = pairedFiles[row.paired.path];
    assert.ok(doc, `${row.order}: live paired file was supplied`);
    const slide = doc.slides.find((item: any) => item.n === row.paired.slide);
    assert.ok(slide, `${row.order}: exact paired slide remains present`);
    assert.equal(slide.english.body[row.paired.bodyIndex], row.sourceEnglish, `${row.order}: paired cell source is exact and at the accepted index`);
    assert.deepEqual(slide.target.body[row.paired.bodyIndex], row.paired.appliedTarget, `${row.order}: paired cell target/status/segments match the accepted full target`);
  }
}

/** Return the immutable 28-field layer only after validating the complete newest 13-cell overlay. */
export function nativeOrdinaryBeforeResidualLayer<T>(actual: T): T {
  const current: any = actual;
  const isSeparateTsL2 = current?.language === 'ts' && current?.lessons?.length > 0 && current.lessons.every((lesson: any) => lesson.id === 'vegetables-staples-l2');
  const exportName = isSeparateTsL2 ? 'XITSONGA_VEGETABLES_STAPLES_L2_DRAFT' : exportsByIdentity[`${current?.id}:${current?.language}`];
  if (!exportName || !residualExports.has(exportName)) return actual;
  const modules = { ...runtimeByExport, [exportName]: current };
  validateNativeOrdinaryResidualLayer(modules, readResidualPairedFiles());
  return structuredClone(residualBefore[exportName]);
}

/** Validate the complete newest native overlay before a historical fixture rewinds it. */
export function nativeOrdinaryBeforeFinalBatch<T>(actual: T): T {
  const current: any = nativeOrdinaryBeforeResidualLayer(actual);
  const isSeparateTsL2 = current?.language === 'ts' && current?.lessons?.length > 0 && current.lessons.every((lesson: any) => lesson.id === 'vegetables-staples-l2');
  const exportName = isSeparateTsL2 ? 'XITSONGA_VEGETABLES_STAPLES_L2_DRAFT' : exportsByIdentity[`${current?.id}:${current?.language}`];
  assert.ok(exportName, `listed native module identity ${current?.id}/${current?.language}`);
  const baselineModule = baseline.nativeModules[exportName]?.module;
  const appliedModule = applied.modules[exportName];
  assert.ok(baselineModule && appliedModule, `${exportName}: complete baseline/applied snapshots exist`);
  const rows = fieldProof.fields.filter((row: any) => row.registryExport === exportName);
  assert.ok(rows.length > 0, `${exportName}: at least one accepted field is bound to this module`);

  // This whole-object equality rejects missing fields/array members, undefined values,
  // reordered lessons or choices, source drift, status drift, and unlisted edits.
  assert.deepEqual(current, appliedModule, `${exportName}: imported current registry equals the complete reviewed applied object`);
  for (const row of rows) {
    const expectedSource = canonicalSource(row.field.moduleId, row.field.lessonId, row.field.fieldLocator);
    assert.equal(expectedSource, row.sourceEnglish, `${row.order}: exact current canonical source`);
    assert.equal(row.nativePairSourceEnglish, row.appliedPairSourceEnglish, `${row.order}: native pair source is bound to the applied proof`);
    const bound = nativeTarget(current, row);
    assert.equal(bound.target, row.appliedTarget, `${row.order}: actual imported nonempty target equals accepted target`);
    assert.equal(typeof bound.target, 'string');
    assert.ok(bound.target.trim().length > 0, `${row.order}: applied target is present`);
    if (bound.pair) {
      assert.equal(bound.pair.sourceEnglish, row.appliedPairSourceEnglish, `${row.order}: exact native source pair`);
      assert.equal(bound.pair.reviewStatus, row.appliedPairReviewStatus, `${row.order}: visible machine-draft status`);
    }
    assert.equal(row.appliedTargetWasImported, true, `${row.order}: application proof records imported runtime value`);
  }

  // Returning this snapshot is safe only after all fields and the complete object passed.
  return structuredClone(baselineModule);
}

/** Rewind only listed final-layer presentation fields after validating their full imported registry. */
export function nativeOrdinaryPresentationBeforeFinalBatch<T extends { content: any }>(result: T, lessonId: string, language: string): T {
  const moduleId = lessonId.startsWith('reading-landscape-') ? 'reading-landscape'
    : lessonId.startsWith('vegetables-staples-') ? 'vegetables-staples' : lessonId.startsWith('market-community-') ? 'market-community' : '';
  const exportName = lessonId === 'vegetables-staples-l2' && language === 'ts' ? 'XITSONGA_VEGETABLES_STAPLES_L2_DRAFT' : exportsByIdentity[`${moduleId}:${language}`];
  if (!exportName) return result;
  const currentModule = runtimeByExport[exportName];
  const residualBeforeModule = nativeOrdinaryBeforeResidualLayer(currentModule) as any;
  const baselineModule = nativeOrdinaryBeforeFinalBatch(currentModule) as any;
  const rows = fieldProof.fields.filter((item: any) => item.registryExport === exportName && item.field.lessonId === lessonId);
  const residualRows = residualProof.fields.filter((item: any) => item.native.registryExport === exportName && item.native.lessonId === lessonId && item.native.changed);
  const reconstructed = structuredClone(result);
  for (const row of residualRows) {
    assert.equal(presentationTarget(result.content, row.native.fieldLocator), row.native.appliedTarget,
      `${row.order}: supplied learner presentation contains the exact newest-layer field before rewind`);
    const beforeValue = nativeTarget(residualBeforeModule, { field: { language: row.language, lessonId: row.native.lessonId, fieldLocator: row.native.fieldLocator } }).target;
    setPresentationTarget(reconstructed.content, row.native.fieldLocator, beforeValue);
  }
  for (const row of rows) {
    const supersededByResidual = residualRows.some((residual: any) => residual.native.fieldLocator === row.field.fieldLocator);
    if (!supersededByResidual) {
      assert.equal(presentationTarget(result.content, row.field.fieldLocator), row.appliedTarget,
        `${row.order}: supplied current learner presentation contains the exact accepted field before rewind`);
    }
    const old = nativeTarget(baselineModule, row).target;
    setPresentationTarget(reconstructed.content, row.field.fieldLocator, old);
  }
  return reconstructed;
}
