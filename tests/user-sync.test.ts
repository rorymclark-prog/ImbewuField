import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeItems, isDeleteStale, TOMB_TTL_MS } from '../lib/user-sync.ts';
import { LOCAL_TOMBSTONE_TTL_MS } from '../lib/local-tombstones.ts';

// Coverage for the deletion-resurrection fix (lib/local-tombstones.ts): mergeItems is the merge
// primitive every reconcile/listener call site in lib/user-sync.ts and lib/site-elements.ts
// funnels through. These tests exercise it directly with plain data — no Firestore — covering
// the table cases from the audited fix: a locally-tombstoned item in a remote snapshot stays
// deleted; a deliberate re-add after deletion survives; and the merge's own tombstone TTL-prune
// still works once local tombstones are threaded in as `localDel`.

type Item = { id: string; updatedAt: number };
const getId = (x: Item) => x.id;
const getTs = (x: Item) => x.updatedAt;

test('a remote item with a newer local deletion tombstone stays deleted', () => {
  // Simulates the exact resurrection bug: device A deletes place "p1" (records a local
  // tombstone synchronously) but its async removePlace() transaction hasn't landed yet, so the
  // "remote" snapshot below is stale and still carries p1 with an OLDER updatedAt than the
  // tombstone.
  const remote: Item[] = [{ id: 'p1', updatedAt: 1000 }];
  const local: Item[] = []; // already removed from local storage by deletePlace()
  const localDel = { p1: 2000 }; // tombstone recorded synchronously, newer than remote's updatedAt
  const { items } = mergeItems(remote, local, {}, localDel, getId, getTs, 3000);
  assert.deepEqual(items, []);
});

test('without the local tombstone (the pre-fix bug), the stale remote item would resurrect', () => {
  // Same snapshot as above but localDel={} — reproduces the bug this fix closes, so a regression
  // that drops the tombstone wiring shows up as this assertion flipping.
  const remote: Item[] = [{ id: 'p1', updatedAt: 1000 }];
  const local: Item[] = [];
  const { items } = mergeItems(remote, local, {}, {}, getId, getTs, 3000);
  assert.deepEqual(items, [{ id: 'p1', updatedAt: 1000 }]);
});

test('re-adding an item after deleting it survives — a fresh save outranks the tombstone', () => {
  // Farmer deletes p1 (tombstone at t=2000), then deliberately saves it again (a fresh
  // savePlace() stamps a new, later updatedAt). The item must NOT be treated as permanently
  // banned by its own id's tombstone.
  const remote: Item[] = [];
  const local: Item[] = [{ id: 'p1', updatedAt: 5000 }]; // re-added after the delete
  const localDel = { p1: 2000 };
  const { items } = mergeItems(remote, local, {}, localDel, getId, getTs, 6000);
  assert.deepEqual(items, [{ id: 'p1', updatedAt: 5000 }]);
});

test('a tombstone exactly equal to the item timestamp does not delete it (only STRICTLY newer wins)', () => {
  const remote: Item[] = [{ id: 'p1', updatedAt: 1000 }];
  const localDel = { p1: 1000 };
  const { items } = mergeItems(remote, [], {}, localDel, getId, getTs, 5000);
  assert.deepEqual(items, [{ id: 'p1', updatedAt: 1000 }]);
});

test('local and remote tombstones for the same id merge to the max (most recent) deletion time', () => {
  const remoteDel = { p1: 1000 };
  const localDel = { p1: 4000 };
  const { deleted } = mergeItems([], [], remoteDel, localDel, getId, getTs, 5000);
  assert.equal(deleted['p1'], 4000);
});

test("mergeItems' own tombstone map is TTL-pruned using the `now` it's given, and the TTL is the SAME constant lib/local-tombstones.ts uses — not an independently hardcoded duplicate", () => {
  // Deliberately imports LOCAL_TOMBSTONE_TTL_MS rather than re-hardcoding "90 days" as a
  // literal here: if lib/user-sync.ts's internal TOMB_TTL_MS ever stops importing
  // LOCAL_TOMBSTONE_TTL_MS and drifts to its own value, this test (built against the one true
  // constant) starts failing even though its own arithmetic never changed.
  const now = 200 * 24 * 60 * 60 * 1000; // arbitrary "now" far past epoch, in ms
  const remoteDel = { old: now - LOCAL_TOMBSTONE_TTL_MS - 1000, fresh: now - 1000 };
  const { deleted } = mergeItems([], [], remoteDel, {}, getId, getTs, now);
  assert.equal(deleted['old'], undefined);
  assert.equal(deleted['fresh'], now - 1000);
});

test('lib/user-sync.ts TOMB_TTL_MS is the SAME constant as lib/local-tombstones.ts LOCAL_TOMBSTONE_TTL_MS — single authority, not two independently hardcoded 90-day literals that could drift apart', () => {
  assert.equal(TOMB_TTL_MS, LOCAL_TOMBSTONE_TTL_MS);
});

test('union by id: newest updatedAt wins between remote and local copies of the same item', () => {
  const remote: Item[] = [{ id: 'p1', updatedAt: 1000 }];
  const local: Item[] = [{ id: 'p1', updatedAt: 9000 }];
  const { items } = mergeItems(remote, local, {}, {}, getId, getTs, 10000);
  assert.deepEqual(items, [{ id: 'p1', updatedAt: 9000 }]);
});

test('equal timestamps resolve to the local row deterministically', () => {
  const remote: Array<Item & { value: string }> = [{ id: 'p1', updatedAt: 1000, value: 'remote' }];
  const local: Array<Item & { value: string }> = [{ id: 'p1', updatedAt: 1000, value: 'local' }];
  const { items } = mergeItems(remote, local, {}, {}, getId, getTs, 2000);

  assert.deepEqual(items, local);
});

test('non-finite and negative item timestamps can never outrank a valid edit', () => {
  const invalidTimestamps = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
  ];

  for (const updatedAt of invalidTimestamps) {
    const remote: Item[] = [{ id: 'p1', updatedAt }];
    const local: Item[] = [{ id: 'p1', updatedAt: 1000 }];
    const { items } = mergeItems(remote, local, {}, {}, getId, getTs, 2000);
    assert.deepEqual(items, local, `${updatedAt} beat a real local edit`);

    const reverse = mergeItems(local, remote, {}, {}, getId, getTs, 2000);
    assert.deepEqual(reverse.items, local, `${updatedAt} beat a real remote edit`);
  }
});

test('invalid tombstones are discarded and cannot delete an item forever', () => {
  const item: Item = { id: 'p1', updatedAt: 1000 };
  const invalidTombstones = {
    nan: Number.NaN,
    positiveInfinity: Number.POSITIVE_INFINITY,
    negativeInfinity: Number.NEGATIVE_INFINITY,
    negative: -1,
  };
  const { items, deleted } = mergeItems(
    [item],
    [],
    { ...invalidTombstones, p1: Number.POSITIVE_INFINITY },
    {},
    getId,
    getTs,
    2000,
  );

  assert.deepEqual(items, [item]);
  assert.deepEqual(deleted, {});
  assert.doesNotMatch(JSON.stringify(deleted), /NaN|Infinity/);
});

test('tombstone expiry uses an exact TTL boundary and preserves future clock skew', () => {
  const now = TOMB_TTL_MS * 2;
  const { deleted } = mergeItems(
    [],
    [],
    {
      expiredAtBoundary: now - TOMB_TTL_MS,
      stillFresh: now - TOMB_TTL_MS + 1,
      futureDevice: now + 1000,
    },
    {},
    getId,
    getTs,
    now,
  );

  assert.equal(deleted.expiredAtBoundary, undefined);
  assert.equal(deleted.stillFresh, now - TOMB_TTL_MS + 1);
  assert.equal(deleted.futureDevice, now + 1000);
});

test('mergeItems is deterministic and never mutates rows or tombstone maps', () => {
  const remote: Item[] = [{ id: 'remote', updatedAt: 1000 }, { id: 'shared', updatedAt: 1000 }];
  const local: Item[] = [{ id: 'local', updatedAt: 2000 }, { id: 'shared', updatedAt: 3000 }];
  const remoteDeleted = { old: 100 };
  const localDeleted = { fresh: 2500 };
  const before = structuredClone({ remote, local, remoteDeleted, localDeleted });
  const args = [remote, local, remoteDeleted, localDeleted, getId, getTs, 4000] as const;

  assert.deepEqual(mergeItems(...args), mergeItems(...args));
  assert.deepEqual({ remote, local, remoteDeleted, localDeleted }, before);
});

// ── isDeleteStale — the write-side delete-race fix ──────────────────────────────────────────
//
// removePlace()/removeWaterPoint()/removeSiteElement() used to unconditionally filter the item
// out and stamp a FRESH Date.now() as the tombstone whenever their fire-and-forget transaction
// finally committed. On a slow/rural connection that commit can land minutes after the farmer's
// actual delete tap — long enough for a genuinely NEWER edit from another device to land on the
// remote item in between, and get retroactively destroyed by a tombstone stamped with a clock
// that has drifted forward past that edit.
//
// The fix: judge staleness against the ORIGINAL local delete timestamp (`deletedAtMs`, threaded
// in from each delete*() call site's synchronous addTombstone() call — lib/local-tombstones.ts),
// not the transaction's own commit-time clock. isDeleteStale() is the extracted pure predicate
// each remove*() now guards on before writing anything; table-tested here exactly like
// mergeItems above, without needing to spin up a mocked Firestore transaction.
test.describe('isDeleteStale (table)', () => {
  const cases: Array<[string, number | undefined, number, boolean]> = [
    // [description, remoteItemTs, deletedAtMs, expected "stale — must no-op"]
    ['no remote item at all (undefined ts) → never stale, delete proceeds', undefined, 5000, false],
    ['remote item older than the delete → delete proceeds (normal case)', 1000, 5000, false],
    ['remote item edited AFTER the delete → stale, delete must no-op (the bug this fixes)', 9000, 5000, true],
    ['remote item timestamp exactly equal to the delete → NOT stale (only strictly-newer wins, mirrors mergeItems\' tombstone filter)', 5000, 5000, false],
    ['remote item one ms newer than the delete → stale', 5001, 5000, true],
    ['remote item ts of 0 vs a later delete → not stale', 0, 5000, false],
    ['NaN remote timestamp cannot outrank a real delete', Number.NaN, 5000, false],
    ['infinite remote timestamp cannot outrank a real delete', Number.POSITIVE_INFINITY, 5000, false],
    ['negative remote timestamp cannot outrank a real delete', -1, 5000, false],
    ['NaN delete timestamp cannot destroy an existing remote item', 1000, Number.NaN, true],
    ['infinite delete timestamp cannot destroy an existing remote item', 1000, Number.POSITIVE_INFINITY, true],
    ['negative delete timestamp cannot destroy an existing remote item', 1000, -1, true],
  ];
  for (const [desc, remoteItemTs, deletedAtMs, expected] of cases) {
    test(desc, () => {
      assert.equal(isDeleteStale(remoteItemTs, deletedAtMs), expected);
    });
  }
});

test('isDeleteStale mirrors the tomb > ts guard upsertPlace/upsertWaterPoint/upsertSiteElement already use from the upsert side — same strict-greater-than rule, just from the delete side', () => {
  // upsertPlace's inline guard is `tomb > ts` (a newer deletion outranks an older edit, drop the
  // upsert). isDeleteStale is the mirror: `remoteItemTs > deletedAtMs` (a newer edit outranks an
  // older delete, drop the removal). Same operator, same strictness, opposite direction.
  const tomb = 5000;
  const editTs = 6000; // newer edit — upsert side: tomb(5000) > ts(6000) is false → upsert proceeds
  assert.equal(tomb > editTs, false);
  // delete side, mirrored inputs: an edit at 6000 against a delete recorded at 5000 → the edit is
  // newer than the delete, so the delete must be stale (no-op), exactly the mirror image.
  assert.equal(isDeleteStale(editTs, tomb), true);
});
