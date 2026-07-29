import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  REFERENCE_FEATURE_ART_ROOT,
  referenceFeatureArtworkFor,
  referenceFeatureArtworkUrl,
} from '@/lib/reference-feature-art';
import { ELEMENT_CATALOG } from '@/lib/design-elements';

test('Reference Blueprint maps high-impact Water and Planting features to reusable artwork', () => {
  assert.equal(referenceFeatureArtworkFor('jojo_5000'), 'jojo-tank-v1.png');
  assert.equal(referenceFeatureArtworkFor('banana_circle'), 'banana-basin-v1.png');
  assert.equal(referenceFeatureArtworkFor('tree_mango'), 'orchard-canopy-v1.png');
  assert.equal(referenceFeatureArtworkFor('veg_bed'), 'production-bed-v1.png');
  assert.equal(referenceFeatureArtworkFor('pollinator_strip'), 'pollinator-strip-v1.png');
  assert.equal(referenceFeatureArtworkFor('vetiver_row'), 'vetiver-bank-v1.png');
  assert.equal(referenceFeatureArtworkFor('compost_bay'), 'compost-bay-v1.png');
  assert.equal(referenceFeatureArtworkFor('beehive'), 'beehive-v1.png');
  assert.equal(referenceFeatureArtworkFor('chicken_tractor'), 'chicken-tractor-v1.png');
  assert.equal(referenceFeatureArtworkFor('nursery_table'), 'nursery-table-v1.png');
  assert.equal(referenceFeatureArtworkFor('shade_house'), 'shade-house-v1.png');
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

test('artwork URLs are stable public paths', () => {
  assert.equal(
    referenceFeatureArtworkUrl('tree_avocado'),
    '/render-assets/reference-blueprint/orchard-canopy-v1.png',
  );
  assert.equal(referenceFeatureArtworkUrl('other_water'), null);
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

test('every shipped reference artwork is reachable from a real catalogue element', () => {
  const mapped = new Set(
    ELEMENT_CATALOG
      .map((element) => referenceFeatureArtworkFor(element.id))
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null),
  );
  const publicRoot = join(process.cwd(), 'public', REFERENCE_FEATURE_ART_ROOT.replace(/^\//, ''));
  const shipped = readdirSync(publicRoot).filter((name) => name.endsWith('.png'));

  assert.deepEqual(
    [...mapped].sort(),
    shipped.sort(),
    'a shipped-but-unreachable asset costs app weight without ever improving a rendered feature',
  );
});
