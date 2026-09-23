import { SPECIES } from './species-catalog';
import { broadReachPalette, paletteFor } from './species-palette';

// The report model can name plants outside the picker. A prompt alone cannot stop it suggesting
// one of these to a farmer, so check each generated batch before it enters the paid document.
// Keep the common-name aliases that occur in reports alongside the reviewed catalogue's NEMBA
// flags. "Prickly pear" is absent from the catalogue but appeared as a biome key species.
const LISTED_PLANT_ALIASES = [
  'guava', 'psidium guajava', 'purple granadilla', 'passion fruit', 'passiflora edulis',
  'prickly pear', 'opuntia ficus-indica', 'white mulberry', 'morus alba',
  'black wattle', 'acacia mearnsii', 'port jackson', 'acacia saligna',
  'leucaena', 'leucaena leucocephala',
];

const listedNames = [...new Set([
  ...LISTED_PLANT_ALIASES,
  ...SPECIES.filter((species) => species.nemba !== 'none').flatMap((species) => [
    species.botanicalName.toLowerCase(),
    ...species.commonName.toLowerCase().split(/\s*\/\s*/).map((name) => name.trim()),
  ]),
])];

export function listedPlantMentions(markdown: string): string[] {
  return listedNames.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`, 'i').test(markdown);
  });
}

export function reportPlantingCandidates(biomeKey: string | undefined, minTempC?: number | null): string {
  const species = biomeKey
    ? paletteFor(SPECIES, biomeKey, minTempC)
    : broadReachPalette(SPECIES, 4, minTempC);
  return species.map((plant) => `${plant.commonName} (${plant.botanicalName})`).join('; ');
}

export const REPORT_PLANTING_SAFETY_RULE =
  'For new perennial, windbreak, guild or restoration planting, recommend only plants in the supplied SCREENED PLANTING CANDIDATES list, and only when site evidence supports them. These candidates have not been agronomist-reviewed. ' +
  'Do not recommend or name listed invasive plants, including guava, purple granadilla, prickly pear, white mulberry, black wattle, Port Jackson wattle or leucaena. ' +
  'A saved planting is an observation, not an approval to propagate it. If an existing planting raises a legal concern, describe the concern without proposing more of it.';
