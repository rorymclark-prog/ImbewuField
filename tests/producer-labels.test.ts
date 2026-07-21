import test from 'node:test';
import assert from 'node:assert/strict';

import { producerLabels } from '../lib/producer-labels.ts';
import type { LabelRefLayers } from '../lib/producer-labels.ts';
import type { DesignCanvasState, PlacedItem } from '../lib/design-canvas.ts';
import type { ProducerLabel } from '../lib/image-producer.ts';

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
