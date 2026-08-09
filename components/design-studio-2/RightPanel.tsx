'use client';

// Contextual right panel — scoped to whichever sheet is active. Sheet title + description,
// hierarchical layers (with All on/All off), then the sheet's Quick actions. Same component
// renders every sheet's panel; what differs is the SheetConfig it's handed.
//
// TYPE ROLES, applied here because this panel is where all three appear together:
//
//   SHEET TITLE   Newsreader (--font-display).  The panel's one serif anchor. app/globals.css
//                 puts h1–h6 on the display face and this is a heading; the design mock had it
//                 in the sans, which left Newsreader doing nothing below the wordmark.
//   SECTION LABEL `.u-label` — 12px / 700 / 0.08em / uppercase, straight from globals.css.
//                 These are FURNITURE: "Layers" and "Quick actions" repeat on every one of the
//                 nine sheets and name a region rather than a thing, so they should read as
//                 structure and recede. The mock set them in sentence case at body size, which
//                 makes them compete with the content they are labelling — and disagrees with
//                 the palette section headings already shipped in the current studio.
//   BODY          sans, --text-2/--text-3.

import type { LucideIcon } from 'lucide-react';
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
  const hiddenCount = sheetKeys.filter((k) => layerState[k]?.visible === false).length;

  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto border-l"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label={`${sheet.label} sheet panel`}
    >
      <div className="border-b px-4 py-3.5" style={{ borderColor: 'var(--border)' }}>
        <div className="u-label">Sheet {String(sheet.no).padStart(2, '0')}</div>
        <h2
          className="mt-1 text-[21px] font-bold leading-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.015em' }}
        >
          {sheet.label}
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
          {sheet.description}
        </p>
      </div>

      <div className="border-b px-4 py-3.5" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="u-label">
            Layers
            {/* Say what is hidden. A layer switched off is the single most common reason a
                farmer reports something "missing" from the map, and the panel is the only place
                that can answer it without hunting down thirteen eye icons. */}
            {hiddenCount > 0 && (
              <span style={{ color: 'var(--warn)', marginLeft: 6 }}>· {hiddenCount} off</span>
            )}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onSetAll(sheetKeys, true)}
              className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              All on
            </button>
            <button
              type="button"
              onClick={() => onSetAll(sheetKeys, false)}
              className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
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

      <div className="px-4 py-3.5">
        <div className="u-label mb-2.5">Quick actions</div>
        {sheet.quickActions.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            No quick actions on this sheet yet.
          </p>
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
                  className="flex min-h-[44px] flex-col items-start justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <Icon size={16} style={{ color: 'var(--brand)' }} />
                  <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
