# Existing Site label and legend symbols — 2026-11-03

- Auditor is Codex.
- Reviewed production revision is `c06b77bbf16308dea620551b9ff27f1812b8f35c`. The new symbol compositor is on `codex/existing-site-symbol-key`.
- Previous audit is [Historical area names](historical-area-labels-codex.md). Carries forward AI-MAP-046, AI-MAP-050 and AI-MAP-051.
- Scope covers archived Existing Site callouts, the sidebar key and label choice in Preview & Export.
- Evidence includes a production browser export and a native print-size render using the actual archive compositor and site scene.

## What was already done

The live Existing Site sheet starts with Area names. Numbered key yields eight numbered marks and matching full names in the sidebar. The original named sheet showed the names in both places but left the symbol slots empty.

## Findings and disposition

| ID | User-visible problem | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-046 | Direct names need a graphic key and the fence leader grazed the slab label | Implemented and visually inspected in a local render | Each named callout and its legend entry share a glyph. Both classrooms use the same building symbol. The fence has a solid brown line and the design extent a dashed green line. Dirt road uses a glyph on its callout without a traced road line. The fence leader clears the relocated slab plaque. |
| AI-MAP-050 | A selected saved map masked the new label setting | Implemented | Switching the photo labels clears the saved preview selection. Draw the Design Map to see the new selection. The two label-mode cache keys are separate. |
| AI-MAP-051 | Editing archive labels during design | Open | Photo facts still come from the existing archive annotations. |

## Verification

- Clean typecheck and 635 focused checks passed before release notes. The numbered production export and revised named local render were inspected. No physical phone or iPad check was made.
- The live Sector export on `c06b77b` uses the existing paid painting and shows brown 330 m and 325 m overview contours with a 5 m key. The separate live Terrain & Sections export shows intermediate contours and the A–B downhill and C–D classroom cuts.
- The full test on #1192 reported an existing shape-sync TODO and a Sector footer source-pattern assertion. The latter predates this branch, including on main `da61886c9`, where the exact footer remained boxed and the paid compact footer became separate. The current live Sector export was inspected for the actual note and key.
- This changes the picture. PLAN_VERSION is unchanged. No new paid job was started.

## Next continuation

Show the revised export for review. The Zone sheet has its own continuation and should retain separate comparison evidence.
