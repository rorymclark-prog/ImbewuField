// The Afrikaans drafts for the app's inline English (lib/xh-inline.ts, lib/locales/af-inline/).
// Keyed by exact English, like the isiXhosa shards: every key must be English some screen still
// shows, so a key no source file contains is a retired draft and must be removed or re-drafted.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

import { AF_INLINE_SOURCE } from '@/lib/locales/af-inline/index';
import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';
import { inlineDraft, inlineTemplate, inlineText, isInlineDraftLang, placeholdersOf, registerInlineDrafts, registerXhInline } from '@/lib/xh-inline';

const ROOT = new URL('..', import.meta.url).pathname;
const SHARD_DIR = join(ROOT, 'lib/locales/af-inline');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales' && name !== 'node_modules') sourceFiles(path, out); }
    else if (/\.(tsx?|mjs|json)$/.test(name)) out.push(path);
  }
  return out;
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => sourceFiles(join(ROOT, d))).map((f) => readFileSync(f, 'utf8')).join('\n');
const inSource = (english: string) => [english, english.replace(/'/g, "\\'"), english.replace(/"/g, '\\"'), english.replace(/’/g, "\\u2019"), JSON.stringify(english).slice(1, -1)]
  .some((form) => SOURCE.includes(form));
const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join('|');

test('every Afrikaans shard is spread into the index', () => {
  const index = readFileSync(join(SHARD_DIR, 'index.ts'), 'utf8');
  for (const shard of readdirSync(SHARD_DIR).filter((n) => n !== 'index.ts' && n.endsWith('.ts'))) {
    const name = shard.replace(/\.ts$/, '');
    assert.match(index, new RegExp(`from '\\./${name}'`), `${shard} is not imported by lib/locales/af-inline/index.ts`);
  }
});

test('every Afrikaans draft keeps its English {placeholders} and numbers and is not blank', () => {
  for (const [english, afrikaans] of Object.entries(AF_INLINE_SOURCE)) {
    assert.ok(afrikaans.trim() !== '', `blank draft for ${JSON.stringify(english)}`);
    assert.equal(placeholdersOf(afrikaans), placeholdersOf(english), `placeholder drift for ${JSON.stringify(english)}`);
    assert.equal(numbers(afrikaans), numbers(english), `number drift for ${JSON.stringify(english)}`);
  }
});

test('every Afrikaans key is English that a source file still shows', () => {
  const stale = Object.keys(AF_INLINE_SOURCE).filter((english) => !inSource(english));
  assert.deepEqual(stale, [], 'retire or re-draft these Afrikaans inline drafts');
});

test('Afrikaans covers every English string isiXhosa covers', () => {
  const missing = Object.keys(XH_INLINE_SOURCE).filter((english) => !(english in AF_INLINE_SOURCE));
  assert.deepEqual(missing, [], 'draft Afrikaans for these inline strings');
});

test('lookups: each draft language reads only its own map; everyone else gets English', () => {
  registerXhInline({ 'Save': 'Gcina' });
  registerInlineDrafts('af', { 'Save': 'Stoor', '{n} entries': '{n} inskrywings', 'Bad {n}': 'Sleg' });
  assert.equal(inlineText('af', 'Save', 'Londoloza'), 'Stoor');
  assert.equal(inlineText('xh', 'Save', 'Londoloza'), 'Gcina');
  assert.equal(inlineText('zu', 'Save', 'Londoloza'), 'Londoloza');
  assert.equal(inlineText('st', 'Save'), 'Save');
  assert.equal(inlineText('af', 'Not drafted'), 'Not drafted');
  assert.equal(inlineTemplate('af', '{n} entries', null, { n: 3 }), '3 inskrywings');
  // A draft that dropped its placeholder would lose the figure, so English is shown.
  assert.equal(inlineDraft('af', 'Bad {n}'), null);
  registerXhInline(XH_INLINE_SOURCE);
  registerInlineDrafts('af', AF_INLINE_SOURCE);
});

// ── The second browser sweep (2 Nov 2026): the Afrikaans mirrors of the isiXhosa fixes in tests/xh-inline.test.ts ──
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

test('g51: the survey picker, the funder-sharing checkbox and the Design notice lead-ins have Afrikaans drafts with their figures intact', () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  registerXhInline(XH_INLINE_SOURCE);
  const keys = [
    'What are you preparing?',
    'Choose the purpose, then the questionnaire length. Your maps and production plan remain linked to this site.',
    'Understand the site, constraints and possibilities before detailed design.',
    'Bring the site survey, saved maps and whole-year production plan together. Missing evidence stays visible.',
    'Share this summary with funders',
    'isiXhosa draft.',
    'Afrikaans draft.',
  ];
  for (const english of keys) {
    const draft = inlineDraft('af', english);
    assert.ok(draft && draft !== english, `no Afrikaans draft for ${JSON.stringify(english)}`);
    assert.equal(inlineText('en', english), english, 'English is untouched');
    assert.equal(inlineText('zu', english), english, 'isiZulu without its own wording stays English');
    for (const lang of ['st', 'ts', 've']) assert.equal(inlineText(lang, english), english, `${lang} stays English`);
  }
  // The isiXhosa wording is untouched by the Afrikaans shard.
  assert.equal(inlineText('xh', 'isiXhosa draft.'), XH_INLINE_SOURCE['isiXhosa draft.']);
  assert.equal(inlineDraft('xh', 'Afrikaans draft.'), null, 'isiXhosa never shows the Afrikaans lead-in');
  // Afrikaans reads the same SiteSurveySheet / SampleProgramme call sites as isiXhosa: the inline lookup is per language.
  assert.match(read('components/SiteSurveySheet.tsx'), /<legend>\{inlineText\(lang, 'What are you preparing\?'\)\}<\/legend>/);
  assert.match(read('components/SampleProgramme.tsx'), /\{inlineText\(lang, 'Share this summary with funders'\)\}/);
});

test('the Design pathway notice shows one Afrikaans notice: the draft with its English source, or the English once, never an English pair', () => {
  const notice = read('components/studies/DesignDraftCopy.tsx');
  assert.match(notice, /const draft = inlineDraft\(lang, source\);\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if \(!draft\) return/, 'a missing draft shows the English once');
  assert.match(notice, /if \(!draft\) return [^\n]*<p lang="en"><strong>Afrikaans draft\.<\/strong> \{source\}<\/p>/);
  assert.match(notice, /<strong lang="af">\{inlineText\(lang, 'Afrikaans draft\.'\)\}<\/strong> <span lang="af">\{draft\}<\/span><small lang="en" className=\{styles\.source\}>English source: \{source\}<\/small>/);
  assert.match(notice, /useHydratedLang/, 'it renders English until mounted, like the isiXhosa notice');
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  assert.ok(inlineDraft('af', 'Navigation, headings, lesson text and exercise prompts on this pathway are unreviewed Afrikaans drafts. Model measurements and narration remain in English.'));
});

test('/student shows one Afrikaans draft banner, not the generic note stacked on the dedicated one', () => {
  const page = read('app/student/page.tsx');
  assert.match(page, /\{lang !== 'xh' && lang !== 'af' && <LanguageDraftNote lang=\{lang\} scope="student" \/>\}/);
  assert.match(page, /<span lang="af">\{inlineText\(lang, 'Unreviewed Afrikaans machine draft\.'\)\}<\/span>/, 'the dedicated Afrikaans note stays');
});

test('/prices labels the English duplicate as the English source for Afrikaans too, and /atlas already did', () => {
  const prices = read('app/prices/page.tsx');
  assert.match(prices, /\(lang === 'xh' \|\| lang === 'af'\) && t\('pricesChooseCrop'\) !== translate\('en', 'pricesChooseCrop'\)/, 'no pair when there is no draft');
  assert.match(prices, /lang === 'zu' \? <>\{t\('pricesChooseCrop'\)\}<span className="block mt-1">\{translate\('en', 'pricesChooseCrop'\)\}<\/span><\/>/, 'isiZulu unchanged');
  assert.equal((read('components/atlas/AtlasExplorer.tsx').match(/\{isXhosa \? `\$\{inlineText\(lang, 'English source:'\)\} ` : ''\}/g) ?? []).length, 2);
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  assert.equal(inlineText('af', 'English source:'), 'Engelse bron:');
});

test('the /records tab notice belongs to the regional languages only; Afrikaans tabs are translated and carry no "English tabs" claim', async () => {
  const { isRecordsRegionalLang } = await import('@/lib/records-regional-drafts');
  assert.equal(isRecordsRegionalLang('af'), false, 'Afrikaans never reaches the English-tabs sentence');
  const records = read('app/records/page.tsx');
  // The old fully-English "The tabs are shown in ...; English names:" sentence is gone for every draft language: the draft
  // languages get one small "English source:" line naming the tabs, and the three regional languages keep "English tabs:".
  assert.doesNotMatch(records, /The tabs are shown in isiXhosa; English names:/);
  assert.match(records, /\{isRecordsRegionalLang\(lang\) && !isInlineDraftLang\(lang\) && <p role="note" lang="en" data-records-draft-notice=/);
  assert.match(records, /\{isInlineDraftLang\(lang\) && <p lang="en" data-records-tab-source=\{lang\}[^>]*><span lang=\{lang\}>\{inlineText\(lang, 'English source:'\)\}<\/span> /);
  assert.match(records, /<LanguageDraftNote lang=\{lang\} scope="records" \/>/, 'Afrikaans keeps the shared draft note');
});

test('the planner names the month once in Afrikaans counts and messages (the heading keeps the pair)', () => {
  const page = read('app/cropplan/page.tsx');
  assert.match(page, /isInlineDraftLang\(lang\) \? inlineTemplate\(lang, monthTasks\.length === 1 \? '\{n\} job in \{month\}' : '\{n\} jobs in \{month\}', null, \{ n: monthTasks\.length, month: monthNameXh\(cursorMonth - 1\) \}\)/);
  assert.match(page, /isInlineDraftLang\(lang\) \? inlineTemplate\(lang, 'Nothing due from your crop plan in \{month\}\.', null, \{ month: monthNameXh\(cursorMonth - 1\) \}\)/);
  assert.match(page, /isInlineDraftLang\(lang\) \? inlineTemplate\(lang, n === 1 \? '\{month\} — \{n\} job' : '\{month\} — \{n\} jobs', null, \{ month: monthNameXh\(i\), n \}\)/);
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  const line = inlineTemplate('af', '{n} jobs in {month}', null, { n: 3, month: inlineText('af', 'January') });
  assert.equal(line, AF_INLINE_SOURCE['{n} jobs in {month}'].replace('{n}', '3').replace('{month}', inlineText('af', 'January')));
  assert.doesNotMatch(line, /January/, 'the English month is not repeated inside the Afrikaans sentence');
});

test('the funder cohort month axis uses the Afrikaans book months for Afrikaans only, never the shared month tables', async () => {
  const { recordsBookMonthShort, recordsMonthShort } = await import('@/lib/records-months');
  const charts = read('components/funder/CohortCharts.tsx');
  assert.match(charts, /: lang === 'af'\s*\n\s*\? series\.months\.map\(\(m\) => \(\{ \.\.\.m, label: recordsBookMonthShort\(lang, m\.month\), longLabel: `\$\{recordsBookMonthShort\(lang, m\.month\)\} \$\{m\.year\}` \}\)\)\s*\n\s*: series\.months/);
  assert.deepEqual([12, 1, 3, 10].map((m) => recordsBookMonthShort('af', m)), ['Des', 'Jan', 'Mrt', 'Okt']);
  assert.deepEqual([12, 1, 10].map((m) => recordsBookMonthShort('en', m)), ['Dec', 'Jan', 'Oct']);
  assert.equal(recordsMonthShort('af', 3), 'Mar', 'the shared tables stay English for Afrikaans on purpose');
});

test('the shared draft note now covers Afrikaans on the seven pages that had none, and still nothing else', () => {
  const note = read('components/XhosaDraftNote.tsx');
  assert.match(note, /if \(lang !== 'xh' && lang !== 'af'\) return null;/);
  assert.match(note, /<LanguageDraftNote lang=\{lang\} scope=\{scope\} \/>/);
  for (const [path, scope] of [
    ['app/contact/page.tsx', 'contact'], ['app/design/page.tsx', 'design'], ['app/network/page.tsx', 'network'],
    ['app/partners/page.tsx', 'partners'], ['app/vision/page.tsx', 'vision'], ['app/samples/gardens/page.tsx', 'sample-gardens'],
    ['components/studies/AppGuidePage.tsx', 'student-guides'],
  ]) assert.match(read(path), new RegExp(`<XhosaDraftNote scope="${scope}"`), `${path} carries the note`);
});

// ── The third sample-mode sweep (2 Nov 2026): the Afrikaans mirror of xh-inline's g50 test ──────────
test('g52: the scale exercise notice and the words on the scale diagram have Afrikaans drafts with their figures intact', async () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  registerXhInline(XH_INLINE_SOURCE);
  const { SCALE_NOTICE } = await import('@/lib/design-scale');
  const keys = [
    SCALE_NOTICE,
    'MODEL ONLY · not site measurements',
    'No gap',
    'Outer width: {width} m',
  ];
  // The Afrikaans shard has exactly the keys the isiXhosa shard has: the curly apostrophe in the notice is kept.
  const g52 = (await import('@/lib/locales/af-inline/g52-ui-gaps-3')).default;
  const g50 = (await import('@/lib/locales/xh-inline/g50-ui-gaps-3')).default;
  assert.deepEqual(Object.keys(g52).sort(), Object.keys(g50).sort());
  assert.deepEqual(Object.keys(g52).sort(), [...keys].sort());
  for (const english of keys) {
    const draft = inlineDraft('af', english);
    assert.ok(draft && draft !== english, `no Afrikaans draft for ${JSON.stringify(english)}`);
    assert.equal(placeholdersOf(draft), placeholdersOf(english), 'placeholders are kept');
    assert.equal(numbers(draft), numbers(english), 'figures are kept');
    assert.equal(inlineText('en', english), english, 'English is untouched');
    assert.equal(inlineText('zu', english), english, 'isiZulu without its own wording stays English');
    for (const lang of ['st', 'ts', 've']) assert.equal(inlineText(lang, english), english, `${lang} stays English`);
    // isiXhosa keeps its own wording, byte for byte.
    assert.equal(inlineDraft('xh', english), g50[english]);
  }
  assert.equal(placeholdersOf(inlineDraft('af', 'Outer width: {width} m')!), 'width');
  assert.equal(inlineTemplate('af', 'Outer width: {width} m', null, { width: '4,5' }), 'Buitewydte: 4,5 m');
  assert.equal(inlineTemplate('xh', 'Outer width: {width} m', null, { width: '4,5' }), 'Ububanzi bangaphandle: 4,5 m');
  assert.equal(inlineTemplate('en', 'Outer width: {width} m', null, { width: '4,5' }), 'Outer width: 4,5 m');
  // Afrikaans reads the very call sites isiXhosa does: the lookup is per language.
  const diagram = read('components/studies/DesignScaleDiagram.tsx');
  assert.match(diagram, /\{inlineText\(lang, 'MODEL ONLY · not site measurements'\)\}/);
  assert.match(diagram, /\{inlineText\(lang, 'No gap'\)\}/);
  assert.match(diagram, /inlineTemplate\(lang, 'Outer width: \{width\} m', null, \{ width: n\(model\.outerWidthM\) \}\)/);
  assert.match(read('components/studies/DesignDraftCopy.tsx'), /const xhosa = isInlineDraftLang\(lang\) \? inlineDraft\(lang, en\) : null;/);
});

test('Afrikaans is an inline-draft language, so the Manual link, /atlas, /tour and the Tour guide dialog pick it up with no literal list', () => {
  assert.equal(isInlineDraftLang('af'), true);
  assert.equal(isInlineDraftLang('xh'), true);
  for (const other of ['en', 'zu', 'st', 'ts', 've']) assert.equal(isInlineDraftLang(other), false);
  // Exactly one definition of the draft-language list and check.
  const lib = read('lib/xh-inline.ts');
  assert.equal((lib.match(/export const INLINE_DRAFT_LANGS/g) ?? []).length, 1);
  assert.equal((lib.match(/export function isInlineDraftLang/g) ?? []).length, 1);
  assert.match(lib, /INLINE_DRAFT_LANGS = \['xh', 'af'\] as const/);
  // The Manual chapter's English link reads content/manual/af/ui.json.
  const af = JSON.parse(read('content/manual/af/ui.json')) as Record<string, string>;
  assert.equal(af.readInEnglish, 'Lees hierdie hoofstuk in Engels');
  assert.notEqual(af.readInEnglish, JSON.parse(read('content/manual/en/ui.json')).readInEnglish);
  assert.match(read('app/manual/[lang]/[slug]/page.tsx'), /\{isInlineDraftLang\(lang\)\s*\n\s*\? <Link href=\{`\/manual\/en\/\$\{slug\}`\} hrefLang="en" lang=\{lang\}[^>]*>\{ui\.readInEnglish\}/);
  // /atlas shows the shared draft note for Afrikaans, and that note covers Afrikaans.
  assert.match(read('app/atlas/page.tsx'), /\|\|isInlineDraftLang\(lang\)\)&&<div className="px-3 py-2"><LanguageDraftNote lang=\{lang\} scope="atlas" \/>/);
  assert.match(read('components/LanguageDraftNote.tsx'), /lang !== 'xh' && lang !== 'af' && !\['zu', 'st', 'ts', 've'\]\.includes\(lang\)/);
  // /tour and the guide dialog share one condition.
  assert.match(read('app/tour/page.tsx'), /const draftLang = \['zu','st','ts','ve'\]\.includes\(lang\) \|\| isInlineDraftLang\(lang\)/);
  assert.match(read('components/ProductTourProvider.tsx'), /const draftLang = \['zu','st','ts','ve'\]\.includes\(lang\) \|\| isInlineDraftLang\(lang\)/);
});

/* ── Fourth sweep parity (2 Nov): g54 mirrors the isiXhosa g52, one notice, consistent rand format ─────────────── */

test('g54: the Afrikaans interactive-screen shard mirrors the isiXhosa g52 key for key, with placeholders and figures intact', async () => {
  const { default: xhShard } = await import('@/lib/locales/xh-inline/g52-interactive');
  const { default: afShard } = await import('@/lib/locales/af-inline/g54-interactive');
  assert.equal(Object.keys(afShard).length, 166);
  assert.deepEqual(Object.keys(afShard), Object.keys(xhShard));
  for (const english of Object.keys(xhShard)) {
    assert.equal(AF_INLINE_SOURCE[english], afShard[english], `${english} is served from g54`);
    assert.notEqual(afShard[english], english, `${english} has a real draft`);
  }
  // The two isiXhosa navigation-note keys were retired with the duplicate drawer notice; Afrikaans drops its copies too.
  for (const retired of ['ISIXHOSA MACHINE DRAFT.', 'Navigation wording has not been reviewed by a fluent isiXhosa speaker.',
    'AFRIKAANS MACHINE DRAFT.', 'Navigation wording has not been reviewed by a fluent Afrikaans speaker.']) {
    assert.equal(retired in AF_INLINE_SOURCE, false, retired);
  }
  // Compass emphasis and product names survive.
  assert.match(afShard['The gold arc across the top of the map is the sun. In South Africa it swings across the NORTH, so that side gets the most light.'], /NOORDE/);
  assert.match(afShard['See the downhill water arrow — swales will go ACROSS it'], /DWARS/);
  assert.match(afShard['Tap a JoJo tank size, then tap the map next to a roof.'], /JoJo/);
});

test('ProductionYearOverview: Afrikaans reads the drafts; English, isiZulu, Sesotho, Xitsonga and Tshivenda stay English', async () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  const overview = read('components/report/ProductionYearOverview.tsx');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const ts = (await import('typescript')).default;
  const compiled = ts.transpileModule(overview.replace(/^import .*$/gm, '').replace('export default function', 'function'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const Overview = new Function('React', 'pdfIconUrl', 'styles', 'inlineText', 'inlineTemplate', 'isInlineDraftLang', `${compiled}; return ProductionYearOverview;`)(
    React, () => null, {}, inlineText, inlineTemplate, isInlineDraftLang);
  const html = (language: string) => renderToStaticMarkup(React.createElement(Overview, { language }));
  const af = html('af');
  assert.match(af, /<section lang="af" aria-label="Jaarlikse voedsel- en produkplan">/);
  assert.match(af, /<h3>Voedsel en produkte deur die jaar<\/h3>/);
  assert.match(af, /Die produknaam en aantekeninge in hierdie tabel word in Engels gewys\./);
  assert.doesNotMatch(af, /This production overview is currently in English/);
  assert.doesNotMatch(af, /Food and products through the year/);
  // Every other language keeps the English markup exactly as before.
  const english = html('en');
  assert.match(english, /<h3>Food and products through the year<\/h3>/);
  assert.match(english, /aria-label="Annual food and product plan"/);
  for (const language of ['zu', 'st', 'ts', 've']) {
    const shown = html(language);
    assert.equal(shown.replace('<p>This production overview is currently in English.</p>', ''), english, `${language} is the English overview apart from its one notice`);
    assert.match(shown, /This production overview is currently in English\./);
    assert.doesNotMatch(shown, /lang="(af|xh)"/);
  }
  assert.equal(inlineTemplate('af', '{name}: planning window in {month}', null, { name: 'Maize', month: 'Jan' }), 'Maize: beplanningsvenster in Jan');
  // With a saved plan: the table headings, kind labels and cell labels read Afrikaans; the plan's own names stay as saved, marked English.
  const production = { months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], rows: [
    { id: 'animal:eggs', name: 'Eggs', product: 'Eggs', kind: 'animal', note: 'Housing does not set numbers.', months: [0, 1], reference: false },
    { id: 'crop:maize:1', name: 'Maize', product: 'Grain', kind: 'crop', note: '', months: [2], reference: true },
  ] };
  const withRows = (language: string) => renderToStaticMarkup(React.createElement(Overview, { language, production }));
  const afRows = withRows('af');
  assert.match(afRows, /<strong>P<\/strong> Plan of plaaslik aangetekende seisoen · <strong>R<\/strong> Verwysing uit bronne/);
  assert.match(afRows, /<th scope="col">Produk<\/th>/);
  assert.match(afRows, /<span lang="af">Dierlike produk<\/span>/);
  assert.match(afRows, /<span lang="af">Gewas<\/span>/);
  assert.match(afRows, /aria-label="Eggs: beplanningsvenster in Jan"/);
  assert.match(afRows, /aria-label="Maize: verwysingseisoen in Mar"/);
  assert.match(afRows, /<span lang="en">Eggs<small>/);
  assert.match(withRows('en'), /<strong>P<\/strong> Plan or locally recorded season · <strong>R<\/strong> Sourced reference/);
  assert.match(withRows('en'), /<th scope="col">Product<\/th>/);
  assert.match(withRows('en'), /Eggs · Animal product<\/small>/);
  assert.match(withRows('zu'), /aria-label="Eggs: planning window in Jan"/);
});

test('Sold tab: Afrikaans gets exactly one draft notice (the shared one), the English tab names as a source line, and no second card note', () => {
  const records = read('app/records/page.tsx');
  const card = read('components/MyRecords.tsx');
  assert.equal((records.match(/<LanguageDraftNote /g) ?? []).length, 1, 'one shared notice on /records');
  assert.doesNotMatch(card, /lang === 'af' && <p role="note"/, 'the Sold card adds no Afrikaans notice of its own');
  assert.doesNotMatch(card, /AFRIKAANS MACHINE DRAFT/);
  // The tab-source line is the only other draft line, and it is a label, not a second notice.
  assert.equal((records.match(/data-records-tab-source=\{lang\}/g) ?? []).length, 1);
  assert.equal((records.match(/data-records-draft-notice=/g) ?? []).length, 1);
  // The draft-first pairing works for Afrikaans, reusing the existing "English source:" draft.
  assert.equal(inlineText('af', 'English source:'), 'Engelse bron:');
});

test('rand amounts on /records: Afrikaans uses one convention (R7 470,00); every other language is unchanged', async () => {
  const { randForLang, randAmountForLang, randCentsLabel } = await import('@/lib/format-figures');
  // Before: the Sold tab's total read 'R18800', the sale rows 'R 280.00' and the receipt 'R 280.00' beside 'R7 470,00'.
  assert.equal(randForLang('af', 18800, 'R18800'), 'R18 800,00');
  assert.equal(randForLang('af', 280, 'R 280.00'), 'R280,00');
  assert.equal(randForLang('af', 7470, 'R 7470.00'), 'R7 470,00');
  assert.equal(randForLang('af', 0, 'R 0'), 'R0,00');
  assert.equal(randForLang('af', 1234.5, 'R1234.50'), randCentsLabel(1234.5));
  assert.equal(randAmountForLang('af', 37.5, '37.50'), '37,50');
  assert.equal(randAmountForLang('af', 12345.6, '12345.60'), '12 345,60');
  // English and the other languages return the caller's own string, byte for byte.
  for (const lang of ['en', 'zu', 'xh', 'st', 'ts', 've']) {
    assert.equal(randForLang(lang, 18800, 'R18800'), 'R18800', lang);
    assert.equal(randForLang(lang, 280, 'R 280.00'), 'R 280.00', lang);
    assert.equal(randAmountForLang(lang, 37.5, '37.50'), '37.50', lang);
  }
  // Every hand-formatted rand figure on the records surfaces goes through the helper, with its English expression intact.
  const card = read('components/MyRecords.tsx');
  assert.match(card, /randForLang\(lang, EXAMPLE_SALE\.amount, `R \$\{EXAMPLE_SALE\.amount\.toFixed\(2\)\}`\)/);
  assert.match(card, /randForLang\(lang, item\.amount, `R \$\{item\.amount\.toFixed\(2\)\}`\)/);
  assert.match(card, /randForLang\(lang, totalRev, `R\$\{totalRev % 1 === 0 \? totalRev : totalRev\.toFixed\(2\)\}`\)/);
  assert.match(card, /randAmountForLang\(lang, guideLow \* saleKg, \(guideLow \* saleKg\)\.toFixed\(2\)\)/);
  const receipt = read('components/records/ReceiptPreview.tsx');
  assert.equal((receipt.match(/randForLang\(lang, expense\.amount, `R \$\{expense\.amount\.toFixed\(2\)\}`\)/g) ?? []).length, 2);
  assert.match(read('app/records/page.tsx'), /randForLang\(lang, 0, 'R 0'\)/);
  assert.doesNotMatch(card.replace(/randForLang\([^\n]*\n?/g, ''), /\bR \{[a-zA-Z.]+\.toFixed\(2\)\}/, 'no bare "R {x.toFixed(2)}" is left');
});

test('Charts tab: Afrikaans repeats no per-caption draft label and names the English source in Afrikaans; English and the other languages are unchanged', async () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  registerXhInline(XH_INLINE_SOURCE);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const ts = (await import('typescript')).default;
  const compiled = ts.transpileModule(read('components/IsiZuluDraftSource.tsx'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', compiled)((name: string) => {
    if (name === '@/lib/records-regional-drafts') return { isRecordsRegionalLang: () => false, recordsDraft: () => null, recordsTemplate: (_l: string, e: string) => e };
    if (name === '@/lib/xh-inline') return { fillInline: (t: string) => t, inlineText, isInlineDraftLang, inlineDraft };
    return createRequire(import.meta.url)(name);
  }, mod, mod.exports);
  const Source = mod.exports.default as React.ComponentType<any>;
  const english = 'Entries land in the month you recorded them; the logging forms have no date field yet.';
  const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(Source, { english, zulu: '', ...props }));
  // The chart components pass draftLabel={lang !== 'af'}: Afrikaans drops the label, every other language keeps its default.
  const afQuiet = html({ lang: 'af', draftLabel: false });
  assert.doesNotMatch(afQuiet, /Onhersiene Afrikaanse konsep|Unreviewed Afrikaans draft/);
  assert.match(afQuiet, /Engelse bron: <\/span><span lang="en">Entries land in the month/);
  assert.doesNotMatch(afQuiet, /English source:/);
  // Where a screen does not switch it off, the Afrikaans label still leads the source line.
  assert.match(html({ lang: 'af' }), /Onhersiene Afrikaanse konsep\./);
  // English source wording is unchanged for isiXhosa (its own label rule is untouched) and shows nothing for English.
  assert.match(html({ lang: 'xh', xhosa: 'Okufakiweyo' }), /Okufakiweyo.*<span lang="en">English source: Entries land/);
  assert.equal(html({ lang: 'en' }), `<p class="">${english}</p>`);
  for (const file of ['FinanceGraphs', 'CashflowChart', 'AreaReturnCards', 'HarvestReconciliation', 'ComingUpHarvests']) {
    const src = read(`components/${file}.tsx`);
    const total = (src.match(/<IsiZuluDraftSource /g) ?? []).length;
    assert.ok(total > 0);
    assert.equal((src.match(/<IsiZuluDraftSource draftLabel=\{lang !== 'af'\} /g) ?? []).length, total, `${file}: every caption drops the repeated Afrikaans label (the shared note is the one notice)`);
  }
  assert.equal((read('app/records/page.tsx').match(/<LanguageDraftNote /g) ?? []).length, 1, 'the one shared notice on /records');
});

test('Sold card lines: Afrikaans pairs the draft with "Engelse bron:", every other language keeps "English source:"', async () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const ts = (await import('typescript')).default;
  const card = read('components/MyRecords.tsx');
  const start = card.indexOf('function RecordZuluDraft(');
  const body = card.slice(start, card.indexOf('\n}\n', start) + 3);
  const compiled = ts.transpileModule(body, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
  const Draft = new Function('React', 'recordsDraft', 'inlineText', `${compiled}; return RecordZuluDraft;`)(React, (lang: string, e: string) => inlineDraft(lang, e), inlineText);
  const html = (lang: string) => renderToStaticMarkup(React.createElement(Draft, { lang, english: 'Record a sale', isiZulu: 'Qopha ukuthengisa' }));
  const af = html('af');
  assert.match(af, /Engelse bron: <\/span><span lang="en">Record a sale<\/span>/);
  assert.doesNotMatch(af, /English source:/);
  assert.match(html('zu'), /<span lang="en" class="text-xs font-normal" style="color:inherit">English source: Record a sale<\/span>/);
  assert.equal(html('en'), 'Record a sale');
  // The longer pairings (lender card, tooltips) already use the same Afrikaans label.
  assert.equal(inlineText('af', 'English source:'), 'Engelse bron:');
});

test('Afrikaans kg and axis formats: comma decimal on the invoice rows and the Charts axis; English and the other languages are byte-identical', async () => {
  const { invoiceQtyForLang, randTickForLang, randTick, kgPreciseLabel } = await import('@/lib/format-figures');
  // Before: the Sold and Spent tables read '2.5 kg', '14.4 kg', '8 kg' beside the mobile rows' '8,0 kg'; the Charts axis read 'R2.6k', '−R5.7k'.
  assert.equal(invoiceQtyForLang('af', 2.5, 'kg'), '2,5 kg');
  assert.equal(invoiceQtyForLang('af', 14.4, 'kg'), '14,4 kg');
  assert.equal(invoiceQtyForLang('af', 8, 'kg'), '8,0 kg');
  assert.equal(invoiceQtyForLang('af', 1203.6, 'kg'), kgPreciseLabel(1203.6));
  assert.equal(invoiceQtyForLang('af', 2.5, 'KG'), '2,5 kg');
  assert.equal(invoiceQtyForLang('af', 2.5, 'bunches'), '2,5 bunches');
  assert.equal(invoiceQtyForLang('af', 12, 'bunches'), '12 bunches');
  assert.equal(invoiceQtyForLang('af', '3.25', 'bags'), '3,25 bags');
  for (const lang of ['en', 'zu', 'xh', 'st', 'ts', 've']) {
    assert.equal(invoiceQtyForLang(lang, 2.5, 'kg'), '2.5 kg', lang);
    assert.equal(invoiceQtyForLang(lang, 8, 'kg'), '8 kg', lang);
    assert.equal(invoiceQtyForLang(lang, 14.4, 'bunches'), '14.4 bunches', lang);
  }
  assert.equal(randTickForLang('af', 2600), 'R2,6k');
  assert.equal(randTickForLang('af', -5700), '−R5,7k');
  assert.equal(randTickForLang('af', 11000), 'R11k');
  assert.equal(randTickForLang('af', 450), 'R450');
  for (const lang of ['en', 'zu', 'xh', 'st', 'ts', 've']) {
    for (const amount of [2600, -5700, 11000, 450, 0]) assert.equal(randTickForLang(lang, amount), randTick(amount), `${lang} ${amount}`);
  }
  assert.equal(randTick(2600), 'R2.6k');
  // The call sites go through the helpers.
  assert.equal((read('app/records/page.tsx').match(/invoiceQtyForLang\(lang, item\.qty, item\.unit\)/g) ?? []).length, 2);
  assert.doesNotMatch(read('app/records/page.tsx'), /`\$\{item\.qty\} \$\{item\.unit\}`/);
  assert.equal((read('components/CashflowChart.tsx').match(/randTickForLang\(lang, /g) ?? []).length, 4);
  assert.doesNotMatch(read('components/CashflowChart.tsx'), /[^a-zA-Z]randTick\(/);
});
