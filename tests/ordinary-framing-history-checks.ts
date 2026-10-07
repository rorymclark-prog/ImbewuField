import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { followupAssetBefore, followupPairBeforeHistory } from './core-reading-vegetables-followup-history-checks.ts';
import { fairSharingAssetBefore, fairSharingPairBefore, fairSharingSourceBytesBefore } from './intro-fair-sharing-history-checks.ts';
import { veReadingFrostPairBefore, veReadingFrostAssetBefore, veReadingFrostSourceBefore, frostFiles, frostAssets } from './ve-reading-frost-history-checks.ts';

const folder = 'docs/study-translation-reviews/regional-ordinary-framing-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const proofBytes = readFileSync(folder + 'applied-field-proof.json');
assert.equal(sha(proofBytes), 'eecba9c43d061aaa5db43a79c935873fda2b20d90892f7fe2cf3c5b3f65b2a67', 'immutable 13-field proof');
const proof = JSON.parse(proofBytes.toString());
assert.equal(proof.base, '94c9ec530722c483667d590cbfdaa29a5408a163');
assert.equal(proof.groups.length, 13, 'proof binds exactly thirteen full fields');

const inputHashes: Record<string, string> = {
  'docs/narration/market-community.ve.paired-draft.json': 'ea237174e916647ddb80b069b289489b65cc590b67332a3a7d526881ba887754',
  'docs/narration/reading-landscape.ve.paired-draft.json': '9e2074b05391049a2c358cb592407ffcbb20ffc64513c86da1589cfc5c5c27b5',
  'docs/narration/vegetables-staples.ts.paired-draft.json': '1e212c0d4b0319aa924bd1be8c4e8ebcfc05fd7f9b6561d953ec6a00d2a66b6d',
  'docs/narration/vegetables-staples.ve.paired-draft.json': '7603cebd738df04e08ef679fabc806384f154599be95af02a790ad423cad7482',
};

const before: Record<string, any> = {};
const expected: Record<string, any> = {};
for (const [file, hash] of Object.entries(inputHashes)) {
  const bytes = readFileSync(folder + 'before/' + file.split('/').pop());
  assert.equal(sha(bytes), hash, `${file}: immutable complete before snapshot`);
  before[file] = JSON.parse(bytes.toString());
  expected[file] = structuredClone(before[file]);
}

const fieldCell = (document: any, row: any) => {
  const slide = document.slides.find((item: any) => item.n === row.slide);
  assert.ok(slide, `${row.id}: source slide exists in frozen snapshot`);
  return row.field === 'heading' ? slide.english.heading : slide.english.body[row.index];
};
const targetCell = (document: any, row: any) => {
  const slide = document.slides.find((item: any) => item.n === row.slide);
  assert.ok(slide, `${row.id}: target slide exists in frozen snapshot`);
  return row.field === 'heading' ? slide.target.heading : slide.target.body[row.index];
};
const setTargetCell = (document: any, row: any, value: any) => {
  const slide = document.slides.find((item: any) => item.n === row.slide);
  if (row.field === 'heading') slide.target.heading = value;
  else slide.target.body[row.index] = value;
};

const seen = new Set<string>();
for (const row of proof.groups) {
  assert.ok(inputHashes[row.file], `${row.id}: source file has a frozen snapshot`);
  const binding = `${row.file}:${row.slide}:${row.field}:${row.index ?? ''}`;
  assert.ok(!seen.has(binding), `${row.id}: field appears only once in proof`);
  seen.add(binding);
  assert.equal(fieldCell(before[row.file], row), row.source, `${row.id}: frozen English source binding`);
  assert.deepEqual(targetCell(before[row.file], row), row.before, `${row.id}: complete frozen target binding`);
  setTargetCell(expected[row.file], row, structuredClone(row.after));
}
assert.equal(seen.size, 13);

export const ordinaryFramingGroups: any[] = proof.groups;
export const ordinaryFramingBefore: Record<string, any> = before;
export const ordinaryFramingExpected: Record<string, any> = expected;

/** Verify all four complete live documents, including every source and unlisted target field. */
let signature = "";
export function ensureOrdinaryFramingText() {
  const next = Object.keys(expected).map(file => { const s = statSync(file, { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(":"); }).join("|");
  if (next === signature) return;
  for (const [file, value] of Object.entries(expected)) {
    assert.deepEqual(veReadingFrostPairBefore(file, JSON.parse(readFileSync(file, 'utf8'))), value, 'complete 13-field layer after the accepted latest VE frost projection and every unlisted source/target');
  }
  signature = next;
}

/** Return the complete frozen predecessor only after the caller supplies the complete current layer. */
export function ordinaryFramingPairBefore<T>(file: string, actual: T): T {
  actual = followupPairBeforeHistory(file, actual);
  if (frostFiles[file] && JSON.stringify(actual) === JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))) actual = veReadingFrostPairBefore(file, actual);
  ensureOrdinaryFramingText();
  if (!(file in expected)) return fairSharingPairBefore(file, actual);
  assert.deepEqual(actual, expected[file], 'caller supplies complete current layer, including unlisted source and target fields');
  return structuredClone(before[file]);
}

/** Rewind only exact proof-backed fields in a complete current document. */
export function ordinaryFramingPairBeforeHistory<T>(file: string, actual: T): T {
  actual = followupPairBeforeHistory(file, actual);
  if (frostFiles[file] && JSON.stringify(actual) === JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))) actual = veReadingFrostPairBefore(file, actual);
  ensureOrdinaryFramingText();
  if (!(file in expected)) return fairSharingPairBefore(file, actual);
  const restored: any = structuredClone(actual);
  for (const row of proof.groups.filter((item: any) => item.file === file)) {
    const current = targetCell(restored, row);
    // Older composition may have restored other dated cells. The live full guard
    // above remains mandatory; only exact reviewed objects can be rewound here.
    if (JSON.stringify(current) !== JSON.stringify(row.after)) continue;
    setTargetCell(restored, row, structuredClone(row.before));
  }
  return restored;
}

/** Verify input bytes are the live complete file before returning its immutable predecessor bytes. */
export function ordinaryFramingPairBytesBefore(file: string, bytes: Uint8Array): Uint8Array {
  if (!(file in expected)) return file === 'docs/narration/intro-permaculture.ts.paired-draft.json'
    ? Buffer.from(fairSharingSourceBytesBefore(file, bytes)) : bytes;
  const text = Buffer.from(bytes).toString('utf8');
  ordinaryFramingPairBefore(file, JSON.parse(text));
  assert.equal(text, readFileSync(file, 'utf8'), 'caller bytes are the exact live paired file bytes');
  return readFileSync(folder + 'before/' + file.split('/').pop());
}

const assetProofBytes = readFileSync(folder + 'converted-assets.json');
assert.equal(sha(assetProofBytes), '05367409689f8e4b8fcbf8a446f3b475653a698165d1e223bbc7e326ef1f9999', 'immutable ten-card before/after measurement proof');
export const ordinaryFramingAssets: any[] = JSON.parse(assetProofBytes.toString());
assert.equal(ordinaryFramingAssets.length, 10);
assert.equal(new Set(ordinaryFramingAssets.map(row => row.url)).size, 10);

const assetsByPath = new Map(ordinaryFramingAssets.map(row => ['public' + row.url, row]));
export function ordinaryFramingAssetBefore(path: string, bytes: Uint8Array) {
  const followup = followupAssetBefore(path, bytes);
  const url = path.startsWith('public/') ? path.slice('public'.length) : path;
  const newest = frostAssets[url]?.changed ? veReadingFrostAssetBefore(path, bytes) : null;
  if (newest) {
    const row = assetsByPath.get(path);
    if (!row) return newest;
    assert.equal(newest.bytes, row.bytes, `${path}: exact VE frost predecessor matches the reviewed framing output size`);
    assert.equal(newest.sha256, row.sha256, `${path}: exact VE frost predecessor matches the reviewed framing output SHA`);
  }
  const fairness = fairSharingAssetBefore(path, bytes);
  if (fairness) return fairness;
  const row = assetsByPath.get(path);
  if (!row) return followup;
  assert.equal(newest?.bytes ?? followup?.bytes ?? bytes.length, row.bytes, `${path}: exact reviewed current bytes`);
  assert.equal(newest?.sha256 ?? followup?.sha256 ?? sha(bytes), row.sha256, `${path}: exact reviewed current SHA-256`);
  return { bytes: row.beforeBytes, sha256: row.beforeSHA256, width: row.beforeDimensions[0], height: row.beforeDimensions[1] };
}

const oldManifestBytes = readFileSync(folder + 'before/manifest.ts.txt');
assert.equal(sha(oldManifestBytes), 'ea8912df6c1b830498206cbae080050a28057aa3bb0a466e2f9b787a786782fb', 'immutable complete before manifest');
const oldManifest = oldManifestBytes.toString('utf8');
let expectedManifest = oldManifest;
for (const row of ordinaryFramingAssets) {
  const previous = `  '${row.url}': ${row.beforeBytes},`;
  assert.equal(expectedManifest.split(previous).length, 2, `${row.url}: one exact before manifest entry`);
  expectedManifest = expectedManifest.replace(previous, `  '${row.url}': ${row.bytes},`);
}
const total = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
expectedManifest = expectedManifest.replace(/\d+\.\d+ MB/, (total / 1024 / 1024).toFixed(1) + ' MB');

export function ordinaryFramingManifestBefore(actual: string): string {
  if (frostFiles['lib/course-asset-sizes.ts'] && actual === readFileSync('lib/course-asset-sizes.ts', 'utf8')) actual = veReadingFrostSourceBefore('lib/course-asset-sizes.ts', actual) as string;
  actual = fairSharingSourceBytesBefore('lib/course-asset-sizes.ts', actual);
  assert.equal(actual, expectedManifest, 'complete current manifest after only the ten measured card changes');
  return oldManifest;
}
