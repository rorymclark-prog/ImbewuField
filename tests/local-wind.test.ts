import test from 'node:test';
import assert from 'node:assert/strict';

import {
  effectivePrevailingWind,
  effectiveFireWind,
  regionalPrevailingPick,
  isCompassDirection16,
  COMPASS16_ORDER,
  type LocalWindObservation,
} from '../lib/local-wind.ts';
import { migrateStateToFrame, type DesignCanvasState, type CanvasFrame } from '../lib/design-canvas.ts';

const REGIONAL_NE = { fromLabel: 'NE', bearingDeg: 45 };
const REGIONAL_FIRE_NW = { fromLabel: 'NW', bearingDeg: 315 };

// ── effectivePrevailingWind: observation overrides regional ──────────────────────────────────

test('effectivePrevailingWind: farmer observation overrides the regional figure', () => {
  const observed = effectivePrevailingWind({ prevailingFrom: 'SW' }, REGIONAL_NE);
  assert.deepEqual(observed, { fromLabel: 'SW', bearingDeg: 225, provenance: 'observed on site' });
});

test('effectivePrevailingWind: absent observation falls back to regional, labelled "regional estimate"', () => {
  const fallback = effectivePrevailingWind(null, REGIONAL_NE);
  assert.deepEqual(fallback, { fromLabel: 'NE', bearingDeg: 45, provenance: 'regional estimate' });
  // undefined observation behaves identically to null — both mean "nothing recorded".
  assert.deepEqual(effectivePrevailingWind(undefined, REGIONAL_NE), fallback);
});

test('effectivePrevailingWind: neither observation nor regional → null, never an invented bearing', () => {
  assert.equal(effectivePrevailingWind(null, null), null);
  assert.equal(effectivePrevailingWind(undefined, undefined), null);
});

test('effectivePrevailingWind: observation wins even when there is no regional figure to override', () => {
  const observed = effectivePrevailingWind({ prevailingFrom: 'E' }, null);
  assert.deepEqual(observed, { fromLabel: 'E', bearingDeg: 90, provenance: 'observed on site' });
});

// ── effectiveFireWind: strongestFrom overrides, prevailingFrom is NEVER a silent fallback ────

test('effectiveFireWind: farmer strongest/damaging-wind observation overrides the regional fire figure', () => {
  const observed = effectiveFireWind({ strongestFrom: 'SE' }, REGIONAL_FIRE_NW);
  assert.deepEqual(observed, { fromLabel: 'SE', bearingDeg: 135, provenance: 'observed on site' });
});

test('effectiveFireWind: absent strongestFrom falls back to regional, even with a prevailingFrom on file', () => {
  // The critical "never mislabelled" case: a farmer who confirmed only their everyday wind has
  // NOT told the app anything about their worst wind — this must never silently borrow
  // prevailingFrom and report it as 'observed on site' for the fire question.
  const observation: LocalWindObservation = { prevailingFrom: 'SW', recordedAt: '2026-07-20T10:00:00.000Z' };
  const fire = effectiveFireWind(observation, REGIONAL_FIRE_NW);
  assert.deepEqual(fire, { fromLabel: 'NW', bearingDeg: 315, provenance: 'regional estimate' });
});

test('effectiveFireWind: no strongestFrom and no regional fire → null', () => {
  assert.equal(effectiveFireWind({}, null), null);
  assert.equal(effectiveFireWind(null, null), null);
});

// ── Provenance is never mislabelled, across the full 16-point table ──────────────────────────

test('provenance is never mislabelled: every 16-point direction resolves to its exact bearing when observed', () => {
  for (let i = 0; i < COMPASS16_ORDER.length; i++) {
    const dir = COMPASS16_ORDER[i];
    const result = effectivePrevailingWind({ prevailingFrom: dir }, REGIONAL_NE);
    assert.equal(result?.provenance, 'observed on site', `${dir} must be labelled observed, not regional`);
    assert.equal(result?.fromLabel, dir);
    assert.equal(result?.bearingDeg, i * 22.5, `${dir} must resolve to its exact 22.5°-step bearing`);
  }
});

test('provenance is never mislabelled: a regional-only result is always "regional estimate", never "observed"', () => {
  const result = effectivePrevailingWind(null, REGIONAL_NE);
  assert.equal(result?.provenance, 'regional estimate');
  assert.notEqual(result?.provenance, 'observed on site');
});

// ── isCompassDirection16 ───────────────────────────────────────────────────────────────────

test('isCompassDirection16 accepts exactly the 16 canonical points', () => {
  for (const dir of COMPASS16_ORDER) assert.equal(isCompassDirection16(dir), true);
});

test('isCompassDirection16 rejects degrees, lowercase, and unrelated strings', () => {
  assert.equal(isCompassDirection16('237'), false);
  assert.equal(isCompassDirection16('sw'), false); // regional fromLabel values are always uppercase already
  assert.equal(isCompassDirection16('North'), false);
  assert.equal(isCompassDirection16(''), false);
});

// ── regionalPrevailingPick ─────────────────────────────────────────────────────────────────

test('regionalPrevailingPick prefers summer_cooling over the episodic/fire wind, regardless of table order', () => {
  const table = [
    { id: 'berg', fromLabel: 'NW', bearingDeg: 315 },
    { id: 'cold_front', fromLabel: 'SW', bearingDeg: 225 },
    { id: 'summer_cooling', fromLabel: 'NE', bearingDeg: 45 },
  ];
  assert.deepEqual(regionalPrevailingPick(table), { fromLabel: 'NE', bearingDeg: 45 });
});

test('regionalPrevailingPick falls back to the first entry when summer_cooling is absent', () => {
  const table = [{ id: 'cold_front', fromLabel: 'SW', bearingDeg: 225 }];
  assert.deepEqual(regionalPrevailingPick(table), { fromLabel: 'SW', bearingDeg: 225 });
});

test('regionalPrevailingPick returns null for an empty table — no regional figure to invent one from', () => {
  assert.equal(regionalPrevailingPick([]), null);
});

// ── Round-trip through save/load (JSON, the actual on-disk/localStorage encoding) ────────────

test('LocalWindObservation round-trips every 16-point direction through JSON save/load unchanged', () => {
  for (const dir of COMPASS16_ORDER) {
    const observation: LocalWindObservation = { prevailingFrom: dir, strongestFrom: dir, recordedAt: '2026-07-20T10:00:00.000Z' };
    const roundTripped = JSON.parse(JSON.stringify(observation)) as LocalWindObservation;
    assert.deepEqual(roundTripped, observation);
  }
});

test('LocalWindObservation without strongestFrom round-trips as absent, not as an explicit null/undefined key', () => {
  const observation: LocalWindObservation = { prevailingFrom: 'N', recordedAt: '2026-07-20T10:00:00.000Z' };
  const roundTripped = JSON.parse(JSON.stringify(observation)) as LocalWindObservation;
  assert.deepEqual(roundTripped, observation);
  assert.equal('strongestFrom' in roundTripped, false);
});

// ── DesignCanvasState.localWind survives migrateStateToFrame untouched (mirrors measuredSlopePct) ─

function baseFrame(overrides: Partial<Omit<CanvasFrame, 'satDataUrl'>> = {}): Omit<CanvasFrame, 'satDataUrl'> {
  return { centerLng: 30.98, centerLat: -29.783, zoom: 14, imgW: 960, imgH: 640, mPerPx: 5, ...overrides };
}

function baseState(overrides: Partial<DesignCanvasState> = {}): DesignCanvasState {
  return {
    siteId: 'test-site',
    frame: baseFrame(),
    items: [],
    zones: [],
    lines: [],
    step: 'sector',
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  };
}

test('migrateStateToFrame carries localWind through untouched when the frame actually changes', () => {
  const localWind: LocalWindObservation = { prevailingFrom: 'SW', strongestFrom: 'NW', recordedAt: '2026-07-20T10:00:00.000Z' };
  const state = baseState({ localWind });
  const migrated = migrateStateToFrame(state, baseFrame({ zoom: 15 }), () => [0.5, 0.5]);
  assert.notEqual(migrated, state); // confirms the real (non-"same frame") migration path ran
  assert.deepEqual(migrated.localWind, localWind);
});

test('migrateStateToFrame is a no-op (same object) when the frame is unchanged, and localWind still reads back', () => {
  const localWind: LocalWindObservation = { prevailingFrom: 'E', recordedAt: '2026-07-20T10:00:00.000Z' };
  const state = baseState({ localWind });
  const migrated = migrateStateToFrame(state, baseFrame(), () => [0.5, 0.5]);
  assert.equal(migrated, state);
  assert.deepEqual(migrated.localWind, localWind);
});

// ── A legacy state with no localWind field at all loads unchanged ────────────────────────────

test('a legacy state with no localWind field migrates cleanly with localWind reading as undefined', () => {
  const legacy = baseState(); // no localWind key at all, exactly like a pre-this-feature saved design
  assert.equal('localWind' in legacy, false);
  const migrated = migrateStateToFrame(legacy, baseFrame({ zoom: 15 }), () => [0.5, 0.5]);
  assert.equal(migrated.localWind, undefined);
  // And a plain JSON round-trip (the real persistence path) doesn't fabricate the key either.
  const roundTripped = JSON.parse(JSON.stringify(legacy)) as DesignCanvasState;
  assert.equal(roundTripped.localWind, undefined);
});
