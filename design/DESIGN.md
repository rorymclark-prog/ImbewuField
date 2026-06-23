# ImbewuField — Design source of truth

The almanac-direction handoff. Mockups live in `design/handoff/` (27 frames);
the authoritative build brief is `design/BUILD-INSTRUCTIONS.md`. When the build
and a mockup disagree, the mockup wins unless a newer decision is recorded here.

## ⚠️ #1 recurring mistake — RESPONSIVE FONT SIZES (BUILD-INSTRUCTIONS §0)

Phone mockups are ~392px wide; their 24–26px text is correct **for phones only.**
Do NOT reuse phone px on tablet/desktop — it renders ~2× too big. Font size scales
with the viewport (use `clamp()` or `md:`/`lg:` breakpoints).

| Role | Phone <768 | Tablet 768–1023 | Desktop ≥1024 | Font |
|---|---|---|---|---|
| Hero / big number | 24–25 | 34 | 40 / 600 | Newsreader |
| Page H1 | 24 | 26 | 30 / 600 | Newsreader |
| Section H2 | 17 | 20 | 22 / 600 | Newsreader |
| Top-nav items | (hidden) | 16 | 16 / 600 | **Public Sans** |
| Body | 15 | 16 | 16 / 400 | Public Sans |
| Buttons | 15–16 | 15 | 15 / 700 | Public Sans |
| Small / captions / map labels | 11–13 | 13 | 13 | Public Sans |
| Tab-bar labels | 10 | 12 | 12 | Public Sans |

Applied: the **farmer-map chrome** (header 60px, settings 40px, RoleSwitcher nav
16/600 Public Sans, Design-map 15/700, tagline 13px, DataPanel hero
`clamp(24px,2.2vw,28px)`) AND **NgoDashboard** (stat big-number →
`clamp(24px,2.2vw,34px)`; also removed 6 stray emoji → Lucide icons + labels to
Public Sans). Audited & confirmed already-on-spec (no change needed): the
**facilitator** page chrome and the **finances** page (all text ≤16px, within
the §0 desktop targets).

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
- **Garden Survey** at `/survey` (home quick-action) — 5-step wizard (land known
  from map → sun & slope → resources → goal → confirm beds), Lima sizes the beds
  (1.2 m × 8 m), then a six-week establishment plan you can slide + print. Saves
  to `imbewu_garden_survey`; beds seed from the planner crops (frame 29)
- **Crop Plan** at `/cropplan` (Crop Planner → "Jobs") — task scheduler with four
  zoom levels: Day (today's jobs), Week (Mon–Sun, 7-col grid on desktop), Month
  (calendar w/ per-day job dots), Season (3-month focus). Jobs derive from the
  beds (garden survey / planner crops) via a weekly rota; responsive type
  throughout (frame 31)
- AI permaculture report (frame 25); role dashboards NGO/Funder/Mentor/Student (frames 19/20)
- Auth: email + Google + reset + change password; Firestore rules + indexes
- **Desktop financial sheet** (frame 15) — at lg+ `/finances` shows the laptop
  ledger: name · "Financial sheet" + Month/Season/Year toggle + CSV Export +
  New-invoice link; stat row Income/Expenses/Net/Yield; table Date·Description·
  Qty·In·Source·Out (sales=IN, harvests=yield rows). Phone keeps the card view.
  (Expenses column is wired but reads — until cost logging exists.)
- **iPad/tablet layout** (frame 26, "priority #2") — the farmer map/panel split
  moved from the single 768px breakpoint to `lg:` (1024): landscape tablets +
  desktop get the persistent 390px side panel; phone + **portrait** tablet keep
  the full-width map + Details bottom-sheet. Map tools panel + Lima FAB on both.
- Map tools panel redesign (calm/unified/ochre-primary) — see `design/mockups/map-tools.html`
- **Cost/expense logging** — finances "New entry" has a Money in / Money out
  toggle (frame 16); expenses (ExpenseLog / expense_logs) flow into the desktop
  sheet's Out column + Expenses + Net stats, and the mobile "Spent this month" card.
- **NGO surveys** at `/surveys` (frame 21) — staff build (title + Yes/No /
  choice / text questions); farmers answer in-app (Answered badge, no re-answer).
  surveys + survey_responses collections + rules + index. Linked from home Dashboards.
- **POPIA consent + get-to-know-you onboarding** (frames 23/24) —
  `components/PopiaConsent.tsx`, 2-step first-login modal on /home (data agreement
  + goal), saves `imbewu_popia`; gates after the language picker.

- **Lima Vision** at `/vision` (frames 13/14) — photograph a bed → Claude
  (`/api/lima-vision`, sonnet-4-6) estimates crop + yield kg + weeks-to-harvest;
  "Weigh my harvest" mode estimates kg. Honest low-confidence handling. Linked
  from home Dashboards.
- **Expense-slip OCR** (frame 32 pt 1) — finances "Money out" form has a "Scan a
  till slip" button → `/api/read-slip` (Claude) reads total/item/supplier and
  pre-fills the cost fields with Lima's note to double-check.
- **GPS boundary-walk** (frame 05) — a "GPS" button in the map's draw reticle
  drops a corner at the farmer's `navigator.geolocation` position (reuses
  pushCorner; no change to existing draw logic).

**Deferred — the only thing genuinely blocked on external setup:**
- Google Sheets mirror + Google Calendar task sync (frames 15/18) — needs a
  Google Cloud OAuth client + consent screen the project owner must provision;
  not buildable from code alone. (The desktop financial SHEET + CSV export and
  the in-app calendar/cropplan are already built — only the live Google sync is out.)

**Lower-priority / superseded:**
- Site-analysis Q&A stepper (frame 04) — overlaps the built `/survey` garden wizard.
- Invoice → auto-post to ledger; yield-vs-planned (frame 32) — nice-to-have.
- Map tools MOBILE bottom-sheet (map-tools.html mobile variant) — the panel
  redesign already applies on phone; a bottom-sheet would collide with the
  Details sheet + Lima FAB + TabBar already at the map's bottom edge.
