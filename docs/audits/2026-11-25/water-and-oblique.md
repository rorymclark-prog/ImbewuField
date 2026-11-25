# Water routes and oblique access — 25 November 2026

Codex continued the [twelve-map review](all-design-maps.md) from production revision `3d16f605a5650ac302ce72580408fb5d23662270`. The changes on `codex/water-oblique-legibility-20261125` affect the Water sheet and the input to the Whole Design oblique. Saved measurements and feature placement are unchanged.

| Finding | Evidence and result |
| --- | --- |
| AI-MAP-088 · Water pipework | The full-polish finisher restored labels but left all network lines to the model. New app-composed Water polishes ask it to paint the ground under the pipes. After normalizing the map crop, the app draws buried pipe, drip emitters and greywater from the frozen design. Water routes have a slim light outer stroke. Swales keep their earthwork treatment. The difference check uses the painting before this new ink. |
| AI-MAP-088 · Saved jobs | Overprinting the archived painting during visual inspection showed a second line where the model had shifted the old pipe. Previous full-polish jobs keep their original composition. The new overprint requires the corresponding instruction in the frozen job prompt. Satellite Overlay keeps its model-authored page contract. |
| AI-MAP-085/086 · Oblique | The previous reference marked tanks, hives and roof orientation but omitted the gate and the paved outline from its angled annotation layer. The board now locates the recorded gate with a diamond, outlines each saved patio and draws the saved driveway trace on the angled panel when one exists. Ubhejane has a nine-corner play slab and a separate garden gate. The adjacent road is photographic evidence. No vehicle approach is extrapolated from the gate. |
| AI-MAP-081/082 · Earthworks | The current guide already shows a single bank downslope, a broad banana-circle rim surrounding a hollow and a distinct raised tree-basin centre. Chrome redrew the production material painters with the site's indicative fall. Comparison against the older paid painting still needs fresh model output to establish model fidelity. |

The owner’s local map review contains the actual before/after Water ink drawn on the same registered photo, the angled guide and the enlarged soil details. These are free rendering checks. The archived Water painting and paid oblique were inspected separately. No new provider images were requested.

## Verification

The local typecheck, focused map tests and whitespace and release-note checks are recorded in the PR. A regression exercises actual Water composition on new and legacy jobs and checks that app ink is excluded from the paid-difference input. Another exercises an indented patio beside a gate without a driveway or photo. Chrome rendered the changed painters with the saved site geometry. The rendering review changes the picture. Issue 35 tracks preview and production verification.

## Next continuation

On the next authorized paid image, compare the oblique against the marked slab and the photographed entrance near the storeroom. The garden gate is a separate landmark. On a fresh Earthworks painting verify the single downhill crest and banana-circle rim against the guide.
