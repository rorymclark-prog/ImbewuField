# Autonomous work queue — design side, 2026-08-01

For a Codex CLI run. Work the items **in order**. Each is independently verifiable, each ends with
a local commit. Stop and report if an item turns out to be wrong or bigger than described — a
skipped item honestly reported is worth more than a guessed one.

## Ownership — do not collide

Another agent is working on legend typography. **Do not edit** `lib/sheet-legend-layout.ts`,
`components/design/DesignGlossy.tsx`, or `tests/sheet-legend-layout.test.ts` while working this
queue. Anything below that would need `DesignGlossy.tsx` says so explicitly and is **deferred** —
leave it, note it, move on.

## Standing rules for every item

- `npx tsc --noEmit` and `npm test` must both pass before each commit. 1501 tests pass today.
- Never run `git add -A` or `git add .` — stage explicit paths only. Agents share this checkout.
- Never modify `PLAN_VERSION`. Never change a price, a coefficient, a spacing or any agronomic
  figure. Never invent a number that reads as a recommendation.
- Never touch secrets, `.env*`, `serviceAccount.json`, or Firestore/storage rules.
- Verify with the FREE exact render path only. Never trigger a paid AI render.
- Do not push. Commit locally on `main`; the owner reviews.
- Dev server already runs on port 4343 — do not start another. Sample farm:
  `sessionStorage.imbewu_sample_mode = '1'`, then `/design?lat=-27.72623&lon=31.96304`.

---

## 1. Audit the substep catalog after the Earthworks split *(lib/design-substeps.ts)*

Earthworks became its own wizard step today. Read `STEP_SUBSTEPS` end to end and check every step's
checklist still describes what that step now does.

Known: the swale task appears on **both** Water and Earthworks, deliberately (both read the same
saved state, so doing it in either ticks both). Confirm that is still true in the code and that no
`done` predicate can be satisfied by something the step cannot draw. Report anything that reads as
stale rather than silently rewriting instructional copy.

**Acceptance:** a written finding per step; code changes only where a predicate is provably wrong.

## 2. Does the phasing engine know about the new step? *(lib/phasing.ts)*

`PHASE_ORDER` has an `earthworks` phase and `ITEM_PHASE` maps items to it. Verify every
`category: 'earthworks'` element in `lib/design-elements.ts` lands in a sensible phase, and that
nothing added recently (`half_moon`, `berm`, `terrace`) falls through to a default. Add tests for
any element with no explicit mapping.

**Acceptance:** a test asserting every earthworks-category element has an intentional phase.

## 3. Price-book coverage audit *(lib/price-book.ts — REPORT ONLY, do not add prices)*

List every catalog element with no price-book entry. **Do not invent prices** — a plan area nobody
measured is deliberately left unpriced rather than printed as free. Deliverable is a list in
`docs/` plus, if the code silently prices an unpriced item at zero anywhere, a failing-test-first
fix for that specific bug.

## 4. i18n key coverage *(lib/i18n.tsx, lib/design-studio-i18n.ts, docs/i18n-needs-translation.md)*

`tests/design-studio-i18n.test.ts` enforces that every wired Design Studio key has pending English
text and appears in the translation handoff. Sweep for keys that are *used in components* but never
went through `DESIGN_STUDIO_I18N_KEYS`, and for handoff entries whose key no longer exists.

**Acceptance:** the sweep result, plus any missing key wired up.

## 5. Advisor rules for the Earthworks step *(lib/design-rules.ts)*

The advisor (Lima) has per-step rules. It now has a step it has never seen. Check what it says on
Earthworks and whether any existing rule is misfiled under Water. Add rules ONLY where the rule is
a geometric or logical fact (e.g. "a berm drawn uphill of its swale is backwards"), never an
agronomic recommendation with numbers.

## 6. Ownership/visibility agreement sweep *(lib/glossy-filters.ts, lib/design-canvas.ts)*

Two systems answer "whose shape is this": `ownedByCurrentStep` (which step may edit it) and
`groundFeatureLayer` (which Layers switch shows it). A test already pins their agreement for ground
features. Extend that agreement check to **items and lines** — for each, the step that owns it must
be the step whose layer focus switches its layer ON (see `applyStepFocus` in `app/design/page.tsx`).
Any disagreement is the place-then-vanish bug class: created, saved, invisible.

**Acceptance:** a test covering items and lines; report (do not silently fix) any disagreement that
looks deliberate.

## 7. Canvas rail accessibility pass *(components/design/DesignCanvas.tsx)*

Five buttons now stack in the top-left rail (base map, sector, multi-select, ruler, drone photo).
Check: every one has `aria-label` AND `title`; `aria-pressed` on the toggles; the stacking offsets
do not overlap at any combination of visible buttons (the ruler's `top` already varies); nothing
falls off a 360px-wide viewport. Fix what is broken.

**Acceptance:** verified at mobile width in the browser, with a screenshot.

## 8. Zone badge drag affordance *(components/design/DesignCanvas.tsx)*

Zone number badges are draggable (`startDragLabel`) but nothing says so. The sheet now honours the
drag. Add the same affordance the ground labels have — cursor, and a leader line back to the ring
once moved — for plain zone badges specifically. Verify a dragged badge persists and re-renders in
the same place.

## 9. Dead code sweep *(repo-wide, report first)*

`buildBlueprintZoneMap` / `WaterMap` / `PlantingMap` / `StructuresMap` / `WholeMap` became thin
unused wrappers today when the exact render started passing the filter straight through. Find every
export with no remaining importer. **Report the list first**; only delete after the owner confirms —
some are kept deliberately as one-function rollbacks and say so in their comments.

## 10. Test-coverage gaps in `lib/` *(tests/)*

Find pure modules in `lib/` with no test file at all. Rank by blast radius (how many callers).
Write tests for the top three. Do not chase coverage percentages — write tests that would have
caught a real bug.

---

## Deferred — needs `DesignGlossy.tsx`, owned by the other agent

- **Repetitive auto-generated map labels.** A Planting sheet printed `SOUTH-EASTERN PAWPAW TREE` /
  `SOUTH-WESTERN PAWPAW TREE` / `SOUTH-CENTRAL PAWPAW TREE` down one side. Grouping to `PAWPAW ×3`
  is proposed but **not yet decided by the owner** — do not build it unprompted.
- **The legend panel clips long rows** (`Zone 1 — Daily gard…`). Wrapping exists; something
  measures against the wrong width.
- **Leader lines have no whole-sheet layout pass.** The current length cap treats the symptom.
- **The earthworks catalog gaps** in `docs/EARTHWORKS-AUDIT-2026-08-01.md` — diversion drain,
  level platform, spillway, check dam. These touch four AI prompt tables inside `DesignGlossy.tsx`
  and `lib/producer-prompt.ts`; start them only once the legend work has landed.
