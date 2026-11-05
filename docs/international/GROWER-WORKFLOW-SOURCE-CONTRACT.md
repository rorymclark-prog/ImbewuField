# Saved-source geometry authority

`readCanvasSourceReceipt(siteId)` and `readFacilitatorSourceReceipt()` read exact
raw authored data at their existing storage authorities. They use the active
account/sample namespace, check it again after reading, and return held on missing,
unreadable or invalid JSON. They write nothing and do not normalize/deduplicate.
Receipts contain private raw revision material; never persist or log it.

`inspectGrowerWorkflowSource({kind,sourceId,raw,sourceRevision})` is pure. Studio
uses the exact canonical site ID and saved canvas. Local facilitator uses requested
`sourceId:'local'` and its raw saved design; a persisted stable design ID is retained.
Cloud facilitator requires the actual selected document's `id`, `owner_id`, `data`,
not the page helper that synthesizes save time and omits geometry metadata. Cloud
retrieval and account authorization belong to the parent; this module fetches nothing.

Inspection returns held or detached/frozen `inspected` data. Duplicate IDs across
all authored geometry arrays, malformed geometry/calibration and rows that a legacy
normalizer would discard cannot acquire readiness. Missing bed dimensions are
explicitly excluded in `heldBeds`, never borrowed from element defaults or a one-metre
fallback. Eligible beds use positive explicitly saved dimensions; traced open fields
use the existing calibrated polygon/area bridge. Field-block parent outlines filled
with child beds are not counted again. An empty eligible-bed list remains honest;
it supplies no area or positive capacity. A saved design area is a grower/source
claim, not an independently checked measurement or layout-clearance certification.
Authored request/source records must be plain data objects. Getters and inherited
geometry are rejected before reading them, so validation and fingerprinting cannot
observe different values from a changing accessor.

`fingerprintGrowerWorkflowSource(inspection)` uses WebCrypto SHA-256 and holds if
secure hashing is unavailable. Geometry is detached synchronously before awaiting.
`geometryFingerprint` binds source kind/identity, full authored geometry, frame/metre
calibration and eligible metrics. Equal-area moves, rotations, paths, polygon rings
and field-block configurations invalidate it. Navigation, save counters and image
bytes/URLs do not become geometry identity. `sourceRevision` separately hashes the
exact supplied raw receipt; a navigation-only save may change that review revision
without invalidating an accepted cycle's geometric basis.

Ready `GrowerWorkflowSource` includes `status`, `kind`, `sourceId`, `sourceKey`,
exact derived `scope`, `geometryFingerprint`, hashed `sourceRevision`, `beds`,
`measuredAreas` (bed ID, area, explicit-dimensions/calibrated-polygon basis),
`heldBeds`, `freshness` and `sourceVerification:'not-verified'`. No provenance
timestamp or country approval is fabricated. Device/cloud freshness labels identify
the source kind; they do not claim a server refresh occurred. The parent must still
check account/sample/source epoch and re-read its receipt after every async operation.

`resourceSiteId` preserves the existing resource namespace: Studio uses its site;
selected cloud facilitator designs use `design:<document ID>` even when their
planning scope is mapped; local facilitator uses mapped scope's site or `design:local`
when unmapped, even if its stable workspace ID differs. No equipment is moved or
borrowed. `growerWorkflowResourceSiteId(source)` validates this metadata binding
through this single authority and returns null on disagreement. Consumers additionally
match current source scope, geometry and measured-bed set; the helper is not
authentication of an arbitrary imported DTO.

This authority changes no saved geometry, legacy loader behaviour, persistent
ledger, remote sync, country policy, source timestamp, crop data or app UI.
