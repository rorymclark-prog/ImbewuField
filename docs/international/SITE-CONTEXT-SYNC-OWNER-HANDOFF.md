# Country-context sync owner handoff — 2 November 2026

Release blocker for `codex/international-site-context`, based on `main` at
`8a12b3ef9747807cacbc2c6e4ff0255cf223fe81`. The country panel and planning hold
are not a completed international release. `lib/user-sync.ts` remains owned by
its existing owner; this handoff proposes a narrowly scoped change, not permission
to bypass that boundary.

## Reproduced failure

Country confirmation currently stamps the whole saved place with a new
`updatedAt`, then invokes the existing `upsertPlace`. Its transaction treats
an edit newer than a deletion tombstone as deliberate recreation. A country
description is not a request to recreate a site deleted from another device.

The real storage helper and real `user-sync` transaction were exercised with
only Firestore transport replaced. The following extra case, using the existing
fixture helpers in `tests/international-site-context-storage.test.ts`, fails:

```ts
test('metadata does not recreate a remotely deleted place', async () => {
  const original = basePlace();
  seed([original]); // stale local device still has the place
  state.docs.set(cloudPath(), {
    places: [], deleted: { [original.id]: Date.now() - 10 },
  });
  updateSiteCountryContext(siteId, context);
  await setImmediate();
  assert.deepEqual(state.docs.get(cloudPath())?.places, []);
});
```

Observed result: the place was inserted remotely and its tombstone cleared.
This is a new metadata-edit use of the pre-existing deliberate-readd contract,
not a claim that all existing intentional place edits must change semantics.
The fixture times and coordinates are synthetic arithmetic inputs.

An `existingOnly` option solely on `upsertPlace` is insufficient. If local
confirmation still advances the entire place's revision, later offline
reconciliation or a live snapshot can choose that row over the remote tombstone.
The same stale full-row write can overwrite a newer remote move or notes edit.

## Proposed narrow owner patch

1. **Do not advance the saved-place revision for context-only changes.** Preserve
   the base place's `updatedAt`/`savedAt`; store a separate context revision and
   the base place revision to which confirmation applies. The existing
   `confirmedAt` can order context revisions, but must not outrank a place
   deletion or a newer base-place edit.
2. **Add a context-only existing-place transaction.** Read the current remote
   row and tombstone. If the row is missing, deletion outranks the base revision,
   the base revision changed, or coordinates differ from the context's bound
   canonical `siteId`, reject/review rather than recreate or overwrite. Update
   only context on that current remote row. Do not replace geometry, notes or
   other fields with the editor's stale full object.
3. **Reuse one place-specific merge authority everywhere.** `subscribeUserMapData`
   initial reconcile and live places listener, shared-place import, and place
   transaction call sites must share the same rule. First select surviving
   base places and apply tombstones using the existing place-revision authority;
   only then merge context revisions belonging to that exact surviving base
   revision and canonical site. A context-only revision cannot recreate a
   deleted row, change place timestamps or clear tombstones.
4. **Keep intentional place re-adds distinct.** Existing explicit save/re-add
   remains governed by existing rules. Do not silently convert a failed
   metadata update into a generic whole-place save. If the base place moved or
   changed, invalidate the pending confirmation and require the grower to review
   the current place before confirming again.
5. **Report local and cloud states accurately.** Offline context can remain a
   local pending change, but rejection on later merge must be visible. A local
   save, an attempted upload and an acknowledged remote update are different.
   Do not claim two-device verification from mocked transport alone.

The minimal production delta therefore spans the context helper/schema and
the existing owner-controlled places sync/merge path. A new parallel country
document, new permissions, broad sync rewrite or tombstone TTL change is not
required.

The existing `subscribeUserMapData` lifecycle is currently mounted by
`components/Map.tsx`, whose `onPlaces` callback dispatches the event the crop
planner watches. The planner itself currently reads the local saved-place cache
and listens for local events. Remaining on the planner without a map subscription
does not establish live cross-device delivery. Reuse the reviewed existing sync
lifecycle for this route or make the required reconciliation step explicit;
demonstrate subscription disposal and A/B switching before claiming that behavior.

## Required regression matrix

- Remote deletion before local metadata confirmation; metadata arrives later.
- Local offline confirmation, then newer remote deletion, then reconcile.
- Existing live subscription receives the remote tombstone after local metadata.
- Remote move or notes edit before metadata upload; neither is overwritten.
- Same base revision receives context-only changes from two devices; one
  deterministic context winner, no base revision escalation.
- Old pending context cannot cross a deliberate re-add of the same place ID.
- Local deletion and malformed tombstone storage fail closed for metadata writes.
- A/B/guest separation, account transition, quota/network failures and existing
  deliberate-readd behavior remain covered.
- Coordinate-bound confirmation becomes unknown after moving a pin. This last
  binding is already implemented in the new pure resolver; it does not resolve
  the deletion/reconciliation problem above.

Release needs the owner patch, meaningful current-head tests including these
cases, full CI/rules, actual save/reload and two-device/failure observations,
desktop/phone inspection and coordinator approval. Until then, keep this branch
unmerged and do not describe worldwide planning or safe sync as shipped.
