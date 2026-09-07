# Crop plans within site reports

Rory authorised the R11–R14 crop presentation work and production deployment on 7 September 2026.

The site report now gives a concise account of intended production: small crop thumbnails, planting rows, a saved growing-space drawing for a selected month and one bed occupancy calendar. The full operational crop plan can be downloaded separately or included as an optional appendix. Both use the report's saved planting rows, geometry copies and date, with the crop planner's existing calculations.

New reports retain bed-to-planting links, optional farmer-entered variety, the plan date, relevant accepted-plan notes and drawing outlines. Reopening a saved report does not read current geometry into that report. Changes in the current local plan are flagged. Older reports keep their aggregated crop summary and explicitly state that bed-by-month detail is unavailable. They are never backfilled from unrelated or newer data.

The crop planner has an optional variety/cultivar input. Catalogue variety guidance remains advice, and general crop timing remains general; a typed cultivar does not silently alter agronomic calculations. The full planting table includes the recorded variety.

The crop gallery no longer creates six large illustrations per PDF page. Charts already shown in the overview are not repeated under narrative chapters. New report calendars use a dated rolling twelve-month period. The optional working appendix is in English, as labelled; the main crop section retains English/isiZulu control labels.

Validation includes a saved-snapshot round trip, isolation from later plan edits, exact bed/month/variety associations, malformed cross-site row rejection and legacy handling. Existing footer assertions were updated because the working-plan renderer now owns the optional appendix's page footers. A chapter test now verifies chart presence in the overview and absence of repeated chapter charts; the conceptual illustrations are still checked.

Local PDFs were rendered and inspected: the prepared sample's compact report is four pages in the focused fixture, and the optional working document adds the existing schedules and field sheets. Those counts describe the fixture, not fixed limits for user reports. No paid generation was used. No changes to original design geometry, PLAN_VERSION, species, lessons, billing, model selection or quotas.

Desktop preview inspection confirmed compact rows, the month selector and matching crop-key updates, and the single bed calendar. PDF inspection also prompted a correction to crowded working-sheet footers. The drawing key explicitly restores decimal list markers that the app reset otherwise hides. Phone layout has responsive CSS but has not been visually verified in this browser.
