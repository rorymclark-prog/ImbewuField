import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeItems } from '../lib/user-sync.ts';

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

test("mergeItems' own tombstone map is TTL-pruned using the `now` it's given", () => {
  const TTL = 90 * 24 * 60 * 60 * 1000;
  const now = 200 * 24 * 60 * 60 * 1000; // arbitrary "now" far past epoch, in ms
  const remoteDel = { old: now - TTL - 1000, fresh: now - 1000 };
  const { deleted } = mergeItems([], [], remoteDel, {}, getId, getTs, now);
  assert.equal(deleted['old'], undefined);
  assert.equal(deleted['fresh'], now - 1000);
});

test('union by id: newest updatedAt wins between remote and local copies of the same item', () => {
  const remote: Item[] = [{ id: 'p1', updatedAt: 1000 }];
  const local: Item[] = [{ id: 'p1', updatedAt: 9000 }];
  const { items } = mergeItems(remote, local, {}, {}, getId, getTs, 10000);
  assert.deepEqual(items, [{ id: 'p1', updatedAt: 9000 }]);
});
