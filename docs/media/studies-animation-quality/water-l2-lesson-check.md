# Water Harvesting L2 English lesson check — 23 September 2026

## Coordinated English correction and deployed check

The source-held slide 12 sentence was replaced in the English narration and
generated transcript with: “Catchment runoff is one input. A suitably
qualified person must assess the site, dam and spillway design before
construction.” The heading now says “Dam and Spillway: A Concept” because
the slide is a still. The lesson body and quiz already require qualified site and
spillway assessment, so neither changed. [FAO's small earth dams manual,
sections 5.5–5.8](https://www.fao.org/4/i1531e/i1531e01.pdf) treats
catchment area as one input to yield and peak-flood calculations, alongside
rainfall/runoff, topography and catchment shape; the same-size catchments can
produce different peak floods. The manual separately discusses storage and
spillway dimensions. This is a general engineering source, not a site design
or a universal South African permission rule. No measurements were added.

A new static slide 12 uses three large concept labels and a short caption,
“Catchment runoff is one input. A qualified person must design the dam and
spillway.” It is explicitly not to scale and gives no construction dimensions
or safe-capacity claim. The primary agent inspected the 1920 × 1080 candidate,
the 269 px phone fit and the published JPEG. The fuller narration carries the
site-assessment instruction. The previously withdrawn code-drawn animation
stays outside the player; no Flow credit or SVG/code-drawn motion was used.
Slide JPEG SHA-256: `c43a6a2a1d2d3f99d913e526a57fc6ecc825d5f9df0ce3e100e0c5911316e63e`.
English slide-12 MP3 SHA-256: `8364b9c3b63bbfb1cc4afa5b3b65345b6bcc2343b394fb464a1bd557bdeb0d30`.
English full MP3 SHA-256: `af3739d359ab7da4448890e9e796af757bd060c132defcb248718104491ca4a3`.
The [audio verification](water-l2-english-audio-verification.json) records
exact normalized WordBoundary match, full decode, and a 456.648-second full
track equal to the sum of all 24 slide clips. Selective saved-pack migration
retires only this changed English still, slide MP3 and full recording, with
no automatic fetch. The [isiZulu L2 packet](../../narration-reviews/water-harvesting-l2.zu.review.md)
is review-only; no ZU learner content changed.

Local typecheck, 3,720 passing tests / 0 failures / 1 existing TODO, and
whitespace check passed. Exact-head CI `35850936852` passed both `test` and
`rules`; preview `35850936768` passed. At 390 px, the deployed sample
Student showed the corrected English lesson and existing quiz. Slide 12's
still loaded at 1920 × 1080 and its matching MP3 advanced beyond four
seconds with `readyState=4`. The diagram's small labels need narration and
the full-size link at phone width. The Water pack finished at 54 files /
12.2 MB and reported On this phone. After a network-disabled browser
reload, the Offline badge appeared; slide 12's still and MP3 reopened and
the MP3 advanced beyond four seconds without error. Network and viewport
were restored. This is one browser's technical check; human listening,
physical-phone, learner, farmer, qualified local dam designer and fluent
isiZulu approval are not claimed.

## Earlier media and source hold — superseded by the correction above

The following records the previous state and decision trail. Its slide 12
source hold and proposed wording are resolved by the English correction above;
the withdrawn animation remains held. No Flow credit was spent.

## Actual media and player

Lesson 2 is slides 10–13. I inspected all four full-size stills. Slide 10 is
a simple dam cross-section; slides 11 and 13 are sparse text cards; slide
12 is a labelled, not-to-scale concept diagram with a separate lower side
spillway. At 390 × 844, the deployed player showed each 1920 px still and
matching English MP3 at `readyState=4`; no video element appeared. The
slide 12 baked labels and bottom caption are very small at phone width, so
the narration and full-size still link carry the teaching there. A saved
Water module pack reopened slide 12's still and English MP3 after an
offline browser reload (`navigator.onLine=false`, `readyState=4`), with no
video element. The browser was restored online afterward.

The former 16-second silent dam/spillway candidate is an archived local
code-drawn concept animation. Its contact sheet was inspected, and the
learner MP4/poster are absent from `public/course-animations`. Rory's
visual-clearance rule keeps it outside the player; there is no cleared
replacement for this L2 slot. Keep the still pending teaching and visual
review. This media check does not establish the dam's physical or site
design correctness.

## Source hold and exact proposed correction

The lesson body already says dam siting and design need a suitably qualified
person and that catchment runoff, soil, foundations, downstream risk and a
safe spillway all matter. Its quiz tests overtopping and maintenance without
giving a dimension. Slide 12's bottom caption says, “Size the dam to the
catchment area draining toward it”; the same instruction appears in
`docs/narration/water-harvesting.en.md` and `lib/course-transcripts.ts`.
Read alone, this makes catchment area sound sufficient for sizing. The
[FAO small earth dams manual](https://www.fao.org/4/i1531e/i1531e00.htm)
separates site investigation from detailed design and directs users to
appropriate professional engineering help. Catchment runoff is one input,
and the pictured section cannot specify a safe size.

Proposed matched caption and narration sentence, preserving the rest of
slide 12:

> Catchment runoff is one input. A suitably qualified person must assess
> the site, dam and spillway design before construction.

If Rory authorises this protected-content correction, update that sentence
in the still, English narration, transcript, regenerated `slide-12.mp3` and
combined audio together; update the size manifest and saved-pack cache so
old spoken and pictured instructions do not survive offline. The body and
quiz need no identified change in this review. A qualified local dam
designer, learner, human-listening, phone readability and fluent isiZulu
review remain open. Farm Finance is excluded from the English core pass.
