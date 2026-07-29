import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  canonicalCartographicWaterId,
  drawCartographicWaterSymbol,
  supportsCartographicWaterSymbol,
} from '@/lib/cartographic-water-symbols';
import {
  cartographicStructureKind,
  drawCartographicStructureSymbol,
  supportsCartographicStructureSymbol,
} from '@/lib/cartographic-structure-symbols';

test('real catalog water IDs resolve to illustrated symbols', () => {
  for (const id of [
    'jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel',
    'pond_small', 'dam', 'borehole', 'tap_point', 'water_trough', 'first_flush',
    'pump_filter', 'banana_circle', 'tree_basin', 'greywater_basin',
    'greywater_outlet', 'greywater_diverter', 'infiltration_basin', 'mulch_bank',
    'half_moon', 'berm', 'terrace', 'duck_pond', 'other_water',
  ]) {
    assert.equal(supportsCartographicWaterSymbol(id), true, id);
  }
  assert.equal(canonicalCartographicWaterId('mulch_bank'), 'vetiver-bank');
  assert.equal(canonicalCartographicWaterId('duck_pond'), 'small-pond');
  assert.equal(canonicalCartographicWaterId('other_water'), 'unknown-water');
  assert.equal(canonicalCartographicWaterId('  JOJO__5000  '), 'jojo-tank');
  assert.equal(canonicalCartographicWaterId('greywater---basin'), 'greywater-basin');
  assert.equal(supportsCartographicWaterSymbol('invented_water_feature'), false);
});

test('benchmark structure catalog IDs resolve to illustrated symbols', () => {
  for (const id of [
    'chicken_coop', 'chicken_tractor', 'compost_bay', 'nursery_table', 'beehive',
    'rabbit_hutch', 'shade_house', 'greenhouse_tunnel', 'shed', 'kraal',
    'worm_farm', 'market_stall', 'goat_pen', 'pig_pen', 'biodigester',
    'shade_sail', 'gate', 'bench', 'sign', 'solar_panel_ground', 'washline',
    'other_structure',
  ]) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} exists in the catalog`);
    assert.equal(supportsCartographicStructureSymbol(ELEMENTS_BY_ID[id]), true, id);
  }
  assert.equal(supportsCartographicStructureSymbol('unknown_structure'), false);
});

test('every infrastructure catalog element has a deterministic symbol path', () => {
  for (const def of Object.values(ELEMENTS_BY_ID)) {
    if (!['water', 'structure', 'animal', 'access'].includes(def.category)) continue;
    const supported = supportsCartographicWaterSymbol(def.id) || supportsCartographicStructureSymbol(def);
    assert.equal(supported, true, `${def.id} has no deterministic cartographic symbol`);
  }
});

test('ponds and livestock pens cannot collapse to the same generic mark', () => {
  assert.equal(canonicalCartographicWaterId('duck_pond'), 'small-pond');
  assert.equal(cartographicStructureKind(ELEMENTS_BY_ID.goat_pen), 'goat-pen');
  assert.equal(cartographicStructureKind(ELEMENTS_BY_ID.pig_pen), 'pig-pen');
  assert.notEqual(cartographicStructureKind(ELEMENTS_BY_ID.goat_pen), cartographicStructureKind(ELEMENTS_BY_ID.pig_pen));
});

test('distinct real-world systems never use the generic structure fallback', () => {
  for (const id of [
    'worm_farm', 'market_stall', 'biodigester', 'shade_sail', 'gate', 'bench',
    'sign', 'solar_panel_ground', 'washline',
  ]) {
    const kind = cartographicStructureKind(ELEMENTS_BY_ID[id]);
    assert.ok(kind && !kind.startsWith('generic-'), `${id} resolved to ${kind}`);
  }
});

test('persisted structure IDs are canonical despite harmless case and separator drift', () => {
  assert.equal(cartographicStructureKind('  CHICKEN---COOP  '), 'chicken-tractor');
  assert.equal(cartographicStructureKind('solar panel ground'), 'solar-panel');
  assert.equal(cartographicStructureKind('STRUCTURE'), 'generic-structure');
  assert.equal(cartographicStructureKind('ANIMAL'), 'generic-animal');
});

type RecordedCall = { name: string; args: unknown[] };

function recordingContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const gradient = (kind: string) => ({
    addColorStop: (...args: unknown[]) => calls.push({ name: `${kind}.addColorStop`, args }),
  });
  const target: Record<PropertyKey, unknown> = {};
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return (...args: unknown[]) => {
          calls.push({ name: String(property), args });
          return gradient(String(property));
        };
      }
      return (...args: unknown[]) => calls.push({ name: String(property), args });
    },
    set(object, property, value) {
      object[property] = value;
      const recorded = value && typeof value === 'object' && 'addColorStop' in value
        ? '[gradient]'
        : value;
      calls.push({ name: `set:${String(property)}`, args: [recorded] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function assertFiniteDrawing(calls: readonly RecordedCall[], label: string): void {
  for (const call of calls) {
    for (const arg of call.args.flat(Infinity)) {
      if (typeof arg === 'number') {
        assert.ok(Number.isFinite(arg), `${label} sent ${arg} to ${call.name}`);
      }
    }
  }
}

test('every supported water symbol draws finite geometry and restores canvas state', () => {
  const supportedIds = [
    'jojo-tank', 'rain-barrel', 'small-pond', 'dam', 'greywater-basin', 'tree-basin',
    'infiltration-basin', 'banana-circle', 'tap', 'borehole', 'trough', 'first-flush',
    'pump', 'filter', 'greywater-outlet', 'diverter', 'vetiver-bank', 'half-moon',
    'berm', 'terrace', 'unknown-water',
  ];

  for (const [index, id] of supportedIds.entries()) {
    assert.equal(supportsCartographicWaterSymbol(id), true, `${id} is not actually supported`);
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicWaterSymbol({
      ctx,
      id,
      width: index % 2 ? 86 : 42,
      height: index % 2 ? 42 : 86,
      outlineWidth: 2,
      seed: index,
    }), true, `${id} refused valid geometry`);
    assert.ok(calls.length > 5, `${id} claimed success without drawing a symbol`);
    const saves = calls.filter((call) => call.name === 'save').length;
    const restores = calls.filter((call) => call.name === 'restore').length;
    assert.ok(saves >= 1, `${id} did not protect caller canvas state`);
    assert.equal(restores, saves, `${id} leaked canvas state`);
    assertFiniteDrawing(calls, id);
  }
});

test('invalid frames are rejected before touching the canvas', () => {
  const cases: Array<Partial<{ width: number; height: number; outlineWidth: number }>> = [
    { width: 0 },
    { width: -1 },
    { width: Number.NaN },
    { width: Number.POSITIVE_INFINITY },
    { height: 0 },
    { height: -1 },
    { height: Number.NaN },
    { height: Number.POSITIVE_INFINITY },
    { outlineWidth: -1 },
    { outlineWidth: Number.NaN },
    { outlineWidth: Number.POSITIVE_INFINITY },
  ];

  for (const override of cases) {
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicWaterSymbol({
      ctx,
      id: 'jojo_5000',
      width: 50,
      height: 50,
      outlineWidth: 2,
      ...override,
    }), false);
    assert.deepEqual(calls, [], `invalid geometry ${JSON.stringify(override)} touched the canvas`);
  }
});

test('unknown IDs draw nothing and cannot disturb canvas state', () => {
  const { ctx, calls } = recordingContext();
  assert.equal(drawCartographicWaterSymbol({
    ctx,
    id: 'invented-water-machine',
    width: 50,
    height: 50,
    outlineWidth: 2,
  }), false);
  assert.deepEqual(calls, []);
});

test('seeded natural texture is reproducible while a different seed changes it', () => {
  const transcript = (seed: number) => {
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicWaterSymbol({
      ctx,
      id: 'pond_small',
      width: 90,
      height: 55,
      outlineWidth: 2,
      seed,
    }), true);
    return calls;
  };

  assert.deepEqual(transcript(17), transcript(17));
  assert.notDeepEqual(transcript(17), transcript(18));
  assert.deepEqual(transcript(Number.NaN), transcript(0), 'invalid seeds did not use the deterministic fallback');
});

test('every catalog water feature can execute its advertised symbol path', () => {
  for (const def of Object.values(ELEMENTS_BY_ID).filter((entry) => entry.category === 'water')) {
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicWaterSymbol({
      ctx,
      id: def.id,
      width: 64,
      height: 48,
      outlineWidth: 1.5,
      seed: 11,
    }), true, `${def.id} is advertised but not drawable`);
    assertFiniteDrawing(calls, def.id);
  }
});

test('every supported structure symbol executes finite geometry and restores canvas state', () => {
  const supported = [
    ...Object.values(ELEMENTS_BY_ID).filter((entry) => supportsCartographicStructureSymbol(entry)),
    'structure',
    'animal',
  ];

  for (const [index, element] of supported.entries()) {
    const label = typeof element === 'string' ? element : element.id;
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicStructureSymbol(
      ctx,
      element,
      index % 2 ? 90 : 44,
      index % 2 ? 44 : 90,
      2,
      { seed: index },
    ), true, `${label} refused valid geometry`);
    assert.ok(calls.length > 5, `${label} claimed success without drawing`);
    const saves = calls.filter((call) => call.name === 'save').length;
    const restores = calls.filter((call) => call.name === 'restore').length;
    assert.ok(saves >= 1, `${label} did not protect caller canvas state`);
    assert.equal(restores, saves, `${label} leaked canvas state`);
    assertFiniteDrawing(calls, label);
  }
});

test('invalid structure frames and unknown kinds are no-ops', () => {
  const invalidCases: Array<Partial<{ width: number; height: number; outlineWidth: number }>> = [
    { width: 0 },
    { width: -1 },
    { width: Number.NaN },
    { width: Number.POSITIVE_INFINITY },
    { height: 0 },
    { height: -1 },
    { height: Number.NaN },
    { height: Number.POSITIVE_INFINITY },
    { outlineWidth: -1 },
    { outlineWidth: Number.NaN },
    { outlineWidth: Number.POSITIVE_INFINITY },
  ];

  for (const override of invalidCases) {
    const { ctx, calls } = recordingContext();
    const values = { width: 50, height: 40, outlineWidth: 2, ...override };
    assert.equal(drawCartographicStructureSymbol(
      ctx,
      'chicken_coop',
      values.width,
      values.height,
      values.outlineWidth,
    ), false);
    assert.deepEqual(calls, [], `invalid structure frame ${JSON.stringify(override)} touched canvas`);
  }

  const { ctx, calls } = recordingContext();
  assert.equal(drawCartographicStructureSymbol(ctx, 'invented-building', 50, 40, 2), false);
  assert.deepEqual(calls, []);
});

test('structure texture seeds are deterministic and invalid seeds use the fallback', () => {
  const transcript = (seed: number) => {
    const { ctx, calls } = recordingContext();
    assert.equal(drawCartographicStructureSymbol(
      ctx,
      'chicken_tractor',
      80,
      55,
      2,
      { seed },
    ), true);
    return calls;
  };

  assert.deepEqual(transcript(23), transcript(23));
  assert.notDeepEqual(transcript(23), transcript(24));
  assert.deepEqual(transcript(Number.NaN), transcript(0));
});
