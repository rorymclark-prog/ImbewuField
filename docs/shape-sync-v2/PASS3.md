# Shape sync v2 — third pass: the three review gaps

**Status: prototype proven in isolation; the production defect is still NOT fixed.** Only sandbox copies were touched.
No repo, real data, rules, config or deployment was involved. The first package (`e007c180…`) and pass 2 (`85a507ad…`)
are untouched and were used only as controls. `tests/shape-sync-loss.test.ts` is byte-identical to the frozen base and is
still `todo`/red.

## Review controls — the attached file, byte-identical (sha256 `c4b48d1a…4fb2`)

It is shipped as `tests/shape-sync-v2-review-controls.test.ts`, and the same bytes were run inside staged copies of each tree.

| Control | First | Pass 2 | Pass 3 |
|---|---|---|---|
| 1 two offline same-account tabs survive restart | ✗ | ✓ | ✓ |
| 2 failed backup/quarantine leaves the raw cache recoverable | ✗ | ✓ | ✓ |
| 3 failed journal write, surviving FARM_KEY: recoverable after restart | ✗ | ✗ | ✓ |
| 4 remote document within Firestore's byte ceiling | ✗ | ✗ | ✓ (blocked) |
| 5 deleted share import not resurrected after bridge retirement + compaction | ✗ | ✗ | ✓ |
| **total** | **0/5** | **2/5** | **5/5** |

## Gap 1 — the derived cache held the only copy and start discarded it

**Cause (pass 2).** The journal-row write failed, so the op stayed volatile, but the next FARM_KEY write still succeeded and
stored a marked derived view containing the new shape. On restart, a marked cache counts as disposable. It was rebuilt
from state + journal (both without the op) and the shape was gone. The export no longer had it either.

**Fix — one invariant.** The derived view is written in the **same `setItem`** as every typed op it shows that has no
journal row (`imbewuShapeSyncView.carry`). So a successful write always carries its intent. If the write fails, the
previous value stays, and that value is consistent with its own carry. A view without its intent can no longer be written.

* `loadPending()` (start, refresh, flush) ingests carried entries as volatile, unless a valid journal row or the confirmed
  state already holds them.
* `retryVolatile()` gives them their own rows again once storage recovers.
* Ops are carried **typed** (create, update, delete, …, with their `lc` order). A delete is never inferred from a snapshot.
* Not a false success: `create()` still returns `{ok:true, durable:false}`, status stays `durability:'volatile'`, and the
  notice is still `error` with Download backup. The text says the change exists only in a fallback copy
  (`status.fallbackHeld` = `status.volatileOps`).
* All writes failing stays the explicit honest limit: no fallback is claimed, and the export has the geometry before close.
* Another tab rewriting FARM_KEY ingests the carry first, so it keeps this tab's carried op.
* **Once-volatile ops are never ack-pruned (`fb: 1`, no ack row).** A copy may still sit in another tab's memory, so a late
  replay stays a harmless `duplicate`. This replaces pass 2's in-memory acks for volatile ops, which were safe only while
  volatile ops were tab-private.

**Limits (stated, not fixed).**
* localStorage gives no cross-tab atomicity, so two tabs rewriting FARM_KEY at the same instant can drop the other's
  carry. The originating tab still holds the op in memory and re-carries it on its next write; the journal rows remain the
  primary multi-tab mechanism. Gate G14.
* An old (v1) tab overwriting FARM_KEY destroys the carry. Its features are then absorbed as raw v1, but carried
  updates/deletes are not recovered once the v2 tab is also closed.
* If only the confirmed-state cache write fails, an offline restart shows less until the server state arrives. No data is
  lost: the server holds it.

## Gap 2 — size bound counted UTF-16 code units

**Cause.** `stateJson.length > 900_000` compared code units. 400,000 Han characters is 400,000 units but about 1.2 MB of
UTF-8. 260,000 astral characters is 520,000 units and 1,040,000 bytes.

**Fix.** These follow the official quotas and storage-size pages (checked this pass):

| Term | Value |
|---|---|
| Firestore document limit | ≤ 1,048,576 bytes |
| Firestore field limit | ≤ 1,048,487 bytes |
| string size | UTF-8 bytes + 1 |
| int / timestamp | 8 bytes |
| document name | each path segment + 16 |
| per document | + 32 |
| `utf8ByteLength()` | exact, no allocation; a lone surrogate counts 3 (U+FFFD) |
| `shapeDocBytes(doc)` | estimates the whole document: our 6 fields, plus a name bound for a uid of ≤ 128 chars × 4 bytes |
| `SHAPE_DOC_BYTE_BUDGET` | limit − 16 KiB |
| `shapeDocFits()` | also checks the field limit |

Over the budget, the flush is **blocked** (`too-large`): nothing is written, nothing is truncated, and the journal and
`exportRecovery()` keep every op. A new local op clears the block for re-evaluation, so clearing an oversized note
unblocks it. Before this, `too-large` stayed set until reload. Test B5 checks the real transport writes exactly the
modelled fields. RULES-PROPOSAL R1's old cap of `stateJson.size() < 950000` could deny client-accepted ASCII-heavy
documents; it is aligned in this pass (a rule-side character cap ≤ bytes).

**Not shown here:** that Firestore accepts any particular document. A fake transport proves nothing about that (G3).
Also, a delete of a never-synced oversized shape still blocks, because tombstones keep content. The remedy is the export
plus a reviewed step.

## Gap 3 — deleted share imports came back after bridge retirement

**Cause.** The import id is deterministic: `importShapeId(code, sourceId, index)`. The only memory of a deleted import was
its tombstone and the op's dedupe entry. `pruneAcked` removes the entry and, once `legacyBridgeRetired`, `compactState`
removes the tombstone, so re-applying the import, or re-opening the link, re-created the shape.

**Fix.**
* `compactState` leaves a compact deletion identity, `state.deletedImports[shapeId] = deletedSeq`, whenever it prunes an
  import tombstone. It is never pruned.
* `applyOne('import')` returns a no-op (`imported earlier and deleted`) for those ids; `importShared` skips them
  client-side; the rollback plan never hands them back to v1.
* The field is validated and fails closed if malformed. It is optional and round-trips; older documents without it parse
  unchanged.
* Growth counts toward the byte budget, so it **blocks with an export**; nothing is silently forgotten. There is no TTL
  and no LWW.
* New features in the same share, and the same feature in a *different* share, are still genuine new imports.
* Legacy (v1) identity was already kept in `state.legacy` and is unchanged. Old-client drain and rollback cautions from
  PASS2 §3–4 are unchanged.

## Exact change map (pass 2 → pass 3, pass-3 line numbers; patches 0201–0204 are authoritative)

| File | Lines | Change | Gap |
|---|---|---|---|
| `lib/shape-sync/protocol.ts` | 36–52 | `FIRESTORE_MAX_DOC_BYTES`, `FIRESTORE_MAX_FIELD_BYTES`, `SHAPE_DOC_BYTE_BUDGET`, `SHAPE_DOC_NAME_BYTES_BOUND` (replace `MAX_STATE_JSON_CHARS`) | 2 |
| | 303–307 | `ShapeStoreState.deletedImports?` | 3 |
| | 367–370 | `validateState` checks it | 3 |
| | 390–421 | `utf8ByteLength`, `shapeDocBytes`, `shapeDocFits` | 2 |
| | 619–620 | import no-op for a deleted identity | 3 |
| | 973–998 | retention doc + `compactState` keeps identity on prune | 3 |
| | 1020 | rollback materialisation skips deleted imports | 3 |
| `lib/shape-sync/controller.ts` | 31 | import `shapeDocFits` | 2 |
| | 128–136 | status `fallbackHeld`, `volatileOps` | 1 |
| | 199–207 | `JournalEntry.fb` | 1 |
| | 249–256 | `carriedIds` (pass-2 `memoryAcks` removed) | 1 |
| | 326–347 | `loadPending`: valid rows, carry ingestion, row supersedes volatile | 1 |
| | 361, 381–390 | volatile → `fb`; `ackRecorded` never acks `fb` | 1 |
| | 462–505 | `writeFarmCache` with carry; `readCarry`; `retryVolatile` | 1 |
| | 525–529 | status fields | 1 |
| | 565–570 | `enqueue`: retry; clear `too-large` | 1, 2 |
| | 600–604, 630–633 | start / refresh retry | 1 |
| | 691–694 | `importShared` skips deleted identities | 3 |
| | 735–741 | flush retry; ack ids only from ack rows | 1 |
| | 790–795 | byte bound | 2 |
| | 868–876 | notice: fallback wording, still `error` | 1 |

`user-sync.ts`, `Map.tsx`, `draw-adapter.ts` and `farm-geometry.ts` are unchanged from pass 2.

**Tests.**
* New: `review-controls` (the attachment, 5) and `pass3` (16).
* Added: old-client B5, the transport field set.
* Two prior assertions changed deliberately, with the reason in the file:
  * controller *failed local persistence*: its "honest limit" asserted that the review's selective-failure op is **gone**
    after reload, which was the bug. It now asserts the op is recovered, and moves the honest limit to `failAll`;
  * pass2 notice matrix: the status literal gains the two new fields, plus a fallback-held row that must not read as ok.
* All other prior tests are unchanged.

## Observed (logs/)

| Check | Result |
|---|---|
| Review controls | 0/5 · 2/5 · 5/5 |
| All 11 v2 suites on pass 3 | 114/114 |
| Existing 7 suites | identical to base; TODO intact |
| `tsc --strict` | modules, user-sync, every v2 test file |
| Mutations | 31/31 caught (21 prior + 10 new P1–P10) |
| Patches | apply and reproduce the tree byte-for-byte |

Node 24, real-dependency Map types, emulator, browser and rules are **not** claimed: see GATES.md.
