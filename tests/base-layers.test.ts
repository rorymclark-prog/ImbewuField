import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBaseLayers, type MapRefLayers } from '../lib/base-layers.ts';
import type { DesignCanvasState, ZoneShape } from '../lib/design-canvas.ts';
import { buildDemoGeometryLockFixture } from '../lib/demo-geometry-fixture.ts';

function stateWith(zones: ZoneShape[]): DesignCanvasState {
  return {
    siteId: 'site-1',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.3 },
    items: [],
    zones,
    lines: [],
    step: 'base',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function zone(feature: ZoneShape['feature'], points: Array<[number, number]>): ZoneShape {
  return { id: `z-${feature}-${points.length}-${Math.random()}`, zone: 1, points, feature };
}

const SMALL_SQUARE: Array<[number, number]> = [[0.10, 0.10], [0.14, 0.10], [0.14, 0.14], [0.10, 0.14]];
const BIG_SQUARE: Array<[number, number]> = [[0.10, 0.10], [0.40, 0.10], [0.40, 0.40], [0.10, 0.40]];

const MAP_ONLY: MapRefLayers = {
  boundary: [[0, 0], [1, 0], [1, 1], [0, 1]],
  house: [[0.5, 0.5], [0.6, 0.5], [0.6, 0.6], [0.5, 0.6]],
  driveway: [[0.2, 0.9], [0.2, 0.95]], // an open 2-point track, not a closed area
  drivewayClosed: false,
};

test('map-only design is returned unchanged — no Studio feature rings at all', () => {
  const out = resolveBaseLayers(stateWith([]), MAP_ONLY);
  assert.deepEqual(out.boundary, MAP_ONLY.boundary);
  assert.deepEqual(out.house, MAP_ONLY.house);
  assert.deepEqual(out.driveway, MAP_ONLY.driveway);
  assert.equal(out.drivewayClosed, false);
  assert.deepEqual(out.source, { boundary: 'map', house: 'map', driveway: 'map' });
});

test('a Studio ring wins over a map ring for the same slot', () => {
  const state = stateWith([zone('house', SMALL_SQUARE)]);
  const out = resolveBaseLayers(state, MAP_ONLY);
  assert.deepEqual(out.house, SMALL_SQUARE);
  assert.equal(out.source.house, 'studio');
  // Unrelated slots are untouched.
  assert.deepEqual(out.boundary, MAP_ONLY.boundary);
  assert.equal(out.source.boundary, 'map');
});

test('an unrelated ZoneShape feature (e.g. lawn) or effort-zone ring never matches a base slot', () => {
  const lawn = zone('lawn', SMALL_SQUARE);
  const effortZone: ZoneShape = { id: 'ez-1', zone: 2, points: BIG_SQUARE }; // no `feature` at all
  const out = resolveBaseLayers(stateWith([lawn, effortZone]), { boundary: [], house: [], driveway: [] });
  assert.deepEqual(out.source, { boundary: 'none', house: 'none', driveway: 'none' });
  assert.deepEqual(out.boundary, []);
  assert.deepEqual(out.house, []);
  assert.deepEqual(out.driveway, []);
});

test('neither Studio nor map has a slot — resolves to none, not a crash on empty arrays', () => {
  const out = resolveBaseLayers(stateWith([]), { boundary: [], house: [], driveway: [] });
  assert.deepEqual(out, {
    boundary: [], house: [], driveway: [], drivewayClosed: false,
    source: { boundary: 'none', house: 'none', driveway: 'none' },
  });
});

test('the LARGEST of two Studio rings tagged with the same feature wins', () => {
  const state = stateWith([zone('house', SMALL_SQUARE), zone('house', BIG_SQUARE)]);
  const out = resolveBaseLayers(state, MAP_ONLY);
  assert.deepEqual(out.house, BIG_SQUARE);
  assert.equal(out.source.house, 'studio');
});

test('a Studio-drawn driveway ring is always reported closed, regardless of the map flag', () => {
  const state = stateWith([zone('driveway', SMALL_SQUARE)]);
  const closedMap: MapRefLayers = { ...MAP_ONLY, drivewayClosed: false };
  const out = resolveBaseLayers(state, closedMap);
  assert.equal(out.source.driveway, 'studio');
  assert.equal(out.drivewayClosed, true);
});

test('a map-sourced driveway keeps whatever drivewayClosed the map actually measured', () => {
  const openTrack = resolveBaseLayers(stateWith([]), { ...MAP_ONLY, drivewayClosed: false });
  assert.equal(openTrack.drivewayClosed, false);
  const closedArea = resolveBaseLayers(stateWith([]), { ...MAP_ONLY, driveway: BIG_SQUARE, drivewayClosed: true });
  assert.equal(closedArea.source.driveway, 'map');
  assert.equal(closedArea.drivewayClosed, true);
});

test('a boundary can now be Studio-only (no main-map boundary at all)', () => {
  const state = stateWith([zone('boundary', BIG_SQUARE)]);
  const out = resolveBaseLayers(state, { boundary: [], house: [], driveway: [] });
  assert.deepEqual(out.boundary, BIG_SQUARE);
  assert.equal(out.source.boundary, 'studio');
});

// The backwards-compat case app/design/page.tsx must get right when wiring this in: a farmer
// with an OLDER design already has a main-map boundary/house/driveway (traced before the Studio
// Base step existed), then goes on to also trace all three again inside the Studio. Nothing here
// changes the resolution rule (Studio ring wins per slot, independently) — this just proves it
// holds with every slot doubly-populated at once, not just the single-slot case above.
test('all three slots present on both sides at once — Studio wins each, independently, none fall back to map', () => {
  const state = stateWith([
    zone('boundary', BIG_SQUARE),
    zone('house', SMALL_SQUARE),
    zone('driveway', SMALL_SQUARE),
  ]);
  const bothPresent: MapRefLayers = {
    boundary: [[0, 0], [1, 0], [1, 1], [0, 1]],
    house: [[0.5, 0.5], [0.6, 0.5], [0.6, 0.6], [0.5, 0.6]],
    driveway: [[0.2, 0.9], [0.2, 0.95]],
    drivewayClosed: false,
  };
  const out = resolveBaseLayers(state, bothPresent);
  assert.deepEqual(out.boundary, BIG_SQUARE);
  assert.deepEqual(out.house, SMALL_SQUARE);
  assert.deepEqual(out.driveway, SMALL_SQUARE);
  assert.equal(out.drivewayClosed, true); // Studio rings are always closed polygons — see source.
  assert.deepEqual(out.source, { boundary: 'studio', house: 'studio', driveway: 'studio' });
});

test('sample QA fixture stores a concave roof and closed driveway in the real map-shape contract', () => {
  const siteId = 'site:-27.72623,31.96304';
  const fixture = buildDemoGeometryLockFixture(siteId, (xM, yM) => [xM, yM]);
  const byFeatureId = new Map(fixture.features.map((feature) => [String(feature.id), feature]));
  const boundary = byFeatureId.get('demo-boundary');
  const house = byFeatureId.get('demo-house');
  const driveway = byFeatureId.get('demo-driveway');

  assert.equal(boundary?.properties?.name, 'Ubhejane plot');
  assert.equal(house?.properties?.name, 'Main house roof');
  assert.equal(driveway?.properties?.name, 'Tarred driveway');
  assert.equal(house?.properties?.featureType, 'site');
  assert.equal(driveway?.properties?.featureType, 'site');
  assert.equal(house?.properties?.siteId, siteId);
  assert.equal(driveway?.properties?.siteId, siteId);
  assert.equal(house?.geometry.type, 'Polygon');
  assert.equal(driveway?.geometry.type, 'Polygon');
  if (house?.geometry.type !== 'Polygon' || driveway?.geometry.type !== 'Polygon') return;
  assert.equal(house.geometry.coordinates[0].length, 9, 'eight distinctive roof corners plus closure');
  assert.equal(driveway.geometry.coordinates[0].length, 11, 'ten driveway corners plus closure');
  assert.deepEqual(house.geometry.coordinates[0][0], house.geometry.coordinates[0].at(-1));
  assert.deepEqual(driveway.geometry.coordinates[0][0], driveway.geometry.coordinates[0].at(-1));
});
