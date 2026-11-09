import assert from 'node:assert/strict';
import test from 'node:test';
import type { Feature } from 'geojson';

import { createDrawShapeAdapter, type DrawShapeAdapter } from '../lib/shape-sync/draw-adapter.ts';
import { parseRemoteDoc } from '../lib/shape-sync/protocol.ts';
import { FakeDraw, FakeShapeServer, byId, farmKeyFor, ids, journalOps, makeDevice, moved, square, type Device } from './shape-sync-v2-fakes.ts';

// The adapter is the Map.tsx seam. FakeDraw models the parts of @mapbox/mapbox-gl-draw this relies
// on (explicit string ids honoured, setFeatureProperty throws for a missing id, no events for
// programmatic calls). Those Draw facts are ASSUMPTIONS until browser gate G4 confirms them.

interface Rig { server: FakeShapeServer; dev: Device; draw: FakeDraw; adapter: DrawShapeAdapter; presentation: { value: boolean } }
function rig(): Rig {
  const server = new FakeShapeServer();
  const dev = makeDevice(server, { name: 'A' });
  const draw = new FakeDraw();
  const presentation = { value: false };
  let k = 0;
  const adapter = createDrawShapeAdapter({
    getController: () => dev.controller,
    getDraw: () => draw,
    isPresentation: () => presentation.value,
    newShapeId: () => `shp-t${k++}`,
  });
  return { server, dev, draw, adapter, presentation };
}
// pass 2: pending ops live one-per-key in the journal (was a single 'imbewu_shape_ops_v2' array).
const queue = (dev: Device) => journalOps(dev.storage);
const cachedIds = (dev: Device) => ids(JSON.parse(dev.storage.getItem(farmKeyFor()) as string));
const donut = (): Feature => ({
  type: 'Feature', id: 'ignored', bbox: [30, -29, 30.01, -28.99], vendor: { keep: true },
  properties: { featureType: 'site', name: 'Ring field', customNote: 'unknown prop', hatchIdx: 2 },
  geometry: { type: 'Polygon', coordinates: [
    [[30, -29], [30.01, -29], [30.01, -28.99], [30, -28.99], [30, -29]],
    [[30.004, -28.996], [30.006, -28.996], [30.006, -28.994], [30.004, -28.994], [30.004, -28.996]],
  ] },
} as unknown as Feature);

test('new reticle shape: stable shp- id on Feature.id and exactly one create op', () => {
  const { dev, draw, adapter } = rig();
  const id = adapter.addNewShape(square('x', 30, -29), 'reticle-create');
  assert.equal(id, 'shp-t0');
  assert.ok(draw.get('shp-t0'));
  assert.deepEqual(queue(dev).map((o) => [o.kind, o.source, o.shapeId]), [['create', 'reticle-create', 'shp-t0']]);
  assert.deepEqual(cachedIds(dev), ['shp-t0']);
});

test('reticle Done keeps the SAME id, every property, foreign members and holes; one geometry-only update', async () => {
  const { dev, draw, adapter } = rig();
  const id = adapter.addNewShape(donut()) as string;
  await dev.controller.flush();
  const session = adapter.beginReticleEdit(id);
  assert.ok(session);
  assert.equal(draw.get(id), undefined, 'lifted out of the draw store for the overlay');
  assert.deepEqual(cachedIds(dev), [id], 'but the synced view never loses it');
  assert.equal(queue(dev).length, 0, 'starting an edit records nothing');
  const newOuter = [[29.999, -29.001], [30.012, -29.001], [30.012, -28.989], [29.999, -28.989]];
  adapter.finishReticleEdit(session, newOuter, { featureType: 'water', siteId: 'site:x' });
  const after = draw.get(id) as unknown as Record<string, unknown>;
  assert.ok(after, 'same id back in the store');
  const props = after.properties as Record<string, unknown>;
  assert.equal(props.customNote, 'unknown prop');
  assert.equal(props.featureType, 'site', 'existing featureType is not overwritten by the default');
  assert.equal(props.siteId, 'site:x', 'missing siteId is stamped, as v1 did for untagged shapes');
  assert.deepEqual(after.vendor, { keep: true });
  assert.equal((after.geometry as { coordinates: unknown[] }).coordinates.length, 2, 'inner ring preserved');
  const ops = queue(dev);
  assert.deepEqual(ops.map((o) => [o.kind, o.source, o.shapeId]), [['update', 'reticle-done', id]]);
  assert.deepEqual(Object.keys(ops[0].patch ?? {}).sort(), ['g', 'p:siteId']);
  assert.ok(!ops.some((o) => o.kind === 'delete' || o.kind === 'create'), 'never delete + re-add');
});

test('reticle Cancel restores the exact original under the same id and records nothing', async () => {
  const { dev, draw, adapter } = rig();
  const id = adapter.addNewShape(donut()) as string;
  await dev.controller.flush();
  const original = draw.get(id);
  const session = adapter.beginReticleEdit(id);
  adapter.cancelReticleEdit(session);
  assert.deepEqual(draw.get(id), original);
  assert.equal(queue(dev).length, 0);
});

test('v1 regression: Rename during a reticle edit is kept (Done or Cancel) and never deletes the shape remotely', async () => {
  const { server, dev, draw, adapter } = rig();
  const id = adapter.addNewShape(donut()) as string;
  await dev.controller.flush();
  const session = adapter.beginReticleEdit(id);
  const edit = adapter.beginPropertyEdit(id);
  assert.equal(edit?.reticle, session, 'the name sheet binds to the lifted draft');
  adapter.commitPropertyEdit(edit, { name: 'Renamed mid-edit' });
  await dev.controller.flush();
  const parsed = parseRemoteDoc(server.doc);
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') {
    assert.equal(parsed.state.records[id].live, true, 'v1 pushed the store WITHOUT this shape here');
    assert.equal(parsed.state.records[id].content?.p.name, 'Renamed mid-edit', 'v1 silently lost this rename');
  }
  adapter.cancelReticleEdit(session);
  assert.equal(draw.get(id)?.properties?.name, 'Renamed mid-edit', 'Cancel abandons geometry, not the confirmed rename');
});

test('native edit captures its basis at session start: a remote change that arrives mid-session becomes a conflict, not an overwrite', async () => {
  const { server, dev, draw, adapter } = rig();
  const id = adapter.addNewShape(square('x', 30, -29)) as string;
  await dev.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);

  adapter.beginNativeEdit(id);
  // B moves the shape; A's listener delivers it, but Map.tsx defers the repaint while editing.
  B.controller.update(B.controller.captureBasis(id)!, moved(B.controller.feature(id)!, 0.01), 'native-edit');
  await B.controller.flush();
  dev.controller.receiveRemote(server.doc);
  // A drags the (old, still displayed) shape.
  const dragged = moved(draw.get(id)!, -0.01);
  draw.store.set(id, dragged);
  adapter.recordDrawUpdate([dragged]);
  await dev.controller.flush();
  const [conflict] = dev.controller.conflicts();
  assert.equal(conflict?.kind, 'concurrent-edit');
  assert.equal(JSON.stringify(conflict.other?.geometry), JSON.stringify(dragged.geometry), 'A\'s drag preserved as the other version');
});

test('native Undo is a typed op that reverts the session under the same id', async () => {
  const { dev, draw, adapter } = rig();
  const id = adapter.addNewShape(square('x', 30, -29, { name: 'Field' })) as string;
  await dev.controller.flush();
  const original = draw.get(id)!;
  adapter.beginNativeEdit(id);
  for (const d of [0.001, 0.002]) {
    const f = moved(draw.get(id)!, d);
    draw.store.set(id, f);
    adapter.recordDrawUpdate([f]);
  }
  assert.ok(adapter.nativeUndo());
  assert.deepEqual(draw.get(id), original);
  assert.deepEqual(queue(dev).map((o) => o.source), ['native-edit', 'native-edit', 'native-undo']);
  await dev.controller.flush();
  assert.equal(dev.controller.conflicts().length, 0, 'own session ops never conflict with each other');
  assert.equal(JSON.stringify(byId(dev.controller.view(), id)?.geometry), JSON.stringify(original.geometry));
});

test('presentation (remote paint, teardown) never produces ops', () => {
  const { dev, draw, adapter, presentation } = rig();
  const id = adapter.addNewShape(square('x', 30, -29)) as string;
  const before = queue(dev).length;
  presentation.value = true;
  adapter.recordDrawUpdate([moved(draw.get(id)!, 1)]);
  adapter.recordDrawDelete([draw.get(id)!]);
  draw.store.set('remote', square('remote', 31, -29));
  adapter.recordDrawCreate(['remote']);
  assert.equal(queue(dev).length, before);
});

test('delete, keyboard delete and clear-type are explicit per-shape tombstones; a shape another device added meanwhile survives', async () => {
  const { server, dev, draw, adapter } = rig();
  const a = adapter.addNewShape(square('a', 30, -29)) as string;
  const b = adapter.addNewShape(square('b', 30.1, -29)) as string;
  const c = adapter.addNewShape(square('c', 30.2, -29)) as string;
  await dev.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);
  B.controller.create(square('fromB', 31, -29), 'reticle-create');
  await B.controller.flush(); // A has not received this yet

  adapter.deleteShapes([a], 'delete');
  adapter.recordDrawDelete([draw.get(b)!]);
  adapter.deleteShapes([c], 'clear-type');
  assert.deepEqual(queue(dev).map((o) => [o.kind, o.source]), [['delete', 'delete'], ['delete', 'keyboard-delete'], ['delete', 'clear-type']]);
  await dev.controller.flush();
  assert.deepEqual(ids(dev.controller.view()), ['fromB']);
});

test('account switch / unmount drops draft sessions without recording anything', async () => {
  const { dev, adapter } = rig();
  const id = adapter.addNewShape(square('x', 30, -29)) as string;
  await dev.controller.flush();
  const session = adapter.beginReticleEdit(id);
  adapter.reset();
  assert.equal(adapter.activeReticle(), null);
  assert.equal(adapter.finishReticleEdit(session, [[0, 0], [1, 0], [1, 1]]), null, 'a dropped session cannot be finished later');
  assert.equal(queue(dev).length, 0);
  assert.deepEqual(ids(dev.controller.view()), [id], 'the shape itself is untouched');
});
