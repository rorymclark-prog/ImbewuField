import test from 'node:test';
import assert from 'node:assert/strict';

import { DESIGN_STEP_LESSONS } from '../lib/design-lessons.ts';
import {
  ELEMENT_CATALOG,
  GROUND_FEATURES,
  ZONE_KEY,
} from '../lib/design-elements.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { getLesson, type MicroLesson } from '../lib/lesson-registry.ts';

function assertComplete(lesson: MicroLesson, expectedId: string) {
  assert.equal(lesson.id, expectedId);
  assert.ok(lesson.title.trim(), `${expectedId} title`);
  assert.ok(lesson.body.trim(), `${expectedId} body`);
  assert.ok(lesson.principle.trim(), `${expectedId} principle`);
  assert.ok(lesson.tip.trim(), `${expectedId} tip`);
}

test('every Design Studio step resolves to complete reviewed teaching copy', () => {
  for (const step of Object.keys(DESIGN_STEP_LESSONS)) {
    const id = `step:${step}`;
    const lesson = getLesson(id);
    assertComplete(lesson, id);
    assert.notEqual(lesson.draft, true);
  }
});

test('every catalog element resolves to a complete lesson under its stable id', () => {
  for (const def of ELEMENT_CATALOG) {
    const id = `element:${def.id}`;
    const lesson = getLesson(id);
    assertComplete(lesson, id);
    assert.equal(lesson.title, def.name);
  }
});

test('every ground feature, effort zone and drawable line has a usable lesson', () => {
  for (const feature of Object.keys(GROUND_FEATURES)) {
    const id = `feature:${feature}`;
    assertComplete(getLesson(id), id);
  }
  for (const zone of ZONE_KEY) {
    const id = `zone:${zone.z}`;
    const lesson = getLesson(id);
    assertComplete(lesson, id);
    assert.match(lesson.title, new RegExp(`^Zone ${zone.z}\\b`));
  }
  for (const kind of ['greywater', 'swale', 'drip', 'pipe', 'fence', 'path', 'windbreak']) {
    const id = `line:${kind}`;
    assertComplete(getLesson(id), id);
  }
});

test('every linked course module exists in the course catalogue', () => {
  const moduleIds = new Set(COURSE_MODULES.map((module) => module.id));
  const ids = [
    ...Object.keys(DESIGN_STEP_LESSONS).map((step) => `step:${step}`),
    ...ELEMENT_CATALOG.map((def) => `element:${def.id}`),
    ...Object.keys(GROUND_FEATURES).map((feature) => `feature:${feature}`),
    ...ZONE_KEY.map((zone) => `zone:${zone.z}`),
    ...['greywater', 'swale', 'drip', 'pipe', 'fence', 'path', 'windbreak']
      .map((kind) => `line:${kind}`),
  ];
  for (const id of ids) {
    const moduleId = getLesson(id).courseModuleId;
    if (moduleId) assert.ok(moduleIds.has(moduleId), `${id} links ${moduleId}`);
  }
});

test('malformed zone ids stay generic instead of borrowing another zone’s advice', () => {
  for (const key of ['', ' ', '01', '+1', '1.5', '-1', '6', 'Infinity', 'NaN']) {
    const id = `zone:${key}`;
    const lesson = getLesson(id);
    assertComplete(lesson, id);
    assert.equal(lesson.title, 'About this', id);
  }
});

test('prototype names cannot escape a namespace or crash the total lookup', () => {
  for (const namespace of ['step', 'element', 'feature', 'line']) {
    for (const key of ['toString', '__proto__', 'constructor', 'hasOwnProperty']) {
      const id = `${namespace}:${key}`;
      const lesson = getLesson(id);
      assertComplete(lesson, id);
      assert.equal(lesson.title, 'About this', id);
    }
  }
});

test('unknown and invalid runtime ids always return safe complete generic copy', () => {
  for (const raw of ['unknown:anything', '', null, undefined, 42]) {
    const lesson = getLesson(raw as unknown as string);
    assertComplete(lesson, typeof raw === 'string' ? raw : '');
    assert.equal(lesson.title, 'About this');
    assert.equal(lesson.draft, true);
  }
});

test('a caller cannot mutate shared override data through a returned lesson', () => {
  const first = getLesson('map:overview');
  const originalTitle = first.title;
  first.title = 'Changed by caller';
  assert.equal(getLesson('map:overview').title, originalTitle);
});
