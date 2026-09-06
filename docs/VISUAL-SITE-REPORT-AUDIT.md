# Site report visual audit — 6 September 2026

Rory asked for a report that makes the garden visible: charts, graphs, photographs,
plant illustrations and a full-colour printed edition matching the digital report,
with a separate economical print option.

## Findings and changes

| Finding in the existing report | Change |
| --- | --- |
| The generated site report begins with a title block and many similar fact tiles. | A photographic or saved-plan cover, a clear site identity and large key figures lead the screen report. |
| A rainfall chart appears on screen but is absent from the downloaded PDF. | The PDF uses the same chart artwork as the screen, rasterised at print resolution. |
| Images are excluded from the PDF by default, even when the farmer reads them on screen. | Screen and full-colour modes include photographs and map plates by default. Ink-saving mode clears image inclusion. |
| Beds, staple plots, water capacity and costs are mostly described in prose or tables. | Bar charts use saved mapped areas, stated tank capacities and priced BOQ groups. |
| Sowing months are difficult to scan in paragraph lists. | A January–December calendar distinguishes recurring sowing from first-season-only entries. All saved crop rows are retained across chart panels. |
| Crop artwork is visible in the app but missing from its PDF. | Full-colour export adds catalogue crop illustrations using the saved crop names. |
| Sample report text is shown in a dense grid of cards. | The sample report has a cover, metrics, charts and numbered reading sections. Its layout image appears beside the relevant site discussion. |
| Prepared sample PDFs put photographs behind the text and have no data graphics. | All 18 existing PDF URLs now receive a new colour edition with each garden's own photograph, allocation chart, learning progress and schematic. |
| There is only an ink-saving PDF action in the sample report composer. | Three presentation choices: Screen, Print · full colour, Print · save ink. Download follows the selected presentation. |
| Enlarging every picture can distort measurements or imply that illustrations are evidence. | Maps retain their aspect ratio and geometry. Sample photos remain labelled AI references; site measurements are not inferred from images. |

## What each edition contains

| Element | Digital / full colour | Ink saving |
| --- | --- | --- |
| Report text, figures and source qualifications | Preserved | Preserved |
| Site photograph / available saved map | Prominent cover | Optional |
| Charts from available structured records | Included | Text figures retained |
| Saved design sheets | Available on screen; selected current sheets included in full PDF | Optional |
| Crop illustrations | Included when catalogue artwork is available | Omitted by default |
| Page backgrounds | Forest-green cover; white content pages | White paper |
| Existing 1-page / 5-page summaries | Retained as compact summaries | Retained |

The PDF repeats the digital report's chart artwork and values, with pagination
adapted to A4. Browser printing retains the screen's responsive report layout.
Fixed-length summaries continue using their established compact text layout.

## Data boundaries

- Real site charts use `ReportSiteFacts` and the saved location snapshot. They do
  not parse numeric claims out of AI-generated prose.
- Tank capacity is labelled as capacity in the plan, with installation status and
  unknown capacities preserved. It is not presented as water currently available.
- The cost chart is the existing BOQ's priced subtotal, with unpriced and existing
  items explained. It does not invent supplier quotes or actual expenditure.
- The sowing calendar shows saved sowing months, not predicted harvest months.
- Sample harvest totals have no shared reporting period, so the redesign does
  not manufacture monthly trends, annual yields, profits or livelihood outcomes.
- Older saved report text remains unchanged. Current site photos/maps can be
  newer than that text; the caption preserves that distinction. A live satellite
  capture is not attached to a different saved report.
- No farm geometry, species names, lesson content, `PLAN_VERSION`, production
  permissions or paid AI generation rules are changed.

## Validation

The six-page full-colour crèche sample and three-page ink-saving counterpart were
rendered and visually inspected. All 18 prepared PDFs were generated from their
own shared sample records. Focused checks cover missing measurements, unknown tank
capacity, calendar continuation, first-season qualifiers, SVG label escaping and
reconciliation of every sample area's chart.

Browser review covered the main Ubhejane site report and the crèche garden report
at a 1363 px desktop viewport: charts, crop illustrations, image enlargement,
colour/ink controls and PDF generation. The rainfall chart was moved out of the
two-column grid after the review showed its final month needed horizontal scrolling.
Phone layout has responsive styles but has not been verified on a phone.

PR #422 records the final repository and hosted checks. Production status remains
separate from preview status; the repository's normal merge review still applies.
