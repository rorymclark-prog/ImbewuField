// Cross-references crop-plan cycle benchmarks (lib/crop-plan.ts) with what was
// actually logged as harvested (ProductionLog) and sold (SalesLog). It never
// turns a crop-cycle total into invented monthly production.
// Pure functions only — no React, no Firestore/localStorage writes. The two
// read-only localStorage loads the caller needs (loadCropPlan, in-progress
// facilitator design) stay in the calling component; this module only takes
// already-loaded data in.

import type { Planting, PlanBed } from './crop-plan';
import { buildPlanYieldBenchmark } from './crop-plan';
import type { FacilitatorDesignState } from './facilitator-design';
import { cropByKey, CROPS } from './crop-catalog';
import { perennialKeyForName, perennialProduceByKey } from './perennial-produce';
import type { ProductionLog, SalesLog } from './db/types';

export type Period = 'month' | 'season' | 'year';

// Mirrors app/facilitator/crops/page.tsx's VIRTUAL_BED: with no design beds
// placed, the crop planner puts every planting on this bed, so intended-yield
// lookups must resolve against the same id or read as 0 for the whole plan.
const VIRTUAL_BED: PlanBed = { id: 'virtual-bed-1', label: 'Bed 1', areaM2: 10 };

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function safeBedDimensions(widthValue: number, heightValue: number): {
  widthM: number;
  heightM: number;
  areaM2: number;
} {
  const widthM = positiveDimension(widthValue);
  const heightM = positiveDimension(heightValue);
  const areaM2 = widthM * heightM;
  return Number.isFinite(areaM2) && areaM2 > 0
    ? { widthM, heightM, areaM2 }
    : { widthM: 1, heightM: 1, areaM2: 1 };
}

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
      const { widthM, heightM, areaM2 } = safeBedDimensions(it.wM, it.hM);
      beds.push({ id: it.id, label: `Bed ${bedN}`, areaM2, minDimM: Math.min(widthM, heightM) });
    } else if (it.type === 'hugel') {
      hugelN += 1;
      const { widthM, heightM, areaM2 } = safeBedDimensions(it.wM, it.hM);
      beds.push({ id: it.id, label: `Hügel ${hugelN}`, areaM2, minDimM: Math.min(widthM, heightM) });
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
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return [];
  if (period === 'year') return Array.from({ length: 12 }, (_, i) => i + 1);
  if (period === 'month') return [now.getMonth() + 1];
  return saSeasonMonths0(now.getMonth()).map((m0) => m0 + 1);
}

function inPeriod(iso: string | null | undefined, period: Period, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime()) || isNaN(now.getTime())) return false;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  const seasonMonths = saSeasonMonths0(now.getMonth());
  if (!seasonMonths.includes(d.getMonth())) return false;
  // Summer crosses New Year. Anchor it to the December that begins the
  // season, so Jan 2026 includes Dec 2025 but never Jan 2025.
  if (seasonMonths.includes(11)) {
    const seasonStartYear = now.getMonth() <= 1
      ? now.getFullYear() - 1
      : now.getFullYear();
    const expectedYear = d.getMonth() === 11
      ? seasonStartYear
      : seasonStartYear + 1;
    return d.getFullYear() === expectedYear;
  }
  return d.getFullYear() === now.getFullYear();
}

/* ── Crop name matching: catalog key <-> free-text logged crop string ──── */

// Strips a leading "Sample — " demo-data prefix (finances page's own seeded
// data), lowercases, and normalizes punctuation/whitespace so "Swiss chard",
// "swiss chard!" and "  Swiss   Chard " all compare equal.
function normalize(raw: string): string {
  if (typeof raw !== 'string') return '';
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

/**
 * The exact-alias tier of the match, with the substring fallback withheld.
 *
 * Exists so a caller can tell "this IS that crop" from "this CONTAINS that crop's name". The
 * distinction turned out to matter: "Malabar spinach" is a food-forest climber and "Pigeon peas"
 * is a shrub, and both were being handed to the annual catalogue by the substring pass — one into
 * Swiss chard's row, the other onto the Peas bed, both then divided by a bed area they never grew
 * on. Neither is an ambiguity the caller can resolve; the perennial catalogue knows each of them
 * outright.
 */
export function exactCropKey(loggedText: string, index: Map<string, string>): string | null {
  const norm = normalize(loggedText);
  if (!norm) return null;
  return index.get(norm) ?? null;
}

/* ── Crop-cycle benchmark yield ─────────────────────────────── */

/**
 * Planning benchmark for one complete crop cycle, grouped by crop.
 *
 * The source tables provide a total yield per planted area and, separately,
 * a picking-window range. They do not say what share is picked in each month.
 * The old implementation divided the cycle total evenly across that window;
 * those monthly kg were invented and made a partial-period harvest look
 * measurably ahead or behind when no monthly benchmark existed.
 *
 * Keep this total at crop-cycle scope. A caller may compare it with an actual
 * crop cycle only after it can identify that cycle's start and completion;
 * Planting currently has month numbers but no calendar year or completion
 * record, so this module deliberately does not perform that comparison. When
 * the caller supplies `nowMonth`, one-off existing crops are anchored to their
 * real forward cohort instead of being folded into the annual template.
 */
export function intendedKgByCropCycle(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth?: number,
): Map<string, number> {
  // Delegate both arithmetic and its uncertainty gate to the plan's one
  // benchmark authority. In particular, an unverified-timing full-bed maize
  // record beside another crop has unknown overlap: computing each crop here
  // independently used to resurrect the exact double-counted kg that
  // buildPlanYieldBenchmark had correctly withheld.
  const benchmark = buildPlanYieldBenchmark(plantings, beds, nowMonth);
  if (benchmark.knownKg === null) return new Map();
  return new Map(benchmark.byCrop.map((row) => [row.cropKey, row.kg]));
}

/* ── Kept-produce prompt ──────────────────────────────────────────────────
   This threshold only controls when to ask what happened to actually logged
   produce. It is not an agronomic yield claim. */
const KEPT_RELATIVE_THRESHOLD = 0.15;
const KEPT_ABSOLUTE_FLOOR_KG = 2;

function hasMeaningfulKeptAmount(sold: number, harvested: number): boolean {
  if (harvested <= 0) return false;
  const kept = harvested - sold;
  return kept >= KEPT_ABSOLUTE_FLOOR_KG && kept / harvested >= KEPT_RELATIVE_THRESHOLD;
}

function validLoggedKg(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function safeKgTotal<T>(rows: T[], value: (row: T) => unknown): number {
  return rows.reduce((sum, row) => {
    const next = sum + validLoggedKg(value(row));
    return Number.isFinite(next) ? next : sum;
  }, 0);
}

/**
 * A record id identifies one persisted log. Repeated copies can arrive when
 * local and remote lists are combined; count the first copy once. Rows without
 * a usable id remain distinct because there is no honest way to identify them.
 */
function uniqueLogsById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (typeof row?.id !== 'string' || !row.id.trim()) return true;
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function loggedCropLabel(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface CropRow {
  cropKey: string;
  cropName: string;
  icon: string;
  /**
   * Area-scaled benchmark for one complete crop-plan cycle. `null` means the
   * selected period has no defensible intended-kg figure: month/season cannot
   * be derived from a crop-cycle total, and some crops have no verified yield
   * benchmark at all.
   *
   * Even when present for the year view, this is not a date-aligned comparison:
   * Planting has no sowing year or completed-cycle marker. UI must call it a
   * crop-cycle benchmark, never "expected this year".
   */
  intendedKg: number | null;
  harvestedKg: number;
  soldKg: number;
  /**
   * Harvested minus sold — the food that stayed on the farm. **`null` means unknown**, and the
   * screen must print nothing rather than a number when it is.
   *
   * "KEPT", NOT "EATEN". It covers home-eaten, given away, spoiled, fed to animals and seed
   * saved. Calling the whole quantity "eaten" overstated home consumption by 122% against the
   * sample books, and for a subsistence household that figure is not trivia — it is the part of
   * the harvest that never became income, and it belongs in the record under a word that is true.
   */
  keptKg: number | null;
  /**
   * Always false until plantings record a dated, completed crop cycle. Kept
   * for consumer compatibility; a partial calendar period cannot prove that
   * a crop-cycle benchmark was missed.
   */
  yieldGap: boolean;
  /** Meaningfully more was harvested than sold — worth asking where the rest went. */
  keptGap: boolean;
  /**
   * More was sold this period than was logged as harvested, so `keptKg` is unknowable.
   *
   * Deliberately states the OBSERVATION and not a cause, because there are two and the app
   * cannot tell them apart: picking that was never logged (money is memorable, picking is not),
   * or sales of an earlier period's harvest. Only one of those is the farmer's omission, and a
   * screen that assumes the wrong one blames her for the app's own blind spot.
   */
  soldExceedsHarvested: boolean;
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
 * The top-level cross-reference: crop-cycle planning benchmark, actually
 * harvested (ProductionLog), and actually sold (SalesLog).
 *
 * - `matched`: planned crops with real harvest and/or sale activity this period.
 * - `notYetHarvested`: legacy result bucket used only by the year view for a
 *   benchmark crop with no logs. Its name is not a timing conclusion; without
 *   sowing years the app cannot know whether that cycle is ahead or complete.
 * - `unmatchedPlanned`: retained for result compatibility but deliberately
 *   empty. No dated completed-cycle marker exists to justify a missed-harvest
 *   accusation.
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
  if (periodMonths.length === 0) {
    return { matched: [], notYetHarvested: [], unmatchedPlanned: [], unplannedActivity: [] };
  }
  const intendedByCrop = intendedKgByCropCycle(plantings, beds, now.getMonth() + 1);
  const cropKeys = new Set(plantings.map((p) => p.cropKey));

  const productionInPeriod = uniqueLogsById(
    production.filter((p) => inPeriod(p.logged_at, period, now)),
  );
  const salesInPeriod = uniqueLogsById(
    sales.filter((s) => inPeriod(s.sold_at, period, now)),
  );

  const matched: CropRow[] = [];
  const notYetHarvested: CropRow[] = [];
  const unmatchedPlanned: CropRow[] = [];
  const matchedProductionIds = new Set<string>();
  const matchedSalesIds = new Set<string>();

  for (const cropKey of cropKeys) {
    const crop = cropByKey(cropKey);
    if (!crop) continue;

    // Month/season intended kg is genuinely unavailable. A crop-cycle total
    // cannot be divided across picking months without an observed production
    // profile. The year view may show the complete-cycle benchmark, but may
    // not treat it as a calendar-year expectation or calculate a shortfall.
    const cropCycleBenchmarkKg = intendedByCrop.get(cropKey) ?? null;
    const intendedKg = period === 'year' ? cropCycleBenchmarkKg : null;

    /* A NAME THE PERENNIAL CATALOGUE KNOWS IS NEVER AN ANNUAL ROW.
       matchCropKey falls back to a substring pass, and the orchard picker writes labels that
       contain annual aliases outright — "Malabar spinach" contains "spinach", "Pigeon peas"
       contains "peas". Without this guard a food-forest climber was folded into Swiss chard's
       row and measured against Swiss chard's crop-cycle benchmark, which rule (e) forbids: a
       perennial is recorded and counted, never planned, scheduled or benchmarked. The rows still
       appear — they fall to the "Other activity" bucket below, which is where an orchard harvest
       belongs, because nothing in the orchard is ever in the crop plan. */
    const isAnnualRow = (raw: string) =>
      perennialKeyForName(loggedCropLabel(raw)) === null
      && matchCropKey(loggedCropLabel(raw), aliasIndex) === cropKey;
    const harvestRows = productionInPeriod.filter((p) => isAnnualRow(p.crop));
    const saleRows = salesInPeriod.filter((s) => isAnnualRow(s.crop));
    harvestRows.forEach((r) => matchedProductionIds.add(r.id));
    saleRows.forEach((r) => matchedSalesIds.add(r.id));

    const harvestedKg = safeKgTotal(harvestRows, (row) => row.kg);
    const soldKg = safeKgTotal(saleRows, (row) => row.kg);

    // SELLING MORE THAN YOU LOGGED PICKING MEANS THE HARVEST FIGURE IS NOT THE HARVEST.
    //
    // This used to be `Math.max(harvestedKg - soldKg, 0)`, and the clamp failed in the direction
    // that matters. Measured against the sample books with the harvest log at 30% — the common
    // case, because money is memorable and picking is not — the app told a subsistence farmer she
    // had kept 0.5 kg when the honest figure was 10.5 kg, AND fired four "the plan expected X, you
    // only got Y" warnings blaming her for what was a logging artefact. It never once said "I do
    // not know", which was the only true thing available to it.
    //
    // So the derived quantity goes to null, and the yield-gap flag is withheld too: a harvest
    // total that is provably missing rows cannot be evidence that the plan was missed.
    const soldExceedsHarvested = soldKg > harvestedKg;

    const row: CropRow = {
      cropKey, cropName: crop.name, icon: crop.icon,
      intendedKg,
      harvestedKg, soldKg,
      keptKg: soldExceedsHarvested ? null : harvestedKg - soldKg,
      yieldGap: false,
      keptGap: soldExceedsHarvested ? false : hasMeaningfulKeptAmount(soldKg, harvestedKg),
      soldExceedsHarvested,
    };

    if (harvestedKg > 0 || soldKg > 0) {
      matched.push(row);
    } else if (intendedKg !== null && intendedKg > 0) {
      notYetHarvested.push(row);
    }
  }

  const unplannedMap = new Map<string, UnplannedRow>();
  /**
   * Bucketed by the produce's own key where the app knows one, and only otherwise by the written
   * text.
   *
   * The orchard half is not a nicety. Nothing here is in the crop plan — a tree never can be —
   * so EVERY fruit the farm records lands in this bucket, and the two forms that feed it disagree
   * by design: a harvest is picked from a list and arrives as the catalogue name, while a sale's
   * crop is free text the farmer types. Bucketing on text alone put "Avocado" harvested and
   * "Avocados" sold on two lines, one showing kilograms with nothing sold and one showing a sale
   * off no harvest. Both lines true; the pair of them a lie about the orchard.
   */
  const perennialFor = (raw: string) => perennialKeyForName(loggedCropLabel(raw));
  const bucketKey = (raw: string) => {
    const perennialKey = perennialFor(raw);
    if (perennialKey) return `perennial:${perennialKey}`;
    const label = loggedCropLabel(raw);
    return normalize(label) || label.trim().toLowerCase() || 'unnamed';
  };
  const emptyRow = (raw: string): UnplannedRow => {
    const perennialKey = perennialFor(raw);
    const written = loggedCropLabel(raw).trim();
    return {
      // The catalogue's name once it is known, so the row is not labelled by whichever of the two
      // forms happened to be filled in first.
      label: (perennialKey && perennialProduceByKey(perennialKey)?.label) || written || 'Unnamed',
      harvestedKg: 0,
      soldKg: 0,
      // A name the perennial catalogue resolves outright is not ambiguous, whatever the annual
      // catalogue's substring pass makes of it.
      ambiguous: !perennialKey && matchCropCandidates(loggedCropLabel(raw), aliasIndex).length > 1,
    };
  };
  for (const p of productionInPeriod) {
    if (matchedProductionIds.has(p.id)) continue;
    const key = bucketKey(p.crop);
    const row = unplannedMap.get(key) ?? emptyRow(p.crop);
    const next = row.harvestedKg + validLoggedKg(p.kg);
    if (Number.isFinite(next)) row.harvestedKg = next;
    unplannedMap.set(key, row);
  }
  for (const s of salesInPeriod) {
    if (matchedSalesIds.has(s.id)) continue;
    const key = bucketKey(s.crop);
    const row = unplannedMap.get(key) ?? emptyRow(s.crop);
    const next = row.soldKg + validLoggedKg(s.kg);
    if (Number.isFinite(next)) row.soldKg = next;
    unplannedMap.set(key, row);
  }

  matched.sort((a, b) => (b.harvestedKg + b.soldKg) - (a.harvestedKg + a.soldKg));
  notYetHarvested.sort((a, b) => (b.intendedKg ?? 0) - (a.intendedKg ?? 0));
  unmatchedPlanned.sort((a, b) => (b.intendedKg ?? 0) - (a.intendedKg ?? 0));
  const unplannedActivity = [...unplannedMap.values()]
    .filter((row) => row.harvestedKg > 0 || row.soldKg > 0)
    .sort((a, b) => (b.harvestedKg + b.soldKg) - (a.harvestedKg + a.soldKg));

  return { matched, notYetHarvested, unmatchedPlanned, unplannedActivity };
}
