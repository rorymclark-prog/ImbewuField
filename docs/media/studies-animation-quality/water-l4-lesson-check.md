# Water Harvesting lesson 4 — Greywater: Reuse with Care

> **Historical checkpoint, superseded for current learner state.** The
> corrected movie and poster described below were later withdrawn with the
> other locally authored animations under Rory's visual-clearance rule.
> Current slide 21 uses an older still, with no video or Watch control. See
> [the 23 September current-state check](water-l4-current-lesson-check.md).

**Checkpoint:** 22 September 2026, draft PR #504. Four English slides (19–22),
unchanged lesson body/quiz/transcript/audio, with the corrected slide-21 movie
and poster documented in `greywater-media-correction.md`.

The 390px lesson player was opened at `/student` in the local app serving this
branch. “Watch and listen” traversed all four slides and returned to “Play the
lesson” on slide 4 with Next disabled. Each slide exposed an English transcript.
The slide-21 movie loaded as a 17-second video with `readyState=4`, no media
error and an observed end near 16.94 seconds. Its larger source and non-food
badges remained visible in the actual player; the poster offers a full-size
link. Slides 2 and 4 are text-heavy stills whose words were too small in the
player at 390px. The existing on-demand full-size still link was extended to
all slide images; slide 4's link opened the exact 1920×1080 JPEG in a separate
tab, where one tap zoomed it to native size for panning. This is a readability
route, not a claim that every learner can read or understand the English copy.

The exact-head preview at
`https://imbewufield-studies-animation-direction.vercel.app/student` served
build `568f9b6`, including the still-zoom change, and the corrected slide-21
MP4/JPEG with matching local byte counts and SHA-256 values. The preview
redirected an unauthenticated browser to `/login`; the signed-in learner UI
was checked against the local app, not the remote preview.

The Water Harvesting module's 17.4 MB pack was saved in the local 390px browser.
With its network state set offline, a reload retained the learner page and
showed “On this phone.” Opening lesson 4 and “Watch and listen” traversed its
slides: the slide-21 movie had `readyState=4`, 17-second duration and no media
error; slide-22 narration had `readyState=4`, was playing and had no media
error. The slide-22 full-size link opened a new tab offline with the JPEG
loaded at its 1920×1080 natural size. This tests a saved pack in this local
browser, not storage persistence on a physical phone.

The [South African Department of Human Settlements water guidance](https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_J_Water_v1-1.pdf)
excludes kitchen and toilet wastewater from potentially reusable greywater and
requires care with health and site risks. The new diagram labels that boundary.
The lesson remains conditional on local rules and a suitable source; it does
not prescribe installation, prove water safe, or claim municipal approval.

**Acceptance still open:** Rory's visual/phone decision, fluent isiZulu review,
and relevant local practitioner/municipal review of the teaching. The first
slide's broad “used water from washing” wording and its audio omit the kitchen
wastewater exclusion shown in the corrected diagram; the calibrated lesson
copy and its recording need a coordinated editorial decision. A local browser
play-through is not a real phone or learner comprehension test. No Flow credits
were used.
