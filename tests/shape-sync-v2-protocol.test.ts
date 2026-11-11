import test from 'node:test';
import assert from 'node:assert/strict';
import type { Feature } from 'geojson';

import {
  applyOps, assignLegacyIds, canonicalJson, compactState, contentFromFeature, diffContent, genesisState, pruneAcked,
  importShapeId, listConflicts, materializeForLegacyRollback, materializeLive, parseRemoteDoc, serializeState,
  touchDevice, DEFAULT_RETENTION,
  type ShapeContent, type ShapeOp, type ShapeStoreState,
} from '../lib/shape-sync/protocol.ts';
import { byId, ids, moved, renamed, square } from './shape-sync-v2-fakes.ts';

// Ops are built by hand here so every test states exactly what each device saw (baseRev/deps).
let n = 0;
const content = (f: Feature): ShapeContent => {
  const r = contentFromFeature(f);
  assert.ok(r.ok, 'fixture feature must be valid');
  return r.content;
};
const create = (device: string, f: Feature): ShapeOp => ({
  kind: 'create', opId: `${device}-c${n++}`, device, shapeId: String(f.id), baseSeq: 0, deps: [], source: 'reticle-create', content: content(f),
});
const update = (device: string, before: Feature, after: Feature, baseRev: number, deps: string[] = []): ShapeOp => ({
  kind: 'update', opId: `${device}-u${n++}`, device, shapeId: String(after.id), baseSeq: 0, deps, source: 'native-edit',
  baseRev, patch: diffContent(content(before), content(after)), proposed: content(after),
});
const del = (device: string, id: string, baseRev: number, deps: string[] = []): ShapeOp => ({
  kind: 'delete', opId: `${device}-d${n++}`, device, shapeId: id, baseSeq: 0, deps, source: 'delete', baseRev,
});
const run = (state: ShapeStoreState, ops: ShapeOp[]) => applyOps(state, ops);
const live = (state: ShapeStoreState) => materializeLive(state);
const geometryOf = (state: ShapeStoreState, id: string) => canonicalJson(byId(live(state), id)?.geometry);

const BASE = square('base', 30, -29, { name: 'Home plot' });
function seeded(...features: Feature[]): ShapeStoreState {
  return run(genesisState('st-test'), [create('seed', BASE), ...features.map((f) => create('seed', f))]).state;
}

test('TODO-scenario ordering: concurrent additions from two stale devices both survive, in either order', () => {
  const s0 = seeded();
  const a = create('A', square('a', 30.01, -29));
  const b = create('B', square('b', 30.02, -29)); // B built its op without ever seeing 'a'
  const ab = run(s0, [a, b]).state;
  const ba = run(s0, [b, a]).state;
  assert.deepEqual(ids(live(ab)), ['a', 'b', 'base']);
  assert.equal(canonicalJson(live(ab)), canonicalJson(live(run(s0, [a, b]).state)));
  assert.deepEqual(ids(live(ba)), ['a', 'b', 'base']);
  assert.equal(listConflicts(ab).length, 0);
});

test('independent same-count edits (different shapes, and disjoint fields of one shape) all merge; order does not matter', () => {
  const s1 = square('s1', 30.1, -29, { name: 'Orchard' });
  const s2 = square('s2', 30.2, -29, { name: 'Dam' });
  const s0 = seeded(s1, s2); // every record at rev 1
  const aMoveS1 = update('A', s1, moved(s1, 0.0005), 1);
  const bRenameS2 = update('B', s2, renamed(s2, 'Big dam'), 1);
  const bRenameS1 = update('B', s1, renamed(s1, 'Old orchard'), 1); // geometry vs name: disjoint fields
  const orders = [[aMoveS1, bRenameS2, bRenameS1], [bRenameS1, bRenameS2, aMoveS1], [bRenameS2, aMoveS1, bRenameS1]];
  const results = orders.map((o) => run(s0, o));
  for (const r of results) {
    assert.ok(r.outcomes.every((o) => o.outcome === 'applied'), JSON.stringify(r.outcomes));
    assert.equal(r.state.records.s1.content?.p.name, 'Old orchard');
    assert.equal(geometryOf(r.state, 's1'), canonicalJson(moved(s1, 0.0005).geometry));
    assert.equal(r.state.records.s2.content?.p.name, 'Big dam');
    assert.equal(live(r.state).features.length, 3);
  }
  assert.equal(canonicalJson(live(results[0].state)), canonicalJson(live(results[1].state)));
  assert.equal(canonicalJson(live(results[0].state)), canonicalJson(live(results[2].state)));
});

test('same-feature concurrent edit is preserved as a conflict branch, never last-writer-wins, and the farmer resolves it', () => {
  const s1 = square('s1', 30.1, -29);
  const s0 = seeded(s1);
  const aEdit = update('A', s1, moved(s1, 0.001), 1);
  const bEdit = update('B', s1, moved(s1, -0.001), 1);
  for (const order of [[aEdit, bEdit], [bEdit, aEdit]]) {
    const r = run(s0, order);
    assert.deepEqual(r.outcomes.map((o) => o.outcome), ['applied', 'conflict']);
    const [conflict] = listConflicts(r.state);
    assert.equal(conflict.kind, 'concurrent-edit');
    assert.deepEqual(conflict.fields, ['g']);
    // Both versions exist in the state — whichever committed second is the preserved branch.
    const versions = new Set([canonicalJson(conflict.current?.geometry), canonicalJson(conflict.other?.geometry)]);
    assert.deepEqual(versions, new Set([canonicalJson(moved(s1, 0.001).geometry), canonicalJson(moved(s1, -0.001).geometry)]));
  }
  const r = run(s0, [aEdit, bEdit]).state;
  const cid = listConflicts(r)[0].conflictId;
  const resolve = (choice: 'keep-current' | 'use-branch' | 'keep-both'): ShapeOp => ({
    kind: 'resolve', opId: `R-${choice}`, device: 'A', shapeId: 's1', baseSeq: r.seq, deps: [], source: 'resolve', conflictId: cid, choice,
    ...(choice === 'keep-both' ? { newShapeId: 's1-copy' } : {}),
  });
  const useOther = run(r, [resolve('use-branch')]).state;
  assert.equal(geometryOf(useOther, 's1'), canonicalJson(moved(s1, -0.001).geometry));
  assert.equal(listConflicts(useOther).length, 0);
  const keep = run(r, [resolve('keep-current')]).state;
  assert.equal(geometryOf(keep, 's1'), canonicalJson(moved(s1, 0.001).geometry));
  const both = run(r, [resolve('keep-both')]).state;
  assert.deepEqual(ids(live(both)), ['base', 's1', 's1-copy']);
  assert.equal(geometryOf(both, 's1-copy'), canonicalJson(moved(s1, -0.001).geometry));
  // A second device resolving the same conflict later is a no-op, not a second mutation.
  const twice = run(useOther, [{ ...resolve('keep-current'), opId: 'R-late' }]);
  assert.equal(twice.outcomes[0].outcome, 'noop');
});

test('offline edit vs delete, both arrival orders: the edit is preserved and the farmer decides', () => {
  const s1 = square('s1', 30.1, -29, { name: 'Veg garden' });
  const s0 = seeded(s1);
  const offlineEdit = update('B', s1, moved(s1, 0.002), 1);
  const deleteIt = del('A', 's1', 1);

  // delete lands first, the offline edit arrives later
  const d1 = run(s0, [deleteIt, offlineEdit]).state;
  assert.deepEqual(ids(live(d1)), ['base']);
  let [c] = listConflicts(d1);
  assert.equal(c.kind, 'edit-after-delete');
  assert.equal(c.live, false);
  assert.equal(canonicalJson(c.other?.geometry), canonicalJson(moved(s1, 0.002).geometry));
  const restored = run(d1, [{ kind: 'resolve', opId: 'R1', device: 'B', shapeId: 's1', baseSeq: d1.seq, deps: [], source: 'resolve', conflictId: c.conflictId, choice: 'use-branch' }]).state;
  assert.deepEqual(ids(live(restored)), ['base', 's1']);
  assert.equal(restored.records.s1.content?.p.name, 'Veg garden');

  // edit lands first, the stale delete arrives later
  const d2 = run(s0, [offlineEdit, deleteIt]).state;
  assert.deepEqual(ids(live(d2)), ['base', 's1']);
  [c] = listConflicts(d2);
  assert.equal(c.kind, 'delete-vs-edit');
  assert.equal(c.other, null, 'a delete branch carries no content');
  const deleted = run(d2, [{ kind: 'resolve', opId: 'R2', device: 'A', shapeId: 's1', baseSeq: d2.seq, deps: [], source: 'resolve', conflictId: c.conflictId, choice: 'use-branch' }]).state;
  assert.deepEqual(ids(live(deleted)), ['base']);
});

test('delete-all is N explicit deletes: unseen shapes survive, stale replay and stale v1 copies cannot resurrect', () => {
  const s1 = square('s1', 30.1, -29), s2 = square('s2', 30.2, -29), s3 = square('s3', 30.3, -29);
  const s0 = seeded(s1, s2, s3);
  const deleteAll = ['base', 's1', 's2', 's3'].map((id) => del('A', id, 1));
  const offlineB = [create('B', square('d', 30.4, -29)), update('B', s1, moved(s1, 0.003), 1)];
  const r = run(s0, [...deleteAll, ...offlineB]);
  assert.deepEqual(ids(live(r.state)), ['d'], 'B\'s new shape was never seen by the delete-all, so it survives');
  assert.equal(listConflicts(r.state)[0].kind, 'edit-after-delete', 'B\'s offline edit to s1 is held, not dropped');
  const before = canonicalJson(r.state);
  const replay = run(r.state, [...deleteAll, ...offlineB]); // a crashed client replays its whole queue
  assert.ok(replay.outcomes.every((o) => o.outcome === 'duplicate'));
  assert.equal(canonicalJson(replay.state), before);
  // A legacy copy that re-asserts the deleted shapes cannot bring them back.
  const legacySeeded = run(genesisState('st-legacy'), ['s2', 's3'].map((id, i) => ({
    kind: 'legacy', opId: `L0-${i}`, device: 'v1', shapeId: id, baseSeq: 0, deps: [], source: 'legacy-island', content: content(id === 's2' ? s2 : s3), island: 100,
  } as ShapeOp))).state;
  const afterDelete = run(legacySeeded, [del('A', 's2', 1), del('A', 's3', 1)]).state;
  const stale = run(afterDelete, ['s2', 's3'].map((id, i) => ({
    kind: 'legacy', opId: `L1-${i}`, device: 'v1', shapeId: id, baseSeq: 0, deps: [], source: 'legacy-island', content: content(id === 's2' ? s2 : s3), island: 200,
  } as ShapeOp)));
  assert.deepEqual(stale.outcomes.map((o) => o.outcome), ['noop', 'noop']);
  assert.deepEqual(ids(live(stale.state)), []);
});

test('op idempotency and reordering: every interleaving of two devices converges; duplicates change nothing', () => {
  const s1 = square('s1', 30.1, -29), s2 = square('s2', 30.2, -29);
  const s0 = seeded(s1, s2);
  const a = [create('A', square('a', 30.5, -29)), update('A', s1, moved(s1, 0.0004), 1)];
  const b = [create('B', square('b', 30.6, -29)), update('B', s2, renamed(s2, 'Pond'), 1), del('B', 'base', 1)];
  // all merges of a and b that keep each device's own order
  const merges: ShapeOp[][] = [];
  const weave = (i: number, j: number, acc: ShapeOp[]) => {
    if (i === a.length && j === b.length) { merges.push(acc); return; }
    if (i < a.length) weave(i + 1, j, [...acc, a[i]]);
    if (j < b.length) weave(i, j + 1, [...acc, b[j]]);
  };
  weave(0, 0, []);
  assert.equal(merges.length, 10);
  // Contract: CONTENT per id is order-independent. The FeatureCollection's array order follows the
  // store's commit order (createdSeq) — v1's creation/draw order — and a store has exactly one
  // commit order, so every device that adopts it renders the same order.
  const byIdMap = (st: ShapeStoreState) => canonicalJson(Object.fromEntries(live(st).features.map((f) => [String(f.id), f])));
  const expected = byIdMap(run(s0, merges[0]).state);
  for (const m of merges) {
    const r = run(s0, m);
    assert.equal(byIdMap(r.state), expected);
    const dup = run(r.state, [...m].reverse());
    assert.ok(dup.outcomes.every((o) => o.outcome === 'duplicate'));
    assert.equal(canonicalJson(live(dup.state)), canonicalJson(live(r.state)), 'duplicates do not even reorder');
  }
  assert.deepEqual(Object.keys(JSON.parse(expected)).sort(), ['a', 'b', 's1', 's2']);
});

test('own ops chain through deps without self-conflict; ops built on an own conflict branch fold into that branch', () => {
  const s0 = seeded();
  const fresh = square('n1', 31, -29);
  const c = create('A', fresh);
  const u1 = update('A', fresh, moved(fresh, 0.001), 0, [c.opId]);            // server rev unknown (0)
  const u2 = update('A', moved(fresh, 0.001), renamed(moved(fresh, 0.001), 'Nursery'), 0, [c.opId, u1.opId]);
  const chain = run(s0, [c, u1, u2]);
  assert.deepEqual(chain.outcomes.map((o) => o.outcome), ['applied', 'applied', 'applied']);
  assert.equal(chain.state.records.n1.content?.p.name, 'Nursery');

  const s1 = square('s1', 30.1, -29);
  const withS1 = seeded(s1);
  const other = update('B', s1, moved(s1, 0.002), 1);
  const mine1 = update('A', s1, moved(s1, -0.002), 1);
  const mine2 = update('A', moved(s1, -0.002), moved(s1, -0.004), 1, [mine1.opId]);
  const r = run(withS1, [other, mine1, mine2]);
  assert.deepEqual(r.outcomes.map((o) => o.outcome), ['applied', 'conflict', 'conflict']);
  const conflicts = listConflicts(r.state);
  assert.equal(conflicts.length, 1, 'mine2 joined mine1\'s branch instead of opening a second one');
  assert.equal(canonicalJson(conflicts[0].other?.geometry), canonicalJson(moved(s1, -0.004).geometry));
});

test('malformed and missing legacy ids get deterministic, distinct ids; coincident shapes are never merged', () => {
  const twin = square('x', 30, -29);
  const idless = (f: Feature) => { const c = structuredClone(f) as unknown as Record<string, unknown>; delete c.id; return c; };
  const features = [
    idless(twin), idless(twin),                          // two coincident id-less shapes
    { ...square('dup', 30.1, -29) }, { ...square('dup', 30.2, -29) }, // one id, two shapes
    { ...square('ok-id', 30.3, -29) },
    { ...square('x', 30.4, -29), id: 7 },                // numeric id
    { ...square('x', 30.5, -29), id: 'has spaces' },     // invalid string id
    { type: 'Feature', id: 'bad', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] } },
    'not a feature',
  ];
  const a = assignLegacyIds(features, 'island');
  const b = assignLegacyIds(features, 'island');
  assert.deepEqual(a.items.map((i) => i.shapeId), b.items.map((i) => i.shapeId), 'deterministic');
  const shapeIds = a.items.map((i) => i.shapeId);
  assert.equal(new Set(shapeIds).size, shapeIds.length, 'all distinct');
  assert.equal(a.items.length, 7);
  assert.ok(shapeIds.includes('ok-id'));
  assert.ok(shapeIds.includes('lgn-7'));
  assert.ok(!shapeIds.includes('dup'), 'an ambiguous id is not given to either shape');
  assert.deepEqual(a.quarantined.map((q) => q.index), [7, 8], 'invalid ones are quarantined verbatim, not dropped');
  const otherDevice = assignLegacyIds(features.slice(0, 1), 'local:dev-other');
  assert.notEqual(otherDevice.items[0].shapeId, a.items[0].shapeId, 'id-less copies on different scopes never merge by digest');
});

test('v1 bridge: omission never deletes, a stale v1 copy cannot revert a v2 edit, a newer island write merges, older observations are superseded', () => {
  const s1 = square('s1', 30.1, -29, { name: 'Orchard' });
  const s2 = square('s2', 30.2, -29, { name: 'Dam' });
  const s3 = square('s3', 30.3, -29, { name: 'Swale' });
  const legacy = (opId: string, f: Feature, island: number): ShapeOp => ({
    kind: 'legacy', opId, device: 'v2dev', shapeId: String(f.id), baseSeq: 0, deps: [], source: island ? 'legacy-island' : 'legacy-local', content: content(f), island,
  });
  let s = run(genesisState('st-bridge'), [legacy('i1a', s1, 1000), legacy('i1b', s2, 1000), legacy('i1c', s3, 1000)]).state;
  assert.deepEqual(ids(live(s)), ['s1', 's2', 's3']);
  // A v2 device renames s1.
  s = run(s, [update('A', s1, renamed(s1, 'Old orchard'), 1)]).state;
  // An old client writes the island again: s1 unchanged (its stale copy), s2 moved, s3 omitted.
  const r = run(s, [legacy('i2a', s1, 2000), legacy('i2b', moved(s2, 0.001), 2000)]);
  assert.deepEqual(r.outcomes.map((o) => o.outcome), ['noop', 'applied']);
  assert.equal(r.state.records.s1.content?.p.name, 'Old orchard', 'stale v1 copy did not revert the v2 rename');
  assert.equal(geometryOf(r.state, 's2'), canonicalJson(moved(s2, 0.001).geometry));
  assert.deepEqual(ids(live(r.state)), ['s1', 's2', 's3'], 's3 omitted by the old client is NOT deleted');
  // An older island observation (delivered late to some device) is superseded by the island itself.
  const late = run(r.state, [legacy('i1b-late', moved(s2, -0.005), 1500)]);
  assert.equal(late.outcomes[0].outcome, 'noop');
  // An old-client edit to a field v2 also changed is preserved for the farmer, not applied.
  const clash = run(r.state, [legacy('i3a', renamed(s1, 'Mango orchard'), 3000)]);
  assert.equal(clash.outcomes[0].outcome, 'conflict');
  assert.equal(listConflicts(clash.state)[0].kind, 'legacy-divergence');
  assert.equal(clash.state.records.s1.content?.p.name, 'Old orchard');
  // This device's unversioned v1 cache that differs can't be ordered: branch, not overwrite.
  const local = run(r.state, [legacy('l1', moved(s3, 0.01), 0)]);
  assert.equal(local.outcomes[0].outcome, 'conflict');
  assert.equal(geometryOf(local.state, 's3'), canonicalJson(s3.geometry));
});

test('remote documents fail closed: absent, corrupt, newer protocol and envelope mismatch are distinguished', () => {
  const good = serializeState(seeded());
  assert.equal(parseRemoteDoc(null).kind, 'absent');
  assert.equal(parseRemoteDoc(good).kind, 'ok');
  assert.equal(parseRemoteDoc({ ...good, stateJson: '{' }).kind, 'corrupt');
  assert.equal(parseRemoteDoc({ ...good, protocol: 3 }).kind, 'newer');
  assert.equal(parseRemoteDoc({ ...good, seq: good.seq + 1 }).kind, 'corrupt');
  assert.equal(parseRemoteDoc({ shapesJson: '{}' }).kind, 'corrupt', 'a v1 envelope is never mistaken for v2');
  const tampered = JSON.parse(good.stateJson);
  tampered.records.base.content.g = { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] };
  assert.equal(parseRemoteDoc({ ...good, stateJson: JSON.stringify(tampered) }).kind, 'corrupt');
});

test('invalid ops are rejected idempotently; there is no wildcard delete', () => {
  const s0 = seeded();
  const bad = [
    { kind: 'delete-all', opId: 'w1', device: 'A', shapeId: 'base', baseSeq: 0, deps: [], source: 'delete' },
    { kind: 'update', opId: 'w2', device: 'A', shapeId: 'base', baseSeq: 0, deps: [], source: 'native-edit', baseRev: 1, patch: { g: { set: { type: 'Polygon', coordinates: [] } } }, proposed: content(BASE) },
    { kind: 'create', opId: 'w3', device: 'A', shapeId: 'has space', baseSeq: 0, deps: [], source: 'draw-create', content: content(BASE) },
  ] as unknown as ShapeOp[];
  const r = run(s0, bad);
  assert.deepEqual(r.outcomes.map((o) => o.outcome), ['rejected', 'rejected', 'rejected']);
  assert.deepEqual(ids(live(r.state)), ['base']);
  assert.deepEqual(run(r.state, bad).outcomes.map((o) => o.outcome), ['duplicate', 'duplicate', 'duplicate']);
});

test('retention is ack-bounded, not a TTL: a device back after a very long absence gets a hold, never a resurrection', () => {
  const day = 24 * 60 * 60 * 1000;
  const s1 = square('s1', 30.1, -29);
  let s = seeded(s1);
  touchDevice(s, 'A', { nowMs: 0 });
  touchDevice(s, 'OLD', { nowMs: 0 });
  const offlineOldEdit = update('OLD', s1, moved(s1, 0.01), 1); // made, never sent
  const d = run(s, [del('A', 's1', 1)]);
  s = d.state;
  touchDevice(s, 'A', { nowMs: 10 * day });
  // OLD has not seen the tombstone: nothing is pruned, and A's applied entry is not ack'd yet.
  let c = compactState(s, 10 * day);
  assert.ok(c.records.s1, 'tombstone kept while an active device has not observed it');
  assert.ok(c.applied[d.outcomes[0].opId], 'idempotency entry kept until its op is explicitly acked');
  // pass 2: A reports the op as durably removed (explicit per-op ack, not a watermark); OLD stays
  // silent for > activeDeviceWindow, so it stops holding the tombstone back.
  touchDevice(s, 'A', { nowMs: 500 * day });
  c = compactState(pruneAcked(s, [d.outcomes[0].opId]), 500 * day);
  assert.equal(c.records.s1, undefined);
  assert.equal(c.applied[d.outcomes[0].opId], undefined);
  assert.ok(c.prunedBelowSeq > 0);
  // OLD finally comes back and replays its offline edit against the pruned shape.
  const back = run(c, [offlineOldEdit]);
  assert.equal(back.outcomes[0].outcome, 'conflict');
  assert.equal(back.outcomes[0].reason, 'target pruned');
  assert.deepEqual(ids(live(back.state)), ['base'], 'not silently resurrected');
  assert.equal(listConflicts(back.state)[0].kind, 'missing-target', 'and not silently dropped');
  // Legacy-bridged tombstones are retained while the bridge can re-assert them.
  const bridged = run(genesisState('st-b'), [{ kind: 'legacy', opId: 'L', device: 'A', shapeId: 'old1', baseSeq: 0, deps: [], source: 'legacy-island', content: content(square('old1', 30, -29)), island: 5 } as ShapeOp, del('A', 'old1', 1)]).state;
  touchDevice(bridged, 'A', { nowMs: 0 });
  assert.ok(compactState(bridged, 0).records.old1);
  assert.equal(compactState(bridged, 0, { ...DEFAULT_RETENTION, legacyBridgeRetired: true }).records.old1, undefined);
});

test('shared-site import ids are deterministic: re-import is a no-op and a deleted import is not resurrected', () => {
  const s0 = seeded();
  const shared = square('their-1', 31, -28, { name: 'Shared field' });
  const id = importShapeId('ABC123', shared.id, 0);
  assert.equal(id, importShapeId('ABC123', shared.id, 0));
  assert.notEqual(id, importShapeId('XYZ789', shared.id, 0));
  const imp = (opId: string): ShapeOp => ({ kind: 'import', opId, device: 'A', shapeId: id, baseSeq: 0, deps: [], source: 'share-import', content: content(shared) });
  const once = run(s0, [imp('i1')]).state;
  assert.deepEqual(ids(live(once)), ['base', id]);
  const twice = run(once, [imp('i2')]);
  assert.equal(twice.outcomes[0].outcome, 'noop');
  const gone = run(once, [del('A', id, 1)]).state;
  assert.equal(run(gone, [imp('i3')]).outcomes[0].outcome, 'noop');
  assert.deepEqual(ids(live(gone)), ['base']);
});

test('unknown JSON is preserved: foreign members, unknown properties and unknown state keys survive apply + serialize + parse', () => {
  const f = { ...square('s1', 30, -29, { custom: { nested: [1, 2] }, featureType: 'water' }), bbox: [30, -29, 30.001, -28.999], vendorExt: 'keep-me' } as Feature;
  const s = run(genesisState('st-u'), [create('A', f)]).state;
  (s as Record<string, unknown>).futureMinorField = { a: 1 };
  const round = parseRemoteDoc(serializeState(s));
  assert.equal(round.kind, 'ok');
  if (round.kind !== 'ok') return;
  assert.deepEqual((round.state as Record<string, unknown>).futureMinorField, { a: 1 });
  const out = byId(live(run(round.state, [update('A', f, moved(f, 0.001), 1)]).state), 's1') as unknown as Record<string, unknown>;
  assert.deepEqual(out.bbox, [30, -29, 30.001, -28.999]);
  assert.equal(out.vendorExt, 'keep-me');
  assert.deepEqual((out.properties as Record<string, unknown>).custom, { nested: [1, 2] });
});

test('rollback materialization hands v1 every live v2 shape plus unseen island additions, and nothing deleted', () => {
  const s1 = square('s1', 30.1, -29);
  const s = run(seeded(s1), [del('A', 'base', 1)]).state;
  const island = [square('base', 30, -29), square('v1-only', 32, -29)];
  const { fc, unseenIslandFeatures } = materializeForLegacyRollback(s, island);
  assert.equal(unseenIslandFeatures, 1);
  assert.deepEqual(ids(fc), ['s1', 'v1-only'], 'deleted base is not handed back; the unseen v1 addition is');
});
