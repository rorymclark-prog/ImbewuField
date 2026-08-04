// The questionnaire asked farmers to type a roof area the app had already measured, because its
// auto-fill could only see main-map shapes. These tests pin the Studio bridge (lib/studio-traced-
// areas.ts): the number it produces, the precedence against the legacy total, and — most
// importantly — that it agrees with the ring the sheets actually render.
import test from 'node:test';
import assert from 'node:assert/strict';

import { studioBoundaryMetrics, studioRoofAreaM2, studioRoofAreasM2, surveyRoofAreaM2 } from '../lib/studio-traced-areas.ts';
import { resolveBaseLayers } from '../lib/base-layers.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

// 100 px × 100 px frame at 1 m/px → a 100 m × 100 m frame, so a 0.1 × 0.1 ring is exactly 10 m ×
// 10 m = 100 m². Every expected number below is checkable by eye.
const state = (partial: Partial<DesignCanvasState>): DesignCanvasState => ({
  siteId: 'site',
  frame: { imgW: 100, imgH: 100, mPerPx: 1 } as DesignCanvasState['frame'],
  items: [],
  zones: [],
  lines: [],
  step: 'base' as DesignCanvasState['step'],
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...partial,
});

const ring = (x0: number, y0: number, size: number): Array<[number, number]> => ([
  [x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size],
]);

const house = (id: string, points: Array<[number, number]>) => ({ id, zone: 0, feature: 'house', points });

test('a traced house ring becomes its plan area in true square metres', () => {
  const s = state({ zones: [house('h', ring(0.1, 0.1, 0.1))] as DesignCanvasState['zones'] });
  assert.equal(studioRoofAreaM2(s), 100);
});

test('the farmer’s own scale correction outranks the projection, here as on the sheets', () => {
  const s = state({
    zones: [house('h', ring(0.1, 0.1, 0.1))] as DesignCanvasState['zones'],
    scaleFactor: 2,
  });
  // Both axes scale, so the area scales by the square.
  assert.equal(studioRoofAreaM2(s), 400);
});

test('the roof area is measured on the SAME ring the renderers resolve as the house', () => {
  const small = ring(0.05, 0.05, 0.05);
  const large = ring(0.5, 0.5, 0.2);
  const s = state({
    zones: [house('small', small), house('large', large)] as DesignCanvasState['zones'],
  });
  const resolved = resolveBaseLayers(s, { boundary: [], house: [], driveway: [] });
  assert.equal(resolved.source.house, 'studio');
  assert.deepEqual(resolved.house, large, 'base-layers picks the largest ring');
  // 0.2 × 0.2 of a 100 m frame = 20 m × 20 m. If this ever reports the small ring's 25 m² the
  // questionnaire and the Water sheet have started disagreeing about the same roof.
  assert.equal(studioRoofAreaM2(s), 400);
});

test('a degenerate or absent ring measures nothing rather than guessing', () => {
  assert.equal(studioRoofAreaM2(state({})), 0);
  assert.equal(studioRoofAreaM2(null), 0);
  assert.equal(
    studioRoofAreaM2(state({ zones: [house('h', [[0.1, 0.1], [0.2, 0.1]] as Array<[number, number]>)] as DesignCanvasState['zones'] })),
    0,
    'two points are not a roof',
  );
});

test('a boundary ring is not a roof', () => {
  const s = state({
    zones: [{ id: 'b', zone: 0, feature: 'boundary', points: ring(0, 0, 0.9) }] as DesignCanvasState['zones'],
  });
  assert.equal(studioRoofAreaM2(s), 0);
});

// ── Two roofs: the store room lands in "Secondary roofs" ─────────────────────

test('the largest building is the main roof; every other building sums into secondary', () => {
  // Ubhejane's real shape: a main building and a smaller store room.
  const s = state({
    zones: [
      house('main', ring(0.1, 0.1, 0.1)),      // 100 m²
      house('store', ring(0.5, 0.5, 0.06)),    // 36 m²
      house('shed', ring(0.7, 0.2, 0.04)),     // 16 m²
    ] as DesignCanvasState['zones'],
  });
  const areas = studioRoofAreasM2(s);
  assert.equal(areas.mainM2, 100);
  assert.equal(Math.round(areas.secondaryM2), 52, 'store room + shed, never the main building twice');
});

test('one building means no secondary figure — the optional field stays empty', () => {
  const s = state({ zones: [house('main', ring(0.1, 0.1, 0.1))] as DesignCanvasState['zones'] });
  assert.equal(studioRoofAreasM2(s).secondaryM2, 0);
});

// ── Boundary metrics: what the checklist and the land card read ──────────────

test('a Studio boundary measures area, perimeter and vertex count', () => {
  const s = state({
    zones: [{ id: 'b', zone: 0, feature: 'boundary', points: ring(0.1, 0.1, 0.5) }] as DesignCanvasState['zones'],
  });
  const m = studioBoundaryMetrics(s);
  assert.ok(m);
  assert.equal(m.areaM2, 2500, '50 m × 50 m');
  assert.equal(Math.round(m.perimeterM), 200);
  assert.equal(m.vertexCount, 4, 'what the "Boundary traced" checklist scores');
});

test('no boundary ring → null, so map-shapes answers are never overridden by nothing', () => {
  assert.equal(studioBoundaryMetrics(state({})), null);
  assert.equal(studioBoundaryMetrics(null), null);
  const degenerate = state({
    zones: [{ id: 'b', zone: 0, feature: 'boundary', points: [[0.1, 0.1], [0.2, 0.1]] }] as DesignCanvasState['zones'],
  });
  assert.equal(studioBoundaryMetrics(degenerate), null);
});

// ── Precedence against the legacy main-map total ─────────────────────────────

test('a Studio roof wins over the legacy total; a map-only farmer is left exactly as they were', () => {
  const withHouse = state({ zones: [house('h', ring(0.1, 0.1, 0.1))] as DesignCanvasState['zones'] });
  assert.equal(surveyRoofAreaM2(withHouse, 85), 100, 'Studio ring wins, matching resolveBaseLayers');
  assert.equal(surveyRoofAreaM2(state({}), 85), 85, 'no Studio ring — the legacy figure survives untouched');
  assert.equal(surveyRoofAreaM2(null, 85), 85);
});

test('nothing traced anywhere leaves the field empty rather than showing a zero', () => {
  assert.equal(surveyRoofAreaM2(state({}), 0), 0);
  // A negative or NaN legacy total must not reach the questionnaire as a roof area.
  assert.equal(surveyRoofAreaM2(state({}), Number.NaN), 0);
  assert.equal(surveyRoofAreaM2(state({}), -20), 0);
});
