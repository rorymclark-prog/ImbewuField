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
  'lib/i18n-pending.ts', 'lib/learner-ui-english.ts', 'components/CropSelect.tsx', 'lib/invoices.ts', 'lib/crop-entry.ts', 'components/CashflowChart.tsx', 'components/FinanceGraphs.tsx', 'components/ComingUpHarvests.tsx', 'components/HarvestReconciliation.tsx', 'components/AreaReturnCards.tsx'].map(read).join('\n');

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
    const literal = (q: string) => `${q}${q === "'" ? english.replace(/'/g, "\\'") : english}${q}`;
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
    const label = recordsQuantityLabel({ quantity: 12, unit: 'eggs', kg: null }, lang);
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
        const hit: RegExpMatchArray | null = draft.match(markers[other]);
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

/* ── Coverage: the screen cannot grow an English string the drafts silently skip ──────────────── */

import { existsSync } from 'node:fs';

/** Quoted English literals inside recordsText/recordsInstruction/recordsUi/recordsFill/recordsTemplate/text calls. */
function englishLiteralsIn(source: string, helpers: string[]): Set<string> {
  const found = new Set<string>();
  for (const helper of helpers) {
    const call = new RegExp(`(?<![\\w.])${helper}\\(`, 'g');
    for (let m = call.exec(source); m; m = call.exec(source)) {
      let depth = 0; let quote = ''; let start = m.index + m[0].length; const args: string[] = [];
      for (let i = m.index + m[0].length - 1; i < source.length; i++) {
        const c = source[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
        if ("'\"`".includes(c)) quote = c;
        else if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) { depth--; if (depth === 0) { args.push(source.slice(start, i)); break; } }
        else if (c === ',' && depth === 1) { args.push(source.slice(start, i)); start = i + 1; }
      }
      // text(en, zu) has English first; the others take lang first.
      const english = helper === 'text' || helper === 'tx' ? args[0] : args[1];
      for (const lit of (english ?? '').matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) found.add((lit[1] ?? lit[2]).replace(/\\'/g, "'"));
    }
  }
  return found;
}

test('every English label the money book renders has a draft or an explicit hold in each regional language', () => {
  const packet = (lang: string) => JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{ english: string; status: string }>;
  const helpers = ['recordsText', 'recordsInstruction', 'recordsUi', 'recordsFill', 'recordsPaired', 'recordsTemplate'];
  const literals = new Set<string>();
  for (const file of ['app/records/page.tsx', 'components/MyRecords.tsx', 'components/CropSelect.tsx']) {
    for (const lit of englishLiteralsIn(read(file), helpers)) literals.add(lit);
  }
  for (const lit of englishLiteralsIn(read('components/records/ReceiptPreview.tsx'), ['text'])) literals.add(lit);
  // Selector tokens inside template expressions, not words a farmer reads.
  for (const token of ['in', 'out', 'cost', 'sale', 'zu', 'en', 'bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts', ' ', ', ']) literals.delete(token);
  for (const lang of LANGS) {
    const held = new Set(packet(lang).filter((row) => row.status === 'held').map((row) => row.english));
    const missing = [...literals].filter((english) => !/[A-Za-z]{2}/.test(english) ? false : recordsDraft(lang, english) === null && !held.has(english));
    assert.deepEqual(missing, [], `${lang}: English shown on the money book with neither a draft nor a recorded hold`);
  }
});

test('the draft packet and the shipped table agree: only accepted drafts ship, held rows never do', () => {
  for (const lang of ['zu', ...LANGS] as const) {
    const rows = JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{ english: string; status: string; draft: string }>;
    for (const row of rows) {
      if (row.status === 'accepted') assert.equal(RECORDS_DRAFTS[row.english]?.[lang], row.draft, `${lang} accepted draft missing or different in the table: ${row.english}`);
      else assert.equal(RECORDS_DRAFTS[row.english]?.[lang], undefined, `${lang} held row leaked into the table: ${row.english}`);
    }
  }
  assert.ok(existsSync(new URL('../docs/translation-reviews/records-finance-2026-10-06/README.md', import.meta.url)));
});

test('useRecordsT wraps useLanguage and never itself — a self-call crashed the whole money book on first render', () => {
  const source = read('components/MyRecords.tsx');
  const start = source.indexOf('function useRecordsT');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  assert.match(body, /useLanguage\(\)/);
  assert.doesNotMatch(body.replace('function useRecordsT', ''), /useRecordsT\(/);
});

test('validation text and the draft notice reach the screen for the regional languages', () => {
  const page = read('app/records/page.tsx');
  assert.match(page, /isRecordsRegionalLang\(lang\) && <p role="note" lang="en" data-records-draft-notice=\{lang\}/, 'the unreviewed-draft notice must render above the tabs');
  assert.match(page, /recordsPaired\(lang, 'Product, quantity and amount are required\.'\)/);
  assert.match(page, /recordsPaired\(lang, 'Item and amount are required\.'\)/);
  // The saved form must still validate exactly as before: the rule is untouched, only the words moved.
  assert.match(page, /if \(!what \|\| !Number\.isFinite\(amount\) \|\| amount < 0 \|\| \(isIn && \(!Number\.isFinite\(quantity\) \|\| quantity <= 0\)\)\)/);
});

test('the CSV export never carries an unreviewed regional draft: Sesotho, Tshivenda and Xitsonga export English', () => {
  const page = read('app/records/page.tsx');
  assert.match(page, /const csvLang = \(lang: string\) => \(lang === 'zu' \? 'zu' : 'en'\);/);
  const calls = [...page.matchAll(/(?<!function )exportLedgerCsv\(([^\n]*)/g)].map((m) => m[1]);
  assert.ok(calls.length >= 2, 'both CSV entry points (desktop sheet and phone button) must still exist');
  for (const call of calls) {
    assert.match(call, /csvLang\(lang\)/, `CSV call must go through csvLang(): ${call}`);
    assert.doesNotMatch(call.replace(/csvLang\(lang\)/g, ''), /\blang\b/, `CSV call passes the raw language: ${call}`);
    assert.doesNotMatch(call, /,\s*lang\s*[,)]/, 'raw lang argument');
  }
});

test('held rows stay English: after the second-session backcheck no held draft reaches the screen', () => {
  // The Tshivenda amount/price collapse is the one that could change what a farmer types into a money field.
  for (const english of ['Amount (R)', 'Product, quantity and amount are required.', 'Item and amount are required.']) {
    assert.equal(recordsDraft('ve', english), null, `ve must show English for: ${english}`);
  }
  assert.equal(recordsDraft('st', 'Garden gross margin'), null);
  assert.equal(recordsDraft('ts', 'Original photo · saved on this device only'), null, 'the device-only photo warning stays English until a speaker confirms it');
});

/* ── Charts tab: the same guarantee for the five chart components ─────────────────────────────── */

/** English literals a Charts component hands to the draft lookup: helper calls, template=, and static english=. */
function chartEnglish(source: string): Set<string> {
  const found = englishLiteralsIn(source, ['recordsFill', 'recordsTemplate', 'recordsLabel']);
  for (const lit of englishLiteralsIn(source, ['text', 'tx'])) found.add(lit); // text(en, zu): English first
  for (const m of source.matchAll(/\benglish="([^"]+)"/g)) found.add(m[1]);
  for (const m of source.matchAll(/\btemplate="([^"]+)"/g)) found.add(m[1]);
  for (const m of source.matchAll(/\btemplate=\{([^}]*)\}/g)) {
    for (const lit of m[1].matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) found.add(lit[1].replace(/\\'/g, "'"));
  }
  return found;
}

// Sentences the components hold in a const and pass as `english={...}` (no call to extract them from).
const CHART_CONST_SENTENCES = [
  'Log a sale or a cost and this chart draws itself. Two or three months of entries is enough to see a pattern.',
  'Log what you pick and what you sell, and this graph shows how much of your harvest is leaving the farm and how much is staying on it.',
  '“Kept” is what you picked less what you sold — food eaten at home, given away, fed out, saved for seed or spoiled. The app cannot tell those apart, so it does not guess.',
  'A dashed outline means more was sold that month than was logged as picked, so the kept figure is unknown — usually picking that never got written down, sometimes a sale out of an earlier month’s harvest.',
  'Entries land in the month you recorded them; the logging forms have no date field yet.',
  'Trace your beds in the Design Studio, then plan a season, and this graph compares the plan against what you actually pick.',
  'Your crop plan is empty, so there is nothing to compare your harvest against.',
];

test('every English sentence the Charts tab renders has a draft or an explicit hold in each regional language', () => {
  const files = ['CashflowChart', 'FinanceGraphs', 'ComingUpHarvests', 'HarvestReconciliation', 'AreaReturnCards'];
  const literals = new Set<string>(CHART_CONST_SENTENCES);
  for (const name of files) {
    const source = read(`components/${name}.tsx`);
    for (const lit of chartEnglish(source)) literals.add(lit);
  }
  for (const sentence of CHART_CONST_SENTENCES) {
    assert.ok(files.some((name) => read(`components/${name}.tsx`).includes(sentence)), `listed sentence is no longer in a chart component, retire it: ${sentence}`);
  }
  for (const junk of ['none', 'in', 'out', ' ', ', ', '; ']) { /* selector tokens are not text */ if (junk !== 'in' && junk !== 'out') literals.delete(junk); }
  const packet = (lang: string) => JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{ english: string; status: string }>;
  for (const lang of LANGS) {
    const held = new Set(packet(lang).filter((row) => row.status === 'held').map((row) => row.english));
    const missing = [...literals].filter((english) => /[A-Za-z]{2}/.test(english) && recordsDraft(lang, english) === null && !held.has(english));
    assert.deepEqual(missing, [], `${lang}: English on the Charts tab with neither a draft nor a recorded hold`);
  }
});

test('a figure-bearing Charts sentence keeps its numbers and names when drafted: placeholders survive end to end', () => {
  for (const lang of LANGS) {
    for (const template of Object.keys(RECORDS_DRAFTS).filter((key) => /\{[a-zA-Z]+\}/.test(key))) {
      if (recordsDraft(lang, template) === null) continue;
      // A distinctive value per placeholder, so a draft that dropped, renamed or duplicated one is caught.
      const vars: Record<string, string> = Object.fromEntries(placeholdersOf(template).map((name) => [name, `«${name.toUpperCase()}»`]));
      const shown = recordsTemplate(lang, template, null, vars);
      assert.doesNotMatch(shown, /\{[a-zA-Z]+\}/, `${lang}: unfilled placeholder in "${template}"`);
      for (const name of Object.keys(vars)) assert.ok(shown.includes(vars[name]), `${lang}: "${template}" lost its ${name}`);
    }
  }
});

test('IsiZuluDraftSource: English-only when no draft, draft above exact English when there is one, isiZulu keeps its own wording', () => {
  const source = read('components/IsiZuluDraftSource.tsx');
  assert.match(source, /recordsDraft\(code, sentence\) !== null \? recordsTemplate\(code, sentence, null, vars \?\? \{\}\) : english/, 'a sentence with no draft must come back as plain English, never English with a stray local fragment');
  assert.match(source, /isRecordsRegionalLang\(lang\) \? looked\(lang\) : english/);
  assert.match(source, /if \(!local \|\| local === english\) return <p className=\{className\} style=\{style\}>\{english\}<\/p>;/, 'no draft must render the English alone');
  assert.match(source, /English source: \{english\}/, 'the exact English must stay beside any draft');
  assert.match(source, /\(zulu \|\| looked\('zu'\)\)/, 'a supplied isiZulu sentence must win over the lookup');
});
