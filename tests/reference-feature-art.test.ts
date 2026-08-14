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
import { ELEMENT_CATALOG, plantingGroupFor } from '@/lib/design-elements';

test('Reference Blueprint maps high-impact Water and Planting features to reusable artwork', () => {
  assert.equal(referenceFeatureArtworkFor('jojo_5000'), 'jojo-5000-top-v1.png');
  assert.equal(referenceFeatureArtworkFor('banana_circle'), 'banana-basin-v1.png');
  // Guava has its OWN crown now — it was one of the thirteen ids that shared
  // orchard-canopy-v1.png. It stays the example here because what this line tests is that a
  // planting feature resolves to artwork at all, not which file it happens to be.
  assert.equal(referenceFeatureArtworkFor('tree_guava'), 'guava-v2.png');
  assert.equal(referenceFeatureArtworkFor('veg_bed'), 'production-bed-v1.png');
  assert.equal(referenceFeatureArtworkFor('pollinator_strip'), 'pollinator-strip-v1.png');
  assert.equal(referenceFeatureArtworkFor('vetiver_row'), 'vetiver-bank-v1.png');
  assert.equal(referenceFeatureArtworkFor('shade_house'), 'shade-house-v2.png');
  assert.equal(referenceFeatureArtworkFor('banana_clump'), 'banana-clump-v5.png');
  assert.equal(referenceFeatureArtworkFor('tree_pawpaw'), 'pawpaw-tree-v2.png');
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

test('exact plans leave perspective illustrations on the palette and use overhead symbols', () => {
  for (const id of [
    'compost_bay', 'beehive', 'chicken_tractor', 'nursery_table', 'gate',
    'pond_small', 'greywater_basin', 'tree_basin', 'tap_point', 'pump_filter',
    'greywater_diverter',
  ]) {
    assert.equal(referenceFeatureArtworkFor(id), null, `${id} must fall through to plan-view cartography`);
  }
});

test('legacy feature IDs select the same exact artwork without rewriting saved data', () => {
  assert.equal(referenceFeatureArtworkFor('  JOJO---5000  '), 'jojo-5000-top-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree guava'), 'guava-v2.png');
  assert.equal(referenceFeatureArtworkFor('RAIN---BARREL'), 'rain-barrel-top-v1.png');
});

test('artwork URLs are stable public paths', () => {
  assert.equal(
    referenceFeatureArtworkUrl('tree_guava'),
    '/render-assets/reference-blueprint/guava-v2.png',
  );
  assert.equal(referenceFeatureArtworkUrl('other_water'), null);
});

test('every named fruit and nut entry has dedicated identity art, including indigenous fruit', () => {
  const fruitAndNut = ELEMENT_CATALOG.filter((def) => {
    const group = plantingGroupFor(def);
    return group === 'fruit_nut' || group === 'indigenous_fruit';
  });
  assert.ok(fruitAndNut.length >= 20, 'the guard must cover the complete orchard and indigenous sections');
  for (const def of fruitAndNut) {
    const art = referenceFeatureArtworkFor(def.id);
    assert.ok(art, `${def.id} has no exact-plan artwork`);
    assert.notEqual(art, 'orchard-canopy-v1.png', `${def.id} still uses the neutral Other Tree crown`);
  }
});

test('avocado has its own dedicated canopy art, no longer the shared orchard generic', () => {
  assert.equal(referenceFeatureArtworkFor('tree_avocado'), 'avocado-tree-v5.png');
  assert.equal(
    referenceFeatureArtworkUrl('tree_avocado'),
    '/render-assets/reference-blueprint/avocado-tree-v5.png',
  );
});

test('avocado fruit reads olive-brown rather than purple aubergine at map scale', () => {
  const file = join(process.cwd(), 'public', 'render-assets', 'reference-blueprint', 'avocado-tree-v5.png');
  const { data } = PNG.sync.read(readFileSync(file));
  let opaque = 0;
  let greenLeaf = 0;
  let oliveFruit = 0;
  let purpleBlack = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [red, green, blue, alpha] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (alpha <= 128) continue;
    opaque += 1;
    if (green > red * 1.15 && green > blue * 1.15) greenLeaf += 1;
    if (
      red >= 30 && red <= 125
      && green >= 30 && green <= 135
      && blue < Math.min(red, green) * 0.72
      && Math.abs(red - green) < 55
    ) oliveFruit += 1;
    if (Math.max(red, green, blue) < 120 && blue > green * 1.05 && blue > red * 1.05) {
      purpleBlack += 1;
    }
  }
  assert.ok(greenLeaf / opaque > 0.45, 'avocado crown no longer reads as green foliage');
  assert.ok(oliveFruit / opaque > 0.04,
    'avocado fruit has lost its olive-brown identity cue');
  assert.ok(purpleBlack / opaque < 0.01,
    'avocado fruit has drifted back toward an aubergine-like purple-black');
});

test('litchi and banana keep their fruit-family colour cues at map scale', () => {
  const fruitFraction = (asset: string, matches: (red: number, green: number, blue: number) => boolean) => {
    const file = join(process.cwd(), 'public', 'render-assets', 'reference-blueprint', asset);
    const { data } = PNG.sync.read(readFileSync(file));
    let opaque = 0;
    let fruit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] <= 128) continue;
      opaque += 1;
      if (matches(data[i], data[i + 1], data[i + 2])) fruit += 1;
    }
    return fruit / opaque;
  };

  assert.ok(
    fruitFraction('litchi-tree-v5.png', (red, green, blue) => red > green * 1.45 && red > blue * 1.25) > 0.025,
    'litchi has lost its visible coral-red fruit clusters',
  );
  assert.ok(
    fruitFraction('banana-clump-v5.png', (red, green, blue) => red > 150 && green > 110 && blue < 100) > 0.02,
    'banana clump has lost its visible yellow curved hands',
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
