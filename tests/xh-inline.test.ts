// The isiXhosa drafts for the inline isiZulu branches (lib/xh-inline.ts, lib/locales/xh-inline/).
// Keyed by exact English, so the safety property is that every key is English some screen still
// shows: a key no source file contains is a retired draft and must be removed or re-drafted.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/xh-inline.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';
import { inlineDraftsLoaded, inlineTemplate, inlineText, placeholdersOf, registerInlineDrafts, registerXhInline, xhInlineDraft } from '@/lib/xh-inline';
import { REPORT_DOCUMENT_COPY } from '@/lib/report-localisation';
import { PLAN_ASSURANCE_COPY } from '@/lib/plan-assurance';
import { REPORT_VISUAL_COPY } from '@/lib/report-visuals';
import { REPORT_SUMMARY_COPY } from '@/lib/report-summary';

const ROOT = new URL('..', import.meta.url).pathname;
const SHARD_DIR = join(ROOT, 'lib/locales/xh-inline');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales' && name !== 'node_modules') sourceFiles(path, out); }
    else if (/\.(tsx?|mjs|json)$/.test(name)) out.push(path); // JSON course data (e.g. lib/course-finance-project.json) is shown through the same lookups
  }
  return out;
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => sourceFiles(join(ROOT, d))).map((f) => readFileSync(f, 'utf8')).join('\n');
// Literals may be written with escaped quotes or apostrophes in the source.
// A multi-line course body (the markdown-lite text in lib/course-*-content.json) is stored there with its
// line breaks and quotes JSON-escaped, so that escaped form counts as the source showing it too.
const inSource = (english: string) => [english, english.replace(/'/g, "\\'"), english.replace(/"/g, '\\"'), english.replace(/’/g, "\\u2019"), JSON.stringify(english).slice(1, -1)]
  .some((form) => SOURCE.includes(form));

test('every shard is spread into the index', () => {
  const index = readFileSync(join(SHARD_DIR, 'index.ts'), 'utf8');
  for (const shard of readdirSync(SHARD_DIR).filter((n) => n !== 'index.ts' && n.endsWith('.ts'))) {
    const name = shard.replace(/\.ts$/, '');
    assert.match(index, new RegExp(`from '\\./${name}'`), `${shard} is not imported by lib/locales/xh-inline/index.ts`);
  }
});

test('every draft keeps its English {placeholders} and is not blank', () => {
  for (const [english, xhosa] of Object.entries(XH_INLINE_SOURCE)) {
    assert.ok(xhosa.trim() !== '', `blank draft for ${JSON.stringify(english)}`);
    assert.equal(placeholdersOf(xhosa), placeholdersOf(english), `placeholder drift for ${JSON.stringify(english)}`);
  }
});

test('every key is English that a source file still shows', () => {
  const stale = Object.keys(XH_INLINE_SOURCE).filter((english) => !inSource(english));
  assert.deepEqual(stale, [], 'retire or re-draft these isiXhosa inline drafts');
});

test('lookups: isiZulu keeps its wording, isiXhosa reads the drafts, everyone else gets English', () => {
  registerXhInline({ 'Save': 'Gcina', '{n} entries': 'Amangeniso angu-{n}', 'Bad {n}': 'Ayilunganga' });
  assert.equal(inlineText('zu', 'Save', 'Londoloza'), 'Londoloza');
  assert.equal(inlineText('xh', 'Save', 'Londoloza'), 'Gcina');
  assert.equal(inlineText('en', 'Save', 'Londoloza'), 'Save');
  assert.equal(inlineText('st', 'Save'), 'Save');
  assert.equal(inlineText('xh', 'Not drafted'), 'Not drafted');
  assert.equal(inlineTemplate('xh', '{n} entries', null, { n: 3 }), 'Amangeniso angu-3');
  assert.equal(inlineTemplate('en', '{n} entries', null, { n: 3 }), '3 entries');
  // A draft that dropped its placeholder would lose the figure, so English is shown.
  assert.equal(xhInlineDraft('Bad {n}'), null);
  registerXhInline(XH_INLINE_SOURCE);
});

test('inlineDraftsLoaded is true only for a draft language whose drafts are registered', () => {
  registerInlineDrafts('af', {});
  assert.equal(inlineDraftsLoaded('af'), false);
  registerInlineDrafts('af', { 'Save': 'Stoor' });
  assert.equal(inlineDraftsLoaded('af'), true);
  assert.equal(inlineDraftsLoaded('zu'), false);
  assert.equal(inlineDraftsLoaded('en'), false);
  assert.equal(inlineDraftsLoaded(''), false);
  registerInlineDrafts('af', {});
  assert.equal(inlineDraftsLoaded('af'), false);
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineDraftsLoaded('xh'), true);
});

test('inlineDraftsLoaded is true only for isiXhosa and only once its drafts are registered', () => {
  registerXhInline({});
  assert.equal(inlineDraftsLoaded('xh'), false);
  registerXhInline({ 'Save': 'Gcina' });
  assert.equal(inlineDraftsLoaded('xh'), true);
  assert.equal(inlineDraftsLoaded('zu'), false);
  assert.equal(inlineDraftsLoaded('en'), false);
  assert.equal(inlineDraftsLoaded(''), false);
  registerXhInline({});
  assert.equal(inlineDraftsLoaded('xh'), false);
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineDraftsLoaded('xh'), true);
});

test('the site report document has an isiXhosa draft for every wording its code writes (cover, glance, costs, M&E, risks, trust statement, drawings, summaries)', () => {
  registerXhInline(XH_INLINE_SOURCE);
  const registries: Array<[string, string[]]> = [
    ['report document', REPORT_DOCUMENT_COPY.map((row) => row.english)],
    ['plan assurance', PLAN_ASSURANCE_COPY.map((row) => row.english)],
    ['report visuals', REPORT_VISUAL_COPY.map((row) => row.english)],
    ['report summary', REPORT_SUMMARY_COPY.map((row) => row.english)],
  ];
  const figures = (text: string) => (text.match(/\d+/g) ?? []).sort().join(',');
  for (const [name, keys] of registries) {
    const missing = keys.filter((english) => xhInlineDraft(english) === null);
    assert.deepEqual(missing, [], `${name}: no isiXhosa draft for these`);
    for (const english of keys) assert.equal(figures(xhInlineDraft(english)!), figures(english), `${name}: figures changed in ${JSON.stringify(english)}`);
  }
  // The shard is registered in the index, so the route and the browser both read it.
  assert.equal(XH_INLINE_SOURCE['Site at a Glance'], 'Indawo ngokubona nje');
  assert.equal(XH_INLINE_SOURCE['Status'], 'Isimo');
});

// ── The second isiXhosa sample-mode sweep (2 Nov 2026) ────────────────────────────────────────────
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

test('g49: the survey picker, the funder-sharing checkbox and the Design notice lead-in have isiXhosa drafts with their figures intact', () => {
  registerXhInline(XH_INLINE_SOURCE);
  const keys = [
    'What are you preparing?',
    'Choose the purpose, then the questionnaire length. Your maps and production plan remain linked to this site.',
    'Understand the site, constraints and possibilities before detailed design.',
    'Bring the site survey, saved maps and whole-year production plan together. Missing evidence stays visible.',
    'Share this summary with funders',
    'isiXhosa draft.',
  ];
  for (const english of keys) {
    const draft = xhInlineDraft(english);
    assert.ok(draft && draft !== english, `no isiXhosa draft for ${JSON.stringify(english)}`);
    assert.equal(inlineText('en', english), english, 'English is untouched');
    assert.equal(inlineText('zu', english), english, 'isiZulu without its own wording stays English');
    for (const lang of ['st', 'ts', 've']) assert.equal(inlineText(lang, english), english, `${lang} stays English`);
  }
  const survey = read('components/SiteSurveySheet.tsx');
  assert.match(survey, /<legend>\{inlineText\(lang, 'What are you preparing\?'\)\}<\/legend>/);
  assert.match(survey, /inlineText\(lang, purpose === 'potential' \? 'Understand the site, constraints and possibilities before detailed design\.'/);
  assert.match(read('components/SampleProgramme.tsx'), /\{inlineText\(lang, 'Share this summary with funders'\)\}/);
});

test('the Design pathway notice shows one isiXhosa notice: the draft with its English source, or the English once, never an English pair', () => {
  const notice = read('components/studies/DesignDraftCopy.tsx');
  assert.match(notice, /const draft = xhInlineDraft\(source\);\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if \(!draft\) return/, 'a missing draft shows the English once');
  assert.match(notice, /if \(!draft\) return [^\n]*<p lang="en"><strong>isiXhosa draft\.<\/strong> \{source\}<\/p>/);
  assert.match(notice, /<span lang="xh">\{draft\}<\/span><small lang="en" className=\{styles\.source\}>English source: \{source\}<\/small>/);
  registerXhInline(XH_INLINE_SOURCE);
  assert.ok(xhInlineDraft('Navigation, headings, lesson text and exercise prompts on this pathway are unreviewed isiXhosa drafts. Model measurements and narration remain in English.'));
});

test('server-rendered study copy renders as English until its component has mounted, so hydration matches the server', () => {
  const hook = read('lib/use-hydrated-lang.ts');
  assert.match(hook, /const \[mounted, setMounted\] = useState\(false\)/);
  assert.match(hook, /useEffect\(\(\) => \{ setMounted\(true\); \}, \[\]\)/);
  assert.match(hook, /return mounted \? lang : 'en'/);
  for (const path of ['components/studies/Tx.tsx', 'components/studies/TxLabelled.tsx', 'components/studies/DesignDraftCopy.tsx']) {
    const src = read(path);
    assert.match(src, /useHydratedLang/, path);
    assert.doesNotMatch(src, /const \{ lang \} = useLanguage\(\)/, `${path} no longer reads the language before it has mounted`);
  }
});

test('/student shows one isiXhosa draft banner, not the generic note stacked on the dedicated one', () => {
  const page = read('app/student/page.tsx');
  // Widened for Afrikaans, which has its own dedicated note too (tests/af-inline.test.ts pins that side).
  assert.match(page, /\{lang !== 'xh' && (?:lang !== 'af' && )?<LanguageDraftNote lang=\{lang\} scope="student" \/>\}/);
  assert.match(page, /<span lang="xh">\{t\('xhosaUiDraftNotice'\)\}<\/span>/, 'the dedicated isiXhosa note stays');
});

test('/prices and /atlas label the English duplicate as the English source for isiXhosa and leave isiZulu and English alone', () => {
  const prices = read('app/prices/page.tsx');
  assert.match(prices, /lang === 'zu' \? <>\{t\('pricesChooseCrop'\)\}<span className="block mt-1">\{translate\('en', 'pricesChooseCrop'\)\}<\/span><\/>/, 'isiZulu unchanged');
  assert.match(prices, /(?:lang === 'xh'|\(lang === 'xh' \|\| lang === 'af'\)) && t\('pricesChooseCrop'\) !== translate\('en', 'pricesChooseCrop'\)/, 'no pair when there is no draft');
  assert.match(prices, /<span lang="en" className="block mt-1">\{inlineText\(lang, 'English source:'\)\} \{translate\('en', 'pricesChooseCrop'\)\}<\/span>/);
  const atlas = read('components/atlas/AtlasExplorer.tsx');
  assert.equal((atlas.match(/\{isXhosa \? `\$\{inlineText\(lang, 'English source:'\)\} ` : ''\}/g) ?? []).length, 2, 'both English duplicates are labelled');
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineText('xh', 'English source:'), 'Umthombo wesiNgesi:');
});

test('the /records draft notice stops calling the isiXhosa tabs English; the other regional languages keep their sentence', () => {
  const records = read('app/records/page.tsx');
  assert.match(records, /\{lang === 'xh' \? 'The tabs are shown in isiXhosa; English names:' : 'English tabs:'\} \{simple \? 'Picked · Sold · Spent\.' : 'Picked · Sold · Spent · Charts\.'\}/);
  assert.doesNotMatch(records, /\} English tabs: \{simple/);
});

test('the planner names the month once in isiXhosa counts and messages (the heading keeps the pair)', () => {
  const page = read('app/cropplan/page.tsx');
  assert.match(page, /const monthNameXh = \(index: number\) => inlineText\(lang, MONTHS\[index\]\);/);
  assert.match(page, /\{ n: monthTasks\.length, month: monthNameXh\(cursorMonth - 1\) \}/);
  assert.match(page, /'Nothing due from your crop plan in \{month\}\.', null, \{ month: monthNameXh\(cursorMonth - 1\) \}/);
  assert.match(page, /\{ month: monthNameXh\(i\), n \}/);
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineTemplate('xh', '{n} jobs in {month}', null, { n: 3, month: inlineText('xh', 'November') }), `${XH_INLINE_SOURCE['{n} jobs in {month}'].replace('{n}', '3').replace('{month}', inlineText('xh', 'November'))}`);
  assert.doesNotMatch(inlineTemplate('xh', '{n} jobs in {month}', null, { n: 3, month: inlineText('xh', 'November') }), /NOVEMBER|November/);
});

test('the funder cohort month axis uses the isiXhosa short month names for isiXhosa only', async () => {
  const { recordsMonthShort } = await import('@/lib/records-months');
  const charts = read('components/funder/CohortCharts.tsx');
  // Widened for Afrikaans: an extra branch between the isiXhosa one and the untouched English labels.
  assert.match(charts, /lang === 'xh'\s*\n\s*\? series\.months\.map\(\(m\) => \(\{ \.\.\.m, label: recordsMonthShort\(lang, m\.month\), longLabel: `\$\{recordsMonthShort\(lang, m\.month\)\} \$\{m\.year\}` \}\)\)\s*\n\s*: (?:lang === 'af'[\s\S]*?\}\)\)\s*\n\s*: )?series\.months/);
  assert.deepEqual([12, 1, 10].map((m) => recordsMonthShort('xh', m)), ['Dis', 'Jan', 'Okt']);
  assert.deepEqual([12, 1, 10].map((m) => recordsMonthShort('en', m)), ['Dec', 'Jan', 'Oct']);
});

test('pages that showed isiXhosa drafts with no notice now carry the shared draft note, for isiXhosa only', () => {
  const note = read('components/XhosaDraftNote.tsx');
  assert.match(note, /if \(lang !== 'xh'(?: && lang !== 'af')?\) return null;/);
  assert.match(note, /<LanguageDraftNote lang=\{lang\} scope=\{scope\} \/>/);
  const pages: Array<[string, string]> = [
    ['app/contact/page.tsx', 'contact'], ['app/design/page.tsx', 'design'], ['app/network/page.tsx', 'network'],
    ['app/partners/page.tsx', 'partners'], ['app/vision/page.tsx', 'vision'], ['app/samples/gardens/page.tsx', 'sample-gardens'],
    ['components/studies/AppGuidePage.tsx', 'student-guides'],
  ];
  for (const [path, scope] of pages) assert.match(read(path), new RegExp(`<XhosaDraftNote scope="${scope}"`), `${path} carries the note`);
});
