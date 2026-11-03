import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test, { beforeEach, after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useGrowerOperations, crop, core, local, session, events, probe, bookKey, studioKey, studio,
  cloud, ownRow, store, reset, cleanup, pauseHashes, deferred } from './international-grower-operations-fixture.ts';
beforeEach(reset); after(cleanup);

function mount() {
  let latest!: ReturnType<typeof useGrowerOperations>, renderer!: ReactTestRenderer;
  function Harness() { latest = useGrowerOperations(); return null; }
  act(() => { renderer = create(React.createElement(Harness)); });
  return { current() { return latest; }, async flush() {
    // WebCrypto completes on the native I/O queue, not a Promise-only flush.
    const deadline = Date.now() + 2_000;
    while (latest.status === 'loading' && Date.now() < deadline) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 1)); });
    }
    assert.notEqual(latest.status, 'loading', 'the real source check must settle');
  }, rerender() { act(() => { renderer.update(React.createElement(Harness)); }); },
    async refresh() { await act(async () => { await latest.refresh(); }); }, dispose() { act(() => { renderer.unmount(); }); } };
}

test('the actual hook loads a stable whole book and preserves the original ready binding during unchanged asynchronous checks', async () => {
  const { row } = await ownRow(); store([row]); local.setItem(studioKey(), JSON.stringify(studio()));
  const ui = mount(); try {
    assert.equal(ui.current().status, 'loading'); assert.equal(ui.current().book, null);
    await ui.flush(); assert.equal(ui.current().status, 'ready'); assert.equal(ui.current().contexts.length, 1);
    const book = ui.current().book, contexts = ui.current().contexts;
    const original = ui.current(); ui.rerender(); assert.equal(ui.current(), original, 'unrelated parent renders are not source changes');
    let valid = false; await act(async () => { valid = await ui.current().checkCurrent(); });
    assert.equal(valid, true); assert.equal(ui.current().book, book); assert.equal(ui.current().contexts, contexts); assert.equal(ui.current().isCurrent(), true);
    assert.equal(Object.hasOwn(ui.current(), 'token'), false); assert.equal(Object.hasOwn(ui.current(), 'sourceRevision'), false);
  } finally { ui.dispose(); }
});

test('source, book, places, storage and focus events withdraw prior ready data immediately while the new source check waits', async () => {
  for (const event of ['imbewu-design-canvas-changed', crop.CROP_PLAN_CHANGED_EVENT, 'permamap-places-changed', 'storage', 'focus']) {
    await reset(); const { row } = await ownRow(); store([row]); local.setItem(studioKey(), JSON.stringify(studio()));
    const ui = mount(); try {
      await ui.flush(); assert.equal(ui.current().status, 'ready', event);
      const gate = pauseHashes(); act(() => { events.dispatchEvent(new Event(event)); }); await gate.started;
      assert.equal(ui.current().status, 'loading', event); assert.equal(ui.current().book, null); assert.deepEqual(ui.current().contexts, []);
      gate.resume(); await ui.flush(); assert.equal(ui.current().status, 'ready', event);
    } finally { ui.dispose(); }
  }
});

test('the final synchronous action guard sees raw book and source edits without relying on browser events', async () => {
  const { row } = await ownRow(); store([row]); local.setItem(studioKey(), JSON.stringify(studio()));
  const ui = mount(); try {
    await ui.flush(); assert.equal(ui.current().isCurrent(), true);
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [row, row], updatedAt: 2 }));
    assert.equal(ui.current().isCurrent(), false);
    let valid = true; await act(async () => { valid = await ui.current().checkCurrent(); });
    assert.equal(valid, false); assert.equal(ui.current().status, 'held'); assert.equal(ui.current().book, null);
    store([row]); await ui.refresh(); assert.equal(ui.current().status, 'ready');
    const changed = studio(); changed.items[0].x = 0.7; local.setItem(studioKey(), JSON.stringify(changed));
    assert.equal(ui.current().isCurrent(), false);
  } finally { ui.dispose(); }
});

test('an authentication observer transition withdraws still-mounted A and a late cloud reply cannot publish after unmount', async () => {
  const owned = cloud(true), { row } = await ownRow(owned, 'facilitator-cloud', owned.id); store([row]);
  const response = deferred<unknown[]>(); probe.cloud = () => response.promise;
  const ui = mount(); assert.equal(ui.current().status, 'loading');
  act(() => { probe.actor = 'owner-b'; for (const observer of probe.auth) observer({ uid: 'owner-b' }); });
  await ui.flush(); assert.equal(ui.current().status, 'held'); assert.equal(ui.current().book, null);
  ui.dispose(); response.resolve([owned]); await act(async () => { await Promise.resolve(); });
  assert.equal(probe.auth.size, 0);
});

test('sample changes and overlapping refreshes cancel earlier generations instead of relabelling an old source response', async () => {
  const { row } = await ownRow(); store([row]); local.setItem(studioKey(), JSON.stringify(studio()));
  const ui = mount(); try {
    await ui.flush(); const gate = pauseHashes(); let pending!: Promise<void>;
    act(() => { pending = ui.current().refresh(); }); await gate.started;
    act(() => { session.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event('imbewu-sample-mode-changed')); });
    assert.equal(ui.current().book, null); gate.resume(); await act(async () => { await pending; });
    assert.notEqual(ui.current().contexts[0]?.geometryFingerprint, row.growerCycle.geometryFingerprint);
  } finally { ui.dispose(); }
});

test('changed cloud copies fail asynchronous action checks without blessing fresh records for an old task', async () => {
  const owned = cloud(true), { row } = await ownRow(owned, 'facilitator-cloud', owned.id); store([row]); probe.cloud = async () => [owned];
  const ui = mount(); try {
    await ui.flush(); assert.equal(ui.current().status, 'ready'); assert.equal(ui.current().contexts.length, 1);
    probe.cloud = async () => [{ ...owned, data: { ...owned.data, savedAt: 2 } }];
    let valid = true; await act(async () => { valid = await ui.current().checkCurrent(); });
    assert.equal(valid, false); assert.equal(ui.current().status, 'held'); assert.equal(ui.current().isCurrent(), false);
    assert.equal(ui.current().book, null); assert.deepEqual(ui.current().contexts, []);
  } finally { ui.dispose(); }
});

test('an explicit empty book is ready while absent, corrupt or unreadable books cannot become an invented operational book', async () => {
  releaseCropPlanFixture(); local.clear();
  const ui = mount(); try {
    await ui.flush(); assert.equal(ui.current().status, 'held'); assert.deepEqual(ui.current().heldSources, [{ reason: 'book-unavailable' }]);
    await initialiseCropPlanFixture();
    replaceCanonicalCropPlanFixtureRaw('null'); await ui.refresh(); assert.equal(ui.current().status, 'held'); assert.notEqual(ui.current().heldSources[0]?.reason, 'no-saved-plan');
    store([]); await ui.refresh(); assert.equal(ui.current().status, 'ready'); assert.deepEqual(ui.current().contexts, []);
    local.fail = true; await ui.refresh(); assert.equal(ui.current().status, 'held'); assert.equal(ui.current().book, null);
  } finally { local.fail = false; ui.dispose(); }
});

test('manual refresh exits loading with held data when actual Firebase initialization begins throwing', async () => {
  store([]); const ui = mount(); try {
    await ui.flush(); assert.equal(ui.current().status, 'ready');
    const before = JSON.stringify([...local.rows]), writes = local.writes, calls = probe.initCalls;
    probe.initThrows = true;
    await ui.refresh();
    assert.ok(probe.initCalls > calls, 'the actual initializer boundary must have thrown during this refresh');
    assert.equal(ui.current().status, 'held'); assert.equal(ui.current().book, null); assert.deepEqual(ui.current().contexts, []);
    assert.equal(ui.current().isCurrent(), false); assert.equal(probe.queries, 0);
    assert.equal(local.writes, writes); assert.equal(JSON.stringify([...local.rows]), before);
  } finally { ui.dispose(); }
});
