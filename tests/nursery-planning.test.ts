import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitiseNurserySettings, type NurserySettings } from '@/lib/nursery-settings';
import { loadCropPlan, saveCropPlan } from '@/lib/crop-plan';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';

const settings: NurserySettings = {
  version: 1,
  spaces: [{ id: 'bench', siteId: 'garden', name: 'Propagation table', usableM2: 3 }],
  containers: [{ id: 'tray', siteId: 'garden', name: 'Own cell tray', cells: 72, widthCm: 30, lengthCm: 50, owned: 10 }],
  profiles: [{ id: 'method', siteId: 'garden', cropKey: 'lettuce', model: 'seed-cell', containerId: 'tray', spaceId: 'bench' }],
};

test('saving nursery equipment never invents germination, survival, dimensions or stock', () => {
  assert.deepEqual(sanitiseNurserySettings(settings), settings);
  const minimal: NurserySettings = { ...settings,
    containers: [{ id: 'tray', siteId: 'garden', name: 'Unmeasured tray', cells: 72 }],
  };
  assert.deepEqual(sanitiseNurserySettings(minimal), minimal);
  assert.equal(sanitiseNurserySettings(null).profiles.length, 0);
  assert.deepEqual(sanitiseNurserySettings({ ...settings, version: 2 }), { version: 1, spaces: [], containers: [], profiles: [] });
});

test('corrupt equipment cannot turn an overflowing footprint or fractional tray count into capacity', () => {
  for (const patch of [{ cells: -1 }, { cells: 1.5 }, { widthCm: 0 }, { lengthCm: Infinity },
    { widthCm: Number.MAX_VALUE, lengthCm: Number.MAX_VALUE }, { owned: -1 }, { owned: 0.5 }, { siteId: '' }]) {
    assert.equal(sanitiseNurserySettings({ ...settings, containers: [{ ...settings.containers[0], ...patch }] }).containers.length, 0);
  }
  assert.equal(sanitiseNurserySettings({ ...settings, spaces: [{ ...settings.spaces[0], usableM2: NaN }] }).spaces.length, 0);
  assert.equal(sanitiseNurserySettings({ ...settings, spaces: [{ ...settings.spaces[0], usableM2: 0 }] }).spaces[0].usableM2, 0);
  assert.equal(sanitiseNurserySettings({ ...settings, containers: [{ ...settings.containers[0], owned: 0 }] }).containers[0].owned, 0);
  // A recorded zero is evidence, not a positive seed-cell capacity. The dated
  // nursery pipeline separately holds that denominator instead of deleting it.
  assert.equal(sanitiseNurserySettings({ ...settings, containers: [{ ...settings.containers[0], cells: 0 }] }).containers[0].cells, 0);
});

test('measured tray output retains its own evidence without applying seed-cell losses a second time', () => {
  const measured = { ...settings.profiles[0], model: 'measured-tray' as const, usableStartsPerTray: 60.5,
    seedsPerTray: 100, germinationPercent: 80, nurserySurvivalPercent: 90, fieldSurvivalPercent: 95 };
  const saved = sanitiseNurserySettings({ ...settings, profiles: [measured] }).profiles[0];
  assert.equal(saved.usableStartsPerTray, 60.5);
  assert.equal(saved.fieldSurvivalPercent, 95);
  assert.equal(saved.germinationPercent, undefined);
  assert.equal(saved.nurserySurvivalPercent, undefined);
  assert.equal(saved.seedsPerTray, 100);
  assert.equal(sanitiseNurserySettings({ ...settings, profiles: [{ ...measured, seedsPerTray: 0 }] }).profiles[0].seedsPerTray, 0);
});

test('own propagation records retain zero success and existing crop identity without borrowing a catalogue method', () => {
  const profile = settings.profiles[0];
  assert.equal(sanitiseNurserySettings({ ...settings, profiles: [{ ...profile, germinationPercent: 0 }] }).profiles[0].germinationPercent, 0);
  for (const patch of [{ germinationPercent: 101 }, { nurserySurvivalPercent: -1 },
    { fieldSurvivalPercent: NaN }, { nurseryWeeks: 0 }, { nurseryWeeks: 53 }, { cropKey: 'not-a-known-crop-identity' },
    { model: 'unknown' }, { containerId: '' }]) {
    assert.equal(sanitiseNurserySettings({ ...settings, profiles: [{ ...profile, ...patch }] }).profiles.length, 0);
  }
  // The saved recipe records the grower's selected method. A catalogue's
  // transplant flag cannot invalidate an own-input nursery observation.
  const ownMethod = { ...profile, cropKey: 'carrots' };
  assert.deepEqual(sanitiseNurserySettings({ ...settings, profiles: [ownMethod] }).profiles, [ownMethod]);
  assert.deepEqual(sanitiseNurserySettings(settings).profiles, settings.profiles, 'existing supported recipes retain their exact legacy inputs');
});

test('deleting equipment keeps dependent methods visible and site-specific crop recipes remain distinct', () => {
  const dangling = { ...settings, containers: [], spaces: [] };
  assert.deepEqual(sanitiseNurserySettings(dangling).profiles, settings.profiles);
  const second = { ...settings.profiles[0], id: 'other-method', siteId: 'other-garden' };
  assert.equal(sanitiseNurserySettings({ ...settings, profiles: [...settings.profiles, second] }).profiles.length, 2);
  // Selecting the first duplicate would quietly certify one contradictory
  // recipe. Every member now stays unavailable, with a durable review issue.
  const ambiguous = sanitiseNurserySettings({ ...settings, profiles: [...settings.profiles, { ...second, siteId: 'garden' }] });
  assert.equal(ambiguous.profiles.length, 0);
  assert.ok(ambiguous.sourceIssues?.includes('ambiguous-nursery-recipe-identities'));
  assert.deepEqual(sanitiseNurserySettings(JSON.parse(JSON.stringify(ambiguous))), ambiguous);
});

test('nursery settings round-trip in the existing account store and do not change old saved plans', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    sessionStorage: { getItem: () => null }, dispatchEvent: () => true,
  } });
  bindMountedAccountLocalStorageUid('nursery-owner');
  try {
    assert.equal(saveCropPlan({ version: 1, plantings: [], nursery: settings, updatedAt: 1 }), true);
    assert.deepEqual(loadCropPlan().nursery, settings);
    bindMountedAccountLocalStorageUid('other-account');
    assert.equal(loadCropPlan().nursery, undefined);
    bindMountedAccountLocalStorageUid('nursery-owner');
    assert.deepEqual(loadCropPlan().nursery, settings);
    assert.equal(saveCropPlan({ version: 1, plantings: [], updatedAt: 2 }), true);
    assert.equal(loadCropPlan().nursery, undefined);
  } finally {
    bindMountedAccountLocalStorageUid(null);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
