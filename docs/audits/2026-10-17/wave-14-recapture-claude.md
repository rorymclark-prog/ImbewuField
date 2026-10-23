# Wave 14 rendered re-capture of the wave 13 build — 2026-10-17

- Auditor: Claude (integrator), with the same headless capture as the 16 October audit.
- Reviewed revision: `main` at `5acf084c` (the wave 13 squash merge), captured from a production build (`next build` + `next start`) in sample mode. The three fixes under *What was already done* were made afterwards on `claude/zen-rubin-00ndhb`.
- Deployment inspected: not inspected. The live Vercel build is this same SHA; the frames come from a local production build.
- Previous audit: [Wave 13 visual and UX close-out — 17 October 2026](../2026-10-16/wave-13-integration-claude.md). All 160 IDs are carried forward; new IDs use the `w14-` prefix.
- Scope: every route the 16 October audit captured — 51 English routes for six profiles (farmer simple, farmer full, mentor, student, ngo, funder) and the same 51 in isiZulu for the simple farmer, each in light and dark, phone 390×844 and desktop 1280×800. 396 English frames and 204 isiZulu frames; the 16 October reference had 204 isiZulu frames for 11 routes only, so 160 isiZulu frames are new-only and have no before/after pair.
- Evidence type: rendered frames (Playwright, headless Chromium, no WebGL), the capture index per frame (HTTP status, document height, horizontal overflow, page title, console errors), a pixel diff of every paired frame against the 16 October frames, and full-size inspection of the frames named below.

## What was already done

The wave 13 close-out marked 96 findings implemented and 24 implemented (partial) from
source review alone. This record re-captures the merged build and checks those 120 rows
against what renders. Three regressions that the capture exposed are fixed in the same
branch as this record:

- **w14-01 · /account hydration warning.** Every sample-mode frame of `/account`
  (120 of 120, English and isiZulu, both themes, both viewports) logged React #418
  because the loading branch called `isSampleMode()` during render, reading
  `sessionStorage` on the client and not on the server. `app/account/page.tsx` now reads
  the role through `useSampleRole()` (a `useSyncExternalStore` with a `''` server
  snapshot), so the first client render matches the server markup. Introduced by
  staff-07 / nav-05 / sdesk-02 in wave 13; the page content those rows added is correct.
- **w14-02 · /facilitator/print desktop overflow.** desk-17 pinned the legend column at
  220px so the legend stays readable, but the 240mm plan drawing plus the 8mm gap plus
  220px (≈58mm) is wider than the 269mm left inside the A4 landscape sheet, so the
  legend ran off the right edge and the page gained a horizontal scrollbar at 1280px
  (it had none on 16 October). `PlanSvg` takes an optional `widthMm` and the first sheet
  draws at 200mm × 133mm beside the legend; the per-layer sheets keep 240mm × 160mm.
  `tests/facilitator-print-scaling.test.ts` still pins the 220px column.
- **w14-03 · /network isiZulu district hint.** The "Amasayithi aqoqwe ngezifunda —
  sondeza ukuze ubone isayithi ngalinye" pill is `white-space: nowrap`; at 390px it
  pushed past the map and gave the whole page a horizontal scroll. The English hint is
  short enough to hide the problem, which is why wave 13's staff-05 / ux-20 fix looked
  complete. The pill now wraps on a phone and stays on one line from the `sm`
  breakpoint (`components/network/NetworkMap.tsx`).

Measured changes between the 16 October frames and this build:

| Measure | 16 October | 5acf084c |
| --- | --- | --- |
| English routes with horizontal overflow | /facilitator/print (phone), /samples/production (phone) | the same two, plus /facilitator/print (desktop) → w14-02 |
| isiZulu routes with horizontal overflow (11-route reference) | none | /facilitator/print (both), /samples/production (phone), /network (phone) → w14-03 |
| Console errors other than Mapbox "not supported" (no WebGL) and 429s | React #418 on /student (40) and /student/design/scale (20) | the same, plus /account (120) → w14-01 |
| English routes sharing a generic page title | 41 of 51 | 15 of 51 (nav-16) |
| Rate-limit 429s during capture | present on most data routes | none in the English run (captures are now throttled) |
| Paired English frames changed / unchanged | — | 325 changed · 71 unchanged |
| Paired isiZulu frames changed / unchanged | — | 32 changed · 12 unchanged · 160 new-only |

Full-size frames were opened for: /account (phone light), /invoice, /updates, /tips,
/offline, /example, /samples (desktop light), /facilitator/print (desktop light, dark
phone), /partners (phone light before and after, phone dark), /network (isiZulu phone
light), and 36 further frames at one-third size on three contact sheets (twelve dark
phone, twelve light phone, twelve light desktop routes). Every other row below is
verified by the frame diff and the capture index, not by eye: "frame diff" lists, per
named route, the largest percentage of pixels that changed on any paired frame of that
route. A row whose routes all show 0% would mean the change did not render; none do
after /partners was checked at full size (its 0% is a pairing artefact of the diff
script — the Tour pill is gone in the new frame).

## Findings and disposition

### Carried from wave 13: 96 implemented and 24 implemented (partial)

| ID | User-visible problem (16 October wording, truncated) | Status | Evidence and next action |
| --- | --- | --- | --- |
| ux-01 | high · /mentor, /samples, /tour, /tips, /offline, /manual/en, /example, /updates, /student/finance, /student/d | verified | frame diff: /example:57% /manual/en:1% /mentor:73% /offline:33% /samples:99% /student/design/case:96% /student/design/scale:83% /student/finance:96% /tips:26% /tour:6% /updates:96% |
| ux-02 | high · /home, /records, /prices, /exchange, /ngo, /funder, /assessments, /reports, /samples, /student, /studen | verified | verified on the spot-checked routes (/home, /records, /reports, /student, /assessments); the remaining named routes changed in the frame diff but were not opened at full size |
| ux-03 | high · /login, /contact, /surveys, /student, /feedback, phone, light — Developer vocabulary is shown to the fa | verified | frame diff: /contact:13% /feedback:13% /login:9% /student:91% /surveys:13% |
| ux-04 | high · /account, phone, light — The Account tab, one of only four bottom tabs, is an empty paper screen with a | verified | verified · /account now renders the sample-mode account (phone 2159px, was a spinner) — but every sample-mode frame logged React #418; reopened as w14-01 and fixed in this PR |
| ux-05 | medium · /journal, phone, light — Every journal entry badge uses an emoji as its icon (🌱 Planting, 🧺 Harvest, | verified | frame diff: /journal:6% |
| ux-08 | medium · /home (and every page with the bottom tab bar), phone, light — In the bottom tab bar 'My Records' wra | verified | frame diff: /home:72% |
| ux-09 | medium · /updates, phone, light — 'What's new' repeats the heading '12 October 2026' four times in a row and ' | verified | frame diff: /updates:96% |
| ux-10 | medium · /pitch, phone, light — On a phone the pitch deck renders as a 370px-wide slide with 5-8px text that c | verified | verified · phone /pitch shows the "Best viewed on a laptop" card with a print/PDF action instead of the scaled deck |
| ux-11 | medium · /contact, /samples, /tips, /feedback, /reports, /tour, /manual/en, /samples/farm, /samples/gardens, p | verified | frame diff: /contact:13% /feedback:13% /manual/en:1% /reports:99% /samples:99% /samples/farm:12% /samples/gardens:39% /tips:26% /tour:6% |
| ux-13 | medium · /farmer, /reports, phone, light — The site report sheet on /farmer shows three lines of codes under t | verified | frame diff: /farmer:37% /reports:99% |
| ux-14 | medium · /atlas, /network, /farmer, phone, light — When the map cannot start (no WebGL, old phone/browser) the | verified | frame diff: /atlas:90% /farmer:37% /network:96% |
| ux-15 | low · /home, phone, light — The weather card says 'Weather unavailable right now — showing site climate data b | verified | frame diff: /home:72% |
| ux-16 | low · /invoice, phone, light — The printed invoice preview shows the sample email 'accounts@ubhejane.example.i | verified | frame diff: /invoice:20% |
| ux-17 | low · /records, phone, light — Number formats differ within one screen: 'R8 172,00', 'R70,00', 'R12 359,00', ' | verified | frame diff: /records:22% |
| ux-19 | low · /tips, phone, light — Tips & help for a Simple-mode farmer is a column of mentor/charts/invoice tips ('D | verified | frame diff: /tips:26% |
| ux-20 | low · /network, phone, light — The stat strip is clipped at the right edge ('HARVEST 32 707' cut off, no scrol | verified | verified · see staff-05 |
| ux-21 | low · /samples/farm, /samples/gardens, phone, light — /samples/farm shows the browser's unstyled 'Choose Files | verified | frame diff: /samples/farm:12% /samples/gardens:39% |
| dark-01 | high · /assessments, /ngo, /funder, /mentor, /samples, /reports, phone, dark — With dark mode on, the app head | verified | frame diff: /assessments:97% /funder:80% /mentor:73% /ngo:78% /reports:99% /samples:99% |
| dark-02 | high · /student, /student/design, /student/design/case, /student/design/folder, /student/design/scale, /studen | verified | frame diff: /student:91% /student/design:96% /student/design/case:96% /student/design/folder:97% /student/design/scale:83% /student/design/worked:91% /student/finance:96% /student/teach-the-teachers:100% |
| dark-03 | high · /atlas, /network, phone, dark — The map area is a hard-coded paper #E4DCC6 slab filling the whole viewp | verified | verified · dark /atlas and /network map area follows --bg-1; no paper rectangle |
| dark-04 | medium · /updates, phone, dark — The page is paper-coloured (#E4DCC6) with ink-black body text under a dark he | verified | frame diff: /updates:96% |
| dark-06 | high · /exchange, phone, dark — The Everything / Offering / Wanted segment control and all 14 crop filter chip | verified | frame diff: /exchange:26% |
| dark-07 | medium · /example, phone, dark — In the example site report the 'Key species' chips (Buffalo Thorn, Wild Olive | verified | frame diff: /example:57% |
| dark-08 | medium · /records, /finances (→ /records), phone, dark — In the 'Records for a lender' card the three stat til | verified | frame diff: /finances:21% /records:22% |
| dark-09 | medium · /records, /samples/farm, /invoice, phone, dark — Native form controls render as white boxes with dark | verified | frame diff: /invoice:20% /records:22% /samples/farm:12% |
| desk-01 | high · /mentor, desktop — The round green Lima launcher (56px sprout circle, fixed bottom-left) sits on top of | verified | frame diff: /mentor:73% |
| desk-02 | high · /invoice, desktop — In sample mode the invoice page opens with the full 'Saved (70)' list expanded inli | verified | verified · desktop /invoice opens on the sample invoice list, not a blank frame |
| desk-03 | high · /reports, desktop, dark — With the dark earth theme on, the header and bottom bar go dark but the page | verified | frame diff: /reports:99% |
| desk-04 | high · /exchange, desktop, dark — On the dark /exchange board the Everything/Offering/Wanted segmented control | verified | frame diff: /exchange:26% |
| desk-05 | medium · /records, desktop, dark — In dark mode the Records page shows white native selects and inputs on dark | verified | frame diff: /records:22% |
| desk-06 | medium · /home, desktop — There is no single desktop header: 23 pages assemble their own top bar from MenuButt | verified | frame diff: /home:72% |
| desk-07 | medium · /home, desktop — At 1280 the primary navigation is still the phone bottom tab bar (Home / Map / My Re | verified | frame diff: /home:72% |
| desk-09 | medium · /student, desktop — On /student the Lima 'Ask for help' bar is rendered inline in the middle of the p | verified | frame diff: /student:91% |
| desk-10 | medium · /farmer, desktop — When the map cannot start (no WebGL in the capture browser) /farmer, /atlas and /n | verified | frame diff: /farmer:37% |
| desk-11 | medium · /account, desktop — /account renders an empty 800px frame with only a faint sprout mark in both light | verified | frame diff: /account:54% |
| desk-12 | medium · /records, desktop — On the Picked / Sold / Spent tabs the 1280px Records page shows the phone layout: | verified | frame diff: /records:22% |
| desk-13 | medium · /example, desktop — /example and /vision are stretched phone screens at 1280: a single ~410px column | verified | frame diff: /example:57% |
| desk-14 | medium · /contact, desktop — Developer jargon is on farmer-facing screens: /contact 'Backend not connected - m | verified | frame diff: /contact:13% |
| desk-17 | medium · /facilitator/print, desktop — On the A4 plan sheet at 1280 the legend column is about 90px wide so ev | reopened | reopened as w14-02 · the fixed 220px legend column fits the legend, but 240mm drawing + 8mm gap + 220px exceeds the 269mm inner sheet, so desktop /facilitator/print now has overflowX=true (it had none on 16 October). Fixed in this PR |
| desk-18 | low · /prices, desktop — Several desktop pages use a fraction of the frame and then show a large empty band: / | verified | frame diff: /prices:73% |
| staff-01 | high · /mentor, /ngo, /funder, /assessments, /reports, /surveys, /design (mentor /facilitator redirect), /part | verified | frame diff: /assessments:97% /design:0% /facilitator:0% /funder:80% /mentor:73% /ngo:78% /partners:0% /reports:99% /student/design:96% /student/finance:96% /student/teach-the-teachers:100% /surveys:13% |
| staff-02 | high · /home, phone, dark — The 'NEXT STEP · Tell Lima about this land' card on Home is painted with a light-t | verified | frame diff: /home:72% |
| staff-03 | high · /mentor, /network, /invoice, /exchange, /student/design, /student/finance, /manual/en, phone — The roun | verified | frame diff: /exchange:26% /invoice:20% /manual/en:1% /mentor:73% /network:96% /student/design:96% /student/finance:96% |
| staff-04 | medium · /home, /surveys, /calendar, /network, /reports, /vision, /student, phone — Many staff pages end with | verified | frame diff: /calendar:5% /home:72% /network:96% /reports:99% /student:91% /surveys:13% /vision:36% |
| staff-05 | high · /network, phone — On phone the Network page's KPI strip is cut off at the right edge ('HARVEST 32 707' | verified | verified in English (no overflowX on /network phone, stat strip intact) · the isiZulu district hint pill overflows at 390px — reopened as w14-03 and fixed in this PR |
| staff-06 | high · /pitch, phone — The funder pitch deck is scaled down to a tiny bezel on phone: slide text is ~5px and u | verified | frame diff: /pitch:21% |
| staff-07 | high · /account, phone — The Account page never resolves in sample mode: every profile shows only a faint cent | verified | verified · see ux-04; hydration warning reopened as w14-01 |
| staff-08 | high · /surveys, /student, phone — Developer wording on screen for paying users: /surveys shows 'demonstration | verified | frame diff: /student:91% /surveys:13% |
| staff-10 | medium · /home, /mentor, /ngo, /funder, /reports, /vision, /student, phone — Bottom navigation differs by role | verified | frame diff: /funder:80% /home:72% /mentor:73% /ngo:78% /reports:99% /student:91% /vision:36% |
| staff-11 | medium · /invoice, phone — The invoice page lists all 70 sample invoices in full, each with five payment-metho | verified | verified · see sdesk-13 (phone frame also shorter) |
| staff-12 | high · /exchange, /atlas, phone, dark — On /exchange in dark the 'Everything / Offering / Wanted' filter butto | verified | frame diff: /atlas:90% /exchange:26% |
| staff-14 | medium · /partners, phone — On the Partners page the floating 'Tour' pill sits on top of the 'Get the app' but | verified | verified · partners phone frame no longer shows the floating Tour pill over the header (compared against the 16 October frame) |
| staff-15 | medium · /reports (funder), /design (mentor /facilitator redirect), /vision (funder), phone — Three staff rout | verified | frame diff: /design:0% /facilitator:0% /reports:99% /vision:36% |
| staff-17 | low · /exchange, /student/design, /student/finance, phone — The role word 'facilitator' is still on screen: th | verified | frame diff: /exchange:26% /student/design:96% /student/finance:96% |
| staff-18 | low · /calendar, phone — The mentor Planting Calendar's 12-month tab strip is cut at the left ('…y Jun Jul … D | verified | frame diff: /calendar:5% |
| sdesk-01 | high · /ngo, /funder, /reports, /assessments, /network, /student, /student/design, /student/finance, /student/ | verified | frame diff: /assessments:97% /design:0% /funder:80% /network:96% /ngo:78% /partners:0% /reports:99% /student:91% /student/design:96% /student/finance:96% /student/teach-the-teachers:100% |
| sdesk-02 | high · /account, desktop — Every captured /account frame for every staff role, light and dark, is an empty pag | verified | verified · desktop /account renders (1453px taller than the empty frame); hydration warning reopened as w14-01 |
| sdesk-03 | medium · /home, /exchange, /records, /atlas, /farmer, /ngo, desktop, dark — On pages that otherwise theme corr | verified | frame diff: /atlas:90% /exchange:26% /farmer:37% /home:72% /ngo:78% /records:22% |
| sdesk-04 | medium · /mentor, /ngo, /funder, /reports, /partners, /student, desktop — The role dashboards do not share a c | verified | frame diff: /funder:80% /mentor:73% /ngo:78% /partners:0% /reports:99% /student:91% |
| sdesk-05 | medium · /mentor, /student, /funder, /home, /vision — Bottom navigation does not match the role. | verified | frame diff: /funder:80% /home:72% /mentor:73% /student:91% /vision:36% |
| sdesk-06 | medium · /surveys, /student, /reports, /prices, /calendar, /home, /mentor, desktop — Several desktop frames ar | verified | frame diff: /calendar:5% /home:72% /mentor:73% /prices:73% /reports:99% /student:91% /surveys:13% |
| sdesk-07 | medium · /vision, desktop — The Vision page is a 448px (max-w-md) phone column centred in a 1280px window with | verified | verified · desktop /vision uses the wide layout |
| sdesk-08 | medium · /network, /farmer, /atlas, desktop — When Mapbox cannot start (no WebGL in the capture rig, but also | verified | frame diff: /atlas:90% /farmer:37% /network:96% |
| sdesk-09 | high · /partners, desktop — The floating product-tour pill from ProductTourProvider sits on top of the partner | verified | verified · see staff-14 (desktop frame) |
| sdesk-10 | medium · /journal — The field-journal category chips (Visitor / training, etc.) use emoji glyphs as their icon | verified | frame diff: /journal:6% |
| sdesk-11 | medium · /surveys, /student, /funder, /student/teach-the-teachers, /mentor — Developer jargon and role terms l | verified | frame diff: /funder:80% /mentor:73% /student:91% /student/teach-the-teachers:100% /surveys:13% |
| sdesk-12 | low · /network, desktop — The network side panel uses 9.5–10.5px uppercase tracked labels for KPI captions and | verified | frame diff: /network:96% |
| sdesk-13 | medium · /invoice, desktop — The invoices page is an 8678px single-column scroll of ~70 invoice rows, each car | verified | verified · desktop /invoice is 1345px, down from the 8678px single column |
| zu-02 | medium · /home, /farmer — The weather fallback card is English-only on isiZulu screens: 'Weather unavailable r | verified | frame diff: /farmer:37% /home:72% |
| zu-03 | medium · /home — The task list under 'IMISEBENZI EZAYO' is entirely English: 'Prep bed for Sweet potato', 'Sow | verified | frame diff: /home:72% |
| zu-07 | low · /login, /account, /design — The fixed sample-mode pill still says 'Tour' in English on pages that use Sa | verified | frame diff: /account:54% /design:0% /login:9% |
| zu-08 | medium · /home, /farmer, /records, /student, /prices, /journal, phone — isiZulu bottom-nav labels wrap: 'I-akh | verified | frame diff: /farmer:37% /home:72% /journal:6% /prices:73% /records:22% /student:91% |
| zu-09 | medium · /login — Login mixes bilingual and single-language labels: 'Ngena · Sign in', 'Dala i-akhawunti · Cre | verified | frame diff: /login:9% |
| zu-13 | low · /home — Role list uses odd capitalisation 'INhlangano' in 'Umlimi · Imeluleki · INhlangano · Umxhasi · U | verified | frame diff: /home:72% |
| nav-02 | high · /offline, /tour, /updates, /tips, /example, /manual/en, /samples, /samples/gardens, phone — Pages witho | verified | frame diff: /example:57% /manual/en:1% /offline:33% /samples:99% /samples/gardens:39% /tips:26% /tour:6% /updates:96% |
| nav-03 | medium · /student, /offline, /tour, /tips, /updates, /samples, /example, /manual/en, phone — Bottom navigation | verified | frame diff: /example:57% /manual/en:1% /offline:33% /samples:99% /student:91% /tips:26% /tour:6% /updates:96% |
| nav-04 | medium · /login, /contact, /student, /feedback — Developer jargon on farmer-facing screens: 'Backend not conne | verified | frame diff: /contact:13% /feedback:13% /login:9% /student:91% |
| nav-05 | high · /account — In tour mode /account never leaves its loading state: the page is a blank card with one fade | verified | verified · see ux-04; hydration warning reopened as w14-01 |
| nav-06 | low · /offline, phone — The status line under the header is just the bold word 'Connected' with no icon or sen | verified | frame diff: /offline:33% |
| nav-07 | medium · /contact, phone — The header has two back controls side by side: the pill 'Back' button and a bare '< | verified | frame diff: /contact:13% |
| nav-08 | medium · /samples — The header link says 'Account', the h1 says 'Choose a view' and an h2 immediately undernea | verified | frame diff: /samples:99% |
| nav-09 | low · /updates, phone — Release notes are listed with the same date heading repeated ('12 October 2026' three | verified | frame diff: /updates:96% |
| nav-10 | medium · /samples/farm, phone — The evidence section shows the browser's native 'Choose Files \ | verified | frame diff: /samples/farm:12% |
| nav-11 | low · /samples/gardens, phone — Each garden card has a nested card with an underlined 'Open completed report ( | verified | frame diff: /samples/gardens:39% |
| nav-13 | high · /facilitator/print, phone — index overflowX=true. | verified | frame diff: /facilitator/print:9% |
| nav-14 | medium · /farmer, /atlas, /network — When the map cannot start (no WebGL) the map area is a blank beige block | verified | frame diff: /atlas:90% /farmer:37% /network:96% |
| nav-15 | low · /example, phone — The banner uses white text on the raw ochre fill #C07A1E, below the 4.5:1 rule in CLAU | verified | frame diff: /example:57% |
| nav-16 | medium · 39 of 51 EN routes, 11 of 11 ZU routes — Most pages share the generic <title> 'ImbewuField — permacul | verified | 15 of 51 EN routes still share a title (was 41), 13 of 51 ZU; the rest are the redirect stubs and the manual/design group — residual carried as partial |
| nav-20 | low · /records — The harvest total reads '1,203.6 kg' (US comma grouping) beside rands formatted the South Afr | verified | frame diff: /records:22% |
| copy-01 | high · /records — The My Records header subtitle reads 'What you grow · what you sell · designs from your supe | verified | frame diff: /records:22% |
| copy-02 | medium · /exchange — Banned role words outside the known student-Study exemption: the farmer Exchange empty/co | verified | frame diff: /exchange:26% |
| copy-03 | medium · /home — The bed-by-bed planner is called 'Production plan' in the home tile, nav, offline page and pa | verified | frame diff: /home:72% |
| copy-04 | medium · /records — The records screen has four names. | verified | frame diff: /records:22% |
| copy-05 | medium · /reports — The reports area is named five ways: nav item 'Site report', page h1 'Saved sites & report | verified | frame diff: /reports:99% |
| copy-06 | medium · /home — Feature names drift between the home tile, nav drawer, offline page and page header: Journal | verified | frame diff: /home:72% |
| copy-07 | medium · /home — Title Case and sentence case are mixed within the same menus and lists. | verified | frame diff: /home:72% |
| copy-08 | medium · /farmer — The button that dismisses a sheet or guide is labelled differently each time: 'Got it' (map | verified | frame diff: /farmer:37% |
| copy-09 | medium · /offline — Developer vocabulary on farmer screens: 'sync', 'queue' and 'sync system'. | verified | frame diff: /offline:33% |
| copy-10 | low · /calendar — The planting calendar legend reads 'In catalog sowing window' — internal data-model wording | verified | frame diff: /calendar:5% |
| copy-11 | medium · /home — The home 'Dashboards' tiles describe roles in sector jargon a first-time farmer will not read | verified | frame diff: /home:72% |
| copy-12 | low · /account — The ngo role is shown as 'Organisation' on the home tile, nav section and NGO dashboard, but | verified | frame diff: /account:54% |
| copy-13 | medium · /records — Only /exchange, /partners, /manual/* and the student design/finance lessons set a page tit | verified | frame diff: /records:22% |
| copy-14 | low · /reports — Six date renders use bare toLocaleDateString(), so on a phone whose browser locale is en-US ( | verified | frame diff: /reports:99% |
| copy-15 | low · /community — Photos that carry meaning are marked decorative with alt="": community post photos, profile | verified | frame diff: /community:72% |
| copy-16 | low · /reports — Two error paths append the raw JavaScript error message to the user-facing text, so a farmer | verified | frame diff: /reports:99% |
| copy-18 | low · /samples — Sample mode is named six ways on screen: 'Practice views', 'Practice workspace', 'demonstrati | verified | frame diff: /samples:99% |
| code-01 | high · /student, dark — The whole Studies/student area is painted in hardcoded light-mode colours: 157 hex lit | verified | verified · dark /student, /student/design/* render on the dark surface (phone and desktop frames) |
| code-02 | high · /network, dark — The network page defines its own palette as constants (INK, INK_SOFT, INK_MUTED, LINE, | verified | verified · dark /network uses the theme surface |
| code-03 | medium · /atlas, /updates, /journal, /vision, /invoice, /account, dark — Page roots, sticky headers and divide | verified | frame diff: /account:54% /atlas:90% /invoice:20% /journal:6% /updates:96% /vision:36% |
| code-04 | high · /journal, /records, /finances (sheets), dark — The journal entry sheet, evidence sheet, field journal c | verified | frame diff: /finances:21% /journal:6% /records:22% |
| code-05 | medium · /invoice, /account, dark — Disabled buttons, inputs and the profile card use fixed light colours (#DD | verified | frame diff: /account:54% /invoice:20% |
| code-06 | medium · /records, /finances, /student, /account, /community, /mentor (profile & people sheets) — Text colours | verified | frame diff: /account:54% /community:72% /finances:21% /mentor:73% /records:22% /student:91% |
| code-07 | medium · /records, /calendar, /map, /farmer (isiZulu draft notes), dark — Tailwind palette classes are used on | verified | frame diff: /calendar:5% /farmer:37% /map:no-frame /records:22% |
| code-09 | medium · /records, /finances, /journal, /reports (DataPanel, evidence, saved reports) — 43 inline `font: '700 | verified | frame diff: /finances:21% /journal:6% /records:22% /reports:99% |
| code-10 | medium · /community, /contact, /exchange, /prices, /account (consent), phone — Farmer-facing captions below th | verified | frame diff: /account:54% /community:72% /contact:13% /exchange:26% /prices:73% |
| code-13 | medium · /home, /mentor, /surveys, /invoice, /community, /journal, /records, /ngo, /network, /account, /atlas, | verified | frame diff: /account:54% /atlas:90% /community:72% /funder:80% /home:72% /invoice:20% /journal:6% /mentor:73% /network:96% /ngo:78% /prices:73% /records:22% /surveys:13% /vision:36% |
| code-14 | medium · /vision, /mentor, /surveys, /assessments, /home, /finances, /offline, /plan, /reports, /tips, /studen | verified | frame diff: /assessments:97% /finances:21% /home:72% /mentor:73% /offline:33% /plan:0% /reports:99% /student:91% /surveys:13% /tips:26% /vision:36% |
| code-15 | medium · /invoice, /surveys, /account, /records, /mentor, /community, /design — 69 inputs/buttons carry Tailwi | verified | frame diff: /account:54% /community:72% /design:0% /invoice:20% /mentor:73% /records:22% /surveys:13% |
| code-16 | low · /records, /journal (evidence sheets), phone — The close buttons on the evidence catalogue and evidence s | verified | frame diff: /journal:6% /records:22% |
| code-18 | low · /community, /network (profile sheet) — Avatar initials in ProfileSheet are Leaf (#A8D88A) text on the ro | verified | frame diff: /community:72% /network:96% |
The 24 "implemented (partial)" rows are verified for the part wave 13 implemented; the
remainder stays open under the same ID and is in a wave 14 track or on Rory's list
(see below).

### New in this capture

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| w14-01 | /account in sample mode logs React #418 (hydration mismatch) on every frame; in the field this is a flash of the wrong state on first paint and a full client re-render | implemented | `app/account/page.tsx` reads the sample role through `useSampleRole()`; 120 of 120 frames logged the error on 5acf084c. Typecheck passes; re-capture after merge should show zero #418 on /account |
| w14-02 | /facilitator/print at 1280px: the Legend + BOQ column runs off the right edge of the A4 sheet and the page scrolls horizontally | implemented | `widthMm={200}` on the first-sheet `PlanSvg`; per-layer sheets unchanged; `tests/facilitator-print-scaling.test.ts` and `tests/facilitator-print-fixes.test.ts` pass (13 tests). Confirm the printed PDF still fits one sheet |
| w14-03 | /network in isiZulu on a phone: the district hint pill overflows the map and the page scrolls sideways | implemented | hint wraps below `sm`; English frames unaffected. Re-capture isiZulu phone after merge |
| w14-04 | /facilitator/print dark phone frame is 2821px tall against 8126px in light: the capture ends after the first sheet and the rest is blank paper | needs verification | Not reproduced at full size in light. Either a capture-timing artefact (the per-layer sheets had not laid out) or the dark theme hides the later sheets. Open the dark print preview on a phone before closing |
| w14-05 | /samples/production phone overflow (nav-12) is confirmed on this build in both languages | open | codex-owned planner output; carried, not reopened |

### Carried open, partial and blocked rows

Unchanged from the wave 13 close-out and now assigned to the wave 14 tracks
(`swarm/w14-dark-leftovers`, `swarm/w14-desktop-frame-2`, `swarm/w14-staff-copy`,
`swarm/w14-isizulu`, `swarm/w14-study`):

- Open (33): ux-06, ux-07, ux-12, ux-18, ux-22, dark-05, dark-10, dark-11, dark-12,
  dark-14, desk-08, desk-15, desk-16, staff-09, staff-13, staff-16, sdesk-14, zu-01,
  zu-04, zu-05, zu-06, zu-11, nav-01, nav-12, nav-17, nav-19, copy-17, code-08, code-11,
  code-12, code-17, code-19, code-20.
- Partial remainder (24): ux-01, ux-09, dark-01, desk-01, desk-06, desk-13, desk-18,
  staff-03, staff-15, staff-17, sdesk-03, sdesk-11, zu-03, nav-09, nav-13, nav-16,
  copy-02, copy-05, copy-06, copy-07, copy-16, copy-18, code-05, code-10, code-15.
- Blocked, codex-owned or Rory's decision (7): dark-13, desk-19, staff-19, sdesk-15,
  zu-10, zu-12, nav-18.

nav-19 (/student and /student/design/scale React #418) reproduces on this build (40 and
20 frames) and is in the study track.

## Verification

- Typecheck: `npx tsc --noEmit` passes with the three fixes.
- Tests: `tests/facilitator-print-scaling.test.ts` and `tests/facilitator-print-fixes.test.ts` pass (13 tests). The full suite runs in CI on the pull request.
- Whitespace: not run.
- Output inspected: 600 frames captured as listed under *Evidence type*; the frames opened at full size are named under *What was already done*. The frames stay in the session scratch area and are not committed; the capture index and diff summaries are reproducible from `main` at 5acf084c with the same script.
- Other limits: no WebGL in headless Chromium, so the map pages render their fallback card; no Firebase credentials, so every frame is sample mode; the isiZulu reference covered 11 routes, so 40 isiZulu routes have a first capture here and no before/after comparison; the live deployment was not opened.

## Next continuation

1. Merge this record with the three fixes (branch `claude/zen-rubin-00ndhb`, the wave 14 integration branch).
2. Fold the five wave 14 track PRs onto the same branch, re-run the capture on the result, and close w14-04 by opening the dark print preview on a phone.
3. Re-check /account, /network (isiZulu phone) and /facilitator/print (desktop) in the next capture: all three should show no overflow and no #418.
