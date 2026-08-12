import type { BiomeSource, SABiome } from './types';
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

/** Kilometres per degree, at South African latitudes. Longitude degrees shorten with latitude. */
const KM_PER_DEG_LAT = 110.9;
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Shortest distance in km from a point to a closed ring, measured on a local flat projection. */
function kmToRing(lat: number, lon: number, ring: readonly LonLat[]): number {
  const kx = kmPerDegLon(lat);
  const px = lon * kx;
  const py = lat * KM_PER_DEG_LAT;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] * kx;
    const ay = ring[j][1] * KM_PER_DEG_LAT;
    const bx = ring[i][0] * kx;
    const by = ring[i][1] * KM_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/**
 * How far outside the national outline a point may sit and still count as South African.
 *
 * SOUTH_AFRICA_POLYGONS is 442 points for the whole country, so the coast is a chain of straight
 * lines up to ~40 km long and the real shoreline wanders either side of them. Port Edward
 * (31.05°S, 30.23°E) — a town, on the KZN south coast — falls 800 m outside it and was being told
 * "Location is outside South African borders", which is not a wrong biome but NO analysis at all:
 * no rainfall, no soil, no species, nothing. Every coastal farm sits somewhere in that error bar.
 *
 * The asymmetry is the point. Admitting a boat 3 km offshore costs a farmer nothing; refusing a
 * farm on the beach costs them the entire app.
 */
const BORDER_TOLERANCE_KM = 3;

export function isWithinSouthAfrica(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return SOUTH_AFRICA_POLYGONS.some(([outer, ...enclaves]) => {
    // Enclaves (Lesotho, Eswatini) are checked STRICTLY — the tolerance only ever grows the
    // national outline outwards, never shrinks a neighbour's country to hand us its farms.
    if (enclaves.some((ring) => pointInRing(lon, lat, ring))) return false;
    return pointInRing(lon, lat, outer) || kmToRing(lat, lon, outer) <= BORDER_TOLERANCE_KM;
  });
}

/**
 * The east and south coastline, Kosi Bay to Cape Agulhas, as a coarse polyline.
 *
 * Coarse ON PURPOSE. This exists to answer "how far from the sea is this farm" to within a few
 * kilometres so a 45 km belt can be drawn; it is not a shoreline for mapping and must never be
 * used as one. Points are ~40–90 km apart along a coast with no deep inlets at this scale.
 *
 * A polyline rather than SOUTH_AFRICA_POLYGONS' outer ring, which also contains the Namibian,
 * Botswanan, Zimbabwean and Mozambican land borders — distance to that ring would call a farm on
 * the Limpopo border "coastal".
 */
const EAST_COAST: readonly LonLat[] = [
  [32.89, -26.85], // Kosi Bay
  [32.55, -27.60],
  [32.42, -28.37], // St Lucia
  [32.09, -28.80], // Richards Bay
  [31.75, -29.20], // Mtunzini
  [31.40, -29.52], // Ballito
  [31.05, -29.87], // Durban
  [30.72, -30.30], // Scottburgh
  [30.45, -30.62], // Port Shepstone
  [30.23, -31.05], // Port Edward
  [29.54, -31.63], // Port St Johns
  [29.15, -31.99], // Coffee Bay
  [28.35, -32.60], // Mbashe
  [27.91, -33.02], // East London
  [26.89, -33.60], // Port Alfred
  [25.60, -33.96], // Gqeberha
  [24.00, -34.10], // Tsitsikamma
  [22.14, -34.18], // Mossel Bay
  [20.02, -34.83], // Cape Agulhas
];

/** Shortest distance in km from (lat, lon) to the coastline polyline above. */
export function kmFromEastCoast(lat: number, lon: number): number {
  const kx = kmPerDegLon(lat);
  const px = lon * kx;
  const py = lat * KM_PER_DEG_LAT;
  let best = Infinity;
  for (let i = 1; i < EAST_COAST.length; i++) {
    const ax = EAST_COAST[i - 1][0] * kx;
    const ay = EAST_COAST[i - 1][1] * KM_PER_DEG_LAT;
    const bx = EAST_COAST[i][0] * kx;
    const by = EAST_COAST[i][1] * KM_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    // Clamp to the segment so the nearest point is on the coast, not on its infinite extension.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    best = Math.min(best, Math.hypot(px - cx, py - cy));
  }
  return best;
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

  // Nama-Karoo (central plateau, low summer rainfall).
  //
  // The southern bound was -32, which cut the Great Karoo in half: Beaufort West sits at -32.36,
  // failed this rule by a third of a degree, matched nothing after it and came out as SAVANNA —
  // a farm in 230 mm of Karoo being handed lowveld advice.
  if (lon > 20 && lon < 27 && lat > -33.5 && lat < -26 && annualRainfall < 400) return BIOMES.NAMA_KAROO;

  // Albany Thicket (E Cape interior)
  if (lat > -34 && lat < -31 && lon > 24.5 && lon < 28 && annualRainfall > 200 && annualRainfall < 700 && !isWinterRainfall) {
    return BIOMES.ALBANY_THICKET;
  }

  // Indian Ocean Coastal Belt — a BELT, measured from the sea.
  //
  // This was `lon > 30 && lat > -32 && lat < -26 && annualRainfall > 700`, which is not a coastal
  // belt: it is the eastern third of the country with no distance to the sea in it. It put
  // Ubhejane (27.73°S, 31.96°E, ~70 km inland, Zululand lowveld → Savanna) on the coast, and it
  // caught the whole KZN midlands too — Howick is 30.2°E with ~900 mm, which is Grassland.
  //
  // The real belt is a narrow low strip that runs from the Mozambique border to about the Great
  // Kei, widening to ~50 km around the Zululand plain and pinching to a few km on the Pondoland
  // scarp. So: near the coastline, low, wet, and north of the Eastern Cape thicket.
  if (
    lat < -26.5 && lat > -33.2
    && kmFromEastCoast(lat, lon) < 45
    && annualRainfall > 700
  ) {
    return BIOMES.IOCB;
  }

  // Afromontane forest (high rainfall patches)
  if (annualRainfall > 1200 && coldestMonthTemp > 5) return BIOMES.FOREST;

  // Grassland — the high interior plateau, the KZN midlands and the Eastern Cape highlands.
  //
  // Two rules used to do this and both were too cold to fire. The Highveld one wanted a coldest
  // month under 10°C and the Eastern Cape one under 8°C, so Johannesburg (11°C), Pietermaritzburg
  // (13°C), Howick (12°C) and Mthatha (10°C) all fell past them to the SAVANNA default. Four of
  // the biggest grassland centres in the country, called lowveld.
  //
  // What actually separates grassland from savanna here is ALTITUDE, which this function is not
  // given. The usable proxies are latitude — savanna proper is the low north, above about 25.5°S —
  // and a coldest month cool enough to frost, which the lowveld's 16–17°C never is. Polokwane
  // (11°C, but at 23.9°S) stays Savanna on the latitude term; Mkuze (31.96°E and wet, but 16°C)
  // stays Savanna on the temperature one.
  if (lat < -25.5 && lon > 25.5 && annualRainfall > 400 && coldestMonthTemp < 14) {
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

// ── SANBI IS THE AUTHORITY. THE HEURISTIC IS THE FALLBACK. ─────────────────────────────────────
//
// Rory, 12 August, looking at a site report for Ubhejane at 27.73°S 31.96°E: "Is Indian Ocean
// coastal belt correct here" — no. That point is ~70 km inland in the Zululand lowveld, which is
// Savanna. The report said IOCB while its own next two lines said "Zululand Lowveld" and "Valley
// Bushveld", both Savanna. Then: "how do I know once it's sent out".
//
// THE ANSWER WAS ALREADY IN THE RESPONSE. app/api/location-data fetches SANBI's official 2018
// National Vegetation Map (lib/sanbi.ts) on every request, and that returns the biome for the
// exact coordinate — the national authority, polygon-accurate. classifyBiome ignored it and ran a
// hand-drawn lat/lon rectangle instead, which for IOCB was `lon > 30 && lat > -32 && lat < -26 &&
// rain > 700`: not a coastal belt but the whole eastern third of the country, with no distance to
// the sea in it anywhere.
//
// So the order is now: SANBI first, heuristic only when SANBI is unreachable or has no polygon —
// and when the heuristic is used, the caller is TOLD, so an estimate can be labelled as one
// instead of sitting on the page looking like a survey.

/**
 * SANBI's 2018 biome names -> our registry keys.
 *
 * Matched on a normalised prefix rather than equality: the layer spells some of them with
 * qualifiers ("Indian Ocean Coastal Belt", "Forests", "Azonal Vegetation" variants), and a
 * near-miss must fall through to the heuristic rather than silently become Savanna.
 */
const SANBI_BIOME_TO_KEY: ReadonlyArray<readonly [match: RegExp, key: string]> = [
  [/^indian ocean coastal belt/, 'IOCB'],
  [/^succulent karoo/, 'SUCCULENT_KAROO'],
  [/^nama[- ]karoo/, 'NAMA_KAROO'],
  [/^albany thicket/, 'ALBANY_THICKET'],
  [/^grassland/, 'GRASSLAND'],
  [/^savanna/, 'SAVANNA'],
  [/^fynbos/, 'FYNBOS'],
  [/^desert/, 'DESERT'],
  [/^forest/, 'FOREST'],
];

/**
 * The biome SANBI reports for this point, or undefined if it said nothing we recognise.
 *
 * Azonal vegetation (rivers, wetlands, coastal dunes) is deliberately NOT mapped: it is a
 * cross-cutting class that sits inside every biome, so translating it into one would be an
 * invention. Those points fall through to the heuristic, which is what it is for.
 */
export function biomeFromSanbi(sanbiBiome?: string | null): SABiome | undefined {
  if (typeof sanbiBiome !== 'string') return undefined;
  const name = sanbiBiome.trim().toLowerCase();
  if (!name) return undefined;
  const hit = SANBI_BIOME_TO_KEY.find(([match]) => match.test(name));
  return hit ? BIOMES[hit[1]] : undefined;
}

export interface ResolvedBiome {
  biome: SABiome;
  /**
   * Where the answer came from. A farmer being told their farm is Savanna deserves to know
   * whether that is the national vegetation map or our climate guess — the two are not the same
   * claim, and until now they were printed identically.
   */
  source: BiomeSource;
}

/**
 * The one function callers should use.
 *
 * SANBI wins whenever it answers. The climate heuristic runs only when it does not, and says so.
 */
export function resolveBiome(opts: {
  lat: number;
  lon: number;
  annualRainfall: number;
  coldestMonthTemp: number;
  monthlyRain: number[];
  sanbiBiome?: string | null;
}): ResolvedBiome {
  if (!isWithinSouthAfrica(opts.lat, opts.lon)) return { biome: BIOMES.OUTSIDE, source: 'outside' };

  const fromSanbi = biomeFromSanbi(opts.sanbiBiome);
  if (fromSanbi) return { biome: fromSanbi, source: 'sanbi' };

  const guess = classifyBiome(
    opts.lat, opts.lon, opts.annualRainfall, opts.coldestMonthTemp, opts.monthlyRain,
  );
  if (guess === BIOMES.UNCLASSIFIED) return { biome: guess, source: 'unavailable' };
  return { biome: guess, source: 'estimated' };
}
