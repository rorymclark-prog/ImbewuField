import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCanvasState, LineShape, PlacedItem } from '@/lib/design-canvas';
import { buildPhasePlan, type PhasingRefLayers } from '@/lib/phasing';

const FRAME = {
  centerLng: 31.963,
  centerLat: -27.726,
  zoom: 18,
  imgW: 960,
  imgH: 640,
  mPerPx: 0.4,
};

function item(id: string, defId: string): PlacedItem {
  return { id, defId, x: 0.5, y: 0.5 };
}

function line(id: string, kind: LineShape['kind']): LineShape {
  return { id, kind, points: [[0.2, 0.2], [0.8, 0.8]] };
}

function state(items: PlacedItem[], lines: LineShape[] = []): DesignCanvasState {
  return {
    siteId: 'phasing-test',
    frame: FRAME,
    step: 'review',
    items,
    zones: [],
    lines,
    rev: 1,
    updatedAt: '2026-07-28T00:00:00.000Z',
  };
}

const NO_REFS: PhasingRefLayers = { boundary: [], house: [], driveway: [] };
const ALL_REFS: PhasingRefLayers = {
  boundary: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
  house: [[0.4, 0.3], [0.6, 0.3], [0.6, 0.5], [0.4, 0.5]],
  driveway: [[0.5, 0.1], [0.5, 0.35]],
};

function completeDesign(): DesignCanvasState {
  return state(
    [
      item('gate', 'gate'),
      item('tank', 'jojo_1000'),
      item('bank', 'berm'),
      item('bed', 'veg_bed'),
      item('tree', 'tree_citrus'),
      item('coop', 'chicken_coop'),
    ],
    [
      line('path', 'path'),
      line('pipe', 'pipe'),
      line('swale', 'swale'),
      line('drip', 'drip'),
      line('fence', 'fence'),
      line('windbreak', 'windbreak'),
    ],
  );
}

test('emitted hold points are lettered once, in order, even when middle phases are absent', () => {
  const designs = [
    state([item('bed', 'veg_bed')]),
    state([item('tank', 'jojo_1000'), item('tree', 'tree_citrus')]),
    completeDesign(),
  ];

  for (const design of designs) {
    const phases = buildPhasePlan(design, NO_REFS).phases;
    const letters = phases.map((phase) => phase.holdPoint.match(/^Hold Point ([A-Z]):/)?.[1]);
    const expected = phases.map((_, index) => String.fromCharCode(65 + index));
    assert.deepEqual(letters, expected);
    assert.equal(new Set(letters).size, phases.length, 'a hold-point letter is repeated');
  }
});

test('critical order is topological: no phase appears before work it depends on', () => {
  const order = buildPhasePlan(completeDesign(), ALL_REFS).criticalOrder;
  const rank = (entry: string): number => {
    if (/Survey & set out/.test(entry)) return 0;
    if (/Safe access|Main water line/.test(entry)) return 1;
    if (/Swales|Bank|Basins/.test(entry)) return 2;
    if (/Beds/.test(entry)) return 3;
    if (/Trees/.test(entry)) return 4;
    if (/Livestock/.test(entry)) return 5;
    if (/Commissioning/.test(entry)) return 6;
    assert.fail(`unclassified critical-order work: ${entry}`);
  };
  const ranks = order.map(rank);

  for (let index = 1; index < ranks.length; index++) {
    assert.ok(
      ranks[index] >= ranks[index - 1],
      `"${order[index]}" appears before its dependency "${order[index - 1]}"`,
    );
  }
});

test('driveway and house constraints exist only when those features were actually traced', () => {
  const design = state([item('bed', 'veg_bed')]);
  const absent = buildPhasePlan(design, NO_REFS).siteRules;
  assert.equal(absent.some((rule) => /driveway/i.test(rule)), false);
  assert.equal(absent.some((rule) => /house footings/i.test(rule)), false);

  const present = buildPhasePlan(design, ALL_REFS).siteRules;
  assert.equal(present.some((rule) => /driveway/i.test(rule)), true);
  assert.equal(present.some((rule) => /house footings/i.test(rule)), true);
});

test('week ranges move forward without leaving an unplanned gap between phases', () => {
  const phases = buildPhasePlan(completeDesign(), ALL_REFS).phases;
  for (let index = 0; index < phases.length; index++) {
    const current = phases[index];
    assert.ok(current.weekEnd > current.weekStart, `${current.key} has a zero or negative duration`);
    if (index === 0) continue;
    const previous = phases[index - 1];
    assert.ok(current.weekStart >= previous.weekStart, `${current.key} starts before ${previous.key}`);
    assert.ok(current.weekEnd >= previous.weekEnd, `${current.key} ends before ${previous.key}`);
    assert.ok(current.weekStart <= previous.weekEnd, `gap between ${previous.key} and ${current.key}`);
  }
});
