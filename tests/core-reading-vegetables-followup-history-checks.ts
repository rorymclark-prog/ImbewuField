import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

// The five reviewed clauses and two learner repairs supersede dated snapshots.
// Check the complete newest files first; history receives only their exact predecessor.
const folder = 'docs/study-translation-reviews/core-reading-vegetables-followup-2026-10-07/';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function proof(name: string, digest: string) {
  const bytes = readFileSync(folder + name);
  assert.equal(sha(bytes), digest, name + ': immutable complete reviewed proof');
  return JSON.parse(bytes.toString());
}
export const followupFiles = proof('exact-file-proof.json', '0a6d1d3e8b0826f31c63e0eb5f13ed931ede5c43a8b04834d8c015bb29fbc8a5') as Record<string, { before: string; after: string; beforeSha256: string; afterSha256: string }>;
export const followupNative = proof('native-registry-proof.json', 'c0c2dc162b3437506258deb4e3fc571be1cc3d324143259edcfa74082a8c663d');
export const followupAssets = proof('asset-proof.json', 'afe4637d76e602c89d5bf2e4995026de6a8fb0611627687c7af4bd8310d66ce8') as Record<string, { beforeBytes: number; afterBytes: number; beforeSha256: string; afterSha256: string; changed: boolean }>;
const plan = JSON.parse(readFileSync(folder + 'accepted-plan.json', 'utf8'));
let signature = '';
export function ensureFollowupCurrent() {
  const next = Object.keys(followupFiles).map(file => { const s = statSync(file, { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':'); }).join('|');
  if (next === signature) return;
  for (const [file, row] of Object.entries(followupFiles)) {
    assert.equal(sha(row.before), row.beforeSha256);
    assert.equal(sha(row.after), row.afterSha256);
    assert.equal(sha(readFileSync(file)), row.afterSha256, file + ': complete current source, draft and unlisted bytes');
  }
  signature = next;
}
export function followupSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  const row = followupFiles[file];
  if (!row) return bytes;
  ensureFollowupCurrent();
  const text = Buffer.from(bytes).toString();
  if (text === row.before) return bytes;
  assert.equal(text, row.after, file + ': complete accepted caller bytes before projection');
  return row.before;
}
export function followupPairBefore<T>(file: string, value: T): T {
  if (!file.endsWith('.paired-draft.json') || !followupFiles[file]) return value;
  ensureFollowupCurrent();
  const row = followupFiles[file];
  if (typeof value === 'string') return followupSourceBefore(file, value) as T;
  const before = JSON.parse(row.before);
  if (JSON.stringify(value) === JSON.stringify(before)) return structuredClone(value);
  assert.deepEqual(value, JSON.parse(row.after), file + ': complete accepted caller object before projection');
  return before;
}
export function followupNativeBefore<T>(value: T): T {
  const identity = value as any;
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
  if (!file.endsWith('.paired-draft.json') || !followupFiles[file]) return value;
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
  const url = path.startsWith('public/') ? path.slice(6) : path;
  const row = followupAssets[url];
  if (!row?.changed) return null;
  assert.equal(bytes.byteLength, row.afterBytes, url + ': actual current bytes');
  assert.equal(sha(bytes), row.afterSha256, url + ': actual current SHA, including same-size corruption');
  return { bytes: row.beforeBytes, sha256: row.beforeSha256, width: 1440, height: 5400 };
}

export function followupPresentationBefore<T extends { status?: string; content: any }>(value: T, lessonId: string, language: string): T {
  const key = language === 'st' && lessonId === 'reading-landscape-l3' ? 'st'
    : language === 've' && lessonId === 'market-community-l3' ? 've' : null;
  if (!key || value.status === 'english-fallback') return value;
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
