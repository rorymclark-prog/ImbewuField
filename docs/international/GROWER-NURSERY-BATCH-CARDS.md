# Planned nursery batch cards

The own-input nursery review offers **Download planned batch cards** beside its preparation CSV and worksheet PDF. It prints an English A4 planning card per represented preparation group, with a cut guide and space for handwritten sowing, seed-lot and container notes. Handwritten notes are not saved by the app. Cards do not establish observed sowing, stock, readiness, resource availability or tray packing.

## Calculation and delivery

The additive builder in [nursery-export.ts](../../lib/nursery-export.ts) formats the existing preparation projection. It adds no forecast, density, loss allowance, purchasing conversion or inventory ledger. One card represents a group, not a tray. Final field positions, starts and seeds remain separate; supplied loss estimates are already included. Crop names do not establish interchangeable varieties or seed lots.

Cards retain overall review status separately from included group completeness, proposed/saved-planned source status, review horizon, exact UTC starts and all exclusive field-entry boundaries. Unknown totals retain known subtotals or an explicit unknown subtotal. Zero and overflow remain distinct. Empty partial output retains its summary and safe holds; no represented transplant batches does not establish zero whole-garden demand. Long date lists continue across pages.

Canonical names come from the crop identity authority, not supplied batch display names. The font preflight holds unsupported canonical glyphs rather than renaming crops. Internal identities, fingerprints, source receipts and coordinates are omitted; sample pages carry DEMO. Removing the sole additive function recovers the exact pre-existing exporter file.

[GrowerNurseryReviewPanel.tsx](../../components/crops/GrowerNurseryReviewPanel.tsx) shares the existing PDF branch. Current source, full result, display generation/key and sample context are checked before and after the asynchronous writer. The builder grants no live permission. Stale/refused contexts withhold delivery and withdraw obsolete reviews as appropriate.

## Evidence and remaining gates

Coordinator Node 24 typecheck exits 0; **220/220 checks across 20 existing registered affected files** pass. Original 88-check and later 220-check failures were preserved. Corrections retain real resource allocations, separate completeness states, canonical names and unknown subtotal values; established assertions were not weakened. A deliberate in-memory metric truncation fails the actual PDF assertion without changing repository source.

Fifteen final fixture pages pass bounds, per-page DEMO and privacy checks. Nine representative pages were viewed, including unknown/zero/overflow, long-date continuation, empty partial and first/last multi-group cards. Final rerenders match those images. Six intermediate group pages were not individually viewed.

A signed-in disposable local account entered synthetic estimates, equipment and dated allocations through the app and downloaded cards at desktop and 390-pixel phone width. The downloaded page was rendered and viewed: 32 field positions, 40 starts and 107 seeds, raising from 2028-02-01 until before 2028-02-11. These are engineering inputs, not recommendations. The phone control fits and is 44 pixels high. Owned preview/emulators and test tab were stopped.

Full-suite/current-head CI, exact hosted verification and production release remain pending. Earlier combined-parent CI does not cover this branch. Release descriptions are unreviewed Codex AI drafts, not translated PDFs or fluent approval.
