// Cross-references the crop plan's INTENDED yield (lib/crop-plan.ts) against
// what was actually logged as harvested (ProductionLog) and sold (SalesLog).
// Pure functions only — no React, no Firestore/localStorage writes. The two
// read-only localStorage loads the caller needs (loadCropPlan, in-progress
// facilitator design) stay in the calling component; this module only takes
// already-loaded data in.

import type { Planting, PlanBed } from './crop-plan';
import { harvestMonth, estimatedYieldKgAdjusted } from './crop-plan';
import type { FacilitatorDesignState } from './facilitator-design';
import { cropByKey, CROPS } from './crop-catalog';
import type { ProductionLog, SalesLog } from './db/types';

export type Period = 'month' | 'season' | 'year';

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

// Mirrors app/facilitator/crops/page.tsx's VIRTUAL_BED: with no design beds
// placed, the crop planner puts every planting on this bed, so intended-yield
// lookups must resolve against the same id or read as 0 for the whole plan.
const VIRTUAL_BED: PlanBed = { id: 'virtual-bed-1', label: 'Bed 1', areaM2: 10 };

/**
 * Beds = design items of type 'bed'/'hugel', with the virtual-bed fallback
 * when none exist. Deliberately duplicated from app/facilitator/crops/
 * page.tsx's own (un-exported) computeDesignBeds + VIRTUAL_BED — that file is
 * actively worked on elsewhere and off-limits to edit, so rather than export
 * a helper from it, this ~10-line pure calc is copied once here. Keep both in
 * sync if the design-item bed shape ever changes.
 */
export function bedsFromDesign(state: FacilitatorDesignState | null): PlanBed[] {
  const beds: PlanBed[] = [];
  let bedN = 0;
  let hugelN = 0;
  for (const it of state?.items ?? []) {
    if (it.type === 'bed') {
      bedN += 1;
      beds.push({ id: it.id, label: `Bed ${bedN}`, areaM2: (it.wM || 1) * (it.hM || 1), minDimM: Math.min(it.wM || 1, it.hM || 1) });
    } else if (it.type === 'hugel') {
      hugelN += 1;
      beds.push({ id: it.id, label: `Hügel ${hugelN}`, areaM2: (it.wM || 1) * (it.hM || 1), minDimM: Math.min(it.wM || 1, it.hM || 1) });
    }
  }
  return beds.length > 0 ? beds : [VIRTUAL_BED];
}

/* ── Period helpers (duplicated from app/finances/page.tsx's private
   saSeasonMonths/inPeriod — 6-10 line pure helpers, not currently exported,
   kept here so this module has no import dependency on the page that
   consumes it) ───────────────────────────────────────────────────────── */

// m is a JS Date.getMonth() value (0-indexed); returns the current SA season
// as 0-indexed months.
function saSeasonMonths0(m: number): number[] {
  if (m >= 8 && m <= 10) return [8, 9, 10];
  if (m === 11 || m <= 1) return [11, 0, 1];
  if (m >= 2 && m <= 4) return [2, 3, 4];
  return [5, 6, 7];
}

/** The calendar months (1-12) covered by a period, relative to `now`. */
export function monthsForPeriod(period: Period, now: Date): number[] {
  if (period === 'year') return Array.from({ length: 12 }, (_, i) => i + 1);
  if (period === 'month') return [now.getMonth() + 1];
  return saSeasonMonths0(now.getMonth()).map((m0) => m0 + 1);
}

function inPeriod(iso: string | null | undefined, period: Period, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (d.getFullYear() !== now.getFullYear()) return false;
  if (period === 'month') return d.getMonth() === now.getMonth();
  return saSeasonMonths0(now.getMonth()).includes(d.getMonth());
}

/* ── Crop name matching: catalog key <-> free-text logged crop string ──── */

// Strips a leading "Sample — " demo-data prefix (finances page's own seeded
// data), lowercases, and normalizes punctuation/whitespace so "Swiss chard",
// "swiss chard!" and "  Swiss   Chard " all compare equal.
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^sample\s*[—-]\s*/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Catalog names carry at most one parenthetical alias, e.g. "Swiss chard
// (spinach)" or "Dry beans (sugar beans)" — split on it so a farmer who
// plants "Swiss chard (spinach)" but logs "spinach" still matches.
function aliasesForCropName(name: string): string[] {
  const m = name.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!m) return [normalize(name)];
  const primary = normalize(m[1]);
  const extras = m[2].split(/[,/]/).map((s) => normalize(s)).filter(Boolean);
  return [primary, ...extras];
}

/** normalized alias string -> catalog crop key, built once from CROPS. */
export function buildCropAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const crop of CROPS) {
    for (const alias of aliasesForCropName(crop.name)) {
      if (alias) index.set(alias, crop.key);
    }
  }
  return index;
}

// Guards the substring fallback against 1-2 letter false hits (e.g. a short
// alias incidentally appearing inside unrelated free text).
const MIN_SUBSTRING_LEN = 4;

/**
 * Every catalog crop key a farmer's free-text entry could refer to at its
 * best match tier (exact alias first, then substring). More than one result
 * means the name is genuinely ambiguous — e.g. "beans" hits green/dry/broad
 * beans — and the caller must NOT pick one arbitrarily.
 */
export function matchCropCandidates(loggedText: string, index: Map<string, string>): string[] {
  const norm = normalize(loggedText);
  if (!norm) return [];
  const exact = index.get(norm);
  if (exact) return [exact];
  if (norm.length < MIN_SUBSTRING_LEN) return [];
  const candidates = new Set<string>();
  for (const [alias, cropKey] of index) {
    if (alias.length < MIN_SUBSTRING_LEN) continue;
    if (norm.includes(alias) || alias.includes(norm)) candidates.add(cropKey);
  }
  return [...candidates];
}

/**
 * Matches a farmer's free-text crop/sale entry to a catalog crop key, or
 * null when nothing matches OR the match is ambiguous — silently guessing
 * would misattribute kg/Rand to the wrong crop row.
 */
export function matchCropKey(loggedText: string, index: Map<string, string>): string | null {
  const candidates = matchCropCandidates(loggedText, index);
  return candidates.length === 1 ? candidates[0] : null;
}

/* ── Intended yield, spread across each crop's harvest window ──────────── */

/**
 * Per-crop version of lib/crop-plan.ts's buildFoodValueByMonth: a planting's
 * total estimated yield spread evenly across its fresh-harvest window
 * (1 month for a one-shot harvest, harvestWindowMonths+1 for cut-and-come-
 * again), summed by cropKey. Summing all 13 months for a crop always equals
 * that crop's real total intended yield exactly once.
 */
export function intendedKgByMonthPerCrop(plantings: Planting[], beds: PlanBed[]): Map<string, number[]> {
  const byCrop = new Map<string, number[]>();
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const totalKg = estimatedYieldKgAdjusted(p, bed.areaM2, plantings);
    const hMonth = harvestMonth(p.sowMonth, crop.daysToHarvest);
    const freshSpan = crop.harvestWindowMonths ?? 0;
    const kgPerMonth = totalKg / (freshSpan + 1);
    const arr = byCrop.get(crop.key) ?? Array<number>(13).fill(0);
    for (let off = 0; off <= freshSpan; off++) {
      arr[wrapMonth(hMonth + off)] += kgPerMonth;
    }
    byCrop.set(crop.key, arr);
  }
  return byCrop;
}

/**
 * Whether a zero-logged crop's harvest should already have started (worth
 * flagging as a possible miss/misnamed entry) vs is still genuinely ahead
 * (soften as "not yet harvested"). A Planting only carries a month, no year,
 * so there's no exact "did this already happen this year" answer — this
 * treats being within the first half of the 12-month cycle since the
 * nominal harvest start (or within the harvest window itself, if longer) as
 * "should have data by now", and the other half as "coming up soon".
 * Deliberately a simple, documented heuristic, not exact date arithmetic.
 */
function isHarvestOverdue(cropKey: string, plantings: Planting[], currentMonth: number): boolean {
  const crop = cropByKey(cropKey);
  if (!crop) return false;
  return plantings
    .filter((p) => p.cropKey === cropKey)
    .some((p) => {
      const hStart = harvestMonth(p.sowMonth, crop.daysToHarvest);
      const monthsSinceStart = ((currentMonth - hStart) % 12 + 12) % 12;
      const windowLen = crop.harvestWindowMonths ?? 0;
      return monthsSinceStart <= Math.max(windowLen, 6);
    });
}

/* ── Gap flags ───────────────────────────────────────────────────────────
   Threshold is a product/UX judgement call (flagged as an open question in
   the handoff) — this is a starting default, not a hard-coded fact. */
const GAP_RELATIVE_THRESHOLD = 0.15;
const GAP_ABSOLUTE_FLOOR_KG = 2;

function isMeaningfulGap(actual: number, expected: number): boolean {
  if (expected <= 0) return false;
  const gap = expected - actual;
  if (gap <= 0) return false;
  return gap >= GAP_ABSOLUTE_FLOOR_KG && gap / expected >= GAP_RELATIVE_THRESHOLD;
}

export interface CropRow {
  cropKey: string;
  cropName: string;
  icon: string;
  intendedKg: number;
  harvestedKg: number;
  soldKg: number;
  unaccountedKg: number;
  /** Harvested meaningfully below what the plan expected this period. */
  yieldGap: boolean;
  /** Harvested meaningfully more than was sold — home-eaten/given away/spoiled? */
  unaccountedGap: boolean;
}

export interface UnplannedRow {
  label: string;
  harvestedKg: number;
  soldKg: number;
  /** Name matched several catalog crops, so it can't be credited to one. */
  ambiguous: boolean;
}

export interface ReconciliationResult {
  matched: CropRow[];
  notYetHarvested: CropRow[];
  unmatchedPlanned: CropRow[];
  unplannedActivity: UnplannedRow[];
}

/**
 * The top-level cross-reference: intended (crop plan) vs actually harvested
 * (ProductionLog) vs actually sold (SalesLog), for one period.
 *
 * - `matched`: planned crops with real harvest and/or sale activity this period.
 * - `notYetHarvested`: planned crops with intended yield this period but zero
 *   logs at all, whose harvest window hasn't started yet (early-season — not a problem).
 * - `unmatchedPlanned`: same zero-logs case, but the harvest window should
 *   already have started — worth a look (missed logging, or logged under a
 *   name the alias matcher didn't recognize).
 * - `unplannedActivity`: logged production/sales that never matched anything
 *   in this farmer's actual plan (eggs, livestock, off-plan crops) — shown
 *   plainly, no gap analysis, since there's no "intended" to compare against.
 *   Ambiguous names ("beans") land here too, flagged, rather than being
 *   credited to an arbitrary crop.
 */
export function buildReconciliation(
  plantings: Planting[],
  beds: PlanBed[],
  production: ProductionLog[],
  sales: SalesLog[],
  period: Period,
  now: Date,
): ReconciliationResult {
  const aliasIndex = buildCropAliasIndex();
  const periodMonths = monthsForPeriod(period, now);
  const intendedByCrop = intendedKgByMonthPerCrop(plantings, beds);
  const cropKeys = new Set(plantings.map((p) => p.cropKey));
  const currentMonth = now.getMonth() + 1;

  const productionInPeriod = production.filter((p) => inPeriod(p.logged_at, period, now));
  const salesInPeriod = sales.filter((s) => inPeriod(s.sold_at, period, now));

  const matched: CropRow[] = [];
  const notYetHarvested: CropRow[] = [];
  const unmatchedPlanned: CropRow[] = [];
  const matchedProductionIds = new Set<string>();
  const matchedSalesIds = new Set<string>();

  for (const cropKey of cropKeys) {
    const crop = cropByKey(cropKey);
    if (!crop) continue;

    const monthArr = intendedByCrop.get(cropKey);
    const intendedKg = monthArr ? periodMonths.reduce((sum, m) => sum + (monthArr[m] ?? 0), 0) : 0;

    const harvestRows = productionInPeriod.filter((p) => matchCropKey(p.crop, aliasIndex) === cropKey);
    const saleRows = salesInPeriod.filter((s) => matchCropKey(s.crop, aliasIndex) === cropKey);
    harvestRows.forEach((r) => matchedProductionIds.add(r.id));
    saleRows.forEach((r) => matchedSalesIds.add(r.id));

    const harvestedKg = harvestRows.reduce((s, r) => s + (r.kg ?? 0), 0);
    const soldKg = saleRows.reduce((s, r) => s + (r.kg ?? 0), 0);

    const row: CropRow = {
      cropKey, cropName: crop.name, icon: crop.icon,
      intendedKg, harvestedKg, soldKg,
      unaccountedKg: Math.max(harvestedKg - soldKg, 0),
      yieldGap: isMeaningfulGap(harvestedKg, intendedKg),
      unaccountedGap: isMeaningfulGap(soldKg, harvestedKg),
    };

    if (harvestedKg > 0 || soldKg > 0) {
      matched.push(row);
    } else if (intendedKg > 0) {
      (isHarvestOverdue(cropKey, plantings, currentMonth) ? unmatchedPlanned : notYetHarvested).push(row);
    }
  }

  const unplannedMap = new Map<string, UnplannedRow>();
  const bucketKey = (raw: string) => normalize(raw) || raw.trim().toLowerCase();
  const emptyRow = (raw: string): UnplannedRow => ({
    label: raw.trim() || 'Unnamed',
    harvestedKg: 0,
    soldKg: 0,
    ambiguous: matchCropCandidates(raw, aliasIndex).length > 1,
  });
  for (const p of productionInPeriod) {
    if (matchedProductionIds.has(p.id)) continue;
    const key = bucketKey(p.crop);
    const row = unplannedMap.get(key) ?? emptyRow(p.crop);
    row.harvestedKg += p.kg ?? 0;
    unplannedMap.set(key, row);
  }
  for (const s of salesInPeriod) {
    if (matchedSalesIds.has(s.id)) continue;
    const key = bucketKey(s.crop);
    const row = unplannedMap.get(key) ?? emptyRow(s.crop);
    row.soldKg += s.kg ?? 0;
    unplannedMap.set(key, row);
  }

  matched.sort((a, b) => (b.harvestedKg + b.soldKg) - (a.harvestedKg + a.soldKg));
  notYetHarvested.sort((a, b) => b.intendedKg - a.intendedKg);
  unmatchedPlanned.sort((a, b) => b.intendedKg - a.intendedKg);
  const unplannedActivity = [...unplannedMap.values()].sort((a, b) => (b.harvestedKg + b.soldKg) - (a.harvestedKg + a.soldKg));

  return { matched, notYetHarvested, unmatchedPlanned, unplannedActivity };
}
