// Sector analysis — the pure rules engine behind the deterministic Sector sheet (plan-set 02).
//
// Turns the site's REAL slope + climate data (plus latitude/longitude astronomy and a sourced
// regional-wind table) into a model of its energies (sun, wind, fire, water, frost), so the canvas
// code (drawSectorAnalysis in DesignGlossy) only DRAWS what this returns — nothing is invented.
// Every energy degrades independently and honestly when its data is missing.
// Pure, no DOM; lib/ never imports components/ (same rule as lib/phasing.ts).
//
// Analysis precedes design: the sector energies are WHY the zones/water/planting sit where they do,
// which is why this is sheet 02, before Zones.
//
// See docs/SECTOR-MODEL-SPEC-2026-07-21.md for the full spec this file implements. Three defects
// fixed here (§0):
//   §0.1 — fire is no longer `= windWinter`. It is regional-assumption (lib/regional-wind.ts,
//          keyed off the berg wind), or null. Deleted in 4e6eaae; this file adds the replacement.
//   §0.2 — `middayFrom` is no longer the hardcoded `sh ? 'N' : 'S'` (false inside the tropics,
//          e.g. northernmost SA ≈ -22.13°, north of the Tropic of Capricorn). It now comes from
//          lib/solar.ts's per-solstice signed test, and can honestly report 'mixed'.
//   §0.3 — NASA POWER's WD10M vector mean (lib/nasa-power.ts circularMeanDeg) is demoted to
//          `windNasaCrossCheck`: a diagnostic-only comparison against the regional table, NEVER an
//          arrow source. A circular mean of a bimodal (two-lobed) wind rose points into the gap
//          between the lobes — a direction the wind never blows from.

import { deriveSolar, type SolarModel } from '@/lib/solar';
import { resolveRegion, type NamedWindSector, type Provenance } from '@/lib/regional-wind';

export type { Provenance } from '@/lib/regional-wind';
export type { NamedWindSector, NamedWindId, RegionalFireSector } from '@/lib/regional-wind';

/** The site context the sector needs. A superset of PhasingSite ({biome?, rainfallMm?}) so the
 *  widened DesignGlossyProps['site'] stays assignable to buildPhasePlan. All fields optional — the
 *  data is a device-local cache and is null on a second device. */
export interface SectorSite {
  biome?: string;
  rainfallMm?: number;
  rainfallPattern?: 'winter' | 'summer' | 'year-round';
  elevation?: { slopeDeg: number; slopePct: number; aspectDeg: number; aspectLabel: string };
  climate?: { windFromSummer?: string; windFromWinter?: string; windSpeed?: number; minTemp?: number; maxTemp?: number };
}

export interface SectorModel {
  southernHemisphere: boolean;
  solar: SolarModel; // computed — real two-arc sun geometry from latitude + obliquity (lib/solar.ts)
  sun: { middayFrom: 'N' | 'S' | 'mixed' }; // kept for back-compat call sites; now sourced from solar.middayFrom

  // Regional-assumption named wind sectors (summer-cooling / cold-front / berg), sourced and
  // gated by lib/regional-wind.ts. [] when no region rule matches this site — a valid, shippable
  // outcome, not a bug — see `regionKey === null`.
  namedWind: NamedWindSector[];
  regionKey: string | null;
  // Diagnostic only — NEVER drawn as an arrow (§0.3). Lets a data note fire when the sourced
  // regional bearing and the site's own NASA POWER mean disagree by more than 45°.
  windNasaCrossCheck: { summerDeg: number | null; winterDeg: number | null; disagreesDeg: number | null } | null;

  // DEMOTED (§0.3): still populated from NASA POWER's circular mean (via lib/nasa-power's
  // aspectLabel), but the sheet no longer draws these as arrows — they only feed
  // `windNasaCrossCheck` and the plain-words SectorSummary card.
  windSummer: { fromLabel: string; bearingDeg: number; speed?: number } | null;
  windWinter: { fromLabel: string; bearingDeg: number; speed?: number } | null;

  // Fire approach = the berg wind's bearing (regional-assumption), gated on the berg sector firing
  // AND the site being summer-rainfall (so the dry season is actually May–Aug, when the berg
  // blows). null whenever either condition fails — no fire sector is better than a wrong one.
  fire: {
    fromLabel: string;
    bearingDeg: number;
    seasonNote: string;
    halfWidthDeg: number;
    provenance: Provenance;
    sourceKey: string;
  } | null;

  // Downhill (aspect) bearing + steepness — the single-plane-fit model also drawn as the sheet's
  // "TERRACE FALL" energy (parallel arrows, DesignGlossy.tsx). `indicative` when slope is in
  // (0.5°, 1.5°] (SRTM-coarse). `contourIntervalM`/`arrowCount` are NOT computed here (this is a
  // pure site-only function with no frame/boundary geometry) — the draw code computes them
  // directly from lib/contours.ts's ContourResult at render time and displays them without
  // round-tripping back through this model.
  water: {
    downhillBearingDeg: number;
    slopeDeg: number;
    slopePct: number;
    indicative: boolean;
    fallModel: 'uniform-plane'; // computed, but a MODEL not a survey
    sampleBaselineM: 1000; // literal — elevation.ts's ~1km sample offset (d = 0.01°)
  } | null;
  frost: { downhillBearingDeg: number; indicative: boolean; confidence: 'inferred-from-1km-aspect' } | null; // only when minTemp < 5 && slope usable
  flat: boolean; // slopeDeg < 1.5 (matches lib/contours tooFlat) → no contour lines
  dataNotes: string[]; // honest caveats, strongest first
  assumptionNotes: string[]; // regional-assumption disclosures, printed verbatim in the sheet's footer band
}

// 16-point compass label → bearing (deg clockwise from North). NASA POWER can return 16-point labels.
const COMPASS_BEARING: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** A bearing (deg clockwise from N) → unit SCREEN vector pointing that way (north = -y up, east = +x).
 *  This is the direction the bearing POINTS. Wind blows FROM its label, so a wind arrow travels the
 *  OPPOSITE way: negate this to get the wind's direction of travel. */
export function bearingToUnitVector(bearingDeg: number): [number, number] {
  const r = (bearingDeg * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}

/** Compass label → bearing, or null if unparseable/missing. */
export function labelToBearing(label: string | undefined | null): number | null {
  if (!label) return null;
  const b = COMPASS_BEARING[label.toUpperCase().trim()];
  return b == null ? null : b;
}

// Smallest signed difference between two bearings, folded into [0,180] — used only for the
// diagnostic NASA cross-check, never for anything drawn.
function bearingDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** §0.2 shared helper: which side (N/S/mixed) the midday sun sits on, from latitude alone. Every
 *  call site that used to hardcode `sh ? 'N' : 'S'` (this file, app/api/generate-report/route.ts,
 *  app/api/ai-render/route.ts) now derives it from here (via lib/solar.deriveSolar), so there is
 *  exactly one place this fact is computed. */
export function middayFromLat(latDeg: number): 'N' | 'S' | 'mixed' {
  return deriveSolar(latDeg).middayFrom;
}

export function deriveSectorModel(
  site: SectorSite | null | undefined,
  latDeg: number,
  lonDeg?: number | null,
): SectorModel {
  const sh = latDeg < 0;
  const notes: string[] = [];

  const solar = deriveSolar(latDeg);

  const elev = site?.elevation;
  const slopeDeg = elev?.slopeDeg ?? 0;
  const aspectDeg = elev?.aspectDeg;
  const slopeUsable = slopeDeg > 0.5 && aspectDeg != null && Number.isFinite(aspectDeg);
  const flat = !(slopeDeg >= 1.5); // below 1.5° reads flat (no contour lines) — matches lib/contours
  const indicative = slopeUsable && slopeDeg < 1.5; // 0.5–1.5°: real direction, SRTM-coarse magnitude

  if (!site) {
    notes.push('Site not analysed yet — open this place on the map to fetch climate & slope, then redraw.');
  } else {
    if (!elev) notes.push('No terrain data yet — open this place on the map to fetch slope & aspect.');
    if (!site.climate) notes.push('No wind/temperature data yet — open this place on the map to fetch climate.');
  }

  // NASA POWER wind means — DEMOTED (§0.3): kept for the plain-words card + the cross-check below,
  // never drawn as an arrow on the sheet any more (a circular mean of KZN's bimodal wind rose lands
  // in the gap between its two lobes, a direction the wind never blows from).
  const wsB = labelToBearing(site?.climate?.windFromSummer);
  const wwB = labelToBearing(site?.climate?.windFromWinter);
  const windSummer = wsB != null ? { fromLabel: site!.climate!.windFromSummer!, bearingDeg: wsB, speed: site?.climate?.windSpeed } : null;
  const windWinter = wwB != null ? { fromLabel: site!.climate!.windFromWinter!, bearingDeg: wwB, speed: site?.climate?.windSpeed } : null;

  // Regional named-wind table (§2/§3) — the ONLY source for namedWind/fire. Never derived from
  // the NASA mean above.
  const region = resolveRegion(latDeg, lonDeg, site?.biome, site?.rainfallPattern);
  const namedWind = region.namedWind;
  const regionKey = region.regionKey;
  const assumptionNotes = region.assumptionNotes;

  let fire: SectorModel['fire'] = null;
  if (region.fire) {
    fire = {
      fromLabel: region.fire.fromLabel,
      bearingDeg: region.fire.bearingDeg,
      seasonNote: region.fire.seasonNote,
      halfWidthDeg: region.fire.halfWidthDeg,
      provenance: region.fire.provenance,
      sourceKey: region.fire.sourceKey,
    };
  } else if (regionKey == null) {
    notes.unshift('No regional fire-wind pattern for this area — walk the boundary and ask neighbours which side fires come from.');
  } else if (site?.rainfallPattern && site.rainfallPattern !== 'summer') {
    notes.unshift('Fire sector not shown: this site’s fire season doesn’t match the region’s sourced berg-wind pattern — confirm the fire approach locally before siting a firebreak.');
  }

  // Diagnostic cross-check (§0.3) — compares the sourced regional bearing against the site's own
  // NASA POWER mean; NEVER drawn, only a data note when they disagree by more than 45°.
  let windNasaCrossCheck: SectorModel['windNasaCrossCheck'] = null;
  if (regionKey) {
    const summerCooling = namedWind.find((w) => w.id === 'summer_cooling');
    const coldFront = namedWind.find((w) => w.id === 'cold_front');
    const summerDeg = windSummer?.bearingDeg ?? null;
    const winterDeg = windWinter?.bearingDeg ?? null;
    const summerDisagree = summerDeg != null && summerCooling ? bearingDiff(summerDeg, summerCooling.bearingDeg) : null;
    const winterDisagree = winterDeg != null && coldFront ? bearingDiff(winterDeg, coldFront.bearingDeg) : null;
    const worst = [summerDisagree, winterDisagree].filter((v): v is number => v != null && v > 45);
    const disagreesDeg = worst.length ? Math.max(...worst) : null;
    windNasaCrossCheck = { summerDeg, winterDeg, disagreesDeg };
    if (disagreesDeg != null) {
      notes.push(`This site’s own wind data reads ${Math.round(disagreesDeg)}° off the regional pattern — a bimodal wind rose average can land between its two real lobes, not on either one; trust the regional sectors over this site’s single mean.`);
    }
  }

  const water: SectorModel['water'] = slopeUsable
    ? {
        downhillBearingDeg: aspectDeg!,
        slopeDeg,
        slopePct: elev!.slopePct,
        indicative,
        fallModel: 'uniform-plane',
        sampleBaselineM: 1000,
      }
    : null;

  const minT = site?.climate?.minTemp;
  const frost: SectorModel['frost'] =
    minT != null && minT < 5 && slopeUsable
      ? { downhillBearingDeg: aspectDeg!, indicative, confidence: 'inferred-from-1km-aspect' }
      : null;
  if (minT != null && minT < 5 && !slopeUsable) notes.push('Cold air settles in low spots on still, clear nights.');
  // §4 wording fix: the 30 m figure is the RASTER's own resolution, not our sampling footprint —
  // lib/elevation.ts samples 3 points ~1 km apart (d = 0.01°), so naming 30 m understates the
  // footprint by ~30x. Both notes now name the true ~1 km sampling baseline.
  if (indicative) notes.push('Slope estimated from SRTM elevation sampled about 1 km apart — one average fall for the whole hillside, not your plot.');
  else if (flat && elev) notes.push('Site reads ~flat at this ~1 km sampling resolution — confirm fall on site.');

  return {
    southernHemisphere: sh,
    solar,
    sun: { middayFrom: solar.middayFrom },
    namedWind,
    regionKey,
    windNasaCrossCheck,
    windSummer,
    windWinter,
    fire,
    water,
    frost,
    flat,
    dataNotes: notes,
    assumptionNotes,
  };
}
