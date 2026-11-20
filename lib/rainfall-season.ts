import { completeMonthlyRainfallMm } from './climate-temperature';
import type { LocationData, MonthlyRainfall } from './types';

type RainfallSeason = Pick<MonthlyRainfall, 'pattern' | 'wetSeason' | 'drySeason'>;

/** The existing month-group heuristic, with the local meteorological season name. */
export function rainfallSeasonFromMonthly(monthly: number[], latitude: number): RainfallSeason {
  const decemberToFebruary = monthly[11] + monthly[0] + monthly[1];
  const juneToAugust = monthly[5] + monthly[6] + monthly[7];
  const northernSeasons = latitude >= 0;

  if (decemberToFebruary > juneToAugust * 2) {
    return { pattern: northernSeasons ? 'winter' : 'summer', wetSeason: 'Oct–Mar', drySeason: 'May–Aug' };
  }
  if (juneToAugust > decemberToFebruary * 1.5) {
    return { pattern: northernSeasons ? 'summer' : 'winter', wetSeason: 'May–Sep', drySeason: 'Nov–Mar' };
  }
  return { pattern: 'year-round', wetSeason: 'year-round', drySeason: 'none' };
}

/** Correct old provider labels on cache reads, preserving the stored record. */
export function withLocalRainfallSeason(location: LocationData): LocationData {
  const { rainfall, lat } = location;
  if (!Number.isFinite(lat) || lat < 0 || lat > 90
    || (rainfall?.rainfallSource !== 'nasa-power' && rainfall?.rainfallSource !== 'open-meteo')
    || !completeMonthlyRainfallMm(rainfall.monthly)) return location;

  // A label and both ranges must match the old producer. This also makes the
  // correction idempotent when the device already has the corrected result.
  const prior = rainfallSeasonFromMonthly(rainfall.monthly, -1);
  if (prior.pattern === 'year-round' || rainfall.pattern !== prior.pattern
    || rainfall.wetSeason !== prior.wetSeason || rainfall.drySeason !== prior.drySeason) return location;

  const { pattern } = rainfallSeasonFromMonthly(rainfall.monthly, lat);
  return { ...location, rainfall: { ...rainfall, pattern } };
}
