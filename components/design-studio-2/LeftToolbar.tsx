'use client';

// Left icon toolbar. Every button here does something real (per the task's own anti-placeholder
// rule for element art, extended to the whole toolbar): Add focuses the palette, View swaps to
// a clean read-only preview, Layers collapses/expands the right panel, Draw arms the freehand
// line tool, Measure arms a two-tap ruler, Sun & Wind jumps to the Sector sheet (that analysis
// genuinely lives there, not on Water), Undo/Redo walk the real placement history.

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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function LeftToolbar({ tool, viewOn, layersOn, onSelect, onUndo, onRedo, canUndo, canRedo }: LeftToolbarProps) {
  const isActive = (id: ToolMode) => {
    if (id === 'view') return viewOn;
    if (id === 'layers') return layersOn;
    if (id === 'sunwind') return false; // a jump-to-Sector action, not a persistent mode
    return tool === id;
  };
  return (
    <div
      className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r py-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label="Design tools"
    >
      {TOOLS.map(({ id, label, Icon }) => {
        const active = isActive(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors"
            style={{
              background: active ? 'var(--brand-soft)' : 'transparent',
              color: active ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            <Icon size={18} />
          </button>
        );
      })}

      <div className="my-1 h-px w-8" style={{ background: 'var(--border)' }} />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
        aria-label="Undo"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-2)] disabled:opacity-30"
      >
        <TOOLBAR_ICON.undo size={18} />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
        aria-label="Redo"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-2)] disabled:opacity-30"
      >
        <TOOLBAR_ICON.redo size={18} />
      </button>
    </div>
  );
}
