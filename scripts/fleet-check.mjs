#!/usr/bin/env node
/**
 * FLEET CHECK — generate site data for many real places and interrogate it.
 *
 * WHY THIS EXISTS. On 2026-08-06 the app was found to be serving the SAME
 * hardcoded soil profile — Loam / pH 6.5 / 1.2% OC — for every point on Earth,
 * for months, because one query parameter asked SoilGrids for a depth that does
 * not exist. 1828 unit tests passed throughout. They could not have caught it:
 * the code was doing exactly what it was written to do, and no test compared
 * the OUTPUT to the world.
 *
 * That is the shape of nearly every serious defect found in this codebase —
 * not a crash, but a plausible substitute carried forward in silence: a default
 * for a reading, a boolean for geometry, a cached image for a fresh render, a
 * task count for hours. The check that catches this class is not another unit
 * test. It is running the real pipeline against MANY real places and asserting
 * the answers differ in the ways they must.
 *
 * The core assertion is deliberately blunt: a field that comes back IDENTICAL
 * across sites on five continents is either a genuine constant or a bug, and
 * the code below says which it expects. One wrong parameter can hide behind a
 * single site forever; it cannot hide behind twenty.
 *
 * USAGE
 *   Start the dev server, then:  node scripts/fleet-check.mjs [baseUrl]
 *   Default baseUrl http://localhost:4349
 *
 * Exit code 1 if any check fails, so this can gate a release.
 *
 * NOTE ON RATE LIMITS — the upstreams (ISRIC, NASA POWER) are public and
 * unauthenticated, so requests are issued one at a time with a pause. This is
 * slow on purpose. It is a pre-release gate, not a unit test.
 */

const BASE = process.argv[2] ?? 'http://localhost:4349';
const PAUSE_MS = 1500;

/**
 * Real, rural, farmable places. Rural matters: SoilGrids masks built-up land
 * and open water, so a city centre legitimately returns no soil and would make
 * this check cry wolf. Spread across latitude, hemisphere, rainfall pattern and
 * soil order so that a value which is genuinely site-driven CANNOT come back
 * the same twice.
 */
const SITES = [
  { name: 'Ubhejane, KZN ZA', lat: -27.7262, lon: 31.9632 },
  { name: 'Ceres, W Cape ZA', lat: -33.55, lon: 19.15 },
  { name: 'Embu, Kenya', lat: -0.5143, lon: 37.4534 },
  { name: 'Zomba, Malawi', lat: -15.7, lon: 35.05 },
  { name: 'Flevoland, NL', lat: 52.5, lon: 5.55 },
  { name: 'Maharashtra, IN', lat: 20.5937, lon: 78.9629 },
  { name: 'Mato Grosso, BR', lat: -12.65, lon: -55.72 },
  { name: 'Iowa, USA', lat: 42.03, lon: -93.63 },
  { name: 'Riverina, AU', lat: -34.75, lon: 146.5 },
  { name: 'Andalusia, ES', lat: 37.55, lon: -4.75 },
  { name: 'Punjab, PK', lat: 30.75, lon: 73.1 },
  { name: 'Mekong Delta, VN', lat: 9.95, lon: 105.75 },
];

/**
 * Fields that MUST vary across the fleet, with the reason. If one of these
 * comes back with a single distinct value across twelve continents' worth of
 * farmland, something upstream is failing silently — which is precisely the
 * SoilGrids failure mode this file was written for.
 */
/**
 * Third element is the MINIMUM distinct values required.
 *
 * "More than one" is far too weak, and this file proved it on its own first
 * run: the Köppen classifier came back with just three codes for twelve
 * climates — no tropical A and no arid B anywhere, the Netherlands and
 * Andalusia both labelled 'Dwb' — and a bare `distinct > 1` reported that as
 * ok. The bug was visible in the printed table and invisible to the assertion.
 * So anything with a known spread states it: twelve farms on five continents
 * cannot share three climate codes, and if a future change collapses them
 * again this must fail rather than shrug.
 */
const MUST_VARY = [
  ['soil.ph', 'soil pH — identical everywhere means the soil fetch is failing and a default is being served', 5],
  ['soil.clay', 'clay %  — same', 5],
  ['soil.organicCarbon', 'organic carbon % — same', 5],
  ['soil.textureClass', 'texture class — same', 3],
  ['elevation.elevation', 'elevation — identical everywhere means the DEM lookup is failing', 5],
  ['rainfall.annual', 'annual rainfall — identical everywhere means the climatology fetch is failing', 5],
  ['climate.meanTemp', 'mean temperature — same', 5],
  // 6 is deliberately below the 8 currently achieved: this is a regression
  // floor, not a target to chase. Real world here spans Aw, BWh, BSk, Cfa,
  // Cfb, Csa, Csb and Dfa.
  ['climate.koppen', 'Köppen code — twelve climates on five continents cannot share so few codes', 6],
];

/**
 * Physical plausibility, checked at the value the app would PRINT.
 *
 * This is the check that would have caught organicCarbon: 18.18 — a units
 * error that produced a peat bog in a Zululand field and that no unit test
 * could see, because the number was arithmetically what the code asked for.
 * Bounds are deliberately generous: they trap an order-of-magnitude or
 * unit-conversion mistake, not an agronomic opinion.
 */
const RANGES = [
  ['soil.ph', 3, 10, 'pH'],
  ['soil.organicCarbon', 0, 30, '% organic carbon (>30% is peat, not farmland)'],
  ['soil.clay', 0, 100, '% clay'],
  ['soil.sand', 0, 100, '% sand'],
  ['soil.silt', 0, 100, '% silt'],
  ['soil.bulkDensity', 0.1, 2.5, 'g/cm³ bulk density'],
  ['elevation.elevation', -430, 8850, 'm elevation (Dead Sea to Everest)'],
  ['rainfall.annual', 0, 12000, 'mm/year'],
  ['climate.meanTemp', -30, 45, '°C mean temp'],
];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const failures = [];
  const notes = [];
  const rows = [];

  for (const site of SITES) {
    process.stdout.write(`  ${site.name.padEnd(20)}`);
    let data;
    try {
      const res = await fetch(`${BASE}/api/location-data?lat=${site.lat}&lon=${site.lon}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      failures.push(`${site.name}: request failed — ${err.message}`);
      console.log('REQUEST FAILED');
      continue;
    }
    rows.push({ site, data });

    const s = data.soil ?? {};
    console.log(
      `${String(s.textureClass ?? '?').padEnd(18)}pH ${String(s.ph ?? '?').padEnd(5)}`
      + `OC ${String(s.organicCarbon ?? '?').padEnd(6)}${String(data.climate?.koppen ?? '?').padEnd(5)}`
      + `${String(Math.round(data.rainfall?.annual ?? 0) + 'mm').padEnd(8)}src=${s.soilSource ?? 'UNDECLARED'}`,
    );

    // Provenance must be DECLARED. An undeclared source is the exact condition
    // that let a hardcoded constant pass as a SoilGrids reading for months.
    if (!s.soilSource) failures.push(`${site.name}: soil carries no soilSource — provenance undeclared`);

    // Texture fractions must close. A unit error on any one of them shows up
    // here long before anyone reads the number on a report.
    if (s.clay != null && s.sand != null && s.silt != null) {
      const sum = s.clay + s.sand + s.silt;
      if (Math.abs(sum - 100) > 3) {
        failures.push(`${site.name}: clay+sand+silt = ${sum.toFixed(1)}%, should total ~100`);
      }
    }

    for (const [path, lo, hi, label] of RANGES) {
      const v = get(data, path);
      if (v == null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
        failures.push(`${site.name}: ${path} = ${v} — outside plausible ${lo}..${hi} ${label}`);
      }
    }

    await sleep(PAUSE_MS);
  }

  if (rows.length < 3) {
    console.error('\nFATAL: fewer than 3 sites returned data — cannot judge variation.');
    process.exit(1);
  }

  console.log('\nVARIATION ACROSS THE FLEET');
  for (const [path, why, minDistinct] of MUST_VARY) {
    const values = rows.map((r) => get(r.data, path)).filter((v) => v != null);
    const distinct = new Set(values.map(String));
    const floor = Math.min(minDistinct ?? 2, values.length);
    const ok = distinct.size >= floor;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${path.padEnd(24)} ${distinct.size} distinct / ${values.length} sites`
      + `  (need >= ${floor})`,
    );
    if (!ok) {
      failures.push(
        `${path} has only ${distinct.size} distinct value(s) across ${values.length} sites, `
        + `expected at least ${floor} — ${why}. Values: ${[...distinct].slice(0, 6).join(', ')}`,
      );
    }
  }

  // Not a failure, but the number worth watching: how much of the fleet is
  // running on estimates rather than readings. A creeping rise here is an
  // upstream degrading quietly.
  const est = rows.filter((r) => r.data.soil?.soilSource === 'estimate').length;
  notes.push(`${est}/${rows.length} sites fell back to estimated soil.`);

  console.log('\n' + notes.join('\n'));
  if (failures.length) {
    console.error(`\n${failures.length} FAILURE(S):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nAll fleet checks passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
