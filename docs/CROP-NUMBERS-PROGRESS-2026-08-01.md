# Crop numbers progress — 2026-08-01

## Scope and sandbox

- Working tree is `main`; network and Git metadata writes are unavailable by instruction.
- No `git fetch`, `git ls-remote`, `git pull`, `git push`, install, browser, or render was run.
- Existing untracked files `.playwright-cli/console-2026-08-01T07-09-34-923Z.log` and
  `docs/EXACT-SHEET-SWEEP-2026-08-01.md` were left untouched.

## Initial audit

- The confirmed single-figure plant-density bug is `lib/crop-plan.ts` in
  `seedBoqForPlan`: it used `spacingCm²` even when both sourced rectangular fields were present.
- Repository audit found no other unambiguous plant-density calculation. Other `spacingCm` uses
  are display text, catalogue validation, or the space-hungry heuristic. Other `** 2` and
  `Math.pow` uses are geometry, map scale, distance, or test arithmetic.
- The requested occupancy consolidation is not behavior-preserving as written. The current
  auto-suggest `Occupancy`, picker `bedOverlapFraction`, and `isGenuinelyIntercropped` checks
  use sow month through maturity; the requested helper includes the post-maturity
  `harvestWindowMonths` tail. Applying it would alter successor placement and overlap warnings
  for repeat-harvest crops. I will not make that unreviewed farmer-facing behavior change.
- `seedBoqForPlan` does not compute bed occupancy or reject/suppress overlapping plantings; it
  computes material for each non-existing planting from its bed fraction. That is a different
  question, so it is reported rather than guessed into the occupancy refactor.

## Catalog invariant check

- Cabbage is `rowSpacingCm: 65` and `inRowSpacingCm: 60` in the checked-in catalog. Therefore
  the requested invariant `inRowSpacingCm <= rowSpacingCm` is true (`60 <= 65`); the supplied
  claim that cabbage is `60cm > 65cm` is not borne out by the repository. The guard test names
  every violating crop if one appears, but it correctly passes for the current data. The owner
  should still check the 65cm/60cm interpretation against Starke Ayres Cabbage Production
  Guideline 2019 §3.4 before changing either sourced figure.

## Verification

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 1,546 tests, 0 failures. The checkout's actual baseline was not the
  prompt's stated 1,542; no deliberate cabbage failure exists because the verified invariant is
  satisfied.
- `git diff --check`: passed.
- The helper replacement in `buildFieldUtilizationByMonth` was compared against its former
  month sequence for every catalog crop and all 12 sow months: 0 differences.
- No browser or rendered BOQ card was available, so the BOQ presentation remains unverified.

## Density check (8 m² bed, one planting, existing buffer/transplant rules unchanged)

Before → after counts from the current catalogue:

- green beans: 920 → 256
- maize: 102 → 51
- coriander: 920 → 131
- cabbage: 40 → 21
- tomatoes: 32 → 22
- groundnuts: 230 → 170
- Swiss chard: 102 → 163
- butternut: 9 → 15
