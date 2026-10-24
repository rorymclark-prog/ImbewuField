# Wave 20 rendered re-capture and visual review of the wave 19 build — 2026-10-23

- Auditor: Claude (integrator). Same headless capture as the wave 19 record, plus four visual-review passes over the frames.
- Reviewed revision: the wave 19 integration head `7dde4e08` (#1091), which is the tree squash-merged to `main`. Captured from a production build (`next build` + `next start`) in sample mode.
- Deployment: not inspected for the capture. The frames come from a local production build of the same tree.
- Previous audit: the [wave 19 re-capture](wave-19-recapture-claude.md) and the [wave 19 close-out](wave-19-integration-claude.md). Every `w19-` ID is carried forward; new IDs use the `w20-` prefix.
- Scope: the same 51 English routes for six profiles and the same 51 isiZulu routes for the simple farmer. Each was captured in light and dark, at phone (390×844) and desktop (1280×800). That gives 396 English frames and 204 isiZulu frames, each paired with its wave 19 frame.
- Evidence:
  - Rendered frames (Playwright, headless Chromium, no WebGL).
  - A pixel diff of every frame pair.
  - The quality sweep: text contrast, text under 12px, unnamed controls, phone tap targets under 24px, h1 count, and horizontal overflow.
  - A visual review of every route in four groups: farmer daily pages; design, map and samples; Study; staff and public pages. Each reviewer first checked the wave 19 fixes in their group, then traced every new finding to source.

## What was already done

- Pixel diff against wave 19:
  - English: 252 of 396 frames changed and 144 did not.
  - isiZulu: 139 of 204 frames changed and 65 did not.

  The biggest moves are where wave 19 worked: /records and /finances (the Picked tab, about 41%), /exchange (AppHeader, 37%), /samples/gardens (58% on phone) and /farmer (49% on phone, the error banner and header).
- Sweep against wave 19:

  | Check | Wave 19 | Wave 20 | What is left |
  | --- | --- | --- | --- |
  | Text under 4.5:1 | 182 | 182 | Codex's /plan (158) and `components/crops/*` on /samples/production (24). |
  | Text under 12px | 878 | 878 | /plan (456) and /samples/production (390), both Codex's crop components, plus `/facilitator/print` (32, exempt). |
  | Phone tap targets under 24px | 108 | 104 | The /samples/production jump link (`w19-16`) now has its hit area; 18 hits per mode remain there, all in Codex's crop components. |

- No horizontal overflow and no unnamed controls. The only h1 gaps are the /plan rows (Codex).

## Findings and disposition

### Carried from wave 19

| ID | Status | Evidence |
| --- | --- | --- |
| w19-01, 02, 04, 08, 10, 12, 13, 15 | verified | no TabBar at desktop where the header carries the nav; /exchange on AppHeader; /farmer error banner under the header; /offline card spacing and disabled button; 320px journal rail; money on one line in English and isiZulu; LimaBar in flow on /invoice; Share PDF and Print once |
| w19-03 | partial | Back, Settings and the DataPanel chips are sans. DataPanel tabs, CropSelect, MyRecords inputs, the exchange Post button and /account controls are still serif → `w20-03`, `w20-10`, `w20-12` |
| w19-05 | partial | lede art is inline. The exchange CROP filter chips still stack the icon above the label → `w20-04` |
| w19-06 | partial, regression | "Sample · 1d ago" is always top-right, but in isiZulu the `1fr auto` grid makes the kind badge overlap the Sample pill → `w20-01` |
| w19-07 | verified | role chip themed and under the name (still serif → `w20-03`) |
| w19-09 | verified | staff Home on AppHeader (LimaBar alignment and label → `w20-08`) |
| w19-11 | partial | the wrapper is plain; the inner gutter, the 34rem form inside a full-width card and the `:root` card surface in dark remain → `w20-13` |
| w19-14 | partial | the invoice line-item CropSelect is still serif → `w20-12` |
| w19-16–18, 20, 22–26 | verified | production nav and print, themed CTA and copy, MiniPlanPlate and coordinates, one Tour control, form gaps, Atlas title, /feedback label, MEL heading weights, /design/lite |
| w19-19 | partial, regression | fixed on desktop. On phone in dark the MEL hero is a zero-padding bordered box → `w20-16` |
| w19-21 | partial | MEL and SampleExperience buttons still use a 10px radius; the /samples card paragraph is still flush → `w20-25` |
| w19-27–31, 33, 35–37 | verified | worked diagram readable on phone and themed; disclosure chevrons; finance header label; refresher lists; /tips grid; balanced headings; list rhythm; English notice hidden in isiZulu |
| w19-32 | mostly | one card surface; card titles and the offline strip still differ → `w20-31` |
| w19-34 | verified | /manual on AppHeader (the isiZulu header label truncates, accepted) |
| w19-38 | partial | short titles. /ngo desktop nav is clipped to "Acc" and /network on phone shows "N" → `w20-37`, `w20-38` |
| w19-39 | mostly | strip and list fixed; the map legend and pins do not use the list's status colours → `w20-39` |
| w19-40 | verified | /login has no permanent "Connecting…" and says "this device" (copy repetition → `w20-44`) |
| w19-41 | verified | metric font and due chip (the numbers are emerald → `w20-40`) |
| w19-42 | mostly | /vision toggle still wraps → `w20-41`; /partners phone h1 leaves "community-" dangling → `w20-43` |
| copy-05 | pending translator | `savedSiteUnavailable` renders the English fallback in isiZulu |

### New in wave 20

The visual review found 46 issues, grouped by the wave 20 track that owns the files (branch `swarm/w20-<track>`). Line numbers are from `7dde4e08`.

| ID | Severity | Track | Where | Finding |
| --- | --- | --- | --- | --- |
| w20-01 | high | farmer-pages | /exchange isiZulu phone | **Kind badge overlaps the Sample pill.** "OKUNIKEZWAYO" is drawn over "Isibonelo": the right grid column grows to fit the pill plus the nowrap "Ezinsukwini ezingu-1 ezedlule", and the badge cannot shrink (components/exchange/ListingCard.tsx:98 `gridTemplateColumns:'1fr auto'`, :159 posted `whiteSpace:'nowrap'`). **Fix:** `minmax(min-content,1fr) auto`, and stack the right column (`flex-col items-end`) so the time sits under the pill, or let it wrap. |
| w20-02 | medium | farmer-pages | /exchange, /home isiZulu | **English through code paths.** The exchange CROP chips (components/exchange/ExchangeBoard.tsx:339 `c.name`) and the "most traded" lede (components/exchange/ExchangeLede.tsx:33 `crop.name`) list crops in English, while the cards say "Ushevu". Home's upcoming tasks read "Prep bed for Ubhatata", "Bed 6 · Due this month": `taskVerb*`, `taskBedLabel`, `taskDue*` (lib/i18n.tsx:1161-1172) have no entry in lib/locales/zu.ts, though app/home/page.tsx:345-348 says they are translated. **Fix:** `produceLabel(cropKey, lang)` as ListingCard.tsx:123 does; add labelled isiZulu drafts for the task keys (new lines only). |
| w20-03 | medium | farmer-pages | /account, /exchange | **Serif controls.** Inputs, selects and buttons render in Newsreader: app/account/page.tsx:240, :252, :354, :378, :387, :399, :445, :459, :464, :487, :511, :534, :549, :554, :569, :578; ExchangeBoard.tsx:260 (Post); components/exchange/ExchangeGuide.tsx:107, :143; components/exchange/NewListingForm.tsx:232, :623. **Fix:** `font-sans` on every control; Newsreader for headings and figures only. |
| w20-04 | low-medium | farmer-pages | /exchange | **Filter chips and phone toolbar.** The CROP chips stack the icon above the label (ExchangeBoard.tsx:335-339; Chip :554-584 has no inline-flex). On phone the stats row leaves "14 farmers" on a line of its own (:534), and the full-width Post button sits above a full-width "How it works" bar of equal weight (:258-275). **Fix:** `display:inline-flex; align-items:center; gap:4px` on Chip; a 3+2 stat grid on phone; Post as the only filled control. |
| w20-05 | medium | farmer-pages | /journal | **Titles in a fallback serif.** Font shorthands name `Newsreader` literally, but next/font hashes the family, so titles fall back to Georgia/Times (components/journal/FieldJournal.tsx:331, :395, :480; JournalEntrySheet.tsx:149; components/EvidenceSheet.tsx:165, :390; components/EvidenceCatalogue.tsx:58, :61, :130, :141, :151, :159). **Fix:** `var(--font-display)` in those shorthands. |
| w20-06 | medium | farmer-pages | /offline as farmer | **Staff copy for farmers.** The farmer reads about "Completed visits, training registers, signatures…" and "0 authorised information requests saved on this device" (lib/i18n.tsx:1880 `offlineSavedEntriesDescription`, :1893 `offlineCachedCount`; app/offline/page.tsx:134, :137). **Fix:** farmer/student variants as new keys (e.g. "Journal notes, records and photos wait here until you have signal"); hide the count when it is 0 or for farmers. |
| w20-07 | low-medium | farmer-pages | /journal, /calendar, /account desktop | **No measure.** The journal list runs to about 1265px (about 130-character lines), the calendar month card and Lima advice span 1250px (app/calendar/page.tsx:470-485), and /account puts two short rows in 1100px cards (app/account/page.tsx:230). **Fix:** `max-width` about 960-1040px centred; about 640px for the account form. |
| w20-08 | low | farmer-pages | farmer daily pages, staff /home | **Lima entry.** /journal, /calendar, /records and /invoice use the in-flow LimaBar; /prices, /tips, /offline, /exchange, /account and /farmer the FAB, which floats over empty paper on /account and /prices (components/ChatWidget.tsx:355-366). On staff /home the LimaBar is wider than the content (no inner `px-4`, compare app/home/page.tsx:554) and still says "your planting helper" (`limaWhoIs`, lib/i18n.tsx:251). **Fix:** one pattern for the farmer daily pages, or the split written into DESIGN.md; `px-4`; a role-neutral label as a new key. |
| w20-09 | high | farmer-data | /farmer light | **Near-black completeness card.** "Site completeness" paints a hardcoded `#0B120B` with gold text inside a light panel: components/DataPanel.tsx:1011 renders `<CompletionScore>` without `surface`, so it falls back to DARK_PALETTE (components/report/CompletionScore.tsx:17-28; SURFACE_PALETTE :30-32). **Fix:** pass `surface`; SURFACE_PALETTE on `var(--bg-1)`, `var(--border)`, `var(--text-primary)`. |
| w20-10 | medium | farmer-data | /farmer | **Clipped tab row.** The DataPanel tabs read "Repo…" with the scrollbar hidden, so nothing says more tabs exist; labels are 12.5px serif (components/DataPanel.tsx:943-971; its comment says "wrap so all are always visible"). **Fix:** `flex-wrap` or `flex-1` tabs that fit; `font-sans`. |
| w20-11 | medium | farmer-data | /farmer dark | **Two primary greens.** "Fill the survey" is fixed `#1F4D2B`; "Generate full report" is `var(--color-forest-800)` (components/NextStepCoach.tsx:281; also `#C07A1E` :205, `#1F4D2B` :210, `#F7C97E` :212). **Fix:** `var(--color-forest-800)` / `var(--on-forest-800)`; `var(--gold)` / `var(--gold-dim)` accents. |
| w20-12 | medium | farmer-data | /records, /invoice | **Serif controls (rest of `w19-03`, `w19-14`).** components/MyRecords.tsx:182, :274, :432; components/CropSelect.tsx:95, :146, :153; app/records/page.tsx:1620 (header Invoice pill). **Fix:** `font-sans`. |
| w20-13 | medium | farmer-data | /records Picked tab | **Rest of `w19-11`.** Cards sit 16px inside the stat tiles and tabs (MyRecords.tsx:1296 `p-4 space-y-4`); on desktop the form is capped at 34rem (`.u-form-column`, app/globals.css:192) inside a full-width card while the harvest rows stretch to about 1150px; in dark the Card paints `--color-surface` (MyRecords.tsx:146-150). **Fix:** drop the inner `p-4`; match the form card to its column or a two-column form at lg; `var(--bg-1)` / `var(--text-primary)`. |
| w20-14 | low-medium | farmer-data | /records dark | **Sparklines vanish.** The harvest trend is fixed forest on a dark card (MyRecords.tsx:1390-1394 `rgba(31,77,43,0.25)`, `#1F4D2B`; the `#C07A1E` pattern at :1475, :1479). **Fix:** `var(--color-forest-800)`, `var(--gold)`, a `color-mix(...)` underlay. |
| w20-15 | low | farmer-data | /records header | **Invoice pill.** Serif, ochre-tinted, its text in `var(--record-negative)`, the expense colour (app/records/page.tsx:1619-1623). **Fix:** the standard secondary pill (`var(--bg-1)`, `var(--border)`, sans, `var(--text-primary)`). |
| w20-16 | medium | samples-map | MEL pages, phone dark | **Hero regression (`w19-19`).** The dark rule (components/MelDashboard.module.css:8) beats the phone reset (:63), so the hero is a zero-padding bordered box. **Fix:** scope :8 to `min-width:651px`, or repeat the dark reset inside the query. |
| w20-17 | medium | samples-map | /samples/farm, /samples/gardens | **Page button style leaks into the header.** `.page button` (components/SampleExperience.module.css:30, :32) reaches the AppHeader Back and Settings pills. Its buttons are weight 400, and the notice has a gold border with no icon unlike the MEL notice (:20). **Fix:** scope to `.content`; 999px radius, weight 600; the MEL notice pattern. |
| w20-18 | medium | samples-map | /samples/production | **Theme and phone calendar.** The selected filter, calendar header and selected month use `--brand` / `--on-forest` and `#426a38` / `#cfa44a` (components/ProductionExample.module.css:44, :54, :57). On phone the label column is 183px (:112). **Fix:** forest-800 tokens and `var(--gold)`; about 120px labels with 24px art. |
| w20-19 | medium | samples-map | /assessments, /ngo | **Toggle placement and accordions.** The organisation/funder toggle sits below the metrics it controls (components/SampleProgramme.tsx:68 after :65). The `.about` accordions differ from the others (MelDashboard.module.css:54; SampleProgramme.tsx:55, :57). On /ngo the `.compact` band is full-bleed (MelDashboard.module.css:44, SampleProgramme.tsx:40). **Fix:** toggle above the metrics; one accordion style; `.compact` as a card in the column, stacked below 480px. |
| w20-20 | low-medium | samples-map | /assessments | **Zero-answer cells.** Questions with no answers render blank cells and odd 8/8 splits (components/MelDashboard.tsx:32-35, lib/sample-programme.ts:24). **Fix:** an `n === 0` empty state ("No answers yet"). |
| w20-21 | low-medium | samples-map | /reports desktop | **Cap and repeated heading.** A 720px column with the h2 repeating the title (app/reports/page.tsx:91, :93). **Fix:** the shared content width; drop the repeat. |
| w20-22 | low-medium | samples-map | MEL tabs, /mentor plan cards | **Selected ring and chip rows.** The selected tab looks like a focus ring (MelDashboard.module.css:33). The `.row` chips used by the mentor plan cards wrap with no row gap (:16; components/FieldTeams.tsx:231). **Fix:** a filled `--badge-bg` selected state; `row-gap:6px` and an 8px paragraph margin. |
| w20-23 | low | samples-map | /design | **Picker arrow and header.** A typed arrow at app/design/page.tsx:564, and the picker has its own header (about :510). **Fix:** Lucide ArrowRight; AppHeader. |
| w20-24 | low | samples-map | /surveys, /assessments | **Learn link.** The header "Learn" link is underlined text beside pill controls (components/LessonLink.tsx:48-60; app/surveys/page.tsx:801; app/assessments/page.tsx:20). **Fix:** a `tone="chip"` variant matching the Settings pill. |
| w20-25 | low | samples-map | /feedback, /samples | **Width and spacing (rest of `w19-21`).** /feedback is a 1080px form (SampleExperience.module.css:2; app/feedback/page.tsx:30, :40); /samples card paragraphs are flush with their buttons (app/samples/page.tsx:81, :84-85; app/samples/farm/page.tsx:30); MEL buttons still use a 10px radius. **Fix:** 640px / 65ch; card and details margins; the one shared radius. |
| w20-26 | low | farmer-data | sample farm data, /records | **"Creche".** lib/demo-farm.ts:42, :723 and app/records/page.tsx:1844. **Fix:** "Crèche". |
| w20-27 | medium-high | study | /student/finance phone | **Lima button covers text.** `.main` sets `padding-bottom:80px` (components/studies/FinanceCourse.module.css:59), overriding `var(--lima-fab-clearance,100px)` at :4, so the FAB sits on the offline-download text. **Fix:** use the clearance variable. |
| w20-28 | medium | study | Study course pages | **Raw ▶ markers.** Disclosures still show the browser triangle: FinanceCourse.module.css:45; app/student/design/page.tsx:32; app/student/design/[lesson]/page.tsx:50, :52; app/student/finance/[lesson]/page.tsx:46, :52, :55; components/studies/CourseSyllabus.tsx:76; DesignPortfolio.tsx:132; DesignWorkedExample.tsx:57, :58, :119, :125, :131, :132. **Fix:** the notice summary pattern (FinanceCourse.module.css:25-28) with Lucide ChevronDown. |
| w20-29 | medium | study | Study action rows | **Mixed link colours, left-aligned labels.** Only `a:has(svg)` is forest (FinanceCourse.module.css:16); `.actions a, button` have no colour (:39). Wrapped phone button labels are left-aligned (:63). **Fix:** `color: var(--color-forest-800)`; `text-align:center`. |
| w20-30 | medium | study | /student/design, /student/finance, /student/teach-the-teachers | **Own header.** No logo and no nav (app/student/design/page.tsx:18, app/student/finance/page.tsx:19, app/student/teach-the-teachers/page.tsx:17-20; FinanceCourse.module.css:2-3; Refresher.module.css:7). **Fix:** AppHeader with a `data-header-secondary` label, as app/manual/[lang]/page.tsx:32 does. |
| w20-31 | medium | study | /student | **Card titles and offline strip (rest of `w19-32`).** `app/student/page.tsx` is byte-pinned; its card titles are 18px strong (:1441-1446) and the offline strip is `bg-2` (:990-991). **Fix:** CSS only in app/student/Studies.module.css (`.coursePreviewLink strong`, `.offline`, `.courseHeading h2`). |
| w20-32 | low-medium | study | /student/teach-the-teachers | **Drift.** Hero gradient, ochre-dim eyebrow, `--border`, 1080/16 widths (Refresher.module.css:9-12); "10." overhangs (:31-32). **Fix:** `var(--bg-1)`, `var(--text-secondary)`, `--border-strong`, 1120/20; `moduleList` 2.25em. |
| w20-33 | low-medium | study | isiZulu Study | **English left.** The /tips header title (app/tips/page.tsx:25), the "Connect to Farm Finance" link (app/student/design/page.tsx:31) and "My Studies" on /student/finance (app/student/finance/page.tsx:19). **Fix:** drafts through the existing DesignDraftCopy / study-local pattern (this track does not edit `lib/i18n.tsx` or `lib/locales/*`). |
| w20-34 | low-medium | study | /student/design/worked | **Enlarge diagram.** Unstyled and does nothing on phone (components/studies/DesignWorkedDiagram.tsx:62, module :30-34). **Fix:** the button style with Lucide Maximize2; hide below 760px. |
| w20-35 | low-medium | study | /student/finance | **Loose checklist.** The reading checklist floats with no card (app/student/finance/page.tsx:32, components/studies/FinanceReadingChecklist.tsx, FinanceCourse.module.css:43-44). **Fix:** a card with a progress bar. |
| w20-36 | low | study | /manual, /tour, worked example | **Small icon and heading drift.** Manual h1/h2 are 600 ink (app/manual/[lang]/page.tsx:34, :44); the tour uses ArrowUpRight for internal links (app/tour/page.tsx:5, :72); "↑" is typed (DesignWorkedExample.tsx:103, :123; ArrowLabel). **Fix:** 400 forest; ArrowRight 16; Lucide ArrowUp. |
| w20-37 | medium-high | staff-public | /ngo desktop; every AppHeader page | **Nav clipped; title duplicates.** The nav is `min-w-0 overflow-hidden` (components/layout/AppHeader.tsx:65) and the /ngo "Portfolio map" pill duplicates Network (app/ngo/page.tsx:115-124), so the nav cuts to "Acc". The title is a 12px muted span that repeats the h1 and the active nav item, and its divider hangs when the title is empty (AppHeader.tsx:57-63). **Fix:** drop the pill or `lg:hidden`; nav `shrink-0`, never cut mid-word; divider and title only when a title is set, `lg:hidden` when the nav shows. |
| w20-38 | medium-high | staff-public | /network phone | **Title "N".** The badge pushes Settings off-screen (app/network/page.tsx:195, badge about :220-240). **Fix:** an icon chip below `sm`, or move the badge into the page body. |
| w20-39 | medium | staff-public | /network | **Map colours differ from the list.** NetworkMap hardcodes `#1F4D2B`, `--gold-dim` and `#C0531E` (components/NetworkMap.tsx:92-96) against STATUS_COLOR (app/network/page.tsx:83-94). The legend +/− are typed (NetworkMap.tsx:543). **Fix:** one shared status token map; Lucide Plus/Minus. |
| w20-40 | medium | staff-public | /mentor | **Raw date and emerald numbers.** A raw ISO `followUpDate` (components/FieldTeams.tsx:226; :267 already uses `formatStaffDate`). `.metric strong` is emerald (components/FieldWork.module.css). **Fix:** `formatStaffDate`; `var(--text-primary)`; font-display names. |
| w20-41 | medium | staff-public | /vision | **Toggle wraps, h1 off-axis.** app/vision/page.tsx:240 (h1 left of the 720px column), :246, :258 (toggle). **Fix:** `whitespace-nowrap` and equal-basis segments; h1 inside the centred column. |
| w20-42 | low-medium | staff-public | cohort dashboard | **Export CSV emerald.** `FOREST='var(--emerald)'` (components/CohortDashboard.tsx:78, button about :379). **Fix:** `var(--color-forest-800)` / `var(--on-forest-800)`. |
| w20-43 | low | staff-public | /partners phone | **"community-" dangles.** app/partners/page.tsx:182-183. **Fix:** a non-breaking hyphen (U+2011). |
| w20-44 | low | staff-public | /login | **"Sign in" four times and `:root` card.** app/login/page.tsx:188-232, card `--color-surface` / `--color-ink` about :220-227. **Fix:** a different h1 or no subtitle; `var(--bg-1)`, `var(--border)`, `var(--text-primary)`. |
| w20-45 | low | staff-public | /facilitator/print | **Print sheet drift.** sans-serif and `#1F4D2B` (app/facilitator/print/page.tsx:734, :680, :685); a doubled "N ↑" (:317). **Fix:** font tokens; one arrow icon. |
| w20-46 | low | staff-public | /pitch | **Typed chevrons.** ‹ › glyphs (app/pitch/page.tsx:656-670); the counter sits outside `.navbtns` (about :996-1000). **Fix:** Lucide ChevronLeft/Right; counter inside the group. |

### Unchanged

- Codex-owned: /plan, the small text and contrast in `components/crops/*` on /samples/production (including the ProductionAvailabilityGraphs white cards in dark), and the IDs listed as Codex-owned in the wave 19 re-capture.
- Exempt: the `/facilitator/print` sheet text (32 instances) is a scaled print preview.
- Capture artefacts, not findings: the farmer-full desktop /farmer "That's a lot of requests" banner (rate limiting during capture) and the Home "Weather is not available right now" strip (no network).
- Not acted on: one staff-dashboard header pattern (needs DESIGN.md first); /community redirects to /home for signed-in users (feature flag).
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study); nav-13 (legend emoji); copy-06 remainder (NavDrawer "Offline and sync"); farmer journal filters in the sidebar at lg+; the personal Gmail contact on /partners and /pitch.
- Translator: copy-05 (`savedSiteUnavailable`), the 23 BRU group names, and the isiZulu drafts added by earlier waves.

## Verification

- Capture: 396 English and 204 isiZulu frames, no capture failures. 288 sweep rows.
- Pinned files: `lib/i18n.tsx` and `lib/locales/zu.ts` are checked by `tests/study-ui-due-unlock-history-checks.ts`, which allows added keys but no rewording without a re-baseline. `app/student/page.tsx` is byte-pinned, so `w20-31` is CSS only.

## Next continuation

1. Wave 20 swarm, five Sonnet tracks: farmer-pages (`w20-01`–`08`), farmer-data (`w20-09`–`15`, `w20-26`), samples-map (`w20-16`–`25`), study (`w20-27`–`36`), staff-public (`w20-37`–`46`). Only staff-public edits `components/layout/AppHeader.tsx`; only farmer-data edits `app/globals.css`; only farmer-pages edits `lib/i18n.tsx`, `lib/locales/zu.ts` and `components/ChatWidget.tsx`; only samples-map edits `components/MelDashboard.module.css`.
2. Integrator: fold the five PRs, then a wave 21 re-capture of the merged build.
3. Rory decides the items under *Unchanged*.
