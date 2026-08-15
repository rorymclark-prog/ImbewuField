import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { groundFeatureLayer, type GroundFeatureKind } from '../lib/design-canvas.ts';
import { GROUND_FEATURES } from '../lib/design-elements.ts';

// PLACE-THEN-VANISH, for ground features. app/design/page.tsx cannot be rendered here (this repo
// has no React test harness — see tests/design-diet.test.ts for the same source-pinning approach
// used for other page.tsx-level behaviour), so this test pins the fix at both the level a unit
// test CAN reach:
//
// 1. Every GroundFeatureKind (house/patio/lawn/…, traced on the Base step) resolves through
//    groundFeatureLayer to a layer key the guard actually knows how to force on — 'ground' or
//    'planting', never a third value the effect below wouldn't cover.
// 2. app/design/page.tsx contains the force-on guard, in the same shape as the two existing water
//    guards immediately above it (armed → the shape's layer switches on), rather than the
//    "arm and never touch a layer" code the Base step chips used to run.
//
// Without the guard: a farmer who turns "Existing" off (a normal declutter action, done from a
// totally different step) and later returns to Base to trace one more house/patio/lawn ring gets
// a shape that saves, and ticks the step-guide off, but never appears on their own screen —
// DesignCanvas.tsx gates every ground-feature ring's render on
// `activeLayers[groundFeatureLayer(z.feature)]` with no exception for "just drawn".

const page = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');

test('every ground feature kind resolves to a layer the guard can force on', () => {
  const kinds = Object.keys(GROUND_FEATURES) as GroundFeatureKind[];
  assert.ok(kinds.length > 0);
  for (const kind of kinds) {
    const layer = groundFeatureLayer(kind);
    assert.ok(
      layer === 'ground' || layer === 'planting',
      `groundFeatureLayer('${kind}') returned '${layer}', which the page's areaFeature guard does not know about`,
    );
  }
});

test('arming a ground-feature area tool force-shows its own layer, like the water tools already do', () => {
  // The guard must react to `areaFeature` (what the Base-step chips and the step-guide's "Do
  // this" arm) and route it through the exact function that decides the shape's render layer —
  // not a hand-rolled second copy that could drift from groundFeatureLayer.
  assert.match(
    page,
    /useEffect\(\(\) => \{\s*if \(!areaFeature\) return;\s*const key = groundFeatureLayer\(areaFeature\);\s*setActiveLayers\(/,
    'no effect forces the ground/planting layer on when areaFeature is armed — a Base-step trace can save invisibly',
  );
  // And it must be wired to the same setter the water guards use, so a farmer's traced ring
  // actually reaches the ActiveLayers state the canvas renders from.
  assert.match(page, /\[areaFeature\]\);/);
});
