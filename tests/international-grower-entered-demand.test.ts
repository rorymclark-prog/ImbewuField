import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS } from '../lib/crop-catalog.ts';
import { normaliseGrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import {
  GROWER_DEMAND_SELECTION_MAX_ROWS, GROWER_ENTERED_DEMAND_ID_PREFIX, growerDemandFromEnteredEntry,
  growerDemandsFromEnteredEntries, growerEnteredDemandId, type GrowerEnteredDemandEntry,
} from '../lib/international/grower-entered-demand.ts';

// Engineering fixtures only. No quantity below is household, nutrition or crop guidance.
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const otherScope = { kind: 'mapped-site' as const, siteId: 'site:1.00000,1.00000' };
const recordedAt = '2026-11-05T12:00:00.000Z';
const missing = { state: 'missing', reason: 'not-entered' } as const;
const profile: GrowerPlanningProfile = { version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope,
  inputs: { plantsPerM2: missing, yieldKgPerM2: missing, establishment: missing, nurseryDays: missing,
    fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing,
    turnaroundDays: missing, allowedEntryMonths: missing } };
const entry: GrowerEnteredDemandEntry = { kind: 'grower-entered', entryId: 'entry-1', purpose: 'household',
  cropKey: profile.cropKey, profileId: profile.profileId, grossKg: '24', harvestStart: '2028-02-01', harvestEndExclusive: '2028-03-01' };
const one = (changes: Partial<Record<keyof GrowerEnteredDemandEntry, unknown>> = {}, extra: object = {}) =>
  growerDemandFromEnteredEntry({ entry: { ...entry, ...changes }, profile, scope, recordedAt, ...extra });
const reasons = (result: ReturnType<typeof growerDemandFromEnteredEntry>) => result.status === 'held' ? result.reasons : [];

test('a household row becomes an explicit kg-total demand with honest provenance and no buyer fields', () => {
  const result = one();
  assert.equal(result.status, 'ready', reasons(result).join(','));
  if (result.status !== 'ready') return;
  assert.equal(result.demand.demandId, `${GROWER_ENTERED_DEMAND_ID_PREFIX}entry-1`);
  assert.equal(result.demand.demandId, growerEnteredDemandId('entry-1'));
  assert.deepEqual(result.demand.scope, scope);
  assert.equal(result.demand.profileId, profile.profileId);
  assert.equal(result.demand.totalKg.state, 'provided');
  if (result.demand.totalKg.state !== 'provided' || result.demand.totalKg.provenance.kind !== 'grower-estimate') throw Error('provenance');
  assert.equal(result.demand.totalKg.value, 24);
  assert.equal(result.demand.totalKg.unit, 'kg-total');
  assert.equal(result.demand.totalKg.provenance.recordedAt, recordedAt);
  assert.match(result.demand.totalKg.provenance.note ?? '', /Not a nutrition or food-security sufficiency/);
  assert.deepEqual(result.demand.harvestWindow.state === 'provided' && result.demand.harvestWindow.value,
    { start: '2028-02-01', endExclusive: '2028-03-01' });
  // The shared input authority accepts exactly what the adapter emitted.
  assert.deepEqual(normaliseGrowerInput(result.demand.totalKg, 'kg-total', (v): v is number => typeof v === 'number'), result.demand.totalKg);
  assert.deepEqual(result.metadata, { demandId: 'grower-entered:entry-1', entryId: 'entry-1', purpose: 'household', cropKey: profile.cropKey,
    profileId: profile.profileId, grossCapacityKg: 24, harvestWindow: { start: '2028-02-01', endExclusive: '2028-03-01' },
    quantityBasis: 'grower-entered-gross-cycle-capacity', buyer: 'none', saleableOutput: 'not-applicable',
    nutritionSufficiency: 'not-assessed', agronomicEvidence: 'not-established', sourceVerification: 'not-verified' });
  for (const key of ['targetId', 'harvestTargetId', 'buyerTotalKg', 'saleablePercent', 'weeklyKg', 'price', 'currency']) {
    assert.equal(key in result.demand, false, key); assert.equal(key in result.metadata, false, key);
  }
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.demand) && Object.isFrozen(result.metadata));
});

test('a trial label carries no evidence or safety claim and does not change the quantity meaning', () => {
  const result = one({ purpose: 'trial', grossKg: '3.5' });
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready' || result.demand.totalKg.state !== 'provided' || result.demand.totalKg.provenance.kind !== 'grower-estimate') return;
  assert.equal(result.demand.totalKg.value, 3.5);
  assert.match(result.demand.totalKg.provenance.note ?? '', /not agronomic evidence, a suitability or safety finding, or an approval/);
  assert.equal(result.metadata.agronomicEvidence, 'not-established');
  assert.equal(result.metadata.quantityBasis, 'grower-entered-gross-cycle-capacity');
});

test('blank stays missing, an explicit zero stays a known zero, and neither borrows the other', () => {
  for (const blank of ['', '   ']) {
    const result = one({ grossKg: blank });
    assert.equal(result.status, 'ready');
    if (result.status !== 'ready') continue;
    assert.deepEqual(result.demand.totalKg, { state: 'missing', reason: 'not-entered' });
    assert.equal(result.metadata.grossCapacityKg, null);
  }
  for (const zero of ['0', '0.0', '00']) {
    const result = one({ grossKg: zero, harvestStart: '', harvestEndExclusive: '' });
    assert.equal(result.status, 'ready');
    if (result.status !== 'ready') continue;
    assert.equal(result.demand.totalKg.state === 'provided' && result.demand.totalKg.value, 0);
    assert.deepEqual(result.demand.harvestWindow, { state: 'missing', reason: 'not-applicable' });
    assert.equal(result.metadata.grossCapacityKg, 0);
  }
  const positiveNoWindow = one({ harvestStart: '', harvestEndExclusive: '' });
  assert.equal(positiveNoWindow.status === 'ready' && positiveNoWindow.demand.harvestWindow.state, 'missing');
  assert.equal(positiveNoWindow.status === 'ready' && positiveNoWindow.demand.harvestWindow.state === 'missing'
    && positiveNoWindow.demand.harvestWindow.reason, 'not-entered');
  // A non-string or absent quantity is malformed input, never silently blank.
  for (const grossKg of [undefined, null, 0, 5]) assert.deepEqual(reasons(one({ grossKg })), ['gross-kg-invalid'], String(grossKg));
});

test('negative, nonfinite, exponent, locale, overflow and over-precise quantities hold', () => {
  const cases: [string, string][] = [['-1', 'gross-kg-negative'], ['-0', 'gross-kg-negative'], ['1e3', 'gross-kg-format'],
    ['Infinity', 'gross-kg-format'], ['NaN', 'gross-kg-format'], ['1,5', 'gross-kg-format'], ['0x10', 'gross-kg-format'],
    ['+5', 'gross-kg-format'], ['5kg', 'gross-kg-format'], ['.5', 'gross-kg-format'], ['1.0000001', 'gross-kg-precision'],
    ['9007199254740992', 'gross-kg-range'], ['9'.repeat(40), 'gross-kg-range'], ['1'.repeat(65), 'gross-kg-format']];
  for (const [grossKg, reason] of cases) assert.deepEqual(reasons(one({ grossKg })), [reason], grossKg);
  // Pending decision: only numeric representation is guarded; no quantity policy ceiling is implied.
  assert.equal(one({ grossKg: '9007199254740991' }).status, 'ready', 'the largest exactly representable whole kilogram is accepted');
  assert.equal(one({ grossKg: '1000000001' }).status, 'ready', 'no unapproved 1e9 kg policy ceiling remains');
});

test('original kilogram decimals cannot round to a different request before review or saving', () => {
  // Engineering precision cases, not plausible growing targets. Every text fits
  // the existing entry syntax; Number would silently erase these fractions.
  for (const grossKg of ['9007199254740990.1', '9007199254740990.9', '1000000000000.000001']) {
    assert.deepEqual(reasons(one({ grossKg })), ['gross-kg-representation-loss'], grossKg);
  }
  for (const [grossKg, kg] of [['00012.340000', 12.34], ['00.000001', 0.000001], ['000', 0], ['9007199254740991', Number.MAX_SAFE_INTEGER]] as const) {
    const result = one({ grossKg });
    assert.equal(result.status, 'ready', grossKg);
    assert.equal(result.status === 'ready' && result.demand.totalKg.state === 'provided' && result.demand.totalKg.value, kg);
  }
});

test('malformed, partial, reversed or impossible harvest windows hold', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ harvestStart: '2028-02-01', harvestEndExclusive: '' }, 'harvest-window-incomplete'],
    [{ harvestStart: '', harvestEndExclusive: '2028-03-01' }, 'harvest-window-incomplete'],
    [{ harvestEndExclusive: '2028-02-01' }, 'harvest-window-invalid'],
    [{ harvestStart: '2028-03-01' }, 'harvest-window-invalid'],
    [{ harvestStart: '2028-02-30' }, 'harvest-window-invalid'],
    [{ harvestStart: '2028-2-1' }, 'harvest-window-invalid'],
    [{ harvestStart: null }, 'harvest-window-invalid'],
    [{ harvestEndExclusive: undefined }, 'harvest-window-invalid'],
  ];
  for (const [changes, reason] of cases) assert.deepEqual(reasons(one(changes)), [reason], JSON.stringify(changes));
  // Field-level problems are reported together so one edit pass can fix them.
  assert.deepEqual(reasons(one({ purpose: 'sale', grossKg: '-1', harvestStart: '2028-02-30' })),
    ['purpose-invalid', 'gross-kg-negative', 'harvest-window-invalid']);
});

test('scope, review time, profile and crop identity must match without inference', () => {
  assert.deepEqual(reasons(one({}, { scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' } })), ['mapped-site-required']);
  assert.deepEqual(reasons(one({}, { recordedAt: '2026-02-30T00:00:00.000Z' })), ['review-time-invalid']);
  assert.deepEqual(reasons(one({}, { profile: { ...profile, scope: otherScope } })), ['scope-mismatch']);
  assert.deepEqual(reasons(one({}, { profile: { ...profile, version: 999 } })), ['profile-invalid']);
  assert.deepEqual(reasons(one({}, { profile: null })), ['profile-invalid']);
  assert.deepEqual(reasons(one({ profileId: 'another-profile' })), ['profile-identity-mismatch']);
  assert.deepEqual(reasons(one({ cropKey: CROPS[1].key })), ['crop-identity-mismatch']);
  assert.deepEqual(reasons(one({ profileId: '' })), ['profile-required']);
  assert.deepEqual(reasons(one({ cropKey: '' })), ['crop-required']);
  assert.deepEqual(reasons(one({ purpose: undefined })), ['purpose-invalid']);
  assert.deepEqual(reasons(one({ kind: 'buyer-target' })), ['entry-kind-invalid']);
  for (const entryId of ['', ' padded', 'x'.repeat(121), 'line\nbreak', 7]) assert.deepEqual(reasons(one({ entryId })), ['entry-id-invalid'], String(entryId));
});

test('an incomplete own profile is still accepted here; the engine reports its gaps, no catalogue value is borrowed', () => {
  const result = one();
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.deepEqual(result.profile.inputs.yieldKgPerM2, missing);
});

test('accessors, foreign prototypes and buyer or price fields are rejected rather than read twice or ignored', () => {
  let reads = 0;
  const getter = { ...entry };
  Object.defineProperty(getter, 'grossKg', { enumerable: true, get: () => (++reads ? '24' : '') });
  assert.deepEqual(reasons(growerDemandFromEnteredEntry({ entry: getter, profile, scope, recordedAt })), ['entry-unreadable']);
  assert.equal(reads, 0);
  class Row { constructor() { Object.assign(this, entry); } }
  assert.deepEqual(reasons(growerDemandFromEnteredEntry({ entry: new Row(), profile, scope, recordedAt })), ['entry-unreadable']);
  for (const extra of [{ targetId: 'target-a' }, { weeklyKg: 7 }, { price: 1 }, { marketablePercent: 50 }]) {
    assert.deepEqual(reasons(growerDemandFromEnteredEntry({ entry: { ...entry, ...extra }, profile, scope, recordedAt })), ['entry-shape-invalid']);
  }
  assert.deepEqual(reasons(growerDemandFromEnteredEntry({ entry: null, profile, scope, recordedAt })), ['entry-unreadable']);
});

test('batch conversion preserves order and answers identity questions over the whole set', () => {
  const second = { ...entry, entryId: 'entry-2', purpose: 'trial' as const, grossKg: '0', harvestStart: '', harvestEndExclusive: '' };
  const ready = growerDemandsFromEnteredEntries({ entries: [second, entry], profiles: [profile], scope, recordedAt });
  assert.equal(ready.status, 'ready');
  if (ready.status === 'ready') assert.deepEqual(ready.rows.map(row => row.demand.demandId), ['grower-entered:entry-2', 'grower-entered:entry-1']);
  const batch = (changes: object) => growerDemandsFromEnteredEntries({ entries: [entry, second], profiles: [profile], scope, recordedAt, ...changes });
  // Duplicate row identities hold whichever row comes first.
  for (const entries of [[entry, { ...second, entryId: 'entry-1' }], [{ ...second, entryId: 'entry-1' }, entry]]) {
    const result = batch({ entries });
    assert.equal(result.status, 'held'); assert.deepEqual(result.status === 'held' && result.reasons, ['entry-ambiguous']);
    assert.equal(result.status === 'held' && result.entryIndex, 0);
  }
  // A saved buyer target with the namespaced identity is a collision, not a link.
  const collision = batch({ reservedDemandIds: ['target-a', 'grower-entered:entry-2'] });
  assert.deepEqual(collision.status === 'held' && [collision.reasons, collision.entryIndex], [['demand-id-collision'], 1]);
  assert.equal(batch({ reservedDemandIds: ['entry-1', 'target-a'] }).status, 'ready', 'an un-namespaced target ID does not collide');
  // Profile identity: duplicates (even one damaged) are ambiguous; absence is missing.
  const ambiguous = batch({ profiles: [profile, { ...profile, version: 999 }] });
  assert.deepEqual(ambiguous.status === 'held' && ambiguous.reasons, ['profile-ambiguous']);
  const absent = batch({ profiles: [] });
  assert.deepEqual(absent.status === 'held' && absent.reasons, ['profile-missing']);
  const damaged = batch({ profiles: [{ ...profile, version: 999 }] });
  assert.deepEqual(damaged.status === 'held' && damaged.reasons, ['profile-invalid']);
  assert.deepEqual((batch({ entries: 'nope' }) as { reasons: readonly string[] }).reasons, ['entries-invalid']);
  assert.deepEqual((batch({ profiles: null }) as { reasons: readonly string[] }).reasons, ['profiles-invalid']);
  assert.deepEqual((batch({ scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' } }) as { reasons: readonly string[] }).reasons, ['mapped-site-required']);
});

test('row limit is a software bound checked before any row is converted, and inputs stay untouched', () => {
  const many = Array.from({ length: GROWER_DEMAND_SELECTION_MAX_ROWS + 1 }, (_, index) => ({ ...entry, entryId: `entry-${index}` }));
  const limited = growerDemandsFromEnteredEntries({ entries: many, profiles: [profile], scope, recordedAt });
  assert.deepEqual(limited.status === 'held' && [limited.reasons, limited.entryIndex], [['entry-row-limit'], null]);
  const atLimit = growerDemandsFromEnteredEntries({ entries: many.slice(1), profiles: [profile], scope, recordedAt });
  assert.equal(atLimit.status, 'ready');
  const entries = [{ ...entry }], profiles = [structuredClone(profile)];
  const before = JSON.stringify([entries, profiles]);
  growerDemandsFromEnteredEntries({ entries, profiles, scope, recordedAt, reservedDemandIds: new Set(['x']) });
  assert.equal(JSON.stringify([entries, profiles]), before);
  assert.equal(Object.isFrozen(entries[0]) || Object.isFrozen(profiles[0]), false, 'caller editors are never frozen');
});
