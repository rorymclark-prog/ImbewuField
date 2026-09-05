# Platform owner access

Rory explicitly requested access to every role dashboard and supplied his sign-in
email on 5 September 2026. This maintenance change provisions that exact existing
Firebase account as `admin`, using the existing protected deployment credential.
The application's normal server-side role checks continue to apply.

`scripts/provision-org.mjs` remains the organisation onboarding tool. It requires
an organisation and writes both role and organisation. Platform ownership must
preserve the existing organisation, so the separate one-time bootstrap updates
only `profiles/{uid}.role`. It never creates accounts, profiles or organisations.

The email is pinned by SHA-256 to avoid publishing the literal address in source
or workflow logs. This is an identifier, not encryption or a credential. Firebase
Auth has no email-digest lookup: the script scans paginated account metadata in
memory and retains only the exact match. No account list is stored or exported.
It then re-reads the match and requires a verified, enabled account.

The workflow runs only on main when its own files change. It uses the existing
`FIREBASE_SERVICE_ACCOUNT` secret in the credentialled steps, checks the project
is `fieldproof-sa`, runs a dry check, applies the approved change, then reads the
stored profile back. No deployment credential is downloaded into the workspace.

The transaction also creates a private `org_access_audit` record with the prior
role. That record makes retries safe and prevents a later workflow rerun from
restoring access that an administrator deliberately revoked. Reversal is a trusted
Admin SDK update restoring the recorded previous role; retain the audit record.

After success, the owner opens `/account` and presses **Refresh my access**. It
should display **Platform administrator**, links to each real dashboard, and
sample-data role previews. No separate login is needed. NGO controls continue to
govern ordinary NGO/funder accounts; platform administrators are deliberately
cross-organisation operators.
