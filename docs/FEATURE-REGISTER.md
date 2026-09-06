# ImbewuField feature register

Living register: update this file with each feature change. Do not mark a feature
live solely because its code exists: record tests and deployment confirmation.
This register describes product capability, not verified project outcomes.

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
one existing TODO. Deployment verification pending.

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
- Browser preview connection was unavailable; phone rendering is not yet
  visually verified for this batch.

## Visually rich site reports — 6 September 2026

- Request: make generated site reports substantially richer with photographs,
  maps, charts and plant graphics; provide full-colour print and separate
  ink-saving output.
- Implemented on `codex/visual-site-report`; production merge pending.
- Site report: photographic/saved-plan cover, prominent figures, mapped growing
  area, rainfall, tank capacity, saved sowing calendar and priced BOQ charts.
  Catalogue crop images now enter full-colour PDF export where available.
- Garden gallery: all 18 reports use each garden's own image and figures, with
  area and training graphics, readable numbered sections and regenerated PDFs.
- Screen and full-colour PDF share chart artwork and values. The ink-saving
  option excludes photos by default. Existing compact 1/5-page summaries remain.
- Typecheck, 3,409 passing tests, zero failures, one existing TODO and whitespace checks passed.
- Local sample PDFs visually checked: full colour six pages; ink saving three.
  Desktop browser review also checked the main site report, sample charts, crop
  illustrations, enlarged pictures and colour/ink PDF controls. Final hosted
  checks and the review handoff are recorded in PR #422 and the continuing project source.
- See [visual report audit](VISUAL-SITE-REPORT-AUDIT.md) for findings and data limits.
