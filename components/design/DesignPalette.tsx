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
// The Layers popover (inside renderToolRow) must not have an overflow ancestor. It opens down
// into a desktop aside (there is room below) and upward from the phone sheet (there is not), with
// its own scroll cap in either case. Only the BODY region, a sibling of the tool row, may clip.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// How long a tip stays before closing itself. See the state that drives it for why this is not
// the four seconds first suggested: four is under the reading time of the tips themselves.
const HINT_VISIBLE_MS = 8000;
import type { GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import {
  normaliseRotation, MIN_MAP_TEXT_SCALE, MAX_MAP_TEXT_SCALE,
  MIN_AREA_FILL_OPACITY, MAX_AREA_FILL_OPACITY, type AreaFillStyle,
} from '@/lib/design-canvas';
import { MIN_BED_COUNT, MAX_BED_COUNT } from '@/lib/bed-block';
import { CATEGORY_META, CATEGORY_STEP, ELEMENT_CATALOG, ELEMENTS_BY_ID, GROUND_FEATURES, PLANTING_GROUP_LABEL, PLANTING_GROUP_ORDER, ZONE_DEFS, biomeClimates, elementSuitsClimate, elementVisibleInPalette, plantingGroupFor, type DesignElementDef, type DesignLayerState } from '@/lib/design-elements';
import { SPECIES } from '@/lib/species-catalog';
import { biomeKeyForName } from '@/lib/biome';
import { COMPASS16_ORDER, isCompassDirection16, type LocalWindObservation } from '@/lib/local-wind';
import SpeciesPicker from './SpeciesPicker';
import { usePhoneViewport } from '@/lib/use-phone-viewport';
import ChromeHandle from '@/components/design/ChromeHandle';
import { BOTTOM_STOPS, bottomVisibility, type BottomStop } from '@/lib/design-chrome';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';
import { uiVersion, setUiVersion, UI_VERSION_EVENT } from '@/lib/ui-version';
import LessonLink from './LessonLink';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

type ActiveLayers = DesignLayerState;

export type WaterInfrastructureLayer = 'storage' | 'tapPoints' | 'pipes' | 'drip' | 'swales';
export type WaterInfrastructureVisibility = Record<WaterInfrastructureLayer, boolean>;
export type WaterInfrastructureOpacity = Record<WaterInfrastructureLayer, number>;

function waterInfrastructureForElement(defId: string | null): WaterInfrastructureLayer | null {
  if (!defId) return null;
  if (defId === 'tap_point') return 'tapPoints';
  if (defId === 'rain_barrel' || defId.startsWith('jojo_')) return 'storage';
  return null;
}

function waterInfrastructureForLine(kind: LineShape['kind']): WaterInfrastructureLayer | null {
  if (kind === 'pipe' || kind === 'greywater') return 'pipes';
  if (kind === 'drip') return 'drip';
  if (kind === 'swale') return 'swales';
  return null;
}

export type DesignMode = 'guided' | 'pro';

export interface DesignPaletteProps {
  step: WizardStep;
  mode: DesignMode;
  tool: ToolKind;
  setTool: (t: ToolKind) => void;
  placeDefId: string | null;
  setPlaceDefId: (id: string | null) => void;
  placeSpeciesId: string | null;
  setPlaceSpeciesId: (id: string | null) => void;
  zoneDraw: 0 | 1 | 2 | 3 | 4 | 5;
  setZoneDraw: (z: 0 | 1 | 2 | 3 | 4 | 5) => void;
  /** The zone number the current SELECTION is, or null when the selection isn't a single
   *  zone (nothing selected, a mixed selection, a placed item, a ground feature). Distinct
   *  from zoneDraw, which is what the draw tool will paint NEXT: the chip row has to answer
   *  both "what am I holding?" and "what will I paint?", and before this it only answered
   *  the second. Computed in app/design/page.tsx, which owns selection state. */
  selectedZone: 0 | 1 | 2 | 3 | 4 | 5 | null;
  /** What the single selected shape IS, so its chip lights up — see selectedIdentity in
   *  app/design/page.tsx for why this highlights rather than arms. */
  selectedIdentity?: { feature: GroundFeatureKind | null; lineKind: LineShape['kind'] | null; defId: string | null } | null;
  areaFeature: GroundFeatureKind | null;
  setAreaFeature: (f: GroundFeatureKind | null) => void;
  lineKind: LineShape['kind'];
  setLineKind: (k: LineShape['kind']) => void;
  activeLayers: ActiveLayers;
  setActiveLayers: (layers: ActiveLayers) => void;
  /** Water's working sublayers are presentation controls only. They never alter the saved
   * geometry; the canvas decides which existing marks to paint. */
  waterInfrastructure?: {
    visibility: WaterInfrastructureVisibility;
    opacity: WaterInfrastructureOpacity;
    onVisibilityChange: (next: WaterInfrastructureVisibility) => void;
    onOpacityChange: (next: WaterInfrastructureOpacity) => void;
  } | null;
  /** Wide screens have a fixed right-side quick-actions pane. Phones retain the bottom sheet. */
  desktopAside?: boolean;
  /** Icon/label size slider, shown inside the Layers panel beside Labels and Icons. null hides
   *  it entirely, same "nothing to act on" convention the other optional controls use. */
  textScaleControl: { value: number; onChange: (v: number) => void } | null;
  /** Hatch vs flat tint for traced surfaces, and how strong. Paint only — see AREA_FILL_STYLES. */
  areaFillControl: { value: { style: AreaFillStyle; opacity: number; plantOpacity: number }; onChange: (v: { style: AreaFillStyle; opacity: number; plantOpacity: number }) => void } | null;
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
  /** The single selected swale's measured route length and optional stated disturbed-ground
   *  width. Blank stays blank: this is a farmer-entered construction note, not a place to infer
   *  one from the drawing. */
  swaleControl: {
    widthM: number | undefined;
    lengthM: number;
    /** Returns false for invalid input, so the field can restore the saved value without writing it. */
    onSetWidth: (raw: string) => boolean;
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
  /** The bottom chrome ladder, owned by the page so the drone bar and Lima (which live there) shed
   *  in the same order as this palette's own rows. */
  bottomStop: BottomStop;
  onBottomStopChange: (next: BottomStop) => void;
  /** Sections the farmer closed one at a time with their ×. The count rides beside the handle so
   *  "where did it go" is answered on screen instead of from memory. */
  hiddenSections?: { count: number; onRestore: () => void };
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
  { key: 'references', labelKey: 'designPaletteLayerBase', icon: '🛰️' },
  // The property fence, sitting next to Site references because it is the other reference layer the
  // farmer did not draw in the Studio. Before this it had no switch of its own: a boundary
  // inherited from a ring traced on the main map could only be removed by hiding all site context.
  { key: 'boundary', labelKey: 'designPaletteLayerBoundary', icon: '🚧' },
  // "Existing", not "Ground": this layer is the farmer's EXISTING site reality (house/patio/lawn/
  // veg garden the app draws), i.e. the "Draw what's already here" chips — distinct from the
  // proposed Structures layer and from site-reference context. (Fable Q1; internal key stays.)
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
    // Earthworks has its own step now, but CATEGORY_STEP still says the earthworks CATEGORY is
    // owned by Water — deliberately. Moving ownership would take the raised bed, keyhole bed,
    // herb spiral, tree basin and greywater basin off the Water palette with it, and those are
    // water tasks a farmer expects to find there. So this step ADDS the category rather than
    // claiming it, the same way alsoSteps lets a Banana Circle appear under Planting.
    case 'earthworks':
      return ['earthworks'];
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

/**
 * SELECTED — the state a farmer must never have to hunt for, on chips whose own colour we do not
 * control.
 *
 * It was a lone 2px gold hairline, repeated at nine call sites and reported three times as
 * invisible ("i still cant see the outline of the tool once selected very nicely"). The reason is
 * structural, not a matter of picking a better colour: these chips are ALREADY multicoloured —
 * six zone colours, element categories, a dark-green armed tool — so any single accent is
 * guaranteed to land on a chip that shares its hue and disappear. Gold on the olive "Garden &
 * orchard" chip is exactly that case.
 *
 * So selection is carried by FORM, in three layers that cannot all fail at once: a light inner
 * ring that separates from the chip's own fill, a paper gap, and a near-black outer ring that
 * separates from the page. Whatever the chip is coloured, at least two of the three are in strong
 * contrast — including in direct sun, where hue differences go first. It rides in box-shadow, so
 * nothing reflows when the selection moves.
 */
function selectionRing(active: boolean): React.CSSProperties {
  return active
    ? { border: `2px solid ${GOLD}`, boxShadow: `0 0 0 2px ${PAPER}, 0 0 0 4px ${DARK}` }
    : { border: '1px solid rgba(0,0,0,0.15)', boxShadow: 'none' };
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
    ...selectionRing(active),
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
  placeSpeciesId,
  setPlaceSpeciesId,
  zoneDraw,
  selectedZone,
  selectedIdentity,
  setZoneDraw,
  areaFeature,
  setAreaFeature,
  lineKind,
  setLineKind,
  activeLayers,
  setActiveLayers,
  waterInfrastructure = null,
  desktopAside = false,
  textScaleControl,
  areaFillControl,
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
  swaleControl,
  windControl,
  siteBiome,
  bottomStop,
  hiddenSections,
  onBottomStopChange,
}: DesignPaletteProps) {
  const { t } = useLanguage();
  const [hintDefId, setHintDefId] = useState<string | null>(null);
  // The tip line closes itself, and can be closed by hand (Rory: "we should be able to close this
  // and it should disappear after 4 seconds or however long you think?").
  //
  // EIGHT seconds, not four. Four is under the reading time of the tip it is showing — "Keep
  // within daily-visit distance of the kitchen door; full sun, north-facing rows" is about
  // eighteen words, roughly five and a half seconds at an easy pace, before the farmer has even
  // reached the "Learn about this" link beneath it. This app also ships in eleven languages and
  // several of them run longer than the English. A tip that vanishes mid-sentence has to be
  // re-summoned, which costs more taps than it ever saved.
  const [dismissedHintKey, setDismissedHintKey] = useState<string | null>(null);
  // ...and the clock stops while a finger or the keyboard is on it, so it can never disappear out
  // from under someone reaching for the lesson link.
  const [hintHeld, setHintHeld] = useState(false);
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  // The trigger button's own screen position, captured whenever the picker opens (and kept live
  // on resize/scroll while it's open). This exists because the panel itself is portalled straight
  // to <body> — see the render site below for why: its natural parent measured a real,
  // non-zero-looking bounding rect (found live, an ancestor collapsed to 2px tall with
  // overflow:hidden — likely a flex-sizing quirk of this exact toolbar, not something worth
  // chasing further) and silently clipped the whole panel to nothing, with no console error and
  // no visual trace. Rory: "its there but i cant see the selector for choosing a species" — the
  // button worked, the state flipped, the panel existed in the DOM at a plausible-looking rect,
  // and none of that mattered because its container's box was two pixels tall. A portal sidesteps
  // the question of which ancestor is at fault by not having one.
  const speciesButtonRef = useRef<HTMLButtonElement | null>(null);
  // OPEN TOWARDS THE SPACE THAT EXISTS, not always upwards.
  //
  // Rory, with the picker list clipped off the top of the screen over the step tabs: "this is
  // stuck at the top". The panel only ever opened UPWARDS — right against the button's top edge —
  // which is correct when the palette is a bottom sheet on a phone, and wrong the moment the
  // palette is a side column whose button sits near the top of the viewport: the list is then
  // pushed off the top and only its last rows remain on screen.
  //
  // So the side is measured, not assumed, and the panel is capped to the room it actually has on
  // that side. `top`/`right` stay viewport-edge offsets (the values CSS `bottom`/`right` want).
  const [speciesAnchor, setSpeciesAnchor] = useState<
    { top: number; right: number; openDown: boolean; downTop: number; maxHeight: number } | null
  >(null);
  useEffect(() => {
    if (!speciesPickerOpen) return undefined;
    const measure = () => {
      const el = speciesButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 8;
      const spaceAbove = rect.top - gap;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      // Prefer up (the established behaviour, and the one that keeps a phone's list off the
      // thumb) unless below genuinely has more room to show the list in.
      const openDown = spaceBelow > spaceAbove;
      setSpeciesAnchor({
        top: window.innerHeight - rect.top,
        right: window.innerWidth - rect.right,
        openDown,
        downTop: rect.bottom + gap,
        // Never taller than the side it opens into — an unclamped panel is what ran off the top.
        maxHeight: Math.max(160, Math.min(window.innerHeight * 0.45, openDown ? spaceBelow : spaceAbove) - gap),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [speciesPickerOpen]);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersButtonRef = useRef<HTMLButtonElement | null>(null);
  const [layersAnchor, setLayersAnchor] = useState<{
    top: number;
    bottom: number;
    right: number;
    openBelow: boolean;
    maxHeight: number;
  } | null>(null);
  const syncLayersAnchor = useCallback(() => {
    const button = layersButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    // The desktop sidebar puts the tool row near the top, so opening upward hid most of this
    // tall panel behind the app header (Rory: "layers is cropped off"). Phones keep the useful
    // upward opening when that is genuinely where the room is. Either way the measured viewport
    // space, not an assumed screen height, owns the scroll boundary.
    const openBelow = desktopAside || below >= above;
    setLayersAnchor({
      top: rect.top,
      bottom: rect.bottom,
      right: Math.max(8, window.innerWidth - rect.right),
      openBelow,
      maxHeight: Math.max(120, (openBelow ? below : above) - 6),
    });
  }, [desktopAside]);
  useEffect(() => {
    if (!layersOpen) return undefined;
    syncLayersAnchor();
    window.addEventListener('resize', syncLayersAnchor);
    window.addEventListener('scroll', syncLayersAnchor, true);
    return () => {
      window.removeEventListener('resize', syncLayersAnchor);
      window.removeEventListener('scroll', syncLayersAnchor, true);
    };
  }, [layersOpen, syncLayersAnchor]);
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

  // TWO MODES FOR THE ELEMENT CHIPS — docked strip, or a floating panel you can drag out of the
  // way (Rory: "move these chips to the side in a movable hovering modal of its own so we can have
  // two modes and you just scroll down"). The docked strip is one horizontal scroller: fine for a
  // handful of chips, but Pro on the Structures step carries thirty-odd, and a farmer hunting for
  // "Kraal" is scrolling sideways past everything else. Floating turns the same chips into a
  // wrapped grid you scroll DOWNWARD, parked wherever there is dead space on the map.
  //
  // Both modes render the SAME chip nodes — built once in renderElementCatalog and handed to
  // whichever shell is active — so a chip can never behave differently depending on where it sits.
  const [chipsFloating, setChipsFloating] = useState(false);
  // THE UI VERSION, read reactively. 'cards' renders the same catalogue, same handlers and same
  // selection state as big illustrated cards instead of 44px chips — presentation only, which is
  // the boundary lib/ui-version.ts exists to hold. Nothing below writes differently because of it.
  const [cardsUi, setCardsUi] = useState(false);
  useEffect(() => {
    const sync = () => setCardsUi(uiVersion() === 'cards');
    sync();
    window.addEventListener(UI_VERSION_EVENT, sync);
    return () => window.removeEventListener(UI_VERSION_EVENT, sync);
  }, []);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>({ x: 16, y: 96 });
  const floatDragRef = useRef<{ dx: number; dy: number } | null>(null);
  // Mode and position persist: a farmer who parks the panel bottom-right expects it there on the
  // next step and the next session, not re-centred every render.
  // The two effects below are read-then-write on ONE key, so they must not race. The writer waits
  // on this flag — and it is STATE, not a ref, deliberately: a ref set inside the reader flips in
  // the SAME commit the writer runs in, so the writer would still fire while chipsFloating held
  // the pre-restore default and stamp `floating:false` over the saved value. State forces the
  // writer to skip that commit entirely and run on the next one, when the restored value has
  // landed. Symptom this fixes: a parked panel came back docked on every reload and after every
  // preview-map trip, i.e. the "persists ... not re-centred" promise above was never true.
  const [floatHydrated, setFloatHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('imbewu_palette_float');
      if (raw) {
        const saved = JSON.parse(raw) as { floating?: boolean; x?: number; y?: number };
        if (typeof saved.floating === 'boolean') setChipsFloating(saved.floating);
        if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setFloatPos({ x: saved.x as number, y: saved.y as number });
        }
      }
    } catch { /* corrupt or unavailable storage — the defaults above are already correct */ }
    setFloatHydrated(true);
  }, []);
  useEffect(() => {
    if (!floatHydrated) return;
    try {
      localStorage.setItem('imbewu_palette_float', JSON.stringify({ floating: chipsFloating, ...floatPos }));
    } catch { /* private mode / quota — position is a convenience, never worth throwing over */ }
  }, [floatHydrated, chipsFloating, floatPos]);
  // Drag on window, not on the header: a pointer that outruns the 8px header (easy on a phone)
  // must not drop the panel mid-move. Clamped so the panel can never be dragged fully off-screen
  // and stranded — losing your palette behind the viewport edge is unrecoverable without storage
  // surgery.
  useEffect(() => {
    if (!floatDragRef.current) return undefined;
    const onMove = (e: PointerEvent) => {
      const d = floatDragRef.current;
      if (!d) return;
      const PANEL_W = 300;
      setFloatPos({
        x: Math.max(8, Math.min(window.innerWidth - 72, e.clientX - d.dx)),
        y: Math.max(8, Math.min(window.innerHeight - 72, e.clientY - d.dy)),
      });
      void PANEL_W;
    };
    const onUp = () => { floatDragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });
  // Phone bottom-sheet open/collapsed state (see the module comment for why phone gets a
  // different root entirely). Defaults OPEN: the whole reason this sheet exists is that the
  // element catalog must be visible with no extra action required — that was exactly what broke
  // (Rory: "i cant even see the element pallete"). Dragging the handle down, or tapping it,
  // collapses to the compact tool-row-only state to reclaim map space; it stays wherever the
  // farmer last left it (not reset per step) so repeated placing on one step doesn't fight it.
  // The sheet body follows the ladder now. Kept as a derived boolean so every existing read below
  // (maxHeight, aria-expanded, the strip-end effect) works unchanged.
  const sheetOpen = bottomVisibility(bottomStop).body;

  /** The grab strip, plus the count of individually-closed sections when there are any. */
  function renderHandleRow() {
    const handle = (
      <ChromeHandle
        stop={bottomStop}
        stops={BOTTOM_STOPS}
        onChange={onBottomStopChange}
        label={t(sheetOpen ? 'designPaletteCollapse' : 'designPaletteExpand')}
      />
    );
    if (!hiddenSections || hiddenSections.count < 1) return handle;
    return (
      // The chip rides ABOVE the strip rather than beside it: the grip has to stay centred on the
      // panel, because an off-centre grip stops reading as an edge you can pull.
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ flex: 1, minWidth: 0 }}>{handle}</span>
        <button
          type="button"
          onClick={hiddenSections.onRestore}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'transparent', color: GREEN,
            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '2px 4px',
            textDecoration: 'underline', textUnderlineOffset: 3, whiteSpace: 'nowrap',
          }}
        >
          {hiddenSections.count} hidden
        </button>
      </div>
    );
  }
  const setSheetOpen = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    const want = typeof v === 'function' ? v(sheetOpen) : v;
    onBottomStopChange(want ? 'full' : 'bar');
  }, [sheetOpen, onBottomStopChange]);
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
  // SECTIONS on the planting step. This strip is a single horizontal scroller, and the catalog's
  // own order buried Pollinator Strip, Spekboom Hedge and Vetiver Row at positions 20–22 of 22 —
  // behind seven fruit trees, off the right edge, effectively unreachable (Rory: "why is it not
  // picking up the pollinator strips?"). They are not trees, so the climate sort never lifted
  // them: elementSuitsClimate returns true for everything it has no data on, which means "don't
  // demote", not "promote".
  //
  // That was first fixed with a plain non-trees-first sort. It has since become a real section
  // order (PLANTING_GROUP_ORDER, lib/design-elements.ts) because a flat run of ~24 chips also
  // hid the indigenous fruit species among the exotics (Rory: "I want indig fruit to have their
  // own section"). Beds and strips still lead — they are what you lay out first, and there are
  // only a handful of them — and indigenous fruit now sorts second rather than somewhere past
  // the mangoes.
  const groupRank = (def: DesignElementDef) => PLANTING_GROUP_ORDER.indexOf(plantingGroupFor(def));
  const plantingOrder = (a: DesignElementDef, b: DesignElementDef) =>
    groupRank(a) - groupRank(b) ||
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
  // Rory: "this chip must go with the other chips" — the staple garden rides in the SAME strip as
  // the planting element chips (elementChipNodes below), not in its own separate area-chip block
  // the way Base-step ground features (lawn, orchard...) do. Base is the only step that still uses
  // the standalone area-chip strip.
  const showAreaChips = step === 'base';
  const showLineChips = step === 'water' || step === 'earthworks' || step === 'structures' || step === 'planting';
  const WATER_LINE_IDS: Array<LineShape['kind']> = ['swale', 'pipe', 'drip', 'greywater'];
  // THE STEP THAT EXISTS TO DIG SWALES MUST OFFER THE SWALE TOOL. Rory, on the Earthworks step:
  // "there's no swale clicker" — the step had the berm/terrace/bed CHIPS but no way to draw the
  // line itself, because line tools were only ever wired for water/structures/planting. Earthworks
  // gets swale alone: a pipe or a drip run is plumbing, and belongs on Water where it already is.
  const EARTHWORKS_LINE_IDS: Array<LineShape['kind']> = ['swale'];
  const STRUCTURE_LINE_IDS: Array<LineShape['kind']> = ['fence', 'path'];
  const PLANTING_LINE_IDS: Array<LineShape['kind']> = ['windbreak']; // was unreachable before
  const lineChipsForStep = LINE_KINDS.filter((lk) =>
    (step === 'water' ? WATER_LINE_IDS
      : step === 'earthworks' ? EARTHWORKS_LINE_IDS
      : step === 'planting' ? PLANTING_LINE_IDS
      : STRUCTURE_LINE_IDS).includes(lk.id)
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

  // Identity of the tip currently on screen. A NEW tip is a new key, so closing one never
  // suppresses the next — the farmer dismisses a sentence, not the feature.
  const hintKey = hintDef ? `def:${hintDef.id}` : armedHintLabel ? `armed:${armedHintLabel}` : null;
  useEffect(() => {
    if (!hintKey || dismissedHintKey === hintKey || hintHeld) return undefined;
    const timer = setTimeout(() => setDismissedHintKey(hintKey), HINT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [hintKey, dismissedHintKey, hintHeld]);

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

  // ---- Tools --------------------------------------------------------------------------------

  const canShowSpecies = tool === 'place' && armedDef?.category === 'growing' && armedDef?.id !== 'veg_bed';

  useEffect(() => {
    if (canShowSpecies) {
      setSpeciesPickerOpen(true);
    } else {
      setSpeciesPickerOpen(false);
      setPlaceSpeciesId(null);
    }
  }, [tool, placeDefId]);

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
          {/* A swale is a traced route, not a resizeable rectangle. Its length is therefore a
              readout of the existing points, while width is an explicitly stated earthwork
              dimension. Leaving this input blank means "not stated" all the way to the sheet
              legend; a visible drawing band must never be mistaken for a recommendation. */}
          {swaleControl && (
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
              <span aria-hidden style={{ fontSize: guided ? 13 : 11.5 }}>⌇</span>
              <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>Swale</span>
              <span title="Measured along the line you drew" style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75, whiteSpace: 'nowrap' }}>
                {`${swaleControl.lengthM.toFixed(1)} m long`}
              </span>
              <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>Width</span>
              <input
                // Uncontrolled + keyed follows the same commit-only rule as Size: no half-typed
                // value reaches saved state, while undo, reload and another selected swale remount
                // the field from the actual stated width.
                key={swaleControl.widthM ?? 'unstated'}
                defaultValue={swaleControl.widthM != null ? String(swaleControl.widthM) : ''}
                placeholder="not stated"
                title="Stated disturbed-ground width; leave blank when it has not been set"
                aria-label="Stated swale width in metres"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={100}
                step={0.1}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  if (swaleControl.onSetWidth(e.currentTarget.value)) return;
                  e.currentTarget.value = swaleControl.widthM != null ? String(swaleControl.widthM) : '';
                }}
                style={{
                  width: 74,
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

          {canShowSpecies && (
            <div style={{ position: 'relative', flexShrink: 0, marginRight: 6 }}>
              <button
                ref={speciesButtonRef}
                type="button"
                onClick={() => setSpeciesPickerOpen((v) => !v)}
                aria-expanded={speciesPickerOpen}
                style={{
                  minHeight: guided ? 40 : 32,
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: speciesPickerOpen ? '#2F7A4A' : placeSpeciesId ? 'rgba(47,122,74,0.1)' : '#FFFEFA',
                  color: speciesPickerOpen ? '#FFFEFA' : '#0B120B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden>🌱</span>
                <span>{placeSpeciesId ? 'Species picked' : 'Pick species'}</span>
              </button>
              {speciesPickerOpen && speciesAnchor && typeof document !== 'undefined' && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    ...(speciesAnchor.openDown
                      ? { top: speciesAnchor.downTop }
                      : { bottom: speciesAnchor.top + 8 }),
                    right: speciesAnchor.right,
                    width: 360,
                    maxWidth: '90vw',
                    maxHeight: speciesAnchor.maxHeight,
                    background: '#FFFEFA',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                    // The shadow falls away from the button, so it reads as attached to it.
                    boxShadow: speciesAnchor.openDown
                      ? '0 4px 16px rgba(0,0,0,0.15)'
                      : '0 -4px 16px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <SpeciesPicker
                    // THE ONE PLACE THE KEY IS NEEDED. `siteBiome` is the biome NAME everywhere
                    // else in this component — biomeClimates() switches on it and the climate
                    // tooltip prints it — while lib/species-catalog.ts keys its entries by the
                    // BIOMES registry key. Convert at this single boundary; converting upstream
                    // silently disabled the climate filter for the whole palette.
                    siteBiome={biomeKeyForName(siteBiome)}
                    selectedSpeciesId={placeSpeciesId}
                    onSelect={(id) => {
                      setPlaceSpeciesId(id);
                      // A TREE IS A CANOPY, NOT A BOX. Rory, on a placed Wild date palm and a
                      // Num-num: "square?" — both had come out as translucent green RECTANGLES.
                      //
                      // Picking a species only ever set placeSpeciesId. The placed item's SHAPE
                      // comes from the armed chip's def (DesignCanvas runTapAction: `defId:
                      // placeDefId`), and nothing reconciled the two — so picking a canopy tree
                      // while the generic "Other planting" chip (rect, 2×2 m) was armed produced a
                      // square with a palm's name and a palm's mature width. The size and the name
                      // were both applied correctly; only the footprint silently disagreed.
                      //
                      // `stratum` is the catalog's own answer to "is this a woody plant with a
                      // crown". canopy / sub-canopy / shrub get a round canopy footprint; herb,
                      // groundcover and climber keep whatever the farmer armed, because those
                      // genuinely do belong in a rectangular bed, strip or row.
                      //
                      // Only re-arms when the current chip is NOT already round: a farmer who armed
                      // Citrus Tree or Mango Tree and then picked a cultivar keeps their own choice.
                      // The item's wM/hM are still overwritten with the species' true mature width
                      // downstream, so this changes the SHAPE, never the size.
                      const sp = SPECIES.find((s) => s.id === id);
                      const woody = sp?.stratum === 'canopy' || sp?.stratum === 'sub-canopy' || sp?.stratum === 'shrub';
                      const armed = placeDefId ? ELEMENTS_BY_ID[placeDefId] : null;
                      if (woody && armed?.shape !== 'circle') setPlaceDefId('tree_other');
                      setSpeciesPickerOpen(false);
                    }}
                    onClose={() => setSpeciesPickerOpen(false)}
                  />
                </div>,
                document.body,
              )}
            </div>
          )}

          {/* Layers — pinned right of the tool row, always on screen. A desktop aside has room
              below the button, so its panel opens down; the phone sheet opens up over the map.
              Its own cap is scrollable, rather than allowing either edge to leave the viewport. */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={layersButtonRef}
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
            {layersOpen && layersAnchor && (
              <div
                style={{
                  position: 'fixed',
                  top: layersAnchor.openBelow ? layersAnchor.bottom + 6 : undefined,
                  bottom: layersAnchor.openBelow ? undefined : window.innerHeight - layersAnchor.top + 6,
                  right: layersAnchor.right,
                  zIndex: 1000,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  width: 300,
                  maxWidth: 'calc(100vw - 16px)',
                  maxHeight: layersAnchor.maxHeight,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
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
                  // CHROME SWAP 3 (cards): the pill-cloud becomes the 2.0 LAYER TREE — one full-
                  // width row per layer, an eye toggle at a fixed column, the label beside it.
                  // A wrapping cloud of pills makes a farmer SEARCH for a layer; rows in a fixed
                  // order let the finger learn where each one lives. Same activeLayers state,
                  // same handler, and the same ◉/○ glyphs the water sub-rows below already use,
                  // so the tree and its children read as one control. Presentation only, per
                  // lib/ui-version.ts's boundary.
                  if (cardsUi) {
                    return (
                      <button
                        key={lt.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setActiveLayers({ ...activeLayers, [lt.key]: !on })}
                        style={{
                          flexBasis: '100%', minHeight: 34, padding: '3px 6px', borderRadius: 9,
                          border: 'none', background: 'transparent', color: DARK,
                          display: 'grid', gridTemplateColumns: '30px 22px minmax(0,1fr)',
                          alignItems: 'center', gap: 4, cursor: 'pointer', textAlign: 'left',
                          fontSize: 12.5, fontWeight: 600, opacity: on ? 1 : 0.45,
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 14, textAlign: 'center', color: on ? GREEN : '#9A8268' }}>{on ? '◉' : '○'}</span>
                        <span aria-hidden style={{ textAlign: 'center' }}>{lt.icon}</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(lt.labelKey)}</span>
                      </button>
                    );
                  }
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
                {waterInfrastructure && (
                  <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 2px 0', borderTop: '1px solid rgba(11,18,11,0.12)' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>
                      Water infrastructure
                    </span>
                    {([
                      ['storage', 'JoJo tanks & rain barrels'],
                      ['tapPoints', 'Tap points'],
                      ['pipes', 'Pipes & lines'],
                      ['drip', 'Drip irrigation'],
                      ['swales', 'Swales'],
                    ] as const).map(([key, label]) => {
                      const on = waterInfrastructure.visibility[key];
                      const opacity = waterInfrastructure.opacity[key];
                      return (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) 68px 34px', alignItems: 'center', gap: 5 }}>
                          <button
                            type="button"
                            aria-label={`${on ? 'Hide' : 'Show'} ${label}`}
                            aria-pressed={on}
                            onClick={() => {
                              // Do not leave a placement tool armed for a mark we just hid. It
                              // would save correctly but render nothing, the exact "my work
                              // disappeared" failure this panel is meant to prevent.
                              if (on && (
                                waterInfrastructureForElement(placeDefId) === key
                                || (tool === 'line' && waterInfrastructureForLine(lineKind) === key)
                              )) setTool('select');
                              waterInfrastructure.onVisibilityChange({ ...waterInfrastructure.visibility, [key]: !on });
                            }}
                            style={{ minWidth: 32, minHeight: 32, padding: 0, borderRadius: 8, border: '1px solid rgba(11,18,11,0.16)', background: on ? 'rgba(31,77,43,0.12)' : 'transparent', color: DARK, cursor: 'pointer', fontSize: 14 }}
                          >
                            {on ? '◉' : '○'}
                          </button>
                          <span style={{ minWidth: 0, fontSize: 11.5, opacity: on ? 1 : 0.5 }}>{label}</span>
                          <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.1}
                            value={opacity}
                            disabled={!on}
                            aria-label={`${label} opacity`}
                            onChange={(e) => waterInfrastructure.onOpacityChange({ ...waterInfrastructure.opacity, [key]: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: GREEN, cursor: on ? 'pointer' : 'default' }}
                          />
                          <span style={{ fontSize: 10.5, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: on ? 1 : 0.5 }}>{Math.round(opacity * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                {/* HOW SURFACES ARE FILLED. Zones, lawn, orchard, patio — everything traced — were
                    hatched with no way to change it. The hatch is right while you are drawing (it
                    says "traced parcel" in the farmer map's own language) and wrong when you want
                    to read the ground under it, or hand someone a zone plan. Same home as the
                    other paint controls: this is the same question they answer — how loud should
                    the drawing be over the land. */}
                {areaFillControl && (
                  <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '6px 2px 0' }}>
                    <span style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>🖌️ {t('designPaletteAreaFill')}</span>
                    <span style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${GREEN}`, flexShrink: 0 }}>
                      {(['hatch', 'tint'] as AreaFillStyle[]).map((style) => {
                        const on = areaFillControl.value.style === style;
                        return (
                          <button
                            key={style}
                            type="button"
                            aria-pressed={on}
                            onClick={() => areaFillControl.onChange({ ...areaFillControl.value, style })}
                            style={{
                              minHeight: 28, padding: '3px 10px', border: 'none', cursor: 'pointer',
                              fontSize: 11.5, fontWeight: 700,
                              background: on ? GREEN : PAPER, color: on ? PAPER : GREEN,
                            }}
                          >
                            {t(style === 'hatch' ? 'designPaletteAreaFillHatch' : 'designPaletteAreaFillTint')}
                          </button>
                        );
                      })}
                    </span>
                    <input
                      type="range"
                      min={MIN_AREA_FILL_OPACITY}
                      max={MAX_AREA_FILL_OPACITY}
                      step={0.01}
                      value={areaFillControl.value.opacity}
                      onChange={(e) => areaFillControl.onChange({ ...areaFillControl.value, opacity: Number(e.target.value) })}
                      aria-label={t('designPaletteAreaFillStrength')}
                      style={{ flex: 1, minWidth: 80, accentColor: GREEN, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(areaFillControl.value.opacity * 100)}%
                    </span>
                  </div>
                )}
                {/* PLANTS GET THEIR OWN DIAL. Turning the areas down to read the ground underneath
                    also turned every tree canopy down, because one number drove both (Rory: "we
                    should set the plant tint to a certain level or better be able to adjust it —
                    the plant hatching is not that visible"). They are different jobs: an area tint
                    is a wash you want out of the way, a canopy is a thing you are counting. */}
                {areaFillControl && (
                  <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
                    <span style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>🌿 {t('designPalettePlantFill')}</span>
                    <input
                      type="range"
                      min={MIN_AREA_FILL_OPACITY}
                      max={MAX_AREA_FILL_OPACITY}
                      step={0.01}
                      value={areaFillControl.value.plantOpacity}
                      onChange={(e) => areaFillControl.onChange({ ...areaFillControl.value, plantOpacity: Number(e.target.value) })}
                      aria-label={t('designPalettePlantFill')}
                      style={{ flex: 1, minWidth: 80, accentColor: GREEN, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(areaFillControl.value.plantOpacity * 100)}%
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


  /** The chips as a draggable, vertically-scrolling panel over the map. Portalled to <body> for
   *  the same reason the species picker is: this panel's ancestors include the tool row's
   *  overflow:hidden scroller, which would clip it to a sliver. */
  function renderFloatingChipPanel(chipNodes: React.ReactNode): React.ReactNode {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: floatPos.x,
          top: floatPos.y,
          width: 300,
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: '52dvh',
          background: PAPER,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 900,
          overflow: 'hidden',
        }}
      >
        <div
          onPointerDown={(e) => {
            floatDragRef.current = { dx: e.clientX - floatPos.x, dy: e.clientY - floatPos.y };
            // Force the drag effect to re-subscribe now that the ref is set.
            setFloatPos((p) => ({ ...p }));
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '7px 8px 7px 11px', background: '#F8F5EE',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            cursor: 'grab', touchAction: 'none', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: DARK, whiteSpace: 'nowrap' }}>
            ⠿ Elements
          </span>
          <button
            type="button"
            onClick={() => setChipsFloating(false)}
            title="Dock the palette back into the panel"
            aria-label="Dock the element palette"
            style={{
              border: '1px solid rgba(0,0,0,0.12)', background: PAPER, color: '#6B6355',
              borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Dock
          </button>
        </div>
        {/* flex + minHeight:0 so this actually scrolls inside the clamped panel rather than
            growing past maxHeight and being silently clipped with no scrollbar. */}
        <div
          style={{
            flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            padding: 9, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 6,
          }}
        >
          {chipNodes}
        </div>
      </div>,
      document.body,
    );
  }

  /** The element + line chips, as an array both palette shells render. Extracted so the docked
   *  strip and the floating panel are literally the same chips, never two drifting copies. */
  function elementChipNodes(): React.ReactNode {
    // Section headings, on the Planting step only — the one step whose strip is long enough and
    // sorted into groups (see plantingOrder above). Emitted INLINE, ahead of the first chip of
    // each run, rather than as a full-width header row: this same array is rendered by a
    // horizontal single-line scroller AND by two wrapping panels, and a heading that forces a
    // line break cannot exist in the scroller. A rule plus a small uppercase label reads as a
    // section divider in all three.
    //
    // Derived from what is actually being rendered, not from PLANTING_GROUP_ORDER, so a section
    // the climate filter has emptied out never prints a heading over nothing — on a fynbos site
    // the only indigenous fruit that crops is the kei apple, and on a Karoo site it is the only
    // one at all.
    let lastGroup: string | null = null;
    // Which of the three shells is on screen. desktopAside and the floating panel both wrap; the
    // docked strip is a single scrolling line. They are mutually exclusive in practice — the
    // docked strip is display:none whenever the floating panel is up — so one flag covers both.
    const chipsWrap = desktopAside || chipsFloating;
    return (
      <>
      {orderedCatalog.map((def) => {
        // …or it IS the thing you have selected on the map (selectedIdentity).
        const active = (placeDefId === def.id && tool === 'place') || selectedIdentity?.defId === def.id;
        const suited = !climateFilterActive || elementSuitsClimate(def.id, siteClimates);
        const group = step === 'planting' ? plantingGroupFor(def) : null;
        const heading = group && group !== lastGroup ? group : null;
        if (group) lastGroup = group;
        const chip = (
          <button
            key={def.id}
            type="button"
            onClick={() => pickElement(def)}
            title={suited ? undefined : formatDesignTranslation(t('designPaletteClimateTitle'), { name: def.name })}
            // The photograph seam stays optional. Until an illustrator supplies a real asset the
            // farmer sees the exact emoji she saw before; fake generated symbols would make a
            // tool look more finished while saying less clearly what it places.
            // CARD MODE is the 2.0 palette rendered by THIS component — same catalogue, same
            // pickElement, same active ring, same climate dimming. Only the geometry changes:
            // the drawing becomes the card instead of a 30px thumbnail beside a label. This is
            // the first chrome swap of the migration plan, and doing it here rather than by
            // mounting the 2.0 component means every behaviour this strip has learned (float,
            // staple chip, line chips, climate filter) is kept for free.
            style={cardsUi ? {
              position: 'relative',
              minHeight: 128,
              width: desktopAside ? 'calc(50% - 3px)' : 104,
              padding: '8px 6px 7px',
              borderRadius: 12,
              ...selectionRing(active),
              background: active ? GREEN : PAPER,
              color: active ? PAPER : DARK,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
              gap: 4,
              boxSizing: 'border-box',
              flexShrink: 0,
              cursor: 'pointer',
              opacity: suited ? 1 : 0.45,
            } : {
              position: 'relative',
              minHeight: guided ? 44 : 34,
              padding: guided ? '4px 10px' : '3px 8px',
              borderRadius: 9,
              ...selectionRing(active),
              background: active ? GREEN : PAPER,
              color: active ? PAPER : DARK,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexDirection: desktopAside ? 'column' : 'row',
              justifyContent: desktopAside ? 'center' : undefined,
              textAlign: desktopAside ? 'center' : 'left',
              width: desktopAside ? 'calc(50% - 3px)' : undefined,
              boxSizing: 'border-box',
              flexShrink: 0,
              cursor: 'pointer',
              opacity: suited ? 1 : 0.45,
            }}
          >
            {/* Real art gets more room than the emoji it replaces. 22px was sized for a GLYPH,
                which is drawn to read at a small optical size; an illustrated pawpaw or chicken
                coop at 22px is a smudge, and the whole point of the art is that the farmer
                recognises the thing without reading the label. 30px is the most a 44px chip can
                give it without growing the strip. */}
            {def.art ? (
              <img src={def.art} alt="" aria-hidden style={cardsUi
                ? { width: 64, height: 64, objectFit: 'contain' }
                : { width: guided ? 30 : 24, height: guided ? 30 : 24, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: cardsUi ? 34 : guided ? 16 : 13, lineHeight: 1 }}>{def.icon}</span>
            )}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: cardsUi || desktopAside ? 'center' : 'flex-start', minWidth: 0 }}>
              {/* Cards get room for two lines, so 'Indigenous Shade Tree' stops truncating —
                  whiteSpace stays nowrap only in chip mode, where a wrap would grow the strip. */}
              <span style={{ fontSize: cardsUi ? 11.5 : guided ? 11.5 : 10, fontWeight: cardsUi ? 700 : 600, whiteSpace: cardsUi ? 'normal' : 'nowrap', lineHeight: 1.2 }}>{def.name}</span>
              <span style={{ fontSize: cardsUi ? 10 : guided ? 9.5 : 8.5, opacity: 0.6, whiteSpace: 'nowrap' }}>
                {def.shape === 'circle' ? `Ø ${def.wM} m` : `${def.wM}×${def.hM} m`}
              </span>
            </span>
          </button>
        );
        if (!heading) return chip;
        return (
          <Fragment key={`section-${heading}`}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: '#6B6355', fontSize: guided ? 9.5 : 9, fontWeight: 700,
                letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                // Two shapes, one node, because both shells render this same array (see the
                // comment on elementChipNodes). Where the chips WRAP, the heading takes a line of
                // its own and rules across it, which is what a section header should look like.
                // In the single-line scroller flexBasis:100% would produce one chip-strip-wide
                // heading and push everything off-screen, so there it is a rule plus a label the
                // row reads past.
                ...(chipsWrap
                  ? { flexBasis: '100%', width: '100%', paddingTop: 4 }
                  : { flexShrink: 0, paddingLeft: 2, paddingRight: 2 }),
              }}
            >
              {!chipsWrap && (
                <span aria-hidden style={{ width: 1, height: guided ? 24 : 20, background: 'rgba(0,0,0,0.14)' }} />
              )}
              {PLANTING_GROUP_LABEL[heading]}
              {chipsWrap && (
                <span aria-hidden style={{ flex: '1 1 auto', height: 1, background: 'rgba(0,0,0,0.14)' }} />
              )}
            </span>
            {chip}
          </Fragment>
        );
      })}
      {/* The staple garden rides in this SAME strip, not a separate area-chip block (Rory: "this
          chip must go with the other chips"). Mechanically it is still a traced AREA — pickArea +
          tool:'zone', same as every GroundFeatureKind — because its size is the whole point and a
          fixed footprint would misrepresent it (see its own comment in lib/design-canvas.ts). Only
          the CHIP is styled like an element chip; the underlying draw tool is unchanged. Shown only
          on the Planting step: every other ground feature (lawn, orchard...) is "what's already
          here", recorded on Base, but a staple garden is DESIGNED here, alongside beds and trees. */}
      {step === 'planting' && (() => {
        const feat = GROUND_FEATURES.staple_garden;
        const active = (areaFeature === 'staple_garden' && tool === 'zone') || selectedIdentity?.feature === 'staple_garden';
        return (
          <button
            type="button"
            onClick={() => pickArea('staple_garden')}
            style={{
              minHeight: guided ? 44 : 34,
              padding: guided ? '4px 10px' : '3px 8px',
              borderRadius: 9,
              ...selectionRing(active),
              background: active ? GREEN : PAPER,
              color: active ? PAPER : DARK,
              display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0, cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: feat.color, border: '1px solid rgba(11,18,11,0.3)' }} />
            <span style={{ fontSize: guided ? 11.5 : 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{feat.label}</span>
          </button>
        );
      })()}
      {/* Line kinds ride in the SAME strip as the elements. On the Planting step there is
          exactly one of them (windbreak), and it was being given a full row of its own —
          ~60px of the farmer's map spent on a single chip. They are the same gesture to the
          farmer anyway: pick a thing, put it on the land. renderLineChips() below still owns
          the steps that have no element catalog to ride in. */}
      {showLineChips && lineChipsForStep.map((lk) => {
        const active = (lineKind === lk.id && tool === 'line') || selectedIdentity?.lineKind === lk.id;
        return (
          <button
            key={`line-${lk.id}`}
            type="button"
            onClick={() => pickLine(lk.id)}
            style={{
              minHeight: guided ? 44 : 34,
              padding: guided ? '4px 10px' : '3px 8px',
              borderRadius: 9,
              ...selectionRing(active),
              background: active ? GREEN : PAPER,
              color: active ? PAPER : DARK,
              display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: guided ? 16 : 13, lineHeight: 1 }}>{lk.icon}</span>
            <span style={{ fontSize: guided ? 11.5 : 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{t(lk.labelKey)}</span>
          </button>
        );
      })}
      </>
    );
  }

  function renderElementCatalog() {
    if (!showElementCatalog) return null;
    // The element and line chips, built ONCE. The docked strip below and the floating panel both
    // render this same array, so a chip cannot pick up different behaviour depending on which
    // shell it happens to be sitting in — the failure mode of every "just duplicate the markup for
    // the other mode" refactor.
    const chipNodes = elementChipNodes();
    return (
      /* Element chips: shown on placing steps (and all steps in Pro) */
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chipsFloating && renderFloatingChipPanel(chipNodes)}
        {showFullCatalogNote && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            {orderedCatalog.length === 0
              ? t('designPaletteNoLayers')
              : t('designPaletteProLayers')}
          </div>
        )}
        {/* The climate note used to own a whole LINE of this panel to explain a filter the farmer
            never asked for — a sentence you read once, charged against the map forever. It is now
            the ⓘ chip at the head of the strip below: same words on hover/long-press, zero rows. */}
        {/* Wrapped so the "there is more to the right" fade can sit over the strip's right edge.
            Without it a 22-element catalog looks like a 16-element one: the scrollbar is a few
            faint pixels and nothing else says the row continues. */}
        <div style={{ position: 'relative', minWidth: 0, display: chipsFloating ? 'none' : undefined }}>
        <div
          ref={stripRef}
          onScroll={syncStripEnd}
          style={desktopAside
            ? { display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 6 }
            : scrollStripStyle(guided ? 10 : 6)}
        >
          {/* Pop the chips out into the draggable panel. Lives at the HEAD of the strip so it is
              reachable without scrolling — the thing you reach for when the row is too long is the
              one control that must never be at the far end of that row. */}
          <button
            type="button"
            onClick={() => setChipsFloating(true)}
            title="Float the element palette — drag it anywhere and scroll down through the chips"
            aria-label="Float the element palette"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              minHeight: guided ? 44 : 34, padding: '0 9px', borderRadius: 9,
              border: '1px solid rgba(0,0,0,0.12)', background: PAPER, color: '#6B6355',
              fontSize: guided ? 12 : 11, fontWeight: 600, cursor: 'pointer',
              // In card mode the strip's rows are ~130px tall; a control stretched to that
              // height reads as a card with no picture. Centre the two head controls instead.
              alignSelf: cardsUi ? 'center' : undefined,
            }}
          >
            <span aria-hidden>⧉</span>
            <span style={{ whiteSpace: 'nowrap' }}>Float</span>
          </button>
          {/* THE UI VERSION TOGGLE — reversible per person, and the whole upgrade mechanism.
              It lives where the change happens, so trying the new look and going back are the
              same gesture in the same place. Flipping it changes NOTHING about the design,
              the sheets or the renders — lib/ui-version.ts states the boundary. */}
          <button
            type="button"
            onClick={() => setUiVersion(cardsUi ? 'classic' : 'cards')}
            title={cardsUi ? 'Back to the compact chip palette' : 'Try the new card palette — bigger drawings, same elements'}
            aria-pressed={cardsUi}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              minHeight: guided ? 44 : 34, padding: '0 9px', borderRadius: 9,
              border: cardsUi ? `1px solid ${GREEN}` : '1px solid rgba(0,0,0,0.12)',
              background: cardsUi ? GREEN : PAPER, color: cardsUi ? PAPER : '#6B6355',
              fontSize: guided ? 12 : 11, fontWeight: 600, cursor: 'pointer',
              alignSelf: cardsUi ? 'center' : undefined,
            }}
          >
            <span aria-hidden>✦</span>
            <span style={{ whiteSpace: 'nowrap' }}>{cardsUi ? 'New look' : 'New look'}</span>
          </button>
          {climateFilterActive && (
            <span
              title={`${t('designPaletteClimate')}${siteBiome ? formatDesignTranslation(t('designPaletteClimateFor'), { biome: siteBiome }) : ''}${t('designPaletteClimateHidden')}`}
              style={{
                display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                minHeight: guided ? 44 : 34, padding: '0 8px', borderRadius: 9,
                border: '1px dashed rgba(0,0,0,0.18)', color: '#6B6355',
                fontSize: guided ? 12 : 11, cursor: 'help',
              }}
            >
              ⓘ
            </span>
          )}
          {chipNodes}
        </div>
        {!desktopAside && !stripAtEnd && (
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
            const active = (areaFeature === kind && tool === 'zone') || selectedIdentity?.feature === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => pickArea(kind)}
                style={{
                  minHeight: guided ? 52 : 44,
                  padding: guided ? '8px 14px' : '6px 12px',
                  borderRadius: 10,
                  ...selectionRing(active),
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
                    ...selectionRing(active),
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
      /* The fixed desktop sidebar is already a vertical scroller. A sideways strip there hid
         Zone 0 at one edge and Zone 5 at the other; stack the six choices in reading order.
         The phone bottom sheet keeps its compact horizontal strip. */
      <div style={desktopAside
        ? { display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, width: '100%' }
        : scrollStripStyle(guided ? 10 : 6)}>
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
                ...selectionRing(active),
                background: def.color,
                color: PAPER,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: desktopAside ? '100%' : undefined,
                justifyContent: desktopAside ? 'flex-start' : undefined,
                boxSizing: 'border-box',
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
    // When there is an element catalog these chips already ride in its strip, so rendering them
    // again here would both duplicate them and re-spend the row the merge just bought back.
    if (showElementCatalog) return null;
    return (
      /* Water/Structures step: compact line-kind chips row */
      <div style={scrollStripStyle(guided ? 10 : 6)}>
        {lineChipsForStep.map((lk) => {
          const active = (lineKind === lk.id && tool === 'line') || selectedIdentity?.lineKind === lk.id;
          return (
            <button
              key={lk.id}
              type="button"
              onClick={() => pickLine(lk.id)}
              style={{
                minHeight: guided ? 52 : 44,
                padding: guided ? '8px 16px' : '6px 12px',
                borderRadius: 10,
                ...selectionRing(active),
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
    if (hintKey && dismissedHintKey === hintKey) return null;
    return (
      /* Hint line: armed state, or a def tip on tap */
      <div
        onPointerEnter={() => setHintHeld(true)}
        onPointerLeave={() => setHintHeld(false)}
        onFocusCapture={() => setHintHeld(true)}
        onBlurCapture={() => setHintHeld(false)}
        style={{
          position: 'relative',
          fontSize: 11.5,
          color: DARK,
          background: 'rgba(247,201,126,0.25)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8,
          // Room on the right so the close button never lands on top of the tip's own words.
          padding: '6px 34px 6px 10px',
        }}
      >
        <button
          type="button"
          onClick={() => setDismissedHintKey(hintKey)}
          aria-label={t('designAdvisorCloseTip')}
          title={t('designAdvisorCloseTip')}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: DARK,
            opacity: 0.55,
            fontSize: 15,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
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
    // AND ONLY WHEN BEDS ARE IN PLAY (Rory: "this must only show if we have selected veg beds,
    // otherwise its wasting space"). It sat on the Planting step permanently — a row of four
    // number fields and a button, taking a line of a screen that is mostly map, for a farmer who
    // is placing trees. It appears when the armed element IS a bed, or while the block itself is
    // armed so the Cancel is never stranded. Choosing a bed chip is a clear statement that beds
    // are what you are doing.
    const bedArmed = !!placeDefId && (BED_DEF_IDS as readonly string[]).includes(placeDefId);
    if (!bedArmed && !bedBlockControl.armed) return null;
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
            width: 46, minHeight: guided ? 40 : 34, padding: '3px 5px', borderRadius: 8,
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
            // Matches the element chips beside it. At 52 this button was the tallest thing in the
            // panel and dragged the whole row's height up with it for no extra reachability.
            minHeight: guided ? 44 : 36, padding: '0 14px', borderRadius: 10, flexShrink: 0,
            // Armed IS selected — the block is about to land on the next tap, which is the one
            // state in this palette with a consequence, so it wears the same unmistakable ring.
            ...selectionRing(armed),
            ...(armed ? null : { border: `1px solid ${GREEN}` }),
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
          // NEVER overflow:hidden/auto on this root — the Layers popover needs no clipping
          // ancestor. Only the body region below (a sibling of the tool row) may scroll.
          overflow: 'visible',
          maxHeight: sheetOpen ? PHONE_SHEET_EXPANDED_MAX : undefined,
          fontFamily: 'inherit',
        }}
      >
        {/* Drag handle — drag it down and the panel follows your finger all the way closed; a tap
            steps one rung and wraps. touchAction:'none' + pointer capture match the drag-handle
            pattern already used throughout DesignCanvas.tsx. */}
        {renderHandleRow()}
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
        ...(desktopAside
          ? {
              position: 'fixed' as const,
              top: 76,
              right: 12,
              bottom: 12,
              width: 304,
              zIndex: 15,
              padding: 10,
              background: PAPER,
              border: '1px solid rgba(11,18,11,0.16)',
              borderRadius: 16,
              boxShadow: '0 8px 28px rgba(11,18,11,0.14)',
            }
          : {
              // Docked bar: gutter so chips don't touch the screen edges, and safe-area padding so the
              // bottom row clears the phone's home indicator instead of rendering below the viewport.
              padding: '0 12px',
              paddingBottom: 'calc(6px + env(safe-area-inset-bottom))',
            }),
      }}
    >
      {/* THE SAME LADDER ON DESKTOP. This handle used to exist only in the phone branch above, so
          on a wide screen there was no way to collapse the bottom stack at all — which is exactly
          where the owner was looking for it. One component, one behaviour, both layouts. */}
      {renderHandleRow()}
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
          window. Scoped to start AFTER the tool row on purpose: the Layers popover owns its own
          scroll cap and must not inherit this clipping region. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0, flex: desktopAside ? 1 : undefined, maxHeight: desktopAside ? undefined : '30dvh' }}>
        {renderBodyRows()}
      </div>
    </div>
  );
}

// Re-export category metadata for convenience if a parent wants labels (not required by spec,
// but harmless and avoids a second import path for the same data).
export { CATEGORY_META };
