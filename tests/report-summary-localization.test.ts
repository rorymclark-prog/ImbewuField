import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import typescript from 'typescript';
import { jsPDF } from 'jspdf';
import { REPORT_SUMMARY_COPY, reportSummaryText, reportSummaryPages, sampleFullSiteReport, buildInkSummaryPdf, preparedSampleReport, preparedExampleNote } from '../lib/report-summary.ts';
import { registerXhInline, inlineDraftsLoaded } from '../lib/xh-inline.ts';
import { XH_INLINE_SOURCE } from '../lib/locales/xh-inline/index.ts';
import { registerReportPdfFont, reportPdfText } from '../lib/report-pdf-font.ts';
import { buildBillOfQuantities } from '../lib/report-boq.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
import type { LocationData } from '../lib/types.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';

const languages = ['zu', 'st', 'ts', 've'] as const;
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/report-summary-translation/source-cases.json')) as { cases: Array<{
  name: string; facts: ReportSiteFacts | null; location: LocationData;
  expected: Record<'en' | 'zu', { one: ReturnType<typeof reportSummaryPages>; five: ReturnType<typeof reportSummaryPages>; full: string }>;
}> };
const sourcePairs = JSON.parse(read('tests/fixtures/report-summary-translation/source-pairs.json')) as Array<{english:string;zu:string}>;
const tokens = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
const figures = (value: string) => (value.match(/\d+(?:[.,]\d+)?/g) ?? []).sort();
const source = new Map(REPORT_SUMMARY_COPY.map(row => [row.english, row]));

test('summary drafts preserve every existing source pair, placeholder and figure', () => {
  assert.equal(source.size, REPORT_SUMMARY_COPY.length, 'one wording authority per source');
  for (const pair of sourcePairs) {
    assert.equal(source.get(pair.english)?.english, pair.english);
    assert.equal(source.get(pair.english)?.zu, pair.zu, 'existing isiZulu clauses must not be rewritten');
  }
  for (const row of REPORT_SUMMARY_COPY) for (const language of languages) {
    assert.ok(row[language].trim());
    assert.notEqual(row[language], row.english, `${language}: English fallback for ${row.english}`);
    assert.deepEqual(tokens(row[language]), tokens(row.english));
    assert.deepEqual(figures(row[language]), figures(row.english));
  }
  assert.equal(reportSummaryText('Vegetable beds established ({count} bed)', 'en', { count: 'Original {name}' }), 'Vegetable beds established (Original {name} bed)', 'replacement values are substituted once');
});

test('a newly authored summary label cannot silently fall back to English', () => {
  function audit(name: string, text: string) {
    const tree = typescript.createSourceFile(name, text, typescript.ScriptTarget.Latest, true);
    function visit(node: typescript.Node) {
      if (typescript.isCallExpression(node) && typescript.isIdentifier(node.expression) && ['t', 'text', 'reportSummaryText'].includes(node.expression.text) && node.arguments[0] && typescript.isStringLiteral(node.arguments[0])) assert.ok(source.has(node.arguments[0].text), `unregistered summary source: ${node.arguments[0].text}`);
      typescript.forEachChild(node, visit);
    }
    visit(tree);
  }
  audit('summary.ts', read('lib/report-summary.ts'));
  assert.throws(() => audit('broken.ts', "reportSummaryText('New unregistered advice', language)"), /unregistered summary source/);
});

test('new summaries retain exact English output and every saved figure, identity and uncertainty distinction', () => {
  for (const row of fixture.cases) {
    const before = JSON.stringify(row);
    assert.deepEqual(reportSummaryPages(row.facts, row.location, 1), row.expected.en.one, row.name);
    assert.deepEqual(reportSummaryPages(row.facts, row.location, 5), row.expected.en.five, row.name);
    assert.equal(sampleFullSiteReport(row.facts, row.location), row.expected.en.full, row.name);
    assert.equal(sampleFullSiteReport(row.facts, row.location, 'unsupported'), row.expected.en.full);
    for (const language of languages) {
      for (const count of [1, 5] as const) {
        const native = reportSummaryPages(row.facts, row.location, count, language);
        const english = count === 1 ? row.expected.en.one : row.expected.en.five;
        assert.equal(native.length, count);
        assert.deepEqual(figures(JSON.stringify(native)), figures(JSON.stringify(english)), `${language}/${row.name}: a source figure changed`);
        for (const [at, page] of native.entries()) assert.equal(page.lines.length, english[at].lines.length, 'translation cannot drop an observation or caveat');
        const all = JSON.stringify(native);
        const measurements = (value: string) => (value.match(/(?:\d[\d .,]* (?:m²|mm|L)|R \d[\d .,]*)/g) ?? []).map(value => value.trim()).sort();
        assert.deepEqual(measurements(all), measurements(JSON.stringify(english)), `${language}: a measured unit or currency amount changed`);
        assert.ok(all.includes(reportSummaryText('Capacity is not water currently available; check which tanks are already installed.', language)));
        assert.ok(all.includes(reportSummaryText('Planned budget, not actual spending. A missing price is not zero. Obtain current local quotes.', language)));
        if (!row.facts) assert.ok(all.includes(reportSummaryText('Not recorded', language)), 'absence must not become zero');
        if (row.location.soil.soilSource !== 'lab' && row.location.soil.soilSource !== 'soilgrids') assert.ok(all.includes(reportSummaryText('Not measured. Arrange a soil test.', language)));
      }
      const full = sampleFullSiteReport(row.facts, row.location, language);
      assert.deepEqual(figures(full), figures(row.expected.en.full), `${language}/${row.name}: sample figure changed`);
      for (const crop of row.facts?.crop?.crops ?? []) {
        assert.ok(full.includes(crop.name), 'catalogue species identities stay exact');
        for (const label of crop.bedLabels) assert.ok(full.includes(label));
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for (const month of [...crop.sowMonths, ...crop.firstSeasonOnlyMonths]) assert.ok(full.includes(recordsMonthShort(language, months.indexOf(month) + 1)), 'month words use the existing calendar authority');
      }
      for (const item of row.facts?.design?.elements ?? []) assert.ok(full.includes(item.name));
      for (const bed of row.facts?.design?.beds ?? []) assert.ok(full.includes(bed.label));
      if (row.facts?.farmName) assert.ok(full.includes(row.facts.farmName));
      for (const english of ['Full design inventory', 'Production spaces', 'Evidence and limitations', 'Next actions and checks']) assert.ok(full.includes(reportSummaryText(english, language)));
    }
    assert.equal(JSON.stringify(row), before, 'rendering cannot mutate source records');
  }
});

test('only code-authored BOQ descriptions translate, even when a saved label looks identical', () => {
  const row = fixture.cases.find(row => row.name === 'saved demo plan')!;
  const facts = structuredClone(row.facts)!;
  facts.design!.elements.push({ name: 'Vegetable beds established (1 bed)', category: 'soil', count: 1, defId: 'compost_bay', status: 'proposed' });
  const boq = buildBillOfQuantities(facts);
  const savedLabel = boq.lines.find(line => line.description === 'Vegetable beds established (1 bed)')!;
  assert.equal(savedLabel.descriptionSource, undefined, 'a text match cannot classify a farmer label');
  const beds = boq.lines.find(line => line.descriptionSource?.kind === 'beds')!;
  assert.equal(beds.descriptionSource?.kind, 'beds');
  for (const language of languages) {
    const full = sampleFullSiteReport(facts, row.location, language);
    assert.ok(full.includes(savedLabel.description));
    assert.ok(full.includes(reportSummaryText('Vegetable beds established ({count} beds)', language, { count: facts.design!.bedCount })));
  }
});

test('the embedded font binaries match the pinned open-font sources and cover every target-language letter', async () => {
  const provenance = JSON.parse(read('lib/report-fonts/provenance.json')) as { files: Array<{module:string;bytes:number;sha256:string}> };
  assert.match(read('lib/report-fonts/OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  const characters = new Set([...REPORT_SUMMARY_COPY.flatMap(row => languages.map(language => row[language])).join(''), ...'ḒḓḼḽṄṅṊṋṰṱ']
    .filter(char => /\p{L}/u.test(char)));
  const doc = new jsPDF();
  const family = await registerReportPdfFont(doc);
  for (const style of ['normal', 'bold']) {
    doc.setFont(family, style);
    const metadata = doc.getFont().metadata as unknown as { cmap: {unicode:{codeMap:Record<number,number>}} };
    for (const char of characters) assert.ok(metadata.cmap.unicode.codeMap[char.codePointAt(0)!], `${style}: missing glyph ${char}`);
  }
  for (const file of provenance.files) {
    const encoded = /export default ("[^"]+");/.exec(read(`lib/report-fonts/${file.module}`))![1];
    const bytes = Buffer.from(JSON.parse(encoded), 'base64');
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  assert.equal(reportPdfText('🌱 Ṱhoho · Ḽara · 12.5 m² · 2 500 L'), 'Ṱhoho · Ḽara · 12.5 m² · 2 500 L', 'old Latin-1 filtering would delete real letters');
  assert.equal(reportPdfText('T\u032dhoho'), 'Ṱhoho', 'canonically decomposed letters remain readable');
});

test('the actual summary exporter passes native words and both safeguards to the PDF renderer at the exact requested page count', async () => {
  const api = jsPDF.API as unknown as {events:Array<[string,(data:any)=>void]>};
  const written: string[] = [];
  const listener = (data: any) => { written.push(JSON.stringify(data.text)); };
  api.events.push(['preProcessText', listener]);
  try {
    for (const language of languages) for (const count of [1,5] as const) {
      written.length = 0;
      const pages = reportSummaryPages(null, fixture.cases[0].location, count, language);
      const blob = await buildInkSummaryPdf(pages, '2026-10-21', language);
      const raw = await blob.text();
      assert.equal((raw.match(/\/Type \/Page\b/g) ?? []).length, count);
      assert.match(raw, /\/ToUnicode/, 'a Unicode text map is required for selectable native letters');
      const actual = written.join(' ');
      for (const text of [reportSummaryText('Mapped boundary', language),reportSummaryText('Draft translation · not reviewed by a fluent speaker.', language),reportSummaryText('Verify measurements and costs before acting.', language)]) assert.ok(actual.includes(text), `${language}: missing native text in actual exporter`);
      assert.ok(actual.includes(reportSummaryText('Not recorded', language)));
    }
    written.length = 0;
    await buildInkSummaryPdf([{title:'Ṱhoho Ḽara',lines:Array(100).fill('Native ṋḽṋ letters with 12.5 m² and 2 500 L')}], '2026-10-21', 've');
    assert.ok(written.join(' ').includes('Ṱhoho Ḽara'));
    assert.ok(written.join(' ').includes(reportSummaryText('Additional detail is in the full report.', 've')), 'overflow must be disclosed in the selected language');
    assert.ok(written.join(' ').includes('12.5 m² and 2 500 L'));
  } finally { api.events.splice(api.events.findIndex(row => row[1] === listener), 1); }
});

// ── isiXhosa in the prepared example (the sample-mode report picker) ───────────────────────────────
const withXhosa = <T,>(run: () => T): T => { registerXhInline(XH_INLINE_SOURCE); try { return run(); } finally { registerXhInline({}); } };
const measurements = (value: string) => (value.match(/(?:\d[\d .,]* (?:m²|mm|L)|R \d[\d .,]*)/g) ?? []).map(value => value.trim()).sort();

test('isiXhosa prepared example keeps the English shape and every figure, name and amount; English and isiZulu are unchanged beside it', () => {
  registerXhInline({});
  const zuBefore = fixture.cases.map(row => ({ full: sampleFullSiteReport(row.facts, row.location, 'zu'), five: reportSummaryPages(row.facts, row.location, 5, 'zu') }));
  withXhosa(() => {
    assert.equal(inlineDraftsLoaded('xh'), true);
    for (const [index, row] of fixture.cases.entries()) {
      for (const count of [1, 5] as const) {
        const native = reportSummaryPages(row.facts, row.location, count, 'xh');
        const english = count === 1 ? row.expected.en.one : row.expected.en.five;
        assert.equal(native.length, count);
        assert.deepEqual(figures(JSON.stringify(native)), figures(JSON.stringify(english)), `xh/${row.name}: a source figure changed`);
        assert.deepEqual(measurements(JSON.stringify(native)), measurements(JSON.stringify(english)), `xh/${row.name}: a measured unit or currency amount changed`);
        for (const [at, page] of native.entries()) assert.equal(page.lines.length, english[at].lines.length, 'translation cannot drop an observation or caveat');
        if (!row.facts) assert.ok(JSON.stringify(native).includes(reportSummaryText('Not recorded', 'xh')), 'absence must not become zero');
      }
      const full = sampleFullSiteReport(row.facts, row.location, 'xh');
      const english = row.expected.en.full;
      assert.deepEqual(figures(full), figures(english), `xh/${row.name}: sample figure changed`);
      assert.deepEqual(measurements(full), measurements(english));
      assert.equal(full.split('\n').length, english.split('\n').length, 'the section and bullet structure is the English one');
      assert.equal(full.split('\n').filter(line => line.startsWith('## ')).length, english.split('\n').filter(line => line.startsWith('## ')).length);
      for (const crop of row.facts?.crop?.crops ?? []) { assert.ok(full.includes(crop.name), 'catalogue species identities stay exact'); for (const label of crop.bedLabels) assert.ok(full.includes(label)); }
      for (const item of row.facts?.design?.elements ?? []) assert.ok(full.includes(item.name));
      for (const bed of row.facts?.design?.beds ?? []) assert.ok(full.includes(bed.label));
      if (row.facts?.farmName) assert.ok(full.includes(row.facts.farmName));
      // The headings and the fixed paragraphs read in isiXhosa, not English.
      for (const key of ['report basis', 'Full design inventory', 'Production spaces', 'Evidence and limitations', 'Next actions and checks']) {
        const draft = reportSummaryText(key, 'xh');
        assert.notEqual(draft, key, `no isiXhosa draft for ${key}`);
        assert.ok(full.includes(draft));
      }
      for (const key of ['This ready-to-read sample is assembled from the saved site and design records. It is not a new AI analysis or an independently verified assessment. Sample finances, soil examples and household examples remain illustrative wherever labelled. Planned areas and infrastructure do not establish completed work.',
        'Site photos and map plates, where available, are shown separately in this report. An AI-generated reference photograph is not evidence of the real site. Missing measurements, quotes or records remain missing. Review the site, dates and evidence with the implementing organisation before using this example for a funding decision.']) {
        assert.notEqual(reportSummaryText(key, 'xh'), key); assert.ok(full.includes(reportSummaryText(key, 'xh')));
      }
      // English and isiZulu are byte-identical with the isiXhosa drafts loaded.
      assert.equal(sampleFullSiteReport(row.facts, row.location), english);
      assert.equal(sampleFullSiteReport(row.facts, row.location, 'zu'), zuBefore[index].full, 'isiZulu is byte-identical with the isiXhosa drafts loaded');
      assert.deepEqual(reportSummaryPages(row.facts, row.location, 5, 'zu'), zuBefore[index].five);
    }
  });
});

test('every English string the prepared example emits through the summary lookup has an isiXhosa draft, including the status words, bed kinds and fallbacks', () => {
  const keys = ['existing', 'proposed', 'mixed', 'bed', 'plot', 'report basis', 'No placed elements recorded.', 'No production spaces recorded.', ...REPORT_SUMMARY_COPY.map(row => row.english)];
  const tree = typescript.createSourceFile('summary.ts', read('lib/report-summary.ts'), typescript.ScriptTarget.Latest, true);
  (function visit(node: typescript.Node) {
    if (typescript.isCallExpression(node) && typescript.isIdentifier(node.expression) && ['t', 'text', 'reportSummaryText'].includes(node.expression.text) && node.arguments[0] && typescript.isStringLiteral(node.arguments[0])) keys.push(node.arguments[0].text);
    typescript.forEachChild(node, visit);
  })(tree);
  assert.ok(keys.length > 60);
  withXhosa(() => assert.deepEqual([...new Set(keys)].filter(key => reportSummaryText(key, 'xh') === key), [], 'English would show through in the isiXhosa prepared example'));
  // Names and amounts are never keys: only code-authored wording is looked up.
  assert.ok(!keys.some(key => /\d/.test(key) && !/\{\w+\}/.test(key)));
});

test('before the isiXhosa drafts load, the prepared example is the English text, byte for byte', () => {
  registerXhInline({});
  assert.equal(inlineDraftsLoaded('xh'), false);
  for (const row of fixture.cases) {
    const full = sampleFullSiteReport(row.facts, row.location, 'xh');
    const english = row.expected.en.full.split('\n'), actual = full.split('\n');
    assert.equal(actual.length, english.length);
    // The only lines that may differ are the ones the existing code labels as English notes for a translated language.
    // Month words come from the calendar authority, not the drafts, so they are put back before comparing.
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const backToEnglish = (line: string) => monthsEn.reduce((text, month, at) => text.replace(new RegExp(`(?<![\\p{L}])${recordsMonthShort('xh', at + 1)}(?![\\p{L}])`, 'gu'), month), line);
    for (const [at, line] of actual.entries()) if (backToEnglish(line) !== english[at]) assert.match(line, /English/, `unlabelled difference: ${line}`);
  }
  assert.equal(preparedExampleNote('xh'), preparedExampleNote('en'));
  assert.equal(reportSummaryText('report basis', 'xh'), 'report basis');
});

test('preparedExampleNote reads in isiXhosa once its draft loads; English, isiZulu and the other languages are unchanged', () => {
  const english = 'Prepared example of saved records. It is not a comprehensive site assessment, design report or evidence of progress. No new AI analysis.';
  const zulu = 'Isibonelo esilungiselelwe samarekhodi agciniwe. Akusikho ukuhlolwa okuphelele kwendawo, umbiko womklamo noma ubufakazi benqubekela-phambili. Akukho ukuhlaziywa okusha kwe-AI.';
  withXhosa(() => {
    assert.equal(preparedExampleNote('xh'), 'Umzekelo olungiselelweyo weerekhodi ezigciniweyo. Ayingovavanyo olubanzi lwendawo, ingxelo yoyilo okanye ubungqina benkqubela. Akukho hlalutyo lutsha lwe-AI.');
    assert.equal(preparedExampleNote('en'), english);
    assert.equal(preparedExampleNote(), english);
    assert.equal(preparedExampleNote('zu'), zulu);
    for (const language of ['st', 'ts', 've', 'fr']) assert.equal(preparedExampleNote(language), english);
  });
  assert.equal(preparedExampleNote('xh'), english, 'English until the drafts load');
});

test('preparedSampleReport keeps isiXhosa once its drafts are loaded, and never labels English text as a translation', () => {
  const row = fixture.cases.find(row => row.name === 'saved demo plan')!;
  const input = (lang: string) => ({ id: `prepared-${lang}`, name: 'Example', savedAt: '2026-11-02T08:00:00.000Z', lang, location: row.location, facts: row.facts ?? undefined }) as unknown as Parameters<typeof preparedSampleReport>[0];
  const zuReport = sampleFullSiteReport(row.facts, row.location, 'zu');
  withXhosa(() => {
    const xh = preparedSampleReport(input('xh'));
    assert.equal(xh.lang, 'xh');
    assert.equal(xh.origin, 'prepared-example');
    assert.equal(xh.report, sampleFullSiteReport(row.facts, row.location, 'xh'));
    assert.deepEqual(xh.analysedMapIds, []);
    assert.equal(xh.settings, undefined);
    assert.equal(preparedSampleReport(input('zu')).lang, 'zu');
    assert.equal(preparedSampleReport(input('zu')).report, zuReport);
    for (const lang of ['en', 'st', 'ts', 've', 'af', 'fr']) assert.equal(preparedSampleReport(input(lang)).lang, 'en', `${lang} stays English`);
    assert.equal(preparedSampleReport(input('en')).report, row.expected.en.full);
  });
  const early = preparedSampleReport(input('xh'));
  assert.equal(early.lang, 'en', 'drafts not loaded: English text is labelled English');
  assert.equal(early.report, row.expected.en.full);
});

test('the sample-mode report picker offers isiXhosa and every inline-draft language, in LANGUAGE_OPTIONS order, and real reports in a draft language carry the AI notice', () => {
  const view = read('components/ReportView.tsx');
  assert.match(view, /LANGUAGE_OPTIONS\.filter\(l => !sampleMode \|\| l\.code === 'en' \|\| l\.code === 'zu' \|\| isInlineDraftLang\(l\.code\)\)\.map/, 'the picker is filtered, never reordered');
  assert.match(view, /import \{ isInlineDraftLang, xhInlineDraft \} from '@\/lib\/xh-inline';/);
  const order = [...(/const LANGUAGE_OPTIONS = \[([\s\S]*?)\] as const;/.exec(view)![1].matchAll(/code: '(\w+)'/g))].map(match => match[1]);
  assert.deepEqual(order, ['en', 'zu', 'xh', 'af', 'st', 'nso', 'tn', 'ts', 've', 'ss', 'nr']);
  const notice = 'This report was written by AI in {language}. It has not been reviewed by a fluent speaker; check figures against the English source.';
  assert.ok(view.includes(`const AI_DRAFT_LANGUAGE_NOTICE = '${notice}';`));
  assert.match(view, /\{report && reading === 'full' && !preparedExample && isInlineDraftLang\(contentLanguage\) && <p role="note"/, 'a prepared example has its own note; a real report in a draft language carries the AI notice');
  assert.match(view, /xhDraft\(AI_DRAFT_LANGUAGE_NOTICE\) \?\? AI_DRAFT_LANGUAGE_NOTICE/);
  withXhosa(() => {
    const draft = XH_INLINE_SOURCE[notice];
    assert.ok(draft && draft !== notice);
    assert.deepEqual(draft.match(/\{\w+\}/g), ['{language}'], 'the language name placeholder survives');
  });
});
