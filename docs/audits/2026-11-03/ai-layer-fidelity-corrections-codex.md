# AI layer fidelity corrections — 2026-11-03

- Auditor: Codex, following Rory's request for a deeper review and implementation.
- Reviewed revision: main `8a12b3ef9747807cacbc2c6e4ff0255cf223fe81` plus branch `codex/ai-layer-fidelity-corrections`; release SHA/checks belong to its PR and issue #35.
- Deployment inspected: production at the revision above; revised output inspected locally using the actual compositor. Release/live provider follow-up is recorded in the PR ledger.
- Previous audit: [Nine actual AI outputs — 2 November](../2026-11-02/ai-layer-output-review-codex.md). Carries AI-MAP-019/024–038 forward.
- Scope: all nine actual top-down images, their source/finish contracts, style/underlay recommendations, exact-versus-AI provenance. Rejected oblique is retained as a separate unresolved finding.
- Evidence: actual paid images, frozen job scenes, source review, executable production-helper tests, native-canvas recomposition. No private imagery, job records, credentials or account identifiers committed.

## What was already done

The earlier gallery proves nine outputs exist; it does not prove they are all satisfactory. This review compares those images and their composition paths rather than requesting nine identical new paid passes. Water/Planting/Whole retain their existing paid artwork. Site and Sector can be recomposed from already-paid raw artwork without another model charge. Saved geometry is never edited.

## Layer-by-layer review

| Sheet | Observation and disposition |
| --- | --- |
| 01 Site | Recognisable site and painted ground, but the finisher covered paid roof materials with flat exact symbols. It also printed an Exact-plan footer. Painted styles now use the same material policy as the design layers, retaining boundary, factual labels and inventory. Photo Plan keeps source-material restoration. Actual frozen-scene recomposition inspected. |
| 02 Sector | Most obvious regression: a desaturation/contrast filter plus cream wash dulled the paid painting. The default mask also restored photo strips along effort-zone edges, producing ghost bands. Remove both from AI artwork, leave exact analysis quiet, preserve photographed roof/access areas and draw the measured analysis afterwards. Recomposition visibly removes the bands and retains the painted landscape. Boundary key now matches its green post-and-wire line. |
| 03 Zones | The prior model-owned page has a false 20 m scale and altered roof form. Top-down Zones now offers app-owned styles only. New input contains site context without coloured zone bands; the app burns the real regions, badges and calibrated scale afterwards. It must still run AI. Old model-authored pages are preserved, not relabelled as corrected. Fresh provider output remains required. |
| 04 Water | Retained actual artwork has distinguishable tanks, routes and destinations, a white key and app-owned scale. Dark exterior and dense notes reduce thumbnail readability; inspect enlarged. Do not add a second wash or replace it with SVG. No fresh provider quality claim. |
| 05 Earthworks | The aerial result improves on the failed plain courtyard roof and shows nine bare beds. Pit rims and swales are too monumental; pale bed edging is unrecorded. Guidance now distinguishes symbolic pit positions from unspecified excavation dimensions and forbids invented masonry/kerbs. Existing painted corner/width drift remains open. Keep aerial context by default for Reference Blueprint because the actual plain test invented a courtyard roof. |
| 06 Planting | Retained actual illustration is visibly painted and provides the most detailed per-plant key/codes. Dense labels need enlargement; source-photo transitions and exact painted canopy/bed placement remain review items. No change to species or measurements. |
| 07 Structures | Labelled shade tunnel lacks a convincing cover. Both active prompt vocabularies now share one explicit mesh-over-crops description, distinct from a solid building roof or open vegetable bed. This input correction still needs fresh provider inspection. |
| 08 Whole | Retained top-down result remains recognisable and richly painted; grouped key avoids per-plant overload. Do not use the rejected oblique as its substitute. Painted bed/canopy fidelity is not certified by the accurate labels. |
| 09 Phasing | Its old input already contained finished SVG trees, beds and numbered pins; its finisher pasted exact glyphs over the model again. New jobs use unlettered Whole-style placement guides with design/footprint facts. New artwork retains painted materials while pins, boundary, scale and the complete schedule remain app-owned. Both new stages carry a frozen prompt marker; old jobs retain their original recovery contract. Schedule text is still structurally excluded from every upload. |

## Findings and disposition

| ID | Problem | Status / evidence |
| --- | --- | --- |
| AI-MAP-019 | Boundary canopy/physical-feature clipping | Open. Existing foreground extraction retained. Northern Earthworks pit partly cut at the boundary is also visible; a pit must not be treated as green foliage or silently assigned a new excavation diameter. |
| AI-MAP-024/025 | Courtyard roof invention / Earthworks stage | Current aerial result improves these specific examples. Retain aerial Reference Blueprint recommendation; no universal provider guarantee. |
| AI-MAP-026 | Painted bed geometry differs from saved rectangles | Open. Current aerial image visibly has nine beds, but rounded corners/widths and gaps are not exact SVG geometry. Footprint register remains in the prompt; no claim that words certify compliance. |
| AI-MAP-029 | Nine AI outputs versus nine acceptable outputs | Availability verified; fidelity work remains open. Do not call all nine quality-approved. |
| AI-MAP-033 | Rejected oblique rearranges the site | Open; no reconstruction fix claimed in this focused top-down release. |
| AI-MAP-034 | Zones model owns an unreliable scale and roof reconstruction | Implemented for new requests; fresh provider verification required. Picker and route normalize the same unsupported style. Exact zone overlays remain mandatory. |
| AI-MAP-035 | AI Site prints Exact Plan provenance | Verified in local actual recomposition: AI review footer now appears; free exact Site retains its original Exact-plan footer. |
| AI-MAP-036 | Shade tunnel missing its mesh cover | Input correction implemented; provider result unverified. Shared material description tested on locked, showcase and Satellite Overlay paths. |
| AI-MAP-037 | Phasing reads as SVG over a photograph | New input and finisher implemented; fresh provider output required. Historical raw artwork itself copied glyphs, so merely recomposing that old raw output is not evidence of a successful new painted garden. |
| AI-MAP-038 | Stale sheet help and styling captions | Implemented. Selected sheet names styling; Phasing has its own AI preview explanation and correct sheet number 09. |
| AI-MAP-039 | Sector paid colours hidden and photo-zone ghost strips restored | Verified local actual output. Removing the colour filter alone was insufficient; disabling effort-zone restoration removed the visible bands. Executable mask test separately checks editable zone edge/exterior and protected roof/access. |
| AI-MAP-040 | Paper-oriented styles inherit an unsuitable aerial background | Implemented recommendations. Field Ledger/Extension Blueprint start plain on design/Phasing sheets; Site/Sector retain factual imagery. Zones starts plain. Explicit background choices survive later style changes. These are starting choices, not a provider accuracy guarantee. |
| AI-MAP-041 | Site finisher covers painted buildings with exact slabs | Verified local actual recomposition. Uses shared composition policy; a production-callback test proves painted styles skip stamps while Photo Plan retains factual source materials. |
| AI-MAP-042 | Earthworks infers deep/rimmed pits and new bed kerbs | Input correction implemented, result verification required. No new excavation dimensions or farming advice introduced. |

## Verification

- Ordered typecheck clean. Focused render checks: 616 pass. Additional Phasing/Sector/shade-cloth/canvas/simple/export checks: 64 pass. Release-note/notice-localization checks: 49 pass. Four announcement translations are explicitly unreviewed [machine drafts](ai-map-release-drafts.json). Whitespace clean. Full suite runs independently in CI; no full-suite pass claimed here.
- Local native recomposition uses the actual production helper bodies, actual already-paid output and each job's frozen scene. Assertions confirm serialized scene equality before/after. Site/Sector revised outputs inspected; Phasing new guide input inspected without schedule/pins. Historical Phasing recomposition is explicitly not a new provider result.
- Prior 390×844, 820×1180 and 1440×900 viewer checks remain historical evidence. New live viewport/provider checks belong to the release continuation, not an implied physical phone/iPad pass.
- Tests revised upward from obsolete contracts: inviting Sector roof drift; freezing Zones photo strips; offering model-owned Zones scale; style-click inline implementation. New tests execute actual callbacks/mask painters. No paid gate, assertion strength, access rule or security workflow removed.
- **This changes the picture and its input/default choices.** PLAN_VERSION v93 and recipe r8 remain unchanged. Old paid bitmaps are preserved.

## Next continuation

After current-head focused-render, rules and preview pass, release this focused change and inspect bounded fresh requests through the normal signed-in owner flow: Phasing, Zones, Earthworks and Structures. Preserve failed candidates, compare against exact plans, record actual outcomes, and update the private comparison gallery. Do not silently approve unresolved feature/canopy fidelity or the rejected oblique. Publish terminal deployment and QA evidence on the PR/issue #35.
