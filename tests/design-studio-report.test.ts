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

test('elements group by display name with counts and honest status', () => {
  const summary = summariseDesignStudio(state({
    items: [
      { id: 'a', defId: 'tree_mango', x: 0.1, y: 0.1 },
      { id: 'b', defId: 'tree_mango', x: 0.2, y: 0.1, status: 'existing' },
      { id: 'c', defId: 'tree_mango', x: 0.3, y: 0.1, label: 'Gogo’s mango' },
      { id: 'd', defId: 'not-a-real-def', x: 0.4, y: 0.1 },
    ] as DesignCanvasState['items'],
  }));
  // The renamed tree is its OWN row (the legend's grouping rule), the unknown defId vanishes
  // exactly as it does on the sheets, and existing+proposed under one name reads 'mixed'.
  assert.equal(summary.elements.length, 2);
  const mangoes = summary.elements.find((group) => group.name !== 'Gogo’s mango');
  assert.ok(mangoes);
  assert.equal(mangoes.count, 2);
  assert.equal(mangoes.status, 'mixed');
  assert.equal(summary.planted.length, 2, 'trees are category growing, so both rows are planted rows');
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
