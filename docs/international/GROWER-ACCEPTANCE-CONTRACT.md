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
