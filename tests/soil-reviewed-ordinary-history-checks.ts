import { marketAssetSizesBeforeOrdinary } from './market-ordinary-media-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { introAssetSizesBeforeOrdinary, introMediaBeforeEarlierProof } from './intro-ordinary-media-history-checks.ts';
import { vegetablesAssetSizesBeforePestPrecision } from './vegetables-pest-precision-media-history-checks.ts';
import { soilWaterResidualPairedBefore } from './soil-water-residual-history-checks.ts';
import { soilWaterResidualAssetSizesBefore, soilWaterResidualMediaBefore } from './soil-water-residual-history-checks.ts';

const root = 'docs/study-translation-reviews/soil-ordinary-deck-2026-10-06/';
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const proofBytes = readFileSync(root + 'applied-proof.json');
const assetProofBytes = readFileSync(root + 'asset-proof.json');
assert.equal(sha(proofBytes), '4dc2e043be4fd833db4130311ff8d318dced5b7ae9cd872646904faf49ab8c91');
assert.equal(sha(assetProofBytes), '0b483803e1204188e91617c636e4c986ea6bf98159e447f23381e2f0d3e5dd53');
const proof = JSON.parse(proofBytes.toString());
const assets = JSON.parse(assetProofBytes.toString()) as Array<{
  url: string; bytes: number; sha256: string; beforeSHA256: string; dimensions: number[];
}>;
// Frozen base manifest sizes from origin/main before this seven-field/six-frame batch.
const priorAssetBytes: Record<string, number> = {
  '/course-decks/soil-health/st/slide-18.webp': 498406,
  '/course-decks/soil-health/ve/slide-04.webp': 222670,
  '/course-decks/soil-health/ve/slide-08.webp': 565852,
  '/course-decks/soil-health/ts/slide-08.webp': 577168,
  '/course-decks/soil-health/ts/slide-13.webp': 273266,
  '/course-decks/soil-health/ts/slide-18.webp': 517038,
};
const source = englishSlideRecords(readFileSync('docs/narration/soil-health.en.md', 'utf8'));
const canonical = COURSE_MODULES.find(module => module.id === 'soil-health')!;
const natives: Record<string, any> = {
  st: SESOTHO_SOIL_HEALTH_DRAFT,
  ve: TSHIVENDA_SOIL_HEALTH_DRAFT,
  ts: XITSONGA_SOIL_HEALTH_DRAFT,
};
const nativeKeys: Record<string, string> = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };

assert.equal(proof.fieldCount, 7);
assert.deepEqual(assets.map(row => row.url).sort(), Object.keys(priorAssetBytes).sort(),
  'the later approved layer covers exactly the six documented Soil stills');

function languageProof(language: string) {
  const row = proof.languages.find((item: any) => item.language === language);
  assert.ok(row, `missing accepted Soil proof for ${language}`);
  return row;
}

function verifyCurrentDeck(deck: { slides: any[] }, language: string) {
  deck = soilWaterResidualPairedBefore(deck, `docs/narration/soil-health.${language}.paired-draft.json`);
  const row = languageProof(language);
  validatePairedDraft(deck, source, language);
  assert.deepEqual(deck, row.fullAfter,
    `${language}: actual complete accepted deck preserves all unlisted fields and source text`);
  const reconstructed = structuredClone(row.fullBefore);
  const seen = new Set<string>();
  for (const field of row.rows) {
    assert.equal(field.language, language);
    if (field.sourceExact !== undefined) assert.equal(field.sourceExact, true);
    if (field.sameCurrentTarget !== undefined) assert.equal(field.sameCurrentTarget, true);
    assert.equal((field.isFullBodyParagraphReuse === true) !== (field.mode === 'prefix-only'), true,
      `${language} slide ${field.slide}: every accepted field is exactly a full reuse or the checked prefix edit`);
    const bodyIndex = Number(field.fieldPath.match(/^body\[(\d+)\]$/)?.[1]);
    assert.ok(Number.isInteger(bodyIndex));
    assert.equal(source[field.slide - 1].body[bodyIndex], field.sourceEnglish,
      `${language} slide ${field.slide}: accepted field remains bound to canonical English`);
    const before = reconstructed.slides[field.slide - 1];
    const after = row.fullAfter.slides[field.slide - 1];
    assert.equal(before.english.body[bodyIndex], field.sourceEnglish);
    assert.equal(before.target.body[bodyIndex].text, field.currentDeckTarget);
    assert.equal(before.target.body[bodyIndex].status, 'draft');
    assert.equal(after.target.body[bodyIndex].text, field.acceptedTarget);
    assert.equal(after.target.body[bodyIndex].status, 'draft');
    assert.match(after.target.body[bodyIndex].provenance, /Unreviewed/i);
    if (field.isFullBodyParagraphReuse) {
      const parts = field.learnerUnitId.split('::');
      const paragraphIndex = Number(parts[4].match(/paragraph\[(\d+)\]/)?.[1]);
      const nativeLesson = natives[language].lessons.find((lesson: any) => lesson.id === parts[1]);
      const sourceLesson = canonical.lessons.find(lesson => lesson.id === parts[1]);
      assert.ok(nativeLesson && sourceLesson, `${language}: learner paragraph binding points to a real lesson`);
      assert.equal(sourceLesson.body.split('\n\n')[paragraphIndex], field.sourceEnglish,
        `${language} slide ${field.slide}: reused paragraph keeps exact canonical English`);
      assert.equal(nativeLesson.body.sourceEnglish, sourceLesson.body);
      assert.equal(nativeLesson.body[nativeKeys[language]].split('\n\n')[paragraphIndex], field.acceptedTarget,
        `${language} slide ${field.slide}: accepted full paragraph matches both current learner draft and deck`);
    } else if (field.mode === 'prefix-only') {
      assert.equal(field.acceptedTarget,
        'Swibyariwa swo sirhelela misava (cover crops),' + field.currentDeckTarget.slice('Cover crops,'.length),
        `${language} slide ${field.slide}: checked prefix leaves its independent target tail byte-identical`);
    }
    before.target.body[bodyIndex] = structuredClone(after.target.body[bodyIndex]);
    const key = `${field.slide}:${bodyIndex}`;
    assert.equal(seen.has(key), false);
    seen.add(key);
  }
  assert.equal(seen.size, row.rows.length);
  assert.deepEqual(reconstructed, row.fullAfter,
    `${language}: only the listed accepted target cells differ from the frozen prior deck`);
  assert.equal(row.unlistedRewindExact, true);
  assert.equal(row.englishSlideRecordsUnchanged, true);
  return structuredClone(row.fullBefore);
}

export function soilDeckBeforeOrdinary<T extends { slides: any[] }>(deck: T, language: string): T {
  return verifyCurrentDeck(deck, language) as T;
}

function checkCurrentAssetsAndManifest(currentManifest?: string) {
  for (const row of assets) {
    const bytes = readFileSync('public' + row.url);
    const residualBefore = soilWaterResidualMediaBefore('public' + row.url);
    if (residualBefore) {
      assert.equal(residualBefore.sha256, row.sha256, `${row.url}: the residual proof reconstructs this approved historical frame`);
      assert.equal(residualBefore.bytes, row.bytes, `${row.url}: the residual proof reconstructs this approved historical size`);
    } else {
      assert.equal(sha(bytes), row.sha256, `${row.url}: current image matches approved proof`);
      assert.equal(bytes.length, row.bytes, `${row.url}: current image has approved byte count`);
    }
    assert.deepEqual(row.dimensions, [1440, 5400]);
    assert.notEqual(row.sha256, row.beforeSHA256, `${row.url}: approved redraw changed the image`);
  }
  const manifest = currentManifest ?? readFileSync('lib/course-asset-sizes.ts', 'utf8');
  for (const row of assets) {
    const entry = `'${row.url}': ${row.bytes}`;
    assert.equal(manifest.split(entry).length - 1, 1,
      `${row.url}: current offline manifest promises the actual approved image size`);
  }
  return manifest;
}

export function soilAssetSizesBeforeOrdinary(currentManifest?: string) {
  // 2026-10-06: validate the complete newer Market layer before the older media history.
  soilWaterResidualAssetSizesBefore(currentManifest);
  let prior = vegetablesAssetSizesBeforePestPrecision(marketAssetSizesBeforeOrdinary());
  prior = introAssetSizesBeforeOrdinary(prior);
  prior = checkCurrentAssetsAndManifest(prior);
  for (const row of assets) {
    const current = `'${row.url}': ${row.bytes}`;
    const old = `'${row.url}': ${priorAssetBytes[row.url]}`;
    assert.equal(prior.split(current).length - 1, 1, `${row.url}: rewind only this approved current entry`);
    prior = prior.replace(current, old);
  }
  return prior;
}

export function soilMediaBeforeOrdinary(path: string) {
  const residual = soilWaterResidualMediaBefore(path);
  const row = assets.find(item => 'public' + item.url === path);
  // This call validates all six current images and their six live size entries before any old proof is exposed.
  soilAssetSizesBeforeOrdinary();
  if (residual && !row) return residual;
  if (residual && row) {
    assert.equal(residual.sha256, row.sha256, `${path}: the residual frame rewinds to the approved six-frame layer`);
    assert.equal(residual.bytes, row.bytes, `${path}: the residual frame rewinds to the approved six-frame size`);
    return { sha256: row.beforeSHA256, bytes: priorAssetBytes[row.url] };
  }
  const bytes = readFileSync(path);
  if (!row) return { sha256: sha(bytes), bytes: bytes.length };
  assert.equal(sha(bytes), row.sha256, `${path}: verify current accepted image before historical rewind`);
  assert.equal(bytes.length, row.bytes);
  return { sha256: row.beforeSHA256, bytes: priorAssetBytes[row.url] };
}

export function soilMediaSHAForEarlierProof(path: string) {
  const soil = soilMediaBeforeOrdinary(path);
  const intro = introMediaBeforeEarlierProof(path);
  return intro?.sha256 ?? soil.sha256;
}
