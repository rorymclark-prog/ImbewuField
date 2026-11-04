# Field layouts retain raw crop-allocation protection

The field editor and ordinary design/history paths previously built their
allocation set from `loadCropPlan().plantings`. An isolated memory probe with
the actual crop-book initializer, raw receipt, display loader and geometry engine
reproduced a loss of protection: a null row beside an allocated bed displayed as
an empty plan while retaining a ready raw receipt and token. The resulting empty
allocation set permitted that bed to be resized. No farmer storage was touched.

## Raw references and the actual write boundary

`lib/field-block-allocations.ts` reads the existing whole-book raw receipt.
Every readable bed reference is retained even when other crop fields or row
identities are invalid. Missing, unreadable or malformed references remain
unknown. The module adds no normalizer, saved ledger, site filter or default
crop claim.

An explicit field-layout replacement requires known references and still passes
the existing `configureFieldBlock` allocation check. Unknown books conservatively
protect all existing field parents and generated children during ordinary edits,
undo and redo. An unrelated house label or field-name edit can still proceed;
unknown references cannot masquerade as permission to rebuild field ground.

Capabilities bind the expected rendered owner, sample state and loading state to
the actual mounted identity, Firebase identity, raw receipt and current token.
Configured-but-unavailable authentication grants no guest authority. A real auth
object with no signed-in user, backend-unconfigured local work and isolated DEMO
work retain their distinct paths. A copied result grants no currentness.

The actual parent callbacks capture intent before queueing, read fresh authority
inside their functional updater, and recheck immediately before local design
persistence. A later crop revision, new allocation, account/sample change or
released/reacquired lease cannot become authority for the earlier edit. Held
actions do not consume history. A failed physical write remains unsaved and does
not publish a cloud candidate. Existing parent errors also reach the field form.

## Source and layout identity

The panel and parent share `fieldBlockSourceKey`. It binds the selected field,
canonical layout, polygon, saved calibration metadata, actual calibrated frame
and relevant exclusion footprints. It preserves array order while ignoring
object-key spelling order, generic revision/timestamp changes and image bytes.
The saved calibration basis uses existing `designBaseMode` and stored metadata;
there is no second metres-per-pixel formula.

Actual queued-parent regressions first failed for a changed saved scale factor,
photo scale and photo calibration while the live frame still held its preceding
value. The shared binding now holds those edits. Image URLs, upload timestamps,
opacity and paint-only alignment do not become a changed measurement basis.

The pure reconciliation guard now also protects occupied parent layout mode and
configuration, including legacy field polygons without layout metadata. A known
allocated child protects its parent too: changing that parent to open ground
while retaining the children would add a second planning area. An allocated
generated item's element type cannot change to a non-bed and remove its planner
capacity while retaining the same ID and dimensions. Separate pure-engine probes
reproduced both cases before their corrections. Ordinary names and unrelated
metadata remain editable.

## Verification and limits

Final ordered Node 24 typecheck passed, then **64/64 tests across three files**
passed: 24 new raw-authority/actual-parent cases, 31 existing bed-block cases and
nine existing design-bed bridge cases. The parent harness executes the real
Apply/edit/undo/redo callbacks and actual local canvas persistence; only React
scheduling/UI setters, Firebase/cloud transport and browser storage are
controlled. It covers original raw-null fallback, unknown references, allocation
arrival after preview, queued source/site/frame/saved-calibration changes, final
write-boundary revision changes, lease replacement, parent/child metadata and
type protection, real guest/DEMO distinctions, getter rejection and failed saves.

This is not a complete audit of every canvas operation, calibration workflow,
auth transition or cloud merge. It supplies no browser visual approval, regional
crop advice or production release claim. Coordinator integration, full required
checks, current-head CI and real desktop/phone review remain separate gates.
Canonical metres, `PLAN_VERSION`, species and calibrated lessons are unchanged
by this allocation repair. Engineering fixtures supply no farming dimensions or
recommendations.
