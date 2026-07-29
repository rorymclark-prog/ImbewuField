import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCanvasState, LineShape, PlacedItem } from '@/lib/design-canvas';
import { BIOMES } from '@/lib/biome';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
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

test('an empty or half-drawn design produces no invented implementation plan', () => {
  const empty = state([]);
  const halfDrawn = state([], [{ id: 'half', kind: 'pipe', points: [[0.5, 0.5]] }]);

  assert.deepEqual(buildPhasePlan(empty, ALL_REFS), { phases: [], criticalOrder: [], siteRules: [] });
  assert.deepEqual(buildPhasePlan(halfDrawn, ALL_REFS), { phases: [], criticalOrder: [], siteRules: [] });
});

test('every catalog element and every buildable line is assigned to exactly one phase', () => {
  const items = Object.keys(ELEMENTS_BY_ID).map((defId, index) => ({
    ...item(`item-${index}`, defId),
  }));
  const lineKinds: LineShape['kind'][] = ['path', 'pipe', 'greywater', 'swale', 'drip', 'fence', 'windbreak'];
  const lines = lineKinds.map((kind, index) => line(`line-${index}`, kind));
  const plan = buildPhasePlan(state(items, lines), ALL_REFS);
  const assigned = plan.phases.flatMap((phase) => phase.itemIds);
  const expected = [...items.map((entry) => entry.id), ...lines.map((entry) => entry.id)].sort();

  assert.deepEqual([...assigned].sort(), expected);
  assert.equal(new Set(assigned).size, assigned.length);
});

test('phase output is independent of placement order and never mutates the saved design', () => {
  const design = completeDesign();
  const before = structuredClone(design);
  const reversed: DesignCanvasState = {
    ...structuredClone(design),
    items: [...design.items].reverse(),
    lines: [...design.lines].reverse(),
  };
  const first = buildPhasePlan(design, ALL_REFS, { biome: 'Savanna', rainfallMm: 650 });
  const second = buildPhasePlan(reversed, structuredClone(ALL_REFS), {
    biome: 'Savanna',
    rainfallMm: 650,
  });

  assert.deepEqual(second, first);
  assert.deepEqual(design, before);
});

test('phase ids, numbers, colours and item ownership stay unambiguous', () => {
  const phases = buildPhasePlan(completeDesign(), ALL_REFS).phases;

  assert.deepEqual(phases.map((phase) => phase.n), phases.map((_, index) => index + 1));
  assert.equal(new Set(phases.map((phase) => phase.key)).size, phases.length);
  assert.equal(new Set(phases.map((phase) => phase.colour)).size, phases.length);
  assert.equal(new Set(phases.flatMap((phase) => phase.itemIds)).size, phases.flatMap((phase) => phase.itemIds).length);
  assert.ok(phases.every((phase) => phase.tasks.length > 0));
  assert.ok(phases.every((phase) => phase.holdPoint.startsWith(`Hold Point ${String.fromCharCode(64 + phase.n)}:`)));
});

test('access/water titles name only the kinds of work actually present', () => {
  const accessOnly = buildPhasePlan(state([item('gate', 'gate')]), NO_REFS).phases
    .find((phase) => phase.key === 'access_water');
  const waterOnly = buildPhasePlan(state([item('tank', 'jojo_1000')]), NO_REFS).phases
    .find((phase) => phase.key === 'access_water');
  const both = buildPhasePlan(
    state([item('gate', 'gate'), item('tank', 'jojo_1000')]),
    NO_REFS,
  ).phases.find((phase) => phase.key === 'access_water');

  assert.equal(accessOnly?.title, 'Safe Access');
  assert.equal(waterOnly?.title, 'Water Spine');
  assert.equal(both?.title, 'Safe Access & Water Spine');
});

test('rain-window advice follows known biome seasonality and stays honest when biome is unknown', () => {
  const design = state([item('tree', 'tree_citrus')]);
  const summer = buildPhasePlan(design, NO_REFS, { biome: 'Savanna' }).phases
    .find((phase) => phase.key === 'perennials')?.tasks.join(' ');
  const winterBiome = Object.values(BIOMES)
    .find((biome) => biome.rainfallPattern === 'winter');
  assert.ok(winterBiome, 'biome catalogue must include a winter-rainfall region');
  const winter = buildPhasePlan(design, NO_REFS, { biome: winterBiome.name }).phases
    .find((phase) => phase.key === 'perennials')?.tasks.join(' ');
  const unknown = buildPhasePlan(design, NO_REFS, { biome: 'not a real biome' }).phases
    .find((phase) => phase.key === 'perennials')?.tasks.join(' ');

  assert.match(summer ?? '', /summer rains/);
  assert.match(winter ?? '', /winter rains/);
  assert.match(unknown ?? '', /reliable rains/);
  assert.doesNotMatch(unknown ?? '', /\b(?:Oct|Nov|Apr|May)\b/);
});

test('low-rainfall constraints never name planting or prerequisites absent from the design', () => {
  const accessOnly = buildPhasePlan(
    state([item('gate', 'gate')]),
    NO_REFS,
    { rainfallMm: 300 },
  ).siteRules.join(' ');

  assert.doesNotMatch(accessOnly, /water|planting|earthworks/i);
});

test('commissioning-only closeout never talks about animals that are not planned', () => {
  const closeout = buildPhasePlan(state([item('bed', 'veg_bed')]), NO_REFS).phases.at(-1);

  assert.equal(closeout?.key, 'livestock');
  assert.equal(closeout?.title, 'Commissioning & Handover');
  assert.equal(closeout?.itemIds.length, 0);
  assert.doesNotMatch(closeout?.tasks.join(' ') ?? '', /animal|stock|trough|hive/i);
  assert.match(closeout?.holdPoint ?? '', /as-built record/i);
});
