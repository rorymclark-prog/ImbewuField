import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';

// Age and exposure duration are different from size and arrival time. Validate
// this entire later layer before dated releases can show their older claims.
const folder = 'docs/study-translation-reviews/study-precision-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hashes: Record<string, string> = {
  'applied-candidates.json': '6eb0a3de53b476d9debdaad93994cba5c9243655e7864c453f34eaeef01a963c',
  'native-before.json': '335f9265ced34de2ff26f8e41be9cedf6c5fe6f2b09469514bbeeed9c584470e',
  'native-after.json': 'b41dac78b26402cbe1fa619c9bb46df05ae91303d38e055204fe4755136fa15d',
};
const read = (name: string) => {
  const bytes = readFileSync(folder + name);
  assert.equal(sha(bytes), hashes[name], name + ': immutable independently checked precision evidence');
  return JSON.parse(bytes.toString());
};
export const precisionPlan = read('applied-candidates.json');
export const precisionBefore = read('native-before.json');
export const precisionAfter = read('native-after.json');
assert.equal(precisionPlan.rows.length, 3);
assert.equal(precisionPlan.review.fluentApproval, false);
const expected = structuredClone(precisionBefore);
for (const row of precisionPlan.rows) {
  const canonical = COURSE_MODULES.flatMap(module => module.lessons).find(lesson => lesson.id === row.lessonId)!;
  assert.ok(canonical, row.lessonId + ': canonical lesson exists');
  let actualSource: string;
  if (row.language === 'zu') {
    const lesson = expected.zu[row.lessonId];
    const index = row.field === 'quiz0.question' ? 0 : 1;
    const key = index === 0 ? 'q' : 'rationale';
    actualSource = canonical.quiz[index][key];
    assert.equal(lesson.quiz[index][key], row.before);
    lesson.quiz[index][key] = row.candidate;
  } else {
    assert.equal(row.language, 've');
    assert.equal(row.field, 'infographicAlt');
    const pair = expected.ve.lessons.find((lesson: any) => lesson.id === row.lessonId).infographicAlt;
    actualSource = canonical.infographicAlt!;
    assert.equal(pair.sourceEnglish, row.sourceEnglish);
    assert.equal(pair.tshivendaDraft, row.before);
    pair.tshivendaDraft = row.candidate;
  }
  assert.equal(actualSource, row.sourceEnglish, row.lessonId + ': exact current English source');
}
assert.deepEqual(expected, precisionAfter, 'only three accepted leaves change; every source/status/index/unlisted lesson remains exact');
for (const [file, proof] of Object.entries(precisionPlan.files) as [string, any][]) {
  let expectedText = proof.before;
  for (const row of precisionPlan.rows.filter((row: any) => (row.language === 'zu') === file.endsWith('drafts.ts'))) {
    assert.equal(expectedText.split(row.before).length - 1, 1, 'accepted prior literal occurs once');
    expectedText = expectedText.replace(row.before, row.candidate);
  }
  assert.equal(expectedText, proof.after, file + ': no unlisted source bytes change');
}
let lastSignature = '';
export function ensurePrecisionCurrent() {
  const files = [...Object.keys(precisionPlan.files), 'lib/course-modules.ts'];
  const signature = files.map(file => { const s = statSync(file, { bigint: true }); return [file,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':'); }).join('|');
  if (signature === lastSignature) return;
  for (const [file, proof] of Object.entries(precisionPlan.files) as [string, any][]) {
    assert.equal(readFileSync(file, 'utf8'), proof.after, file + ': complete live precision file, not an arbitrary historical view');
  }
  assert.equal(sha(readFileSync('lib/course-modules.ts')), 'abfc288afe6715ec7345ec9d35d48faa54580fb73b4cb50ebaa1cf9105a7b397', 'canonical English is unchanged');
  lastSignature = signature;
}
export function precisionNativeBefore<T>(language: 'zu' | 've', actual: T): T {
  ensurePrecisionCurrent();
  // A higher historical layer may already have projected this exact complete
  // predecessor. Partial or mutated projections still fail the full comparison.
  if (JSON.stringify(actual) === JSON.stringify(precisionBefore[language])) return structuredClone(actual);
  assert.deepEqual(actual, precisionAfter[language], language + ': complete latest precision registry');
  return structuredClone(precisionBefore[language]);
}
export function precisionSourceBytesBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  const proof = precisionPlan.files[file];
  if (!proof) return bytes;
  ensurePrecisionCurrent();
  const text = Buffer.from(bytes).toString();
  if (text === proof.before) return bytes;
  assert.equal(text, proof.after, file + ': caller supplies complete accepted precision bytes');
  return proof.before;
}
