# Crop-book cutover at the sign-in boundary

Authentication uses the lightweight `crop-plan-storage` authority instead of
importing the crop catalogue or independently copying the canonical book and its
cutover receipt. The Field Journal retains its existing single-row guest
migration. Crop-book transfer is a separate paired operation under the same
cooperative Web Locks used by the canonical storage authority.

The existing strict empty-scaffold predicate remains the decision for a legacy
destination: no plantings does not make profiles, production records, nursery
settings, held inputs, notes, unknown metadata or an observed zero disposable.
A valid empty **canonical** destination is authoritative and is preserved too.
Successful legacy guest transfer now puts the exact authored bytes into the new
canonical destination; it does not overwrite that account's old-client copy.
The shared transfer primitive binds the destination receipt, retains source
provenance and cleans up only the verified transferred guest namespace.

## Actual identity and loading barrier

The Firebase auth observer releases old document leases, suspends account-bound
children and awaits guest transfer before releasing `storageReadyEpoch`. Password,
sign-up, Google popup and redirect completion await the same provider-local
operation. Calls for the same UID, auth epoch and sample state coalesce. Calls
from different transitions serialize, and a stale queued operation loses
authority before touching storage. An unmounted provider or changed Firebase
identity cannot consume the guest source.

The account namespace still rotates only after the old subtree is unmounted.
Authentication can succeed when transfer is held, storage refuses a write, or
Web Locks are unavailable. These outcomes do not leave the whole app waiting
indefinitely and do not claim that crop work was saved or transferred.

## Retained guest work is not an empty account

The light storage authority records an account-bound pending-transfer barrier
when guest work exists but the destination cannot be installed. This also covers
failure before the first receipt write, where a later initializer would otherwise
see an absent destination and manufacture an empty canonical book. The ordinary
initializer and writer respect this same barrier; a UI flag alone is insufficient.

`AuthContext.cropPlanMigrationHold` mirrors that bounded reason for the current
actor only. It contains no keys, raw payload, crop IDs or account handles.
`retryCropPlanMigration` queues a fresh transfer attempt, bound to the rendered
account and auth epoch. A retained callback from another account cannot grant a
new transfer. A successful retry clears the authoritative barrier and its UI
mirror before normal initialization can proceed. Existing canonical destination
work stays usable while its separate guest draft is retained.

Partial or corrupt pairs remain recovery cases. Neither authentication nor retry
silently overwrites a partial destination, merges independent histories or
promotes an old timestamp to authority. Sample mode performs no persistent paired
transfer. This code grants no project consent or publication rights.

## Verification scope

Node 24 typecheck passed, followed by **48/48 tests across seven auth, account and
sample files**, including thirteen mounted-provider cutover groups. The tests use
actual `AuthProvider`, account key formatting and the shared paired storage
primitive with controlled Firebase transport, React rendering, Web Locks and
memory storage. They cover exact bytes and rebound provenance; pending loading;
account/sample/unmount revocation; quota and partial evidence; corrupt/diverged
pairs; authoritative empty destinations; unsupported locks; password, signup,
popup and redirect; explicit retry; and stale retry callbacks.

The quota-before-receipt and unsupported-lock controls call the actual global
initializer and verify that it cannot create an empty destination while guest
transfer is held. Earlier production-only, observed-zero, metadata-only,
malformed-scaffold and legitimate-empty controls remain. Their successful
destination assertions now inspect the actual canonical pair rather than pinning
the retired v1 write address.

These checks are not full-suite, real Firebase, browser or release approval.
Current-head CI, account/browser review and coordinator integration remain
required. No sync, offline cache, species, calibrated lesson or measured geometry
was changed by this lane.

## Existing consumer fixture continuation

The subsequent fixture continuation passed typecheck and **214/214 tests across
21 affected files**, including the three actual auth suites. That run excludes
the coordinator's two larger storage/profile suites and the separate new core/UI
cutover suites; the counts must not be added to overlapping owner runs.

`tests/crop-plan-storage-fixture.ts` runs the actual initializer with a faithful
asynchronous exclusive-lock stand-in and holds its real document lease. It loads
the storage module only after each test's Firebase hooks and browser storage are
installed. No ready status, receipt, admission or production fallback is mocked.
Late current-book replacements deliberately replace only `bookRaw` in the actual
initialized envelope. Old-client divergence tests retain their legacy address.

Assertions formerly pinning a v1 physical write now inspect the canonical book;
an initialized empty canonical book is present rather than an absent raw row.
Invalid reference/non-JSON candidates remain refused without changing stored
bytes. The nursery held-inventory fixture applies the same evidence-preserving
sanitizer as the editor and explicitly checks that every original held row stays
retained. The fresh-token regression additionally verifies the global saver
refuses lossy repair before modeling an independent canonical replacement.

Read-only calendar fallback and no-window save-failure controls still run without
initialization. Their absence of writes remains meaningful. Two obsolete
pre-initialization fixtures had awaited hashing even though the real source
reader returned held before reaching the hash boundary; that failed baseline was
recorded and its two verified waiting test children stopped, never reported as a
pass. The initialized affected rerun completed without those waits or failures.
