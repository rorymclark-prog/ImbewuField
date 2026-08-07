'use client';

// Element palette along the bottom of the map, filterable by category tabs. Icon/artwork
// source is isolated to ONE call — getElementArt(def) — so swapping in illustrated assets
// later (once Recraft is wired up) touches lib/design-studio-shell-icons.ts only, never this
// component. Real dimensions (wM/hM, from ELEMENT_CATALOG) are shown on every card: this
// app's "never invent a number" rule applies as much to a palette label as to a render prompt.

import { useMemo, useState } from 'react';
import type { DesignElementDef } from '@/lib/design-elements';
import { getElementArt } from '@/lib/design-studio-shell-icons';

function dimensionLabel(def: DesignElementDef): string {
  if (def.shape === 'circle') return `Ø${def.wM % 1 === 0 ? def.wM : def.wM.toFixed(2)}m`;
  return `${def.wM}×${def.hM}m`;
}

interface ElementPaletteProps {
  items: DesignElementDef[];
  tabs?: Record<string, string[]>; // tab label -> subset of item ids; 'All' is always prepended
  armedDefId: string | null;
  onArm: (defId: string) => void;
}

export default function ElementPalette({ items, tabs, armedDefId, onArm }: ElementPaletteProps) {
  const tabNames = useMemo(() => ['All', ...Object.keys(tabs ?? {})], [tabs]);
  const [activeTab, setActiveTab] = useState('All');

  const visible = useMemo(() => {
    if (activeTab === 'All' || !tabs?.[activeTab]) return items;
    const ids = new Set(tabs[activeTab]);
    return items.filter((d) => ids.has(d.id));
  }, [items, tabs, activeTab]);

  if (items.length === 0) {
    return (
      <div
        className="flex h-24 shrink-0 items-center justify-center border-t text-sm text-ink-muted"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        This sheet's element palette isn't built yet.
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {tabNames.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-3 pt-2">
          {tabNames.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                background: activeTab === tab ? 'var(--brand)' : 'var(--surface-2)',
                color: activeTab === tab ? '#FFFEFA' : 'var(--text-2)',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto px-3 py-2.5">
        {visible.map((def) => {
          const art = getElementArt(def);
          const isArmed = armedDefId === def.id;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onArm(def.id)}
              title={def.tip}
              aria-pressed={isArmed}
              className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors"
              style={{
                borderColor: isArmed ? 'var(--brand)' : 'var(--border)',
                background: isArmed ? 'var(--brand-soft)' : 'var(--surface)',
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: `${def.color}22`, color: def.color }}
              >
                {art.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art.src} alt="" className="h-6 w-6 object-contain" />
                ) : (
                  <art.Icon size={18} />
                )}
              </span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink">
                {def.name}
              </span>
              <span className="text-[10px] text-ink-muted">{dimensionLabel(def)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
