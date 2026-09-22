# Water Harvesting L3 English lesson check — 23 September 2026

**Status:** English source and deployed media technical check passed; human,
practitioner and learner review remain open. No protected teaching changed
and no new Flow credit was spent.

## Actual media and phone playback

Lesson 3 is slides 14–18. I inspected the full-size slide 14, 16 and 18
stills, the existing eight-second `flow-roof-rain.mp4` contact frames, and
the 390 × 844 deployed player. Slides 15 and 17 were also checked in the
phone player. All five stills loaded at 1920 px with their English MP3s at
`readyState=4`. Only slide 14 has a registered video. Its 1280 × 720,
3,828,056-byte file matches the deck manifest. The muted video decoded at
`readyState=4`, played through its eight seconds and held its final frame
while the longer narration continued; the player then moved to slide 15.
Slides 15–18 showed their stills and matching English audio without video.

An existing saved Water module pack reopened after a browser offline
reload. Slide 14's Flow MP4 and English MP3 loaded with `readyState=4` while
`navigator.onLine=false`; the video played in the actual phone-width player.
The cache also held the slide 14–18 stills and MP3s. The browser was
restored online afterward. This checks decoding and saved playback, not a
physical phone, human listening or learner comprehension.

## What the visuals establish

The Flow shot is one continuous view of a woman in a South African-style
home garden beside a roof, gutter, downpipe and covered tank in light rain.
Her visible appearance is consistent with Rory's Black African depiction
direction; identity cannot be verified from imagery. The roof-to-tank
parts remain coherent across the sampled frames. The film does **not** show
water travelling through the pipe, tank filling, first-flush diversion or
safe drinking water, so it is used only for the roof catchment setup on
slide 14. Slide 16's static, not-to-scale diagram shows the first-flush
route and states that later runoff still needs a safety check. The
code-drawn first-flush animation remains held outside the player pending
Rory's visual clearance. Slide 18 shows a person beside a covered tank;
its visible pipes are not a plumbing installation instruction. The baked
labels on slide 16 are small at phone width; narration, the expandable
text and full-size still link are available.

## Source and teaching fit

The English lesson and quiz qualify collection by roof area, local rain,
losses, demand and dry periods. They describe first flush as diverting
some early dirty runoff and explicitly say it does not make the remaining
water safe to drink. They avoid a universal diversion volume and require
use-specific testing/treatment and a food-crop water safety check. I found
no material overcertain claim in slides 14–18, the body, quiz, rationale,
narration or transcript. A [South African study of harvested rainwater
quality](https://www.scielo.org.za/scielo.php?pid=S1816-79502015000400009&script=sci_arttext)
documents microbial contamination in sampled tanks, including some with
first-flush hardware, supporting the lesson's refusal to promise potable
water. The [South African water-supply design
guide](https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_J_Water_v1-1.pdf)
provides the broader demand, source and water-quality context.

This is an English technical and source pass for the existing preview,
not learner or practitioner acceptance. isiZulu narration is not published
for this module and needs fluent review later. Farm Finance is excluded.
