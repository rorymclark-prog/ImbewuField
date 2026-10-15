# Blender animation candidates — 2026-10-15

- Auditor and producer: Codex for Rory Clark.
- Reviewed base: `eea14cdf3d81758478947fe5580f49843599b952`; branch `codex/blender-lesson-review-2026-10-15`.
- Deployment: branch preview verification pending; no production release.
- Previous records: [Study offline wording close-out](../2026-10-13/study-offline-five-holds-codex.md), [blind-reviewed Study corrections](../2026-10-12/study-blind-reviewed-corrections-codex.md). Their language and authenticated-state findings remain outside this visual-production scope.
- Scope: six original Blender animation candidates at `/student/animation-review`, their silent media and explicit manual-watch behavior.
- Evidence: current authored course source review; exact asset hashes and byte counts; complete media decode; saved-scene geometry checks; sampled actual export pixels. App browser and final test results are recorded below when available.

## What was already done

Rory asked for a substantial continuation of the media catalogue, more polished Blender graphics, a fixed-landscape teaching approach influenced by Geoff Lawton, and no synthesized voice. Earlier media drafts remain preserved in the local shared media workspace. Current app lesson bodies, quizzes, translations, narration bindings, learner-deck media choices and existing review holds remain intact.

The new page is an unlinked, no-index review destination. It does not release these candidates into lesson decks or change their playback timing. Each clip is 24 seconds: the old shorter narration timings must not be reused to synchronize them. The page assigns video `src` only after Watch, displays the exact file size and duration, and pauses other review players when starting another. All six app files are wordless and have no audio stream. No new runtime or plugin dependency is introduced.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MEDIA-BLENDER-001 | Rory dislikes the older synthesized narrator and wants clearer animation | Candidate review prepared | Six new silent app variants; old learner editions remain unchanged. Rory still needs to review the proposed visuals. |
| MEDIA-BLENDER-002 | A richer animation could lose the process in ornament or imply measured farm outcomes | Candidate mechanisms checked separately | Fixed cameras, four explanatory beats in portrait companions, retained source claims and independent saved-scene checks. Air and water motion are authored cues, not simulation or a site design. |
| MEDIA-BLENDER-003 | Opening six videos could spend mobile data before the viewer chooses one | Implemented; browser check pending | Poster-first players with `preload="none"` and no initial `src`; Watch names duration and exact MB. No autoplay on page load or looping. |
| MEDIA-BLENDER-004 | A plausible topic match could silently activate incomplete or mistimed learner content | Review-only | Manifest carries exact course/slide/lesson context. No `lib/course-*` or offline cache/pack authority changes. Wind and cold-air scenes are focused companions to broader slides. |
| STUDY-READING-COMP-003 | Exhaustive linguistic approval remains unproven | Carried forward, outside this scope | No translation or fluent/local-farming approval is claimed for this page or existing lessons. |
| STUDY-AUTHENTICATED-STATES-001 | Authenticated assignment/unlock screens lack learner proof | Carried forward, outside this scope | This review page is not evidence about those screens. |

## Verification

- Typecheck: final six-asset typecheck passed.
- Full suite: pinned Node 24 run and branch CI pending; the exact base has a successful Tests run. No tests were edited. The initial run exposed a missing shared MenuButton on this new route; it was added and all four menu coverage tests passed.
- Whitespace: `git diff --check` passed.
- Output inspected: current portrait export samples are retained in the local dated media batch; actual app preview is pending. Source or decode checks alone do not establish appearance.
- Context: shade → Reading slide 9 / L2; overflow → Water slide 7 / L1; infiltration → Water slide 4 / L1; mulch → Soil slide 14 / L3; shelter → Introduction slide 19 / L3; cold air → Reading slide 13 / L3.
- The [app media manifest](blender-animation-manifest.json), [decode/format checks](blender-media-checks.json) and [saved-scene checks](blender-scene-checks.json) beside this audit binds each delivered film to exact bytes, duration, topic and SHA256. The local production batch retains `.blend`, source/title layers, construction code, audio-free app variants and fuller edit specs.
- This changes the picture only on the new review route. `PLAN_VERSION` is unchanged. Existing learner packs and offline media remain byte-for-byte untouched.

## Next continuation

1. Review all six candidates with Rory at the branch preview; compare their mechanisms against the existing lesson.
2. Choose any learner use as a separate scoped change, retaining local-language context, site suitability and explicit download controls. Do not wire the 24-second clips to the old short narration timings.
3. Keep broader slides intact where a film addresses only one mechanism. This batch does not establish fluent-language, local farming or learner-comprehension approval.

Coordination is recorded in the local shared `handoffs/CLAUDE-CODEX.txt` desk. No email, chat message or issue comment was sent.
