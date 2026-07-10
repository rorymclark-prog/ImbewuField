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
  return crop.yieldKgPerM2 * bedAreaM2;
}

export function nextValidSowMonth(crop: CropDef, pattern: RainPattern, fromMonth: number): number {
  const months = crop.sowMonths[pattern];
  if (!months || months.length === 0) return wrapMonth(fromMonth);
  const sorted = [...months].sort((a, b) => a - b);
  const found = sorted.find((m) => m >= fromMonth);
  return found !== undefined ? found : sorted[0];
}
