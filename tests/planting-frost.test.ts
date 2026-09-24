import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ELEMENTS_BY_ID, FROST_CHECK_PLANTING_IDS, FROST_SENSITIVE_PLANTING_IDS,
  biomeClimates, elementVisibleInPalette, plantingColdMinimum,
} from '../lib/design-elements.ts';
import { SPECIES } from '../lib/species-catalog.ts';
import { paletteFor, sectionedPaletteFor } from '../lib/species-palette.ts';

const offered = (id: string, biome: string, coldMinimum: number | null) =>
  elementVisibleInPalette(ELEMENTS_BY_ID[id], biomeClimates(biome), coldMinimum);

test('Polokwane Savanna does not recommend frost-sensitive fruit and banana from biome alone', () => {
  // /api/location-data at -23.90, 29.45 returned Savanna and a NASA POWER cold minimum of -1.9°C.
  // A biome-only filter offered Mango. That can lead a farmer to buy a frost-sensitive tree.
  const polokwaneMinimum = plantingColdMinimum({ minTemp: -1.9, minTempSource: 'nasa-power' });
  for (const id of FROST_SENSITIVE_PLANTING_IDS) {
    assert.equal(offered(id, 'Savanna', polokwaneMinimum), false, `${id} should be screened`);
  }
  assert.equal(offered('tree_kei_apple', 'Savanna', polokwaneMinimum), true);
  assert.equal(offered('tree_citrus', 'Savanna', polokwaneMinimum), true,
    'generic citrus has cultivar and protection choices; a freezing screen is not a blanket ban');
  assert.equal(offered('tree_avocado', 'Savanna', polokwaneMinimum), true,
    'ARC records cultivar-dependent cold tolerance for avocado');
});

test('every screened or cautioned planting card exists and receives only one frost treatment', () => {
  for (const id of FROST_SENSITIVE_PLANTING_IDS) {
    assert.ok(ELEMENTS_BY_ID[id] && !ELEMENTS_BY_ID[id].deprecated, `${id} must be a live card`);
    assert.equal(FROST_CHECK_PLANTING_IDS.has(id), false, `${id} cannot be hidden and cautioned`);
  }
  for (const id of FROST_CHECK_PLANTING_IDS) {
    assert.ok(ELEMENTS_BY_ID[id] && !ELEMENTS_BY_ID[id].deprecated, `${id} must be a live card`);
  }
});

test('Ubhejane and Durban keep warm-area planting choices when the screened minimum stays above freezing', () => {
  const ubhejaneMinimum = plantingColdMinimum({ minTemp: 5.4, minTempSource: 'nasa-power' });
  assert.equal(offered('tree_mango', 'Savanna', ubhejaneMinimum), true);
  assert.equal(offered('banana_clump', 'Savanna', ubhejaneMinimum), true);
  assert.equal(offered('tree_plum', 'Savanna', ubhejaneMinimum), false,
    'temperature screening must not undo the existing warm-biome filter');
  assert.equal(offered('tree_mango', 'Indian Ocean Coastal Belt', 2.3), true);
});

test('an outage or incomplete NASA minimum cannot silently assert that frost-sensitive trees suit a site', () => {
  assert.equal(plantingColdMinimum({ minTemp: 8 }), null);
  assert.equal(plantingColdMinimum({ minTemp: Number.NaN, minTempSource: 'nasa-power' }), null);
  assert.equal(plantingColdMinimum(null), null);
  assert.equal(offered('tree_mango', 'Savanna', null), true,
    'unknown cold minimum leaves the old biome filter; the UI must not claim frost was checked');
});

test('the full Plant Catalog uses each species own frost tolerance at Polokwane', () => {
  const before = paletteFor(SPECIES, 'SAVANNA');
  const after = paletteFor(SPECIES, 'SAVANNA', -1.9);
  assert.ok(before.some((s) => s.commonName === 'Mango'));
  assert.ok(before.some((s) => s.commonName === 'Marula'));
  assert.ok(after.length < before.length);
  assert.ok(after.every((s) => s.frostTolerance !== 'none' || !['canopy', 'sub-canopy', 'shrub'].includes(s.stratum)));
  assert.ok(after.some((s) => s.commonName === 'Cowpea'),
    'a summer annual remains available for sowing after frost');
  assert.ok(after.some((s) => s.commonName === 'Lemon' && s.frostTolerance === 'light'),
    'species with limited cold tolerance remain available for a local frost check');
  const sections = sectionedPaletteFor(SPECIES, 'SAVANNA', -1.9);
  assert.ok(sections.flatMap((section) => section.species).every((s) =>
    s.frostTolerance !== 'none' || !['canopy', 'sub-canopy', 'shrub'].includes(s.stratum)),
    'the grouped picker must use the same screen as the flat palette');
  assert.deepEqual(paletteFor(SPECIES, 'SAVANNA', null), before,
    'missing frost data must not be confused with a measured freezing site');
});
