import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCanvasFrame,
  distM,
  getBounds,
  makeMercatorProjector,
  makeMercatorUnprojector,
  migrateStateToFrame,
  normaliseRotation,
  normalizeZoneNumbers,
  pointInRing,
  projectorForFrame,
  ringAreaOf,
  type DesignCanvasState,
} from '../lib/design-canvas.ts';

function stateFixture(): DesignCanvasState {
  return {
    siteId: 'farm',
    frame: {
      centerLng: 31.96,
      centerLat: -27.72,
      zoom: 16,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.8,
    },
    items: [{ id: 'item', defId: 'bed', x: 0.2, y: 0.3, rot: 45, label: 'Keep me' }],
    zones: [{
      id: 'zone',
      zone: 2,
      points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4]],
      feature: 'veg_garden',
      measuredSlopePct: 7,
    }],
    lines: [{ id: 'line', kind: 'pipe', points: [[0.2, 0.2], [0.8, 0.8]], name: 'Main' }],
    step: 'planting',
    updatedAt: '2026-07-29T00:00:00.000Z',
    rev: 4,
    localWind: { prevailingFrom: 'SW', recordedAt: '2026-07-29T00:00:00.000Z' },
    dailyWaterUseL: 90,
  };
}

// normaliseRotation is the single source of truth for PlacedItem.rot's on-disk convention
// (rounded integer degrees, wrapped into [0,360), 0 stored as undefined) shared by the
// drag-rotate handle (DesignCanvas.tsx endDragRotate) and the Angle number field
// (DesignPalette.tsx + app/design/page.tsx onRotateSelected) — see handoff §5 "Angle field for
// linear/rectangular elements". These cases lock in that contract so the two commit paths can
// never silently drift apart on rounding/wrapping.
test('normaliseRotation: 0 stores as undefined (footprint natural orientation)', () => {
  assert.equal(normaliseRotation(0), undefined);
});

test('normaliseRotation: 360 wraps to 0, which also stores as undefined', () => {
  assert.equal(normaliseRotation(360), undefined);
});

test('normaliseRotation: 361 wraps to 1', () => {
  assert.equal(normaliseRotation(361), 1);
});

test('normaliseRotation: -5 wraps to 355', () => {
  assert.equal(normaliseRotation(-5), 355);
});

test('normaliseRotation: 359.6 rounds to 360, which wraps to 0 and stores as undefined', () => {
  assert.equal(normaliseRotation(359.6), undefined);
});

test('normaliseRotation: 45.4 rounds to 45', () => {
  assert.equal(normaliseRotation(45.4), 45);
});

test('Mercator projection and unprojection are algebraic inverses across the site frame', () => {
  const frame = {
    centerLng: 31.96,
    centerLat: -27.72,
    zoom: 16.4,
    imgW: 1234,
    imgH: 777,
    mPerPx: 0.5,
  };
  const projectPx = makeMercatorProjector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
    0,
    0,
  );
  const unproject = makeMercatorUnprojector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
  );
  const projectNorm = projectorForFrame(frame);

  const positions: Array<[number, number]> = [
    [31.959, -27.721],
    [31.96, -27.72],
    [31.962, -27.718],
  ];
  for (const lngLat of positions) {
    const [px, py] = projectPx(lngLat);
    const norm = projectNorm(lngLat);
    const roundTrip = unproject(norm);
    assert.ok(Math.abs(norm[0] - px / frame.imgW) < 1e-12);
    assert.ok(Math.abs(norm[1] - py / frame.imgH) < 1e-12);
    assert.ok(Math.abs(roundTrip[0] - lngLat[0]) < 1e-9);
    assert.ok(Math.abs(roundTrip[1] - lngLat[1]) < 1e-9);
  }
});

test('an untraced site frame stays centred on the real site and derives one uniform ground scale', () => {
  const lat = -27.72623;
  const lon = 31.96304;
  const { frame, project } = computeCanvasFrame([], lat, lon, { imgW: 1400, imgH: 500 });
  const centre = project([lon, lat]);
  const north = project([lon, lat + 0.001]);
  const northPixelDistance = Math.abs(north[1] - centre[1]) * frame.imgH;

  assert.deepEqual([frame.imgW, frame.imgH], [1400, 500]);
  assert.ok(Math.abs(centre[0] - 0.5) < 1e-9);
  assert.ok(Math.abs(centre[1] - 0.5) < 1e-9);
  assert.ok(Number.isFinite(frame.mPerPx) && frame.mPerPx > 0);
  assert.ok(Math.abs(northPixelDistance * frame.mPerPx - 111.32) < 1e-6);
});

test('frame migration is a cheap identity for the same frame and a non-mutating remap otherwise', () => {
  const saved = stateFixture();
  const before = structuredClone(saved);
  const same = migrateStateToFrame(saved, { ...saved.frame }, () => {
    throw new Error('same-frame migration must not project');
  });
  const nextFrame = { ...saved.frame, centerLng: saved.frame.centerLng + 0.01 };
  const migrated = migrateStateToFrame(saved, nextFrame, () => [1.2, -0.3]);

  assert.equal(same, saved);
  assert.notEqual(migrated, saved);
  assert.deepEqual([migrated.items[0].x, migrated.items[0].y], [1, 0]);
  assert.ok(migrated.zones[0].points.every(([x, y]) => x === 1 && y === 0));
  assert.ok(migrated.lines[0].points.every(([x, y]) => x === 1 && y === 0));
  assert.equal(migrated.items[0].label, 'Keep me');
  assert.equal(migrated.zones[0].measuredSlopePct, 7);
  assert.equal(migrated.lines[0].name, 'Main');
  assert.deepEqual(migrated.localWind, saved.localWind);
  assert.equal(migrated.dailyWaterUseL, saved.dailyWaterUseL);
  assert.deepEqual(saved, before);
});

test('legacy zone numbers normalise once, stay bounded, and preserve an already-clean state by identity', () => {
  const clean = stateFixture();
  assert.equal(normalizeZoneNumbers(clean), clean);

  const legacy = {
    ...clean,
    zones: [
      { ...clean.zones[0], id: 'string', zone: '2' },
      { ...clean.zones[0], id: 'high', zone: 99 },
      { ...clean.zones[0], id: 'low', zone: -4 },
      { ...clean.zones[0], id: 'bad', zone: 'unknown' },
    ],
  } as unknown as DesignCanvasState;
  const original = structuredClone(legacy);
  const normalised = normalizeZoneNumbers(legacy);

  assert.deepEqual(normalised.zones.map((zone) => zone.zone), [2, 5, 0, 0]);
  assert.deepEqual(legacy, original);
});

test('geometry helpers respect nested GeoJSON, winding, concavity, and non-square metre scale', () => {
  const bounds = getBounds([{
    id: 'mixed',
    name: 'Mixed',
    color: '#000',
    geometry: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [31, -28] },
        { type: 'LineString', coordinates: [[33, -27], [32, -30]] },
      ],
    },
  }] as never);
  const clockwise = [[0, 0], [0, 2], [2, 2], [2, 0]] as Array<[number, number]>;
  const counterClockwise = [...clockwise].reverse();
  const concave = [[0, 0], [2, 0], [2, 2], [1, 1], [0, 2]] as Array<[number, number]>;
  const frame = { imgW: 1200, imgH: 400, mPerPx: 0.25 };

  assert.deepEqual(bounds, { minX: 31, maxX: 33, minY: -30, maxY: -27 });
  assert.equal(ringAreaOf(clockwise), ringAreaOf(counterClockwise));
  assert.equal(pointInRing([0.5, 1.5], concave), true);
  assert.equal(pointInRing([1, 1.75], concave), false);
  assert.equal(distM([0, 0], [1, 1], frame), Math.hypot(frame.imgW, frame.imgH) * frame.mPerPx);
  assert.equal(distM([1, 1], [0, 0], frame), distM([0, 0], [1, 1], frame));
});
