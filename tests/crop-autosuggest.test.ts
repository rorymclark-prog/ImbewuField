// Winter coverage regression — the "beds 5-9 rest all May-Aug" hole. Root causes fixed on
// 2026-08-04: backfillWinterGaps refused to commit any sowing >5 months out (a guaranteed no-op
// run Jun-Sep), and fillRemainingGaps spent the shoulder months on quick crops before winter was
// attempted, foreclosing the only long bridgers. The engine is deterministic, so these are exact.
import test from 'node:test';
import assert from 'node:assert/strict';

import { autoSuggestPlan, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { occupiedMonthsForPlanting, type PlanBed } from '../lib/crop-plan.ts';

const NINE_BEDS: PlanBed[] = Array.from({ length: 9 }, (_, i) => ({
  id: `bed-${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3,
}));

const FAMILY: AutoSuggestAnswers = {
  goal: 'family',
  householdSize: 'medium',
  groups: ['staple_grain', 'legume', 'leafy_green', 'root_tuber', 'allium_aromatic', 'fruiting_veg'],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
} as AutoSuggestAnswers;

test('an August plan under mild-frost covers winter on every bed — Ubhejane’s exact shape', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const bed of NINE_BEDS) {
    const months = new Set(
      res.plantings
        .filter((p) => p.bedId === bed.id)
        .flatMap((p) => occupiedMonthsForPlanting(p)),
    );
    // Jun and Jul were the permanent hole. The catalogue genuinely covers them under
    // mild-frost (chard, kale, peas, broccoli, garlic…), so an empty winter now means the
    // engine regressed, not the season.
    assert.ok(months.has(6), `${bed.label} has nothing growing in June`);
    assert.ok(months.has(7), `${bed.label} has nothing growing in July`);
  }
});

test('the winter bridger commits far-out sowings instead of narrating a rest it could fix', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const note of res.notes) {
    assert.doesNotMatch(note, /too far out to plant now/, 'the dropped-bridge note was removed with the gate');
    // A "rests over winter" claim while the same result plants that very stretch was the
    // self-contradiction class — reportStillRestingBeds, computed against FINAL occupancy,
    // is the only voice allowed to say "rests", and after the fixes it should have no
    // winter rest to report under this profile.
    assert.doesNotMatch(note, /rests? (all|over|in) .*(Jun|Jul)/i, `contradictory or stale rest note: "${note}"`);
  }
});
