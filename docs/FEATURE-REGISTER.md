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
  Deployment awaits CI and production verification for this branch.
