# ImbewuField — Onboarding, New-Site & Guided-Experience Plan

*Fable 5 synthesis, 2026-07-15. Owner: Rory. Status: DESIGN — approved scope pending Rory's read.*

## The problem, in Rory's words

> "I decided to try a new location… it gave me 50% done but I have done nothing here. The
> weather, crop plan, water harvesting — this is not relevant info for a new spot. We need to
> do a lot more first. Weather should be on the home page, and only show here once we've
> selected a site we already mapped. **We need to package that all correctly.**
> A gogo would be overwhelmed — unless you know what's going on it's very unclear what to do.
> There should be an onboarding experience — and it could be toggled off once you know it."

Three distinct failures, one root cause:

1. **Data leaks across sites** — a fresh pin showed another farm's parcels, harvest kL and
   crop plan. (The *score* leak is fixed — commit `d6840fa`, per-site inputs — but the report
   *cards* still render user-global data: `Your land` sums every polygon the user ever drew,
   `Harvesting areas` likewise, planting calendar/crop plan are global.)
2. **No staging** — a pin that is 30 seconds old renders the same 15-card report as a farm
   with a year of history. Irrelevant cards read as *wrong* cards.
3. **No guidance** — the app assumes you already know the loop
   (pin → save → trace → survey → design → plan). Nothing tells a first-time farmer that.

**Root cause: the report has no concept of how mature a site is.** Fix that once — a site
*stage* — and packaging, onboarding, and guidance all hang off it.

---

## Grounding (3-lane research, 2026-07-15)

**What already exists (build on it, don't duplicate):**
- First-run today = language picker (`components/Onboarding.tsx`, flag `permamap_onboarded`)
  → POPIA consent + **goal picker** (feed / income / soil) (`components/PopiaConsent.tsx`,
  key `imbewu_popia`) → home. **The goal is stored but nothing reads it** — free
  personalisation fuel for the coach. Two modals already stack on /home (z-100/z-110,
  PopiaConsent polls for the language flag) → the new-user welcome must be **home-page
  content, never a third modal**.
- Weather for the main site is **already on /home** (`MainSiteWeatherCard`,
  app/home/page.tsx:103-130) — Rory's "weather belongs on home" is shipped; the report
  side just needs the stage gate.
- The burial is real: tapping the map only *analyses* (Map.tsx `handleClick`); persisting is
  a secondary "Save this place" button (DataPanel.tsx:471-485) while the primary CTA is
  "Generate full report". Save must become the scout-stage hero.
- ROADMAP.md:63 already captures "Guided first-login journey (find land → trace → survey →
  design → crop plan)" as an idea — this plan is its concrete design.
- DESIGN.md constraints that bind this plan: task-first home (roles stay behind the
  Dashboards disclosure); **no emoji in UI — Lucide icons only** (the sketches below are
  illustrative); two typefaces; Lima "advises but never takes control"; don't reference
  Community (dark-launched). The "map = report dashboard + completion score" framing is
  Rory's new decision (this week) and is **not yet recorded in DESIGN.md** — Phase A must
  write it there (DESIGN.md is canonical and requires newer decisions to be recorded).

**External evidence (what works for novice / low-literacy / older users):**
- Coach-mark & tooltip tours fail — ~76-82% dismissed within seconds, no task-performance
  gain (NN/g et al). **Don't build a tour.**
- Persistent **checklists** work as the spine (LinkedIn profile-strength is the canonical
  model; Ghost: 5-step bar completers ~10× likelier to convert) — but only if every item is
  a real, necessary step. Our 5 stages are exactly that.
- **"Do one thing first"** beats explainer screens (Grammarly/Slack pattern): the first
  action should BE the product — drop a pin, get the scouting report.
- Emerging-market exemplars (PlantVillage Nuru, M-Pesa, iCow, WhatsApp): bypass literacy
  with icon+text pairing, colour never alone, radical choice-reduction (3-4 visible actions),
  local-language **voice/audio** as the highest-leverage accessibility investment.
- **Auto-graduation beats a manual "beginner mode" toggle** — self-assessing skill is itself
  a literacy-dependent decision. Unlock/retire guidance on milestones; keep a Settings
  toggle only as a power-user override.

---

## The core concept: SITE STAGES

Derived from the (now per-site) completion inputs that already exist in
`components/DataPanel.tsx` → `lib/completion-score.ts`. One new pure function:

```
deriveSiteStage(inputs): 'scout' | 'saved' | 'traced' | 'designed' | 'planned'
```

| Stage | Meaning | Signal (already computed) |
|---|---|---|
| **scout** | a pin was dropped, nothing else | `!hasSite` |
| **saved** | "this is my site" | `hasSite` (active saved place) |
| **traced** | boundary drawn near these coords | `boundaryPointCount ≥ 3` |
| **designed** | survey and/or design underway | `zoneCount+elementCount > 0` or survey > 0 |
| **planned** | crop plan attached | `hasCropPlan` |

**The stage gates what the report shows. The next stage is always advertised as the single
obvious next action.** The empty state IS the onboarding — no tour, no tooltips.

### What each Overview card requires

| Card | Visible from stage | Below its stage it shows… |
|---|---|---|
| Scouting report (biome, rainfall normals, soil, frost, elevation, BRU, key species, challenges) | **scout** | — always on; this is the "drop a pin, get intelligence" magic |
| **Save this site** hero CTA | **scout only** | replaced by checklist once saved |
| Completion checklist + donut | **saved** | hidden at scout (a pin isn't a project yet) |
| Weather forecast widget | **saved** | *nothing* — weather lives on the **home page** (main site) until a site is yours |
| Your land / parcels | **traced** | 🔒 teaser: "Trace your boundary to measure your land →" |
| Harvesting areas / water | **traced** | folded into the same teaser |
| Site survey card | **saved** | — it *is* the stage-2 next action |
| Design overlay toggle + design cards | **designed** | 🔒 "Design your farm in the Studio →" |
| Planting calendar / crop plan / food value | **planned** | 🔒 "Make your crop plan →" |
| Lima insight paragraph | **scout** | fine at all stages (it reacts to what exists) |

Rules:
- A 🔒 teaser is ONE line with an arrow — tap = go do it (deep-link to trace mode / survey
  sheet / studio / crop planner). Never a dead lock icon.
- Cards never render another site's data. `Your land`, `Harvesting areas`, planting calendar
  must apply the same ~2 km proximity / per-site scoping the score now uses.
- **Weather placement (Rory's call): home page = weather for the main site (already live).
  Report = weather only for a saved site.**

---

## New-user onboarding (first sign-in)

**Home page, when `loadPlaces()` is empty:** replace the returning-user content with a
welcome that offers **at most two choices** (evidence: low-literacy users abandon on choice
overload; one action per screen):

```
🌱  Molo Rory! / Hello Rory!          ← greet by profile name, in their language
    Let's find your land.
    [ 📍 Find my land ]               ← primary, huge, one action
    [ 👀 Show me an example first ]   ← optional, Phase C (demo site)
```

"Find my land" → `/farmer` in **guided pin mode**: search box front-and-centre
("Type your town or tap your home on the map"), satellite behind, one instruction bar.
Drop pin → the scouting report slides up (stage `scout`) → its hero is **Save this site**
→ saving flips to stage `saved`, checklist appears, step 2 ("Trace your boundary") glows
with a "Show me" button that arms trace mode.

**Returning user with sites:** home shows main-site weather (live today) + "Continue with
{site} — you're at {n}%" + "Start a new site". *That's the "do you want to start a new
site OR continue" Rory asked for.*

**New-site experience = the same guided pin flow**, entered from "Start a new site"
(home) or Places tab. Score starts at 0% (fixed). Nothing from other sites bleeds in
(stage-gating guarantees it visually; per-site scoping guarantees it in data).

---

## Guided mode — "Lima shows me what to do"

**Not** coach-marks/tooltip tours (well-documented failure with novice + low-literacy
users: tooltip blindness, dismissed once, never recoverable). Instead:

**`NextStepCoach`** — ONE persistent, dismissible card pinned above the report content
(and mirrored on home), always showing the *single* next action for the current stage:

```
👣 Next step: Walk your boundary
   Tap the corners of your land on the map. Lima can guide you.
   [ ✏️ Trace now ]        [ 🔊 audio in your language — Phase C ]
```

- Driven by `deriveSiteStage` — zero new state to maintain.
- **Auto-graduation is the primary mechanism** (per the evidence — a manual "beginner mode"
  choice is itself a literacy-dependent decision): the coach retires itself when the user
  reaches stage `planned`, or after being dismissed 3×; a small "?" affordance remains.
  A Settings → "Guide me" toggle exists as the power-user override (Rory's ask), flag
  `imbewu_guided_mode` (versioned — see PWA risk below).
- **Personalise with the POPIA goal** that's already captured but unused
  (`imbewu_popia`: feed / income / soil): "Goal: feed the family → your crop plan will
  favour year-round food crops."
- Copy: short sentences, icon + text pairing (never icon-only, never text-only), ≥48 px touch
  targets, the site's existing 11-language `t()` pipeline.
- Lima (the chat widget) stays the free-form helper; the coach is deterministic — they don't
  compete, the coach's "Ask Lima" affordance opens chat pre-seeded with the step.

---

## Site-report header collapse (Rory's space complaint)

The `SITE REPORT / Grassland / Eastern Valley Bushveld / coords / Good fit` block:

- **On scroll** (or automatically from stage `traced`+): collapse to a slim single row —
  `Grassland · Good fit ✓` with the donut % as a small ring — tap to re-expand.
- Keeps tabs visible; frees ~120 px for the content the farmer came for.
- Pure DataPanel change; no data work.

---

## Phasing (each = one build session; verify + ship per lane)

**Phase A — "package it correctly" (the screenshot fixes; ships first)**
1. `deriveSiteStage` in `lib/completion-score.ts` (pure, tested).
2. Stage-gate the Overview cards per the table + 🔒 teaser rows with deep links.
3. Per-site scoping for the *display* cards (`Your land`, `Harvesting areas`, planting
   calendar) — same ~2 km convention as the score.
4. Weather: remove from `scout`-stage report (home already has it).
5. Save-this-site hero at scout stage (today it's buried at the report's bottom).
6. Header collapse-on-scroll.
7. Record the new decisions in design/DESIGN.md (map = report dashboard, site stages,
   completion score) — it's the canonical doc and requires it.
*Risk: low. Files: DataPanel.tsx, completion-score.ts, small helpers. No map surgery.*

**Phase B — welcome + guided mode**
7. Home first-run welcome (places-empty branch) + "Start a new site" for returners.
8. Guided pin mode on /farmer (search-first instruction bar).
9. `NextStepCoach` + settings toggle + auto-graduation.
*Risk: low-medium. Home + farmer page + one new component.*

**Phase C — the full experience (needs Rory's product input)**
10. Demo/example site ("show me an example first").
11. Facilitator-assisted onboarding — onboard a farmer *for* them. **Undocumented in
    DESIGN.md — a real product gap; needs Rory's decision on who initiates.**
12. Lima voice/audio guidance per step, all 11 languages (the single highest-leverage
    accessibility investment for this audience — PlantVillage-style TTS).
13. Test with a real gogo; consider the M-Pesa lesson — a WhatsApp/USSD-degradable entry
    channel may matter more than any in-app polish for the least-connected users.
*Risk: medium; do after A+B prove the shape.*

## Implementation risks (from the code audit — the builder must respect these)

- **No third modal on /home** — language + POPIA already stack (z-100/z-110, one polls for
  the other); the welcome is the page's places-empty content branch.
- **Hydration**: every first-run flag starts "already seen" on SSR and flips in an effect
  (the `permamap_onboarded` pattern) or the modal flashes. New surfaces must be client-only
  and tolerate a default first paint.
- **PWA staleness**: version any new flag (`imbewu_guided_mode_v1`) — a cached client can
  resurrect a retired coach after deploys.
- **Auth is soft**: /home renders signed-out; only /farmer guards (and only when Firebase is
  configured). Onboarding can't assume a profile exists — localStorage is the truth.
- **Per-site scoping**: guided flow must reuse the completion-score inputs' scoping
  (~2 km boundary proximity, surveySiteId keys) or cross-site bleed returns.
- **Copy honesty**: the one-surface merge is mid-flight (Phase 1 only) — onboarding copy
  must describe today's flow (trace on map → adopt in Studio), not the aspirational weld.

---

## Economics / model choice (Rory's question)

- **This plan = Fable 5 work — done** (you're reading it).
- **Implementation = Opus-main-loop work.** Fable main-loop tokens cost ~2× Opus and
  every chat message re-sends history at that rate; Phases A–B are execution against a
  written spec — exactly what Opus + Sonnet/Haiku subagents do at half the price.
- **Recommendation: switch to Opus for the build session(s), point it at this doc.**
  Phase A is one session; Phase B one more. `/compact` between phases.
