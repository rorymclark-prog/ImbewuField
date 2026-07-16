'use client';

// AdvancedToolsSheet — the quiet home for the demoted auto-draw / auto-design tools.
// Rory's override: auto-SUGGEST / auto-DRAW is no longer a prominent path. Lima drafts
// shapes here for REVIEW only; the farmer's own drawing is always the boss. Reached from
// the slim chrome row in app/design/page.tsx, never from a hero bar.
//
// (Design Studio is not yet i18n-wired — copy is hardcoded English matching the T.en keys
// registered for this lane, same as the rest of app/design/*.)

import { ScanSearch, FlaskConical, Wand2, ChevronRight, X } from 'lucide-react';
import type { WizardStep } from '@/lib/design-canvas';

const PAPER = '#FFFEFA';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const DARK = '#0B120B';

export type AdvancedAction = 'detect' | 'zones' | 'water' | 'planting' | 'structures' | 'autoDesign';

export interface AdvancedToolsSheetProps {
  open: boolean;
  step: WizardStep;
  detecting: boolean;
  onClose: () => void;
  onRun: (action: AdvancedAction) => void;
}

interface Row {
  action: AdvancedAction;
  icon: typeof ScanSearch;
  label: string;
  hint: string;
  beta: boolean;
}

const ROWS: Row[] = [
  { action: 'detect', icon: ScanSearch, label: 'Find what is already here (AI)', hint: 'Reads your satellite photo and marks trees, roofs and water it can see.', beta: false },
  { action: 'zones', icon: FlaskConical, label: 'Auto-draw zones', hint: 'Lima drafts effort-zone shapes for you to review.', beta: true },
  { action: 'water', icon: FlaskConical, label: 'Auto-draw water setup', hint: 'Lima drafts tanks, taps and swale lines for you to review.', beta: true },
  { action: 'planting', icon: FlaskConical, label: 'Auto-draw planting', hint: 'Lima drafts trees and beds for you to review.', beta: true },
  { action: 'structures', icon: FlaskConical, label: 'Auto-draw structures', hint: 'Lima drafts sheds, compost and pens for you to review.', beta: true },
  { action: 'autoDesign', icon: Wand2, label: 'Auto-design my whole farm', hint: 'A few quick questions, then a full draft to review.', beta: true },
];

function BetaChip() {
  return (
    <span
      style={{
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: OCHRE,
        background: 'rgba(192,122,30,0.12)',
        borderRadius: 6,
        padding: '3px 6px',
        flexShrink: 0,
      }}
    >
      Beta
    </span>
  );
}

// `step` is part of the props contract (wizard context) but every action runs regardless of
// the current step — that decoupling is the whole point of this sheet — so it is intentionally
// not read here.
export default function AdvancedToolsSheet({ open, detecting, onClose, onRun }: AdvancedToolsSheetProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Advanced tools"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(11,18,11,0.45)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: PAPER,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '14px 16px calc(16px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: '82dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: DARK, flex: 1 }}>Advanced tools</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: 'none',
              background: 'rgba(11,18,11,0.06)',
              color: DARK,
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {ROWS.map((row) => {
          const Icon = row.icon;
          const isCurrentRunning = detecting;
          return (
            <button
              key={row.action}
              type="button"
              disabled={isCurrentRunning}
              onClick={() => onRun(row.action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 56,
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 12,
                border: '1px solid #E2D8C4',
                background: '#FFFFFF',
                color: DARK,
                cursor: isCurrentRunning ? 'default' : 'pointer',
                opacity: isCurrentRunning ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  background: 'rgba(31,77,43,0.08)',
                  color: GREEN,
                }}
              >
                <Icon size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{row.label}</span>
                  {row.beta && <BetaChip />}
                </span>
                <span style={{ fontSize: 12, color: '#8A7C63', lineHeight: 1.3 }}>{row.hint}</span>
              </span>
              <ChevronRight size={18} color="#B7A98D" style={{ flexShrink: 0 }} />
            </button>
          );
        })}

        <p style={{ fontSize: 12, color: '#8A7C63', lineHeight: 1.4, margin: '6px 4px 0' }}>
          Beta: Lima drafts shapes for you to review. Accept, move or delete them — your own
          drawing is always the boss.
        </p>
      </div>
    </div>
  );
}
