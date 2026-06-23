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
