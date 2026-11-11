// The older location harness (10 November) measured a crop's frost and heat exposure over
// the wrong months. Independent review of 11 November 2026 (Argon F-09, reproduced by Codex).
//
//   RAW=<dir holding the extracted era5_*.json of raw-responses-2026-11-10.tar.xz> \
//     node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-argon-claims/exposure-span-recheck.ts
//
// The harness took "sowing month to first harvest month". The planner reserves a bed from
// bed entry (after the nursery, for a transplanted crop) to the LAST harvest month. So the
// harness counted a nursery tray's month as field exposure and left out the picking months.
// This runs both spans, offline, on the archived daily responses for the 44 South African
// places and today's catalogue and calendars, and names every difference. It changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { CROPS, type CropDef, type RainPattern } from '@/lib/crop-catalog';
import { harvestMonthForCrop, occupiedMonthsForPlanting, type Planting } from '@/lib/crop-plan';
import { climateGateFrom, heatLimitOf, judgeFieldMonths } from '@/lib/crop-climate-gate';
import { siteClimateFromLocationData } from '@/lib/site-climate';

const RAW = process.env.RAW!;
const sites = JSON.parse(fs.readFileSync('tests/fixtures/sa-climate-sites-2026-11-10.json', 'utf8')).sites as any[];
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const show = (ms: number[]) => ms.map((m) => MON[m - 1]).join(' ');
function harnessSpan(from: number, to: number): number[] { const out = [from]; let m = from; let n = 0; while (m !== to && n++ < 12) { m = (m % 12) + 1; out.push(m); } return out; }

// The reviewer's example first: an August tomato.
const tomato = CROPS.find((c) => c.key === 'tomatoes')!;
const tomatoRow: Planting = { id: 'x', bedId: 'x', cropKey: 'tomatoes', sowMonth: 8 };
console.log(`August tomato. Older harness months: ${show(harnessSpan(8, harvestMonthForCrop(8, tomato)))}. Bed months the planner reserves: ${show(occupiedMonthsForPlanting(tomatoRow))}.\n`);

type Row = { place: string; calendar: RainPattern; crop: string; sow: number; harness: number[]; field: number[]; tender: boolean };
const rows: Row[] = [];
const stats = { combos: 0, spansDiffer: 0, frost: { harness: 0, harnessMinusSow: 0, field: 0 }, heat: { harness: 0, field: 0 } };
const frostOnlyField: string[] = [], frostOnlyHarness: string[] = [], heatOnlyField: string[] = [], heatOnlyHarness: string[] = [];
const placesFrost = { harnessMinusSow: new Set<string>(), field: new Set<string>() };
for (const s of sites) {
  const daily = JSON.parse(fs.readFileSync(path.join(RAW, `era5_${slug(s.name)}.json`), 'utf8')).daily;
  const frostDays = new Array(12).fill(0);
  daily.time.forEach((t: string, i: number) => { if (daily.temperature_2m_min[i] <= 0) frostDays[+t.slice(5, 7) - 1] += 1 / 20; });
  const site = siteClimateFromLocationData({ rainfall: { rainfallSource: s.rainfallSource, monthly: s.monthlyRainMm },
    climate: { monthlyTemp: s.monthlyTempC, monthlyTempCoverage: { source: 'nasa-power', status: 'complete' }, minTemp: s.recordMinC, minTempSource: 'nasa-power' } }, s.lat)!;
  const gate = climateGateFrom({ siteMonthlyTempC: s.monthlyTempC }, false)!;
  for (const crop of CROPS as CropDef[]) {
    if (crop.timingVerified === false) continue;
    for (const sow of crop.sowMonths?.[site.pattern] ?? []) {
      const harness = harnessSpan(sow, harvestMonthForCrop(sow, crop));
      const field = occupiedMonthsForPlanting({ cropKey: crop.key, sowMonth: sow });
      if (!field.length) continue;
      stats.combos++;
      if (harness.join() !== field.join()) stats.spansDiffer++;
      const label = `${s.name} (${site.pattern}): ${crop.name} sown ${MON[sow - 1]}`;
      if (crop.frostTender) {
        const hit = (ms: number[]) => ms.filter((m) => frostDays[m - 1] >= 1);
        const h = hit(harness), hs = hit(harness.filter((m) => m !== sow)), f = hit(field);
        if (h.length) stats.frost.harness++;
        if (hs.length) { stats.frost.harnessMinusSow++; placesFrost.harnessMinusSow.add(s.name); }
        if (f.length) { stats.frost.field++; placesFrost.field.add(s.name); }
        if (f.length && !hs.length) frostOnlyField.push(`${label}: ${f.map((m) => `${MON[m - 1]} ${frostDays[m - 1].toFixed(1)} days`).join(', ')}`);
        if (hs.length && !f.length) frostOnlyHarness.push(`${label}: ${hs.map((m) => `${MON[m - 1]} ${frostDays[m - 1].toFixed(1)} days`).join(', ')} (nursery or pre-entry month)`);
      }
      if (heatLimitOf(crop)) {
        const vh = judgeFieldMonths(crop, harness, gate), vf = judgeFieldMonths(crop, field, gate);
        if (vh === 'too-hot') stats.heat.harness++;
        if (vf === 'too-hot') stats.heat.field++;
        if (vf === 'too-hot' && vh !== 'too-hot') heatOnlyField.push(label);
        if (vh === 'too-hot' && vf !== 'too-hot') heatOnlyHarness.push(label);
      }
    }
  }
}
console.log(`44 South African places, today's catalogue and calendars: ${stats.combos} crop, sowing-month and place combinations.`);
console.log(`The two spans differ for ${stats.spansDiffer} of them.\n`);
console.log('Frost-tender crop in a month averaging one air-frost day or more:');
console.log(`  older harness span, as its own flag counted it (sowing month included): ${stats.frost.harness} combinations`);
console.log(`  older harness span without the sowing month (the figure the 10 November record quoted): ${stats.frost.harnessMinusSow} combinations at ${placesFrost.harnessMinusSow.size} places (${[...placesFrost.harnessMinusSow].join(', ') || 'none'})`);
console.log(`  bed months the planner reserves: ${stats.frost.field} combinations at ${placesFrost.field.size} places (${[...placesFrost.field].join(', ') || 'none'})`);
console.log(`\nFlagged on the planner's months but not by the older span (${frostOnlyField.length}):`); frostOnlyField.forEach((l) => console.log('  ' + l));
console.log(`\nFlagged by the older span but not on the planner's months (${frostOnlyHarness.length}):`); frostOnlyHarness.forEach((l) => console.log('  ' + l));
console.log(`\nThe app's heat check ("too hot" on the monthly mean):`);
console.log(`  older harness span: ${stats.heat.harness} combinations; bed months the planner reserves: ${stats.heat.field}`);
console.log(`  too hot on the planner's months only (${heatOnlyField.length}):`); heatOnlyField.forEach((l) => console.log('    ' + l));
console.log(`  too hot on the older span only (${heatOnlyHarness.length}):`); heatOnlyHarness.forEach((l) => console.log('    ' + l));
