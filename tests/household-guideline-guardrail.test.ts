import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { autoSuggestPlan, type AutoSuggestAnswers, type HouseholdSize } from '../lib/crop-autosuggest.ts';
import type { PlanBed } from '../lib/crop-plan.ts';

// docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md bans household headcount as a
// planting input: a headcount cannot prove how much of a crop a household
// wants, can manage, or will eat from the garden rather than the shops. The
// household-size box on the value panel is therefore DISPLAY-ONLY — it renders
// the SA dietary-guideline sentence (240 g veg/person/day ≈ 88 kg/person/year,
// what a household eats from ALL sources) and nothing else. This file is the
// guardrail: the planner must be provably blind to household size, and the
// page must never turn the guideline into a plan-coverage ratio.

const NINE_BEDS: PlanBed[] = Array.from({ length: 9 }, (_, i) => ({
  id: `bed-${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3,
}));

const BASE: AutoSuggestAnswers = {
  goal: 'family',
  groups: [],
  cropKeys: ['maize', 'dry-beans', 'swiss-chard', 'carrots', 'onions', 'cabbage', 'butternut', 'tomatoes'],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
  reliableIrrigation: true,
} as AutoSuggestAnswers;

test('planner output is byte-identical for every household size, including absurd ones', () => {
  const withoutHousehold = autoSuggestPlan({ ...BASE }, 'mild-frost', NINE_BEDS, [], 8);
  // A blank plan would make this test pass vacuously — insist it planned something.
  assert.ok(withoutHousehold.plantings.length > 0, 'guardrail needs a non-empty plan to be meaningful');
  const baseline = JSON.stringify(withoutHousehold);

  const variants: (HouseholdSize | undefined | unknown)[] = [
    undefined, 'small', 'medium', 'large',
    // Extremes: values the type forbids but a stored answer or bug could carry.
    0, 1, 4, 9999, -3, 'enormous', Number.NaN,
  ];
  for (const householdSize of variants) {
    const result = autoSuggestPlan(
      { ...BASE, householdSize: householdSize as HouseholdSize },
      'mild-frost', NINE_BEDS, [], 8,
    );
    assert.equal(
      JSON.stringify(result), baseline,
      `household size ${String(householdSize)} changed planner output — headcount is a banned planting input`,
    );
  }
});

test('the crops page keeps the household box display-only and never renders a coverage ratio', () => {
  const source = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

  // The display state must exist (so this guard cannot silently pass after a rename)…
  assert.ok(source.includes('householdSizeGuideline'), 'household guideline state missing or renamed — update this guard with it');

  // …and must never be handed to the planner, the persisted settings, or any generator path.
  assert.doesNotMatch(source, /autoSuggestPlan\([\s\S]{0,600}?householdSizeGuideline/, 'household size must not reach autoSuggestPlan');
  assert.doesNotMatch(source, /householdSizeGuideline[\s\S]{0,200}?autoSuggestPlan/, 'household size must not feed a planner call');
  assert.doesNotMatch(source, /(saveCashflowSettings|saveCropPlan|onCashflowSettingsChange)\([\s\S]{0,300}?householdSizeGuideline/, 'household size must not be persisted with plan or cashflow state');
  assert.doesNotMatch(source, /householdSize\s*:\s*householdSizeGuideline/, 'household size must not be forwarded as an answers field');

  // The wording is a guideline about eating from all sources, never a plan-coverage claim.
  assert.ok(source.includes('typically eats about'), 'guideline sentence missing');
  assert.ok(source.includes('240 g per person per day'), 'SA dietary-guideline basis missing');
  assert.ok(source.includes('A household of 4 ≈ 350 kg'), 'worked example missing');
  assert.ok(source.includes('not a planting target'), 'the not-a-planting-target disclaimer is required');
  assert.doesNotMatch(source, /meets\s+\d+\s*%/i, 'no "plan meets X%" coverage ratio may be rendered');
  assert.doesNotMatch(source, /%\s*of your (family|household)/i, 'no per-household coverage ratio may be rendered');

  // The deprecated HouseholdSize relic stays read-only: the page must not set it.
  assert.doesNotMatch(source, /householdSize\s*:\s*(?!undefined)[a-zA-Z_$]/, 'the page must not populate the deprecated householdSize answer');
});

test('no lib module references the display-only state', () => {
  for (const module of ['../lib/crop-autosuggest.ts', '../lib/crop-plan.ts', '../lib/crop-catalog.ts']) {
    const source = readFileSync(new URL(module, import.meta.url), 'utf8');
    assert.ok(!source.includes('householdSizeGuideline'), `${module} must not know the display-only household state exists`);
  }
});
