import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSectorModel } from '../lib/sector.ts';
import { presentSectorCartography, SECTOR_STYLES, sectorFillColor, sectorStrokeWidth } from '../lib/sector-cartography.ts';

const DURBAN = {
  biome: 'Indian Ocean Coastal Belt',
  rainfallPattern: 'summer' as const,
  elevation: { slopeDeg: 4, slopePct: 7, aspectDeg: 225, aspectLabel: 'SW' },
  climate: { minTemp: 3, windFromSummer: 'ESE', windFromWinter: 'WSW', windSpeed: 2.5 },
};

test('presents the benchmark palette, line register, and priority order', () => {
  const entries = presentSectorCartography(deriveSectorModel(DURBAN, -29.783, 30.98, {
    siteCentroid: [0.5, 0.5], drivewayPoints: [[0.1, 0.5], [0.2, 0.5]],
  }));
  assert.deepEqual(entries.map((item) => item.key), [
    'summer-sun', 'winter-sun', 'midday-sun', 'wind:summer_cooling', 'wind:cold_front',
    'wind:berg', 'fire', 'driveway', 'water', 'frost',
  ]);
  assert.deepEqual(entries.map((item) => item.priority), [10, 11, 12, 30, 31, 32, 40, 50, 60, 70]);
  assert.equal(SECTOR_STYLES['summer-cooling-wind'].color, '#25BFC0');
  assert.deepEqual(SECTOR_STYLES['summer-cooling-wind'].dash, [14, 7]);
  assert.equal(SECTOR_STYLES['summer-cooling-wind'].fillAlpha, 0.14);
  assert.equal(SECTOR_STYLES.driveway.lineStyle, 'solid');
  assert.equal(SECTOR_STYLES.fire.fillAlpha, 0.12);
});

test('copies exact bearings and provenance into presentation records', () => {
  const model = deriveSectorModel(DURBAN, -29.783, 30.98, {
    siteCentroid: [0.5, 0.5], drivewayPoints: [[0.1, 0.5], [0.2, 0.5]],
  });
  const byKey = new Map(presentSectorCartography(model).map((item) => [item.key, item]));
  assert.deepEqual(byKey.get('summer-sun')?.bearings, [model.solar.summer.sunriseAzDeg, model.solar.summer.sunsetAzDeg]);
  assert.deepEqual(byKey.get('wind:berg')?.bearings, [model.namedWind.find((w) => w.id === 'berg')!.bearingDeg]);
  assert.equal(byKey.get('wind:berg')?.provenance, 'regional-assumption');
  assert.equal(byKey.get('fire')?.provenance, 'regional-assumption');
  assert.equal(byKey.get('driveway')?.provenance, 'computed');
  assert.equal(byKey.get('water')?.bearings[0], model.water!.downhillBearingDeg);
  assert.equal(byKey.get('frost')?.bearings[0], model.frost!.downhillBearingDeg);
  assert.deepEqual(model.siteWindEvidence, {
    summerFromLabel: 'ESE',
    winterFromLabel: 'WSW',
    annualMeanSpeedMps: 2.5,
    provenance: 'coordinate-climate-grid',
  });
});

test('keeps the shared regional profile separate from coordinate-specific wind evidence', () => {
  const coastalA = deriveSectorModel(DURBAN, -29.783, 30.98);
  const coastalB = deriveSectorModel({
    ...DURBAN,
    climate: { ...DURBAN.climate, windFromSummer: 'NNE', windFromWinter: 'S', windSpeed: 4.1 },
  }, -28.7, 31.4);

  assert.deepEqual(
    coastalA.namedWind.map(({ id, bearingDeg }) => ({ id, bearingDeg })),
    coastalB.namedWind.map(({ id, bearingDeg }) => ({ id, bearingDeg })),
  );
  assert.notDeepEqual(coastalA.siteWindEvidence, coastalB.siteWindEvidence);
  assert.equal(coastalA.namedWind[0]?.provenance, 'regional-assumption');
  assert.equal(coastalB.siteWindEvidence?.provenance, 'coordinate-climate-grid');
});

test('does not invent coordinate wind evidence when the location cache has none', () => {
  const model = deriveSectorModel({
    biome: 'Indian Ocean Coastal Belt',
    rainfallPattern: 'summer',
  }, -29.7, 30.8);
  assert.equal(model.siteWindEvidence, null);
});

test('does not invent regional, fire, driveway, water, or frost presentation', () => {
  const model = deriveSectorModel({ biome: 'Fynbos', rainfallPattern: 'winter' }, -33.93, 18.86);
  const entries = presentSectorCartography(model);
  assert.deepEqual(entries.map((item) => item.key), ['summer-sun', 'winter-sun', 'midday-sun']);
});

test('preserves mixed midday truth as two exact cardinal bearings', () => {
  const model = deriveSectorModel({ biome: 'test' }, -22, 30);
  const midday = presentSectorCartography(model).find((item) => item.key === 'midday-sun');
  assert.equal(midday?.label, 'Midday sun — mixed');
  assert.deepEqual(midday?.bearings, [0, 180]);
});

test('converts sector presentation tokens into phone-readable drawing values', () => {
  assert.equal(Number(sectorStrokeWidth('summer-cooling-wind', 1595).toFixed(3)), 8.932);
  assert.equal(sectorStrokeWidth('summer-cooling-wind', 800), 7);
  assert.equal(Number(sectorStrokeWidth('driveway', 1595).toFixed(3)), 5.742);
  assert.equal(sectorFillColor('summer-cooling-wind'), '#25BFC024');
  assert.equal(sectorFillColor('fire'), '#E7562D1f');
});
