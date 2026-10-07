import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mapSourceBefore, mapNativeBefore } from './reading-map-comparisons-history-checks.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';

// Later ordinary wording must preserve every unlisted byte before dated tests
// reconstruct their older claims. Never project an arbitrary changed registry.
const folder = 'docs/study-translation-reviews/reading-comparisons-2026-10-07/';
const hashes: Record<string, string> = {
  'reading-l3-hold-metadata-repairs.json': 'd41a5e0087da12ec6848ae25eae3a2400e42bc59084b402249e434577bced88e',
  'reading-l3-fuller-candidates.json': 'b02a4bc4b6ec2cfb295ed0cd4e5849994ddf0ab1a6605fef538b6c21ece261b3',
  'reading-l3-exact-file-snapshots.json': '249265b3b2c1517b1776a2d1eaf5045fec5f78279120f6692c00f7433da4e6a7',
  'reading-l3-native-snapshots.json': '53e6a2e46509232888ae02d1f7a0c15f79b9a6c60a1f84e610c39f0d2333d939',
};
const read = (name: string) => {
  const bytes = readFileSync(folder + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[name]);
  return JSON.parse(bytes.toString());
};
export const comparisonsPlan = read('reading-l3-fuller-candidates.json');
export const comparisonsFiles = read('reading-l3-exact-file-snapshots.json');
export const comparisonsNative = read('reading-l3-native-snapshots.json');
const metadataRepairs = read('reading-l3-hold-metadata-repairs.json');
assert.equal(comparisonsPlan.candidates.length, 11);
assert.equal(comparisonsPlan.fluentApproval, false);
const source = COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === 'reading-landscape-l3')!;
assert.deepEqual(source, comparisonsPlan.sourceEnglish);
for (const [file, proof] of Object.entries(comparisonsFiles) as [string, any][]) {
  const language = file.endsWith('drafts.ts') ? 'zu' : file.includes('-ve-') ? 've' : 'ts';
  let expected = proof.before;
  for (const row of comparisonsPlan.candidates.filter((r: any) => r.language === language)) {
    const before = JSON.stringify(row.before).slice(1, -1);
    const after = JSON.stringify(row.candidate).slice(1, -1);
    assert.equal(expected.split(before).length - 1, 1);
    expected = expected.replace(before, after);
  }
  for (const row of metadataRepairs.filter((r: any) => r.path === file)) {
    assert.equal(expected.split(row.before).length - 1, 1);
    expected = expected.replace(row.before, row.after);
  }
  assert.equal(expected, proof.after, file + ': only eleven accepted learner leaves and three obsolete hold claims change');
}
let signature = '';
export function ensureComparisonsCurrent() {
  const current = Object.keys(comparisonsFiles).map(file => {
    const s = statSync(file, { bigint: true });
    return [file, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
  }).join('|');
  if (current === signature) return;
  for (const [file, proof] of Object.entries(comparisonsFiles) as [string, any][]) {
    assert.equal(mapSourceBefore(file, readFileSync(file, 'utf8')), proof.after, file + ': entire current file');
  }
  signature = current;
}
export function comparisonsSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  const proof = comparisonsFiles[file];
  if (!proof) return mapSourceBefore(file, bytes);
  ensureComparisonsCurrent();
  const text = Buffer.from(bytes).toString();
  if (text === proof.before) return bytes;
  assert.equal(Buffer.from(mapSourceBefore(file, bytes)).toString(), proof.after, file + ': supplied complete accepted bytes');
  return proof.before;
}
export function comparisonsNativeBefore<T>(language: 'zu' | 've' | 'ts', value: T): T {
  ensureComparisonsCurrent();
  if (JSON.stringify(value) === JSON.stringify(comparisonsNative.before[language])) return structuredClone(value);
  value = mapNativeBefore(language, value);
  assert.deepEqual(value, comparisonsNative.after[language], 'complete Reading comparisons registry');
  return structuredClone(comparisonsNative.before[language]);
}
export function comparisonsPresentationBefore<T extends { status: string; content: any }>(value: T, lessonId: string, language: string): T {
  const rows = comparisonsPlan.candidates.filter((r: any) => r.language === language && r.lessonId === lessonId);
  if (!rows.length || value.status !== 'draft') return value;
  ensureComparisonsCurrent();
  const native = language === 'zu' ? comparisonsNative.after.zu[lessonId]
    : comparisonsNative.after[language].lessons.find((l: any) => l.id === lessonId);
  const key = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  const text = (p: any) => p.reviewStatus === 'hold' ? p.sourceEnglish : p[key];
  const expected = language === 'zu' ? {
    title: native.title, body: native.body, keyPoints: native.keyPoints,
    quiz: native.quiz, infographicAlt: native.infographicAlt,
  } : {
    title: text(native.title), body: text(native.body), keyPoints: native.keyPoints.map(text),
    quiz: native.quiz.map((q: any) => ({ q: text(q.question), options: q.options.map(text), correct: q.sourceCorrectIndex, rationale: text(q.rationale) })),
    infographicAlt: text(native.infographicAlt),
  };
  assert.deepEqual(value.content, expected, 'complete current Reading presentation before historical projection');
  const restored = structuredClone(value);
  for (const row of rows) {
    const parts = row.field.split('.');
    if (parts[0] === 'body') {
      const paragraphs = restored.content.body.split('\n\n');
      const index = Number(parts[1].replace('paragraph', ''));
      assert.equal(paragraphs[index], row.candidate);
      paragraphs[index] = row.before;
      restored.content.body = paragraphs.join('\n\n');
    } else if (parts[0] === 'infographicAlt') restored.content.infographicAlt = row.before;
    else if (parts[2] === 'options') restored.content.quiz[Number(parts[1])].options[Number(parts[3])] = row.before;
    else restored.content.quiz[Number(parts[1])].rationale = row.before;
  }
  return restored;
}
