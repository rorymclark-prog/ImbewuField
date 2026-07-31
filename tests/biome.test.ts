import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIOMES,
  aspectLabel,
  classifyBiome,
  isWithinSouthAfrica,
  koppenClassify,
} from '../lib/biome.ts';
import { SOUTH_AFRICA_POLYGONS } from '../lib/south-africa-boundary.ts';

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

function signedRingArea(ring: readonly (readonly [number, number])[]): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return twiceArea / 2;
}

function meanPoint(ring: readonly (readonly [number, number])[]): readonly [number, number] {
  const unique = ring.slice(0, -1);
  return [
    unique.reduce((sum, point) => sum + point[0], 0) / unique.length,
    unique.reduce((sum, point) => sum + point[1], 0) / unique.length,
  ];
}

test('the national boundary source is closed, finite and geographically valid', () => {
  assert.ok(SOUTH_AFRICA_POLYGONS.length > 0);
  for (const [polygonIndex, polygon] of SOUTH_AFRICA_POLYGONS.entries()) {
    assert.ok(polygon.length > 0, `polygon ${polygonIndex} has no outer ring`);
    for (const [ringIndex, ring] of polygon.entries()) {
      assert.ok(ring.length >= 4, `polygon ${polygonIndex} ring ${ringIndex} cannot enclose land`);
      assert.deepEqual(ring.at(-1), ring[0], `polygon ${polygonIndex} ring ${ringIndex} is open`);
      assert.notEqual(signedRingArea(ring), 0, `polygon ${polygonIndex} ring ${ringIndex} has no area`);
      for (const [longitude, latitude] of ring) {
        assert.ok(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180);
        assert.ok(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90);
      }
    }
  }
});

test('enclave rings wind opposite their outer land ring', () => {
  for (const [polygonIndex, [outer, ...enclaves]] of SOUTH_AFRICA_POLYGONS.entries()) {
    const outerSign = Math.sign(signedRingArea(outer));
    assert.notEqual(outerSign, 0);
    for (const enclave of enclaves) {
      assert.equal(
        Math.sign(signedRingArea(enclave)),
        -outerSign,
        `polygon ${polygonIndex} has an enclave with the outer ring’s winding`,
      );
    }
  }
});

test('outer borders are included while enclave borders remain excluded', () => {
  for (const [outer, ...enclaves] of SOUTH_AFRICA_POLYGONS) {
    const stride = Math.max(1, Math.floor((outer.length - 1) / 20));
    for (let index = 0; index < outer.length - 1; index += stride) {
      const [longitude, latitude] = outer[index];
      assert.equal(isWithinSouthAfrica(latitude, longitude), true);
    }
    for (const enclave of enclaves) {
      const stride = Math.max(1, Math.floor((enclave.length - 1) / 10));
      for (let index = 0; index < enclave.length - 1; index += stride) {
        const [longitude, latitude] = enclave[index];
        assert.equal(isWithinSouthAfrica(latitude, longitude), false);
      }
    }
  }
});

test('each land polygon has an interior representative and every enclave remains outside', () => {
  for (const [outer, ...enclaves] of SOUTH_AFRICA_POLYGONS) {
    const [outerLon, outerLat] = meanPoint(outer);
    assert.equal(isWithinSouthAfrica(outerLat, outerLon), true);
    for (const enclave of enclaves) {
      const [holeLon, holeLat] = meanPoint(enclave);
      assert.equal(isWithinSouthAfrica(holeLat, holeLon), false);
    }
  }
});

test('authoritative boundary geometry is immutable at every nesting level', () => {
  assert.equal(Object.isFrozen(SOUTH_AFRICA_POLYGONS), true);
  for (const polygon of SOUTH_AFRICA_POLYGONS) {
    assert.equal(Object.isFrozen(polygon), true);
    for (const ring of polygon) {
      assert.equal(Object.isFrozen(ring), true);
      assert.ok(ring.every((coordinate) => Object.isFrozen(coordinate)));
    }
  }
});

// ── Biome NAME vs registry KEY: the wiring that silently disabled the climate filter ──────────
//
// lib/design-elements.ts's biomeClimates() switches on the biome NAME ("Indian Ocean Coastal
// Belt"); lib/species-catalog.ts keys its entries by the BIOMES registry KEY ("IOCB"). Both are
// reached through DesignPalette's single `siteBiome` prop, so whichever form that prop carries,
// ONE of them is wrong unless the conversion happens at the SpeciesPicker boundary inside the
// palette.
//
// It was converted one level too early once, and nothing failed: biomeClimates fell through its
// switch to `null`, which means "unknown biome — show every tree", so the palette quietly stopped
// filtering and offered apple, pear, plum and olive on a subtropical KZN coast. A silent
// permissive fallback is exactly the kind of bug a type checker cannot see, so it is pinned here.
test('biomeClimates reads NAMES and species-catalog reads KEYS — they are not interchangeable', async () => {
  const { biomeClimates } = await import('../lib/design-elements.ts');
  const { biomeKeyForName } = await import('../lib/biome.ts');

  for (const [key, biome] of Object.entries(BIOMES)) {
    // Round-trip: the name a site stores resolves back to this registry key.
    assert.equal(biomeKeyForName(biome.name), key, `${biome.name} must map to ${key}`);
  }

  // The two coastal/subtropical biomes the sample farm actually uses, stated explicitly: the NAME
  // classifies, the KEY does not. If a future edit makes biomeClimates accept keys too, this test
  // should be updated deliberately rather than deleted — the point is that they differ.
  assert.deepEqual(biomeClimates('Indian Ocean Coastal Belt'), ['subtropical']);
  assert.equal(biomeClimates('IOCB'), null, 'a registry key must NOT classify as a biome name');

  // And the consequence that made it invisible: null means "show everything".
  const { elementSuitsClimate } = await import('../lib/design-elements.ts');
  assert.equal(elementSuitsClimate('tree_apple', biomeClimates('Indian Ocean Coastal Belt')), false,
    'a temperate apple must be hidden on the subtropical coast');
  assert.equal(elementSuitsClimate('tree_apple', biomeClimates('IOCB')), true,
    'this is the silent failure: an unrecognised biome shows every tree');
});
