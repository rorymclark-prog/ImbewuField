# Shape identity specification — 2026-08-10

## Decision

Do not change shape sync yet. The safe prerequisite is an application-owned,
opaque, immutable `properties.shapeId` on each GeoJSON Feature. It is not the
Mapbox Draw `feature.id`. A future sync must send per-shape create, replacement,
and deletion operations; it must not keep overwriting a complete collection.

This is a specification only. It approves neither a Firestore migration nor a
change to a farmer's saved geometry.

The preceding analysis needs one material correction: Mapbox Draw native
direct-select does not generally replace feature IDs here. The app's custom
reticle editor does. The loss mechanism is therefore narrower, although the
current full-collection sync race remains real.

## Evidence: the current identity paths

The map persists its complete `draw.getAll()` collection locally and calls
`pushShapes` after each recompute ([`components/Map.tsx:631`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:631),
[`components/Map.tsx:648`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:648),
[`components/Map.tsx:651`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:651)).
`pushShapes` serializes that collection and unconditionally `setDoc`s it
([`lib/user-sync.ts:539`](/Users/roryclark/ImbewuField-shapeid/lib/user-sync.ts:539)).
That is the overwrite proved by
[`tests/shape-sync-loss.test.ts:59`](/Users/roryclark/ImbewuField-shapeid/tests/shape-sync-loss.test.ts:59).

### Paths that preserve the current Mapbox ID

- A normal polygon draw correctly creates a new feature. The `draw.create`
  handler decorates it but does not replace it
  ([`components/Map.tsx:783`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:783)).
- Native edit enters Mapbox Draw `direct_select`
  ([`components/Map.tsx:1254`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1254)).
  The installed library updates coordinates on `state.feature` for both vertex
  dragging and midpoint insertion, rather than deleting/recreating it
  ([`direct_select.js:57`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/modes/direct_select.js:57),
  [`direct_select.js:75`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/modes/direct_select.js:75)).
  Moving the complete feature is likewise in place
  ([`direct_select.js:83`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/modes/direct_select.js:83)).
- Naming, categorising, and linking call `setFeatureProperty` by existing ID
  ([`components/Map.tsx:2027`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:2027)).
- `draw.set` keeps supplied feature IDs: Mapbox Draw only generates one when
  `feature.id` is absent, and updates an existing same-ID feature in place
  ([`api.js:77`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/api.js:77),
  [`api.js:95`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/api.js:95)).
  This is used for restore and remote redraw
  ([`components/Map.tsx:859`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:859),
  [`components/Map.tsx:873`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:873)).
- Native-edit Undo deletes then adds a full backup containing the original
  GeoJSON ID, so it restores the same ID
  ([`components/Map.tsx:3229`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:3229)).

### The app-owned replacement path

`startReticleEdit` copies the ring and selected metadata, then explicitly calls
`draw.delete(featureId)` ([`components/Map.tsx:1212`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1212),
[`components/Map.tsx:1225`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1225)).
On Done, `finishReticleEdit` constructs a new Feature with no `id` and calls
`draw.add` ([`components/Map.tsx:1353`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1353),
[`components/Map.tsx:1359`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1359)).
Mapbox then generates a new ID. It restores `featureType`, name, category,
hatch index, place link, and site link, but no durable shape identity
([`components/Map.tsx:1365`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1365)).

Cancel is also a replacement: it re-adds the unchanged original without an ID
([`components/Map.tsx:1387`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1387),
[`components/Map.tsx:1395`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1395)).
So a farmer can lose the current editor ID without changing a corner.

Reticle *drawing* also calls `draw.add` without an ID
([`components/Map.tsx:1167`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1167));
that is correct for a new shape and is a future identity mint point.

### Actual deletes and unrelated editor operations

Single-shape delete calls `draw.delete(featureId)`
([`components/Map.tsx:2043`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:2043));
clear-by-type deletes each matching feature
([`components/Map.tsx:1419`](/Users/roryclark/ImbewuField-shapeid/components/Map.tsx:1419)).
Direct-select can delete the entire feature if deleting a vertex leaves invalid
geometry ([`direct_select.js:174`](/Users/roryclark/ImbewuField-shapeid/node_modules/@mapbox/mapbox-gl-draw/src/modes/direct_select.js:174)).
Those are deletion intents; an absent feature is not itself evidence of delete.

Square-up and snapping are Design Studio operations, not Mapbox drawing edits.
They replace only `points` and retain the design-canvas zone ID
([`app/design/page.tsx:2368`](/Users/roryclark/ImbewuField-shapeid/app/design/page.tsx:2368),
[`app/design/page.tsx:2433`](/Users/roryclark/ImbewuField-shapeid/app/design/page.tsx:2433)).

Current metadata cannot anchor a map shape: names/categories are optional and
editable; `hatchIdx` is presentation; several shapes can share `placeId` or
`siteId`; legacy shapes may lack either; and there is no per-shape created or
updated timestamp. Mapbox `feature.id` is useful migration input, but the
reticle path proves it is not a durable application identity.

## Stable identity contract

Every persisted map Feature must carry an opaque, immutable `shapeId`:

```ts
type ShapeId = string; // `shp_` + cryptographically random UUID
```

The client mints it with `crypto.randomUUID()` once, checking its loaded local
collection for an accidental duplicate. It is never derived from geometry,
name, place, time, or array order, and is never farmer-visible.

| Operation | Required identity action |
| --- | --- |
| Normal Mapbox `draw.create` | Mint when no `shapeId` exists. |
| Reticle drawing Done | Mint before `draw.add`. |
| Legacy migration | Mint once for each valid legacy Feature. |
| Native edit / name / move | Preserve existing value. |
| Reticle Done or Cancel | Copy the original value to the replacement Feature. |
| Native Undo | Preserve the value in the backup. |
| Deliberate delete | Emit a tombstone; do not mint a replacement. |
| Re-add after delete | Mint a new value: it is a new shape. |

All code that constructs a replacement must copy every application-owned
property, including `shapeId`; copying the current hand-picked metadata is not
enough. Mapbox `feature.id` may remain a rendering handle, but sync, deletion,
and conflict handling use `shapeId` only.

## Target sync protocol

Use immutable, per-shape operations in a separate namespace, for example:

```
user_map_data/{uid}/data/shape_ops/{opId}
```

```ts
{
  opId: string,                 // idempotency key
  shapeId: string,
  kind: 'create' | 'replace' | 'delete',
  featureJson?: string,         // full Feature for create/replace
  baseHead?: string,            // version known when editing began
  actorId: string,              // stable per-installation random ID
  actorSequence: number,        // monotonically increasing per actor
  recordedAtMs: number          // audit/display only, not conflict authority
}
```

An operation log, rather than one last-write-wins shape document, matters for
offline safety. Two independently queued document writes can still overwrite.
Distinct immutable operations let independent creates merge and make retries
idempotent. Clients materialize one live Feature per `shapeId`.

If two replacements cite the same `baseHead`, retain both payloads and mark a
conflict. Do not silently choose coordinates. The UI may show the last confirmed
outline, but must ask the farmer to choose which outline to keep; that choice is
a new replacement operation. This needs product design before implementation.
Compaction may cache current heads, but must be deterministic, re-runnable, and
retain all live heads and tombstones needed by an offline device.

### Deletion semantics

Only a `delete` operation for a known `shapeId` deletes a shape. It retains the
shape ID, parent/head, and operation ID as a tombstone. A collection lacking an
ID can mean a newly installed/stale device has not received it, while a
tombstone means the farmer deleted it. A new deliberate re-add uses a new
`shapeId`, so an old queued delete cannot delete the replacement drawing.

## Migration and compatibility

### Never migrate `.../data/shapes` in place

The current client accepts `shapesJson` and performs a non-merge `setDoc`
([`lib/user-sync.ts:131`](/Users/roryclark/ImbewuField-shapeid/lib/user-sync.ts:131),
[`lib/user-sync.ts:543`](/Users/roryclark/ImbewuField-shapeid/lib/user-sync.ts:543)).
Adding v2 metadata or tombstones to that document is unsafe: an old client can
erase them on its next blind write. Changing only `shapesJson` is also unsafe:
an old reticle edit can remove a newly added property. No client-only field
change can make active v1 and v2 writers bidirectionally safe.

V2 must therefore use a distinct operation namespace. The legacy shapes
document remains an immutable migration source and rollback snapshot; a v2
client does not resume writing it after cut-over. Migration first stores and
verifies an exact legacy JSON backup, then creates one v2 `create` operation
per valid Feature with a newly minted `shapeId`. It retains the legacy Mapbox
ID only as editor/display data.

Malformed geometry, missing/duplicate legacy IDs, or a failure to persist a
complete v2 copy must stop migration with the legacy document untouched. Never
guess identity from a name, centroid, or array order.

### Forward and backward behaviour

- A v2 client reads legacy shapes only until explicit migration. Once v2 exists,
  it materializes v2 and must not write a fresh full legacy collection during
  reconciliation or after edits.
- A v1 client after migration can read the unchanged legacy snapshot but cannot
  safely see or contribute v2 edits. It must update before editing the migrated
  drawing. This is an explicit compatibility wall, not a hidden claim of
  cross-version sync.
- Rollback may return to the preserved legacy snapshot only before any v2 edit
  is accepted. Afterwards it requires explicit export/materialization and
  farmer confirmation; silently projecting v2 history back to v1 recreates the
  loss risk.

Farmers do not all refresh together, so the cut-over notice, old-client
handling, recovery flow, and any eventual rules enforcement need product
approval. This brief does not grant it.

## Offline reconnection

Each installation needs persistent `actorId`, next `actorSequence`, a
materialized local view, and an outbox of unacknowledged operations. A local
edit updates that view and records its operation before network work. Retry uses
the same `opId`.

After days offline, the client folds operations since its acknowledged cursor
with its outbox, then uploads missing operations. It must not overwrite local
state from a remote collection as current reconciliation does
([`lib/user-sync.ts:297`](/Users/roryclark/ImbewuField-shapeid/lib/user-sync.ts:297)).
Independent creates merge by distinct `shapeId`; deletes are explicit; concurrent
same-shape edits become a visible conflict. An offline-pack cached collection
without its outbox/cursor is recovery data, never authority to upload as a
replacement.

## Cost, failure prevention, and release gates

This is broad: map creation/edit/delete handlers; local account storage;
reconciliation/listeners; offline persistence; Firestore layout/rules;
migration/rollback UI; and cross-device tests all change. No implementation is
included here.

The worst farmer failure is a silently missing or moved boundary, water area, or
crop plot after another device writes. This design prevents that by giving each
shape an immutable ID, recording deletion intent, retaining same-shape conflicts
for a choice, and refusing to pretend an old blind writer is compatible.

Do not ship a later implementation until tests prove:

1. Reticle Done and Cancel both retain `shapeId`; native edits do too.
2. Independent offline creates both materialize.
3. A tombstone beats its deleted revision but not a deliberately new shape.
4. Concurrent offline replacements preserve both geometries as a conflict.
5. Retrying an operation is idempotent.
6. Failed migration leaves legacy JSON recoverable and a v1 client cannot erase
   v2 state.

Until then, retain `tests/shape-sync-loss.test.ts` as a reported known defect.
Do not paper over it with a count guard, collection union, or CAS retry without
this identity and conflict contract.
