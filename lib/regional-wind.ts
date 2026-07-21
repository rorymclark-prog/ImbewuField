// Sector Analysis (sheet 02) — the regional named-wind-sector table.
//
// EVERYTHING HERE IS 'regional-assumption', NEVER 'computed'. These are documented regional wind
// patterns from the literature, not measurements at any given site — see
// docs/SECTOR-MODEL-SPEC-2026-07-21.md §2/§3 for the full sourcing and the reasoning for every
// inclusion/exclusion below. Ship nationally = nothing meteorological (a single national wind
// rule would be ~110° wrong for roughly half the country — KZN NE/SW vs Cape SE/NW). Ship gated
// on region = only where a named pattern has actually been sourced and reviewed.
//
// Grassfire/ember risk is derived from the BERG wind here, never from the winter prevailing wind
// (lib/nasa-power's circular mean) — that was the bug this whole rewrite exists to fix (§0.1):
// on the KZN coast the NASA winter mean reads WSW, which is the post-cold-front ONSHORE, rain-
// bearing wind, not the hot dry wind that carries fire. Fire is null unless the berg gate fires
// AND the site's rainfall pattern is summer (KZN's fynbos-equivalent fire season is inverted and
// is explicitly out of scope — see §3 "DO NOT SHIP").
//
// Pure, no DOM; lib/ never imports components/ (same rule as lib/sector.ts, lib/solar.ts).

export type Provenance = 'computed' | 'regional-assumption';

export type NamedWindId = 'summer_cooling' | 'cold_front' | 'berg' | 'storm_onshore';

export interface NamedWindSector {
  id: NamedWindId;
  title: string; // 'SUMMER COOLING WIND'
  fromLabel: string; // 'NE'
  bearingDeg: number; // centre, deg from TRUE north
  halfWidthDeg: number; // rendered wedge half-angle — a drafting choice (SECTOR-MODEL-SPEC §8.2), not a statistic
  season: string; // 'Sep–Mar'
  effect: string; // one line: what it does to the design
  provenance: 'regional-assumption'; // NEVER 'computed' — none of these are measured here
  sourceKey: keyof typeof SECTOR_SOURCES;
  regionKey: string; // 'kzn-coastal'
}

export interface RegionalFireSector {
  bearingDeg: number;
  fromLabel: string;
  halfWidthDeg: number;
  seasonNote: string;
  provenance: 'regional-assumption';
  sourceKey: keyof typeof SECTOR_SOURCES;
}

export interface RegionalWindResult {
  regionKey: string | null;
  namedWind: NamedWindSector[]; // [] when no region rule matches — a valid, shippable outcome
  fire: RegionalFireSector | null;
  /** Non-directional caveats that must be printed but never drawn as a bearing (e.g. the
   *  "summer storms — approach direction varies" note, §3 "DO NOT SHIP"). */
  assumptionNotes: string[];
}

// Self-citing SOURCES line for the sheet's data strip.
export const SECTOR_SOURCES = {
  'kruger2014': 'Kruger, A.C. (2014) — Ugu Lwethu (KZN coastal synoptic wind patterns), pp.15-16',
  'ams-bergwind': 'American Meteorological Society Glossary of Meteorology — "Berg wind"',
  'tshabalala2023': 'Tshabalala et al. (2023), Atmosphere 14(1):78 — April 2022 Durban floods, onshore low-level jet',
} as const;

const KZN_SUMMER_COOLING: NamedWindSector = {
  id: 'summer_cooling',
  title: 'SUMMER COOLING WIND',
  fromLabel: 'NE',
  bearingDeg: 45,
  halfWidthDeg: 30,
  season: 'Sep–Mar',
  effect: 'Onshore sea-breeze — cools the site; keep this side open for airflow.',
  provenance: 'regional-assumption',
  sourceKey: 'kruger2014',
  regionKey: 'kzn-coastal',
};

const KZN_COLD_FRONT: NamedWindSector = {
  id: 'cold_front',
  title: 'COLD FRONT — DRIVING RAIN',
  fromLabel: 'SW',
  bearingDeg: 225,
  halfWidthDeg: 30,
  season: 'Mar–Aug',
  effect: 'Near-weekly frontal passage in autumn/winter — driving rain, not the fire wind.',
  provenance: 'regional-assumption',
  sourceKey: 'kruger2014',
  regionKey: 'kzn-coastal',
};

const KZN_BERG: NamedWindSector = {
  id: 'berg',
  title: 'BERG WIND',
  fromLabel: 'NW',
  bearingDeg: 315,
  halfWidthDeg: 25,
  season: 'May–Aug, episodic',
  effect: 'Hot, dry descent off the escarpment — the fire wind, not the cooling wind.',
  provenance: 'regional-assumption',
  sourceKey: 'ams-bergwind',
  regionKey: 'kzn-coastal',
};

// Deliberately NOT shipped as a drawn sector (SECTOR-MODEL-SPEC §3 "DO NOT SHIP") — two opposite
// mechanisms (ordinary convective storms vs. extreme onshore E/NE rain events) share one season,
// and naming a single bearing would be right for one and ~180° wrong for the other. Kept here only
// as a non-directional note, never instantiated as a NamedWindSector.
const KZN_STORM_NOTE =
  'Summer convective storms and hail: frequent Oct–Mar. Approach direction varies; extreme onshore rain events arrive from E/NE.';

const MAGNETIC_DECLINATION_NOTE =
  'All bearings are TRUE north. A magnetic compass reads well west of true in South Africa — correct before pacing anything out.';

/** Coarse, deliberately conservative box for "KZN, seaward of the escarpment, ≲60 km from the
 *  coast" (SECTOR-MODEL-SPEC §3/§8.1). This boundary is NOT a sourced climatological line — it is
 *  a rough lat/lon box standing in for one, so it is kept tight (biased toward returning `null`,
 *  i.e. no regional sectors, rather than over-firing inland where the coastal regime doesn't
 *  hold). A real escarpment/coast-distance boundary needs a climatologist, not a developer (§8.1).
 */
function isKznCoastal(latDeg: number, lonDeg: number): boolean {
  return latDeg <= -27.3 && latDeg >= -30.8 && lonDeg >= 30.0 && lonDeg <= 32.9;
}

/** Resolve which (if any) regional wind table applies. Returns a `regionKey: null` result — a
 *  valid, shippable outcome — whenever the site can't be placed (no lon, or outside every gate).
 *  Only `kzn-coastal` exists today; a second region (Western Cape) needs its own sourced table
 *  (SECTOR-MODEL-SPEC §3, §8.6) and is deliberately not extrapolated from this one. */
export function resolveRegion(
  latDeg: number,
  lonDeg: number | null | undefined,
  _biome: string | null | undefined,
  rainfallPattern: 'winter' | 'summer' | 'year-round' | null | undefined,
): RegionalWindResult {
  if (lonDeg == null || !Number.isFinite(lonDeg) || !Number.isFinite(latDeg)) {
    return { regionKey: null, namedWind: [], fire: null, assumptionNotes: [] };
  }

  if (isKznCoastal(latDeg, lonDeg)) {
    const namedWind = [KZN_SUMMER_COOLING, KZN_COLD_FRONT, KZN_BERG];
    // Fire = berg's bearing, and ONLY where the site is also summer-rainfall (so the dry season
    // is May–Aug, when the berg actually blows) — SECTOR-MODEL-SPEC §3's fire row gate exactly.
    const fire: RegionalFireSector | null =
      rainfallPattern === 'summer'
        ? {
            bearingDeg: KZN_BERG.bearingDeg,
            fromLabel: KZN_BERG.fromLabel,
            halfWidthDeg: 20, // narrower dashed ray-fan than the wind wedge itself
            seasonNote: 'Winter grassfire / ember risk follows the dry, hot berg wind, not the cooling summer wind.',
            provenance: 'regional-assumption',
            sourceKey: 'ams-bergwind',
          }
        : null;
    const assumptionNotes = [KZN_STORM_NOTE, MAGNETIC_DECLINATION_NOTE];
    return { regionKey: 'kzn-coastal', namedWind, fire, assumptionNotes };
  }

  return {
    regionKey: null,
    namedWind: [],
    fire: null,
    assumptionNotes: ['No regional wind sectors for this area — record wind directions on site.'],
  };
}
