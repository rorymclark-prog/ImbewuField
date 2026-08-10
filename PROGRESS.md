# ImbewuField — Build Progress

> **Current map-render goal and ongoing task list:** see
> **`docs/ACTIVE-MAP-QUALITY-TASKS.md`**. The older "What's left" section below describes the
> original 33-frame product handoff only; it is not the completion list for the current
> Reference Blueprint / Geometry Lock quality work.

**Picking this up (incl. cloud / phone Claude Code)?** Read **this** file for *what's
done and what's left*, and **`design/DESIGN.md`** for the *design system + per-frame
status*. The visual source of truth is `design/handoff/*.png` (33 frames) and the
build brief is `design/BUILD-INSTRUCTIONS.md` + `design/MAP-TOOLS-CORRECTIONS.md`.

**Update this file after each work iteration** — add a dated bullet to the top of
the Build Log, and move anything finished out of "What's left".

- **Repo:** `rorymclark-prog/ImbewuField` (its own repo — NOT the `~/Claude` monorepo)
- **Live:** `imbewufield.vercel.app` (also `permamap-sa.vercel.app`, `imbewufield.vercel.app`)
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

### 2026-08-10 (one-surface Phase 3: design flows back to the map, read-only)
Phase 3 of `docs/ONE-SURFACE-PLAN.md` — the farmer's Design Studio work now appears on the
live farmer map as a read-only "My design" layer, completing the loop the plan calls
"builds trust in the one model before the weld".
- **New pure converter `lib/design-map-layer.ts`** — `designStateToGeoJSON(state, frame)`:
  normalised canvas coords → real-world [lng,lat] GeoJSON via the Studio's own inverse-Mercator
  (`makeMercatorUnprojector`). Zones → Polygons (kind/zone/label/color), lines → LineStrings
  (lineKind/color/width/dashed), placed items → Points (name/category/icon/color). Deterministic,
  no side effects; designs whose frame lacks geo-registration — drawn over a custom PHOTO or
  BLANK paper, whose geometry is anchored to the photo's pixels rather than the earth (see
  `migrateStateToFrame`) — yield an EMPTY collection instead of painting confidently in the
  wrong place. `lib/design-overlay.ts` is now a thin impure wrapper (loadCanvasState + the
  Marker/GeoJSON split) over this one implementation.
- **Map.tsx (strictly additive, design-overlay sections only)** — the overlay gains small
  centroid labels (`design-label` symbol layer reading each polygon's `label` prop), and the
  map now OWNS visibility: a "My design" chip in the labels pill (Lucide `PenTool`, exact
  pattern of the Shapes/Hatching/Places chips, same session-scoped persistence), ON by default
  whenever a saved geo-registered design exists. The parent-owned `showDesign` prop and the
  farmer page's separate floating "Show design" button (default-off, emoji icon) are gone.
  Sync unchanged and verified: the overlay refreshes on `DESIGN_CANVAS_CHANGED_EVENT` +
  `storage`, so an edit in /design shows on the map on return without a reload.
- Tests: new `tests/design-map-layer.test.ts` (lng/lat round-trip < 1e-6°, empty state → empty
  collection, photo/blank/corrupt frames → empty, style-property contract, determinism +
  input-mutation guard, invalid-shape quarantine) and a photo/blank skip test in
  `tests/design-overlay.test.ts`. Full suite green except the pre-existing
  `tests/auth-account-transition.test.ts` ESM-loader failure (also fails on clean main).
### 2026-08-10 (beds under the trees; veg you can actually see)
Two more defects off Rory's phone review of a live Reference Blueprint planting sheet.
- **Beds sit under the trees now** (`lib/glossy-filters.ts`, `components/design/DesignGlossy.tsx`) —
  `cartographicItemPaintRank` was ordered by palette category rather than by height above the
  ground, so a bed sat at rank 3: above every path, tank, shed and hive on the farm, with only the
  canopy rank over it. Beds and crop rows drop to rank 1 — still above the basins and berms they
  are built on, below everything that stands up. And `drawExistingSiteItems` (Site + Site-Hybrid)
  was the one item loop that painted in SAVED ARRAY ORDER, so a bed recorded after a citrus painted
  its crop rows straight over the crown; it sorts through `compareCartographicPaint` like every
  other stack. The canopy small-crown-first inversion is untouched.
- **A bed carries real, large vegetables** (`lib/crop-row-cartography.ts`, `DesignGlossy.tsx`) —
  the oversized cabbage head shipped last night never showed, because the mark size came from the
  ROW PITCH, and a bed's row pitch is its own 1.2 m width divided by its rows: ~11 px at sheet
  scale, so every mark drew ~17 px on the 1920 px master (three pixels on a phone). Worse, at that
  scale a bed rarely reached the painter's "three plants or don't bother" floor, so it fell through
  to `production-bed-v1.png` — the one green rectangle every bed shared — and the cabbage code was
  never reached at all. New `bedCropMarkUnitPx` sizes the mark from the PAGE (≥1.7% of sheet width,
  capped to the bed so an oversized head still belongs to it), `bedCropRows` takes the matching
  pitch and lays out fewer, larger plants, and the bail is now "can a vegetable be read here at
  all". A typical bed prints ~33 px heads instead of ~17 px dots. Footprints, rotations, legend
  rows and counts are untouched — symbol size only; staple plots keep their own field treatment.
- Guards: `tests/glossy-filters.test.ts` pins canopy-over-bed for every bed × canopy pair (and
  bed-over-basin), plus the comparator count for the fourth paint loop;
  `tests/crop-row-cartography.test.ts` pins the mark's readable floor, the fewer-larger layout and
  that the renderer actually asks for it.
### 2026-08-10 (paid sheets: the app draws the chrome, always, and never sends it to the model)
Rory's live Full Treatment render — "Planting · Photo Plan · AI polished · Geometry locked" — came
back with **no plant labels, no legend panel, no title block, no north arrow, no scale bar**, and
the property boundary sitting on it as a hard vector line stamped over completely repainted ground.
Two failures, one picture, both now structural rather than conditional (`lib/sheet-chrome-pass.ts`):
- **The model was handed the composed sheet.** An image model cannot reproduce 9px type, so it
  erased every label and repainted the legend. Every paid path now uploads MAP-AREA ARTWORK only:
  design layers already did; **Sector / Existing Site** crop the finished Hybrid back to its map
  column (`cropStyleSheetToMap`) and **Phasing** uploads its map column via a new `cropSheetRegion`
  (which also fixes the model's page-shaped return being squeezed into the narrower map column).
- **The app's re-draw of that chrome was conditional, and the condition could not hold.** It
  compared the uploaded input's PIXEL SIZE with the map size — but `capForAiInput` uniformly
  downscales every AI-bound bitmap to `AI_INPUT_WIDTH` (1920), so at the High render scale (2880px
  maps, the desktop default) the "legacy composed-page input" escape hatch fired on *every* polish
  and skipped the chrome pass entirely. The decision now comes from the committed workflow stage
  (`paidPolishNeedsChromePass`, off the job doc's `resultKind`), never from a protect mask, an
  image size or a style; `modelInputCarriesChrome` compares ASPECT (which the downscale preserves)
  and only chooses whether a legacy page's map column needs cutting out first.
- **One chrome pass, one place** (`composeSheetChromeOverMapArt`) — boundary stroke, plant labels +
  leaders, label gutters, legend panel, title block, north arrow, scale bar — drawn from the saved
  design over whatever comes back. Both of its exits, including the error path, return a composed
  sheet; the old catch returned the bare source map. Sector's "ship the model's page raw" exit is
  gone for the same reason.
- **Boundary reads as part of the sheet again.** Nothing is byte-restored on the polish tier; the
  property line is drawn in the same pass as the labels and the legend, from the same geometry.
  `fullTreatmentProtectPolicy` is unchanged (boundary only) but re-documented: its mask now marks
  *app-owned* pixels for the difference gate rather than *byte-restored* ones. Phasing's and
  Sector-polish's masks are gone — a mask promises a restore neither of them performs, and both
  would have hidden real map area from the gate. Geometry, counts and positions untouched.
- Cache: r-token `:r1` → `:r2` (a cached r1 Full Treatment is exactly the picture this stops
  re-serving); `PLAN_VERSION` deliberately untouched. Dead helpers removed
  (`extendProtectMaskToStyleSheet`, `buildPhasingProtectMask`). New `tests/chrome-after-ai.test.ts`.

### 2026-08-10 (plan-sheet art: real vetiver, grassed berms, actual cabbages)
Three pieces of Rory's phone review of a live Reference Blueprint sheet, all seeded-deterministic
(same design → identical paint, byte for byte):
- **Vetiver reads as a grass hedge, not a strip** (`lib/vetiver-hedge.ts`) — tuft sizes, spacing
  and off-line drift now vary per seeded crown; blade count and tone vary per tussock (three
  near-neighbour greens); and the band's cream casing + fill follow the UNION of the tussock
  blobs instead of the footprint rectangle, so the edges are softly ragged. Saved geometry is
  untouched — the width-honesty inset (`VETIVER_BLADE_REACH`, now 2.4) still caps every blob and
  blade inside the saved band.
- **Berms/terraces get scrappy grass fringes** (`lib/cartographic-water-symbols.ts`) — seeded
  bowed blades rooted along both long edges lean across the outline and break it visually
  (clipped to the exact footprint), and the internal contour lines are hand-wavered instead of
  ruled. Half-moons unchanged.
- **Rosette beds paint actual cabbages** (`lib/crop-row-cartography.ts` `cabbageHeadLeaves` +
  `DesignGlossy` renderer) — layered wrapper leaves around a tight pale heart, deliberately
  oversized to the same 2.6·s footprint the veg sprites use, always vector (the rosette sprite
  read as a blob at phone size). Rows, pitch and glyph choice contracts untouched; 'generic'
  stays a plain plant so no crop is invented.
Tests extended in `tests/vetiver-hedge.test.ts` (paint-pass determinism via recording canvas,
irregularity, band-from-tussocks), `tests/cartographic-symbols.test.ts` (berm/terrace fringe
determinism) and `tests/crop-row-cartography.test.ts` (cabbage geometry + reach bound).

### 2026-07-26 (live emulator walkthrough — found and fixed two pre-existing bugs)
Ran the whole flow against the Firebase emulator with a seeded mentor + learner in one org
(`scripts/seed-course-demo.mjs`), driven end to end in a real browser. Static checks had all
passed; the walkthrough still found two bugs, both older than this branch.

- **The mentor dashboard could never load a cohort from Firestore.** Two independent causes:
  1. `firestore.rules` had a single `allow read` on `/profiles/{uid}` combining
     `uid == request.auth.uid || isStaff() || isMentor()`. A **list** is authorised once, up
     front, before any document is read, so the per-document `uid` term cannot be proven and
     drags the whole OR to false. Every profile query a mentor made was `PERMISSION_DENIED`.
     Split into `allow get` (unchanged) and `allow list` (staff/mentor only) — strictly no more
     permissive than the original intent, since list was previously denied to everyone.
  2. `app/mentor/page.tsx` ran `load()` on mount instead of waiting for auth. Every query in it
     is org-scoped and the org comes from the caller's own profile, so running while
     `currentUser` was still null returned empty lists with **no error** and never retried. The
     student page already had this guard; the mentor page did not.
- Both failures rendered as the same innocent empty state — "Learners will appear here once
  they enrol" — which is precisely why static verification could not see them. The mentor page
  also swallowed load errors in a bare `catch {}`; it now logs and shows the sync banner, so a
  denial can never again be mistaken for an empty cohort.
- **Verified live, in the browser:** mentor signs in → sees the learner at 2/10 with status
  "Not enrolled" → enrols (cohort counter goes to 1) → assigns Seeds with a due date → both
  documents land in Firestore with the mentor's uid and org stamped, zero rules denials. Learner
  signs in → "Set by your mentor · 0 of 1 done · 1 due this week" → Seeds lifted to the top of
  the list keeping its curriculum number 6, badged "Due in 4 days" → opens it → isiZulu
  narration plays (`/course-audio/seeds-sovereignty/zu/slide-02.mp3`, clock running, 84s
  duration matching the file). Screenshots in `docs/verification/`.
- 233 tests pass, `tsc --noEmit` clean, `npm run build` passes.

### 2026-07-26 (recorded isiZulu + English module narration, playing in the app)
- Rory's Gemini/Antigravity narration of the Seeds facilitator deck is now **in the app**: 10
  slide clips per language, isiZulu and English, plus a full-module track. Sourced from the
  `Imbewu Learning Portal` notebook and imported from `~/Downloads/imbewu_seeds_audio`.
- **`scripts/import-course-audio.mjs`** is the seam so the next module is one command, not a
  manual copy: `node scripts/import-course-audio.mjs <moduleId> <exportDir>`. It normalises
  whatever the export looks like into `public/course-audio/<module>/<lang>/slide-NN.mp3`,
  warns when two languages have different track counts, and prints the manifest block to paste.
- **`lib/course-audio.ts`** is the manifest and lookups. Slides map to lessons (2–3 → lesson 1,
  4–6 → lesson 2, 7–9 → lesson 3, with 1 and 10 as module intro/recap), so the audio appears
  both as a whole-module playlist and inside the lesson it belongs to. Every URL goes through
  `trackUrl()`, so moving audio to Firebase Storage later is a one-line `baseUrl` change and no
  component moves.
- **`components/course/CourseAudioPlayer.tsx`**: nothing autoplays, `preload="none"` and the
  `src` is only set on press, so a learner on a metered rural connection downloads the two
  minutes they asked for and not eleven megabytes. Clips auto-advance to the end of the list
  and stop — never loop. If a module was not recorded in the app's language the player *says*
  which language it is playing instead of quietly substituting English.
- This is the honest fix for the caveat in `lib/tts.ts`: SpeechSynthesis has no isiZulu voice
  on most real devices, so isiZulu lessons were being read out in English or not at all.
  Recorded narration side-steps the device. SpeechSynthesis stays for everything unrecorded.
- Guard tests cross-check the manifest against the filesystem in both directions — a promised
  clip that is not on disk fails, and an orphan clip on disk that no module claims also fails.
  Module and lesson ids in the manifest are validated against `lib/course-modules.ts`.
- Verified: 233 tests pass, `npx tsc --noEmit` clean, `npm run build` passes. Clip durations
  read back correctly via ffprobe (isiZulu 7:52 total, English 5:45; isiZulu consistently ~35%
  longer, matching the longer isiZulu script).
- **NOT verified: that the isiZulu clips are actually spoken in an isiZulu voice.** Rory's own
  notebook chat shows Gemini defaulting to an English voice model on isiZulu text for the video
  overview. The same failure could have hit these clips. Someone who speaks isiZulu must listen
  to one clip before this ships.
- Built in a separate git worktree because another agent was editing `DesignGlossy.tsx` and
  `lib/locked-polish-flow.ts` in the main checkout at the same time.

### 2026-07-26 (course enrolment + mentor-set assignments)
- Built the two modules the last handover assumed already existed: **`lib/course-enrollment.ts`**
  and **`lib/course-assignments.ts`**. Neither was in the repo — the mentor dashboard's
  "Learners will appear here once they enrol" empty state was unreachable because nothing in
  the app could enrol anybody.
- **Enrolment** is a separate record from `course_progress`, which stays the single source of
  truth for "is this module finished". Status is DERIVED from progress (none → not started,
  some → in progress, all → complete); only a mentor's `paused`/`withdrawn` is stored, and a
  manual pause is never overruled by progress.
- **Assignments** are mentor-owned: learner, module, optional due date, optional note. They
  never record completion. The learner's Portal lifts outstanding assigned modules to the top
  of the list without removing anything — the full syllabus stays reachable.
- Firestore rules for both collections: a learner reads their own and can write neither. Only
  a mentor or staff member in a **non-null** org may enrol or assign (`inMyOrg()` is stricter
  than `sameOrg()` — it refuses to match two org-less accounts through `null == null`).
  `profile_id` and `org_id` are pinned on update, so an enrolment can't be re-pointed at a
  different learner or walked across to another org. No composite indexes needed — every query
  is a single-field equality.
- Mentor writes are optimistic for a slow rural connection, and re-read from the server on
  failure rather than leaving an unsaved value on screen.
- Date handling is deliberate: due dates are plain `YYYY-MM-DD`, day arithmetic goes through
  `Date.UTC` so a DST transition can't round a deadline to the wrong side of zero, and "today"
  resolves after mount so server and client can't disagree across midnight.
- **Not touched, on purpose:** no lesson body, key point, quiz question, rationale or species
  name in `lib/course-modules.ts` was edited.
- Verified: 26 new unit tests, **222 passing** total, `npx tsc --noEmit` clean, `npm run build`
  passes, and `firestore.rules` loads in the Firestore emulator without a compile error.
  Branch `feat/course-enrollment` — **not merged, not deployed.** Still needs a live run against
  a real mentor + learner pair before it goes near `main`.

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
