'use client';

// The bottom bar — status on the left, the terminal actions on the right.
//
// EXPORT LIVES HERE, NOT IN THE HEADER. In the design mock "Print / Export" sat top-right,
// competing for weight with "Preview map" — but it is the LAST thing you do, and the farmer is
// already at the bottom of the screen when they get there, next to Continue. Putting the end of
// the job at the end of the screen also stops the header pretending to be a toolbar.
//
// It is also split, because Print and Export are not one action: printing makes paper for the
// site, exporting makes a file for a funder or an extension officer. One button that means both
// forces a farmer to guess which one this is.
//
// ONE FILLED PRIMARY. globals.css states the rule on `.u-btn-primary` — "exactly ONE filled
// primary per view; siblings are .u-btn-ghost". In the mock the only filled action was **Add**
// in the left rail, while **Continue** — the control that advances the entire nine-sheet plan
// set — was an outline button. That is the primary on the wrong control, so it is inverted here.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Eye, FileImage, FileText, Printer } from 'lucide-react';

interface BottomBarProps {
  nextLabel: string | null; // null on the last sheet
  onContinue: () => void;
  /** Sheets the farmer has actually worked on, out of the nine. Shown as progress rather than
   *  a hardcoded "On track" — a status that is always the same word is decoration, not status. */
  doneCount: number;
  totalCount: number;
}

const EXPORT_ACTIONS = [
  { id: 'print', label: 'Print this sheet', hint: 'A4 / A3, for the site', Icon: Printer },
  { id: 'pdf', label: 'Export plan set as PDF', hint: 'All nine sheets, one file', Icon: FileText },
  { id: 'images', label: 'Export sheets as images', hint: 'PNG per sheet', Icon: FileImage },
] as const;

export default function BottomBar({ nextLabel, onContinue, doneCount, totalCount }: BottomBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a menu that can only be dismissed by choosing
  // something is a trap, and this one sits over the Continue button.
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExportOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div
      className="flex h-16 shrink-0 items-center justify-between gap-3 border-t px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Hidden below sm, and hidden via a PLAIN WRAPPER rather than by putting `hidden` on the
            pill itself. `.u-status` sets display:inline-flex as a plain class, so it ties with
            Tailwind's `.hidden` on specificity and the winner is stylesheet order — the exact
            trap that kept IdentityBar's save pill rendering on a 390px phone. Wrapped, there is
            no competing display rule.
            It hides at all because at 375px the pill, the Print/Export button and Continue do
            not fit on one 16px-padded row: the pill is `shrink-0`, so it overlapped Export
            instead of yielding. Progress is context; Continue is the action. */}
        <span className="hidden shrink-0 sm:block">
          <span className="u-status u-status-ok shrink-0">
            {doneCount} of {totalCount} sheets started
          </span>
        </span>
        {/* A bar, because a fraction is easier to feel than to read. Hidden on small widths,
            where the words above already carry it. */}
        <span
          className="hidden h-1.5 w-28 overflow-hidden rounded-full sm:block"
          style={{ background: 'var(--surface-2)' }}
          aria-hidden
        >
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            className="u-btn-ghost"
            style={{ paddingLeft: 14, paddingRight: 14, fontSize: 14 }}
          >
            <Download size={16} />
            <span className="hidden sm:inline">Print / Export</span>
            <span className="sm:hidden">Export</span>
          </button>

          {exportOpen && (
            <div
              role="menu"
              className="u-card absolute bottom-[calc(100%+8px)] right-0 z-30 w-[268px] overflow-hidden p-1"
              style={{ background: 'var(--surface)' }}
            >
              {/* The one item here that goes somewhere real, so it leads. Everything below it is
                  still a stub, and a menu whose only working entry is buried under three that are
                  not is a menu that reads as broken. */}
              <Link
                href="/design-studio-2/preview"
                role="menuitem"
                onClick={() => setExportOpen(false)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left no-underline transition-colors hover:bg-[var(--surface-2)]"
              >
                <Eye size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Preview &amp; Export</span>
                  <span className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>Check the sheet, then choose a format</span>
                </span>
              </Link>
              <span className="mx-2.5 my-1 block h-px" style={{ background: 'var(--border)' }} aria-hidden />

              {EXPORT_ACTIONS.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => setExportOpen(false)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                    <span className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>{hint}</span>
                  </span>
                </button>
              ))}
              <p className="px-2.5 pb-1.5 pt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                Wired to the real exporter when this shell takes over from the current studio.
              </p>
            </div>
          )}
        </div>

        {nextLabel ? (
          <button type="button" onClick={onContinue} className="u-btn-primary" style={{ fontSize: 14 }}>
            <span className="hidden font-normal opacity-75 md:inline">Next: {nextLabel}</span>
            <span>Continue</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <span className="u-status u-status-ok">All nine sheets reviewed</span>
        )}
      </div>
    </div>
  );
}
