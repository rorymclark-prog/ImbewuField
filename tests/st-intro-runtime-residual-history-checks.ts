import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { studyVegetablesTwoResidualSourceBefore } from './study-vegetables-two-ordinary-residual-history-checks.ts';

const folder = 'docs/study-translation-reviews/st-intro-runtime-residual-2026-10-08/';
const pairPath = 'docs/narration/intro-permaculture.st.silent-draft.json';
const manifestPath = 'lib/course-asset-sizes.ts';
const workerPath = 'app/sw.js/route.ts';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => readFileSync(path);
const proofBytes = read(folder + 'runtime-layer-proof.json');
assert.equal(sha(proofBytes), '3f5439f84e3828bb889bc1750dba57811a4a8727bff03ad1bff17f3ac1663480', 'immutable applied layer proof');
const proof = JSON.parse(proofBytes.toString());
const packetBytes = read(folder + 'applied-packet.json');
assert.equal(sha(packetBytes), '8973dbe47d45c0e0229c63148c824fe7e9d04da39b17450fd71ecc493a2e116b', 'immutable root-reviewed exact-source decisions');
const packet = JSON.parse(packetBytes.toString());
const beforeBytes = read(folder + 'before-intro-permaculture.st.silent-draft.json');
assert.equal(sha(beforeBytes), proof.pair.beforeSha256, 'exact paired predecessor snapshot');
const beforePair = JSON.parse(beforeBytes.toString());
const expectedPair = structuredClone(beforePair);
assert.equal(packet.pair.afterSha256, proof.pair.afterSha256);
assert.equal(packet.appliedRows.length, 17);
for (const row of packet.appliedRows) {
  const slide = expectedPair.slides.find((item: any) => item.n === row.slide);
  assert.ok(slide, `approved slide ${row.slide} exists`);
  const source = row.field === 'heading' ? slide.english.heading : slide.english.body[row.index];
  const target = row.field === 'heading' ? slide.target.heading : slide.target.body[row.index];
  assert.equal(source, row.sourceEnglish, `exact source slide ${row.slide} ${row.field}[${row.index}]`);
  assert.equal(target.status, row.beforeStatus, `status slide ${row.slide} ${row.field}[${row.index}]`);
  assert.equal(target.text, row.beforeText, `exact target predecessor slide ${row.slide} ${row.field}[${row.index}]`);
  target.text = row.afterText;
}
for (const row of packet.heldUnchangedRows) {
  const slide = expectedPair.slides.find((item: any) => item.n === row.slide);
  assert.equal(slide.english.body[row.index], row.sourceEnglish, 'held exact source');
  assert.equal(slide.target.body[row.index].status, row.status, 'held status preserved');
  assert.equal(slide.target.body[row.index].text, row.text, 'held text preserved');
}
const expectedPairBytes = Buffer.from(JSON.stringify(expectedPair, null, 2) + '\n');
assert.equal(sha(expectedPairBytes), proof.pair.afterSha256, 'complete pair serialization, including unlisted values and order');

const beforeManifestBytes = read(folder + 'before/course-asset-sizes.ts.txt');
assert.equal(sha(beforeManifestBytes), proof.manifest.beforeSha256, 'exact manifest predecessor snapshot');
let expectedManifest = beforeManifestBytes.toString();
for (const asset of proof.assets) {
  assert.match(asset.url, /^\/course-decks\/intro-permaculture\/st-silent\/slide-(10|13|14|15|16|18|19|20|21|22)\.webp$/);
  const oldEntry = `  '${asset.url}': ${asset.before.bytes},`;
  assert.equal(expectedManifest.split(oldEntry).length, 2, `one exact predecessor manifest row ${asset.url}`);
  expectedManifest = expectedManifest.replace(oldEntry, `  '${asset.url}': ${asset.after.bytes},`);
}
const total = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)].reduce((sum, row) => sum + Number(row[1]), 0);
expectedManifest = expectedManifest.replace(/^\/\/ 1930 files, [\d.]+ MB total\.$/m, `// 1930 files, ${(total / 1024 / 1024).toFixed(1)} MB total.`);
assert.equal(sha(expectedManifest), proof.manifest.afterSha256, 'only ten measured entries and their measured aggregate changed');

const assets = new Map<string, any>(proof.assets.map((row: any) => ['public' + row.url, row]));
assert.equal(proof.assets.length, 10, 'exact ten-card asset layer');
for (const row of proof.assets) {
  const snapshot = read(folder + row.beforeSnapshot.path);
  assert.equal(snapshot.length, row.beforeSnapshot.bytes, row.url + ': saved exact before bytes');
  assert.equal(sha(snapshot), row.beforeSnapshot.sha256, row.url + ': saved exact before digest');
  assert.deepEqual({ bytes: snapshot.length, sha256: sha(snapshot) }, { bytes: row.before.bytes, sha256: row.before.sha256 });
}
assert.equal(proof.preservation.recordedPairSha256, '50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9');
assert.equal(proof.preservation.courseAudioSha256, '36baa7b8e6ffb452a1fee06f3358d4b2050c80101200da8f1dda77cb5f356d64');
const releaseBindings = read(proof.releaseBindings.path);
assert.equal(releaseBindings.length, proof.releaseBindings.afterBytes);
assert.equal(sha(releaseBindings), proof.releaseBindings.afterSha256, 'complete current release rows preserve every unlisted language/module');
const releaseBindingsBefore = read(folder + 'before/course-deck-release-bindings-data.ts.txt');
assert.equal(releaseBindingsBefore.length, proof.releaseBindings.beforeBytes);
assert.equal(sha(releaseBindingsBefore), proof.releaseBindings.beforeSha256, 'exact prior release registry snapshot');
const workerBefore = read(folder + 'before/app-sw-route.ts.txt');
assert.equal(sha(workerBefore), proof.worker.beforeSha256, 'exact prior worker source snapshot');
assert.equal(workerBefore.length, proof.worker.beforeBytes);
export const stIntroRuntimeResidualAssets = proof.assets;
function isTargetPair(file: string) { return file === pairPath; }
export function stIntroRuntimeResidualPairBefore<T>(file: string, actual: T): T {
  if (!isTargetPair(file)) return actual;
  validateLivePair();
  assert.deepEqual(actual, expectedPair, 'exact accepted 17-target layer, complete source/status/order and unlisted preservation');
  return structuredClone(beforePair);
}
export function stIntroRuntimeResidualPairBeforeHistory<T>(file: string, actual: T): T {
  if (!isTargetPair(file)) return actual;
  validateLivePair();
  if (JSON.stringify(actual) === JSON.stringify(expectedPair)) return structuredClone(beforePair);
  const restored: any = structuredClone(actual);
  for (const row of packet.appliedRows) {
    const slide = restored.slides?.find((item: any) => item.n === row.slide);
    const field = row.field === 'heading' ? slide?.target?.heading : slide?.target?.body?.[row.index];
    const original = row.field === 'heading'
      ? beforePair.slides.find((item: any) => item.n === row.slide).target.heading
      : beforePair.slides.find((item: any) => item.n === row.slide).target.body[row.index];
    if (JSON.stringify(field) === JSON.stringify(row.field === 'heading'
      ? expectedPair.slides.find((item: any) => item.n === row.slide).target.heading
      : expectedPair.slides.find((item: any) => item.n === row.slide).target.body[row.index])) {
      if (row.field === 'heading') slide.target.heading = structuredClone(original);
      else slide.target.body[row.index] = structuredClone(original);
    }
  }
  return restored;
}
export function stIntroRuntimeResidualPairBytesBefore(file: string, bytes: Uint8Array): Uint8Array {
  if (!isTargetPair(file)) return bytes;
  validateLivePair();
  assert.equal(Buffer.from(bytes).toString(), read(pairPath).toString(), 'caller supplied exact current pair bytes');
  return beforeBytes;
}
function validateLivePair() {
  const live = read(pairPath);
  assert.equal(sha(live), proof.pair.afterSha256, 'complete live silent pair digest');
  assert.deepEqual(JSON.parse(live.toString()), expectedPair, 'complete live silent pair has only the accepted target cells changed');
}
export function stIntroRuntimeResidualAssetBefore(path: string, bytes: Uint8Array) {
  const row = assets.get(path.startsWith('public/') ? path : 'public' + path);
  if (!row) return undefined;
  assert.equal(bytes.length, row.after.bytes, path + ': current compressed still byte count');
  assert.equal(sha(bytes), row.after.sha256, path + ': current compressed still SHA');
  const compressed = Buffer.from(bytes);
  assert.equal(compressed.toString('ascii', 0, 4), 'RIFF');
  assert.equal(compressed.toString('ascii', 8, 12), 'WEBP');
  assert.equal(compressed.readUInt16LE(26) & 0x3fff, 1440);
  assert.equal(compressed.readUInt16LE(28) & 0x3fff, 5400);
  return { bytes: row.before.bytes, sha256: row.before.sha256, width: row.before.width, height: row.before.height };
}
export function stIntroRuntimeResidualAssetBytesBefore(path: string, bytes: Uint8Array) {
  const row = assets.get(path.startsWith('public/') ? path : 'public' + path);
  if (!row) return undefined;
  stIntroRuntimeResidualAssetBefore(path, bytes);
  const slide = Number(row.url.match(/slide-(\d+)\.webp$/)?.[1]);
  const before = read(`${folder}before-assets/slide-${slide}.webp`);
  assert.equal(before.length, row.before.bytes, path + ': immutable exact prior asset bytes');
  assert.equal(sha(before), row.before.sha256, path + ': immutable exact prior asset SHA');
  return before;
}
export function stIntroRuntimeResidualManifestBefore(actual = read(manifestPath).toString()) {
  const live = Buffer.from(studyVegetablesTwoResidualSourceBefore(manifestPath, read(manifestPath))).toString();
  actual = Buffer.from(studyVegetablesTwoResidualSourceBefore(manifestPath, actual)).toString();
  assert.equal(sha(live), proof.manifest.afterSha256, 'complete live generated asset-size manifest digest');
  assert.equal(live, expectedManifest, 'complete live manifest preserves all non-target rows and exact aggregate');
  if (actual === live) return beforeManifestBytes.toString();
  assert.equal(actual, beforeManifestBytes.toString(), 'caller supplies the exact current manifest or its exact immediate predecessor');
  return actual;
}
export function stIntroRuntimeResidualManifestBeforeHistory(actual: string) {
  const live = Buffer.from(studyVegetablesTwoResidualSourceBefore(manifestPath, read(manifestPath))).toString();
  actual = Buffer.from(studyVegetablesTwoResidualSourceBefore(manifestPath, actual)).toString();
  assert.equal(sha(live), proof.manifest.afterSha256, 'complete live generated asset-size manifest digest');
  assert.equal(live, expectedManifest, 'complete live manifest preserves all non-target rows and exact aggregate');
  if (actual === live) return beforeManifestBytes.toString();
  return actual;
}
export function stIntroRuntimeResidualSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  if (file !== workerPath) return bytes;
  const live = Buffer.from(studyVegetablesTwoResidualSourceBefore(workerPath, read(workerPath)));
  assert.equal(sha(live), proof.worker.afterSha256, 'complete live service-worker source digest');
  assert.equal(live.length, proof.worker.afterBytes, 'complete live service-worker source size');
  const supplied = Buffer.from(studyVegetablesTwoResidualSourceBefore(file, bytes));
  if (!supplied.equals(live)) return bytes;
  return typeof bytes === 'string' ? workerBefore.toString() : workerBefore;
}
