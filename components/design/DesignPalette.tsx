'use client';

// Design Studio — toolbar + element palette.
//
// Phone-first: 44px touch targets, horizontally scrollable chip rows. Pure controlled
// component — all state (tool, placeDefId, zoneDraw, lineKind, activeLayers) lives in the
// parent; this just renders controls and calls the setters.

import { useState } from 'react';
import type { GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import { CATEGORY_META, ELEMENT_CATALOG, GROUND_FEATURES, ZONE_DEFS, biomeClimates, elementSuitsClimate, type DesignElementDef } from '@/lib/design-elements';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

interface ActiveLayers {
  water: boolean;
  zones: boolean;
  planting: boolean;
  structures: boolean;
  lines: boolean;
  ground: boolean;
  baseMap: boolean;
  labels: boolean;
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
  onDeleteSelected: (() => void) | null;
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
  { id: 'windbreak', label: 'Windbreak', icon: '🌬️' },
];

// Ground-feature chips shown on the Base ("what is here") step — each arms the polygon
// draw tool to record a real built/ground feature. Order = kitchen-out (house first).
const GROUND_FEATURE_KINDS: GroundFeatureKind[] = ['house', 'patio', 'lawn', 'veg_garden', 'orchard', 'cleared'];

const LAYER_TOGGLES: Array<{ key: keyof ActiveLayers; label: string; icon: string }> = [
  { key: 'baseMap', label: 'Base map', icon: '🛰️' },
  { key: 'ground', label: 'Ground', icon: '🟫' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'zones', label: 'Zones', icon: '🗺️' },
  { key: 'planting', label: 'Planting', icon: '🌱' },
  { key: 'structures', label: 'Structures', icon: '🏚️' },
  { key: 'lines', label: 'Lines', icon: '〰️' },
  { key: 'labels', label: 'Labels', icon: '🏷️' },
];

// Step → which element categories are placeable in the palette.
function categoriesForStep(step: WizardStep): DesignElementDef['category'][] | 'all' {
  switch (step) {
    case 'water':
      return ['water'];
    case 'planting':
      return ['growing'];
    case 'structures':
      return ['structure', 'animal', 'access'];
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
  onDeleteSelected,
  siteBiome,
}: DesignPaletteProps) {
  const [hintDefId, setHintDefId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
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
  const catalog =
    allowedCategories === 'all'
      ? ELEMENT_CATALOG
      : ELEMENT_CATALOG.filter((def) => allowedCategories.includes(def.category));

  // Climate-appropriate trees: on the planting step, float the trees that crop in this site's
  // climate to the front and dim the ones that won't (frost/chill mismatch). Never hides them —
  // a farmer with a warm microclimate can still pick one.
  const siteClimates = biomeClimates(siteBiome);
  const climateFilterActive = step === 'planting' && !!siteClimates;
  const orderedCatalog = climateFilterActive
    ? [...catalog].sort(
        (a, b) => Number(elementSuitsClimate(b.id, siteClimates)) - Number(elementSuitsClimate(a.id, siteClimates)),
      )
    : catalog;

  const hintDef = hintDefId ? catalog.find((d) => d.id === hintDefId) : null;
  const armedDef = placeDefId ? ELEMENT_CATALOG.find((d) => d.id === placeDefId) : null;

  // Which chip-driven controls are relevant for this step.
  const showZoneChips = step === 'zones';
  const showAreaChips = step === 'base';
  const showLineChips = step === 'water' || step === 'structures';
  const WATER_LINE_IDS: Array<LineShape['kind']> = ['swale', 'pipe', 'drip'];
  const STRUCTURE_LINE_IDS: Array<LineShape['kind']> = ['fence', 'path'];
  const lineChipsForStep = LINE_KINDS.filter((lk) =>
    (step === 'water' ? WATER_LINE_IDS : STRUCTURE_LINE_IDS).includes(lk.id)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: guided ? 10 : 6, fontFamily: 'inherit' }}>
      {/* Tool row: Select · Undo · Delete (scrolls) + Layers pinned right (always visible, so
          it can never fall off the bottom of the page). */}
      <div style={{ display: 'flex', gap: guided ? 10 : 6, alignItems: 'center', paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', flex: 1, minWidth: 0 }}>
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

      {/* Element chips: shown on placing steps (and all steps in Pro) */}
      {showElementCatalog && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {showFullCatalogNote && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            PRO — full catalog, every step. Jump between steps freely.
          </div>
        )}
        {climateFilterActive && (
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>
            🌡️ Trees that suit your climate{siteBiome ? ` (${siteBiome})` : ''} are shown first. Dimmed ones need a warmer or cooler spot.
          </div>
        )}
        <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', paddingBottom: 2 }}>
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
      </div>
      )}

      {/* Base step: ground-feature chips — draw the real house / paving / lawn / veg garden /
          orchard / cleared ground that's already on site (filled labelled areas). */}
      {showAreaChips && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11.5, color: '#6B6355' }}>Draw what&apos;s already here — tap a feature, then trace its corners.</div>
          <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', paddingBottom: 2 }}>
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
        <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', paddingBottom: 2 }}>
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
        <div style={{ display: 'flex', gap: guided ? 10 : 6, overflowX: 'auto', paddingBottom: 2 }}>
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
            <>
              {hintDef.icon} <strong>{hintDef.name}:</strong> {hintDef.tip}
            </>
          ) : (
            armedHintLabel
          )}
        </div>
      )}
    </div>
  );
}

// Re-export category metadata for convenience if a parent wants labels (not required by spec,
// but harmless and avoids a second import path for the same data).
export { CATEGORY_META };
