import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLANTING_CANOPY_PAINT,
  PLANTING_LEGEND_SECTION_ORDER,
  PLANTING_ROUTE_STYLE,
  plantingFeaturePresentationScale,
  plantingFeaturePresentationDimensions,
  plantingLegendSectionForFeature,
  plantingRouteStyleFor,
} from '@/lib/planting-cartography';
import {
  nearestWaterNeighbourPx,
  waterFeaturePresentationDimensions,
} from '@/lib/water-cartography';

test('Planting legend follows the Reference Blueprint reading order', () => {
  assert.deepEqual(PLANTING_LEGEND_SECTION_ORDER, [
    'PRODUCTION PLANTING',
    'PERENNIAL GUILDS',
    'GREYWATER-READY BASINS',
    'OTHER PLANTING',
  ]);
  assert.equal(plantingLegendSectionForFeature('veg_bed'), 'PRODUCTION PLANTING');
  assert.equal(plantingLegendSectionForFeature('tree_mango'), 'PERENNIAL GUILDS');
  assert.equal(plantingLegendSectionForFeature('raised_bed'), 'PRODUCTION PLANTING');
  assert.equal(plantingLegendSectionForFeature('banana_circle'), 'GREYWATER-READY BASINS');
  assert.equal(plantingLegendSectionForFeature('other_planting'), 'OTHER PLANTING');
});

test('classification is factual and does not invent unknown features', () => {
  assert.equal(plantingLegendSectionForFeature('jojo_5000'), null);
  assert.equal(plantingLegendSectionForFeature('made_up_tree'), null);
  assert.equal(plantingLegendSectionForFeature('Tree Mango'), null);
});

test('presentation scale is deterministic and leaves centres and saved geometry to the caller', () => {
  assert.equal(plantingFeaturePresentationScale('tree_mango'), 1.36);
  assert.equal(plantingFeaturePresentationScale('veg_bed'), 1);
  assert.equal(plantingFeaturePresentationScale('banana_circle'), 1.28);
  assert.equal(plantingFeaturePresentationScale('pollinator_strip'), 1);
  assert.equal(plantingFeaturePresentationScale('jojo_5000'), 1);
  assert.equal(plantingFeaturePresentationScale('tree_mango'), plantingFeaturePresentationScale('tree_mango'));
});

test('presentation dimensions preserve aspect ratio with bounded print emphasis', () => {
  const basin = plantingFeaturePresentationDimensions('tree_basin', 7, 5, 1595);
  assert.equal(Math.round((basin.width / basin.height) * 1000), 1400);
  assert.ok(basin.height >= 22);
  assert.ok(basin.scale > 1);

  const longBed = plantingFeaturePresentationDimensions('veg_bed', 150, 20, 1595);
  assert.equal(Math.round((longBed.width / longBed.height) * 1000), 7500);
  assert.deepEqual(longBed, { width: 150, height: 20, scale: 1 });

  const longStrip = plantingFeaturePresentationDimensions('pollinator_strip', 180, 8, 1595);
  assert.equal(longStrip.scale, 1);
  assert.equal(longStrip.width, 180);
  assert.equal(longStrip.height, 8);
  assert.ok(Math.abs(longStrip.width / longStrip.height - 22.5) < 0.0001);

  assert.deepEqual(
    plantingFeaturePresentationDimensions('jojo_5000', 9, 9, 1595),
    { width: 9, height: 9, scale: 1 },
  );
});

test('presentation dimensions stay finite, preserve aspect, and never shrink valid footprints', () => {
  for (const id of ['tree_mango', 'banana_circle', 'tree_basin', 'veg_bed', 'unknown']) {
    for (const naturalWidth of [0.01, 1, 17, 1000]) {
      for (const naturalHeight of [0.01, 2, 31, 1000]) {
        for (const canvasWidth of [1, 320, 1595, 10000]) {
          const result = plantingFeaturePresentationDimensions(
            id,
            naturalWidth,
            naturalHeight,
            canvasWidth,
          );
          assert.ok(Number.isFinite(result.width) && result.width >= naturalWidth);
          assert.ok(Number.isFinite(result.height) && result.height >= naturalHeight);
          assert.ok(Number.isFinite(result.scale) && result.scale >= 1);
          assert.ok(Math.abs(result.width / result.height - naturalWidth / naturalHeight) < 1e-9);
          assert.ok(Math.abs(result.width - naturalWidth * result.scale) < 1e-9);
          assert.ok(Math.abs(result.height - naturalHeight * result.scale) < 1e-9);
        }
      }
    }
  }
});

test('overlapping mature canopies preserve the lower tree edge and the ground beneath both fills', () => {
  const style = PLANTING_CANOPY_PAINT;
  for (const alpha of [
    style.artworkAlpha,
    style.washAlpha,
    style.detailAlphaMin,
    style.detailAlphaMax,
    style.edgeAlpha,
  ]) {
    assert.ok(alpha > 0 && alpha < 1, 'canopy paint must contribute without becoming opaque');
  }
  assert.ok(style.detailAlphaMin <= style.detailAlphaMax);

  // REVERSED DELIBERATELY. This used to require the later canopy's FILL to be weak enough that the
  // earlier canopy's keyline showed through it — i.e. overlap was resolved with transparency. That
  // is why a placed tree could not be found at all on a real sheet over a subtropical aerial full
  // of existing dark-green trees: Rory, four times, most plainly "i cant see any of the trees ...
  // no plants are clearly visible. do something to make them more visible, they are also
  // translucent?!"
  //
  // Overlap is now resolved the way this repo already resolved it for sector arrows and map labels
  // after the identical complaint — an opaque body inside a light CASING (drawPaintedReferenceFeature
  // strokes a cream ring before filling). A casing separates neighbours without asking the fill to
  // be see-through, so the canopy can be as solid as it needs to be against the photograph.
  assert.ok(style.artworkAlpha > 0.85, 'a placed canopy reads as a decision, not a tint');
  assert.ok(style.baseAlpha > 0.75, 'the backing must carry the canopy clear of the photograph');

  // The fallback has a wash plus its densest leaf detail. Even where those coincide on both trees,
  // some underlying map remains visible instead of the pair becoming one solid green mass.
  const strongestFallbackFill = 1 - (1 - style.washAlpha) * (1 - style.detailAlphaMax);
  const groundAfterTwoFallbackCanopies = (1 - strongestFallbackFill) ** 2;
  assert.ok(
    groundAfterTwoFallbackCanopies > 0.25,
    'beds, paths and routes beneath two fallback canopies must remain readable',
  );
  assert.ok(style.edgeAlpha > strongestFallbackFill, 'the canopy edge must be stronger than its fill');
  assert.ok(style.edgeWidthScale > 0);
});

test('invalid dimensions cannot become painted geometry or invented emphasis', () => {
  for (const invalid of [
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    assert.deepEqual(
      plantingFeaturePresentationDimensions('tree_mango', invalid, 10, 1000),
      { width: 0, height: 0, scale: 1 },
    );
    assert.deepEqual(
      plantingFeaturePresentationDimensions('tree_mango', 10, invalid, 1000),
      { width: 0, height: 0, scale: 1 },
    );
    assert.deepEqual(
      plantingFeaturePresentationDimensions('tree_mango', 10, 20, invalid),
      { width: 10, height: 20, scale: 1 },
    );
  }
});

test('windbreak styling is explicit and does not create styles for unrelated routes', () => {
  assert.deepEqual(plantingRouteStyleFor('windbreak'), PLANTING_ROUTE_STYLE.windbreak);
  assert.equal(plantingRouteStyleFor('pipe'), undefined);
  assert.equal(PLANTING_ROUTE_STYLE.windbreak.label, 'Windbreak hedge');
  assert.deepEqual(PLANTING_ROUTE_STYLE.windbreak.dash, []);
});

// ── Water emphasis must not make neighbouring tanks collide ───────────────────
// Rory, on a real farm: "the tanks overlapping?". His saved geometry was fine — a jojo tank is
// emphasised 2.1x so it survives phone-size reduction, and two tanks a realistic distance apart
// had their PAINTED footprints inflated past that distance. The only prior protection was a line
// in the AI prompt asking for "narrow visible separation", which does nothing on the free sheet.
test('water emphasis is capped so an enlarged tank cannot collide with its neighbour', () => {
  const NATURAL = 40;      // px — the tank's true painted size at this zoom
  const CANVAS = 2000;

  const unconstrained = waterFeaturePresentationDimensions('jojo_2500', NATURAL, NATURAL, CANVAS);
  assert.ok(unconstrained.scale > 2, 'a lone tank still gets its full print emphasis');

  // A neighbour 60px away: unconstrained the tank would paint ~84px wide and swallow the gap.
  const constrained = waterFeaturePresentationDimensions('jojo_2500', NATURAL, NATURAL, CANVAS, 60);
  assert.ok(constrained.width < 60, 'the painted width must stay inside the gap to its neighbour');
  assert.ok(constrained.width <= 60 * 0.82 + 1e-6, 'and leave a visible lane of ground between them');
  assert.ok(constrained.scale >= 1, 'a saved feature is never painted smaller than it was drawn');
});

test('a distant neighbour does not reduce emphasis at all', () => {
  const a = waterFeaturePresentationDimensions('jojo_2500', 40, 40, 2000);
  const b = waterFeaturePresentationDimensions('jojo_2500', 40, 40, 2000, 4000);
  assert.equal(b.scale, a.scale, 'far-apart tanks keep full emphasis');
});

test('omitting the neighbour distance preserves the previous behaviour exactly', () => {
  for (const id of ['jojo_2500', 'rain_barrel', 'tap_point', 'tree_basin']) {
    const before = waterFeaturePresentationDimensions(id, 33, 21, 1600);
    const after = waterFeaturePresentationDimensions(id, 33, 21, 1600, undefined);
    assert.deepEqual(after, before, `${id} must be unchanged when no neighbour is supplied`);
  }
});

test('nearestWaterNeighbourPx ignores un-emphasised features and self', () => {
  const feats = [
    { id: 'jojo_2500', cx: 0, cy: 0 },
    { id: 'swale', cx: 10, cy: 0 },        // not emphasised — cannot balloon into us
    { id: 'jojo_5000', cx: 100, cy: 0 },
  ];
  assert.equal(nearestWaterNeighbourPx(feats, 0), 100);
  assert.equal(nearestWaterNeighbourPx([feats[0]], 0), undefined, 'a lone feature has no neighbour');
});
