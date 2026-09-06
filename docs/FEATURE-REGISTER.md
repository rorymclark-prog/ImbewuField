# ImbewuField feature register

Living register: update this file with each feature change. Do not mark a feature
live solely because its code exists: record tests and deployment confirmation.
This register describes product capability, not verified project outcomes.

## Requests carried into this chat — 6 September 2026

The previous chat's complete transcript could not be retrieved. This checklist
carries forward the available conversation context, this living register, the
MEL/funding specifications and current source. It is not a claim that every past
message was recovered. A feature being present does not prove every interaction
has been checked on a phone or against live organisation data.

Current baseline: main `a120d9326aa87cb26d45928033b04c802cf10af6`.
Production and test workflows passed on 6 September (deployment run 34022028378).
All five sample cards and the menu badge were visually checked on the live desktop
page. PR #419 also deployed the 18 prepared garden reports. The compact chooser
layout in this follow-up is tracked separately below.

| Request | Current state | Evidence / what remains |
| --- | --- | --- |
| All sample views on the chooser: organisation, funder, farmer, mentor, student | Live; compact layout in this branch | All five cards stay visible; the real account role controls availability. Anonymous visitors, organisations and administrators can explore all five. |
| Replace bottom sample banner because it covers controls | Live; visually checked on desktop | A 44px menu button carries Sample; the drawer has choices, reports, tour and Exit. A top-corner fallback covers pages without a menu. This branch removes remaining strip spacing. |
| At least 15 varied homestead, commercial, crèche, school and other gardens | Present in deployed source | 18 entries in `lib/sample-gardens.ts`, with individual selection and type filters |
| Mainly African sample participants and Sesotho-speaking groups in relevant examples | Present in deployed source | Regional example profiles and four Sesotho-labelled Botshabelo gardens; portraits are illustrative |
| Unique reference photo for each garden, reused consistently | Present in deployed source | 18 photo mappings in `lib/sample-media.ts`, reused by gallery, garden view and report |
| Tap profile and site photos to enlarge | Present; interactive check still needed | Global `PhotoViewer` opens marked photos and supports keyboard, Close/Escape and enlarge/fit |
| Change gardens and see a different layout/photo/person | Present; interactive check still needed | `/samples/gardens` and `SampleGardenVisual`; not a separate editable Design Studio for each garden |
| Production areas follow the multiple sample gardens | Present in deployed source | `completeSampleAreas` seeds the 18 directory allocations, separates vegetables/staples and retains practice edits |
| Group funded gardens by area | Present in deployed source | Town/area filters in the directory; no invented village boundaries |
| One complete editable sample farm with map pin, design, assessment, household, soil, photos and report | Present for Ubhejane; partial against the wider request | `sample-farm-session`, `sample-farm-pack`, `/samples/farm`; household/soil examples are not validated live instruments |
| Fully editable connected farms for every sample garden | Pending | The 18 directory gardens have overviews/reports; only Ubhejane has the connected farm workspace |
| All demo totals represent one consistent programme | Pending | National garden, mentor, cohort and farm fixtures remain separate; do not add their totals together |
| Completed reports for all 18 directory gardens | Deployed; workflow verified | Four-page PDFs and matching in-app text, using each garden's photo/layout/areas; not newly generated AI advice |
| Ready-to-read sample reports and Generate new report beside report controls | Present in deployed source | `ReportView`, `ProgrammeReports` and sample garden report actions; sample refresh uses practice records |
| Archived reports/version history across every role and garden | Partial / pending | Prepared directory PDFs exist; automatic history and all other role archives remain outstanding |
| Usable 15-minute onboarding tour, replayable from Settings | Present; full tour still needs interaction check | Seven stops in `sample-tour`, onboarding offer, menu and Settings links |
| Organisation/funder feature requests and bug reports | Present; delivery not reverified | `/feedback` and authenticated product-feedback API; no test message sent during this audit |
| Separate organisation and funder views, cleaner funder navigation | Present | Role routes and `role-navigation`; demo selection does not modify real account roles |
| NGO controls member powers and can inspect access | Partial | Scoped member/assessment controls and effective-access preview; not universal feature switches or live impersonation |
| Developer/admin access | Existing provisioned role | No separate magic login; trusted admin provisioning is required |
| Baseline, course before/after, midpoint including support, closeout, app midpoint/end | Present in deployed source | Seven assessment stages and NGO analysis/publication in `mel-templates` and `MelDashboard`; translations need facilitator review |
| NGO/funder targets, evidence and progress remaining | Partial | Programme milestones, dated observations, training evidence and published summaries exist; complete results/indicator framework is still proposed |
| R/m² cards for vegetable beds, staples and combined; productive hectares | Present with limits | Actual recorded sales less assigned costs / mapped area; separate NGO area register; no invented full-profit or portfolio ratio |
| Training venue location and photos | Present; device check needed | One-tap venue location, camera/multi-select and two-photo limit; offline/photo sync remains unverified |
| Mentor course, facilitation and mentorship resource area; organisation publication | Pending | Approved materials and controlled publication/assignment still needed |
| Expanded mentor visits with location, photos, support, issues, actions and next visit | Partial | Basic visit records exist; expanded evidence and follow-up workflow remains outstanding |
| Report screen/print modes, short/full choices, crop plan, BOQ and isiZulu | Present with limits | Site-report audit and exporters; full new AI output and complete language coverage are not verified |
| Smaller crop graphic on phone timeline | Present; phone check needed | Compact icon sizing and horizontal title truncation in the previous release |
| Plain-paper map default and standard illustrated palette | Present | Previous release; saved geometry and PLAN_VERSION unchanged |
| Resize panels/modals from their sides | Target still unclear | Existing design panel sizing is separate; identify which additional modal/page was intended |
| Lock experimental AI rendering for ordinary users | Present in deployed source | Existing approval/kill-switch checks; no paid generation run here |
| Example Lima conversations for each role and illustrated farmer pest query | Present as scripted demos | `sample-lima`; not evidence of a live AI response |
| Invoices, money book and responsive desktop/phone/tablet layouts | Present; end-to-end audit incomplete | Existing invoice/share/print and records workflows; check real device exports separately |
| Preserve real Ubhejane identity and original map | Required and retained | Real reference design; latest actual photos/lab/household records await owner material; seeded records remain labelled examples |
| Funding needs, BOQ-linked allocations, gaps, delivered tanks/solar/trees and funding opportunities | Specification only | `FUNDING-AND-DELIVERY.md`; full linked workflow is not built |
| Retail replacement value and complete MEL learning/data-quality framework | Proposed | `MEL-FEATURE-AUDIT.md`; no unsupported financial or impact figures added |
| Versioned privacy permissions, signing, receipts and guardian flow | Pending | Review/approval and implementation gates remain; no live signing enabled |
| Offline audit on iPhone, Android and iPad; sync/camera/GPS/maps/lessons | Pending | Test matrix below remains open; no universal offline promise |
| Update concept note after feature/offline audit; one-page, three-page and full versions | Pending in this implementation thread | Feature source maintained; refreshed documents and user screenshots still require the separate concept-note work |
| Keep one continuing feature source with implementation/deployment limits | Updated by this change | Replace the same published FEATURE-REGISTER.md identity; retain its MEL and funding appendices |

## Available in production before this batch

| Area | Capability | Limits / follow-up |
| --- | --- | --- |
| Design Studio | Saved farm designs, layers and exports | Protected workspace; changes stay on branches; never alter saved geometry during rendering |
| Crop planning | Vegetable-bed and staple-plot planning | Further content / timeline audit remains separate |
| Records | Harvest, sales, costs, invoices and per-area returns | Recorded returns are not projected profit; costs must be assigned |
| Organisation | Garden directory, assessments, programme evidence and member access controls | Full app-wide feature controls and live role impersonation are not claimed complete |
| Funder | Authorised portfolio and published programme summaries | Private attendance / staff notes are not funder data |
| Mentor | Assigned groups, guidance, visits and trainee records | Basic visit form; expanded visit evidence still pending |
| Reports | Programme, training and mentor report exports; partner branding | Do not claim fixed page counts or complete isiZulu coverage |
| Samples | Role chooser, disposable fictional data, 15 portraits, partner logos, varied gardens | Separate demo registers are not one verified dataset |
| Training evidence | Venue name, date, attendance, notes, photos and assessment reference | Online saving; offline reliability not yet audited |

## Farm demo and tour — deployed 5 September 2026 (a83605e)

- Three sample mentors, each with 15 uniquely assigned fictional gardens (45 total).
  Five garden types per group; illustrative areas including one-acre commercial sites.
  The mentor trainee list uses the same assigned member directory.
- One-tap training venue location; no latitude / longitude entry fields.
  Permission denial and timeouts preserve the draft. Location is requested only
  after a tap. Samples use an explicitly labelled example point, not real GPS.
- Camera capture and multi-photo selection for training venues, retaining the
  current two-photo limit. Saving the session persists the attachments.
- Connected sample farm evidence pack (`/samples/farm`), linked to the existing
  editable design, saved map pin, crop plan and records. Completed fictional site
  assessment seeded once, preserving edits. Editable household interview, soil
  example and visit notes; branded PDF with illustrative generated photos.
  Visitors may attach two practice photos, stored only within the sample session.
  This is an evidence-pack report, not a replacement for the agronomic site report.
- Seven-stop, 15-minute sample checklist (`/tour`), offered during language
  onboarding and replayable from Settings, the menu and sample banner.
- Role-appropriate sample chooser; funder users can explore the farm sandbox
  without receiving live farmer or organisation permissions.
- Bug / feature submission (`/feedback`) for all signed-in roles, explicit
  real-send acknowledgement even in sample mode, downloadable text copy for
  signed-out visitors, private platform-admin inbox. Server-authenticated,
  bounded payloads and idempotent retry. No automatic screenshot or farm upload.

## Garden directory and photo viewer — deployed 5 September 2026 (8b1f9d4)

- Organisation/funder garden directory: 18 distinct fictional gardens, including
  homestead, commercial, crèche, school, community and food-forest settings.
- Regional fictional participant groups; four Sesotho-speaking sample gardens
  around Botshabelo. Language labels describe the sample group, not an entire town.
  Reuses existing generated adult portraits; regional cast is Black African.
- Tap profile, site, training-venue or sample produce photos to open a large viewer;
  keyboard Enter/Space, Close/Escape, enlarge/fit and return to the original photo.
  Native modal dialog displays above the sample banner. Diagrams and crop icons
  retain their existing actions. Browser visual verification is still outstanding.

## Agreed work still to complete

- Broader demo unification: the farm pack, national garden directory and mentor
  portfolio remain separate illustrative datasets. Do not present their totals
  as one reconciled project. Soil / household examples in the farm pack do not
  constitute lab ingestion or a completed validated MEL household instrument.
- Mentor resource area: farmer course, facilitation toolkit and mentorship
  toolkit. Reuse approved material; do not invent or rewrite lesson bodies.
  Lesson previews must not complete a farmer's learning progress.
- Organisation-controlled resource publication / group assignment, with private
  answer guides separate from farmer-facing material.
- Expanded mentor visits: place name, one-tap location, photos, support provided,
  issues, agreed actions and next visit. Approved summaries for funders, private
  visit details for authorised staff only.
- Site-report visual/content audit, print/screen modes, language coverage, crop
  plan and BOQ representation.
- Privacy & consent: versioned privacy notice, separate optional permissions,
  appropriate electronic signing and downloadable receipts, restricted staff
  records and guardian flow. Legal / Information Officer approval required before
  live signing. No universal blanket consent or automatic consent on behalf of users.

## Offline audit and concept-note requirement

**Status: to investigate and test — not a promise that the whole app works offline.**

Test on iPhone, Android and iPad, including loss of connection and app restart:

1. First use without internet versus a previously loaded app.
2. Previously downloaded lessons, pictures and audio.
3. Saved designs, crop plans and map tiles; clearly distinguish cached imagery
   from live satellite/map services.
4. Draft harvest, money, attendance, mentor visit and survey records.
5. Camera photos and GPS without data service, including browser permission and
   poor accuracy behaviour.
6. Reconnection: queued writes, duplicate prevention, conflicts, failures,
   account changes and confirmation that photos and records actually synced.
7. Features requiring connectivity: sign-in, cloud sharing, fresh remote data
   and AI services, subject to testing.

After the audit, update the **concept note** with a plain-language table:
works offline / download first / needs connection, plus clear synchronisation
limits. Do not infer offline saving from a working offline screen. The concept
note itself has not yet been edited.

## Change log

- 2026-09-05: Register created; offline audit and concept-note action recorded.
- 2026-09-05: Added connected farm pack, 15-minute tour and product-feedback
  implementation. Local report rendered and inspected (three pages); browser
  end-to-end and live feedback delivery remain to be verified after deployment.
- Previous verified release: b4ea3ef — demo portraits, logos and varied gardens.

## Garden selection and discovery — 6 September 2026

- Direct `/samples/gardens` gallery, linked from the menu, Settings and sample
  chooser; available to funders as a fictional farmer example.
- Eighteen individually selectable profiles, type filters, a change-garden
  selector, regional participants and a garden-specific overview PDF.
- Different schematic layouts open first in both the gallery and dashboard.
  Selecting another garden resets the picture and clears any previously selected
  person. Mobile garden details include the layout without opening a participant.
- The existing aerial photo remains shared and is explicitly labelled as such.
- These are display-only overview samples, not eighteen fully editable Design
  Studio farms. The separately labelled Ubhejane link opens the editable farm pack.
- Validation: typecheck and full suite passed (3,398 pass, zero failures, one
  pre-existing TODO). All 18 SVG layouts rendered and visually inspected. Browser
  connection unavailable; interactive page verification remains outstanding.
  Subsequently deployed before the current batch (337b832).

## Crop timeline icon fit — 6 September 2026

- Compact crop icons honour their supplied size for images and emoji, overriding
  the general list-art minimum. Timeline names sit beside the icon and truncate
  horizontally within short bars. Crop timings and planning calculations unchanged.
- Deployed in b7bdeef; production workflow confirmed the matching live build.
  Interactive browser visual verification remains outstanding.
- Recent harvests use matching catalogue artwork when no uploaded photo exists.
  Uploaded evidence photos retain priority; unknown crops retain a neutral symbol.
- Map sheets default to Plain paper, including the fallback when a selected
  imported photo disappears. Photo and satellite remain selectable. PLAN_VERSION
  and saved design geometry are unchanged.
- Requested: side-drag resizing for panels/modals. Exact target needs identifying;
  the supplied crop-plan screenshot is a full page rather than a modal.
- Illustrated card palette is the standard view on first render and for existing
  classic preferences. Removed the trial view switch; design data is unchanged.


## Current development batch — 6 September 2026

**Status: deployed 6 September 2026 — live build 12502e5 (PR #418).**
Validation: 3,401 tests, 3,400 passed, zero failures and one pre-existing TODO.
Photo assets were inspected. Interactive browser connection failed, so mobile
and desktop interaction/visual verification remains outstanding. Production
workflow confirmed that the live build matches the merged commit.

- Eighteen unique AI-generated garden reference photos, matched to each fictional
  garden type; shared across its directory, visual preview and overview report.
  Labelled as illustrations, not satellite measurements or actual project evidence.
- Eighteen garden production allocations drive the sample production-area page;
  vegetable and staple areas are separate and stay within each site's boundary.
  Session migration preserves practice edits and adds missing garden records.
- Funded gardens grouped by town/area with a filter. These are known locality
  groupings; no unrecorded village boundaries are inferred.
- Photorealistic AI crop references for harvest examples and the production form,
  covering the existing sample produce catalogue. Uploaded harvest photos retain
  priority. Reference pictures are not saved as evidence of a user's harvest.
- Lima role-specific scripted conversations for farmer, mentor, organisation,
  funder and student. Farmer example includes an illustrative aphid photograph.
  Clearly marked as scripted; these do not demonstrate a verified live AI call.
- Assessment and learning coverage shows all existing assessment stages,
  including app feedback, while keeping unpublished responses private.
- Sample programme reports open in full. The site report opens with a complete
  locally assembled sample record including the saved crop plan, design inventory,
  quantities and evidence limitations. It is not a newly generated AI assessment.
- “Generate new report” appears after a report exists, alongside report view
  controls. In sample site reports it refreshes the record from practice data
  without a live AI call; live generation retains its existing online workflow.
- Read [MEL-FEATURE-AUDIT.md](MEL-FEATURE-AUDIT.md) for the current MEL foundations,
  missing tools, funder metrics and concept-note wording.

## Real Ubhejane case study and sample boundaries

The owner identifies Ubhejane as a real garden and its original design as the
real reference. Actual site photos are awaiting upload. Do not label the whole
case fictional, or label synthetic photos as real evidence. Current sample
financials, household examples and soil examples remain illustrative until
replaced with the owner's actual records; “only finances are fictional” is not
yet a valid description of all seeded content.

The existing sample storage layer redirects local changes into memory and blocks
remote data writes. Practice design edits can survive in-app navigation; reload,
reset or a fresh session rebuilds the original example. The original saved map is
not overwritten. Preserve this protection when integrating actual site media.

## Further agreed additions / remaining limits

- Fully editable, connected Design Studio workspaces for the other 18 gardens:
  pending. Their current overview gallery must not be confused with the one
  connected Ubhejane farm workspace.
- Reconciled national, mentor and farm demo datasets: pending; avoid combined totals.
- Dated retail replacement values, price coverage and produce disposition metrics:
  proposed; no unsupported portfolio value has been added.
- Results framework, indicator register, formal data-quality reviews and learning
  decisions linked to app releases: proposed, detailed in the MEL audit.
- Prepared full reports for all 18 catalogue gardens: implemented in the batch
  below. Automated report version history and archived reports for every other
  role remain pending; sample reports are not expert-validated agronomic advice.
- Advanced panel resizing, expanded mentor resources/visits, privacy signing and
  offline validation retain the open statuses above.
- Latest actual site photographs and any genuine laboratory or household records
  must be supplied before replacing the corresponding examples.


## Funding and tangible delivery — proposed 6 September 2026

- Existing: design-derived BOQ with known rates, explicit unpriced lines and
  existing-item exclusions; generic milestone targets and dated observations.
- Proposed: **Funding & delivery** in organisation/funder views, linking site
  needs to approved BOQ revisions, funding allocations, funding gaps, procurement,
  verified assets and follow-up functionality.
- Keep current funded commitments distinct from additional needs beyond budget.
  Track tanks and added storage, commissioned solar capacity, planted trees and
  survival; never confuse installed capacity or spending with achieved outcomes.
- Selected funding opportunities and branded gap/delivery reports, published by
  the organisation for existing or prospective funders. No automatic outreach.
- Full specification and concept-note paragraph: [FUNDING-AND-DELIVERY.md](FUNDING-AND-DELIVERY.md).
- Status: design documented; complete linked workflow is not yet built.

## Completed reports for all 18 gardens — 6 September 2026

Status: implemented; 3,401 tests passed, no failures, one existing TODO.
TypeScript and all 18 PDF content checks passed. Deployed via PR #419,
commit 5a13fe9; the production workflow verified the live build.

- Every garden card now links directly to its completed four-page sample PDF.
  The organisation/funder garden detail also links to that same report.
- Each report uses that garden’s own name, type, AI site reference photo,
  schematic layout, planted areas, participant count and production figures.
- Eight sections cover assessment, production, infrastructure needs, funding
  readiness, evidence and next actions. Missing measured quantities and prices
  are explicit; no invented commitments or laboratory results are presented.
- The selected garden shows the full report text and a separate **Generate new
  report PDF** action. Photo and layout are included by default in this gallery.
- These are prepared demonstration reports requiring no live AI call. They do
  not add 18 editable Design Studio farms or certify actual project outcomes.

## Sample navigation and Back controls — 6 September 2026

Status: implemented; TypeScript passed, 3,404 tests passed, zero failures,
one existing TODO. Deployed through PR #420, commit a120d93;
the production workflow verified that this commit is live.

- The bottom sample banner is replaced by a small Sample indicator on the menu
  button. Its menu offers sample choices, 18 garden reports, tour and Exit.
  Pages without that menu use a compact top-corner sample link.
- Back controls added to Account, Home, Map, community, learning and other
  missing headers; the label remains visible on phones. Existing Design Studio
  back navigation is preserved.
- All five role cards appear first in the chooser. Availability comes from the
  signed-in account’s own role, not the fictional Sample Farmer profile after
  a reload. Farmers and mentors retain their role restrictions; organisations
  and administrators can explore all roles. Unknown account roles fail closed.
- Account’s sample view explains its practice profile instead of presenting
  fictional profile data as the real account’s permissions.
- The live desktop chooser was visually checked in this follow-up: all five
  cards are present and no footer strip covers the page. Phone rendering remains
  unverified.


## Compact sample chooser — 6 September 2026

Status: implemented in this branch. TypeScript and whitespace checks passed;
3,404 tests passed, zero failures and one existing TODO. The desktop preview
showed all five cards together, with working Funder selection and Sample menu
controls. All five roles also opened on the deployed PR #420 release.
Phone/tablet rendering remains unverified. Production is the separate PR #420
release above until this follow-up is merged and deployed.

- Organisation, Funder, Farmer, Mentor and Student are the first five cards.
  Wide screens show them in one row; tablets use a grid and phones compact rows.
- Shorter introduction and supporting links below the choices; the full card is
  a touch target. The current view is indicated and account-role checks remain.
  A shorter, top-aligned footer note clears the default floating Lima control.
- Sample garden pages, the journal sheet and Design Studio no longer reserve
  space for the removed footer strip. The tour points to the Sample menu.
- The carried-forward request table above retains incomplete work and records
  the limit that the full previous transcript was not available.
