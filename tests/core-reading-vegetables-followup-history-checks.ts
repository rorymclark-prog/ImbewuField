import { ensureExpandedCurrent, expandedSourceBefore, expandedPairBefore, expandedNativeBefore, expandedPairBeforeHistory, expandedAssetBefore, expandedPresentationBefore } from './core-ordinary-expanded-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { studyRemainingControlsSourceBefore } from './study-remaining-controls-next-history-checks.ts';

// The five reviewed clauses and two learner repairs supersede dated snapshots.
// Check the complete newest files first; history receives only their exact predecessor.
const folder = 'docs/study-translation-reviews/core-reading-vegetables-followup-2026-10-07/';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (file: string) => resolve(repositoryRoot, file);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function proof(name: string, digest: string) {
  const bytes = readFileSync(folder + name);
  assert.equal(sha(bytes), digest, name + ': immutable complete reviewed proof');
  return JSON.parse(bytes.toString());
}
export const followupFiles = proof('exact-file-proof.json', '0a6d1d3e8b0826f31c63e0eb5f13ed931ede5c43a8b04834d8c015bb29fbc8a5') as Record<string, { before: string; after: string; beforeSha256: string; afterSha256: string }>;
export const followupNative = proof('native-registry-proof.json', 'c0c2dc162b3437506258deb4e3fc571be1cc3d324143259edcfa74082a8c663d');
export const followupAssets = proof('asset-proof.json', 'afe4637d76e602c89d5bf2e4995026de6a8fb0611627687c7af4bd8310d66ce8') as Record<string, { beforeBytes: number; afterBytes: number; beforeSha256: string; afterSha256: string; changed: boolean }>;
const currentBatchPath = 'docs/study-translation-reviews/core-ordinary-completion-next-2026-10-07/exact-current-batch-proof.json';
const currentBatchBytes = readFileSync(currentBatchPath);
assert.equal(sha(currentBatchBytes), 'b3b06e020854c7e3fbd0ef9990f082aa2e892e6b1aaee0c35ccf6a59ee8404e7', 'complete current source, asset, and rendered-file proof is immutable');
export const currentBatchProof = JSON.parse(currentBatchBytes.toString()) as {
  base: string;
  files: Record<string, { before: string; after: string; beforeSha256: string; afterSha256: string; beforeBytes: number; afterBytes: number }>;
  pairedFields: Array<{ file: string; slide: number; bodyIndex: number; segmentIndex: number; sourceEnglish: string; sourceSegment: string; beforeSegment: any; afterSegment: any }>;
  nativeModules: { files: Record<string, string>; before: Record<string, any>; after: Record<string, any> };
  assets: Array<{ path: string; url: string; beforeBytes: number; afterBytes: number; beforeSha256: string; afterSha256: string; dimensions: number[] }>;
};
const currentBatchAssets = new Map(currentBatchProof.assets.map(row => [row.url, row]));
const plan = JSON.parse(readFileSync(folder + 'accepted-plan.json', 'utf8'));
let signature = '';
let currentBatchSignature = '';
export function ensureFollowupCurrent() {
  ensureCurrentBatch();
  const next = Object.keys(followupFiles).map(file => { const s = statSync(repositoryPath(file), { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':'); }).join('|');
  if (next === signature) return;
  for (const [file, row] of Object.entries(followupFiles)) {
    assert.equal(sha(row.before), row.beforeSha256);
    assert.equal(sha(row.after), row.afterSha256);
    const newer = currentBatchProof.files[file];
    if (newer) assert.equal(newer.beforeSha256, row.afterSha256, file + ': immutable next layer carries this complete exact predecessor');
    else assert.equal(sha(expandedSourceBefore(file, studyRemainingControlsSourceBefore(file, readFileSync(repositoryPath(file))))), row.afterSha256, file + ': complete current source, draft and unlisted bytes after the exact newer study-controls layer');
  }
  signature = next;
}

/** Verify the newest accepted batch before any older history layer sees its predecessor. */
export function ensureCurrentBatch() {
  ensureExpandedCurrent();
  const paths = [...Object.keys(currentBatchProof.files), ...currentBatchProof.assets.map(row => row.path)];
  const next = paths.map(file => { const s = statSync(repositoryPath(file), { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':'); }).join('|');
  if (next === currentBatchSignature) return;
  for (const [file, row] of Object.entries(currentBatchProof.files)) {
    assert.equal(sha(row.before), row.beforeSha256, `${file}: frozen full predecessor bytes`);
    assert.equal(sha(row.after), row.afterSha256, `${file}: frozen full current bytes`);
    assert.equal(Buffer.byteLength(row.before), row.beforeBytes, `${file}: predecessor byte length`);
    assert.equal(Buffer.byteLength(row.after), row.afterBytes, `${file}: current byte length`);
    assert.equal(sha(expandedSourceBefore(file, studyRemainingControlsSourceBefore(file, readFileSync(repositoryPath(file))))), row.afterSha256, `${file}: exact current source, manifest, or worker bytes after the exact newer study-controls layer`);
  }
  for (const row of currentBatchProof.assets) {
    const bytes = readFileSync(row.path);
    assert.equal(bytes.byteLength, row.afterBytes, `${row.path}: current still byte length`);
    assert.equal(sha(bytes), row.afterSha256, `${row.path}: current still SHA-256`);
    const older = followupAssets[row.url];
    if (older) assert.equal(row.beforeSha256, older.afterSha256, `${row.url}: current batch predecessor joins the preceding immutable asset layer`);
  }
  for (const [file, row] of Object.entries(followupFiles)) {
    const newer = currentBatchProof.files[file];
    if (newer) assert.equal(newer.beforeSha256, row.afterSha256, `${file}: current batch predecessor joins the preceding immutable file layer`);
  }
  currentBatchSignature = next;
}
/** True only for the byte-verified live file or its frozen current-batch predecessor. */
export function isCurrentOrBatchPredecessor<T>(file: string, value: T): boolean {
  value = expandedPairBefore(file, value);
  ensureCurrentBatch();
  const live = JSON.parse(expandedSourceBefore(file, readFileSync(repositoryPath(file), 'utf8')) as string);
  if (JSON.stringify(value) === JSON.stringify(live)) return true;
  const predecessor = currentBatchProof.files[file];
  return Boolean(predecessor && JSON.stringify(value) === JSON.stringify(JSON.parse(predecessor.before)));
}
export function followupSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  // 8 October learner-only changes supersede this exact-file snapshot; validate/project them first.
  bytes = studyRemainingControlsSourceBefore(file, bytes);
  bytes = expandedSourceBefore(file, bytes);
  const row = followupFiles[file];
  const newer = currentBatchProof.files[file];
  if (!row && !newer) return bytes;
  ensureCurrentBatch();
  let text = Buffer.from(bytes).toString();
  if (newer) {
    const digest = sha(text);
    if (digest === newer.afterSha256) text = newer.before;
    else if (row && digest === row.beforeSha256) {
      // A named older proof owner may already have projected this whole file.
      // Keep that exact immutable snapshot for its caller's full-layer guard.
      ensureFollowupCurrent();
      return bytes;
    } else assert.ok(digest === newer.beforeSha256, file + ': complete current source, draft and unlisted bytes must match current proof or its exact predecessor');
  }
  if (!row) return typeof bytes === 'string' ? text : Buffer.from(text);
  ensureFollowupCurrent();
  if (text === row.before) return bytes;
  assert.equal(text, row.after, file + ': complete accepted caller bytes before projection');
  return row.before;
}
export function followupPairBefore<T>(file: string, value: T): T {
  value = expandedPairBefore(file, value);
  if (!file.endsWith('.paired-draft.json')) return value;
  const older = followupFiles[file];
  if (older && typeof value !== 'string' && JSON.stringify(value) === JSON.stringify(JSON.parse(older.before))) {
    // Some older history owners call with their already-projected complete
    // pair. Accept that exact frozen snapshot only after verifying both newer
    // layers against the live complete files; the owner still checks it next.
    ensureFollowupCurrent();
    return structuredClone(value);
  }
  const newer = currentBatchProof.files[file];
  if (newer) {
    ensureCurrentBatch();
    const before = JSON.parse(newer.before);
    if (typeof value === 'string') {
      if (value === newer.before) return value as T;
      assert.equal(value, newer.after, file + ': full current pair bytes before latest-layer reconstruction');
      value = newer.before as T;
    } else if (JSON.stringify(value) === JSON.stringify(JSON.parse(newer.after))) {
      value = before as T;
    } else {
      assert.deepEqual(value, before, file + ': caller supplied the verified current deck or its complete accepted latest paired layer predecessor');
      value = before as T;
    }
  }
  if (!followupFiles[file]) return value;
  ensureFollowupCurrent();
  const row = followupFiles[file];
  if (typeof value === 'string') return followupSourceBefore(file, value) as T;
  const before = JSON.parse(row.before);
  if (JSON.stringify(value) === JSON.stringify(before)) return structuredClone(value);
  assert.deepEqual(value, JSON.parse(row.after), file + ': complete accepted caller object before projection');
  return before;
}
export function followupNativeBefore<T>(value: T): T {
  value = expandedNativeBefore(value);
  const identity = value as any;
  const currentBatchKey = Object.entries(currentBatchProof.nativeModules.after).find(([, module]: [string, any]) =>
    identity?.id === module.id && identity?.language === module.language &&
    identity?.lessons?.map((lesson: any) => lesson.id).join('|') === module.lessons.map((lesson: any) => lesson.id).join('|'))?.[0] ?? null;
  if (currentBatchKey) {
    ensureCurrentBatch();
    const before = currentBatchProof.nativeModules.before[currentBatchKey];
    if (JSON.stringify(value) === JSON.stringify(before)) return structuredClone(value);
    assert.deepEqual(value, currentBatchProof.nativeModules.after[currentBatchKey], `${currentBatchKey}: complete current registry module before the accepted predicate is projected`);
    return structuredClone(before) as T;
  }
  const key = identity?.language === 'st' && identity?.id === 'reading-landscape' ? 'st'
    : identity?.language === 've' && identity?.id === 'market-community' ? 've' : null;
  if (!key) return value;
  ensureFollowupCurrent();
  if (JSON.stringify(value) === JSON.stringify(followupNative.before[key])) return structuredClone(value);
  assert.deepEqual(value, followupNative.after[key], 'complete current native registry before the two learner repairs are projected');
  return structuredClone(followupNative.before[key]) as T;
}
/** Older composition may have already rewound other leaves. The mandatory full
 * live guard remains; restore only these exact reviewed objects, then let the
 * predecessor's complete object guard reject any other caller mutation. */
export function followupPairBeforeHistory<T>(file: string, value: T): T {
  value = expandedPairBeforeHistory(file, value);
  if (!file.endsWith('.paired-draft.json')) return value;
  const latestFields = currentBatchProof.pairedFields.filter(row => row.file === file);
  if (latestFields.length) {
    ensureCurrentBatch();
    const result: any = structuredClone(value);
    for (const row of latestFields) {
      const cell = result.slides.find((item: any) => item.n === row.slide).target.body[row.bodyIndex];
      const segment = cell.segments[row.segmentIndex];
      if (JSON.stringify(segment) === JSON.stringify(row.afterSegment)) cell.segments[row.segmentIndex] = structuredClone(row.beforeSegment);
    }
    value = result;
  }
  if (!followupFiles[file]) return value;
  ensureFollowupCurrent();
  const result: any = structuredClone(value);
  for (const row of plan.pairedFields.filter((item: any) => item.file === file)) {
    const cell = result.slides.find((item: any) => item.n === row.slide).target.body[row.bodyIndex];
    const segment = cell.segments[row.segmentIndex];
    if (JSON.stringify(segment) === JSON.stringify(row.newSegment)) cell.segments[row.segmentIndex] = structuredClone(row.oldSegment);
  }
  return result;
}
export function followupAssetBefore(path: string, bytes: Uint8Array) {
  const expanded = expandedAssetBefore(path, bytes);
  if (expanded) return expanded;
  const url = path.startsWith('public/') ? path.slice(6) : path;
  const latest = currentBatchAssets.get(url);
  if (latest) {
    ensureCurrentBatch();
    assert.equal(bytes.byteLength, latest.afterBytes, url + ': actual bytes from the complete current batch');
    assert.equal(sha(bytes), latest.afterSha256, url + ': actual SHA from the complete current batch');
    const older = followupAssets[url];
    if (older) assert.equal(latest.beforeSha256, older.afterSha256, url + ': exact predecessor of this still matches the prior layer');
    return { bytes: latest.beforeBytes, sha256: latest.beforeSha256, width: latest.dimensions[0], height: latest.dimensions[1] };
  }
  const row = followupAssets[url];
  if (!row?.changed) return null;
  assert.equal(bytes.byteLength, row.afterBytes, url + ': actual current bytes');
  assert.equal(sha(bytes), row.afterSha256, url + ': actual current SHA, including same-size corruption');
  return { bytes: row.beforeBytes, sha256: row.beforeSha256, width: 1440, height: 5400 };
}

export function followupPresentationBefore<T extends { status?: string; content: any }>(value: T, lessonId: string, language: string): T {
  value = expandedPresentationBefore(value, lessonId, language);
  if (value.status === 'english-fallback') return value;
  const nativeKey = Object.entries(currentBatchProof.nativeModules.after).find(([, module]: [string, any]) =>
    module.language === language && module.lessons.some((lesson: any) => lesson.id === lessonId))?.[0];
  if (nativeKey) {
    ensureCurrentBatch();
    const targetKey = language === 've' ? 'tshivendaDraft' : language === 'ts' ? 'xitsongaDraft' : 'sesothoDraft';
    const content = (module: any) => {
      const lesson = module.lessons.find((row: any) => row.id === lessonId);
      const text = (row: any) => row.reviewStatus === 'hold' ? row.sourceEnglish : row[targetKey];
      return { title: text(lesson.title), body: text(lesson.body), keyPoints: lesson.keyPoints.map(text),
        quiz: lesson.quiz.map((row: any) => ({ q: text(row.question), options: row.options.map(text), correct: row.sourceCorrectIndex, rationale: text(row.rationale) })), infographicAlt: text(lesson.infographicAlt) };
    };
    const before = content(currentBatchProof.nativeModules.before[nativeKey]);
    if (JSON.stringify(value.content) === JSON.stringify(before)) return structuredClone(value);
    assert.deepEqual(value.content, content(currentBatchProof.nativeModules.after[nativeKey]), `${nativeKey}/${lessonId}: full current resolver presentation before exact newest-layer projection`);
    return { ...structuredClone(value), content: before };
  }
  const key = language === 'st' && lessonId === 'reading-landscape-l3' ? 'st'
    : language === 've' && lessonId === 'market-community-l3' ? 've' : null;
  if (!key) return value;
  ensureFollowupCurrent();
  const targetKey = key === 'st' ? 'sesothoDraft' : 'tshivendaDraft';
  const content = (module: any) => {
    const lesson = module.lessons.find((row: any) => row.id === lessonId);
    const text = (row: any) => row.reviewStatus === 'hold' ? row.sourceEnglish : row[targetKey];
    return { title: text(lesson.title), body: text(lesson.body), keyPoints: lesson.keyPoints.map(text),
      quiz: lesson.quiz.map((row: any) => ({ q: text(row.question), options: row.options.map(text), correct: row.sourceCorrectIndex, rationale: text(row.rationale) })), infographicAlt: text(lesson.infographicAlt) };
  };
  const before = content(followupNative.before[key]);
  if (JSON.stringify(value.content) === JSON.stringify(before)) return structuredClone(value);
  assert.deepEqual(value.content, content(followupNative.after[key]), 'complete current learner presentation before scoped two-field repair projection');
  return { ...structuredClone(value), content: before };
}
