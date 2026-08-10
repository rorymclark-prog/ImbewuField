// Staple plots as rotation units in the crop plan — ZoneShape rings traced with
// feature === 'staple_garden' must reach the crop planner as kind: 'plot' PlanBeds,
// the same way veg_bed/raised_bed/keyhole_bed/herb_spiral canvas ITEMS already do via
// bedsFromDesignCanvas. See lib/design-beds-bridge.ts's own doc comment for the
// contract this locks down: plot id = ZoneShape.id verbatim, area via the same
// shoelace-at-frame-scale maths lib/studio-traced-areas.ts uses for boundary/house
// rings, numbering matching staplePlotOrdinalById's creation-order ordinal.

import test from 'node:test';
import assert from 'node:assert/strict';

import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { tasksForPlan, type Planting } from '../lib/crop-plan.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

// Square frame, mPerPx chosen so the maths is hand-checkable: 100 logical px per axis
// at 0.5 m/px = 50 real metres per axis, so a 0.1-normalised span is exactly 5 m.
function canvas(): DesignCanvasState {
  return {
    siteId: 'site:test',
    frame: { centerLng: 31, centerLat: -29, zoom: 18, imgW: 100, imgH: 100, mPerPx: 0.5 },
    items: [],
    zones: [],
    lines: [],
    step: 'planting',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
  };
}

test('bedsFromDesignCanvas returns item beds then staple-garden zones as ordered plots', () => {
  const veg = ELEMENTS_BY_ID.veg_bed;
  const state = canvas();
  state.items.push(
    { id: 'bed-1', defId: 'veg_bed', x: 0.2, y: 0.2 },
    { id: 'bed-2', defId: 'veg_bed', x: 0.3, y: 0.3 },
  );
  // Plot A: 0.1 wide x 0.2 tall normalised -> 5m x 10m real -> 50 m², short side 5m.
  state.zones.push({
    id: 'zone-plot-a',
    zone: 2,
    feature: 'staple_garden',
    points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.3], [0.1, 0.3]],
  });
  // Plot B: 0.3 wide x 0.1 tall normalised -> 15m x 5m real -> 75 m², short side 5m.
  // Named, so its label should come from the zone's own name, not "Plot 2".
  state.zones.push({
    id: 'zone-plot-b',
    zone: 2,
    feature: 'staple_garden',
    name: 'Back field',
    points: [[0.5, 0.5], [0.8, 0.5], [0.8, 0.6], [0.5, 0.6]],
  });

  const beds = bedsFromDesignCanvas(state);
  assert.equal(beds.length, 4, 'two item beds + two staple-garden plots');
  assert.deepEqual(beds.map((b) => b.id), ['bed-1', 'bed-2', 'zone-plot-a', 'zone-plot-b']);

  const [bed1, bed2, plotA, plotB] = beds;
  assert.equal(bed1.kind, undefined, 'a plain item bed carries no kind (reads as "bed")');
  assert.equal(bed2.kind, undefined);
  assert.equal(bed1.areaM2, Math.round(veg.wM * veg.hM * 10) / 10);

  assert.equal(plotA.kind, 'plot');
  assert.equal(plotA.id, 'zone-plot-a', "a plot's id is the ZoneShape id, verbatim");
  assert.equal(plotA.label, 'Plot 1', 'unnamed zone falls back to Plot <ordinal>');
  assert.equal(plotA.areaM2, 50);
  assert.equal(plotA.minDimM, 5);

  assert.equal(plotB.kind, 'plot');
  assert.equal(plotB.id, 'zone-plot-b');
  assert.equal(plotB.label, 'Back field', "a named zone's label wins over Plot <ordinal>");
  assert.equal(plotB.areaM2, 75);
  assert.equal(plotB.minDimM, 5);
});

test('a degenerate staple-garden ring is skipped, but does not shift a later plot\'s ordinal', () => {
  const state = canvas();
  state.zones.push(
    {
      id: 'zone-degenerate',
      zone: 2,
      feature: 'staple_garden',
      points: [[0.1, 0.1], [0.2, 0.2]], // only 2 points — not a ring
    },
    {
      id: 'zone-real',
      zone: 2,
      feature: 'staple_garden',
      points: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]],
    },
  );

  const beds = bedsFromDesignCanvas(state);
  assert.equal(beds.length, 1, 'the 2-point ring produces no plot');
  assert.equal(beds[0].id, 'zone-real');
  // zone-degenerate still consumed ordinal 1 (staplePlotOrdinalById counts every
  // staple_garden zone, degenerate or not), so the survivor is "Plot 2", not "Plot 1".
  assert.equal(beds[0].label, 'Plot 2');
});

test('a zero-area (collinear) staple-garden ring is skipped', () => {
  const state = canvas();
  state.zones.push({
    id: 'zone-flat',
    zone: 2,
    feature: 'staple_garden',
    points: [[0.1, 0.1], [0.2, 0.1], [0.3, 0.1]], // collinear -> zero shoelace area
  });
  assert.deepEqual(bedsFromDesignCanvas(state), []);
});

test('zones with a different ground feature are never treated as plots', () => {
  const state = canvas();
  state.zones.push(
    { id: 'zone-pond', zone: 0, feature: 'cleared', points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]] },
    { id: 'zone-effort', zone: 3, points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]] }, // no `feature` at all
  );
  assert.deepEqual(bedsFromDesignCanvas(state), []);
});

test('bedsFromDesignCanvas(null) stays empty', () => {
  assert.deepEqual(bedsFromDesignCanvas(null), []);
});

test('the demo farm\'s four traced staple blocks emerge as four plots', () => {
  const state = buildDemoDesignCanvasState();
  const beds = bedsFromDesignCanvas(state);
  const plots = beds.filter((b) => b.kind === 'plot');
  assert.equal(plots.length, 4, 'demo-staple-1..4 must each reach the crop planner');
  assert.deepEqual(
    plots.map((p) => p.id).sort(),
    ['demo-staple-1', 'demo-staple-2', 'demo-staple-3', 'demo-staple-4'],
  );
  for (const plot of plots) {
    // The fixture's own comment says "~21 m² each" (6m x 3.5m traced blocks) — allow
    // headroom for the real Web Mercator projection this fixture goes through rather
    // than pinning an exact float.
    assert.ok(plot.areaM2 > 15 && plot.areaM2 < 28, `plot ${plot.id} area ${plot.areaM2} looks wrong`);
    assert.ok(plot.minDimM !== undefined && plot.minDimM > 0);
  }
});

test('tasksForPlan wording: bed and plot prep assess soil before prescribing inputs', () => {
  const beds = [
    { id: 'bed-1', label: 'Bed 1', areaM2: 8, minDimM: 2 },
    { id: 'plot-1', label: 'Plot 1', areaM2: 21, minDimM: 3.5, kind: 'plot' as const },
  ];
  const plantings: Planting[] = [
    { id: 'p-bed', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 3 },
    // Grain maize is retained only as an unverified legacy record; use a
    // source-backed staple-plot crop because this test is about prep wording.
    { id: 'p-plot', bedId: 'plot-1', cropKey: 'pumpkin', sowMonth: 10 },
  ];

  const tasks = tasksForPlan(plantings, beds);
  const bedPrep = tasks.find((t) => t.id === 'p-bed:prep');
  const plotPrep = tasks.find((t) => t.id === 'p-plot:prep');

  assert.ok(bedPrep);
  assert.ok(plotPrep);
  assert.match(bedPrep!.prepText!, /assess soil and drainage/);
  assert.match(plotPrep!.prepText!, /assess soil and drainage/);
  assert.match(`${bedPrep!.prepText} ${plotPrep!.prepText}`, /soil test or local advice/);
  assert.doesNotMatch(`${bedPrep!.prepText} ${plotPrep!.prepText}`, /compost|manure|plough|rip/i);
});

test('tasksForPlan wording: a bed with no kind field (every plan built before PlanBed.kind existed) still reads as a bed', () => {
  const beds = [{ id: 'bed-1', label: 'Bed 1', areaM2: 8, minDimM: 2 }];
  const plantings: Planting[] = [{ id: 'p-1', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 3 }];
  const [prep] = tasksForPlan(plantings, beds).filter((t) => t.action === 'prep');
  assert.match(prep.prepText!, /assess soil and drainage/);
});

test('a circular bed is measured as a circle, not as its bounding square', () => {
  // A 2 m keyhole bed's footprint is π × 1² = 3.14 m², not 4.0. The old bounding-square figure
  // was priced at the per-m² bed rate (R480 against R377 — 27% high) AND used by the crop planner
  // to size plantings, so the farmer was told the bed both costs more and holds more than it does.
  const beds = bedsFromDesignCanvas({
    siteId: 'site',
    frame: { imgW: 100, imgH: 100, mPerPx: 1 } as DesignCanvasState['frame'],
    items: [
      { id: 'k', defId: 'keyhole_bed', x: 0.5, y: 0.5 },
      { id: 'v', defId: 'veg_bed', x: 0.2, y: 0.2, wM: 2, hM: 2 },
    ] as DesignCanvasState['items'],
    zones: [],
    lines: [],
    step: 'base' as DesignCanvasState['step'],
    updatedAt: '2026-08-10T00:00:00.000Z',
  });
  const keyhole = beds.find((bed) => bed.id === 'k');
  const rect = beds.find((bed) => bed.id === 'v');
  assert.equal(keyhole?.areaM2, 3.1, 'circular defs use π r², not the bounding square');
  assert.equal(rect?.areaM2, 4, 'a rectangular bed of the same extent is unchanged');
  // Reach is measured ACROSS the bed, so the circle's min dimension stays its diameter.
  assert.equal(keyhole?.minDimM, 2);
});
