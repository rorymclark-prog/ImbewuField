import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildNurseryReviewData, type NurseryReviewInputs, type NurseryReviewLocale } from '../lib/international/locales/nursery-field-planting-review.ts';

const locales = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id'] as const;
const form = 'components/crops/NurseryFieldPlantingObservationForm.tsx';
const summary = 'components/journal/JournalNurseryFieldPlantingSummary.tsx';
const panel = 'components/crops/SavedGrowerNurseryReviewPanel.tsx';
const paths = [form, summary, panel];
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const folder = 'lib/international/locales/nursery-field-planting-drafts';
const sourceText = read(`${folder}/source.json`);
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
interface Message { key: string; english: string; messageSha256: string; translation: string; [key: string]: unknown }
interface Packet { locale: string; sourceSha256: string; status: string; runtimeActivation: boolean; messages: Message[]; [key: string]: unknown }
const frozen = JSON.parse(sourceText) as { sourceFiles: { path: string; sha256: string }[];
  messages: { key: string; english: string; messageSha256: string }[] };
function input(): NurseryReviewInputs {
  return { sourceText, currentSources: Object.fromEntries(paths.map(path => [path, read(path)])),
    packets: Object.fromEntries(locales.map(locale => [locale, read(`${folder}/${locale}.json`)])) };
}
function packet(): Packet { return JSON.parse(read(`${folder}/fr.json`)) as Packet; }
function resultFor(text: string | undefined) {
  const value = input();
  return buildNurseryReviewData({ ...value, packets: { ...value.packets, fr: text } });
}
function language(data: ReturnType<typeof buildNurseryReviewData>, locale: NurseryReviewLocale = 'fr') {
  const value = data.languages.find(row => row.locale === locale);
  assert.ok(value, `Comparison for ${locale} must remain visible`);
  return value;
}
function packetHeld(data: ReturnType<typeof buildNurseryReviewData>) {
  assert.equal(data.issue, null);
  assert.equal(language(data).rows.length, 26);
  for (const row of language(data).rows) {
    assert.equal(row.state, 'invalid', row.key);
    assert.equal(row.translation, null, row.key);
    assert.ok(row.issues.length, row.key);
  }
  // One damaged language cannot withdraw independent, correctly paired packets.
  for (const row of language(data, 'es').rows) assert.equal(row.state, 'draft');
}

test('the actual seven inactive packets expose 182 paired drafts and never grant human review', () => {
  const value = input(), before = structuredClone(value), data = buildNurseryReviewData(value);
  assert.equal(data.issue, null);
  assert.equal(data.sourceSha256, sha(sourceText));
  assert.deepEqual(data.languages.map(row => row.locale), locales);
  assert.deepEqual(Object.fromEntries(data.sources.map(row => [row.path, row.status])), Object.fromEntries(paths.map(path => [path, 'matched'])));
  assert.equal(frozen.messages.length, 26);
  assert.equal(data.languages.flatMap(row => row.rows).length, 182);
  for (const file of frozen.sourceFiles) assert.equal(sha(value.currentSources[file.path]!), file.sha256, file.path);
  for (const entry of data.languages) {
    const actual = JSON.parse(value.packets[entry.locale]!) as Packet;
    assert.equal(actual.status, 'unreviewed-ai-draft'); assert.equal(actual.runtimeActivation, false);
    assert.equal(actual.sourceSha256, sha(sourceText));
    assert.deepEqual(entry.rows.map(row => row.key), frozen.messages.map(row => row.key));
    for (const [index, row] of entry.rows.entries()) {
      assert.equal(actual.messages[index].messageSha256, sha(frozen.messages[index].english));
      assert.equal(row.frozenEnglish, frozen.messages[index].english);
      assert.equal(row.currentEnglish, frozen.messages[index].english);
      assert.equal(row.translation, actual.messages[index].translation);
      assert.equal(row.state, 'draft', `${entry.locale}: ${row.key}`);
      assert.deepEqual(row.issues, []);
    }
  }
  assert.deepEqual(value, before, 'Reviewing must not rewrite packets or source text');
});

test('every frozen phrase belongs to its actual component, including action 26 in the saved-batch panel', () => {
  const value = input(), rows = language(buildNurseryReviewData(value)).rows;
  for (const [index, row] of rows.entries()) {
    // This is the bounded frozen extraction: 16 form phrases, 9 historical
    // summary phrases and the real opening action in the saved-batch panel.
    const owner = index < 16 ? form : index < 25 ? summary : panel;
    assert.equal(row.sourceFile, owner, row.key);
    assert.ok(compact(value.currentSources[owner]!).includes(compact(row.frozenEnglish)), `${row.key}: missing actual component text`);
  }
  assert.equal(rows[25].key, 'nurseryFieldPlanting.message.26');
  assert.equal(rows[25].frozenEnglish, 'Record field planting');
  assert.match(value.currentSources[panel]!, />Record field planting<\/button>/);
});

for (const path of paths) for (const change of ['missing', 'changed'] as const) {
  test(`${change} ${path} withdraws only its original rows, including unchanged phrases in a changed file`, () => {
    const value = input();
    // Whole-file fingerprints deliberately invalidate even a comment-only edit:
    // this reader does not claim to re-extract or approve changed JSX fragments.
    const currentSources = { ...value.currentSources, [path]: change === 'missing' ? undefined : `${value.currentSources[path]}\n// Changed source fixture\n` };
    const data = buildNurseryReviewData({ ...value, currentSources });
    assert.equal(data.issue, null);
    assert.equal(data.sources.find(row => row.path === path)?.status, change === 'missing' ? 'unavailable' : 'changed');
    for (const row of data.languages.flatMap(entry => entry.rows)) {
      assert.equal(row.state, row.sourceFile === path ? 'source-missing' : 'draft', row.key);
      assert.equal(row.currentEnglish, row.sourceFile === path ? null : row.frozenEnglish, row.key);
      if (row.sourceFile === path) assert.ok(row.issues.length);
    }
  });
}

test('text in an unrelated file cannot substitute for the original component or spoof its matched fingerprint', () => {
  const value = input();
  const data = buildNurseryReviewData({ ...value, currentSources: { ...value.currentSources,
    [panel]: value.currentSources[form], 'unrelated.tsx': value.currentSources[panel] } });
  assert.equal(data.sources.find(row => row.path === panel)?.status, 'changed');
  const row = language(data).rows.find(row => row.key === 'nurseryFieldPlanting.message.26')!;
  assert.equal(row.state, 'source-missing'); assert.equal(row.currentEnglish, null);
  assert.equal(language(data).rows[0].state, 'draft');
});

for (const damage of ['missing', 'malformed-json', 'changed-english', 'reformatted-bytes'] as const) {
  test(`${damage} frozen English cannot certify any translation, even with a recomputed message hash`, () => {
    const value = input(), source = JSON.parse(sourceText);
    source.messages[0].english += ' Changed instruction.';
    source.messages[0].messageSha256 = sha(source.messages[0].english);
    const damaged = damage === 'missing' ? undefined : damage === 'malformed-json' ? '{'
      : damage === 'changed-english' ? JSON.stringify(source) : JSON.stringify(JSON.parse(sourceText));
    const data = buildNurseryReviewData({ ...value, sourceText: damaged });
    assert.ok(data.issue); assert.deepEqual(data.languages, []);
  });
}

const packetFaults: Array<[string, (value: Packet) => void]> = [
  ['duplicate key', value => { value.messages[1] = structuredClone(value.messages[0]); }],
  ['reordered keys', value => { [value.messages[0], value.messages[1]] = [value.messages[1], value.messages[0]]; }],
  ['missing row', value => { value.messages.pop(); }],
  ['changed English', value => { value.messages[0].english += ' Changed'; value.messages[0].messageSha256 = sha(value.messages[0].english); }],
  ['changed message hash', value => { value.messages[0].messageSha256 = '0'.repeat(64); }],
  ['changed source hash', value => { value.sourceSha256 = '0'.repeat(64); }],
  ['different locale', value => { value.locale = 'es'; }],
  ['runtime activation', value => { value.runtimeActivation = true; }],
  ['claimed reviewed status', value => { value.status = 'human-reviewed'; }],
  ['forged packet review', value => { value.review = { status: 'human-reviewed', reviewer: 'Synthetic reviewer', reviewedOn: '2026-11-05' }; }],
  ['forged message review', value => { value.messages[0].review = { status: 'human-reviewed', sourceEnglish: value.messages[0].english, draftText: value.messages[0].translation }; }],
];
for (const [name, damage] of packetFaults) test(`${name} cannot turn an imported packet into admitted or reviewed translations`, () => {
  const value = packet(); damage(value); packetHeld(resultFor(JSON.stringify(value)));
});
for (const [name, text] of [['missing', undefined], ['malformed JSON', '{'], ['array instead of packet', '[]']] as const) {
  test(`${name} packet stays visibly invalid while other languages remain drafts`, () => packetHeld(resultFor(text)));
}

test('generic Portuguese cannot silently stand in for the Brazilian Portuguese packet', () => {
  const value = input(), { 'pt-BR': brazil, ...remaining } = value.packets;
  assert.ok(brazil);
  const data = buildNurseryReviewData({ ...value, packets: { ...remaining, ...{ pt: brazil } } });
  for (const row of language(data, 'pt-BR').rows) { assert.equal(row.state, 'invalid'); assert.equal(row.translation, null); }
  const renamed = JSON.parse(brazil) as Packet; renamed.locale = 'pt';
  const badLocale = buildNurseryReviewData({ ...value, packets: { ...value.packets, 'pt-BR': JSON.stringify(renamed) } });
  for (const row of language(badLocale, 'pt-BR').rows) assert.equal(row.state, 'invalid');
});

for (const [key, literal] of [['nurseryFieldPlanting.message.06', 'DEMO'], ['nurseryFieldPlanting.message.04', 'UTC'], ['nurseryFieldPlanting.message.11', '0']] as const) {
  test(`removing protected ${literal} cannot admit a translation that changes sample, date or explicit-zero meaning`, () => {
    const value = packet(), row = value.messages.find(row => row.key === key)!;
    assert.ok(row.translation.includes(literal)); row.translation = row.translation.replace(literal, '');
    packetHeld(resultFor(JSON.stringify(value)));
  });
}

test('numeric placeholder syntax also introduces a protected zero and withdraws the entire packet', () => {
  const value = packet(); value.messages[0].translation = 'Synthetic {0}';
  // This source has no ASCII zero: adding one changes the protected-literal
  // binding for the packet, in addition to using unsupported placeholder syntax.
  packetHeld(resultFor(JSON.stringify(value)));
});

for (const text of ['', '   ', 'Synthetic {crop}', 'Synthetic {', 'Synthetic }', 'Synthetic {{crop}}']) {
  test(`blank or unsupported interpolation ${JSON.stringify(text)} cannot become a usable draft`, () => {
    const value = packet(); value.messages[0].translation = text;
    const data = resultFor(JSON.stringify(value)), row = language(data).rows[0];
    assert.equal(row.state, 'invalid'); assert.ok(row.issues.length);
    assert.equal(language(data).rows[1].state, 'draft');
    assert.equal(data.languages.flatMap(entry => entry.rows).some(row => row.state === 'reviewed'), false);
  });
}
