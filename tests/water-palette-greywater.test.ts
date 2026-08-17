import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ELEMENT_CATALOG } from '../lib/design-elements.ts';
import { WATER_ELEMENT_IDS, WATER_PALETTE_TABS, waterElementDefs } from '../lib/design-studio-shell.ts';
import { statedTankCapacityLitres } from '../lib/water-system.ts';
import { sheetForElement } from '../lib/glossy-filters.ts';

const BY_ID = new Map(ELEMENT_CATALOG.map((d) => [d.id, d]));
const PALETTE_SOURCE = readFileSync(
  new URL('../components/design/DesignPalette.tsx', import.meta.url),
  'utf8',
);
const PAGE_SOURCE = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');
const CANVAS_SOURCE = readFileSync(
  new URL('../components/design/DesignCanvas.tsx', import.meta.url),
  'utf8',
);

test('every greywater element a farmer can plan with is reachable from the Water palette', () => {
  // The chain a farmer actually builds: it leaves the house, it arrives, it soaks away. All four
  // existed in the catalogue and were in NO palette — excluded from Earthworks (correctly, since
  // SHEET_OVERRIDE prints them on Water) and never added to Water.
  for (const id of ['greywater_diverter', 'greywater_outlet', 'greywater_basin', 'infiltration_basin']) {
    assert.ok(BY_ID.has(id), `${id} is missing from the catalogue`);
    assert.ok((WATER_ELEMENT_IDS as readonly string[]).includes(id), `${id} is not in the Water palette`);
  }
});

test('the Greywater tab is ordered as the water runs, not alphabetically', () => {
  assert.deepEqual(WATER_PALETTE_TABS.Greywater, [
    'greywater_diverter', 'greywater_outlet', 'greywater_basin', 'infiltration_basin',
  ]);
});

test('every Water palette id lands in exactly one tab', () => {
  const tabbed = Object.values(WATER_PALETTE_TABS).flat();
  assert.equal(new Set(tabbed).size, tabbed.length, 'an id appears in more than one tab');
  for (const id of WATER_ELEMENT_IDS) {
    assert.ok(tabbed.includes(id), `${id} is in the palette but in no tab, so "All" is its only home`);
  }
  for (const id of tabbed) {
    assert.ok((WATER_ELEMENT_IDS as readonly string[]).includes(id), `${id} is tabbed but not in the palette`);
  }
});

test('the palette only offers elements that actually PRINT on the Water sheet', () => {
  // A palette that can place something the sheet will not draw is the "shape on a layer it
  // switches off" bug wearing a different hat. The basins are category 'earthworks' and reach
  // Water only through SHEET_OVERRIDE, which is exactly the case worth pinning.
  for (const def of waterElementDefs()) {
    assert.equal(
      sheetForElement(def.category, def.id), 'water',
      `${def.id} is offered on the Water palette but prints on ${sheetForElement(def.category, def.id)}`,
    );
  }
});

test("the rain barrel's capacity is shown but never counted", () => {
  const barrel = BY_ID.get('rain_barrel')!;
  assert.equal(barrel.capacityNote, '≈200 L', 'the card should state a typical capacity');
  // THE POINT OF THE WHOLE FIELD. statedTankCapacityLitres reads the NAME, and its result is
  // summed into the Water sheet's storage-vs-harvest lines. A barrel that reports 200 L would
  // tell a farmer with a 100 L drum that their storage was adequate.
  assert.equal(
    statedTankCapacityLitres(barrel), null,
    'rain_barrel must stay capacity-less to the storage arithmetic',
  );
  // ...while the JoJo tanks, which genuinely are their stated size, still do count.
  assert.equal(statedTankCapacityLitres(BY_ID.get('jojo_5000')!), 5000);
});

test('no element carries a capacityNote that its name would also encode', () => {
  for (const def of ELEMENT_CATALOG) {
    if (!def.capacityNote) continue;
    assert.equal(
      statedTankCapacityLitres(def), null,
      `${def.id} states a capacity in BOTH its name and capacityNote — the name wins and is counted`,
    );
  }
});

test('water infrastructure stays full-strength while polygon fills keep their opacity controls', () => {
  const waterPanel = PALETTE_SOURCE.slice(
    PALETTE_SOURCE.indexOf('{waterInfrastructure && ('),
    PALETTE_SOURCE.indexOf('{/* Icon + label size.'),
  );

  assert.ok(waterPanel.length > 0, 'the Water infrastructure panel disappeared');
  assert.doesNotMatch(waterPanel, /type="range"/);
  assert.doesNotMatch(waterPanel, /onOpacityChange|waterInfrastructure\.opacity/);
  assert.match(PALETTE_SOURCE, /areaFillControl\.value\.opacity/);
  assert.doesNotMatch(PAGE_SOURCE, /waterInfrastructureOpacity|WaterInfrastructureOpacity/);
  assert.match(CANVAS_SOURCE, /visible: waterInfrastructure\.visibility\[key\],[\s\S]*?opacity: 1,/);
});

test('the desktop Water controls use the panel width instead of adding five tall slider rows', () => {
  const waterPanel = PALETTE_SOURCE.slice(
    PALETTE_SOURCE.indexOf('{waterInfrastructure && ('),
    PALETTE_SOURCE.indexOf('{/* Icon + label size.'),
  );

  assert.match(waterPanel, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(PALETTE_SOURCE, /minHeight: compactDesktopLayerPanel \? 32 : 44/);
});
