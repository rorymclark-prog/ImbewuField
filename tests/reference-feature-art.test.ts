import assert from 'node:assert/strict';
import test from 'node:test';

import {
  referenceFeatureArtworkFor,
  referenceFeatureArtworkUrl,
} from '@/lib/reference-feature-art';

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
});

test('artwork mapping never invents a visual identity for generic or unrelated features', () => {
  assert.equal(referenceFeatureArtworkFor('tree_basin'), null);
  assert.equal(referenceFeatureArtworkFor('greywater_basin'), null);
  assert.equal(referenceFeatureArtworkFor('banana_clump'), null);
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
