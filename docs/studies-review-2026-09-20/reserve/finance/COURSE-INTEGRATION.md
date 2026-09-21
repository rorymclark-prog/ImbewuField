# Separate Farm Finance teaching preview

21 September 2026. The original integration branch was based on production `18f91b1c`; its English reading preview is now on main (`5e7b19b` and later). This document retains the original integration evidence and records the current teaching boundary.

## What this change makes available

My Studies links to `/student/finance`, a separate eight-unit, 24-lesson English teaching preview. All lesson explanations and 141 practice sections come from the existing F1–F8 manuscripts. Unit case boundaries, source cards, worked answers, primary-source links and the existing seven F2–F8 printable workbooks accompany the lessons. F1 uses its on-page event cards. App companions are linked beside the concepts they support. Existing approved homestead illustrations are reused; no new animation or narration is introduced.

The overview explains the proposed ten-day delivery (four to five contact hours daily, excluding breaks) as an estimate requiring a learner pilot. It does not claim validated hours, accreditation or completion of a growing season.

A reading checklist saves on this device, scoped to signed-in identity or guest; sample ticks are temporary. It is explicitly not an assessment result. Finance does not enter COURSE_MODULES, existing course_progress, mentor sign-off or permaculture capstone eligibility. No real farm financial records are modified by the course.

## Reproducibility and verification

`python3 scripts/build-finance-course.py` extracts the authored material and copies the existing workbooks. `--check` performs a read-only comparison of every generated section and workbook against the source. The course test verifies the 24 authored IDs, explanations, independent practice, source hashes, assets and isolation from the existing course. Invalid checklist storage is surfaced rather than silently erased; unknown or duplicate lesson IDs cannot add ticks.

All eight existing practice verifiers passed, rejecting 104 deliberately introduced accounting/arithmetic/source faults. This checks the bounded classroom cases; it does not substitute for the outstanding practitioner review.

Production build passed. Browser inspection on the local production server covered desktop overview; 390px phone overview, F1 lesson and F7 source tables; visible draft notices; first-lesson reading tick, reload persistence and undo; My Studies course discovery and return. Phone document width stayed 390px; wide tables scroll inside their own region. An initially overlapping floating Back button was corrected by using the existing registered in-header control and inspected again. Device overrides were removed afterwards.

HTTP checks independently loaded all 24 lesson pages and compared their H1 titles, fetched all seven PDFs with application/pdf and exact source bytes, and checked a nonexistent lesson returns 404. No new image-generation or Flow credits were spent.

The first full test run passed 3653/3654 tests with zero failures and one existing TODO. After adding the header control, the final run caught an overlong release-note line; the wording was shortened and the required suite rerun. Final sequential verification: typecheck clean; 3654 tests, 3653 pass, zero failures, one existing TODO; whitespace and release-note checks pass. A simultaneous build/typecheck attempt invalidated generated .next paths; they were subsequently run sequentially. No test assertions or font configuration were weakened.

## Remaining production work

This is a review preview, not a finished self-paced finance qualification. The original material still includes facilitator instructions and worked answers. Before presenting it as the finished course:

- Review teaching language and real app boundaries, including partial payments and workbook alternatives. Keep unsupported app operations out of instructions.
- Complete South African bookkeeping review, learner trials and fluent isiZulu review; record their actual evidence, not an AI substitute.
- The connected project now provides guided, independent and retry cases with their own reconciled synthetic dataset. Practitioner review and formal assessed-course integration remain open; the current eight unit packs still must not be concatenated into one ledger.
- Add reviewed narration and meaningful assessed progress/recovery. A text/image/workbook offline pathway download is being added separately and needs its own production offline check; guide downloads alone do not establish Finance availability.
- Review static imagery and accessibility throughout the final experience. Animations remain held for Rory’s joint review.

The previous production releases PR484 (167 English app-guide recordings) and PR485 (guide offline downloads) remain separate, completed releases. The Finance preview is deployed on main as an English reading/practice preview; it is not yet a reviewed, assessed or translated course.
