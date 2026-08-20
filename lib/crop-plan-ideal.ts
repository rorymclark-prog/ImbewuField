/**
 * Whole-year crop-plan sweep — "Best whole-year plan".
 *
 * autoSuggestPlan anchors its succession clustering to the month it is run
 * in, and that anchor is a heavy thumb on the scale: on the same farm with
 * the same answers, some starting months yield a repeating year with zero
 * months of missing fresh harvest while others leave three (measured on the
 * real 12-bed / 23-crop farm this feature was built for — an August run was
 * one of the three worst anchors, a January run had no gap at all). The
 * farmer generating a plan "today" has no way to see that.
 *
 * This module runs the UNMODIFIED engine at every anchor month 1..12,
 * scores each candidate's repeating year for fresh-food continuity, and
 * keeps the best cycle. The engine itself is untouched: every candidate is
 * an ordinary engine result, and the winner is returned exactly as the
 * engine produced it apart from a documented truthfulness pass (notes and
 * the waiting panel re-expressed against the farmer's REAL current month,
 * plus a bed-level warning where the cycle may overlap a crop that is
 * really in the ground today).
 *
 * DETERMINISM: this module must never read the clock or draw randomness —
 * the caller passes realNowMonth, and identical inputs must produce
 * identical output (tests assert both, the banned tokens by source scan).
 */
import {
  autoSuggestPlan,
  fillFirstSeasonGaps,
  recomputeLaterThisYear,
  type AutoSuggestAnswers,
  type AutoSuggestResult,
  type PlanNote,
} from './crop-autosuggest';
import {
  existingSowOffset,
  harvestEndMonthForCrop,
  harvestMonthForCrop,
  occupiedMonthsForPlanting,
  type PlanBed,
  type Planting,
} from './crop-plan';
import { cropByKey, MONTHS_SHORT, type RainPattern } from './crop-catalog';
import { wrapMonth } from './crop-export-schedule';

/** The modal's timing question: plan from this month (today's behaviour) or
 * sweep all 12 starting months for the best repeating year. */
export type PlanTiming = 'fromNow' | 'idealYear';

export interface IdealAnchorScore {
  /** 1-12 — the month this candidate plan was generated from. */
  anchorMonth: number;
  /** Calendar months of the repeating year with zero fresh FOOD crops. */
  zeroFreshMonths: number[];
  /** Distinct fresh food crops in the worst month. */
  minMonthlyFreshCrops: number;
  meanMonthlyFreshCrops: number;
  /** yieldKgPerM2 × bed area × share; null-yield food crops contribute 0. */
  totalKg: number;
  distinctCrops: number;
  plantingCount: number;
  /** Distinct sow months the candidate uses, ascending. */
  sowMonthsUsed: number[];
}

export interface IdealYearPlan {
  best: { anchorMonth: number; result: AutoSuggestResult; score: IdealAnchorScore };
  /** All 12 candidates' scores in anchor order 1..12 — the "why" table. */
  perAnchor: IdealAnchorScore[];
  sameAsToday: boolean;
  /** Crops with a sowing 0-1 months ahead of the real current month. */
  startNowCropKeys: string[];
  /** Sow months already past this calendar year — those sowings only come
   * around next season (the calendar already renders them at their next
   * occurrence; this is the honest ramp-in disclosure). */
  rampInMonths: number[];
  /** Months until the plan's LAST first-sowing has happened (max forward
   * distance over sow months). This is when every sowing has STARTED — not
   * when the cycle's harvests are all flowing, which can be later. */
  monthsUntilFullCycle: number;
  fullCycleByMonth: number;
  /** Calendar months within the FIRST 12 months from the real current month
   * that have zero fresh food from this plan — the transition year can be
   * leaner than the repeating year the scores describe, because early months
   * pass before their suppliers are sown. */
  firstYearZeroFreshMonths: number[];
}

/**
 * Every farmer-visible sentence for the feature, in lib rather than the page
 * so the banned-terms lint and truth gates can read them (PLAN_NOTES_PANEL_COPY
 * precedent). Plain farmer language — no "anchor", no "optimizer".
 */
export const IDEAL_PLAN_COPY = {
  timingHeading: 'Plan for right now, or for the whole year?',
  fromNowLabel: 'Start from this month',
  fromNowBlurb: 'Fills your beds beginning today',
  idealLabel: 'Best whole-year plan',
  // TRUE for both rhythms — zero-fresh months is the first sort key in both.
  idealBlurb: 'Tries all 12 starting months and keeps the one with the fewest months without a fresh harvest',
  busyLabel: 'Comparing 12 starting months…',
  reviewHeading: 'A whole-year plan',
  chosenLine: 'The planner compared plans starting in each of the 12 months and kept the one with the fewest months without a fresh harvest.',
  sameAsTodayLine: 'Good news: starting this month already gives the best whole-year result for this farm.',
  startNowLine: (crops: string) => `To begin: sow ${crops} this month or next.`,
  // "those sowings", not "those crops" — a crop can have several sowings and
  // only the already-passed ones wait for next season. And "will have
  // started", not "running" — the last sowing STARTING is not the same thing
  // as its harvest flowing.
  rampInLine: (n: number, monthName: string) =>
    `${n} sowing month${n === 1 ? ' has' : 's have'} already passed this year — those sowings come around next season. All of this plan's sowings will have started by ${monthName}.`,
  residualGapLine: (months: string) =>
    `Even the best starting month leaves no fresh harvest in ${months} — see the gaps section below.`,
  transitionGapLine: (months: string) =>
    `While the plan settles in, the first 12 months also have no fresh harvest from it in ${months}; after that the repeating year takes over.`,
  fewBigNote: 'A few-big-harvests plan bunches its harvests on purpose, so some leaner months remain even in the best whole-year version.',
  commercialNote: 'With a few focus crops, the starting month mainly changes how much you harvest, not how evenly it spreads.',
  basisNote: (todayName: string) =>
    `This plan follows a repeating whole-year cycle. It was chosen by comparing plans starting in each of the 12 months and keeping the one with the fewest months without a fresh harvest — not just what fits best from ${todayName}.`,
  existingOverlapWarning: (bedLabels: string) =>
    `Check ${bedLabels} before sowing there: something is already growing in ${bedLabels.includes(',') ? 'those beds' : 'that bed'} and this whole-year plan may overlap it in its first months.`,
  fullPlanHint: 'Crops already on your plan stay where they are — the whole-year plan only adds around them. For a plan of the whole farm, remove old plantings first.',
  // One-time starters: the repeating cycle's wrap-around sowings have not
  // happened yet in the farmer's first year, so ground they would cover
  // stands bare. Starters bridge what can honestly be bridged; each runs
  // exactly once and never recurs.
  starterLine: (crops: string) =>
    `To cover ground that would stand empty in your first months, one-time starter sowings are included: ${crops}. Each runs once — from next year the repeating plan covers those months itself.`,
  starterBadge: 'first season only',
} as const;

const monthsForward = (from: number, to: number): number => ((to - from) % 12 + 12) % 12;

/** The months a planting supplies fresh FOOD, on the repeating-year template.
 * Cover crops (yieldKgPerM2 === 0 — oats) are soil management, never fresh
 * food, matching the food chart's own exclusion; unverified timing is never
 * placed by the engine, so skipping it here is an alignment no-op. */
function freshWindow(cropKey: string, sowMonth: number): number[] {
  const crop = cropByKey(cropKey);
  if (!crop || crop.timingVerified === false) return [];
  if (crop.yieldKgPerM2 === 0) return [];
  const first = harvestMonthForCrop(sowMonth, crop);
  const last = harvestEndMonthForCrop(sowMonth, crop);
  const span = monthsForward(first, last); // inclusive length - 1
  return Array.from({ length: span + 1 }, (_, i) => wrapMonth(first + i));
}

/** Score one candidate's repeating year. Fresh coverage counts distinct
 * CROPS per month, never planting cohorts — three fractions of chard cannot
 * masquerade as three foods. */
export function scorePlan(
  anchorMonth: number,
  plantings: readonly Planting[],
  beds: readonly PlanBed[],
): IdealAnchorScore {
  const areaOf = new Map(beds.map((bed) => [bed.id, bed.areaM2]));
  const freshCropsByMonth = Array.from({ length: 12 }, () => new Set<string>());
  let totalKg = 0;
  const cropsPlanted = new Set<string>();
  const sowMonths = new Set<number>();
  for (const planting of plantings) {
    const crop = cropByKey(planting.cropKey);
    if (!crop) continue;
    cropsPlanted.add(planting.cropKey);
    sowMonths.add(planting.sowMonth);
    const area = (areaOf.get(planting.bedId) ?? 0) * (planting.areaFraction ?? 1);
    if (typeof crop.yieldKgPerM2 === 'number') totalKg += crop.yieldKgPerM2 * area;
    for (const month of freshWindow(planting.cropKey, planting.sowMonth)) {
      freshCropsByMonth[month - 1].add(planting.cropKey);
    }
  }
  const counts = freshCropsByMonth.map((set) => set.size);
  return {
    anchorMonth,
    zeroFreshMonths: counts.flatMap((count, i) => (count === 0 ? [i + 1] : [])),
    minMonthlyFreshCrops: Math.min(...counts),
    meanMonthlyFreshCrops: Math.round((counts.reduce((a, b) => a + b, 0) / 12) * 100) / 100,
    totalKg: Math.round(totalKg * 10) / 10,
    distinctCrops: cropsPlanted.size,
    plantingCount: plantings.length,
    sowMonthsUsed: [...sowMonths].sort((a, b) => a - b),
  };
}

/**
 * Continuity-first lexicographic pick, verified empirically before being
 * lifted here (scratchpad sweep over the real farm, 2026-08-20):
 *
 *   steady:  fewest zero-fresh months → highest worst-month fresh-crop count
 *            → highest total kg → most distinct crops → soonest start
 *   few-big: total kg moves ahead of the worst-month count — a few-big plan
 *            bunches harvests on purpose, so min-monthly is a weak signal
 *            there (it was 0 at every anchor in the sweep). Zero-fresh
 *            months stays the FIRST key in both branches, which is what
 *            keeps IDEAL_PLAN_COPY.idealBlurb's claim true for both.
 *
 * The forward-distance tail makes the sort total and deterministic: when
 * everything else ties, the cycle whose cadence begins soonest after the
 * farmer's real today wins (least ramp-in wait).
 */
export function pickIdealAnchor(
  scores: readonly IdealAnchorScore[],
  realNowMonth: number,
  rhythm: AutoSuggestAnswers['rhythm'],
): IdealAnchorScore {
  const fwd = (anchor: number) => monthsForward(realNowMonth, anchor);
  const compare = rhythm === 'few-big'
    ? (a: IdealAnchorScore, b: IdealAnchorScore) =>
      (a.zeroFreshMonths.length - b.zeroFreshMonths.length)
      || (b.totalKg - a.totalKg)
      || (b.minMonthlyFreshCrops - a.minMonthlyFreshCrops)
      || (b.distinctCrops - a.distinctCrops)
      || (fwd(a.anchorMonth) - fwd(b.anchorMonth))
    : (a: IdealAnchorScore, b: IdealAnchorScore) =>
      (a.zeroFreshMonths.length - b.zeroFreshMonths.length)
      || (b.minMonthlyFreshCrops - a.minMonthlyFreshCrops)
      || (b.totalKg - a.totalKg)
      || (b.distinctCrops - a.distinctCrops)
      || (fwd(a.anchorMonth) - fwd(b.anchorMonth));
  return [...scores].sort(compare)[0];
}

/** Calendar months, within the first 12 months from realNowMonth, where the
 * proposed plan supplies zero fresh food. Each sowing's FIRST occurrence is
 * at forward distance fwd(sowMonth); fresh months landing past offset 11
 * belong to the following year. Months the repeating year covers can still
 * be bare in year one — that gap is the transition cost the review card
 * must disclose rather than let the steady-state score imply away. */
function firstYearZeroFresh(plantings: readonly Planting[], realNowMonth: number): number[] {
  const covered = new Set<number>(); // offsets 0..11 from realNowMonth
  for (const planting of plantings) {
    const crop = cropByKey(planting.cropKey);
    if (!crop || crop.timingVerified === false || crop.yieldKgPerM2 === 0) continue;
    const sowOffset = monthsForward(realNowMonth, planting.sowMonth);
    const firstFresh = harvestMonthForCrop(planting.sowMonth, crop);
    const span = monthsForward(firstFresh, harvestEndMonthForCrop(planting.sowMonth, crop));
    const freshDelta = monthsForward(planting.sowMonth, firstFresh);
    for (let i = 0; i <= span; i++) {
      const offset = sowOffset + freshDelta + i;
      if (offset <= 11) covered.add(offset);
    }
  }
  const out: number[] = [];
  for (let offset = 0; offset <= 11; offset++) {
    if (!covered.has(offset)) out.push(wrapMonth(realNowMonth + offset));
  }
  return out;
}

/** Insert while preserving the engine's warning → choice → gap → basis note
 * order: a warning goes after the last warning, a basis note before the
 * first existing basis note (so it leads its section). */
function insertNoteOrdered(notes: readonly PlanNote[], note: PlanNote): PlanNote[] {
  const rank: Record<PlanNote['kind'], number> = { warning: 0, choice: 1, gap: 2, basis: 3 };
  const at = notes.findIndex((existing) => rank[existing.kind] >= rank[note.kind]);
  if (at < 0) return [...notes, note];
  return [...notes.slice(0, at), note, ...notes.slice(at)];
}

/** Beds where the winning cycle's proposed plantings may collide with a crop
 * the farmer confirmed is REALLY growing right now. Every anchor run ages
 * existing rows against its own synthetic month, so the winner was chosen on
 * a fiction about how far along those crops are; this scan replays the
 * overlap question against the real current month and warns at bed level —
 * warn, never block, and no area-fraction arithmetic. Proposed rows recur
 * annually, so calendar-month intersection is the honest test ("may
 * overlap", since the first collision might only come around next year). */
function overlapBedIds(
  proposed: readonly Planting[],
  existingPlantings: readonly Planting[],
  realNowMonth: number,
): string[] {
  const stillActiveByBed = new Map<string, Set<number>>();
  for (const row of existingPlantings) {
    if (row.existing !== true) continue;
    const months = occupiedMonthsForPlanting(row);
    if (!months.length) continue;
    // The cohort's sow happened at this (zero or negative) offset from now;
    // occupiedMonthsForPlanting anchors its months at bed entry, which for a
    // transplant crop is NOT the sow month — so offset the returned months as
    // a whole rather than rebuilding the span from the raw sow month.
    const sowOffset = existingSowOffset(row.sowMonth, realNowMonth);
    const entryDelta = monthsForward(row.sowMonth, months[0]);
    let active = stillActiveByBed.get(row.bedId);
    for (let i = 0; i < months.length; i++) {
      if (sowOffset + entryDelta + i < 0) continue; // already finished
      if (!active) { active = new Set(); stillActiveByBed.set(row.bedId, active); }
      active.add(months[i]);
    }
  }
  if (!stillActiveByBed.size) return [];
  const out = new Set<string>();
  for (const planting of proposed) {
    const active = stillActiveByBed.get(planting.bedId);
    if (!active) continue;
    if (occupiedMonthsForPlanting(planting).some((month) => active.has(month))) {
      out.add(planting.bedId);
    }
  }
  return [...out];
}

/**
 * Run the engine at all 12 anchor months, keep the best repeating year, and
 * re-express everything month-relative against the farmer's REAL current
 * month. existingPlantings are passed UNCHANGED to every run — identical
 * inputs per anchor keep the comparison fair — and the engine's add-only
 * regenerate contract is untouched: the winner only ever ADDS plantings.
 */
export function suggestIdealYearPlan(
  answers: AutoSuggestAnswers,
  pattern: RainPattern,
  beds: PlanBed[],
  existingPlantings: Planting[],
  realNowMonth: number,
  realNowYear: number,
): IdealYearPlan {
  if (!Number.isInteger(realNowMonth) || realNowMonth < 1 || realNowMonth > 12) realNowMonth = 1;

  const candidates = Array.from({ length: 12 }, (_, i) => {
    const anchorMonth = i + 1;
    const result = autoSuggestPlan(answers, pattern, beds, existingPlantings, anchorMonth);
    return { anchorMonth, result, score: scorePlan(anchorMonth, result.plantings, beds) };
  });
  const perAnchor = candidates.map((candidate) => candidate.score);
  const bestScore = pickIdealAnchor(perAnchor, realNowMonth, answers.rhythm);
  const winner = candidates[bestScore.anchorMonth - 1];
  const sameAsToday = winner.anchorMonth === realNowMonth;

  // ---- first-season transition fill: the cycle's wrap-around sowings have
  // not happened yet in the farmer's first year, so even the best cycle
  // leaves real ground bare for real months (measured: 20–31 idle bed-months
  // at EVERY anchor on the farm this was built for). One-time starters fill
  // what the farmer's own crop rules honestly allow; the cycle itself — and
  // every score describing it — is untouched. Starters apply equally when
  // sameAsToday: a from-now plan has the identical year-one holes. An invalid
  // year cannot produce an honest `once` stamp, so the fill is skipped rather
  // than stamped with fiction.
  const fill = Number.isInteger(realNowYear) && realNowYear >= 2020 && realNowYear <= 2100
    ? fillFirstSeasonGaps(answers, pattern, beds, winner.result.plantings, existingPlantings, realNowMonth, realNowYear)
    : { starters: [], notes: [] };
  const finalPlantings = [...winner.result.plantings, ...fill.starters];

  // ---- truthfulness pass (on copies — the raw engine result is not mutated)
  let notes = winner.result.notes;
  for (const note of fill.notes) notes = insertNoteOrdered(notes, note);
  let laterThisYear = winner.result.laterThisYear;
  if (winner.result.plantings.length) {
    notes = insertNoteOrdered(notes, {
      kind: 'basis',
      text: IDEAL_PLAN_COPY.basisNote(MONTHS_SHORT[realNowMonth - 1]),
    });
    const overlapBeds = overlapBedIds(finalPlantings, existingPlantings, realNowMonth);
    if (!sameAsToday && overlapBeds.length) {
      const labelOf = new Map(beds.map((bed) => [bed.id, bed.label]));
      const labels = overlapBeds.map((bedId) => labelOf.get(bedId) ?? bedId).join(', ');
      notes = insertNoteOrdered(notes, {
        kind: 'warning',
        bedIds: overlapBeds,
        text: IDEAL_PLAN_COPY.existingOverlapWarning(labels),
      });
    }
  }
  // The winner's waiting panel was written from its anchor's point of view,
  // and starters were not part of the engine run at all — so it is recomputed
  // against the FINAL plan from the real current month, unconditionally (a
  // sameAsToday plan still gains starters that may close a waiting gap).
  laterThisYear = recomputeLaterThisYear(
    answers, pattern, beds, finalPlantings, existingPlantings, realNowMonth,
  );

  // ---- ramp metadata, ALWAYS against realNowMonth, never the anchor.
  // Ramp lines describe the repeating CYCLE (bestScore is cycle-only), but
  // "start now" is an instruction list and starters are exactly that.
  const fwd = (month: number) => monthsForward(realNowMonth, month);
  const sowMonthsUsed = bestScore.sowMonthsUsed;
  const startNowCropKeys = [...new Set(
    finalPlantings
      .filter((planting) => fwd(planting.sowMonth) <= 1)
      .map((planting) => planting.cropKey),
  )];
  const rampInMonths = sowMonthsUsed.filter((month) => month < realNowMonth);
  const monthsUntilFullCycle = sowMonthsUsed.length
    ? Math.max(...sowMonthsUsed.map(fwd))
    : 0;

  return {
    best: {
      anchorMonth: winner.anchorMonth,
      result: { ...winner.result, plantings: finalPlantings, notes, laterThisYear },
      score: bestScore,
    },
    perAnchor,
    sameAsToday,
    startNowCropKeys,
    rampInMonths,
    monthsUntilFullCycle,
    fullCycleByMonth: wrapMonth(realNowMonth + monthsUntilFullCycle),
    // Over the FINAL list: a card that kept quoting pre-starter gaps would
    // name months the starters just covered. freshWindow's first occurrence
    // (fwd of sow month) is exactly a `once` row's single occurrence.
    firstYearZeroFreshMonths: firstYearZeroFresh(finalPlantings, realNowMonth),
  };
}
