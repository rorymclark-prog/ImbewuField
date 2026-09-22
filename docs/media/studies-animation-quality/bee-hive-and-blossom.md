# Bee hive-to-blossom visual candidate — 22 September 2026

Small Livestock lesson 2 slide 9 says to watch bees leave a hive and move
among flowering crops, carrying pollen between flowers. The original fourteen-
second authored diagram shows a bee moving from a hive among three generic
flowers, but its bee and flower contact are tiny at phone width. The recovered
eight-second Google Flow macro shows one bee walking through the anthers of a
single blossom. It does **not** show a hive, a second flower, a pollen deposit,
fertilisation, fruit set or a yield change.

The new muted clip uses the existing diagram, compressed into its first six
seconds so the route remains visible, then the recovered macro for about eight
seconds. A brief fade to black separates schematic explanation from synthetic
macro footage. The macro is visual support for flower contact, not scientific
footage proving that this particular bee transferred pollen. [USDA ARS](https://www.ars.usda.gov/oc/images/photos/oct19/d4114-1/)
describes pollen pickup at anthers and transfer during later visits; [USDA
NRCS](https://www.nrcs.usda.gov/conservation-basics/animals/insects-pollinators)
notes that deposition depends on contact with reproductive parts. The lesson's
existing text already qualifies crop outcomes; no transcript, quiz or audio
was changed. A hive-to-crops arrow must never be read as pollen originating
at the hive.

Source assets and SHA-256:

- Existing authored diagram `watch-09-bee-pollination.mp4`:
  `d035b535946c66625f7e984dbbabaecc70f1653a3ec56e9df3084d9896a4e857`.
- Recovered prior Flow export
  `/Users/roryclark/Downloads/Honeybee_walking_on_apple_blossom_20260922010847.mp4`:
  `a7cfe1afd00bd5ac9fa9098a3ad3ffe166bd7c84e190095d4c41437268d3c153`.
- Registered candidate `public/course-animations/small-livestock/bee-hive-and-blossom.mp4`:
  `caa29d23598bf79e6774707abb66260f68024b3853006ac379abfe65be5fec97`,
  1,330,202 bytes, 13.750 seconds, 1280×720 H.264, no audio.
- Matching poster `posters/bee-hive-and-blossom.jpg`:
  `4c6ff606a686b220fbe393e86eb27ee3ac21152abaed6e56fb1f87591cf6dfcf`,
  91,884 bytes.

Reproduction: trim the original concept diagram to fourteen seconds and set
its video timestamps to `6/14` of their duration; use all eight seconds of the
recovered macro. Scale/pad both to 1280×720 at 24 fps and join them with an
FFmpeg `xfade=transition=fadeblack:duration=0.25:offset=5.75`, dropping audio.
Encode H.264/yuv420p with faststart; the final data-saving pass used
`libx264 -preset slow -crf 23` rather than the larger CRF-18 prototype.

Full motion, source-size and 390px contact views were checked. The bee's
legs/body contact the anthers and central flower area; no obvious anatomy,
object continuity or frame break was found. The diagram still supplies a
conceptual route, while the macro shows one flower visit only. Neither visual
alone proves between-flower pollen deposit. The current English narration
lasts 8.352 seconds; the silent movie ends after 13.750 seconds, close to the
original fourteen-second visual duration. No new Google Flow credits were
spent. Human, beekeeper, learner and fluent isiZulu acceptance remain open.
