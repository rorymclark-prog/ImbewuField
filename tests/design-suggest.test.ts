import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestFromAutoDesignPlan,
  suggestPlanting,
  suggestStructures,
  suggestWater,
  suggestZones,
  suggestZonesFromPlan,
  type AutoDesignPlan,
  type ZoneSuggestOpts,
} from '../lib/design-suggest.ts';
import { pointInRing } from '../lib/design-canvas.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';

type Ring = Array<[number, number]>;

const BOUNDARY: Ring = [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]];
const HOUSE: Ring = [[0.42, 0.12], [0.58, 0.12], [0.58, 0.28], [0.42, 0.28]];
const FRAME = { imgW: 1000, imgH: 800, mPerPx: 0.1 };

function zoneOpts(slopeDeg?: number): ZoneSuggestOpts {
  return {
    frame: FRAME,
    driveway: [[0.5, 0.05], [0.5, 0.12]],
    site: slopeDeg == null ? null : { slopeDeg, aspectLabel: 'S' },
  };
}

function assertFiniteAndInsideBounds(
  suggestions: ReturnType<typeof suggestZones>,
  boundary: Ring = BOUNDARY,
): void {
  const xs = boundary.map(([x]) => x);
  const ys = boundary.map(([, y]) => y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];

  assert.ok(suggestions.length > 0);
  for (const suggestion of suggestions) {
    assert.ok(suggestion.points.length > 0, `${suggestion.kind} must carry geometry`);
    for (const [x, y] of suggestion.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `${suggestion.kind} must be finite`);
      assert.ok(x >= minX - 1e-9 && x <= maxX + 1e-9, `${suggestion.kind} x must stay in the plot`);
      assert.ok(y >= minY - 1e-9 && y <= maxY + 1e-9, `${suggestion.kind} y must stay in the plot`);
    }
  }
}

test('the same saved geometry produces byte-identical advice with stable ids', () => {
  const first = suggestZones(BOUNDARY, HOUSE, zoneOpts(7));
  const second = suggestZones(BOUNDARY, HOUSE, zoneOpts(7));

  assert.deepEqual(second, first);
  assert.equal(new Set(first.map((suggestion) => suggestion.id)).size, first.length);
  assert.ok(first.every((suggestion) => suggestion.id.startsWith('ds_')));
});

test('a home zone is suggested only when a house footprint actually exists', () => {
  const withHouse = suggestZones(BOUNDARY, HOUSE, zoneOpts());
  const withoutHouse = suggestZones(BOUNDARY, [], zoneOpts());

  assert.ok(withHouse.some((suggestion) => suggestion.kind === 'zone' && suggestion.zone === 0));
  assert.equal(withoutHouse.some((suggestion) => suggestion.kind === 'zone' && suggestion.zone === 0), false);
});

test('the slope split starts above the documented three-degree boundary, not at it', () => {
  const atBoundary = suggestZones(BOUNDARY, HOUSE, zoneOpts(3));
  const aboveBoundary = suggestZones(BOUNDARY, HOUSE, zoneOpts(3.01));
  const zone5At = atBoundary.find((suggestion) => suggestion.zone === 5);
  const zone5Above = aboveBoundary.find((suggestion) => suggestion.zone === 5);

  assert.match(zone5At?.note ?? '', /farthest from the door/);
  assert.match(zone5Above?.note ?? '', /downhill side/);
});

test('invalid plot geometry produces no confident element or zone advice', () => {
  assert.deepEqual(suggestZones([], HOUSE, zoneOpts()), []);
  assert.deepEqual(suggestWater([], HOUSE, FRAME.mPerPx, FRAME.imgW, FRAME.imgH), []);
  assert.deepEqual(suggestStructures([], HOUSE, FRAME.mPerPx, FRAME.imgW, FRAME.imgH), []);
  assert.deepEqual(suggestPlanting([], HOUSE, FRAME.mPerPx, FRAME.imgW, FRAME.imgH), []);
});

test('tank advice follows the stated source instead of a default code path', () => {
  const plan: AutoDesignPlan = {
    zones: [],
    water: [{ kind: 'tank', anchor: [0.5, 0.35] }],
  };
  const tankSource = suggestFromAutoDesignPlan(
    BOUNDARY,
    HOUSE,
    zoneOpts(),
    plan,
    { waterSource: 'tank' },
  );
  const boreholeSource = suggestFromAutoDesignPlan(
    BOUNDARY,
    HOUSE,
    zoneOpts(),
    plan,
    { waterSource: 'borehole' },
  );

  assert.equal(tankSource.filter((suggestion) => suggestion.kind === 'water_tank').length, 1);
  assert.equal(boreholeSource.some((suggestion) => suggestion.kind === 'water_tank'), false);
});

test('planting advice stays species-neutral and its accepted tree target exists in the checked catalog', () => {
  const suggestions = suggestPlanting(BOUNDARY, HOUSE, FRAME.mPerPx, FRAME.imgW, FRAME.imgH);
  const trees = suggestions.filter((suggestion) => suggestion.kind === 'tree');

  assert.ok(trees.length > 0);
  assert.ok(trees.every((suggestion) => /fruit tree/i.test(suggestion.note ?? '')));
  assert.ok(ELEMENTS_BY_ID.tree_indigenous, 'the generic accepted tree target must remain in the catalog');
});

test('every deterministic generator keeps finite geometry inside the traced plot', () => {
  const narrowBoundary: Ring = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.55], [0.2, 0.55]];
  const edgeHouse: Ring = [[0.22, 0.22], [0.34, 0.22], [0.34, 0.31], [0.22, 0.31]];

  assertFiniteAndInsideBounds(suggestZones(narrowBoundary, edgeHouse, zoneOpts(8)), narrowBoundary);
  assertFiniteAndInsideBounds(
    suggestWater(narrowBoundary, edgeHouse, FRAME.mPerPx, FRAME.imgW, FRAME.imgH),
    narrowBoundary,
  );
  assertFiniteAndInsideBounds(
    suggestStructures(narrowBoundary, edgeHouse, FRAME.mPerPx, FRAME.imgW, FRAME.imgH),
    narrowBoundary,
  );
  assertFiniteAndInsideBounds(
    suggestPlanting(narrowBoundary, edgeHouse, FRAME.mPerPx, FRAME.imgW, FRAME.imgH),
    narrowBoundary,
  );
});

test('accepted structures remain holes in every suggested working zone', () => {
  const structure = { x: 0.65, y: 0.55, wM: 12, hM: 10 };
  const suggestions = suggestZones(BOUNDARY, HOUSE, {
    ...zoneOpts(),
    structures: [structure],
  });
  const workingZones = suggestions.filter((suggestion) => suggestion.kind === 'zone' && suggestion.zone !== 0);

  assert.ok(workingZones.length > 0);
  assert.ok(
    workingZones.every((zone) => !pointInRing([structure.x, structure.y], zone.points)),
    'an accepted structure centre must not be claimed by a suggested zone',
  );
});

test('accepted vegetation is claimed by zone 2 and removed from every other zone', () => {
  const existingVeg = { x: 0.7, y: 0.7 };
  const suggestions = suggestZones(BOUNDARY, HOUSE, {
    ...zoneOpts(),
    existingVeg: [existingVeg],
  });
  const zones = suggestions.filter((suggestion) => suggestion.kind === 'zone');
  const zone2 = zones.find((suggestion) => suggestion.zone === 2);

  assert.ok(zone2);
  assert.equal(pointInRing([existingVeg.x, existingVeg.y], zone2.points), true);
  assert.ok(
    zones.filter((zone) => zone.zone !== 0 && zone.zone !== 2)
      .every((zone) => !pointInRing([existingVeg.x, existingVeg.y], zone.points)),
  );
});

test('AI zone intent is sanitised, ordered, and cannot mutate saved inputs', () => {
  const boundary = structuredClone(BOUNDARY);
  const house = structuredClone(HOUSE);
  const plan = {
    zones: [
      { zone: 4, anchor: [1.4, 0.8] as [number, number], extentM: 20, rationale: '  quiet edge  ' },
      { zone: 2, anchor: [-0.4, 0.4] as [number, number], extentM: 12 },
      { zone: 4, anchor: [0.4, 0.4] as [number, number], extentM: 8, rationale: 'duplicate' },
      { zone: 0, anchor: [0.5, 0.5] as [number, number], extentM: 8 },
      { zone: 6, anchor: [0.5, 0.5] as [number, number], extentM: 8 },
    ],
  };
  const saved = structuredClone({ boundary, house, plan });

  const suggestions = suggestZonesFromPlan(boundary, house, zoneOpts(), plan);
  const zoneNumbers = suggestions
    .filter((suggestion) => suggestion.kind === 'zone')
    .map((suggestion) => suggestion.zone);

  assert.deepEqual(zoneNumbers, [0, 2, 4]);
  assert.equal(suggestions.find((suggestion) => suggestion.zone === 4)?.note, 'quiet edge');
  assertFiniteAndInsideBounds(suggestions);
  assert.deepEqual({ boundary, house, plan }, saved);
});

test('AI auto-design honours water limits, existing access, and valid direction labels', () => {
  const plan: AutoDesignPlan = {
    zones: [],
    windbreak: { anchor: [0.5, 0.6], dir: 'N', lengthM: 500 },
    water: [
      { kind: 'dam', anchor: [-1, 2], extentM: 1 },
      { kind: 'dam', anchor: [0.7, 0.7], extentM: 100 },
      { kind: 'swale', anchor: [0.5, 0.7], extentM: 30 },
      { kind: 'tank', anchor: [0.5, 0.35] },
    ],
    path: { anchor: [0.5, 0.05], dir: 'S' },
  };
  const withDriveway = suggestFromAutoDesignPlan(BOUNDARY, HOUSE, zoneOpts(), plan, {
    waterSource: 'municipal',
  });
  const ponds = withDriveway.filter((suggestion) => suggestion.kind === 'pond');
  const trees = withDriveway.filter((suggestion) => suggestion.kind === 'tree');
  const swale = withDriveway.find((suggestion) => suggestion.kind === 'swale');

  assert.deepEqual(ponds.map((pond) => pond.sizeM), [2, 40]);
  assert.ok(trees.length >= 4 && trees.length <= 6, 'a wind belt must remain a bounded row');
  assert.equal(swale?.points.length, 5);
  assert.equal(withDriveway.some((suggestion) => suggestion.kind === 'water_tank'), false);
  assert.equal(withDriveway.some((suggestion) => suggestion.kind === 'driveway'), false);
  assertFiniteAndInsideBounds(withDriveway);
});

test('metre offsets remain metrically correct on a non-square frame', () => {
  const frame = { imgW: 1200, imgH: 600, mPerPx: 0.2 };
  const suggestions = suggestPlanting(BOUNDARY, HOUSE, frame.mPerPx, frame.imgW, frame.imgH);
  const trees = suggestions.filter((suggestion) => suggestion.kind === 'tree');
  const houseCentre: [number, number] = [0.5, 0.2];
  const offsetsM = trees.map((tree) => {
    const [x, y] = tree.points[0];
    return [
      (x - houseCentre[0]) * frame.imgW * frame.mPerPx,
      (y - houseCentre[1]) * frame.imgH * frame.mPerPx,
    ];
  });

  assert.ok(offsetsM.every(([, south]) => Math.abs(south - offsetsM[0][1]) < 1e-9));
  assert.ok(Math.abs(offsetsM[0][0] + offsetsM[2][0]) < 1e-9, 'tree row must be symmetric in metres');
  assert.equal(offsetsM[1][0], 0);
  assert.ok(offsetsM[0][0] < offsetsM[1][0] && offsetsM[1][0] < offsetsM[2][0]);
});
