import assert from 'node:assert/strict';
import test from 'node:test';
import { createShapeSyncController, shapeSyncKeys, shapeSyncNotice, type ShapeSyncStatus } from '../lib/shape-sync/controller.ts';
import { parseRemoteDoc } from '../lib/shape-sync/protocol.ts';
import { FakeShapeServer, MemoryStorage, square } from './shape-sync-v2-fakes.ts';

// What the map SUBSCRIBES to: Map.tsx passes `onStatus: setShapeSyncStatus`, so the banner always
// renders the LAST onStatus callback, never a fresh controller.status(). Every assertion below is on
// that last callback (and the notice derived from it). Real controller + existing deterministic fakes
// (FakeShapeServer transport, MemoryStorage). Root's observed failure: after a genuine commit the last
// callback said { pending: 0, flushing: true } → "0 change(s) syncing…" forever.
let seed = 0;
function device(server: FakeShapeServer | null, opts: { storage?: MemoryStorage; gate?: { offline: boolean } } = {}) {
  const storage = opts.storage ?? new MemoryStorage(), gate = opts.gate ?? { offline: false }, current = { value: true };
  const statuses: ShapeSyncStatus[] = [], scheduled: number[] = [];
  const id = seed++; let n = 0;
  const controller = createShapeSyncController({
    keys: shapeSyncKeys((base) => `${base}::imbewu-owner::uid:farmer`), storage,
    transport: server ? server.transport(gate) : null, isCurrent: () => current.value,
    now: () => 1_700_000_000_000, randomId: () => `sub${id}x${n++}`,
    onStatus: (s) => statuses.push(s),
    // Records the real controller's scheduling decisions; timers never fire on their own.
    schedule: (_fn, ms) => { scheduled.push(ms); return () => {}; },
  });
  controller.start();
  const last = () => statuses.at(-1)!;
  return { controller, statuses, scheduled, current, gate, storage, last };
}
const live = (server: FakeShapeServer) => {
  const parsed = parseRemoteDoc(server.doc);
  assert.equal(parsed.kind, 'ok');
  return parsed.kind === 'ok' ? Object.values(parsed.state.records).filter((r) => r.live).map((r) => r.id).sort() : [];
};
const STALE = '0 change(s) syncing…';

test('committed flush: the last subscribed status is the settled one (flushing false) and the notice is the genuine "synced"', async () => {
  const d = device(new FakeShapeServer());
  d.controller.create(square('a', 30, -29), 'reticle-create');
  assert.equal((await d.controller.flush()).kind, 'committed');
  assert.equal(d.last().flushing, false, 'last onStatus callback must not still say flushing after the flight cleared');
  assert.deepEqual(d.last(), d.controller.status(), 'subscriber and controller agree once settled');
  assert.notEqual(shapeSyncNotice(d.last())?.text, STALE);
  assert.deepEqual(shapeSyncNotice(d.last()), { level: 'ok', text: 'All map changes synced.', offerBackup: false });
});

test('recovery after offline + reload (the screenshot path): two recovered parcels commit and the subscribed notice settles', async () => {
  const server = new FakeShapeServer(), storage = new MemoryStorage();
  const before = device(server, { storage, gate: { offline: true } });
  before.controller.create(square('synthetic-boots', 30, -29), 'reticle-create');
  before.controller.create(square('synthetic-live-island', 30.01, -29), 'reticle-create');
  assert.equal((await before.controller.flush()).kind, 'error');
  assert.deepEqual(shapeSyncNotice(before.last()), { level: 'info', text: '2 change(s) waiting to sync (offline?).', offerBackup: false });
  before.controller.dispose(); // page reload
  const after = device(server, { storage });
  assert.deepEqual(shapeSyncNotice(after.last()), { level: 'info', text: '2 change(s) syncing…', offerBackup: false }, 'truthful while pending');
  assert.equal((await after.controller.flush()).kind, 'committed');
  assert.deepEqual(live(server), ['synthetic-boots', 'synthetic-live-island']);
  assert.deepEqual(shapeSyncNotice(after.last()), { level: 'ok', text: 'All map changes synced.', offerBackup: false }, `subscribed notice after recovery: ${JSON.stringify(shapeSyncNotice(after.last()))}`);
  assert.equal(after.last().pending, 0);
  assert.equal(after.last().flushing, false);
});

test('recovery on the same page (network back, no reload) also settles', async () => {
  const d = device(new FakeShapeServer(), { gate: { offline: true } });
  d.controller.create(square('a', 30, -29), 'reticle-create');
  await d.controller.flush();
  d.gate.offline = false;
  assert.equal((await d.controller.flush()).kind, 'committed');
  assert.deepEqual(d.last(), d.controller.status());
  assert.equal(shapeSyncNotice(d.last())?.level, 'ok');
});

test('error flight: settled status stays truthful (pending + lastError), never ok; retry/backoff scheduling unchanged', async () => {
  const d = device(new FakeShapeServer(), { gate: { offline: true } });
  d.controller.create(square('a', 30, -29), 'reticle-create');
  d.scheduled.length = 0;
  assert.equal((await d.controller.flush()).kind, 'error');
  assert.deepEqual(d.last(), d.controller.status());
  assert.equal(d.last().flushing, false); assert.equal(d.last().pending, 1); assert.match(d.last().lastError!, /offline/);
  assert.deepEqual(shapeSyncNotice(d.last()), { level: 'info', text: '1 change(s) waiting to sync (offline?).', offerBackup: false });
  assert.equal((await d.controller.flush()).kind, 'error');
  assert.deepEqual(d.scheduled, [2000, 4000], 'backoff doubles exactly as before');
});

test('blocked flight (store replaced): settled status keeps the paused error and the backup offer', async () => {
  const server = new FakeShapeServer(), d = device(server);
  d.controller.create(square('a', 30, -29), 'reticle-create');
  assert.equal((await d.controller.flush()).kind, 'committed');
  const other = new FakeShapeServer(), stranger = device(other);
  stranger.controller.create(square('z', 31, -28), 'reticle-create');
  await stranger.controller.flush();
  server.doc = structuredClone(other.doc); server.version += 1; // another store now occupies the document
  d.controller.create(square('b', 30.01, -29), 'reticle-create');
  assert.deepEqual(await d.controller.flush(), { kind: 'blocked', reason: 'store-replaced' });
  assert.deepEqual(d.last(), d.controller.status());
  assert.equal(d.last().flushing, false);
  assert.deepEqual(shapeSyncNotice(d.last()), { level: 'error', text: 'Map sync is paused (store-replaced). Your drawings are kept on this device.', offerBackup: true });
});

test('queued-again: a change made mid-flight stays pending (not ok), the re-flush is still scheduled at 0, then it settles', async () => {
  const server = new FakeShapeServer(), d = device(server);
  d.controller.create(square('a', 30, -29), 'reticle-create');
  let queued: string | undefined;
  server.beforeCommit = async () => {
    // The fake transport runs this hook synchronously inside run(); yield once so `inflight` is set.
    await Promise.resolve();
    d.controller.create(square('b', 30.01, -29), 'reticle-create');
    queued = (await d.controller.flush()).kind;
  };
  d.scheduled.length = 0;
  assert.equal((await d.controller.flush()).kind, 'committed');
  assert.equal(queued, 'queued-again');
  assert.equal(d.scheduled.at(-1), 0, 'queued-again re-flush scheduled after the flight');
  assert.deepEqual(d.last(), d.controller.status());
  assert.equal(d.last().pending, 1); assert.equal(d.last().flushing, false);
  assert.deepEqual(shapeSyncNotice(d.last()), { level: 'info', text: '1 change(s) syncing…', offerBackup: false });
  assert.equal((await d.controller.flush()).kind, 'committed'); // what the scheduled timer runs
  assert.deepEqual(live(server), ['a', 'b']);
  assert.deepEqual(shapeSyncNotice(d.last()), { level: 'ok', text: 'All map changes synced.', offerBackup: false });
});

test('fences: disposal or an account change during the flight publishes nothing afterwards', async () => {
  for (const fence of ['disposed', 'account-changed'] as const) {
    const server = new FakeShapeServer(), d = device(server);
    d.controller.create(square('a', 30, -29), 'reticle-create');
    let count = -1;
    server.beforeCommit = () => {
      if (fence === 'disposed') d.controller.dispose(); else d.current.value = false;
      count = d.statuses.length;
    };
    d.scheduled.length = 0;
    const report = await d.controller.flush();
    assert.equal(report.kind, 'account-changed', fence);
    assert.equal(d.statuses.length, count, `${fence}: no status published after the fence`);
    if (fence === 'disposed') assert.deepEqual(d.scheduled, [], 'disposed: nothing scheduled');
  }
});

test('genuine-commit criterion: no flight, no publication; idle and local-only never claim synced', async () => {
  const d = device(new FakeShapeServer());
  const n = d.statuses.length;
  assert.equal((await d.controller.flush()).kind, 'idle');
  assert.equal(d.statuses.length, n, 'an idle flush publishes nothing');
  assert.equal(shapeSyncNotice(d.last()), null, 'nothing committed yet → no claim either way');
  const local = device(null);
  local.controller.create(square('a', 30, -29), 'reticle-create');
  assert.equal((await local.controller.flush()).kind, 'skipped');
  assert.deepEqual(shapeSyncNotice(local.last()), { level: 'info', text: 'Saved on this device only.', offerBackup: false });
});
