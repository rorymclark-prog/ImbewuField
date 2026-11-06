import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { account, crop, local, probe, ownRow, studio, studioKey, siteId, pauseHashes, reset, cleanup } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';

// The actual hook, raw device book, saved design receipt/hash and domain parser
// execute. The actor/network service is the established in-memory fixture;
// these checks are not account, browser or persistent-write approval.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();'),
  };
  return next(specifier, context);
} });
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
beforeEach(reset);
after(() => { hooks.deregister(); cleanup(); });

async function mount() {
  const fixture = await ownRow(), profile = fixture.row.growerCycle.assessmentSnapshot.profile;
  local.rows.set(studioKey(), JSON.stringify(studio()));
  const target: HarvestTarget = { id: 'mass-hook-buyer', siteId, cropKey: profile.cropKey,
    startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 1, marketablePercent: 100 };
  const book: CropPlanState = { version: 1, updatedAt: 1, plantings: [], growerPlanningProfiles: [profile], harvestTargets: [target] };
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book));
  const owner = account.activeAccountUid();
  let latest!: ReturnType<typeof useGrowerWorkflow>, renderer!: ReactTestRenderer;
  function Harness() {
    latest = useGrowerWorkflow({ selection: { kind: 'studio-canvas', sourceId: siteId }, scope: fixture.source.scope,
      resourceSiteId: fixture.source.resourceSiteId, book,
      actorIsCurrent: () => account.activeAccountUid() === owner && probe.actor === owner,
      readCurrentBook: () => {
        const receipt = crop.readRawCropPlanReceipt();
        return receipt.status === 'ready' ? { status: 'ready', book: receipt.raw as CropPlanState, token: receipt.token,
          isCurrent: () => crop.cropPlanWriteToken() === receipt.token } : { status: 'held', reason: 'saved-plan-changed' };
      } });
    return null;
  }
  act(() => { renderer = create(React.createElement(Harness)); });
  await act(async () => { await latest.onRefresh(); }); assert.equal(latest.source?.status, 'ready');
  const legacy = (): GrowerWorkflowDraft => ({ planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
    targetProfiles: [], demands: [{ kind: 'grower-entered', entryId: 'mass-hook-entry', purpose: 'household', cropKey: profile.cropKey,
      profileId: profile.profileId, grossKg: '1', harvestStart: '2028-12-01', harvestEndExclusive: '2029-01-01' }],
    available: fixture.source.beds.map(bed => ({ bedId: bed.id, start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true })),
    assumptionsConfirmed: true });
  return { fixture, profile, book, target, legacy, get latest() { return latest; },
    async review(draft: GrowerWorkflowDraft) {
      let result!: GrowerWorkflowReview; await act(async () => { result = await latest.onReview(draft); }); return result;
    }, close() { act(() => renderer.unmount()); } };
}

test('present-undefined mixed weight evidence reaches a held actual-hook result instead of becoming a legacy review', async () => {
  const screen = await mount();
  try {
    const legacy = screen.legacy(), first = legacy.demands![0]; assert.equal(first.kind, 'grower-entered');
    const draft = { ...legacy, demands: [{ ...first, quantityEntry: undefined }] } as unknown as GrowerWorkflowDraft;
    const domain = assembleGrowerWorkflowReview({ scope: screen.fixture.source.scope, source: screen.fixture.source,
      book: screen.book, draft, recordedAt: '2026-11-06T12:00:00.000Z' });
    assert.equal(domain.status, 'held');
    const bytes = new Map(local.rows), writes = local.writes, result = await screen.review(draft);
    assert.equal(result.status, 'held'); assert.ok(result.issues.includes('unreadable-workflow-input'));
    assert.equal(Object.hasOwn(draft.demands![0], 'quantityEntry'), true);
    assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
  } finally { screen.close(); }
});

test('quantity and draft accessors execute zero times and cannot mint a private review binding', async () => {
  const screen = await mount(); let calls = 0;
  try {
    const legacy = screen.legacy(), row = { ...legacy.demands![0] };
    Object.defineProperty(row, 'quantityEntry', { enumerable: true, get() { calls++; return undefined; } });
    const nested = { ...legacy, demands: [row] } as unknown as GrowerWorkflowDraft;
    const outer = Object.defineProperty({ ...legacy }, 'planningStart', { enumerable: true, get() { calls++; return '2028-12-01'; } });
    for (const draft of [nested, outer]) {
      const result = await screen.review(draft); assert.equal(result.status, 'held');
      assert.ok(result.issues.includes('unreadable-workflow-input'));
      assert.equal(calls, 0);
    }
  } finally { screen.close(); }
});

test('actual builder-shaped old buyer and legacy kg drafts remain usable, alongside explicit pounds', async () => {
  const screen = await mount();
  try {
    const legacy = screen.legacy(), { demands: _entered, ...head } = legacy;
    const buyer: GrowerWorkflowDraft = { ...head, targetProfiles: [{ targetId: screen.target.id, profileId: screen.profile.profileId }] };
    const first = legacy.demands![0]; assert.equal(first.kind, 'grower-entered');
    if (first.kind !== 'grower-entered') return;
    const { grossKg: _kg, quantityEntry: _previous, ...fields } = first;
    const pounds: GrowerWorkflowDraft = { ...legacy, demands: [{ ...fields, quantityEntry: { unit: 'lb', text: '10.00' } }] };
    const bytes = new Map(local.rows), writes = local.writes;
    for (const draft of [buyer, legacy, pounds]) {
      const result = await screen.review(draft); assert.equal(result.status, 'review', result.issues.join(','));
      if (result.status !== 'review') throw Error('Valid draft was held');
      assert.equal(result.proposal.status, 'ready'); assert.ok(result.proposal.cycles.length > 0);
      assert.equal(await screen.latest.onCheckCurrent(result), true);
    }
    assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
  } finally { screen.close(); }
});

test('the original authored entry is detached before source hashing can await a later editor change', async () => {
  const screen = await mount(), gate = pauseHashes();
  let pending: Promise<GrowerWorkflowReview> | undefined;
  try {
    const draft = screen.legacy(), before = JSON.stringify(draft);
    pending = screen.review(draft); await gate.started;
    const row = draft.demands![0] as unknown as Record<string, unknown>; row.grossKg = '99'; row.quantityEntry = undefined;
    gate.resume(); const result = await pending;
    assert.equal(result.status, 'review');
    if (result.status !== 'review') throw Error('Detached original draft held');
    const kg = result.request.demands[0].totalKg; assert.equal(kg.state === 'provided' && kg.value, 1);
    assert.deepEqual(result.enteredDemandMetadata?.[0].quantityEntry, { unit: 'kg', text: '1' });
    assert.notEqual(JSON.stringify(draft), before, 'the actual caller editor changed after detachment');
  } finally { gate.resume(); if (pending) await pending; screen.close(); }
});

test('a retained unsafe-input callback cannot publish an earlier actor review', async () => {
  const screen = await mount();
  try {
    const oldReview = screen.latest.onReview, draft = screen.legacy();
    probe.actor = 'owner-b';
    const result = await oldReview(draft); assert.equal(result.status, 'held');
    assert.ok(result.issues.includes('current-source-required') || result.issues.includes('context-changed'));
  } finally { screen.close(); }
});
