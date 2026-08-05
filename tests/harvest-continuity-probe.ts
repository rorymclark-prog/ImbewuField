// PROBE, not a test — run directly:
//   node --import ./tests/register-alias.mjs tests/harvest-continuity-probe.ts
//
// The owner's complaint (2026-08-05, Bed 2 screenshot): "there is nothing
// harvestable at the end of the year." The app asks every farmer for a
// HarvestRhythm and one of the two answers is 'steady' — so an empty tail is
// a broken promise, not a taste issue. This prints, for the standard sweep,
// the kg actually harvestable in each cyclic month so the gap has a number.

import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal } from '@/lib/crop-autosuggest';
import { buildFoodValueByMonth, occupiedMonthsForPlanting, type PlanBed } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ownerBeds(): PlanBed[] {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= 9; i++) beds.push({ id: `bed-${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
  for (let i = 1; i <= 4; i++) beds.push({ id: `plot-${i}`, label: `Plot ${i}`, areaM2: 123, minDimM: 11, kind: 'plot' });
  return beds;
}

function bar(v: number, max: number): string {
  const n = max > 0 ? Math.round((v / max) * 30) : 0;
  return '█'.repeat(n) + (v > 0 && n === 0 ? '·' : '');
}

const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];

interface RowSummary { label: string; zero: number[]; starved: number[]; minKg: number; meanKg: number }
const summaries: RowSummary[] = [];

for (const pattern of PATTERNS) {
  for (const goal of GOALS) {
    for (const nowMonth of [1, 4, 8, 11]) {
      const answers: AutoSuggestAnswers = {
        goal, householdSize: 'medium', focusCropCount: 2, groups: [],
        rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false,
      };
      const beds = ownerBeds();
      const { plantings } = autoSuggestPlan(answers, pattern, beds, [], nowMonth);
      // No nowMonth passed: the plan is CYCLIC (it repeats every year), so every
      // month's harvest counts — "already past" months come around again.
      const byMonth = buildFoodValueByMonth(plantings, beds, {});
      const kg = byMonth.map((m) => m.kg);
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const meanKg = months.reduce((s, m) => s + kg[m], 0) / 12;
      const zero = months.filter((m) => kg[m] < 0.5);
      const starved = months.filter((m) => kg[m] >= 0.5 && kg[m] < meanKg * 0.15);
      const minKg = Math.min(...months.map((m) => kg[m]));
      const label = `${pattern} · ${goal} · now=${MONTHS[nowMonth]}`;
      summaries.push({ label, zero, starved, minKg, meanKg });

      // Full detail for the owner's own case only.
      if (pattern === 'summer' && goal === 'family' && nowMonth === 8) {
        console.log(`\n=== DETAIL ${label} (the owner's case) ===`);
        const max = Math.max(...months.map((m) => kg[m]));
        for (const m of months) {
          const crops = Object.entries(byMonth[m].byCrop)
            .sort((a, b) => b[1] - a[1]).slice(0, 4)
            .map(([k, v]) => `${cropByKey(k)?.name ?? k} ${v.toFixed(0)}kg`).join(', ');
          console.log(`${MONTHS[m].padEnd(4)} ${kg[m].toFixed(0).padStart(5)}kg ${bar(kg[m], max).padEnd(31)} ${crops}`);
        }
        // Per-bed: how many cyclic months each bed has ZERO harvestable share.
        console.log('\nPer-bed months with nothing harvestable (fresh window):');
        for (const bed of beds) {
          const harvestable = new Set<number>();
          for (const p of plantings.filter((x) => x.bedId === bed.id)) {
            const crop = cropByKey(p.cropKey);
            if (!crop) continue;
            const maturity = Math.max(1, Math.round(crop.daysToHarvest / 30));
            for (let off = 0; off <= (crop.harvestWindowMonths ?? 0); off++) {
              harvestable.add(((p.sowMonth - 1 + maturity + off) % 12) + 1);
            }
          }
          const empty = months.filter((m) => !harvestable.has(m));
          const occupied = new Set(plantings.filter((x) => x.bedId === bed.id).flatMap((p) => occupiedMonthsForPlanting(p)));
          console.log(`  ${bed.label.padEnd(8)} harvest in ${String(12 - empty.length).padStart(2)}/12 months · empty: ${empty.map((m) => MONTHS[m]).join(' ') || '—'} · occupied ${occupied.size}/12`);
        }
      }
    }
  }
}

console.log('\n=== SWEEP: harvest continuity per scenario (cyclic year) ===');
for (const s of summaries) {
  const flag = s.zero.length ? ' ← ZERO-HARVEST MONTHS' : s.starved.length ? ' ← starved months' : '';
  console.log(
    `${s.label.padEnd(34)} min ${s.minKg.toFixed(0).padStart(4)}kg / mean ${s.meanKg.toFixed(0).padStart(4)}kg` +
    ` · zero: [${s.zero.map((m) => MONTHS[m]).join(' ')}] starved: [${s.starved.map((m) => MONTHS[m]).join(' ')}]${flag}`,
  );
}
