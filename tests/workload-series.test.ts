// The printed plan's workload chart counted mulching as a separate visit to the bed, and page 1
// turned the resulting peak into a staffing instruction.
//
// `mulch` is emitted at the SAME month as its own planting's sow or transplant (lib/crop-plan.ts),
// because watering-in and mulching happen while you are standing there with the seedling. The
// field sheet has always known that — `case 'mulch':` folds it, under a comment that says in as
// many words: "'Sow X' followed by 'Water in & mulch X' is one action at the bed, and printing it
// as two lines doubled the apparent workload of every sowing month."
//
// buildWorkloadSeries did not know it. It counted every task, so every sowing month came out with
// twice the jobs it had — measured at up to +50% on a four-planting plan — and page 1 read the
// peak off that curve to print "carry the heaviest work load" and "assign people and weeks".
// Two authorities for one question, which is the bug AGENTS.md §6 names, and the more expensive
// half is that a funder hires against the answer.
//
// These tests hold the two readers to the same rule. The first would have failed on the old code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasksForPlan, type Planting, type PlanBed } from '@/lib/crop-plan';
import { buildWorkloadSeries, FOLDED_ACTIONS } from '@/lib/crop-export-benchmark';

const BEDS: PlanBed[] = [
  { id: 'b1', label: 'Bed 1', areaM2: 10 },
  { id: 'b2', label: 'Bed 2', areaM2: 10 },
  { id: 'b3', label: 'Bed 3', areaM2: 10 },
];

// Deliberately mixed: lettuce and carrot are direct-sown, cabbage is raised and transplanted, so
// the fold has to work on both the sow month and the transplant month.
const PLANTINGS = [
  { id: 'p1', cropKey: 'lettuce', bedId: 'b1', sowMonth: 2 },
  { id: 'p2', cropKey: 'swiss-chard', bedId: 'b2', sowMonth: 3 },
  { id: 'p3', cropKey: 'cabbage', bedId: 'b3', sowMonth: 4 },
  { id: 'p4', cropKey: 'carrot', bedId: 'b1', sowMonth: 8 },
] as Planting[];

test('mulching is not counted as its own visit to the bed', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const mulchTasks = tasks.filter((t) => t.action === 'mulch');
  assert.ok(mulchTasks.length > 0, 'this plan must actually produce mulch tasks or it proves nothing');

  const charted = buildWorkloadSeries(tasks, 1);
  const withoutMulchTasks = buildWorkloadSeries(tasks.filter((t) => t.action !== 'mulch'), 1);

  assert.deepEqual(
    charted,
    withoutMulchTasks,
    'the workload curve changed when mulch tasks were removed, so it was counting them',
  );
});

test('every mulch task shares a month with its own sow or transplant', () => {
  // The premise the fold rests on. If mulching ever moved to its own month it would become a real
  // separate visit, and folding it would then be the bug.
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  for (const mulch of tasks.filter((t) => t.action === 'mulch')) {
    const planted = tasks.filter(
      (t) => (t.action === 'sow' || t.action === 'transplant')
        && t.cropKey === mulch.cropKey
        && t.bedLabel === mulch.bedLabel,
    );
    assert.ok(
      planted.some((t) => t.month === mulch.month),
      `mulch for ${mulch.cropName} on ${mulch.bedLabel} lands in month ${mulch.month} with no sow or transplant there`,
    );
  }
});

test('weeding is still counted — it is a real separate visit', () => {
  // The field sheet gives weed-early and weed-mid their own Maintenance row, so they are jobs.
  // Folding them would understate the workload, which is the opposite failure and just as wrong.
  assert.equal(FOLDED_ACTIONS.has('weed-early'), false);
  assert.equal(FOLDED_ACTIONS.has('weed-mid'), false);
  assert.equal(FOLDED_ACTIONS.has('harvest'), false);
  assert.equal(FOLDED_ACTIONS.has('sow'), false);
  assert.equal(FOLDED_ACTIONS.has('prep'), false);
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
