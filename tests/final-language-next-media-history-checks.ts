import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { finalLanguageNextDeckBefore, ensureFinalLanguageNextCurrent } from './final-language-next-checks.ts';
import { coreHeldOrdinaryAssets, coreHeldOrdinaryAssetBefore, coreHeldOrdinaryManifestBefore, coreHeldOrdinaryPairBefore } from './core-held-ordinary-history-checks.ts';
const laterPaths = new Set<string>(coreHeldOrdinaryAssets.map(row=>'public'+row.url));
const laterFrames = new Map(coreHeldOrdinaryAssets.map(row=>['public'+row.url,row]));
const folder = 'docs/media/final-language-next-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const bytes = readFileSync(folder + 'frames.json');
assert.equal(sha(bytes), 'be9b0fecb472b21276bd3d90a0363e32c8c5a2eb18abe919c69bc21e54efd310', 'actual 36-frame old/new/source proof is immutable');
export const finalLanguageNextMediaProof = JSON.parse(bytes.toString());
const proof = finalLanguageNextMediaProof;
const beforeInventoryBytes = readFileSync(folder + 'media-before.json');
assert.equal(sha(beforeInventoryBytes), proof.mediaBeforeSHA256);
const beforeInventory: any[] = JSON.parse(beforeInventoryBytes.toString());
const changed = new Map<string, any>(proof.frames.map((frame: any) => [frame.path, frame]));
const beforeManifest = readFileSync(folder + 'manifest-before.ts.txt', 'utf8');
assert.equal(sha(beforeManifest), proof.manifestBeforeSHA256);
let expectedManifest = beforeManifest;
for (const frame of proof.frames) {
  const old = beforeInventory.find(row => row.path === frame.path);
  assert.deepEqual({ bytes: old.bytes, sha256: old.sha256 }, { bytes: frame.old.bytes, sha256: frame.old.sha256 });
  const entry = `  '${frame.url}': ${frame.old.bytes},`;
  assert.equal(expectedManifest.split(entry).length, 2);
  expectedManifest = expectedManifest.replace(entry, `  '${frame.url}': ${frame.new.bytes},`);
}
assert.equal(expectedManifest.split(proof.manifestOldComment).length, 2);
expectedManifest = expectedManifest.replace(proof.manifestOldComment, proof.manifestNewComment);
assert.equal(sha(expectedManifest), proof.manifestAfterSHA256);
assert.equal(changed.size, 36);
assert.equal(beforeInventory.length - changed.size, proof.unlistedMediaPreserved);
const observations = new Map<string, { signature: string; bytes: number; sha256: string; width: number; height: number; riff: boolean; webp: boolean }>();
function descriptor(path: string) {
  const s = statSync(path, { bigint: true });
  const signature = [s.ino, s.dev, s.size, s.mtimeNs, s.ctimeNs].join(':');
  const old = observations.get(path); if (old?.signature === signature) return old;
  const b = readFileSync(path);
  const row = { signature, bytes: b.length, sha256: sha(b), width: b.length >= 30 ? b.readUInt16LE(26) & 0x3fff : 0, height: b.length >= 30 ? b.readUInt16LE(28) & 0x3fff : 0, riff: b.toString('ascii', 0, 4) === 'RIFF', webp: b.toString('ascii', 8, 12) === 'WEBP' };
  observations.set(path, row); return row;
}
function checkedHistoricalDescriptor(path: string) {
  const actual = descriptor(path);
  const later = laterFrames.get(path);
  if (!later) return actual;
  assert.equal(actual.bytes,later.afterBytes,path+': exact current measured bytes');
  assert.equal(actual.sha256,later.afterSHA256,path+': exact current SHA');
  return {...actual,bytes:later.beforeBytes,sha256:later.beforeSHA256,width:later.beforeDimensions[0],height:later.beforeDimensions[1]};
}
export function verifyFinalLanguageNextAsset(path: string, bytes: Uint8Array) {
  const frame = changed.get(path); const before = beforeInventory.find(row => row.path === path);
  assert.ok(frame || before, 'asset belongs to the complete frozen media inventory');
  const expected = frame?.new ?? before;
  const latest = coreHeldOrdinaryAssetBefore(path, bytes);
  assert.equal(latest?.bytes ?? bytes.length, expected.bytes, path + ': exact current measured bytes');
  assert.equal(latest?.sha256 ?? sha(bytes), expected.sha256, path + ': exact current SHA');
}
export function validateFinalLanguageNextMedia(manifest = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  manifest = coreHeldOrdinaryManifestBefore(manifest);
  assert.equal(manifest, expectedManifest, 'complete current final-language manifest/header and all unlisted entries');
  ensureFinalLanguageNextCurrent();
  for (const before of beforeInventory) {
    const expected = changed.get(before.path)?.new ?? before;
    const actual = checkedHistoricalDescriptor(before.path);
    assert.equal(actual.bytes, expected.bytes, before.path + ': all current inventory bytes');
    assert.equal(actual.sha256, expected.sha256, before.path + ': all current inventory hashes');
  }
  for (const frame of proof.frames) {
    const actual = descriptor(frame.path);
    assert.equal(actual.riff, true); assert.equal(actual.webp, true);
    assert.deepEqual([actual.width, actual.height], [frame.new.width, frame.new.height]);
    assert.equal(actual.width, 1440); assert.ok(actual.height >= 5400);
    const paired = coreHeldOrdinaryPairBefore(frame.pairFile, JSON.parse(readFileSync(frame.pairFile, 'utf8')));
    assert.deepEqual(paired.slides.find((slide: any) => slide.n === frame.slide), frame.pairedSlide);
    finalLanguageNextDeckBefore(frame.pairFile, JSON.parse(readFileSync(frame.pairFile, 'utf8')));
  }
}
let initialized = false;
function ensureInitial() { if (!initialized) { validateFinalLanguageNextMedia(); initialized = true; } }
/** Full explicit validation notices disk corruption after initialization; per-path
 * historical descriptors verify their real current bytes without recursively
 * rescanning the entire 700MB inventory for every older assertion. */
export function finalLanguageNextMediaBefore(path: string): { bytes: number; sha256: string; width?: number; height?: number } | null {
  ensureInitial();
  const normalized = path.startsWith('public/') ? path : 'public' + path;
  const frame = changed.get(normalized);
  const expected = frame?.new ?? beforeInventory.find(row => row.path === normalized);
  if (expected) {
    const actual = checkedHistoricalDescriptor(normalized);
    assert.equal(actual.bytes, expected.bytes, normalized + ': requested current measured bytes'); assert.equal(actual.sha256, expected.sha256, normalized + ': exact current SHA');
  }
  // Some of the later 69 cards were unlisted by this 36-card layer. Their
  // checked predecessor still has to reach older complete inventory guards.
  if(frame) return {...frame.old};
  if(laterPaths.has(normalized)) {const actual=checkedHistoricalDescriptor(normalized);return {bytes:actual.bytes,sha256:actual.sha256,width:actual.width,height:actual.height};}
  return null;
}
export function finalLanguageNextManifestBefore(current = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  validateFinalLanguageNextMedia(current);
  return beforeManifest;
}
