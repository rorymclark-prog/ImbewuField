// ── The whole-year plan sweep ────────────────────────────────────────────────
//
// suggestIdealYearPlan exists because the engine's anchor month is a heavy,
// invisible thumb on the scale: the same farm and answers produce a repeating
// year with zero fresh-harvest gaps from one starting month and three from
// another. These tests pin three things:
//
//  1. The comparator — continuity first, verified against synthetic scores so
//     the copy's "fewest months without a fresh harvest" claim stays true in
//     BOTH rhythm branches.
//  2. The empirical winners — the real 12-bed / 23-crop farm this feature was
//     measured on (scratchpad sweep, 2026-08-20): family/steady wins from
//     January, family/few-big from October, commercial/steady from September.
//  3. The truthfulness pass — everything month-relative the farmer reads is
//     re-expressed against their REAL current month, never the synthetic
//     anchor the winner happened to be generated from.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IDEAL_PLAN_COPY,
  pickIdealAnchor,
  scorePlan,
  suggestIdealYearPlan,
  type IdealAnchorScore,
} from '@/lib/crop-plan-ideal';
import {
  autoSuggestPlan,
  recomputeLaterThisYear,
  type AutoSuggestAnswers,
  fillFirstSeasonGaps,
} from '@/lib/crop-autosuggest';
import { cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import {
  TRANSPLANT_BED_RESERVED_FROM_MONTHS,
  harvestEndMonthForCrop, harvestMonthForCrop,
  occupiedMonthsForPlanting, plantingBedEntryOffsets,
  type PlanBed, type Planting,
} from '@/lib/crop-plan';
import { wrapMonth } from '@/lib/crop-export-schedule';

const REAL_NOW = 8; // the August this feature was born in
const REAL_NOW_YEAR = 2026; // fixed: determinism oracle forbids reading the clock

// ── Rory's Carl & Sandys Place reconstruction (the verified sweep's config) ──
// 12 ordinary veg beds, ~9 m², minDim 1.4 m; his 23-crop chosen set; summer
// rainfall. The bed ids are the plan's own so the fixture stays byte-faithful
// to the sweep that produced the pinned winners.
const RORY_BED_IDS = [
  'bed-1784102618637-189', 'bed-1784102670139-399', 'bed-1784102671472-879',
  'bed-1784102673765-160', 'bed-1784102679793-650', 'bed-1784102683599-727',
  'bed-1784102684819-256', 'bed-1784102686303-765', 'bed-1784102696959-888',
  'bed-1783715002633-987', 'bed-1783716961055-878', 'bed-1783760063632-657',
];
const RORY_CROPS = [
  'maize', 'dry-beans', 'green-beans', 'butternut', 'pumpkin', 'swiss-chard', 'kale',
  'cabbage', 'carrots', 'beetroot', 'onions', 'tomatoes', 'peppers', 'sweet-potato',
  'potato', 'lettuce', 'amadumbe', 'groundnuts', 'peas', 'broad-beans', 'cucumber',
  'watermelon', 'oats',
];

function roryBeds(): PlanBed[] {
  return RORY_BED_IDS.map((id, i) => ({ id, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 1.4 }));
}

function roryAnswers(goal: 'family' | 'commercial', rhythm: 'steady' | 'few-big'): AutoSuggestAnswers {
  return {
    goal,
    focusCropCount: goal !== 'family' ? 2 : undefined,
    groups: [],
    cropKeys: RORY_CROPS,
    rhythm,
    rotateCrops: true,
    allowVinesInBeds: false,
    allowMixedCropsInBed: true,
    reliableIrrigation: true,
  };
}

const KIND_RANK: Record<string, number> = { warning: 0, choice: 1, gap: 2, basis: 3 };

// ── A. purity and determinism ────────────────────────────────────────────────

test('the module is pure: no clock, no randomness, identical inputs → identical output', () => {
  const source = readFileSync(new URL('../lib/crop-plan-ideal.ts', import.meta.url), 'utf8');
  for (const banned of ['Date.now', 'new Date(', 'Math.random']) {
    assert.ok(!source.includes(banned), `lib/crop-plan-ideal.ts must not use ${banned}`);
  }
  const a = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  const b = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ── B. the comparator, on synthetic scores ──────────────────────────────────

function score(overrides: Partial<IdealAnchorScore> & { anchorMonth: number }): IdealAnchorScore {
  return {
    zeroFreshMonths: [],
    minMonthlyFreshCrops: 3,
    meanMonthlyFreshCrops: 4,
    totalKg: 100,
    distinctCrops: 10,
    plantingCount: 20,
    sowMonthsUsed: [1],
    ...overrides,
  };
}

test('fewest zero-fresh months is the FIRST key in both rhythms — the blurb depends on it', () => {
  // A has one bare month but crushes B on every other measure.
  const a = score({ anchorMonth: 3, zeroFreshMonths: [6], totalKg: 900, minMonthlyFreshCrops: 9, distinctCrops: 20 });
  const b = score({ anchorMonth: 4, zeroFreshMonths: [], totalKg: 10, minMonthlyFreshCrops: 1, distinctCrops: 2 });
  for (const rhythm of ['steady', 'few-big'] as const) {
    assert.equal(pickIdealAnchor([a, b], REAL_NOW, rhythm).anchorMonth, 4,
      `${rhythm} must put continuity before everything else`);
  }
  assert.match(IDEAL_PLAN_COPY.idealBlurb, /fewest months without a fresh harvest/);
});

test('few-big puts total kg before the worst-month count; steady the reverse', () => {
  const bigKg = score({ anchorMonth: 5, totalKg: 500, minMonthlyFreshCrops: 0 });
  const evenSpread = score({ anchorMonth: 6, totalKg: 200, minMonthlyFreshCrops: 4 });
  assert.equal(pickIdealAnchor([bigKg, evenSpread], REAL_NOW, 'few-big').anchorMonth, 5);
  assert.equal(pickIdealAnchor([bigKg, evenSpread], REAL_NOW, 'steady').anchorMonth, 6);
});

test('a full tie resolves to the anchor starting soonest after the real today', () => {
  const scores = [score({ anchorMonth: 2 }), score({ anchorMonth: 9 }), score({ anchorMonth: 7 })];
  // From August, forward distances are: Sep=1, Feb=6, Jul=11.
  assert.equal(pickIdealAnchor(scores, REAL_NOW, 'steady').anchorMonth, 9);
});

// ── C. the empirical winners (pinned from the verified sweep) ───────────────

test('family/steady on the real farm: December wins with a gap-free repeating year', () => {
  // Re-pinned 2026-08-23 (was January): kale's duration/spacing verification
  // made it schedulable, and its fresh leaf coverage now closes the winter
  // gap from almost every anchor — 11 of 12 anchors sweep gap-free, so the
  // comparator falls through to soonest-after-today and December (4 months
  // out from the August REAL_NOW) beats January (5). Kale lands in its
  // published Feb/Mar summer-window months; the sweep was re-read by hand
  // before re-pinning, not just re-recorded.
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  assert.equal(ideal.best.anchorMonth, 12);
  assert.deepEqual(ideal.best.score.zeroFreshMonths, [],
    'the sweep found December leaves NO month without fresh harvest on this farm');
  assert.equal(ideal.sameAsToday, false);
  assert.equal(ideal.perAnchor.length, 12);
  ideal.perAnchor.forEach((entry, i) => assert.equal(entry.anchorMonth, i + 1, 'perAnchor is in anchor order'));
  // The August anchor really is worse — the whole reason this feature exists.
  const august = ideal.perAnchor[REAL_NOW - 1];
  assert.ok(august.zeroFreshMonths.length > ideal.best.score.zeroFreshMonths.length,
    `generating from August must actually be worse than the winner (got ${JSON.stringify(august.zeroFreshMonths)})`);
});

test('family/few-big on the real farm: March wins', () => {
  // Re-pinned 2026-08-23 (was October) for the same kale shift as the steady
  // pin above: with kale schedulable, March is the ONLY anchor whose year
  // sweeps gap-free (every other anchor leaves at least one bare month), so
  // the continuity-first key decides before kg is even compared.
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'few-big'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  assert.equal(ideal.best.anchorMonth, 3);
});

test('commercial/steady on the real farm: September wins', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('commercial', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  assert.equal(ideal.best.anchorMonth, 9);
});

// ── D. the truthfulness pass ─────────────────────────────────────────────────

test('the winner speaks from the real current month, not from its anchor', () => {
  const answers = roryAnswers('family', 'steady');
  const beds = roryBeds();
  const ideal = suggestIdealYearPlan(answers, 'summer', beds, [], REAL_NOW, REAL_NOW_YEAR);
  assert.notEqual(ideal.best.anchorMonth, REAL_NOW, 'fixture needs a winner from another month');

  // Waiting panel re-derived at the real month, byte-for-byte.
  assert.deepEqual(
    ideal.best.result.laterThisYear,
    recomputeLaterThisYear(answers, 'summer', beds, ideal.best.result.plantings, [], REAL_NOW),
  );

  // Exactly one basis note explains the whole-year choice, naming the REAL month.
  const basisText = IDEAL_PLAN_COPY.basisNote(MONTHS_SHORT[REAL_NOW - 1]);
  assert.equal(ideal.best.result.notes.filter((note) => note.text === basisText).length, 1);

  // The insertion preserved the engine's warning → choice → gap → basis order.
  let previous = -1;
  for (const note of ideal.best.result.notes) {
    assert.ok(KIND_RANK[note.kind] >= previous, `${note.kind} note out of order: "${note.text.slice(0, 50)}"`);
    previous = Math.max(previous, KIND_RANK[note.kind]);
  }

  // And the raw engine output was not mutated to get there.
  const raw = autoSuggestPlan(answers, 'summer', beds, [], ideal.best.anchorMonth);
  assert.ok(!raw.notes.some((note) => note.text.includes('repeating whole-year cycle')),
    'the basis note belongs to the wrapper result only');
});

test('ramp metadata is derived from the real current month, never the anchor', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  const fwd = (month: number) => ((month - REAL_NOW) % 12 + 12) % 12;
  // Scores and ramp metadata describe the repeating CYCLE — one-time starter
  // rows (`once`) are first-season extras and never join sowMonthsUsed.
  const cycleRows = ideal.best.result.plantings.filter((p) => typeof p.once !== 'string');
  const sowMonths = [...new Set(cycleRows.map((p) => p.sowMonth))].sort((a, b) => a - b);
  assert.deepEqual(ideal.best.score.sowMonthsUsed, sowMonths);
  assert.deepEqual(ideal.rampInMonths, sowMonths.filter((month) => month < REAL_NOW),
    'ramp-in months are the sow months already past THIS calendar year');
  assert.equal(ideal.monthsUntilFullCycle, Math.max(...sowMonths.map(fwd)));
  assert.equal(ideal.fullCycleByMonth, ((REAL_NOW + ideal.monthsUntilFullCycle - 1) % 12) + 1);
  const startNowExpected = [...new Set(
    ideal.best.result.plantings.filter((p) => fwd(p.sowMonth) <= 1).map((p) => p.cropKey),
  )];
  assert.deepEqual(ideal.startNowCropKeys, startNowExpected);
});

test('the transition year can only be leaner than the repeating year, never rosier', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  // A month with no supplier in the repeating template has none in year one
  // either, so the steady-state gaps are a subset of the first-year gaps —
  // with one precise exception: a one-time starter sowing (`once`) may feed
  // a year-one month the cycle never covers. The interrogation suite verifies
  // that exception is starter-justified across the whole parameter space;
  // here it is enough that any excused month comes with a starter at all.
  const hasStarters = ideal.best.result.plantings.some((p) => typeof p.once === 'string');
  for (const month of ideal.best.score.zeroFreshMonths) {
    assert.ok(ideal.firstYearZeroFreshMonths.includes(month) || hasStarters,
      `steady-state gap month ${month} missing from the first-year disclosure with no starter to excuse it`);
  }
  for (const month of ideal.firstYearZeroFreshMonths) {
    assert.ok(month >= 1 && month <= 12);
  }
});

test('a run that refuses to plan gets no whole-year dressing', () => {
  const answers = { ...roryAnswers('family', 'steady'), reliableIrrigation: false };
  const ideal = suggestIdealYearPlan(answers, 'summer', roryBeds(), [], REAL_NOW, REAL_NOW_YEAR);
  assert.equal(ideal.best.result.plantings.length, 0);
  assert.ok(!ideal.best.result.notes.some((note) => note.text.includes('repeating whole-year cycle')),
    'an empty plan must not claim to follow a whole-year cycle');
  assert.deepEqual(ideal.best.result.laterThisYear, []);
  assert.deepEqual(ideal.rampInMonths, []);
  assert.equal(ideal.monthsUntilFullCycle, 0);
  assert.equal(ideal.firstYearZeroFreshMonths.length, 12, 'no plan feeds no months');
});

// ── E. the existing-crop overlap warning ────────────────────────────────────

test('a crop really in the ground gets a bed-level warning when the cycle may overlap it', () => {
  // Swiss chard confirmed growing since July on the first bed holds it
  // August-December for real. The winning cycle is chosen at a synthetic
  // anchor that mis-ages that cohort, so the wrapper must replay the overlap
  // question at the REAL month and warn — warn, never block or drop.
  const beds = roryBeds();
  const existing: Planting[] = [{
    id: 'existing-chard', bedId: beds[0].id, cropKey: 'swiss-chard', sowMonth: 7, existing: true,
  }];
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', beds, existing, REAL_NOW, REAL_NOW_YEAR);
  assert.notEqual(ideal.best.anchorMonth, REAL_NOW, 'fixture needs a winner from another month');
  const proposedOnBed = ideal.best.result.plantings.filter((p) => p.bedId === beds[0].id);
  const chardMonths = new Set(occupiedMonthsForPlanting(existing[0]));
  const collides = proposedOnBed.some((p) => occupiedMonthsForPlanting(p).some((m) => chardMonths.has(m)));
  const warning = ideal.best.result.notes.find((note) =>
    note.text === IDEAL_PLAN_COPY.existingOverlapWarning(beds[0].label));
  if (collides) {
    assert.ok(warning, 'an overlapping bed must be named out loud');
    assert.deepEqual(warning!.bedIds, [beds[0].id]);
  } else {
    assert.equal(warning, undefined, 'no overlap, no warning');
  }
  // Whichever way the engine placed things, nothing existing was dropped:
  // the wrapper only ever ADDS notes, never removes plantings.
  assert.ok(ideal.best.result.plantings.every((p) => p.existing !== true));
});

// ── F. the copy ──────────────────────────────────────────────────────────────

test('no farmer-visible sentence leaks engine vocabulary', () => {
  const rendered = [
    IDEAL_PLAN_COPY.timingHeading, IDEAL_PLAN_COPY.fromNowLabel, IDEAL_PLAN_COPY.fromNowBlurb,
    IDEAL_PLAN_COPY.idealLabel, IDEAL_PLAN_COPY.idealBlurb, IDEAL_PLAN_COPY.busyLabel,
    IDEAL_PLAN_COPY.reviewHeading, IDEAL_PLAN_COPY.chosenLine, IDEAL_PLAN_COPY.sameAsTodayLine,
    IDEAL_PLAN_COPY.startNowLine('peas, carrots'),
    IDEAL_PLAN_COPY.rampInLine(1, 'Jan'), IDEAL_PLAN_COPY.rampInLine(3, 'Jan'),
    IDEAL_PLAN_COPY.residualGapLine('Jun'), IDEAL_PLAN_COPY.transitionGapLine('Sep'),
    IDEAL_PLAN_COPY.fewBigNote, IDEAL_PLAN_COPY.commercialNote,
    IDEAL_PLAN_COPY.basisNote('Aug'),
    IDEAL_PLAN_COPY.existingOverlapWarning('Bed 1'), IDEAL_PLAN_COPY.existingOverlapWarning('Bed 1, Bed 2'),
    IDEAL_PLAN_COPY.fullPlanHint,
    IDEAL_PLAN_COPY.starterLine('Kale (Aug), Lettuce (Sep)'), IDEAL_PLAN_COPY.starterBadge,
    IDEAL_PLAN_COPY.twoYearHeading, IDEAL_PLAN_COPY.twoYearLine, IDEAL_PLAN_COPY.fullBedsLine,
    IDEAL_PLAN_COPY.yearOneBand, IDEAL_PLAN_COPY.yearTwoBand,
  ];
  for (const text of rendered) {
    assert.ok(text.trim().length, 'no empty copy');
    for (const banned of [/anchor/i, /optimi[sz]er/i, /lexicographic/i, /cohort/i, /occupanc/i]) {
      assert.doesNotMatch(text, banned, `engine vocabulary in farmer copy: "${text}"`);
    }
  }
  // Grammar under both counts.
  assert.match(IDEAL_PLAN_COPY.rampInLine(1, 'Jan'), /1 sowing month has already passed/);
  assert.match(IDEAL_PLAN_COPY.rampInLine(3, 'Jan'), /3 sowing months have already passed/);
  assert.match(IDEAL_PLAN_COPY.existingOverlapWarning('Bed 1'), /that bed/);
  assert.match(IDEAL_PLAN_COPY.existingOverlapWarning('Bed 1, Bed 2'), /those beds/);
  // The ramp line owns the honest distinction: sowings STARTING, not the
  // cycle "running"; sowings coming around, not crops.
  assert.match(IDEAL_PLAN_COPY.rampInLine(2, 'Mar'), /those sowings come around next season/);
  assert.match(IDEAL_PLAN_COPY.rampInLine(2, 'Mar'), /will have started by Mar/);
});

// ── G. scorePlan is the same arithmetic the sweep verified ──────────────────

test('scorePlan counts distinct crops per month and never counts a cover crop as food', () => {
  const beds: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 10, minDimM: 1 }];
  // Oats: verified cover crop, yieldKgPerM2 === 0 — coverage must ignore it.
  const plantings: Planting[] = [
    { id: 'p1', bedId: 'b1', cropKey: 'oats', sowMonth: 4, areaFraction: 1 },
    { id: 'p2', bedId: 'b1', cropKey: 'swiss-chard', sowMonth: 2, areaFraction: 0.5 },
    { id: 'p3', bedId: 'b1', cropKey: 'swiss-chard', sowMonth: 3, areaFraction: 0.5 },
  ];
  const result = scorePlan(1, plantings, beds);
  assert.equal(result.distinctCrops, 2, 'oats is still a planted crop');
  assert.equal(result.minMonthlyFreshCrops, 0, 'oats must not paper over bare months as food');
  // Chard: 2 kg/m² × 10 m² × 0.5 share × two cohorts.
  assert.equal(result.totalKg, 20);
  assert.deepEqual(result.sowMonthsUsed, [2, 3, 4]);
  // Chard is the only FOOD here, so every covered month has exactly ONE fresh
  // crop — if two overlapping chard cohorts ever counted as two foods, the
  // mean would exceed the covered-month share.
  assert.equal(result.meanMonthlyFreshCrops,
    Math.round(((12 - result.zeroFreshMonths.length) / 12) * 100) / 100);
  assert.ok(result.zeroFreshMonths.length >= 4, 'two chard cohorts cannot feed the whole year');
});

// ── H. a saved starter is not invisible to the sweep ────────────────────────
//
// The sweep evaluates twelve HYPOTHETICAL anchor months, and inside the engine
// `nowMonth` is whichever one it is testing — not today. The occupancy ledger
// keeps two views of that: offsets from `nowMonth`, and calendar months. A
// template row is written to BOTH, and the calendar-month view is what makes
// it legible from every anchor, because the anchor frame is a ROTATION of the
// real one rather than a shift: read from a rotated frame, a real overlap can
// look clear, and a clear month can look taken.
//
// A saved one-time starter (`once`) used to be written to the offset ledger
// ALONE, on the reasoning that its months do not recur and so must not block
// the same-named months next year. That left it legible only from the anchor
// it was seeded under, and the sweep booked a second crop onto ground the
// starter genuinely held. Farmers saw plots printed at 200%.
//
// Both tests below measure what the PDF measures — plantingBedEntryOffsets
// against the REAL month, never a calendar-month shortcut. That distinction is
// load-bearing here: a template row sown in a month that has already passed
// has its first real sowing up to eleven months out, so its early calendar
// months belong to year TWO. Those are exactly the year-one holes a starter is
// added to fill, and a calendar-month oracle reports them as collisions when
// nothing collides.

const STARTER_BEDS: PlanBed[] = [
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `b${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 1.5, kind: 'bed' as const,
  })),
  { id: 'p1', label: 'Plot 1', areaM2: 100, minDimM: 7, kind: 'plot' as const },
  { id: 'p2', label: 'Plot 2', areaM2: 120, minDimM: 8, kind: 'plot' as const },
];

/** Printed occupancy: every row positioned against the REAL current month over
 *  a two-year horizon, exactly as the plan PDF and occupancy calendar do it.
 *  Returns bedId → offset → share of the bed committed. */
function printedLoad(plantings: readonly Planting[], realNowMonth: number) {
  const byBed = new Map<string, Map<number, number>>();
  for (const p of plantings) {
    const months = occupiedMonthsForPlanting(p);
    if (!months.length) continue;
    const share = p.areaFraction ?? 1;
    for (const start of plantingBedEntryOffsets(p, realNowMonth, 24)) {
      for (let i = 0; i < months.length; i++) {
        const offset = start + i;
        if (offset < 0 || offset >= 24) continue;
        let bed = byBed.get(p.bedId);
        if (!bed) { bed = new Map(); byBed.set(p.bedId, bed); }
        bed.set(offset, (bed.get(offset) ?? 0) + share);
      }
    }
  }
  return byBed;
}

test('a saved starter holds its ground whichever anchor the sweep is testing', () => {
  // Whole-plot maize sown in November, stamped for the coming November, read
  // from a farm whose real month is August. From anchors later in the year the
  // starter wrapped up to eleven months into that anchor's future, which is
  // precisely where the offset-only ledger went blind to it.
  const starter: Planting = {
    id: 'starter-maize', bedId: 'p1', cropKey: 'maize',
    sowMonth: 11, once: '2026-11', areaFraction: 1,
  };
  const answers = roryAnswers('family', 'steady');
  const blindAnchors: string[] = [];

  for (let anchorMonth = 1; anchorMonth <= 12; anchorMonth++) {
    const result = autoSuggestPlan(answers, 'summer', STARTER_BEDS, [starter], anchorMonth);
    // autoSuggestPlan returns only the rows it ADDED, so the starter goes back
    // in by hand to measure what the printed plot would actually carry.
    const load = printedLoad([starter, ...result.plantings], REAL_NOW).get('p1');
    const worst = Math.max(0, ...[...(load?.values() ?? [])]);
    if (worst > 1.0001) {
      blindAnchors.push(`anchored at ${MONTHS_SHORT[anchorMonth - 1]}: Plot 1 reaches ${Math.round(worst * 100)}%`);
    }
  }

  assert.deepEqual(blindAnchors, [],
    `the sweep booked ground the starter already holds:\n  ${blindAnchors.join('\n  ')}`);
});

test('accept a whole-year plan, regenerate against it, and nothing prints over 100%', () => {
  // The farmer-visible path end to end: generate, accept (rows merge into the
  // saved plan), regenerate against the saved plan — then read the result the
  // way the PDF reads it. Swept across every real starting month, because the
  // bug only surfaces when the winning anchor differs from today, which is
  // most of the year.
  const failures: string[] = [];

  for (const rhythm of ['steady', 'few-big'] as const) {
    for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
      const answers = roryAnswers('family', rhythm);
      const first = suggestIdealYearPlan(answers, 'summer', STARTER_BEDS, [], realNowMonth, REAL_NOW_YEAR);
      const accepted = [...first.best.result.plantings];
      if (!accepted.some((p) => typeof p.once === 'string')) continue; // no starter, nothing to pin

      const second = suggestIdealYearPlan(answers, 'summer', STARTER_BEDS, accepted, realNowMonth, REAL_NOW_YEAR);
      const finalPlan = [...accepted, ...second.best.result.plantings];

      for (const [bedId, cells] of printedLoad(finalPlan, realNowMonth)) {
        for (const [offset, total] of cells) {
          if (total > 1.0001) {
            failures.push(`${rhythm}, now=${MONTHS_SHORT[realNowMonth - 1]}: `
              + `${bedId} at +${offset} months is ${Math.round(total * 100)}%`);
          }
        }
      }
    }
  }

  assert.deepEqual(failures.slice(0, 10), [],
    `${failures.length} bed-months printed over 100%:\n  ${failures.slice(0, 10).join('\n  ')}`);
});

// ── I. the first-season fill is judged on MONTHS FED, not ground freed ───────
//
// fillFirstSeasonGaps exists to bridge year-one holes, but its sort asked only
// about ground: earliest sow, then shortest hold. Both are questions about when
// a bed comes free, and neither asks the question the pass was written for —
// whether the farmer eats that month. Measured on merged main before the fix,
// 84 of 605 starters ripened entirely after month 11 (77 of them lettuce): food
// arriving after the year it was placed to rescue, holding a bed the whole time.
//
// The named case, from the sweep: an August lettuce (hold 8-12, ripe at offset
// 12) beat an August swiss chard (hold 7-12, ripe 9-12) because lettuce frees
// the bed one month sooner — with offsets 9 and 11 sitting bare behind it.

/** Offsets 0..11 at which a row puts fresh food on the table, positioned
 *  against the REAL month. Cover crops and unverified timing are not food —
 *  the same exclusion scorePlan's freshWindow makes.
 *
 *  The nursery month is subtracted back off, and that is not a nicety: for the
 *  seven tray-raised crops (kale, cabbage, onions, tomatoes, peppers, lettuce,
 *  broccoli) plantingBedEntryOffsets already returns the BED-ENTRY offset,
 *  which includes TRANSPLANT_BED_RESERVED_FROM_MONTHS, while
 *  harvestMonthForCrop measures from the SOW month and adds the nursery itself.
 *  Adding the two dates every tray crop's harvest a month late — and with that
 *  error this file's own ceiling passed without the fix it exists to guard. */
function freshYearOneOffsets(p: Planting, realNowMonth: number): number[] {
  const crop = cropByKey(p.cropKey);
  if (!crop || crop.timingVerified === false || crop.yieldKgPerM2 === 0) return [];
  const monthsForward = (from: number, to: number) => ((to - from) % 12 + 12) % 12;
  const nursery = crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0;
  const toHarvest = monthsForward(p.sowMonth, harvestMonthForCrop(p.sowMonth, crop));
  const window = monthsForward(
    harvestMonthForCrop(p.sowMonth, crop),
    harvestEndMonthForCrop(p.sowMonth, crop),
  );
  const offsets: number[] = [];
  for (const bedEntry of plantingBedEntryOffsets(p, realNowMonth, 24)) {
    const sowOffset = bedEntry - nursery;
    for (let index = 0; index <= window; index++) {
      const offset = sowOffset + toHarvest + index;
      if (offset >= 0 && offset <= 11) offsets.push(offset);
    }
  }
  return offsets;
}

test('the whole-year plan leaves the farmer far fewer bare months in year one', () => {
  // Swept over both goals, both rhythms and all twelve real starting months on
  // the 4-bed-plus-2-plot farm. The ceiling is deliberately slack: merged main
  // scores 243 here and the coverage key scores 186, so 210 fails loudly if the
  // key is removed or reordered while leaving room for honest catalog drift.
  // It is NOT a target — 186 is not "good", it is "better", and most of what
  // remains is biology (nothing sown today ripens this month or next).
  let bare = 0;
  const worstFarms: string[] = [];

  for (const goal of ['family', 'commercial'] as const) {
    for (const rhythm of ['steady', 'few-big'] as const) {
      for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
        const answers = roryAnswers(goal, rhythm);
        const plan = suggestIdealYearPlan(
          answers, 'summer', STARTER_BEDS, [], realNowMonth, REAL_NOW_YEAR,
        ).best.result.plantings;

        const fed = new Set<number>();
        for (const p of plan) for (const offset of freshYearOneOffsets(p, realNowMonth)) fed.add(offset);

        let farmBare = 0;
        for (let offset = 0; offset <= 11; offset++) if (!fed.has(offset)) farmBare++;
        bare += farmBare;
        if (farmBare >= 9) {
          worstFarms.push(`${goal}/${rhythm} from ${MONTHS_SHORT[realNowMonth - 1]}: ${farmBare} bare`);
        }
      }
    }
  }

  assert.ok(bare <= 210,
    `${bare} bare year-one months across 48 farms (ceiling 210; merged main without the `
    + `coverage key scores 243). Worst:\n  ${worstFarms.join('\n  ') || '(none)'}`);
});

test('four beds bridge four different months, not the same earliest-sown crop', () => {
  // The mechanism, at the config where it was first named: commercial/few-big
  // on winter rainfall, planning from January. Ranked on ground alone, every
  // bed runs the same race and four beds reach the same two answers — merged
  // main gives Bed 1 and Bed 3 an August lettuce and Bed 2 and Bed 4 a January
  // cabbage, because those sow earliest and free the bed soonest. Four beds
  // then bridge two months between them and the rest of the year stays bare.
  //
  // Ranked on months fed, each bed takes the crop that covers what the ones
  // before it did not, so the count of distinct starter crops is the visible
  // signature: 2 without the coverage key, 4 with it.
  const plan = suggestIdealYearPlan(
    roryAnswers('commercial', 'few-big'), 'winter', STARTER_BEDS, [], 1, REAL_NOW_YEAR,
  ).best.result.plantings;

  const bedStarters = plan.filter((p) => typeof p.once === 'string' && p.bedId.startsWith('b'));
  const distinctCrops = new Set(bedStarters.map((p) => p.cropKey));

  assert.ok(distinctCrops.size >= 3,
    `${bedStarters.length} bed starters drew on only ${distinctCrops.size} crop(s) `
    + `(${[...distinctCrops].join(', ')}). Ranked on ground rather than months fed, every `
    + 'bed picks the same earliest-sown, shortest-holding crop and the farm bridges one month '
    + `four times over: ${bedStarters.map((p) => `${p.bedId}=${p.cropKey}@${p.sowMonth}`).join(' ')}`);
});


// ── THE FIRST-SEASON FILL COUNTED BEDS, NOT SHARE (2026-08-21) ─────────────
//
// The cycle sows quarter, third and half beds. The first-season fill kept a
// boolean ledger — "is anything here" — so a bed carrying ONE quarter-share
// crop read as fully spoken for and every starter that would have used the
// other three quarters was refused. Occupancy.fits, the cycle's own ledger,
// has always counted shares; this pass was the one place that did not.
//
// Measured over 288 test farms: months with nothing to sow 1044 → 974, farms
// with a completely bare sowing month 288 → 284, bare year-one HARVEST months
// 1094 → 884, and total kg up 6%. Ground sold twice stayed at 0.

function bedMonthCrops(plantings: readonly Planting[], realNowMonth: number) {
  const byBed = new Map<string, Map<number, Set<string>>>();
  for (const p of plantings) {
    const months = occupiedMonthsForPlanting(p);
    for (const start of plantingBedEntryOffsets(p, realNowMonth, 24)) {
      for (let i = 0; i < months.length; i++) {
        const offset = start + i;
        if (offset < 0 || offset >= 24) continue;
        let bed = byBed.get(p.bedId);
        if (!bed) { bed = new Map(); byBed.set(p.bedId, bed); }
        const set = bed.get(offset) ?? new Set<string>();
        set.add(p.cropKey);
        bed.set(offset, set);
      }
    }
  }
  return byBed;
}

test('a starter can take the free share of a part-used bed, not only an empty one', () => {
  // The signature is a starter that carries a share at all. Against a boolean
  // ledger this is unreachable by construction: any bed with a crop on it was
  // refused outright, so every starter that ever landed took a whole bed.
  const shares: string[] = [];
  for (const goal of ['family', 'commercial'] as const) {
    for (const rhythm of ['steady', 'few-big'] as const) {
      for (const pattern of ['summer', 'winter'] as const) {
        for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
          const plan = suggestIdealYearPlan(
            roryAnswers(goal, rhythm), pattern, STARTER_BEDS, [], realNowMonth, REAL_NOW_YEAR,
          ).best.result.plantings;
          for (const p of plan) {
            if (typeof p.once !== 'string') continue;
            const share = p.areaFraction ?? 1;
            if (share < 1) shares.push(`${goal}/${rhythm}/${pattern}/now${realNowMonth} ${p.bedId} ${p.cropKey} ${share.toFixed(2)}`);
          }
        }
      }
    }
  }
  assert.ok(shares.length > 0,
    'no starter took a partial share of a bed anywhere in 96 farms — the fill is still '
    + 'reading occupancy as yes/no, so three free quarters of a bed count as no room');
});

test('a starter never sells ground the cycle already sold', () => {
  for (const rhythm of ['steady', 'few-big'] as const) {
    for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
      const plan = suggestIdealYearPlan(
        roryAnswers('family', rhythm), 'summer', STARTER_BEDS, [], realNowMonth, REAL_NOW_YEAR,
      ).best.result.plantings;
      for (const [bedId, offsets] of printedLoad(plan, realNowMonth)) {
        for (const [offset, share] of offsets) {
          assert.ok(share <= 1.0001,
            `${bedId} is ${Math.round(share * 100)}% committed at offset ${offset} `
            + `(${rhythm}, from month ${realNowMonth}) — a share ledger that can exceed a `
            + 'whole bed is worse than the boolean one it replaced');
        }
      }
    }
  }
});

test('with mixing declined, no starter puts a second crop beside the first', () => {
  // The farmer's own answer, and the same rule Occupancy.fits applies to the
  // cycle. With mixing off the pass must collapse to exactly its old yes/no
  // behaviour rather than quietly sharing a bed.
  for (const rhythm of ['steady', 'few-big'] as const) {
    for (const pattern of ['summer', 'winter'] as const) {
      for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
        const answers = { ...roryAnswers('family', rhythm), allowMixedCropsInBed: false };
        const plan = suggestIdealYearPlan(
          answers, pattern, STARTER_BEDS, [], realNowMonth, REAL_NOW_YEAR,
        ).best.result.plantings;
        for (const p of plan) {
          assert.ok((p.areaFraction ?? 1) >= 1,
            `${p.cropKey} took ${p.areaFraction} of ${p.bedId} although the farmer asked for `
            + 'one crop per bed');
        }
        for (const [bedId, offsets] of bedMonthCrops(plan, realNowMonth)) {
          for (const [offset, crops] of offsets) {
            assert.equal(crops.size, 1,
              `${bedId} holds ${[...crops].join(' + ')} together at offset ${offset} `
              + `(${pattern}, from month ${realNowMonth}) — mixing was declined`);
          }
        }
      }
    }
  }
});

test('a starter sown three years ago cannot pick the crop for another bed', () => {
  // The coverage ledger added in the gap fix is plan-WIDE: it is the first
  // thing in this pass that lets one row reach a bed it does not stand on. A
  // stale `once` row resolved with monthsForward reads as food still coming,
  // and then picks the crop somewhere else. loadCropPlan's settleOnceRows
  // converts past `once` rows to existing before they normally arrive here, so
  // this was latent — but nothing in this pass asserted it, and a starter's
  // stamp already carries the year, so it can simply be read.
  //
  // Measured over these 24 fills, cross-bed changes from ONE stale row:
  // merged main 8, and 11 once the share ledger let more starters land. Now 0.
  //
  // The stale row's OWN bed is excluded on purpose. It still reaches rotation
  // history, which is a different channel with its own reading of a past crop,
  // and autoSuggestPlan reads stale rows too — neither is this pass's to
  // answer, and folding them in would make this guard measure something else.
  const otherBeds = ['b1', 'b3', 'b4', 'p1', 'p2'];
  const sig = (rows: readonly Planting[]) => rows
    .filter((p) => otherBeds.includes(p.bedId))
    .map((p) => `${p.bedId}|${p.cropKey}|${p.sowMonth}|${(p.areaFraction ?? 1).toFixed(3)}`)
    .sort().join(' ');

  for (const rhythm of ['steady', 'few-big'] as const) {
    for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
      const answers = roryAnswers('commercial', rhythm);
      const cycle = autoSuggestPlan(answers, 'winter', STARTER_BEDS, [], realNowMonth).plantings;
      const clean = sig(fillFirstSeasonGaps(
        answers, 'winter', STARTER_BEDS, cycle, [], realNowMonth, REAL_NOW_YEAR,
      ).starters);
      // Sown and eaten years before this plan begins. It holds no ground today
      // and it feeds nobody today.
      const stale: Planting = {
        id: 'stale-chard', bedId: 'b2', cropKey: 'swiss-chard',
        sowMonth: realNowMonth, once: `${REAL_NOW_YEAR - 3}-${String(realNowMonth).padStart(2, '0')}`,
      };
      const withStale = sig(fillFirstSeasonGaps(
        answers, 'winter', STARTER_BEDS, cycle, [stale], realNowMonth, REAL_NOW_YEAR,
      ).starters);
      assert.equal(withStale, clean,
        `a starter from ${REAL_NOW_YEAR - 3} on Bed 2 changed what other beds sow, planning `
        + `from month ${realNowMonth} (${rhythm}) — its stamp is being read as a month still to come`);
    }
  }
});

test('the coverage ledger gives the same answer every run', () => {
  // Re-added at the config where the ledger is actually exercised. The earlier
  // version of this test ran family/steady/summer on beds that place NO
  // starters, so it compared two empty fills and could never have failed.
  const build = () => suggestIdealYearPlan(
    roryAnswers('commercial', 'few-big'), 'winter', STARTER_BEDS, [], 1, REAL_NOW_YEAR,
  ).best.result.plantings
    .filter((p) => typeof p.once === 'string')
    .map((p) => `${p.bedId}|${p.cropKey}|${p.sowMonth}|${(p.areaFraction ?? 1).toFixed(3)}`)
    .sort();

  const first = build();
  assert.ok(first.length > 0, 'this config must place starters or the guard is vacuous again');
  for (let run = 0; run < 3; run++) {
    assert.deepEqual(build(), first, 'the fill is order-dependent across runs');
  }
});

// ── J. a stale `once` row must be read as history, not a sowing still ahead ─
//
// PR #312 fixed fillFirstSeasonGaps's OWN coverage ledger to read a `once`
// row's absolute YYYY-MM stamp instead of resolving it with monthsForward,
// which read a stamp from three years ago as three years IN THE FUTURE. Two
// other channels made that same mistake and were never touched by #312,
// because each reads `once` rows through its own separate machinery and
// neither asserted the dependency on settleOnceRows (which normally converts
// a stale `once` row to `existing: true` before either of these ever sees
// it) — every test below regenerates a plan at a LATER month than the one it
// was generated at, which is the gap that let both stay latent:
//
//  1. autoSuggestPlan's own Occupancy ledger (used for the succession CYCLE,
//     not the first-season fill) — a stale row seeded there blocked its
//     calendar month on the ANNUAL ledger forever, steering the cycle chosen
//     on every bed, not just the stale row's own.
//  2. BedRotation, seeded from `existingPlantings` in every caller — a stale
//     row was always forward-anchored as "a sowing still ahead", corrupting
//     the family-rotation history of its own bed.
//
// Neither test below uses "the row absent" as its reference: a saved once
// row, however stale, is real information the engine must schedule around.
// The only proven-correct reading of a stale row is the one loadCropPlan's
// settleOnceRows already gives it every time a farmer reopens the app — a
// plain `existing: true` row, sowMonth unchanged. That settled equivalent is
// the reference both tests check against.

test('a stale once row reads exactly like its own settled-existing equivalent (autoSuggestPlan)', () => {
  // The task's own measurement: family/steady/summer, injecting a once row
  // stamped three years ago changed the CYCLE at realNowMonth 1, 5 and 9 —
  // even though the stale row's own crop/bed never appears in the emitted
  // plan (autoSuggestPlan returns only what it ADDS, so this is entirely the
  // stale row steering what gets picked elsewhere).
  const beds = roryBeds();
  const sig = (r: { plantings: readonly Planting[] }) => r.plantings
    .map((p) => `${p.bedId}|${p.cropKey}|${p.sowMonth}|${(p.areaFraction ?? 1).toFixed(3)}`)
    .sort().join(' ');

  for (const realNowMonth of [1, 5, 9]) {
    const answers = roryAnswers('family', 'steady');
    const staleStamp = `${REAL_NOW_YEAR - 3}-${String(realNowMonth).padStart(2, '0')}`;
    const settled: Planting = {
      id: 'stale-row', bedId: beds[0].id, cropKey: 'tomatoes', sowMonth: realNowMonth, existing: true,
    };
    const staleOnce: Planting = {
      id: 'stale-row', bedId: beds[0].id, cropKey: 'tomatoes', sowMonth: realNowMonth, once: staleStamp,
    };

    const expected = sig(autoSuggestPlan(answers, 'summer', beds, [settled], realNowMonth));
    const actual = sig(autoSuggestPlan(
      answers, 'summer', beds, [staleOnce], realNowMonth,
      { year: REAL_NOW_YEAR, month: realNowMonth },
    ));
    assert.equal(actual, expected,
      `a once row stamped ${staleStamp} (three years stale) produced a different cycle than its `
      + `settled-existing equivalent, planning from month ${realNowMonth} — it is being read as a `
      + 'sowing still to come');
  }
});

test('a stale once row on its own bed reads like its settled equivalent in rotation history too', () => {
  // Companion to "a starter sown three years ago cannot pick the crop for
  // another bed" above, which deliberately excludes the stale row's OWN bed
  // (b2) — per its own comment, rotation history is a different channel with
  // its own reading of a past crop, not that pass's to answer. Now it is:
  // fillFirstSeasonGaps passes realNow to its own BedRotation unconditionally,
  // so a stale row reaches rotation history exactly as its settled-existing
  // equivalent would.
  //
  // sowMonth is offset four months from realNowMonth on purpose — AT
  // sowMonth === nowMonth, existingSowOffset (the settled/backward reading)
  // and monthsForward (the old, wrong once-row reading) degenerately compute
  // the SAME offset, so that fixture cannot tell the two readings apart. An
  // offset that actually differs between them is what makes this a real test.
  const allBeds = ['b1', 'b2', 'b3', 'b4', 'p1', 'p2'];
  const sig = (rows: readonly Planting[]) => rows
    .filter((p) => allBeds.includes(p.bedId))
    .map((p) => `${p.bedId}|${p.cropKey}|${p.sowMonth}|${(p.areaFraction ?? 1).toFixed(3)}`)
    .sort().join(' ');

  for (const rhythm of ['steady', 'few-big'] as const) {
    for (let realNowMonth = 1; realNowMonth <= 12; realNowMonth++) {
      const staleSowMonth = wrapMonth(realNowMonth + 4);
      const answers = roryAnswers('commercial', rhythm);
      const cycle = autoSuggestPlan(answers, 'winter', STARTER_BEDS, [], realNowMonth).plantings;
      const settled: Planting = {
        id: 'stale-chard', bedId: 'b2', cropKey: 'swiss-chard', sowMonth: staleSowMonth, existing: true,
      };
      const settledFill = sig(fillFirstSeasonGaps(
        answers, 'winter', STARTER_BEDS, cycle, [settled], realNowMonth, REAL_NOW_YEAR,
      ).starters);
      // Whichever real year puts staleSowMonth unambiguously in the past —
      // the exact year does not matter to the fix, only that it is one.
      const staleYear = staleSowMonth > realNowMonth ? REAL_NOW_YEAR - 4 : REAL_NOW_YEAR - 3;
      const staleOnce: Planting = {
        id: 'stale-chard', bedId: 'b2', cropKey: 'swiss-chard', sowMonth: staleSowMonth,
        once: `${staleYear}-${String(staleSowMonth).padStart(2, '0')}`,
      };
      const withStale = sig(fillFirstSeasonGaps(
        answers, 'winter', STARTER_BEDS, cycle, [staleOnce], realNowMonth, REAL_NOW_YEAR,
      ).starters);
      assert.equal(withStale, settledFill,
        `a once row stamped ${staleYear}-${String(staleSowMonth).padStart(2, '0')} on its own bed `
        + `(b2) filled differently than its settled-existing equivalent, planning from month `
        + `${realNowMonth} (${rhythm}) — BedRotation is reading it as a sowing still ahead`);
    }
  }
});

test('a once row with no realNow context warns in dev, and stops once realNow is supplied', () => {
  // Never a throw: this file's own "a starter sown three years ago..." tests
  // above (and other test files) deliberately feed raw, unsettled `once` rows
  // straight into these functions with no realNow at all, to probe library
  // behaviour in isolation — an established idiom this guard must not break.
  // It exists to catch a caller-discipline regression (a future call site
  // that forgets to wire realNow through), not to re-detect staleness itself.
  const beds = roryBeds();
  const answers = roryAnswers('family', 'steady');
  const onceRow: Planting = {
    id: 'r1', bedId: beds[0].id, cropKey: 'tomatoes', sowMonth: 3, once: '2023-03',
  };
  const originalWarn = console.warn;
  try {
    const withoutRealNow: unknown[][] = [];
    console.warn = (...args: unknown[]) => { withoutRealNow.push(args); };
    autoSuggestPlan(answers, 'summer', beds, [onceRow], 5);
    assert.ok(withoutRealNow.length > 0,
      'a once-carrying row arrived with no realNow context and nothing warned that staleness '
      + 'cannot be checked');

    const withRealNow: unknown[][] = [];
    console.warn = (...args: unknown[]) => { withRealNow.push(args); };
    autoSuggestPlan(answers, 'summer', beds, [onceRow], 5, { year: 2026, month: 5 });
    assert.equal(withRealNow.length, 0,
      'realNow was supplied, so staleness can be checked directly — nothing should warn');
  } finally {
    console.warn = originalWarn;
  }
});
