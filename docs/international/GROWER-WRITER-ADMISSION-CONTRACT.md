# Canonical crop-book writer admission

This is an opt-in admission boundary for the parent crop-planner writers in
`app/facilitator/crops/page.tsx`. It does not enable grower acceptance. The existing
global storage projection remains the authority; shared sample-token serialization
now rejects unsafe objects before evaluating their fields. Ordinary safe global
`saveCropPlan`/`saveCropPlanWithReceipt` storage behavior remains unchanged.

A non-null write token proves a stable stored revision, not a lossless display.
The reproduced failure was a raw book containing a null row and an existing
reservation: the legacy display loader caught its row error and returned an
empty plan, which the old autosave wrote over the original nonempty book. Adding
a new row to that empty display did not restore the lost evidence.

## One display projection, one write projection

`loadCropPlanWithWriteAdmission()` returns `{book,token,admission}`. It reads the
actual detached raw receipt and uses the same private display projection as
`loadCropPlan()`, with one captured settlement instant. The ordinary loader's
existing behavior is retained. The raw reader's descriptor-safe copy authority is
also shared; getters and unsupported data are never evaluated to obtain approval.

An admission is explicitly `ready` with source `present` or `absent`, or `held`
with generic reasons. Ready admissions have private WeakMap provenance binding
the actual mounted owner, sample state, exact raw token and loaded-book key.
Reconstructing a ready-shaped object, changing an old base key, or replacing its
token with a fresh storage token cannot recreate that provenance. Tokens and
loaded-book keys contain private data and must remain inside the controller;
they are not UI labels, diagnostics, analytics or public receipts.

`cropPlanWriteAdmissionMatches(admission,loadedBaseKey,token)` verifies the
original load binding and current mounted owner/sample state. It deliberately
does not treat the current storage revision as a new original base: scoped
writers may independently validate a fresh lossless book to preserve unrelated
newer namespaces. Actual Firebase identity and final raw-token/base checks remain
mandatory in the parent before any read/write authorization.

## Lossless versus legitimately settled

For a present book, its full raw envelope must have version 1 and a planting
array. Admission compares the entire displayed representation with the raw book
after only the existing `preservePlantingMarker`/`settleOnceRows` authority has
run at the captured load instant. Arrays, row occurrences and values remain
exact; object property spelling order is immaterial. The comparison includes
unknown metadata and all namespaces, not just rows or the selected bed.

A null row that empties the display, dropped unknown metadata, discarded profile
claims, invalid note data, or any other lossy normalization holds the original
write base. A displayed nonempty plan can be lossy too. No automatic salvage,
repair, deletion or clearing is authorized. Held books need explicit data review
or a later supported migration; the UI must not pretend all old invalid metadata
can be edited safely today.

Malformed/duplicate records that the established display projection retains
unchanged remain preserved; admission is not agronomic validation or permission
to use them operationally. Existing own-cycle markers and canonical nursery
`heldInputs` remain evidence, including foreign claims and duplicate occurrences.
Other operational/projector guards still hold those records as appropriate.

Existing one-time lifecycle settlement is admitted exactly as the shared
settlement authority defines it. In particular, an unconfirmed past sowing stays
unconfirmed and becomes awaiting confirmation; this change adds no rule that
infers a crop was planted from time passing.

A genuinely absent stable book is separately admitted for new creation. An empty
but present canonical book is not absence. Empty strings, unreadable JSON,
incompatible envelopes and changed/unavailable storage are held, even if the
ordinary display loader would offer an empty plan.

## Parent writers and successful receipts

The original loaded base stores admission alongside owner/sample, token and
loaded-plan key. Debounced autosave, growing-profile saves, workspace-reference
saves and scoped target/nursery saves all require that original admission. Dirty
local edits cannot be blessed by an unrelated fresh read.

A scoped rebase also requires its own fresh admitted load and exact fresh token.
The existing selected-namespace comparisons still reject concurrent edits in the
same scope while preserving newer valid foreign namespaces. A newly lossy raw
book holds the rebase instead of being reconstructed from normalized fragments.
Stable absence does not use a generated empty-display timestamp to invent a
newer competing book.

`cropPlanWriteCandidateIsLossless(candidate,prepared?)` checks descriptor-safe
candidate data against both optional caller normalization and the actual existing
storage projection. Profile/reference preparation, target/nursery normalization
and final whole-book writes cannot silently drop newly supplied metadata.
Harmless optional undefined JSON fields and the exact existing durable invalid
marker representation retain their established semantics. Unsafe functions,
accessors, sparse arrays and non-JSON data do not grant write permission.
The sample raw receipt, every current sample token read, and the sample writer
receipt share one descriptor-safe snapshot authority before exact JSON projection.
An unsafe replacement after a safe load cannot hide behind a getter returning
undefined or a function omitted by ordinary JSON. No raw-reader/token recursion
is used. Ordinary manual rows with optional undefined object properties remain
usable. Null, malformed and duplicate array entries remain evidence; undefined
array entries still hold. Ordinary safe sample token bytes are unchanged.

All existing actual-actor, sample, raw-token and loaded-base identity checks remain
before and after fresh work and immediately before the actual writer. Only its
exact successful receipt may become a new bound base. If another writer replaces
the book during the synchronous save event, a subsequent fresh read with a
different token cannot bless the just-saved UI state. Further writes hold visibly.
A failed storage write leaves the original admitted base and data intact.

Undo history is privately bound to owner/sample and the selected planning source.
It restores only the shown legacy planting subset, preserving current unrelated
metadata, own-cycle rows and foreign-bed rows. Both catalogue suggestion acceptance
paths additionally stage detached exact pre/post groups for rainPattern, planNotes
and planNotesAt, including each property's presence. A single captured timestamp
belongs to that actual action. A private WeakMap keyed by the returned plan and
the real plan-commit effect grant history once only after the action commits;
guarded, empty, duplicate-only target or abandoned updates grant nothing. Updater
and effect replay cannot duplicate the grant.

When undoing that action, its prior metadata group is restored only if the current
group still matches the exact authored post-action group. Removing a suggestion
therefore removes its explanations and date or restores the prior group. A newer
independent group survives intact, as do all unrelated namespaces. No stale full
metadata snapshot is copied back. A changed source, ambiguous identity, lossy
loaded base or unprovable/non-planting history change holds rather than silently
rolling back newer facts. Undo still passes the normal admitted candidate/autosave
boundary; it is not a second write channel.

## Verification boundary

`tests/international-grower-writer-admission.test.ts` executes the actual parent
mount, autosave and writer/undo function bodies with real in-memory raw/load/save
and admission authorities. External UI startup, Firebase identity and state/timer
boundaries alone are controlled. Tests reproduce the original destructive case,
nonempty lossy displays, fresh-token/forged-admission negatives, stable creation,
exact settlement, duplicates/own markers/held nursery evidence, foreign-preserving
rebases, candidate loss, stale actor/base/token, save-event overwrite and scoped
undo, safe-load/unsafe-sample replacement, both actual suggestion accept handlers,
and abandoned/replayed action commits. No real user storage, provider call or
grower acceptance UI is used.
