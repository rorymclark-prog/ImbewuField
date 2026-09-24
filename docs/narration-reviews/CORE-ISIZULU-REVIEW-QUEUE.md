# Core isiZulu review queue — 23 September 2026

**24 September owner decision:** Rory authorised showing the available lesson
translations to learners now as conspicuously labelled, unreviewed drafts,
with human review to follow. This does not make them approved translations or
authorise new audio. The source-held Water L4 and Soil L3 stay in English.
Independent QA found a held bee-registration claim and an editorial note in
Small Livestock L2, so that lesson also stays in English until its source
scope is resolved. Record the fluent isiZulu and local farming reviewer, date,
corrections and acceptance per lesson; no such approval is claimed here.

The ten core modules contain 33 lessons. All have draft isiZulu narration in
the repository, but most are not published in the audio manifest. Review-only
comparison packets now cover all **27 lessons outside Seeds and Plant Guilds**.
This is packet coverage, not 27 finished translations. Seeds (3 lessons) is
the existing baseline and is not reopened. Plant Guilds (3 lessons) already
has published isiZulu audio under Rory's earlier instruction, but its
[separate language review](plant-guilds.zu.md) remains open. Neither existing
audio set is described here as fluent-approved. Farm Finance is excluded.

Complete review-only drafts now cover 25 of those 27 lessons: Introduction
L1–L3, Reading the Landscape L1–L4, Water Harvesting L1–L3, Soil Health
L1–L2, Vegetables L1–L4, Food Forest L1–L3, Small Livestock L1–L3 and Market
L1–L3. Water L4 and Soil L3 have comparison packets but no full draft
because of their separate source holds. All 25 packets remain review material;
24 are now eligible for labelled learner draft display, while Small Livestock
L2 is additionally held from learner display. None has fluent language or
farming approval.

| Module | Review-only packets | Main unresolved checks |
| --- | --- | --- |
| Introduction L1–L3 | [L1 comparison](intro-l1.zu.review.md), [L2 comparison](intro-l2.zu.review.md), [L3 comparison](intro-l3.zu.review.md); [complete review drafts and handoff](INTRODUCTION-ISIZULU-FULL-DRAFT-HANDOFF.md) | Water-use permission and supply; qualified swale and overflow advice; zone/sector terms. Full draft is not learner-approved. |
| Reading the Landscape L1–L4 | [L1](reading-landscape-l1.zu.review.md), [L2](reading-landscape-l2.zu.review.md), [L3](reading-landscape-l3.zu.review.md), [L4](reading-landscape-l4.zu.review.md); [complete review drafts and handoff](READING-LANDSCAPE-ISIZULU-FULL-DRAFT-HANDOFF.md) | Conditional water, aspect, wind and frost claims; a paced sketch is not automatically to scale; weeds do not prove compaction. L4 slide 17 stays a still. |
| Water Harvesting L1–L4 | [L1](water-harvesting-l1.zu.review.md), [L2](water-harvesting-l2.zu.review.md), [L3](water-harvesting-l3.zu.review.md), [L4 current full draft](water-harvesting-l4.zu.full-draft.md); [full drafts and handoff](WATER-HARVESTING-ISIZULU-FULL-DRAFT-HANDOFF.md) | Qualified earthwork and roof-water limits; stale first-flush numbers; L4 risk-recognition draft is labelled in the learner app; fluent-language, listening, local sanitation/municipal and farming review remain pending. |
| Soil Health & Composting L1–L3 | [L1](soil-health-l1.zu.review.md), [L2](soil-health-l2.zu.review.md), [L3](soil-health-l3.zu.review.md); [L1–L2 full drafts and handoff](SOIL-HEALTH-ISIZULU-FULL-DRAFT-HANDOFF.md) | No single-clue soil diagnosis, fixed compost recipe or sanitation guarantee; L3 mulch and leachate wording awaits an authorized English correction. |
| Vegetables and Staple Crops L1–L4 | [L1](vegetables-staples-l1.zu.review.md), [L2](vegetables-l2.zu.review.md), [L3](vegetables-staples-l3.zu.review.md), [L4](vegetables-staples-l4.zu.review.md); [full drafts and handoff](VEGETABLES-ISIZULU-FULL-DRAFT-HANDOFF.md) | Match the planting action and crop identity; preserve conditional timing, drought and pest advice; check product registration, label and harvest safeguards. |
| Food Forest Design L1–L3 | [L1](food-forest-l1.zu.review.md), [L2](food-forest-l2.zu.review.md), [L3](food-forest-l3.zu.review.md); [full drafts and handoff](FOOD-FOREST-ISIZULU-FULL-DRAFT-HANDOFF.md) | Do not prescribe fixed area, layer height or species suitability; preserve site and legal checks; grass suppression and water entry stay conditional. |
| Small Livestock Integration L1–L3 | [L1–L2 overview](small-livestock-l1-l2.zu.review.md), [L2 current detail](small-livestock-l2.zu.review.md), [L3](small-livestock-l3.zu.review.md); [full drafts and handoff](SMALL-LIVESTOCK-ISIZULU-FULL-DRAFT-HANDOFF.md) | Animal care, manure food safety and bee siting; one bee clip does not prove pollen transfer; bought feed enters and animal products remove nutrients. |
| Market Gardening & Community L1–L3 | [L1](market-community-l1.zu.review.md), [L2](market-community-l2.zu.review.md), [L3](market-community-l3.zu.review.md); [full drafts and handoff](MARKET-COMMUNITY-ISIZULU-FULL-DRAFT-HANDOFF.md) | Keep illustrative prices separate from current prices, record food/sale destinations separately, check local trading rules and seed-variety rights. |

## Fastest safe handoff

1. Freeze one source-checked English lesson and its media before translating it.
2. Give separate agents non-overlapping slide ranges or modules. Each compares
   current English lesson, quiz and narration against the old isiZulu draft and
   its sources, then writes a review-only packet. A second reader checks the
   claims and terminology questions; the central integrator checks the diff.
3. Batch packets for a fluent isiZulu farmer/practitioner review. Preserve
   uncertain terms and conditional words as explicit reviewer questions.
4. Only after that review, update the learner script and audio together, then
   test its transcript, slide timing, phone view and saved offline pack. Run
   typecheck, the full suite, whitespace check and both exact-head CI jobs.

Reuse language-free verified media and existing stills. Request a new Flow
clip only for a verified action-to-narration gap, at one output per prompt.
Code-drawn/SVG motion remains held for Rory's explicit visual clearance.
