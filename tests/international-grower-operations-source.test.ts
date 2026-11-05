import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { account, samples, core, crop, local, session, probe, siteId, bookKey, studioKey, localKey,
  studio, facilitator, cloud, ownRow, store, reset, cleanup, pauseHashes, deferred } from './international-grower-operations-fixture.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
beforeEach(reset); after(cleanup);

test('a real account helper fallback into a failing Firebase initializer resolves held instead of rejecting the source load', async () => {
  store([]); const before = JSON.stringify([...local.rows]), writes = local.writes;
  // undefined is the real authority's initial, not-yet-bound state. This makes
  // actual activeAccountUid invoke the controlled external Firebase boundary.
  (account.bindMountedAccountLocalStorageUid as (uid: string | null | undefined) => void)(undefined);
  probe.initThrows = true;
  const result = await core.loadGrowerOperationsSources();
  assert.equal(probe.initCalls, 1); assert.equal(result.status, 'held'); assert.equal(result.book, null);
  assert.deepEqual(result.contexts, []); assert.deepEqual(result.heldSources, [{ reason: 'actor-unavailable' }]);
  assert.equal(probe.queries, 0); assert.equal(local.writes, writes); assert.equal(JSON.stringify([...local.rows]), before);
});

test('raw book authority distinguishes missing/corrupt from explicit empty and preserves null rows, duplicates and metadata without writes', async () => {
  // Before explicit initialization there is no writable canonical receipt.
  releaseCropPlanFixture(); local.clear();
  assert.equal(crop.readRawCropPlanReceipt().status, 'held');
  assert.deepEqual((await core.loadGrowerOperationsSources()).heldSources, [{ reason: 'book-unavailable' }]);
  await initialiseCropPlanFixture();
  for (const bytes of ['null', '{broken', '{"version":1,"plantings":null}', '{"version":99,"plantings":[]}']) {
    replaceCanonicalCropPlanFixtureRaw(bytes); const result = await core.loadGrowerOperationsSources();
    assert.equal(result.status, 'held'); assert.notEqual(result.heldSources[0].reason, 'no-saved-plan'); assert.equal(result.book, null);
  }
  store([]); assert.equal((await core.loadGrowerOperationsSources()).status, 'ready');
  const { row } = await ownRow(); store([null, row, row]); const bytes = JSON.stringify([...local.rows]), writes = local.writes;
  const receipt = crop.readRawCropPlanReceipt(); assert.equal(receipt.status, 'ready');
  if (receipt.status === 'ready') assert.deepEqual((receipt.raw as { plantings: unknown[] }).plantings, [null, row, row]);
  const result = await core.loadGrowerOperationsSources(); assert.equal(result.status, 'ready');
  assert.deepEqual(result.book?.plantings, [null, row, row]); assert.equal(result.contexts.length, 0); assert.equal(probe.queries, 0);
  assert.equal((result.book as unknown as { notes: string }).notes, 'Preserve raw book metadata');
  assert.equal(JSON.stringify([...local.rows]), bytes); assert.equal(local.writes, writes);
});

test('real Studio and local facilitator sources supply only exact shared-authority contexts while the whole own book stays intact', async () => {
  const a = await ownRow(), b = await ownRow(facilitator(), 'facilitator-local', 'local', 'local-own-row');
  local.setItem(studioKey(), JSON.stringify(studio())); local.setItem(localKey(), JSON.stringify(facilitator())); store([a.row, b.row]);
  const before = JSON.stringify([...local.rows]), result = await core.loadGrowerOperationsSources();
  assert.equal(result.status, 'ready'); assert.equal(result.contexts.length, 2); assert.equal(result.heldSources.length, 0);
  assert.deepEqual(result.contexts.map(context => context.geometryFingerprint), [a.source.geometryFingerprint, b.source.geometryFingerprint]);
  for (const context of result.contexts) assert.equal(projectGrowerCycles(result.book!.plantings, context).ownCycles.length, 1);
  assert.equal(probe.queries, 0); assert.equal(core.isGrowerOperationsCurrent(result), true);
  assert.equal(core.isGrowerOperationsCurrent(structuredClone(result)), false, 'copied display data is not a private current-source receipt');
  assert.equal(await core.checkGrowerOperationsCurrent(result), true); assert.equal(JSON.stringify([...local.rows]), before);
});

test('missing Studio bytes can resolve to an actually owned matching cloud snapshot without querying any marker-supplied document path', async () => {
  const owned = cloud(true), { row, source } = await ownRow(owned, 'facilitator-cloud', owned.id);
  store([row]); probe.cloud = async () => [owned];
  const result = await core.loadGrowerOperationsSources(); assert.equal(result.status, 'ready'); assert.equal(result.contexts.length, 1);
  assert.equal(result.contexts[0].geometryFingerprint, source.geometryFingerprint); assert.equal(probe.queries, 1);
  assert.equal(await core.checkGrowerOperationsCurrent(result), true); assert.equal(probe.queries, 2);
  for (const rows of [[{ ...owned, owner_id: 'owner-b' }], [owned, owned], [{ ...owned, id: '../unsafe/path' }]]) {
    probe.cloud = async () => rows; const rejected = await core.loadGrowerOperationsSources();
    assert.equal(rejected.status, 'ready'); assert.equal(rejected.contexts.length, 0); assert.ok(rejected.heldSources.length);
  }
});

test('malformed, identity-mismatched and non-SHA own attachments stay in the book without causing a cloud query', async () => {
  const { row } = await ownRow();
  for (const bad of [{ ...row, growerCycle: null }, { ...row, id: 'wrong-row' },
    { ...row, growerCycle: { ...row.growerCycle, geometryFingerprint: 'https://example.com/arbitrary' } }]) {
    store([bad]); const result = await core.loadGrowerOperationsSources();
    assert.equal(result.status, 'ready'); assert.deepEqual(result.book!.plantings, [bad]); assert.equal(result.contexts.length, 0);
  }
  assert.equal(probe.queries, 0);
});

test('actual Firebase B cannot read cloud data for still-mounted A and late book, source, owner or sample changes withdraw hashing results', async () => {
  const { row } = await ownRow(); local.setItem(studioKey(), JSON.stringify(studio())); store([row]);
  probe.actor = 'owner-b'; assert.equal(account.activeAccountUid(), 'owner-a');
  const denied = await core.loadGrowerOperationsSources(); assert.equal(denied.status, 'held'); assert.equal(denied.book, null); assert.equal(probe.queries, 0);
  for (const change of ['book', 'source', 'owner', 'sample'] as const) {
    await reset(); local.setItem(studioKey(), JSON.stringify(studio())); store([row]);
    const gate = pauseHashes(), pending = core.loadGrowerOperationsSources(); await gate.started;
    if (change === 'book') store([row, row]);
    if (change === 'source') { const changed = studio(); changed.items[0].x = 0.6; local.setItem(studioKey(), JSON.stringify(changed)); }
    if (change === 'owner') probe.actor = 'owner-b';
    if (change === 'sample') session.setItem('imbewu_sample_mode', '1');
    gate.resume(); const result = await pending; assert.equal(result.status, 'held', change); assert.equal(result.book, null, change); assert.deepEqual(result.contexts, [], change);
  }
});

test('a late cloud response cannot cross an actor transition and current checks detect moved geometry without blessing new task inputs', async () => {
  const owned = cloud(true), { row } = await ownRow(owned, 'facilitator-cloud', owned.id); store([row]);
  const response = deferred<unknown[]>(); probe.cloud = () => response.promise;
  const pending = core.loadGrowerOperationsSources(); probe.actor = 'owner-b'; response.resolve([owned]);
  assert.equal((await pending).status, 'held');
  probe.actor = 'owner-a'; probe.cloud = async () => [owned];
  const result = await core.loadGrowerOperationsSources(); assert.equal(result.status, 'ready');
  probe.cloud = async () => [{ ...owned, data: { ...owned.data, items: owned.data.items.map(item => ({ ...item, xM: 2 })) } }];
  assert.equal(await core.checkGrowerOperationsCurrent(result), false);
});

test('sample raw book accessors are held without executing them or borrowing real account records', async () => {
  store([]); const original = JSON.stringify([...local.rows]); samples.enterSampleMode();
  let reads = 0; const raw = { version: 1 as const, get plantings() { reads++; return []; }, updatedAt: 1 };
  samples.setSandboxCropPlan(raw); assert.equal(crop.readRawCropPlanReceipt().status, 'held'); assert.equal(reads, 0);
  assert.equal((await core.loadGrowerOperationsSources()).status, 'held'); assert.equal(reads, 0); assert.equal(probe.queries, 0);
  samples.exitSampleMode(); assert.equal(JSON.stringify([...local.rows]), original);
});
