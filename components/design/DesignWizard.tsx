'use client';

// DesignWizard — the wizard chrome has to LOOK like two different products, not one
// component with a filter, because "I don't see the difference" was the owner's actual
// complaint. GUIDED renders a single big hero step (one focus, one primary action, no
// step-jumping). PRO renders a dense, fully-tappable toolbar (speed, everything visible).
// They share only the step data/labels below, not layout.

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  HelpCircle,
} from 'lucide-react';
import type { DesignCanvasState, WizardStep } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { DESIGN_STEP_LESSONS } from '@/lib/design-lessons';
import { LessonPanel } from './LessonPanel';
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
  mode?: DesignMode;
}

export const STEP_ORDER: WizardStep[] = ['base', 'sector', 'water', 'zones', 'planting', 'structures', 'review', 'glossy'];

export const STEP_LABELS: Record<WizardStep, string> = {
  base: 'Base',
  sector: 'Sector',
  water: 'Water',
  zones: 'Zones',
  planting: 'Planting',
  structures: 'Structures',
  review: 'Review',
  glossy: 'Glossy',
};

const STEP_GUIDANCE: Record<WizardStep, string> = {
  base: "Check your boundary and house are showing — trace them on the main map if not.",
  sector: "The land's energies — sun, wind, fire, water. Nothing to draw: check it matches what you know of your land.",
  water: 'Start with water: place tanks by roofs, mark taps, draw swale lines across the slope.',
  zones: 'Paint your zones — Zone 1 nearest the kitchen door, wilder as numbers grow. Tap "Where do my zones go?" if you want Lima\'s advice.',
  planting: "Trees south of beds so they don't shade them. Tap a tree, then tap the map.",
  structures: 'Add sheds, pens, compost, beehives — mind the beehive flight path.',
  review: 'Toggle layers to check each map: water, zones, planting.',
  glossy: "Glossy map (beta · experimental) — the AI isn't reliable yet, and you may need a few tries.",
};

function stepHasContent(step: WizardStep, state: DesignCanvasState, refLayersPresent: { boundary: boolean; house: boolean }): boolean {
  switch (step) {
    case 'base':
      return refLayersPresent.boundary && refLayersPresent.house;
    case 'water':
      // Earthworks are placed on the Water step (see DesignPalette categoriesForStep), so they
      // count as its content — otherwise a farmer who placed a tree basin or a swale berm here
      // would still be told the step is empty.
      return state.items.some((it) => {
        const cat = ELEMENTS_BY_ID[it.defId]?.category;
        return cat === 'water' || cat === 'earthworks';
      }) ||
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
    case 'sector':
      // Analysis-only reveal — nothing is drawn, so it is never "empty". The energies are
      // computed deterministically (lib/sector) and shown the moment the farmer lands here.
    case 'review':
    case 'glossy':
      return true;
    default:
      return false;
  }
}


// "Why this step?" — per-step permaculture lesson (Lane 4, docs/DISCOVERABILITY-SIMPLE-PLAN.md
// §4.2/§4.3). Split into a state hook + a pure content panel so guided and pro can place the
// toggle button and the panel in different spots of their own chrome (pro puts the button
// inline in the dense guidance row but the panel full-width below it) while sharing the same
// collapsed-by-default, reset-on-step-change behaviour and exact lesson content.
function useLessonExpand(step: WizardStep) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [step]);

  // The 'glossy' step has no lesson (it's the artist's-impression export, not a design step).
  const lesson = step === 'glossy' ? undefined : DESIGN_STEP_LESSONS[step];
  return { expanded, toggle: () => setExpanded((v) => !v), lesson };
}

// LessonPanel moved to ./LessonPanel (shared with the app-wide <LessonLink>); re-exported so
// existing importers (StepGuide) keep resolving it from './DesignWizard'.
export { LessonPanel };

// Guided: quiet, full-width 44px labelled row under the guidance blurb — matches the
// hand-holding tone of the rest of GuidedWizard.
function GuidedLessonExpander({ step }: { step: WizardStep }) {
  const { expanded, toggle, lesson } = useLessonExpand(step);
  if (!lesson) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
          minHeight: 38,
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
          color: GREEN,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <HelpCircle size={13} />
        Why this step?
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {expanded && <LessonPanel lesson={lesson} />}
    </div>
  );
}

// Pro: compact 30px icon button matching the existing Back/Next controls (density over
// hand-holding); caller places the button inline and the returned panel wherever full-width
// space is available (below the toolbar row), so the two pieces are exposed separately.
function useProLessonExpander(step: WizardStep) {
  const { expanded, toggle, lesson } = useLessonExpand(step);
  if (!lesson) return { button: null, panel: null };
  const button = (
    <button
      type="button"
      onClick={toggle}
      aria-label="Why this step?"
      aria-expanded={expanded}
      style={{
        minHeight: 30,
        minWidth: 30,
        flexShrink: 0,
        borderRadius: 8,
        border: `1px solid ${GREEN}`,
        background: expanded ? GREEN : 'transparent',
        color: expanded ? PAPER : GREEN,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <HelpCircle size={15} />
    </button>
  );
  const panel = expanded ? <LessonPanel lesson={lesson} /> : null;
  return { button, panel };
}

// ---------------------------------------------------------------------------------------
// GUIDED — one big hero step. No clickable step-jumping (pips are progress-only), no
// collapse toggle (guidance always visible — hand-holding is the point), oversized
// primary Next action, Suggest promoted above the fold.
// ---------------------------------------------------------------------------------------
function GuidedWizard({
  step,
  setStep,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
}) {
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        background: PAPER,
        border: `2px solid ${GOLD}`,
        borderRadius: 18,
        padding: 8,
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
        <div style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 700, color: GREEN, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Step {idx + 1} of {STEP_ORDER.length}
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.15, fontWeight: 800, color: DARK, marginTop: 1 }}>{STEP_LABELS[step]}</div>
      </div>

      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.4,
          color: DARK,
          background: 'rgba(31,77,43,0.06)',
          borderRadius: 12,
          padding: '8px 12px',
        }}
      >
        {STEP_GUIDANCE[step]}
      </div>

      <GuidedLessonExpander step={step} />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => canBack && setStep(STEP_ORDER[idx - 1])}
          disabled={!canBack}
          aria-label="Back"
          style={{
            minHeight: 44,
            width: 44,
            flexShrink: 0,
            borderRadius: 12,
            border: `1.5px solid ${GREEN}`,
            background: canBack ? 'transparent' : 'rgba(31,77,43,0.08)',
            color: canBack ? GREEN : 'rgba(31,77,43,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canBack ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => canNext && setStep(STEP_ORDER[idx + 1])}
          disabled={!canNext}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 12,
            border: 'none',
            background: canNext ? GREEN : 'rgba(31,77,43,0.08)',
            color: canNext ? PAPER : 'rgba(31,77,43,0.4)',
            fontWeight: 800,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          Next: {canNext ? STEP_LABELS[STEP_ORDER[idx + 1]] : ''} <ChevronRight size={17} />
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
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  state: DesignCanvasState;
  refLayersPresent: { boundary: boolean; house: boolean };
}) {
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;
  const { button: lessonButton, panel: lessonPanel } = useProLessonExpander(step);

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
        {lessonButton}
      </div>

      {lessonPanel}
    </div>
  );
}

export default function DesignWizard({
  step,
  setStep,
  state,
  refLayersPresent,
  mode = 'guided',
}: DesignWizardProps) {
  if (mode === 'pro') {
    return <ProWizard step={step} setStep={setStep} state={state} refLayersPresent={refLayersPresent} />;
  }
  return <GuidedWizard step={step} setStep={setStep} />;
}
