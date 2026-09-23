# Next stage: parallel review, one lesson release at a time

**Planning basis:** current programme inventory and media matrix (23 September
2026), active continuation, and current `lib/course-deck.ts` /
`lib/course-audio.ts` registrations. These counts describe the checked-in
programme; they are not counts of approvals.

## Current core scope

- **10 core Studies modules, 33 English lessons, 51 animation review slots, 27
  registered animations and 24 still-only/held slots.** Current deck
  registration confirms the 27 / 24 split. The inventory's 33 image/infographic
  entries are a planning count, not a count of all lesson-slide stills. The
  slide visuals registered in the app are candidates until separately reviewed.
- **240 narration manifest tracks:** 165 tracks across the eight English-only
  modules, plus 51 Plant Guilds tracks and 24 Seeds tracks, each of those last
  75 available in English and isiZulu. That yields 240 English and 75 isiZulu
  MP3 files (315 total); language files are not additional manifest tracks.
- **Seeds is the existing baseline:** three lessons and eight registered
  animation slots. Keep it outside this rework batch.
- **English first across the ten core modules. Farm Finance is excluded.** Defer
  isiZulu completion and reserve courses. The requested finish is technical
  English lesson evidence; human, practitioner, learner and fluent-language
  acceptance remain separate decisions.
- Human visuals should depict Black African people in the South African
  smallholder context. Visual appearance cannot establish identity; flag
  uncertain representation for Rory. Do not add people to diagrams that do not
  need them.
- Rory must visually approve any SVG or code-drawn motion before it is
  registered in the learner player. Show **each Flow candidate** for visual
  review before registration too. Limit each Flow prompt to **one video output**;
  do not request another prompt without a specific, source-backed gap.

## Parallel lanes and root supervision

Run three continuously assigned lanes under root supervision. The two module
lanes work on different modules from each other and from the Flow lane's active
candidate investigation. They can audit and implement discrete, source-safe
static improvements; they do not edit protected copy or register candidate
media. Root assigns a module boundary for each task and resolves shared-file,
cache-migration and release ownership before work begins.

1. **Continuously assigned, low-cost Flow candidate lane — one active
   investigation at a time:** keep screening
   the actual registered and held media for a concrete physical-motion gap.
   Reconcile source assets and Flow references first; prepare a prompt only when
   the gap is specific, the narration supports the visible action, and a still
   is inadequate. Root supervises every credit spend. A prompt yields **one x1
   video**, with no batch outputs or automatic rerolls. Inspect full motion,
   representative frames and phone fit; post every resulting candidate for
   Rory's visual approval before any learner-player registration. A rejected or
   held result stays out of public assets, player manifests and offline packs.
2. **Independent module audit/implementation lane A:** own one assigned module
   at a time. Check its English lesson, source limits, narration, slides and
   current media; implement only a discrete authorized static improvement or
   return the exact hold and evidence. Keep its files separate from lane B's
   module.
3. **Independent module audit/implementation lane B:** do the same for a
   different module. Do not overlap modules or modify the Flow lane's active
   candidate, manifests or cache migration.

**Root gate:** supervise priorities, stop duplicate investigations, resolve
editorial/source holds and select one complete lesson release at a time from
parallel work. Root checks the actual current manifest and bytes, decides
whether the existing still is adequate, integrates that lesson's slide/media,
English narration, transcript, offline replacement and review record, then
checks the deployed preview. No lane treats a registration or technical pass as
Rory, learner, practitioner, legal or fluent-language approval.

Static work can proceed in parallel across independent modules; release work
stays serial by lesson so every preview presents one coherent, inspectable
teaching unit. Keep any media candidate out of the learner manifest while its
source, content or Rory visual decision is open. Preserve protected copy,
species, numbers and quiz rationales unless the required explicit editorial
authorization is recorded.

## Release and deployment checks

For each release unit, the root gate should verify lesson order and full English
playback; source-to-copy/visual alignment; readable 269px fit; matching
manifest, on-disk video/poster/still/audio and truthful byte sizes; offline pack
replacement and reopened assets; and documented remaining review limits.
Distinguish local checks from deployed preview and offline evidence in the
lesson record.

At the exact commit intended for release, use the repository-required gates in
order: `npx tsc --noEmit`, `npm test`, then `git diff --check`. Read the exact
head's `test` and `rules` CI jobs and verify the preview build identity and
actual lesson before calling the technical release complete. Never run the
sandbox build that fetches Google Fonts. If local verification is blocked by
the documented Node/runtime limitation, use the exact-head CI result.

Push each finished branch once, after its coherent lesson batch is ready. Read
the CI result and preview before moving on; do not push each intermediate
commit. This preserves the shared deployment budget while keeping each review
concrete. Do not bump `PLAN_VERSION`. Keep secrets, logs and local browser
artifacts out of commits.

## Prioritized next five actions

These are supervised next actions, not approvals. The first three are static
improvements; Food Forest L3 slide 17 is already assigned separately and must
not be duplicated. Soil L3 is an investigation, not an automatic Flow order.
The separate September x1 attempt ledger records nine prompts / 900 displayed
credits; this is historical spend, **not** an account balance or authorization
for more prompts.

| Priority | Lesson / exact gap | Next action | Cost and gate |
| ---: | --- | --- | --- |
| 1 | **Food Forest Design L3**, slide 17: bullets are small at phone fit; slide 15's old Watch title has no current movie. | Large-label static improvement for slide 17 is already assigned separately; coordinate with that owner and do not start duplicate edits. Preserve existing teaching and coordinate the separate quiz source hold. | 0 Flow; separately assigned. No protected quiz correction without authorization. |
| 2 | **Vegetables L4**, slide 16: the current still shows possible pest responses but not the order in the protected English narration. | Create a readable static sequence at the existing 269px fit using only the already taught order and safeguards. Keep the withdrawn code-drawn animation out of the player. | 0 Flow. Preserve exact teaching claims; show the static candidate in the lesson review before release. |
| 3 | **Introduction to Permaculture L3**, slide 19: the windbreak still's embedded captions are tiny at phone width. | Make a large-label static layout from the existing slide content, keeping its hypothetical example and site-observation boundary clear. Keep the held code-drawn animation out. | 0 Flow. The lesson has separate source holds; do not add unsupported regional wind/rain directions or edit protected copy. |
| 4 | **Soil Health & Composting L3**, slide 14: current still is small at phone fit; prior rain comparisons, including the latest x1 shot, did not show a readable equal-rain impact contrast and the latest pooled water. | Flow lane investigates existing projects/reference material and whether one physically coherent, phone-legible impact contrast is achievable. Prepare one x1 prompt only if the gap remains concrete and a still cannot teach it; show the single output to Rory before registration. | 100 displayed credits per documented x1 prompt in the current attempt ledger; root supervises any spend. No prompt or reroll is pre-approved by this plan. |
| 5 | **Plant Selection & Guilds L1**, slide 23: labelled clip's text is small in the ordinary video frame; the full-size poster and narration carry detail. | Run the learner legibility check for the existing poster-zoom path before considering any static replacement. | 0 Flow. Retain the current clip absent a concrete learner failure. |

### Separate source holds — not Flow-lane candidates yet

- **Water Harvesting L1**, slides 4 and 7: existing review clips imply
  root-zone recharge and safe overflow outcomes the lesson/site evidence
  cannot establish. Source and farming-safety review the clips against the
  narration; keep the current still-only route unless adequate evidence and
  review support a change.
- **Small Livestock L3**, slide 14: the “closed loop” title/narration and
  circular diagram overstate the current nutrient evidence. Complete the
  source-backed packet and secure editorial ownership for any protected
  copy/visual changes. Keep current text and still pending that decision.

## Source paths and limits

- [Programme inventory](PROGRAMME-INVENTORY.md) — programme counts, module
  lessons, stated user scope and current overview.
- [Programme media matrix](PROGRAMME-MEDIA-MATRIX.md) — 51 slot records,
  exact current player state, registered paths and held reasons.
- [Active continuation](ACTIVE-CONTINUATION.md) — latest user boundaries and
  chronological deployed/review evidence. Prefer its latest dated entries over
  older narrative blocks.
- `lib/course-deck.ts`, `lib/course-audio.ts`,
  `lib/course-image-briefs.ts`, `lib/course-modules.ts` — actual registration,
  narration, image holds, lesson copy and quiz authority.
- `docs/media/studies-animation-quality/COVERAGE.md`, `STATUS.md`,
  `NEXT-ANIMATIONS.md`, `flow-x1-attempts-2026-09-22.md`,
  `held-authored-media-2026-09-22.md` and lesson-specific checks — review
  evidence and candidate limits.

The inventory and matrix are dated snapshots; `lib/course-deck.ts` is the
current registration authority. A registered or technically tested candidate
is not a visual or teaching approval. Browser cache results do not prove
physical-device storage, and a 269px fit check does not establish learner
comprehension. Human review, practitioner judgement, legal/source decisions
and fluent isiZulu review must be named as open wherever they have not occurred.
