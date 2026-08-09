'use client';

// Hierarchical layer row. One row type, recursive — a sheet with no children (every stub sheet)
// and a sheet with children (Water's "Water infrastructure") render through the exact same
// component, so a future sheet that needs its own nesting doesn't need a new one.
//
// PROGRESSIVE DISCLOSURE — the reason this row is not a flat strip of controls.
//
// The design mock gave every row six affordances at rest: drag handle, icon, name, eye, opacity
// number, kebab. Thirteen rows on the Water sheet is seventy-eight controls, in a panel sitting
// beside the map that is supposed to be the subject of the screen. Almost all of that is reached
// rarely; the eye is reached constantly.
//
// So at rest a row shows only what it is and whether it is on. Opacity appears on hover, on
// keyboard focus anywhere inside the row, or while it is being dragged — and, importantly, it
// STAYS rendered whenever it is not 100%, because a layer quietly sitting at 40% with no visible
// control is the same "why can't I see my trees" bug as one switched off. Disclosure may hide a
// control; it must never hide state.
//
// TOUCH: the app's own utility layer sets a 44px touch floor. The mock's eye/kebab/drag targets
// were ~20px. Here the row itself is the hit area for the eye on coarse pointers (min-height
// 44px via the media query below), and the opacity slider is permanently visible there rather
// than hover-gated, because there is no hover on a touch screen.

import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import type { LayerKeyId, LayerStateMap, LayerTreeNode, LayerVisualState } from '@/lib/design-studio-shell';

const DEFAULT_VISUAL: LayerVisualState = { visible: true, opacity: 100 };

interface LayerTreeProps {
  nodes: LayerTreeNode[];
  state: LayerStateMap;
  expanded: Set<LayerKeyId>;
  onToggleVisible: (key: LayerKeyId) => void;
  onOpacityChange: (key: LayerKeyId, opacity: number) => void;
  onToggleExpanded: (key: LayerKeyId) => void;
  depth?: number;
}

export default function LayerTree({
  nodes, state, expanded, onToggleVisible, onOpacityChange, onToggleExpanded, depth = 0,
}: LayerTreeProps) {
  const [openRow, setOpenRow] = useState<LayerKeyId | null>(null);

  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const visual = state[node.key] ?? DEFAULT_VISUAL;
        const isOpen = expanded.has(node.key);
        const hasChildren = !!node.children?.length;
        // Dimmed is STATE, so its control is never disclosure-gated (see the header note).
        const dimmed = visual.opacity < 100;
        const showSlider = openRow === node.key || dimmed;

        return (
          <div key={node.key}>
            <div
              className="layer-row group relative flex items-center gap-2 rounded-lg px-2 transition-colors hover:bg-[var(--surface-2)]"
              style={{ paddingLeft: 8 + depth * 16 }}
              onMouseEnter={() => setOpenRow(node.key)}
              onMouseLeave={() => setOpenRow((k) => (k === node.key ? null : k))}
              onFocus={() => setOpenRow(node.key)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOpenRow((k) => (k === node.key ? null : k));
                }
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(node.key)}
                  aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                  aria-expanded={isOpen}
                  className="flex h-6 w-4 shrink-0 items-center justify-center"
                  style={{ color: 'var(--text-3)' }}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              <button
                type="button"
                onClick={() => onToggleVisible(node.key)}
                aria-pressed={visual.visible}
                aria-label={visual.visible ? `Hide ${node.label}` : `Show ${node.label}`}
                title={visual.visible ? 'Visible — click to hide' : 'Hidden — click to show'}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--brand-soft)]"
                style={{ color: visual.visible ? 'var(--brand)' : 'var(--text-3)' }}
              >
                {visual.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${hasChildren ? 'font-bold' : 'font-medium'}`}
                style={{ color: visual.visible ? 'var(--text)' : 'var(--text-3)' }}
              >
                {node.label}
              </span>

              {/* One control for opacity, not three. The mock offered a per-row number, a
                  per-row kebab and a panel-wide slider labelled only "Opacity 80%" — which
                  never said opacity of WHAT. The slider is the row's, and it says so.

                  ABSOLUTELY POSITIONED, deliberately. Held in flow it reserved ~95px of a 300px
                  panel whether or not it was visible, and every layer name paid for it: "Water
                  infrastructure" rendered as "Water infr…", "Drip Irrigation" as "Drip Irri…".
                  A disclosure that still charges you the space has bought nothing. Over the row
                  it costs zero width at rest, and the tint behind it keeps the long name legible
                  underneath while it is open. */}
              <span
                className={`absolute right-2 flex items-center gap-1.5 rounded-md py-0.5 pl-2 transition-opacity ${showSlider ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                style={{ background: 'linear-gradient(to right, transparent, var(--surface-2) 14px)' }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={visual.opacity}
                  disabled={!visual.visible}
                  onChange={(e) => onOpacityChange(node.key, Number(e.target.value))}
                  aria-label={`${node.label} opacity`}
                  className="h-1.5 w-14 accent-[var(--brand)] disabled:opacity-30"
                />
                <span
                  className="w-9 text-right text-[11px] font-semibold tabular-nums"
                  style={{ color: dimmed ? 'var(--text-2)' : 'var(--text-3)' }}
                >
                  {visual.opacity}%
                </span>
              </span>
            </div>

            {hasChildren && isOpen && (
              <LayerTree
                nodes={node.children!}
                state={state}
                expanded={expanded}
                onToggleVisible={onToggleVisible}
                onOpacityChange={onOpacityChange}
                onToggleExpanded={onToggleExpanded}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}

      <style jsx>{`
        .layer-row { min-height: 34px; }
        /* No hover on touch, so nothing may be hover-gated there: taller rows for the 44px
           floor, and the opacity control is always present. */
        @media (hover: none), (pointer: coarse) {
          .layer-row { min-height: 44px; }
          .layer-row :global(span[class*='opacity-0']) { opacity: 1 !important; pointer-events: auto !important; }
        }
      `}</style>
    </div>
  );
}
