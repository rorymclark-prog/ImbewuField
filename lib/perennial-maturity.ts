/**
 * lib/perennial-maturity.ts — how far a placed perennial is into cropping, from its species'
 * cited maturity window (lib/species-palette.ts's `yearsToFirstHarvest`/`yearsToFullBearing`)
 * and the calendar year it went, or will go, into the ground (`PlacedItem.plantedYear`).
 *
 * Pure functions only. `now: Date` is always passed in explicitly, never read internally —
 * same discipline as lib/forward-harvests.ts's `now` parameter — so a render and its snapshot
 * (or a test run next year) can't silently disagree.
 *
 * WHAT THIS DELIBERATELY DOES NOT CARRY: no yield, no kg, no price. Just like
 * lib/perennial-produce.ts, this stays a 0..1 fraction of "how mature is this specimen", never
 * an absolute harvest number — Species has no yield field and this file will not invent one.
 *
 * "Cannot estimate" is a real, expected answer here, not an edge case to paper over: most of the
 * catalog has no cited maturity window, and most placed trees have no recorded planting year.
 * Every function below returns null in that case — never a guessed 0, never a guessed "mature".
 */

export interface MaturityInput {
  yearsToFirstHarvest?: number;
  yearsToFullBearing?: number;
  plantedYear?: number;
}

export type MaturityStage = 'not yet bearing' | 'first crops' | 'full bearing';

/** Whole years since planting, or null when the year is unknown or hasn't arrived yet. */
export function ageYears(plantedYear: number | undefined, now: Date): number | null {
  if (plantedYear === undefined || !Number.isFinite(plantedYear)) return null;
  const age = now.getFullYear() - plantedYear;
  // A plantedYear in the future (a plan's target planting date that hasn't happened) isn't in
  // the ground yet — that's "not yet bearing" territory handled by the caller, not a negative age.
  return age >= 0 ? age : null;
}

/**
 * Fraction of full yield this specimen is producing this year, 0..1. Ramps LINEARLY from 0 at
 * yearsToFirstHarvest to 1 at yearsToFullBearing. Real orchard ramp-ups aren't straight lines —
 * this is an honest, stated approximation for a rough on-canvas signal, not a curve precise
 * enough to plan finances against (see lib/crop-plan.ts / lib/forward-harvests.ts, which this
 * module deliberately does not feed).
 *
 * Returns null when the species has no cited window, or the item has no known planting year —
 * never an inferred 0.
 */
export function yieldFraction(species: MaturityInput, now: Date): number | null {
  const { yearsToFirstHarvest, yearsToFullBearing, plantedYear } = species;
  if (yearsToFirstHarvest === undefined || yearsToFullBearing === undefined) return null;
  const age = ageYears(plantedYear, now);
  if (age === null) return null;
  if (age < yearsToFirstHarvest) return 0;
  if (age >= yearsToFullBearing) return 1;
  const span = yearsToFullBearing - yearsToFirstHarvest;
  if (!(span > 0)) return 1; // validateSpecies() rejects this shape; guard rather than divide by 0
  return (age - yearsToFirstHarvest) / span;
}

/** The three-word stage a farmer actually reads, or null when it can't be estimated. */
export function maturityStage(species: MaturityInput, now: Date): MaturityStage | null {
  const frac = yieldFraction(species, now);
  if (frac === null) return null;
  if (frac <= 0) return 'not yet bearing';
  if (frac >= 1) return 'full bearing';
  return 'first crops';
}

/** Short on-canvas label, e.g. "first crops · 4 yrs" — null (render nothing) when unknown. */
export function maturityLabel(species: MaturityInput, now: Date): string | null {
  const stage = maturityStage(species, now);
  if (stage === null) return null;
  const age = ageYears(species.plantedYear, now);
  return age === null ? stage : `${stage} · ${age} yr${age === 1 ? '' : 's'}`;
}
