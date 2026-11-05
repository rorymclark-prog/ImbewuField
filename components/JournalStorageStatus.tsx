'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { journalStorageMessage } from '@/lib/journal-storage-status-copy';
import {
  JOURNAL_STORAGE_EVENT, initialiseJournalStorage, makeBrowserJournalStorageContext,
  readJournalStorageStatus, recoverJournalStorage, releaseAllDocumentJournalLeases,
  readJournalLegacyReview, exportJournalLegacyReview, keepCurrentJournalAfterLegacyReview,
  journalLegacyReviewIsCurrent,
  type JournalStorageContext, type JournalStorageStatus,
} from '@/lib/journal-storage';

// Readiness changes withdraw journal editors without loading farming data
// into the global account setup. The event grants no write permission.
const JOURNAL_CHANGED_EVENT = 'imbewu-field-journal-changed';
const SAMPLE_MODE_EVENT = 'imbewu-sample-mode-changed';
type ReviewSummary = { currentSavedRows: number | null; olderSavedRows: number | null };
type ReviewOutcome = 'download-failed' | 'held' | 'superseded' | 'kept' | null;
type Delivery = { status: JournalStorageStatus | null; busy: boolean; retry: () => void; recover: () => void;
  review: ReviewSummary | null; reviewEpoch: number; downloaded: boolean; outcome: ReviewOutcome;
  downloadCopies: () => void; keepCurrent: (expectedReviewEpoch: number, isConfirmed: () => boolean) => void };
const StorageContext = createContext<Delivery | null>(null);
const signature = (status: JournalStorageStatus | null) => status && JSON.stringify([
  status.status, status.reason, status.writable, status.needsInitialisation, status.legacyDiverged,
]);
const unavailable = (): JournalStorageStatus => ({ status: 'held', reason: 'storage-unavailable', writable: false,
  needsInitialisation: false, legacyDiverged: false });

/** One document owns the editing lease. Notices only observe this provider;
 * mounting a second screen notice must never compete for another lease. */
export default function JournalStorageProvider({ children }: { children: ReactNode }) {
  const { user, loading, journalMigrationHold = null, retryJournalMigration } = useAuth();
  const owner = user?.uid ?? null;
  const [sampleEpoch, setSampleEpoch] = useState(0);
  const [delivery, setDelivery] = useState<{ owner: string | null; epoch: number; status: JournalStorageStatus | null; busy: boolean;
    review: ReviewSummary | null; reviewEpoch: number; downloaded: boolean; outcome: ReviewOutcome }>(
    { owner, epoch: sampleEpoch, status: null, busy: true, review: null, reviewEpoch: 0, downloaded: false, outcome: null });
  const operation = useRef<((kind: 'initialise' | 'recover') => void) | null>(null);
  const reviewOperation = useRef<((kind: 'download' | 'keep', approval?: { epoch: number; isCurrent: () => boolean }) => void) | null>(null);
  const reviewSequence = useRef(0);
  useEffect(() => {
    const sampleChanged = () => setSampleEpoch(value => value + 1);
    window.addEventListener(SAMPLE_MODE_EVENT, sampleChanged);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, sampleChanged);
  }, []);
  useEffect(() => {
    if (loading) return;
    let active = true, suspended = false, request = 0, lifecycle = 0, pending = false;
    let context: JournalStorageContext | null = null;
    let current: JournalStorageStatus | null = null;
    let legacyReview: ReturnType<typeof readJournalLegacyReview> = null;
    let downloaded = false, reviewEpoch = ++reviewSequence.current;
    let outcome: ReviewOutcome = null;
    const changed = () => window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT));
    const render = (status: JournalStorageStatus | null, busy: boolean) => setDelivery({ owner, epoch: sampleEpoch, status, busy,
      review: legacyReview && { currentSavedRows: legacyReview.currentSavedRows, olderSavedRows: legacyReview.olderSavedRows },
      reviewEpoch, downloaded, outcome });
    const publish = (status: JournalStorageStatus, busy = false) => {
      if (!active || suspended) return;
      const different = signature(current) !== signature(status);
      current = status;
      if (status.legacyDiverged && context && context.isCurrent()) {
        if (!legacyReview || !journalLegacyReviewIsCurrent(legacyReview.review, context)) {
          legacyReview = readJournalLegacyReview(context); downloaded = false; reviewEpoch = ++reviewSequence.current;
        }
      } else { legacyReview = null; downloaded = false; }
      render(status, busy);
      if (different) changed();
    };
    const capture = () => {
      const captured = makeBrowserJournalStorageContext();
      const epoch = lifecycle;
      return captured && { ...captured, isCurrent: () => active && !suspended && lifecycle === epoch && captured.isCurrent() };
    };
    const run = (kind: 'initialise' | 'recover') => {
      if (!active || suspended || pending || outcome === 'superseded') return;
      const epoch = ++request;
      context = capture();
      pending = true;
      render(current, true);
      const attempt = Promise.resolve().then(async () => {
        if (journalMigrationHold) {
          await retryJournalMigration();
          // Auth publishes the cleared barrier before the fresh account effect
          // initializes. Reusing this effect would race that context handover.
          return readJournalStorageStatus(context);
        }
        if (context && !context.isCurrent()) return readJournalStorageStatus(context);
        if (kind === 'recover' && context) await recoverJournalStorage(context);
        if (context && !context.isCurrent()) return readJournalStorageStatus(context);
        return initialiseJournalStorage(context);
      });
      void attempt.then(status => {
        if (!active || suspended || request !== epoch || context && !context.isCurrent()) return;
        publish(status);
      }).catch(() => {
        if (active && !suspended && request === epoch) publish(unavailable());
      }).finally(() => {
        if (request === epoch) pending = false;
      });
    };
    const inspect = () => {
      if (!active || suspended || pending) return;
      if (journalMigrationHold) {
        publish({ status: 'held', reason: 'guest-transfer-pending', writable: false, needsInitialisation: false, legacyDiverged: false }); return;
      }
      const status = readJournalStorageStatus(context);
      if (outcome === 'kept') outcome = null;
      // A passive read cannot tell why a lock request failed. Retain its actual
      // reason until an explicit retry or new evidence supplies another result.
      if (status.reason === 'writer-not-acquired' || status.reason === 'upgrade-required') {
        if (current && ['another-writer', 'web-locks-unavailable', 'lock-unavailable'].includes(current.reason ?? '')) {
          publish({ ...status, reason: current.reason }); return;
        }
      }
      publish(status);
    };
    const reviewAction = (kind: 'download' | 'keep', approval?: { epoch: number; isCurrent: () => boolean }) => {
      if (!active || suspended || pending || !context?.isCurrent() || !legacyReview || outcome === 'superseded') return;
      const proof = legacyReview.review, original = context, epoch = request;
      if (kind === 'download') {
        const exported = exportJournalLegacyReview(proof, original);
        if (!exported) { legacyReview = null; downloaded = false; publish(readJournalStorageStatus(original)); return; }
        let url: string | null = null;
        try {
          url = URL.createObjectURL(new Blob([exported.json], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = exported.filename;
          if (!original.isCurrent()) return;
          anchor.click(); downloaded = true; outcome = null; render(current, false);
        } catch { outcome = 'download-failed'; render(current, false); }
        finally { if (url) { const created = url; setTimeout(() => URL.revokeObjectURL(created), 0); } }
        return;
      }
      if (!downloaded || !approval || approval.epoch !== reviewEpoch || !approval.isCurrent()) return;
      const approvalIsCurrent = () => approval.epoch === reviewEpoch && approval.isCurrent();
      pending = true; render(current, true);
      void Promise.resolve().then(() => keepCurrentJournalAfterLegacyReview(proof, original, undefined, approvalIsCurrent)).then(async result => {
        if (!active || suspended || request !== epoch || !original.isCurrent()) return;
        downloaded = false; legacyReview = null; reviewEpoch = ++reviewSequence.current;
        outcome = result.status;
        if (result.status === 'kept') publish(await initialiseJournalStorage(original));
        else publish(readJournalStorageStatus(original));
      }).catch(() => {
        if (active && !suspended && request === epoch) { outcome = 'held'; publish(readJournalStorageStatus(original)); }
      }).finally(() => { if (request === epoch) pending = false; });
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key && context && ![context.legacyKey, context.canonicalKey, context.receiptKey].includes(event.key)) return;
      inspect();
    };
    const pageHidden = () => {
      if (!active) return;
      suspended = true; ++request; ++lifecycle; pending = false;
      // The resumed document needs a fresh readiness event even if its saved
      // bytes and visible status match the lease that pagehide just revoked.
      current = null;
      releaseAllDocumentJournalLeases();
      changed();
    };
    const pageShown = () => {
      if (!active) return;
      suspended = false;
      run('initialise');
    };
    operation.current = run;
    reviewOperation.current = reviewAction;
    window.addEventListener(JOURNAL_STORAGE_EVENT, inspect);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', inspect);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('pageshow', pageShown);
    if (journalMigrationHold) {
      ++request; context = capture();
      publish({ status: 'held', reason: 'guest-transfer-pending', writable: false, needsInitialisation: false, legacyDiverged: false });
    } else run('initialise');
    return () => {
      active = false; ++request; ++lifecycle; pending = false;
      operation.current = null;
      reviewOperation.current = null;
      window.removeEventListener(JOURNAL_STORAGE_EVENT, inspect);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', inspect);
      window.removeEventListener('pagehide', pageHidden);
      window.removeEventListener('pageshow', pageShown);
      releaseAllDocumentJournalLeases();
      changed();
    };
  }, [owner, loading, sampleEpoch, journalMigrationHold, retryJournalMigration]);
  const retry = useCallback(() => operation.current?.('initialise'), []);
  const recover = useCallback(() => operation.current?.('recover'), []);
  const downloadCopies = useCallback(() => reviewOperation.current?.('download'), []);
  const keepCurrent = useCallback((expectedReviewEpoch: number, isConfirmed: () => boolean) =>
    reviewOperation.current?.('keep', { epoch: expectedReviewEpoch, isCurrent: isConfirmed }), []);
  // Effects run after render. Never expose the preceding account/sample result
  // for that intervening render, even if its asynchronous work is still pending.
  const sameContext = !loading && delivery.owner === owner && delivery.epoch === sampleEpoch
    && (!journalMigrationHold || ['guest-transfer-pending', 'guest-transfer-held'].includes(delivery.status?.reason ?? ''));
  return <StorageContext.Provider value={{ status: sameContext ? delivery.status : null,
    busy: !sameContext || delivery.busy, retry, recover, review: sameContext ? delivery.review : null,
    reviewEpoch: delivery.reviewEpoch, downloaded: sameContext && delivery.downloaded, outcome: sameContext ? delivery.outcome : null,
    downloadCopies, keepCurrent }}>{children}</StorageContext.Provider>;
}

/** Inline in each journal or dated-task screen's scrolling content, never a strip over controls. */
export function JournalStorageNotice() {
  const delivery = useContext(StorageContext);
  const [confirmedEpoch, setConfirmedEpoch] = useState<number | null>(null);
  const liveDelivery = useRef(delivery); liveDelivery.current = delivery;
  const confirmation = useRef<number | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; confirmation.current = null; }; }, []);
  if (delivery?.outcome === 'kept' && delivery.status?.writable && !delivery.busy) return <p role="status" lang="en"
    className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-sm text-[var(--text-primary)]">Your protected journal is kept. The reviewed older copy is retained for later review; no older changes were merged.</p>;
  if (delivery?.status?.status === 'sample' || delivery?.status?.writable && !delivery.busy && delivery.outcome !== 'superseded') return null;
  const status = delivery?.status;
  return <section lang="en" aria-label="Journal storage" aria-live="polite" aria-busy={delivery?.busy ?? true}
    className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h2 className="font-display text-base font-semibold">{delivery?.busy || !status ? 'Checking journal storage' : 'Journal is read-only'}</h2>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">{delivery?.busy || !status ? 'Saved records are being checked before journal editing is enabled.' : journalStorageMessage(status)}</p>
    {status?.legacyDiverged && <details className="mt-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Review the copy conflict</summary>
      <p className="text-[var(--text-secondary)]">The protected journal and the older copy are both retained. Download both copies to compare them before choosing. Automatic merging is unavailable. Close the older app session so it stops changing its copy.</p>
      {delivery?.review && <>
        <p className="mt-2">Protected saved rows: {delivery.review.currentSavedRows ?? 'unknown'}. Older saved rows: {delivery.review.olderSavedRows ?? 'unknown'}.</p>
        <p className="mt-2 text-[var(--text-secondary)]">These counts do not verify notes or linked work. Matching row counts do not mean the observed dates, wording or link references match. The download contains your exact saved copies. This app does not upload them; keep the file private.</p>
        <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.downloadCopies}
          className="mt-2 min-h-11 rounded-xl border border-[var(--border)] px-4 py-2">Download both copies</button>
        <label className="mt-3 flex min-h-11 items-start gap-2 py-2">
          <input type="checkbox" className="mt-1" disabled={!delivery.downloaded || delivery.busy || delivery.outcome === 'superseded'}
            checked={delivery.downloaded && confirmedEpoch === delivery.reviewEpoch}
            onChange={event => { confirmation.current = event.target.checked ? delivery.reviewEpoch : null;
              setConfirmedEpoch(confirmation.current); }} />
          <span>I compared the copies and choose the protected journal. Keep the older copy for later review.</span>
        </label>
        <button type="button" disabled={!delivery.downloaded || confirmedEpoch !== delivery.reviewEpoch || delivery.busy || delivery.outcome === 'superseded'}
          onClick={() => {
            const expectedEpoch = delivery.reviewEpoch;
            if (!delivery.downloaded || delivery.busy || confirmedEpoch !== expectedEpoch || delivery.outcome === 'superseded') return;
            delivery.keepCurrent(expectedEpoch, () => mounted.current && confirmation.current === expectedEpoch
              && liveDelivery.current?.reviewEpoch === expectedEpoch && liveDelivery.current.downloaded);
          }} className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 disabled:opacity-50">Keep current journal; retain older copy for later review</button>
      </>}
    </details>}
    {delivery?.outcome === 'download-failed' && <p role="alert" className="mt-2 text-sm">The copies could not be downloaded. No choice has been saved.</p>}
    {delivery?.outcome === 'held' && <p role="alert" className="mt-2 text-sm">The choice could not be confirmed. Check the current copies before trying again.</p>}
    {delivery?.outcome === 'superseded' && <p role="alert" className="mt-2 text-sm">A choice may have been saved, but its confirmation changed. Do not repeat it. Reload the app to check the retained copies.</p>}
    {delivery && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.retry}
        className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">Retry journal check</button>
      {status?.reason === 'cutover-recovery-required' && <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.recover}
        className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">Recover interrupted setup</button>}
    </div>}
    {status?.reason === 'cutover-recovery-required' && <p className="mt-2 text-sm text-[var(--text-secondary)]">Recovery only finishes setup from its original preserved snapshot when the protected journal is missing. It will not replace an existing saved journal.</p>}
  </section>;
}
