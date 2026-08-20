import test from 'node:test';
import assert from 'node:assert/strict';

import type { CropPlanState, Planting } from '../lib/crop-plan.ts';
import { tasksForPlan, type PlanBed } from '../lib/crop-plan.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import { loadCropBoardTasksForMonth } from '../lib/task-board.ts';

// TASK PLANNER TRUTH — app/cropplan/page.tsx used to run its own invented
// day-of-week rota (Mon water beds A&B, Tue mulch, Wed compost tea, Thu weed
// everything, Sat photo) that derived from nothing on the farm — exactly the
// class of fabricated dated job docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md
// records as already removed from the real planner. This file guards that
// the replacement (loadCropBoardTasksForMonth, sourced from the real crop
// plan) can never emit a job that doesn't trace back to a real planting task
// — the fiction cannot return.

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

test('a farmer with no real crop plan gets zero tasks, in every month, forever', () => {
  seedFarm([]);
  for (let month = 1; month <= 12; month++) {
    assert.deepEqual(loadCropBoardTasksForMonth(month, new Set()), []);
  }
});

test('every task loadCropBoardTasksForMonth ever returns traces to a real planting task', () => {
  seedFarm([planting({ sowMonth: 3 })]);
  const realIds = new Set(tasksForPlan([planting({ sowMonth: 3 })], beds, 1).map((t) => t.id));
  assert.ok(realIds.size > 0, 'fixture produced no real tasks to compare against');

  for (let month = 1; month <= 12; month++) {
    const tasks = loadCropBoardTasksForMonth(month, new Set());
    for (const task of tasks) {
      assert.ok(realIds.has(task.id), `task "${task.id}" (month ${month}) is not traceable to any real planting task`);
      assert.equal(task.dueMonth, month, `task "${task.id}" returned for month ${month} but claims dueMonth ${task.dueMonth}`);
    }
  }
});

test('loadCropBoardTasksForMonth rejects an out-of-range month rather than guessing', () => {
  seedFarm([planting()]);
  assert.deepEqual(loadCropBoardTasksForMonth(0, new Set()), []);
  assert.deepEqual(loadCropBoardTasksForMonth(13, new Set()), []);
  assert.deepEqual(loadCropBoardTasksForMonth(Number.NaN, new Set()), []);
});
