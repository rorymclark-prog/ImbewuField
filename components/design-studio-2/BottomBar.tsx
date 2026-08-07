'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface BottomBarProps {
  nextLabel: string | null; // null on the last sheet
  onContinue: () => void;
}

export default function BottomBar({ nextLabel, onContinue }: BottomBarProps) {
  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between border-t px-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ok)' }}>
        <CheckCircle2 size={16} />
        Design status: On track
      </div>

      {nextLabel ? (
        <button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          <span className="opacity-80">Next up: {nextLabel}</span>
          <span className="flex items-center gap-1">
            Continue <ArrowRight size={15} />
          </span>
        </button>
      ) : (
        <span className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          All 9 sheets reviewed
        </span>
      )}
    </div>
  );
}
