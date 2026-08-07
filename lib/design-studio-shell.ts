// Design Studio Shell (v2) — pure data/types for the new 9-sheet stepper shell.
//
// SCOPE: this is the reference-shell phase (feature/design-studio-2). It builds the chrome
// (toolbar/stepper/panel/bottom-bar/palette) and fully wires ONE sheet — Water — as the
// pattern the other 8 sheets follow later. See app/design-studio-2/page.tsx for the route.
//
// SINGLE-SOURCE-OF-TRUTH RULE (the whole reason this file is shaped the way it is): every
// number, id, label and default below is either (a) read live from lib/design-elements.ts's
// ELEMENT_CATALOG, or (b) copied from a named, cited spot in the existing app so it can't
// silently drift from what ships today. Nothing here is invented. Where this shell adds a
// concept the real engine does not have yet (an extra layer key, per-layer opacity on the
// coarse categories), that is called out explicitly in a comment, not hidden.
//
// Per lib/sector.ts's own rule ("lib/ never imports components/"), this file stays pure data
// — no React, no JSX. StudioShell.tsx owns the state; this file only describes its shape.

import { ELEMENT_CATALOG, ELEMENTS_BY_ID, type DesignElementDef, type DesignLayerKey } from '@/lib/design-elements';
import type { LineShape } from '@/lib/design-canvas';

// ── Sheets ─────────────────────────────────────────────────────────────────────────────────
//
// This exact id/order/label list is NOT invented for this shell — it is copied verbatim from
// DESIGN_SHEETS in components/design/DesignGlossy.tsx (the canonical plan-set, also documented
// in docs/PLAN-SET-SPEC.md: "Ordering rule Rory locked in: ANALYSIS BEFORE DESIGN"). That
// array is a component-local const, not exported, so it is mirrored here rather than imported
// — a small, acknowledged duplication (see the WaterInfraKey section below for the same
// trade-off made twice already in the real code). If DESIGN_SHEETS ever changes, this list
// needs updating too.
export type SheetId =
  | 'site' | 'sector' | 'zones' | 'water' | 'earthworks' | 'planting' | 'structures' | 'whole' | 'phasing';

export const SHEET_ORDER: SheetId[] = [
  'site', 'sector', 'zones', 'water', 'earthworks', 'planting', 'structures', 'whole', 'phasing',
];

export interface SheetMeta {
  id: SheetId;
  no: string; // '01'..'09', matches DESIGN_SHEETS
  label: string; // matches DESIGN_SHEETS' short label exactly
  description: string; // one-liner for the right panel — paraphrased from docs/PLAN-SET-SPEC.md
  // and lib/glossy-filters.ts's REFERENCE_SHEET_LABEL, not invented copy.
}

export const SHEET_META: Record<SheetId, SheetMeta> = {
  site: {
    id: 'site', no: '01', label: 'Site',
    description: "Trace what's already there — boundary, buildings, terrace levels — before any design goes on top.",
  },
  sector: {
    id: 'sector', no: '02', label: 'Sector',
    description: 'Map the sun, wind, water and fire patterns that decide where everything else goes.',
  },
  zones: {
    id: 'zones', no: '03', label: 'Zones',
    description: "Lay out permaculture effort-zones by how often you'll visit and manage the ground.",
  },
  water: {
    id: 'water', no: '04', label: 'Water',
    // Matches REFERENCE_SHEET_LABEL.water in lib/glossy-filters.ts almost verbatim.
    description: 'Plan tanks, taps, pipes, drip lines and swales — where water is stored, moved and slowed.',
  },
  earthworks: {
    id: 'earthworks', no: '05', label: 'Earthworks',
    description: 'Shape the land: swales, berms, terraces and basins that make water and soil behave.',
  },
  planting: {
    id: 'planting', no: '06', label: 'Planting',
    description: 'Lay out beds, guilds and trees — what grows where, and what shades what.',
  },
  structures: {
    id: 'structures', no: '07', label: 'Structures',
    description: 'Place small livestock housing and site infrastructure — coops, shade, fencing.',
  },
  whole: {
    id: 'whole', no: '08', label: 'Whole',
    description: 'The final integrated masterplan — every layer of the design on one sheet.',
  },
  phasing: {
    id: 'phasing', no: '09', label: 'Phasing',
    description: 'Sequence the build — what gets done first, and in what order it can safely happen.',
  },
};

// ── Layer model ────────────────────────────────────────────────────────────────────────────
//
// WaterInfraKey is copied verbatim from `WaterInfrastructureLayer` in
// components/design/DesignCanvas.tsx (also re-declared as WaterInfrastructureVisibility /
// WaterInfrastructureOpacity's key set in app/design/page.tsx — so this shell's copy is a
// THIRD instance of the same five-key union, not a new drift risk this shell introduces by
// itself. All three now agree; a future cleanup could hoist one shared type. See the
// component report for why this shell reuses the shape instead of inventing its own.
export type WaterInfraKey = 'storage' | 'tapPoints' | 'pipes' | 'drip' | 'swales';

// 'waterSources' is the ONE key in this whole file that is NOT in the live app. Rory's Water
// spec lists "Water sources" (dam/pond/borehole/trough) as its own row, separate from "Water
// infrastructure" (tanks/taps/pipes/drip/swales) — a real, sensible split, but
// waterInfrastructureForElement() in both DesignCanvas.tsx and page.tsx only recognises
// tap_point and jojo_*/rain_barrel; a dam, pond, borehole or trough currently has NO named
// sub-layer at all and just rides the coarse 'water' category key. Toggling "Water sources"
// in THIS shell only ever affects this shell's own preview — wiring it to the real canvas
// would mean extending WaterInfrastructureLayer with a 'sources' member in both of those
// files. Flagged here so it can't be mistaken for something that already works end to end.
export type ShellOnlyLayerKey = 'waterSources';

export type LayerKeyId = DesignLayerKey | WaterInfraKey | ShellOnlyLayerKey;

export interface LayerTreeNode {
  key: LayerKeyId;
  label: string;
  children?: LayerTreeNode[];
}

export interface LayerVisualState {
  visible: boolean;
  opacity: number; // 0..100
}

export type LayerStateMap = Partial<Record<LayerKeyId, LayerVisualState>>;

/** Effectively-invisible floor. Mirrors the real app's own rule for the base-photo opacity
 *  slider (tests/design-canvas-helpers.test.ts: "opacity never reaches zero — a fully
 *  invisible base photo reads as a lost upload") — a "visible: true" layer sitting at an
 *  opacity a farmer can't actually see is the same failure in spirit as a layer that is off. */
const MIN_LIVE_OPACITY = 15;

// Defaults mirror app/design/page.tsx's activeLayers initial state EXACTLY, including its own
// comment: "Every element layer MUST default to true: the Pro catalog filter and the canvas
// both gate on these, so a key defaulting to false (or missing) silently hides that category's
// elements from the palette AND the map." contours/sector are the two named exceptions there
// (opt-in overlays) and stay off here for the same reason.
export const DEFAULT_LAYER_STATE: LayerStateMap = Object.fromEntries(
  ([
    'water', 'earthworks', 'zones', 'planting', 'structures', 'access', 'animals',
    'ground', 'references', 'boundary', 'labels', 'symbols', 'contours', 'sector',
    'storage', 'tapPoints', 'pipes', 'drip', 'swales', 'waterSources',
  ] as LayerKeyId[]).map((key) => [
    key,
    { visible: key !== 'contours' && key !== 'sector', opacity: 100 },
  ]),
);

/** Flattens a tree to every key it mentions, parents and children alike — used by "All on" /
 *  "All off" so those buttons only ever touch the ACTIVE sheet's own layers, never every key
 *  the whole shell happens to know about. */
export function flattenLayerKeys(nodes: LayerTreeNode[]): LayerKeyId[] {
  const out: LayerKeyId[] = [];
  for (const n of nodes) {
    out.push(n.key);
    if (n.children) out.push(...flattenLayerKeys(n.children));
  }
  return out;
}

/**
 * THE bug-class-1 guard, generalised.
 *
 * Real precedent, cited exactly: app/design/page.tsx (~810-820) runs two setState calls
 * together, every time the armed placement tool's defId/lineKind changes —
 *   setActiveLayers((layers) => (layers.water ? layers : { ...layers, water: true }));
 *   setWaterInfrastructureVisibility((layers) => (layers[key] ? layers : { ...layers, [key]: true }));
 * — forcing BOTH the coarse category layer AND the specific named sub-layer on, atomically,
 * in the one place a placement is armed. Turning off either alone still hides the item
 * (DesignCanvas.tsx composes categoryLayerKey() AND waterInfrastructure.visibility[key] as two
 * separate gates), so a fix that only forced one of them would still reproduce the bug.
 *
 * This shell's version of that guarantee: every QuickActionDef below declares `forceLayers`,
 * and this is the ONE function that applies it — every placement path (quick action, palette
 * click-to-place, the Draw tool committing a line) funnels through it, so the guarantee lives
 * in one place rather than being a convention every call site has to remember.
 */
export function applyForceLayers(state: LayerStateMap, keys: LayerKeyId[]): LayerStateMap {
  let next = state;
  for (const key of keys) {
    const cur = next[key] ?? { visible: true, opacity: 100 };
    if (cur.visible && cur.opacity >= MIN_LIVE_OPACITY) continue;
    next = { ...next, [key]: { visible: true, opacity: Math.max(cur.opacity, 100) } };
  }
  return next;
}

// ── Quick actions ──────────────────────────────────────────────────────────────────────────

export interface QuickActionDef {
  id: string;
  label: string;
  hint: string;
  /** Places a point item from ELEMENT_CATALOG at a default stage position. */
  defId?: string;
  /** Places a short 2-point demo line of this kind. */
  lineKind?: LineShape['kind'];
  /** Keys forced visible before/with the placement — see applyForceLayers. */
  forceLayers: LayerKeyId[];
}

// ── Water — the one fully-built sheet ─────────────────────────────────────────────────────
//
// Every id below is read from the REAL ELEMENT_CATALOG (lib/design-elements.ts) — this list
// only says WHICH catalog entries the Water palette shows, never what their dimensions are.
// The dimensions farmers see on each card come from DesignElementDef.wM/hM at render time.
export const WATER_ELEMENT_IDS = [
  'jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000',
  'rain_barrel', 'pond_small', 'dam', 'borehole', 'tap_point', 'water_trough',
] as const;

// Sub-grouping for the palette's category tabs. This is a SHELL-ONLY presentational split
// (all ten of these already share ElementCategory === 'water' — see CATEGORY_STEP in
// lib/design-elements.ts — so the real ElementCategory union has nothing finer to filter by).
// Deliberately a plain id->tab map rather than a new field on DesignElementDef, so it cannot
// be mistaken for real catalog data.
export const WATER_PALETTE_TABS: Record<string, string[]> = {
  Tanks: ['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel'],
  Sources: ['pond_small', 'dam', 'borehole'],
  Access: ['tap_point', 'water_trough'],
};

export function waterElementDefs(): DesignElementDef[] {
  return WATER_ELEMENT_IDS.map((id) => ELEMENTS_BY_ID[id]).filter((d): d is DesignElementDef => !!d);
}

// Verbatim logic from waterInfrastructureForElement() (components/design/DesignCanvas.tsx AND
// app/design/page.tsx carry byte-identical copies of this already) — a third copy here keeps
// the shell dependency-free of both files while staying provably in sync with what they do.
export function waterInfraForElement(defId: string): WaterInfraKey | null {
  if (defId === 'tap_point') return 'tapPoints';
  if (defId === 'rain_barrel' || defId.startsWith('jojo_')) return 'storage';
  return null;
}

export function waterInfraForLine(kind: LineShape['kind']): WaterInfraKey | null {
  if (kind === 'pipe' || kind === 'greywater') return 'pipes';
  if (kind === 'drip') return 'drip';
  if (kind === 'swale') return 'swales';
  return null;
}

/** Elements with no named WaterInfraKey that are still "a water source" per Rory's Water spec
 *  (dam/pond/borehole/trough) — see the ShellOnlyLayerKey doc above. */
const WATER_SOURCE_IDS = new Set(['pond_small', 'dam', 'borehole', 'water_trough']);

/**
 * Which layer key gates a Water-sheet element: its named infrastructure sub-layer if it has
 * one, else 'waterSources' if it's one of the un-named water-source elements, else the coarse
 * 'water' category layer. THE single place this decision is made — CanvasStage.tsx (rendering)
 * and StudioShell.tsx (placement's force-layers guard) both call this rather than each keeping
 * their own copy, which is exactly the kind of duplication that let bug-class-1 happen for real
 * in this codebase once already (two places answering "is this layer on" that can disagree).
 */
export function subLayerForWaterElement(defId: string): LayerKeyId {
  return waterInfraForElement(defId) ?? (WATER_SOURCE_IDS.has(defId) ? 'waterSources' : 'water');
}

export const WATER_LAYER_TREE: LayerTreeNode[] = [
  { key: 'references', label: 'Base map' },
  { key: 'boundary', label: 'Boundary' },
  {
    key: 'water',
    label: 'Water infrastructure',
    children: [
      { key: 'storage', label: 'JoJo Tanks' },
      { key: 'tapPoints', label: 'Tap Points' },
      { key: 'pipes', label: 'Pipes & Lines' },
      { key: 'drip', label: 'Drip Irrigation' },
      { key: 'swales', label: 'Swales' },
    ],
  },
  { key: 'waterSources', label: 'Water sources' },
  { key: 'contours', label: 'Contours' },
  { key: 'access', label: 'Access & Roads' },
  { key: 'structures', label: 'Structures' },
  { key: 'labels', label: 'Labels' },
];

export const WATER_QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: 'add-tank', label: 'Add tank', hint: 'Places a 2500 L JoJo tank — the most common starter size.',
    defId: 'jojo_2500', forceLayers: ['water', 'storage'],
  },
  {
    id: 'add-tap', label: 'Add tap point', hint: 'Places a tap point at a bed corner.',
    defId: 'tap_point', forceLayers: ['water', 'tapPoints'],
  },
  {
    id: 'add-pipe', label: 'Add pipe', hint: 'Drops a short pipe run you can drag into place — use Draw for a longer custom route.',
    lineKind: 'pipe', forceLayers: ['water', 'pipes'],
  },
  {
    id: 'add-swale', label: 'Add swale', hint: 'Drops a short on-contour swale segment you can drag and extend.',
    lineKind: 'swale', forceLayers: ['water', 'swales'],
  },
];

// ── Stub sheets (Site, Sector, Zones, Earthworks, Planting, Structures, Whole, Phasing) ────
//
// Deliberately minimal per the brief: reachable, never a dead end, but not fully built — that
// is a later phase. Each still gets a real (if short) layer tree so the right panel never
// renders empty, and an honest "not built yet" state instead of a fake palette.
function stubLayerTree(primary: DesignLayerKey, primaryLabel: string): LayerTreeNode[] {
  return [
    { key: 'references', label: 'Base map' },
    { key: 'boundary', label: 'Boundary' },
    { key: primary, label: primaryLabel },
    { key: 'labels', label: 'Labels' },
  ];
}

export interface SheetConfig extends SheetMeta {
  layerTree: LayerTreeNode[];
  quickActions: QuickActionDef[];
  paletteDefIds: string[];
  paletteTabs?: Record<string, string[]>;
  stub: boolean;
}

export const SHEET_CONFIG: Record<SheetId, SheetConfig> = {
  site: { ...SHEET_META.site, layerTree: stubLayerTree('ground', 'Existing site fabric'), quickActions: [], paletteDefIds: [], stub: true },
  sector: { ...SHEET_META.sector, layerTree: stubLayerTree('sector', 'Sector overlay'), quickActions: [], paletteDefIds: [], stub: true },
  zones: { ...SHEET_META.zones, layerTree: stubLayerTree('zones', 'Effort zones'), quickActions: [], paletteDefIds: [], stub: true },
  water: {
    ...SHEET_META.water,
    layerTree: WATER_LAYER_TREE,
    quickActions: WATER_QUICK_ACTIONS,
    paletteDefIds: [...WATER_ELEMENT_IDS],
    paletteTabs: WATER_PALETTE_TABS,
    stub: false,
  },
  earthworks: { ...SHEET_META.earthworks, layerTree: stubLayerTree('earthworks', 'Earthworks'), quickActions: [], paletteDefIds: [], stub: true },
  planting: { ...SHEET_META.planting, layerTree: stubLayerTree('planting', 'Planting'), quickActions: [], paletteDefIds: [], stub: true },
  structures: { ...SHEET_META.structures, layerTree: stubLayerTree('structures', 'Structures'), quickActions: [], paletteDefIds: [], stub: true },
  whole: { ...SHEET_META.whole, layerTree: stubLayerTree('planting', 'Everything'), quickActions: [], paletteDefIds: [], stub: true },
  phasing: { ...SHEET_META.phasing, layerTree: stubLayerTree('structures', 'Build sequence'), quickActions: [], paletteDefIds: [], stub: true },
};

export function nextSheetId(current: SheetId): SheetId | null {
  const i = SHEET_ORDER.indexOf(current);
  return i >= 0 && i < SHEET_ORDER.length - 1 ? SHEET_ORDER[i + 1] : null;
}

// ── Demo placement state (shell-only; NOT the production DesignCanvasState) ────────────────
//
// Deliberately its own tiny shape, not lib/design-canvas.ts's PlacedItem/LineShape: this shell
// has no real siteId/CanvasFrame/GPS alignment to anchor a true DesignCanvasState to, and
// bolting one on with fake coordinates would be worse than being honest that this phase does
// not persist to the farmer's real saved design. See the component report for the integration
// path (loadCanvasState/saveCanvasState) a later phase would use instead of this.
export interface DemoItem {
  id: string;
  defId: string;
  xM: number; // metres from stage origin (top-left)
  yM: number;
}

export interface DemoLine {
  id: string;
  kind: LineShape['kind'];
  pointsM: Array<[number, number]>; // metres from stage origin
}

export const ELEMENT_CATALOG_BY_ID = ELEMENTS_BY_ID;
export const ALL_ELEMENT_CATALOG = ELEMENT_CATALOG;
