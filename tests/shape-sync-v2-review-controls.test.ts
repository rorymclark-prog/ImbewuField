// Independent Codex review controls. Expected to FAIL on authentic Claude first proposal.
// Not a production patch and never a replacement for tests/shape-sync-loss.test.ts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeShapeServer, MemoryStorage, makeDevice, reopen, square, ids } from './shape-sync-v2-fakes.ts';
const farmCache = 'imbewu_farm_shapes::imbewu-owner::uid:farmer';
class FaultStorage extends MemoryStorage {
  blockedPrefixes: string[] = [];
  override setItem(key: string, value: string): void {
    if (this.blockedPrefixes.some(prefix => key.startsWith(prefix))) throw new Error('QuotaExceededError');
    super.setItem(key, value);
  }
}
const queuePrefixes = ['imbewu_shape_ops_v2', 'imbewu_shape_op_v2:'];

test('REVIEW: two same-account offline tabs preserve both queues across restart before flush', () => {
  const storage = new MemoryStorage();
  const a = makeDevice(null, { name: 'tabA', storage });
  const b = makeDevice(null, { name: 'tabB', storage });
  assert.equal(a.controller.create(square('shp-X', 30, -29), 'reticle-create').ok, true);
  assert.equal(b.controller.create(square('shp-Y', 31, -29), 'reticle-create').ok, true);
  a.controller.dispose(); b.controller.dispose();
  const restarted = makeDevice(null, { name: 'reload', storage });
  assert.deepEqual(ids(restarted.controller.view()), ['shp-X', 'shp-Y']);
});

test('REVIEW: failed migration backup/quarantine persistence leaves original raw cache recoverable', () => {
  const storage = new FaultStorage();
  const raw = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'bad-original', properties: { original: 'keep me' }, geometry: { type: 'Polygon', coordinates: [] } }] });
  storage.setItem(farmCache, raw);
  storage.blockedPrefixes = [...queuePrefixes, 'imbewu_farm_shapes_v1_backup', 'imbewu_shape_quarantine_v2'];
  const a = makeDevice(null, { name: 'migration', storage });
  a.controller.dispose();
  assert.ok(storage.snapshot().includes('keep me'), 'only original must remain somewhere on disk when safety copies fail; new journal key names are allowed');
});

test('REVIEW: failed pending persist does not erase surviving farm cache upon restart', () => {
  const storage = new FaultStorage();
  const a = makeDevice(null, { name: 'writer', storage });
  storage.blockedPrefixes = queuePrefixes;
  const recorded = a.controller.create(square('shp-only-copy', 30, -29), 'reticle-create');
  assert.ok(recorded.ok && recorded.durable === false);
  a.controller.dispose(); storage.blockedPrefixes = [];
  const restarted = reopen(null, a, 'restart');
  const recovered = restarted.controller.exportRecovery();
  assert.ok(ids(restarted.controller.view()).includes('shp-only-copy') || (recovered.includes('shp-only-copy') && recovered.includes('coordinates')), 'accepted geometry must remain visible or explicitly held for recovery');
});

test('REVIEW: serialized remote document must not commit beyond Firestore byte ceiling', async () => {
  const server = new FakeShapeServer();
  const a = makeDevice(server, { name: 'unicode' });
  const recorded = a.controller.create(square('shp-unicode', 30, -29, { note: '漢'.repeat(400000) }), 'reticle-create');
  if (!recorded.ok) { assert.equal(server.doc, null, 'explicit preflight refusal may safely block an oversized feature'); return; }
  const report = await a.controller.flush();
  if (report.kind === 'committed') assert.ok(Buffer.byteLength(JSON.stringify(server.doc), 'utf8') <= 1_048_576, 'UTF-16 string length is not a Firestore byte bound');
});

import * as Protocol from '../lib/shape-sync/protocol.ts';
import { applyOps, compactState, contentFromFeature, DEFAULT_RETENTION, genesisState, importShapeId, materializeLive, touchDevice, type ShapeOp } from '../lib/shape-sync/protocol.ts';
test('REVIEW: reopening a deleted share import after bridge retirement/compaction must not resurrect it', () => {
  const content = contentFromFeature(square('source', 30, -29)); assert.ok(content.ok);
  const shapeId = importShapeId('synthetic-share', 'source', 0);
  const imported: ShapeOp = { kind: 'import', opId: 'im-import-control', device: 'dev-review1', shapeId, baseSeq: 0, deps: [], source: 'share-import', content: content.content };
  const added = applyOps(genesisState('st-review'), [imported]).state;
  const deleted = applyOps(added, [{ kind: 'delete', opId: 'op-delete-control', device: 'dev-review1', shapeId, baseSeq: added.seq, baseRev: added.records[shapeId].rev, deps: ['im-import-control'], source: 'delete' }]).state;
  const ackInfo = { ackSeq: deleted.seq, nowMs: 1000 };
  touchDevice(deleted, 'dev-review1', ackInfo);
  const prune = Reflect.get(Protocol, 'pruneAcked');
  const acknowledged = typeof prune === 'function' ? prune(deleted, ['im-import-control', 'op-delete-control']) : deleted;
  const compacted = compactState(acknowledged, 1000, { ...DEFAULT_RETENTION, legacyBridgeRetired: true });
  const reopened = applyOps(compacted, [imported]).state;
  assert.equal(materializeLive(reopened).features.length, 0, 'retiring old-client bridge must not erase imported-deletion identity');
});
