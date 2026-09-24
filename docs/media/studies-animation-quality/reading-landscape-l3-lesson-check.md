# Reading the Landscape L3 English lesson check — 23 September 2026

## Coordinated English correction and release candidate

The English lesson, both quizzes, narration and transcript now ask farmers to
observe damaging wind and consult local records instead of using fixed
Highveld/KZN directions. Cold-air drainage is conditional on clear, still
nights; frost damage can happen without visible ice. Nursery siting compares
candidate places through the local frost season and checks local minimum
temperatures or advice before a permanent choice. Tomato airflow and morning
sun are framed as ways leaves may dry, not a treatment or cure for late
blight. The named crops and quiz answer indices are unchanged; no new
weather threshold or species was introduced. The source basis is [ARC's
climate network](https://www.arc.agric.za/arc-iscw/Pages/Climate-Monitoring-Services.aspx),
[FAO frost guidance](https://www.fao.org/4/y7223e/y7223e0c.htm), [SAWS's
frost definitions](https://www.weathersa.co.za/home/weatherques), [KZN
agriculture's tomato guidance](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/tomato.pdf),
[ARC's summer-vegetable guidance](https://www.arc.agric.za/arc-vopi/Leaflets%20Library/Production%20Guideline%20for%20Summer%20Vegetables.pdf)
and [UMN Extension's leaf-drying guidance](https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/late-blight).

Static 1920 × 1080 JPEGs now replace slides 13–15's old diagram and text
cards. Slide 13 keeps “Concept diagram — not to scale” and separates wind
shelter from cold-air pooling; slides 14–15 carry the qualified frost and
late-blight copy. The actual JPEGs were inspected full-size and at the
269 px player fit. SHA-256 hashes: slide 13
`09c3f8c71c5389712a92dd02b82c66e049394b051930a9f983ff3b43d9cb1ad0`,
slide 14
`3d6a7948f0df58a891e81b65195d93ff7c9cddd2f2520a874422f4756acd3dbb`,
slide 15
`881f34153c9d59a4c9d4e30d1dd1ab767c084357431f76973a23ea6c638c9bdc`.
Slides 12–15 and the full English audio track were regenerated from the
matching script. The [audio verification](reading-landscape-l3-english-audio-verification.json)
records exact normalized WordBoundary matches, full decode and a
464.688-second full track equal to the sum of its 21 clips. Selective
saved-pack migration retires only changed English L3 stills and speech and
does not fetch replacements. The held SVG movie remains outside the player;
no Flow credit or SVG motion was used. The [L3 isiZulu packet](../../narration-reviews/reading-landscape-l3.zu.review.md)
is review-only; no ZU learner content changed.

Local typecheck, full test suite (3,718 passing / 0 failures / 1 existing TODO)
and whitespace check passed. Commit `5529ffe3` passed exact-head CI
`35846142531` in both `test` and `rules`; preview `35846142453` passed and
build info reported `5529ffe`. At a 390 px browser viewport, the deployed
sample Student showed the corrected lesson and both quiz questions. Slides
13–15 loaded as 1920 × 1080 stills; their text is small at the player fit,
with narration, expandable text and full-size links available. The 48-file,
12.9 MB Reading the Landscape pack refreshed and reported On this phone.
After a network-disabled reload, the Offline badge appeared; slides 13–15
reopened as 1920 px stills and slide 14 speech advanced past six seconds with
`readyState=4` and no error. Network and viewport were restored. This is a
browser technical check, not a physical-phone or human listening check.
Human listening, learner, farmer, practitioner and fluent isiZulu approval
are not claimed.

## Earlier media baseline and source hold

**Status:** deployed phone-width and saved-pack media pass; English teaching is
on a source hold. Protected lesson, quiz, narration and learner assets are
unchanged. No Flow credit was spent.

## Actual media and learner player

Lesson 3 is slides 12–15. All four English stills and MP3s exist. Slide 13's
locally drawn wind/cold-air movie was withdrawn; the current player uses its
static, not-to-scale concept diagram. The other stills show a farm landscape
and two text cards; none portrays a person. All four were visually inspected.

The deployed 390 × 844 English player advanced from slide 12 to slide 15 and
reset to “Play lesson.” At slide 14, the phone showed the text card, active
narration and controls. Its baked text is small at phone width; narration, a
full-size image link and expandable slide text are available. This is a
technical check, not learner readability or human listening approval.

The previously saved 12.2 MB Reading the Landscape pack reopened after a
browser offline reload. Slide 13's 1920 px still and `slide-13.mp3` loaded;
the narration advanced with `readyState=4`. Slide 14's 1920 px still and MP3
also loaded and advanced with `readyState=4`. There was no video element.
The browser network was restored afterward.

## Source and teaching holds

1. The body and slide 12 narration prescribe hot, dry north-westerlies for
   Highveld farms in August/September and particular winter/summer wind
   directions for KZN escarpment farms. Those may be regional examples, but
   the current wording treats them as site-wide rules. [SAWS describes hot,
   dry berg winds](https://www.weathersa.co.za/home/weatherques), and the
   [ARC climate network](https://www.arc.agric.za/arc-iscw/Pages/Climate-Monitoring-Services.aspx)
   records local wind speed and direction. Teach local observation or local
   records before placing a windbreak or inferring disease risk. The exact
   seasonal directions remain unverified as universal claims.
2. The key point “Frost flows downhill” assigns the movement to frost rather
   than cold air and says valleys frost “first and last.” The body and slide 14
   correctly say cold air **can** collect on clear, still nights. [FAO frost
   guidance](https://www.fao.org/4/y7223e/y7223e0c.htm) describes cold-air
   drainage and colder low spots during radiation frosts, while also making
   slope, aspect, obstacles and soil site-specific factors. Retain the
   conditional observation; do not promise every valley's frost timing.
3. The nursery quiz and slide 15 prescribe a north-facing hillside above the
   frost-pool zone as the answer for every Highveld site. [FAO's site-selection
   guidance](https://www.fao.org/4/y7223e/y7223e0c.htm) makes cold-air
   drainage and local conditions decisive. A sunny slope outside an observed
   frost hollow may reduce risk; it is not a guarantee. Keep the answer index
   only if its option and rationale are qualified together.
4. The second quiz says fungal disease “needs humidity and still air,” and its
   rationale says airflow and morning sun **starve** late blight. [KZN DARD's
   tomato guidance](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/tomato.pdf)
   identifies prolonged cool, damp spells as favourable to late blight.
   [University of Minnesota Extension](https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/late-blight)
   identifies its cause as a water mould and recommends several controls,
   including keeping leaves dry and allowing air between plants. Morning sun
   and airflow can help leaves dry, but moving the bed alone cannot be taught
   as a cure or complete prevention.

Any authorised correction must align `lib/course-modules.ts`, slide 12/15
narration, the transcript, affected baked-text stills, English MP3s and
combined audio, asset-size manifest and saved-pack cache migration. Rory's
broader protected-content decision beyond Reading the Landscape L4 remains
pending. Practitioner, learner, human-listening and fluent isiZulu review are
also open. Farm Finance is excluded from this English core-module pass.
