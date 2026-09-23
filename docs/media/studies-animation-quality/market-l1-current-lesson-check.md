# Market Gardening L1 English lesson check — 23 September 2026

## Slide 4 phone-readable still replacement — 23 September

The deployed check below identified a concrete access gap: the five-column
record table shrank its destination labels and lower caption at phone fit. A
new **static** 1920 × 1080 still now keeps the four source destinations as
large separate rows: Family food, Sales, Gifts and Compost. The long season
explanation remains in the unchanged English narration and readable lesson
text; the still says “Season overview.” It introduces no amount, date, yield,
price, customer or promised outcome. The existing code-drawn animation is
still held, and no Flow request was made.

The deterministic source is `render-market-record-still.py`, and the local
asset is `public/course-decks/market-community/en/slide-04.jpg` (SHA-256
`d4218b9f523ad7effe33ba7290b3b7bcdf2c4c21b83c3df80f4243c5bbe25d8c`).
The rendered JPEG was inspected at full size and at the actual 272 CSS px
image width inside a 390 px browser viewport. All four destination labels
remain visually readable at that width. This is local visual QA pending the
exact deployed preview and offline migration check; it is not farmer,
learner, practitioner, human or isiZulu approval. A one-time service-worker
migration clears only the old saved slide-4 still so a learner can choose when
to download the improved file, leaving the rest of the pack intact.

## Earlier deployed check — before the slide 4 replacement

**Status at this earlier checkpoint:** The five-slide English player, then-current stills and saved-pack offline
path were checked. No new Flow request, animation registration, protected lesson
or quiz edit, narration edit, species, farming figure or `PLAN_VERSION` change
was made. This is a technical check, not Rory, farmer, learner, practitioner or
fluent isiZulu approval. The separate Farm Finance course is outside this pass.

## Actual lesson and media

Module slides 4–8 cover recording a harvest, reviewing a season, costs and a
household food gap. Slide 4, “Watch: What the Farm Record Shows,” currently
uses its still; the locally drawn farm-record film is withdrawn and needs
Rory's explicit visual clearance before registration. The still's table keeps
family food, sales, gifts and compost separate, but its labels and lower
explanation are too small to read at 390 px full-slide fit. The deployed
player exposes an “Open still image · tap to zoom” link. Slide 5 has a
photorealistic overhead view of a Black African farmer recording beside fresh
produce; slide 7 shows a Black African farmer reviewing a notebook, produce
and calculator. Slides 6 and 8 are text-heavy stills, with small bullet text
at phone fit. Their English narration and full-size still links remain the
accessible teaching routes. No L1 video is in the current deck or offline
pack.

At 390 × 844 in the deployed Student preview, the five-slide lesson opened at
slide 4 and advanced through slide 8. The checked-in full-size stills were
inspected together; the deployed slide 4 still loaded at `naturalWidth=1920`.
During playback, slide 4, slide 6 and slide 8 English MP3s reached
`readyState=4` with advancing time; the player returned to Play after the
last slide. This is a browser play-through, not a listening or physical-phone
acceptance test.

The **12.7 MB / 45-file** Market module pack reached “On this phone.” With the
browser network disabled, `/student` reloaded under an Offline badge; the
Market module and L1 reopened. Slide 4's still loaded at
`naturalWidth=1920`, and its English MP3 advanced with `readyState=4`.
Playback was stopped and network access restored. This verifies one existing
browser cache path, not a newly released film.

## Teaching boundary and next media decision

The current body/quiz explicitly call the R18/kg cost and R15/kg sale a
**teaching example**, not a current market price. The arithmetic supports
reviewing costs, price and customer demand; it does not promise that a higher
asking price will sell. The food-gap guidance is conditional on local climate,
water and expected harvest time. No source-backed factual correction was
identified in this pass.

A generated record-writing video would need readable, consistent quantities
and destinations to teach this slide's core distinction; the current still
already carries those categories when enlarged. Do not spend a Flow prompt
only to animate an unreadable form. Keep the still and narration, and hold the
locally drawn movie for Rory's visual decision. If the still is redesigned,
prioritise larger category labels and the destination relationship at phone
width without inventing a yield, price, date or business outcome.
