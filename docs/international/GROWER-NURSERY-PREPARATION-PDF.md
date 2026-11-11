# Grower nursery preparation PDF handoff

The current nursery review offers **Download preparation PDF** alongside the preparation CSV. This is a printable worksheet for represented planned transplant-raising batches, not a complete garden seed list or evidence of observed sowing, nursery stock, plant health or seedling readiness. Handwritten notes on the sheet are not saved by the app.

## Calculation and scope

`buildGrowerNurseryPreparationPdf` in [nursery-export.ts](../../lib/nursery-export.ts) formats `projectGrowerNurseryPreparation` from [grower-nursery.ts](../../lib/international/grower-nursery.ts). It adds no forecast, ledger, loss factors or duplicate arithmetic. Counts already include supplied loss estimates; applying them again would inflate requirements.

Final field positions, starts to raise and seeds to sow remain separate. A complete count covers only represented members. Unknown totals retain their known subtotal, or an unknown subtotal when none is known. Explicit zero remains zero. Overflow prints an unavailable-total hold rather than a rounded number. An overall incomplete review remains incomplete even when individual group counts are complete. Empty groups do not establish zero demand for the whole garden; direct sowings and omitted work need separate review. Matching crop names do not establish interchangeable varieties or seed lots.

The worksheet preserves the review horizon, exact UTC raising-start dates and exclusive field-entry boundaries: raising ends **before** the listed field-entry dates. Out-of-horizon dates stay visible and flagged. Container/surface availability, tray packing and other resource questions remain in the separate dated resource review. No stock subtraction, purchase action or new crop advice is added.

## Delivery and privacy

[GrowerNurseryReviewPanel.tsx](../../components/crops/GrowerNurseryReviewPanel.tsx) retains the original review for export. Before PDF creation it calls the parent’s current-source check, checks the display generation/key/sample context, and compares the complete nursery result with fresh inputs through `isGrowerNurseryForecastCurrent`; matching fingerprints alone are insufficient. The PDF writer loads asynchronously. After it finishes, the panel repeats the display checks, parent current-source check and full-result comparison before calling `downloadFile`. Changed or refused context withholds delivery. Parent account/source/book checks remain the authority; the PDF builder itself grants no permission.

The PDF exposes canonical display crop names, dates, counts, safe issue labels and group numbers. Private farm/source receipts, coordinates, fingerprints and batch/planting/profile identities are excluded. Sample output carries a DEMO marker on every page, with planned-estimate/source-not-verified footers.

The PDF is English-only. Its standard font must represent canonical crop names faithfully; unsupported name glyphs cause a hold rather than silent renaming. Release-copy AI drafts do not constitute a translated PDF or fluent-language approval.

## Evidence and remaining gates

The final focused log records **141 passed, zero failed**. This is focused verification, **not a full-suite result**. The coordinator observed the final Node 24 typecheck exit 0 with no diagnostics; whitespace and the release-note gate also pass.

[grower-nursery-preparation-pdf.test.ts](../../tests/grower-nursery-preparation-pdf.test.ts) checks actual PDF text, separate counts, partial/unknown/zero/overflow states, privacy and pagination. The modified [nursery panel tests](../../tests/international-grower-nursery-panel.test.ts) exercise actual delivery and post-PDF context withdrawal/refusal.

The coordinator’s render-review manifest records **eight reviewed pages** across ready, unknown-seeds, many-groups, long-dates, zero-seeds and overflow fixtures. It records in-page bounds, per-page DEMO markers and final rerenders pixel-identical to the viewed images. The coordinator reviewed the images.

The coordinator then used a disposable signed-in local grower account under the branch emulator rules, entered the estimates/equipment/dated allocations through the actual app, and downloaded the PDF from a real proposal. The rendered downloaded page shows 32 final field positions, 40 starts and 107 seeds, raising from 2028-02-01 until before 2028-02-11. These synthetic figures test the calculation; they are not farming recommendations. Desktop and 390-pixel phone views were inspected; the download button is 44 pixels high and fits the viewport. The owned test tab, preview and emulators were closed after verification.

A private in-memory negative control deliberately truncated metric-card values. The overflow text assertion failed as intended; repository source was unchanged.

**Pending:** full-suite/current-head CI, exact hosted verification and the release decision. The active combined-parent full suite does not cover this additive PDF branch. No production merge or fluent approval is claimed.
