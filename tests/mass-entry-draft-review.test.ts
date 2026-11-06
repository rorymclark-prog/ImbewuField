import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildMassEntryReviewData, MASS_ENTRY_REVIEW_LOCALES, type MassEntryReviewInputs,
  type MassEntryReviewLocale } from '../lib/international/locales/mass-entry-review.ts';
import { loadMassEntryReviewData } from '../lib/international/locales/mass-entry-review-server.ts';

const originalLocales = ['fr', 'es', 'pt-BR', 'sw'] as const;
const asiaLocales = ['hi', 'bn', 'id'] as const;
// Three more inactive packets now share the original twelve-message source.
// Expand the advertised comparison while retaining explicit FRES48 coverage;
// the frozen source's historical four-locale metadata must remain unchanged.
const locales = [...originalLocales, ...asiaLocales] as const;
const field = 'components/crops/GrowerEnteredMassField.ts';
const intent = 'components/crops/GrowerCycleIntent.ts';
const release = 'lib/release-notes.ts';
const paths = [field, intent, release];
const folder = 'lib/international/locales/mass-entry-drafts';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sourceText = read(`${folder}/source.json`);
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
interface FrozenMessage { key: string; english: string; sha256: string }
interface Message extends FrozenMessage { translation: string; [key: string]: unknown }
interface Packet { locale: string; sourceSha256: string; reviewStatus: string; runtimeActivation: boolean; messages: Message[]; [key: string]: unknown }
const frozen = JSON.parse(sourceText) as { messages: FrozenMessage[]; locales: string[];
  sourceFiles: { file: string; sha256: string }[] };
function input(): MassEntryReviewInputs {
  return { sourceText, currentSources: Object.fromEntries(paths.map(path => [path, read(path)])),
    packets: Object.fromEntries(locales.map(locale => [locale, read(`${folder}/${locale}.json`)])) };
}
function language(data: ReturnType<typeof buildMassEntryReviewData>, locale: MassEntryReviewLocale = 'fr') {
  const value = data.languages.find(row => row.locale === locale);
  assert.ok(value, `${locale} comparison must remain visible even when its packet holds`);
  return value;
}
function packet(): Packet { return JSON.parse(read(`${folder}/fr.json`)) as Packet; }
function packetResult(text: string | undefined) {
  const value = input(); return buildMassEntryReviewData({ ...value, packets: { ...value.packets, fr: text } });
}
function packetHeld(data: ReturnType<typeof buildMassEntryReviewData>) {
  assert.equal(data.issue, null);
  assert.equal(language(data).rows.length, 12);
  for (const row of language(data).rows) {
    assert.equal(row.state, 'invalid', row.key); assert.equal(row.translation, null, row.key); assert.ok(row.issues.length, row.key);
  }
  for (const row of language(data, 'es').rows) assert.equal(row.state, 'draft', row.key);
  for (const entry of data.languages.filter(entry => entry.locale !== 'fr')) {
    for (const row of entry.rows) assert.equal(row.state, 'draft', `${entry.locale}: ${row.key}`);
  }
}

test('the actual current mass sources and seven exact inactive packets expose 84 unreviewed pairs without rewriting them', () => {
  const value = input(), before = structuredClone(value), data = buildMassEntryReviewData(value);
  assert.deepEqual(MASS_ENTRY_REVIEW_LOCALES, locales);
  assert.equal(data.issue, null); assert.equal(data.sourceSha256, sha(sourceText));
  assert.deepEqual(data.languages.map(row => row.locale), locales);
  assert.equal(frozen.messages.length, 12); assert.equal(data.languages.flatMap(row => row.rows).length, 84);
  assert.deepEqual(frozen.locales, originalLocales, 'historical capture metadata is not rewritten to advertise later draft packets');
  assert.equal(sha(sourceText), 'd04df52e04b97ea0f72bea9c45b33081152c9ea293dd0dedd4f49e9e27f0edc5');
  const original = data.languages.filter(entry => originalLocales.some(locale => locale === entry.locale));
  const added = data.languages.filter(entry => asiaLocales.some(locale => locale === entry.locale));
  assert.deepEqual(original.map(entry => entry.locale), originalLocales);
  assert.equal(original.flatMap(entry => entry.rows).length, 48);
  assert.deepEqual(added.map(entry => entry.locale), asiaLocales);
  assert.equal(added.flatMap(entry => entry.rows).length, 36);
  for (const captured of frozen.sourceFiles) {
    const source = data.sources.find(row => row.path === captured.file); assert.ok(source);
    assert.equal(source.capturedSha256, captured.sha256);
    assert.equal(source.currentSha256, sha(value.currentSources[captured.file]!));
    assert.equal(source.status, source.currentSha256 === source.capturedSha256 ? 'matched' : 'changed');
  }
  const route = data.sources.find(row => row.path === release); assert.ok(route);
  assert.equal(route.status, 'available'); assert.equal(route.currentSha256, sha(value.currentSources[release]!));
  for (const entry of data.languages) {
    const actual = JSON.parse(value.packets[entry.locale]!) as Packet;
    assert.equal(actual.reviewStatus, 'unreviewed-ai-draft'); assert.equal(actual.runtimeActivation, false);
    assert.equal(actual.sourceSha256, sha(sourceText));
    assert.deepEqual(entry.rows.map(row => row.key), frozen.messages.map(row => row.key));
    for (const [index, row] of entry.rows.entries()) {
      assert.equal(actual.messages[index].sha256, sha(actual.messages[index].english));
      assert.equal(row.frozenEnglish, frozen.messages[index].english); assert.equal(row.currentEnglish, frozen.messages[index].english);
      assert.equal(row.translation, actual.messages[index].translation); assert.equal(row.state, 'draft', row.key);
      assert.equal(row.sourceFile, index < 5 ? field : index < 11 ? intent : release, row.key);
      assert.equal(row.issues.some(issue => /human.reviewed|approved by/i.test(issue)), false);
    }
  }
  assert.deepEqual(value, before);
});

test('the named server loader reads actual current source and packet files rather than treating frozen English as live input', () => {
  assert.deepEqual(loadMassEntryReviewData(), buildMassEntryReviewData(input()));
});

for (const path of paths) test(`missing actual ${path} withdraws only its current English instead of borrowing the frozen snapshot`, () => {
  const value = input(), data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [path]: undefined } });
  assert.equal(data.sources.find(row => row.path === path)?.status, 'unavailable');
  for (const row of data.languages.flatMap(entry => entry.rows)) {
    assert.equal(row.currentEnglish, row.sourceFile === path ? null : row.frozenEnglish);
    assert.equal(row.state, row.sourceFile === path ? 'source-missing' : 'draft', row.key);
    if (row.sourceFile === path) assert.ok(row.issues.length);
  }
});

test('actual changed literal is returned as current English and marks its frozen translation stale', () => {
  const value = input(), current = value.currentSources[field]!;
  assert.ok(current.includes("'Kilograms (kg)'"));
  const changed = current.replace("'Kilograms (kg)'", "'Changed kilogram wording (kg)'");
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
  const row = language(data).rows[0];
  assert.equal(row.currentEnglish, 'Changed kilogram wording (kg)'); assert.equal(row.frozenEnglish, 'Kilograms (kg)');
  assert.equal(row.state, 'stale'); assert.ok(row.issues.length);
  assert.equal(data.sources.find(source => source.path === field)?.status, 'changed');
  assert.equal(language(data).rows[1].state, 'draft', 'an unchanged independently located literal remains a draft');
});

test('the held-unit callback is read independently of the identical fallback wording elsewhere in the render', () => {
  const value = input(), current = value.currentSources[field]!, original = frozen.messages[2].english;
  assert.ok(current.includes(`setMessage('${original}')`));
  const changed = current.replace(`setMessage('${original}')`, "setMessage('Changed actual callback warning.')");
  assert.ok(changed.includes(original), 'the old fallback text intentionally remains elsewhere');
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
  assert.equal(language(data).rows[2].currentEnglish, 'Changed actual callback warning.');
  assert.equal(language(data).rows[2].state, 'stale');
  const removed = current.replace(`setMessage('${original}')`, 'setMessage(unboundHeldMessage)');
  const missing = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: removed } });
  assert.equal(language(missing).rows[2].currentEnglish, null); assert.equal(language(missing).rows[2].state, 'source-missing');
});

test('a changed component context remains visible even when its precisely identified literals are unchanged', () => {
  const value = input(), changed = `${value.currentSources[field]}\n// Synthetic context-only source change\n`;
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
  assert.equal(data.sources.find(row => row.path === field)?.status, 'changed');
  for (const row of language(data).rows.filter(row => row.sourceFile === field)) {
    assert.equal(row.currentEnglish, row.frozenEnglish); assert.equal(row.state, 'draft');
    assert.ok(row.issues.some(issue => /context|file|fingerprint/i.test(issue)), row.key);
  }
});

for (const substitute of ['comment', 'substring', 'unrelated-function', 'variable-reference'] as const) {
  test(`${substitute} wording cannot stand in for the current option literal`, () => {
    const value = input(), current = value.currentSources[field]!;
    const replacement = substitute === 'substring' ? "'Prefix Kilograms (kg) suffix'" : 'unboundMassLabel';
    const extra = substitute === 'comment' ? "\n// Kilograms (kg)\n"
      : substitute === 'unrelated-function' ? "\nfunction unrelatedOption(){ return createElement('option', {value:'kg'}, 'Kilograms (kg)'); }\n"
      : substitute === 'variable-reference' ? "\nconst unboundMassLabel = 'Kilograms (kg)';\n" : '';
    const changed = current.replace("'Kilograms (kg)'", replacement) + extra;
    const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
    const row = language(data).rows[0];
    assert.notEqual(row.currentEnglish, row.frozenEnglish);
    assert.equal(row.currentEnglish, substitute === 'substring' ? 'Prefix Kilograms (kg) suffix' : null);
    assert.equal(row.state, substitute === 'substring' ? 'stale' : 'source-missing');
    assert.ok(row.issues.length);
  });
}

for (const damage of ['syntax-error', 'duplicate-owner', 'extra-option'] as const) test(`${damage} cannot choose an arbitrary source match`, () => {
  const value = input(), current = value.currentSources[field]!;
  const changed = damage === 'syntax-error' ? `${current}\nfunction {`
    : damage === 'duplicate-owner' ? `${current}\nfunction GrowerEnteredMassField(){return createElement('option', {value:'kg'}, 'Kilograms (kg)');}\n`
    : current.replace("createElement('option', { value: 'kg' }, 'Kilograms (kg)')",
      "createElement('option', { value: 'kg' }, 'Kilograms (kg)'), createElement('option', { value: 'kg' }, 'Kilograms (kg)')");
  assert.notEqual(changed, current);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
  assert.equal(language(data).rows[0].currentEnglish, null); assert.equal(language(data).rows[0].state, 'source-missing');
});

for (const nested of ['declaration', 'arrow', 'unused-call'] as const) test(`unused nested ${nested} text cannot replace the literal in the actual rendered mass option`, () => {
  const value = input(), current = value.currentSources[field]!;
  const helper = nested === 'declaration' ? "function unusedMassOption(){return createElement('option',{value:'kg'},'Kilograms (kg)');}"
    : nested === 'arrow' ? "const unusedMassOption=()=>createElement('option',{value:'kg'},'Kilograms (kg)');"
    : "const unusedMassOption=createElement('option',{value:'kg'},'Kilograms (kg)');";
  const changed = current.replace("'Kilograms (kg)'", 'unboundMassLabel')
    .replace('export default function GrowerEnteredMassField(props: Props) {',
      `export default function GrowerEnteredMassField(props: Props) {\n${helper}\n`);
  assert.notEqual(changed, current);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [field]: changed } });
  assert.equal(language(data).rows[0].currentEnglish, null); assert.equal(language(data).rows[0].state, 'source-missing');
});

test('unrelated component text cannot certify a missing source even if it contains every frozen phrase', () => {
  const value = input(), data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources,
    [field]: value.currentSources[intent], unrelated: value.currentSources[field] } });
  assert.equal(language(data).rows[0].currentEnglish, null); assert.equal(language(data).rows[0].state, 'source-missing');
  assert.equal(language(data).rows[5].state, 'draft');
});

const releaseAnchor = 'Enter household or trial harvest requests in kilograms or pounds.';
test('release metadata drift does not invalidate the independently located household tour route', () => {
  const value = input(), current = value.currentSources[release]!;
  const changed = current.replace(/sha: '[^']+'/, "sha: 'synthetic-new-release-metadata'"); assert.notEqual(changed, current);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [release]: changed } });
  assert.equal(data.sources.find(row => row.path === release)?.status, 'available');
  assert.equal(language(data).rows[11].state, 'draft'); assert.equal(language(data).rows[11].currentEnglish, frozen.messages[11].english);
});

test('the unrelated buyer-unit tour cannot replace a missing household tour anchor', () => {
  const value = input(), current = value.currentSources[release]!;
  assert.equal(current.split(releaseAnchor).length - 1, 1);
  const changed = current.replace(releaseAnchor, 'Household tour anchor removed.')
    .replace("where: 'Production plan → Harvest targets'", `where: '${frozen.messages[11].english}'`);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [release]: changed } });
  assert.equal(language(data).rows[11].currentEnglish, null); assert.equal(language(data).rows[11].state, 'source-missing');
});

test('duplicate independently anchored household tours cannot choose their first route as a winner', () => {
  const value = input(), current = value.currentSources[release]!;
  const duplicate = `{when:'Synthetic',sha:'synthetic',changes:[${JSON.stringify(releaseAnchor)}],tour:[{title:'Choose harvest weight units',href:'/facilitator/crops',where:'Other actual route',detail:'Synthetic fixture'}]},`;
  const changed = current.replace('export const RELEASE_NOTES: ReleaseNote[] = [', `export const RELEASE_NOTES: ReleaseNote[] = [\n${duplicate}`);
  assert.notEqual(changed, current);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [release]: changed } });
  assert.equal(language(data).rows[11].currentEnglish, null); assert.equal(language(data).rows[11].state, 'source-missing');
});

test('the actual household route is read independently when its where literal changes', () => {
  const value = input(), current = value.currentSources[release]!;
  const changed = current.replace(`where: '${frozen.messages[11].english}'`, "where: 'Changed actual household route'");
  assert.notEqual(changed, current);
  const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [release]: changed } });
  assert.equal(language(data).rows[11].currentEnglish, 'Changed actual household route');
  assert.equal(language(data).rows[11].state, 'stale');
});

for (const damage of ['missing', 'malformed', 'changed-English', 'reformatted', 'duplicate-JSON-member'] as const) {
  test(`${damage} frozen input cannot certify its own replacement English`, () => {
    const value = input(), source = JSON.parse(sourceText);
    source.messages[0].english += ' Changed'; source.messages[0].sha256 = sha(source.messages[0].english);
    const damaged = damage === 'missing' ? undefined : damage === 'malformed' ? '{'
      : damage === 'changed-English' ? JSON.stringify(source) : damage === 'reformatted' ? JSON.stringify(JSON.parse(sourceText))
      : sourceText.replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1');
    const data = buildMassEntryReviewData({ ...value, sourceText: damaged });
    assert.ok(data.issue); assert.deepEqual(data.languages, []);
  });
}

const faults: Array<[string, (value: Packet) => void]> = [
  ['duplicate row key', value => { value.messages[1] = structuredClone(value.messages[0]); }],
  ['reordered rows', value => { [value.messages[0], value.messages[1]] = [value.messages[1], value.messages[0]]; }],
  ['missing row', value => { value.messages.pop(); }],
  ['extra row', value => { value.messages.push(structuredClone(value.messages[0])); }],
  ['changed English and recomputed message hash', value => { value.messages[0].english += ' Changed'; value.messages[0].sha256 = sha(value.messages[0].english); }],
  ['wrong message hash', value => { value.messages[0].sha256 = '0'.repeat(64); }],
  ['wrong source hash', value => { value.sourceSha256 = '0'.repeat(64); }],
  ['wrong locale', value => { value.locale = 'es'; }],
  ['wrong schema key', value => { value.schemaVersion = 1; }],
  ['status alias', value => { value.status = 'unreviewed-ai-draft'; Reflect.deleteProperty(value, 'reviewStatus'); }],
  ['runtime activation', value => { value.runtimeActivation = true; }],
  ['claimed human review', value => { value.reviewStatus = 'human-reviewed'; }],
  ['extra packet review', value => { value.review = { status: 'human-reviewed', reviewer: 'Synthetic' }; }],
  ['extra row review', value => { value.messages[0].review = { status: 'human-reviewed' }; }],
];
for (const [name, damage] of faults) test(`${name} holds the whole affected language without granting reviewed coverage`, () => {
  const value = packet(); damage(value); packetHeld(packetResult(JSON.stringify(value)));
});
for (const [name, value] of [['missing', undefined], ['malformed', '{'], ['array', '[]'],
  ['duplicate JSON member', read(`${folder}/fr.json`).replace('"locale": "fr"', '"locale": "fr", "locale": "fr"')]] as const) {
  test(`${name} packet stays visibly invalid while another language remains a draft`, () => packetHeld(packetResult(value)));
}

test('generic Portuguese neither replaces nor renames the Brazilian Portuguese packet', () => {
  const value = input(), { 'pt-BR': brazil, ...others } = value.packets; assert.ok(brazil);
  const data = buildMassEntryReviewData({ ...value, packets: { ...others, ...{ pt: brazil } } });
  for (const row of language(data, 'pt-BR').rows) { assert.equal(row.state, 'invalid'); assert.equal(row.translation, null); }
  const renamed = JSON.parse(brazil) as Packet; renamed.locale = 'pt';
  const changed = buildMassEntryReviewData({ ...value, packets: { ...value.packets, 'pt-BR': JSON.stringify(renamed) } });
  for (const row of language(changed, 'pt-BR').rows) assert.equal(row.state, 'invalid');
});

for (const [key, literal] of [['massEntry.field.unit.kg', 'kg'], ['massEntry.field.unit.lb', 'lb'],
  ['massEntry.field.convertedDisplay', '≈'], ['massEntry.release.03', '→']] as const) {
  for (const change of ['remove', 'duplicate'] as const) test(`${change} protected ${literal} cannot change unit, approximation or route meaning`, () => {
    const value = packet(), row = value.messages.find(row => row.key === key)!;
    assert.ok(row.translation.includes(literal));
    row.translation = change === 'remove' ? row.translation.replace(literal, '') : `${row.translation} ${literal}`;
    packetHeld(packetResult(JSON.stringify(value)));
  });
}
for (const translation of ['', '   ', 'Synthetic {crop}', 'Synthetic {', 'Synthetic }', 'Synthetic {{crop}}']) {
  test(`blank or interpolated draft ${JSON.stringify(translation)} stays invalid without human-review promotion`, () => {
    const value = packet(); value.messages[2].translation = translation;
    const data = packetResult(JSON.stringify(value)), row = language(data).rows[2];
    assert.equal(row.state, 'invalid'); assert.ok(row.issues.length);
    assert.equal(data.languages.flatMap(entry => entry.rows).some(row => row.state === 'reviewed'), false);
  });
}
