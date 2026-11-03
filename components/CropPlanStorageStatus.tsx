'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import {
  CROP_PLAN_STORAGE_EVENT, initialiseCropPlanStorage, makeBrowserCropPlanStorageContext,
  readCropPlanStorageStatus, recoverCropPlanStorage, releaseAllDocumentCropPlanLeases,
  readCropPlanLegacyReview, exportCropPlanLegacyReview, keepCurrentCropPlanAfterLegacyReview,
  cropPlanLegacyReviewIsCurrent,
  type CropPlanStorageContext, type CropPlanStorageStatus,
} from '@/lib/crop-plan-storage';

// Keep global account setup independent of the crop catalogue and demo farm.
// Existing crop readers already withdraw their admission on this event.
const CROP_PLAN_CHANGED_EVENT = 'imbewu-crop-plan-changed';
const SAMPLE_MODE_EVENT = 'imbewu-sample-mode-changed';
type ReviewSummary = { currentSavedRows: number | null; olderSavedRows: number | null };
type ReviewOutcome = 'download-failed' | 'held' | 'superseded' | 'kept' | null;
type Delivery = { status: CropPlanStorageStatus | null; busy: boolean; retry: () => void; recover: () => void;
  review: ReviewSummary | null; reviewEpoch: number; downloaded: boolean; outcome: ReviewOutcome;
  downloadCopies: () => void; keepCurrent: () => void };
const StorageContext = createContext<Delivery | null>(null);
const signature = (status: CropPlanStorageStatus | null) => status && JSON.stringify([
  status.status, status.reason, status.writable, status.needsInitialisation, status.legacyDiverged,
]);
const unavailable = (): CropPlanStorageStatus => ({ status: 'held', reason: 'storage-unavailable', writable: false,
  needsInitialisation: false, legacyDiverged: false });

/** One document owns the editing lease. Notices only observe this provider;
 * mounting a second screen notice must never compete for another lease. */
export default function CropPlanStorageProvider({ children }: { children: ReactNode }) {
  const { user, loading, cropPlanMigrationHold = null, retryCropPlanMigration } = useAuth();
  const owner = user?.uid ?? null;
  const [sampleEpoch, setSampleEpoch] = useState(0);
  const [delivery, setDelivery] = useState<{ owner: string | null; epoch: number; status: CropPlanStorageStatus | null; busy: boolean;
    review: ReviewSummary | null; reviewEpoch: number; downloaded: boolean; outcome: ReviewOutcome }>(
    { owner, epoch: sampleEpoch, status: null, busy: true, review: null, reviewEpoch: 0, downloaded: false, outcome: null });
  const operation = useRef<((kind: 'initialise' | 'recover') => void) | null>(null);
  const reviewOperation = useRef<((kind: 'download' | 'keep') => void) | null>(null);
  const reviewSequence = useRef(0);
  useEffect(() => {
    const sampleChanged = () => setSampleEpoch(value => value + 1);
    window.addEventListener(SAMPLE_MODE_EVENT, sampleChanged);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, sampleChanged);
  }, []);
  useEffect(() => {
    if (loading) return;
    let active = true, suspended = false, request = 0, lifecycle = 0, pending = false;
    let context: CropPlanStorageContext | null = null;
    let current: CropPlanStorageStatus | null = null;
    let legacyReview: ReturnType<typeof readCropPlanLegacyReview> = null;
    let downloaded = false, reviewEpoch = ++reviewSequence.current;
    let outcome: ReviewOutcome = null;
    const changed = () => window.dispatchEvent(new CustomEvent(CROP_PLAN_CHANGED_EVENT));
    const render = (status: CropPlanStorageStatus | null, busy: boolean) => setDelivery({ owner, epoch: sampleEpoch, status, busy,
      review: legacyReview && { currentSavedRows: legacyReview.currentSavedRows, olderSavedRows: legacyReview.olderSavedRows },
      reviewEpoch, downloaded, outcome });
    const publish = (status: CropPlanStorageStatus, busy = false) => {
      if (!active || suspended) return;
      const different = signature(current) !== signature(status);
      current = status;
      if (status.legacyDiverged && context && context.isCurrent()) {
        if (!legacyReview || !cropPlanLegacyReviewIsCurrent(legacyReview.review, context)) {
          legacyReview = readCropPlanLegacyReview(context); downloaded = false; reviewEpoch = ++reviewSequence.current;
        }
      } else { legacyReview = null; downloaded = false; }
      render(status, busy);
      if (different) changed();
    };
    const capture = () => {
      const captured = makeBrowserCropPlanStorageContext();
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
        if (cropPlanMigrationHold) {
          await retryCropPlanMigration();
          // Auth publishes the cleared barrier before the fresh account effect
          // initializes. Reusing this effect would race that context handover.
          return readCropPlanStorageStatus(context);
        }
        if (context && !context.isCurrent()) return readCropPlanStorageStatus(context);
        if (kind === 'recover' && context) await recoverCropPlanStorage(context);
        if (context && !context.isCurrent()) return readCropPlanStorageStatus(context);
        return initialiseCropPlanStorage(context);
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
      if (cropPlanMigrationHold) {
        publish({ status: 'held', reason: 'guest-transfer-pending', writable: false, needsInitialisation: false, legacyDiverged: false }); return;
      }
      const status = readCropPlanStorageStatus(context);
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
    const reviewAction = (kind: 'download' | 'keep') => {
      if (!active || suspended || pending || !context?.isCurrent() || !legacyReview || outcome === 'superseded') return;
      const proof = legacyReview.review, original = context, epoch = request;
      if (kind === 'download') {
        const exported = exportCropPlanLegacyReview(proof, original);
        if (!exported) { legacyReview = null; downloaded = false; publish(readCropPlanStorageStatus(original)); return; }
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
      if (!downloaded) return;
      pending = true; render(current, true);
      void Promise.resolve().then(() => keepCurrentCropPlanAfterLegacyReview(proof, original)).then(async result => {
        if (!active || suspended || request !== epoch || !original.isCurrent()) return;
        downloaded = false; legacyReview = null; reviewEpoch = ++reviewSequence.current;
        outcome = result.status;
        if (result.status === 'kept') publish(await initialiseCropPlanStorage(original));
        else publish(readCropPlanStorageStatus(original));
      }).catch(() => {
        if (active && !suspended && request === epoch) { outcome = 'held'; publish(readCropPlanStorageStatus(original)); }
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
      releaseAllDocumentCropPlanLeases();
      changed();
    };
    const pageShown = () => {
      if (!active) return;
      suspended = false;
      run('initialise');
    };
    operation.current = run;
    reviewOperation.current = reviewAction;
    window.addEventListener(CROP_PLAN_STORAGE_EVENT, inspect);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', inspect);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('pageshow', pageShown);
    if (cropPlanMigrationHold) {
      ++request; context = capture();
      publish({ status: 'held', reason: 'guest-transfer-pending', writable: false, needsInitialisation: false, legacyDiverged: false });
    } else run('initialise');
    return () => {
      active = false; ++request; ++lifecycle; pending = false;
      operation.current = null;
      reviewOperation.current = null;
      window.removeEventListener(CROP_PLAN_STORAGE_EVENT, inspect);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', inspect);
      window.removeEventListener('pagehide', pageHidden);
      window.removeEventListener('pageshow', pageShown);
      releaseAllDocumentCropPlanLeases();
      changed();
    };
  }, [owner, loading, sampleEpoch, cropPlanMigrationHold, retryCropPlanMigration]);
  const retry = useCallback(() => operation.current?.('initialise'), []);
  const recover = useCallback(() => operation.current?.('recover'), []);
  const downloadCopies = useCallback(() => reviewOperation.current?.('download'), []);
  const keepCurrent = useCallback(() => reviewOperation.current?.('keep'), []);
  // Effects run after render. Never expose the preceding account/sample result
  // for that intervening render, even if its asynchronous work is still pending.
  const sameContext = !loading && delivery.owner === owner && delivery.epoch === sampleEpoch
    && (!cropPlanMigrationHold || ['guest-transfer-pending', 'guest-transfer-held'].includes(delivery.status?.reason ?? ''));
  return <StorageContext.Provider value={{ status: sameContext ? delivery.status : null,
    busy: !sameContext || delivery.busy, retry, recover, review: sameContext ? delivery.review : null,
    reviewEpoch: delivery.reviewEpoch, downloaded: sameContext && delivery.downloaded, outcome: sameContext ? delivery.outcome : null,
    downloadCopies, keepCurrent }}>{children}</StorageContext.Provider>;
}

function explanation(status: CropPlanStorageStatus): string {
  switch (status.reason) {
    case 'another-writer':
    case 'writer-not-acquired': return 'Another tab may be editing this crop plan. Close its editor, then retry here. Saved records remain available to read.';
    case 'web-locks-unavailable': return 'This browser cannot safely enable crop-plan editing. Use a browser that supports protected editing; your saved records have not been replaced.';
    case 'legacy-diverged': return 'An older app session changed its previous copy. Your protected crop plan has been kept, and the two copies need review.';
    case 'guest-transfer-pending':
    case 'guest-transfer-held': return 'Your signed-out crop work is still being preserved. Retry its transfer before starting a different account plan; neither copy has been replaced.';
    case 'cutover-recovery-required': return 'Crop-plan setup is incomplete or its saved copies cannot be verified. Keep both copies; do not clear browser data.';
    case 'legacy-unreadable': return 'The previous crop-plan copy cannot be read safely. It has been kept for recovery instead of being replaced with an empty plan.';
    case 'upgrade-required': return 'The preserved crop plan needs protected storage setup before editing can continue.';
    case 'context-changed':
    case 'book-changed': return 'The account or saved crop plan changed during checking. Retry to check the current records before editing.';
    default: return 'Crop-plan editing is unavailable because protected storage could not be checked. Keep this page and retry; no successful save is claimed.';
  }
}

/** Inline in each crop screen's scrolling content, never a strip over controls. */
export function CropPlanStorageNotice() {
  const delivery = useContext(StorageContext);
  const [confirmedEpoch, setConfirmedEpoch] = useState<number | null>(null);
  if (delivery?.outcome === 'kept' && delivery.status?.writable && !delivery.busy) return <p role="status" lang="en"
    className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-sm text-[var(--text-primary)]">Your protected plan is kept. The reviewed older copy is retained for later review; no older changes were merged.</p>;
  if (delivery?.status?.status === 'sample' || delivery?.status?.writable && !delivery.busy && delivery.outcome !== 'superseded') return null;
  const status = delivery?.status;
  return <section lang="en" aria-label="Crop-plan storage" aria-live="polite" aria-busy={delivery?.busy ?? true}
    className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h2 className="font-display text-base font-semibold">{delivery?.busy || !status ? 'Checking crop-plan storage' : 'Crop plan is read-only'}</h2>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">{delivery?.busy || !status ? 'Saved records are being checked before crop-plan editing is enabled.' : explanation(status)}</p>
    {status?.legacyDiverged && <details className="mt-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Review the copy conflict</summary>
      <p className="text-[var(--text-secondary)]">The protected plan and the older copy are both retained. Download both copies to compare them before choosing. Automatic merging is unavailable. Close the older app session so it stops changing its copy.</p>
      {delivery?.review && <>
        <p className="mt-2">Protected saved rows: {delivery.review.currentSavedRows ?? 'unknown'}. Older saved rows: {delivery.review.olderSavedRows ?? 'unknown'}.</p>
        <p className="mt-2 text-[var(--text-secondary)]">These counts do not verify planting records. Matching row counts do not mean the dates, quantities or settings match. The download contains your exact saved copies. This app does not upload them; keep the file private.</p>
        <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.downloadCopies}
          className="mt-2 min-h-11 rounded-xl border border-[var(--border)] px-4 py-2">Download both copies</button>
        <label className="mt-3 flex min-h-11 items-start gap-2 py-2">
          <input type="checkbox" className="mt-1" disabled={!delivery.downloaded || delivery.busy || delivery.outcome === 'superseded'}
            checked={delivery.downloaded && confirmedEpoch === delivery.reviewEpoch}
            onChange={event => setConfirmedEpoch(event.target.checked ? delivery.reviewEpoch : null)} />
          <span>I compared the copies and choose the protected plan. Keep the older copy for later review.</span>
        </label>
        <button type="button" disabled={!delivery.downloaded || confirmedEpoch !== delivery.reviewEpoch || delivery.busy || delivery.outcome === 'superseded'}
          onClick={delivery.keepCurrent} className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 disabled:opacity-50">Keep current plan; retain older copy for later review</button>
      </>}
    </details>}
    {delivery?.outcome === 'download-failed' && <p role="alert" className="mt-2 text-sm">The copies could not be downloaded. No choice has been saved.</p>}
    {delivery?.outcome === 'held' && <p role="alert" className="mt-2 text-sm">The choice could not be confirmed. Check the current copies before trying again.</p>}
    {delivery?.outcome === 'superseded' && <p role="alert" className="mt-2 text-sm">A choice may have been saved, but its confirmation changed. Do not repeat it. Reload the app to check the retained copies.</p>}
    {delivery && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.retry}
        className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">Retry crop-plan check</button>
      {status?.reason === 'cutover-recovery-required' && <button type="button" disabled={delivery.busy || delivery.outcome === 'superseded'} onClick={delivery.recover}
        className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">Recover interrupted setup</button>}
    </div>}
    {status?.reason === 'cutover-recovery-required' && <p className="mt-2 text-sm text-[var(--text-secondary)]">Recovery only finishes setup from its original preserved snapshot when the protected plan is missing. It will not replace an existing saved plan.</p>}
  </section>;
}
