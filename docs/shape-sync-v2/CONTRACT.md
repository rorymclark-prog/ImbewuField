# Shape sync v2 — executable contract

The contract is `lib/shape-sync/protocol.ts` (pure) + `lib/shape-sync/controller.ts` (queue/view/flush).
Each invariant names the test that executes it. "Server" means the single document
`user_map_data/{uid}/data/shapes_v2`; every write to it is *read latest → `applyOps` → write* inside one
transaction.

## 1. Architecture choice

**Stable identity + per-field revision stamps + tombstones + explicit operations**, applied server-side
(inside the transaction) by a deterministic pure function. Rejected alternatives and why:

| Rejected | Why |
|---|---|
| Feature-count guard | Reticle edits re-id shapes; counts don't encode intent; blocks legitimate deletes. |
| Blind union by id | Resurrects deletions; can't express a deliberate delete-all. |
| Whole-snapshot CAS + auto-retry | Retry re-asserts a stale snapshot — the v1 defect with extra steps. v2 retries re-apply **ops** to the new state. (Mutation M4 in VERIFICATION.md reintroduces exactly this and both v2-loss tests fail.) |
| Wall-clock last-writer-wins | Silent loss on clock skew or genuine concurrency. No client clock participates in any merge here. |
| Geometry hashing as identity | Merges distinct coincident shapes. Identity is `Feature.id`; digests are only used for bookkeeping and for derived ids that also carry an occurrence counter + scope. |
| Op-log subcollection | Needs new rules (subcollections don't match `data/{doc}`) and materialization; reconsider at scale (DECISIONS D2). |

## 2. Data model

* **Identity**: `Feature.id` (string, `/^[A-Za-z0-9_:.~-]{1,160}$/`). New v2 shapes get `shp-<uuid>`; v1 Draw ids are kept.
* **Content**: `{ g: Geometry, p: properties, x: foreign members }`. `properties: null` → `{}`. Same JSON round-trip v1 already applied.
* **Fields**: `g`, `p:<key>`, `x:<key>`; each has a stamp `{ rev, op }` = record revision + op that last wrote it (incl. unsets).
* **Record**: `{ id, rev, live, content, fields, createdBy, createdSeq, deletedBy?, deletedSeq?, origin, conflicts[], resolved[] }`. Unknown keys preserved.
* **State**: `{ protocol: 2, minor, storeId, seq, prunedBelowSeq, records, applied{opId→{seq,device,outcome,conflict?}}, devices{→{seenSeq,ackSeq,lastSeenMs}}, legacy{v1 id→ingest entry} }`. Unknown top-level keys preserved.
* **Document**: `{ protocol, minor, storeId, seq, stateJson, updatedAt }` (geometry inside a JSON string, exactly as v1 `shapesJson`). Max 900 000 chars → `blocked:'too-large'`, never truncation.

## 3. Operations (typed intent)

| kind | carries | sources |
|---|---|---|
| `create` | content | `reticle-create`, `draw-create` |
| `update` | `baseRev`, `deps`, field `patch`, full `proposed` | `reticle-done`, `native-edit`, `native-undo`, `rename` |
| `delete` | `baseRev`, `deps` | `delete`, `keyboard-delete`, `clear-type` |
| `resolve` | `conflictId`, choice `keep-current \| use-branch \| keep-both` (+ `newShapeId`) | `resolve` |
| `legacy` | content, `island` (server commit ms of the v1 doc write; 0 = this device's v1 cache) | `legacy-island`, `legacy-local` |
| `import` | content, deterministic id | `share-import` |

There is **no** wildcard delete; "delete all" is N deletes (test: *invalid ops are rejected…; there is no wildcard delete*).
`baseRev` = the shape's rev in the **server-confirmed** state the author saw; `deps` = the author's own ops on that
shape that were optimistically *applied* in the view they edited (never ones shown as conflicts).

## 4. The merge rule

An op conflicts iff some field it touches has `stamp.rev > op.baseRev` **and** `stamp.op ∉ op.deps`.

* no clash → apply (`update`: patch fields, rev+1, restamp; `delete`: tombstone, rev+1, keep content)
* clash → **conflict branch** on the record: `{ id=opId, kind, ops[], device, source, baseRev, fields, patch|null, proposed|null, atSeq }`; head unchanged
* an op whose dep opened a branch **folds into that branch** (own later edits stay one coherent "other version")
* `update` on a tombstone → `edit-after-delete` branch (shape stays off the map, listed for the farmer)
* `update` with no record → **held** record (`live:false`) with `missing-target` branch — never silently re-created, never dropped
* `delete` vs edited fields → `delete-vs-edit` branch (shape stays on the map, listed)
* own offline edit then own delete meeting a deletion → branch removed (both sides agree)
* duplicate `opId` → `duplicate` (records nothing new)

Tests: *TODO-scenario ordering…*, *independent same-count edits…*, *same-feature concurrent edit…*, *offline edit vs
delete, both arrival orders…*, *own ops chain… fold…*, *op idempotency and reordering…* (all 10 interleavings).

**Ordering contract**: content per id is independent of op order for independent ops. The FeatureCollection array order
follows the store's single commit order (`createdSeq`) — v1's creation/draw order; every device that adopts the store
renders the same order. For genuinely conflicting ops the *set* {head, branch} is order-independent; which one is the
head is the first committed.

## 5. Farmer-visible resolution

`listConflicts(state)` → `{ shapeId, conflictId, kind, live, current, other, fields, device, source }`. Map.tsx shows
"N shapes need your decision" with **Keep this version / Use the other version / Keep both** (live) or **Keep it deleted /
Restore it** (tombstone) or **Delete it** (delete branch). Resolution is itself an op; a second device resolving the same
conflict later gets `noop`. Last 3 resolutions are kept on the record (`resolved[]`).

## 6. Legacy (v1) bridge — read-only, never deletes

v2 never writes `data/shapes`. v1 data enters only as `legacy` ops: from this device's FARM_KEY once (`island=0`) and
from every observation of the v1 document (`island=updatedAt.toMillis()`).
Per v1 id: `{ known: last 6 digests, island, islandDigest, rev }`.

* first sight → create (`origin:'legacy'`)
* digest already known → no-op (stale copies cannot revert v2 edits)
* `island > 0 && island ≤ entry.island` → no-op (superseded by the island's own linear history)
* newer island write after an island ingest → field rule with `baseRev = entry.rev`
* unversioned/unorderable difference → `legacy-divergence` branch
* omission → **nothing** (an old snapshot missing a shape is indistinguishable from the v1 bug)

Cost (accepted, documented): old-app deletes don't propagate; an old-app reticle edit (re-id) appears as an extra shape;
an old-app edit to a shape v2 also edited since ingest becomes a branch. Duplicates are recoverable; loss is not.
Rules gate R2 freezes the island and removes these costs. Test: *v1 bridge: omission never deletes…*.

## 7. Durability, ack and retention (pass 2)

* **Write-ahead, one row per op**: `imbewu_shape_op_v2:<opId>` holds `{op, writer, wseq, lc}` before
  `create/update/remove` returns. If persisting fails, the op stays in memory: `durability='volatile'`, error notice.
  No two writers ever rewrite a shared array (NC1).
* **Order**: Lamport `lc` (1 + highest loaded), then `(writer, wseq)`. Whatever a tab saw is applied before what it
  recorded afterwards. No wall clock.
* **Ack**: after a commit the order is
  1. a refused op's raw copy → `imbewu_shape_rejected_v2:<opId>`,
  2. remove the journal row and verify it is gone,
  3. write the ack row `imbewu_shape_ack_v2:<opId>`.

  A failure at 1 keeps the row; at 2 the op replays as a harmless `duplicate`; at 3 the server keeps the dedupe entry
  longer. (Tests: *crash after commit…*, *pass2: same-tab reload…*, *pass2: a failed ack-record write…*,
  *pass2: a refused op is kept raw…*.)
* **Idempotency entries** are pruned (`pruneAcked`) only for ops whose ack row was reported, whose journal row is gone and
  which are not in the current batch. Never by age and never by a per-device watermark: tabs share a device id.
* **Snapshot revalidation**: the transaction step re-reads each snapshotted row synchronously and drops ops another tab
  already committed and removed (*pass2: tabs: an op another tab flushed…*).
* **Conflict cap → defer**: at 20 open branches on a shape, further ops on it are `deferred`: unrecorded, kept, in order,
  and resumed after a decision. Never rejected, never dropped (NC5).
* **Nothing is trimmed**: quarantine, rejected records, backups and resolved history (NC4).
* **v2 tombstones** are pruned only when every device seen within `activeDeviceWindowMs` (400 d) has `seenSeq ≥ deletedSeq`.
  A device back after longer gets **holds** (`missing-target` with its full content), never resurrection or a silent drop.
* **Legacy/import tombstones** are retained while the bridge is enabled (`legacyBridgeRetired:false`).
* **Derived cache**: FARM_KEY carries `imbewuShapeSyncView:{v:2}`. Unmarked content is raw v1 and is absorbed before it
  is overwritten (§1 of MIGRATION-AND-RECOVERY).
* **Pass 3 — fallback carry**: the derived view is written in one `setItem` together with `carry`, the typed ops it shows
  that have no journal row. Start, refresh and flush re-ingest them; storage recovery gives them rows again. They stay
  `volatile` (no false durable success). Once-volatile ops (`fb`) never get an ack row, so they are never pruned
  (*review control 3*, *pass3 G1* ×6).
* **Pass 3 — size**: the whole document is bounded in UTF-8 bytes (`shapeDocFits`); over budget → `too-large` block,
  no truncation; a new local op re-evaluates (*review control 4*, *pass3 G2* ×5).
* **Pass 3 — import deletion identity**: pruning an import tombstone leaves `deletedImports[shapeId]` forever; re-import
  of that id is a no-op (*review control 5*, *pass3 G3* ×5).

## 8. Fencing and fail-closed states

| Condition | Behaviour |
|---|---|
| remote `protocol > 2` | `blocked:'protocol-newer'`, never written by this client |
| unparsable / invalid state / envelope mismatch | `blocked:'remote-corrupt'`, never overwritten |
| doc vanished after this device knew a store | `blocked:'remote-missing'` — no silent genesis |
| different `storeId` | `blocked:'store-replaced'` — not silently adopted |
| state > 900 000 chars | `blocked:'too-large'` |
| v1 client | can't touch `shapes_v2`; its `shapes` writes are bridged read-only (§6). Its OWN cache is not protected while the island exists (PASS2 §3, A1) |
| sample / signed-out | `transport=null`; `db()` also null in sample → nothing leaves |
| account switch | keys bound at creation; every write and transaction step re-checks `isCurrent()` (mounted uid **and** Firebase user); late resolutions write nothing |

Every blocked state keeps the queue and offers `exportRecovery()` (Map: "Download backup").
Tests: *fencing…*, *late account callback…*, *sample / signed-out controllers…*, *listener reordering…*.

## 9. Presentation vs operation (Map.tsx)

The Mapbox Draw store is presentation. Remote paints (`draw.set`) run under `applyingRemoteRef`; teardown under
`tearingDownRef`; the adapter ignores Draw events in either. Draft lifts (reticle start), draft corners, Cancel, account
switch and unmount record **nothing**. Edit sessions (reticle, native, name sheet) capture their basis when they **start**,
because Map.tsx defers remote repaints for the session's duration. Tests: adapter suite (9) + mutations M6–M8.
