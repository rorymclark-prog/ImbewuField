import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pdfContentStreams } from './pdf-content-streams.ts';

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

test('_italic_ emphasis is stripped, not printed as underscores', () => {
  // The two sentences that stop a reader treating the priced subtotal as the full build cost were
  // the ones wearing literal underscores: the unpriced-BOQ warning on every such line, and the
  // cost disclaimer. stripInlineMarkdown's doc comment claimed italic all along; the code handled
  // only bold and code. Found by Codex's report-document audit.
  assert.equal(
    stripInlineMarkdown('_no researched rate — get a local quote_'),
    'no researched rate — get a local quote',
  );
  assert.equal(stripInlineMarkdown('Costs are _indicative only_.'), 'Costs are indicative only.');
});

test('an underscore inside a word is not emphasis', () => {
  // The guard that keeps the fix from eating identifiers and file names that appear in report text.
  assert.equal(stripInlineMarkdown('see report_site_facts.ts'), 'see report_site_facts.ts');
  assert.equal(stripInlineMarkdown('rain_barrel and jojo_5000'), 'rain_barrel and jojo_5000');
});

// ── The design maps ──────────────────────────────────────────────────────────
//
// Rory: "Our report still doesn't have the images the design maps we create". It could not — this
// module had no image capability at all: the exported file contained zero image objects.

test('the report carries the design sheets as plates, one image in memory at a time', () => {
  const src = readFileSync(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');
  // The sheets arrive IDENTIFIED, not supplied. An array of data URLs would put every saved sheet
  // (1–3 MB each, dozens of them) in memory at once — the exact shape that has been killing the
  // page on iOS.
  assert.match(src, /sheets\?: ReportPdfSheet\[\]/, 'sheets are being passed as images again');
  assert.match(src, /loadSheetImage\?: \(id: string\) => Promise<string \| null>/,
    'the per-sheet loader is gone, so the caller must hold every image');
  const draw = src.slice(src.indexOf('const plates = meta.sheets'));
  assert.ok(draw.indexOf('await meta.loadSheetImage(sheet.id)') > 0, 'plates no longer fetch per sheet');
  // The full-resolution original must be dropped before the next iteration.
  assert.match(draw, /source = null;/, 'the full-resolution sheet is held across the draw');
  // And the scratch canvas is drained, matching the discipline the sheet pipeline itself follows.
  assert.match(src, /drainCanvasToDataUrl\(canvas, 'image\/jpeg'/,
    'the plate canvas is no longer released the moment its bytes are out');
});

test('a plate that cannot be drawn costs its page, never the report', () => {
  const src = readFileSync(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');
  const draw = src.slice(src.indexOf('const plates = meta.sheets'));
  assert.match(draw, /if \(!source\) continue;/, 'a missing sheet now aborts the whole export');
  assert.match(draw, /if \(!plate\) continue;/, 'an unreadable sheet now aborts the whole export');
  // sheetPlate itself swallows rather than throws, for the same reason.
  const plate = src.slice(src.indexOf('async function sheetPlate'));
  assert.match(plate.slice(0, plate.indexOf('\n}\n')), /catch \{\s*return null;/,
    'sheetPlate throws again — one bad image would cost the farmer the document');
});

test('plates are downscaled for print rather than embedded at sheet resolution', () => {
  const src = readFileSync(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');
  const m = /const SHEET_PLATE_MAX_PX = (\d+);/.exec(src);
  assert.ok(m, 'the plate size cap is gone — a 2730 px master would be embedded whole');
  const cap = Number(m![1]);
  // Big enough to beat A4 at 150 dpi (~1240 px across the column), small enough that a farmer can
  // still send the file over WhatsApp.
  assert.ok(cap >= 1240 && cap <= 2000, `plate cap ${cap} is outside the useful print range`);
  // Never enlarged: a plan printed above its own resolution is a blurry plan.
  // The cap is now a defaulted parameter rather than a constant read inside the function — the
  // analysis path reuses this same downscaler at a smaller size to hand sheets to a vision model
  // (lib/report-site-images.ts). The print default and the no-upscale rule both still hold.
  assert.match(src, /maxPx: number = SHEET_PLATE_MAX_PX/, 'the print default is no longer the cap');
  assert.match(src, /Math\.min\(1, maxPx/, 'plates can now be scaled UP');
  assert.match(src, /Math\.min\(availW \/ plate\.width, availH \/ plate\.height\)/,
    'the plate no longer fits itself to the page');
});

test('sheetPlate downscales, paints paper white, and releases its canvas', async () => {
  // The behaviour, not the shape. sheetPlate runs on the phone that has been dying of canvas
  // memory, so what matters is that a 2730 px master comes back small and the scratch canvas is
  // zeroed before the next plate starts.
  const calls: string[] = [];
  let released = false;
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      imageSmoothingQuality: '',
      fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fillRect:${w}x${h}`),
      drawImage: (_img: unknown, _x: number, _y: number, w: number, h: number) => calls.push(`draw:${w}x${h}`),
    }),
    toDataURL: (type?: string, q?: number) => {
      calls.push(`toDataURL:${type}:${q}:at ${fakeCanvas.width}x${fakeCanvas.height}`);
      return 'data:image/jpeg;base64,PLATE';
    },
  };
  class FakeImage {
    naturalWidth = 2730; naturalHeight = 1930;
    set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  const g = globalThis as unknown as Record<string, unknown>;
  const prevDoc = g.document; const prevImg = g.Image;
  g.document = { createElement: () => fakeCanvas };
  g.Image = FakeImage;
  try {
    const { sheetPlate } = await import('../lib/report-pdf.ts');
    const plate = await sheetPlate('data:image/png;base64,SOURCE');
    assert.ok(plate, 'a readable sheet produced no plate');
    // 2730x1930 capped to 1600 on the long edge, aspect kept.
    assert.equal(plate!.width, 1600);
    assert.equal(plate!.height, Math.round(1930 * (1600 / 2730)));
    assert.equal(plate!.dataUrl, 'data:image/jpeg;base64,PLATE');
    // White paper is painted BEFORE the sheet, so transparent margins print as paper not black.
    assert.ok(calls.indexOf('fillRect:1600x1131') < calls.indexOf('draw:1600x1131'),
      'the white ground is painted after the image, or not at all');
    // Read happened at full size, and the buffer was released after.
    assert.match(calls.find((c) => c.startsWith('toDataURL')) ?? '', /at 1600x1131/);
    released = fakeCanvas.width === 0 && fakeCanvas.height === 0;
    assert.ok(released, 'the plate canvas keeps its backing store — this is the iOS killer');
  } finally {
    g.document = prevDoc; g.Image = prevImg;
  }
});

// ── Every page carries its footer ────────────────────────────────────────────
//
// footer() stamps the page number, attribution and trust line onto the page being LEFT, exactly
// like newPage() does for the body loop. The plates loop and the photos loop each called
// doc.addPage() directly instead of going through newPage() or footer()+addPage(), so every page
// up to the second-last in the whole document silently lost its page number and its trust line —
// only the true last page (stamped once at the very end) ever got one. A report with plates or
// photos is the normal export, not an edge case.
test('a new plate page and a new photo page both stamp the footer of the page they leave', () => {
  const src = readFileSync(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');

  const plateLoop = src.slice(src.indexOf('const plates = meta.sheets'), src.indexOf('const photos = meta.photos'));
  const plateAddPage = plateLoop.indexOf('doc.addPage();');
  assert.ok(plateAddPage > 0, 'the plates loop no longer calls doc.addPage()');
  assert.match(
    plateLoop.slice(0, plateAddPage),
    /footer\(\);\s*$/,
    'a new plate page must call footer() on the page being left before doc.addPage(), the same discipline newPage() uses for the body',
  );

  const photoLoop = src.slice(src.indexOf('const photos = meta.photos'));
  const photoAddPage = photoLoop.indexOf('doc.addPage();');
  assert.ok(photoAddPage > 0, 'the photos loop no longer calls doc.addPage()');
  assert.match(
    photoLoop.slice(0, photoAddPage),
    /footer\(\);\s*$/,
    'a new photo page must call footer() on the page being left before doc.addPage(), the same discipline newPage() uses for the body',
  );

  // And the true last page — stamped once, after both loops — must still get exactly one call.
  const afterPhotoLoop = src.slice(src.lastIndexOf('}', src.indexOf("return doc.output('blob')")));
  assert.match(afterPhotoLoop, /footer\(\);\s*\n\s*return doc\.output\('blob'\);/,
    'the final page must still be stamped once, after the last loop runs');
});

// A table that runs past the bottom margin breaks to a new page (need() already did that), but
// the column headers were drawn once at the top and never again — a species list or a full BOQ
// long enough to split continued on page two as bare numbers with nothing above them to say
// which column was which. lib/crop-export-pdf.ts's table() already repeats its header on every
// continuation page; this file's table case did not.
test('a report table repeats its header and retains its final row across pages', async () => {
  // Test the emitted document rather than pinning one pagination implementation.
  const { buildReportPdf } = await import('../lib/report-pdf.ts');
  const rows = Array.from({ length: 160 }, (_, i) => `| Crop ${i} | Recorded observation ${i} |`).join('\n');
  const blob = await buildReportPdf(`# QA\n\n## Table\n| Crop | Field observation |\n|---|---|\n${rows}`, { biome: 'Fixture', lat: -27, lon: 31, rainfallMm: 800, meanTempC: 21, dateLabel: '2026-09-05' });
  const output = pdfContentStreams(await blob.arrayBuffer());
  assert.ok((output.match(/Field observation/g) ?? []).length > 1, 'header must repeat');
  assert.match(output, /Recorded observation 159/, 'the final row must survive pagination');
});

test('sheetPlate returns null instead of throwing when an image will not load', async () => {
  class BrokenImage {
    naturalWidth = 0; naturalHeight = 0;
    set src(_v: string) { setTimeout(() => this.onerror?.(), 0); }
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  const g = globalThis as unknown as Record<string, unknown>;
  const prevDoc = g.document; const prevImg = g.Image;
  g.document = { createElement: () => ({ getContext: () => null, toDataURL: () => '' }) };
  g.Image = BrokenImage;
  try {
    const { sheetPlate } = await import('../lib/report-pdf.ts');
    assert.equal(await sheetPlate('data:image/png;base64,BROKEN'), null);
  } finally {
    g.document = prevDoc; g.Image = prevImg;
  }
});

test('ink summaries preserve an exact page count and disclose missing data', async () => {
  const { reportSummaryPages, buildInkSummaryPdf } = await import('../lib/report-summary.ts');
  const { DEMO_LOCATION } = await import('../lib/demo-site.ts');
  const location = { ...DEMO_LOCATION, soil: { ...DEMO_LOCATION.soil, soilSource: 'estimate' as const } };
  const one = reportSummaryPages(null, location, 1);
  assert.match(one[0].lines.join('\n'), /Not measured/);
  assert.doesNotMatch(one[0].lines.join('\n'), /pH 6\.5|subtotal: R 0/);
  for (const count of [1, 5] as const) {
    const pages = reportSummaryPages(null, location, count, 'zu');
    const blob = await buildInkSummaryPdf(pages, '2026-09-05', 'zu');
    assert.equal(((await blob.text()).match(/\/Type \/Page\b/g) ?? []).length, count);
  }
});

// The visual report must preserve absent data and the saved calendar's one-off
// qualifiers; decoration must never turn a plan into a claim of production.
import { siteReportVisuals, sampleReportVisuals, reportChartSvg } from '../lib/report-visuals.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';
import type { LocationData } from '../lib/types.ts';
import { SAMPLE_GARDENS } from '../lib/sample-gardens.ts';
const visualLocation = { lat: -27, lon: 31, rainfall: { annual: 600, monthly: Array(12).fill(50), rainfallSource: 'test fixture' } } as LocationData;

test('visual report leaves missing ground measurements absent and rejects incomplete rainfall series', () => {
  const view = siteReportVisuals(null, { ...visualLocation, rainfall: { ...visualLocation.rainfall, monthly: [50, 40] } });
  assert.equal(view.charts.length, 0);
  assert.ok(!view.metrics.some(m => /Growing space|Storage|Mapped site/.test(m.label)));
});

test('unknown tank capacity is not shown as zero available water', () => {
  const facts: ReportSiteFacts = { water: { tanks: [{ name: 'Tank', count: 1, statedLitres: null, status: 'proposed' }], statedStorageLitres: 0, tanksOfUnknownCapacity: 1, mapPoints: [], bodies: [] } };
  const view = siteReportVisuals(facts, visualLocation);
  assert.equal(view.metrics.find(m => m.label === 'Storage in the plan')?.value, 'Not stated');
  assert.deepEqual(view.charts.find(c => c.id === 'water')?.rows, []);
});

test('every saved crop survives calendar pagination with first-season months marked separately', () => {
  const facts: ReportSiteFacts = { crop: { plantingCount: 16, bedsPlanted: 8, crops: Array.from({ length: 8 }, (_, i) => ({ name: `Saved row ${i}`, sowMonths: ['Jan', 'Apr'], firstSeasonOnlyMonths: ['Jan'], bedLabels: [`Bed ${i}`], alreadyGrowing: false })) } };
  const calendars = siteReportVisuals(facts, visualLocation).charts.filter(c => c.kind === 'calendar');
  assert.equal(calendars.length, 2);
  assert.equal(calendars.flatMap(c => c.rows).length, 8);
  assert.deepEqual(calendars[0].rows[0].months, [0, 3]);
  assert.deepEqual(calendars[0].rows[0].once, [0]);
  assert.match(reportChartSvg(calendars[0]).svg, /fill="white"/);
});

test('sample report charts reconcile to each garden without manufacturing financial or annual yield figures', () => {
  for (const garden of SAMPLE_GARDENS) {
    const view = sampleReportVisuals(garden);
    assert.equal(view.charts.find(c => c.id === 'area')!.rows.reduce((n, r) => n + r.value, 0), garden.areaM2);
    assert.equal(view.charts.find(c => c.id === 'learning')!.rows[0].value, garden.training);
    assert.ok(!view.charts.some(c => /profit|yield|rain|cost/.test(c.id)));
  }
});

test('chart artwork escapes saved labels before SVG rendering', () => {
  const { svg } = reportChartSvg({ id: 'escape', title: 'Test', note: '', unit: 'm²', kind: 'bars', rows: [{ label: '<script> & "A"', value: 10 }] });
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /&lt;script&gt; &amp; &quot;A&quot;/);
});
