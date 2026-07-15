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

import { computeCompletionScore, type CompletionScoreInputs, type CompletionScoreResult } from '@/lib/completion-score';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

export interface CompletionScoreProps {
  /** Pre-computed result. Provide this OR `inputs`, not both — `score` wins if both are set. */
  score?: CompletionScoreResult;
  /** Raw already-loaded inputs; computed internally via computeCompletionScore(). */
  inputs?: CompletionScoreInputs;
  /** Optional heading shown above the donut. Defaults to "Site completeness". */
  title?: string;
  className?: string;
}

const R = 54;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Small inline glyphs so state never relies on colour alone. */
function StepIcon({ done, pct }: { done: boolean; pct: number }) {
  if (done) {
    return (
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 9999, background: GREEN, color: GOLD,
          fontSize: 13, fontWeight: 800, flexShrink: 0, border: `1px solid ${GOLD}`,
        }}
      >
        ✓
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 9999, background: 'transparent', color: GOLD,
          fontSize: 10, fontWeight: 800, flexShrink: 0, border: `1.5px dashed ${GOLD}`,
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
        width: 22, height: 22, borderRadius: 9999, background: 'transparent', color: 'rgba(247,201,126,0.45)',
        fontSize: 12, fontWeight: 800, flexShrink: 0, border: '1.5px solid rgba(247,201,126,0.35)',
      }}
    >
      ·
    </span>
  );
}

export default function CompletionScore({ score, inputs, title, className }: CompletionScoreProps) {
  const result = score ?? (inputs ? computeCompletionScore(inputs) : undefined);
  if (!result) return null;

  const { overallPct, steps } = result;
  const dashOffset = CIRCUMFERENCE * (1 - overallPct / 100);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      className={className}
      style={{
        background: DARK,
        border: `1px solid ${GREEN}`,
        borderRadius: 16,
        padding: '18px 16px',
        color: GOLD,
        fontFamily: 'inherit',
        maxWidth: 420,
        width: '100%',
      }}
      aria-label="Site completion score"
    >
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', color: GOLD }}>
        {title ?? 'Site completeness'}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
          <svg
            viewBox="0 0 128 128"
            width={128}
            height={128}
            role="img"
            aria-label={`${overallPct}% complete, ${doneCount} of ${steps.length} stages done`}
          >
            <circle
              cx={64} cy={64} r={R}
              fill="none"
              stroke="rgba(247,201,126,0.15)"
              strokeWidth={STROKE}
            />
            <circle
              cx={64} cy={64} r={R}
              fill="none"
              stroke={GOLD}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: GOLD }}>{overallPct}%</span>
            <span style={{ fontSize: 10, color: 'rgba(247,201,126,0.7)', marginTop: 4 }}>
              {doneCount}/{steps.length} done
            </span>
          </div>
        </div>

        {/* Checklist */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 180px', minWidth: 180 }}>
          {steps.map((step) => (
            <li
              key={step.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0',
              }}
            >
              <StepIcon done={step.done} pct={step.pct} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: step.done ? 700 : 500,
                  color: step.done ? GOLD : 'rgba(247,201,126,0.8)',
                }}
              >
                {step.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(247,201,126,0.55)' }}>
                {step.done ? 'Done' : step.pct > 0 ? 'Partial' : 'Not started'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
