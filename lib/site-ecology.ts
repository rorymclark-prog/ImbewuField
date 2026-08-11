// ONE ANSWER TO "WHAT GROWS HERE", FOR THE WHOLE REPORT.
//
// A report exported on 11 August named two different biomes for one site. Its title, guilds and
// fire-risk sections said "Zululand Lowveld Savanna" — the precise SANBI 2018 vegetation unit —
// while the fruit-tree, indigenous-tree, nitrogen-fixer and windbreak sections said "Indian Ocean
// Coastal Belt", and the filename took the coastal one too. Nongoma is inland; Zululand Lowveld is
// a SAVANNA unit. So the sections a farmer actually plants from were choosing species for a
// coastal biome while the rest of the document described an inland savanna site.
//
// Nothing was broken in either lookup. There are simply TWO of them, and the report used whichever
// was nearest to hand:
//
//   • `LocationData.biome`  — a coarse point-in-polygon guess over broad biome shapes.
//   • `LocationData.vegetation` — the SANBI 2018 National Vegetation Map, which names the exact
//     vegetation unit AND the biome that unit belongs to. Far finer, and it disagrees with the
//     coarse lookup near every boundary.
//
// THE PRECISE MAP WINS. When SANBI names the vegetation unit, its biome is the site's biome, and
// the registry entry for THAT biome supplies the key species and challenges. The coarse guess is
// the fallback for sites the vegetation map does not cover.
//
// The fire-risk consequence is the reason this is a correctness fix and not a tidy-up. The report
// decided fire risk by testing the biome NAME against /Fynbos|Grassland|Savanna|Karoo/. "Indian
// Ocean Coastal Belt" fails that test, so a genuinely fire-prone Zululand savanna site was told it
// "has a lower but real dry-season fire risk". Fire advice that reads low on fire-prone veld is
// the kind of wrong answer that costs a farmer a season, so the test now runs on the resolved
// biome and is exported here rather than re-written per call site.

import { BIOMES } from './biome';
import type { SABiome, VegetationData } from './types';

export interface SiteEcology {
  /**
   * What to CALL this place in prose — the exact vegetation unit when SANBI knows it
   * ("Zululand Lowveld"), otherwise the broad biome ("Savanna"). This is the string that should
   * appear in species prompts: naming the unit is what gets genuinely local plants back.
   */
  placeName: string;
  /** The biome the site is actually in, taken from the vegetation map when available. */
  biomeName: string;
  /**
   * The registry entry for `biomeName` — key species, challenges, soil and water strategy. Falls
   * back to the coarse entry when the resolved biome has no registry entry, so this is never null
   * and callers never have to branch.
   */
  biome: SABiome;
  /** "Zululand Lowveld (Savanna)" — for headings, filenames and anywhere both matter. */
  label: string;
  /** Whether dry-season fire is a real hazard here. Decided once, on the resolved biome. */
  fireProne: boolean;
}

/** Biomes where dry-season fire is a normal part of the ecology, not an outside chance. */
const FIRE_PRONE = /Fynbos|Grassland|Savanna|Karoo|Thicket/i;

/** The registry is keyed by shouty code (SAVANNA, FYNBOS…); SANBI hands us display names. */
function biomeEntryByName(name: string | undefined | null): SABiome | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  for (const entry of Object.values(BIOMES)) {
    if (entry.name.trim().toLowerCase() === wanted) return entry;
  }
  return null;
}

export function resolveSiteEcology(
  coarseBiome: SABiome,
  vegetation?: VegetationData | null,
): SiteEcology {
  const vegUnit = vegetation?.vegUnit?.trim();
  const vegBiomeName = vegetation?.biome?.trim();
  // The vegetation map's biome outranks the coarse polygon — but only if we can name it. A
  // vegetation record with a unit and no biome still improves the PLACE name, which is the string
  // that drives species selection, so take what is there rather than discarding the whole record.
  const resolvedEntry = biomeEntryByName(vegBiomeName) ?? coarseBiome;
  const biomeName = biomeEntryByName(vegBiomeName)
    ? resolvedEntry.name
    : (vegBiomeName || coarseBiome.name);
  const placeName = vegUnit || biomeName;
  return {
    placeName,
    biomeName,
    biome: resolvedEntry,
    label: vegUnit && vegUnit !== biomeName ? `${vegUnit} (${biomeName})` : placeName,
    fireProne: FIRE_PRONE.test(biomeName),
  };
}
