# Brief: legend typography on the exact plan sheets

**Owner's ask (Rory, 2026-08-01):** "i think these should be bigger? as well as the icons and
text etc … i would like them 3 times their size."

**Reference:** the `04 — WATER, GREYWATER & IRRIGATION` legend panel. Eight rows
(`JoJo Tank 2500L ×1`, `JoJo Tank 5000L ×3`, `Tap Point ×7`, `Buried water pipe ×1`,
`Drip header and laterals ×9`, `Banana Circle ×1`, plus the RAINWATER / IRRIGATION /
FILTERED GREYWATER section headings). Text and icons are small; the vertical gaps between
rows are several times the text height.

## The finding to act on

**Do not multiply the font size by 3.** The panel is not too small — it is *justified*. Leftover
vertical space is being distributed as gaps between rows instead of being spent on type. That is
why the type looks small next to the space around it, and it is why a 3× multiplier would break
the dense sheets (Planting on a real farm carries 20+ species rows and already has to step the
size DOWN to fit).

The correct fix is a **fit-to-height pass**: choose the largest font size at which the rows still
fit the panel, then let the natural rhythm set the gaps. On a sparse legend that lands close to
the 3× the owner is asking for, entirely by itself. On a dense legend it changes nothing.

## Where the code is

- `lib/sheet-legend-layout.ts`
  - `legendRowGap(availableHeight, usedHeight, rowCount, rowRhythm)` — the justification. Already
    capped at `rowRhythm * MAX_GAP_TO_ROW_RHYTHM` (1.15), so the observed gaps are larger than
    this cap alone predicts. **Find out why before changing the constant.**
  - `legendBodyFontSize(...)` — `baseSize = max(17, width * 0.046)`, grown toward
    `widthCap = width * 0.066` by `legendHeightFillRatio(rowCount)`. Note the cap is driven by
    the column WIDTH, so a tall sparse panel can never grow into its own empty height. This is
    the most likely single cause.
  - `legendHeightFillRatio` — reaches 1.0 at 6 rows, so the Water sheet's 8 rows are already at
    full ratio and still small. Consistent with the width cap being the real binding constraint.
- `components/design/DesignGlossy.tsx`
  - `layoutRows(...)` — `contentHeight = max(symbolSize, lines * lineH) + fontSize * 0.22`.
  - `symbolSizeFor(fontSize, columnWidth, columnCount)` — single column returns
    `max(baseSw, fontSize * 1.45)`.
  - **Open question worth measuring first:** the rows appear to RESERVE more height than the
    painted icon uses. If `baseSw` is large while the drawn glyph is small, every row reserves a
    tall block and paints a small mark in it. Measure a real render before assuming.

## Suggested order of work

1. **Measure, don't guess.** Render the Water sheet through the free exact path and log, for each
   row: `fontSize`, `symbolSize`, `contentHeight`, `rowGap`, and the actual painted glyph size.
   The gap between reserved and painted is the whole story.
2. Lift the width cap on `legendBodyFontSize` so a tall panel can grow into its own height, and
   let the existing step-down search keep dense legends fitting.
3. Scale the icons with the type (they already follow `fontSize * 1.45` — confirm the drawn glyph
   honours `symbolSize` rather than a separate constant).
4. Re-check the dense case: Planting on the Ubhejane Crèche sample has 20+ species rows and must
   still fit on one panel without spilling.

## Rules for whoever picks this up

- **Free renders only.** Everything here is verifiable through *Exact Canvas* / Reference
  Blueprint. Do not spend a paid AI render to check typography.
- **Do not touch `PLAN_VERSION`.** Bumping it re-charges every paid render the owner has already
  bought.
- Never change a price, a coefficient, a spacing or any agronomic figure.
- `npm test` and `npx tsc --noEmit` must both pass. There are existing tests in
  `tests/sheet-legend-layout.test.ts` — extend them, don't relax them.

## Related, same area, not yet assigned

1. **The panel clips long rows.** `Zone 1 — Daily gard…` and `JoJo Tank 2500L ×…` both ran off the
   right edge on the owner's screenshots. Wrapping exists (`wrapLegendText`); something is
   measuring against the wrong width.
2. **Auto-generated map labels are repetitive.** A Planting sheet printed
   `SOUTH-EASTERN PAWPAW TREE` / `SOUTH-WESTERN PAWPAW TREE` / `SOUTH-CENTRAL PAWPAW TREE` down
   one side. Grouping to `PAWPAW ×3` is proposed but not decided by the owner.
3. **Leader lines have no whole-sheet layout pass.** Labels are placed one at a time; the current
   length cap (`LEADER_MAX_RUN_RATIO`) treats the symptom.
