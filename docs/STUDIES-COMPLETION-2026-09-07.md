# Studies completion — recovery, practical expansion and remaining production

Rory wants the remaining ImbewuField studies completed to the standard of the
Seeds module. A text card with a demonstration title does not meet that brief.

## Working branch

`codex/studies-completion`, based on `main` at `6f46334` (PR #424).
The two commits from `codex/deck-continuation` (PR #153) were cherry-picked
without conflicts. The recovery started with nine English decks and ten
continuation cards. This continuation now preserves all narration paragraphs
in 185 base frames plus 48 continuation frames after the Water corrections. The old branches remain intact.

**Draft recovery, not a release.** The inherited player registration makes these
decks accessible on this branch, but the blockers below still prevent shipping.
Do not merge merely because the existing tests pass.

The other active checkout is `codex/design-map-tour-gates-studies`. This work
uses its own checkout and branch; no files were edited in that checkout.
Coordinate changes to `lib/course-*.ts` and `components/course/DeckPlayer.tsx`
before integrating either branch. Branch isolation prevents overwriting a
working checkout; it does not eliminate later merge conflicts.

## Findings on the recovered branch, before the repairs below

| Claim | Evidence from current source and disk |
| --- | --- |
| No isiZulu decks exist | Seeds has 24 standard English JPGs and 24 standard isiZulu JPGs, plus high-resolution variants. The other nine modules lack isiZulu decks. |
| IsiZulu narration exists for all modules | All ten have scripts. Only Seeds has recorded isiZulu slide audio. Eight of the other scripts declare themselves drafts. Water has no draft flag, but no recording. A script without a draft flag is not independent proof of human review. |
| The Vegetables cover needs new wording | Current `main` already names it “Vegetables and Staple Crops” in the source. Rebuilding the SVG from current source fixes the old branch's cover without changing any recording or narration block. |
| The remaining blockers are only content decisions | Continuation assets exist but are not consumed by `DeckPlayer`, `offlinePack`, or the video builder. An instruction saved in an unreachable continuation is still missing for a learner. |
| Zero dropped lines means all narration text is preserved | The renderer takes only `block.after[0]`. Its test also checks only `after.slice(0, 1)`. Later paragraphs after a pause can disappear while the test passes. The “zero” claim covers the fitter's supporting-line count, not all authored content. |

The old branch also registers the nine decks in `COURSE_DECKS`. The historical
phrase “wired into nothing” must not be read as describing the full PR diff.

## What this continuation delivers

- Nine illustrated opening covers following the Seeds module’s cream-and-green
  visual language and local farming setting. They are narrative covers, not
  technical diagrams or substitutes for the demonstrations below.
- 233 generated English text frames: 185 base frames and 48 continuations.
  Every paragraph before and after every pause is retained, including cover
  introductions. The preserved Vegetables slide-16 sequence includes all four
  steps and the neem-product warning. Slide 11 includes its previously lost
  instruction to write down the hungry-gap months and plan backwards.
- The player displays every continuation under the same slide number and audio
  block. The illustrated cover opens the module; its full introduction remains
  accessible below. Offline downloads include covers and all continuation frames.
- Lesson IDs, narration files and block numbers remain stable. Water’s old English
  audio is withheld because its safety instructions were corrected; it needs a
  complete replacement take in Leah’s voice.
- Six Water Harvesting demonstrations are produced and connected, with readable
  explanations, posters and offline downloads. Four Water lessons and affected
  quizzes now match their corrected source. See `WATER-DEMONSTRATIONS-2026-09-07.md`.
- Readiness now checks complete English and isiZulu slide and audio inventories,
  lesson pictures, and every promised Watch demonstration. It still identifies
  Seeds as the only fully produced module.
- A written practical expansion linked to all 33 existing lessons: 36 core cycles
  and four electives, each with three deeper activities. The source is
  `lib/course-fieldwork.ts`; the Studies page shows the full programme and each
  lesson’s related practice. Each activity includes purpose, observation, field
  steps, evidence, reflection, a facilitator check and a seasonal alternative.
- A readable review copy in `docs/COURSE-FIELD-PROGRAMME-2026-09-07.md`, generated
  by `scripts/export-field-programme.mjs`. This is an English authoring edition,
  not a claim that the expanded programme has reviewed bilingual media.

## The recovered expansion audit

Rory’s **ImbewuField Training Audit and 36 Week Plan**, from July 2026, was
recovered and read in full: 24 pages. It proposes **36 weekly core cycles plus
four elective pathways**: Food Forest, Small Livestock, Seed Steward and Market
Garden Enterprise. It does not say “36 more app lessons.” Its old baseline of
8 modules and 25 lessons is superseded by the current 10 modules and 33 lessons.

The new practical companion follows that sequence. The core covers household
brief, observation and mapping, soil and water, crop planning, nursery and
establishment, scouting and crop-problem escalation, harvest and postharvest,
seed saving, records and enterprise decisions, community, evidence and review.
The four electives each receive three activities in this authoring pass; that
12-activity breakdown is new work, not a number asserted by the original audit.

The audit’s nine review points are facilitator discussion prompts here. The
proposed new graduation thresholds have not been enacted. Existing unlocks,
assignments, evidence submission and certification remain authoritative.
`course-calendar.ts` continues to measure the existing assignment schedule;
these new activities do not falsely fill its gaps by changing persisted rules.

Primary supporting readings for new observation, food-hygiene and enterprise
material are linked next to the activities. Crop-specific rates, new species,
product prescriptions and construction dimensions were not invented. Specialist
additions from the later gap audit, including detailed animal-health protocols,
local water-law guidance and region-specific crop calendars, still need their
own sourced teaching and review.

## Production standard

Each teaching visual should let a farmer see the action or relationship described
by its narration. Reuse the Seeds module's visual language, local setting and
simple composition. Keep essential actions readable at phone width. Put labels
in a separate language layer where practical so artwork can serve both languages.

Choose motion where change over time matters. Otherwise, a clear illustrated
sequence or diagram can teach the same idea without requiring a video download.
That choice needs a matched slide title and narration review: removing “Watch”
alone does not supply a missing picture.

Use existing reviewed course content as the source for species, dimensions,
timings and safety statements. The scene briefs below describe presentation;
they do not author new farming instructions. Validate technical diagrams and
site-safety claims before publishing them.

## The 28 demonstration slots

These are the actual English narration headings outside Seeds. Each needs a
teaching asset, matched to its existing audio block. Six Water assets below are now produced and inspected. The remaining 22 slots
are production proposals, not assertions that assets have been made.

| Module | Slide | Existing title after “Watch:” | Proposed visual |
| --- | ---: | --- | --- |
| Introduction | 7 | One Decision, Three Ethics | One local farming decision shown through three illustrated consequences. |
| Introduction | 13 | Diversity Against One Bad Day | Paired planting scenes before and after the same disturbance. |
| Introduction | 19 | A Windbreak Belongs On The Wind Side | Same site with wind arrows and two alternative windbreak positions. |
| Reading the landscape | 5 | Water Slows, Sinks, and Leaves | One continuous slope with animated or sequential water paths. |
| Reading the landscape | 9 | Follow the Sun Across the Site | The same site in successive sun-and-shadow views, with verified orientation. |
| Reading the landscape | 13 | See Wind and Cold Air on the Map | Site map with separate, clearly distinguishable wind and cold-air paths. |
| Reading the landscape | 17 | Draw the Land You Already Have | Existing field features progressively traced onto a simple map. |
| Water harvesting | 4 | A Swale Sinks Water | Produced: level contour view and infiltration cross-section. |
| Water harvesting | 7 | The Overflow Point | Produced: protected overflow to a receiving basin. |
| Water harvesting | 9 | Living Contour Barriers | Produced: established vegetation intercepting runoff; site-specific assessment replaces the universal slope rule. |
| Water harvesting | 12 | Dam and Spillway | Produced: side spillway clear of the earthen wall. |
| Water harvesting | 16 | First Flush to Tank | Produced: chamber fills, float closes, later runoff enters the tank. |
| Water harvesting | 21 | Greywater Under Mulch | Produced: buried delivery away from trunk and edible parts; no disinfection claim. |
| Soil health | 5 | Look at the Soil | Close views of the soil observations named in the narration. |
| Soil health | 10 | Build the Compost Heap | Step sequence with the authored materials and actions visibly distinct. |
| Soil health | 14 | Bare Soil and Mulch | Matched soil sections under the same conditions. |
| Plant guilds | 5 | Roots That Feed the Soil | Root-zone cutaway illustrating the relationship taught in the script. |
| Plant guilds | 10 | Chop and Drop | Before, cutting and ground-cover sequence. |
| Plant guilds | 15 | A Mango Guild | Plan and ground-level views showing the existing script's plant roles. |
| Food forest | 5 | The Seven Layers Working Together | Spacious sectional illustration with each layer visually separable. |
| Food forest | 10 | Match the Species to the Climate | Illustrated climate comparison using only the source's reviewed choices. |
| Food forest | 15 | From Bare Ground to Food Forest | Same viewpoint across establishment stages; no invented growth dates. |
| Small livestock | 4 | A Chicken Tractor Moving Across a Bed | Fixed view showing enclosure placement, movement and the resulting bed. |
| Small livestock | 9 | Bees Moving Between Hive and Crops | Clearly visible movement between hive and flowers, matched to source. |
| Small livestock | 14 | Nutrients Moving in a Closed Livestock Loop | Farm-system drawing with directional flows matching the narration. |
| Market and community | 4 | What the Farm Record Shows | A legible worked record linked to its harvest and sale evidence. |
| Market and community | 9 | Where Surplus Can Go | One harvest with the source's alternative destinations shown clearly. |
| Market and community | 14 | How Neighbours Strengthen a Harvest | Neighbours' actions shown as a concrete sequence, matched to narration. |

Vegetables has no “Watch:” headings in this list. That does not establish that
its visual teaching is complete: its cards and continuation behaviour still
need the same review.

## Remaining work before release

1. Produce and review the remaining 22 matched teaching demonstrations listed above,
   plus the remaining illustrated teaching compositions. Cover art and text
   cards alone do not meet the Seeds brief. Any change to spoken content needs
   corresponding narration review and, where necessary, re-recording.
2. Complete first-language isiZulu review and recording for the nine remaining
   modules, then produce translated slides. All nine now explicitly
   require review; Water’s source corrections also require translation alignment.
   Lesson bodies, quizzes and the new practical companion also need an explicit
   language workflow. Stable IDs must remain intact.
3. Review the new English activities with Rory and a facilitator against actual
   delivery conditions, especially the new subjects. Complete their illustrated,
   narrated teaching and assessment material before claiming the expanded
   programme is fully produced.
4. Walk the actual player on a phone, with sound off, narration on, and downloaded
   assets offline. Static frame samples were inspected; browser interaction was
   blocked locally and has not been visually verified. In particular check the
   Vegetables slide-16 continuations and all module openings.
5. The facilitator video builder still expects one raster or video per audio
   block. It does not yet assemble these SVG continuation frames. Do not use a
   base-frame-only export and silently lose the extra teaching in a compiled video.
6. Review integration with the other active studies/design branch before any
   merge. The branch is published as draft PR #426; it has not been merged or deployed.

## Water production status

Water’s six demonstrations and four corrected English lessons are now produced.
Its 24 source blocks render into 25 text frames with no dropped paragraphs.
Replacement Leah narration, reviewed isiZulu teaching and Thando narration,
translated slides, and a phone/offline walkthrough remain before completion.
The changed source cannot be paired with its old Luke audio.

The absent draft flag still needs review provenance checked. It does not permit
claiming that a first-language speaker approved the script.

## Verification evidence

- All nine generated decks rebuilt from current English narration. Text checks
  compare every authored paragraph with all frames for its original slide.
- The nine illustrated covers were inspected. Vegetables slide 16 (all three
  frames), Vegetables slide 11 (both frames), and Water slide 4 were rasterised
  and inspected after the font-width adjustment; the sampled text fits.
- Tests check that every generated continuation is reachable in the player’s
  frame manifest and included in English and fallback isiZulu offline packs.
- Tests confirm every existing lesson has practical expansion and every linked
  reading resolves; the 36-week sequence and seasonal alternatives are present.
- Bilingual review packets generated under `docs/narration/review/` with the
  existing reproducible script. Its 17 mechanical findings need adjudication;
  they are not proof of 17 translation errors. No first-language review is claimed.
- Final typecheck passed. Final full suite: 3,431 passes, zero failures and one
  existing TODO (`shape-sync-loss.test.ts`), 3,432 total, exit 0. This includes
  the tightened audio-inventory readiness check. `git diff --check` passed.
- Local browser navigation to the preview was blocked by the client. No browser
  screenshot, offline playback or phone-interaction verification is claimed.
- Automatic approval review initially rejected publication without explicit
  permission. Rory subsequently authorised the branch upload and draft PR. The
  authorised shell push failed because this checkout lacks GitHub credentials;
  publication uses the connected GitHub account with verified repository access.
- Narration provenance was checked: Seeds uses Leah (English) and Thando (isiZulu);
  the other nine English modules use Luke. New recording sheets now name Leah and
  Thando explicitly, following Seeds as Rory’s reference. See
  `docs/COURSE-NARRATION-VOICE.md`. Existing audio has not been replaced.
