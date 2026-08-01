# Work queue progress — 2026-08-01

Baseline: checkout writable; branch `main`; 1503 tests passing. Existing unrelated working-tree edits preserved. Git remote checks, fetches, pushes, staging, and commits are intentionally skipped per run instructions.

## Item 1 — done (audit/report; no code change)

- `base`: boundary and house use the traced reference context or the matching ground-feature rings; paving and existing-ground tasks use the Base area tools. All completion predicates match drawable Base state.
- `sector`: all three tasks are deliberate acknowledgement tasks with `done: () => true`; the step draws the sector analysis rather than user geometry, so none can be falsely satisfied by an unrelated shape.
- `water`: tanks, taps, swales, drip/pipe, and optional storage each match a Water tool or shared saved geometry. The swale task is intentionally duplicated by Earthworks and reads the same `swale` line state.
- `earthworks`: swale, berm, terrace/terrace-bank, and half-moon match the new Earthworks tools/state. The duplicated swale predicate is intentional and correct.
- `zones`: zone 1, zone 2, zone 3, and optional zone 4/5 use the zone painter; accepting either 4 or 5 for the combined task matches the label.
- `planting`: tree, bed, and optional support tasks accept the live planting catalog choices (including shared/legacy tree and bed ids).
- `structures`: compost, optional animal housing, optional storage, and optional extras accept the corresponding structure/animal catalog choices.

No stale checklist or provably false `done` predicate was found; `lib/design-substeps.ts` was left unchanged.

## Item 2 — done

`lib/phasing.ts` already routes the `earthworks` category to the Earthworks phase, with deliberate
bed-phase overrides for `raised_bed`, `keyhole_bed`, `herb_spiral`, and `banana_circle`. The newer
`tree_basin`, `greywater_basin`, `infiltration_basin`, `half_moon`, `berm`, and `terrace` entries
resolve to Earthworks; no element fell through to an unassigned phase. Added a focused test in
`tests/phasing.test.ts` that checks every current earthworks catalog entry and its intended phase.

Verification: `npx tsc --noEmit` passed; `npm test` passed 1504 tests. No production logic changed.

## Item 3 — done (report-only)

Created [`docs/PRICE-BOOK-COVERAGE-2026-08-01.md`](PRICE-BOOK-COVERAGE-2026-08-01.md) with the
full list of 69 catalog ids that have no direct `costForItem(def.id, ...)` price-book entry,
grouped by category. This includes direct Design Studio ids even where the older facilitator
price book has an alias such as `tank`, `tree`, `bed`, or `pond`.

The unknown-key functions return `null`; the BOQ renders an em dash for an unpriced row. The
FacilitatorCanvas total omits null costs rather than displaying them as `R0`, so no failing-test-
first fix was warranted. No prices or price-book code were changed.

## Item 4 — done

The component/source/handoff sweep found four wired component keys that existed in `lib/i18n.tsx`
but were missing from `DESIGN_STUDIO_I18N_KEYS` and the translation handoff:
`designCanvasShowPhoto`, `designCanvasShowSatellite`, `designCanvasPhotoShown`, and
`designCanvasPhotoHidden`. Added them to `DESIGN_STUDIO_REST_KEYS` in `lib/design-studio-i18n.ts`
and to `docs/i18n-needs-translation.md`. No stale handoff keys were found.

Verification: `npx tsc --noEmit` passed; `npm test` passed 1504 tests.

## Item 5 — done

Lima had no `earthworks` advice layer, so terrace/berm safety advice was tagged `zones` and was
not the focused advice on the new Earthworks step. Moved both the known-slope and unknown-slope
terrace tips to a new `earthworks` layer, taught `DesignAdvisor` to focus that layer, and used
the existing translated `designStepEarthworks` label. The Banana Circle feed rule remains under
Water because it checks for a nearby greywater basin or pipe; that classification is deliberate
and is now asserted in the test.

No new agronomic recommendation or number was added. Verification: `npx tsc --noEmit` passed;
`npm test` passed 1504 tests.

## Item 6 — done

Extended `tests/glossy-filters.test.ts` so every catalog item and every line kind is checked against
its `ownedByCurrentStep` owner and the corresponding layer focus used by `applyStepFocus`. The
test includes the Earthworks layer, `bedpath`, Banana Circle's extra Planting offer, and the
shared Water/Earthworks focus behavior for swales. No ownership disagreement was found: Water
keeps Earthworks visible for its shared palette, while Earthworks remains the swale's editable
owner. No production ownership or visibility code changed.

Verification: `npx tsc --noEmit` passed; `npm test` passed 1505 tests.

## Item 7 — partially done (visual verification blocked)

In `components/design/DesignCanvas.tsx`, the five top-left rail controls already had both
`aria-label` and `title`, and the conditional offsets are non-overlapping: Base 12, Sector 60,
Multi-select 108, Ruler 108/156, and Drone Photo 156/204. Added the missing
`aria-pressed={!!activeLayers.baseMap}` to the Base-map toggle; the other four toggles already had
it.

`npx tsc --noEmit` and `npm test` pass (1505). I deliberately did not start a server. Browser
verification and the requested 360px screenshot remain unverified because no browser instance was
available and the supplied port 4343 was not accepting connections; no visual fix is claimed.

## Item 8 — skipped as already satisfied (browser verification blocked)

The current `DesignCanvas.tsx` already has the requested plain-zone behavior: the transparent
badge hit group calls `startDragLabel`, uses a move cursor when interactive, stores `labelDx`/
`labelDy` in `endDragLabel`, and renders a dashed leader from the moved label to the nearest ring
edge. The late painted badge is explicitly `pointerEvents="none"`, leaving the underlying drag
hit group reachable. This is already present in the checkout, so I made no duplicate change.

I could not perform the requested live drag/persistence/re-render check because the browser and
port 4343 were unavailable. Source inspection confirms persistence is through `onChange` and the
same offsets are read on the next render. No visual claim is made.

## Item 9 — report-first (no code deletion)

Wrote `docs/DEAD-CODE-SWEEP-2026-08-01.md`. The five named print-map wrappers are still live:
`buildBlueprintZoneMap`, `buildBlueprintWaterMap`, `buildBlueprintEarthworksMap`,
`buildBlueprintPlantingMap`, and `buildBlueprintStructuresMap` are imported and called by
`components/design/DesignPrint.tsx`. The uncalled exports found were
`buildBlueprintZoneMapLegacy`, `buildBlueprintWaterMapLegacy`, `buildBlueprintWaterMapLegacyExact`,
`buildBlueprintPlantingMapLegacy`, `buildBlueprintStructuresMapLegacy`, and
`buildBlueprintWholeMap`. I left them in place because the legacy functions have nearby rollback /
visual-comparison context and the queue requires owner confirmation before deletion; the report
also flags that `buildBlueprintWholeMap` is the only thin wrapper with no live caller.

`npx tsc --noEmit` and `npm test` pass (1505). No production source was changed for this
report-first item.

## Item 10 — done

Ranked pure `lib/` modules by direct caller count while excluding modules with a same-named test
file. The top three were `design-elements.ts` (23 callers), `sector.ts` (11 callers), and
`design-beds-bridge.ts` (7 callers). Added five focused regression tests in existing registered
test files: catalog-index/footprint invariants in `tests/biome.test.ts`, compass parsing and
screen-vector orientation in `tests/sector-cartography.test.ts`, and crop-planner/tree bridge
ordering, filtering, grouping, fallback labels and size overrides in `tests/design-substeps.test.ts`.
I kept the npm test manifest unchanged by extending registered files rather than creating new
test files.

`npx tsc --noEmit` and `npm test` pass (1510). No agronomic figures or production geometry were
changed.
