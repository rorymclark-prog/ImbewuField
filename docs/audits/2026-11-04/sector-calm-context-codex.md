# Sector context and analysis graphics — 2026-11-04

- Auditor: Codex; subsequent visual review by the coordinating chat.
- Reviewed revision: `codex/sector-calm-context`, based on `cbbce7f1116ff56277aa4b480f293846152aebf0`; local implementation verified below; release pending.
- Deployment inspected: none for this change. The native exports below are drafts, not live output.
- Previous audit: [Downhill sections and Sector finish](../2026-11-03/downhill-sections-sector-finish-codex.md). Carries AI-MAP-058/059 and the open historical coverage/registration qualifications forward.
- Scope: illustrated Sector background/annotations/key and its unannotated-artwork polish handoff. Existing Site, exact Sector, terrain calculations, providers, worker execution, spending gates and saved geometry are unchanged.
- Evidence: actual native compositor, frozen owner scene, existing paid first-pass artwork, saved Terrain-RGB raster, source review and digital A4/screen previews. No paid request was sent.

## What was already done

The archived Existing Site image remains the default with area names and a numbered alternative. The historical Sector first-pass illustration was already available. Rory rejected its busy backdrop and weak analytical marks after the earlier lighter finish. This continuation compares real outputs, rather than treating the earlier green tests as proof of visual quality.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-058 | Sector artwork competes with sun/wind/fire analysis and an oversized-looking key | Implemented and inspected locally; release pending | Same frozen image and frame in paper and muted candidates. The first paper sketch washed away the classrooms/road; a second used only registered roof corners and archived feature symbols but lost recognizable site fabric. Selected muted artwork keeps buildings, slab, road and fence. Strong directed warm/cool solar arcs, compact suns, dashed flowing wind, separate red flame/parallel dashed fire ray, white label plates, tighter row/heading padding at the prior readable type size. The comparison's tiny candidate-2 key was rejected. |
| AI-MAP-059 | Contours must be distinguishable without becoming a new design line | Retained and locally inspected | Same regional 5 m paths and 330/325 m elevations, with larger illustrated-sheet captions. Exact typography is unchanged. No new DEM or survey accuracy is claimed. |
| AI-MAP-063 | A cropped Hybrid Sector map contains analysis marks; the polish prompt asks the model to redraw them, then the app draws them again | Implemented and contract-checked; release pending | Sector now retains its accepted pre-annotation artwork for the same existing revision-checked handoff. Missing/mismatched raw artwork stops before enqueue. The polish prompt names its actual first-pass input, forbids lettering and all analysis, and leaves all analysis to one app composition. Base retains its separate crop route. Both raw and retained paid-difference checks remain intact. |
| AI-MAP-064 | Rain drops scatter beyond the SW wind into the solar band and blank photo coverage | Implemented and visually inspected locally | No loose drops on the illustrated sheet. Both its SW label and matching legend retain the sourced driving-rain claim. Exact technical rain marks are unchanged. |
| AI-MAP-042/026/019/033/051 | Other sheet fidelity, canopy, oblique and editable archive labels | Open, carried forward | This Sector-only work does not certify the other illustrations, legacy model-authored pages, a new provider result, or a physical device. Existing paid jobs with marks already baked into their raster cannot be reliably de-annotated by this deterministic pass. |

## Comparison and provenance

Local review folder: `/Users/roryclark/Documents/Codex/2026-11-04/sector-review/`.

- `paper-candidate.png` and `muted-candidate.png`: first actual comparison, identical 3462×2448 sheets/crop/scale and factual overlays.
- `paper-candidate2.png`: selective archive diagram, considered and rejected as the default because the source fabric is less recognizable.
- `muted-candidate2.png`: rejected small legend; not the selected treatment.
- `sector-muted-selected-draft.png`: selected final native export, SHA-256 `1e2bfa9a8523633a0fb616ea3079111d306670af5fe6800f2aecebe84dcc7212`.
- `sector-muted-1123.png`: A4 landscape-sized digital preview at 96 CSS pixels/inch; `sector-muted-1500.png` is screen review; `sector-muted-390.png` is the whole-sheet phone thumbnail, which needs zoom to read detail. No physical A4 print/phone/iPad verification is claimed.
- `sector-exact-reference.png`: before/after exact export is byte-identical in the same harness, SHA-256 `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`.

The selected export is an app-authored presentation refinement of previously paid AI artwork. It is not a new AI generation. No point, bearing, crop, measured geometry or archive control is changed. The whole composed sheet remains 3462×2448. Serialized frozen scene is asserted unchanged by the native harness. Blank archival coverage remains blank.

The design rationale follows [Esri's visual hierarchy guidance](https://www.esri.com/arcgis-blog/products/arcgis-online/education/visual-hierarchy-for-maps): context is subdued so thematic marks lead. The choice itself comes from the actual comparison, not from that general recommendation. The diagram candidate is a deterministic archive-derived drawing, not a model-created illustration or a new ground survey.

## Verification

- Typecheck: clean (`npx tsc --noEmit`, Node 24).
- Focused render: 638 passed, 0 failed. Affected Sector/prompt/release tests: 42 passed, 0 failed. Executable probes retain actual solar rise/set/noon sweeps and wind endpoints at screen and print widths, keep unknown coverage white, and refuse a missing/wrong-sheet raw polish input.
- The first focused run exposed old claims that Sector must retain full contrast and crop its composed Hybrid. Those claims conflict with the approved muted treatment and the reproduced double-mark defect. Their tests now execute the real context painter and assert the raw-Sector-versus-cropped-Base split. No assertions were deleted to hide a defect.
- Full suite: inherited Water head `cbbce7f11` completed unchanged, 6,381 passed, 0 failed, 1 existing shape-sync TODO, exit 0. No new full result claimed for this Sector head.
- Whitespace: `git diff --check` clean. Release-note checks run after the note stamp.
- Output inspected: selected native full sheet, 1123×794 A4-sized digital preview and screen exports; previous exact/native output compared byte-for-byte.
- This changes the picture. PLAN_VERSION and recipe counters are unchanged. No new provider request, schema, permission or billing change.

## Next continuation

Finish affected checks, release notes and current-head rules/focused-render plus preview. Merge only after its Site → Zone → Water dependencies, preserving the existing release jobs and their real results. Verify the normal owner's free reassembly/export on the deployed build and retain the separate Water under-review marker. Do not call this live until that verification exists.
