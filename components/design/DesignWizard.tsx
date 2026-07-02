'use client';

// DesignWizard — compact horizontal stepper + guidance rail for the Design Studio.
//
// Phone-first: the stepper scrolls horizontally on narrow screens, Back/Next buttons
// are full 44px+ touch targets, and each step gets a short friendly guidance line.

import { ChevronLeft, ChevronRight, Check, Sparkles, Loader2 } from 'lucide-react';
import type { DesignCanvasState, WizardStep } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const PAPER = '#FBF6EC';
const DARK = '#0B120B';

interface DesignWizardProps {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  state: DesignCanvasState;
  refLayersPresent: { boundary: boolean; house: boolean };
  onAutoDetect?: () => void;
  detecting?: boolean;
  suggestionsCount?: number;
}

const STEP_ORDER: WizardStep[] = ['base', 'water', 'zones', 'planting', 'structures', 'review', 'glossy'];

const STEP_LABELS: Record<WizardStep, string> = {
  base: 'Base',
  water: 'Water',
  zones: 'Zones',
  planting: 'Planting',
  structures: 'Structures',
  review: 'Review',
  glossy: 'Glossy',
};

const STEP_GUIDANCE: Record<WizardStep, string> = {
  base: "Check your boundary and house are showing — trace them on the main map if not.",
  water: 'Start with water: place tanks by roofs, mark taps, draw swale lines across the slope.',
  zones: 'Paint your zones — Zone 1 nearest the kitchen door, wilder as numbers grow.',
  planting: "Trees north of beds so they don't shade them. Tap a tree, then tap the map.",
  structures: 'Add sheds, pens, compost, beehives — mind the beehive flight path.',
  review: 'Toggle layers to check each map: water, zones, planting.',
  glossy: "Happy? Generate the artist's impression of YOUR design.",
};

function stepHasContent(step: WizardStep, state: DesignCanvasState, refLayersPresent: { boundary: boolean; house: boolean }): boolean {
  switch (step) {
    case 'base':
      return refLayersPresent.boundary && refLayersPresent.house;
    case 'water':
      return state.items.some((it) => ELEMENTS_BY_ID[it.defId]?.category === 'water') ||
        state.lines.some((l) => l.kind === 'swale' || l.kind === 'pipe' || l.kind === 'drip');
    case 'zones':
      return state.zones.length > 0;
    case 'planting':
      return state.items.some((it) => ELEMENTS_BY_ID[it.defId]?.category === 'growing');
    case 'structures':
      return state.items.some((it) => {
        const cat = ELEMENTS_BY_ID[it.defId]?.category;
        return cat === 'structure' || cat === 'animal';
      });
    case 'review':
    case 'glossy':
      return true;
    default:
      return false;
  }
}

export default function DesignWizard({
  step,
  setStep,
  state,
  refLayersPresent,
  onAutoDetect,
  detecting,
  suggestionsCount,
}: DesignWizardProps) {
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: PAPER,
        border: `1px solid ${GOLD}`,
        borderRadius: 14,
        padding: 10,
      }}
    >
      {/* Stepper — horizontally scrollable on phone */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {STEP_ORDER.map((s, i) => {
          const done = stepHasContent(s, state, refLayersPresent);
          const active = s === step;
          return (
            <button
              key={s}
              onClick={() => setStep(s)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 999,
                border: active ? `2px solid ${GREEN}` : '1px solid rgba(31,77,43,0.25)',
                background: active ? GREEN : 'transparent',
                color: active ? PAPER : DARK,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: done ? GOLD : active ? PAPER : 'rgba(31,77,43,0.15)',
                  color: DARK,
                  flexShrink: 0,
                }}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              {STEP_LABELS[s]}
            </button>
          );
        })}
      </div>

      {/* Guidance text */}
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.4,
          color: DARK,
          background: 'rgba(31,77,43,0.06)',
          borderRadius: 10,
          padding: '8px 10px',
        }}
      >
        {STEP_GUIDANCE[step]}
      </div>

      {/* Auto-detect — 'base' step only, and only when the caller wired it up */}
      {step === 'base' && onAutoDetect && (
        <button
          onClick={() => !detecting && onAutoDetect()}
          disabled={detecting}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            borderRadius: 10,
            border: `1.5px solid ${GREEN}`,
            background: 'transparent',
            color: detecting ? 'rgba(31,77,43,0.5)' : GREEN,
            fontWeight: 600,
            fontSize: 14,
            cursor: detecting ? 'default' : 'pointer',
            position: 'relative',
          }}
        >
          {detecting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {detecting ? 'Detecting… (~20s)' : '✨ Auto-detect features'}
          {!detecting && !!suggestionsCount && suggestionsCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 999,
                background: GOLD,
                color: DARK,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {suggestionsCount} suggestion{suggestionsCount === 1 ? '' : 's'} to review
            </span>
          )}
        </button>
      )}

      {/* Back / Next */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => canBack && setStep(STEP_ORDER[idx - 1])}
          disabled={!canBack}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 10,
            border: `1px solid ${GREEN}`,
            background: canBack ? 'transparent' : 'rgba(31,77,43,0.08)',
            color: canBack ? GREEN : 'rgba(31,77,43,0.4)',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: canBack ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={() => canNext && setStep(STEP_ORDER[idx + 1])}
          disabled={!canNext}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 10,
            border: `1px solid ${GREEN}`,
            background: canNext ? GREEN : 'rgba(31,77,43,0.08)',
            color: canNext ? PAPER : 'rgba(31,77,43,0.4)',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
