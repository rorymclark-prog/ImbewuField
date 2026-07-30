import test from 'node:test';
import assert from 'node:assert/strict';

import { clusterByProximity, compareLabelRows, plotBox, producerLabels, satelliteTankCapacityLabelBindings, satelliteTankCapacityLabels } from '../lib/producer-labels.ts';
import type { LabelRefLayers } from '../lib/producer-labels.ts';
import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import { fitMeasuredPillX, type ProducerLabel } from '../lib/image-producer.ts';

// ── Fixture: a WATER-sheet design that reproduces the production bug ─────────
//
// Real water/earthworks sheets are dominated by cheap, single-purpose fixtures (tap points,
// tanks, basins) that a farmer drops all over the plot — nothing like the tidy 3+-of-a-kind
// orchard cluster the grouping algorithm (GROUP_MIN_NAMES = 3, GROUP_PROXIMITY = 0.18 of frame
// height) was designed around. So on a real design almost every proximity cluster ends up with
// exactly ONE distinct name in it, which — per producerLabels — never earns a header: it just
// becomes its own margin-pinned pill with no de-duplication against any OTHER pill carrying the
// identical text. Two tap points at opposite ends of the plot both read "TAP POINT" with nothing
// to tell them apart.
//
// 18 items, real ids from lib/design-elements.ts (category 'water' or 'earthworks', both valid
// on the 'water' glossy filter — see lib/glossy-filters.ts itemInFilter):
//   • 5x tap_point + 2x jojo_1000, scattered far enough apart (> GROUP_PROXIMITY in the
//     aspect-corrected metric) that none of them cluster with each other — reproducing the
//     "several of the same name, all unlabelled apart" bug.
//   • 1x borehole, pond_small, dam, rain_barrel, pump_filter, banana_circle, tree_basin — the
//     one-off fixtures that make up the bulk of a real sheet.
//   • 4x water_trough clustered tightly together — the one deliberately grouped cluster, so a
//     "×4" count label is also exercised (the layout isn't ALWAYS pathological, just mostly).
// Plus a traced boundary (full-frame square) and a driveway line, both required for a realistic
// refLayers.
function waterSheetItems(): PlacedItem[] {
  let n = 0;
  const it = (defId: string, x: number, y: number): PlacedItem => ({ id: `item-${n++}`, defId, x, y });
  return [
    // Five separate tap points — far enough apart that each is its own singleton cluster.
    it('tap_point', 0.10, 0.08),
    it('tap_point', 0.08, 0.28),
    it('tap_point', 0.12, 0.48),
    it('tap_point', 0.09, 0.68),
    it('tap_point', 0.11, 0.88),
    // Two separate 1000L JoJo tanks, likewise far apart.
    it('jojo_1000', 0.30, 0.06),
    it('jojo_1000', 0.28, 0.94),
    // One-off water fixtures.
    it('borehole', 0.32, 0.30),
    it('pond_small', 0.34, 0.50),
    it('dam', 0.31, 0.70),
    it('rain_barrel', 0.60, 0.10),
    it('pump_filter', 0.62, 0.30),
    // One deliberately tight cluster of 4 troughs — exercises the "×N" grouped-count path.
    it('water_trough', 0.640, 0.500),
    it('water_trough', 0.641, 0.501),
    it('water_trough', 0.642, 0.502),
    it('water_trough', 0.643, 0.503),
    // A couple of earthworks fixtures on the right half.
    it('banana_circle', 0.85, 0.15),
    it('tree_basin', 0.87, 0.85),
  ];
}

function waterSheetState(): DesignCanvasState {
  return {
    siteId: 'site-water-sheet',
    frame: { centerLng: 30, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    step: 'water',
    items: waterSheetItems(),
    zones: [],
    lines: [],
    rev: 1,
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

function waterSheetRefLayers(): LabelRefLayers {
  return {
    boundary: [[0, 0], [1, 0], [1, 1], [0, 1]],
    house: [],
    driveway: [[0.5, 0.02], [0.5, 0.98]],
  };
}

const W = 2224;
const H = 1488;

function labels(): ProducerLabel[] {
  return producerLabels(waterSheetState(), waterSheetRefLayers(), W, H, 'water', false);
}

function labelsAt(width: number, height: number): ProducerLabel[] {
  return producerLabels(waterSheetState(), waterSheetRefLayers(), width, height, 'water', false);
}

// Mirrors burnLabels' non-blueprint pill geometry (lib/image-producer.ts): fs = 26, padX = 14,
// h = fs + 14. Width is the same character-count ESTIMATE producerLabels itself uses internally
// to right-align the right-hand column (padX*2 + text.length*fs*0.62, 0.66 for a header).
function pillRect(label: ProducerLabel): { left: number; right: number; top: number; bottom: number } {
  const fs = 26;
  const padX = 14;
  const h = fs + 14;
  const mult = label.kind === 'header' ? 0.66 : 0.62;
  const w = padX * 2 + label.text.length * fs * mult;
  const top = label.ay - h / 2;
  return { left: label.ax, right: label.ax + w, top, bottom: top + h };
}

function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  const tol = 2; // px tolerance
  return a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;
}

test('producerLabels does not overlap any two pills on a real water sheet', () => {
  const out = labels();
  const rects = out.map(pillRect);
  const overlapping: string[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        overlapping.push(`"${out[i].text}" × "${out[j].text}"`);
      }
    }
  }
  assert.equal(
    overlapping.length,
    0,
    `expected no overlapping label pills, found ${overlapping.length} overlapping pair(s): ${overlapping.join(', ')}`,
  );
});

test('producerLabels keeps every pill inside the output frame', () => {
  const out = labels();
  const rects = out.map(pillRect);
  const outOfBounds: string[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) {
      outOfBounds.push(`"${out[i].text}" (top=${r.top.toFixed(1)}, bottom=${r.bottom.toFixed(1)}, left=${r.left.toFixed(1)}, right=${r.right.toFixed(1)})`);
    }
  }
  assert.equal(
    outOfBounds.length,
    0,
    `expected every pill within the ${W}x${H} frame, found ${outOfBounds.length} out-of-bounds pill(s): ${outOfBounds.join(', ')}`,
  );
});

test('left-column labels stay clear of the deterministic scale bar', () => {
  const out = labels();
  const scaleSafeTop = H - Math.max(110, Math.round(H * 0.11));
  const intruding = out
    .filter((label) => label.ax < W / 2)
    .filter((label) => pillRect(label).bottom > scaleSafeTop)
    .map((label) => label.text);
  assert.deepEqual(intruding, [], `labels inside the scale-bar reserve: ${intruding.join(', ')}`);
});

test('producerLabels never renders the same text twice on the same side', () => {
  const out = labels();
  const bySide = new Map<string, number>();
  for (const l of out) {
    const side = l.ax < W / 2 ? 'left' : 'right';
    const key = `${side}: ${l.text}`;
    bySide.set(key, (bySide.get(key) ?? 0) + 1);
  }
  const duplicated = [...bySide.entries()].filter(([, count]) => count > 1);
  assert.equal(
    duplicated.length,
    0,
    `expected no duplicate label text on either side, found ${duplicated.length} duplicated text(s): ${duplicated.map(([k, c]) => `${k} ×${c}`).join(', ')}`,
  );
});

test('the longest catalog name stays inside every measured output width even with a wider fallback font', () => {
  const state = waterSheetState();
  state.items = [{
    id: 'longest-label',
    defId: 'greywater_diverter',
    x: 0.82,
    y: 0.5,
  }];
  const widths = [700, 900, 1100, 1400, 1800, 2400];

  for (const width of widths) {
    const [label] = producerLabels(state, waterSheetRefLayers(), width, Math.round(width / 1.5), 'water', false);
    assert.ok(label, `W=${width}: longest catalog item should produce a label`);

    // producerLabels deliberately estimates before the browser resolves its font. Model a wider
    // fallback than that estimate; the final draw must use the measured width and still fit.
    const measuredWidth = 28 + label.text.length * 26 * 0.70;
    const fittedX = fitMeasuredPillX(label.ax, measuredWidth, width);
    assert.ok(fittedX >= 0, `W=${width}: label starts outside the sheet`);
    assert.ok(fittedX + measuredWidth <= width + 0.001, `W=${width}: label ends outside the sheet`);
  }
});

test('dense producer-label columns stay ordered and non-overlapping at real boundary-derived map shapes', () => {
  // Tall, square and maximally-wide maps from calculateBoundaryPresentationLayout. These are the
  // actual shapes the renderer can now produce, rather than one snapshot constant.
  for (const [width, height] of [[784, 3136], [1568, 1568], [2404, 1022]] as const) {
    const out = labelsAt(width, height);
    const rects = out.map((label) => {
      const fs = 26;
      const padX = 14;
      const mult = label.kind === 'header' ? 0.66 : 0.62;
      const pillWidth = padX * 2 + label.text.length * fs * mult;
      const x = fitMeasuredPillX(label.ax, pillWidth, width);
      return { left: x, right: x + pillWidth, top: label.ay - 20, bottom: label.ay + 20 };
    });
    for (let i = 0; i < rects.length; i++) {
      assert.ok(rects[i].left >= 0 && rects[i].right <= width, `${width}x${height}: label ${i} is outside`);
      for (let j = i + 1; j < rects.length; j++) {
        assert.equal(rectsOverlap(rects[i], rects[j]), false, `${width}x${height}: labels ${i}/${j} overlap`);
      }
    }

    for (const side of ['left', 'right'] as const) {
      const leaders = out
        .filter((label) => label.leader !== false)
        .filter((label) => (label.ax < width / 2 ? 'left' : 'right') === side)
        .sort((a, b) => a.cy - b.cy);
      for (let i = 1; i < leaders.length; i++) {
        assert.ok(
          leaders[i].ay >= leaders[i - 1].ay,
          `${width}x${height} ${side}: leader order reverses, so two leaders can cross`,
        );
      }
    }
  }
});

test('a planted row with tied y anchors orders by x, then by stable item id', () => {
  const state = waterSheetState();
  state.items = [
    { id: 'demo-di-mango', defId: 'tree_mango', x: 0.355083, y: 0.650491 },
    { id: 'demo-di-avocado', defId: 'tree_avocado', x: 0.466558, y: 0.650491 },
  ];

  const leaders = producerLabels(state, waterSheetRefLayers(), W, H, 'planting', false)
    .filter((label) => label.leader !== false);

  assert.deepEqual(
    leaders.map((label) => label.id),
    ['demo-di-mango', 'demo-di-avocado'],
    'the left tree must receive the upper row so equal-y leaders cannot cross',
  );
  assert.ok(leaders[0].ay <= leaders[1].ay);
  assert.ok(
    compareLabelRows(
      { id: 'a', cx: 100, cy: 200 },
      { id: 'b', cx: 100, cy: 200 },
    ) < 0,
    'source id is the deterministic final key when both coordinates tie',
  );
});

test('malformed presentation geometry is omitted without mutating valid saved labels', () => {
  const state = waterSheetState();
  state.items.push({
    id: 'invalid-item',
    defId: 'tap_point',
    x: Number.NaN,
    y: 0.5,
    label: 'POISON COORDINATE',
  });
  const refLayers = waterSheetRefLayers();
  refLayers.boundary[1] = [Number.POSITIVE_INFINITY, 0];
  refLayers.driveway = [[0.5, 0.02], [Number.NaN, 0.5]];
  const before = structuredClone({ state, refLayers });

  const out = producerLabels(state, refLayers, W, H, 'water', false);

  assert.ok(out.length > 0, 'one malformed feature must not erase valid labels');
  assert.equal(out.some((label) => label.text.includes('POISON COORDINATE')), false);
  assert.equal(out.some((label) => label.text.includes('DRIVEWAY')), false);
  assert.ok(
    out.every((label) => [label.cx, label.cy, label.ax, label.ay, label.lx].every(Number.isFinite)),
  );
  assert.deepEqual({ state, refLayers }, before, 'presentation cleanup must never rewrite saved geometry');
});

test('invalid canvas dimensions draw no producer labels', () => {
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      producerLabels(waterSheetState(), waterSheetRefLayers(), invalid, H, 'water', false),
      [],
    );
    assert.deepEqual(
      producerLabels(waterSheetState(), waterSheetRefLayers(), W, invalid, 'water', false),
      [],
    );
  }
});

test('exported geometry helpers return finite fallbacks and retain only usable points', () => {
  assert.deepEqual(
    plotBox([[0, 0], [Number.NaN, 0], [1, 1]]),
    { x0: 0, y0: 0, x1: 1, y1: 1 },
  );
  const valid = { x: 0.4, y: 0.5, name: 'Tank', icon: '' };
  const clusters = clusterByProximity([
    valid,
    { x: Number.NaN, y: 0.5, name: 'Invalid', icon: '' },
    { x: 2, y: 0.5, name: 'Outside', icon: '' },
  ], Number.NaN);
  assert.deepEqual(clusters, [[valid]]);
});

test('Satellite tank capacity chrome keeps each catalog capacity bound to its saved marker', () => {
  const state = waterSheetState();
  // Deliberately reverse the array order and lie in the instance labels: neither index nor a
  // farmer-entered nickname is allowed to decide which capacity is printed at which marker.
  state.items = [
    { id: 'tank-central-2500', defId: 'jojo_2500', x: 0.481307, y: 0.518217, label: '5000L' },
    { id: 'tank-north-5000', defId: 'jojo_5000', x: 0.445795, y: 0.387785, label: '2500L' },
  ];
  const bindings = satelliteTankCapacityLabelBindings(state);
  assert.deepEqual(
    bindings.map(({ itemId, defId, text, icon, x, y }) => ({ itemId, defId, text, icon, x, y })),
    [
      { itemId: 'tank-central-2500', defId: 'jojo_2500', text: 'JoJo Tank 2500L', icon: '🛢️', x: 0.481307, y: 0.518217 },
      { itemId: 'tank-north-5000', defId: 'jojo_5000', text: 'JoJo Tank 5000L', icon: '🫙', x: 0.445795, y: 0.387785 },
    ],
  );
  const labels = satelliteTankCapacityLabels(state, waterSheetRefLayers(), W, H);
  assert.deepEqual(
    labels.map(({ id, text, cx, cy }) => ({ id, text, cx, cy })),
    [
      { id: 'tank-north-5000', text: 'JOJO TANK 5000L', cx: 0.445795 * W, cy: 0.387785 * H },
      { id: 'tank-central-2500', text: 'JOJO TANK 2500L', cx: 0.481307 * W, cy: 0.518217 * H },
    ],
  );
  assert.deepEqual(state.items.map((item) => item.label), ['5000L', '2500L']);
});
