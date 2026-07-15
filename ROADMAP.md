# ImbewuField — Running Roadmap

_Single source of truth for what's done, what's not, and what's decided. Updated by Claude as things move. Live app: **imbewufield.vercel.app** (deploys on push to `main`). Restore point: **`git checkout baseline-pre-merge-20260715`**._

_Last updated: 2026-07-15_

---

## ✅ SHIPPED & LIVE (on imbewufield.vercel.app)
- Crop-plan polish — harvest-window gold-cap fix, retail/wholesale plain-English copy, full-year total, collapsible tasks, sticky month header
- Field-utilization chart clamped to 100% (no more impossible >100%)
- Survey/design pipeline — one site-ID scheme + migration, per-site shape isolation, JoJo-size & tree species/count prompts, survey auto-fill from traced shapes
- Home task board + one-tap "add to calendar" (.ics)
- Bookkeeping — invoice payment method (cash/EFT/card/mobile), harvest reconciliation (sold vs intended vs harvested), **desktop** expense/sale entry
- Bill of Quantities collapsed behind a Budget toggle (gogo-first)
- **Community v1 — DARK (off).** To turn on needs BOTH: env `NEXT_PUBLIC_COMMUNITY_ENABLED=true` + Firestore doc `app_config/community {enabled:true}`
- Card/page contrast (Option 1b) — darker page, near-white cards
- Crop-plan Home button; design-canvas map controls moved off the tabs; **Lima button now draggable**
- Agronomy accuracy corrections — 62 sourced catalog fixes + sowing instructions + organic guide (commit ddfad91)
- Deploy fixed — push to `main` → GitHub Action → imbewufield.vercel.app (was going to wrong branch before)

## 🅿️ BUILT BUT PARKED (recoverable, not live — awaiting your call)
- **Crop-scheduler redesign** (`parked/overnight-wip-20260715`) — solves the March-gap + mono-crop; huge coverage/diversity win; parked only because it's 2 bed-months short of old code in ~10 winter scenarios. **My rec: ship it.**
- **Sample-farm NGO demo** (`parked/overnight-wip-20260715`) — UNSAFE as built (could touch real data). Needs one clean fix: neuter storage at the root in sample mode, OR only offer it logged-out.
- **Finer 5m contours** (git stash) — modest improvement; does NOT show your 3m bank (that needs drone data). Parked pending decision.

## 🔄 IN FLIGHT (running now)
- **KZN BRU upgrade — BUILDING IN PARALLEL** (your call, this session)

## 🗺️ MERGE PLAN — DONE (recommendation ready, awaiting your go on Phase 1)
- **Recommended: Approach C — "one shell, sequence the best pieces."** Don't fuse the render engines (they're genuinely incompatible: Map = WebGL, Design Studio = SVG, old FacilitatorCanvas = Konva). Instead: one flow where the live map hosts *tracing*, the Design Studio hosts *design*, and BOQ/report/AI-render (mostly pure functions) plug in — retiring the duplicate doors + second AI review.
- **Great news from the code:** the layer-aware palette you asked for ("features pop up as you select layers") ALREADY EXISTS (`categoriesForStep`); the stepper you like is there; Design Studio already reads the live-traced boundary.
- **Phase 1 = tiny + near-zero risk:** add an explicit Guided/Pro toggle over the palette filter that's already built. No data change, no new route. Fully revertible.
- Later phases (each additive, app stays shippable): Firestore-sync the design state → port BOQ/report/water-calc as adapters → extract live-map tracing into the Base step (the one hard/uncertain phase) → consolidate the AI-render paths.

## 🧭 DECIDED (direction locked)
- **Merge Map + Design into ONE surface**, Guided + Pro only. Canonical = the Design Studio (you love it). Execute in small revertible phases. Rollback tag exists.
- **Use-what-we-have on SA agro-data** for the private stage — licensing risk verified LOW; add attribution.
- **BRU upgrade: build in parallel** with the merge.
- Repeating-annual-cycle crop model (no per-year plans) — confirmed keep.

## ⏳ PENDING YOUR DECISION
- Merge: pick the approach + confirm Phase 1 (once the plan lands)
- Ship the parked **scheduler redesign**? (rec: yes)
- Sample-farm: which safe rearchitect (root-storage-guard vs logged-out-only)?
- Turn **Community v1** on and review it? (flip the 2 switches)
- Build the **drone-DEM feature** (true 0.5m contours + site micro-zones)?
- Ship or drop the parked **5m-contours** half-measure?
- Send data-request emails to ARC-ISCW / KZN DARD (only needed before public/commercial launch)

## 💡 CAPTURED IDEAS (not started)
- **Hybrid AI auto-suggest** (AI reasons over slope/aspect/sun/vision the app already has → code makes clean zone geometry). The real fix for the "concentric circles" problem.
- Weather + 7-day forecast + frost/hail/heat warnings (new: Open-Meteo)
- Harvest breakdown per crop/month + retail/wholesale values + loss/consumption sliders
- Design canvas interactions: middle-mouse / two-finger pan; mid-draw vertex grab-and-nudge; edit shape after Accept; show all polygon corners
- Layer-aware element palette (features filter to the selected layer)
- **Community v2** — living farm map (faces, Google-Earth zoom, read-only showcases, group seed-buy). Ubhejane = flagship.
- **Ubhejane permanent read-only showcase** (decided: named WITH crèche consent; logged-in-only)
- Guided first-login journey (find land → trace → survey → design → crop plan)
- Move the dev "workshop" to the cloud (so a closed Mac lid doesn't pause work)

## 🐞 KNOWN ISSUES (from the audit, not yet fixed)
- Sign-out lands on the dead `/gate` page instead of `/login` (one-line safe fix)
- Crop-planning spread across 4 routes with colliding labels (being solved by the merge)
- Site-elements sync gap (pushes to Firestore, never pulls back — vanishes on 2nd device)
- A few consistency safe-fixes (site/place/garden terminology; 2 hardcoded nav labels; demo badge hidden on mobile)

## 📦 OWED BY YOU (unblocks things)
- Crèche's written consent + a few garden photos → unblocks the named Ubhejane showcase
- The decisions in "Pending" above

## 🔑 KEY FACTS
- Deploy: `git push origin main` → Action → imbewufield.vercel.app + permamap-sa.vercel.app (~2 min). NOT the manual vercel path.
- Restore today's app: `git checkout baseline-pre-merge-20260715`
- KZN BRU live data (verified): `https://gis.kzndard.gov.za/server/rest/services/Hosted/BRU/FeatureServer/1` — 768 zones, per-zone climate, public.
- Attribution to add when using agro-data: KZN DARD / CSIR StepSA / Camp & Liengme.
