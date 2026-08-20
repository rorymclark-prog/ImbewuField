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
} from '@/lib/crop-autosuggest';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { occupiedMonthsForPlanting, type PlanBed, type Planting } from '@/lib/crop-plan';

const REAL_NOW = 8; // the August this feature was born in

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
  const a = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
  const b = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
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

test('family/steady on the real farm: January wins with a gap-free repeating year', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
  assert.equal(ideal.best.anchorMonth, 1);
  assert.deepEqual(ideal.best.score.zeroFreshMonths, [],
    'the sweep found January leaves NO month without fresh harvest on this farm');
  assert.equal(ideal.sameAsToday, false);
  assert.equal(ideal.perAnchor.length, 12);
  ideal.perAnchor.forEach((entry, i) => assert.equal(entry.anchorMonth, i + 1, 'perAnchor is in anchor order'));
  // The August anchor really is worse — the whole reason this feature exists.
  const august = ideal.perAnchor[REAL_NOW - 1];
  assert.ok(august.zeroFreshMonths.length > ideal.best.score.zeroFreshMonths.length,
    `generating from August must actually be worse than the winner (got ${JSON.stringify(august.zeroFreshMonths)})`);
});

test('family/few-big on the real farm: October wins', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'few-big'), 'summer', roryBeds(), [], REAL_NOW);
  assert.equal(ideal.best.anchorMonth, 10);
});

test('commercial/steady on the real farm: September wins', () => {
  const ideal = suggestIdealYearPlan(roryAnswers('commercial', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
  assert.equal(ideal.best.anchorMonth, 9);
});

// ── D. the truthfulness pass ─────────────────────────────────────────────────

test('the winner speaks from the real current month, not from its anchor', () => {
  const answers = roryAnswers('family', 'steady');
  const beds = roryBeds();
  const ideal = suggestIdealYearPlan(answers, 'summer', beds, [], REAL_NOW);
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
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
  const fwd = (month: number) => ((month - REAL_NOW) % 12 + 12) % 12;
  const sowMonths = [...new Set(ideal.best.result.plantings.map((p) => p.sowMonth))].sort((a, b) => a - b);
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
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', roryBeds(), [], REAL_NOW);
  // A month with no supplier in the repeating template has none in year one
  // either, so the steady-state gaps are a subset of the first-year gaps.
  for (const month of ideal.best.score.zeroFreshMonths) {
    assert.ok(ideal.firstYearZeroFreshMonths.includes(month),
      `steady-state gap month ${month} missing from the first-year disclosure`);
  }
  for (const month of ideal.firstYearZeroFreshMonths) {
    assert.ok(month >= 1 && month <= 12);
  }
});

test('a run that refuses to plan gets no whole-year dressing', () => {
  const answers = { ...roryAnswers('family', 'steady'), reliableIrrigation: false };
  const ideal = suggestIdealYearPlan(answers, 'summer', roryBeds(), [], REAL_NOW);
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
  const ideal = suggestIdealYearPlan(roryAnswers('family', 'steady'), 'summer', beds, existing, REAL_NOW);
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
