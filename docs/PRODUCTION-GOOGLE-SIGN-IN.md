# Production Google sign-in domains

On 5 September 2026, Rory attempted **Continue with Google** on the production
app and received `auth/unauthorized-domain`. This happens before the identity can
be verified and therefore also blocks the pending owner-access bootstrap.

The maintenance workflow checks the Google provider is enabled, reads the live
Firebase project configuration, and adds the two established production aliases:

- `imbewufield.vercel.app`
- `permamap-sa.vercel.app`

It preserves all existing entries, writes only `authorizedDomains` with an explicit
update mask, and reads the live configuration back. It does not add preview URLs,
wildcards or other Vercel sites; change OAuth credentials or account-linking rules;
or modify user profiles. Retrying an already-correct configuration is a no-op.
Only selected public configuration fields are logged. The existing administrative
secret and any OAuth client secret stay in the trusted runner.

Reference: [Google Identity Platform configuration API](https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig).

After the live update succeeds, reload the canonical production login page and
choose **Continue with Google**. The user still completes Google's sign-in flow.
Then the owner-access workflow can be retried; it continues to require the exact
verified account and to preserve the existing organisation.
