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
import { aspectLabel } from '@/lib/biome';

export type { Provenance } from '@/lib/regional-wind';
export type { NamedWindSector, NamedWindId, RegionalFireSector } from '@/lib/regional-wind';

/** The site context the sector needs. A superset of PhasingSite ({biome?, rainfallMm?}) so the
 *  widened DesignGlossyProps['site'] stays assignable to buildPhasePlan. All fields optional — the
 *  data is a device-local cache and is null on a second device. */
export interface SectorSite {
  biome?: string;
  rainfallMm?: number;
  // Jan..Dec totals from NASA POWER. The Water sheet needs the seasonal shape, not only the annual
  // sum, to run the same dry-season storage balance as Tank Calculator.
  monthlyRainfallMm?: number[];
  rainfallPattern?: 'winter' | 'summer' | 'year-round';
  elevation?: {
    slopeDeg: number;
    slopePct: number;
    aspectDeg: number;
    aspectLabel: string;
    sampleBaselineM?: number;
    directionConfidence?: 'site-local-indicative' | 'unconfirmed';
  };
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
  // Coordinate-specific NASA POWER climatology. This is deliberately descriptive evidence,
  // never an arrow source: the seasonal values are circular means of monthly grid data, not a
  // measured wind rose at the property. Keeping it on the model lets the sheet distinguish the
  // site's own coarse climate-grid result from the shared regional named-wind profile.
  siteWindEvidence: {
    summerFromLabel: string | null;
    winterFromLabel: string | null;
    annualMeanSpeedMps: number | null;
    provenance: 'coordinate-climate-grid';
  } | null;

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
    sampleBaselineM: number;
  } | null;
  frost: { downhillBearingDeg: number; indicative: boolean; confidence: 'inferred-from-local-dem' } | null; // only when minTemp < 5 && slope usable

  // Driveway-access energy (SECTOR-MODEL-SPEC deferred item, finished 2026-07-21): dust & noise
  // arriving from vehicle access, bearing FROM the house/site centroid TOWARD the driveway's own
  // centroid — same "the label is where it comes FROM" convention as wind (bearingToUnitVector's
  // docblock), not a to-direction. UNLIKE namedWind/fire this has a REAL geometric data source —
  // the farmer's own traced driveway (refLayers.driveway) — so it is PROVENANCE: computed, never
  // gated on region, and it is not populated by this function (a pure site-only function with no
  // canvas/frame geometry — same reason contourIntervalM isn't computed here either, see `water`
  // above). Callers with real geometry pass it via `deriveDrivewayAccess` and merge it in; null
  // here is the correct default for every call site that has no geometry (SectorSummary,
  // DesignCanvas's live model), not a bug.
  driveway: { bearingDeg: number; fromLabel: string; halfWidthDeg: number; provenance: Provenance } | null;
  flat: boolean; // slopeDeg < 1.5 (matches lib/contours tooFlat) → no contour lines
  dataNotes: string[]; // honest caveats, strongest first
  assumptionNotes: string[]; // regional-assumption disclosures, printed verbatim in the sheet's footer band
}

/** Driveway-access bearing — pure geometry, no site/climate data, so it lives outside
 *  deriveSectorModel (which has no canvas/frame geometry to work with; see the `driveway` field
 *  comment above). Normalised [0,1] coordinates, x east+, y south+ — the same convention every
 *  ZoneShape/line point uses (lib/design-canvas.ts) and the same one DesignGlossy.tsx's own
 *  compass8/compassEighth helpers already compute bearings in, so this isn't a new coordinate
 *  convention for the codebase, just the first time sector.ts itself needs one.
 *  Returns null when there's no driveway to point at, or when its centroid degenerately
 *  coincides with the site centroid (can't derive a direction from a zero-length vector) — never
 *  a fabricated bearing. */
export function deriveDrivewayAccess(
  siteCentroid: [number, number],
  drivewayPoints: Array<[number, number]>,
): SectorModel['driveway'] {
  if (drivewayPoints.length < 2) return null; // matches the sheet's own "no row for untraced geometry" gate
  if (
    siteCentroid.some((coordinate) => !Number.isFinite(coordinate))
    || drivewayPoints.some((point) => point.some((coordinate) => !Number.isFinite(coordinate)))
  ) {
    return null;
  }
  const n = drivewayPoints.length;
  const dcx = drivewayPoints.reduce((s, p) => s + p[0], 0) / n;
  const dcy = drivewayPoints.reduce((s, p) => s + p[1], 0) / n;
  const dx = dcx - siteCentroid[0];
  const dy = dcy - siteCentroid[1];
  if (Math.hypot(dx, dy) < 1e-6) return null; // degenerate — driveway centroid coincides with the site centroid
  // Inverse of bearingToUnitVector: that maps bearingDeg -> [sin(b), -cos(b)]; this recovers b
  // from a [dx, dy] vector the same way DesignGlossy.tsx's compass8/compassEighth already do.
  const bearingDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  // halfWidthDeg is drafting-only (this sector is drawn as a single solid arrow, not a wedge — see
  // DesignGlossy.tsx's driveway-access draw call) but kept on the type for shape-parity with
  // namedWind/fire in case a future caller wants to shade an uncertainty cone around it.
  return { bearingDeg, fromLabel: aspectLabel(bearingDeg), halfWidthDeg: 16, provenance: 'computed' };
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
  // Real on-canvas geometry for the driveway-access energy (see the `driveway` field comment
  // above for why this can't be derived from `site` alone). Optional and separate from
  // `SectorSite` because most call sites (SectorSummary's plain-words card, DesignCanvas's live
  // model) have no canvas frame at all — omitting it just means `driveway` comes back null,
  // exactly like any other model field with no source data.
  drivewayGeometry?: { siteCentroid: [number, number]; drivewayPoints: Array<[number, number]> } | null,
): SectorModel {
  const sh = latDeg < 0;
  const notes: string[] = [];

  const solar = deriveSolar(latDeg);

  const elev = site?.elevation;
  const slopeDeg = elev?.slopeDeg ?? 0;
  const slopePct = elev?.slopePct;
  const rawAspectDeg = elev?.aspectDeg;
  const aspectDeg = rawAspectDeg != null && Number.isFinite(rawAspectDeg)
    ? ((rawAspectDeg % 360) + 360) % 360
    : null;
  const directionConfirmed = elev?.directionConfidence !== 'unconfirmed';
  const validSlope = Number.isFinite(slopeDeg) && slopeDeg >= 0 && slopeDeg < 90;
  const validSlopePct = slopePct != null && Number.isFinite(slopePct) && slopePct >= 0;
  const slopeUsable = directionConfirmed
    && validSlope
    && slopeDeg > 0.5
    && validSlopePct
    && aspectDeg != null;
  const flat = !validSlope || slopeDeg < 1.5; // below 1.5° reads flat (no contour lines) — matches lib/contours
  // DEM-derived direction remains indicative even on a visibly steep site. It is property-local
  // evidence, not a substitute for surveyed levels.
  const indicative = slopeUsable && elev?.directionConfidence === 'site-local-indicative';

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
  const windSpeed = site?.climate?.windSpeed;
  const validWindSpeed = windSpeed != null && Number.isFinite(windSpeed) && windSpeed >= 0
    ? windSpeed
    : null;
  const windSummer = wsB != null ? {
    fromLabel: site!.climate!.windFromSummer!,
    bearingDeg: wsB,
    ...(validWindSpeed != null ? { speed: validWindSpeed } : {}),
  } : null;
  const windWinter = wwB != null ? {
    fromLabel: site!.climate!.windFromWinter!,
    bearingDeg: wwB,
    ...(validWindSpeed != null ? { speed: validWindSpeed } : {}),
  } : null;
  const siteWindEvidence: SectorModel['siteWindEvidence'] =
    windSummer || windWinter || validWindSpeed != null
      ? {
          summerFromLabel: windSummer?.fromLabel ?? null,
          winterFromLabel: windWinter?.fromLabel ?? null,
          annualMeanSpeedMps: validWindSpeed,
          provenance: 'coordinate-climate-grid',
        }
      : null;

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
        slopePct: slopePct!,
        indicative,
        fallModel: 'uniform-plane',
        sampleBaselineM:
          elev?.sampleBaselineM != null
          && Number.isFinite(elev.sampleBaselineM)
          && elev.sampleBaselineM > 0
            ? elev.sampleBaselineM
            : 1000,
      }
    : null;

  const minT = site?.climate?.minTemp;
  const frost: SectorModel['frost'] =
    minT != null && Number.isFinite(minT) && minT < 5 && slopeUsable
      ? { downhillBearingDeg: aspectDeg!, indicative, confidence: 'inferred-from-local-dem' }
      : null;
  if (minT != null && Number.isFinite(minT) && minT < 5 && !slopeUsable) notes.push('Cold air settles in low spots on still, clear nights.');
  if (elev?.directionConfidence === 'unconfirmed') {
    notes.push('Local DEM relief is too small to confirm a downhill direction — use neighbouring contours or measure the fall on site.');
  } else if (indicative) {
    notes.push(`Slope direction is estimated from a site-local SRTM sample across about ${elev?.sampleBaselineM ?? 120} m — indicative, not surveyed.`);
  } else if (flat && elev) {
    notes.push(`Site reads ~flat at this ${elev.sampleBaselineM ?? 120} m sampling scale — confirm fall on site.`);
  }

  const driveway = drivewayGeometry
    ? deriveDrivewayAccess(drivewayGeometry.siteCentroid, drivewayGeometry.drivewayPoints)
    : null;

  return {
    southernHemisphere: sh,
    solar,
    sun: { middayFrom: solar.middayFrom },
    namedWind,
    regionKey,
    windNasaCrossCheck,
    siteWindEvidence,
    windSummer,
    windWinter,
    fire,
    water,
    frost,
    driveway,
    flat,
    dataNotes: notes,
    assumptionNotes,
  };
}
