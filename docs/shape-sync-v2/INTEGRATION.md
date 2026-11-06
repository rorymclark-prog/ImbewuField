# Integration guide (against frozen 5c12307a)

> **Pass 2:** patch numbering for the second package is `0000` (frozen 5c → pass 2, all) and `0100`/`0101–0106` (first
> package → pass 2, per area). Map.tsx pass-2 changes: paint from the controller view, `storage` → `refresh()`, Undo via the
> active adapter session only, banner via `shapeSyncNotice`, `drainLegacyIsland: false`. See PASS2.md §5.

## Patch set (in `patches/`, generated with `git diff` from a commit of the frozen base)

| Patch | Files | Independently revertible? |
|---|---|---|
| 0001 | `lib/farm-geometry.ts` (new, validators moved verbatim), `lib/map-sync.ts` (re-export) | yes (but 0004 imports farm-geometry) |
| 0002 | `lib/user-sync.ts` — `shapeSync` handlers, read-only island tap, `createShapeSyncTransport`, `pushShapes` `@deprecated` (body unchanged). v1 path byte-identical in the `else` branches | yes |
| 0003 | `components/Map.tsx` — every call site in AUDIT §A | **yes — this is the rollback switch.** Base Map.tsx still works against the proposed user-sync (v1 path + `pushShapes` remain) |
| 0004 | `lib/shape-sync/{protocol,controller,draw-adapter}.ts` (new) | with 0003 |
| 0005 | `tests/shape-sync-v2-*.ts` (new; no existing test touched) | yes |
| 0006 | `docs/shape-sync-v2/*` | yes |
| 0000 | all of the above in one file | — |

`git apply --check` of every patch against a clean copy of the frozen base is in `logs/11-git-apply-check.txt`.

## What the Map.tsx patch does (by AUDIT row)

A1 recompute → stats only · A2/A3/A4/A12 Draw events + native sessions → adapter · A9–A11 reticle start/Done/Cancel →
sessions with stable id · A13 Undo → `nativeUndo()` · A14 new shape → `addNewShape` · A16 name sheet → basis on open,
commit on Save · A17/A18 deletes → per-shape tombstones · A19 teardown → `adapter.reset()` · A20 share → additive import ·
A23 subscription merged with controller creation in ONE effect placed before the account-switch effect · new: conflict
tray + "not saved on this device" + "sync paused / Download backup" (English, G9) · `online` → `controller.nudge()`.

Unchanged by design: `redrawShapesFromStorage`, its deferral rule, `restoreShapes` (now wrapped as presentation), the
restore poller, all stats, Escape handling, sharing/printing (read-only), places/water/site-elements code.

## Exact remaining integration steps (not doable from the packet)

1. **Compile** (G2). Likely nits: `React.CSSProperties` usage mirrors existing code in this file; `crypto.randomUUID` needs
   the DOM lib (fallback provided); `drawRef.current as unknown as DrawLike` is a deliberate structural cast — confirm the
   pinned MapboxDraw type has `add/get/getAll/delete/setFeatureProperty`.
2. **Draw semantics** (G4) — the four assumptions listed there. If (a) fails (Draw ignores explicit ids), `addNewShape`
   already adopts the id Draw returns; but reticle Done/Cancel re-adding a deleted id must then be revisited.
3. **Resolve UX copy** (G9) and placement next to the existing top-left toolbar/guided bar (G5 visual check).
4. **Other FARM_KEY / id consumers** (G12): if any module keys data off feature ids, v2 now keeps ids stable across edits
   (v1 changed them on every reticle edit) — check for code that depended on the old churn.
5. **Remove** `pushShapes` + the v1 `else` branches in user-sync only after G7 (D10). Until then they are the rollback path.

## Wiring diagram

```
farmer action ─▶ Map.tsx call site ─▶ DrawShapeAdapter ─▶ ShapeSyncController.create/update/remove/resolve/import
                                                              │ write-ahead queue (localStorage, account-scoped)
                                                              │ view = confirmed ⊕ pending ──▶ FARM_KEY cache ──▶ redraw / design studio
                                                              ▼
                     lib/user-sync.ts createShapeSyncTransport(uid) ── runTransaction(shapes_v2): read → applyOps → write
                     lib/user-sync.ts subscribeUserMapData({ shapeSync }) ── onSnapshot(shapes_v2) ─▶ controller.receiveRemote
                                                                          └─ onSnapshot(shapes, READ-ONLY) ─▶ controller.ingestLegacyIsland
```
