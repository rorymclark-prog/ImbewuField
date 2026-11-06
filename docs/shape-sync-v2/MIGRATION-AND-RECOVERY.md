# Migration, fencing, recovery and rollback

**No real data is migrated by this package.** Everything below is the designed behaviour, executed only against
synthetic fixtures in the prototype tests. Running it against production data is gate G8/G11.

## 1. What a device does on every v2 start (per account namespace) — pass 2

1. Load or create `deviceId` (`imbewu_shape_device_v2`). It is shared by every tab of the profile. A per-instance `writer`
   id plus `wseq` and the Lamport counter `lc` order journal rows (PASS2 F9).
2. Import a first-package queue array `imbewu_shape_ops_v2`, if present, into per-op rows. The array is removed only when
   every op is stored durably.
3. Load the confirmed-state cache `imbewu_shape_state_v2` and every journal row `imbewu_shape_op_v2:<opId>`. Unparseable
   rows are counted (`invalidJournal`), exported, and never deleted automatically.
4. **Absorb-before-overwrite**, on every start and every cache write, not once. If FARM_KEY lacks the in-band marker
   `imbewuShapeSyncView:{v:2}` it is raw v1 content (a never-migrated cache, or an old tab writing after v2 started):
   1. journal every readable feature as a `legacy` op with id `ll-<digest(rawDigest|shapeId|content)>`, skipped when the
      view already holds the identical record;
   2. write one quarantine row per unreadable feature;
   3. write a verbatim content-addressed backup `imbewu_farm_shapes_v1_backup:<digest>`.

   FARM_KEY is replaced by the marked derived view **only if** steps 1 and 3 are durable. Otherwise it is left untouched
   and `status.rawCacheHeld` is set. A crash anywhere re-derives the same op ids (idempotent).
5. Backups are removed only once every feature in them is recorded server-side and none was unreadable.
6. The subscription reads `shapes_v2`, then the island. Island features become `li-<digest(version|shapeId|content)>` ops,
   identical on every device. With drain OFF (default) they are journaled. With drain ON they are read and ingested
   inside the flush transaction instead (§3).

All keys are account-scoped through `lib/account-local-storage.ts` (`…::imbewu-owner::uid:<uid>`), bare in sample mode and
guest-suffixed signed out. `shapeSyncKeys().match()` never lets a bare namespace claim an owner-suffixed row.

## 2. Ordering hazards and how each is closed

| Hazard (v1) | v2 behaviour | Test |
|---|---|---|
| A draws, B (stale listener) draws, B erases A | B's flush applies B's **op** to the latest doc | `shape-sync-v2-loss` ×2 |
| Two first devices both bootstrap `setDoc` | Genesis inside a transaction; the loser's commit fails and its ops re-apply on the winner's state; one `storeId` | *two-device first bootstrap race* |
| Reconnect: reconcile overwrites local edits before `onMergeDone` | Queue survives reload; remote adoption never touches pending ops; v1 local edits are folded in as `legacy` ops before the cache is overwritten | *offline edits survive reload…*, wiring test 2 |
| Crash between local persist and ack | Op stays queued; replay → `duplicate`, rev unchanged | *crash after commit…* |
| Listener latency / reordering | Lower `seq` ignored; ops carry their own base | *listener reordering…*, adapter *native edit captures its basis…* |
| Auth A→B mid-flight | Bound keys; `isCurrent()` checks before every write; late results dropped; A's queue replays next A session | *late account callback…* |
| Sample mode | `transport=null` + `db()` null; local-only inside the shim | *sample / signed-out controllers…* |
| Offline queue replay | Ordered batch per flush; backoff 2 s→60 s; `online` event nudges | offline test |
| Held conflicts | Never auto-resolved; listed until the farmer chooses; survive reloads (they are server state) | protocol conflict tests |
| *(pass 2)* Two tabs of one account, offline, then restart | One journal row per op; any tab flushes all; snapshot revalidated inside the transaction step; per-op acks | NC1, *pass2: tabs…* ×3 |
| *(pass 2)* A v1 tab writes FARM_KEY after v2 started | Unmarked = raw → absorbed before any overwrite | NC2 |
| *(pass 2)* Backup / journal / quarantine write fails during absorption | Raw left untouched (`rawCacheHeld`) unless journal + backup are durable; reload re-derives the same ops | NC3, *pass2: migration boundary…* ×3 |
| *(pass 2)* New writer depends on an older writer's pending op (other tab, or reload) | Lamport `lc` order | *pass2: causal order…* ×3 |

## 3. Old full-snapshot clients — read-side fencing (pass 2, characterised against the UNCHANGED frozen v1)

`tests/shape-sync-v2-old-client.test.ts`, PASS2 §3.

* **Phase A (as shipped here, drain OFF, R1 only).** v2 never writes `data/shapes`; old clients keep writing it; v2
  ingests it additively. Old clients cannot damage `shapes_v2`. **They are not safe themselves**: an old device reopened
  with offline edits while the island exists loses them to its own reconcile (A1). Nothing in v2 changes that.
* **Never**: blank the island (`shapesJson: null` wipes old caches, A2), or deny writes while it still exists (the first
  package's R2 "freeze"). The freeze leaves A1 in force on every reopen.
* **Phase B (gate G13, after the forced-update window G8): drain + R2′ together.** A v2 client deletes the island in the
  same transaction that records its content, and only when every feature is readable and recorded
  (`decideIslandDrain`). R2′ denies island create/update. Old devices then keep their cache, and their whole sync pauses
  (A4/A5). When updated, the raw cache is absorbed (B1). Remaining limitation: an old device reopened with offline edits
  **before** its account's drain still loses them (A1).
* **Phase C.** Once drained accounts have been quiet for a review window, set `legacyBridgeRetired:true`; legacy/import
  tombstones become prunable; then remove the island listener.

## 4. Malformed / missing ids

`assignLegacyIds`: valid unique string id kept; finite integer → `lgn-<n>`; missing/invalid →
`lgx-<scope>-<contentDigest>-<occurrence>`; an id used twice in one collection → every occurrence
`<id>~<digest>~<occurrence>` (never "first wins"); invalid geometry → quarantined verbatim. v2-created ids are validated
on create (`invalid-id`, `id-in-use`).

## 5. Compaction (bounded) — pass 2

Inside each committing transaction:
* prune the `applied` entries of ops whose journal row is gone, whose ack row was reported, and which are not in this
  batch (`pruneAcked`). There is no per-device watermark;
* prune v2 tombstones every active device has seen;
* forget devices unseen for 800 days.

Size cap (pass 3): the whole document in UTF-8 bytes, `shapeDocBytes ≤ SHAPE_DOC_BYTE_BUDGET` (1 MiB − 16 KiB), and the
field limit → otherwise a `too-large` block with export. (Pass 1/2 counted 900 000 UTF-16 code units, which let 1.2 MB of
Han text through.) Share-import deletion identities (`deletedImports`) are never pruned and count toward that budget. Open conflicts per shape are capped at 20, and further ops on
that shape are **deferred**: kept in the journal and shown as "waiting until you decide". Nothing is rejected or dropped
because of the cap. Resolved history, quarantine, rejected records and backups are **never trimmed**. If they grow, the
remedy is export plus a reviewed cleanup, never silent loss.

## 6. Export / recovery

`controller.exportRecovery()` (version 2) returns JSON with:
* the confirmed state, every journal row (including unparseable ones), volatile in-memory ops, rejected raw ops,
  quarantine, verbatim backups and ack rows;
* the current FARM_KEY content (including any pass-3 fallback `carry`), any first-package queue array, status and the view.

Map.tsx offers **Download backup** whenever `shapeSyncNotice` says `offerBackup`. Re-import is **not** implemented
(DECISIONS D7).

## 7. Rollback — read-only / export / manual reconciliation

v1 cannot represent conflict branches, held records, deferred ops or device journals. Rollback is therefore never an
automatic write.

1. **Stop v2 writes** (feature flag): devices keep recording to their journals; nothing is lost while paused.
2. **Per account**, run `planLegacyRollback(state, islandFeatures)` (pure, tested):
   * `safe:false` lists the blockers: open conflicts (with both geometries), held records, unparseable island features.
     Each blocker needs a farmer or admin decision from the export; nothing is chosen automatically.
   * `safe:true` gives the FeatureCollection to write: every live v2 shape plus every island feature v2 never recorded.
     Tombstoned ids are never handed back (no resurrection of reviewed deletions).
3. The reviewed admin write re-reads the island in a transaction. After R2′ it needs a temporary per-account rules revert
   or the Admin SDK. Never write `shapesJson: null`.
4. `requiresDeviceDrain` is always true. Ops waiting in device journals cannot be in the plan. Those devices must come
   back on v2 (journals are untouched by v1 code, tested) or have their export reconciled by hand. Until then rollback is
   **not lossless** for them, and must not be described as such.
5. **Re-enable v2**: the island now holds v2 ids with identical content → no-ops. v1-era changes follow the normal bridge
   rules; journals replay.
