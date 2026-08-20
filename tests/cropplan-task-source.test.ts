import test from 'node:test';
import assert from 'node:assert/strict';

import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import { taskMonthsFromNow, tasksForPlan, type PlanBed } from '../lib/crop-plan.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import { loadCropBoardYear } from '../lib/task-board.ts';

// TASK PLANNER TRUTH — app/cropplan/page.tsx used to run its own invented
// day-of-week rota (Mon water beds A&B, Tue mulch, Wed compost tea, Thu weed
// everything, Sat photo) that derived from nothing on the farm. That is the
// same class of invented dated job the crop-plan truth work has been removing
// across these screens (docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md covers the
// class, not this screen specifically).
//
// This file guards BOTH directions, because the first replacement pipeline
// shipped with only one of them and lost most of the plan:
//
//   1. NOTHING INVENTED — every task the planner returns traces to a real
//      planting task built by tasksForPlan.
//   2. NOTHING DROPPED — every task tasksForPlan emits appears in the planner,
//      in exactly one month, the month the plan actually puts it in.
//
// Guard 2 is the one that matters most. The predecessor of loadCropBoardYear
// rebuilt the task list with the BROWSED month as "now" and kept only
// monthsAway === 0. A planned crop's sowing always resolves to its NEXT
// occurrence (offset 0-11), so every harvest, transplant and cover
// termination became unreachable in all twelve months, and a clamped prep task
// appeared in two consecutive months. On the two-planting farm below the plan
// holds 12 real tasks and the planner showed 3 — while nine months printed
// "nothing due" over real harvests.

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  get length() { return this.rows.size; }
}

function installBrowser() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const target = new EventTarget() as EventTarget & {
    localStorage: MemoryStorage;
    sessionStorage: MemoryStorage;
  };
  target.localStorage = local;
  target.sessionStorage = session;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  return { local, target };
}

const beds: PlanBed[] = [{ id: 'bed-1', label: 'Bed 1', areaM2: 10, minDimM: 1 }];

function planting(overrides: Partial<Planting> = {}): Planting {
  return { id: 'planting-1', bedId: 'bed-1', cropKey: 'lettuce', sowMonth: 3, ...overrides };
}

function canvas(): DesignCanvasState {
  return {
    siteId: 'site:-29.00000,31.00000',
    frame: { centerLng: 31, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    items: [{ id: 'bed-1', defId: 'veg_bed', x: 0.5, y: 0.5, label: 'Kitchen bed' }],
    zones: [],
    lines: [],
    step: 'review',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
  };
}

function seedFarm(plantings: Planting[]) {
  const siteId = 'site:-29.00000,31.00000';
  const { local } = installBrowser();
  local.setItem('permamap_saved_places', JSON.stringify([{
    id: 'farm', name: 'Farm', lat: -29, lon: 31, biome: '', rainfall: 0, elevation: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
  }]));
  local.setItem(`imbewu_design_canvas_${siteId}`, JSON.stringify(canvas()));
  const cropPlan: CropPlanState = { version: 1, plantings, updatedAt: 1 };
  local.setItem('imbewu_crop_plan_v1', JSON.stringify(cropPlan));
}

/** The farm from the verifier's reproduction: a planned tomato crop sown in
 *  September and a planned Swiss chard sown in March. tasksForPlan emits 12
 *  real tasks for it — prep, sow, a transplant and seven harvest pickings. */
const SEEDED_FARM: Planting[] = [
  { id: 'p1', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 9 },
  { id: 'p2', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 3 },
];

/** Same rule as lib/crop-plan.ts's own (unexported) wrapMonth. */
const wrapMonth = (m: number) => ((m - 1) % 12 + 12) % 12 + 1;
const clockAt = (month: number) => new Date(2026, month - 1, 15);
/** What the screen renders for one browsed month. */
const tasksIn = (month: number, now: Date) =>
  loadCropBoardYear(new Set(), now).byMonth.get(month) ?? [];

// ---------------------------------------------------------------------------
// Direction 1 — nothing invented
// ---------------------------------------------------------------------------

test('a farmer with no real crop plan gets zero tasks, in every month, forever', () => {
  seedFarm([]);
  for (let month = 1; month <= 12; month++) {
    assert.deepEqual(tasksIn(month, clockAt(8)), []);
  }
  assert.equal(loadCropBoardYear(new Set()).total, 0);
  assert.equal(loadCropBoardYear(new Set()).savedPlantings, 0);
});

test('every task the planner ever returns traces to a real planting task', () => {
  seedFarm([planting({ sowMonth: 3 })]);
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    const realIds = new Set(tasksForPlan([planting({ sowMonth: 3 })], beds, nowMonth).map((t) => t.id));
    assert.ok(realIds.size > 0, 'fixture produced no real tasks to compare against');
    for (let month = 1; month <= 12; month++) {
      for (const task of tasksIn(month, clockAt(nowMonth))) {
        assert.ok(realIds.has(task.id), `task "${task.id}" (month ${month}, now ${nowMonth}) is not traceable to any real planting task`);
        assert.equal(task.dueMonth, month, `task "${task.id}" returned for month ${month} but claims dueMonth ${task.dueMonth}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Direction 2 — nothing dropped (the guard the first round was missing)
// ---------------------------------------------------------------------------

/** Full both-ways check of the plan against the planner, for one "now". */
function assertMonthViewMatchesPlan(plantings: Planting[], nowMonth: number) {
  const real = tasksForPlan(plantings, beds, nowMonth);
  assert.ok(real.length > 0, `fixture produced no real tasks at now=${nowMonth}`);

  const year = loadCropBoardYear(new Set(), clockAt(nowMonth));
  const placed = new Map<string, number[]>();
  for (let month = 1; month <= 12; month++) {
    for (const task of year.byMonth.get(month) ?? []) {
      placed.set(task.id, [...(placed.get(task.id) ?? []), month]);
    }
  }

  for (const t of real) {
    const expected = wrapMonth(nowMonth + taskMonthsFromNow(t, nowMonth));
    const months = placed.get(t.id);
    assert.ok(
      months,
      `now=${nowMonth}: the plan's "${t.id}" (${t.action}, due month ${expected}) appears in NO month of the planner`,
    );
    assert.deepEqual(
      months,
      [expected],
      `now=${nowMonth}: the plan's "${t.id}" (${t.action}) should appear once, in month ${expected}`,
    );
  }

  assert.equal(
    year.total, real.length,
    `now=${nowMonth}: planner shows ${year.total} jobs across the year but the plan holds ${real.length}`,
  );
}

test('every job the seeded farm\'s plan holds shows up in the month it is due, from every starting month', () => {
  seedFarm(SEEDED_FARM);
  assert.equal(
    tasksForPlan(SEEDED_FARM, beds, 8).length, 12,
    'fixture drifted: the seeded farm is meant to hold 12 real tasks',
  );
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    assertMonthViewMatchesPlan(SEEDED_FARM, nowMonth);
  }
});

test('harvests, transplants and cover terminations all reach the month view', () => {
  const farm: Planting[] = [
    ...SEEDED_FARM,
    { id: 'p3', bedId: 'bed-1', cropKey: 'oats', sowMonth: 4 },      // cover crop → terminate-cover
    { id: 'p4', bedId: 'bed-1', cropKey: 'kale', sowMonth: 2, existing: true }, // already growing
  ];
  seedFarm(farm);
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    assertMonthViewMatchesPlan(farm, nowMonth);
  }
  // Every icon row app/cropplan/page.tsx's ACTION_META can render for a real
  // plan must actually be reachable — the old pipeline let only prep and sow
  // through, leaving most of that table dead UI.
  const actions = new Set(
    [...loadCropBoardYear(new Set(), clockAt(8)).byMonth.values()]
      .flat().map((t) => t.action),
  );
  for (const action of ['prep', 'sow', 'transplant', 'harvest', 'terminate-cover']) {
    assert.ok(actions.has(action as never), `no "${action}" task reaches the month view for the seeded farm`);
  }
});

// ---------------------------------------------------------------------------
// Empty-state honesty
// ---------------------------------------------------------------------------

test('a plan whose plantings sit on a deleted bed reports itself as saved-but-empty', () => {
  // The page needs these two numbers to tell "no plan yet" apart from "a plan
  // that produces nothing" — without that split the farmer gets twelve silent
  // empty months and no explanation.
  seedFarm([{ id: 'ghost', bedId: 'bed-that-was-deleted', cropKey: 'tomatoes', sowMonth: 9 }]);
  const year = loadCropBoardYear(new Set(), clockAt(8));
  assert.equal(year.savedPlantings, 1, 'the stored plan\'s own planting count must not be filtered away');
  assert.equal(year.total, 0);
});

test('the month map holds exactly the twelve calendar months, no more and no fewer', () => {
  // Every month must have a bucket so an empty month is never confused with a
  // missing one, and nothing may be filed outside 1-12 where no view can reach it.
  seedFarm(SEEDED_FARM);
  const year = loadCropBoardYear(new Set(), clockAt(8));
  assert.deepEqual([...year.byMonth.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (let month = 1; month <= 12; month++) {
    assert.ok(Array.isArray(year.byMonth.get(month)), `month ${month} has no bucket`);
  }
});

test('a broken clock still produces a usable year rather than NaN months', () => {
  seedFarm(SEEDED_FARM);
  const year = loadCropBoardYear(new Set(), new Date(Number.NaN));
  assert.equal(year.total, tasksForPlan(SEEDED_FARM, beds, new Date().getMonth() + 1).length);
});
