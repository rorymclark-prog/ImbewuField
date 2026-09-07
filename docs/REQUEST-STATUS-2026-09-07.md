# Request register — 7 September 2026

This register preserves the requests visible in the current conversation and the open items
carried forward in `FEATURE-REGISTER.md`. A new message adds work; it does not cancel earlier
requests. Independent changes may proceed in parallel, followed by shared integration checks.

This is a **source-code audit**, against base `6f463346cfaa14631e8b069d3b2695bd465c0652` and
the `codex/design-map-tour-gates-studies` worktree. “In branch” means code is present, including
changes being integrated on 7 September; it does not mean deployed or browser-verified.
No full historical chat transcript was recovered. The older feature register retains its own
historical release claims; this document does not re-verify them.

| Status | Meaning |
| --- | --- |
| Existing | Present in the inspected base before this branch. |
| In branch | Added or changed in this development batch; release and visual checks are separate. |
| Partial | A foundation exists, but the whole requested workflow is not complete. |
| Recommended | Advice/design work is documented; the suggested feature is not implemented. |
| Open | Requested implementation or verification remains. |
| Needs source | Completion needs the owner's actual source material. |

## Reports, sites and funder evidence

| ID | Request | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| R01 | Make site reports visually rich with charts, graphics, photographs and maps. | Existing; improvements in branch | `ReportView`, `ReportVisualOverview`, `report-visuals` and `report-visual-pdf` provide a photo/plan cover, headline figures, area, rainfall, storage, sowing calendar and priced BOQ charts. Visual review caught a stretched 240 px map thumbnail; the screen now uses the original saved map, and full-colour PDF gains the same map fallback on its cover. The comprehensive opportunity table in the review document recommends further graphics by source availability. |
| R02 | Offer screen, expensive full-colour print and economical print. | Existing | `ReportView` has Screen / Print · full colour / Print · save ink. Screen and full-colour PDF share chart data/art. Eco selects photos off and omits the rich visual front; users retain the image checkbox. Existing 1-page and 5-page summaries remain. |
| R03 | Include crop illustrations and planting-plan graphics in the report. | Existing | `ReportView` shows saved crops with catalogue art, bed labels and sowing months; `report-visuals` chunks all saved crop rows into sowing calendars without truncation. Full-colour PDF includes plant artwork. |
| R04 | Add tree examples and graphics beside tree/vegetation advice. | Existing | `ReportChapterGraphics` and `report-chapter-visuals` show catalogue art for trees actually named in relevant report sections, plus a layered landscape illustration. Species absent from the catalogue have no matching art; no new species are invented. |
| R05 | Place useful graphics throughout long report chapters. | Existing; expanded set recommended | Vegetation layers, water collection/distribution and soil profile concepts appear beside matching chapters; calendar, rainfall, water and cost charts appear where relevant. These are concepts rather than measurements of the site. More site-specific diagrams require the sources in R07. |
| R06 | First make a comprehensive table auditing reusable report visuals. | In branch | `RECORDS-TOUR-REVIEW-2026-09-07.md` includes 23 opportunities, needed data and eco alternatives. `VISUAL-SITE-REPORT-AUDIT.md` retains the earlier audit. The table is a recommendation set, not a claim that all 23 are built. |
| R07 | Reuse visuals across reports: maps, photos, soil/water results, seasons, trees, production, finance and progress. | Partial | Shared chart and chapter components exist. Sun/shade diagrams, measured terrain/drainage, laboratory range charts, reconciled produce destinations, dated before/after comparison, milestone/action graphics and measured water budgets remain recommendations unless their data and a specific implementation are supplied. |
| R08 | Menu Reports should open saved sites/reports, with a map route for a new site. | Existing | `app/reports/page.tsx` has Saved sites and Saved reports tabs. Its new-site link opens `/farmer?reportSite=new&guided=1`; each saved site opens `/farmer?site=…&openReport=1`. Funder navigation preserves programme-report access rules. |
| R09 | Click a saved site to open its report workspace and generate a report. | Existing | Saved sites link to the report workspace; report generation is explicit. Existing saved reports reopen their retained snapshot without regenerating. |
| R10 | Save and reopen earlier report versions. | Existing real history; sample history in branch | `saved-reports` now supports saving, reopening, updating and deleting snapshots in the sample's existing disposable in-memory store. The real account's local history remains untouched. Re-entry/reload clears practice history; real history stays device-local. Focused tests exercise the actual isolation shim and change notifications. |
| R11 | Show what is missing for a more accurate report: photos, soil/water tests, survey, boundary, design and crop plan. | Existing; contrast improvement in branch | `ReportPreparation` / `report-readiness` provide seven actionable preparation areas. The checklist distinguishes presence from verification and tells users to regenerate after evidence changes. The cream evidence forms now use explicit dark text in dark mode too. |
| R12 | Upload and retain site photographs and soil/water lab originals. | Existing; device limits | `EvidenceSheet` stores photos; lab PDFs use scoped IndexedDB via `evidence-documents`, with sample files in memory. Results must be entered with units/source; merely attaching a PDF does not parse or verify it. Cross-device document availability is not promised. |
| R13 | Put a small crop-plan graphic on saved site/report cards. | In branch | `SiteCropPlanPreview` reads that site's saved canvas and planting rows. It shows a miniature, bed/plot counts and crop art, linking to the correct crop planner. Sites without a plan offer Start crop plan. It does not manufacture crops or write the design. |
| R14 | Funder Project progress & evidence must cover more than training. | Existing | `programme-progress` has seven domains: growing, water/energy, land/biodiversity, income/livelihoods, participation/households, learning/practice and delivery/support; 20 indicator templates plus custom indicators. `ProgrammeProgress` displays dated observations and targets. |
| R15 | Show funders available measured garden, yield, turnover and reach data. | Existing | Ten current-register metrics include garden counts, vegetable/staple area, total planted area, harvest, sold kg, sales, costs, reporting farmers and active farmers. Records retain coverage/date notes and consent restrictions. Different registers are not divided together to invent profitability. |
| R16 | Fill the funder demo with evidence across those domains. | In branch | The delivery cohort now has 17 indicators across all seven domains, including dated harvest, food use, water, trees, soil checks, sales, work, households, skills, visits and actions. Examples identify their six-garden scope and preserve tour edits; they are not added to the separate portfolio totals. |
| R17 | All 18 garden reports should contain useful photos/layouts and full content. | Existing | `sample-garden-reports` and the garden directory provide prepared reports using each garden's own reference photo, schematic layout and figures. They are separate from 18 editable Design Studio workspaces. |

## Phone layout, studies and navigation

| ID | Request | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| L01 | Remove the obstructive bottom sample banner. | Existing | The shared menu has a small Sample indicator and sample controls; older feature notes record removal of reserved bottom space. The current batch retains this. |
| L02 | Show Organisation, Funder, Farmer, Mentor and Student together in the sample chooser. | Existing | All five choices appear in `app/samples`; account permissions still determine which views can open. Compact chooser work is recorded separately in PR #421; this audit does not claim its live status. |
| L03 | Use one compact phone top bar; move secondary controls to the menu. | In branch | Shared mobile rules set a 52 px bar. Settings, contextual help and role controls remain available in `NavDrawer`; their full dialogs render outside clipped header containers. |
| L04 | Make Training / Field team / Trainees / Messages tabs one line. | In branch | `DashboardTabs.module.css` prevents wrap/shrink and keeps scrollable tabs and touch targets; mentor labels are shortened in `app/mentor/page.tsx`. |
| L05 | Replace the huge phone title panel with a simple heading and optional help. | In branch | `MelDashboard.module.css` removes the large mobile hero treatment; `FieldTeams` uses an optional About explanation. Desktop has more space. |
| L06 | Compress the sample notice and remove repeated sample wording. | Partial; in branch | The main Sample badge is retained. Records crop/expense names and several field-team/record notices no longer repeat “Sample”. Other report/programme explanatory notices remain; this is not an app-wide assertion that every repetition has been removed. |
| L07 | Show Groups, Farmers and Visits together instead of three tall phone cards. | In branch | `FieldTeams` and the shared mobile stats grid put the three figures together. |
| L08 | Apply compact layout consistently without reducing legibility or touchability. | In branch; device verification open | Shared header/dashboard rules and 44 px controls support this. Layout on a real phone, zoomed text, small tablets and long translated labels still needs observed verification. |
| L09 | Give learning a proper Studies identity and redesign the layout. | In branch | `app/student/page.tsx` / `Studies.module.css` add My Studies, Start/Continue, compact progress, module cards and expandable offline downloads. |
| L10 | Give every lesson an appropriate graphic. | In branch | Module cards and lesson entries reuse approved `infographicUrl` artwork; all 33 existing lessons have an illustration source. Lesson bodies, quizzes, answers and prerequisites are preserved. |
| L11 | Check every demo button opens useful content rather than a dead end. | Open verification; partial implementation | Invoice viewing, sample receipt viewing/reading, lender summary, lesson cards and tour features have implementations. The entire nine-stop tour and every secondary control have not been exhaustively browser-verified by this source audit. Known gaps are retained as individual rows. |
| L12 | Make the whole tour card open its stop; consider a compact graphic. | In branch | All nine cards have native button targets, topic icons and Open stop cues. A first-entry click prepares the isolated workspace before jumping to the chosen stop and its guide. Active tours retain their checklist. Mounted-page regressions cover every destination, activation failure and account restrictions. |

## Design Studio and tour

| ID | Request | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| D01 | Remove abandoned AI-map generation references from the ordinary export view. | In branch | Ordinary Design Map controls and quality descriptions no longer promote AI generation/cost. Legacy paid code/history remains gated; its existence is not advertised as a re-enabled feature. |
| D02 | Rename Exact Canvas appropriately. | In branch | Ordinary user-facing labels now use **Design Map** in `preview-export`, `DesignGlossy` and translations; stored legacy labels are normalised for display. |
| D03 | Load the owner's exact Ubhejane Creche design and drone image in the tour. | Needs source | The editable master export and original drone underlay were not available. The current tour retains the existing synthetic connected farm; flattened annotated images do not recreate the master. Need the exact editable export and source image before claiming this complete. |
| D04 | Keep the Ubhejane master entirely unchanged. | Preserved constraint | Sample storage isolation remains. Preview components only read saved data; map rendering does not write geometry. Do not replace or edit the owner's master while preparing a tour copy. |
| D05 | Let tour visitors toggle the real drone photo on/off. | Partial / needs source | Existing underlay controls support photo/plain/satellite choices. The requested original-photo demonstration depends on D03; no original drone image was imported. |
| D06 | Dim the screen and explain several features in popup modals at each tour stop. | In branch | `ProductTourProvider` opens an arrival dialogue with multiple tips, Next tip and Try it now; `sample-tour` defines guidance for the nine stops. |
| D07 | Make the gate easy to move. | In branch; desktop interaction checked | `DesignCanvas` adds a larger hit area and move handle; retaining pointer offset prevents the item jumping when dragged. Placing, selecting, changing length and dragging a gate by its move handle worked in the published preview. Touch-device verification remains. |
| D08 | A gate should have length adjustment only, not depth. | In branch | Design/Palette controls and canvas grips offer gate length only, including grouped gate editing. Its saved length remains the measurement used by the renderer. |
| D09 | Draw gates open on the finished map and leave an opening in the fence. | In branch | `boundary-geometry`, `cartographic-structure-symbols` and `DesignGlossy` project the gate onto boundary/fence lines, omit that span and draw an open leaf. This changes the rendered picture; `PLAN_VERSION` remains for the merge owner. |
| D10 | Use improved/new cards wherever helpful. | In branch | Studies, records, crop-plan preview and compact field-team surfaces have revised cards. This permission does not imply that every app page was redesigned. |

## Harvest, sales, invoices, receipts and demonstration data

| ID | Request | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| B01 | Guide every farmer sale through a digital invoice/receipt. | Partial; recommended flow not built | Invoices and direct Log sale are separate existing paths. Paid invoice kg lines already create linked sales through `invoiceSalesForPaidInvoice` / `syncInvoiceSales`. The direct sale form does not yet require or guide invoice creation. |
| B02 | Capture past sales and paper invoices without counting a sale twice. | Partial | Invoice issue/payment dates, references and stable invoice/line links exist. A dedicated “already sold / paper invoice exists” wizard, source-photo attachment and reconciliation of an existing manually entered sale are not built. Preserve original dates/number when designing that flow. |
| B03 | Account for sale quantities and money once across screens. | Existing; enriched demo in branch | `invoice-sales` provides paid kg lines, stable document IDs, deduplication and cash-income totals. Non-kg lines contribute money without invented kg conversions. This does not reconcile separate national/mentor/farm demo registers. |
| B04 | Picked should log production independently of sales. | Existing | Harvest records and Picked are separate from sales. A sale is not a second harvest. |
| B05 | Record unweighed production so it is not lost; handle bags/crates/counts and estimates. | Recommended | The documented proposal retains original units and measured/estimated status. A complete unknown-weight harvest workflow and measured container conversion are not implemented in this batch. |
| B06 | Use a camera to estimate a pile of potatoes when no scales exist. | Existing rough estimate; advice completed | `/vision` already exposes “Weigh my harvest” using `/api/lima-vision`, with estimated kg and a confidence label. Its accuracy on arbitrary piles is not validated. The review recommends photographs as evidence, not treating a photo estimate as measured weight. No accuracy percentage is claimed. |
| B07 | Recommend a scale in the project budget. | Recommended | The review recommends a shared, accessible scale with suitable capacity and tare, while permitting records without one. No purchasing action or product selection was requested or performed. |
| B08 | Account for sold, kept, donated, spoiled and remaining produce. | Recommended | The review describes separate production and destination events. A complete destination ledger/reconciliation is not built; an unmatched harvest must not be labelled household consumption. |
| B09 | Make the tour financially positive, even using invented figures. | In branch | `demo-farm` seeds profitable demonstration sales/harvests and corresponding invoices. This is the user's explicit exception for fictional tour data; real records and agronomic recommendations are unchanged. |
| B10 | Fill every planned crop row with yield, turnover and price examples. | In branch | `demo-farm` adds current-month harvest/sale coverage for all 12 planned crops. `FarmMetrics` shows crop art and the resulting metrics, rather than an almost-empty table. |
| B11 | Remove “Sample — swiss chard sale” and similar repeated prefixes. | In branch | Seeded crop, sales, expenses and farm labels drop those prefixes. The overall sample workspace indicator remains. |
| B12 | Add an invoice number and eye/View action to sales. | In branch | Record documents link to `/invoice?view=…`; the invoice page opens the matching saved invoice. This works for invoice-backed rows, not unrelated manual sales with no invoice. |
| B13 | Add an expense eye/View action and demo slips. | In branch for demo; real attachments open | `ReceiptPreview` draws each receipt from its matching demonstration expense. Real expenses do not gain a fictitious slip; persistent uploaded real receipt images remain unimplemented. |
| B14 | Enable the lender summary/export in the demo. | In branch | `CreditPackCard` and `credit-pack-pdf` provide summary preview and PDF. Both now include paid invoice cash through the shared ledger, remove mirrored sale duplicates and retain measured kilograms only. The source audit does not certify that this is an actual farm's lender evidence. |
| B15 | Lighten brown cards and make pale brown text readable. | In branch | `Records.module.css`, `AreaReturnCards`, `MyRecords`, `CashflowChart` and `FinanceGraphs` use explicit light-on-dark or dark-on-cream pairs, stronger headings and less subdued labels. Visual contrast still requires checking the rendered surfaces. |
| B16 | Strengthen Crop performance and similar headings. | In branch | Records chart/section headings use a clearer size, weight and dark green ink on cream panels. |
| B17 | Lima should read photographed receipts and fill expenses. | Existing reader; demo addition in branch | The real `/api/read-slip` extracts total, description and supplier for user review before saving. The sample has a prepared receipt that fills the form without a model call. Capturing many slips as a batch is not implemented. |
| B18 | Retain every photographed slip and view it later beside the expense. | Open | Existing scanning reads a temporary file into an AI request, then stores extracted fields. The original photo is not attached to the saved real expense. Needs scoped blob storage, attachment metadata, viewing and sync work. |
| B19 | Estimate AI receipt compute cost and decide whether it is affordable. | Advice completed; usage logging in branch | Review documents explicit token assumptions, Sonnet/Haiku cost examples and sources; `/api/read-slip` now logs provider usage. These are planning estimates rather than a measured project bill. |
| B20 | Organisation master settings should toggle paid features and support higher-priced tiers. | Recommended / not built | Existing API authentication and request rate limits are not organisation feature entitlements. Receipt-reading, report-generation and optional future-map allowances, billing tiers and hard spending caps are proposed; no complete settings/billing workflow was added. |
| B21 | Keep normal generated maps cheap; consider AI maps as an optional premium feature. | Existing local maps; premium model recommended | Ordinary Design Maps use local drawing. Restoring paid AI image generation as an organisation-configurable product is a separate proposal, not part of the label cleanup. |

## Offline capability and carried-forward work

| ID | Request | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| O01 | Explain how a web app can work offline. | Advice completed | Review explains downloaded app/media plus local records and later sync. A web app can use a service worker/cache and IndexedDB; cloud AI and uncached online services still need a connection. |
| O02 | Make harvest, sales, invoices and receipts reliably usable offline. | Partial | `app/sw.js/route.ts` caches selected app routes/media and Firestore uses `persistentLocalCache`; invoices use device-local storage. `/records` and `/invoice` are not initial precache routes. Source receipt-photo persistence, a complete download-first workspace and consistent sync status are not built. |
| O03 | Test offline on iPhone, Android and iPad, including restart and reconnection. | Open verification | Need first-load vs downloaded use, airplane-mode reload/restart, queued writes/photos, account changes, duplicate/conflict handling and confirmed replay. This audit does not claim these tests were performed. |
| O04 | Update the concept note with verified offline capabilities. | Open | The older feature register explicitly retains this requirement. Review documents current limits; it does not replace a device-tested concept-note update. |
| C01 | Carry over the previous chat and ensure every request stays accounted for. | Partial | Current visible requests and known earlier open work are registered here. The complete previous transcript was not recovered, so this cannot certify requests absent from both current context and existing registers. |
| C02 | Give all 18 gardens fully editable connected workspaces. | Open | Their photo/layout/report directory exists, but the separate connected farm pack does not make every garden editable. |
| C03 | Unify the national, mentor and connected-farm demo data. | Open | Registers are still separate examples. This branch fills the connected farm's records; it does not reconcile all portfolio totals. |
| C04 | Expand mentor course/facilitation/mentorship resources with organisation publication and group assignment. | Open | Basic learning/mentor foundations exist. The three-resource structure, controlled publication and private answer guides remain in the earlier register. |
| C05 | Expand mentor visit records with location/photos/support/issues/actions/follow-up and authorised summaries. | Partial / open | Seven dated visits now populate the tour, including five for the main mentor's assigned group. Basic assigned groups and visit notes exist; the full structured location/photo/support/action/follow-up workflow remains open. |
| C06 | Add dated retail replacement values, results framework, data-quality review and learning decisions. | Recommended / partial foundations | Existing indicators, assessments and BOQ support part of this. See `MEL-FEATURE-AUDIT.md`; no unsupported portfolio valuation or completed formal MEL suite is claimed. |
| C07 | Link funding gaps, BOQ revisions, procurement and verified delivered assets. | Recommended | `FUNDING-AND-DELIVERY.md` is a design, not a completed linked asset/funding system. |
| C08 | Improve privacy/consent signing and guardian flows. | Open | Existing permissions remain; new versioned signing, downloadable receipts and guardian workflows from the carried-forward register are not completed here. Required specialist review belongs to that work. |
| C09 | Advanced panel/modal side resizing. | Open; target unclear | Earlier register records a request without an identified modal target. Gate length controls do not fulfil general panel resizing. |
| C10 | Complete and deploy authorised work without dropping requests when new messages arrive. | Active integration | Independent changes share this register. Parent work owns integration gates, observed browser checks and publication; this source audit makes no deployment or universal-button-verification claim. |

## Release evidence must be added separately

Record the published commit, preview URL, CI results and the exact screens/interactions actually
checked when that work completes. A green test suite does not prove that a report, phone layout,
open gate or crop-plan thumbnail looks right. Keep genuine gaps above open until their own
completion evidence is available.

Integration checks on 7 September: typecheck passed, 3,440 tests passed, no failures and one
pre-existing TODO; whitespace check passed. The combined preview is reviewed in PR #425.
Desktop checks observed the illustrated studies/lesson view, gate move and Design Map preview,
all 12 planned crop-performance rows, invoice viewing, matching expense slips and receipt-to-expense
draft. The saved-site crop graphic opens that site's planner. Report save, reopen and delete work
in the isolated tour. The lender PDF was downloaded: R15,241 income, R8,175 costs and R7,066
net cash flow agree with the dashboard. Funder category filtering and the dated timeline work;
15 August shows 10,000 litres of installed storage and 6,200 litres collected, rather than the
later 20,000 / 14,500 readings. A full-colour site report PDF was downloaded and inspected.
The updated report cover displays the original 3,783 px saved map rather than the 240 px gallery
thumbnail, and the colour PDF includes that map. Whole-site plans are preferred for the cover
when available. Soil-test modal text is visibly dark on cream. The mentor view shows 1 group,
15 farmers and 5 visits, with the dated visit log populated.
The browser environment did not expose viewport resizing or phone emulation; phone layout rules
are implemented but not represented here as device-tested.
