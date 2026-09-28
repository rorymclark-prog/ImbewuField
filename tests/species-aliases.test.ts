import { test } from 'node:test';
import { ok as expectTrue, strictEqual as expectToBe } from 'node:assert';
import { SPECIES } from '@/lib/species-catalog';
import { SPECIES_ID_ALIASES, canonicalSpeciesId } from '@/lib/species-aliases';

const ids = new Set(SPECIES.map((s) => s.id));

test('a retired species id is gone from the catalogue and points at a live entry', () => {
  for (const [retired, live] of Object.entries(SPECIES_ID_ALIASES)) {
    expectTrue(!ids.has(retired), `${retired} is retired but still in SPECIES`);
    expectTrue(ids.has(live), `${retired} points at ${live}, which is not in SPECIES`);
  }
});

test('the Kei apple is one entry, reachable from either name', () => {
  expectToBe(SPECIES.filter((s) => /^Dovyalis (afra|caffra)$/.test(s.botanicalName)).length, 1);
  expectToBe(canonicalSpeciesId('dovyalis-caffra'), 'dovyalis-afra');
  expectToBe(canonicalSpeciesId('dovyalis-afra'), 'dovyalis-afra');
  const kei = SPECIES.find((s) => s.id === 'dovyalis-afra')!;
  // The merge kept what only the old entry carried: the Karoo placement and the windbreak use.
  expectTrue(kei.biomes.some((b) => b.biome === 'NAMA_KAROO'));
  expectTrue(kei.uses.includes('windbreak'));
});
