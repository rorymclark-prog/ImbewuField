'use client';

// Element palette along the bottom of the map. Icon/artwork source is isolated to ONE call —
// getElementArt(def) — so swapping in illustrated assets later touches
// lib/design-studio-shell-icons.ts only, never this component. Real dimensions (wM/hM, from
// ELEMENT_CATALOG) are on every card: this app's "never invent a number" rule applies as much
// to a palette label as to a render prompt.
//
// SECTIONS INSIDE "ALL" — the fix this palette shape has already needed once.
//
// The current studio's planting strip was a single undivided run of ~22 chips, and it buried
// Pollinator Strip, Spekboom Hedge and Vetiver Row at positions 20–22, off the right edge,
// effectively unreachable. The design mock reproduces that shape exactly: one row, a "›" at the
// end, everything past the fold invisible. Tabs help — but only once you already know which tab
// a thing is in, and "All" is the tab you land on.
//
// So "All" is not a flat run: it renders each tab's items under its own inline heading, in tab
// order. Nothing new to maintain — it reuses the tab groups the sheet already declares. A
// heading only prints when items follow it, so a filtered-empty group never labels nothing.
//
// PLACEMENT IS TAP-THEN-TAP, and the hint says so. The mock's instruction read "Drag onto the
// map to place" — but drag is the one gesture that is hard on a phone, impossible one-handed,
// and unavailable to keyboard users. Arming a card and then tapping the map works on every
// input, and it is what the underlying shell already does.

import { useMemo, useState } from 'react';
import type { DesignElementDef } from '@/lib/design-elements';
import { getElementArt } from '@/lib/design-studio-shell-icons';

function dimensionLabel(def: DesignElementDef): string {
  const size = def.shape === 'circle'
    ? `Ø${def.wM % 1 === 0 ? def.wM : def.wM.toFixed(2)} m`
    : `${def.wM} × ${def.hM} m`;
  // The JoJo tanks carry their capacity in the NAME because a "JoJo Tank 5000L" is definitionally
  // 5000 L. A rain barrel is not, so its typical capacity rides here instead, hedged and
  // display-only — see capacityNote in lib/design-elements.ts.
  return def.capacityNote ? `${size} · ${def.capacityNote}` : size;
}

interface ElementPaletteProps {
  items: DesignElementDef[];
  tabs?: Record<string, string[]>; // tab label -> subset of item ids; 'All' is always prepended
  armedDefId: string | null;
  onArm: (defId: string) => void;
}

/** A run of cards under one heading. `label: null` = no heading (a single-group palette, or a
 *  filtered tab, where a heading would just repeat the tab you already pressed). */
interface PaletteGroup { label: string | null; items: DesignElementDef[] }

export default function ElementPalette({ items, tabs, armedDefId, onArm }: ElementPaletteProps) {
  const tabNames = useMemo(() => ['All', ...Object.keys(tabs ?? {})], [tabs]);
  const [activeTab, setActiveTab] = useState('All');

  const groups: PaletteGroup[] = useMemo(() => {
    if (activeTab !== 'All') {
      const ids = new Set(tabs?.[activeTab] ?? []);
      return [{ label: null, items: items.filter((d) => ids.has(d.id)) }];
    }
    if (!tabs || Object.keys(tabs).length === 0) return [{ label: null, items }];

    const out: PaletteGroup[] = [];
    const claimed = new Set<string>();
    for (const [label, ids] of Object.entries(tabs)) {
      const set = new Set(ids);
      const inGroup = items.filter((d) => set.has(d.id) && !claimed.has(d.id));
      inGroup.forEach((d) => claimed.add(d.id));
      if (inGroup.length) out.push({ label, items: inGroup });
    }
    // Anything the sheet's tabs forgot still has to be reachable — a chip that belongs to no
    // group must never silently vanish from the palette it is declared in.
    const rest = items.filter((d) => !claimed.has(d.id));
    if (rest.length) out.push({ label: out.length ? 'More' : null, items: rest });
    return out;
  }, [items, tabs, activeTab]);

  if (items.length === 0) {
    return (
      <div
        className="flex h-20 shrink-0 items-center justify-center border-t text-[13px]"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-3)' }}
      >
        This sheet&rsquo;s element palette isn&rsquo;t built yet.
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-3 px-3 pb-1 pt-2.5">
        {tabNames.length > 1 && (
          <div className="flex shrink-0 gap-1" role="tablist" aria-label="Element categories">
            {tabNames.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={{
                  background: activeTab === tab ? 'var(--brand)' : 'var(--surface-2)',
                  color: activeTab === tab ? 'var(--surface)' : 'var(--text-2)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
        <p className="ml-auto hidden shrink-0 text-[11.5px] md:block" style={{ color: 'var(--text-3)' }}>
          {armedDefId ? 'Now tap the map to place it' : 'Tap an element, then tap the map'}
        </p>
      </div>

      <div className="relative">
        <div className="flex items-stretch gap-2 overflow-x-auto px-3 pb-3 pt-1.5">
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className="flex shrink-0 items-stretch gap-2">
              {group.label && (
                <span className="flex shrink-0 items-center gap-2 pl-1 pr-1">
                  <span className="h-24 w-px shrink-0" style={{ background: 'var(--border)' }} aria-hidden />
                  <span className="u-label" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>
                    {group.label}
                  </span>
                </span>
              )}
              {group.items.map((def) => {
                const art = getElementArt(def);
                const isArmed = armedDefId === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => onArm(def.id)}
                    title={def.tip}
                    aria-pressed={isArmed}
                    // 116 on a phone, 140 from sm up. At 140 a 375px screen shows 1.6 cards, so
                    // the farmer is scrolling a strip to see what is even in it; 116 shows two
                    // and a hint of the third, which is what makes a horizontal strip legible as
                    // a strip. Both are still well above the 104 this started at.
                    className="flex min-h-[142px] w-[116px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2.5 pb-3 pt-3 text-center transition-colors sm:min-h-[164px] sm:w-[140px]"
                    style={{
                      borderColor: isArmed ? 'var(--brand)' : 'var(--border)',
                      background: isArmed ? 'var(--brand-soft)' : 'var(--surface)',
                      boxShadow: isArmed ? '0 0 0 1px var(--brand)' : undefined,
                    }}
                  >
                    {/* ART GETS THE CARD. A card exists to answer "what is this thing", and the
                        picture answers it — so the picture is the biggest element on it, not a
                        thumbnail inside a decorative disc. The tinted disc is kept ONLY for the
                        lucide line glyphs, which are drawn for a small optical size and go weak
                        and stringy blown up on bare card.
                        The art is 88px, up from 56. The library is drawn at 192px, so this is
                        still inside the asset's real resolution — and 56px was the last size
                        inherited from the era when this slot held an emoji. A picker card is the
                        only place a farmer sees the drawing at all; making it the card is the
                        whole point of having commissioned 76 of them. */}
                    {art.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art.src} alt="" className="h-[72px] w-[72px] shrink-0 sm:h-[88px] sm:w-[88px] object-contain" />
                    ) : (
                      <span
                        className="flex h-[72px] w-[72px] shrink-0 sm:h-[88px] sm:w-[88px] items-center justify-center rounded-full"
                        style={{ background: `${def.color}1F`, color: def.color }}
                      >
                        <art.Icon size={38} />
                      </span>
                    )}
                    <span className="line-clamp-2 text-[12.5px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                      {def.name}
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                      {dimensionLabel(def)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {/* The row continues past the edge and a scrollbar is a few faint pixels. Same fade the
            current studio's chip strip uses, for the same reason. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10"
          style={{ background: 'linear-gradient(to right, rgba(255,255,255,0), var(--surface))' }}
        />
      </div>
    </div>
  );
}
