# App-wide audit (second round) — 2026-10-10

- Auditor: Claude (integrator), with five read-only reviewers (bugs, security and AI cost, accessibility and theme, language, performance)
- Reviewed revision: `swarm/w10-audit-leftovers` at c78db07c (main 142a5988 plus wave 10, PR #990)
- Deployment inspected: none; source review only
- Previous audit: [App-wide close-out — 10 October 2026](app-wide-closeout-claude.md). Its 92 findings are not repeated here.
- Scope: whole app except the crop/production planner and the site survey, which have their own records
- Evidence type: source reads and grep; one reviewer ran the contour-threshold loop in node. Integrator re-checked 20 findings against the code (marked below).

## What was already done

The first app-wide audit is closed (90 implemented, 1 verified, 1 owner decision). This round starts fresh, with new ID prefixes: `sec`, `bug`, `perf`, `a11y`, `lang`.

## Findings and disposition

63 findings: 12 high, 28 medium, 23 low. All open.

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| sec-01 | [high] A tiny `interval` on the contour route makes the server loop until it runs out of memory; no sign-in needed. | open | app/api/contours/route.ts:98,191. Fix: Clamp interval (0.5–100 m) and stop the loop at MAX_THRESHOLDS. Re-checked by integrator. |
| sec-02 | [high] Any staff account, from any organisation, can edit or delete any garden and its member list. | open | firestore.rules:187,205. Fix: Swap `isStaff()` for a same-org mentor check; add a cross-org deny test. Re-checked by integrator. |
| sec-03 | [medium] One oversized guest chat or design request (huge messages, context arrays, image) overshoots the R1 guest allowance and server memory. | open | app/api/chat/route.ts:169-178; app/api/design/route.ts. Fix: Cap per-message length, array lengths and decoded image size. |
| sec-04 | [medium] Slip reader and visit-notes tidy-up call AI with no R18/R1 allowance check; read-slip is open to the guest lane. | open | lib/low-cost-ai.ts:4-25; app/api/read-slip/route.ts:27; app/api/visit-notes/route.ts:13. Fix: Route lowCostText through the metered AI path; cap image and notes size. Re-checked by integrator. |
| sec-05 | [medium] A farmer can fake their name, org, id or location on mentor/NGO/funder dashboards by editing their own profile `network` map. | open | app/api/network/farmers/route.ts:137. Fix: Spread `network` first or whitelist display keys. Re-checked by integrator. |
| sec-06 | [medium] A farmer can create production/sales/expense rows stamped with another organisation's `org_id`, polluting that org's mentor views. | open | firestore.rules:213-260. Fix: Pin `org_id` to the writer's org on create. |
| sec-07 | [low] Any signed-in user can open a message thread with any uid, with a sender name they choose. | open | firestore.rules:585-588. Fix: Require shared org or accepted connection; validate names. |
| sec-08 | [low] Malformed bodies crash five AI routes with a 500 instead of a clear 400. | open | app/api/{tree-id,life-guide,area-profile,design-review,read-slip}/route.ts. Fix: Shared parse-and-validate helper. |
| sec-09 | [low] `in`/bare-index allow-lists accept `__proto__`/`constructor`. | open | app/api/image-producer/route.ts:198,231; app/api/ai-render/route.ts:831; app/api/chat/route.ts:169. Fix: Use Object.hasOwn or Set/Map allow-lists. |
| sec-10 | [low] Raw upstream provider errors (status, vendor names, body text) are shown to farmers. | open | app/api/chat/route.ts:240; app/api/design-detect/route.ts:116; app/api/ai-render/poll/route.ts. Fix: Log server-side; return a short translated message. |
| sec-11 | [low] Unlimited, unsized shared-site documents can be created under any id. | open | firestore.rules:544-560. Fix: Cap sizes; require code == docId and creator uid. |
| bug-13 | [low] Sign-in `from=//example.com` sends the user to an outside site after login. | open | app/login/page.tsx:103. Fix: Reject paths starting with `//` or a backslash. Re-checked by integrator. |
| bug-01 | [high] Deleting a sale or expense offline fails silently and the row reappears. | open | app/records/page.tsx:1511-1517. Fix: Catch and show the thrown message. Re-checked by integrator. |
| bug-02 | [high] One failed read replaces the farmer's sales/expenses list with an empty one (looks like lost data). | open | app/records/page.tsx:1480-1482. Fix: Keep the previous list and show a retry notice. Re-checked by integrator. |
| bug-03 | [high] Journal entry sheet closes and the typed note is lost when storage is full. | open | components/journal/FieldJournal.tsx:156-168. Fix: Keep the sheet open with the draft on failure. |
| bug-04 | [medium] Contact form, inbox replies and community messages hang forever offline; message text is cleared before sending. | open | app/contact/page.tsx:141; components/ContactInbox.tsx; lib/db/community-queries.ts:88-165; app/community/messages/[threadId]/page.tsx. Fix: Use the existing withWriteTimeout; restore draft on failure. |
| bug-05 | [medium] Lima Vision sends the full camera photo; 12MP photos exceed the upload limit (413) and retry never helps. | open | app/vision/page.tsx:125-165. Fix: Downscale to ~1600px with the existing resize helper; plain 413 message. |
| bug-06 | [medium] If consent settings fail to load, every data-sharing toggle shows OFF and can be flipped wrongly. | open | components/ConsentPanel.tsx:34-52. Fix: Load-error state with retry instead of toggles. |
| bug-07 | [medium] Account profile save hangs on 'Saving…' offline; avatar/logo failures give no feedback. | open | app/account/page.tsx:98-147. Fix: try/catch/finally with inline error. |
| bug-08 | [medium] On stalled connections page navigation waits with no timeout instead of serving the cached page. | open | app/sw.js/route.ts:2401-2425. Fix: Race network against a ~4–5s timeout. |
| bug-09 | [medium] Sign-up reports an error if the profile write fails after the account is created; retry hits 'email in use'. | open | lib/auth.tsx:230-250. Fix: Treat profile write as non-fatal and retry on first load. |
| bug-10 | [low] Farmer site lookup failure shows a bare status code ('500') in the header pill. Same as lang-08. | open | app/farmer/page.tsx:300-312,623. Fix: Translated message with retry (fix with lang-08). |
| bug-11 | [low] 'Today' is computed in UTC; between 00:00 and 02:00 SAST forms default to yesterday and block today. | open | lib/field-teams.ts:171; components/FieldTeams.tsx; components/ProductionAreas.tsx; components/ProgrammeEvidence.tsx. Fix: One local-date helper. |
| bug-12 | [low] Journal Delete removes the entry in one tap, no confirm, and storage is local only. | open | components/journal/JournalEntrySheet.tsx:317-328. Fix: Two-tap confirm like SalesLedger. |
| bug-14 | [low] If the message listener errors, the thread silently stays empty. | open | lib/db/community-queries.ts:140-144. Fix: Error callback with retry state. |
| perf-01 | [high] Every page downloads ~2 MB of chat and farm-data catalogue code before it is usable, even if chat is never opened. | open | app/layout.tsx; components/ChatWidget.tsx:7; components/FieldSyncRunner.tsx; lib/auth.tsx → lib/course-modules.ts. Fix: next/dynamic ChatPanel on first open; lazy sample-mode and course-gating imports. Re-checked by integrator. |
| perf-02 | [medium] The 299 KB release-notes file still reaches the layout bundle through one value import. | open | lib/update-tour.ts:1. Fix: Move MAX_TOUR_STOPS and the type out of release-notes.ts. Re-checked by integrator. |
| perf-03 | [high] English and isiZulu lesson slides are ~1 MB JPEGs (~20 MB per module); other languages already use ~300 KB WebP. | open | lib/course-deck.ts:62,261-346; public/course-decks/*/{en,zu}/*.jpg. Fix: Re-encode to WebP and register the format (large binary change). Re-checked by integrator. |
| perf-04 | [medium] Studies home parses ~590 KB of transcripts and the deck player before any lesson is opened. | open | app/student/page.tsx:22,24; components/course/DeckPlayer.tsx:21-22. Fix: next/dynamic DeckPlayer. |
| perf-05 | [medium] Studies cards download ~850 KB photos to fill 150×100 thumbnails. | open | app/student/page.tsx:1415,1429; public/studies-guides/*.jpg. Fix: Small WebP thumbnails. |
| perf-06 | [medium] Community page ships mapbox in its first load though only one tab uses it. | open | app/community/page.tsx:22. Fix: next/dynamic NearbyMap. Re-checked by integrator. |
| perf-07 | [medium] Farmer page includes the chart library for one rainfall chart deep in a tab. | open | components/DataPanel.tsx:8,1239. Fix: next/dynamic RainfallChart. |
| perf-08 | [medium] While open, the app re-downloads the 130 KB service worker every minute (data and battery). | open | components/PWAUpdateNotifier.tsx:23; app/sw.js/route.ts. Fix: Poll every 10–15 min; retire old one-off migrations. Re-checked by integrator. |
| perf-09 | [medium] Home downloads an 870 KB animation runtime for an 80px decorative sprout that has an SVG fallback. | open | components/home/ProgressSprout.tsx:69; public/rive/rive.wasm. Fix: Gate on slow connection / low memory, or use the SVG. |
| perf-10 | [low] Four files nothing imports: HybridRender, RolePlaceholder, ui/almanac, design-studio-shell-icons. | open | components/; lib/design-studio-shell-icons.ts. Fix: Delete after re-checking importers. |
| perf-11 | [low] Five lib/ modules used only by tests or scripts. | open | lib/report-doc.ts; lib/narration-review.ts; lib/course-image-briefs.ts; lib/course-calendar.ts; lib/course-translation-draft-overrides.ts. Fix: Move to scripts/lib or confirm wanted. |
| a11y-01 | [high] In dark mode, typed text is pale on a white box: Account form, every map name field, Ask Lima input. | open | app/account/page.tsx:246+; components/Map.tsx:4048-4314; components/ChatPanel.tsx:328. Fix: Themed input background token. Re-checked by integrator. |
| a11y-02 | [high] White labels on WhatsApp green (~2:1) and old ochre (~3.5:1): invoice Share/Print, exchange Share. | open | app/invoice/page.tsx:746,754,1239,1244; components/exchange/ShareListingButton.tsx:58. Fix: #9A6018 for ochre fill, forest fill with --on-forest. Re-checked by integrator. |
| a11y-03 | [high] Lima chat sheet is a fixed cream panel in dark mode, isn't a dialog (no Escape, no focus), close button 32px. | open | components/ChatWidget.tsx:195-247; components/ChatPanel.tsx:239. Fix: Dialog semantics, Escape, focus, 44px close, themed glass. |
| a11y-04 | [medium] NGO role is half dark in dark mode: tab text and header title dark-on-dark; dashboard sidebar stays light. | open | app/ngo/page.tsx:106-170; components/NgoDashboard.tsx. Fix: Theme tokens. |
| a11y-05 | [medium] Hardcoded dark text hexes on themed pages (community profile, messages, offline download, DataPanel, ContactInbox). | open | app/community/u/[uid]/page.tsx; app/community/messages/[threadId]/page.tsx; components/course/OfflineDownload.tsx; components/DataPanel.tsx; components/ContactInbox.tsx. Fix: Map to --danger/--color-forest-800/--text-*. |
| a11y-06 | [medium] Money-entry and contact fields' captions are not tied to inputs; screen reader hears '0.00'. | open | app/records/page.tsx:864-910; app/contact/page.tsx:425-460; app/community/profile/page.tsx; app/community/messages/[threadId]/page.tsx:237. Fix: id/htmlFor pairs or aria-label. |
| a11y-07 | [medium] Home 'Last site' stats squeeze into 4 columns at 360px; isiZulu labels overflow. | open | app/home/page.tsx:98. Fix: grid-cols-2 sm:grid-cols-4. Re-checked by integrator. |
| a11y-08 | [medium] Key buttons under 44px: invoice Share/Print, report actions, map Finish/Cancel (32px), settings toggles, profile close. | open | app/invoice/page.tsx; components/ReportView.tsx; components/Map.tsx:3277,3325; components/ThemePanel.tsx; components/ProfileSheet.tsx:288. Fix: minHeight 44 or coarse-pointer floor. |
| a11y-09 | [low] Invoice header scrolls sideways at 360px; Share/Print off-screen (duplicated at the bottom). | open | app/invoice/page.tsx:726-770. Fix: Icon-only buttons under sm. |
| a11y-10 | [low] Shared cream header stays light in dark mode on seven pages; wordmark invisible on sm+. | open | lib/app-header.ts:46; components/BrandLogo.tsx. Fix: Tokenise APP_HEADER_STYLE. Re-checked by integrator. |
| a11y-11 | [low] Cards hardcode #fff/#FFFEFA backgrounds and show as bright blocks in dark mode. | open | components/EvidenceCatalogue.tsx:74; components/EvidenceSheet.tsx; components/exchange/ExchangeBoard.tsx:250; components/course/OfflineDownload.tsx. Fix: var(--bg-1)/var(--border). |
| a11y-12 | [low] Captions at 9.5–10px, below the 11px floor, fixed on desktop. | open | components/DataPanel.tsx:797-845; components/network/FarmerPanel.tsx; components/atlas/AtlasPanel.tsx; app/contact/page.tsx:426. Fix: 11–12px with clamp(). |
| a11y-13 | [low] Reduced-motion handling is partial; no global safety net. | open | app/globals.css:839-844. Fix: Global prefers-reduced-motion rule. |
| lang-01 | [high] Ask tab (Simple mode) is entirely English, and shows a developer 'Load Ubhejane farm data' button that writes demo records to the farmer's device. | open | components/ChatPanel.tsx:32-37,185,259-326. Fix: t() keys with Zu drafts; error as a state flag; hide the test button outside sample mode. Re-checked by integrator. |
| lang-02 | [high] Photos tab (Simple mode) is English, says 'click', names 'Claude Vision', shows raw server errors. | open | components/PhotoUpload.tsx. Fix: t() keys; 'Lima'; 'tap'. Re-checked by integrator. |
| lang-03 | [medium] Biome names, key species, challenges and the water/soil strategy text are English-only and full of jargon. | open | lib/biome.ts:5-131; components/DataPanel.tsx:792-825,1191-1295. Fix: Translated, plain-word biome keys. |
| lang-04 | [medium] Evidence cards use emoji icons; the evidence sheet (storage-full and land-papers warnings) is English-only. | open | lib/evidence-catalogue.ts:159-167; components/EvidenceSheet.tsx; components/EvidenceCatalogue.tsx. Fix: Lucide map; t() for the sheet. |
| lang-05 | [medium] Map move-pin banner, several placeholders and the printed base-map window are English-only. | open | components/Map.tsx:2321,4257-4312,1782-1788. Fix: Keys and Zu drafts. |
| lang-06 | [medium] Profile sheet is English-only, including the location-sharing switch. | open | components/ProfileSheet.tsx. Fix: Translate; location switch first. Re-checked by integrator. |
| lang-07 | [medium] Crash page shows the raw JavaScript error; error and not-found pages are English-only. | open | app/error.tsx; app/not-found.tsx; app/global-error.tsx. Fix: Fixed bilingual message; read language from localStorage. |
| lang-08 | [medium] Network failures show '500', '429', 'Failed to fetch', 'API error 500', 'HTTP 429'. | open | app/farmer/page.tsx:300-623; components/AreaPanel.tsx; components/atlas/AtlasExplorer.tsx; components/SiteDesign.tsx. Fix: Translated message with offline variant. |
| lang-09 | [low] Jargon: kL, ASL, ETo, Köppen, Bulk Density, CEC, 'AI' tab; hardcoded 'mm/yr', '°C avg'. | open | components/DataPanel.tsx:1004; components/WaterBalance.tsx; app/home/page.tsx:78-81. Fix: Litres/tanks, translated units, plain labels. |
| lang-10 | [low] Chart axes use a real monospace font, bypassing the Public Sans alias. | open | components/RainfallChart.tsx; components/WaterBalance.tsx; components/CashflowChart.tsx; components/FinanceGraphs.tsx. Fix: var(--font-sans). |
| lang-11 | [low] Emoji used as UI icons in design and records screens. | open | app/design/page.tsx:3175,3919; components/design/DesignGlossy.tsx. Fix: Lucide icons. |
| lang-12 | [low] Old role words on screen: 'supervisor' on NGO dashboard; 'facilitator' in partners and student copy. | open | components/NgoDashboard.tsx:468,724; app/partners/page.tsx:276; app/student/page.tsx:1445. Fix: 'mentor'; owner to decide on 'facilitator'. Re-checked by integrator. |
| lang-13 | [low] The farmer's own site form has six names, and a different feature is also called 'Surveys'. | open | lib/i18n.tsx:456-1579. Fix: One name: 'Site survey'; rename assigned surveys. |
| lang-14 | [low] Design and Places tabs are English-only; Design names 'Claude' and says 'click'. | open | components/SiteDesign.tsx; components/SavedPlaces.tsx. Fix: Translate; 'Lima'; 'tap'. |

## Verification

- Typecheck: not applicable (no code changed)
- Full test suite: not run for this record
- Output inspected: not inspected in a browser
- Other limits: severities are the reviewers' calls; findings not marked "re-checked" rest on the reviewer's evidence. perf-01/02 bundle sizes come from source import graphs and a stale local build.

## Next continuation

1. Wave 11 tracks (proposed): security and rules holes; AI cost guards; offline-safe saving; lighter first load; dark mode and tap targets; Ask/Photos/Profile in isiZulu.
2. Owner decisions: perf-03 (re-encode ~130 MB of slides; large binary diff), lang-12 ('facilitator' as a course term), lang-01 (remove or hide the test-data button).
3. Firestore rules fixes (sec-02/06/07/11) need the emulator rules tests updated in the same PR.
