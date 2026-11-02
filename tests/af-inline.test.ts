// The Afrikaans drafts for the app's inline English (lib/xh-inline.ts, lib/locales/af-inline/).
// Keyed by exact English, like the isiXhosa shards: every key must be English some screen still
// shows, so a key no source file contains is a retired draft and must be removed or re-drafted.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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
  assert.match(records, /\{lang === 'xh' \? 'The tabs are shown in isiXhosa; English names:' : 'English tabs:'\}/);
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
