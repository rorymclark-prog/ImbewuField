// Local (farmer-observed) wind — the on-site confirm/override layer for the regional wind and
// fire tables in lib/regional-wind.ts.
//
// WHY A SEPARATE FILE rather than folding this into lib/regional-wind.ts: that file's own
// docblock is explicit — "EVERYTHING HERE IS 'regional-assumption', NEVER 'computed'"
// (lib/regional-wind.ts:3) — and an observation a farmer paced out on their own land is neither
// of those; it doesn't belong inside a file whose entire contract is "sourced literature only".
// This mirrors the existing split between lib/design-canvas.ts (ZoneShape.measuredSlopePct — the
// farmer's own field measurement, a plain data field) and lib/terracing.ts
// (effectiveSlopeForRing — the resolver that decides which of {measured, regional} wins and
// tags the result with its source). Same shape here: the observation type lives with the rest of
// the design-canvas state shape (lib/design-canvas.ts), lib/regional-wind.ts stays pure literature
// data, and THIS file is the resolver in between — importing only TYPES from its neighbours
// (mirrors lib/terracing.ts's `import type { ZoneShape } … import type { SectorSite } …`), never
// their runtime code, so it stays a fully standalone, trivially testable leaf module.
//
// Pure, no DOM; lib/ never imports components/ (same rule as lib/sector.ts, lib/terracing.ts).

// 16-point, not 8: the regional tables this resolver sits in front of already speak 16-point
// compass labels at 22.5° resolution (lib/regional-wind.ts's KZN_BERG etc. use 'NW', 'SW', …, and
// lib/sector.ts's COMPASS_BEARING table is keyed the same way). An 8-point (45°-bucket) farmer
// answer would force someone standing between two of those labelled sectors to round away the
// exact distinction the confirm/override workflow exists to capture (e.g. NW vs NNW against the
// 315°±25° berg wedge) — a real loss of precision for no simplicity gained, since a compass-rose
// or list UI is exactly as easy to build/tap at 16 points as at 8.
export type CompassDirection16 =
  | 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'SSE'
  | 'S' | 'SSW' | 'SW' | 'WSW' | 'W' | 'WNW' | 'NW' | 'NNW';

// Ordered clockwise from N — the order any compass-rose/list UI should render them in, and the
// single source of truth for "is this string actually one of the 16 points" (isCompassDirection16
// below), so a UI and a validity check can never silently disagree about the allowed set.
export const COMPASS16_ORDER: readonly CompassDirection16[] = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const COMPASS16_BEARING: Record<CompassDirection16, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** Runtime guard for a string coming from outside the closed union (e.g. a regional table's
 *  `fromLabel: string`, or a value read back out of storage) — never trust a cast alone. */
export function isCompassDirection16(label: string): label is CompassDirection16 {
  return (COMPASS16_ORDER as readonly string[]).includes(label);
}

/** The farmer's own on-site wind observation. Optional on DesignCanvasState (lib/design-canvas.ts)
 *  — absent by default, JSON-safe, and must survive migrateStateToFrame's spread untouched, same
 *  reasoning as ZoneShape.measuredSlopePct. Deliberately NO free-text field: a farmer picks from
 *  the 16 points (compass rose / list UI), never types a bearing — see CompassDirection16 above. */
export interface LocalWindObservation {
  /** Where the farmer says the wind USUALLY comes from on their own land — the everyday/prevailing
   *  direction, confirming or correcting the regional table's ordinary (e.g. summer-cooling)
   *  entry. Required: this is the primary question the confirm/override workflow asks. */
  prevailingFrom: CompassDirection16;
  /** Where the farmer says their STRONGEST or most damaging wind comes from, when it differs from
   *  the everyday one (e.g. an occasional berg-type wind that does the real damage even though
   *  it isn't what blows most days) — feeds the fire-direction override specifically
   *  (effectiveFireWind below). Optional: most farmers will only have one answer, and this field
   *  must never be inferred from prevailingFrom (see effectiveFireWind's own comment). */
  strongestFrom?: CompassDirection16;
  /** ISO timestamp of when this was recorded. An observation is a moment, not a permanent fact —
   *  keeping the date is what lets a future re-confirm flow age it out or ask again, and lets the
   *  sheet print "confirmed on site, <date>" rather than an undated assertion. */
  recordedAt: string;
}

export type WindProvenance = 'observed on site' | 'regional estimate';

/** What any consumer should actually print: a direction, its bearing, and — always — which of the
 *  two the farmer is looking at. Mirrors lib/terracing.ts's EffectiveSlope shape/spirit exactly
 *  (`{ pct, source }`), just for a direction instead of a percentage. */
export interface EffectiveWind {
  fromLabel: string;
  bearingDeg: number;
  provenance: WindProvenance;
}

/** A regional fact this resolver can be asked to confirm/override — deliberately the minimal
 *  shape (not a full NamedWindSector/RegionalFireSector) so this file never needs a runtime import
 *  from lib/regional-wind.ts or lib/sector.ts; callers pass whichever regional bearing+label they
 *  already have (e.g. a NamedWindSector, or SectorModel['fire']). */
export interface RegionalWindFact {
  fromLabel: string;
  bearingDeg: number;
}

function fromObservedDirection(direction: CompassDirection16 | undefined): EffectiveWind | null {
  if (!direction) return null;
  return { fromLabel: direction, bearingDeg: COMPASS16_BEARING[direction], provenance: 'observed on site' };
}

function fromRegionalFact(regional: RegionalWindFact | null | undefined): EffectiveWind | null {
  if (!regional) return null;
  return { fromLabel: regional.fromLabel, bearingDeg: regional.bearingDeg, provenance: 'regional estimate' };
}

/** Resolves the wind direction a consumer should actually use and print, for the general/everyday
 *  ("prevailing") question:
 *  1. observation.prevailingFrom, when present — 'observed on site'.
 *  2. `regional`, the regional table's own entry for the same question — 'regional estimate'.
 *  3. null when neither exists — no wind figure is better than an invented one.
 *  Mirrors lib/terracing.ts's effectiveSlopeForRing signature style exactly: a Pick of the
 *  observation-holder plus the regional-source, returning a single resolved value or null. */
export function effectivePrevailingWind(
  observation: Pick<LocalWindObservation, 'prevailingFrom'> | null | undefined,
  regional: RegionalWindFact | null | undefined,
): EffectiveWind | null {
  return fromObservedDirection(observation?.prevailingFrom) ?? fromRegionalFact(regional);
}

/** Resolves the wind direction for the fire/damaging-wind question specifically:
 *  1. observation.strongestFrom, when present — 'observed on site'.
 *  2. `regional` (e.g. SectorModel['fire']) — 'regional estimate'.
 *  3. null when neither exists.
 *  Deliberately reads ONLY strongestFrom, never falling back to prevailingFrom: confirming an
 *  everyday wind direction says nothing about a farmer's worst/damaging wind, and silently
 *  reusing the prevailing answer for the fire wedge would be exactly the kind of "confident but
 *  wrong" figure this whole workflow exists to stop the sheet asserting. A farmer who wants the
 *  fire wedge corrected has to answer that question specifically. */
export function effectiveFireWind(
  observation: Pick<LocalWindObservation, 'strongestFrom'> | null | undefined,
  regional: RegionalWindFact | null | undefined,
): EffectiveWind | null {
  return fromObservedDirection(observation?.strongestFrom) ?? fromRegionalFact(regional);
}

/** Which regional named-wind entry the confirm/override UI asks about for the "prevailing wind"
 *  question, given a site's named-wind table (e.g. SectorModel.namedWind / RegionalWindResult.
 *  namedWind). A POLICY choice, kept in one tested place rather than inlined at each call site:
 *  prefers 'summer_cooling' — the ordinary, most-of-the-year onshore breeze (Sep–Mar per
 *  lib/regional-wind.ts) — over the episodic, damaging 'berg' wind, because "prevailing" means
 *  the everyday wind, not the fire wind (that question is effectiveFireWind's job, separately).
 *  Falls back to whatever the table's first entry is when summer_cooling isn't present (e.g. a
 *  future region with a different table shape), and to null for an empty/no-region table — never
 *  fabricates a bearing when the regional table itself has nothing to offer. */
export function regionalPrevailingPick(
  namedWind: ReadonlyArray<{ id: string; fromLabel: string; bearingDeg: number }>,
): RegionalWindFact | null {
  const preferred = namedWind.find((w) => w.id === 'summer_cooling');
  const pick = preferred ?? namedWind[0];
  return pick ? { fromLabel: pick.fromLabel, bearingDeg: pick.bearingDeg } : null;
}
