// ── The two things the plan knew and never said ─────────────────────────────
//
// Audit, 2026-08-20. Both defects here are the same shape: the app HELD the
// fact, computed it correctly, and then dropped it before it reached a farmer.
//
//  1. PLAN NOTES. autoSuggestPlan produced ranked, typed explanatory notes —
//     the warnings, the choices the planner made, the beds it left bare — and
//     acceptAutoSuggest copied `plantings` out of the result and threw the
//     notes away. They were readable exactly once, in a modal the farmer
//     dismisses by accepting the plan, and re-running the suggester against the
//     now-populated plan produces DIFFERENT notes, so they were unrecoverable
//     by any route.
//
//  2. STORAGE. Ten crops carry a sourced storageMonths, the storage conditions
//     that shelf life depends on, and the source URL. storageConditions and
//     storageSourceUrl rendered NOWHERE in app/, components/ or lib/, and
//     buildYearReport read only the 'fresh' half of buildFoodAvailability — so
//     on 47.7% of generated plans (measured, this sweep) it announced a hungry
//     stretch across months in which the same plan's own storage tail was
//     still running.
//
// These tests hold both: the notes survive Accept and reach the PDF, and no
// quiet-month sentence names a month the plan's own storage covers without
// saying so.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { autoSuggestPlan, type AutoSuggestAnswers, type PlanNote } from '@/lib/crop-autosuggest';
import { CROPS, cropByKey, MONTHS_SHORT, type RainPattern } from '@/lib/crop-catalog';
import {
  buildFoodAvailability,
  buildYearReport,
  type CropPlanState,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { buildPlanDashboard } from '@/lib/crop-export-benchmark';
import { accountLocalStorageKey, bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';
import {
  sanitiseProductionRecords, sanitisePreservedFoodRecords,
  productionRecordsForSite, preservedFoodRecordsForSite,
  replaceProductionRecordsForSite, replacePreservedFoodRecordsForSite,
  type DatedProductionRecord, type PreservedFoodRecord,
} from '@/lib/production-records';

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PAGE = source('../app/facilitator/crops/page.tsx');
const CROP_PLAN_LIB = source('../lib/crop-plan.ts');

function bedsFor(bedCount: number, plotCount: number, areaM2: number): PlanBed[] {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= bedCount; i++) {
    beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2, minDimM: i % 3 === 1 ? 0.8 : i % 3 === 2 ? 1.2 : 3 });
  }
  for (let i = 1; i <= plotCount; i++) {
    beds.push({ id: `p${i}`, label: `Plot ${i}`, areaM2: 90 + i * 12, minDimM: 11, kind: 'plot' });
  }
  return beds;
}

interface SweepCase {
  label: string;
  beds: PlanBed[];
  pattern: RainPattern;
  nowMonth: number;
  answers: AutoSuggestAnswers;
}

/** Same structural sweep tests/crop-plan-notes.test.ts uses: every rainfall
 * pattern, every goal, farms with and without staple plots, four start months. */
function* sweep(): Generator<SweepCase> {
  let n = 0;
  for (const bedCount of [1, 3, 9, 14]) {
    for (const plotCount of [0, 4]) {
      for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as RainPattern[]) {
        for (const goal of ['family', 'commercial', 'hybrid'] as const) {
          for (const nowMonth of [1, 4, 8, 11]) {
            n++;
            yield {
              label: `${bedCount}b/${plotCount}p ${pattern} ${goal} now=${nowMonth}`,
              beds: bedsFor(bedCount, plotCount, [4, 9, 16][n % 3]),
              pattern,
              nowMonth,
              answers: {
                goal,
                householdSize: 'medium',
                focusCropCount: (n % 3) + 1,
                groups: [],
                rhythm: n % 2 === 0 ? 'steady' : 'few-big',
                rotateCrops: n % 3 !== 0,
                allowVinesInBeds: n % 4 === 0,
                allowMixedCropsInBed: n % 2 === 0,
                reliableIrrigation: true,
              },
            };
          }
        }
      }
    }
  }
}

// ── A. the storage contradiction ────────────────────────────────────────────

test('a planned-crop comparison cannot contradict existing October and November pickings', () => {
  // The live October sample showed cabbage/onions ready while an undated
  // new-crop narrative declared Sep–Nov empty. The dated calendar owns that
  // question; a benchmark comparison must not answer it a second way.
  const beds = bedsFor(3, 0, 9);
  const plantings: Planting[] = [
    { id: 'growing-cabbage', bedId: 'b1', cropKey: 'cabbage', sowMonth: 3, existing: true },
    { id: 'growing-onions', bedId: 'b2', cropKey: 'onions', sowMonth: 3, existing: true },
    { id: 'new-tomatoes', bedId: 'b3', cropKey: 'tomatoes', sowMonth: 10 },
  ];
  const before = JSON.stringify({ beds, plantings });
  const dated = buildFoodAvailability(plantings, beds, 10, 12);
  assert.ok(dated[0].some((item) => item.cropKey === 'cabbage' && item.status === 'fresh'));
  assert.ok(dated[1].some((item) => item.cropKey === 'onions' && item.status === 'fresh'));
  const annual = buildYearReport(plantings, beds);
  assert.ok(annual.some((line) => line.startsWith('No verified fresh-picking window')),
    'the control must reproduce the separate annual timing claim');
  const comparison = buildYearReport(plantings, beds, { includeCalendarNarrative: false });
  assert.equal(comparison[0], annual[0], 'removing a timing claim must not alter the sourced benchmark');
  assert.match(comparison[0], /new bed crop cycles in this comparison/);
  assert.doesNotMatch(comparison.join(' '), /No verified fresh-picking window|Nothing is due for picking|usable in/);
  assert.equal(JSON.stringify({ beds, plantings }), before, 'presentation must not rewrite saved plantings or areas');
});

test('a dated-screen comparison leaves annual gaps and storage months to the calendar', () => {
  const beds = bedsFor(1, 0, 9);
  const plantings: Planting[] = [{ id: 'bn', bedId: 'b1', cropKey: 'butternut', sowMonth: 10 }];
  const annual = buildYearReport(plantings, beds);
  assert.ok(annual.some((line) => line.startsWith('No verified fresh-picking window')));
  assert.ok(annual.some((line) => /can be kept after harvest/.test(line)), 'storage control must exercise a real sourced duration');
  assert.match(annual.find((line) => line.startsWith('No verified fresh-picking window'))!, /repeating new bed crop cycles only/);
  assert.doesNotMatch(annual.join(' '), /Nothing is due for picking/);
  const comparison = buildYearReport(plantings, beds, { includeCalendarNarrative: false });
  assert.equal(comparison[0], annual[0]);
  assert.ok(comparison.some((line) => line.startsWith('Within the benchmark comparison')));
  assert.doesNotMatch(comparison.join(' '), /scheduled around|usable in|can be kept after harvest/);
});

test('removing annual timing prose retains unknown yields, cover crops and area-conflict warnings', () => {
  const beds = bedsFor(1, 0, 9);
  const options = { includeCalendarNarrative: false };
  const unknown = buildYearReport([{ id: 'unknown', bedId: 'b1', cropKey: 'amadumbe', sowMonth: 4 }], beds, options).join(' ');
  assert.match(unknown, /no verified kg\/m² benchmark/);
  assert.match(unknown, /treating it as 0kg would be false/);
  const cover = buildYearReport([{ id: 'cover', bedId: 'b1', cropKey: 'oats', sowMonth: 5 }], beds, options).join(' ');
  assert.match(cover, /soil-cover crop.*0 food kg.*not as a failed harvest/);
  const conflict = buildYearReport([
    { id: 'one', bedId: 'b1', cropKey: 'tomatoes', sowMonth: 10 },
    { id: 'two', bedId: 'b1', cropKey: 'maize', sowMonth: 10 },
  ], beds, options).join(' ');
  assert.match(conflict, /No kilogram or value total.*overlapping or invalid planting shares/);
});

/** The months the quiet-month sentence claims nothing is due for picking in. */
function quietRunFromSentence(sentence: string): number[] | null {
  const match = sentence.match(/scheduled around ([A-Za-z]{3})(?:-([A-Za-z]{3}))?\./);
  if (!match) return null;
  const start = MONTHS_SHORT.indexOf(match[1]) + 1;
  const end = match[2] ? MONTHS_SHORT.indexOf(match[2]) + 1 : start;
  if (start < 1 || end < 1) return null;
  const run: number[] = [];
  let month = start;
  for (let step = 0; step < 12; step++) {
    run.push(month);
    if (month === end) break;
    month = (month % 12) + 1;
  }
  return run;
}

/** Every month "Apr-Jun, Aug" names — INCLUDING the interior of a range, which
 *  a bare split on /[,-]/ silently skips, so a phantom month could hide between
 *  two honest endpoints. Ranges may wrap the year end (monthRunsLabel prints
 *  cyclic runs). Unparseable tokens come back in `bad` so the caller can name
 *  them instead of passing them silently. */
function namedStorageMonths(label: string): { months: number[]; bad: string[] } {
  const months: number[] = [];
  const bad: string[] = [];
  for (const piece of label.split(',')) {
    const ends = piece.split('-').map((token) => token.trim());
    const indices = ends.map((token) => MONTHS_SHORT.indexOf(token) + 1);
    if (indices.some((m) => m < 1) || indices.length > 2) { bad.push(piece.trim()); continue; }
    if (indices.length === 1) { months.push(indices[0]); continue; }
    let month = indices[0];
    months.push(month);
    for (let step = 0; step < 12 && month !== indices[1]; step++) {
      month = (month % 12) + 1;
      months.push(month);
    }
  }
  return { months, bad };
}

test('the fixture that used to contradict itself now names the storage that covers the gap', () => {
  // Butternut: sourced 2 storage months (FAO), harvested from a summer sowing.
  // The exact shape the audit measured — a quiet stretch that the plan's own
  // cured, ventilated butternut sits inside.
  const beds = bedsFor(1, 0, 9);
  const plantings: Planting[] = [{ id: 'bn', bedId: 'b1', cropKey: 'butternut', sowMonth: 10 }];
  const availability = buildFoodAvailability(plantings, beds);
  const storedMonths: number[] = [];
  for (let month = 1; month <= 12; month++) {
    if (availability[month].some((item) => item.status === 'stored')) storedMonths.push(month);
  }
  assert.ok(storedMonths.length > 0, 'the fixture must actually produce stored months, or it tests nothing');

  const report = buildYearReport(plantings, beds);
  const quiet = report.find((line) => line.startsWith('No verified fresh-picking window is scheduled around'));
  assert.ok(quiet, `the fixture must still produce a quiet-month line: ${JSON.stringify(report)}`);
  const run = quietRunFromSentence(quiet!);
  assert.ok(run, 'the quiet-month sentence must stay parseable');
  const covered = run!.filter((month) => storedMonths.includes(month));
  assert.ok(covered.length > 0, 'the fixture must overlap the quiet run, or the contradiction cannot be reproduced');

  assert.match(quiet!, /Stored butternut should still be usable in/,
    'the sentence must acknowledge the storage that covers part of the gap it announces');
  // Named months must be months this plan really marks stored — every month,
  // interior of a range included.
  const named = namedStorageMonths(quiet!.match(/usable in ([^.]+?) if/)![1]);
  assert.deepEqual(named.bad, [], 'unparseable month tokens in the storage clause');
  for (const monthIndex of named.months) {
    assert.ok(storedMonths.includes(monthIndex),
      `${MONTHS_SHORT[monthIndex - 1]} is named as stored but buildFoodAvailability does not mark it stored on this plan`);
  }
});

test('no quiet-month line names a stretch the plan stores food across without saying so', () => {
  const offenders: string[] = [];
  let plansWithCoveredGap = 0;
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    if (!result.plantings.length) continue;
    const toPlant = result.plantings.filter((planting) => !planting.existing);
    const availability = buildFoodAvailability(toPlant, scenario.beds);
    const storedMonths = new Set<number>();
    for (let month = 1; month <= 12; month++) {
      if (availability[month].some((item) => item.status === 'stored')) storedMonths.add(month);
    }
    const quiet = buildYearReport(result.plantings, scenario.beds)
      .find((line) => line.startsWith('No verified fresh-picking window is scheduled around'));
    if (!quiet) continue;
    const run = quietRunFromSentence(quiet);
    if (!run) { offenders.push(`${scenario.label}: unparseable quiet line — ${quiet}`); continue; }
    const covered = run.filter((month) => storedMonths.has(month));
    if (!covered.length) {
      // The other half of the contract: a gap with NO storage behind it must
      // not grow a storage clause out of nowhere.
      if (/Stored /.test(quiet)) offenders.push(`${scenario.label}: storage clause with no stored month — ${quiet}`);
      continue;
    }
    plansWithCoveredGap++;
    if (!/Stored .+ should still be usable in /.test(quiet)) {
      offenders.push(`${scenario.label}: silent about stored cover in ${covered.map((m) => MONTHS_SHORT[m - 1]).join(',')} — ${quiet}`);
      continue;
    }
    // Every month the clause names must really be stored on THIS plan —
    // interior months of a range included, not just its endpoints.
    const namedMatch = quiet.match(/usable in ([^.]+?) if/);
    if (!namedMatch) { offenders.push(`${scenario.label}: unreadable storage clause — ${quiet}`); continue; }
    const named = namedStorageMonths(namedMatch[1]);
    for (const token of named.bad) offenders.push(`${scenario.label}: unparseable month "${token}" — ${quiet}`);
    for (const monthIndex of named.months) {
      if (!storedMonths.has(monthIndex)) {
        offenders.push(`${scenario.label}: names ${MONTHS_SHORT[monthIndex - 1]} as stored, but the plan does not store then — ${quiet}`);
      }
    }
  }
  // A gate that never meets the population it guards is not a gate.
  assert.ok(plansWithCoveredGap >= 50,
    `only ${plansWithCoveredGap} plans in the sweep had a storage-covered quiet stretch — this gate has stopped testing anything`);
  assert.deepEqual(offenders.slice(0, 5), [], `${offenders.length} quiet-month lines still contradict the plan's own storage`);
});

test('the storage sentence appears exactly when the plan stores something, and names only crops it stores', () => {
  const offenders: string[] = [];
  let withStorage = 0;
  let withoutStorage = 0;
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    if (!result.plantings.length) continue;
    const toPlant = result.plantings.filter((planting) => !planting.existing);
    const availability = buildFoodAvailability(toPlant, scenario.beds);
    const storedNames = new Set(
      availability.slice(1, 13).flatMap((month) => month
        .filter((item) => item.status === 'stored')
        .map((item) => item.name)),
    );
    const report = buildYearReport(result.plantings, scenario.beds);
    // Only plans that reach the narrative body — an area conflict or a zero
    // known total returns early, and neither of those is a storage claim.
    if (!report.some((line) => line.startsWith('For crops with a verified kg/m² benchmark'))) continue;
    const line = report.find((paragraph) => / can be kept after harvest instead of being eaten straight away\./.test(paragraph));
    if (storedNames.size === 0) {
      withoutStorage++;
      if (line) offenders.push(`${scenario.label}: storage sentence on a plan that stores nothing — ${line}`);
      continue;
    }
    withStorage++;
    if (!line) { offenders.push(`${scenario.label}: stores ${[...storedNames].join(', ')} and says nothing`); continue; }
    for (const name of storedNames) {
      const asWritten = name.charAt(0).toLowerCase() + name.slice(1);
      if (!line.includes(name) && !line.includes(asWritten)) {
        offenders.push(`${scenario.label}: stores ${name} but the sentence omits it — ${line}`);
      }
    }
    // And it promises nothing about feeding anyone.
    if (/will feed|will carry|guarantee/i.test(line)) {
      offenders.push(`${scenario.label}: the storage sentence makes a promise — ${line}`);
    }
  }
  assert.ok(withStorage >= 50 && withoutStorage >= 1,
    `sweep saw ${withStorage} storing plans and ${withoutStorage} non-storing ones — both populations are needed`);
  assert.deepEqual(offenders.slice(0, 5), [], `${offenders.length} plans mis-state their storage`);
});

// ── B. the sourced conditions become farmer-visible ─────────────────────────

test('every crop with a sourced shelf life has its conditions and source reachable in the planner UI', () => {
  const storageCrops = CROPS.filter((crop) => (crop.storageMonths ?? 0) > 0);
  assert.ok(storageCrops.length >= 10, `${storageCrops.length} crops carry a sourced shelf life — the sweep expects the 2026-08-20 wave`);
  for (const crop of storageCrops) {
    assert.ok(crop.storageConditions?.trim(), `${crop.key} has a shelf life with no conditions`);
    assert.ok(crop.storageSourceUrl?.startsWith('https://'), `${crop.key} has a shelf life with no source`);
  }
  // One renderer prints all three, so no crop can be individually forgotten:
  // it reads them off the CropDef rather than off a hand-maintained list.
  assert.match(PAGE, /function CropStorageLine\(\{ crop \}: \{ crop: CropDef \}\)/,
    'the storage line must be a single crop-driven renderer, not per-crop copy');
  assert.match(PAGE, /crop\.storageConditions/, 'the conditions must render');
  assert.match(PAGE, /href=\{crop\.storageSourceUrl\}/, 'the source must render as a link');
  assert.match(PAGE, /rel="noopener noreferrer"/, 'the source link keeps the page\'s existing link hygiene');
  // ...and it is mounted in the planting detail sheet, next to the sow/harvest line.
  assert.match(PAGE, /<CropStorageLine crop=\{crop\} \/>\s*\n\s*<div>\{(?:inlineText\(lang, crop\.note\)|crop\.note)\}<\/div>/,
    'the planting detail sheet must show the storage line');
});

test('the availability chart reaches its stored detail by tap, not only by hover', () => {
  // The stored half of the chart used to explain itself ONLY through a `title`
  // attribute — invisible on the phones this app is used on.
  // The calendar now spans two years. Select the column offset, not the
  // repeated month number, so tapping next September cannot open this September.
  assert.match(PAGE, /setOpenMonth\(openMonth === i \? null : i\)/, 'a specific month occurrence must be tappable');
  assert.match(PAGE, /aria-expanded=\{openMonth === i\}/, 'only that occurrence announces its expanded state');
  assert.match(PAGE, /month=\{monthOrder\[openMonth\]\}/, 'the detail names the selected calendar month');
  assert.match(PAGE, /items=\{availability\[openMonth\]/, 'the detail reads the selected occurrence, not a repeated annual bucket');
  assert.match(PAGE, /<MonthAvailabilityDetail/, 'the tap must open a per-month detail');
  assert.match(PAGE, /function MonthAvailabilityDetail\(/, 'the detail renderer must exist');
  // The detail reuses the SAME storage renderer as the planting sheet, so the
  // shelf life and its conditions cannot drift between the two.
  const detail = PAGE.slice(PAGE.indexOf('function MonthAvailabilityDetail('), PAGE.indexOf('// ── Plan notes, grouped by kind'));
  assert.match(detail, /<CropStorageLine crop=\{crop\} \/>/, 'the month detail must use the shared storage line');
  // Desktop hover is additive, not a replacement — it stays.
  assert.match(PAGE, /title=\{\[\.\.\.stored, \.\.\.fresh\]/, 'the hover text stays for a mouse');
});

// ── C. the PDF carries the storage stat ─────────────────────────────────────

test('the dated dashboard counts storage after its sowing and names the crops behind it', () => {
  const beds = bedsFor(1, 0, 9);
  const stored = buildPlanDashboard(
    [{ id: 'bn', bedId: 'b1', cropKey: 'butternut', sowMonth: 10 }],
    beds, [], { nowMonth: 10 },
  );
  // An upcoming October sowing has food and storage later in an October-start
  // year. The previous annual wrap wrongly borrowed that same future crop
  // into the January-start year before it was sown.
  const beforeSowing = buildPlanDashboard(
    [{ id: 'bn', bedId: 'b1', cropKey: 'butternut', sowMonth: 10 }],
    beds, [], { nowMonth: 1 },
  );
  assert.equal(beforeSowing.storedFoodMonths, 0);
  assert.deepEqual(beforeSowing.storedFoodCrops, []);
  assert.ok(stored.storedFoodMonths > 0, 'a sourced shelf life must produce stored months');
  assert.deepEqual(stored.storedFoodCrops, ['Butternut']);

  // A plan with no storage crop degrades to a real zero and an empty list —
  // never an invented shelf life.
  const freshOnly = CROPS.find((crop) => crop.storageMonths === undefined
    && crop.timingVerified !== false && (crop.yieldKgPerM2 ?? 0) > 0);
  assert.ok(freshOnly);
  const none = buildPlanDashboard(
    [{ id: 'f', bedId: 'b1', cropKey: freshOnly!.key, sowMonth: 3 }],
    beds, [], { nowMonth: 1 },
  );
  assert.equal(none.storedFoodMonths, 0);
  assert.deepEqual(none.storedFoodCrops, []);
});

test('the year-in-numbers page prints the stored stat only when there is one', () => {
  const pdf = source('../lib/crop-export-pdf.ts');
  assert.match(pdf, /coverage\.storedFoodMonths > 0/,
    'the stored line must be conditional — a "0 of 12" reads as a finding about the year');
  assert.match(pdf, /of 12 months also have food from store/, 'the stat must reach the page');
  assert.match(pdf, /coverage\.storedFoodCrops\.length/, 'the crop count must come from the plan, not a guess');
  assert.match(pdf, /\.\.\.\(storedNote \? \[storedNote\] : \[\]\)/, 'a plan with no storage crop omits the line entirely');
});

// ── D. the notes survive Accept ─────────────────────────────────────────────

const NOTES: PlanNote[] = [
  { kind: 'warning', text: 'Butternut runs across the bed edges.', bedIds: ['b1'] },
  { kind: 'choice', text: 'Cabbage went into Bed 1 because it was the only bed free in May.' },
  { kind: 'gap', text: 'Ground with no new sowing: Bed 3 (Jun-Aug).', bedIds: ['b3'] },
  { kind: 'basis', text: 'How many people you feed is not used to size anything.' },
];

/** A localStorage stand-in, matching the shape lib/crop-plan.ts reads. */
function withLocalStorage<T>(store: Map<string, string>, run: () => T): T {
  const globalRef = globalThis as unknown as { window?: unknown };
  const previous = globalRef.window;
  globalRef.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
    dispatchEvent: () => true,
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalRef.window;
    else globalRef.window = previous;
  }
}

test('a saved plan round-trips its notes and the time they were generated at', async () => {
  const { loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const store = new Map<string, string>();
  const plan: CropPlanState = {
    version: 1,
    plantings: [{ id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 3 }],
    planNotes: NOTES,
    planNotesAt: Date.UTC(2026, 7, 20),
    updatedAt: 1,
  };
  const loaded = withLocalStorage(store, () => {
    assert.equal(saveCropPlan(plan), true);
    return loadCropPlan();
  });
  assert.deepEqual(loaded.planNotes, NOTES);
  assert.equal(loaded.planNotesAt, Date.UTC(2026, 7, 20));
});

test('a plan saved before planNotes existed still loads, with no notes invented for it', async () => {
  const { loadCropPlan } = await import('@/lib/crop-plan');
  const store = new Map<string, string>();
  const loaded = withLocalStorage(store, () => {
    // Written by hand in the pre-planNotes shape, exactly as it sits on a
    // farmer's phone today.
    store.set('imbewu_crop_plan_v1', JSON.stringify({
      version: 1,
      plantings: [{ id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 3 }],
      rainPattern: 'summer',
      updatedAt: 7,
    }));
    return loadCropPlan();
  });
  assert.equal(loaded.plantings.length, 1, 'the legacy plan must still load');
  assert.equal(loaded.rainPattern, 'summer');
  assert.equal(loaded.planNotes, undefined);
  assert.equal(loaded.planNotesAt, undefined);
});

test('a hand-edited or corrupt notes blob is dropped rather than rendered', async () => {
  const { loadCropPlan } = await import('@/lib/crop-plan');
  const store = new Map<string, string>();
  const loaded = withLocalStorage(store, () => {
    store.set('imbewu_crop_plan_v1', JSON.stringify({
      version: 1,
      plantings: [{ id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 3 }],
      planNotes: [
        { kind: 'warning', text: 'A real one.' },
        { kind: 'not-a-kind', text: 'Would fall through every render branch.' },
        { kind: 'choice', text: 42 },
        { kind: 'gap' },
        'a bare string',
        null,
      ],
      planNotesAt: Date.UTC(2026, 7, 20),
      updatedAt: 7,
    }));
    return loadCropPlan();
  });
  assert.deepEqual(loaded.planNotes, [{ kind: 'warning', text: 'A real one.' }]);

  // A timestamp outside 2020-2100 (a seconds value, a month number from a
  // hand-edited blob) cannot label anything honestly, so the pair is dropped
  // whole rather than shown with a nonsense year.
  for (const badAt of [0, 8, 1_755_648_000 /* seconds, not ms */, Date.UTC(2101, 0, 1), 'August']) {
    const undated = withLocalStorage(new Map<string, string>(), () => {
      (globalThis as unknown as { window: { localStorage: { setItem(k: string, v: string): void } } })
        .window.localStorage.setItem('imbewu_crop_plan_v1', JSON.stringify({
          version: 1,
          plantings: [{ id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 3 }],
          planNotes: NOTES,
          planNotesAt: badAt,
          updatedAt: 7,
        }));
      return loadCropPlan();
    });
    assert.equal(undated.planNotes, undefined, `notes with no usable date (${JSON.stringify(badAt)}) must not render undated`);
    assert.equal(undated.planNotesAt, undefined);
  }
});

test('CropPlanState declares the notes as optional so no migration is required', () => {
  assert.match(CROP_PLAN_LIB, /planNotes\?: PlanNote\[\];/);
  assert.match(CROP_PLAN_LIB, /planNotesAt\?: number;/);
  // The import must stay type-only: crop-autosuggest imports crop-plan at
  // runtime, and a value import here would close the cycle.
  assert.match(CROP_PLAN_LIB, /import type \{ PlanNote, PlanNoteKind \} from '\.\/crop-autosuggest';/);
});

test('accepting a suggestion writes its notes and the time onto the saved plan', () => {
  const accept = PAGE.slice(PAGE.indexOf('function acceptAutoSuggest()'), PAGE.indexOf('// Site picker'));
  assert.match(accept, /planNotes: autoResult\.notes/, 'the accepted notes must be written to the plan');
  assert.match(accept, /planNotesAt: Date\.now\(\)/, 'the generating time must travel with them');
});

test('the plan page renders the accepted notes with the same grouping the review modal uses', () => {
  // ONE renderer. A forked copy is how the persisted panel quietly becomes the
  // flat amber wall the grouping was written to kill.
  assert.equal((PAGE.match(/function PlanNoteGroups\(/g) ?? []).length, 1);
  assert.match(PAGE, /<PlanNoteGroups notes=\{result\.notes\} \/>/, 'the review modal uses it');
  assert.match(PAGE, /<PlanNoteGroups notes=\{notes\} \/>/, 'the plan-page card uses it');
  // Ranked and collapsed the same way in both.
  const groups = PAGE.slice(PAGE.indexOf('function PlanNoteGroups('), PAGE.indexOf('function AcceptedPlanNotesCard('));
  for (const kind of ['warning', 'choice', 'gap', 'basis']) {
    assert.ok(groups.includes(`n.kind === '${kind}'`), `${kind} must still be grouped`);
  }
  assert.ok(groups.indexOf("'warning'") < groups.indexOf("'basis'"), 'warnings must still come before basis');

  // Only shown when there is something to show — a hand-built plan gets no
  // empty card implying it came from a suggestion.
  // ...and never above an emptied bed grid: after "Clear all plantings" the
  // old reasons describe nothing on screen.
  assert.match(PAGE, /plan\?\.planNotes\?\.length && plan\.planNotesAt && plantings\.length > 0/);
  assert.match(PAGE, /Why this plan chose what it chose/);
  // Dated, because manual edits after Accept do not invalidate the notes —
  // the label is what carries that honesty.
  // Month AND year — "suggested in Sep" read thirteen months later points at
  // the wrong September.
  // The sentence is an inlineTemplate so isiXhosa readers get a draft: the date is its {date} value.
  assert.match(PAGE, /From the plan suggested in \{date\}\.[^;]*\{ date: planNotesDateLabel\(generatedAt\) \}/);
  assert.match(PAGE, /Anything you have changed by hand since is not\s*\n?\s*described here\./);
});

test('the printed plan carries the notes, kind-grouped and dated', () => {
  const pdf = source('../lib/crop-export-pdf.ts');
  assert.match(pdf, /planNotes\?: PlanNote\[\];/, 'the PDF input must accept them');
  assert.match(pdf, /planNotesAt\?: number;/);
  assert.match(pdf, /How this plan was put together/, 'the panel must be titled');
  assert.match(pdf, /From the plan suggested in \$\{planNotesDateLabel\(input\.planNotesAt\)\}/, 'dated on paper too — month and year');
  assert.match(pdf, /const PLAN_NOTE_PANEL_ORDER: readonly PlanNoteKind\[\] = \['warning', 'choice', 'gap', 'basis'\];/,
    'the printed order must match the screen');
  assert.match(pdf, /if \(!notes\.length\) return;/, 'a plan with no notes gets no empty panel');

  // ...and the page actually hands them over, through the export card.
  const card = source('../components/crops/CropPlanExportCard.tsx');
  assert.match(card, /planNotes, planNotesAt/, 'the export card must forward them');
  assert.match(PAGE, /planNotes=\{plan\?\.planNotes\}/, 'the plan page must pass them to the export card');
  assert.match(PAGE, /planNotesAt=\{plan\?\.planNotesAt\}/);
});

// ── E. voice ────────────────────────────────────────────────────────────────

test('the new storage and notes copy stays in the farmer voice', () => {
  const banned = ['automatic layout', 'occupancy', 'planning basis', 'timing flag', 'final plant positions', 'Auto-suggest'];
  const offenders: string[] = [];
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    for (const paragraph of buildYearReport(result.plantings, scenario.beds)) {
      for (const term of banned) {
        if (paragraph.includes(term)) offenders.push(`"${term}" in: ${paragraph.slice(0, 100)}`);
      }
      // The storage lines hedge; they never promise a household is fed.
      if (/ will feed | will carry | guaranteed /i.test(paragraph)) {
        offenders.push(`a promise slipped in: ${paragraph.slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 5), [], `${offenders.length} year-report paragraphs broke voice`);
});

test('a crop is never named as stored in a month the plan does not store it', () => {
  // The sharpest edge: buildFoodAvailability is the ONLY authority for what is
  // stored when, and every sentence about storage must be derived from the same
  // call the chart is drawn from.
  const beds = bedsFor(2, 0, 9);
  const plantings: Planting[] = [
    { id: 'a', bedId: 'b1', cropKey: 'butternut', sowMonth: 10 },
    { id: 'b', bedId: 'b2', cropKey: 'dry-beans', sowMonth: 11 },
  ];
  const availability = buildFoodAvailability(plantings, beds);
  const storedNames = new Set(
    availability.slice(1, 13).flatMap((month) => month
      .filter((item) => item.status === 'stored')
      .map((item) => item.name)),
  );
  const report = buildYearReport(plantings, beds).join(' ');
  // Extract the EXACT name list from every storage clause instead of regexing
  // raw catalog names into a pattern: four storage crops carry unescaped
  // parentheses ("Maize (mielies)") that turned into capture groups and could
  // never match, and \bpotato\b matches inside "sweet potato". namesSentence
  // joins with ", " and a final " and ", so that is what is split on here.
  const namedAsStored = [...report.matchAll(/Stored (.+?) should still be usable/g)]
    .flatMap((clause) => clause[1].split(/,\s+|\s+and\s+/))
    .map((name) => name.trim())
    .filter(Boolean);
  const storedNamesLower = new Set([...storedNames].map((name) => name.toLowerCase()));
  for (const name of namedAsStored) {
    assert.ok(
      storedNamesLower.has(name.toLowerCase()),
      `${name} is named as stored but this plan never stores it`,
    );
  }
  // The guard must actually meet a clause, or it verifies nothing: this
  // fixture stores butternut, so at least one storage sentence must name it.
  assert.ok(namedAsStored.length > 0, 'the fixture produced no storage clause for the guard to check');
  assert.ok(cropByKey('butternut'), 'fixture sanity');
});

// ── The from-now regression pin (added with the whole-year feature) ─────────

test('the from-now engine call in page.tsx survives the whole-year feature byte-for-byte', () => {
  // "Start from this month" must keep the EXACT behaviour every existing plan
  // was generated with. The whole-year branch is additive; if this literal
  // call ever changes shape, the from-now path is no longer today's path.
  //
  // The first five arguments are the pin this test exists to protect — they
  // must stay byte-identical to the call every existing plan was generated
  // with. The sixth, realNow, is a DELIBERATE addition (the stale-once-row
  // fix): without it, a stale `once` row surviving to this call site would be
  // read as a sowing still ahead, exactly the bug #312 fixed for
  // fillFirstSeasonGaps but left open here. Passing it through is the
  // conscious shape-change this pin is meant to force a look at, not an
  // accidental drift — so the pin now covers it too.
  assert.match(
    PAGE,
    /autoSuggestPlan\(\s*answers, pattern, beds, plantings, currentMonth,\s*\{ year: new Date\(\)\.getFullYear\(\), month: currentMonth \},\s*\)/,
    'the literal from-now engine call must keep its first five arguments unchanged, and pass '
    + 'realNow explicitly',
  );
});

test('saving and reopening dated sowing decisions preserves confirmation and never revives last year\'s crop', async () => {
  const { confirmOnceSowing, loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStamp = `${year}-${String(month).padStart(2, '0')}`;
  const oldStamp = `${year - 1}-${String(month).padStart(2, '0')}`;
  const confirmed = confirmOnceSowing({ id: 'current', bedId: 'b1', cropKey: 'green-beans', sowMonth: month, once: currentStamp }, year, month);
  const old = confirmOnceSowing({ id: 'old', bedId: 'b1', cropKey: 'green-beans', sowMonth: month, once: oldStamp }, year - 1, month);
  const undecided: Planting = { id: 'undecided', bedId: 'b1', cropKey: 'green-beans', sowMonth: month, once: oldStamp };
  const plan: CropPlanState = { version: 1, plantings: [confirmed, old, undecided], updatedAt: now.getTime() };
  const loaded = withLocalStorage(new Map<string, string>(), () => {
    assert.equal(saveCropPlan(plan), true);
    const first = loadCropPlan();
    assert.equal(saveCropPlan(first), true);
    return loadCropPlan();
  });
  assert.equal(loaded.plantings[0].confirmedOnceSowing, currentStamp);
  assert.equal(loaded.plantings[0].finishedOnceSowing, undefined);
  assert.equal(loaded.plantings[1].confirmedOnceSowing, oldStamp);
  assert.equal(loaded.plantings[1].finishedOnceSowing, true);
  assert.equal(loaded.plantings[2].once, oldStamp);
  assert.equal(loaded.plantings[2].awaitingSowingConfirmation, true);
  assert.equal(loaded.plantings[2].existing, undefined);
  assert.ok(buildFoodAvailability(loaded.plantings.slice(1), [{ id: 'b1', label: 'Bed 1', areaM2: 9 }], month, 24).every((slot) => slot.length === 0));
});

test('dated production and stock belong to the saved account and retain years, native units, explicit zero and unknown weights', async () => {
  const { loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const productionRecords: DatedProductionRecord[] = [
    { id: 'actual-eggs', sourceIconKey: 'animal:chicken-layer', label: 'Eggs', date: { year: 2026, month: 12 }, quantity: 0, unit: 'eggs', status: 'actual', pricePerUnit: 0, provenance: 'farm-record' },
    { id: 'expected-milk', sourceIconKey: 'animal:goat-dairy', label: 'Goat milk', date: { year: 2027, month: 1 }, quantity: 6.25, unit: 'litres', status: 'expected', provenance: 'farm-record', note: 'A test of a farmer-entered estimate, not a livestock yield reference.' },
    { id: 'actual-maize', sourceIconKey: 'crop:maize', label: 'Maize', date: { year: 2027, month: 1 }, quantity: 2.5, unit: 'kg', status: 'actual', provenance: 'farm-record' },
  ];
  const preservedProducts: PreservedFoodRecord[] = [
    { id: 'unknown-mango-stock', sourceIconKey: 'tree:mangifera-indica', label: 'Dried mango', method: 'dried', dates: [{ year: 2026, month: 12 }, { year: 2027, month: 1 }], provenance: 'farm-record', note: 'Stock presence is reported; its weight is unknown.' },
    { id: 'explicit-zero-nuts', sourceIconKey: 'tree:macadamia-integrifolia', label: 'Stored nuts', method: 'stored', dates: [{ year: 2027, month: 2 }], provenance: 'fictional-example', note: 'An explicit zero in a test record.', quantities: [{ year: 2027, month: 2, kg: 0 }] },
  ];
  const plan: CropPlanState = { version: 1, plantings: [], productionRecords, preservedProducts, updatedAt: 1 };
  const store = new Map<string, string>();
  try {
    withLocalStorage(store, () => {
      bindMountedAccountLocalStorageUid('record-farmer/a');
      assert.equal(saveCropPlan(plan), true);
      assert.ok(store.has(accountLocalStorageKey('imbewu_crop_plan_v1', 'record-farmer/a')));
      assert.ok(!store.has('imbewu_crop_plan_v1'), 'a signed-in production record must not enter the legacy shared key');
      const first = loadCropPlan();
      assert.deepEqual(first.productionRecords, productionRecords);
      assert.deepEqual(first.preservedProducts, preservedProducts);
      assert.equal(first.productionRecords![0].quantity, 0, 'zero eggs must survive instead of becoming missing');
      assert.equal(first.productionRecords![0].pricePerUnit, 0, 'zero own price must survive instead of becoming missing');
      assert.equal(first.productionRecords![1].pricePerUnit, undefined, 'an unknown own price must not become zero');
      assert.equal(first.preservedProducts![0].quantities, undefined, 'reported stock months must not invent a weight');
      bindMountedAccountLocalStorageUid('record-farmer/b');
      const other = loadCropPlan();
      assert.equal(other.productionRecords, undefined, 'a second account must not see the first farm\'s production');
      assert.equal(other.preservedProducts, undefined, 'a second account must not see the first farm\'s stock');
      assert.equal(saveCropPlan({ version: 1, plantings: [], productionRecords: [], preservedProducts: [], updatedAt: 2 }), true);
      bindMountedAccountLocalStorageUid('record-farmer/a');
      const reopened = loadCropPlan();
      assert.equal(saveCropPlan(reopened), true);
      assert.deepEqual(loadCropPlan().productionRecords, productionRecords, 'reopening twice cannot turn litres or eggs into kg or repeat their years');
      assert.deepEqual(loadCropPlan().preservedProducts, preservedProducts, 'a later account save cannot overwrite exact stock dates or provenance');
    });
  } finally { bindMountedAccountLocalStorageUid(null); }
});

test('old or unanswered production fields stay absent while an explicitly cleared record list stays empty', async () => {
  const { loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const store = new Map<string, string>();
  try {
    withLocalStorage(store, () => {
      bindMountedAccountLocalStorageUid('optional-records-farmer');
      const key = accountLocalStorageKey('imbewu_crop_plan_v1', 'optional-records-farmer');
      for (const fields of [{}, { productionRecords: null, preservedProducts: null },
        { productionRecords: {}, preservedProducts: 'unknown' }]) {
        store.set(key, JSON.stringify({ version: 1, plantings: [], updatedAt: 1, ...fields }));
        const unknown = loadCropPlan();
        assert.ok(!Object.hasOwn(unknown, 'productionRecords'), 'a missing or malformed list must not claim a recorded zero');
        assert.ok(!Object.hasOwn(unknown, 'preservedProducts'), 'unanswered stock must remain distinguishable from a cleared list');
        assert.equal(saveCropPlan(unknown), true);
        assert.ok(!Object.hasOwn(loadCropPlan(), 'productionRecords'));
        assert.ok(!Object.hasOwn(loadCropPlan(), 'preservedProducts'));
      }
      assert.equal(saveCropPlan({ version: 1, plantings: [], productionRecords: [], preservedProducts: [], updatedAt: 1 }), true);
      const cleared = loadCropPlan();
      assert.ok(Object.hasOwn(cleared, 'productionRecords'));
      assert.ok(Object.hasOwn(cleared, 'preservedProducts'));
      assert.deepEqual(cleared.productionRecords, []);
      assert.deepEqual(cleared.preservedProducts, []);
    });
  } finally { bindMountedAccountLocalStorageUid(null); }
});

test('corrupt stored quantities are refused without duplicating corrections or turning missing stock kg into zero', async () => {
  const { loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const actual = { id: 'old-eggs', sourceIconKey: 'animal:chicken-layer', label: 'Eggs', date: { year: 2027, month: 1 }, quantity: 3, unit: 'eggs', status: 'actual', provenance: 'farm-record' };
  const corrected = { ...actual, id: 'corrected-eggs', quantity: 0, pricePerUnit: 0 };
  const expected = { ...actual, id: 'expected-eggs', quantity: 4, status: 'expected', provenance: 'fictional-example' };
  const stock = { id: 'nuts', sourceIconKey: 'tree:macadamia-integrifolia', label: 'Nuts in shell', method: 'stored', dates: [{ year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 1 }], provenance: 'farm-record', note: 'Exact stock readings; no conversion to kernels.', quantities: [
    { year: 2026, month: 12, kg: null }, { year: 2027, month: 1, kg: 2 }, { year: 2027, month: 1, kg: 0 },
    { year: 2027, month: 2, kg: 10 }, { year: 2026, month: 12, kg: -1 },
  ] };
  const store = new Map<string, string>();
  try {
    withLocalStorage(store, () => {
      bindMountedAccountLocalStorageUid('corrupt-records-farmer');
      store.set(accountLocalStorageKey('imbewu_crop_plan_v1', 'corrupt-records-farmer'), JSON.stringify({
        version: 1, plantings: [], updatedAt: 1,
        productionRecords: [actual, corrected, expected, ...[
          { date: { year: 2027, month: 13 } }, { date: { year: '2027', month: 1 } },
          { quantity: null }, { quantity: -1 }, { quantity: '5' }, { quantity: Number.NaN },
          { unit: 'kilograms' }, { status: 'guaranteed' }, { sourceIconKey: 'housing:bee' },
          { pricePerUnit: -1 }, { provenance: 'satellite-estimate' },
        ].map((change, index) => ({ ...actual, id: `invalid-${index}`, ...change }))],
        preservedProducts: [stock, { ...stock, id: 'invalid-method', method: 'safe-for-ever' },
          { ...stock, id: 'invalid-dates', dates: [{ year: 2027, month: 0 }] },
          { ...stock, id: 'invalid-source', sourceIconKey: 'housing:pond' },
          { ...stock, id: 'invalid-origin', provenance: 'assumed-from-harvest' }],
      }));
      const clean = loadCropPlan();
      assert.deepEqual(clean.productionRecords, [corrected, expected], 'a correction replaces its source/date/status, while expected and actual stay distinct');
      assert.equal(clean.preservedProducts!.length, 1);
      assert.deepEqual(clean.preservedProducts![0].dates, [{ year: 2026, month: 12 }, { year: 2027, month: 1 }], 'stock months must be exact and unique, without a next-year recurrence');
      assert.deepEqual(clean.preservedProducts![0].quantities, [{ year: 2027, month: 1, kg: 0 }],
        'missing, negative and out-of-stock-month kg cannot create food; a dated correction may explicitly say zero');
      assert.equal(saveCropPlan(clean), true);
      const twice = loadCropPlan();
      assert.deepEqual(twice.productionRecords, clean.productionRecords);
      assert.deepEqual(twice.preservedProducts, clean.preservedProducts);
    });
  } finally { bindMountedAccountLocalStorageUid(null); }
});

// These are synthetic observations to exercise ownership, not farming output rates.
const recordSiteA = 'site:-28.00000,32.00000';
const recordSiteB = 'site:-33.00000,19.00000';
const scopedProduction = (siteId: string | undefined, quantity: number, unit: DatedProductionRecord['unit'] = 'kg'): DatedProductionRecord => ({
  id: 'same-imported-id', ...(siteId ? { siteId } : {}), sourceIconKey: 'tree:mangifera-indica', label: 'Mango',
  date: { year: 2027, month: 1 }, quantity, unit, status: 'actual', pricePerUnit: 0, provenance: 'farm-record',
});
const scopedStock = (siteId: string | undefined, kg: number | undefined): PreservedFoodRecord => ({
  id: 'same-imported-batch', ...(siteId ? { siteId } : {}), sourceIconKey: 'tree:mangifera-indica', label: 'Dried mango',
  method: 'dried', dates: [{ year: 2027, month: 1 }, { year: 2027, month: 2 }], provenance: 'farm-record',
  note: 'Measured stock is distinct from production; February is unweighed.',
  ...(kg === undefined ? {} : { quantities: [{ year: 2027, month: 1, kg }] }),
});

test('two farms can record the same food, month, status and imported id without replacing each other or claiming unassigned legacy records', () => {
  const first = scopedProduction(recordSiteA, 0);
  const second = scopedProduction(recordSiteB, 8);
  const legacy = scopedProduction(undefined, 900);
  const input = [first, second, legacy];
  const before = structuredClone(input);
  const clean = sanitiseProductionRecords(input);
  assert.equal(clean.length, 3, 'a shared species and imported id do not establish the farm that grew it');
  assert.deepEqual(productionRecordsForSite(clean, recordSiteA), [first]);
  assert.deepEqual(productionRecordsForSite(clean, recordSiteB), [second]);
  assert.deepEqual(productionRecordsForSite(clean, null), [], 'an unresolved site cannot receive another farm’s amount');
  assert.deepEqual(productionRecordsForSite(clean, 'site:unknown'), []);
  assert.equal(productionRecordsForSite(clean, recordSiteA)[0].quantity, 0, 'an explicitly empty harvest survives site selection');
  assert.equal(productionRecordsForSite(clean, recordSiteA)[0].pricePerUnit, 0);
  const stocks = [scopedStock(recordSiteA, 0), scopedStock(recordSiteB, 3), scopedStock(undefined, undefined)];
  assert.equal(sanitisePreservedFoodRecords(stocks).length, 3, 'the same batch id on two farms must not merge their stock');
  assert.deepEqual(preservedFoodRecordsForSite(stocks, recordSiteA), [stocks[0]]);
  assert.deepEqual(preservedFoodRecordsForSite(stocks, recordSiteB), [stocks[1]]);
  assert.deepEqual(preservedFoodRecordsForSite(stocks, null), []);
  const corrected = sanitiseProductionRecords([...clean, { ...first, id: 'corrected-a', quantity: 0.4 }]);
  assert.equal(corrected.length, 3, 'correction deduplication remains within the owning farm');
  assert.equal(productionRecordsForSite(corrected, recordSiteA)[0].quantity, 0.4);
  assert.deepEqual(productionRecordsForSite(corrected, recordSiteB), [second]);
  assert.deepEqual(corrected.find(record => record.siteId === undefined), legacy);
  assert.deepEqual(input, before, 'selecting or cleaning quantities must not mutate either farm’s observations');
});

test('editing or deleting one farm’s production and stored food preserves another farm and ambiguous legacy records', () => {
  const original = [scopedProduction(recordSiteA, 0), scopedProduction(recordSiteB, 8), scopedProduction(undefined, 900)];
  const stock = [scopedStock(recordSiteA, 0), scopedStock(recordSiteB, 3), scopedStock(undefined, undefined)];
  const before = structuredClone({ original, stock });
  // The callback owns the current site even if an imported form row carries another scope.
  const edited = replaceProductionRecordsForSite(original, recordSiteA, [{ ...original[0], siteId: recordSiteB, quantity: 0.4 }]);
  assert.deepEqual(productionRecordsForSite(edited, recordSiteA), [{ ...original[0], quantity: 0.4 }]);
  assert.deepEqual(productionRecordsForSite(edited, recordSiteB), [original[1]]);
  assert.deepEqual(edited.find(record => record.siteId === undefined), original[2]);
  const editedStock = replacePreservedFoodRecordsForSite(stock, recordSiteA, [{ ...stock[0], siteId: recordSiteB,
    quantities: [{ year: 2027, month: 1, kg: 0.4 }],
  }]);
  assert.equal(preservedFoodRecordsForSite(editedStock, recordSiteA)[0].quantities![0].kg, 0.4);
  assert.deepEqual(preservedFoodRecordsForSite(editedStock, recordSiteB), [stock[1]]);
  assert.deepEqual(editedStock.find(record => record.siteId === undefined), stock[2]);
  const deleted = replaceProductionRecordsForSite(edited, recordSiteA, []);
  const deletedStock = replacePreservedFoodRecordsForSite(editedStock, recordSiteA, []);
  assert.deepEqual(productionRecordsForSite(deleted, recordSiteA), []);
  assert.deepEqual(preservedFoodRecordsForSite(deletedStock, recordSiteA), []);
  assert.deepEqual(productionRecordsForSite(deleted, recordSiteB), [original[1]]);
  assert.deepEqual(preservedFoodRecordsForSite(deletedStock, recordSiteB), [stock[1]]);
  assert.deepEqual(deleted.find(record => record.siteId === undefined), original[2]);
  assert.deepEqual(deletedStock.find(record => record.siteId === undefined), stock[2]);
  assert.deepEqual({ original, stock }, before, 'an edit on one site must not rewrite stored arrays belonging to the account');
});

test('saving and reopening two farms’ dated records keeps their native units, ownership, zero and provenance after one farm changes', async () => {
  const { loadCropPlan, saveCropPlan } = await import('@/lib/crop-plan');
  const productionRecords: DatedProductionRecord[] = [
    { ...scopedProduction(recordSiteA, 0, 'eggs'), sourceIconKey: 'animal:chicken-layer', label: 'Eggs' },
    { ...scopedProduction(recordSiteB, 7, 'eggs'), sourceIconKey: 'animal:chicken-layer', label: 'Eggs' },
    { ...scopedProduction(recordSiteA, 6.25, 'litres'), id: 'same-milk-id', sourceIconKey: 'animal:goat-dairy', label: 'Milk', status: 'expected', provenance: 'fictional-example', note: 'A fixture estimate, not a goat yield.' },
    { ...scopedProduction(recordSiteB, 3.5, 'litres'), id: 'same-milk-id', sourceIconKey: 'animal:goat-dairy', label: 'Milk', status: 'expected' },
    scopedProduction(undefined, 900),
  ];
  const preservedProducts = [scopedStock(recordSiteA, 0), scopedStock(recordSiteB, 3), scopedStock(undefined, undefined)];
  const store = new Map<string, string>();
  try {
    withLocalStorage(store, () => {
      bindMountedAccountLocalStorageUid('two-farms-record-owner');
      assert.equal(saveCropPlan({ version: 1, plantings: [], productionRecords, preservedProducts, updatedAt: 1 }), true);
      const first = loadCropPlan();
      assert.deepEqual(first.productionRecords, productionRecords);
      assert.deepEqual(first.preservedProducts, preservedProducts);
      assert.deepEqual(productionRecordsForSite(first.productionRecords, recordSiteA).map(record => [record.quantity, record.unit, record.status]),
        [[0, 'eggs', 'actual'], [6.25, 'litres', 'expected']]);
      assert.equal(preservedFoodRecordsForSite(first.preservedProducts, recordSiteA)[0].quantities![0].kg, 0);
      assert.equal(preservedFoodRecordsForSite(first.preservedProducts, recordSiteB)[0].quantities!.length, 1, 'unweighed February stock must not inherit January’s kilograms');
      const remainingA = productionRecordsForSite(first.productionRecords, recordSiteA).filter(record => record.unit === 'litres')
        .map(record => ({ ...record, quantity: 0.4 }));
      const changed: CropPlanState = { ...first,
        productionRecords: replaceProductionRecordsForSite(first.productionRecords, recordSiteA, remainingA),
        preservedProducts: replacePreservedFoodRecordsForSite(first.preservedProducts, recordSiteA, []), updatedAt: 2,
      };
      assert.equal(saveCropPlan(changed), true);
      const reopened = loadCropPlan();
      assert.deepEqual(productionRecordsForSite(reopened.productionRecords, recordSiteA), [{ ...productionRecords[2], quantity: 0.4 }]);
      assert.deepEqual(productionRecordsForSite(reopened.productionRecords, recordSiteB), [productionRecords[1], productionRecords[3]]);
      assert.deepEqual(preservedFoodRecordsForSite(reopened.preservedProducts, recordSiteA), []);
      assert.deepEqual(preservedFoodRecordsForSite(reopened.preservedProducts, recordSiteB), [preservedProducts[1]]);
      assert.deepEqual(reopened.productionRecords!.find(record => record.siteId === undefined), productionRecords[4]);
      assert.deepEqual(reopened.preservedProducts!.find(record => record.siteId === undefined), preservedProducts[2]);
      assert.equal(saveCropPlan(reopened), true);
      assert.deepEqual(loadCropPlan().productionRecords, reopened.productionRecords);
      assert.deepEqual(loadCropPlan().preservedProducts, reopened.preservedProducts);
    });
  } finally { bindMountedAccountLocalStorageUid(null); }
});

test('the graph, editor and both printed plans use the selected farm’s records and returning to local restores its map', () => {
  // Leaf ownership tests cannot detect a component wired back to the account-wide array.
  // This boundary protects the farmer who switches maps after entering production.
  const graphInput = PAGE.match(/const productionGraphInput\s*=[\s\S]*?(?=const productionAvailabilityGraphs)/)?.[0];
  assert.ok(graphInput, 'the saved plan must construct the shared dated graph input');
  assert.match(graphInput, /productionRecords:\s*siteProductionRecords\s*,\s*preservedProducts:\s*sitePreservedProducts/);
  const graph = PAGE.match(/<ProductionAvailabilityGraphs\b[\s\S]*?\/>/)?.[0];
  assert.ok(graph);
  assert.match(graph, /input=\{productionGraphInput\}/);
  assert.match(graph, /preservedProducts=\{sitePreservedProducts\}/);
  const editor = PAGE.match(/<ProductionRecordsEditor\b[\s\S]*?\/>/)?.[0];
  assert.ok(editor);
  assert.match(editor, /key=\{productionSiteId\s*\?\?\s*'no-site'\}/,
    'switching farms must discard a partially entered form belonging to the prior farm');
  const exports = [...PAGE.matchAll(/<CropPlanExportCard\b[\s\S]*?\/>/g)].map(match => match[0]);
  assert.equal(exports.length, 2, 'Simple and All tools each provide a print entry point');
  for (const consumer of [editor, ...exports]) {
    assert.match(consumer, /productionRecords=\{siteProductionRecords\}/);
    assert.match(consumer, /preservedProducts=\{sitePreservedProducts\}/);
  }
  assert.doesNotMatch(PAGE, /(?:productionRecords|preservedProducts)=\{plan\?\.(?:productionRecords|preservedProducts)\}/,
    'a shared account array must not bypass site selection in any quantity consumer');
  assert.match(PAGE, /productionRecordsForSite\(plan\?\.productionRecords,\s*productionSiteId\)/);
  assert.match(PAGE, /preservedFoodRecordsForSite\(plan\?\.preservedProducts,\s*productionSiteId\)/);
  const scope = PAGE.match(/const productionSiteId\s*=[\s\S]*?;/)?.[0];
  assert.ok(scope);
  assert.match(scope, /canvasSite\s*\?\?/);
  assert.match(scope, /chosenDesignId\s*&&\s*chosenDesignId\s*!==\s*'local'/);
  assert.match(scope, /:\s*surveySiteId\s*\?\?/,
    'the initial local map and the picker’s local choice must use the same coordinate site identity');
  const chooseSite = PAGE.match(/function chooseSite\(id: string\)\s*\{[\s\S]*?\n  \}/)?.[0];
  assert.ok(chooseSite);
  assert.match(chooseSite, /if\s*\(id\s*===\s*'local'\)\s*\{\s*setDesign\(loadFacilitatorState\(\)\);\s*return;\s*\}/,
    'the previously selected cloud map must not remain under local production figures');
});
