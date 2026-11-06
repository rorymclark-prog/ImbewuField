import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildMassEntryReviewData, MASS_ENTRY_REVIEW_LOCALES,
  type MassEntryReviewInputs, type MassEntryReviewLocale } from '../lib/international/locales/mass-entry-review.ts';
import { loadMassEntryReviewData } from '../lib/international/locales/mass-entry-review-server.ts';
import { MASS_ENTRY_REVIEW_SOURCE as binding } from '../lib/international/locales/mass-entry-review-source.ts';
import { placeholders } from '../lib/international/locales/coverage.ts';

const existing = ['fr', 'es', 'pt-BR', 'sw'] as const;
const asia = ['hi', 'bn', 'id'] as const;
const locales = [...existing, ...asia] as const;
const folder = 'lib/international/locales/mass-entry-drafts';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const sourceText = read(`${folder}/source.json`);
const sourceSha = 'd04df52e04b97ea0f72bea9c45b33081152c9ea293dd0dedd4f49e9e27f0edc5';
interface Message { key: string; english: string; sha256: string; translation: string; [key: string]: unknown }
interface Packet {
  locale: string; sourceSha256: string; reviewStatus: string; runtimeActivation: boolean;
  messages: Message[]; [key: string]: unknown;
}
const frozen = JSON.parse(sourceText) as { locales: string[]; messages: Pick<Message, 'key' | 'english' | 'sha256'>[] };
// The frozen job remains unchanged after the shared presenter adds a warning.
// Its seven translations must be stale rather than silently gaining coverage.
const changedKey = 'massEntry.readback.planningEstimate';
const changedEnglish = 'This is the grower-entered planning estimate, not this batch’s output or an observed harvest. Repeated whole-demand request weights must not be added together.';
const expectedState = (key: string) => key === changedKey ? 'stale' : 'draft';
const expectedEnglish = (key: string, english: string) => key === changedKey ? changedEnglish : english;
function input(): MassEntryReviewInputs {
  return { sourceText, currentSources: Object.fromEntries(binding.files.map(file => [file.path, read(file.path)])),
    packets: Object.fromEntries(locales.map(locale => [locale, read(`${folder}/${locale}.json`)])) };
}
function language(data: ReturnType<typeof buildMassEntryReviewData>, locale: MassEntryReviewLocale) {
  const value = data.languages.find(language => language.locale === locale);
  assert.ok(value, `${locale} must have an inspectable comparison even when its packet is held`);
  return value;
}
function packet(locale: typeof asia[number]): Packet { return JSON.parse(read(`${folder}/${locale}.json`)) as Packet; }
function changedPacket(locale: typeof asia[number], value: string | undefined) {
  const original = input(), packets = { ...original.packets };
  if (value === undefined) delete packets[locale]; else packets[locale] = value;
  return buildMassEntryReviewData({ ...original, packets });
}

test('seven actual inactive mass packets expose 84 paired drafts while English and historical four-locale source bytes stay frozen', () => {
  const value = input(), before = structuredClone(value), result = buildMassEntryReviewData(value);
  assert.deepEqual(MASS_ENTRY_REVIEW_LOCALES, locales);
  assert.equal(result.issue, null); assert.equal(result.sourceSha256, sourceSha); assert.equal(sha(sourceText), sourceSha);
  assert.deepEqual(frozen.locales, existing, 'Frozen source locales describe the original job; selecting more packets must not rewrite it');
  assert.equal(frozen.messages.length, 12);
  assert.deepEqual(result.languages.map(language => language.locale), locales);
  assert.equal(result.languages.flatMap(language => language.rows).length, 84);
  for (const locale of locales) {
    const actual = JSON.parse(value.packets[locale]!) as Packet, rows = language(result, locale).rows;
    assert.equal(actual.locale, locale); assert.equal(actual.sourceSha256, sourceSha);
    assert.equal(actual.reviewStatus, 'unreviewed-ai-draft'); assert.equal(actual.runtimeActivation, false);
    assert.equal(actual.messages.length, 12); assert.equal(rows.length, 12);
    for (const [index, row] of rows.entries()) {
      const saved = actual.messages[index], source = frozen.messages[index];
      assert.equal(saved.key, source.key); assert.equal(saved.english, source.english);
      assert.equal(saved.sha256, sha(source.english)); assert.equal(row.key, source.key);
      assert.equal(row.frozenEnglish, source.english); assert.equal(row.currentEnglish, expectedEnglish(row.key, source.english));
      assert.equal(row.translation, saved.translation); assert.equal(row.state, expectedState(row.key), `${locale}/${row.key}`);
      assert.deepEqual(placeholders(saved.translation), placeholders(source.english));
      for (const literal of ['kg', 'lb', '≈', '→']) {
        assert.equal(saved.translation.split(literal).length, source.english.split(literal).length, `${locale}/${row.key} preserves ${literal}`);
      }
      assert.ok(!row.issues.some(issue => /human.reviewed|approved by/i.test(issue)));
    }
  }
  assert.deepEqual(value, before, 'Review must not mutate caller sources or activate packet data');
});

test('existing FRES packet bytes and comparison rows remain unchanged when Asia packets are included', () => {
  const pins = { fr: 'e930727c9ae1346cb73e8251564bd8c92830d24e3d282c9a04db88efedd0965a',
    es: 'ae45d29d2d5512c7de929219e60b0c41eee294ea1e8dbead00e40bd4cd9441dd',
    'pt-BR': 'fb526de636adb51cd282b472fdbb0c5da397963778b3eab2fba04b07b11d0a88',
    sw: 'e3920fed4828633e71b7a47a5711ae143f6a0b5463c331e61ef4b608ece6afd3' };
  const value = input(), full = buildMassEntryReviewData(value);
  const prior = buildMassEntryReviewData({ ...value, packets: Object.fromEntries(existing.map(locale => [locale, value.packets[locale]])) });
  for (const locale of existing) {
    assert.equal(sha(read(`${folder}/${locale}.json`)), pins[locale], `${locale} frozen packet bytes`);
    assert.deepEqual(language(full, locale), language(prior, locale));
  }
  assert.equal(sha(read(`${folder}/source.json`)), sourceSha);
});

test('the three later Asia packets remain exact historical drafts after presenter wording changes', () => {
  const pins = { hi: 'c5fd049ba1ed6b91137b3d824a12d2b22519a656714401cd802649da434d6a1d',
    bn: '4480eb2b96f29193f2da67bc1d78b9b8451dd567239d80e17809747176baaa2b',
    id: 'c7f9bf0d2bd64bc9007f7764bde0aefac1a8a89e1f422bdcdc47666da2e7833c' };
  for (const locale of asia) assert.equal(sha(read(`${folder}/${locale}.json`)), pins[locale]);
});

test('the existing server loader includes the three new packets through the shared seven-locale selection', () => {
  const expected = buildMassEntryReviewData(input()), loaded = loadMassEntryReviewData();
  assert.deepEqual(loaded, expected);
  for (const locale of asia) {
    assert.equal(language(loaded, locale).rows.filter(row => row.state === 'draft').length, 11);
    assert.equal(language(loaded, locale).rows.filter(row => row.state === 'stale').length, 1);
  }
});

for (const locale of asia) {
  test(`${locale}: missing or structurally damaged packets cannot acquire translations or reviewed coverage`, () => {
    const baseline = buildMassEntryReviewData(input());
    const faults: [string, string | undefined][] = [['missing', undefined], ['malformed JSON', '{'],
      ['duplicate JSON locale', read(`${folder}/${locale}.json`).replace(`"locale": "${locale}"`, `"locale": "${locale}", "locale": "${locale}"`)]];
    const mutations: [string, (value: Packet) => void][] = [
      ['wrong locale', value => { value.locale = locale === 'hi' ? 'bn' : 'hi'; }],
      ['wrong source', value => { value.sourceSha256 = '0'.repeat(64); }],
      ['claimed human review', value => { value.reviewStatus = 'human-reviewed'; }],
      ['runtime activation', value => { value.runtimeActivation = true; }],
      ['extra approval', value => { value.review = { status: 'human-reviewed', reviewer: 'Synthetic' }; }],
      ['changed paired English', value => { value.messages[0].english += ' Changed'; value.messages[0].sha256 = sha(value.messages[0].english); }],
      ['changed order', value => { value.messages.reverse(); }],
      ['missing row', value => { value.messages.pop(); }],
    ];
    for (const [name, mutate] of mutations) { const value = packet(locale); mutate(value); faults.push([name, JSON.stringify(value)]); }
    for (const [name, damaged] of faults) {
      const result = changedPacket(locale, damaged);
      assert.equal(result.issue, null, name);
      for (const row of language(result, locale).rows) {
        assert.equal(row.state, 'invalid', `${name}/${row.key}`); assert.equal(row.translation, null, name); assert.ok(row.issues.length, name);
      }
      assert.ok(!result.languages.flatMap(language => language.rows).some(row => row.state === 'reviewed'), name);
      for (const unaffected of locales.filter(candidate => candidate !== locale)) {
        assert.deepEqual(language(result, unaffected), language(baseline, unaffected), `${name} must not contaminate ${unaffected}`);
      }
    }
  });

  test(`${locale}: kg, lb, approximation and route literals cannot be removed or duplicated`, () => {
    for (const [key, literal] of [['massEntry.field.unit.kg', 'kg'], ['massEntry.field.unit.lb', 'lb'],
      ['massEntry.field.convertedDisplay', '≈'], ['massEntry.release.03', '→']] as const) {
      for (const mode of ['remove', 'duplicate'] as const) {
        const value = packet(locale), row = value.messages.find(message => message.key === key); assert.ok(row);
        assert.ok(row.translation.includes(literal));
        row.translation = mode === 'remove' ? row.translation.replace(literal, '') : `${row.translation} ${literal}`;
        const result = changedPacket(locale, JSON.stringify(value));
        for (const row of language(result, locale).rows) {
          assert.equal(row.state, 'invalid', `${mode}/${literal}/${row.key}`); assert.equal(row.translation, null);
        }
      }
    }
  });

  test(`${locale}: malformed placeholders remain inspectably invalid through the shared assessor without acquiring approval`, () => {
    for (const text of ['', '  ', 'Synthetic {crop}', 'Synthetic {', 'Synthetic {{crop}}']) {
      const value = packet(locale); value.messages[2].translation = text;
      const row = language(changedPacket(locale, JSON.stringify(value)), locale).rows[2];
      assert.equal(row.state, 'invalid'); assert.ok(row.issues.length);
      // The established inspector retains the submitted text for repair; this
      // is not translated/reviewed coverage or runtime message resolution.
      assert.equal(row.translation, text);
    }
  });

  test(`${locale}: missing current English cannot borrow the frozen packet as live source`, () => {
    const value = input(), missingFile = binding.files[0].path;
    const result = buildMassEntryReviewData({ ...value, currentSources: { ...value.currentSources, [missingFile]: undefined } });
    for (const row of language(result, locale).rows) {
      assert.equal(row.state, row.sourceFile === missingFile ? 'source-missing' : expectedState(row.key));
      assert.equal(row.currentEnglish, row.sourceFile === missingFile ? null : expectedEnglish(row.key, row.frozenEnglish));
    }
  });
}
