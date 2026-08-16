/**
 * Render-only cartography metadata for the Structures Reference Blueprint.
 *
 * This module is intentionally bounded to IDs that exist in `design-elements.ts`. It does not
 * create, rename, reposition, or resize saved items; callers may use the scale only when painting
 * a finished sheet so small, real features remain legible at print size.
 */

import { normaliseLookupKey } from '@/lib/key-normalisation';

export type StructuresLegendSection =
  | 'SITE ACCESS & SERVICE'
  | 'COMPOST & NURSERY'
  | 'LIVESTOCK & APIARY'
  | 'PROTECTED GROWING';

export const STRUCTURES_LEGEND_SECTION_ORDER: readonly StructuresLegendSection[] = [
  'SITE ACCESS & SERVICE',
  'COMPOST & NURSERY',
  'LIVESTOCK & APIARY',
  'PROTECTED GROWING',
];

export type StructuresFeatureSymbol =
  | 'compost'
  | 'beehive'
  | 'chicken-tractor'
  | 'nursery'
  | 'shade'
  | 'gate'
  | 'tap'
  | 'washline';

export interface StructuresFeatureVisual {
  section: StructuresLegendSection;
  symbol: StructuresFeatureSymbol;
  presentationScale: number;
}

// ── Legend section membership ────────────────────────────────────────────────────────────────
//
// Reading-order group for the deterministic Structures legend. Deliberately based on stable
// element IDs rather than display names, matching the idiom in water-cartography.ts and
// planting-cartography.ts, so a farmer can rename an item without moving it into a different
// section. Kept independent of FEATURE_VISUALS below: FEATURE_VISUALS is a narrower, curated set
// of point-symbol/print-scale treatments for a handful of small features, not a section registry
// — folding legend-section membership into it is what left 17 real Structures-sheet elements with
// a legend row but no heading (docs/CATALOG-MATRIX-2026-07-27.md, Gap 4).
const PROTECTED_GROWING_FEATURES = new Set([
  'shade_house', 'greenhouse_tunnel',
]);

// A tunnel is an AREA the farmer measured, not a point symbol. Rory's rule is literal: whatever
// width and length were entered in the Studio must be the width and length on the finished plan.
// Keep this independent of FEATURE_VISUALS: shade_house still has a dedicated legend glyph, but
// that must never buy it the small-feature enlargement used for hives, taps and gates.
const EXACT_FOOTPRINT_FEATURES = new Set([
  'shade_house', 'greenhouse_tunnel',
]);

const COMPOST_AND_NURSERY_FEATURES = new Set([
  'compost_bay', 'nursery_table', 'worm_farm',
]);

const LIVESTOCK_AND_APIARY_FEATURES = new Set([
  'beehive', 'chicken_tractor', 'chicken_coop', 'kraal', 'goat_pen', 'pig_pen', 'duck_pond',
  'rabbit_hutch', 'water_trough2',
]);

// Everything else that reaches the Structures sheet is general site infrastructure: access
// (gate), utility fittings (washline, solar_panel_ground, biodigester — a manure-to-gas utility
// for the kitchen, not a compost pile), a customer-facing service point (market_stall), a
// work/storage structure (shed), site amenities (bench, sign, shade_sail — shaded seating, not a
// growing structure), and the uncatalogued fallback (other_structure). tap_point is included for
// backward compatibility with its existing curated visual treatment even though its primary
// output sheet is Water, not Structures — see FEATURE_VISUALS below.
const SITE_ACCESS_AND_SERVICE_FEATURES = new Set([
  'gate', 'tap_point', 'washline', 'shed', 'market_stall', 'playground', 'other_structure', 'biodigester',
  'shade_sail', 'bench', 'sign', 'solar_panel_ground',
]);

/**
 * Returns the editorial legend section for a canonical catalog ID, or null when the ID has not
 * been placed into one of the four sections. Kept null rather than defaulted to a catch-all
 * bucket — like plantingLegendSectionForFeature's null for a genuinely unmapped ID — so a future
 * catalog addition that nobody has classified yet fails the coverage test in
 * tests/catalog-matrix.test.ts instead of silently landing in a section.
 *
 * TOTAL over every structure/animal/access element that currently reaches the Structures sheet
 * (see sheetForElement in lib/glossy-filters.ts) — tests/structures-cartography.test.ts and
 * tests/catalog-matrix.test.ts both prove this dynamically against the real catalog, the same way
 * waterLegendSectionForFeature and plantingLegendSectionForFeature are proven total for their
 * sheets.
 */
export function structuresLegendSectionForFeature(id: string): StructuresLegendSection | null {
  const key = normaliseLookupKey(id, '_');
  if (PROTECTED_GROWING_FEATURES.has(key)) return 'PROTECTED GROWING';
  if (COMPOST_AND_NURSERY_FEATURES.has(key)) return 'COMPOST & NURSERY';
  if (LIVESTOCK_AND_APIARY_FEATURES.has(key)) return 'LIVESTOCK & APIARY';
  if (SITE_ACCESS_AND_SERVICE_FEATURES.has(key)) return 'SITE ACCESS & SERVICE';
  return null;
}

// ── Point-symbol / print-scale visual treatments ────────────────────────────────────────────
//
// A narrower, curated set of small features that get a bounded print-scale emphasis and a
// dedicated glyph. Unrelated to legend section membership above (see the comment on that block).
const FEATURE_VISUALS: Readonly<Record<string, StructuresFeatureVisual>> = {
  compost_bay: {
    section: 'COMPOST & NURSERY',
    symbol: 'compost',
    presentationScale: 1.2,
  },
  nursery_table: {
    section: 'COMPOST & NURSERY',
    symbol: 'nursery',
    presentationScale: 1.2,
  },
  beehive: {
    section: 'LIVESTOCK & APIARY',
    symbol: 'beehive',
    presentationScale: 1.45,
  },
  chicken_tractor: {
    section: 'LIVESTOCK & APIARY',
    symbol: 'chicken-tractor',
    presentationScale: 1.25,
  },
  shade_house: {
    section: 'PROTECTED GROWING',
    symbol: 'shade',
    presentationScale: 1.08,
  },
  gate: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'gate',
    presentationScale: 1.15,
  },
  tap_point: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'tap',
    presentationScale: 1.35,
  },
  washline: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'washline',
    presentationScale: 1.1,
  },
};

/** Returns the bounded visual treatment for a canonical catalog ID, or null for unknown IDs. */
export function structuresFeatureVisualFor(id: string): StructuresFeatureVisual | null {
  const visual = FEATURE_VISUALS[normaliseLookupKey(id, '_')];
  return visual ? { ...visual } : null;
}

/**
 * Print-scale emphasis for small structures and service points. The caller keeps the saved
 * centre, footprint, and rotation unchanged; this value is for presentation only.
 */
export function structuresFeaturePresentationScale(id: string): number {
  return FEATURE_VISUALS[normaliseLookupKey(id, '_')]?.presentationScale ?? 1;
}

export interface StructuresPresentationDimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Keeps small infrastructure readable on a finished sheet without moving its saved centre or
 * changing its aspect ratio. The long-side cap prevents a very thin gate from becoming a banner.
 */
export function structuresFeaturePresentationDimensions(
  id: string,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
): StructuresPresentationDimensions {
  const key = normaliseLookupKey(id, '_');
  if (
    !Number.isFinite(naturalWidth)
    || naturalWidth <= 0
    || !Number.isFinite(naturalHeight)
    || naturalHeight <= 0
  ) {
    return { width: 0, height: 0, scale: 1 };
  }
  if (EXACT_FOOTPRINT_FEATURES.has(key)) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  if (!FEATURE_VISUALS[key] || !Number.isFinite(canvasWidth) || canvasWidth <= 0) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  const shortSide = Math.max(0.01, Math.min(naturalWidth, naturalHeight));
  const longSide = Math.max(naturalWidth, naturalHeight);
  const minimumShortSide = Math.max(22, canvasWidth * 0.0135);
  const maximumLongSide = Math.max(minimumShortSide, canvasWidth * 0.05);
  const requestedScale = Math.max(
    structuresFeaturePresentationScale(key),
    minimumShortSide / shortSide,
  );
  const cappedScale = Math.min(requestedScale, maximumLongSide / Math.max(0.01, longSide));
  const scale = Math.max(1, cappedScale);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale)) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  return {
    width,
    height,
    scale,
  };
}

export interface StructuresRouteVisual {
  dash: readonly number[];
  width: number;
}

/** Paths read as walking routes, while post-and-wire fences remain solid. */
export function structuresRouteVisualFor(kind: string): StructuresRouteVisual | null {
  const key = normaliseLookupKey(kind, '_');
  if (key === 'path') return { dash: [12, 8], width: 3.2 };
  // Bed paths are the same thing at bed scale — tighter dash, thinner line.
  if (key === 'bedpath') return { dash: [7, 5], width: 2.4 };
  if (key === 'fence') return { dash: [], width: 3.5 };
  return null;
}

export function structuresFeatureSymbolFor(id: string): StructuresFeatureSymbol | null {
  return FEATURE_VISUALS[normaliseLookupKey(id, '_')]?.symbol ?? null;
}

/**
 * SHADE STRUCTURES ARE CLOTH, NOT ROOF.
 *
 * Rory, of a shade tunnel standing over his veg garden: "It's tunnel thing we need to either show
 * half a real shade tunnel to show the veg garden underneath or what?" — and a day later, still
 * looking at it: "did you not sort the shade tunnel issue?"
 *
 * A shade house, a tunnel and a sail are all the same thing in plan: a permeable cloth stretched
 * on a frame, with a working garden UNDERNEATH it. Drawn like a shed — opaque, and painted before
 * the beds because the draw order runs largest footprint first — it reads either as a solid slab
 * with nothing under it, or as a thing the beds are sitting on top of. Neither is what is there.
 *
 * The fix is the one a draughtsman would use: draw the cloth LAST and SEE-THROUGH, so the beds,
 * paths and plants beneath it stay legible and the structure reads as a cover over them. That is
 * the plan convention for shade cloth, and it is also simply true — you can see through 40% shade
 * netting, which is the whole reason it is netting and not a roof.
 */
const SHADE_CLOTH_IDS = new Set(['shade_house', 'greenhouse_tunnel', 'shade_sail']);

export function isShadeClothStructure(defId: string): boolean {
  return SHADE_CLOTH_IDS.has(defId);
}

/**
 * How much of what is underneath shows through the cloth.
 *
 * Chosen to match real netting rather than to look pretty: 40–50% shade cloth is what the app's
 * own Shade House tip recommends for South African summer sun, so the structure should obscure
 * about that much and no more. Higher and the garden disappears again — the exact complaint.
 * Lower and the frame stops reading as a structure at all.
 */
export const SHADE_CLOTH_ALPHA = 0.5;
