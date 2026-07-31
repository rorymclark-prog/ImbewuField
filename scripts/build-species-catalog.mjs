import fs from 'fs';
import path from 'path';

const RESEARCH_FILE = path.join(process.cwd(), 'research/sa-species-research-2026-07-31.json');
const OUTPUT_FILE = path.join(process.cwd(), 'lib/species-catalog.ts');

const data = JSON.parse(fs.readFileSync(RESEARCH_FILE, 'utf8'));

const BIOME_MAP = {
  "ALBANY_THICKET": "ALBANY_THICKET",
  "NAMA_KAROO": "NAMA_KAROO",
  "Savanna": "SAVANNA",
  "Indian Ocean Coastal Belt (IOCB) — KwaZulu-Natal and Eastern Cape coast; MAP 819–1272 mm summer-dominant with no true dry season; mean frost days 0–1; MAT 19–22°C; lowest rainfall variability (APCV 18–21%) and lowest potential evaporation (MAPE 1549–1904 mm) of any South African biome; humid, cyclone-exposed, salt-laden onshore wind; sandy, leached, acidic soils turning calcareous within a few hundred metres of the beach": "IOCB",
  "SUCCULENT_KAROO": "SUCCULENT_KAROO",
  "Grassland (Highveld) — summer rainfall 500–900 mm, hard frost −5 to −10°C, hail, clay soils": "GRASSLAND",
  "Desert — Richtersveld / far NW Northern Cape, under ~100 mm MAP, fog-influenced on the coast, extreme heat inland (Gariep Desert is the hottest area in southern Africa)": "DESERT",
  "Fynbos": "FYNBOS",
  "Forest — Afromontane and coastal forest patches (Southern Afrotemperate, Southern/Northern Mistbelt, Scarp and Coastal Dune forest). MAP ~860–1 030 mm+ in the named Strelitzia 19 units, heavily supplemented by mist; APCV 19–22% (very reliable); MAT 15.7–16.7°C; MAPE ~1 650–1 675 mm (low); frost-free by definition; fire-free; shaded, high humidity. Persists above ~525 mm under strong winter rainfall and ~725 mm under strong summer rainfall, and kloof/riverine forest breaks that envelope entirely on groundwater.": "FOREST"
};

function parseNemba(raw) {
  if (!raw) return 'none';
  const s = raw.toLowerCase();
  if (s.includes('1a')) return '1a';
  if (s.includes('1b')) return '1b';
  if (s.includes('2')) return '2';
  if (s.includes('3')) return '3';
  if (s.includes('not listed') || s.includes('none')) return 'none';
  console.warn(`Unrecognized NEMBA status: ${raw}, defaulting to none. Pls check.`);
  return 'none';
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const speciesMap = new Map();

let skippedCount = 0;

for (const [key, palette] of Object.entries(data.palettes)) {
  const biomeRaw = palette.biome;
  const biomeKey = BIOME_MAP[biomeRaw];
  if (!biomeKey) {
    throw new Error(`Unknown biome: ${biomeRaw}`);
  }

  for (const entry of palette.entries) {
    let nemba = parseNemba(entry.nembaStatus);
    if (nemba === '1a' || nemba === '1b') {
      skippedCount++;
      continue; // do not include NEMBA 1a/1b
    }

    // clean up botanical names like "Citrus × limon" to merge correctly
    let cleanBotanical = entry.botanicalName.replace(/×\s*/g, '').replace(/\s*×/g, '').trim();

    let stratum = entry.stratum;
    let height = entry.matureHeightM;
    if (stratum === 'groundcover' && height > 1) {
      stratum = 'herb';
    }
    if (stratum === 'canopy' && height < 5) {
      stratum = 'sub-canopy';
    }

    const botanicalLower = cleanBotanical.toLowerCase();
    
    if (!speciesMap.has(botanicalLower)) {
      speciesMap.set(botanicalLower, {
        id: slugify(cleanBotanical),
        commonName: entry.commonName.trim(),
        botanicalName: cleanBotanical,
        indigenous: entry.indigenous,
        section: entry.section,
        stratum: stratum,
        uses: entry.uses,
        matureHeightM: height,
        matureWidthM: entry.matureWidthM,
        crownForm: entry.crownForm,
        waterNeed: entry.waterNeed,
        frostTolerance: entry.frostTolerance,
        biomes: [],
        why: entry.why,
        source: entry.source,
        nemba: nemba,
        reviewed: false
      });
    }

    const s = speciesMap.get(botanicalLower);
    // Check conflicts
    if (s.matureHeightM !== height || s.crownForm !== entry.crownForm) {
      console.warn(`Conflict for ${s.botanicalName}: height ${s.matureHeightM} vs ${height}, crown ${s.crownForm} vs ${entry.crownForm}`);
    }

    // Don't add duplicate biome
    if (!s.biomes.find(b => b.biome === biomeKey)) {
      s.biomes.push({
        biome: biomeKey,
        rank: entry.rank
      });
    }
  }
}

const finalSpeciesList = Array.from(speciesMap.values());

let out = `import type { Species } from './species-palette';\n\n`;
out += `export const SPECIES: Species[] = ` + JSON.stringify(finalSpeciesList, null, 2) + `;\n`;

fs.writeFileSync(OUTPUT_FILE, out);
console.log(`Wrote ${finalSpeciesList.length} species to ${OUTPUT_FILE} (skipped ${skippedCount} NEMBA 1a/1b entries)`);
