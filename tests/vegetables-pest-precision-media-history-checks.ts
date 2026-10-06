import { vegetablesL3AssetSizesBeforeOrdinary } from './vegetables-l3-ordinary-media-history-checks.ts';
import { nativePairedResidualManifestBefore968, nativePairedResidualMediaBefore } from './native-paired-residual-media-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const vegetablesPestPrecisionFrames = [
  { url: '/course-decks/vegetables-staples/st/slide-15.webp', bytes: 573684, width: 1440, height: 5400, sha256: 'c6e362ef53e745a398e43cb2eb5bcee15d67881d4bbbcc3c00520f28304336c2', beforeBytes: 575028, beforeSHA256: '670f14dfa82d0b83cf9419078c2743e8b0e141808746c6e85d301cd19f52535f' },
  { url: '/course-decks/vegetables-staples/st/slide-16.webp', bytes: 571682, width: 1440, height: 5576, sha256: '47b7d410aca5a2f8a6959400f3213e01c0343d16192e226f0982cb0900c34f31', beforeBytes: 589838, beforeSHA256: 'c89ab72824ebd249081dc2fa3f7756f51c779bc1aa24a6d110ce69e3e1f07246' },
  { url: '/course-decks/vegetables-staples/ve/slide-15.webp', bytes: 575078, width: 1440, height: 5400, sha256: '5cf7c3592a00404a553df7f11914e511a71fd953e36e0d41582b6f50d7109c1e', beforeBytes: 573668, beforeSHA256: '9d92e2e01a824f3b310e5bf2b78e1b1eed890c9c4f7be86babf4feefc35c81a0' },
  { url: '/course-decks/vegetables-staples/ve/slide-16.webp', bytes: 568224, width: 1440, height: 5734, sha256: 'aec14eeca9001a9ff0b3cb830796d3413181b6866c89f6522dc4da7640df2b7c', beforeBytes: 584900, beforeSHA256: '2f889abfff062922f33d80c74e5af7d0c39433ee68646af17448f36ceeef5e4e' },
  { url: '/course-decks/vegetables-staples/ts/slide-15.webp', bytes: 577910, width: 1440, height: 5400, sha256: '73b347d2b33a78a6e3444a13f44ab1e91403e1cb61028cdd6bbbf17228e45ca3', beforeBytes: 575324, beforeSHA256: 'd8c573bc284aa1a4cb4229ba293914381c11b4571c65dc4d18c7d8398649a6f3' },
  { url: '/course-decks/vegetables-staples/ts/slide-16.webp', bytes: 564290, width: 1440, height: 5642, sha256: 'd8b7172f2f8fca16c3e8e5bf66f5d6d1b9dee72955aead8035c9c8933a428496', beforeBytes: 578128, beforeSHA256: '782ecf5228cd6722320b809688e466b0077b8b0c4736d043ca72df4970f3d5f0' },
] as const;

/** Validate this complete later layer before exposing any older byte or manifest claim. */
export function validateCurrentVegetablesPestPrecisionLayer(currentManifest?: string) {
  // The newest 13-frame after-layer is checked before the merged 968 inventory and older still layers.
  nativePairedResidualManifestBefore968();
  // The later ordinary layer is source/unlisted validated before this six-frame historical view.
  const latestBefore = vegetablesL3AssetSizesBeforeOrdinary();
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const manifest = currentManifest === undefined || currentManifest === actual ? latestBefore : currentManifest;
  for (const frame of vegetablesPestPrecisionFrames) {
    const newer = nativePairedResidualMediaBefore('public' + frame.url);
    if (newer) {
      assert.deepEqual(newer, { bytes: frame.bytes, sha256: frame.sha256 },
        `${frame.url}: newest rendered frame rewinds to the exact six-frame current state`);
    } else {
      const bytes = readFileSync('public' + frame.url);
      assert.equal(bytes.length, frame.bytes, `${frame.url}: current frame byte count`);
      assert.equal(sha(bytes), frame.sha256, `${frame.url}: current frame matches compressed review proof`);
    }
    const entry = `'${frame.url}': ${frame.bytes}`;
    assert.equal(manifest.split(entry).length - 1, 1, `${frame.url}: current manifest entry matches actual bytes`);
    assert.notEqual(frame.sha256, frame.beforeSHA256, `${frame.url}: approved redraw changed the frame`);
  }
  return manifest;
}

export function vegetablesPestPrecisionMediaBeforeEarlierProof(path: string) {
  const normalized = path.startsWith('public/') ? path : path.replace(/^\//, 'public/');
  const frame = vegetablesPestPrecisionFrames.find(row => 'public' + row.url === normalized);
  if (!frame) return undefined;
  // Validate the complete layer before any listed historical bytes are returned.
  validateCurrentVegetablesPestPrecisionLayer();
  const later = nativePairedResidualMediaBefore(normalized);
  if (later) {
    assert.deepEqual(later, { bytes: frame.bytes, sha256: frame.sha256 },
      `${frame.url}: the newer approved image projects exactly to this six-frame layer`);
  }
  return { bytes: readFileSync(path.startsWith('public/') ? path : normalized), byteLength: frame.beforeBytes, sha256: frame.beforeSHA256 };
}

export function vegetablesAssetSizesBeforePestPrecision(currentManifest?: string) {
  let prior = validateCurrentVegetablesPestPrecisionLayer(currentManifest);
  for (const frame of vegetablesPestPrecisionFrames) {
    const current = `'${frame.url}': ${frame.bytes}`;
    const previous = `'${frame.url}': ${frame.beforeBytes}`;
    assert.equal(prior.split(current).length - 1, 1, `${frame.url}: rewind exactly one accepted current size`);
    assert.equal(prior.split(previous).length - 1, 0, `${frame.url}: historical entry is not already mixed in`);
    prior = prior.replace(current, previous);
  }
  return prior;
}
