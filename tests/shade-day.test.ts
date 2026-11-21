import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSolar, OBLIQUITY_DEG } from '../lib/solar.ts';
import { DEMO_COORDS } from '../lib/demo-site.ts';
import {
  BED_DISTANCES_M,
  SCREEN_LENGTH_M,
  SHADE_DAY_KEYS,
  declinationDeg,
  hourAngleOf,
  isSunlit,
  shadeAt,
  shadeDay,
  shadowPolygon,
  solarClock,
  sunHoursSoFar,
  sunPosition,
  sunriseSunset,
  type ShadeDayKey,
} from '../lib/shade-day.ts';

const LAT = DEMO_COORDS.lat; // -28.628, Ezakheni
const SOLAR_KEY: Record<ShadeDayKey, 'summer' | 'equinox' | 'winter'> = { december: 'summer', equinox: 'equinox', june: 'winter' };

function close(actual: number, expected: number, tol: number, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${actual} to be within ${tol} of ${expected}`);
}

test('the example farm is the latitude the figure is built for', () => {
  assert.equal(LAT, -28.628);
});

// ── (1) Agreement with lib/solar.ts ───────────────────────────────────────────────────────────
test('sunPosition agrees with deriveSolar at noon, at sunrise and in the noon shadow ratio, all three days', () => {
  const model = deriveSolar(LAT);
  for (const day of SHADE_DAY_KEYS) {
    const path = model[SOLAR_KEY[day]];
    const decl = declinationDeg(day);
    close(decl, path.declDeg, 1e-12, `${day} declination`);

    const noon = sunPosition(LAT, decl, 0);
    close(noon.altitudeDeg, path.noonAltitudeDeg, 1e-9, `${day} noon altitude`);
    close(1 / Math.tan((noon.altitudeDeg * Math.PI) / 180), path.shadowRatio!, 1e-9, `${day} shadow ratio`);

    const rs = sunriseSunset(LAT, decl)!;
    const rise = sunPosition(LAT, decl, hourAngleOf(rs.riseHour));
    const set = sunPosition(LAT, decl, hourAngleOf(rs.setHour));
    close(rise.altitudeDeg, 0, 1e-9, `${day} sunrise altitude`);
    close(set.altitudeDeg, 0, 1e-9, `${day} sunset altitude`);
    close(rise.azimuthDeg, path.sunriseAzDeg!, 1e-9, `${day} sunrise azimuth`);
    close(set.azimuthDeg, path.sunsetAzDeg!, 1e-9, `${day} sunset azimuth`);
  }
});

// ── (2) Agreement with an independent method ──────────────────────────────────────────────────
// The NOAA Global Monitoring Laboratory solar-position equations (the "General Solar Position
// Calculations" sheet: fractional-year Fourier series for the equation of time and declination, then
// the zenith and azimuth formulae), written out separately here. They use the REAL declination on
// the real date; the figure uses the exact solstice/equinox constants, so a small difference is
// expected and is what the tolerance covers. NOAA's hour angle is fed to sunPosition so the
// comparison isolates declination, altitude and azimuth (the figure's clock is solar time).
function noaa(latDeg: number, lonDeg: number, year: number, month: number, day: number, utcHour: number) {
  const rad = Math.PI / 180;
  const start = Date.UTC(year, 0, 1);
  const doy = Math.floor((Date.UTC(year, month - 1, day) - start) / 86400000) + 1;
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (utcHour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = utcHour * 60 + eqtime + 4 * lonDeg; // minutes, true solar time at this longitude
  const ha = tst / 4 - 180; // degrees, 0 at solar noon
  const phi = latDeg * rad;
  const cosZen = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha * rad);
  const zen = Math.acos(cosZen);
  const a = Math.acos((Math.sin(phi) * cosZen - Math.sin(decl)) / (Math.cos(phi) * Math.sin(zen))) / rad;
  const az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  return { declDeg: decl / rad, hourAngleDeg: ha, altitudeDeg: 90 - zen / rad, azimuthDeg: az };
}

test('sunPosition agrees with the NOAA solar-position equations on real dates (≤ 0.3° at the solstices, ≤ 0.6° at the equinox)', () => {
  // The solstice declination barely moves across the day (and sits within ~0.1° of the constant used).
  // At the equinox it moves ~0.4° a day, and the samples run up to 11 hours either side of the instant
  // the real declination is zero (20 March 2026, 14:46 UTC), so the low morning sun is allowed more.
  const tolFor = (day: ShadeDayKey) => (day === 'equinox' ? 0.6 : 0.3);
  const lon = DEMO_COORDS.lon;
  // 21 December and 21 June 2026 (the solstices fall on those dates), and 20 March 2026 (equinox).
  const dates: [number, number, number][] = [[2026, 12, 21], [2026, 6, 21], [2026, 3, 20]];
  const utcHours = [3.5, 5, 6.5, 8, 9.5, 11, 12.5, 14, 15.5];
  let worstAlt = 0;
  let worstAz = 0;
  const perDay: Record<string, number> = {};
  let compared = 0;
  for (const [y, m, d] of dates) {
    const day: ShadeDayKey = m === 12 ? 'december' : m === 6 ? 'june' : 'equinox';
    for (const h of utcHours) {
      const ref = noaa(LAT, lon, y, m, d, h);
      if (ref.altitudeDeg < 2) continue; // refraction and the horizon make the first degrees ill-defined
      const mine = sunPosition(LAT, declinationDeg(day), ref.hourAngleDeg);
      const dAlt = Math.abs(mine.altitudeDeg - ref.altitudeDeg);
      worstAlt = Math.max(worstAlt, dAlt);
      perDay[day] = Math.max(perDay[day] ?? 0, dAlt);
      assert.ok(dAlt <= tolFor(day), `${day} utc ${h}: altitude ${mine.altitudeDeg} vs NOAA ${ref.altitudeDeg}`);
      // Azimuth is meaningless within ~10° of the zenith (December noon is 84.8° high): skip there.
      if (ref.altitudeDeg < 80) {
        const dAz = Math.min(Math.abs(mine.azimuthDeg - ref.azimuthDeg), 360 - Math.abs(mine.azimuthDeg - ref.azimuthDeg));
        worstAz = Math.max(worstAz, dAz);
        assert.ok(dAz <= tolFor(day), `${day} utc ${h}: azimuth ${mine.azimuthDeg} vs NOAA ${ref.azimuthDeg}`);
      }
      compared += 1;
    }
  }
  assert.ok(compared >= 18, `only ${compared} samples compared`);
  console.log(`# NOAA check: ${compared} samples, worst altitude error ${worstAlt.toFixed(3)}°, worst azimuth error ${worstAz.toFixed(3)}° (worst altitude by day: ${Object.entries(perDay).map(([k, v]) => `${k} ${v.toFixed(3)}°`).join(', ')})`);
});

// ── (3) The headline numbers the figure prints, pinned ────────────────────────────────────────
test('3 m screen: noon shadow lengths, hours of daylight and sun hours per bed are pinned', () => {
  const D = shadeDay(LAT, 'december', 3);
  const E = shadeDay(LAT, 'equinox', 3);
  const J = shadeDay(LAT, 'june', 3);
  close(D.noon.shadowLengthM, 0.2726, 0.001);
  close(E.noon.shadowLengthM, 1.6376, 0.001);
  close(J.noon.shadowLengthM, 3.8487, 0.001);
  close(D.noon.altitudeDeg, 84.81, 0.01);
  close(E.noon.altitudeDeg, 61.37, 0.01);
  close(J.noon.altitudeDeg, 37.94, 0.01);
  close(J.noon.shadowLengthM / D.noon.shadowLengthM, 14.12, 0.02);
  close(D.daylightHours, 13.8249, 0.001);
  close(E.daylightHours, 12, 1e-9);
  close(J.daylightHours, 10.1751, 0.001);
  close(D.riseHour, 5.0876, 0.001);
  close(J.riseHour, 6.9124, 0.001);
  assert.deepEqual([...BED_DISTANCES_M], [1, 2, 3, 5, 8]);
  const hours = (r: typeof D) => r.beds.map((b) => b.sunHours);
  const TOL = 0.02; // hours: the 15-second midpoint rule is good to a few seconds
  [13.8249, 13.8249, 13.8249, 13.8249, 13.8249].forEach((v, i) => close(hours(D)[i], v, TOL, `Dec bed ${i}`));
  [3.675, 12, 12, 12, 12].forEach((v, i) => close(hours(E)[i], v, TOL, `Equinox bed ${i}`));
  [0, 0, 2.4584, 10.1751, 10.1751].forEach((v, i) => close(hours(J)[i], v, TOL, `Jun bed ${i}`));
  // 6 m row of trees, June: a bed at 5 m still loses five hours.
  const J6 = shadeDay(LAT, 'june', 6);
  [0, 0, 2.4584, 5.175, 9.3584].forEach((v, i) => close(J6.beds[i].sunHours, v, TOL, `Jun 6 m bed ${i}`));
  // 2 m hedge, June.
  const J2 = shadeDay(LAT, 'june', 2);
  [0, 0, 7.025, 10.1751, 10.1751].forEach((v, i) => close(J2.beds[i].sunHours, v, TOL, `Jun 2 m bed ${i}`));
});

// ── (4) Sanity ────────────────────────────────────────────────────────────────────────────────
test('at this latitude the noon sun is due north on all three days, so noon shadows point south', () => {
  for (const day of SHADE_DAY_KEYS) {
    const noon = sunPosition(LAT, declinationDeg(day), 0);
    close(noon.azimuthDeg, 0, 1e-9, `${day} noon azimuth (0 = true north)`);
    const poly = shadowPolygon(noon, 3)!;
    // The far edge of the shadow is south (y < 0) of the screen's foot (y = 0), and not sideways.
    assert.ok(poly[2].y < 0 && poly[3].y < 0, `${day}: noon shadow must lie south of the screen`);
    close(poly[2].x, SCREEN_LENGTH_M / 2, 1e-9);
    // The sun is never south of the zenith here: even at midsummer the noon altitude stays below 90.
    assert.ok(noon.altitudeDeg < 90);
  }
});

test('the December sun rises south of east and sets south of west; June and the equinox as they should', () => {
  const d = sunriseSunset(LAT, declinationDeg('december'))!;
  const rise = sunPosition(LAT, declinationDeg('december'), hourAngleOf(d.riseHour));
  const set = sunPosition(LAT, declinationDeg('december'), hourAngleOf(d.setHour));
  assert.ok(rise.azimuthDeg > 90 && rise.azimuthDeg < 180, `December sunrise ${rise.azimuthDeg}`);
  assert.ok(set.azimuthDeg > 180 && set.azimuthDeg < 270, `December sunset ${set.azimuthDeg}`);
  const j = sunriseSunset(LAT, declinationDeg('june'))!;
  const jr = sunPosition(LAT, declinationDeg('june'), hourAngleOf(j.riseHour));
  assert.ok(jr.azimuthDeg < 90, `June sunrise ${jr.azimuthDeg} is north of east`);
  const e = sunriseSunset(LAT, 0)!;
  close(sunPosition(LAT, 0, hourAngleOf(e.riseHour)).azimuthDeg, 90, 1e-9);
  close(e.setHour - e.riseHour, 12, 1e-9);
  assert.equal(OBLIQUITY_DEG, 23.4359);
});

test('the day is symmetric about solar noon and the sun climbs to it', () => {
  for (const day of SHADE_DAY_KEYS) {
    const decl = declinationDeg(day);
    let prev = -Infinity;
    for (let h = -5; h <= 0; h += 0.5) {
      const a = sunPosition(LAT, decl, h * 15);
      const b = sunPosition(LAT, decl, -h * 15);
      close(a.altitudeDeg, b.altitudeDeg, 1e-9);
      if (h !== 0) close(a.azimuthDeg + b.azimuthDeg, 360, 1e-9, 'mirror azimuth');
      if (a.altitudeDeg > 0) { assert.ok(a.altitudeDeg >= prev); prev = a.altitudeDeg; }
    }
  }
});

// ── The shadow, the beds and the bookkeeping ──────────────────────────────────────────────────
function inQuad(p: { x: number; y: number }, q: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < q.length; i += 1) {
    const a = q[i]; const b = q[(i + 1) % q.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

test('a bed is shaded exactly when it lies inside the drawn shadow polygon', () => {
  for (const day of SHADE_DAY_KEYS) {
    for (const height of [2, 3, 6]) {
      for (let t = 5; t <= 19; t += 0.173) {
        const sun = sunPosition(LAT, declinationDeg(day), hourAngleOf(t));
        const poly = shadowPolygon(sun, height);
        for (const dist of [0.5, 1, 2, 3, 5, 8]) {
          const lit = isSunlit(sun, height, dist);
          if (!poly) { assert.equal(lit, false); continue; }
          const inside = inQuad({ x: 0, y: -dist }, poly);
          assert.equal(lit, !inside, `${day} ${height} m at ${t.toFixed(2)} h, bed ${dist} m: lit ${lit}, inside ${inside}`);
        }
      }
    }
  }
});

test('sun hours: a far bed gets the whole day, a taller screen only ever takes more, the running total ends at the day total', () => {
  for (const day of SHADE_DAY_KEYS) {
    const far = shadeDay(LAT, day, 3, [60]);
    close(far.beds[0].sunHours, far.daylightHours, 0.02);
    let last: number[] | null = null;
    for (const height of [2, 3, 6]) {
      const r = shadeDay(LAT, day, height);
      r.beds.forEach((b, i) => {
        close(b.sunHours + b.shadedHours, r.daylightHours, 1e-9);
        if (last) assert.ok(b.sunHours <= last[i] + 1e-9, `${day}: a taller screen cannot give a bed more sun`);
      });
      last = r.beds.map((b) => b.sunHours);
      // Running total: zero at sunrise, the day total at sunset, never decreasing.
      r.beds.forEach((b, i) => {
        close(sunHoursSoFar(r, i, r.riseHour), 0, 1e-9);
        close(sunHoursSoFar(r, i, r.setHour), b.sunHours, 1e-3);
        let prev = 0;
        for (let t = r.riseHour; t <= r.setHour; t += 0.25) {
          const v = sunHoursSoFar(r, i, t);
          assert.ok(v >= prev - 1e-9); prev = v;
        }
      });
    }
  }
});

test('a bed further from the screen never gets less sun than a nearer one', () => {
  for (const day of SHADE_DAY_KEYS) {
    for (const height of [2, 3, 6]) {
      const r = shadeDay(LAT, day, height);
      for (let i = 1; i < r.beds.length; i += 1) assert.ok(r.beds[i].sunHours >= r.beds[i - 1].sunHours - 0.02 || r.beds[i - 1].distanceM < 2, `${day} ${height}`);
    }
  }
});

test('shadeAt at noon reports the noon shadow, and at night nothing', () => {
  const r = shadeDay(LAT, 'june', 3);
  const noon = shadeAt(r, 12);
  close(noon.shadowLengthM!, r.noon.shadowLengthM, 1e-9);
  assert.deepEqual(noon.lit, [false, false, false, true, true]);
  const night = shadeAt(r, 2);
  assert.equal(night.up, false);
  assert.equal(night.polygon, null);
  assert.equal(solarClock(12), '12:00');
  assert.equal(solarClock(5.0876), '05:05');
});

test('guards: bad latitude and a day with no sunrise throw', () => {
  assert.throws(() => shadeDay(Number.NaN, 'june', 3), RangeError);
  assert.throws(() => shadeDay(-80, 'december', 3), RangeError);
});
