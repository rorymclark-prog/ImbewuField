// What actually happened to the render the farmer paid for.
//
// WHY THIS EXISTS. `lib/render-difference.ts` already measures whether a paid pass redrew anything,
// and the two gates in DesignGlossy already act on that measurement. Both were built because Full
// Treatment kept handing back the Hybrid. Both work. And yet weeks later the owner said it again —
// "this is a badly produced step 2 even though I selected 3 steps" — and answering him meant
// reading the state machine and guessing, because the only trace either gate leaves is a
// `console.info` that is gone the moment the tab closes.
//
// That is the actual recurring defect. Not the prompt, not the mask, not the flow: the fact that a
// paid render's outcome is not written down anywhere. A measurement nobody can read after the fact
// is barely better than no measurement — it can prevent a bad sheet being shown, but it cannot tell
// you WHY the good one never arrived, and that is the question that keeps being asked.
//
// So every paid attempt appends one line here: which stage ran, what it was measured at, whether it
// was kept, and — when a Full Treatment stops early — the reason. `explainSheet` then answers the
// owner's question directly from the record instead of from anyone's memory of the code.
//
// PURE except for the two storage functions at the bottom, so the logic is tested against
// constructed logs rather than mocked around a browser.

import type { DifferenceReport, PaidRenderStage } from './render-difference';
import type { SheetOutputMode } from './locked-polish-flow';

/** What became of one paid attempt.
 *  - `kept`     the pass redrew the sheet and its result is what the farmer is looking at.
 *  - `rejected` the difference gate proved it returned its input; the previous layer still stands.
 *  - `unscored` the pixels could not be compared, so the result was kept unmeasured. Scoring must
 *               never fail a render it simply could not read — but it must not pretend either.
 *  - `blocked`  the stage never ran, because the stage below it did not produce a result to build on.
 */
export type RenderAuditOutcome = 'kept' | 'rejected' | 'unscored' | 'blocked';

export interface RenderAuditEntry {
  /** ISO timestamp, supplied by the caller — this module stays free of clocks so it can be tested. */
  at: string;
  /** Which of the eight sheets. */
  sheetKey: string;
  stage: PaidRenderStage;
  /** What the farmer asked for, which is the whole point: 'full' here with no polish entry is the bug. */
  outputMode: SheetOutputMode;
  style: string;
  outcome: RenderAuditOutcome;
  verdict?: DifferenceReport['verdict'];
  redrawnFraction?: number;
  touchedFraction?: number;
  meanDelta?: number;
  comparedPixels?: number;
  /** Free text for the `blocked`/`unscored` cases — why, in words a human can act on. */
  note?: string;
}

/** Enough history to cover a working session of experiments; small enough to sit in localStorage
 *  next to everything else without ever being the reason a write fails. */
export const MAX_AUDIT_ENTRIES = 60;

export const RENDER_AUDIT_KEY = 'imbewu_render_audit';

/** Append, newest last, bounded. Pure: the caller owns the storage. */
export function appendAuditEntry(
  log: readonly RenderAuditEntry[],
  entry: RenderAuditEntry,
): RenderAuditEntry[] {
  return [...log, entry].slice(-MAX_AUDIT_ENTRIES);
}

/** Build an entry from a difference report, so the two gate call sites cannot disagree about which
 *  fields matter or what counts as kept. */
export function auditFromReport(
  base: Pick<RenderAuditEntry, 'at' | 'sheetKey' | 'stage' | 'outputMode' | 'style'>,
  report: DifferenceReport,
  keep: boolean,
): RenderAuditEntry {
  return {
    ...base,
    outcome: keep ? 'kept' : 'rejected',
    verdict: report.verdict,
    redrawnFraction: report.redrawnFraction,
    touchedFraction: report.touchedFraction,
    meanDelta: report.meanDelta,
    comparedPixels: report.comparedPixels,
  };
}

/** The entries for one sheet, oldest first. */
export function entriesForSheet(
  log: readonly RenderAuditEntry[],
  sheetKey: string,
): RenderAuditEntry[] {
  return log.filter((e) => e.sheetKey === sheetKey);
}

/**
 * Answer the owner's actual question for one sheet: I asked for three layers — what did I get?
 *
 * Deliberately worded for a person, not a log reader, and deliberately willing to say "I don't
 * know". The failure mode this whole module exists to kill is a confident answer derived from
 * reading code rather than from what happened.
 */
export function explainSheet(log: readonly RenderAuditEntry[], sheetKey: string): string {
  const entries = entriesForSheet(log, sheetKey);
  if (entries.length === 0) {
    return 'No paid render has been attempted for this sheet, so what you are looking at is the free exact map.';
  }

  const last = entries[entries.length - 1];
  const hybrid = [...entries].reverse().find((e) => e.stage === 'hybrid');
  const polish = [...entries].reverse().find((e) => e.stage === 'polish');

  if (last.outputMode !== 'full') {
    if (hybrid?.outcome === 'kept') return 'You asked for the Hybrid, and the AI pass redrew it. That is what you are looking at.';
    if (hybrid?.outcome === 'rejected') return 'You asked for the Hybrid, but the AI pass returned the map it was given, so it was rejected and your exact map still stands.';
    if (hybrid?.outcome === 'unscored') return 'You asked for the Hybrid. It was kept, but the app could not measure whether it actually redrew anything.';
    return 'You asked for the Hybrid, and no result has been recorded for it yet.';
  }

  // outputMode === 'full' — the three-layer case, and the one that keeps going wrong.
  if (!hybrid) {
    return 'You asked for the Full Treatment, but no Hybrid was ever recorded — so the second layer never ran, and the third could not start.';
  }
  if (hybrid.outcome === 'rejected') {
    return 'You asked for the Full Treatment. The Hybrid came back as the same map it was given, so it was rejected — and the polish pass was not started, because there was nothing new to polish.';
  }
  if (!polish) {
    return 'You asked for the Full Treatment and the Hybrid succeeded, but NO POLISH PASS WAS EVER RECORDED. You are looking at layer 2. This is the bug, not a judgement about quality.';
  }
  if (polish.outcome === 'blocked') {
    return `You asked for the Full Treatment. The Hybrid succeeded but the polish pass never ran${polish.note ? `: ${polish.note}` : '.'}`;
  }
  if (polish.outcome === 'rejected') {
    return 'You asked for the Full Treatment. The polish pass ran and returned the Hybrid it was given, so it was rejected — you are looking at layer 2, and layer 3 added nothing.';
  }
  if (polish.outcome === 'unscored') {
    return 'You asked for the Full Treatment. The polish pass ran and was kept, but the app could not measure it, so nobody can say whether it changed anything.';
  }
  return 'You asked for the Full Treatment. Both the Hybrid and the polish pass redrew the sheet, so you are looking at layer 3.';
}

/** One line per attempt, newest last — what you paste back when someone asks what happened. */
export function summariseAudit(log: readonly RenderAuditEntry[]): string[] {
  return log.map((e) => {
    const pct = e.redrawnFraction == null ? '—' : `${(e.redrawnFraction * 100).toFixed(1)}% redrawn`;
    return `${e.at} · ${e.sheetKey} · ${e.outputMode}/${e.stage} · ${e.outcome} · ${pct}${e.verdict ? ` · ${e.verdict}` : ''}${e.note ? ` · ${e.note}` : ''}`;
  });
}

/** How many paid passes are on record — the number to check against a bill. */
export function paidAttemptCount(log: readonly RenderAuditEntry[]): number {
  return log.filter((e) => e.outcome !== 'blocked').length;
}

// ── Storage. The only impure part, and deliberately forgiving: an audit trail must never be the
//    reason a farmer's render fails. Every path swallows and carries on.

export function loadRenderAudit(): RenderAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RENDER_AUDIT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RenderAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordRenderAudit(entry: RenderAuditEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const next = appendAuditEntry(loadRenderAudit(), entry);
    window.localStorage.setItem(RENDER_AUDIT_KEY, JSON.stringify(next));
  } catch {
    /* A full or unavailable localStorage must not break a render. */
  }
}
