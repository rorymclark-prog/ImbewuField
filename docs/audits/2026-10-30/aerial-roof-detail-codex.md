# Existing roof detail on AI plain-paper maps — 30 October 2026

- Auditor: Codex, following Rory's confirmation that “seven pictures” meant seven roof pitches/sections.
- Reviewed revision: production `673ca6d8b6e5008633cdc550b5f90392eea2d148`, with the focused correction on `codex/aerial-roof-detail`. Oblique remains independently gated on #1153.
- Deployment inspected: production phone correction at 673ca6d; this roof change awaits its own release checks. Terminal results belong to its PR and issue #35.
- Previous audit: [Phone artwork and full-screen fit](phone-ai-paper-quality-codex.md). Carries forward AI-MAP-015, 011/012 and the still-open source seams AI-MAP-007.
- Scope: top-down painted styles finishing a plain-input job with an existing traced building. No worker, provider dispatch, spending, permissions, schema or measured-geometry changes.
- Evidence: actual paid Earthworks frozen scene/raw/input/mask, newly fetched licensed satellite in that exact frame, actual app compositor, executable helper tests and native pixel containment. No new paid generation.

## What was already done

#1154 is live: the phone's illustrated ground survives composition, its input building is visible, and enlarged full-screen maps fit. Free recovery of a job made under the old strict paper prompt still needed a roof fallback, because its raw image has a white hole at the house. That fallback draws a generic corrugated two-pitch roof. The owner's actual roof is more complex.

The available Esri image visibly records hips and valleys. A traced perimeter alone cannot establish those ridges. The correction therefore retains factual image detail rather than inventing a seven-plane roof algorithm or hardcoding this owner's count for other sites.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and limits |
| --- | --- | --- | --- |
| AI-MAP-015 | A legacy plain-input recovery substitutes a simplified roof for the owner's actual roof. | Roof-reference correction implemented and locally visually verified. | Fetch the configured licensed basemap in the immutable job frame, apply the same full-scene presentation crop, then use the shared house-overlay clip in its unfiltered source treatment. Both baseline and result receive exactly the same roof. Only existing building footprints are included; a proposed zone promoted into the primary trace stays excluded. No ground, driveway or whole satellite patch is restored. |
| AI-MAP-017 | Plain-paper artwork has no factual roof source or imagery credit. | Implemented; provider-resolution limit remains. | One per-job roof-reference promise is reused across sheets and both comparison compositions. The white page/legend remain white; the footer explicitly credits satellite roof imagery and the configured provider. Unavailable imagery retains the legacy approximate symbol and identifies its limitation; it is never falsely credited. The source is a fresh basemap reference, not the original paid input or a dated roof survey. It is visibly softer than AI artwork. Seven roof sections are owner-reported, not independently surveyed here. |
| AI-MAP-011 / 012 | Oblique illustration release. | Retained separately on #1153. | At head a1414fd444f09de63a47074c2bafa6c618e20913 its preview, focused-render and rules pass; full tests remain running. This focused roof release does not waive that full-suite gate, and overhead roof pixels must never be pasted onto Oblique art. |
| AI-MAP-018 | The newest user-supplied Whole image still shows an unwanted driveway border. | User-reported; next investigation. | It is a different, photographic-source Whole sheet. This plain-input correction does not alter it. Inspect the associated durable raw/input/mask before changing border ownership. |
| AI-MAP-019 | The northern tree should extend past the boundary in that Whole image. | User-reported; next investigation. | Carry forward the boundary foreground correction; inspect whether the crown was absent in raw output or cut during assembly. Do not widen a general ground restoration window or repaint saved coordinates. |
| AI-MAP-007 | Registered source-photo context seams. | Open. | Retain the preceding audit's evidence. No aerial registration changes are included. |

## Verification

- Typecheck: `npx tsc --noEmit` passed.
- Affected tests: `npm run test:render` — 585 pass; 40 release/localisation/tour/access/Simple UI checks pass. No failures, skips or TODOs. Existing paid-difference, recovery, paper/photo and geometry guards remain.
- New checks execute the real roof helper, including frozen-frame selection, common crop, existing/proposed ownership, source treatment, imagery failure and unchanged scene. The actual finisher is exercised with and without a roof reference, retaining the legacy fallback when no reference is available and crediting only pixels actually used.
- Whitespace and release-note checks pass locally; read current-head focused-render, rules and preview before merge. The full application suite runs separately and is not claimed passed.
- Output inspected: app-composed Carl/Sandy Earthworks at original scale 2, the source aerial and isolated roof overlay. Private full-size output is in Rory's Documents/ImbewuField App, outside Git. Scene bytes remain unchanged. Native measurements are recorded in `aerial-roof-pixel-proof.json`.
- The first local pixel probe sampled an image before native decoding completed and correctly failed its nonempty-image assertion. Awaiting image decode corrected the probe; no production assertion was weakened.
- No physical iPhone Safari test, no new provider generation, no independent roof-plane survey, and no acquisition-date claim. Four paired notice translations are unreviewed drafts.
- **This changes the picture.** PLAN_VERSION v93 and recipe r8 are unchanged. Existing saved bitmaps/raw jobs are retained; reassembly appends a recovered result.

## Next continuation

Merge after the focused release gates and verify the production SHA. Rory can recover the same paid plain-paper Earthworks entry at its original print quality with **Reassemble artwork · no AI charge**. Keep the previous copy. Inspect the separate Whole driveway border and northern crown next. Oblique retains its separate full-suite requirement and should integrate this production correction before its final release head is checked.
