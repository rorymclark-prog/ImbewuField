# Crop-plan storage generation cutover

This replaces the active local crop-plan storage address. It does not change species, agronomic values, calibrated lessons, measured geometry, consent or cloud permissions. `PLAN_VERSION` is unchanged.

## Why a new generation is necessary

Released `8a12b3e` JavaScript can remain open or offline and write its known v1 key directly. Its actual loader drops later metadata. A new service worker or update banner cannot intercept that synchronous write. A compatibility waiting period cannot prove every suspended/offline client updated.

The new app has one canonical book at `imbewu_crop_plan_v2`, using the existing account namespace. `imbewu_crop_plan_v1` is legacy import/divergence evidence, not a second current ledger. New normal writes never update v1. Guest sign-in cleanup may remove the guest source only after an exact bound destination copy is verified; the frozen transfer provenance retains all source copies.

## Authority and exact evidence

`lib/crop-plan-storage.ts` owns the small browser persistence boundary, keys and Web Lock. It imports account context but no crop catalogue. `lib/crop-plan.ts` remains the sole crop-plan projection, lifecycle and write-admission authority.

The canonical envelope contains `storageVersion:2`, an opaque cutover identity and `bookRaw`, the exact authored JSON string. The separate immutable cutover receipt binds the canonical address/identity, original legacy bytes and imported book bytes. A guest transfer also retains its exact source canonical envelope, receipt and legacy bytes, including earlier explicit review evidence. These are frozen provenance, never continuously updated ledgers or timestamp-merged records.

Import does not settle rows or normalise JSON. Unknown fields, malformed rows, original property order and unsafe-number text survive. A readable outer version-1 book with a planting array can be copied losslessly; the existing crop-plan admission subsequently withholds writes if display projection would lose evidence. Corrupt JSON or an unrecognised outer book remains untouched and held.

All current global `saveCropPlan` callers now require the same raw-load admission and lossless candidate projection as the parent planner. Candidate descriptors are checked before spread/map/normalisation, so getters are not executed. A legitimate empty book, ordinary supported metadata edits and existing once-row settlement retain their meanings. A lossy source or candidate cannot be blessed by an unrelated save.

## Initialization and one editing tab

Initialization is explicit and asynchronous. Reads do not initialize storage. Before initialization, legacy evidence may be displayed but cannot be saved by the new writer. A cold second tab also displays its actual canonical rows and profiles through the existing projection authority while its admission stays held and its write token stays null. The read-only projection is bound to the captured account/sample/storage context before and after reading; it cannot borrow a later actor’s book. Unsafe sample objects never use this persistent fallback.

A real exclusive Web Lock is held for the current document/account lease. This preserves synchronous write receipts while excluding other cooperative current documents. A second tab is read-only until the editing lease is released and it explicitly retries. No check-then-set sequence is described as atomic compare-and-swap. These locks do not bind old v1 JavaScript or provide remote/cloud transactions.

Initialization is idempotent for the exact storage object, three scoped keys and still-current context. Pending requests are revoked by release generation; stale completions cannot remove newer pending state. Pagehide, account/sample changes and unmount release/revoke the lease. BFCache restoration must reacquire and revalidate. Missing Web Locks, unreadable sample authority or unavailable storage holds rather than silently switching to a real persistent namespace. Sample books remain in memory and do not acquire persistent leases.

The receipt is written and verified first, then canonical data is written and verified. A quota/context/source failure can therefore leave visible partial evidence. Initialization does not automatically overwrite it. Explicit recovery only resumes the exact frozen receipt when canonical storage is absent and its legacy baseline is unchanged. Missing or corrupt canonical data after cutover never causes automatic legacy reimport. An existing valid empty canonical book is authoritative.

Every acquired document lease has a volatile private identity. Raw/read/write tokens include the identity of the actual writing lease; it is never persisted in the book. Original loaded-base admission also holds an opaque proof of that exact lease. Release immediately invalidates the proof, and reacquisition cannot revive it even when saved bytes are identical. The private provenance matcher does not compare the current raw book: a legitimate same-lease external-namespace rebase still requires, and can use, its independently checked fresh admission and final token.

A completed synchronous writer returns the token for its own exact write and captured writing lease. A later source/actor change can prevent confirmation; it does not convert a performed write into a failed write inviting automatic retry.

## Older-session divergence and explicit recovery

The current legacy bytes must match the initial baseline or the last explicitly reviewed older copy. A difference, deletion or corruption withholds new writes while preserving canonical display evidence. It never automatically merges or adopts the older copy.

The user can request an opaque review of the exact current canonical and older copies. Raw saved-row counts are descriptive only: equal counts do not prove equal dates, quantities, nursery settings or metadata. The review can prepare a local download containing exact authored-book strings and retained import/transfer/review copies, without adding physical storage keys or cutover IDs. It uploads nothing.

After comparison and an explicit user decision, “keep current” leaves canonical `bookRaw`, v1 and the immutable initial receipt unchanged. It stores a detached acknowledgement containing the exact reviewed older and current copies. Subsequent normal writes retain that acknowledgement; another old-session change revokes it again. This does not assert that farming occurred, grant consent or stop old JavaScript. It retains the current/reviewed copies, not an unlimited permanent history promise.

The opaque proof is bound to actual context and exact source bytes. It cannot be recreated, replayed, silently rebased or confirmed from equal counts. A performed acknowledgement whose confirmation changes returns superseded and revokes editing authority until fresh setup; other consumers cannot keep writing under the old lease.

## Guest sign-in

Transfer takes short locks for source and destination in deterministic order, before any retained destination lease. Auth releases document leases first and awaits the guarded transfer before exposing account storage. Target canonical data, even valid empty data, is never replaced by guest work. Partial or corrupt destinations are protected.

Both destination rows are bound and verified before any guest source is consumed. Cleanup checks actual context and all source/destination bytes between removals. A changed source is retained for review. Quota failure before a target marker, missing locks or other held transfers establish a central account/context-bound ephemeral barrier so a subsequent global initializer cannot manufacture an empty book and hide retained guest work. Releasing leases alone does not clear a valid barrier; guarded transfer retry owns resolution. Existing canonical destination work stays usable.

The auth boundary supplies actual UID/epoch/sample guards. No bare owner-unknown legacy key is assigned to an account. No crop-plan cloud transport, shared-ledger merge or offline cache migration is introduced.

## Verification limits

The new focused suite exercises storage/locks in memory, including two independent module instances sharing one lock manager, exact released loader/saver negative controls, partial/quota recovery, actor/storage replacement, transfer evidence preservation and explicit review/download/acknowledgement. The released function bodies and their hashes are frozen from `8a12b3e`; only browser/account/sample boundaries and empty-row unused agronomy are controlled. This is not evidence that a deployed browser service worker or real account session has passed.

Before release: register/run affected contracts and the full suite, inspect current-head CI/security/preview, and exercise real desktop/phone account transitions, save/reload, multiple tabs, offline restoration and BFCache. The new global saver contract also requires existing storage test fixtures to initialize a real new-generation lease while preserving their behavioural assertions. No production-readiness claim follows from these focused tests alone.
