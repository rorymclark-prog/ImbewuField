import assert from 'node:assert/strict';
import test from 'node:test';
import type { Feature } from 'geojson';

import { createShapeSyncController, shapeSyncKeys, shapeSyncNotice, type ShapeSyncStatus } from '../lib/shape-sync/controller.ts';
import { parseRemoteDoc, planLegacyRollback, serializeState, applyOps, genesisState, contentFromFeature, diffContent, type ShapeOp } from '../lib/shape-sync/protocol.ts';
import { FakeShapeServer, MemoryStorage, byId, farmKeyFor, ids, journalOps, journalPrefix, makeDevice, moved, renamed, reopen, square } from './shape-sync-v2-fakes.ts';

// Pass-2 regressions for the adversarial review. Each names the loss path it closes.
const serverState = (server: FakeShapeServer) => {
  const parsed = parseRemoteDoc(server.doc);
  if (parsed.kind !== 'ok') throw new Error(parsed.kind);
  return parsed.state;
};
const serverLive = (server: FakeShapeServer) => Object.values(serverState(server).records).filter((r) => r.live).map((r) => r.id).sort();
const fc = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const rows = (st: MemoryStorage, prefix: string) => [...st.rows.keys()].filter((k) => k.startsWith(prefix));

// ── 1. Same-account tabs share one namespace ────────────────────────────────────────────────

test('tabs: an op another tab flushed, acked and had pruned is NOT applied again by a tab holding a stale snapshot', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  const A = makeDevice(server, { name: 'A', storage });
  const B = makeDevice(server, { name: 'B', storage });
  A.controller.create(square('x', 30, -29), 'reticle-create');
  const xOp = journalOps(storage)[0].opId;
  B.controller.refresh(); // B now holds A's op in its pending snapshot
  assert.equal(B.controller.status().pending, 1);
  // Between B's snapshot and B's transaction step, tab A commits x, removes the row, and its next
  // flush reports the ack so the server prunes x's idempotency entry.
  server.beforeRead = async () => {
    await A.controller.flush();
    await A.controller.flush();
  };
  await B.controller.flush();
  const state = serverState(server);
  assert.equal(state.records.x.rev, 1, 'x applied exactly once');
  assert.equal(state.records.x.conflicts.length, 0, 'no id-collision from a replay');
  assert.equal(state.applied[xOp], undefined, 'x\'s dedupe entry WAS pruned, so only revalidation prevents the replay');
});

test('tabs: any tab can flush every tab\'s pending ops, and the other tab sees them acknowledged', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  const A = makeDevice(server, { name: 'A', storage });
  const B = makeDevice(server, { name: 'B', storage });
  A.gate.offline = true; B.gate.offline = true;
  A.controller.create(square('from-a', 30, -29), 'reticle-create');
  B.controller.create(square('from-b', 31, -29), 'reticle-create');
  A.gate.offline = false;
  await A.controller.flush();
  assert.deepEqual(serverLive(server), ['from-a', 'from-b']);
  B.controller.refresh();
  assert.equal(B.controller.status().pending, 0);
  assert.equal(rows(storage, journalPrefix).length, 0);
});

for (const [first, second] of [['Z', 'A'], ['A', 'Z']]) {
  test(`causal order without a clock: offline create (writer ${first}) → reload → edit (writer ${second}) never becomes a held conflict`, async () => {
    const server = new FakeShapeServer();
    const storage = new MemoryStorage();
    const t1 = makeDevice(server, { name: first, storage });
    t1.gate.offline = true;
    t1.controller.create(square('s', 30, -29), 'reticle-create');
    t1.controller.dispose();
    const t2 = makeDevice(server, { name: second, storage, gate: t1.gate });
    t2.controller.update(t2.controller.captureBasis('s')!, moved(square('s', 30, -29), 0.01), 'native-edit');
    assert.deepEqual(ids(t2.controller.view()), ['s'], 'still on the map before any sync');
    assert.equal(t2.controller.conflicts().length, 0);
    t2.gate.offline = false;
    const r = await t2.controller.flush();
    if (r.kind === 'committed') assert.deepEqual(r.outcomes.map((o) => o.outcome), ['applied', 'applied']);
    const rec = serverState(server).records.s;
    assert.equal(rec.live, true);
    assert.equal(rec.conflicts.length, 0);
    assert.equal(JSON.stringify(rec.content?.g), JSON.stringify(moved(square('s', 30, -29), 0.01).geometry));
  });
}

test('causal order across two LIVE tabs: B edits a shape A created offline; whichever tab flushes, it lands in order', async () => {
  for (const flusher of ['A', 'B'] as const) {
    const server = new FakeShapeServer();
    const storage = new MemoryStorage();
    const A = makeDevice(server, { name: 'Z', storage });
    const B = makeDevice(server, { name: 'A', storage });
    A.gate.offline = true; B.gate.offline = true;
    A.controller.create(square('s', 30, -29, { name: 'from A' }), 'reticle-create');
    B.controller.refresh(); // the storage event
    B.controller.update(B.controller.captureBasis('s')!, renamed(square('s', 30, -29), 'renamed in B'), 'rename');
    const tab = flusher === 'A' ? A : B;
    tab.gate.offline = false; tab.controller.refresh();
    await tab.controller.flush();
    const rec = serverState(server).records.s;
    assert.equal(rec.live, true, flusher);
    assert.equal(rec.conflicts.length, 0, flusher);
    assert.equal(rec.content?.p.name, 'renamed in B', flusher);
  }
});

test('tabs: two v2 tabs never absorb each other\'s derived cache as raw v1 data', () => {
  const storage = new MemoryStorage();
  const A = makeDevice(null, { name: 'A', storage });
  const B = makeDevice(null, { name: 'B', storage });
  A.controller.create(square('x', 30, -29), 'reticle-create');
  B.controller.create(square('y', 31, -29), 'reticle-create');
  A.controller.create(square('z', 32, -29), 'reticle-create');
  assert.deepEqual(journalOps(storage).map((o) => o.kind), ['create', 'create', 'create'], 'no legacy ops from a marked cache');
});

// ── 2. Durability boundaries ────────────────────────────────────────────────────────────────

test('same-tab reload after the journal row could not be removed: the replay is a harmless duplicate', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('x', 30, -29), 'reticle-create');
  A.storage.stickyPrefixes = [journalPrefix]; // removeItem silently fails
  await A.controller.flush();
  assert.equal(A.controller.status().pending, 1, 'row still there');
  assert.equal(rows(A.storage, 'imbewu_shape_ack_v2:').length, 0, 'no ack is reported for a row that is still present');
  const A2 = reopen(server, A, 'A2');
  const r = await A2.controller.flush();
  assert.equal(r.kind, 'committed');
  if (r.kind === 'committed') assert.equal(r.outcomes[0].outcome, 'duplicate');
  assert.equal(serverState(server).records.x.rev, 1);
  assert.ok(Object.keys(serverState(server).applied).length > 0, 'dedupe entry kept while the row exists');
  A2.storage.stickyPrefixes = [];
  A2.controller.receiveRemote(server.doc); // same state → no adopt; nudge via flush instead
  await A2.controller.flush();
  assert.equal(A2.controller.status().pending, 0);
});

test('a failed ack-record write only means the server keeps the dedupe entry longer', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('x', 30, -29), 'reticle-create');
  A.storage.failPrefixes = ['imbewu_shape_ack_v2:'];
  await A.controller.flush();
  await A.controller.flush();
  assert.equal(Object.keys(serverState(server).applied).length, 1, 'never pruned without a durable ack');
});

const RAW = (marker: string) => JSON.stringify(fc(
  square('v1-valid', 30, -29, { name: `VALID-${marker}` }),
  { type: 'Feature', id: 'v1-broken', properties: { note: `BROKEN-${marker}` }, geometry: { type: 'Polygon', coordinates: [[[0, 0]]] } },
));

test('migration boundary: backup write fails → raw cache is left in place, features still journaled and shown; reload heals', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  storage.setItem(farmKeyFor(), RAW('B1'));
  storage.failPrefixes = ['imbewu_farm_shapes_v1_backup:'];
  const A = makeDevice(server, { name: 'A', storage });
  assert.equal(storage.getItem(farmKeyFor()), RAW('B1'), 'raw untouched');
  assert.equal(A.controller.status().rawCacheHeld, true);
  assert.ok(ids(A.controller.view()).includes('v1-valid'), 'the map still shows the v1 shape');
  assert.equal(shapeSyncNotice(A.controller.status())?.level, 'warn');
  storage.failPrefixes = [];
  const A2 = reopen(server, A, 'A2');
  assert.equal(A2.controller.status().rawCacheHeld, false);
  assert.ok(rows(storage, 'imbewu_farm_shapes_v1_backup:').some((k) => storage.getItem(k) === RAW('B1')), 'verbatim backup now exists');
  assert.ok(JSON.parse(storage.getItem(farmKeyFor()) as string).imbewuShapeSyncView, 'only then replaced by the marked derived cache');
  await A2.controller.flush();
  assert.deepEqual(serverLive(server), ['v1-valid']);
  assert.ok(storage.holds('BROKEN-B1'), 'the unreadable feature is still held (backup + quarantine)');
});

test('migration boundary: journal write fails (volatile) → raw kept; a reload before any flush re-absorbs it', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  storage.setItem(farmKeyFor(), RAW('J1'));
  storage.failPrefixes = [journalPrefix];
  const A = makeDevice(server, { name: 'A', storage });
  assert.equal(storage.getItem(farmKeyFor()), RAW('J1'));
  assert.equal(A.controller.status().durability, 'volatile');
  A.controller.dispose(); // tab dies: its volatile ops are gone…
  storage.failPrefixes = [];
  const A2 = reopen(server, A, 'A2');
  assert.equal(A2.controller.status().pending, 1, '…but the raw cache was never overwritten, so they come back');
  await A2.controller.flush();
  assert.deepEqual(serverLive(server), ['v1-valid']);
});

test('migration boundary: quarantine write fails but the backup succeeded → overwrite allowed, raw still recoverable', () => {
  const storage = new MemoryStorage();
  storage.setItem(farmKeyFor(), RAW('Q1'));
  storage.failPrefixes = ['imbewu_shape_quarantine_v2:'];
  const A = makeDevice(null, { name: 'A', storage });
  assert.ok(A.controller.status().quarantineWriteFailures > 0);
  assert.equal(shapeSyncNotice(A.controller.status())?.level, 'warn');
  assert.ok(rows(storage, 'imbewu_farm_shapes_v1_backup:').some((k) => storage.getItem(k)?.includes('BROKEN-Q1')));
});

test('a refused op is kept raw and durable (survives reload), never acked away; if that copy cannot be written the journal row stays', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('r', 30, -29, { note: 'REJECT-MARKER' }), 'reticle-create');
  const opId = journalOps(A.storage)[0].opId;
  // Some other client already recorded this op id as rejected (e.g. a stricter future validator).
  const s = genesisState('st-r');
  s.seq = 1; s.applied[opId] = { seq: 1, device: 'other', outcome: 'rejected', reason: 'test refusal' };
  server.doc = serializeState(s) as unknown as Record<string, unknown>;
  A.storage.failPrefixes = ['imbewu_shape_rejected_v2:'];
  await A.controller.flush();
  assert.equal(A.controller.status().rejectedRetentionFailures, 1);
  assert.equal(A.controller.status().pending, 1, 'no durable raw copy → the journal row is kept');
  A.storage.failPrefixes = [];
  const A2 = reopen(server, A, 'A2');
  await A2.controller.flush();
  assert.equal(A2.controller.status().pending, 0);
  const A3 = reopen(server, A2, 'A3');
  assert.equal(A3.controller.status().rejected, 1, 'durable count after reload');
  assert.ok(A3.controller.exportRecovery().includes('REJECT-MARKER'));
  assert.equal(shapeSyncNotice(A3.controller.status())?.level, 'warn');
});

test('conflict cap DEFERS (per shape, order kept) instead of dropping; other shapes still sync; it applies after a decision', async () => {
  const server = new FakeShapeServer();
  const origin = makeDevice(server, { name: 'D0' });
  origin.controller.create(square('s', 30, -29, { name: 'start' }), 'reticle-create');
  await origin.controller.flush();
  for (let i = 1; i <= 21; i++) {
    const d = makeDevice(server, { name: `D${i}` });
    d.controller.receiveRemote(server.doc);
    const basis = d.controller.captureBasis('s')!;
    basis.baseRev = 1;
    d.controller.update(basis, renamed(square('s', 30, -29), `N${i}`), 'rename');
    await d.controller.flush();
  }
  assert.equal(serverState(server).records.s.conflicts.length, 20);
  const last = makeDevice(server, { name: 'D22' });
  last.controller.receiveRemote(server.doc);
  const session = last.controller.captureBasis('s')!;
  session.baseRev = 1;
  last.controller.update(session, renamed(square('s', 30, -29), 'LAST-1'), 'rename');
  last.controller.create(square('other', 31, -29), 'reticle-create');
  last.controller.update(session, moved(renamed(square('s', 30, -29), 'LAST-1'), 0.01), 'native-edit');
  const r = await last.controller.flush();
  assert.equal(r.kind, 'committed');
  if (r.kind === 'committed') assert.deepEqual(r.outcomes.map((o) => o.outcome), ['deferred', 'applied', 'deferred']);
  assert.equal(last.controller.status().deferred.length, 2);
  assert.equal(shapeSyncNotice(last.controller.status())?.level, 'warn');
  assert.ok(serverLive(server).includes('other'), 'unrelated shape not held hostage');
  // The farmer decides one open branch; the deferred ops then apply in their original order.
  origin.controller.receiveRemote(server.doc);
  const one = origin.controller.conflicts()[0];
  origin.controller.resolve(one.shapeId, one.conflictId, 'keep-current');
  await origin.controller.flush();
  last.controller.receiveRemote(server.doc);
  const again = await last.controller.flush();
  if (again.kind === 'committed') assert.deepEqual(again.outcomes.map((o) => o.outcome), ['conflict', 'conflict'], 'branch opened, second op folded into it');
  assert.equal(last.controller.status().pending, 0);
  const mine = serverState(server).records.s.conflicts.find((c) => c.device === last.controller.device);
  assert.equal(mine?.proposed?.p.name, 'LAST-1');
});

test('quarantine is never trimmed: 250 unreadable island features → 250 retained rows', () => {
  const A = makeDevice(null, { name: 'A' });
  const broken = Array.from({ length: 250 }, (_, i) => ({ type: 'Feature', id: `b${i}`, properties: { m: `QQ-${i}` }, geometry: null }));
  A.controller.ingestLegacyIsland(JSON.stringify(fc(...broken)), 1000);
  assert.equal(rows(A.storage, 'imbewu_shape_quarantine_v2:').length, 250);
});

// ── 3. v1 island drain (gated OFF by default) ───────────────────────────────────────────────

function drainDevice(server: FakeShapeServer, name = 'A') {
  const storage = new MemoryStorage();
  const keys = shapeSyncKeys((b) => `${b}::imbewu-owner::uid:farmer`);
  let k = 0;
  const controller = createShapeSyncController({
    keys, storage, transport: server.transport(), isCurrent: () => true, now: () => 1_700_000_000_000,
    randomId: () => `${name}${k++}`, schedule: () => () => {}, drainLegacyIsland: true,
  });
  controller.start();
  return controller;
}

test('drain: a fully readable island is ingested and deleted in ONE transaction', async () => {
  const server = new FakeShapeServer();
  server.island = { shapesJson: JSON.stringify(fc(square('i1', 30, -29), square('i2', 31, -29))), version: 1000 };
  const c = drainDevice(server);
  c.ingestLegacyIsland(server.island.shapesJson, 1000);
  const r = await c.flush();
  assert.equal(r.kind === 'committed' && r.islandDrained, true);
  assert.equal(server.island, null);
  assert.deepEqual(serverLive(server), ['i1', 'i2']);
});

test('drain: an island with ANY unreadable feature is never deleted (it is that feature\'s only copy)', async () => {
  const server = new FakeShapeServer();
  server.island = { shapesJson: JSON.stringify(fc(square('i1', 30, -29), { type: 'Feature', id: 'bad', properties: {}, geometry: null })), version: 1000 };
  const c = drainDevice(server);
  c.ingestLegacyIsland(server.island.shapesJson, 1000);
  await c.flush();
  assert.ok(server.island, 'kept');
  assert.match(c.status().islandDrain ?? '', /unreadable/);
  assert.deepEqual(serverLive(server), ['i1'], 'the readable feature is still ingested (additively) — drain gating must not starve it');
});

test('drain: shapesJson:null (which makes the FROZEN v1 reconcile wipe an old client\'s cache) is content-free and is deleted', async () => {
  const server = new FakeShapeServer();
  server.island = { shapesJson: null, version: 1000 };
  const c = drainDevice(server);
  c.ingestLegacyIsland(null, 1000);
  await c.flush();
  assert.equal(server.island, null);
});

test('drain: an island rewritten between read and commit is re-read; it is deleted only with the NEW content ingested', async () => {
  const server = new FakeShapeServer();
  server.island = { shapesJson: JSON.stringify(fc(square('i1', 30, -29))), version: 1000 };
  const c = drainDevice(server);
  c.ingestLegacyIsland(server.island.shapesJson, 1000);
  server.beforeCommit = () => { server.island = { shapesJson: JSON.stringify(fc(square('i1', 30, -29), square('late-old-client', 32, -29))), version: 2000 }; server.version += 1; };
  await c.flush();
  assert.equal(server.island, null);
  assert.deepEqual(serverLive(server), ['i1', 'late-old-client']);
});

test('drain OFF (the default): the island is never touched', async () => {
  const server = new FakeShapeServer();
  server.island = { shapesJson: JSON.stringify(fc(square('i1', 30, -29))), version: 1000 };
  const A = makeDevice(server, { name: 'A' });
  A.controller.ingestLegacyIsland(server.island.shapesJson, 1000);
  await A.controller.flush();
  assert.ok(server.island);
  assert.deepEqual(serverLive(server), ['i1']);
});

// ── 4. Rollback contract ────────────────────────────────────────────────────────────────────

test('rollback plan refuses while v1 cannot represent the state, never resurrects a deletion, and always demands a device drain', () => {
  const content = (f: Feature) => { const r = contentFromFeature(f); assert.ok(r.ok); return r.content; };
  const a = square('a', 30, -29), b = square('b', 31, -29);
  const op = (o: Partial<ShapeOp> & Record<string, unknown>) => ({ baseSeq: 0, deps: [], source: 'native-edit', device: 'X', ...o }) as ShapeOp;
  let s = applyOps(genesisState('st'), [
    op({ kind: 'create', opId: 'c1', shapeId: 'a', content: content(a) }),
    op({ kind: 'create', opId: 'c2', shapeId: 'b', content: content(b) }),
  ]).state;
  s = applyOps(s, [op({ kind: 'delete', opId: 'd1', shapeId: 'b', baseRev: 1 })]).state;
  const clean = planLegacyRollback(s, [b, square('v1-only', 33, -29)]);
  assert.equal(clean.safe, true);
  assert.deepEqual(ids(clean.fc), ['a', 'v1-only'], 'deleted b is not handed back to v1');
  assert.equal(clean.requiresDeviceDrain, true);
  s = applyOps(s, [
    op({ kind: 'update', opId: 'u1', shapeId: 'a', baseRev: 1, patch: diffContent(content(a), content(moved(a, 1))), proposed: content(moved(a, 1)) }),
    op({ kind: 'update', opId: 'u2', shapeId: 'a', baseRev: 1, patch: diffContent(content(a), content(moved(a, -1))), proposed: content(moved(a, -1)) }),
  ]).state;
  const blocked = planLegacyRollback(s, [{ type: 'Feature', id: 'junk', properties: {}, geometry: null }]);
  assert.equal(blocked.safe, false);
  assert.equal(blocked.blockers.conflicts.length, 1);
  assert.equal(JSON.stringify(blocked.blockers.conflicts[0].other?.geometry), JSON.stringify(moved(a, -1).geometry), 'the branch geometry is in the plan for export');
  assert.equal(blocked.blockers.unparseableIslandFeatures.length, 1);
});

test('rollback period: v1 code overwrites the cache without a pending v2 shape; re-enabled v2 still has it (journal is untouched by v1)', () => {
  const storage = new MemoryStorage();
  const A = makeDevice(null, { name: 'A', storage });
  A.controller.create(square('pending-v2', 30, -29), 'reticle-create');
  A.controller.dispose();
  // v1 Map.tsx recompute: JSON.stringify(draw.getAll()) of whatever v1 painted (island content).
  storage.setItem(farmKeyFor(), JSON.stringify(fc(square('from-island', 31, -29))));
  const B = reopen(null, A, 'B');
  assert.deepEqual(ids(B.controller.view()), ['from-island', 'pending-v2']);
});

// ── 5. Source-specific orderings at controller level ───────────────────────────────────────

test('stale same-field edits from two devices → preserved conflict, resolvable both ways', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('s', 30, -29, { name: 'Dam' }), 'reticle-create');
  await A.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);
  const bBasis = B.controller.captureBasis('s')!;
  A.controller.update(A.controller.captureBasis('s')!, renamed(square('s', 30, -29), 'Big dam'), 'rename');
  await A.controller.flush();
  B.controller.update(bBasis, renamed(square('s', 30, -29), 'Old dam'), 'rename'); // stale basis
  await B.controller.flush();
  const [c] = B.controller.conflicts();
  assert.equal(c.kind, 'concurrent-edit');
  assert.equal(c.current?.properties?.name, 'Big dam');
  assert.equal(c.other?.properties?.name, 'Old dam');
  B.controller.resolve('s', c.conflictId, 'use-branch');
  await B.controller.flush();
  assert.equal(serverState(server).records.s.content?.p.name, 'Old dam');
});

test('delete-all on one device + an old queued batch replayed twice after restarts on another', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  ['s1', 's2', 's3'].forEach((id, i) => A.controller.create(square(id, 31 + i, -29), 'reticle-create'));
  await A.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);
  B.gate.offline = true;
  B.controller.update(B.controller.captureBasis('s1')!, moved(B.controller.feature('s1')!, 0.01), 'native-edit');
  B.controller.create(square('d', 35, -29), 'reticle-create');
  A.controller.remove(['s1', 's2', 's3'], 'clear-type');
  await A.controller.flush();
  B.storage.stickyPrefixes = [journalPrefix];
  const B2 = reopen(server, B, 'B2'); B2.gate.offline = false;
  await B2.controller.flush();
  const B3 = reopen(server, B2, 'B3');
  const replay = await B3.controller.flush();
  if (replay.kind === 'committed') assert.ok(replay.outcomes.every((o) => o.outcome === 'duplicate'));
  assert.deepEqual(serverLive(server), ['d']);
  const held = serverState(server).records.s1;
  assert.equal(held.live, false, 'never resurrected');
  // B never flushed before going offline, so the server did not know it and could prune s1's
  // tombstone: the edit is then HELD as missing-target (with B's full geometry), never dropped.
  assert.ok(['edit-after-delete', 'missing-target'].includes(held.conflicts[0].kind));
  assert.equal(JSON.stringify(held.conflicts[0].proposed?.g), JSON.stringify(moved(square('s1', 31, -29), 0.01).geometry));
});

test('sample / bare namespace never claims or deletes another owner\'s rows', () => {
  const storage = new MemoryStorage();
  storage.setItem('imbewu_shape_op_v2:op-real::imbewu-owner::uid:real-farmer', JSON.stringify({ v: 2, writer: 'w', wseq: 1, op: { kind: 'create' } }));
  storage.setItem('imbewu_farm_shapes::imbewu-owner::uid:real-farmer', JSON.stringify(fc(square('real', 30, -29))));
  const keys = shapeSyncKeys((b) => b);
  assert.equal(keys.match('imbewu_shape_op_v2:op-real::imbewu-owner::uid:real-farmer'), null);
  let k = 0;
  const sample = createShapeSyncController({ keys, storage, transport: null, isCurrent: () => true, now: () => 0, randomId: () => `s${k++}`, schedule: () => () => {} });
  sample.start();
  sample.create(square('demo', 31, -29), 'reticle-create');
  assert.deepEqual(ids(sample.view()), ['demo']);
  assert.ok(storage.getItem('imbewu_shape_op_v2:op-real::imbewu-owner::uid:real-farmer'));
  assert.ok(storage.getItem('imbewu_farm_shapes::imbewu-owner::uid:real-farmer')?.includes('"real"'));
});

// ── 6. Notices never claim a cloud save that did not happen ─────────────────────────────────

test('shapeSyncNotice: "synced" only when nothing is pending, volatile, held, deferred, rejected or blocked and a commit was seen', () => {
  const ok: ShapeSyncStatus = {
    durability: 'durable', pending: 0, transport: 'available', blocked: null, lastError: null, rejected: 0, rejectedRetentionFailures: 0,
    deferred: [], conflicts: 0, invalidJournal: 0, rawCacheHeld: false, quarantineWriteFailures: 0, lastCommittedSeq: 7, flushing: false, islandDrain: null,
    fallbackHeld: 0, volatileOps: 0,
  };
  assert.equal(shapeSyncNotice(ok)?.level, 'ok');
  const failing: Array<[string, Partial<ShapeSyncStatus>]> = [
    ['pending', { pending: 1 }], ['flushing', { flushing: true }], ['offline error', { lastError: 'unavailable', pending: 1 }],
    ['volatile', { durability: 'volatile', volatileOps: 1 }], ['volatile, fallback-held (pass 3)', { durability: 'volatile', volatileOps: 1, fallbackHeld: 1 }], ['blocked', { blocked: 'too-large' }], ['raw held', { rawCacheHeld: true }],
    ['deferred', { deferred: [{ opId: 'o', shapeId: 's', reason: 'cap' }] }], ['rejected kept', { rejected: 1 }],
    ['rejected not kept', { rejectedRetentionFailures: 1 }], ['quarantine failed', { quarantineWriteFailures: 1 }],
    ['invalid journal', { invalidJournal: 1 }], ['no transport', { transport: 'none' }], ['never committed', { lastCommittedSeq: null }],
  ];
  for (const [name, patch] of failing) {
    const n = shapeSyncNotice({ ...ok, ...patch });
    assert.notEqual(n?.level, 'ok', name);
    assert.ok(!/synced\./i.test(n?.text ?? ''), `${name} must not say synced`);
  }
});

test('controller status: a create that cannot be persisted and a failing transport never read as synced', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.storage.failPrefixes = [journalPrefix];
  A.controller.create(square('x', 30, -29), 'reticle-create');
  assert.equal(shapeSyncNotice(A.controller.status())?.level, 'error');
  A.storage.failPrefixes = [];
  A.gate.offline = true;
  A.controller.create(square('y', 31, -29), 'reticle-create');
  await A.controller.flush();
  assert.notEqual(shapeSyncNotice(A.controller.status())?.level, 'ok');
  A.gate.offline = false;
  await A.controller.flush();
  assert.equal(shapeSyncNotice(A.controller.status())?.level, 'ok', 'only after a real commit with nothing left');
  assert.ok(byId(A.controller.view(), 'x') && byId(A.controller.view(), 'y'));
});

// ── 7. Why Map.tsx's native Undo may not revert the draw store on its own ───────────────────

test('hazard behind the Map Undo fix: an UNTRACKED draw-store revert + a later drag silently overwrites a newer remote edit', async () => {
  const { createDrawShapeAdapter } = await import('../lib/shape-sync/draw-adapter.ts');
  const { FakeDraw } = await import('./shape-sync-v2-fakes.ts');
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const draw = new FakeDraw();
  const adapter = createDrawShapeAdapter({ getController: () => A.controller, getDraw: () => draw, isPresentation: () => false, newShapeId: () => 'x' });
  A.controller.create(square('s', 30, -29), 'reticle-create');
  await A.controller.flush();
  draw.set(A.controller.view());
  const staleBackup = structuredClone(draw.get('s')!);
  // Another device moves s; A's controller has it, A's draw store is repainted later (deferred).
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);
  B.controller.update(B.controller.captureBasis('s')!, moved(square('s', 30, -29), 0.5), 'native-edit');
  await B.controller.flush();
  A.controller.receiveRemote(server.doc);
  // pass-1 Map fallback when nativeUndo() is false (no active session): draw.delete + draw.add(backup).
  draw.delete('s'); draw.add(staleBackup);
  // The farmer drags a vertex: Draw emits draw.update with the STALE geometry + the drag.
  adapter.recordDrawUpdate([moved(staleBackup, 0.0001)]);
  await A.controller.flush();
  const parsed = parseRemoteDoc(server.doc);
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind !== 'ok') return;
  const rec = parsed.state.records.s;
  assert.equal(rec.conflicts.length, 0, 'no conflict was opened…');
  assert.notEqual(JSON.stringify(rec.content?.g), JSON.stringify(moved(square('s', 30, -29), 0.5).geometry), '…and B\'s move is gone from the live shape');
  // With the pass-2 handler there is no untracked revert: Undo acts only on the ACTIVE session (typed op).
  assert.equal(adapter.nativeUndo(), false);
});
