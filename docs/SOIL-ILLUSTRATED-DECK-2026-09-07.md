# Illustrated Soil Health and isiZulu draft decks

Soil Health now has 18 illustrated teaching fronts plus its existing cover. Nine wordless
illustrations and one deterministic jar-layer drawing support those fronts. Some scenes are reused
for the explanation, demonstration and field assignment where the action is the same.
Slide 13 retains its reading card until there is a verified wattle-pod identification reference.
The other eight modules still need illustrated teaching fronts; their English reading decks and
covers remain available. This is not a completed-course release.

Rory corrected the compost construction: both building and thermometer scenes now show square,
layered heaps with flat tops. The animation handover's starting image and prompt also carry this
requirement, including the parked wheelbarrow. The shape is a practical teaching example, not a
claim that every composting method requires a square heap.

## Preserving the teaching sequence

The player discovers each `slide-NN-front.jpg` through the existing asset-size inventory. It shows
the illustration before playback, then retains the source SVG and every continuation as reading
material under the same recording number. Video playback remains opt-in. The facilitator exporter
also recognizes a front as an extra still, rejects missing readings and never changes block numbers.

`scripts/render-illustrated-fronts.mjs` uses the existing titles and caption excerpts checked against
their source blocks. Text stays outside shared artwork. `docs/course-production/illustrated-fronts.json`
records the image-to-slide mapping; `public/course-art/soil-health/` holds reusable optimized art.
Illustrations were generated with the built-in image tool using the Seeds/compost reference,
then composed into the existing cream, green-heading and amber-border slide layout.
The jar-layer diagram is code-rendered so the sediment order stays controlled.

## isiZulu review material

All nine modules have draft reading decks: **185 blocks across 306 frames**. Local titles now come
from the isiZulu script when the narration manifest has no local title. Long cover titles use the
adaptive layout so they cannot collide with the draft label. These files are under
`docs/course-production/isiZulu-drafts/`, not registered as released isiZulu assets.

Regenerate with `node scripts/render-course-drafts.mjs`. The portable review file is produced by
`node scripts/render-course-review.mjs`; it embeds both languages and the English illustrated fronts.
It includes no audio or animation playback. Water and Soil scripts have source-change flags, and
all nine isiZulu scripts still need first-language review before activation or recording.

## Leachate correction

The former Soil Health text taught diluted worm-bin leachate as a general root feed without a
food-crop exclusion. The revised lesson, quiz and slide 17 distinguish leachate from castings and
say not to use it on food crops, even after dilution. This follows the
[UC Master Gardener worm-composting guidance](https://ucanr.edu/media/278410), which warns about
pathogens and phytotoxins in leachate and advises avoiding edible plants.
The old fixed castings-production time was also removed rather than illustrated as a guarantee.

English slides 3 and 17 and their isiZulu draft counterparts changed. The existing Luke recording
is withheld through the existing narration-hold mechanism, including full-track and language-fallback
paths. Replacement Leah takes remain subject to listening review. Automatic approval review blocked
the transfer to `speech.platform.bing.com` and requires explicit approval for that endpoint.
Only those two source hashes changed; the other 18 Soil Health takes remain unchanged.
The exact two recording texts are prepared in the separate narration-corrections file.
No replacement recording was completed or activated here.

## Visual checks and remaining limits

The 18 fronts were inspected together at a 400-pixel slide width, and the corrected compost scenes
and long isiZulu titles were inspected individually. Checks covered visible layers and heap shape,
hand and tool positions, open plant crowns, modest worm-bin feeding, separate castings, title fit
and caption placement. This is visual review, not a complete agronomic audit of every source claim.
Compost maturity/temperature claims and the wattle guidance still need fuller source review.

The source-paragraph check retained every isiZulu paragraph across its numbered blocks. The portable
review file was checked for all nine modules, ordered blocks and complete embedded image data.
Actual browser interaction remains unverified: downloading the missing Chromium binary failed with
HTTP 502. The existing React player tests exercise front selection, readings and media events.

Remaining course work includes the other eight illustrated decks, the wattle-pod reference,
reviewed isiZulu teaching fronts and audio, the 12 Rory clips and visual refinement of the
16 Codex process animations. Completed source and layout work is not evidence those are finished.
