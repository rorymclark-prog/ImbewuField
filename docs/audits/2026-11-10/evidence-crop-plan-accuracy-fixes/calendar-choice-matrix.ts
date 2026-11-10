// The sowing calendar each audited South African place gets, before and after the 10 November 2026 fixes.
//
//   node --import ./tests/register-alias.mjs docs/audits/2026-11-10/evidence-crop-plan-accuracy-fixes/calendar-choice-matrix.ts <choices.json>
//
// Reads only files in this repository:
//   tests/fixtures/sa-climate-sites-2026-11-10.json   the app's own NASA POWER reading for each place, and its ERA5 frost record
//   ../evidence-crop-plan-accuracy/outputs/locations-climate.json   the calendar the app assigned BEFORE, and the ERA5 monthly means
// "After" is computed now, by the app's own siteClimateFromLocationData / sowingCalendarFor, so it follows the code it is run on.
import { readFileSync, writeFileSync } from 'node:fs';
import { siteClimateFromLocationData } from '@/lib/site-climate';
import { classifyKoppen, sowingCalendarFor } from '@/lib/koppen-global';

const here = new URL('.', import.meta.url);
const sites = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/sa-climate-sites-2026-11-10.json', here), 'utf8')).sites;
const before = new Map<string, { app: { pattern: string }; era5: { meanTempMonthly: number[]; rainMonthly: number[] }; crossCheck: { era5Pattern: string } }>(
  JSON.parse(readFileSync(new URL('../evidence-crop-plan-accuracy/outputs/locations-climate.json', here), 'utf8')).locations.map((l: { name: string }) => [l.name, l]));

const rows = sites.map((site: { name: string; lat: number; monthlyTempC: number[]; monthlyRainMm: number[]; rainfallSource: string; recordMinC: number; era5: { airFrostDaysPerYear: number; lowestDailyMinC: number } }) => {
  const was = before.get(site.name)!;
  const now = siteClimateFromLocationData({
    rainfall: { rainfallSource: site.rainfallSource, monthly: site.monthlyRainMm },
    climate: { monthlyTemp: site.monthlyTempC, monthlyTempCoverage: { source: 'nasa-power', status: 'complete' }, minTemp: site.recordMinC, minTempSource: 'nasa-power' },
  }, site.lat)!;
  // Cross-check: the same rule on the independent record (ERA5 monthly means, with its own 20-year lowest daily minimum).
  const era = { tempC: was.era5.meanTempMonthly, precipMm: was.era5.rainMonthly, lat: site.lat, recordMinC: site.era5.lowestDailyMinC };
  const eraNow = sowingCalendarFor(era, classifyKoppen(era));
  return { name: site.name, before: was.app.pattern, after: now.pattern, closeCall: now.closeCall, warmerNeighbour: now.warmerNeighbour, rainSeason: now.rainSeason,
    coldestMonthC: now.coldestMonthC, hottestMonthC: now.hottestMonthC, recordMinC: now.recordMinC, koppen: now.koppen,
    era5Before: was.crossCheck.era5Pattern, era5After: eraNow.pattern, era5FrostDaysPerYear: site.era5.airFrostDaysPerYear, era5LowestDailyMinC: site.era5.lowestDailyMinC };
});
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 1) + '\n');

const pad = (v: unknown, w: number) => String(v ?? '-').padEnd(w);
const one = (v: number | null) => (v === null ? '-' : v.toFixed(1));
console.log('Columns: the calendar from the app\'s own reading before and after; the next column it is close to; rain timing; coldest and hottest month mean and');
console.log('record minimum (°C, NASA POWER); Köppen class; then the same rule on the independent record (ERA5), its frost days a year and lowest daily minimum.');
console.log('summer = hard frost; mild-frost = light frost at most; all-year = hot, frost-free; winter = winter-rainfall Cape.\n');
console.log(pad('place', 20) + pad('before', 11) + pad('after', 11) + pad('close to', 11) + pad('rain', 9) + pad('cold', 6) + pad('hot', 6) + pad('recMin', 7) + pad('class', 6) + '| ' + pad('ERA5 before', 12) + pad('ERA5 after', 11) + pad('frost/yr', 9) + pad('lowest', 7));
for (const r of rows) {
  console.log(pad(r.name.slice(0, 19), 20) + pad(r.before, 11) + pad(r.after, 11) + pad(r.closeCall, 11) + pad(r.rainSeason, 9) + pad(one(r.coldestMonthC), 6) + pad(one(r.hottestMonthC), 6) + pad(one(r.recordMinC), 7) + pad(r.koppen, 6)
    + '| ' + pad(r.era5Before, 12) + pad(r.era5After, 11) + pad(one(r.era5FrostDaysPerYear), 9) + pad(one(r.era5LowestDailyMinC), 7)
    + (r.before !== r.after ? '  CHANGED' : '') + (r.after !== r.era5After ? '  records differ' : ''));
}
const count = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).length;
console.log(`\n${rows.length} places. Changed calendar: ${count((r) => r.before !== r.after)}. The two climate records gave different calendars at ${count((r) => r.before !== r.era5Before)} places before and ${count((r) => r.after !== r.era5After)} after. Flagged as close to a line: ${count((r) => r.closeCall !== null)}.`);
for (const p of ['summer', 'mild-frost', 'all-year', 'winter']) console.log(`  ${p.padEnd(11)} before ${String(count((r) => r.before === p)).padStart(2)}   after ${String(count((r) => r.after === p)).padStart(2)}`);
