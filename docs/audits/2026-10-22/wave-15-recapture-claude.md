# Wave 15 rendered re-capture of the wave 14 build — 2026-10-22

- Auditor: Claude (integrator), with the same headless capture as the 16 and 17 October records.
- Reviewed revision: `main` at `d99108f1` (the wave 14 squash merge), captured from a production build (`next build` + `next start`) in sample mode. The three fixes under *What was already done* were made afterwards on `claude/zen-rubin-00ndhb` and re-probed on a rebuilt production server.
- Deployment inspected: not inspected. The live Vercel build is this same SHA; the frames come from a local production build.
- Previous audit: [Wave 14 rendered re-capture — 17 October 2026](../2026-10-17/wave-14-recapture-claude.md) and the [wave 14 close-out](../2026-10-17/wave-14-integration-claude.md). Every ID is carried forward; new IDs use the `w15-` prefix.
- Scope: the same 51 English routes for six profiles (farmer simple, farmer full, mentor, student, ngo, funder) and the same 51 in isiZulu for the simple farmer, each in light and dark, phone 390×844 and desktop 1280×800: 396 English frames and 204 isiZulu frames, every one paired with its 17 October frame.
- Evidence type: rendered frames (Playwright, headless Chromium, no WebGL), the capture index per frame (HTTP status, document height, horizontal overflow, page title, first h1, console errors), a pixel diff of every paired frame against the 17 October frames, two targeted Playwright probes (`/facilitator/print` on a phone with *More options* open; `/mentor` in isiZulu), and full-size inspection of the frames named below.

## What was already done

The wave 14 close-out marked 37 rows implemented and 21 implemented (partial) from
source review, plus the three w14 fixes and w14-04 for verification. This record checks
them against what renders. Three problems the capture exposed are fixed on the same
branch as this record:

- **w15-01 · /facilitator/print sheet scaler feedback loop (closes w14-04).** `SheetScaler`
  measured the width of the element it zoomed. Once `zoom` dropped below 1, that
  element's `clientWidth` came back as the unzoomed A4 width (1123px), and the first
  sheet, measured before any zoom, stayed at zoom 1 on a 390px phone. With *More options*
  open the document was 1123px wide on a phone, and its height depended on which sheets
  had been measured when the frame was taken. That is the 2821px vs 8126px w14-04
  difference: timing, not the dark theme (all seven sheets render in dark). The ref now
  sits on an outer box that is never zoomed. Re-probed on the rebuilt branch: document
  390px wide, all seven sheets at zoom 0.347, nothing outside a sheet wider than the
  viewport. `@media print` still resets the zoom to 1. Guard: `tests/facilitator-print-scaling.test.ts`.
- **w15-02 · isiZulu draft headings read as one word.** `SurveyZuluDraftPair` stacks the
  isiZulu draft above its English source visually, but the two spans had no text between
  them, so the heading's text and accessible name were "Umsebenzi wami
  wasensiminiEnglish: My fieldwork" (the /mentor and /facilitator → /mentor h1 in 8
  isiZulu frames, and every other paired label). A ` ` between the spans fixes the
  text; a whitespace-only node is not laid out inside the flex column, so the frame is
  unchanged. Re-probed: `textContent` "Umsebenzi wami wasensimini English: My
  fieldwork". Guard: `tests/zulu-draft-pair-separator.test.ts`.
- **w15-03 · /account had no h1 in sample mode.** All 24 sample-mode /account frames
  (every profile) had an empty first h1: the loading, tour and sign-in states render only
  `AppHeader`, whose title is a `<span>`. `AccountShellHeader` now adds a screen-reader
  `<h1>` with the same words, the pattern /community already uses. Guard:
  `tests/account-sample-mode-states.test.ts`.

Measured changes between the 17 October frames (`5acf084c`) and this build (`d99108f1`):

| Measure | 5acf084c | d99108f1 |
| --- | --- | --- |
| English routes with horizontal overflow | /facilitator/print (phone, desktop), /samples/production (phone) | /samples/production (phone) only (w14-05, Codex-owned) |
| isiZulu routes with horizontal overflow | /facilitator/print (both), /network (phone), /samples/production (phone) | /samples/production (phone) only |
| Console errors other than Mapbox (no WebGL) and 429s | React #418 on /account (120 + 20), /student (40 + 20), /student/design/scale (20 + 20) | none |
| Non-200 responses | none | none |
| Distinct page titles across the 51 routes | 42 | 42 (nav-16 remainder; /facilitator/print still has the generic title) |
| Frames with an empty first h1 | — | 38 English: /account (24) → w15-03, /farmer (6) → nav-17, /plan (8, redirects to the Codex-owned /facilitator/crops) |
| Paired English frames changed / unchanged | — | 249 changed · 147 unchanged |
| Paired isiZulu frames changed / unchanged | — | 139 changed · 65 unchanged |

Full-size frames opened: /design and /partners (desktop dark, before and after: both
were light pages in dark mode on 17 October and now render on the dark surface), the
Design Studio Tour chip in dark (readable ochre on dark), /assessments isiZulu desktop
(4986 → 3688px because the question cards now sit in a three-column grid; every question
is still present), /mentor isiZulu phone (w15-02), and /facilitator/print phone with
*More options* open (w15-01). The largest diffs are the expected ones: /facilitator now
redirects to /mentor (staff-15), and the dark /design, /design/lite, /partners and
/samples/production frames moved from light to dark surfaces. Every other row is
verified from the frame diff and the capture index, not by eye. "frame diff vs w14" gives,
per named route, the largest share of pixels that changed on any paired frame of that route.

## Findings and disposition

### Carried from wave 14: 37 implemented and 21 implemented (partial)

The four w14 rows are listed under *New in this capture*.

| ID | User-visible problem (16 October wording, truncated) | Status | Evidence and next action |
| --- | --- | --- | --- |
| ux-07 | medium · /samples/production, /ngo, /funder, phone, light — Ochre is used as text. The /samples/production hea | verified | frame diff vs w14: /samples/production:81% /ngo:17% /funder:18% |
| ux-12 | medium · /student/design, /student/design/case, /student/design/folder, /student/design/worked, /student/desig | verified | frame diff vs w14: /student/design:33% /student/design/case:0% /student/design/folder:0% /student/design/worked:0% /student/design/scale:0% /student/finance:21% /student/teach-the-teachers:23% |
| ux-18 | low · /calendar, /records, /home, phone, light — Crop names are capitalised three different ways: 'Sweet Potat | verified | frame diff vs w14: /calendar:25% /records:33% /home:35% |
| dark-05 | medium · /design, /design/lite, /facilitator (→ /design), phone, dark — The 'Pick a saved place to start desig | verified | frame diff vs w14: /design:99% /design/lite:96% /facilitator:100% |
| dark-10 | medium · /partners, phone, dark — The partners landing page is entirely light (paper hero, white 'What it does | verified | frame diff vs w14: /partners:77% |
| dark-11 | medium · /samples/production, phone, dark — The complete production example is a light paper page in dark mode | verified | frame diff vs w14: /samples/production:81% |
| dark-12 | low · /invoice, phone, dark — The saved-invoice preview at the top is a bright white sheet (#FFFEFA) in dark m | verified | frame diff vs w14: /invoice:36% |
| dark-14 | low · /facilitator/print, phone, dark — The print preview is a light paper page with a white A4 sheet in dark  | verified | frame diff vs w14: /facilitator/print:84% |
| desk-08 | medium · /home, desktop — The desktop home finishes its content about 900px down and then shows roughly 1100px | verified | frame diff vs w14: /home:35% |
| desk-16 | medium · /feedback, desktop — Pages that use SampleExperience.module.css set the H1 to clamp(28px,4vw,42px), s | verified | frame diff vs w14: /feedback:23% |
| staff-09 | medium · /home, phone — A mentor, NGO or funder opening Home sees the farmer's screen: 'Continue with Ubhejane | verified | frame diff vs w14: /home:35% |
| staff-13 | medium · /mentor, /assessments, /ngo, phone — Staff screens show raw ISO dates and lowercase status pills: 'Re | verified | frame diff vs w14: /mentor:0% /assessments:15% /ngo:17% |
| sdesk-14 | low · /assessments, /reports, desktop — Assessment question-result bars and MEL report cards are 1280px-wide s | verified | frame diff vs w14: /assessments:15% /reports:0% |
| zu-01 | medium · /home — In isiZulu the header date reads 'FRIDAY · OCTOBER 16' — English words in US month-first orde | verified | frame diff vs w14: /home:35% |
| zu-04 | medium · /home, /farmer, /student, /records, /login, /prices — 'Language draft' notices are inconsistent and i | verified | frame diff vs w14: /home:35% /farmer:33% /student:33% /records:33% /login:13% /prices:21% |
| zu-06 | medium · /student — Three course cards are English-only in isiZulu mode: 'Design course', 'Farm Finance course | verified | frame diff vs w14: /student:33% |
| zu-11 | medium · /records — Recent-harvest rows show lowercase English crop keys ('carrots', 'swiss chard', 'green bea | verified | frame diff vs w14: /records:33% |
| nav-12 | high · /samples/production, phone — index overflowX=true. The calendar table has min-width 870px (755px under  | verified | frame diff vs w14: /samples/production:81% |
| nav-19 | medium · /student, /student/design/scale — Minified React error #418 (hydration mismatch) is logged three time | verified | frame diff vs w14: /student:33% /student/design/scale:0% |
| copy-17 | low · /mentor — Mentor participant card copy is cryptic: the module list heading reads 'Modules — tick is thei | source only | the "Mentor" h1 lives on the Learning view of /mentor; the capture opens the Field view (h1 "My fieldwork"), so no frame shows it. Source: `app/mentor/page.tsx` line ~678 |
| code-08 | medium · /partners, dark — The partners page root is `bg-paper text-ink` and has 32 uses of the Tailwind-confi | verified | frame diff vs w14: /partners:77% |
| code-17 | low · /samples/production, /partners, /home (chat), dark — Root-only constants (`--bg`, `--surface`, `--surfac | verified | frame diff vs w14: /samples/production:81% /partners:77% /home:35% |
| code-19 | low · /reports (composer), /student (design studies), phone — Three `<table>`s are rendered without an `overfl | verified | frame diff vs w14: /reports:0% /student:33% |
| ux-06 | medium · /samples/production, /facilitator/print, phone, light — Both frames scroll sideways (index overflowX: | verified | frame diff vs w14: /samples/production:81% /facilitator/print:84% · remainder carried (w14 integration record) |
| ux-22 | low · /assessments, /mentor, phone, light — /assessments shows 'About these counts' as a bare bold label with  | verified | frame diff vs w14: /assessments:15% /mentor:0% · remainder carried (w14 integration record) |
| staff-16 | low · /ngo, /funder, /student, /student/teach-the-teachers, phone — Walls of text on phone: the organisation/f | verified | frame diff vs w14: /ngo:17% /funder:18% /student:33% /student/teach-the-teachers:23% · remainder carried (w14 integration record) |
| zu-05 | medium · /farmer — The site report mixes isiZulu headings with English content: 'Zone data: KZN DARD Bioresour | verified | frame diff vs w14: /farmer:33% · remainder carried (w14 integration record) |
| nav-01 | high · /student, /design, /samples, dark — In the dark theme these three pages render as full light pages (cre | verified | frame diff vs w14: /student:33% /design:99% /samples:20% · remainder carried (w14 integration record) |
| nav-17 | medium · /farmer, /design, /account, /facilitator, /plan, /home, /login, /samples/production, /student/finance | verified | frame diff vs w14: /farmer:33% /design:99% /account:3% /facilitator:100% /plan:12% /home:35% /login:13% /samples/production:81% /student/finance:21% /partners:77% · remainder carried (w14 integration record) |
| code-11 | low · /ngo, /reports, /student, /finances, /updates, /design — Emoji and text glyphs still act as icons outsid | verified | frame diff vs w14: /ngo:17% /reports:0% /student:33% /finances:33% /updates:22% /design:99% · remainder carried (w14 integration record) |
| code-12 | low · /ngo, /reports, /records, /finances, /calendar, /account, /mentor — `font-mono` is applied ~200 times (N | verified | frame diff vs w14: /ngo:17% /reports:0% /records:33% /finances:33% /calendar:25% /account:3% /mentor:0% · remainder carried (w14 integration record) |
| code-20 | low · /home, /vision, /reports, /student, /student/finance, /tour, /design, /account — Eight `<img>` tags have | verified | frame diff vs w14: /home:35% /vision:0% /reports:0% /student:33% /student/finance:21% /tour:22% /design:99% /account:3% · remainder carried (w14 integration record) |
| ux-01 | high · /mentor, /samples, /tour, /tips, /offline, /manual/en, /example, /updates, /student/finance, /student/d | verified | frame diff vs w14: /mentor:0% /samples:20% /tour:22% /tips:21% /offline:30% /manual/en:0% /example:2% /updates:22% /student/finance:21% /student/design/scale:0% /student/design/case:0% |
| desk-01 | high · /mentor, desktop — The round green Lima launcher (56px sprout circle, fixed bottom-left) sits on top of | verified | /mentor desktop frame grew 1801 → 1901px (English) and 2012 → 2112px (isiZulu): the `--lima-fab-clearance` bottom inset rendered; the diff % is near 0 because the content above it did not move |
| desk-06 | medium · /home, desktop — There is no single desktop header: 23 pages assemble their own top bar from MenuButt | verified | frame diff vs w14: /home:35% |
| desk-18 | low · /prices, desktop — Several desktop pages use a fraction of the frame and then show a large empty band: / | verified | frame diff vs w14: /prices:21% |
| staff-03 | high · /mentor, /network, /invoice, /exchange, /student/design, /student/finance, /manual/en, phone — The roun | verified | frame diff vs w14: /mentor:0% /network:4% /invoice:36% /exchange:0% /student/design:33% /student/finance:21% /manual/en:0% |
| staff-15 | medium · /reports (funder), /design (mentor /facilitator redirect), /vision (funder), phone — Three staff rout | verified | frame diff vs w14: /reports:0% /design:99% /facilitator:100% /vision:0% |
| sdesk-11 | medium · /surveys, /student, /funder, /student/teach-the-teachers, /mentor — Developer jargon and role terms l | verified | frame diff vs w14: /surveys:0% /student:33% /funder:18% /student/teach-the-teachers:23% /mentor:0% |
| zu-03 | medium · /home — The task list under 'IMISEBENZI EZAYO' is entirely English: 'Prep bed for Sweet potato', 'Sow | verified | frame diff vs w14: /home:35% |
| copy-16 | low · /reports — Two error paths append the raw JavaScript error message to the user-facing text, so a farmer  | source only | the raw-error path does not render in sample mode; `/invoice` frames changed by up to 34% for other wave 14 work. Regression guard in tests (`080dc078`) |
| copy-18 | low · /samples — Sample mode is named six ways on screen: 'Practice views', 'Practice workspace', 'demonstrati | verified | frame diff vs w14: /samples:20% |
| ux-09 | medium · /updates, phone, light — 'What's new' repeats the heading '12 October 2026' four times in a row and ' | verified | frame diff vs w14: /updates:22% · remainder carried (w14 integration record) |
| dark-01 | high · /assessments, /ngo, /funder, /mentor, /samples, /reports, phone, dark — With dark mode on, the app head | verified | frame diff vs w14: /assessments:15% /ngo:17% /funder:18% /mentor:0% /samples:20% /reports:0% · remainder carried (w14 integration record) |
| desk-13 | medium · /example, desktop — /example and /vision are stretched phone screens at 1280: a single ~410px column  | verified | frame diff vs w14: /example:2% · remainder carried (w14 integration record) |
| sdesk-03 | medium · /home, /exchange, /records, /atlas, /farmer, /ngo, desktop, dark — On pages that otherwise theme corr | verified | frame diff vs w14: /home:35% /exchange:0% /records:33% /atlas:6% /farmer:33% /ngo:17% · remainder carried (w14 integration record) |
| nav-09 | low · /updates, phone — Release notes are listed with the same date heading repeated ('12 October 2026' three  | verified | frame diff vs w14: /updates:22% · remainder carried (w14 integration record) |
| nav-16 | medium · 39 of 51 EN routes, 11 of 11 ZU routes — Most pages share the generic <title> 'ImbewuField — permacul | source only | frame diff vs w14: no captured route · remainder carried (w14 integration record) |
| copy-05 | medium · /reports — The reports area is named five ways: nav item 'Site report', page h1 'Saved sites & report | carried open | the wave 14 part was not reached (isizulu track task 3); remainder is in `swarm/w15-isizulu-records` |
| copy-06 | medium · /home — Feature names drift between the home tile, nav drawer, offline page and page header: Journal  | verified | frame diff vs w14: /home:35% · remainder carried (w14 integration record) |
| copy-07 | medium · /home — Title Case and sentence case are mixed within the same menus and lists. The nav drawer shows  | verified | frame diff vs w14: /home:35% · remainder carried (w14 integration record) |
| code-05 | medium · /invoice, /account, dark — Disabled buttons, inputs and the profile card use fixed light colours (#DD | verified | frame diff vs w14: /invoice:36% /account:3% · remainder carried (w14 integration record) |
| code-10 | medium · /community, /contact, /exchange, /prices, /account (consent), phone — Farmer-facing captions below th | verified | frame diff vs w14: /community:35% /contact:9% /exchange:0% /prices:21% /account:3% · remainder carried (w14 integration record) |
| code-15 | medium · /invoice, /surveys, /account, /records, /mentor, /community, /design — 69 inputs/buttons carry Tailwi | verified | frame diff vs w14: /invoice:36% /surveys:0% /account:3% /records:33% /mentor:0% /community:35% /design:99% · remainder carried (w14 integration record) |

The partial rows are verified for the part wave 14 implemented; the remainder stays open
under the same ID and is assigned below.

### New in this capture, and the wave 14 rows

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| w14-01 | /account React #418 in sample mode | verified | no #418 on any /account frame (the 17 October run logged 120 English and 20 isiZulu); /student and /student/design/scale (nav-19) are clean too |
| w14-02 | /facilitator/print desktop overflow | verified | overflowX false on every desktop frame, English and isiZulu |
| w14-03 | /network isiZulu phone overflow | verified | overflowX false on both themes |
| w14-04 | /facilitator/print dark phone frame much shorter than light | closed → w15-01 | not dark-specific; the sheet-scaler feedback loop made the height timing-dependent |
| w14-05 | /samples/production phone overflow (nav-12) | open | still overflowX on phone in both languages; Codex-owned planner output, carried |
| w15-01 | /facilitator/print on a phone with *More options* open: page 1123px wide, sheets at mixed zoom, height timing-dependent | implemented | outer measuring box; re-probed on the rebuilt branch: 390px wide, 7 sheets at zoom 0.347. Confirm the printed PDF in the next capture |
| w15-02 | isiZulu draft + English pairs read as one word ("…wasensiminiEnglish:") to screen readers and in the capture's h1 | implemented | space between the spans; re-probed `textContent` on /mentor isiZulu; frame visually unchanged |
| w15-03 | /account has no h1 in its loading, tour and sign-in states | implemented | screen-reader h1 in `AccountShellHeader`; the next capture should show "Account" as the first h1 |

### Carried open, partial and blocked rows

Assigned to the wave 15 tracks (`swarm/w15-isizulu-records`, `swarm/w15-staff-dark`,
`swarm/w15-farmer-desktop`, `swarm/w15-words-titles`, `swarm/w15-study-icons`):

- isizulu-records: copy-05, code-12, code-15, code-11, code-05, nav-17 (/farmer), desk-18, desk-06, zu-05, and the MyRecords/DataPanel half of sdesk-03.
- staff-dark: dark-01, staff-16, sdesk-03 (NgoDashboard).
- farmer-desktop: sdesk-03, desk-13, code-10, code-20, code-12 (chart files).
- words-titles: nav-16 (including /facilitator/print's generic title), copy-06, copy-07 ("My Records" is still title case in the h1 and the page title), ux-09, nav-09.
- study-icons: ux-12, nav-17 (/student/finance hero), code-20.

Codex-owned, not in a Claude track: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18,
zu-10, ux-06, w14-05 / nav-12, and the empty h1 on /plan → /facilitator/crops.

Rory's decision: desk-15, staff-17 and copy-02 (whether Study keeps the word
"facilitator"), nav-13 (legend emoji).

## Verification

- Typecheck: `npx tsc --noEmit` passes with the three fixes.
- Tests: `tests/facilitator-print-scaling.test.ts`, `tests/zulu-draft-pair-separator.test.ts`, `tests/site-survey-i18n.test.ts`, `tests/type-floor.test.ts` (28 tests) and the /account suites (`tests/account-*.test.ts`, `loading-error-states`, `code-15-copy-15-zu-07`, `component-text-contrast`, `gogo-first-run`, `stale-paper-hex`, `invoice-seller-identity`, `profile-photo-resize`; 101 tests) pass. The full suite runs in CI on the pull request.
- Whitespace: not run.
- Output inspected: 600 frames as listed under *Evidence type*, plus the two probes; the frames opened at full size are named under *What was already done*. Frames stay in the session scratch area and are not committed; the index and diffs are reproducible from `main` at d99108f1 with the same script.
- Other limits: no WebGL in headless Chromium, so map pages render their fallback card; no Firebase credentials, so every frame is sample mode; the printed PDF was not produced; the live deployment was not opened.

## Next continuation

1. Merge this record with the three fixes (branch `claude/zen-rubin-00ndhb`, the wave 15 integration branch).
2. Fold the five wave 15 track PRs onto the same branch and squash-merge once CI is green.
3. In the wave 16 capture, check /facilitator/print on a phone with *More options* open (390px, every sheet at the same zoom), /account's first h1, and the isiZulu /mentor h1 text.
