# Shape sync v2 — isolated implementation package

**Status: prototype proven in isolation; production defect NOT yet fixed.** See GATES.md for what remains.

## The problem (confirmed in the frozen source)

1. `pushShapes` blind-`setDoc`s a device's whole draw store (AUDIT A1/B4). A stale device erases others' shapes.
2. Startup reconcile overwrites the local cache with the remote copy before unpushed edits are sent (B2).
3. Two first devices both bootstrap with `setDoc`; the later one wins (B2).
4. **Rename during a reticle edit** pushes the store *without* the shape being edited — a remote delete (A9/A16).
5. **Opening a share link replaces the farmer's own shapes** in the store and, via recompute, in the cloud (A20).
6. Reticle Done **and Cancel** change the shape's id and drop unknown properties and inner rings (A10/A11).

## The design in one paragraph

Shapes keep a stable id (`Feature.id`). Every farmer action becomes one typed operation (create / update with
`baseRev`+`deps`+field patch / delete / resolve / legacy / import) persisted write-ahead in an account-scoped queue. A
flush is one Firestore transaction on `data/shapes_v2`: read the latest state, apply the queued ops with a pure
deterministic function, write. Per-field `{rev, op}` stamps let disjoint edits merge and turn genuine overlaps (and
delete-vs-edit in either order) into preserved conflict branches the farmer resolves on the map. Deletes are tombstones;
retention is bounded by acks, not a TTL; a long-offline device gets a hold, never a resurrection. The v1 document becomes a
read-only "island" bridged in without ever inferring deletes. FARM_KEY becomes a derived cache so every existing reader
keeps working. Sample and signed-out sessions run local-only.

## Read in this order

1. `AUDIT.md` — every writer/path/listener in the packet, with base line ranges, v1 effect, defect, v2 replacement
2. `CONTRACT.md` — the executable contract and which test proves each rule
3. `MIGRATION-AND-RECOVERY.md` — migration, fencing, crash/ack, listener latency, auth/sample, rollback, export
4. `INTEGRATION.md` — patch set, Map.tsx wiring, exact remaining steps
5. `DECISIONS.md` — decisions taken and still open
6. `RULES-PROPOSAL.md` — rules changes, proposal only (separate gate)
7. `GATES.md` — what must pass before anyone may call this fixed
8. `VERIFICATION.md` — what was checked here, at which level
9. `PASS2.md` — **second adversarial pass**: loss paths found in the first package, the fixes, the old-client
   characterisation, the rollback contract, the exact change map
10. `PASS3.md` — **third pass**: the three review gaps (fallback carry, UTF-8 byte bound, share-import deletion identity)

## The original TODO test

`tests/shape-sync-loss.test.ts` is **unchanged** and still `todo`/red in the proposed tree — it exercises v1
`pushShapes`, whose body is unchanged. `tests/shape-sync-v2-loss.test.ts` runs the same ordering through v2 and passes.
GATES G7 states exactly what must be integrated before the original may be re-pointed and un-todo'd.
