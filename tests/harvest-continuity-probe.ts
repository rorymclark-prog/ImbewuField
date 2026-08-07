// PROBE, not a test — run directly:
//   node --import ./tests/register-alias.mjs tests/harvest-continuity-probe.ts
//
// The owner's complaint (2026-08-05, Bed 2 screenshot): "there is nothing
// harvestable at the end of the year." The app asks every farmer for a
// HarvestRhythm and one of the two answers is 'steady' — so an empty tail is
// a broken promise, not a taste issue. This prints, for the standard sweep,
// verified fresh-picking presence. Crop-cycle benchmark kg is not assigned to
// months because the source does not provide a picking curve.

import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal } from '@/lib/crop-autosuggest';
import { buildFoodAvailability, occupiedMonthsForPlanting, planningMaturityMonths, type PlanBed } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ownerBeds(): PlanBed[] {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= 9; i++) beds.push({ id: `bed-${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
  for (let i = 1; i <= 4; i++) beds.push({ id: `plot-${i}`, label: `Plot ${i}`, areaM2: 123, minDimM: 11, kind: 'plot' });
  return beds;
}

const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];

interface RowSummary { label: string; gaps: number[]; covered: number }
const summaries: RowSummary[] = [];

for (const pattern of PATTERNS) {
  for (const goal of GOALS) {
    for (const nowMonth of [1, 4, 8, 11]) {
      const answers: AutoSuggestAnswers = {
        goal, householdSize: 'medium', focusCropCount: 2, groups: [],
        rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
      };
      const beds = ownerBeds();
      const { plantings } = autoSuggestPlan(answers, pattern, beds, [], nowMonth);
      // No nowMonth passed: the plan is CYCLIC (it repeats every year), so every
      // fresh-picking window comes around again.
      const byMonth = buildFoodAvailability(plantings, beds);
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const gaps = months.filter((month) => !byMonth[month].some((item) => item.status === 'fresh'));
      const label = `${pattern} · ${goal} · now=${MONTHS[nowMonth]}`;
      summaries.push({ label, gaps, covered: 12 - gaps.length });

      // Full detail for the owner's own case only.
      if (pattern === 'summer' && goal === 'family' && nowMonth === 8) {
        console.log(`\n=== DETAIL ${label} (the owner's case) ===`);
        for (const m of months) {
          const crops = byMonth[m].filter((item) => item.status === 'fresh').map((item) => item.name).join(', ');
          console.log(`${MONTHS[m].padEnd(4)} ${crops || '— no verified fresh-picking window'}`);
        }
        // Per-bed: how many cyclic months each bed has ZERO harvestable share.
        console.log('\nPer-bed months with nothing harvestable (fresh window):');
        for (const bed of beds) {
          const harvestable = new Set<number>();
          for (const p of plantings.filter((x) => x.bedId === bed.id)) {
            const crop = cropByKey(p.cropKey);
            if (!crop) continue;
            const maturity = planningMaturityMonths(crop.daysToHarvest);
            for (let off = 0; off <= (crop.harvestWindowMonths ?? 0); off++) {
              harvestable.add(((p.sowMonth - 1 + maturity + (crop.transplant ? 1 : 0) + off) % 12) + 1);
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

console.log('\n=== SWEEP: verified fresh-picking continuity per scenario (cyclic year) ===');
for (const s of summaries) {
  const flag = s.gaps.length ? ' ← FRESH-PICKING GAPS' : '';
  console.log(
    `${s.label.padEnd(34)} ${String(s.covered).padStart(2)}/12 months covered` +
    ` · gaps: [${s.gaps.map((m) => MONTHS[m]).join(' ')}]${flag}`,
  );
}
