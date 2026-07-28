import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestFromAutoDesignPlan,
  suggestPlanting,
  suggestStructures,
  suggestWater,
  suggestZones,
  type AutoDesignPlan,
  type ZoneSuggestOpts,
} from '../lib/design-suggest.ts';
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

