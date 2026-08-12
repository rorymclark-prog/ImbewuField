export interface LatLon { lat: number; lon: number }

/** Where a site's biome came from. A surveyed polygon on SANBI's national vegetation map and a
 *  guess from rainfall are not the same claim — see lib/biome.ts's resolveBiome. */
export type BiomeSource = 'sanbi' | 'estimated' | 'outside' | 'unavailable';

export interface SABiome {
  name: string;
  code: string;
  description: string;
  color: string;
  rainfallPattern: 'winter' | 'summer' | 'year-round';
  meanRainfall: string;
  keySpecies: string[];
  soilType: string;
  waterStrategy: string;
  soilStrategy: string;
  challenges: string[];
}

export interface MonthlyRainfall {
  monthly: number[];
  annual: number;
  pattern: 'winter' | 'summer' | 'year-round';
  wetSeason: string;
  drySeason: string;
  /** Which data source was used for rainfall figures: 'nasa-power' or 'open-meteo' */
  rainfallSource?: string;
}

export interface ClimateData {
  meanTemp: number;
  maxTemp: number;
  minTemp: number;
  monthlyTemp: number[];
  solarRadiation: number;
  koppen: string;
  koppenDesc: string;
  /** One sentence a grower can act on, from the Köppen class. Optional — stored climate predates it. */
  koppenNote?: string;
  windSpeed: number;        // m/s, annual mean at 2m
  windFromSummer: string;   // compass label wind blows FROM in summer (DJF)
  windFromWinter: string;   // compass label wind blows FROM in winter (JJA)
}

export interface SoilData {
  textureClass: string;
  ph: number;
  organicCarbon: number;
  clay: number;
  sand: number;
  silt: number;
  bulkDensity: number;
  /**
   * Where these numbers came from, BEST FIRST — this is a ranking, not a set.
   *  'lab'       a soil test the farmer uploaded for this site. Outranks
   *              everything: it is the only source that measured THIS ground,
   *              so it must override the model rather than sit beside it.
   *  'soilgrids' ISRIC answered for this point — a model reading an area far
   *              wider than one field. The district, not your soil.
   *  'estimate'  it did not answer, and these are the app's generic defaults.
   *              The same seven numbers anywhere on Earth.
   *
   * WHY THIS FIELD EXISTS. When the ISRIC call fails the route substitutes
   * Loam / pH 6.5 / 1.2% OC and says nothing, so every site reads back identical
   * soil — verified at Ubhejane's own coordinates and at Nairobi on the same
   * day, while elevation, slope, vegetation and the KZN bioresource unit all
   * came back as real site data for the same request. The generated report then
   * printed that constant with `basis: 'SoilGrids model'` beside it, naming a
   * source that had not been consulted, and the 45-page Ubhejane report built
   * its entire soil section and both amendment quantities on top of it.
   * `rainfall` has carried `rainfallSource` all along; soil carried nothing, and
   * that asymmetry is exactly what let a default pass for a reading. Optional so
   * stored sites keep loading — absent means unknown provenance, which is itself
   * worth showing rather than hiding.
   */
  soilSource?: 'lab' | 'soilgrids' | 'estimate';
}

export interface ElevationData {
  elevation: number;
  slopeDeg: number;
  slopePct: number;
  aspectDeg: number;
  aspectLabel: string;
  sampleBaselineM?: number;
  directionConfidence?: 'site-local-indicative' | 'unconfirmed';
}

export interface SiteData {
  areaM2: number;
  areaHa: number;
  perimeterM: number;
  perimeterKm: number;
  count?: number;
  features?: Array<{ name?: string; category?: string; areaHa: number }>;
}

export interface WaterData {
  count: number;
  areaM2: number;
  estVolumeKL: number;
  avgDepthM: number;
  features?: Array<{ name?: string; category?: string; estVolumeKL: number }>;
}

export interface VegetationData {
  vegUnit: string;    // exact SANBI 2018 vegetation unit, e.g. "KwaZulu-Natal Coastal Belt Grassland"
  biome: string;      // SANBI biome, e.g. "Indian Ocean Coastal Belt"
  bioregion: string;
}

export interface BruZoneData {
  brucode: string;        // full zone code, e.g. "STa4a"
  bruParent: string;      // parent BRU code, e.g. "STa4"
  map: number;            // per-zone mean annual rainfall, mm (KZN DARD BRU data)
  tmin: number;           // per-zone mean annual min temp, °C
  tmean: number;          // per-zone mean annual temp, °C
  tmax: number;           // per-zone mean annual max temp, °C
  nearestBrg: string;     // best-effort nearest of the 23 named Bioresource Groups
  isApproximateName: true; // nearestBrg is a climate-similarity heuristic, NOT a verified BRU->BRG crosswalk
  attribution: string;    // source line to display alongside the zone
}

export interface LocationData {
  lat: number;
  lon: number;
  biome: SABiome;
  /** Where `biome` came from — SANBI's national vegetation map, or our climate estimate. A
   *  surveyed polygon and a guess from rainfall are not the same claim; see lib/biome.ts. */
  biomeSource?: BiomeSource;
  rainfall: MonthlyRainfall;
  climate: ClimateData;
  soil: SoilData;
  elevation: ElevationData;
  vegetation?: VegetationData | null;
  bru?: BruZoneData | null;
  site?: SiteData;
}
