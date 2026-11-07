import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wave16OwnsSource, wave16SourceBefore } from './wave-16-history-checks.ts';
import { xhDeckListingBefore } from './xh-deck-history-checks.ts';
import { ensureSlidesWebpCurrent, withSlidesWebpCheckedScope, slidesWebpListingBefore, slidesWebpOwnsSource, slidesWebpRetiredBefore, slidesWebpSourceBefore, slidesWebpHistoryReadFileSync } from './slides-webp-history-checks.ts';

// A dated test may inspect a predecessor only after the complete new layer has
// passed. The independent audit is model evidence, never fluent-speaker approval.
const root = fileURLToPath(new URL('../', import.meta.url));
const folder = 'docs/study-translation-reviews/blind-reviewed-corrections-2026-10-12/';
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => readFileSync(resolve(root, file));
// The 14 Oct 2026 WebP media-format layer is newer than this one: live sources it owns
// are validated there and projected to their exact predecessor before these checks.
// Wave 16 (22 Oct 2026) is newer still and projects its own sources first.
const readLive = (file: string) => slidesWebpSourceBefore(file, wave16SourceBefore(file, read(file)));
const beforePath = (file: string) => folder + 'before/' + file + (file.endsWith('.ts') ? '.txt' : '');
const proofBytes = read(folder + 'source-layer-proof.json');
assert.equal(sha(proofBytes), 'b7a07b624a469f315a33442503177056b3c07c3c18be5d69c60caf1df47a863a', 'immutable bounded correction proof');
export const blindReviewedCorrectionProof = JSON.parse(proofBytes.toString());
const proof = blindReviewedCorrectionProof;
const nativeBytes = read(folder + 'native-before-after.json');
assert.equal(sha(nativeBytes), proof.nativeSnapshotsSha256, 'complete imported native predecessor/successor snapshots');
const natives: any[] = JSON.parse(nativeBytes.toString());
const inventoryBytes = read(folder + 'media-before-inventory.json');
assert.equal(sha(inventoryBytes), proof.mediaInventorySha256, 'immutable complete media predecessor inventory');
const inventory: any[] = JSON.parse(inventoryBytes.toString());
const media = new Map<string, any>(proof.assets.map((a: any) => [a.path, a]));
const beforeFiles = new Map<string, Buffer>();
for (const [file, row] of Object.entries(proof.files) as [string, any][]) {
  const before = read(beforePath(file));
  assert.equal(sha(before), row.beforeSha256, file + ': exact preserved complete predecessor');
  assert.equal(before.length, row.beforeBytes);
  let expected = before.toString();
  for (const patch of row.replacements) {
    assert.ok(patch.before && patch.after, file + ': declared change includes exact context');
    assert.equal(expected.split(patch.before).length - 1, 1, file + ': one exact approved predecessor span');
    expected = expected.replace(patch.before, patch.after);
  }
  assert.equal(sha(expected), row.afterSha256, file + ': only the declared spans produce the complete successor');
  assert.equal(Buffer.byteLength(expected), row.afterBytes);
  if (file.endsWith('.json')) {
    const a = JSON.parse(before.toString()), b = JSON.parse(expected);
    assert.deepEqual(b.slides.map((s: any) => [s.n, s.english]), a.slides.map((s: any) => [s.n, s.english]),
      file + ': every English source, heading, paragraph and slide index is unchanged');
  }
  beforeFiles.set(file, before);
}
for (const asset of proof.assets) {
  const before = read(folder + 'before/' + asset.path);
  assert.equal(sha(before), asset.beforeSha256, asset.path + ': immutable compressed predecessor');
  assert.equal(before.length, asset.beforeBytes);
}
assert.equal(proof.learnerCorrections, 9);
assert.equal(proof.assets.length, 5);
assert.equal(proof.reviewStatus, 'unreviewed');
assert.equal(proof.modelChecksAreNotFluentApproval, true);

function mediaPaths(): string[] {
  const result: string[] = [];
  function walk(relative: string) {
    for (const entry of readdirSync(resolve(root, relative), { withFileTypes: true })) {
      const path = relative + '/' + entry.name;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) result.push(path);
      else assert.fail(path + ': unexpected media symlink or special file');
    }
  }
  const names = readdirSync(resolve(root, 'public'), { withFileTypes: true }).filter(e => e.isDirectory() && (e.name.startsWith('course-') || e.name === 'studies-guides')).map(e => e.name).sort();
  assert.deepEqual(names, [...proof.mediaDirectories].sort(), 'all course media directories are accounted for');
  for (const name of names) walk('public/' + name);
  return result.sort();
}
// A retired JPEG keeps its recorded size and digest; its live WebP successor passed the newer layer.
function stat(file: string) {
  return statSync(resolve(root, slidesWebpRetiredBefore(file) ? file.replace(/\.jpg$/, '.webp') : file), { bigint: true });
}
let lastSuccessfulSignature = '';
export function ensureBlindReviewedCorrectionsCurrent(): void {
  ensureSlidesWebpCurrent();
  // The isiXhosa slide cards are a newer layer (tests/xh-deck-history-checks.ts); this layer sees the listing before them.
  const livePaths = xhDeckListingBefore(mediaPaths());
  const paths = slidesWebpListingBefore(livePaths);
  assert.deepEqual(paths, inventory.map(row => row.path).sort(), 'new or removed unlisted media cannot hide behind a cached validation');
  const files = [...paths, ...Object.keys(proof.files), ...Object.keys(proof.protected), folder + 'source-layer-proof.json', folder + 'native-before-after.json', folder + 'media-before-inventory.json',
    ...Object.keys(proof.files).map(file => beforePath(file)), ...proof.assets.map((a: any) => folder + 'before/' + a.path)];
  const signature = files.map(file => { const s = stat(file); return [file,s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':'); }).join('|');
  if (signature === lastSuccessfulSignature) return;
  assert.equal(sha(read(folder + 'source-layer-proof.json')), sha(proofBytes), 'proof may not change after initialization');
  assert.equal(sha(read(folder + 'native-before-after.json')), proof.nativeSnapshotsSha256);
  assert.equal(sha(read(folder + 'media-before-inventory.json')), proof.mediaInventorySha256);
  for (const [file, row] of Object.entries(proof.files) as [string, any][]) {
    const live = readLive(file);
    assert.equal(sha(live), row.afterSha256, file + ': complete actual live successor, including every unlisted byte');
    assert.equal(live.length, row.afterBytes);
    assert.equal(sha(read(beforePath(file))), row.beforeSha256, file + ': predecessor cannot change after initialization');
  }
  for (const [file, row] of Object.entries(proof.protected) as [string, any][]) {
    const retired = slidesWebpRetiredBefore(file);
    if (retired) {
      assert.equal(retired.sha256, row.sha256, file + ': retired JPEG is the exact protected predecessor');
      assert.equal(retired.bytes, row.bytes);
      continue;
    }
    const live = readLive(file);
    assert.equal(sha(live), row.sha256, file + ': canonical/source/recorded Sesotho media unchanged');
    assert.equal(live.length, row.bytes);
  }
  for (const row of inventory) {
    const retired = slidesWebpRetiredBefore(row.path);
    if (retired) {
      assert.ok(!media.has(row.path), row.path + ': a JPEG this layer corrected is not retired');
      assert.equal(retired.sha256, row.sha256, row.path + ': retired JPEG is the exact inventoried predecessor');
      assert.equal(retired.bytes, row.bytes);
      continue;
    }
    const changed = media.get(row.path), live = read(row.path);
    assert.equal(sha(live), changed?.afterSha256 ?? row.sha256, row.path + ': exact declared still or preserved unlisted media');
    assert.equal(live.length, changed?.afterBytes ?? row.bytes);
    if (changed) {
      const b = read(folder + 'before/' + row.path);
      assert.equal(sha(b), changed.beforeSha256);
      assert.equal(live.toString('ascii',0,4),'RIFF'); assert.equal(live.toString('ascii',8,12),'WEBP');
      assert.equal(live.readUInt16LE(26) & 0x3fff,1440); assert.equal(live.readUInt16LE(28) & 0x3fff,5400);
    }
  }
  // Only a completely successful observation is reused; changes and failures
  // must force every preservation assertion to run again.
  lastSuccessfulSignature = signature;
}

// These synchronous historical owners only read disk. Validate the complete
// live layer at both boundaries; nested projections share that observation.
// No observation survives the call, and direct validation never skips a scan.
let historicalReadDepth = 0;
export function withBlindReviewedCorrectionReadScope<T>(readOnly: () => T): T {
  const outer = historicalReadDepth === 0;
  if (outer) ensureBlindReviewedCorrectionsCurrent();
  historicalReadDepth++;
  try { return withSlidesWebpCheckedScope(readOnly); }
  finally {
    historicalReadDepth--;
    if (outer) ensureBlindReviewedCorrectionsCurrent();
  }
}
function ensureHistoricalReadCurrent(): void {
  if (historicalReadDepth === 0) ensureBlindReviewedCorrectionsCurrent();
}

export function blindReviewedSourceBefore(file: string, supplied: string | Uint8Array): string | Uint8Array {
  // Older owners hand over the live tree; move it behind the newer WebP layer first.
  supplied = slidesWebpSourceBefore(file, wave16SourceBefore(file, supplied));
  const row = proof.files[file];
  if (!row) return supplied;
  ensureHistoricalReadCurrent();
  if (sha(supplied) === row.afterSha256) return typeof supplied === 'string' ? beforeFiles.get(file)!.toString() : Buffer.from(beforeFiles.get(file)!);
  // Older guards can already hold an earlier exact predecessor. They still
  // perform their own full equality; unknown supplied bytes are not overwritten.
  return supplied;
}
export function blindReviewedAssetBefore(path: string, supplied: Uint8Array): Uint8Array {
  const file = path.startsWith('public/') ? path : 'public' + path;
  const row = media.get(file);
  if (!row) return supplied;
  ensureHistoricalReadCurrent();
  if (sha(supplied) !== row.afterSha256) return supplied;
  return read(beforePath(file));
}
export function blindReviewedPairBefore<T>(file: string, supplied: T): T {
  const row = proof.files[file];
  if (!row || !file.endsWith('.json')) return supplied;
  ensureHistoricalReadCurrent();
  const live = JSON.parse(read(file).toString());
  if (JSON.stringify(supplied) !== JSON.stringify(live)) return supplied;
  return JSON.parse(beforeFiles.get(file)!.toString());
}
export function blindReviewedNativeBefore<T>(supplied: T): T {
  const v = supplied as any;
  const row = natives.find(row => row.after.id ? row.after.id === v?.id && row.after.language === v?.language : v && 'water-harvesting-l1' in v);
  if (!row) return supplied;
  ensureHistoricalReadCurrent();
  if (JSON.stringify(supplied) !== JSON.stringify(row.after)) return supplied;
  return structuredClone(row.before);
}

/** Dated owners inspect their exact predecessor only after the real successor
 * passes every source/media assertion. Other reads, including immutable dated
 * evidence, are unchanged. Current-release tests continue reading real files. */
export const readBlindReviewedHistoryFile: typeof readFileSync = ((...args: any[]) => {
  const value = (slidesWebpHistoryReadFileSync as any)(...args);
  if (typeof args[0] === 'number') return value;
  const suppliedPath = args[0] instanceof URL ? fileURLToPath(args[0]) : String(args[0]);
  const file = resolve(root, suppliedPath).slice(root.length).replace(/^\//,'');
  // Wave 16 sources the WebP layer does not own: project them to their exact wave 15 bytes first.
  if (wave16OwnsSource(file) && !slidesWebpOwnsSource(file)) {
    const projected = wave16SourceBefore(file, Buffer.from(value));
    const encoding = typeof args[1] === 'string' ? args[1] : args[1]?.encoding;
    const before = typeof value === 'string' ? projected.toString(encoding) : projected;
    return proof.files[file] ? blindReviewedSourceBefore(file, before) : before;
  }
  if (slidesWebpOwnsSource(file)) {
    const before = slidesWebpSourceBefore(file, Buffer.from(value));
    const projected = proof.files[file] ? blindReviewedSourceBefore(file, before) : before;
    return typeof value === 'string' ? Buffer.from(projected).toString(args[1] as BufferEncoding) : projected;
  }
  if (proof.files[file]) return blindReviewedSourceBefore(file, value);
  if (media.has(file)) {
    const result = blindReviewedAssetBefore(file, Buffer.from(value));
    return typeof value === 'string' ? Buffer.from(result).toString(args[1] as BufferEncoding) : result;
  }
  return value;
}) as typeof readFileSync;

export function blindReviewedPresentationBefore<T extends { content: any }>(supplied: T, lessonId: string, language: string): T {
  for (const row of natives) {
    const key = language === 've' ? 'tshivendaDraft' : language === 'ts' ? 'xitsongaDraft' : 'sesothoDraft';
    const content = (module: any) => {
      if (module.id) {
        if (module.language !== language) return undefined;
        const lesson = module.lessons.find((v: any) => v.id === lessonId);
        if (!lesson) return undefined;
        const text = (p: any) => p.reviewStatus === 'hold' ? p.sourceEnglish : p[key];
        return {title:text(lesson.title),body:text(lesson.body),infographicAlt:text(lesson.infographicAlt),keyPoints:lesson.keyPoints.map(text),quiz:lesson.quiz.map((q: any)=>({q:text(q.question),options:q.options.map(text),correct:q.sourceCorrectIndex,rationale:text(q.rationale)}))};
      }
      return language === 'zu' ? module[lessonId] : undefined;
    };
    const after = content(row.after), before = content(row.before);
    if (!after || JSON.stringify(after) === JSON.stringify(before)) continue;
    // JSON object insertion order is not a semantic difference.
    try { assert.deepEqual(supplied.content, after); }
    catch { continue; }
    ensureHistoricalReadCurrent();
    return { ...structuredClone(supplied), content: structuredClone(before) };
  }
  return supplied;
}

/** Exact current/new still callers must pass before a dated frame descriptor is exposed. */
export function blindReviewedAssetDescriptorBefore(path: string): {bytes:number;sha256:string} | undefined {
  const file = path.startsWith('public/') ? path : 'public' + path;
  const row = media.get(file); if (!row) return undefined;
  ensureHistoricalReadCurrent();
  return {bytes:row.beforeBytes,sha256:row.beforeSha256};
}
