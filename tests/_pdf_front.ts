// TEMPORARY layout harness (delete before the PR): draws the PDF front matter for the sample farm in node.
import { writeFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
// @ts-ignore temporary harness
import { chromium } from '/Users/roryclark/ImbewuField-mapchrome/node_modules/playwright/index.mjs';
import { buildDemoDesignCanvasState, buildDemoBoundaryFC, DEMO_SITE } from '@/lib/demo-farm';
import { DEMO_LOCATION } from '@/lib/demo-site';
import { mergeFarmShapesIntoDesignState } from '@/lib/design-studio';
import { mapRefLayersForCanvas } from '@/lib/report-map-layers';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import { buildPhasePlan } from '@/lib/phasing';
import { siteReportFigures } from '@/lib/report-figures';
import { siteReportVisuals, withReportFigures, reportChartSvg } from '@/lib/report-visuals';
import { drawVisualReportFront } from '@/lib/report-visual-pdf';
const out = process.argv[2];
const keep = (process.argv[3] ?? 'site-plan,land-use,status,rainfall,sectors').split(',');
const canvas = buildDemoDesignCanvasState();
const blank = { siteId: canvas.siteId, layers: [], updatedAt: '' } as never;
const merged = mergeFarmShapesIntoDesignState(buildDemoBoundaryFC(), blank, canvas.siteId);
const mapLayers = mapRefLayersForCanvas(merged.layers, canvas, DEMO_SITE.lat, DEMO_SITE.lon);
const location = { ...DEMO_LOCATION, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon } as typeof DEMO_LOCATION;
const facts = collectReportSiteFacts({ siteId: canvas.siteId, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, canvas, farmName: DEMO_SITE.name } as never) ?? {};
if (!facts.roof) facts.roof = { areaM2: 144, source: 'Traced on the map' } as never;
if (!facts.boundary) facts.boundary = { areaM2: 1037, source: 'Traced on the map' } as never;
const phasePlan = buildPhasePlan(canvas, mapLayers, { biome: location.biome.name, rainfallMm: location.rainfall.annual });
const figures = siteReportFigures(facts, location, 'en', { canvas, mapLayers, phasePlan });
const all = withReportFigures({ ...siteReportVisuals(facts, location, 'en'), title: DEMO_SITE.name, subtitle: '' }, figures, 'en');
console.log('charts', all.charts.map(c => `${c.id}:${c.kind}`).join(' '));
const visuals = { ...all, charts: all.charts.filter(c => keep.includes(c.id) || c.kind !== 'figure') };
const browser = await chromium.launch();
const charts: Record<string, string> = {};
for (const chart of visuals.charts) {
  const { svg, width, height } = reportChartSvg(chart);
  const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" width="${width}" height="${height}"></body>`);
  await page.waitForTimeout(120);
  charts[chart.id] = `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;
  await page.close();
}
await browser.close();
const doc = new jsPDF({ unit: 'pt', format: 'a4' });
drawVisualReportFront(doc, visuals, { charts, photos: [] }, '19 September 2026');
writeFileSync(`${out}/front.pdf`, Buffer.from(doc.output('arraybuffer')));
console.log('pages', doc.getNumberOfPages());
