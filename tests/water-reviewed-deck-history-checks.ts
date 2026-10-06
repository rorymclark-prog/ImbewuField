import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { soilAssetSizesBeforeOrdinary, soilMediaSHAForEarlierProof } from './soil-reviewed-ordinary-history-checks.ts';
import { introMediaBeforeEarlierProof } from './intro-ordinary-media-history-checks.ts';
import { vegetablesPestPrecisionMediaBeforeEarlierProof } from './vegetables-pest-precision-media-history-checks.ts';
import { soilWaterResidualMediaBefore, soilWaterResidualPairedBefore } from './soil-water-residual-history-checks.ts';
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/WATER-DECK-REVIEWED-PRECISION-2026-10-05.json', import.meta.url), 'utf8'));
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
// 2026-10-06: root accepted 35 ST/VE and then 19 TS exact-paragraph reuses after PR957.
// Validate the entire live deck against the saved baseline plus accepted targets,
// including every source, status, provenance and unlisted field, before rewinding.
export function waterDeckBeforeOrdinary<T extends { slides: any[] }>(deck: T, language: string): T {
  assert.ok(language === 'st' || language === 've' || language === 'ts');
  deck = soilWaterResidualPairedBefore(deck, `docs/narration/water-harvesting.${language}.paired-draft.json`);
  const dir = 'docs/study-translation-reviews/water-ordinary-deck-2026-10-06/';
  const prior = JSON.parse(readFileSync(dir + language + '-paired-before.json', 'utf8'));
  const expected = structuredClone(prior);
  const planBytes = readFileSync(dir + (language === 'ts' ? 'ts-root-reviewed-exact-reuse-plan.json' : 'root-reviewed-exact-reuse-plan.json'));
  assert.equal(sha(planBytes), language === 'ts'
    ? 'af7c4da61d7d7e2a38b55ca33bfac568373da2e4400c2953382aceb7636b6962'
    : 'd90453e8657c2304ee4d3c26b5f8cedbbe953ebec3850952a3cad0b7073e6665',
    'bind the independently reviewed plan before reconstructing its accepted layer');
  const reuse = JSON.parse(planBytes.toString());
  assert.equal(reuse.rows.length, language === 'ts' ? 19 : 35);
  for (const row of reuse.rows.filter((row: any) => row.language === language)) {
    const index = Number(row.deckFieldPath.match(/\d+/)[0]);
    const slide = expected.slides[row.slide - 1];
    assert.equal(slide.english.body[index], row.sourceEnglish);
    assert.equal(slide.target.body[index].text, row.currentDeckTarget);
    slide.target.body[index] = {
      status: 'draft', text: row.proposedTarget,
      provenance: 'Complete reviewed learner paragraph reused for byte-exact English source (Water ordinary completion, 6 October 2026). Unreviewed machine draft; difficult technical English retained. No fluent, local farming or Shangani approval.',
    };
  }
  assert.deepEqual(deck, expected, 'all current accepted ST/VE35 and TS19 target/status/provenance and unlisted fields precede rewind');
  return structuredClone(prior);
}

// These tests describe the earlier independently drafted decks. Current cells
// must match the reviewed application before any dated snapshot is reconstructed.
export function waterDeckBeforeReviewedPrecision<T extends { slides: any[] }>(deck: T, language: string): T {
  const prior = waterDeckBeforeOrdinary(deck, language);
  for (const row of proof.targetFieldChanges.filter((r: any) => r.language === language)) {
    const slide = prior.slides[row.slide - 1];
    assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
    assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget);
    slide.target.body[row.bodyIndex] = row.previousTarget;
  }
  assert.equal(sha(JSON.stringify(prior.slides)), proof.pairedInputs.find((r: any) => r.language === language).slidesSha256);
  return prior;
}
// 2026-10-06: 27 approved ordinary frames replace PR957 bytes. The archived
// proof has hashes/counts, not old binaries: validate actual new bytes and full
// source/target bindings before exposing their bound prior hash/count metadata.
const ordinaryMediaBytes = readFileSync('docs/media/water-ordinary-completion-2026-10-06/frames.json');
const ordinaryMedia = JSON.parse(ordinaryMediaBytes.toString());
let checkedOrdinaryMedia = false;
function checkOrdinaryMedia() {
  if (checkedOrdinaryMedia) return;
  assert.equal(sha(ordinaryMediaBytes), 'd62255edf55283e614650a64005e4657b75dc32a3434d6f255a67449a0881ffe');
  assert.equal(ordinaryMedia.frameCount, 27);
  assert.equal(ordinaryMedia.frames.length, 27);
  assert.equal(new Set(ordinaryMedia.frames.map((row: any) => row.asset)).size, 27);
  const counts = Object.fromEntries(['st', 've', 'ts'].map(language =>
    [language, ordinaryMedia.frames.filter((row: any) => row.language === language).length]));
  assert.deepEqual(counts, { st: 8, ve: 9, ts: 10 });
  for (const row of ordinaryMedia.frames) {
    const bytes = readFileSync(row.asset);
    const residualBefore = soilWaterResidualMediaBefore(row.asset);
    if (residualBefore) {
      assert.equal(residualBefore.sha256, row.new.sha256, row.asset + ': the residual layer must reconstruct this accepted Water frame');
      assert.equal(residualBefore.bytes, row.new.bytes, row.asset + ': the residual layer must reconstruct this accepted Water size');
    } else {
      assert.equal(sha(bytes), row.new.sha256, row.asset + ': current image must match accepted final render');
      assert.equal(bytes.length, row.new.bytes);
    }
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.notEqual(row.new.sha256, row.old.sha256);
    const currentDeck = JSON.parse(readFileSync(`docs/narration/water-harvesting.${row.language}.paired-draft.json`, 'utf8'));
    const beforeResidual = soilWaterResidualPairedBefore(currentDeck, `docs/narration/water-harvesting.${row.language}.paired-draft.json`);
    waterDeckBeforeOrdinary(currentDeck, row.language);
    const slide = beforeResidual.slides[row.slide - 1];
    assert.deepEqual(row.sourceDraftBinding.sourceEnglish, slide.english);
    assert.deepEqual(row.sourceDraftBinding.currentDraftTarget, slide.target);
    assert.equal(row.sourceDraftBinding.language, row.language);
    assert.equal(row.sourceDraftBinding.slide, row.slide);
  }
  const sizes = readFileSync(ordinaryMedia.integrity.manifestPath, 'utf8');
  const beforeSoil = soilAssetSizesBeforeOrdinary(sizes);
  assert.equal(sha(beforeSoil), ordinaryMedia.integrity.manifestAfterSHA256,
    'after validating the later Soil batch, rewinding only its six entries restores the reviewed Water manifest');
  assert.equal(sha(rewindOrdinaryManifest(beforeSoil)), ordinaryMedia.integrity.manifestBeforeSHA256,
    'rewinding only 27 actual manifest entries preserves every unlisted byte');
  checkedOrdinaryMedia = true;
}
function rewindOrdinaryManifest(current: string) {
  let prior = current;
  for (const row of ordinaryMedia.frames) {
    const url = '/' + row.asset.replace(/^public\//, '');
    const entry = `'${url}': ${row.new.bytes}`;
    assert.equal(prior.split(entry).length - 1, 1);
    prior = prior.replace(entry, `'${url}': ${row.old.bytes}`);
  }
  return prior;
}
export function waterMediaBeforeOrdinary(path: string) {
  checkOrdinaryMedia();
  const bytes = readFileSync(path);
  const changed = ordinaryMedia.frames.find((row: any) => row.asset === path);
  if (!changed) {
    const residualBefore = soilWaterResidualMediaBefore(path);
    if (residualBefore) return { bytes, sha256: residualBefore.sha256, byteLength: residualBefore.bytes };
    const intro = introMediaBeforeEarlierProof(path);
    if (intro) return { bytes, sha256: intro.sha256, byteLength: intro.bytes };
    const vegetables = vegetablesPestPrecisionMediaBeforeEarlierProof(path);
    if (vegetables) return vegetables;
    return { bytes, sha256: sha(bytes), byteLength: bytes.length };
  }
  const residualBefore = soilWaterResidualMediaBefore(path);
  if (residualBefore) {
    assert.equal(residualBefore.sha256, changed.new.sha256, `${path}: current residual frame rewinds to the accepted Water frame`);
    assert.equal(residualBefore.bytes, changed.new.bytes, `${path}: current residual frame rewinds to the accepted Water size`);
  } else {
    assert.equal(sha(bytes), changed.new.sha256);
    assert.equal(bytes.length, changed.new.bytes);
  }
  return { bytes, sha256: changed.old.sha256, byteLength: changed.old.bytes };
}
export function waterAssetSizesBeforeOrdinary(path: string) {
  checkOrdinaryMedia();
  assert.equal(path, ordinaryMedia.integrity.manifestPath);
  const beforeSoil = soilAssetSizesBeforeOrdinary(readFileSync(path, 'utf8'));
  return rewindOrdinaryManifest(beforeSoil);
}
const media = JSON.parse(readFileSync(new URL('../docs/media/water-reviewed-precision-2026-10-05/frames.json', import.meta.url), 'utf8'));
export function mediaSHAForEarlierSoilProof(path: string) {
  const beforeSoil = soilMediaSHAForEarlierProof(path);
  const soilRow = assetsForSoil().find((row: any) => 'public' + row.url === path);
  if (soilRow) return beforeSoil;
  const changed = media.changed.find((r: any) => r.path === path);
  const current = waterMediaBeforeOrdinary(path).sha256;
  if (!changed) return current;
  assert.equal(current, changed.sha256, 'new Water image must match its applied proof before reconstructing the earlier Soil media snapshot');
  return changed.baselineSha256;
}

function assetsForSoil() {
  return JSON.parse(readFileSync('docs/study-translation-reviews/soil-ordinary-deck-2026-10-06/asset-proof.json', 'utf8'));
}
