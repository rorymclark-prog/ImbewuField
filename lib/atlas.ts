// Atlas — pure logic for the global garden explorer (app/atlas).
//
// The Atlas lets anyone tap ANY point on Earth and read it against the same
// data layer the farm flow uses (/api/location-data). This module is the thin
// bridge between that response and the two questions the Atlas page answers
// beyond raw data display:
//
//   1. Which of the app's four rainfall patterns does this climate behave like?
//      NOT invented here — it delegates to lib/koppen-global.ts's
//      rainPatternFor, the same published-standard classifier the API itself
//      runs. This file only adapts LocationData's shape into MonthlyClimate.
//
//   2. Which catalog crops have a sowing window open right now under that
//      pattern? A descriptive read of lib/crop-catalog.ts, not advice: the
//      catalog's windows were researched for South Africa, so for a
//      NORTHERN-hemisphere point the calendar is shifted by six months
//      (catalogMonthFor) — October in Beijing is the season April is in
//      Pretoria. The pattern bridge handles climate; this handles the
//      calendar. Both are coarse-model mappings and the UI must say so.
//
// Everything here is pure and synchronous so it can be tested with node:test
// without touching the network or the DOM.

import {
  classifyKoppen,
  rainPatternFor,
  type AtlasRainPattern,
  type KoppenResult,
  type MonthlyClimate,
} from './koppen-global';
import { CROPS, type CropDef, type RainPattern } from './crop-catalog';
import { monthlyTemperatureStatus, recordMinimumC } from './climate-temperature';
import type { LocationData } from './types';

export type { AtlasRainPattern };

/** The slice of LocationData the climate derivation actually needs. */
export type AtlasClimateInput = Pick<LocationData, 'lat'> & {
  rainfall: Pick<LocationData['rainfall'], 'monthly'>;
  climate: Pick<LocationData['climate'], 'monthlyTemp'> & Partial<Pick<LocationData['climate'], 'minTemp' | 'minTempSource' | 'monthlyTempCoverage'>>;
};

/**
 * Adapt a /api/location-data response into the Jan-first monthly climatology
 * that lib/koppen-global.ts reasons over. No arithmetic — both arrays are
 * already Jan-first in LocationData (see lib/nasa-power.ts).
 */
export function monthlyClimateFrom(data: AtlasClimateInput): MonthlyClimate {
  // The record minimum travels with the monthly means so the Atlas and the crop planner
  // read the same point onto the same sowing calendar. Without it a frost-free arid
  // site (Komatipoort) showed the hard-frost column here and the hot-area one in a plan.
  const recordMinC = recordMinimumC(data.climate);
  return {
    tempC: data.climate.monthlyTemp,
    precipMm: data.rainfall.monthly,
    lat: data.lat,
    ...(recordMinC === null ? {} : { recordMinC }),
  };
}

/**
 * Re-derive the Köppen result from the monthly data. This is the SAME
 * classifyKoppen the server ran to produce climate.koppen — same inputs, same
 * function — re-run client-side only because rainPatternFor needs the full
 * KoppenResult (its .group) and the API serialises just the code strings.
 */
export function koppenFrom(data: AtlasClimateInput): KoppenResult {
  return classifyKoppen(monthlyClimateFrom(data));
}

/**
 * Which of the four catalog rainfall patterns this point's climate behaves
 * like. Returns null when the climate data is unusable (Köppen '?') — a
 * pattern guessed from placeholder data would feed a fake crop list.
 */
/**
 * True only when the server's coverage receipt says all twelve monthly temperatures were
 * supplied by the provider AND the twelve values are usable. Anything else is not a set
 * of readings the Atlas may print or classify from:
 *   - 'incomplete': at least one month is a 20 °C display substitute and nothing in the
 *     payload says which (independent review of 11 November 2026, Codex FDR-01);
 *   - no receipt, or a receipt its own values contradict: not verifiable. The route's
 *     fresh answers always carry a receipt, so this is an outage default or an old payload.
 * The Atlas panel then shows no climate type, no sowing calendar and no temperature
 * figure. Rainfall is a separate series and is still shown.
 *
 * This is the panel's display rule. atlasRainPattern below keeps its own, narrower
 * refusal ('incomplete' only), so other callers of that helper are unaffected.
 */
export function atlasTemperaturesRecorded(data: { climate: unknown }): boolean {
  return monthlyTemperatureStatus(data.climate) === 'complete';
}

export function atlasRainPattern(data: AtlasClimateInput): AtlasRainPattern | null {
  // The server fills a month NASA POWER did not supply with 20 °C so the temperature
  // chart can still draw, and marks the year 'incomplete' (lib/nasa-power.ts). Those are
  // display substitutes, not readings: a sowing calendar and a crop list derived from
  // them would be exactly the "fake crop list" this function exists to refuse
  // (independent review of 11 November 2026, Argon F-05). The crop planner already
  // refuses such a year; the Atlas now does too. A payload with no coverage receipt at
  // all (older callers) is treated as before.
  if (monthlyTemperatureStatus(data.climate) === 'incomplete') return null;
  const mc = monthlyClimateFrom(data);
  const koppen = classifyKoppen(mc);
  if (koppen.code === '?') return null;
  return rainPatternFor(mc, koppen);
}

/**
 * Which calendar month to look up in the catalog's sowMonths for this point.
 *
 * The catalog's windows are southern-hemisphere (South African) months. For a
 * northern-hemisphere point the seasons sit six months away, so the lookup
 * month is shifted by six — otherwise the Atlas would report maize as sowable
 * in a Beijing October, which is the opposite end of its real window. The
 * equator (lat 0) is treated as southern, matching summerMonthIndices' tie.
 *
 * @param month 1-12 (the point's actual calendar month)
 * @returns 1-12 (the catalog month to query)
 */
export function catalogMonthFor(month: number, lat: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be 1-12, got ${month}`);
  }
  if (lat >= 0 && Number.isFinite(lat)) return ((month + 5) % 12) + 1;
  return month;
}

/**
 * Catalog crops with a sowing window open in the given (catalog) month under
 * the given pattern. Descriptive, not advisory: it reads the researched
 * windows as-is. A missing kg/m² benchmark does not make a food crop
 * unsowable: that benchmark controls harvest estimates and auto-suggest, not
 * this calendar readout. A timing-unverified legacy window is different: it
 * cannot be presented as open. Zero-food entries such as a green-manure cover
 * are excluded because they are not crops a visitor can expect to harvest.
 *
 * @param month 1-12, already hemisphere-adjusted via catalogMonthFor
 */
export function sowableInMonth(
  pattern: RainPattern,
  month: number,
  crops: readonly CropDef[] = CROPS,
): CropDef[] {
  return crops.filter(
    (c) => c.timingVerified !== false
      && (c.yieldKgPerM2 === null || c.yieldKgPerM2 > 0)
      && (c.sowMonths[pattern] ?? []).includes(month),
  );
}
