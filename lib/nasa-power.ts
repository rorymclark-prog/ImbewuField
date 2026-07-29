import type { MonthlyRainfall, ClimateData } from './types';
import { koppenClassify, aspectLabel } from './biome';

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const OPEN_METEO_START_DATE = '1991-01-01';
const OPEN_METEO_END_DATE = '2020-12-31';

function validCoordinates(lat: number, lon: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= -90
    && lat <= 90
    && lon >= -180
    && lon <= 180;
}

/**
 * Turn complete calendar years of daily rainfall into January-first monthly
 * normals. Any missing/duplicate/malformed day rejects the series: treating
 * absent observations as zero would quietly turn an API fault into drought.
 */
export function monthlyNormalsFromDailyRainfall(
  dates: string[],
  values: unknown[],
): number[] | null {
  if (
    !Array.isArray(dates)
    || !Array.isArray(values)
    || dates.length === 0
    || dates.length !== values.length
    || !/^\d{4}-01-01$/.test(dates[0])
    || !/^\d{4}-12-31$/.test(dates[dates.length - 1])
  ) {
    return null;
  }

  const startYear = Number(dates[0].slice(0, 4));
  const endYear = Number(dates[dates.length - 1].slice(0, 4));
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    return null;
  }

  const monthlySum = new Array<number>(12).fill(0);
  const cursor = new Date(Date.UTC(startYear, 0, 1));
  const end = Date.UTC(endYear, 11, 31);
  let index = 0;
  while (cursor.getTime() <= end) {
    const expectedDate = cursor.toISOString().slice(0, 10);
    const value = values[index];
    if (
      dates[index] !== expectedDate
      || typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
    ) {
      return null;
    }
    monthlySum[cursor.getUTCMonth()] += value;
    index += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (index !== dates.length) return null;

  const yearCount = endYear - startYear + 1;
  return monthlySum.map((sum) => Math.round((sum / yearCount) * 10) / 10);
}

/**
 * Fetch 30-year monthly rainfall normals (1991-2020 WMO period) from the
 * Open-Meteo historical archive (ERA5-Land reanalysis, ~9km/0.1° resolution).
 *
 * ERA5-Land is significantly better-resolved than NASA POWER's 50km cells and
 * avoids the ~44% wet bias that POWER exhibits for escarpment sites in KZN.
 * Live comparison for Assegay KZN: Open-Meteo 789mm/yr vs NASA POWER 1406mm/yr
 * vs ground truth ~900mm/yr — the remaining ~12% underestimate is a known ERA5
 * trait (slight smoothing of convective rain) but is far more useful than a 56%
 * overestimate.
 *
 * Returns 12 monthly totals in mm, January-first, or null on any failure.
 */
export async function fetchOpenMeteoRainfall(lat: number, lon: number): Promise<number[] | null> {
  if (!validCoordinates(lat, lon)) return null;
  try {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('start_date', OPEN_METEO_START_DATE);
    url.searchParams.set('end_date', OPEN_METEO_END_DATE);
    url.searchParams.set('daily', 'precipitation_sum');
    url.searchParams.set('timezone', 'UTC');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      // Next.js: cache 30-year climatology indefinitely — it does not change
      next: { revalidate: 2592000 }, // 30 days in seconds
    } as RequestInit);

    if (!res.ok) return null;

    const json = await res.json();
    const dates: unknown = json.daily?.time;
    const values: unknown = json.daily?.precipitation_sum;
    if (
      !Array.isArray(dates)
      || !Array.isArray(values)
      || dates[0] !== OPEN_METEO_START_DATE
      || dates[dates.length - 1] !== OPEN_METEO_END_DATE
    ) {
      return null;
    }
    return monthlyNormalsFromDailyRainfall(dates, values);
  } catch {
    return null;
  }
}

// Vector (circular) mean of compass directions in degrees — correct way to average wind directions
function circularMeanDeg(degs: number[]): number | null {
  if (degs.length === 0) return null;
  const x = degs.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const y = degs.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  if (Math.hypot(x, y) < 1e-9) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export async function fetchNasaPower(lat: number, lon: number): Promise<{
  rainfall: MonthlyRainfall;
  climate: ClimateData;
}> {
  if (!validCoordinates(lat, lon)) throw new Error('Invalid climate coordinates');
  const params = new URLSearchParams({
    parameters: 'PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN,WS2M,WD10M',
    community: 'AG',
    longitude: lon.toFixed(4),
    latitude: lat.toFixed(4),
    format: 'JSON',
  });

  const res = await fetch(
    `https://power.larc.nasa.gov/api/temporal/climatology/point?${params}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`NASA POWER API error: ${res.status}`);
  const data = await res.json();
  const p = data.properties.parameter;

  // NASA POWER climatology returns PRECTOTCORR as an average DAILY rate (mm/day) for each
  // month, and ANN as the annual average daily rate — NOT monthly/annual totals. Convert
  // each month to a monthly total (mm/month) by multiplying by its days, then sum for annual.
  const rainfallRates = p?.PRECTOTCORR;
  if (
    typeof rainfallRates !== 'object'
    || rainfallRates === null
    || MONTH_KEYS.some((key) => {
      const value = rainfallRates[key];
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    })
  ) {
    throw new Error('Incomplete NASA POWER rainfall data');
  }
  const nasaMonthly = MONTH_KEYS.map((key, index) =>
    parseFloat((rainfallRates[key] * DAYS_IN_MONTH[index]).toFixed(1))
  );
  const nasaAnnual = nasaMonthly.reduce((a: number, b: number) => a + b, 0);

  // Fetch Open-Meteo ERA5-Land data in parallel while we process the NASA response.
  // ERA5-Land is at 0.1°/~9km vs NASA POWER's 0.5°/~55km — much better for sites
  // on topographic transitions (escarpments, coastal ranges) where grid-averaging
  // produces severe wet bias in coarser datasets.
  const openMeteoMonthly = await fetchOpenMeteoRainfall(lat, lon);
  const openMeteoAnnual = openMeteoMonthly
    ? openMeteoMonthly.reduce((a, b) => a + b, 0)
    : null;

  // Prefer Open-Meteo when it is available AND disagrees with NASA POWER by > 30%.
  // A >30% divergence almost certainly signals NASA POWER's coarse-grid overestimation
  // (most commonly seen at KZN escarpment sites, Drakensberg foothills, Cape mountains).
  const USE_OPEN_METEO_THRESHOLD = 0.30;
  const shouldUseOpenMeteo =
    openMeteoMonthly !== null &&
    openMeteoAnnual !== null &&
    nasaAnnual > 0 &&
    Math.abs(openMeteoAnnual - nasaAnnual) / nasaAnnual > USE_OPEN_METEO_THRESHOLD;

  const monthly = shouldUseOpenMeteo ? openMeteoMonthly! : nasaMonthly;
  const annual = shouldUseOpenMeteo ? openMeteoAnnual! : nasaAnnual;
  const rainfallSource = shouldUseOpenMeteo ? 'open-meteo' : 'nasa-power';

  // NASA POWER uses -999 as a missing/fill sentinel (common at coastal/ocean taps).
  // Strip these before any reduction so they don't corrupt min/max/mean calculations.
  const clean = (v: unknown): number | null =>
    typeof v === 'number' && v > -900 && Number.isFinite(v) ? v : null;

  // Reduce a POWER parameter object over MONTH_KEYS, applying fn to the clean values.
  // Returns fallback when all values are missing/sentinel.
  const reduceParam = (
    obj: unknown,
    fn: (vals: number[]) => number,
    fallback: number
  ): number => {
    const record = typeof obj === 'object' && obj !== null
      ? obj as Record<string, unknown>
      : {};
    const vals = MONTH_KEYS.map((k) => clean(record[k])).filter((v): v is number => v !== null);
    return vals.length > 0 ? fn(vals) : fallback;
  };

  const monthlyTemp = MONTH_KEYS.map((k) => clean(p.T2M[k]) ?? 20);
  const meanTemp = parseFloat((monthlyTemp.reduce((a: number, b: number) => a + b, 0) / 12).toFixed(1));
  const hotMonthTemp = reduceParam(p.T2M_MAX, (vals) => Math.max(...vals), 25);
  const coldMonthTemp = reduceParam(p.T2M_MIN, (vals) => Math.min(...vals), 5);
  // NASA POWER returns ALLSKY_SFC_SW_DWN in MJ/m²/day — convert to kWh/m²/day (÷3.6) to match labels
  const solarVals = MONTH_KEYS.map((k) => (clean(p.ALLSKY_SFC_SW_DWN[k]) ?? 0) / 3.6);
  const solarRadiation = parseFloat((solarVals.reduce((a: number, b: number) => a + b, 0) / 12).toFixed(1));

  // Wind — mean speed at 2m, and dominant direction (FROM) for summer (DJF) vs winter (JJA)
  const windSpeed = p.WS2M
    ? parseFloat((reduceParam(p.WS2M, (vals) => vals.reduce((s, v) => s + v, 0) / vals.length, 0)).toFixed(1))
    : 0;
  const wd = (keys: string[]) => {
    if (!p.WD10M) return '—';
    const directions = keys
      .map((key) => clean(p.WD10M[key]))
      .filter((value): value is number => value !== null);
    const mean = circularMeanDeg(directions);
    return mean === null ? '—' : aspectLabel(mean);
  };
  const windFromSummer = wd(['DEC', 'JAN', 'FEB']);
  const windFromWinter = wd(['JUN', 'JUL', 'AUG']);

  // Rainfall pattern analysis
  // SA months: Dec(0) Jan(1) Feb(2) = austral summer; Jun(5) Jul(6) Aug(7) = austral winter
  const summerRain = monthly[0] + monthly[1] + monthly[2] + monthly[11]; // DJF + prev D
  const winterRain = monthly[5] + monthly[6] + monthly[7];
  let pattern: 'summer' | 'winter' | 'year-round';
  let wetSeason: string;
  let drySeason: string;

  if (summerRain > winterRain * 2) {
    pattern = 'summer';
    wetSeason = 'Oct–Mar';
    drySeason = 'May–Aug';
  } else if (winterRain > summerRain * 1.5) {
    pattern = 'winter';
    wetSeason = 'May–Sep';
    drySeason = 'Nov–Mar';
  } else {
    pattern = 'year-round';
    wetSeason = 'year-round';
    drySeason = 'none';
  }

  const maxTemp = parseFloat(hotMonthTemp.toFixed(1));
  const minTemp = parseFloat(coldMonthTemp.toFixed(1));
  const { code: koppen, description: koppenDesc } = koppenClassify(
    annual, meanTemp, maxTemp, minTemp, summerRain, winterRain
  );

  return {
    rainfall: { monthly, annual: parseFloat(annual.toFixed(0)), pattern, wetSeason, drySeason, rainfallSource },
    climate: { meanTemp, maxTemp, minTemp, monthlyTemp, solarRadiation, koppen, koppenDesc, windSpeed, windFromSummer, windFromWinter },
  };
}
