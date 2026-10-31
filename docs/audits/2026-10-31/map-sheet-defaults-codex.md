# Per-sheet AI starting settings — 31 October 2026

- Auditor: Codex, following Rory's instruction to check every map and select suitable settings.
- Reviewed revision: `codex/ai-sheet-fidelity`, integrated main `b2f071531`, local changes following `4dad5060b`. Release head and deployment evidence belong to PR #1160 / issue #35.
- Deployment inspected: production normal owner Google sign-in and saved Ubhejane site; preview `ce063df` cannot sign in with Google because its hostname is not authorised. No authentication configuration changed.
- Previous audit: [Nine-sheet fidelity review](ai-sheet-fidelity-codex.md), carrying AI-MAP-019/024–029 forward.
- Scope: presentation defaults, sheet navigation, style retention, input guidance. No saved geometry, schema, provider dispatch, worker, billing or access changes.
- Evidence: actual callback execution, all-nine policy matrix, local tests, earlier native input/render inspection and three-size viewer matrix. New paid output remains unverified at this checkpoint.

## What was already done

The previous audit's revised brown Earthworks image is the **AI input**, not a new provider output. The earlier four owned paid images and nine exact baselines remain available. White page/legend treatment and existing High AI quality are retained. Main's separately published field-block work was integrated intact; no field layout or crop planning code was changed here.

## Settings matrix

| Sheet | Starting underlay | Labels | Style / view |
| --- | --- | --- | --- |
| 01 Base | Own photo, otherwise available satellite, otherwise plain | Names | Reference Blueprint / top-down |
| 02 Sector | Same aerial preference | Names | Reference Blueprint / top-down |
| 03 Zones | Plain paper | Names | Reference Blueprint / top-down |
| 04 Water | Same aerial preference | Names | Reference Blueprint / top-down |
| 05 Earthworks | Plain paper | Codes | Reference Blueprint / top-down |
| 06 Planting | Same aerial preference | Codes | Reference Blueprint / top-down |
| 07 Structures | Same aerial preference | Names | Reference Blueprint / top-down |
| 08 Whole | Same aerial preference | Codes | Reference Blueprint / top-down |
| 09 Phasing | Same aerial preference | Names | Reference Blueprint / top-down |

Plain paper makes excavation and zone markings readable. Real imagery provides roof and existing-site context for other sheets. These are starting choices, not a guarantee that the image model preserves geometry. The existing routing authority supplies the default style; no second style default is introduced. Device print-resolution limits remain unchanged.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-030 | One sheet's background and styling silently carry to every other sheet. | Implemented; callback verified | Explicit navigation remembers each sheet's current underlay/style/labels/view in this open session, keyed by site and sheet. First visits apply the matrix above. The actual `chooseSheet` and `applySheet` callbacks are executed in tests, including manual overrides, same-sheet selection and busy navigation. No job is purchased by selecting settings. This is session memory, not durable synced account preferences. |
| AI-MAP-031 | Creating the exact baseline clears the chosen AI style before the next guided step. | Implemented; affected flow checks pass | Retain the style before Exact clears it; the guided AI flow falls back to that remembered choice. Existing stage-machine and paid-gate tests remain intact. |
| AI-MAP-032 | Phasing offers Satellite Overlay even though its top-down route substitutes Reference Blueprint. | Verified source/UI contract | Phasing now shares Base/Sector's supported top-down choices. Oblique still exposes all nine styles. The actual picker expressions are evaluated in tests against the route's supported set. |
| AI-MAP-019/024–029 | Canopy clipping, courtyard roof invention, Earthworks stage, bed drift and incomplete provider evidence. | Open / input corrections awaiting provider review | No input diagram or test pass is presented as a finished artwork pass. Continue with matching fresh outputs. |

## Verification

- Ordered `npx tsc --noEmit`: clean. `npm run test:render`: 606 pass. Affected UI/access/notice/release and integrated field-block tests: 91 pass. `git diff --check`: clean. Full suite is reported independently by CI; no full-suite pass claimed here.
- All nine recommendation rows checked with own aerial, satellite-only, satellite-fallback and no-image frames. Manual settings survive navigation; both desktop and compact selectors call the same callback. No paid-generation call from selection.
- Earlier exact/AI viewer fixtures cover 390×844, 820×1180 and 1440×900, including larger app text. These are browser viewport checks, not physical Safari certification. See the linked prior audit's 78-case record.
- Adding the new notice moved an older Oblique tour out of the five-line visible window. The merged field-block notice had one stop while the tour contract requires two visible stops; a relevant map-settings stop now accompanies the new notice. No test assertion was removed or weakened. Four translation copies are explicitly unreviewed [drafts](map-defaults-release-drafts.json).
- Normal owner login works on production. Preview Google login is blocked by its unauthorised hostname. Release the verified input/UI configuration only after current-head focused-render, rules and preview pass, then inspect fresh results through the normal signed-in production workflow. Do not widen authentication permissions for testing.
- **This changes the picture/input and its starting settings.** PLAN_VERSION v93 and recipe r8 remain unchanged. Prior paid artwork and saved measured geometry remain intact.

## Next continuation

Rory's latest instruction is to make every map work with suitable settings. Continue the previously described bounded test set: at most nine fresh single-pass renders, one per sheet, through the existing owner workflow and spending controls. No automatic new paid rerenders. Inspect each actual result against its matching exact plan, including bed corners/count, stage, roof/courtyard, canopy, key and labels. Record successes and remaining defects separately; publishing input/UI improvements does not close the AI quality audit. Production release and actual output evidence will be recorded on PR #1160 and issue #35.
