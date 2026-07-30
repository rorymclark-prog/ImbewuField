import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCanvasState, LineShape, PlacedItem } from '@/lib/design-canvas';
import { BIOMES } from '@/lib/biome';
import { buildDemoDesignCanvasState } from '@/lib/demo-farm';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  buildPhasePinPositions,
  buildPhasePlan,
  layoutPhasePinPositions,
  type PhaseKey,
  type PhasingRefLayers,
} from '@/lib/phasing';

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

test('malformed or zero-length geometry cannot manufacture implementation work', () => {
  const malformed = state(
    [
      { ...item('nan-item', 'jojo_1000'), x: Number.NaN },
      { ...item('outside-item', 'tree_citrus'), y: 2 },
    ],
    [
      { id: 'same-point', kind: 'pipe', points: [[0.5, 0.5], [0.5, 0.5]] },
      { id: 'nan-line', kind: 'swale', points: [[0.2, 0.2], [Number.NaN, 0.8]] },
      { id: 'outside-line', kind: 'drip', points: [[0.2, 0.2], [1.2, 0.8]] },
    ],
  );
  const before = structuredClone(malformed);

  assert.deepEqual(
    buildPhasePlan(malformed, ALL_REFS),
    { phases: [], criticalOrder: [], siteRules: [] },
  );
  assert.deepEqual(malformed, before, 'phasing validation must not rewrite saved geometry');
});

test('one malformed object does not erase valid buildable work', () => {
  const design = state(
    [
      item('tank', 'jojo_1000'),
      { ...item('bad-tree', 'tree_citrus'), x: Number.POSITIVE_INFINITY },
    ],
    [
      line('pipe', 'pipe'),
      { id: 'bad-swale', kind: 'swale', points: [[0.4, 0.4], [0.4, 0.4]] },
    ],
  );
  const ownedIds = buildPhasePlan(design, NO_REFS).phases.flatMap((phase) => phase.itemIds);

  assert.deepEqual(ownedIds.sort(), ['pipe', 'tank']);
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

const pinPhase = (key: PhaseKey, itemIds: string[]) => ({ key, itemIds });

test('implementation pins mark separated work clusters instead of one empty global centroid', () => {
  const design = state(
    [{ ...item('tank', 'jojo_1000'), x: 0.14, y: 0.18 }],
    [
      { id: 'main', kind: 'pipe', points: [[0.70, 0.68], [0.76, 0.68]] },
      { id: 'greywater', kind: 'greywater', points: [[0.72, 0.72], [0.78, 0.72]] },
    ],
  );

  const pins = buildPhasePinPositions(
    pinPhase('access_water', ['greywater', 'tank', 'main']),
    design,
    NO_REFS,
    1.5,
  );

  assert.equal(pins.length, 2);
  assert.deepEqual(
    pins.map((pin) => [...pin.itemIds].sort()),
    [['tank'], ['greywater', 'main']],
  );

  // A pin must sit on one of the work representatives, not midway through unrelated empty ground.
  const workRepresentatives = [[0.14, 0.18], [0.73, 0.68], [0.75, 0.72]];
  assert.ok(
    pins.every((pin) => workRepresentatives.some(([x, y]) => pin.x === x && pin.y === y)),
  );
  assert.equal(
    pins.some((pin) => Math.abs(pin.x - 0.52) < 0.04 && Math.abs(pin.y - 0.53) < 0.04),
    false,
    'the old all-work centroid floats between the tank and routes',
  );
});

test('nearby bed rows share a pin while spatially separate infrastructure gets its own', () => {
  const design = state([
    { ...item('bed-a', 'veg_bed'), x: 0.24, y: 0.26 },
    { ...item('bed-b', 'veg_bed'), x: 0.29, y: 0.26 },
    { ...item('bed-c', 'veg_bed'), x: 0.24, y: 0.33 },
    { ...item('compost', 'compost_bay'), x: 0.76, y: 0.72 },
  ]);

  const pins = buildPhasePinPositions(
    pinPhase('beds', ['bed-c', 'compost', 'bed-a', 'bed-b']),
    design,
    NO_REFS,
    1.5,
  );

  assert.equal(pins.length, 2);
  assert.deepEqual(
    pins.map((pin) => [...pin.itemIds].sort()),
    [['bed-a', 'bed-b', 'bed-c'], ['compost']],
  );
});

test('a connected two-row bed block stays one work area without swallowing remote infrastructure', () => {
  const design = state([
    { ...item('bed-a', 'veg_bed'), x: 0.20, y: 0.50 },
    { ...item('bed-b', 'veg_bed'), x: 0.25, y: 0.50 },
    { ...item('bed-c', 'veg_bed'), x: 0.30, y: 0.50 },
    { ...item('bed-d', 'veg_bed'), x: 0.20, y: 0.65 },
    { ...item('bed-e', 'veg_bed'), x: 0.25, y: 0.65 },
    { ...item('bed-f', 'veg_bed'), x: 0.30, y: 0.65 },
    { ...item('compost', 'compost_bay'), x: 0.50, y: 0.20 },
  ]);
  const bedIds = ['bed-a', 'bed-b', 'bed-c', 'bed-d', 'bed-e', 'bed-f'];

  const pins = buildPhasePinPositions(
    pinPhase('beds', ['compost', ...bedIds]),
    design,
    NO_REFS,
    1.53,
  );

  assert.equal(pins.length, 2);
  assert.deepEqual(
    pins.map((pin) => pin.itemIds),
    [[...bedIds].sort(), ['compost']],
  );
});

test('pin clustering measures rendered distance with the map aspect ratio', () => {
  const design = state([
    { ...item('left', 'veg_bed'), x: 0.40, y: 0.40 },
    { ...item('right', 'veg_bed'), x: 0.52, y: 0.40 },
  ]);
  const phase = pinPhase('beds', ['left', 'right']);

  assert.equal(buildPhasePinPositions(phase, design, NO_REFS, 1).length, 1);
  assert.equal(buildPhasePinPositions(phase, design, NO_REFS, 2).length, 2);
});

test('pin layout is insertion-order independent, malformed-safe and leaves state untouched', () => {
  const malformed = { ...item('bad', 'veg_bed'), x: Number.NaN };
  const design = state(
    [
      { ...item('near-b', 'veg_bed'), x: 0.32, y: 0.28 },
      malformed,
      { ...item('far', 'compost_bay'), x: 0.82, y: 0.76 },
      { ...item('near-a', 'veg_bed'), x: 0.26, y: 0.28 },
    ],
    [{ id: 'bad-line', kind: 'drip', points: [[0.3, 0.3], [Number.NaN, 0.4]] }],
  );
  const reversed: DesignCanvasState = {
    ...structuredClone(design),
    items: [...design.items].reverse(),
    lines: [...design.lines].reverse(),
  };
  const before = structuredClone(design);
  const ids = ['bad-line', 'far', 'near-a', 'bad', 'near-b'];

  const first = buildPhasePinPositions(pinPhase('beds', ids), design, NO_REFS, 1.5);
  const second = buildPhasePinPositions(pinPhase('beds', [...ids].reverse()), reversed, NO_REFS, 1.5);

  assert.deepEqual(second, first);
  assert.deepEqual(design, before);
  assert.deepEqual(first.flatMap((pin) => pin.itemIds).sort(), ['far', 'near-a', 'near-b']);
});

test('bookend pins use traced gate and house anchors with distinct honest fallbacks', () => {
  const refs: PhasingRefLayers = {
    boundary: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
    driveway: [[0.2, 0.12], [0.4, 0.3]],
    house: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]],
  };
  const design = state([item('bed', 'veg_bed')]);

  assert.deepEqual(
    buildPhasePinPositions(pinPhase('setout', []), design, refs, 1.5),
    [{ x: 0.2, y: 0.12, itemIds: [] }],
  );
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', []), design, refs, 1.5),
    [{ x: 0.5, y: 0.5, itemIds: [] }],
  );
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('setout', []), design, NO_REFS, 1.5),
    [{ x: 0.4, y: 0.4, itemIds: [] }],
  );
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', []), design, NO_REFS, 1.5),
    [{ x: 0.6, y: 0.6, itemIds: [] }],
  );
});

test('demo implementation pins repeat phase numbers at its genuinely separate work areas', () => {
  const design = buildDemoDesignCanvasState();
  const plan = buildPhasePlan(design, NO_REFS);
  const pins = Object.fromEntries(
    plan.phases.map((phase) => [
      phase.key,
      buildPhasePinPositions(phase, design, NO_REFS, 1.53),
    ]),
  );

  assert.equal(pins.access_water.length, 2, 'tank and route work are separate');
  assert.deepEqual(
    pins.access_water.map((pin) => pin.itemIds),
    [['demo-di-tank'], ['demo-dl-greywater', 'demo-dl-path']],
  );
  assert.equal(pins.beds.length, 2, 'the bed block stays together and compost remains separate');
  assert.equal(pins.perennials.length, 3, 'the orchard row gets repeated, readable phase markers');

  for (const phase of plan.phases) {
    assert.deepEqual(
      pins[phase.key].flatMap((pin) => pin.itemIds).sort(),
      [...phase.itemIds].sort(),
      `${phase.key} work is represented exactly once`,
    );
  }
});

test('route pins use arc-length midpoints and do not drift when a straight route is resampled', () => {
  const sparse = state([], [{ id: 'route', kind: 'pipe', points: [[0.1, 0.5], [0.9, 0.5]] }]);
  const dense = state([], [{
    id: 'route',
    kind: 'pipe',
    points: [[0.1, 0.5], [0.2, 0.5], [0.3, 0.5], [0.9, 0.5]],
  }]);
  const phase = pinPhase('access_water', ['route']);

  assert.deepEqual(buildPhasePinPositions(phase, sparse, NO_REFS, 1.5), [
    { x: 0.5, y: 0.5, itemIds: ['route'] },
  ]);
  assert.deepEqual(buildPhasePinPositions(phase, dense, NO_REFS, 1.5), [
    { x: 0.5, y: 0.5, itemIds: ['route'] },
  ]);
});

test('presentation-cropped routes retain a pin on their visible clipped geometry', () => {
  // boundaryPresentationContext can produce exactly these coordinates when a raw route crosses a
  // compact traced boundary: the canvas still draws the middle and clips both off-frame ends.
  const crossing = state([], [{
    id: 'crossing',
    kind: 'path',
    points: [[-0.7097, 0.5], [1.7097, 0.5]],
  }]);
  const outside = state([], [{
    id: 'outside',
    kind: 'path',
    points: [[-0.8, 0.4], [-0.2, 0.6]],
  }]);

  assert.deepEqual(
    buildPhasePinPositions(pinPhase('access_water', ['crossing']), crossing, NO_REFS, 1.5),
    [{ x: 0.5, y: 0.5, itemIds: ['crossing'] }],
  );
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('access_water', ['outside']), outside, NO_REFS, 1.5),
    [],
    'a route with no visible segment must not invent an in-frame pin',
  );
});

test('badge layout offsets pins from exact work and prevents cross-phase erasure', () => {
  const anchors = [
    {
      x: 0.5,
      y: 0.5,
      phaseKey: 'earthworks' as const,
      phaseNumber: 3,
      itemIds: ['swale'],
    },
    {
      x: 0.5,
      y: 0.5,
      phaseKey: 'perennials' as const,
      phaseNumber: 5,
      itemIds: ['tree'],
    },
    {
      x: 0.02,
      y: 0.02,
      phaseKey: 'access_water' as const,
      phaseNumber: 2,
      itemIds: ['tank'],
    },
  ];
  const aspect = 1.5;
  const radius = 0.025;
  const first = layoutPhasePinPositions(anchors, aspect, radius);
  const reversed = layoutPhasePinPositions([...anchors].reverse(), aspect, radius);
  const renderedDistance = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

  assert.deepEqual(reversed, first, 'layout must not depend on phase traversal order');
  assert.equal(first.length, 3);
  for (const pin of first) {
    assert.ok(
      renderedDistance(pin, { x: pin.anchorX, y: pin.anchorY }) >= radius * 1.55,
      `${pin.phaseKey} badge still obscures its own exact anchor`,
    );
    assert.ok(pin.x >= radius / aspect && pin.x <= 1 - radius / aspect);
    assert.ok(pin.y >= radius && pin.y <= 1 - radius);
  }
  for (let left = 0; left < first.length; left++) {
    for (let right = left + 1; right < first.length; right++) {
      assert.ok(
        renderedDistance(first[left], first[right]) >= radius * 2.2,
        `${first[left].phaseKey} and ${first[right].phaseKey} badges overlap`,
      );
    }
  }
});

test('all six phases can share a map corner without clamped badges overlapping', () => {
  const keys: PhaseKey[] = [
    'setout',
    'access_water',
    'earthworks',
    'beds',
    'perennials',
    'livestock',
  ];
  const aspect = 1.5;
  const radius = 0.025;
  const pins = layoutPhasePinPositions(
    keys.map((phaseKey, index) => ({
      x: 0,
      y: 0,
      phaseKey,
      phaseNumber: index + 1,
      itemIds: [`work-${index + 1}`],
    })),
    aspect,
    radius,
  );

  assert.equal(pins.length, keys.length);
  for (let left = 0; left < pins.length; left++) {
    for (let right = left + 1; right < pins.length; right++) {
      const separation = Math.hypot(
        (pins[left].x - pins[right].x) * aspect,
        pins[left].y - pins[right].y,
      );
      assert.ok(
        separation >= radius * 2.2,
        `${pins[left].phaseKey} and ${pins[right].phaseKey} overlap at the clipped corner`,
      );
    }
  }
});

test('closed rings do not bias bookend anchors and malformed reference traces cannot stack them', () => {
  const design = state([item('bed', 'veg_bed')]);
  const openHouse: PhasingRefLayers = {
    boundary: [],
    driveway: [],
    house: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]],
  };
  const closedHouse: PhasingRefLayers = {
    ...openHouse,
    house: [...openHouse.house, openHouse.house[0]],
  };

  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', []), design, closedHouse, 1.5),
    buildPhasePinPositions(pinPhase('livestock', []), design, openHouse, 1.5),
  );

  const malformed: PhasingRefLayers = {
    boundary: [[0.2, 0.2], [Number.NaN, 0.4], [0.2, 0.8]],
    house: [[0.2, 0.2], [Number.NaN, 0.4], [0.2, 0.8]],
    driveway: [[0.2, 0.2], [Number.NaN, 0.4]],
  };
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('setout', []), design, malformed, 1.5),
    [{ x: 0.4, y: 0.4, itemIds: [] }],
  );
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', []), design, malformed, 1.5),
    [{ x: 0.6, y: 0.6, itemIds: [] }],
  );
});

test('ambiguous duplicate object ids are omitted instead of changing pins with array order', () => {
  const first = state([
    { ...item('duplicate', 'veg_bed'), x: 0.2, y: 0.2 },
    { ...item('duplicate', 'compost_bay'), x: 0.8, y: 0.8 },
  ]);
  const reversed: DesignCanvasState = { ...first, items: [...first.items].reverse() };
  const phase = pinPhase('beds', ['duplicate']);

  assert.deepEqual(buildPhasePinPositions(phase, first, NO_REFS, 1.5), []);
  assert.deepEqual(buildPhasePinPositions(phase, reversed, NO_REFS, 1.5), []);
  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', ['duplicate']), first, ALL_REFS, 1.5),
    [],
    'an unresolved livestock object must not be disguised as a commissioning pin at the house',
  );
});

test('real livestock work is pinned to that work instead of the house bookend fallback', () => {
  const design = state([{ ...item('coop', 'chicken_coop'), x: 0.18, y: 0.78 }]);

  assert.deepEqual(
    buildPhasePinPositions(pinPhase('livestock', ['coop']), design, ALL_REFS, 1.5),
    [{ x: 0.18, y: 0.78, itemIds: ['coop'] }],
  );
});

test('dense perennial phases stay interactive instead of doing cubic cluster work', () => {
  const items = Array.from({ length: 300 }, (_, index) => ({
    ...item(`tree-${String(index).padStart(3, '0')}`, 'tree_citrus'),
    x: 0.45 + (index % 20) * 0.0005,
    y: 0.45 + Math.floor(index / 20) * 0.0005,
  }));
  const design = state(items);
  const startedAt = Date.now();

  const pins = buildPhasePinPositions(
    pinPhase('perennials', items.map(({ id }) => id)),
    design,
    NO_REFS,
    1.5,
  );
  const elapsedMs = Date.now() - startedAt;

  assert.equal(pins.length, 1);
  assert.ok(elapsedMs < 1_000, `300 compact objects took ${elapsedMs} ms to cluster`);
});
