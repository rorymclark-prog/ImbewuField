import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_SITE, buildDemoBoundaryFC, buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { mergeFarmShapesIntoDesignState } from '../lib/design-studio.ts';
import { mapRefLayersForCanvas } from '../lib/report-map-layers.ts';
import { sectorSiteFromLocation } from '../lib/sector.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';

// The site report's plan is the first drawing that shows the house traced on the MAP and the
// design drawn in the STUDIO together. The sample farm had staple plots, a path and a greywater
// line running straight through the house; nothing showed it until the two were drawn as one.
// These tests hold the sample to what a reader sees on that plan.

type Point = [number, number];

const canvas = buildDemoDesignCanvasState();
const blank = { siteId: canvas.siteId, layers: [], updatedAt: '' } as never;
const merged = mergeFarmShapesIntoDesignState(buildDemoBoundaryFC(), blank, canvas.siteId);
const refs = mapRefLayersForCanvas(merged.layers, canvas, DEMO_SITE.lat, DEMO_SITE.lon);

// Frame pixels are square on the ground, so overlap is judged there rather than in the 0–1 frame.
const px = ([x, y]: readonly number[]): Point => [x * canvas.frame.imgW, y * canvas.frame.imgH];
const metres = (pixels: number) => pixels * canvas.frame.mPerPx;

function open(ring: Point[]): Point[] {
  const last = ring[ring.length - 1];
  return ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1] ? ring.slice(0, -1) : ring;
}

function inside(point: Point, ring: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function cross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

const edges = (ring: Point[]): Array<[Point, Point]> => ring.map((point, index) => [point, ring[(index + 1) % ring.length]]);

function overlaps(a: Point[], b: Point[]): boolean {
  if (a.some(point => inside(point, b)) || b.some(point => inside(point, a))) return true;
  return edges(a).some(([p, q]) => edges(b).some(([r, s]) => cross(p, q, r, s)));
}

function lineEnters(line: Point[], ring: Point[]): boolean {
  if (line.some(point => inside(point, ring))) return true;
  return line.slice(1).some((point, index) => edges(ring).some(([r, s]) => cross(line[index], point, r, s)));
}

const house = open(refs.house.map(px));
const boundary = open(refs.boundary.map(px));
const plots = canvas.zones.filter(zone => zone.feature === 'staple_garden').map(zone => ({ id: zone.id, ring: zone.points.map(px) }));
const beds = canvas.items.filter(item => item.defId === 'veg_bed').map((item) => {
  const [cx, cy] = px([item.x, item.y]);
  const halfW = (item.wM ?? 0) / 2 / canvas.frame.mPerPx;
  const halfH = (item.hM ?? 0) / 2 / canvas.frame.mPerPx;
  return { id: item.id, ring: [[cx - halfW, cy - halfH], [cx + halfW, cy - halfH], [cx + halfW, cy + halfH], [cx - halfW, cy + halfH]] as Point[] };
});

test('the sample farm has a traced house, boundary, plots and beds for the plan to draw', () => {
  assert.ok(house.length >= 8, `the stepped house outline, got ${house.length} corners`);
  assert.ok(boundary.length >= 4, 'the plot boundary');
  assert.equal(plots.length, 4);
  assert.equal(beds.length, 7);
  for (const point of [...house, ...boundary]) assert.ok(point.every(Number.isFinite));
});

test('the overlap check itself sees a block drawn across the house', () => {
  const middle: Point = [house.reduce((sum, point) => sum + point[0], 0) / house.length, house.reduce((sum, point) => sum + point[1], 0) / house.length];
  assert.ok(inside(middle, house), 'the middle of the outline is indoors');
  const block: Point[] = [[middle[0] - 20, middle[1] - 5], [middle[0] + 20, middle[1] - 5], [middle[0] + 20, middle[1] + 5], [middle[0] - 20, middle[1] + 5]];
  assert.equal(overlaps(block, house), true);
  assert.equal(lineEnters([[middle[0] - 400, middle[1]], [middle[0] + 400, middle[1]]], house), true);
});

test('no staple plot is drawn through the house, a vegetable bed or another plot', () => {
  for (const plot of plots) {
    assert.equal(overlaps(plot.ring, house), false, `${plot.id} runs through the house`);
    for (const bed of beds) assert.equal(overlaps(plot.ring, bed.ring), false, `${plot.id} overlaps ${bed.id}`);
    for (const other of plots) if (other !== plot) assert.equal(overlaps(plot.ring, other.ring), false, `${plot.id} overlaps ${other.id}`);
  }
});

test('the vegetable beds stand clear of the house too', () => {
  for (const bed of beds) assert.equal(overlaps(bed.ring, house), false, `${bed.id} runs through the house`);
});

test('every plot and bed lies inside the traced boundary', () => {
  for (const shape of [...plots, ...beds]) {
    for (const point of shape.ring) assert.ok(inside(point, boundary), `${shape.id} reaches outside the fence`);
  }
});

test('moving the plots off the house kept their size: 21 m² each, as the crop plan expects', () => {
  const areas = bedsFromDesignCanvas(canvas).filter(bed => bed.kind === 'plot');
  assert.equal(areas.length, 4);
  for (const plot of areas) assert.ok(Math.abs(plot.areaM2 - 21) < 0.75, `${plot.id} is ${plot.areaM2} m²`);
});

test('the path, the swale and the greywater line go round the house, not through it', () => {
  assert.deepEqual(canvas.lines.map(line => line.kind).sort(), ['greywater', 'path', 'swale']);
  for (const line of canvas.lines) assert.equal(lineEnters(line.points.map(px), house), false, `the ${line.kind} line crosses the house`);
});

test('the greywater line still starts at the house wall, where a diverter would be', () => {
  const greywater = canvas.lines.find(line => line.kind === 'greywater');
  assert.ok(greywater);
  const [sx, sy] = px(greywater.points[0]);
  const nearest = Math.min(...house.map(([hx, hy]) => Math.hypot(hx - sx, hy - sy)));
  assert.ok(metres(nearest) < 1, `starts ${metres(nearest).toFixed(2)} m from the nearest house corner`);
});

test('the sample records a daily water use, so its report can draw the month-by-month water budget', () => {
  assert.ok(Number.isFinite(canvas.dailyWaterUseL) && (canvas.dailyWaterUseL ?? 0) > 0);
});

// ── the report reads sun, slope and wind through the same mapping as the Design Studio ──────────
test('no location gives no sector site, rather than a made-up one', () => {
  assert.equal(sectorSiteFromLocation(null), null);
  assert.equal(sectorSiteFromLocation(undefined), null);
});

test('a location is carried across field for field, and missing parts stay missing', () => {
  const site = sectorSiteFromLocation(DEMO_LOCATION);
  assert.ok(site);
  assert.equal(site.biome, DEMO_LOCATION.biome.name);
  assert.equal(site.rainfallMm, DEMO_LOCATION.rainfall.annual);
  assert.deepEqual(site.monthlyRainfallMm, DEMO_LOCATION.rainfall.monthly);
  assert.equal(site.climate?.windFromSummer, DEMO_LOCATION.climate?.windFromSummer);
  assert.equal(site.climate?.windFromWinter, DEMO_LOCATION.climate?.windFromWinter);
  assert.equal(site.elevation?.aspectDeg, DEMO_LOCATION.elevation?.aspectDeg);
  assert.equal(site.elevation?.slopePct, DEMO_LOCATION.elevation?.slopePct);

  const bare = sectorSiteFromLocation({ ...DEMO_LOCATION, elevation: undefined, climate: undefined } as never);
  assert.ok(bare);
  assert.equal(bare.elevation, undefined, 'no slope is not a flat slope');
  assert.equal(bare.climate, undefined, 'no wind record is not calm');
});

test('the report and the Design Studio read the same location fields into a sector site', () => {
  const paths = (source: string, root: string) => new Set([...source.matchAll(new RegExp(`\\b${root}\\.([A-Za-z]+(?:\\??\\.[A-Za-z]+)*)`, 'g'))].map(match => match[1].replaceAll('?', '')));
  const library = readFileSync(new URL('../lib/sector.ts', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');
  const report = library.match(/export function sectorSiteFromLocation[\s\S]*?\n}\n/)?.[0] ?? '';
  const design = studio.match(/const glossySite: SectorSite \| null = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[locationData\]\);/)?.[0] ?? '';
  const reportPaths = paths(report, 'location');
  const designPaths = paths(design, 'locationData');
  assert.ok(reportPaths.size >= 15 && designPaths.size >= 15, `found ${reportPaths.size} report and ${designPaths.size} Studio fields — has either block been reshaped?`);
  assert.deepEqual([...reportPaths].sort(), [...designPaths].sort());
});
