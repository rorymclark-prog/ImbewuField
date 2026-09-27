// Site-climate checks for the automatic crop planner: a heat limit per crop
// from FAO ECOCROP, and a rain-fed growing-season test from the FAO
// length-of-growing-period rule.
//
// The sowing calendars (lib/crop-catalog.ts) are regional: one column per rain
// pattern. A lowveld site and a cool midlands site can share the 'summer'
// column while their hottest months differ by several degrees. These checks use
// the site's OWN monthly means (NASA POWER T2M, via lib/site-climate.ts) to
// drop a sowing month whose growing months the source says the crop cannot
// take. With no site data they do nothing, so the planner falls back to the
// regional calendar exactly as before.

import type { CropDef } from '@/lib/crop-catalog';

/** Temperature range from FAO ECOCROP, °C.
 *
 * Source: FAO ECOCROP database, as republished in the OpenCLIM EcoCrop_DB.csv
 * (https://raw.githubusercontent.com/OpenCLIM/ecocrop/master/EcoCrop_DB.csv),
 * columns TOPMX (optimal maximum) and TMAX (absolute maximum). ECOCROP's model
 * (Hijmans et al., R package dismo, `ecocrop`) compares these limits with the
 * MONTHLY MEAN air temperature of each growing month: suitability is 1 between
 * TOPMN and TOPMX, falls linearly to 0 at TMAX, and is 0 above it. So a
 * monthly mean above `absoluteMax` is a month ECOCROP rates unsuitable; one
 * above `optimalMax` is a month of reduced growth.
 *
 * Rows used: Zea mays; Phaseolus vulgaris (dry and green beans); Cucurbita
 * moschata (butternut); Cucurbita maxima (pumpkin); Beta vulgaris var. cicla;
 * Brassica oleracea var. acephala (kale), var. capitata (cabbage), var.
 * italica (broccoli); Daucus carota; Beta vulgaris (beetroot); Allium cepa;
 * Solanum lycopersicum; Capsicum annuum (peppers and chilli share the row);
 * Ipomoea batatas; Solanum tuberosum; Lactuca sativa; Colocasia esculenta
 * (amadumbe); Arachis hypogaea; Allium sativum; Pisum sativum; Vicia faba;
 * Cucumis sativus; Citrullus lanatus; Coriandrum sativum; Avena sativa;
 * Spinacia oleracea; Brassica rapa (turnip).
 */
export interface HeatLimitC {
  optimalMax: number;
  absoluteMax: number;
}

export const ECOCROP_HEAT_LIMITS_C: Readonly<Record<string, HeatLimitC>> = {
  maize: { optimalMax: 33, absoluteMax: 47 },
  'dry-beans': { optimalMax: 25, absoluteMax: 32 },
  'green-beans': { optimalMax: 25, absoluteMax: 32 },
  butternut: { optimalMax: 30, absoluteMax: 40 },
  pumpkin: { optimalMax: 30, absoluteMax: 38 },
  'swiss-chard': { optimalMax: 25, absoluteMax: 35 },
  kale: { optimalMax: 22, absoluteMax: 30 },
  cabbage: { optimalMax: 24, absoluteMax: 32 },
  broccoli: { optimalMax: 24, absoluteMax: 35 },
  carrots: { optimalMax: 24, absoluteMax: 30 },
  beetroot: { optimalMax: 25, absoluteMax: 35 },
  onions: { optimalMax: 25, absoluteMax: 30 },
  tomatoes: { optimalMax: 27, absoluteMax: 35 },
  peppers: { optimalMax: 30, absoluteMax: 35 },
  chilli: { optimalMax: 30, absoluteMax: 35 },
  'sweet-potato': { optimalMax: 28, absoluteMax: 38 },
  potato: { optimalMax: 25, absoluteMax: 30 },
  lettuce: { optimalMax: 21, absoluteMax: 30 },
  amadumbe: { optimalMax: 28, absoluteMax: 35 },
  groundnuts: { optimalMax: 32, absoluteMax: 45 },
  garlic: { optimalMax: 30, absoluteMax: 35 },
  peas: { optimalMax: 24, absoluteMax: 30 },
  'broad-beans': { optimalMax: 28, absoluteMax: 32 },
  cucumber: { optimalMax: 32, absoluteMax: 38 },
  watermelon: { optimalMax: 35, absoluteMax: 40 },
  coriander: { optimalMax: 25, absoluteMax: 32 },
  oats: { optimalMax: 20, absoluteMax: 30 },
  'true-spinach': { optimalMax: 20, absoluteMax: 27 },
  turnip: { optimalMax: 17, absoluteMax: 30 },
};

export function heatLimitOf(crop: Pick<CropDef, 'key'>): HeatLimitC | undefined {
  return ECOCROP_HEAT_LIMITS_C[crop.key];
}

const twelveFinite = (values: unknown): values is number[] =>
  Array.isArray(values) && values.length === 12 && values.every((v) => typeof v === 'number' && Number.isFinite(v));

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MID_MONTH_DAY_OF_YEAR = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

/** Mean daylight hours at mid-month. FAO Irrigation & Drainage Paper 56,
 * eqs. 24 (solar declination), 25 (sunset hour angle) and 34 (daylight hours). */
function daylightHours(latDeg: number, month: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const j = MID_MONTH_DAY_OF_YEAR[month - 1];
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * j - 1.39);
  const x = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
  return (24 / Math.PI) * Math.acos(x);
}

/** Monthly potential evapotranspiration, mm, by Thornthwaite (1948), "An
 * approach toward a rational classification of climate", Geographical Review
 * 38(1): 55–94. Months above 26.5 °C use the standard hot-month form
 * PET = −415.85 + 32.24 T − 0.43 T² (Willmott, Rowe & Mintz 1985, J. Climatol.
 * 5: 589–606). Thornthwaite needs only mean temperature, which is all the
 * site record carries; it is known to under-estimate evaporation in dry,
 * windy climates, so the rain-fed plan says so. */
export function thornthwaitePetMm(tempC: readonly number[], latDeg: number): number[] {
  const heatIndex = tempC.reduce((sum, t) => sum + (t > 0 ? (t / 5) ** 1.514 : 0), 0);
  const a = 6.75e-7 * heatIndex ** 3 - 7.71e-5 * heatIndex ** 2 + 1.792e-2 * heatIndex + 0.49239;
  return tempC.map((t, index) => {
    const month = index + 1;
    let unadjusted: number;
    if (t <= 0 || heatIndex <= 0) unadjusted = 0;
    else if (t > 26.5) unadjusted = -415.85 + 32.24 * t - 0.43 * t * t;
    else unadjusted = 16 * ((10 * t) / heatIndex) ** a;
    return unadjusted * (daylightHours(latDeg, month) / 12) * (DAYS_IN_MONTH[index] / 30);
  });
}

/** Which calendar months (index 0 = January) are rain-fed growing months:
 * rainfall at least half the potential evapotranspiration — the FAO
 * Agro-Ecological Zones definition of the growing period (FAO 1978, "Report on
 * the Agro-Ecological Zones Project", World Soil Resources Report 48/1).
 * The AEZ method also carries stored soil moisture past the end of the rains;
 * this check does not, so it can only be stricter than the FAO period. */
export function rainFedGrowingMonths(
  monthlyRainMm: readonly number[],
  tempC: readonly number[],
  latDeg: number,
): boolean[] {
  const pet = thornthwaitePetMm(tempC, latDeg);
  return monthlyRainMm.map((rain, index) => rain >= 0.5 * pet[index]);
}

export interface ClimateGate {
  /** Site monthly mean air temperature, °C, Jan..Dec. */
  tempC?: readonly number[];
  /** Rain-fed growing months, Jan..Dec. Present only for a rain-fed plan. */
  rainFedMonths?: readonly boolean[];
}

export interface SiteClimateAnswers {
  siteMonthlyTempC?: number[];
  siteMonthlyRainMm?: number[];
  siteLatitude?: number;
}

/** Build the gate from planner answers. `rainFed` asks for the rain check too;
 * it returns null when that check cannot be made (no rainfall, temperature or
 * latitude), because a rain-fed plan without it would be a guess. */
export function climateGateFrom(answers: SiteClimateAnswers, rainFed: boolean): ClimateGate | null {
  const tempC = twelveFinite(answers.siteMonthlyTempC) ? answers.siteMonthlyTempC : undefined;
  if (!rainFed) return tempC ? { tempC } : null;
  const rain = answers.siteMonthlyRainMm;
  const lat = answers.siteLatitude;
  if (!tempC || !twelveFinite(rain) || rain.some((v) => v < 0)) return null;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  return { tempC, rainFedMonths: rainFedGrowingMonths(rain, tempC, lat) };
}

/** Calendar months (1..12) a cohort grows through, given its field months as
 * offsets from January (the planner's plannedOccupiedOffsets with nowMonth 1). */
export function calendarMonthsOf(offsetsFromJanuary: readonly number[]): number[] {
  return offsetsFromJanuary.map((offset) => (((offset % 12) + 12) % 12) + 1);
}

export type GateVerdict = 'ok' | 'too-hot' | 'too-dry';

export function judgeFieldMonths(crop: Pick<CropDef, 'key'>, months: readonly number[], gate: ClimateGate): GateVerdict {
  const limit = heatLimitOf(crop);
  if (gate.tempC && limit && months.some((month) => gate.tempC![month - 1] > limit.absoluteMax)) return 'too-hot';
  if (gate.rainFedMonths && months.some((month) => !gate.rainFedMonths![month - 1])) return 'too-dry';
  return 'ok';
}

/** Field months hotter than the crop's optimum — growth slows but ECOCROP
 * still rates the month suitable. */
export function monthsAboveOptimum(crop: Pick<CropDef, 'key'>, months: readonly number[], gate: ClimateGate): number[] {
  const limit = heatLimitOf(crop);
  if (!gate.tempC || !limit) return [];
  return months.filter((month) => gate.tempC![month - 1] > limit.optimalMax);
}
