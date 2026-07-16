// Shared "+ Add" action catalog — the single source of truth for the discoverability
// entry point (spec: DISCOVERABILITY-SIMPLE-PLAN.md §2.1). Pure data, no React, so both
// the farmer map (/farmer) and the Design Studio (/design) import the same list and
// mappings. The AddSheet renders these; each surface's onPick executes what it owns and
// hands the rest off to the other surface. Radical choice-reduction is the point — keep
// v1 to these 11 actions; richer elements stay reachable through the existing per-step
// chips and palettes.

import type { LucideIcon } from 'lucide-react';
import {
  LandPlot, Home, Squircle, Sprout, Grid3x3, Trees,
  Cylinder, Waves, Droplet, Footprints, Fence,
} from 'lucide-react';
import type { GroundFeatureKind, LineShape } from '@/lib/design-canvas';
import type { SiteElementType } from '@/lib/site-elements';

export type AddActionId =
  | 'boundary'        // trace land boundary            → MAP draw
  | 'house'           // house outline (ground feature) → STUDIO areaFeature 'house'
  | 'lawn'            // lawn area                      → STUDIO areaFeature 'lawn'
  | 'veg_garden'      // existing veg-garden area       → STUDIO areaFeature 'veg_garden'
  | 'veg_bed'         // new veg bed (item)             → STUDIO place 'veg_bed'
  | 'tree'            // a tree                         → MAP element 'tree' / STUDIO place tree def
  | 'water_tank'      // JoJo / tank                    → MAP element 'jojo_tank' / STUDIO place 'jojo_5000'
  | 'water_body'      // dam / pond outline             → MAP water draw
  | 'tap'             // tap point                      → MAP element 'tap' / STUDIO place 'tap_point'
  | 'path'            // path line                      → STUDIO line 'path'
  | 'fence';          // fence line                     → STUDIO line 'fence'

export type AddActionGroup = 'land' | 'growing' | 'water' | 'structures';

export interface AddAction {
  id: AddActionId;
  icon: LucideIcon;
  labelKey: string;   // addLabel<Id>
  hintKey: string;    // addHint<Id>
  group: AddActionGroup;
  // Where the action actually executes. An action present on a surface it does NOT
  // execute on deep-links to the other surface (the sheet shows an honest "Opens …" chip).
  runsOn: 'map' | 'studio' | 'both';
}

// Exactly the 11 actions, in display order. Grouped by `group` for the sheet's headers.
export const ADD_ACTIONS: AddAction[] = [
  // ── My land ──
  { id: 'boundary',   icon: LandPlot,  labelKey: 'addLabelBoundary',   hintKey: 'addHintBoundary',   group: 'land',       runsOn: 'map' },
  { id: 'house',      icon: Home,      labelKey: 'addLabelHouse',      hintKey: 'addHintHouse',      group: 'land',       runsOn: 'studio' },
  { id: 'lawn',       icon: Squircle,  labelKey: 'addLabelLawn',       hintKey: 'addHintLawn',       group: 'land',       runsOn: 'studio' },
  // ── Growing ──
  { id: 'veg_garden', icon: Sprout,    labelKey: 'addLabelVegGarden',  hintKey: 'addHintVegGarden',  group: 'growing',    runsOn: 'studio' },
  { id: 'veg_bed',    icon: Grid3x3,   labelKey: 'addLabelVegBed',     hintKey: 'addHintVegBed',     group: 'growing',    runsOn: 'studio' },
  { id: 'tree',       icon: Trees,     labelKey: 'addLabelTree',       hintKey: 'addHintTree',       group: 'growing',    runsOn: 'both' },
  // ── Water ──
  { id: 'water_tank', icon: Cylinder,  labelKey: 'addLabelWaterTank',  hintKey: 'addHintWaterTank',  group: 'water',      runsOn: 'both' },
  { id: 'water_body', icon: Waves,     labelKey: 'addLabelWaterBody',  hintKey: 'addHintWaterBody',  group: 'water',      runsOn: 'map' },
  { id: 'tap',        icon: Droplet,   labelKey: 'addLabelTap',        hintKey: 'addHintTap',        group: 'water',      runsOn: 'both' },
  // ── Paths & structures ──
  { id: 'path',       icon: Footprints, labelKey: 'addLabelPath',      hintKey: 'addHintPath',       group: 'structures', runsOn: 'studio' },
  { id: 'fence',      icon: Fence,     labelKey: 'addLabelFence',      hintKey: 'addHintFence',      group: 'structures', runsOn: 'studio' },
];

export const ADD_GROUP_LABEL_KEYS: Record<AddActionGroup, string> = {
  land: 'addGroupLand',
  growing: 'addGroupGrowing',
  water: 'addGroupWater',
  structures: 'addGroupStructures',
};

// Ordered list of groups (matches the order actions first appear above).
export const ADD_GROUP_ORDER: AddActionGroup[] = ['land', 'growing', 'water', 'structures'];

// ── Execution mappings (single source of truth, consumed by both surfaces) ──

// Studio area (ground feature) drawn as a filled ZoneShape with feature=<kind>.
export const STUDIO_AREA_FOR: Partial<Record<AddActionId, GroundFeatureKind>> = {
  house: 'house', lawn: 'lawn', veg_garden: 'veg_garden',
};
// Studio placed item — a design-element def id.
export const STUDIO_PLACE_FOR: Partial<Record<AddActionId, string>> = {
  veg_bed: 'veg_bed', tree: 'tree_citrus', water_tank: 'jojo_5000', tap: 'tap_point',
};
// Studio line (path/fence) drawn as a LineShape.
export const STUDIO_LINE_FOR: Partial<Record<AddActionId, LineShape['kind']>> = {
  path: 'path', fence: 'fence',
};
// Map point element — a reticle-dropped SiteElement.
export const MAP_ELEMENT_FOR: Partial<Record<AddActionId, SiteElementType>> = {
  tree: 'tree', water_tank: 'jojo_tank', tap: 'tap',
};

// Whether an action can execute directly on the given surface (else it deep-links away).
export function runsOnSurface(action: AddAction, surface: 'map' | 'studio'): boolean {
  if (action.runsOn === 'both') return true;
  return action.runsOn === surface;
}
