# Sample workspace and NGO access review — 5 September 2026

## Demo convention

Use `/samples` as the common entry point. NGO, funder, farmer, mentor and student
are views of a sample session, not additional accounts. Existing real login roles
never change. Every route keeps the common sample banner with Switch sample view,
Reset sample and Exit sample. Switching preserves practice changes; reset/reload
rebuilds the example. The existing storage shim keeps changes in memory and cloud
queries retain their sample guards.

This follows the isolated, pre-filled playground pattern described by Salesforce:
https://trailhead.salesforce.com/content/learn/modules/trailhead_playground_management/create-a-trailhead-playground
HubSpot also describes realistic isolated test accounts:
https://developers.hubspot.com/docs/developer-tooling/local-development/configurable-test-accounts

The learning fixture is explicitly fictional: 16 assessment participants, seven
stages, closed/open/draft examples. Completion totals are calculated from its
response rows; published summaries use the real suppression and privacy function.
Numerical production, financial and area answers are deliberately left unknown.
It is a separate learning exercise, not a claim that these people or results
belong to Ubhejane. Existing farmer, garden and portfolio fixtures are unchanged.
The production-area register still requires real checked observations; this release
does not fabricate hectares to fill that empty state.

## Where the controls live

NGO → People & access now opens the organisation editor directly. Previously this
was hidden inside Assessments. Both NGO and funder tab strips now allow horizontal
scrolling, have arrow controls and keep each tab on one line.

| Control | Enforcement and scope |
| --- | --- |
| Member role | Existing profile role; same organisation; farmer/student/mentor/NGO |
| Manage assessments | Server `melCan`; only NGO/mentor (or platform admin) |
| Read private analysis | Server `melCan`; funders cannot gain it through flags |
| Manage people | NGO people permission; platform admin for the selected organisation |
| Funder dashboards | Existing organisation sharing switch and linked-funder checks |
| Assessment summary | Individual publication; closed assessments only; privacy projection |
| Production area | Separate per-garden publication in Production area |
| Admin/funder identity, organisation transfers | Not delegated to NGO member editor |

The verified platform owner can now use the same people editor for a selected NGO.
The role-update helper still rejects a different organisation, self-edit and
admin/funder promotions. No actual member role or sharing preference is changed by
this release. Access writes retain the existing audit records.

## Remaining app-wide permission work

These are not yet universal feature switches. Adding an apparent toggle without
checking every underlying read/write route would be misleading. OWASP recommends
validating authorization on every request:
https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

Recommended next sequence:
1. Inventory each feature's server API, direct Firestore access, storage access,
   offline store and navigation entry before introducing new permissions.
2. Define one shared capability policy: role preset + NGO scope + explicit
   overrides + farmer consent. Keep billing/platform powers outside NGO scope.
3. Wire each capability through server/data rules first, then its visible control:
   mentor assignments, report exports, learning, surveys and financial summaries.
4. Add a read-only effective-access preview for a selected member, with reasons;
   keep sample view switching separate from impersonation.
5. Verify denied direct URLs/API requests, cross-NGO access, revocation, offline
   resync and audit events before claiming a new feature is switchable.

No universal permission matrix or fine-grained funder chart switches ship in this
change. The UI states this limit rather than presenting unenforced switches.
