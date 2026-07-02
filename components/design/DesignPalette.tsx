'use client';

// Design Studio — toolbar + element palette.
//
// Phone-first: 44px touch targets, horizontally scrollable chip rows. Pure controlled
// component — all state (tool, placeDefId, zoneDraw, lineKind, activeLayers) lives in the
// parent; this just renders controls and calls the setters.

import { useState } from 'react';
import type { LineShape, WizardStep } from '@/lib/design-canvas';
import { CATEGORY_META, ELEMENT_CATALOG, ZONE_DEFS, type DesignElementDef } from '@/lib/design-elements';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

interface ActiveLayers {
  water: boolean;
  zones: boolean;
  planting: boolean;
  structures: boolean;
  lines: boolean;
}

export interface DesignPaletteProps {
  step: WizardStep;
  tool: ToolKind;
  setTool: (t: ToolKind) => void;
  placeDefId: string | null;
  setPlaceDefId: (id: string | null) => void;
  zoneDraw: 0 | 1 | 2 | 3 | 4 | 5;
  setZoneDraw: (z: 0 | 1 | 2 | 3 | 4 | 5) => void;
  lineKind: LineShape['kind'];
  setLineKind: (k: LineShape['kind']) => void;
  activeLayers: ActiveLayers;
  setActiveLayers: (layers: ActiveLayers) => void;
  onUndo: () => void;
  canUndo: boolean;
  onDeleteSelected: (() => void) | null;
}

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const PAPER = '#FBF6EC';
const DARK = '#0B120B';

const LINE_KINDS: Array<{ id: LineShape['kind']; label: string; icon: string }> = [
  { id: 'swale', label: 'Swale', icon: '〰️' },
  { id: 'fence', label: 'Fence', icon: '🚧' },
  { id: 'path', label: 'Path', icon: '🥾' },
  { id: 'pipe', label: 'Pipe', icon: '🧵' },
  { id: 'drip', label: 'Drip', icon: '💧' },
  { id: 'windbreak', label: 'Windbreak', icon: '🌬️' },
];

const LAYER_TOGGLES: Array<{ key: keyof ActiveLayers; label: string; icon: string }> = [
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'zones', label: 'Zones', icon: '🗺️' },
  { key: 'planting', label: 'Planting', icon: '🌱' },
  { key: 'structures', label: 'Structures', icon: '🏚️' },
  { key: 'lines', label: 'Lines', icon: '〰️' },
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

function toolButtonStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 44,
    minWidth: 44,
    padding: '0 12px',
    borderRadius: 10,
    border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
    background: active ? GREEN : PAPER,
    color: active ? PAPER : DARK,
    fontWeight: 600,
    fontSize: 13,
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
  tool,
  setTool,
  placeDefId,
  setPlaceDefId,
  zoneDraw,
  setZoneDraw,
  lineKind,
  setLineKind,
  activeLayers,
  setActiveLayers,
  onUndo,
  canUndo,
  onDeleteSelected,
}: DesignPaletteProps) {
  const [hintDefId, setHintDefId] = useState<string | null>(null);

  const allowedCategories = categoriesForStep(step);
  const isReadOnlyStep = step === 'base' || step === 'review' || step === 'glossy';
  const catalog =
    allowedCategories === 'all'
      ? ELEMENT_CATALOG
      : ELEMENT_CATALOG.filter((def) => allowedCategories.includes(def.category));

  const hintDef = hintDefId ? catalog.find((d) => d.id === hintDefId) : null;
  const armedDef = placeDefId ? ELEMENT_CATALOG.find((d) => d.id === placeDefId) : null;

  function selectTool(next: ToolKind) {
    setTool(next);
    if (next !== 'place') setHintDefId(null);
  }

  function pickElement(def: DesignElementDef) {
    setPlaceDefId(def.id);
    setHintDefId(def.id);
    if (tool !== 'place') setTool('place');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'inherit' }}>
      {/* Tool row */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button type="button" style={toolButtonStyle(tool === 'select')} onClick={() => selectTool('select')}>
          ↖️ Select
        </button>
        <button type="button" style={toolButtonStyle(tool === 'place')} onClick={() => selectTool('place')}>
          📍 Place
        </button>
        <button type="button" style={toolButtonStyle(tool === 'zone')} onClick={() => selectTool('zone')}>
          🗺️ Zone
        </button>
        <button type="button" style={toolButtonStyle(tool === 'line')} onClick={() => selectTool('line')}>
          〰️ Line
        </button>
        <button
          type="button"
          style={{ ...toolButtonStyle(false), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↩️ Undo
        </button>
        <button
          type="button"
          style={{
            ...toolButtonStyle(false),
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

      {/* Place tool: element chips filtered by step */}
      {tool === 'place' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isReadOnlyStep && (
            <div style={{ fontSize: 11.5, color: '#6B6355' }}>
              Showing the full catalog — switch to a Water/Planting/Structures step to filter.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {catalog.map((def) => {
              const active = placeDefId === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => pickElement(def)}
                  style={{
                    minHeight: 44,
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: active ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.15)',
                    background: active ? GREEN : PAPER,
                    color: active ? PAPER : DARK,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                    minWidth: 68,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{def.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{def.name}</span>
                  <span style={{ fontSize: 9, opacity: 0.75 }}>
                    {def.shape === 'circle' ? `⌀${def.wM}m` : `${def.wM}×${def.hM}m`}
                  </span>
                </button>
              );
            })}
          </div>
          {(hintDef || armedDef) && (
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
              {(hintDef ?? armedDef)?.icon} <strong>{(hintDef ?? armedDef)?.name}:</strong> {(hintDef ?? armedDef)?.tip}
            </div>
          )}
        </div>
      )}

      {/* Zone tool: zone 0-5 color chips */}
      {tool === 'zone' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {(Object.keys(ZONE_DEFS) as unknown as Array<0 | 1 | 2 | 3 | 4 | 5>).map((z) => {
            const def = ZONE_DEFS[z];
            const active = zoneDraw === z;
            return (
              <button
                key={z}
                type="button"
                onClick={() => setZoneDraw(z)}
                style={{
                  minHeight: 44,
                  padding: '6px 12px',
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
                  fontSize: 12,
                }}
              >
                <span>{z}</span>
                <span style={{ fontWeight: 500, fontSize: 11 }}>{def.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Line tool: line-kind chips */}
      {tool === 'line' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {LINE_KINDS.map((lk) => {
            const active = lineKind === lk.id;
            return (
              <button
                key={lk.id}
                type="button"
                onClick={() => setLineKind(lk.id)}
                style={{
                  minHeight: 44,
                  padding: '6px 12px',
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
                  fontSize: 12,
                }}
              >
                <span>{lk.icon}</span>
                <span>{lk.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Layer visibility toggles */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 2 }}>
        {LAYER_TOGGLES.map((lt) => {
          const on = activeLayers[lt.key];
          return (
            <button
              key={lt.key}
              type="button"
              onClick={() => setActiveLayers({ ...activeLayers, [lt.key]: !on })}
              style={{
                minHeight: 32,
                padding: '4px 10px',
                borderRadius: 16,
                border: on ? `1.5px solid ${GREEN}` : '1px solid rgba(0,0,0,0.15)',
                background: on ? 'rgba(31,77,43,0.12)' : 'transparent',
                color: DARK,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                cursor: 'pointer',
                fontSize: 11,
                opacity: on ? 1 : 0.55,
              }}
            >
              <span>{lt.icon}</span>
              <span>{lt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Re-export category metadata for convenience if a parent wants labels (not required by spec,
// but harmless and avoids a second import path for the same data).
export { CATEGORY_META };
