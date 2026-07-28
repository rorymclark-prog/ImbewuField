# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

**How to work this queue.** Take the top unstarted item. One branch per item, named in the item.
Never push to `main`. When it is pushed, say so and **carry straight on to the next item** — do not
wait for a review to come back. Claude reviews and merges behind you, and reviewing means opening a
real render, not reading the diff. If a later item touches the same file as one still unmerged,
branch from the unmerged branch and say so in the report.

Every item below was verified to be real before it was written down — the numbers are measured, not
estimated. If you find one is already fixed or the premise is wrong, **say so and skip it**; that is
a useful result, not a failure. An item you correctly skip with evidence is worth more than an item
you "fix" without reproducing it first.

**Two rules that have each cost a day already:**

- **Bump `PLAN_VERSION`** (`components/design/DesignGlossy.tsx`, currently `v58`) in the same commit
  as *any* change to how a sheet is drawn. The cache keys on siteId + style + layer with no content
  hash, so without the bump nobody who has already rendered a sheet sees your fix — including you,
  when you go to check it.
- **A test that pins today's constant cannot fail when the constant is wrong.** Assert the *rule*
  (`the label stays inside the sheet`), not the *number* (`fontSize === 19`).

---

## Done

- ~~**1. Sheet 08 needs its own panel column** — `codex/phasing-column`~~ — **merged `fd3988b`.**
  Verified by render: sheet 08 now comes out 2517×1268 (1.985:1), identical to sheets 01–07, and the
  schedule column carries all six phases, hold points A–F, critical order and both site rules with
  room to spare. This also closed the 3:1 AI-limit hole, because 08's map aspect is no longer its
  sheet aspect. Good call moving the panel type onto `lgW`.

---

## 2. Map callout type does not scale with the sheet — `codex/callout-type-scale`

`components/design/DesignGlossy.tsx` line ~2326:

```ts
const fontSize = Math.max(19, Math.round(W * 0.011));
```

The floor wins at every realistic width, so callout type is effectively **fixed at 19px** no matter
how large or small the sheet is. That was harmless while every sheet was 1920px wide. Now that
sheets take the shape of the plot, a tall narrow farm renders a 744px-wide map where 19px type is
proportionally enormous, and a wide farm gets 2400px where it is small.

`lib/leader-labels.ts` already shrinks a label that would not fit its margin, so the overflow is
handled — this is about the type reading at a consistent *size relative to the sheet*.

Work out what the floor is actually protecting against (probably legibility when the sheet is shown
as a phone-sized preview) and express that directly instead of as a hard 19. Check a square, a 3:1
wide and a 1:4 tall plot.

---

## 3. The phase chip sits on top of the week line — `codex/phase-chip-clearance`

**Found by looking at the sheet 08 render, not by reading code.** The coloured phase chip's bottom
edge clips the tops of the letters in the week range under it — visible on phases 2, 3, 4 and 5 of
the Ubhejane demo as a bar through the top of "Weeks 1–4", "Weeks 3–6", "Weeks 5–9", "Weeks 8–12".

It is not a missing clearance — the code already tries (`~line 6974`):

```ts
y = Math.max(lastTitleBaseline, chipTop + chipS) + Math.round(lineH * 0.35);
drawLines([phase.weekRange], innerX, weekFont, '#6B6355');
```

The bug is that `0.35 * lineH` is **less than the week font's ascent**, so clearing the chip's
bottom edge with the *baseline* still leaves the glyph tops above it. Measured, with
`chipTop = y - 0.95·fsBody` and `chipS = 1.7·fsBody`:

| | position |
|---|---|
| chip bottom | `y + 0.75·fsBody` |
| week baseline | `y + 1.219·fsBody` |
| week cap-height top | `y + 0.499·fsBody` |

`0.499 < 0.75` → about `0.25·fsBody` of overlap, ≈4px at the demo's 17px body size.

The gap after the chip has to be at least the next line's **ascent**, not a fraction of its line
height. Fix it in terms of the font metric so it stays right when the panel width changes. The week
range also starts at `innerX`, directly under the chip — indenting it to `titleX` instead would fix
it too and might read better; your call, but say which you chose and why.

Then look at the render. `PLAN_VERSION`.

---

## 4. Do the other sheets collide their labels? — `codex/label-collision-audit`

`lib/leader-labels.ts` and `tests/leader-labels.test.ts` fixed callout placement for the **water**
sheet only, after a long name was found running off the sheet edge.

`lib/producer-labels.ts` is a separate, older engine used by the other sheets. Nobody has checked
whether it has the same class of bug. **Audit, then fix only what is real** — if it is sound, say so
and close the item.

Look for: a label drawn wider than the space its placement assumed; two labels overlapping at high
element density; a leader crossing another leader; a label over the legend or off the page. The
useful test is the one that would have caught the water bug: render at several canvas widths with
the longest names in the catalog (`GREYWATER DIVERTER & FILTER` is 27 characters) and assert nothing
lands outside the sheet.

---

## 5. The driveway-gate break has never been looked at — `codex/gate-break-verify`

`docs/RENDER-GEOMETRY-CLEANUP-TODO.md` records commit `c8ec653` as done, with the note "not yet
visually confirmed against a real render". A gate is supposed to create a measured break in the
drawn fence line, at the gate's real width and orientation.

Render it. The demo fixture has a traced driveway; you will need to place a Gate element near the
boundary where the driveway crosses it. If the break is wrong, missing, the wrong width or in the
wrong place, fix it; if it is right, update that line in the TODO doc so nobody re-checks it.

---

## 6. `lib/phasing.ts` builds a printed schedule and has no tests — `codex/phasing-tests`

536 lines, **zero test files import it**. It generates every word on sheet 08: the six phases, their
week ranges, the hold points, the critical order and the site rules — and a farmer builds from that
sheet. A wrong hold point is a wall built before the trench is signed off.

This is not a coverage-number exercise. Read what the module actually promises and pin the promises:

- Hold points come out lettered in order (A, B, C…) with no gaps and no repeats, however many phases
  the plan ends up with.
- The critical order is a real topological order of the phases — nothing appears before something it
  depends on.
- A site rule that names an element (the driveway, the house footings) only appears when that
  element is actually in the design. The demo fixture has a driveway and a house, so build a state
  without them and assert those rules are gone. **Inventing a constraint about something the farmer
  never drew is the failure mode that matters here.**
- Week ranges are contiguous and non-decreasing across phases.

If a test you write fails, that is the point of the item — report the bug rather than loosening the
test to pass.

---

## 7. The crop-plan engine has no tests either — `codex/crop-plan-tests`

`lib/crop-autosuggest.ts` (942 lines) and `lib/crop-plan.ts` (759 lines), **zero test files import
either**. This is the bed-rotation and winter-coverage engine behind the auto-suggest button, and
its output is printed as a planting plan.

The rules worth pinning, in rough order of how much a farmer would be hurt if they broke:

- **Rotation actually rotates.** The same botanical family must not land in the same bed in
  consecutive seasons when the toggle is on — that is the entire point of the feature.
- Every bed in the design gets a plan; no bed is silently skipped.
- Winter coverage does what it says: with the option on, no bed is left bare through the winter
  window.
- Nothing is suggested outside its sowing window for the site's biome.
- Turning the rotation toggle off changes the plan; turning it back on restores rotation.

**Hard constraint: do not add, rename or substitute a plant species anywhere.** Some species are
illegal to propagate in South Africa under NEMBA and the catalog has been agronomist-corrected. Test
against whatever the catalog already contains.

---

## 8. `lib/price-book.ts` turns a design into money, untested — `codex/price-book-tests`

436 lines, **zero test files import it**. It produces the BOQ a farmer or a funder reads as a cost.

Pin the arithmetic and the honesty, not the prices:

- A quantity of zero produces a line of zero, not a missing line or `NaN`.
- The total equals the sum of its lines, exactly — no rounding drift accumulating down the column.
- Every line has a unit, and the unit matches what is being counted (m, m², each, L).
- An element with no price in the book is surfaced as *unpriced*, never silently priced at zero.
  A BOQ that quietly omits a cost is worse than one that says "we do not have a price for this".
- Currency formatting is ZAR and does not depend on the browser locale.

**Do not change any price.** If a number looks wrong, say so in the report and leave it.

---

## 9. Render-only polygon polish — `codex/polygon-polish`

From `docs/RENDER-GEOMETRY-CLEANUP-TODO.md`, still open:

- Smooth visibly shaky polygon and line segments **in the exported illustration only**.
- Add restrained corner joining and antialiasing so exact polygons read as one clean plan shape.

**Saved geometry is never touched** — every stored vertex stays exactly as the farmer drew it. This
is paint-time only. Keep corners that communicate a real boundary, building or terrace break; the
goal is to remove hand-jitter, not to round a building into a blob.

Show a before/after of the same plot in the report. `PLAN_VERSION`.

---

## 10. The whole Design Studio is English-only — `codex/design-studio-i18n`

Measured: **not one file under `components/design/` or `app/design/` imports `@/lib/i18n`.** Thirteen
components, eight wizard steps, the palette, the print composer — all hard-coded English, in an app
whose course narration is recorded in isiZulu and whose i18n layer already carries seven South
African languages (`en`, `af`, `zu`, `xh`, `st`, `nso`, `tn`, ~1 140 keys each).

**Scope this deliberately — do not sweep all thirteen files.** Do `components/design/StepGuide.tsx`
and `components/design/DesignWizard.tsx` only, and prove the pattern end to end: strings extracted to
`lib/i18n.tsx`, `useLanguage()` wired, the language switch actually changing the step chrome.

**Put the English text in every language slot** and list the new keys in
`docs/i18n-needs-translation.md`. Do not write isiZulu, Afrikaans or anything else you cannot have
checked — a plausible-looking wrong translation in a farming app is worse than honest English, and
module 2's narration is already blocked waiting on a real isiZulu-speaking agronomist for exactly
this reason.

If the pattern lands cleanly, say so in the report and the remaining eleven files become the next
item.

---

## Not for Codex

- **Course content** — `docs/narration/*`, `lib/course-*.ts`, slides, audio, animations. Claude's
  lane, and `tests/narration-scripts.test.ts` enforces some of it.
- **A real Full Treatment render.** The paid-difference gate now covers every sheet, but only Rory
  can spend a paid render to exercise it.
- **Vegetables & Staples module 2.** Blocked on an isiZulu-speaking agronomist reviewing 22 coined
  terms — see `docs/narration/vegetables-staples.zu.md`. Not an engineering task.
- **Any change to a plant species name, a price, or an agronomic figure.** Those have external
  sources behind them. Report, do not edit.
