// One roof, one tank, one household, one year — the day-by-day story behind the Water sheet.
//
// Every number this module returns comes from rules the app already publishes:
//   - roof catch:   lib/roof-runoff.ts roofHarvestLitres() with the one generic coefficient,
//                   WATER_SHEET_ROOF_RUNOFF_COEFFICIENT (0.80, decided 2026-08-02);
//   - household:    80 L per person per day, the same rule components/WaterBalance.tsx uses;
//   - tank sizes:   the standard steps lib/water-calc.ts recommends from;
//   - recommended:  lib/water-calc.ts recommendedTankLitres().
//
// What this module adds is only the bookkeeping between them, and its two assumptions are
// stated wherever its results are shown:
//   1. Inside a month, rain and use are spread evenly over the days. That is exactly consistent
//      with WaterBalance's month-end rule (level + catch − use, clamped to [0, tank]): with a
//      constant net flow the level moves one way all month, so clamping at the moment it hits
//      the top or bottom ends the month on the same value. What the even spread adds is WHEN in
//      the month the tank fills or runs dry, which is what lets the figure count empty days.
//   2. The year starts with whatever the previous September left in the tank, found by running
//      the same year until it repeats — not a guessed "half full" start.
//
// Real month lengths are used (365 days), where WaterBalance's chart uses 30-day months; the
// difference is 1.4% of a year's household use.

import {
  roofHarvestLitres,
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
} from '@/lib/roof-runoff';
import { recommendedTankLitres } from '@/lib/water-calc';

/** Household use per person per day — WaterBalance.tsx's rule. */
export const LITRES_PER_PERSON_DAY = 80;

/** The tank sizes lib/water-calc.ts rounds its recommendation up to. */
export const TANK_SIZES_L = [2500, 5000, 10000, 20000] as const;

/** Calendar month lengths, January first (non-leap year). */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * The order the year is told in: South Africa's hydrological year runs October to September,
 * so the story opens at the end of the dry season and asks whether the tank lasts to the rains.
 */
export const WATER_YEAR_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export interface WaterYearInput {
  /** Rainfall per calendar month, January first, in mm. */
  monthlyMm: readonly number[];
  roofM2: number;
  people: number;
  tankL: number;
  /** Runoff coefficient; defaults to the app's one generic value. */
  coefficient?: number;
  /** Rainfall timing, for the recommended tank size only. */
  pattern?: 'summer' | 'winter' | 'all-year';
}

export interface WaterMonth {
  /** Calendar month index, 0 = January. */
  month: number;
  days: number;
  mm: number;
  /** Litres the roof sends to the tank this month. */
  caughtL: number;
  /** Litres the household wants this month. */
  useL: number;
  startL: number;
  endL: number;
  /** Litres that arrived with nowhere to go (tank full). */
  spilledL: number;
  /** Litres the household wanted after the tank ran dry. */
  shortL: number;
  /** Day of the month (0..days, fractional) the tank reached full, or null. */
  fullAtDay: number | null;
  /** Day of the month (0..days, fractional) the tank ran dry, or null. */
  emptyAtDay: number | null;
  /** Days of this month the tank stood empty. */
  emptyDays: number;
}

export interface WaterYear {
  input: Required<Omit<WaterYearInput, 'pattern'>> & { pattern: WaterYearInput['pattern'] };
  /** Months in water-year order (October first). */
  months: WaterMonth[];
  /** Litres in the tank on 1 October, the level the year repeats from. */
  startL: number;
  caughtL: number;
  useL: number;
  /** Household use the tank actually met. */
  suppliedL: number;
  spilledL: number;
  shortL: number;
  emptyDays: number;
  /** The tank size lib/water-calc.ts would recommend for this roof and rainfall. */
  recommendedTankL: number | null;
  /** Year-on-year repeat found (always true unless the inputs are degenerate). */
  settled: boolean;
}

function finitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function runMonth(month: number, mm: number, startL: number, roofM2: number, people: number, tankL: number, coefficient: number): WaterMonth {
  const days = DAYS_IN_MONTH[month];
  const caughtL = roofHarvestLitres(roofM2, mm, coefficient);
  const useL = people * LITRES_PER_PERSON_DAY * days;
  const net = caughtL - useL;
  const perDay = net / days;
  let endL = startL + net;
  let spilledL = 0;
  let shortL = 0;
  let fullAtDay: number | null = null;
  let emptyAtDay: number | null = null;
  if (endL > tankL) {
    spilledL = endL - tankL;
    fullAtDay = perDay > 0 ? Math.max(0, (tankL - startL) / perDay) : 0;
    endL = tankL;
  } else if (endL < 0) {
    shortL = -endL;
    emptyAtDay = perDay < 0 ? Math.max(0, startL / -perDay) : 0;
    endL = 0;
  }
  const emptyDays = emptyAtDay === null ? 0 : days - emptyAtDay;
  return { month, days, mm, caughtL, useL, startL, endL, spilledL, shortL, fullAtDay, emptyAtDay, emptyDays };
}

function runYear(startL: number, input: WaterYear['input']): WaterMonth[] {
  const out: WaterMonth[] = [];
  let level = startL;
  for (const m of WATER_YEAR_ORDER) {
    const r = runMonth(m, input.monthlyMm[m], level, input.roofM2, input.people, input.tankL, input.coefficient);
    out.push(r);
    level = r.endL;
  }
  return out;
}

/** Simulate one water year, starting from the level the year itself settles to. */
export function waterYear(raw: WaterYearInput): WaterYear | null {
  const coefficient = raw.coefficient ?? WATER_SHEET_ROOF_RUNOFF_COEFFICIENT;
  if (!Array.isArray(raw.monthlyMm) || raw.monthlyMm.length !== 12) return null;
  if (raw.monthlyMm.some((mm) => !Number.isFinite(mm) || mm < 0)) return null;
  if (!finitePositive(raw.roofM2) || !finitePositive(raw.tankL) || !finitePositive(coefficient) || coefficient > 1) return null;
  if (!Number.isFinite(raw.people) || raw.people < 0) return null;
  const input = {
    monthlyMm: raw.monthlyMm,
    roofM2: raw.roofM2,
    people: Math.round(raw.people),
    tankL: raw.tankL,
    coefficient,
    pattern: raw.pattern,
  };

  // Run the same year from an empty tank until 1 October repeats. Each pass is monotone in the
  // start level and clamps at both ends, so it settles within a few years; 50 is a ceiling.
  let start = 0;
  let settled = false;
  for (let i = 0; i < 50; i += 1) {
    const end = runYear(start, input)[11].endL;
    if (Math.abs(end - start) < 0.5) { settled = true; start = end; break; }
    start = end;
  }
  const months = runYear(start, input);
  const sum = (k: keyof WaterMonth) => months.reduce((s, m) => s + (m[k] as number), 0);
  const caughtL = sum('caughtL');
  const useL = sum('useL');
  const shortL = sum('shortL');
  return {
    input,
    months,
    startL: start,
    caughtL,
    useL,
    suppliedL: useL - shortL,
    spilledL: sum('spilledL'),
    shortL,
    emptyDays: sum('emptyDays'),
    recommendedTankL: input.pattern ? recommendedTankLitres(caughtL, input.pattern) : null,
    settled,
  };
}

/** Day of the water year (0 = 1 October) at which each month begins, plus 365 at the end. */
export function monthStarts(): number[] {
  const starts = [0];
  for (const m of WATER_YEAR_ORDER) starts.push(starts[starts.length - 1] + DAYS_IN_MONTH[m]);
  return starts;
}

/** Tank level at a fractional day of the water year (0..365). */
export function levelAtDay(year: WaterYear, day: number): number {
  const starts = monthStarts();
  const d = Math.min(365, Math.max(0, day));
  let i = 0;
  while (i < 11 && d >= starts[i + 1]) i += 1;
  const m = year.months[i];
  const t = d - starts[i];
  const perDay = (m.caughtL - m.useL) / m.days;
  return Math.min(year.input.tankL, Math.max(0, m.startL + perDay * t));
}
