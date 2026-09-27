'use client';

// DesignWizard — the wizard chrome. GUIDED renders a single big hero step (one focus, one
// primary action, no step-jumping) — the only mode left reachable; see the default export below
// for the removed PRO alternative.

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import type { DesignCanvasState, WizardStep } from '@/lib/design-canvas';
import { DESIGN_STEP_LESSONS } from '@/lib/design-lessons';
import {
  DESIGN_CHROME_KEYS,
  formatDesignTranslation,
  translatedDesignStepGuidance,
  translatedDesignStepLabel,
} from '@/lib/design-studio-i18n';
import { translate, useLanguage } from '@/lib/i18n';
import { LessonPanel } from './LessonPanel';
import DesignZuluDraftNotice from './DesignZuluDraftNotice';
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

// Earthworks sits directly after Water: you decide where the water goes, then you shape the
// ground that holds it — which is also the order the phasing engine builds in (lib/phasing:
// Climate → Landform → Water → Access → Earthworks).
export const STEP_ORDER: WizardStep[] = ['base', 'sector', 'water', 'earthworks', 'zones', 'planting', 'structures', 'review', 'glossy'];

// app/design still imports this compatibility map. Its English now comes from the same dictionary
// keys as the translated wizard rather than a second hard-coded source.
export const STEP_LABELS = Object.fromEntries(
  STEP_ORDER.map((step) => [step, translatedDesignStepLabel((key) => translate('en', key), step)]),
) as Record<WizardStep, string>;

// "Why this step?" — per-step permaculture lesson (Lane 4, docs/DISCOVERABILITY-SIMPLE-PLAN.md
// §4.2/§4.3). A state hook plus a pure content panel, kept separate so the toggle button and the
// panel can sit in different spots of the chrome while sharing the same
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
  const { t } = useLanguage();
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
          color: 'var(--color-forest-800)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <HelpCircle size={13} />
        {t(DESIGN_CHROME_KEYS.whyThisStep)}
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {expanded && <LessonPanel lesson={lesson} />}
    </div>
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
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
}) {
  const { t, lang } = useLanguage();
  const idx = STEP_ORDER.indexOf(step);
  const canBack = idx > 0;
  const canNext = idx < STEP_ORDER.length - 1;
  const stepLabel = translatedDesignStepLabel(t, step);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        background: 'var(--bg-1)',
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
        <div style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 700, color: 'var(--color-forest-800)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {formatDesignTranslation(t(DESIGN_CHROME_KEYS.stepProgress), {
            current: idx + 1,
            total: STEP_ORDER.length,
          })}
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 1 }}>{stepLabel}</div>
      </div>

      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.4,
          color: 'var(--text-primary)',
          background: 'rgba(31,77,43,0.06)',
          borderRadius: 12,
          padding: '8px 12px',
        }}
      >
        {lang === 'zu' && <DesignZuluDraftNotice />}
        {translatedDesignStepGuidance(t, step)}
      </div>

      <GuidedLessonExpander step={step} />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => canBack && setStep(STEP_ORDER[idx - 1])}
          disabled={!canBack}
          aria-label={t(DESIGN_CHROME_KEYS.back)}
          style={{
            minHeight: 44,
            width: 44,
            flexShrink: 0,
            borderRadius: 12,
            border: `1.5px solid var(--color-forest-800)`,
            background: canBack ? 'transparent' : 'rgba(31,77,43,0.08)',
            color: canBack ? 'var(--color-forest-800)' : 'rgba(31,77,43,0.4)',
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
          {formatDesignTranslation(t(DESIGN_CHROME_KEYS.nextStep), {
            step: canNext ? translatedDesignStepLabel(t, STEP_ORDER[idx + 1]) : '',
          })}{' '}
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

// PRO mode (a dense, fully-tappable stepper toolbar, as an alternative to the hero card below)
// was removed here: `mode` is only ever constructed as the literal 'guided' (app/design/page.tsx
// `const designMode: DesignMode = 'guided'`, with no setter and no stored flag anywhere in the
// codebase), so the branch that rendered it could never run. `mode` stays on the props/import
// list below so the three existing call sites (app/design/page.tsx) don't need to change.
export default function DesignWizard({
  step,
  setStep,
}: DesignWizardProps) {
  return <GuidedWizard step={step} setStep={setStep} />;
}
