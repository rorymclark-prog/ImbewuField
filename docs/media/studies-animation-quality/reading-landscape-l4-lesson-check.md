# Reading the Landscape lesson 4 — learner check, 22 September 2026

## Decision and current media

Rory chose the existing still for slide 17, *Watch: Draw the Land You Already Have*. The rejected Google Flow mapmaking attempt is documented in `flow-x1-attempts-2026-09-22.md`; it is not in the learner player. No new SVG or code-drawn animation is approved. The still is a person-free, labelled concept diagram with a closed boundary and the words “Concept diagram — not to scale.” It is not a surveyed plan. If future images or animations show people, the casting direction is Black Africans in a South African smallholder context; appearance alone cannot establish identity.

## Live mobile player check

At a 390 × 844 browser viewport on `https://imbewufield-studies-animation-direction.vercel.app/student`, the English lesson opened as four narrated slides, 16–19. Automatic playback progressed to 4/4. All four slide entries and the 1/4–4/4 navigation were present. Slide 17 displayed `/course-decks/reading-landscape/en/slide-17.jpg` at 1920 pixels natural width, with **zero video elements** in the lesson container. Its `/course-audio/reading-landscape/en/slide-17.mp3` reached `readyState 4` and advanced to 9.47 of 9.67 seconds. Slide 18's mobile player image was visually checked: it clearly depicts a Black woman tending soil, with no obvious broken crop or layout. The full-size link was present for the still. These are technical and visual checks on the preview, not a physical-device, offline, language, learner or practitioner acceptance test. The still is readable at full size; small labels require the provided tap-to-zoom link on a phone.

## Source review hold

The protected lesson text, narration and quiz currently make two claims that need an editorial correction before this lesson can be called ready for farming use:

1. `lib/course-modules.ts:297` says to pace a boundary and sketch it “to scale.” Pacing without a checked ground distance and a map distance does not establish a scale. The slide 17 image itself correctly says “not to scale.” [Oregon State University Extension's mapping guide](https://extension.oregonstate.edu/catalog/pnw-581-land-surveying-mapping-introduction-woodland-owners) defines scale as a relation between map and ground distance, and distinguishes approximate property lines from a survey. Suggested farmer-facing correction for review: “Walk and sketch the boundary. Mark the sketch ‘not to scale’ until you have checked its distances.” Preserve any later measurement method only when sourced.
2. `lib/course-modules.ts:301` says thick khakibos or blackjack means disturbed **or compacted** soil; `lib/course-modules.ts:306–314` reinforces that inference in the quiz. [SANBI's khakibos account](https://pza.sanbi.org/tagetes-minuta) describes the plant as common on disturbed sites. A [controlled *Bidens pilosa* compaction experiment](https://www.scielo.br/j/pd/a/QnNZGq3Gs4CsTcDbfkjrVDs/?lang=pt) examined root performance under imposed compaction; it did not validate plant presence as a field diagnostic for compaction. The current conclusion overstates the evidence. Suggested correction for review: “Note where these plants grow thick. They can grow in disturbed ground, but their presence alone does not show whether soil is compacted. Check the soil directly.” The key point, narration and quiz answer need the same correction. Do not infer a soil treatment from plant presence alone.

These are source-supported concerns, not a practitioner sign-off. They also affect the English narration and the isiZulu draft (`docs/narration/reading-landscape.en.md` and `.zu.md`). The project's `AGENTS.md` reserves lesson bodies, quiz questions and rationales from routine Codex rewriting, so this check records the exact correction packet rather than silently changing those protected strings. Editorial ownership and practitioner/language review are still required. Until then, this lesson is **technically playable but not content cleared**.

## Verification limits

The September 20 `docs/media/reading-landscape/verification.json` records an earlier four-animation production pass, including slide 17. Its hashes and historical offline test remain useful provenance, but they are not current-player proof. This live check did not disconnect the tab or test the present offline pack. No Flow credits were used for this check.
