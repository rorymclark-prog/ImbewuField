'use client';

// Left icon toolbar. Every button here does something real (per the task's own anti-placeholder
// rule for element art, extended to the whole toolbar): Add focuses the palette, View swaps to
// a clean read-only preview, Layers collapses/expands the right panel, Draw arms the freehand
// line tool, Measure arms a two-tap ruler, Sun & Wind jumps to the Sector sheet (that analysis
// genuinely lives there, not on Water).
//
// UNDO/REDO ARE NOT HERE ANY MORE — they are in IdentityBar. At the foot of this rail they sat
// at the furthest point in the window from both the map and the header, which is the wrong home
// for the control you reach for fastest after a mistake. This rail is now only MODES: things
// that change what a tap on the map does.
//
// Every button carries a visible LABEL. Six unlabelled glyphs in a column is a memory test, and
// this rail is the primary way into every tool on the sheet — the two that are toggles (View,
// Layers) especially, since an icon alone cannot say whether it is currently on.

import type { LucideIcon } from 'lucide-react';
import { TOOLBAR_ICON } from '@/lib/design-studio-shell-icons';
import type { ToolMode } from './StudioShell';

interface ToolButtonSpec {
  id: ToolMode;
  label: string;
  Icon: LucideIcon;
}

const TOOLS: ToolButtonSpec[] = [
  { id: 'add', label: 'Add', Icon: TOOLBAR_ICON.add },
  { id: 'view', label: 'View', Icon: TOOLBAR_ICON.view },
  { id: 'layers', label: 'Layers', Icon: TOOLBAR_ICON.layers },
  { id: 'draw', label: 'Draw', Icon: TOOLBAR_ICON.draw },
  { id: 'measure', label: 'Measure', Icon: TOOLBAR_ICON.measure },
  { id: 'sunwind', label: 'Sun & Wind', Icon: TOOLBAR_ICON.sunWind },
];

interface LeftToolbarProps {
  /** Meaningfully exclusive placement modes ('add' | 'draw' | 'measure'). */
  tool: ToolMode;
  /** 'view' and 'layers' are independent toggles, not placement modes, so they track their
   *  own booleans rather than fighting `tool` for the single-active-button slot. */
  viewOn: boolean;
  layersOn: boolean;
  onSelect: (id: ToolMode) => void;
}

export default function LeftToolbar({ tool, viewOn, layersOn, onSelect }: LeftToolbarProps) {
  const isActive = (id: ToolMode) => {
    if (id === 'view') return viewOn;
    if (id === 'layers') return layersOn;
    if (id === 'sunwind') return false; // a jump-to-Sector action, not a persistent mode
    return tool === id;
  };
  // View and Layers are toggles; the rest are modes. A toggle has to say ON, which a tinted
  // pill alone does not — so those two also get an explicit pressed state in the label.
  const isToggle = (id: ToolMode) => id === 'view' || id === 'layers';

  return (
    // 76px of a 390px phone is a fifth of the screen spent on a tool rail. Below sm the rail
    // drops its labels and narrows to 56 — still over the 44px touch floor, and the labels are
    // only a learning aid, which is what a returning phone user needs least.
    <div
      className="flex h-full w-14 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r py-2 sm:w-[76px]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label="Design tools"
      role="toolbar"
      aria-orientation="vertical"
    >
      {TOOLS.map(({ id, label, Icon }) => {
        const active = isActive(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={isToggle(id) ? `${label} — ${active ? 'on' : 'off'}` : label}
            aria-pressed={isToggle(id) ? active : undefined}
            className="flex w-11 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors hover:bg-[var(--surface-2)] sm:w-[68px]"
            style={{
              minHeight: 48,
              background: active ? 'var(--brand-soft)' : 'transparent',
              color: active ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            <Icon size={19} />
            <span className="hidden text-[10.5px] font-semibold leading-none sm:block">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
