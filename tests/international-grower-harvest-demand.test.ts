import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS } from '../lib/crop-catalog.ts';
import { targetDemand } from '../lib/harvest-targets.ts';
import { growerDemandFromHarvestTarget } from '../lib/international/grower-harvest-demand.ts';
import type { GrowerPlanningProfile } from '../lib/international/grower-planning.ts';

// Engineering fixtures only: these quantities are not growing recommendations.
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const recordedAt = '2026-11-02T12:00:00.000Z';
const missing = { state: 'missing', reason: 'not-entered' } as const;
const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope,
  inputs: { plantsPerM2: missing, yieldKgPerM2: missing, establishment: missing, nurseryDays: missing,
    fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing,
    turnaroundDays: missing, allowedEntryMonths: missing } };
const target = { id: 'buyer-target', siteId: scope.siteId, cropKey: profile.cropKey,
  startMonth: '2028-02', endMonth: '2028-02', weeklyKg: 7, marketablePercent: 50 };
const request = (changes: object = {}) => ({ target, profile, scope, recordedAt, ...changes });

test('buyer totals use the existing actual-day authority and an explicit saleable allowance', () => {
  const result = growerDemandFromHarvestTarget(request());
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal(result.buyerTotalKg, targetDemand(target)!.demandKg);
  assert.equal(result.buyerTotalKg, 29);
  assert.equal(result.grossCapacityRequiredKg, 58);
  assert.equal(result.days, 29);
  assert.deepEqual(result.demand.harvestWindow.state === 'provided' && result.demand.harvestWindow.value,
    { start: '2028-02-01', endExclusive: '2028-03-01' });
  assert.equal(result.deliveryDistribution, 'not-established');
  assert.equal(result.sourceVerification, 'not-verified');
});

test('a missing saleable allowance stays missing instead of defaulting to all produce', () => {
  const { marketablePercent: _share, ...without } = target;
  assert.deepEqual(growerDemandFromHarvestTarget(request({ target: without })),
    { status: 'held', reasons: ['saleable-share-missing'] });
  assert.deepEqual(growerDemandFromHarvestTarget(request({ target: { ...target, marketablePercent: 0 } })),
    { status: 'held', reasons: ['zero-saleable-share'] });
});

test('produce-pack weights must be supplied by the grower before capacity can be matched', () => {
  const { weeklyKg: _kg, ...base } = target;
  const pack = { ...base, weeklyQuantity: 7, unit: 'bunches' as const };
  assert.deepEqual(growerDemandFromHarvestTarget(request({ target: pack })),
    { status: 'held', reasons: ['unit-weight-missing'] });
  const converted = growerDemandFromHarvestTarget(request({ target: { ...pack, kgPerUnit: 2 } }));
  assert.equal(converted.status, 'ready');
  if (converted.status === 'ready') assert.equal(converted.buyerTotalKg, 58);
});

test('the adapter never guesses a matching profile or transfers a buyer to another farm', () => {
  for (const changed of [
    { target: { ...target, siteId: 'site:1.00000,1.00000' } },
    { profile: { ...profile, scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } } },
  ]) assert.deepEqual(growerDemandFromHarvestTarget(request(changed)), { status: 'held', reasons: ['scope-mismatch'] });
  assert.deepEqual(growerDemandFromHarvestTarget(request({ profile: { ...profile, cropKey: CROPS[1].key } })),
    { status: 'held', reasons: ['crop-identity-mismatch'] });
  assert.deepEqual(growerDemandFromHarvestTarget(request({ scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' } })),
    { status: 'held', reasons: ['mapped-site-required'] });
});

test('source validity and finite capacity are required without inventing growing inputs', () => {
  for (const changes of [ { recordedAt: '2026-02-30T00:00:00.000Z' }, { target: { ...target, weeklyKg: -1 } },
    { profile: null } ]) {
    assert.equal(growerDemandFromHarvestTarget(request(changes)).status, 'held');
  }
  assert.deepEqual(growerDemandFromHarvestTarget(request({ target: { ...target, marketablePercent: Number.MIN_VALUE } })),
    { status: 'held', reasons: ['capacity-range'] });
  assert.equal(growerDemandFromHarvestTarget(request()).status, 'ready',
    'this adapter prepares demand only; the engine still requires every own agronomic input');
});

test('inclusive saved months become an exact year-crossing half-open window', () => {
  const result = growerDemandFromHarvestTarget(request({ target: { ...target, startMonth: '2027-12', endMonth: '2028-01' } }));
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal(result.days, 62);
  assert.deepEqual(result.demand.harvestWindow.state === 'provided' && result.demand.harvestWindow.value,
    { start: '2027-12-01', endExclusive: '2028-02-01' });
  assert.equal(result.demand.totalKg.state === 'provided' && result.demand.totalKg.unit, 'kg-total');
});

test('copy-time provenance cannot imply the original target was independently verified', () => {
  const before = JSON.stringify([target, profile]);
  const result = growerDemandFromHarvestTarget(request());
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready' || result.demand.totalKg.state !== 'provided') return;
  assert.equal(result.demand.totalKg.provenance.recordedAt, recordedAt);
  assert.match('reference' in result.demand.totalKg.provenance ? result.demand.totalKg.provenance.reference : '', /not its original entry time/);
  assert.equal(JSON.stringify([target, profile]), before);
});
