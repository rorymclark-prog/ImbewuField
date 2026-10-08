import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { stIntroRuntimeResidualSourceBefore, stIntroRuntimeResidualManifestBefore,
  stIntroRuntimeResidualManifestBeforeHistory } from './st-intro-runtime-residual-history-checks.ts';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (file: string) => resolve(repositoryRoot, file);
const folder = 'docs/study-translation-reviews/core-ordinary-expanded-next-2026-10-07/';
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const load = (name: string, digest: string) => {
  const bytes = readFileSync(repositoryPath(folder + name));
  assert.equal(sha(bytes), digest, name + ': full independently reviewed stage proof is immutable');
  return JSON.parse(bytes.toString());
};
export const expandedProof = load('exact-text-proof.json', 'f2131f0ddcaa503b60a2d39dc6dd2f395108c388991971606d5e30202c5983df');
const native = load('native-proof.json', '6da53a8999eb310842e3beb3dd11da2dc4c12628f7ac24606bf2bf29449ba018');
export const expandedAssets = load('render-proof.json', 'a3d8470bd2e4e4249a07540b1fe8765fc9cf978545c4cd98f9993ddf8060c07d');
let signature = '';
export function ensureExpandedCurrent() {
  const paths = [...Object.keys(expandedProof.files), ...expandedAssets.map((r: any) => 'public' + r.url)];
  const next = paths.map(file => { const s = statSync(repositoryPath(file), { bigint: true }); return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':'); }).join('|');
  if (next === signature) return;
  for (const [file, r] of Object.entries(expandedProof.files) as [string, any][]) {
    assert.equal(sha(r.before), r.beforeSha256, file + ': full predecessor');
    assert.equal(sha(r.after), r.afterSha256, file + ': full current source and unlisted bytes');
    const source = readFileSync(repositoryPath(file));
    const actual = file === 'lib/course-asset-sizes.ts'
      ? stIntroRuntimeResidualManifestBefore(source.toString())
      : stIntroRuntimeResidualSourceBefore(file, source);
    assert.equal(Buffer.from(actual).toString(), r.after, file + ': actual live bytes match complete reviewed proof after the exact newest source projection');
  }
  for (const r of expandedAssets) {
    const bytes = readFileSync(repositoryPath('public' + r.url));
    assert.equal(bytes.byteLength, r.afterBytes); assert.equal(sha(bytes), r.afterSha256);
  }
  signature = next;
}
/** Older owners still reject caller corruption against their complete snapshots.
 * This stage only substitutes an exact, byte-verified new file with its predecessor. */
export function expandedSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  bytes = file === 'lib/course-asset-sizes.ts'
    ? stIntroRuntimeResidualManifestBeforeHistory(Buffer.from(bytes).toString())
    : stIntroRuntimeResidualSourceBefore(file, bytes);
  const row = expandedProof.files[file];
  if (!row) return bytes;
  ensureExpandedCurrent();
  const text = Buffer.from(bytes).toString();
  if (text !== row.after) return bytes;
  return typeof bytes === 'string' ? row.before : Buffer.from(row.before);
}
export function expandedPairBefore<T>(file: string, value: T): T {
  const row = expandedProof.files[file];
  if (!row || !file.endsWith('.paired-draft.json')) return value;
  ensureExpandedCurrent();
  if (typeof value === 'string') return expandedSourceBefore(file, value) as T;
  return JSON.stringify(value) === JSON.stringify(JSON.parse(row.after)) ? JSON.parse(row.before) : value;
}
export function expandedNativeBefore<T>(value: T): T {
  const obj = value as any;
  const key = Object.keys(native.after).find(k => native.after[k].id === obj?.id && native.after[k].language === obj?.language && native.after[k].lessons.map((l: any) => l.id).join('|') === obj?.lessons?.map((l: any) => l.id).join('|'));
  if (!key) return value;
  ensureExpandedCurrent();
  if (JSON.stringify(value) === JSON.stringify(native.before[key])) return structuredClone(value);
  assert.deepEqual(value, native.after[key], key + ': full caller module before only four accepted learner clauses are restored');
  return structuredClone(native.before[key]);
}
export function expandedPresentationBefore<T extends { status?: string; content: any }>(value: T, lessonId: string, language: string): T {
  if (value.status !== 'draft') return value;
  const key = Object.keys(native.after).find(k => native.after[k].language === language && native.after[k].lessons.some((l: any) => l.id === lessonId));
  if (!key) return value;
  ensureExpandedCurrent();
  const target = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  const content = (module: any) => {
    const lesson = module.lessons.find((l: any) => l.id === lessonId);
    const text = (p: any) => p.reviewStatus === 'hold' ? p.sourceEnglish : p[target];
    return { title: text(lesson.title), body: text(lesson.body), keyPoints: lesson.keyPoints.map(text), quiz: lesson.quiz.map((q: any) => ({q: text(q.question), options: q.options.map(text), correct: q.sourceCorrectIndex, rationale: text(q.rationale)})), infographicAlt: text(lesson.infographicAlt) };
  };
  const before = content(native.before[key]);
  if (JSON.stringify(value.content) === JSON.stringify(before)) return structuredClone(value);
  assert.deepEqual(value.content, content(native.after[key]), key + '/' + lessonId + ': exact complete resolver output before dated reconstruction');
  return { ...structuredClone(value), content: before };
}
export function expandedPairBeforeHistory<T>(file: string, value: T): T {
  const row = expandedProof.files[file];
  if (!row || !file.endsWith('.paired-draft.json')) return value;
  ensureExpandedCurrent();
  const result: any = structuredClone(value), before = JSON.parse(row.before), after = JSON.parse(row.after);
  for (const next of after.slides) {
    const previous = before.slides.find((s: any) => s.n === next.n);
    const actual = result.slides.find((s: any) => s.n === next.n);
    if (!actual) continue;
    for (const key of ['heading', 'body']) {
      if (key === 'heading') {
        if (JSON.stringify(previous.target.heading) !== JSON.stringify(next.target.heading) && JSON.stringify(actual.target.heading) === JSON.stringify(next.target.heading)) actual.target.heading = structuredClone(previous.target.heading);
      } else next.target.body.forEach((cell: any, i: number) => {
        if (JSON.stringify(previous.target.body[i]) !== JSON.stringify(cell) && JSON.stringify(actual.target.body[i]) === JSON.stringify(cell)) actual.target.body[i] = structuredClone(previous.target.body[i]);
      });
    }
  }
  return result;
}
export function expandedAssetBefore(path: string, bytes: Uint8Array) {
  const url = path.startsWith('public/') ? path.slice(6) : path;
  const row = expandedAssets.find((r: any) => r.url === url);
  if (!row) return null;
  ensureExpandedCurrent();
  assert.equal(bytes.byteLength, row.afterBytes); assert.equal(sha(bytes), row.afterSha256);
  return { bytes: row.beforeBytes, sha256: row.beforeSha256, width: 1440, height: 5400 };
}
