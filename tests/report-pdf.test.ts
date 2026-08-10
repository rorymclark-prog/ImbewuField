import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  layoutTableColumns,
  parseReportMarkdown,
  reportPdfFilename,
  stripInlineMarkdown,
  hasOwnCover,
  type ReportBlock,
} from '../lib/report-pdf.ts';

const SAMPLE = `# Permaculture Site Report
Indian Ocean Coastal Belt, Zululand

## Water Harvesting Design

### Strategy
Catch every drop from the crèche roof before it leaves the site.

**Priority earthworks**

1. **Roof gutters to tank** — north side, 12m run
2. Contour swale mid-slope

- Mulch basins around each young tree
- Keep the swale on contour

| Growing area | Size | Daily need |
|--------------|------|------------|
| Kitchen garden | 200 m² | 1,000 L/day |
| Young fruit trees | 80 m² | 400 L/day |

Drip irrigation cuts this by about half.
`;

function kinds(blocks: ReportBlock[]): string[] {
  return blocks.map((b) => b.kind);
}

test('stripInlineMarkdown removes bold and code fences but keeps the words', () => {
  assert.equal(stripInlineMarkdown('**Roof catchment yield:** 76,500 L'), 'Roof catchment yield: 76,500 L');
  assert.equal(stripInlineMarkdown('use `swale` here'), 'use swale here');
  assert.equal(stripInlineMarkdown('  spaced out  '), 'spaced out');
});

test('parseReportMarkdown classifies every line type the report generator emits', () => {
  const blocks = parseReportMarkdown(SAMPLE);
  assert.deepEqual(kinds(blocks), [
    'title',
    'paragraph',
    'h2',
    'h3',
    'paragraph',
    'bold',
    'numbered',
    'numbered',
    'bullet',
    'bullet',
    'table',
    'paragraph',
  ]);
});

test('parseReportMarkdown drops the table separator row and keeps every data row', () => {
  const table = parseReportMarkdown(SAMPLE).find((b) => b.kind === 'table');
  assert.ok(table && table.kind === 'table');
  assert.deepEqual(table.headers, ['Growing area', 'Size', 'Daily need']);
  assert.equal(table.rows.length, 2, 'the |---|---| separator must not become a data row');
  assert.deepEqual(table.rows[0], ['Kitchen garden', '200 m²', '1,000 L/day']);
});

test('parseReportMarkdown keeps the numbered marker and strips the bold run-in', () => {
  const numbered = parseReportMarkdown(SAMPLE).filter((b) => b.kind === 'numbered');
  assert.equal(numbered.length, 2);
  assert.equal(numbered[0].kind === 'numbered' && numbered[0].marker, '1');
  assert.equal(
    numbered[0].kind === 'numbered' && numbered[0].text,
    'Roof gutters to tank — north side, 12m run',
  );
});

test('parseReportMarkdown survives empty and whitespace-only input', () => {
  assert.deepEqual(parseReportMarkdown(''), []);
  assert.deepEqual(parseReportMarkdown('\n\n   \n'), []);
});

test('layoutTableColumns fills exactly the available width', () => {
  const headers = ['Crop', 'Why it fits'];
  const rows = [['Maize', 'Handles the summer rain and stores well after drying']];
  const widths = layoutTableColumns(headers, rows, 500);
  assert.equal(widths.length, 2);
  const total = widths.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 500) < 0.001, `columns summed to ${total}, expected 500`);
  assert.ok(widths[1] > widths[0], 'the wider column should get more space');
});

test('layoutTableColumns never starves a narrow column below the minimum', () => {
  const headers = ['A', 'Some very much longer heading indeed', 'B'];
  const rows = [['x', 'a considerably longer body cell than the others', 'y']];
  const widths = layoutTableColumns(headers, rows, 500, 60);
  for (const w of widths) assert.ok(w >= 59.999, `column width ${w} fell under the 60pt minimum`);
  const total = widths.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 500) < 0.001, `columns summed to ${total}, expected 500`);
});

test('reportPdfFilename is safe for a filesystem and carries the date', () => {
  const name = reportPdfFilename('Indian Ocean Coastal Belt', new Date('2026-08-03T10:00:00Z'));
  assert.equal(name, 'ImbewuField-Site-Report-Indian-Ocean-Coastal-Belt-2026-08-03.pdf');
  assert.ok(!/[/\\:*?"<>|]/.test(reportPdfFilename('Fynbos / Renosterveld: "wet"')));
});

// The regression this whole module exists for. window.print() resolves silently
// inside an installed iOS PWA (manifest display: standalone), so "Export PDF"
// looked dead on a phone while throwing nothing anyone could catch.
test('ReportView exports via the jsPDF pipeline, not window.print()', () => {
  const src = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  assert.ok(!/window\.print\(\)\s*;/.test(src), 'ReportView must not call window.print() — it is a no-op in a standalone iOS PWA');
  assert.ok(!/function printReport/.test(src), 'the old print-dialog handler must be gone');
  assert.ok(/onClick=\{exportPdf\}/.test(src), 'the Export PDF button must be wired to the jsPDF exporter');
  assert.ok(/buildReportPdf/.test(src), 'ReportView must build the PDF with buildReportPdf');
  assert.ok(/deliverPdf/.test(src), 'ReportView must hand the PDF to the device with deliverPdf');
});

test('the report header lets every action wrap instead of running off a phone screen', () => {
  const src = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  const toolbar = src.slice(src.indexOf('{/* ── Toolbar'), src.indexOf('{/* ── Section controls'));
  assert.ok(/flex-wrap/.test(toolbar), 'the toolbar row must wrap so no action lands off-screen at 375px');
  assert.ok(!/\boverflow-x-auto\b/.test(toolbar), 'the fix must not be a horizontally scrolling toolbar');
});

test('a document with its own cover does not get a second one drawn above it', () => {
  // The exported PDF carried two covers with two different titles: a hardcoded "Permaculture Site
  // Analysis Report" block, then the report's own code-authored cover rendered as body markdown
  // below it. The report on screen has exactly one. Found by Codex's report-document audit.
  assert.equal(hasOwnCover(SAMPLE), true);
  assert.equal(hasOwnCover('# Permaculture Site Report — Ubhejane Creche\n\n| Field | Detail |'), true);

  // Leading blank lines and a stray BOM must not hide the heading — a false negative here brings
  // the double cover straight back.
  assert.equal(hasOwnCover('\n\n\n# Title\n'), true);
});

test('a report saved before the cover existed still gets one', () => {
  // The reason this is a conditional and not a deletion. These documents open straight into a
  // section heading; without the built-in block they would export with no cover at all.
  assert.equal(hasOwnCover('## Executive Summary\n\nThe site is...'), false);
  assert.equal(hasOwnCover('Some preamble paragraph.\n\n# Later Heading'), false);
  assert.equal(hasOwnCover(''), false);
});

test('a hash that is not a heading is not a cover', () => {
  assert.equal(hasOwnCover('#hashtag not a heading'), false);
  assert.equal(hasOwnCover('## Section'), false);
});
