import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BIOMES } from '../lib/biome.ts';
import { resolveSiteEcology } from '../lib/site-ecology.ts';
import type { SABiome, VegetationData } from '../lib/types.ts';

// THE REPORT THAT NAMED TWO BIOMES FOR ONE SITE.
//
// Rory's 11 August export: title, guilds and fire-risk sections said "Zululand Lowveld Savanna"
// (the SANBI 2018 vegetation unit), while the fruit-tree, indigenous-tree, nitrogen-fixer and
// windbreak sections — the ones a farmer actually plants from — said "Indian Ocean Coastal Belt",
// as did the filename. Nongoma is inland; Zululand Lowveld is a SAVANNA unit. The coarse biome
// polygon and the precise vegetation map disagree near boundaries, and the report used whichever
// was nearest to hand in each section.

const COASTAL = BIOMES.INDIAN_OCEAN_COASTAL_BELT
  ?? Object.values(BIOMES).find((b) => b.name === 'Indian Ocean Coastal Belt') as SABiome;
const SAVANNA = Object.values(BIOMES).find((b) => b.name === 'Savanna') as SABiome;

const ZULULAND: VegetationData = {
  vegUnit: 'Zululand Lowveld',
  biome: 'Savanna',
  bioregion: 'Lowveld',
};

test('the precise vegetation map wins over the coarse biome polygon', () => {
  const ecology = resolveSiteEcology(COASTAL, ZULULAND);
  assert.equal(ecology.placeName, 'Zululand Lowveld', 'species prompts must name the exact unit');
  assert.equal(ecology.biomeName, 'Savanna', 'the vegetation map names the real biome');
  assert.equal(ecology.label, 'Zululand Lowveld (Savanna)');
  // And the registry entry follows the RESOLVED biome, so key species and challenges stop coming
  // from the wrong one. Coastal-belt key species on an inland savanna site is the actual harm.
  assert.equal(ecology.biome.name, 'Savanna');
  assert.ok(ecology.biome.keySpecies.includes('Marula'), 'savanna key species expected');
  assert.ok(!ecology.biome.keySpecies.includes('Natal Wild Banana'),
    'coastal-belt species are still being handed to an inland savanna site');
});

test('fire risk is decided on the resolved biome, not the coarse name', () => {
  // THE CONSEQUENCE THAT MAKES THIS A CORRECTNESS FIX. The report tested the biome NAME against
  // /Fynbos|Grassland|Savanna|Karoo/. "Indian Ocean Coastal Belt" fails that test, so a genuinely
  // fire-prone Zululand savanna site was told it "has a lower but real dry-season fire risk".
  assert.equal(resolveSiteEcology(COASTAL, ZULULAND).fireProne, true,
    'a savanna site must be told it is fire-prone');
  assert.equal(/Fynbos|Grassland|Savanna|Karoo/.test(COASTAL.name), false,
    'the old test really did read false here — this is what shipped');
  // A genuinely coastal site keeps the softer wording.
  assert.equal(resolveSiteEcology(COASTAL, {
    vegUnit: 'KwaZulu-Natal Coastal Belt',
    biome: 'Indian Ocean Coastal Belt',
    bioregion: 'Indian Ocean Coastal Belt',
  }).fireProne, false);
});

test('sites the vegetation map does not cover fall back cleanly', () => {
  const ecology = resolveSiteEcology(COASTAL, null);
  assert.equal(ecology.placeName, 'Indian Ocean Coastal Belt');
  assert.equal(ecology.biomeName, 'Indian Ocean Coastal Belt');
  assert.equal(ecology.biome.name, COASTAL.name);
  // No parenthetical when there is nothing finer to say.
  assert.equal(ecology.label, 'Indian Ocean Coastal Belt');
});

test('a vegetation record naming an unknown biome still improves the place name', () => {
  // Better to name the exact unit for species selection than to discard the whole record because
  // its biome string does not match a registry entry.
  const ecology = resolveSiteEcology(SAVANNA, {
    vegUnit: 'Some New Unit',
    biome: 'Not A Registry Biome',
    bioregion: '',
  });
  assert.equal(ecology.placeName, 'Some New Unit');
  assert.equal(ecology.biome.name, 'Savanna', 'unknown biome keeps the coarse registry entry');
  assert.equal(ecology.biomeName, 'Not A Registry Biome');
});

test('every section of the report now names the site from one resolver', () => {
  const route = readFileSync(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  // The species-selection sections must never reach for the coarse polygon again.
  const body = route.slice(route.indexOf('const buildPrompt'));
  // The coarse polygon may appear EXACTLY ONCE, and only where the prompt names it in order to
  // tell the model to disregard it. Anywhere else it is a section choosing species off the wrong
  // map again. (Naming it beats silence: without it the model sometimes reached for the coastal
  // label it had seen in the site's own metadata.)
  const coarseMentions = body.match(/\$\{d\.biome\.name\}/g) ?? [];
  assert.equal(coarseMentions.length, 1,
    `the coarse biome polygon is named ${coarseMentions.length} times in the prompt; only the "ignore it" clause may`);
  const at = body.indexOf('${d.biome.name}');
  const clause = body.slice(Math.max(0, at - 220), at + 220);
  assert.ok(/lower resolution and WRONG here/.test(clause),
    'the one coarse-biome mention is no longer the "ignore it entirely" warning');
  assert.ok(!/d\.biome\.keySpecies/.test(body),
    'key species are coming from the coarse biome again, not the resolved one');
  assert.ok(!/d\.vegetation \? d\.vegetation\.vegUnit : d\.biome\.name/.test(body),
    'the per-section vegetation fallback is back — that is the pattern that disagreed with itself');
  // Fire risk reads the shared flag, not a regex over whichever name was in scope.
  assert.ok(/ecology\.fireProne \?/.test(route), 'fire risk is no longer decided on the resolved biome');
  assert.ok(!/\/Fynbos\|Grassland\|Savanna\|Karoo\/\.test\(d\.biome\.name\)/.test(route),
    'the old coarse-name fire test is back');
});

test('the download is named after the site, not the wrong biome', () => {
  const view = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  assert.ok(/reportPdfFilename\(ecology\.placeName\)/.test(view),
    'the PDF filename is back on the coarse biome — the file would contradict its own contents');
  assert.ok(!/\bd\.biome\.name\b/.test(view),
    'the report screen still spends the coarse biome somewhere');
});
