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
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '@/lib/international/grower-workflow';

export type GrowerWorkflowBookReceipt =
  | { status: 'ready'; book: CropPlanState; token: string }
  | { status: 'held'; reason: 'pending-plan-edits' | 'saved-plan-changed' | 'context-changed' };
interface Inputs {
  selection: { kind: GrowerWorkflowSourceKind; sourceId: string } | null;
  scope: GrowerPlanningScope | null;
  resourceSiteId: string | null;
  book: CropPlanState | null;
  /** Parent checks both mounted ownership and the actual authentication singleton. */
  actorIsCurrent: () => boolean;
  readCurrentBook: () => GrowerWorkflowBookReceipt;
}
const hold = (issue: string): GrowerWorkflowReview => ({ status: 'held', issues: [issue], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] });
const planningKey = (book: CropPlanState | null) => JSON.stringify([book?.plantings, book?.growerPlanningProfiles, book?.harvestTargets]);

/** Ephemeral review coordinator. No read token becomes write authority here. */
export function useGrowerWorkflow(input: Inputs) {
  const live = useRef(input); live.current = input;
  const epoch = useRef(0);
  const [source, setSource] = useState<GrowerWorkflowSource | null>(null);
  const sourceRef = useRef(source); sourceRef.current = source;
  const [sourceIssue, setSourceIssue] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bookEvent, setBookEvent] = useState(0);
  const selectionKey = JSON.stringify([input.selection, growerPlanningScopeKey(input.scope), input.resourceSiteId]);
  const selectionRef = useRef(selectionKey); selectionRef.current = selectionKey;
  const bookKey = planningKey(input.book);
  const bindings = useRef(new WeakMap<object, { draft: GrowerWorkflowDraft; source: GrowerWorkflowSource; recordedAt: string }>());

  function invalidateSource(message: string | null) {
    epoch.current++; sourceRef.current = null; setSource(null); setSourceIssue(message); setChecking(false); setRevision(value => value + 1);
  }
  useEffect(() => { invalidateSource(null); }, [selectionKey]);
  useEffect(() => { epoch.current++; setChecking(false); setRevision(value => value + 1); }, [bookKey]);
  useEffect(() => () => { epoch.current++; sourceRef.current = null; }, []);
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
      setRevision(value => value + 1);
    }
  }, [bookEvent, bookKey]);

  async function readSource(): Promise<GrowerWorkflowSource | null> {
    const initial = live.current, selected = initial.selection, key = selectionRef.current;
    if (!selected || !initial.actorIsCurrent()) return null;
    let raw: unknown, rawRevision: string;
    let reread: (() => ReturnType<typeof readFacilitatorSourceReceipt>) | null = null;
    if (selected.kind === 'facilitator-cloud') {
      const rows = await myDesigns();
      if (!initial.actorIsCurrent() || selectionRef.current !== key) return null;
      const matches = rows.filter(row => row.id === selected.sourceId);
      if (matches.length !== 1) return null;
      raw = matches[0]; rawRevision = JSON.stringify(raw);
    } else {
      reread = selected.kind === 'studio-canvas' ? () => readCanvasSourceReceipt(selected.sourceId) : readFacilitatorSourceReceipt;
      const receipt = reread(); if (receipt.status !== 'ready') return null;
      raw = receipt.raw; rawRevision = receipt.revision;
    }
    const result = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ ...selected, raw, sourceRevision: rawRevision }));
    if (result.status !== 'ready' || !initial.actorIsCurrent() || !live.current.actorIsCurrent()
      || selectionRef.current !== key || growerPlanningScopeKey(result.scope) !== growerPlanningScopeKey(live.current.scope)
      || result.resourceSiteId !== live.current.resourceSiteId) return null;
    if (reread) { const after = reread(); if (after.status !== 'ready' || after.revision !== rawRevision) return null; }
    return result;
  }
  async function onRefresh() {
    const turn = ++epoch.current;
    setChecking(true); sourceRef.current = null; setSource(null); setSourceIssue(null); setRevision(value => value + 1);
    try {
      const fresh = await readSource();
      if (epoch.current !== turn) return;
      sourceRef.current = fresh; setSource(fresh);
      if (!fresh) setSourceIssue('This source could not be checked, or its saved measurements need review. Reopen the design before continuing.');
    } catch { if (epoch.current === turn) setSourceIssue('Could not read this saved design. No local crop assumptions have been substituted.'); }
    finally { if (epoch.current === turn) setChecking(false); }
  }
  async function onReview(draft: GrowerWorkflowDraft): Promise<GrowerWorkflowReview> {
    const turn = epoch.current, expected = sourceRef.current;
    if (!expected || !live.current.actorIsCurrent()) return hold('current-source-required');
    const before = live.current.readCurrentBook(); if (before.status === 'held') return hold(before.reason);
    const detachedDraft = JSON.parse(JSON.stringify(draft)) as GrowerWorkflowDraft;
    const fresh = await readSource();
    if (epoch.current !== turn || !live.current.actorIsCurrent()) return hold('context-changed');
    if (!fresh || fresh.sourceKey !== expected.sourceKey || fresh.sourceRevision !== expected.sourceRevision) {
      invalidateSource('The saved design changed. Check it again before reviewing.'); return hold('source-changed');
    }
    const after = live.current.readCurrentBook();
    if (after.status === 'held') return hold(after.reason);
    if (after.token !== before.token) return hold('saved-plan-changed');
    const recordedAt = new Date().toISOString();
    const review = assembleGrowerWorkflowReview({ scope: live.current.scope, source: fresh, book: after.book, draft: detachedDraft, recordedAt });
    if (review.status === 'review') bindings.current.set(review, { draft: detachedDraft, source: fresh, recordedAt });
    return review;
  }
  async function onCheckCurrent(review: Extract<GrowerWorkflowReview, { status: 'review' }>): Promise<boolean> {
    const binding = bindings.current.get(review), turn = epoch.current;
    if (!binding || !live.current.actorIsCurrent()) return false;
    const before = live.current.readCurrentBook(); if (before.status !== 'ready') return false;
    const fresh = await readSource();
    if (epoch.current !== turn || !live.current.actorIsCurrent() || !fresh
      || fresh.sourceKey !== binding.source.sourceKey || fresh.sourceRevision !== binding.source.sourceRevision) return false;
    const after = live.current.readCurrentBook(); if (after.status !== 'ready' || before.token !== after.token) return false;
    const current = assembleGrowerWorkflowReview({ scope: live.current.scope, source: fresh, book: after.book,
      draft: binding.draft, recordedAt: binding.recordedAt });
    return current.status === 'review' && current.proposal.fingerprint === review.proposal.fingerprint
      && JSON.stringify(current.request) === JSON.stringify(review.request)
      && JSON.stringify(current.blockedBeds) === JSON.stringify(review.blockedBeds)
      && JSON.stringify(current.existingOwnCycles) === JSON.stringify(review.existingOwnCycles);
  }
  return { source, sourceIssue, checking, contextRevision: revision, onRefresh, onReview, onCheckCurrent };
}
