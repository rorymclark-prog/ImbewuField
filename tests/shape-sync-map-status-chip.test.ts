import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { createShapeSyncController, shapeSyncKeys, shapeSyncNotice, type ShapeSyncStatus } from '../lib/shape-sync/controller.ts';
import { FakeShapeServer, MemoryStorage, square } from './shape-sync-v2-fakes.ts';
import { MAP_SOURCE, SEAMS, bind } from './map-source-seams.ts';

// The chip in recovered-stale-status.jpg ("0 change(s) syncing…" above two recovered parcels), at
// source/render level. Map.tsx holds `const [shapeSyncStatus, setShapeSyncStatus] = useState(…)`
// (:546), passes `onStatus: setShapeSyncStatus` to the controller (:1052) and derives
// `shapeSyncNoticeNow = shapeSyncNotice(shapeSyncStatus)` (:548), so the banner shows whatever the LAST
// onStatus callback carried. This renders Map's own banner JSX (extracted verbatim by the existing
// tests/map-source-seams.ts) with that last callback from a real controller recovery.
// Real: controller, shapeSyncNotice, Map banner JSX via React 18.3.1 test renderer. Synthetic: fake
// transport/storage, inert icons. Not a browser: this is not the root's normal-UI verification.

function wiring() {
  for (const fact of ['const [shapeSyncStatus, setShapeSyncStatus] = useState<ShapeSyncStatus | null>(null);',
    'const shapeSyncNoticeNow = shapeSyncNotice(shapeSyncStatus);', 'onStatus: setShapeSyncStatus,']) {
    assert.ok(MAP_SOURCE.includes(fact), `source fit: Map.tsx still contains ${fact}`);
  }
}
const icon = (name: string) => () => React.createElement('svg', { 'data-icon': name });
function Banner({ status }: { status: ShapeSyncStatus | null }) {
  const [conflictsOpen, setConflictsOpen] = React.useState(false);
  return bind<React.ReactNode>(SEAMS.syncBanner(), {
    React, pinDraw: null, editPin: null, shapeConflicts: [], shapeSyncNoticeNow: shapeSyncNotice(status),
    downloadShapeRecovery: () => {}, conflictsOpen, setConflictsOpen, AlertTriangle: icon('AlertTriangle'), ChevronDown: icon('ChevronDown'),
    SHAPE_CONFLICT_TEXT: bind(SEAMS.shapeConflictText(), {}), resolveShapeConflict: () => {},
  }) || null;
}
const text = (n: ReactTestInstance): string => n.children.map((c) => (typeof c === 'string' ? c : text(c))).join('');
function chip(status: ShapeSyncStatus | null): string | null {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(React.createElement(Banner, { status })); });
  const found = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'status');
  return found.length ? text(found[0]) : null;
}

test('after recovery commits two parcels, the Map banner fed by the last onStatus callback shows no stale "0 change(s) syncing…"', async () => {
  wiring();
  const server = new FakeShapeServer(), storage = new MemoryStorage();
  const keys = shapeSyncKeys((base) => `${base}::imbewu-owner::uid:farmer`);
  let n = 0;
  const open = (gate: { offline: boolean }, held: { value: ShapeSyncStatus | null }) => {
    // `held.value = s` is exactly what React's setShapeSyncStatus does with each callback.
    const c = createShapeSyncController({ keys, storage, transport: server.transport(gate), isCurrent: () => true,
      now: () => 1_700_000_000_000, randomId: () => `chip${n++}`, onStatus: (s) => { held.value = s; }, schedule: () => () => {} });
    c.start();
    return c;
  };
  const offlineState = { value: null as ShapeSyncStatus | null };
  const offline = open({ offline: true }, offlineState);
  offline.create(square('synthetic-boots', 30, -29), 'reticle-create');
  offline.create(square('synthetic-live-island', 30.01, -29), 'reticle-create');
  await offline.flush();
  assert.equal(chip(offlineState.value), '2 change(s) waiting to sync (offline?).', 'sanity: pending/offline chip is visible');
  offline.dispose();
  const mapState = { value: null as ShapeSyncStatus | null };
  const recovered = open({ offline: false }, mapState);
  assert.equal(chip(mapState.value), '2 change(s) syncing…', 'sanity: truthful while pending');
  assert.equal((await recovered.flush()).kind, 'committed');
  assert.equal(chip(mapState.value), null, `chip after a genuine commit: ${JSON.stringify(chip(mapState.value))} (map state flushing=${mapState.value?.flushing}, pending=${mapState.value?.pending})`);
  assert.equal(shapeSyncNotice(mapState.value)?.level, 'ok', 'settled: ok is a genuine synced state (hidden by the B2 banner)');
});
