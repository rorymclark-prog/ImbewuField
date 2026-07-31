import type { SABiome } from './types';
import { SOUTH_AFRICA_POLYGONS } from './south-africa-boundary';

export const BIOMES: Record<string, SABiome> = {
  SAVANNA: {
    name: 'Savanna',
    code: 'SV',
    description: 'Tropical/subtropical wooded grassland with seasonal drought',
    color: '#8B9D5E',
    rainfallPattern: 'summer',
    meanRainfall: '500–700mm',
    keySpecies: ['Marula', 'Mopane', 'Wild Fig', 'Leadwood', 'Moringa', 'Fever Tree', 'Buffalo Thorn'],
    soilType: 'Red/yellow sandy clay loams, often shallow to bedrock',
    waterStrategy: 'Summer storms → swales + infiltration ponds before first rains (Aug–Sep). Size tanks at 50L/m² roof catchment min. Dig dams at 3:1 length:width ratio on gentle slopes. Keyline on ridgelines.',
    soilStrategy: 'High iron, often low P and N. Mulch with mopane leaf (allelopathic — use lightly). Acacia species for nitrogen fixing. Moringa as dynamic accumulator. Target OC >2% with compost + biochar.',
    challenges: ['Intense but erratic storms', 'Grass competition for establishing trees', 'Frost risk at altitude', 'Termite pressure'],
  },
  GRASSLAND: {
    name: 'Grassland',
    code: 'GR',
    description: 'Highveld temperate grassland, summer rainfall, cold frosty winters',
    color: '#9FC169',
    rainfallPattern: 'summer',
    meanRainfall: '500–900mm',
    keySpecies: ['Buffalo Thorn', 'Wild Olive', 'Highveld Protea', 'Rooigrass', 'Bulbine', 'Wild Garlic'],
    soilType: 'Red/yellow apedal soils, moderate depth, clay-rich on Highveld',
    waterStrategy: 'Heavy summer thunderstorms (short, intense). Keyline design on all slopes — angle swales 1:1000 off true contour to move water across hillside. Winter dry → storage essential. Roof: 1m² = 1L per 1mm rain.',
    soilStrategy: 'Often compacted by livestock. Subsoil aeration before earthworks. Oats/vetch winter cover crops. pH usually 5.5–6.5, add agricultural lime if below 5.5. Build OM with compost + biochar.',
    challenges: ['Hard frosts (–5°C to –10°C)', 'Hail', 'Erodible clay soils on slopes', 'Vlei (wetland) drainage issues'],
  },
  FYNBOS: {
    name: 'Fynbos',
    code: 'FY',
    description: 'SW Cape Mediterranean shrubland, winter rainfall, nutrient-poor soils',
    color: '#C8A476',
    rainfallPattern: 'winter',
    meanRainfall: '350–800mm',
    keySpecies: ['Protea cynaroides', 'Leucadendron', 'Buchu', 'Restio', 'Rooibos', 'Honeybush'],
    soilType: 'Coarse sandy, extremely nutrient-poor, acidic pH 4–5.5',
    waterStrategy: 'Winter rain only → earthworks in late autumn (Mar–May). Small contour bunds + mulch basins. Tank sizing critical for dry summer (Dec–Feb). Greywater for food zones, NOT Fynbos (too rich).',
    soilStrategy: 'DO NOT add compost, lime, or phosphorus to Fynbos zones — kills it. Separate food garden zones built on imported topsoil. Use mulch from Fynbos species. Restios stabilise swales naturally.',
    challenges: ['Fire-cycle dependency (burns every 10–15 years)', 'Invasive aliens (Port Jackson, Hakea, Pines)', 'No edible indigenous Fynbos food plants — zone 1–2 must import soil', 'Dry hot summer'],
  },
  SUCCULENT_KAROO: {
    name: 'Succulent Karoo',
    code: 'SK',
    description: 'W Cape arid zone, winter rainfall, highest plant endemism on Earth',
    color: '#D4956A',
    rainfallPattern: 'winter',
    meanRainfall: '100–250mm',
    keySpecies: ['Mesembryanthemum', 'Aloe ferox', 'Quiver Tree', 'Vygie', 'Lampranthus'],
    soilType: 'Skeletal to sandy, calcareous, very low OC',
    waterStrategy: 'Fog capture viable on W-facing slopes (shade netting). Micro-catchment: raised-rim basins around every plant. Greywater recycling essential. Every 100mm rainfall = precious resource. Small rooftop cisterns.',
    soilStrategy: 'Stone mulch over organic (cheaper, local). Add compost only to food zone. Succulents need drainage not retention. Biochar + gypsum for food beds. Worm farm for concentrated liquid fertiliser.',
    challenges: ['Bone-dry summers', 'Alkaline calcareous soils', 'Very limited palette of food-producing plants', 'Extreme UV and wind'],
  },
  NAMA_KAROO: {
    name: 'Nama-Karoo',
    code: 'NK',
    description: 'Central plateau semi-arid shrubland, erratic summer rainfall',
    color: '#C4A05A',
    rainfallPattern: 'summer',
    meanRainfall: '150–400mm',
    keySpecies: ['Karoo Bush', 'Driedoring', 'Ganna', 'Aloe ferox', 'Wild Olive'],
    soilType: 'Calcareous loams to clay, often with calcrete hardpan',
    waterStrategy: 'Erratic storms → micro-catchment systems on every slope. Semicircular bunds above plants (heuningvlei design). Track basins harvest road runoff. Underground cisterns for dry periods. Every raindrop must be captured.',
    soilStrategy: 'Calcrete hardpan may need breaking for root penetration (chisel plow). Add gypsum not lime (already alkaline). Biochar critical for water retention. Aloe ferox as cash crop on poor soils.',
    challenges: ['Calcrete hardpan', 'High evaporation (ETo often 3× rainfall)', 'Brak (saline) soils in low areas', 'Very limited tree palette'],
  },
  DESERT: {
    name: 'Desert',
    code: 'DE',
    description: 'NW South Africa — Namib/Kalahari fringe, extreme aridity',
    color: '#E8C97A',
    rainfallPattern: 'year-round',
    meanRainfall: '< 100mm',
    keySpecies: ['Camelthorn Acacia', 'Kokerboom', 'Shepherd\'s Tree', 'Nara Melon'],
    soilType: 'Sandy to gravelly, aeolian deposits, very low OC',
    waterStrategy: 'Fog nets (shade cloth) for atmospheric water. Wadi design for flash flood capture. Deep underground cisterns (tanins). Trees as living windbreaks to reduce evaporation. Shade before water.',
    soilStrategy: 'Any organic matter is gold. Manure from goats/camels. Shade trees establish first before any crops. Salt-tolerant species only in low-lying areas. Sand-based wicking beds for vegetables.',
    challenges: ['Extreme heat (45°C+)', 'Flash floods are rare but violent', 'Salt accumulation from evaporation', 'Wind erosion removes topsoil'],
  },
  ALBANY_THICKET: {
    name: 'Albany Thicket',
    code: 'AT',
    description: 'E Cape subtropical thicket, bimodal rainfall, largely degraded by goats',
    color: '#6B8E5C',
    rainfallPattern: 'year-round',
    meanRainfall: '250–600mm',
    keySpecies: ['Spekboom', 'Wild Plum', 'Waterberry', 'Prickly Pear', 'Noors'],
    soilType: 'Red-yellow structured clay loams, good water-holding capacity',
    waterStrategy: 'Bimodal rainfall (some winter + summer). Low swales + contour bunds. Spekboom-based food forest is drought-tolerant and water-efficient. Gravity-fed drip from small tanks. Clay soils: avoid waterlogging.',
    soilStrategy: 'SPEKBOOM is the hero plant: edible, high carbon sequestration, drought-tolerant. Restore degraded thicket with Spekboom truncheons (direct plant, no nursery). Clay soils need good aeration — raised beds for vegetables.',
    challenges: ['Severe degradation from goat overgrazing', 'Dense thorny vegetation', 'Invasive Prickly Pear (control with Cactoblastis moth)', 'Limited water in dry season'],
  },
  IOCB: {
    name: 'Indian Ocean Coastal Belt',
    code: 'IOCB',
    description: 'KZN coast subtropical, year-round high rainfall, humid and lush',
    color: '#5B9E7C',
    rainfallPattern: 'year-round',
    meanRainfall: '700–1200mm',
    keySpecies: ['Natal Wild Banana', 'Wild Plum', 'Natal Mahogany', 'Pigeonwood', 'Fever Tree', 'Sycamore Fig', 'Forest Silver Oak'],
    soilType: 'Ferralitic red clays, leached, acidic pH 4.5–5.5',
    waterStrategy: 'High rainfall = flood management not collection. Swales to slow and spread water on steep KZN slopes. Raised beds prevent waterlogging. Keyline prevents landslides on clay. Downpipes into underground tanks.',
    soilStrategy: 'Leached, acidic — lime to pH 6.5. Nutrients leach rapidly: surface mulch + cover crops essential. Terra preta (biochar + compost) dramatically improves yields. Coffee, avocado, banana, sugar cane all productive here.',
    challenges: ['Cyclone/storm damage', 'Extreme humidity = fungal disease', 'Steep slopes + erosion risk', 'Landslide risk on clay slopes'],
  },
  FOREST: {
    name: 'Afromontane Forest',
    code: 'FOR',
    description: 'High-rainfall forest patches, protected, high biodiversity',
    color: '#3D7A5C',
    rainfallPattern: 'year-round',
    meanRainfall: '800–2000mm',
    keySpecies: ['Yellowwood', 'Cape Holly', 'Wild Peach', 'Stinkwood', 'Outeniqua Yellowwood'],
    soilType: 'Dark, high-OC forest soils, moist, loamy — the best soils in SA',
    waterStrategy: 'Forest creates its own water cycle via fog drip and transpiration. Protect canopy = maintain moisture. Swales at forest margin capture run-off. Spring-fed water from forest is reliable year-round.',
    soilStrategy: 'Rich forest soils — minimal disturbance is the rule. Keyhole beds for vegetables. Sheet mulch with leaf litter. Working WITH forest structure (food forest model) gives best yields. Leave most forest undisturbed.',
    challenges: ['Limited sunlight under dense canopy', 'Legally protected (cannot clear forest)', 'Invasive Lantana and Wattle', 'Slug and snail pressure'],
  },
  OUTSIDE: {
    name: 'Outside South Africa',
    code: 'OUT',
    description: 'Location is outside South African borders',
    color: '#555555',
    rainfallPattern: 'year-round',
    meanRainfall: 'unknown',
    keySpecies: [],
    soilType: 'unknown',
    waterStrategy: 'Select a location within South Africa for site-specific analysis.',
    soilStrategy: 'Select a location within South Africa for site-specific analysis.',
    challenges: [],
  },
  UNCLASSIFIED: {
    name: 'Climate data unavailable',
    code: 'UNK',
    description: 'The site is in South Africa, but its climate data is incomplete',
    color: '#555555',
    rainfallPattern: 'year-round',
    meanRainfall: 'unknown',
    keySpecies: [],
    soilType: 'unknown',
    waterStrategy: 'Retry the site analysis before acting on location-specific water advice.',
    soilStrategy: 'Retry the site analysis before acting on location-specific soil advice.',
    challenges: [],
  },
};

/**
 * site.biome (see biomeClimates in lib/design-elements.ts) stores the human NAME — "Indian Ocean
 * Coastal Belt" — because that's what a farmer reads. lib/species-catalog.ts's SpeciesBiomeFit
 * stores the BIOMES registry KEY — "IOCB" — because that's what a lookup table needs. Nothing
 * converted between the two: the species picker passed the name straight through as if it were
 * the key, so `rankIn` never matched a single species for any farm, in any biome, ever — an empty
 * "Plant Catalog" with no error, indistinguishable from "this biome genuinely has no fruit trees".
 * This is the one place that conversion happens; every other biome-name consumer keeps using the
 * name as it always has (biomeClimates, site.biome itself, anywhere it's shown to a farmer).
 */
export function biomeKeyForName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim().toLowerCase();
  const entry = Object.entries(BIOMES).find(([, b]) => b.name.toLowerCase() === trimmed);
  return entry?.[0];
}

type LonLat = readonly [lon: number, lat: number];

function pointOnSegment(lon: number, lat: number, a: LonLat, b: LonLat): boolean {
  const cross = (lon - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > 1e-10) return false;
  return lon >= Math.min(a[0], b[0]) && lon <= Math.max(a[0], b[0])
    && lat >= Math.min(a[1], b[1]) && lat <= Math.max(a[1], b[1]);
}

function pointInRing(lon: number, lat: number, ring: readonly LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (pointOnSegment(lon, lat, a, b)) return true;
    const crosses = (a[1] > lat) !== (b[1] > lat)
      && lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isWithinSouthAfrica(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return SOUTH_AFRICA_POLYGONS.some(([outer, ...enclaves]) =>
    pointInRing(lon, lat, outer)
    && !enclaves.some((ring) => pointInRing(lon, lat, ring)));
}

export function classifyBiome(
  lat: number,
  lon: number,
  annualRainfall: number,
  coldestMonthTemp: number,
  monthlyRain: number[]
): SABiome {
  if (!isWithinSouthAfrica(lat, lon)) return BIOMES.OUTSIDE;
  if (
    !Number.isFinite(annualRainfall)
    || annualRainfall < 0
    || !Number.isFinite(coldestMonthTemp)
    || !Array.isArray(monthlyRain)
    || monthlyRain.length < 12
    || monthlyRain.slice(0, 12).some((value) => !Number.isFinite(value) || value < 0)
  ) {
    return BIOMES.UNCLASSIFIED;
  }

  // Winter vs summer rainfall dominance
  const summerRain = monthlyRain.slice(0, 3).reduce((a, b) => a + b, 0) +
                     monthlyRain.slice(9, 12).reduce((a, b) => a + b, 0); // DJF + SON
  const winterRain = monthlyRain.slice(5, 8).reduce((a, b) => a + b, 0); // JJA
  const isWinterRainfall = winterRain > summerRain;

  // Desert (Namib fringe, NW)
  if (lon < 17.5 && annualRainfall < 100) return BIOMES.DESERT;

  // Succulent Karoo (W arid coast, winter rainfall)
  if (lon < 21 && isWinterRainfall && annualRainfall < 300) return BIOMES.SUCCULENT_KAROO;

  // Fynbos (SW Cape, winter rainfall, mild)
  if (isWinterRainfall && lat < -32) return BIOMES.FYNBOS;

  // Nama-Karoo (central plateau, low summer rainfall)
  if (lon > 20 && lon < 27 && lat > -32 && lat < -27 && annualRainfall < 400) return BIOMES.NAMA_KAROO;

  // Albany Thicket (E Cape interior)
  if (lat > -34 && lat < -31 && lon > 24.5 && lon < 28 && annualRainfall > 200 && annualRainfall < 700 && !isWinterRainfall) {
    return BIOMES.ALBANY_THICKET;
  }

  // Indian Ocean Coastal Belt (KZN coast)
  if (lon > 30 && lat > -32 && lat < -26 && annualRainfall > 700) return BIOMES.IOCB;

  // Afromontane forest (high rainfall patches)
  if (annualRainfall > 1200 && coldestMonthTemp > 5) return BIOMES.FOREST;

  // Grassland (Highveld, summer rainfall, cool winters)
  if (lat > -32 && lat < -25 && lon > 26 && lon < 32 && annualRainfall > 450 && coldestMonthTemp < 10) {
    return BIOMES.GRASSLAND;
  }
  // Eastern Cape / E Free State grassland
  if (lat > -34 && lat < -28 && lon > 27 && annualRainfall > 400 && coldestMonthTemp < 8) {
    return BIOMES.GRASSLAND;
  }

  // Savanna default for tropical/subtropical summer-rainfall regions
  return BIOMES.SAVANNA;
}

export function aspectLabel(deg: number): string {
  if (!Number.isFinite(deg)) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export function koppenClassify(
  annualRainfall: number,
  meanTemp: number,
  hotMonthTemp: number,
  coldMonthTemp: number,
  summerRain: number,
  winterRain: number
): { code: string; description: string } {
  const values = [annualRainfall, meanTemp, hotMonthTemp, coldMonthTemp, summerRain, winterRain];
  if (
    values.some((value) => !Number.isFinite(value))
    || annualRainfall < 0
    || summerRain < 0
    || winterRain < 0
  ) {
    return { code: '?', description: 'Unknown' };
  }
  const isWinter = winterRain > summerRain;

  // Arid
  if (annualRainfall < 300) {
    if (annualRainfall < 100) return { code: 'BWh', description: 'Hot desert' };
    return { code: 'BSh', description: 'Hot semi-arid steppe' };
  }

  // Tropical
  if (coldMonthTemp > 18) {
    if (annualRainfall > 1500) return { code: 'Af', description: 'Tropical rainforest' };
    return { code: 'Aw', description: 'Tropical savanna' };
  }

  // Temperate (C)
  if (coldMonthTemp > 0 && coldMonthTemp < 18) {
    if (isWinter) return { code: 'Csa', description: 'Mediterranean, hot-summer' };
    if (hotMonthTemp > 22) return { code: 'Cfa', description: 'Humid subtropical' };
    return { code: 'Cwb', description: 'Subtropical highland' };
  }

  // Cold/continental (D)
  if (hotMonthTemp > 10) return { code: 'Dwb', description: 'Cold continental highland' };

  return { code: 'BSk', description: 'Cold semi-arid' };
}
