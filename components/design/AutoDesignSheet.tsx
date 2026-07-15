'use client';

// AI Auto-Design questionnaire — a lightweight, phone-first bottom sheet shown when the
// farmer taps "Auto-design my farm". Mirrors the crop AutoSuggestModal's visual language
// (uppercase tracked labels, full-width tile buttons, one big CTA) but stays deliberately
// light: 2-4 questions, every one skippable. Purely presentational — page.tsx owns the
// answers state and the fetch.

import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { AutoDesignAnswers } from '@/lib/design-suggest';

const PAPER = '#FFFEFA';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';
const BORDER = '#E2D8C4';
const LABEL = '#8C7A62';

type Goal = NonNullable<AutoDesignAnswers['goal']>;
type People = NonNullable<AutoDesignAnswers['people']>;
type AccessSide = 'N' | 'E' | 'S' | 'W' | 'auto';
type WaterSource = NonNullable<AutoDesignAnswers['waterSource']> | 'unsure';

const GOAL_OPTIONS: { key: Goal; label: string; blurb: string }[] = [
  { key: 'food', label: 'Food security', blurb: 'Feed the household first' },
  { key: 'income', label: 'Income', blurb: 'Grow a market block to sell' },
  { key: 'both', label: 'Both', blurb: 'Feed us, sell the surplus' },
];
const PEOPLE_OPTIONS: { key: People; label: string }[] = [
  { key: 'small', label: '1-2' },
  { key: 'medium', label: '3-5' },
  { key: 'large', label: '6+' },
];
const ACCESS_OPTIONS: { key: AccessSide; label: string }[] = [
  { key: 'N', label: 'N' },
  { key: 'E', label: 'E' },
  { key: 'S', label: 'S' },
  { key: 'W', label: 'W' },
  { key: 'auto', label: 'Figure it out' },
];
const WATER_OPTIONS: { key: WaterSource; label: string }[] = [
  { key: 'tank', label: 'Tank' },
  { key: 'borehole', label: 'Borehole' },
  { key: 'municipal', label: 'Municipal' },
  { key: 'unsure', label: 'Not sure' },
];

function tileStyle(active: boolean): CSSProperties {
  return {
    background: active ? GREEN : '#FFFFFF',
    color: active ? PAPER : '#5C5040',
    border: `1px solid ${active ? GREEN : BORDER}`,
    cursor: 'pointer',
  };
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  color: LABEL,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 6,
};

export interface AutoDesignSheetProps {
  open: boolean;
  answers: AutoDesignAnswers;
  onChange: (patch: Partial<AutoDesignAnswers>) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function AutoDesignSheet({ open, answers, onChange, onSubmit, onSkip, onClose }: AutoDesignSheetProps) {
  if (!open) return null;

  // Map the sheet's UI keys onto the answers shape (auto/unsure → null = "figure it out").
  const accessValue: AccessSide = answers.accessSide == null ? 'auto' : (answers.accessSide as AccessSide);
  const waterValue: WaterSource = answers.waterSource == null ? 'unsure' : answers.waterSource;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,18,11,0.45)' }} />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: '86dvh',
          overflowY: 'auto',
          background: PAPER,
          border: `1px solid ${BORDER}`,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: '0 -8px 32px rgba(32,25,15,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${BORDER}`,
            position: 'sticky',
            top: 0,
            background: PAPER,
            zIndex: 1,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: DARK, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ✨ Auto-design my farm
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: LABEL, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 12.5, color: '#7A6C58', lineHeight: 1.4, margin: 0 }}>
            A few quick taps and we&rsquo;ll lay out zones, a veg garden, a wind belt and water — all as suggestions you can accept or tweak. Skip any question.
          </p>

          {/* Main goal */}
          <div>
            <div style={labelStyle}>Main goal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {GOAL_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onChange({ goal: o.key })}
                  style={{ ...tileStyle(answers.goal === o.key), textAlign: 'left', padding: '8px 12px', borderRadius: 12, minHeight: 44 }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{o.label}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.85 }}>{o.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {/* People to feed — hidden when income-only */}
          {answers.goal !== 'income' && (
            <div>
              <div style={labelStyle}>How many people to feed?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {PEOPLE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => onChange({ people: o.key })}
                    style={{ ...tileStyle(answers.people === o.key), padding: '8px 0', borderRadius: 10, minHeight: 44, fontWeight: 700, fontSize: 13, textAlign: 'center' }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Access / kitchen side */}
          <div>
            <div style={labelStyle}>Main access / kitchen side</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {ACCESS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onChange({ accessSide: o.key === 'auto' ? null : o.key })}
                  style={{ ...tileStyle(accessValue === o.key), padding: '8px 2px', borderRadius: 10, minHeight: 44, fontWeight: 700, fontSize: o.key === 'auto' ? 10.5 : 13, textAlign: 'center', lineHeight: 1.15 }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main water source */}
          <div>
            <div style={labelStyle}>Main water source</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {WATER_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onChange({ waterSource: o.key === 'unsure' ? null : (o.key as AutoDesignAnswers['waterSource']) })}
                  style={{ ...tileStyle(waterValue === o.key), padding: '8px 0', borderRadius: 10, minHeight: 44, fontWeight: 700, fontSize: 12.5, textAlign: 'center' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onSubmit}
              style={{ flex: 2, minHeight: 48, borderRadius: 12, border: 'none', background: GREEN, color: PAPER, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Design my farm
            </button>
            <button
              onClick={onSkip}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, border: `1px solid ${BORDER}`, background: 'transparent', color: DARK, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Skip →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
