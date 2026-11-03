'use client';

import { useEffect, useRef, useState } from 'react';
import type { CropPlanState } from '@/lib/crop-plan';
import { CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { readCanvasSourceReceipt, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { readFacilitatorSourceReceipt } from '@/lib/facilitator-design';
import { myDesigns } from '@/lib/db/queries';
import {
  inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource,
  type GrowerWorkflowSource, type GrowerWorkflowSourceKind,
} from '@/lib/international/grower-workflow-source';
import { growerPlanningScopeKey, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview, type PrepareGrowerWorkflowAcceptanceInput } from '@/lib/international/grower-workflow';

export type GrowerWorkflowBookReceipt =
  | { status: 'ready'; book: CropPlanState; token: string; isCurrent?: () => boolean }
  | { status: 'held'; reason: 'pending-plan-edits' | 'saved-plan-changed' | 'context-changed' };
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
export type GrowerWorkflowAcceptanceResult =
  | { readonly status: 'confirmed'; readonly rows: number; readonly sample: boolean }
  | { readonly status: 'held'; readonly reasons: readonly string[] }
  | { readonly status: 'failed' }
  | { readonly status: 'superseded' };
export type GrowerWorkflowAcceptanceState = { readonly status: 'idle' | 'saving' } | GrowerWorkflowAcceptanceResult;
export interface GrowerWorkflowAcceptanceCommit {
  readonly review: Review;
  readonly binding: PrepareGrowerWorkflowAcceptanceInput['binding'];
  readonly source: GrowerWorkflowSource;
  readonly expectedBookToken: string;
  readonly acceptedAt: string;
  readonly plantingIds: PrepareGrowerWorkflowAcceptanceInput['plantingIds'];
  /** Revocation only: the parent still checks its own actor, admission and book. */
  readonly isCurrent: () => boolean;
}
interface Inputs {
  selection: { kind: GrowerWorkflowSourceKind; sourceId: string } | null;
  scope: GrowerPlanningScope | null;
  resourceSiteId: string | null;
  book: CropPlanState | null;
  /** Parent checks both mounted ownership and the actual authentication singleton. */
  actorIsCurrent: () => boolean;
  readCurrentBook: () => GrowerWorkflowBookReceipt;
  commitAcceptance?: (request: GrowerWorkflowAcceptanceCommit) => GrowerWorkflowAcceptanceResult;
  createPlantingId?: () => string;
}
const hold = (issue: string): GrowerWorkflowReview => ({ status: 'held', issues: [issue], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] });
const planningKey = (book: CropPlanState | null) => JSON.stringify([book?.plantings, book?.growerPlanningProfiles, book?.harvestTargets]);

/** Ephemeral review coordinator. No read token becomes write authority here. */
export function useGrowerWorkflow(input: Inputs) {
  const live = useRef(input); live.current = input;
  const epoch = useRef(0), mounted = useRef(false);
  const [source, setSource] = useState<GrowerWorkflowSource | null>(null);
  const sourceRef = useRef(source);
  const sourceContext = useRef<{ actorIsCurrent: () => boolean; selectionKey: string } | null>(null);
  const [sourceIssue, setSourceIssue] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bookEvent, setBookEvent] = useState(0);
  const [acceptance, setAcceptance] = useState<GrowerWorkflowAcceptanceState>({ status: 'idle' });
  const accepting = useRef(false);
  const acceptanceContext = useRef<{ actorIsCurrent: () => boolean; selectionKey: string } | null>(null);
  const selectionKey = JSON.stringify([input.selection, growerPlanningScopeKey(input.scope), input.resourceSiteId]);
  const selectionRef = useRef(selectionKey); selectionRef.current = selectionKey;
  let visibleSource = source;
  try {
    const context = sourceContext.current;
    if (!context || context.selectionKey !== selectionKey || !context.actorIsCurrent() || !input.actorIsCurrent()) visibleSource = null;
  } catch { visibleSource = null; }
  // Keep original check provenance, not the identity of each inline callback.
  // Rendering another account with the same selection cannot disclose its source.
  sourceRef.current = visibleSource;
  const bookKey = planningKey(input.book);
  const bindings = useRef(new WeakMap<object, { draft: GrowerWorkflowDraft; source: GrowerWorkflowSource; recordedAt: string; actorIsCurrent: () => boolean; selectionKey: string }>());

  function invalidateSource(message: string | null) {
    epoch.current++; sourceContext.current = null; sourceRef.current = null; setSource(null); setSourceIssue(message); setChecking(false); setRevision(value => value + 1);
  }
  useEffect(() => { invalidateSource(null); setAcceptance({ status: 'idle' }); }, [selectionKey]);
  useEffect(() => { epoch.current++; setChecking(false); setRevision(value => value + 1); }, [bookKey]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; sourceContext.current = null; sourceRef.current = null; }; }, []);
  useEffect(() => {
    const sourceChanged = () => invalidateSource('The saved source may have changed. Check its current design again.');
    // A local writer dispatches before returning its own receipt. Check the book
    // after React has received the writer's state rather than blessing event bytes.
    const bookChanged = () => { epoch.current++; setChecking(false); setBookEvent(value => value + 1); };
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, sourceChanged);
    window.addEventListener('permamap-places-changed', sourceChanged);
    window.addEventListener('storage', sourceChanged);
    window.addEventListener('focus', sourceChanged);
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, bookChanged);
    return () => {
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, sourceChanged);
      window.removeEventListener('permamap-places-changed', sourceChanged);
      window.removeEventListener('storage', sourceChanged);
      window.removeEventListener('focus', sourceChanged);
      window.removeEventListener(CROP_PLAN_CHANGED_EVENT, bookChanged);
    };
  }, []);
  useEffect(() => {
    if (bookEvent && live.current.readCurrentBook().status === 'held') {
      setSourceIssue('The saved plan changed or has unresolved edits. Reopen its current records before reviewing.');
      setAcceptance(previous => previous.status === 'confirmed' ? { status: 'idle' } : previous);
      setRevision(value => value + 1);
    }
  }, [bookEvent, bookKey]);

  async function readSource(): Promise<{ source: GrowerWorkflowSource; isCurrent: () => boolean } | null> {
    const initial = live.current, selected = initial.selection, key = selectionRef.current, actorIsCurrent = initial.actorIsCurrent;
    if (!selected || !actorIsCurrent()) return null;
    let raw: unknown, rawRevision: string;
    let reread: (() => ReturnType<typeof readFacilitatorSourceReceipt>) | null = null;
    let receiptOwner: string | null = null, receiptSample = false;
    if (selected.kind === 'facilitator-cloud') {
      const rows = await myDesigns();
      if (!actorIsCurrent() || selectionRef.current !== key) return null;
      const matches = rows.filter(row => row.id === selected.sourceId);
      if (matches.length !== 1) return null;
      raw = matches[0]; rawRevision = JSON.stringify(raw);
    } else {
      reread = selected.kind === 'studio-canvas' ? () => readCanvasSourceReceipt(selected.sourceId) : readFacilitatorSourceReceipt;
      const receipt = reread(); if (receipt.status !== 'ready') return null;
      raw = receipt.raw; rawRevision = receipt.revision; receiptOwner = receipt.ownerUid; receiptSample = receipt.sample;
    }
    const result = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ ...selected, raw, sourceRevision: rawRevision }));
    if (result.status !== 'ready' || !actorIsCurrent() || !live.current.actorIsCurrent()
      || selectionRef.current !== key || growerPlanningScopeKey(result.scope) !== growerPlanningScopeKey(live.current.scope)
      || result.resourceSiteId !== live.current.resourceSiteId) return null;
    const isCurrent = () => {
      try {
        if (!actorIsCurrent() || !live.current.actorIsCurrent() || selectionRef.current !== key) return false;
        if (reread) {
          const after = reread();
          return after.status === 'ready' && after.revision === rawRevision && after.ownerUid === receiptOwner && after.sample === receiptSample;
        }
        // A fetched cloud snapshot is not a remote compare-and-swap lock.
        return JSON.stringify(raw) === rawRevision;
      } catch { return false; }
    };
    return isCurrent() ? { source: result, isCurrent } : null;
  }
  async function onRefresh() {
    const turn = ++epoch.current, actorIsCurrent = live.current.actorIsCurrent, checkedSelection = selectionRef.current;
    setAcceptance({ status: 'idle' });
    setChecking(true); sourceContext.current = null; sourceRef.current = null; setSource(null); setSourceIssue(null); setRevision(value => value + 1);
    try {
      const checked = await readSource(), fresh = checked?.source ?? null;
      if (epoch.current !== turn) return;
      sourceContext.current = fresh ? { actorIsCurrent, selectionKey: checkedSelection } : null;
      sourceRef.current = fresh; setSource(fresh);
      if (!fresh) setSourceIssue('This source could not be checked, or its saved measurements need review. Reopen the design before continuing.');
    } catch { if (epoch.current === turn) setSourceIssue('Could not read this saved design. No local crop assumptions have been substituted.'); }
    finally { if (epoch.current === turn) setChecking(false); }
  }
  async function onReview(draft: GrowerWorkflowDraft): Promise<GrowerWorkflowReview> {
    const initial = live.current, turn = epoch.current, expected = sourceRef.current, actorIsCurrent = initial.actorIsCurrent, reviewedSelection = selectionRef.current;
    if (accepting.current) return hold('acceptance-in-progress');
    setAcceptance({ status: 'idle' });
    if (!expected || !live.current.actorIsCurrent()) return hold('current-source-required');
    const before = live.current.readCurrentBook(); if (before.status === 'held') return hold(before.reason);
    const detachedDraft = JSON.parse(JSON.stringify(draft)) as GrowerWorkflowDraft;
    const checked = await readSource(), fresh = checked?.source;
    if (epoch.current !== turn || selectionRef.current !== reviewedSelection || !actorIsCurrent() || !live.current.actorIsCurrent()) return hold('context-changed');
    if (!fresh || fresh.sourceKey !== expected.sourceKey || fresh.sourceRevision !== expected.sourceRevision) {
      invalidateSource('The saved design changed. Check it again before reviewing.'); return hold('source-changed');
    }
    const after = live.current.readCurrentBook();
    if (after.status === 'held') return hold(after.reason);
    if (after.token !== before.token) return hold('saved-plan-changed');
    const recordedAt = new Date().toISOString();
    const review = assembleGrowerWorkflowReview({ scope: live.current.scope, source: fresh, book: after.book, draft: detachedDraft, recordedAt });
    if (review.status === 'review') bindings.current.set(review, { draft: detachedDraft, source: fresh, recordedAt, actorIsCurrent, selectionKey: reviewedSelection });
    return review;
  }
  async function onCheckCurrent(review: Extract<GrowerWorkflowReview, { status: 'review' }>): Promise<boolean> {
    const binding = bindings.current.get(review), turn = epoch.current;
    if (!binding || !binding.actorIsCurrent() || binding.selectionKey !== selectionRef.current || !live.current.actorIsCurrent()) return false;
    const before = live.current.readCurrentBook(); if (before.status !== 'ready') return false;
    const checked = await readSource(), fresh = checked?.source;
    if (epoch.current !== turn || !binding.actorIsCurrent() || !live.current.actorIsCurrent() || !fresh
      || fresh.sourceKey !== binding.source.sourceKey || fresh.sourceRevision !== binding.source.sourceRevision) return false;
    const after = live.current.readCurrentBook(); if (after.status !== 'ready' || before.token !== after.token) return false;
    const current = assembleGrowerWorkflowReview({ scope: live.current.scope, source: fresh, book: after.book,
      draft: binding.draft, recordedAt: binding.recordedAt });
    return current.status === 'review' && current.proposal.fingerprint === review.proposal.fingerprint
      && JSON.stringify(current.request) === JSON.stringify(review.request)
      && JSON.stringify(current.blockedBeds) === JSON.stringify(review.blockedBeds)
      && JSON.stringify(current.existingOwnCycles) === JSON.stringify(review.existingOwnCycles);
  }
  async function onAccept(review: Review, displayedReviewIsCurrent: () => boolean = () => true): Promise<GrowerWorkflowAcceptanceResult> {
    const held = (...reasons: string[]): GrowerWorkflowAcceptanceResult => ({ status: 'held', reasons });
    if (accepting.current) return held('acceptance-in-progress');
    const binding = bindings.current.get(review), initial = live.current, turn = epoch.current;
    const boundCurrent = () => {
      try { return mounted.current && !!binding && binding.selectionKey === selectionRef.current
        && binding.actorIsCurrent() && live.current.actorIsCurrent() && displayedReviewIsCurrent(); }
      catch { return false; }
    };
    if (!binding || !initial.commitAcceptance || !initial.createPlantingId || !boundCurrent()) return held('review-binding-mismatch');
    accepting.current = true; acceptanceContext.current = { actorIsCurrent: binding.actorIsCurrent, selectionKey: binding.selectionKey };
    setAcceptance({ status: 'saving' });
    let result: GrowerWorkflowAcceptanceResult;
    try {
      const before = initial.readCurrentBook();
      if (before.status !== 'ready') result = held(before.reason);
      else if (!before.isCurrent?.()) result = held('pending-plan-edits');
      else {
        const checked = await readSource(), fresh = checked?.source;
        if (epoch.current !== turn || !boundCurrent()) result = held('context-changed');
        else if (!checked || !fresh || fresh.sourceKey !== binding.source.sourceKey || fresh.sourceRevision !== binding.source.sourceRevision) {
          invalidateSource('The saved design changed. Check it again before reviewing.'); result = held('source-changed');
        }
        else {
          const after = live.current.readCurrentBook();
          if (after.status !== 'ready') result = held(after.reason);
          else if (after.token !== before.token) result = held('saved-plan-changed');
          else {
            const plantingIds = review.proposal.cycles.map(cycle => ({ cycleId: cycle.cycleId, plantingId: initial.createPlantingId!() }));
            const isCurrent = () => epoch.current === turn && boundCurrent() && checked.isCurrent()
              && before.isCurrent?.() === true && after.isCurrent?.() === true;
            if (!isCurrent()) result = held('context-changed');
            else result = initial.commitAcceptance({ review,
              binding: { draft: binding.draft, source: binding.source, recordedAt: binding.recordedAt },
              source: fresh, expectedBookToken: after.token, acceptedAt: new Date().toISOString(), plantingIds, isCurrent });
            if (result.status === 'held' && boundCurrent() && !checked.isCurrent()) invalidateSource('The saved design changed. Check it again before reviewing.');
          }
        }
      }
    } catch { result = held('acceptance-check-failed'); }
    finally { accepting.current = false; }
    // Own writes invalidate the old proposal too. Do not turn a real receipt
    // into a retryable hold merely because its book event advanced the epoch.
    if (result.status === 'confirmed' || result.status === 'superseded') bindings.current.delete(review);
    setAcceptance(result); return result;
  }
  let visibleAcceptance: GrowerWorkflowAcceptanceState = acceptance;
  try {
    const context = acceptanceContext.current;
    if (context && (context.selectionKey !== selectionKey || !context.actorIsCurrent() || !input.actorIsCurrent())) visibleAcceptance = { status: 'idle' };
  } catch { visibleAcceptance = { status: 'idle' }; }
  return { source: visibleSource, sourceIssue, checking, contextRevision: revision, onRefresh, onReview, onCheckCurrent, onAccept, acceptance: visibleAcceptance };
}
