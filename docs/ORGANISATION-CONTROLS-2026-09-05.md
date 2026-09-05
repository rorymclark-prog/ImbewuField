# Organisation workspace audit and delivery

The public label is Organisation; the existing `ngo` role and route remain stable.
Trusts, charities and other implementing organisations use the same workspace.

## Implemented in this change

- Recognisable crop illustrations in lists, including the garden production rows
  from Rory's screenshot. Map geometry and scale are unchanged.
- Editable sample production areas; replacing a stable site code updates its area
  rather than counting another garden. The starting measurement is illustrative
  design geometry, explicitly not a verified observation of Ubhejane.
- Sample inbox read/reply actions stay in disposable storage and send nothing.
- Sample assessment drafts, participant selection, opening, closing, learning actions
  and publication controls retain their state during client-side role switches.
- Organisation control centre groups existing server-enforced member roles,
  delegated assessment permissions and funder master sharing. Every role has a
  clearly labelled fictional preview. No user impersonation is performed.
- Organisation assigns a mentor, a location, explicit farmers/learners and guidance.
  Mentor field-team reads return only assigned members and that mentor's notes for
  current assignments. Team writes require organisation access-management permission.
  Membership is validated against current server-side profiles in the same organisation.
  New assignment and visit collections are API-only; direct client reads/writes are denied.
- Mentor visit entries and organisation guidance feed an ink-saving field report.
  Organisation/funder programme, production and training reports use the existing
  consent-projected portfolio. Brief/full formats are content limits, not a false
  guarantee of an exact page count. Sample PDFs carry a notice on every page.
- Garden-register sample headlines now sum that register instead of claiming 142
  gardens while showing a different 12-garden fixture.

## Explicit limits and next access work

- Existing controls do not switch every feature of the entire app on/off per user.
  The interface says which permissions are covered. Do not add cosmetic switches
  until the corresponding API, Firestore and offline/local paths honour them.
- Role previews show fictional workspaces, not another person's live data or their
  custom permissions. A live effective-permission preview needs a server-projected
  read-only session and a prominent exit action; it must not change the caller's role.
- Platform administration, funder identities and grants remain platform-managed.
  Organisation staff cannot assign themselves platform rights or override consent.
- Field-team membership governs the new field workspace. Existing course-directory
  Firestore permissions are still organisation-scoped; they are not a new complete
  platform-wide mentor-assignment security boundary. The mentor training list is
  filtered to the assigned group. A future tighter boundary must migrate the existing
  course queries and rules together, preserving access for legitimate course trainers.
- Existing course-visit records are distinct from the new field-team visit log. Reports
  explicitly describe that coverage; records are not silently merged or double counted.
- Legacy garden-register, learning-survey and cohort sample fixtures demonstrate
  different scopes. Their counts must not be combined into a fabricated project total.
- Programme report financial and production figures are cumulative available records;
  no arbitrary month filter, net-profit inference or causal impact claim is invented.

Design Studio, saved farm geometry, crop-plan versioning and species data are untouched.

## Training evidence and reporting audit

The new Training & progress workspace records sessions, training dates, venue names,
optional coordinates, a named attendance register, a mini report, private follow-up,
a linked existing assessment and up to two captioned venue photographs. Mentors
need the separate Record training & attendance permission; enrolled people must
belong to their current assigned group. Manual guests use stable guest codes so
repeat attendees can be counted once. No survey responses are fabricated.

Organisation managers review and publish each session. Linked funders receive only
published summaries, counts and reviewed photos: no named register, participant IDs,
internal follow-up, facilitator account IDs or precise coordinates. Approved free
text and photographs still require a human sharing review. Training snapshots and
milestone edits leave server-side history. API access checks current membership;
the backing collections deny direct client reads and writes.

Milestones record a definition/source/frequency, responsible person, unit, baseline
(or explicitly unknown), target, due date and dated actual totals with evidence.
The timeline selects observations up to a date; it uses the latest corrected record,
not a historical reconstruction of what was known on that date. Cumulative observations
are never summed together. Attending a session is not treated as proof of learning
or causal impact. The report can be produced at any time, with missing data labelled.

This follows the measurement structure in the [MCC indicator tracking guidance](https://www.mcc.gov/resources/doc/guidance-on-the-indicator-tracking-table/)
and the [IFRC monitoring framework](https://preparecenter.org/site/dmerl-framework/monitor/):
keep baseline, target, actual, reporting date, definition and evidence together.
Course pre/post assessments and follow-up adoption observations remain distinct
from attendance and satisfaction. Project managers should agree indicators and
reporting frequency with their funder rather than apply a generic impact score.

Names & logos provides three default partner identities per implementing organisation:
organisation, community/project, funder. These appear in the new programme, field-team,
training and progress report composer. Several projects should use programme-wide
branding; per-project/multiple-funder branding is a future extension. These controls
do not restyle legacy Site Analysis or invoice export engines. Screen reports have
clear cards and larger artwork; PDFs use white paper, dark text, a restrained green
rule and small logos. Session photos are an explicit optional PDF appendix to save ink.

Remaining reporting limits: maximum 500 session records, 200 milestones, 500 profiles
and 200 assessments per organisation load. The API refuses an incomplete total above
these limits rather than silently truncating. Pagination, file/document attachments,
bulk register import, detailed photo revision recovery, and automatic evidence-to-target
reconciliation need subsequent work. Published funder views omit distinct-participant
counts rather than derive a misleading unique total from anonymised attendance counts.

## Demo presentation

One compact sample banner, consistent Switch/Exit actions and a reset in the sample
chooser. Reusable fictional portraits and produce photos show spinach bunches,
tomato bags and cabbage heads. Garden cards open an illustrative design and simulated
aerial without WebGL or access to real participant locations. Source prompts and
fictional-use constraints are recorded in `public/demo/README.md`.
