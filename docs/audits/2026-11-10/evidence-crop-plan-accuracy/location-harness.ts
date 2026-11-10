// Accuracy harness: app calendar assignment vs ERA5 daily frost/heat.
// Run from repo root:
//   node --import ./tests/register-alias.mjs <this file>
// Re-runnable from cache (cache/nasa_*.json, cache/era5_*.json). Delete a cache file to refetch.
import fs from 'node:fs';
import path from 'node:path';
import { fetchNasaPower } from '@/lib/nasa-power';
import { siteClimateFromLocationData } from '@/lib/site-climate';
import { classifyKoppen, rainPatternFor, summerMonthIndices } from '@/lib/koppen-global';
import { CROPS, type RainPattern, type CropDef } from '@/lib/crop-catalog';
import { climateGateFrom, judgeFieldMonths, monthsAboveOptimum, heatLimitOf } from '@/lib/crop-climate-gate';
import { harvestMonthForCrop, bedEntryMonth } from '@/lib/crop-plan';

const OUT = process.env.OUT || './accuracy-out';
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
const YEARS = Array.from({ length: 20 }, (_, i) => 2001 + i);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

type Loc = { name: string; lat: number; lon: number; region: string; sa: boolean };
const L = (region: string, sa: boolean, s: string): Loc[] =>
  s.split(';').map((e) => { const m = e.trim().match(/^(.*) (-?\d+\.?\d*) (-?\d+\.?\d*)$/)!; return { name: m[1], lat: +m[2], lon: +m[3], region, sa }; });
const LOCS: Loc[] = [
  ...L('KZN', true, 'Mkuze sample farm -27.73 31.96; Durban -29.86 31.03; Richards Bay -28.78 32.04; Hillcrest -29.78 30.77; Pietermaritzburg -29.60 30.38; Underberg -29.79 29.50; Kokstad -30.55 29.42; Newcastle -27.76 29.93; Vryheid -27.77 30.79'),
  ...L('Highveld/interior', true, 'Johannesburg -26.20 28.05; Pretoria -25.75 28.19; Ermelo -26.53 29.98; Bethlehem -28.23 28.31; Bloemfontein -29.12 26.21; Potchefstroom -26.71 27.10; Mahikeng -25.86 25.64; Kimberley -28.74 24.76; Rustenburg -25.67 27.24'),
  ...L('Limpopo/Mpumalanga', true, 'Mbombela -25.47 30.97; Komatipoort -25.43 31.95; Tzaneen -23.83 30.16; Polokwane -23.90 29.45; Musina -22.35 30.04; Thohoyandou -22.95 30.48; Phalaborwa -23.94 31.14; Lephalale -23.67 27.75'),
  ...L('Eastern Cape', true, 'Mthatha -31.59 28.78; Port St Johns -31.62 29.54; East London -33.02 27.90; Gqeberha -33.96 25.60; Komani -31.90 26.88; Graaff-Reinet -32.25 24.53'),
  ...L('Western Cape', true, 'Cape Town -33.93 18.42; Stellenbosch -33.93 18.86; Worcester -33.65 19.45; Ceres -33.37 19.31; George -33.96 22.46; Oudtshoorn -33.59 22.20; Beaufort West -32.35 22.58; Vredendal -31.67 18.50; Sutherland -32.40 20.66'),
  ...L('Northern Cape', true, 'Upington -28.45 21.25; Springbok -29.66 17.89; Kuruman -27.45 23.43'),
  ...L('Outside SA', false, 'Maseru -29.31 27.48; Mbabane -26.31 31.13; Maputo -25.97 32.57; Gaborone -24.65 25.91; Windhoek -22.56 17.08; Harare -17.83 31.05; Lusaka -15.42 28.28; Lilongwe -13.96 33.77; Nairobi -1.29 36.82; Kampala 0.35 32.58; Addis Ababa 9.03 38.74; Accra 5.60 -0.19; Vienna 48.21 16.37; London 51.51 -0.13; Delhi 28.61 77.21; Sao Paulo -23.55 -46.63; Melbourne -37.81 144.96; Fresno 36.74 -119.79'),
];
const slug = (l: Loc) => l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------- Step 1: app path ----------
async function appPath(l: Loc) {
  const f = path.join(CACHE, `nasa_${slug(l)}.json`);
  let payload: any = null; let reason: string | null = null;
  if (fs.existsSync(f)) payload = JSON.parse(fs.readFileSync(f, 'utf8'));
  else {
    for (let a = 1; a <= 4 && !payload; a++) {
      try {
        // Same call the /api/location-data route makes; route spreads {rainfall, climate} into its payload.
        payload = await fetchNasaPower(l.lat, l.lon);
        fs.writeFileSync(f, JSON.stringify(payload));
      } catch (e: any) { reason = `fetchNasaPower attempt ${a}: ${e?.message ?? e}`; await sleep(2000 * a); }
    }
  }
  if (!payload) return { ok: false as const, reason };
  const { rainfall, climate } = payload;
  const site = siteClimateFromLocationData({ rainfall, climate }, l.lat);
  const temps: number[] = climate.monthlyTemp, rain: number[] = rainfall.monthly;
  const annual = rain.reduce((a: number, b: number) => a + b, 0);
  const sIdx = summerMonthIndices(l.lat);
  const summerShare = annual > 0 ? sIdx.reduce((s, m) => s + rain[m], 0) / annual : null;
  return {
    ok: true as const, reason: null,
    monthlyTempC: temps, monthlyRainMm: rain, annualRainMm: r1(annual),
    rainfallSource: rainfall.rainfallSource, tempCoverage: climate.monthlyTempCoverage,
    koppenRoute: climate.koppen, koppenSiteClimate: site?.koppen ?? null,
    pattern: (site?.pattern ?? null) as RainPattern | null,
    siteClimateNullReason: site ? null : 'siteClimateFromLocationData returned null',
    coldestMonthMean: r1(Math.min(...temps)), hottestMonthMean: r1(Math.max(...temps)),
    summerShare: summerShare === null ? null : r2(summerShare),
  };
}

// ---------- Step 2: ERA5 ----------
async function fetchEra5(l: Loc): Promise<{ json: any | null; reason: string | null; fatal?: boolean }> {
  const f = path.join(CACHE, `era5_${slug(l)}.json`);
  if (fs.existsSync(f)) return { json: JSON.parse(fs.readFileSync(f, 'utf8')), reason: null };
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${l.lat.toFixed(4)}&longitude=${l.lon.toFixed(4)}&start_date=2001-01-01&end_date=2020-12-31&daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum&timezone=auto`;
  let reason = '';
  for (let a = 1; a <= 10; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.ok) { const j = await res.json(); fs.writeFileSync(f, JSON.stringify(j)); return { json: j, reason: null }; }
      const body = (await res.text()).slice(0, 200);
      reason = `HTTP ${res.status} ${body}`;
      if (res.status === 429 || res.status >= 500) {
        if (/daily/i.test(body)) return { json: null, reason: `daily limit: ${reason}`, fatal: true };
        const wait = /hourly/i.test(body) ? 300000 : Math.min(30000 * 2 ** (a - 1), 300000);
        console.log(`  ${l.name}: ${reason} -> wait ${wait / 1000}s (attempt ${a})`); await sleep(wait); continue;
      }
      return { json: null, reason };
    } catch (e: any) { reason = `fetch error: ${e?.message ?? e}`; await sleep(15000 * a); }
  }
  return { json: null, reason: `gave up: ${reason}` };
}

function era5Stats(l: Loc, j: any) {
  const d = j?.daily; if (!d?.time) return null;
  const t: string[] = d.time, tn = d.temperature_2m_min, tx = d.temperature_2m_max, tm = d.temperature_2m_mean, pr = d.precipitation_sum;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const acc = (v: () => number[][]) => v();
  const mn: number[][] = Array.from({ length: 12 }, () => []), mx: number[][] = Array.from({ length: 12 }, () => []), me: number[][] = Array.from({ length: 12 }, () => []);
  const rainSum = new Array(12).fill(0), rainYearsSeen: Set<number>[] = Array.from({ length: 12 }, () => new Set());
  const f0 = new Array(12).fill(0), f2 = new Array(12).fill(0), frostYears: Set<number>[] = Array.from({ length: 12 }, () => new Set());
  const daysSeen = new Array(12).fill(0);
  let missing = 0; const firstLast: Record<number, { first: number; last: number; all: number[] }> = {};
  const south = l.lat < 0;
  // doy helpers
  const dayIndex = (y: number, m: number, dd: number) => Math.round((Date.UTC(y, m, dd) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  const seasonDays: Record<number, number[]> = {};
  let total = 0, frostTotal0 = 0;
  for (let i = 0; i < t.length; i++) {
    const y = +t[i].slice(0, 4), m = +t[i].slice(5, 7) - 1, dd = +t[i].slice(8, 10);
    if (tn[i] == null || tx[i] == null || tm[i] == null || pr[i] == null) missing++;
    if (tn[i] != null) {
      daysSeen[m]++;
      if (tn[i] <= 0) { f0[m]++; frostYears[m].add(y); frostTotal0++;
        // season key and offset
        if (south) (seasonDays[y] ??= []).push(dayIndex(y, m, dd));
        else { const sy = m >= 6 ? y : y - 1; const off = Math.round((Date.UTC(y, m, dd) - Date.UTC(sy, 6, 1)) / 864e5); (seasonDays[sy] ??= []).push(off); }
      }
      if (tn[i] <= 2) f2[m]++;
      mn[m].push(tn[i]);
    }
    if (tx[i] != null) mx[m].push(tx[i]);
    if (tm[i] != null) me[m].push(tm[i]);
    if (pr[i] != null) rainSum[m] += pr[i];
    total++;
  }
  const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
  const fmtDate = (off: number, ref: 'jan' | 'jul') => { const dt = new Date(Date.UTC(2001, ref === 'jan' ? 0 : 6, 1) + (off - (ref === 'jan' ? 1 : 0)) * 864e5); return `${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`; };
  let seasons = Object.entries(seasonDays).filter(([sy]) => south || (+sy >= 2001 && +sy <= 2019));
  const firsts = seasons.map(([, a]) => Math.min(...a)), lasts = seasons.map(([, a]) => Math.max(...a));
  const ref = south ? 'jan' : 'jul';
  const nSeasonYears = south ? 20 : 19;
  const monthly = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    meanMin: r1(mean(mn[m])), meanMax: r1(mean(mx[m])), meanMean: r1(mean(me[m])),
    rainMm: r1(rainSum[m] / 20),
    airFrostDays: r2(f0[m] / 20), groundFrostProxyDays: r2(f2[m] / 20),
    shareYearsWithAirFrost: r2(frostYears[m].size / 20),
  }));
  return {
    missingDays: missing, totalDays: total, timezone: j.timezone, elevationM: j.elevation, gridLat: j.latitude, gridLon: j.longitude,
    monthly,
    airFrostDaysPerYear: r1(frostTotal0 / 20),
    monthsWithFrostGE1: monthly.filter((x) => x.airFrostDays >= 1).map((x) => MON[x.month - 1]),
    season: {
      basis: south ? 'calendar year Jan-Dec: first frost after 1 Jan, last frost before 31 Dec (2001-2020)' : 'Jul-Jun season (Jul Y..Jun Y+1, Y=2001-2019)',
      yearsWithFrost: seasons.length, yearsInBasis: nSeasonYears,
      meanFirstFrost: firsts.length ? fmtDate(mean(firsts), ref) : null,
      meanLastFrost: lasts.length ? fmtDate(mean(lasts), ref) : null,
      earliestFirstFrost: firsts.length ? fmtDate(Math.min(...firsts), ref) : null,
      latestLastFrost: lasts.length ? fmtDate(Math.max(...lasts), ref) : null,
    },
    meanTempMonthly: monthly.map((x) => x.meanMean), rainMonthly: monthly.map((x) => x.rainMm),
  };
}

// ---------- Step 4 ----------
function fieldMonths(from: number, to: number): number[] {
  const out = [from]; let m = from; let n = 0;
  while (m !== to && n++ < 12) { m = (m % 12) + 1; out.push(m); }
  return out;
}
function evalCrops(l: Loc, pattern: RainPattern, app: any, era: any) {
  const gate = climateGateFrom({ siteMonthlyTempC: app.monthlyTempC }, false);
  const res: any[] = [];
  for (const crop of CROPS as CropDef[]) {
    if (crop.timingVerified === false) continue;
    const sows = crop.sowMonths?.[pattern] ?? [];
    if (!sows.length) continue;
    const lim = heatLimitOf(crop);
    for (const s of sows) {
      const first = harvestMonthForCrop(s, crop);
      const months = fieldMonths(s, first);
      const bedMonths = fieldMonths(bedEntryMonth(s, crop), first);
      const fr = (ms: number[]) => ms.map((m) => ({ month: m, airFrostDays: era.monthly[m - 1].airFrostDays, shareYears: era.monthly[m - 1].shareYearsWithAirFrost }));
      const frostRows = fr(months), bedRows = fr(bedMonths);
      const tender = !!crop.frostTender;
      const hard = frostRows.filter((x) => x.airFrostDays >= 1), soft = frostRows.filter((x) => x.airFrostDays >= 0.2);
      const bedHard = bedRows.filter((x) => x.airFrostDays >= 1);
      const gateOn = !!gate;
      const verdict = gateOn ? judgeFieldMonths(crop, months, gate!) : null;
      const above = gateOn ? monthsAboveOptimum(crop, months, gate!) : [];
      const hot = lim ? months.filter((m) => era.monthly[m - 1].meanMax > lim.absoluteMax).map((m) => ({ month: m, era5MeanMax: era.monthly[m - 1].meanMax, absoluteMax: lim.absoluteMax, excess: r1(era.monthly[m - 1].meanMax - lim.absoluteMax) })) : [];
      res.push({
        crop: crop.key, name: crop.name, sowMonth: s, transplant: !!crop.transplant, frostTender: tender, daysToHarvest: crop.daysToHarvest,
        firstHarvestMonth: first, fieldMonths: months, fieldMonthsFromBedEntry: bedMonths,
        frostByMonth: frostRows,
        frostExposure: tender && hard.length > 0,
        frostExposureSoft: tender && soft.length > 0,
        frostExposureBedEntryOnly: tender && bedHard.length > 0,
        frostMonthsHard: hard, frostMonthsSoft: soft,
        frostDaySum: r2(frostRows.reduce((a, x) => a + x.airFrostDays, 0)),
        frostDayMax: Math.max(...frostRows.map((x) => x.airFrostDays)),
        hasHeatLimit: !!lim, appHeatGate: verdict,
        aboveOptimum: above.map((m) => ({ month: m, nasaMeanC: app.monthlyTempC[m - 1], optimalMax: lim!.optimalMax, excess: r1(app.monthlyTempC[m - 1] - lim!.optimalMax) })),
        hotDays: hot,
      });
    }
  }
  return res;
}

// ---------- main ----------
async function main() {
  const results: any[] = []; let era5Fatal = false;
  for (const l of LOCS) {
    console.log(`[${results.length + 1}/${LOCS.length}] ${l.name}`);
    const app = await appPath(l);
    const cached = fs.existsSync(path.join(CACHE, `era5_${slug(l)}.json`));
    let e5: { json: any | null; reason: string | null; fatal?: boolean } = era5Fatal && !cached ? { json: null, reason: 'skipped after daily limit' } : await fetchEra5(l);
    if (e5.fatal) era5Fatal = true;
    if (!cached) await sleep(3000);
    const era = e5.json ? era5Stats(l, e5.json) : null;
    const rec: any = { name: l.name, lat: l.lat, lon: l.lon, region: l.region, inSouthAfrica: l.sa, app, era5: era, era5Failure: era ? null : e5.reason };
    if (app.ok && era) {
      const m = { tempC: era.meanTempMonthly, precipMm: era.rainMonthly, lat: l.lat };
      const k = classifyKoppen(m); const pat = rainPatternFor(m, k);
      const sIdx = summerMonthIndices(l.lat), tot = era.rainMonthly.reduce((a: number, b: number) => a + b, 0);
      rec.crossCheck = {
        era5Koppen: k.code, era5Pattern: pat, nasaKoppen: app.koppenSiteClimate ?? app.koppenRoute, nasaPattern: app.pattern,
        patternDiffers: app.pattern !== null && app.pattern !== pat,
        coldestMean: { nasa: app.coldestMonthMean, era5: r1(Math.min(...era.meanTempMonthly)) },
        hottestMean: { nasa: app.hottestMonthMean, era5: r1(Math.max(...era.meanTempMonthly)) },
        summerShare: { nasa: app.summerShare, era5: tot > 0 ? r2(sIdx.reduce((s, i) => s + era.rainMonthly[i], 0) / tot) : null },
        annualRain: { nasa: app.annualRainMm, era5: r1(tot) },
        note: 'ERA5 side uses classifyKoppen+rainPatternFor directly (the two calls siteClimateFromLocationData makes); the payload gate is not used because it requires a NASA temperature receipt.',
      };
      if (l.sa && app.pattern) {
        rec.crops = evalCrops(l, app.pattern, app, era);
        if (rec.crossCheck.patternDiffers) rec.cropsUnderEra5Pattern = { pattern: pat, crops: evalCrops(l, pat, app, era) };
      } else if (l.sa) rec.cropsSkipped = 'no NASA-based pattern';
    }
    results.push(rec);
    fs.writeFileSync(path.join(OUT, 'locations.json'), JSON.stringify({ generated: new Date().toISOString(), locations: results }, null, 1));
  }
  writeSummary(results);
}

function writeSummary(R: any[]) {
  const o: string[] = [];
  const p = (s = '') => o.push(s);
  p('# Calendar accuracy audit: app pattern vs ERA5 frost and heat'); p();
  p(`Generated ${new Date().toISOString().slice(0, 10)} by accuracy/harness.ts. Raw data: locations.json.`); p();
  p('## Limits'); p();
  p('- ERA5 (Open-Meteo archive) is a gridded reanalysis, roughly 9-25 km cells. It under-counts frost in valley bottoms and cold-air pockets and smooths mountains: its air-frost counts are a LOWER bound for a real farm in a hollow, and cell elevation (see locations.json era5.elevationM) can differ from the site.');
  p('- App side is NASA POWER monthly means (via fetchNasaPower; rainfall may be swapped for Open-Meteo 1991-2020 by the app when the two differ >30%, see rainfallSource). ERA5 side is 2001-2020 daily. Different periods and grids; differences are reported, not reconciled.');
  p('- Frost days = daily Tmin (2 m air) <= 0 C; ground-frost proxy = Tmin <= 2 C. Field months = sow month through first harvest month (harvestMonthForCrop, which includes the nursery months for transplants). Frost on seedlings in a tray is not field frost; locations.json also carries frostExposureBedEntryOnly (from bedEntryMonth).');
  p('- Monthly resolution: a month counted as exposed is exposed for at least part of it; harvest-window months after first harvest are not counted.'); p();
  const T = (v: any) => (v === null || v === undefined || Number.isNaN(v) ? 'n/a' : v);
  p('## (a) Locations'); p();
  p('| Location | Lat, Lon | NASA cold/hot mean C | ERA5 cold/hot mean C | Rain mm NASA / ERA5 | Summer share N/E | Koppen N/E | Pattern N/E | ERA5 frost d/yr | Months >=1 frost d | Mean last frost |');
  p('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R) {
    const a = r.app, e = r.era5, c = r.crossCheck;
    if (!a.ok || !e) { p(`| ${r.name} | ${r.lat}, ${r.lon} | ${a.ok ? 'ok' : 'NASA FAILED: ' + a.reason} | ${e ? 'ok' : 'ERA5 FAILED: ' + r.era5Failure} | | | | | | | |`); continue; }
    p(`| ${r.name} | ${r.lat}, ${r.lon} | ${a.coldestMonthMean}/${a.hottestMonthMean} | ${c.coldestMean.era5}/${c.hottestMean.era5} | ${a.annualRainMm} (${a.rainfallSource}) / ${c.annualRain.era5} | ${T(c.summerShare.nasa)}/${T(c.summerShare.era5)} | ${c.nasaKoppen}/${c.era5Koppen} | ${a.pattern}/${c.era5Pattern} | ${e.airFrostDaysPerYear} | ${e.monthsWithFrostGE1.join(' ') || 'none'} | ${e.season.meanLastFrost ?? 'no frost'} (${e.season.yearsWithFrost}/${e.season.yearsInBasis} yrs) |`);
  }
  p();
  const sa = R.filter((r) => r.crops);
  const pats = ['summer', 'mild-frost', 'all-year', 'winter'];
  p('## (b) frostExposure (frost-tender crop, >=1.0 ERA5 air-frost day per month in a field month)'); p();
  p('Severity = highest monthly frost-day average among field months, then sum across field months. Soft flag (>=0.2 d/month) counts are given in the heading.'); p();
  for (const pat of pats) {
    const locs = sa.filter((r) => r.app.pattern === pat);
    const hard = locs.flatMap((r) => r.crops.filter((x: any) => x.frostExposure).map((x: any) => ({ r, x })));
    const soft = locs.flatMap((r) => r.crops.filter((x: any) => x.frostExposureSoft)).length;
    p(`### Pattern ${pat}: ${locs.length} locations, ${hard.length} hard flags, ${soft} soft flags`); p();
    if (!locs.length) { p('No location was assigned this pattern.'); p(); continue; }
    for (const r of locs) {
      const rows = r.crops.filter((x: any) => x.frostExposure).sort((a: any, b: any) => b.frostDayMax - a.frostDayMax || b.frostDaySum - a.frostDaySum);
      const softOnly = r.crops.filter((x: any) => x.frostExposureSoft && !x.frostExposure).length;
      p(`**${r.name}** (ERA5 ${r.era5.airFrostDaysPerYear} frost d/yr; ${rows.length} hard, ${softOnly} soft-only)`); p();
      if (!rows.length) { p('No hard flags.'); p(); continue; }
      p('| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |'); p('|---|---|---|---|---|');
      for (const x of rows) p(`| ${x.crop} | ${MON[x.sowMonth - 1]} | ${x.fieldMonths.map((m: number) => MON[m - 1]).join('-')} | ${x.frostMonthsHard.map((f: any) => `${MON[f.month - 1]} ${f.airFrostDays}`).join(', ')} | ${x.frostMonthsHard.map((f: any) => `${MON[f.month - 1]} ${Math.round(f.shareYears * 100)}%`).join(', ')} |`);
      p();
    }
  }
  p('## (c) Heat'); p();
  let total = 0, rej = 0; const rejBy: Record<string, number> = {}; const rejRows: any[] = [];
  const all: { r: any; x: any }[] = sa.flatMap((r) => r.crops.map((x: any) => ({ r, x })));
  for (const { r, x } of all) { total++; if (x.appHeatGate === 'too-hot') { rej++; rejBy[r.name] = (rejBy[r.name] ?? 0) + 1; rejRows.push({ r, x }); } }
  p(`App heat gate (judgeFieldMonths, NASA monthly means, field months = sow..first harvest): **${rej} of ${total}** crop/sow-month/location combinations rejected as too-hot (assigned-pattern combinations only).`); p();
  p('By location: ' + (Object.entries(rejBy).map(([k, v]) => `${k} ${v}`).join('; ') || 'none')); p();
  if (rejRows.length) { p('| Location | Crop | Sow | Field months |'); p('|---|---|---|---|'); for (const { r, x } of rejRows) p(`| ${r.name} | ${x.crop} | ${MON[x.sowMonth - 1]} | ${x.fieldMonths.map((m: number) => MON[m - 1]).join('-')} |`); p(); }
  const ab = all.filter(({ x }) => x.aboveOptimum.length).map(({ r, x }) => ({ r, x, ex: Math.max(...x.aboveOptimum.map((a: any) => a.excess)) })).sort((a, b) => b.ex - a.ex);
  p(`### aboveOptimum (NASA monthly mean above ECOCROP optimalMax): ${ab.length} combinations; top 25 by degrees over`); p();
  p('| Location | Crop | Sow | Months (NASA mean C vs optimalMax) | Max excess C |'); p('|---|---|---|---|---|');
  for (const { r, x, ex } of ab.slice(0, 25)) p(`| ${r.name} | ${x.crop} | ${MON[x.sowMonth - 1]} | ${x.aboveOptimum.map((a: any) => `${MON[a.month - 1]} ${a.nasaMeanC} vs ${a.optimalMax}`).join(', ')} | ${ex} |`);
  p();
  const hd = all.filter(({ x }) => x.hotDays.length).map(({ r, x }) => ({ r, x, ex: Math.max(...x.hotDays.map((a: any) => a.excess)) })).sort((a, b) => b.ex - a.ex);
  p(`### hotDays (information only; ERA5 mean daily MAX above ECOCROP absoluteMax in a field month): ${hd.length} combinations; top 25`); p();
  p('| Location | Crop | Sow | Months (ERA5 mean max vs absoluteMax) | Max excess C |'); p('|---|---|---|---|---|');
  for (const { r, x, ex } of hd.slice(0, 25)) p(`| ${r.name} | ${x.crop} | ${MON[x.sowMonth - 1]} | ${x.hotDays.map((a: any) => `${MON[a.month - 1]} ${a.era5MeanMax} vs ${a.absoluteMax}`).join(', ')} | ${ex} |`);
  p();
  p('## (d) NASA vs ERA5 pattern disagreements'); p();
  const dis = R.filter((r) => r.crossCheck?.patternDiffers);
  if (!dis.length) p('None.'); else {
    p('| Location | NASA pattern | ERA5 pattern | Coldest mean N/E | Summer share N/E | Koppen N/E | ERA5 frost d/yr |'); p('|---|---|---|---|---|---|---|');
    for (const r of dis) { const c = r.crossCheck; p(`| ${r.name} | ${c.nasaPattern} | ${c.era5Pattern} | ${c.coldestMean.nasa}/${c.coldestMean.era5} | ${T(c.summerShare.nasa)}/${T(c.summerShare.era5)} | ${c.nasaKoppen}/${c.era5Koppen} | ${r.era5.airFrostDaysPerYear} |`); }
  }
  p();
  const bad = R.filter((r) => !r.app.ok || !r.era5 || (r.app.ok && !r.app.pattern));
  p('## Failures'); p();
  if (!bad.length) p('None.'); else for (const r of bad) p(`- ${r.name}: NASA ${r.app.ok ? (r.app.pattern ? 'ok' : r.app.siteClimateNullReason) : r.app.reason}; ERA5 ${r.era5 ? 'ok' : r.era5Failure}`);
  fs.writeFileSync(path.join(OUT, 'summary.md'), o.join('\n') + '\n');
  console.log('wrote summary.md');
}
main();
