'use client';

// Gamified "how complete is this site" score for the report dashboard: a
// donut summarising overallPct plus a 5-item checklist "leaderboard" of the
// underlying steps. Hand-rolled SVG donut (no chart lib) so it stays cheap on
// low-end phones. Every state is paired with an icon + label — colour is
// never the only signal (colourblind-safe).
//
// Self-contained: does not read localStorage/Firestore itself. Pass either
// a pre-computed score (from lib/completion-score.ts) or the raw inputs and
// let this component compute it.

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { COMPLETION_WEIGHTS, computeCompletionScore, type CompletionScoreInputs, type CompletionScoreResult } from '@/lib/completion-score';
import { useLanguage } from '@/lib/i18n';
import { useInViewOnce } from '@/lib/use-in-view-once';
import styles from './CompletionScore.module.css';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

/** Colours for the card. The default is the dark scorecard the report dashboard has always used;
 *  `surface` (desk-13) paints the same card with the theme tokens so /example is not a dark green
 *  slab in light mode. */
const DARK_PALETTE = {
  bg: DARK, border: GREEN, accent: GOLD, strong: GOLD, soft: 'rgba(247,201,126,0.8)',
  faint: 'rgba(247,201,126,0.7)', mid: 'rgba(247,201,126,0.7)', track: 'rgba(247,201,126,0.15)',
  tick: GREEN, tickFg: GOLD, dashed: GOLD, idle: 'rgba(247,201,126,0.45)', idleBorder: 'rgba(247,201,126,0.35)',
};
const SURFACE_PALETTE = {
  bg: 'var(--bg-1)', border: 'var(--border)', accent: 'var(--color-forest-800)', strong: 'var(--text-primary)',
  soft: 'var(--text-secondary)', faint: 'var(--text-muted)', mid: 'var(--text-secondary)', track: 'var(--border)',
  tick: 'var(--color-forest-800)', tickFg: 'var(--bg-1)', dashed: 'var(--gold-dim)', idle: 'var(--text-muted)', idleBorder: 'var(--border)',
};
type Palette = typeof DARK_PALETTE;

export interface CompletionScoreProps {
  /** Paint the card with theme surface tokens instead of the dark scorecard colours. */
  surface?: boolean;
  /** Pre-computed result. Provide this OR `inputs`, not both — `score` wins if both are set. */
  score?: CompletionScoreResult;
  /** Raw already-loaded inputs; computed internally via computeCompletionScore(). */
  inputs?: CompletionScoreInputs;
  /** Optional heading shown above the donut. Defaults to "Site completeness". */
  title?: string;
  className?: string;
}

// Weights come from lib/completion-score.ts. Only used to pace the on-screen count;
// the number always ends on result.overallPct.
const STEP_WEIGHT: Record<string, number> = COMPLETION_WEIGHTS;
const SEGMENT_MS = 350;

const R = 54;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Small inline glyphs so state never relies on colour alone. */
function StepIcon({ done, pct, c }: { done: boolean; pct: number; c: Palette }) {
  if (done) {
    return (
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 9999, background: c.tick, color: c.tickFg,
          flexShrink: 0, border: `1px solid ${c.accent}`,
        }}
      >
        {/* code-11: a literal '✓' text glyph — Lucide only. */}
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 9999, background: 'transparent', color: c.dashed,
          fontSize: 12, fontWeight: 800, flexShrink: 0, border: `1.5px dashed ${c.dashed}`,
        }}
      >
        {Math.round(pct)}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 9999, background: 'transparent', color: c.idle,
        fontSize: 12, fontWeight: 800, flexShrink: 0, border: `1.5px solid ${c.idleBorder}`,
      }}
    >
      ·
    </span>
  );
}

export default function CompletionScore({ score, inputs, title, className, surface }: CompletionScoreProps) {
  const { t } = useLanguage();
  const { ref, phase } = useInViewOnce<HTMLElement>();
  const [drawn, setDrawn] = useState(0);
  const [landed, setLanded] = useState(0);
  const c = surface ? SURFACE_PALETTE : DARK_PALETTE;
  const result = score ?? (inputs ? computeCompletionScore(inputs) : undefined);
  // Steps that add to the score, in journey order; each gets one arc of the ring.
  const segSteps = result ? result.steps.filter((s) => s.pct > 0) : [];
  const segCount = segSteps.length;

  useEffect(() => {
    if (phase === 'armed') { setDrawn(0); setLanded(0); return; }
    if (phase !== 'play' || segCount === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < segCount; i++) {
      timers.push(setTimeout(() => setDrawn(i + 1), i * SEGMENT_MS));
      timers.push(setTimeout(() => setLanded(i + 1), (i + 1) * SEGMENT_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, segCount]);

  if (!result) return null;

  const { overallPct, steps } = result;
  const doneCount = steps.filter((s) => s.done).length;

  // Server render, no JS, reduced motion and the settled state all show the real result.
  const animating = phase !== 'final' && landed < segCount;
  const drawnCount = animating ? drawn : segCount;
  const landedCount = animating ? landed : segCount;
  const landedKeys = new Set(segSteps.slice(0, landedCount).map((s) => s.key));
  const shownDone = animating ? steps.filter((s) => s.done && landedKeys.has(s.key)).length : doneCount;
  const shownPct = !animating
    ? overallPct
    : Math.min(overallPct, Math.round(segSteps.slice(0, landedCount).reduce((sum, s) => sum + (STEP_WEIGHT[s.key] ?? 0) * s.pct / 100, 0)));

  // One arc per contributing step, laid end to end around the ring.
  let offsetPct = 0;
  const arcs = segSteps.map((step, i) => {
    const len = ((STEP_WEIGHT[step.key] ?? 0) * step.pct / 100) / 100 * CIRCUMFERENCE;
    const start = offsetPct / 100 * 360 - 90;
    offsetPct += (STEP_WEIGHT[step.key] ?? 0) * step.pct / 100;
    return { key: step.key, len, start, on: i < drawnCount };
  });

  return (
    <section
      ref={ref}
      className={className}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: '18px 16px',
        color: c.strong,
        fontFamily: 'inherit',
        maxWidth: surface ? undefined : 420,
        width: '100%',
      }}
      aria-label={t('completionScoreAria')}
    >
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', color: c.strong }}>
        {title ?? t('completionScoreTitle')}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
          <svg
            viewBox="0 0 128 128"
            width={128}
            height={128}
            role="img"
            aria-label={t('completionScoreProgressAria').replace('{percent}', String(overallPct)).replace('{done}', String(doneCount)).replace('{total}', String(steps.length))}
          >
            <circle
              cx={64} cy={64} r={R}
              fill="none"
              stroke={c.track}
              strokeWidth={STROKE}
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                className={phase === 'play' ? styles.segment : undefined}
                cx={64} cy={64} r={R}
                fill="none"
                stroke={c.accent}
                strokeWidth={STROKE}
                strokeDasharray={`${arc.on ? arc.len : 0} ${CIRCUMFERENCE}`}
                transform={`rotate(${arc.start} 64 64)`}
              />
            ))}
          </svg>
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: c.strong }}>{shownPct}%</span>
            <span style={{ fontSize: 12.5, color: c.mid, marginTop: 4 }}>
              {t('completionScoreDoneCount').replace('{done}', String(shownDone)).replace('{total}', String(steps.length))}
            </span>
          </div>
        </div>

        {/* Checklist */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 180px', minWidth: 180 }}>
          {steps.map((rawStep) => {
            // A row ticks as its ring segment lands.
            const step = animating && rawStep.pct > 0 && !landedKeys.has(rawStep.key) ? { ...rawStep, done: false, pct: 0 } : rawStep;
            return (
            <li
              key={step.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0',
              }}
            >
              <StepIcon done={step.done} pct={step.pct} c={c} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: step.done ? 700 : 500,
                  color: step.done ? c.strong : c.soft,
                }}
              >
                {t(({ located: 'completionStepLocated', boundary: 'completionStepBoundary', survey: 'completionStepSurvey', design: 'completionStepDesign', cropPlan: 'completionStepCropPlan' } as const)[step.key])}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: c.faint }}>
                {step.done ? t('completionStatusDone') : step.pct > 0 ? t('completionStatusPartial') : t('completionStatusNotStarted')}
              </span>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
