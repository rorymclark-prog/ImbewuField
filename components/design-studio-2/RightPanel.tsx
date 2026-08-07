'use client';

// Contextual right panel — scoped to whichever sheet is active. Description, hierarchical
// layers (with All on/All off), then the sheet's Quick actions. Same component renders every
// sheet's panel; what differs is the SheetConfig it's handed.

import type { LucideIcon } from 'lucide-react';
import { Layers as LayersIcon } from 'lucide-react';
import LayerTree from './LayerTree';
import type { LayerKeyId, LayerStateMap, QuickActionDef, SheetConfig } from '@/lib/design-studio-shell';
import { flattenLayerKeys } from '@/lib/design-studio-shell';

interface RightPanelProps {
  sheet: SheetConfig;
  layerState: LayerStateMap;
  expanded: Set<LayerKeyId>;
  onToggleVisible: (key: LayerKeyId) => void;
  onOpacityChange: (key: LayerKeyId, opacity: number) => void;
  onToggleExpanded: (key: LayerKeyId) => void;
  onSetAll: (keys: LayerKeyId[], visible: boolean) => void;
  onQuickAction: (action: QuickActionDef) => void;
  quickActionIcon: (action: QuickActionDef) => LucideIcon;
}

export default function RightPanel({
  sheet, layerState, expanded, onToggleVisible, onOpacityChange, onToggleExpanded, onSetAll,
  onQuickAction, quickActionIcon,
}: RightPanelProps) {
  const sheetKeys = flattenLayerKeys(sheet.layerTree);

  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto border-l"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label={`${sheet.label} sheet panel`}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Sheet {sheet.no} · {sheet.label}
        </div>
        <p className="mt-1 text-sm leading-snug text-ink">{sheet.description}</p>
      </div>

      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <LayersIcon size={13} /> Layers
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onSetAll(sheetKeys, true)}
              className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)' }}
            >
              All on
            </button>
            <button
              type="button"
              onClick={() => onSetAll(sheetKeys, false)}
              className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)' }}
            >
              All off
            </button>
          </div>
        </div>
        <LayerTree
          nodes={sheet.layerTree}
          state={layerState}
          expanded={expanded}
          onToggleVisible={onToggleVisible}
          onOpacityChange={onOpacityChange}
          onToggleExpanded={onToggleExpanded}
        />
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Quick actions
        </div>
        {sheet.quickActions.length === 0 ? (
          <p className="text-xs text-ink-muted">No quick actions yet on this sheet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {sheet.quickActions.map((action) => {
              const Icon = quickActionIcon(action);
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onQuickAction(action)}
                  title={action.hint}
                  className="flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <Icon size={16} style={{ color: 'var(--brand)' }} />
                  <span className="text-xs font-semibold text-ink">{action.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
