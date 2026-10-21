# First-crop reference draft evidence

Source: `6446f1cbb42deda5b1b480da885ba884e89f1c9c` (#1045).
All new wording remains an unreviewed AI draft.

The static scenes use actual `buildProductGuidance` output and the real `ReportView` paragraph
renderer/CSS with the app fonts. They cover all 19 source notes plus explicit missing timing in
four languages at 390 × 844 and 1440 × 1000: 160 measured states, no clipping or document overflow.
`contact-*.png` shows the four languages side by side for the trial/cultivar, local-qualification,
clonal-only and missing-timing cases. Those contacts were visually inspected.

Four real Reports viewer flows open saved output from the actual generation route with mocked
AI/auth/network services. The original placement adapter emits 17 first-crop records in this
fixture; granadilla and guava are covered directly/static, not claimed in the live saved-viewer
pass. Every native paragraph is checked line by line at phone reading positions: 68 paragraphs,
608 lines, zero occlusion. `api-*-0-phone-reading.png` shows the full reader chrome in each
language; the additional Tshivenda screenshot shows an explicitly foreign-trial qualification.
All were visually inspected. The source crop/species headings keep their catalogue wording.

`browser-qa.json` retains paragraph text, line counts, overflow and saved-byte checks.
All four saved bodies expose the selected language; stored report bytes stay exact. Temporary
saved-report and language storage was restored, and paid generation was blocked in the browser.
No PDF was produced. Other English research paragraphs remain visible and explicitly marked
as an unfinished translation area; this is not a whole-report completion claim.

Final focused validation: typecheck clean; 369 tests passed across 41 registered files,
including the original farmer-facing release-note length test. Release-note and whitespace
checks are clean.

The complete suite at the older `6446f1cb` remains live with a known release-note length failure.
Follow-up commits on #1044 and #1045 shorten the two lines and retain the original test. No full green result
or fluent-speaker approval is claimed from this evidence. `PLAN_VERSION` remains unchanged.
