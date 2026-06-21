import type { MonthlyRainfall, ClimateData } from './types';
import { koppenClassify, aspectLabel } from './biome';

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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
  const monthly = MONTH_KEYS.map((k, i) =>
    parseFloat((Math.max(0, p.PRECTOTCORR[k] ?? 0) * DAYS_IN_MONTH[i]).toFixed(1))
  );
  const annual = monthly.reduce((a: number, b: number) => a + b, 0);
  const monthlyTemp = MONTH_KEYS.map((k) => p.T2M[k] ?? 20);
  const meanTemp = parseFloat((monthlyTemp.reduce((a, b) => a + b, 0) / 12).toFixed(1));
  const hotMonthTemp = Math.max(...MONTH_KEYS.map((k) => p.T2M_MAX[k] ?? 0));
  const coldMonthTemp = Math.min(...MONTH_KEYS.map((k) => p.T2M_MIN[k] ?? 0));
  // NASA POWER returns ALLSKY_SFC_SW_DWN in MJ/m²/day — convert to kWh/m²/day (÷3.6) to match labels
  const solarVals = MONTH_KEYS.map((k) => (p.ALLSKY_SFC_SW_DWN[k] ?? 0) / 3.6);
  const solarRadiation = parseFloat((solarVals.reduce((a, b) => a + b, 0) / 12).toFixed(1));

  // Wind — mean speed at 2m, and dominant direction (FROM) for summer (DJF) vs winter (JJA)
  const windSpeed = p.WS2M ? parseFloat((MONTH_KEYS.reduce((s, k) => s + (p.WS2M[k] ?? 0), 0) / 12).toFixed(1)) : 0;
  const wd = (keys: string[]) => p.WD10M ? aspectLabel(circularMeanDeg(keys.map((k) => p.WD10M[k] ?? 0))) : '—';
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
    rainfall: { monthly, annual: parseFloat(annual.toFixed(0)), pattern, wetSeason, drySeason },
    climate: { meanTemp, maxTemp, minTemp, monthlyTemp, solarRadiation, koppen, koppenDesc, windSpeed, windFromSummer, windFromWinter },
  };
}
