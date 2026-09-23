# Vegetables and Staple Crops lesson 2 — Succession Planting and Intercropping

**Checkpoint:** 22 September 2026, deployed English sample build `0f505fe`;
updated 23 September 2026 for two still-only clarity replacements. This lesson
is module slides 8–11, four narrated stills; it has no registered Watch movie.
The original media was inspected at full size and in the 390px deployed learner
player. The lesson played in order to slide 4, “Plan Backwards From Your Hungry
Gap”, with “Play lesson” restored and Next disabled. English audio on observed
slides reached `readyState=4` without a media error. The new slide 9 and 11 stills
reflow only their existing visible sentences into larger type; slides 8 and 10
are unchanged. The new stills were inspected at full size and at a proportional
269 × 151 render. That is a local image-fit check, not a deployed player or
physical-phone recheck. Slide 10's maize/bean/pumpkin image communicates the
relationship but is not evidence of a particular local spacing, timing, survival
or harvest. No new movie is warranted by a concrete media failure in this
English lesson.

## Static readability replacements — 23 September 2026

Slides 9 and 11 were the only stills with teaching text too small to read at the
269px fit. The two replacements preserve the exact title and visible statement
wording from each previous still, in the same order. No body, quiz, narration,
audio, crop/species name, interval, claim or lesson meaning changed. The
deterministic renderer is
[`render-vegetables-l2-readable-stills.py`](render-vegetables-l2-readable-stills.py).
It writes only the two English JPEGs. Slide 9 is 1920 × 1080, 244,029 bytes,
SHA-256 `bcae1eaba6e1b198d1f4e15a51c9b15914afe7d72104993a761ca155671232e7`;
slide 11 is 1920 × 1080, 261,180 bytes, SHA-256
`b2bb6092e21bb29c5d91bf817240181efed1301059b3465a2aacfc0c9dee4601`. The
offline size manifest was regenerated. A one-time worker migration clears only
the previous English slide 9 and 11 stills, including query variants, while
preserving all other saved lesson media; learners choose when to download the
replacements. No post-deploy or offline-pack check has yet been made against
these new files.

The English body and two quizzes retain the safeguards that a sequence of
sowings **may** reduce risk but cannot guarantee a harvest, that the first
batch need not be ready by the fourth sowing, that intercrops can compete, and
that nitrogen in bean residues is released during decomposition. The
[USDA National Agricultural Library's Three Sisters account](https://www.nal.usda.gov/collections/stories/three-sisters)
supports the Indigenous American provenance and basic crop relationship.
[University of Minnesota Extension's legume residue guidance](https://blog-fruit-vegetable-ipm.extension.umn.edu/2024/02/tips-for-spring-cover-crop-planting.html)
supports gradual nitrogen release as residue breaks down. No US planting
interval, spacing or climate recommendation is imported into South African
instructions by this check.

## Fluent isiZulu review required before localization

The unpublished [`vegetables-staples.zu.md`](../../narration/vegetables-staples.zu.md)
draft remains outside the English-only public deck/audio. It contains material
semantic differences from the English lesson. A fluent reviewer should repair
the translation against the protected English script, then check the resulting
slides, transcript, speech and learner understanding together:

| Slide | Current English boundary | Draft difference to resolve |
| --- | --- | --- |
| 8 | Separate sowings may reduce risk; no harvest guarantee under persistent difficulty. | Lines 188–189 imply the other sowings continue carrying the season after one fails. |
| 9 | Overlapping harvests depend on suitable crop timing; first sowing may not be ready by the fourth. | Lines 200–204 say the first sowing is ready when the fourth is planted. |
| 10 | Three Sisters is Indigenous American; crops still compete and need suitable space, water and light. | Lines 221–237 omit the provenance and say the three crops do not compete. |
| 11 | A household **may** have a hungry gap. | Lines 241–247 make it universal to every place. |

The same draft also has an obsolete slide 6 spacing claim at lines 144–147;
the active English lesson 1 instead directs learners to crop/variety guidance,
seed packets and local growers. That separate issue belongs in the same
translation review so it cannot later re-enter the lesson.

This is a technical English media/playback and source review, not Rory's,
fluent isiZulu, practitioner or learner acceptance. No public lesson copy,
quiz, audio, species list or media was changed for lesson 2.
