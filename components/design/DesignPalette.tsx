'use client';

// Design Studio — toolbar + element palette.
//
// Phone-first: 44px touch targets, horizontally scrollable chip rows. Pure controlled
// component — all state (tool, placeDefId, zoneDraw, lineKind, activeLayers) lives in the
// parent; this just renders controls and calls the setters.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import { normaliseRotation } from '@/lib/design-canvas';
import { CATEGORY_META, CATEGORY_STEP, ELEMENT_CATALOG, GROUND_FEATURES, ZONE_DEFS, biomeClimates, elementSuitsClimate, elementVisibleInPalette, type DesignElementDef } from '@/lib/design-elements';
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
  areaFeature: GroundFeatureKind | null;
  setAreaFeature: (f: GroundFeatureKind | null) => void;
  lineKind: LineShape['kind'];
  setLineKind: (k: LineShape['kind']) => void;
  activeLayers: ActiveLayers;
  setActiveLayers: (layers: ActiveLayers) => void;
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
  // Snap to neighbour (lib/snap-edges.ts) — opens a PREVIEW that closes hairline seams between the
  // single selected ZONE and its already-saved neighbours; the farmer confirms or cancels on the
  // canvas itself (see DesignCanvas's snapPreview prop), same shape as onTidySelected directly
  // above (same author, same problem class). null = nothing selected, more than one thing is
  // selected, or the selection is a line/item/the property boundary rather than a snappable zone —
  // same "nothing to act on" disabled convention as onTidySelected. Tapping this never itself
  // changes the design; only the canvas's own Confirm button (wired to the SAME onChange/undo path
  // every other edit uses) does.
  onSnapSelected: (() => void) | null;
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
  // Site biome name (from lib/biome.ts) — used to surface climate-appropriate trees on the
  // planting step. Undefined = unknown, show all.
  siteBiome?: string;
}

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const PAPER = '#FFFEFA';
const DARK = '#0B120B';

const LINE_KINDS: Array<{ id: LineShape['kind']; label: string; icon: string }> = [
  { id: 'swale', label: 'Swale', icon: '〰️' },
  { id: 'fence', label: 'Fence', icon: '🚧' },
  { id: 'path', label: 'Path', icon: '🥾' },
  { id: 'pipe', label: 'Pipe', icon: '🧵' },
  { id: 'drip', label: 'Drip', icon: '💧' },
  { id: 'greywater', label: 'Greywater', icon: '🚿' },
  { id: 'windbreak', label: 'Windbreak', icon: '🌬️' },
];

// Ground-feature chips shown on the Base ("what is here") step — each arms the polygon
// draw tool to record a real built/ground feature. Order = the plot itself first (boundary),
// then kitchen-out (house next).
const GROUND_FEATURE_KINDS: GroundFeatureKind[] = ['boundary', 'house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared'];

// Ordered by the Scale of Permanence (water → earthworks → access → structures → planting),
// with the reference/overlay layers bracketing it.
const LAYER_TOGGLES: Array<{ key: keyof ActiveLayers; label: string; icon: string }> = [
  { key: 'baseMap', label: 'Base map', icon: '🛰️' },
  // "Existing", not "Ground": this layer is the farmer's EXISTING site reality (house/patio/lawn/
  // veg garden the app draws), i.e. the "Draw what's already here" chips — distinct from the
  // proposed Structures layer and from the satellite Base map. (Fable Q1; internal key stays.)
  { key: 'ground', label: 'Existing', icon: '🏠' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'earthworks', label: 'Earthworks', icon: '⛏️' },
  { key: 'zones', label: 'Zones', icon: '🗺️' },
  { key: 'planting', label: 'Planting', icon: '🌱' },
  { key: 'structures', label: 'Structures', icon: '🏚️' },
  { key: 'access', label: 'Access', icon: '🚪' },
  { key: 'animals', label: 'Animals', icon: '🐔' },
  { key: 'labels', label: 'Labels', icon: '🏷️' },
  { key: 'symbols', label: 'Icons', icon: '🔘' },
  { key: 'contours', label: 'Contours', icon: '⛰️' },
  { key: 'sector', label: 'Sector energies', icon: '☀️' },
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
function toolButtonStyle(active: boolean, guided: boolean): React.CSSProperties {
  return {
    minHeight: guided ? 52 : 44,
    minWidth: guided ? 52 : 44,
    padding: guided ? '0 16px' : '0 12px',
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

export default function DesignPalette({
  step,
  mode,
  tool,
  setTool,
  placeDefId,
  setPlaceDefId,
  zoneDraw,
  setZoneDraw,
  areaFeature,
  setAreaFeature,
  lineKind,
  setLineKind,
  activeLayers,
  setActiveLayers,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDeleteSelected,
  onDuplicateSelected,
  onTidySelected,
  onSnapSelected,
  angleControl,
  siteBiome,
}: DesignPaletteProps) {
  const [hintDefId, setHintDefId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
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
  // then point at nothing.
  useEffect(syncStripEnd, [syncStripEnd, orderedCatalog.length, showElementCatalog]);

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
      ? `Tap the map to place ${armedDef.name}`
      : tool === 'zone' && areaFeature
        ? `Draw your ${GROUND_FEATURES[areaFeature].label} — tap corners, then ✓ Finish`
        : tool === 'zone'
          ? `Tap the map to paint Zone ${zoneDraw}`
          : tool === 'line'
            ? `Tap corners, then ✓ Finish`
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
      {/* Tool row: Select · Undo · Delete (scrolls) + Layers pinned right (always visible, so
          it can never fall off the bottom of the page). */}
      <div style={{ display: 'flex', gap: guided ? 10 : 6, alignItems: 'center', paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
        <button
          type="button"
          style={toolButtonStyle(tool === 'select', guided)}
          onClick={() => {
            setTool('select');
            setHintDefId(null);
          }}
        >
          ↖️ Select
        </button>
        <button
          type="button"
          style={{ ...toolButtonStyle(false, guided), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↩️ Undo
        </button>
        <button
          type="button"
          style={{ ...toolButtonStyle(false, guided), opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}
          onClick={onRedo}
          disabled={!canRedo}
        >
          ↪️ Redo
        </button>
        <button
          type="button"
          style={{
            ...toolButtonStyle(false, guided),
            opacity: onDuplicateSelected ? 1 : 0.4,
            cursor: onDuplicateSelected ? 'pointer' : 'default',
          }}
          onClick={() => onDuplicateSelected?.()}
          disabled={!onDuplicateSelected}
          title="Duplicate the selected item(s) — Cmd/Ctrl+D"
        >
          📋 Duplicate
        </button>
        {/* Tidy outline — offered only when exactly one zone or line is selected (a placed item
            has no ring/polyline to simplify, and a multi-selection has no single shape to preview
            — see onTidySelected's doc comment in DesignPaletteProps). Tapping this only OPENS the
            preview on the canvas; it never itself edits the design. */}
        <button
          type="button"
          style={{
            ...toolButtonStyle(false, guided),
            opacity: onTidySelected ? 1 : 0.4,
            cursor: onTidySelected ? 'pointer' : 'default',
          }}
          onClick={() => onTidySelected?.()}
          disabled={!onTidySelected}
          title="Preview a tidied version of the selected outline"
        >
          🧹 Tidy
        </button>
        {/* Snap to neighbour — offered only when exactly one ZONE is selected (not lines, not
            items, not the property boundary — see onSnapSelected's doc comment in
            DesignPaletteProps). Tapping this only OPENS the preview on the canvas; it never
            itself edits the design. */}
        <button
          type="button"
          style={{
            ...toolButtonStyle(false, guided),
            opacity: onSnapSelected ? 1 : 0.4,
            cursor: onSnapSelected ? 'pointer' : 'default',
          }}
          onClick={() => onSnapSelected?.()}
          disabled={!onSnapSelected}
          title="Preview closing hairline seams with a neighbouring zone"
        >
          🧲 Snap
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
            <span style={{ fontSize: guided ? 12 : 10.5, opacity: 0.75 }}>Angle</span>
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
        <button
          type="button"
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
          🗑️ Delete
        </button>
        </div>
        {/* Layers — pinned right of the tool row, always on screen. Popover opens upward over
            the map (its wrapper isn't an overflow container, so it's never clipped). */}
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
            <span>Layers</span>
            {hiddenLayerCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, color: layersOpen ? GOLD : GREEN }}>{hiddenLayerCount} off</span>
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
                  Layers
                </span>
                {([['All on', true], ['All off', false]] as const).map(([label, val]) => (
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
                    <span>{lt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Below the tool row, everything is unbounded in height: the element catalog can carry a
          note line, the hint/lesson block can run to two lines, and which chip row shows at all
          varies by step. None of that has ever had its own scroll boundary — it just relied on
          the page happening to be tall enough. It usually isn't: <body> is `h-screen
          overflow-hidden` (app/layout.tsx) with no fallback page scroll, and the canvas above
          this bar has a deliberate non-negotiable `minHeight: 45dvh` floor (app/design/page.tsx)
          so tool chrome can never squeeze it away. On a short viewport — a phone rotated to
          landscape (the natural orientation for a wide site plan) is the common real case, not
          an edge case — 45dvh of canvas plus the header plus this tool row can leave this block
          less room than it needs, and the excess used to be silently cropped by <body>'s
          overflow-hidden with no way to reach it, not merely scrolled off. Bounding it and
          letting IT scroll (same maxHeight+overflowY idiom as the sheets elsewhere in this app,
          e.g. EvidenceSheet.tsx/ProfileSheet.tsx) turns an invisible, untappable cutoff into a
          reachable one. Scoped to start AFTER the tool row on purpose: the Layers popover lives
          inside the tool row and opens upward with no overflow ancestor of its own ("never
          clipped" — see its comment above); wrapping the tool row in this too would clip it. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0, maxHeight: '30dvh' }}>

      {/* Element chips: shown on placing steps (and all steps in Pro) */}
      {showElementCatalog && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showFullCatalogNote && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            {orderedCatalog.length === 0
              ? 'No layers on — turn on an element layer (Layers ▸) to place its elements.'
              : 'PRO — showing elements for your switched-on layers. Toggle more in Layers ▸.'}
          </div>
        )}
        {climateFilterActive && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            🌡️ Showing climate-suited planting options{siteBiome ? ` for ${siteBiome}` : ''}. Deprecated/invasive or wrong-climate trees are hidden.
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
                title={suited ? undefined : `Better in a different climate — ${def.name} may struggle here`}
                style={{
                  position: 'relative',
                  minHeight: guided ? 50 : 40,
                  padding: guided ? '5px 10px' : '4px 8px',
                  borderRadius: 9,
                  border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                  background: active ? GREEN : PAPER,
                  color: active ? PAPER : DARK,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0,
                  flexShrink: 0,
                  minWidth: guided ? 66 : 54,
                  cursor: 'pointer',
                  opacity: suited ? 1 : 0.45,
                }}
              >
                <span style={{ fontSize: guided ? 19 : 15, lineHeight: 1.1 }}>{def.icon}</span>
                <span style={{ fontSize: guided ? 11 : 9.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{def.name}</span>
                <span style={{ fontSize: guided ? 9.5 : 8.5, opacity: 0.7 }}>
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
      )}

      {/* Base step: ground-feature chips — draw the real house / paving / lawn / veg garden /
          orchard / cleared ground that's already on site (filled labelled areas). */}
      {showAreaChips && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>Draw what&apos;s already here — tap a feature, then trace its corners.</div>
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
      )}

      {/* Zones step: always show the zone 0-5 colour chips row */}
      {showZoneChips && (
        <div style={scrollStripStyle(guided ? 10 : 6)}>
          {(Object.keys(ZONE_DEFS) as unknown as Array<0 | 1 | 2 | 3 | 4 | 5>).map((z) => {
            const def = ZONE_DEFS[z];
            const active = zoneDraw === z && tool === 'zone';
            return (
              <button
                key={z}
                type="button"
                onClick={() => pickZone(z)}
                style={{
                  minHeight: guided ? 52 : 44,
                  padding: guided ? '8px 16px' : '6px 12px',
                  borderRadius: 10,
                  border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
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
      )}

      {/* Water/Structures step: compact line-kind chips row */}
      {showLineChips && (
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
                <span>{lk.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hint line: armed state, or a def tip on tap */}
      {(armedHintLabel || hintDef) && (
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
              <LessonLink id={`element:${hintDef.id}`} label="Learn about this" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>{armedHintLabel}</div>
              {armedLessonId && <LessonLink id={armedLessonId} label="Learn about this" />}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// Re-export category metadata for convenience if a parent wants labels (not required by spec,
// but harmless and avoids a second import path for the same data).
export { CATEGORY_META };
