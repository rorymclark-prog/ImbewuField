# Firestore rules — PROPOSAL ONLY (separate reviewed gate; not applied, not deployed)

## What the existing excerpt already allows

`firestore.rules` 575–620 (frozen):

```
match /user_map_data/{uid}/data/{doc} {
  allow read, write: if request.auth != null && uid == request.auth.uid;
}
```

`shapes_v2` is a document in `data/`, so the prototype as written needs **no rules change to function**. That is not the
same as approval: it means any owner-authenticated client can write any shape into `shapes_v2` (same trust model as v1),
and nothing stops a v1 client writing `data/shapes`. The two tightenings below are proposed for review.

**Rule-union caveat:** Firestore grants access if *any* matching `allow` grants it. A new
`match /user_map_data/{uid}/data/shapes_v2` block cannot restrict anything while the generic `data/{doc}` block still
allows writes to it. The generic block itself must exclude these ids.

## R1 — protect the v2 document (deploy with or after the v2 client)

```
match /user_map_data/{uid}/data/{doc} {
  allow read: if request.auth != null && uid == request.auth.uid;
  allow write: if request.auth != null && uid == request.auth.uid
    && doc != 'shapes_v2';                            // handled below; 'shapes' stays writable until R2′ (G13)
}

match /user_map_data/{uid}/data/shapes_v2 {
  allow read: if request.auth != null && uid == request.auth.uid;
  allow create: if request.auth != null && uid == request.auth.uid
    && request.resource.data.protocol == 2
    && request.resource.data.storeId is string && request.resource.data.storeId.size() > 0
    && request.resource.data.seq is int && request.resource.data.seq >= 0
    && request.resource.data.stateJson is string && request.resource.data.stateJson.size() <= 1032192;
  allow update: if request.auth != null && uid == request.auth.uid
    && request.resource.data.protocol == 2
    && request.resource.data.storeId == resource.data.storeId      // no silent store replacement
    && request.resource.data.seq is int && request.resource.data.seq >= resource.data.seq  // no rollback
    && request.resource.data.stateJson is string && request.resource.data.stateJson.size() <= 1032192;
  allow delete: if false;                                            // console/admin only
}
```

Pass 3: the cap was `< 950000`. Rules' `string.size()` counts characters, to be confirmed in the rules emulator (G6).
Characters ≤ UTF-8 bytes, so the client's byte budget (`SHAPE_DOC_BYTE_BUDGET`, 1,032,192 for the whole document)
implies ≤ 1,032,192 characters, and the old 950,000 cap would have **denied** client-accepted ASCII-heavy documents.
The rule is now a sanity cap only; Firestore itself enforces the byte limits.

Notes: rules cannot parse `stateJson`, so per-op validation stays client-side (as v1). `seq >= resource.seq` allows a
no-op write (device bookkeeping) but forbids rolling the store back. A future protocol 3 needs a coordinated rules change.

## R2′ — deny island writes ONLY together with the island drain (gate G13; replaces the first package's R2)

The first package proposed denying writes to `data/shapes` while the document still exists ("freeze"). Pass 2 ran the
**unchanged** frozen reconcile against that state (tests/shape-sync-v2-old-client.test.ts, PASS2 §3). It showed that a
frozen-but-present island leaves A1 in force: every old-device reopen overwrites that device's cache with the island
before it pushes. So a freeze protects nothing on the read side. The protective state is **island absent + writes and
creates denied**. In that state the old reconcile throws at the shapes step and keeps the cache (A4). Also:
* A blanking "freeze" (`shapesJson: null`) would **wipe** every old device (A2). It must never be used.
* An island deletion that rules allow to be re-created lets old devices bootstrap it again (A3). That is harmless to v2
  (additive, B2) but re-opens A1.

```
match /user_map_data/{uid}/data/{doc} {
  allow read: if request.auth != null && uid == request.auth.uid;
  allow write: if request.auth != null && uid == request.auth.uid
    && !(doc in ['shapes_v2', 'shapes']);
}
match /user_map_data/{uid}/data/shapes {
  allow read: if request.auth != null && uid == request.auth.uid;
  allow delete: if request.auth != null && uid == request.auth.uid;   // the v2 drain transaction only
  // no create / update: v1 pushShapes and bootstrap setDoc fail closed (old reconcile keeps local, A4)
}
```

Deploy **in the same change** that turns on `drainLegacyIsland` (Map.tsx), after the forced-update window (G8). Until an
account's island has been drained, R2′ is equivalent to the harmful freeze for that account. Product must accept the A4
cost first: un-updated devices stop syncing everything (places/water reconcile once, then nothing) until they update.
Rules cannot restrict *which* client deletes. A v2 drain is guarded by `decideIslandDrain` inside the transaction, so it
deletes only an island whose every feature is recorded in `shapes_v2`.

After R2′ a rollback write to `data/shapes` (MIGRATION-AND-RECOVERY §7) needs a temporary per-account rules revert or the
Admin SDK.

## Required before either is deployed

* Emulator tests (`@firebase/rules-unit-testing`) for: owner create/update; seq rollback denied; storeId change denied;
  delete denied; non-owner denied; oversize denied; R2′ island create/update denied, delete + read allowed; generic `data/{doc}` still allows
  places/water/surveys/design writes (regression for the existing reconcile).
* The repo's existing rules suite (`test:rules`, per the excerpt's own comment, previously never run in CI) must run in CI.
