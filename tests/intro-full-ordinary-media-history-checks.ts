import { nativePairedResidualMediaBefore } from './native-paired-residual-media-history-checks.ts';
import { validateAndRewindIntroSilentTextLayer } from './intro-silent-release-text-checks.ts';
import { isSilentIntroLaterReplacedAsset, silentIntroMediaBefore } from './intro-silent-media-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateAndRewindIntroFullPaired, readCurrentIntroFullDecks } from './intro-full-ordinary-paired-checks.ts';
import { soilWaterResidualAssetSizesBefore, soilWaterResidualValidateCurrentFrames } from './soil-water-residual-history-checks.ts';
import { studyVegetablesTwoResidualAssetBefore } from './study-vegetables-two-ordinary-residual-history-checks.ts';
const folder = 'docs/media/intro-full-ordinary-completion-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(folder + 'frames.json');
assert.equal(sha(proofBytes), 'ab1079681559b79534e22c9d6e64e08ba11f385f1471758bbe9fabc40c9e7967');
export const introFullMediaProof = JSON.parse(proofBytes.toString());
export const expectedIntroFullPaths: string[] = ["/course-decks/intro-permaculture/ve/slide-01.webp", "/course-decks/intro-permaculture/ve/slide-03.webp", "/course-decks/intro-permaculture/ve/slide-04.webp", "/course-decks/intro-permaculture/ve/slide-06.webp", "/course-decks/intro-permaculture/ve/slide-07.webp", "/course-decks/intro-permaculture/ve/slide-08.webp", "/course-decks/intro-permaculture/ve/slide-10.webp", "/course-decks/intro-permaculture/ve/slide-11.webp", "/course-decks/intro-permaculture/ve/slide-12.webp", "/course-decks/intro-permaculture/ve/slide-13.webp", "/course-decks/intro-permaculture/ve/slide-14.webp", "/course-decks/intro-permaculture/ve/slide-15.webp", "/course-decks/intro-permaculture/ve/slide-16.webp", "/course-decks/intro-permaculture/ve/slide-18.webp", "/course-decks/intro-permaculture/ve/slide-19.webp", "/course-decks/intro-permaculture/ve/slide-20.webp", "/course-decks/intro-permaculture/ve/slide-21.webp", "/course-decks/intro-permaculture/ve/slide-22.webp", "/course-decks/intro-permaculture/ts/slide-01.webp", "/course-decks/intro-permaculture/ts/slide-04.webp", "/course-decks/intro-permaculture/ts/slide-06.webp", "/course-decks/intro-permaculture/ts/slide-07.webp", "/course-decks/intro-permaculture/ts/slide-08.webp", "/course-decks/intro-permaculture/ts/slide-09.webp", "/course-decks/intro-permaculture/ts/slide-10.webp", "/course-decks/intro-permaculture/ts/slide-11.webp", "/course-decks/intro-permaculture/ts/slide-12.webp", "/course-decks/intro-permaculture/ts/slide-13.webp", "/course-decks/intro-permaculture/ts/slide-14.webp", "/course-decks/intro-permaculture/ts/slide-15.webp", "/course-decks/intro-permaculture/ts/slide-16.webp", "/course-decks/intro-permaculture/ts/slide-18.webp", "/course-decks/intro-permaculture/ts/slide-19.webp", "/course-decks/intro-permaculture/ts/slide-20.webp", "/course-decks/intro-permaculture/ts/slide-21.webp", "/course-decks/intro-permaculture/ts/slide-22.webp"];
const before = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
assert.equal(sha(before), introFullMediaProof.manifestBeforeSHA256);
const inventoryBytes = readFileSync(folder + 'all-manifest-assets-before.json');
assert.equal(sha(inventoryBytes), introFullMediaProof.allAssetBeforeSHA256);
const inventory = JSON.parse(inventoryBytes.toString());
const observed = new Map<string, { signature: string; sha256: string; bytes: number }>();
function fileDescriptor(path: string) {
  const stat = statSync(path, { bigint: true });
  const signature = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
  const prior = observed.get(path);
  if (prior?.signature === signature) return prior;
  const bytes = readFileSync(path);
  const descriptor = { signature, bytes: bytes.length, sha256: sha(bytes) };
  observed.set(path, descriptor);
  return descriptor;
}
export function verifyIntroFullFrameBytes(frame: any, bytes: Buffer) {
  assert.equal(bytes.length, frame.new.bytes, frame.path + ': actual compressed byte count');
  assert.equal(sha(bytes), frame.new.sha256, frame.path + ': actual compressed SHA');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
  assert.equal(bytes.readUInt16LE(26) & 0x3fff, frame.new.width);
  assert.equal(bytes.readUInt16LE(28) & 0x3fff, frame.new.height);
  assert.equal(frame.new.width, 1440);
  assert.ok(frame.new.height >= 5400, 'natural-height target/source panels are never cropped');
}

// 6 October 2026: the 36 later Intro cards replace older still descriptors.
// Validate the entire real current layer and every unlisted asset before exposing
// only frozen prior descriptors. Filesystem identities keep repeated dated views
// bounded without skipping same-size changes or source/status guards.
let verifiedExpectedManifest: string | undefined;
export function validateCurrentIntroFullMedia(currentManifest = readFileSync('lib/course-asset-sizes.ts', 'utf8')) {
  // As in the older Intro proof, one immutable full media pass per process is
  // sufficient for dated descriptors; every caller's manifest is still exact.
  if (verifiedExpectedManifest !== undefined) {
    const beforeResidual = soilWaterResidualAssetSizesBefore(currentManifest);
    assert.equal(beforeResidual, verifiedExpectedManifest, 'only 36 approved sizes and the measured exact aggregate comment change before the later Soil/Water layer');
    return introFullMediaProof;
  }
  soilWaterResidualValidateCurrentFrames();
  const beforeResidual = soilWaterResidualAssetSizesBefore(currentManifest);
  const currentDecks = readCurrentIntroFullDecks();
  validateAndRewindIntroFullPaired(currentDecks);
  // The media proof belongs to the36-frame release, before the three later text cells.
  // Both whole-current guards run on live input; do not feed already-restored data into them.
  const decks = validateAndRewindIntroSilentTextLayer({ paired: currentDecks }).pairedBeforeSilent;
  const proof = introFullMediaProof;
  assert.equal(proof.frames.length, 36);
  assert.equal(new Set(proof.frames.map((row: any) => row.path)).size, 36);
  assert.deepEqual(proof.frames.map((row: any) => row.path).sort(), expectedIntroFullPaths.slice().sort());
  assert.equal(inventory.length, 1905);
  let expected = before;
  const changed = new Set([
    ...expectedIntroFullPaths,
    ...JSON.parse(readFileSync('docs/media/soil-water-residual-2026-10-06/frames.json', 'utf8')).renderedFrames
      .map((row: any) => '/' + row.path.replace(/^public\//, '')),
  ]);
  for (const frame of proof.frames) {
    const old = inventory.find((row: any) => row.path === frame.path);
    assert.ok(old);
    assert.equal(frame.old.bytes, old.bytes);
    assert.equal(frame.old.sha256, old.sha256);
    const header = Buffer.from(frame.old.encodedHeaderHex, 'hex');
    assert.equal(header.toString('ascii', 0, 4), 'RIFF');
    assert.equal(header.toString('ascii', 8, 12), 'WEBP');
    assert.equal(header.readUInt16LE(26) & 0x3fff, frame.old.width);
    assert.equal(header.readUInt16LE(28) & 0x3fff, frame.old.height);
    assert.deepEqual(frame.pairedSource, decks[frame.language].slides[frame.slide - 1], 'full English/accepted target/status binding');
    // 6 October 2026: three later Intro pictures have complete current-byte guards before their prior descriptors.
    const later = silentIntroMediaBefore(frame.asset);
    if (later) assert.deepEqual({bytes:later.bytes,sha256:later.sha256}, {bytes:frame.new.bytes,sha256:frame.new.sha256});
    else verifyIntroFullFrameBytes(frame, readFileSync(frame.asset));
    assert.notEqual(frame.old.sha256, frame.new.sha256);
    const oldEntry = `  '${frame.path}': ${frame.old.bytes},`;
    assert.equal(expected.split(oldEntry).length, 2);
    expected = expected.replace(oldEntry, `  '${frame.path}': ${frame.new.bytes},`);
  }
  const entries = [...expected.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, row) => sum + Number(row[1]), 0);
  assert.equal(entries.length, 1905);
  assert.equal(total, proof.manifestActualTotalBytes);
  assert.equal(proof.manifestNewComment, `// 1905 files, ${(total / 1e6).toFixed(1)} MB total.`);
  assert.equal(expected.split(proof.manifestOldComment).length, 2);
  expected = expected.replace(proof.manifestOldComment, proof.manifestNewComment);
  assert.equal(beforeResidual, expected, 'only 36 approved sizes and the measured exact aggregate comment change before the later Soil/Water layer');
  assert.equal(sha(beforeResidual), proof.manifestAfterSHA256);
  assert.equal(inventory.filter((row: any) => !changed.has(row.path)).length, 1851);
  for (const row of inventory) {
    if (changed.has(row.path)) continue;
    const later = isSilentIntroLaterReplacedAsset(row.path) ? silentIntroMediaBefore(row.path) : undefined;
    if (later) {
      assert.equal(later.bytes, row.bytes, row.path + ': the complete newer 968/13-frame layers rewind to this frozen descriptor');
      assert.equal(later.sha256, row.sha256, row.path + ': the complete newer 968/13-frame layers rewind to this frozen descriptor');
      continue;
    }
    const vegetablesResidual = studyVegetablesTwoResidualAssetBefore('public' + row.path, readFileSync('public' + row.path));
    if (vegetablesResidual) {
      assert.equal(vegetablesResidual.bytes, row.bytes, row.path + ': the exact newer Vegetables two-card layer rewinds to this frozen descriptor');
      assert.equal(vegetablesResidual.sha256, row.sha256, row.path + ': the exact newer Vegetables two-card layer rewinds to this frozen descriptor');
      continue;
    }
    const actual = fileDescriptor('public' + row.path);
    assert.equal(actual.bytes, row.bytes, row.path + ': all unlisted assets exact');
    assert.equal(actual.sha256, row.sha256, row.path + ': all unlisted assets exact');
  }
  verifiedExpectedManifest = expected;
  return proof;
}
export function introFullAssetSizesBeforeOrdinary(currentManifest?: string) {
  validateCurrentIntroFullMedia();
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  if (currentManifest === undefined || currentManifest === actual) return before;
  assert.equal(currentManifest, before, 'only the exact guarded Intro full manifest baseline may be exposed');
  return before;
}
export function introFullMediaBeforeEarlierProof(path: string): {bytes:number;sha256:string;encodedHeaderHex?:string} | undefined {
  const url = path.startsWith('public/') ? path.slice(6) : path;
  // Unlisted files receive no historical descriptor. Their caller checks actual
  // bytes; validating the whole inventory per unrelated path made Soil/Water
  // preservation quadratic. Every listed rewind still validates the full layer.
  if (!expectedIntroFullPaths.includes(url)) return nativePairedResidualMediaBefore(path) ?? undefined;
  validateCurrentIntroFullMedia();
  const frame = introFullMediaProof.frames.find((row: any) => row.path === url);
  return frame ? frame.old as { sha256: string; bytes: number; encodedHeaderHex: string } : undefined;
}
