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
import { inlineDraftsLoaded, inlineTemplate, inlineText, isInlineDraftLang, placeholdersOf, registerXhInline, xhInlineDraft } from '@/lib/xh-inline';
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
  assert.match(page, /\{lang !== 'xh' && <LanguageDraftNote lang=\{lang\} scope="student" \/>\}/);
  assert.match(page, /<span lang="xh">\{t\('xhosaUiDraftNotice'\)\}<\/span>/, 'the dedicated isiXhosa note stays');
});

test('/prices and /atlas label the English duplicate as the English source for isiXhosa and leave isiZulu and English alone', () => {
  const prices = read('app/prices/page.tsx');
  assert.match(prices, /lang === 'zu' \? <>\{t\('pricesChooseCrop'\)\}<span className="block mt-1">\{translate\('en', 'pricesChooseCrop'\)\}<\/span><\/>/, 'isiZulu unchanged');
  assert.match(prices, /lang === 'xh' && t\('pricesChooseCrop'\) !== translate\('en', 'pricesChooseCrop'\)/, 'no pair when there is no draft');
  assert.match(prices, /<span lang="en" className="block mt-1">\{inlineText\(lang, 'English source:'\)\} \{translate\('en', 'pricesChooseCrop'\)\}<\/span>/);
  const atlas = read('components/atlas/AtlasExplorer.tsx');
  assert.equal((atlas.match(/\{isXhosa \? `\$\{inlineText\(lang, 'English source:'\)\} ` : ''\}/g) ?? []).length, 2, 'both English duplicates are labelled');
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineText('xh', 'English source:'), 'Umthombo wesiNgesi:');
});

test('the /records draft notice: Sesotho, Tshivenda and Xitsonga keep their English status line; isiXhosa gets one notice (the shared one) plus the English tab names as a source line', () => {
  const records = read('app/records/page.tsx');
  // The three regional languages: unchanged sentence ("English tabs: Picked · Sold · Spent[ · Charts].").
  assert.match(records, /\{isRecordsRegionalLang\(lang\) && !isInlineDraftLang\(lang\) && <p role="note" lang="en" data-records-draft-notice=\{lang\} className="mt-1 text-xs" style=\{\{ color: 'var\(--color-muted-strong\)' \}\}>\{recordsDraftNotice\(lang\)\} English tabs: \{simple \? 'Picked · Sold · Spent\.' : 'Picked · Sold · Spent · Charts\.'\}<\/p>\}/);
  // (The old guard against an unconditional "} English tabs: {simple" is now the !isInlineDraftLang gate asserted above.)
  assert.doesNotMatch(records, /The tabs are shown in isiXhosa; English names:/, 'the fully English isiXhosa notice is gone');
  // A draft language: no second notice, only the English tab names labelled as the English source.
  assert.match(records, /\{isInlineDraftLang\(lang\) && <p lang="en" data-records-tab-source=\{lang\}[^>]*><span lang=\{lang\}>\{inlineText\(lang, 'English source:'\)\}<\/span> \{simple \? 'Picked · Sold · Spent\.' : 'Picked · Sold · Spent · Charts\.'\}<\/p>\}/);
  assert.match(records, /<LanguageDraftNote lang=\{lang\} scope="records" \/>/, 'the one shared notice stays');
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
  assert.match(charts, /lang === 'xh'\s*\n\s*\? series\.months\.map\(\(m\) => \(\{ \.\.\.m, label: recordsMonthShort\(lang, m\.month\), longLabel: `\$\{recordsMonthShort\(lang, m\.month\)\} \$\{m\.year\}` \}\)\)\s*\n\s*: series\.months/);
  assert.deepEqual([12, 1, 10].map((m) => recordsMonthShort('xh', m)), ['Dis', 'Jan', 'Okt']);
  assert.deepEqual([12, 1, 10].map((m) => recordsMonthShort('en', m)), ['Dec', 'Jan', 'Oct']);
});

test('pages that showed isiXhosa drafts with no notice now carry the shared draft note, for isiXhosa only', () => {
  const note = read('components/XhosaDraftNote.tsx');
  assert.match(note, /if \(lang !== 'xh'\) return null;/);
  assert.match(note, /<LanguageDraftNote lang=\{lang\} scope=\{scope\} \/>/);
  const pages: Array<[string, string]> = [
    ['app/contact/page.tsx', 'contact'], ['app/design/page.tsx', 'design'], ['app/network/page.tsx', 'network'],
    ['app/partners/page.tsx', 'partners'], ['app/vision/page.tsx', 'vision'], ['app/samples/gardens/page.tsx', 'sample-gardens'],
    ['components/studies/AppGuidePage.tsx', 'student-guides'],
  ];
  for (const [path, scope] of pages) assert.match(read(path), new RegExp(`<XhosaDraftNote scope="${scope}"`), `${path} carries the note`);
});

// ── The third isiXhosa sample-mode sweep (2 Nov 2026) ─────────────────────────────────────────────
test('g50: the scale exercise notice and the words on the scale diagram have isiXhosa drafts with their figures intact', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { SCALE_NOTICE } = await import('@/lib/design-scale');
  const keys = [
    SCALE_NOTICE,
    'MODEL ONLY · not site measurements',
    'No gap',
    'Outer width: {width} m',
  ];
  for (const english of keys) {
    const draft = xhInlineDraft(english);
    assert.ok(draft && draft !== english, `no isiXhosa draft for ${JSON.stringify(english)}`);
    assert.equal(inlineText('en', english), english, 'English is untouched');
    assert.equal(inlineText('zu', english), english, 'isiZulu without its own wording stays English');
    for (const lang of ['st', 'ts', 've']) assert.equal(inlineText(lang, english), english, `${lang} stays English`);
  }
  assert.equal(placeholdersOf(xhInlineDraft('Outer width: {width} m')!), 'width');
  assert.equal(inlineTemplate('xh', 'Outer width: {width} m', null, { width: '4,5' }), 'Ububanzi bangaphandle: 4,5 m');
  assert.equal(inlineTemplate('en', 'Outer width: {width} m', null, { width: '4,5' }), 'Outer width: 4,5 m');
  // The notice is the one DesignDraftCopy already looks up by exact English, so no new wiring is needed there.
  assert.match(read('components/studies/DesignScalePractice.tsx'), /<DesignDraftCopy en=\{SCALE_NOTICE\} zu="Umsebenzi wesikali olingiswayo\./);
  const diagram = read('components/studies/DesignScaleDiagram.tsx');
  assert.match(diagram, /\{inlineText\(lang, 'MODEL ONLY · not site measurements'\)\}/);
  assert.match(diagram, /\{inlineText\(lang, 'No gap'\)\}/);
  assert.match(diagram, /inlineTemplate\(lang, 'Outer width: \{width\} m', null, \{ width: n\(model\.outerWidthM\) \}\)/);
  assert.match(diagram, /\{inlineText\(lang, scenario\)\.toUpperCase\(\)\}/);
  assert.match(diagram, /\{inlineText\(lang, bed\.label\)\}/);
  assert.match(read('components/studies/DesignScalePractice.tsx'), /<DesignScaleDiagram [^>]*lang=\{lang\} \/>/);
});

test('the "English source" line under a Design eyebrow is the shared DesignDraftCopy source, rendered once under the draft', () => {
  const copy = read('components/studies/DesignDraftCopy.tsx');
  // One source line per draft heading, never a second one: the isiXhosa branch returns before the isiZulu one.
  assert.equal((copy.match(/<small lang="en" className=\{styles\.source\}>English source: \{stripArrow\(en\)\}<\/small>/g) ?? []).length, 1);
  assert.match(copy, /if \(xhosa\) return <span lang="xh"/);
});

test('long isiXhosa titles and rows wrap instead of cutting off at phone width, with the desktop header unchanged', () => {
  const header = read('components/layout/AppHeader.tsx');
  // Below lg the title wraps to two lines inside the 52px bar; from lg it is the same nowrap single line as before.
  assert.match(header, /text-xs font-display min-w-0 break-words leading-tight line-clamp-2 lg:whitespace-nowrap/);
  assert.doesNotMatch(header, /\btruncate\b/, 'the title no longer ellipsises');
  assert.match(header, /lg:shrink-0 lg:overflow-visible lg:line-clamp-none/);
  assert.match(header, /' lg:hidden'/);
  const community = read('app/community/page.tsx');
  assert.match(community, /<div className="flex flex-wrap items-center justify-between gap-2" style=\{\{ marginBottom: 14 \}\}>\s*<h1/);
  assert.match(community, /<div className="flex flex-wrap items-center gap-x-2 gap-y-1" style=\{\{ marginBottom: 6 \}\}>/);
  assert.match(community, /<div className="flex flex-wrap items-baseline justify-between gap-x-2">/);
});

test('the Manual chapter link back to English is read from the draft language ui.json for any inline-draft language, and stays English for the others', async () => {
  const { INLINE_DRAFT_LANGS, isInlineDraftLang } = await import('@/lib/xh-inline');
  assert.ok(INLINE_DRAFT_LANGS.includes('xh'));
  for (const lang of ['en', 'zu', 'st', 've', 'ts']) assert.equal(isInlineDraftLang(lang), false);
  const page = read('app/manual/[lang]/[slug]/page.tsx');
  assert.match(page, /import \{ isInlineDraftLang \} from '@\/lib\/xh-inline';/);
  assert.match(page, /\{isInlineDraftLang\(lang\)\s*\n\s*\? <Link href=\{`\/manual\/en\/\$\{slug\}`\} hrefLang="en" lang=\{lang\}[^>]*>\{ui\.readInEnglish\}<\/Link>\s*\n\s*: <Link href=\{`\/manual\/en\/\$\{slug\}`\} lang="en"[^>]*>\{manualUi\('en'\)\.readInEnglish\}<\/Link>\}/);
  const xh = JSON.parse(read('content/manual/xh/ui.json')) as Record<string, string>;
  assert.equal(xh.readInEnglish, 'Funda esi sahluko ngesiNgesi');
  assert.notEqual(xh.readInEnglish, JSON.parse(read('content/manual/en/ui.json')).readInEnglish);
});

test('the Atlas draft notice is shown for any inline-draft language, not just a literal isiXhosa', () => {
  const page = read('app/atlas/page.tsx');
  assert.match(page, /import \{ inlineText, isInlineDraftLang \} from '@\/lib\/xh-inline';/);
  assert.match(page, /\{\(\['zu','st','ts','ve'\]\.includes\(lang\)\|\|isInlineDraftLang\(lang\)\)&&<div className="px-3 py-2"><LanguageDraftNote lang=\{lang\} scope="atlas" \/><\/div>\}/);
});

test('/invoice keeps its deliberate English draft notice and English-beside-draft money instructions', () => {
  const page = read('app/invoice/page.tsx');
  // Unchanged on purpose: the notice is a status line for the reader of the draft language, and a sentence
  // a farmer acts on (paid / unpaid) keeps the English beside the draft.
  assert.match(page, /<p role="note" lang="en" data-records-draft-notice=\{lang\}/);
  assert.match(page, /'Choose paid or unpaid to continue\.',\n/);
  assert.match(page, /INVOICE_PAIRED_COPY\.has\(english\)( \|\| \(isInlineDraftLang\(lang\) && INVOICE_DRAFT_PAIRED_COPY\.has\(english\)\))? \? recordsPaired\(lang, english\) : recordsFill\(lang, english\)/);
});

// ── The fourth isiXhosa sample-mode sweep (2 Nov 2026): interactive screens ───────────────────────
const NON_DRAFT_LANGS = ['en', 'zu', 'st', 'ts', 've'];

test('g52: every new draft keeps its figures and leaves English, isiZulu, Sesotho, Xitsonga and Tshivenda alone', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { default: shard } = await import('@/lib/locales/xh-inline/g52-interactive');
  assert.ok(Object.keys(shard).length >= 150, 'the shard holds the sweep drafts');
  for (const [english, draft] of Object.entries(shard)) {
    assert.equal(XH_INLINE_SOURCE[english], draft, `${english}: a later shard overrides the g52 draft`);
    assert.equal(placeholdersOf(draft), placeholdersOf(english));
    assert.notEqual(draft, english);
    for (const lang of NON_DRAFT_LANGS) assert.equal(inlineText(lang, english), english, `${lang} stays English for ${english}`);
  }
  // Figures that must survive exactly.
  assert.match(shard['Within 3 m of a roof downpipe, on level, compacted ground.'], /\b3\b/);
  assert.match(shard['Paint the area you can reach in about 20 steps from the door.'], /\b20\b/);
  assert.match(shard['More than 500 beds fit. Divide this field into smaller blocks.'], /500/);
  assert.match(shard['{n} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.'], /0°/);
  assert.equal(inlineTemplate('xh', 'Field blocks · {n}', null, { n: 3 }), 'Iibhloko zeentsimi · 3');
  assert.equal(inlineTemplate('en', 'Field blocks · {n}', null, { n: 3 }), 'Field blocks · 3');
});

test('g52: the Design palette names an element in isiXhosa at render only; the English catalogue, species names and every other language are untouched', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { ELEMENTS_BY_ID, PLANTING_GROUP_LABEL } = await import('@/lib/design-elements');
  const { PLANTING_SUBLAYER_LABEL } = await import('@/lib/design-layer-membership');
  const { designElementDisplayName, designGroupDisplayLabel } = await import('@/lib/design-element-display');
  // The lib English is data and does not move.
  assert.equal(ELEMENTS_BY_ID.raised_bed.name, 'Raised Bed');
  assert.equal(ELEMENTS_BY_ID.veg_bed.name, 'Vegetable Bed');
  assert.equal(PLANTING_GROUP_LABEL.beds, 'Beds & strips');
  assert.equal(PLANTING_SUBLAYER_LABEL.beds, 'Beds & strips');
  const shown = (id: string, lang: string) => designElementDisplayName(ELEMENTS_BY_ID[id], lang);
  for (const [id, draft] of [
    ['jojo_1000', 'Itanki ye-JoJo 1000L'], ['tap_point', 'Indawo yethepi'], ['raised_bed', 'Ibhedi ephakanyisiweyo'],
    ['veg_bed', 'Ibhedi yemifuno'], ['tree_other', 'Omnye umthi'], ['chicken_coop', 'Ikheyji yeenkukhu'],
  ] as const) {
    assert.equal(shown(id, 'xh'), draft, id);
    for (const lang of NON_DRAFT_LANGS) assert.equal(shown(id, lang), ELEMENTS_BY_ID[id].name, `${id} stays English for ${lang}`);
  }
  // Crop and species names are never translated, drafts or not.
  for (const id of ['tree_mango', 'tree_orange', 'tree_wild_plum', 'tree_marula', 'mulch_bank', 'vetiver_row', 'spekboom_hedge', 'banana_circle', 'banana_clump']) {
    assert.equal(shown(id, 'xh'), ELEMENTS_BY_ID[id].name, `${id} keeps its crop or species name`);
  }
  for (const label of [...Object.values(PLANTING_GROUP_LABEL), ...Object.values(PLANTING_SUBLAYER_LABEL)]) {
    assert.notEqual(designGroupDisplayLabel(label, 'xh'), label, `${label} has an isiXhosa heading`);
    for (const lang of NON_DRAFT_LANGS) assert.equal(designGroupDisplayLabel(label, lang), label);
  }
  assert.equal(designGroupDisplayLabel('Beds & strips', 'xh'), 'Iibhedi nemigca');
  const helper = read('lib/design-element-display.ts');
  assert.match(helper, /if \(!isInlineDraftLang\(lang\)\) return def\.name;/);
  const palette = read('components/design/DesignPalette.tsx');
  assert.match(palette, /\{designElementDisplayName\(def, lang\)\}<\/span>/, 'the chip name');
  assert.match(palette, /designGroupDisplayLabel\(PLANTING_GROUP_LABEL\[heading\], lang\)/, 'the group heading');
  assert.match(palette, /\{designGroupDisplayLabel\(label, lang\)\}/, 'the layer sub-heading');
  assert.match(palette, /\{ name: designElementDisplayName\(armedDef, lang\) \}/, 'the "tap to place" hint');
});

test('g52: the step guide shows every sub-step in isiXhosa through inlineText, and English, isiZulu and the other languages read the unchanged English', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { STEP_SUBSTEPS } = await import('@/lib/design-substeps');
  let n = 0;
  for (const steps of Object.values(STEP_SUBSTEPS)) {
    for (const sub of steps) {
      for (const english of [sub.title, sub.instruction, sub.where]) {
        n += 1;
        const draft = xhInlineDraft(english);
        assert.ok(draft && draft !== english, `no isiXhosa draft for ${JSON.stringify(english)}`);
        for (const lang of NON_DRAFT_LANGS) assert.equal(inlineText(lang, english), english);
      }
    }
  }
  assert.ok(n >= 78, `${n} sub-step strings checked`);
  assert.equal(inlineText('xh', 'Build the berm on the downhill side'), 'Akha induli yomhlaba kwicala elihla');
  const guide = read('components/design/StepGuide.tsx');
  assert.match(guide, /\{inlineText\(lang, ss\.title\)\}/);
  assert.match(guide, /\{inlineText\(lang, ss\.instruction\)\}/);
  assert.match(guide, /\{inlineText\(lang, ss\.where\)\}/);
  assert.match(guide, /current \? inlineText\(lang, current\.title\) : undefined/, 'the collapsed bar');
  assert.match(guide, /<SpeakButton text=\{narration\} englishText=\{englishNarration\}/, 'the spoken English source stays English');
  assert.match(read('lib/design-substeps.ts'), /title: 'Build the berm on the downhill side'/, 'the lib English is untouched');
});

test('g52: the field blocks panel is fully translated at render, with its lib errors and figures intact', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const panel = read('components/design/FieldBlocksPanel.tsx');
  assert.match(panel, /const \{ lang \} = useLanguage\(\);/);
  for (const english of [
    'Draw a field, then fill it with beds or keep it as open growing ground.', 'Draw field polygon', 'Select a field', 'Field name',
    'Growing layout', 'Fill with beds', 'Open field (no beds)', 'Save field layout', 'Open automatic crop planner →',
    'The polygon becomes one field-sized crop-planning area.', 'Saved: open field. Saving again replaces this field’s generated layout.',
  ]) {
    assert.ok(panel.includes(`'${english}'`), `${english} is rendered through the panel`);
    assert.ok(xhInlineDraft(english), `${english} has a draft`);
  }
  for (const label of ['Bed length (m)', 'Bed width (m)', 'Path width (m)', 'Direction (degrees)']) assert.ok(xhInlineDraft(label) && panel.includes(`'${label}'`));
  assert.match(panel, /inlineTemplate\(lang, 'Field blocks · \{n\}', null, \{ n: fields\.length \}\)/);
  assert.match(panel, /ui\(\(e as Error\)\.message\)/, 'thrown lib messages are translated where they are shown');
  assert.match(panel, /\{isInlineDraftLang\(lang\) \? ui\('Field block'\) : 'Field'\}/, 'the plain "Field" key belongs to another screen');
  // Every message lib/bed-block.ts throws has a draft.
  const lib = read('lib/bed-block.ts');
  const thrown = [...lib.matchAll(/throw new Error\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1]);
  assert.ok(thrown.length >= 12);
  for (const english of thrown) assert.ok(xhInlineDraft(english), `no draft for the thrown message ${english}`);
  assert.equal(inlineTemplate('xh', '{n} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.', null, { n: 12 }).startsWith('Iibhedi ezipheleleyo ezingu-12 '), true);
  assert.equal(inlineTemplate('en', '{n} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.', null, { n: 12 }), '12 full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.');
});

test('g52: the Design canvas zoom, fit and base controls and the sector notes over the map read the isiXhosa drafts; other languages keep the exact English', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const canvas = read('components/design/DesignCanvas.tsx');
  assert.match(canvas, /ariaLabel: inlineText\(lang, 'Zoom in'\)/);
  assert.match(canvas, /ariaLabel: inlineText\(lang, 'Zoom out'\)/);
  assert.match(canvas, /ariaLabel: inlineText\(lang, 'Fit map to view'\)/);
  assert.match(canvas, /inlineTemplate\(lang, 'Base: \{mode\}\. Switch base\.', null, \{ mode: inlineText\(lang, basePhoto\.mode\) \}\)/);
  assert.match(canvas, /: `Base: \$\{basePhoto\.mode\}\. Switch base\.`\}/, 'the English aria-label is the same template as before');
  assert.match(canvas, /inlineTemplate\(lang, 'Base: \{mode\}\. Switch to \{next\}\.'/);
  // Widened, not weakened: the chip still reads the on-site wind note first, then the strongest sector note; the note now goes through
  // sectorNoteText, which looks the whole note up exactly as before (inlineText) and also fills the figure into the three notes that carry one.
  assert.match(canvas, /\{effectiveWindNote \?\? sectorNoteText\(lang, sectorModel\.dataNotes\[0\]\)\}/);
  assert.equal(inlineText('xh', 'Zoom in'), 'Sondeza kufuphi');
  assert.equal(inlineTemplate('xh', 'Base: {mode}. Switch base.', null, { mode: inlineText('xh', 'satellite') }), 'Isiseko: isathelayithi. Tshintsha isiseko.');
  assert.equal(inlineTemplate('en', 'Base: {mode}. Switch base.', null, { mode: 'satellite' }), 'Base: satellite. Switch base.');
  // The two notes the sweep named, and the other fixed notes lib/sector.ts writes, are drafted from the lib's own English.
  const sector = read('lib/sector.ts');
  for (const english of [
    'No regional fire-wind pattern for this area — walk the boundary and ask neighbours which side fires come from.',
    'Fire sector not shown: this site’s fire season doesn’t match the region’s sourced berg-wind pattern — confirm the fire approach locally before siting a firebreak.',
    'Site not analysed yet — open this place on the map to fetch climate & slope, then redraw.',
    'No terrain data yet — open this place on the map to fetch slope & aspect.',
    'No wind/temperature data yet — open this place on the map to fetch climate.',
    'Cold air settles in low spots on still, clear nights.',
    'Local DEM relief is too small to confirm a downhill direction — use neighbouring contours or measure the fall on site.',
  ]) {
    assert.ok(sector.includes(english), `lib/sector.ts still writes: ${english}`);
    assert.ok(xhInlineDraft(english), `no draft for ${english}`);
  }
  // lib/sector.ts itself is untouched: its English output feeds pinned tests and the Glossy renderer.
  const { deriveSectorModel } = await import('@/lib/sector');
  assert.ok(typeof deriveSectorModel === 'function');
});

test('g52: Cancel beside "Place here" is translated for a draft language and stays "Cancel" for every other language', async () => {
  const map = read('components/Map.tsx');
  assert.equal((map.match(/<X size=\{15\} \/>\{isInlineDraftLang\(lang\) \? t\('drawCancelButton'\) : 'Cancel'\}/g) ?? []).length, 2, 'the water point and element drop bars');
  assert.doesNotMatch(map, /<X size=\{15\} \/>Cancel\n/);
  const xhDictionary = (await import('@/lib/locales/xh')).default as Record<string, string>;
  assert.equal(xhDictionary.drawCancelButton, 'Rhoxisa');
  assert.equal(xhDictionary.waterDropPlaceButton, 'Beka apha');
});

test('g52: the Places accordion no longer nests a <button> inside a <button>', () => {
  const map = read('components/Map.tsx');
  const from = map.indexOf('{/* ── Places section — collapsible ── */}');
  const to = map.indexOf('{placesOpen && (', from);
  const block = map.slice(from, to).replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // comments may mention <button>
  const opens = [...block.matchAll(/<button\b/g)].map((m) => m.index!);
  const closes = [...block.matchAll(/<\/button>/g)].map((m) => m.index!);
  assert.equal(opens.length, 2);
  assert.equal(closes.length, 2);
  assert.ok(closes[0] < opens[1], 'the accordion toggle is closed before the labels switch opens: siblings, not nested');
  assert.match(block, /aria-expanded=\{placesOpen\}/);
  assert.match(block, /onClick=\{\(\) => setPlacesOpen\(\(o\) => !o\)\}/);
  assert.match(block, /onClick=\{\(\) => setShowPlaceLabels\(\(v\) => !v\)\}/, 'no stopPropagation is needed once they are siblings');
  assert.doesNotMatch(block, /stopPropagation/);
});

test('g52: phone-width overlaps are separated by position, for every language', () => {
  const map = read('components/Map.tsx');
  // Tree/tank/water drop hint rides above the action bar instead of covering the Tools panel title.
  assert.equal((map.match(/bottom: DROP_HINT_BOTTOM/g) ?? []).length, 2);
  assert.match(map, /const DROP_HINT_BOTTOM = 'calc\(72px \+ env\(safe-area-inset-bottom\) \+ 12px \+ 48px \+ 10px\)';/);
  // Offline-canvas note moved off the bottom-left corner (Lima FAB + Add pill).
  assert.match(map, /\{offlineCanvas&&<div role="status" style=\{\{position:'absolute',bottom:80,right:12,maxWidth:'calc\(100% - 170px\)'/);
  // Share result is a line in the panel, not a toast floating over the search field.
  assert.doesNotMatch(map, /top: 44, right: 0/);
  assert.match(map, /\{\(shareState === 'copied' \|\| shareState === 'error'\) && \(\s*<div role="status" aria-live="polite" className="font-sans font-bold self-end"/);
  // The boundary-drawing Cancel sizes to its label instead of a fixed 52px.
  assert.match(map, /flex: '0 0 auto', minWidth: 52, padding: '9px 6px', background: 'rgba\(212,110,66,0\.95\)'/);
  assert.match(map, /fontSize: 12\.5, marginTop: 3, whiteSpace: 'nowrap' \}\}>\{cancelArmed/);
  const badge = read('components/FieldSyncBadge.tsx');
  assert.match(badge, /flex:'0 1 auto',minWidth:0,maxWidth:'min\(40vw, 190px\)'/, 'the offline pill shrinks and wraps instead of squeezing the back button');
  const farmer = read('app/farmer/page.tsx');
  assert.match(farmer, /rounded-full font-sans font-bold transition-all min-w-0 shrink"/, 'the Design Studio pill shrinks');
  assert.match(farmer, /<span className="min-w-0 break-words text-left">\{t\('designStudioLabel'\)\}<\/span>/);
  assert.match(farmer, /bottom: 'var\(--bottom-nav-height, calc\(60px \+ env\(safe-area-inset-bottom, 0px\)\)\)'/, 'the sheet rides the measured bottom bar');
  const css = read('components/SiteSurveySheet.module.css');
  assert.match(css, /\.reviewCard>legend \{ float:left; width:100%;/, 'a fieldset legend no longer straddles the card border');
  assert.match(css, /\.reviewCard>legend\+\* \{ clear:both; \}/);
});

test('g52: the Reports tab heading and its count have a gap, the tabs are equal width and the sheet content clears the bottom bar', () => {
  const panel = read('components/DataPanel.tsx');
  assert.match(panel, /justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 8 \}\}>/);
  assert.match(panel, /flex: '1 1 0',\s*minWidth: 64,\s*flexDirection: 'column'/);
  assert.match(panel, /paddingBottom: 'calc\(28px \+ env\(safe-area-inset-bottom, 0px\)\)'/);
});

test('g52: one draft notice per surface - the results sheet tabs and the navigation drawer rely on the shared LanguageDraftNote for isiXhosa; isiZulu keeps its per-tab lines', () => {
  const water = read('components/WaterBalance.tsx');
  assert.match(water, /\{lang === 'zu' && \(\s*<p className="text-xs font-display" style=\{\{ color: 'var\(--text-muted\)' \}\}>\{t\('siteSummaryZuluDraftNotice'\)\}<\/p>/);
  const photos = read('components/PhotoUpload.tsx');
  assert.match(photos, /\{lang === 'zu' && \(\s*<p role="note" className="text-xs" style=\{\{ color: 'var\(--text-muted\)' \}\}>\{t\('photoZuluDraftNotice'\)\}<\/p>/);
  const panel = read('components/DataPanel.tsx');
  assert.match(panel, /\{lang === 'zu' && <span className="block mt-1 text-xs text-\[var\(--text-muted\)\]">\{t\('siteSummaryZuluDraftNotice'\)\}<\/span>\}/);
  assert.match(panel, /<LanguageDraftNote lang=\{lang\} scope="farmer" \/>/);
  const drawer = read('components/NavDrawer.tsx');
  assert.match(drawer, /<LanguageDraftNote lang=\{lang\} scope="navigation-drawer"\/>/);
  assert.doesNotMatch(drawer, /ISIXHOSA MACHINE DRAFT/, 'the second, differently worded isiXhosa notice is gone');
  assert.equal(xhInlineDraft('ISIXHOSA MACHINE DRAFT.'), null, 'its retired draft is gone too');
  const records = read('components/MyRecords.tsx');
  assert.match(records, /ISIZULU MACHINE DRAFT — This wording has not been reviewed/, 'the isiZulu Sold-card line is untouched by this isiXhosa change');
  assert.doesNotMatch(records, /ISIXHOSA MACHINE DRAFT/, 'the Sold card no longer repeats the shared /records isiXhosa notice');
  assert.equal(xhInlineDraft('ISIXHOSA MACHINE DRAFT — This wording has not been reviewed by a fluent isiXhosa speaker. The exact English source appears under each line.'), null, 'its retired draft is gone too');
});

test('g52: records validation errors and hints lead with the isiXhosa draft and label the English as its source; Sesotho, Tshivenda and Xitsonga keep English first', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { recordsPaired, recordsLabel, recordsDraft } = await import('@/lib/records-regional-drafts');
  const english = 'Item and amount are required.';
  const draft = recordsDraft('xh', english);
  assert.ok(draft && draft !== english, 'the validation message has an isiXhosa draft');
  assert.equal(recordsPaired('xh', english), `${draft} — Umthombo wesiNgesi: ${english}`);
  assert.ok(recordsPaired('xh', english).startsWith(draft), 'the draft comes first');
  assert.equal(recordsPaired('xh', 'A sentence nobody has drafted yet.'), 'A sentence nobody has drafted yet.', 'with no draft the English stands alone');
  assert.equal(recordsPaired('en', english), english);
  for (const lang of ['st', 've', 'ts']) {
    const local = recordsDraft(lang, english);
    assert.equal(recordsPaired(lang, english), local ? `${english} — ${local}` : english, `${lang} keeps English first`);
  }
  assert.equal(recordsPaired('st', 'Cancel', 'ALREADY TRANSLATED'), 'Cancel — ALREADY TRANSLATED');
  const label = recordsLabel('xh', english, null);
  assert.ok(label.startsWith(draft) && label.endsWith(english), 'tooltips and accessible names follow the same order');
  const invoice = read('app/invoice/page.tsx');
  assert.match(invoice, /INVOICE_PAIRED_COPY\.has\(english\)( \|\| \(isInlineDraftLang\(lang\) && INVOICE_DRAFT_PAIRED_COPY\.has\(english\)\))? \? recordsPaired\(lang, english\) : recordsFill\(lang, english\)/, 'money instructions keep the English beside the draft');
  const source = read('lib/records-regional-drafts.ts');
  assert.match(source, /return isInlineDraftLang\(lang\) \? `\$\{local\} — \$\{inlineText\(lang, 'English source:'\)\} \$\{english\}` : `\$\{english\} — \$\{local\}`;/);
});

test('g52: /feedback shows a draft language only the draft on its Send button, keeps the draft/English pairs for sentences, and no longer splits the sign-in sentence', () => {
  const page = read('app/feedback/page.tsx');
  assert.match(page, /const buttonLabel=\(en:string,zu:string\)=>lang==='zu'\?paired\(en,zu\):inlineText\(lang,en\);/);
  assert.match(page, /buttonLabel\('Send','Thumela'\)/);
  assert.doesNotMatch(page, /paired\('Send','Thumela'\)/);
  assert.match(page, /return isInlineDraftLang\(lang\)&&xh!==en\?`\$\{xh\} \/ \$\{en\}`:en;/, 'sentences keep the pair, draft first');
  // The sentence "Sign in to send, or download your draft first..." is one draft sentence plus one complete English source line.
  assert.match(page, /Sign in to send, or download your draft first\. Signing in may reload this page\.<\/span>/);
  assert.match(page, /paired\('to send, or download your draft first\. Signing in may reload this page\.','ukuze uthumele/, 'isiZulu pairing is unchanged');
  assert.equal(inlineText('xh', 'Send'), 'Thumela');
  assert.equal(inlineText('en', 'Send'), 'Send');
});

test('g52: the survey blocks and the annual production overview read isiXhosa drafts and stay English for every other language', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const sheet = read('components/SiteSurveySheet.tsx');
  for (const english of [
    'Water for the production plan (optional)', 'Can you water the growing area through the dry season?', 'Local market notes (optional)',
    'Product, buyer or outlet, quantity and unit, price and date, transport or other conditions',
    'For example: a buyer discussion, market visit or document reference', 'What did you learn?', 'Where did this information come from?',
  ]) {
    assert.ok(sheet.includes(`inlineText(lang, '${english}')`), `${english} is rendered through inlineText`);
    assert.ok(xhInlineDraft(english));
  }
  assert.match(sheet, /placeholder=\{inlineText\(lang, 'Product, buyer or outlet,/);
  assert.match(sheet, /placeholder=\{inlineText\(lang, 'For example: a buyer discussion/);
  assert.match(sheet, /lang !== 'en' && !isInlineDraftLang\(lang\) \? ' · English' : ''/, 'the "· English" marker stays for the other languages');
  const overview = read('components/report/ProductionYearOverview.tsx');
  assert.match(overview, /const draft = isInlineDraftLang\(language\);/);
  assert.match(overview, /<p className=\{styles\.key\}><strong>P<\/strong> Plan or locally recorded season · <strong>R<\/strong> Sourced reference/, 'the English key paragraph is the original markup');
  for (const english of ['Food and products through the year', 'Annual food and product plan', 'Timing not established.', 'Sourced reference', 'No annual production snapshot is attached. Open the current crop plan to record product choices and timing; older reports keep their original evidence.']) {
    assert.ok(xhInlineDraft(english), english);
    assert.equal(inlineText('zu', english), english);
  }
  assert.equal(inlineTemplate('xh', '{name}: planning window in {month}', null, { name: 'Maize', month: 'Jan' }), 'Maize: ixesha lokucwangcisa ngo-Jan');
  assert.equal(inlineTemplate('en', '{name}: planning window in {month}', null, { name: 'Maize', month: 'Jan' }), 'Maize: planning window in Jan');
  // Render the real component source (plain node cannot import .tsx), with its imports supplied.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const ts = (await import('typescript')).default;
  const compiled = ts.transpileModule(overview.replace(/^import .*$/gm, '').replace('export default function', 'function'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const Overview = new Function('React', 'pdfIconUrl', 'styles', 'inlineText', 'inlineTemplate', 'isInlineDraftLang', `${compiled}; return ProductionYearOverview;`)(
    React, () => null, {}, inlineText, inlineTemplate, isInlineDraftLang);
  const html = (language: string) => renderToStaticMarkup(React.createElement(Overview, { language }));
  assert.match(html('en'), /<h3>Food and products through the year<\/h3>/);
  assert.doesNotMatch(html('en'), /This production overview is currently in English/);
  for (const language of ['zu', 'st', 'ts', 've']) assert.match(html(language), /This production overview is currently in English\./, `${language} keeps its English notice`);
  assert.match(html('xh'), /<h3>Ukutya neemveliso unyaka wonke<\/h3>/);
  assert.match(html('xh'), /Amagama eemveliso namanqaku akule theyibhile abonisiwe ngesiNgesi\./);
  assert.doesNotMatch(html('xh'), /This production overview is currently in English/);
});

test('g52: a network failure is kept as the failure and worded when it renders, so it follows the language that is showing', async () => {
  const { networkFailure, networkFailureMessage } = await import('@/lib/network-failure');
  const en = (key: string) => ({ networkOffline: 'Offline', networkBusy: 'Busy', networkFailed: 'Failed' } as Record<string, string>)[key];
  const xh = (key: string) => ({ networkOffline: 'Ngaphandle kwe-intanethi', networkBusy: 'Kutshixiwe', networkFailed: 'Kusilele' } as Record<string, string>)[key];
  const failure = networkFailure({ status: 500 });
  assert.equal(failure.status, 500);
  assert.equal(networkFailureMessage(en, failure), 'Failed');
  assert.equal(networkFailureMessage(xh, failure), 'Kusilele', 'the same stored failure reads in whichever language renders it');
  assert.equal(networkFailureMessage(en, networkFailure({ status: 429, serverMessage: 'Please wait 30 s.' })), 'Please wait 30 s.');
  assert.equal(networkFailureMessage(xh, { offline: true }), 'Ngaphandle kwe-intanethi', 'offline is decided when the request failed');
  assert.equal(networkFailureMessage(xh, { offline: false, status: 429 }), 'Kutshixiwe');
  for (const path of ['app/farmer/page.tsx', 'components/AreaPanel.tsx', 'components/SiteDesign.tsx', 'components/atlas/AtlasExplorer.tsx']) {
    const source = read(path);
    assert.match(source, /networkFailure\(/, `${path} stores the failure`);
    assert.match(source, /networkFailureMessage\(t, /, `${path} words it at render`);
    assert.doesNotMatch(source, /set(Error|State)\([^)]*networkFailureMessage\(/, `${path} no longer caches the wording`);
  }
  const farmer = read('app/farmer/page.tsx');
  assert.match(farmer, /setError\(\{ key: 'savedSiteUnavailable' \}\)/);
  assert.match(farmer, /'key' in error \? t\(error\.key\)/);
});

test('g53: the "Why this step?" lessons read isiXhosa drafts for every step; English, isiZulu and the other languages read the unchanged English', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { DESIGN_STEP_LESSONS } = await import('@/lib/design-lessons');
  let n = 0;
  for (const [step, lesson] of Object.entries(DESIGN_STEP_LESSONS)) {
    for (const english of [lesson.title, lesson.body, lesson.principle, lesson.tip]) {
      n += 1;
      const draft = xhInlineDraft(english);
      assert.ok(draft && draft !== english, `${step}: no isiXhosa draft for ${JSON.stringify(english)}`);
      for (const lang of NON_DRAFT_LANGS) assert.equal(inlineText(lang, english), english, `${step}: ${lang} stays English`);
    }
  }
  assert.equal(n, 32, 'eight steps, four strings each (the did-you-know card is not rendered, so it has no draft)');
  assert.equal(inlineText('xh', DESIGN_STEP_LESSONS.water.title), 'Amanzi kuqala, yonke enye into yesibini');
  // Figures survive exactly.
  const tip = inlineText('xh', DESIGN_STEP_LESSONS.water.tip);
  for (const figure of ['3 m', '10 mm', '100 m²', '1,000']) assert.ok(tip.includes(figure), `water tip keeps ${figure}`);
  assert.ok(inlineText('xh', DESIGN_STEP_LESSONS.planting.tip).includes('10 m'));
  assert.ok(inlineText('xh', DESIGN_STEP_LESSONS.zones.tip).includes('Mimandla 1'));
  const panel = read('components/design/LessonPanel.tsx');
  assert.match(panel, /isInlineDraftLang\(lang\) \? inlineText\(lang, english\) : english/, 'the panel reads drafts for a draft language only');
  assert.match(panel, /englishText=\{englishNarration\}/, 'speech keeps the English source');
  assert.equal([...panel.matchAll(/lesson\.(title|body|principle|tip)\b/g)].length, 4 + 4, 'each field is read once for the draft and once for the English narration');
});

test('g53: the desktop step tabs use the locale step names for a draft language and the English labels for everyone else', () => {
  const stepper = read('components/design/CardsStepper.tsx');
  assert.match(stepper, /draftLang \? translatedDesignStepLabel\(t, s\) : STEP_LABELS\[s\]/);
  assert.match(stepper, /\{stepLabel\(s\)\}/);
  assert.doesNotMatch(stepper, /\{STEP_LABELS\[s\]\}/, 'the tab text no longer reads the English label directly');
  assert.equal(inlineTemplate('en', 'Step {n} — {label}', null, { n: '03', label: 'Water' }), 'Step 03 — Water');
  assert.equal(inlineTemplate('zu', 'Step {n} — {label}', null, { n: '03', label: 'Water' }), 'Step 03 — Water');
  registerXhInline(XH_INLINE_SOURCE);
  assert.equal(inlineTemplate('xh', 'Step {n} — {label}', null, { n: '03', label: 'Amanzi' }), 'Inyathelo 03 — Amanzi');
});

test('g53: Dock / Float / Tray, the gate length and the map labels of placed items read isiXhosa, with figures kept; other languages keep the exact English', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  for (const [english, draft] of [['Dock', 'Qhoboshela'], ['Float', 'Phaphisa'], ['Tray', 'Ngezantsi']] as const) {
    assert.equal(inlineText('xh', english), draft);
    for (const lang of NON_DRAFT_LANGS) assert.equal(inlineText(lang, english), english);
  }
  assert.match(read('app/design/page.tsx'), /inlineText\(lang, layout === 'docked' \? 'Dock' : layout === 'floating' \? 'Float' : 'Tray'\)/);
  // The whole gate label, figure kept exactly.
  assert.equal(inlineTemplate('xh', '{length} m long', null, { length: 1.5 }), '1.5 m ubude');
  for (const lang of NON_DRAFT_LANGS) assert.equal(inlineTemplate(lang, '{length} m long', null, { length: 1.5 }), '1.5 m long');
  assert.match(read('components/design/DesignPalette.tsx'), /inlineTemplate\(lang, '\{length\} m long', null, \{ length: def\.wM \}\)/);
  assert.match(read('components/design/DesignCanvas.tsx'), /inlineTemplate\(lang, '\{length\} m long', null, \{ length: wM\.toFixed\(1\) \}\)/);

  const { ELEMENTS_BY_ID } = await import('@/lib/design-elements');
  const { designItemDisplayLabel } = await import('@/lib/design-element-display');
  const mango = ELEMENTS_BY_ID.tree_mango;
  const tank = ELEMENTS_BY_ID.jojo_2500;
  const bed = ELEMENTS_BY_ID.veg_bed;
  const cases: Array<[{ label?: string }, typeof mango, string]> = [
    [{ label: 'Bed 1' }, bed, 'Umbhede 1'],
    [{ label: 'Bed 5' }, bed, 'Umbhede 5'],
    [{ label: 'Rainwater tank (2500 L)' }, tank, 'Itanki yamanzi emvula (2500 L)'],
    [{ label: 'Compost bays' }, ELEMENTS_BY_ID.compost_bay, 'Iindawo zomgquba'],
    [{}, bed, 'Ibhedi yemifuno'],
    [{ label: bed.name }, bed, 'Ibhedi yemifuno'],
  ];
  for (const [item, def, expected] of cases) {
    assert.equal(designItemDisplayLabel(item, def, 'xh'), expected, JSON.stringify(item));
    for (const lang of NON_DRAFT_LANGS) assert.equal(designItemDisplayLabel(item, def, lang), item.label ?? def.name, `${lang} keeps the saved label or catalogue name`);
  }
  // Species names, and a name the farmer typed, are shown as saved.
  assert.equal(designItemDisplayLabel({}, mango, 'xh'), mango.name);
  assert.equal(designItemDisplayLabel({ label: 'Gogo’s favourite' }, bed, 'xh'), 'Gogo’s favourite');
  assert.equal(designItemDisplayLabel({ label: 'Bed 1 east' }, bed, 'xh'), 'Bed 1 east', 'only the exact default "Bed n" is a generic label');
  const canvas = read('components/design/DesignCanvas.tsx');
  assert.equal([...canvas.matchAll(/designItemDisplayLabel\(item, def, lang\)/g)].length, 3, 'the label, and the pill text with and without a note');
});

test('g53: the invoice sale card pairs its money instructions with the English source for a draft language only', () => {
  const invoice = read('app/invoice/page.tsx');
  const set = /const INVOICE_DRAFT_PAIRED_COPY = new Set\(\[([\s\S]*?)\]\);/.exec(invoice);
  assert.ok(set, 'the draft-only pairing set exists');
  for (const english of [
    'Record the sale once', 'Keep the invoice, payment and quantity together.', 'Is this sale already in My Records?',
    'No — record it with this invoice', 'Yes — link the existing sale',
  ]) {
    assert.ok(set![1].includes(`'${english}'`), `${english} is paired`);
    assert.ok(invoice.includes(`ui('${english}'`), `${english} is still shown through ui()`);
  }
  assert.match(invoice, /INVOICE_PAIRED_COPY\.has\(english\) \|\| \(isInlineDraftLang\(lang\) && INVOICE_DRAFT_PAIRED_COPY\.has\(english\)\) \? recordsPaired\(lang, english\) : recordsFill\(lang, english\)/);
});

test('g53: the Layers panel layer name wraps on word boundaries and never switches to break-anywhere', () => {
  const palette = read('components/design/DesignPalette.tsx');
  const helper = /function layerNameStyle\([\s\S]*?\n}\n/.exec(palette);
  assert.ok(helper, 'layerNameStyle exists');
  assert.match(helper![0], /overflowWrap: 'break-word'/);
  assert.match(helper![0], /hyphens: 'auto'/);
  assert.doesNotMatch(helper![0], /anywhere/);
  assert.equal([...palette.matchAll(/style=\{layerNameStyle\(t\(lt\.labelKey\), cardsUi\)\}/g)].length, 2, 'the expandable and the plain layer-name cell');
});

test('records charts: the shared /records LanguageDraftNote is the one isiXhosa notice, so chart captions drop their per-caption draft label (English source line stays; isiZulu unchanged)', () => {
  for (const file of ['components/AreaReturnCards.tsx', 'components/CashflowChart.tsx', 'components/ComingUpHarvests.tsx', 'components/FinanceGraphs.tsx', 'components/HarvestReconciliation.tsx']) {
    const src = read(file);
    const all = src.match(/<IsiZuluDraftSource /g) ?? [];
    const quiet = src.match(/<IsiZuluDraftSource draftLabel=\{!\['xh', 'af'\]\.includes\(lang\)\} /g) ?? [];
    assert.ok(all.length > 0, `${file} renders draft sources`);
    assert.equal(quiet.length, all.length, `${file}: every caption defers to the page-level note`);
  }
  assert.match(read('app/records/page.tsx'), /<LanguageDraftNote lang=\{lang\} scope="records" \/>/);
});


// ── g54: Design Studio leftovers (palette tips, Layers panel labels, sector notes with figures) ────────────────
test('g54: every palette element tip has an isiXhosa draft that keeps its figures and botanical names; English tips are unchanged for every other language', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { ELEMENT_CATALOG } = await import('@/lib/design-elements');
  const tips = [...new Set(ELEMENT_CATALOG.map((def) => def.tip))];
  assert.ok(tips.length >= 79, 'the palette still has its tips');
  const figures = (text: string) => (text.match(/[~]?\d+(?:[.,:\-x×]\d+)*/g) ?? []).map((f) => f.replace(/^~/, '')).sort().join(',');
  for (const tip of tips) {
    const draft = xhInlineDraft(tip);
    assert.ok(draft && draft !== tip, `no isiXhosa draft for the tip ${JSON.stringify(tip)}`);
    assert.equal(figures(draft!), figures(tip), `figures changed in the draft of ${JSON.stringify(tip)}`);
    assert.equal(inlineText('xh', tip), draft);
    for (const lang of ['en', 'zu', 'st', 'ts', 've']) assert.equal(inlineText(lang, tip), tip, `${lang} keeps the English tip`);
    // Latin species names in the English stay in the draft, whole.
    for (const botanical of tip.match(/\([A-Z][a-z]+ [a-z]+\)/g) ?? []) assert.ok(draft!.includes(botanical), `${botanical} is kept in the draft`);
  }
  assert.ok(xhInlineDraft(ELEMENT_CATALOG.find((def) => def.id === 'tree_wild_plum')!.tip)!.includes('umgwenya'));
  // Same vocabulary as the existing drafts: swale -> umsele, level -> -linganayo, downwind -> ngakwicala lapho umoya uya khona.
  const tip = (id: string) => xhInlineDraft(ELEMENT_CATALOG.find((def) => def.id === id)!.tip)!;
  assert.match(tip('jojo_1000'), /esilinganayo/);
  assert.match(tip('chicken_coop'), /ngakwicala lapho umoya uya khona/);
  assert.match(tip('kraal'), /ngakwicala lapho umoya uya khona/);
  assert.match(tip('pollinator_strip'), /ukunyusa ukuthwala kweziqhamo/);
  assert.match(tip('berm'), /umsele obhuliweyo/);
  // The hint line and the element lesson both read the same English tip through the same lookup.
  const palette = read('components/design/DesignPalette.tsx');
  assert.match(palette, /<strong>\{designElementDisplayName\(hintDef, lang\)\}:<\/strong> \{inlineText\(lang, hintDef\.tip\)\}/);
  assert.match(read('lib/lesson-registry.ts'), /tip: def\.tip,/);
  assert.match(read('components/design/LessonPanel.tsx'), /const tip = read\(lesson\.tip\)/);
});

test('g54: the Layers panel button names read isiXhosa for a draft language and the exact same English as before for every other language', () => {
  registerXhInline(XH_INLINE_SOURCE);
  const NON_DRAFT = ['en', 'zu', 'st', 'ts', 've'];
  const cases: Array<[string, Record<string, string | number>, string, string]> = [
    ['Hide {name}', { name: 'Water' }, 'Fihla Water', 'Hide Water'],
    ['Show {name}', { name: 'Water' }, 'Bonisa Water', 'Show Water'],
    ['{name} has no editable objects on this step', { name: 'Zones' }, 'Zones: akukho zinto zinokuhlelwa kweli nyathelo', 'Zones has no editable objects on this step'],
    ['Deselect all {n} objects on {name}', { n: 7, name: 'Water' }, 'Susa ukukhetha zonke izinto (7): Water', 'Deselect all 7 objects on Water'],
    ['Select all {n} objects on {name}', { n: 7, name: 'Water' }, 'Khetha zonke izinto (7): Water', 'Select all 7 objects on Water'],
    ['Deselect all {n} {name} objects', { n: 2, name: 'Tap points' }, 'Susa ukukhetha zonke izinto (2): Tap points', 'Deselect all 2 Tap points objects'],
    ['Select all {n} {name} objects', { n: 2, name: 'Tap points' }, 'Khetha zonke izinto (2): Tap points', 'Select all 2 Tap points objects'],
    ['Lock {name} on the map', { name: 'Water' }, 'Thintela ukushukunyiswa kwimephu: Water', 'Lock Water on the map'],
    ['Allow moving {name} on the map', { name: 'Water' }, 'Vumela ukushukunyiswa kwimephu: Water', 'Allow moving Water on the map'],
    ['Collapse {name} controls', { name: 'Water' }, 'Vala izilawuli: Water', 'Collapse Water controls'],
    ['Expand {name} controls', { name: 'Water' }, 'Vula izilawuli: Water', 'Expand Water controls'],
    ['{n} of {total} selected', { n: 3, total: 12 }, '3 kwezi-12 zikhethiwe', '3 of 12 selected'],
  ];
  for (const [template, vars, xhosa, english] of cases) {
    assert.equal(inlineTemplate('xh', template, null, vars), xhosa, template);
    for (const lang of NON_DRAFT) assert.equal(inlineTemplate(lang, template, null, vars), english, `${lang}: ${template}`);
  }
  // The water layer's own groups.
  for (const [english, xhosa] of [['JoJo tanks & rain barrels', 'Iitanki ze-JoJo neebhareli zemvula'], ['Tap points', 'Iindawo zamathepi'], ['Pipes & lines', 'Imibhobho nemigca'], ['Drip irrigation', 'Ukunkcenkceshela ngamathontsi'], ['Swales', 'Imisele']] as const) {
    assert.equal(inlineText('xh', english), xhosa);
    for (const lang of NON_DRAFT) assert.equal(inlineText(lang, english), english);
  }
  const palette = read('components/design/DesignPalette.tsx');
  // Every old English template literal is gone from the panel, replaced by the same words as an inlineTemplate key.
  assert.doesNotMatch(palette, /\$\{[a-zA-Z]+ \? 'Hide' : 'Show'\}/);
  assert.doesNotMatch(palette, /has no editable objects on this step`/);
  assert.equal([...palette.matchAll(/inlineTemplate\(lang, childOn \? 'Hide \{name\}' : 'Show \{name\}', null, \{ name: childName \}\)/g)].length, 6, 'the eye of each group / element row, spoken twice per row');
  assert.match(palette, /inlineTemplate\(lang, on \? 'Hide \{name\}' : 'Show \{name\}', null, \{ name: layerName \}\)/);
  assert.match(palette, /inlineTemplate\(lang, movable \? 'Lock \{name\} on the map' : 'Allow moving \{name\} on the map', null, \{ name: layerName \}\)/);
  assert.match(palette, /inlineTemplate\(lang, expanded \? 'Collapse \{name\} controls' : 'Expand \{name\} controls', null, \{ name: layerName \}\)/);
  assert.match(palette, /inlineTemplate\(lang, '\{n\} of \{total\} selected', null, \{ n: selection\.selected, total: selection\.total \}\)/);
  assert.equal([...palette.matchAll(/inlineTemplate\(lang, 'Select all \{n\} \{name\} objects'/g)].length, 3);
  assert.match(palette, /\{childName\}<\/span>/);
  assert.match(palette, /\{designGroupDisplayLabel\(label, lang\)\}/, 'the planting sub-heading is unchanged');
});

test('g54: sector notes that carry a figure read isiXhosa with the figure kept exactly; every other language and every note that does not fit stays English', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const { sectorNoteText, windConfirmedNoteText } = await import('@/lib/sector-note-display');
  const { deriveSectorModel } = await import('@/lib/sector');
  const NON_DRAFT = ['en', 'zu', 'st', 'ts', 've'];
  // The three notes lib/sector.ts builds with a figure, produced by the real model so the sentence shape cannot drift from the helper.
  const site = (extra: Record<string, unknown>) => ({ biome: 'Savanna', ...extra }) as never;
  const indicative = deriveSectorModel(site({ elevation: { slopeDeg: 4, slopePct: 7, aspectDeg: 200, directionConfidence: 'site-local-indicative', sampleBaselineM: 150 } }), -26.2, 28.0);
  const flat = deriveSectorModel(site({ elevation: { slopeDeg: 0.4, slopePct: 0.7, aspectDeg: 200, sampleBaselineM: 90 } }), -26.2, 28.0);
  const flatDefault = deriveSectorModel(site({ elevation: { slopeDeg: 0.4, slopePct: 0.7, aspectDeg: 200 } }), -26.2, 28.0);
  const withNote = (model: { dataNotes: string[] }, startsWith: string) => {
    const note = model.dataNotes.find((n) => n.startsWith(startsWith));
    assert.ok(note, `lib/sector.ts wrote a note starting ${startsWith}`);
    return note!;
  };
  const slopeNote = withNote(indicative, 'Slope direction is estimated');
  const flatNote = withNote(flat, 'Site reads ~flat');
  const flatDefaultNote = withNote(flatDefault, 'Site reads ~flat');
  assert.match(slopeNote, /about 150 m/);
  assert.match(flatNote, /at this 90 m sampling/);
  assert.match(flatDefaultNote, /at this 120 m sampling/);
  assert.equal(sectorNoteText('xh', slopeNote), 'Icala lethambeka lilinganiselwa ngomzekelo we-SRTM wale ndawo ojikeleza malunga ne-150 m — isalathiso kuphela, alikalelwanga ngabalinganisi.');
  assert.equal(sectorNoteText('xh', flatNote), 'Indawo ibonakala ~ityaba kwesi sikali sokuthatha umzekelo se-90 m — qinisekisa ukuhla kwayo kwindawo.');
  assert.match(sectorNoteText('xh', flatDefaultNote), /se-120 m/);
  // The cross-check note: the model only writes it when the site's own wind disagrees with the regional table by more than 45 degrees.
  const windNote = 'This site’s own wind data reads 137° off the regional pattern — a bimodal wind rose average can land between its two real lobes, not on either one; trust the regional sectors over this site’s single mean.';
  const lib = readFileSync(join(ROOT, 'lib/sector.ts'), 'utf8');
  assert.ok(lib.includes('This site’s own wind data reads ${Math.round(disagreesDeg)}° off the regional pattern — a bimodal wind rose average can land between its two real lobes, not on either one; trust the regional sectors over this site’s single mean.'), 'lib/sector.ts still writes this sentence with the rounded bearing in the slot');
  assert.match(sectorNoteText('xh', windNote), /^Idatha yomoya yale ndawo ibonisa umahluko we-137° kwindlela yengingqi/);
  // Figures survive exactly, and nothing else numeric appears.
  const figures = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).join(',');
  for (const note of [slopeNote, flatNote, flatDefaultNote, windNote]) assert.equal(figures(sectorNoteText('xh', note)), figures(note) , note);
  // Every other language: byte-identical. A note with no draft shape, or a figure the slot cannot hold, stays English.
  for (const note of [slopeNote, flatNote, windNote, 'Cold air settles in low spots on still, clear nights.']) {
    for (const lang of NON_DRAFT) assert.equal(sectorNoteText(lang, note), note, `${lang} keeps the note`);
  }
  assert.equal(sectorNoteText('xh', 'Slope direction is estimated from a site-local SRTM sample across about many m — indicative, not surveyed.'), 'Slope direction is estimated from a site-local SRTM sample across about many m — indicative, not surveyed.');
  assert.equal(sectorNoteText('xh', 'A note nobody drafted.'), 'A note nobody drafted.');
  // The whole-note lookup still works for the fixed notes.
  assert.equal(sectorNoteText('xh', 'Cold air settles in low spots on still, clear nights.'), 'Umoya obandayo uhlala kwiindawo eziphantsi ebusuku obuzolileyo, obucacileyo.');
  // The farmer's on-site wind confirmation: direction label and date as given.
  assert.equal(windConfirmedNoteText('xh', 'SW', '2/11/2026'), 'Umoya uqinisekisiwe kwindawo: SW (kurekhodwe 2/11/2026)');
  assert.equal(windConfirmedNoteText('xh', 'SW', null), 'Umoya uqinisekisiwe kwindawo: SW');
  for (const lang of NON_DRAFT) {
    assert.equal(windConfirmedNoteText(lang, 'SW', '2/11/2026'), 'Wind confirmed on site: SW (recorded 2/11/2026)');
    assert.equal(windConfirmedNoteText(lang, 'SW', null), 'Wind confirmed on site: SW');
  }
  const canvas = read('components/design/DesignCanvas.tsx');
  assert.match(canvas, /return windConfirmedNoteText\(lang, effective\.fromLabel, when\);/);
  assert.match(canvas, /\}, \[sectorModel, state\.localWind, lang\]\);/);
  // SectorSummary is compiled by a module-stub test with no isiXhosa lookup in scope, so it keeps showing the model's English.
  const summary = read('components/design/SectorSummary.tsx');
  assert.doesNotMatch(summary, /xh-inline|sector-note-display/);
  assert.ok(read('tests/control-icon-renderers.ts').includes("components/design/SectorSummary.tsx"), 'SectorSummary is still compiled by the module-stub harness');
});

test('g54: no English key is drafted twice with different wording across the shards', () => {
  const seen = new Map<string, string>();
  const g54 = readFileSync(join(SHARD_DIR, 'g54-design-leftovers.ts'), 'utf8');
  for (const file of readdirSync(SHARD_DIR).filter((n) => n.endsWith('.ts') && n !== 'index.ts' && n !== 'g54-design-leftovers.ts')) {
    const text = readFileSync(join(SHARD_DIR, file), 'utf8');
    for (const line of text.split('\n')) { const m = /^\s*("(?:[^"\\]|\\.)*"):\s*"/.exec(line); if (m) seen.set(JSON.parse(m[1]), file); }
  }
  const clashes: string[] = [];
  for (const line of g54.split('\n')) { const m = /^\s*("(?:[^"\\]|\\.)*"):\s*"/.exec(line); if (m && seen.has(JSON.parse(m[1]))) clashes.push(`${JSON.parse(m[1])} (also in ${seen.get(JSON.parse(m[1]))})`); }
  assert.deepEqual(clashes, [], 'g54 must not shadow an existing draft');
});
