// What actually happened to the render the farmer paid for.
//
// WHY THIS EXISTS. `lib/render-difference.ts` measures whether a paid pass visibly changed anything,
// and the two gates in DesignGlossy act on that measurement. They were built because Full
// Treatment kept handing back the Hybrid. And yet weeks later the owner said it again —
// "this is a badly produced step 2 even though I selected 3 steps" — and answering him meant
// reading the state machine and guessing, because the only trace either gate leaves is a
// `console.info` that is gone the moment the tab closes.
//
// A paid render's outcome needs to be written down and tied to its exact attempt. Otherwise even
// a real measurement gets combined with an older, unrelated pass. A measurement nobody can read after the fact
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
 *  - `kept`     the pass passed the image-change check and was retained; geometry is unverified.
 *  - `rejected` the difference check rejected the output; this alone does not establish why.
 *  - `unscored` the pixels could not be compared, so the result was retained without a measurement.
 *  - `blocked`  the stage never ran, because the stage below it did not produce a result to build on.
 */
export type RenderAuditOutcome = 'kept' | 'rejected' | 'unscored' | 'blocked';
export type RenderAuditCheckPhase = 'raw' | 'composed';

/** Optional only for logs written before render provenance was persisted. A job identifies one
 * paid pass; an attempt identifies the whole workflow, including a possible second paid job. */
export interface RenderAuditContext {
  siteId?: string;
  jobId?: string;
  attemptId?: string;
  designRevision?: string;
}

export interface RenderAuditEntry extends RenderAuditContext {
  /** ISO timestamp, supplied by the caller — this module stays free of clocks so it can be tested. */
  at: string;
  /** Which of the nine sheets (free-form key, not a union — Earthworks (05) needs no change here). */
  sheetKey: string;
  stage: PaidRenderStage;
  /** What the farmer asked for; missing follow-up records are incomplete evidence, not proof of a cause. */
  outputMode: SheetOutputMode;
  style: string;
  outcome: RenderAuditOutcome;
  /** Separate checks of one paid output are not separate charges. The composed check records
   * the retained result after app-owned content has been drawn back over the model artwork. */
  checkPhase?: RenderAuditCheckPhase;
  verdict?: DifferenceReport['verdict'];
  redrawnFraction?: number;
  touchedFraction?: number;
  blankedFraction?: number;
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
  base: Pick<RenderAuditEntry, 'at' | 'sheetKey' | 'stage' | 'outputMode' | 'style' | 'checkPhase'> & RenderAuditContext,
  report: DifferenceReport,
  keep: boolean,
): RenderAuditEntry {
  return {
    ...base,
    outcome: keep ? 'kept' : 'rejected',
    verdict: report.verdict,
    redrawnFraction: report.redrawnFraction,
    touchedFraction: report.touchedFraction,
    blankedFraction: report.blankedFraction,
    meanDelta: report.meanDelta,
    comparedPixels: report.comparedPixels,
  };
}

/** The entries for one sheet, oldest first. Missing legacy context never matches a requested site,
 * job, attempt or revision: an unlabelled old record cannot speak for a known current artifact. */
export function entriesForSheet(
  log: readonly RenderAuditEntry[],
  sheetKey: string,
  context: RenderAuditContext = {},
): RenderAuditEntry[] {
  return log.filter((e) => e.sheetKey === sheetKey &&
    (context.siteId === undefined || e.siteId === context.siteId) &&
    (context.jobId === undefined || e.jobId === context.jobId) &&
    (context.attemptId === undefined || e.attemptId === context.attemptId) &&
    (context.designRevision === undefined || e.designRevision === context.designRevision));
}

/** Start from the requested artifact (or latest record), then find its own workflow. Filtering by
 * job chooses the anchor, not both passes: Hybrid and polish normally have different job IDs. */
function latestAttemptEntries(
  log: readonly RenderAuditEntry[],
  sheetKey: string,
  context: RenderAuditContext,
): RenderAuditEntry[] {
  const matching = entriesForSheet(log, sheetKey, context);
  const last = matching[matching.length - 1];
  if (!last) return [];
  const sameScope = entriesForSheet(log, sheetKey).filter((e) =>
    e.siteId === last.siteId && e.designRevision === last.designRevision &&
    e.style === last.style && e.outputMode === last.outputMode &&
    e.attemptId === last.attemptId && (last.attemptId !== undefined || e.jobId === last.jobId));
  // Without an attempt ID this is only a legacy sequence. A new Hybrid is still an unmistakable
  // break: yesterday's completed polish must never complete today's new Hybrid in the explanation.
  const hybridIndex = sameScope.findLastIndex((e) => e.stage === 'hybrid');
  return hybridIndex < 0 ? sameScope : sameScope.slice(hybridIndex);
}

const CHANGE_IS_NOT_FIDELITY = ' This measures image change; it does not verify feature positions, counts or geometry.';

/**
 * Answer the owner's actual question for one sheet: I asked for three layers — what did I get?
 *
 * Deliberately worded for a person, not a log reader, and deliberately willing to say "I don't
 * know". The failure mode this whole module exists to kill is a confident answer derived from
 * reading code rather than from what happened.
 */
export function explainSheet(
  log: readonly RenderAuditEntry[],
  sheetKey: string,
  context: RenderAuditContext = {},
): string {
  const entries = latestAttemptEntries(log, sheetKey, context);
  if (entries.length === 0) {
    return 'No paid-render record matches this sheet and render context. The available history cannot establish which map is displayed.';
  }

  const last = entries[entries.length - 1];
  const hybrid = [...entries].reverse().find((e) => e.stage === 'hybrid');
  const polish = [...entries].reverse().find((e) => e.stage === 'polish');

  if (last.outputMode !== 'full') {
    if (hybrid?.outcome === 'kept') return 'The latest recorded Hybrid passed the image-change check and was kept.' + CHANGE_IS_NOT_FIDELITY;
    if (hybrid?.outcome === 'rejected' && hybrid.verdict === 'content-erased') return 'The latest recorded Hybrid erased a large part of the map into blank paper, so it was rejected. The exact map was retained.';
    if (hybrid?.outcome === 'rejected') return 'The latest recorded Hybrid did not pass the image-change check, so it was rejected. The exact map was retained.';
    if (hybrid?.outcome === 'unscored') return 'You asked for the Hybrid. It was kept, but the app could not measure whether it actually redrew anything.';
    if (hybrid?.outcome === 'blocked') return `The Hybrid did not run${hybrid.note ? `: ${hybrid.note}` : '.'}`;
    return 'You asked for the Hybrid, and no result has been recorded for it yet.';
  }

  // outputMode === 'full' — the three-layer case, and the one that keeps going wrong.
  if (!hybrid) {
    return 'You asked for the Full Treatment, but no matching Hybrid is in the available history. The app cannot establish whether both passes ran for this attempt.';
  }
  if (hybrid.outcome === 'rejected') {
    if (hybrid.verdict === 'content-erased') {
      return 'You asked for the Full Treatment. The Hybrid erased a large part of the map into blank paper, so it was rejected — and the polish pass was not started. Your exact map still stands.';
    }
    return 'You asked for the Full Treatment. The Hybrid did not pass the image-change check and was rejected, leaving no approved Hybrid for the polish pass.';
  }
  if (hybrid.outcome === 'blocked') {
    return `You asked for the Full Treatment, but the Hybrid did not run${hybrid.note ? `: ${hybrid.note}` : '.'}`;
  }
  if (!polish) {
    return `You asked for the Full Treatment. The Hybrid was ${hybrid.outcome === 'unscored' ? 'kept without a measurement' : 'kept'}, but no matching polish pass is recorded for this attempt. The latest recorded result is layer 2; the history does not establish why the third layer is missing.`;
  }
  if (!last.attemptId) {
    return 'This older history records a Hybrid and a polish outcome, but has no shared attempt identifier. The app cannot confirm that both belong to the same render.';
  }
  if (polish.outcome === 'blocked') {
    return `You asked for the Full Treatment. The Hybrid was kept but the polish pass never ran${polish.note ? `: ${polish.note}` : '.'}`;
  }
  if (polish.outcome === 'rejected') {
    if (polish.verdict === 'content-erased') {
      return 'You asked for the Full Treatment. The polish pass erased a large part of the map into blank paper, so it was rejected — the intact Hybrid was retained instead.';
    }
    return 'You asked for the Full Treatment. The polish pass ran but did not pass the image-change check, so it was rejected — the retained result is layer 2.';
  }
  if (polish.outcome === 'unscored') {
    return 'You asked for the Full Treatment. The polish pass ran and was kept, but the app could not measure it, so nobody can say whether it changed anything.';
  }
  if (hybrid.outcome === 'unscored') {
    return 'You asked for the Full Treatment. The Hybrid was kept without a measurement; the polish pass then passed the image-change check and was kept. The Hybrid remains unscored.' + CHANGE_IS_NOT_FIDELITY;
  }
  return 'You asked for the Full Treatment. Both passes in this attempt passed the image-change check. The recorded result is layer 3.' + CHANGE_IS_NOT_FIDELITY;
}

/** One line per attempt, newest last — what you paste back when someone asks what happened. */
export function summariseAudit(log: readonly RenderAuditEntry[]): string[] {
  return log.map((e) => {
    const pct = e.redrawnFraction == null ? '—' : `${(e.redrawnFraction * 100).toFixed(1)}% redrawn`;
    const context = [
      e.siteId && `site=${e.siteId}`,
      e.attemptId && `attempt=${e.attemptId}`,
      e.jobId && `job=${e.jobId}`,
      e.designRevision && `revision=${e.designRevision}`,
    ].filter(Boolean).join(' · ');
    return `${e.at} · ${e.sheetKey}${context ? ` · ${context}` : ''} · ${e.outputMode}/${e.stage}${e.checkPhase ? ` · check=${e.checkPhase}` : ''} · ${e.outcome} · ${pct}${e.verdict ? ` · ${e.verdict}` : ''}${e.note ? ` · ${e.note}` : ''}`;
  });
}

/** How many distinct paid passes are in this bounded history. Raw/composed checks and a reload's
 * repeated measurement describe the same charge. Ownerless legacy records cannot be linked. */
export function paidAttemptCount(log: readonly RenderAuditEntry[]): number {
  const knownPasses = new Set<string>();
  let legacyPasses = 0;
  for (const entry of log) {
    if (entry.outcome === 'blocked') continue;
    if (!entry.siteId || !entry.jobId) {
      legacyPasses += 1;
      continue;
    }
    knownPasses.add(JSON.stringify([entry.siteId, entry.jobId, entry.sheetKey, entry.stage]));
  }
  return knownPasses.size + legacyPasses;
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
