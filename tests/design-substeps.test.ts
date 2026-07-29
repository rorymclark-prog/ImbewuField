import test from 'node:test';
import assert from 'node:assert/strict';

import type {
  DesignCanvasState,
  GroundFeatureKind,
  LineShape,
  WizardStep,
} from '../lib/design-canvas.ts';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import {
  STEP_SUBSTEPS,
  subStepsForStep,
  type SubStep,
  type SubStepArm,
  type SubStepCtx,
} from '../lib/design-substeps.ts';

const ctx: SubStepCtx = { hasBoundary: false, hasHouse: false };
const polygon: Array<[number, number]> = [[0.1, 0.1], [0.4, 0.1], [0.2, 0.4]];

function canvas(): DesignCanvasState {
  return {
    siteId: 'site:test',
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: [],
    zones: [],
    lines: [],
    step: 'base',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
  };
}

function stateWithArm(arm: Exclude<SubStepArm, null>): DesignCanvasState {
  const state = canvas();
  if (arm.kind === 'place') {
    state.items.push({ id: 'item', defId: arm.defId, x: 0.5, y: 0.5 });
  } else if (arm.kind === 'line') {
    state.lines.push({
      id: 'line',
      kind: arm.lineKind,
      points: [[0.1, 0.1], [0.5, 0.5]],
    });
  } else if (arm.kind === 'zone') {
    state.zones.push({ id: 'zone', zone: arm.zone, points: polygon });
  } else {
    state.zones.push({
      id: 'area',
      zone: 0,
      feature: arm.feature,
      points: polygon,
    });
  }
  return state;
}

function stepById(id: string): SubStep {
  for (const steps of Object.values(STEP_SUBSTEPS)) {
    const found = steps.find((step) => step.id === id);
    if (found) return found;
  }
  throw new Error(`Missing substep ${id}`);
}

test('the guide covers every editable step and never appears on review or output', () => {
  const editable: WizardStep[] = ['base', 'sector', 'water', 'zones', 'planting', 'structures'];
  for (const step of editable) assert.ok(subStepsForStep(step).length > 0);
  assert.deepEqual(subStepsForStep('review'), []);
  assert.deepEqual(subStepsForStep('glossy'), []);
});

test('task ids are globally unique and every farmer-facing instruction is present', () => {
  const tasks = Object.values(STEP_SUBSTEPS).flat();
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
  for (const task of tasks) {
    assert.ok(task.title.trim());
    assert.ok(task.instruction.trim());
    assert.ok(task.where.trim());
  }
});

test('every place action arms a live catalog element', () => {
  const tasks = Object.values(STEP_SUBSTEPS).flat();
  for (const task of tasks) {
    if (task.arm?.kind === 'place') {
      assert.ok(ELEMENTS_BY_ID[task.arm.defId], `${task.id} arms ${task.arm.defId}`);
      assert.notEqual(ELEMENTS_BY_ID[task.arm.defId].deprecated, true);
    }
  }
});

test('doing the offered action completes every required drawable task', () => {
  const required = Object.values(STEP_SUBSTEPS)
    .flat()
    .filter((task) => !task.optional && task.arm !== null);
  for (const task of required) {
    assert.equal(task.done(stateWithArm(task.arm!), ctx), true, task.id);
  }
});

test('every live bed the catalog offers satisfies the vegetable-bed task', () => {
  const task = stepById('plant-beds');
  const bedIds = ELEMENT_CATALOG
    .filter((def) => !def.deprecated && (def.id.endsWith('_bed') || def.id === 'herb_spiral'))
    .map((def) => def.id);
  assert.ok(bedIds.length > 1);
  for (const defId of bedIds) {
    const state = canvas();
    state.items.push({ id: defId, defId, x: 0.5, y: 0.5 });
    assert.equal(task.done(state, ctx), true, defId);
  }
});

test('tree completion recognises current choices and retained legacy trees', () => {
  const task = stepById('plant-trees');
  const treeIds = ELEMENT_CATALOG
    .filter((def) =>
      (def.id.startsWith('tree_') && def.id !== 'tree_basin')
      || def.id === 'banana_clump'
      || def.id === 'banana_circle')
    .map((def) => def.id);
  for (const defId of treeIds) {
    const state = canvas();
    state.items.push({ id: defId, defId, x: 0.5, y: 0.5 });
    assert.equal(task.done(state, ctx), true, defId);
  }
});

test('all animal-category choices satisfy the optional animal-housing task', () => {
  const task = stepById('struct-animals');
  const animalIds = ELEMENT_CATALOG
    .filter((def) => def.category === 'animal')
    .map((def) => def.id);
  assert.ok(animalIds.length > 1);
  for (const defId of animalIds) {
    const state = canvas();
    state.items.push({ id: defId, defId, x: 0.5, y: 0.5 });
    assert.equal(task.done(state, ctx), true, defId);
  }
});

test('legacy string zone numbers remain recognised when the ring is real', () => {
  const state = canvas();
  state.zones.push({
    id: 'legacy-zone',
    zone: '1' as unknown as 1,
    points: polygon,
  });
  assert.equal(stepById('zone-1').done(state, ctx), true);
});

test('empty and non-finite persisted geometry cannot falsely tick a task', () => {
  const bad = canvas();
  bad.items.push({ id: 'tank', defId: 'jojo_2500', x: Number.NaN, y: 0.5 });
  bad.lines.push(
    { id: 'empty', kind: 'swale', points: [] },
    {
      id: 'bad-line',
      kind: 'drip',
      points: [[0, 0], [Infinity, 1]],
    },
  );
  bad.zones.push(
    { id: 'empty-zone', zone: 1, points: [] },
    {
      id: 'bad-house',
      zone: 0,
      feature: 'house',
      points: [[0, 0], [1, 0], [Number.NaN, 1]],
    },
  );

  assert.equal(stepById('water-tanks').done(bad, ctx), false);
  assert.equal(stepById('water-swales').done(bad, ctx), false);
  assert.equal(stepById('water-drip').done(bad, ctx), false);
  assert.equal(stepById('zone-1').done(bad, ctx), false);
  assert.equal(stepById('base-house').done(bad, ctx), false);
});

test('boundary and house context only completes on genuine boolean evidence', () => {
  const state = canvas();
  assert.equal(stepById('base-boundary').done(state, {
    ...ctx,
    hasBoundary: 1 as unknown as boolean,
  }), false);
  assert.equal(stepById('base-house').done(state, {
    ...ctx,
    hasHouse: 'yes' as unknown as boolean,
  }), false);
  assert.equal(stepById('base-boundary').done(state, { ...ctx, hasBoundary: true }), true);
  assert.equal(stepById('base-house').done(state, { ...ctx, hasHouse: true }), true);
});

test('known line and area arms create valid typed canvas records', () => {
  const lineKinds = new Set<LineShape['kind']>();
  const features = new Set<GroundFeatureKind>();
  for (const task of Object.values(STEP_SUBSTEPS).flat()) {
    if (task.arm?.kind === 'line') lineKinds.add(task.arm.lineKind);
    if (task.arm?.kind === 'area') features.add(task.arm.feature);
  }
  assert.ok(lineKinds.size > 0);
  assert.ok(features.size > 0);
});
