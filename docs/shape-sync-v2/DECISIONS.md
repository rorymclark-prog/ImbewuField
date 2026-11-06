# Architecture decisions — taken, and still open

## Taken in this package (reviewable, each has a test)

| # | Decision | Rationale |
|---|---|---|
| T1 | Identity = `Feature.id`; new shapes `shp-<uuid>`; v1 Draw ids kept | Continuity of the draw store; no geometry-derived identity |
| T2 | Per-field `{rev, op}` stamps + `deps` | Disjoint edits merge; real overlaps branch; no clocks |
| T3 | Server-side apply inside one transaction on one doc (`data/shapes_v2`) | Works under the existing rule; retries re-apply ops, never snapshots |
| T4 | Whole-op atomic branches (no partial apply of a clashing op) | The farmer chooses between two coherent versions, not a field salad |
| T5 | Tombstones keep content; delete-vs-edit and edit-after-delete both branch | No silent discard in either arrival order |
| T6 | `edit-after-delete` shape is **off** the map but listed; `delete-vs-edit` shape stays **on** | Head follows the first commit; the other side is always listed. Asymmetry is visible, not lossy |
| T7 | v1 island is read-only to v2; bridge never deletes | Omission in a v1 snapshot is exactly the v1 bug; duplicates over loss |
| T8 | Retention is ack-bounded; time only decides device liveness | Long-offline devices get holds, never resurrection |
| T9 | Share import is additive under deterministic ids | v1 replaced the farmer's store; re-open is idempotent; deleted imports stay deleted |
| T10 | FARM_KEY becomes a derived, write-only cache of the v2 view | Every existing reader keeps working with zero changes |
| T11 | Sample & signed-out → local-only controller (`transport=null`) | Same namespaces as v1; nothing can leave |
| T12 | `pushShapes` body unchanged, `@deprecated`, uncalled | Keeps the original TODO test as the old-source red control |
| T13 | Legacy v1 shape path kept behind `!handlers.shapeSync` | Existing isolation tests stay meaningful; rollback build path |

## Open — need an owner decision before release

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Conflict UI | (a) minimal tray as proposed in Map.tsx; (b) map preview of both versions; (c) facilitator/admin resolution | (a) for release, (b) next. Copy and placement need a design pass + translations (G9) |
| D2 | Scale ceiling | single doc (≈ 900 KB of JSON) vs per-shape docs / op log in a subcollection | Measure real farms first (G10). Switch only if p99 state > 300 KB; that needs rules for a subcollection |
| D3 | Legacy divergence noise | conservative (branch whenever v1 and v2 both touched a shape) vs store last island content to compute the v1 client's true diff | Conservative now; revisit only if the bridge stays open long |
| D4 | Forced update for v1 clients | banner / hard block / service-worker update | Needed before R2′/drain (G8, G13). Product decision |
| D5 | Activity window numbers (400 d active, 800 d forget) | any | Liveness only — safe at any value; choose for storage, not correctness |
| D6 | Op coalescing for long native drags offline | none (now) / merge un-sent same-shape updates | Measure queue size in the browser gate; add only if needed |
| D7 | Recovery re-import | none (now) / "restore from backup file" importer | Needed only if support asks; it must go through `import`/`resolve` ops, never a raw write |
| D8 | Guest → account carry-over of drawings | v1 behaviour unknown (auth.tsx not in packet) | Decide after reading `lib/auth.tsx` (G12) |
| D9 | Rename vs Cancel during a reticle edit | rename persists (proposed) / rename is discarded with Cancel | Persist: the name sheet has its own Save; Cancel abandons geometry |
| D10 | `pushShapes` removal | keep deprecated / delete | Delete after `git grep pushShapes` is empty and the TODO test is re-pointed (G7) |
| D11 | Island drain (pass 2) | off (shipped) / on with R2′ | Off until G13. Draining protects un-updated devices on reopen only together with R2′, and pauses all their sync until they update |
| D12 | Multi-tab coordination (pass 2) | per-op journal + revalidation (chosen) / Web Locks leader election / BroadcastChannel | Journal: works without any cross-tab API and survives tab death. Web Locks could later cut duplicate flushes; it is an efficiency layer, not needed for correctness |
| D14 | Fallback when journal rows cannot be written (pass 3) | none (pass 2) / separate key family / carry inside the FARM_KEY value (chosen) | Carry: atomic with the view it explains, so the cache can never show a change it cannot reproduce. A separate key could succeed or fail independently of the view |
| D15 | Share-import deletion identity (pass 3) | keep tombstones forever / compact id → seq map (chosen) / TTL | Compact map: about 40 bytes per deleted import, never pruned, counted in the byte budget (blocks + export when full). No TTL, no LWW. Re-importing a deleted shared shape on purpose would need an explicit restore action (not built) |
| D13 | Cap on open conflicts per shape (pass 2) | defer (chosen) / reject / unlimited | Defer: nothing is dropped, the doc stays bounded, the farmer sees "waiting until you decide" |
