import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { type GrowerInput, type GrowerPlanningProfile, type GrowerPlanningScope } from '../lib/international/grower-planning.ts';
import {
  createGrowerCyclePlanting, growerCycleOriginView, hasGrowerCycleMarker, isProvenForeignGrowerCycle,
  normaliseGrowerCycleAttachment, normaliseGrowerCycleOrigin, preserveGrowerCycleMarker, resolvePlantingBasis,
  type GrowerCycleContext, type GrowerCycleOrigin,
} from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';

// Synthetic engineering fixtures only; none of these values is crop, household or nutrition guidance.
const recordedAt = '2026-11-05T21:00:00.000Z';
const scope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } as const;
const bed = { id: 'fixture-bed', label: 'Synthetic measured fixture', areaM2: 12 };
const geometryFingerprint = 'fixture-geometry:1';
const context: GrowerCycleContext = { scope, beds: [bed], geometryFingerprint };
const options = { plantingId: 'persistent-fixture-row', acceptedAt: recordedAt, geometryFingerprint };
const provided = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const household: GrowerCycleOrigin = { kind: 'grower-entered', purpose: 'household', entryId: 'entry-1' };
const trial: GrowerCycleOrigin = { kind: 'grower-entered', purpose: 'trial', entryId: 'entry-1' };
const buyer: GrowerCycleOrigin = { kind: 'buyer-target', harvestTargetId: 'target-a' };

function cycleFor(demandId: string, fixtureScope: GrowerPlanningScope = scope, fixtureBed = bed) {
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'fixture-profile', cropKey: CROPS[0].key, scope: fixtureScope, inputs: {
    plantsPerM2: provided(4, 'plants/m2'), yieldKgPerM2: provided(1, 'kg/m2/cycle'), establishment: provided('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: provided(1, 'days'),
    pickingDays: provided(2, 'days'), fieldOccupancyDays: provided(3, 'days'), turnaroundDays: provided(1, 'days'),
    allowedEntryMonths: provided([2], 'utc-months') } };
  const request: GrowerAutoPlanRequest = { requestedAt: recordedAt, scope: fixtureScope, geometryFingerprint, profiles: [profile],
    beds: [{ bed: fixtureBed, scope: fixtureScope, measuredAreaM2: provided(fixtureBed.areaM2, 'm2') }],
    planningStart: provided('2028-02-01', 'utc-date'), planningEndExclusive: provided('2028-03-01', 'utc-date'),
    availability: [{ bedId: fixtureBed.id, scope: fixtureScope, window: provided({ start: '2028-02-01', endExclusive: '2028-03-01' }, 'utc-date-window') }],
    reserved: [], maxAssessments: 1000, demands: [{ demandId, profileId: profile.profileId, scope: fixtureScope, totalKg: provided(1, 'kg-total'),
      harvestWindow: provided({ start: '2028-02-01', endExclusive: '2028-03-01' }, 'utc-date-window') }] };
  const proposal = generateGrowerAutoPlan(request);
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  return structuredClone(proposal.cycles[0]);
}
const stored = (row: object) => JSON.parse(JSON.stringify({ ...row, ...preserveGrowerCycleMarker(row) }));
const withOrigin = (row: { growerCycle: object }, origin: unknown) => ({ ...row, growerCycle: { ...row.growerCycle, origin } });

test('household and trial intent survives JSON, marker preservation, normalisation, basis resolution and projection', () => {
  for (const origin of [household, trial]) {
    const row = createGrowerCyclePlanting(cycleFor('grower-entered:entry-1'), { ...options, origin });
    assert.ok(row);
    assert.deepEqual(row.growerCycle.origin, origin);
    assert.equal('harvestTargetId' in row, false);
    const roundtrip = stored(row);
    assert.deepEqual(normaliseGrowerCycleAttachment(roundtrip.growerCycle), row.growerCycle);
    const resolved = resolvePlantingBasis(roundtrip, context);
    assert.equal(resolved.kind, 'grower-dated-cycle');
    if (resolved.kind === 'grower-dated-cycle') assert.deepEqual(resolved.attachment.origin, origin);
    const projection = projectGrowerCycles([roundtrip], context);
    assert.deepEqual(projection.ownCycles.map(cycle => cycle.origin), [{ status: 'recorded', origin }]);
    assert.ok(Object.isFrozen(projection.ownCycles[0].origin));
    roundtrip.growerCycle.origin.purpose = origin.kind === 'grower-entered' && origin.purpose === 'household' ? 'trial' : 'household';
    assert.deepEqual(projection.ownCycles[0].origin, { status: 'recorded', origin }, 'derived view is detached from the raw row');
  }
});

test('buyer origin names only its own target; an absent link stays buyer, a different link holds', () => {
  const row = createGrowerCyclePlanting(cycleFor('target-a'), { ...options, origin: buyer });
  assert.ok(row);
  for (const linked of [{ ...row, harvestTargetId: 'target-a' }, row]) {
    const resolved = resolvePlantingBasis(linked, context);
    assert.equal(resolved.kind, 'grower-dated-cycle');
    if (resolved.kind === 'grower-dated-cycle') assert.deepEqual(resolved.attachment.origin, buyer);
  }
  const wrong = resolvePlantingBasis({ ...row, harvestTargetId: 'target-b' }, context);
  assert.deepEqual(wrong, { kind: 'held', reasons: ['origin-row-mismatch'] });
  // Existing target IDs have no reserved prefix. Explicit buyer origin remains
  // valid; a household entry colliding with that saved ID is held by assembly.
  const prefixedBuyer = createGrowerCyclePlanting(cycleFor('grower-entered:entry-1'),
    { ...options, origin: { kind: 'buyer-target', harvestTargetId: 'grower-entered:entry-1' } });
  assert.ok(prefixedBuyer);
  assert.deepEqual(prefixedBuyer.growerCycle.origin, { kind: 'buyer-target', harvestTargetId: 'grower-entered:entry-1' });
  assert.equal(createGrowerCyclePlanting(cycleFor('target-a'), { ...options, origin: { kind: 'buyer-target', harvestTargetId: 'target-b' } }), null);
});

test('old buyer and old unknown attachments stay valid with an unrecorded origin that is never inferred', () => {
  for (const [demandId, link] of [['target-a', 'target-a'], ['fixture-demand', undefined], ['grower-entered:entry-1', undefined]] as const) {
    const created = createGrowerCyclePlanting(cycleFor(demandId), options);
    assert.ok(created);
    const row = link ? { ...created, harvestTargetId: link } : created;
    assert.equal('origin' in row.growerCycle, false, 'base-shaped attachments keep their exact shape');
    const roundtrip = stored(row);
    assert.equal(JSON.stringify(roundtrip.growerCycle), JSON.stringify(created.growerCycle));
    const resolved = resolvePlantingBasis(roundtrip, context);
    assert.equal(resolved.kind, 'grower-dated-cycle');
    if (resolved.kind === 'grower-dated-cycle') assert.equal(resolved.attachment.origin, undefined);
    assert.deepEqual(projectGrowerCycles([roundtrip], context).ownCycles[0].origin, { status: 'not-recorded' },
      `${demandId}: neither a buyer link nor an entered-looking demand ID is read as recorded intent`);
  }
  assert.deepEqual(growerCycleOriginView({}), { status: 'not-recorded' });
});

test('present null, undefined, unknown, extra-keyed or inconsistent origins hold and stay held after real JSON preservation', () => {
  const row = createGrowerCyclePlanting(cycleFor('grower-entered:entry-1'), { ...options, origin: household });
  assert.ok(row);
  const invalid: unknown[] = [null, undefined, false, '', 0, [], {}, { kind: 'grower-entered' },
    { kind: 'grower-entered', purpose: 'sale', entryId: 'entry-1' }, { kind: 'grower-entered', purpose: 'Household', entryId: 'entry-1' },
    { kind: 'grower-entered', purpose: 'household', entryId: 'entry-2' }, { kind: 'grower-entered', purpose: 'household', entryId: ' entry-1' },
    { kind: 'grower-entered', purpose: 'household', entryId: 'entry-1', note: 'extra' }, { kind: 'buyer-target', harvestTargetId: 'target-a' },
    { kind: 'buyer-target', harvestTargetId: 'grower-entered:other-entry' }, { kind: 'commercial', harvestTargetId: 'target-a' }];
  for (const origin of invalid) {
    const raw = withOrigin(row, origin);
    assert.equal(normaliseGrowerCycleAttachment(raw.growerCycle), null, JSON.stringify(origin));
    assert.equal(resolvePlantingBasis(raw, context).kind, 'held', JSON.stringify(origin));
    const kept = stored(raw);
    assert.equal(hasGrowerCycleMarker(kept), true);
    assert.equal(resolvePlantingBasis(kept, context).kind, 'held', `stored ${JSON.stringify(origin)}`);
    const projection = projectGrowerCycles([kept], context);
    assert.deepEqual(projection.ownCycles, []); assert.deepEqual(projection.legacyRows, []); assert.equal(projection.heldRows.length, 1);
  }
  // Accessor and inherited origins are presence, not absence, and are never evaluated.
  let reads = 0;
  const accessor = { ...row.growerCycle };
  Object.defineProperty(accessor, 'origin', { enumerable: true, get: () => { reads++; return household; } });
  assert.equal(normaliseGrowerCycleAttachment(accessor), null);
  assert.equal(resolvePlantingBasis(stored({ ...row, growerCycle: accessor }), context).kind, 'held');
  assert.equal(reads, 0);
  const { origin: _origin, ...withoutOrigin } = row.growerCycle;
  const inherited = Object.assign(Object.create({ origin: household }), withoutOrigin);
  assert.equal(normaliseGrowerCycleAttachment(inherited), null);
  const getterValue = { kind: 'grower-entered', entryId: 'entry-1' } as Record<string, unknown>;
  Object.defineProperty(getterValue, 'purpose', { enumerable: true, get: () => 'household' });
  assert.equal(normaliseGrowerCycleOrigin(getterValue, 'grower-entered:entry-1'), null);
  // Creation validates explicit absence-like values instead of silently omitting them.
  for (const origin of [null, undefined, { ...household, entryId: 'entry-2' }]) {
    assert.equal(createGrowerCyclePlanting(cycleFor('grower-entered:entry-1'), { ...options, origin: origin as GrowerCycleOrigin }), null);
  }
});

test('a grower-entered cycle may not carry a buyer link, before or after storage', () => {
  const row = createGrowerCyclePlanting(cycleFor('grower-entered:entry-1'), { ...options, origin: trial });
  assert.ok(row);
  const forged = { ...row, harvestTargetId: 'target-a' };
  assert.deepEqual(resolvePlantingBasis(forged, context), { kind: 'held', reasons: ['origin-row-mismatch'] });
  assert.deepEqual(resolvePlantingBasis(stored(forged)), { kind: 'held', reasons: ['origin-row-mismatch'] },
    'the mismatch is structural, so it holds even without current geometry context');
  assert.equal(projectGrowerCycles([stored(forged)], context).heldRows[0].reasons[0], 'origin-row-mismatch');
  assert.equal(resolvePlantingBasis({ ...row, harvestTargetId: undefined }, context).kind, 'grower-dated-cycle');
});

test('foreign-scope proof needs a valid origin when one is present', () => {
  const foreignScope = { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' } as const;
  const foreignBed = { ...bed, id: 'foreign-bed' };
  const row = createGrowerCyclePlanting(cycleFor('grower-entered:entry-1', foreignScope, foreignBed), { ...options, origin: household });
  assert.ok(row);
  assert.equal(isProvenForeignGrowerCycle(stored(row), scope, new Set([bed.id])), true);
  assert.equal(isProvenForeignGrowerCycle(stored(withOrigin(row, { ...household, purpose: 'sale' })), scope, new Set([bed.id])), false);
  assert.equal(isProvenForeignGrowerCycle(stored({ ...row, harvestTargetId: 'target-a' }), scope, new Set([bed.id])), false);
});
