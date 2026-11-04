'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import { CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { recordGrowerFieldObservation, type GrowerFieldObservationInput } from '@/lib/grower-field-observation';
import type { BoardTask } from '@/lib/task-board';
import { loadGrowerOperationsSources, isGrowerOperationsCurrent, checkGrowerOperationsCurrent,
  type GrowerOperationsSources } from '@/lib/international/grower-operations-source';

type Loading = { readonly status: 'loading'; readonly book: null; readonly contexts: readonly [];
  readonly heldSources: readonly [] };
const loading = (): Loading => ({ status: 'loading', book: null, contexts: [], heldSources: [] });
const withdrawn = (): GrowerOperationsSources => ({ status: 'held', book: null, contexts: [], heldSources: [{ reason: 'context-changed' }] });

/** Private source receipts stay in their authority's WeakMap. A ready object is
 * withdrawn before rereading so old tasks cannot look current during I/O. */
export function useGrowerOperations() {
  const [result, setResult] = useState<GrowerOperationsSources | Loading>(loading);
  const live = useRef(result); live.current = result;
  const epoch = useRef(0), mounted = useRef(false);
  async function refresh() {
    if (!mounted.current) return;
    const turn = ++epoch.current;
    live.current = loading(); setResult(live.current);
    const next = await loadGrowerOperationsSources({ isCurrent: () => mounted.current && epoch.current === turn });
    if (!mounted.current || epoch.current !== turn) return;
    live.current = next; setResult(next);
  }
  useEffect(() => {
    mounted.current = true;
    const changed = () => { void refresh(); };
    const events = [CROP_PLAN_CHANGED_EVENT, DESIGN_CANVAS_CHANGED_EVENT, 'permamap-places-changed', 'storage', 'focus', SAMPLE_MODE_EVENT];
    events.forEach(event => window.addEventListener(event, changed));
    let unsubscribe: (() => void) | undefined;
    let subscribed = true;
    try {
      const auth = getFirebase()?.auth;
      if (auth) {
        let observed = auth.currentUser?.uid ?? null;
        unsubscribe = onAuthStateChanged(auth, user => {
          const next = user?.uid ?? null; if (next === observed) return;
          observed = next; changed();
        }, () => { epoch.current++; live.current = withdrawn(); setResult(live.current); });
      }
    } catch { subscribed = false; live.current = withdrawn(); setResult(live.current); }
    if (subscribed) void refresh();
    return () => { mounted.current = false; epoch.current++; events.forEach(event => window.removeEventListener(event, changed)); unsubscribe?.(); };
  }, []);
  function isCurrent(): boolean { return mounted.current && live.current.status === 'ready' && isGrowerOperationsCurrent(live.current); }
  async function checkCurrent(): Promise<boolean> {
    const previous = live.current, turn = epoch.current;
    if (!mounted.current || previous.status !== 'ready') return false;
    const valid = await checkGrowerOperationsCurrent(previous, { isCurrent: () => mounted.current && epoch.current === turn && live.current === previous });
    if (!mounted.current || epoch.current !== turn || live.current !== previous) return false;
    if (!valid) { epoch.current++; live.current = withdrawn(); setResult(live.current); }
    return valid;
  }
  const observationSource = result, observationEpoch = epoch.current;
  async function onRecordObservation(task: BoardTask, input: GrowerFieldObservationInput, formIsCurrent: () => boolean) {
    const previous = observationSource, turn = observationEpoch;
    return recordGrowerFieldObservation(previous.status === 'loading' ? withdrawn() : previous, task, input, {
      isCurrent: () => mounted.current && epoch.current === turn && live.current === previous && formIsCurrent(),
    });
  }
  // Parent UI uses this object's identity to withdraw old task actions. An
  // unrelated parent render must not masquerade as a new source snapshot.
  return useMemo(() => ({ ...result, refresh, checkCurrent, isCurrent, onRecordObservation }), [result]);
}
