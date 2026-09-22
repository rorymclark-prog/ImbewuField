# Plant Guilds lesson 3 — selected-support thinning

Slide 43's English narration and quiz distinguish thinning a selected competing
support from trimming a branch. The existing slide-27 pruning film leaves its
support standing, so it could not safely illustrate slide 43. This eight-second
silent diagram shows a whole selected above-ground support removed to a small
stump. Cut material stays separate from the fruit-tree trunk and access path.
The last stage keeps the opening visible and cues later observation of light,
moisture and regrowth. Below-ground roots remain visible: the cut does not
claim immediate relief from root competition. No species, spacing, number of
plants to remove, timing, yield or guaranteed response is added.

The language-neutral pictograms and stage numerals share one video and poster
between English and isiZulu. The 32-second slide narration plays separately;
`playOnce` holds the final frame after the eight-second clip. The media is a
controlled illustration, not field footage or evidence that a particular tree
should be cut. Slide 44's shade/open-edge choice keeps its still; the existing
carry film now belongs to slide 45, whose narration says to carry useful
prunings back to established trees.

Build from the repo root with
`python3 docs/media/studies-animation-quality/render-guild-thinning.py`.
The builder uses Pillow and ffmpeg, costs zero Google Flow credits and writes
only `public/course-animations/plant-guilds/thin-selected-support.mp4` and
`public/course-animations/plant-guilds/posters/thin-selected-support.jpg`.
The reviewed output is H.264, 1280×720, eight seconds, video-only. At this
checkpoint the MP4 is 48,896 bytes (SHA-256
`2278bc717b8b9fcf48b5c62623e506d9ed938873f64861a90d51d479ba517dda`);
the poster is 86,805 bytes (SHA-256
`a4a5b624cf92ea148ea90fed7aac42a1fa13912f80b25eea59bffa4e0835a5e3`).
Start, middle, end and 390px frames were inspected. In the local 390px Student
player, the MP4 loaded with `readyState=4`, no media error, `loop=false` and
`ended=true` on its final frame. Deployed preview and offline checks are
recorded in the lesson review.

The distinction between [pruning branches and thinning whole trees in World
Agroforestry's tree-management guide](https://apps.worldagroforestry.org/Units/Library/Books/Book%2006/html/7.3_tree_mngment.htm?n=80)
supports this visual choice. [Penn State Extension's tree mulching
guide](https://extension.psu.edu/mulching-landscape-trees) supports keeping
placed organic material away from the trunk. These sources do not prescribe
which support to remove on an individual farm. Fluent isiZulu, farmer,
facilitator and local practitioner acceptance remains open.
