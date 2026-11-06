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
const presenter = 'lib/international/grower-cycle-intent.ts';
const release = 'lib/release-notes.ts';
const paths = [field, intent, presenter, release];
const folder = 'lib/international/locales/mass-entry-drafts';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sourceText = read(`${folder}/source.json`);
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
interface FrozenMessage { key: string; english: string; sha256: string }
interface Message extends FrozenMessage { translation: string; [key: string]: unknown }
interface Packet { locale: string; sourceSha256: string; reviewStatus: string; runtimeActivation: boolean; messages: Message[]; [key: string]: unknown }
const frozen = JSON.parse(sourceText) as { messages: FrozenMessage[]; locales: string[];
  sourceFiles: { file: string; sha256: string }[] };
// The shared presenter now adds the non-summing warning. Keep every frozen
// packet and compare the changed current sentence as stale, never reapprove it.
const changedKey = 'massEntry.readback.planningEstimate';
const changedEnglish = 'This is the grower-entered planning estimate, not this batch’s output or an observed harvest. Repeated whole-demand request weights must not be added together.';
const expectedState = (key: string) => key === changedKey ? 'stale' : 'draft';
const expectedEnglish = (key: string, english: string) => key === changedKey ? changedEnglish : english;
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
  for (const row of language(data, 'es').rows) assert.equal(row.state, expectedState(row.key), row.key);
  for (const entry of data.languages.filter(entry => entry.locale !== 'fr')) {
    for (const row of entry.rows) assert.equal(row.state, expectedState(row.key), `${entry.locale}: ${row.key}`);
  }
}

test('the actual mass sources retain 84 unreviewed pairs while seven changed non-summing sentences remain stale', () => {
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
      assert.equal(row.frozenEnglish, frozen.messages[index].english);
      assert.equal(row.currentEnglish, expectedEnglish(row.key, frozen.messages[index].english));
      assert.equal(row.translation, actual.messages[index].translation); assert.equal(row.state, expectedState(row.key), row.key);
      assert.equal(row.sourceFile, index < 5 ? field : index < 11 ? presenter : release, row.key);
      assert.equal(row.issues.some(issue => /human.reviewed|approved by/i.test(issue)), false);
    }
  }
  assert.equal(data.languages.flatMap(entry => entry.rows).filter(row => row.state === 'draft').length, 77);
  assert.equal(data.languages.flatMap(entry => entry.rows).filter(row => row.state === 'stale').length, 7);
  assert.deepEqual(value, before);
});

test('the named server loader reads actual current source and packet files rather than treating frozen English as live input', () => {
  assert.deepEqual(loadMassEntryReviewData(), buildMassEntryReviewData(input()));
});

test('relocated current wording retains historical component provenance without inventing a presenter capture', () => {
  const data = buildMassEntryReviewData(input());
  const component = data.sources.find(source => source.path === intent), current = data.sources.find(source => source.path === presenter);
  assert.ok(component); assert.ok(current);
  assert.equal(component.capturedSha256, '88b4f0fe56d8f0d494d26a2a7f8dfbb045ee1abac825880cbac4f765d4da835f');
  assert.equal(component.status, 'changed'); assert.equal(current.capturedSha256, null); assert.equal(current.status, 'available');
  for (const row of language(data).rows.filter(row => row.sourceFile === presenter)) {
    assert.ok(row.issues.some(issue => /relocation/.test(issue)));
    assert.ok(row.issues.some(issue => /component source changed/i.test(issue)));
  }
});

for (const damage of ['missing-import', 'wrong-call', 'wrong-argument', 'unused-result', 'missing-render', 'dynamic-render', 'syntax-error'] as const) {
  test(`${damage} component delegation cannot certify shared presenter wording`, () => {
    const value = input(), component = value.currentSources[intent]!;
    const changed = damage === 'missing-import' ? component.replace("from '@/lib/international/grower-cycle-intent'", "from './unrelated-presenter'")
      : damage === 'wrong-call' ? component.replace('const intent = readGrowerCycleIntent(view)', 'const intent = unrelatedIntent(view)')
      : damage === 'wrong-argument' ? component.replace('readGrowerCycleIntent(view)', 'readGrowerCycleIntent(otherView)')
      : damage === 'unused-result' ? component.replace('...intent.lines.map', '...unrelated.lines.map')
      : damage === 'missing-render' ? component.replace("}, text)));", "}, 'Unrelated fixed wording')));")
      : damage === 'dynamic-render' ? component.replace('...intent.lines.map', '...intent.otherLines.map')
      : `${component}\nfunction {`;
    assert.notEqual(changed, component);
    const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [intent]: changed } });
    for (const row of language(data).rows) {
      assert.equal(row.state, row.sourceFile === presenter ? 'source-missing' : expectedState(row.key), row.key);
      if (row.sourceFile === presenter) { assert.equal(row.currentEnglish, null); assert.ok(row.issues.length); }
    }
  });
}

for (const damage of ['comment', 'unrelated-function', 'nested-helper', 'nested-arrow', 'dynamic-template'] as const) {
  test(`${damage} cannot substitute for the presenter's actual buyer-purpose literal`, () => {
    const value = input(), current = value.currentSources[presenter]!, original = 'Planning purpose: buyer target.';
    const replacement = damage === 'dynamic-template' ? '`Planning purpose: ${buyerWord}.`' : 'unboundBuyerText';
    let changed = current.replace(`['${original}']`, `[${replacement}]`);
    const helper = `return result('recorded', 'buyer-target', ['${original}']);`;
    if (damage === 'comment') changed += `\n// ${original}\n`;
    if (damage === 'unrelated-function') changed += `\nfunction unrelated(){ ${helper} }\n`;
    if (damage === 'nested-helper' || damage === 'nested-arrow') changed = changed.replace('  try {', damage === 'nested-helper'
      ? `  function unused(){ ${helper} }\n  try {` : `  const unused = () => { ${helper} };\n  try {`);
    assert.notEqual(changed, current);
    const data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [presenter]: changed } });
    const row = language(data).rows[6];
    assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing');
    assert.equal(language(data).rows[5].state, 'draft', 'another independently identified presenter role remains readable');
  });
}

test('actual changed presenter literals are exposed as current English rather than substituted from frozen packets', () => {
  const value = input(), current = value.currentSources[presenter]!;
  const changed = current.replace("['Planning purpose: buyer target.']", "['Changed current buyer purpose.']");
  assert.notEqual(changed, current);
  const row = language(buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [presenter]: changed } })).rows[6];
  assert.equal(row.currentEnglish, 'Changed current buyer purpose.'); assert.equal(row.state, 'stale');
  assert.equal(row.frozenEnglish, 'Planning purpose: buyer target.');
});

for (const damage of ['wrong-branch', 'duplicate-branch', 'unexported-owner', 'duplicate-owner', 'dynamic-array'] as const) {
  test(`${damage} presenter cannot choose an arbitrary purposeUnknown literal`, () => {
    const value = input(), current = value.currentSources[presenter]!;
    const condition = "view === undefined || status === 'not-recorded'";
    const actual = `if (${condition}) return result('not-recorded', 'not-recorded', [\n      '${frozen.messages[5].english}',\n    ]);`;
    assert.ok(current.includes(actual));
    const changed = damage === 'wrong-branch' ? current.replace(condition, 'unrelatedCondition')
      : damage === 'duplicate-branch' ? current.replace(actual, `${actual}\n    ${actual}`)
      : damage === 'unexported-owner' ? current.replace('export function readGrowerCycleIntent(', 'function readGrowerCycleIntent(')
      : damage === 'duplicate-owner' ? `${current}\nexport function readGrowerCycleIntent(){return undefined;}\n`
      : current.replace(`'${frozen.messages[5].english}',`, 'unboundPurposeText,');
    assert.notEqual(changed, current);
    const row = language(buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [presenter]: changed } })).rows[5];
    assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing');
  });
}

test('conditional missing-entry and missing-request roles cannot borrow old wording from unrelated pushes', () => {
  for (const index of [7, 10]) {
    const value = input(), current = value.currentSources[presenter]!, original = frozen.messages[index].english;
    const changed = current.replace(`'${original}'`, 'unboundMissingText')
      + `\nfunction unrelated(){lines.push('${original}');}\n`;
    assert.notEqual(changed, current);
    const row = language(buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [presenter]: changed } })).rows[index];
    assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing');
  }
});

test('duplicate or dynamic canonical push arguments cannot retain current-English status through another literal', () => {
  const value = input(), current = value.currentSources[presenter]!, canonical = frozen.messages[8].english;
  const actualPush = current.slice(current.indexOf('    lines.push(`Original request'), current.indexOf('\n    return result', current.indexOf('    lines.push(`Original request')));
  assert.ok(actualPush.includes(canonical));
  for (const changed of [current.replace(`'${canonical}'`, 'unboundCanonicalText'),
    current.replace(`'${canonical}'`, `\`${canonical} \${extra}\``),
    current.replace(actualPush, `${actualPush}\n${actualPush}`),
    current.replace('String(requestedGrossKg)', 'unboundGrossWeight')
      + `\nfunction unused(){lines.push('Unrelated', '${canonical}', 'Other estimate copy');}\n`]) {
    assert.notEqual(changed, current);
    const row = language(buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [presenter]: changed } })).rows[8];
    assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing');
  }
});

for (const path of paths) test(`missing actual ${path} withdraws only its current English instead of borrowing the frozen snapshot`, () => {
  const value = input(), data = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [path]: undefined } });
  assert.equal(data.sources.find(row => row.path === path)?.status, 'unavailable');
  for (const row of data.languages.flatMap(entry => entry.rows)) {
    const affected = row.sourceFile === path || path === intent && row.sourceFile === presenter;
    assert.equal(row.currentEnglish, affected ? null : expectedEnglish(row.key, row.frozenEnglish));
    assert.equal(row.state, affected ? 'source-missing' : expectedState(row.key), row.key);
    if (affected) assert.ok(row.issues.length);
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
