// CP-114: what the saved places say about each climate class the app can print a note for.
//   node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-atlas-climate-card/class-note-check.ts > docs/audits/2026-11-11/evidence-atlas-climate-card/outputs/class-note-check.txt
// Offline. Reads the two committed fixtures (44 + 56 South African places: NASA POWER monthly
// means and record minimum, and a second daily record's frost count). Classifies each with the
// app's own classifyKoppen and prints, per class, the range of coldest-month means, record
// minima and frost days. It judges nothing; it shows what a sentence about a class must hold for.
import { readFileSync } from 'node:fs';
import { classifyKoppen } from '@/lib/koppen-global';

type Site = { name: string; lat: number; monthlyTempC: number[]; monthlyRainMm: number[]; recordMinC: number | null; era5?: { airFrostDaysPerYear: number; lowestDailyMinC: number } };
const sites: Site[] = ['sa-climate-sites-2026-11-10.json', 'sa-climate-holdout-2026-11-11.json']
  .flatMap((f) => JSON.parse(readFileSync(new URL(`../../../../tests/fixtures/${f}`, import.meta.url), 'utf8')).sites);
const by = new Map<string, Site[]>();
for (const s of sites) {
  const k = classifyKoppen({ tempC: s.monthlyTempC, precipMm: s.monthlyRainMm, lat: s.lat });
  by.set(k.code, [...(by.get(k.code) ?? []), s]);
}
console.log(`places ${sites.length}`);
for (const [code, list] of [...by].sort((a, b) => b[1].length - a[1].length)) {
  const k = classifyKoppen({ tempC: list[0].monthlyTempC, precipMm: list[0].monthlyRainMm, lat: list[0].lat });
  const cold = list.map((s) => Math.min(...s.monthlyTempC));
  const rec = list.filter((s) => s.recordMinC !== null).map((s) => s.recordMinC as number);
  const frost = list.filter((s) => s.era5).map((s) => s.era5!.airFrostDaysPerYear);
  console.log(`\n${code}  ${k.description}  (${list.length} places)`);
  console.log(`  note as printed: ${k.growerNote}`);
  console.log(`  coldest-month mean: ${Math.min(...cold).toFixed(1)} to ${Math.max(...cold).toFixed(1)} °C`);
  console.log(`  record minimum (NASA POWER, ${rec.length} places): ${Math.min(...rec)} to ${Math.max(...rec)} °C; below 0 °C at ${rec.filter((v) => v < 0).length}`);
  console.log(`  frost days a year on the second record (${frost.length} places): ${Math.min(...frost)} to ${Math.max(...frost)}; one or more at ${frost.filter((v) => v >= 1).length}`);
  const coldest = [...list].filter((s) => s.recordMinC !== null).sort((a, b) => (a.recordMinC as number) - (b.recordMinC as number)).slice(0, 3);
  console.log(`  coldest records: ${coldest.map((s) => `${s.name} ${s.recordMinC}`).join('; ')}`);
}
