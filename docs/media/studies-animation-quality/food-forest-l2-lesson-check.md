# Food Forest Design L2 English lesson check — 23 September 2026

**Status:** English source and deployed still/audio technical check passed. A
static slide 10 candidate now addresses the phone-legibility issue. Human,
learner and practitioner review remain open. No protected teaching asset
changed, no animation was released, and no Flow credit was spent. Farm Finance
is excluded.

## Actual media and phone playback

Lesson 2 occupies slides 9–13. The current 1920 × 1080 stills and matching
English MP3s are present. The deployed 390 × 844 learner player showed all five
slides and played slide 10's narration. Slide 9 is an illustrative South Africa
map; slide 10 compares a cold Highveld setting with a warm KZN coast/Lowveld
setting; slides 11–12 list regional examples; slide 13 is a garden scene without
a person. The map and slide 10 diagram are conceptual, not planting directions
or a site survey. Slide 10's secondary labels and the example text on slides
11–12 were hard to read at the phone's fitted-image size. The narrated audio,
expandable lesson text and full-size still link are available.

The saved 17.7 MB Food Forest module pack reopened after an offline browser
reload. The header displayed **Offline** and **On this phone**, slide 10's still
loaded, and its English audio advanced to 0:01 while the browser network was
disabled. The browser was restored online afterward. This verifies the browser
preview, not a physical handset or learner comprehension.

The archived `watch-10-climate-match.mp4` is a flat, locally drawn animation
with tree icons that grow and shrink between climate panels. It remains outside
`FOREST_ANIMATIONS` and the offline pack under Rory's requirement to clear
SVG/code-drawn motion with him first. The existing Flow sheet-mulching clip on
slide 16 concerns lesson 3 and cannot stand in for this climate comparison.

The static candidate in
[`render-food-forest-l2-climate-still.py`](render-food-forest-l2-climate-still.py)
uses two large generic climate panels, the existing site-match prompt, and the
existing Frost / Rainfall / Humidity factors. It names no species and does not
say that a region universally suits a planting. The image heading drops
“Watch” because the lesson has no video or Watch control; the audio track title
still contains “Watch,” so that title mismatch remains open. The 1920 × 1080
candidate was inspected full-size and at the player's 269 × 151 fit. Both
region labels and guidance panels remain distinct; the factor labels are
visible but secondary at this size. This is a local still inspection, not a
deployed-player or learner check. Candidate SHA-256:
`63a956b57ef480308470fb41b563a9bf00274aa9b544027c657c14ff7040bb58`.

## Source and farming safeguards

The English lesson body, quiz, rationale, narration and transcript require
local rainfall, frost, heat, soil, water, plant identity, mature size and legal
checks before planting. They present the regional species as examples, not
blanket recommendations; no species or numeric target changed. They also
protect existing natural vegetation and explicitly warn against converting
healthy grassland merely to install trees. The [Agricultural Research Council's
horticulture guidance](https://www.arc.agric.za/arc-infruitec-nietvoorbij/Pages/Crop-Development.aspx)
supports matching fruit crops and rootstocks to specific climate and soil
conditions, including winter chilling. The [SANBI grassland assessment](https://opus.sanbi.org/sanbiserver/api/core/bitstreams/6027b62d-54a2-4026-b4a7-252a696e7e13/content)
documents biodiversity losses from conversion to plantations and crops. The
[South African invasive-species list](https://www.dffe.gov.za/sites/default/files/legislations/nemba_invasivespecieslist_g43726gon1003.pdf)
is the reason not to infer planting permission from a picture or example list.

One slide 10 line, “Climate decides which species belong,” is more categorical
than the lesson's site-by-site checks. The adjacent sentence and lesson body
qualify it, so it is a low-severity editorial concern rather than a new
unsafe planting instruction. If a protected-content correction is later
authorised, align that line, its recorded narration and the baked artwork to
“Climate helps determine which species may suit a site.” That proposal is
not approval to alter the existing species list.

The candidate leaves the low-severity “Climate decides which species belong”
overstatement for a separately authorised coordinated edit; it does not change
the protected narration, transcript or lesson. This check does not claim
isiZulu, farmer, facilitator or practitioner approval.
