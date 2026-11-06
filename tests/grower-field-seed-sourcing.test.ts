import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, type GrowerCycleContext } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { reviewSeedPurchaseCounts } from '../lib/seed-purchase-counts.ts';
import { reviewGrowerFieldSeedSourcing, type GrowerFieldSeedSourcingInput } from '../lib/international/grower-seed-sourcing.ts';

// Synthetic arithmetic controls use existing identities and accepted-cycle
// constructors. Their quantities and dates are not farming recommendations.
const stamp = '2026-11-06T12:00:00.000Z';
const botanicalCandidate = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) === null)!;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
async function fixture(cropKey = botanicalCandidate.key, establishment: 'direct' | 'transplant' = 'direct', bedCount = 2) {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const bed = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = Array.from({ length: bedCount }, (_, index) => ({ ...bed, id: `private-field-bed-${index}`,
    x: (index + 1) / (bedCount + 1), y: 0.5, wM: 3, hM: 4 })); canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    sourceRevision: 'private-field-source', raw: canvas }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-field-profile', cropKey, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(establishment, 'method'),
    nurseryDays: establishment === 'transplant' ? own(10, 'days') : { state: 'missing', reason: 'not-entered' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'private-field-demand', profileId: profile.profileId, scope,
      totalKg: own(12 * (bedCount - 1) + 1, 'kg-total'), harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Synthetic proposal unavailable');
  assert.equal(proposal.cycles.length, bedCount);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-field-planting-${index}`, acceptedAt: stamp,
      geometryFingerprint: source.geometryFingerprint }); assert.ok(row); return row;
  });
  const cycleContext: GrowerCycleContext = { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const overlappingRow = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-overlapping-planting', acceptedAt: stamp,
    geometryFingerprint: source.geometryFingerprint }); assert.ok(overlappingRow);
  return { rows, cycleContext, overlappingRow };
}
const base = await fixture();
function requirement(plantingId = base.rows[0].id, extra: Record<string, unknown> = {}) {
  return { plantingId, materialDeclaration: 'botanical-seed', grossRequiredSeeds: 100, grossRequirementConfirmed: true, ...extra };
}
function group(plantingIds = base.rows.map(row => row.id), extra: Record<string, unknown> = {}) {
  return { id: 'private-field-group', label: '  My explicit planning supplies  ', plantingIds, interchangeabilityConfirmed: true,
    allocatedToPlanSeeds: 20, seedsPerPack: 100, ...extra };
}
function input(extra: Partial<GrowerFieldSeedSourcingInput> = {}): GrowerFieldSeedSourcingInput {
  const { rows, cycleContext } = structuredClone(base);
  return { rows, cycleContext, requirements: base.rows.map(row => requirement(row.id)), groups: [group()], ...extra };
}
function frozen(value: unknown) {
  if (value && typeof value === 'object') { assert.equal(Object.isFrozen(value), true); for (const child of Object.values(value)) frozen(child); }
}

test('a field-only accepted source exposes canonical options before any requirement or group is entered', () => {
  const source = structuredClone(base), projection = projectGrowerCycles(source.rows, source.cycleContext);
  assert.equal(projection.ownCycles.length, 2); assert.ok(projection.ownCycles.every(cycle => cycle.nurseryDemand === null));
  const review = reviewGrowerFieldSeedSourcing({ ...source, requirements: [], groups: [] });
  assert.equal(review.status, 'partial'); assert.equal(review.representedCycleCount, 2); assert.equal(review.assignedCycleCount, 0);
  assert.deepEqual(review.unassignedPlantingIds, source.rows.map(row => row.id)); assert.equal(review.cycles.length, 2);
  for (const option of review.cycles) {
    const cycle = projection.ownCycles.find(row => row.plantingId === option.plantingId)!;
    assert.equal(option.cropName, botanicalCandidate.name); assert.equal(option.knownMaterialUnit, null); assert.equal(option.status, 'eligible');
    assert.equal(option.plannedFieldEntryDate, cycle.assessment.schedule.fieldEntryDate); assert.deepEqual(option.reasons, []);
  }
  assert.match(review.guidance, /No nursery phase does not establish botanical direct sowing/);
  assert.equal('horizon' in review, false); assert.equal('nurseryReviewStatus' in review, false);
});

test('only entered gross whole-seed counts feed the existing purchase counter, independently of final plant positions', () => {
  const data = input(), before = JSON.stringify(data), review = reviewGrowerFieldSeedSourcing(data), row = review.groups[0];
  assert.equal(review.status, 'available'); assert.equal(review.assignedCycleCount, 2); assert.equal(row.selectedCycleCount, 2);
  assert.equal(row.requiredSeeds, 200); assert.equal(row.knownRequiredSeedsSubtotal, 200);
  assert.deepEqual(row.counts, reviewSeedPurchaseCounts(200, 20, 100));
  assert.equal(projectGrowerCycles(base.rows, base.cycleContext).ownCycles[0].targetPlantCount, 48);
  const verification: 'not-verified' = review.sourceVerification, basis: 'entered-gross-whole-seed-count' = review.requirementBasis;
  assert.equal(verification, 'not-verified'); assert.equal(basis, 'entered-gross-whole-seed-count');
  assert.equal(review.coverage, 'represented-accepted-non-nursery-cycles-only'); assert.equal(review.wholeFarmCoverage, 'not-assessed');
  assert.deepEqual(row.identification.cropNames, [botanicalCandidate.name]); assert.equal(row.identification.enteredLabel, '  My explicit planning supplies  ');
  assert.equal('batchIds' in row, false); assert.equal(JSON.stringify(data), before); assert.equal(Object.isFrozen(data.rows), false); frozen(review);
});

test('no-nursery cycles still need an explicit material declaration and confirmation of the gross requirement', () => {
  const id = base.rows[0].id;
  for (const patch of [{ materialDeclaration: null }, { materialDeclaration: 'vegetative' }, { materialDeclaration: 'seed' },
    { grossRequirementConfirmed: false }, { grossRequirementConfirmed: 'true' }]) {
    const review = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(id, patch)], groups: [group([id])] }));
    assert.equal(review.groups[0].status, 'held'); assert.equal(review.groups[0].requiredSeeds, null); assert.equal(review.groups[0].counts, null);
    assert.equal(review.assignedCycleCount, 0);
  }
  const absent = reviewGrowerFieldSeedSourcing(input({ requirements: [], groups: [group([id])] }));
  assert.ok(absent.groups[0].issues.includes('field-requirement-not-recorded')); assert.equal(absent.groups[0].counts, null);
});

test('existing known vegetative material vetoes seeds even after the grower explicitly selects botanical seed', async () => {
  const known = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) !== null); assert.ok(known);
  const source = await fixture(known.key, 'direct', 1), id = source.rows[0].id;
  const review = reviewGrowerFieldSeedSourcing({ ...source, requirements: [requirement(id)], groups: [group([id])] });
  assert.equal(review.cycles[0].knownMaterialUnit, knownVegetativePropagationUnit(known.key)); assert.equal(review.cycles[0].status, 'held');
  assert.ok(review.cycles[0].reasons.includes('known-vegetative-material-not-seeds'));
  assert.equal(review.groups[0].status, 'held'); assert.equal(review.groups[0].counts, null); assert.equal(review.groups[0].requiredSeeds, null);
  assert.deepEqual(review.groups[0].identification.cropNames, [known.name]); assert.equal(review.assignedCycleCount, 0);
});

test('confirmed zero, unknown gross requirements and known subtotals stay distinct without inferred loss allowances', () => {
  const ids = base.rows.map(row => row.id);
  const zero = reviewGrowerFieldSeedSourcing(input({ requirements: ids.map(id => requirement(id, { grossRequiredSeeds: 0 })) }));
  assert.equal(zero.status, 'available'); assert.equal(zero.groups[0].requiredSeeds, 0); assert.equal(zero.groups[0].knownRequiredSeedsSubtotal, 0);
  assert.deepEqual(zero.groups[0].counts, { status: 'complete', neededSeeds: 0, packsNeeded: 0, plannedPackSeeds: 0 });
  const unknown = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(ids[0], { grossRequiredSeeds: null }), requirement(ids[1], { grossRequiredSeeds: 7 })] }));
  assert.equal(unknown.groups[0].status, 'unknown'); assert.equal(unknown.groups[0].requiredSeeds, null);
  assert.equal(unknown.groups[0].knownRequiredSeedsSubtotal, 7); assert.equal(unknown.groups[0].counts?.neededSeeds, null);
  assert.equal(unknown.assignedCycleCount, 2);
});

test('invalid authored counts hold the selected group instead of becoming unknown, rounded values or zero', () => {
  const id = base.rows[0].id;
  for (const gross of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '100', true, {}, []]) {
    const review = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(id, { grossRequiredSeeds: gross })], groups: [group([id])] }));
    assert.equal(review.groups[0].status, 'held'); assert.ok(review.groups[0].issues.includes('gross-seed-count-invalid'));
    assert.equal(review.groups[0].counts, null); assert.equal(review.groups[0].requiredSeeds, null);
  }
  for (const patch of [{ allocatedToPlanSeeds: -1 }, { seedsPerPack: 0 }, { seedsPerPack: '100' }]) {
    const review = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(id)], groups: [group([id], patch)] }));
    assert.equal(review.groups[0].status, 'held'); assert.ok(review.groups[0].issues.includes('allocation-or-pack-count-invalid'));
  }
});

test('duplicate or malformed requirements and ambiguous group identities cannot choose an arbitrary counting winner', () => {
  const id = base.rows[0].id;
  for (const requirements of [[requirement(id), requirement(id)], [requirement(id), requirement(id, { extra: 'private-extra' })],
    [{ plantingId: id, grossRequiredSeeds: 100 }]]) {
    const review = reviewGrowerFieldSeedSourcing(input({ requirements, groups: [group([id])] }));
    assert.equal(review.groups[0].status, 'held'); assert.equal(review.groups[0].counts, null);
  }
  for (const groups of [[group([id, id])], [group([id]), group([base.rows[1].id])]]) {
    const review = reviewGrowerFieldSeedSourcing(input({ groups }));
    assert.ok(review.groups.every(row => row.status === 'held')); assert.equal(review.assignedCycleCount, 0);
  }
});

test('overlap auditing remembers memberships of malformed groups and holds both sides in either order', () => {
  const id = base.rows[0].id, good = group([id]), malformed = group([id], { id: null, plantingIds: [id, null] });
  for (const groups of [[good, malformed], [malformed, good]]) {
    const review = reviewGrowerFieldSeedSourcing(input({ groups }));
    assert.equal(review.groups.length, 2); assert.ok(review.groups.every(row => row.status === 'held'));
    assert.ok(review.groups.every(row => row.issues.includes('cycle-membership-overlap'))); assert.equal(review.assignedCycleCount, 0);
  }
});

test('foreign, legacy, malformed and nursery memberships are held without importing the legacy BOQ or nursery counts', async () => {
  const nursery = await fixture(botanicalCandidate.key, 'transplant', 1), id = base.rows[0].id;
  const legacy = { id: 'private-legacy', bedId: base.rows[0].bedId, cropKey: botanicalCandidate.key, sowMonth: 2 };
  const held = { ...base.rows[1], growerCycle: undefined };
  const rows = [base.rows[0], legacy, held, ...nursery.rows.map(row => ({ ...row, id: 'private-nursery-mismatch' }))];
  const candidates = ['private-foreign', legacy.id, held.id, 'private-nursery-mismatch'];
  for (const foreign of candidates) {
    const review = reviewGrowerFieldSeedSourcing(input({ rows, requirements: [requirement(id), requirement(foreign)], groups: [group([id, foreign])] }));
    assert.equal(review.groups[0].status, 'held'); assert.equal(review.groups[0].requiredSeeds, null);
    assert.equal(review.legacySourceRowCount, 1); assert.ok(review.heldSourceRowCount >= 1);
    assert.deepEqual(review.groups[0].identification.cropNames, [botanicalCandidate.name]);
    assert.equal(review.groups[0].identification.cropStatus, 'incomplete');
  }
  const onlyNursery = reviewGrowerFieldSeedSourcing({ ...nursery, requirements: [requirement(nursery.rows[0].id)], groups: [group([nursery.rows[0].id])] });
  assert.equal(onlyNursery.excludedNurseryCycleCount, 1); assert.equal(onlyNursery.cycles.length, 0); assert.equal(onlyNursery.groups[0].status, 'held');
});

test('canonical source replay holds scope, geometry, bed, row and overlapping reservation changes before counting', () => {
  const id = base.rows[0].id;
  const contexts: GrowerCycleContext[] = [
    { ...base.cycleContext, scope: { kind: 'unmapped-workspace', workspaceId: 'private-other-workspace' } },
    { ...base.cycleContext, geometryFingerprint: 'private-other-fingerprint' },
    { ...base.cycleContext, beds: [] },
    { ...base.cycleContext, beds: base.cycleContext.beds.map(bed => ({ ...bed, areaM2: bed.areaM2 + 1 })) },
  ];
  for (const cycleContext of contexts) {
    const review = reviewGrowerFieldSeedSourcing(input({ cycleContext, requirements: [requirement(id)], groups: [group([id])] }));
    assert.equal(review.cycles.length, 0); assert.equal(review.groups[0].status, 'held'); assert.ok(review.heldSourceRowCount > 0);
  }
  const duplicate = reviewGrowerFieldSeedSourcing(input({ rows: [base.rows[0], base.rows[0]], requirements: [requirement(id)], groups: [group([id])] }));
  assert.equal(duplicate.cycles.length, 0); assert.equal(duplicate.heldSourceRowCount, 2); assert.equal(duplicate.groups[0].counts, null);
  const overlapping = reviewGrowerFieldSeedSourcing(input({ rows: [base.rows[0], base.overlappingRow],
    requirements: [requirement(id), requirement(base.overlappingRow.id)], groups: [group([id, base.overlappingRow.id])] }));
  assert.equal(overlapping.cycles.length, 0); assert.equal(overlapping.heldSourceRowCount, 2);
  assert.ok(overlapping.sourceIssues.includes('overlapping-own-reservation')); assert.equal(overlapping.groups[0].counts, null);
  const changed = reviewGrowerFieldSeedSourcing(input({ rows: [{ ...base.rows[0], cropKey: 'private-forged-name' }], requirements: [requirement(id)], groups: [group([id])] }));
  assert.equal(changed.cycles.length, 0); assert.equal(changed.groups[0].identification.cropStatus, 'unavailable');
});

test('source omissions remain explicit while valid represented group counts do not claim whole-farm coverage', () => {
  const id = base.rows[0].id;
  const review = reviewGrowerFieldSeedSourcing(input({ rows: [base.rows[0], { ...base.rows[1], growerCycle: undefined }],
    requirements: [requirement(id)], groups: [group([id])] }));
  assert.equal(review.status, 'partial'); assert.equal(review.groups[0].status, 'complete'); assert.equal(review.groups[0].requiredSeeds, 100);
  assert.equal(review.heldSourceRowCount, 1); assert.equal(review.legacySourceRowCount, 0, 'An undefined marker stays held in the original canonical reader');
  assert.ok(review.sourceIssues.includes('source-has-held-rows')); assert.equal(review.wholeFarmCoverage, 'not-assessed');
});

test('gross sum overflow and pack-product overflow remain separate bounded planning outcomes', () => {
  const ids = base.rows.map(row => row.id);
  const sum = reviewGrowerFieldSeedSourcing(input({ requirements: ids.map(id => requirement(id, { grossRequiredSeeds: Number.MAX_SAFE_INTEGER })) }));
  assert.equal(sum.groups[0].status, 'overflow'); assert.equal(sum.groups[0].requiredSeeds, null); assert.equal(sum.groups[0].counts, null);
  assert.ok(sum.groups[0].issues.includes('seed-requirement-overflow'));
  const packs = reviewGrowerFieldSeedSourcing(input({ requirements: [requirement(ids[0], { grossRequiredSeeds: Number.MAX_SAFE_INTEGER })],
    groups: [group([ids[0]], { allocatedToPlanSeeds: 0, seedsPerPack: 2 })] }));
  assert.equal(packs.groups[0].status, 'overflow'); assert.equal(packs.groups[0].requiredSeeds, Number.MAX_SAFE_INTEGER);
  assert.equal(packs.groups[0].counts?.plannedPackSeeds, null); assert.ok(packs.groups[0].issues.includes('pack-count-product-overflow'));
});

test('descriptor probes reject executable and throwing evidence without getters, coercion or caller freezing', () => {
  let reads = 0;
  const getter = Object.defineProperty(requirement(), 'grossRequiredSeeds', { enumerable: true, get() { reads++; return 100; } });
  const conversion = { toString() { reads++; return '100'; }, valueOf() { reads++; return 100; } };
  const unsafe = [input({ requirements: [getter] }), input({ requirements: [requirement(undefined, { grossRequiredSeeds: conversion })] }),
    new Proxy(input(), { ownKeys() { throw Error('private-reflection'); } })];
  for (const data of unsafe) {
    const review = reviewGrowerFieldSeedSourcing(data); assert.equal(review.status, 'unavailable'); assert.deepEqual(review.groups, []);
    assert.doesNotMatch(JSON.stringify(review), /private-|site:/);
  }
  assert.equal(reads, 0);
  const data = input(), review = reviewGrowerFieldSeedSourcing(data);
  const original = JSON.stringify(review);
  assert.ok(Array.isArray(data.requirements)); data.requirements[0].grossRequiredSeeds = 999;
  assert.ok(Array.isArray(data.groups)); data.groups[0].label = 'private-later-label';
  assert.equal(JSON.stringify(review), original); assert.equal(Object.isFrozen(data), false); assert.equal(Object.isFrozen(data.rows), false); frozen(review);
});
