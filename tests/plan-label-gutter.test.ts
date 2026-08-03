import assert from 'node:assert/strict';
import test from 'node:test';

import type { DesignCanvasState } from '@/lib/design-canvas';
import {
  LABEL_GUTTER_FRACTION,
  LABEL_EVERY_SPECIMEN_MAX,
  gutterLabelText,
  labelsEverySpecimen,
  layoutGutterRows,
  sheetGutterWidth,
  type GutterRow,
} from '@/lib/plan-label-gutter';
import { calculateStyleSheetSize, styleSheetLegendWidth } from '@/lib/reference-presentation';
import { gutterCalloutRows, type LabelRefLayers } from '@/lib/producer-labels';

const W = 2176;
const H = 1539;

/** The Ubhejane demo's real framing: the app fetches imagery FRAMED ON THE FARM, so the plot runs
 *  edge to edge. This is the case the first design of this feature silently failed on. */
const PLOT: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
const REF: LabelRefLayers = { boundary: PLOT, house: [], driveway: [] };

function state(items: DesignCanvasState['items']): DesignCanvasState {
  return {
    siteId: 'site:test',
    frame: { imgW: 1088, imgH: 770, mPerPx: 0.1 },
    items,
    zones: [],
    lines: [],
    step: 0,
  } as unknown as DesignCanvasState;
}

const at = (id: string, defId: string, x: number, y: number, label?: string) =>
  ({ id, defId, x, y, ...(label ? { label } : {}) }) as DesignCanvasState['items'][number];

test('a plot that fills its own photograph still gets both gutters', () => {
  // THE CASE THE FIRST DESIGN FAILED ON, and the reason the gutter is sheet real estate rather than
  // reserved photo margin. ImbewuField fetches its aerial FRAMED ON THE FARM: on the real demo the
  // boundary measured x=0.0001 → x=0.9999 of the map, so there was nothing to reserve and the band
  // never appeared. A gutter that depends on the source data having slack is not a gutter.
  const gutter = sheetGutterWidth(1674);
  assert.ok(gutter > 0);
  const out = layoutGutterRows(
    [{ id: 'a', cx: 800, cy: 700, text: 'Mango Tree' }],
    { mapWidth: 1674, gutter, minPitch: 40, maxPitch: 80, top: 60, bottom: 1400 },
  );
  assert.equal(out.rows.length, 1, 'the sheet had no room for a single callout');
  assert.deepEqual(out.dropped, []);
});

test('the sheet counts its gutters, so the paper-ratio search is not off by 26%', () => {
  // calculateStyleSheetSize is what the A-series bisection solves against. Adding the bands to the
  // composed sheet afterwards would leave every printed plan with a cream stripe top and bottom —
  // the exact "no blank space" complaint, reintroduced by a layout change.
  const size = calculateStyleSheetSize(1674, 1468);
  assert.equal(size.gutter, sheetGutterWidth(1674));
  const canvasW = 1674 + size.gutter * 2;
  assert.equal(size.legendWidth, styleSheetLegendWidth(canvasW), 'legend keyed off the bare map');
  assert.equal(size.W, canvasW + size.legendWidth);
});

test('the band is a fixed share of the map, identical on both sides', () => {
  // A plan set whose margins differ left to right reads as a printing error, not as a layout.
  assert.equal(sheetGutterWidth(2000), Math.round(2000 * LABEL_GUTTER_FRACTION));
  assert.equal(sheetGutterWidth(0), 0);
  assert.equal(sheetGutterWidth(Number.NaN), 0);
});

test('leaders on one side can never cross: the column keeps its features\' vertical order', () => {
  const rows: GutterRow[] = [
    { id: 'a', cx: 300, cy: 900, text: 'Mango Tree' },
    { id: 'b', cx: 320, cy: 200, text: 'Litchi Tree' },
    { id: 'c', cx: 280, cy: 560, text: 'Avocado Tree' },
  ];
  const out = layoutGutterRows(rows, {
    mapWidth: W,
    gutter: 280,
    minPitch: 40,
    maxPitch: 80,
    top: 60,
    bottom: H - 100,
  });
  const left = out.rows.filter((r) => r.side === 'left').sort((p, q) => p.ay - q.ay);
  assert.deepEqual(left.map((r) => r.id), ['b', 'c', 'a'], 'rows are not in feature order');
});

test('a side with more rows than it can hold sheds to the other one, and drops nothing first', () => {
  // A farm with every tree on its western half must not lose labels while the eastern gutter sits
  // empty. What moves is the row nearest the centre line — the one whose "nearest side" was the
  // weakest claim to begin with, and therefore the one whose leader crossing the sheet costs least.
  //
  // NOTE what this does NOT do: it does not balance for its own sake. Side assignment is
  // geographic, because that is what keeps every leader short and stops any two crossing; a west
  // tree labelled in the east gutter drags a line across the whole drawing. Shedding is an
  // overflow response only, so a lopsided farm correctly gets a lopsided column.
  const rows: GutterRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: `t${i}`,
    cx: 120 + i * 8, // all left of centre, fanning toward the middle
    cy: 80 + (i * 23) % 1300,
    text: `Tree ${i}`,
  }));
  const out = layoutGutterRows(rows, {
    mapWidth: W,
    gutter: 280,
    minPitch: 40,
    maxPitch: 80,
    top: 60,
    bottom: H - 100,
  });
  assert.deepEqual(out.dropped, [], 'rows were dropped while a side still had room');
  assert.equal(out.rows.length, rows.length);
  assert.ok(out.rows.some((r) => r.side === 'right'), 'the empty gutter was never used');
});

test('rows that genuinely do not fit are reported, never silently missing', () => {
  const rows: GutterRow[] = Array.from({ length: 400 }, (_, i) => ({
    id: `t${i}`, cx: 500, cy: 100 + (i % 300), text: `Shrub ${i}`,
  }));
  const out = layoutGutterRows(rows, {
    mapWidth: W,
    gutter: 280,
    minPitch: 40,
    maxPitch: 80,
    top: 60,
    bottom: H - 100,
  });
  assert.ok(out.dropped.length > 0);
  assert.equal(out.rows.length + out.dropped.length, rows.length, 'a row vanished without a trace');
});

test('every tree is named individually; repeated units are named once with a count', () => {
  // Rory: "big trees, important plants, even if there is 3, I suggest labeling each … I don't want
  // to label 300 pigeon pea shrubs."
  assert.equal(labelsEverySpecimen('tree_moringa', 3), true);
  assert.equal(labelsEverySpecimen('tree_moringa', 5), true);
  assert.equal(labelsEverySpecimen('banana_clump', 5), true);
  // Nine beds are one vegetable garden, not nine things to name.
  assert.equal(labelsEverySpecimen('veg_bed', 9), false);
  assert.equal(labelsEverySpecimen('vetiver_row', 3), false);
  // A tank is not planting at all.
  assert.equal(labelsEverySpecimen('jojo_5000', 1), false);
  // The ceiling — a food forest is a real design, three hundred gutter rows is not a sheet.
  assert.equal(labelsEverySpecimen('tree_moringa', LABEL_EVERY_SPECIMEN_MAX), true);
  assert.equal(labelsEverySpecimen('tree_moringa', LABEL_EVERY_SPECIMEN_MAX + 1), false);
  // A NAME IS NOT AN INTENTION. This used to return true for anything renamed, which sounds right
  // and produced "Bed 1 … Bed 7" down the gutter on the very first real render — the Studio itself
  // auto-names beds, so "renamed" says nothing about whether the farmer wants seven labels.
  assert.equal(labelsEverySpecimen('veg_bed', 4), false);
});

test('an individual row carries no count; a grouped one does', () => {
  // "Moringa Tree ×5" printed five times reads as twenty-five trees. The count belongs to the
  // legend, which is the inventory — Rory: "the legend can say moringa ×3".
  assert.equal(gutterLabelText('tree_moringa', undefined, 1), 'Moringa Tree');
  assert.equal(gutterLabelText('veg_bed', undefined, 9), 'Vegetable Bed ×9');
  assert.equal(gutterLabelText('veg_bed', 'Nursery beds', 9), 'Nursery beds ×9');
});

test('five moringas are five rows with five leaders, not one leader and a count', () => {
  // The defect this whole feature exists to fix. The old engine emitted ONE "MORINGA TREE ×5"
  // pointing at one tree; the other four were unlabelled marks on the page.
  const rows = gutterCalloutRows(
    state([
      at('m1', 'tree_moringa', 0.3, 0.3),
      at('m2', 'tree_moringa', 0.35, 0.4),
      at('m3', 'tree_moringa', 0.4, 0.5),
      at('m4', 'tree_moringa', 0.45, 0.6),
      at('m5', 'tree_moringa', 0.5, 0.7),
    ]),
    REF, W, H, 'planting',
  );
  assert.equal(rows.length, 5);
  assert.deepEqual([...new Set(rows.map((r) => r.text))], ['Moringa Tree']);
  // Each row points at its OWN tree — five distinct anchors, not five copies of a centroid.
  assert.equal(new Set(rows.map((r) => `${r.cx},${r.cy}`)).size, 5);
});

test('seven auto-named beds are one row, not seven', () => {
  // The Studio auto-names beds "Bed 1 … Bed 7". Grouping by defId+label made each of them its own
  // group of one, so the grouping rule never fired and the gutter filled with a bed inventory.
  const rows = gutterCalloutRows(
    state(Array.from({ length: 7 }, (_, i) => at(`b${i}`, 'veg_bed', 0.3 + i * 0.03, 0.4, `Bed ${i + 1}`))),
    REF, W, H, 'planting',
  );
  assert.deepEqual(rows.map((r) => r.text), ['Vegetable Bed ×7']);
});

test('a name they all share is kept; seven different names are not a name for the system', () => {
  const shared = gutterCalloutRows(
    state([at('b1', 'veg_bed', 0.3, 0.4, 'Nursery bed'), at('b2', 'veg_bed', 0.4, 0.4, 'Nursery bed')]),
    REF, W, H, 'planting',
  );
  assert.deepEqual(shared.map((r) => r.text), ['Nursery bed ×2']);
});

test('a grouped row lands on a real specimen, never on the empty ground between them', () => {
  // The old layout aimed a grouped pill at the arithmetic centroid, which for two features at
  // opposite ends of a plot is the gap between them — the failure the compass-word passes were
  // written to paper over.
  const rows = gutterCalloutRows(
    state([
      at('b1', 'veg_bed', 0.2, 0.2),
      at('b2', 'veg_bed', 0.8, 0.8),
    ]),
    REF, W, H, 'planting',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].text, 'Vegetable Bed ×2');
  const onASpecimen = [[0.2, 0.2], [0.8, 0.8]].some(
    ([x, y]) => Math.abs(rows[0].cx - x * W) < 1 && Math.abs(rows[0].cy - y * H) < 1,
  );
  assert.ok(onASpecimen, `leader landed at ${rows[0].cx},${rows[0].cy} — empty ground`);
});

test('a plant already identified by a code on the map takes no gutter row', () => {
  // One answer per plant. In codes mode the map names the plant and the legend keys the code;
  // a gutter row as well would be the two-label collision that produced "B(IT)ANA CLUMP".
  const design = state([at('m1', 'tree_moringa', 0.3, 0.3), at('t1', 'jojo_2500', 0.4, 0.4)]);
  const withCodes = gutterCalloutRows(design, REF, W, H, 'planting', new Set(['tree_moringa']));
  assert.deepEqual(withCodes.map((r) => r.text), ['JoJo Tank 2500L'].filter(
    (t) => withCodes.some((r) => r.text === t),
  ));
  assert.ok(!withCodes.some((r) => r.text.includes('Moringa')), 'a coded plant got a second label');
  // …and with no codes it comes back.
  const named = gutterCalloutRows(design, REF, W, H, 'planting');
  assert.ok(named.some((r) => r.text === 'Moringa Tree'));
});

test('a renamed tree keeps its own name and its own row', () => {
  // Naming changes what a row SAYS. It is only at the per-specimen level — where a row exists for
  // each plant anyway — that a farmer's own name distinguishes anything.
  const rows = gutterCalloutRows(
    state([
      at('m1', 'tree_moringa', 0.3, 0.3, "Gogo's moringa"),
      at('m2', 'tree_moringa', 0.5, 0.5),
    ]),
    REF, W, H, 'planting',
  );
  assert.deepEqual(rows.map((r) => r.text).sort(), ["Gogo's moringa", 'Moringa Tree']);
});
