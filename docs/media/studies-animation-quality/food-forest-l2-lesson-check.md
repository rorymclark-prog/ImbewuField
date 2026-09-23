# Food Forest Design L2 English lesson check — 23 September 2026

**Status:** The revised static slide 10 passed deployed phone and offline
browser checks. Human, learner and practitioner review remain open. No
protected teaching asset changed, no animation was released, and no Flow
credit was spent. Farm Finance is excluded.

## Actual media and phone playback

Lesson 2 occupies slides 9–13. The current 1920 × 1080 stills and matching
English MP3s are present. The deployed 390 × 844 learner player showed all five
slides and played slide 10's narration. Slide 9 is an illustrative South Africa
map; slide 10 compares a cold Highveld setting with a warm KZN coast/Lowveld
setting; slides 11–12 list regional examples; slide 13 is a garden scene without
a person. The map and slide 10 diagram are conceptual, not planting directions
or a site survey. The previous slide 10's secondary labels and the example
text on slides 11–12 were hard to read at the phone's fitted-image size. The
new slide 10 improves its labels; slides 11–12 still depend on narration,
expandable lesson text and the full-size still link for detail.

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

The released static still in
[`render-food-forest-l2-climate-still.py`](render-food-forest-l2-climate-still.py)
uses two large generic climate panels, the existing site-match prompt, and the
existing Frost / Rainfall / Humidity factors. It names no species and does not
say that a region universally suits a planting. The image heading drops
“Watch” because the lesson has no video or Watch control; the audio track title
still contains “Watch,” so that title mismatch remains open. The final 1920 ×
1080 still was inspected full-size and at the player's 269 × 151 fit. Both
region labels, guidance panels and three individual site-factor cards remain
distinct at this size. A second narrow cache marker ensures a phone that saved
the first preview candidate receives this larger-label replacement. This is a
local still inspection. Released SHA-256:
`2f17872e8dc56465c0ecb7e35af2a2e92fb384f6ecd463c2a274ee8112d074e8`.

Exact-head `test` and `rules` passed for `06e299ca`; preview run
`35812484711` passed and `/api/build-info` reported `06e299c`. In the live
390 px player the final still displayed at 269 CSS px with
`naturalWidth=1920`; both region panels, site-match prompt and Frost,
Rainfall and Humidity cards were visually checked. The English MP3 advanced
with `readyState=4`, with no player video. A second one-time cache marker
cleared the earlier preview candidate but preserved other saved assets.
The saved Food Forest pack showed 44/45 files with **218 KB left**, then
**On this phone · 17.2 MB** after saving the replacement. After a browser
network-off reload, the final still and MP3 reopened at 269 CSS px and
`readyState=4`; network was restored and playback stopped. This checks one
browser cache path, not a physical handset or learner comprehension.

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
