import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AREA_LINE_KINDS,
  DEFAULT_PX_PER_M,
  LAYERS,
  LAYER_ORDER,
  POLYGON_LINE_KINDS,
  buildGhosts,
  coachTip,
  geomMToPx,
  geomPxToM,
  layerForItem,
  layerForLine,
  normaliseFacilitatorState,
  type CoachCounts,
  type FacItem,
  type FacLine,
  type FacSector,
  type FacilitatorDesignState,
} from '../lib/facilitator-design.ts';

const baseCounts: CoachCounts = {
  hasBg: true,
  scaleSet: true,
  itemsByLayer: {},
  linesByLayer: {},
  sectors: 0,
  tanks: 0,
  totalLitres: 0,
  bedAreaM2: 0,
  paths: 0,
};

test('every palette entry resolves to the layer that offers it', () => {
  for (const layer of LAYER_ORDER) {
    for (const type of LAYERS[layer].elementTypes) {
      assert.equal(layerForItem(layer, type), layer);
      assert.equal(layerForItem('existing', type), 'existing');
    }
    for (const kind of LAYERS[layer].lineKinds) {
      assert.equal(layerForLine(layer, kind), layer);
      assert.equal(layerForLine('existing', kind), 'existing');
    }
  }
});

test('every area-priced line kind is a polygon and both BOQ builders use the shared authority', () => {
  assert.ok(AREA_LINE_KINDS.length > 0);
  for (const kind of AREA_LINE_KINDS) {
    assert.ok(POLYGON_LINE_KINDS.includes(kind), `${kind} must be closed before its area can be measured`);
  }

  for (const file of ['components/FacilitatorCanvas.tsx', 'app/facilitator/print/page.tsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /AREA_LINE_KINDS/);
    assert.match(source, /costForMeasuredAreaLine/);
    assert.doesNotMatch(source, /const\s+AREA_LINE_KINDS/);
  }
});

test('AI ghosts are finite, clipped to the image, and malformed detections are ignored', () => {
  const bg = { x: 10, y: 20, w: 200, h: 100 };
  const ghosts = buildGhosts({
    boundary: [[-0.2, 0], [1.2, 0], [1, 1.3]],
    features: [
      { kind: 'tree', points: [[0.5, 0.5]], sizeM: Number.NaN },
      { kind: 'driveway', points: [[0, 0.2], [1, 0.8]] },
      { kind: 'pond', points: [[Number.POSITIVE_INFINITY, 0.5]] },
      { kind: 'veg_area', points: [[0, 0], [0.4, 0], [Number.NaN, 0.4]] },
    ],
  }, bg);

  assert.deepEqual(ghosts.map((ghost) => ghost.kind), ['boundary', 'tree', 'driveway']);
  assert.equal(ghosts.find((ghost) => ghost.kind === 'tree')?.sizeM, undefined);
  for (const ghost of ghosts) {
    assert.ok(ghost.pxPoints.every(Number.isFinite));
    for (let i = 0; i < ghost.pxPoints.length; i += 2) {
      assert.ok(ghost.pxPoints[i] >= bg.x && ghost.pxPoints[i] <= bg.x + bg.w);
      assert.ok(ghost.pxPoints[i + 1] >= bg.y && ghost.pxPoints[i + 1] <= bg.y + bg.h);
    }
  }
});

test('metre geometry round-trips across a differently sized canvas without mutating saved geometry', () => {
  const items: FacItem[] = [{ id: 'tank', type: 'tank', x: 110, y: 70, wM: 2, hM: 2, rotation: 0 }];
  const lines: FacLine[] = [{ id: 'path', kind: 'path', points: [10, 20, 110, 70] }];
  const sectors: FacSector[] = [{
    id: 'sun', kind: 'sun_winter', x: 60, y: 45, rotation: 20, radiusM: 30, spanDeg: 60,
  }];
  const originals = structuredClone({ items, lines, sectors });

  const metres = geomPxToM(items, lines, sectors, { x: 10, y: 20, w: 300, h: 200 }, 5);
  const pixels = geomMToPx(
    metres.items,
    metres.lines,
    metres.sectors,
    { x: 30, y: 40, w: 600, h: 400 },
    10,
  );

  assert.deepEqual({ items, lines, sectors }, originals);
  assert.deepEqual([metres.items[0].xM, metres.items[0].yM], [20, 10]);
  assert.deepEqual(pixels.items.map(({ x, y }) => [x, y]), [[230, 140]]);
  assert.deepEqual(pixels.lines[0].points, [30, 40, 230, 140]);
  assert.deepEqual([pixels.sectors[0].x, pixels.sectors[0].y], [130, 90]);
});

test('invalid transforms never manufacture non-finite persisted coordinates', () => {
  const item: FacItem = { id: 'tank', type: 'tank', x: 10, y: 20, wM: 2, hM: 2, rotation: 0 };
  const line: FacLine = { id: 'path', kind: 'path', points: [10, 20, 30, 40] };
  const sector: FacSector = {
    id: 'wind', kind: 'wind', x: 10, y: 20, rotation: 0, radiusM: 20, spanDeg: 45,
  };

  for (const pxPerM of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const output = geomPxToM([item], [line], [sector], { x: 0, y: 0, w: 100, h: 100 }, pxPerM);
    assert.equal(output.items[0].xM, undefined);
    assert.equal(output.lines[0].pointsM, undefined);
    assert.equal(output.sectors[0].xM, undefined);
    assert.doesNotMatch(JSON.stringify(output), /NaN|Infinity/);
  }
});

test('storage normalisation keeps valid geometry and quarantines corrupt BOQ inputs', () => {
  const validItem: FacItem = {
    id: 'tank',
    type: 'tank',
    x: 10,
    y: 20,
    wM: 2,
    hM: 2,
    rotation: 0,
    litres: Number.POSITIVE_INFINITY,
    count: Number.NaN,
  };
  const source = {
    version: 1,
    geomVersion: 99,
    items: [
      validItem,
      { ...validItem, id: 'free-area', wM: 0 },
      { ...validItem, id: 'nan-area', hM: Number.NaN },
    ],
    lines: [
      { id: 'drive', kind: 'driveway', points: [0, 0, 10, 0, 10, 10], closed: true },
      { id: 'bad-metres', kind: 'fence', points: [0, 0, 10, 0], pointsM: 'not-points' },
      { id: 'bad-line', kind: 'patio', points: [0, 0, Number.POSITIVE_INFINITY, 2], closed: true },
    ],
    sectors: [],
    pxPerM: 0,
    activeLayer: 'not-a-layer',
    hiddenLayers: ['water', 'water', 'not-a-layer'],
    bgRect: { x: 0, y: 0, w: Number.POSITIVE_INFINITY, h: 10 },
    bgOpacity: 2,
    bgSite: { lat: 91, lon: 20, name: 'Outside the globe' },
    dismissedMapshapeIds: ['', 'mapshape-one', 'mapshape-one', 4],
    savedAt: Number.NaN,
  };

  const normalised = normaliseFacilitatorState(source);
  assert.ok(normalised);
  assert.deepEqual(normalised.items.map((item) => item.id), ['tank']);
  assert.deepEqual(normalised.lines.map((line) => line.id), ['drive', 'bad-metres']);
  assert.equal(normalised.lines[1].pointsM, undefined);
  assert.equal(normalised.pxPerM, DEFAULT_PX_PER_M);
  assert.equal(normalised.activeLayer, 'base');
  assert.deepEqual(normalised.hiddenLayers, ['water']);
  assert.equal(normalised.bgRect, undefined);
  assert.equal(normalised.bgOpacity, undefined);
  assert.equal(normalised.bgSite, undefined);
  assert.equal(normalised.geomVersion, undefined);
  assert.equal(normalised.items[0].litres, undefined);
  assert.equal(normalised.items[0].count, undefined);
  assert.deepEqual(normalised.dismissedMapshapeIds, ['mapshape-one']);
  assert.equal(normalised.savedAt, 0);
  assert.doesNotMatch(JSON.stringify(normalised), /NaN|Infinity/);
  assert.equal(source.items.length, 3);
  assert.equal(source.lines.length, 3);
});

test('feature ids form one non-empty namespace across items, lines and sectors', () => {
  const state = normaliseFacilitatorState({
    version: 1,
    items: [
      { id: 'shared', type: 'tank', x: 1, y: 2, wM: 2, hM: 2, rotation: 0 },
      { id: 'shared', type: 'bed', x: 3, y: 4, wM: 2, hM: 4, rotation: 0 },
      { id: '  ', type: 'tree', x: 3, y: 4, wM: 2, hM: 2, rotation: 0 },
    ],
    lines: [
      { id: 'shared', kind: 'path', points: [0, 0, 10, 10] },
      { id: 'line', kind: 'path', points: [0, 0, 10, 10] },
      { id: '', kind: 'path', points: [0, 0, 10, 10] },
    ],
    sectors: [
      { id: 'line', kind: 'wind', x: 1, y: 2, rotation: 0, radiusM: 10, spanDeg: 45 },
      { id: 'sector', kind: 'wind', x: 1, y: 2, rotation: 0, radiusM: 10, spanDeg: 45 },
    ],
    pxPerM: 5,
    activeLayer: 'base',
    hiddenLayers: [],
    savedAt: 1,
  });

  assert.ok(state);
  const ids = [
    ...state.items.map((item) => item.id),
    ...state.lines.map((line) => line.id),
    ...state.sectors.map((sector) => sector.id),
  ];
  assert.deepEqual(ids, ['shared', 'line', 'sector']);
  assert.equal(new Set(ids).size, ids.length);
});

test('metre-only v2 geometry survives while unusable lines are quarantined', () => {
  const state = normaliseFacilitatorState({
    version: 1,
    geomVersion: 2,
    items: [],
    lines: [
      { id: 'metre-path', kind: 'path', points: [], pointsM: [2, 3, 8, 9] },
      { id: 'metre-patio', kind: 'patio', points: [], pointsM: [0, 0, 5, 0, 5, 5] },
      { id: 'one-point', kind: 'path', points: [1, 2] },
      { id: 'two-corner-patio', kind: 'patio', points: [0, 0, 4, 4] },
    ],
    sectors: [],
    pxPerM: 5,
    activeLayer: 'base',
    hiddenLayers: [],
    savedAt: 1,
  });

  assert.ok(state);
  assert.deepEqual(state.lines.map((line) => line.id), ['metre-path', 'metre-patio']);
  assert.deepEqual(state.lines[0].points, []);
  assert.deepEqual(state.lines[0].pointsM, [2, 3, 8, 9]);
});

test('coach guidance never prints invalid arithmetic', () => {
  const invalids = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1];
  for (const value of invalids) {
    const counts: CoachCounts = {
      ...baseCounts,
      itemsByLayer: { existing: value, structures: value },
      linesByLayer: { existing: value, structures: value },
      sectors: value,
      tanks: value,
      totalLitres: value,
      bedAreaM2: value,
      paths: value,
    };
    for (const layer of LAYER_ORDER) {
      assert.doesNotMatch(coachTip(layer, counts), /NaN|Infinity|-\d/);
    }
  }
});

test('well-formed storage state survives normalisation as a detached copy', () => {
  const state: FacilitatorDesignState = {
    version: 1,
    geomVersion: 2,
    items: [{ id: 'bed', type: 'bed', x: 5, y: 6, wM: 1, hM: 8, rotation: 0 }],
    lines: [{ id: 'fence', kind: 'fence', points: [0, 0, 10, 0] }],
    sectors: [],
    pxPerM: 5,
    activeLayer: 'planting',
    hiddenLayers: ['water'],
    washOn: true,
    designId: 'design-one',
    title: 'Farm plan',
    bgSite: { lat: -29.86, lon: 31.02, name: 'Durban' },
    bgDataUrl: 'data:image/jpeg;base64,a',
    bgRect: { x: 1, y: 2, w: 300, h: 200 },
    bgOpacity: 0.75,
    dismissedMapshapeIds: ['mapshape-one'],
    savedAt: 123,
  };
  const normalised = normaliseFacilitatorState(state);
  assert.deepEqual(normalised, state);
  assert.notEqual(normalised, state);
  assert.notEqual(normalised?.items, state.items);
  assert.notEqual(normalised?.lines[0].points, state.lines[0].points);
});
