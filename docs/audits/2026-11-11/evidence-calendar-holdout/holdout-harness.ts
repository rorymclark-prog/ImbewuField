// Held-out test of the sowing-calendar rule. Places and criteria: holdout-places.json,
// committed before this script fetched anything.
//
// Run from the repo root:
//   OUT=<cache-and-output-dir> node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-calendar-holdout/holdout-harness.ts
//
// For each place it (1) calls the app's own fetchNasaPower, the call /api/location-data
// makes, and puts the answer through the app's own siteClimateFromLocationData; (2) fetches
// ERA5 daily minimum, mean and rain for 2001-2020 from the Open-Meteo archive; (3) judges the
// calendar against criteria H-A to H-D; (4) reports, without judging, the calendar the same
// rule gives on ERA5's own monthly values, and month overlap with the regional guide.
// Raw responses are cached in OUT/cache; delete a file to refetch it.
import fs from 'node:fs';
import path from 'node:path';
import { fetchNasaPower } from '@/lib/nasa-power';
import { siteClimateFromLocationData } from '@/lib/site-climate';
import { CROPS, type RainPattern } from '@/lib/crop-catalog';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = process.env.OUT || path.join(HERE, 'out');
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

interface Place { name: string; lat: number; lon: number; guideRegion: string | null }
const PLACES: Place[] = JSON.parse(fs.readFileSync(path.join(HERE, 'holdout-places.json'), 'utf8')).places;
const GUIDE = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/crop-sources/_sansor-sowing-guide.json'), 'utf8')) as {
  rows: Record<string, { row: string; cells: string[] }>;
};
// Short region names in the guide's column order, as in the 10 November audit's compare-sansor.py.
const REGIONS = ['Highveld', 'Middleveld', 'Lowveld', 'N Cape & Great Karoo', 'KZN Midlands', 'E Cape & Little Karoo', 'W Cape & South Coast', 'KZN & Coast'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const slug = (p: Place) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A guide cell ("Aug-Oct, Jan-Mar", "-") as a set of month numbers. Same reading as compare-sansor.py. */
function guideMonths(cell: string): Set<number> {
  const months = new Set<number>();
  for (const raw of cell.split(',')) {
    const part = raw.trim();
    if (!part || part === '-') continue;
    const ends = part.split(/\s*[-–]\s*/);
    const from = MON.indexOf(ends[0].toLowerCase().slice(0, 3)) + 1;
    const to = MON.indexOf(ends[ends.length - 1].toLowerCase().slice(0, 3)) + 1;
    if (!from || !to) throw new Error(`unreadable guide cell: ${cell}`);
    for (let m = from; ; m = (m % 12) + 1) { months.add(m); if (m === to) break; }
  }
  return months;
}

async function nasa(p: Place): Promise<{ payload: any | null; reason: string | null }> {
  const file = path.join(CACHE, `nasa_${slug(p)}.json`);
  if (fs.existsSync(file)) return { payload: JSON.parse(fs.readFileSync(file, 'utf8')), reason: null };
  let reason = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const payload = await fetchNasaPower(p.lat, p.lon);
      fs.writeFileSync(file, JSON.stringify(payload));
      return { payload, reason: null };
    } catch (error: any) { reason = `fetchNasaPower attempt ${attempt}: ${error?.message ?? error}`; await sleep(2000 * attempt); }
  }
  return { payload: null, reason };
}

async function era5(p: Place): Promise<{ json: any | null; reason: string | null; fatal?: boolean }> {
  const file = path.join(CACHE, `era5_${slug(p)}.json`);
  if (fs.existsSync(file)) return { json: JSON.parse(fs.readFileSync(file, 'utf8')), reason: null };
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}&start_date=2001-01-01&end_date=2020-12-31&daily=temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto`;
  let reason = '';
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.ok) { const json = await res.json(); fs.writeFileSync(file, JSON.stringify(json)); return { json, reason: null }; }
      const body = (await res.text()).slice(0, 200);
      reason = `HTTP ${res.status} ${body}`;
      if (res.status === 429 || res.status >= 500) {
        if (/daily/i.test(body)) return { json: null, reason: `daily limit: ${reason}`, fatal: true };
        const wait = /hourly/i.test(body) ? 300000 : Math.min(30000 * 2 ** (attempt - 1), 300000);
        console.log(`  ${p.name}: ${reason} -> waiting ${wait / 1000}s (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }
      return { json: null, reason };
    } catch (error: any) { reason = `fetch error: ${error?.message ?? error}`; await sleep(15000 * attempt); }
  }
  return { json: null, reason: `gave up: ${reason}` };
}

function era5Stats(json: any) {
  const d = json?.daily;
  if (!d?.time) return null;
  const minByMonth: number[][] = Array.from({ length: 12 }, () => []);
  const meanByMonth: number[][] = Array.from({ length: 12 }, () => []);
  const rainByMonth = new Array(12).fill(0);
  const frostByMonth = new Array(12).fill(0);
  const frostYears = new Set<number>();
  const years = new Set<number>();
  let lowest = Infinity; let frostDays = 0; let missing = 0;
  for (let i = 0; i < d.time.length; i++) {
    const year = +d.time[i].slice(0, 4); const month = +d.time[i].slice(5, 7) - 1;
    years.add(year);
    const tn = d.temperature_2m_min[i]; const tm = d.temperature_2m_mean[i]; const pr = d.precipitation_sum[i];
    if (tn == null || tm == null || pr == null) missing++;
    if (tn != null) {
      minByMonth[month].push(tn);
      if (tn < lowest) lowest = tn;
      if (tn <= 0) { frostDays++; frostByMonth[month]++; frostYears.add(year); }
    }
    if (tm != null) meanByMonth[month].push(tm);
    if (pr != null) rainByMonth[month] += pr;
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const n = years.size;
  return {
    years: n, missingDays: missing, gridLat: json.latitude, gridLon: json.longitude, gridElevationM: json.elevation,
    airFrostDaysPerYear: r2(frostDays / n), lowestDailyMinC: r1(lowest), yearsWithFrost: frostYears.size,
    airFrostDaysPerYearByMonth: frostByMonth.map((v) => r2(v / n)),
    monthlyMeanC: meanByMonth.map((a) => r2(mean(a))), monthlyRainMm: rainByMonth.map((v) => r1(v / n)),
  };
}

const rows: any[] = [];
let era5Blocked: string | null = null;
for (const p of PLACES) {
  const row: any = { name: p.name, lat: p.lat, lon: p.lon, guideRegion: p.guideRegion };
  rows.push(row);
  const { payload, reason } = await nasa(p);
  if (!payload) { row.app = null; row.appFailure = reason; console.log(`${p.name}: NO APP READING (${reason})`); continue; }
  const site = siteClimateFromLocationData({ rainfall: payload.rainfall, climate: payload.climate }, p.lat);
  if (!site) { row.app = null; row.appFailure = 'siteClimateFromLocationData returned null'; console.log(`${p.name}: app could not classify`); continue; }
  row.app = {
    pattern: site.pattern, rainSeason: site.rainSeason, closeCall: site.closeCall, warmerNeighbour: site.warmerNeighbour,
    coldestMonthC: site.coldestMonthC, hottestMonthC: site.hottestMonthC, recordMinC: site.recordMinC, annualMm: site.annualMm,
    koppen: site.koppen, rainfallSource: site.rainfallSource, monthlyTempC: site.monthlyTempC, monthlyRainMm: site.monthlyRainMm,
  };

  if (era5Blocked) { row.era5 = null; row.era5Failure = era5Blocked; continue; }
  const got = await era5(p);
  if (!got.json) { row.era5 = null; row.era5Failure = got.reason; if (got.fatal) era5Blocked = got.reason; console.log(`${p.name}: NO ERA5 (${got.reason})`); continue; }
  const e = era5Stats(got.json)!;
  row.era5 = e;

  // Reported, not judged: the same rule on ERA5's own monthly values. The rule only accepts a
  // record minimum tagged as NASA POWER's, so ERA5's lowest daily minimum is passed under that
  // tag here. That is a device of this harness, not something the app does.
  const onEra5 = siteClimateFromLocationData({
    rainfall: { rainfallSource: 'open-meteo', monthly: e.monthlyRainMm },
    climate: { monthlyTemp: e.monthlyMeanC, monthlyTempCoverage: { source: 'nasa-power', status: 'complete' }, minTemp: e.lowestDailyMinC, minTempSource: 'nasa-power' },
  }, p.lat);
  row.patternOnEra5Values = onEra5?.pattern ?? null;

  const fails: string[] = [];
  const pattern: RainPattern = site.pattern;
  if (pattern === 'all-year' && (e.airFrostDaysPerYear > 0 || e.lowestDailyMinC <= 0)) fails.push('H-A');
  if (pattern === 'mild-frost' && e.airFrostDaysPerYear >= 0.5) fails.push('H-B');
  if (e.airFrostDaysPerYear >= 1 && pattern !== 'summer' && pattern !== 'winter') fails.push('H-C');
  if (pattern === 'summer' && e.yearsWithFrost === 0 && e.lowestDailyMinC > 0 && site.recordMinC !== null && site.recordMinC > 0) fails.push('H-D');
  row.failed = fails;

  if (p.guideRegion) {
    const column = REGIONS.indexOf(p.guideRegion);
    if (column < 0) throw new Error(`unknown guide region for ${p.name}: ${p.guideRegion}`);
    let both = 0; let appOnly = 0; let guideOnly = 0; let scored = 0; const noOverlap: any[] = [];
    for (const [key, guideRow] of Object.entries(GUIDE.rows)) {
      const crop = CROPS.find((c) => c.key === key);
      if (!crop) throw new Error(`guide row ${key} has no crop in the catalogue`);
      const ref = guideMonths(guideRow.cells[column]);
      const app = new Set(crop.sowMonths[pattern]);
      if (!ref.size && !app.size) continue;
      scored++;
      for (const m of app) { if (ref.has(m)) both++; else appOnly++; }
      for (const m of ref) if (!app.has(m)) guideOnly++;
      if (app.size && ref.size && both >= 0 && ![...app].some((m) => ref.has(m))) {
        noOverlap.push({ crop: crop.name, appMonths: [...app].sort((a, b) => a - b), guideMonths: [...ref].sort((a, b) => a - b) });
      }
    }
    row.guide = { region: p.guideRegion, cropsScored: scored, monthsBoth: both, monthsAppOnly: appOnly, monthsGuideOnly: guideOnly, noOverlap };
  }
  console.log(`${p.name.padEnd(26)} ${pattern.padEnd(11)} era5 frost ${String(e.airFrostDaysPerYear).padStart(6)}/yr lowest ${String(e.lowestDailyMinC).padStart(6)}  record min ${site.recordMinC}  ${fails.length ? 'FAIL ' + fails.join(',') : 'pass'}`);
}

fs.writeFileSync(path.join(OUT, 'holdout-results.json'), JSON.stringify({
  ranAt: new Date().toISOString(), places: rows.length,
  withAppReading: rows.filter((r) => r.app).length, withEra5: rows.filter((r) => r.era5).length,
  failed: rows.filter((r) => r.failed?.length).map((r) => ({ name: r.name, failed: r.failed })),
  rows,
}, null, 1) + '\n');
console.log(`\n${rows.length} places; app reading ${rows.filter((r) => r.app).length}; ERA5 ${rows.filter((r) => r.era5).length}; failed ${rows.filter((r) => r.failed?.length).length}`);
