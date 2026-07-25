# Handover — 2026-07-25, Claude

> This document was drafted as a briefing in parallel with the implementation it describes, then
> completed with a verified "Status at handoff time" section once that implementation was done and
> tested. The architecture/context sections below were written first and describe the codebase as
> found; the Status section at the end describes what actually changed and was verified.

## Start here

- Repository: `/Users/roryclark/ImbewuField`
- Working branch: `codex/reference-blueprint-quality`
- Production: `https://imbewufield.vercel.app`
- Confirm the deployed commit before judging any result:
  `https://imbewufield.vercel.app/api/build-info` (route lives at `app/api/build-info`) — compare
  its SHA against `git rev-parse HEAD` on this branch. Do not assume a push reached the production
  alias; prior handovers on this repo have documented pushes that built successfully but never
  got assigned to the live domain.
- Read `docs/PLAN-SET-SPEC.md`, `docs/RENDER-INVESTIGATION.md` (or its dated variant), and
  `docs/GLOSSY-PROMPT-AUDIT.md` before changing render code — referenced by the prior Codex
  handover as required background.
- The prior handover this document supersedes/extends is
  `docs/CLAUDE-HANDOVER-2026-07-25.md` (identical to
  `~/Downloads/IMBEWUFIELD-CLAUDE-HANDOVER-2026-07-25.md`), checkpoint commits `6ec2105` /
  `ee96173`. Read it in full — this document assumes it and corrects one part of its contract
  (below). It is also worth reading `docs/HANDOVER-2026-07-21.md` in full for the recurring bug
  pattern summarised near the end of this document.

## The corrected product contract

Rory's instruction, verbatim, supersedes part of the Codex handover's framing of the 8×3 matrix:

> "i want every layer map to have 3 choices (and must work) straight canvas render, 2)hybrid AI
> polish underlayer, b) our polished elements overlayed; 3) full treatment hybrid + 2nd step AI
> polish. Now all sheets regardless must be able to go through this with the right treatment and
> prompts etc."

Read literally, this is **8 sheets × 3 output modes = 24 working paths, with no sheet exempt**:

1. **Exact Canvas** — satellite/base + exact app-owned geometry and symbols. Deterministic, free,
   instant.
2. **Geometry-Locked Hybrid** — a model-painted/illustrated underlayer, with the app's exact
   geometry, routes, labels, leaders, legend, north arrow and scale composited on top. Saved
   source geometry is never changed by this step.
3. **Full Treatment** — Hybrid is built first, then that complete Hybrid sheet is sent for one
   additional paid, sheet-specific AI polish pass. That pass may improve materials, realism,
   typography and editorial finish, but must not invent, move, remove, resize, recount or relabel
   any factual content.

### The Site / Phasing resolution

The Codex handover's matrix and the current code both treat Site (01) and Phasing (08) as special
cases — Phasing has **no AI branch of any kind today** (`components/design/DesignGlossy.tsx`
around the `runLockedPolishFlow` early-return: *"The Phasing sheet stays exact because AI must not
rewrite dates, tasks or hold points."*, and again where sheet selection forces `exact` mode for
`sheet.exact === 'implementation'`, with the comment *"a model that misspells 'greywater' must
never own a build calendar"*). Site currently has a restyle-only AI option (ground-texture pass)
shared with Sector, but no dedicated Full Treatment stage.

**This is not a reason to exempt Site or Phasing from the 3-choice UI.** Rory's instruction is
explicit that all 8 sheets get all 3 choices. The resolution is architectural, not a carve-out:

- For Site and Phasing, Hybrid and Full Treatment must constrain the AI to **decorative
  background/context art only** — ground texture, materials, illustrative style — using the same
  "paint the fabric, never the facts" pattern already proven on Sector
  (`buildSectorRestylePrompt` in `lib/producer-prompt.ts`: the model repaints ground/roof/driveway
  texture; `composeSectorSheet` in `DesignGlossy.tsx` then draws the true boundary, house,
  driveway and every analytical mark on top from measured data, never from the model's
  interpretation).
- The deterministic facts for these two sheets — Phasing's build-schedule dates, tasks and hold
  points (from `lib/phasing.ts`'s `buildPhasePlan`, a rules-engine render); Site's site facts —
  remain 100% app-owned and are drawn on top exactly as they are today, using the identical
  composite-back pattern every other sheet's Hybrid mode already uses (deterministic chrome
  burned in after the model returns, not before).
- So: 24 real UI paths, no sheet hidden or disabled — but for Site and Phasing specifically, the
  Hybrid/Full Treatment prompts must be written (or reused) so the model never sees, and is never
  asked to render, any schedule text, task list, or hold-point content. This is a sheet-specific
  prompt-writing constraint, not a mode-count exception.

Style choice must stay independent of output-mode choice on every sheet: changing style must never
silently downgrade Full Treatment to Hybrid or Exact Canvas (this is called out explicitly in the
Codex handover and is worth re-testing once the matrix is wired, since it is exactly the kind of
thing that regresses silently).

## Architecture summary — what exists today and what it means for the 24-path build

### The render-jobs.ts + Cloud Function pipeline (this IS the reusable Hybrid mechanism)

`lib/render-jobs.ts` (client) and `functions/src/index.ts` (worker) together are the background
AI-render pipeline used for every paid render today:

1. The browser builds a composite PNG (existing `DesignGlossy.tsx` code) and a prompt string.
2. `enqueueRenderJob()` uploads the composite (and an optional protect-mask PNG) to Firebase
   Storage, then writes ONE `render_jobs/{jobId}` Firestore doc containing one `RenderSheetSpec`
   per sheet (key, label, prompt, storage paths, `showcase`/`geometryLock` flags).
3. The Cloud Function `runRenderJob` (triggered `onDocumentCreated`) is the **enforcement
   boundary** — the job doc is treated as untrusted input. It re-derives the storage path
   server-side (never trusts the client path), enforces a kill switch
   (`app_config/renders.enabled`), a per-user daily quota and a whole-app daily budget
   (`render_usage/*`), and only then calls OpenAI's `images/edits` endpoint (model
   `gpt-image-2`) once per sheet, writing the raw output PNG back to Storage.
4. The browser's `subscribeRenderJob()` listens to the job doc; as each sheet flips to `done`,
   `fetchRenderOutput()` downloads the raw model output and the browser does its **own fast,
   deterministic composite-back** — burning in the exact boundary clip, labels, legend, north
   arrow etc. on top of the model's painted underlayer. Only the slow OpenAI call happens on the
   worker; compositing is client-side and free.

This is exactly the "Hybrid" mechanism the corrected contract needs, and it already generalizes
across sheets reasonably well for the 5 design-layer sheets (Zones, Water, Planting, Structures,
Whole — `GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures'`,
`lib/glossy-filters.ts`).

**Important nuance found while reading the code**: Site, Sector and Phasing are NOT part of
`GlossyLayerFilter` at all. They are handled by a separate, parallel code path
(`generateSectorViaQueue(kind: 'sector' | 'base')` in `DesignGlossy.tsx`, using
`buildSectorRestylePrompt` / `buildSectorSheetPolishPrompt` / `composeSectorSheet`) that
duplicates — rather than reuses — the same "model paints texture, app draws facts on top" idea the
5 design-layer sheets already implement generically. See "Recurring bug pattern" below: this is
precisely that pattern, already present in this exact subsystem, before the 24-path work even
starts.

### The Full Treatment two-stage mechanism already exists — for 5 of 8 sheets

The "Hybrid → send that complete hybrid sheet for one more paid pass" mechanism the corrected
contract calls "Full Treatment" is **already built and working** for the 5 design-layer sheets,
via `generateOneViaQueue()` in `DesignGlossy.tsx`:

- `lockedPolishStage === 'ai'` triggers `fullSheetPolish`.
- The composite fed to `enqueueRenderJob` is **not a fresh satellite composite** — it's the
  already-rendered, already-composited exact/hybrid sheet built by e.g. `buildBlueprintWaterMap`
  / `buildBlueprintZoneMap` / etc.
- The prompt is `buildFinishedSheetPolishPrompt(layerLabel, styleKey, placeName)`
  (`lib/producer-prompt.ts`), which explicitly tells the model "the supplied image is the factual
  blueprint... PRESERVE THE DESIGN... do not move, resize, merge, duplicate or omit anything" and
  to polish materials/typography/finish only.
- The job's `showcase`/`geometryLock` flags are set so the finisher does NOT re-burn deterministic
  chrome over this result — the whole point is that the returned image already contains the
  finished page.

Sector has its own **separate, independently-written implementation of the identical idea**:
`generateSectorViaQueue(kind: 'sector')` sets `fullSectorPolish = true`, builds the input via
`composeSectorSheet(null, ...)` (the complete deterministic Sector sheet) and prompts with
`buildSectorSheetPolishPrompt` — a different function with materially the same intent as
`buildFinishedSheetPolishPrompt`, written separately, worded differently, and requiring separate
maintenance if the polish contract ever needs to change (e.g. a wording fix to `buildFinishedSheetPolishPrompt`
would silently not apply to Sector, and vice versa).

Site (`kind: 'base'`) has **no Full Treatment stage at all today** — `fullSectorPolish` is only
`true` when `kind === 'sector'`; the `base` branch always uses the restyle-only prompt regardless
of which polish stage is requested. Phasing has no AI branch of any kind (see above).

### What's reusable vs. what needs new plumbing

**Reusable as-is:**
- The entire `render-jobs.ts` / `functions/src/index.ts` job-queue mechanism (upload → Firestore
  doc → worker → Storage → client composite-back). This does not need to change shape for any of
  the 24 paths; it just needs to be called with the right sheet key, prompt and composite input
  for each of the 8 sheets × up to 2 AI stages (Hybrid, then optionally Full Treatment).
- `buildFinishedSheetPolishPrompt` as the generic "second paid pass over an already-finished
  sheet" prompt — this is the right shape to extend to Site/Sector/Phasing rather than maintaining
  Sector's separate `buildSectorSheetPolishPrompt` indefinitely. Worth a deliberate decision (not
  a silent one) whether to consolidate Sector onto the generic function or keep it separate with a
  documented reason — see the recurring-bug-pattern section below before choosing "keep both."
- `lib/render-policy.ts`'s `renderPolicyForStyle` / `renderAuthorityFlagsForStyle` /
  `hasConflictingRenderAuthority` — the single authority-decision function already used to derive
  `showcase`/`geometryLock` flags consistently. Any new sheet-mode wiring should call through this,
  not reimplement the decision.
- `lib/sheet-store.ts`'s `StoredSheet` shape (`resultKind`, `provider`, `geometryLock`,
  `showcase`) is already the durable provenance model the Codex handover calls for. It does not
  need new fields for the 24-path work — it needs every save-site to populate it honestly, which
  is a verification task, not a schema task.

**Needs new plumbing:**
- A single shared "Choose output" control/state (Exact Canvas / Hybrid / Full Treatment) that
  drives all 8 sheets through one contract, replacing the current bespoke per-sheet-type branching
  (`DESIGN_SHEETS`'s `exact`/`aiAnalysis` vs `filter` union, plus the separate
  `generateSectorViaQueue` vs `generateAllViaQueue`/`generateOneViaQueue` call sites).
- A true two-stage Full Treatment path for Site and for Phasing: a Hybrid stage (model paints
  decorative texture only, app burns in facts) followed by a second job that feeds the *composited
  Hybrid PNG* back in as input for one more polish pass — the same sequential-job pattern
  `generateOneViaQueue`'s `fullSheetPolish` already proves out for the 5 design-layer sheets, not
  yet built for these two.
- Sheet-specific prompt content for Site and Phasing's Hybrid/Full Treatment passes that
  constrains the model to decorative-only output and never exposes schedule/task/hold-point text
  to the model at all (the safest version of this sends the model an input image that never
  contains the schedule text in the first place, rather than relying on prompt instructions alone
  not to touch it).
- The worker allow-list fix below (`ALLOWED_KEYS` has no `'phasing'` entry) — a concrete blocker
  for any Phasing AI path, not just a documentation gap.

## Known bugs to fix

### 1. Water "AI-polished" output looking suspiciously identical to the plain Hybrid (provenance bug, unresolved)

Per the Codex handover: recent Water results labelled `Master Atlas` looked very similar to the
deterministic hybrid. This is flagged there as an **unresolved provenance/output-validation bug**
— treat it as unresolved until raw provider output and durable `StoredSheet` metadata
(`resultKind`, `provider`) prove otherwise. Concretely: verify a real Water Full Treatment render
in production, confirm the gallery entry's `resultKind`/`provider` fields are honest (not
inherited/defaulted from an earlier save), and confirm the actual pixels are visibly
model-authored rather than the Hybrid composite saved a second time under a different label. Do
not trust the on-screen badge text alone — the whole point of the `StoredSheet` provenance fields
is that labels are presentation copy, not proof (see `lib/sheet-store.ts`'s own comment: *"Labels
are presentation copy and must never be used to infer whether a paid model actually produced the
saved pixels."*).

### 2. `functions/src/index.ts`'s `ALLOWED_KEYS` has no `'phasing'` entry

```ts
const ALLOWED_KEYS = new Set(['all', 'water', 'zones', 'planting', 'structures', 'sector', 'base']);
```

This is a real, concrete implementation requirement, not just a documentation note: if Phasing
needs an AI path under the corrected contract, any sheet enqueued with `key: 'phasing'` (or
whatever key is chosen for it) will be rejected server-side with `status: 'error', error: 'unknown
sheet'` (see the loop right after job claim in `runRenderJob`) even if every client-side prompt/UI
change is done correctly. The worker allow-list has to be updated in the same change as any
client-side Phasing-AI wiring, or the failure will look like a client bug when it is actually this
list. Note also that `'whole'` isn't a separate key either — the Whole/masterplan sheet uses key
`'all'`, which IS already in the allow-list; only Phasing is actually missing.

## Non-negotiable safety rules

Copied verbatim from the Codex handover's "Non-negotiable safety rules" section — these are
load-bearing and should not be paraphrased away:

> - Do not mutate saved item, line, zone, house, driveway, or boundary geometry during rendering.
> - Presentation zoom must remap coordinates and `mPerPx` together in temporary render state only.
> - Houses, driveways, boundaries, tanks, beds, routes, and counts come from saved design data.
> - Do not invent features, climate facts, slope direction, wind evidence, species, or labels.
> - Sector slope is shown only when local DEM evidence passes its confidence gate.
> - Keep Gemini and legacy code dormant and recoverable; do not delete rollback paths.
> - Preserve the exact no-AI master separately from every paid result.
> - Test and build before deployment. Explicitly assign the production alias only after
>   verification.

The corrected 24-path contract adds one implied rule in the same spirit, stated here because it
follows directly from the above and from Rory's Phasing/Site framing: **Phasing and Site facts
(build-schedule dates, tasks, hold points, site facts) must never be AI-authored, under Hybrid OR
Full Treatment, on any sheet.** Only decorative/background art may pass through the model for
these two sheets — this is not weaker than the rules above, it is those same rules applied to two
sheets that didn't have an AI path to apply them to until now.

## The recurring bug pattern — read this before adding anything

This is the single most valuable lesson carried forward from `docs/HANDOVER-2026-07-21.md`, and it
is worth restating because this exact codebase area (render pipeline, prompt builders, sheet
membership) is where it has bitten hardest, repeatedly, including inside the files this document
just walked through:

**This codebase has more than one place that answers the same question**, and every one of them
was added independently, at a different time, by a different pass. They agree today. They will
not agree tomorrow unless every new place that needs the answer reuses the existing lookup instead
of writing a new one.

Confirmed instances from the 2026-07-21 session (still worth knowing, even though fixed then —
the pattern recurs, not these specific bugs):
1. A ground feature's AI-prompt-facing name diverged from its canvas/sheet name — three separate
   naming functions, only some of which checked the farmer's custom name first.
2. `lat < 0 → north` hemisphere assumption hardcoded independently in `lib/sector.ts`, three
   separate API route call sites, and a fourth copy in `components/GeometryDesignStudio.tsx`
   nobody remembered existed until specifically searched for.
3. A legend-row numbering scheme capped at 9 glyphs while a sibling feature independently added a
   10th possible row — two different things both rendering as the same glyph on a real site.
4. Wind-direction text hardcoded as a literal string in one legend row instead of reading the same
   field the map arrow itself used.
5. AI-illustration prompts gave the model texture vocabulary for several ground types but not
   paved/concrete ground, in **two separate prompt-building functions** that each independently
   list ground textures.
6. A "which step owns this shape" question was nearly answered a SECOND, different way in a draft,
   using a different lookup than the existing one — different questions that happen to agree for
   most elements but disagree for four specific ones.

**A live example of this same pattern found while writing this document, in the exact subsystem
the 24-path work will touch**: `buildFinishedSheetPolishPrompt` (generic Full Treatment prompt,
used by 5 sheets) and `buildSectorSheetPolishPrompt` (Sector's own, separately-written version of
the same idea) both exist in `lib/producer-prompt.ts` today, doing materially the same job with
different wording and no shared source of truth. Whoever builds the Site/Phasing Full Treatment
paths will be tempted to write a *third* one. Before doing that: check whether Sector's separate
prompt exists for a real, documented reason (it does have sheet-specific content — analytical
marks like sun arcs and bearings that the design-layer sheets don't have) or whether it's drift
that should be consolidated. Either way, make the decision explicit and comment it, rather than
letting a third near-duplicate appear silently.

**When adding anything that needs to know "what is X called" or "which sheet/mode/authority does X
belong to": grep for the existing answer first.** In this specific area, check in this order:
`lib/render-policy.ts` (render authority decision), `lib/glossy-filters.ts` (sheet/layer/step
membership), `lib/producer-prompt.ts` (existing prompt builders — search for `Polish` and `Locked`
to find the existing family before writing a new one), `lib/sheet-store.ts` (provenance shape). If
you're about to write a new prompt-builder function or a new `Record<Sheet, ...>` lookup, stop and
check whether one already exists that should be extended instead.

## Status at handoff time

Filled in by Claude after doing the implementation described below — every claim here is either a
verified command output or explicitly marked as unverified. Commit `ed8da18` on
`codex/reference-blueprint-quality` (on top of the `ee96173` checkpoint this document assumed).

### Done and verified

- **Root cause fixed for 7 of 8 sheets** (Whole, Zones, Water, Planting, Structures, Sector, Site):
  the paid flow now genuinely runs exact → hybrid → polish in sequence. `generateOneViaQueue`'s
  `fullSheetPolish` branch and `generateSectorViaQueue`'s `fullSectorPolish` branch both used to
  feed the polish prompt a freshly rebuilt EXACT sheet (nothing painted by AI yet) — that's why
  Water's paid result looked unchanged, and by construction the same bug applied to every other
  sheet through this flow, not just Water. Both now feed the polish prompt the FINISHED Hybrid
  sheet (real AI-painted underlayer, our exact elements already composited back on top), stashed in
  a new `hybridResultRef` when the Hybrid stage completes and consumed once by the polish stage.
- `lib/locked-polish-flow.ts`'s state machine grew from 2 stages (exact→ai) to 3 (exact→hybrid→
  polish); `tests/locked-polish-flow.test.ts` rewritten to cover both the Hybrid-only path (stops
  after hybrid) and the Full Treatment path (continues into polish) plus the wait/gating cases.
- UI: the old binary "AI-polished / Exact only" choice is now three explicit buttons — Exact
  Canvas, AI Hybrid, Full Treatment — for every sheet except Phasing (Site included).
- Fixed a real mislabeling bug found while reading the code, not hypothesised: the queue-completion
  handler tagged `showcase:false && locked:false` results as `resultKind:'ai-polished'`, which is
  definitionally impossible under the 3-mode contract (an unlocked, non-showcase result was never a
  genuine paid polish). Now tags `'legacy'`. Gallery label text also now distinguishes "AI hybrid"
  from "AI polished" instead of always saying "AI polished" regardless of which stage produced it.
- Sector's Hybrid stage is now correctly tagged `geometryLock:true`/`resultKind:'hybrid'` (it was
  always saved as an unlocked/mislabeled result before, since `generateSectorViaQueue` hardcoded
  `geometryLock: false` for every job).
- **Verified by running the commands, not assumed:** `npx tsc --noEmit` clean. `npm test`: 188/188
  passing (187 baseline + 1 net new test). `npm run build`: clean production build, no errors.

### Deliberately NOT done this pass — read before continuing

- **Phasing has no AI path, still.** Not an oversight — a genuine product-design question I did not
  answer unilaterally. Every other sheet's Hybrid stage has an obvious underlayer to paint (a map:
  ground, zones, water routes). Phasing's exact sheet is a lettered build-schedule table with
  minimal map content — what "AI Hybrid" should even mean visually for it is not obvious, and the
  safest execution (never let the model SEE the schedule text at all, rather than trusting a prompt
  instruction not to touch it) needs a new mask, not just a new prompt. Given this is the one sheet
  where the codebase's own safety rule is strictest ("a model that misspells 'greywater' must never
  own a build calendar"), this needs Rory's confirmation of the visual concept before building it,
  not a guess. `functions/src/index.ts`'s `ALLOWED_KEYS` correctly still has no `'phasing'` entry —
  update it in the same change whenever this gets built, or the failure will look like a client bug.
- **Site's Hybrid/Full Treatment now genuinely chains two real AI passes, but still does not
  composite exact boundary/driveway/house back on top afterward** — it ships the model's raw ground
  paint, same as Site's restyle always has. This is a pre-existing limitation, not introduced by
  this change, but it means Site does not yet fully deliver the "our exact elements locked back on
  top" half of the Hybrid definition the way the other 6 sheets do. Fixing it needs a Site-specific
  protect mask (the other sheets use `buildProtectMask`, keyed by `GlossyLayerFilter`, which Site
  isn't part of) — scoped but not built.
- **No live, real AI-render verification was done.** The Design Studio requires an opened site with
  real design data; the sample farm exists for exactly this kind of walkthrough but deliberately
  disables AI rendering to prevent test spend (`lib/sample-mode.ts`'s `isSampleMode()` check in
  `enqueueRenderJob`), and no authenticated session was available in this environment. `tsc`/`test`/
  `build` all passing is necessary, not sufficient — the fix is a strong, specific logical inference
  (there is now genuinely something painted before the polish step runs) but has NOT been confirmed
  by looking at a real rendered Water sheet. That confirmation — generate a real Water Full
  Treatment in production, look at it, confirm the gallery badge and pixels agree — is the next
  concrete step, on Rory's own account, same as every other AI-render check this session.
- Did not consolidate `buildFinishedSheetPolishPrompt` and `buildSectorSheetPolishPrompt` (flagged
  above as the recurring-pattern example). Decision made explicitly, not by default: kept them
  separate, because Sector's polish prompt legitimately references analytical content (sun arcs,
  bearings) the 5 design-layer sheets don't have — reused the generic one for Site's new polish
  stage instead of writing a third near-duplicate.

## Working style notes

Carried forward from `docs/HANDOVER-2026-07-21.md`, still accurate and still the standing bar:

- Rory tests on his own real phone and real account constantly, mid-session, and sends
  screenshots — treat every one as ground truth about what's actually shipped, not what a commit
  message claims. Prior sessions found "already fixed" things that turned out to only be fixed in
  ONE of two render paths (canvas vs. sheet, exact vs. AI) — check both before saying something is
  done.
- He has said, verbatim, "i want you to check it before you say its done because it wastes my
  time." A gate pass (`tsc`/`test`/`build` all green) is necessary, not sufficient — actually
  render the thing and look at it when you can.
- He is direct and will say plainly when something isn't good enough. That has been accurate
  signal every time, not noise.
- He has repeatedly caught the gap between "the gate is clean" and "I actually looked at it," and
  between a claimed fix and a fix that actually shipped to production — including a case where a
  fix was verified in only one of two render paths and reported as done regardless. Precision and
  honesty about what has and hasn't been verified matter more than speed or a reassuring summary.
