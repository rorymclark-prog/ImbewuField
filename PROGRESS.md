# ImbewuField — Build Progress

**Picking this up (incl. cloud / phone Claude Code)?** Read **this** file for *what's
done and what's left*, and **`design/DESIGN.md`** for the *design system + per-frame
status*. The visual source of truth is `design/handoff/*.png` (33 frames) and the
build brief is `design/BUILD-INSTRUCTIONS.md` + `design/MAP-TOOLS-CORRECTIONS.md`.

**Update this file after each work iteration** — add a dated bullet to the top of
the Build Log, and move anything finished out of "What's left".

- **Repo:** `rorymclark-prog/ImbewuField` (its own repo — NOT the `~/Claude` monorepo)
- **Live:** `imbewufield.vercel.app` (also `permamap-sa.vercel.app`, `fieldproof.vercel.app`)
- **Deploy:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys to Vercel (~2 min).
- **Stack:** Next.js 14 App Router · TypeScript · Tailwind · Firebase/Firestore · Mapbox GL · Anthropic (`claude-sonnet-4-6`).

---

## Status — 2026-06-23

**Every screen in the 33-frame handoff is built and live, except the Google
Sheets / Calendar OAuth sync** (which needs a Google Cloud OAuth client the owner
must provision — not buildable from code alone).

### What's live
- **Auth** — email/password + Google sign-in + password reset + change-password +
  profile photo. Firebase env is set in the Vercel project; Auth authorized domains
  include the vercel.app domains + localhost. (Site gate via `SITE_PASSWORD` env.)
- **Roles** — five: farmer · mentor · student · ngo · funder (+admin). Mentor merges
  the old supervisor + trainer. Task-first home; roles behind a quiet "Dashboards" link.
- **Map** (`/farmer`) — search/analyse, draw land boundary + water storage (reticle
  **or** GPS-walk), satellite/topo/HD/contours/relief/3D layers, Save-place pins
  (named + coloured by label), redesigned calm tools panel, Lima coach-marks ("?").
  Responsive: landscape/desktop = side panel; phone + portrait tablet = bottom sheet.
- **Lima Vision** (`/vision`) — photo → Claude estimates crop + yield + weeks, or weighs a harvest.
- **Crop Planner** (`/plan`) — crops with bed quantities → projected plants/kg.
- **Crop Plan** (`/cropplan`) — Day/Week/Month/Season task scheduler.
- **Garden Survey** (`/survey`) — 5-step wizard → Lima-sized beds → 6-week plan + print.
- **Calendar** (`/calendar`) — SA planting calendar, filtered to your crops.
- **Field Journal** (`/journal`) · **Report** (ReportView, AI, print/share).
- **Finances** (`/finances`) — Money in/out logging (+ **scan a till slip** OCR);
  desktop **financial sheet** (ledger + CSV export) at lg+; **Invoice** builder (`/invoice`).
- **Surveys** (`/surveys`) — NGOs build, farmers answer in-app.
- **Mentor / NGO / Funder / Student** dashboards.
- **Onboarding** — language picker + POPIA consent + "get to know you" (`PopiaConsent`).

---

## Build Log (newest first)

### 2026-07-19 (production Geometry Lock quality audit + reversible style reference)
- Verified Geometry Lock against the real saved **Carl and Sandys Place / Water** sheet on the
  production domain. The exact house, driveway, boundary, labels and tool-glyph cleanup improved,
  but the first production result was still too dark, photographic and visually flat compared with
  Rory's direct ChatGPT map set. Do not use the earlier local comparison as a quality claim.
- Added an appearance-only reference image cropped from Rory's direct ChatGPT planting map. The
  worker sends it as Image 2 only for **Precision Atlas + Geometry Lock On**; Image 1 remains the
  sole source of geometry and content. Other styles and Geometry Lock Off keep the existing
  single-image workflow, so the experiment can be disconnected instantly.
- Strengthened the deterministic Precision Atlas context palette without moving any pixels. The
  house/driveway restore, water symbols, leaders, legend, boundary, north arrow and scale remain
  browser-drawn from saved map data, not invented by the model.
- Unit tests, TypeScript checks and both app/function builds pass locally. Final sign-off still
  requires deploying `runRenderJob` after Firebase CLI reauthentication, deploying Vercel, using
  the in-app **Refresh update** action, and inspecting a newly generated production Water sheet.

### 2026-07-18 (geometry lock toggle + reversible queue mask)
- Added an opt-in **Geometry Lock** switch to the glossy gpt-image-2 queue path, so the strict
  render can send a protect mask only when requested and restore the protected source pixels after
  the model returns.
- Threaded the optional mask through the background render job contract and worker, while keeping
  the existing showcase/AI-legend pipeline dormant and untouched.
- Added a focused test for the new pixel-restore helper so the masked path can be flipped off again
  cleanly without changing the rest of the map pipeline.
- Tightened the Geometry Lock prompt footer and the strict edit wrapper, and asked the worker for
  the highest input fidelity the edit API supports to squeeze out better map detail without
  changing the off-switch or the showcase path.

### 2026-07-12 (site audit + repair pass)
- Ran a repo-wide audit with subagents across shell/login, map/design, API/auth, and content flows.
- Landed the safe fixes: removed the duplicate home language provider, improved login scrolling/labels/focus, hid the closed nav drawer from the accessibility tree, fixed role-switcher semantics, synced farmer query params, cleared stale report/photo analysis, centralized the zone palette, made the design studio use the local fallback plan, and made shared map imports persist/recompute.
- Left the gate/auth hardening findings as a separate decision because they change deployment behavior.

### 2026-07-12 (strict map generator)
- Added a strict-map edit mode to `/api/ai-render` so the GPT-image-2 path gets map-specific guardrails, explicit must-include / must-avoid criteria, and a cartography-only prompt wrapper.
- Rewired the glossy design renderer to opt into the strict-map mode and renamed the UI copy so the "best quality" action now reads as a strict map generator.
- This keeps the existing fast Gemini render and the other AI touch-up flows intact while giving the final map render a harder contract.

### 2026-06-23 (critical bug fixes + UX pass 2)
- **BLOCKER fixed: water colour** — MapboxDraw missing `userProperties:true`; without
  it `user_featureType` style filters never matched → all polygons green, no blue water.
- **Persistence race fixed** — `recompute()` now guards persist behind `restoredRef`
  so a fast first draw can't wipe saved shapes before restore runs.
- **Name/category survives edit** — snapshot in `startReticleEdit`, restore in finish+cancel.
- **GPS error auto-dismisses** after 2 s. **Draw hint banner** fades after 6 s.
- **Rename in edit bars** — both custom and native edit modes have a Rename button.
- **Place colour/name edit** — tap the colour dot in Places list; sheet re-titles "Edit place".
- **Parcel names in right panel** — DataPanel "Your land"/"Water storage" cards now
  list named parcels/stores under the aggregate total.
- **Search placeholder** → "Search town or address".
- **Draw bar** "Add corner" font reduced 15→13.

### 2026-06-23 (drawing persistence + map fixes)
- **Drawn parcels + water now PERSIST** (localStorage `imbewu_farm_shapes`) — the
  big one: drawing was lost on refresh/navigation. Saved on every change, restored
  when the map is ready (poll-based, since the contour/terrain sources keep
  `isStyleLoaded()` perpetually false). Teardown guard stops the unmount `deleteAll()`
  from wiping storage. Verified: survives refresh AND navigate-away-and-back.
- **Existing shapes LOCKED while drawing** — switch MapboxDraw to a `static` mode
  during reticle-draw so panning under the crosshair can't grab/move an existing
  boundary (fixes "drawing water moved my land boundary").
- **Water renders ON TOP of the boundary** — split the draw fills by type and order
  them land-then-water (+ higher water opacity) so the blue is visible even where a
  dam sits inside a parcel.
- **Saved-place GPS points in the report** — ReportView now lists each saved place
  with its label + lat/lon (5dp). Verified.
- **STILL TODO from this feedback:** parcel naming/categorise popup + rename-on-Edit
  (parcels are still auto-named "Parcel 1"); linking a drawn farm to a saved place;
  a show/hide toggle for the drawn layer.

### 2026-06-23 (live-feedback fixes)
- **Draw-bar tap bug fixed** — on phones the 5 draw controls (Cancel/Undo/GPS/Add
  corner/Finish) overflowed the viewport so Finish sat off-screen and only a sliver
  responded ("5% clickable"). Shrunk the button bases/gaps + the oversized 21px
  "Add corner" font, added `minWidth:0`, raised the bar to clear the TabBar (now 20px
  above it), and hid the Lima FAB during draw. Verified at 375px: all buttons 5/5
  clickable, no overflow.
- **Right panel fonts tightened** (the "too big" complaint) — applied the §0 scale
  to the SITE REPORT panel: biome name 22→18, stat rows 56→46px / value 18→16,
  Stat component 29→21, Lima card + buttons down a notch.
- **Live "Your land" / "Water storage" card** in the panel Overview — shows area +
  perimeter (+ parcel/store count, est. volume), updates live as a boundary is drawn.
- **Saved places: delete + labels toggle + colour** — each place row now has a
  colour dot (by label) + a red delete trash; a "Show names on map" toggle controls
  always-on pin labels. Verified delete end-to-end (storage + list + badge + marker).

### 2026-06-23
- **Lima coach-marks** — first-time map guide card; "?" in the tools-panel header.
- **Map tools v2 corrections** (frame 33 / `MAP-TOOLS-CORRECTIONS.md`) — blue centred
  Draw-water paired with ochre Draw-land-boundary; rewritten parcel/water list
  (labelled sections + named rows + buttons); draw-bar progress pill + "Add corner";
  layers summary-row collapse; **Save-place drops a pin + naming sheet** (label→colour).
- **Lima Vision** (`/vision`, frames 13/14) + **expense-slip OCR** (frame 32) +
  **GPS boundary-walk** (frame 05) — all on existing Claude vision / browser geolocation.
- **NGO surveys** (`/surveys`, frame 21).
- **Cost/expense logging** + **POPIA consent onboarding** (frames 16/23/24).
- **iPad/tablet layout** (frame 26) + **desktop financial sheet** (frame 15).
- **Map tools panel redesign** (calm/unified/ochre) + **responsive type** fix (§0) + NgoDashboard.
- **Crop-plan scheduler** (frame 31) + **crop quantities** (frame 30) + **invoice builder** (frame 17/32).
- **Garden survey wizard** (frame 29).
- **Role merge → Mentor**, **task-first home**, **vendor badges removed** (frames 02/03/19).
- **Auth backend** (reset / Google / change-pw / photo) + Firestore rules & indexes.
- **Trainer→Mentor hub**, **Student portal**, `mySales`.
- **Live-auth fix** — mirrored Firebase/Mapbox/Anthropic env into Vercel (`set-vercel-env.yml`)
  + added Auth authorized domains. (Was stuck in "Backend not connected".)

---

## What's left

1. **Google Sheets mirror + Google Calendar sync** (frames 15/18) — the only handoff
   item blocked on external setup. Needs a Google Cloud **OAuth client + consent
   screen** the project owner must provision. The desktop sheet + CSV export and the
   in-app calendar/cropplan are already built; only the live two-way Google sync is out.

### Deliberate skips / lower priority (see `design/DESIGN.md`)
- Map tools **mobile bottom-sheet** — the panel redesign already applies on phone; a
  bottom sheet would collide with the Details sheet + Lima FAB + TabBar at the map bottom.
- Site-analysis Q&A stepper (frame 04) — overlaps the built `/survey` garden wizard.
- Invoice → auto-post to ledger; yield-vs-planned (frame 32) — nice-to-have.
- **Cost note:** OCR/vision uses `claude-sonnet-4-6`. At scale, dropping the slip-OCR to
  Haiku 4.5 (same provider, ~3× cheaper) or Gemini 2.5 Flash (~8× cheaper, +1 provider)
  is a clean win — revisit when volume justifies it.

---

## Auth / passwords (operational)
- **Site gate:** controlled by the `SITE_PASSWORD` env var on Vercel (ask the owner for the value; not committed here).
- **Account auth:** Firebase email/password (enabled) + Google. To enable the Google button end-to-end, the owner enables **Google** as a sign-in provider in Firebase Console → Authentication → Sign-in method (email/password is already on; authorized domains are set).
- **Env:** managed via GitHub repo secrets → pushed to the Vercel project by `.github/workflows/set-vercel-env.yml` (`gh workflow run set-vercel-env.yml`). Never commit `.env*`.
