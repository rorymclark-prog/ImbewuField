# Shape sync v2 — second adversarial pass (source-specific)

**Status: prototype proven in isolation; the production defect is still NOT fixed.** Nothing here touched a repo, real
data, rules, config or a deployment. Everything ran on Node 22 in a sandbox with the labelled stand-ins listed in
VERIFICATION.md. The first package (ZIP SHA256 `e007c180…ddcf6`) was unzipped read-only and used only as the control.
`tests/shape-sync-loss.test.ts` is byte-identical to the frozen base and is still `todo`/red (logs/12).

## 1. Loss paths found in the FIRST package — each proven by a test that FAILS there and PASSES here

`tests/shape-sync-v2-negative-controls.test.ts` is self-contained: it has its own storage and transport fakes and uses
only the controller API both packages share, so the **same file** runs against both trees (logs/01 vs logs/02).

| # | Loss path in the first package (source) | What the farmer loses | Control (first pkg → pass 2) | Pass-2 fix |
|---|---|---|---|---|
| F1 | Same-account tabs share one key family. Pass 1 kept the whole queue in **one** array (`imbewu_shape_ops_v2`), read at start and rewritten by every write; it also pruned dedupe entries by an `ackSeq` watermark keyed by a device id that every tab of the profile shares. | Tab B's write erases tab A's queued op; or a stale tab's watermark lets a pruned op apply twice. | **NC1** fails (`shape-from-tab-A` missing) → passes | One journal row per op `imbewu_shape_op_v2:<opId>`; `loadPending()` rescans every write; per-op ack rows `imbewu_shape_ack_v2:<opId>` replace `ackSeq`; `pruneAcked()` drops an entry only when its journal row is gone **and** it is not in the batch; the flush step **revalidates its snapshot against storage inside the transaction**; Map's `storage` event → `controller.refresh()`. |
| F2 | An old-version (v1) tab in the same profile writes FARM_KEY after v2 started. Pass 1 migrated FARM_KEY once (marker `imbewu_shape_v1_migrated`) and then overwrote it as a derived cache. | The old tab's offline addition (its only copy). | **NC2** fails → passes | In-band marker `imbewuShapeSyncView:{v:2}` on the derived cache. Unmarked content **at any time** is raw v1 and is absorbed before any overwrite. Op ids are content-addressed (`ll-<digest(rawDigest\|shapeId\|content)>`), so re-absorbing is idempotent. |
| F3 | Migration wrote backup and quarantine, ignored their failure, then overwrote FARM_KEY. | The sole raw copy of any feature v2 cannot parse, when backup+quarantine `setItem` fail but the FARM_KEY write succeeds. | **NC3** fails → passes | `absorbRaw()` order: journal readable features → quarantine → content-addressed verbatim backup. FARM_KEY is overwritten only if journal **and** backup are durable; otherwise `status.rawCacheHeld` (raw left untouched, warning + Download backup). Backups are pruned only after the server covers every feature in them. |
| F4 | Quarantine was one array trimmed with `slice(-200)`. | 50 of 250 unreadable features. | **NC4** fails (`actual: 50`) → passes | One row per quarantined feature (`imbewu_shape_quarantine_v2:<digest>`), never trimmed, all exported. |
| F5 | At 20 open conflicts on a shape, the next op was recorded `rejected` and then acked out of the queue. | The 22nd device's edit (its only copy). | **NC5** fails → passes | New protocol outcome `deferred`: not recorded, journal row kept, every later op on that shape in the batch also deferred (author order kept), other shapes unaffected; applies once the farmer resolves a branch. Resolved history is no longer trimmed. |
| F6 | `status.rejected` was an in-memory count; the rejected op was removed from the queue on ack. | Any refused op after a reload. | (only reachable via F5 or a malformed op; regression test only) | `ackRecorded()` writes the raw refusal to `imbewu_shape_rejected_v2:<opId>` **before** removing the journal row; if that write fails the row stays (`rejectedRetentionFailures`). |
| F8 | Map native **Undo** fell back to `draw.delete(id); draw.add(backup)` when `nativeUndo()` returned false, with Map's own backup ref (stale after `draw.create`). No op was recorded. | The next vertex drag recorded the stale geometry as an edit with a fresh basis — a newer remote edit overwritten **without a conflict** (demonstrated: `pass2: hazard behind the Map Undo fix…`). | map-source test 7 fails on the first package's Map.tsx → passes (source-structure level only) | Undo acts only on `adapter.activeNative()` and only via the typed `native-undo` op; no untracked revert. |

## 2. Defects found in my own pass-2 drafts (fixed before delivery)

| # | Draft defect | Found by | Fix |
|---|---|---|---|
| F7 | Drain mode committed the island ingest only together with the island delete. With any unreadable feature the delete is (correctly) refused, so the island's **readable** shapes never reached v2. | old-client B4 / `pass2: drain: an island with ANY unreadable feature…` | The additive ingest always commits (it never infers a delete); only the delete is gated by `decideIslandDrain`. A deferred ingest re-reads the island on the next flush (`islandRetry`). Mutation N11. |
| F9 | Per-op rows were ordered by `(writer, wseq)`. A new writer (another tab, or the same tab after a reload) whose id sorted first put an edit **before** the create it was based on. | adversarial review, then a repro: ~50% of "offline create → reload → edit" became a held `missing-target` conflict and the shape left the map. | Each row carries `lc`, a Lamport counter: 1 + the highest `lc` this writer has loaded. Any op a tab saw (its view, basis, deps) sorts before what it records afterwards; ties are genuinely concurrent and broken by `(writer, wseq)`. No clock involved. Mutation N13. |

## 3. Old clients: what is and is not protected

`tests/shape-sync-v2-old-client.test.ts` drives the **unchanged** frozen `lib/user-sync.ts` (`OLD_CLIENT_TREE` = a copy of
the frozen packet) and the pass-2 client on one fake Firestore (logs/05). The same file was also run with this tree's own
v1 path (no `shapeSync` handler) as the old client: identical results.

| Test | Frozen v1 behaviour | Consequence |
|---|---|---|
| A1 | Island exists → reconcile overwrites the old device's FARM_KEY with the island **before** anything is pushed. | An old device that edited offline and is reopened **as an old client** loses those edits. Protecting `shapes_v2` changes nothing here. No v2 code can prevent it. |
| A2 | `shapesJson: null` counts as "exists, zero features" for reconcile → the cache is **wiped**; the live listener ignores null. | v2 must never write null to the island. It never writes the island at all (B4 asserts no `set` on `data/shapes`). A rule or admin "freeze" that blanks the field would wipe every old device. |
| A3 | Island absent + writes allowed → the old device bootstraps it from its cache. | Island re-created. v2 then ingests additively and does **not** resurrect a shape v2 deleted (B2). |
| A4 | Island absent + writes denied → reconcile throws at the shapes step, the cache is kept, and **no** live listener is attached; surveys/design reconcile never runs. | That device keeps its data, but **all** its sync is paused until it updates. This is a product cost, not a loss. |
| A5 | An open old device whose island is deleted keeps its cache; its later `pushShapes` is denied and logged; the cache is kept. | Same as A4 for an open tab. |
| B1 | That browser updated to v2 → raw cache absorbed, offline addition reaches `shapes_v2` with its properties. | The recovery path for A4/A5. |
| B3/B4 | Drain ON through the real `createShapeSyncTransport`: v2 write + island delete in **one** transaction; never deleted while any feature is unreadable. | — |

**Correction to the first package's R2 ("freeze the island").** Denying writes while the island document still exists
leaves A1 in force on every old-device reopen, so it protects nothing on the read side. The safer end state is
**island absent and island writes denied** (A4/A5). The sequence is gate **G13**: (1) ship v2 with drain OFF
(`drainLegacyIsland: false`, as wired); (2) forced-update window (G8); (3) one reviewed decision that enables the drain
together with rule R2′ (RULES-PROPOSAL). Even then old devices are **not "safe"**. Any old device reopened with offline
edits *before* the drain still hits A1. After the drain, old devices are sync-paused until they update.

## 4. Rollback contract

`planLegacyRollback(state, islandFeatures)` (protocol) returns `safe:false` with the blockers listed when there are open
conflict branches, held records, or unparseable island features. The branch geometry is included so it can be exported.
It never hands a tombstoned id back to v1, and it always sets `requiresDeviceDrain`. v1 cannot represent branches, holds,
or ops still sitting in device journals. So rollback is a **read-only / export / manual-reconciliation** procedure
(MIGRATION-AND-RECOVERY §7), never an automatic write. v1 code does not touch the v2 journal, so pending v2 ops survive a
rollback period and replay when v2 returns (`pass2: rollback period…`). Ops held on a device the server never saw cannot
be represented in any v1 snapshot. Rollback is therefore not lossless for them until that device is back on v2.

## 5. Exact change map (first package → pass 2)

Line numbers are pass-2 lines. The patches `0101`–`0106` are the authoritative diff.
`draw-adapter.ts`, `farm-geometry.ts` and `map-sync.ts` are unchanged.

**`lib/shape-sync/protocol.ts`** (927 → 1046 lines)
| Lines | Change | Fixes |
|---|---|---|
| 36–50 | Header contract; `MAX_CONFLICTS_PER_SHAPE` now defers; resolved-history trim constant removed | F5 |
| 263–267 | `DeviceEntry.ackSeq` kept for reading old docs only, no longer used for pruning | F1 |
| 402–410 | `OpOutcome.outcome` adds `'deferred'` | F5 |
| 486–512 | `openConflict` returns false at the cap; `applyOps` defers later same-shape ops after a deferral | F5 |
| 514–530 | `applyOne`: `defer()` — no `seq`, no `applied` entry | F5 |
| 551–629 | the four conflict-opening sites: `openConflict(...) ? finish('conflict') : defer(...)`; resolved history appended untrimmed | F5 |
| 698–760 | `applyLegacy`: branch opened before the digest is remembered; deferral leaves it un-ingested | F5 |
| 879–946 | `touchDevice(state, device, {nowMs})` (no watermark); **`pruneAcked(state, ackedOpIds)`**; `compactState` no longer prunes `applied` | F1 |
| 959–1046 | **`planLegacyRollback`**, **`legacyIslandOps`** (`li-` ids), **`decideIslandDrain`** | §3, §4 |

**`lib/shape-sync/controller.ts`** (556 → 809 lines, largely rewritten around the journal)
| Lines | Change | Fixes |
|---|---|---|
| 1–60 | Storage layout doc; `SHAPE_SYNC_BASE_KEYS` (journal/ack/rejected/quarantine/backup families + legacy pass-1 queue key) | F1–F6 |
| 74–100 | `shapeSyncKeys(keyFor)` → `item(family,id)` / `match(physical)`; a bare namespace never claims owner-suffixed rows | F1 |
| 102–125 | `StorageLike` enumerable; `TransactStep.deleteIsland`; `IslandRead`; `transact(step(current, island?), {island})` | §3 |
| 128–150 | `ShapeSyncStatus`: `rejected` (durable), `rejectedRetentionFailures`, `deferred[]`, `invalidJournal`, `rawCacheHeld`, `quarantineWriteFailures`, `lastCommittedSeq`, `islandDrain` | F3–F6 |
| 197, 316–351 | `JournalEntry {writer, wseq, lc}`; `loadPending()` rescans + Lamport order; `journalWrite()` one row per op | F1, F9 |
| 353–375 | `ackRecorded()`: rejected raw copy → row removal (verified) → ack row; never the reverse | F1, F6 |
| 376–383 | `quarantine()`: one row per feature, no trim | F4 |
| 394–445 | `isDerived()`, `absorbRaw()` (journal → quarantine → backup), `writeFarmCache()` holds raw when unsafe | F2, F3 |
| 446–462 | `pruneBackups()` only after server coverage | F3 |
| 512–571 | `adopt()`, `start()` (absorb before first cache write), `importPass1Queue()` (pass-1 array → rows, removed only when all durable), `refresh()` | F1, F2 |
| 633–651 | `ingestLegacyIsland()`: drain mode defers to the in-transaction read | F7 |
| 665–759 | `flush()`: snapshot; **in-step revalidation** (687); ack filter (703); island ingest + drain decision (705–720); `islandRetry` (743) | F1, F7 |
| 761–775 | `exportRecovery()` v2: journal, volatile, rejected, quarantine, backups, acks, v1 cache now, pass-1 queue, view | F3–F6 |
| 784–809 | **`shapeSyncNotice(status)`** — the only wording; "synced" only when nothing is pending/volatile/held/deferred/rejected/blocked and a commit was observed | §6 |

**`lib/user-sync.ts`** — 17–20: type import adds `IslandRead`, `TransactStep`. 782–814: `createShapeSyncTransport`
reads `data/shapes` in the same transaction when asked, and calls `tx.delete` on it only when the pure step says so.
The v1 branch and the `pushShapes` body are unchanged (logs/12).

**`components/Map.tsx`**
| Lines | Change | Fixes |
|---|---|---|
| 53, 548 | import + `shapeSyncNoticeNow = shapeSyncNotice(status)` | §6 |
| 944–973 | `readPaintCollection()`: paint from the controller view, never raw FARM_KEY while a controller exists; Draw always gets `{type, features}` | F3 |
| 989–997, 1097–1105 | redraw and account-switch paint use it | F3 |
| 1046–1062, 1068 | `drainLegacyIsland: false`; `storage` → `controller.refresh()` (+ cleanup) | G13, F1 |
| 3446–3463 | native Undo: active adapter session only, typed op only | F8 |
| 4509–4527 | banner driven by `shapeSyncNotice` (warn/error + Download backup) | §6 |

**Tests.** New: `negative-controls` (5), `pass2` (27), `old-client` (9), `map-source` (12). Ported pass-1 tests kept their
intent and changed only where they read removed internals:
* adapter: queue reads → `journalOps()`.
* controller: backup assertions content-addressed, checked before the flush and pruned after coverage. Failed persistence
  now injected per key prefix. "Migration crash before marker" became "absorption is idempotent: a crash before the
  derived overwrite re-derives the SAME op ids".
* protocol: retention test uses `pruneAcked`; one test-only type cast fixed (`as unknown as`), which pass 1 never type-checked.
* fakes: enumerable storage, prefix/sticky failure injection, island + `beforeRead` hook.

`tests/shape-sync-loss.test.ts` and the six other existing suites are untouched.

## 6. Notifications

`shapeSyncNotice` maps every failure state to a non-ok notice. Test: `pass2: shapeSyncNotice…`, 13 failure states.
Map.tsx shows only warn/error and never prints a success line. Nothing anywhere says "synced" unless all of these hold:
nothing pending, flushing, volatile, held, deferred, rejected or blocked, transport present, and a commit observed.
The first package did not make false claims either, but it surfaced only volatile/blocked states.

## 7. Observed results (logs/)

* Negative controls: first package **0/5**, pass 2 **5/5** (01, 02).
* All v2 suites on pass 2: **92/92** (03).
* Pass-2 suites as controls: Map source checks base 0/12, first package 8/12, pass 2 12/12. The old-client suite with the
  first package as the new client: A1–A5 pass (they characterise the frozen base); B1 fails only on the pass-2 marker
  assertion, the data still arrives; B3 fails (no drain); B4 passes vacuously (04).
* Existing 7 suites: identical base vs pass 2, `shape-sync-loss` still `todo` (06–08).
* `tsc --strict`: new modules, `user-sync.ts` with Firebase 11 types (base and pass 2), all v2 test files (09).
  Map.tsx: syntax only (10).
* Mutations: **21/21** caught, the 8 pass-1 mutations re-pointed plus 13 new (11).
* Patches: full and delta apply cleanly and reproduce the tree byte-for-byte (14).

What these levels do **not** show is listed in GATES.md. No emulator, no browser, no rules engine and no full build ran here.
