// What breaks for a farmer if these fail: she opens the money book in Sesotho, Tshivenda or
// Xitsonga and either (a) still reads English where a draft exists, (b) reads a draft that has
// drifted from an English instruction someone later edited, (c) sees a wrong or missing rand/kg
// figure because a draft lost a {placeholder}, or (d) is shown another language's words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECORDS_DRAFTS } from '../lib/records-regional-drafts-data.ts';
import {
  recordsDraft, recordsFill, recordsPaired, recordsTemplate, recordsQuantityLabel, recordsUnitWord,
  recordsDraftNotice, isRecordsRegionalLang, samePlaceholders, placeholdersOf,
} from '../lib/records-regional-drafts.ts';
import { recordQuantityLabel, RECORD_UNITS } from '../lib/farm-records.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LANGS = ['st', 've', 'ts'] as const;
const SOURCES = ['app/records/page.tsx', 'components/MyRecords.tsx', 'components/records/ReceiptPreview.tsx',
  'components/records/RecordQuantityFields.tsx', 'components/records/RecordQuantitySummary.tsx',
  'lib/expense-receipts.ts', 'lib/duplicate-income.ts', 'lib/credit-pack-pdf.ts', 'lib/farm-records.ts',
  'lib/records-regional-drafts.ts', 'app/api/read-slip/route.ts', 'lib/api-auth.ts', 'lib/i18n.tsx',
  'lib/i18n-pending.ts', 'lib/learner-ui-english.ts'].map(read).join('\n');

test('English is untouched: no draft is ever returned for English, and English labels are byte-identical', () => {
  for (const key of Object.keys(RECORDS_DRAFTS)) {
    assert.equal(recordsDraft('en', key), null);
    assert.equal(recordsFill('en', key), key);
    assert.equal(recordsPaired('en', key), key);
  }
  for (const unit of RECORD_UNITS) {
    for (const quantity of [1, 2.5, 12, 1000]) {
      const row = { quantity, unit, kg: unit === 'kg' ? quantity : null };
      assert.equal(recordsQuantityLabel(row, 'en'), recordQuantityLabel(row), `${unit} ${quantity}`);
    }
  }
  // Unaffected languages stay English too — a language with no table must never get another's words.
  assert.equal(recordsFill('xh', 'Cancel'), 'Cancel');
  assert.equal(recordsFill('af', 'Cancel'), 'Cancel');
});

test('an existing translation always beats a draft; a draft only fills an English fallback', () => {
  const english = 'Cancel';
  assert.equal(recordsFill('st', english, 'ALREADY TRANSLATED'), 'ALREADY TRANSLATED');
  assert.equal(recordsFill('st', english, english), recordsDraft('st', english) ?? english);
  assert.equal(recordsPaired('st', english, 'ALREADY TRANSLATED'), 'Cancel — ALREADY TRANSLATED');
});

test('with no draft the English stands alone — never paired with itself, never blank', () => {
  const missing = 'A sentence nobody has drafted yet.';
  for (const lang of ['zu', ...LANGS]) {
    assert.equal(recordsFill(lang, missing), missing);
    assert.equal(recordsPaired(lang, missing), missing);
  }
});

test('a draft that loses or invents a {placeholder} is refused, so no money line prints a wrong figure', () => {
  const english = 'Orchard is switched off, so {kg} kg is not in the harvest figure: {names}.';
  assert.equal(recordsTemplate('en', english, null, { kg: '4.0', names: 'Mango' }),
    'Orchard is switched off, so 4.0 kg is not in the harvest figure: Mango.');
  // isiZulu path takes its own template; a broken one must fall back to the English sentence.
  assert.equal(recordsTemplate('zu', english, 'Ingadi icishiwe: {names}.', { kg: '4.0', names: 'Mango' }),
    'Orchard is switched off, so 4.0 kg is not in the harvest figure: Mango.');
  assert.equal(recordsTemplate('zu', english, 'Ingadi icishiwe, u-{kg} kg: {names}.', { kg: '4.0', names: 'Mango' }),
    'Ingadi icishiwe, u-4.0 kg: Mango.');
  assert.ok(samePlaceholders('{a} and {b}', '{b} na {a}'));
  assert.ok(!samePlaceholders('{a}', '{a} {b}'));
});

test('every shipped draft keeps the placeholders, digits and technical tokens of its English source', () => {
  for (const [english, row] of Object.entries(RECORDS_DRAFTS)) {
    for (const lang of ['zu', ...LANGS] as const) {
      const draft = row[lang];
      if (draft === undefined) continue;
      assert.ok(draft.trim() !== '', `${lang} draft for "${english}" is blank`);
      assert.deepEqual(placeholdersOf(draft), placeholdersOf(english), `${lang} draft for "${english}" changed its placeholders`);
      for (const token of english.match(/\d+(?:\.\d+)?/g) ?? []) {
        assert.ok(draft.includes(token), `${lang} draft for "${english}" lost the number ${token}`);
      }
      for (const token of ['kg', 'm²', 'R/kg', 'R/m²', 'JPG', 'PNG', 'WebP', 'MB', 'CSV', 'Lima', 'Ubhejane', 'Crèche']) {
        if (new RegExp(`(^|[^A-Za-z])${token.replace(/[/²]/g, '\\$&')}($|[^A-Za-z])`).test(english)) {
          assert.ok(draft.includes(token), `${lang} draft for "${english}" lost the technical token ${token}`);
        }
      }
    }
  }
});

test('every draft is bound to exact English still shown by the screen, so an edit retires its draft', () => {
  for (const english of Object.keys(RECORDS_DRAFTS)) {
    const literal = (q: string) => `${q}${english.replace(/'/g, "\\'")}${q}`;
    const templated = english.replace(/\{[a-zA-Z]+\}/g, '${');
    const shown = SOURCES.includes(literal("'")) || SOURCES.includes(literal('"')) || SOURCES.includes(literal('`'))
      || (english !== templated && templated.split('${').filter(Boolean).every((part) => SOURCES.includes(part)))
      // generated at run time from a word list: units, categories, periods
      || [...RECORD_UNITS, 'items', 'Feed', 'Seed', 'Fuel', 'Equipment', 'Labour', 'Transport', 'Other'].includes(english)
      || /^(No entries for this|No crop activity or crop plan for this|No sales or costs logged for this) (month|season|year)\./.test(english)
      || ['Editing sale', 'Editing cost', 'Sold', 'Spent', 'Charts', 'Picked', 'Check'].includes(english);
    assert.ok(shown, `draft key is no longer in any source file — retire or re-draft it: "${english}"`);
  }
});

test('unit words: the number is untouched and only the unit word moves into the farmer\'s language', () => {
  for (const lang of LANGS) {
    for (const unit of RECORD_UNITS) {
      if (unit === 'kg') assert.equal(recordsUnitWord(unit, lang), 'kg', 'kg is a technical unit and stays kg');
    }
    const label = recordsQuantityLabel({ quantity: 12, unit: 'eggs' }, lang);
    assert.match(label, /^12 \S/, `${lang}: number first, then a unit word`);
    const unknown = recordsQuantityLabel({ quantity: 1, unit: 'furlongs' }, lang);
    assert.equal(unknown, recordsFill(lang, 'Quantity not recorded'), 'a malformed unit still reads as not recorded, never as a weight');
  }
});

test('Sesotho, Tshivenda and Xitsonga draft notices name the language, say unreviewed, and keep Xitsonga provisional', () => {
  assert.equal(isRecordsRegionalLang('st') && isRecordsRegionalLang('ve') && isRecordsRegionalLang('ts'), true);
  assert.equal(isRecordsRegionalLang('zu'), false);
  assert.match(recordsDraftNotice('st'), /Unreviewed Sesotho machine draft/);
  assert.match(recordsDraftNotice('ve'), /Unreviewed Tshivenda machine draft/);
  assert.match(recordsDraftNotice('ts'), /Unreviewed Xitsonga machine draft \(provisional standard written Xitsonga\)/);
  for (const lang of LANGS) assert.doesNotMatch(recordsDraftNotice(lang), /reviewed by|approved|fluent speaker has|Shangani/i);
});

test('wrong-language contamination: a draft never carries another language\'s marker words', () => {
  // Distinctive, ordinary function words per language; each must not appear in the others' drafts.
  const markers: Record<string, RegExp> = {
    zu: /\b(ukudayisa|izindleko|futhi|ngaphambi|kokulondoloza|nge-|ukuthi)\b/i,
    st: /\b(ho boloka|hape|ka morao|tse ngotsweng|ha ho na|mme|empa)\b/i,
    ve: /\b(zwino|vhulungani|ṅwalani|hafhu|nga u|ndi)\b/i,
    ts: /\b(nakambe|ku hlayisa|hlayisa|swi|xi|leswi|loko)\b/i,
  };
  for (const [english, row] of Object.entries(RECORDS_DRAFTS)) {
    for (const lang of LANGS) {
      const draft = row[lang];
      if (!draft) continue;
      for (const other of Object.keys(markers)) {
        if (other === lang) continue;
        // Xitsonga, Sesotho and Tshivenda legitimately share a few short forms with each other
        // and with isiZulu loans; only the long distinctive markers count.
        const hit = draft.match(markers[other]);
        if (hit && hit[0].length >= 6) assert.fail(`${lang} draft for "${english}" contains ${other} word "${hit[0]}": ${draft}`);
      }
    }
  }
});

test('the money-in / money-out, entry / record and recovery distinctions survive in every language', () => {
  const must = (english: string, lang: typeof LANGS[number]) => recordsDraft(lang, english);
  for (const lang of LANGS) {
    const create = must('Create invoice', lang);
    const recover = must('Recover invoice', lang);
    const view = must('View', lang);
    const retry = must('Try again', lang);
    const sold = must('Sold', lang);
    const spent = must('Spent', lang);
    const moneyIn = must('Money in', lang);
    const moneyOut = must('Money out', lang);
    if (create && recover) assert.notEqual(create, recover, `${lang}: Create and Recover invoice must not collapse into one label`);
    if (recover && view) assert.notEqual(recover, view, `${lang}: Recover must not read as plain View`);
    if (recover && retry) assert.notEqual(recover, retry, `${lang}: Recover must not read as Try again`);
    if (sold && spent) assert.notEqual(sold, spent, `${lang}: Sold and Spent must differ`);
    if (moneyIn && moneyOut) assert.notEqual(moneyIn, moneyOut, `${lang}: money in and out must differ`);
  }
});

test('the do-not-enter-again warning and the nothing-is-lost reassurance keep their negation in the English pairing', () => {
  // The English stays beside the draft for these (recordsInstruction), so a farmer can check the
  // negation against the source. Pin that the pairing is on, in every regional language.
  for (const lang of LANGS) {
    for (const english of [
      'Paid invoice crop lines enter the sales book automatically and count once. Do not enter them again.',
      'Your connection dropped mid-save. Nothing is lost — this is saved on your phone and will finish sending on its own.',
    ]) {
      const shown = recordsPaired(lang, english);
      assert.ok(shown.startsWith(english), `${lang}: English source must come first`);
    }
  }
});
