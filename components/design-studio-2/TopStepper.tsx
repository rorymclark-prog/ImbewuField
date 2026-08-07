'use client';

// Horizontal stepper across the 9 plan-set sheets (see SHEET_ORDER / SHEET_META in
// lib/design-studio-shell.ts — order copied verbatim from DESIGN_SHEETS in DesignGlossy.tsx).
// Every sheet name is clickable (free navigation, not strictly linear); completed sheets show
// a checkmark; the active sheet gets its own icon + a highlighted pill.

import { Check } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { SHEET_ORDER, SHEET_CONFIG, type SheetId } from '@/lib/design-studio-shell';
import { SHEET_ICON } from '@/lib/design-studio-shell-icons';

interface TopStepperProps {
  active: SheetId;
  completed: Set<SheetId>;
  onSelect: (id: SheetId) => void;
}

export default function TopStepper({ active, completed, onSelect }: TopStepperProps) {
  return (
    <nav
      aria-label="Plan-set sheets"
      className="flex items-center gap-2 overflow-x-auto border-b px-2 py-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/*
        components/BackControl.tsx's own doc comment: a page with no in-flow back control gets
        a FLOATING fallback pill — which "dropped a fixed pill on top of the left-hand tool
        panel on the map" the last time a Design Studio screen skipped this (a named, already-
        fixed overlap class). Rendering the shared BackButton here registers this page as
        in-flow (BackButton -> useRegisterBackControl) so that floating fallback stands down,
        instead of this shell re-triggering the same collision on its own toolbar/stepper.
      */}
      <BackButton fallback="/home" />
      <span className="h-6 w-px shrink-0" style={{ background: 'var(--border)' }} />
      {SHEET_ORDER.map((id, i) => {
        const meta = SHEET_CONFIG[id];
        const Icon = SHEET_ICON[id];
        const isActive = id === active;
        const isDone = completed.has(id);
        return (
          <div key={id} className="flex shrink-0 items-center">
            {i > 0 && <span className="mx-1 h-px w-4 shrink-0" style={{ background: 'var(--border)' }} />}
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? 'step' : undefined}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: isActive ? 'var(--brand)' : isDone ? 'var(--brand-soft)' : 'transparent',
                color: isActive ? '#FFFEFA' : isDone ? 'var(--brand)' : 'var(--text-2)',
              }}
              title={`${meta.no} — ${meta.label}`}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.22)' : isDone ? 'var(--brand)' : 'var(--surface-2)',
                  color: isActive ? '#FFFEFA' : isDone ? '#FFFEFA' : 'var(--text-3)',
                }}
              >
                {isDone ? <Check size={12} /> : <Icon size={12} />}
              </span>
              <span className="whitespace-nowrap">{meta.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
