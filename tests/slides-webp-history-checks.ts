import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// perf-03/perf-05 (14 Oct 2026): English and isiZulu lesson slides moved from JPEG
// to WebP and two Studies thumbnails were added. This is a media-format layer only:
// no words, slide order, translation or review state changes. Dated owners before
// it still see their exact predecessor listing, digests and source bytes, but only
// after the complete live WebP layer below has passed.
const root = fileURLToPath(new URL('../', import.meta.url));
const folder = 'docs/study-translation-reviews/slides-webp-2026-10-14/';
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
const proofBytes = read(folder + 'webp-layer-proof.json');
assert.equal(sha(proofBytes), '2ea875ccbd5ab0e9b383cf6b4fb15e7acced92aae9ac6d0a23f6b6e8e75c5e49', 'immutable WebP media-format layer proof');
const proof = JSON.parse(proofBytes.toString());
assert.equal(proof.status, 'perf-03-perf-05-media-format-layer');
assert.equal(sha(read('docs/study-translation-reviews/blind-reviewed-corrections-2026-10-12/media-before-inventory.json')), proof.predecessorInventorySha256,
  'the WebP layer sits directly on the complete 12 October media inventory');

type Media = { path: string; bytes: number; sha256: string };
type Retired = Media & { successor: Media };
const retired = new Map<string, Retired>(proof.retired.map((row: Retired) => [row.path, row]));
const successors = new Map<string, Retired>(proof.retired.map((row: Retired) => [row.successor.path, row]));
const added = new Map<string, Media>(proof.added.map((row: Media) => [row.path, row]));
assert.equal(retired.size, 500, 'every converted English/isiZulu slide is listed once');
assert.equal(successors.size, 500);
for (const row of retired.values()) {
  assert.match(row.path, /^public\/course-decks\/[^/]+\/(en|zu)\/(hi\/)?slide-\d+\.jpg$/, row.path + ': only en/zu lesson slides are retired');
  assert.equal(row.successor.path, row.path.replace(/\.jpg$/, '.webp'), row.path + ': WebP twin keeps the same path and slide number');
}
for (const row of added.values()) assert.match(row.path, /\.webp$/, row.path + ': added media is WebP');

const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(proof.files) as [string, any][]) {
  const before = read(row.beforePath);
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved predecessor');
  assert.equal(before.length, row.beforeBytes);
  beforeFiles.set(file, before);
}

const manifestRows = (text: string) => new Map([...text.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m => [m[1], Number(m[2])]));
// The regenerated size manifest differs from its predecessor only by the retired
// rows, their WebP successors, the added WebP rows and the aggregate line.
const manifestExpectation = manifestRows(beforeFiles.get('lib/course-asset-sizes.ts')!.toString());
for (const row of retired.values()) {
  const url = row.path.slice('public'.length);
  assert.equal(manifestExpectation.get(url), row.bytes, url + ': predecessor manifest row equals the recorded JPEG size');
  manifestExpectation.delete(url);
  manifestExpectation.set(row.successor.path.slice('public'.length), row.successor.bytes);
}
for (const row of added.values()) manifestExpectation.set(row.path.slice('public'.length), row.bytes);

let lastSuccessfulSignature = '';
export function ensureSlidesWebpCurrent(): void {
  // Retired JPEG paths are part of the signature, so one reappearing forces a full re-check.
  const signature = [...retired.keys(), ...successors.keys(), ...added.keys(), ...Object.keys(proof.files), folder + 'webp-layer-proof.json'].map(file => {
    const s = statSync(resolve(root, file), { bigint: true, throwIfNoEntry: false });
    return s ? [file, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':') : file + ':absent';
  }).join('|');
  if (signature === lastSuccessfulSignature) return;
  assert.equal(sha(read(folder + 'webp-layer-proof.json')), sha(proofBytes), 'proof may not change after initialization');
  for (const row of retired.values()) {
    assert.equal(existsSync(resolve(root, row.path)), false, row.path + ': retired JPEG no longer ships');
    const live = read(row.successor.path);
    assert.equal(live.length, row.successor.bytes, row.successor.path + ': exact WebP successor size');
    assert.equal(sha(live), row.successor.sha256, row.successor.path + ': exact WebP successor digest');
    assert.equal(live.toString('ascii', 0, 4), 'RIFF'); assert.equal(live.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of added.values()) {
    const live = read(row.path);
    assert.equal(live.length, row.bytes, row.path + ': exact added WebP size');
    assert.equal(sha(live), row.sha256, row.path + ': exact added WebP digest');
  }
  for (const [file, row] of Object.entries(proof.files) as [string, any][]) {
    const live = read(file);
    assert.equal(live.length, row.afterBytes, file + ': complete live successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live successor, including every unlisted byte');
  }
  const liveManifest = read('lib/course-asset-sizes.ts').toString();
  assert.deepEqual(manifestRows(liveManifest), manifestExpectation, 'live manifest rows are exactly the predecessor rows moved to WebP');
  // Only a completely successful observation is reused.
  lastSuccessfulSignature = signature;
}

/** Live media listing → the exact 12 October predecessor listing. */
export function slidesWebpListingBefore(paths: string[]): string[] {
  ensureSlidesWebpCurrent();
  return paths.filter(path => !added.has(path)).map(path => successors.get(path)?.path ?? path).sort();
}

/** Recorded size/digest of a JPEG this layer retired, after the live WebP successor passed. */
export function slidesWebpRetiredBefore(path: string): Media | undefined {
  const row = retired.get(path);
  if (!row) return undefined;
  ensureSlidesWebpCurrent();
  return { path: row.path, bytes: row.bytes, sha256: row.sha256 };
}

export function slidesWebpOwnsSource(file: string): boolean {
  return Object.hasOwn(proof.files, file);
}

/** Exact live successor source → its exact predecessor; any other bytes pass through for the caller's own check. */
export function slidesWebpSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  const row = proof.files[file];
  if (!row) return supplied;
  ensureSlidesWebpCurrent();
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}
