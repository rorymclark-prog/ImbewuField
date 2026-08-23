// Auto-suggest crop plan — a deterministic rules engine over the existing
// crop-catalog/crop-plan data (no network, no LLM call: the catalog is
// already fully structured, so this is instant, offline-safe, and every
// suggestion can be explained). Designed via a 3-angle workflow panel
// (MVP / family-variety / succession-first) + judge synthesis; this is that
// synthesis, simplified where the full spec added complexity without a
// proportional gain for a first version.

import type { CropDef, RainPattern } from './crop-catalog';
import { CROPS, hasAutomaticPlanningBasis, hasVerifiedSchedule, MONTHS_SHORT, plantsPerM2 } from './crop-catalog';
import type { PlanBed, Planting } from './crop-plan';
import {
  existingSowOffset,
  harvestEndMonthForCrop,
  harvestMonthForCrop,
  isSpaceHungry,
  onceStampIsPast,
  planningMaturityMonths,
  TRANSPLANT_BED_RESERVED_FROM_MONTHS,
  TRANSPLANT_ENTRY_PLANNED_MONTHS,
} from './crop-plan';
import type { FoodGroup, RotationFamily } from './crop-groups';
import { foodGroupOf, GROUP_PRIORITY, ROTATION_FAMILY_META, rotationFamilyOf } from './crop-groups';
import type { StapleCourse } from './staple-crops';
import { plotPool, plotWinterCovers, stapleCourseOf, STAPLE_COURSE_SEQUENCE, isPlotWinterCover } from './staple-crops';

// A crop may remain in the catalog so legacy records retain their identity
// even when its exact schedule is not source-backed. Such a record must never
// become a new automatic suggestion or make a rest-period explanation claim
// that a schedulable crop exists when it does not.
const SCHEDULABLE_CROPS = CROPS.filter(hasVerifiedSchedule);
// Yield-backed crops can be compared by kg/m². A farmer's exact crop choice
// needs a different threshold: verified timing and field spacing are enough
// to put amadumbe on a bed calendar, while its kilograms and value remain
// deliberately unknown. Conflating those questions greyed out a culturally
// important crop even though the catalog can defend when and how to plant it.
const AUTOMATIC_PLANNING_CROPS = CROPS.filter(hasAutomaticPlanningBasis);

export type GardenGoal = 'family' | 'commercial' | 'hybrid';
export type HarvestRhythm = 'steady' | 'few-big';
/** @deprecated Household headcount is not a planting-demand model. Kept only
 * so old saved answers and callers can still be read without changing crops. */
export type HouseholdSize = 'small' | 'medium' | 'large';

export interface AutoSuggestAnswers {
  goal: GardenGoal;
  /** @deprecated Ignored by the planner. Location/headcount cannot prove how
   * much of a crop a household wants or can manage. */
  householdSize?: HouseholdSize;
  focusCropCount?: number; // commercial — how many crops to concentrate on (1-3)
  groups: FoodGroup[]; // selected food groups — empty = "not sure, suggest for me"
  /** Optional household whitelist. Empty/absent means every eligible crop in
   * the selected food groups; a non-empty list means suggest only crops the
   * household explicitly chose. The engine never infers taste from location. */
  cropKeys?: string[];
  rhythm: HarvestRhythm;
  // When true, immediate same-family sequences in this proposal and after
  // supplied crop records are avoided where another crop can fit. A single
  // annual view cannot prove or store a multi-year rotation.
  rotateCrops: boolean;
  // family/hybrid only (commercial mode's whole-bed concentration is a
  // deliberate farmer choice, not gated by this). Default false: a
  // space-hungry vine dedicating a whole veg bed to itself for months only
  // to sit there half-used is a poor default (real permaculture practice
  // grows these in a dedicated plot/edge/food-forest area, not a precious
  // rotational veg bed) — so by default they're only RECOMMENDED elsewhere,
  // never auto-placed. Turning this on restores the old auto-placement
  // behaviour as an explicit, informed choice.
  allowVinesInBeds: boolean;
  /** Allow two different crops to share one bed at the same time, each on its
   * own fraction of the area (quarter/third/half shares — side-by-side
   * strips, not an intercropping-yield assumption; every share keeps its own
   * sourced per-m² planning basis). The guided flow defaults this to TRUE
   * (app/facilitator/crops/page.tsx): on small farms whole-bed-only packing
   * strands most of the area, and the rotation ledger checks same-family
   * conflicts against every co-occupant of a bed (see BedRotation), so
   * mixing does not weaken rotation. Absent/false means one crop per bed at
   * a time; same-crop succession is always allowed. */
  allowMixedCropsInBed?: boolean;
  /** Confirms managed water is available throughout the planned crop cycles.
   * Required because this engine deliberately packs successive crop cycles;
   * a regional rainfall label does not prove that this farm can water them.
   * False/absent returns no automatic plan. */
  reliableIrrigation?: boolean;
}

/**
 * What a note is FOR, so the review screen can rank it instead of stacking
 * every sentence into one amber wall.
 *
 * Measured before this existed (2026-08-19 audit, 25,344 generated plans):
 * the median plan carried 9 notes, the 90th percentile 23 and the worst 55 —
 * 35% of them one repeated per-bed rest template — and the two load-bearing
 * vine warnings sat at positions 5 and 6 under twenty-six copies of it. A flat
 * string[] gave the UI nothing to rank by, so it could only render them all
 * the same size in the order they happened to be pushed.
 *
 * - `warning` — something that could cost the farmer a crop: a vine claiming a
 *   whole bed, a chosen crop that was not placed, a rotation or space caution,
 *   a calendar that has not been checked locally.
 * - `choice`  — a decision the planner made and the farmer may want to change:
 *   placements, rescues, the winter bridge, the oats exception.
 * - `gap`     — where the plan leaves ground with no new sowing.
 * - `basis`   — how the plan was made and what the numbers rest on. True and
 *   worth keeping, but identical on every farm in the country, so it must
 *   never be the first thing a farmer reads.
 */
export type PlanNoteKind = 'warning' | 'choice' | 'gap' | 'basis';

export interface PlanNote {
  kind: PlanNoteKind;
  /** Growing areas this note is about, by bed id — lets a caller link a note
   * back to the map without re-parsing bed labels out of the sentence. */
  bedIds?: string[];
  text: string;
}

const NOTE_KIND_RANK: Record<PlanNoteKind, number> = { warning: 0, choice: 1, gap: 2, basis: 3 };

function planNote(kind: PlanNoteKind, text: string, bedIds?: readonly string[]): PlanNote {
  return bedIds && bedIds.length ? { kind, bedIds: [...bedIds], text } : { kind, text };
}

/** warning → choice → gap → basis, stable within each kind so the order a pass
 * pushed its own notes in is preserved. */
function orderNotes(notes: readonly PlanNote[]): PlanNote[] {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => NOTE_KIND_RANK[a.note.kind] - NOTE_KIND_RANK[b.note.kind] || a.index - b.index)
    .map((entry) => entry.note);
}

/**
 * A crop the farmer chose that this plan does not sow, with the honest timing
 * story behind it.
 *
 * `nextWindowMonth` is the crop's TRUE next sowing window — the sow month with
 * the smallest distance forward from today, full stop. It is never moved later
 * because that later month happens to have room; picking the first month WITH
 * room and calling it "the next window" told a space story in timing language
 * (repro at now=Jan on two full beds: beetroot's summer window opens in
 * February and the panel said August). `firstFitMonth` carries the space fact
 * separately — the soonest month in the window where somewhere on this farm
 * could actually take the crop. When the two differ, the sentence says so.
 */
export interface LaterThisYearEntry {
  cropKey: string;
  /** The crop's own next sowing month, whether or not the plan has room then. */
  nextWindowMonth: number;
  /** The soonest sow month with somewhere on this farm to put it. */
  firstFitMonth: number;
  /** The whole farmer-visible sentence, written here so the voice lint sees it. */
  text: string;
}

/**
 * Farmer-visible panel copy the review screen renders around the notes.
 *
 * It lives here rather than inline in page.tsx so the banned-terms lint and the
 * truth gates in tests/crop-plan-notes.test.ts can see it — a sentence
 * hardcoded in the component is a sentence no test reads, which is how
 * "There is room for each of them when its window opens" shipped over a panel
 * whose whole point is that sometimes there is not.
 */
export const PLAN_NOTES_PANEL_COPY = {
  gapsHeading: 'Ground with no new sowing',
  basisHeading: 'How this plan was made',
  laterHeading: 'Waiting for their sowing window',
  /** Deliberately promises NOTHING about room: some entries below are crops
   * whose window opens into a plan that is already committed that month. */
  laterSubtitle: 'Crops you chose that this plan does not sow yet, and when the next real chance comes.',
} as const;

export interface AutoSuggestResult {
  plantings: Planting[];
  notes: PlanNote[];
  laterThisYear: LaterThisYearEntry[];
}

function plantingId(
  bedId: string,
  cropKey: string,
  sowMonth: number,
  areaFraction: number | undefined,
): string {
  const fraction = areaFraction ?? 1;
  return `auto:${encodeURIComponent(bedId)}:${encodeURIComponent(cropKey)}:${sowMonth}:${fraction}`;
}

/**
 * Several coverage passes may independently choose the same cohort. Present
 * that as one planting with their combined bed share, not duplicate rows
 * distinguished only by opaque ids.
 *
 * SUMS the shares — it does NOT keep the larger one (as an earlier version
 * did). Every occupancy.add() call site that can legally repeat a (bedId,
 * cropKey, sowMonth) key only gets to because Occupancy.fits() already
 * confirmed real, additional room was free at that moment — fillRemainingGaps
 * topping up a bed a winter bridge only half-filled, ensureSowingCadence
 * adding a second cabbage strip beside a first, and so on (see each call
 * site's own comment). Two 0.5 shares placed that way are two genuine strips
 * of the SAME crop sown the SAME month, not one planting guessed at twice by
 * two passes — and the Occupancy ledger those passes checked fits() against
 * already SUMS same-cohort adds. Taking the max instead of the sum here (the
 * 2026-08-20 bug) silently discarded real, legally-placed area: the ledger
 * used by every later pass in the SAME run correctly saw the bed as fuller
 * than the emitted plan then claimed, so a farmer reading "50% free" was
 * looking at ground the plan had actually already committed to 100%.
 * Capped at 1 — occupancy.fits() already enforces that per add; this only
 * guards float drift when 3+ shares of the same cohort are merged.
 */
function consolidatePlantings(plantings: readonly Planting[]): Planting[] {
  const byCohort = new Map<string, Planting>();
  for (const planting of plantings) {
    const key = `${planting.bedId}\u0000${planting.cropKey}\u0000${planting.sowMonth}`;
    const existing = byCohort.get(key);
    if (!existing) {
      byCohort.set(key, { ...planting });
      continue;
    }
    const cohortFraction = Math.min(1, (existing.areaFraction ?? 1) + (planting.areaFraction ?? 1));
    existing.areaFraction = cohortFraction < 0.9999 ? cohortFraction : undefined;
  }
  return [...byCohort.values()].map((planting) => ({
    ...planting,
    id: plantingId(
      planting.bedId,
      planting.cropKey,
      planting.sowMonth,
      planting.areaFraction,
    ),
  }));
}

function monthsForward(from: number, to: number): number {
  return (((to - from) % 12) + 12) % 12;
}

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

interface Cluster { start: number; end: number; months: number[] }

/**
 * Groups a crop's valid sow months into contiguous runs, wrap-merging a run
 * ending in December with one starting in January (e.g. Nov-Feb reads as
 * ONE window, not two). A crop like swiss-chard whose summer window is
 * genuinely disjoint ([2,3] and [8,9,10]) stays two separate clusters —
 * succession must never straddle that real gap.
 */
export function clusterSowMonths(months: number[]): Cluster[] {
  const sorted = [...new Set(months.filter(
    (month) => Number.isInteger(month) && month >= 1 && month <= 12,
  ))].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const clusters: Cluster[] = [];
  for (const m of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && m === last.end + 1) {
      last.end = m;
      last.months.push(m);
    } else {
      clusters.push({ start: m, end: m, months: [m] });
    }
  }
  if (clusters.length > 1 && clusters[0].start === 1 && clusters[clusters.length - 1].end === 12) {
    const first = clusters.shift()!;
    const lastC = clusters[clusters.length - 1];
    lastC.end = first.end;
    lastC.months = [...lastC.months, ...first.months];
  }
  return clusters;
}

/** The month within `months` reachable soonest from `nowMonth` (0 if already in-window). */
function nearestEntry(nowMonth: number, months: number[]): { month: number; gap: number } {
  let best = { month: months[0], gap: monthsForward(nowMonth, months[0]) };
  for (const m of months) {
    const gap = monthsForward(nowMonth, m);
    if (gap < best.gap) best = { month: m, gap };
  }
  return best;
}

/**
 * The two facts that decide how long a crop HOLDS ground. Deliberately a
 * structural type rather than the whole CropDef: the unknown-crop-key
 * fallback below has neither field, and a caller must not be able to pass a
 * bare daysToHarvest number by accident — which is exactly the bug this
 * shape exists to prevent (see holdSpanMonths).
 */
export type BedHold = Pick<CropDef, 'key' | 'daysToHarvest' | 'transplant' | 'harvestWindowMonths'>;

/**
 * Total months a planting OCCUPIES ITS BED: sowing through the end of the
 * fresh-harvest window, inclusive of both ends. Mirrors lib/crop-plan.ts's
 * occupiedMonthsForPlanting exactly — the two must agree, because one decides
 * where crops go and the other draws the utilisation chart the farmer reads.
 *
 * THE HARVEST WINDOW IS THE WHOLE POINT (2026-08-04). This used to be
 * maturity only, so the planner freed a bed the day its crop was ripe. A
 * half-bed of Swiss chard sown in January was treated as finished in March
 * when it is in fact cut until June — and the planner stacked another half
 * bed on top of it. Measured on a 9-bed fixture, Bed 1 came out at 150-167%
 * occupied in nine months of twelve, which buildFieldUtilizationByMonth then
 * clamped to 100% so nothing ever showed it. The owner saw the other end of
 * it: "there is no sowing in bed one after april" — the bed had no room left
 * to offer because its room had already been sold twice.
 *
 * Deriving the span from daysToHarvest directly (rather than comparing
 * sowMonth to an already-wrapped harvestEnd month) avoids a real ambiguity: a
 * crop whose daysToHarvest rounds to an exact 12-month offset wraps harvestEnd
 * back to the SAME numeric month as sowMonth, indistinguishable from "occupies
 * 1 month" if you only compare endpoints. daysToHarvest<=0 (the unknown-crop
 * fallback) means "nothing more is known" — occupy just the sow month.
 */
function holdSpanMonths(crop: BedHold): number {
  if (crop.daysToHarvest <= 0) return 1;
  return planningMaturityMonths(crop.daysToHarvest)
    + 1
    + (crop.harvestWindowMonths ?? 0);
}

/** Bed-hold start relative to the sow month: a tray crop's bed is reserved
 * from the printed earliest field-entry month (sow+1), because that is the
 * month the calendar tells the farmer to check seedlings and transplant when
 * ready — see TRANSPLANT_BED_RESERVED_FROM_MONTHS in lib/crop-plan.ts. */
function bedHoldStartOffsetMonths(crop: BedHold): number {
  return crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0;
}

/** Bed-hold length: holdSpanMonths measures from the PLANNED transplant month
 * (harvest timing stays anchored there); reserving from the earlier printed
 * entry edge stretches the hold by the difference without moving harvests. */
function bedHoldSpanMonths(crop: BedHold): number {
  return holdSpanMonths(crop)
    + (crop.transplant
      ? TRANSPLANT_ENTRY_PLANNED_MONTHS - TRANSPLANT_BED_RESERVED_FROM_MONTHS
      : 0);
}

/** Every calendar month (1-12) a planting actually holds its bed, wrap-safe. */
function occupiedMonths(sowMonth: number, crop: BedHold): number[] {
  const span = bedHoldSpanMonths(crop);
  const months: number[] = [];
  // KZN DARD expresses the growing period for starred/transplanted crops from
  // transplanting. Their tray month is nursery time, not occupied bed time —
  // but the sow+1 readiness month IS reserved bed time (see above).
  let m = wrapMonth(sowMonth + bedHoldStartOffsetMonths(crop));
  for (let i = 0; i < span; i++) {
    months.push(m);
    m = m === 12 ? 1 : m + 1;
  }
  return months;
}

/** Absolute field-occupancy offsets for one proposed cohort in the rolling
 * twelve-month plan. Unlike `occupiedMonths`, September ten months from now
 * is not confused with the September that already passed two months ago. */
function plannedOccupiedOffsets(
  nowMonth: number,
  sowMonth: number,
  crop: BedHold,
): number[] {
  const startOffset = monthsForward(nowMonth, sowMonth)
    + bedHoldStartOffsetMonths(crop);
  return Array.from({ length: bedHoldSpanMonths(crop) }, (_, index) => startOffset + index);
}

/** Whether one proposed cohort reaches the target occurrence inside the
 * rolling horizon. Month names alone are insufficient: when planning in
 * November, January is +2 while the next September is +10. */
export function plannedCohortReachesMonth(
  nowMonth: number,
  sowMonth: number,
  crop: BedHold,
  targetMonth: number,
): boolean {
  return plannedOccupiedOffsets(nowMonth, sowMonth, crop)
    .includes(monthsForward(nowMonth, targetMonth));
}

export const BED_FRACTION_PRESETS = [1, 0.5, 1 / 3, 0.25] as const;
/** A third of a bed is 0.333…; comparing shares needs slack or 3 × ⅓ > 1. */
const BED_SHARE_EPS = 1e-6;
export function isStandardBedFraction(fraction: number | undefined): boolean {
  const value = fraction ?? 1;
  return BED_FRACTION_PRESETS.some((preset) => Math.abs(preset - value) < 0.001);
}
function closestPreset(target: number): number {
  return BED_FRACTION_PRESETS.reduce((best, p) => (Math.abs(p - target) < Math.abs(best - target) ? p : best));
}

// The plan is a rolling twelve-month view: a sowing 0-11 months ahead belongs
// to it. The former five-month cutoff was an uncited product guess that called
// valid later-season crops unavailable and could replace them with something
// the household did not ask for.
const PLAN_HORIZON_MONTHS = 11;

/**
 * Absolute wall-clock context, threaded SEPARATELY from nowMonth/anchorMonth.
 * Inside suggestIdealYearPlan's whole-year sweep, nowMonth is often a
 * synthetic anchor rather than today (see Occupancy.seed's own comment on
 * that), so "what is the real month right now" cannot be derived from it.
 * Optional everywhere it threads: a caller that omits it keeps that
 * function's exact prior behaviour, unchanged — this is additive context,
 * not a new requirement.
 */
export interface RealNow {
  year: number;
  month: number;
}

/**
 * Dev-only signal for a caller-discipline regression, not a staleness check.
 *
 * Once a caller supplies `realNow`, a stale `once` row is read correctly by
 * the branch this guards (see Occupancy.seed / BedRotation's constructor) —
 * nothing to warn about there. This fires only on the one thing knowable
 * with no clock at all: a once-carrying, not-yet-settled row arrived and no
 * real-clock context was supplied, so this pass has no way to tell a stale
 * stamp from one still ahead. That is exactly the caller-discipline gap that
 * let a three-year-old stamp be read as a sowing still to come — a future
 * caller (batch job, new page, different test) skipping `realNow` would
 * silently reintroduce it. Never throws: several test files deliberately
 * feed raw, unsettled `once` rows straight into these functions to probe
 * library behaviour in isolation, and that is a legitimate, established use
 * — this only asks a build/test log to say so.
 */
function warnIfOnceRowUnverifiable(
  plantings: readonly Planting[],
  realNow: RealNow | undefined,
  source: string,
): void {
  if (process.env.NODE_ENV === 'production' || realNow) return;
  if (plantings.some((p) => typeof p.once === 'string' && p.existing !== true)) {
    console.warn(
      `[crop-autosuggest] ${source} received a once-stamped row with no realNow context — `
      + 'staleness cannot be checked; pass realNow or ensure the caller already ran '
      + 'settleOnceRows.',
    );
  }
}

/**
 * Precise per-bed occupancy ledger — NOT the same thing
 * as lib/crop-plan.ts's bedOverlapFraction (a pairwise range-overlap sum,
 * fine as an ADVISORY warning for a human reviewing one change at a time,
 * but it can false-positive on chains of 3+ plantings whose ranges overlap
 * pairwise at different boundary months without ever all three genuinely
 * coexisting — auto-suggest makes many sequential placements with no human
 * checking each one, so it needs an exact month-by-month sum instead).
 */
class Occupancy {
  // Proposed rows need TWO views: real offsets for this now..+11 horizon, and
  // the saved annual template so proposed cohorts still collide safely across
  // the Dec/Jan boundary. Existing rows are observed one-off cohorts and only
  // use real offsets. Keeping these ledgers separate prevents last August's
  // cabbage from blocking a legal planting next September merely because both
  // touch the same month names.
  private annualByBed = new Map<string, Map<number, number>>();
  private annualCropsByBed = new Map<string, Map<number, Map<string, number>>>();
  private plannedByBed = new Map<string, Map<number, number>>();
  private plannedCropsByBed = new Map<string, Map<number, Map<string, number>>>();
  private existingByBed = new Map<string, Map<number, number>>();
  private existingCropsByBed = new Map<string, Map<number, Map<string, number>>>();
  private allowMixedCropsInBed: boolean;
  private nowMonth: number;

  constructor(allowMixedCropsInBed: boolean, nowMonth: number) {
    this.allowMixedCropsInBed = allowMixedCropsInBed;
    this.nowMonth = nowMonth;
  }

  allowsBedSharing(): boolean {
    return this.allowMixedCropsInBed;
  }

  seed(
    plantings: Planting[],
    holdOf: (p: Planting) => BedHold,
    nowMonth: number,
    realNow?: RealNow,
  ) {
    warnIfOnceRowUnverifiable(plantings, realNow, 'Occupancy.seed');
    for (const p of plantings) {
      if (!Number.isInteger(p.sowMonth) || p.sowMonth < 1 || p.sowMonth > 12) continue;
      const fraction = p.areaFraction;
      const safeFraction = fraction === undefined
        ? 1
        : Number.isFinite(fraction) && fraction > 0 && fraction <= 1
          ? fraction
          : 1;
      const crop = holdOf(p);
      // A `once` row whose stamp is already behind realNow was never settled
      // to `existing: true` before it reached here (settleOnceRows normally
      // does that at load) — but its sowing already happened, or didn't, and
      // either way it is history, not something still ahead. Reading it
      // exactly like `existing` (below) is the only anchoring that is honest
      // about that; see onceStampIsPast's doc for why an unparseable stamp
      // counts as past too.
      const stale = realNow !== undefined && typeof p.once === 'string'
        && onceStampIsPast(p.once, realNow.year, realNow.month);
      if (p.existing || stale) {
        const entryOffset = existingSowOffset(p.sowMonth, nowMonth)
          + bedHoldStartOffsetMonths(crop);
        for (let index = 0; index < bedHoldSpanMonths(crop); index++) {
          const offset = entryOffset + index;
          if (offset >= 0) this.addExistingOffset(p.bedId, offset, crop.key, safeFraction);
        }
      } else {
        // A saved one-time starter holds ground exactly like a planned row, and
        // is seeded as one — INCLUDING the annual ledger, which an earlier
        // version deliberately skipped on the reasoning that its months do not
        // recur so they must not block the same-named months next year.
        //
        // That reasoning ignored what it is being compared against. This ledger
        // is rebuilt for each of twelve candidate anchors, so `nowMonth` is
        // usually a synthetic anchor rather than today, and offsets are only
        // meaningful within their own anchor's frame. Planned rows survive that
        // because they are also written to the annual ledger, which is keyed by
        // calendar month and therefore identical in every frame. A starter
        // written to offsets ALONE was compared across rotated frames, so an
        // overlap real in the printed year read as clear here — and the sweep
        // scheduled a second crop on top of it. Farmers saw plots at 200%.
        //
        // Blocking the calendar month costs nothing it should have kept: every
        // planned row repeats annually, so a recurring crop overlapping the
        // starter's months collides in year one no matter which year it is
        // read in. There is no legal planting here to lose. This branch is
        // also where a `once` row lands when realNow was not supplied at all
        // (see warnIfOnceRowUnverifiable) — unchanged from before this fix,
        // since without realNow this function cannot tell stale from ahead.
        this.add(p.bedId, p.sowMonth, crop, safeFraction);
      }
    }
  }

  private addLedgerEntry(
    totals: Map<number, number>,
    crops: Map<number, Map<string, number>>,
    slot: number,
    cropKey: string,
    fraction: number,
  ): void {
    const nextTotal = (totals.get(slot) ?? 0) + fraction;
    if (nextTotal <= 0.0001) totals.delete(slot); else totals.set(slot, nextTotal);
    let byCrop = crops.get(slot);
    if (!byCrop) { byCrop = new Map(); crops.set(slot, byCrop); }
    const nextCrop = (byCrop.get(cropKey) ?? 0) + fraction;
    if (nextCrop <= 0.0001) byCrop.delete(cropKey); else byCrop.set(cropKey, nextCrop);
    if (!byCrop.size) crops.delete(slot);
  }

  private ledger(
    ledgers: Map<string, Map<number, number>>,
    bedId: string,
  ): Map<number, number> {
    let m = ledgers.get(bedId);
    if (!m) { m = new Map(); ledgers.set(bedId, m); }
    return m;
  }

  private cropLedger(
    ledgers: Map<string, Map<number, Map<string, number>>>,
    bedId: string,
  ): Map<number, Map<string, number>> {
    let m = ledgers.get(bedId);
    if (!m) { m = new Map(); ledgers.set(bedId, m); }
    return m;
  }

  private annualMap(bedId: string): Map<number, number> {
    return this.ledger(this.annualByBed, bedId);
  }

  private annualCropMap(bedId: string): Map<number, Map<string, number>> {
    return this.cropLedger(this.annualCropsByBed, bedId);
  }

  private existingMap(bedId: string): Map<number, number> {
    return this.ledger(this.existingByBed, bedId);
  }

  private existingCropMap(bedId: string): Map<number, Map<string, number>> {
    return this.cropLedger(this.existingCropsByBed, bedId);
  }

  private plannedMap(bedId: string): Map<number, number> {
    return this.ledger(this.plannedByBed, bedId);
  }

  private plannedCropMap(bedId: string): Map<number, Map<string, number>> {
    return this.cropLedger(this.plannedCropsByBed, bedId);
  }

  private addAnnualMonth(bedId: string, month: number, cropKey: string, fraction: number): void {
    this.addLedgerEntry(
      this.annualMap(bedId),
      this.annualCropMap(bedId),
      month,
      cropKey,
      fraction,
    );
  }

  private addExistingOffset(bedId: string, offset: number, cropKey: string, fraction: number): void {
    this.addLedgerEntry(
      this.existingMap(bedId),
      this.existingCropMap(bedId),
      offset,
      cropKey,
      fraction,
    );
  }

  private addPlannedOffset(bedId: string, offset: number, cropKey: string, fraction: number): void {
    this.addLedgerEntry(
      this.plannedMap(bedId),
      this.plannedCropMap(bedId),
      offset,
      cropKey,
      fraction,
    );
  }

  private annualTotalAtOffset(bedId: string, offset: number): number {
    return this.annualMap(bedId).get(wrapMonth(this.nowMonth + offset)) ?? 0;
  }

  private realTotalAtOffset(bedId: string, offset: number): number {
    return (this.plannedMap(bedId).get(offset) ?? 0)
      + (this.existingMap(bedId).get(offset) ?? 0);
  }

  private cropsAtOffset(bedId: string, offset: number): Map<string, number> {
    const combined = new Map<string, number>();
    const month = wrapMonth(this.nowMonth + offset);
    for (const source of [
      this.annualCropMap(bedId).get(month),
      this.plannedCropMap(bedId).get(offset),
      this.existingCropMap(bedId).get(offset),
    ]) {
      for (const [cropKey, share] of source ?? []) {
        combined.set(cropKey, (combined.get(cropKey) ?? 0) + share);
      }
    }
    return combined;
  }

  /** The tighter of real-horizon and annual-template occupancy, evaluated at
   * the offsets occupied by this proposed cohort. */
  fractionsDuring(bedId: string, sowMonth: number, crop: BedHold): number[] {
    return plannedOccupiedOffsets(this.nowMonth, sowMonth, crop)
      // A share must fit both the real upcoming horizon and the saved annual
      // recurrence. The tighter ledger controls; summing them would count the
      // same planned cohort twice.
      .map((offset) => Math.max(
        this.realTotalAtOffset(bedId, offset),
        this.annualTotalAtOffset(bedId, offset),
      ));
  }

  /** Would adding this fraction over this span push any occupied month past 100%? */
  fits(bedId: string, sowMonth: number, crop: BedHold, fraction: number): boolean {
    const offsets = plannedOccupiedOffsets(this.nowMonth, sowMonth, crop);
    // A cohort longer than a year overlaps its own annual copy. None exists in
    // today's supported catalog, but aggregating by month keeps this ledger
    // honest if one is added later.
    const annualOccurrences = new Map<number, number>();
    for (const offset of offsets) {
      const month = wrapMonth(this.nowMonth + offset);
      annualOccurrences.set(month, (annualOccurrences.get(month) ?? 0) + 1);
    }
    return offsets.every((offset) => {
      const month = wrapMonth(this.nowMonth + offset);
      const proposedShare = fraction * (annualOccurrences.get(month) ?? 1);
      if (this.realTotalAtOffset(bedId, offset) + fraction > 1.0001) return false;
      if (this.annualTotalAtOffset(bedId, offset) + proposedShare > 1.0001) return false;
      if (this.allowMixedCropsInBed) return true;
      const otherCropPresent = [...this.cropsAtOffset(bedId, offset).entries()]
        .some(([cropKey, share]) => cropKey !== crop.key && share > 0.0001);
      return !otherCropPresent;
    });
  }

  add(bedId: string, sowMonth: number, crop: BedHold, fraction: number) {
    for (const offset of plannedOccupiedOffsets(this.nowMonth, sowMonth, crop)) {
      this.addPlannedOffset(bedId, offset, crop.key, fraction);
      this.addAnnualMonth(
        bedId,
        wrapMonth(this.nowMonth + offset),
        crop.key,
        fraction,
      );
    }
  }

  /** Read-only: how much of `bedId` is committed in a given calendar month. */
  fractionAt(bedId: string, month: number): number {
    return this.realTotalAtOffset(bedId, monthsForward(this.nowMonth, month));
  }
}

// SA frost-risk winter window (matches crop-catalog.ts's own header comment:
// "frost risk May-Aug" under the summer rainfall pattern) — the months a bed
// is most likely to sit empty, since no catalog crop has a summer-pattern
// direct-sow window landing in June/July at all.
const WINTER_MONTHS = [5, 6, 7, 8];
const ALL_MONTHS = new Set(Array.from({ length: 12 }, (_, index) => index + 1));

/**
 * Plan-wide sowing tally by calendar month — THE STAGGER LEVER (added 2026-08-04).
 *
 * Coverage and cadence are different goals, and the engine only optimised the
 * first: every pass preferred the single longest-spanning candidate, so nine
 * identical beds all got their supported-season gaps covered by crops sown in
 * the SAME early window. The plan looked full while every cohort exhausted
 * together, with nothing freshly maturing behind it. The clustering was ours,
 * not a conclusion justified by the crop windows.
 *
 * Passes that place crops consult this tally and prefer candidates whose sow
 * month the plan has used LEAST — so identical beds diversify instead of
 * copying each other, and sowing (hence harvest) spreads around the calendar.
 * Counted over THIS plan's own additions only: supplied existing rows describe
 * occupancy/history, not the cadence this new proposal is trying to spread.
 */
type SowCounts = Map<number, number>;
function tallySowings(plantings: readonly Planting[]): SowCounts {
  const counts: SowCounts = new Map();
  for (const p of plantings) counts.set(p.sowMonth, (counts.get(p.sowMonth) ?? 0) + 1);
  return counts;
}
const sowCountAt = (counts: SowCounts, month: number): number => counts.get(month) ?? 0;
const bumpSow = (counts: SowCounts, month: number): void => { counts.set(month, (counts.get(month) ?? 0) + 1); };

/** Cohort counts stop one long-window crop winning repeatedly on the same bed.
 * CropSpread only counts distinct beds, so garlic twice on one bed previously
 * looked no more concentrated than garlic once. */
type CropCohortCounts = Map<string, number>;
function tallyCropCohorts(plantings: readonly Planting[]): CropCohortCounts {
  const counts: CropCohortCounts = new Map();
  for (const planting of plantings) {
    counts.set(planting.cropKey, (counts.get(planting.cropKey) ?? 0) + 1);
  }
  return counts;
}
const cohortCountAt = (counts: CropCohortCounts, cropKey: string): number => counts.get(cropKey) ?? 0;
const bumpCohort = (counts: CropCohortCounts, cropKey: string): void => {
  counts.set(cropKey, (counts.get(cropKey) ?? 0) + 1);
};

/** Fraction of a bed with a fresh-picking opportunity in each calendar month.
 * This is not a kg curve: it only lets the placement tie-breaker prefer a crop
 * that closes a real harvest gap over one that adds a fourth crop to an
 * already-busy harvest month. */
type FreshCoverage = Map<string, Map<number, number>>;
function freshHarvestMonths(sowMonth: number, crop: CropDef): number[] {
  if (crop.timingVerified === false || crop.yieldKgPerM2 === 0) return [];
  const first = wrapMonth(
    sowMonth
      + planningMaturityMonths(crop.daysToHarvest)
      + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0),
  );
  return Array.from(
    { length: 1 + (crop.harvestWindowMonths ?? 0) },
    (_, offset) => wrapMonth(first + offset),
  );
}
function tallyFreshCoverage(plantings: readonly Planting[]): FreshCoverage {
  const coverage: FreshCoverage = new Map();
  for (const planting of plantings) {
    const crop = CROPS.find((candidate) => candidate.key === planting.cropKey);
    if (!crop) continue;
    let bed = coverage.get(planting.bedId);
    if (!bed) { bed = new Map(); coverage.set(planting.bedId, bed); }
    for (const month of freshHarvestMonths(planting.sowMonth, crop)) {
      bed.set(month, Math.min(1, (bed.get(month) ?? 0) + (planting.areaFraction ?? 1)));
    }
  }
  return coverage;
}
function freshGapGain(
  coverage: FreshCoverage,
  bedId: string,
  crop: CropDef,
  sowMonth: number,
): number {
  const bed = coverage.get(bedId);
  return freshHarvestMonths(sowMonth, crop)
    .reduce((gain, month) => gain + (1 - (bed?.get(month) ?? 0)), 0);
}
function noteFreshCoverage(
  coverage: FreshCoverage,
  planting: Pick<Planting, 'bedId' | 'cropKey' | 'sowMonth' | 'areaFraction'>,
): void {
  const crop = CROPS.find((candidate) => candidate.key === planting.cropKey);
  if (!crop) return;
  let bed = coverage.get(planting.bedId);
  if (!bed) { bed = new Map(); coverage.set(planting.bedId, bed); }
  for (const month of freshHarvestMonths(planting.sowMonth, crop)) {
    bed.set(month, Math.min(1, (bed.get(month) ?? 0) + (planting.areaFraction ?? 1)));
  }
}

/**
 * How many DIFFERENT beds each crop has claimed — the monoculture brake.
 *
 * The owner asked "why do we plant swiss chard in so many beds". The old score
 * annualised yield from days-to-first-harvest and ignored the long period that
 * cut-and-come-again chard keeps holding the bed. Every coverage pass therefore
 * chose the same apparent winner, and a plan came out with chard in seven beds.
 * Nothing was wrong with any single placement; the fault was an overstated score
 * plus no plan-wide view of how far that crop had already spread.
 *
 * So each pass now counts how far a crop has already spread and prefers one that has
 * spread less. It is a preference, not a ban: once every fitting chosen crop has had
 * a chance, a useful repeat still beats falsely declaring the space impossible.
 */
type CropSpread = Map<string, Set<string>>;
function tallyCropBeds(plantings: readonly Planting[]): CropSpread {
  const spread: CropSpread = new Map();
  for (const p of plantings) {
    let beds = spread.get(p.cropKey);
    if (!beds) { beds = new Set(); spread.set(p.cropKey, beds); }
    beds.add(p.bedId);
  }
  return spread;
}
const bedsUsedBy = (spread: CropSpread, cropKey: string): number => spread.get(cropKey)?.size ?? 0;
function noteCropBed(spread: CropSpread, cropKey: string, bedId: string): void {
  let beds = spread.get(cropKey);
  if (!beds) { beds = new Set(); spread.set(cropKey, beds); }
  beds.add(bedId);
}
/**
 * Sort key for "how much of the garden does this crop already hold" — LOWER IS BETTER.
 *
 * Graded, not a simple over/under-cap flag, because the cap alone only fixes the tail of
 * the problem. The audit found the other half: runFamilyBreadthFirst offers only the top
 * few crops of each food group by yield, so eleven of the twenty-five catalog crops —
 * lettuce, coriander, broccoli, potato, amadumbe, garlic among them — were never offered
 * to any pass at all. Grading by beds-already-used means a crop nobody has planted sorts
 * ahead of the workhorse, so the closing passes reach into that tail instead of deepening
 * a crop the plan already has.
 *
 * Planting the SAME crop again in a bed it already occupies does not expand that crop's
 * footprint, so it keeps the current garden-wide bed count. A new bed costs one more.
 * This compares the actual prospective footprint instead of smuggling an arbitrary
 * "one third of the garden" threshold into the plan.
 */
function spreadRank(spread: CropSpread, cropKey: string, bedId: string): number {
  const used = bedsUsedBy(spread, cropKey);
  return used + (spread.get(cropKey)?.has(bedId) ? 0 : 1);
}

/** Fraction ladder for a bed. A plot (field-scale rotation unit) takes ONE crop at FULL area — never a half or a third; that is what distinguishes it from a shared veg bed. */
const fractionPresetsFor = (bed: PlanBed): readonly number[] =>
  bed.kind === 'plot' ? [1] : BED_FRACTION_PRESETS;

/**
 * Would giving this crop `fraction` of the bed leave positive area smaller
 * than one catalog planting position for that same crop?
 *
 * A fixed percentage is not a physical definition of a sliver: 17% of a 16m²
 * bed is still substantial ground. The catalog spacing decides whether the
 * remainder has enough area for one catalog planting position. This is area
 * arithmetic only: it does not prove the strip's physical width or row layout.
 *
 * Checked across the crop's WHOLE span, not just its sow month: a bed is only
 * as free as its tightest month while the crop is standing in it.
 *
 * Lives at module scope on purpose. Two passes choose fractions — this one and
 * fillRemainingGaps — and fixing only the second left Beds 4, 6, 7 and 9 still
 * carrying unplantable strips. One rule, one copy.
 */
function leavesDeadSliver(
  occupancy: Occupancy,
  bed: PlanBed,
  sowMonth: number,
  crop: CropDef,
  fraction: number,
): boolean {
  // EVERY month of the span, not just the tightest: a crop held Nov-Mar meets a
  // different neighbour each month, and judging only the tightest said "a half
  // fits March exactly, clean" while stranding 17% in the other four.
  for (const occupiedFraction of occupancy.fractionsDuring(bed.id, sowMonth, crop)) {
    const leftover = 1 - occupiedFraction - fraction;
    // A percentage alone does not say whether ground is unusable: 17% of a
    // 16m² bed can hold many plants. Call it dead only when the catalog's own
    // spacing says there is not enough AREA for one more planting position of
    // this crop. It does not claim that the remaining shape is usable ground.
    if (leftover > 0.001 && bed.areaM2 * leftover * plantsPerM2(crop) < 1) return true;
  }
  return false;
}

/**
 * The share to actually give a crop that has ASKED for `wanted`.
 *
 * Returns the requested share when it fits without a sub-position remainder;
 * otherwise the largest smaller preset that passes the same area check;
 * otherwise the largest that fits the occupancy arithmetic; null when nothing
 * fits. None of these checks proves an actual row layout.
 *
 * A succession batch asks for a named share — full, half, third or quarter.
 * We never invent a remainder such as 42%; if no standard share fits, the
 * planner leaves and explains the gap instead of handing the farmer an
 * impractical measurement. A plot's ladder is [1].
 */
function usableShare(
  occupancy: Occupancy,
  bed: PlanBed,
  sowMonth: number,
  crop: CropDef,
  wanted: number,
  max = 1,
  preferAtOrBelow = false,
): number | null {
  if (bed.kind === 'plot') return occupancy.fits(bed.id, sowMonth, crop, 1) ? 1 : null;
  if (!occupancy.allowsBedSharing()) return occupancy.fits(bed.id, sowMonth, crop, 1) ? 1 : null;

  const ladder = [wanted, ...fractionPresetsFor(bed).filter((f) => f < wanted - 0.001)];
  const fits = [...new Set(ladder)]
    .filter((f) => f > 0.001 && f <= max + 0.001 && bed.areaM2 * f * plantsPerM2(crop) >= 1)
    .filter((f) => occupancy.fits(bed.id, sowMonth, crop, f));
  if (!fits.length) return null;

  const clean = fits.filter((f) => !leavesDeadSliver(occupancy, bed, sowMonth, crop, f));
  const pool = clean.length ? clean : fits;
  // SUCCESSION ONLY: a batch's ask is a per-batch slice, and later batches of
  // OTHER crops are still coming for the same bed — so a share above the ask
  // is only for when every clean at-or-below share strands a sliver. Letting
  // "the rest" outbid a clean preset merged two plantings into one: Bed 1's
  // peas swallowed 0.666 (floored rest sat 0.001 nearer a 0.5 ask than the
  // third did) where peas-then-chard used to stand, and the chard covered
  // July. Gap-fill and the winter bridger keep rest-can-win: they run LAST,
  // nothing is coming after them, and preferring smaller there measured
  // 8.5% -> 11.1% strips on the interrogation farms.
  const atOrBelow = preferAtOrBelow ? pool.filter((f) => f <= wanted + 0.001) : [];
  const candidates = atOrBelow.length ? atOrBelow : pool;
  // Closest to the share the caller asked for; ties go to the larger share.
  return candidates.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || b - a)[0];
}

/**
 * Which crops a given bed may be planted with — THE single choke point, and the
 * answer to "the staple crop section allocated everything but staple crops".
 *
 * Every pass used to hand a plot the same pool as a veg bed, so plots filled with
 * whatever scored highest: carrots, chard, cabbage, onions, watermelon. Ranking by
 * FOOD GROUP could never fix that, because the distinction lives below the group —
 * 'root_tuber' holds sweet potato and carrots alike. So a plot's pool is now named
 * crop by crop in lib/staple-crops.ts, and every pass routes through here.
 */
function poolForBed(
  bed: PlanBed,
  pool: CropDef[],
  allowVinesInBeds: boolean,
  /** Plots whose staple course for this season is already decided — see below. */
  plotsWithCourse?: ReadonlySet<string>,
  /** When present, every automatic planting must remain in this exact list. */
  strictCropKeys?: ReadonlySet<string>,
): CropDef[] {
  if (bed.kind === 'plot') {
    // ONE COURSE PER PLOT PER SEASON. Once the staple pass has given a plot its crop,
    // the closing passes may only add the winter cover — never a second staple. They
    // are coverage passes: their instinct is to fill an empty month, and an empty plot
    // month in May looks exactly like a bed that needs planting, so potato was landing
    // on three of four plots as a "gap fill" and spending the tuber course before the
    // summer rotation began. A plot resting between its crop and its cover is correct.
    if (plotsWithCourse?.has(bed.id)) {
      // With broad food-group answers, covers come from the whole catalog
      // because a cover crop is soil management, not an answer to that
      // questionnaire. With exact crop choices, however, even this route is
      // filtered by strictCropKeys: an unchosen cover must never appear.
      // Only covers with a verified schedule remain in SCHEDULABLE_CROPS. A
      // cover may use sourced kg/ha establishment instead of fake plant-grid
      // geometry. If none passes the exact-choice and rotation checks, the
      // plot rests rather than receiving an invented filler crop.
      const covers = plotWinterCovers(SCHEDULABLE_CROPS)
        .filter((crop) => !strictCropKeys || strictCropKeys.has(crop.key));
      // Rotation depends on the cover's actual sow month, so it is evaluated
      // by the placement pass after that month is known. Returning both here
      // avoids choosing a cover against generation order rather than time.
      return covers;
    }
    const staples = plotPool(pool);
    // The food-group answers describe the VEG BEDS. A plot the farmer traced as a
    // staple garden on their own map is a more specific statement than a
    // questionnaire checkbox, so broad food-group answers may fall back to the
    // full staple list rather than putting a salad crop in a field. An exact
    // crop list is more specific still: no staple match leaves the plot empty.
    return staples.length || strictCropKeys ? staples : plotPool(SCHEDULABLE_CROPS);
  }
  // No cover-crop guard needed here: `pool` is built from edible crops only
  // (see autoSuggestPlan), so a zero-yield green manure can never reach a bed
  // by any route, not just this one.
  return allowVinesInBeds ? pool : pool.filter((c) => !isSpaceHungry(c));
}

/**
 * Whether this rules engine can defend an automatic crop-to-place decision.
 *
 * The map gives area and a bounding-box width, not a row layout, access paths,
 * trellis position or edge-spill plan. Turning those two measurements into a
 * universal "two plants across" rule was invented agronomy: a narrow hand bed
 * can legitimately carry one row, while a wide irregular polygon may still be
 * unsuitable. Do not pretend the geometry proves more than it does.
 *
 * Maize is the one explicit automatic-placement exception. It is wind-pollinated
 * and the catalog requires block planting, but the app cannot verify a block from
 * width alone without inventing a row count. It is therefore auto-planned only in
 * a farmer-mapped staple plot. A farmer can still add maize manually after checking
 * the real layout.
 */
function supportsAutomaticPlacement(crop: CropDef, bed: PlanBed): boolean {
  return bed.kind === 'plot' || crop.key !== 'maize';
}

/**
 * Why the shared-bed passes were handed nothing to work with.
 *
 * The old copy blamed space-hungry vines unconditionally, because "no shared
 * beds" and "the vine pre-pass took them all" look identical from the call
 * site. They are not: on a farm whose only mapped growing areas are staple
 * plots, `sharedBeds` is empty before any vine has even been considered, and
 * the farmer was told vines had eaten beds that never existed (2026-08-19
 * audit). Note the converse holds by construction — if at least one non-plot
 * bed IS mapped and `sharedBeds` still came out empty, every one of those beds
 * must be in the dedicated set, so the vine wording below is only ever reached
 * when vines really did claim them.
 */
function noSharedBedsNote(beds: readonly PlanBed[]): string {
  if (!beds.length) {
    return 'No growing area is mapped yet, so there was nowhere to put the vegetables you chose. Draw a veg bed on the map and run the suggestion again.';
  }
  if (!beds.some((bed) => bed.kind !== 'plot')) {
    return 'Every growing area on your map is a staple plot, and the vegetables you chose need a regular veg bed. Draw a veg bed on the map, or plant them on a plot yourself once you have checked the row layout.';
  }
  return 'No beds free for family crops once space-hungry vines were placed.';
}

interface RotationSlot {
  cropKey: string;
  family: RotationFamily;
  startOffset: number;
  endOffset: number;
  existing: boolean;
}

interface ProjectedRotationSlot extends RotationSlot {
  /** Zero is real/current-cycle state; +/-12 are synthetic annual copies. */
  cycleShift: -12 | 0 | 12;
}

/**
 * Persistent bed cursor plus a calendar-aware rotation ledger.
 *
 * Allocation passes do not run in month order: a closing gap-fill can schedule
 * March after an earlier pass already scheduled August. A single mutable
 * "last family" therefore checked generation order, not the crop sequence the
 * farmer would actually grow. This ledger stores every course on the rolling
 * timeline and compares a candidate with its chronological neighbours on both
 * sides, including the annual wrap.
 *
 * Same-crop cohorts are one course for rotation purposes. Staggering cabbage
 * three times is not three cabbage rotations; beetroot followed by Swiss chard
 * is a real Amaranthaceae repeat and is rejected when an alternative exists.
 */
class BedRotation {
  private lastBedId: string | null = null;
  private slotsByBed = new Map<string, RotationSlot[]>();
  private rotateCrops: boolean;
  private nowMonth: number;
  private exactFallbackFamily: RotationFamily | null;
  private fallbackBeds = new Map<string, RotationFamily>();

  constructor(
    existingPlantings: readonly Planting[],
    nowMonth: number,
    rotateCrops: boolean,
    exactFallbackFamily: RotationFamily | null,
    realNow?: RealNow,
  ) {
    this.nowMonth = nowMonth;
    this.rotateCrops = rotateCrops;
    this.exactFallbackFamily = exactFallbackFamily;
    warnIfOnceRowUnverifiable(existingPlantings, realNow, 'BedRotation');
    for (const planting of existingPlantings) {
      const crop = CROPS.find((candidate) => candidate.key === planting.cropKey);
      if (!crop) continue;
      if (typeof planting.once === 'string') {
        // A saved one-time starter's sowing is still AHEAD — UNLESS its stamp
        // is already behind realNow, in which case it never got settled to
        // `existing: true` before it reached here (settleOnceRows normally
        // does that at load) but is history all the same. Only when realNow
        // says otherwise do we forward-anchor it: anchoring it as an observed
        // past course (existingSowOffset) would rewrite a future sowing into
        // last year's history and corrupt every neighbour comparison. Forward
        // anchor, but marked existing so wouldRepeat treats it as one real
        // course — never a ±12-projected annual copy.
        const stale = realNow !== undefined
          && onceStampIsPast(planting.once, realNow.year, realNow.month);
        if (!stale) {
          this.addSlot(planting.bedId, { ...this.slotFor(crop, planting.sowMonth, false), existing: true });
          continue;
        }
      }
      this.addSlot(planting.bedId, this.slotFor(crop, planting.sowMonth, true));
    }
  }

  nextIndex(beds: PlanBed[]): number {
    if (!this.lastBedId) return 0;
    const idx = beds.findIndex((b) => b.id === this.lastBedId);
    return idx === -1 ? 0 : (idx + 1) % beds.length;
  }

  private slotFor(crop: CropDef, sowMonth: number, existing: boolean): RotationSlot {
    const sowOffset = existing
      ? existingSowOffset(sowMonth, this.nowMonth)
      : monthsForward(this.nowMonth, sowMonth);
    const startOffset = sowOffset + bedHoldStartOffsetMonths(crop);
    return {
      cropKey: crop.key,
      family: rotationFamilyOf(crop),
      startOffset,
      endOffset: startOffset + bedHoldSpanMonths(crop) - 1,
      existing,
    };
  }

  private addSlot(bedId: string, slot: RotationSlot): void {
    const slots = this.slotsByBed.get(bedId) ?? [];
    slots.push(slot);
    this.slotsByBed.set(bedId, slots);
  }

  /** True when this candidate would put two courses of one botanical family
   * on the same ground without a full different course between them.
   *
   * 2026-08-19 audit: comparing the candidate only with the nearest previous
   * and next course by time left two holes, both live with the guided flow's
   * defaults (rotation ON, mixed beds ON):
   *   1. Overlap-blindness — a same-family course whose occupancy OVERLAPS
   *      the candidate was in neither the previous nor the next set, so
   *      potato and tomatoes (both Solanaceae) could share a bed at once.
   *   2. Shadowing — any unrelated course merely ENDING inside the gap hid an
   *      earlier same-family course: green beans sailed past a peas history
   *      because a lettuce that overlapped the peas ended one month later.
   * The candidate is therefore checked against EVERY relevant course, not one
   * per side: a same-family course overlapping the candidate is always a
   * repeat, and on each side the whole CO-OCCUPANT SET of the nearest course
   * is the neighbour — every course still in the ground after the nearest
   * previous course STARTED (mirrored for the next side). A course that fully
   * succeeded an earlier one (carrots entering as the cabbage left, holding
   * the bed for months) still resets the family sequence exactly as before;
   * a course that merely co-occupied the earlier one's tail and outlived it
   * by a month no longer hides it. Same immediate-chronological-neighbour
   * semantics the audit doc documents, no invented gap length. */
  private wouldRepeat(bedId: string, crop: CropDef, sowMonth: number): boolean {
    if (!this.rotateCrops) return false;
    const candidate = this.slotFor(crop, sowMonth, false);
    const family = candidate.family;
    const others: ProjectedRotationSlot[] = (this.slotsByBed.get(bedId) ?? [])
      .flatMap((slot) => slot.existing
        ? [{ ...slot, cycleShift: 0 as const }]
        : [-12, 0, 12].map((shift) => ({
          ...slot,
          cycleShift: shift as -12 | 0 | 12,
          startOffset: slot.startOffset + shift,
          endOffset: slot.endOffset + shift,
        })));
    // Overlapping cohorts of this SAME crop are one course. Once the first
    // cohort has actually released the bed, a following crop is a new course
    // even when it starts in the next calendar month; treating adjacency as
    // overlap silently allowed back-to-back monoculture while "Rotate crops"
    // was on.
    let courseStart = candidate.startOffset;
    let courseEnd = candidate.endOffset;
    const merged = new Set<ProjectedRotationSlot>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const slot of others) {
        if (merged.has(slot) || slot.cropKey !== crop.key) continue;
        if (slot.startOffset > courseEnd || slot.endOffset < courseStart) continue;
        merged.add(slot);
        courseStart = Math.min(courseStart, slot.startOffset);
        courseEnd = Math.max(courseEnd, slot.endOffset);
        changed = true;
      }
    }
    const neighbours = others.filter((slot) => !merged.has(slot));
    // A same-family course held at the SAME TIME as the candidate is the
    // repeat risk in its most concentrated form; no neighbour ordering can
    // excuse it.
    if (neighbours.some((slot) => slot.family === family
      && slot.startOffset <= courseEnd && slot.endOffset >= courseStart)) {
      return true;
    }
    // A future proposal copied to -12 is not evidence about what the farmer
    // actually grew. It used to sit one month nearer than a supplied history
    // row and licensed green beans -> green beans and green beans -> peas.
    // Prefer real history and current-cycle proposal courses when finding the
    // nearest neighbour; use a shifted copy only when no real one exists,
    // preserving annual-wrap checks.
    const isReal = (slot: ProjectedRotationSlot): boolean =>
      slot.existing || slot.cycleShift === 0;
    const nearestBy = (pool: ProjectedRotationSlot[], better: (a: ProjectedRotationSlot, b: ProjectedRotationSlot) => number) => {
      const sorted = [...pool].sort(better);
      return sorted.find(isReal) ?? sorted[0];
    };
    // Previous side: the nearest previous course plus every course still in
    // the ground after it started — its co-occupants — are all neighbours.
    const previousPool = neighbours.filter((slot) => slot.endOffset < courseStart);
    const previous = nearestBy(previousPool, (a, b) => b.endOffset - a.endOffset);
    if (previous && previousPool.some((slot) => slot.family === family
      // Strict >: a course that ENDED exactly when the neighbour started was
      // fully succeeded by it, not a co-occupant. The neighbour itself always
      // blocks (a one-month course has start === end and needs the explicit
      // self case).
      && (slot === previous || slot.endOffset > previous.startOffset))) {
      return true;
    }
    // Next side, mirrored: the nearest next course and everything already in
    // the ground before it ends.
    const nextPool = neighbours.filter((slot) => slot.startOffset > courseEnd);
    const next = nearestBy(nextPool, (a, b) => a.startOffset - b.startOffset);
    if (next && nextPool.some((slot) => slot.family === family
      && (slot === next || slot.startOffset < next.endOffset))) {
      return true;
    }
    return false;
  }

  /** A hard rotation veto unless every exact crop choice belongs to this one
   * family. In that constrained case substituting an unchosen crop would be a
   * worse lie, so the exact choice wins and recordUse logs the fallback. */
  repeats(bedId: string, crop: CropDef, sowMonth: number): boolean {
    if (!this.wouldRepeat(bedId, crop, sowMonth)) return false;
    return this.exactFallbackFamily !== rotationFamilyOf(crop);
  }

  recordUse(bedId: string, crop: CropDef, sowMonth: number) {
    if (this.wouldRepeat(bedId, crop, sowMonth)
      && this.exactFallbackFamily === rotationFamilyOf(crop)) {
      this.fallbackBeds.set(bedId, rotationFamilyOf(crop));
    }
    this.lastBedId = bedId;
    this.addSlot(bedId, this.slotFor(crop, sowMonth, false));
  }

  /** Record a one-time first-season starter placed during THIS run.
   *
   * The same treatment the constructor gives a starter loaded from saved data:
   * forward-anchored, but marked existing so wouldRepeat compares it as the one
   * real course it is. Logged through recordUse instead, its ±12 annual
   * projections would have it competing with itself a year out and could veto a
   * later starter that is genuinely legal — understating how much bare ground
   * the pass could honestly have filled, which is the whole point of the pass. */
  recordOnceUse(bedId: string, crop: CropDef, sowMonth: number) {
    this.lastBedId = bedId;
    this.addSlot(bedId, { ...this.slotFor(crop, sowMonth, false), existing: true });
  }

  fallbackNotes(beds: readonly PlanBed[]): string[] {
    const bedsByFamily = new Map<RotationFamily, string[]>();
    for (const [bedId, family] of this.fallbackBeds) {
      const bed = beds.find((candidate) => candidate.id === bedId);
      const labels = bedsByFamily.get(family) ?? [];
      labels.push(bed?.label ?? bedId);
      bedsByFamily.set(family, labels);
    }
    return [...bedsByFamily.entries()].map(([family, labels]) => {
      const where = labels.length <= 3 ? labels.join(', ') : `${labels.length} beds`;
      return `${where}: every exact crop you selected is in the ${ROTATION_FAMILY_META[family].label} family, so Rotate crops could not supply a different-family neighbour. The planner kept your chosen crop rather than substituting one you did not choose.`;
    });
  }
}

/**
 * What actually stopped a PARTIAL_FIT from being an OK. Recorded rather than
 * guessed because the old farmer-facing copy asserted one specific cause —
 * "beds are full" — for every partial outcome, including the case where the
 * bed was empty eleven months of twelve and a correct rotation veto was the
 * only thing in the way (2026-08-19 audit, Mbombela repro).
 */
type SuccessionBlock = 'rotation' | 'space' | 'both';

function combineBlock(
  previous: SuccessionBlock | undefined,
  next: SuccessionBlock,
): SuccessionBlock {
  if (!previous || previous === next) return next;
  return 'both';
}

interface SuccessionOutcome {
  plantings: Planting[];
  // 'DELAYED_START' was removed 2026-08-20. It was returned only when
  // `nearest.gap > PLAN_HORIZON_MONTHS`, and monthsForward can only return
  // 0..11 while PLAN_HORIZON_MONTHS is 11 — so the branch was unreachable and
  // measured at zero occurrences across 26,640 generated plans. laterThisYear
  // is now derived once, at the end of autoSuggestPlan, from what actually
  // ended up in the ground.
  status: 'OK' | 'PARTIAL_FIT' | 'NO_WINDOW';
  /** Only meaningful with status 'PARTIAL_FIT'. */
  blockedBy?: SuccessionBlock;
}

/**
 * Stagger one crop's sowings across consecutive months within its NEAREST
 * valid window (never across a disjoint gap), round-robining across the
 * beds it's allowed to use. The occupancy ledger naturally caps how many
 * cohorts actually fit — a crop given only one bed self-limits to however
 * many successions that bed can hold before a batch would push a month over
 * 100% committed, no special-casing needed.
 */
function planSuccession(
  crop: CropDef,
  pattern: RainPattern,
  bedsForCrop: PlanBed[],
  occupancy: Occupancy,
  nowMonth: number,
  wholeBed: boolean,
  rhythm: HarvestRhythm,
  fractionIfShared: number,
  rotation: BedRotation,
  permitFractionalBatches = true,
  /**
   * "A few big harvests" means ONE COHORT per crop — it never meant one
   * planting for the whole farm. Commercial concentration area-balances a
   * GROUP of beds onto each focus crop, and the single-placement loop below
   * then filled the first bed that fitted and silently abandoned every other
   * bed in that crop's group for the entire twelve months (2026-08-19 audit,
   * Springbok 14-bed repro: 2 plantings, 12 empty beds, no note). With this
   * flag the one cohort is the crop going into ALL of its assigned beds
   * together, each at its own earliest legal sow month — still at most one
   * planting per bed per year, so the no-monthly-filler promise is untouched.
   *
   * Off by default, and deliberately NOT inferred from `wholeBed`: the family
   * breadth-first pass also uses whole-bed few-big placements, and there the
   * round-robin outer loop hands the unused beds to the next crop in the
   * queue rather than stranding them, so its one-cohort-per-crop semantics
   * are correct as they stand.
   */
  synchronizedGroupCohort = false,
): SuccessionOutcome {
  const clusters = clusterSowMonths(crop.sowMonths[pattern]);
  // THE choke point for automatic place compatibility. Every allocation route
  // reaches a bed through here, so plot-only maize cannot leak through a later
  // gap-fill pass.
  bedsForCrop = bedsForCrop.filter((bed) => supportsAutomaticPlacement(crop, bed));
  if (!clusters.length || !bedsForCrop.length) return { plantings: [], status: 'NO_WINDOW' };

  let nearestCluster = clusters[0];
  let nearest = nearestEntry(nowMonth, clusters[0].months);
  for (const c of clusters.slice(1)) {
    const e = nearestEntry(nowMonth, c.months);
    if (e.gap < nearest.gap) { nearest = e; nearestCluster = c; }
  }
  // (No horizon rejection here: monthsForward is 0..11 and PLAN_HORIZON_MONTHS
  // is 11, so every cluster entry is inside the plan year by construction.)

  // A sourced sow window plus actual bed occupancy decide how many cohorts can
  // fit. The former 4/3/2/1 caps were generic bands with no crop authority.
  // "Few big" is the one explicit farmer request that limits this to one.
  const cap = rhythm === 'few-big' ? 1 : nearestCluster.months.length;

  const startIdx = nearestCluster.months.indexOf(nearest.month);
  // NOT capped by bedsForCrop.length — a fast crop can cycle back through the
  // SAME bed for a later cohort once the earlier one has been harvested (the
  // round-robin bed search below, combined with occupancy.fits, already
  // guarantees no double-booking); capping the attempt count by bed count
  // was silently under-using capacity whenever there were fewer beds than
  // the crop's own succession cap, even when a bed would free up in time.
  const nearestWindowMonths = nearestCluster.months.slice(startIdx);
  // "Few big" asks for one successful cohort, not one attempt. If an observed
  // crop already occupies every remaining month in the current sow window,
  // stopping after the nearest blocked month turns a legal later-season crop
  // into an empty plan. Probe the rest of the twelve-month horizon in real
  // chronological order and stop as soon as the one requested cohort fits.
  const sowMonthsToTry = rhythm === 'few-big'
    ? [...new Set(clusters.flatMap((cluster) => cluster.months))]
      .filter((month) => monthsForward(nowMonth, month) <= PLAN_HORIZON_MONTHS)
      .sort((a, b) => monthsForward(nowMonth, a) - monthsForward(nowMonth, b))
    : nearestWindowMonths.slice(0, cap);
  const numBatches = Math.min(sowMonthsToTry.length, cap);

  // A whole-bed crop with more than one batch claiming the FULL bed per
  // batch can never overlap with its own next batch — each cohort has to
  // completely finish (sow→harvest span) before the next can start, so a
  // multi-month sow window collapses to a few widely-spaced cycles with a
  // dead gap between them (confirmed live: a cucumber bed sowing once in
  // Sep, sitting empty Oct-Nov, resowing in Dec). Splitting each batch to a
  // matching preset share instead lets successive cohorts overlap in time — the
  // classic "staggered succession" technique for a continuously-available
  // harvest instead of one big flush then a gap. Single-batch whole-bed
  // crops (numBatches===1 — onions, garlic) are unaffected: there's nothing
  // to stagger against. Genuinely space-hungry vines (isSpaceHungry) are
  // ALSO excluded even with numBatches>1 — that classification means the
  // plant physically needs the full bed's ground while it's growing (that's
  // the whole reason it's "space-hungry"), so two sprawling half-bed vines
  // "overlapping" on paper would actually smother each other in the ground.
  const perBatchFraction = wholeBed
    ? (permitFractionalBatches && numBatches > 1 && !isSpaceHungry(crop)
      ? closestPreset(1 / numBatches)
      : 1)
    : fractionIfShared;

  const plantings: Planting[] = [];
  let blockedBy: SuccessionBlock | undefined;

  // ONE COHORT, ACROSS THE WHOLE GROUP — see synchronizedGroupCohort above.
  if (synchronizedGroupCohort && rhythm === 'few-big' && wholeBed && bedsForCrop.length > 1) {
    for (const bed of bedsForCrop) {
      for (const sowMonth of sowMonthsToTry) {
        if (rotation.repeats(bed.id, crop, sowMonth)) {
          blockedBy = combineBlock(blockedBy, 'rotation');
          continue;
        }
        const share = usableShare(occupancy, bed, sowMonth, crop, perBatchFraction, 1, true);
        if (share === null) {
          blockedBy = combineBlock(blockedBy, 'space');
          continue;
        }
        occupancy.add(bed.id, sowMonth, crop, share);
        const areaFraction = share < 1 ? share : undefined;
        plantings.push({
          id: plantingId(bed.id, crop.key, sowMonth, areaFraction),
          bedId: bed.id,
          cropKey: crop.key,
          sowMonth,
          areaFraction,
        });
        rotation.recordUse(bed.id, crop, sowMonth);
        break; // this bed has had its one planting for the year
      }
    }
    return plantings.length < bedsForCrop.length
      ? { plantings, status: 'PARTIAL_FIT', blockedBy: blockedBy ?? 'space' }
      : { plantings, status: 'OK' };
  }

  let bedCursor = rotation.nextIndex(bedsForCrop);
  for (const sowMonth of sowMonthsToTry) {
    if (plantings.length >= numBatches) break;
    let placed = false;
    for (let i = 0; i < bedsForCrop.length; i++) {
        const bed = bedsForCrop[(bedCursor + i) % bedsForCrop.length];
        if (rotation.repeats(bed.id, crop, sowMonth)) {
          blockedBy = combineBlock(blockedBy, 'rotation');
          continue;
        }
        // A plot never hosts a fraction (see fractionPresetsFor) — today's callers only
        // reach a plot with whole-area placements, so this is armour, not a live branch.
        if (bed.kind === 'plot' && perBatchFraction < 1) continue;
        // Step down the ladder rather than strand a strip too narrow to plant —
        // see usableShare. A batch slice is computed from the batch COUNT and
        // knows nothing about what is already in the bed, which is where most
        // of a big site's unplantable strips came from.
        const share = usableShare(occupancy, bed, sowMonth, crop, perBatchFraction, 1, true);
        if (share !== null) {
          occupancy.add(bed.id, sowMonth, crop, share);
          const areaFraction = share < 1 ? share : undefined;
          plantings.push({
            id: plantingId(bed.id, crop.key, sowMonth, areaFraction),
            bedId: bed.id,
            cropKey: crop.key,
            sowMonth,
            areaFraction,
          });
          rotation.recordUse(bed.id, crop, sowMonth);
          bedCursor = (bedCursor + i + 1) % bedsForCrop.length;
          placed = true;
          break;
        }
        blockedBy = combineBlock(blockedBy, 'space');
    }
  }
  return plantings.length < numBatches
    ? { plantings, status: 'PARTIAL_FIT', blockedBy: blockedBy ?? 'space' }
    : { plantings, status: 'OK' };
}

export function planningWeightBenchmarkScore(crop: CropDef): number {
  // This is a conservative, sourced FRESH-WEIGHT crop-cycle comparison only. Do not
  // annualise it from days-to-first-harvest or an unsourced picking-window
  // duration, and do not call it profit, nutrition, household demand or market
  // demand: the engine is a deterministic prioritiser, not a proof of the
  // globally maximum annual harvest or value.
  return crop.yieldKgPerM2 ?? 0;
}

const commercialScore = planningWeightBenchmarkScore;

/**
 * Breadth-first variety selection across food groups, sharing beds by
 * fraction — the household-bed portion of both family and hybrid modes.
 * Always plans as goal='family' internally (no continuous-supply floor)
 * regardless of which of the two callers it came from; hybrid's own
 * The sale-bed allocation is layered on by the caller using
 * whatever beds this leaves untouched — see autoSuggestPlan's hybrid branch.
 */
function runFamilyBreadthFirst(
  pool: CropDef[],
  sharedBeds: PlanBed[],
  selectedGroups: Set<FoodGroup> | null,
  pattern: RainPattern,
  occupancy: Occupancy,
  nowMonth: number,
  rhythm: HarvestRhythm,
  rotation: BedRotation,
  allowMixedCropsInBed: boolean,
): { plantings: Planting[] } {
  const plantings: Planting[] = [];
  if (!sharedBeds.length) return { plantings };

  const sharedFraction = allowMixedCropsInBed
    ? (sharedBeds.length <= 1 ? 1 : sharedBeds.length === 2 ? 0.5 : closestPreset(1 / 3))
    : 1;
  const activeGroups = GROUP_PRIORITY.filter((g) => !selectedGroups || selectedGroups.has(g));
  const queues = new Map<FoodGroup, CropDef[]>(
    activeGroups.map((g) => [g, pool.filter((c) => foodGroupOf(c) === g && !isSpaceHungry(c)).sort((a, b) => commercialScore(b) - commercialScore(a))]),
  );
  const queuedCropCount = [...queues.values()].reduce((total, queue) => total + queue.length, 0);
  // With bed sharing off, a crop may use whole beds but must not interpret
  // `sharedBeds` as permission to take the whole garden before the next exact
  // crop gets a turn. Divide the initial bed opportunities across the farmer's
  // viable choices; later gap passes can still add legal successions. This is
  // an allocation guard, not an agronomic area prescription.
  const wholeBedQuota = Math.max(1, Math.ceil(sharedBeds.length / Math.max(1, queuedCropCount)));

  // Every crop in the farmer's exact list gets a chance. The old loop converted
  // household headcount into an arbitrary 1/2/3-round budget (and then ran one
  // extra round because of an off-by-one), even though KZN guidance says crop
  // number and area depend on actual demand, land, water and labour. The farmer
  // now supplies demand through the exact crop list; occupancy and sow windows
  // decide what can fit.
  while (true) {
    let anyQueueHasItems = false;
    for (const g of activeGroups) {
      const queue = queues.get(g)!;
      if (!queue.length) continue;
      anyQueueHasItems = true;
      const crop = queue.shift()!;
      const wholeBed = !allowMixedCropsInBed || sharedBeds.length === 1;
      const bedsForCrop = allowMixedCropsInBed
        ? sharedBeds
        : Array.from({ length: Math.min(wholeBedQuota, sharedBeds.length) }, (_, index) =>
          sharedBeds[(rotation.nextIndex(sharedBeds) + index) % sharedBeds.length]);
      const outcome = planSuccession(
        crop,
        pattern,
        bedsForCrop,
        occupancy,
        nowMonth,
        wholeBed,
        rhythm,
        sharedFraction,
        rotation,
        allowMixedCropsInBed,
      );
      if (outcome.status === 'NO_WINDOW') continue;
      plantings.push(...outcome.plantings);
    }
    if (!anyQueueHasItems) break;
  }
  return { plantings };
}

/**
 * Rank the pool by sourced conservative kg/m² per crop cycle and concentrate
 * on the top N crops, one
 * whole bed (or several, area-balanced) per crop — the sale-bed
 * mechanism shared by commercial mode (over ALL shared beds) and hybrid mode
 * (over whatever's left after feeding the family first).
 */
function runCommercialConcentration(
  pool: CropDef[],
  targetBeds: PlanBed[],
  focusCropCount: number,
  pattern: RainPattern,
  occupancy: Occupancy,
  nowMonth: number,
  rhythm: HarvestRhythm,
  rotation: BedRotation,
): { plantings: Planting[]; notes: PlanNote[] } {
  const notes: PlanNote[] = [];
  const plantings: Planting[] = [];
  notes.push(planNote('basis', 'Commercial ranking compares conservative fresh-weight kg/m² per crop cycle only. It does not estimate profit, nutrition, buyer demand or a global annual maximum; use your own buyer and price information before committing land.'));

  const requestedFocus = Number.isFinite(focusCropCount) && focusCropCount > 0
    ? Math.floor(focusCropCount)
    : 1;
  const focusN = Math.min(requestedFocus, targetBeds.length || 1);
  if (requestedFocus > focusN) {
    notes.push(planNote('choice', `You asked to focus on ${requestedFocus} crops, but only ${focusN} bed${focusN === 1 ? ' is' : 's are'} free — prioritised ${focusN} using the conservative kg/m² crop-cycle benchmarks instead.`));
  }
  const viable = pool.filter((crop) =>
    targetBeds.some((bed) => supportsAutomaticPlacement(crop, bed))
    && crop.sowMonths[pattern].some((month) => monthsForward(nowMonth, month) <= PLAN_HORIZON_MONTHS),
  );
  const ranked = [...viable].sort((a, b) => commercialScore(b) - commercialScore(a));
  const focusCrops = ranked.slice(0, focusN);
  if (!focusCrops.length) {
    notes.push(planNote('warning', 'None of the crops you chose could be placed this round — either their sowing window does not come round in time, or no growing area on your map has the right shape for them. Check the local window or add a crop by hand; this is not proof that the crop cannot grow here.'));
    return { plantings, notes };
  }

  // Constrained-first area balance. This remains generic even though maize is
  // currently the only crop with a plot-only automatic placement rule: future
  // layout authorities must not let assignment order strand a valid crop.
  const areaByCrop = new Map(focusCrops.map((c) => [c.key, 0]));
  const bedsByCrop = new Map<string, PlanBed[]>(focusCrops.map((c) => [c.key, []]));
  const compatibleFocus = (bed: PlanBed): CropDef[] => focusCrops.filter((crop) => supportsAutomaticPlacement(crop, bed));
  const orderedBeds = [...targetBeds].sort((a, b) =>
    compatibleFocus(a).length - compatibleFocus(b).length
    || b.areaM2 - a.areaM2);
  for (const bed of orderedBeds) {
    const compatible = compatibleFocus(bed);
    if (!compatible.length) {
      notes.push(planNote('gap', `No crop fits the shape of ${bed.label} among the focus crops you chose, so it was left for you to plant by hand.`, [bed.id]));
      continue;
    }
    const leastCrop = compatible.reduce((a, b) => (areaByCrop.get(a.key)! <= areaByCrop.get(b.key)! ? a : b));
    bedsByCrop.get(leastCrop.key)!.push(bed);
    areaByCrop.set(leastCrop.key, areaByCrop.get(leastCrop.key)! + bed.areaM2);
  }
  const assignedBeds: PlanBed[] = [];
  for (const crop of focusCrops) {
    const cropBeds = bedsByCrop.get(crop.key) ?? [];
    if (!cropBeds.length) continue;
    assignedBeds.push(...cropBeds);
    const outcome = planSuccession(
      crop,
      pattern,
      cropBeds,
      occupancy,
      nowMonth,
      true,
      rhythm,
      1,
      rotation,
      true,
      // One cohort per crop must mean the crop going into all of its assigned
      // beds together, not one bed and eleven months of silence on the rest.
      true,
    );
    if (outcome.status === 'NO_WINDOW') {
      notes.push(planNote('warning', crop.sowMonths[pattern].length
        ? `${crop.name} has a sowing window here, but none of the growing areas set aside for it is the right shape or width for it.`
        : `${crop.name} has no sowing window recorded for this rainfall pattern in the current catalog; confirm locally rather than treating that as agronomic impossibility.`));
      continue;
    }
    // CAUSE-HONEST. The old single sentence asserted "beds are full" for every
    // partial outcome — including a single empty bed whose only obstacle was a
    // correct rotation veto on the one focus crop (2026-08-19 audit, Mbombela
    // repro: the bed was free eleven months of twelve).
    if (outcome.status === 'PARTIAL_FIT') {
      const reach = outcome.plantings.length
        ? `${crop.name} could not take every growing area set aside for it`
        : `${crop.name} could not be placed on any of the growing areas set aside for it`;
      notes.push(planNote('warning', outcome.blockedBy === 'rotation'
        ? `${reach} — crop rotation ruled it out there, because the same botanical family was grown on that ground too recently.`
        : outcome.blockedBy === 'space'
          ? `${reach} — what is already in the ground fills those beds right through ${crop.name}'s sowing windows this year.`
          : `${reach} — crop rotation and what is already in the ground both limited where it can go this year.`));
    }
    plantings.push(...outcome.plantings);
  }

  // ---- beds assigned to a focus crop that ended up with nothing ------------
  // The area balance above hands every target bed to exactly one focus crop.
  // When that crop cannot use a bed, the bed is not "spare" — it is silently
  // abandoned for the whole plan year unless something else claims it. Try the
  // OTHER focus crops the farmer chose (never a crop they did not choose: the
  // app's job here is honesty and farmer agency, not quietly widening their
  // focus), then name every bed still empty and say why.
  //
  // FEW-BIG ONLY, deliberately. Under 'steady' the closing passes still run
  // over the whole farm (ensureSowingCadence + fillRemainingGaps, drawing from
  // the same focus-crop pool) and reportStillRestingBeds already names whatever
  // is left bare — so a stranded bed there is neither abandoned nor unexplained.
  // Claiming it here first measured strictly WORSE: a whole-bed rescue cohort
  // pre-empted the finer fractional successions those passes would have laid
  // down (a 5-bed summer commercial farm lost its second cohort on Bed 5).
  // Under 'few-big' none of those passes runs at all, which is exactly why the
  // beds vanished silently in the first place.
  const plantedBedIds = new Set(plantings.map((planting) => planting.bedId));
  const stranded = rhythm === 'few-big'
    ? assignedBeds.filter((bed) => !plantedBedIds.has(bed.id))
    : [];
  for (const bed of stranded) {
    for (const crop of focusCrops) {
      if (!supportsAutomaticPlacement(crop, bed)) continue;
      // One whole-bed cohort, exactly like the few-big promise — a rescue pass
      // must not turn a "few big harvests" plan into a succession plan.
      const rescue = planSuccession(
        crop, pattern, [bed], occupancy, nowMonth, true, 'few-big', 1, rotation,
      );
      if (!rescue.plantings.length) continue;
      plantings.push(...rescue.plantings);
      plantedBedIds.add(bed.id);
      notes.push(planNote('choice', `${bed.label} was set aside for a different focus crop that could not use it, so ${crop.name} — also one of your focus crops — took it instead.`, [bed.id]));
      break;
    }
  }
  for (const bed of stranded) {
    if (plantedBedIds.has(bed.id)) continue;
    notes.push(planNote('gap', strandedBedNote(bed, focusCrops, pattern, nowMonth, occupancy, rotation), [bed.id]));
  }
  return { plantings, notes };
}

/**
 * Why one assigned bed ended the commercial pass with nothing in it — read off
 * the same two gates the placement loop just used, PER FOCUS CROP, so the
 * sentence can never name a cause a given crop did not actually hit.
 *
 * 2026-08-19 adversarial audit (6.3% of 3,792 note appearances, 240 cases):
 * the old version pooled rotationBlocked/spaceBlocked across every focus crop
 * before picking a sentence, so a bed where ONE crop was rotation-blocked and
 * a DIFFERENT crop was merely space-blocked still got told "shares a
 * botanical family with every crop" — false for the space-blocked one, and
 * directly contradicting that same crop's own B3 note in the same plan
 * (repro: Bed 02, cabbage rotation-blocked, tomatoes only space-blocked, note
 * claimed rotation blocked both). Cause is now tracked per crop and the
 * sentence only claims what every participating crop actually hit: all of
 * them rotation-blocked, all of them purely space-blocked, or — the honest
 * middle case the old code could never say — a mix of both. Ends with what
 * the farmer can DO about it; the planner deliberately does not fix it by
 * planting a crop they did not choose.
 */
function strandedBedNote(
  bed: PlanBed,
  focusCrops: readonly CropDef[],
  pattern: RainPattern,
  nowMonth: number,
  occupancy: Occupancy,
  rotation: BedRotation,
): string {
  const advice = 'Pick a crop for it by hand, or raise the number of crops you are focusing on.';
  const causes: { rotationBlocked: boolean; spaceBlocked: boolean }[] = [];
  for (const crop of focusCrops) {
    if (!supportsAutomaticPlacement(crop, bed)) continue;
    let rotationBlocked = false;
    let spaceBlocked = false;
    for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
      for (const sowMonth of cluster.months) {
        if (monthsForward(nowMonth, sowMonth) > PLAN_HORIZON_MONTHS) continue;
        if (usableShare(occupancy, bed, sowMonth, crop, 1, 1, true) === null) {
          spaceBlocked = true;
          continue;
        }
        if (rotation.repeats(bed.id, crop, sowMonth)) rotationBlocked = true;
      }
    }
    // Only a crop this loop actually reached a verdict on counts — a crop
    // with no reachable sow month at all says nothing about rotation or
    // space and must not force the bed into the "mixed" branch below.
    if (rotationBlocked || spaceBlocked) causes.push({ rotationBlocked, spaceBlocked });
  }
  if (!causes.length) {
    return `${bed.label} has nothing planted: none of your focus crops has a sowing window that reaches it in the next twelve months. ${advice}`;
  }
  if (causes.every((c) => c.rotationBlocked)) {
    return `${bed.label} has nothing planted: what it has already grown shares a botanical family with every crop in your commercial focus, so Rotate crops blocked all of them here. ${advice}`;
  }
  if (causes.every((c) => c.spaceBlocked && !c.rotationBlocked)) {
    return `${bed.label} has nothing planted: what is already growing in it fills the bed through every sowing window your focus crops have this year. ${advice}`;
  }
  return `${bed.label} has nothing planted: some of your focus crops would repeat this bed's recent family under Rotate crops, and the rest simply could not fit around what is already in the ground. ${advice}`;
}

/**
 * The nearest reachable sow month (from `nowMonth`) whose occupied span
 * covers EVERY winter month — a read-only probe over the crop's own sow
 * windows, not tied to any bed. Returns null if no sow month reaches that far
 * (most of the catalog: no crop has a summer-pattern direct-sow window in
 * June/July at all, so only long-duration crops sown well before winter —
 * onions, garlic — can ever qualify). Deliberately all-or-nothing (a crop
 * that covers only PART of the window doesn't count) — matching the bed-gap
 * check below, which only fires when a bed is EMPTY across the whole window.
 */
/**
 * EVERY sow month whose span covers the whole winter window — not just the one
 * nearest to now. The nearest-only version forced all beds onto the same
 * bridger sow month; returning the full set lets the caller stagger bridgers
 * across beds by sow-month scarcity (see SowCounts), so their harvests don't
 * all end in the same week either.
 */
function winterCoveringSowMonths(
  crop: CropDef,
  pattern: RainPattern,
  nowMonth: number,
): number[] {
  const out: number[] = [];
  for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
    for (const m of cluster.months) {
      if (WINTER_MONTHS.every((winterMonth) =>
        plannedCohortReachesMonth(nowMonth, m, crop, winterMonth))) out.push(m);
    }
  }
  return out;
}

/**
 * Runs once, after every other allocation pass, over the FULL bed list
 * (including space-hungry dedicated beds, which are often empty all winter
 * once their vine is harvested). For any bed sitting completely empty across
 * WINTER_MONTHS, tries to place one bridging planting from a crop whose sow
 * window can reach all the way across the gap. Exact crop choices stay exact:
 * a plot may rest rather than receiving an unchosen staple or cover crop.
 *
 * A candidate's nearest covering sow month can legitimately be up to 11
 * months out (monthsForward wraps mod 12) — e.g. asked in June, onions'
 * only covering window is next March. That used to be routed to
 * laterThisYear and NOT planted — which made this pass a guaranteed no-op
 * whenever it ran between June and September (every covering sow month is
 * then 6-11 months forward), the engine-side half of "half the garden rests
 * all winter". The plan is a repeating annual cycle and the owner has
 * explicitly authorised sowings that flow into the next season, so a
 * far-out bridging sowing is now COMMITTED like any other planting — its
 * sow month shows on the timeline's forward columns, exactly like
 * fillRemainingGaps' own 11-month-horizon placements. laterThisYear remains
 * only as a guard beyond the shared horizon (unreachable today: mod-12
 * forward distance never exceeds 11).
 */
/**
 * KZN DARD explicitly documents oats as a winter cover in MAIZE LANDS, so the
 * generic family-repeat brake must not overrule that named local practice on a
 * farmer-mapped staple plot. Plot-only and cover-only — and deliberately still
 * a real rotation repeat, which is why every placement site treats it as a LAST
 * RESORT behind any cover that passes rotation outright (see rotationLegalTiered).
 */
function passesViaOatsMaizeLandException(bed: PlanBed, crop: CropDef): boolean {
  return bed.kind === 'plot' && crop.key === 'oats' && isPlotWinterCover(crop);
}

/**
 * The rotation-legal candidates for a bed, in preference order: everything that
 * passes rotation OUTRIGHT first, and only when nothing does, the candidates
 * that pass solely through the oats maize-lands exception above.
 *
 * The leading tier is the fix for a real inversion (2026-08-19 audit,
 * Bloemfontein repro): the sow-scarcity and crop-spread tiebreaks could route
 * OATS onto the plot carrying the maize history — the one plot where oats is
 * the rotation repeat — while broad beans, which is rotation-clean after a
 * cereal, took the clean plot. lib/crop-groups.ts's oats comment describes the
 * opposite pairing, and that pairing is the correct one. Every existing
 * tiebreak survives WITHIN each tier: both partitions keep the caller's
 * incoming order, so this only decides which tier is consulted at all.
 */
function rotationLegalTiered<T extends { crop: CropDef; sowMonth: number }>(
  sortedCandidates: readonly T[],
  bed: PlanBed,
  rotation: BedRotation,
): { picks: T[]; viaException: boolean } {
  const clean = sortedCandidates.filter((candidate) =>
    !rotation.repeats(bed.id, candidate.crop, candidate.sowMonth));
  if (clean.length) return { picks: clean, viaException: false };
  const exception = sortedCandidates.filter((candidate) =>
    passesViaOatsMaizeLandException(bed, candidate.crop));
  return { picks: exception, viaException: exception.length > 0 };
}

/** Said ONCE per plan, naming the plots it actually happened on. A winter cover
 * that is a cereal on cereal ground is a documented local practice, not a
 * silent rule-break, so the farmer gets the source and the manual alternative. */
function oatsMaizeLandNote(plotLabels: readonly string[]): string {
  const where = plotLabels.length <= 3 ? plotLabels.join(', ') : `${plotLabels.length} plots`;
  return `${where}: oats is the winter cover even though a grass-family crop (maize or oats) grew there recently — KZN DARD documents oats as a winter cover in maize lands, and no rotation-clean cover could be placed there. If carrying cereal disease over worries you, swap it for broad beans by hand.`;
}

function backfillWinterGaps(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  sowCounts: SowCounts,
  spread: CropSpread,
  plotsWithCourse: ReadonlySet<string>,
  strictCropKeys?: ReadonlySet<string>,
): {
  plantings: Planting[];
  notes: PlanNote[];
  oatsExceptionBeds: string[];
} {
  const plantings: Planting[] = [];
  const oatsExceptionBeds: string[] = [];
  // Collected rather than pushed one-per-bed: a large farm gets a winter
  // bridger on most of its beds, and twenty near-identical sentences buried
  // the notes that actually needed reading (2026-08-19 audit).
  const bridged: { bed: PlanBed; cropName: string; sowMonth: number; fraction: number }[] = [];

  for (const bed of beds) {
    if (!WINTER_MONTHS.every((mo) => occupancy.fractionAt(bed.id, mo) === 0)) continue;

    // Sow-month SCARCITY leads the sort (see SowCounts): nine winter-empty beds
    // used to pick the same nearest bridger sow month nine times; now each
    // commit bumps the tally, so the next bed prefers a different month and the
    // bridgers' harvests spread across late winter and spring instead of all
    // ending together. Score and nearness only break ties.
    // A plot bridges winter with a staple or its winter cover — never with the cabbage
    // that used to win here on score alone. Veg beds keep the full pool (this pass also
    // covers dedicated vine beds, which are exactly the ones empty all winter).
    const bridgePool = bed.kind === 'plot'
      ? poolForBed(bed, pool, true, plotsWithCourse, strictCropKeys)
      : pool;
    const candidates = bridgePool
      .flatMap((crop) => winterCoveringSowMonths(crop, pattern, nowMonth).map((sowMonth) => ({ crop, sowMonth })))
      .filter((x) => supportsAutomaticPlacement(x.crop, bed))
      .filter((x) => occupancy.fits(bed.id, x.sowMonth, x.crop, 1))
      .sort((a, b) =>
        // On a PLOT the winter slot belongs to the cover crop, ahead of everything else.
        // Without this a staple wins the bridge on score — potato took the May slot on
        // three of four plots — and the plot's own tuber course is then spent before the
        // summer rotation has even started. The cover crop is there precisely so the
        // four staple courses stay free for the season they belong to.
        (bed.kind === 'plot' ? Number(!isPlotWinterCover(a.crop)) - Number(!isPlotWinterCover(b.crop)) : 0)
        || (sowCountAt(sowCounts, a.sowMonth) - sowCountAt(sowCounts, b.sowMonth))
        || (spreadRank(spread, a.crop.key, bed.id) - spreadRank(spread, b.crop.key, bed.id))
        || (commercialScore(b.crop) - commercialScore(a.crop))
        || (monthsForward(nowMonth, a.sowMonth) - monthsForward(nowMonth, b.sowMonth)));

    if (!candidates.length) {
      // No SINGLE crop spans the whole May-Aug range — but that doesn't mean
      // the bed is stuck resting: fillRemainingGaps (which runs after this)
      // can still piece the gap together from several shorter winter-hardy
      // crops. Don't claim "will rest over winter" here — reportStillRestingBeds,
      // run at the very end against the FINAL occupancy, is the honest source
      // of truth for what's actually still empty once every pass has run.
      continue;
    }

    // Rotation-clean covers outrank the oats maize-lands exception — see
    // rotationLegalTiered. Existing tiebreaks still decide within each tier.
    const { picks: nonRepeating, viaException } = rotationLegalTiered(candidates, bed, rotation);
    if (!nonRepeating.length) continue;
    const chosen = nonRepeating[0];
    // (No horizon rejection: monthsForward is 0..11 and GAP_FILL_HORIZON_MONTHS
    // is 11, so winterCoveringSowMonths can only ever return reachable months.)
    // HALF the bed, deliberately (2026-08-04). A full-bed bridger saturates winter at the
    // moment it is placed, so fillRemainingGaps — the only pass that would ever sow IN
    // June/July — found no room, and the plan had winter coverage with zero winter sowings
    // (the owner's "no new planting for jun july"). Half a bed of bridger + half a bed of
    // in-winter succession sowings covers the same months AND keeps fresh food maturing
    // through late winter into the September the bridgers leave bare. Plots stay whole-area
    // by identity (fractionPresetsFor).
    // ...but half only when half leaves something plantable. A half-bed bridger
    // dropped beside an existing third leaves 0.17 — the single biggest source
    // of unplantable strips on a large site, because a big farm gets far more
    // winter bridgers. usableShare keeps the half wherever a half is clean.
    const wantedBridge = bed.kind === 'plot' ? 1 : 0.5;
    const bridgeFraction = usableShare(occupancy, bed, chosen.sowMonth, chosen.crop, wantedBridge);
    if (bridgeFraction === null) continue;
    occupancy.add(bed.id, chosen.sowMonth, chosen.crop, bridgeFraction);
    rotation.recordUse(bed.id, chosen.crop, chosen.sowMonth);
    bumpSow(sowCounts, chosen.sowMonth);
    noteCropBed(spread, chosen.crop.key, bed.id);
    const areaFraction = bridgeFraction < 1 ? bridgeFraction : undefined;
    plantings.push({
      id: plantingId(bed.id, chosen.crop.key, chosen.sowMonth, areaFraction),
      bedId: bed.id,
      cropKey: chosen.crop.key,
      sowMonth: chosen.sowMonth,
      areaFraction,
    });
    if (viaException) oatsExceptionBeds.push(bed.label);
    bridged.push({ bed, cropName: chosen.crop.name, sowMonth: chosen.sowMonth, fraction: bridgeFraction });
  }

  return { plantings, notes: winterBridgeNotes(bridged), oatsExceptionBeds };
}

/**
 * One winter-bridge note per bed while there are only a couple, otherwise a
 * single grouped one.
 *
 * The "leaving room for winter sowings alongside" clause is GONE. It was
 * printed unconditionally, including on plots, where the bridger takes the
 * whole area by identity (fractionPresetsFor) — so the sentence promised room
 * that did not exist on 5,560 of the plans in the 2026-08-19 sweep. Making it
 * conditional on `fraction < 1` was not enough either: this note is written
 * inside backfillWinterGaps, BEFORE fillRemainingGaps runs, and a semantic
 * gate over finished plans found 46 part-area bridges whose other half was
 * then filled for the whole winter by a later pass. The clause could never be
 * true at the moment it was written, so it says nothing about the future now
 * — only what the bridge itself took. The whole-area case still states its own
 * consequence, which IS knowable here: a bed held at full area for a span that
 * covers every winter month has nothing free beside it.
 */
function winterBridgeNotes(
  bridged: readonly { bed: PlanBed; cropName: string; sowMonth: number; fraction: number }[],
): PlanNote[] {
  if (!bridged.length) return [];
  const share = (fraction: number): string =>
    fraction >= 1 ? 'the whole area' : `${Math.round(fraction * 100)}% of it`;
  if (bridged.length <= 2) {
    return bridged.map((entry) => planNote(
      'choice',
      `${entry.bed.label} would otherwise rest all winter — added ${entry.cropName} (sow ${MONTHS_SHORT[entry.sowMonth - 1]})`
      + (entry.fraction >= 1
        ? '. It takes the whole area, so nothing else can be sown in it this winter.'
        : ` to ${share(entry.fraction)}.`),
      [entry.bed.id],
    ));
  }
  // Eight beds taking the same crop in the same month is one sentence, not
  // eight: the grouped note exists to be readable, and an un-compressed list
  // just reproduces the wall it replaced at a smaller size.
  const runs = new Map<string, { cropName: string; sowMonth: number; fraction: number; labels: string[] }>();
  for (const entry of bridged) {
    const key = `${entry.cropName}\u0000${entry.sowMonth}\u0000${entry.fraction}`;
    const run = runs.get(key) ?? { cropName: entry.cropName, sowMonth: entry.sowMonth, fraction: entry.fraction, labels: [] };
    run.labels.push(entry.bed.label);
    runs.set(key, run);
  }
  const lines = [...runs.values()]
    .map((run) => `${run.labels.join(', ')} — ${run.cropName} (sow ${MONTHS_SHORT[run.sowMonth - 1]}, ${run.fraction >= 1 ? 'the whole area' : `${Math.round(run.fraction * 100)}% of ${run.labels.length > 1 ? 'each' : 'it'}`})`)
    .join('; ');
  const anyWhole = bridged.some((entry) => entry.fraction >= 1);
  const anyPart = bridged.some((entry) => entry.fraction < 1);
  const tail = anyWhole
    ? (anyPart
      ? ' Where a crop took the whole area, nothing else can be sown there this winter.'
      : ' Each of these takes the whole area, so nothing else can be sown in them this winter.')
    : '';
  return [planNote(
    'choice',
    `${bridged.length} growing areas would otherwise rest all winter, so a winter crop went in: ${lines}.${tail}`,
    bridged.map((entry) => entry.bed.id),
  )];
}

export interface FirstSeasonFill {
  /** One-time starter plantings, each stamped with `once: 'YYYY-MM'`. */
  starters: Planting[];
  notes: PlanNote[];
}

/**
 * The month-offsets 0..11 — the farmer's REAL first twelve months — at which a
 * cohort sown `sowOffset` months from now would put fresh food on the table.
 *
 * The same arithmetic freshHarvestMonths uses, expressed in real offsets rather
 * than calendar months, because that is the frame the first-season question is
 * asked in: a harvest at offset 12 is next year's, not this year's, and a
 * bridge that lands there bridges nothing. Cover crops and unverified timing
 * yield no food and are excluded exactly as freshHarvestMonths excludes them.
 */
function firstYearFreshOffsets(crop: CropDef, sowOffset: number): number[] {
  if (crop.timingVerified === false || crop.yieldKgPerM2 === 0) return [];
  const delta = planningMaturityMonths(crop.daysToHarvest)
    + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
  const offsets: number[] = [];
  for (let index = 0; index <= (crop.harvestWindowMonths ?? 0); index++) {
    const offset = sowOffset + delta + index;
    if (offset >= 0 && offset <= 11) offsets.push(offset);
  }
  return offsets;
}

/**
 * FIRST-SEASON transition fill — the answer to "huge gaps" in year one of a
 * whole-year plan (2026-08-20, measured on the real 13-area farm the
 * complaint came from).
 *
 * The repeating annual cycle is scored cyclically, so a sowing that wraps the
 * year boundary (July broad beans covering Aug–Nov) counts as coverage — but
 * in the farmer's FIRST year that sowing has not happened yet, and the ground
 * it would cover stands bare. Every one of the 12 anchor months leaves 20–31
 * idle bed-months in year one on that farm; no scoring change can fix what is
 * a structural property of starting a cycle mid-air. So this pass runs on the
 * WINNING cycle only, finds ground that is fully bare during the first twelve
 * real months, and places ONE-TIME starter sowings there from the farmer's
 * own allowed crops — never touching the cycle itself, never recurring.
 *
 * Rules carried over from the engine's own placement passes:
 *  - the candidate pool is built exactly as autoSuggestPlan builds it (exact
 *    crop choices stay exact, otherwise verified yield-backed food crops);
 *  - plots route through poolForBed: a plot whose cycle already has its
 *    staple course only accepts a winter cover here, so a starter can never
 *    spend a staple course the rotation needs later (most plot holes are
 *    2–4 months while the shortest staple needs 5 — they honestly rest,
 *    and the note below says so rather than papering over it), and a starter
 *    that spends a courseless plot's one course claims it here too, so the
 *    same rule holds for the rest of this pass;
 *  - rotation is enforced against real history AND the upcoming cycle via
 *    the same BedRotation/rotationLegalTiered machinery;
 *  - occupancy uses the same bed-hold arithmetic as the printed occupancy
 *    calendar, so a filled hole here is a filled hole on the farmer's PDF.
 */
export function fillFirstSeasonGaps(
  answers: AutoSuggestAnswers,
  pattern: RainPattern,
  beds: PlanBed[],
  cyclePlantings: readonly Planting[],
  existingPlantings: readonly Planting[],
  realNowMonth: number,
  realNowYear: number,
): FirstSeasonFill {
  // The fill BRIDGES a cycle; it is never a plan of its own. An engine run
  // that refused to plan (irrigation unconfirmed, nothing schedulable) must
  // not be second-guessed by a back door that plants anyway.
  if (answers.reliableIrrigation !== true || !cyclePlantings.length) {
    return { starters: [], notes: [] };
  }

  // Provable-free horizon: a starter's whole hold must sit inside it, and it
  // must reach far enough to see the cycle's second year coming (a starter
  // tail that crosses month 12 collides with next year's repeat if occupied).
  const HORIZON = 24;

  // ---- candidate pool: mirror autoSuggestPlan's construction exactly ------
  const selectedGroups = answers.groups.length ? new Set(answers.groups) : null;
  const yieldBackedFood = SCHEDULABLE_CROPS.filter(hasAutomaticPlanningBasis);
  const explicitCropKeys = new Set((answers.cropKeys ?? []).filter(Boolean));
  let pool = explicitCropKeys.size
    ? SCHEDULABLE_CROPS.filter((crop) => explicitCropKeys.has(crop.key))
    : yieldBackedFood.filter((crop) => !selectedGroups || selectedGroups.has(foodGroupOf(crop)));
  if (!pool.length) {
    if (explicitCropKeys.size) return { starters: [], notes: [] };
    pool = yieldBackedFood;
  }
  const strictCropKeys = explicitCropKeys.size ? explicitCropKeys : undefined;
  const exactFamilies = explicitCropKeys.size
    ? new Set(pool.map((crop) => rotationFamilyOf(crop)))
    : new Set<RotationFamily>();
  const exactFallbackFamily = exactFamilies.size === 1 ? [...exactFamilies][0] : null;

  // A plot whose cycle already carries a planting has its courses spoken for.
  // Starters claim into this set as they land, so the placement loop below must
  // read it every turn — it is a live tally, not a snapshot.
  const plotKinds = new Map(beds.map((bed) => [bed.id, bed.kind]));
  const plotsWithCourse = new Set(
    cyclePlantings.filter((p) => plotKinds.get(p.bedId) === 'plot').map((p) => p.bedId),
  );

  // ---- rotation: real history first, then the cycle as upcoming courses ---
  // realNow is supplied unconditionally here: this function already has both
  // realNowMonth and realNowYear as real (never synthetic-anchor) parameters,
  // so a stale `once` row fed straight into rotation history is read as the
  // history it is, not as a sowing still ahead. Closes the residual gap #312
  // explicitly punted on ("Rotation history... reads stale rows through
  // their own paths; neither is this pass's to answer").
  const rotation = new BedRotation(
    existingPlantings, realNowMonth, answers.rotateCrops, exactFallbackFamily,
    { year: realNowYear, month: realNowMonth },
  );
  for (const p of cyclePlantings) {
    const crop = CROPS.find((candidate) => candidate.key === p.cropKey);
    if (crop) rotation.recordUse(p.bedId, crop, p.sowMonth);
  }

  // ---- real-offset occupancy, same arithmetic as the occupancy calendar ---
  // COMMITTED SHARE per offset, not a yes/no. The cycle sows quarter, third and
  // half beds (BED_FRACTION_PRESETS), so a bed carrying one quarter-share crop
  // read as fully spoken for and every starter that would have used the other
  // three quarters was refused. Occupancy.fits — the cycle's own ledger — has
  // always counted shares; this pass was the one place that did not.
  // A `once` row carries the month it was sown IN ITS STAMP. Resolving it with
  // monthsForward instead re-reads a stamp from last October as next October:
  // ground that is already free reads as taken, and — since the coverage
  // ledger below is plan-wide — food already eaten reads as food still coming,
  // which then steers the crop chosen on a DIFFERENT bed. Measured: 46 of 1705
  // single stale-row injections changed the starter set on beds the row never
  // touched. loadCropPlan's settleOnceRows normally converts past `once` rows
  // to existing before they ever arrive here, so this was latent — but nothing
  // in this pass asserted that, and it is the only place where breaking it
  // silently corrupts another bed. A past stamp now yields a NEGATIVE offset,
  // which the horizon guards already drop.
  const onceSowOffset = (stamp: string): number | null => {
    const match = /^(\d{4})-(\d{2})$/.exec(stamp);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) return null;
    return (year * 12 + (month - 1)) - (realNowYear * 12 + (realNowMonth - 1));
  };
  const rowSowOffset = (p: Planting): number => {
    if (typeof p.once === 'string') {
      const fromStamp = onceSowOffset(p.once);
      if (fromStamp !== null) return fromStamp;
    }
    return p.existing
      ? existingSowOffset(p.sowMonth, realNowMonth)
      : monthsForward(realNowMonth, p.sowMonth);
  };

  const occupiedByBed = new Map<string, number[]>();
  const unfillableBeds = new Set<string>();
  const markOccupied = (bedId: string, entry: number, span: number, share = 1): void => {
    let ledger = occupiedByBed.get(bedId);
    if (!ledger) { ledger = Array<number>(HORIZON).fill(0); occupiedByBed.set(bedId, ledger); }
    for (let index = 0; index < span; index++) {
      const offset = entry + index;
      if (offset >= 0 && offset < HORIZON) ledger[offset] += share;
    }
  };
  for (const p of [...existingPlantings, ...cyclePlantings]) {
    const crop = CROPS.find((candidate) => candidate.key === p.cropKey);
    if (!crop || crop.timingVerified === false
      || !Number.isInteger(p.sowMonth) || p.sowMonth < 1 || p.sowMonth > 12) {
      // Ground held by a crop whose months cannot be derived is not provably
      // free anywhere — never place a starter on top of an unknown.
      unfillableBeds.add(p.bedId);
      continue;
    }
    const sowOffset = rowSowOffset(p);
    const entry = sowOffset + bedHoldStartOffsetMonths(crop);
    const span = bedHoldSpanMonths(crop);
    const share = typeof p.areaFraction === 'number' && p.areaFraction > 0 ? p.areaFraction : 1;
    if (p.existing || typeof p.once === 'string') {
      markOccupied(p.bedId, entry, span, share);
    } else {
      for (let start = entry; start < HORIZON; start += 12) markOccupied(p.bedId, start, span, share);
    }
  }

  // ---- what the farmer can already eat, month by month, in year ONE -------
  // The pass below picks the ground it fills by how EMPTY that ground is. Empty
  // ground and an empty plate are not the same question, and only the second is
  // the one this pass exists to answer: measured before this ledger, 84 of 605
  // starters ripened entirely after month 11 (77 of them lettuce) and another
  // 132 ripened only into months the cycle already fed — a third of every
  // starter placed, holding bed-months that a crop feeding a bare month could
  // have had. Seeded from every row already committed, and updated as each
  // starter lands so four beds do not all bridge the same month.
  const freshOffsetsCovered = new Set<number>();
  for (const p of [...existingPlantings, ...cyclePlantings]) {
    const crop = CROPS.find((candidate) => candidate.key === p.cropKey);
    if (!crop || !Number.isInteger(p.sowMonth) || p.sowMonth < 1 || p.sowMonth > 12) continue;
    const sowOffset = rowSowOffset(p);
    for (const offset of firstYearFreshOffsets(crop, sowOffset)) freshOffsetsCovered.add(offset);
  }

  const onceStamp = (sowOffset: number): string => {
    const absolute = realNowYear * 12 + (realNowMonth - 1) + sowOffset;
    return `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, '0')}`;
  };

  const starters: Planting[] = [];
  const added: { bed: PlanBed; cropName: string; sowMonth: number }[] = [];
  const stillBare: { bed: PlanBed; from: number; to: number }[] = [];

  for (const bed of beds) {
    if (unfillableBeds.has(bed.id)) continue;
    let ledger = occupiedByBed.get(bed.id);
    if (!ledger) { ledger = Array<number>(HORIZON).fill(0); occupiedByBed.set(bed.id, ledger); }
    const occupied = ledger;
    // What share of this bed a starter may take across `span` — 0 for none.
    // The mixing gate is the farmer's, and it is the same rule Occupancy.fits
    // applies to the cycle: with mixing OFF a starter still needs the whole
    // bed standing free, so this pass collapses back to its old yes/no
    // behaviour rather than quietly putting a second crop beside the first.
    const shareFor = (entry: number, span: number): number => {
      let worst = 0;
      for (let index = 0; index < span; index++) worst = Math.max(worst, occupied[entry + index] ?? 0);
      if (worst <= BED_SHARE_EPS) return 1;
      if (answers.allowMixedCropsInBed !== true) return 0;
      const room = 1 - worst;
      for (const preset of BED_FRACTION_PRESETS) if (preset <= room + BED_SHARE_EPS) return preset;
      return 0;
    };
    // A long hole can take two short starters back to back, so keep placing
    // until nothing legal fits. Each placement occupies ≥1 offset, so this
    // terminates within the horizon.
    for (;;) {
      // Re-derived every turn: a starter that spends this plot's staple course
      // below must narrow the pool to covers for the next turn. Hoisted out of
      // this loop it was a snapshot taken before any starter landed, so a
      // courseless plot kept drawing on the full staple pool turn after turn and
      // could spend TWO courses (measured: potato Aug + dry beans Jan; and with
      // rotation off, potato twice over) — the exact spend poolForBed's own
      // comment exists to prevent.
      const bedPool = poolForBed(bed, pool, answers.allowVinesInBeds, plotsWithCourse, strictCropKeys);
      // Read every turn for the same reason bedPool is: a starter that lands
      // below closes months, and the next turn must be judged against that.
      const newFreshMonths = (candidate: { freshOffsets: number[] }): number =>
        candidate.freshOffsets.filter((offset) => !freshOffsetsCovered.has(offset)).length;
      const candidates = bedPool
        .flatMap((crop) => [...new Set(crop.sowMonths[pattern] ?? [])].map((sowMonth) => ({ crop, sowMonth })))
        .filter((candidate) => supportsAutomaticPlacement(candidate.crop, bed))
        .map((candidate) => {
          const sowOffset = monthsForward(realNowMonth, candidate.sowMonth);
          return {
            ...candidate,
            sowOffset,
            entry: sowOffset + bedHoldStartOffsetMonths(candidate.crop),
            span: bedHoldSpanMonths(candidate.crop),
          };
        })
        // First season only: the hold must START inside the first twelve real
        // months, and every month it takes must be provably bare — including
        // any tail that crosses into the cycle's second year.
        .filter((candidate) => candidate.entry <= 11 && candidate.entry + candidate.span <= HORIZON)
        .map((candidate) => ({
          ...candidate,
          freshOffsets: firstYearFreshOffsets(candidate.crop, candidate.sowOffset),
        }))
        .filter((candidate) => shareFor(candidate.entry, candidate.span) > 0)
        .sort((a, b) =>
          // Plots: the cover crop owns the slot (same reasoning as the winter
          // bridger). Beds: fresh food outranks a zero-yield cover.
          (bed.kind === 'plot'
            ? Number(!isPlotWinterCover(a.crop)) - Number(!isPlotWinterCover(b.crop))
            : Number(a.crop.yieldKgPerM2 === 0) - Number(b.crop.yieldKgPerM2 === 0))
          // MONTHS THE FARMER WOULD OTHERWISE NOT EAT — the whole point of the
          // pass, so it leads. Without it the two keys below decided alone, and
          // "earliest, then shortest" is a race about GROUND: on the reference
          // farm they picked an August lettuce (hold 8-12, ripe at 12) over an
          // August chard (hold 7-12, ripe 9-12) because lettuce's hold was one
          // month shorter — spending the bed's last four months on a harvest
          // that arrives after the farmer's first year is over, while three
          // bare months sat behind it. Ties still fall through to the old
          // order, so nothing changes where coverage is equal.
          || (bed.kind === 'plot' ? 0 : newFreshMonths(b) - newFreshMonths(a))
          // Earliest start closes the emptiest early months first (the farmer
          // is standing in front of bare ground TODAY)…
          || (a.sowOffset - b.sowOffset)
          // …then the shorter hold, freeing room for a second starter.
          || (a.span - b.span)
          || (commercialScore(b.crop) - commercialScore(a.crop))
          || a.crop.key.localeCompare(b.crop.key));
      const { picks } = rotationLegalTiered(candidates, bed, rotation);
      if (!picks.length) break;
      const chosen = picks[0];
      const share = shareFor(chosen.entry, chosen.span);
      for (const offset of chosen.freshOffsets) freshOffsetsCovered.add(offset);
      for (let index = 0; index < chosen.span; index++) occupied[chosen.entry + index] += share;
      // A starter is one-time, so it is recorded as one real course rather than
      // an annually repeating one — see recordOnceUse.
      rotation.recordOnceUse(bed.id, chosen.crop, chosen.sowMonth);
      // ONE COURSE PER PLOT, starters included. rotationLegalTiered only bars a
      // FAMILY repeat, so nothing stopped two unlike courses on one courseless
      // plot. A winter cover is NOT a course and must not claim: the sort above
      // deliberately lets the cover take the slot first, so claiming on any
      // starter would cost the plot the one food course it is still owed
      // (measured: 96 of 144 configs drop to zero food courses under that rule).
      if (bed.kind === 'plot' && stapleCourseOf(chosen.crop)) plotsWithCourse.add(bed.id);
      starters.push({
        id: `auto:starter:${encodeURIComponent(bed.id)}:${encodeURIComponent(chosen.crop.key)}:${chosen.sowMonth}`,
        bedId: bed.id,
        cropKey: chosen.crop.key,
        sowMonth: chosen.sowMonth,
        // Only stamped when it is really a share — a whole-bed starter keeps
        // the shape it has always had, so nothing downstream sees a change.
        ...(share < 1 ? { areaFraction: share } : {}),
        once: onceStamp(chosen.sowOffset),
      });
      added.push({ bed, cropName: chosen.crop.name, sowMonth: chosen.sowMonth });
    }
    // What honestly remains bare in year one on this ground (runs ≥ 2 months
    // are worth a sentence; a single bare month between crops is normal turn-
    // around and naming it would bury the real message).
    let runStart = -1;
    for (let offset = 0; offset <= 12; offset++) {
      const bare = offset < 12 && (occupied[offset] ?? 0) <= BED_SHARE_EPS;
      if (bare && runStart < 0) runStart = offset;
      if (!bare && runStart >= 0) {
        if (offset - runStart >= 2) stillBare.push({ bed, from: runStart, to: offset - 1 });
        runStart = -1;
      }
    }
  }

  return { starters, notes: firstSeasonFillNotes(realNowMonth, added, stillBare) };
}

/** Grouped like winterBridgeNotes: a couple of starters read individually, a
 * fleet reads as one sentence. The rest note names what stays bare and WHY in
 * farmer terms — the repeating plan's own crops arrive too late this first
 * year, and nothing chosen both suits that ground and finishes in time.
 *
 * TRUTHFUL ABOUT WHAT "NEXT YEAR" MEANS. Every closing sentence here used to
 * promise "from next year the repeating plan covers it" — but cyclePlantings
 * is seeded into the SAME ledger this function reads with a fixed 12-month
 * repeat (see fillFirstSeasonGaps above): whatever calendar months it does or
 * doesn't occupy this year, it does or doesn't occupy identically every year
 * after, because this codebase has no year-over-year variation in the
 * repeating plan. A starter or a stillBare stretch only ever reaches this
 * code because the cycle already failed to reach that ground — so the cycle
 * structurally cannot be the thing that closes the gap next year either.
 * (2026-08-22, second-opinion review of the Ubhejane Crèche PDF: Plot 1's
 * printed "from next year the repeating plan covers them" was false for its
 * Jun–Dec rest — and re-reading this function found the same false premise
 * baked into every sentence here, not just that one.) */
function firstSeasonFillNotes(
  realNowMonth: number,
  added: readonly { bed: PlanBed; cropName: string; sowMonth: number }[],
  stillBare: readonly { bed: PlanBed; from: number; to: number }[],
): PlanNote[] {
  const notes: PlanNote[] = [];
  const tailLine = 'It runs once, this year only — the repeating plan does not reach these months on its own, so this ground will likely need the same kind of one-off help again next year unless the plan itself changes.';
  if (added.length && added.length <= 2) {
    for (const entry of added) {
      notes.push(planNote(
        'choice',
        `${entry.bed.label} would stand empty early on, so a one-time starter went in: ${entry.cropName} (sow ${MONTHS_SHORT[entry.sowMonth - 1]}). ${tailLine}`,
        [entry.bed.id],
      ));
    }
  } else if (added.length) {
    const runs = new Map<string, { cropName: string; sowMonth: number; labels: string[] }>();
    for (const entry of added) {
      const key = `${entry.cropName} ${entry.sowMonth}`;
      const run = runs.get(key) ?? { cropName: entry.cropName, sowMonth: entry.sowMonth, labels: [] };
      run.labels.push(entry.bed.label);
      runs.set(key, run);
    }
    const lines = [...runs.values()]
      .map((run) => `${run.labels.join(', ')} — ${run.cropName} (sow ${MONTHS_SHORT[run.sowMonth - 1]})`)
      .join('; ');
    notes.push(planNote(
      'choice',
      `${added.length} growing areas would stand empty for part of your first year, so one-time starter sowings went in: ${lines}. Each runs once, this year only — the repeating plan does not reach these months on its own, so expect to sow the same kind of bridge again next year unless the plan itself changes.`,
      added.map((entry) => entry.bed.id),
    ));
  }
  if (stillBare.length) {
    const monthName = (offset: number): string => MONTHS_SHORT[(realNowMonth - 1 + offset) % 12];
    const spans = stillBare
      .map((hole) => `${hole.bed.label} (${monthName(hole.from)}–${monthName(hole.to)})`)
      .join(', ');
    notes.push(planNote(
      'gap',
      `First-year rest: ${spans}. No chosen crop both suits that ground and finishes in time this year — and the repeating plan itself does not reach ${stillBare.length === 1 ? 'this stretch' : 'these stretches'} either, so this is not just a first-year gap: it recurs every year unless the plan itself changes.`,
      stillBare.map((hole) => hole.bed.id),
    ));
  }
  return notes;
}

/**
 * One sowing in every sowable month — the cadence promise, run BETWEEN
 * backfillWinterGaps and fillRemainingGaps while bed room is still plentiful.
 *
 * Why scarcity sorting alone couldn't finish the job: sow spans only run
 * FORWARD, so a June-sown crop occupies July but a July-sown crop never
 * occupies June. The gap-filler (rightly) treats a month as done once it's
 * covered — and every June placement covers July too, so July's room was
 * always consumed by June's sowings before July itself was ever tried ("no
 * new planting for jun july" was literally this shadow). This pass asks the
 * opposite question — not "is the month covered?" but "does anything NEW go
 * into the ground that month?" — and places exactly one modest sowing in each
 * calendar month the plan has none for, catalog and rotation permitting.
 * Fresh food then matures in a steady monthly rhythm instead of arriving in
 * the few big flushes the coverage passes naturally produce.
 *
 * Deliberately modest: half a bed at most (a quarter if that's what fits,
 * whole area only on plots — fractionPresetsFor), one placement per missing
 * month, never displacing anything already planned. Months where nothing in
 * the pool is genuinely sowable are skipped in silence —
 * reportStillRestingBeds remains the only honest voice for real limits.
 */
/**
 * WRAP-TAIL RESERVATION — the months planned LAST can only sow while the rest
 * of the year is still unplanned. The plan year runs nowMonth..nowMonth+11, so
 * every pass hands out shares that cross nowMonth's "wall" first, and by
 * closing-pass time the tail months (May/Jun/Jul when planning from August)
 * find all such shares taken. Measured on the reference farm before this pass:
 * July got ONE sowing farm-wide against August's eight, the lowest mean
 * occupancy of any month (81%), and the only bed-month under 50% — while NINE
 * catalog crops could sow in July under mild frost, every one blocked because
 * its span crosses a full August. The owner, after weeks of winter-tail Gantt
 * reports: "July July July".
 *
 * Each shared bed therefore reserves ONE tail sowing up front — latest month
 * first, modest share — and the main fill packs the rest of the year around
 * it. Cross-bed variety comes from the used-count sort, not chance.
 */
function reserveWrapTailSowings(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  allowVinesInBeds: boolean,
): { plantings: Planting[] } {
  const plantings: Planting[] = [];
  const bedEligiblePool = allowVinesInBeds ? pool : pool.filter((c) => !isSpaceHungry(c));
  const tailMonths = [wrapMonth(nowMonth + 11), wrapMonth(nowMonth + 10), wrapMonth(nowMonth + 9)];
  const used = new Map<string, number>();
  let bedOrdinal = 0;
  for (const bed of beds) {
    if (bed.kind === 'plot') continue;
    // Rotate which tail month each bed starts with — an all-July reservation
    // measured July at 96% while pushing May and June down to 78% each: the
    // wall does not disappear when every bed claims the same month, it moves.
    const startAt = bedOrdinal % tailMonths.length;
    const bedTailMonths = [...tailMonths.slice(startAt), ...tailMonths.slice(0, startAt)];
    bedOrdinal += 1;
    let placed = false;
    for (const m of bedTailMonths) {
      if (placed) break;
      const candidates = bedEligiblePool
        .filter((c) => (c.sowMonths[pattern] ?? []).includes(m))
        .filter((c) => supportsAutomaticPlacement(c, bed))
        .filter((c) => !rotation.repeats(bed.id, c, m))
        .sort((a, b2) =>
          ((used.get(a.key) ?? 0) - (used.get(b2.key) ?? 0))
          || (commercialScore(b2) - commercialScore(a)));
      for (const crop of candidates) {
        const share = usableShare(occupancy, bed, m, crop, 1 / 3, 0.5);
        if (share === null) continue;
        occupancy.add(bed.id, m, crop, share);
        rotation.recordUse(bed.id, crop, m);
        used.set(crop.key, (used.get(crop.key) ?? 0) + 1);
        const areaFraction = share < 1 ? share : undefined;
        plantings.push({
          id: plantingId(bed.id, crop.key, m, areaFraction),
          bedId: bed.id,
          cropKey: crop.key,
          sowMonth: m,
          areaFraction,
        });
        placed = true;
        break;
      }
    }
  }
  return { plantings };
}

function ensureSowingCadence(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  allowVinesInBeds: boolean,
  sowCounts: SowCounts,
  spread: CropSpread,
  supportedMonths: ReadonlySet<number>,
): { plantings: Planting[] } {
  const plantings: Planting[] = [];
  const bedEligiblePool = allowVinesInBeds ? pool : pool.filter((c) => !isSpaceHungry(c));

  for (let i = 0; i < 12; i++) {
    const m = wrapMonth(nowMonth + i);
    if (!supportedMonths.has(m)) continue;
    if (sowCountAt(sowCounts, m) > 0) continue;

    let best: { bed: PlanBed; crop: CropDef; fraction: number; freeAtM: number; spread: number } | null = null;
    for (const bed of beds) {
      // PLOTS SIT THIS PASS OUT ENTIRELY. Monthly sowing cadence is a VEG-BED idea —
      // it exists so the kitchen has something coming in every month. A staple plot is
      // a field: it is sown in its season, harvested in its season, and then it is
      // finished. Letting the cadence pass reach for a plot is how a plot ended up
      // sown to whatever happened to be in season that month, which is precisely the
      // "everything but staple crops" the owner reported.
      if (bed.kind === 'plot') continue;
      // Half a bed at most — this pass adds rhythm, it must not monopolise the
      // room fillRemainingGaps still needs for coverage.
      const fractions = fractionPresetsFor(bed).filter((f) => f <= 0.5);
      for (const crop of bedEligiblePool) {
        if (!(crop.sowMonths[pattern] ?? []).includes(m)) continue;
        if (!plannedOccupiedOffsets(nowMonth, m, crop)
          .every((offset) => supportedMonths.has(wrapMonth(nowMonth + offset)))) continue;
        if (!supportsAutomaticPlacement(crop, bed)) continue;
        if (rotation.repeats(bed.id, crop, m)) continue;
        // Largest share that fits AND leaves a plantable remainder; only if no
        // such share exists does the biggest-fitting rule apply. Taking the
        // biggest unconditionally here is what left the 17% strips on Beds 4,
        // 6, 7 and 9 that no later pass could ever use.
        const share = usableShare(occupancy, bed, m, crop, fractions[0], 0.5);
        if (share === null) continue;
        for (const fraction of [share]) {
          const freeAtM = 1 - occupancy.fractionAt(bed.id, m);
          // Balance the exact crops the farmer selected before choosing a larger
          // share or a heavier crop-cycle benchmark. Otherwise cabbage's long sow
          // window and high water weight let it enter every bed over twelve months,
          // even though other selected crops still fitted. This is not a quota: the
          // prospective number of beds is compared directly, and a sole viable crop
          // can still be used wherever it fits.
          const spreadHere = spreadRank(spread, crop.key, bed.id);
          const betterWithinSameSpread = best
            ? fraction > best.fraction
              || (fraction === best.fraction && (freeAtM > best.freeAtM
                || (freeAtM === best.freeAtM && commercialScore(crop) > commercialScore(best.crop))))
            : false;
          if (!best || spreadHere < best.spread || (spreadHere === best.spread && betterWithinSameSpread)) {
            best = { bed, crop, fraction, freeAtM, spread: spreadHere };
          }
          break; // biggest fitting fraction for this (bed, crop) found — no need to shrink further
        }
      }
    }
    if (!best) continue;

    occupancy.add(best.bed.id, m, best.crop, best.fraction);
    rotation.recordUse(best.bed.id, best.crop, m);
    bumpSow(sowCounts, m);
    noteCropBed(spread, best.crop.key, best.bed.id);
    const areaFraction = best.fraction < 1 ? best.fraction : undefined;
    plantings.push({
      id: plantingId(best.bed.id, best.crop.key, m, areaFraction),
      bedId: best.bed.id,
      cropKey: best.crop.key,
      sowMonth: m,
      areaFraction,
    });
  }
  return { plantings };
}

// Safety cap on how many times fillRemainingGaps' per-bed loop can iterate —
// not a real planning limit, just a termination backstop. Each iteration
// either fills one calendar month (permanently removing it from the "empty"
// search) or marks one as stuck (permanently removing it too, see below), and
// there are only 12 calendar months, so the loop is naturally bounded by 12;
// this is a little headroom above that for safety.
const MAX_GAP_FILLS_PER_BED = 16;

// The rolling display already shows a full 12 months ahead (nowMonth through
// nowMonth+11) — every one of those columns is already "committed to" just
// by being on screen, so the LAST-RESORT gap-filling pass (fillRemainingGaps
// / reportStillRestingBeds) can reach all the way to the far edge of that
// same window rather than the tighter 5-month horizon the FIRST-CHOICE
// recommendation passes (planSuccession, backfillWinterGaps) use — those
// exist to avoid forcing an immediate, this-week decision on the farmer;
// this pass exists to avoid a visibly blank column in a view that's already
// showing the whole year, a different job with a different honest horizon.
const GAP_FILL_HORIZON_MONTHS = 11;

/**
 * Every (crop, sowMonth) pairing from `crops` that is BOTH reachable from
 * nowMonth (within `maxStartGap`) AND whose resulting occupied span
 * actually includes `targetMonth` — tries EVERY valid sow month in EVERY
 * cluster, not just whichever one lands nearest to targetMonth. A single
 * nearest-candidate search (the first version of this pass) can only ever
 * find sowMonth===targetMonth itself, since occupiedMonths() always counts
 * forward from sowMonth — missing every crop that's already growing by the
 * time targetMonth arrives because it was sown a month or two earlier.
 * Shared by fillRemainingGaps (to actually place something) and
 * reportStillRestingBeds (to honestly know whether it could have) so the
 * two can never disagree about what "reaches" a month — both must be
 * called with the SAME `maxStartGap` for that guarantee to hold.
 */
function reachingCandidates(
  crops: CropDef[],
  pattern: RainPattern,
  nowMonth: number,
  targetMonth: number,
  maxStartGap: number = PLAN_HORIZON_MONTHS,
  supportedMonths: ReadonlySet<number> = ALL_MONTHS,
): { crop: CropDef; sowMonth: number; startGap: number }[] {
  const out: { crop: CropDef; sowMonth: number; startGap: number }[] = [];
  for (const crop of crops) {
    for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
      for (const sowMonth of cluster.months) {
        const startGap = monthsForward(nowMonth, sowMonth);
        if (startGap > maxStartGap) continue;
        const occupiedOffsets = plannedOccupiedOffsets(nowMonth, sowMonth, crop);
        if (!occupiedOffsets.includes(monthsForward(nowMonth, targetMonth))) continue;
        if (!occupiedOffsets
          .every((offset) => supportedMonths.has(wrapMonth(nowMonth + offset)))) continue;
        out.push({ crop, sowMonth, startGap });
      }
    }
  }
  return out;
}

/** Wrap-safe "Nov-Feb" style label for a (possibly year-wrapping) set of months — reuses clusterSowMonths's own wrap-merge rather than a fresh ad-hoc grouping. */
function monthRangeLabel(months: number[]): string {
  return clusterSowMonths(months)
    .map((r) => (r.months.length === 1 ? MONTHS_SHORT[r.start - 1] : `${MONTHS_SHORT[r.start - 1]}-${MONTHS_SHORT[r.end - 1]}`))
    .join(', ');
}

/**
 * Runs after every other allocation pass (including backfillWinterGaps) over
 * the FULL bed list. The earlier breadth pass gives every exact crop choice a
 * first chance and the winter pass only bridges the relevant frost window;
 * this pass keeps adding plantings
 * to any bed with a genuinely idle month ANYWHERE in the rolling 12-month
 * window, for as long as something in the pool can still reach it.
 *
 * This is the fix for "half the year sits empty" in a climate (e.g. Durban's
 * mild-frost, summer-rainfall pattern) that actually has a sowable crop for
 * nearly every month — the earlier passes' diversity cap was never meant to
 * also cap total YEAR coverage, but it had that side effect. Space-hungry
 * vines are excluded unless allowVinesInBeds, matching the same policy the
 * space-hungry pre-pass above already applies to shared beds.
 *
 * Tries whole-bed first, then falls back through BED_FRACTION_PRESETS
 * (1/2, 1/3, 1/4) — every catalog crop's minimum span is 3 months, so a
 * genuinely narrow 1-2 month gap wedged against an already-committed
 * neighbour can NEVER fit a whole-bed crop; a fractional share at least
 * partly closes it instead of giving up outright.
 */
function fillRemainingGaps(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  allowVinesInBeds: boolean,
  sowCounts: SowCounts,
  spread: CropSpread,
  cropCohorts: CropCohortCounts,
  freshCoverage: FreshCoverage,
  plotsWithCourse: ReadonlySet<string>,
  supportedMonths: ReadonlySet<number>,
  strictCropKeys?: ReadonlySet<string>,
): { plantings: Planting[]; oatsExceptionBeds: string[] } {
  const plantings: Planting[] = [];
  const oatsExceptionBeds: string[] = [];
  // Avoids the SAME crop landing back-to-back in one bed purely because it's
  // the highest-scoring option every time rotation has nothing conflict-free
  // left to offer (a real farm can end up growing one thing all year
  // otherwise, in a small-garden/narrow-selection case).
  const lastCropByBed = new Map<string, string>();

  for (const bed of beds) {
    // A plot draws only from the staples (poolForBed) — the vine it wants IS a staple
    // cucurbit, so nothing is lost, and the salad crops that used to fill plots here
    // are now excluded by identity rather than out-scored by luck. Beds keep the
    // vine-exclusion policy, plus the row-width test below.
    const bedPool = poolForBed(
      bed,
      pool,
      allowVinesInBeds,
      plotsWithCourse,
      strictCropKeys,
    ).filter((c) => supportsAutomaticPlacement(c, bed));
    // Months this bed's search has already tried and failed to fill — without
    // this, hitting ONE unfillable month would `break` and abandon the WHOLE
    // bed, silently skipping over other, genuinely-fillable months later in
    // the rolling window (confirmed live: a bed can have its nearest gap
    // blocked by an occupancy collision while a later gap is perfectly
    // fillable). Each of the 12 calendar months can only ever be found as a
    // gap once — it's either filled (occupancy becomes non-zero, permanently
    // leaving the search) or marked stuck here — so this also guarantees
    // termination without relying on fillCount alone.
    const stuckMonths = new Set<number>();

    for (let fillCount = 0; fillCount < MAX_GAP_FILLS_PER_BED; fillCount++) {
      // SCARCITY-FIRST month choice. The old pick was most-empty-room-first, which spends the
      // shoulder months (Aug-Nov, Feb-May) on quick high-score crops before winter is even
      // attempted — and winter's only bridgers are LONG crops (onions, garlic, broad beans)
      // whose spans need those very shoulder months free. By the time Jun-Jul came up, every
      // candidate failed occupancy and the hole was permanent. Resolving the month with the
      // FEWEST reaching candidates first plants the hard months while the space they need is
      // still open; easy months fill afterwards regardless of order.
      let gapMonth: number | null = null;
      let gapMonthOptions = Infinity;
      for (let i = 0; i < 12; i++) {
        const m = wrapMonth(nowMonth + i);
        if (!supportedMonths.has(m)) continue;
        if (stuckMonths.has(m)) continue;
        if (1 - occupancy.fractionAt(bed.id, m) <= 0.0001) continue;
        const options = reachingCandidates(bedPool, pattern, nowMonth, m, GAP_FILL_HORIZON_MONTHS, supportedMonths).length;
        if (options < gapMonthOptions) { gapMonth = m; gapMonthOptions = options; }
      }
      if (gapMonth === null) break; // every still-empty month already tried, or bed is fully covered

      const reaching = reachingCandidates(bedPool, pattern, nowMonth, gapMonth, GAP_FILL_HORIZON_MONTHS, supportedMonths);
      let chosen: {
        crop: CropDef;
        sowMonth: number;
        fraction: number;
        /** True when this placement is legal only through the oats maize-lands
         *  exception — the farmer is told so once per plan. */
        viaException?: boolean;
        /** A second crop placed in the SAME iteration to consume the leftover
         *  the first one declined — see the companion note in tryFractions. */
        companion?: { crop: CropDef; sowMonth: number; fraction: number; viaException?: boolean };
      } | null = null;


      // Sow-month scarcity leads, THEN longest empty-month cover. Cover-first alone (the
      // 2026-08-04-morning fix) did convert winter "rests" into bridges — but by always
      // preferring the longest span it made every bed bridge from the SAME early sow month,
      // which is how a plan with 100% winter coverage still had zero Jun/Jul sowings and a
      // bare September behind the exhausted bridgers. Scarcity-first staggers: the first bed
      // still takes the long bridger, and the tally then steers later beds toward the sow
      // months the plan hasn't used — a June-sown pea cohort covers Jun-Aug AND matures food
      // for the very months the bridgers go quiet. Cover, nearness and score break ties.
      const emptyCover = (c: { crop: CropDef; sowMonth: number }): number =>
        occupancy.fractionsDuring(bed.id, c.sowMonth, c.crop)
          .filter((fraction) => fraction === 0).length;
      /**
       * DON'T LEAVE A SLIVER NOBODY CAN PLANT IN.
       *
       * The smallest share this planner will ever give a crop is a quarter of a
       * bed, so any remainder between nothing and a quarter is dead ground for
       * as long as the planting holds it. Bed 1 is the case the owner kept
       * reporting: February had two-thirds free, eleven candidates fitted at a
       * HALF, a third and a quarter — and taking the largest, a half, left
       * 0.17 of the bed. Every later pass then found "free=0.17, fits: 0 at
       * every fraction" and gave up, five months running. A third would have
       * left a clean third, and a third bed of food.
       *
       * So: prefer the largest share that leaves either nothing or a plantable
       * remainder. Only if no such share exists do we fall back to the old
       * largest-fits-wins rule, because half a bed of food still beats none.
       */
      // Crop spread leads the sort (see spreadRank): this pass places more crops
      // than any other, so it is where "chard again" was decided over and over. A crop
      // the plan has not used yet now wins ahead of the highest-scoring one, which is
      // also what finally reaches the eleven catalog crops no pass ever offered.
      // Shared by the pick sort AND the companion search below — the companion
      // taking `reaching` in raw order picked a short-span crop and left Bed 1's
      // July bare all over again.
      const preferenceRank = (a: (typeof reaching)[number], b: (typeof reaching)[number]) =>
        (freshGapGain(freshCoverage, bed.id, b.crop, b.sowMonth)
          - freshGapGain(freshCoverage, bed.id, a.crop, a.sowMonth))
        || (cohortCountAt(cropCohorts, a.crop.key) - cohortCountAt(cropCohorts, b.crop.key))
        || (spreadRank(spread, a.crop.key, bed.id) - spreadRank(spread, b.crop.key, bed.id))
        || (emptyCover(b) - emptyCover(a))
        || (sowCountAt(sowCounts, a.sowMonth) - sowCountAt(sowCounts, b.sowMonth))
        || (commercialScore(b.crop) - commercialScore(a.crop))
        || (a.startGap - b.startGap)
        || a.crop.key.localeCompare(b.crop.key);
      const tryFractions = (avoidSlivers: boolean): typeof chosen => {
        for (const fraction of fractionPresetsFor(bed)) {
          const fitting = reaching
            .filter((c) => occupancy.fits(bed.id, c.sowMonth, c.crop, fraction))
            .sort(preferenceRank);
          if (!fitting.length) continue; // this fraction can't fit anything — try a smaller share

          // Rotation-clean candidates outrank the oats maize-lands exception —
          // see rotationLegalTiered. preferenceRank still decides within a tier.
          const { picks: nonRepeating, viaException } = rotationLegalTiered(fitting, bed, rotation);
          if (!nonRepeating.length) continue;
          const pool2 = nonRepeating;
          const nonRepeat = pool2.filter((c) => c.crop.key !== lastCropByBed.get(bed.id));
          const pick = nonRepeat[0] ?? pool2[0];
          if (avoidSlivers) {
            // usableShare can widen the share to exactly what is left, which no
            // rung of the ladder may equal — the only way to be certain nothing
            // is stranded.
            const wide = usableShare(occupancy, bed, pick.sowMonth, pick.crop, fraction);
            if (wide === null || leavesDeadSliver(occupancy, bed, pick.sowMonth, pick.crop, wide)) continue;
            let share = wide;
            // Widening past the ask spends space a SECOND crop may be waiting
            // for: Bed 1's peas took 0.666 where peas-then-chard used to
            // stand, and the chard was what covered July. But preferring the
            // ask-sized share unconditionally measured 8.5% -> 11.1% strips
            // on the interrogation farms — on a big site the leftover often
            // goes unclaimed and later sliver-tolerant passes chew it ragged.
            // So SIMULATE: place the ask-sized share, ask whether any OTHER
            // candidate could still claim the leftover cleanly, and only keep
            // the smaller share when someone actually can.
            const askSized = usableShare(occupancy, bed, pick.sowMonth, pick.crop, fraction, 1, true);
            if (askSized !== null && askSized < wide - 0.001
              && !leavesDeadSliver(occupancy, bed, pick.sowMonth, pick.crop, askSized)) {
              occupancy.add(bed.id, pick.sowMonth, pick.crop, askSized);
              // The claimant must consume the WHOLE leftover cleanly, and it
              // is placed HERE, in the same iteration, as a companion — a
              // simulated "someone will claim it later" measured +0.5pt of
              // strips at 24-40 beds, because by the claimant's actual turn
              // the fill loop had wandered to other beds and the leftover
              // decayed into exactly the ragged state this pass prevents.
              const leftover = wide - askSized;
              let companion: { crop: CropDef; sowMonth: number; fraction: number; viaException?: boolean } | undefined;
              const { picks: companionPicks, viaException: companionViaException } = rotationLegalTiered(
                [...reaching].sort(preferenceRank).filter((c) => c.crop.key !== pick.crop.key),
                bed,
                rotation,
              );
              for (const c of companionPicks) {
                const f = fractionPresetsFor(bed)
                  .filter((fr) => fr >= leftover - 0.001
                    && occupancy.fits(bed.id, c.sowMonth, c.crop, fr)
                    && !leavesDeadSliver(occupancy, bed, c.sowMonth, c.crop, fr))
                  .sort((a, b) => a - b)[0];
                if (f !== undefined) {
                  companion = { crop: c.crop, sowMonth: c.sowMonth, fraction: f, viaException: companionViaException };
                  break;
                }
              }
              occupancy.add(bed.id, pick.sowMonth, pick.crop, -askSized);
              if (companion) {
                return { crop: pick.crop, sowMonth: pick.sowMonth, fraction: askSized, viaException, companion };
              }
            }
            return { crop: pick.crop, sowMonth: pick.sowMonth, fraction: share, viaException };
          }
          return { crop: pick.crop, sowMonth: pick.sowMonth, fraction, viaException };
        }
        return null;
      };

      chosen = tryFractions(true) ?? tryFractions(false);

      if (!chosen) { stuckMonths.add(gapMonth); continue; } // this month can't be filled — remember it, keep trying the bed's OTHER gaps

      // The companion was validated against occupancy WITH the first share in
      // place; placing both here, back to back, is what makes the pair real —
      // deferring the second to a later iteration measured it decaying into
      // strips at 24-40 beds while Bed 1's July stayed bare at nine. The
      // fits() re-check runs inside the loop, i.e. after the first share has
      // actually landed — the state the companion was validated in.
      const toPlace = chosen.companion ? [chosen, chosen.companion] : [chosen];
      for (const placement of toPlace) {
        if (placement === chosen.companion
          && !occupancy.fits(bed.id, placement.sowMonth, placement.crop, placement.fraction)) continue;
        occupancy.add(bed.id, placement.sowMonth, placement.crop, placement.fraction);
        rotation.recordUse(bed.id, placement.crop, placement.sowMonth);
        bumpSow(sowCounts, placement.sowMonth);
        noteCropBed(spread, placement.crop.key, bed.id);
        bumpCohort(cropCohorts, placement.crop.key);
        lastCropByBed.set(bed.id, placement.crop.key);
        const areaFraction = placement.fraction < 1 ? placement.fraction : undefined;
        const planting: Planting = {
          id: plantingId(bed.id, placement.crop.key, placement.sowMonth, areaFraction),
          bedId: bed.id,
          cropKey: placement.crop.key,
          sowMonth: placement.sowMonth,
          areaFraction,
        };
        plantings.push(planting);
        noteFreshCoverage(freshCoverage, planting);
        if (placement.viaException) oatsExceptionBeds.push(bed.label);
      }
    }
  }
  return { plantings, oatsExceptionBeds };
}

/**
 * The final, honest accounting of what's STILL empty — computed against the
 * FINAL occupancy state, after every placement pass including
 * fillRemainingGaps has already had its chance. This is deliberately the
 * only place that reports "this bed rests" copy, so it can never contradict
 * a planting one of the earlier passes went on to add afterward. Genuinely
 * distinguishes "nothing in your selected crop types reaches this month"
 * (widen your selection) from "no crop in the whole catalog can, under this
 * rainfall pattern" (a real seasonal/frost limit, not a gap in the plan).
 *
 * Uses the SAME reachingCandidates search fillRemainingGaps just ran (rather
 * than a naive "does this crop's raw sowMonths array literally list this
 * month" check) — that naive check both false-positives (a crop whose sow
 * window is elsewhere but whose SPAN covers the month doesn't show up in its
 * own sowMonths array, so a genuinely-coverable month could wrongly be
 * called a "real seasonal limit") and false-negatives (a crop that
 * nominally lists the month but can never actually fit there — occupancy
 * collision, space-hungry exclusion — would wrongly suppress a note
 * entirely). Checked down to the smallest fraction fillRemainingGaps would
 * ever try for that bed's kind (1/4 for beds, 1 for plots) — if not even
 * that fits, nothing genuinely reaches.
 */
function reportStillRestingBeds(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  supportedMonths: ReadonlySet<number>,
  plantings: readonly Planting[],
  strictCropKeys?: ReadonlySet<string>,
  /** Plots whose staple course is already spent — the same set the closing
   * passes used, so this note asks the question those passes actually answered. */
  plotsWithCourse?: ReadonlySet<string>,
): PlanNote[] {
  const pickingMonths = freshHarvestMonthsByBed(plantings);
  const automaticPool = strictCropKeys
    ? pool.filter(hasVerifiedSchedule)
    : pool.filter(hasAutomaticPlanningBasis);
  const canFill = (crops: CropDef[], bed: PlanBed, month: number): boolean =>
    reachingCandidates(crops, pattern, nowMonth, month, GAP_FILL_HORIZON_MONTHS, supportedMonths)
      .filter((candidate) => supportsAutomaticPlacement(candidate.crop, bed))
      // Mirror fillRemainingGaps' rotation gate exactly: a candidate the
      // rotation ledger vetoes could never actually be planted, so counting
      // it as fillable would silently hide a resting stretch (the "poolCanFillSome
      // true → stay silent" branch below assumes fillRemainingGaps could act).
      .filter((candidate) => !rotation.repeats(bed.id, candidate.crop, candidate.sowMonth)
        || (bed.kind === 'plot' && candidate.crop.key === 'oats' && isPlotWinterCover(candidate.crop)))
      .some((candidate) => usableShare(occupancy, bed, candidate.sowMonth, candidate.crop, 1) !== null);
  // Reach WITHOUT the occupancy check — the difference between "no crop's window covers this
  // stretch" (a seasonal fact about the catalogue) and "a crop could cover it but this bed's
  // plan is already too full around it" (a fact about the plan). The old copy blamed the
  // catalogue for both, which read as "nothing can grow here" on a bed the plan itself packed.
  const canReach = (crops: CropDef[], bed: PlanBed, month: number): boolean =>
    reachingCandidates(crops, pattern, nowMonth, month, GAP_FILL_HORIZON_MONTHS, supportedMonths)
      .some((candidate) => supportsAutomaticPlacement(candidate.crop, bed));
  const exactCropNames = strictCropKeys
    ? [...strictCropKeys].map((key) => CROPS.find((crop) => crop.key === key)?.name ?? key)
    : [];
  const exactChoice = exactCropNames.length
    ? `your chosen crops (${exactCropNames.join(', ')})`
    : null;

  // One entry per bed with a genuine no-new-sowing stretch, bucketed by CAUSE.
  // Grouping by cause rather than flattening everything into one sentence keeps
  // the three explanations honest — they are different facts about the farm —
  // while still collapsing the per-bed repetition that made up 35% of all notes.
  const byCause = new Map<RestCause, { bed: PlanBed; label: string }[]>();
  for (const bed of beds) {
    const picking = pickingMonths.get(bed.id);
    const emptyMonths: number[] = [];
    for (let m = 1; m <= 12; m++) {
      if (!supportedMonths.has(m)) continue;
      if (occupancy.fractionAt(bed.id, m) !== 0) continue;
      // TRUTH GATE (2026-08-19 audit). `fractionAt` reads the ROLLING
      // now..+11 ledger, but the saved plan is an ANNUAL template: a cohort
      // sown in a month that has already passed this year still picks from
      // this bed on the calendar the farmer reads. 46.8% of the old rest
      // notes named a month in which the very same plan harvests that very
      // bed — "Bed 1 still rests in Jan" beside a tomato row picking Bed 1
      // from January to March. A month someone is picking in is not a gap.
      if (picking?.has(m)) continue;
      emptyMonths.push(m);
    }
    if (!emptyMonths.length) continue;

    const label = emptyMonths.length === 12 ? 'all year' : monthRangeLabel(emptyMonths);
    // PER BED, not the flat catalogue. A plot's candidates are a small named list
    // (its staple course, then a winter cover), and asking the flat pool whether
    // "some crop" could fill a plot's empty months answered yes on the strength of
    // a cabbage that could never legally be planted there. cause then stayed null
    // and the stretch was dropped in silence — measured as 13 bare plot bed-months
    // with no note at all on the owner's own farm. Routing through poolForBed asks
    // the same question the closing passes asked, so the answer matches the plan.
    const bedAutomaticPool = poolForBed(bed, automaticPool, true, plotsWithCourse, strictCropKeys);
    const poolCanFillSome = emptyMonths.some((m) => canFill(bedAutomaticPool, bed, m));
    const catalogCanFillSome = emptyMonths.some((m) => canFill(AUTOMATIC_PLANNING_CROPS, bed, m));
    let cause: RestCause | null = null;
    if (!poolCanFillSome && catalogCanFillSome) cause = 'other-crop-could';
    else if (!catalogCanFillSome && emptyMonths.some((m) => canReach(AUTOMATIC_PLANNING_CROPS, bed, m))) cause = 'plan-is-full';
    else if (!catalogCanFillSome) cause = 'nothing-reaches';
    // poolCanFillSome true here would mean fillRemainingGaps (the identical
    // search, plus its own fits check) should already have used it — silent
    // rather than risking a note that contradicts what was just planted.
    if (!cause) continue;
    const list = byCause.get(cause) ?? [];
    list.push({ bed, label });
    byCause.set(cause, list);
  }

  const explain: Record<RestCause, string> = {
    'other-crop-could': exactChoice
      ? `None of ${exactChoice} can fill those stretches in this plan. Another crop with a verified schedule could — add one only if the household actually wants it.`
      : 'A crop outside your selected groups, with a verified schedule, could cover those stretches. Widen your crop groups only if that crop suits the household.',
    // TEMPORAL, not spatial: the blocker is that the MONTHS on either side of
    // the stretch are already planted, so a crop needing that run of months has
    // nowhere in the calendar to sit. An earlier rewrite said "no room in the
    // bed around them", which reads as a shortage of ground.
    'plan-is-full': `${exactChoice ? `${exactChoice} and other well-documented crops have` : 'Well-documented crops have'} a sowing window for those stretches, but the months around them are already fully planted, or crop rotation rules out the families that would fit. Clearing a nearby month, or letting the ground rest, are both fine choices.`,
    'nothing-reaches': `${exactChoice ? `Nothing among ${exactChoice}, and no other crop` : 'No crop'} the catalog can plan properly — one with a checked growing time, spacing and yield — has a sowing window that reaches those stretches. Ask locally what else does; this plan is not proof that nothing can grow then.`,
  };

  // A field plot reaches 'other-crop-could' for a different reason than a bed
  // does, so it may not borrow the bed's sentence. A bed's stretch is open
  // because the household's crop groups are narrow — widening them is real
  // advice. A plot's stretch is open because the planner will not put a
  // vegetable on a traced field on its own, which no amount of widening
  // changes; told the bed's version, a farmer would go looking for a setting
  // that does not exist. Only this one cause is split: the other two are true
  // of a plot exactly as written, and splitting them would break up bed notes
  // that are already grouped correctly.
  const plotOnly = (entries: { bed: PlanBed; label: string }[]) => entries.filter((e) => e.bed.kind === 'plot');
  const bedOnly = (entries: { bed: PlanBed; label: string }[]) => entries.filter((e) => e.bed.kind !== 'plot');
  const sentence = (entries: { bed: PlanBed; label: string }[], why: string): PlanNote => {
    const where = entries.map((entry) => `${entry.bed.label} (${entry.label})`).join(', ');
    return planNote(
      'gap',
      `${entries.length} growing area${entries.length === 1 ? ' has' : 's have'} a stretch with no new sowing: ${where}. ${why}`,
      entries.map((entry) => entry.bed.id),
    );
  };

  const notes: PlanNote[] = [];
  for (const cause of REST_CAUSE_ORDER) {
    const entries = byCause.get(cause);
    if (!entries?.length) continue;
    if (cause !== 'other-crop-could') {
      notes.push(sentence(entries, explain[cause]));
      continue;
    }
    const beds_ = bedOnly(entries);
    const plots_ = plotOnly(entries);
    if (beds_.length) notes.push(sentence(beds_, explain[cause]));
    if (plots_.length) notes.push(sentence(plots_, PLOT_REST_EXPLANATION));
  }
  return notes;
}

/**
 * Why a staple plot rests, in the farmer's terms. Deliberately says what the
 * planner WILL NOT do and why, rather than implying a setting would fix it.
 */
const PLOT_REST_EXPLANATION = 'A staple plot grows one crop across the whole '
  + 'block, and its course for the year is already spent, so no second staple '
  + 'may follow it and no declared winter cover reaches those months. A '
  + 'vegetable crop could cover them, but the planner will not put a vegetable '
  + 'on a traced field on its own — planted at full block width that is a '
  + 'sizeable commitment, so it is left as your decision. Sowing one by hand, '
  + 'or resting the ground, are both sound choices.';

/** Why a stretch of ground gets no new sowing. Ordered most-actionable first. */
type RestCause = 'other-crop-could' | 'plan-is-full' | 'nothing-reaches';
const REST_CAUSE_ORDER: RestCause[] = ['other-crop-could', 'plan-is-full', 'nothing-reaches'];

/**
 * Months each bed is being PICKED in under this plan, read cyclically off the
 * annual template rather than the rolling now..+11 occupancy ledger — see the
 * truth gate in reportStillRestingBeds for why the difference matters.
 */
function freshHarvestMonthsByBed(plantings: readonly Planting[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const planting of plantings) {
    const crop = CROPS.find((candidate) => candidate.key === planting.cropKey);
    if (!crop || crop.timingVerified === false) continue;
    if (!Number.isInteger(planting.sowMonth) || planting.sowMonth < 1 || planting.sowMonth > 12) continue;
    let months = out.get(planting.bedId);
    if (!months) { months = new Set(); out.set(planting.bedId, months); }
    const end = harvestEndMonthForCrop(planting.sowMonth, crop);
    let month = harvestMonthForCrop(planting.sowMonth, crop);
    for (let step = 0; step < 12; step++) {
      months.add(month);
      if (month === end) break;
      month = wrapMonth(month + 1);
    }
  }
  return out;
}

/**
 * Turns questionnaire answers into a full Planting[] proposal. Never
 * mutates or removes existingPlantings — the caller decides whether to
 * merge the result in (matching the manual picker's own add-only write
 * path), so re-running this is always safe.
 */
export function autoSuggestPlan(
  answers: AutoSuggestAnswers,
  pattern: RainPattern,
  beds: PlanBed[],
  existingPlantings: Planting[],
  nowMonth: number,
  realNow?: RealNow,
): AutoSuggestResult {
  const notes: PlanNote[] = [];
  const added: Planting[] = [];

  const seenBedIds = new Set<string>();
  const usableBeds = beds.filter((bed) => {
    if (
      !bed.id.trim()
      || seenBedIds.has(bed.id)
      || !Number.isFinite(bed.areaM2)
      || bed.areaM2 <= 0
      || (bed.minDimM !== undefined && (!Number.isFinite(bed.minDimM) || bed.minDimM <= 0))
    ) return false;
    seenBedIds.add(bed.id);
    return true;
  });
  if (usableBeds.length !== beds.length) {
    notes.push(planNote('warning', `${beds.length - usableBeds.length} unusable or duplicate bed record${beds.length - usableBeds.length === 1 ? ' was' : 's were'} left out of the suggestion.`));
  }
  beds = usableBeds;

  if (!Number.isInteger(nowMonth) || nowMonth < 1 || nowMonth > 12) {
    notes.push(planNote('basis', 'The current month was unavailable, so suggestions start from January.'));
    nowMonth = 1;
  }

  // This engine deliberately packs successive crops. Rainfall pattern alone
  // is not evidence that water will be available on this particular farm, and
  // a guessed set of "wet months" would merely disguise that missing fact.
  if (answers.reliableIrrigation !== true) {
    notes.push(planNote('warning', 'No automatic crop plan was generated because reliable irrigation was not confirmed. This engine deliberately packs successive crop cycles, and a regional rainfall label does not prove that this farm can water them.'));
    return { plantings: [], notes: orderNotes(notes), laterThisYear: [] };
  }
  if (pattern !== 'mild-frost') {
    // ACTION FIRST. This used to lead with the provenance sentence and sat at
    // the very top of 75% of all plans, so the first thing most farmers in the
    // country read was a paragraph about an audit. It is genuinely actionable,
    // so it stays prominent — but as a warning that opens with the thing to do.
    notes.push(planNote('warning', 'Check each sowing month with your local extension officer — outside KZN this calendar has not been checked crop by crop.'));
  }

  const usableBedIds = new Set(beds.map((bed) => bed.id));
  const usableExistingPlantings = existingPlantings.filter(
    (planting) =>
      usableBedIds.has(planting.bedId)
      && Number.isInteger(planting.sowMonth)
      && planting.sowMonth >= 1
      && planting.sowMonth <= 12,
  );
  if (usableExistingPlantings.length !== existingPlantings.length) {
    notes.push(planNote('warning', `${existingPlantings.length - usableExistingPlantings.length} existing planting record${existingPlantings.length - usableExistingPlantings.length === 1 ? ' was' : 's were'} missing a usable bed or sowing month and could not be scheduled.`));
  }

  const occupancy = new Occupancy(answers.allowMixedCropsInBed === true, nowMonth);
  occupancy.seed(usableExistingPlantings, (p) => {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    // Unknown crop key — nothing more is known, so occupy just the sow month (holdSpanMonths(0) === 1).
    return crop ?? { key: p.cropKey, daysToHarvest: 0 };
  }, nowMonth, realNow);

  const selectedGroups = answers.groups.length ? new Set(answers.groups) : null;
  // THE POOL IS FOOD. A crop that yields nothing to eat (a verified cover crop)
  // is soil management, not an answer to "which foods do you want to grow", and
  // it must never reach a pass that is choosing what the kitchen gets. Filtered
  // HERE rather than in poolForBed because several passes read `pool` directly —
  // the food-group map and the space-hungry pre-pass among them — so a guard
  // further downstream would leave those routes open. Plots get the cover crop
  // back from the verified schedulable catalog in poolForBed, where it belongs.
  const yieldBackedFood = SCHEDULABLE_CROPS.filter(hasAutomaticPlanningBasis);
  const explicitCropKeys = new Set((answers.cropKeys ?? []).filter(Boolean));
  const selectedWithoutSchedule = CROPS.filter((crop) =>
    explicitCropKeys.has(crop.key) && !hasVerifiedSchedule(crop));
  if (selectedWithoutSchedule.length) {
    notes.push(planNote('warning', `${selectedWithoutSchedule.map((crop) => crop.name).join(', ')} ${selectedWithoutSchedule.length === 1 ? 'is' : 'are'} selected, but the catalog still lacks a verified local duration or field-establishment basis. ${selectedWithoutSchedule.length === 1 ? 'It stays' : 'They stay'} selected for review but ${selectedWithoutSchedule.length === 1 ? 'is' : 'are'} not placed automatically.`));
  }
  // Exact household/buyer choices outrank the broader UI category filter. A
  // farmer may select a crop and then collapse its category while reviewing;
  // that must not silently erase the explicit choice or introduce substitutes.
  let pool = explicitCropKeys.size
    ? SCHEDULABLE_CROPS.filter((c) => explicitCropKeys.has(c.key))
    : yieldBackedFood.filter((c) => !selectedGroups || selectedGroups.has(foodGroupOf(c)));
  if (!pool.length) {
    if (explicitCropKeys.size) {
      notes.push(planNote('warning', 'None of the crops this household chose has a verified schedule for automatic planning. Review those crops by hand or choose one the planner can schedule; it will not guess a substitute.'));
      return { plantings: [], notes: orderNotes(notes), laterThisYear: [] };
    }
    pool = yieldBackedFood; // "not sure" fallback — compare only crops with sourced yield benchmarks
  }
  const chosenWithoutYield = explicitCropKeys.size
    ? pool.filter((crop) => !hasAutomaticPlanningBasis(crop))
    : [];
  if (chosenWithoutYield.length) {
    notes.push(planNote('basis', `${chosenWithoutYield.map((crop) => crop.name).join(', ')} ${chosenWithoutYield.length === 1 ? 'has' : 'have'} verified timing and field establishment, so ${chosenWithoutYield.length === 1 ? 'it can' : 'they can'} be scheduled. No supported food-yield benchmark is available, so kilograms and value remain blank rather than being guessed.`));
  }
  // Both of these fire on 100% of plans and are identical on every farm in the
  // country, so they are 'basis': true, kept, and rendered last (2026-08-19
  // audit — they used to be the first lines a farmer read).
  notes.push(planNote('basis', explicitCropKeys.size
    ? 'Exact crop choices need verified duration and field establishment for scheduling. Yield benchmarks are used only where the catalog has them; missing kilograms are never invented.'
    : 'Broad automatic choices use crops with verified yield, duration and field spacing so their productivity comparison has a common evidence basis.'));
  notes.push(planNote('basis', 'How many people you feed is not used to guess how much to plant. The planner tries the exact crops you chose; your mapped space, the sowing windows and crop rotation decide what fits.'));

  const exactFamilies = explicitCropKeys.size
    ? new Set(pool.map((crop) => rotationFamilyOf(crop)))
    : new Set<RotationFamily>();
  const exactFallbackFamily = exactFamilies.size === 1
    ? [...exactFamilies][0]
    : null;
  const rotation = new BedRotation(
    usableExistingPlantings,
    nowMonth,
    answers.rotateCrops,
    exactFallbackFamily,
    realNow,
  );

  const dedicated = new Set<string>();

  // ---- space-hungry pre-pass (family/hybrid only): whole dedicated bed
  // each, never split/intercropped. Commercial mode instead lets space-
  // hungry crops compete as ordinary ranked candidates below — a farmer who
  // asked to focus on 2 crops shouldn't have both beds silently claimed by
  // vines before their actual choice is even considered.
  //
  // Default (allowVinesInBeds=false): don't auto-place these at all — a vine
  // dedicating a whole veg bed for months, filling it with nothing else all
  // year, can be a bad outcome for precious rotational bed space (confirmed by a
  // live farmer report of exactly that). Recommend a dedicated plot / property
  // edge / food-forest area instead, and only fall back to a veg bed when the
  // farmer explicitly opts in via the toggle — that opt-in IS the "are you
  // sure" confirmation this batch engine can offer (there's no farmer-in-the-
  // loop mid-generation; the review-before-accept screen plus this toggle
  // together serve the same purpose a runtime popup would).
  const plots = beds.filter((b) => b.kind === 'plot');
  const maizeWasExplicitlyRequested = explicitCropKeys.has('maize')
    || (explicitCropKeys.size === 0 && selectedGroups?.has('staple_grain') === true);
  if (maizeWasExplicitlyRequested && plots.length === 0) {
    notes.push(planNote('warning', 'Maize was not placed for you: the app can measure mapped area, but it cannot draw or check a wind-pollinated maize block. Add a staple plot on the map, or add maize by hand once you have checked the real row layout.'));
  }

  if (answers.goal !== 'commercial') {
    const spaceHungry = pool.filter(isSpaceHungry).sort((a, b) => commercialScore(b) - commercialScore(a));
    // A vine's ideal home is a staple plot — field-scale ground that IS the "dedicated
    // patch" the note below tells the farmer to go find. Plots are tried FIRST and need no
    // toggle: allowVinesInBeds only ever guarded precious rotational veg-bed space.
    const vinesStillWanting: CropDef[] = [];
    // One plot per STAPLE COURSE, and only a staple may take one at all. Both halves matter:
    // every catalog vine is fruiting_veg, so without a per-course gate three vines would turn
    // three of four plots into a vine farm; and without the staple test the highest-yielding
    // vine won the cucurbit plot every single time. A watermelon is a treat
    // that keeps a month; a pumpkin is food in August. The plot
    // is for the one that feeds the household, and watermelon now falls through to the
    // dedicated-patch advice below like any other sprawler with nowhere to go.
    const plotCoursesClaimed = new Set<StapleCourse>();
    for (const crop of spaceHungry) {
      const course = stapleCourseOf(crop);
      const plot = course && !plotCoursesClaimed.has(course)
        ? plots.filter((p) => !dedicated.has(p.id)).sort((a, b) => b.areaM2 - a.areaM2)[0]
        : undefined;
      if (!plot) { vinesStillWanting.push(crop); continue; }
      const outcome = planSuccession(crop, pattern, [plot], occupancy, nowMonth, true, answers.rhythm, 1, rotation);
      if (outcome.status === 'NO_WINDOW') continue;
      if (!outcome.plantings.length) { vinesStillWanting.push(crop); continue; }
      dedicated.add(plot.id);
      plotCoursesClaimed.add(course!);
      added.push(...outcome.plantings);
      notes.push(planNote('choice', `${crop.name} gets ${plot.label} to itself — a staple plot is exactly the dedicated sprawling room it wants.`, [plot.id]));
    }
    if (vinesStillWanting.length && !answers.allowVinesInBeds) {
      const names = vinesStillWanting.map((c) => c.name).join(', ');
      notes.push(planNote('warning', `${names} want more room to sprawl than a veg bed can give — grow them in a dedicated plot, along your property edges, or in a food forest area instead. Turn on "Grow big vines in a veg bed anyway" if you'd rather use one of your beds for them.`));
    }
    for (const crop of vinesStillWanting) {
      if (!answers.allowVinesInBeds) continue;
      const bed = beds.filter((b) => !dedicated.has(b.id) && b.kind !== 'plot').sort((a, b) => b.areaM2 - a.areaM2)[0];
      if (!bed) { notes.push(planNote('warning', `${crop.name} wants a whole bed to itself — none free this round.`)); continue; }
      // The farmer explicitly opted into using a veg bed. Do not replace that
      // choice with an invented universal minimum area/width: vine training,
      // edge spill and access differ by layout. Keep the crop whole-bed and
      // surface the review note after it is placed.
      const outcome = planSuccession(crop, pattern, [bed], occupancy, nowMonth, true, answers.rhythm, 1, rotation);
      if (outcome.status === 'NO_WINDOW') continue; // out of season for this rainfall pattern — not a real "later" case
      // The largest free bed can still be too full to actually fit this crop
      // (e.g. an existing planting already occupies it through the relevant
      // months) — planSuccession then returns PARTIAL_FIT with ZERO
      // plantings placed. Dedicating the bed anyway would strand its
      // remaining free months from the rest of the plan for nothing.
      if (!outcome.plantings.length) {
        notes.push(planNote('warning', `${crop.name} wants a whole bed to itself, but the largest free bed was already too full to fit it this round.`, [bed.id]));
        continue;
      }
      dedicated.add(bed.id);
      added.push(...outcome.plantings);
      notes.push(planNote('warning', `${crop.name} gets ${bed.label} to itself. Check the actual vine path or trellis before accepting; mapped area alone does not prove that sprawling room works.`, [bed.id]));
    }
  }
  // ---- staple plots: the rotation's field-scale units ("for ubhejane we have 4 plots —
  // so we can [do] rotations"). Each remaining plot (a vine may have claimed one above)
  // takes ONE crop at FULL area for the season. Groups not yet used on another plot this
  // round are preferred — with four plots that distributes the four declared field
  // layout classes (grain / pulse / tuber / squash) in a single proposal — and BedRotation,
  // seeded from supplied crop records, avoids an immediate family repeat.
  if (plots.length) {
    // Courses already taken this round — by the vine pre-pass above, or by a plot
    // planted earlier in this loop. Four plots and four courses means the classic
    // grain / pulse / tuber / cucurbit layout falls out in one pass.
    const coursesUsedOnPlots = new Set<StapleCourse>();
    for (const p of added) {
      if (!plots.some((pl) => pl.id === p.bedId)) continue;
      const crop = CROPS.find((c) => c.key === p.cropKey);
      const course = crop && stapleCourseOf(crop);
      if (course) coursesUsedOnPlots.add(course);
    }
    const plotSowTally = tallySowings(added);
    const plotLines: string[] = [];
    for (const plot of plots) {
      if (dedicated.has(plot.id)) continue;
      // STAPLES ONLY. This loop used to read the whole `pool`, which is how a plot came
      // out as carrots or cabbage: they are in season more often and score higher, so
      // they won on every tie-break the sort could offer.
      const stapleCandidates = poolForBed(plot, pool, true, undefined, explicitCropKeys.size ? explicitCropKeys : undefined);
      const candidates: { crop: CropDef; sowMonth: number; startGap: number }[] = [];
      for (const crop of stapleCandidates) {
        for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
          for (const sowMonth of cluster.months) {
            const startGap = monthsForward(nowMonth, sowMonth);
            if (startGap > GAP_FILL_HORIZON_MONTHS) continue;
            if (!occupancy.fits(plot.id, sowMonth, crop, 1)) continue;
            candidates.push({ crop, sowMonth, startGap });
          }
        }
      }
      const nonRepeating = candidates.filter((c) => !rotation.repeats(plot.id, c.crop, c.sowMonth));
      if (!nonRepeating.length) continue; // fillRemainingGaps still gets a whole-plot try later
      const pickFrom = nonRepeating;
      pickFrom.sort((a, b) => {
        const ca = stapleCourseOf(a.crop);
        const cb = stapleCourseOf(b.crop);
        // An unused field-layout class first. Then deterministic class order,
        // sow-month scarcity, soonest start, and only last the fresh-weight
        // benchmark that used to decide everything. This distributes the one-year
        // proposal; it does not claim a nutrient transfer or universal rotation.
        return (Number(ca ? coursesUsedOnPlots.has(ca) : true) - Number(cb ? coursesUsedOnPlots.has(cb) : true))
          || ((ca ? STAPLE_COURSE_SEQUENCE.indexOf(ca) : 9) - (cb ? STAPLE_COURSE_SEQUENCE.indexOf(cb) : 9))
          || (sowCountAt(plotSowTally, a.sowMonth) - sowCountAt(plotSowTally, b.sowMonth))
          || (a.startGap - b.startGap)
          || (commercialScore(b.crop) - commercialScore(a.crop));
      });
      const chosen = pickFrom[0];
      const chosenCourse = stapleCourseOf(chosen.crop);
      if (chosenCourse) coursesUsedOnPlots.add(chosenCourse);
      occupancy.add(plot.id, chosen.sowMonth, chosen.crop, 1);
      rotation.recordUse(plot.id, chosen.crop, chosen.sowMonth);
      bumpSow(plotSowTally, chosen.sowMonth);
      added.push({
        id: plantingId(plot.id, chosen.crop.key, chosen.sowMonth, undefined),
        bedId: plot.id,
        cropKey: chosen.crop.key,
        sowMonth: chosen.sowMonth,
      });
      plotLines.push(`${plot.label}: ${chosen.crop.name} (sow ${MONTHS_SHORT[chosen.sowMonth - 1]})`);
    }
    if (plotLines.length) {
      notes.push(planNote('choice', `Staple plots each take one crop at full area — ${plotLines.join(' · ')}. With prior crop records supplied and Rotate crops on, this proposal avoids an immediate repeat of the most recently recorded botanical family; it is not a stored multi-year history.`, plots.map((plot) => plot.id)));
    }
  }

  // Plots never join the shared-bed passes: runFamilyBreadthFirst splits beds by fraction
  // across many crops, and a plot's whole identity is one crop at full area.
  const sharedBeds = beds.filter((b) => !dedicated.has(b.id) && b.kind !== 'plot');

  // Must run BEFORE the goal passes: they hand out every share that crosses
  // the planning wall, and the tail months can only sow while some remain —
  // see reserveWrapTailSowings. FAMILY beds only: the reservation feeds the
  // kitchen through the winter tail, and its crop mix costs annual tonnage
  // (measured: -12% kg at a 40-bed farm) — a commercial grower's contract is
  // tonnage-first, so commercial beds and hybrid's sell beds are exempt. The
  // slice below mirrors the hybrid branch's own sell/family split exactly.
  const hybridSellBedCount = answers.goal === 'hybrid' && (answers.focusCropCount ?? 0) > 0
    ? Math.min(answers.focusCropCount ?? 0, Math.max(0, sharedBeds.length - 1))
    : 0;
  const tailReserveBeds = answers.goal === 'commercial' ? [] : sharedBeds.slice(hybridSellBedCount);
  if (answers.reliableIrrigation === true
    && answers.rhythm === 'steady'
    && answers.allowMixedCropsInBed === true) {
    const tailReserved = reserveWrapTailSowings(
      pool,
      tailReserveBeds,
      occupancy,
      pattern,
      nowMonth,
      rotation,
      answers.allowVinesInBeds,
    );
    added.push(...tailReserved.plantings);
  }

  if (answers.goal === 'commercial') {
    const result = runCommercialConcentration(pool, sharedBeds, answers.focusCropCount ?? 1, pattern, occupancy, nowMonth, answers.rhythm, rotation);
    added.push(...result.plantings);
    notes.push(...result.notes);
  } else if (answers.goal === 'hybrid') {
    // Reserve beds for the "sell" portion FIRST (same whole-bed
    // concentration commercial mode uses, over a small fixed number of
    // beds), THEN feed the family with whatever's left. This is what
    // actually differentiates hybrid from family — it used to silently
    // ignore the "how many crops to sell" question entirely. Doing it in
    // the other order doesn't work: the family loop shares ALL its beds by
    // FRACTION across many crops, so it tends to touch every bed a little
    // rather than leaving any of them fully free for a "surplus" pass
    // afterward — reserving fixed whole beds up front sidesteps that.
    if (!sharedBeds.length) {
      notes.push(planNote('warning', noSharedBedsNote(beds)));
    } else {
      const wantedToSell = answers.focusCropCount ?? 0;
      let familyBeds = sharedBeds;
      if (wantedToSell > 0) {
        // Always leave at least one bed for the family — "feed us first" —
        // even if that means selling fewer crops than asked for.
        const sellBedCount = Math.min(wantedToSell, Math.max(0, sharedBeds.length - 1));
        if (sellBedCount > 0) {
          const sellBeds = sharedBeds.slice(0, sellBedCount);
          const sellResult = runCommercialConcentration(pool, sellBeds, wantedToSell, pattern, occupancy, nowMonth, answers.rhythm, rotation);
          added.push(...sellResult.plantings);
          notes.push(...sellResult.notes);
          familyBeds = sharedBeds.slice(sellBedCount);
        } else {
          notes.push(planNote('choice', 'Only one bed free — kept it for feeding the family; add more beds to also set some aside for selling.'));
        }
      }
      const familyResult = runFamilyBreadthFirst(pool, familyBeds, selectedGroups, pattern, occupancy, nowMonth, answers.rhythm, rotation, answers.allowMixedCropsInBed === true);
      added.push(...familyResult.plantings);
    }
  } else {
    // family
    if (!sharedBeds.length) {
      notes.push(planNote('warning', noSharedBedsNote(beds)));
    } else {
      const familyResult = runFamilyBreadthFirst(pool, sharedBeds, selectedGroups, pattern, occupancy, nowMonth, answers.rhythm, rotation, answers.allowMixedCropsInBed === true);
      added.push(...familyResult.plantings);
    }
  }

  // Runs over the FULL bed list (including dedicated vine beds, often empty
  // all winter once harvested) — the "assume the farmer wants year-round
  // production" ask. Comes after every other pass so it only ever fills a
  // genuinely still-empty winter gap, never displaces anything already
  // planned above.
  // Which plots already hold their staple course for the season. Read from what was
  // actually planted (both the vine pre-pass and the staple pass commit into `added`),
  // so the closing passes below may add a winter cover to a plot but never a second
  // staple — see poolForBed.
  const plotsWithCourse = new Set<string>();
  for (const p of added) {
    if (!plots.some((pl) => pl.id === p.bedId)) continue;
    const crop = CROPS.find((c) => c.key === p.cropKey);
    if (crop && stapleCourseOf(crop)) plotsWithCourse.add(p.bedId);
  }

  // One tally for the closing passes — any winter bridge commits steer the
  // later gap packer too.
  const sowCounts = tallySowings(added);
  const spread = tallyCropBeds(added);
  const supportedMonths = ALL_MONTHS;
  const closingPool = answers.goal === 'commercial'
    ? [...pool].sort((a, b) => commercialScore(b) - commercialScore(a)).slice(0, Math.max(1, answers.focusCropCount ?? 1))
    : pool;
  const strictCropKeys = explicitCropKeys.size ? explicitCropKeys : undefined;
  const winterResult = backfillWinterGaps(
    closingPool,
    beds,
    occupancy,
    pattern,
    nowMonth,
    rotation,
    sowCounts,
    spread,
    plotsWithCourse,
    strictCropKeys,
  );
  added.push(...winterResult.plantings);
  notes.push(...winterResult.notes);
  // Every plot that ended up with oats on cereal ground, from BOTH closing
  // passes — one honest, sourced note per plan rather than one per placement.
  const oatsExceptionBeds = [...winterResult.oatsExceptionBeds];

  if (answers.rhythm === 'steady') {
    // One spread tally, seeded before the winter bridge and shared by every
    // closing pass so they cannot independently over-use one crop.
    const cadenceResult = ensureSowingCadence(closingPool, beds, occupancy, pattern, nowMonth, rotation, answers.allowVinesInBeds, sowCounts, spread, supportedMonths);
    added.push(...cadenceResult.plantings);
    const gapResult = fillRemainingGaps(
      closingPool,
      beds,
      occupancy,
      pattern,
      nowMonth,
      rotation,
      answers.allowVinesInBeds,
      sowCounts,
      spread,
      tallyCropCohorts([...usableExistingPlantings, ...added]),
      tallyFreshCoverage([...usableExistingPlantings, ...added]),
      plotsWithCourse,
      supportedMonths,
      strictCropKeys,
    );
    added.push(...gapResult.plantings);
    oatsExceptionBeds.push(...gapResult.oatsExceptionBeds);
    notes.push(...reportStillRestingBeds(
      closingPool,
      beds,
      occupancy,
      pattern,
      nowMonth,
      rotation,
      supportedMonths,
      [...usableExistingPlantings, ...added],
      strictCropKeys,
      plotsWithCourse,
    ));
  } else {
    notes.push(planNote('choice', 'A few big harvests was selected, so the planner did not add monthly filler crops merely to make the timeline look full.'));
  }
  if (oatsExceptionBeds.length) {
    notes.push(planNote('choice', oatsMaizeLandNote([...new Set(oatsExceptionBeds)])));
  }
  for (const text of rotation.fallbackNotes(beds)) notes.push(planNote('warning', text));

  // A crop chosen by name, with a fully verified catalog schedule, that is
  // neither a catalog-gap crop (selectedWithoutSchedule, above) nor a
  // space-hungry vine with nowhere to sprawl (vinesStillWanting, above) can
  // still end the plan with zero plantings — it simply lost every ranked
  // placement pass to other explicit choices on a crowded farm. That absence
  // used to own no note at all: not a catalog-gap story, not a sprawl story,
  // and (PDF-side) not even the "later this year" panel, which never reaches
  // the printed export (2026-08-21 audit — Peppers, Amadumbe, Groundnuts and
  // Peas vanished from a real client's plan this way, silently). Silence here
  // reads as "the planner forgot you asked for it" rather than the true
  // story: there was no room left once everything else was placed.
  const explicitlyPlacedKeys = new Set(added.map((p) => p.cropKey));
  const selectedWithoutScheduleKeys = new Set(selectedWithoutSchedule.map((crop) => crop.key));
  const explicitlyChosenButAbsent = CROPS.filter((crop) =>
    explicitCropKeys.has(crop.key)
    && hasVerifiedSchedule(crop)
    && !explicitlyPlacedKeys.has(crop.key)
    && !selectedWithoutScheduleKeys.has(crop.key)
    && !isSpaceHungry(crop));
  if (explicitlyChosenButAbsent.length) {
    const names = explicitlyChosenButAbsent.map((crop) => crop.name).join(', ');
    const one = explicitlyChosenButAbsent.length === 1;
    notes.push(planNote('warning', `${names} ${one ? 'was' : 'were'} chosen but didn't fit anywhere in this plan — every sowing window ${one ? 'it has' : 'they have'} was already committed to other crops, or ruled out by rotation. Add ${one ? 'it' : 'them'} by hand if you want to make room.`));
  }

  const plantings = consolidatePlantings(added);
  return {
    plantings,
    notes: orderNotes(notes),
    // Computed from the CONSOLIDATED plan, not the planning ledger.
    // consolidatePlantings now SUMS same-cohort shares (2026-08-20 fix — it
    // used to keep only the larger one, which silently understated a bed the
    // ledger already knew was full), so the two agree on how much of a bed
    // is committed. This still rebuilds occupancy and rotation from exactly
    // what is returned rather than reusing `occupancy` above for a different
    // reason: the ideal-year feature re-derives the waiting panel at the REAL
    // current month after planning from a different anchor, and the waiting
    // panel must answer for the emitted plan ("given THIS plan, when could
    // the crop first fit?"), not for whatever anchor month planning ran at.
    laterThisYear: recomputeLaterThisYear(
      answers, pattern, beds, plantings, usableExistingPlantings, nowMonth, realNow,
    ),
  };
}

/**
 * Crops the farmer explicitly chose that ended the plan with NOTHING in the
 * ground, purely because their sowing window has not opened yet.
 *
 * This replaces a producer that could never fire. The old one keyed off a
 * `nearest.gap > PLAN_HORIZON_MONTHS` test in planSuccession, but monthsForward
 * returns 0..11 and PLAN_HORIZON_MONTHS is 11 — so it was structurally
 * impossible, and measured zero entries across 26,640 generated plans. The
 * "Later this year" panel in the review screen had therefore never rendered
 * once.
 *
 * DELIBERATELY NARROW. A crop that lost to space or to crop rotation already
 * has its own note naming that cause, and telling the farmer to "wait for the
 * window" would be a second, wrong explanation for the same absence. So every
 * one of these must hold: the crop was chosen by name, the planner can
 * schedule it at all, and — the part that separates a timing story from a
 * space story — there is STILL somewhere on this farm the crop would fit at
 * SOME month of that window. Checked against
 * the final occupancy and the final rotation ledger, so it is a fact about the
 * finished plan rather than a guess about why a pass gave up. Where no month of
 * the window has room anywhere, the entry is dropped entirely: that absence is
 * a space or rotation story, and the gap notes already own it.
 *
 * TRUTHFULNESS (the 2026-08-20 fix). The month printed is the window's own
 * start, never a later month chosen because room exists there. The first draft
 * returned the first REACHABLE sow month under the name `nextWindowMonth`, so
 * on a farm whose beds were full in February the panel read "Beetroot — the
 * next sowing window starts around Aug" when beetroot's summer window opens in
 * February. Both facts are now carried separately and, when they differ, both
 * are said out loud.
 *
 * WINDOW-OPEN-NOW (the second 2026-08-20 fix). This used to skip any crop
 * whose window CONTAINS the current month — so peas and peppers, chosen in
 * August with August in their windows but no room this month, vanished from
 * both the plan and this panel (Rory hit exactly that). A window that is open
 * right now with the first real room months away is the strongest version of
 * the timing story, not a reason to stay silent. The one case still skipped
 * is firstFitMonth === nowMonth: an entry claiming there is room this month
 * would contradict the plan that just declined to place the crop — the gap
 * and choice notes own that absence.
 */
function cropsWaitingOnTheirWindow(
  explicitCropKeys: ReadonlySet<string>,
  pool: readonly CropDef[],
  beds: readonly PlanBed[],
  pattern: RainPattern,
  nowMonth: number,
  plantings: readonly Planting[],
  occupancy: Occupancy,
  rotation: BedRotation,
): LaterThisYearEntry[] {
  if (!explicitCropKeys.size) return [];
  const planted = new Set(plantings.map((planting) => planting.cropKey));
  const out: LaterThisYearEntry[] = [];
  for (const crop of pool) {
    if (!explicitCropKeys.has(crop.key) || planted.has(crop.key)) continue;
    if (!hasVerifiedSchedule(crop)) continue;
    const sowMonths = crop.sowMonths[pattern];
    if (!sowMonths.length) continue;
    const byDistance = [...sowMonths]
      .sort((a, b) => monthsForward(nowMonth, a) - monthsForward(nowMonth, b));
    // The window's own start — a fact about the crop, not about this farm.
    // When the window contains the current month this IS the current month
    // (monthsForward === 0 sorts first).
    const nextWindowMonth = byDistance[0];
    // The soonest month of that window with somewhere to put it — a fact about
    // this farm. Undefined means nowhere at all, all year: not a timing story.
    const firstFitMonth = byDistance.find((sowMonth) => beds.some((bed) =>
      supportsAutomaticPlacement(crop, bed)
      && !rotation.repeats(bed.id, crop, sowMonth)
      && usableShare(occupancy, bed, sowMonth, crop, 1) !== null));
    if (firstFitMonth === undefined) continue;
    const opens = MONTHS_SHORT[nextWindowMonth - 1];
    let text: string;
    if (nextWindowMonth === nowMonth) {
      // Window open right now. Any other firstFitMonth is strictly forward by
      // construction (byDistance sorts by monthsForward), so a plain !==
      // comparison is wrap-safe where a numeric > would not be.
      if (firstFitMonth === nowMonth) continue;
      text = `${crop.name} — its sowing window is open right now, but this plan has nowhere to put it until ${MONTHS_SHORT[firstFitMonth - 1]}.`;
    } else {
      text = firstFitMonth === nextWindowMonth
        ? `${crop.name} — its next sowing window opens in ${opens}, and this plan still has room for it then.`
        : `${crop.name} — its next sowing window opens in ${opens}, but this plan has nowhere to put it that month; `
          + `the first sowing month it could still fit into is ${MONTHS_SHORT[firstFitMonth - 1]}.`;
    }
    out.push({ cropKey: crop.key, nextWindowMonth, firstFitMonth, text });
  }
  return out;
}

/**
 * The "Waiting for their sowing window" list recomputed from a given month's
 * perspective, for a proposal that was GENERATED at a different anchor month.
 *
 * The whole-year planner (lib/crop-plan-ideal.ts) runs autoSuggestPlan at all
 * 12 anchor months and keeps the best cycle. That winner's own laterThisYear
 * was written from its anchor's point of view — "opens in X" sentences that
 * are false relative to the farmer's actual today — so the wrapper replaces
 * it with this: the same deliberately-narrow producer, run against the same
 * final plan, but with the ledgers rebuilt at the real current month.
 *
 * Mirrors autoSuggestPlan's own input hygiene and ledger seeding (the bed and
 * planting filters, Occupancy.seed, BedRotation + recordUse) rather than
 * exporting the private ledger classes.
 */
export function recomputeLaterThisYear(
  answers: AutoSuggestAnswers,
  pattern: RainPattern,
  beds: PlanBed[],
  proposedPlantings: readonly Planting[],
  existingPlantings: readonly Planting[],
  nowMonth: number,
  realNow?: RealNow,
): LaterThisYearEntry[] {
  const explicitCropKeys = new Set((answers.cropKeys ?? []).filter(Boolean));
  if (!explicitCropKeys.size) return [];
  // Mirror autoSuggestPlan's early exits exactly — a run that refuses to plan
  // (no confirmed irrigation) reports NO waiting crops, and this recompute
  // must agree with it rather than invent entries the plan never had.
  if (answers.reliableIrrigation !== true) return [];
  if (!Number.isInteger(nowMonth) || nowMonth < 1 || nowMonth > 12) nowMonth = 1;

  const seenBedIds = new Set<string>();
  const usableBeds = beds.filter((bed) => {
    if (
      !bed.id.trim()
      || seenBedIds.has(bed.id)
      || !Number.isFinite(bed.areaM2)
      || bed.areaM2 <= 0
      || (bed.minDimM !== undefined && (!Number.isFinite(bed.minDimM) || bed.minDimM <= 0))
    ) return false;
    seenBedIds.add(bed.id);
    return true;
  });
  const usableBedIds = new Set(usableBeds.map((bed) => bed.id));
  const usablePlanting = (planting: Planting) =>
    usableBedIds.has(planting.bedId)
    && Number.isInteger(planting.sowMonth)
    && planting.sowMonth >= 1
    && planting.sowMonth <= 12;
  const usableExisting = existingPlantings.filter(usablePlanting);
  const usableProposed = proposedPlantings.filter(usablePlanting);

  const pool = SCHEDULABLE_CROPS.filter((crop) => explicitCropKeys.has(crop.key));

  const occupancy = new Occupancy(answers.allowMixedCropsInBed === true, nowMonth);
  const holdOf = (p: Planting) => {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    return crop ?? { key: p.cropKey, daysToHarvest: 0 };
  };
  occupancy.seed(usableExisting, holdOf, nowMonth, realNow);
  occupancy.seed(usableProposed, holdOf, nowMonth, realNow);

  const exactFamilies = new Set(pool.map((crop) => rotationFamilyOf(crop)));
  const rotation = new BedRotation(
    usableExisting,
    nowMonth,
    answers.rotateCrops,
    exactFamilies.size === 1 ? [...exactFamilies][0] : null,
    realNow,
  );
  for (const planting of usableProposed) {
    const crop = CROPS.find((c) => c.key === planting.cropKey);
    if (crop) rotation.recordUse(planting.bedId, crop, planting.sowMonth);
  }

  return cropsWaitingOnTheirWindow(
    explicitCropKeys, pool, usableBeds, pattern, nowMonth, usableProposed, occupancy, rotation,
  );
}
