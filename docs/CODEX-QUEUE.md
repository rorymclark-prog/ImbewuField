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

## 0. NOBODY MEASURES THE FIRST PAID RENDER — `codex/measure-hybrid-pass`

**Added mid-run. Take this next, whatever you are on** (finish and push what you have first).

Rory ran a Full Treatment on the Water sheet under **Reference Blueprint** and got a sheet whose
ground is still the raw satellite photograph — the paid passes added nothing visible to it. Under
**Satellite Overlay** the same design came back fully illustrated. So the pipeline can spend two
paid renders and ship something the model barely touched, and nothing notices.

Measured, not assumed. `components/design/DesignGlossy.tsx`:

```
grep -n measureRenderDifference components/design/DesignGlossy.tsx
  18:    import ...
  10111:  const diff = await measureRenderDifference(polishInputRef.current, finalSheet, protectMask);
```

**One call site, and it is guarded by `if (isPolishedResult && polishInputRef.current)`.** The
Hybrid stage — the *first* paid render, and the one every Hybrid user pays for on its own — is
never scored. `lib/render-difference.ts` and `tests/render-difference.test.ts` are sound; they are
simply not attached to that stage.

This is the same bug that was already fixed once for the polish pass, quoted from the comment
above that call site: *"until now no code in this app had ever looked at the output image. A pass
that returned its own input verbatim cleared every existing check … and was then stored, labelled
'AI polished', and charged for."* Exactly that is still true one stage earlier.

**The trap — read this before writing the comparison.** You cannot naively compare the Hybrid's
finished sheet against the Hybrid's input, because between them the app composites all the exact
content back on top. That composite-back alone repaints a large fraction of the sheet, so a model
that returned its input verbatim would still score as "redrawn" and the gate would pass everything.

The comparison has to be **what was sent to the model vs what the model sent back**, before the
exact content goes on. Find where the model's raw return is available in the queue-completion path
and score it there. `fullTreatmentProtectPolicy`'s protect mask must be excluded from the score for
the same reason it already is on the polish pass — restored pixels are identical by construction
and would drag an honest render toward "unchanged".

**Keep the existing failure philosophy, which is right:** scoring never blocks a good render, any
error in scoring is swallowed and the sheet ships. A measurement that can reject work it cannot
measure is worse than none. What should change on a failed Hybrid is the same as on a failed
polish — do not present it as an AI result, and tell the farmer plainly.

Verification is a real render, and only Rory can spend one. So: write it, prove the scoring with a
unit test that feeds a known-unchanged pair and a known-redrawn pair through the *same* code path
the app uses, and say clearly in your report that the live confirmation is outstanding.

---

## 0b. The two tanks are labelled the other way round on the two styles — `codex/tank-label-identity`

Rory rendered the SAME Water design twice and sent both PNGs at full resolution.

| | top-left tank, on the boundary | middle tank, by the house |
|---|---|---|
| Satellite Overlay (model draws labels) | `JOJO TANK 2500L` | `JOJO TANK 5000L` |
| Extension Blueprint (app draws labels) | `JOJO TANK 5000L` | `JOJO TANK 2500L` |

**One of those sheets tells a farmer to stand the wrong tank on the wrong base.** A 5000L JoJo is a
different footprint, a different plinth and a different delivered price from a 2500L. This is not a
styling complaint.

The app owns the placement in both cases — the model only paints over markers it was given. So the
app-drawn sheet is the one to trust and the model is the likely culprit, but **do not assume that:
prove which is right from the saved design before changing anything.**

Start by rendering the exact (no-AI) Water sheet for the same design and seeing which of the two it
agrees with. Then work out how the other one could disagree at all. Worth checking specifically:
whether the label a marker carries is bound to the marker's own element id all the way through, or
whether anywhere it is matched back by *type* or by index — with two tanks of the same type, an
index or type match is exactly how two labels swap.

If it turns out the model reordered them, that is a finding too, and the fix is that a tank's
capacity is not something a model may letter — it becomes app-drawn chrome like the schedule panel.
Say which of the two it is; do not fix both speculatively.

---

## 0c. The legend panel is three-quarters empty — `codex/legend-panel-fill`

Same PNG. On the Extension Blueprint water sheet the legend column carries a title, six rows and
then roughly **two thirds of the panel is blank cream** down to the NOTES block at the very bottom.
Next to the Satellite Overlay render of the same design, where the rows are large and evenly spread
down the column, it reads as unfinished.

Two separate things to fix, and they are worth separating in the report:

1. **Rows do not fill the column.** The panel is now as tall as the map (sheets follow the plot),
   but the row rhythm is still sized as if the panel were short. Space the rows to the column they
   are actually in — the phasing panel already sheds and re-fits content to its own height, so
   there is a pattern in the codebase to follow rather than invent.
2. **Counts appear on some rows and not others.** That sheet shows `Tap Point ×6` but plain
   `JoJo Tank 2500L`, `Buried water pipe`, `Swale / contour water line`. A reader cannot tell
   whether the absence of a number means "one" or "not counted". Pick one rule and apply it to
   every row. Related to item 4's audit — the legend is the third of the three `×N` grammars.

`PLAN_VERSION`. Verify by rendering, at both a wide and a tall boundary.

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
