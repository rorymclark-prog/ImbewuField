// Design Studio — per-layer glossy filter helpers, extracted VERBATIM out of
// components/design/DesignGlossy.tsx so the pure layer-membership logic is unit-testable
// without pulling in the whole (5,000+ line) React component. Comments preserved as-is.

import type { DesignCanvasState, GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import { CATEGORY_STEP, ELEMENTS_BY_ID, type ElementCategory } from '@/lib/design-elements';
import type { MapRefLayers } from '@/lib/base-layers';

// Per-layer glossy: 'all' = the whole design; the others render just one theme (with the
// base map + ground context always kept so the picture is legible). Only the drawn marks in
// the chosen layer are locked; everything else is repainted as background.
export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures';

// NOTE: 'earthworks' is deliberately NOT its own glossy/print layer — it folds into 'water'.
// A GlossyLayerFilter is not just a UI filter: FILTER_TO_LAYER below maps it to the API's
// RenderLayer union ('overall'|'base'|'sector'|'zone'|'water'|'opportunity'|'planting'|
// 'implementation'), which has no earthworks theme, and an unmapped filter falls through to the
// full-design theme — the exact bug that made the AI invent ponds and orchards on a layer map.
// Folding into 'water' is also the honest reading: earthworks IS the water layer's land-shaping
// (basins, berms and banana circles are how water is slowed, spread and sunk), and the water
// theme's blue-green "water plan" wash suits them. 'structures' already folds to 'overall' the
// same way. Adding a real earthworks layer means an API-side RenderLayer + layerTheme prompt
// block first — see docs/DESIGN-TAXONOMY.md.
// PER-ELEMENT OVERRIDES, because filing by CATEGORY is the wrong grain. 'earthworks' is a build
// category — how the ground is shaped — and it mixes two things a farmer reads on different sheets:
// water-shaping (swale berms, infiltration and greywater basins, contour berms) and PLANTING beds
// that merely happen to be earth-shaped. Filing the whole category under 'water' put a farmer's
// raised beds, keyhole bed, herb spiral, banana circles and tree basins on the WATER PLAN and left
// them off the PLANTING PLAN entirely — he placed a banana circle from the Planting step and then
// could not find it on the planting sheet.
//
// overlayElementsText already knew this and patched it downstream with a SECTION_BY_ID table, which
// changed the legend HEADING but not which sheet the element was drawn on — hence a sheet titled
// WATER PLAN carrying a legend section headed PLANTING. This is that same knowledge applied one
// level up, where it decides the sheet instead of the caption.
// These five are the whole of it: every OTHER earthworks element (greywater_basin,
// infiltration_basin, half_moon, berm, terrace) really is water-shaping and correctly stays on the
// Water sheet. Vetiver Bank needs no entry — it is already category 'growing'.
const SHEET_OVERRIDE: Record<string, GlossyLayerFilter> = {
  banana_circle: 'planting',
  tree_basin: 'planting',
  raised_bed: 'planting',
  keyhole_bed: 'planting',
  herb_spiral: 'planting',
};

/** Which single layer sheet an element belongs on. Exported so a test can assert the whole catalog
 *  lands on exactly one sheet — the guard this module's own header claimed to exist and did not. */
export function sheetForElement(category: string, defId?: string): Exclude<GlossyLayerFilter, 'all' | 'zones'> | null {
  if (defId && SHEET_OVERRIDE[defId]) return SHEET_OVERRIDE[defId] as Exclude<GlossyLayerFilter, 'all' | 'zones'>;
  switch (category) {
    case 'water':
    case 'earthworks':
      return 'water';
    case 'growing':
      return 'planting';
    case 'structure':
    case 'animal':
    case 'access':
      return 'structures';
    default:
      return null;
  }
}

/** Does this element belong on `filter` as CONTEXT — shown so the sheet reads, never counted as its
 *  content? Only Water needs it: irrigation lines mean nothing without the beds and basins they
 *  water, and those live on the Planting sheet. Kept here beside sheetForElement so the membership
 *  rules stay in one file. */
export function isContextElement(
  def: { category: string; id: string; name: string },
  filter: GlossyLayerFilter,
): boolean {
  if (filter !== 'water') return false;
  if (sheetForElement(def.category, def.id) !== 'planting') return false;
  return /bed|basin|circle|spiral/i.test(def.name);
}

export function itemInFilter(category: string, filter: GlossyLayerFilter, defId?: string): boolean {
  if (filter === 'all') return true;
  // Zones carries no elements — the effort-zone bands are its entire content.
  if (filter === 'zones') return false;
  return sheetForElement(category, defId) === filter;
}

export function lineInFilter(kind: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return kind === 'swale' || kind === 'pipe' || kind === 'drip' || kind === 'greywater';
    case 'planting':
      return kind === 'windbreak'; // a windbreak is a planted row → Planting sheet, not Structures
    case 'structures':
      return kind === 'fence' || kind === 'path';
    default:
      return false;
  }
}

export function zonesInFilter(filter: GlossyLayerFilter): boolean {
  return filter === 'all' || filter === 'zones';
}

export type GroundRegister = 'content' | 'context' | 'absent';

/** THE single authority for where a traced GROUND feature — house, patio, driveway, lawn,
 *  veg_garden, orchard, cleared, or boundary — sits on a given sheet. Before this there were
 *  THREE hand-rolled copies of the same idea, none of them in charge and none agreeing with the
 *  others: producer-prompt.ts's `fabricIsContent` ternary (caption+legend wording for the AI
 *  path), drawBlueprintGround's fill (which took no `filter` at all, so an orchard wash painted
 *  at the IDENTICAL alpha on the Water sheet as on Planting — a "context register" with no
 *  visual difference), and groundRows' legend-row gate (decided ad hoc by which sheets bothered
 *  to call it). All three, plus layerContentCount below, now defer to this.
 *
 *  - 'content': this sheet's own subject — captioned (AI path), legended and counted
 *    (layerContentCount), drawn at full strength. Whole-design, Planting and Structures read as
 *    "what's really there", so a farmer's traced orchard or veg garden belongs beside his placed
 *    trees and beds — and a design that is ONLY that traced ground, no trees placed yet, still has
 *    real content and must not be refused.
 *  - 'context': drawn quieter so the sheet still orients (a Water plan needs the paving a pipe
 *    runs under; a Zones plan needs the yard the effort-zones are measured from) but never
 *    captioned, never legended, and never counted — an orchard traced for context must not
 *    entitle a farmer to a Water or Zones sheet he has not actually drawn.
 *  - 'absent': the boundary only. It is drawn as a dedicated LINE (drawBlueprintBoundary on the
 *    exact path, rule 9's fence description on the AI path), never as a ground-fill wash, on
 *    every sheet — so it has no content/context register of its own to pick. */
export function groundRegister(kind: GroundFeatureKind, filter: GlossyLayerFilter): GroundRegister {
  if (kind === 'boundary') return 'absent';
  return filter === 'all' || filter === 'planting' || filter === 'structures' ? 'content' : 'context';
}

// How many REAL things the farmer has drawn on this layer. A layer map with zero content is always
// wrong — either that layer hasn't been drawn yet, or something upstream dropped it. Either way we
// must never render it silently and let the AI invent the layer (Rory: "it should be retrieving my
// zones layer which is detailed — no guessing"). Callers refuse + explain instead.
export function layerContentCount(
  state: DesignCanvasState,
  refLayers: MapRefLayers,
  filter: GlossyLayerFilter,
): number {
  let n = 0;
  if (zonesInFilter(filter)) n += state.zones.filter((z) => !z.feature && z.points.length >= 3).length;
  n += state.items.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return !!def && itemInFilter(def.category, filter, def.id);
  }).length;
  n += state.lines.filter((l) => lineInFilter(l.kind, filter) && l.points.length >= 2).length;
  // Traced GROUND only counts here where groundRegister says it is this sheet's CONTENT — see
  // that function's doc for why the content/context/absent split matters in both directions.
  // groundRegister('boundary', filter) is always 'absent', so the boundary ring never double-
  // counts against the dedicated refLayers.boundary check below.
  n += state.zones.filter((z) => z.feature && z.points.length >= 3 && groundRegister(z.feature, filter) === 'content').length;
  // The whole-design map also stands up on the traced base alone.
  if (filter === 'all' && refLayers.boundary.length >= 3) n += 1;
  return n;
}

/** Which WIZARD STEP a canvas shape is interactively "owned" by — the answer DesignCanvas.tsx
 *  needs to "should pointer-down on this shape start editing it right now, or should it render
 *  as inert, read-only context for whatever the CURRENT step is actually drawing?" (Rory: "its
 *  very annoying when i am trying to draw the zones and i touch the boundary etc and its starts
 *  editing" — tapping near a boundary vertex while adjusting a zone on the Zones step grabbed
 *  the boundary instead, because nothing gated shapes by step at all, only by `tool`.)
 *
 *  Reuses this file's existing membership answers where the QUESTION actually matches —
 *  lineInFilter and the ground-feature-vs-plain-zone split both already answer "which step" —
 *  but items need CATEGORY_STEP (lib/design-elements.ts), NOT sheetForElement: sheetForElement
 *  answers "which OUTPUT SHEET does this print on", and SHEET_OVERRIDE deliberately makes that
 *  differ from "which step placed it" for a raised bed/keyhole bed/herb spiral/tree basin (all
 *  category 'earthworks', placed from the Water step, but printed on the Planting sheet). An
 *  earlier version of this function used sheetForElement for items and that conflation locked
 *  those four elements the instant they were placed, in the very step that placed them
 *  (adversarial review, 2026-07-21) — exactly the kind of drifted-second-copy bug this whole
 *  function exists to avoid, just one layer deeper than expected.
 *
 *  - A ground feature (a ZoneShape with `.feature` set — boundary/house/patio/…) belongs to
 *    'base', where the farmer traces it.
 *  - A zone ring with NO `.feature` (a plain permaculture effort-zone 0-5) belongs to 'zones'.
 *  - Lines follow lineInFilter against whichever of 'water'/'planting'/'structures' the current
 *    step is. Items follow CATEGORY_STEP the same way — the one place both this function and
 *    DesignPalette.tsx's categoriesForStep (which categories a step's palette even offers) read
 *    the category→step answer from, so the two can't silently disagree again.
 *  - 'sector' has no shapes of its own (it's a derived overlay, nothing is ever drawn there)
 *    and 'review'/'glossy' are read-only summary steps — every shape falls through every
 *    branch below and is foreign, so EVERYTHING renders locked. That's the deliberately safer
 *    (more locked) reading for an ambiguous case, not a special-cased default. */
export function ownedByCurrentStep(
  step: WizardStep,
  subject:
    | { kind: 'zone'; feature?: GroundFeatureKind }
    | { kind: 'line'; lineKind: LineShape['kind'] }
    | { kind: 'item'; category: string; defId?: string },
): boolean {
  switch (subject.kind) {
    case 'zone':
      return subject.feature ? step === 'base' : step === 'zones';
    case 'line':
      if (step !== 'water' && step !== 'planting' && step !== 'structures') return false;
      return lineInFilter(subject.lineKind, step);
    case 'item':
      if (step !== 'water' && step !== 'planting' && step !== 'structures') return false;
      // NOT sheetForElement — that answers "which OUTPUT SHEET does this print on", a different
      // question. A raised bed/keyhole bed/herb spiral/tree basin is category 'earthworks'
      // (placed from the Water step's palette) but SHEET_OVERRIDE'd onto the Planting sheet; an
      // earlier version of this function used sheetForElement here and it rendered those four
      // elements locked the instant they were placed, in the very step that placed them
      // (adversarial review, 2026-07-21). CATEGORY_STEP is the "which step placed/edits this"
      // answer, shared with DesignPalette.tsx's categoriesForStep so the two can't drift apart.
      return CATEGORY_STEP[subject.category as ElementCategory] === step;
  }
}
