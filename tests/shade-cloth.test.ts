import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { SHADE_CLOTH_ALPHA, isShadeClothStructure } from '../lib/structures-cartography.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';

// A SHADE TUNNEL IS CLOTH, AND THERE IS A GARDEN UNDER IT.
//
// Rory, of the tunnel standing over his veg beds: "It's tunnel thing we need to either show half a
// real shade tunnel to show the veg garden underneath or what?" — and, a day later and still
// looking at it, "did you not sort the shade tunnel issue?"

test('every cloth structure is known, and only cloth structures are', () => {
  for (const id of ['shade_house', 'greenhouse_tunnel', 'shade_sail']) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} is no longer in the catalogue — re-point this rule`);
    assert.equal(isShadeClothStructure(id), true, `${id} must be drawn as cloth`);
  }
  // A shed, a coop and a storeroom have roofs. They must NOT go see-through.
  for (const id of ['shed', 'chicken_coop', 'kraal']) {
    assert.equal(isShadeClothStructure(id), false, `${id} is not shade cloth`);
  }
});

test('the cloth obscures about as much as real shade netting', () => {
  // The app's own Shade House tip recommends 40–50% netting for SA summer sun, so the drawing
  // should hide about that much. Higher and the garden disappears again — the actual complaint.
  assert.ok(SHADE_CLOTH_ALPHA >= 0.35 && SHADE_CLOTH_ALPHA <= 0.6,
    `cloth alpha ${SHADE_CLOTH_ALPHA} no longer matches real netting`);
  assert.match(ELEMENTS_BY_ID.shade_house.tip ?? '', /40-50% shade netting/,
    'the tip this number is calibrated against changed — recheck the alpha');
});

const GLOSSY = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');

test('cloth is drawn LAST, so the garden under it is painted first', () => {
  // Draw order runs largest footprint first, which put a big tunnel UNDER the beds — so it read
  // as a slab the beds sit on rather than a cover over them. Translucency alone would not fix
  // that: there has to be something already painted for the cloth to show through.
  const at = GLOSSY.indexOf('const ordered = [...visible].sort(');
  assert.ok(at > 0, 'the item draw order moved — re-pin this, do not delete it');
  const sort = GLOSSY.slice(at, at + 420);
  assert.match(sort, /isShadeClothStructure\(a\.defId\)/, 'shade cloth is back in footprint order');
  assert.match(sort, /if \(shadeA !== shadeB\) return shadeA - shadeB;/,
    'cloth no longer sorts after everything else');
  // The footprint rule must survive for everything else.
  assert.match(sort, /footM2\(b\) - footM2\(a\)/, 'the largest-first rule was lost');
});

test('cloth is drawn see-through on both the artwork and the fallback path', () => {
  // Two renderers can draw a structure: the painted artwork, and the vector fallback used when
  // that artwork has not loaded. A farm that hits the second one must not get the opaque slab
  // back — that is the same complaint arriving by the other route.
  const uses = GLOSSY.match(/isShadeClothStructure\(def\.id\)\) ctx\.globalAlpha \*= SHADE_CLOTH_ALPHA;/g) ?? [];
  assert.equal(uses.length, 2,
    `shade cloth is translucent on ${uses.length} of the 2 draw paths`);
});
