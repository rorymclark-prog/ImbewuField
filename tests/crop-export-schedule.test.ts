import assert from 'node:assert/strict';
import test from 'node:test';

import { cropByKey } from '@/lib/crop-catalog';
import { seedBoqForPlan, tasksForPlan, type PlanBed, type Planting } from '@/lib/crop-plan';
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
  taskLine,
  taskSentence,
  taskTitle,
} from '@/lib/crop-export-schedule';
import { pdfSafe } from '@/lib/crop-export-pdf';

const BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 6, minDimM: 1.2 },
  { id: 'bed-2', label: 'Hügel 1', areaM2: 8, minDimM: 1.5 },
  { id: 'bed-3', label: 'Bed 3', areaM2: 6, minDimM: 1.2 },
  { id: 'plot-1', label: 'Plot 1', areaM2: 400, kind: 'plot' },
];

const PLANTINGS: Planting[] = [
  { id: 'pl-a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
  { id: 'pl-b', bedId: 'bed-2', cropKey: 'onions', sowMonth: 4 },       // transplant: true
  { id: 'pl-c', bedId: 'plot-1', cropKey: 'maize', sowMonth: 11 },
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

test('taskSentence reads the same as the screen, including the plot prep wording', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const plotPrep = tasks.find((t) => t.id === 'pl-c:prep')!;
  assert.match(taskSentence([plotPrep]), /plough or rip the plot, work in kraal manure for maize \(mielies\) \(Plot 1\)/);

  const bedPrep = tasks.find((t) => t.id === 'pl-a:prep')!;
  assert.match(taskSentence([bedPrep]), /prep bed \(compost \+ kraal manure, then let it rest\) for carrots \(Bed 1\)/);
});

test('taskSentence appends spacing only to sow tasks', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.match(taskSentence([tasks.find((t) => t.id === 'pl-c:sow')!]), /rows 90cm apart/);
  assert.doesNotMatch(taskSentence([tasks.find((t) => t.id === 'pl-c:harvest')!]), /rows 90cm apart/);
});

test('taskSentence says so when nothing is due', () => {
  assert.equal(taskSentence([]), 'nothing due');
});

test('taskTitle always names the crop and the ground', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-c:sow')!), 'Sow Maize (mielies) — Plot 1');
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-c:prep')!), 'Prep Plot 1 for Maize (mielies)');
  assert.equal(taskTitle(tasks.find((t) => t.id === 'pl-b:transplant')!), 'Transplant Onions — Hügel 1');
});

test('taskLine is sentence-cased for standalone reading', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.match(taskLine(tasks.find((t) => t.id === 'pl-c:sow')!), /^Sow maize/);
});

test('sowingInstruction never invents a number the catalog does not have', () => {
  assert.equal(sowingInstruction(cropByKey('maize')!), 'rows 90cm apart · 20cm apart in the row · sow 4cm deep');
  // Kale is a crop the KZN DARD spacing table doesn't carry, so it still has
  // only the single legacy figure — the fallback wording must show that rather
  // than invent a row split. (Was onions, until the 2026-08-05 DARD pass gave
  // onions a sourced split and this fixture went stale.)
  assert.match(sowingInstruction(cropByKey('kale')!), /^plant spacing ~45cm/);
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

test('a transplant crop reaches the bed a month after its seed goes into trays', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  const onions = rows.find((r) => r.bedId === 'bed-2')!.crops.find((c) => c.cropKey === 'onions')!;
  assert.equal(onions.sowMonth, 4, 'seed into trays');
  assert.equal(onions.bedMonth, 5, 'seedlings into the bed');
  assert.equal(onions.transplant, true);

  const carrots = rows.find((r) => r.bedId === 'bed-1')!.crops.find((c) => c.cropKey === 'carrots')!;
  assert.equal(carrots.sowMonth, carrots.bedMonth, 'a direct-sown crop takes the ground the month it is sown');
});

test('a cut-and-come-again crop shows a harvest window, a one-shot crop shows one month', () => {
  const rows = buildBedPlanRows(PLANTINGS, BEDS);
  const spinach = rows.find((r) => r.bedId === 'bed-1')!.crops.find((c) => c.cropKey === 'swiss-chard')!;
  assert.ok(cropByKey('swiss-chard')!.harvestWindowMonths);
  assert.notEqual(spinach.harvestEndMonth, spinach.harvestMonth);
  assert.equal(spinach.existing, true);

  const maize = rows.find((r) => r.bedId === 'plot-1')!.crops[0];
  assert.equal(maize.harvestEndMonth, maize.harvestMonth);
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
  const totals = buyingScheduleTotals(buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH));
  for (const row of seedBoqForPlan(PLANTINGS, BEDS)) {
    assert.equal(totals.get(row.cropKey), row.count, `${row.cropName} disagrees with the BOQ`);
  }
  assert.equal(totals.size, seedBoqForPlan(PLANTINGS, BEDS).length);
});

test('you buy the month BEFORE you sow', () => {
  const schedule = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH);
  const items = schedule.flatMap((m) => m.items);
  for (const item of items) {
    const expected = ((item.sowMonth - 1 - 1 + 12) % 12) + 1;
    assert.equal(item.buyMonth, expected, `${item.cropName} is bought in the wrong month`);
    assert.equal(item.buyMonth, schedule.find((m) => m.items.includes(item))!.month);
  }
});

test('seedling crops are bought TWO months before they reach the bed', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const onions = items.find((i) => i.cropKey === 'onions')!;
  assert.equal(onions.unit, 'seedlings');
  assert.equal(onions.buyMonth, 3);
  assert.equal(onions.sowMonth, 4, 'trays');
  assert.equal(onions.bedMonth, 5, 'bed');
  assert.match(onions.note, /Sow into trays in April/);
  assert.match(onions.note, /plant the seedlings out in May/);
  assert.match(onions.note, /six weeks/);
  assert.match(onions.note, /ready-grown seedlings/);
});

test('direct-sown seed says it keeps, so buying early is only insurance', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const maize = items.find((i) => i.cropKey === 'maize')!;
  assert.equal(maize.unit, 'seeds');
  assert.equal(maize.buyMonth, 10);
  assert.match(maize.note, /Sow straight into the ground in November/);
  assert.match(maize.note, /Seed keeps/);
});

test('living planting material is not treated as a seed packet', () => {
  const withSlips: Planting[] = [{ id: 'pl-s', bedId: 'bed-3', cropKey: 'sweet-potato', sowMonth: 10 }];
  const items = buildBuyingSchedule(withSlips, BEDS, NOW_MONTH).flatMap((m) => m.items);
  assert.equal(items[0].unit, 'slips');
  assert.match(items[0].note, /Living planting material/);
  assert.doesNotMatch(items[0].note, /Seed keeps/);
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
  const march = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).find((m) => m.month === 3)!;
  assert.deepEqual(march.items.map((i) => i.cropKey).sort(), ['cabbage', 'onions']);
});

test('a succession of the same crop is listed under each of its own buy months', () => {
  // Carrots sown in March and again in June are two separate shopping trips,
  // not one lump — merging them would have the farmer buying June's seed in
  // February.
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  const carrotMonths = items.filter((i) => i.cropKey === 'carrots').map((i) => i.buyMonth).sort((a, b) => a - b);
  assert.deepEqual(carrotMonths, [2, 5]);
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
});

test('already-growing crops are not on the shopping list', () => {
  const items = buildBuyingSchedule(PLANTINGS, BEDS, NOW_MONTH).flatMap((m) => m.items);
  assert.ok(!items.some((i) => i.cropKey === 'swiss-chard'), 'nothing to buy for a crop already in the ground');
});

test('an all-existing plan produces an empty schedule rather than a phantom shopping trip', () => {
  const allExisting = PLANTINGS.map((p) => ({ ...p, existing: true }));
  assert.deepEqual(buildBuyingSchedule(allExisting, BEDS, NOW_MONTH), []);
});

test('a planting on a bed that no longer exists is skipped, not crashed on', () => {
  const orphan: Planting[] = [{ id: 'pl-x', bedId: 'deleted-bed', cropKey: 'carrots', sowMonth: 3 }];
  assert.deepEqual(buildBuyingSchedule(orphan, BEDS, NOW_MONTH), []);
  assert.deepEqual(buildBedPlanRows(orphan, BEDS).flatMap((r) => r.crops), []);
});

// ── Task months ─────────────────────────────────────────────────────────────

test('buildTaskMonths reads forward from today and drops empty months', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const months = buildTaskMonths(tasks, NOW_MONTH);
  assert.equal(months.reduce((n, m) => n + m.tasks.length, 0), tasks.length, 'every task must be printed exactly once');
  const order = months.map((m) => m.month);
  assert.deepEqual(order, rollingMonths(NOW_MONTH).filter((m) => order.includes(m)));
  for (const month of months) assert.ok(month.tasks.length > 0);
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
