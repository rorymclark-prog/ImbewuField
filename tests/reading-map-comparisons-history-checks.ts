import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { followupSourceBefore, followupNativeBefore } from './core-reading-vegetables-followup-history-checks.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { veReadingFrostNativeBefore, veReadingFrostSourceBefore, frostFiles, frostNative } from './ve-reading-frost-history-checks.ts';

// The later perfect/actually-use repairs supersede dated whole-file claims.
// Reconstruct only these three leaves after validating every current file byte
// and the complete caller module; any unlisted mutation must still fail.
const folder = 'docs/study-translation-reviews/reading-map-comparisons-2026-10-07/';
const hashes: Record<string,string> = {
  "accepted-candidates.json": "d6082c74d321e1a9a334532b9371ba7dd72e0feccb7fd05ec28ce0d9b621970f",
  "exact-file-proof.json": "326a1452c9de1a80708964a478ff1efc777d2e6272a2e52a4f76c931c3fcaff9",
  "native-proof.json": "6b98a227ee288d73a49a80443ea6c1cac8b166131fd0bdd8a944b0ff50658c42"
};
const read = (name: string) => {
  const bytes = readFileSync(folder + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[name]);
  return JSON.parse(bytes.toString());
};
export const mapPlan = read('accepted-candidates.json');
export const mapFiles = read('exact-file-proof.json');
export const mapNative = read('native-proof.json');
assert.deepEqual(COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === mapPlan.lessonId), mapPlan.sourceEnglish);
assert.equal(mapPlan.fluentApproval, false);
assert.equal(mapPlan.candidates.length, 3);
for (const [file, proof] of Object.entries(mapFiles) as [string,any][]) {
  assert.equal(createHash('sha256').update(proof.before).digest('hex'), proof.beforeSha256);
  const language = file.includes('-st-') ? 'st' : file.includes('-ve-') ? 've' : 'ts';
  const row = mapPlan.candidates.find((r: any) => r.language === language);
  const before = JSON.stringify(row.before).slice(1,-1);
  const after = JSON.stringify(row.candidate).slice(1,-1);
  assert.equal(proof.before.split(before).length - 1, 1);
  assert.equal(proof.before.replace(before,after), proof.proposedAfter);
  const expected = structuredClone(mapNative.before[language]);
  const key = language === 'st' ? 'sesothoDraft' : language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  const body = expected.lessons.find((l: any) => l.id === mapPlan.lessonId).body;
  assert.equal(body[key].split(row.before).length - 1, 1);
  body[key] = body[key].replace(row.before,row.candidate);
  assert.deepEqual(expected, mapNative.after[language]);
}
export function ensureMapCurrent() {
  for (const [file, proof] of Object.entries(mapFiles) as [string,any][]) {
    assert.equal(veReadingFrostSourceBefore(file, readFileSync(file,'utf8')), proof.proposedAfter, file + ': complete current bytes after exact latest projection and all unlisted bytes preserved');
  }
}
export function mapSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  if (file !== 'lib/course-asset-sizes.ts') bytes = followupSourceBefore(file, bytes);
  if (frostFiles[file] && Buffer.from(bytes).toString() === readFileSync(file, 'utf8')) bytes = veReadingFrostSourceBefore(file, bytes) as string | Uint8Array;
  const proof = mapFiles[file];
  if (!proof) return bytes;
  ensureMapCurrent();
  const text = Buffer.from(bytes).toString();
  if (text === proof.before) return bytes;
  assert.equal(text, proof.proposedAfter, 'supplied complete accepted bytes: map comparison layer');
  return proof.before;
}
export function mapNativeBefore<T>(language: string, actual: T): T {
  actual = followupNativeBefore(actual);
  if (language === 've' && JSON.stringify(actual) === JSON.stringify(frostNative.after)) actual = veReadingFrostNativeBefore('ve', actual);
  if (!(language in mapNative.after)) return actual;
  ensureMapCurrent();
  if (JSON.stringify(actual) === JSON.stringify(mapNative.before[language])) return structuredClone(actual);
  assert.deepEqual(actual,mapNative.after[language], 'complete Reading comparisons registry: map comparison layer');
  return structuredClone(mapNative.before[language]);
}

export function mapPresentationBefore<T extends { status: string; content: any }>(value: T, lessonId: string, language: string): T {
  if (lessonId !== mapPlan.lessonId || !(language in mapNative.after) || value.status !== 'draft') return value;
  ensureMapCurrent();
  const native = mapNative.after[language].lessons.find((l: any) => l.id === lessonId);
  const key = language === 'st' ? 'sesothoDraft' : language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  const text = (p: any) => p.reviewStatus === 'hold' ? p.sourceEnglish : p[key];
  assert.deepEqual(value.content, {
    title: text(native.title), body: text(native.body), keyPoints: native.keyPoints.map(text),
    quiz: native.quiz.map((q: any) => ({ q: text(q.question), options: q.options.map(text), correct: q.sourceCorrectIndex, rationale: text(q.rationale) })),
    infographicAlt: text(native.infographicAlt),
  }, 'entire actual map presentation before its historical reconstruction');
  const result = structuredClone(value);
  const row = mapPlan.candidates.find((r: any) => r.language === language);
  const paragraphs = result.content.body.split('\n\n');
  assert.equal(paragraphs[2], row.candidate);
  paragraphs[2] = row.before;
  result.content.body = paragraphs.join('\n\n');
  return result;
}
