import assert from 'node:assert/strict';
import test from 'node:test';

import { createShapeSyncController, shapeSyncKeys, shapeSyncNotice, DERIVED_VIEW_MARK } from '../lib/shape-sync/controller.ts';
import {
  applyOps, compactState, contentFromFeature, DEFAULT_RETENTION, FIRESTORE_MAX_DOC_BYTES, FIRESTORE_MAX_FIELD_BYTES, genesisState,
  importShapeId, materializeLive, parseRemoteDoc, planLegacyRollback, pruneAcked, serializeState, SHAPE_DOC_BYTE_BUDGET,
  shapeDocBytes, shapeDocFits, touchDevice, utf8ByteLength, type RemoteShapeDoc, type ShapeOp,
} from '../lib/shape-sync/protocol.ts';
import { FakeShapeServer, MemoryStorage, farmKeyFor, ids, journalOps, journalPrefix, makeDevice, moved, renamed, reopen, square, byId } from './shape-sync-v2-fakes.ts';

// Pass 3 regressions for the three review gaps. Each states the loss it closes.
const serverState = (server: FakeShapeServer) => {
  const parsed = parseRemoteDoc(server.doc);
  if (parsed.kind !== 'ok') throw new Error(parsed.kind);
  return parsed.state;
};
const carryOf = (storage: MemoryStorage) => {
  const v = JSON.parse(storage.getItem(farmKeyFor()) ?? 'null') as Record<string, { carry?: Array<{ op: { kind: string; opId: string; shapeId: string } }> }> | null;
  return v?.[DERIVED_VIEW_MARK]?.carry ?? [];
};

// ── Gap 1: journal rows fail, the derived FARM_KEY write survives ──────────────────────────

test('G1 create: the derived cache CARRIES the typed op; a restart after storage recovers restores it (still reported volatile until then)', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.gate.offline = true;
  A.storage.failPrefixes = [journalPrefix];
  const r = A.controller.create(square('only', 30, -29, { name: 'ONLY-COPY' }), 'reticle-create');
  assert.ok(r.ok && r.durable === false, 'no false durable success');
  const st = A.controller.status();
  assert.equal(st.durability, 'volatile');
  assert.equal(st.volatileOps, 1);
  assert.equal(st.fallbackHeld, 1);
  const notice = shapeSyncNotice(st);
  assert.equal(notice?.level, 'error');
  assert.match(notice?.text ?? '', /fallback copy/);
  assert.deepEqual(carryOf(A.storage).map((e) => e.op.kind), ['create']);
  A.controller.dispose();
  A.storage.failPrefixes = [];
  const B = reopen(server, A, 'B');
  assert.deepEqual(ids(B.controller.view()), ['only']);
  assert.equal(B.controller.status().durability, 'durable', 'storage recovered: it has its own journal row again');
  assert.equal(journalOps(B.storage).length, 1);
  B.gate.offline = false;
  await B.controller.flush();
  assert.equal(serverState(server).records.only.content?.p.name, 'ONLY-COPY');
});

test('G1 update + delete: carried as TYPED ops (never inferred from the snapshot) and replayed after restart', async () => {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('u', 30, -29), 'reticle-create');
  A.controller.create(square('d', 31, -29), 'reticle-create');
  await A.controller.flush();
  A.gate.offline = true;
  A.storage.failPrefixes = [journalPrefix];
  A.controller.update(A.controller.captureBasis('u')!, moved(square('u', 30, -29), 0.25), 'native-edit');
  A.controller.remove(['d'], 'delete');
  assert.deepEqual(carryOf(A.storage).map((e) => `${e.op.kind}:${e.op.shapeId}`), ['update:u', 'delete:d']);
  A.controller.dispose();
  A.storage.failPrefixes = [];
  const B = reopen(server, A, 'B');
  assert.deepEqual(ids(B.controller.view()), ['u'], 'the delete survived the restart');
  assert.equal(JSON.stringify(byId(B.controller.view(), 'u')?.geometry), JSON.stringify(moved(square('u', 30, -29), 0.25).geometry));
  assert.deepEqual(journalOps(B.storage).map((o) => o.kind), ['update', 'delete']);
  B.gate.offline = false;
  const report = await B.controller.flush();
  if (report.kind === 'committed') assert.deepEqual(report.outcomes.map((o) => o.outcome), ['applied', 'applied']);
  const s = serverState(server);
  assert.ok(!s.records.d?.live, 'd deleted on the server (its tombstone may already be compacted)');
  assert.deepEqual(ids(materializeLive(s)), ['u']);
  assert.equal(JSON.stringify(s.records.u.content?.g), JSON.stringify(moved(square('u', 30, -29), 0.25).geometry));
});

test('G1 honest limit: when EVERY write fails nothing survives a reload; that is said explicitly and the export has the geometry before close', () => {
  const A = makeDevice(null, { name: 'A' });
  A.storage.failAll = true;
  const r = A.controller.create(square('gone', 30, -29, { name: 'EXPORT-ME' }), 'reticle-create');
  assert.ok(r.ok && r.durable === false);
  const st = A.controller.status();
  assert.equal(st.fallbackHeld, 0);
  const notice = shapeSyncNotice(st);
  assert.equal(notice?.level, 'error');
  assert.ok(notice?.offerBackup);
  assert.doesNotMatch(notice?.text ?? '', /fallback copy/, 'never claims a fallback that does not exist');
  const exported = A.controller.exportRecovery();
  assert.ok(exported.includes('EXPORT-ME') && exported.includes('coordinates'));
  A.controller.dispose();
  A.storage.failAll = false;
  assert.equal(reopen(null, A, 'B').controller.status().pending, 0);
});

test('G1 a later FARM_KEY write that fails keeps the PREVIOUS consistent value: what was carried survives, what was not is reported as not saved', () => {
  const A = makeDevice(null, { name: 'A' });
  A.storage.failPrefixes = [journalPrefix];
  A.controller.create(square('first', 30, -29), 'reticle-create');
  A.storage.failPrefixes = [journalPrefix, 'imbewu_farm_shapes::'];
  A.controller.create(square('second', 31, -29), 'reticle-create');
  const st = A.controller.status();
  assert.equal(st.volatileOps, 2);
  assert.equal(st.fallbackHeld, 1);
  assert.doesNotMatch(shapeSyncNotice(st)?.text ?? '', /fallback copy/);
  A.controller.dispose();
  A.storage.failPrefixes = [];
  assert.deepEqual(ids(reopen(null, A, 'B').controller.view()), ['first']);
});

test('G1 another tab writing the cache keeps this tab\'s carried op (it ingests the carry before rewriting)', () => {
  const storage = new MemoryStorage();
  const A = makeDevice(null, { name: 'A', storage });
  const B = makeDevice(null, { name: 'B', storage });
  storage.failPrefixes = [journalPrefix];
  A.controller.create(square('from-a', 30, -29), 'reticle-create');
  storage.failPrefixes = [];
  B.controller.create(square('from-b', 31, -29), 'reticle-create'); // B rewrites FARM_KEY
  assert.deepEqual(carryOf(storage).map((e) => `${e.op.kind}:${e.op.shapeId}`), ['create:from-a'], 'B\'s rewrite still carries A\'s op');
  A.controller.dispose(); B.controller.dispose();
  assert.deepEqual(ids(reopen(null, A, 'C').controller.view()), ['from-a', 'from-b']);
});

test('G1 a once-volatile op is never ack-pruned: a copy still in another tab\'s memory replays as a harmless duplicate', async () => {
  const server = new FakeShapeServer();
  const storage = new MemoryStorage();
  const A = makeDevice(server, { name: 'A', storage });
  A.gate.offline = true;
  storage.failPrefixes = [journalPrefix];
  A.controller.create(square('x', 30, -29), 'reticle-create');
  const opId = carryOf(storage)[0].op.opId;
  storage.failPrefixes = [];
  const B = makeDevice(server, { name: 'B', storage });  // ingests the carry, gives it a row
  await B.controller.flush();
  await B.controller.flush();
  await B.controller.flush();
  assert.ok(serverState(server).applied[opId], 'dedupe entry kept');
  assert.equal([...storage.rows.keys()].filter((k) => k.startsWith(`imbewu_shape_ack_v2:${opId}`)).length, 0, 'no ack row ever');
  A.gate.offline = false;
  const replay = await A.controller.flush();          // A still holds x in memory
  if (replay.kind === 'committed') assert.equal(replay.outcomes.find((o) => o.opId === opId)?.outcome, 'duplicate');
  assert.equal(serverState(server).records.x.rev, 1);
  assert.equal(serverState(server).records.x.conflicts.length, 0);
});

// ── Gap 2: UTF-8 byte bound ────────────────────────────────────────────────────────────────

test('G2 utf8ByteLength equals real UTF-8 encoding for ASCII, 2-byte, BMP (Han), astral pairs and lone surrogates', () => {
  const cases = ['', 'a', 'é', '漢', '𝄞', '😀a', 'a漢é𝄞', '\ud83d', '\ude00', 'x\ud83d', '\ud83dx', '\ude00\ud83d', '߿ࠀ￿', 'Ünïcödé 中文 العربية हिन्दी 🌍'];
  for (const c of cases) assert.equal(utf8ByteLength(c), new TextEncoder().encode(c).length, JSON.stringify(c));
  for (const c of cases) assert.equal(utf8ByteLength(c.repeat(1000)), Buffer.byteLength(c.repeat(1000), 'utf8'));
});

test('G2 budget boundary is exact in bytes (ASCII, BMP and astral) and leaves real headroom under both official limits', () => {
  const base: RemoteShapeDoc = { protocol: 2, minor: 0, storeId: 'st-boundary', seq: 1, stateJson: '' };
  const overhead = shapeDocBytes(base);
  const fill = SHAPE_DOC_BYTE_BUDGET - overhead;              // bytes the stateJson may still use
  const at = (stateJson: string) => shapeDocFits({ ...base, stateJson });
  assert.equal(at('a'.repeat(fill)).fits, true);
  assert.equal(at('a'.repeat(fill + 1)).fits, false);
  assert.equal(at('a'.repeat(fill - 3) + '漢').fits, true);
  assert.equal(at('a'.repeat(fill - 2) + '漢').fits, false);
  assert.equal(at('a'.repeat(fill - 4) + '𝄞').fits, true);
  assert.equal(at('a'.repeat(fill - 3) + '𝄞').fits, false);
  assert.ok(SHAPE_DOC_BYTE_BUDGET <= FIRESTORE_MAX_DOC_BYTES - 16_384);
  assert.ok(utf8ByteLength('a'.repeat(fill)) + 1 < FIRESTORE_MAX_FIELD_BYTES);
  // The pass-1/2 rule: 400,000 Han = 400,000 code units (< 900,000) but 1,200,000 bytes.
  assert.equal(at('漢'.repeat(400_000)).fits, false);
});

function hugeNote(note: string) {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('base', 31, -29), 'reticle-create');
  const r = A.controller.create(square('big', 30, -29, { note }), 'reticle-create');
  return { server, A, r };
}

test('G2 400,000 Han characters: BLOCKED as too-large, nothing committed or truncated, queue and export keep it, clearing the note unblocks', async () => {
  const note = '漢'.repeat(400_000);
  const { server, A, r } = hugeNote(note);
  assert.ok(r.ok && r.durable);
  const report = await A.controller.flush();
  assert.deepEqual(report, { kind: 'blocked', reason: 'too-large' });
  assert.equal(server.doc, null, 'no write at all (the batch is atomic)');
  assert.equal(A.controller.status().pending, 2);
  assert.equal(shapeSyncNotice(A.controller.status())?.level, 'error');
  assert.ok(A.controller.exportRecovery().includes(note), 'full payload in the recovery export');
  const A2 = reopen(server, A, 'A2');                         // survives reload, blocks again
  assert.equal((await A2.controller.flush()).kind, 'blocked');
  A2.controller.update(A2.controller.captureBasis('big')!, square('big', 30, -29), 'rename'); // farmer clears the note
  const after = await A2.controller.flush();
  assert.equal(after.kind, 'committed');
  const doc = server.doc as unknown as RemoteShapeDoc;
  assert.ok(shapeDocBytes(doc) <= SHAPE_DOC_BYTE_BUDGET);
  assert.ok(!JSON.stringify(doc).includes('漢'), 'the server never saw a truncated copy');
});

test('G2 astral characters: 260,000 × U+1D11E is 520,000 code units (passed the old rule) but 1,040,000 bytes → blocked', async () => {
  const { server, A } = hugeNote('𝄞'.repeat(260_000));
  assert.deepEqual(await A.controller.flush(), { kind: 'blocked', reason: 'too-large' });
  assert.equal(server.doc, null);
});

test('G2 multilingual content under the budget commits, and what committed is within the byte budget (our bound, not proof of Firestore acceptance)', async () => {
  const { server, A } = hugeNote('é漢𝄞a'.repeat(60_000)); // 600,000 bytes of note
  assert.equal((await A.controller.flush()).kind, 'committed');
  const doc = server.doc as unknown as RemoteShapeDoc;
  assert.ok(shapeDocBytes(doc) <= SHAPE_DOC_BYTE_BUDGET);
  assert.equal(serverState(server).records.big.content?.p.note, 'é漢𝄞a'.repeat(60_000), 'stored intact');
});

// ── Gap 3: share-import deletion identity ──────────────────────────────────────────────────

const shareFc = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const RETIRED = { ...DEFAULT_RETENTION, legacyBridgeRetired: true };

function retiredDevice(server: FakeShapeServer, name: string, storage = new MemoryStorage()) {
  let k = 0;
  const c = createShapeSyncController({
    keys: shapeSyncKeys((b) => `${b}::imbewu-owner::uid:farmer`), storage, transport: server.transport(),
    isCurrent: () => true, now: () => 1_700_000_000_000, randomId: () => `${name}${k++}`, schedule: () => () => {}, retention: RETIRED,
  });
  c.start();
  return { c, storage };
}

test('G3 controller: import → delete → acks pruned + tombstone compacted (bridge retired) → re-opening the link does NOT resurrect; new shapes in it still arrive', async () => {
  const server = new FakeShapeServer();
  const { c, storage } = retiredDevice(server, 'A');
  const share = shareFc(square('fieldA', 30, -29), square('fieldB', 31, -29));
  c.importShared(share, 'CODE1');
  await c.flush();
  const idA = importShapeId('CODE1', 'fieldA', 0);
  c.remove([idA], 'delete');
  for (let i = 0; i < 4; i++) { c.nudge(); await c.flush(); c.create(square(`tick${i}`, 40 + i, -29), 'reticle-create'); await c.flush(); }
  const s = serverState(server);
  assert.equal(s.records[idA], undefined, 'the tombstone really was compacted away');
  assert.equal(typeof s.deletedImports?.[idA], 'number', 'its identity was kept');
  const again = c.importShared(shareFc(square('fieldA', 30, -29), square('fieldB', 31, -29), square('fieldC', 32, -29)), 'CODE1');
  assert.equal(again.imported, 1);
  assert.equal(again.skipped, 2);
  await c.flush();
  const live = Object.values(serverState(server).records).filter((r) => r.live && r.origin === 'import').map((r) => r.id).sort();
  assert.deepEqual(live, [importShapeId('CODE1', 'fieldB', 1), importShapeId('CODE1', 'fieldC', 2)].sort());
  // A different share containing the same source feature is a genuine new import.
  assert.equal(c.importShared(shareFc(square('fieldA', 30, -29)), 'CODE2').imported, 1);
  void storage;
});

test('G3 protocol: the stale import op itself (a lagging device replaying it) is a no-op after compaction', () => {
  const content = contentFromFeature(square('src', 30, -29)); assert.ok(content.ok);
  const shapeId = importShapeId('S', 'src', 0);
  const imp: ShapeOp = { kind: 'import', opId: 'im-1', device: 'dev-abcd1', shapeId, baseSeq: 0, deps: [], source: 'share-import', content: content.content };
  let st = applyOps(genesisState('st-x'), [imp]).state;
  st = applyOps(st, [{ kind: 'delete', opId: 'del-1', device: 'dev-abcd1', shapeId, baseSeq: st.seq, baseRev: 1, deps: ['im-1'], source: 'delete' }]).state;
  touchDevice(st, 'dev-abcd1', { nowMs: 1000 });
  st = compactState(pruneAcked(st, ['im-1', 'del-1']), 1000, RETIRED);
  assert.equal(st.records[shapeId], undefined);
  for (let i = 0; i < 3; i++) st = compactState(st, 1000 + i, RETIRED);
  assert.equal(st.deletedImports?.[shapeId] !== undefined, true, 'compaction never forgets it');
  const out = applyOps(st, [imp, { ...imp, opId: 'im-2-changed-content' }]);
  assert.deepEqual(out.outcomes.map((o) => o.reason), ['imported earlier and deleted', 'imported earlier and deleted']);
  assert.equal(materializeLive(out.state).features.length, 0);
});

test('G3 deletion identity round-trips through the document and fails closed when malformed', () => {
  const st = genesisState('st-rt');
  st.deletedImports = { 'imp-aaaaaaaaaaaa-bbbbbbbbbbbb': 4 };
  const doc = serializeState(st);
  const parsed = parseRemoteDoc(doc);
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') assert.deepEqual(parsed.state.deletedImports, st.deletedImports);
  const bad = serializeState({ ...st, deletedImports: { x: -1 } as Record<string, number> });
  assert.equal(parseRemoteDoc(bad).kind, 'corrupt');
});

test('G3 rollback plan never hands a deleted import back to v1', () => {
  const st = genesisState('st-rb');
  const shapeId = importShapeId('S', 'src', 0);
  st.deletedImports = { [shapeId]: 3 };
  const plan = planLegacyRollback(st, shareFc({ ...square(shapeId, 30, -29) }));
  assert.deepEqual(ids(plan.fc), []);
});

test('G3 a share link reopened BEFORE compaction (tombstone still present) behaves as in pass 2', () => {
  const content = contentFromFeature(square('src', 30, -29)); assert.ok(content.ok);
  const shapeId = importShapeId('S', 'src', 0);
  const imp: ShapeOp = { kind: 'import', opId: 'im-1', device: 'dev-abcd1', shapeId, baseSeq: 0, deps: [], source: 'share-import', content: content.content };
  let st = applyOps(genesisState('st-y'), [imp]).state;
  st = applyOps(st, [{ kind: 'delete', opId: 'del-1', device: 'dev-abcd1', shapeId, baseSeq: st.seq, baseRev: 1, deps: ['im-1'], source: 'delete' }]).state;
  const out = applyOps(st, [{ ...imp, opId: 'im-again' }]);
  assert.equal(out.outcomes[0].reason, 'already imported');
  assert.equal(st.deletedImports, undefined);
  void renamed;
});
