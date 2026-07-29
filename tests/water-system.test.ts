import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import {
  ROOF_RUNOFF_COEFFICIENTS,
  TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT,
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
} from '../lib/roof-runoff.ts';
import { computeTankSizing } from '../lib/tank-sizing.ts';
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

test('Water sheet and Tank Calculator coefficients derive from one reviewed source', () => {
  const waterSource = readFileSync(new URL('../lib/water-system.ts', import.meta.url), 'utf8');
  const tankSource = readFileSync(new URL('../lib/tank-sizing.ts', import.meta.url), 'utf8');

  assert.match(waterSource, /from '@\/lib\/roof-runoff'/);
  assert.match(tankSource, /from '@\/lib\/roof-runoff'/);
  assert.doesNotMatch(waterSource, /const\s+\w*RUNOFF\w*\s*=\s*0\.\d+/);
  assert.doesNotMatch(tankSource, /const\s+\w*RUNOFF\w*\s*=\s*0\.\d+/);
  assert.equal(WATER_SHEET_ROOF_RUNOFF_COEFFICIENT, ROOF_RUNOFF_COEFFICIENTS.waterSheet);
  assert.equal(TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT, ROOF_RUNOFF_COEFFICIENTS.tankCalculator);
});

test('both centrally owned coefficients obey 1 mm on 1 m² ≤ 1 L', () => {
  const waterUnit = annualRoofHarvestLitres(1, 1);
  // Use a large exact multiple because TankSizingResult intentionally rounds farmer-facing litre
  // totals to the nearest 100 L. Divide back to the 1 mm × 1 m² dimensional unit afterwards.
  const tankYear = computeTankSizing({
    monthlyRainfallMm: Array(12).fill(100),
    roofAreaM2: 100,
    dailyUseL: 1,
  }).annualHarvestL;
  const tankUnit = tankYear / (12 * 100 * 100);

  assert.ok(waterUnit > 0 && waterUnit <= 1);
  assert.ok(tankUnit > 0 && tankUnit <= 1);
  assert.equal(waterUnit, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT);
  assert.equal(tankUnit, TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT);
});

test('placed storage always gets the overflow advice, and is never judged against annual harvest', () => {
  const system = derive([item('jojo_1000')], ROOF_100_M2, 800);
  const text = system.notes.join(' ');

  assert.match(text, /800 mm\/yr.*100 m².*kL\/yr/);
  assert.match(text, /Placed storage totals .*route the overflow/);
  assert.doesNotMatch(text, /\bm³\b/);

  // A year of rain is many times any real tank, so "capacity < annual harvest" is arithmetic, not
  // a finding. The sheet must never dress it up as one — a farmer reading "cannot hold" buys tanks
  // they do not need. Sizing is a dry-season-demand question this app cannot yet answer.
  assert.doesNotMatch(text, /cannot hold|too small|insufficient|not enough|undersized/i);
});

test('the overflow note reads the same however much storage is placed, so it cannot be mistaken for an adequacy verdict', () => {
  const one = derive([item('jojo_1000')], ROOF_100_M2, 800).notes.join(' ');
  // Ten of the largest tank in the catalog — 100 kL, MORE than the 64 kL this roof harvests, which
  // is the only way the old comparison ever went quiet. Both designs must read the same.
  const many = derive(
    Array.from({ length: 10 }, (_, i) => item('jojo_10000', `jojo_10000_${i}`)),
    ROOF_100_M2,
    800,
  ).notes.join(' ');

  assert.match(one, /route the overflow/);
  assert.match(many, /route the overflow/);
  for (const text of [one, many]) {
    assert.doesNotMatch(text, /sufficient|adequate|cannot hold/i);
  }
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
