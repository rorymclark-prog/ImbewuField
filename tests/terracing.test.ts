import test from 'node:test';
import assert from 'node:assert/strict';

import { recommendTerraceMethod, effectiveSlopeForRing, TERRACE_METHOD_TABLE } from '../lib/terracing.ts';

// Worked examples from docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §1 ("Worked examples (unit-test shape)").

test('recommendTerraceMethod(1.5) → row 1: contour_planting, engineerFlag no', () => {
  const row = recommendTerraceMethod(1.5);
  assert.equal(row.method, 'contour_planting');
  assert.equal(row.engineerFlag, 'no');
});

test('recommendTerraceMethod(4.0) → row 2: contour_cover, engineerFlag no', () => {
  const row = recommendTerraceMethod(4.0);
  assert.equal(row.method, 'contour_cover');
  assert.equal(row.engineerFlag, 'no');
});

test('recommendTerraceMethod(7.5) → row 3: vetiver_hedge, engineerFlag ask_local_expert', () => {
  const row = recommendTerraceMethod(7.5);
  assert.equal(row.method, 'vetiver_hedge');
  assert.equal(row.engineerFlag, 'ask_local_expert');
});

test('recommendTerraceMethod(15.0) → row 4: contour_bank, engineerFlag ask_local_expert', () => {
  const row = recommendTerraceMethod(15.0);
  assert.equal(row.method, 'contour_bank');
  assert.equal(row.engineerFlag, 'ask_local_expert');
});

test('recommendTerraceMethod(25.0) → row 5: bench_terrace_retained, engineerFlag ask_local_expert', () => {
  const row = recommendTerraceMethod(25.0);
  assert.equal(row.method, 'bench_terrace_retained');
  assert.equal(row.engineerFlag, 'ask_local_expert');
});

test('recommendTerraceMethod(40.0) → row 6: no_dig_engineer_required, engineerFlag always', () => {
  const row = recommendTerraceMethod(40.0);
  assert.equal(row.method, 'no_dig_engineer_required');
  assert.equal(row.engineerFlag, 'always');
});

test('recommendTerraceMethod(10.0) → boundary case, inclusive-low: row 4 (10-20% band), not row 3', () => {
  const row = recommendTerraceMethod(10.0);
  assert.equal(row.method, 'contour_bank');
});

test('recommendTerraceMethod(-2.0) → clamps to row 1 (defensive; a farmer typo or bad sign should not 500)', () => {
  const row = recommendTerraceMethod(-2.0);
  assert.equal(row.method, 'contour_planting');
});

test('recommendTerraceMethod(33.0) → boundary case, inclusive-low on row 6: exactly 33% is already "always"', () => {
  const row = recommendTerraceMethod(33.0);
  assert.equal(row.method, 'no_dig_engineer_required');
  assert.equal(row.engineerFlag, 'always');
});

test('recommendTerraceMethod(150) → far beyond 100%, still row 6, never throws', () => {
  const row = recommendTerraceMethod(150);
  assert.equal(row.method, 'no_dig_engineer_required');
});

test('EngineerFlag never regresses to a value weaker than ask_local_expert above row 2 — no "maybe" survives', () => {
  for (const row of TERRACE_METHOD_TABLE) {
    assert.notEqual(row.engineerFlag as string, 'maybe');
  }
  // Rows 3-5 (index 2-4) must be ask_local_expert or stronger; only rows 1-2 may be 'no'.
  TERRACE_METHOD_TABLE.slice(2, 5).forEach((row) => {
    assert.notEqual(row.engineerFlag, 'no');
  });
});

test('TERRACE_METHOD_TABLE has exactly 6 rows and covers [0, ∞) with no gaps', () => {
  assert.equal(TERRACE_METHOD_TABLE.length, 6);
  assert.equal(TERRACE_METHOD_TABLE[0].minPct, 0);
  assert.equal(TERRACE_METHOD_TABLE[TERRACE_METHOD_TABLE.length - 1].maxPct, null);
  for (let i = 1; i < TERRACE_METHOD_TABLE.length; i++) {
    assert.equal(TERRACE_METHOD_TABLE[i].minPct, TERRACE_METHOD_TABLE[i - 1].maxPct);
  }
});

// effectiveSlopeForRing (§3) — the three-way fallback: measured > whole-site average > null.

test('effectiveSlopeForRing prefers the farmer-measured slope over the whole-site average', () => {
  const eff = effectiveSlopeForRing(
    { measuredSlopePct: 22 },
    { elevation: { slopeDeg: 5, slopePct: 9, aspectDeg: 0, aspectLabel: 'N' } },
  );
  assert.deepEqual(eff, { pct: 22, source: 'measured' });
});

test('effectiveSlopeForRing falls back to the whole-site average when no measured value exists', () => {
  const eff = effectiveSlopeForRing(
    { measuredSlopePct: undefined },
    { elevation: { slopeDeg: 5, slopePct: 9, aspectDeg: 0, aspectLabel: 'N' } },
  );
  assert.deepEqual(eff, { pct: 9, source: 'whole-site-average' });
});

test('effectiveSlopeForRing returns null when neither a measured value nor a site average exists', () => {
  assert.equal(effectiveSlopeForRing({ measuredSlopePct: undefined }, null), null);
  assert.equal(effectiveSlopeForRing({ measuredSlopePct: undefined }, undefined), null);
  assert.equal(effectiveSlopeForRing({ measuredSlopePct: undefined }, { elevation: undefined }), null);
});
