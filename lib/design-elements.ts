// Design Studio — element catalog.
//
// Pure data module (no 'use client' needed, but harmless either way): every placeable
// item a farmer can drop onto the Design Studio canvas, at true real-world footprint
// scale (wM/hM in metres). Mirrors the conventions in lib/site-elements.ts (icon/color
// metadata keyed by a string id) but keeps its own storage-free catalog — this file
// has no localStorage of its own; placement state lives in lib/design-canvas.ts.

// Categories follow the permaculture Scale of Permanence (Yeomans / keyline), most-permanent
// first: Water → Earthworks → Access → Structures → Planting. See docs/DESIGN-TAXONOMY.md.
// 'earthworks' is the land-SHAPING layer that makes water and soil behave (raised beds, tree
// basins, banana-circle pits, berms, terraces); water INFRASTRUCTURE (tanks/taps/pipes/pumps)
// stays in 'water'. 'access' is paths/gates/driveway only — misc site furniture is 'structure'.
export type ElementCategory = 'water' | 'earthworks' | 'structure' | 'growing' | 'animal' | 'access';

export interface DesignElementDef {
  id: string;
  category: ElementCategory;
  name: string;
  icon: string; // emoji
  /** Optional hand-drawn tile artwork, served from public/elements/. The emoji remains the
   * fallback so adding this display seam cannot change an existing farmer's saved element. */
  art?: string;
  shape: 'circle' | 'rect'; // footprint drawn at true scale
  wM: number; // footprint metres (circle: wM = diameter, hM = wM)
  hM: number;
  color: string; // accent hex
  zoneRec: number[] | null; // recommended zones, e.g. [1,2]
  tip: string; // one-line placement tip shown on select
  castsShade?: boolean; // large canopy → southern-hemisphere shade rule
  needsSun?: boolean; // veg/beds → shade victim
  nearRoofM?: number; // should be within N metres of house/structure (tanks)
  nearHouseMaxM?: number; // daily-use max distance from house (herbs/veg)
  deprecated?: boolean; // kept for old saved maps, hidden from new-placement palettes
  deprecatedReason?: string;
  // Scientific name, where the common name is ambiguous or shared by more than one South African
  // species (e.g. "Wild Plum" means Harpephyllum caffrum on the coast and Pappea capensis in
  // drier bushveld — two different trees). Optional and additive: populate it where confusion is
  // a real risk (NEMBA status, climate suitability, farmer-facing course content all depend on
  // knowing which species is meant); leave it off generic/deliberately-unspecified entries like
  // 'Other Tree'.
  botanical?: string;
  // A TYPICAL capacity, for display on a palette card only — NEVER a number the app computes
  // with. Rory: "the rain barrel (also add litres size)".
  //
  // Deliberately kept OUT of `name`, because statedTankCapacityLitres parses litres from the
  // name, and that figure is summed into the storage-vs-harvest lines on the Water sheet and
  // into the report's site facts. That function's own comment states the rule this field exists
  // to respect: "'Rain Barrel' covers many real sizes, and pretending otherwise could make
  // inadequate storage look sufficient." Renaming the barrel to "Rain Barrel 200L" would have
  // told a farmer with a 100 L drum that their storage was adequate.
  //
  // So the string carries its own hedge and reaches nothing but the card.
  capacityNote?: string;
  // Extra wizard steps this element is offered on, beyond the ones its category implies. Some
  // elements are honestly two things at once — a banana circle is a planted crop AND a greywater
  // sink — and forcing them into one category hid them from the step where the farmer looks.
  alsoSteps?: Array<'water' | 'planting' | 'structures'>;
  /**
   * EXTRA LAYERS this element belongs to, beyond the one its category implies.
   *
   * Rory: "earthworks should auto show raised beds in brown earth (auto mirroring where we put the
   * raised beds in planting), same with swales — which brings me to another point, we need an
   * earthworks layer?" The layer exists. What did not exist is an element belonging to more than
   * ONE of them, and that is the whole of the problem: a raised bed IS a planting bed and IS a
   * built soil structure; a swale IS a water feature and IS a cut-and-fill earthwork. Forcing each
   * to pick one meant the Earthworks view showed an empty farm on a site full of earthworks.
   *
   * `alsoSteps` above is the same idea one level up — which STEP offers the element — and this is
   * deliberately separate from it: where you are OFFERED a thing and which views it SHOWS UP in are
   * different questions, and a swale you draw on the Water step must appear on Earthworks whether
   * or not Earthworks ever offers you the tool.
   *
   * Membership only. What each view DRAWS — brown earth and a cut-and-fill profile on Earthworks
   * versus a planted bed on Planting — is cartography, and belongs to each renderer.
   */
  alsoLayers?: DesignLayerKey[];
}

/**
 * The canonical layer-state contract. Element definitions name additional memberships here,
 * while the page, canvas, and palette all use the derived state type. Keeping those questions in
 * one type means a future layer cannot be saved under one name and silently read under another.
 */
export const DESIGN_LAYER_KEYS = [
  'water', 'earthworks', 'zones', 'planting', 'structures', 'access', 'animals',
  'ground', 'references', 'boundary', 'labels', 'symbols', 'contours', 'sector',
] as const;
export type DesignLayerKey = (typeof DESIGN_LAYER_KEYS)[number];
export type DesignLayerState = Record<DesignLayerKey, boolean>;

// A HEAT MAP, READ FROM THE CENTRE OUT (Rory: "zone colours are messed up — 0 should be red?
// then orange and so on"). Permaculture literature fixes no exact hexes, but every zone diagram
// is drawn as rings of decaying intensity — so the ramp must READ as one: hottest colour where
// the visits are (Zone 0, the house), cooling steadily to the wild edge. The old ramp broke that
// story at its very first step: 0 was charcoal, so the centre of the heat map was its coldest-
// looking ring and red arrived at 1. Same muted app tones as before, shifted one ring inward;
// only 3's yellow-green is a new tone (in-family, between 2's amber and 4's green). The numeral
// badge always rides on the ring, so identity never rests on colour alone.
// THEN THE HEAT MAP LOST TO LEGIBILITY, on Rory's own rendered zone sheet: "i cant easily tell
// the zones by the colour ... red orange yellow green blue and purple?" He is right, and the
// reason is that the ramp above was a ramp — 2 amber, 3 yellow-green and 4 green are ADJACENT
// hues, deliberately so, and adjacent muted hues laid at 24% over a green-and-red-soil aerial
// photograph are not separable. A decaying-intensity story only survives on white paper.
//
// This is a full-spectrum categorical scale instead: six hues spread right around the wheel, so
// no two zones are neighbours in hue AND no two are close in lightness. Red still marks the hub,
// so the "hottest where you walk most" reading survives at the one end a farmer looks for first;
// past that, telling zone 3 from zone 4 at a glance beats narrating a gradient.
//
// Identity never rests on hue alone regardless: every ring carries its numeral badge, and the map
// fill is hatched to match its legend swatch (buildZoneOverlay) — so the sheet still works in
// greyscale, in print, and for a colourblind reader.
export const ZONE_COLORS: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: '#D02A2A',
  1: '#E67514',
  2: '#E0B517',
  3: '#3E9B32',
  4: '#2C6FD1',
  5: '#7B44C4',
};

// LABELS THAT FIT A CRÈCHE, A SCHOOL OR A COMMUNITY CENTRE, NOT JUST A FARMHOUSE.
//
// "House" was wrong for most of the sites this app is actually used on — Ubhejane is a crèche
// with a classroom, a storeroom and a slab, and its Zone 0 is an operations hub, not a dwelling
// (the same reason GROUND_FEATURES.house reads "House / Building"). Rory brought a fuller
// universal set to condense: the LABEL is what fits a picker chip, and `desc` carries the whole
// meaning wherever there is room for a line of text.
//
// The zone is set by HOW OFTEN PEOPLE VISIT AND MANAGE the ground, not by what happens to grow
// there — that principle is why these names describe intensity of use rather than crops, and
// each desc says it in the site's own terms. A site does not need every zone.
export const ZONE_KEY: Array<{ z: 0 | 1 | 2 | 3 | 4 | 5; label: string; desc: string }> = [
  { z: 0, label: 'Home & hub', desc: 'Home, centre or operations hub — house, classroom, office or training space' },
  { z: 1, label: 'Daily garden', desc: 'Intensive daily-use garden and nursery — tended every day, steps from the door' },
  { z: 2, label: 'Garden & orchard', desc: 'Market garden, orchard and perennial systems — visited several times a week' },
  { z: 3, label: 'Field crops', desc: 'Field and staple crops, extensive production — worked in seasons, not daily' },
  { z: 4, label: 'Woodland & grazing', desc: 'Managed woodland, grazing and biomass — harvested and checked now and then' },
  { z: 5, label: 'Natural habitat', desc: 'Natural habitat and conservation — left wild, observed rather than managed' },
];

// Which WIZARD STEP an element category is placed/edited from. Deliberately NOT the same
// question as sheetForElement (lib/glossy-filters.ts) — that answers which OUTPUT SHEET an
// element prints on, which the category-vs-override split makes genuinely different: a raised
// bed is category 'earthworks' (placed from the Water step's palette — see
// components/design/DesignPalette.tsx's categoriesForStep) but SHEET_OVERRIDE'd onto the
// Planting sheet, because a farmer expects to find his beds where he plants, not where he
// dug. Reusing sheetForElement to answer "which step can I edit this from" made a raised bed,
// keyhole bed, herb spiral or tree basin render LOCKED the instant it was placed — in the very
// Water step it was just placed from (adversarial review of the step-locking feature, 2026-07-21).
// categoriesForStep derives its per-step category lists from this map so the two can never drift
// apart again the way sheetForElement's SHEET_OVERRIDE and this once implicitly disagreed.
export const CATEGORY_STEP: Record<ElementCategory, 'water' | 'planting' | 'structures'> = {
  water: 'water',
  earthworks: 'water',
  growing: 'planting',
  structure: 'structures',
  animal: 'structures',
  access: 'structures',
};

export const CATEGORY_META: Record<ElementCategory, { label: string; icon: string }> = {
  water: { label: 'Water', icon: '💧' },
  earthworks: { label: 'Earthworks', icon: '⛏️' },
  structure: { label: 'Structures', icon: '🏚️' },
  growing: { label: 'Growing', icon: '🌱' },
  animal: { label: 'Animals', icon: '🐔' },
  // No longer "Access & Extras": the bench/sign/solar/washline extras moved to 'structure',
  // leaving access as paths, gates and the driveway only.
  access: { label: 'Access', icon: '🚪' },
};

// Reuse the app's zone palette (ZONE_COLORS above — the single source every surface imports):
// 0 red House, 1 orange Daily use, 2 amber Intensive, 3 yellow-green Orchard/food forest,
// 4 green Low-care, 5 teal Conservation/buffer.
export const ZONE_DEFS: Record<0 | 1 | 2 | 3 | 4 | 5, { label: string; color: string }> = {
  0: { label: ZONE_KEY[0].label, color: ZONE_COLORS[0] },
  1: { label: ZONE_KEY[1].label, color: ZONE_COLORS[1] },
  2: { label: ZONE_KEY[2].label, color: ZONE_COLORS[2] },
  3: { label: ZONE_KEY[3].label, color: ZONE_COLORS[3] },
  4: { label: ZONE_KEY[4].label, color: ZONE_COLORS[4] },
  5: { label: ZONE_KEY[5].label, color: ZONE_COLORS[5] },
};

import type { GroundFeatureKind } from '@/lib/design-canvas';

// Ground/built features the farmer draws to record WHAT IS THERE (house, paving, lawn,
// existing veg garden, orchard, cleared ground). Rendered as filled, labelled polygons —
// deliberately reading as solid ground, distinct from the dashed permaculture effort-zone
// rings. Colours: roof grey, light paving grey, soft lawn green, kitchen-green veg,
// deeper orchard green, neutral cleared.
export const GROUND_FEATURES: Record<GroundFeatureKind, { label: string; color: string; icon: string }> = {
  boundary: { label: 'Property boundary', color: '#8CEB6A', icon: '🚩' },
  // "House / Building" — not every site is a home. Rory, tracing the Ubhejane Crèche sample: a
  // classroom, storeroom and concrete slab all need this same footprint tool, and "House" reads
  // wrong on a school or any other non-residential structure. Same GroundFeatureKind, same
  // rendering everywhere — this is a label change only.
  house: { label: 'House / Building', color: '#8A8D91', icon: '🏠' },
  patio: { label: 'Patio / Paving', color: '#C7C3BB', icon: '▦' },
  driveway: { label: 'Driveway', color: '#12140F', icon: '🛣️' }, // near-black tar — see TAR in DesignGlossy; must NOT be slate, or the model reads it as a roof
  lawn: { label: 'Lawn', color: '#8FBF6B', icon: '🟩' },
  veg_garden: { label: 'Veg garden', color: '#4E8B3B', icon: '🥬' },
  orchard: { label: 'Orchard / food forest', color: '#2F7A4A', icon: '🌳' },
  cleared: { label: 'Cleared / other', color: '#B8AF9E', icon: '⬚' },
  // The household staple plot — field-scale grains, legumes and tubers that fill the storeroom:
  // maize, sorghum, groundnuts, amadumbe and the like, not just the one combination. Rory: "its not
  // just for maize and beans byt way it for many staple crops" — the LABEL had over-narrowed to one
  // example. The default AI illustration (see M.staple_garden / OVERLAY_ICONS.staple_garden in
  // lib/producer-prompt.ts) still paints maize with beans and pumpkin specifically, because that is
  // the single most common South African smallholder staple combination and a render needs one
  // concrete default to paint — but the tool itself, and its name, cover the whole category.
  //
  // Deliberately NOT veg_garden's kitchen green: a standing field crop reads olive-gold from the
  // air, and every sheet's legend swatch is the colour the map is painted, so the two areas a
  // farmer is most likely to draw side by side must not arrive as near-identical greens. Distinct
  // in the same breath from lawn (#8FBF6B, soft) and the boundary line (#8CEB6A, bright).
  staple_garden: { label: 'Staple garden', color: '#96A32C', icon: '🌽' },
  // The retained/graded riser face between two levels — see docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2.
  terrace_bank: { label: 'Terrace bank / level change', color: '#8A6D3B', icon: '🪜' },
};

export const ELEMENT_CATALOG: DesignElementDef[] = [
  {
    id: 'jojo_1000',
    category: 'water',
    name: 'JoJo Tank 1000L',
    icon: '🥁',
    art: '/element-art/jojo_1000.png',
    shape: 'circle',
    wM: 1,
    hM: 1,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 3,
    tip: 'Place within 3 m of a roof downpipe on a compacted, level base.',
  },
  {
    id: 'jojo_2500',
    category: 'water',
    name: 'JoJo Tank 2500L',
    icon: '🛢️',
    art: '/element-art/jojo_2500.png',
    shape: 'circle',
    wM: 1.4,
    hM: 1.4,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 3,
    tip: 'Needs a solid concrete ring base — full tank weighs ~2.5 t.',
  },
  {
    id: 'jojo_5000',
    category: 'water',
    name: 'JoJo Tank 5000L',
    icon: '🫙',
    art: '/element-art/jojo_5000.png',
    shape: 'circle',
    wM: 1.85,
    hM: 1.85,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 3,
    tip: '1.85 m diameter — check eave clearance and allow space to walk around for maintenance.',
  },
  {
    id: 'jojo_10000',
    category: 'water',
    name: 'JoJo Tank 10000L',
    icon: '🗄️',
    art: '/element-art/jojo_10000.png',
    shape: 'circle',
    wM: 2.2,
    hM: 2.2,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 3,
    tip: '2.2 m diameter, 3.15 m tall — site on a reinforced slab near the largest roof catchment.',
  },
  {
    id: 'rain_barrel',
    category: 'water',
    name: 'Rain Barrel',
    icon: '🪣',
    art: '/element-art/rain_barrel-v2.png',
    // The standard repurposed HDPE/steel drum is 200 L at Ø0.572 m — which is what the Ø0.6 m
    // footprint above already describes. Approximate on the card because the barrel a farmer
    // actually has may be a 100 L offcut or a 250 L chemical drum, and see capacityNote's own
    // note for why this must never reach the storage arithmetic.
    capacityNote: '≈200 L',
    shape: 'circle',
    wM: 0.6,
    hM: 0.6,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 3,
    tip: 'Good starter option under a small downpipe before investing in a JoJo.',
  },
  {
    id: 'pond_small',
    category: 'water',
    name: 'Small Pond',
    icon: '🐸',
    art: '/element-art/pond_small.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#2F7A4A',
    zoneRec: [3, 4],
    tip: 'Line with clay or pond liner; site in a natural low point to catch runoff.',
  },
  {
    id: 'dam',
    category: 'water',
    name: 'Farm Dam',
    icon: '🌊',
    art: '/element-art/dam.png',
    shape: 'circle',
    wM: 12,
    hM: 12,
    color: '#2F7A4A',
    zoneRec: [4],
    tip: 'Site on-contour below a catchment area; check DWS licensing thresholds for dam size.',
  },
  {
    id: 'borehole',
    category: 'water',
    name: 'Borehole',
    icon: '🕳️',
    art: '/element-art/borehole.png',
    shape: 'circle',
    wM: 0.6,
    hM: 0.6,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    tip: 'Get a hydrogeological siting survey before drilling — avoid septic/kraal runoff zones.',
  },
  {
    id: 'tap_point',
    category: 'water',
    name: 'Tap Point',
    icon: '🚰',
    art: '/element-art/tap_point.png',
    shape: 'circle',
    wM: 0.4,
    hM: 0.4,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    tip: 'Place at bed corners for easy hose access without crossing paths.',
  },
  {
    id: 'water_trough',
    category: 'water',
    name: 'Water Trough',
    icon: '🥛',
    art: '/element-art/water_trough.png',
    shape: 'rect',
    wM: 0.6,
    hM: 2,
    color: '#2F7A4A',
    zoneRec: [4],
    tip: 'Position on firm, well-drained ground away from the dam edge to reduce erosion.',
  },
  {
    id: 'first_flush',
    category: 'water',
    name: 'First-Flush Filter',
    icon: '🧴',
    art: '/element-art/first_flush.png',
    shape: 'circle',
    wM: 0.4,
    hM: 0.4,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    tip: 'On the downpipe before the tank — diverts the first dirty roof runoff (leaves, dust, bird mess) so only clean water is stored.',
  },
  {
    id: 'pump_filter',
    category: 'water',
    name: 'Pump & Filter',
    icon: '⚙️',
    art: '/element-art/pump_filter.png',
    shape: 'rect',
    wM: 0.6,
    hM: 0.6,
    color: '#2F7A4A',
    zoneRec: [0, 1],
    nearRoofM: 6,
    tip: 'Site near the tanks on a firm base — regulates pressure for drip lines and filters grit before irrigation.',
  },
  // ── Earthworks ────────────────────────────────────────────────────────────────
  // Land-SHAPING, not water plumbing: the minor earthworks that slow, spread and sink water
  // and build soil. Sits between Water and Structures on the Scale of Permanence, so these
  // ride on the Water step (see DesignPalette categoriesForStep). Kept as one contiguous block
  // because the palette renders ELEMENT_CATALOG in array order as a flat chip row.
  // Colour: one accent per category (the legend swatches rely on colour == category), so the
  // six re-tagged elements below take the earth tone rather than their old water/growing green.
  {
    id: 'raised_bed',
    // Built soil: it is a planting bed AND an earthwork, and the Earthworks view was blind to it.
    alsoLayers: ['earthworks'],
    // ...and it is a bed you grow vegetables in, so the Planting step must offer it too. It
    // already PRINTS on the Planting sheet (SHEET_OVERRIDE), so a farmer laying out their
    // planting could see beds on the finished sheet with no way to place one from that step.
    alsoSteps: ['planting'],
    category: 'earthworks',
    name: 'Raised Bed',
    icon: '🟫',
    art: '/element-art/raised_bed.png',
    shape: 'rect',
    wM: 1.2,
    hM: 2.4,
    color: '#A9743F',
    zoneRec: [1, 2],
    nearHouseMaxM: 35,
    needsSun: true,
    tip: 'Keep it 1.2 m wide — any wider and you cannot reach the middle from both sides. Fill 30-40 cm deep over loosened subsoil.',
  },
  {
    id: 'keyhole_bed',
    category: 'earthworks',
    alsoSteps: ['planting'], // a bed you plant, not just soil you shape
    name: 'Keyhole Bed',
    icon: '🔑',
    art: '/element-art/keyhole_bed.png',
    shape: 'circle',
    wM: 2,
    hM: 2,
    color: '#A9743F',
    zoneRec: [1],
    needsSun: true,
    tip: 'Central compost basket feeds the whole bed — ideal near the kitchen door.',
  },
  {
    id: 'herb_spiral',
    category: 'earthworks',
    alsoSteps: ['planting'], // herbs are a crop; the spiral is how they are grown
    name: 'Herb Spiral',
    icon: '🌀',
    art: '/element-art/herb_spiral.png',
    shape: 'circle',
    wM: 2,
    hM: 2,
    color: '#A9743F',
    zoneRec: [1],
    nearHouseMaxM: 15,
    needsSun: true,
    tip: 'Build up to 1-1.2 m high with rubble core; place right outside the kitchen door.',
  },
  {
    id: 'banana_circle',
    category: 'earthworks',
    alsoSteps: ['planting'], // it is a crop as much as a pit
    name: 'Banana Circle',
    icon: '🍌',
    art: '/element-art/banana_circle-v2.png',
    shape: 'circle',
    wM: 3.5,
    hM: 3.5,
    color: '#A9743F',
    zoneRec: [2],
    castsShade: true,
    tip: 'Dig a 2 m pit for the compost core; feeds off greywater and kitchen waste.',
  },
  {
    id: 'tree_basin',
    category: 'earthworks',
    alsoSteps: ['planting'], // you dig it in order to plant a tree in it
    name: 'Tree Basin',
    icon: '🟤',
    art: '/element-art/tree_basin.png',
    shape: 'circle',
    wM: 2,
    hM: 2,
    color: '#A9743F',
    zoneRec: [1, 2],
    // The geometry matters more than the name: the tree sits on a raised centre mound and the water
    // sits in the ring AROUND it, never against the trunk. A fruit tree standing in a wet
    // depression is how you get collar rot — and avocado, pawpaw and macadamia are the local
    // Phytophthora-susceptible cases, so this is the difference between the earthwork helping and
    // killing the tree it serves.
    tip: 'Plant the tree on a low raised mound, then ring it with a mulch-filled moat — roof or greywater runoff soaks in through the ring, at the feeder roots, while the trunk and crown stay high and dry. Never plant a fruit tree standing in the dip.',
  },
  {
    id: 'greywater_basin',
    category: 'earthworks',
    alsoSteps: ['water'], // the destination half of the greywater run
    name: 'Greywater Basin',
    icon: '♻️',
    art: '/element-art/greywater_basin.png',
    shape: 'circle',
    wM: 1.5,
    hM: 1.5,
    color: '#A9743F',
    zoneRec: [1, 2],
    tip: 'Feed from kitchen/laundry outlet into a mulch-filled banana or fruit tree basin.',
  },
  {
    // The SOURCE of the greywater run. Without it the water sheet had no honest answer to "where
    // does this water come from", so the renderer was inventing a diverter somewhere on the house.
    // Mark the actual drain being tapped — bath, shower, basin or laundry.
    id: 'greywater_outlet',
    category: 'water',
    name: 'Greywater Outlet',
    icon: '🚿',
    art: '/element-art/greywater_outlet.png',
    shape: 'circle',
    wM: 0.8,
    hM: 0.8,
    color: '#8E6FBF',
    zoneRec: [0, 1],
    tip: 'Where greywater LEAVES the house — the bath, shower, basin or laundry drain you are tapping. Put it on that wall, then run the line to a banana circle or tree basin. Never tap the toilet (that is blackwater), and use plant-safe soap.',
  },
  {
    id: 'greywater_diverter',
    category: 'water',
    name: 'Greywater Diverter & Filter',
    icon: '🔀',
    art: '/element-art/greywater_diverter.png',
    shape: 'circle',
    wM: 0.6,
    hM: 0.6,
    color: '#8E6FBF',
    zoneRec: [0, 1],
    tip: 'Valve plus leaf filter on the outlet: sends greywater to the garden in the dry season, and back to the sewer or soakaway when you need it to.',
  },
  {
    id: 'infiltration_basin',
    category: 'earthworks',
    name: 'Infiltration Basin',
    icon: '🕸️',
    art: '/element-art/infiltration_basin.png',
    shape: 'circle',
    wM: 3,
    hM: 3,
    color: '#A9743F',
    zoneRec: [2, 3],
    tip: 'A shallow flat-bottomed dish (30-50 cm deep) that ponds runoff so it soaks away. Site where water already collects, but keep 5 m clear of foundations.',
  },
  {
    id: 'half_moon',
    category: 'earthworks',
    name: 'Half-moon',
    icon: '🌙',
    art: '/element-art/half_moon.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#A9743F',
    zoneRec: [3, 4],
    tip: 'Semi-circular earth bund (demi-lune) with the arms on contour and the opening uphill — Sahel technique to water one tree in dry country.',
  },
  {
    id: 'berm',
    category: 'earthworks',
    name: 'Berm / Contour Bank',
    icon: '⛰️',
    art: '/element-art/berm.png',
    shape: 'rect',
    wM: 1.2,
    hM: 10,
    color: '#A9743F',
    zoneRec: [2, 3, 4],
    // Both readings, because the element carries both names and a farmer may mean either. The
    // distinction is real and worth stating plainly: a swale is a level trench that soaks water in
    // where it falls; a contour bank is a ridge that catches runoff and leads it away safely, and
    // in South African soil-conservation practice it is usually laid on a slight grade to a
    // grassed waterway rather than dead level. Same earth, opposite intent.
    tip: 'A raised earth ridge on contour. Either the mound on the downhill side of a swale trench, or a standalone contour bank that catches runoff and leads it to a safe outlet. Plant it as soon as it is built so it binds.',
  },
  {
    id: 'terrace',
    category: 'earthworks',
    name: 'Terrace / Retaining Bank',
    icon: '🪜',
    art: '/element-art/terrace.png',
    shape: 'rect',
    wM: 2.5,
    hM: 10,
    color: '#A9743F',
    zoneRec: [2, 3],
    tip: 'Cut-and-fill a level shelf across steep ground (steeper than ~1:5). Retain the face with rock, gabion or vetiver or it will slump.',
  },
  {
    // Keeps the id so existing placements survive. It is a LIVING cut-and-come-again grass bank,
    // not a static stockpile, so it sits in 'growing' and appears on the Planting sheet rather than
    // Water. (Vetiver planted on contour does slow and spread water too — draw that with the swale
    // or windbreak line tool, which is where the water layer picks it up.)
    id: 'mulch_bank',
    category: 'growing',
    name: 'Vetiver Bank',
    icon: '🌾',
    art: '/element-art/mulch_bank.png',
    shape: 'rect',
    wM: 2,
    hM: 2,
    color: '#7D9A4A',
    zoneRec: [2, 3],
    botanical: 'Chrysopogon zizanioides (sterile cultivar only)',
    tip: 'A living bank of vetiver you cut again and again for mulch and compost. Use the sterile, non-seeding cultivar — not a seeding local relative — so it stays a mulch bank and not a spreading grass. Slash it a few times a season, drop the leaf straight onto beds and tree basins. Its deep roots also hold the soil where it stands.',
  },
  {
    id: 'shed',
    category: 'structure',
    name: 'Shed',
    icon: '🏚️',
    art: '/element-art/shed.png',
    shape: 'rect',
    wM: 3,
    hM: 3,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Keep tools near the main work zone but out of prevailing rain direction.',
  },
  {
    id: 'greenhouse_tunnel',
    category: 'structure',
    name: 'Greenhouse Tunnel',
    icon: '🏡',
    art: '/element-art/greenhouse_tunnel.png',
    shape: 'rect',
    wM: 3,
    hM: 6,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Orient the ridge north-south for even light; anchor well against wind.',
  },
  {
    id: 'shade_house',
    category: 'structure',
    name: 'Shade House',
    icon: '🕶️',
    art: '/element-art/shade_house.png',
    shape: 'rect',
    wM: 3,
    hM: 3,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Use 40-50% shade netting for SA summer sun; site near the nursery table.',
  },
  {
    id: 'chicken_coop',
    category: 'structure',
    name: 'Chicken Coop',
    icon: '🐔',
    art: '/element-art/chicken_coop.png',
    shape: 'rect',
    wM: 2,
    hM: 2,
    color: '#7A5C3E',
    zoneRec: [2, 3],
    tip: 'Close enough for daily egg collection, downwind of the house.',
  },
  {
    id: 'chicken_tractor',
    category: 'structure',
    name: 'Chicken Tractor',
    icon: '🐓',
    art: '/element-art/chicken_tractor.png',
    shape: 'rect',
    wM: 1.2,
    hM: 2.4,
    color: '#7A5C3E',
    zoneRec: [2, 3],
    tip: 'Movable — rotate across beds or orchard rows for pest control and manure.',
  },
  {
    id: 'kraal',
    category: 'structure',
    name: 'Kraal',
    icon: '🐄',
    art: '/element-art/kraal.png',
    shape: 'rect',
    wM: 6,
    hM: 6,
    color: '#7A5C3E',
    zoneRec: [3, 4],
    tip: 'Site downhill and downwind of the house; capture runoff for a manure compost pit.',
  },
  {
    id: 'compost_bay',
    category: 'structure',
    name: 'Compost Bay (3-bin)',
    icon: '🪵',
    art: '/element-art/compost_bay.png',
    shape: 'rect',
    wM: 1,
    hM: 3,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Three ~1x1m bins in a row for turning stages; keep near veg beds to shorten wheelbarrow runs.',
  },
  {
    id: 'worm_farm',
    category: 'structure',
    name: 'Worm Farm',
    icon: '🪱',
    art: '/element-art/worm_farm.png',
    shape: 'rect',
    wM: 0.6,
    hM: 1.2,
    color: '#7A5C3E',
    zoneRec: [1],
    tip: 'Keep in shade near the kitchen for easy scrap disposal.',
  },
  {
    id: 'nursery_table',
    category: 'structure',
    name: 'Nursery Table',
    icon: '🪴',
    art: '/element-art/nursery_table.png',
    shape: 'rect',
    wM: 1,
    hM: 2,
    color: '#7A5C3E',
    zoneRec: [1],
    tip: 'Site close to a tap for daily seedling watering.',
  },
  {
    // A crèche, a school or a community garden is a farm with children on it, and there was no way
    // to say where they play — so the one part of the site that must NOT be planted with thorns,
    // dosed with greywater or crossed by a driveway was invisible to every sheet that reads the
    // design (Rory: "we need to add playground here"). 8 × 8 is a real play area rather than a
    // token marker; it is resizable like any other footprint.
    id: 'playground',
    category: 'structure',
    name: 'Playground',
    icon: '🛝',
    shape: 'rect',
    wM: 8,
    hM: 8,
    color: '#7A5C3E',
    zoneRec: [0, 1],
    tip: 'Keep it clear of greywater, thorny species and vehicle access — and site it where it can be seen from the kitchen or classroom.',
  },
  {
    id: 'market_stall',
    category: 'structure',
    name: 'Market Stall',
    icon: '🧺',
    art: '/element-art/market_stall.png',
    shape: 'rect',
    wM: 3,
    hM: 3,
    color: '#7A5C3E',
    zoneRec: [0, 1],
    tip: 'Place near the gate/road frontage for customer access.',
  },
  {
    id: 'veg_bed',
    category: 'growing',
    name: 'Vegetable Bed',
    icon: '🥬',
    art: '/element-art/veg_bed.png',
    shape: 'rect',
    wM: 1.2,
    hM: 3,
    color: '#4E8B3B',
    zoneRec: [1, 2],
    nearHouseMaxM: 35,
    needsSun: true,
    tip: 'Keep within daily-visit distance of the kitchen door; full sun, north-facing rows.',
  },
  {
    id: 'tree_citrus',
    category: 'growing',
    name: 'Citrus Tree',
    icon: '🍊',
    art: '/element-art/tree_citrus-v2.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Full sun, frost-protected spot; keep 4 m from structures for mature canopy.',
  },
  {
    id: 'tree_mango',
    category: 'growing',
    name: 'Mango Tree',
    icon: '🥭',
    art: '/element-art/tree_mango-v2.png',
    shape: 'circle',
    wM: 10,
    hM: 10,
    color: '#4E8B3B',
    zoneRec: [3],
    castsShade: true,
    tip: 'Mature canopy can reach 10 m+ — give it real room, frost-free warm zone.',
  },
  {
    id: 'tree_avocado',
    category: 'growing',
    name: 'Avocado Tree',
    icon: '🥑',
    art: '/element-art/tree_avocado-v5.png',
    shape: 'circle',
    wM: 8,
    hM: 8,
    color: '#4E8B3B',
    zoneRec: [3],
    castsShade: true,
    tip: 'Needs good drainage, wind shelter, and 8 m clearance at maturity.',
  },
  {
    id: 'tree_macadamia',
    category: 'growing',
    name: 'Macadamia Tree',
    icon: '🌰',
    art: '/element-art/tree_macadamia-v2.png',
    shape: 'circle',
    wM: 9,
    hM: 9,
    color: '#4E8B3B',
    zoneRec: [3],
    castsShade: true,
    tip: 'Slow-growing but wide canopy eventually — plant well back from paths and beds.',
  },
  {
    id: 'tree_guava',
    category: 'growing',
    name: 'Guava Tree',
    icon: '🍈',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    deprecated: true,
    botanical: 'Psidium guajava',
    deprecatedReason: 'Hidden from new designs: invasive risk in warm coastal/subtropical South African sites.',
    tip: 'Hidden from new designs because guava can be invasive in warm coastal areas. Kept so old saved designs still render.',
  },
  {
    id: 'tree_litchi',
    category: 'growing',
    name: 'Litchi Tree',
    icon: '🍒',
    art: '/element-art/tree_litchi-v5.png',
    shape: 'circle',
    wM: 8,
    hM: 8,
    color: '#4E8B3B',
    zoneRec: [3],
    castsShade: true,
    tip: 'Wide dense canopy at maturity — needs subtropical frost-free conditions.',
  },
  {
    id: 'tree_pawpaw',
    category: 'growing',
    name: 'Pawpaw Tree',
    icon: '🌴',
    art: '/element-art/tree_pawpaw-v2.png',
    shape: 'circle',
    wM: 2.5,
    hM: 2.5,
    color: '#4E8B3B',
    zoneRec: [2],
    castsShade: true,
    tip: 'Fast-growing and short-lived — good gap-filler near the kitchen garden.',
  },
  {
    id: 'tree_moringa',
    category: 'growing',
    name: 'Moringa Tree',
    // Moringa gives up 🌳 to the indigenous shade tree, which is the catalog's canonical BIG
    // BROAD tree and has the better claim on the broad-canopy glyph. This is the more accurate
    // pair anyway: moringa is thin-trunked with fine feathery foliage and is usually coppiced
    // for leaf harvest, which 🌿 says and 🌳 does not. (Glyphs must stay unique — there is a
    // test for it — so this was a swap, not an addition.)
    icon: '🌿',
    art: '/element-art/tree_moringa.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Prune hard annually for leaf harvest to control size near beds.',
  },
  {
    id: 'tree_natal_plum',
    category: 'growing',
    name: 'Natal Plum',
    icon: '🫐',
    art: '/element-art/tree_natal_plum-v2.png',
    shape: 'circle',
    wM: 3,
    hM: 3,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    botanical: 'Carissa macrocarpa',
    tip: 'Indigenous fruiting coastal shrub/tree; useful as an edible hedge or small orchard edge.',
  },
  {
    id: 'tree_wild_plum',
    category: 'growing',
    name: 'Wild Plum',
    icon: '🍇',
    art: '/element-art/tree_wild_plum-v2.png',
    shape: 'circle',
    wM: 7,
    hM: 7,
    color: '#4E8B3B',
    zoneRec: [3, 4],
    castsShade: true,
    botanical: 'Harpephyllum caffrum',
    tip: 'This is the coastal/subtropical Wild Plum (Harpephyllum caffrum), umgwenya — not the drier-region Wild Plum (Pappea capensis), which is a smaller tree not yet in this catalog. Give it room away from beds and buildings.',
  },
  {
    id: 'tree_waterberry',
    category: 'growing',
    name: 'Waterberry',
    icon: '💠',
    art: '/element-art/tree_waterberry-v2.png',
    shape: 'circle',
    wM: 8,
    hM: 8,
    color: '#4E8B3B',
    zoneRec: [3, 4],
    castsShade: true,
    botanical: 'Syzygium cordatum',
    tip: 'Indigenous fruiting shade tree for moister edges and wildlife-friendly food forest zones.',
  },
  {
    id: 'tree_marula',
    category: 'growing',
    name: 'Marula',
    // A plain yellow fruit disc, not a lookalike glyph. Marula fruit is a small round yellow
    // drupe, and every fruit emoji close enough to it (🥭 🍑 🍋) is already another species in
    // this catalog. The colour-disc convention is established here — 🟣 is the plum, 🔵 and 🟢
    // the berries — and it says "yellow round fruit" without claiming to be a mango.
    icon: '🟡',
    art: '/element-art/tree_marula-v2.png',
    shape: 'circle',
    wM: 12,
    hM: 12,
    color: '#4E8B3B',
    zoneRec: [3, 4],
    castsShade: true,
    botanical: 'Sclerocarya birrea',
    tip: 'Big savanna shade tree — give it 12 m and keep it well back from buildings. Only female trees fruit, so plant several seedlings if you want a crop.',
  },
  {
    id: 'tree_kei_apple',
    category: 'growing',
    name: 'Kei Apple',
    icon: '🟠',
    art: '/element-art/tree_kei_apple-v2.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    botanical: 'Dovyalis caffra',
    // The one indigenous fruit in this catalog that crops in EVERY South African climate bucket
    // (see TREE_CLIMATES). That matters to the palette's Indigenous fruit section: without it a
    // fynbos, grassland or Karoo site filters the whole section down to nothing, because marula,
    // waterberry, wild plum and natal plum are all subtropical-only.
    tip: 'Thorny and very hardy — takes frost, drought and wind. Grown as a stock-proof edible hedge as often as a single tree. Only female plants fruit.',
  },
  {
    id: 'tree_other',
    category: 'growing',
    name: 'Other Tree',
    icon: '✳️',
    art: '/element-art/tree_other.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3, 4],
    castsShade: true,
    tip: 'Place the canopy, then tap it and rename it to the exact species.',
  },
  {
    id: 'banana_clump',
    category: 'growing',
    name: 'Banana Clump',
    icon: '🍃',
    art: '/element-art/banana_clump-v5.png',
    shape: 'circle',
    wM: 3,
    hM: 3,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Heavy feeder — site near greywater outflow or compost area.',
  },
  {
    id: 'tree_indigenous',
    category: 'growing',
    name: 'Indigenous Shade Tree',
    // NOT a conifer (Rory: "in south africa if i insert a indig shade tree its generally a flat
    // crown species not a conifer"). 🌲 is the evergreen-conifer glyph, and in South Africa that
    // shape does not read as neutral — it reads as a pine plantation, which is the invasive
    // thing a permaculture plan is usually trying to REPLACE. The indigenous shade trees a
    // farmer actually plants here are broad and flat- or dome-crowned. No emoji is flat-topped,
    // so 🌳 is the closest honest glyph; the crown FORM is described properly in the polish
    // prompt (lib/producer-prompt.ts), which is where the picture is actually decided.
    icon: '🌳',
    art: '/element-art/tree_indigenous.png',
    shape: 'circle',
    wM: 10,
    hM: 10,
    color: '#4E8B3B',
    zoneRec: [4, 5],
    castsShade: true,
    tip: 'Use for windbreaks and wildlife corridors on the property edge.',
  },
  // Temperate / cold-climate fruit & nut trees — for Highveld grassland, Afromontane and other
  // frosty areas where the subtropical trees above won't set fruit. Suitability by climate is
  // in TREE_CLIMATES below.
  {
    id: 'tree_apple',
    category: 'growing',
    name: 'Apple Tree',
    icon: '🍎',
    art: '/element-art/tree_apple-v2.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Needs winter cold (chill) to fruit — good on the Highveld; pick a low-chill variety in milder spots.',
  },
  {
    id: 'tree_pear',
    category: 'growing',
    name: 'Pear Tree',
    icon: '🍐',
    art: '/element-art/tree_pear-v2.png',
    shape: 'circle',
    wM: 5,
    hM: 5,
    color: '#4E8B3B',
    zoneRec: [3],
    castsShade: true,
    tip: 'Cold-hardy and long-lived; needs a second variety nearby for good pollination.',
  },
  {
    id: 'tree_plum',
    category: 'growing',
    name: 'Plum Tree',
    icon: '🟣',
    art: '/element-art/tree_plum-v2.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Frost-hardy stone fruit; blossoms early so avoid the coldest frost pockets.',
  },
  {
    id: 'tree_peach',
    category: 'growing',
    name: 'Peach Tree',
    icon: '🍑',
    art: '/element-art/tree_peach-v2.png',
    shape: 'circle',
    wM: 4,
    hM: 4,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Prune to an open vase each winter; needs some chill but tolerates mild-frost hinterland too.',
  },
  {
    id: 'tree_fig',
    category: 'growing',
    name: 'Fig Tree',
    icon: '🟩',
    art: '/element-art/tree_fig-v2.png',
    shape: 'circle',
    wM: 5,
    hM: 5,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: true,
    tip: 'Very adaptable — handles frost, heat and dry spells. Roots are vigorous, keep clear of walls/pipes.',
  },
  {
    id: 'tree_pomegranate',
    category: 'growing',
    name: 'Pomegranate',
    icon: '🔴',
    art: '/element-art/tree_pomegranate-v2.png',
    shape: 'circle',
    wM: 3,
    hM: 3,
    color: '#4E8B3B',
    zoneRec: [2, 3],
    castsShade: false,
    tip: 'Loves hot dry summers; drought-hardy once established. Good for Karoo and Highveld gardens.',
  },
  {
    id: 'tree_olive',
    category: 'growing',
    name: 'Olive Tree',
    icon: '🫒',
    art: '/element-art/tree_olive-v2.png',
    shape: 'circle',
    wM: 6,
    hM: 6,
    color: '#4E8B3B',
    zoneRec: [3, 4],
    castsShade: true,
    tip: 'Mediterranean and Karoo star — drought- and frost-tolerant; needs a dry, sunny, well-drained spot.',
  },
  // ── "Other" — the escape hatch ────────────────────────────────────────────────────────────────
  // A fixed catalog can never cover a real farm. Rory: "if i took a picture we should be able to
  // edit a label that is other". These are placed like any element and then RENAMED in the item
  // editor (PlacedItem.label already overrides def.name everywhere — sheets, legends, labels and
  // the AI element list), so a farmer can record a wash trough, a seedling tunnel or a grave
  // without waiting for the catalog to catch up.
  //
  // One per placing step rather than a single generic one, because an element's CATEGORY is what
  // decides which sheet it lands on (lib/glossy-filters.ts sheetForElement). A single "Other" would
  // have to guess, and would put a farmer's water feature on the planting sheet half the time.
  {
    id: 'other_water',
    category: 'water',
    name: 'Other water thing',
    icon: '🔵',
    art: '/element-art/other_water.png',
    shape: 'rect',
    wM: 1.5,
    hM: 1.5,
    color: '#2E7FC2',
    zoneRec: [0, 1, 2],
    tip: 'Anything the catalog does not cover yet — place it, then tap it to give it a name.',
  },
  {
    id: 'other_planting',
    category: 'growing',
    name: 'Other planting',
    icon: '🟢',
    art: '/element-art/other_planting.png',
    shape: 'rect',
    wM: 2,
    hM: 2,
    color: '#4E8B3B',
    zoneRec: [1, 2, 3],
    tip: 'Anything the catalog does not cover yet — place it, then tap it to give it a name.',
  },
  {
    id: 'other_structure',
    category: 'structure',
    name: 'Other structure',
    icon: '🔺',
    art: '/element-art/other_structure.png',
    shape: 'rect',
    wM: 2,
    hM: 2,
    color: '#8A7B63',
    zoneRec: [0, 1, 2],
    tip: 'Anything the catalog does not cover yet — place it, then tap it to give it a name.',
  },
  {
    id: 'pollinator_strip',
    category: 'growing',
    name: 'Pollinator Strip',
    icon: '🐝',
    art: '/element-art/pollinator_strip.png',
    shape: 'rect',
    wM: 1,
    hM: 5,
    color: '#4E8B3B',
    zoneRec: [2],
    needsSun: true,
    tip: 'Mix indigenous flowering species along orchard edges to boost fruit set.',
  },
  {
    id: 'spekboom_hedge',
    category: 'growing',
    name: 'Spekboom Hedge',
    icon: '🌵',
    art: '/element-art/spekboom_hedge.png',
    shape: 'rect',
    wM: 0.5,
    hM: 5,
    color: '#4E8B3B',
    zoneRec: [2, 3, 4],
    tip: 'Plant cuttings 20-30 cm apart as a firebreak/browse hedge — extremely drought-hardy.',
  },
  {
    id: 'vetiver_row',
    category: 'growing',
    name: 'Vetiver Row',
    icon: '〰️',
    art: '/element-art/vetiver_row.png',
    shape: 'rect',
    wM: 0.3,
    hM: 5,
    color: '#4E8B3B',
    zoneRec: [2, 3, 4],
    botanical: 'Chrysopogon zizanioides (sterile cultivar only)',
    tip: 'Plant on-contour with slips 10-15 cm apart to stop erosion on slopes. Use the sterile, non-seeding cultivar so the line holds ground rather than spreading as a seeding grass.',
  },
  {
    id: 'beehive',
    category: 'animal',
    name: 'Beehive',
    icon: '🍯',
    art: '/element-art/beehive.png',
    shape: 'rect',
    wM: 0.5,
    hM: 0.5,
    color: '#C98A2C',
    zoneRec: [4, 5],
    tip: 'Face entrance east, away from foot traffic; keep 5-10 m clear approach path.',
  },
  {
    id: 'goat_pen',
    category: 'animal',
    name: 'Goat Pen',
    icon: '🐐',
    art: '/element-art/goat_pen.png',
    shape: 'rect',
    wM: 4,
    hM: 4,
    color: '#C98A2C',
    zoneRec: [3, 4],
    tip: 'Sturdy fencing essential — goats browse anything reachable, keep away from young trees.',
  },
  {
    id: 'pig_pen',
    category: 'animal',
    name: 'Pig Pen',
    icon: '🐖',
    art: '/element-art/pig_pen.png',
    shape: 'rect',
    wM: 4,
    hM: 4,
    color: '#C98A2C',
    zoneRec: [3, 4],
    tip: 'Downhill of water sources, with shade and a wallow; strong odour control needed near house.',
  },
  {
    id: 'duck_pond',
    category: 'animal',
    name: 'Duck Pond',
    icon: '🦆',
    art: '/element-art/duck_pond.png',
    shape: 'circle',
    wM: 2,
    hM: 2,
    color: '#C98A2C',
    zoneRec: [3],
    tip: 'Pair with the orchard for natural snail and pest control.',
  },
  {
    id: 'rabbit_hutch',
    category: 'animal',
    name: 'Rabbit Hutch',
    icon: '🐇',
    art: '/element-art/rabbit_hutch.png',
    shape: 'rect',
    wM: 1,
    hM: 2,
    color: '#C98A2C',
    zoneRec: [2],
    tip: 'Raise off ground; manure drops straight to a compost or worm bin below.',
  },
  {
    id: 'water_trough2',
    category: 'animal',
    name: 'Livestock Trough',
    icon: '🪤',
    art: '/element-art/water_trough2.png',
    shape: 'rect',
    wM: 0.6,
    hM: 2,
    color: '#C98A2C',
    zoneRec: [3, 4],
    tip: 'Place at the kraal fence line for easy refilling without entering the pen.',
  },
  {
    id: 'biodigester',
    category: 'structure',
    name: 'Biodigester',
    icon: '🔥',
    art: '/element-art/biodigester.png',
    shape: 'circle',
    wM: 2,
    hM: 2,
    color: '#7A5C3E',
    zoneRec: [2, 3],
    tip: 'Site near the kraal/pig pen for manure feedstock; pipe gas to the kitchen.',
  },
  {
    id: 'shade_sail',
    category: 'structure',
    name: 'Shade Sail',
    icon: '⛱️',
    art: '/element-art/shade_sail.png',
    shape: 'rect',
    wM: 4,
    hM: 4,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Anchor over seating or nursery areas; orient to block harsh afternoon sun.',
  },
  {
    id: 'gate',
    category: 'access',
    name: 'Gate',
    icon: '🚪',
    art: '/element-art/gate.png',
    shape: 'rect',
    wM: 1.5,
    hM: 0.3,
    color: '#8C8577',
    zoneRec: [0],
    tip: 'Align with the main path for straightforward vehicle and foot access.',
  },
  // Site furniture — these were filed under 'access' when it was a grab-bag. Access is now
  // paths/gates/driveway only, so they are plain misc structures (colour follows category).
  {
    id: 'bench',
    category: 'structure',
    name: 'Bench',
    icon: '🪑',
    art: '/element-art/bench.png',
    shape: 'rect',
    wM: 1.5,
    hM: 0.5,
    color: '#7A5C3E',
    zoneRec: [1, 2],
    tip: 'Site under shade with a view over the main growing area.',
  },
  {
    id: 'sign',
    category: 'structure',
    name: 'Sign',
    icon: '🪧',
    art: '/element-art/sign.png',
    shape: 'rect',
    wM: 0.5,
    hM: 0.1,
    color: '#7A5C3E',
    zoneRec: [0, 1],
    tip: 'Place at path junctions for orientation or market-day signage.',
  },
  {
    id: 'solar_panel_ground',
    category: 'structure',
    name: 'Ground Solar Panel',
    icon: '🔆',
    art: '/element-art/solar_panel_ground.png',
    shape: 'rect',
    wM: 2,
    hM: 1,
    color: '#7A5C3E',
    zoneRec: [0, 1],
    tip: 'Angle north-facing and unshaded for peak SA solar yield.',
  },
  {
    id: 'washline',
    category: 'structure',
    name: 'Washing Line',
    icon: '🧦',
    art: '/element-art/washline.png',
    shape: 'rect',
    wM: 3,
    hM: 0.3,
    color: '#7A5C3E',
    zoneRec: [1],
    tip: 'Site in full sun close to the house, clear of tree drip lines.',
  },
];

export const ELEMENTS_BY_ID: Record<string, DesignElementDef> = ELEMENT_CATALOG.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<string, DesignElementDef>,
);

// ── Climate suitability for fruit/nut trees ─────────────────────────────────────
// The owner's ask: "depending on the climate zone we must have specific trees accordingly."
// Coarse SA climate buckets a tree can crop in. Frost-tenderness and chill needs are the main
// drivers here (well-established horticulture), not fine-grained cultivar advice.
export type ClimateZone = 'subtropical' | 'temperate' | 'mediterranean' | 'arid';

// Which climates each tree crops well in. A tree NOT listed here (e.g. the indigenous shade
// tree, or non-tree growing items) is treated as climate-agnostic and always shown.
export const TREE_CLIMATES: Record<string, ClimateZone[]> = {
  tree_citrus: ['subtropical', 'mediterranean'],
  tree_mango: ['subtropical'],
  tree_avocado: ['subtropical'],
  tree_macadamia: ['subtropical'],
  tree_litchi: ['subtropical'],
  tree_pawpaw: ['subtropical'],
  tree_moringa: ['subtropical', 'arid'],
  tree_natal_plum: ['subtropical'],
  tree_wild_plum: ['subtropical'],
  tree_waterberry: ['subtropical'],
  tree_marula: ['subtropical', 'arid'],
  // Every bucket, and not as a shrug — kei apple is the standard hardy hedge fruit right across
  // South Africa: frost-hardy on the highveld, drought-hardy in the Karoo, salt- and wind-tolerant
  // on the coast. It is also what keeps the palette's Indigenous fruit section from emptying out
  // on a non-subtropical site.
  tree_kei_apple: ['subtropical', 'temperate', 'mediterranean', 'arid'],
  banana_clump: ['subtropical'],
  banana_circle: ['subtropical'],
  tree_apple: ['temperate'],
  tree_pear: ['temperate'],
  tree_plum: ['temperate'],
  tree_peach: ['temperate', 'subtropical'],
  tree_fig: ['temperate', 'mediterranean', 'arid', 'subtropical'],
  tree_pomegranate: ['arid', 'mediterranean', 'temperate'],
  tree_olive: ['mediterranean', 'arid', 'temperate'],
};

// SA biome NAME (as stored on site.biome, from lib/biome.ts BIOMES[].name) → the climates that
// grow there. Returns null when the biome is unknown/outside SA, meaning "show every tree".
export function biomeClimates(biomeName?: string | null): ClimateZone[] | null {
  switch ((biomeName ?? '').trim().toLowerCase()) {
    case 'indian ocean coastal belt':
    case 'savanna':
      return ['subtropical'];
    case 'albany thicket':
      return ['subtropical', 'arid'];
    case 'afromontane forest':
      return ['temperate', 'subtropical'];
    case 'grassland':
      return ['temperate'];
    case 'fynbos':
      return ['mediterranean', 'temperate'];
    case 'succulent karoo':
    case 'nama-karoo':
    case 'desert':
      return ['arid'];
    default:
      return null; // unknown / outside SA → don't filter
  }
}

// Is this element suited to the site's climate? Non-trees and unmapped trees are always suited.
export function elementSuitsClimate(defId: string, siteClimates: ClimateZone[] | null): boolean {
  if (!siteClimates) return true; // unknown site climate → show everything
  const treeClimates = TREE_CLIMATES[defId];
  if (!treeClimates) return true; // climate-agnostic (indigenous, support planting, etc.)
  return treeClimates.some((c) => siteClimates.includes(c));
}

export function elementVisibleInPalette(def: DesignElementDef, siteClimates: ClimateZone[] | null): boolean {
  if (def.deprecated) return false;
  return elementSuitsClimate(def.id, siteClimates);
}

// ── Planting-palette sections ───────────────────────────────────────────────────
// The Planting step's chip strip had grown to one undivided run of ~24 chips, and the species a
// farmer is LEAST likely to already know by name — the indigenous fruit — were scattered through
// it between the citrus and the apples, indistinguishable from the exotics you scroll past
// (Rory: "I want indig fruit to have their own section"). Sections give them a heading of their
// own and, because they sort second, a position near the head of the strip rather than
// somewhere past the mangoes.
//
// Deliberately a SEPARATE id→group map rather than a `group:` field on each def, exactly like
// TREE_CLIMATES above: this is how the Planting palette reads the catalog, not something the
// catalog itself asserts, and it must never be able to touch saved data.
export type PlantingGroup = 'beds' | 'indigenous_fruit' | 'fruit_nut' | 'other_trees';

export const PLANTING_GROUP_ORDER: PlantingGroup[] = ['beds', 'indigenous_fruit', 'fruit_nut', 'other_trees'];

export const PLANTING_GROUP_LABEL: Record<PlantingGroup, string> = {
  beds: 'Beds & strips',
  indigenous_fruit: 'Indigenous fruit',
  fruit_nut: 'Fruit & nut trees',
  // Moringa (leaf, not fruit), the generic indigenous shade tree and the "Other Tree" catch-all.
  // None of the three belongs under a heading that promises fruit.
  other_trees: 'Shade & other trees',
};

// SA indigenous species grown for their FRUIT. The indigenous shade tree is deliberately absent:
// it is a placeholder for any broad-crowned indigenous tree, not a fruiting species, and putting
// it here would make the heading lie.
export const INDIGENOUS_FRUIT_IDS: readonly string[] = [
  'tree_marula',
  'tree_kei_apple',
  'tree_natal_plum',
  'tree_wild_plum',
  'tree_waterberry',
];

const OTHER_TREE_IDS: readonly string[] = ['tree_moringa', 'tree_indigenous', 'tree_other'];

/** Which section of the Planting palette this element sits in.
 *
 *  The CATEGORY test comes first, and it is doing real work: `tree_basin` and `banana_circle` are
 *  category 'earthworks' and reach this step via `alsoSteps` — they are pits you dig, and a basin
 *  in particular is not a tree at all. An id-prefix test alone (which is what the sort this
 *  replaced used) files `tree_basin` under fruit trees and `banana_circle` under beds, i.e. gets
 *  both of them exactly backwards.
 *
 *  Within 'growing', `tree_` is the same discriminator producer-labels.ts uses for its TREES label
 *  family; banana_clump is a tree-sized perennial by every measure that matters here except its id. */
export function plantingGroupFor(def: DesignElementDef): PlantingGroup {
  if (def.category !== 'growing') return 'beds';
  if (INDIGENOUS_FRUIT_IDS.includes(def.id)) return 'indigenous_fruit';
  if (OTHER_TREE_IDS.includes(def.id)) return 'other_trees';
  if (def.id.startsWith('tree_') || def.id === 'banana_clump') return 'fruit_nut';
  return 'beds';
}
