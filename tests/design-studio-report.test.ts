// The report was BLIND to the Design Studio: 'master-design' said "pending" to a farmer whose
// finished plan was one tab away. These tests pin the bridge (lib/design-studio-report.ts) and
// the builder's use of it — facts only; the deliberate ABSENCE of pricing is itself pinned.
import test from 'node:test';
import assert from 'node:assert/strict';

import { summariseDesignStudio, studioSummaryHasContent } from '../lib/design-studio-report.ts';
import { buildSkeletonReportDoc } from '../lib/report-doc.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { LocationData } from '../lib/types.ts';

// 100 px × 100 px frame at 1 m/px → the frame is 100 m × 100 m, so normalised distances read
// directly as metres × 100. Chosen so every expected number below is checkable by eye.
const state = (partial: Partial<DesignCanvasState>): DesignCanvasState => ({
  siteId: 'site',
  frame: { imgW: 100, imgH: 100, mPerPx: 1 } as DesignCanvasState['frame'],
  items: [],
  zones: [],
  lines: [],
  step: 'base' as DesignCanvasState['step'],
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...partial,
});

test('elements group by catalog id, status and display name', () => {
  const summary = summariseDesignStudio(state({
    items: [
      { id: 'a', defId: 'tree_mango', x: 0.1, y: 0.1 },
      { id: 'b', defId: 'tree_mango', x: 0.2, y: 0.1, status: 'existing' },
      { id: 'c', defId: 'tree_mango', x: 0.3, y: 0.1, label: 'Gogo’s mango' },
      { id: 'd', defId: 'not-a-real-def', x: 0.4, y: 0.1 },
    ] as DesignCanvasState['items'],
  }));
  // THIS TEST USED TO ASSERT 'mixed', which is exactly the defect it was pinning: two mangoes of
  // different status collapsed into one group of 2, and the BOQ — which bills 'mixed' on purpose,
  // because part of it is still to build — then had no way to charge for only the proposed one.
  // Status is part of the grouping key now, so the counts arrive already honest.
  // The renamed tree stays its own row (a farmer who names trees apart must not see them merged)
  // and the unknown defId still vanishes exactly as it does on the sheets.
  assert.equal(summary.elements.length, 3);
  const mangoes = summary.elements.filter((group) => group.name !== 'Gogo’s mango');
  assert.equal(mangoes.length, 2, 'proposed and existing must not share a row');
  assert.deepEqual(mangoes.map((group) => group.count), [1, 1]);
  assert.deepEqual(mangoes.map((group) => group.status).sort(), ['existing', 'proposed']);
  assert.ok(!summary.elements.some((group) => group.status === 'mixed'), 'mixed is no longer produced');
  assert.equal(summary.planted.length, 3, 'trees are category growing, so every row is a planted row');
});

test('route lengths are metres at the frame scale, and scaleCorrection is honoured', () => {
  const base = state({
    lines: [
      { id: 'p', kind: 'path', points: [[0, 0], [0.5, 0]] },
      { id: 's', kind: 'swale', points: [[0, 0.2], [0.3, 0.2]], widthM: 1.5 },
    ] as DesignCanvasState['lines'],
  });
  const summary = summariseDesignStudio(base);
  const path = summary.routes.find((route) => route.kind === 'path');
  const swale = summary.routes.find((route) => route.kind === 'swale');
  assert.equal(path?.totalLengthM, 50);
  assert.equal(swale?.totalLengthM, 30);
  assert.equal(swale?.statedWidthM, 1.5, 'a width the farmer stated must survive to the report');

  const corrected = summariseDesignStudio({ ...base, scaleFactor: 2 });
  assert.equal(
    corrected.routes.find((route) => route.kind === 'path')?.totalLengthM,
    100,
    'the farmer’s own scale correction outranks the projection, in the report as on the sheets',
  );
});

test('two swales with different stated widths cannot share one printed width', () => {
  const summary = summariseDesignStudio(state({
    lines: [
      { id: 's1', kind: 'swale', points: [[0, 0], [0.1, 0]], widthM: 1.5 },
      { id: 's2', kind: 'swale', points: [[0, 0.5], [0.1, 0.5]], widthM: 2 },
    ] as DesignCanvasState['lines'],
  }));
  const swale = summary.routes.find((route) => route.kind === 'swale');
  assert.equal(swale?.count, 2);
  assert.equal(swale?.statedWidthM, undefined);
});

test('ground areas are named feature rings in m²; effort zones and boundary are not areas', () => {
  const summary = summariseDesignStudio(state({
    zones: [
      { id: 'g', zone: 1, feature: 'staple_garden', points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] },
      { id: 'z', zone: 2, points: [[0, 0], [0.9, 0], [0.9, 0.9], [0, 0.9]] },
      { id: 'b', zone: 0, feature: 'boundary', points: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    ] as DesignCanvasState['zones'],
  }));
  assert.equal(summary.groundAreas.length, 1);
  assert.equal(summary.groundAreas[0].areaM2, 2500);
});

test('an empty studio has no content, so the builder keeps its placeholders', () => {
  assert.equal(studioSummaryHasContent(summariseDesignStudio(state({}))), false);
  assert.equal(studioSummaryHasContent(null), false);
});

// ── Builder integration ──────────────────────────────────────────────────────

const REPORT_ARGS = {
  id: 'report',
  siteId: 'site',
  location: { lat: -27.7, lon: 31.9 } as LocationData,
  survey: null,
  layers: [],
  plan: null,
  phasePlan: { phases: [], criticalOrder: [], siteRules: [] },
  createdAt: '2026-08-04T00:00:00.000Z',
};

test('studio facts lead master-design and planting; counts carry user-reported provenance', () => {
  const summary = summariseDesignStudio(state({
    items: [
      { id: 'a', defId: 'tree_mango', x: 0.1, y: 0.1 },
      { id: 'b', defId: 'tree_mango', x: 0.2, y: 0.1 },
    ] as DesignCanvasState['items'],
    lines: [{ id: 's', kind: 'swale', points: [[0, 0], [0.3, 0]], widthM: 1.5 }] as DesignCanvasState['lines'],
  }));
  const doc = buildSkeletonReportDoc({ ...REPORT_ARGS, studio: summary });

  const master = doc.sections['master-design'] ?? [];
  assert.ok(master.length >= 2, 'placed elements and traced routes each earn a feature');
  assert.ok(!master.some((feature) => feature.key === 'design-pending'), 'a real design must not read as pending');
  const route = master.find((feature) => feature.key === 'studio-route-swale');
  assert.match(route?.dimensions ?? '', /30 m total · stated width 1\.5 m/);

  const planting = doc.sections.planting ?? [];
  assert.equal(planting[0]?.category, 'placed');
  const row = planting[0].rows[0];
  assert.equal(row.qty?.value, 2);
  assert.equal(row.qty?.provenance, 'user-reported');
});

test('no studio → exactly the old placeholders; and the studio never prices anything', () => {
  const bare = buildSkeletonReportDoc(REPORT_ARGS);
  assert.ok((bare.sections['master-design'] ?? []).some((feature) => feature.key === 'design-pending'));

  // PRICES ARE A DECISION, NOT A SIDE EFFECT. Costing a Studio element needs a defId→price-book
  // mapping and an existing-vs-proposed costing rule; until Rory makes that call, the studio
  // summary must not put one rand into cost-labour. This pins the boundary so a future "helpful"
  // change cannot cross it silently.
  const summary = summariseDesignStudio(state({
    items: [{ id: 'a', defId: 'tree_mango', x: 0.1, y: 0.1 }] as DesignCanvasState['items'],
  }));
  const withStudio = buildSkeletonReportDoc({ ...REPORT_ARGS, studio: summary });
  assert.deepEqual(
    withStudio.sections['cost-labour'],
    bare.sections['cost-labour'],
    'the studio summary must leave cost-labour byte-identical',
  );
});

test('two definitions sharing one farmer label keep their own catalog ids', () => {
  // The money bug: grouping by display name kept only the FIRST item's defId, and the BOQ prices
  // off that id. Rename a citrus and an avocado both to "Fruit tree" with the citrus placed first
  // and both were quoted at the citrus rate — R600 for R750 of trees — while placing the avocado
  // first quoted R900 for the same two trees. Placement order must never move a farmer's money.
  const items = [
    { id: 'a', defId: 'tree_citrus', x: 0.1, y: 0.1, label: 'Fruit tree' },
    { id: 'b', defId: 'tree_avocado', x: 0.2, y: 0.1, label: 'Fruit tree' },
  ] as DesignCanvasState['items'];
  const summary = summariseDesignStudio(state({ items }));
  assert.equal(summary.elements.length, 2, 'two catalog items must not merge behind one label');
  assert.deepEqual(
    summary.elements.map((group) => group.defId).sort(),
    ['tree_avocado', 'tree_citrus'],
  );
  assert.ok(summary.elements.every((group) => group.count === 1 && group.name === 'Fruit tree'));

  // Order-independence, stated directly: the same two items placed the other way round must
  // produce the same priced identities.
  const reversed = summariseDesignStudio(state({ items: [items[1], items[0]] as DesignCanvasState['items'] }));
  assert.deepEqual(
    reversed.elements.map((group) => group.defId).sort(),
    summary.elements.map((group) => group.defId).sort(),
  );
});

test('one name over an existing and a proposed tank bills only the proposed one', () => {
  // The worked example from the BOQ audit: one JoJo 5000 already standing, one to buy. The
  // summary used to emit a single 'mixed' group of 2 and the bill read R14,000 against a R7,000
  // build — a farmer could go seeking finance for a tank already in their yard.
  const summary = summariseDesignStudio(state({
    items: [
      { id: 't1', defId: 'jojo_5000', x: 0.1, y: 0.5, status: 'existing' },
      { id: 't2', defId: 'jojo_5000', x: 0.2, y: 0.5 },
    ] as DesignCanvasState['items'],
  }));
  const tanks = summary.elements.filter((group) => group.defId === 'jojo_5000');
  assert.equal(tanks.length, 2);
  const proposed = tanks.find((group) => group.status === 'proposed');
  const existing = tanks.find((group) => group.status === 'existing');
  assert.equal(proposed?.count, 1, 'exactly one tank is still to buy');
  assert.equal(existing?.count, 1, 'and exactly one is already standing');
});
