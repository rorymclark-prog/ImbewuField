// What a NASA POWER missing-value marker did to the calendar choice BEFORE recordMinimumC cleaned it:
// each of the 44 audited places with no record minimum, against the same place with -999 passed as its record low.
// Usage (repository root): node --import ./tests/register-alias.mjs <this file>
import { readFileSync } from 'node:fs';
import { sowingCalendarFor, classifyKoppen } from '@/lib/koppen-global';
const SITES = JSON.parse(readFileSync('tests/fixtures/sa-climate-sites-2026-11-10.json', 'utf8')).sites;
let patternDiff = 0, closeDiff = 0, any = 0; const names: string[] = [];
for (const s of SITES) {
  const m = { tempC: s.monthlyTempC, precipMm: s.monthlyRainMm, lat: s.lat };
  const k = classifyKoppen(m);
  const none = sowingCalendarFor(m, k);
  const marked = sowingCalendarFor({ ...m, recordMinC: -999 }, k);
  if (JSON.stringify(none) !== JSON.stringify(marked)) any++;
  if (none.pattern !== marked.pattern) { patternDiff++; names.push(`${s.name}: ${none.pattern} -> ${marked.pattern}`); }
  if (none.closeCall !== marked.closeCall || none.warmerNeighbour !== marked.warmerNeighbour) closeDiff++;
}
console.log({ sites: SITES.length, anyDifference: any, patternDiff, closeCallOrNeighbourDiff: closeDiff }); console.log(names.join('\n'));
