import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SITE, buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { collectReportSiteFacts } from '../lib/report-site-facts-collect.ts';
import { designChangedSince, type FactDesign } from '../lib/report-site-facts.ts';
import { siteReportFigures } from '../lib/report-figures.ts';
import { buildPhasePlan } from '../lib/phasing.ts';
import { EMPTY_MAP_REF_LAYERS } from '../lib/report-map-layers.ts';

// A saved report keeps the facts its words were written from, but its plan, progress and
// build-order pictures are drawn from the design as it is saved today. These tests hold the line
// between the two: say so when they have parted, and say nothing when they have not.

const canvas = buildDemoDesignCanvasState();
const factsFor = (state: typeof canvas) => collectReportSiteFacts({ siteId: state.siteId, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, canvas: state, waterPoints: [], cropPlan: { plantings: [] } as never });
const written = factsFor(canvas);
const design = written.design as FactDesign;
const CHANGED = 'The design has changed since this report was written.';

test('the sample farm has a design to compare', () => {
  assert.ok(design);
  assert.equal(design.bedCount, 7);
  assert.equal(design.plotCount, 4);
  assert.ok(design.elements.length > 0 && design.routes.length > 0);
});

test('the same design, saved again at a later time, has not changed', () => {
  const later = { ...canvas, updatedAt: '2031-01-01T00:00:00.000Z', rev: 99 };
  assert.equal(designChangedSince(design, factsFor(later).design), false);
  assert.equal(designChangedSince(design, structuredClone(design)), false);
});

test('a bed added, a tree removed, a line traced or a bed resized is a change', () => {
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  const tree = canvas.items.find(item => item.defId.startsWith('tree_'))!;
  const added = { ...canvas, items: [...canvas.items, { ...bed, id: 'extra-bed', x: 0.9, y: 0.9 }] };
  const removed = { ...canvas, items: canvas.items.filter(item => item !== tree) };
  const traced = { ...canvas, lines: [...canvas.lines, { ...canvas.lines[0], id: 'extra-path' }] };
  const resized = { ...canvas, items: canvas.items.map(item => (item === bed ? { ...item, wM: (item.wM ?? 1) + 2 } : item)) };
  for (const [what, state] of Object.entries({ added, removed, traced, resized })) {
    assert.equal(designChangedSince(design, factsFor(state).design), true, what);
  }
});

test('moving a bed without resizing it is not reported: the words state counts and areas, not positions', () => {
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  const moved = { ...canvas, items: canvas.items.map(item => (item === bed ? { ...item, x: item.x + 0.01 } : item)) };
  assert.equal(designChangedSince(design, factsFor(moved).design), false);
});

test('with nothing to compare, nothing is claimed', () => {
  assert.equal(designChangedSince(undefined, design), false);
  assert.equal(designChangedSince(design, null), false);
  assert.equal(designChangedSince(null, null), false);
});

test('an older saved report that never recorded plots is not called changed because plots exist now', () => {
  const older = { ...design, plotCount: undefined, plotAreaM2: undefined } as unknown as FactDesign;
  assert.equal(designChangedSince(older, design), false);
});

const figuresFor = (designToday: FactDesign | null | undefined, language = 'en') => siteReportFigures(written, DEMO_LOCATION, language, {
  canvas,
  phasePlan: buildPhasePlan(canvas, EMPTY_MAP_REF_LAYERS, { biome: DEMO_LOCATION.biome.name, rainfallMm: DEMO_LOCATION.rainfall.annual }),
  designToday,
});

test('a report whose design has not changed carries no "changed" line on any picture', () => {
  for (const figures of [figuresFor(design), figuresFor(undefined), figuresFor(null)]) {
    assert.ok(figures.length >= 6);
    for (const figure of figures) assert.ok(!figure.note.includes(CHANGED), figure.id);
  }
});

test('when the design has changed, the three pictures drawn from today’s design say so first', () => {
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  const today = factsFor({ ...canvas, items: [...canvas.items, { ...bed, id: 'extra-bed', x: 0.9, y: 0.9 }] }).design;
  const figures = figuresFor(today);
  const flagged = figures.filter(figure => figure.note.startsWith(CHANGED)).map(figure => figure.id).sort();
  assert.deepEqual(flagged, ['site-plan', 'status', 'timeline']);
  for (const figure of figures.filter(item => !flagged.includes(item.id))) assert.ok(!figure.note.includes(CHANGED), `${figure.id} is drawn from the report's own facts`);
  const plan = figures.find(figure => figure.id === 'site-plan')!;
  assert.match(plan.note, /as it is today\. Drawn to scale from the saved design\./);
});

test('the line is carried in isiZulu too', () => {
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  const today = factsFor({ ...canvas, items: [...canvas.items, { ...bed, id: 'extra-bed', x: 0.9, y: 0.9 }] }).design;
  const plan = figuresFor(today, 'zu').find(figure => figure.id === 'site-plan')!;
  assert.ok(plan.note.startsWith('Umklamo ushintshile selokhu kwabhalwa lo mbiko.'));
});
