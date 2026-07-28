import test from 'node:test';
import assert from 'node:assert/strict';

import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import {
  annualRoofHarvestLitres,
  deriveWaterSystem,
  statedTankCapacityLitres,
} from '../lib/water-system.ts';

type Ring = Array<[number, number]>;

const FRAME = {
  centerLng: 30,
  centerLat: -29,
  zoom: 18,
  imgW: 1000,
  imgH: 1000,
  mPerPx: 0.1,
};
const BOUNDARY: Ring = [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]];
const ROOF_100_M2: Ring = [[0.4, 0.4], [0.5, 0.4], [0.5, 0.5], [0.4, 0.5]];

function item(defId: string, id = defId): PlacedItem {
  return { id, defId, x: 0.55, y: 0.45 };
}

function state(items: PlacedItem[] = []): DesignCanvasState {
  return {
    siteId: 'water-test',
    frame: FRAME,
    items,
    zones: [],
    lines: [],
    step: 'water',
    updatedAt: '2026-07-28T00:00:00.000Z',
  };
}

function derive(items: PlacedItem[], house: Ring, rainfallMm?: number) {
  return deriveWaterSystem(
    state(items),
    { boundary: BOUNDARY, house, driveway: [] },
    { rainfallMm },
  );
}

test('roof harvest obeys the mm × m² = litre dimensional rule without pinning the current coefficient', () => {
  const unitHarvest = annualRoofHarvestLitres(1, 1);
  const baseline = annualRoofHarvestLitres(100, 800);

  assert.ok(unitHarvest > 0 && unitHarvest <= 1, 'runoff losses must not turn 1 mm on 1 m² into more than 1 L');
  assert.equal(annualRoofHarvestLitres(200, 800), baseline * 2);
  assert.equal(annualRoofHarvestLitres(100, 1600), baseline * 2);
  assert.equal(annualRoofHarvestLitres(0, 800), 0);
  assert.equal(annualRoofHarvestLitres(100, 0), 0);
});

test('a placed tank that cannot hold the annual harvest is never presented as sufficient', () => {
  const system = derive([item('jojo_1000')], ROOF_100_M2, 800);
  const text = system.notes.join(' ');

  assert.match(text, /800 mm\/yr.*100 m².*kL\/yr/);
  assert.match(text, /Placed storage totals .* and cannot hold the estimated .* annual roof harvest at once/);
  assert.doesNotMatch(text, /\bm³\b/);
});

test('catalog capacities stay in litres and capacity-less storage remains explicitly unknown', () => {
  for (const id of ['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000']) {
    const litresEncodedById = Number(id.slice('jojo_'.length));
    assert.equal(statedTankCapacityLitres(ELEMENTS_BY_ID[id]), litresEncodedById);
  }
  assert.equal(statedTankCapacityLitres(ELEMENTS_BY_ID.rain_barrel), null);

  const system = derive([item('rain_barrel')], ROOF_100_M2, 800);
  assert.match(system.notes.join(' '), /1 placed storage item has no stated capacity/);
});

test('missing storage is explicit when a measured roof has harvestable rainfall', () => {
  const system = derive([], ROOF_100_M2, 800);
  assert.match(system.notes.join(' '), /No rainwater storage is placed/);
});

test('zero and invalid measurements produce sensible finite sheet text', () => {
  const cases = [
    derive([], [], 800),
    derive([], ROOF_100_M2, 0),
    derive([], ROOF_100_M2, Number.NaN),
    derive([], ROOF_100_M2, Number.POSITIVE_INFINITY),
  ];

  for (const system of cases) {
    const text = [...system.notes, ...system.runs.map((run) => run.label), ...system.nodes.map((node) => node.label)].join(' ');
    assert.doesNotMatch(text, /NaN|Infinity/);
  }
});
