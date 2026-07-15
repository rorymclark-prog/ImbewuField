export interface LatLon { lat: number; lon: number }

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
}

export interface ElevationData {
  elevation: number;
  slopeDeg: number;
  slopePct: number;
  aspectDeg: number;
  aspectLabel: string;
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
  rainfall: MonthlyRainfall;
  climate: ClimateData;
  soil: SoilData;
  elevation: ElevationData;
  vegetation?: VegetationData | null;
  bru?: BruZoneData | null;
  site?: SiteData;
}
