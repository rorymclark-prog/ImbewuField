'use client';

// The 2.0 numbered stepper, rendered inside /design when the UI version is 'cards' — the second
// chrome swap of the migration plan (the card palette was the first). Presentation only: it
// calls the SAME setStep the header's prev/next arrows already call, so nothing about step
// semantics, guided sub-steps or persistence changes with the UI version. See lib/ui-version.ts
// for the boundary that keeps that true.
//
// Two deliberate differences from the 2.0 shell's TopStepper:
//
//  - NO check-marks. The shell tracked a per-sheet "completed" set of its own; /design's real
//    notion of done-ness lives in StepGuide's sub-step checklist and is per-task, not per-step.
//    Showing a tick here from a second, cruder definition would be the "two catalogs drift" trap
//    wearing progress-indicator clothes. Numbers and the current highlight are honest.
//
//  - EVERY step is tappable, in guided mode too. The guided flow's own header arrows already
//    allow free movement in both directions one step at a time; a stepper that can jump is the
//    same permission without the button-mashing. The step you are ON stays visually primary.

import { useEffect, useRef } from 'react';
import type { WizardStep } from '@/lib/design-canvas';
import { STEP_ORDER, STEP_LABELS } from './DesignWizard';

const GREEN = '#1F4D2B';
const PAPER = '#FFFEFA';

interface CardsStepperProps {
  step: WizardStep;
  onStep: (step: WizardStep) => void;
}

export default function CardsStepper({ step, onStep }: CardsStepperProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the current step in view when it changes — on a phone the strip is longer than the
  // screen, and a stepper whose highlight lives off-screen reads as "no current step at all".
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [step]);

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label="Design steps"
      style={{
        display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: '1 1 auto',
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}
    >
      {STEP_ORDER.map((s, i) => {
        const active = s === step;
        return (
          <button
            key={s}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Step ${String(i + 1).padStart(2, '0')} — ${STEP_LABELS[s]}`}
            onClick={() => onStep(s)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              minHeight: 30, padding: active ? '3px 12px' : '3px 9px',
              borderRadius: 999, border: 'none', cursor: active ? 'default' : 'pointer',
              background: active ? GREEN : 'transparent',
              color: active ? PAPER : '#6B6355',
              fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                background: active ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)',
                color: active ? PAPER : '#9A8268',
                fontSize: 10.5, fontWeight: 800, letterSpacing: '0.02em',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {STEP_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
