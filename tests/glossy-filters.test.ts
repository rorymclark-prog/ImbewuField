import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  cartographicItemPaintRank,
  compareCartographicPaint,
  itemInFilter,
  lineInFilter,
  exactSheetLineRegister,
  exactSheetLineLegendGroups,
  EXACT_CONTEXT_ALPHA,
  EXACT_FULL_STRENGTH_ALPHA,
  zonesInFilter,
  sheetForElement,
  sheetsForElement,
  groundContentRingsForSheet,
  groundRegister,
  existingSiteItems,
  layerContentCount,
  ownedByCurrentStep,
  type GlossyLayerFilter,
} from '../lib/glossy-filters.ts';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID, biomeClimates, elementVisibleInPalette } from '../lib/design-elements.ts';
import { groundFeatureLayer } from '../lib/design-canvas.ts';
import type { DesignCanvasState, GroundFeatureKind, PlacedItem, ZoneShape } from '../lib/design-canvas.ts';
import type { MapRefLayers } from '../lib/base-layers.ts';
import { waterRouteStyleFor } from '../lib/water-cartography.ts';

// glossy-filters.ts has said since it was extracted that it exists "so the pure layer-membership
// logic is unit-testable" — and there was no test. In that gap, itemInFilter(_, 'zones') returning
// false for every category reached production and produced a "ZONES PLAN" with no zones on it and a
// legend of invented tanks and veg beds. This file is that missing guard.

// The design-layer sheets a line/element can be OWNED by. Earthworks (05) joined when the
// land-shaping split out of Water — a swale is owned here now, not by Water.
const LAYER_SHEETS: GlossyLayerFilter[] = ['water', 'earthworks', 'planting', 'structures'];
const LINE_KINDS = ['swale', 'fence', 'path', 'pipe', 'drip', 'windbreak', 'greywater'] as const;

test('every catalog element has exactly one primary layer sheet', () => {
  const orphans: string[] = [];
  for (const def of ELEMENT_CATALOG) {
    if (!sheetForElement(def.category, def.id)) orphans.push(`${def.id} (${def.category})`);
  }
  assert.deepEqual(orphans, [], 'elements on NO sheet — a farmer places these and never sees them');
});

test('only explicit integrated systems are factual content on two layer sheets', () => {
  const shared = ELEMENT_CATALOG
    .map((def) => ({ id: def.id, sheets: LAYER_SHEETS.filter((f) => itemInFilter(def.category, f, def.id)) }))
    .filter(({ sheets }) => sheets.length > 1)
    .map(({ id, sheets }) => `${id}:${sheets.join('+')}`)
    .sort();
  // This allow-list is doing its job: it caught the earthworks additions below the moment they
  // were made, which is exactly what it is for. Every entry is a feature the farmer DIGS, added to
  // sheet 05 because that sheet was showing swales and nothing else — as if a farm's only
  // earthwork were a ditch, when the same farm has beds to build, basins to dig and a spiral to
  // shape before a single plant goes in. Rory: "where the raised bed for vegetables? ... we need
  // to include tree basins? also greywater basins."
  //
  // Primary sheets are unchanged (asserted below), so palette ownership, editing rules and the
  // counts on Planting and Water all stay exactly as they were. Anything NOT dug must stay off
  // this list — that is the line this guard is holding.
  assert.deepEqual(shared, [
    'banana_circle:water+earthworks+planting',
    'greywater_basin:water+earthworks',
    'herb_spiral:earthworks+planting',
    'infiltration_basin:water+earthworks',
    'keyhole_bed:earthworks+planting',
    'raised_bed:earthworks+planting',
    'tree_basin:water+earthworks+planting',
    'veg_bed:earthworks+planting',
  ]);
  for (const def of ELEMENT_CATALOG) {
    const sheets = sheetsForElement(def.category, def.id);
    assert.equal(sheets[0], sheetForElement(def.category, def.id), `${def.id} primary sheet must remain first`);
  }
});

test('every line kind appears on exactly one layer sheet', () => {
  for (const kind of LINE_KINDS) {
    const on = LAYER_SHEETS.filter((f) => lineInFilter(kind, f));
    assert.equal(on.length, 1, `${kind} is on ${on.length} sheets (${on.join('+') || 'none'})`);
  }
});

test('the whole-design sheet carries everything', () => {
  for (const def of ELEMENT_CATALOG) {
    assert.ok(itemInFilter(def.category, 'all', def.id), `${def.id} missing from the masterplan`);
  }
  for (const kind of LINE_KINDS) assert.ok(lineInFilter(kind, 'all'), `${kind} missing from the masterplan`);
  assert.ok(zonesInFilter('all'));
});

test('the Site sheet carries every category explicitly marked already here, but not proposals', () => {
  const categories = ['water', 'earthworks', 'growing', 'structure', 'animal', 'access'] as const;
  const items: PlacedItem[] = categories.map((category, index) => {
    const def = ELEMENT_CATALOG.find((candidate) => candidate.category === category)!;
    return { id: `existing-${category}`, defId: def.id, x: index / 10, y: index / 10, status: 'existing' as const };
  });
  items.push({ id: 'proposed', defId: items[0].defId, x: 0.9, y: 0.9, status: 'proposed' as const });
  assert.deepEqual(existingSiteItems({ items }).map((item) => item.id), categories.map((category) => `existing-${category}`));
});

test('cartographic stacking paints tree basins below every circular tree canopy', () => {
  const basin = ELEMENT_CATALOG.find((def) => def.id === 'tree_basin')!;
  const trees = ELEMENT_CATALOG.filter((def) => def.category === 'growing' && def.shape === 'circle');
  assert.ok(trees.length > 0, 'guard: the catalog should contain tree canopies');
  for (const tree of trees) {
    assert.ok(
      cartographicItemPaintRank(basin) < cartographicItemPaintRank(tree),
      `${basin.name} must paint below ${tree.name}`,
    );
  }
});

// THE PAINT-ORDER INVERSION FOR CANOPIES — Rory, after the dashed-edge signal alone failed to
// carry it: "small trees still above big trees." Overlapping crowns must paint smallest first and
// largest last, so the taller canopy occludes the smaller plants under its edge, exactly as an
// aerial photograph reads. Everything that is not a canopy keeps largest-first, so a small feature
// nested on a big one (a tap on a pad, a bed inside a plot) stays visible — and basins stay in
// their lower rank, below every crown, whatever their size.
test('overlapping canopies paint small-first so the larger crown is drawn on top', () => {
  const mango = ELEMENTS_BY_ID['tree_mango'];
  const pawpaw = ELEMENTS_BY_ID['tree_pawpaw'];
  assert.ok(mango.shape === 'circle' && pawpaw.shape === 'circle', 'guard: both are canopies');
  const big = { def: mango, area: 36, id: 'big-mango' };
  const small = { def: pawpaw, area: 9, id: 'small-pawpaw' };
  // Painted in ascending sort order: the SMALL crown first, the LARGE crown after (on top).
  assert.ok(compareCartographicPaint(small, big) < 0, 'small canopy must paint before the large one');
  assert.ok(compareCartographicPaint(big, small) > 0, 'large canopy must paint after the small one');

  // A basin never rises above a canopy, however large the basin or small the crown.
  const basin = { def: ELEMENTS_BY_ID['tree_basin'], area: 100, id: 'basin' };
  assert.ok(compareCartographicPaint(basin, small) < 0, 'tree basin must stay below every canopy');

  // Non-canopy registers keep their largest-first order.
  const bigBed = { def: ELEMENTS_BY_ID['veg_bed'], area: 24, id: 'big-bed' };
  const smallBed = { def: ELEMENTS_BY_ID['veg_bed'], area: 6, id: 'small-bed' };
  assert.ok(compareCartographicPaint(bigBed, smallBed) < 0, 'beds still paint largest-first');

  // Ties break on id, so the same saved design always produces the same sheet.
  const twinA = { def: mango, area: 16, id: 'a' };
  const twinB = { def: mango, area: 16, id: 'b' };
  assert.ok(compareCartographicPaint(twinA, twinB) < 0);
});

// A TREE IS ABOVE A BED, AND THE SHEET MUST SAY SO. Rory, off a live Reference Blueprint planting
// sheet: "veg beds sit above trees, put them under." A citrus crown that overhangs a vegetable bed
// is physically over it, so the crown must be painted AFTER the bed and occlude its crop rows —
// never the other way round, whatever the two footprints measure.
test('a tree canopy paints over the bed it overhangs, never under it', () => {
  const citrus = ELEMENTS_BY_ID['tree_citrus'];
  const vegBed = ELEMENTS_BY_ID['veg_bed'];
  const raisedBed = ELEMENTS_BY_ID['raised_bed'];
  assert.ok(citrus.category === 'growing' && citrus.shape === 'circle', 'guard: citrus is a canopy');

  // The overlap that produced the report: a 4 m citrus crown reaching across a 1.2 x 3 m bed, so
  // the BED has the larger saved footprint. Size must not be able to lift it over the crown.
  const crown = { def: citrus, area: 4 * 4, id: 'citrus-1' };
  const bed = { def: vegBed, area: 1.2 * 3, id: 'bed-1' };
  const bigBed = { def: vegBed, area: 40, id: 'bed-huge' };
  const raised = { def: raisedBed, area: 1.2 * 2.4, id: 'raised-1' };
  for (const under of [bed, bigBed, raised]) {
    assert.ok(
      compareCartographicPaint(under, crown) < 0,
      `${under.def.name} must paint BEFORE the citrus canopy`,
    );
    assert.ok(
      compareCartographicPaint(crown, under) > 0,
      `the citrus canopy must paint AFTER ${under.def.name} (i.e. over it)`,
    );
  }

  // Every bed and crop row in the catalog, against every canopy in it — the rule is total, not a
  // pair of ids that happened to be reported.
  const beds = ELEMENT_CATALOG.filter((def) => def.category === 'growing' && def.shape === 'rect');
  const canopies = ELEMENT_CATALOG.filter((def) => def.category === 'growing' && def.shape === 'circle');
  assert.ok(beds.length > 0 && canopies.length > 0, 'guard: the catalog holds beds and canopies');
  for (const bedDef of beds) {
    for (const canopy of canopies) {
      assert.ok(
        cartographicItemPaintRank(bedDef) < cartographicItemPaintRank(canopy),
        `${bedDef.name} must paint below ${canopy.name}`,
      );
    }
    // ...and still ABOVE the ground washes and basins it is built on, or a raised bed disappears
    // under its own earthwork.
    for (const ground of ELEMENT_CATALOG.filter((def) => def.category === 'earthworks')) {
      assert.ok(
        cartographicItemPaintRank(ground) < cartographicItemPaintRank(bedDef),
        `${ground.name} must paint below ${bedDef.name}`,
      );
    }
  }
});

test('every sheet paint loop sorts through the one shared comparator', () => {
  // The previous ordering "fix" did not hold because the direction lived in per-call-site inline
  // comparators — each sorted rank-then-largest-first on its own, so no single place could carry
  // the canopy inversion. This guard keeps the comparator the single authority: the moment a paint
  // loop grows its own `areaB - areaA` again, the inversion silently unfixes itself.
  const src = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');
  const calls = src.match(/compareCartographicPaint\(/g) ?? [];
  // FOUR, not three. drawExistingSiteItems was the loop nobody counted: it drew the farmer's
  // recorded items in SAVED ARRAY ORDER, so a bed recorded after a tree painted its crop rows over
  // the crown on the Site and Site-Hybrid sheets — the same inversion this comparator settles
  // everywhere else, in the one place that never asked it.
  assert.ok(calls.length >= 4, `expected every item sort to call compareCartographicPaint, found ${calls.length}`);
  assert.ok(!/cartographicItemPaintRank/.test(src), 'an inline rank comparator crept back into DesignGlossy');
  const existing = /function drawExistingSiteItems\(([\s\S]*?)\n}/.exec(src)?.[1] ?? '';
  assert.ok(existing.length > 0, 'guard: drawExistingSiteItems should still exist');
  assert.ok(
    /compareCartographicPaint\(/.test(existing),
    'drawExistingSiteItems must order its items through the shared comparator',
  );
});

test('cartographic stacking keeps all ground earthworks below planting', () => {
  const earthworks = ELEMENT_CATALOG.filter((def) => def.category === 'earthworks');
  const planting = ELEMENT_CATALOG.filter((def) => def.category === 'growing');
  for (const ground of earthworks) {
    for (const plant of planting) {
      assert.ok(
        cartographicItemPaintRank(ground) < cartographicItemPaintRank(plant),
        `${ground.name} must paint below ${plant.name}`,
      );
    }
  }
});

test('subtropical planting palette hides deprecated and wrong-climate fruit trees', () => {
  const climates = biomeClimates('Indian Ocean Coastal Belt');
  assert.deepEqual(climates, ['subtropical']);
  for (const id of ['tree_guava', 'tree_apple', 'tree_pear', 'tree_plum', 'tree_pomegranate', 'tree_olive']) {
    assert.equal(elementVisibleInPalette(ELEMENTS_BY_ID[id], climates), false, `${id} should not be offered on this subtropical site`);
  }
  for (const id of ['tree_mango', 'tree_avocado', 'tree_macadamia', 'tree_litchi', 'tree_natal_plum', 'tree_wild_plum', 'tree_waterberry', 'tree_other']) {
    assert.equal(elementVisibleInPalette(ELEMENTS_BY_ID[id], climates), true, `${id} should be available on this subtropical site`);
  }
});

// The regression Rory reported directly: "the farmer places a Banana Circle from the Planting step,
// then finds it on sheet 04 Water & Irrigation, not on 05 Planting & Agroforestry."
//
// The Earthworks sheet split (05, docs/PLAN-SET-SPEC.md) moved half_moon, berm and terrace off
// Water onto the new dedicated Earthworks sheet — land-shaping only, per Rory's call ("is this
// traditional for permaculture to have a separate layer" — it is: contour, level, cut and fill,
// built first, different plant from irrigation). greywater_basin and infiltration_basin STAY on
// Water: a farmer reads them as the end of a water run, not as civil works.
test('earth-shaped beds are planting, integrated basins belong on Water, and land-shaping earthworks belong on Earthworks', () => {
  for (const id of ['banana_circle', 'tree_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'planting', `${id} should be on the Planting sheet`);
    assert.equal(itemInFilter(def!.category, 'water', id), true, `${id} is also factual Water content`);
    assert.equal(itemInFilter(def!.category, 'planting', id), true, `${id} must remain Planting content`);
  }
  for (const id of ['raised_bed', 'keyhole_bed', 'herb_spiral']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(sheetForElement(def.category, id), 'planting', `${id} should be on the Planting sheet`);
    assert.equal(itemInFilter(def.category, 'water', id), false, `${id} stays Water context, not content`);
  }
});

// A bed that PRINTS on the Planting sheet but cannot be PLACED from the Planting step is a farmer
// staring at beds on their finished planting plan with no chip to add one (Rory, testing live: "no
// raised beds in here!"). alsoSteps is the mechanism — Banana Circle already used it — and
// ownedByCurrentStep honours it, so editing rights follow placement rather than dimming the bed on
// the very step that drew it.
test('every earth-shaped bed that prints on Planting can also be placed and edited from that step', () => {
  for (const id of ['raised_bed', 'keyhole_bed', 'herb_spiral', 'banana_circle', 'tree_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(sheetForElement(def.category, id), 'planting', `${id} prints on Planting`);
    assert.ok(def.alsoSteps?.includes('planting'), `${id} must be offered from the Planting palette`);
    assert.equal(
      ownedByCurrentStep('planting', { kind: 'item', category: def.category, defId: id }),
      true,
      `${id} must stay editable on the step that placed it`,
    );
    // Still owned by its earthworks home, so nothing is taken away from Water/Earthworks.
    assert.equal(
      ownedByCurrentStep('earthworks', { kind: 'item', category: def.category, defId: id }),
      true,
      `${id} must remain editable from Earthworks too`,
    );
  }
  for (const id of ['greywater_basin', 'infiltration_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'water', `${id} reads as the end of a water run and belongs on Water`);
  }
  for (const id of ['half_moon', 'berm', 'terrace']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'earthworks', `${id} is land-shaping and belongs on the Earthworks sheet, not Water`);
  }
});

test('the zones sheet carries zones and no elements or lines', () => {
  assert.ok(zonesInFilter('zones'));
  for (const def of ELEMENT_CATALOG) {
    assert.equal(itemInFilter(def.category, 'zones', def.id), false, `${def.id} leaked onto the Zones sheet`);
  }
  for (const kind of LINE_KINDS) assert.equal(lineInFilter(kind, 'zones'), false, `${kind} leaked onto the Zones sheet`);
});

test('only the whole-design and zones sheets carry zone bands', () => {
  assert.deepEqual(
    (['all', 'water', 'zones', 'planting', 'structures'] as GlossyLayerFilter[]).filter(zonesInFilter),
    ['all', 'zones'],
  );
});

test('sheetForElement is total over the catalog — no element falls through to null', () => {
  const unmapped = ELEMENT_CATALOG.filter((d) => sheetForElement(d.category, d.id) === null);
  assert.deepEqual(unmapped.map((d) => `${d.id} (${d.category})`), []);
});

// ── Context elements: shown so a sheet reads, never counted as its content ────
// Rory on the Water sheet: "no driveway no beds no tree basins no veg bed drip irrigation!!!".
// The beds and basins moved to Planting (correctly — that is where a farmer counts them), but a
// water plan whose drip lines run to nothing is unreadable.
import { isContextElement } from '../lib/glossy-filters.ts';

test('the Water sheet SHOWS the beds and basins its irrigation feeds', () => {
  for (const id of ['raised_bed', 'keyhole_bed', 'herb_spiral']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.ok(isContextElement(def, 'water'), `${id} must be visible on the Water sheet`);
    // ...but is still not water CONTENT: it gets no water legend row, and Planting counts it.
    assert.equal(itemInFilter(def.category, 'water', def.id), false, `${id} must not be water content`);
    assert.equal(itemInFilter(def.category, 'planting', def.id), true, `${id} is Planting content`);
  }
});

test('integrated Water and Planting content is never demoted to Water context', () => {
  for (const id of ['banana_circle', 'tree_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(itemInFilter(def.category, 'water', def.id), true, `${id} should be Water content`);
    assert.equal(itemInFilter(def.category, 'planting', def.id), true, `${id} should be Planting content`);
    assert.equal(isContextElement(def, 'water'), false, `${id} must not be drawn twice as context and content`);
  }
});

test('Vetiver Bank belongs to Planting and Whole, not the Water sheet', () => {
  const def = ELEMENT_CATALOG.find((d) => d.id === 'mulch_bank')!;
  assert.equal(itemInFilter(def.category, 'water', def.id), false);
  assert.equal(isContextElement(def, 'water'), false);
  assert.equal(itemInFilter(def.category, 'planting', def.id), true);
  assert.equal(itemInFilter(def.category, 'all', def.id), true);
});

test('context is a Water-sheet concept only, and never applies to a sheet own content', () => {
  const bed = ELEMENT_CATALOG.find((d) => d.id === 'raised_bed')!;
  for (const f of ['all', 'zones', 'planting', 'structures'] as const) {
    assert.equal(isContextElement(bed, f), false, `${f} must not borrow context elements`);
  }
  // A tank is water CONTENT — it must never be demoted to context on its own sheet.
  const tank = ELEMENT_CATALOG.find((d) => d.category === 'water')!;
  assert.equal(isContextElement(tank, 'water'), false);
});

// Only planting beds that help a route read stay as quiet Water context. Integrated sinks and
// banks are exact, named Water content and must never pass through the context path as well.
test('Water context contains only non-Water planting fixtures', () => {
  const contextIds = ELEMENT_CATALOG.filter((d) => isContextElement(d, 'water')).map((d) => d.id);
  assert.ok(contextIds.includes('raised_bed'), 'guard: Water still needs a served-bed context fixture');
  for (const id of contextIds) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(itemInFilter(def.category, 'water', def.id), false, `${id} cannot be content and context`);
    assert.equal(sheetForElement(def.category, def.id), 'planting', `${id} context must come from Planting`);
  }
  for (const id of ['banana_circle', 'tree_basin']) {
    assert.equal(contextIds.includes(id), false, `${id} is named Water content, not quiet context`);
  }
  assert.equal(contextIds.includes('mulch_bank'), false, 'Vetiver Bank is absent from Water, not borrowed context');
});

// ── Greywater ────────────────────────────────────────────────────────────────
// Rory: "also no greywater?" It was not a render bug — LineShape.kind had no 'greywater' member, so
// a farmer had no tool to draw the run at all, while the water prompt described a violet greywater
// line in detail. The only way the model could satisfy that was to invent one.
test('a greywater run is a real line kind, and it belongs to the water sheet', () => {
  assert.equal(lineInFilter('greywater', 'water'), true);
  for (const f of ['planting', 'structures', 'zones'] as const) {
    assert.equal(lineInFilter('greywater', f), false, `greywater must not appear on ${f}`);
  }
  assert.equal(lineInFilter('greywater', 'all'), true, 'the masterplan carries everything');
});

test('every routed line has deterministic cartography, and no unrouted line does', () => {
  // WAS "Water-sheet line". The invariant is unchanged in strength — a line kind must have a
  // deterministic route style if and only if it is drawn on a sheet that draws routes — but there
  // are TWO such sheets now. The swale kept its entry in the route table and moved sheets: it is
  // dug, not plumbed, so it prints on Earthworks (05) in cut-and-fill brown via
  // EARTHWORKS_ROUTE_STYLE instead of on Water in irrigation blue. Asserting against 'water'
  // alone would now force the wrong repair — deleting the swale's cartography — which is the exact
  // mistake a test like this exists to prevent.
  const ROUTE_SHEETS = ['water', 'earthworks'] as const;
  for (const kind of LINE_KINDS) {
    const routed = ROUTE_SHEETS.some((sheet) => lineInFilter(kind, sheet));
    assert.equal(Boolean(waterRouteStyleFor(kind)), routed, kind);
  }
});

test('every line kind still lands on exactly one layer sheet', () => {
  // Re-stated for the widened union: adding a kind must not silently orphan or double-file it.
  const KINDS = ['swale', 'fence', 'path', 'pipe', 'drip', 'windbreak', 'greywater'] as const;
  for (const kind of KINDS) {
    const on = (['water', 'earthworks', 'planting', 'structures'] as const).filter((f) => lineInFilter(kind, f));
    assert.equal(on.length, 1, `${kind} is on ${on.length} sheets (${on.join('+') || 'none'})`);
  }
});

// ── groundRegister: the single authority for content/context/absent, EARTHWORKS-CONTEXT-PLAN
// Phase 2. Before this there were three hand-rolled copies (producer-prompt.ts's fabricIsContent,
// drawBlueprintGround's alpha choice, groundRows' legend gate) and none of them was in charge —
// table-driven over the full GroundFeatureKind × GlossyLayerFilter matrix so a kind or a sheet
// added later cannot silently fall through un-tested, the exact gap that let
// itemInFilter(_, 'zones') ship broken (see this file's header comment).
const GROUND_KINDS: GroundFeatureKind[] = ['house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared', 'boundary'];
const ALL_SHEETS: GlossyLayerFilter[] = ['all', 'water', 'zones', 'planting', 'structures'];

test('groundRegister: the boundary is ABSENT everywhere — it is a drawn line, never a ground wash', () => {
  for (const filter of ALL_SHEETS) {
    assert.equal(groundRegister('boundary', filter), 'absent', `boundary must be absent on ${filter}`);
  }
});

// Three ground kinds are now deliberate exceptions to the plain content/context rule, each after
// a repeated report on real sheets. They are listed once, here, so the two table tests below stay
// readable and so the reason travels with the exception:
//
//   staple_garden — DESIGNED planting, not site fabric. Content only where planting is the
//     subject; absent elsewhere, because a crop that has not been planted yet reads as a fact
//     about the ground on an analysis sheet. ("why is staple gardens polygons in here?")
//   patio, cleared — hard standing. A site RECORD: it belongs on sheet 01, which does not consult
//     this predicate at all (see existingSiteGroundRings + drawBlueprintGround's siteRecord flag).
//     On a design sheet it is a big pale polygon carrying no decision. ("get rid of this stubborn
//     slab polygon", "stray polygons again here, please remove the slab")
const SHEET_ABSENT_GROUND_KINDS = new Set(['staple_garden', 'patio', 'cleared']);

test('groundRegister: every other ground kind is CONTENT on the whole-design, Planting and Structures sheets', () => {
  for (const kind of GROUND_KINDS) {
    if (kind === 'boundary' || SHEET_ABSENT_GROUND_KINDS.has(kind)) continue;
    for (const filter of ['all', 'planting', 'structures'] as const) {
      assert.equal(groundRegister(kind, filter), 'content', `${kind} should be content on ${filter}`);
    }
  }
});

test('groundRegister: every other ground kind is CONTEXT (orientation only) on Water and Zones', () => {
  for (const kind of GROUND_KINDS) {
    if (kind === 'boundary' || SHEET_ABSENT_GROUND_KINDS.has(kind)) continue;
    for (const filter of ['water', 'zones'] as const) {
      assert.equal(groundRegister(kind, filter), 'context', `${kind} should be context on ${filter}`);
    }
  }
});

test('groundRegister: the staple garden and hard standing stay off the sheets they are noise on', () => {
  for (const filter of ['water', 'zones', 'earthworks', 'structures'] as const) {
    assert.equal(groundRegister('staple_garden', filter), 'absent', `staple garden on ${filter}`);
  }
  for (const filter of ['all', 'planting'] as const) {
    assert.equal(groundRegister('staple_garden', filter), 'content', `staple garden on ${filter}`);
  }
  for (const kind of ['patio', 'cleared'] as const) {
    for (const filter of ALL_SHEETS) {
      assert.equal(groundRegister(kind, filter), 'absent', `${kind} on ${filter}`);
    }
  }
});

test('groundRegister: full table has no gaps — every kind × sheet combination resolves', () => {
  for (const kind of GROUND_KINDS) {
    for (const filter of ALL_SHEETS) {
      const register = groundRegister(kind, filter);
      assert.ok(
        register === 'content' || register === 'context' || register === 'absent',
        `${kind} on ${filter} produced an unrecognised register: ${register}`,
      );
    }
  }
});

test('ground labels and legends share one content-only selector across every sheet', () => {
  const state = fixtureState('orchard');
  for (const filter of ALL_SHEETS) {
    const selected = groundContentRingsForSheet(state, EMPTY_REF, filter);
    const expected = groundRegister('orchard', filter) === 'content' ? ['g1'] : [];
    assert.deepEqual(
      selected.map((ring) => ring.id),
      expected,
      `${filter}: traced orchard selection disagrees with groundRegister`,
    );
  }
});

test('dedicated house and driveway geometry prevents duplicate ground captions and legend rows', () => {
  const house = fixtureState('house');
  const driveway = fixtureState('driveway');
  const coveredHouse = { ...EMPTY_REF, house: [[0, 0], [1, 0], [1, 1]] as Array<[number, number]> };
  const coveredDriveway = { ...EMPTY_REF, driveway: [[0, 0], [1, 1]] as Array<[number, number]> };

  assert.deepEqual(groundContentRingsForSheet(house, coveredHouse, 'all'), []);
  assert.deepEqual(groundContentRingsForSheet(driveway, coveredDriveway, 'all'), []);
  assert.equal(groundContentRingsForSheet(house, EMPTY_REF, 'all').length, 1);
  assert.equal(groundContentRingsForSheet(driveway, EMPTY_REF, 'all').length, 1);
});

// ── layerContentCount: the CRITICAL visible consequence of the register — a design that is only
// traced ground (no trees, no beds placed yet) must count as real content on a sheet where ground
// is CONTENT (Planting), and must NOT manufacture a Water or Zones sheet out of context-only
// ground the farmer never actually designed for water or zones.
function fixtureState(feature: GroundFeatureKind): DesignCanvasState {
  const ring: ZoneShape = { id: 'g1', zone: 0, points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4]], feature };
  return {
    siteId: 'test-site',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 640, imgH: 640, mPerPx: 0.1 },
    items: [],
    zones: [ring],
    lines: [],
    step: 'review',
    updatedAt: new Date().toISOString(),
  };
}
const EMPTY_REF: MapRefLayers = { boundary: [], house: [], driveway: [] };

test('layerContentCount: a traced orchard with nothing else placed IS content on Planting', () => {
  const state = fixtureState('orchard');
  assert.equal(layerContentCount(state, EMPTY_REF, 'planting'), 1);
});

test('layerContentCount: the same traced orchard is NOT content on Water or Zones — context never inflates the gate', () => {
  const state = fixtureState('orchard');
  assert.equal(layerContentCount(state, EMPTY_REF, 'water'), 0);
  assert.equal(layerContentCount(state, EMPTY_REF, 'zones'), 0);
});

test('layerContentCount: a traced boundary ring never counts as ground content on any sheet', () => {
  // EMPTY_REF.boundary is deliberately empty too, so the separate main-map boundary bonus on
  // 'all' (layerContentCount's own `+1`) cannot mask a leak from the ZoneShape boundary ring.
  const state = fixtureState('boundary');
  for (const filter of ALL_SHEETS) {
    assert.equal(layerContentCount(state, EMPTY_REF, filter), 0, `boundary ring leaked into ${filter}'s count`);
  }
});

// ── Zone ownership: staple_garden is DESIGNED on Planting, not recorded on Base ─────────────────
//
// Every other ground-feature ring (house, patio, lawn, veg_garden, orchard, cleared, terrace_bank)
// is "what's already here" — traced once on the Base step, then read-only context everywhere else.
// staple_garden is the one feature a farmer places as part of the DESIGN, from its own chip on the
// Planting step. Before this fix, ownedByCurrentStep's zone case answered `feature ? 'base' : ...`
// for every feature uniformly, so a staple garden drawn on Planting rendered dimmed and
// non-interactive on the very step that placed it — same bug class this function's own comments
// already document for raised beds and Banana Circles (adversarial review, 2026-07-21), now
// reproduced for a zone rather than an item. Rory hit it live: a washed-out, barely-legible ring
// right after placing it.

test('staple_garden is owned by the Planting step, not Base', () => {
  assert.equal(ownedByCurrentStep('planting', { kind: 'zone', feature: 'staple_garden' }), true);
  assert.equal(ownedByCurrentStep('base', { kind: 'zone', feature: 'staple_garden' }), false);
  assert.equal(ownedByCurrentStep('water', { kind: 'zone', feature: 'staple_garden' }), false);
  assert.equal(ownedByCurrentStep('structures', { kind: 'zone', feature: 'staple_garden' }), false);
});

test('every OTHER ground feature stays Base-owned — the staple_garden fix must not widen to the whole kind', () => {
  const recordedOnSite: GroundFeatureKind[] = ['house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared', 'terrace_bank'];
  for (const feature of recordedOnSite) {
    assert.equal(ownedByCurrentStep('base', { kind: 'zone', feature }), true, `${feature} must stay Base-owned`);
    assert.equal(ownedByCurrentStep('planting', { kind: 'zone', feature }), false, `${feature} must not become Planting-owned`);
  }
});

// ── The LAYER-VISIBILITY twin of the ownership answer above ─────────────────────────────────────
//
// Two systems ask "whose ring is this": the wizard step (ownedByCurrentStep, above) and the Layers
// panel (groundFeatureLayer). The staple_garden fix landed in the first and not the second, so the
// polygons were interactive on Planting but answered the EXISTING switch — turning Planting off
// left the maize standing next to hidden beds and trees. Rory: "strange staple crop polygons are
// not connected to the plant layer". These two tests are deliberately adjacent to the ownership
// pair above so the next feature added to GroundFeatureKind has to answer both questions at once.

test('staple_garden rides the Planting layer switch, every other ground feature rides Existing', () => {
  assert.equal(groundFeatureLayer('staple_garden'), 'planting');
  const recordedOnSite: GroundFeatureKind[] = ['house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared', 'terrace_bank', 'boundary'];
  for (const feature of recordedOnSite) {
    assert.equal(groundFeatureLayer(feature), 'ground', `${feature} must stay on the Existing switch`);
  }
});

test('the layer switch and the owning step agree for every ground feature', () => {
  const features: GroundFeatureKind[] = ['house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared', 'terrace_bank', 'boundary', 'staple_garden'];
  for (const feature of features) {
    // A ring the Planting step owns must be switched by Planting; a ring Base owns must be
    // switched by Existing. Disagreement is the shape of the bug this pair exists to catch.
    const step = ownedByCurrentStep('planting', { kind: 'zone', feature }) ? 'planting' : 'ground';
    assert.equal(groundFeatureLayer(feature), step, `${feature}: layer switch and owning step disagree`);
  }
});

// Items and lines have the same two answers as ground rings: who may edit the saved shape, and
// which layer switch must be on for that shape's layer. Keep the focus table here in the same
// shape as app/design/page.tsx's applyStepFocus so a new step or layer cannot silently create a
// place-then-vanish item. Water intentionally keeps Earthworks ON because its palette still offers
// earthworks and the swale checklist is shared; the swale's actual editable owner is Earthworks.
test('every owned item and line has its semantic layer focused on by that owner step', () => {
  const steps = ['water', 'earthworks', 'planting', 'structures'] as const;
  const focusedLayers: Record<(typeof steps)[number], readonly GlossyLayerFilter[]> = {
    water: ['water', 'earthworks'],
    earthworks: ['earthworks'],
    planting: ['planting', 'earthworks'],
    structures: ['structures'],
  };
  const categoryLayer: Record<string, GlossyLayerFilter> = {
    water: 'water',
    earthworks: 'earthworks',
    growing: 'planting',
    structure: 'structures',
    animal: 'structures',
    access: 'structures',
  };

  for (const def of ELEMENT_CATALOG) {
    const layer = categoryLayer[def.category];
    assert.ok(layer, `${def.id} has no semantic layer in the agreement test`);
    for (const step of steps) {
      if (!ownedByCurrentStep(step, { kind: 'item', category: def.category, defId: def.id })) continue;
      assert.ok(focusedLayers[step].includes(layer), `${def.id}: ${step} owns an item on an off layer`);
    }
  }

  const kinds = ['swale', 'fence', 'path', 'bedpath', 'pipe', 'drip', 'windbreak', 'greywater'] as const;
  for (const kind of kinds) {
    const layer = (['water', 'earthworks', 'planting', 'structures'] as const)
      .find((candidate) => lineInFilter(kind, candidate));
    if (!layer) assert.fail(`${kind} has no semantic layer in the agreement test`);
    const owners = steps.filter((step) => ownedByCurrentStep(step, { kind: 'line', lineKind: kind }));
    assert.ok(owners.length > 0, `${kind} has no editing owner`);
    for (const step of owners) {
      assert.ok(focusedLayers[step].includes(layer), `${kind}: ${step} owns a line on an off layer`);
    }
  }
});

test('a plain effort-zone (no feature) is still owned only by the Zones step', () => {
  assert.equal(ownedByCurrentStep('zones', { kind: 'zone' }), true);
  assert.equal(ownedByCurrentStep('base', { kind: 'zone' }), false);
  assert.equal(ownedByCurrentStep('planting', { kind: 'zone' }), false);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EXISTING vs PROPOSED IN THE LEGEND
//
// `statusOf` had zero callers anywhere in the repo: a farmer could mark their standing tank as
// existing and the plan set listed it beside the ones they are asking a funder to buy, with
// nothing to tell them apart. The single most important thing a plan says is which parts of it do
// not exist yet, so a legend that cannot say it overstates the proposal on every sheet.
import { exactSheetElementLegendGroups } from '../lib/glossy-filters.ts';
import { countedLegendText } from '../lib/sheet-legend-layout.ts';

const legendState = (items: PlacedItem[]): DesignCanvasState =>
  ({ siteId: 's', items, lines: [], zones: [] }) as unknown as DesignCanvasState;

test('a row is split when the same thing is part standing and part proposed', () => {
  const tank = ELEMENT_CATALOG.find((def) => def.category === 'water')!;
  const groups = exactSheetElementLegendGroups(
    legendState([
      { id: 'a', defId: tank.id, x: 0.2, y: 0.2, status: 'existing' },
      { id: 'b', defId: tank.id, x: 0.3, y: 0.3, status: 'existing' },
      { id: 'c', defId: tank.id, x: 0.4, y: 0.4, status: 'proposed' },
    ]),
    'water',
  ).filter((group) => group.defId === tank.id);

  assert.equal(groups.length, 2, 'three tanks, two of them already standing, is not one row of four');
  const proposed = groups.find((group) => group.status === 'proposed')!;
  const existing = groups.find((group) => group.status === 'existing')!;
  assert.equal(proposed.count, 1);
  assert.equal(existing.count, 2);
  // Proposed first: a plan is read to find out what is being asked for.
  assert.equal(groups[0].status, 'proposed');
});

test('an all-proposed inventory is unchanged — one row, no qualifier', () => {
  const tank = ELEMENT_CATALOG.find((def) => def.category === 'water')!;
  const groups = exactSheetElementLegendGroups(
    legendState([
      { id: 'a', defId: tank.id, x: 0.2, y: 0.2, status: 'proposed' },
      { id: 'b', defId: tank.id, x: 0.3, y: 0.3, status: 'proposed' },
    ]),
    'water',
  ).filter((group) => group.defId === tank.id);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
  assert.equal(countedLegendText(groups[0].text, groups[0].count, groups[0].status), `${tank.name} ×2`);
});

test('only "existing" is spelled out, because the sheet is already a proposal', () => {
  assert.equal(countedLegendText('JoJo Tank', 3, 'proposed'), 'JoJo Tank ×3');
  assert.equal(countedLegendText('JoJo Tank', 3), 'JoJo Tank ×3');
  assert.equal(countedLegendText('JoJo Tank', 3, 'existing'), 'JoJo Tank (existing) ×3');
});

test('an item with no saved status still lands in a group', () => {
  // Every design saved before this field existed. statusOf resolves it rather than dropping it,
  // and a dropped item would be a mark on the map with no legend row.
  const tank = ELEMENT_CATALOG.find((def) => def.category === 'water')!;
  const groups = exactSheetElementLegendGroups(
    legendState([{ id: 'a', defId: tank.id, x: 0.2, y: 0.2 }]),
    'water',
  ).filter((group) => group.defId === tank.id);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 1);
  assert.ok(groups[0].status === 'proposed' || groups[0].status === 'existing');
});

test('a swale is owned by Earthworks alone, but shows as context on the Water sheet', () => {
  // THE INVARIANT THAT MUST NOT MOVE. An earlier attempt at showing swales on sheet 04 simply
  // added 'swale' to lineInFilter's water case and broke four tests enforcing "no line kind is
  // owned by two steps" — which is what makes Design Studio step focus mean anything.
  assert.equal(lineInFilter('swale', 'earthworks'), true);
  assert.equal(lineInFilter('swale', 'water'), false, 'ownership must stay with Earthworks');

  // The register answers the second, different question: should this sheet SHOW it.
  assert.equal(exactSheetLineRegister('swale', 'earthworks'), 'content');
  assert.equal(exactSheetLineRegister('swale', 'water'), 'context');
  assert.equal(exactSheetLineRegister('pipe', 'water'), 'content');
  assert.equal(exactSheetLineRegister('pipe', 'earthworks'), 'absent');

  // Context sits below full strength, which is precisely what frees it of a legend row — the rule
  // that made the earlier attempt unshippable.
  assert.ok(EXACT_CONTEXT_ALPHA.water < EXACT_FULL_STRENGTH_ALPHA);
});

test('a stated swale keeps its width wherever the exact sheets draw it', () => {
  // The Water sheet does not own a swale, but it does draw it as the destination of its flow
  // arrows. When the farmer has stated its width, hiding that fact there turns the only earthwork
  // on the water-reading sheet back into an unlabelled band. The unowned status stays context;
  // the printed measurement does not turn it into plumbing or a recommended dimension.
  const state = {
    lines: [
      { id: 'swale-1', kind: 'swale' as const, widthM: 1.5, points: [[0.1, 0.2], [0.8, 0.25]] as Array<[number, number]> },
      { id: 'pipe-1', kind: 'pipe' as const, points: [[0.2, 0.3], [0.6, 0.4]] as Array<[number, number]> },
    ],
  };
  for (const sheet of ['water', 'earthworks'] as const) {
    const row = exactSheetLineLegendGroups(state, sheet).find((group) => group.lineKind === 'swale');
    assert.equal(row?.text.endsWith('— 1.5 m wide'), true, `${sheet} carries the farmer's stated width`);
  }
  assert.ok(exactSheetLineLegendGroups(state, 'water').some((group) => group.lineKind === 'pipe'));

  const unstated = { lines: [{ ...state.lines[0], widthM: undefined }] };
  for (const sheet of ['water', 'earthworks'] as const) {
    const row = exactSheetLineLegendGroups(unstated, sheet).find((group) => group.lineKind === 'swale');
    assert.ok(row, `${sheet} still keys an unstated swale`);
    assert.equal(row!.text.includes('wide'), false, `${sheet} does not invent a width`);
  }
});
