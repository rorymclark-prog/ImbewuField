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
  count?: number;  // number of land parcels drawn (optional — report can ignore)
}

export interface WaterData {
  count: number;        // number of storage features drawn
  areaM2: number;       // total surface area
  estVolumeKL: number;  // estimated capacity (area × ~1.5m avg depth), in kilolitres
  avgDepthM: number;    // depth assumption used for the estimate
}

export interface VegetationData {
  vegUnit: string;    // exact SANBI 2018 vegetation unit, e.g. "KwaZulu-Natal Coastal Belt Grassland"
  biome: string;      // SANBI biome, e.g. "Indian Ocean Coastal Belt"
  bioregion: string;
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
  site?: SiteData;
}
