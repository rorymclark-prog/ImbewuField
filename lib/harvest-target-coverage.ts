// The status line of a weekly harvest target card (CP-079, Rory's decision of 11 November 2026).
//
// Its own small module, not part of lib/harvest-targets.ts, because the target panel's
// tests replace that module with an observing wrapper that re-exports only the functions
// they count; plain words and a tolerance do not belong behind that wrapper.

/**
 * 'covered-may-be-early' means the target is met on paper only because of cycles that could
 * be ready before the buyer's window opens: without them it would be short, or a requested
 * month would have no picking window. 'not-assessed' when the basis is missing, so no
 * capacity was worked out.
 */
export type HarvestTargetCoverage = 'not-assessed' | 'short' | 'covered' | 'covered-may-be-early';

/** The card's status line. "On paper": weekly supply is never verified by the planner. */
export const HARVEST_TARGET_COVERAGE_LABEL: Record<Exclude<HarvestTargetCoverage, 'not-assessed'>, string> = {
  short: 'Not covered yet',
  covered: 'Covered on paper',
  'covered-may-be-early': 'Covered on paper, may be early',
};

/** Below this many kilograms a shortfall is rounding, not a gap (the card's own surplus cut-off). */
export const COVERAGE_TOLERANCE_KG = 0.001;
