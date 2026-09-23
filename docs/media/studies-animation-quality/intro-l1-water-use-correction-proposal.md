# Introduction L1 water-use correction proposal — 22 September 2026

**Status:** Rory authorized the narrow source-backed English correction on
23 September 2026. The corrected quiz, narration, transcript, two static
stills and matching audio are in the Introduction L1 release batch; deployed
and offline verification must be recorded before calling the batch complete.

## Why this lesson is held

The current quiz answer and slide 7 narration tell a learner to share borehole
access while monitoring the water table. The slide 7 still repeats that advice.
The scenario says the borehole produces more than one household needs, but gives
no basis for permissible water use or sustainable supply. Monitoring records a
change; it does not by itself authorise use or show that additional use is safe.
Slide 8 also says ethics allow a decision “without waiting for permission”, which
could conflict with the need to check applicable rights or rules.

[National Water Act 36 of 1998, §22(1)](https://www.gov.za/sites/default/files/gcis_document/201409/a36-98.pdf)
lists the bases on which water use is permissible. Its Schedule 1 covers
reasonable domestic use with lawful access and some uses on land owned or
occupied by the user, subject to the resource's capacity and other users' needs.
The lesson should teach an ethical decision **after** checking what is allowed
and whether the source can support it; it should not tell a farmer that a
borehole always requires a licence or that one household may grant another a
water-use entitlement.

## Exact narrow English proposal

Keep the lesson's three-ethics framework and existing answer index. The second
wrong option also loses its unsupported “surplus” premise:

| Surface | Proposed wording |
|---|---|
| Quiz question | “Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?” |
| Wrong option B | “Keep all the borehole water for a larger irrigation area” |
| Correct option C | “Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.” |
| Rationale | “First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.” |
| Slide 7 narration | “A borehole serves your household. Neighbours ask for water too. First find out if sharing is allowed. Check whether the borehole can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly and keep watching the water level. People Care and Fair Share guide the agreement. Earth Care means protecting the source. Watching the level alone does not make extra use safe or allowed. [pause] Who could help you check the rules and the water supply?” |
| Slide 7 still | Two check-first questions, “Sharing allowed?” and “Enough for all users?”, lead to a conditional agreement or a pause to check. This is a static image; the withdrawn code-drawn movie stays unregistered. |
| Slide 8 narration sentence | “The ethics help you weigh the choices and explain your decision. Check the rules and ask permission where it is needed.” |
| Slide 8 still | “Use the ethics to weigh a decision. Check the rules and ask permission where needed.” |

The lesson body's shared-spring example is an ethical illustration about an
already shared source. It should be retained unless editorial review finds that
its access premise is unclear. No species, invented thresholds, borehole yield
or water-allocation promise is proposed.

## Coordinated media and offline work after approval

Update `lib/course-modules.ts` and `docs/narration/intro-permaculture.en.md`
together, then regenerate `lib/course-transcripts.ts` with the existing script.
Revise the slide 7 still's displayed caption using the existing still renderer;
its withdrawn code-drawn movie must remain unregistered. Regenerate slide 8's
text still from the narration. Re-record only English slides 7 and 8 with the
established en-ZA voice settings; verify their WordBoundary text, complete
decode and listening, then losslessly rebuild English `full.mp3`. Refresh exact
asset sizes and evict only the changed slide 7/8 stills, slide 7/8 MP3s and
English full MP3 once from saved course caches. Do not auto-download them.
Recheck all five L1 slides at 390 px and from a saved offline pack. Run local
typecheck, full tests and whitespace check in the project order, then inspect
both exact-head CI jobs and the preview before calling the technical pass done.
Human/practitioner and fluent isiZulu review remain separate.
The existing isiZulu draft repeats the unconditional sharing and no-permission
wording. Keep it unpublished and require a fluent, source-matched correction
before any isiZulu release.
