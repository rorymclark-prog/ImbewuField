# Saved Water artwork and direct labels — 25 November 2026

Codex continued the [all-map review](all-design-maps.md) and [Water route review](water-and-oblique.md) from `46b57cea2` on `codex/map-audit-water-callouts-20261125`. The [Earthworks and oblique follow-up](swale-callouts.md) records the related site evidence and its limits.

## Findings and disposition

| ID | Evidence | Disposition |
| --- | --- | --- |
| AI-MAP-090 | The exact Water and first paid Reference Blueprint exports from the same Ubhejane revision have matching pipe bends. Only the exact drawing labels the tank sizes, taps, banana circle, drip line and buried pipe. At 393 × 852 in the production Chrome viewer the whole paid map fits, but the legend requires zoom. | The app now runs the exact Water callout painter over the finished artwork for the locked first stage and the app-composed second stage. Both retain clean comparison and second-pass inputs. Opening an old exported image alone cannot change its pixels. |
| AI-MAP-088 | The earlier Water audit said the finisher already restored labels. The new site exports confirm a pipe overprint and flow arrows, but directly contradict that label claim. | Keep the existing route treatment. Use this record for label coverage. |

## Verification

- Used the saved job's matching design revision, source photo, input, mask and model output. Replayed the production finisher with the local change in Chrome. Inspected the whole 3462 × 2448 sheet and compared the six callouts against the exact drawing. The tanks and beds remain visible. The registered job was a first-stage geometry-locked render. Second-stage coverage uses code and rendering tests.
- The 393 × 852 phone check was on the original sheet in the signed-in production app. Earlier public example checks at phone, iPad and laptop sizes are in the preceding audits. A browser simulation cannot establish physical iOS memory behavior.
- Typecheck and all 692 focused rendering checks passed, including the new Water label pass regression. Release-note drift and whitespace checks passed. Full application CI, preview and live free reassembly are tracked on the PR and in issue 35.
- This changes the picture. The saved geometry and `PLAN_VERSION` are unchanged. The owner has the original and reassembled images and the comparison in the local “Ubhejane paid Water 2026-11-25” folder. Private site images and job records are excluded from this repository.

## Next continuation

Verify free reassembly after release. Recheck Earthworks names and swales on each paid finishing stage, followed by the other supported sheet families and their location-dependent overlays. Use the twelve-view comparison to distinguish accepted site artwork from a sample or a historical revision.
