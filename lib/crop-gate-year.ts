// "Why not this month?" — the crop planner's climate gate, made visible for one site and one crop.
//
// The automatic planner (lib/crop-autosuggest.ts) silently drops a sowing month when
// lib/crop-climate-gate.ts judges that the crop would grow through a month that is too hot or,
// on a rain-fed plan, too dry. No screen shows that verdict. This module composes the gate's own
// functions into one year of verdicts a figure can draw; it adds no rule and no constant:
//
//   - evaporation:   crop-climate-gate.ts thornthwaitePetMm() — Thornthwaite from mean temperature;
//   - wet months:    crop-climate-gate.ts rainFedGrowingMonths() — rain >= half the evaporation;
//   - the verdict:   crop-climate-gate.ts climateGateFrom() + judgeFieldMonths(), exactly as the
//                    planner builds and calls them (rain check only when the plan is rain-fed);
//   - heat limit:    crop-climate-gate.ts heatLimitOf() — FAO ECOCROP absolute maximum;
//   - field months:  crop-plan.ts occupiedMonthsForPlanting(), the bed hold the planner judges
//                    (crop-autosuggest.ts fieldMonthsOf() gives the same months; the test pins it);
//   - harvest:       crop-plan.ts harvestMonthForCrop() .. harvestEndMonthForCrop();
//   - calendar:      the catalog's regional sowing months for the site's rain pattern. The planner
//                    only asks the gate about those months; any other month it never offers.
//
// What the gate does NOT do, said wherever this is shown: it ignores ECOCROP's optimal maximum
// (that only orders crops, it never refuses one), it carries no stored soil moisture from one
// month to the next, and Thornthwaite under-estimates evaporation in dry, windy climates.

import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import { cropByKey, hasAutomaticPlanningBasis } from '@/lib/crop-catalog';
import {
  climateGateFrom,
  heatLimitOf,
  judgeFieldMonths,
  rainFedGrowingMonths,
  thornthwaitePetMm,
  type GateVerdict,
} from '@/lib/crop-climate-gate';
import { bedEntryMonth, harvestEndMonthForCrop, harvestMonthForCrop, occupiedMonthsForPlanting } from '@/lib/crop-plan';

/** The crops the figure offers: staples and vegetables a summer-rain farm sows in different seasons. */
export const GATE_FIGURE_CROP_KEYS = ['maize', 'dry-beans', 'tomatoes', 'cabbage', 'swiss-chard', 'broad-beans'] as const;

/** The order the year is told in: October first, the same columns as the Water Year above it. */
export const GATE_YEAR_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface GateYearSite {
  /** Monthly rainfall, January first, mm. */
  monthlyRainMm: readonly number[];
  /** Monthly mean air temperature, January first, °C. */
  monthlyTempC: readonly number[];
  latDeg: number;
  /** The site's rain pattern — which regional sowing calendar the planner reads. */
  pattern: RainPattern;
}

export interface ClimateMonth {
  /** Calendar month, 1..12. */
  month: number;
  rainMm: number;
  /** Thornthwaite potential evaporation, mm. */
  petMm: number;
  /** Half of it: the rain a month needs to count as a rain-fed growing month. */
  halfPetMm: number;
  tempC: number;
  /** Rain at least half the evaporation (the gate's own test). */
  rainFed: boolean;
}

export interface SowingVerdict {
  /** Calendar month the seed is sown, 1..12. */
  sowMonth: number;
  /** In the regional sowing calendar — the only months the planner ever asks the gate about. */
  inCalendar: boolean;
  /** Tray month for a transplanted crop (the sowing month; not in the bed, not judged), else null. */
  trayMonth: number | null;
  /** Months the crop holds its bed, in order — what the gate judges. Empty when timing is unknown. */
  fieldMonths: number[];
  /** Months with a harvest, in order (a subset of fieldMonths). */
  harvestMonths: number[];
  /** The gate's verdict for this sowing, with the rain check only on a rain-fed plan. */
  verdict: GateVerdict;
  /** Field months where rain falls short of half the evaporation (counted whatever the plan). */
  dryMonths: number[];
  /** Field months whose mean temperature is above the crop's ECOCROP absolute maximum. */
  hotMonths: number[];
}

export interface HeatHeadroom {
  /** Calendar month (1..12) with the highest mean temperature. */
  hottestMonth: number;
  hottestC: number;
  /** The crop's FAO ECOCROP absolute maximum, °C. */
  limitC: number;
  /** Any month above the limit. */
  binds: boolean;
}

const wrap = (m: number) => ((((m - 1) % 12) + 12) % 12) + 1;

const twelveFinite = (values: readonly number[]): boolean =>
  Array.isArray(values) && values.length === 12 && values.every((v) => typeof v === 'number' && Number.isFinite(v));

function validSite(site: GateYearSite): boolean {
  return twelveFinite(site.monthlyRainMm) && site.monthlyRainMm.every((v) => v >= 0)
    && twelveFinite(site.monthlyTempC)
    && Number.isFinite(site.latDeg) && site.latDeg >= -90 && site.latDeg <= 90;
}

/** The site's year as the gate sees it, January first. Null for unusable input. */
export function climateYear(site: GateYearSite): ClimateMonth[] | null {
  if (!validSite(site)) return null;
  const pet = thornthwaitePetMm(site.monthlyTempC, site.latDeg);
  const wet = rainFedGrowingMonths(site.monthlyRainMm, site.monthlyTempC, site.latDeg);
  return pet.map((petMm, i) => ({
    month: i + 1,
    rainMm: site.monthlyRainMm[i],
    petMm,
    halfPetMm: petMm / 2,
    tempC: site.monthlyTempC[i],
    rainFed: wet[i],
  }));
}

/** The crop's heat limit against the site's hottest month. Null when the crop has no ECOCROP row. */
export function heatHeadroom(crop: Pick<CropDef, 'key'>, site: GateYearSite): HeatHeadroom | null {
  const limit = heatLimitOf(crop);
  if (!limit || !twelveFinite(site.monthlyTempC)) return null;
  let hottest = 0;
  site.monthlyTempC.forEach((t, i) => { if (t > site.monthlyTempC[hottest]) hottest = i; });
  return {
    hottestMonth: hottest + 1,
    hottestC: site.monthlyTempC[hottest],
    limitC: limit.absoluteMax,
    binds: site.monthlyTempC.some((t) => t > limit.absoluteMax),
  };
}

/** Every month from a to b inclusive, wrapping past December. */
function run(a: number, b: number): number[] {
  const out = [a];
  for (let m = a; m !== b && out.length < 12;) { m = wrap(m + 1); out.push(m); }
  return out;
}

/**
 * The gate's verdict for each of the twelve sowing months (index 0 = January), for one crop at
 * one site. `rainFed` is the planner's own switch: true when reliable irrigation was not confirmed.
 * Null for unusable site input.
 */
export function sowingYear(crop: CropDef, site: GateYearSite, rainFed: boolean): SowingVerdict[] | null {
  const year = climateYear(site);
  if (!year) return null;
  const gate = climateGateFrom(
    { siteMonthlyTempC: [...site.monthlyTempC], siteMonthlyRainMm: [...site.monthlyRainMm], siteLatitude: site.latDeg },
    rainFed,
  );
  if (!gate) return null;
  const limit = heatLimitOf(crop);
  const calendar = crop.sowMonths[site.pattern] ?? [];
  return Array.from({ length: 12 }, (_, i) => {
    const sowMonth = i + 1;
    const fieldMonths = occupiedMonthsForPlanting({ cropKey: crop.key, sowMonth });
    const known = fieldMonths.length > 0;
    const harvestSet = known ? new Set(run(harvestMonthForCrop(sowMonth, crop), harvestEndMonthForCrop(sowMonth, crop))) : new Set<number>();
    return {
      sowMonth,
      inCalendar: calendar.includes(sowMonth),
      trayMonth: crop.transplant && known && bedEntryMonth(sowMonth, crop) !== sowMonth ? sowMonth : null,
      fieldMonths,
      harvestMonths: fieldMonths.filter((m) => harvestSet.has(m)),
      verdict: known ? judgeFieldMonths(crop, fieldMonths, gate) : 'ok',
      dryMonths: fieldMonths.filter((m) => !year[m - 1].rainFed),
      hotMonths: limit ? fieldMonths.filter((m) => year[m - 1].tempC > limit.absoluteMax) : [],
    };
  });
}

/** The crops the figure offers, resolved from the catalog (any that fail the planner's basis are left out). */
export function gateFigureCrops(): CropDef[] {
  return GATE_FIGURE_CROP_KEYS
    .map((key) => cropByKey(key))
    .filter((crop): crop is CropDef => !!crop && hasAutomaticPlanningBasis(crop) && !!heatLimitOf(crop));
}

/** Calendar months (1..12) that fall short of half the evaporation, in calendar order. */
export function dryMonthsOf(year: readonly ClimateMonth[]): number[] {
  return year.filter((m) => !m.rainFed).map((m) => m.month);
}
