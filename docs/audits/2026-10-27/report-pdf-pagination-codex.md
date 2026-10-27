# Report PDF pagination continuation — 27 October 2026

Auditor: Codex. Source: #1131 after the current-main integration at `b641213234`.
Previous records: [Claude report handoff](site-report-handoff-results-claude.md),
[nine-sheet map audit](map-visual-audit-codex.md), and the preserved 3 October
six-report catalogue linked in the [shared audit index](../README.md).

## Finding carried into the release

| ID | Observation | Change and evidence |
| --- | --- | --- |
| REP-L01 | Native PDF exports of the preserved Ubhejane reports left chapter/subheadings at the bottom of a page while their opening paragraph or table started on the next. Measuring that opening also changed the active font. | Reuse the existing opening-room calculation for headings without pictures and for subheadings. Measure the actual wrapped table header and first row; restore the active font after measurement. |

The three emitted-PDF regressions failed before the correction and passed after.
They vary the preceding text across page boundaries and inspect each real PDF
content stream. They require both supplied blocks to survive on the same page;
paragraph cases also require heading emphasis to survive. No existing assertion
was removed. The shared compressed-stream helper now exposes individual streams
while retaining its original joined-text API.

## Visual verification and sample provenance

Four **format previews** use the original authored Ubhejane assessment/design
text and source drawing preserved on 3 October. The report purposes are labelled
Site potential and Complete site plan, each with Simple and Comprehensive detail.
The original six reports remain unchanged. There is no new site visit, AI
narrative, market quote, implementation claim or replacement of field evidence.

The current app's `buildReportPdf` produced 3, 8, 3 and 9 pages respectively.
All 23 pages were rendered with Poppler and inspected in contact sheets; full
climate, layout/water and original-plan pages were also checked at readable size.
No character falls outside its paper bounds. The cover records both the format
preview date and the older evidence/design dates. Source tables and wording
remain supplied records, with unknowns and proposal status retained. The private
sample folder contains the source conversion, manifest, rendered pages and bounds
checks under Rory's existing `Documents/ImbewuField App/Reports/2026-10-27/`.
Personal field records are not copied into Git.

The separate live Record plan demonstration is from the public prepared Ubhejane
tour. Its counts are not substituted for the real saved-site baseline. Production
UI, PNG/SVG download, Add to maps success and gallery presence were checked.

## Verification and limits

- Canonical Node 24 typecheck passed, followed by 125 focused PDF, report architecture,
  update-localisation, current-main keyboard and saved-map workspace checks.
- The new farmer-facing PDF notice has additive, explicitly unreviewed drafts in
  zu/st/ts/ve. Exact source pairs are in [the draft record](map-visual-release-note-drafts.json).
  Existing native wording, species, measurements and lesson bodies are preserved.
- This changes exported PDF pagination; map painters are unchanged by this correction.
  `PLAN_VERSION` and map recipe r8 are untouched. No saved report or drawing is overwritten.
- The full ordered local suite and exact-head CI remain release gates. Terminal
  results and production verification belong in #1131 and issue #35. Do not use
  an earlier green head to certify this additional correction.
- No physical-phone/Safari check or new agronomic approval is claimed.

Next continuation: complete the release gates, verify the deployed source, and
show Rory the local samples with their evidence dates visible.
