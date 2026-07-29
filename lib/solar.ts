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
