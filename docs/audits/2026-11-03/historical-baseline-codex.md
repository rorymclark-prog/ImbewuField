# Historical Site and Sector baseline — 2026-11-03

- Auditor: Codex, following Rory's approved archive-photo handoff and readability review.
- Reviewed revision: main `a4fdf7afa00580989b9a6871425154779359ea16` plus branch `codex/ubhejane-historical-baseline`.
- Deployment inspected: preceding release verified live at `a4fdf7a`; this branch's release verification belongs to its PR/issue #35.
- Previous audit: [AI layer fidelity corrections](ai-layer-fidelity-corrections-codex.md). Carries AI-MAP-019/024–042 forward.
- Scope: approved historical photograph for the populated Ubhejane Site/Sector, exact/AI source and recovery composition, photo annotations, evidence-based underlay defaults, Phasing style credit. No saved geometry, schemas, provider dispatch, paid gates or security rules changed.
- Evidence: actual archive extraction, eight classroom roof-control pairs, production compositors rendered with native canvas, regression tests, three fresh paid requests through the normal owner UI. Browser release verification and historical paid Sector remain continuation checks.

## What was already done

PR #1175 is live. Site/Sector already-paid artwork was recomposed and inspected; the Sector wash and effort-zone ghost bands were removed. This release adds the user-approved before-works source without replacing current imagery on proposed-design sheets. Past paid jobs retain their frozen source and contract. The public nearby practice fixture is schematic and is deliberately excluded from this photographic alignment.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-040 | Plain defaults can encourage a new roof over paving and moved tanks | Superseded recommendation | Fresh paid Field Ledger Phasing on plain paper invented a large courtyard roof and moved tanks northeast. The same style using the owner's aerial retained the two roofs, open courtyard and northwest tanks and was visibly painted. AI defaults now retain available aerial evidence across all sheets/styles. Manual paper is preserved; exact Zones still defaults to paper. White page/legend are independent of the source. |
| AI-MAP-037 | Phasing reads as exact SVG and style footer is wrong | Partial verification | Fresh aerial Field Ledger is visibly painted; no universal footprint accuracy claim. Its footer still said Reference Blueprint; finishing now receives the actual selected style. Frozen legacy material behavior remains unchanged. |
| AI-MAP-043 | Site/Sector use later interventions as their before-state | Implemented; exact output inspected | Approved 4000×3000 archive JPEG is byte-identical (SHA in immutable baseline module). Only the actual populated site matches. Site/Sector default to this historical source with a current-background switch. Later design layers and saved geometry are untouched. |
| AI-MAP-044 | Drone photo has a different camera frame | Approximate registration verified | Eight corners on the two classroom roofs: maximum residual 4.32 pixels in the 2880×1920 reference export, RMS 2.02 pixels per coordinate. This measures image fitting, NOT ground accuracy, orthorectification or surveyed georeferencing. Height/parallax remains. Same source-frame crop authority is applied to the photo, numbered facts and paid coverage mask. A visual check caught markers incorrectly using resized geographic metadata; corrected and covered by executable crop tests. |
| AI-MAP-045 | Historical photo does not cover both current extent tips | Verified limitation | Northeast and southwest tips are outside the image. They stay white, including after AI restoration. No invented historical landscape/outpainting. Current design extent is dashed green and explicitly distinct from visible photographed fence (solid brown). |
| AI-MAP-046 | Long callouts hide infrastructure; swatch key is unclear | Exact output visually verified | Eight matching numbered photo pins/key entries: two classrooms, bare slab, play area, toilet, tank, road, visible fence. Labels are photo annotations, not new measured farm features. No long plaques over roofs/play equipment. Sector omits these inventory pins and condenses provenance. |
| AI-MAP-047 | Historical source date and imagery attribution could overclaim | Implemented and inspected | Published comparison says July 2019; camera capture date is unverified. Embedded PDF created 7 October 2019. Archive credit replaces current basemap-provider credit. Image registration and missing coverage are stated in both sheets. |
| AI-MAP-048 | Historical Sector could be reported as improved AI based only on exact overlays | Open provider verification | Exact historical Site/Sector are genuine photograph-plus-app graphics, NOT AI output. New paid jobs carry an immutable historical marker, before-works-only instructions and coverage protection. Must generate/inspect a real historical AI Sector separately. |
| AI-MAP-049 | Contours/profile could imply survey precision | Open, separately staged | Five-point SRTM slope is indicative, not contour evidence. Historical notes retain the unavailable-contours state and regional wind/fire assumption qualifications. Investigate authenticated DEM data, resolution, datum and accuracy before adding profile/contours; do not invent dense surveyed heights from sparse samples. |
| AI-MAP-019/026/033/036/042 | Canopy clipping, bed geometry, rejected oblique, tunnel cover and excavation depiction | Open carried forward | No claim that a photo registration or good exact overlay resolves paid painted feature fidelity. Existing failed examples are retained. |
| AI-MAP-034 | Fresh app-owned Zones composition | Provider output exists; visual review outstanding | Normal owner request completed with Reference Blueprint/aerial. Do not approve before enlargement and comparison. |

## Verification

- Typecheck and focused render checks run in required order; terminal totals and current-head CI/build evidence recorded on PR/issue #35.
- Actual native production-helper output inspected: historical Site and Sector at high export quality. Site pins now sit on their photographed features; Sector uses the same photo/frame, preserves two separate roofs, shows qualified regional analysis and condensed provenance. Photo tips are blank. Native Arial fallback can differ from browser fonts.
- Before/after serialized frozen scene equality asserted while rendering both historical sheets. Roof fit checked at Standard and High quality; real source hash checked; other/schematic sites rejected; historical coverage and marker crop tests execute actual production helper bodies. Old prompts do not acquire a historical baseline.
- Previous gallery viewer checks: nine images × 390×844, 820×1180, 1440×900 loaded without overflow. This is browser viewport evidence, not physical iPhone/iPad testing and not a historical-release UI pass.
- Full suite runs independently in CI; no full-suite pass asserted. Paid quality claims distinguish fresh provider output from free recomposition and exact photograph overlays.
- This changes the picture. `PLAN_VERSION` v93 and recipe r8 unchanged. No measured design edits.

## Next continuation

Release after current-head rules, focused-render and preview succeed; verify the live source switches and Site/Sector exports on three viewport sizes. Generate one historical AI Sector normally and inspect it against its exact photograph baseline. Then continue DEM/profile investigation with its own evidence and checks. Review downloaded fresh Zones and update the gallery with the better aerial Phasing; keep the failed plain candidate separate.
