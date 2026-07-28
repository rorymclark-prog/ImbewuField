# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

**How to work this queue.** Take the top unstarted item. One branch per item, named in the item.
Never push to `main`. When it is pushed, say so and **carry straight on to the next item** — do not
wait for a review. Claude reviews and merges behind you. If a later item touches the same file as
one still unmerged, branch from the unmerged branch and say so in the report.

Every item below was verified to be real before it was written down — the numbers are measured, not
estimated. If you find one is already fixed or the premise is wrong, **say so and skip it**; that is
a useful result, not a failure.

**Two rules that have each cost a day:**

- **Bump `PLAN_VERSION`** (`components/design/DesignGlossy.tsx`, currently `v62`) in the same commit
  as *any* change to how a sheet is drawn, or nobody who has already rendered sees your fix.
- **A test that pins today's constant cannot fail when the constant is wrong.** Assert the *rule*,
  not the *number*.

---

## Done — the previous run, all nine merged

`callout-type-scale`, `phase-chip-clearance`, `label-collision-audit`, `gate-break-verify`,
`phasing-tests`, `crop-plan-tests`, `price-book-tests`, `polygon-polish`, `design-studio-i18n`, plus
`phasing-column` before them. Merged as `ecc8742`. Two branches had both bumped `PLAN_VERSION` to
`v61`, so the merge moved it to `v62`.

The one worth knowing about: **crop rotation was only ever a preference.** The fallback pass would
put the same food group back in the same bed next season, which is the single thing the rotation
toggle exists to prevent. `BedRotation.repeats()` now makes an immediate repeat a hard block. That
is what these items are for — the test found a real bug and you reported it instead of loosening
the test.

---

## 1. A missing area is now priced at R0 instead of "we don't know" — `codex/unpriced-not-free`

Introduced by `codex/price-book-tests`, so this is a follow-up to your own change, not a criticism
of it — the item you were given explicitly asked for "a quantity of zero produces a line of zero,
not a missing line", and you did that correctly.

`lib/price-book.ts`, `costForAreaLine`, changed `if (!key || areaM2 <= 0) return null;` to
`areaM2 < 0`. Right for a genuine zero. The problem is the caller:

`components/FacilitatorCanvas.tsx:2304`

```ts
...((AREA_LINE_KINDS.includes(l.kind) ? costForAreaLine(l.kind, l.areaM2 ?? 0) : costForLine(l.kind, l.m)) ?? { zar: null })
```

That `?? 0` conflates **"this shape has no area recorded"** with **"this shape has zero area"**.
Before your change both produced `null` → the BOQ showed the row as *unpriced*. Now the first case
produces `{ zar: 0 }` → the BOQ shows **R0**, i.e. free.

The rule your own item was written to protect: *an element with no price is surfaced as unpriced,
never silently priced at zero.* A BOQ that quietly says something is free is worse than one that
admits it does not know — a farmer budgets from that number.

Fix at the caller: only ask for a price when there is an area to price. Check
`app/facilitator/print/page.tsx:479` for the same shape. Add the test that distinguishes the two
cases — undefined area and zero area must not produce the same row.

---

## 2. Finish the Design Studio i18n sweep — `codex/design-studio-i18n-rest`

`codex/design-studio-i18n` proved the pattern on `StepGuide.tsx` and `DesignWizard.tsx` and it
merged clean. Eleven files to go:

`BasePhotoImport` · `DesignAdvisor` · `DesignCanvas` · `DesignGlossy` · `DesignPalette` ·
`DesignPrint` · `LessonLink` · `LessonPanel` · `SectorOverlay` · `SectorSummary` · `TankCalculator`

Same rules as last time and they matter more at this size:

- **English text in every language slot**, new keys listed in `docs/i18n-needs-translation.md`. Do
  not write isiZulu, Afrikaans or anything else you cannot have checked. Module 2's narration is
  already blocked waiting on an isiZulu-speaking agronomist for exactly this reason.
- **Do not touch text that is drawn onto a canvas sheet.** `DesignGlossy` and `DesignPrint` letter
  labels, legends and titles into the render, and those strings are load-bearing: the AI prompt
  quotes them back as "the exact spellings", `lib/producer-labels.ts` measures them for fitting, and
  `tests/sheet-typography.test.ts` checks them. UI chrome in those files only — buttons, step
  headings, helper copy, error messages. If you are unsure whether a string ends up on a sheet,
  leave it and list it in the report.
- **No plant species name changes anywhere.** NEMBA.

Split across two or three branches if it gets large; a reviewable diff beats one enormous one.

---

## 3. Does the legend agree with the map? — `codex/legend-map-agreement`

The prompt asserts it — rule 11 says *"Every row listed here also appears on the map"* — and
nothing measures it. This is the same class of failure as the paid-render gate: an instruction
nobody checks is a wish.

For the **exact** sheets this is fully checkable without spending a render, because the app draws
both the legend and the markers from the same saved state. Write the check that proves it:

- every legend row corresponds to at least one drawn element on that sheet;
- every drawn element type has a legend row on that sheet;
- the count in the legend row equals the number of markers drawn;
- an element filtered off this sheet is in neither.

Run it across all eight sheets and both demo fixtures. **If it fails, that is the result** — report
it rather than adjusting the check until it passes.

This does not cover the AI sheets, where the model draws the legend itself. Say so in the report
rather than implying wider coverage than you have.

---

## 4. Is a count welded to a name anywhere else? — `codex/prompt-data-audit`

Just fixed in `c1fe6fa`: `mapNames` handed the model `"VEGETABLE BED ×7"` while rule 10 told it to
"spell every label exactly as the element list gives it" and demonstrated `"2 × JOJO TANKS 5000L
EACH"`. A paid Water render came back with seven beds captioned `×1` … `×7`. The model was obeying
the prompt; the prompt contained three different grammars for one idea.

**Audit `lib/producer-prompt.ts` for the same shape** — anywhere an interpolated value carries both
a datum and a piece of grammar, and a later rule tells the model to reproduce that value verbatim.
Look at every `${...}` in every numbered rule and ask: *is this string data, an instruction, or
both?* Both is the bug.

Known candidates worth checking rather than assuming: the `(House)` / `(Lawn)` place suffixes on tap
names, `legendRows` (uses a third grammar, `Name (×N)`), the zone rows on the Zones sheet, and
`${title}` in rule 11.

Fix only what is genuinely ambiguous, and add a test per fix that fails against today's text. If a
candidate is fine, say why — that is a useful result and it stops the next agent re-auditing it.

---

## 5. `lib/design-suggest.ts` — 1 127 lines, no tests — `codex/design-suggest-tests`

**Zero test files import it.** It is the engine behind the design advice a farmer is shown, so a
wrong suggestion is not a cosmetic defect.

Pin what it promises, and pay attention to the guardrail this repo has learned the hard way: advice
may recommend and constrain, but it must never assert a figure or an agronomic instruction that has
no source. Specifically:

- A suggestion that names an element only fires when that element is actually in the design or is
  genuinely absent-and-needed — never because a code path defaulted.
- Nothing suggests a species (NEMBA again) that is not already in the corrected catalog.
- Slope, rainfall and biome thresholds behave at their boundaries, not just in the middle.
- The same state produces the same advice — no ordering or `Math.random` dependence.

---

## 6. `lib/water-system.ts` — 737 lines, no tests — `codex/water-system-tests`

**Zero test files import it.** Tank sizing and harvest maths reach both the Water sheet and the
report. The numbers a farmer plans a dry season around.

- Roof area × rainfall × runoff coefficient is dimensionally right, and the units are stated.
- A tank that cannot physically hold the harvest is not silently reported as sufficient.
- Zero roof, zero rainfall and a missing tank each behave sensibly rather than producing `NaN` or
  `Infinity` — and `NaN` never reaches a rendered string.
- Litres vs m³ are never mixed. (The course had a NASA POWER mm/day unit bug once already; the same
  class of error here would misplan a season's water.)

**Do not change a coefficient or a rainfall figure.** If one looks wrong, report it.

---

## Not for Codex

- **Course content** — `docs/narration/*`, `lib/course-*.ts`, slides, audio, animations. Claude's
  lane, and `tests/narration-scripts.test.ts` enforces some of it.
- **A real Full Treatment render.** Only Rory can spend a paid render. The `×N` label fix in
  `c1fe6fa` is a prompt change and is unconfirmed until he does.
- **Vegetables & Staples module 2.** Blocked on an isiZulu-speaking agronomist reviewing 22 coined
  terms — see `docs/narration/vegetables-staples.zu.md`. Not an engineering task.
- **Any change to a plant species name, a price, a coefficient or an agronomic figure.** Those have
  external sources behind them. Report, do not edit.
