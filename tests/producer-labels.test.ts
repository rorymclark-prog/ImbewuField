import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { clusterByProximity, compareLabelRows, planPlantNameChips, plotBox, producerLabels } from '../lib/producer-labels.ts';
import type { LabelRefLayers, PlantChipSpecimen } from '../lib/producer-labels.ts';
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

// A SPREAD-OUT FARM MUST NOT PRODUCE A LEADER PER TREE. Rory's Planting sheet came back with 28
// callouts — three separate avocado pills, three moringa, three litchi — because a cluster needs
// GROUP_MIN_NAMES distinct species before it earns one shared header, and on a real farm the trees
// are too far apart to cluster at the default radius. A hard cap was the previous fix and it was
// worse: it silently dropped callouts, so the map disagreed with its own legend.
test('a coarser radius merges scattered specimens instead of dropping any of them', () => {
  // Six specimens in three widely separated pairs — the shape that produced the compass-prefixed
  // NORTHERN / SOUTH-WESTERN / SOUTH-EASTERN pills.
  const pts = [
    { x: 0.10, y: 0.10, name: 'Avocado Tree', icon: '🥑' }, { x: 0.13, y: 0.12, name: 'Avocado Tree', icon: '🥑' },
    { x: 0.85, y: 0.15, name: 'Avocado Tree', icon: '🥑' }, { x: 0.88, y: 0.17, name: 'Avocado Tree', icon: '🥑' },
    { x: 0.50, y: 0.90, name: 'Avocado Tree', icon: '🥑' }, { x: 0.53, y: 0.92, name: 'Avocado Tree', icon: '🥑' },
  ];

  const tight = clusterByProximity(pts, 1, 0.18);
  const coarse = clusterByProximity(pts, 1, 1.5); // the escalation ladder's top step

  assert.equal(tight.length, 3, 'at the default radius these read as three separate places');
  assert.equal(coarse.length, 1, 'a coarser radius must merge them into one callout');

  // NOTHING MAY BE LOST in the merge — that was the whole failure of the cap.
  const total = (groups: typeof tight) => groups.reduce((n, g) => n + g.length, 0);
  assert.equal(total(tight), pts.length);
  assert.equal(total(coarse), pts.length);
});

// TEN IDENTICAL BEDS GET ONE PILL, EVEN IN INDIVIDUAL-NAMING MODE. Rory, on a Planting sheet
// with a column of ten "Vegetable Bed" callouts burying the bed block: "please only put one
// raised bed label." Individual naming exists for PERENNIALS ("perhaps better label every
// plant"); beds, rows and strips take one counted pill — the same line the gutter engine
// already draws with labelsEverySpecimen, now answered by the on-map engine too.
test('individual naming still groups beds into one counted pill', () => {
  const beds = Array.from({ length: 10 }, (_, i) => ({
    id: `bed-${i}`,
    defId: 'veg_bed',
    x: 0.2,
    y: 0.1 + i * 0.06,
    w: 0.08,
    h: 0.02,
  }));
  const state: DesignCanvasState = {
    siteId: 'site-beds',
    frame: { centerLng: 30, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    step: 'planting',
    items: beds as DesignCanvasState['items'],
    zones: [],
    lines: [],
    rev: 1,
    updatedAt: '2026-08-09T00:00:00.000Z',
  };
  const labels = producerLabels(state, waterSheetRefLayers(), 1920, 1280, 'planting', false);
  const bedPills = labels.filter((l) => l.text.toUpperCase().includes('VEGETABLE BED'));
  assert.equal(bedPills.length, 1, `expected ONE bed pill, got ${bedPills.length}: ${bedPills.map((p) => p.text).join(' | ')}`);
  assert.ok(/×10|X10|x10/i.test(bedPills[0].text.replace(/\s/g, '')), `the one pill must carry the count: "${bedPills[0].text}"`);
  // ...while a perennial guild species keeps its per-specimen labels — the behaviour Rory asked
  // for by name, which this fix must not undo.
  const trees = Array.from({ length: 3 }, (_, i) => ({
    id: `t-${i}`, defId: 'tree_mango', x: 0.3 + i * 0.25, y: 0.7, w: 0.05, h: 0.05,
  }));
  const treeState = { ...state, items: trees as DesignCanvasState['items'] };
  const treeLabels = producerLabels(treeState, waterSheetRefLayers(), 1920, 1280, 'planting', false);
  const mangoPills = treeLabels.filter((l) => l.text.toUpperCase().includes('MANGO'));
  assert.ok(mangoPills.length >= 3, `perennials must stay individually labelled, got ${mangoPills.length}`);
});

// ── planPlantNameChips: the coverage contract for on-plant name chips ─────────
//
// Rory, off a live Planting sheet: several small crowns with no caption at all, and a cluster of
// three banana clumps of which only ONE carried "Banana Clump". The old drawPlantMarks had three
// silent drop paths (a 22 px size gate, a width budget, and a clash check that deleted the losing
// chip) — and the gutter had already withheld these plants on the promise of a chip drawn on the
// map, so a dropped chip was a plant with no label anywhere. The planner's contract: every
// specimen is covered by exactly one chip, its own or a counted group's.

/** Deterministic stand-in for canvas measureText: ~6 px per character plus padding. */
const chipMeasure = (text: string) => ({ fs: 10, w: text.length * 6 + 8, h: 15 });

const FRAME = { W: 1920, H: 1280 };

function coverage(chips: ReturnType<typeof planPlantNameChips>): Map<string, number> {
  const seen = new Map<string, number>();
  for (const chip of chips) {
    for (const id of chip.memberIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  return seen;
}

test('every planted item of a mixed design is covered by exactly one chip, own or counted group', () => {
  const specimens: PlantChipSpecimen[] = [
    // Three banana clumps so close their chips must collide — the screenshot cluster.
    { id: 'ban-1', defId: 'banana_clump', name: 'Banana Clump', cx: 400, cy: 400, w: 40, h: 40 },
    { id: 'ban-2', defId: 'banana_clump', name: 'Banana Clump', cx: 440, cy: 405, w: 40, h: 40 },
    { id: 'ban-3', defId: 'banana_clump', name: 'Banana Clump', cx: 420, cy: 440, w: 40, h: 40 },
    // Two mangoes far apart — each keeps its own chip.
    { id: 'mg-1', defId: 'tree_mango', name: 'Mango Tree', cx: 1200, cy: 300, w: 60, h: 60 },
    { id: 'mg-2', defId: 'tree_mango', name: 'Mango Tree', cx: 1500, cy: 900, w: 60, h: 60 },
    // Five beds — a unit of a system, one counted chip for the lot.
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `bed-${i}`, defId: 'veg_bed', name: 'Vegetable Bed',
      cx: 900, cy: 200 + i * 80, w: 160, h: 30,
    })),
    // A crown printed well under the old 22 px gate — the "small crowns with no caption" case.
    { id: 'tiny', defId: 'tree_moringa', name: 'Moringa Tree', cx: 800, cy: 1000, w: 12, h: 12 },
  ];
  const chips = planPlantNameChips(specimens, chipMeasure, FRAME);

  const seen = coverage(chips);
  for (const s of specimens) {
    assert.equal(seen.get(s.id), 1, `${s.id} must be covered by exactly one chip, got ${seen.get(s.id) ?? 0}`);
  }
  assert.equal([...seen.keys()].length, specimens.length, 'a chip covers an id that was never supplied');

  // The colliding cluster merged into ONE counted chip anchored on a real clump.
  const banana = chips.filter((c) => c.text.startsWith('Banana Clump'));
  assert.equal(banana.length, 1, `expected one banana chip, got: ${banana.map((c) => c.text).join(' | ')}`);
  assert.equal(banana[0].text, 'Banana Clump ×3');
  assert.ok(['ban-1', 'ban-2', 'ban-3'].includes(banana[0].anchorId), 'the group chip must anchor on a member');

  // Far-apart specimens of one species are NOT merged — each keeps its own uncounted chip.
  const mango = chips.filter((c) => c.text.startsWith('Mango Tree'));
  assert.equal(mango.length, 2);
  assert.deepEqual(mango.map((c) => c.text), ['Mango Tree', 'Mango Tree']);

  // Beds stay one counted chip — the grouping Rory asked for is not undone by the coverage fix.
  const beds = chips.filter((c) => c.text.startsWith('Vegetable Bed'));
  assert.equal(beds.length, 1);
  assert.equal(beds[0].text, 'Vegetable Bed ×5');
  assert.ok(beds[0].memberIds.length === 5);

  // The tiny crown is no longer silently unlabelled.
  assert.ok(chips.some((c) => c.memberIds.includes('tiny')), 'a small crown lost its only label');

  // And no two chips overlap — clashes were resolved by merge or relocation, never deletion.
  const rects = chips.map((c) => ({
    x0: c.cx - c.w / 2, x1: c.cx + c.w / 2, y0: c.cy - c.h / 2, y1: c.cy + c.h / 2,
  }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      assert.ok(!overlap, `chips ${chips[i].text} and ${chips[j].text} overlap`);
    }
  }
});

test('neighbouring separate clusters each keep their own counted label', () => {
  // Two banana clusters at opposite ends of the plot: merging them into one "×6" would aim a
  // label at the empty ground between two real groups — each cluster earns its own "×3".
  const cluster = (prefix: string, cx: number, cy: number): PlantChipSpecimen[] => [
    { id: `${prefix}-1`, defId: 'banana_clump', name: 'Banana Clump', cx, cy, w: 40, h: 40 },
    { id: `${prefix}-2`, defId: 'banana_clump', name: 'Banana Clump', cx: cx + 40, cy: cy + 5, w: 40, h: 40 },
    { id: `${prefix}-3`, defId: 'banana_clump', name: 'Banana Clump', cx: cx + 20, cy: cy + 40, w: 40, h: 40 },
  ];
  const chips = planPlantNameChips([...cluster('west', 300, 400), ...cluster('east', 1500, 900)], chipMeasure, FRAME);
  const banana = chips.filter((c) => c.text.startsWith('Banana Clump')).sort((a, b) => a.cx - b.cx);
  assert.equal(banana.length, 2, `two separate clusters need two labels, got ${banana.length}`);
  assert.deepEqual(banana.map((c) => c.text), ['Banana Clump ×3', 'Banana Clump ×3']);
  assert.deepEqual(banana[0].memberIds.sort(), ['west-1', 'west-2', 'west-3']);
  assert.deepEqual(banana[1].memberIds.sort(), ['east-1', 'east-2', 'east-3']);
  const seen = coverage(chips);
  assert.equal([...seen.values()].every((n) => n === 1), true);
  assert.equal(seen.size, 6);
});

test('the sheet renderer draws its on-plant chips from the coverage planner', () => {
  // The planner's guarantee is only worth anything while drawPlantMarks actually consumes it.
  // The old inline layout is exactly what regrew silent drop paths twice; this guard fails the
  // moment a clash check or size gate is reintroduced beside the planner instead of inside it.
  const src = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');
  assert.match(src, /planPlantNameChips\(/, 'drawPlantMarks no longer plans chips through planPlantNameChips');
  assert.ok(!src.includes('gateSide < 22'), 'the silent size gate is back in DesignGlossy');
});

test('a renamed specimen never merges into the generic group chip', () => {
  const chips = planPlantNameChips([
    { id: 'g-1', defId: 'banana_clump', name: 'Banana Clump', cx: 400, cy: 400, w: 40, h: 40 },
    { id: 'g-2', defId: 'banana_clump', name: 'Banana Clump', cx: 430, cy: 402, w: 40, h: 40 },
    // The farmer's own name is a decision — it keeps its own chip even amid the clump cluster.
    { id: 'mine', defId: 'banana_clump', name: "Gogo's bananas", cx: 415, cy: 430, w: 40, h: 40 },
  ], chipMeasure, FRAME);
  const texts = chips.map((c) => c.text).sort();
  assert.deepEqual(texts, ['Banana Clump ×2', "Gogo's bananas"]);
  const seen = coverage(chips);
  assert.equal(seen.size, 3);
  assert.ok([...seen.values()].every((n) => n === 1));
});
