# Sowing-calendar rule: held-out test — 2026-11-11

- Auditor: Claude, at Rory's instruction of 11 November 2026 ("you can continue … I want this done accurate and thoroughly once and for all").
- Reviewed revision: main `84e42a24e48932e386eaae58343fc01eb51ded8e`. No application file is changed by this audit.
- Deployment inspected: not inspected. This audit runs the planner's own functions on climate data.
- Previous audit: [crop plan accuracy fixes, 10 November](../2026-11-10/crop-plan-accuracy-fixes-claude.md). Carried forward: CP-073 remaining, CP-078, CP-083, CP-098, CP-099. IDs continue from CP-103.
- Scope: which sowing calendar a real South African place is given by the automatic rule.
- Evidence type: the app's own functions run on places it was not designed on, judged against an independent gridded frost record. No field check and no agronomist review.

## Why

The rule that picks a site's sowing calendar was corrected on 10 November using 44 real places. Those places shaped the rule, so they can only show that it still does what it did. They cannot show that it works somewhere new. This audit tests it on places that were held back.

## Written down before any data was fetched

The places, their guide regions and the pass criteria are in [`evidence-calendar-holdout/holdout-places.json`](evidence-calendar-holdout/holdout-places.json). That file was committed and pushed before any climate data for these places was requested, so the commit order shows the criteria were not fitted to the results.

- 56 places, none of them among the 44, across all eight regions of the regional guide, plus 3 with no clear region.
- The rule under test is frozen at `84e42a24`.
- Four pass criteria, H-A to H-D, are the same frost rules the 44 places are held to in `tests/sa-calendar-real-sites.test.ts`.
- Reported but not judged: whether the two climate datasets agree, close-call flags, and month overlap with the regional guide.
- A failure is recorded by name. No rule is changed in this audit.

## Results

Not run yet at the time of this commit.
