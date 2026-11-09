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
import { detachJsonData } from '@/lib/lossless-json';
import { loadGrowerOperationsSources, type GrowerOperationsSources } from '@/lib/international/grower-operations-source';
import { buildGrowerBoardTasks, type BoardTask } from '@/lib/task-board';
import { recordGrowerNurserySowing, recordGrowerNurseryProgress, recordGrowerNurseryFieldPlanting, type GrowerNurserySowingInput, type GrowerNurseryProgressInput, type GrowerNurseryFieldPlantingInput, type GrowerFieldObservationResult } from '@/lib/grower-field-observation';
import { projectGrowerCycles } from '@/lib/international/grower-cycle-projection';
import type { GrowerCycleContext, GrowerCycleOriginView } from '@/lib/international/grower-cycle';
import type { GrowerWindowInput } from '@/lib/international/grower-autoplan';
import { resolveGrowerNurseryBatchReference, type GrowerNurseryBatchReferenceChange } from '@/lib/international/grower-nursery';

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
export interface GrowerSavedNurseryReview {
  readonly kind: 'saved-nursery-review';
  readonly source: GrowerWorkflowSource;
  readonly rows: unknown;
  readonly cycleContext: GrowerCycleContext;
  readonly horizon: GrowerWindowInput;
  readonly references: readonly {
    readonly plantingId: string;
    readonly cropKey: string;
    readonly bedId: string;
    readonly startDate: string;
    readonly endDateExclusive: string;
    /** Explicit canonical field-entry event; absent old DTOs cannot grant this action. */
    readonly plannedFieldEntryDate?: string;
    readonly reference: ReturnType<typeof resolveGrowerNurseryBatchReference>;
    /** Recorded accepted intent; `not-recorded` is unknown, never buyer/household. Optional for older DTOs. */
    readonly origin?: GrowerCycleOriginView;
  }[];
}
export type GrowerSavedNurseryReadResult =
  | { readonly status: 'ready'; readonly view: GrowerSavedNurseryReview }
  | { readonly status: 'held'; readonly reason: string };
export interface GrowerNurseryReferenceAcknowledgement { readonly kind: 'nursery-reference-acknowledgement' }
export type GrowerNurseryBatchReferenceSaveResult =
  | { readonly status: 'confirmed'; readonly rows: number; readonly sample: boolean; readonly acknowledgement: GrowerNurseryReferenceAcknowledgement }
  | { readonly status: 'unchanged' }
  | { readonly status: 'held'; readonly reasons: readonly string[] }
  | { readonly status: 'failed' }
  | { readonly status: 'superseded' };
export interface GrowerNurseryReferenceCommit {
  readonly originalRows: unknown;
  readonly originalContext: GrowerCycleContext;
  readonly source: GrowerWorkflowSource;
  readonly expectedBookToken: string;
  readonly changes: readonly GrowerNurseryBatchReferenceChange[];
  /** Remains checkable after the intended book write revokes its old token. */
  readonly sourceIsCurrent: () => boolean;
  /** This only revokes an old intent. The parent still owns the storage gate. */
  readonly isCurrent: () => boolean;
}
export type GrowerNurseryReferenceCommitResult =
  | { readonly status: 'confirmed'; readonly rows: number; readonly sample: boolean;
      /** The exact admitted readback/base, not an elapsed time or rerender. */
      readonly readbackIsCurrent: () => boolean }
  | Exclude<GrowerNurseryBatchReferenceSaveResult, { status: 'confirmed' }>;
interface Inputs {
  selection: { kind: GrowerWorkflowSourceKind; sourceId: string } | null;
  scope: GrowerPlanningScope | null;
  resourceSiteId: string | null;
  book: CropPlanState | null;
  /** Parent checks both mounted ownership and the actual authentication singleton. */
  actorIsCurrent: () => boolean;
  readCurrentBook: () => GrowerWorkflowBookReceipt;
  commitAcceptance?: (request: GrowerWorkflowAcceptanceCommit) => GrowerWorkflowAcceptanceResult;
  commitNurseryReferences?: (request: GrowerNurseryReferenceCommit) => GrowerNurseryReferenceCommitResult;
  createPlantingId?: () => string;
}
const hold = (issue: string): GrowerWorkflowReview => ({ status: 'held', issues: [issue], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] });
const PENDING_BOOK_ISSUE = 'The saved plan changed or has unresolved edits. Reopen its current records before reviewing.';
const planningKey = (book: CropPlanState | null) => JSON.stringify([book?.plantings, book?.growerPlanningProfiles, book?.harvestTargets]);
const savedNurseryKey = (value: unknown): string | null => {
  try { return JSON.stringify(detachJsonData(value, { allowUndefinedObjectFields: true })); }
  catch { return null; }
};
function savedNurseryView(source: GrowerWorkflowSource, book: CropPlanState, recordedAt: string): GrowerSavedNurseryReview {
  const rows = detachJsonData(book.plantings, { allowUndefinedObjectFields: true });
  const cycleContext: GrowerCycleContext = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const projection = projectGrowerCycles(rows, cycleContext);
  const references: GrowerSavedNurseryReview['references'] = projection.ownCycles.flatMap(cycle => {
    if (!cycle.nurseryDemand) return [];
    const entries = cycle.plannedEvents.filter(event => event.kind === 'field-entry');
    return [{ plantingId: cycle.plantingId, cropKey: cycle.cropKey, bedId: cycle.bedId,
      startDate: cycle.nurseryDemand.interval.start, endDateExclusive: cycle.nurseryDemand.interval.endExclusive,
      ...(entries.length === 1 ? { plannedFieldEntryDate: entries[0].date } : {}),
      reference: resolveGrowerNurseryBatchReference(rows, cycleContext, cycle.plantingId), origin: cycle.origin,
    }];
  });
  const starts = references.map(row => row.startDate).sort(), ends = references.map(row => row.endDateExclusive).sort();
  // These are the represented saved intervals, not a new calendar or a claim
  // that anything was sown. Empty/zero-length work cannot invent a review day.
  const horizon: GrowerWindowInput = starts.length && starts[0] < ends[ends.length - 1]
    ? { state: 'provided', value: { start: starts[0], endExclusive: ends[ends.length - 1] }, unit: 'utc-date-window',
        provenance: { kind: 'grower-record', recordedAt, reference: 'Coverage of saved planned nursery intervals; not observed sowing dates.' } }
    : { state: 'missing', reason: 'not-entered' };
  return detachJsonData({ kind: 'saved-nursery-review', source, rows, cycleContext, horizon, references },
    { allowUndefinedObjectFields: true }) as GrowerSavedNurseryReview;
}
interface SavedNurseryBinding {
  readonly key: string;
  readonly rows: unknown;
  readonly context: GrowerCycleContext;
  readonly source: GrowerWorkflowSource;
  readonly sourceKey: string;
  readonly token: string;
  readonly epoch: number;
  readonly selectionKey: string;
  readonly actorIsCurrent: () => boolean;
  readonly bookIsCurrent: () => boolean;
  readonly sourceIsCurrent: () => boolean;
}
interface NurseryReferenceAcknowledgementBinding {
  readonly selectionKey: string;
  readonly actorIsCurrent: () => boolean;
  readonly sourceIsCurrent: () => boolean;
  readonly readbackIsCurrent: () => boolean;
  consumed: boolean;
}

/** Ephemeral review coordinator. No read token becomes write authority here. */
export function useGrowerWorkflow(input: Inputs) {
  const live = useRef(input); live.current = input;
  const epoch = useRef(0), sourceEpoch = useRef(0), mounted = useRef(false);
  const [source, setSource] = useState<GrowerWorkflowSource | null>(null);
  const sourceRef = useRef(source);
  const sourceContext = useRef<{ actorIsCurrent: () => boolean; selectionKey: string } | null>(null);
  const [sourceIssue, setSourceIssue] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bookEvent, setBookEvent] = useState(0);
  const [acceptance, setAcceptance] = useState<GrowerWorkflowAcceptanceState>({ status: 'idle' });
  const [savedNursery, setSavedNursery] = useState<GrowerSavedNurseryReview | null>(null);
  const [savedNurseryChecking, setSavedNurseryChecking] = useState(false);
  const savedNurseryBindings = useRef(new WeakMap<object, SavedNurseryBinding>());
  const nurseryAcknowledgements = useRef(new WeakMap<object, NurseryReferenceAcknowledgementBinding>());
  const nurseryReading = useRef(false), nurserySaving = useRef(false);
  const recordedNurseryIntents = useRef(new WeakSet<() => boolean>());
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
    sourceEpoch.current++;
    setSavedNursery(null); setSavedNurseryChecking(false);
    epoch.current++; sourceContext.current = null; sourceRef.current = null; setSource(null); setSourceIssue(message); setChecking(false); setRevision(value => value + 1);
  }
  useEffect(() => { invalidateSource(null); setAcceptance({ status: 'idle' }); }, [selectionKey]);
  useEffect(() => { epoch.current++; setChecking(false); setSavedNursery(null); setRevision(value => value + 1); }, [bookKey]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; sourceEpoch.current++; sourceContext.current = null; sourceRef.current = null; }; }, []);
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
    if (!bookEvent) return;
    if (live.current.readCurrentBook().status === 'held') {
      setSourceIssue(previous => previous ?? PENDING_BOOK_ISSUE);
      setAcceptance(previous => previous.status === 'confirmed' ? { status: 'idle' } : previous);
      setRevision(value => value + 1);
    } else {
      // Ordinary edits are held during the debounce after an earlier save. Its
      // eventual receipt resolves that book warning, never an independent source issue.
      setSourceIssue(previous => previous === PENDING_BOOK_ISSUE ? null : previous);
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
    sourceEpoch.current++;
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
    const reviewIsCurrent = () => {
      try { return mounted.current && epoch.current === turn && sourceRef.current === expected
        && selectionRef.current === reviewedSelection && actorIsCurrent() && live.current.actorIsCurrent(); }
      catch { return false; }
    };
    if (!expected || !reviewIsCurrent()) return hold('current-source-required');
    let detachedDraft: GrowerWorkflowDraft;
    try {
      // The actual form omits optional branches and authors string fields.
      // JSON copying would invoke getters and erase present-undefined weight
      // evidence before the domain can reject an ambiguous legacy/new entry.
      detachedDraft = detachJsonData(draft) as GrowerWorkflowDraft;
    } catch { return reviewIsCurrent() ? hold('unreadable-workflow-input') : hold('context-changed'); }
    if (!reviewIsCurrent()) return hold('context-changed');
    // A held review cannot replace the warning from an already completed write.
    // Keep it until both the saved book and source have passed the fresh checks.
    setAcceptance(previous => previous.status === 'superseded' ? previous : { status: 'idle' });
    const before = live.current.readCurrentBook(); if (before.status === 'held') return hold(before.reason);
    const checked = await readSource(), fresh = checked?.source;
    if (epoch.current !== turn || selectionRef.current !== reviewedSelection || !actorIsCurrent() || !live.current.actorIsCurrent()) return hold('context-changed');
    if (!fresh || fresh.sourceKey !== expected.sourceKey || fresh.sourceRevision !== expected.sourceRevision) {
      invalidateSource('The saved design changed. Check it again before reviewing.'); return hold('source-changed');
    }
    const after = live.current.readCurrentBook();
    if (after.status === 'held') return hold(after.reason);
    if (after.token !== before.token) return hold('saved-plan-changed');
    setAcceptance({ status: 'idle' });
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
  function savedBindingIsCurrent(view: GrowerSavedNurseryReview, binding = savedNurseryBindings.current.get(view)): boolean {
    try {
      return mounted.current && !!binding && epoch.current === binding.epoch
        && binding.selectionKey === selectionRef.current && binding.actorIsCurrent() && live.current.actorIsCurrent()
        && binding.bookIsCurrent() && binding.sourceIsCurrent() && savedNurseryKey(view) === binding.key;
    } catch { return false; }
  }
  // A book/source change can follow the last awaited read before file handoff.
  // Revoke only the original private binding; this never replaces fresh reads.
  function onCheckSavedNurseryBindingCurrent(view: GrowerSavedNurseryReview): boolean {
    return savedBindingIsCurrent(view);
  }
  async function onReadSavedNursery(acknowledgement?: GrowerNurseryReferenceAcknowledgement): Promise<GrowerSavedNurseryReadResult> {
    const held = (reason: string): GrowerSavedNurseryReadResult => ({ status: 'held', reason });
    const acknowledgementBinding = acknowledgement ? nurseryAcknowledgements.current.get(acknowledgement) : null;
    const acknowledgementIsCurrent = () => {
      try { return !acknowledgement || !!acknowledgementBinding && !acknowledgementBinding.consumed
        && acknowledgementBinding.selectionKey === selectionRef.current && acknowledgementBinding.actorIsCurrent()
        && acknowledgementBinding.sourceIsCurrent() && acknowledgementBinding.readbackIsCurrent(); }
      catch { return false; }
    };
    if (nurseryReading.current || nurserySaving.current) return held('nursery-operation-in-progress');
    if (!mounted.current || !live.current.actorIsCurrent() || !acknowledgementIsCurrent()) return held('context-changed');
    const initial = live.current, actorIsCurrent = initial.actorIsCurrent, selection = selectionRef.current;
    const before = initial.readCurrentBook();
    if (before.status !== 'ready') return held(before.reason);
    if (!before.isCurrent?.()) return held('pending-plan-edits');
    const turn = ++epoch.current;
    nurseryReading.current = true; setSavedNurseryChecking(true); setSavedNursery(null); setChecking(false);
    try {
      const checked = await readSource();
      if (!checked || !mounted.current || epoch.current !== turn || selectionRef.current !== selection
        || !actorIsCurrent() || !live.current.actorIsCurrent() || !before.isCurrent?.() || !acknowledgementIsCurrent()) return held('context-changed');
      const after = live.current.readCurrentBook();
      if (after.status !== 'ready') return held(after.reason);
      if (after.token !== before.token || !after.isCurrent?.() || !checked.isCurrent()) return held('saved-plan-changed');
      const view = savedNurseryView(checked.source, after.book, new Date().toISOString()), key = savedNurseryKey(view);
      const sourceKey = savedNurseryKey(checked.source);
      if (!key || !sourceKey || !before.isCurrent?.() || !after.isCurrent?.() || !acknowledgementIsCurrent()) return held('context-changed');
      const sourceTurn = sourceEpoch.current;
      savedNurseryBindings.current.set(view, { key,
        rows: detachJsonData(view.rows, { allowUndefinedObjectFields: true }),
        context: detachJsonData(view.cycleContext, { allowUndefinedObjectFields: true }) as GrowerCycleContext,
        source: detachJsonData(checked.source, { allowUndefinedObjectFields: true }) as GrowerWorkflowSource,
        sourceKey, token: after.token, epoch: turn, selectionKey: selection, actorIsCurrent,
        bookIsCurrent: () => before.isCurrent?.() === true && after.isCurrent?.() === true,
        sourceIsCurrent: () => mounted.current && sourceEpoch.current === sourceTurn && checked.isCurrent() });
      if (!savedBindingIsCurrent(view)) return held('context-changed');
      if (acknowledgementBinding) acknowledgementBinding.consumed = true;
      sourceContext.current = { actorIsCurrent, selectionKey: selection };
      sourceRef.current = checked.source; setSource(checked.source); setSourceIssue(null);
      setSavedNursery(view);
      return { status: 'ready', view };
    } catch { return held('saved-nursery-review-failed'); }
    finally { nurseryReading.current = false; if (mounted.current) setSavedNurseryChecking(false); }
  }
  async function onCheckSavedNurseryCurrent(view: GrowerSavedNurseryReview): Promise<boolean> {
    const binding = savedNurseryBindings.current.get(view);
    if (!binding || !savedBindingIsCurrent(view, binding)) return false;
    const before = live.current.readCurrentBook();
    if (before.status !== 'ready' || before.token !== binding.token || !before.isCurrent?.()) return false;
    const checked = await readSource();
    if (!checked || !checked.isCurrent() || savedNurseryKey(checked.source) !== binding.sourceKey
      || !savedBindingIsCurrent(view, binding)) return false;
    const after = live.current.readCurrentBook();
    return after.status === 'ready' && after.token === binding.token && after.isCurrent?.() === true
      && before.isCurrent?.() === true && savedBindingIsCurrent(view, binding);
  }
  async function onSaveNurseryBatchReferences(view: GrowerSavedNurseryReview, changes: readonly GrowerNurseryBatchReferenceChange[],
    displayedIsCurrent: () => boolean = () => true): Promise<GrowerNurseryBatchReferenceSaveResult> {
    const held = (...reasons: string[]): GrowerNurseryBatchReferenceSaveResult => ({ status: 'held', reasons });
    const binding = savedNurseryBindings.current.get(view), initial = live.current;
    const originalIsCurrent = () => {
      try { return !!binding && savedBindingIsCurrent(view, binding) && displayedIsCurrent(); }
      catch { return false; }
    };
    if (nurseryReading.current || nurserySaving.current) return held('nursery-operation-in-progress');
    if (!binding || !initial.commitNurseryReferences || !originalIsCurrent()) return held('saved-nursery-binding-changed');
    let detachedChanges: readonly GrowerNurseryBatchReferenceChange[];
    try { detachedChanges = detachJsonData(changes) as readonly GrowerNurseryBatchReferenceChange[]; }
    catch { return held('reference-change-unreadable'); }
    nurserySaving.current = true;
    try {
      const before = initial.readCurrentBook();
      if (before.status !== 'ready') return held(before.reason);
      if (before.token !== binding.token || !before.isCurrent?.()) return held('saved-plan-changed');
      const checked = await readSource();
      if (!checked || savedNurseryKey(checked.source) !== binding.sourceKey || !originalIsCurrent()) return held('source-changed');
      const after = live.current.readCurrentBook();
      if (after.status !== 'ready') return held(after.reason);
      const isCurrent = () => originalIsCurrent() && checked.isCurrent()
        && before.isCurrent?.() === true && after.isCurrent?.() === true;
      if (after.token !== binding.token || !isCurrent()) return held('saved-plan-changed');
      const sourceIsCurrent = () => mounted.current && binding.selectionKey === selectionRef.current
        && binding.actorIsCurrent() && live.current.actorIsCurrent() && binding.sourceIsCurrent() && checked.isCurrent();
      const result = initial.commitNurseryReferences({ originalRows: binding.rows, originalContext: binding.context,
        source: checked.source, expectedBookToken: after.token, changes: detachedChanges, isCurrent, sourceIsCurrent });
      if (result.status !== 'confirmed') return result;
      // Own writes revoke the original book. The next read needs the parent's
      // exact new receipt/base, so a later actor or unrelated write cannot use
      // a mere rerender as confirmation of this intent.
      savedNurseryBindings.current.delete(view); setSavedNursery(null);
      const acknowledgement: GrowerNurseryReferenceAcknowledgement = Object.freeze({ kind: 'nursery-reference-acknowledgement' });
      nurseryAcknowledgements.current.set(acknowledgement, { consumed: false, selectionKey: binding.selectionKey,
        actorIsCurrent: binding.actorIsCurrent, sourceIsCurrent, readbackIsCurrent: result.readbackIsCurrent });
      return { status: 'confirmed', rows: result.rows, sample: result.sample, acknowledgement };
    } catch { return held('reference-save-check-failed'); }
    finally { nurserySaving.current = false; }
  }
  function onRecordNurserySowing(view: GrowerSavedNurseryReview, plantingId: string,
    input: GrowerNurserySowingInput, displayedIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    return recordSavedNurseryObservation(view, plantingId, input, displayedIsCurrent, recordGrowerNurserySowing, 'sowing');
  }
  function onRecordNurseryProgress(view: GrowerSavedNurseryReview, plantingId: string,
    input: GrowerNurseryProgressInput, displayedIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    return recordSavedNurseryObservation(view, plantingId, input, displayedIsCurrent, recordGrowerNurseryProgress, 'a count');
  }
  function onRecordNurseryFieldPlanting(view: GrowerSavedNurseryReview, plantingId: string,
    input: GrowerNurseryFieldPlantingInput, displayedIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    return recordSavedNurseryObservation(view, plantingId, input, displayedIsCurrent, recordGrowerNurseryFieldPlanting, 'field planting', 'field-entry');
  }
  async function recordSavedNurseryObservation<T>(view: GrowerSavedNurseryReview, plantingId: string,
    input: T, displayedIsCurrent: () => boolean,
    recordObservation: (source: GrowerOperationsSources, task: BoardTask, input: T, options: { isCurrent: () => boolean }) => Promise<GrowerFieldObservationResult>,
    description: 'sowing' | 'a count' | 'field planting', eventKind: 'nursery-start' | 'field-entry' = 'nursery-start'): Promise<GrowerFieldObservationResult> {
    const held = (): GrowerFieldObservationResult => ({ status: 'held',
      message: `The saved nursery batch or form changed. Check its current records before recording ${description}.` });
    const binding = savedNurseryBindings.current.get(view);
    const originalIsCurrent = () => {
      try { return !!binding && savedBindingIsCurrent(view, binding) && displayedIsCurrent()
        && !recordedNurseryIntents.current.has(displayedIsCurrent); }
      catch { return false; }
    };
    if (nurseryReading.current || nurserySaving.current || !binding || !originalIsCurrent()) return held();
    const targets = view.references.filter(row => row.plantingId === plantingId);
    if (targets.length !== 1 || targets[0].reference.status !== 'ready') return held();
    const plannedDate = eventKind === 'field-entry' ? targets[0].plannedFieldEntryDate : targets[0].startDate;
    if (typeof plannedDate !== 'string') return held();
    let snapshot: T;
    try { snapshot = detachJsonData(input) as T; } catch { return held(); }
    nurserySaving.current = true;
    try {
      const before = live.current.readCurrentBook();
      if (before.status !== 'ready' || before.token !== binding.token || !before.isCurrent?.()) return held();
      const isCurrent = () => originalIsCurrent() && before.isCurrent?.() === true;
      const operations = await loadGrowerOperationsSources({ isCurrent });
      if (operations.status !== 'ready' || !isCurrent()) return held();
      const after = live.current.readCurrentBook();
      if (after.status !== 'ready' || after.token !== binding.token || !after.isCurrent?.()) return held();
      const current = () => isCurrent() && after.isCurrent?.() === true;
      const matches = buildGrowerBoardTasks(operations.book.plantings, operations.contexts, new Date(), new Set()).tasks
        .filter(task => task.growerEventKind === eventKind && task.growerJournalLink?.plantingId === plantingId
          && task.bedId === targets[0].bedId && task.dueDate === plannedDate
          && growerPlanningScopeKey(task.growerJournalLink.scope) === growerPlanningScopeKey(binding.context.scope));
      if (matches.length !== 1 || !current()) return held();
      const result = await recordObservation(operations, matches[0], snapshot, { isCurrent: current });
      // A completed or uncertain append consumes this form, not the saved batch.
      // A deliberate new observation needs a new blank, explicitly confirmed intent.
      if (result.status !== 'held') recordedNurseryIntents.current.add(displayedIsCurrent);
      return result;
    } catch { return held(); }
    finally { nurserySaving.current = false; }
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
  const visibleSavedNursery = savedNursery && savedBindingIsCurrent(savedNursery) ? savedNursery : null;
  return { source: visibleSource, sourceIssue, checking, contextRevision: revision, onRefresh, onReview, onCheckCurrent, onAccept, acceptance: visibleAcceptance,
    savedNurseryReview: visibleSavedNursery, savedNurseryChecking, onReadSavedNursery, onCheckSavedNurseryCurrent, onCheckSavedNurseryBindingCurrent, onSaveNurseryBatchReferences, onRecordNurserySowing, onRecordNurseryProgress, onRecordNurseryFieldPlanting };
}
