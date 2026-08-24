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

### 2026-08-24 (perennial cropping-maturity ramp-up: log a tree's age, see its production stage)
Rory: log an existing tree's age, and a newly-placed tree's production should step up over
years rather than read as instantly mature — avocado producing nothing years 1-3, some by 4-5,
full later. Scoped as a standalone signal, not wired into `lib/crop-plan.ts`/
`lib/forward-harvests.ts`/`lib/plan-value.ts`/`lib/finance-series.ts` — none of those carry a
tree-yield concept today, so this ships as an honest "how mature is this specimen" readout
rather than a forced integration into finance planning.

**`lib/species-palette.ts`** — new optional `Species.yearsToFirstHarvest`/`yearsToFullBearing`/
`maturitySource` fields (both years required together, or neither — a half window is worse than
none), enforced in `validateSpecies()`.

**`lib/species-catalog.ts`** — populated 23 curated fruit/nut trees with real, cited maturity
windows sourced from SA/international agricultural-extension references (hortgro.co.za,
agribook.co.za, avocadosource.com, southafrica.co.za, FAO, etc — full list in the PR). Avocado:
4 years to first harvest, 7 to full bearing, matching Rory's own example almost exactly. Marula
was deliberately left unset — no citable source found; "never invent, only cite" per this file's
existing convention.

**`lib/design-canvas.ts`** — new optional `PlacedItem.plantedYear`: the calendar year a specimen
went, or will go, into the ground. Works for both an `'existing'` surveyed tree (farmer recalls
roughly when it was planted) and a `'proposed'` one (defaults to the plan's target year).

**`lib/perennial-maturity.ts`** (new) — pure, `now`-parameterized module (same discipline as
`lib/forward-harvests.ts`) producing a 0..1 yield-fraction ramp between a species' cited
`yearsToFirstHarvest`/`yearsToFullBearing`, plus a three-word stage (`'not yet bearing'` /
`'first crops'` / `'full bearing'`) and a short label like "first crops · 5 yrs". Deliberately
carries no yield/price number, same as `lib/perennial-produce.ts`. Returns `null` — never a
guessed 0 or a guessed "mature" — whenever the species has no cited window or the item has no
known planting year. 14 new tests in `tests/perennial-maturity.test.ts`.

**UI wiring**: `components/design/DesignCanvas.tsx`'s tap-to-place now defaults a newly-placed
tree's `plantedYear` to the current year automatically (no prompt — a plan places it now).
`app/design/page.tsx`'s existing `ItemEditSheet` (the post-placement edit sheet, opened via the
pencil action on a selected item) gains a "Year planted" field for any item with a `speciesId`,
with a live maturity-stage preview underneath once both a cited window and a year are known —
this is also how a farmer logs an *existing* tree's real age ("Already here" status + a
remembered planting year).

Verified: `tsc --noEmit` clean, `npm test` 3111 pass / 2 pre-existing unrelated auth-suite
failures / 1 pre-existing TODO — unchanged baseline, no regressions — `npm run build` clean.

### 2026-08-24 (Phase 4/4 of NGO/funder dashboards: real-data wiring + aggregate reporting)
Last of four sequential draft PRs (see Phase 1 entry below for the full plan). Phases 1-3 built
the security fix, the admin panel, and the consent toggle; this phase is where the NGO/funder
dashboard actually reads real Firestore data and gets an aggregate M&E report, all behind the
`ngo_dashboard_v2` flag so `/ngo` and `/funder` keep showing demo data until Rory flips it on.

**`firestore.rules`** — widened the `gardens`/`gardens/{id}/members` rules with the same
`staffOrgAccess(d)` pattern Phase 1 already applied to `profiles`/`organizations`/etc: same-org
staff, an `isAdmin()` account, and a funder with a `grants` record for that org can all read a
garden and its members; a cross-org or ungranted account cannot. The pre-existing supervisor and
self-member read paths are unaffected. New emulator coverage in `tests/firestore-rules.test.ts`
(4 tests: same-org/granted-funder/admin allowed vs cross-org/ungranted denied, for both
`gardens` and `gardens/members`, plus the supervisor/self-member paths still working) —
`npm run test:rules` passes 24/24 against the real Firestore emulator.

**`lib/report-org-summary.ts`** — new pure aggregation module, same "never infer, only measure
what's there" discipline as `lib/report-boq.ts`. `summarizeOrgReport(gardens, farmerRows)` totals
production/sales/training only across *consented* farmers (a non-consenting farmer is still
counted in `totalFarmers`/`gardens` so nothing is silently hidden, but their figures never reach
a total); `orgReportToCsv()` renders one row per farmer, "Not yet" with blank figures (not an
omitted row) for anyone who hasn't consented; `orgReportCsvFilename()` makes a safe, dated,
lowercased slug of the org name (falls back to "organisation" for a name with no alphanumerics).
**`lib/org-report-pdf.ts`** builds `ReportBlock[]` from the same summary and hands off to the
existing `lib/report-pdf.ts` renderer, rather than inventing new PDF infrastructure.

**`components/NgoDashboard.tsx`** — wired the previously-inert report-generation state/callbacks
into the actual render tree: a new "Impact report" panel (gated on `ngo_dashboard_v2` and not
demo mode) between the gardens sidebar and the map, with a "Generate report" button, loading
skeletons, an error state, and — once generated — a consent-count disclosure, a Gardens/
Production/Sales/Training stats grid, and CSV/PDF/Refresh actions.

New `tests/report-org-summary.test.ts` (9 cases over `summarizeOrgReport`/`orgReportToCsv`/
`orgReportCsvFilename`: consent exclusion from totals, garden-status breakdown, avgCoursesPct
NaN-avoidance with zero consented farmers, multi-farmer summation, CSV "Not yet" row shape, CSV
escaping, header-only-when-empty, filename slugging and its no-alphanumerics fallback) —
registered in `package.json`'s explicit test-file list. Verified: `tsc --noEmit` clean,
`npm run test:rules` 24/24 against the real Firestore emulator, `npm test` 3094 pass / 2
pre-existing unrelated auth-suite failures / 1 pre-existing TODO — unchanged from baseline, no
regressions.

### 2026-08-24 (Phase 3/4 of NGO/funder dashboards: farmer consent flow)
Third of four sequential draft PRs (see Phase 1 entry below for the full plan). Phase 1 shipped
`Profile.dataConsent` and the rule enforcement (`consentGranted()`/`staffConsentedAccess()`) that
gates a farmer's production/sales/expense/course records behind it; until now nothing in the app
ever wrote the field, so it was permanently absent (== not shared) for every farmer.

**`lib/data-consent.ts`** — new pure `nextDataConsent(current, granted, now)`. Both timestamps
survive repeated grant/revoke cycles: granting stamps a fresh `grantedAt` and leaves the previous
`revokedAt` untouched, revoking is the mirror image — so the record always shows "most recently
granted at X" and "most recently revoked at Y" instead of only ever remembering one of the two.

**`lib/db/queries.ts`** — new `getOrganization(orgId)`, read-only, used only to name the org a
farmer's consent toggle would apply to (`organizations/{id}` is already readable by that org's
own members under the Phase 1 rules, so a farmer reading their own `org_id` needs no rule change).

**`components/ProfileSheet.tsx`** — new "Data sharing" section, farmer's own profile sheet only
(`app/farmer/page.tsx`). Opt-in, not opt-out, matching POPIA: hidden entirely (not shown-disabled)
for a farmer with no `org_id`, since there's nobody to share with. One toggle — "Share my data
with \[org name]" — revocable at any time. Save only stamps a new `dataConsent` record when the
toggle actually moved during that save, so saving unrelated fields (name, bio, skills, ...) never
silently re-stamps `grantedAt`/`revokedAt`.

New `tests/data-consent.test.ts` (9 cases: `nextDataConsent` grant-from-empty, revoke-from-empty,
re-grant-after-revoke preserving `revokedAt`, re-revoke-after-grant preserving `grantedAt`,
idempotent re-grant, plus source-pattern checks that `ProfileSheet.tsx` imports the helper, gates
the section on `profile?.org_id`, and only patches `dataConsent` when the toggle moved) — same
`readFileSync`-based style as `tests/write-timeout.test.ts`. Verified: `tsc --noEmit` clean,
`npm run build` clean, `npm test` at baseline (3085 pass / 2 pre-existing unrelated auth-suite
failures / 1 pre-existing TODO, no regressions — new test file registered in `package.json`'s
explicit test list). No rules changes this phase (Phase 1 already covers consent enforcement) —
`npm run test:rules` not applicable.

### 2026-08-24 (Phase 2/4 of NGO/funder dashboards: platform admin panel)
Second of four sequential draft PRs (see Phase 1 entry below for the full plan). Unblocks
testing phases 3-4 for real: until now there was no way to provision a real `ngo`/`funder`/
`admin` test account other than hand-editing the Firestore console.

**`lib/admin-auth.ts`** — `requireAdmin(req, routeName, verifyToken?, lookupRole?)`, the guard for
every `app/api/admin/*` route. Deliberately its own module, not a reuse of `lib/api-auth.ts`'s
`guardPaidApiRequest`: that guard is SOFT by default (`REQUIRE_API_AUTH` gates whether a failure
actually blocks the request, so the paid-route auth cutover can be smoke-tested without breaking
farmers mid-design) — `requireAdmin()` always hard-fails, on a missing/invalid bearer token AND
on a caller whose Firestore `profiles.role` isn't `'admin'`, independent of any env var. Own
credentialed Admin SDK app init (`cert(FIREBASE_SERVICE_ACCOUNT)`, falling back to ADC), exposed
via `getAdminFirestore()` so the three route files below share one init path.

**`app/api/admin/users` (GET list/search, PATCH role+org_id)**, **`app/api/admin/orgs`** (GET
list, POST create), **`app/api/admin/grants`** (GET list, POST create, DELETE) — all Admin-SDK,
all behind `requireAdmin()`. This is the trusted path the rules comments already called for:
`profiles.role`/`org_id` are client-immutable by rule, and `/grants` denies all client writes, so
these Admin-SDK routes are now the only writer for either.

**`app/admin` + `components/AdminPanel.tsx`** — gated by `canAccessRolePage(role, {'admin'})`
(same pattern as `app/ngo/page.tsx`) and the new `ngo_dashboard_v2` flag; an unauth visit or the
flag being off both silently redirect to `/home`, matching `app/community/page.tsx`'s pattern.
User search/list with a per-row role + org dropdown, org creation form, grant creation/revoke —
role + org assignment only, no suspend/disable, no audit-log UI, per the locked-in scope. **Not
linked from any nav** — reached by URL only, Rory-only.

**`lib/ngo-dashboard-v2-flag.ts`** — new client-side kill switch mirroring
`lib/community/flag.ts` exactly (`NEXT_PUBLIC_NGO_DASHBOARD_V2_ENABLED` + a
`imbewufield_ngo_dashboard_v2_preview` localStorage escape hatch). Gates the admin panel now;
will gate the consent-aware dashboard wiring and aggregate reporting UI in phases 3-4. Separate
from the rules-side `ngoDashboardV2On()` kill switch shipped in phase 1 — the two don't read each
other, by design.

**`.github/workflows/set-vercel-env.yml`** — added `FIREBASE_SERVICE_ACCOUNT` to the mirrored
secrets (server-only, not `NEXT_PUBLIC_*`). It already existed as a GitHub secret (used by
`deploy-functions.yml`) but was never pushed to Vercel — Vercel serverless functions have no
ADC/metadata-service fallback the way Cloud Functions do, so the new admin routes would 401 on
every request in production without this. **Rory: run `gh workflow run set-vercel-env.yml`
before smoke-testing `/admin` live.**

New `tests/admin-auth.test.ts` (18 cases: missing/malformed token, verifier throws, no uid,
no-profile → 403, every non-admin role → 403, role-lookup throws → 401 not silently-allowed,
`REQUIRE_API_AUTH` proven to make no difference in either direction, Bearer-scheme
case-insensitivity, the happy path) — same injectable-dependency shape as `tests/api-auth.test.ts`,
no real firebase-admin/network. Verified: `tsc --noEmit` clean, `npm run build` clean, `npm test`
at baseline (3070 pass / 2 pre-existing unrelated auth-suite failures / 1 pre-existing TODO, no
regressions — the two "every test file is registered" meta-tests and the "every header has a
MenuButton" coverage test all needed `/admin` and the new test file wired in, done here). Rules
untouched this phase — `npm run test:rules` not applicable.

### 2026-08-24 (Phase 1/4 of NGO/funder dashboards: cross-org Firestore/Storage leak fix — PR #350, merged)
Rory: *"i need to build the full ngo and funder dashboard now the ngo needs admin powers to
designate what users can or cannot do audit and research what we need and they need to be able
to see all the data and compile reports accordingly etc etc i will be the developer and i need
to be able to update the app from time to time so make i can o that safely"*. Plan (4 sequential
draft PRs): (1) security fix + data model, (2) platform admin panel, (3) farmer consent flow,
(4) dashboard real-data + aggregate reporting. **This is Phase 1**, opened as draft PR #350.

Root problem, independently flagged CRITICAL in `docs/AUDIT-NEEDS-RORY-2026-08-15.md` Finding
#1 and left unfixed pending this decision: any provisioned `ngo`/`funder`/`admin` account could
read every OTHER org's farmers, not just their own — `profiles` (list), `organizations`,
`designs`, `course_submissions`, `survey_responses`, `course_progress` and the three financial
log collections all gated on a bare staff-role check with no org comparison.

**Fix:** `firestore.rules` — `isAdmin()` unconditional platform-admin bypass; `staffOrgAccess(d)`
requires `d.org_id == myOrg()` for ngo/funder; `grantedOrg(orgId)` lets a funder read any NGO org
it holds a new `/grants/{funder_org_id}_{ngo_org_id}` record for (funder → many NGOs);
`consentGranted()`/`staffConsentedAccess()` additionally require the farmer's own
`Profile.dataConsent.granted == true` on the five collections that identify a specific farmer
(the three log collections, `course_progress`, `course_submissions`) — mentor access is
deliberately untouched by consent anywhere. `storage.rules`' `isCourseStaffOrMentor()` now
org-scopes the same way via a second Firestore lookup. Defense in depth: `designs`/
`course_progress`/`course_submissions`/`survey_responses` create now pin `org_id` to the
caller's own, so a farmer can't spoof their doc into another org's staff view.

**Data model:** new `Grant` type; `Profile.dataConsent?`; optional `org_id` denormalised onto
`Design`/`CourseProgress`/`SurveyResponse`/`CourseSubmission` (optional, not required — existing
docs don't have it yet). `lib/db/queries.ts` stamps `org_id` at write time and filters by it at
read time for the four newly-scoped collections. New `scripts/backfill-org-id.mjs`
(`npm run backfill:org-id`) — **Rory needs to run this against production** before/alongside
deploying the new rules, or pre-existing docs in those four collections go invisible to staff
until backfilled. `app_config/ngo_dashboard_v2` scaffolded (`ngoDashboardV2On()`) but not wired
to anything yet — ready for phases 2-4.

New `tests/firestore-rules.test.ts` coverage for every changed branch (same-org allow / cross-org
deny, admin unconditional, funder-with/without-grant, consent-withheld vs. mentor-unaffected, the
org-spoof-on-create rejection, `/grants` read scope + no client writes). Verified: `tsc --noEmit`
clean, `npm run build` clean, `npm test` at baseline (3055 pass / 2 pre-existing unrelated
auth-suite failures / 1 pre-existing TODO, no regressions). **`npm run test:rules` could not run
in this sandbox** (no firebase CLI/emulator/egress) — flagged explicitly in the PR for Rory to
run before trusting the rules as verified rather than just read-through. No UI changes; rules
deploy stays a manual step.

### 2026-08-15 (the real /design crash fix: `lib/i18n.tsx` bundle diet, not another band-aid)
Rory: *"It still crashes"* (iOS Safari's native "A problem repeatedly occurred" crash-loop on
`/design`), after "i want a comprehensive fix... i dont want any light page fix" and "disable
this now its interfering with my laptop use too" — this is that comprehensive fix.

Root cause was **not** mapbox-gl (a red herring — a substring match on the translation key
`editEngineMapboxTool`, present in every language). It was `lib/i18n.tsx`: all eleven South
African language dictionaries lived inline in one ~8,590-line module (~420 KB raw / 144 KB
gzip), imported eagerly by `DesignCanvas.tsx` and 326 files app-wide — so `/design` shipped
every farmer's full string table in every one of the eleven languages on every load, regardless
of which one was active.

**Fix:** split `lib/i18n.tsx` into English (`T_en`, stays inline — the default locale and the
synchronous fallback for missing keys) plus ten `lib/locales/<code>.ts` files, each lazy-loaded
on demand via a new `loadLocale()` dynamic `import()`. `translate()`/`t()` stay fully
synchronous (`LOADED[lang]?.[key] ?? LOADED.en[key] ?? key}`) so none of the 326 consuming files
needed to change. `lib/i18n-pending.ts` holds the block of keys shared verbatim across every
locale. `Onboarding.tsx` prefetches all ten locale chunks up front (it's the language-pick
screen, so the point is previewing correctly the instant a farmer picks one).

**Result:** `/design` First Load JS **633 kB → 512 kB**; the i18n chunk itself **144 kB → 22.8
kB gzip** (other ten locales now live in separate chunks not part of `/design`'s initial load
at all). Full test suite green (2647/2649, the 2 remaining failures pre-exist on `main`,
confirmed by running them against a clean checkout — an ESM loader issue in
`auth-account-transition`/`auth-guest-migration.test.ts` unrelated to i18n). `tsc --noEmit`
clean.

### 2026-08-10 (two finishes: Exact Canvas and AI Polished — the second paid pass is shelved)
Rory: *"I just want an exact version for now and a ai render polished version also those 2
because you haven't been able to fix the hybrid properly and messes the ai polished version too."*

The Design Studio's finish picker now offers **exactly two** choices, and the shelf moved off
the AI render and onto the **second** paid pass.

- **Exact Canvas** — free, instant, deterministic; every label, legend and line at full sheet
  resolution.
- **AI Polished** — one paid render. The model paints the **map artwork only**; the app then
  locks the boundary, plant labels, legend panel, title block, north arrow and scale bar back
  on top. The model never sees a word of type, which is why this tier keeps its chrome.
- **Full Treatment** (the second pass over the finished sheet) — shelved behind `?aifinish=1`,
  **not deleted**. It is the tier that returned "Planting · Photo Plan · AI polished · Geometry
  locked" with no labels, no legend and a stamped-on boundary: an image model cannot reproduce
  9px type, and that pass is handed a page covered in it.

Why the previous shelve was wrong: it gated **both** paid tiers on one flag, which left the
Studio with no AI finish at all — Rory: *"i wanted the hybrid shelved not the ai!!!! i didnt say
remoe the ai"*. `SECOND_POLISH_PASS_SHELVED` now gates Full Treatment alone.

Also fixed in the same pass: the one-tap **"AI-polish this exact map · 1 AI render"** button was
dispatching a Full Treatment, which is *two* renders. It now runs the single-render flow it
advertises. The paid button takes the gold, since it is one of two choices and the only one that
spends money.

Naming: the farmer-facing label changed from "AI Hybrid" to **AI Polished** — the old name
described the plumbing, not the result. The internal stage stays `hybrid` everywhere (render
queue, stored `resultKind`, every gallery entry already on a farmer's device); renaming it would
relabel sheets that have already been paid for.

`tests/ai-finishes-shelved.test.ts` → `tests/sheet-finishes.test.ts`, rewritten for the new
contract: the offered AI finish must be reachable with **no** flag and no query string, every
Full Treatment entry point must be gated, the one-tap flip must spend what its label says, the
gallery must never consult the shelf, and the pipeline must still be importable.

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
