'use client';

// Row two of the header — the CONTEXTUAL row. Nine plan-set sheets (see SHEET_ORDER /
// SHEET_META in lib/design-studio-shell.ts, order copied verbatim from DESIGN_SHEETS in
// DesignGlossy.tsx). Every sheet is clickable — navigation is free, not strictly linear.
//
// This row carries exactly one job: which sheet am I on. Identity, mode, undo and save state
// were moved up to IdentityBar; the design mock had all of it plus a "Design studio" caption
// competing in one strip, and that caption was the only non-interactive thing in a row of
// controls, naming the page you are obviously already on.
//
// STATE READS THREE WAYS, not one. Done shows a check, the active sheet shows its own icon in a
// filled pill, and everything not yet visited shows its NUMBER. The mock left the first four
// sheets with icons and no numbers while later ones had numbers, so you could not tell that
// Site was step 1 of 9 — the ordinal is the whole point of a stepper.
//
// No scroll arrows. The mock drew "‹" and "›" at both ends with all nine steps already on
// screen, so they were controls that could never do anything. The row scrolls natively when it
// genuinely overflows, with a fade to say so.

import { Check } from 'lucide-react';
import { SHEET_ORDER, SHEET_CONFIG, type SheetId } from '@/lib/design-studio-shell';
import { SHEET_ICON } from '@/lib/design-studio-shell-icons';

interface TopStepperProps {
  active: SheetId;
  completed: Set<SheetId>;
  onSelect: (id: SheetId) => void;
}

export default function TopStepper({ active, completed, onSelect }: TopStepperProps) {
  const activeIndex = SHEET_ORDER.indexOf(active);

  return (
    <nav
      aria-label="Plan-set sheets"
      className="relative shrink-0 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <ol className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {SHEET_ORDER.map((id, i) => {
          const meta = SHEET_CONFIG[id];
          const Icon = SHEET_ICON[id];
          const isActive = id === active;
          const isDone = completed.has(id);
          return (
            <li key={id} className="flex shrink-0 items-center">
              {i > 0 && (
                <span
                  className="mx-0.5 h-px w-3 shrink-0"
                  style={{ background: i <= activeIndex ? 'var(--brand-soft-2)' : 'var(--border)' }}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'step' : undefined}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold transition-colors"
                style={{
                  background: isActive ? 'var(--brand)' : isDone ? 'var(--brand-soft)' : 'transparent',
                  color: isActive ? 'var(--surface)' : isDone ? 'var(--brand)' : 'var(--text-2)',
                }}
                title={`Sheet ${meta.no} — ${meta.label}`}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.22)' : isDone ? 'var(--brand)' : 'var(--surface-2)',
                    color: isActive ? 'var(--surface)' : isDone ? 'var(--surface)' : 'var(--text-3)',
                  }}
                  aria-hidden
                >
                  {isDone ? <Check size={12} /> : isActive ? <Icon size={12} /> : meta.no}
                </span>
                <span className="whitespace-nowrap">{meta.label}</span>
                <span className="sr-only">
                  {isDone ? ' — started' : isActive ? ' — current sheet' : ` — sheet ${meta.no} of ${SHEET_ORDER.length}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8"
        style={{ background: 'linear-gradient(to right, rgba(255,255,255,0), var(--surface))' }}
      />
    </nav>
  );
}
