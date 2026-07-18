// Sector analysis — the pure rules engine behind the deterministic Sector sheet (plan-set 02).
//
// Turns the site's REAL slope + climate data into a model of its energies (sun, wind, fire, water,
// frost), so the canvas code (buildBlueprintSectorMap in DesignGlossy) only DRAWS what this returns
// — nothing is invented. Every energy degrades independently and honestly when its data is missing.
// Pure, no DOM; lib/ never imports components/ (same rule as lib/phasing.ts).
//
// Analysis precedes design: the sector energies are WHY the zones/water/planting sit where they do,
// which is why this is sheet 02, before Zones. Southern hemisphere: the strongest useful sun is in
// the NORTH; maps are north-up, so the sun passes across the TOP of the sheet.

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
  sun: { middayFrom: 'N' | 'S' }; // SH → 'N'; the sun is never "missing data"
  windSummer: { fromLabel: string; bearingDeg: number; speed?: number } | null;
  windWinter: { fromLabel: string; bearingDeg: number; speed?: number } | null;
  // Fire approach = the DRY-season prevailing wind (deterministic, never guessed):
  //   summer-rainfall biome → dry season is WINTER → fire from windFromWinter
  //   winter-rainfall biome → dry season is SUMMER → fire from windFromSummer
  //   year-round / pattern or wind missing → null
  fire: { fromLabel: string; bearingDeg: number; seasonNote: string } | null;
  // Downhill (aspect) bearing + steepness. `indicative` when slope is in (0.5°, 1.5°] (SRTM-coarse).
  water: { downhillBearingDeg: number; slopeDeg: number; slopePct: number; indicative: boolean } | null;
  frost: { downhillBearingDeg: number; indicative: boolean } | null; // only when minTemp < 5 && slope usable
  flat: boolean; // slopeDeg < 1.5 (matches lib/contours tooFlat) → no contour lines
  dataNotes: string[]; // honest caveats, strongest first
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

export function deriveSectorModel(site: SectorSite | null | undefined, latDeg: number): SectorModel {
  const sh = latDeg < 0;
  const notes: string[] = [];

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

  const wsB = labelToBearing(site?.climate?.windFromSummer);
  const wwB = labelToBearing(site?.climate?.windFromWinter);
  const windSummer = wsB != null ? { fromLabel: site!.climate!.windFromSummer!, bearingDeg: wsB, speed: site?.climate?.windSpeed } : null;
  const windWinter = wwB != null ? { fromLabel: site!.climate!.windFromWinter!, bearingDeg: wwB, speed: site?.climate?.windSpeed } : null;

  // Fire = dry-season prevailing wind. Rainfall pattern comes from the biome; wind from climate.
  const pattern = site?.rainfallPattern;
  let fire: SectorModel['fire'] = null;
  if (pattern === 'summer' && windWinter) fire = { fromLabel: windWinter.fromLabel, bearingDeg: windWinter.bearingDeg, seasonNote: 'dry season · winter' };
  else if (pattern === 'winter' && windSummer) fire = { fromLabel: windSummer.fromLabel, bearingDeg: windSummer.bearingDeg, seasonNote: 'dry season · summer' };

  const water = slopeUsable ? { downhillBearingDeg: aspectDeg!, slopeDeg, slopePct: elev!.slopePct, indicative } : null;

  const minT = site?.climate?.minTemp;
  const frost = (minT != null && minT < 5 && slopeUsable) ? { downhillBearingDeg: aspectDeg!, indicative } : null;
  if (minT != null && minT < 5 && !slopeUsable) notes.push('Cold air settles in low spots on still, clear nights.');
  if (indicative) notes.push('Slope from SRTM 30 m — treat direction as a guide; confirm fall on site.');
  else if (flat && elev) notes.push('Site reads ~flat at SRTM 30 m resolution — confirm fall on site.');

  return {
    southernHemisphere: sh,
    sun: { middayFrom: sh ? 'N' : 'S' },
    windSummer,
    windWinter,
    fire,
    water,
    frost,
    flat,
    dataNotes: notes,
  };
}
