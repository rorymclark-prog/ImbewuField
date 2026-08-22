// Soil cover and weeding depend on observed soil cover, weed pressure, crop stage and local
// practice. The crop catalogue does not contain evidence for universal dates, so generated plans
// must not turn either job into a dated instruction or inflate a staffing chart with invented work.
// `FOLDED_ACTIONS` remains compatible with old saved mulch tasks, but is not authority to create
// new agronomy instructions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasksForPlan, type Planting, type PlanBed } from '@/lib/crop-plan';
import { buildWorkloadSeries, buildFieldSheet, FOLDED_ACTIONS } from '@/lib/crop-export-benchmark';

const BEDS: PlanBed[] = [
  { id: 'b1', label: 'Bed 1', areaM2: 10 },
  { id: 'b2', label: 'Bed 2', areaM2: 10 },
  { id: 'b3', label: 'Bed 3', areaM2: 10 },
];

// Deliberately mixed across direct-sown and transplanted crops so the absence of generic field
// maintenance is not an artefact of one establishment method.
const PLANTINGS = [
  { id: 'p1', cropKey: 'lettuce', bedId: 'b1', sowMonth: 2 },
  { id: 'p2', cropKey: 'swiss-chard', bedId: 'b2', sowMonth: 3 },
  { id: 'p3', cropKey: 'cabbage', bedId: 'b3', sowMonth: 4 },
  { id: 'p4', cropKey: 'carrot', bedId: 'b1', sowMonth: 8 },
] as Planting[];

test('generated plans do not invent generic mulch or weeding dates', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const unsupported = new Set(['mulch', 'weed-early', 'weed-mid']);
  assert.deepEqual(
    tasks.filter((task) => unsupported.has(task.action)),
    [],
    'a generated workload must contain only work for which the plan has timing evidence',
  );
});

test('legacy mulch tasks remain folded without hiding supported plan work', () => {
  assert.deepEqual([...FOLDED_ACTIONS], ['mulch']);
  for (const action of ['harvest', 'sow', 'prep'] as const) {
    assert.equal(FOLDED_ACTIONS.has(action), false);
  }
});

test('a plan of nothing has no workload, and no month invents one', () => {
  const series = buildWorkloadSeries([], 1);
  assert.equal(series.length, 12);
  assert.ok(series.every((m) => m.count === 0));
});

test('the busiest month is chosen from the folded count, not the raw task list', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const series = buildWorkloadSeries(tasks, 1);
  const peak = series.reduce((m, x) => (x.count > m.count ? x : m), series[0]);

  // Count what actually happens in the peak month, by hand, excluding folded actions.
  const realJobsInPeak = tasks.filter(
    (t) => t.month === peak.month && !FOLDED_ACTIONS.has(t.action),
  ).length;
  assert.equal(peak.count, realJobsInPeak);
});

// 2026-08-22: buildWorkloadSeries used to count one unit per raw task, one per
// bed — never applying the same-bed merge buildFieldSheet's own
// mergeIdenticalWork() uses ("Sow carrots" into four beds the same month is
// ONE job, not four). On the real Ubhejane Crèche plan this printed a
// "Workload by month" chart and a "Plan signals" bullet claiming August was a
// 29-job peak, while August's own field sheet — built from the identical
// `tasks` array — printed 12 rows. The two numbers can only stay honest if
// they come from the same aggregation; this pins that they always do.
test('the chart never disagrees with the field sheet it is supposed to summarise', () => {
  const beds: PlanBed[] = [
    { id: 'b1', label: 'Bed 1', areaM2: 10 },
    { id: 'b2', label: 'Bed 2', areaM2: 10 },
    { id: 'b3', label: 'Bed 3', areaM2: 10 },
    { id: 'b4', label: 'Bed 4', areaM2: 10 },
  ];
  // The same crop sown into four different beds the same month — exactly the
  // shape that inflated the old raw-task count without inflating the printed
  // field sheet, which merges identical same-month work across beds into one row.
  const plantings = [
    { id: 'p1', cropKey: 'carrots', bedId: 'b1', sowMonth: 8 },
    { id: 'p2', cropKey: 'carrots', bedId: 'b2', sowMonth: 8 },
    { id: 'p3', cropKey: 'carrots', bedId: 'b3', sowMonth: 8 },
    { id: 'p4', cropKey: 'carrots', bedId: 'b4', sowMonth: 8 },
  ] as Planting[];
  const tasks = tasksForPlan(plantings, beds);
  const nowMonth = 8;
  const series = buildWorkloadSeries(tasks, nowMonth);
  const now = new Date(2026, nowMonth - 1, 1);

  for (const { month, count } of series) {
    const sheet = buildFieldSheet(month, tasks, now);
    assert.equal(
      count, sheet.workRows,
      `month ${month}: chart says ${count} jobs but its own field sheet prints ${sheet.workRows} rows`,
    );
  }
});
