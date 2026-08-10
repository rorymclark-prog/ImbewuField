# Shape sync data-loss analysis — 2026-08-10

## Decision

The loss is real. No production sync change is included in this branch because none of the
candidate changes is both demonstrably small and safe for a farmer's existing drawings. The
registered test `tests/shape-sync-loss.test.ts` is intentionally red on the current production
implementation and is the release gate for choosing and implementing an architecture.

## What the code does today

`components/Map.tsx` calls `pushShapes(uid, all)` after every draw change once initial
reconciliation is ready. `all` is Mapbox Draw's complete in-memory collection. `pushShapes` then
performs a blind `setDoc` of that collection. It neither reads the current document nor records a
generation, changed feature ids, deletion intent, or a local operation log.

The listener does overwrite local shape storage with a received document, but delivery is
asynchronous. It does not make a collection that has already been built and passed to
`pushShapes` current, and a local Firestore echo is ignored by the listener.

## Reproduced ordering

The red test uses an in-memory Firestore transport only to make the write ordering deterministic;
the data paths and payloads are the production ones.

1. Both browsers have received `{ base }` from the shapes listener.
2. Browser A draws `a` and writes `{ base, a }`.
3. Firestore has accepted A's write, but its listener event has not yet been delivered to browser
   B. This is a normal listener round-trip window.
4. Browser B draws `b` from its still-current-to-it `{ base }` Mapbox Draw state, then writes
   `{ base, b }`.
5. The last full-document write is the stored document, so `a` is gone.

The test expects `{ base, a, b }` and currently receives `{ base, b }`. It therefore fails, as it
must, rather than asserting the faulty overwrite as acceptable behaviour.

There are two additional vulnerable orderings:

- Two first-time devices can both see no shapes document during reconciliation and each bootstrap
  its local collection with `setDoc`; the later bootstrap wins before either listener is attached.
- An offline device's local changes are discarded by reconciliation when a shapes document already
  exists, because that path writes the remote collection to local storage before `onMergeDone` can
  flush it. That is loss of the offline device's edits even without the live-listener race.

The first-load push itself is not an independent protection: it happens in `onMergeDone`, before
live listeners are installed, and has no compare-and-set or merge. Its `getDoc` reconciliation
read makes an already-existing remote collection visible, but cannot serialize another browser's
write between that read and the subsequent full-document write.

## Candidate fixes, ordered by implementation blast radius

| Candidate | Scope and cost | Safety risk / unresolved decision |
| --- | --- | --- |
| Refuse a smaller collection unless an explicit delete is supplied | A small client-side guard around `pushShapes`, plus UI plumbing to identify a delete intent. | It only catches one symptom: concurrent additions can have the same or greater count, and a legitimate edit may replace several features with fewer fresh ids. Mapbox Draw's reticle editor delete-and-readds features with new ids, so feature count is not a reliable delete signal. It can also strand a valid delete-all. Not safe. |
| Generation counter with compare-and-set | Add a version to the one shapes document; transaction/CAS rejects a stale write and UI reload/retries. | Prevents silent overwrite, but a retry has no principled way to merge a whole stale collection with the new document. Auto-retry can resurrect deletions or duplicate reticle-recreated features; discard-on-conflict loses the local edit. Needs a defined conflict UX and offline queue policy. Not safe as a small patch. |
| Per-shape ids, `updatedAt`, and tombstones | Change the Firestore schema, local representation/write paths, reconciliation/listeners, and migrate existing JSON documents. Reuse the newer-wins/tombstone model used by places and water. | The current editor deliberately delete-and-readds features with fresh ids, so naïve union duplicates an edited feature. We need stable feature identity or an edit operation model, deletion timestamp semantics, migration/rollback behaviour, and tests for offline edits. Broad but plausible after design work. |
| Operation log / event-sourced drawing edits | Persist create/update/delete operations keyed by stable ids; compact to a materialized collection. | Highest scope, but directly represents edits and makes offline replay/conflicts auditable. Requires stable ids, idempotency, compaction, retention, and migration. Likely the clearest long-term architecture, not an emergency patch. |

## Recommended next decision

Do not ship a count guard or bare CAS as a data-loss fix. First decide how the editor gives a
feature a stable identity across reticle edits, and specify the farmer-visible rule for a true
concurrent edit to the same feature. With that contract, prototype the per-shape tombstone model
behind migration and conflict tests. Until then the red test is intentional evidence that the
current full-collection write is unsafe, not a signal to hide by changing an assertion.
