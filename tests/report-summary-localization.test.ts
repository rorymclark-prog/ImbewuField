import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import typescript from 'typescript';
import { jsPDF } from 'jspdf';
import { REPORT_SUMMARY_COPY, reportSummaryText, reportSummaryPages, sampleFullSiteReport, buildInkSummaryPdf } from '../lib/report-summary.ts';
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
