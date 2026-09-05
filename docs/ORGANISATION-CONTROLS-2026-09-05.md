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
