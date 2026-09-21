# Design teaching preview — implementation and review

21 September 2026. Branch `codex/design-worked-example`, stacked on draft PR488. This branch exposes the eighteen source manuscripts as a reading preview; it does not claim the full measured example is complete.

## Implemented

- `/student/design`: six-stage outline and connection to the existing technical course, app guides and finance preview.
- `/student/design/d1-1` through `/student/design/d6-3`: all eighteen explanations, worked decisions, practical tasks, checks and evidence criteria from the manuscripts. Answers remain in a disclosure so the learner can try first.
- `/student/design/case`: complete current CASEBOOK text and three evidence-classification/discussion exercises. Feedback stays in page memory; no assessed progress or farmer records are written.
- My Studies entry clearly labelled English teaching preview.
- Existing approved homestead planning illustration reused. Its paper drawing is explicitly illustrative, not a surveyed version of the practice case. No animation change.
- Reproducible source extraction with manuscript hashes and exact `--check` comparison. Source limitations and the incomplete measured example stay visible in the reading preview.

The preview uses the existing safe manuscript renderer and Studies visual styling. There is no second assessed-course registry, credential or completion calculation. Narration, translated versions and offline packs are not supplied for this pathway yet; the interface says so.

## Original plan sources inspected in this pass

| File | SHA-256 | Evidence found | Consequence for teaching |
| --- | --- | --- | --- |
| Ubhejane Creche - Permaculture Design.pdf | 5e00064aff94abf10f7981086d7ff69de37775890841a8e240c7645ad2c7303f | Single A3 page, rendered and viewed. Planting plan with buildings, beds and leader labels; no reliable scale/dimension basis visible. | Useful historical visual reference; not a source of invented dimensions or newly approved species. |
| Ubhejane Creche - Permaculture Design Report.pdf | Same hash as the file above | Byte-identical, despite the different filename. | Not a separate narrative design rationale or independent measurement source. |
| Veg Garden CAD Example.pdf | 6f9dd66d417abba3e814a9b170803fd491224bf76df396544866f1b9fdcb1f3c | Single page, rendered and viewed; titled Smallo Daycare. Red dimension annotations are visible but no explicit unit/scale was found on the rendered sheet. | Do not silently assume metres or reconstruct geometry as a verified site survey. Historical planting legend is not imported. |

The earlier RVCC-embedded Mzamoyethu planting and hydrology drawings remain useful examples of connected layers. Their inspection and original extracted copies are preserved in the external recovery folder. No source PDF, historical planting list, aerial image or private project record has been published with this branch.

## Still required

The complete measured worked example and plan set, genuine alternative layouts tied to a common source pack, a later-evidence revision exercise, task-specific visual demonstrations, practitioner/learner review, fluent isiZulu review, aligned narration and offline delivery. The absence of verified dimensions blocks claiming a completed measured example, not the teaching preview or other course work.

## Verification

Typecheck, full suite (3,660 tests: 3,659 pass, zero fail, one existing TODO), whitespace and release-note checks pass. Production build passes. All eighteen lesson routes return their exact authored titles and practice sections; overview and case return 200; unknown lesson returns 404. Local desktop overview and discussion-answer reveal were inspected. At 390px, the reading text and case feedback were visually inspected; document width and viewport both measured 390px. All three exercises were tried with wrong then correct answers; the corrected selection is visibly marked. Temporary browser viewport overrides were reset. These checks do not establish learner competence. Hosted deployment verification remains pending. The draft preview must not be represented as a finished or production-published course.
