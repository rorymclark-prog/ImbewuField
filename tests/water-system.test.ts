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
  metresPerNormUnit,
  nearestPointOnRing,
  ringAreaM2,
  routeAround,
  segmentCrossesRing,
  statedTankCapacityLitres,
  toMetres,
  toNorm,
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

function state(items: PlacedItem[] = [], dailyWaterUseL?: number): DesignCanvasState {
  return {
    siteId: 'water-test',
    frame: FRAME,
    items,
    zones: [],
    lines: [],
    step: 'water',
    updatedAt: '2026-07-28T00:00:00.000Z',
    dailyWaterUseL,
  };
}

function derive(
  items: PlacedItem[],
  house: Ring,
  rainfall?: number | { rainfallMm?: number; monthlyRainfallMm?: number[] },
  dailyWaterUseL?: number,
) {
  return deriveWaterSystem(
    state(items, dailyWaterUseL),
    { boundary: BOUNDARY, house, driveway: [] },
    typeof rainfall === 'number' ? { rainfallMm: rainfall } : rainfall,
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

test('without farmer-entered daily use, the sheet refuses to invent a household demand', () => {
  const monthlyRainfallMm = [150, 150, 100, 60, 20, 10, 10, 20, 50, 80, 80, 70];
  const system = derive(
    [item('jojo_5000')],
    ROOF_100_M2,
    { rainfallMm: 800, monthlyRainfallMm },
  );
  const text = system.storageNotes.join(' ');

  assert.match(text, /Sizing needs your daily household use — set it in the Tank Calculator/);
  assert.doesNotMatch(text, /recommended storage|meets the monthly-balance recommendation|below the monthly-balance recommendation/);
});

test('the Water sheet prints the Tank Calculator monthly-balance result, not annual-harvest arithmetic', () => {
  const monthlyRainfallMm = [150, 150, 100, 60, 20, 10, 10, 20, 50, 80, 80, 70];
  const dailyUseL = 100;
  const expected = computeTankSizing({
    monthlyRainfallMm,
    roofAreaM2: 100,
    dailyUseL,
  });
  const system = derive(
    [item('jojo_5000')],
    ROOF_100_M2,
    { rainfallMm: 800, monthlyRainfallMm },
    dailyUseL,
  );

  assert.equal(expected.ok, true);
  assert.ok(system.storageNotes.includes(expected.summary));
  assert.match(system.storageNotes.join(' '), /monthly-balance recommendation/);
});

test('equal annual rain with different seasonality produces different storage advice', () => {
  const seasonal = [150, 150, 100, 60, 20, 10, 10, 20, 50, 80, 80, 70];
  const uniform = Array(12).fill(800 / 12);
  const dailyUseL = 100;
  const seasonalSystem = derive([], ROOF_100_M2, { rainfallMm: 800, monthlyRainfallMm: seasonal }, dailyUseL);
  const uniformSystem = derive([], ROOF_100_M2, { rainfallMm: 800, monthlyRainfallMm: uniform }, dailyUseL);

  assert.notDeepEqual(seasonalSystem.storageNotes, uniformSystem.storageNotes);
  assert.ok(seasonalSystem.storageNotes.includes(computeTankSizing({
    monthlyRainfallMm: seasonal,
    roofAreaM2: 100,
    dailyUseL,
  }).summary));
  assert.ok(uniformSystem.storageNotes.includes(computeTankSizing({
    monthlyRainfallMm: uniform,
    roofAreaM2: 100,
    dailyUseL,
  }).summary));
});

test('the exact Water sheet footer is wired to the derived storage notes', () => {
  const glossySource = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');

  assert.match(glossySource, /function waterReferenceFooterText\(/);
  assert.match(glossySource, /deriveWaterSystem\(state, refLayers/);
  assert.match(glossySource, /footerText: waterReferenceFooterText\(/);
  assert.doesNotMatch(glossySource, /footerText:\s*WATER_REFERENCE_NOTES/);
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

test('normalised water geometry converts through one isotropic metre space on non-square frames', () => {
  const frame = { imgW: 1200, imgH: 400, mPerPx: 0.25 };
  const points: Ring = [[0, 0], [0.2, 0.7], [1, 1]];

  assert.deepEqual(metresPerNormUnit(frame), [frame.imgW * frame.mPerPx, frame.imgH * frame.mPerPx]);
  for (const point of points) {
    assert.deepEqual(toNorm(toMetres(point, frame), frame), point);
  }

  const rect: Ring = [[0.1, 0.2], [0.4, 0.2], [0.4, 0.6], [0.1, 0.6]];
  const widthM = (0.4 - 0.1) * frame.imgW * frame.mPerPx;
  const heightM = (0.6 - 0.2) * frame.imgH * frame.mPerPx;
  assert.ok(Math.abs(ringAreaM2(rect, frame) - widthM * heightM) < 1e-9);
  assert.equal(ringAreaM2([...rect].reverse(), frame), ringAreaM2(rect, frame));
});

test('nearest-edge selection is made in metres, not misleading normalised distance', () => {
  const frame = { imgW: 1200, imgH: 300, mPerPx: 0.1 };
  const openLine: Ring = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7]];
  const point: [number, number] = [0.55, 0.5];
  const hit = nearestPointOnRing(point, openLine, frame, false);

  assert.ok(hit);
  assert.equal(hit.index, 0, 'the physically nearer horizontal segment must win on a wide frame');
  assert.ok(Math.abs(hit.point[0] - point[0]) < 1e-9);
  assert.ok(Math.abs(hit.point[1] - 0.3) < 1e-9);
});

test('a house-crossing pipe gets at most two clear elbows while an already-clear pipe stays straight', () => {
  const house: Ring = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]];
  const crossingFrom: [number, number] = [0.2, 0.5];
  const crossingTo: [number, number] = [0.8, 0.5];
  const clearFrom: [number, number] = [0.2, 0.2];
  const clearTo: [number, number] = [0.8, 0.2];

  assert.equal(segmentCrossesRing(crossingFrom, crossingTo, house), true);
  const detour = routeAround(crossingFrom, crossingTo, house, FRAME);
  assert.ok(detour.length >= 2 && detour.length <= 4);
  for (let i = 1; i < detour.length; i++) {
    assert.equal(segmentCrossesRing(detour[i - 1], detour[i], house), false);
  }
  assert.deepEqual(routeAround(clearFrom, clearTo, house, FRAME), [clearFrom, clearTo]);
});

test('derived infrastructure is deterministic, finite, conditional, and never mutates the saved design', () => {
  const items = [
    { ...item('jojo_5000', 'tank'), x: 0.3, y: 0.35 },
    { ...item('veg_bed', 'bed'), x: 0.75, y: 0.7, wM: 4, hM: 10, rot: 30 },
  ];
  const savedState = state(items);
  const before = structuredClone(savedState);
  const first = deriveWaterSystem(savedState, { boundary: BOUNDARY, house: ROOF_100_M2, driveway: [] });
  const second = deriveWaterSystem(structuredClone(savedState), {
    boundary: structuredClone(BOUNDARY),
    house: structuredClone(ROOF_100_M2),
    driveway: [],
  });

  assert.deepEqual(second, first);
  assert.deepEqual(savedState, before);
  assert.ok(first.nodes.some((node) => node.kind === 'tank' && !node.proposed));
  assert.ok(first.nodes.some((node) => node.kind === 'first_flush'));
  assert.ok(first.nodes.some((node) => node.kind === 'pump'));
  assert.ok(first.runs.some((run) => run.kind === 'gutter'));
  assert.ok(first.runs.some((run) => run.kind === 'main'));
  assert.ok(first.runs.some((run) => run.kind === 'drip_header'));
  assert.ok(first.runs.some((run) => run.kind === 'drip_lateral'));
  for (const point of [
    ...first.nodes.map((node) => node.at),
    ...first.runs.flatMap((run) => run.points),
  ]) {
    assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }
});

test('a farmer-drawn pipe remains existing infrastructure and suppresses a parallel proposed main', () => {
  const saved = state([
    { ...item('jojo_5000', 'tank'), x: 0.2, y: 0.2 },
    { ...item('veg_bed', 'bed'), x: 0.8, y: 0.8 },
  ]);
  saved.lines = [{ id: 'existing-main', kind: 'pipe', points: [[0.2, 0.2], [0.8, 0.8]] }];
  const system = deriveWaterSystem(saved, { boundary: BOUNDARY, house: [], driveway: [] });
  const mainRuns = system.runs.filter((run) => run.kind === 'main');

  assert.ok(mainRuns.some((run) => run.proposed === false && run.label === 'Existing pipe'));
  assert.equal(mainRuns.some((run) => run.label === 'Buried irrigation main'), false);
});

test('invalid frames and absent sources produce empty or source-honest systems', () => {
  const broken = state([item('jojo_5000')]);
  broken.frame = { ...broken.frame, mPerPx: 0 };
  assert.deepEqual(
    deriveWaterSystem(broken, { boundary: BOUNDARY, house: ROOF_100_M2, driveway: [] }),
    { runs: [], nodes: [], notes: [], storageNotes: [] },
  );

  const bedsOnly = derive([item('veg_bed')], []);
  assert.equal(bedsOnly.runs.some((run) => run.kind === 'gutter' || run.kind === 'greywater'), false);
  assert.equal(bedsOnly.nodes.some((node) => node.kind === 'pump' || node.kind === 'diverter'), false);
});

test('a proposed overflow basin never leaves even a very small traced boundary', () => {
  const tinyBoundary: Ring = [[0.49, 0.49], [0.51, 0.49], [0.51, 0.51], [0.49, 0.51]];
  const saved = state([
    { ...item('jojo_5000', 'tank'), x: 0.5, y: 0.5 },
    { ...item('veg_bed', 'bed'), x: 0.505, y: 0.505 },
  ]);
  const system = deriveWaterSystem(saved, { boundary: tinyBoundary, house: [], driveway: [] });
  const basin = system.nodes.find((node) => node.kind === 'basin' && node.proposed);

  assert.ok(basin, 'tank plus irrigated bed needs a safe overflow destination');
  assert.ok(
    basin.at[0] > 0.49 && basin.at[0] < 0.51 && basin.at[1] > 0.49 && basin.at[1] < 0.51,
    `overflow basin escaped the property at ${basin.at.join(', ')}`,
  );
});
