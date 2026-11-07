import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildLearningRegionReviewData, type LearningReviewInputs } from '../lib/international/locales/learning-region-review.ts';
import { LEARNING_REGION_REVIEW_SOURCE as binding, LEARNING_REGION_REVIEW_LOCALES } from '../lib/international/locales/learning-region-review-source.ts';
import { loadLearningRegionReviewData } from '../lib/international/locales/learning-region-review-server.ts';
import { readCurrentBoundSourceNodes, type BoundSourceNode } from '../lib/international/locales/source-reader.ts';
import { learningRegionReviewCsv } from '../lib/international/locales/learning-region-review-csv.ts';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const packetRoot = 'lib/international/locales/learning-region-drafts';
const sourceText = read(`${packetRoot}/source.json`), component = read(binding.sourceFile), frozen = JSON.parse(sourceText);
const inputs = (): LearningReviewInputs => ({ sourceText, currentSourceText: component,
  packets: Object.fromEntries(LEARNING_REGION_REVIEW_LOCALES.map(locale => [locale, read(`${packetRoot}/${locale}.json`)])) });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
type Mutable<T> = { -readonly [P in keyof T]: T[P] };
const nodes = (): Record<string, Mutable<BoundSourceNode>> => Object.fromEntries(frozen.messages.map((row: any) => [row.key, { ...row.bindings[0], english: row.english }]));

// These are actual inactive packets and current source. Tests establish structure
// and evidence withdrawal, never fluent language or local curriculum approval.
test('eleven exact packets bind 286 unreviewed AI phrases and 22 separate fixed copies without inventing a Git anchor', () => {
  const data = loadLearningRegionReviewData(); assert.equal(data.issue, null); assert.equal(data.source.status, 'matched');
  assert.equal(data.sourceCommit, null); assert.equal(data.sourceSha256, binding.sourceSha256);
  assert.equal(hash(sourceText), binding.sourceSha256); assert.equal(hash(component), binding.sourceFileSha256);
  assert.deepEqual(data.languages.map(row => row.locale), [...LEARNING_REGION_REVIEW_LOCALES]);
  assert.equal(data.languages.flatMap(row => row.rows).length, 308);
  for (const language of data.languages) {
    assert.equal(language.packetStatus, 'valid'); assert.equal(language.issue, null);
    assert.equal(language.rows.filter(row => row.kind === 'ai-draft').length, 26);
    assert.equal(language.rows.filter(row => row.state === 'draft').length, 26);
    assert.equal(language.rows.filter(row => row.kind === 'fixed-literal').length, 2);
    assert.equal(language.rows.filter(row => row.state === 'fixed-literal').length, 2);
    assert.equal(language.rows.filter(row => row.fragment).length, 13);
    assert.equal(language.rows.some(row => row.state === 'reviewed'), false);
    for (let index = 0; index < language.rows.length; index++) {
      const { kind, currentEnglish, translation, state, issues, ...metadata } = language.rows[index];
      assert.deepEqual(metadata, frozen.messages[index]); assert.equal(currentEnglish, metadata.english);
      assert.ok(translation); assert.deepEqual(issues, []);
    }
    assert.equal(language.rows[13].translation, '.'); assert.equal(language.rows[20].translation, 'DEMO · ');
    assert.match(language.rows[22].translation!, /\n {8}$/);
  }
});

test('the AST reader independently locates all complete nodes, including raw JSX whitespace and decoded string literals', () => {
  const current = readCurrentBoundSourceNodes(component, nodes());
  assert.deepEqual(Object.values(current), frozen.messages.map((row: any) => row.english));
  assert.equal(current.learningRegionUi023, 'Saved site (optional)\n        ');
  assert.equal(current.learningRegionUi012, 'Unknown'); assert.equal(current.learningRegionUi021, 'DEMO · ');
});

for (const condition of ['unavailable', 'changed', 'malformed'] as const) test(`${condition} deployment source never presents frozen English as current`, () => {
  const input = inputs(); input.currentSourceText = condition === 'unavailable' ? undefined
    : condition === 'changed' ? component.replace('South African source material.', 'Changed current source material.') : component + '\nfunction {';
  const data = buildLearningRegionReviewData(input); assert.equal(data.issue, null);
  assert.equal(data.source.status, condition === 'unavailable' ? 'unavailable' : 'changed');
  for (const language of data.languages) for (const row of language.rows) {
    assert.equal(row.currentEnglish, null); assert.equal(row.state, condition === 'unavailable' ? 'source-missing' : 'stale');
    assert.ok(row.english); assert.ok(row.issues.length); assert.notEqual(row.state, 'reviewed');
  }
});

for (const condition of ['missing', 'malformed', 'duplicate-json-key', 'english-and-hash', 'metadata', 'order'] as const) test(`a ${condition} frozen source packet holds every comparison`, () => {
  const input = inputs(), source = JSON.parse(sourceText);
  if (condition === 'missing') input.sourceText = undefined;
  if (condition === 'malformed') input.sourceText = '{';
  if (condition === 'duplicate-json-key') input.sourceText = sourceText.replace('"schemaVersion": 1,', '"schemaVersion": 1, "schemaVersion": 1,');
  if (condition === 'english-and-hash') { source.messages[0].english = 'Changed snapshot'; source.messages[0].sha256 = hash(source.messages[0].english); input.sourceText = JSON.stringify(source); }
  if (condition === 'metadata') { source.messages[22].contextNote = 'Different context'; input.sourceText = JSON.stringify(source); }
  if (condition === 'order') { source.messages.reverse(); input.sourceText = JSON.stringify(source); }
  const data = buildLearningRegionReviewData(input); assert.ok(data.issue); assert.deepEqual(data.languages, []);
  assert.equal(data.source.status, 'invalid', 'a matching component hash alone does not verify a missing or damaged AST packet');
});

test('a missing packet stays missing for its own locale while other exact packets remain available', () => {
  const input = inputs(); input.packets = { ...input.packets, fr: undefined }; const data = buildLearningRegionReviewData(input);
  const absent = data.languages.find(row => row.locale === 'fr')!; assert.equal(absent.packetStatus, 'missing');
  assert.ok(absent.rows.every(row => row.translation === null && row.state === 'missing'));
  assert.equal(data.languages.find(row => row.locale === 'es')!.packetStatus, 'valid');
});

const damages: Record<string, (packet: any) => void> = {
  'wrong locale': packet => { packet.locale = 'es'; },
  'wrong source hash': packet => { packet.sourceSha256 = '0'.repeat(64); },
  'invented Git anchor': packet => { packet.sourceCommit = 'a'.repeat(40); },
  'runtime activation': packet => { packet.runtimeActivation = true; },
  'human approval': packet => { packet.humanReview = true; },
  'reviewed state': packet => { packet.reviewStatus = 'human-reviewed'; },
  'extra root field': packet => { packet.approved = true; },
  'missing row': packet => { packet.messages.pop(); },
  'duplicate row': packet => { packet.messages[1] = packet.messages[0]; },
  'key order': packet => { [packet.messages[0], packet.messages[1]] = [packet.messages[1], packet.messages[0]]; },
  'English with matching new hash': packet => { packet.messages[0].english = 'Other English'; packet.messages[0].sha256 = hash('Other English'); },
  'changed context': packet => { packet.messages[0].contextNote = 'Other context'; },
  'fragment flag': packet => { packet.messages[1].fragment = false; },
  'context-required flag': packet => { packet.messages[1].contextRequired = false; },
  'AST selector': packet => { packet.messages[0].bindings[0].selector += '/forEachChild[0]:JsxText'; },
  'AST byte offset': packet => { packet.messages[0].bindings[0].startByte++; },
  'raw JSX source': packet => { packet.messages[0].bindings[0].rawSource += ' '; },
  'extra native review metadata': packet => { packet.messages[0].review = { status: 'human-reviewed', reviewer: 'Engineering fixture' }; },
  'text type': packet => { packet.messages[0].translation = 0; },
  'empty text': packet => { packet.messages[0].translation = ''; },
  'invented numeric token': packet => { packet.messages[0].translation += ' 12'; },
  'invented placeholder': packet => { packet.messages[0].translation += ' {name}'; },
  'fixed period': packet => { packet.messages[13].translation = '。'; },
  'DEMO drift': packet => { packet.messages[20].translation = 'DEMO'; },
  'lost trailing whitespace': packet => { packet.messages[22].translation = packet.messages[22].translation.trimEnd(); },
  'lost leading fragment space': packet => { packet.messages[9].translation = packet.messages[9].translation.trimStart(); },
  'changed fragment punctuation': packet => { packet.messages[9].translation = packet.messages[9].translation.replace(/\.$/, '!'); },
  'campaign counts': packet => { packet.counts.aiDraftPairs++; },
};
for (const [name, damage] of Object.entries(damages)) test(`${name} rejects the whole packet without borrowing an older draft or review grant`, () => {
  const input = inputs(), packet = JSON.parse(input.packets.fr!); damage(packet); input.packets = { ...input.packets, fr: JSON.stringify(packet) };
  const data = buildLearningRegionReviewData(input), invalid = data.languages.find(row => row.locale === 'fr')!;
  assert.equal(invalid.packetStatus, 'invalid'); assert.ok(invalid.issue);
  assert.equal(invalid.rows.length, 28); assert.ok(invalid.rows.every(row => row.translation === null && row.state === 'invalid'));
  assert.equal(data.languages.find(row => row.locale === 'es')!.packetStatus, 'valid');
});
for (const text of ['{', read(`${packetRoot}/fr.json`).replace('"locale": "fr",', '"locale": "fr", "locale": "fr",')]) test('malformed or duplicate-key JSON is visibly invalid rather than normalized into a valid draft', () => {
  const input = inputs(); input.packets = { ...input.packets, fr: text }; const language = buildLearningRegionReviewData(input).languages[0];
  assert.equal(language.packetStatus, 'invalid'); assert.ok(language.rows.every(row => row.translation === null));
});

const nodeDamages: Record<string, (binding: Mutable<BoundSourceNode>) => void> = {
  selector: node => { node.selector += '/forEachChild[99]:JsxText'; },
  kind: node => { node.nodeKind = 'StringLiteral'; },
  'UTF16 start': node => { node.startUtf16++; },
  'UTF16 end': node => { node.endUtf16--; },
  'byte start': node => { node.startByte++; },
  'byte end': node => { node.endByte--; },
  'line': node => { node.line++; },
  'column': node => { node.column++; },
  raw: node => { node.rawSource += ' '; },
  decoded: node => { node.english += ' '; },
};
for (const [name, damage] of Object.entries(nodeDamages)) test(`the bound reader rejects a ${name} mismatch without using a matching substring`, () => {
  const map = nodes(), key = 'learningRegionUi023'; damage(map[key]); const result = readCurrentBoundSourceNodes(component, map);
  assert.equal(result[key], undefined); assert.equal(result.learningRegionUi001, frozen.messages[0].english);
});
test('duplicate selectors, parse errors and UTF16 offsets substituted for UTF8 byte offsets cannot certify a source node', () => {
  const duplicate = nodes(); duplicate.learningRegionUi002 = { ...duplicate.learningRegionUi001 };
  assert.ok(Object.values(readCurrentBoundSourceNodes(component, duplicate)).every(value => value === undefined));
  assert.ok(Object.values(readCurrentBoundSourceNodes(component + '\nfunction {', nodes())).every(value => value === undefined));
  const map = nodes(), key = Object.keys(map).find(key => map[key].startByte !== map[key].startUtf16)!; assert.ok(key);
  map[key].startByte = map[key].startUtf16; assert.equal(readCurrentBoundSourceNodes(component, map)[key], undefined);
  const whitespace = nodes(); whitespace.learningRegionUi023.english = whitespace.learningRegionUi023.english.trimEnd();
  assert.equal(readCurrentBoundSourceNodes(component, whitespace).learningRegionUi023, undefined);
});

function csvRows(csv: string): string[][] {
  assert.equal(csv[0], '\uFEFF'); const rows: string[][] = []; let cells: string[] = [], value = '', quoted = false;
  for (let index = 1; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { cells.push(value); value = ''; }
    else if (!quoted && char === '\r' && csv[index + 1] === '\n') { cells.push(value); rows.push(cells); cells = []; value = ''; index++; }
    else value += char;
  }
  assert.equal(quoted, false); assert.equal(value, ''); assert.deepEqual(cells, []); return rows;
}
test('the CSV keeps all context/AST bindings, raw fragment whitespace and separate fixed authorship with blank reviewer fields', () => {
  const language = loadLearningRegionReviewData().languages[0], before = structuredClone(language.rows);
  const table = csvRows(learningRegionReviewCsv(language.locale, language.rows)); assert.equal(table.length, 29);
  for (let index = 0; index < language.rows.length; index++) {
    const row = language.rows[index], exported = table[index + 1]; assert.equal(exported.length, 16);
    assert.equal(exported[4], row.english); assert.equal(exported[5], row.currentEnglish);
    assert.equal(exported[6], row.translation); assert.equal(exported[10], row.contextNote); assert.deepEqual(JSON.parse(exported[12]), row.bindings);
    assert.equal(exported[13], 'Not recorded'); assert.equal(exported[14], ''); assert.equal(exported[15], '');
    assert.match(exported[2], row.kind === 'fixed-literal' ? /not an AI-authored translation/ : /Unreviewed AI draft/);
  }
  assert.equal(table[23][4], 'Saved site (optional)\n        '); assert.deepEqual(language.rows, before);
});
for (const value of ['=1+1', '+SUM(1,2)', '-1', '@SUM(1,2)', ' \t=HYPERLINK("https://example.invalid")', '\tordinary', '\nline']) test(`CSV formula protection keeps ${JSON.stringify(value)} export-only`, () => {
  const original = loadLearningRegionReviewData().languages[0].rows[0];
  const row = { ...original, key: value, english: value, currentEnglish: value, translation: value, contextNote: value,
    bindings: [{ ...original.bindings[0], file: value as typeof original.bindings[0]['file'] }] };
  const exported = csvRows(learningRegionReviewCsv('fr', [row]))[1];
  for (const index of [1, 3, 4, 5, 6, 10]) assert.equal(exported[index], "'" + value);
  assert.equal(row.translation, value);
});
test('unknown English stays blank in CSV and a supplied reviewed state cannot create an approval', () => {
  const row = { ...loadLearningRegionReviewData().languages[0].rows[0], currentEnglish: null, state: 'reviewed' as const };
  const exported = csvRows(learningRegionReviewCsv('fr', [row]))[1]; assert.equal(exported[5], ''); assert.equal(exported[7], 'needs-review');
  assert.equal(exported[13], 'Not recorded'); assert.deepEqual(exported.slice(14), ['', '']);
});
test('the server reads exactly twelve public packets and the one current component; missing deployment source remains unknown', () => {
  const paths: string[] = [];
  const data = loadLearningRegionReviewData(path => { paths.push(path); if (path === binding.sourceFile) throw Error('Deployment source absent'); return read(path); });
  assert.deepEqual(paths, [`${packetRoot}/source.json`, binding.sourceFile, ...LEARNING_REGION_REVIEW_LOCALES.map(locale => `${packetRoot}/${locale}.json`)]);
  assert.equal(data.source.status, 'unavailable'); assert.ok(data.languages.every(language => language.rows.every(row => row.currentEnglish === null)));
});
