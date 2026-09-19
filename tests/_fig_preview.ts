import { writeFileSync } from 'node:fs';
import { buildDemoDesignCanvasState, buildDemoBoundaryFC, DEMO_SITE } from '@/lib/demo-farm';
import { DEMO_LOCATION } from '@/lib/demo-site';
import { mergeFarmShapesIntoDesignState } from '@/lib/design-studio';
import { mapRefLayersForCanvas } from '@/lib/report-map-layers';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import { buildPhasePlan } from '@/lib/phasing';
import * as figures from '@/lib/report-figures';
const out = process.argv[2];
const variant = process.argv[3] ?? 'full';
const canvas = buildDemoDesignCanvasState();
const blank = { siteId: canvas.siteId, layers: [], updatedAt: '' } as never;
const merged = mergeFarmShapesIntoDesignState(buildDemoBoundaryFC(), blank, canvas.siteId);
const refs = mapRefLayersForCanvas(merged.layers, canvas, DEMO_SITE.lat, DEMO_SITE.lon);
const location = { ...DEMO_LOCATION, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, soil: { ...DEMO_LOCATION.soil, soilSource: variant === 'lab' ? 'lab' : variant === 'bare' ? 'estimate' : 'soilgrids' } } as typeof DEMO_LOCATION;
if (variant !== 'bare') { canvas.localWind = { prevailingFrom: 'SW', strongestFrom: 'NW', recordedAt: new Date().toISOString() } as never; }
const facts = collectReportSiteFacts({ siteId: canvas.siteId, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, canvas, farmName: DEMO_SITE.name } as never) ?? {};
if (!facts.roof) facts.roof = { areaM2: 144, source: 'Traced on the map' } as never;
if (!facts.boundary) facts.boundary = { areaM2: 1037, source: 'Traced on the map' } as never;
console.log('facts', JSON.stringify({ roof: facts.roof, boundary: facts.boundary, m: facts.measurements, water: facts.water?.statedStorageLitres, beds: facts.design?.bedAreaM2, plots: facts.design?.plotAreaM2 }));
const phasePlan = buildPhasePlan(canvas, refs, { biome: location.biome.name, rainfallMm: location.rainfall.annual });
const all = [
  figures.sitePlanFigure(canvas, 'en', refs),
  figures.climateFigure(location, 'en'),
  figures.waterBudgetFigure(facts, location, 'en'),
  figures.sectorFigure(location, facts, 'en'),
  figures.soilFigure(location, 'en'),
  figures.timelineFigure(phasePlan, 'en'),
  figures.landUseFigure(facts, 'en'),
  figures.statusFigure(canvas, 'en'),
];
for (const f of all) { if (!f) { console.log('NULL figure'); continue; } writeFileSync(`${out}/${f.id}${variant === 'full' ? '' : `-${variant}`}.svg`, f.svg); console.log(`\n[${f.id}] ${f.title} ${f.width}x${f.height}\n note: ${f.note}\n source: ${f.source}\n alt: ${f.alt.slice(0, 260)}`); }
