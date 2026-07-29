import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIOMES,
  aspectLabel,
  classifyBiome,
  isWithinSouthAfrica,
  koppenClassify,
} from '../lib/biome.ts';

const summerRain = [100, 100, 100, 20, 10, 5, 5, 5, 20, 80, 100, 100];
const winterRain = [5, 5, 10, 40, 80, 120, 120, 100, 50, 10, 5, 5];

test('neighbouring countries, enclaves and ocean do not receive South African biome advice', () => {
  const outsidePoints = [
    [-24.6282, 25.9231], // Gaborone, Botswana
    [-25.9692, 32.5732], // Maputo, Mozambique
    [-22.5609, 17.0658], // Windhoek, Namibia
    [-29.3158, 27.4869], // Maseru, Lesotho
    [-26.3054, 31.1367], // Mbabane, Eswatini
    [-30, 15.8], // Atlantic Ocean inside the old rectangular shortcut
  ] as const;

  for (const [lat, lon] of outsidePoints) {
    assert.equal(isWithinSouthAfrica(lat, lon), false);
    assert.equal(
      classifyBiome(lat, lon, 700, 8, summerRain),
      BIOMES.OUTSIDE,
    );
  }
});

test('representative South African locations remain inside the national boundary', () => {
  const insidePoints = [
    [-33.9249, 18.4241], // Cape Town
    [-29.8587, 31.0218], // Durban
    [-26.2041, 28.0473], // Johannesburg
    [-28.7282, 24.7499], // Kimberley
    [-33.9608, 25.6022], // Gqeberha
  ] as const;

  for (const [lat, lon] of insidePoints) {
    assert.equal(isWithinSouthAfrica(lat, lon), true);
    assert.notEqual(
      classifyBiome(lat, lon, 700, 8, summerRain),
      BIOMES.OUTSIDE,
    );
  }
});

test('a climate boundary is deterministic and exhaustive rather than a gap', () => {
  const knownBiomes = new Set(Object.values(BIOMES));
  const classifications = Array.from({ length: 1_601 }, (_, annualRainfall) =>
    classifyBiome(-33.5, 18.8, annualRainfall, 8, winterRain));

  for (const biome of classifications) {
    assert.ok(knownBiomes.has(biome));
  }
  assert.ok(new Set(classifications).size > 1);
  assert.deepEqual(
    classifications,
    Array.from({ length: 1_601 }, (_, annualRainfall) =>
      classifyBiome(-33.5, 18.8, annualRainfall, 8, winterRain)),
  );
});

test('rainfall timing can change arid Western Cape advice without changing the site', () => {
  const winterDominant = classifyBiome(-31.5, 19, 200, 8, winterRain);
  const summerDominant = classifyBiome(-31.5, 19, 200, 8, summerRain);

  assert.notEqual(winterDominant, summerDominant);
  assert.equal(winterDominant.rainfallPattern, 'winter');
  assert.notEqual(summerDominant.rainfallPattern, 'winter');
});

test('missing or impossible climate data is named as unavailable, never guessed', () => {
  const invalidCases = [
    [Number.NaN, 8, summerRain],
    [Number.POSITIVE_INFINITY, 8, summerRain],
    [-1, 8, summerRain],
    [700, Number.NaN, summerRain],
    [700, Number.POSITIVE_INFINITY, summerRain],
    [700, 8, []],
    [700, 8, summerRain.slice(0, 11)],
    [700, 8, summerRain.map((value, index) => index === 4 ? Number.NaN : value)],
    [700, 8, summerRain.map((value, index) => index === 4 ? -value : value)],
  ] as const;

  for (const [rainfall, coldestTemp, monthly] of invalidCases) {
    const biome = classifyBiome(
      -29.8587,
      31.0218,
      rainfall,
      coldestTemp,
      [...monthly],
    );
    assert.equal(biome, BIOMES.UNCLASSIFIED);
    assert.doesNotMatch(JSON.stringify(biome), /NaN|Infinity/);
  }
});

test('invalid coordinates never fall through to the Savanna default', () => {
  for (const [lat, lon] of [
    [Number.NaN, 28],
    [-29, Number.NaN],
    [Number.POSITIVE_INFINITY, 28],
    [-29, Number.NEGATIVE_INFINITY],
  ]) {
    assert.equal(isWithinSouthAfrica(lat, lon), false);
    assert.equal(classifyBiome(lat, lon, 700, 8, summerRain), BIOMES.OUTSIDE);
  }
});

test('the biome catalogue has unique codes and complete farmer-facing guidance', () => {
  const values = Object.values(BIOMES);
  assert.equal(new Set(values.map((biome) => biome.code)).size, values.length);
  for (const biome of values) {
    assert.ok(biome.name.trim());
    assert.ok(biome.description.trim());
    assert.ok(biome.waterStrategy.trim());
    assert.ok(biome.soilStrategy.trim());
    assert.doesNotMatch(JSON.stringify(biome), /NaN|Infinity/);
  }
});

test('compass labels wrap every full turn and partition all 16 directions', () => {
  const labels = Array.from({ length: 16 }, (_, index) => aspectLabel(index * 22.5));
  assert.equal(new Set(labels).size, labels.length);

  for (let degrees = -720; degrees <= 720; degrees += 7.5) {
    assert.equal(aspectLabel(degrees), aspectLabel(degrees + 360));
  }
  assert.equal(aspectLabel(Number.NaN), '—');
  assert.equal(aspectLabel(Number.POSITIVE_INFINITY), '—');
});

test('Köppen output is finite for valid data and honest when inputs are invalid', () => {
  const valid = koppenClassify(700, 18, 28, 8, 500, 100);
  assert.ok(valid.code.trim());
  assert.ok(valid.description.trim());
  assert.doesNotMatch(JSON.stringify(valid), /NaN|Infinity/);

  const invalidCases = [
    [Number.NaN, 18, 28, 8, 500, 100],
    [-1, 18, 28, 8, 500, 100],
    [700, Number.NaN, 28, 8, 500, 100],
    [700, 18, Number.POSITIVE_INFINITY, 8, 500, 100],
    [700, 18, 28, 8, -1, 100],
    [700, 18, 28, 8, 500, Number.NaN],
  ] as const;
  for (const args of invalidCases) {
    assert.deepEqual(koppenClassify(
      args[0],
      args[1],
      args[2],
      args[3],
      args[4],
      args[5],
    ), {
      code: '?',
      description: 'Unknown',
    });
  }
});
