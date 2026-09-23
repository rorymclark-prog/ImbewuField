# Introduction L3 English lesson check — 22 September 2026

**Status:** technical media pass; English teaching is on a source hold. This
check does not change protected lesson, quiz, narration or learner media.

## Learner-player evidence

Introduction to Permaculture lesson 3 uses module slides 15–20. All six English
stills and matching MP3s exist. No video is registered for this lesson; the
previously held code-drawn slide 19 windbreak animation remains out of the
player, and the rejected Flow Zone 1 harvest attempt was not added. No Flow
credit was spent on this check.

The deployed 390 × 844 English lesson ran from slide 15 to slide 20 and reset
its control to “Play lesson” at the end. At slide 19, the windbreak still
rendered at 1600 px and its matching `slide-19.mp3` advanced with
`readyState=4`; there was no video element. The already saved 16.7 MB module
pack reopened after an offline page reload. Slide 19's same image and English
MP3 loaded and played offline with `readyState=4`. The browser network was
restored after the check. Offline console requests for unrelated background
data did not prevent these lesson assets loading.

The actual phone-width player shows slide 19 as a small 16:9 still; its tiny
embedded captions need the image zoom link or narration to be readable. The
player offers both, plus expandable slide text. This is a technical check,
not a low-literacy learner readability result. Slides 16 and 20 show Black
African adults in plausible smallholding scenes. Other L3 slides are diagrams
or text without people. These stills were visually inspected, as was slide 19
inside the deployed player.

## Static slide-19 large-label candidate — 23 September 2026

The unregistered review candidate is
`review-candidates/intro-permaculture-l3-slide19-static.png`, rendered by
`render-intro-l3-slide19-static.py` from the existing slide-19 illustration.
It is a static still candidate; it does not add motion, people, species,
spacing, protection distance, or wind-direction guidance. The north-west wind
is presented under the existing “Look at this example” caption. The remaining
headings and text use the existing windbreak storyboard labels and narration,
including “The shelter can reduce wind speed behind it,” “Observe your own
site,” and “This picture is not a planting plan.” The statement about wind
reduction stays conditional.

The candidate is now 1920 × 1080 (16:9). I inspected it full-size and at the
actual 269 × 151 media-frame fit used in the 390-pixel lesson. The north-west
caption is explicitly introduced as an example. The conditional shelter
statement and the “Observe your own site” / “This picture is not a planting
plan” caution are visible in the short label panel. Some airflow detail remains
in unchanged narration. This is a local visual check only. The candidate has
not been registered, deployed, checked in the offline pack, or approved by
Rory, learners or practitioners.
The protected English body, quiz and narration remain unchanged; slide 18 and
related source holds still require their separate editorial decision.

## Source and teaching holds

1. Slide 18 narration and the lesson body say a Lowveld farm facing north-west
   gets hot, dry berg winds in August. The [South African Weather Service](https://www.weathersa.co.za/home/weatherques)
   defines berg winds as hot and dry and says they usually occur in winter.
   It does not establish north-west as a Lowveld site's damaging wind direction.
   [ARC's climate network](https://www.arc.agric.za/arc-iscw/Pages/Climate-Monitoring-Services.aspx)
   records site-specific wind speed and direction. Teach learners to observe or
   obtain local direction before siting a windbreak. The current regional
   direction is unverified, so do not present it as a general rule.
2. The same narration/body says a KZN farm has a summer rain sector “from the
   north-east.” A [CSIR assessment of the KZN north coast](https://www.csir.co.za/sites/default/files/DEIAR_UW_Chap_3_Affected%20environment_Tongaat_050518_Low%20Res.pdf)
   reports summer-dominant rainfall and more frequent north-east **winds** in
   summer. It does not say rain arrives from the north-east throughout KZN.
   Wind direction cannot stand in for rain direction. Keep the summer-rainfall
   point, and make incoming rain and wind sectors local observations.
3. The quiz says “A Highveld farm gets hot, dry north-westerly winds in
   August.” Its answer correctly places shelter between an **assumed** wind
   source and crops, but the regional/month assertion is not established by
   the sources above. Frame the wind as an observed condition on a particular
   farm. Slide 19 itself explicitly says “Look at this example” and “On your
   own site, observe the damaging winds”; its hypothetical north-west arrow
   can remain an example if that boundary remains clear.
4. Slide 17 says “Zones do not organise space. They organise effort.” Zones
   are drawn as spatial rings in slide 15 and the field task. The intended
   point is useful—visit frequency should guide placement—but the absolute
   sentence can confuse it. Review alongside the source correction. The
   “Why Zone 1 Is Not Negotiable” title also needs an editorial check against
   varied household and site layouts; no universal layout is established here.

An English correction should coordinate `lib/course-modules.ts`, the slide 18
and related narration, transcript, affected still captions/MP3s, combined
English narration, size manifest and offline cache migration. The narrow
correction request beyond Reading the Landscape L4 is still awaiting Rory's
answer under the project's protected-content rule. Keep the current still for
slide 19 unless Rory clears another visual. Human, practitioner, learner and
fluent isiZulu acceptance remain open. Farm Finance is outside this weekly
core-module pass.
