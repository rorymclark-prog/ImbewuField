# Exact-sheet sweep — 2026-08-02

Render → look → fix → re-render, done by Claude in a real browser (not by an agent reading code).
Sample farm: `sessionStorage.imbewu_sample_mode='1'`, `/design?lat=-27.72623&lon=31.96304`,
Preview map → sheet → Reference Blueprint → Exact Canvas.

**Caveat that matters:** the sample farm is small. It renders ~6 callouts where Rory's real
Ubhejane Crèche design renders ~28. Density defects will NOT reproduce here. Anything below marked
"density" needs re-checking on the real farm.

## Checked

| # | Sheet | Verdict |
|---|-------|---------|
| 01 | Site | **Fixed** — legend type was ballooning to dwarf the sheet title on a 3-row legend (`c3ee87e`). Now compact. Re-rendered and confirmed. |
| 02 | Sector | **Fixed** — title was printed twice, once burned on the map top-left and once in the panel, and the on-map copy crowded the berg-wind arrow and both sun-path labels (`9f2b475`). Re-rendered and confirmed. |
| 03 | Zones | **Clean.** Legend matches map exactly (zones 1/2/3/5, badges present). Type proportionate. No collisions. No change made. |
| 06 | Planting | **Fixed** — 28 leader lines with compass-prefixed duplicates. Root cause was not the label cap: a cluster needs 3 distinct species to earn a shared header, so on a spread-out farm every specimen became its own pill. Now merges by escalating cluster radius (`407502f`). **Density — verify on the real farm.** |
| 08 | Whole design | **Clean.** Legend counts reconcile with the map ("Production beds & crops ×7" vs "VEGETABLE BED ×7"). Labels sit inside the frame. The new merging reads well — three southern trees became one "SOUTHERN TREES" callout. No change made. |

## Not yet checked

`04 Water` · `05 Earthworks` · `07 Structures` · `09 Phasing`

Sheet 05 was worked heavily on 2026-08-01 (swale ditch+berm, legend swatch, the swale tool) and is
the most likely of these to be in good shape. 04, 07 and 09 have had no visual pass.

## Open, found but not changed

- **Sector sheet has an unexplained mark.** A vertical blue line runs down the middle of sheet 02
  with no label and no legend row. It is probably a water line drawn as context, but the sheet's
  own stated invariant is "never a drawn energy with no legend row". Decide whether context lines
  belong on an analysis sheet at all; if they do, they need a legend row.
- **The leader budget of 12 is a guess.** `producerLabelsWithinBudget` merges until a sheet fits 12
  leaders. That number was chosen to fix a 28-leader sheet, not derived from anything. Worth
  judging against the real farm — it may want to differ per sheet, since Planting is inherently
  denser than Zones.
- **Merged callouts lose their compass word.** When two distant avocados merge, the result is one
  "AVOCADO TREE" callout at the centroid — which may point at ground between them rather than at a
  tree. Acceptable at the budget's coarse end, but check it reads sensibly on a real farm.

## Standing rules used

Free Exact Canvas path only — no paid render was triggered at any point. `PLAN_VERSION` untouched.
No agronomic figure changed.
