// Rain-tank sizing — pure agronomy, no I/O. Given a site's 30-year monthly rainfall normals,
// a roof catchment area and a daily draw, work out how much water the roof banks in the wet
// months and how much storage is needed to carry that water across the dry season.
//
// The model, and where it is deliberately honest about its limits (SRTM-style: say what the
// number can and can't tell you):
//
//  • Catchment:  1 mm of rain on 1 m² of roof = exactly 1 litre. So gross litres = mm × m².
//  • Runoff:     we keep 0.85 of that. The lost 15% is first-flush diversion, wind splash,
//                gutter overshoot and evaporation off a hard roof (corrugated iron / tile sit
//                around 0.8–0.9). A THATCH or soft roof harvests far less — treat 0.85 as an
//                optimistic ceiling for a metal roof, not a promise.
//  • Rainfall:   these are NORMALS (a typical year, e.g. NASA POWER 1991–2020). A real drought
//                year catches less, so size UP for resilience — the number is the median case.
//  • Demand:     daily use is assumed flat year-round (no summer irrigation spike is modelled).
//  • Overflow:   wet-season "catch" is the theoretical maximum. Once a tank is full, extra storm
//                water overflows and is lost — so you rarely bank the full wet-season figure.
//  • Calendar:   monthlyRainfallMm is Jan..Dec; month lengths are real (non-leap) day counts.

export interface TankSizingInput {
  /** 12 monthly rainfall totals in mm, indexed Jan(0)..Dec(11) — from LocationData.rainfall.monthly. */
  monthlyRainfallMm: number[];
  /** Roof / catchment footprint in square metres. */
  roofAreaM2: number;
  /** Daily water draw in litres. */
  dailyUseL: number;
}

export interface TankSizingResult {
  /** False when the inputs can't produce a real answer (no rainfall data, non-positive roof/use). */
  ok: boolean;
  /** Whole-year roof catch, litres (all 12 months, after runoff). */
  annualHarvestL: number;
  /** Litres the roof catches during the wet months (the year minus the dry run). */
  wetSeasonHarvestL: number;
  /** Total litres the household draws in a year. */
  annualUseL: number;
  /** Length of the longest consecutive dry run (months where catch < use), wrapping Dec→Jan. */
  dryMonths: number;
  /** Cumulative shortfall (use − catch) summed across that dry run, litres. */
  dryRunShortfallL: number;
  /** Recommended storage to bridge the dry run, litres (the shortfall, clamped sensibly). */
  recommendedStorageL: number;
  /** True when the roof simply can't meet annual demand — a tank helps but can't close the gap. */
  waterNegative: boolean;
  /** Friendly JoJo-tank combo covering the recommended storage, e.g. "1× 10 000 ℓ + 1× 2 500 ℓ JoJo". */
  jojoSuggestion: string;
  /** One-line plain-English takeaway. */
  summary: string;
}

const RUNOFF_COEFFICIENT = 0.85;
// Real (non-leap) month lengths, Jan..Dec — demand scales with days in the month.
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const JOJO_SIZES = [10000, 5000, 2500] as const;

/** Group an integer's digits with a thin space every 3 (locale-free): 10000 → "10 000". */
function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Round to the nearest 100 litres — tanks and estimates don't deserve false precision. */
function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

/**
 * Suggest the cheapest JoJo combo (from 2 500 / 5 000 / 10 000 ℓ tanks) that covers `litres`.
 * Minimises total installed capacity first, then tank count. Returns a buffer tank for ~0.
 */
export function suggestJojoTanks(litres: number): string {
  if (!Number.isFinite(litres) || litres <= 0) return '1× 2 500 ℓ JoJo (buffer)';

  let best: { tens: number; fives: number; small: number; total: number; count: number } | null = null;
  const maxTens = Math.ceil(litres / JOJO_SIZES[0]) + 1;
  // fives/small only ever fill the sub-10 000 ℓ remainder, so 0..2 of each spans it in 2 500 ℓ steps.
  for (let tens = 0; tens <= maxTens; tens++) {
    for (let fives = 0; fives <= 2; fives++) {
      for (let small = 0; small <= 2; small++) {
        const count = tens + fives + small;
        if (count === 0) continue;
        const total = tens * 10000 + fives * 5000 + small * 2500;
        if (total < litres) continue;
        if (!best || total < best.total || (total === best.total && count < best.count)) {
          best = { tens, fives, small, total, count };
        }
      }
    }
  }
  if (!best) return '1× 2 500 ℓ JoJo (buffer)';

  const parts: string[] = [];
  if (best.tens) parts.push(`${best.tens}× 10 000 ℓ`);
  if (best.fives) parts.push(`${best.fives}× 5 000 ℓ`);
  if (best.small) parts.push(`${best.small}× 2 500 ℓ`);
  return `${parts.join(' + ')} JoJo`;
}

/** Longest run of consecutive dry months (catch < use), allowed to wrap Dec→Jan. */
function longestDryRun(isDry: boolean[]): { length: number; months: Set<number> } {
  const n = isDry.length;
  if (isDry.every((d) => d)) return { length: n, months: new Set(isDry.map((_, i) => i)) };
  if (isDry.every((d) => !d)) return { length: 0, months: new Set() };

  let bestLen = 0;
  let bestStart = -1;
  let runLen = 0;
  let runStart = 0;
  // Scan the doubled array so a run straddling the year boundary is seen whole; cap at n.
  for (let i = 0; i < n * 2; i++) {
    const idx = i % n;
    if (isDry[idx]) {
      if (runLen === 0) runStart = idx;
      runLen = Math.min(runLen + 1, n);
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
    } else {
      runLen = 0;
    }
  }
  const months = new Set<number>();
  for (let k = 0; k < bestLen; k++) months.add((bestStart + k) % n);
  return { length: bestLen, months };
}

export function computeTankSizing(input: TankSizingInput): TankSizingResult {
  const { monthlyRainfallMm, roofAreaM2, dailyUseL } = input;

  const empty: TankSizingResult = {
    ok: false,
    annualHarvestL: 0,
    wetSeasonHarvestL: 0,
    annualUseL: 0,
    dryMonths: 0,
    dryRunShortfallL: 0,
    recommendedStorageL: 0,
    waterNegative: false,
    jojoSuggestion: '',
    summary: '',
  };

  const validRain =
    Array.isArray(monthlyRainfallMm) &&
    monthlyRainfallMm.length === 12 &&
    monthlyRainfallMm.some((v) => Number.isFinite(v) && v > 0);
  if (!validRain || !Number.isFinite(roofAreaM2) || roofAreaM2 <= 0 || !Number.isFinite(dailyUseL) || dailyUseL <= 0) {
    return empty;
  }

  const monthlyHarvestL = monthlyRainfallMm.map((mm) => (Number.isFinite(mm) && mm > 0 ? mm : 0) * roofAreaM2 * RUNOFF_COEFFICIENT);
  const monthlyUseL = DAYS_IN_MONTH.map((days) => days * dailyUseL);

  const annualHarvestL = monthlyHarvestL.reduce((a, b) => a + b, 0);
  const annualUseL = monthlyUseL.reduce((a, b) => a + b, 0);

  const isDry = monthlyHarvestL.map((h, i) => h < monthlyUseL[i]);
  const { length: dryMonths, months: dryMonthSet } = longestDryRun(isDry);

  // Storage must bank enough in the wet months to cover every deficit litre through the dry run.
  let dryRunShortfallL = 0;
  for (const i of dryMonthSet) dryRunShortfallL += monthlyUseL[i] - monthlyHarvestL[i];
  dryRunShortfallL = Math.max(0, dryRunShortfallL);

  // What the roof banks during the wet (non-dry-run) months — the water available to store.
  const wetSeasonHarvestL = monthlyHarvestL.reduce((sum, h, i) => (dryMonthSet.has(i) ? sum : sum + h), 0);

  const waterNegative = annualHarvestL < annualUseL;
  // Never recommend storing more than a year's use — beyond that the bottleneck is catchment, not tanks.
  const recommendedStorageL = round100(Math.min(dryRunShortfallL, annualUseL));
  const jojoSuggestion = suggestJojoTanks(recommendedStorageL);

  const roofTxt = `${groupThousands(roofAreaM2)} m²`;
  const useTxt = `${groupThousands(dailyUseL)} ℓ/day`;
  let summary: string;
  if (dryMonths === 0) {
    summary = `Your ${roofTxt} roof out-catches ${useTxt} every month — no real dry gap. A small ${jojoSuggestion} buffer smooths the odd dry week.`;
  } else if (waterNegative) {
    summary = `Your ${roofTxt} roof catches only ~${groupThousands(round100(annualHarvestL))} ℓ a year — under the ~${groupThousands(round100(annualUseL))} ℓ that ${useTxt} needs. A tank helps but can't close the gap: cut use or add catchment.`;
  } else {
    summary = `Your ${roofTxt} roof banks ~${groupThousands(round100(wetSeasonHarvestL))} ℓ in the wet season — store ~${groupThousands(recommendedStorageL)} ℓ (${jojoSuggestion}) to water ${useTxt} through the ~${dryMonths} dry month${dryMonths === 1 ? '' : 's'}.`;
  }

  return {
    ok: true,
    annualHarvestL: round100(annualHarvestL),
    wetSeasonHarvestL: round100(wetSeasonHarvestL),
    annualUseL: round100(annualUseL),
    dryMonths,
    dryRunShortfallL: round100(dryRunShortfallL),
    recommendedStorageL,
    waterNegative,
    jojoSuggestion,
    summary,
  };
}
