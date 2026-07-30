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
import { computeContourLines } from '../lib/contours.ts';

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

const CONTOUR_BOUNDARY: Array<[number, number]> = [
  [0.1, 0.2],
  [0.9, 0.2],
  [0.9, 0.8],
  [0.1, 0.8],
];

test('contours remain perpendicular to downhill in physical frame space', () => {
  const frames = [
    { imgW: 1200, imgH: 400 },
    { imgW: 400, imgH: 1200 },
  ];
  for (const frame of frames) {
    for (const aspectDeg of [0, 37, 90, 181, 270, 359]) {
      const result = computeContourLines(
        8,
        aspectDeg,
        CONTOUR_BOUNDARY,
        0.4,
        frame.imgW,
        frame.imgH,
      );
      assert.equal(result.status, 'ok');
      assert.ok(result.lines.length > 0);
      assert.ok(Number.isFinite(result.intervalM) && result.intervalM > 0);

      const downhill = [
        Math.sin(aspectDeg * Math.PI / 180),
        -Math.cos(aspectDeg * Math.PI / 180),
      ];
      for (const line of result.lines) {
        const lineVector = [
          (line.b[0] - line.a[0]) * frame.imgW,
          (line.b[1] - line.a[1]) * frame.imgH,
        ];
        const length = Math.hypot(lineVector[0], lineVector[1]);
        assert.ok(length > 0 && Number.isFinite(length));
        const dot = (lineVector[0] * downhill[0] + lineVector[1] * downhill[1]) / length;
        assert.ok(Math.abs(dot) < 1e-10);
        assert.ok(Number.isFinite(line.elevM));
      }
    }
  }
});

test('contour compass turns are periodic without mutating the boundary', () => {
  const before = structuredClone(CONTOUR_BOUNDARY);
  const west = computeContourLines(7, 270, CONTOUR_BOUNDARY, 0.5, 900, 600);
  const sameWest = computeContourLines(7, -90, CONTOUR_BOUNDARY, 0.5, 900, 600);
  assert.deepEqual(sameWest, west);
  assert.deepEqual(CONTOUR_BOUNDARY, before);
});

test('flat ground is distinct from unavailable contour evidence', () => {
  const flat = computeContourLines(0, 180, CONTOUR_BOUNDARY, 0.5, 900, 600);
  assert.equal(flat.status, 'too-flat');
  assert.equal(flat.tooFlat, true);
  assert.deepEqual(flat.lines, []);

  const invalidCalls: Array<() => ReturnType<typeof computeContourLines>> = [
    () => computeContourLines(Number.NaN, 180, CONTOUR_BOUNDARY, 0.5, 900, 600),
    () => computeContourLines(Number.POSITIVE_INFINITY, 180, CONTOUR_BOUNDARY, 0.5, 900, 600),
    () => computeContourLines(-1, 180, CONTOUR_BOUNDARY, 0.5, 900, 600),
    () => computeContourLines(90, 180, CONTOUR_BOUNDARY, 0.5, 900, 600),
    () => computeContourLines(7, Number.NaN, CONTOUR_BOUNDARY, 0.5, 900, 600),
    () => computeContourLines(7, 180, CONTOUR_BOUNDARY, 0, 900, 600),
    () => computeContourLines(7, 180, CONTOUR_BOUNDARY, 0.5, 0, 600),
    () => computeContourLines(7, 180, CONTOUR_BOUNDARY, 0.5, 900, Number.POSITIVE_INFINITY),
    () => computeContourLines(7, 180, [[0, 0], [0.5, 0.5], [1, 1]], 0.5, 900, 600),
    () => computeContourLines(7, 180, [[0, 0], [1.1, 0], [0, 1]], 0.5, 900, 600),
    () => computeContourLines(7, 180, [[0, 0], [1, 0], [Number.NaN, 1]], 0.5, 900, 600),
  ];
  for (const compute of invalidCalls) {
    const unavailable = compute();
    assert.equal(unavailable.status, 'unavailable');
    assert.equal(unavailable.tooFlat, false);
    assert.deepEqual(unavailable.lines, []);
    assert.equal(unavailable.intervalM, 0);
  }
});

import { fitZoom as fitZoomForFraming, zoneOfSelection } from '../lib/design-canvas.ts';

/** A site's bbox expressed in degrees around a South African latitude. */
const bboxAround = (widthM: number, heightM: number, lat = -27.726, lng = 31.963) => {
  const degLat = heightM / 111320;
  const degLng = widthM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { minX: lng - degLng / 2, maxX: lng + degLng / 2, minY: lat - degLat / 2, maxY: lat + degLat / 2 };
};

test('a small site is framed at the size it asked for, not left at a self-imposed ceiling', () => {
  // THE BUG: the ceiling was 19.5, nearly a zoom level below what Mapbox serves, so the Ubhejane
  // crèche (37.5m × 25.5m) filled 41.8% of its frame where padFrac asks for 76% — Rory: "its half
  // the size it should be too small!". Measured here the same way the renderer measures it.
  const IMG_W = 960, IMG_H = 640, PAD = 0.76;
  const site = bboxAround(37.5, 25.5);
  const { zoom } = fitZoomForFraming(site, IMG_W, IMG_H);
  assert.ok(zoom > 19.5, `needs more than the old ceiling, got ${zoom}`);

  // The design must now occupy close to padFrac of the frame in its limiting dimension.
  const world = 512 * Math.pow(2, zoom);
  const xOf = (lng: number) => ((lng + 180) / 360) * world;
  const spanPx = xOf(site.maxX) - xOf(site.minX);
  assert.ok(spanPx / IMG_W > 0.7, `design should fill ~${PAD} of the frame, filled ${(spanPx / IMG_W).toFixed(3)}`);
});

test('framing never asks for a zoom the Static Images API refuses', () => {
  // Verified against the live API while fixing this: 22 returns 200, 22.5 returns 422. A tiny
  // site must saturate at 22 rather than request an image that comes back as an error.
  const { zoom } = fitZoomForFraming(bboxAround(2, 2), 960, 640);
  assert.ok(zoom <= 22, `must not exceed the API ceiling, got ${zoom}`);
  // And a whole-country bbox must not fall through the bottom.
  const { zoom: wide } = fitZoomForFraming({ minX: 16, maxX: 33, minY: -35, maxY: -22 }, 960, 640);
  assert.ok(wide >= 1, `must stay in range, got ${wide}`);
});

// ── zoneOfSelection ───────────────────────────────────────────────────────────
// The Zones chip row used to light a chip only while the DRAW tool was armed, so selecting
// an existing Zone 4 ring left every chip dark — the row answered "what will I paint next?"
// when the farmer was asking "what am I holding?".

const zoneRing = (id: string, zone: unknown, feature?: string) =>
  ({ id, zone, points: [[0, 0], [1, 0], [1, 1]], ...(feature ? { feature } : {}) }) as unknown as Parameters<typeof zoneOfSelection>[0][number];

test('zoneOfSelection reports the zone of a single selected ring', () => {
  const zones = [zoneRing('a', 4), zoneRing('b', 1)];
  assert.equal(zoneOfSelection(zones, ['a']), 4);
  assert.equal(zoneOfSelection(zones, ['b']), 1);
});

test('zoneOfSelection lights one chip for a group that agrees, and none for a mixed group', () => {
  const zones = [zoneRing('a', 2), zoneRing('b', 2), zoneRing('c', 5)];
  assert.equal(zoneOfSelection(zones, ['a', 'b']), 2);
  assert.equal(zoneOfSelection(zones, ['a', 'c']), null); // no single truthful answer
});

test('zoneOfSelection ignores ground-feature rings, whose zone rides along as an inert value', () => {
  // A lawn or house footprint carries a `zone` that nobody chose (see ZoneShape). Reading it
  // would light a chip asserting a zone the farmer never set.
  const zones = [zoneRing('lawn', 3, 'lawn')];
  assert.equal(zoneOfSelection(zones, ['lawn']), null);
});

test('zoneOfSelection matches a legacy STRING zone — the coercion bug that made the step read 0 of 4', () => {
  // Older persisted states stored zone as '4' rather than 4. Strict === against a numeric chip
  // key silently never matches, and the rings still render perfectly, so nothing looks broken.
  assert.equal(zoneOfSelection([zoneRing('a', '4')], ['a']), 4);
  assert.equal(zoneOfSelection([zoneRing('a', '0')], ['a']), 0); // zone 0 must not read as falsy-null
});

test('zoneOfSelection returns null for an empty selection, a selection of non-zones, and out-of-range values', () => {
  assert.equal(zoneOfSelection([zoneRing('a', 4)], []), null);
  assert.equal(zoneOfSelection([zoneRing('a', 4)], ['some-item-id']), null); // items/lines aren't zones
  assert.equal(zoneOfSelection([zoneRing('a', 9)], ['a']), null);
  assert.equal(zoneOfSelection([zoneRing('a', -1)], ['a']), null);
  assert.equal(zoneOfSelection([zoneRing('a', 'not-a-number')], ['a']), null);
});

test('the zone chip row iterates real NUMBERS — the coercion that made every drawn zone persist zone:"3"', async () => {
  // DesignPalette renders one chip per ZONE_DEFS key. Object.keys returns strings, and the old
  // `as unknown as Array<0|1|2|3|4|5>` cast asserted numbers without producing any, so `z` was
  // '3'. Self-consistent enough to hide: pickZone('3') set zoneDraw='3' and `zoneDraw === z`
  // compared '3' === '3'. But DesignCanvas writes zoneDraw straight into ZoneShape.zone, so
  // every zone drawn after a chip tap was persisted with a STRING zone, and a numeric
  // selectedZone could never match a chip. Pin the contract the .map(Number) restores.
  const { ZONE_DEFS } = await import('../lib/design-elements.ts');
  const keys = Object.keys(ZONE_DEFS);
  assert.deepEqual(keys, ['0', '1', '2', '3', '4', '5'], 'raw keys are strings — this is the trap');
  const zoneNumbers = keys.map(Number);
  assert.deepEqual(zoneNumbers, [0, 1, 2, 3, 4, 5]);
  for (const z of zoneNumbers) {
    assert.equal(typeof z, 'number');
    // What a chip is asked at render time: does this chip equal the selected zone? Strict ===
    // against a number is the comparison that silently never matched before.
    assert.equal(zoneOfSelection([zoneRing('r', z)], ['r']), z);
  }
});
