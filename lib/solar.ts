// Sector Analysis (sheet 02) — real sun geometry, 100% computed from latitude + obliquity.
//
// No network call, no data source, no failure mode except sites inside the polar circles
// (|lat| >= 90 - OBLIQUITY_DEG), which South Africa never reaches. Every field here is
// PROVENANCE: computed — see docs/SECTOR-MODEL-SPEC-2026-07-21.md §1, which this file
// implements verbatim (formulae from Meeus, Astronomical Algorithms 2e, ch.13/15, and the
// NOAA GML solar-calculator equations; geometric horizon, h0 = 0 — no refraction correction,
// no horizon profile. lib/elevation.ts holds no horizon data, so ridges/trees that delay real
// first/last light are NOT modelled here — see the sheet caption this feeds.)
//
// Pure, no DOM; lib/ never imports components/ (same rule as lib/sector.ts).

import { aspectLabel } from '@/lib/biome';

/** Mean obliquity of the ecliptic, epoch 2026 (Meeus, Astronomical Algorithms 2e, ch.22). */
export const OBLIQUITY_DEG = 23.4359;

export interface SunPath {
  season: 'december' | 'june' | 'equinox';
  declDeg: number;
  sunriseAzDeg: number | null; // deg clockwise from TRUE north; null inside polar circles
  sunsetAzDeg: number | null; // = 360 - sunrise, exact mirror
  riseLabel16: string | null; // 16-point, e.g. 'ESE'
  setLabel16: string | null;
  sweepDeg: number | null; // = 2 * sunriseAz
  noonAltitudeDeg: number; // always defined (may be negative)
  noonSide: 'N' | 'S' | 'overhead';
  shadowRatio: number | null; // 1/tan(alt); null when alt <= 0
}

export interface SolarModel {
  summer: SunPath;
  winter: SunPath;
  equinox: SunPath;
  middayFrom: 'N' | 'S' | 'mixed'; // 'mixed' inside the tropics — both solstices differ
  usable: boolean; // false when |lat| >= 90 - OBLIQUITY_DEG
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function isValidEarthLatitude(latDeg: number): boolean {
  return Number.isFinite(latDeg) && latDeg >= -90 && latDeg <= 90;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** One solstice/equinox sun path at latitude `latDeg` (signed, negative south) for declination
 *  `declDeg` (signed; +north). Formulae, geometric horizon h0=0:
 *    cos A_rise = sin δ / cos φ           (φ signed — works unchanged in both hemispheres)
 *    A_rise     = acos(clamp(cosA,-1,1))     ∈ [0°,180°], eastern half
 *    A_set      = 360° - A_rise
 *    h_noon     = 90° - |φ - δ|
 *    noonSide   = δ > φ ? 'N' : δ < φ ? 'S' : 'overhead'
 */
function sunPath(latDeg: number, declDeg: number, season: SunPath['season']): SunPath {
  const phiRad = latDeg * DEG2RAD;
  const declRad = declDeg * DEG2RAD;
  const cosPhi = Math.cos(phiRad);
  const ratio = Math.sin(declRad) / cosPhi;

  let sunriseAzDeg: number | null = null;
  let sunsetAzDeg: number | null = null;
  let riseLabel16: string | null = null;
  let setLabel16: string | null = null;
  let sweepDeg: number | null = null;
  if (Math.abs(ratio) <= 1) {
    const aRise = Math.acos(clamp(ratio, -1, 1)) * RAD2DEG;
    sunriseAzDeg = aRise;
    sunsetAzDeg = 360 - aRise;
    riseLabel16 = aspectLabel(sunriseAzDeg);
    setLabel16 = aspectLabel(sunsetAzDeg);
    sweepDeg = 2 * aRise;
  }

  const noonAltitudeDeg = 90 - Math.abs(latDeg - declDeg);
  const noonSide: SunPath['noonSide'] = declDeg > latDeg ? 'N' : declDeg < latDeg ? 'S' : 'overhead';
  const shadowRatio = noonAltitudeDeg > 0 ? 1 / Math.tan(noonAltitudeDeg * DEG2RAD) : null;

  return {
    season,
    declDeg,
    sunriseAzDeg,
    sunsetAzDeg,
    riseLabel16,
    setLabel16,
    sweepDeg,
    noonAltitudeDeg,
    noonSide,
    shadowRatio,
  };
}

/** Real sun geometry from latitude alone. Southern-hemisphere summer = the December solstice
 *  (δ = -ε), winter = June (δ = +ε); swapped for the northern hemisphere. `middayFrom` is
 *  'mixed' when the two solstices disagree on which side (N/S) the noon sun sits — true for
 *  any site between the equator and its own hemisphere's tropic (|lat| < OBLIQUITY_DEG),
 *  where the old hardcoded `sh ? 'N' : 'S'` was flatly wrong (SECTOR-MODEL-SPEC §0.2). */
export function deriveSolar(latDeg: number): SolarModel {
  if (!isValidEarthLatitude(latDeg)) {
    throw new RangeError('Solar latitude must be a finite Earth latitude');
  }
  const sh = latDeg < 0;
  const decJune = sunPath(latDeg, sh ? -OBLIQUITY_DEG : OBLIQUITY_DEG, sh ? 'december' : 'june');
  const juneDec = sunPath(latDeg, sh ? OBLIQUITY_DEG : -OBLIQUITY_DEG, sh ? 'june' : 'december');
  const equinox = sunPath(latDeg, 0, 'equinox');

  const summer = decJune;
  const winter = juneDec;
  const middayFrom: SolarModel['middayFrom'] =
    summer.noonSide === winter.noonSide ? summer.noonSide === 'overhead' ? 'N' : summer.noonSide : 'mixed';

  return {
    summer,
    winter,
    equinox,
    middayFrom,
    usable: Math.abs(latDeg) < 90 - OBLIQUITY_DEG,
  };
}

/** Minimum bulge of a drawn sun arc past its own rise/set chord, as a fraction of the ring
 *  radius. Enough that a low winter sun still reads as a curve rather than a ruled line. */
export const SUN_ARC_MIN_BULGE = 0.1;

/**
 * Where the noon sun sits on a PLAN-VIEW sun-path arc: the distance from the ring centre, as a
 * fraction of the sun ring's radius, measured along the noon bearing. The arc is then a curve
 * from the true sunrise bearing, through this point, to the true sunset bearing — so its height
 * carries the season's noon altitude and its ends carry the season's azimuths.
 *
 * `chordFraction` is how far the rise/set endpoints ALREADY lie along that same noon bearing
 * (the endpoint unit vector projected onto it; the two are mirror images, so one value covers
 * both). Clearing them is the whole job of this function. A winter sun rises and sets well round
 * toward the noon side — at 28°S the June sun comes up at 063° and goes down at 297°, both of
 * them 45% of the way north already — so an apex measured from the CENTRE alone lands level with
 * or BEHIND its own endpoints, and a quadratic through it draws as a flat line or a sag. That is
 * exactly what shipped: a proper summer arc and a winter "path" that was a horizontal dashed
 * rule. Rory: "can you put the winter sun as well properly with angle".
 *
 * The altitude term is deliberately compressed into 0.28–1.0 rather than 0–1: an arc whose apex
 * sits on top of its own chord conveys nothing, and the ORDER of the two seasons (summer always
 * visibly higher than winter) matters more to a farmer siting a shade tree than the absolute
 * proportion does.
 */
export function sunArcApexFraction(noonAltitudeDeg: number, chordFraction: number): number {
  const alt = clamp(Number.isFinite(noonAltitudeDeg) ? noonAltitudeDeg : 0, 0, 90);
  const byAltitude = 0.28 + 0.72 * (alt / 90);
  const clear = (Number.isFinite(chordFraction) ? chordFraction : 0) + SUN_ARC_MIN_BULGE;
  return Math.max(byAltitude, clear);
}
