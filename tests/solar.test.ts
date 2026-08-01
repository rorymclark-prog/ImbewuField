import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSolar, isValidEarthLatitude, OBLIQUITY_DEG, sunArcApexFraction, SUN_ARC_MIN_BULGE } from '../lib/solar.ts';

const TOL = 0.05; // deg, per SECTOR-MODEL-SPEC-2026-07-21.md §1's unit-test table

function close(actual: number, expected: number, tol = TOL, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    msg ?? `expected ${actual} to be within ${tol} of ${expected}`,
  );
}

// ── Primary worked-example table: φ = -29.783° (SECTOR-MODEL-SPEC §1) ────────────────────────
test('deriveSolar(-29.783) matches the spec worked-example table exactly', () => {
  const s = deriveSolar(-29.783);

  assert.equal(s.usable, true);

  // December — SH summer: δ = -23.4359°
  close(s.summer.declDeg, -23.4359);
  close(s.summer.sunriseAzDeg!, 117.27);
  close(s.summer.sunsetAzDeg!, 242.73);
  assert.equal(s.summer.riseLabel16, 'ESE');
  assert.equal(s.summer.setLabel16, 'WSW');
  close(s.summer.sweepDeg!, 234.55);
  close(s.summer.noonAltitudeDeg, 83.65);
  assert.equal(s.summer.noonSide, 'N');
  close(s.summer.shadowRatio!, 0.110, 0.01);

  // June — SH winter: δ = +23.4359°
  close(s.winter.declDeg, 23.4359);
  close(s.winter.sunriseAzDeg!, 62.73);
  close(s.winter.sunsetAzDeg!, 297.27);
  assert.equal(s.winter.riseLabel16, 'ENE');
  assert.equal(s.winter.setLabel16, 'WNW');
  close(s.winter.sweepDeg!, 125.45);
  close(s.winter.noonAltitudeDeg, 36.78);
  assert.equal(s.winter.noonSide, 'N');
  close(s.winter.shadowRatio!, 1.338, 0.01);

  // Equinox
  close(s.equinox.declDeg, 0);
  close(s.equinox.sunriseAzDeg!, 90.0);
  close(s.equinox.sunsetAzDeg!, 270.0);
  assert.equal(s.equinox.riseLabel16, 'E');
  assert.equal(s.equinox.setLabel16, 'W');
  close(s.equinox.sweepDeg!, 180.0);
  close(s.equinox.noonAltitudeDeg, 60.22);
  assert.equal(s.equinox.noonSide, 'N');
  close(s.equinox.shadowRatio!, 0.571, 0.01);

  assert.equal(s.middayFrom, 'N');

  // Intermediate constants the spec calls out explicitly. cos φ matches the spec's stated
  // 0.867913 exactly. The spec's stated "sin ε = 0.397789" is sin(23.44°) — the popular rounded
  // obliquity — not sin(OBLIQUITY_DEG=23.4359°), which is 0.397723; the worked rise/set azimuths
  // in this same table match to spec tolerance using the precise 23.4359° constant (asserted
  // above), so that's the value pinned here, not the doc's rounded aside.
  close(Math.cos((-29.783 * Math.PI) / 180), 0.867913, 0.000001);
  close(Math.sin((OBLIQUITY_DEG * Math.PI) / 180), 0.397723, 0.000001);
});

// ── Equator ────────────────────────────────────────────────────────────────────────────────
test('deriveSolar(0) — equator: rise/set are mirror images of each other about due E/W', () => {
  const s = deriveSolar(0);
  assert.equal(s.usable, true);
  // At the equator the two solstices swing an equal 23.4359° off due east/west, one to either
  // side (physically required: cos A_rise = sin δ / cos φ = sin δ when φ=0, and sin δ flips
  // sign between the two solstices by definition). At exactly φ=0 the hemisphere sign test
  // (`latDeg < 0`, matching lib/sector.ts's own `sh` test) is false, so 'summer' maps to the
  // June solstice (δ=+ε) here, same convention as everywhere else in this codebase.
  close(s.summer.sunriseAzDeg!, 66.56);
  close(s.summer.sunsetAzDeg!, 293.44);
  close(s.winter.sunriseAzDeg!, 113.44);
  close(s.winter.sunsetAzDeg!, 246.56);
});

// ── Inside the tropics: |lat| < 23.4359° ──────────────────────────────────────────────────────
test('deriveSolar(-22) — inside the tropics: the solstices disagree on noon side → mixed', () => {
  const s = deriveSolar(-22);
  assert.equal(s.usable, true);
  // The whole point of this case: at a latitude equatorward of its own tropic, the LOCAL-SUMMER
  // solstice's declination (-23.4359°, more southerly than the site itself) puts the sun south
  // of the site at noon — the flip the old `sh ? 'N' : 'S'` hardcode could never produce.
  assert.equal(s.summer.noonSide, 'S');
  assert.equal(s.winter.noonSide, 'N');
  assert.equal(s.middayFrom, 'mixed');
});

// ── Inside the polar circle ────────────────────────────────────────────────────────────────
test('deriveSolar(-70) — inside the polar circle: unusable, azimuths null, altitude still defined', () => {
  const s = deriveSolar(-70);
  assert.equal(s.usable, false);
  assert.equal(s.winter.sunriseAzDeg, null);
  assert.equal(s.winter.sunsetAzDeg, null);
  assert.equal(s.winter.riseLabel16, null);
  close(s.winter.noonAltitudeDeg, -3.44);
});

test('solar geometry accepts exactly finite Earth latitudes', () => {
  assert.equal(isValidEarthLatitude(-90), true);
  assert.equal(isValidEarthLatitude(90), true);

  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -91,
    91,
  ]) {
    assert.equal(isValidEarthLatitude(invalid), false);
    assert.throws(() => deriveSolar(invalid), /finite Earth latitude/i);
  }
});

test('every real latitude yields only finite or explicitly absent solar geometry', () => {
  for (let lat = -90; lat <= 90; lat += 0.25) {
    const model = deriveSolar(lat);
    for (const path of [model.summer, model.winter, model.equinox]) {
      assert.ok(Number.isFinite(path.declDeg));
      assert.ok(Number.isFinite(path.noonAltitudeDeg));
      assert.ok(path.shadowRatio === null || (Number.isFinite(path.shadowRatio) && path.shadowRatio >= 0));
      for (const bearing of [path.sunriseAzDeg, path.sunsetAzDeg, path.sweepDeg]) {
        assert.ok(bearing === null || (Number.isFinite(bearing) && bearing >= 0 && bearing <= 360));
      }
      assert.equal(path.sunriseAzDeg === null, path.sunsetAzDeg === null);
      if (path.sunriseAzDeg !== null && path.sunsetAzDeg !== null) {
        close(path.sunriseAzDeg + path.sunsetAzDeg, 360);
      }
    }
  }
});

// ── The drawn sun arc must clear its own rise/set chord ─────────────────────────────────────────
//
// A plan-view sun path is a curve from the sunrise bearing, through the noon sun, to the sunset
// bearing. Placing that noon point by altitude ALONE (a fraction of the ring radius, measured from
// the centre) is what shipped, and it is wrong for a low sun: at 28°S the June sun rises at 063°
// and sets at 297°, so both ends already sit 45% of the way toward the noon side, while a 39°
// altitude only lifts the apex 43%. The apex landed BEHIND its own endpoints and the arc drew as a
// flat dashed rule across the map. Rory: "can you put the winter sun as well properly with angle".

test('a low winter sun still bulges past its own chord', () => {
  const winter = deriveSolar(-27.7).winter;
  assert.ok(winter.sunriseAzDeg != null);
  // How far the rise/set ends already lie toward the noon side (noon is north at 28°S).
  const chord = Math.cos((winter.sunriseAzDeg! * Math.PI) / 180);
  const apex = sunArcApexFraction(winter.noonAltitudeDeg, chord);
  assert.ok(apex >= chord + SUN_ARC_MIN_BULGE, `apex ${apex} must clear chord ${chord}`);
});

test('summer always draws higher than winter at the same site', () => {
  for (const lat of [-34, -27.7, -20, -5, 5, 20, 34, 51]) {
    const { summer, winter } = deriveSolar(lat);
    if (summer.sunriseAzDeg == null || winter.sunriseAzDeg == null) continue;
    // Compare each season against its OWN noon side, which differs inside the tropics.
    const chordOf = (az: number, north: boolean) => (north ? 1 : -1) * Math.cos((az * Math.PI) / 180);
    const s = sunArcApexFraction(summer.noonAltitudeDeg, chordOf(summer.sunriseAzDeg, summer.noonSide !== 'S'));
    const w = sunArcApexFraction(winter.noonAltitudeDeg, chordOf(winter.sunriseAzDeg, winter.noonSide !== 'S'));
    assert.ok(s > w, `at ${lat}°: summer apex ${s} must sit higher than winter ${w}`);
  }
});

test('the apex fraction is monotonic in altitude and survives junk input', () => {
  assert.ok(sunArcApexFraction(80, 0) > sunArcApexFraction(40, 0));
  assert.ok(sunArcApexFraction(40, 0) > sunArcApexFraction(10, 0));
  assert.equal(sunArcApexFraction(Number.NaN, 0), 0.28);
  assert.equal(sunArcApexFraction(0, Number.NaN), 0.28);
  assert.ok(sunArcApexFraction(200, 0) <= 1);
});
