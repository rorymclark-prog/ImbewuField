import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { activeAccountLocalStorageKey } from './account-local-storage';

// Remembers the farmer's most recently analysed site so the global chat
// assistant stays site-aware on every page (not just the map).
const KEY = 'imbewu_last_site';

export interface LastSite {
  locationData: LocationData;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string';
}

function finiteArray(value: unknown, length?: number): value is number[] {
  return Array.isArray(value)
    && (length === undefined || value.length === length)
    && value.every(finite);
}

function textArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

export function isValidLocationData(value: unknown): value is LocationData {
  if (!isRecord(value)) return false;
  const biome = value.biome;
  const rainfall = value.rainfall;
  const climate = value.climate;
  const soil = value.soil;
  const elevation = value.elevation;
  if (!isRecord(biome) || !isRecord(rainfall) || !isRecord(climate)
      || !isRecord(soil) || !isRecord(elevation)) return false;

  return finite(value.lat) && value.lat >= -90 && value.lat <= 90
    && finite(value.lon) && value.lon >= -180 && value.lon <= 180
    && text(biome.name) && text(biome.code) && text(biome.description)
    && text(biome.color) && text(biome.rainfallPattern) && text(biome.meanRainfall)
    && textArray(biome.keySpecies) && text(biome.soilType)
    && text(biome.waterStrategy) && text(biome.soilStrategy) && textArray(biome.challenges)
    && finiteArray(rainfall.monthly, 12) && finite(rainfall.annual)
    && rainfall.annual >= 0 && text(rainfall.pattern)
    && text(rainfall.wetSeason) && text(rainfall.drySeason)
    && finite(climate.meanTemp) && finite(climate.maxTemp) && finite(climate.minTemp)
    && finiteArray(climate.monthlyTemp, 12) && finite(climate.solarRadiation)
    && finite(climate.windSpeed) && text(climate.koppen) && text(climate.koppenDesc)
    && text(climate.windFromSummer) && text(climate.windFromWinter)
    && text(soil.textureClass) && finite(soil.ph) && finite(soil.organicCarbon)
    && finite(soil.clay) && finite(soil.sand) && finite(soil.silt) && finite(soil.bulkDensity)
    && finite(elevation.elevation) && finite(elevation.slopeDeg) && finite(elevation.slopePct)
    && finite(elevation.aspectDeg) && text(elevation.aspectLabel);
}

export function isValidSiteData(value: unknown): value is SiteData {
  return isRecord(value)
    && finite(value.areaM2) && value.areaM2 >= 0
    && finite(value.areaHa) && value.areaHa >= 0
    && finite(value.perimeterM) && value.perimeterM >= 0
    && finite(value.perimeterKm) && value.perimeterKm >= 0;
}

export function isValidWaterData(value: unknown): value is WaterData {
  return isRecord(value)
    && finite(value.count) && value.count >= 0
    && finite(value.areaM2) && value.areaM2 >= 0
    && finite(value.estVolumeKL) && value.estVolumeKL >= 0
    && finite(value.avgDepthM) && value.avgDepthM >= 0;
}

function normaliseLastSite(value: unknown): LastSite | null {
  if (!isRecord(value) || !isValidLocationData(value.locationData)) return null;
  const result: LastSite = { locationData: value.locationData };
  if ('siteData' in value) {
    result.siteData = value.siteData == null ? null : isValidSiteData(value.siteData) ? value.siteData : null;
  }
  if ('waterData' in value) {
    result.waterData = value.waterData == null ? null : isValidWaterData(value.waterData) ? value.waterData : null;
  }
  return result;
}

export function setLastSite(s: LastSite): boolean {
  if (typeof window === 'undefined') return false;
  const safe = normaliseLastSite(s);
  if (!safe) return false;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function getLastSite(): LastSite | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(KEY));
    return raw ? normaliseLastSite(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
