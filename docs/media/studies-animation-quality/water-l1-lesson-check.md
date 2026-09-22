# Water Harvesting L1 English lesson check — 23 September 2026

**Status:** two existing swale clips held outside the learner player; English
teaching remains on a source hold. The protected lesson, quiz, narration,
transcript, stills and audio have not changed. No Flow credit was spent.

## Actual media and learner player

Lesson 1 uses slides 3–9. All seven stills and English MP3s exist. Full-size
slide 4, 7 and 9 stills were inspected. The 16-second slide 4 video and
13-second slide 7 video were inspected through four-frame contact sheets and
in the deployed 390 × 844 player with matching narration (`readyState=4`).
The complete seven-slide phone player advanced to slide 9 and reset to
“Play lesson.” The old 16.6 MB module pack was saved before this hold. In
the new exact-head preview, the service worker retained the slide 4 and 7
stills and MP3s while removing both old MP4/poster pairs. After an offline
reload at 390 × 844, slide 4 and 7 each showed its 1920 px still, English
audio at `readyState=4`, and no video element (`navigator.onLine=false`).
The browser was restored online afterward.

Slide 4 depicts runoff entering a contour trench, blue infiltration reaching
tree roots and a labelled water table. The movement and caption imply a
predictable subsurface outcome. Slide 7 depicts a routed overflow to a pond
near a house and calls its inflow “gentle and contained.” That cannot
demonstrate whether the outlet and receiver are safe on a real site. The
phone render also makes baked captions very small. The player now uses the
existing static stills on these slides; the MP4s remain on disk for Rory's
direct review and are excluded from future saved packs. A service-worker
migration removes just their cached movies and posters from existing packs.
The stills also contain conceptual claims, so this is **not** content
clearance or a completed lesson.

## Source and teaching hold

The lesson and slide 3 narration say swales are placed “exactly on contour”
and imply that level placement is the only valid design. The first quiz marks
uneven filling as proof of a contour error. [ARC Agricultural
Engineering](https://arc.agric.za/Agricultural%20Sector%20News/Simple%20solutions%20to%20combat%20soil%20erosion.pdf)
describes contour swales and a slight-slope alternative;
[DWS rainwater-harvesting guidance](https://www.dws.gov.za/Documents/Other/WMA/12/RainwaterHarvesting.pdf)
describes off-contour swales with a controlled grade and safe discharge. A
level contour is one design; measured levels, soil, slope, flow and a safe
outlet determine whether it suits this site.

Slides 4 and 5 promise moisture at tree roots from the drawn cross-section.
The pictured deep infiltration and water-table result cannot be inferred
without site evidence. Slide 7's illustrated overflow route needs the site,
receiver and erosion checks described by the [South African stormwater
guide](https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_L_Stormwater_v1.pdf).
Neither drawing is a construction plan. The exact proposed English body,
quiz, rationale and narration wording is in
[water-l1-source-correction-proposal.md](water-l1-source-correction-proposal.md).

Rory authorised a narrow correction to Reading the Landscape L4. A broader
protected-content decision for the English core lessons is still pending;
do not silently alter this L1's lesson, quiz or narration. If authorised,
coordinate the baked-text stills, English MP3s and combined audio, transcript,
asset manifest and saved-pack cache. Qualified local water/earthworks,
human listening, farmer/facilitator, phone readability and fluent isiZulu
review remain open. Farm Finance is excluded from this core pass.
