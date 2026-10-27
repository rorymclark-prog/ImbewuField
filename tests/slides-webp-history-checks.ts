import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureWave13ThemeCurrent, wave13ThemeSourceBefore } from './wave-13-theme-history-checks.ts';
import { wave25SourceBefore } from './wave-25-offline-history-checks.ts';

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
  // The newer wave 13 theme layer sits on this one: its owned sources are checked and
  // projected to their exact WebP-layer successor before this layer's byte-exact pins run.
  ensureWave13ThemeCurrent();
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
    const live = wave13ThemeSourceBefore(file, read(file));
    assert.equal(live.length, row.afterBytes, file + ': complete live successor size');
    assert.equal(sha(live), row.afterSha256, file + ': complete live successor, including every unlisted byte');
  }
  const liveManifest = read('lib/course-asset-sizes.ts').toString();
  assert.deepEqual(manifestRows(liveManifest), manifestExpectation, 'live manifest rows are exactly the predecessor rows moved to WebP');
  // Only a completely successful observation is reused.
  lastSuccessfulSignature = signature;
}

// Dated owners run inside the blind-reviewed read scope, which checks this whole
// layer when the scope opens and closes. Nested projections share that observation;
// outside a scope every projection checks the live layer itself.
let scopedDepth = 0;
export function withSlidesWebpCheckedScope<T>(readOnly: () => T): T {
  scopedDepth++;
  try { return readOnly(); } finally { scopedDepth--; }
}
const ensureOutsideScope = () => { if (scopedDepth === 0) ensureSlidesWebpCurrent(); };

/** Live media listing → the exact 12 October predecessor listing. */
export function slidesWebpListingBefore(paths: string[]): string[] {
  ensureOutsideScope();
  return paths.filter(path => !added.has(path)).map(path => successors.get(path)?.path ?? path).sort();
}

/** Recorded size/digest of a JPEG this layer retired, after the live WebP successor passed. */
export function slidesWebpRetiredBefore(path: string): Media | undefined {
  const row = retired.get(path);
  if (!row) return undefined;
  // Recorded data only; callers run inside a scope that already checked the live layer.
  return { path: row.path, bytes: row.bytes, sha256: row.sha256 };
}

export function slidesWebpOwnsSource(file: string): boolean {
  return Object.hasOwn(proof.files, file);
}

/** Exact live successor source → its exact predecessor; any other bytes pass through for the caller's own check. */
export function slidesWebpSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  // w25-03 re-pin: the newest layer (lazy-chunk precache in app/sw.js/route.ts) projects first, for every owner.
  supplied = wave25SourceBefore(file, supplied);
  const row = proof.files[file];
  if (!row) return supplied;
  ensureOutsideScope();
  supplied = wave13ThemeSourceBefore(file, supplied);
  if (sha(supplied) !== row.afterSha256) return supplied;
  const before = beforeFiles.get(file)!;
  return (typeof supplied === 'string' ? before.toString() : Buffer.from(before)) as T;
}

// The retired JPEG bytes are not kept in the tree. Their exact blobs stay in the
// main commit this layer sits on (CI checks out full history), and every read is
// held to the recorded size and digest before an older owner sees it.
const predecessorCommit = 'eea14cdf3d81758478947fe5580f49843599b952';
const repoPath = (path: string | URL) => {
  const absolute = resolve(root, path instanceof URL ? fileURLToPath(path) : String(path));
  return absolute.startsWith(root) ? absolute.slice(root.length).replace(/^\//, '') : undefined;
};
const retiredBytes = new Map<string, Buffer>();
function retiredContent(row: Retired): Buffer {
  let bytes = retiredBytes.get(row.path);
  if (!bytes) {
    bytes = execFileSync('git', ['cat-file', 'blob', `${predecessorCommit}:${row.path}`], { cwd: root, maxBuffer: 64 << 20 });
    assert.equal(bytes.length, row.bytes, row.path + ': exact retired JPEG size from the predecessor commit');
    assert.equal(sha(bytes), row.sha256, row.path + ': exact retired JPEG digest from the predecessor commit');
    retiredBytes.set(row.path, bytes);
  }
  return bytes;
}
const absent = (path: string, syscall: string) => Object.assign(new Error(`ENOENT: no such file or directory, ${syscall} '${path}'`), { errno: -2, code: 'ENOENT', syscall, path });

/** fs view of the 12 October tree for dated owners: retired JPEGs are present with
 * their recorded bytes, and their WebP successors and the added WebPs are absent.
 * The view only maps paths. The complete live layer is checked where a dated owner's
 * read scope opens and closes (ensureBlindReviewedCorrectionsCurrent runs
 * ensureSlidesWebpCurrent). Checking it per lookup made each media walk quadratic. */
export const slidesWebpHistoryStatSync = ((path: any, options?: any) => {
  const file = repoPath(path);
  if (file && (successors.has(file) || added.has(file))) {
    if (options?.throwIfNoEntry === false) return undefined;
    throw absent(String(path), 'stat');
  }
  const row = file ? retired.get(file) : undefined;
  if (!row) return statSync(path, options);
  const live = statSync(resolve(root, row.successor.path), options)!;
  return Object.assign(Object.create(Object.getPrototypeOf(live)), live, { size: options?.bigint ? BigInt(row.bytes) : row.bytes });
}) as typeof statSync;

export const slidesWebpHistoryExistsSync = ((path: any) => {
  const file = repoPath(path);
  if (file && (successors.has(file) || added.has(file))) return false;
  if (file && retired.has(file)) { return true; }
  return existsSync(path);
}) as typeof existsSync;

export const slidesWebpHistoryReadFileSync = ((...args: any[]) => {
  const file = typeof args[0] === 'number' ? undefined : repoPath(args[0]);
  if (file && (successors.has(file) || added.has(file))) throw absent(String(args[0]), 'open');
  const row = file ? retired.get(file) : undefined;
  if (!row) return (readFileSync as any)(...args);
  const bytes = Buffer.from(retiredContent(row));
  const encoding = typeof args[1] === 'string' ? args[1] : args[1]?.encoding;
  return encoding ? bytes.toString(encoding) : bytes;
}) as typeof readFileSync;

export const slidesWebpHistoryReaddirSync = ((path: any, options?: any) => {
  const entries: any[] = (readdirSync as any)(path, options);
  const directory = repoPath(path);
  if (directory === undefined) return entries;
  const keyOf = (entry: any) => {
    if (typeof entry === 'string' || Buffer.isBuffer(entry)) return join(directory, String(entry));
    const parent = entry.parentPath ?? entry.path;
    return join(repoPath(parent) ?? directory, entry.name);
  };
  if (!entries.some(entry => successors.has(keyOf(entry)) || added.has(keyOf(entry)))) return entries;
  return entries.filter(entry => !added.has(keyOf(entry))).map(entry => {
    const row = successors.get(keyOf(entry));
    if (!row) return entry;
    const name = row.path.split('/').pop()!;
    if (typeof entry === 'string') return entry.replace(/[^/]+$/, name);
    if (Buffer.isBuffer(entry)) return Buffer.from(String(entry).replace(/[^/]+$/, name));
    return Object.assign(Object.create(Object.getPrototypeOf(entry)), entry, { name });
  });
}) as typeof readdirSync;
