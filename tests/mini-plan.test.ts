import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  miniPlanFromCanvas,
  miniPlanFromFacilitator,
  MINI_W,
  MINI_H,
  MINI_MAX_PX_PER_M,
  type MiniPlan,
  type MiniRect,
} from '@/lib/mini-plan';
import type { DesignCanvasState } from '@/lib/design-canvas';
import type { FacilitatorDesignState } from '@/lib/facilitator-design';

// A frame whose ground is exactly 100 m x 100 m, so a normalised 0.5 is 50 m and
// every expectation below can be read in metres without arithmetic.
function canvas(partial: Partial<DesignCanvasState>): DesignCanvasState {
  return {
    siteId: 'site:-29.00000,30.00000',
    frame: { imgW: 1000, imgH: 1000, mPerPx: 0.1 } as DesignCanvasState['frame'],
    items: [],
    zones: [],
    lines: [],
    step: 'place' as DesignCanvasState['step'],
    updatedAt: '2026-08-23T00:00:00.000Z',
    ...partial,
  } as DesignCanvasState;
}

const bedsOf = (p: MiniPlan) => p.shapes.filter((s) => s.paint === 'bed') as MiniRect[];

test('mini plan: nothing to draw returns null rather than an empty plate', () => {
  assert.equal(miniPlanFromCanvas(null), null);
  assert.equal(miniPlanFromCanvas(canvas({})), null);
  assert.equal(miniPlanFromFacilitator(null), null);
});

test('mini plan: beds are drawn, counted, and land inside the plate', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 'a', defId: 'veg_bed', x: 0.2, y: 0.3 },
      { id: 'b', defId: 'veg_bed', x: 0.8, y: 0.3 },
      { id: 'c', defId: 'veg_bed', x: 0.5, y: 0.7 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan, 'three beds should produce a plan');
  assert.equal(plan.bedCount, 3);
  assert.equal(plan.plotCount, 0);
  assert.equal(bedsOf(plan).length, 3);
  for (const b of bedsOf(plan)) {
    assert.ok(b.cx - b.w / 2 >= -0.001 && b.cx + b.w / 2 <= MINI_W + 0.001, `bed x within plate: ${b.cx}`);
    assert.ok(b.cy - b.h / 2 >= -0.001 && b.cy + b.h / 2 <= MINI_H + 0.001, `bed y within plate: ${b.cy}`);
  }
});

test('mini plan: the fit is uniform — a plan is never stretched to fill the box', () => {
  // Two beds 60 m apart across, 6 m apart down: a wide, shallow arrangement in a
  // 8:5 box. A stretched fit would give the two axes different scales.
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 'a', defId: 'veg_bed', x: 0.2, y: 0.47 },
      { id: 'b', defId: 'veg_bed', x: 0.8, y: 0.53 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan);
  const [a, b] = bedsOf(plan);
  const dxPx = Math.abs(b.cx - a.cx);
  const dyPx = Math.abs(b.cy - a.cy);
  // 60 m across, 6 m down → the drawn offsets must keep that same 10:1 ratio.
  assert.ok(Math.abs(dxPx / dyPx - 10) < 0.01, `uniform scale expected, got ${dxPx / dyPx}`);
  // …and each bed keeps its own 1.2 x 3 m proportions.
  assert.ok(Math.abs(a.h / a.w - 3 / 1.2) < 0.001, `bed proportions kept, got ${a.h / a.w}`);
});

test('mini plan: a small site is drawn small — the scale cap holds', () => {
  // One 1.2 x 3 m bed. Without the cap this fills the plate and reads exactly as
  // large as a quarter-hectare of maize on the card beside it.
  const plan = miniPlanFromCanvas(canvas({
    items: [{ id: 'a', defId: 'veg_bed', x: 0.5, y: 0.5 }] as DesignCanvasState['items'],
  }));
  assert.ok(plan);
  const [bed] = bedsOf(plan);
  assert.ok(Math.abs(bed.w - 1.2 * MINI_MAX_PX_PER_M) < 0.001, `capped width, got ${bed.w}`);
  assert.ok(bed.w < MINI_W / 3, 'a single small bed must not fill the plate');
  assert.equal(plan.spanM, 3);
});

test('mini plan: a rotated bed is fitted by its rotated corners, not its box', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 'a', defId: 'veg_bed', x: 0.1, y: 0.5, wM: 4, hM: 40, rot: 45 },
      { id: 'b', defId: 'veg_bed', x: 0.9, y: 0.5, wM: 4, hM: 40, rot: 45 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan);
  const rad = Math.PI / 4;
  for (const b of bedsOf(plan)) {
    for (const [dx, dy] of [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]]) {
      const x = b.cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      const y = b.cy + dx * Math.sin(rad) + dy * Math.cos(rad);
      assert.ok(x >= -0.01 && x <= MINI_W + 0.01, `rotated corner x inside plate: ${x}`);
      assert.ok(y >= -0.01 && y <= MINI_H + 0.01, `rotated corner y inside plate: ${y}`);
    }
  }
});

test('mini plan: a staple plot is a hatched polygon and is counted separately', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [{ id: 'a', defId: 'veg_bed', x: 0.2, y: 0.2 }] as DesignCanvasState['items'],
    zones: [{
      id: 'z1',
      zone: 3,
      feature: 'staple_garden',
      points: [[0.4, 0.4], [0.9, 0.4], [0.9, 0.9], [0.4, 0.9]],
    }] as DesignCanvasState['zones'],
  }));
  assert.ok(plan);
  assert.equal(plan.plotCount, 1);
  assert.equal(plan.bedCount, 1);
  const poly = plan.shapes.find((s) => s.paint === 'plot');
  assert.ok(poly && poly.kind === 'poly', 'staple ground draws as a polygon');
  assert.equal(poly.points.length, 4);
});

test('mini plan: ground the beds sit ON is not drawn over them', () => {
  // A lawn ring wrapping the whole site would be a grey blob hiding every bed.
  const plan = miniPlanFromCanvas(canvas({
    items: [{ id: 'a', defId: 'veg_bed', x: 0.5, y: 0.5 }] as DesignCanvasState['items'],
    zones: [{
      id: 'z1', zone: 2, feature: 'lawn',
      points: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]],
    }] as DesignCanvasState['zones'],
  }));
  assert.ok(plan);
  assert.equal(plan.shapes.filter((s) => s.kind === 'poly').length, 0);
  assert.equal(plan.bedCount, 1);
});

test('mini plan: trees are drawn under the beds, never over them', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 'bed', defId: 'veg_bed', x: 0.5, y: 0.5 },
      { id: 'tree', defId: 'tree_citrus', x: 0.5, y: 0.5 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan);
  const canopyAt = plan.shapes.findIndex((s) => s.paint === 'canopy');
  const bedAt = plan.shapes.findIndex((s) => s.paint === 'bed');
  assert.ok(canopyAt >= 0 && bedAt >= 0);
  assert.ok(canopyAt < bedAt, 'canopy must be painted before (under) the bed');
  const canopy = plan.shapes[canopyAt];
  assert.equal(canopy.kind, 'ellipse', 'a tree is a disc, not a box');
});

test('mini plan: a circular bed keeps no stored rotation', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 'k', defId: 'keyhole_bed', x: 0.4, y: 0.5, rot: 37 },
      { id: 'v', defId: 'veg_bed', x: 0.6, y: 0.5, rot: 37 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan);
  const circle = bedsOf(plan).find((b) => b.kind === 'ellipse');
  const box = bedsOf(plan).find((b) => b.kind === 'rect');
  assert.ok(circle && box);
  assert.equal(circle.rot, 0);
  assert.equal(box.rot, 37);
});

test('mini plan: the farmer scale correction moves the plate with the bed maths', () => {
  const items = [
    { id: 'a', defId: 'veg_bed', x: 0.2, y: 0.5 },
    { id: 'b', defId: 'veg_bed', x: 0.8, y: 0.5 },
  ] as DesignCanvasState['items'];
  const plain = miniPlanFromCanvas(canvas({ items }));
  const halved = miniPlanFromCanvas(canvas({ items, scaleFactor: 0.5 }));
  assert.ok(plain && halved);
  // 60 m between centres becomes 30 m — the SAME frame correction lib/design-beds-
  // bridge measures through, so a plate can never disagree with the bed list beside
  // it. The extra 1.2 m in each span is the beds' own width, which is stored in
  // absolute metres and is therefore NOT scaled by the frame correction: that is the
  // app's existing behaviour (bedsFromDesignCanvas areas ignore scaleFactor too),
  // pinned here so a plate never quietly starts disagreeing with those areas.
  assert.equal(plain.spanM, 61.2);
  assert.equal(halved.spanM, 31.2);
});

// ── legacy cloud (facilitator) designs ──────────────────────────────────────

function facState(partial: Partial<FacilitatorDesignState>): FacilitatorDesignState {
  return {
    version: 1,
    items: [],
    lines: [],
    sectors: [],
    pxPerM: 10,
    activeLayer: 'planting' as FacilitatorDesignState['activeLayer'],
    hiddenLayers: [],
    ...partial,
  } as FacilitatorDesignState;
}

test('mini plan (cloud): beds are read in px when metre fields are absent', () => {
  const plan = miniPlanFromFacilitator(facState({
    items: [
      { id: 'a', type: 'bed', x: 100, y: 200, wM: 1.2, hM: 3, rotation: 0 },
      { id: 'b', type: 'bed', x: 400, y: 200, wM: 1.2, hM: 3, rotation: 0 },
    ] as FacilitatorDesignState['items'],
  }));
  assert.ok(plan);
  assert.equal(plan.bedCount, 2);
  // 300 px at 10 px/m = 30 m apart; the beds themselves add 1.2 m of width.
  assert.equal(plan.spanM, 31.2);
});

test('mini plan (cloud): a design where only SOME items carry metres is read entirely in px', () => {
  // The two frames differ by the background rect's offset. Mixing them would fling
  // the metre-bearing bed a whole background-width away from its neighbours.
  const plan = miniPlanFromFacilitator(facState({
    items: [
      { id: 'a', type: 'bed', x: 100, y: 200, wM: 1.2, hM: 3, rotation: 0 },
      { id: 'b', type: 'bed', x: 400, y: 200, xM: 940, yM: 20, wM: 1.2, hM: 3, rotation: 0 },
    ] as FacilitatorDesignState['items'],
  }));
  assert.ok(plan);
  assert.equal(plan.spanM, 31.2, 'the stray xM must be ignored, not mixed in');
});

test('mini plan (cloud): every item carrying metres is read in metres', () => {
  const plan = miniPlanFromFacilitator(facState({
    pxPerM: 10,
    items: [
      { id: 'a', type: 'bed', x: 100, y: 200, xM: 0, yM: 0, wM: 1.2, hM: 3, rotation: 0 },
      { id: 'b', type: 'bed', x: 400, y: 200, xM: 50, yM: 0, wM: 1.2, hM: 3, rotation: 0 },
    ] as FacilitatorDesignState['items'],
  }));
  assert.ok(plan);
  assert.equal(plan.spanM, 51.2);
});

test('mini plan (cloud): no scale and no metres is a null plate, not a scrambled one', () => {
  const plan = miniPlanFromFacilitator(facState({
    pxPerM: 0,
    items: [{ id: 'a', type: 'bed', x: 100, y: 200, wM: 1.2, hM: 3, rotation: 0 }] as FacilitatorDesignState['items'],
  }));
  assert.equal(plan, null);
});

test('mini plan (cloud): a design of only trees still draws, with no beds claimed', () => {
  const plan = miniPlanFromFacilitator(facState({
    items: [
      { id: 'a', type: 'tree', x: 100, y: 100, wM: 4, hM: 4, rotation: 0 },
      { id: 'b', type: 'tree', x: 300, y: 100, wM: 4, hM: 4, rotation: 0 },
    ] as FacilitatorDesignState['items'],
  }));
  assert.ok(plan);
  assert.equal(plan.bedCount, 0);
  assert.equal(plan.shapes.filter((s) => s.paint === 'canopy').length, 2);
});

test('mini plan: a far-off tank sets no frame — the beds do', () => {
  // The subject of a crop plan is its beds. A rainwater tank 80 m away used to set
  // the bounding box and shrink every bed to a speck in the middle of the plate.
  const items = [
    { id: 'a', defId: 'veg_bed', x: 0.40, y: 0.50 },
    { id: 'b', defId: 'veg_bed', x: 0.46, y: 0.50 },
  ] as DesignCanvasState['items'];
  const tight = miniPlanFromCanvas(canvas({ items }));
  const withTank = miniPlanFromCanvas(canvas({
    items: [...items, { id: 't', defId: 'jojo_5000', x: 0.95, y: 0.05 }] as DesignCanvasState['items'],
  }));
  assert.ok(tight && withTank);
  const [a] = bedsOf(tight);
  const [b] = bedsOf(withTank);
  assert.equal(a.w, b.w, 'the beds must be drawn at the same size with or without the tank');
  assert.equal(tight.spanM, withTank.spanM, 'the framed span is the growing area');
  assert.ok(withTank.shapes.some((s) => s.paint === 'water'), 'the tank is still drawn, just not framed on');
});

test('mini plan: a design with no beds at all still frames on what it does have', () => {
  const plan = miniPlanFromCanvas(canvas({
    items: [
      { id: 't1', defId: 'tree_citrus', x: 0.3, y: 0.4 },
      { id: 't2', defId: 'tree_citrus', x: 0.7, y: 0.6 },
    ] as DesignCanvasState['items'],
  }));
  assert.ok(plan, 'an orchard has no subject to prefer — everything frames it');
  assert.equal(plan.bedCount, 0);
  assert.equal(plan.shapes.length, 2);
});
