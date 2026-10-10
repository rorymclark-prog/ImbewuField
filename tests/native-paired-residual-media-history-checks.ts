import { reading14ManifestBefore } from './reading-comparisons-media-history-checks.ts';
import { ensureFinalLanguageNextCurrent } from './final-language-next-checks.ts';
import { finalLanguageNextManifestBefore, finalLanguageNextMediaBefore } from './final-language-next-media-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const root = 'docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/native-paired-residual-layer-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const renderProofBytes = readFileSync(root + 'render-proof.json');
const beforeInventoryBytes = readFileSync(root + 'media-before-assets.json');
const beforeManifestBytes = readFileSync(root + 'asset-sizes-before.ts.txt');
const incoming968Bytes = readFileSync('docs/study-translation-reviews/st-intro-silent-completion-2026-10-06/after-soilwater-media-integration-plan.json');
assert.equal(sha(renderProofBytes), 'f9ff13f9ee8366b0cf8881242e55f415842e972a8d2387b1252eac1faa4b59e1',
  'the newest 13-frame render proof remains immutable');
assert.equal(sha(beforeInventoryBytes), '90a35a07f8ebeb14dc235e303b36a938258c69b29c3277ae47d9a574333fa9ea',
  'the complete pre-render 1885-asset inventory remains immutable');
assert.equal(sha(beforeManifestBytes), '60064c611c8140cd6b20875a8f673a933b9007f523a46460933d866b493d3571',
  'the original pre-render manifest snapshot remains immutable');
assert.equal(sha(incoming968Bytes), '1ecbeab0c238b7d2236c12e179ab6d15d71885aa4ddfbb048c5a6a0c2f9835e5',
  'the incoming 968 media layer remains source-bound and immutable');
const renderProof = JSON.parse(renderProofBytes.toString());
const beforeInventory = JSON.parse(beforeInventoryBytes.toString());
const incoming968 = JSON.parse(incoming968Bytes.toString());
const beforeByPath = new Map<string, { path: string; bytes: number; sha256: string }>(
  beforeInventory.files.map((row: any) => [row.path, row]),
);
assert.equal(renderProof.frameCount, 13);
assert.equal(renderProof.assetInventory.unlistedAssetCount, 1872);
assert.equal(beforeInventory.fileCount, 1885);
export type NativePairedResidualFrame = {
  path: string;
  url: string;
  bytes: number;
  sha256: string;
  width: number;
  height: number;
};
export const nativePairedResidualFrames: NativePairedResidualFrame[] = renderProof.frames.map((frame: any) => ({
  path: frame.repositoryPath,
  url: '/' + frame.repositoryPath.replace(/^public\//, ''),
  bytes: frame.bytes,
  sha256: frame.sha256,
  width: frame.width,
  height: frame.height,
}));
const residualByPath = new Map<string, any>(renderProof.frames.map((frame: any) => [frame.repositoryPath, frame]));
const incoming968ByPath = new Map<string, any>(incoming968.actualAssets.map((frame: any) => [frame.path, frame]));
assert.equal(incoming968.actualAssets.length, 25, 'the incoming silent release contributes its exact 25 source-bound assets');

// Historical checks repeatedly ask for the same full inventory. Reuse a digest
// only while the filesystem identity is unchanged; same-size rewrites invalidate it.
const observed = new Map<string, { signature: string; bytes: number; sha256: string; width?: number; height?: number; riff?: boolean; webp?: boolean; vp8?: boolean }>();
function actualDescriptor(path: string) {
  const stat = statSync(path, { bigint: true });
  const signature = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
  const prior = observed.get(path);
  if (prior?.signature === signature) return prior;
  const bytes = readFileSync(path);
  const value = {
    signature,
    bytes: bytes.length,
    sha256: sha(bytes),
    riff: bytes.toString('ascii', 0, 4) === 'RIFF',
    webp: bytes.toString('ascii', 8, 12) === 'WEBP',
    vp8: bytes.toString('ascii', 12, 16) === 'VP8 ',
    width: bytes.length >= 30 ? bytes.readUInt16LE(26) & 0x3fff : undefined,
    height: bytes.length >= 30 ? bytes.readUInt16LE(28) & 0x3fff : undefined,
  };
  observed.set(path, value);
  return value;
}

let verifiedInventory = false;

/** Validate the current 13 frames, all 1872 unlisted prior assets, and expose the exact pre-13 manifest. */
function descriptor(path: string) {
  const actual = actualDescriptor(path);
  const later = finalLanguageNextMediaBefore(path);
  return later ? { ...actual, ...later } : actual;
}

export function nativePairedResidualManifestBefore968(currentManifest = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  // Validate the new silent-card entry before the dated residual inventory checks its predecessor.
  currentManifest = reading14ManifestBefore(currentManifest);
  const liveManifest = reading14ManifestBefore(readFileSync('lib/course-asset-sizes.ts', 'utf8'));
  assert.equal(currentManifest, liveManifest, 'the caller must supply the exact verified complete manifest');
  // Dated 13-frame proof follows full latest 36-frame/unlisted verification.
  const actualManifest = finalLanguageNextManifestBefore(currentManifest);
  assert.equal(sha(actualManifest), '8954a393387397c2601e0f6bf06223814e1383a0b500afe046d9bd6e9419145f',
    'the merged 968 manifest plus the newest 13 measured frame sizes is the complete current state');

  let before968 = actualManifest;
  const changed = new Set<string>();
  for (const frame of renderProof.frames) {
    const path = frame.repositoryPath as string;
    const previous = beforeByPath.get(path);
    assert.ok(previous, `${path}: each changed frame has an exact frozen before descriptor`);
    const actual = descriptor(path);
    assert.equal(actual.bytes, frame.bytes, `${path}: current approved frame byte count`);
    assert.equal(actual.sha256, frame.sha256, `${path}: current approved frame hash`);
    assert.equal(actual.riff, true, `${path}: WebP container`);
    assert.equal(actual.webp, true, `${path}: WebP payload`);
    assert.equal(actual.vp8, true, `${path}: reviewed lossy WebP encoding`);
    assert.equal(actual.width, frame.width, `${path}: measured width`);
    assert.equal(actual.height, frame.height, `${path}: measured natural height`);
    assert.equal(frame.width, 1440);
    assert.ok(frame.height >= 5400, `${path}: natural-height source and target panels remain intact`);
    const url = '/' + path.replace(/^public\//, '');
    const currentEntry = `  '${url}': ${frame.bytes},`;
    const beforeEntry = `  '${url}': ${previous.bytes},`;
    assert.equal(before968.split(currentEntry).length, 2, `${url}: exact current entry appears once`);
    assert.equal(before968.split(beforeEntry).length, 1, `${url}: prior entry is not already mixed in`);
    before968 = before968.replace(currentEntry, beforeEntry);
    changed.add(path);
  }
  assert.equal(changed.size, 13);

  const entries = [...before968.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, row) => sum + Number(row[1]), 0);
  assert.equal(entries.length, 1927, 'all incoming 968 manifest entries remain present');
  const currentSummary = actualManifest.match(/^\/\/ 1927 files, [\d.]+ MB total\.$/m)?.[0];
  assert.ok(currentSummary, 'the merged manifest has its generated aggregate summary');
  const beforeSummary = `// 1927 files, ${(total / 1048576).toFixed(1)} MB total.`;
  assert.equal(before968.split(currentSummary).length, 2, 'current aggregate summary occurs exactly once');
  before968 = before968.replace(currentSummary, beforeSummary);
  assert.equal(sha(before968), '230860f4fcf0fe5772d3c9ec5c8310896030b7b8323a5ad8d94cb94c95d4ec52',
    'rewinding only the 13 frames and measured summary restores the accepted full 968 manifest');

  // This inventory predates the separate silent Intro additions. It guards all
  // 1872 untouched files, while the merged silent-release guard checks its newer files.
  if (!verifiedInventory) {
    for (const row of beforeInventory.files) {
      const actual = descriptor(row.path);
      // Three earlier Intro frames are superseded by the accepted 968 release;
      // their exact replacements are bound by that release's proof below.
      const expected = changed.has(row.path)
        ? residualByPath.get(row.path)
        : incoming968ByPath.get(row.path) ?? row;
      assert.ok(expected, `${row.path}: inventory entry is accounted for`);
      assert.equal(actual.bytes, expected.bytes, `${row.path}: exact current inventory byte count`);
      assert.equal(actual.sha256, expected.sha256, `${row.path}: exact current inventory hash`);
    }
    for (const incoming of incoming968.actualAssets) {
      const actual = descriptor(incoming.path);
      assert.equal(actual.bytes, incoming.bytes, `${incoming.path}: incoming 968 replacement/addition byte count`);
      assert.equal(actual.sha256, incoming.sha256, `${incoming.path}: incoming 968 replacement/addition hash`);
    }
    assert.equal(beforeInventory.files.filter((row: any) => !changed.has(row.path) && !incoming968ByPath.has(row.path)).length, 1869,
      'only the exact 13 residual frames and three source-bound 968 replacements supersede the 1885-file baseline');
    verifiedInventory = true;
  } else {
    for (const row of beforeInventory.files) {
      const actual = descriptor(row.path);
      const expected = changed.has(row.path)
        ? residualByPath.get(row.path)
        : incoming968ByPath.get(row.path) ?? row;
      assert.ok(expected, `${row.path}: inventory entry is accounted for`);
      assert.equal(actual.bytes, expected.bytes, `${row.path}: exact current inventory byte count`);
      assert.equal(actual.sha256, expected.sha256, `${row.path}: exact current inventory hash`);
    }
    for (const incoming of incoming968.actualAssets) {
      const actual = descriptor(incoming.path);
      assert.equal(actual.bytes, incoming.bytes, `${incoming.path}: incoming 968 replacement/addition byte count`);
      assert.equal(actual.sha256, incoming.sha256, `${incoming.path}: incoming 968 replacement/addition hash`);
    }
  }
  return before968;
}

/** Return a validated current residual frame's exact before-layer descriptor when one exists. */
let descriptorManifestSignature = '';
export function nativePairedResidualMediaBefore(path: string): { bytes: number; sha256: string } | null {
  // 6 October:1900 descriptor lookups must not repeat1900-file scans. Explicit
  // manifest validation remains full; every requested real path is checked below.
  const manifestStat = statSync('lib/course-asset-sizes.ts', {bigint:true});
  const signature = [manifestStat.ino,manifestStat.size,manifestStat.mtimeNs,manifestStat.ctimeNs].join(':');
  if (signature !== descriptorManifestSignature) { nativePairedResidualManifestBefore968(); descriptorManifestSignature = signature; }
  ensureFinalLanguageNextCurrent();
  const normalized = path.startsWith('public/') ? path : path.replace(/^\//, 'public/');
  const frame = renderProof.frames.find((row: any) => row.repositoryPath === normalized);
  const expected = residualByPath.get(normalized) ?? incoming968ByPath.get(normalized) ?? beforeByPath.get(normalized);
  if (expected) { const actual=descriptor(normalized); assert.equal(actual.bytes,expected.bytes,normalized+': requested current measured bytes'); assert.equal(actual.sha256,expected.sha256,normalized+': requested current asset SHA'); }
  if (!frame) { const latest = finalLanguageNextMediaBefore(normalized); return latest ? {bytes:latest.bytes,sha256:latest.sha256} : null; }
  const before = beforeByPath.get(normalized);
  assert.ok(before, `${normalized}: prior residual descriptor is frozen`);
  return { bytes: before.bytes, sha256: before.sha256 };
}
