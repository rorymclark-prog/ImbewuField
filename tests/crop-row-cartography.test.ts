import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CABBAGE_HEAD_REACH,
  MIN_DRAWN_VEG_MARK_SHEET_FRACTION,
  MIN_VEG_MARK_SHEET_FRACTION,
  VEG_MARK_DIAMETER_UNITS,
  bedCropMarkPitchPx,
  bedCropMarkUnitPx,
  bedCropRows,
  cabbageHeadLeaves,
  cropGlyphFor,
  polygonCropRows,
  staplePlotGlyph,
  staplePlotGlyphs,
  unnamedBedGlyph,
  type CropGlyph,
} from '@/lib/crop-row-cartography';

/** The sheet master every Reference Blueprint is drawn on: frame.imgW 960 x SCALE 2. */
const SHEET_WIDTH = 1920;

/** A typical saved vegetable bed — the catalog default 1.2 m x 3 m — printed at the scale a
 *  smallholder plot actually renders at (~27 px per ground metre on the 1920 px master). */
const TYPICAL_BED = { shortPx: 1.2 * 27, longPx: 3 * 27 };

/** A square plot, big enough on a real sheet to draw many rows. */
const squarePlot = (size: number): Array<[number, number]> => [
  [0, 0], [size, 0], [size, size], [0, size],
];

const glyphsDrawnIn = (ring: Array<[number, number]>, ordinal: number, seed: string): Set<CropGlyph> => {
  const layout = polygonCropRows(ring, staplePlotGlyphs(ordinal), seed, 14);
  return new Set(layout.plants.map((plant) => plant.glyph));
};

test('a staple plot draws ONE crop, not a mixture', () => {
  // The defect this guards has now been reported three times and shipped twice. Both failed
  // versions mixed crops inside each plot and varied the mixture between plots — four orderings of
  // the three sisters, then a three-rows-in-four lead crop. Both are invisible at plan scale,
  // because a reader sees a plot's overall texture and never its row sequence. Rory, each time:
  // "maizes on one plot beans on another".
  for (let ordinal = 0; ordinal < 6; ordinal++) {
    const drawn = glyphsDrawnIn(squarePlot(300), ordinal, `plot-${ordinal}`);
    assert.ok(drawn.size > 0, `plot ${ordinal} drew nothing`);
    assert.equal(drawn.size, 1, `plot ${ordinal} drew ${[...drawn].join('+')} — a plot is one crop`);
  }
});

test('four plots draw four different crops', () => {
  // The whole reason a farmer cuts one field into four plots is that they are rotated. Four blocks
  // of the same speckle is a drawing of the thing they specifically did not do.
  const crops = [0, 1, 2, 3].map((ordinal) => staplePlotGlyph(ordinal));
  assert.equal(new Set(crops).size, 4, `four plots must be four crops, got ${crops.join(', ')}`);
  // Maize first, because it is THE staple silhouette in southern Africa and the plot a farmer
  // draws first is the one they think of first.
  assert.equal(crops[0], 'grain');
});

test('plots are numbered, not hashed, so plot one keeps its crop', () => {
  // Every other glyph choice in this file is keyed on an id hash, which is right for beds — two
  // beds of greens is realistic. It is wrong for four plots, where a collision defeats the whole
  // point, and where the crop must not change because the farmer added a fifth plot or nudged a
  // corner and one plot overtook another on area.
  assert.equal(staplePlotGlyph(0), staplePlotGlyph(0));
  assert.notEqual(staplePlotGlyph(0), staplePlotGlyph(1));
  // A fifth plot wraps rather than inventing a crop, and does not disturb the first four.
  assert.equal(staplePlotGlyph(4), staplePlotGlyph(0));
  // Nothing invalid can produce an undefined glyph — this feeds a canvas draw call.
  for (const ordinal of [-1, 0.5, NaN, Infinity]) {
    assert.ok(staplePlotGlyph(ordinal), `ordinal ${ordinal} produced no glyph`);
  }
});

test('a named crop always beats the plot rotation', () => {
  // The drawing rotation is only ever a stand-in. The moment a farmer says what is in the ground,
  // that wins — a plot labelled beans must never be drawn as maize because it is plot one.
  assert.equal(cropGlyphFor('green mielies'), 'grain');
  assert.equal(cropGlyphFor('cowpeas'), 'legume');
  assert.equal(cropGlyphFor('amadumbe'), 'root');
  // And an unrecognised name asserts nothing about the farm.
  assert.equal(cropGlyphFor('mystery crop'), 'generic');
  assert.equal(cropGlyphFor(undefined), 'generic');
});

test('an unnamed vegetable bed still varies, so a garden is not wallpaper', () => {
  // The opposite rule to the staple plots, deliberately: beds are many and small, so they are
  // hashed and two beds of greens is fine. What must not happen is every bed drawing the same.
  const beds = ['bed-a', 'bed-b', 'bed-c', 'bed-d', 'bed-e', 'bed-f', 'bed-g'];
  const drawn = new Set(beds.map((id) => unnamedBedGlyph(id)));
  assert.ok(drawn.size > 1, 'seven unnamed beds all drew the same silhouette');
  // Stable across renders, or every export looks like a change.
  assert.equal(unnamedBedGlyph('bed-a'), unnamedBedGlyph('bed-a'));
});

test('a cabbage head is layered leaves around a tight centre, deterministic per plant', () => {
  // Rory, on the live sheet: "the veg beds — make actual cabbages, even oversized." The rosette
  // glyph was a filled disc; the head is now real leaf geometry, seeded from the plant's own
  // stable jitter so a bed paints identically on every render while no two heads are one stamp.
  const head = cabbageHeadLeaves(0.37);
  assert.deepEqual(head, cabbageHeadLeaves(0.37), 'one plant must grow the same head every render');
  assert.notDeepEqual(head, cabbageHeadLeaves(0.62), 'two plants must not be identical stamps');

  // Layered: a ring of wrapper leaves AND an inner whorl, or the head reads as a green flower.
  const outer = head.filter((leaf) => leaf.whorl === 0);
  const inner = head.filter((leaf) => leaf.whorl === 1);
  assert.ok(outer.length >= 6, `only ${outer.length} wrapper leaves`);
  assert.ok(inner.length >= 4, `only ${inner.length} inner leaves`);
  for (const leaf of inner) {
    assert.ok(leaf.dist < Math.min(...outer.map((wrap) => wrap.dist)), 'the inner whorl must sit inside the wrappers');
  }
});

test('no cabbage leaf can sprawl past the head reach the renderer sizes from', () => {
  // The renderer draws the head oversized on purpose (symbol size, never row pitch — the same
  // license drawCropRowLayout's glyphScale claims), so the geometry must guarantee its own
  // bound: with the reach honoured, an oversized head can crowd its neighbour but never wander
  // out of its row.
  for (const jitter of [0, 0.11, 0.37, 0.62, 0.99, Number.NaN]) {
    for (const leaf of cabbageHeadLeaves(jitter)) {
      const extent = leaf.dist + Math.max(leaf.rx, leaf.ry);
      assert.ok(extent <= CABBAGE_HEAD_REACH + 1e-9, `jitter ${jitter}: a leaf reached ${extent.toFixed(3)}`);
      assert.ok(Number.isFinite(leaf.angle) && leaf.rx > 0 && leaf.ry > 0, 'leaf feeds canvas draw calls');
    }
  }
});

test('a typical vegetable bed carries a vegetable big enough to see', () => {
  // Rory, off a live sheet and AFTER the oversized cabbage head shipped: "veg beds still don't
  // have large veg." The head was never the problem — every mark was sized from the ROW PITCH, and
  // a bed's row pitch is its own 1.2 m width divided by its rows: about 11 px at sheet scale, so
  // the mark came out ~17 px on a 1920 px master. That is under 1% of the page, three pixels on a
  // phone, and no amount of leaf geometry rescues it. The size question is answered by the PAGE.
  const unit = bedCropMarkUnitPx(TYPICAL_BED.shortPx, TYPICAL_BED.longPx, SHEET_WIDTH);
  const markDiameter = unit * VEG_MARK_DIAMETER_UNITS;
  assert.ok(
    markDiameter >= SHEET_WIDTH * MIN_VEG_MARK_SHEET_FRACTION * 0.999,
    `a bed's vegetable drew ${markDiameter.toFixed(1)} px on a ${SHEET_WIDTH} px sheet`,
  );
  // The pitch-derived size this replaced, computed the way the renderer used to: it must be a
  // clear step up, or the fix is cosmetic.
  const oldLayout = bedCropRows(TYPICAL_BED.shortPx, TYPICAL_BED.longPx, 'rosette', 'bed-1', SHEET_WIDTH * 0.0085);
  const oldDiameter = Math.max(3.4, oldLayout.rowGapPx * 0.42) * 1.5 * VEG_MARK_DIAMETER_UNITS;
  assert.ok(
    markDiameter > oldDiameter * 1.5,
    `mark is ${markDiameter.toFixed(1)} px against the old ${oldDiameter.toFixed(1)} px — not a visible change`,
  );
  // ...and it still belongs to the bed. An oversized head may overhang the edge a little, the way
  // a mature cabbage does; it may not swallow the bed whole.
  assert.ok(markDiameter <= TYPICAL_BED.shortPx * 1.15 + 1e-9, 'the mark swamped its own bed');
});

test('a bed lays out fewer, larger plants rather than packing dots in', () => {
  // The mark and the layout have to agree, or big heads simply pile up on the old dot pitch. The
  // bed keeps its rows and its long-axis direction — only the count follows the mark size.
  const unit = bedCropMarkUnitPx(TYPICAL_BED.shortPx, TYPICAL_BED.longPx, SHEET_WIDTH);
  const pitch = bedCropMarkPitchPx(unit);
  const layout = bedCropRows(
    TYPICAL_BED.longPx,
    TYPICAL_BED.shortPx,
    'rosette',
    'bed-1',
    SHEET_WIDTH * 0.0085,
    pitch,
  );
  assert.ok(layout.plants.length > 0, 'a typical bed drew no plants at all');
  assert.ok(layout.rows.length >= 1, 'a bed must still draw its drill rows');
  // Every plant is the bed's own crop — the rotation picks the silhouette per BED, never per plant.
  assert.deepEqual(new Set(layout.plants.map((plant) => plant.glyph)), new Set(['rosette']));
  // Rows run the LONG way, which is how a bed is worked.
  for (const row of layout.rows) {
    assert.ok(Math.abs(row.x1 - row.x0) >= Math.abs(row.y1 - row.y0), 'rows must run along the bed');
  }
  // Neighbouring plants are at least the stated pitch apart, so the heads lap rather than stack.
  const alongPositions = layout.plants.map((plant) => plant.x).sort((a, b) => a - b);
  for (let i = 1; i < alongPositions.length; i++) {
    const gap = alongPositions[i] - alongPositions[i - 1];
    assert.ok(gap === 0 || gap >= pitch - 1e-9, `plants ${gap.toFixed(1)} px apart, pitch is ${pitch.toFixed(1)}`);
  }
  const packed = bedCropRows(TYPICAL_BED.longPx, TYPICAL_BED.shortPx, 'rosette', 'bed-1', SHEET_WIDTH * 0.0085);
  assert.ok(
    layout.plants.length < packed.plants.length,
    'big marks must mean fewer plants, not the same dot count drawn larger',
  );
});

test('a leafy bed draws cabbages, and a bed too small to read draws none', () => {
  // Cabbage heads are for the leafy kinds, by name and by the unnamed-bed rotation — the path the
  // vector head is drawn on. Staples keep their own field treatment (staplePlotGlyphs above).
  for (const name of ['cabbage', 'Cabbages', 'spinach', 'kale', 'imifino', 'morogo']) {
    assert.equal(cropGlyphFor(name), 'rosette', `${name} should draw as a leafy head`);
  }
  const rotation = new Set(['bed-a', 'bed-b', 'bed-c', 'bed-d', 'bed-e', 'bed-f', 'bed-g', 'bed-h']
    .map((id) => unnamedBedGlyph(id)));
  assert.ok(rotation.has('rosette'), 'the unnamed-bed rotation must be able to reach the cabbage');

  // Below the readable floor the module says so rather than drawing a smudge, and the renderer
  // falls back to the shared bed artwork — an honest rectangle beats an illegible vegetable.
  assert.equal(bedCropMarkUnitPx(1.2 * 6, 3 * 6, SHEET_WIDTH), 0, 'a 7 px bed must not draw crops');
  assert.equal(bedCropMarkUnitPx(0, 100, SHEET_WIDTH), 0);
  assert.equal(bedCropMarkUnitPx(Number.NaN, 100, SHEET_WIDTH), 0);
  assert.equal(bedCropMarkPitchPx(0), 0);
  assert.ok(MIN_DRAWN_VEG_MARK_SHEET_FRACTION < MIN_VEG_MARK_SHEET_FRACTION, 'the bail floor sits under the target');
});

test('the bed painter uses the page-sized veg mark, not the row pitch', () => {
  // The same guard shape the paint-order comparator carries: the size decision only holds while
  // the renderer actually asks for it. drawProductionBedCrop derived its glyph size from
  // layout.rowGapPx for two releases, which is why an "oversized" cabbage kept printing tiny.
  const src = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');
  const painter = /function drawProductionBedCrop\(([\s\S]*?)\n}/.exec(src)?.[1] ?? '';
  assert.ok(painter.length > 0, 'guard: drawProductionBedCrop should still exist');
  assert.ok(/bedCropMarkUnitPx\(/.test(painter), 'the bed painter must size its veg from the sheet');
  assert.ok(/bedCropMarkPitchPx\(/.test(painter), 'the bed layout must follow the mark size');
});

test('a plot too small to read as rows draws nothing rather than a smudge', () => {
  const layout = polygonCropRows(squarePlot(3), staplePlotGlyphs(0), 'tiny', 14);
  assert.equal(layout.plants.length, 0);
  // Invalid input cannot manufacture a drawing either.
  assert.equal(polygonCropRows(squarePlot(300), staplePlotGlyphs(0), 'x', 0).plants.length, 0);
  assert.equal(polygonCropRows([[0, 0], [1, 1]], staplePlotGlyphs(0), 'x', 14).plants.length, 0);
});
