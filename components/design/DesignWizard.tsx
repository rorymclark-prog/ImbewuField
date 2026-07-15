'use client';

// DesignWizard — the wizard chrome has to LOOK like two different products, not one
// component with a filter, because "I don't see the difference" was the owner's actual
// complaint. GUIDED renders a single big hero step (one focus, one primary action, no
// step-jumping). PRO renders a dense, fully-tappable toolbar (speed, everything visible).
// They share only the step data/labels below, not layout.

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Sparkles, Loader2 } from 'lucide-react';
import type { DesignCanvasState, WizardStep } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import type { DesignMode } from './DesignPalette';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const PAPER = '#FFFEFA';
const DARK = '#0B120B';

interface DesignWizardProps {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  state: DesignCanvasState;
  refLayersPresent: { boundary: boolean; house: boolean };
  onAutoDetect?: () => void;
  detecting?: boolean;
  suggestionsCount?: number;
  mode?: DesignMode;
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
  water: 'Start with water: place tanks by roofs, mark taps, draw swale lines across the slope — or tap ✨ Suggest water setup and approve the overlay.',
  zones: 'Paint your zones — Zone 1 nearest the kitchen door, wilder as numbers grow — or tap ✨ Suggest zones and approve the overlay.',
  planting: "Trees south of beds so they don't shade them. Tap a tree, then tap the map — or tap ✨ Suggest planting and approve the overlay.",
  structures: 'Add sheds, pens, compost, beehives — mind the beehive flight path — or tap ✨ Suggest structures and approve the overlay.',
  review: 'Toggle layers to check each map: water, zones, planting.',
  glossy: "Happy? Generate the artist's impression of YOUR design.",
};

const SUGGEST_STEPS: ReadonlySet<WizardStep> = new Set(['base', 'water', 'zones', 'planting', 'structures']);

const SUGGEST_LABEL: Partial<Record<WizardStep, string>> = {
  base: 'Auto-detect features (AI)',
  zones: 'Suggest zones',
  water: 'Suggest water setup',
  planting: 'Suggest planting',
  structures: 'Suggest structures',
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

// Suggest button — shared between the two layouts but styled very differently by the
// caller (guided wraps it full-width/hero, pro wraps it as a compact inline pill).
function SuggestButton({
  step,
  detecting,
  suggestionsCount,
  onAutoDetect,
  big,
}: {
  step: WizardStep;
  detecting?: boolean;
  suggestionsCount?: number;
  onAutoDetect: () => void;
  big: boolean;
}) {
  return (
    <button
      onClick={() => !detecting && onAutoDetect()}
      disabled={detecting}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: big ? 56 : 40,
        borderRadius: big ? 14 : 10,
        border: `1.5px solid ${GREEN}`,
        background: detecting ? 'transparent' : big ? GOLD : 'transparent',
        color: detecting ? 'rgba(31,77,43,0.5)' : GREEN,
        fontWeight: 700,
        fontSize: big ? 16 : 13,
        cursor: detecting ? 'default' : 'pointer',
        width: '100%',
      }}
    >
      {step === 'base' && detecting ? <Loader2 size={big ? 20 : 15} className="animate-spin" /> : <Sparkles size={big ? 20 : 15} />}
      {step === 'base' && detecting ? 'Detecting… (~20s)' : SUGGEST_LABEL[step]}
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
            background: GREEN,
            color: PAPER,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {suggestionsCount}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------------------
// GUIDED — one big hero step. No clickable step-jumping (pips are progress-only), no
// collapse toggle (guidance always visible — hand-holding is the point), oversized
// primary Next action, Suggest promoted above the fold.
// ---------------------------------------------------------------------------------------
function GuidedWizard({
  step,
  setStep,
  onAutoDetect,
  detecting,
  suggestionsCount,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  onAutoDetect?: () => void;
  detecting?: boolean;
  suggestionsCount?: number;
}) {
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: PAPER,
        border: `2px solid ${GOLD}`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      {/* Progress pips — decorative only, not tappable: guided farmers move forward with
          Back/Next, they don't jump around a stepper. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            aria-hidden
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: i < idx ? GOLD : i === idx ? GREEN : 'rgba(31,77,43,0.15)',
            }}
          />
        ))}
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Step {idx + 1} of {STEP_ORDER.length}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginTop: 2 }}>{STEP_LABELS[step]}</div>
      </div>

      <div
        style={{
          fontSize: 15.5,
          lineHeight: 1.5,
          color: DARK,
          background: 'rgba(31,77,43,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}
      >
        {STEP_GUIDANCE[step]}
      </div>

      {SUGGEST_STEPS.has(step) && onAutoDetect && (
        <SuggestButton step={step} detecting={detecting} suggestionsCount={suggestionsCount} onAutoDetect={onAutoDetect} big />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => canBack && setStep(STEP_ORDER[idx - 1])}
          disabled={!canBack}
          aria-label="Back"
          style={{
            minHeight: 56,
            width: 56,
            flexShrink: 0,
            borderRadius: 14,
            border: `1.5px solid ${GREEN}`,
            background: canBack ? 'transparent' : 'rgba(31,77,43,0.08)',
            color: canBack ? GREEN : 'rgba(31,77,43,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canBack ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => canNext && setStep(STEP_ORDER[idx + 1])}
          disabled={!canNext}
          style={{
            flex: 1,
            minHeight: 56,
            borderRadius: 14,
            border: 'none',
            background: canNext ? GREEN : 'rgba(31,77,43,0.08)',
            color: canNext ? PAPER : 'rgba(31,77,43,0.4)',
            fontWeight: 800,
            fontSize: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          Next: {canNext ? STEP_LABELS[STEP_ORDER[idx + 1]] : ''} <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// PRO — dense, fully-tappable stepper toolbar. Every step is a jump target, guidance is a
// single line, Suggest is a compact inline pill. No hero card, no collapse toggle needed —
// this layout is already minimal-height by design (speed over hand-holding).
// ---------------------------------------------------------------------------------------
function ProWizard({
  step,
  setStep,
  state,
  refLayersPresent,
  onAutoDetect,
  detecting,
  suggestionsCount,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  state: DesignCanvasState;
  refLayersPresent: { boundary: boolean; house: boolean };
  onAutoDetect?: () => void;
  detecting?: boolean;
  suggestionsCount?: number;
}) {
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: PAPER,
        border: `1px solid rgba(31,77,43,0.3)`,
        borderRadius: 10,
        padding: '6px 8px',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Full stepper — every step tappable, jump freely. Compact pill row. */}
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', flex: 1 }}>
          {STEP_ORDER.map((s, i) => {
            const done = stepHasContent(s, state, refLayersPresent);
            const active = s === step;
            return (
              <button
                key={s}
                onClick={() => setStep(s)}
                title={STEP_LABELS[s]}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  minHeight: 30,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: active ? `1.5px solid ${GREEN}` : '1px solid rgba(31,77,43,0.2)',
                  background: active ? GREEN : 'transparent',
                  color: active ? PAPER : DARK,
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    background: done ? GOLD : active ? PAPER : 'rgba(31,77,43,0.15)',
                    color: DARK,
                    flexShrink: 0,
                  }}
                >
                  {done ? <Check size={9} /> : i + 1}
                </span>
                {STEP_LABELS[s]}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => canBack && setStep(STEP_ORDER[idx - 1])}
          disabled={!canBack}
          aria-label="Back"
          style={{
            minHeight: 30,
            minWidth: 30,
            flexShrink: 0,
            borderRadius: 8,
            border: `1px solid ${GREEN}`,
            background: 'transparent',
            color: canBack ? GREEN : 'rgba(31,77,43,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canBack ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => canNext && setStep(STEP_ORDER[idx + 1])}
          disabled={!canNext}
          aria-label="Next"
          style={{
            minHeight: 30,
            minWidth: 30,
            flexShrink: 0,
            borderRadius: 8,
            border: `1px solid ${GREEN}`,
            background: canNext ? GREEN : 'rgba(31,77,43,0.08)',
            color: canNext ? PAPER : 'rgba(31,77,43,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 11.5, lineHeight: 1.3, color: 'rgba(11,18,11,0.75)' }}>
          {STEP_GUIDANCE[step]}
        </div>
        {SUGGEST_STEPS.has(step) && onAutoDetect && (
          <div style={{ width: 190, flexShrink: 0 }}>
            <SuggestButton step={step} detecting={detecting} suggestionsCount={suggestionsCount} onAutoDetect={onAutoDetect} big={false} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function DesignWizard({
  step,
  setStep,
  state,
  refLayersPresent,
  onAutoDetect,
  detecting,
  suggestionsCount,
  mode = 'guided',
}: DesignWizardProps) {
  if (mode === 'pro') {
    return (
      <ProWizard
        step={step}
        setStep={setStep}
        state={state}
        refLayersPresent={refLayersPresent}
        onAutoDetect={onAutoDetect}
        detecting={detecting}
        suggestionsCount={suggestionsCount}
      />
    );
  }
  return (
    <GuidedWizard
      step={step}
      setStep={setStep}
      onAutoDetect={onAutoDetect}
      detecting={detecting}
      suggestionsCount={suggestionsCount}
    />
  );
}
