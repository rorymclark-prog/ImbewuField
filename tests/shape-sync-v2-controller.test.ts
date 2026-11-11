import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRemoteDoc, serializeState, genesisState } from '../lib/shape-sync/protocol.ts';
import { FakeShapeServer, MemoryStorage, byId, farmKeyFor, ids, makeDevice, moved, renamed, reopen, square } from './shape-sync-v2-fakes.ts';

const serverLive = (server: FakeShapeServer): string[] => {
  const parsed = parseRemoteDoc(server.doc);
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind !== 'ok') return [];
  return Object.values(parsed.state.records).filter((r) => r.live).map((r) => r.id).sort();
};
const serverState = (server: FakeShapeServer) => {
  const parsed = parseRemoteDoc(server.doc);
  if (parsed.kind !== 'ok') throw new Error(parsed.kind);
  return parsed.state;
};

test('two-device first bootstrap race: both devices\' v1 caches survive, one store id, identical shapes not duplicated', async () => {
  const server = new FakeShapeServer();
  const common = square('common', 30, -29, { name: 'Shared boundary' });
  const storageA = new MemoryStorage();
  const storageB = new MemoryStorage();
  storageA.setItem(farmKeyFor(), JSON.stringify({ type: 'FeatureCollection', features: [common, square('onlyA', 30.1, -29)] }));
  storageB.setItem(farmKeyFor(), JSON.stringify({ type: 'FeatureCollection', features: [common, square('onlyB', 30.2, -29)] }));
  const A = makeDevice(server, { name: 'A', storage: storageA });
  const B = makeDevice(server, { name: 'B', storage: storageB });
  assert.equal(A.controller.status().pending, 2, 'v1 cache folded into the durable queue');
  const hasBackup = (st: MemoryStorage, marker: string) => [...st.rows].some(([k, v]) => k.startsWith('imbewu_farm_shapes_v1_backup:') && v.includes(marker));
  // pass 2: a content-addressed verbatim backup exists BEFORE the derived cache replaced the raw one.
  assert.ok(hasBackup(storageA, 'onlyA') && hasBackup(storageB, 'onlyB'));

  // Both see "no document". B reads first; A creates the store before B commits.
  server.beforeCommit = async () => { await A.controller.flush(); };
  await B.controller.flush();

  assert.deepEqual(serverLive(server), ['common', 'onlyA', 'onlyB']);
  const state = serverState(server);
  assert.equal(Object.keys(state.legacy).length, 3);
  assert.equal(B.controller.conflicts().length, 0, 'identical legacy content is a no-op, not a conflict');
  // ...and is pruned only once every feature in it is recorded server-side.
  assert.equal(hasBackup(storageA, 'onlyA'), false, 'A adopted the committed state that covers its backup');
  A.controller.receiveRemote(server.doc);
  assert.deepEqual(ids(A.controller.view()), ['common', 'onlyA', 'onlyB']);
  assert.deepEqual(ids(JSON.parse(storageA.getItem(farmKeyFor()) as string)), ['common', 'onlyA', 'onlyB'], 'FARM_KEY is now the derived v2 view');
});

test('offline edits survive reload and reconnect; a remote state arriving first does NOT overwrite them', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const s1 = square('s1', 30.1, -29, { name: 'Orchard' });
  const s2 = square('s2', 30.2, -29, { name: 'Dam' });
  A.controller.create(s1, 'reticle-create');
  A.controller.create(s2, 'reticle-create');
  await A.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);

  B.gate.offline = true;
  const basis = B.controller.captureBasis('s1');
  assert.ok(basis);
  B.controller.update(basis, moved(s1, 0.002), 'native-edit');
  assert.equal((await B.controller.flush()).kind, 'error');

  // Meanwhile A renames s2 online.
  A.controller.update(A.controller.captureBasis('s2')!, renamed(s2, 'Big dam'), 'rename');
  await A.controller.flush();

  // B reloads while still offline: the queue is on disk.
  const B2 = reopen(server, B, 'B2');
  assert.equal(B2.controller.status().pending, 1);
  // The listener delivers A's newer state BEFORE B2 reconnects (v1 overwrote local here).
  B2.controller.receiveRemote(server.doc);
  const view = B2.controller.view();
  assert.equal(JSON.stringify(byId(view, 's1')?.geometry), JSON.stringify(moved(s1, 0.002).geometry), 'pending edit still shown');
  assert.equal(byId(view, 's2')?.properties?.name, 'Big dam', 'remote change shown too');

  B2.gate.offline = false;
  assert.equal((await B2.controller.flush()).kind, 'committed');
  assert.equal(B2.controller.status().pending, 0);
  const state = serverState(server);
  assert.equal(state.records.s1.content?.g ? JSON.stringify(state.records.s1.content.g) : '', JSON.stringify(moved(s1, 0.002).geometry));
  assert.equal(state.records.s2.content?.p.name, 'Big dam');
});

test('crash after commit but before the local ack: replay is recognised by op id and applied once', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const s1 = square('s1', 30.1, -29);
  A.controller.create(s1, 'reticle-create');
  await A.controller.flush();
  A.controller.update(A.controller.captureBasis('s1')!, moved(s1, 0.001), 'native-edit');
  server.loseNextResponse = true;
  assert.equal((await A.controller.flush()).kind, 'error');
  const afterCommit = serverState(server);
  assert.equal(afterCommit.records.s1.rev, 2, 'the commit really happened');
  assert.equal(A.controller.status().pending, 1, 'but the device never heard back, so it still holds the op');

  const A2 = reopen(server, A, 'A2'); // crash + restart
  const report = await A2.controller.flush();
  assert.equal(report.kind, 'committed');
  if (report.kind === 'committed') assert.deepEqual(report.outcomes.map((o) => o.outcome), ['duplicate']);
  assert.equal(serverState(server).records.s1.rev, 2, 'not applied twice');
  assert.equal(A2.controller.status().pending, 0);
});

test('failed local persistence is surfaced as volatile, still syncs, and recovers when storage does', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const journal = 'imbewu_shape_op_v2:'; // pass 2: per-op journal rows
  A.storage.failPrefixes = [journal];
  const r = A.controller.create(square('s1', 30.1, -29), 'reticle-create');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.durable, false);
  assert.equal(A.statuses.at(-1)?.durability, 'volatile', 'the UI is told the change is not safe on this device');
  assert.equal((await A.controller.flush()).kind, 'committed');
  assert.deepEqual(serverLive(server), ['s1'], 'an in-memory op still reaches the server');
  A.storage.failPrefixes = [];
  const again = A.controller.create(square('s2', 30.2, -29), 'reticle-create');
  if (again.ok) assert.equal(again.durable, true);
  assert.equal(A.controller.status().durability, 'durable');

  // Pass 3 (review control 3): when only the journal rows fail and the derived FARM_KEY write
  // succeeds, that write carries the typed op, so a reload recovers it (still reported volatile
  // until it gets a row). The honest limit moved to "EVERY write fails": then it is gone after a
  // reload — which is exactly why the 'volatile' status exists and Map.tsx shows it.
  const C = makeDevice(null, { name: 'C' });
  C.storage.failPrefixes = [journal];
  C.controller.create(square('kept', 31, -29), 'reticle-create');
  C.storage.failPrefixes = [];
  assert.equal(reopen(null, C, 'C2').controller.status().pending, 1);
  const D = makeDevice(null, { name: 'D' });
  D.storage.failAll = true;
  D.controller.create(square('lost', 31, -29), 'reticle-create');
  D.storage.failAll = false;
  assert.equal(reopen(null, D, 'D2').controller.status().pending, 0);
});

test('late account callback: an in-flight flush that resolves after an A→B switch writes nothing locally and calls no UI', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('s1', 30.1, -29), 'reticle-create');
  let snapshotAtSwitch = '';
  let viewsAtSwitch = 0;
  server.beforeCommit = () => {
    A.current.value = false; // Firebase/AuthProvider moved to farmer B mid-transaction
    snapshotAtSwitch = A.storage.snapshot();
    viewsAtSwitch = A.views.length;
  };
  assert.equal((await A.controller.flush()).kind, 'account-changed');
  assert.equal(A.storage.snapshot(), snapshotAtSwitch, 'no storage write after the switch');
  assert.equal(A.views.length, viewsAtSwitch, 'no UI callback after the switch');
  // Further activity for A is refused while A is not mounted; nothing is mutated.
  const docBefore = JSON.stringify(server.doc);
  assert.deepEqual(A.controller.create(square('s2', 30.2, -29), 'reticle-create'), { ok: false, reason: 'account-changed' });
  assert.equal((await A.controller.flush()).kind, 'account-changed');
  A.controller.receiveRemote(server.doc);
  assert.equal(JSON.stringify(server.doc), docBefore);
  // A's queue is still on disk for A's next session, and the server dedupes the replay.
  A.current.value = true;
  const A2 = reopen(server, A, 'A2');
  assert.equal((await A2.controller.flush()).kind, 'committed');
  assert.deepEqual(serverLive(server), ['s1']);
  A2.controller.dispose();
  assert.deepEqual(A2.controller.create(square('s3', 30.3, -29), 'reticle-create'), { ok: false, reason: 'disposed' });
});

test('sample / signed-out controllers have no transport: everything stays local, nothing can leave', async () => {
  const server = new FakeShapeServer();
  const sample = makeDevice(null, { name: 'S', uid: 'sample' });
  assert.ok(sample.controller.create(square('demo', 30, -29), 'reticle-create').ok);
  assert.equal((await sample.controller.flush()).kind, 'skipped');
  assert.equal(sample.controller.status().transport, 'none');
  assert.equal(server.doc, null);
  assert.deepEqual(ids(JSON.parse(sample.storage.getItem(farmKeyFor('sample')) as string)), ['demo'], 'local view still persisted for the page');
});

test('fencing: newer-protocol, corrupt and vanished remote documents are never overwritten', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('s1', 30.1, -29), 'reticle-create');

  server.doc = { protocol: 3, minor: 0, storeId: 'st-future', seq: 9, stateJson: '{"future":true}' };
  const future = JSON.stringify(server.doc);
  assert.deepEqual(await A.controller.flush(), { kind: 'blocked', reason: 'protocol-newer' });
  assert.equal(JSON.stringify(server.doc), future);

  const B = makeDevice(server, { name: 'B' });
  B.controller.create(square('s2', 30.2, -29), 'reticle-create');
  server.doc = { protocol: 2, minor: 0, storeId: 'x', seq: 1, stateJson: '{not json' };
  const corrupt = JSON.stringify(server.doc);
  assert.deepEqual(await B.controller.flush(), { kind: 'blocked', reason: 'remote-corrupt' });
  assert.equal(JSON.stringify(server.doc), corrupt);

  const server2 = new FakeShapeServer();
  const C = makeDevice(server2, { name: 'C' });
  C.controller.create(square('s3', 30.3, -29), 'reticle-create');
  await C.controller.flush();
  server2.doc = null; // someone deleted the document
  C.controller.receiveRemote(null);
  assert.equal(C.controller.status().blocked, 'remote-missing');
  C.controller.create(square('s4', 30.4, -29), 'reticle-create');
  assert.deepEqual(await C.controller.flush(), { kind: 'blocked', reason: 'remote-missing' });
  assert.equal(server2.doc, null, 'no silent genesis over a store this device knew');
  assert.ok(C.controller.exportRecovery().includes('"s4"'), 'everything is still exportable');
});

test('v1 island ingest through the controller: additions arrive, omissions never delete, stale copies cost no round trip', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  const fc = (...features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });
  const v1 = [square('d1', 30, -29), square('d2', 30.1, -29)];
  A.controller.ingestLegacyIsland(fc(...v1), 1000);
  await A.controller.flush();
  assert.deepEqual(serverLive(server), ['d1', 'd2']);
  // A second v2 device sees the same island write: identical op ids, so no double ingest.
  const B = makeDevice(server, { name: 'B' });
  B.controller.ingestLegacyIsland(fc(...v1), 1000);
  const r = await B.controller.flush();
  if (r.kind === 'committed') assert.ok(r.outcomes.every((o) => o.outcome === 'duplicate'));
  // An old client writes only d2 + a new d3.
  A.controller.receiveRemote(server.doc);
  A.controller.ingestLegacyIsland(fc(v1[1], square('d3', 30.2, -29)), 2000);
  assert.equal(A.controller.status().pending, 1, 'd2 is already ingested: skipped client-side');
  await A.controller.flush();
  assert.deepEqual(serverLive(server), ['d1', 'd2', 'd3']);
});

test('v1 cache absorption is idempotent: a crash before the derived overwrite re-derives the SAME op ids (pass 2: replaces the run-once marker)', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  storage.setItem(farmKeyFor(), JSON.stringify({ type: 'FeatureCollection', features: [square('m1', 30, -29), { type: 'Feature', id: 'broken', properties: {}, geometry: null }] }));
  storage.failing.add(farmKeyFor()); // the derived overwrite fails ("crash" before it lands)
  const A = makeDevice(server, { name: 'A', storage });
  const opKeys = () => [...storage.rows.keys()].filter((k) => k.startsWith('imbewu_shape_op_v2:')).sort();
  const firstIds = opKeys();
  assert.equal(firstIds.length, 1);
  assert.ok([...storage.rows].some(([k, v]) => k.startsWith('imbewu_shape_quarantine_v2:') && v.includes('broken')), 'invalid v1 feature quarantined, not dropped');
  storage.failing.clear();
  const A2 = reopen(server, A, 'A2'); // raw cache still unmarked → absorbed again
  assert.deepEqual(opKeys(), firstIds, 'deterministic ids: no duplicate journal rows');
  await A2.controller.flush();
  assert.deepEqual(serverLive(server), ['m1']);
  const A3 = reopen(server, A2, 'A3');
  assert.equal(A3.controller.status().pending, 0, 'derived cache is marked: nothing is re-absorbed');
});

test('shared-site import is additive and idempotent; it never touches the farmer\'s own shapes', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('mine', 30, -29, { name: 'My plot' }), 'reticle-create');
  const shared = { type: 'FeatureCollection', features: [square('theirs', 31, -28), square('theirs2', 31.1, -28)] };
  const first = A.controller.importShared(shared, 'ABC123');
  assert.equal(first.imported, 2);
  const second = A.controller.importShared(shared, 'ABC123');
  assert.equal(second.imported, 0);
  assert.equal(second.skipped, 2);
  await A.controller.flush();
  assert.equal(serverLive(server).length, 3);
  assert.ok(serverLive(server).includes('mine'));
});

test('listener reordering: an older snapshot delivered after a newer one is ignored', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('s1', 30, -29), 'reticle-create');
  await A.controller.flush();
  const older = structuredClone(server.doc);
  A.controller.create(square('s2', 30.1, -29), 'reticle-create');
  await A.controller.flush();
  const newer = structuredClone(server.doc);
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(newer);
  B.controller.receiveRemote(older);
  assert.deepEqual(ids(B.controller.view()), ['s1', 's2']);
  // and a foreign store (manual reset) is not silently adopted
  B.controller.receiveRemote(serializeState(genesisState('st-other')));
  assert.equal(B.controller.status().blocked, 'store-replaced');
  assert.deepEqual(ids(B.controller.view()), ['s1', 's2']);
});
