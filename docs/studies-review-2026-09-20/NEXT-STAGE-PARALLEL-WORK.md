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
- Keep SVG or code-drawn motion out of the learner player under Rory's earlier
  visual-quality hold. Rory subsequently authorized continuing Flow animation
  work while he sleeps **without waiting for per-video approval**. Post each
  candidate for later visual review, but root must still reject inaccurate or
  unsafe motion before registration. Limit each Flow prompt to **one video
  output**; do not request another prompt without a distinct, source-backed gap.

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
   Rory to review later. Per-video approval is no longer a blocking gate for
   Flow, but root's farming and motion checks still are. A rejected or
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
source or content decision is open, or root's motion/farming check has failed.
Preserve protected copy,
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

## First five priorities and current outcomes

These were the first supervised priorities. Food Forest L3 slide 17 and Soil L3
slide 14 have since received static replacements on the preview. The Vegetables
and Introduction static concepts were held outside the player after phone/source
review. The separate September x1 attempt ledger now records **10 prompts /
1,000 displayed credits: 7 held or rejected, 3 technically registered**.
After the latest 100-credit Food Forest attempt, Google One showed Flow 0 and
AI 3,680; this is a point-in-time balance, not a reason to order another clip.

| Priority | Lesson / exact gap | Next action | Cost and gate |
| ---: | --- | --- | --- |
| 1 | **Food Forest Design L3**, slide 17: final caution was clipped. | Static three-card replacement deployed at `d9aa951f`; direct JPEG and 269px fit checked. Protected quiz source hold and post-deploy authenticated/offline recheck remain. | 0 Flow. Slide 15's separate grass-removal Flow x1 was held for an inaccurate large-clod action. |
| 2 | **Vegetables L4**, slide 16: current still lacks the decision order. | A source-safe static candidate was made, but its critical detail was too small at 269px; public still remains. A larger treatment would need coordinated lesson layout and safeguards. | 0 Flow. Do not use the rejected code-drawn movie or omit label/harvest safety text. |
| 3 | **Introduction to Permaculture L3**, slide 19: captions are tiny at phone width. | A 16:9 large-label example candidate is saved under `docs/`; it remains unregistered until the adjacent regional wind/rain source holds are resolved with protected teaching. | 0 Flow. Do not turn the north-west example into a general site direction. |
| 4 | **Soil Health & Composting L3**, slide 14: rain-impact labels were small; prior Flow shots pooled water. | Static large-label equal-rain comparison deployed at `860b4c62`. Direct JPEG/phone fit checked; authenticated player and offline-pack recheck remain. | 0 new Flow for this release. Prior rain clips remain held. |
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
