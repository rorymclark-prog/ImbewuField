// What breaks for a farmer if these fail: she opens the money book in Sesotho, Tshivenda or
// Xitsonga and either (a) still reads English where a draft exists, (b) reads a draft that has
// drifted from an English instruction someone later edited, (c) sees a wrong or missing rand/kg
// figure because a draft lost a {placeholder}, or (d) is shown another language's words.

import { kgPreciseLabel } from '@/lib/format-figures';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { RECORDS_DRAFTS } from '../lib/records-regional-drafts-data.ts';
import {
  recordsDraft, recordsFill, recordsPaired, recordsTemplate, recordsQuantityLabel, recordsUnitWord,
  recordsDraftNotice, isRecordsRegionalLang, samePlaceholders, placeholdersOf,
  recordsEnglishHoldReason, RECORDS_ENGLISH_HOLDS, RECORDS_RETIRED_SOURCES,
} from '../lib/records-regional-drafts.ts';
import { recordQuantityLabel, RECORD_UNITS } from '../lib/farm-records.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LANGS = ['st', 've', 'ts'] as const;
type RetiredDraft = { english: string; messageSha256: string; translations: Record<string, string>; sourceFile: string; sourceFileSha256: string; status: string; reason: string; replacementEnglish: string };
const retiredArchive = JSON.parse(read('docs/international/invoice-currency-retired-records-drafts.json')) as { sourceFile: string; sourceFileSha256: string; entries: RetiredDraft[] };

const SOURCES = ['app/records/page.tsx', 'components/MyRecords.tsx', 'components/records/ReceiptPreview.tsx',
  'components/records/RecordQuantityFields.tsx', 'components/records/RecordQuantitySummary.tsx',
  'lib/expense-receipts.ts', 'lib/duplicate-income.ts', 'lib/credit-pack-pdf.ts', 'lib/farm-records.ts',
  'lib/records-regional-drafts.ts', 'app/api/read-slip/route.ts', 'lib/api-auth.ts', 'lib/i18n.tsx',
  'lib/i18n-pending.ts', 'lib/learner-ui-english.ts', 'components/CropSelect.tsx', 'lib/invoices.ts', 'lib/crop-entry.ts', 'components/CashflowChart.tsx', 'components/FinanceGraphs.tsx', 'components/ComingUpHarvests.tsx', 'components/HarvestReconciliation.tsx', 'components/AreaReturnCards.tsx', 'app/invoice/page.tsx', 'lib/invoice-entry.ts'].map(read).join('\n');

test('English is untouched: no draft is ever returned for English, and English labels are byte-identical', () => {
  for (const key of Object.keys(RECORDS_DRAFTS)) {
    assert.equal(recordsDraft('en', key), null);
    assert.equal(recordsFill('en', key), key);
    assert.equal(recordsPaired('en', key), key);
  }
  for (const unit of RECORD_UNITS) {
    for (const quantity of [1, 2.5, 12, 1000]) {
      const row = { quantity, unit, kg: unit === 'kg' ? quantity : null };
      // w18-39: kilograms deliberately use the app's shared kg format ('1 000,0 kg'); every other unit stays byte-identical.
      const expected = unit === 'kg' ? kgPreciseLabel(quantity) : recordQuantityLabel(row);
      assert.equal(recordsQuantityLabel(row, 'en'), expected, `${unit} ${quantity}`);
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
function displayedEnglish(node: ts.Node | undefined, found: Set<string>): void {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { found.add(node.text); return; }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    displayedEnglish(node.expression, found); return;
  }
  if (ts.isConditionalExpression(node)) {
    // Predicate literals describe control state; only the returned branches are copy.
    displayedEnglish(node.whenTrue, found); displayedEnglish(node.whenFalse, found); return;
  }
  if (ts.isBinaryExpression(node)) {
    if ([ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      displayedEnglish(node.left, found); displayedEnglish(node.right, found);
    } else if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) displayedEnglish(node.right, found);
  }
}

function englishLiteralsIn(source: string, helpers: string[]): Set<string> {
  const found = new Set<string>();
  const tree = ts.createSourceFile('displayed-copy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && helpers.includes(node.expression.text)) {
      const first = node.expression.text === 'text' || node.expression.text === 'tx';
      displayedEnglish(node.arguments[first ? 0 : 1], found);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); return found;
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
    const missing = [...literals].filter((english) => !/[A-Za-z]{2}/.test(english) ? false : recordsDraft(lang, english) === null && !held.has(english) && recordsEnglishHoldReason(lang, english) === null);
    assert.deepEqual(missing, [], `${lang}: English shown on the money book with neither a draft nor a recorded hold`);
  }
});

test('the draft packet and the shipped table agree: only accepted drafts ship, held rows never do', () => {
  for (const lang of ['zu', ...LANGS] as const) {
    const rows = JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{ english: string; status: string; draft: string }>;
    for (const row of rows) {
      const retired = retiredArchive.entries.find(entry => entry.english === row.english);
      if (row.status === 'accepted' && retired) {
        assert.equal(retired.translations[lang], row.draft, `${lang} retired draft must preserve its original accepted-packet wording`);
        assert.equal(RECORDS_DRAFTS[row.english]?.[lang], undefined, `${lang} stale universal Rand claim must remain retired`);
      } else if (row.status === 'accepted') assert.equal(RECORDS_DRAFTS[row.english]?.[lang], row.draft, `${lang} accepted draft missing or different in the table: ${row.english}`);
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
  // Round 4 retried the device-only photo warning without 'xitirhisiwa' (device/tool, ambiguous): the draft now says
  // 'this phone only'. The ambiguous word itself must still never ship.
  const photo = recordsDraft('ts', 'Original photo · saved on this device only');
  assert.ok(photo === null || !/xitirhisiwa/i.test(photo), 'the ambiguous device/tool word must not return');
});

/* ── Charts tab: the same guarantee for the five chart components ─────────────────────────────── */

/** English literals a Charts component hands to the draft lookup: helper calls, template=, and static english=. */
function chartEnglish(source: string): Set<string> {
  const found = englishLiteralsIn(source, ['recordsFill', 'recordsTemplate', 'recordsLabel', 'text', 'tx']);
  const tree = ts.createSourceFile('chart-copy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && ['english', 'template'].includes(node.name.text)) {
      const value = node.initializer;
      displayedEnglish(value && ts.isJsxExpression(value) ? value.expression : value, found);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); return found;
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
    const missing = [...literals].filter((english) => /[A-Za-z]{2}/.test(english) && recordsDraft(lang, english) === null && !held.has(english) && recordsEnglishHoldReason(lang, english) === null);
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

/* ── Invoice page: the same guarantees for /invoice ───────────────────────────────────────────── */

const INVOICE_PAGE = read('app/invoice/page.tsx');
// Buyer-type names are the VALUE of the customer list and print as the buyer name on the invoice,
// so their labels are deliberately not translated (see the packet README, "Round 3").
const INVOICE_NOT_WIRED = new Set(['Neighbour', 'Spaza shop', 'Bakkie trader', 'Market stall', 'Hawker', 'School', 'Crèche', 'Church', 'Restaurant or lodge', 'Co-op']);
const INVOICE_TECHNICAL = new Set(['kg', 'guide price from']);

/** Every English sentence the invoice screen can hand to ui() or the template lookup. */
function invoiceEnglish(): Set<string> {
  const found = new Set<string>();
  for (const m of INVOICE_PAGE.matchAll(/\bui\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g)) found.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
  for (const m of INVOICE_PAGE.matchAll(/recordsTemplate\(lang, '((?:[^'\\\n]|\\.)*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
  for (const m of INVOICE_PAGE.matchAll(/\{ label: '((?:[^'\\\n]|\\.)*)', days:/g)) found.add(m[1]); // payment terms chips
  for (const m of read('lib/invoice-entry.ts').matchAll(/return '((?:[^'\\\n]|\\.)*)'/g)) { if (/[a-z]{3} [a-z]{3}/.test(m[1])) found.add(m[1]); } // validation messages shown via ui(error.message)
  for (const m of INVOICE_PAGE.matchAll(/\? '((?:Estimated|Recommended)[^']*)'|: '(Sourced guide\.)'/g)) found.add(m[1] ?? m[2]);
  found.add('Enter a positive quantity. Eggs and items need whole numbers.');
  for (const name of [...INVOICE_NOT_WIRED, ...INVOICE_TECHNICAL]) found.delete(name);
  return found;
}

test('every English sentence the invoice page renders has a draft or an explicit hold in each regional language', () => {
  const literals = invoiceEnglish();
  assert.ok(literals.size > 120, `expected the whole invoice screen, found ${literals.size}`);
  const packet = (lang: string) => JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{ english: string; status: string }>;
  for (const lang of LANGS) {
    const held = new Set(packet(lang).filter((row) => row.status === 'held').map((row) => row.english));
    const missing = [...literals].filter((english) => /[A-Za-z]{2}/.test(english) && recordsDraft(lang, english) === null && !held.has(english) && recordsEnglishHoldReason(lang, english) === null);
    assert.deepEqual(missing, [], `${lang}: English on the invoice page with neither a draft nor a recorded hold`);
  }
});

test('invoice page ui(): regional languages read the English-keyed lookup, English is untouched, isiZulu keeps its wording', () => {
  assert.match(INVOICE_PAGE, /if \(!isRecordsRegionalLang\(lang\)\) return english;/, 'any other language keeps English');
  assert.match(INVOICE_PAGE, /INVOICE_PAIRED_COPY\.has\(english\) \? recordsPaired\(lang, english\) : recordsFill\(lang, english\)/, 'sentences a farmer acts on keep the English beside the draft');
  assert.match(INVOICE_PAGE, /recordsFill\('zu', english, isiZulu \?\? INVOICE_ZU\[english\] \?\? english\)/, 'existing isiZulu wording wins; a draft only fills an English fallback');
  assert.match(INVOICE_PAGE, /INVOICE_PAIRED_COPY\.has\(english\) && zulu !== english/, 'a paired sentence is paired only when there is a translation to pair (it used to print the English twice)');
  assert.match(INVOICE_PAGE, /recordsFill\(lang, paymentMethodLabel\(method\)\)/);
  assert.match(INVOICE_PAGE, /recordsQuantityLabel\(sale, lang\)/);
  assert.doesNotMatch(INVOICE_PAGE, /recordQuantityLabel\(/, 'the recorded-sale picker must not bypass the unit-word lookup');
  assert.match(INVOICE_PAGE, /data-records-draft-notice=\{lang\}/);
  assert.match(INVOICE_PAGE, /The invoice a buyer receives \(print and PDF\) stays in English\./);
});

test('the price-guide sentences keep their rand figure and date when drafted', () => {
  for (const lang of ['en', 'zu', ...LANGS]) {
    for (const [template, vars] of [
      ['Shops/bulk about R{price}/kg', { price: 12.5 }], ['Direct/farm gate about R{price}/kg', { price: 18 }],
      ['direct/farm gate about R{price}/kg', { price: 18 }], ['shops/bulk about R{price}/kg', { price: 12.5 }],
      ['guide price from {date}.', { date: 'Oct 2026' }],
    ] as const) {
      const shown = recordsTemplate(lang, template, null, vars);
      assert.doesNotMatch(shown, /\{[a-zA-Z]+\}/, `${lang}: unfilled placeholder in "${template}"`);
      for (const value of Object.values(vars)) assert.ok(shown.includes(String(value)), `${lang}: "${template}" lost its figure`);
    }
  }
  assert.equal(recordsTemplate('en', 'Shops/bulk about R{price}/kg', null, { price: 12.5 }), 'Shops/bulk about R12.5/kg');
});

test('the invoice a buyer receives stays English whatever the farmer reads: print and PDF ignore the regional languages', async () => {
  const { buildInvoiceDocument } = await import('../lib/invoice-document.ts');
  const input = {
    no: 44, issuedISO: '2026-06-24T08:00:00.000Z', seller: { name: 'Thandi Mbeki' }, buyer: { name: 'Spar Nquthu' },
    items: [{ desc: 'Amadumbe', qty: 8, unit: 'bags', price: 95 }], status: 'paid' as const, paidAt: '2026-06-25T08:00:00.000Z', paymentMethod: 'eft' as const,
    dueISO: '2026-07-24T08:00:00.000Z',
  };
  const english = buildInvoiceDocument({ ...input, language: 'en' });
  for (const lang of LANGS) assert.deepEqual(buildInvoiceDocument({ ...input, language: lang }), english, `${lang}: the document must be the English one`);
  assert.notDeepEqual(buildInvoiceDocument({ ...input, language: 'zu' }), english, 'isiZulu documents are unchanged by this round');
});


test('coverage extracts both displayed branches without treating a condition status as copy', () => {
  const source = `recordsTemplate(lang, moneyReview.status === 'held'
    ? 'Held physical total: {kg}.' : 'Ready physical total: {kg}.', null, vars);`;
  assert.deepEqual([...englishLiteralsIn(source, ['recordsTemplate'])], ['Held physical total: {kg}.', 'Ready physical total: {kg}.']);
  const known = new Set(['Ready physical total: {kg}.']);
  assert.deepEqual([...englishLiteralsIn(source, ['recordsTemplate'])].filter(text => !known.has(text)), ['Held physical total: {kg}.'], 'a newly displayed branch must still fail draft/hold coverage');
  assert.deepEqual([...englishLiteralsIn(`recordsText(lang, condition ? 'held' : 'Ready label', 'zu');`, ['recordsText'])], ['held', 'Ready label'], 'a genuinely displayed held label must not be exempted');
});

test('chart template coverage keeps complete placeholder strings and both branches despite braces in the quoted copy', () => {
  const source = `<Figure template={state === 'held' ? 'Held: {picked} and {sold}.' : 'Ready: {picked}.'} english="Visible label" />`;
  const actual = chartEnglish(source);
  assert.deepEqual([...actual], ['Held: {picked} and {sold}.', 'Ready: {picked}.', 'Visible label']);
  assert.ok(!actual.has('held'));
  const covered = new Set(['Ready: {picked}.', 'Visible label']);
  assert.deepEqual([...actual].filter(value => !covered.has(value)), ['Held: {picked} and {sold}.'], 'placeholder braces must not conceal an untranslated branch');
});

test('new financial qualifications have explicit English holds with reasons, not invented regional drafts', () => {
  assert.ok(Object.keys(RECORDS_ENGLISH_HOLDS).length > 0);
  for (const [english, reason] of Object.entries(RECORDS_ENGLISH_HOLDS)) {
    assert.ok(reason.trim().length > 20);
    for (const lang of LANGS) {
      assert.equal(recordsEnglishHoldReason(lang, english), reason);
      assert.equal(recordsDraft(lang, english), null);
      assert.equal(recordsFill(lang, english), english);
      assert.equal(recordsPaired(lang, english), english);
    }
  }
  for (const lang of LANGS) assert.equal(recordsEnglishHoldReason(lang, 'held'), null);
  assert.equal(recordsEnglishHoldReason('en', 'Download PDF'), null);
});

test('retired universal Rand drafts retain exact original packet wording and source identity without regeneration reviving them', () => {
  assert.equal(retiredArchive.entries.length, 3);
  assert.equal(retiredArchive.sourceFile, 'lib/records-regional-drafts-data.ts');
  assert.match(retiredArchive.sourceFileSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(RECORDS_RETIRED_SOURCES).sort(), retiredArchive.entries.map(entry => entry.english).sort());
  const currentGraphSources = chartEnglish(read('components/FinanceGraphs.tsx'));
  for (const entry of retiredArchive.entries) {
    assert.equal(entry.status, 'retired'); assert.ok(entry.reason.length > 20);
    assert.equal(createHash('sha256').update(entry.english).digest('hex'), entry.messageSha256);
    assert.equal(entry.sourceFile, retiredArchive.sourceFile); assert.equal(entry.sourceFileSha256, retiredArchive.sourceFileSha256);
    assert.ok(currentGraphSources.has(entry.replacementEnglish), 'replacement must be actual displayed graph copy');
    assert.equal(Object.hasOwn(RECORDS_DRAFTS, entry.english), false, 'generated history must not silently restore a stale active row');
    for (const lang of LANGS) {
      const historical = JSON.parse(read(`docs/translation-reviews/records-finance-2026-10-06/draft-${lang}.json`)) as Array<{english:string;status:string;draft:string}>;
      const original = historical.find(row => row.english === entry.english); assert.ok(original);
      assert.equal(original.status, 'accepted'); assert.equal(entry.translations[lang], original.draft);
      assert.equal(recordsDraft(lang, entry.english), null);
    }
  }
  const entry = retiredArchive.entries[0], key = entry.english;
  // Even if the historical generator is run unchanged, the source-key retirement
  // gate must refuse that exact row; the table assertion above also notices it.
  RECORDS_DRAFTS[key] = { st: entry.translations.st, ve: entry.translations.ve, ts: entry.translations.ts };
  try { for (const lang of LANGS) assert.equal(recordsDraft(lang, key), null); }
  finally { delete RECORDS_DRAFTS[key]; }
});
