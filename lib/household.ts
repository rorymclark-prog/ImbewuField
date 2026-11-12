// How many people a site's water has to serve, and how much each of them uses.
//
// One rule, shared by the Water sheet (components/WaterBalance.tsx) and the Water Year figure
// (components/WaterYear.tsx), so the tank line and the animation can never disagree about the
// household. The survey records adults as a band; each band maps to the whole number of people
// WaterBalance has always used for it.
//
// Note: lib/design-studio.ts still keeps its own older mapping ('6-10' → 8) and 50 L a day for
// its printed summary. That is a separate figure with its own history and is left as it is.

/** Household use per person per day, in litres. */
export const LITRES_PER_PERSON_DAY = 80;

/** Household size used until a site survey says otherwise. */
export const DEFAULT_HOUSEHOLD = 4;

/** People for a survey's adults band ('1' | '2-5' | '6-10' | '10+'); the default when unset. */
export function peopleFromAdults(adults: string | undefined | null): number {
  if (!adults) return DEFAULT_HOUSEHOLD;
  if (adults === '1') return 1;
  if (adults === '2-5') return 3;
  if (adults === '6-10') return 7;
  return 12;
}
