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
import { isSampleMode } from './sample-mode';
import { activeAccountUid } from './account-local-storage';
import {
  applyRemoteCanvasState,
  contentCountOf,
  loadCanvasState,
  normaliseCanvasState,
  preserveCanvasNavigation,
  revOf,
  type DesignCanvasState,
} from './design-canvas';

const COLL = 'user_map_data';
const DOC = 'design_canvas';

type Store = Record<string, unknown>;

const ts = (s: DesignCanvasState) => Date.parse(s.updatedAt) || 0;

// Shared with the page's auto-persist guard (lib/design-canvas.ts) — the winner rule and the
// "don't push this" rule must answer "is it empty?" identically or one will push what the other
// would have refused.
const contentCount = contentCountOf;

/** Wall-clock last-write-wins is not safe on its own: a device whose localStorage was starved
 *  (quota full → silent save failure) reloads a STALE, near-empty snapshot, then restamps
 *  updatedAt=NOW on the first interaction and pushes — wiping a perfectly good cloud design on
 *  every device. So an EMPTY challenger never beats a populated incumbent on timestamp alone; a
 *  real "delete everything" is vanishingly rare next to this failure mode, and is recoverable by
 *  re-saving from the device that actually holds the design. */
const wouldDestroy = (challenger: DesignCanvasState | null, incumbent: DesignCanvasState | null) =>
  contentCount(challenger) === 0 && contentCount(incumbent) > 0;

/** THE winner rule for two copies of the SAME site's canvas. `mine` (this device's copy) wins an
 *  exact tie, which is what every call site below wants. Used by reconcile, push AND the live
 *  listener so all three can never disagree about who won.
 *
 *  1. Higher `rev` wins. Only saveCanvasState bumps rev, so a device that reloaded a STALE
 *     snapshot re-enters at that snapshot's LOW rev however fresh its updatedAt looks — which is
 *     precisely the case wall-clock last-write-wins got wrong: a starved device restamped
 *     updatedAt=NOW and its zone-less state beat a good cloud copy. wouldDestroy only caught the
 *     FULLY empty version of that; a PARTIAL loss (zones gone, items kept) sailed through.
 *  2. Equal rev → higher updatedAt. Equal revs mean two devices diverged from the same edit
 *     count, i.e. genuinely concurrent work, and last-write-wins is as good an answer as any.
 *  3. wouldDestroy remains the backstop for what rev cannot see (below).
 *
 *  DELIBERATE TRADEOFF: rev is a per-lineage counter, not a vector clock — it cannot tell "ahead
 *  of" from "diverged from". A device that never saw the cloud copy can legitimately hold a HIGH
 *  local rev against a LOW remote rev (20 offline edits vs 3 online ones) and will win here even
 *  if the remote is the richer design — much as it would have won on wall-clock by editing last.
 *  We accept that because (a) the failure rev DOES fix is the one seen in the field, and (b) the
 *  loser is never silently destroyed: the cloud keeps the winner, the other device still holds
 *  its own copy in its own localStorage, and one save from that device puts it back. What we
 *  refuse to accept is content vanishing with no copy left anywhere — hence the backstop.
 *
 *  Exported because the OPEN PAGE is a fourth party to this race: when reconcile hands it a
 *  winner, it must decide against its own in-memory state using this exact rule, not a private
 *  re-implementation of it. */
export function pickWinner(mine: DesignCanvasState, theirs: DesignCanvasState): DesignCanvasState {
  const byRev = revOf(mine) - revOf(theirs);
  const winner = byRev !== 0 ? (byRev > 0 ? mine : theirs) : ts(mine) >= ts(theirs) ? mine : theirs;
  const loser = winner === mine ? theirs : mine;
  // Backstop: whatever the counters say, an EMPTY copy never erases a populated one. Applied in
  // BOTH directions (the old code only guarded local-beats-remote in reconcile, so an empty-but-
  // newer REMOTE could still wipe a populated local).
  return wouldDestroy(winner, loser) ? loser : winner;
}

/** Firestore carries this as one JSON string because nested coordinate arrays are not writable. */
export function parseDesignCanvasStore(json: unknown): Store {
  if (typeof json !== 'string') return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function stringifyDesignCanvasStore(store: Store): string {
  return JSON.stringify(store);
}

function stateAt(store: Store, siteId: string): DesignCanvasState | null {
  return normaliseCanvasState(store[siteId], siteId);
}

/**
 * Pure read-modify-write used by reconcile and push. Invalid data in one slot
 * cannot enter the canvas, while every other site slot is preserved verbatim.
 */
export function mergeDesignCanvasStore(
  json: unknown,
  siteId: string,
  local: DesignCanvasState | null,
): { winner: DesignCanvasState | null; designCanvasJson: string } {
  const remoteStore = parseDesignCanvasStore(json);
  const remoteEntry = stateAt(remoteStore, siteId);
  const localEntry = local ? stateAt({ [siteId]: local }, siteId) : null;
  const winner = !localEntry ? remoteEntry : !remoteEntry ? localEntry : pickWinner(localEntry, remoteEntry);
  const mergedStore = winner ? { ...remoteStore, [siteId]: winner } : remoteStore;
  return { winner, designCanvasJson: stringifyDesignCanvasStore(mergedStore) };
}

function currentUid(): string | null {
  return activeAccountUid();
}

// SAMPLE-MODE GATE (safety layer 2 — see lib/sample-mode.ts): same choke-point trick as
// lib/user-sync.ts — every reconcile/push/subscribe here starts by asking db(); null means
// "signed out", which every caller already handles by staying local-only. In sample mode
// local-only IS the sandboxed localStorage shim, exactly what we want.
function db() {
  return isSampleMode() ? null : (getFirebase()?.db ?? null);
}

// One-shot reconcile for a single site, called on Design Studio mount/site-change. Merges
// this site's local state with whatever's in the cloud (pickWinner decides), writes the
// merged result back to Firestore, and — if the winner differs from what's already in
// localStorage — applies it locally so the page's existing DESIGN_CANVAS_CHANGED_EVENT
// listener reloads it. No-ops (never touches Firestore or clobbers local data) when signed
// out or offline; the localStorage copy keeps working exactly as before.
export async function reconcileDesignCanvas(siteId: string): Promise<DesignCanvasState | null> {
  const uid = currentUid();
  const d = db();
  // An explicit null owner means the historical bare key. Signed-out production
  // instead belongs to the dedicated guest namespace, so only pass an explicit
  // owner once an authenticated uid was actually captured.
  const local = uid ? loadCanvasState(siteId, uid) : loadCanvasState(siteId);
  if (!uid || !d) return local;

  const ref = doc(d, COLL, uid, 'data', DOC);
  try {
    let winner: DesignCanvasState | null = local;
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const merged = mergeDesignCanvasStore(
        snap.exists() ? snap.data().designCanvasJson : '{}',
        siteId,
        local,
      );
      winner = merged.winner;

      // Only ever touch OUR OWN siteId's slot — every other site's entry already in the
      // cloud store is left exactly as-is, so this can never wipe another site's design.
      if (winner) {
        tx.set(ref, { designCanvasJson: merged.designCanvasJson, updatedAt: serverTimestamp() });
      }
    });
    // A reconcile can outlive the auth state that started it. Its Firestore transaction and
    // cache belong to the captured uid, but returning/applying that winner after A → B would
    // place A's canvas into B's open React tree.
    if (currentUid() !== uid) return null;
    const displayedWinner = winner && winner !== local
      ? preserveCanvasNavigation(winner, local)
      : winner;
    if (displayedWinner && displayedWinner !== local) {
      applyRemoteCanvasState(displayedWinner, uid);
    }
    return displayedWinner;
  } catch (e) {
    console.error('[design-canvas-sync] reconcile', e);
    return currentUid() === uid ? local : null;
  }
}

// Fire-and-forget push after a local save (see app/design/page.tsx's persistCanvasState).
// Reads-modifies-writes inside a transaction so a concurrent push from another device can't
// clobber it — pickWinner decides which of the two ends up in the cloud, mirroring
// lib/user-sync.ts's upsertDesignStudio pattern.
export async function pushDesignCanvas(state: DesignCanvasState): Promise<void> {
  const uid = currentUid();
  const d = db();
  if (!uid || !d) return;

  const ref = doc(d, COLL, uid, 'data', DOC);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const merged = mergeDesignCanvasStore(
        snap.exists() ? snap.data().designCanvasJson : '{}',
        state.siteId,
        state,
      );
      tx.set(ref, { designCanvasJson: merged.designCanvasJson, updatedAt: serverTimestamp() });
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
      // against reapplying our own/stale edit is the pickWinner check below. Keep that check; it
      // is load-bearing, not redundant (our own echo ties on rev AND updatedAt, so `local` wins
      // the tie and we correctly do nothing).
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      // React cleanup follows the auth render, but an already-queued Firestore callback can run
      // first. Never let an A listener read or apply anything once B is the active account.
      if (currentUid() !== uid) return;
      const remoteEntry = stateAt(parseDesignCanvasStore(snap.data().designCanvasJson), siteId);
      if (!remoteEntry) return;
      const local = loadCanvasState(siteId, uid);
      // Same rule as reconcile/push — this listener is the one path that overwrites local with a
      // remote copy, so it must not use a weaker test than the paths that chose that copy. On
      // wall-clock alone it both missed rescues (a good low-updatedAt cloud copy could never
      // reach a starved device whose stale local was restamped NOW) and could destroy (an empty
      // but newer remote overwrote a populated local).
      if (local && pickWinner(local, remoteEntry) !== remoteEntry) return;
      applyRemoteCanvasState(preserveCanvasNavigation(remoteEntry, local), uid);
    },
    (e) => console.error('[design-canvas-sync] listener', e),
  );
}
