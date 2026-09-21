# C02 — Find, map and reopen your site

Implementation: `/student/guides/mapping`, using the shared guide layout and registry. Six English steps cover finding a site, saving a pin without duplicating it, tracing a parcel, naming/reviewing it, distinguishing beds and reopening the records. This is app instruction, not an assessed farming module, a survey or a filmed tutorial.

## Evidence checked on 21 September 2026

Production baseline `b29d4bc`. Entered the sample tour through Start with a garden, then Open the garden on the map. Show map tools exposed Search town or address, Save place, Places and Parcels. Opened the prepared place, waited for the map to settle and inspected its location.

Saved the same sample spot as Mapping practice. The nearby-place prompt offered Update versus Save as new place; Update retained one place, showed Saved and updated the report name. Reopened Mapping practice from Places. No real account or farm record was changed.

Used Add parcel and tapped four practice corners. Undo reduced the corner count to three; restoring the last corner returned it to four. Finish created the outline and opened Name your land. Named it Practice outline only, chose Other and saved. The named entry appeared under Parcels. Opening its name retained the name; Edit shape exposed the corners and Done/Cancel controls. Cancel left it unchanged. Add to my map also exposed Land boundary. Ended the tour and closed the temporary tab. The arbitrary practice outline is not a measured or recommended land area.

`components/Map.tsx` confirms Finish creates the shape before the naming form; Skip dismisses naming rather than cancelling the shape. Draft Cancel clears unfinished points. `lib/saved-places.ts` routes sample saves to the sandbox. `lib/sample-mode.ts` keeps the sample data in memory; a reload resets changes. `lib/finance-plan-source.ts` uses the main saved site's Studio beds when available, with legacy fallback. Selecting an unrelated pin does not automatically select a different financial book.

The [NGI professional and advisory page](https://ngi.dlrrd.gov.za/index.php/what-we-do/prof) was checked: it distinguishes professional land survey/boundary verification and aerial-photo interpretation. The guide points learners to help and makes no claim that an app tracing establishes a surveyed/legal boundary. It specifies no accuracy tolerance, tenure procedure, legal fee or map-derived farming recommendation.

## Visual and interaction design

The hero copies `docs/media/studies-illustrated-release/art/intro-permaculture/sketch-the-site.jpg` unchanged. Inspected the original: warm homestead, growers and a paper sketch; the caption explicitly identifies it as illustration rather than a measured plan.

The interactive schematic is authored SVG: place pin, parcel boundary and beds are independently highlighted with explanations. The boundary traces on user selection; other layers change emphasis. Motion is finite and user-triggered; reduced-motion preference removes transitions. No invented field measurements or simulated app controls. Text descriptions and native buttons expose the same concepts. Printed output shows all layers.

Local route and content loaded; local first-use consent prevented an unobstructed visual review, so no consent was accepted. Preview must be visually checked before merge: desktop and phone, all three layers, wrong/right practice feedback, related links, and the Studies card. Narration, real-screen video and isiZulu remain future work. No Flow credits spent for this companion.

## Preview review

Preview `af2b6c5` was visually inspected at desktop and 390 × 844 phone size. The hero and all three schematic states fit; the boundary trace reached its final closed outline. Each layer changed its accessible description and explanatory text. Phone document width equalled viewport width (390 px), with no horizontal overflow. Wrong and correct answers produced distinct feedback. Emulated reduced motion reported a zero-second transition; emulation was reset afterwards.

The related harvest link opened its correct guide with fresh unanswered practice choices. My Studies requires an account or the sample workflow; no sign-in was attempted. Entered the public tour's Learn and find guidance stop, verified the new mapping card in Studies and opened it. The phone card and guide header were visually inspected. That review found the section summary still listed only the earlier three tasks; the final change adds mapping to that sentence. Final CI and production checks are recorded in the PR and issue 35. No physical-print or narrated-video claim.
