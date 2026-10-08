import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { readingTitleLightestMain985PostLayerBefore } from './reading-title-lightest-main985-composition-history-checks.ts';

const folder = 'docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/assets/';
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
function frozen(name: string, digest: string) {
  const bytes = readFileSync(folder + name);
  assert.equal(sha(bytes), digest, `${name}: immutable rendered-media proof`);
  return JSON.parse(bytes.toString());
}
export const lightestRenderProof = frozen('render-proof.json', '4989110c3f4a17786f296a008212e725c54ca11311a97c0f94b5e98e2161d755') as {
  outputSize: [number, number];
  encoding: { format: string; quality: number; method: number };
  cards: Array<{ asset: string; beforeAsset: string; beforeBytes: number; beforeSha256: string; afterBytes: number; afterSha256: string; afterDimensions: number[] }>;
};
export const lightestManifestProof = frozen('manifest-proof.json', '020f98dde5da03597239b56242a1526d3d767147901085877f7f56c0e0292c96') as {
  beforeSnapshot: string; beforeSha256: string; beforeBytes: number; afterSha256: string; afterBytes: number;
  rows: Array<{ url: string; beforeBytes: number; afterBytes: number; beforeSha256: string; afterSha256: string }>;
};
assert.equal(lightestRenderProof.cards.length, 4);
assert.equal(lightestManifestProof.rows.length, 4);

/** Verify all current bytes and return the full exact predecessor manifest. */
export function lightestManifestBefore(current = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  const live = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const predecessor = Buffer.from(readingTitleLightestMain985PostLayerBefore('lib/course-asset-sizes.ts', live)).toString();
  assert.equal(Buffer.from(readingTitleLightestMain985PostLayerBefore('lib/course-asset-sizes.ts', current)).toString(), predecessor,
    'caller must be the complete current manifest or exact main837 predecessor');
  return predecessor;
}

export function lightestAssetRows() {
  return lightestRenderProof.cards.map(row => {
    const before = readFileSync(row.beforeAsset);
    const after = readFileSync(row.asset);
    assert.equal(before.length, row.beforeBytes, `${row.asset}: exact preserved before bytes`);
    assert.equal(sha(before), row.beforeSha256, `${row.asset}: exact preserved before hash`);
    assert.equal(after.length, row.afterBytes, `${row.asset}: exact compressed current bytes`);
    assert.equal(sha(after), row.afterSha256, `${row.asset}: exact compressed current hash`);
    assert.equal(statSync(row.asset).size, row.afterBytes);
    assert.equal(after.toString('ascii', 0, 4), 'RIFF');
    assert.equal(after.toString('ascii', 8, 12), 'WEBP');
    const width = after.readUInt16LE(26) & 0x3fff;
    const height = after.readUInt16LE(28) & 0x3fff;
    assert.deepEqual([width, height], row.afterDimensions, `${row.asset}: exact rendered dimensions`);
    return {
      url: '/' + row.asset.replace(/^public\//, ''),
      path: row.asset,
      beforeBytes: row.beforeBytes,
      beforeSha256: row.beforeSha256,
      afterBytes: row.afterBytes,
      afterSha256: row.afterSha256,
      width,
      height,
    };
  });
}

/** Return the exact saved predecessor only after validating a complete newest asset. */
export function lightestAssetBefore(path: string, supplied: Uint8Array): Uint8Array {
  const row = lightestRenderProof.cards.find(item => item.asset === path || `public${item.asset}` === path);
  if (!row) return supplied;
  const current = readFileSync(row.asset);
  const before = readFileSync(row.beforeAsset);
  assert.equal(sha(current), row.afterSha256, `${path}: complete current compressed card is exact`);
  assert.equal(current.length, row.afterBytes, `${path}: complete current compressed card bytes`);
  assert.equal(sha(before), row.beforeSha256, `${path}: frozen exact prior card is intact`);
  assert.equal(before.length, row.beforeBytes, `${path}: frozen prior card bytes`);
  if (sha(supplied) === row.beforeSha256 && supplied.length === row.beforeBytes) return supplied;
  assert.equal(sha(supplied), row.afterSha256, `${path}: historical caller must provide current exact bytes`);
  assert.equal(supplied.length, row.afterBytes, `${path}: historical caller current bytes`);
  return before;
}
