'use client';

// Hierarchical layer row: eye-toggle + opacity slider on every row (parent AND child), an
// expand chevron on parents only. One row type, recursive — a sheet with no children (every
// stub sheet) and a sheet with children (Water's "Water infrastructure") render through the
// exact same component, so a future sheet that needs its own nesting doesn't need a new one.

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
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const visual = state[node.key] ?? DEFAULT_VISUAL;
        const isOpen = expanded.has(node.key);
        const hasChildren = !!node.children?.length;
        return (
          <div key={node.key}>
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]"
              style={{ paddingLeft: 8 + depth * 18 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(node.key)}
                  aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                  aria-expanded={isOpen}
                  className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-muted"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}

              <button
                type="button"
                onClick={() => onToggleVisible(node.key)}
                aria-pressed={visual.visible}
                aria-label={visual.visible ? `Hide ${node.label}` : `Show ${node.label}`}
                title={visual.visible ? 'Visible — click to hide' : 'Hidden — click to show'}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                style={{ color: visual.visible ? 'var(--brand)' : 'var(--text-3)' }}
              >
                {visual.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              <span
                className={`flex-1 truncate text-sm ${hasChildren ? 'font-semibold' : ''}`}
                style={{ color: visual.visible ? 'var(--text)' : 'var(--text-3)' }}
              >
                {node.label}
              </span>

              <input
                type="range"
                min={0}
                max={100}
                value={visual.opacity}
                disabled={!visual.visible}
                onChange={(e) => onOpacityChange(node.key, Number(e.target.value))}
                aria-label={`${node.label} opacity`}
                className="h-1.5 w-16 shrink-0 accent-[var(--brand)] disabled:opacity-30"
              />
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                {visual.opacity}%
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
    </div>
  );
}
