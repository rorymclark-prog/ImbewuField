'use client';

// Cloud sync for the Design Studio's DesignCanvasState (lib/design-canvas.ts).
//
// SEPARATE path from lib/user-sync.ts's existing design-studio sync: that module owns a
// DIFFERENT local blob (imbewu_design_studio_v1 / DesignStudioState, used by
// GeometryDesignStudio.tsx) under user_map_data/{uid}/data/design. This module owns its
// own doc, data/design_canvas, storing { [siteId]: DesignCanvasState } as a JSON STRING
// (Firestore rejects the nested coordinate arrays in items/zones/lines natively — same
// constraint as farm shapes). Deliberately NOT wired into subscribeUserMapData's reconcile
// so it can't race or entangle with the farm-shape / design-studio reconcile flows.
//
// Firestore rules already cover this: `match /user_map_data/{uid}/data/{doc}` matches ANY
// doc id under data/ for the owning uid, so this new doc needs no rules change.

import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import { applyRemoteCanvasState, loadCanvasState, type DesignCanvasState } from './design-canvas';

const COLL = 'user_map_data';
const DOC = 'design_canvas';

type Store = Record<string, DesignCanvasState>;

const ts = (s: DesignCanvasState) => Date.parse(s.updatedAt) || 0;

function parseStore(json: unknown): Store {
  if (typeof json !== 'string') return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function currentUid(): string | null {
  return getFirebase()?.auth?.currentUser?.uid ?? null;
}

function db() {
  return getFirebase()?.db ?? null;
}

// One-shot reconcile for a single site, called on Design Studio mount/site-change. Merges
// this site's local state with whatever's in the cloud (newest updatedAt wins), writes the
// merged result back to Firestore, and — if the winner differs from what's already in
// localStorage — applies it locally so the page's existing DESIGN_CANVAS_CHANGED_EVENT
// listener reloads it. No-ops (never touches Firestore or clobbers local data) when signed
// out or offline; the localStorage copy keeps working exactly as before.
export async function reconcileDesignCanvas(siteId: string): Promise<DesignCanvasState | null> {
  const uid = currentUid();
  const d = db();
  const local = loadCanvasState(siteId);
  if (!uid || !d) return local;

  const ref = doc(d, COLL, uid, 'data', DOC);
  try {
    let winner: DesignCanvasState | null = local;
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const remoteStore = parseStore(snap.exists() ? snap.data().designCanvasJson : '{}');
      const remoteEntry = remoteStore[siteId] ?? null;

      winner = !local ? remoteEntry : !remoteEntry ? local : ts(local) >= ts(remoteEntry) ? local : remoteEntry;

      // Only ever touch OUR OWN siteId's slot — every other site's entry already in the
      // cloud store is left exactly as-is, so this can never wipe another site's design.
      if (winner) {
        const mergedStore: Store = { ...remoteStore, [siteId]: winner };
        tx.set(ref, { designCanvasJson: JSON.stringify(mergedStore), updatedAt: serverTimestamp() });
      }
    });
    if (winner && winner !== local) applyRemoteCanvasState(winner);
    return winner;
  } catch (e) {
    console.error('[design-canvas-sync] reconcile', e);
    return local;
  }
}

// Fire-and-forget push after a local save (see app/design/page.tsx's persistCanvasState).
// Reads-modifies-writes inside a transaction so a concurrent push from another device can't
// clobber it — the newer of the two (by updatedAt) wins and that's what ends up in the
// cloud, mirroring lib/user-sync.ts's upsertDesignStudio pattern.
export async function pushDesignCanvas(state: DesignCanvasState): Promise<void> {
  const uid = currentUid();
  const d = db();
  if (!uid || !d) return;

  const ref = doc(d, COLL, uid, 'data', DOC);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const remoteStore = parseStore(snap.exists() ? snap.data().designCanvasJson : '{}');
      const remoteEntry = remoteStore[state.siteId] ?? null;
      const winner = remoteEntry && ts(remoteEntry) > ts(state) ? remoteEntry : state;
      const mergedStore: Store = { ...remoteStore, [state.siteId]: winner };
      tx.set(ref, { designCanvasJson: JSON.stringify(mergedStore), updatedAt: serverTimestamp() });
    });
  } catch (e) {
    console.error('[design-canvas-sync] push', e);
  }
}

// Realtime listener while the Design Studio is open — a save from another open tab/device
// lands here and gets applied locally (skipping this device's own pending writes so a push
// doesn't bounce back as a "remote" change). Returns an unsubscribe function (no-op when
// signed out).
export function subscribeDesignCanvasLive(siteId: string): () => void {
  const uid = currentUid();
  const d = db();
  if (!uid || !d) return () => {};

  const ref = doc(d, COLL, uid, 'data', DOC);
  return onSnapshot(
    ref,
    (snap) => {
      // hasPendingWrites only skips this client's OPTIMISTIC local writes; our pushes go through
      // runTransaction (a server round-trip) which may not set that flag — so the real guard
      // against reapplying our own/stale edit is the ts(local) >= ts(remoteEntry) check below.
      // Keep that check; it is load-bearing, not redundant.
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const remoteEntry = parseStore(snap.data().designCanvasJson)[siteId];
      if (!remoteEntry) return;
      const local = loadCanvasState(siteId);
      if (local && ts(local) >= ts(remoteEntry)) return;
      applyRemoteCanvasState(remoteEntry);
    },
    (e) => console.error('[design-canvas-sync] listener', e),
  );
}
