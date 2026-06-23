# ImbewuField — Design source of truth

The almanac-direction handoff. Mockups live in `design/handoff/` (26 frames).
This file is the canonical reference; when the build and a mockup disagree, the
mockup wins unless a newer decision is recorded here.

## Design system (frame 27 · design kit)

- **Type** — Newsreader (display, headings & numerals) + Public Sans (UI & body).
  Scale: Display 32 · Title 24 · Body 16 · Small 14 · Overline 11 (uppercase, 700).
- **Palette** — Forest `#1F4D2B`, Ochre `#C07A1E`, Water `#235E86`, Paper `#F7F2E9`,
  Card `#FBF6EC`, Ink `#20190F`, Ink-muted `#5C5040`, Ink-faint `#8C7A62`, Hairline `#E2D8C4`.
- **Lima** — the field-guide persona, woven through every screen; context-aware,
  advises but never takes control. "Lima" = "to cultivate" (Nguni).
- **No emoji in UI** — real drawn symbols / Lucide icons only.

## Roles — FIVE, not seven (frames 02, 03, 19)

`farmer · mentor · student · ngo · funder` (+ `admin`).

**Mentor** is one role merging the former *supervisor* (farm visits, design
sign-off) and *trainer* (the 9-month course). It runs the course, visits farms,
and signs off module progress. The garden-design canvas (`/facilitator`) is a
**tool**, not a role — reached via the "Design map" button.

## Home is TASK-FIRST, not role-first (frame 03)

Lead with one clear **Analyse a site** action + quick tasks (Journal / Planner /
Map). Roles live behind a quiet "Dashboards" disclosure — never a prominent
role launcher. No vendor/data-source badges anywhere in the UI (NASA POWER,
ISRIC, SANBI, Claude AI were removed).

## The core flow (frames 04, 05, 09, 25)

Saved sites → ① **Analyse** (Lima Q&A + photos + family needs) → ② **Map boundary**
(drop marker, walk edges w/ GPS, measure area, rainwater harvest) → ③ **Design**
on the real satellite image, to scale, locked to north → **Report** (cover →
planting calendar → bill of quantities).

## Status — what's built vs. the handoff

**Applied (matches mockups):**
- Almanac palette + Newsreader/Public Sans + Lima persona + no-emoji sweep
- 5-role model with Mentor merge; task-first home; vendor badges removed (frames 02/03)
- **Two-face type only — no mono.** `--font-mono` is aliased to Public Sans so
  the legacy `.font-mono` overlines render as Public Sans (frame 30 fix)
- Map: marker + boundary draw + satellite/map toggle (frame 05)
- Design canvas w/ real top-view symbols, import-map, set-scale (frames 06/09)
- **Crop Planner w/ quantities** — per-crop bed stepper → projected plants + kg
  yield; season total; Lima references the planting (frame 30). Beds stored in
  `imbewu_planner_qty`; crop names stay in `imbewu_planner_crops` (calendar compat)
- Field journal, finances "one big number", planting calendar (frames 11–18)
- **Invoice builder** at `/invoice` (linked from Finances) — bill-to + line items
  (crop · qty · unit · price) → live preview → print (A4). Seq in `imbewu_invoice_seq`.
  Print reuses the ReportView `@media print` / `.no-print` pattern (frame 32 pt 2)
- AI permaculture report (frame 25); role dashboards NGO/Funder/Mentor/Student (frames 19/20)
- Auth: email + Google + reset + change password; Firestore rules + indexes

**Deferred — need camera/vision/OAuth/infra (NOT yet built):**
- Lima photo-vision: photograph a bed → estimate crop, yield, time-in-ground (frame 13)
- Weigh-by-photo: estimate harvest kg from a photo + known-size reference (frame 14)
- **Photograph an expense slip → Lima reads & allocates it to a crop (frame 32 pt 1)** — needs OCR/vision
- **Survey-the-unknowns flow → Lima-suggested bed sizes (frame 29)** — only asks rain tanks / electricity / slope etc. (land + water already known from the map); confirm beds, slide the weeks, print
- GPS boundary-walk capture (frame 05 frame 2) — geolocation tracking
- Google Sheets mirror + Google Calendar task sync (frames 15/18)
- Invoice → auto-posts to ledger; yield-vs-planned (frame 32); NGO surveys → farmer task (frame 21)
- POPIA consent + "get to know you" onboarding (frames 23/24)
- iPad/tablet dedicated layout — landscape persistent side-panel ("priority #2", frame 26)
