import { introFullAssetSizesBeforeOrdinary, introFullMediaBeforeEarlierProof } from './intro-full-ordinary-media-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { vegetablesDeckBeforeL1Ordinary } from './vegetables-l1-ordinary-checks.ts';
const folder = 'docs/media/vegetables-l1-ordinary-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(folder + 'frames.json');
export const expectedVegetablesL1Paths = ['/course-decks/vegetables-staples/st/slide-06.webp', '/course-decks/vegetables-staples/ve/slide-04.webp', '/course-decks/vegetables-staples/ve/slide-05.webp', '/course-decks/vegetables-staples/ve/slide-06.webp', '/course-decks/vegetables-staples/ts/slide-06.webp'];
const expectedPaths = expectedVegetablesL1Paths;


// Many older preservation proofs ask about hundreds of files individually.
// Cache only a verified digest tied to exact filesystem identity/timestamps/size;
// a changed file is read and hashed again, so repeated historical views stay bounded.
const observedFiles = new Map<string, { signature: string; bytes: number; sha256: string }>();
function observedFile(path: string) {
  const stat = statSync(path, { bigint: true });
  const signature = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
  const prior = observedFiles.get(path);
  if (prior?.signature === signature) return prior;
  const bytes = readFileSync(path);
  const result = { signature, bytes: bytes.length, sha256: sha(bytes) };
  observedFiles.set(path, result);
  return result;
}

// 6 October 2026: five accepted ordinary paragraph compositions change five
// Vegetables frames. The complete later layer must pass before any dated rewind.
export function validateCurrentVegetablesL1OrdinaryMedia(currentManifest = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  // 6 October 2026: the later 36 Intro frames are fully checked before this exact dated five-card view.
  currentManifest = introFullAssetSizesBeforeOrdinary(currentManifest);
  assert.equal(sha(proofBytes), '5204a56d2d447544e069f428fa295294fa42bc11cec99ae064509874a4f84718');
  const proof = JSON.parse(proofBytes.toString());
  assert.equal(proof.frames.length, 5);
  assert.deepEqual(proof.frames.map((frame: { path: string }) => frame.path).sort(), expectedPaths.slice().sort());
  const decks: Record<string, any> = {};
  for (const language of ['st', 've', 'ts'] as const) {
    decks[language] = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${language}.paired-draft.json`, 'utf8'));
    vegetablesDeckBeforeL1Ordinary(language, decks[language]);
    const acceptedBytes = readFileSync(folder + `paired-${language}-accepted.json`);
    assert.equal(sha(acceptedBytes), proof.pairedSnapshotHashes[language]);
    assert.deepEqual(decks[language], JSON.parse(acceptedBytes.toString()), 'full accepted paired deck and every unlisted field remain exact');
  }
  const before = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  assert.equal(sha(before), proof.manifestBeforeSHA256);
  let expectedManifest = before;
  for (const frame of proof.frames) {
    assert.deepEqual(frame.pairedSource, decks[frame.language].slides[frame.slide - 1], frame.path);
    const bytes = readFileSync('public' + frame.path);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.equal(bytes.length, frame.new.bytes, frame.path);
    assert.equal(sha(bytes), frame.new.sha256, frame.path);
    assert.notEqual(frame.new.sha256, frame.old.sha256, frame.path);
    assert.equal(frame.new.width, 1440);
    assert.ok(frame.new.height >= 5400, 'natural-height panels must not be cropped');
    // Pillow's lossy WebP carries a VP8 frame header with actual decoded dimensions.
    assert.equal(bytes.subarray(12, 16).toString(), 'VP8 ');
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, frame.new.width);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, frame.new.height);
    assert.equal(COURSE_ASSET_SIZES[frame.path], bytes.length);
    const oldEntry = `  '${frame.path}': ${frame.old.bytes},`;
    assert.equal(expectedManifest.split(oldEntry).length, 2, 'one exact old manifest slot');
    expectedManifest = expectedManifest.replace(oldEntry, `  '${frame.path}': ${frame.new.bytes},`);
  }
  const entries = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0);
  assert.equal(before.split(proof.manifestOldComment).length, 2);
  assert.equal(total, proof.manifestActualTotalBytes);
  assert.equal(entries.length, 1905);
  assert.equal(proof.manifestNewComment, `// ${entries.length} files, ${(total / 1e6).toFixed(1)} MB total.`);
  expectedManifest = expectedManifest.replace(proof.manifestOldComment, proof.manifestNewComment);
  const actualManifest = currentManifest;
  assert.equal(actualManifest, expectedManifest, 'only five Vegetables sizes and the measured aggregate comment change');
  assert.equal(sha(actualManifest), proof.manifestAfterSHA256);
  const changed = new Set(expectedPaths);
  assert.equal(sha(readFileSync(folder + 'vegetables-assets-before.json')), '867d4e0d9bcf0d90ea8f189ba166270f959fe2af557df505d1ae20bfd9794ca5');
  const oldAssets = JSON.parse(readFileSync(folder + 'vegetables-assets-before.json', 'utf8'));
  const actualPaths = readdirSync('public/course-decks/vegetables-staples', { recursive: true }).map(String)
    .filter(path => statSync('public/course-decks/vegetables-staples/' + path).isFile())
    .map(path => '/course-decks/vegetables-staples/' + path).sort();
  assert.deepEqual(actualPaths, oldAssets.map((row: { path: string }) => row.path).sort(), 'no Vegetables asset is added or removed');
  assert.equal(oldAssets.filter((row: { path: string }) => !changed.has(row.path)).length, 87);
  for (const row of oldAssets) {
    if (changed.has(row.path)) {
      assert.deepEqual(proof.frames.find((frame: { path: string }) => frame.path === row.path).old, row);
      continue;
    }
    const actual = observedFile('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path);
  }
  assert.equal(sha(readFileSync(folder + 'protected-audio-films-before.json')), 'c12c534f5f81ee51d996befe66615d4242fef545159e27b8d64ec496d47f052b');
  const protectedMedia = JSON.parse(readFileSync(folder + 'protected-audio-films-before.json', 'utf8'));
  assert.equal(protectedMedia.length, 604);
  for (const row of protectedMedia) {
    const actual = observedFile('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path);
  }
  const stIntroBytes = readFileSync(folder + 'st-intro-stills-before.json');
  assert.equal(sha(stIntroBytes), '696fbbf19ac6415a6752ea02bc38b185089284ef26f0cb9d09611a34db0a25e1');
  const stIntro = JSON.parse(stIntroBytes.toString());
  assert.equal(stIntro.length, 22);
  for (const row of stIntro) {
    const actual = observedFile('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path);
  }
  return JSON.parse(proofBytes.toString());
}


// Expose only the exact frozen complete before state after real current validation.
export function vegetablesL1AssetSizesBeforeOrdinary(currentManifest?: string) {
  validateCurrentVegetablesL1OrdinaryMedia();
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const immediate = introFullAssetSizesBeforeOrdinary();
  const before = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  if (currentManifest === undefined || currentManifest === actual || currentManifest === immediate) return before;
  assert.equal(currentManifest, before, 'only the exact guarded Vegetables L1 manifest baseline may be exposed');
  return before;
}
export function vegetablesL1MediaBeforeEarlierProof(path: string) {
  const intro = introFullMediaBeforeEarlierProof(path);
  if (intro) return intro;
  const proof = validateCurrentVegetablesL1OrdinaryMedia();
  const url = path.startsWith('public/') ? path.slice('public'.length) : path;
  const frame = proof.frames.find((row: { path: string }) => row.path === url);
  return frame ? { sha256: frame.old.sha256, bytes: frame.old.bytes } : undefined;
}
