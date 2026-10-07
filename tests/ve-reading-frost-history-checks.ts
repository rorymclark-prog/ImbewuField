import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const folder = 'docs/study-translation-reviews/ve-reading-frost-placement-2026-10-07/';
const proofBytes = readFileSync(folder + 'exact-file-proof.json');
const proofSha256 = '5ae3d33e79b152a91ce7a15a62d18558dd61c4aab8e34f56f56758d451a7411e';
assert.equal(createHash('sha256').update(proofBytes).digest('hex'), proofSha256);
export const frostFiles = JSON.parse(proofBytes.toString()) as Record<string, { before: string; after: string; beforeSha256: string; afterSha256: string }>;
const nativeBytes = readFileSync(folder + 'native-registry-proof.json');
const nativeSha256 = '2f0098843326d0d39f0c574355f9f6f7798351c2e7fcca5b3da1f97d8d5fecb6';
assert.equal(createHash('sha256').update(nativeBytes).digest('hex'), nativeSha256);
export const frostNative = JSON.parse(nativeBytes.toString()) as { file: string; before: unknown; after: unknown };
const assetBytes = readFileSync(folder + 'all-asset-sha-proof.json');
const assetSha256 = '40b4cccd52ffcc3ace79a0c600c94442f5862f11331c7094c75753d1e3edc202';
assert.equal(createHash('sha256').update(assetBytes).digest('hex'), assetSha256);
export const frostAssets = JSON.parse(assetBytes.toString()).assets as Record<string, { beforeSha256: string; afterSha256: string; beforeBytes: number; afterBytes: number; changed: boolean }>;
for (const [url, proof] of Object.entries(frostAssets)) if (!proof.changed) {
  assert.equal(proof.beforeBytes, proof.afterBytes, `${url}: unlisted still size is unchanged in proof`);
  assert.equal(proof.beforeSha256, proof.afterSha256, `${url}: unlisted still digest is unchanged in proof`);
}

export function ensureVeReadingFrostCurrent() {
  for (const [file, proof] of Object.entries(frostFiles)) {
    const actual = readFileSync(file);
    assert.equal(createHash('sha256').update(actual).digest('hex'), proof.afterSha256, `${file}: complete current file after VE frost placement`);
  }
}

export function veReadingFrostSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  const proof = frostFiles[file];
  if (!proof) return bytes;
  ensureVeReadingFrostCurrent();
  const text = Buffer.from(bytes).toString();
  if (text === proof.before) return bytes;
  assert.equal(text, proof.after, `${file}: only the accepted VE Reading frost placement batch may be projected`);
  return proof.before;
}

export function veReadingFrostPairBefore<T>(file: string, actual: T): T {
  const paired = 'docs/narration/reading-landscape.ve.paired-draft.json';
  if (file !== paired) return actual;
  ensureVeReadingFrostCurrent();
  const proof = frostFiles[file];
  if (typeof actual === 'string') {
    if (actual === proof.before) return actual;
    assert.equal(actual, proof.after, 'complete current Tshivenda Reading paired bytes before historical reconstruction');
    return proof.before as T;
  }
  const before = JSON.parse(proof.before);
  if (JSON.stringify(actual) === JSON.stringify(before)) return actual;
  assert.deepEqual(actual, JSON.parse(proof.after), 'complete current Tshivenda Reading paired object before historical reconstruction');
  return before as T;
}

export function veReadingFrostNativeBefore<T>(language: string, actual: T): T {
  if (language !== 've') return actual;
  ensureVeReadingFrostCurrent();
  if (JSON.stringify(actual) === JSON.stringify(frostNative.before)) return structuredClone(actual);
  assert.deepEqual(actual, frostNative.after, 'complete Tshivenda Reading registry before historical reconstruction');
  return structuredClone(frostNative.before) as T;
}

/** Verify the current still's measured bytes and digest before older inventory layers rewind it. */
export function veReadingFrostAssetBefore(path: string, bytes?: Uint8Array) {
  const url = path.startsWith('public/') ? path.slice('public'.length) : path;
  const proof = frostAssets[url];
  if (!proof) return null;
  bytes ??= readFileSync('public' + url);
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(bytes.byteLength, proof.afterBytes, `${url}: exact current VE frost still bytes`);
  assert.equal(digest, proof.afterSha256, `${url}: complete current VE frost still SHA`);
  return { bytes: proof.beforeBytes, sha256: proof.beforeSha256 };
}
