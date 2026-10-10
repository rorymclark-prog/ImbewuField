// Young trees cannot inherit a mature orchard's kilograms. Keep age groups and the farmer's
// explicit kg-by-age assumptions beside the dated bed cycles, without making up a growth curve
// or dividing a crop-cycle benchmark into fictitious monthly harvests.
import { cropByKey, hasPlanningYield } from './crop-catalog';
import { benchmarkDatedAreaConflictBedLabels, datedPlantingSowIndex, estimatedYieldKgAdjusted, occupiedMonthsForPlanting, planningMaturityMonths, TRANSPLANT_BED_RESERVED_FROM_MONTHS, TRANSPLANT_ENTRY_PLANNED_MONTHS, type Planting, type PlanBed } from './crop-plan';
import { type PlacedTreeGroup, type TreeAgeGroup, type TreeSeasonChoices } from './perennial-harvest';
import { numberLabel } from './format-figures';

export type KgRange = [number, number];
export interface AgeProjection {
  name: string;
  speciesId: string;
  plants: number;
  ages: string;
  stage: string;
  kg: KgRange | null;
  knownKg: KgRange;
  missing: string[];
}
export interface ProductionProjectionYear {
  label: string;
  vegetableKg: number | null;
  vegetableMissing: string[];
  trees: AgeProjection[];
  treeKg: KgRange;
  combinedKg: KgRange | null;
  partial: boolean;
}
export interface ProductionProjection {
  years: ProductionProjectionYear[];
  assumptions: string[];
}

export function plantingMonthIndex(stamp: string): number | null {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(stamp)) return null;
  return Number(stamp.slice(0, 4)) * 12 + Number(stamp.slice(5)) - 1;
}
const validYieldPoints = (points: TreeAgeGroup['yields']) => points
  .filter(p => Number.isFinite(p.age) && p.age >= 0 && p.age <= 150 && Number.isFinite(p.kg) && p.kg >= 0)
  .sort((a, b) => a.age - b.age);
/** Age dates qualify reference bars only; a farmer's observed harvest remains an observation. */
export function ageReadyForSeason(g: PlacedTreeGroup, choice: TreeSeasonChoices[string], date: number, status?: 'existing' | 'proposed'): boolean {
  const cohorts = (choice?.production ?? []).filter(c => !status || c.status === status);
  const total = status ? g[status] : g.existing + g.proposed;
  if (!cohorts.length || cohorts.reduce((n, c) => n + c.plants, 0) !== total) return true;
  return cohorts.some(c => {
    const planted = plantingMonthIndex(c.planted);
    if (planted === null) return true;
    const points = validYieldPoints(c.yields);
    // A draft with a negative rate or conflicting checkpoints cannot overrule the
    // sourced reference in the calendar while being rejected by the kg projection.
    const entered = new Set(points.map(p => p.age)).size === points.length
      ? points.filter(p => p.age <= (date - planted) / 12).at(-1) : undefined;
    if (entered) return date >= planted && entered.kg > 0;
    const first = g.harvest.yearsToFirstCrop?.value[0];
    return date >= planted && (first === undefined || date >= planted + Math.ceil(first * 12));
  });
}
export function treeAgeCalendarNote(g: PlacedTreeGroup, choice: TreeSeasonChoices[string], date: number): string | undefined {
  if (ageReadyForSeason(g, choice, date) || choice?.bearing) return undefined;
  const cohorts = choice?.production ?? [];
  const dates = cohorts.map(c => plantingMonthIndex(c.planted));
  if (dates.some(d => d === null)) return undefined;
  if (dates.every(d => d! > date)) return 'Not planted yet · see future harvest';
  const first = g.harvest.yearsToFirstCrop?.value;
  if (first) {
    const from = Math.floor((Math.min(...dates as number[]) + Math.ceil(first[0] * 12)) / 12);
    const to = Math.floor((Math.max(...dates as number[]) + Math.ceil(first[1] * 12)) / 12);
    if (to >= Math.floor(date / 12)) return `Growing · first-crop ref ${from}${from === to ? '' : `–${to}`}`;
  }
  return 'Age schedule: no crop planned now';
}
const sumRange = (a: KgRange, b: KgRange): KgRange => [a[0] + b[0], a[1] + b[1]];

function ageGroupKg(g: TreeAgeGroup, start: number, end: number, first: number | undefined): { kg: KgRange | null; stage: string; age: string } {
  const planted = plantingMonthIndex(g.planted);
  if (planted === null) return { kg: null, stage: 'Planting date needed', age: '?' };
  if (planted > end) return { kg: [0, 0], stage: 'Not planted yet', age: 'not planted' };
  const ageStart = Math.max(0, (start - planted) / 12);
  const ageEnd = Math.max(0, (end - planted) / 12);
  const age = `${ageStart.toFixed(1)}–${ageEnd.toFixed(1)} yr`;
  const points = validYieldPoints(g.yields);
  const base = points.filter(p => p.age <= ageStart).at(-1);
  if (new Set(points.map(p => p.age)).size !== points.length) return { kg: null, stage: 'Check duplicate yield ages', age };
  // A complete immature period has no projected crop. A period crossing the first-crop
  // threshold remains unknown without a yield schedule; it must not quietly become zero.
  if (first !== undefined && ageEnd < first && !points.some(p => p.age <= ageEnd && p.kg > 0)) return { kg: [0, 0], stage: 'Growing · before first-crop reference', age };
  if (!base) return { kg: null, stage: 'Yield at this age needed', age };
  const values = [base.kg, ...points.filter(p => p.age > ageStart && p.age <= ageEnd).map(p => p.kg)];
  if (planted > start || (first !== undefined && ageStart < first && base.kg === 0)) values.push(0);
  return { kg: [Math.min(...values) * g.plants, Math.max(...values) * g.plants], stage: 'Farm yield schedule', age };
}

export function treeAgeProjection(g: PlacedTreeGroup, choice: TreeSeasonChoices[string], start: number, end: number, nowIndex = start): AgeProjection {
  const ages = choice?.production ?? [];
  const missing: string[] = [];
  if (ages.some(a => !Number.isSafeInteger(a.plants) || a.plants < 1)) missing.push('Enter a whole number of plants');
  const counts = (status: 'existing' | 'proposed') => ages.filter(a => a.status === status).reduce((sum, a) => sum + a.plants, 0);
  const over = counts('existing') > g.existing || counts('proposed') > g.proposed;
  if (over) missing.push('Age-group counts exceed plants on the map');
  const unassigned = g.existing + g.proposed - counts('existing') - counts('proposed');
  if (unassigned > 0) missing.push(`${unassigned} plants need age groups`);
  if (ages.some(a => a.status === 'existing' && (plantingMonthIndex(a.planted) ?? -Infinity) > nowIndex)) missing.push('Existing plants have a future planting date');
  const projections = ages.map(a => ageGroupKg(a, start, end, choice?.bearing && a.status === 'existing' ? undefined : g.harvest.yearsToFirstCrop?.value[0]));
  for (const p of projections) if (!p.kg) missing.push(p.stage);
  const partialKg = projections.reduce<KgRange>((sum, p) => p.kg ? sumRange(sum, p.kg) : sum, [0, 0]);
  const unsafeCounts = over || ages.some(a => !Number.isSafeInteger(a.plants) || a.plants < 1) || ages.some(a => a.status === 'existing' && (plantingMonthIndex(a.planted) ?? -Infinity) > nowIndex);
  const knownKg: KgRange = unsafeCounts || !partialKg.every(Number.isFinite) ? [0, 0] : partialKg;
  return {
    name: g.harvest.name, speciesId: g.harvest.speciesId, plants: g.existing + g.proposed,
    ages: [...new Set(projections.map(p => p.age))].join('; ') || 'Age not recorded',
    stage: [...new Set(projections.map(p => p.stage))].join('; ') || 'Add planting dates',
    kg: missing.length || !partialKg.every(Number.isFinite) ? null : partialKg, knownKg, missing: [...new Set(missing)],
  };
}

export function buildProductionProjection(input: { plantings: Planting[]; beds: PlanBed[]; trees: readonly PlacedTreeGroup[]; choices: TreeSeasonChoices; now: Date; years?: number }): ProductionProjection {
  const nowIndex = input.now.getFullYear() * 12 + input.now.getMonth();
  const years: ProductionProjectionYear[] = [];
  for (let year = 0; year < (input.years ?? 10); year++) {
    const start = nowIndex + year * 12, end = start + 11;
    let blocked = benchmarkDatedAreaConflictBedLabels(input.plantings, input.beds, { startIndex: start, endIndex: end, originIndex: nowIndex }).length > 0;
    let vegetableKg = 0;
    const missing = new Set<string>();
    for (const p of input.plantings) {
      if (p.awaitingSowingConfirmation || p.finishedOnceSowing) continue;
      const bed = input.beds.find(b => b.id === p.bedId), crop = cropByKey(p.cropKey);
      if (!bed || !crop || crop.yieldKgPerM2 === 0) continue;
      const stamped = p.confirmedOnceSowing ?? p.once;
      const sow = datedPlantingSowIndex(p, nowIndex);
      if (sow === null) { missing.add(`${crop.name}: check sowing date`); continue; }
      if (!Number.isFinite(bed.areaM2) || bed.areaM2 <= 0) { missing.add(`${bed.label}: check growing area`); continue; }
      const maturity = planningMaturityMonths(crop.daysToHarvest) + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
      const oneTime = p.existing || stamped !== undefined;
      const first = sow + maturity;
      const occurrences = oneTime ? [first] : Array.from({ length: (input.years ?? 10) + 1 }, (_, i) => first + i * 12);
      for (const pick of occurrences) {
        if (pick < start || pick > end) {
          if (pick < nowIndex && pick + (crop.harvestWindowMonths ?? 0) >= start) missing.add(`${crop.name}: carry-in harvest not quantified`);
          continue;
        }
        if (!hasPlanningYield(crop) || crop.timingVerified === false) { missing.add(crop.name); continue; }
        // Picking can fall after the rolling-year boundary. The whole crop cycle
        // still needs its ground: a September conflict cannot disappear in January.
        const cycleStart = pick - maturity + (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
        const cycleEnd = cycleStart + occupiedMonthsForPlanting(p).length - 1;
        blocked ||= benchmarkDatedAreaConflictBedLabels(input.plantings, input.beds, { startIndex: cycleStart, endIndex: cycleEnd, originIndex: nowIndex, plantingId: p.id }).length > 0;
        vegetableKg += estimatedYieldKgAdjusted(p, bed.areaM2, input.plantings);
      }
    }
    const trees = input.trees.map(g => treeAgeProjection(g, input.choices[g.harvest.speciesId], start, end, nowIndex));
    const treeKg = trees.reduce<KgRange>((sum, t) => sumRange(sum, t.knownKg), [0, 0]);
    const combinedKg = blocked ? null : sumRange([vegetableKg, vegetableKg], treeKg);
    const dateLabel = (index: number) => new Date(Math.floor(index / 12), index % 12, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
    years.push({ label: `${dateLabel(start)} – ${dateLabel(end)}`, vegetableKg: blocked ? null : vegetableKg, vegetableMissing: [...missing, ...(blocked ? ['Resolve double-booked beds'] : [])], trees, treeKg, combinedKg, partial: blocked || missing.size > 0 || trees.some(t => t.kg === null) });
  }
  return { years, assumptions: [
    'Projection, not a harvest promise. Vegetables and staples repeat only saved recurring sowings; dated and existing crops happen once.',
    'Vegetable and staple crop-cycle kilograms are counted in the year of first picking, not divided into monthly quantities. Carry-in harvests need actual records.',
    'Vegetable and staple estimates hold bed area, sowings and crop benchmarks constant. Revise the plan if growing trees change shade, water or available bed space.',
    'Tree ages run from planting on this site. Separate older and younger plants into age groups. Research first-crop ages are references, not guaranteed dates.',
    'Tree kg are your farm or nursery assumptions per plant per year. Values hold until the next age you enter; no growth multiplier is invented. A range covers changes within the year. Review the schedule as plants age.',
    'Check that the variety, local climate, pollination, water and care match your yield assumptions. Ages alone do not establish site suitability or survival.',
    'Known subtotals leave out missing yields. Eggs, meat, milk, fish and honey are not included in these crop kg totals. Picking months and food-gap checks still need local confirmation.',
  ] };
}

export function projectedKgLabel(kg: KgRange | null): string {
  if (!kg || !kg.every(n => Number.isFinite(n) && n >= 0)) return 'Needs information';
  const [from, to] = kg.map(n => n > 0 && n < 0.001 ? '<0.001' : numberLabel(n >= 1 ? Math.round(n * 10) / 10 : n));
  return `${from === to ? from : `${from}–${to}`} kg`;
}
