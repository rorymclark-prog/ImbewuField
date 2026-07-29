import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { CropPlanState, PlanBed, Planting } from '../lib/crop-plan.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { FacilitatorDesignState } from '../lib/facilitator-design.ts';
import {
  TASK_BOARD_CHANGED_EVENTS,
  buildCropBoardTasks,
  buildTaskIcs,
  loadCompletedTaskIds,
  loadCropBoardTasks,
  resolveTaskDate,
  saveCompletedTaskIds,
  setCompletedTaskState,
  taskBoardBeds,
  type BoardTask,
} from '../lib/task-board.ts';

class MemoryStorage {
  private rows = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota');
    this.rows.set(String(key), String(value));
  }
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
  return {
    id: 'planting-1',
    bedId: 'bed-1',
    cropKey: 'lettuce',
    sowMonth: 1,
    ...overrides,
  };
}

function canvas(overrides: Partial<DesignCanvasState> = {}): DesignCanvasState {
  return {
    siteId: 'site:-29.00000,31.00000',
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: [{ id: 'bed-1', defId: 'veg_bed', x: 0.5, y: 0.5, label: 'Kitchen bed' }],
    zones: [],
    lines: [],
    step: 'review',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
    ...overrides,
  };
}

function facilitator(items: FacilitatorDesignState['items']): FacilitatorDesignState {
  return {
    version: 1,
    items,
    lines: [],
    sectors: [],
    pxPerM: 5,
    activeLayer: 'review',
    hiddenLayers: [],
    savedAt: 1,
  };
}

test('planned January work viewed in December stays one coherent forward group', () => {
  const tasks = buildCropBoardTasks([planting()], beds, 12, new Set());
  assert.ok(tasks.length > 1);
  assert.equal(tasks[0].id, 'planting-1:prep');
  assert.equal(tasks[0].monthsAway, 0);
  assert.equal(tasks[0].dueMonth, 12);
  assert.ok(tasks.every((task) => Number.isSafeInteger(task.monthsAway) && task.monthsAway >= 0));
  assert.ok(tasks.every((task) => task.dueMonth >= 1 && task.dueMonth <= 12));
  assert.deepEqual(tasks, [...tasks].sort((a, b) =>
    a.monthsAway - b.monthsAway || a.dueMonth - b.dueMonth || a.id.localeCompare(b.id)));
});

test('prep for a planting sown this month is due now, not silently moved eleven months away', () => {
  const tasks = buildCropBoardTasks([planting({ sowMonth: 6 })], beds, 6, new Set());
  const prep = tasks.find((task) => task.id.endsWith(':prep'));
  assert.ok(prep);
  assert.equal(prep.monthsAway, 0);
  assert.equal(prep.dueMonth, 6);
  assert.match(prep.subtitle, /Due this month/);
});

test('already-growing work that genuinely passed drops off instead of returning next year', () => {
  const tasks = buildCropBoardTasks([
    planting({ sowMonth: 1, existing: true }),
  ], beds, 6, new Set());
  assert.deepEqual(tasks, []);
});

test('deleted beds, duplicate planting ids and invalid months never create ambiguous or NaN tasks', () => {
  const inputs: Planting[] = [
    planting({ id: 'with:colon', sowMonth: 2 }),
    planting({ id: 'with:colon', sowMonth: 3 }),
    planting({ id: 'wrong-bed', bedId: 'deleted-bed' }),
    planting({ id: 'zero-month', sowMonth: 0 }),
    planting({ id: 'nan-month', sowMonth: Number.NaN }),
  ];
  const tasks = buildCropBoardTasks(inputs, beds, 2, new Set(['with:colon:sow']));

  assert.ok(tasks.length > 0);
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
  assert.ok(tasks.every((task) => task.id.startsWith('with:colon:')));
  assert.equal(tasks.find((task) => task.id === 'with:colon:sow')?.completed, true);
  assert.doesNotMatch(JSON.stringify(tasks), /NaN|Infinity|Unknown bed/);

  for (const invalidMonth of [0, 13, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(buildCropBoardTasks([planting()], beds, invalidMonth, new Set()), []);
  }
});

test('task-board bed source matches the crop planner: Studio, then legacy, then virtual', () => {
  const legacy = facilitator([{
    id: 'legacy-bed',
    type: 'bed',
    x: 0,
    y: 0,
    wM: 2,
    hM: 3,
    rotation: 0,
  }]);
  assert.deepEqual(taskBoardBeds(canvas(), legacy).map((bed) => bed.id), ['bed-1']);
  assert.deepEqual(taskBoardBeds(null, legacy).map((bed) => bed.id), ['legacy-bed']);
  assert.deepEqual(taskBoardBeds(null, null).map((bed) => bed.id), ['virtual-bed-1']);

  const invalidLegacy = facilitator([{
    id: 'bad-bed',
    type: 'bed',
    x: 0,
    y: 0,
    wM: Number.NaN,
    hM: -1,
    rotation: 0,
  }]);
  const fallback = taskBoardBeds(null, invalidLegacy);
  assert.ok(fallback.every((bed) => Number.isFinite(bed.areaM2) && bed.areaM2 > 0));
});

test('the home loader finds crop tasks on the main site Design Studio canvas', () => {
  const { local } = installBrowser();
  const siteId = 'site:-29.00000,31.00000';
  local.setItem('permamap_saved_places', JSON.stringify([{
    id: 'farm',
    name: 'Farm',
    lat: -29,
    lon: 31,
    biome: '',
    rainfall: 0,
    elevation: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
  }]));
  local.setItem(`imbewu_design_canvas_${siteId}`, JSON.stringify(canvas()));
  const cropPlan: CropPlanState = {
    version: 1,
    plantings: [planting({ sowMonth: new Date().getMonth() + 1 })],
    updatedAt: 1,
  };
  local.setItem('imbewu_crop_plan_v1', JSON.stringify(cropPlan));

  const tasks = loadCropBoardTasks(new Set());

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.subtitle.startsWith('Kitchen bed ·')));
});

test('home refreshes the board for every source that can change its task truth', () => {
  const source = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  for (const event of TASK_BOARD_CHANGED_EVENTS) {
    assert.ok(event.trim());
  }
  assert.match(source, /TASK_BOARD_CHANGED_EVENTS\.forEach\(\(event\) => window\.addEventListener\(event, refresh\)\)/);
  assert.match(source, /TASK_BOARD_CHANGED_EVENTS\.forEach\(\(event\) => window\.removeEventListener\(event, refresh\)\)/);
});

test('calendar dates stay forward-looking across year boundaries and multi-year offsets', () => {
  const now = new Date('2026-12-15T12:00:00.000Z');
  const base: BoardTask = {
    id: 'crop:harvest',
    kind: 'crop',
    title: 'Harvest lettuce',
    subtitle: 'Kitchen bed · Due next month',
    icon: '🥗',
    dueMonth: 1,
    monthsAway: 1,
    completed: false,
  };
  const nextJanuary = resolveTaskDate(base, now);
  assert.equal(nextJanuary.getFullYear(), 2027);
  assert.equal(nextJanuary.getMonth(), 0);
  assert.equal(nextJanuary.getDate(), 1);

  const followingJanuary = resolveTaskDate({ ...base, monthsAway: 13 }, now);
  assert.equal(followingJanuary.getFullYear(), 2028);
  assert.equal(followingJanuary.getMonth(), 0);
});

test('calendar text is escaped and an all-day DTEND is exclusive', () => {
  const now = new Date('2026-12-15T12:00:00.000Z');
  const task: BoardTask = {
    id: 'crop;one',
    kind: 'crop',
    title: 'Harvest beans, peas\\greens\nnow',
    subtitle: 'Bed; south, row\\2',
    icon: '🌱',
    dueMonth: 1,
    monthsAway: 1,
    completed: false,
  };
  const ics = buildTaskIcs(task, now);

  assert.match(ics, /UID:crop\\;one@imbewufield\.app/);
  assert.match(ics, /SUMMARY:Harvest beans\\, peas\\\\greens\\nnow/);
  assert.match(ics, /DESCRIPTION:ImbewuField crop plan — Bed\\; south\\, row\\\\2/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270101/);
  assert.match(ics, /DTEND;VALUE=DATE:20270102/);
  assert.match(ics, /DTSTAMP:20261215T120000Z/);
  assert.equal(ics.endsWith('\r\n'), true);
});

test('invalid calendar arithmetic degrades to a finite current-month event', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');
  const task: BoardTask = {
    id: 'bad',
    kind: 'crop',
    title: 'Check crop',
    subtitle: 'Bed',
    icon: '🌱',
    dueMonth: Number.POSITIVE_INFINITY,
    monthsAway: Number.NaN,
    completed: false,
  };
  const date = resolveTaskDate(task, now);
  assert.equal(Number.isFinite(date.getTime()), true);
  assert.equal(date.getMonth(), now.getMonth());
  assert.doesNotMatch(buildTaskIcs(task, now), /NaN|Infinity/);
});

test('completed task storage deduplicates and rejects malformed ids', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_completed_tasks_v1', JSON.stringify([' a ', 'a', '', 4, null]));
  assert.deepEqual([...loadCompletedTaskIds()], ['a']);

  assert.equal(saveCompletedTaskIds(new Set(['a', '', '  ', 'b'])), true);
  assert.deepEqual([...loadCompletedTaskIds()], ['a', 'b']);
});

test('toggling one visible task preserves completions owned by hidden producers', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_completed_tasks_v1', JSON.stringify([
    'survey:site-one',
    'old-planting:harvest',
  ]));

  const completed = setCompletedTaskState('visible-planting:sow', true);
  assert.deepEqual([...completed], [
    'survey:site-one',
    'old-planting:harvest',
    'visible-planting:sow',
  ]);
  const unchecked = setCompletedTaskState('visible-planting:sow', false);
  assert.deepEqual([...unchecked], ['survey:site-one', 'old-planting:harvest']);
});

test('a failed completion write returns durable state so the board cannot show a false tick', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_completed_tasks_v1', JSON.stringify(['existing:task']));
  local.failWrites = true;

  assert.deepEqual([...setCompletedTaskState('new:task', true)], ['existing:task']);
  assert.equal(saveCompletedTaskIds(new Set(['replacement:task'])), false);
  assert.deepEqual([...loadCompletedTaskIds()], ['existing:task']);
});
