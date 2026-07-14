import type { CropDef, RainPattern } from './crop-catalog';
import { cropByKey, CROPS, MONTHS_SHORT } from './crop-catalog';
import { foodGroupOf } from './crop-groups';
import { priceFor, type CropPrice } from './crop-prices';

export interface PlanBed {
  id: string;
  label: string;
  areaM2: number;
  /** Narrower of the bed's two real-world dimensions, when known (design-canvas
   *  beds have it; the virtual/legacy fallback bed doesn't). A large area can
   *  still be a too-narrow strip for a sprawling vine — area alone can't tell
   *  the difference, this can. */
  minDimM?: number;
}

export interface Planting {
  id: string;
  bedId: string;
  cropKey: string;
  sowMonth: number;
  /** Fraction of the bed's area this planting occupies (0 < f <= 1). Absent =
   *  1 (the whole bed) — every planting saved before this field existed reads
   *  as a full bed, so old plans keep behaving exactly as before. Lets a bed
   *  be split ("half a bed") or intercropped (several partial plantings). */
  areaFraction?: number;
  /** True = this crop is already growing (the farmer planted it before using
   *  the app) — its sow/transplant tasks are already done, only harvest
   *  remains, and it doesn't read as "new" in the estimated-harvest split. */
  existing?: boolean;
}

export interface CropPlanState {
  version: 1;
  plantings: Planting[];
  updatedAt: number;
}

const STORAGE_KEY = 'imbewu_crop_plan_v1';

function emptyPlan(): CropPlanState {
  return { version: 1, plantings: [], updatedAt: Date.now() };
}

export function loadCropPlan(): CropPlanState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return emptyPlan();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPlan();
    const parsed = JSON.parse(raw) as Partial<CropPlanState> | null;
    if (!parsed || !Array.isArray(parsed.plantings)) return emptyPlan();
    return {
      version: 1,
      plantings: parsed.plantings,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return emptyPlan();
  }
}

export function saveCropPlan(s: CropPlanState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded or storage unavailable — fail silently, plan just won't persist.
  }
}

// A personal shortlist of crop keys — purely a UI convenience (quick access
// + sorted to the top of the picker), never consulted by auto-suggest or
// any planning logic. Same idea as Tend's "Crop Library", simpler: no
// per-farmer custom crop data, just which of the catalog's crops to surface
// first.
const FAVOURITES_KEY = 'imbewu_favourite_crops_v1';

export function loadFavouriteCropKeys(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(FAVOURITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveFavouriteCropKeys(keys: Set<string>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...keys]));
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

export function harvestMonth(sowMonth: number, days: number): number {
  const offset = Math.max(1, Math.round(days / 30));
  return wrapMonth(sowMonth + offset);
}

export interface CropTask {
  month: number;
  bedLabel: string;
  cropName: string;
  icon: string;
  action: 'prep' | 'sow' | 'transplant' | 'mulch' | 'harvest';
}

export function tasksForPlan(plantings: Planting[], beds: PlanBed[]): CropTask[] {
  const bedLabel = (bedId: string): string =>
    beds.find((b) => b.id === bedId)?.label ?? 'Unknown bed';

  const tasks: CropTask[] = [];

  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    if (!crop) continue;
    const label = bedLabel(p.bedId);

    // Already-growing crops were sown before the farmer started using the
    // app — bed prep, sowing and the first mulch are already done, only the
    // harvest is still ahead of them.
    if (!p.existing) {
      // Compost/kraal manure, then let the bed rest — a month ahead of sowing
      // gives roughly the usual 2-4 week rest window without needing a
      // separate week-level task granularity.
      tasks.push({
        month: wrapMonth(p.sowMonth - 1),
        bedLabel: label,
        cropName: crop.name,
        icon: crop.icon,
        action: 'prep',
      });

      tasks.push({
        month: wrapMonth(p.sowMonth),
        bedLabel: label,
        cropName: crop.name,
        icon: crop.icon,
        action: 'sow',
      });

      if (crop.transplant) {
        tasks.push({
          month: wrapMonth(p.sowMonth + 1),
          bedLabel: label,
          cropName: crop.name,
          icon: crop.icon,
          action: 'transplant',
        });
      }

      // Water in + mulch, right when the crop actually goes into the bed —
      // the transplant month for anything raised as a seedling first, the
      // sow month itself for everything direct-sown.
      tasks.push({
        month: wrapMonth(crop.transplant ? p.sowMonth + 1 : p.sowMonth),
        bedLabel: label,
        cropName: crop.name,
        icon: crop.icon,
        action: 'mulch',
      });
    }

    tasks.push({
      month: harvestMonth(p.sowMonth, crop.daysToHarvest),
      bedLabel: label,
      cropName: crop.name,
      icon: crop.icon,
      action: 'harvest',
    });
  }

  return tasks.sort((a, b) => a.month - b.month || a.bedLabel.localeCompare(b.bedLabel));
}

export function estimatedYieldKg(p: Planting, bedAreaM2: number): number {
  const crop = cropByKey(p.cropKey);
  if (!crop) return 0;
  return crop.yieldKgPerM2 * bedAreaM2 * (p.areaFraction ?? 1);
}

/**
 * True only for GENUINE intercropping — a fractional planting whose
 * sow→harvest window actually overlaps, in time, with a DIFFERENT crop on
 * the same bed. A fractional slice that doesn't overlap anything (e.g. one
 * batch of a staggered same-crop succession, sown in its own month with no
 * other crop sharing that window) is bed-SPLITTING over time, not
 * intercropping, and calling it "intercropped" would be a mislabel — the
 * same wrap-safe overlap test as bedOverlapFraction, but keyed to a specific
 * OTHER planting rather than summed across all of them, and explicitly
 * excluding same-cropKey matches (a succession batch isn't "intercropped
 * with itself").
 */
export function isGenuinelyIntercropped(p: Planting, allPlantings: Planting[]): boolean {
  if ((p.areaFraction ?? 1) >= 1) return false;
  const crop = cropByKey(p.cropKey);
  if (!crop) return false;
  const pHarvest = harvestMonth(p.sowMonth, crop.daysToHarvest);
  const norm = (s: number, e: number): [number, number] => (e >= s ? [s, e] : [s, e + 12]);
  const [as, ae] = norm(p.sowMonth, pHarvest);
  return allPlantings.some((other) => {
    if (other.id === p.id || other.bedId !== p.bedId || other.cropKey === p.cropKey) return false;
    const oc = cropByKey(other.cropKey);
    if (!oc) return false;
    const oHarvest = harvestMonth(other.sowMonth, oc.daysToHarvest);
    for (const [bs, be] of [norm(other.sowMonth, oHarvest), norm(other.sowMonth + 12, oHarvest + 12)]) {
      if (as <= be && bs <= ae) return true;
    }
    return false;
  });
}

// A modest, deliberately conservative yield discount for genuine
// intercropping. Real companion-planting yield is genuinely mixed in
// practice — well-matched pairs can have a combined Land Equivalent Ratio
// above 1 (more total food than either grown alone), poorly-matched pairs
// competing for light/water/nutrients can yield less — and this app has no
// per-pair compatibility data to tell the two apart. Assuming perfectly
// independent full yields for both crops sharing the same ground at the
// same time would overstate the honest case; a flat discount is a more
// conservative default than claiming false precision either way.
const INTERCROP_YIELD_DISCOUNT = 0.9;

/** estimatedYieldKg, discounted by INTERCROP_YIELD_DISCOUNT when genuinely intercropped — see isGenuinelyIntercropped. */
export function estimatedYieldKgAdjusted(p: Planting, bedAreaM2: number, allPlantings: Planting[]): number {
  const base = estimatedYieldKg(p, bedAreaM2);
  return isGenuinelyIntercropped(p, allPlantings) ? base * INTERCROP_YIELD_DISCOUNT : base;
}

// Whether the crop picker offers bed-SHARING (splitting a bed by fraction —
// intercropping or a manual split) at all. Off by default: sharing a bed
// well needs some gardening judgement (companion compatibility, genuine
// space), so — same reasoning as space-hungry vines defaulting to "grow
// elsewhere" — this is an opt-in the farmer turns on once they want it,
// not a choice offered unprompted on every single crop added. Note this is
// SEPARATE from staggered succession (lib/crop-autosuggest.ts's own
// same-crop bed-thirds staggering, and the manual "half/third/quarter"
// picker use for a NEW succession slot of the SAME crop) — those aren't
// gated by this, only genuinely DIFFERENT crops sharing space are the
// concern this toggle exists for. In practice the picker gates the whole
// fraction-choice UI behind it for simplicity, since re-deriving "is this
// specific pick going to be same-crop-succession or genuine intercropping"
// before the crop is even chosen isn't reliably knowable up front.
const ALLOW_BED_SHARING_KEY = 'imbewu_allow_bed_sharing_v1';

export function loadAllowBedSharing(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(ALLOW_BED_SHARING_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveAllowBedSharing(allow: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ALLOW_BED_SHARING_KEY, allow ? '1' : '0');
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

/**
 * Space-hungry crops (vigorous vines, block-planted grains) don't share a
 * bed well — recommend a dedicated area instead of splitting/intercropping.
 * Threshold matches the catalog's own "give it room"/"vigorous vine" notes:
 * butternut(100cm), pumpkin(120cm), watermelon(150cm) qualify; tomatoes(50),
 * cucumber(40) etc. don't.
 */
export function isSpaceHungry(crop: CropDef): boolean {
  return crop.spacingCm >= 80;
}

/**
 * How much of a bed is already committed to OTHER plantings whose sow→harvest
 * window overlaps the given one — used to warn (not block) before splitting
 * a bed past 100%. `excludeId` skips the planting being edited, if any.
 */
export function bedOverlapFraction(
  bedId: string, sowMonth: number, harvestEndMonth: number, plantings: Planting[], excludeId?: string,
): number {
  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
    // Both ranges expressed as month-of-year spans that may wrap; a wrapping
    // range (e.g. Nov→Feb) becomes ONE ascending segment on a doubled 1-24
    // timeline (e+12 is always > s once wrapped) — comparing "b" at both its
    // base position and +12 catches a match that only lines up a cycle later.
    const norm = (s: number, e: number): [number, number] => (e >= s ? [s, e] : [s, e + 12]);
    const [as, ae] = norm(aStart, aEnd);
    for (const [bs, be] of [norm(bStart, bEnd), norm(bStart + 12, bEnd + 12)]) {
      if (as <= be && bs <= ae) return true;
    }
    return false;
  };
  return plantings
    .filter((p) => p.bedId === bedId && p.id !== excludeId)
    .reduce((sum, p) => {
      const crop = cropByKey(p.cropKey);
      if (!crop) return sum;
      const pHarvest = harvestMonth(p.sowMonth, crop.daysToHarvest);
      return overlaps(sowMonth, harvestEndMonth, p.sowMonth, pHarvest) ? sum + (p.areaFraction ?? 1) : sum;
    }, 0);
}

/**
 * If a farmer can't get hold of a crop (no seed, wrong season locally, etc)
 * and wants to remove it, suggest the best same-food-group replacement
 * instead of leaving them to search the whole catalog themselves. Prefers a
 * crop not already growing elsewhere in the plan (keeps variety rather than
 * doubling down on something already covered), falling back to any
 * same-group crop if every option is already in use. Ranked by yieldKgPerM2
 * as a simple "generally worthwhile" proxy — the farmer still picks via Edit
 * if they want something else.
 */
export function suggestSubstituteCrop(planting: Planting, allPlantings: Planting[]): CropDef | null {
  const current = cropByKey(planting.cropKey);
  if (!current) return null;
  const group = foodGroupOf(current);
  const usedKeys = new Set(allPlantings.filter((p) => p.id !== planting.id).map((p) => p.cropKey));
  const candidates = CROPS.filter((c) => c.key !== current.key && foodGroupOf(c) === group);
  if (!candidates.length) return null;
  const fresh = candidates.filter((c) => !usedKeys.has(c.key));
  const pool = fresh.length ? fresh : candidates;
  return [...pool].sort((a, b) => b.yieldKgPerM2 - a.yieldKgPerM2)[0];
}

export function nextValidSowMonth(crop: CropDef, pattern: RainPattern, fromMonth: number): number {
  const months = crop.sowMonths[pattern];
  if (!months || months.length === 0) return wrapMonth(fromMonth);
  const sorted = [...months].sort((a, b) => a - b);
  const found = sorted.find((m) => m >= fromMonth);
  return found !== undefined ? found : sorted[0];
}

/**
 * Seeds/seedlings bill-of-quantities: how many plants of each crop to buy or
 * raise, derived from the beds' real area and the catalog's own spacingCm —
 * no new inputs needed. Grouped by crop (successions of the same crop sum
 * together); "already growing" plantings are excluded (nothing new to buy).
 * A +15% buffer on direct-sow seed counts covers the usual germination
 * losses — seedlings and vegetative propagation (slips/seed tubers, already
 * a living piece of plant rather than a seed germinating from scratch)
 * don't need that buffer.
 */
export interface SeedBoqRow {
  cropKey: string;
  cropName: string;
  icon: string;
  unit: string;
  count: number;
}

const SEED_GERMINATION_BUFFER = 1.15;

// A few catalog crops aren't grown from botanical seed at all — their own
// catalog `note` says so (sweet potato: "rooted slips, not seed"; potato:
// "certified seed potatoes"). Calling the BOQ row "seeds" for these is a
// real, farmer-facing wrong-material mistake, and the seed-germination
// buffer doesn't apply to vegetative propagation the same way.
const PROPAGATION_UNIT: Record<string, string> = {
  'sweet-potato': 'slips',
  potato: 'seed potatoes',
};

export function seedBoqForPlan(plantings: Planting[], beds: PlanBed[]): SeedBoqRow[] {
  const byCrop = new Map<string, number>();
  for (const p of plantings) {
    if (p.existing) continue;
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const areaM2 = bed.areaM2 * (p.areaFraction ?? 1);
    const perPlantM2 = (crop.spacingCm / 100) ** 2;
    const rawCount = areaM2 / perPlantM2;
    const needsBuffer = !crop.transplant && !PROPAGATION_UNIT[crop.key];
    const count = Math.max(1, Math.round(needsBuffer ? rawCount * SEED_GERMINATION_BUFFER : rawCount));
    byCrop.set(crop.key, (byCrop.get(crop.key) ?? 0) + count);
  }
  return [...byCrop.entries()]
    .map(([cropKey, count]) => {
      const crop = cropByKey(cropKey)!;
      const unit = PROPAGATION_UNIT[cropKey] ?? (crop.transplant ? 'seedlings' : 'seeds');
      return { cropKey, cropName: crop.name, icon: crop.icon, unit, count };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * A short, deterministic (no LLM — same rules-engine philosophy as
 * lib/crop-autosuggest.ts: instant, offline, and every line is directly
 * traceable to the plan's own numbers) year-ahead narrative: total harvest,
 * the peak month, any quiet stretch with nothing due, and the single
 * biggest-volume crop as a natural "surplus to sell or preserve" candidate.
 * Works for ANY plan (auto-suggested or hand-built) since it only reads the
 * plantings themselves, not the auto-suggest questionnaire answers.
 */
export function buildYearReport(plantings: Planting[], beds: PlanBed[]): string[] {
  const toPlant = plantings.filter((p) => !p.existing);
  if (!toPlant.length) return [];

  const kgByMonth = Array<number>(13).fill(0); // 1-indexed, [0] unused
  const kgByCrop = new Map<string, number>();
  for (const p of toPlant) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const kg = estimatedYieldKgAdjusted(p, bed.areaM2, plantings);
    kgByMonth[harvestMonth(p.sowMonth, crop.daysToHarvest)] += kg;
    kgByCrop.set(crop.key, (kgByCrop.get(crop.key) ?? 0) + kg);
  }

  const totalKg = kgByMonth.reduce((a, b) => a + b, 0);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const harvestMonths = months.filter((m) => kgByMonth[m] > 0);
  if (!harvestMonths.length) return [];
  const peakMonth = harvestMonths.reduce((best, m) => (kgByMonth[m] > kgByMonth[best] ? m : best), harvestMonths[0]);
  const quietMonths = months.filter((m) => kgByMonth[m] === 0);

  const paragraphs: string[] = [];
  paragraphs.push(
    `This plan should bring in roughly ${totalKg.toFixed(0)}kg over the year, peaking around ` +
    `${MONTHS_SHORT[peakMonth - 1]} (~${kgByMonth[peakMonth].toFixed(0)}kg that month).`,
  );

  if (quietMonths.length) {
    // Group into contiguous runs (wrap-safe) so "Jun, Jul, Aug" reads as one
    // stretch rather than three separate mentions.
    const runs: number[][] = [];
    for (const m of quietMonths) {
      const last = runs[runs.length - 1];
      if (last && (last[last.length - 1] % 12) + 1 === m) last.push(m);
      else runs.push([m]);
    }
    if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
      const first = runs.shift()!;
      runs[runs.length - 1].push(...first);
    }
    const longestRun = runs.reduce((best, r) => (r.length > best.length ? r : best), runs[0]);
    const label = longestRun.length === 1
      ? MONTHS_SHORT[longestRun[0] - 1]
      : `${MONTHS_SHORT[longestRun[0] - 1]}-${MONTHS_SHORT[longestRun.at(-1)! - 1]}`;
    paragraphs.push(`Quietest stretch is around ${label} — nothing due to harvest then, so plan any preserving or selling of earlier harvests to bridge it.`);
  }

  const topCrop = [...kgByCrop.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCrop && topCrop[1] > 0) {
    const crop = cropByKey(topCrop[0])!;
    paragraphs.push(`Your biggest crop by volume is ${crop.name} at ~${topCrop[1].toFixed(0)}kg — if that's more than your household eats fresh, that's your natural surplus to sell or preserve.`);
  }

  // Same bed + same crop, 2+ times = a staggered succession (planted in
  // slices over consecutive months for a continuous harvest, rather than
  // one full-bed batch then a gap before resowing) — worth calling out as a
  // planning win, not just an incidental repeat.
  const staggeredCounts = new Map<string, number>();
  for (const p of toPlant) {
    const key = `${p.bedId}::${p.cropKey}`;
    staggeredCounts.set(key, (staggeredCounts.get(key) ?? 0) + 1);
  }
  const staggeredExample = [...staggeredCounts.entries()].find(([, count]) => count >= 2);
  const staggeredBedCount = [...staggeredCounts.values()].filter((count) => count >= 2).length;
  if (staggeredExample) {
    const [key, count] = staggeredExample;
    const cropKey = key.split('::')[1];
    const crop = cropByKey(cropKey);
    if (crop) {
      const others = staggeredBedCount > 1 ? ` (and ${staggeredBedCount - 1} other bed${staggeredBedCount > 2 ? 's' : ''} too)` : '';
      paragraphs.push(`${crop.name} is staggered ${count} times on the same bed${others} — sown in slices a few weeks apart so harvests keep coming instead of one big flush followed by a gap.`);
    }
  }

  return paragraphs;
}

export type FoodAvailabilityStatus = 'fresh' | 'stored';

export interface FoodAvailabilityItem {
  cropKey: string;
  name: string;
  icon: string;
  status: FoodAvailabilityStatus;
}

/**
 * What should actually be on hand to eat each month — not just "what's being
 * picked this instant" (harvestMonth alone gives a one-month blip for every
 * crop), but also crops that keep producing after their first picking
 * (harvestWindowMonths — cut-and-come-again greens, fruiting veg) and crops
 * that are harvested once then keep in storage for months (storageMonths —
 * roots, bulbs, grain). Each catalog crop carries at most one of those two
 * traits, so a planting is either "fresh window" or "stored afterwards",
 * never both stacked on top of each other.
 *
 * Includes existing (already-growing) plantings, not just new ones — this
 * answers "what will be on the table", the food-security question, which is
 * different from buildYearReport's "what's new from this plan" framing.
 * 1-indexed like kgByMonth above ([0] unused, months are 1-12).
 */
export function buildFoodAvailability(plantings: Planting[], beds: PlanBed[]): FoodAvailabilityItem[][] {
  const byMonth: Map<string, FoodAvailabilityStatus>[] = Array.from({ length: 13 }, () => new Map());
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const hMonth = harvestMonth(p.sowMonth, crop.daysToHarvest);
    const freshSpan = crop.harvestWindowMonths ?? 0;
    for (let off = 0; off <= freshSpan; off++) {
      byMonth[wrapMonth(hMonth + off)].set(crop.key, 'fresh');
    }
    const storageSpan = crop.storageMonths ?? 0;
    for (let off = 1; off <= storageSpan; off++) {
      const m = wrapMonth(hMonth + freshSpan + off);
      if (byMonth[m].get(crop.key) !== 'fresh') byMonth[m].set(crop.key, 'stored');
    }
  }
  return byMonth.map((map) =>
    [...map.entries()]
      .map(([cropKey, status]) => {
        const crop = cropByKey(cropKey)!;
        return { cropKey, name: crop.name, icon: crop.icon, status };
      })
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'fresh' ? -1 : 1)),
  );
}

export interface FoodValueMonth {
  kg: number;
  retailValue: number;
  wholesaleValue: number;
}

/**
 * A per-month kg/Rand FLOW (not a stock level) — deliberately different
 * from buildFoodAvailability's "full planting kg shown in every month of
 * its window" presence framing, which explicitly must NOT be summed (it
 * would double-count the same batch across every month it's still on the
 * shelf). This instead spreads a planting's TOTAL estimated yield evenly
 * across its actual fresh-harvest window (1 month for a one-shot harvest,
 * harvestWindowMonths+1 for cut-and-come-again) — so summing across all 12
 * months always equals the planting's real total yield exactly once, safe
 * to sum for a "value harvested this month" chart. storageMonths crops get
 * their full value in the harvest month only: shelf life extends how long
 * the SAME harvest stays usable, it doesn't create additional yield.
 */
export function buildFoodValueByMonth(
  plantings: Planting[],
  beds: PlanBed[],
  priceOverrides: Record<string, CropPrice>,
): FoodValueMonth[] {
  const byMonth: FoodValueMonth[] = Array.from({ length: 13 }, () => ({ kg: 0, retailValue: 0, wholesaleValue: 0 }));
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const price = priceFor(crop.key, priceOverrides);
    const totalKg = estimatedYieldKgAdjusted(p, bed.areaM2, plantings);
    const hMonth = harvestMonth(p.sowMonth, crop.daysToHarvest);
    const freshSpan = crop.harvestWindowMonths ?? 0;
    const monthsCount = freshSpan + 1;
    const kgPerMonth = totalKg / monthsCount;
    for (let off = 0; off <= freshSpan; off++) {
      const m = wrapMonth(hMonth + off);
      byMonth[m].kg += kgPerMonth;
      if (price) {
        byMonth[m].retailValue += kgPerMonth * price.retailPerKg;
        byMonth[m].wholesaleValue += kgPerMonth * price.wholesalePerKg;
      }
    }
  }
  return byMonth;
}
