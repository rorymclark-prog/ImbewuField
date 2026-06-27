import type { MonthlyRainfall, ClimateData } from './types';
import { koppenClassify, aspectLabel } from './biome';

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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
  try {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('start_date', '1991-01-01');
    url.searchParams.set('end_date', '2020-12-31');
    url.searchParams.set('daily', 'precipitation_sum');
    url.searchParams.set('timezone', 'UTC');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      // Next.js: cache 30-year climatology indefinitely — it does not change
      next: { revalidate: 2592000 }, // 30 days in seconds
    } as RequestInit);

    if (!res.ok) return null;

    const json = await res.json();
    const dates: string[] = json.daily?.time;
    const values: (number | null)[] = json.daily?.precipitation_sum;
    if (!dates || !values || dates.length === 0) return null;

    // Accumulate daily mm into 12 monthly buckets across all 30 years,
    // then divide each bucket by 30 to get the average monthly total.
    const monthlySum = new Array<number>(12).fill(0);
    for (let i = 0; i < dates.length; i++) {
      const m = parseInt(dates[i].slice(5, 7), 10) - 1; // 0-indexed month
      const v = values[i];
      if (v !== null && !isNaN(v)) monthlySum[m] += v;
    }

    return monthlySum.map((sum) => Math.round((sum / 30) * 10) / 10);
  } catch {
    return null;
  }
}

// Vector (circular) mean of compass directions in degrees — correct way to average wind directions
function circularMeanDeg(degs: number[]): number {
  const x = degs.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const y = degs.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export async function fetchNasaPower(lat: number, lon: number): Promise<{
  rainfall: MonthlyRainfall;
  climate: ClimateData;
}> {
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
  const nasaMonthly = MONTH_KEYS.map((k, i) =>
    parseFloat((Math.max(0, p.PRECTOTCORR[k] ?? 0) * DAYS_IN_MONTH[i]).toFixed(1))
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
    typeof v === 'number' && v > -900 && !isNaN(v) ? v : null;

  // Reduce a POWER parameter object over MONTH_KEYS, applying fn to the clean values.
  // Returns fallback when all values are missing/sentinel.
  const reduceParam = (
    obj: Record<string, unknown>,
    fn: (vals: number[]) => number,
    fallback: number
  ): number => {
    const vals = MONTH_KEYS.map((k) => clean(obj[k])).filter((v): v is number => v !== null);
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
  const wd = (keys: string[]) => p.WD10M
    ? aspectLabel(circularMeanDeg(keys.map((k) => clean(p.WD10M[k]) ?? 0)))
    : '—';
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
