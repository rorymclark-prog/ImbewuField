# Shape-sync audit — every writer, path and listener (frozen base `5c12307a`)

Line numbers are **base** lines in the frozen packet (`components/Map.tsx`, `lib/user-sync.ts`).
Class: **U** = farmer operation · **P** = draft/presentation only · **R** = remote application ·
**T** = teardown · **S** = sync transport. "v1 effect" is what reaches localStorage/Firestore today.

## A. Map.tsx — draw-store mutations and their v1 consequences

| # | Symbol (base lines) | Class | v1 effect | v1 defect found | v2 replacement (proposed) |
|---|---|---|---|---|---|
| A1 | `recompute` (673–748), persist+push at 682–694 | S | Every call writes `draw.getAll()` to FARM_KEY and, once `mergeReadyRef`, `pushShapes(uid, all)` — a blind whole-collection `setDoc`. | **The confirmed loss.** Any caller pushes whatever the store holds, including a store that intentionally lacks a shape (A9) or holds a stale view (A12). | Stats only. No persistence, no push. Persistence is per action via the adapter (typed op, durable queue). |
| A2 | `draw.create` handler (826–856) | U | Stamps featureType/hatchIdx/siteId/placeId, `recompute()` → push. | Unreachable today: `activeDraw` is only ever set to `null`; nothing enters `draw_polygon`. | `recordDrawCreate(ids)` → `create 'draw-create'` with Draw's id, **after** props are stamped; then native session begins on the setTimeout (852). |
| A3 | `draw.update` / `draw.delete` → `recompute` (857–858) | U | User vertex drag / move / keyboard delete → push whole store. | Edits made while a remote redraw is deferred are pushed over the unseen remote state. | `recordDrawUpdate` → `update 'native-edit'` with the **session basis**; `recordDrawDelete` → `delete 'keyboard-delete'`. Guarded by `isPresentation()`. |
| A4 | `draw.modechange` (862–881) | U | Sets `nativeEditBackupRef` + `editingFeatureId`. | — | Also `beginNativeEdit(id)` (captures basis when the session starts). |
| A5 | `restoreShapes` (901–913) `draw.set(fc)` @909 | P | Paint FARM_KEY once; `recompute()` — with `restoredRef` still false so no push. | — | Unchanged except `draw.set` is wrapped in `applyingRemoteRef` (defence in depth). FARM_KEY is now the v2 view. |
| A6 | `redrawShapesFromStorage` (919–939) `draw.set` @934 | R | Paint FARM_KEY; deferred while any edit/draw session is active. | Deferral protects the editor's **view**, not the **payload**: the session's later push still carries the pre-remote store (the "deferred redraw" gap). | Unchanged. It is now safe because nothing pushes a store; the session's op carries the basis captured at session start, so the unseen remote change becomes a conflict, not a loss. |
| A7 | deferred-redraw flush effect (941–947) | R | Re-paint after sessions end. | — | Unchanged; plus a new effect ends the native session whenever `editingFeatureId` clears. |
| A8 | account-switch effect (954–984) `draw.set` @973/978 | R/T | Reset store from the new namespace; `recompute()` (push blocked by `mergeReadyRef=false`). | — | Same, minus `mergeReadyRef`; also drops adapter draft sessions (old owner's draft is never recorded). |
| A9 | `startReticleEdit` (1256–1294) `draw.delete` @1269 | P | Lifts the shape out of the store. No push by itself. | **Draft deletion becomes remote deletion**: any `recompute()` during the edit pushes the store *without* this shape. Concrete trigger: the edit bar's **Rename** (2822) → `confirmShapeNaming` → `recompute()` (2082). Tab close / account switch before Done/Cancel leaves it deleted in the cloud. Also snapshots only 5 named props + outer ring. | `beginReticleEdit(id)` snapshots the **whole feature** + basis, then lifts it. Presentation only — the controller view and FARM_KEY keep the shape; no op is recorded. |
| A10 | `finishReticleEdit` (1399–1430) `draw.add` @1409 | U | Re-adds a **new feature with a fresh id**, copying only name/category/hatchIdx/placeId/siteId; push. | Identity changes on every edit; unknown properties, foreign members and **inner rings** are dropped; a name typed mid-edit is lost. | `finishReticleEdit(session, ring, defaults)`: same id, all props/foreign members/holes; only the outer ring changes; defaults (featureType, siteId) only where missing/null, exactly as v1 `??`. One `update 'reticle-done'`. |
| A11 | `cancelReticleEdit` (1433–1462) `draw.add` @1440 | P | Re-adds the original ring as a **new feature with a fresh id**, 5 props; push. | Cancel changes identity and drops data; if `orig.length < 3` the shape is not re-added at all. | `cancelReticleEdit(session)`: re-adds the exact lifted feature, same id. **Zero ops.** |
| A12 | `startNativeEdit` (1298–1307) | U | backup + `direct_select`. | Programmatic `changeMode` emits no `modechange` (assumption, G4) — handled here directly, as v1 does. | Also `beginNativeEdit(id)`. |
| A13 | native **Undo** button (3337–3349) `draw.delete`/`draw.add` @3343–3344 | U | Restore backup, `recompute()` → push. | Reverts over remote changes the session never saw. | `nativeUndo()` → `update 'native-undo'` (same id) reverting the session's own fields; anything changed elsewhere is not in the session's deps → conflict branch. Falls back to the v1 presentation restore if no session. |
| A14 | `finishPinDraw` (1209–1242) `draw.add` @1221 | U | New feature (Draw id), stamp props, push, open naming sheet. | — (fresh shape) | Props built first (same values; `hatchIdx` = same-type count before add, which v1's after-add-excluding-self count evaluated to); `addNewShape` → explicit `shp-<uuid>` id + `create 'reticle-create'`. |
| A15 | `cancelPinDraw` (1201–1207), `undoPin`, `addPin`, GPS corners | P | Draft points only (React state). | — | Unchanged. Draft corners never become ops. |
| A16 | `openShapeNaming` (2061–2071) / `confirmShapeNaming` (2072–2086) | U | `setFeatureProperty` ×3 then `recompute()` → push. | During a reticle edit the target is not in the store: `setFeatureProperty` throws (caught) → rename lost **and** A9's remote deletion. A concurrent remote rename received while the sheet is open is overwritten. | Basis captured when the sheet **opens** (`beginPropertyEdit`); `commitPropertyEdit` → `update 'rename'`. In a reticle session it updates the lifted copy so Done **and** Cancel keep the confirmed rename. |
| A17 | `deleteFeature` (2089–2096) / `requestDelete` (2104–2111) | U | `draw.delete` + push. | Fine locally; the push is A1. | `deleteShapes([id], 'delete')` → one tombstone with this view's base. |
| A18 | `clearType` (1465–1475) | U | Deletes every shape of a type + push. | **Unreferenced** in this file (dead code). | If wired: one explicit delete per visible shape (`'clear-type'`); shapes added elsewhere meanwhile survive. No wildcard. |
| A19 | `clearDraw` (1478–1491) `draw.deleteAll` @1483, unmount cleanup @1737 | T | `tearingDownRef` blocks the persist. The comment claims deleteAll fires `draw.delete`; Draw docs say programmatic deletes are silent (G4). | — | Plus `adapter.reset()`. Adapter ignores events while `tearingDownRef`. No ops either way. |
| A20 | share restore effect (1845–1887) `draw.set(data.geojson)` @1864 | U(import) | **Replaces the farmer's whole store with the shared site**, `recompute()` → FARM_KEY and (if merge ready) `pushShapes` — the recipient's own shapes are wiped locally and remotely. | **Second loss path.** | `importShared(geojson, code)`: additive `import` ops under deterministic ids `imp-<hash(code)>-<hash(srcId)|iN>`; re-opening the link is a no-op; a deleted imported copy is never resurrected. Places/water merge paths unchanged. |
| A21 | `handleShare` (1674–1696), `handleSharePlace` (1698–1727), `printBaseMap` (1785–1811), `getSiteFeatures`/`getWaterFeatures` | P (read) | Read-only. | — | Unchanged. |
| A22 | Escape handler (1506–1536) | U/P | Routes to cancel reticle edit / pin draw / native. | — | Unchanged; reaches the v2 cancel paths. |
| A23 | subscribe effect (1055–1079): `onShapes` → redraw; `onMergeDone` → `pushShapes(uid, FARM_KEY)` @1074 | S/R | Initial flush of the reconciled local set. | Blind initial push; and `mergeReadyRef` gating is the only guard. | Removed. Replaced by ONE effect that creates the controller and the subscription together (callbacks bound to that controller), placed **before** the account-switch effect so `start()` writes FARM_KEY first. |

## B. lib/user-sync.ts — shape transport

| # | Symbol (base lines) | Class | v1 behaviour | Defect | Proposed |
|---|---|---|---|---|---|
| B1 | `db()` (42) | S | `null` in sample mode → whole sync surface unreachable. | — | Reused by `createShapeSyncTransport` (sample safety layer 2 preserved). |
| B2 | shapes reconcile (393–417) | S/R | Remote doc exists → **overwrite local FARM_KEY with remote** (409); else bootstrap `setDoc` from local (412). | Offline/unpushed local edits are overwritten before `onMergeDone`; two first devices both `setDoc` and the later wins. | When `handlers.shapeSync` is supplied: read `shapes_v2` → `onRemoteState`; read `shapes` → `onLegacyIsland` (read-only). **No write, no local overwrite.** Without `shapeSync` the v1 block runs byte-identically (keeps the existing isolation tests meaningful and is the rollback path). |
| B3 | shapes listener (480–487) | R | Overwrites FARM_KEY with every remote snapshot. | Same as B2 for live updates. | `shapeSync`: `shapes_v2` listener → `onRemoteState`; `shapes` listener → `onLegacyIsland` (read-only tap so not-yet-updated clients' edits still arrive). |
| B4 | `pushShapes` (724–730) | S | Blind `setDoc` of a whole collection. | **The defect.** | Body unchanged and marked `@deprecated`; no proposed caller. Kept so `tests/shape-sync-loss.test.ts` remains the OLD-SOURCE red control (G7). |
| B5 | `parseShapes` (138–142) | — | Accepts anything with `.features`. | No geometry validation. | v2 validates every feature with the shared `lib/farm-geometry.ts` validator; invalid ones are quarantined for export, never silently dropped. |
| B6 | — (new) | S | — | — | `createShapeSyncTransport(uid)`: one `runTransaction` per flush on `user_map_data/{uid}/data/shapes_v2`; throws when `db()` is null or `auth.currentUser.uid !== uid`; adds `updatedAt: serverTimestamp()`. |

## C. Other readers/writers of the shape cache (inside the packet)

| Symbol | Effect | Proposed |
|---|---|---|
| `lib/map-sync.ts readLocalFarmShapes` (102–112) | Reads FARM_KEY for GeometryDesignStudio/design-studio. | Unchanged. FARM_KEY is now the derived v2 view, written synchronously on every op/remote change. Validators moved verbatim to `lib/farm-geometry.ts` and re-exported. |
| `lib/sample-mode.ts` storage shim + `buildDemoStorageSeeds().imbewu_farm_shapes` | Sample farm shapes live in the shim's bare FARM_KEY. | Sample controller uses `activeAccountLocalStorageKey` (bare in sample) and **no transport**; the seeded demo shapes are folded in by the one-time local migration inside the shim's memory. Nothing can leave. |
| `lib/account-local-storage.ts` | uid-scoped keys, guest suffix, mounted-uid binding. | Controller keys are resolved **once** at creation with `accountLocalStorageKey(base, uid)` (signed in) or `activeAccountLocalStorageKey` (sample/guest); `isCurrent()` re-checks `activeAccountUid()` **and** the Firebase user before every write. |

## D. Sources this audit could NOT inspect (not in the packet)

`lib/site-share.ts` (share payload validation, sample gate), `lib/auth.tsx` (whether `migrateGuestLocalStorageRows`
includes FARM_KEY; binding order of `bindMountedAccountLocalStorageUid`), `@mapbox/mapbox-gl-draw` version + event
semantics, `lib/design-studio.ts` / `lib/design-overlay.ts` / GeometryDesignStudio (other FARM_KEY readers; do they
key anything off feature ids?), `lib/demo-farm.ts`, `lib/firebase/init.ts`, `lib/i18n`, `tests/register-alias.mjs`,
`package.json` test script, any other caller of `pushShapes` / FARM_KEY outside these files, `app/home/page.tsx` and
`components/ProductTourProvider.tsx` (read by `tests/sample-mode.test.ts`). No API of these is invented here; each
dependency is listed as a gate in GATES.md.
