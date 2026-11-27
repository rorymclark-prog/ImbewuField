# Saved illustration review — 27 November 2026

Codex reviewed the saved-map flow against main `08a1239bf`. This follows the [original-plan comparison](../2026-11-26/saved-plan-comparison-a4.md). AI-MAP-097 and AI-MAP-098 retain their previous dispositions.

| Finding | Change and checks |
| --- | --- |
| AI-MAP-099 | Review notes needed a location on the actual saved illustration, including an oblique. Positions use fractions of the image inside the fitted viewport. Device storage tests cover account and farm isolation, adding two notes, stale edits, thumbnail updates, and removing one note. A correction render reuses the frozen original input, mask, prompt and style. Only selected notes and a numbered reference are submitted. An explicit one-pass paid confirmation precedes the existing queue. |
| AI-MAP-100 | An earlier illustration could say that it came from an older design without identifying the edits. The new comparison groups additions, removals, moves, changes of shape and changes of details by feature. Tests exercise a moved tank, two new beds, a removed fence, account/site boundaries, and satellite and paper reframing. |

Provider request tests inspect the OpenAI and Gemini inputs. The original design remains the primary reference. Numbered review pins are attached to the secondary illustration. App-owned schedule text is blanked from the Phasing reference. Account access, quotas, existing masks, and raw input/output checks still govern paid jobs.

The browser and production release evidence is recorded on the PR and in issue #35. Test screenshots of the private site stay outside Git. The design geometry and plan version are unchanged.
