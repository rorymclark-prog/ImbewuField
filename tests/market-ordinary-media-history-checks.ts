import { finalLanguageNextMediaBefore } from './final-language-next-media-history-checks.ts';
import { vegetablesL3AssetSizesBeforeOrdinary, vegetablesL3MediaBeforeEarlierProof } from './vegetables-l3-ordinary-media-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { vegetablesPestPrecisionFrames } from './vegetables-pest-precision-media-history-checks.ts';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { marketDeckBeforeOrdinary, marketDeckBeforeNativeResidual, readCurrentMarketDecks } from './market-ordinary-deck-checks.ts';
import { nativePairedResidualFrames, nativePairedResidualMediaBefore } from './native-paired-residual-media-history-checks.ts';
const folder = 'docs/media/market-ordinary-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(folder + 'frames.json');
const expectedPaths = [
  ...[12, 15].map(n => `/course-decks/market-community/st/slide-${String(n).padStart(2, '0')}.webp`),
  ...[7, 8, 10, 11, 15, 17].map(n => `/course-decks/market-community/ve/slide-${String(n).padStart(2, '0')}.webp`),
  ...[7, 10, 17].map(n => `/course-decks/market-community/ts/slide-${String(n).padStart(2, '0')}.webp`),
];

export function marketFrameBeforeNativeResidual(path: string) {
  const url = path.startsWith('public/') ? path.slice(6) : path;
  const current = nativePairedResidualFrames.find((frame:any)=>frame.url===url);
  if (!current) return finalLanguageNextMediaBefore(path) ?? undefined;
  const previous = nativePairedResidualMediaBefore(url);
  assert.ok(previous, url + ': listed redraw has an exact validated predecessor');
  return {...previous, width:current.width, height:current.height};
}


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

// 6 October 2026: Market supersedes eleven real frame descriptors and fixes the
// stale total comment. Validate the complete accepted layer before old proofs run.
export function validateCurrentMarketOrdinaryMedia(currentManifest = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  // Later L3 images are independently validated before this older eleven-frame claim.
  currentManifest = vegetablesL3AssetSizesBeforeOrdinary(currentManifest);
  assert.equal(sha(proofBytes), '0efa24cb294beaa3203576fec99b497b0f6aa872d89320454369edc8421cac41');
  const proof = JSON.parse(proofBytes.toString());
  assert.equal(proof.frames.length, 11);
  assert.deepEqual(proof.frames.map((frame: { path: string }) => frame.path).sort(), expectedPaths.slice().sort());
  const currentDecks = readCurrentMarketDecks();
  marketDeckBeforeOrdinary(currentDecks);
  const decks = marketDeckBeforeNativeResidual(currentDecks);
  const before = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  assert.equal(sha(before), proof.manifestBeforeSHA256);
  let expectedManifest = before;
  for (const frame of proof.frames) {
    assert.deepEqual(frame.pairedSource, decks[frame.language].slides[frame.slide - 1], frame.path);
    const later = marketFrameBeforeNativeResidual(frame.path);
    if (later) {
      assert.deepEqual(later, {bytes:frame.new.bytes,sha256:frame.new.sha256,width:frame.new.width,height:frame.new.height},
        frame.path + ': the later redraw preserves this exact input and canvas');
      assert.ok(currentManifest.includes(`  '${frame.path}': ${frame.new.bytes},`));
    } else {
      const bytes = readFileSync('public' + frame.path);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(bytes.length, frame.new.bytes, frame.path);
      assert.equal(sha(bytes), frame.new.sha256, frame.path);
      assert.equal(bytes.subarray(12, 16).toString(), 'VP8 ');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, frame.new.width);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, frame.new.height);
      assert.equal(COURSE_ASSET_SIZES[frame.path], bytes.length);
    }
    assert.notEqual(frame.new.sha256, frame.old.sha256, frame.path);
    assert.equal(frame.new.width, 1440);
    assert.ok(frame.new.height >= 5400, 'natural-height panels must not be cropped');
    const oldEntry = `  '${frame.path}': ${frame.old.bytes},`;
    assert.equal(expectedManifest.split(oldEntry).length, 2, 'one exact old manifest slot');
    expectedManifest = expectedManifest.replace(oldEntry, `  '${frame.path}': ${frame.new.bytes},`);
  }
  const entries = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0);
  expectedManifest = expectedManifest.replace(/\/\/ \d+ files, [\d.]+ MB total\./,
    `// ${entries.length} files, ${(total / 1e6).toFixed(1)} MB total.`);
  const actualManifest = currentManifest;
  assert.equal(actualManifest, expectedManifest, 'only eleven sizes and the actual aggregate comment change');
  assert.equal(sha(actualManifest), proof.manifestAfterSHA256);
  const changed = new Set(expectedPaths);
  assert.equal(sha(readFileSync(folder + 'market-assets-before.json')), '33d160d0eb73fcf3c76fba9115efc091ff0e9f25bb05e98878f0d9a869392ef0');
  const oldAssets = JSON.parse(readFileSync(folder + 'market-assets-before.json', 'utf8'));
  const actualPaths = readdirSync('public/course-decks/market-community', { recursive: true }).map(String)
    .filter(path => statSync('public/course-decks/market-community/' + path).isFile())
    .map(path => '/course-decks/market-community/' + path).sort();
  assert.deepEqual(actualPaths, oldAssets.map((row: { path: string }) => row.path).sort(), 'no Market asset is added or removed');
  assert.equal(oldAssets.filter((row: { path: string }) => !changed.has(row.path)).length, 90);
  for (const row of oldAssets) {
    if (changed.has(row.path)) {
      assert.deepEqual(proof.frames.find((frame: { path: string }) => frame.path === row.path).old, row);
      continue;
    }
    const actual = marketFrameBeforeNativeResidual(row.path) ?? observedFile('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path);
  }
  assert.equal(sha(readFileSync(folder + 'protected-audio-films-before.json')), 'b51a853f7f1d05f13f48c2cfef20429641ecc667a5f93b3c9e9294ac02aa3bf5');
  const protectedMedia = JSON.parse(readFileSync(folder + 'protected-audio-films-before.json', 'utf8'));
  assert.equal(protectedMedia.length, 604);
  for (const row of protectedMedia) {
    const actual = observedFile('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path);
  }
  return JSON.parse(proofBytes.toString());
}

export function marketAssetSizesBeforeOrdinary(currentManifest?: string) {
  validateCurrentMarketOrdinaryMedia();
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const beforeL3 = vegetablesL3AssetSizesBeforeOrdinary();
  const prior = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  // The existing Soil history enters after the separately guarded six-frame
  // Vegetables rewind. Accept only these exact complete manifest states, never
  // a prefix exemption or an arbitrary aggregate-comment replacement.
  let priorBeforeVegetables = prior;
  for (const frame of vegetablesPestPrecisionFrames) {
    const current = `'${frame.url}': ${frame.bytes}`;
    assert.equal(priorBeforeVegetables.split(current).length - 1, 1);
    priorBeforeVegetables = priorBeforeVegetables.replace(current, `'${frame.url}': ${frame.beforeBytes}`);
  }
  if (currentManifest === undefined || currentManifest === actual || currentManifest === beforeL3) return prior;
  assert.ok(currentManifest === prior || currentManifest === priorBeforeVegetables,
    'historical composition accepts only the exact guarded Market baseline or its six known Vegetables rewinds');
  return currentManifest;
}

export function marketMediaBeforeEarlierProof(path: string) {
  const url = path.startsWith('public/') ? path.slice('public'.length) : path;
  // A later redraw of a Market URL must still pass through this older Market
  // layer; returning its immediate predecessor would skip the eleven-frame history.
  if (!url.startsWith('/course-decks/market-community/')) {
    const latest = vegetablesL3MediaBeforeEarlierProof(path);
    if (latest) return latest;
  }
  // Only the immutable eleven-frame layer or a listed later redraw can expose
  // a predecessor. All other files fall through to actual byte/hash checks.
  if (!expectedPaths.includes(url) && !nativePairedResidualFrames.some(frame => frame.url === url)) return finalLanguageNextMediaBefore(path) ?? undefined;
  const proof = validateCurrentMarketOrdinaryMedia();
  const frame = proof.frames.find((row: { path: string }) => row.path === url);
  if (frame) return {sha256:frame.old.sha256,bytes:frame.old.bytes};
  const later = marketFrameBeforeNativeResidual(url);
  return later ? {sha256:later.sha256,bytes:later.bytes} : undefined;
}
