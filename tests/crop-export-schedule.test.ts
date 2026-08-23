import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { cropByKey, plantSpacingRangeCm, plantsPerM2Range } from '@/lib/crop-catalog';
import { buildFieldUtilizationByMonth, buildFoodAvailability, buildYearReport, seedBoqForPlan, settleOnceRows, tasksForPlan, type PlanBed, type Planting } from '@/lib/crop-plan';
import { buildFieldSheet, buildOccupancyCalendar, buildPlanDashboard, buildPlanTableRows } from '@/lib/crop-export-benchmark';
import {
  bedShareLabel,
  buildBedPlanRows,
  buildBuyingSchedule,
  buildTaskMonths,
  buyingScheduleTotals,
  monthYearLabel,
  resolveMonthYear,
  rollingMonths,
  sowingInstruction,
  positionRangeLabel,
  taskLine,
  taskSentence,
  taskTitle,
} from '@/lib/crop-export-schedule';
import { benchmarkYieldLabel, pdfSafe } from '@/lib/crop-export-pdf';

const BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 6, minDimM: 1.2 },
  { id: 'bed-2', label: 'Hügel 1', areaM2: 8, minDimM: 1.5 },
  { id: 'bed-3', label: 'Bed 3', areaM2: 6, minDimM: 1.2 },
  { id: 'plot-1', label: 'Plot 1', areaM2: 400, kind: 'plot' },
];

const PLANTINGS: Planting[] = [
  { id: 'pl-a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
  { id: 'pl-b', bedId: 'bed-2', cropKey: 'onions', sowMonth: 4 },       // transplant: true
  { id: 'pl-c', bedId: 'plot-1', cropKey: 'green-beans', sowMonth: 11 },
  { id: 'pl-d', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 2, existing: true },
  { id: 'pl-e', bedId: 'bed-2', cropKey: 'cabbage', sowMonth: 4, areaFraction: 0.5 }, // transplant, same buy month as onions
  { id: 'pl-f', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 6 },      // succession: second batch, different buy month
];

const NOW = new Date('2026-08-04T09:30:00Z');
const NOW_MONTH = 8;

// ── Month arithmetic ────────────────────────────────────────────────────────

test('rollingMonths starts at the current month, not January', () => {
  assert.deepEqual(rollingMonths(8), [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(rollingMonths(1).slice(0, 3), [1, 2, 3]);
});

test('resolveMonthYear pushes an already-past month into next year', () => {
  assert.equal(resolveMonthYear(8, NOW), 2026, 'this month is now, not a year away');
  assert.equal(resolveMonthYear(10, NOW), 2026);
  assert.equal(resolveMonthYear(3, NOW), 2027);
  assert.equal(monthYearLabel(3, NOW), 'March 2027');
  assert.equal(monthYearLabel(10, NOW), 'October 2026');
});

// ── Task wording (shared with the screen) ───────────────────────────────────

test('taskSentence makes soil preparation an assessment, not a blanket input prescription', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const plotPrep = tasks.find((t) => t.id === 'pl-c:prep')!;
  assert.match(taskSentence([plotPrep]), /assess soil and drainage; use a soil test or local advice/i);

  const bedPrep = tasks.find((t) => t.id === 'pl-a:prep')!;
  assert.match(taskSentence([bedPrep]), /assess soil and drainage; use a soil test or local advice/i);
  assert.doesNotMatch(taskSentence([plotPrep, bedPrep]), /kraal manure|compost|plough|rip/i);
});

test('taskSentence puts field spacing on direct sow or transplant, never tray sowing', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.match(taskSentence([tasks.find((t) => t.id === 'pl-c:sow')!]), /rows 45–60cm apart/);
  assert.doesNotMatch(taskSentence([tasks.find((t) => t.id === 'pl-b:sow')!]), /rows 20–30cm apart/);
  assert.match(taskSentence([tasks.find((t) => t.id === 'pl-b:transplant')!]), /rows 20–30cm apart/);
  assert.doesNotMatch(taskSentence([tasks.find((t) => t.id === 'pl-c:harvest')!]), /rows 45–60cm apart/);
});

test('a crop with a multi-month picking window creates work in every picking month', () => {
  // KZN DARD gives tomatoes a two-to-three-month picking period. Coarse
  // planning uses the supported upper end so the bed cannot be allocated to a
  // successor while the crop may still be productive.
  const tasks = tasksForPlan([
    { id: 'tomato-window', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 8 },
  ], BEDS).filter((task) => task.action === 'harvest');
  assert.deepEqual(Object.fromEntries(tasks.map((task) => [task.id, task.month])), {
    'tomato-window:harvest': 1,
    'tomato-window:harvest:1': 2,
    'tomato-window:harvest:2': 3,
  });
});

test('a sourced field-rate cover creates management work without becoming food or fake plant positions', () => {
  const cover: Planting[] = [{ id: 'winter-cover', bedId: 'plot-1', cropKey: 'oats', sowMonth: 4 }];
  const tasks = tasksForPlan(cover, BEDS);
  assert.deepEqual(
    tasks.map((task) => [task.action, task.month]),
    [['prep', 3], ['sow', 4], ['terminate-cover', 10]],
    'the cover needs preparation, sowing and termination rather than a harvest task',
  );

  const oats = cropByKey('oats')!;
  const instruction = sowingInstruction(oats);
  assert.doesNotMatch(instruction, /6\s*cm|100\s*days?/i);
  assert.match(instruction, /70kg seed\/ha.*105–140kg\/ha/i);
  assert.match(instruction, /terminate before the next summer staple/i);

  const row = buildPlanTableRows(cover, BEDS)[0];
  assert.equal(row.harvest, 'Oct');
  const bedRow = buildBedPlanRows(cover, BEDS).find((candidate) => candidate.bedId === 'plot-1')!.crops[0];
  assert.equal(bedRow.harvestMonth, 10);
  assert.equal(bedRow.harvestEndMonth, 10);
  assert.deepEqual(seedBoqForPlan(cover, BEDS), [], 'a kg/ha cover rate must not become a final-position seed count');
  assert.deepEqual(buildBuyingSchedule(cover, BEDS, NOW_MONTH), [], 'the piece/packet buying model must not fake a kg/ha shopping quantity');
  assert.equal(buildFoodAvailability(cover, BEDS).flat().some((item) => item.cropKey === 'oats'), false);
  assert.ok(buildFieldUtilizationByMonth(cover, BEDS).some((value) => value > 0), 'a sourced cover must count as field occupancy');
  assert.equal(buildOccupancyCalendar(cover, BEDS, NOW_MONTH).flatMap((calendarRow) => calendarRow.cells).flat().some((entry) => entry.cropKey === 'oats'), true);
});

test('the rolling printed schedule cannot bring an already-finished planting back next year', () => {
  const finished: Planting[] = [
    { id: 'finished-cabbage', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 11, existing: true },
  ];
  const tasks = tasksForPlan(finished, BEDS, NOW_MONTH);

  assert.deepEqual(tasks, []);
  assert.deepEqual(buildTaskMonths(tasks, NOW_MONTH), []);
  assert.equal(
    buildOccupancyCalendar(finished, BEDS, NOW_MONTH)
      .flatMap((row) => row.cells).flat().some((entry) => entry.cropKey === 'cabbage'),
    false,
    'the PDF land calendar must not annualise the same one-off crop',
  );
});

test('the rolling PDF calendar clips an active existing crop instead of repeating it', () => {
  const active: Planting[] = [
    { id: 'active-amadumbe', bedId: 'bed-1', cropKey: 'amadumbe', sowMonth: 4, existing: true },
  ];
  const row = buildOccupancyCalendar(active, BEDS, 11).find((candidate) => candidate.bedId === 'bed-1')!;
  const occupiedOffsets = row.cells
    .map((cell, offset) => cell.some((entry) => entry.cropKey === 'amadumbe') ? offset : -1)
    .filter((offset) => offset >= 0);

  assert.deepEqual(occupiedOffsets, [0, 1, 2, 3], 'only the tail of last April\'s observed cohort remains');
});

test('taskSentence says so when nothing is due', () => {
  assert.equal(taskSentence([]), 'nothing due');
});

test('taskTitle always names the crop and the ground', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-c:sow')!), 'Sow Green beans — Plot 1');
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-c:prep')!), 'Prep Plot 1 for Green beans');
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-b:transplant')!), 'Check / transplant Onions — Hügel 1');
});

test('taskLine is sentence-cased for standalone reading', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.match(taskLine(tasks.find((t) => t.id === 'pl-c:sow')!), /^Sow green beans/);
});

test('sowingInstruction prints published bounds and suppresses unverified legacy points', () => {
  const cabbageCrop = cropByKey('cabbage')!;
  const cabbage = sowingInstruction(cabbageCrop);
  assert.deepEqual(plantSpacingRangeCm(cabbageCrop), { rowCm: [50, 60], inRowCm: [35, 45] });
  assert.match(cabbage, /rows 50–60cm apart/);
  assert.match(cabbage, /35–45cm apart in the row/);
  assert.doesNotMatch(cabbage, /rows 55cm apart|40cm apart in the row/);

  const cabbageBoq = seedBoqForPlan([
    { id: 'range-cabbage', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 8 },
  ], BEDS)[0];
  const density = plantsPerM2Range(cabbageCrop);
  assert.deepEqual(cabbageBoq.finalPlantPositionsRange, [
    Math.max(1, Math.floor(BEDS[0].areaM2 * density[0])),
    Math.max(1, Math.ceil(BEDS[0].areaM2 * density[1])),
  ]);
  assert.deepEqual(cabbageBoq.countRange, cabbageBoq.finalPlantPositionsRange);

  assert.match(sowingInstruction(cropByKey('maize')!), /rows 91cm apart.*25cm apart.*5–10cm deep/i);
  assert.doesNotMatch(sowingInstruction(cropByKey('maize')!), /rows 90cm|20cm apart|4cm deep/i);
  // Kale's field geometry was sourced 2026-08-23 (Kirchhoffs: 40 x 40 cm,
  // 2mm depth; Starke Ayres: 1cm depth) — the old confirm-locally
  // placeholder must be gone and the deprecated 45cm square must not leak.
  assert.match(sowingInstruction(cropByKey('kale')!), /plant spacing 40cm each way/i);
  assert.match(sowingInstruction(cropByKey('kale')!), /sow 0\.2–1cm deep/i);
  assert.doesNotMatch(sowingInstruction(cropByKey('kale')!), /confirm a locally appropriate|45cm/i);
});

test('source-audited transplant timing shows readiness without painting it as field occupancy', () => {
  const lettuce = cropByKey('lettuce')!;
  const peppers = cropByKey('peppers')!;
  assert.equal(lettuce.transplant, true);
  assert.equal(lettuce.daysToHarvest, 80, 'the generic lettuce entry covers KZN butter/head types through the 80-day upper end');
  assert.equal(peppers.transplant, true);
  assert.equal(peppers.daysToHarvest, 80, 'KZN DARD gives 65–80 days from transplant');

  const lettuceRow = buildBedPlanRows([
    { id: 'lettuce', bedId: 'bed-1', cropKey: 'lettuce', sowMonth: 8 },
  ], BEDS)[0].crops[0];
  assert.equal(lettuceRow.bedMonth, 9, 'September is the first readiness check after August tray sowing');
  assert.equal(lettuceRow.bedMonthLatest, 11, 'the plan reserves through November because cold nursery conditions can take 8–12 weeks');
  assert.equal(
    lettuceRow.harvestMonth,
    1,
    'the harvest marker uses the planned October field entry plus the 80-day upper endpoint',
  );
});

test('official KZN and DAFF durations use conservative sourced endpoints', () => {
  assert.equal(cropByKey('pumpkin')!.daysToHarvest, 130, 'KZN DARD: 110–130 days');
  assert.equal(cropByKey('beetroot')!.daysToHarvest, 70, 'KZN DARD: 56–70 days');
  assert.equal(cropByKey('broad-beans')!.daysToHarvest, 120, 'KZN DARD official duration');
  assert.equal(cropByKey('amadumbe')!.daysToHarvest, 300, 'DAFF: 8–10 months');
});

test('unverified layouts withhold quantities while verified living-material ranges stay ranges', () => {
  const plantings: Planting[] = [
    { id: 'tomato', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 8 },
    { id: 'garlic', bedId: 'bed-2', cropKey: 'garlic', sowMonth: 4 },
    { id: 'amadumbe', bedId: 'bed-3', cropKey: 'amadumbe', sowMonth: 9 },
  ];
  const rows = seedBoqForPlan(plantings, BEDS);
  const tomato = rows.find((row) => row.cropKey === 'tomatoes')!;
  const garlic = rows.find((row) => row.cropKey === 'garlic')!;
  const amadumbe = rows.find((row) => row.cropKey === 'amadumbe')!;

  assert.equal(tomato.quantityStatus, 'counted-piece-range');
  assert.equal(tomato.count, null);
  assert.deepEqual(tomato.countRange, tomato.finalPlantPositionsRange);
  assert.match(sowingInstruction(cropByKey('tomatoes')!), /rows 90–120cm apart/);
  assert.equal(garlic.quantityStatus, 'counted-piece-range');
  assert.equal(garlic.count, null, 'the midpoint must not become an exact clove order');
  assert.deepEqual(garlic.countRange, garlic.finalPlantPositionsRange);
  assert.match(sowingInstruction(cropByKey('garlic')!), /rows 30–45cm apart/);
  assert.match(sowingInstruction(cropByKey('garlic')!), /7–10cm apart in the row/);
  assert.equal(amadumbe.unit, 'corms');
  assert.equal(amadumbe.quantityStatus, 'counted-piece-range');
  assert.equal(amadumbe.count, null);
  assert.deepEqual(amadumbe.countRange, amadumbe.finalPlantPositionsRange);
});

// ── Bed-by-bed plan ─────────────────────────────────────────────────────────

test('buildBedPlanRows includes EVERY bed, even the empty ones', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  assert.equal(rows.length, BEDS.length);
  const empty = rows.find((r) => r.bedId === 'bed-3')!;
  assert.deepEqual(empty.crops, [], 'an unplanted bed must still appear, so the farmer can see the gap');
});

test('buildBedPlanRows marks a staple plot as a plot', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  assert.equal(rows.find((r) => r.bedId === 'plot-1')!.kind, 'plot');
  assert.equal(rows.find((r) => r.bedId === 'bed-1')!.kind, 'bed');
});

test('a transplant crop exposes its earliest and latest readiness months', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  const onions = rows.find((r) => r.bedId === 'bed-2')!.crops.find((c) => c.cropKey === 'onions')!;
  assert.equal(onions.sowMonth, 4, 'seed into trays');
  assert.equal(onions.bedMonth, 5, 'start checking seedling and bed readiness in May');
  assert.equal(onions.bedMonthLatest, 7, 'keep July available for the supported cold-condition nursery duration');
  assert.equal(onions.harvestMonth, 12, 'the six-month field period starts from the planned June transplant');
  assert.equal(onions.transplant, true);

  const carrots = rows.find((r) => r.bedId === 'bed-1')!.crops.find((c) => c.cropKey === 'carrots')!;
  assert.equal(carrots.sowMonth, carrots.bedMonth, 'a direct-sown crop takes the ground the month it is sown');
  assert.equal(carrots.bedMonthLatest, carrots.bedMonth, 'direct sowing has no nursery-readiness range');
});

test('printed field and occupancy tables keep the nursery month out of a transplant crop growing period', () => {
  const onionOnly = PLANTINGS.filter((p) => p.cropKey === 'onions');
  const planRow = buildPlanTableRows(onionOnly, BEDS)[0];
  assert.equal(planRow.establish, 'Nursery Apr');
  assert.equal(planRow.intoField, 'Check May-Jul; transplant when ready');
  assert.equal(planRow.harvest, 'Dec', '180 days are counted from the planned field-entry month, not tray sowing');

  const onionCalendar = buildOccupancyCalendar(onionOnly, BEDS, 4)
    .find((row) => row.bedId === 'bed-2')!;
  const months = rollingMonths(4);
  const april = onionCalendar.cells[months.indexOf(4)];
  const may = onionCalendar.cells[months.indexOf(5)];
  const june = onionCalendar.cells[months.indexOf(6)];
  const july = onionCalendar.cells[months.indexOf(7)];
  const december = onionCalendar.cells[months.indexOf(12)];
  assert.deepEqual(april, [], 'seedlings in a nursery do not occupy the bed');
  // 2026-08-19 (TRANSPLANT_BED_RESERVED_FROM_MONTHS): the same table tells
  // the farmer "Check May-Jul; transplant when ready" — from May the farmer
  // may put onions in this bed, so from May the calendar must show the bed
  // held for onions. Until this fix May showed empty while the plan text
  // invited a May transplant into it, the mismatch behind the stress
  // harness's 2,003 double-bookings. Harvest timing is unchanged.
  assert.equal(may[0]?.cropKey, 'onions', 'the bed is reserved from the first readiness-check month');
  assert.equal(may[0]?.harvesting, false, 'reserved is not harvesting');
  assert.equal(june[0]?.harvesting, false, 'the crop remains in the field after transplant');
  assert.equal(july[0]?.harvesting, false, 'the crop remains in the field after transplant');
  assert.equal(december[0]?.harvesting, true, 'the field calendar marks harvest from the planned field entry');
});

test('a cut-and-come-again crop shows a harvest window, a one-shot crop shows one month', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  const spinach = rows.find((r) => r.bedId === 'bed-1')!.crops.find((c) => c.cropKey === 'swiss-chard')!;
  assert.ok(cropByKey('swiss-chard')!.harvestWindowMonths);
  assert.notEqual(spinach.harvestEndMonth, spinach.harvestMonth);
  assert.equal(spinach.existing, true);

  const beans = rows.find((r) => r.bedId === 'plot-1')!.crops[0];
  assert.equal(beans.harvestEndMonth, beans.harvestMonth);
});

test('an unverified crop benchmark stays unavailable in the report, dashboard and PDF row', () => {
  const unknown: Planting[] = [
    // Kale carried this fixture until 2026-08-23, when it gained a sourced
    // international benchmark. Amadumbe is now the catalog's verified-schedule,
    // no-kilograms case, so it takes over the role.
    { id: 'unknown-amadumbe', bedId: 'bed-1', cropKey: 'amadumbe', sowMonth: 4 },
    { id: 'unknown-coriander', bedId: 'bed-2', cropKey: 'coriander', sowMonth: 5 },
  ];
  const rows = buildPlanTableRows(unknown, BEDS);
  assert.deepEqual(rows.map((row) => row.yieldKg), [null, null]);
  assert.deepEqual(rows.map((row) => benchmarkYieldLabel(row.yieldKg)), ['Not verified', 'Not verified']);

  const report = buildYearReport(unknown, BEDS);
  assert.equal(report.length, 1);
  assert.match(report[0], /No kilogram food-yield total is shown/);
  assert.match(report[0], /Amadumbe \(taro\), Coriander/);
  assert.doesNotMatch(report.join(' '), /totals? about 0(?:\.0)?kg/i);

  const dashboard = buildPlanDashboard(unknown, BEDS, tasksForPlan(unknown, BEDS), {
    nowMonth: NOW_MONTH,
    lossPercent: 10,
  });
  assert.equal(dashboard.hasKnownYield, false);
  assert.deepEqual(dashboard.unknownYieldCrops, ['Amadumbe (taro)', 'Coriander']);
  assert.equal(dashboard.stats[1].value, 'Not shown');
  // No known kg means no density to show either — it must not read as a 0.
  assert.equal(dashboard.stats[2].label, 'benchmark density');
  assert.equal(dashboard.stats[2].value, 'Not shown');
  assert.equal(dashboard.stats[3].value, 'Not calculated');
  assert.equal(dashboard.stats[4].label, 'fresh-picking months');
  assert.match(dashboard.signals.join(' '), /excluded from every kg total, not counted as 0kg/);
});

test('a soil-cover crop is labelled as no food yield rather than unverified or failed', () => {
  const cover: Planting[] = [
    { id: 'cover-oats', bedId: 'bed-1', cropKey: 'oats', sowMonth: 5 },
  ];
  const rows = buildPlanTableRows(cover, BEDS);
  assert.equal(rows[0]?.yieldKg, 0);
  assert.equal(benchmarkYieldLabel(rows[0]?.yieldKg ?? null), 'No food yield');

  const report = buildYearReport(cover, BEDS);
  assert.equal(report.length, 1);
  assert.match(report[0], /soil-cover crop/);
  assert.match(report[0], /0 food kg/);
  assert.doesNotMatch(report[0], /unverified|no verified/i);
  assert.match(report[0], /not as a failed harvest/i);
});

test('a mixed plan labels its kg as a known benchmark subtotal and names every exclusion', () => {
  const mixed: Planting[] = [
    { id: 'known-carrots', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
    { id: 'unknown-amadumbe', bedId: 'bed-2', cropKey: 'amadumbe', sowMonth: 4 },
  ];
  const dashboard = buildPlanDashboard(mixed, BEDS, tasksForPlan(mixed, BEDS), {
    nowMonth: NOW_MONTH,
    lossPercent: 0,
  });
  const expectedKnownKg = cropByKey('carrots')!.yieldKgPerM2! * BEDS[0].areaM2;
  const totalAreaM2 = BEDS.reduce((sum, bed) => sum + bed.areaM2, 0);

  assert.equal(dashboard.grossKg, expectedKnownKg);
  assert.equal(dashboard.netKg, null, 'a default 0% loss is not a confirmed loss assumption');
  assert.equal('peakMonth' in dashboard, false);
  assert.equal('peakKg' in dashboard, false);
  assert.equal(dashboard.stats[1].label, 'known benchmark total');
  assert.equal(dashboard.stats[1].value, `${expectedKnownKg.toFixed(1)} kg`);
  // The density stat is the SAME two numbers divided, not a third estimate.
  assert.equal(dashboard.stats[2].label, 'benchmark density');
  assert.equal(dashboard.stats[2].value, `${(expectedKnownKg / totalAreaM2).toFixed(2)} kg/m2`);
  assert.equal(dashboard.stats[3].value, 'Not calculated');
  assert.deepEqual(dashboard.unknownYieldCrops, ['Amadumbe (taro)']);
  assert.match(dashboard.decisions.join(' '), /not a meal or surplus guarantee/);

  const report = buildYearReport(mixed, BEDS).join(' ');
  assert.match(report, /conservative commercial comparison/);
  assert.match(report, /Amadumbe \(taro\) has no verified kg\/m² benchmark/);
  assert.match(report, /not being counted as 0kg/);
  assert.doesNotMatch(report, /sum of every crop line|farm-yield promise/i);
});

test('loss-adjusted benchmark appears only after the allowance is explicitly confirmed', () => {
  const planting: Planting[] = [
    { id: 'known-carrots', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
  ];
  const dashboard = buildPlanDashboard(planting, BEDS, tasksForPlan(planting, BEDS), {
    nowMonth: NOW_MONTH,
    lossPercent: 10,
    lossAllowanceConfirmed: true,
  });

  assert.notEqual(dashboard.grossKg, null);
  assert.equal(dashboard.netKg, dashboard.grossKg! * 0.9);
  // The loss-adjusted stat sits one slot later than before it — the density
  // stat above it (unaffected by the loss allowance) now occupies index 2.
  assert.equal(dashboard.stats[3].value, `${dashboard.netKg!.toFixed(1)} kg`);
  assert.match(dashboard.stats[3].detail, /allowance you confirmed/);
});

test('the printable plan has no monthly yield chart or peak derived from an even split', () => {
  const benchmarkSource = readFileSync(new URL('../lib/crop-export-benchmark.ts', import.meta.url), 'utf8');
  const pdfSource = readFileSync(new URL('../lib/crop-export-pdf.ts', import.meta.url), 'utf8');
  const production = `${benchmarkSource}\n${pdfSource}`;

  assert.doesNotMatch(production, /buildHarvestSeries|peakKg|peakMonth/);
  assert.doesNotMatch(production, /Known benchmark comparison by harvest month|spread evenly across those months/);
  assert.match(production, /Crop-cycle benchmark weights are shown by crop only; no monthly kg or Rand is inferred/);
});

test('bedShareLabel says it in words a PDF font can actually print', () => {
  assert.equal(bedShareLabel(1), '');
  assert.equal(bedShareLabel(0.5), 'half the bed');
  assert.equal(bedShareLabel(1 / 3), 'a third of the bed');
  assert.equal(bedShareLabel(0.25), 'a quarter of the bed');
  assert.equal(bedShareLabel(0.4), '40% of the bed');
  for (const f of [1, 0.5, 1 / 3, 0.25, 0.4]) {
    assert.equal(pdfSafe(bedShareLabel(f)), bedShareLabel(f), 'no glyph a PDF font would drop');
  }
});

// ── Buying schedule ─────────────────────────────────────────────────────────

test('the buying schedule totals EXACTLY match the on-screen seed BOQ', () => {
  // The card on screen and the schedule on paper must never disagree — the
  // farmer is in a shop when they find out.
  const schedule = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH);
  const totals = buyingScheduleTotals(schedule);
  const positionRanges = new Map<string, [number, number]>();
  for (const item of schedule.flatMap((month) => month.items)) {
    const prior = positionRanges.get(item.cropKey) ?? [0, 0];
    positionRanges.set(item.cropKey, [
      prior[0] + item.finalPlantPositionsRange[0],
      prior[1] + item.finalPlantPositionsRange[1],
    ]);
  }
  for (const row of seedBoqForPlan(PLANTINGS, BEDS)) {
    assert.equal(totals.get(row.cropKey), row.count, `${row.cropName} disagrees with the BOQ`);
    assert.deepEqual(
      positionRanges.get(row.cropKey),
      row.finalPlantPositionsRange,
      `${row.cropName} range disagrees with the on-screen BOQ`,
    );
    if (row.quantityStatus === 'counted-piece-range') {
      assert.deepEqual(row.countRange, row.finalPlantPositionsRange);
    }
  }
  assert.equal(totals.size, seedBoqForPlan(PLANTINGS, BEDS).length);
});

test('the shopping calendar does not invent a one-month packet-seed lead time', () => {
  const schedule = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH);
  const items = schedule.flatMap((m) => m.items);
  for (const item of items) {
    const expected = item.transplant ? item.bedMonth : item.sowMonth;
    assert.equal(item.buyMonth, expected, `${item.cropName} is bought in the wrong month`);
    assert.equal(item.buyMonth, schedule.find((m) => m.items.includes(item))!.month);
  }
});

test('ready seedlings use the readiness window while own seed is sourced before nursery sowing', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const onions = items.find((i) => i.cropKey === 'onions')!;
  assert.equal(onions.unit, 'seedlings');
  assert.equal(onions.buyMonth, 5, 'the shopping marker is the first readiness check, not a promised transplant date');
  assert.equal(onions.sowMonth, 4, 'trays');
  assert.equal(onions.bedMonth, 5, 'first readiness check');
  assert.equal(onions.bedMonthLatest, 7, 'latest readiness month');
  assert.equal(onions.harvestMonth, 12, 'the buying sheet separates the readiness range from planned field maturity');
  assert.match(onions.note, /planning window is May–July/i);
  assert.match(onions.note, /only when the bed and seedlings are ready/i);
  assert.match(onions.note, /Source packet seed before the April tray-sowing month/i);
  assert.doesNotMatch(onions.note, /packet seed by March/i);
  assert.match(onions.note, /sow trays in April/i);
  assert.match(onions.note, /4–6 weeks/);
  assert.match(onions.note, /twice as long \(8–12 weeks\)/);
  assert.match(onions.note, /middle month as its working transplant date/i);
  assert.match(onions.note, /ready-grown seedlings/);
});

test('direct-sown seed requires the packet rate instead of an invented count', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const beans = items.find((i) => i.cropKey === 'green-beans')!;
  assert.equal(beans.unit, 'seeds');
  assert.equal(beans.count, null, 'final plant spacing must not be presented as an exact seed packet quantity');
  assert.equal(beans.countRange, null, 'a final-position range is still not a botanical seed order');
  assert.ok(beans.finalPlantPositionsRange[1] > beans.finalPlantPositionsRange[0]);
  assert.equal(beans.buyMonth, 11, 'November is a sowing-month marker, not an invented October procurement date');
  assert.match(beans.note, /Source packet seed before the November sowing month/i);
  assert.match(beans.note, /Sow straight into the ground in November/);
  assert.match(beans.note, new RegExp(positionRangeLabel(beans.finalPlantPositionsRange)));
  assert.match(beans.note, /packet's crop-specific direct-sowing rate/);
});

test('living planting material is not treated as a seed packet', () => {
  const withSlips: Planting[] = [{ id: 'pl-s', bedId: 'bed-3', cropKey: 'sweet-potato', sowMonth: 10 }];
  const items = buildBuyingSchedule(withSlips, BEDS, NOW_MONTH).flatMap((m) => m.items);
  assert.equal(items[0].unit, 'slips');
  assert.equal(items[0].count, null, 'a representative midpoint must not become an exact slip order');
  assert.deepEqual(items[0].countRange, items[0].finalPlantPositionsRange);
  assert.equal(items[0].buyMonth, 10, 'fresh slips belong close to planting, not a month early');
  assert.match(items[0].note, new RegExp(positionRangeLabel(items[0].finalPlantPositionsRange)));
  assert.match(items[0].note, /Living planting material/);
  // Same requirement, farmer-voice wording after the 2026-08-20 jargon pass —
  // pinned to the whole clause, not a two-word span with a wildcard between.
  assert.match(items[0].note, /follow the supplier's or your local handling advice/i);
  assert.doesNotMatch(items[0].note, /cool and dry|Seed keeps/i);
});

test('the schedule is grouped by month, in rolling order from today', () => {
  const schedule = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH);
  const order = schedule.map((m) => m.month);
  const expectedOrder = rollingMonths(NOW_MONTH).filter((m) => order.includes(m));
  assert.deepEqual(order, expectedOrder, 'months must read forward from today, not Jan-Dec');
  assert.equal(new Set(order).size, order.length, 'a month must appear once, with everything for it together');
  for (const month of schedule) assert.ok(month.items.length > 0, 'empty months are dropped, not printed blank');
});

test('two crops sharing a buy month land in the same month block', () => {
  const may = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).find((m) => m.month === 5)!;
  assert.deepEqual(may.items.map((i) => i.cropKey).sort(), ['cabbage', 'onions']);
});

test('a succession of the same crop is listed under each of its own buy months', () => {
  // Carrots sown in March and again in June retain separate sowing-month
  // markers. Merging them would imply one procurement date the source does not
  // provide and obscure which packet-rate calculation belongs to each cohort.
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const carrotMonths = items.filter((i) => i.cropKey === 'carrots').map((i) => i.buyMonth).sort((a, b) => a - b);
  assert.deepEqual(carrotMonths, [3, 6]);
});

test('two plantings of one crop bought in the SAME month merge into one line', () => {
  const twoBeds: Planting[] = [
    { id: 'pl-1', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
    { id: 'pl-2', bedId: 'bed-3', cropKey: 'carrots', sowMonth: 3 },
  ];
  const items = buildBuyingSchedule(twoBeds, BEDS, NOW_MONTH).flatMap((m) => m.items);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].bedLabels, ['Bed 1', 'Bed 3'], 'the line must say which beds it covers');
  assert.equal(items[0].count, seedBoqForPlan(twoBeds, BEDS)[0].count);
  assert.equal(items[0].finalPlantPositions, seedBoqForPlan(twoBeds, BEDS)[0].finalPlantPositions);
});

test('small fractional plantings round once within a cohort but separately across succession months', () => {
  const tinyBeds: PlanBed[] = [
    { id: 'tiny-1', label: 'Tiny 1', areaM2: 0.2 },
    { id: 'tiny-2', label: 'Tiny 2', areaM2: 0.2 },
  ];
  const sameMonth: Planting[] = [
    { id: 'cab-1', bedId: 'tiny-1', cropKey: 'cabbage', sowMonth: 4, areaFraction: 1 / 3 },
    { id: 'cab-2', bedId: 'tiny-2', cropKey: 'cabbage', sowMonth: 4, areaFraction: 1 / 3 },
  ];
  const sameBoq = seedBoqForPlan(sameMonth, tinyBeds)[0];
  const sameSchedule = buildBuyingSchedule(sameMonth, tinyBeds, NOW_MONTH);
  assert.equal(sameBoq.count, 1, 'one shared sowing cohort must aggregate before rounding');
  assert.equal(buyingScheduleTotals(sameSchedule).get('cabbage'), sameBoq.count);

  const separateMonths: Planting[] = [sameMonth[0], { ...sameMonth[1], sowMonth: 5 }];
  const separateBoq = seedBoqForPlan(separateMonths, tinyBeds)[0];
  const separateSchedule = buildBuyingSchedule(separateMonths, tinyBeds, NOW_MONTH);
  assert.equal(separateBoq.count, 2, 'separate succession cohorts each need their own discrete seedling');
  assert.equal(buyingScheduleTotals(separateSchedule).get('cabbage'), separateBoq.count);
});

test('already-growing crops are not on the shopping list', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  assert.ok(!items.some((i) => i.cropKey === 'swiss-chard'), 'nothing to buy for a crop already in the ground');
});

test('an all-existing plan produces an empty schedule rather than a phantom shopping trip', () => {
  const allExisting = PLANTINGS.map((p) => ({ ...p, existing: true }));
  assert.deepEqual(buildBuyingSchedule(allExisting, BEDS, NOW_MONTH), []);
});

// ── a settled nursery cohort's seedling line survives into its own month ────
//
// A settled one-time starter still holding its `inNursery` stamp is a farmer
// exception to "already-growing crops are not on the shopping list" above:
// its trays are sown, but the ready-grown-seedling purchase is still ahead.

const NURSERY_BED: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 20 }];

test('a seedling line survives into the month it is staged for', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const nur = settleOnceRows([starter], 2026, 10)[0];

  const octSchedule = buildBuyingSchedule([nur], NURSERY_BED, 10);
  const items = octSchedule.flatMap((m) => m.items);
  assert.equal(items.length, 1, 'BEFORE this fix: 0 — the schedule was empty');
  assert.equal(items[0].cropKey, 'cabbage');
  assert.equal(items[0].unit, 'seedlings');
  assert.equal(items[0].buyMonth, 10);
  assert.deepEqual(items[0].countRange, [74, 115]);
  assert.equal(octSchedule[0].month, 10, 'filed in THIS October, not eleven months out');

  // And it is gone the month after, same as the task list.
  const nov = settleOnceRows([starter], 2026, 11);
  assert.deepEqual(buildBuyingSchedule(nov, NURSERY_BED, 11), []);
});

test('a nursery line does not tell the farmer to buy seed for a month that has gone', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const nur = settleOnceRows([starter], 2026, 10)[0];
  const items = buildBuyingSchedule([nur], NURSERY_BED, 10).flatMap((m) => m.items);
  assert.equal(items.length, 1);
  assert.ok(!items[0].note.includes('Raising your own'));
  assert.ok(items[0].note.includes("tray-sowing month (September) has passed"));
  assert.ok(items[0].note.includes('planning window is October–December'));
});

test('the quantity does not change when the row settles — only the note does', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const sepItems = buildBuyingSchedule(settleOnceRows([starter], 2026, 9), NURSERY_BED, 9).flatMap((m) => m.items);
  const octItems = buildBuyingSchedule(settleOnceRows([starter], 2026, 10), NURSERY_BED, 10).flatMap((m) => m.items);
  assert.equal(sepItems.length, 1);
  assert.equal(octItems.length, 1);
  assert.equal(sepItems[0].count, octItems[0].count);
  assert.deepEqual(sepItems[0].countRange, octItems[0].countRange);
  assert.equal(sepItems[0].buyMonth, octItems[0].buyMonth);
  assert.notEqual(sepItems[0].note, octItems[0].note, 'the tray-sowing month has now passed');
});

test('a planting on a bed that no longer exists is skipped, not crashed on', () => {
  const orphan: Planting[] = [{ id: 'pl-x', bedId: 'deleted-bed', cropKey: 'carrots', sowMonth: 3 }];
  assert.deepEqual(buildBuyingSchedule(orphan, BEDS, NOW_MONTH), []);
  assert.deepEqual(buildBedPlanRows(orphan, BEDS).flatMap((r) => r.crops), []);
});

// ── Task months ─────────────────────────────────────────────────────────────

test('buildTaskMonths reads forward from today and drops empty months', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS, NOW_MONTH);
  const months = buildTaskMonths(tasks, NOW_MONTH);
  assert.equal(months.reduce((n, m) => n + m.tasks.length, 0), tasks.length, 'every task must be printed exactly once');
  assert.deepEqual(
    months.map((entry) => entry.monthsAway),
    [...months.map((entry) => entry.monthsAway)].sort((a, b) => a - b),
  );
  for (const entry of months) {
    assert.equal(entry.month, rollingMonths(NOW_MONTH, entry.monthsAway + 1).at(-1));
  }
  for (const month of months) assert.ok(month.tasks.length > 0);
});

test('task-month grouping keeps a following-year harvest after its next-year sowing', () => {
  const tasks = tasksForPlan([{
    id: 'next-september-beans', bedId: 'bed-1', cropKey: 'green-beans', sowMonth: 9,
  }], BEDS);
  const grouped = buildTaskMonths(tasks, 11);

  assert.deepEqual(grouped.map(({ month, monthsAway }) => [month, monthsAway]), [
    [8, 9],
    [9, 10],
    [11, 12],
  ]);
  assert.equal(grouped[0].tasks[0].action, 'prep');
  assert.equal(grouped[1].tasks[0].action, 'sow');
  assert.equal(grouped[2].tasks[0].action, 'harvest');

  const currentNovemberSheet = buildFieldSheet(
    11,
    tasks,
    new Date('2026-11-06T09:00:00Z'),
  );
  assert.equal(
    currentNovemberSheet.sourceLines,
    0,
    'the one-year field sheets must not pull the following November harvest into this November',
  );
});

// ── PDF text safety ─────────────────────────────────────────────────────────

test('pdfSafe drops emoji, which jsPDF built-in fonts cannot draw at all', () => {
  assert.equal(pdfSafe('🌽 Maize (mielies)'), 'Maize (mielies)');
  assert.equal(pdfSafe('🥬 Kale — 🌱 seed'), 'Kale - seed');
});

test('pdfSafe transliterates punctuation instead of dropping it', () => {
  assert.equal(pdfSafe('rows 90cm apart · sow 4cm deep'), 'rows 90cm apart - sow 4cm deep');
  assert.equal(pdfSafe('sow — then mulch'), 'sow - then mulch');
  assert.equal(pdfSafe('don’t wait…'), "don't wait...");
  assert.equal(pdfSafe('½ a bed'), '1/2 a bed');
});

test('pdfSafe keeps the Latin-1 characters the app really uses', () => {
  assert.equal(pdfSafe('Hügel 1 — 8.0 m²'), 'Hügel 1 - 8.0 m²');
});

test('every string the PDF prints survives pdfSafe with content intact', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  for (const task of tasks) {
    const safe = pdfSafe(taskLine(task));
    assert.ok(safe.length > 0);
    assert.ok([...safe].every((ch) => (ch.codePointAt(0) ?? 0) <= 0xff), `unprintable glyph left in: ${safe}`);
    // The crop name must survive — dropping the icon must not eat the words.
    assert.ok(safe.toLowerCase().includes(task.cropName.toLowerCase().slice(0, 6)));
  }
  for (const item of buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items)) {
    assert.ok([...pdfSafe(item.note)].every((ch) => (ch.codePointAt(0) ?? 0) <= 0xff));
  }
});

test('the printed bed-by-bed plan marks a one-time starter, so paper cannot read it as an annual crop', () => {
  // The printed sheet is what a farmer carries into the field. A first-season
  // starter that prints identically to a recurring row recreates, on paper,
  // exactly the phantom-recurrence reading the `once` field exists to prevent.
  const mixed: Planting[] = [
    { id: 'recurring', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 2 },
    { id: 'starter', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' },
  ];
  const rows = buildPlanTableRows(mixed, BEDS).filter((row) => row.area === 'Bed 1');
  assert.equal(rows.length, 2);
  const starterRow = rows.find((row) => row.establish.includes('Sep'))!;
  const recurringRow = rows.find((row) => row.establish.includes('Feb'))!;
  assert.equal(starterRow.once, true, 'the starter row carries the flag the printer needs');
  assert.equal(recurringRow.once, false, 'a recurring row must never be flagged');
});
