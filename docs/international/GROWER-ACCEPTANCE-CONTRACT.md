# Pure grower proposal acceptance preparation

`prepareGrowerWorkflowAcceptance` in `lib/international/grower-workflow.ts` prepares
canonical dated rows and a detached whole crop book. It performs no storage,
network, account, sample-mode or UI work, and does not enable acceptance. A
`prepared` result is not a save receipt or permission to write. Relevant canonical
consumers must be migrated and verified before a controller exposes acceptance.

## Input and controller boundary

The input is `{review,binding,scope,source,book,acceptedAt,plantingIds}`:

- `review` is the exact complete `status: 'review'` value shown to the grower.
- `binding` is `{source,draft,recordedAt}` from that review's private controller
  identity, not a binding reconstructed from a displayed fingerprint.
- `scope`, `source` and `book` are freshly read current context and the entire
  canonical book. The source must be ready and exactly match the bound source,
  including source kind/key/ID, target-resource namespace, revision, geometry,
  measured beds and source-held beds. Array order remains significant.
- `acceptedAt` is an explicit canonical UTC timestamp at or after `recordedAt`.
  This module never calls a clock.
- `plantingIds` maps every proposed `{cycleId,plantingId}` exactly once. The caller
  supplies persistent IDs: nonblank, unpadded, no control characters, at most the
  existing cycle creator's 200-character limit. Review-local ordinals never
  become persistent row IDs automatically.

The controller must establish the original review's actual private binding,
actual Firebase/mounted-account ownership, sample restrictions and source/book
raw receipts. It must recheck after every asynchronous boundary and immediately
before its real writer, then verify the writer's actual receipt. This pure API
has no account identity input and cannot prove any of those checks. Unrelated
fresh book metadata can be preserved/rebased here; only the controller can reject
an externally changed raw book receipt or unresolved local edits.

## Fresh recomputation and all-or-nothing rows

Preparation reruns the actual existing `assembleGrowerWorkflowReview` using the
fresh whole book, fresh source and original bound draft/review timestamp. The
entire resulting review must equal the original: request, actual proposal and
cycles, target metadata, issues, blocked beds and existing-cycle diagnostics.
Object property spelling order is irrelevant; array order and all values are
exact. An identical claimed fingerprint alone grants nothing.

Only a ready complete proposal with covered/zero-demand results and no unmet
capacity or issues can proceed. Partial, missing, invalid and work-limit results
are held. A proposal with no cycles is explicitly held as `no-proposed-cycles`;
it cannot produce a misleading empty saved result. No selected-cycle subset is
accepted. Selecting fewer rows requires a new properly recalculated review.

Whole-book planting identity duplication is checked before scope filtering. New
persistent IDs must be unique across the entire book, including foreign sites,
and across all new rows. Existing reservations, legacy occupancy and held rows
are rechecked by the existing assembler; a prior free-land assertion cannot
override a new occupancy conflict or malformed foreign association.

Each new row is built only by `createGrowerCyclePlanting`, preserving the existing
own-input assessment and date arithmetic. Its canonical `harvestTargetId` is the
cycle's actual demand ID; its attachment retains explicit `acceptedAt`, scope,
geometry and assessment. These are dated capacity proposals, not planted/finished
lifecycle observations or buyer delivery promises. No catalogue timing or species
is added or inferred.

## Preservation, replay and result

`prepared` returns `{status:'prepared',book,rows}` with all rows, or `held` returns
only `{status:'held',reasons}`. New rows append in proposal order. Only `plantings`
and `updatedAt` change in the returned book; `updatedAt` derives from explicit
`acceptedAt`. Every pre-existing row, metadata key/order, group, foreign namespace,
profile, target and JSON-safe held nursery record remains intact. There is no
sanitizer or default substitution. Non-JSON-safe data, accessors, sparse arrays,
cycles or unsupported prototypes are held rather than silently serialized away.
Inputs are detached before assembly/output freezing; caller data is never frozen
or mutated.

A currently intact accepted row with the same scope, geometry, bed, demand,
review-local cycle ordinal and actual dated assessment fingerprint explicitly
holds replay as `proposal-already-recorded`, including partially recorded
proposals. Ordinals alone are insufficient because a later review reuses them.
Fresh occupancy and whole-review recomputation independently constrain replay.
This is not a permanent acceptance ledger: attachments do not store a proposal
fingerprint, and deleted rows cannot establish historical replay. No idempotent
success, silent overwrite, deleted-row history or persistent replay token is
claimed.

`tests/international-grower-acceptance.test.ts` exercises actual source inspection,
review assembly, proposal arithmetic and canonical cycle resolution; only
synthetic engineering fixtures are used. It covers tampered review/diagnostics,
source movement at equal area, revision/namespace/scope changes, fresh occupancy,
foreign duplicates, full ID mapping, replay, proposal completeness and lossless
whole-book preservation. Actual auth and write-race verification belongs to the
controller tests, not these pure data checks.

## Device writer and mounted UI

The child acceptance integration adds an actual local save action to
`useGrowerWorkflow`, `GrowerAutoPlanPanel` and the parent crop page. Production
release still requires the separate Finance whole-book consumer prerequisite and
coordinator release checks. The pure preparation API above remains unchanged.

The hook accepts the exact original review object. Its private WeakMap also
captures the original parent actor callback and selection/resource context. That
callback closes over the original expected owner, sample state and scope; a later
account with identical saved content cannot inherit the review. Both original and
live actors are checked around every asynchronous source read. A displayed-review
callback supplies additional revocation when controls change or the panel
unmounts; an explicit hook mount guard also revokes retained callbacks after
unmount. Neither can grant authority to a copied or unbound review.
The visible checked source separately retains the immutable actor/selection
context that established it. Actual context invalidation exposes a null source
synchronously during render, without state writes or adopting a later actor.
Unrelated renders and new inline callback identities do not revoke a still-current
source. The old account's source measurements cannot remain disclosed under an
identical selection in a later account.

Current local sources are reread through the existing raw source receipts around
hashing and immediately before the write. Receipt owner/sample/revision must stay
exact. A changed source discovered by acceptance also withdraws the cached checked
source, even without a browser change event. Cloud sources use a new current fetch and verify the fetched snapshot and
actor/context again. This is not a remote compare-and-swap lock, and a last cloud
fetch is not a guarantee that a remote design cannot subsequently change.

The parent raw-book receipt supplies a private currentness closure bound to its
actual loaded base identity. Acceptance requires that closure as well as stable
before/after raw tokens. The hook allocates all persistent IDs, then supplies only
the original data binding, freshly checked source, expected book token, explicit
acceptance time, full ID mapping and a revocation guard to the synchronous parent
writer. Functions are never passed into the pure helper's JSON-only input.

The parent independently checks actual actor/sample/source resource scope,
original loaded admission, unchanged local display/base identity and fresh raw
whole-book admission. It runs the existing pure preparation against the current
raw book and scope, checks candidate losslessness, then rechecks those authorities
and the source guard immediately before one `saveCropPlanWithReceipt` call. There
is no per-cycle write, selected-row subset, automatic retry or normalization into
an empty book. Whole-book ID collisions and replay remain explicit holds.

Only the exact successful writer token can confirm a new base. Confirmation
loads the actual admitted display and installs its bound admission: legitimate
old once-row settlement can differ from the preserved raw input, without being
mistaken for a conflicting or newly observed sowing. Admitted nursery-only saves
can retain a current proposal while preserving newer unrelated namespaces. Dirty
or lossy loaded books and unresolved external revisions remain held.

Results distinguish `confirmed`, `failed`, `held` and `superseded`. A confirmed
receipt reports the saved cycle count and actual device/sample destination.
Storage refusal retains the review and old base for a fully rechecked manual
retry. If the write succeeds but its token is replaced or cannot be confirmed,
the UI reports an unconfirmed completed write, holds further writes and does not
invite repetition. Confirmed/superseded attempts consume the original review
binding. Own book events invalidate the proposal but do not erase its real save
receipt or turn it into a retryable hold.
Later draft edits hide the prior save claim; a later held external-book event
clears only confirmed status, while retaining an unconfirmed completed-write
outcome. A previous success cannot label a new draft as already saved.

The panel offers saving only for nonempty complete ready proposals and saves all
cycles. Pending clicks are serialized. A successful message explicitly separates
planned estimates from observed sowing, harvest, stock and sales, and does not
claim nursery resources are available. Sample receipts are labelled DEMO and
remain isolated from the real account. Raw tokens, source hashes and persistent
IDs are not displayed.

`tests/international-grower-acceptance-controller.test.ts` mounts the actual hook
and panel and executes the parent's actual mount/read/writer handlers. Real raw
readers, source hashing, assembly, preparation, admission and receipt writers run
against bounded memory IO. Only authentication/cloud transport, React state and
ID/failure/race boundaries are controlled. It covers full saves and duplicate
clicks; copied/tampered identities and all-book ID collisions; incomplete engine
results; old-versus-new actor binding; changed/dismissed/unmounted reviews;
source/base/token/actor changes at the final boundary; external occupation;
failed writes and manual retry; save-event overwrite; safe sample saves and
unsafe sample replacement/exit; legacy settlement; admitted nursery rebasing;
and late cloud replies across account/sample/selection/source transitions.
