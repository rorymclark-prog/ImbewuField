import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BIOMES, classifyBiome, biomeFromSanbi, resolveBiome, kmFromEastCoast,
} from '../lib/biome.ts';

// HOW DO YOU KNOW IT IS RIGHT ONCE IT IS SENT OUT.
//
// Rory, 12 August, on a site report for Ubhejane at 27.73°S 31.96°E: "Is Indian Ocean coastal belt
// correct here" — it was not. That point is ~70 km inland in the Zululand lowveld, which is
// Savanna, and the report's own next two lines said so ("Zululand Lowveld", "Valley Bushveld")
// while its headline said IOCB. Then: "how do I know once it's sent out and you were supposed to
// have corrected this before".
//
// A rule you can read is not a rule you can trust. So this file is a list of REAL PLACES with
// published climate normals and their accepted SANBI biome, and the classifier has to get every
// one of them right. When someone edits a threshold, the map of South Africa answers back.
//
// The sites below are chosen for being unambiguous. Deliberately absent: anywhere the biome is a
// fine-grained mosaic at farm scale — the Knysna forest/fynbos interleave, the Kalahari
// savanna/Nama-Karoo gradient around Upington — because a "wrong" answer there is a real
// cartographic argument, not a bug, and a test that encodes one side of it would be a trap.
// Afromontane Forest is absent for the same reason: SA's forest patches are mostly smaller than
// the resolution anything here works at.

/** Monthly rain that sums to `annual`, shaped like a summer-rainfall year (DJF/SON heavy). */
const summer = (annual: number): number[] =>
  [0.15, 0.13, 0.11, 0.06, 0.03, 0.01, 0.01, 0.02, 0.05, 0.10, 0.14, 0.19].map((w) => w * annual);

/** Shaped like a Cape winter-rainfall year (JJA heavy). */
const winter = (annual: number): number[] =>
  [0.02, 0.03, 0.04, 0.09, 0.14, 0.17, 0.16, 0.14, 0.10, 0.06, 0.03, 0.02].map((w) => w * annual);

/** Eastern Cape bimodal — autumn and spring peaks, no true dry season. */
const bimodal = (annual: number): number[] =>
  [0.08, 0.08, 0.11, 0.10, 0.07, 0.05, 0.05, 0.06, 0.08, 0.11, 0.11, 0.10].map((w) => w * annual);

interface Site {
  place: string;
  lat: number;
  lon: number;
  /** Mean annual precipitation, mm. */
  rain: number;
  /** Mean temperature of the coldest month, °C — what NASA POWER's minTemp feeds in. */
  coldest: number;
  monthly: (annual: number) => number[];
  expect: string; // BIOMES key
  why?: string;
}

const SITES: Site[] = [
  // ── The one that started this ───────────────────────────────────────────────────────────────
  {
    place: 'Ubhejane Creche, Mkuze', lat: -27.73, lon: 31.96, rain: 750, coldest: 16, monthly: summer,
    expect: 'SAVANNA',
    why: 'Zululand lowveld, ~70 km inland. Reported as Indian Ocean Coastal Belt on 12 Aug.',
  },

  // ── Indian Ocean Coastal Belt — an actual belt, so only actual coast ────────────────────────
  { place: 'Durban', lat: -29.85, lon: 31.02, rain: 1009, coldest: 17, monthly: summer, expect: 'IOCB' },
  { place: 'Richards Bay', lat: -28.78, lon: 32.05, rain: 1200, coldest: 17, monthly: summer, expect: 'IOCB' },
  { place: 'Port Edward', lat: -31.05, lon: 30.23, rain: 1050, coldest: 15, monthly: summer, expect: 'IOCB' },

  // ── Savanna — the lowveld, north and east, hot winters ─────────────────────────────────────
  { place: 'Mbombela (Nelspruit)', lat: -25.47, lon: 30.97, rain: 800, coldest: 14, monthly: summer, expect: 'SAVANNA' },
  { place: 'Polokwane', lat: -23.90, lon: 29.45, rain: 480, coldest: 11, monthly: summer, expect: 'SAVANNA' },
  { place: 'Kimberley', lat: -28.74, lon: 24.77, rain: 420, coldest: 8, monthly: summer, expect: 'SAVANNA' },

  // ── Grassland — the highveld and the KZN midlands, cold winters ────────────────────────────
  {
    place: 'Howick, KZN Midlands', lat: -29.48, lon: 30.23, rain: 900, coldest: 12, monthly: summer,
    expect: 'GRASSLAND',
    why: '30.2°E and wet — swallowed by the old IOCB rectangle despite being 60 km inland and 1000 m up.',
  },
  { place: 'Pietermaritzburg', lat: -29.60, lon: 30.38, rain: 850, coldest: 13, monthly: summer, expect: 'GRASSLAND' },
  { place: 'Johannesburg', lat: -26.20, lon: 28.05, rain: 713, coldest: 11, monthly: summer, expect: 'GRASSLAND' },
  { place: 'Bloemfontein', lat: -29.12, lon: 26.21, rain: 550, coldest: 8, monthly: summer, expect: 'GRASSLAND' },
  { place: 'Mthatha', lat: -31.59, lon: 28.78, rain: 750, coldest: 10, monthly: summer, expect: 'GRASSLAND' },

  // ── Fynbos — the winter-rainfall south-west ────────────────────────────────────────────────
  { place: 'Cape Town', lat: -33.93, lon: 18.42, rain: 515, coldest: 12, monthly: winter, expect: 'FYNBOS' },
  { place: 'Stellenbosch', lat: -33.93, lon: 18.86, rain: 713, coldest: 12, monthly: winter, expect: 'FYNBOS' },

  // ── The arid interior ──────────────────────────────────────────────────────────────────────
  { place: 'Springbok', lat: -29.66, lon: 17.89, rain: 200, coldest: 12, monthly: winter, expect: 'SUCCULENT_KAROO' },
  { place: 'Prieska', lat: -29.66, lon: 22.75, rain: 200, coldest: 8, monthly: summer, expect: 'NAMA_KAROO' },
  {
    place: 'Beaufort West', lat: -32.36, lon: 22.58, rain: 230, coldest: 8, monthly: summer,
    expect: 'NAMA_KAROO',
    why: 'Sat one tenth of a degree outside the old Nama-Karoo latitude bound and fell through to Savanna.',
  },
  { place: 'Alexander Bay', lat: -28.60, lon: 16.50, rain: 50, coldest: 13, monthly: winter, expect: 'DESERT' },

  // ── Albany Thicket ─────────────────────────────────────────────────────────────────────────
  { place: 'Makhanda (Grahamstown)', lat: -33.31, lon: 26.53, rain: 650, coldest: 10, monthly: bimodal, expect: 'ALBANY_THICKET' },
];

test('the climate fallback places every known site in the right biome', () => {
  // This is classifyBiome ALONE — the path that runs when SANBI is unreachable. It is a heuristic
  // and it will never be a vegetation map, but it must not be wrong about places this size.
  const wrong: string[] = [];
  for (const s of SITES) {
    const got = classifyBiome(s.lat, s.lon, s.rain, s.coldest, s.monthly(s.rain));
    if (got !== BIOMES[s.expect]) {
      wrong.push(`${s.place} (${s.lat}, ${s.lon}) → ${got.name}, expected ${BIOMES[s.expect].name}`);
    }
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

test('SANBI outranks the heuristic wherever it answers', () => {
  // THE ACTUAL FIX. app/api/location-data already fetches SANBI's 2018 National Vegetation Map on
  // every request; classifyBiome simply never looked at it. The national map is polygon-accurate
  // and it is not ours to second-guess.
  const ubhejane = { lat: -27.73, lon: 31.96, annualRainfall: 750, coldestMonthTemp: 16, monthlyRain: summer(750) };

  const surveyed = resolveBiome({ ...ubhejane, sanbiBiome: 'Savanna' });
  assert.equal(surveyed.biome, BIOMES.SAVANNA);
  assert.equal(surveyed.source, 'sanbi');

  // Even where the heuristic would disagree, the map wins — that is what "authority" means.
  const odd = resolveBiome({ ...ubhejane, sanbiBiome: 'Indian Ocean Coastal Belt' });
  assert.equal(odd.biome, BIOMES.IOCB);
  assert.equal(odd.source, 'sanbi');

  // And with SANBI silent, the answer is still given but flagged as ours rather than surveyed.
  const guessed = resolveBiome({ ...ubhejane, sanbiBiome: null });
  assert.equal(guessed.biome, BIOMES.SAVANNA);
  assert.equal(guessed.source, 'estimated');
});

test('SANBI biome names map onto the registry, and unknown ones do not guess', () => {
  assert.equal(biomeFromSanbi('Savanna'), BIOMES.SAVANNA);
  assert.equal(biomeFromSanbi('Indian Ocean Coastal Belt'), BIOMES.IOCB);
  assert.equal(biomeFromSanbi('Nama-Karoo'), BIOMES.NAMA_KAROO);
  assert.equal(biomeFromSanbi('Nama Karoo'), BIOMES.NAMA_KAROO);
  assert.equal(biomeFromSanbi('Succulent Karoo'), BIOMES.SUCCULENT_KAROO);
  assert.equal(biomeFromSanbi('Albany Thicket'), BIOMES.ALBANY_THICKET);
  assert.equal(biomeFromSanbi('Forests'), BIOMES.FOREST);
  assert.equal(biomeFromSanbi('Grassland'), BIOMES.GRASSLAND);
  assert.equal(biomeFromSanbi('  fynbos  '), BIOMES.FYNBOS);

  // Azonal vegetation cuts ACROSS biomes — rivers, wetlands, coastal dunes exist inside all of
  // them. Translating it into one would be an invention, so it falls through to the heuristic.
  assert.equal(biomeFromSanbi('Azonal Vegetation'), undefined);
  assert.equal(biomeFromSanbi('Inland Azonal Vegetation'), undefined);
  assert.equal(biomeFromSanbi(''), undefined);
  assert.equal(biomeFromSanbi(null), undefined);
  assert.equal(biomeFromSanbi(undefined), undefined);
  assert.equal(biomeFromSanbi('Something Else Entirely'), undefined);
});

test('the coastal belt is measured from the sea, not from a meridian', () => {
  // Durban is on it; Howick, 60 km inland at the same latitude, is not.
  assert.ok(kmFromEastCoast(-29.85, 31.02) < 10, 'Durban should be on the coast');
  assert.ok(kmFromEastCoast(-28.78, 32.05) < 15, 'Richards Bay should be on the coast');
  assert.ok(kmFromEastCoast(-29.48, 30.23) > 45, 'Howick is inland and must fall outside the belt');
  assert.ok(kmFromEastCoast(-27.73, 31.96) > 45, 'Ubhejane is ~70 km inland');
  // And the far interior is nowhere near it — the old rule had no notion of this at all.
  assert.ok(kmFromEastCoast(-26.20, 28.05) > 400, 'Johannesburg is not coastal');
  assert.ok(kmFromEastCoast(-28.74, 24.77) > 500, 'Kimberley is not coastal');
});

test('a site outside South Africa is never given a South African biome', () => {
  const out = resolveBiome({
    lat: -25.97, lon: 32.58, // Maputo
    annualRainfall: 800, coldestMonthTemp: 19, monthlyRain: summer(800),
    sanbiBiome: 'Savanna',
  });
  assert.equal(out.biome, BIOMES.OUTSIDE);
  assert.equal(out.source, 'outside');
});

test('missing climate data reads as unavailable rather than as Savanna', () => {
  // The default branch of the heuristic is Savanna, so a site with no usable climate would
  // otherwise be handed a confident biome built out of nothing.
  const bad = resolveBiome({
    lat: -29.85, lon: 31.02,
    annualRainfall: Number.NaN, coldestMonthTemp: 17, monthlyRain: summer(1000),
    sanbiBiome: null,
  });
  assert.equal(bad.biome, BIOMES.UNCLASSIFIED);
  assert.equal(bad.source, 'unavailable');
});
