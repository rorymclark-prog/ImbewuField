'use client';

// Design Studio — toolbar + element palette.
//
// Phone-first: 44px touch targets, horizontally scrollable chip rows. Pure controlled
// component — all state (tool, placeDefId, zoneDraw, lineKind, activeLayers) lives in the
// parent; this just renders controls and calls the setters.
//
// LAYOUT — two renderers, one set of row logic:
// On desktop/wide viewports (see lib/use-phone-viewport.ts) this renders as a normal docked
// block at the bottom of the page's flex column — unchanged since before this comment.
// On phone-sized viewports it renders instead as a draggable POSITION:FIXED bottom sheet.
//
// Why fixed, not another maxHeight+overflow region (commit 6d5a5c8's reverted fix): the page
// root (app/design/page.tsx) is styled `minHeight:'100dvh'` — a FLOOR, not a cap — inside
// `display:flex;flexDirection:column`, and <body> is hardcoded `h-screen overflow-hidden`
// (app/layout.tsx) with no scroll fallback anywhere in the ancestor chain. On a real phone the
// sum of header + wizard + slim chrome row + the canvas's non-negotiable 45dvh floor + this
// palette's own content reliably exceeds one viewport (measured: 1003px of content in an
// 844px-tall viewport). Because the page root only has a MINIMUM height, flex-grow has no free
// space to distribute back — the column simply grows past the viewport, and <body>'s
// overflow-hidden silently clips the last ~159px with NO scrollbar anywhere: not body's (hidden,
// not auto), not the page root's (its own overflow-y:auto never engages because nothing ever
// constrains ITS box to less than its content — it only ever grows to fit), and not any
// maxHeight+overflow region placed inside the palette either, because that region's content
// (173px, measured) was already comfortably under its own cap — it never needed to scroll
// internally, the REGION ITSELF was just positioned starting below the visible viewport. Fixing
// a region that has no internal overflow problem cannot fix a page that overflows the viewport.
// `position:fixed` sidesteps all of that: its box is sized straight from the real viewport (via
// dvh units) independent of what the flex column above it does, so it can never be pushed off
// the bottom edge by unrelated content overflowing above it — see renderPhoneSheet below.
//
// The Layers popover (inside renderToolRow) opens upward with position:absolute and is
// documented there as needing NO overflow ancestor. That guarantee must hold in BOTH layouts:
// neither the desktop docked wrapper nor the phone sheet's own root may ever gain
// overflow:hidden/auto — only the scrollable BODY region (a sibling of the tool row, never an
// ancestor of it) is allowed to clip/scroll.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import { normaliseRotation, MIN_MAP_TEXT_SCALE, MAX_MAP_TEXT_SCALE } from '@/lib/design-canvas';
import { MIN_BED_COUNT, MAX_BED_COUNT } from '@/lib/bed-block';
import { CATEGORY_META, CATEGORY_STEP, ELEMENT_CATALOG, GROUND_FEATURES, ZONE_DEFS, biomeClimates, elementSuitsClimate, elementVisibleInPalette, type DesignElementDef } from '@/lib/design-elements';
import { COMPASS16_ORDER, isCompassDirection16, type LocalWindObservation } from '@/lib/local-wind';
import { usePhoneViewport } from '@/lib/use-phone-viewport';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';
import LessonLink from './LessonLink';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

interface ActiveLayers {
  water: boolean;
  earthworks: boolean;
  zones: boolean;
  planting: boolean;
  structures: boolean;
  access: boolean;
  animals: boolean;
  ground: boolean;
  baseMap: boolean;
  boundary: boolean;
  labels: boolean;
  symbols: boolean;
  contours: boolean;
  sector: boolean;
}

export type DesignMode = 'guided' | 'pro';

export interface DesignPaletteProps {
  step: WizardStep;
  mode: DesignMode;
  tool: ToolKind;
  setTool: (t: ToolKind) => void;
  placeDefId: string | null;
  setPlaceDefId: (id: string | null) => void;
  zoneDraw: 0 | 1 | 2 | 3 | 4 | 5;
  setZoneDraw: (z: 0 | 1 | 2 | 3 | 4 | 5) => void;
  /** The zone number the current SELECTION is, or null when the selection isn't a single
   *  zone (nothing selected, a mixed selection, a placed item, a ground feature). Distinct
   *  from zoneDraw, which is what the draw tool will paint NEXT: the chip row has to answer
   *  both "what am I holding?" and "what will I paint?", and before this it only answered
   *  the second. Computed in app/design/page.tsx, which owns selection state. */
  selectedZone: 0 | 1 | 2 | 3 | 4 | 5 | null;
  areaFeature: GroundFeatureKind | null;
  setAreaFeature: (f: GroundFeatureKind | null) => void;
  lineKind: LineShape['kind'];
  setLineKind: (k: LineShape['kind']) => void;
  activeLayers: ActiveLayers;
  setActiveLayers: (layers: ActiveLayers) => void;
  /** Icon/label size slider, shown inside the Layers panel beside Labels and Icons. null hides
   *  it entirely, same "nothing to act on" convention the other optional controls use. */
  textScaleControl: { value: number; onChange: (v: number) => void } | null;
  /** Bed-block inserter: type the bed length, bed width, path width and count, then arm it and
   *  tap a corner on the canvas. null hides the whole control. */
  bedBlockControl: {
    spec: { bedLengthM: number; bedWidthM: number; pathWidthM: number; count: number };
    armed: boolean;
    onSpecChange: (next: Partial<{ bedLengthM: number; bedWidthM: number; pathWidthM: number; count: number }>) => void;
    onArm: () => void;
    onCancel: () => void;
  } | null;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onDeleteSelected: (() => void) | null;
  // Duplicate the current selection (same offset-and-select pattern as Delete's group handling).
  // null = nothing selected, same disabled convention as onDeleteSelected.
  onDuplicateSelected: (() => void) | null;
  // Tidy outline (lib/tidy-outline.ts) — opens a PREVIEW of a simplified version of the single
  // selected zone/line; the farmer confirms or cancels on the canvas itself (see DesignCanvas's
  // tidyPreview prop). null = nothing selected, more than one thing is selected, or the selection
  // is a placed item rather than a zone/line — same "nothing to act on" disabled convention as
  // onDuplicateSelected/onDeleteSelected. Tapping this never itself changes the design; only the
  // canvas's own Confirm button (wired to the SAME onChange/undo path every other edit uses) does.
  onTidySelected: (() => void) | null;
  // Snap to neighbour — opens one PREVIEW for every selected zone/feature ring. Each safe ring can
  // move while vetoed rings (including the property boundary) remain byte-identical and are named
  // in the preview. null = no ring selected, only the boundary selected, or a line/item is mixed
  // into the selection. Confirm uses the same single undo entry as every other edit.
  onSnapSelected: (() => void) | null;
  // Clean up (lib/align-items.ts) — opens a PREVIEW that straightens and evenly spaces a
  // MULTI-selection of 2+ placed items; the farmer confirms or cancels on the canvas itself (see
  // DesignCanvas's cleanupPreview prop), same shape as onTidySelected/onSnapSelected above.
  // Deliberately NOT single-selection like Tidy/Snap — see lib/align-items.ts's module doc for
  // why this action is the one scoped to a group. null = fewer than 2 items selected, or the
  // selection includes a zone/line rather than only placed items — same "nothing to act on"
  // disabled convention as onTidySelected/onSnapSelected. Tapping this never itself changes the
  // design; only the canvas's own Confirm button (wired to the SAME onChange/undo path every
  // other edit uses) does.
  onCleanupSelected: (() => void) | null;
  // Angle field for rect-shaped placed items (strips/beds/rows) — precise numeric alternative to
  // the drag-rotate handle on the canvas. null hides the control entirely, same "nothing to act
  // on" convention as onDuplicateSelected/onDeleteSelected going null: it means either nothing is
  // selected, more than one thing is selected, or the single selected item's def isn't
  // rect-shaped (circles are rotation-invariant — see PlacedItem.rot in lib/design-canvas.ts).
  // `deg` is the item's current rotation for display (0 when item.rot is undefined). `onRotate`
  // is called with the farmer's raw typed degrees on commit (blur/Enter only, never mid-keystroke)
  // — the parent normalises via normaliseRotation and commits through the same onChange/undo path
  // the drag-rotate handle uses, so both commit paths land exactly one undo entry.
  angleControl: { deg: number; onRotate: (deg: number) => void } | null;
  /** Scale every selected placed ITEM about its own centre (null hides the control). Born from a
   *  live editing session (Rory: "i want to be able to resize all these beds all at once but i
   *  cant") — the drag grips resize one item, so a row of seven duplicated beds meant seven
   *  identical drags. Each tap is one commit, so one undo entry, exactly like the Angle field. */
  sizeControl: {
    onScale: (factor: number) => void;
    /** Set one dimension in metres on every selected item (circles take it as their diameter). */
    onSetDim: (dim: 'wM' | 'hM', value: number) => void;
    /** Common committed value across the selection, or null when members differ ('—' placeholder). */
    wM: number | null;
    hM: number | null;
  } | null;
  // Sector step: confirm/override control for the farmer's on-site wind observation
  // (lib/local-wind.ts LocalWindObservation) — the local counterpart to ZoneShape.measuredSlopePct.
  // null hides the whole control, same "nothing to act on" convention as onDuplicateSelected going
  // null — here it means there is no canvasState yet to record an observation into (see
  // app/design/page.tsx). `regional` is what the app currently assumes for the "prevailing wind"
  // question (lib/local-wind.ts regionalPrevailingPick over the site's regional named-wind table);
  // null when the site has no regional table at all (still lets the farmer record what they see —
  // see the render code below). `observation` is the farmer's saved answer, if any. `onSet` commits
  // a new observation, or null to clear it back to "regional, honestly labelled" (the task's
  // "Not sure" case) — through the same onChange/undo path every other edit uses.
  windControl: {
    regional: { fromLabel: string } | null;
    observation: LocalWindObservation | null;
    onSet: (observation: LocalWindObservation | null) => void;
  } | null;
  // Site biome name (from lib/biome.ts) — used to surface climate-appropriate trees on the
  // planting step. Undefined = unknown, show all.
  siteBiome?: string;
}

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const PAPER = '#FFFEFA';
const DARK = '#0B120B';

const LINE_KINDS: Array<{ id: LineShape['kind']; labelKey: string; icon: string }> = [
  { id: 'swale', labelKey: 'designPaletteLineSwale', icon: '〰️' },
  { id: 'fence', labelKey: 'designPaletteLineFence', icon: '🚧' },
  { id: 'path', labelKey: 'designPaletteLinePath', icon: '🥾' },
  { id: 'pipe', labelKey: 'designPaletteLinePipe', icon: '🧵' },
  { id: 'drip', labelKey: 'designPaletteLineDrip', icon: '💧' },
  { id: 'greywater', labelKey: 'designPaletteLineGreywater', icon: '🚿' },
  { id: 'windbreak', labelKey: 'designPaletteLineWindbreak', icon: '🌬️' },
];

// Ground-feature chips shown on the Base ("what is here") step — each arms the polygon
// draw tool to record a real built/ground feature. Order = the plot itself first (boundary),
// then kitchen-out (house next).
const GROUND_FEATURE_KINDS: GroundFeatureKind[] = ['boundary', 'house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared'];

// Ordered by the Scale of Permanence (water → earthworks → access → structures → planting),
// with the reference/overlay layers bracketing it.
const LAYER_TOGGLES: Array<{ key: keyof ActiveLayers; labelKey: string; icon: string }> = [
  { key: 'baseMap', labelKey: 'designPaletteLayerBase', icon: '🛰️' },
  // The property fence, sitting next to Base map because it is the other reference layer the
  // farmer did not draw in the Studio. Before this it had no switch of its own: a boundary
  // inherited from a ring traced on the main map could only be removed by hiding the satellite
  // photo along with it.
  { key: 'boundary', labelKey: 'designPaletteLayerBoundary', icon: '🚧' },
  // "Existing", not "Ground": this layer is the farmer's EXISTING site reality (house/patio/lawn/
  // veg garden the app draws), i.e. the "Draw what's already here" chips — distinct from the
  // proposed Structures layer and from the satellite Base map. (Fable Q1; internal key stays.)
  { key: 'ground', labelKey: 'designPaletteLayerExisting', icon: '🏠' },
  { key: 'water', labelKey: 'designPaletteLayerWater', icon: '💧' },
  { key: 'earthworks', labelKey: 'designPaletteLayerEarthworks', icon: '⛏️' },
  { key: 'zones', labelKey: 'designPaletteLayerZones', icon: '🗺️' },
  { key: 'planting', labelKey: 'designPaletteLayerPlanting', icon: '🌱' },
  { key: 'structures', labelKey: 'designPaletteLayerStructures', icon: '🏚️' },
  { key: 'access', labelKey: 'designPaletteLayerAccess', icon: '🚪' },
  { key: 'animals', labelKey: 'designPaletteLayerAnimals', icon: '🐔' },
  { key: 'labels', labelKey: 'designPaletteLayerLabels', icon: '🏷️' },
  { key: 'symbols', labelKey: 'designPaletteLayerIcons', icon: '🔘' },
  { key: 'contours', labelKey: 'designPaletteLayerContours', icon: '⛰️' },
  { key: 'sector', labelKey: 'designPaletteLayerSector', icon: '☀️' },
];

// Element category → the layer toggle that shows/hides it. A Record (not a ternary chain) so
// adding an ElementCategory is a compile error here rather than a silent fall-through — the old
// `cat === 'water' ? … : 'structures'` form would have quietly filed earthworks under Structures.
const CATEGORY_LAYER: Record<DesignElementDef['category'], keyof ActiveLayers> = {
  water: 'water',
  earthworks: 'earthworks',
  growing: 'planting',
  structure: 'structures',
  animal: 'animals',
  access: 'access',
};

// Step → which element categories are placeable in the palette. Earthworks rides on the Water
// step (it IS the land-shaping that makes water behave — Scale of Permanence puts it directly
// after Water) and access rides with structures, so the step count stays phone-friendly.
// Derived from CATEGORY_STEP (lib/design-elements.ts) rather than a second literal list — that
// map is also what the canvas step-locking feature uses to decide which placed elements are
// editable from which step, and an adversarial review found the previous two-copies-of-the-
// same-idea setup had already let them silently disagree once (raised beds etc.).
function categoriesForStep(step: WizardStep): DesignElementDef['category'][] | 'all' {
  switch (step) {
    case 'water':
    case 'planting':
    case 'structures':
      return (Object.keys(CATEGORY_STEP) as DesignElementDef['category'][]).filter((c) => CATEGORY_STEP[c] === step);
    case 'base':
    case 'zones':
    case 'review':
    case 'glossy':
    default:
      return 'all';
  }
}

// Guided gets larger touch targets throughout (first-time/gogo farmer, less precise
// tapping); Pro stays at the standard 44px minimum so the whole catalog is scannable
// without excess scrolling.
// Screen space is the scarcest thing in this panel — it sits under the map and every row it
// takes is map the farmer cannot see (Rory: "we need more realestat shorten the text do what you
// need to!"). Every tool label is "<emoji> <word>" in all eleven locales, so showing the glyph
// alone and moving the word to title + aria-label buys back most of a row's width while the name
// stays available to a pointer and to a screen reader. A locale that ever translates WITHOUT a
// leading pictograph keeps its whole word rather than being cut to its first letter.
function toolGlyph(label: string): { glyph: string; full: string } {
  const full = label.trim();
  const m = full.match(/^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*(.+)$/u);
  return { glyph: m ? m[1] : full, full: m ? m[2] : full };
}

function toolButtonStyle(active: boolean, guided: boolean): React.CSSProperties {
  // Pro trims to a 36px target — a returning farmer on a laptop scanning a dense drafting view
  // gets the screen back. Guided stays at the 44px comfortable-touch minimum, which is not a
  // number to shave for layout.
  return {
    minHeight: guided ? 48 : 36,
    minWidth: guided ? 48 : 36,
    padding: guided ? '0 14px' : '0 10px',
    borderRadius: 10,
    border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
    background: active ? GREEN : PAPER,
    color: active ? PAPER : DARK,
    fontWeight: 600,
    fontSize: guided ? 14.5 : 13,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
    cursor: 'pointer',
  };
}

// Every chip row is a single horizontally-scrollable strip. It must never wrap and never widen the
// page — chips that don't fit scroll INSIDE the bar instead of being cut off at the right edge
// (Rory's screenshots). minWidth:0 lets the flex row shrink below its content so overflowX can
// actually scroll; children keep flexShrink:0 so they hold their size. touch scrolling + scroll
// padding make it feel native on a phone.
function scrollStripStyle(gap: number): React.CSSProperties {
  return {
    display: 'flex',
    gap,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    flexWrap: 'nowrap',
    scrollPaddingLeft: 4,
    scrollPaddingRight: 4,
    minWidth: 0,
    paddingBottom: 2,
  };
}

// Phone sheet: how tall the EXPANDED state may grow, as a viewport fraction — capped well short
// of 100% so the map is never fully covered (task requirement), leaving header + at least a
// sliver of map visible above it even on the shortest supported phone viewport. The COLLAPSED
// state deliberately has no cap at all: it is just the tool row's own intrinsic height, which is
// bounded by construction (a single non-wrapping horizontal strip of fixed-height buttons), so it
// never needs one.
const PHONE_SHEET_EXPANDED_MAX = '62dvh';

export default function DesignPalette({
  step,
  mode,
  tool,
  setTool,
  placeDefId,
  setPlaceDefId,
  zoneDraw,
  selectedZone,
  setZoneDraw,
  areaFeature,
  setAreaFeature,
  lineKind,
  setLineKind,
  activeLayers,
  setActiveLayers,
  textScaleControl,
  bedBlockControl,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDeleteSelected,
  onDuplicateSelected,
  onTidySelected,
  onSnapSelected,
  onCleanupSelected,
  angleControl,
  sizeControl,
  windControl,
  siteBiome,
}: DesignPaletteProps) {
  const { t } = useLanguage();
  const [hintDefId, setHintDefId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  // Raw text for the bed-block number fields while they are being edited. Held as strings so a
  // comma decimal, a trailing separator or an empty box survives long enough to finish typing.
  const [draft, setDraft] = useState<Partial<Record<'bedLengthM' | 'bedWidthM' | 'pathWidthM' | 'count', string>>>({});
  // Local UI-only toggle for the wind control's direction picker — never persisted, just whether
  // the 16-point list is currently open. Reset whenever the control's identity changes (observation
  // set/cleared) so re-opening the Sector step never leaves a stale picker expanded.
  const [windPicking, setWindPicking] = useState(false);
  // Right-edge "more this way" fade on the element strip. Tracked rather than always-on: a fade
  // still showing when you have scrolled to the last chip is a small lie, and the whole point of
  // the affordance is to be trusted.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripAtEnd, setStripAtEnd] = useState(true);
  const syncStripEnd = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setStripAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);
  // Phone bottom-sheet open/collapsed state (see the module comment for why phone gets a
  // different root entirely). Defaults OPEN: the whole reason this sheet exists is that the
  // element catalog must be visible with no extra action required — that was exactly what broke
  // (Rory: "i cant even see the element pallete"). Dragging the handle down, or tapping it,
  // collapses to the compact tool-row-only state to reclaim map space; it stays wherever the
  // farmer last left it (not reset per step) so repeated placing on one step doesn't fight it.
  const [sheetOpen, setSheetOpen] = useState(true);
  const sheetDragRef = useRef<{ startY: number; pointerId: number } | null>(null);
  const isPhone = usePhoneViewport();

  const guided = mode === 'guided';
  const hiddenLayerCount = LAYER_TOGGLES.filter((lt) => !activeLayers[lt.key]).length;

  // PRO reuses the existing 'all' path unconditionally — same catalog GUIDED already shows
  // on base/review/glossy, just no longer gated by step.
  const allowedCategories = mode === 'pro' ? 'all' : categoriesForStep(step);
  const isReadOnlyStep = step === 'base' || step === 'review' || step === 'glossy';
  // In guided mode the element catalog only belongs on the placing steps (water/planting/
  // structures). Base traces ground features, zones paints zones — showing the whole element
  // catalog there is pure clutter that buried the map. Pro keeps everything.
  const showElementCatalog = mode === 'pro' || allowedCategories !== 'all';
  const showFullCatalogNote = mode === 'pro';
  const siteClimates = biomeClimates(siteBiome);
  const stepCatalog =
    allowedCategories === 'all'
      ? ELEMENT_CATALOG
      : ELEMENT_CATALOG.filter((def) => allowedCategories.includes(def.category) || def.alsoSteps?.includes(step as 'water' | 'planting' | 'structures'));
  const visibleStepCatalog = stepCatalog.filter((def) => (step === 'planting' ? elementVisibleInPalette(def, siteClimates) : !def.deprecated));

  // In PRO the full catalog is overwhelming — honour the layer toggles so only elements whose
  // layer is switched ON appear (Rory: "only elements for the layers that are switched on should
  // show"). Category → layer mapping lives in CATEGORY_LAYER above.
  const catalog =
    mode === 'pro' ? visibleStepCatalog.filter((def) => activeLayers[CATEGORY_LAYER[def.category]]) : visibleStepCatalog;

  // Climate-appropriate trees: on the planting step, hide trees that do not crop in this site's
  // climate. Unknown site climate still shows all non-deprecated trees.
  const climateFilterActive = step === 'planting' && !!siteClimates;
  // NON-TREES FIRST on the planting step. This strip is a single horizontal scroller, and the
  // catalog's own order buried Pollinator Strip, Spekboom Hedge and Vetiver Row at positions
  // 20–22 of 22 — behind seven fruit trees, off the right edge, effectively unreachable (Rory:
  // "why is it not picking up the pollinator strips?"). They are not trees, so the climate sort
  // never lifted them: elementSuitsClimate returns true for everything it has no data on, which
  // means "don't demote", not "promote".
  // Beds, strips, hedges and banks are also what you lay out FIRST, and there are only a handful
  // of them, so putting them ahead of nineteen tree species is the right reading order anyway.
  // `tree_` prefix is the same discriminator producer-labels.ts uses for its TREES label family.
  const isTree = (def: DesignElementDef) => def.id.startsWith('tree_');
  const plantingOrder = (a: DesignElementDef, b: DesignElementDef) =>
    Number(isTree(a)) - Number(isTree(b)) ||
    Number(elementSuitsClimate(b.id, siteClimates)) - Number(elementSuitsClimate(a.id, siteClimates));
  const orderedCatalog = step === 'planting' ? [...catalog].sort(plantingOrder) : catalog;

  // Re-measure whenever the strip's CONTENTS change (step change, layer toggle) — not just on
  // scroll. A layer toggle can take the row from overflowing to fitting, and a stale fade would
  // then point at nothing. Also re-measure when the phone sheet opens/closes, since the strip is
  // unmounted while the sheet is collapsed (see renderElementCatalog's caller) and remounts with
  // a fresh, unmeasured scrollLeft.
  useEffect(syncStripEnd, [syncStripEnd, orderedCatalog.length, showElementCatalog, sheetOpen]);

  const hintDef = hintDefId ? catalog.find((d) => d.id === hintDefId) : null;
  const armedDef = placeDefId ? ELEMENT_CATALOG.find((d) => d.id === placeDefId) : null;

  // Which chip-driven controls are relevant for this step.
  const showZoneChips = step === 'zones';
  const showAreaChips = step === 'base';
  const showLineChips = step === 'water' || step === 'structures' || step === 'planting';
  const WATER_LINE_IDS: Array<LineShape['kind']> = ['swale', 'pipe', 'drip', 'greywater'];
  const STRUCTURE_LINE_IDS: Array<LineShape['kind']> = ['fence', 'path'];
  const PLANTING_LINE_IDS: Array<LineShape['kind']> = ['windbreak']; // was unreachable before
  const lineChipsForStep = LINE_KINDS.filter((lk) =>
    (step === 'water' ? WATER_LINE_IDS : step === 'planting' ? PLANTING_LINE_IDS : STRUCTURE_LINE_IDS).includes(lk.id)
  );

  function pickElement(def: DesignElementDef) {
    setAreaFeature(null); // arming a real element must not leave an area label armed
    if (placeDefId === def.id && tool === 'place') {
      // Tapping the armed chip again disarms.
      setPlaceDefId(null);
      setTool('select');
      setHintDefId(null);
    } else {
      setPlaceDefId(def.id);
      setTool('place');
      setHintDefId(def.id);
    }
  }

  function pickZone(z: 0 | 1 | 2 | 3 | 4 | 5) {
    setHintDefId(null);
    setAreaFeature(null); // a real permaculture zone must draw with feature=null
    if (zoneDraw === z && tool === 'zone') {
      setTool('select');
    } else {
      setZoneDraw(z);
      setTool('zone');
    }
  }

  // Arm the (shared) polygon-draw tool to record a ground feature. Same tool as zones —
  // the areaFeature label is what makes the committed ring a built/ground feature.
  function pickArea(kind: GroundFeatureKind) {
    setHintDefId(null);
    setPlaceDefId(null);
    if (areaFeature === kind && tool === 'zone') {
      setAreaFeature(null);
      setTool('select');
    } else {
      setAreaFeature(kind);
      setTool('zone');
    }
  }

  function pickLine(kind: LineShape['kind']) {
    setHintDefId(null);
    setAreaFeature(null);
    if (lineKind === kind && tool === 'line') {
      setTool('select');
    } else {
      setLineKind(kind);
      setTool('line');
    }
  }

  const armedHintLabel =
    tool === 'place' && armedDef
      ? formatDesignTranslation(t('designPaletteTapPlace'), { name: armedDef.name })
      : tool === 'zone' && areaFeature
        ? formatDesignTranslation(t('designPaletteDrawFeature'), { feature: GROUND_FEATURES[areaFeature].label })
        : tool === 'zone'
          ? formatDesignTranslation(t('designPalettePaintZone'), { zone: zoneDraw })
          : tool === 'line'
            ? t('designPaletteTapCorners')
            : null;

  // The lesson for whatever's currently armed — connects zones, ground features, drawn lines and
  // placed elements to their teaching lesson from the same hint box (no extra UI rows).
  const armedLessonId =
    tool === 'place' && armedDef
      ? `element:${armedDef.id}`
      : tool === 'zone' && areaFeature
        ? `feature:${areaFeature}`
        : tool === 'zone'
          ? `zone:${zoneDraw}`
          : tool === 'line'
            ? `line:${lineKind}`
            : null;

  // ---- Row renderers ------------------------------------------------------------------------
  // Shared by the desktop docked layout and the phone bottom sheet, so there is exactly ONE copy
  // of each row's markup/behaviour — no risk of the two layouts silently drifting apart. None of
  // these render their own outer scroll/height wrapper; the caller (desktop's maxHeight region,
  // or the phone sheet's body) owns that.

  function renderToolRow() {
    return (
      <>
        {/* Tool row: Select · Undo · Delete (scrolls) + Layers pinned right (always visible, so
            it can never fall off the bottom of the page). */}
        <div style={{ display: 'flex', gap: guided ? 10 : 6, alignItems: 'center', paddingBottom: 2 }}>
          <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            title={toolGlyph(t('designPaletteSelect')).full}
            aria-label={toolGlyph(t('designPaletteSelect')).full}
            style={toolButtonStyle(tool === 'select', guided)}
            onClick={() => {
              setTool('select');
              setHintDefId(null);
            }}
          >
            {toolGlyph(t('designPaletteSelect')).glyph}
          </button>
          <button
            type="button"
            style={{ ...toolButtonStyle(false, guided), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
            onClick={onUndo}
            disabled={!canUndo}
          
            title={toolGlyph(t('designPaletteUndo')).full}
            aria-label={toolGlyph(t('designPaletteUndo')).full}>
            {toolGlyph(t('designPaletteUndo')).glyph}
          </button>
          <button
            type="button"
            style={{ ...toolButtonStyle(false, guided), opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}
            onClick={onRedo}
            disabled={!canRedo}
          
            title={toolGlyph(t('designPaletteRedo')).full}
            aria-label={toolGlyph(t('designPaletteRedo')).full}>
            {toolGlyph(t('designPaletteRedo')).glyph}
          </button>
          <button
            type="button"
            aria-label={toolGlyph(t('designPaletteDuplicate')).full}
            style={{
              ...toolButtonStyle(false, guided),
              opacity: onDuplicateSelected ? 1 : 0.4,
              cursor: onDuplicateSelected ? 'pointer' : 'default',
            }}
            onClick={() => onDuplicateSelected?.()}
            disabled={!onDuplicateSelected}
            title={t('designPaletteDuplicateTitle')}
          >
            {toolGlyph(t('designPaletteDuplicate')).glyph}
          </button>
          {/* Tidy outline — offered only when exactly one zone or line is selected (a placed item
              has no ring/polyline to simplify, and a multi-selection has no single shape to preview
              — see onTidySelected's doc comment in DesignPaletteProps). Tapping this only OPENS the
              preview on the canvas; it never itself edits the design. */}
          <button
            type="button"
            aria-label={toolGlyph(t('designPaletteTidy')).full}
            style={{
              ...toolButtonStyle(false, guided),
              opacity: onTidySelected ? 1 : 0.4,
              cursor: onTidySelected ? 'pointer' : 'default',
            }}
            onClick={() => onTidySelected?.()}
            disabled={!onTidySelected}
            title={t('designPaletteTidyTitle')}
          >
            {toolGlyph(t('designPaletteTidy')).glyph}
          </button>
          {/* Snap to neighbour — offered for one or more selected rings, provided at least one can
              move. A selected boundary stays unchanged and is called out in the preview. */}
          <button
            type="button"
            aria-label={toolGlyph(t('designPaletteSnap')).full}
            style={{
              ...toolButtonStyle(false, guided),
              opacity: onSnapSelected ? 1 : 0.4,
              cursor: onSnapSelected ? 'pointer' : 'default',
            }}
            onClick={() => onSnapSelected?.()}
            disabled={!onSnapSelected}
            title={t('designPaletteSnapTitle')}
          >
            {toolGlyph(t('designPaletteSnap')).glyph}
          </button>
          {/* Clean up — offered only when 2+ placed items (never zones/lines) are selected. See
              onCleanupSelected's doc comment in DesignPaletteProps. Tapping this only OPENS the
              preview on the canvas; it never itself edits the design. */}
          <button
            type="button"
            aria-label={toolGlyph(t('designPaletteCleanup')).full}
            style={{
              ...toolButtonStyle(false, guided),
              opacity: onCleanupSelected ? 1 : 0.4,
              cursor: onCleanupSelected ? 'pointer' : 'default',
            }}
            onClick={() => onCleanupSelected?.()}
            disabled={!onCleanupSelected}
            title={t('designPaletteCleanupTitle')}
          >
            {toolGlyph(t('designPaletteCleanup')).glyph}
          </button>
          {/* Angle field — rect-shaped items only (circles are rotation-invariant, and a LineShape
              polyline deliberately has NO angle control here: a polyline has no single angle, and
              "rotating" one would mean rewriting every saved point, not turning one number. That is
              a scope decision, not an oversight — see angleControl's doc comment above). */}
          {angleControl && (
            <div
              style={{
                minHeight: guided ? 52 : 44,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                padding: guided ? '0 12px' : '0 10px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.15)',
                background: PAPER,
                color: DARK,
                fontWeight: 600,
                fontSize: guided ? 14.5 : 13,
              }}
            >
              <span aria-hidden style={{ fontSize: guided ? 13 : 11.5 }}>
                ∠
              </span>
              <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>{t('designPaletteAngle')}</span>
              <input
                // Uncontrolled + keyed on the committed value: typing never round-trips through
                // parent state per keystroke (no mid-typing canvas jumps), but the field still picks
                // up outside changes — undo/redo, the drag-rotate handle, or switching selection to
                // another item — because a changed `angleControl.deg` changes `key` and remounts the
                // input fresh from `defaultValue`.
                key={angleControl.deg}
                defaultValue={angleControl.deg}
                type="number"
                inputMode="numeric"
                min={0}
                max={359}
                step={1}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const raw = Number(e.target.value);
                  if (!Number.isFinite(raw)) {
                    e.currentTarget.value = String(angleControl.deg);
                    return;
                  }
                  // Snap the field to what will actually be stored right away — normaliseRotation
                  // wraps/rounds/zero-maps the same way the parent's commit does, so e.g. typing
                  // "359.6" reads back as "0" immediately rather than sitting there mismatched until
                  // some unrelated re-render happens to remount the field.
                  e.currentTarget.value = String(normaliseRotation(raw) ?? 0);
                  angleControl.onRotate(raw);
                }}
                style={{
                  width: 44,
                  minHeight: guided ? 34 : 28,
                  border: '1px solid rgba(0,0,0,0.18)',
                  borderRadius: 7,
                  background: PAPER,
                  color: DARK,
                  fontSize: guided ? 13.5 : 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '2px 2px',
                }}
              />
              <span style={{ fontSize: guided ? 13 : 11.5 }}>°</span>
            </div>
          )}
          {/* Size — grows/shrinks EVERY selected item in place (multi-select friendly, unlike the
              per-item drag grips). ±10% per tap; the parent clamps to the same 0.3–40 m bounds as
              drag-resize, so mashing a button can never zero an item or blow it past the plot. */}
          {sizeControl && (
            <div
              style={{
                minHeight: guided ? 52 : 44,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                padding: guided ? '0 12px' : '0 10px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.15)',
                background: PAPER,
                color: DARK,
                fontWeight: 600,
                fontSize: guided ? 14.5 : 13,
              }}
            >
              <span aria-hidden style={{ fontSize: guided ? 13 : 11.5 }}>
                ⤢
              </span>
              <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>{t('designPaletteSize')}</span>
              {([['−', 0.9, t('designPaletteSizeDown')], ['+', 1.1, t('designPaletteSizeUp')]] as const).map(([glyph, factor, title]) => (
                <button
                  key={glyph}
                  type="button"
                  title={title}
                  aria-label={title}
                  onClick={() => sizeControl.onScale(factor)}
                  style={{
                    width: guided ? 38 : 32,
                    minHeight: guided ? 34 : 28,
                    border: '1px solid rgba(0,0,0,0.18)',
                    borderRadius: 7,
                    background: PAPER,
                    color: DARK,
                    fontSize: guided ? 16 : 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {glyph}
                </button>
              ))}
              {/* Exact dimensions — "with beds we need to be specific". Shows the selection's
                  common value, or a '—' placeholder when members differ; typing a number sets
                  that dimension on every selected item (a circle takes it as its diameter). */}
              {([
                ['wM', sizeControl.wM, t('designPaletteSizeWidth'), t('designPaletteSizeWidthTitle')],
                ['hM', sizeControl.hM, t('designPaletteSizeHeight'), t('designPaletteSizeHeightTitle')],
              ] as const).map(([dim, committed, label, title]) => (
                <span key={dim} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>{label}</span>
                  <input
                    key={`${dim}:${committed ?? 'mixed'}`}
                    defaultValue={committed != null ? String(+committed.toFixed(2)) : ''}
                    placeholder="—"
                    title={title}
                    aria-label={title}
                    type="number"
                    inputMode="decimal"
                    min={0.3}
                    max={40}
                    step={0.1}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      const reset = () => {
                        e.currentTarget.value = committed != null ? String(+committed.toFixed(2)) : '';
                      };
                      const raw = e.target.value.trim();
                      if (!raw) return reset();
                      const v = Number(raw);
                      // No-op commits are skipped so blurring an untouched field never spends
                      // an undo entry.
                      if (!Number.isFinite(v) || (committed != null && Math.abs(v - committed) < 0.005)) return reset();
                      sizeControl.onSetDim(dim, v);
                    }}
                    style={{
                      width: 52,
                      minHeight: guided ? 34 : 28,
                      border: '1px solid rgba(0,0,0,0.18)',
                      borderRadius: 7,
                      background: PAPER,
                      color: DARK,
                      fontSize: guided ? 13.5 : 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      padding: '2px 2px',
                    }}
                  />
                </span>
              ))}
              <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>m</span>
            </div>
          )}
          <button
            type="button"
            title={toolGlyph(t('designPaletteDelete')).full}
            aria-label={toolGlyph(t('designPaletteDelete')).full}
            style={{
              ...toolButtonStyle(false, guided),
              opacity: onDeleteSelected ? 1 : 0.4,
              cursor: onDeleteSelected ? 'pointer' : 'default',
              borderColor: onDeleteSelected ? '#B53A3A' : 'rgba(0,0,0,0.15)',
              color: onDeleteSelected ? '#B53A3A' : DARK,
            }}
            onClick={() => onDeleteSelected?.()}
            disabled={!onDeleteSelected}
          >
            {toolGlyph(t('designPaletteDelete')).glyph}
          </button>
          </div>
          {/* Layers — pinned right of the tool row, always on screen. Popover opens upward over
              the map (its wrapper isn't an overflow container, so it's never clipped) — true in
              BOTH the desktop docked layout and the phone sheet; neither root ever sets
              overflow:hidden/auto (see the module comment at the top of this file). */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setLayersOpen((v) => !v)}
              aria-expanded={layersOpen}
              style={{
                minHeight: guided ? 40 : 32,
                padding: '4px 12px',
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                background: layersOpen ? GREEN : hiddenLayerCount ? 'rgba(31,77,43,0.10)' : PAPER,
                color: layersOpen ? PAPER : DARK,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden>🛰️</span>
              <span>{t('designPaletteLayers')}</span>
              {hiddenLayerCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: layersOpen ? GOLD : GREEN }}>{hiddenLayerCount} {t('designPaletteOff')}</span>
              )}
            </button>
            {layersOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 30,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  width: 300,
                  maxWidth: '80vw',
                  padding: 10,
                  borderRadius: 12,
                  background: PAPER,
                  border: '1px solid rgba(0,0,0,0.15)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                {/* Master switch — flip every layer at once instead of tapping nine chips. */}
                <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.5, marginRight: 'auto' }}>
                    {t('designPaletteLayers')}
                  </span>
                  {([[t('designPaletteAllOn'), true], [t('designPaletteAllOff'), false]] as const).map(([label, val]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveLayers(LAYER_TOGGLES.reduce((acc, lt) => ({ ...acc, [lt.key]: val }), { ...activeLayers }))}
                      style={{
                        minHeight: 28,
                        padding: '3px 10px',
                        borderRadius: 14,
                        border: `1px solid ${GREEN}`,
                        background: 'transparent',
                        color: GREEN,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {LAYER_TOGGLES.map((lt) => {
                  const on = activeLayers[lt.key];
                  return (
                    <button
                      key={lt.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActiveLayers({ ...activeLayers, [lt.key]: !on })}
                      style={{
                        minHeight: 36,
                        padding: '5px 11px',
                        borderRadius: 16,
                        border: on ? `1.5px solid ${GREEN}` : '1px solid rgba(0,0,0,0.15)',
                        background: on ? 'rgba(31,77,43,0.12)' : 'transparent',
                        color: DARK,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        opacity: on ? 1 : 0.5,
                      }}
                    >
                      <span>{lt.icon}</span>
                      <span>{t(lt.labelKey)}</span>
                    </button>
                  );
                })}
                {/* Icon + label size. Lives with Labels and Icons because it is the same
                    question — how loud should the annotation be — and a farmer who has just
                    turned Labels on to read them wants the size control in the same place.
                    One slider drives both: an icon and its name read as a single mark. */}
                {textScaleControl && (
                  <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px 0' }}>
                    <span style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>🔍 {t('designPaletteSymbolSize')}</span>
                    <input
                      type="range"
                      min={MIN_MAP_TEXT_SCALE}
                      max={MAX_MAP_TEXT_SCALE}
                      step={0.1}
                      value={textScaleControl.value}
                      onChange={(e) => textScaleControl.onChange(Number(e.target.value))}
                      aria-label={t('designPaletteSymbolSize')}
                      style={{ flex: 1, minWidth: 90, accentColor: GREEN, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(textScaleControl.value * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderElementCatalog() {
    if (!showElementCatalog) return null;
    return (
      /* Element chips: shown on placing steps (and all steps in Pro) */
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showFullCatalogNote && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            {orderedCatalog.length === 0
              ? t('designPaletteNoLayers')
              : t('designPaletteProLayers')}
          </div>
        )}
        {/* One line, and only one — this note explains a filter the farmer did not ask for, so it
            has to be present but must not spend two lines of a panel competing with the map. The
            full sentence stays available on hover/long-press rather than being cut from the app. */}
        {climateFilterActive && (
          <div
            title={`${t('designPaletteClimate')}${siteBiome ? formatDesignTranslation(t('designPaletteClimateFor'), { biome: siteBiome }) : ''}${t('designPaletteClimateHidden')}`}
            style={{
              fontSize: 10.5, color: '#6B6355', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}
          >
            {t('designPaletteClimate')}
            {siteBiome ? formatDesignTranslation(t('designPaletteClimateFor'), { biome: siteBiome }) : ''}
            {t('designPaletteClimateHidden')}
          </div>
        )}
        {/* Wrapped so the "there is more to the right" fade can sit over the strip's right edge.
            Without it a 22-element catalog looks like a 16-element one: the scrollbar is a few
            faint pixels and nothing else says the row continues. */}
        <div style={{ position: 'relative', minWidth: 0 }}>
        <div ref={stripRef} onScroll={syncStripEnd} style={scrollStripStyle(guided ? 10 : 6)}>
          {orderedCatalog.map((def) => {
            const active = placeDefId === def.id && tool === 'place';
            const suited = !climateFilterActive || elementSuitsClimate(def.id, siteClimates);
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => pickElement(def)}
                title={suited ? undefined : formatDesignTranslation(t('designPaletteClimateTitle'), { name: def.name })}
                // ONE ROW, not three stacked lines. Emoji over name over size made every card as
                // tall as three lines of type, and this strip sits in a panel already carrying a
                // status row, a tool row, a hint and the bed-block controls — the map was losing
                // close to half the screen to chrome (Rory: "the element button are to big this
                // bottom modal needs to be smalle you need to conserv space someow"). Guided keeps
                // a 44px target: shrinking a first-time farmer's tap area to save pixels trades
                // the wrong thing.
                style={{
                  position: 'relative',
                  minHeight: guided ? 44 : 34,
                  padding: guided ? '4px 10px' : '3px 8px',
                  borderRadius: 9,
                  border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                  background: active ? GREEN : PAPER,
                  color: active ? PAPER : DARK,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                  cursor: 'pointer',
                  opacity: suited ? 1 : 0.45,
                }}
              >
                <span style={{ fontSize: guided ? 16 : 13, lineHeight: 1 }}>{def.icon}</span>
                <span style={{ fontSize: guided ? 11.5 : 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{def.name}</span>
                <span style={{ fontSize: guided ? 9.5 : 8.5, opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {def.shape === 'circle' ? `⌀${def.wM}m` : `${def.wM}×${def.hM}m`}
                </span>
              </button>
            );
          })}
        </div>
        {!stripAtEnd && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 34,
              pointerEvents: 'none',
              background: `linear-gradient(to right, rgba(255,255,255,0), ${PAPER})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              color: '#6B6355',
              fontSize: 15,
            }}
          >
            ›
          </div>
        )}
        </div>
      </div>
    );
  }

  function renderAreaChips() {
    if (!showAreaChips) return null;
    return (
      /* Base step: ground-feature chips — draw the real house / paving / lawn / veg garden /
          orchard / cleared ground that's already on site (filled labelled areas). */
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11.5, color: '#6B6355' }}>{t('designPaletteExistingHelp')}</div>
        <div style={scrollStripStyle(guided ? 10 : 6)}>
          {GROUND_FEATURE_KINDS.map((kind) => {
            const gf = GROUND_FEATURES[kind];
            const active = areaFeature === kind && tool === 'zone';
            return (
              <button
                key={kind}
                type="button"
                onClick={() => pickArea(kind)}
                style={{
                  minHeight: guided ? 52 : 44,
                  padding: guided ? '8px 14px' : '6px 12px',
                  borderRadius: 10,
                  border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                  background: active ? GREEN : PAPER,
                  color: active ? PAPER : DARK,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: guided ? 13.5 : 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: gf.color,
                    border: '1px solid rgba(11,18,11,0.3)',
                  }}
                />
                <span style={{ whiteSpace: 'nowrap' }}>{gf.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSectorWind() {
    if (!(step === 'sector' && windControl)) return null;
    return (
      /* Sector step: confirm/override the farmer's on-site wind observation
          (lib/local-wind.ts LocalWindObservation) — same chip-row idiom as the Base/Zones blocks
          above, but a confirm/change/not-sure interaction rather than a draw-tool arm, since this
          control commits a value directly instead of arming the canvas. The 16-point list (no
          typing, no degrees — see CompassDirection16's own comment in lib/local-wind.ts for why 16
          over 8) only appears once the farmer taps Change/Set direction. */
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {windControl.observation ? (
          <>
            <div style={{ fontSize: 11.5, color: '#6B6355' }}>
              {t('designPaletteWindConfirmed')} <strong style={{ color: DARK }}>{windControl.observation.prevailingFrom}</strong>
              {' '}{formatDesignTranslation(t('designPaletteRecorded'), {
                date: new Date(windControl.observation.recordedAt).toLocaleDateString(),
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setWindPicking((v) => !v)}
                style={{ minHeight: guided ? 44 : 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: PAPER, color: DARK, cursor: 'pointer', fontWeight: 600, fontSize: guided ? 12.5 : 11.5 }}
              >
                ✏️ {t('designPaletteChange')}
              </button>
              <button
                type="button"
                onClick={() => { windControl.onSet(null); setWindPicking(false); }}
                style={{ minHeight: guided ? 44 : 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: PAPER, color: DARK, cursor: 'pointer', fontWeight: 600, fontSize: guided ? 12.5 : 11.5 }}
              >
                ✕ {t('designPaletteClear')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: '#6B6355' }}>
              {windControl.regional
                ? formatDesignTranslation(t('designPaletteRegionalWind'), { direction: windControl.regional.fromLabel })
                : t('designPaletteNoRegionalWind')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {windControl.regional && (
                <button
                  type="button"
                  onClick={() => {
                    const label = windControl.regional!.fromLabel;
                    if (!isCompassDirection16(label)) return; // defensive — regional labels are always 16-point in practice
                    windControl.onSet({ prevailingFrom: label, recordedAt: new Date().toISOString() });
                    setWindPicking(false);
                  }}
                  style={{ minHeight: guided ? 44 : 36, padding: '0 12px', borderRadius: 10, border: `2px solid ${GOLD}`, background: GREEN, color: PAPER, cursor: 'pointer', fontWeight: 700, fontSize: guided ? 12.5 : 11.5 }}
                >
                  ✅ {t('designPaletteConfirm')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setWindPicking((v) => !v)}
                style={{ minHeight: guided ? 44 : 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: PAPER, color: DARK, cursor: 'pointer', fontWeight: 600, fontSize: guided ? 12.5 : 11.5 }}
              >
                ✏️ {t(windControl.regional ? 'designPaletteChange' : 'designPaletteSetDirection')}
              </button>
              <button
                type="button"
                onClick={() => { windControl.onSet(null); setWindPicking(false); }}
                style={{ minHeight: guided ? 44 : 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: PAPER, color: DARK, cursor: 'pointer', fontWeight: 600, fontSize: guided ? 12.5 : 11.5 }}
              >
                🤷 {t('designPaletteNotSure')}
              </button>
            </div>
          </>
        )}
        {windPicking && (
          <div style={scrollStripStyle(guided ? 10 : 6)}>
            {COMPASS16_ORDER.map((dir) => {
              const active = windControl.observation?.prevailingFrom === dir;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    windControl.onSet({ prevailingFrom: dir, recordedAt: new Date().toISOString() });
                    setWindPicking(false);
                  }}
                  style={{
                    minHeight: guided ? 44 : 36,
                    minWidth: guided ? 44 : 36,
                    padding: '0 8px',
                    borderRadius: 10,
                    border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                    background: active ? GREEN : PAPER,
                    color: active ? PAPER : DARK,
                    flexShrink: 0,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: guided ? 12.5 : 11,
                  }}
                >
                  {dir}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderZoneChips() {
    if (!showZoneChips) return null;
    return (
      /* Zones step: always show the zone 0-5 colour chips row */
      <div style={scrollStripStyle(guided ? 10 : 6)}>
        {/* .map(Number) is load-bearing, not tidying. Object.keys returns STRINGS, and the old
            `as unknown as Array<0|1|2|3|4|5>` cast asserted otherwise without changing anything,
            so `z` was '3' at runtime. That stayed invisible because it was self-consistent:
            pickZone('3') put the string into zoneDraw and `zoneDraw === z` compared '3' === '3'.
            Two things it did break — the chip never matched a numeric selectedZone (0 chips lit
            when a zone was selected), and DesignCanvas writes zoneDraw straight into
            ZoneShape.zone, so every zone drawn after a chip tap PERSISTED zone:'3'. Loading
            normalises it back to a number, which is why the map always looked right; it is the
            same string-vs-number coercion that once made the Zones step read 0 of 4 rings. */}
        {(Object.keys(ZONE_DEFS).map(Number) as Array<0 | 1 | 2 | 3 | 4 | 5>).map((z) => {
          const def = ZONE_DEFS[z];
          const armed = zoneDraw === z && tool === 'zone';
          // Selecting a zone lights its chip too. Same gold ring as the armed state — to the
          // farmer both mean "this is the zone in play"; which of the two put it there is our
          // business, not theirs. The extra glow is what keeps a lit chip readable against its
          // own fill on the darker zones (4 and 5) where a gold hairline alone all but vanishes.
          const active = armed || selectedZone === z;
          return (
            <button
              key={z}
              type="button"
              aria-pressed={active}
              onClick={() => pickZone(z)}
              style={{
                minHeight: guided ? 52 : 44,
                padding: guided ? '8px 16px' : '6px 12px',
                borderRadius: 10,
                border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                boxShadow: active ? `0 0 0 3px ${GOLD}33` : 'none',
                background: def.color,
                color: PAPER,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: guided ? 13.5 : 12,
              }}
            >
              <span>{z}</span>
              <span style={{ fontWeight: 500, fontSize: guided ? 12.5 : 11 }}>{def.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderLineChips() {
    if (!showLineChips) return null;
    return (
      /* Water/Structures step: compact line-kind chips row */
      <div style={scrollStripStyle(guided ? 10 : 6)}>
        {lineChipsForStep.map((lk) => {
          const active = lineKind === lk.id && tool === 'line';
          return (
            <button
              key={lk.id}
              type="button"
              onClick={() => pickLine(lk.id)}
              style={{
                minHeight: guided ? 52 : 44,
                padding: guided ? '8px 16px' : '6px 12px',
                borderRadius: 10,
                border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                background: active ? GREEN : PAPER,
                color: active ? PAPER : DARK,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: guided ? 13.5 : 12,
              }}
            >
              <span>{lk.icon}</span>
              <span>{t(lk.labelKey)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderHint() {
    if (!(armedHintLabel || hintDef)) return null;
    return (
      /* Hint line: armed state, or a def tip on tap */
      <div
        style={{
          fontSize: 11.5,
          color: DARK,
          background: 'rgba(247,201,126,0.25)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8,
          padding: '6px 10px',
        }}
      >
        {hintDef ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              {hintDef.icon} <strong>{hintDef.name}:</strong> {hintDef.tip}
            </div>
            <LessonLink id={`element:${hintDef.id}`} label={t('designPaletteLearnAbout')} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>{armedHintLabel}</div>
            {armedLessonId && <LessonLink id={armedLessonId} label={t('designPaletteLearnAbout')} />}
          </div>
        )}
      </div>
    );
  }

  // A whole block of beds in one action, on the step where beds live. Four numbers, then arm it
  // and tap a corner on the canvas — the block swings around that corner until the second tap.
  // Sits above the element catalog rather than inside it because it is not one more thing to
  // place: it places many, with its own gesture.
  function renderBedBlock() {
    if (!bedBlockControl || step !== 'planting') return null;
    const { spec, armed, onSpecChange, onArm, onCancel } = bedBlockControl;
    // Label BESIDE the input, not above it. Stacked, this row stood taller than every other chip
    // strip and the parent clipped its bottom edge — the number boxes were cut in half and the
    // button floated out of line (Rory: "things are cramped here"). One line keeps it the same
    // height as the element and zone strips it sits among, which is what makes it read as one of
    // them rather than as a panel that broke.
    const field = (
      label: string,
      value: number,
      key: 'bedLengthM' | 'bedWidthM' | 'pathWidthM' | 'count',
      opts: { step: number; min: number; max: number },
    ) => (
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: DARK, flexShrink: 0 }}>
        <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{label}</span>
        <input
          // TEXT, not number, and parsed by hand. A type="number" input in a comma-decimal
          // locale — which is what a South African browser is — hands back an EMPTY STRING for a
          // value the farmer can plainly read in the box ("0,5"). Number("") is 0, and 0 is
          // finite, so every guard downstream accepted it: the spec arrived with a path width of
          // zero, the beds were laid out touching, and bedBlockPaths correctly drew nothing for a
          // zero-width path. The maths was right the whole way down and the input threw the value
          // away before any of it ran (Rory: "no path still! between beds").
          type="text"
          inputMode="decimal"
          value={draft[key] ?? String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            // Keep whatever was typed on screen, including mid-edit states like "" or "0," that
            // are not yet a number — snapping the box back under the farmer's fingers is how a
            // field becomes impossible to edit.
            setDraft((d) => ({ ...d, [key]: raw }));
            const parsed = Number(raw.replace(',', '.').trim());
            if (raw.trim() !== '' && Number.isFinite(parsed)) onSpecChange({ [key]: parsed });
          }}
          // On blur the box shows the value that is actually in the spec, so a half-typed entry
          // can never sit there looking committed.
          onBlur={() => setDraft((d) => ({ ...d, [key]: undefined }))}
          style={{
            width: 52, minHeight: guided ? 44 : 38, padding: '4px 6px', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.2)', background: PAPER, color: DARK,
            fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          }}
        />
      </label>
    );
    return (
      <div style={{ ...scrollStripStyle(guided ? 10 : 6), alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: DARK, alignSelf: 'center', whiteSpace: 'nowrap' }}>
          🛏️ {t('designPaletteBedBlock')}
        </span>
        {field(t('designPaletteBedLength'), spec.bedLengthM, 'bedLengthM', { step: 0.5, min: 0.2, max: 200 })}
        {field(t('designPaletteBedWidth'), spec.bedWidthM, 'bedWidthM', { step: 0.1, min: 0.2, max: 200 })}
        {field(t('designPaletteBedPath'), spec.pathWidthM, 'pathWidthM', { step: 0.1, min: 0, max: 50 })}
        {field(t('designPaletteBedCount'), spec.count, 'count', { step: 1, min: MIN_BED_COUNT, max: MAX_BED_COUNT })}
        <button
          type="button"
          onClick={armed ? onCancel : onArm}
          aria-pressed={armed}
          style={{
            minHeight: guided ? 52 : 44, padding: '0 16px', borderRadius: 10, flexShrink: 0,
            border: armed ? `2px solid ${GOLD}` : `1px solid ${GREEN}`,
            background: armed ? GREEN : 'transparent',
            color: armed ? PAPER : GREEN,
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
          }}
        >
          {armed ? t('designPaletteBedBlockCancel') : t('designPaletteBedBlockPlace')}
        </button>
      </div>
    );
  }

  function renderBodyRows() {
    return (
      <>
        {renderBedBlock()}
        {renderElementCatalog()}
        {renderAreaChips()}
        {renderSectorWind()}
        {renderZoneChips()}
        {renderLineChips()}
        {renderHint()}
      </>
    );
  }

  // ---- Phone bottom sheet --------------------------------------------------------------------
  // Handle drag/tap: a plain tap (movement under the threshold) TOGGLES; a real drag forces the
  // state in the dragged direction. No live-follow animation while dragging — the sheet only
  // ever snaps between its two fixed states on release, so prefers-reduced-motion needs no extra
  // handling here (there is no animation to disable in the first place).
  const SHEET_DRAG_THRESHOLD = 24;

  function handleHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    sheetDragRef.current = { startY: e.clientY, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handleHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const ds = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const dy = e.clientY - ds.startY;
    if (dy < -SHEET_DRAG_THRESHOLD) setSheetOpen(true);
    else if (dy > SHEET_DRAG_THRESHOLD) setSheetOpen(false);
    else setSheetOpen((v) => !v); // plain tap
  }

  function handleHandlePointerCancel() {
    sheetDragRef.current = null;
  }

  if (isPhone) {
    return (
      <div
        style={{
          // Fixed to the TRUE viewport, not the page's own overflowing flex column — see the
          // module comment at the top of this file for why that distinction is the entire fix.
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.18)',
          // NEVER overflow:hidden/auto on this root — the Layers popover (inside renderToolRow)
          // opens upward with position:absolute and needs no clipping ancestor. Only the body
          // region below (a sibling of the tool row, not an ancestor) is allowed to scroll.
          overflow: 'visible',
          maxHeight: sheetOpen ? PHONE_SHEET_EXPANDED_MAX : undefined,
          fontFamily: 'inherit',
        }}
      >
        {/* Drag handle — tap toggles open/closed; dragging past a small threshold forces the
            state in that direction. touchAction:'none' + pointer capture match the drag-handle
            pattern already used throughout DesignCanvas.tsx. */}
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerCancel}
          role="button"
          tabIndex={0}
          aria-expanded={sheetOpen}
          aria-label={t(sheetOpen ? 'designPaletteCollapse' : 'designPaletteExpand')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSheetOpen((v) => !v);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 28,
            flexShrink: 0,
            touchAction: 'none',
            cursor: 'grab',
          }}
        >
          <span aria-hidden style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(11,18,11,0.25)' }} />
        </div>
        {/* Tool row — always present regardless of open/collapsed, and never inside the
            scrollable body below, so the Layers popover keeps its "no overflow ancestor"
            guarantee and Select/Undo/Delete stay one tap away even collapsed. Its own content is
            bounded by construction (a single non-wrapping horizontal strip), so it never needs an
            explicit height cap. */}
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, flexShrink: 0 }}>
          {renderToolRow()}
        </div>
        {sheetOpen && (
          <div
            style={{
              padding: '0 12px calc(8px + env(safe-area-inset-bottom))',
              display: 'flex',
              flexDirection: 'column',
              gap: guided ? 10 : 6,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              // minHeight:0 is load-bearing: without it a column flex child defaults to
              // min-height:auto (its own content size), which blocks flex-shrink from ever
              // compressing it below that — exactly the trap that made the maxHeight+overflow
              // idiom a no-op the first time (see module comment). flex:1 lets THIS region (and
              // only this region) absorb whatever height the sheet's maxHeight cap leaves after
              // the handle and tool row, and its own overflow-y:auto then genuinely engages.
              minHeight: 0,
              flex: 1,
            }}
          >
            {renderBodyRows()}
          </div>
        )}
        {!sheetOpen && <div style={{ height: 'calc(6px + env(safe-area-inset-bottom))', flexShrink: 0 }} />}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: guided ? 10 : 6,
        fontFamily: 'inherit',
        // Docked bar: gutter so chips don't touch the screen edges, and safe-area padding so the
        // bottom row clears the phone's home indicator instead of rendering below the viewport.
        padding: '0 12px',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom))',
      }}
    >
      {renderToolRow()}

      {/* Below the tool row, everything is unbounded in height: the element catalog can carry a
          note line, the hint/lesson block can run to two lines, and which chip row shows at all
          varies by step. None of that has ever had its own scroll boundary — it just relied on
          the page happening to be tall enough. It usually isn't: <body> is `h-screen
          overflow-hidden` (app/layout.tsx) with no fallback page scroll, and the canvas above
          this bar has a deliberate non-negotiable `minHeight: 45dvh` floor (app/design/page.tsx)
          so tool chrome can never squeeze it away. On DESKTOP viewports (this branch — phone gets
          the fixed bottom sheet above instead) there is normally enough room for this region's
          own content to fit inside its 30dvh cap with no internal scrolling ever engaging; the
          cap plus overflow-y:auto stays here as a safety net for an unusually short desktop
          window. Scoped to start AFTER the tool row on purpose: the Layers popover lives inside
          the tool row and opens upward with no overflow ancestor of its own ("never clipped" —
          see its comment above); wrapping the tool row in this too would clip it. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0, maxHeight: '30dvh' }}>
        {renderBodyRows()}
      </div>
    </div>
  );
}

// Re-export category metadata for convenience if a parent wants labels (not required by spec,
// but harmless and avoids a second import path for the same data).
export { CATEGORY_META };
