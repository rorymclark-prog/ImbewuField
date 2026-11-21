// "Where the shade falls" — one object's shadow through a day, and the sun each bed behind it gets.
//
// lib/solar.ts (deriveSolar) answers the three questions a sector map needs: where the sun rises,
// how high it stands at noon, and how long a noon shadow is. It has no HOUR-OF-DAY sun position,
// and a shadow that moves needs one. This module adds exactly that and nothing else:
//
//   sunPosition(lat, declination, hour angle)  — altitude and azimuth, standard spherical astronomy
//                                                (Meeus, Astronomical Algorithms 2e ch.13; the NOAA GML
//                                                solar-calculator equations, as lib/solar.ts cites).
//
// It uses solar.ts's own conventions and constants: azimuth in degrees clockwise from TRUE north;
// the solstice declinations are ± OBLIQUITY_DEG (imported, not copied) and the equinox is 0; geometric
// horizon (h0 = 0, no refraction). tests/shade-day.test.ts holds it to deriveSolar at noon and at
// sunrise, and to independent NOAA values for real dates.
//
// CLOCK: every hour here is LOCAL SOLAR TIME — 12:00 is the instant the sun is highest, due north or
// due south, wherever the farm is. It is not SAST. South African wall clocks run on the 30° E meridian
// and add the equation of time on top, so wall-clock noon differs from solar noon by a few minutes
// that change through the year; this module does not model that and never prints it as clock time.
//
// THE OBJECT: a thin, opaque, vertical screen — a wall, a hedge or a row of trees — running
// east–west with its foot on y = 0, centred on x = 0. Plan coordinates are metres, x east, y north.
// Beds lie SOUTH of it (y < 0), measured at their centre line (x = 0).
//
// WHAT IT DOES NOT MODEL (same limits as lib/solar.ts, said wherever this is shown): flat ground, a
// geometric horizon (no ridges, buildings or other trees), a single opaque screen of no thickness,
// no atmospheric refraction and no diffuse light — "direct sun" means the sun's disc is above the
// geometric horizon and nothing in the model stands between it and the bed.
//
// Pure, no DOM; lib/ never imports components/.

import { OBLIQUITY_DEG, isValidEarthLatitude } from '@/lib/solar';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** The three days the figure compares. Solstice declinations are ±OBLIQUITY_DEG, as in deriveSolar. */
export type ShadeDayKey = 'december' | 'equinox' | 'june';
export const SHADE_DAY_KEYS: readonly ShadeDayKey[] = ['december', 'equinox', 'june'];

export function declinationDeg(day: ShadeDayKey): number {
  return day === 'december' ? -OBLIQUITY_DEG : day === 'june' ? OBLIQUITY_DEG : 0;
}

/** Length of the screen, metres (east–west). */
export const SCREEN_LENGTH_M = 8;
/** The beds, metres south of the screen's foot, measured at each bed's centre. */
export const BED_DISTANCES_M: readonly number[] = [1, 2, 3, 5, 8];
/** What the figure offers: a hedge, a wall, a tree row. */
export const SCREEN_HEIGHTS_M: readonly number[] = [2, 3, 6];
/** Sampling step for sun hours, hours (15 s). Midpoint rule; the error is under a minute. */
export const SAMPLE_STEP_H = 1 / 240;

export interface SunPosition {
  /** Degrees above the geometric horizon; negative below it. */
  altitudeDeg: number;
  /** Degrees clockwise from true north, 0 ≤ az < 360. */
  azimuthDeg: number;
}

/**
 * Sun altitude and azimuth.
 *   sin h = sin φ sin δ + cos φ cos δ cos H
 *   A     = atan2( −cos δ sin H ,  sin δ cos φ − cos δ sin φ cos H )        (from north, clockwise)
 * `hourAngleDeg` H is 15° per hour from solar noon: negative before noon (sun in the east), positive
 * after. φ is signed (negative south), so the same lines serve both hemispheres.
 */
export function sunPosition(latDeg: number, declDeg: number, hourAngleDeg: number): SunPosition {
  const phi = latDeg * DEG2RAD;
  const dec = declDeg * DEG2RAD;
  const H = hourAngleDeg * DEG2RAD;
  const sinH = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinH))) * RAD2DEG;
  const east = -Math.cos(dec) * Math.sin(H);
  const north = Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H);
  const azimuthDeg = ((Math.atan2(east, north) * RAD2DEG) % 360 + 360) % 360;
  return { altitudeDeg, azimuthDeg };
}

/** Local solar hour (0..24, 12 = solar noon) to hour angle in degrees. */
export const hourAngleOf = (solarHour: number) => (solarHour - 12) * 15;

/** Sunrise and sunset in local solar hours, geometric horizon: cos H0 = −tan φ tan δ. null when the
 *  sun never rises or never sets that day (inside the polar circles). */
export function sunriseSunset(latDeg: number, declDeg: number): { riseHour: number; setHour: number } | null {
  const c = -Math.tan(latDeg * DEG2RAD) * Math.tan(declDeg * DEG2RAD);
  if (!(Math.abs(c) < 1)) return null;
  const h0 = Math.acos(c) * RAD2DEG / 15;
  return { riseHour: 12 - h0, setHour: 12 + h0 };
}

export interface Point { x: number; y: number }

/** The ground shadow of the screen's top edge, as a quadrilateral: the foot, then the shifted foot.
 *  null when the sun is on or below the horizon (the shadow would be infinite or there is none). */
export function shadowPolygon(sun: SunPosition, heightM: number, lengthM = SCREEN_LENGTH_M): Point[] | null {
  if (!(sun.altitudeDeg > 0)) return null;
  const len = heightM / Math.tan(sun.altitudeDeg * DEG2RAD);
  const dx = -Math.sin(sun.azimuthDeg * DEG2RAD) * len;
  const dy = -Math.cos(sun.azimuthDeg * DEG2RAD) * len;
  const a = lengthM / 2;
  return [{ x: -a, y: 0 }, { x: a, y: 0 }, { x: a + dx, y: dy }, { x: -a + dx, y: dy }];
}

/** Is the ground point `distM` south of the screen's foot (and `xM` east of its centre) in direct sun?
 *  The ray from the point toward the sun meets the screen's plane (y = 0) at horizontal distance
 *  s = distM / cos A; it is blocked when that is within the screen's length and lower than its top. */
export function isSunlit(sun: SunPosition, heightM: number, distM: number, xM = 0, lengthM = SCREEN_LENGTH_M): boolean {
  if (!(sun.altitudeDeg > 0)) return false;
  const ux = Math.sin(sun.azimuthDeg * DEG2RAD);
  const uy = Math.cos(sun.azimuthDeg * DEG2RAD);
  if (uy <= 1e-12) return true; // the sun is level with or south of the screen's line: it cannot be between
  const s = distM / uy;
  const x = xM + s * ux;
  const blocked = Math.abs(x) <= lengthM / 2 && s * Math.tan(sun.altitudeDeg * DEG2RAD) < heightM;
  return !blocked;
}

export interface BedHours {
  distanceM: number;
  /** Hours of direct sun over the whole day. */
  sunHours: number;
  /** Hours the sun is up but the screen's shadow covers the bed. */
  shadedHours: number;
}

export interface ShadeDay {
  day: ShadeDayKey;
  latDeg: number;
  declDeg: number;
  heightM: number;
  riseHour: number;
  setHour: number;
  daylightHours: number;
  noon: {
    altitudeDeg: number;
    azimuthDeg: number;
    /** Ground length of the noon shadow, metres: height / tan(altitude) = height × shadowRatio. */
    shadowLengthM: number;
  };
  beds: BedHours[];
  /** Per bed: cumulative hours of direct sun from sunrise to `riseHour + i * SAMPLE_STEP_H`. */
  cumulative: Float32Array[];
}

/** One day: sunrise, sunset, the noon shadow and the sun each bed gets. */
export function shadeDay(
  latDeg: number,
  day: ShadeDayKey,
  heightM: number,
  bedDistancesM: readonly number[] = BED_DISTANCES_M,
): ShadeDay {
  if (!isValidEarthLatitude(latDeg)) throw new RangeError('Shade latitude must be a finite Earth latitude');
  const declDeg = declinationDeg(day);
  const rs = sunriseSunset(latDeg, declDeg);
  if (!rs) throw new RangeError('The sun does not rise and set on this day at this latitude');
  const daylightHours = rs.setHour - rs.riseHour;
  const n = Math.max(1, Math.round(daylightHours / SAMPLE_STEP_H));
  const step = daylightHours / n; // an exact whole number of steps from sunrise to sunset
  const noonSun = sunPosition(latDeg, declDeg, 0);
  const cumulative = bedDistancesM.map(() => new Float32Array(n + 1));
  const totals = bedDistancesM.map(() => 0);
  for (let i = 0; i < n; i += 1) {
    const sun = sunPosition(latDeg, declDeg, hourAngleOf(rs.riseHour + (i + 0.5) * step));
    bedDistancesM.forEach((d, b) => {
      if (isSunlit(sun, heightM, d)) totals[b] += step;
      cumulative[b][i + 1] = totals[b];
    });
  }
  return {
    day,
    latDeg,
    declDeg,
    heightM,
    riseHour: rs.riseHour,
    setHour: rs.setHour,
    daylightHours,
    noon: {
      altitudeDeg: noonSun.altitudeDeg,
      azimuthDeg: noonSun.azimuthDeg,
      shadowLengthM: heightM / Math.tan(noonSun.altitudeDeg * DEG2RAD),
    },
    beds: bedDistancesM.map((distanceM, b) => ({
      distanceM,
      sunHours: totals[b],
      shadedHours: daylightHours - totals[b],
    })),
    cumulative,
  };
}

/** Hours of direct sun a bed has had by `solarHour` (clamped to the day). */
export function sunHoursSoFar(d: ShadeDay, bedIndex: number, solarHour: number): number {
  const arr = d.cumulative[bedIndex];
  const n = arr.length - 1;
  const f = Math.max(0, Math.min(1, (solarHour - d.riseHour) / d.daylightHours)) * n;
  const i = Math.min(n - 1, Math.floor(f));
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
}

/** The same day at a moment: the sun, the shadow and which beds are lit right now. */
export function shadeAt(d: ShadeDay, solarHour: number, bedDistancesM: readonly number[] = BED_DISTANCES_M) {
  const sun = sunPosition(d.latDeg, d.declDeg, hourAngleOf(solarHour));
  const up = sun.altitudeDeg > 0;
  return {
    sun,
    up,
    shadowLengthM: up ? d.heightM / Math.tan(sun.altitudeDeg * DEG2RAD) : null,
    polygon: shadowPolygon(sun, d.heightM),
    lit: bedDistancesM.map((m) => isSunlit(sun, d.heightM, m)),
  };
}

/** "12:00" from a local solar hour. */
export function solarClock(solarHour: number): string {
  const total = Math.round(solarHour * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
