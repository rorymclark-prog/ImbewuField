import type { CropDef, RainPattern } from './crop-catalog';
import { cropByKey, CROPS, hasPlanningYield, MONTHS_SHORT, plantsPerM2, plantsPerM2Range } from './crop-catalog';
import { foodGroupOf } from './crop-groups';
import {
  isSampleMode,
  getSandboxCropPlan, setSandboxCropPlan,
  getSandboxFavouriteCropKeys, setSandboxFavouriteCropKeys,
  getSandboxAllowBedSharing, setSandboxAllowBedSharing,
  getSandboxCashflowSettings, setSandboxCashflowSettings,
} from './sample-mode';
import { activeAccountLocalStorageKey } from './account-local-storage';

export interface PlanBed {
  id: string;
  label: string;
  areaM2: number;
  /** Narrower of the bed's two real-world dimensions, when known (design-canvas
   *  beds have it; the virtual/legacy fallback bed doesn't). A large area can
   *  still be a too-narrow strip for a sprawling vine — area alone can't tell
   *  the difference, this can. */
  minDimM?: number;
  /** 'bed' (the default — absent reads as 'bed', so every plan built before this field
   *  existed keeps behaving exactly as before) is a small worked bed. 'plot' is a
   *  field-scale rotation unit — a traced staple garden (maize/beans/pumpkin block) that
   *  takes ONE crop across its WHOLE area at a time, the way a farmer rotates a quarter-
   *  hectare field, not several plantings sharing a bed. */
  kind?: 'bed' | 'plot';
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
   *  the app) — its sow/transplant tasks are already done, only harvest or
   *  cover-crop termination remains, and it doesn't read as "new" in the
   *  estimated-harvest split. */
  existing?: boolean;
}

export interface CropPlanState {
  version: 1;
  plantings: Planting[];
  /** Climate window used when the plan was generated. Optional so every plan
   * saved before this field existed remains readable. */
  rainPattern?: RainPattern;
  updatedAt: number;
}

const STORAGE_KEY = 'imbewu_crop_plan_v1';
export const CROP_PLAN_CHANGED_EVENT = 'imbewu-crop-plan-changed';

function emptyPlan(): CropPlanState {
  return { version: 1, plantings: [], updatedAt: Date.now() };
}

export function loadCropPlan(): CropPlanState {
  if (isSampleMode()) return getSandboxCropPlan();
  if (typeof window === 'undefined' || !window.localStorage) {
    return emptyPlan();
  }
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(STORAGE_KEY));
    if (!raw) return emptyPlan();
    const parsed = JSON.parse(raw) as Partial<CropPlanState> | null;
    if (!parsed || !Array.isArray(parsed.plantings)) return emptyPlan();
    return {
      version: 1,
      plantings: parsed.plantings,
      ...(isRainPattern(parsed.rainPattern) ? { rainPattern: parsed.rainPattern } : {}),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return emptyPlan();
  }
}

function isRainPattern(value: unknown): value is RainPattern {
  return value === 'summer'
    || value === 'winter'
    || value === 'all-year'
    || value === 'mild-frost';
}

/**
 * Persist the crop plan. Returns whether it actually reached storage.
 *
 * IT USED TO RETURN void AND SWALLOW THE FAILURE — "fail silently, plan just won't persist". The
 * planner AUTOSAVES through this on a 400 ms debounce, so a farmer never taps a button and so
 * never gets a confirmation to disbelieve: on a full phone they simply keep working, reload, and
 * every planting, removal and timing change since the last successful write is gone. Silence is
 * the worst available answer here precisely because nothing ever claimed success.
 *
 * SSR and a missing localStorage return false as well. Those are not failures a farmer can act on,
 * but they are equally not a save, and a function that answers "did this persist" must not say yes
 * about a write it never attempted.
 */
export function saveCropPlan(s: CropPlanState): boolean {
  if (isSampleMode()) {
    setSandboxCropPlan(s);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CROP_PLAN_CHANGED_EVENT));
    return true; // the sandbox IS the demo's real store, so this genuinely did persist
  }
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(STORAGE_KEY), JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(CROP_PLAN_CHANGED_EVENT));
    return true;
  } catch {
    // Quota exceeded or storage unavailable. The CALLER must surface this — returning false is
    // the entire point of this signature. See the planner's saveFailed banner.
    return false;
  }
}

// A personal shortlist of crop keys — purely a UI convenience (quick access
// + sorted to the top of the picker), never consulted by auto-suggest or
// any planning logic. Same idea as Tend's "Crop Library", simpler: no
// per-farmer custom crop data, just which of the catalog's crops to surface
// first.
const FAVOURITES_KEY = 'imbewu_favourite_crops_v1';

export function loadFavouriteCropKeys(): Set<string> {
  if (isSampleMode()) return getSandboxFavouriteCropKeys();
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(FAVOURITES_KEY));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveFavouriteCropKeys(keys: Set<string>): void {
  if (isSampleMode()) { setSandboxFavouriteCropKeys(keys); return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(FAVOURITES_KEY),
      JSON.stringify([...keys]),
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

export function harvestMonth(sowMonth: number, days: number): number {
  const offset = planningMaturityMonths(days);
  return wrapMonth(sowMonth + offset);
}

/** Coarse calendar occupancy rounds UP. Rounding 70 days to two months freed
 * a bed before the upper supported duration had elapsed and could place a
 * successor on productive ground. */
export function planningMaturityMonths(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  return Math.max(1, Math.ceil(days / 30));
}

/** KZN DARD says most vegetable transplants are ready in 4–6 weeks in warm
 * conditions and the period may double in cold conditions (8–12 weeks). A
 * month-sized plan therefore has an earliest one-month and conservative latest
 * three-month field-entry marker. Readiness, not the calendar edge, decides
 * the actual day. */
export const TRANSPLANT_ENTRY_EARLIEST_MONTHS = 1;
export const TRANSPLANT_ENTRY_LATEST_MONTHS = 3;
/**
 * The month used by the actual bed plan for a tray-grown crop.
 *
 * The 1-3 month range above is a readiness CHECK window, not three months of
 * bed occupancy. Painting from its earliest edge and harvesting from its
 * latest edge made an 80-day lettuce crop look as though it occupied a bed
 * for six months. A crop plan needs one committed working date; two months is
 * the conservative end of the published usual 4-6 week warm-condition range.
 * If cold nursery conditions delay a real tray beyond that date, the farmer
 * moves the planting rather than the planner silently blocking empty ground.
 */
export const TRANSPLANT_ENTRY_PLANNED_MONTHS = 2;

/**
 * WHICH EDGE RESERVES THE BED (decided 2026-08-19, closing a 2,003-violation
 * stress finding). The farmer-facing surfaces print the EARLIEST edge as the
 * moment field entry may happen: tasksForPlan emits the "check seedlings;
 * transplant when ready" job in the sow+1 month, the bed-plan and detail
 * views print "check/transplant when ready <sow+1>–<sow+3>", the buying
 * schedule stages seedlings for the sow+1 month, and the land-occupancy bar
 * already painted from sow+1. The bed must be free when the farmer is told
 * they may plant — so every occupancy ledger reserves the bed from
 * TRANSPLANT_ENTRY_EARLIEST_MONTHS while harvest timing and bed RELEASE stay
 * anchored to the PLANNED working transplant month (the conservative end of
 * the published 4–6 week warm range). One month of the reservation therefore
 * covers nursery-readiness uncertainty rather than guaranteed plant growth;
 * that is the price of never double-booking ground the printed calendar has
 * already offered to a tray of seedlings.
 */
export const TRANSPLANT_BED_RESERVED_FROM_MONTHS = TRANSPLANT_ENTRY_EARLIEST_MONTHS;

/** Earliest month a tray crop may occupy the bed. Reserving from this edge
 * prevents another crop being placed on ground seedlings may already need. */
export function bedEntryMonth(sowMonth: number, crop: Pick<CropDef, 'transplant'>): number {
  return wrapMonth(sowMonth + (crop.transplant ? TRANSPLANT_ENTRY_EARLIEST_MONTHS : 0));
}

/** Conservative latest field-entry month for a tray crop. This is the upper
 * nursery-duration boundary used for harvest and bed-release planning, not an
 * instruction to hold ready seedlings back. */
export function latestBedEntryMonth(sowMonth: number, crop: Pick<CropDef, 'transplant'>): number {
  return wrapMonth(sowMonth + (crop.transplant ? TRANSPLANT_ENTRY_LATEST_MONTHS : 0));
}

/** The single field-entry month used for occupancy, harvests and bars. */
export function plannedBedEntryMonth(sowMonth: number, crop: Pick<CropDef, 'transplant'>): number {
  return wrapMonth(sowMonth + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0));
}

/** Harvest timing on the same sow-month timeline shown to the farmer. South
 * African production guides state the growing period for transplanted crops
 * from transplanting, so their nursery month must be added once. */
export function harvestMonthForCrop(
  sowMonth: number,
  crop: Pick<CropDef, 'daysToHarvest' | 'transplant'>,
): number {
  return wrapMonth(
    harvestMonth(sowMonth, crop.daysToHarvest)
    + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0),
  );
}

export function harvestEndMonthForCrop(
  sowMonth: number,
  crop: Pick<CropDef, 'daysToHarvest' | 'transplant' | 'harvestWindowMonths'>,
): number {
  return wrapMonth(harvestMonthForCrop(sowMonth, crop) + (crop.harvestWindowMonths ?? 0));
}

/** Resolve a farmer-confirmed already-growing crop to the most recent
 * occurrence of its recorded sow month. "Existing" can never mean a future
 * sowing; choosing the nearest month broke crops whose field life exceeds six
 * months (for example amadumbe). */
export function existingSowOffset(sowMonth: number, nowMonth: number): number {
  const forward = ((sowMonth - nowMonth) % 12 + 12) % 12;
  return forward === 0 ? 0 : forward - 12;
}

/**
 * Every calendar month a known planting occupies its bed: sowing through the
 * end of the fresh-harvest window. A missing crop key or invalid sow month has
 * no defensible occupancy, so returns no months rather than inventing one.
 */
export function occupiedMonthsForPlanting(
  planting: Pick<Planting, 'cropKey' | 'sowMonth'>,
): number[] {
  const crop = cropByKey(planting.cropKey);
  if (!crop || crop.timingVerified === false || !Number.isInteger(planting.sowMonth) || planting.sowMonth < 1 || planting.sowMonth > 12) {
    return [];
  }
  const maturityOffset = planningMaturityMonths(crop.daysToHarvest);
  // Reserved from the printed earliest field-entry month; released after the
  // harvest window computed from the PLANNED transplant month — see
  // TRANSPLANT_BED_RESERVED_FROM_MONTHS for why the edges differ.
  const reservedEarly = crop.transplant
    ? TRANSPLANT_ENTRY_PLANNED_MONTHS - TRANSPLANT_BED_RESERVED_FROM_MONTHS
    : 0;
  const span = maturityOffset + (crop.harvestWindowMonths ?? 0) + 1 + reservedEarly;
  const starts = bedEntryMonth(planting.sowMonth, crop);
  return Array.from({ length: span }, (_, offset) => wrapMonth(starts + offset));
}

/** Absolute bed-entry offsets for the rolling timeline. Planned rows are an
 * annual template and may repeat; `existing` rows are observed one-off
 * cohorts and therefore have exactly one occurrence, even when it is already
 * finished. Anchoring at the recorded sow occurrence before adding the nursery
 * offset is essential across Dec/Jan (and at the far edge of the rolling
 * window): resolving the entry month independently can move it back a year. */
export function plantingBedEntryOffsets(
  planting: Pick<Planting, 'cropKey' | 'sowMonth' | 'existing'>,
  nowMonth: number,
  horizonMonths = 24,
): number[] {
  const crop = cropByKey(planting.cropKey);
  if (!crop || horizonMonths <= 0) return [];
  // The reservation edge, not the working transplant month: these offsets
  // start occupancy bars and the occupancy calendar, which must begin where
  // occupiedMonthsForPlanting begins or a bar painted one month late runs one
  // month past the true bed release.
  const nurseryOffset = crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0;
  const first = planting.existing
    ? existingSowOffset(planting.sowMonth, nowMonth) + nurseryOffset
    : ((planting.sowMonth - nowMonth) % 12 + 12) % 12 + nurseryOffset;
  if (planting.existing) return [first];
  const offsets: number[] = [];
  for (let offset = first; offset < horizonMonths; offset += 12) offsets.push(offset);
  return offsets;
}

/** Whether a saved row belongs in a forward-looking benchmark. A planned row
 * always does. An existing row only does while its single observed cohort can
 * still hold the bed; a stale, finished crop must not reappear next year as
 * either yield or conflict. Unknown timing stays visible because the app
 * cannot prove that ground is free. */
export function plantingIsActiveOrPlanned(
  planting: Pick<Planting, 'cropKey' | 'sowMonth' | 'existing'>,
  nowMonth: number,
): boolean {
  if (!planting.existing) return true;
  const crop = cropByKey(planting.cropKey);
  if (!crop || crop.timingVerified === false) return true;
  const span = occupiedMonthsForPlanting(planting).length;
  const [start] = plantingBedEntryOffsets(planting, nowMonth, 1);
  return span > 0 && start + span - 1 >= 0;
}

/** Rows that can honestly recur in an established annual view. Existing crops
 * are observations, not instructions to plant the same crop every year. */
export function recurringPlanPlantings(plantings: Planting[]): Planting[] {
  return plantings.filter((planting) => planting.existing !== true);
}

/** One overbooked bed, and the plantings actually implicated in its conflict.
 * Internal: the single authority both benchmarkAreaConflictBedLabels and
 * benchmarkAreaConflictDetails read, so the bed the headline names and the
 * crops the list under it names come from one pass over one definition of
 * "this ground does not add up". */
interface BedConflictRecord {
  bedId: string;
  bedLabel: string;
  /** Every planting that takes part in this bed's conflict. */
  plantingIds: Set<string>;
  /** Shares that are not a usable fraction of a bed. */
  invalidShareIds: Set<string>;
  /** Crops whose finish timing is unverified, so their months cannot be tested. */
  unverifiedTimingIds: Set<string>;
}

/** Beds whose saved planting shares cannot support a defensible yield or value
 * total. A manual plan may deliberately preserve an overbooked draft, but two
 * whole-bed crops standing in the same month cannot both receive a whole-bed
 * benchmark. The app must ask the farmer to resolve the layout rather than
 * guessing which crop loses area or yield. Invalid fractions are conflicts too:
 * they must not enter arithmetic as NaN, zero or negative land.
 *
 * A planting only joins a bed's record if it is part of WHY that bed is
 * flagged: a crop occupying a month where the shares exceed the bed, a crop
 * whose own share is unusable, or an unverified-timing crop whose unknown
 * months could push a verified month over. A crop that stands alone in its own
 * season on a flagged bed is not in the conflict and must not be listed as if
 * it were. */
function benchmarkAreaConflictBeds(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth?: number,
): BedConflictRecord[] {
  const bedById = new Map(beds.map((bed) => [bed.id, bed]));
  const records = new Map<string, BedConflictRecord>();
  const recordFor = (bedId: string): BedConflictRecord => {
    const existingRecord = records.get(bedId);
    if (existingRecord) return existingRecord;
    const created: BedConflictRecord = {
      bedId,
      bedLabel: bedById.get(bedId)?.label ?? bedId,
      plantingIds: new Set<string>(),
      invalidShareIds: new Set<string>(),
      unverifiedTimingIds: new Set<string>(),
    };
    records.set(bedId, created);
    return created;
  };

  // Rolling-horizon occupancy (offsets from nowMonth, repeating annual plan)
  // when a month is known; year-free calendar months when it is not. Both walks
  // now carry the CONTRIBUTING planting ids alongside the share total, which is
  // the only new information — the arithmetic and the conflict thresholds are
  // unchanged.
  type OccupiedRow = { id: string; bedId: string; start: number; span: number; fraction: number; existing: boolean };
  const rows: OccupiedRow[] = [];
  const calendarMonths = new Map<string, number[]>();
  const uncertain = new Map<string, { share: number; ids: string[] }>();

  for (const planting of plantings) {
    const bed = bedById.get(planting.bedId);
    if (!bed) continue;
    const fraction = planting.areaFraction ?? 1;
    // A share above a whole bed is only detectable as invalid where the
    // rolling walk runs; the year-free walk has always let it through into the
    // month totals instead. Keep each branch's own rule.
    const invalidShare = nowMonth !== undefined
      ? (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1.0001)
      : (!Number.isFinite(fraction) || fraction <= 0);
    if (invalidShare) {
      const record = recordFor(bed.id);
      record.plantingIds.add(planting.id);
      record.invalidShareIds.add(planting.id);
      continue;
    }
    const crop = cropByKey(planting.cropKey);
    if (crop?.timingVerified === false && hasPlanningYield(crop)) {
      const bucket = uncertain.get(bed.id) ?? { share: 0, ids: [] };
      bucket.share += fraction;
      bucket.ids.push(planting.id);
      uncertain.set(bed.id, bucket);
      continue;
    }
    if (nowMonth !== undefined) {
      const span = occupiedMonthsForPlanting(planting).length;
      // Planned cohorts can start up to twelve months ahead (plus nursery
      // lead time). A one-month horizon silently dropped every future crop,
      // so an unknown-timing whole-bed crop appeared not to overlap anything.
      const [start] = plantingBedEntryOffsets(planting, nowMonth, 24);
      if (!span || start === undefined) continue;
      const end = start + span - 1;
      if (planting.existing && end < 0) continue;
      rows.push({ id: planting.id, bedId: bed.id, start, span, fraction, existing: planting.existing === true });
    } else {
      const months = occupiedMonthsForPlanting(planting);
      if (!months.length) continue;
      rows.push({ id: planting.id, bedId: bed.id, start: 0, span: 0, fraction, existing: false });
      // The year-free walk indexes by calendar month; keep the months on the
      // row rather than recomputing them below.
      calendarMonths.set(planting.id, months);
    }
  }

  const occupancy = new Map<string, number[]>();
  const contributors = new Map<string, Set<string>[]>();

  if (nowMonth !== undefined) {
    const maxExistingEnd = rows
      .filter((row) => row.existing)
      .reduce((maximum, row) => Math.max(maximum, row.start + row.span - 1), 0);
    const horizon = Math.max(
      24,
      maxExistingEnd,
      ...rows.filter((row) => !row.existing).map((row) => row.start + row.span + 11),
    );
    for (const row of rows) {
      const starts = row.existing
        ? [row.start]
        : Array.from(
          { length: Math.max(0, Math.floor((horizon - row.start) / 12) + 1) },
          (_, index) => row.start + index * 12,
        );
      const totals = occupancy.get(row.bedId) ?? Array<number>(horizon + 1).fill(0);
      const who = contributors.get(row.bedId) ?? Array.from({ length: horizon + 1 }, () => new Set<string>());
      for (const start of starts) {
        for (let offset = Math.max(0, start); offset <= Math.min(horizon, start + row.span - 1); offset++) {
          totals[offset] += row.fraction;
          who[offset].add(row.id);
        }
      }
      occupancy.set(row.bedId, totals);
      contributors.set(row.bedId, who);
    }
  } else {
    for (const row of rows) {
      const totals = occupancy.get(row.bedId) ?? Array<number>(13).fill(0);
      const who = contributors.get(row.bedId) ?? Array.from({ length: 13 }, () => new Set<string>());
      for (const month of calendarMonths.get(row.id) ?? []) {
        totals[month] += row.fraction;
        who[month].add(row.id);
      }
      occupancy.set(row.bedId, totals);
      contributors.set(row.bedId, who);
    }
  }

  for (const [bedId, totals] of occupancy) {
    const who = contributors.get(bedId) ?? [];
    totals.forEach((share, index) => {
      if (share <= 1.0001) return;
      const record = recordFor(bedId);
      for (const id of who[index] ?? []) record.plantingIds.add(id);
    });
  }

  for (const [bedId, bucket] of uncertain) {
    if (!bedById.has(bedId)) continue;
    const totals = occupancy.get(bedId) ?? [];
    const who = contributors.get(bedId) ?? [];
    const crowdedIndexes = totals
      .map((share, index) => (share + bucket.share > 1.0001 ? index : -1))
      .filter((index) => index >= 0 && (nowMonth !== undefined || index > 0));
    if (bucket.share <= 1.0001 && crowdedIndexes.length === 0) continue;
    const record = recordFor(bedId);
    for (const id of bucket.ids) {
      record.plantingIds.add(id);
      record.unverifiedTimingIds.add(id);
    }
    for (const index of crowdedIndexes) {
      for (const id of who[index] ?? []) record.plantingIds.add(id);
    }
  }

  return [...records.values()].sort((a, b) => a.bedLabel.localeCompare(b.bedLabel) || a.bedId.localeCompare(b.bedId));
}

export function benchmarkAreaConflictBedLabels(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth?: number,
): string[] {
  return [...new Set(benchmarkAreaConflictBeds(plantings, beds, nowMonth).map((record) => record.bedLabel))]
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Is the offset-th month of this planting's life ALREADY OVER for an existing crop?
 *
 * The month aggregations below are keyed by year-free calendar month, restated modulo 12 —
 * which is correct for the repeating annual PLAN, but wrong for `existing` (farmer-confirmed,
 * already-growing) crops: an existing crop sown last March that finished harvesting in May
 * kept stamping calendar Mar-May as occupied FOREVER, so the utilization chart said 100% for
 * months in which the Gantt (which resolves existing crops to their real, possibly-past
 * offset and hides finished spans) correctly showed the beds empty. Same phantom put an
 * already-eaten harvest's kilograms into the forward-looking value chart.
 *
 * An existing crop's sow month means its most recent occurrence, never a future
 * sowing; every life-month whose resolved offset lands before today is history.
 * Planned/suggested plantings are never past — they haven't happened yet — and callers that
 * don't pass `nowMonth` keep the pure-cycle behaviour unchanged.
 */
function slotIsPast(
  planting: Pick<Planting, 'sowMonth' | 'existing'>,
  nowMonth: number | undefined,
  offsetFromSow: number,
): boolean {
  if (!nowMonth || planting.existing !== true) return false;
  return existingSowOffset(planting.sowMonth, nowMonth) + offsetFromSow < 0;
}

export interface CropTask {
  /** `${planting.id}:${action}` for one-off work; later harvest-window tasks
   * append `:${offset}`. Stable across recomputation for completion tracking
   * and calendar-event UIDs. */
  id: string;
  /** The owning planting without reverse-parsing `id`. Harvest-window ids end
   * in `:harvest:1`, so stripping `:${action}` from the end does not recover
   * the planting id. */
  plantingId: string;
  /** The planting cohort's recorded sow month. Together with
   * `cohortMonthOffset`, this keeps work on one chronological crop cycle when
   * its harvest crosses December or falls more than a year from today. Older
   * hand-built task objects may omit both and retain month-only behaviour. */
  cohortSowMonth?: number;
  /** Signed month offset from cohort sowing: direct-bed prep is -1, sowing is
   * 0, and later field/harvest work is positive. This is deliberately month
   * precision; it does not invent a day. */
  cohortMonthOffset?: number;
  /** Existing crops anchor to the most recent occurrence of their sow month;
   * planned crops anchor to the next occurrence. */
  cohortExisting?: boolean;
  /** Calendar month marker. Generated now-aware lists keep months in the
   * first twelve months as 1–12, and add 12 for a later occurrence so old
   * screen filters cannot mistake next year's same-named month for this one.
   * Use wrapMonth/taskMonthsFromNow for date arithmetic. */
  month: number;
  bedLabel: string;
  cropName: string;
  /** Lets task-string builders (app/facilitator/crops/page.tsx's taskSentence)
   *  look the crop back up via cropByKey — e.g. to append sowingInstruction's
   *  row/in-row spacing to a sow task — without re-deriving it from cropName. */
  cropKey: string;
  icon: string;
  action: 'prep' | 'sow' | 'transplant' | 'mulch' | 'harvest' | 'terminate-cover' | 'weed-early' | 'weed-mid';
  /** Only set on 'prep' tasks — the ground-prep instruction, which differs by the bed's
   *  kind (PlanBed.kind above): a worked BED gets the compost-and-rest wording, a
   *  field-scale staple PLOT gets the plough/manure wording, because a quarter-hectare
   *  of maize isn't prepped the way a 1.2x3m bed is. Undefined bed kind (i.e. a plain
   *  'bed', including every plan built before PlanBed.kind existed) reads as the bed
   *  wording. */
  prepText?: string;
}

function forwardMonthOffset(month: number, originMonth: number): number {
  return ((wrapMonth(month) - wrapMonth(originMonth)) % 12 + 12) % 12;
}

/** Concrete distance from the current month for one task in its own planting
 * cohort. Independent month resolution can put a next-September sowing's
 * next-November harvest in the *current* November; this cohort anchor makes
 * that harvest 12 months away instead. Planned prep whose ideal prior month
 * has already passed is due now rather than silently rolled eleven months
 * forward. A negative result is only possible for genuinely past work on an
 * already-growing crop. */
export function taskMonthsFromNow(task: CropTask, nowMonth: number): number {
  const hasCohort = Number.isInteger(task.cohortSowMonth)
    && Number.isInteger(task.cohortMonthOffset);
  if (!hasCohort) return forwardMonthOffset(task.month, nowMonth);
  return cohortMonthsFromNow({
    cohortSowMonth: task.cohortSowMonth!,
    cohortMonthOffset: task.cohortMonthOffset!,
    cohortExisting: task.cohortExisting,
  }, nowMonth);
}

function cohortMonthsFromNow(
  cohort: Required<Pick<CropTask, 'cohortSowMonth' | 'cohortMonthOffset'>>
    & Pick<CropTask, 'cohortExisting'>,
  nowMonth: number,
): number {
  const sowOffset = cohort.cohortExisting
    ? existingSowOffset(cohort.cohortSowMonth, nowMonth)
    : forwardMonthOffset(cohort.cohortSowMonth, nowMonth);
  const offset = sowOffset + cohort.cohortMonthOffset;
  return !cohort.cohortExisting && offset < 0 ? 0 : offset;
}

/** Keep the first twelve months as ordinary 1-12 month numbers for existing
 * screen consumers, but do not alias a later occurrence back onto "this
 * month". Values above 12 are timeline markers; wrapMonth recovers the named
 * calendar month for exports. */
function taskMonthMarker(
  calendarMonth: number,
  cohort: Pick<CropTask, 'cohortSowMonth' | 'cohortMonthOffset' | 'cohortExisting'>,
  nowMonth: number | undefined,
): number {
  if (nowMonth === undefined) return wrapMonth(calendarMonth);
  const monthsAway = cohortMonthsFromNow({
    cohortSowMonth: cohort.cohortSowMonth!,
    cohortMonthOffset: cohort.cohortMonthOffset!,
    cohortExisting: cohort.cohortExisting,
  }, nowMonth);
  const namedMonth = wrapMonth(nowMonth + Math.max(0, monthsAway));
  return monthsAway >= 12 ? namedMonth + 12 * Math.floor(monthsAway / 12) : namedMonth;
}

/** Build operational work for a plan. Pass nowMonth for a forward-looking task
 * list: existing plantings are one real crop cycle, so completed harvest or
 * termination months are removed. Omit it only for an undated annual-cycle
 * analysis where all month positions intentionally remain present. */
export function tasksForPlan(plantings: Planting[], beds: PlanBed[], nowMonth?: number): CropTask[] {
  const bedLabel = (bedId: string): string =>
    beds.find((b) => b.id === bedId)?.label ?? 'Unknown bed';
  const bedKind = (bedId: string): PlanBed['kind'] =>
    beds.find((b) => b.id === bedId)?.kind;

  const tasks: CropTask[] = [];

  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    if (!crop) continue;
    // Preserve legacy crop records, but never turn an unverified duration into
    // exact prep/weed/termination dates. A verified zero-food cover is allowed:
    // it receives a termination task instead of a fabricated food harvest.
    if (crop.timingVerified === false) continue;
    const label = bedLabel(p.bedId);
    const cohortBase = {
      cohortSowMonth: p.sowMonth,
      cohortExisting: p.existing === true,
    } as const;
    const monthFor = (calendarMonth: number, cohortMonthOffset: number): number =>
      taskMonthMarker(calendarMonth, { ...cohortBase, cohortMonthOffset }, nowMonth);

    // Already-growing crops were sown before the farmer started using the
    // app — bed prep, sowing and the first mulch are already done. Only a
    // genuinely still-ahead harvest or cover termination belongs on the task
    // list; the nowMonth-aware checks below remove work already completed by
    // time itself.
    if (!p.existing) {
      // Preparation is deliberately an assessment, not a universal input
      // prescription. Soil condition, drainage, prior fertility and the crop
      // determine whether cultivation or amendments are needed; telling every
      // farmer to plough and add manure can damage structure or over-fertilise.
      tasks.push({
        id: `${p.id}:prep`,
        plantingId: p.id,
        ...cohortBase,
        cohortMonthOffset: crop.transplant ? 0 : -1,
        month: monthFor(
          crop.transplant ? p.sowMonth : p.sowMonth - 1,
          crop.transplant ? 0 : -1,
        ),
        bedLabel: label,
        cropName: crop.name,
        cropKey: crop.key,
        icon: crop.icon,
        action: 'prep',
        prepText: bedKind(p.bedId) === 'plot'
          ? 'assess soil and drainage; use a soil test or local advice before cultivating or adding amendments'
          : 'assess soil and drainage; use a soil test or local advice before adding amendments',
      });

      tasks.push({
        id: `${p.id}:sow`,
        plantingId: p.id,
        ...cohortBase,
        cohortMonthOffset: 0,
        month: monthFor(p.sowMonth, 0),
        bedLabel: label,
        cropName: crop.name,
        cropKey: crop.key,
        icon: crop.icon,
        action: 'sow',
      });

      if (crop.transplant) {
        tasks.push({
          id: `${p.id}:transplant`,
          plantingId: p.id,
          ...cohortBase,
          cohortMonthOffset: TRANSPLANT_ENTRY_EARLIEST_MONTHS,
          month: monthFor(
            bedEntryMonth(p.sowMonth, crop),
            TRANSPLANT_ENTRY_EARLIEST_MONTHS,
          ),
          bedLabel: label,
          cropName: crop.name,
          cropKey: crop.key,
          icon: crop.icon,
          action: 'transplant',
        });
      }

      // Mulching and weeding remain field observations, not dated generic
      // tasks. Soil cover, weed pressure, crop stage and local practice decide
      // whether and when they are appropriate; the catalog has no authority
      // for a blanket schedule.
    }

    const firstHarvest = harvestMonthForCrop(p.sowMonth, crop);
    const maturityOffset = planningMaturityMonths(crop.daysToHarvest)
      + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);

    // A zero-food cover reaches flowering so it can be cut or rolled down; it
    // is not carried to the kitchen. Calling this a harvest made the field
    // sheet tell a farmer to record kilograms for material that stays in the
    // field as green manure. The catalog invariant permits zero food yield only
    // for declared cover crops, so this branch owns that semantic distinction.
    if (crop.yieldKgPerM2 === 0) {
      if (!slotIsPast(p, nowMonth, maturityOffset)) {
        tasks.push({
          id: `${p.id}:terminate-cover`,
          plantingId: p.id,
          ...cohortBase,
          cohortMonthOffset: maturityOffset,
          month: monthFor(firstHarvest, maturityOffset),
          bedLabel: label,
          cropName: crop.name,
          cropKey: crop.key,
          icon: crop.icon,
          action: 'terminate-cover',
        });
      }
      continue;
    }

    for (let offset = 0; offset <= (crop.harvestWindowMonths ?? 0); offset++) {
      // Existing means the farmer confirmed this crop was sown on the most
      // recent occurrence of its month. Once one of its picking months is over,
      // it is history — do not roll the bare month number forward and tell them
      // to harvest the same planting again next year. Omitting nowMonth retains
      // the pure repeating-cycle view used by plan-level analysis.
      if (slotIsPast(p, nowMonth, maturityOffset + offset)) continue;
      tasks.push({
        id: offset === 0 ? `${p.id}:harvest` : `${p.id}:harvest:${offset}`,
        plantingId: p.id,
        ...cohortBase,
        cohortMonthOffset: maturityOffset + offset,
        month: monthFor(firstHarvest + offset, maturityOffset + offset),
        bedLabel: label,
        cropName: crop.name,
        cropKey: crop.key,
        icon: crop.icon,
        action: 'harvest',
      });
    }
  }

  return tasks.sort((a, b) => {
    if (nowMonth !== undefined) {
      const byTimeline = taskMonthsFromNow(a, nowMonth) - taskMonthsFromNow(b, nowMonth);
      if (byTimeline) return byTimeline;
    }
    return a.month - b.month || a.bedLabel.localeCompare(b.bedLabel);
  });
}

export function estimatedYieldKg(p: Planting, bedAreaM2: number): number {
  const crop = cropByKey(p.cropKey);
  if (!crop) return 0;
  return (crop.yieldKgPerM2 ?? 0) * bedAreaM2 * (p.areaFraction ?? 1);
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
  const pMonths = new Set(occupiedMonthsForPlanting(p));
  return allPlantings.some((other) => {
    if (other.id === p.id || other.bedId !== p.bedId || other.cropKey === p.cropKey) return false;
    return occupiedMonthsForPlanting(other).some((month) => pMonths.has(month));
  });
}

/**
 * Yield is already scaled to each crop's allocated share. No universal
 * intercropping multiplier is applied: without pair, layout and management
 * evidence, any fixed bonus or penalty would be invented precision.
 */
export function estimatedYieldKgAdjusted(p: Planting, bedAreaM2: number, allPlantings: Planting[]): number {
  void allPlantings;
  return estimatedYieldKg(p, bedAreaM2);
}

/**
 * Per-crop breakdown of estimatedYieldKgAdjusted, aggregated across every
 * planting on every bed — same source set as a per-bed breakdown built with
 * `plantings.filter(p => p.bedId === b.id)` over all beds, just grouped by
 * cropKey instead of bedId. Deliberately does NOT exclude `existing`
 * plantings (per-bed totals don't either) so the two are two views of the
 * SAME annual total, not different subsets. Sorted biggest-first: that's
 * the useful reading order for "what am I actually growing most of".
 */
export function yieldByCrop(plantings: Planting[], beds: PlanBed[]): { cropKey: string; name: string; icon: string; kg: number }[] {
  const bedArea = new Map(beds.map((b) => [b.id, b.areaM2]));
  const totals = new Map<string, number>();
  for (const p of plantings) {
    const area = bedArea.get(p.bedId);
    if (area === undefined) continue;
    const kg = estimatedYieldKgAdjusted(p, area, plantings);
    totals.set(p.cropKey, (totals.get(p.cropKey) ?? 0) + kg);
  }
  return Array.from(totals.entries())
    .map(([cropKey, kg]) => {
      const crop = cropByKey(cropKey);
      return { cropKey, name: crop?.name ?? cropKey, icon: crop?.icon ?? '🌱', kg };
    })
    .filter((row) => row.kg > 0)
    .sort((a, b) => b.kg - a.kg);
}

/**
 * Crop names that cannot honestly participate in a kg comparison. Keep this
 * question in one place so the screen narrative, dashboard and PDF cannot
 * silently disagree about which crops a displayed total leaves out.
 *
 * A catalog value of zero is different: it marks a non-food cover crop. Only
 * `null` means the food crop has no verified kg/m² benchmark yet.
 */
export function unverifiedYieldCropNames(plantings: Planting[]): string[] {
  const names = new Set<string>();
  for (const planting of plantings) {
    const crop = cropByKey(planting.cropKey);
    if (crop?.yieldKgPerM2 === null) names.add(crop.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Crops intentionally recorded as zero FOOD yield because their role is soil
 * cover. This is not the same state as a food crop whose benchmark is null. */
export function nonFoodCropNames(plantings: Planting[]): string[] {
  const names = new Set<string>();
  for (const planting of plantings) {
    const crop = cropByKey(planting.cropKey);
    if (crop?.yieldKgPerM2 === 0) names.add(crop.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export interface PlanYieldBenchmark {
  /** Sum of the conservative crop-cycle benchmarks for mapped plantings whose
   * catalog entries have a verified positive kg/m² value. This is deliberately
   * not assigned to calendar months: the source gives a crop-cycle yield, not
   * a within-window picking curve. */
  /** Null when saved bed shares overlap or are invalid. Guessing which crop
   * loses land would turn a draft layout into a false total. */
  knownKg: number | null;
  byCrop: ReturnType<typeof yieldByCrop>;
  /** Food crops omitted from `knownKg`; absence of a benchmark is not 0 kg. */
  unknownYieldCrops: string[];
  /** Soil covers that correctly contribute 0 food kg. */
  nonFoodCrops: string[];
  /** Resolve these bed layouts before any kg or Rand subtotal is shown. */
  areaConflictBedLabels: string[];
}

/**
 * The one numeric yield summary production views may use. KZN DARD publishes
 * crop-cycle benchmark yields and fresh-picking windows independently; it does
 * not say that a crop's yield arrives evenly across that window. Keeping the
 * total here, with no monthly buckets, prevents a crop-cycle figure from being
 * turned into invented monthly kg or Rand.
 */
export function buildPlanYieldBenchmark(plantings: Planting[], beds: PlanBed[], nowMonth?: number): PlanYieldBenchmark {
  const bedIds = new Set(beds.map((bed) => bed.id));
  const mapped = plantings.filter((planting) =>
    bedIds.has(planting.bedId)
      && (nowMonth === undefined || plantingIsActiveOrPlanned(planting, nowMonth)));
  const areaConflictBedLabels = benchmarkAreaConflictBedLabels(mapped, beds, nowMonth);
  const byCrop = yieldByCrop(mapped, beds);
  return {
    knownKg: areaConflictBedLabels.length
      ? null
      : byCrop.reduce((sum, crop) => sum + crop.kg, 0),
    // Keep the conflict structurally unable to leak into a value subtotal.
    byCrop: areaConflictBedLabels.length ? [] : byCrop,
    unknownYieldCrops: unverifiedYieldCropNames(mapped),
    nonFoodCrops: nonFoodCropNames(mapped),
    areaConflictBedLabels,
  };
}

/** Why one planting is part of a bed's conflict. The screen must be able to
 * say the true thing about each row: a crop sharing months with another is a
 * different problem from a crop whose recorded share is unreadable, or one
 * whose finish timing the app refuses to reason about. */
export type BedAreaConflictReason = 'overlap' | 'invalid-share' | 'unverified-timing';

/** One overbooked bed, with the plantings the farmer has to choose between. */
export interface BedAreaConflict {
  bedId: string;
  bedLabel: string;
  plantings: {
    plantingId: string;
    cropKey: string;
    cropName: string;
    /** Months this planting holds the bed (1-12), entry month first. */
    months: number[];
    areaFraction: number;
    reason: BedAreaConflictReason;
  }[];
}

/**
 * The plantings behind each label benchmarkAreaConflictBedLabels returns, so a
 * screen can say WHICH crops are standing on the same ground instead of only
 * naming the bed. Both read the same benchmarkAreaConflictBeds pass over the
 * same filtered planting set buildPlanYieldBenchmark uses, so the headline
 * warning and the list under it can never disagree — and, since that pass
 * records only the plantings that actually take part in each bed's conflict, a
 * crop growing alone in its own season on a flagged bed is NOT listed as
 * though it were double-booked.
 *
 * Beds are matched by id, never by label: two beds may carry the same label,
 * and only the one that is actually overbooked belongs in this list.
 */
export function benchmarkAreaConflictDetails(
  plantings: Planting[], beds: PlanBed[], nowMonth?: number,
): BedAreaConflict[] {
  const bedIds = new Set(beds.map((bed) => bed.id));
  const mapped = plantings.filter((planting) =>
    bedIds.has(planting.bedId)
      && (nowMonth === undefined || plantingIsActiveOrPlanned(planting, nowMonth)));
  const byId = new Map(mapped.map((planting) => [planting.id, planting]));
  return benchmarkAreaConflictBeds(mapped, beds, nowMonth)
    .map((record) => ({
      bedId: record.bedId,
      bedLabel: record.bedLabel,
      plantings: [...record.plantingIds]
        .map((id) => byId.get(id))
        .filter((planting): planting is Planting => planting !== undefined)
        .map((planting) => ({
          plantingId: planting.id,
          cropKey: planting.cropKey,
          cropName: cropByKey(planting.cropKey)?.name ?? planting.cropKey,
          months: occupiedMonthsForPlanting(planting),
          areaFraction: planting.areaFraction ?? 1,
          reason: record.invalidShareIds.has(planting.id)
            ? 'invalid-share' as const
            : record.unverifiedTimingIds.has(planting.id)
              ? 'unverified-timing' as const
              : 'overlap' as const,
        }))
        .sort((a, b) => (a.months[0] ?? 0) - (b.months[0] ?? 0) || a.cropName.localeCompare(b.cropName)),
    }))
    .filter((conflict) => conflict.plantings.length > 0);
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
  if (isSampleMode()) return getSandboxAllowBedSharing();
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(
      activeAccountLocalStorageKey(ALLOW_BED_SHARING_KEY),
    ) === '1';
  } catch {
    return false;
  }
}

export function saveAllowBedSharing(allow: boolean): void {
  if (isSampleMode()) { setSandboxAllowBedSharing(allow); return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(ALLOW_BED_SHARING_KEY),
      allow ? '1' : '0',
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

/**
 * Space-hungry crops (vigorous vines, block-planted grains) don't share a
 * bed well — recommend a dedicated area instead of splitting/intercropping.
 * This is an explicit growth-habit list, not a numeric spacing threshold: row
 * spacing does not by itself prove how far a vine will roam beyond the bed.
 */
const SPRAWLING_VINE_KEYS = new Set(['butternut', 'pumpkin', 'watermelon']);

export function isSpaceHungry(crop: CropDef): boolean {
  return SPRAWLING_VINE_KEYS.has(crop.key);
}

/**
 * How much of a bed is already committed to OTHER plantings whose sow→harvest
 * window overlaps the given one — used to warn (not block) before splitting
 * a bed past 100%. `excludeId` skips the planting being edited, if any.
 */
function monthRangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
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
}

/** Calendar months (1-12) from `start` to `end` inclusive, wrapping through
 * December. Caps at twelve distinct months: a longer span holds every month
 * of the year, and repeating them would not tell a farmer anything more. */
function monthsBetween(start: number, end: number): number[] {
  const last = wrapMonth(end);
  const months: number[] = [];
  let month = wrapMonth(start);
  for (let step = 0; step < 12; step++) {
    months.push(month);
    if (month === last) break;
    month = wrapMonth(month + 1);
  }
  return months;
}

/**
 * Every OTHER planting on this bed whose sow→harvest window meets the given
 * one. Single source of truth for the crop picker's "is this ground already
 * taken" question: the number in bedOverlapFraction and the crop names in the
 * warning sentence come from the same pass, so they cannot drift apart.
 */
function overlappingBedPlantings(
  bedId: string, sowMonth: number, harvestEndMonth: number, plantings: Planting[], excludeId?: string,
): { planting: Planting; crop: CropDef }[] {
  return plantings
    .filter((p) => p.bedId === bedId && p.id !== excludeId)
    .flatMap((planting) => {
      const crop = cropByKey(planting.cropKey);
      if (!crop || crop.timingVerified === false) return [];
      const pStart = plannedBedEntryMonth(planting.sowMonth, crop);
      const pHarvestEnd = harvestEndMonthForCrop(planting.sowMonth, crop);
      return monthRangesOverlap(sowMonth, harvestEndMonth, pStart, pHarvestEnd)
        ? [{ planting, crop }]
        : [];
    });
}

export function bedOverlapFraction(
  bedId: string, sowMonth: number, harvestEndMonth: number, plantings: Planting[], excludeId?: string,
): number {
  return overlappingBedPlantings(bedId, sowMonth, harvestEndMonth, plantings, excludeId)
    .reduce((sum, { planting }) => sum + (planting.areaFraction ?? 1), 0);
}

/** What to tell the farmer before a planting is added onto ground another crop
 * is already holding. */
export interface BedOverlapWarning {
  /** Share of the bed the other overlapping crops already hold. */
  committedFraction: number;
  /** That share plus the one about to be added. */
  totalFraction: number;
  /** The crops already in the way, named, alphabetical for a stable sentence. */
  cropNames: string[];
  /**
   * One entry per crop already in the way, with the months THAT crop shares
   * with the new one — never a union across crops. A union reads as a single
   * span and can be wider than any real clash ("Cabbage and Dry beans in
   * Nov–Feb" when cabbage only clashes in Nov and beans only in Feb), which is
   * a sentence the farmer cannot check against the chart above it.
   */
  clashes: { cropName: string; months: number[] }[];
}

/**
 * The overlap warning for a planting about to be added or edited — for ANY
 * share of the bed, whole or fractional. `addedFraction` is what the farmer is
 * about to commit (1 for a whole bed). Returns null when the bed can carry it.
 *
 * This is a warning, never a block: a farmer may know something the mapped
 * areas do not, and the app has always let them record it.
 */
export function bedOverlapWarning(
  bedId: string,
  sowMonth: number,
  harvestEndMonth: number,
  addedFraction: number,
  plantings: Planting[],
  excludeId?: string,
): BedOverlapWarning | null {
  const others = overlappingBedPlantings(bedId, sowMonth, harvestEndMonth, plantings, excludeId);
  const committedFraction = others.reduce((sum, { planting }) => sum + (planting.areaFraction ?? 1), 0);
  const totalFraction = committedFraction + addedFraction;
  if (!(totalFraction > 1.001) || others.length === 0) return null;

  const newMonths = monthsBetween(sowMonth, harvestEndMonth);
  // Per crop, not pooled: the months named beside a crop's name are that
  // crop's own clash with the new planting. Succession batches of the same
  // crop merge under one name, and a broken set stays broken rather than
  // being smoothed into a range (see monthSpanLabel at the render site).
  const monthsByCrop = new Map<string, Set<number>>();
  for (const { planting, crop } of others) {
    const occupied = new Set(occupiedMonthsForPlanting(planting));
    const shared = newMonths.filter((month) => occupied.has(month));
    const bucket = monthsByCrop.get(crop.name) ?? new Set<number>();
    for (const month of shared) bucket.add(month);
    monthsByCrop.set(crop.name, bucket);
  }
  const cropNames = [...monthsByCrop.keys()].sort((a, b) => a.localeCompare(b));
  return {
    committedFraction,
    totalFraction,
    cropNames,
    // A crop whose bed-reservation edge overlaps but whose occupied months do
    // not line up gets an empty month list rather than an invented month.
    clashes: cropNames.map((cropName) => ({
      cropName,
      months: newMonths.filter((month) => monthsByCrop.get(cropName)!.has(month)),
    })),
  };
}

/** Whether the numeric overlap excludes a legacy record whose finish timing
 * cannot be derived. Callers must surface this instead of presenting the
 * returned fraction as a complete occupancy answer. */
export function bedHasUnverifiedTiming(
  bedId: string,
  plantings: Planting[],
  excludeId?: string,
): boolean {
  return plantings.some((planting) =>
    planting.bedId === bedId
    && planting.id !== excludeId
    && cropByKey(planting.cropKey)?.timingVerified === false);
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
  const candidates = CROPS.filter((c) => c.key !== current.key && hasPlanningYield(c) && foodGroupOf(c) === group);
  if (!candidates.length) return null;
  const fresh = candidates.filter((c) => !usedKeys.has(c.key));
  const pool = fresh.length ? fresh : candidates;
  return [...pool].sort((a, b) => {
    const aYield = hasPlanningYield(a) ? a.yieldKgPerM2 : -1;
    const bYield = hasPlanningYield(b) ? b.yieldKgPerM2 : -1;
    return bYield - aYield;
  })[0];
}

export function nextValidSowMonth(crop: CropDef, pattern: RainPattern, fromMonth: number): number {
  const months = crop.sowMonths[pattern];
  if (!months || months.length === 0) return wrapMonth(fromMonth);
  const sorted = [...months].sort((a, b) => a - b);
  const found = sorted.find((m) => m >= fromMonth);
  return found !== undefined ? found : sorted[0];
}

/**
 * Planting-material bill of quantities. Field spacing can support an
 * approximate FINAL stand count, and living material bought by the piece can
 * use that count. It cannot, by itself, support an exact botanical-seed buying
 * quantity: direct-seeding rates vary by crop, seed lot, germination, sowing
 * method and the amount later thinned out.
 *
 * KZN DARD's 10-15% statement is in the OPEN SEEDBED section of Plant
 * Establishment, immediately after seedbed rates. It does not establish a
 * universal direct-field allowance, and Table 5 instead publishes
 * crop-specific direct-seeding rates. Applying 15% to every final stand
 * materially under-bought crops such as lettuce and Swiss chard. Botanical
 * seed therefore carries `count: null` until a crop-specific, primary-source
 * seeding-rate model is added. Living material also carries `count: null`
 * where both spacing axes are not verified; internal layout estimates must
 * not become a farmer-facing order.
 * Source: https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_establishment.pdf
 */
export interface SeedBoqRow {
  cropKey: string;
  cropName: string;
  icon: string;
  unit: string;
  /** Pieces to buy only when the material and both spacing axes are verified. */
  count: number | null;
  /** Sourced-spacing piece range when the authority gives ranges rather than
   * one exact row layout. Null for packet seed and unverified layouts. */
  countRange: readonly [number, number] | null;
  /** Why count is numeric or deliberately withheld. */
  quantityStatus: 'counted-pieces' | 'counted-piece-range' | 'packet-rate-required' | 'spacing-confirmation-required';
  /** Representative midpoint estimate retained for sorting/backwards-compatible
   * arithmetic; farmer-facing copy must prefer finalPlantPositionsRange. */
  finalPlantPositions: number;
  /** Approximate mature-position range from mapped area and published spacing bounds. */
  finalPlantPositionsRange: readonly [number, number];
}

export interface SeedBoqBatch extends SeedBoqRow {
  /** One independently timed purchase/sowing cohort. */
  sowMonth: number;
  bedIds: string[];
}

// A few catalog crops aren't grown from botanical seed at all — their own
// catalog `note` says so (sweet potato: "rooted slips, not seed"; potato:
// "certified seed potatoes"). Calling the BOQ row "seeds" for these is a
// real, farmer-facing wrong-material mistake; unlike botanical direct seed,
// these pieces can be counted against final planting positions.
const PROPAGATION_UNIT: Record<string, string> = {
  'sweet-potato': 'slips',
  potato: 'seed potatoes',
  garlic: 'cloves',
  // KZN DARD Plant Establishment names Madumbe (corms); DAFF's Amadumbe
  // brochure says propagation is from whole tubers or corm cuttings.
  amadumbe: 'corms',
};

/**
 * Canonical cohort-level calculation shared by the screen total and buying
 * schedule. Splits of the same crop sown in the same month aggregate before
 * rounding; genuinely separate succession months remain separate purchases.
 */
export function seedBoqBatchesForPlan(plantings: Planting[], beds: PlanBed[]): SeedBoqBatch[] {
  const rawByBatch = new Map<string, {
    cropKey: string;
    sowMonth: number;
    rawCount: number;
    rawMinimum: number;
    rawMaximum: number;
    bedIds: Set<string>;
  }>();
  for (const p of plantings) {
    if (p.existing) continue;
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    // A planting-material list is a new purchase instruction. Do not turn a
    // legacy crop with unverified timing into a fresh order.
    if (crop.timingVerified === false) continue;
    // Field-rate covers are established in kg/ha, not by a grid of final plant
    // positions. The current BOQ model only knows pieces or packet guidance;
    // keep the sourced kg/ha rate in the sowing task rather than converting the
    // legacy 6cm placeholder into a fictitious seed count or shopping line.
    if (crop.seedRateKgPerHaRange !== undefined) continue;
    const areaM2 = bed.areaM2 * (p.areaFraction ?? 1);
    // plantsPerM2 is the ONLY place a final-stand density is decided — the same
    // helper sowingInstruction prints from, so the position estimate and the
    // spacing on the page can never disagree again (see crop-catalog.ts).
    const rawCount = areaM2 * plantsPerM2(crop);
    const [minimumDensity, maximumDensity] = plantsPerM2Range(crop);
    const sowMonth = wrapMonth(p.sowMonth);
    const key = `${crop.key}::${sowMonth}`;
    const batch = rawByBatch.get(key) ?? {
      cropKey: crop.key,
      sowMonth,
      rawCount: 0,
      rawMinimum: 0,
      rawMaximum: 0,
      bedIds: new Set<string>(),
    };
    batch.rawCount += rawCount;
    batch.rawMinimum += areaM2 * minimumDensity;
    batch.rawMaximum += areaM2 * maximumDensity;
    batch.bedIds.add(bed.id);
    rawByBatch.set(key, batch);
  }
  return [...rawByBatch.values()]
    .map(({ cropKey, sowMonth, rawCount, rawMinimum, rawMaximum, bedIds }) => {
      const crop = cropByKey(cropKey)!;
      const unit = PROPAGATION_UNIT[cropKey] ?? (crop.transplant ? 'seedlings' : 'seeds');
      const finalPlantPositions = Math.max(1, Math.round(rawCount));
      const minimumPositions = Math.max(1, Math.floor(rawMinimum));
      const maximumPositions = Math.max(minimumPositions, Math.ceil(rawMaximum));
      const finalPlantPositionsRange = [minimumPositions, maximumPositions] as const;
      const spacingIsRange = minimumPositions !== maximumPositions;
      const quantityStatus: SeedBoqRow['quantityStatus'] = crop.fieldSpacingVerified === false
        ? 'spacing-confirmation-required'
        : unit === 'seeds'
          ? 'packet-rate-required'
          : spacingIsRange
            ? 'counted-piece-range'
            : 'counted-pieces';
      return {
        cropKey,
        cropName: crop.name,
        icon: crop.icon,
        unit,
        count: quantityStatus === 'counted-pieces' ? finalPlantPositions : null,
        countRange: quantityStatus === 'counted-piece-range' ? finalPlantPositionsRange : null,
        quantityStatus,
        finalPlantPositions,
        finalPlantPositionsRange,
        sowMonth,
        bedIds: [...bedIds],
      };
    })
    .sort((a, b) => a.sowMonth - b.sowMonth || a.cropName.localeCompare(b.cropName));
}

export function seedBoqForPlan(plantings: Planting[], beds: PlanBed[]): SeedBoqRow[] {
  const byCrop = new Map<string, SeedBoqRow>();
  for (const batch of seedBoqBatchesForPlan(plantings, beds)) {
    const existing = byCrop.get(batch.cropKey);
    if (existing) {
      existing.finalPlantPositions += batch.finalPlantPositions;
      existing.finalPlantPositionsRange = [
        existing.finalPlantPositionsRange[0] + batch.finalPlantPositionsRange[0],
        existing.finalPlantPositionsRange[1] + batch.finalPlantPositionsRange[1],
      ];
      if (existing.count !== null && batch.count !== null) existing.count += batch.count;
      else existing.count = null;
      if (existing.countRange !== null && batch.countRange !== null) {
        existing.countRange = [
          existing.countRange[0] + batch.countRange[0],
          existing.countRange[1] + batch.countRange[1],
        ];
      } else {
        existing.countRange = null;
      }
      continue;
    }
    byCrop.set(batch.cropKey, {
      cropKey: batch.cropKey,
      cropName: batch.cropName,
      icon: batch.icon,
      unit: batch.unit,
      count: batch.count,
      countRange: batch.countRange,
      quantityStatus: batch.quantityStatus,
      finalPlantPositions: batch.finalPlantPositions,
      finalPlantPositionsRange: batch.finalPlantPositionsRange,
    });
  }
  return [...byCrop.values()].sort((a, b) =>
    b.finalPlantPositions - a.finalPlantPositions || a.cropName.localeCompare(b.cropName));
}

/**
 * A short, deterministic (no LLM — same rules-engine philosophy as
 * lib/crop-autosuggest.ts: instant, offline, and every line is directly
 * traceable to the plan's own numbers) year-ahead narrative: known benchmark
 * crop-cycle comparison, fresh-availability gaps, and the biggest benchmarked
 * crop. It never allocates a crop-cycle yield to months: a picking window says
 * when a crop may be fresh, not how many kilograms arrive in each month.
 * Works for ANY plan (auto-suggested or hand-built) since it only reads the
 * plantings themselves, not the auto-suggest questionnaire answers.
 */
export function buildYearReport(plantings: Planting[], beds: PlanBed[]): string[] {
  const bedIds = new Set(beds.map((bed) => bed.id));
  const toPlant = plantings.filter((p) => !p.existing && bedIds.has(p.bedId) && cropByKey(p.cropKey));
  if (!toPlant.length) return [];
  const unknownYieldCrops = unverifiedYieldCropNames(toPlant);
  const nonFoodCrops = nonFoodCropNames(toPlant);

  const benchmark = buildPlanYieldBenchmark(toPlant, beds);
  const totalKg = benchmark.knownKg;
  if (totalKg === null) {
    return [
      `No kilogram or value total is shown because ${benchmark.areaConflictBedLabels.join(', ')} ${benchmark.areaConflictBedLabels.length === 1 ? 'has' : 'have'} overlapping or invalid planting shares. Resolve the bed layout instead of guessing which crop loses space.`,
    ];
  }
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const freshAvailability = buildFoodAvailability(toPlant, beds);
  const freshMonths = months.filter((month) =>
    freshAvailability[month].some((item) => item.status === 'fresh'));
  if (totalKg <= 0) {
    const reasons: string[] = [];
    if (unknownYieldCrops.length) {
      reasons.push(`${unknownYieldCrops.join(', ')} ${unknownYieldCrops.length === 1 ? 'has' : 'have'} no verified kg/m² benchmark, so treating ${unknownYieldCrops.length === 1 ? 'it' : 'them'} as 0kg would be false`);
    }
    if (nonFoodCrops.length) {
      reasons.push(`${nonFoodCrops.join(', ')} ${nonFoodCrops.length === 1 ? 'is a soil-cover crop' : 'are soil-cover crops'} recorded as 0 food kg, not as a failed harvest`);
    }
    return reasons.length
      ? [`No kilogram food-yield total is shown for this plan. ${reasons.join('; ')}.`]
      : [];
  }
  const quietMonths = months.filter((month) => !freshMonths.includes(month));

  const paragraphs: string[] = [];
  paragraphs.push(
    `For crops with a verified kg/m² benchmark, the crop cycles shown in this plan total about ${totalKg.toFixed(0)}kg in the conservative commercial comparison. `
    + 'No monthly kilogram split is shown because the benchmark source does not say how yield is distributed within each fresh-picking window. This is not a household or farm-yield guarantee.',
  );

  if (unknownYieldCrops.length) {
    paragraphs.push(`${unknownYieldCrops.join(', ')} ${unknownYieldCrops.length === 1 ? 'has' : 'have'} no verified kg/m² benchmark and ${unknownYieldCrops.length === 1 ? 'is' : 'are'} excluded from every kilogram total; ${unknownYieldCrops.length === 1 ? 'it is' : 'they are'} not being counted as 0kg.`);
  }

  if (nonFoodCrops.length) {
    paragraphs.push(`${nonFoodCrops.join(', ')} ${nonFoodCrops.length === 1 ? 'is a soil-cover crop' : 'are soil-cover crops'} and ${nonFoodCrops.length === 1 ? 'is' : 'are'} excluded from the food-yield total as 0 food kg, not counted as a failed harvest.`);
  }

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
    paragraphs.push(
      `No verified fresh-picking window is scheduled around ${label}. Nothing is due for picking then — that is a timing gap, not a crop failure.`
      + (unknownYieldCrops.length ? ' Crops with unavailable yield benchmarks may still be harvested in that period.' : ''),
    );
  }

  const topCrop = benchmark.byCrop[0];
  if (topCrop && topCrop.kg > 0) {
    paragraphs.push(`Within the benchmark comparison, ${topCrop.name} is the biggest crop-cycle total at ~${topCrop.kg.toFixed(0)}kg. Confirm the actual harvest and household demand before treating any amount as surplus to sell or preserve.`);
  }

  // Multiple DISTINCT sow months on one bed are worth surfacing, but month-
  // resolution cannot prove that cohorts are only a few weeks apart or that
  // harvest will be continuous. Duplicate rows in one month are not a
  // succession at all.
  const cohortMonths = new Map<string, { bedId: string; cropKey: string; months: Set<number> }>();
  for (const p of toPlant) {
    const key = `${p.bedId}\u0000${p.cropKey}`;
    const entry = cohortMonths.get(key) ?? {
      bedId: p.bedId,
      cropKey: p.cropKey,
      months: new Set<number>(),
    };
    entry.months.add(p.sowMonth);
    cohortMonths.set(key, entry);
  }
  const multiMonthCohorts = [...cohortMonths.values()].filter((entry) => entry.months.size >= 2);
  const staggeredExample = multiMonthCohorts[0];
  // Count BEDS, not bed+crop pairings. One bed with several multi-month crop
  // patterns is still one bed.
  const staggeredBeds = new Set(multiMonthCohorts.map((entry) => entry.bedId));
  if (staggeredExample) {
    const crop = cropByKey(staggeredExample.cropKey);
    if (crop) {
      const otherBeds = [...staggeredBeds].filter((bedId) => bedId !== staggeredExample.bedId).length;
      const others = otherBeds > 0
        ? `; ${otherBeds} other bed${otherBeds > 1 ? 's also have' : ' also has'} crops in multiple sowing months`
        : '';
      const bedLabel = beds.find((bed) => bed.id === staggeredExample.bedId)?.label ?? 'one bed';
      paragraphs.push(`${crop.name} appears in ${staggeredExample.months.size} different sowing months on ${bedLabel}${others}. This is a month-level timing pattern, not a guarantee of uninterrupted harvest.`);
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
 * What is freshly harvestable in each month, plus storage only where the
 * catalog has a sourced duration and named conditions. A bare shelf-life
 * constant is not enough: cultivar, curing, moisture, pests and container
 * change whether food remains usable.
 *
 * Includes existing (already-growing) plantings, not just new ones — this
 * This is an availability guide, not a food-security or sufficiency claim.
 * 1-indexed like kgByMonth above ([0] unused, months are 1-12).
 */
export function buildFoodAvailability(plantings: Planting[], beds: PlanBed[], nowMonth?: number): FoodAvailabilityItem[][] {
  const byMonth: Map<string, FoodAvailabilityStatus>[] = Array.from({ length: 13 }, () => new Map());
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    // Soil covers are not food, and an unverified duration cannot support a
    // fresh-availability month. Both used to make legacy oats appear as food
    // exactly 100 days after sowing.
    if (!crop || !bed || crop.timingVerified === false || crop.yieldKgPerM2 === 0) continue;
    const hMonth = harvestMonthForCrop(p.sowMonth, crop);
    const maturityOffset = planningMaturityMonths(crop.daysToHarvest)
      + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
    const freshSpan = crop.harvestWindowMonths ?? 0;
    for (let off = 0; off <= freshSpan; off++) {
      // Fresh months an existing crop already delivered are over. A storage
      // tail is added below only when the catalog carries sourced conditions.
      if (slotIsPast(p, nowMonth, maturityOffset + off)) continue;
      byMonth[wrapMonth(hMonth + off)].set(crop.key, 'fresh');
    }
    const storageSpan = crop.storageMonths ?? 0;
    for (let off = 1; off <= storageSpan; off++) {
      if (slotIsPast(p, nowMonth, maturityOffset + freshSpan + off)) continue;
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

/**
 * What fraction of the total bed area is actually working for you each
 * month — a bed is "occupied" from sow month through the end of its
 * fresh-harvest window (harvestWindowMonths), same span PlantingBar draws:
 * a cut-and-come-again crop still physically holds the bed while it keeps
 * producing, but a storageMonths crop's shelf life happens OFF the bed (in
 * a shed/pantry), so that doesn't extend occupancy. 1-indexed 13-slot like
 * the other month aggregations here ([0] unused). Each physical bed is
 * capped at its own area before the site total is calculated: overlapping
 * successions cannot make one bed more than 100% occupied.
 */
export function buildFieldUtilizationByMonth(plantings: Planting[], beds: PlanBed[], nowMonth?: number): number[] {
  const totalArea = beds.reduce((s, b) => s + b.areaM2, 0);
  if (totalArea <= 0) return Array<number>(13).fill(0);
  // Occupancy is accumulated PER BED per month, then each bed is clamped to its
  // own area before summing — a single physical bed can never be more than 100%
  // occupied. Without the clamp, a cut-and-come-again crop's harvest-window tail
  // (which this metric deliberately counts, unlike the planner's occupancy model
  // which frees the bed at maturity to allow replanting) gets summed on top of
  // the successor already sown in that same bed-third, pushing a bed past 100%
  // and the whole chart over 100% — physically impossible and confusing.
  const perBed = new Map<string, number[]>();
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const areaHere = bed.areaM2 * (p.areaFraction ?? 1);
    let arr = perBed.get(bed.id);
    if (!arr) { arr = Array<number>(13).fill(0); perBed.set(bed.id, arr); }
    occupiedMonthsForPlanting(p).forEach((month, offsetFromBedEntry) => {
      const offsetFromSow = offsetFromBedEntry
        + (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
      if (slotIsPast(p, nowMonth, offsetFromSow)) return; // finished months of an existing crop are history, not occupancy
      arr[month] += areaHere;
    });
  }
  const occupiedArea = Array<number>(13).fill(0);
  for (const bed of beds) {
    const arr = perBed.get(bed.id);
    if (!arr) continue;
    for (let m = 1; m <= 12; m++) occupiedArea[m] += Math.min(arr[m], bed.areaM2);
  }
  return occupiedArea.map((a) => a / totalArea);
}

export interface CashflowSettings {
  /** % of the harvestable value actually SOLD (the rest is assumed home-consumed). */
  sellPercent: number;
  /** % of yield assumed LOST to disease, failure or underperformance before it ever reaches "harvestable". */
  lossPercent: number;
  /** True only after the farmer has reviewed both percentages. Persisted
   * defaults are placeholders and must not produce a Rand headline. */
  confirmed?: boolean;
}

const CASHFLOW_SETTINGS_KEY = 'imbewu_cashflow_settings_v1';

/**
 * Fresh-start defaults for an account that has never saved cashflow settings.
 *
 * lossPercent opens at 25 because a 0% starting position understates real SA
 * smallholder losses. Sources (triangulation — these share some data ancestry,
 * they are not three independent lines):
 * - CSIR (2021) SA food-loss study: 9% production + 18.3% post-harvest
 *   ≈ 25.6% cumulative for fruit & vegetables.
 * - FAO Food Loss Index, fruit & vegetables: 25.4%.
 * - Molelekoa et al. (2025): 25.15% measured on 3,115 tomatoes across
 *   8 SA smallholder farms.
 * The default stays behind confirmed:false — no Rand figure is shown until the
 * farmer reviews both sliders — and it is applied ONLY when nothing is stored:
 * loadCashflowSettings never migrates a persisted value onto this default.
 */
export const DEFAULT_CASHFLOW_SETTINGS: CashflowSettings = { sellPercent: 100, lossPercent: 25, confirmed: false };

/**
 * Field fallbacks for a PERSISTED blob that is missing a field (a save that
 * predates the field, or a hand-edited store). These stay at the values the
 * old code would have shown, so a farm that has already saved settings never
 * silently changes when a fresh default moves. Do not point these at
 * DEFAULT_CASHFLOW_SETTINGS.
 */
const STORED_FIELD_FALLBACKS = { sellPercent: 100, lossPercent: 0 } as const;

export function loadCashflowSettings(): CashflowSettings {
  if (isSampleMode()) return getSandboxCashflowSettings();
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_CASHFLOW_SETTINGS;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(CASHFLOW_SETTINGS_KEY));
    if (!raw) return DEFAULT_CASHFLOW_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      sellPercent: typeof parsed.sellPercent === 'number' ? parsed.sellPercent : STORED_FIELD_FALLBACKS.sellPercent,
      lossPercent: typeof parsed.lossPercent === 'number' ? parsed.lossPercent : STORED_FIELD_FALLBACKS.lossPercent,
      confirmed: parsed.confirmed === true,
    };
  } catch {
    return DEFAULT_CASHFLOW_SETTINGS;
  }
}

export function saveCashflowSettings(settings: CashflowSettings): void {
  if (isSampleMode()) { setSandboxCashflowSettings(settings); return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(CASHFLOW_SETTINGS_KEY),
      JSON.stringify(settings),
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}
