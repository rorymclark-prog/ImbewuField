# Zone map photo coverage — 2026-11-03

- Auditor is Codex. The voice review checked the original side-by-side proof.
- Reviewed revision is `004a6b955` on `codex/zone-photo-coverage` over `c06b77b`.
- Deployment was not inspected. The exact and AI outputs are local print-size exports from the production renderer.
- Previous audit is [Nine-layer fidelity](ai-layer-fidelity-corrections-codex.md). AI-MAP-034 remains the authority for the app-owned Zone scale and badges.
- Scope covers sheet 03 photo presentation and a read-only first look at sheet 04 Water.
- Evidence includes the frozen actual Ubhejane Zone and Water jobs, their existing paid image outputs and matching exact renders.

## Findings and disposition

| ID | User-visible problem | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-056 | Blurry bands at the top and bottom of the Zone photograph | Implemented and visually checked | The saved pan, rotation and scale define the photo footprint within the existing map crop. A white matte covers only the top and bottom strips outside a full-width rectangle inside that footprint. If the rectangle would hide plotted geometry or substantially reduce the image, the original imagery remains. Satellite and plain-paper choices do not receive this matte. The top compass and bottom scale stay inside the visible image. |
| AI-MAP-057 | Property markings compete with Zone edges | Implemented and visually checked | A quiet charcoal dash replaces the property ticks on the exact and app-owned AI Zone sheets. The key uses the same stroke. Both Zone 2 regions retain their numbered badges and the legend lists Zone 2 once. |
| AI-MAP-058 | Generic Zone 0 wording at the creche | Implemented and visually checked | The frozen design records a house polygon named Classroom and a patio polygon named Slab & Flat Play Area. Their centres fall in the same Zone 0 ring. The caption is Classroom & play courtyard for this case-study site only, when both saved features still support it. The other recorded roof is Storeroom, which is why Classroom stays singular. |
| AI-MAP-059 | The Water exact and AI sheets disagree on budget figures | Open | A same-frozen-scene comparison shows 105 m² and 12,500 L on the exact export, while AI-sheet notes show about 44 m² and 13 kL. These are reported outputs, not accepted measurements. The exact Water flow arrows and leaders are also absent from this illustrated reassembly. Reconcile the app's two footer calculations and decide the expected shared water markup before approving sheet 04. |

## Verification

- Typecheck, 637 focused render checks, the typography scale check and whitespace passed before the release-note commit.
- Inspected both Zone exports. The white strips remove the blur, the N clears the new edge and the fixed map viewport and scale retain the same site size. The source scene serializes identically after both exact rendering and saved-art reassembly.
- Inspected the separate same-scene Water comparison. No provider job was started and no saved geometry was changed.
- This changes the picture. PLAN_VERSION and the saved-job recipe are unchanged. Reassemble existing paid artwork to see the new finish once deployed.

## Next continuation

Keep the Zone release separate from the Existing Site and connector changes. Follow the current-head preview, focused-render, rules and release-note checks before merge. Inspect the canonical live exact and reassembled Zone outputs after deployment. Sheet 04 remains in review.
