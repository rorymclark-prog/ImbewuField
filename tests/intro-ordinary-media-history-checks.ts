import { introFullMediaBeforeEarlierProof } from './intro-full-ordinary-media-history-checks.ts';
import { validateAndRewindIntroFullPaired } from './intro-full-ordinary-paired-checks.ts';
import { marketAssetSizesBeforeOrdinary, marketMediaBeforeEarlierProof } from './market-ordinary-media-history-checks.ts';
import { vegetablesAssetSizesBeforePestPrecision } from './vegetables-pest-precision-media-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

const proofPath = 'docs/media/intro-ordinary-paired-2026-10-06/frames.json';
const baselinePath = 'docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/asset-manifest-before.json';
const priorAssetsPath = 'docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/intro-assets-before.json';
const acceptedPacketPath = 'docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/root-accepted-final-packet.json';
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

const proofBytes = readFileSync(proofPath);
assert.equal(sha(proofBytes), '27ada886605e17d8b32190417a54fce6aa108a171b0aa58bfc789481f646c28b',
  'bind the exact accepted Intro frame proof before exposing any earlier media claims');
const proof = JSON.parse(proofBytes.toString());
const baselineBytes = readFileSync(baselinePath);
const baseline = JSON.parse(baselineBytes.toString()) as Record<string, number>;
const priorAssetsBytes = readFileSync(priorAssetsPath);
assert.equal(sha(priorAssetsBytes), '7c43e0d55641518535eb70e96a88721437fbfe09c0d717a481c497522ee858fd',
  'bind the exact Intro media inventory used for preservation checks');
const priorAssets = JSON.parse(priorAssetsBytes.toString()) as Array<{ path: string; sha256: string; bytes: number }>;
const packetBytes = readFileSync(acceptedPacketPath);
assert.equal(sha(packetBytes), '3297c1b24dba1a37de6976a0b66933a9796efffdb2be5bd8be7e9b027b8ee8e9',
  'bind the accepted Intro target packet that accompanies these frames');
const packet = JSON.parse(packetBytes.toString());
const changedIds = new Set<string>(packet.actualRecommendationDelta.changedRowIds);
const changedRows = packet.verdicts.filter((row: { id: string }) => changedIds.has(row.id));
const expectedAssets = new Set<string>(changedRows.map((row: { language: string; slide: number }) =>
  `public/course-decks/intro-permaculture/${row.language}/slide-${String(row.slide).padStart(2, '0')}.webp`));
const frames = proof.frames as Array<{
  language: string; slide: number; asset: string;
  old: { sha256: string; bytes: number };
  new: { sha256: string; bytes: number; width: number; height: number };
  sourceAndAcceptedTargets: unknown;
}>;
assert.equal(proof.frameCount, 30);
assert.equal(frames.length, 30);
assert.equal(expectedAssets.size, 30);
assert.deepEqual(new Set(frames.map(row => row.asset)), expectedAssets,
  'the later overlay is exactly the 30 accepted VE/TS Intro URLs');

const english = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
let decks: Record<string, any> = {};
for (const language of ['st', 've', 'ts']) {
  const deck = JSON.parse(readFileSync(`docs/narration/intro-permaculture.${language}.paired-draft.json`, 'utf8'));
  validatePairedDraft(deck, english, language);
  decks[language] = deck;
}

// The current72 pairs must pass before the previous54-target picture proof is reconstructed.
decks = validateAndRewindIntroFullPaired(decks);

let checked = false;
function validateCurrentIntroLayer(currentManifest: string) {
  for (const frame of frames) {
    const url = '/' + frame.asset.replace(/^public\//, '');
    const currentEntry = `'${url}': ${frame.new.bytes}`;
    assert.equal(currentManifest.split(currentEntry).length - 1, 1,
      `${url}: live offline manifest records the current accepted frame size`);
  }
  if (checked) return;
  for (const frame of frames) {
    assert.ok(frame.language === 've' || frame.language === 'ts');
    const liveBytes = readFileSync(frame.asset);
    const later = introFullMediaBeforeEarlierProof(frame.asset);
    // Old dimensions use actual base encoded headers frozen with full old SHA/size provenance.
    const bytes = later?.encodedHeaderHex ? Buffer.from(later.encodedHeaderHex, 'hex') : liveBytes;
    assert.equal(later?.bytes ?? bytes.length, frame.new.bytes, `${frame.asset}: current approved frame byte count`);
    assert.equal(later?.sha256 ?? sha(bytes), frame.new.sha256, `${frame.asset}: current approved frame SHA`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${frame.asset}: WebP container`);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${frame.asset}: WebP payload`);
    assert.deepEqual([frame.new.width, frame.new.height], [1440, 5400]);
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      assert.equal(bytes.readUIntLE(24, 3) + 1, 1440);
      assert.equal(bytes.readUIntLE(27, 3) + 1, 5400);
    } else {
      assert.equal(chunk, 'VP8 ', `${frame.asset}: expected standard RGB WebP frame`);
      assert.equal(bytes.subarray(23, 26).toString('hex'), '9d012a');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, 1440);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, 5400);
    }
    assert.notEqual(frame.new.sha256, frame.old.sha256, `${frame.asset}: accepted frame changed pixels`);
    const oldSize = baseline['/' + frame.asset.replace(/^public\//, '')];
    assert.equal(frame.old.bytes, oldSize, `${frame.asset}: frozen prior frame size matches the baseline manifest`);
    const slide = decks[frame.language].slides.find((row: { n: number }) => row.n === frame.slide);
    assert.ok(slide, `${frame.language} slide ${frame.slide}: paired deck slide exists`);
    assert.deepEqual(frame.sourceAndAcceptedTargets, slide,
      `${frame.language} slide ${frame.slide}: proof binds the live English source and accepted target`);
  }

  const changed = expectedAssets;
  for (const asset of priorAssets.filter(row => !changed.has(row.path))) {
    const bytes = readFileSync(asset.path);
    const later = introFullMediaBeforeEarlierProof(asset.path);
    assert.equal(later?.bytes ?? bytes.length, asset.bytes, `${asset.path}: unlisted media byte count remains exact`);
    assert.equal(later?.sha256 ?? sha(bytes), asset.sha256, `${asset.path}: unlisted media bytes remain exact`);
  }
  checked = true;
}

const priorManifestSHA256 = '32a1fc061145a81b2e7b981f273a7fe226c487ca3b40e3d801dfcb13e6519c5b';
const currentTotalComment = '// 1905 files, 709.4 MB total.';
const priorTotalComment = '// 1905 files, 708.5 MB total.';

/** Validate all 30 current Intro frames, deck bindings and unlisted media before rewinding its exact later overlay. */
export function introAssetSizesBeforeOrdinary(currentManifest?: string) {
  // 2026-10-06: always validate the full accepted Market after-layer first, even
  // when the caller already supplied its exact baseline through the history chain.
  const marketPrior = marketAssetSizesBeforeOrdinary(currentManifest);
  const current = currentManifest === undefined ? vegetablesAssetSizesBeforePestPrecision(marketPrior) : marketPrior;
  validateCurrentIntroLayer(current);
  assert.equal(current.split(currentTotalComment).length - 1, 1,
    'the later Intro overlay updates only the known aggregate-size comment');
  let prior = current;
  for (const frame of frames) {
    const url = '/' + frame.asset.replace(/^public\//, '');
    const latest = `'${url}': ${frame.new.bytes}`;
    const previous = `'${url}': ${frame.old.bytes}`;
    assert.equal(prior.split(latest).length - 1, 1, `${url}: replace exactly the current Intro size entry`);
    assert.equal(prior.split(previous).length - 1, 0, `${url}: historical entry is not already present`);
    prior = prior.replace(latest, previous);
  }
  prior = prior.replace(currentTotalComment, priorTotalComment);
  assert.equal(sha(prior), priorManifestSHA256,
    'rewinding only the 30 Intro entries and their aggregate comment restores the exact pre-Intro manifest');
  return prior;
}

/** Return an earlier proof's frame descriptor only for an Intro URL superseded by this accepted overlay. */
let guardedHistoricalManifestInitialized = false;
export function introMediaBeforeEarlierProof(path: string) {
  // 6 October 2026: validate the entire real later media/manifest chain once
  // before exposing dated descriptors. Calling that same upstream normalization
  // for every protected asset multiplied the older Soil/Water proof work.
  // Explicit passed-manifest controls remain in introAssetSizesBeforeOrdinary.
  if (!guardedHistoricalManifestInitialized) {
    introAssetSizesBeforeOrdinary();
    guardedHistoricalManifestInitialized = true;
  }
  const normalized = path.startsWith('public/') ? path : path.replace(/^\//, 'public/');
  const frame = frames.find(row => row.asset === normalized);
  if (!frame) return marketMediaBeforeEarlierProof(path);
  return { sha256: frame.old.sha256, bytes: frame.old.bytes };
}
