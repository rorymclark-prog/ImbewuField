# Water Harvesting L2 English lesson check — 23 September 2026

**Status:** deployed phone and offline media pass; slide 12 caption and
narration remain on a source hold. The protected lesson, quiz, narration,
transcript, stills and audio have not changed. No Flow credit was spent.

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
