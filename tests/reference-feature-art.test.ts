import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

import {
  REFERENCE_FEATURE_ART_ROOT,
  referenceFeatureArtworkFor,
  referenceFeatureArtworkUrl,
  STAPLE_TILES,
  stapleTileFor,
  VEG_SPRITES,
} from '@/lib/reference-feature-art';
import { ELEMENT_CATALOG } from '@/lib/design-elements';

test('Reference Blueprint maps high-impact Water and Planting features to reusable artwork', () => {
  assert.equal(referenceFeatureArtworkFor('jojo_5000'), 'jojo-5000-top-v1.png');
  assert.equal(referenceFeatureArtworkFor('banana_circle'), 'banana-basin-v1.png');
  // Guava has its OWN crown now — it was one of the thirteen ids that shared
  // orchard-canopy-v1.png. It stays the example here because what this line tests is that a
  // planting feature resolves to artwork at all, not which file it happens to be.
  assert.equal(referenceFeatureArtworkFor('tree_guava'), 'guava-v1.png');
  assert.equal(referenceFeatureArtworkFor('veg_bed'), 'production-bed-v1.png');
  assert.equal(referenceFeatureArtworkFor('pollinator_strip'), 'pollinator-strip-v1.png');
  assert.equal(referenceFeatureArtworkFor('vetiver_row'), 'vetiver-bank-v1.png');
  assert.equal(referenceFeatureArtworkFor('compost_bay'), 'compost-bay-v1.png');
  assert.equal(referenceFeatureArtworkFor('beehive'), 'beehive-v1.png');
  assert.equal(referenceFeatureArtworkFor('chicken_tractor'), 'chicken-tractor-v1.png');
  assert.equal(referenceFeatureArtworkFor('nursery_table'), 'nursery-table-v1.png');
  assert.equal(referenceFeatureArtworkFor('shade_house'), 'shade-house-v2.png');
  assert.equal(referenceFeatureArtworkFor('gate'), 'driveway-gate-v1.png');
  assert.equal(referenceFeatureArtworkFor('pond_small'), 'pond-small-v1.png');
  assert.equal(referenceFeatureArtworkFor('greywater_basin'), 'greywater-basin-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_basin'), 'tree-basin-v1.png');
  assert.equal(referenceFeatureArtworkFor('tap_point'), 'tap-point-v1.png');
  assert.equal(referenceFeatureArtworkFor('pump_filter'), 'pump-filter-v1.png');
  assert.equal(referenceFeatureArtworkFor('greywater_diverter'), 'greywater-diverter-v1.png');
  assert.equal(referenceFeatureArtworkFor('banana_clump'), 'banana-clump-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_pawpaw'), 'pawpaw-tree-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_moringa'), 'moringa-tree-v1.png');
  assert.equal(referenceFeatureArtworkFor('keyhole_bed'), 'keyhole-bed-v1.png');
  assert.equal(referenceFeatureArtworkFor('herb_spiral'), 'herb-spiral-v1.png');
  assert.equal(referenceFeatureArtworkFor('spekboom_hedge'), 'spekboom-hedge-v1.png');
});

test('artwork mapping never invents a visual identity for generic or unrelated features', () => {
  assert.equal(referenceFeatureArtworkFor('infiltration_basin'), null);
  assert.equal(referenceFeatureArtworkFor('chicken_coop'), null);
  assert.equal(referenceFeatureArtworkFor('greenhouse_tunnel'), null);
  assert.equal(referenceFeatureArtworkFor('other_planting'), null);
  assert.equal(referenceFeatureArtworkFor('made_up_feature'), null);
});

test('legacy feature IDs select the same exact artwork without rewriting saved data', () => {
  assert.equal(referenceFeatureArtworkFor('  JOJO---5000  '), 'jojo-5000-top-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree guava'), 'guava-v1.png');
  assert.equal(referenceFeatureArtworkFor('GREYWATER---BASIN'), 'greywater-basin-v1.png');
});

test('artwork URLs are stable public paths', () => {
  assert.equal(
    referenceFeatureArtworkUrl('tree_guava'),
    '/render-assets/reference-blueprint/guava-v1.png',
  );
  assert.equal(referenceFeatureArtworkUrl('other_water'), null);
});

test('mango, litchi, macadamia and citrus have their own canopy art, not the shared generic', () => {
  assert.equal(referenceFeatureArtworkFor('tree_mango'), 'mango-tree-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_litchi'), 'litchi-tree-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_macadamia'), 'macadamia-tree-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_citrus'), 'citrus-tree-v2.png');
});

test('avocado has its own dedicated canopy art, no longer the shared orchard generic', () => {
  assert.equal(referenceFeatureArtworkFor('tree_avocado'), 'avocado-tree-v1.png');
  assert.equal(
    referenceFeatureArtworkUrl('tree_avocado'),
    '/render-assets/reference-blueprint/avocado-tree-v1.png',
  );
});

test('every mapped catalogue artwork is a real, dimensioned PNG in the public asset root', () => {
  const mapped = new Set(
    ELEMENT_CATALOG
      .map((element) => referenceFeatureArtworkFor(element.id))
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null),
  );
  assert.ok(mapped.size > 0, 'the catalogue must exercise the reference-art path');

  const publicRoot = join(process.cwd(), 'public', REFERENCE_FEATURE_ART_ROOT.replace(/^\//, ''));
  for (const asset of mapped) {
    const bytes = readFileSync(join(publicRoot, asset));
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
      `${asset} is not a PNG`,
    );
    assert.ok(bytes.length >= 24, `${asset} has no complete PNG header`);
    assert.ok(bytes.readUInt32BE(16) > 0, `${asset} has no drawable width`);
    assert.ok(bytes.readUInt32BE(20) > 0, `${asset} has no drawable height`);
  }
});

// Reference Blueprint artwork is composited onto the plan with ctx.drawImage, straight over
// the map. Nothing clips it to the canopy silhouette, so the PNG's own transparency IS the
// silhouette. A flattened export — white matte, or a "transparency" checkerboard baked into
// the pixels — therefore paints an opaque SQUARE across the farm instead of a canopy.
//
// A PNG header check cannot catch this: the broken avocado asset was colour type 6 (RGBA) and
// declared an alpha channel, it was just filled 255 everywhere. Only decoding the pixels tells
// the truth, so this test decodes them.
test('every mapped artwork carries real transparency, so it composites as a silhouette not a square', () => {
  const mapped = new Set(
    ELEMENT_CATALOG
      .map((element) => referenceFeatureArtworkFor(element.id))
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null),
  );
  const publicRoot = join(process.cwd(), 'public', REFERENCE_FEATURE_ART_ROOT.replace(/^\//, ''));

  for (const asset of mapped) {
    const { width, height, data } = PNG.sync.read(readFileSync(join(publicRoot, asset)));
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];

    // Every one of these is a top-down feature drawn inside its own bounding box, so all four
    // corners sit outside the artwork proper. An opaque corner means a baked-in background.
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.equal(
        alphaAt(x, y),
        0,
        `${asset} has an opaque pixel at corner (${x},${y}) — it would paint a background square onto the plan`,
      );
    }

    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent += 1;
    // Round artwork in a square frame leaves ~21% of the box empty at minimum; anything far
    // below that is a matte that happens to have transparent corners.
    assert.ok(
      transparent / (width * height) > 0.05,
      `${asset} is ${(100 - (transparent / (width * height)) * 100).toFixed(1)}% opaque — that is a flattened background, not a cut-out feature`,
    );
  }
});

test('every shipped reference artwork is reachable from a real catalogue element', () => {
  const mapped = new Set(
    ELEMENT_CATALOG
      .map((element) => referenceFeatureArtworkFor(element.id))
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null),
  );
  // The staple field tiles are reachable from a traced staple_garden ZONE, not from a placed
  // element — every ordinal resolves to one of them through stapleTileFor, which is asserted to
  // cover the whole set in its own test below. They join the reachable set here rather than
  // weakening the readdir sweep, so a genuinely orphaned PNG still fails this test.
  for (const tile of STAPLE_TILES) mapped.add(tile);
  // Veg sprites are reachable from the ROW ENGINE's glyph kinds (drawCropRowLayout), not from an
  // element id. Same rationale as the tiles above.
  for (const sprite of Object.values(VEG_SPRITES)) mapped.add(sprite);
  const publicRoot = join(process.cwd(), 'public', REFERENCE_FEATURE_ART_ROOT.replace(/^\//, ''));
  const shipped = readdirSync(publicRoot).filter((name) => name.endsWith('.png'));

  assert.deepEqual(
    [...mapped].sort(),
    shipped.sort(),
    'a shipped-but-unreachable asset costs app weight without ever improving a rendered feature',
  );
});


test('every staple tile is reachable through the ordinal rotation, and the rotation matches the glyph engine', () => {
  // stapleTileFor and staplePlotGlyph must agree plot-by-plot forever: both are driven by the
  // plot's saved-creation ordinal, and the tile saying maize while the fallback rows said beans
  // would make a plot change crop depending on whether its artwork happened to load.
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) seen.add(stapleTileFor(i));
  assert.equal(seen.size, STAPLE_TILES.length, 'the rotation must reach every tile');
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => stapleTileFor(i)),
    ['staple-maize-v1.png', 'staple-beans-v1.png', 'staple-pumpkin-v1.png', 'staple-mixed-v1.png'],
    'order must track STAPLE_PLOT_CROPS: grain, legume, vine, generic',
  );
  assert.equal(stapleTileFor(-3), STAPLE_TILES[0], 'a corrupt ordinal falls back to the first tile, never throws');
  assert.equal(stapleTileFor(Number.NaN), STAPLE_TILES[0]);
});
