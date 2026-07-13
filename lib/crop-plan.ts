import type { CropDef, RainPattern } from './crop-catalog';
import { cropByKey } from './crop-catalog';

export interface PlanBed {
  id: string;
  label: string;
  areaM2: number;
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
  action: 'sow' | 'transplant' | 'harvest';
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
    // app — only the harvest is still ahead of them.
    if (!p.existing) {
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

export function nextValidSowMonth(crop: CropDef, pattern: RainPattern, fromMonth: number): number {
  const months = crop.sowMonths[pattern];
  if (!months || months.length === 0) return wrapMonth(fromMonth);
  const sorted = [...months].sort((a, b) => a - b);
  const found = sorted.find((m) => m >= fromMonth);
  return found !== undefined ? found : sorted[0];
}
