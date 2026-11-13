import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { account, samples, core, crop, local, session, probe, siteId, bookKey, studioKey, localKey,
  studio, facilitator, cloud, ownRow, store, reset, cleanup, pauseHashes, deferred } from './international-grower-operations-fixture.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { createSavedProvisionalProfile, createProvisionalCycleContext, provisionalSiteConditions } from '../lib/international/provisional-profile.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
beforeEach(reset); after(cleanup);
// Load storage dependencies after the fixture installs its actual auth boundary.
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
const { currentPlanningSupport } = await import('../lib/international/planning-support.ts');
const { readCanvasSourceReceipt } = await import('../lib/design-canvas.ts');

async function markedOperationsRow(foreignClaim = false, options: { revision?: number; plantingId?: string; harvestStart?: string; harvestEnd?: string } = {}) {
  const ordinary = await ownRow(), recordedAt = '2026-11-04T12:00:00.000Z';
  const own = (value: unknown, unit: string) => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } });
  local.setItem(studioKey(), JSON.stringify({ ...studio(), rev: options.revision ?? 1 })); store([]);
  const raw = readCanvasSourceReceipt(siteId); assert.equal(raw.status, 'ready'); if (raw.status !== 'ready') throw Error('Missing fixture');
  const actual = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw: raw.raw, sourceRevision: raw.revision }));
  assert.equal(actual.status, 'ready'); if (actual.status !== 'ready') throw Error('Source fixture held');
  const source = foreignClaim ? { ...actual, sourceKey: 'studio-canvas:another-synthetic-source' } : actual;
  const profile = createSavedProvisionalProfile({ profileId: 'provisional-preview', cropKey: ordinary.row.cropKey,
    context: { scope: source.scope, countryCode: null, agriculturalRegionReference: null, establishment: 'direct', waterRegime: 'irrigated' },
    recordedAt, asOf: recordedAt.slice(0, 10), candidates: [], overrides: ordinary.row.growerCycle.assessmentSnapshot.profile.inputs,
    measuredAreaM2: { ...own(8, 'm2'), arithmeticBasis: source.measuredAreas[0].arithmeticBasis }, fieldEntryDate: own('2028-12-08', 'utc-date') },
    'marked-source-profile', '2026-11-04T12:01:00.000Z', source, 'bed-a', source.beds[0].label); assert.ok(profile);
  const context = createProvisionalCycleContext(source, provisionalSiteConditions(currentPlanningSupport(siteId)), new Date().toISOString()); assert.ok(context);
  const proposal = generateGrowerAutoPlan({ requestedAt: context.reviewedAt, scope: source.scope, geometryFingerprint: source.geometryFingerprint,
    provisionalContext: context, profiles: [profile], beds: source.beds.map(bed => ({ bed, scope: source.scope,
      measuredAreaM2: { ...own(bed.areaM2, 'm2'), arithmeticBasis: source.measuredAreas[0].arithmeticBasis } })),
    planningStart: own('2028-12-01', 'utc-date'), planningEndExclusive: own('2029-01-01', 'utc-date'),
    availability: [{ bedId: 'bed-a', scope: source.scope, window: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window') }], reserved: [],
    demands: [{ demandId: 'marked-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: options.harvestStart ?? '2028-12-10', endExclusive: options.harvestEnd ?? '2028-12-12' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready', proposal.issues.join(','));
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: options.plantingId ?? 'marked-operations-row', acceptedAt: context.reviewedAt, geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
  store([row]); return { row, actual };
}

test('current-source discovery supplies real marked-cycle context and compares independent read times without renewing historical evidence', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-13T12:00:00.000Z') });
  const { row } = await markedOperationsRow(), before = JSON.stringify([...local.rows]), writes = local.writes;
  const result = await core.loadGrowerOperationsSources(); assert.equal(result.status, 'ready');
  assert.equal(result.contexts.length, 1); assert.ok(result.contexts[0].provisionalContext);
  assert.equal(projectGrowerCycles(result.book!.plantings, result.contexts[0]).ownCycles.length, 1);
  assert.equal(core.isGrowerOperationsCurrent(result), true);
  t.mock.timers.tick(500);
  assert.equal(await core.checkGrowerOperationsCurrent(result), true, 'Actual requery times can differ; source/site/day facts must match.');
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(core.isGrowerOperationsCurrent(result), false);
  const next = await core.loadGrowerOperationsSources(); assert.equal(next.status, 'ready');
  assert.equal(projectGrowerCycles(next.book!.plantings, next.contexts[0]).ownCycles.length, 1);
  assert.deepEqual(next.book!.plantings, [row]); assert.equal(JSON.stringify([...local.rows]), before); assert.equal(local.writes, writes);
});

test('same geometry cannot substitute another source identity or a changed saved revision for a marked operations record', async () => {
  const { row } = await markedOperationsRow(true), result = await core.loadGrowerOperationsSources();
  assert.equal(result.status, 'ready'); assert.equal(result.contexts.length, 0); assert.deepEqual(result.book!.plantings, [row]);
  assert.ok(result.heldSources.length); assert.equal(probe.queries, 0, 'A known Studio origin cannot become an unrelated cloud design.');
  await reset(); const current = await markedOperationsRow();
  const changed = { ...studio(), rev: 2 }; local.setItem(studioKey(), JSON.stringify(changed));
  const after = await core.loadGrowerOperationsSources(); assert.equal(after.status, 'ready');
  assert.equal(after.contexts.length, 0); assert.deepEqual(after.book!.plantings, [current.row]);
});

test('an old marked receipt cannot hide a valid ordinary or current marked cycle on the same geometry', async () => {
  const stale = await markedOperationsRow();
  const ordinary = await ownRow();
  local.setItem(studioKey(), JSON.stringify({ ...studio(), rev: 2 }));
  store([stale.row, ordinary.row]);
  const mixed = await core.loadGrowerOperationsSources();
  assert.equal(mixed.status, 'ready'); assert.equal(mixed.contexts.length, 1);
  const ordinaryProjection = projectGrowerCycles(mixed.book!.plantings, mixed.contexts[0]);
  assert.deepEqual(ordinaryProjection.ownCycles.map(row => row.plantingId), [ordinary.row.id]);
  assert.equal(ordinaryProjection.heldRows.some(row => row.plantingId === stale.row.id), true);
  const current = await markedOperationsRow(false, { revision: 2, plantingId: 'current-marked-row',
    harvestStart: '2028-12-20', harvestEnd: '2028-12-22' });
  store([stale.row, current.row]);
  const marked = await core.loadGrowerOperationsSources();
  assert.equal(marked.status, 'ready'); assert.equal(marked.contexts.length, 1);
  const markedProjection = projectGrowerCycles(marked.book!.plantings, marked.contexts[0]);
  assert.deepEqual(markedProjection.ownCycles.map(row => row.plantingId), [current.row.id]);
  assert.equal(markedProjection.heldRows.some(row => row.plantingId === stale.row.id), true);
  assert.deepEqual(marked.book!.plantings, [stale.row, current.row]);
  assert.equal(await core.checkGrowerOperationsCurrent(marked), true);
});

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

test('equal local and cloud dimensions cannot lend another source identity to an ordinary cycle', async () => {
  const ordinary = await ownRow(facilitator(), 'facilitator-local', 'local', 'ordinary-local');
  const missing = await ownRow();
  local.setItem(localKey(), JSON.stringify(facilitator()));
  // The missing mapped source makes the existing fallback query necessary;
  // it also returns equal dimensions under a distinct source identity. The
  // canonical geometry digest includes sourceKey, so these are not one receipt.
  probe.cloud = async () => [cloud()]; store([ordinary.row, missing.row]);
  const result = await core.loadGrowerOperationsSources();
  assert.equal(result.status, 'ready'); assert.equal(probe.queries, 1);
  assert.equal(result.contexts.length, 1);
  assert.equal(result.contexts[0].geometryFingerprint, ordinary.source.geometryFingerprint);
  assert.deepEqual(projectGrowerCycles(result.book!.plantings, result.contexts[0]).ownCycles.map(row => row.plantingId), [ordinary.row.id]);
  assert.ok(result.heldSources.some(row => row.reason === 'current-source-unavailable'));
  assert.deepEqual(result.book!.plantings, [ordinary.row, missing.row]);
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
