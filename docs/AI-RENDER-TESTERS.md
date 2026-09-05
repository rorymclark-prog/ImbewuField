# Experimental AI map access

AI map generation is limited to individually approved Firebase accounts. This is not a random
1% rollout. Ordinary users, admins and the worker's existing owner accounts all remain locked
unless their **Firebase Auth custom claims** include the exact Boolean `aiRenderTester: true`.
Editable profile fields, browser settings and query parameters cannot grant access.

Exact Canvas, saved maps and retrieval of already-submitted renders remain available. This change
does not alter Design Studio's layout or saved geometry.

## Deployment order

1. Keep `NEXT_PUBLIC_AI_RENDER_ENABLED` off while deploying the server and worker changes.
2. Deploy the updated render worker before opening the Vercel flag. The worker is the security
   boundary for Firestore jobs and must reject unapproved accounts before reserving quota.
3. Grant access only to the explicitly selected tester UIDs using trusted Firebase administration.
4. Set `NEXT_PUBLIC_AI_RENDER_ENABLED=true` only in the environment being tested, then redeploy it.
   The worker's existing `app_config/renders.enabled` must also be `true`. Its default-off switch
   and existing quota limits remain in force; tester access does not bypass them.

No live flags, claims, rules or worker deployments are changed by this branch. No additional
Firestore credentials are needed on Vercel: Next verifies the signed ID token, while the worker
uses its existing Admin SDK identity to read the current Auth account. Firestore rules need no
change for the claim; clients cannot issue Firebase custom claims.

## Grant or revoke one tester

Run this only from an existing trusted Admin SDK environment with permission to administer
Firebase Authentication for `fieldproof-sa`. Confirm the Firebase project and the person's exact
UID first. Do not put credentials in this repository or send them through chat.

From the repository root, replace `FIREBASE_UID` with the selected UID and use `grant` or `revoke`:

```bash
node --input-type=module - 'FIREBASE_UID' grant <<'JS'
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [, , uid, action] = process.argv;
if (!uid || uid === 'FIREBASE_UID' || !['grant', 'revoke'].includes(action)) {
  throw new Error('Supply an exact Firebase UID and grant or revoke.');
}
initializeApp({ projectId: 'fieldproof-sa' });
const auth = getAuth();
const account = await auth.getUser(uid);
if (action === 'grant' && account.disabled) throw new Error('This account is disabled.');
const claims = { ...account.customClaims };
if (action === 'grant') claims.aiRenderTester = true;
else delete claims.aiRenderTester;
await auth.setCustomUserClaims(uid, claims);
if (action === 'revoke') await auth.revokeRefreshTokens(uid);
console.log(`${action} completed for ${uid}; other custom claims preserved.`);
JS
```

The script preserves other existing custom claims. Coordinate with anyone else changing claims
for that account, because Firebase replaces the complete claims object in one write.

After a grant, the tester should sign out and back in to obtain a fresh ID token. The Studio checks
`GET /api/ai-render/access` with the caller's token and keeps paid controls hidden unless the
response approves that same signed-in UID. Responses are private and not cached.

## Revocation and checks

The worker checks the **current** Auth record for every newly claimed job, including whether the
account is disabled. Revoked testers cannot start new worker renders, even with an older ID token.
Work already claimed may finish.

Direct Next image endpoints validate the signed token without an Admin credential lookup. A token
issued before revocation can remain valid until it expires, normally within about one hour;
revoking refresh tokens does not retroactively invalidate that token at these endpoints. Sign-out
or a token refresh makes the UI reflect the new claim. For an immediate stop to all new direct
renders, disable the Vercel generation flag and redeploy; use the worker's existing kill switch
to stop new queued work. Polling existing results remains accessible. See Firebase's
[session and revocation guidance](https://firebase.google.com/docs/auth/admin/manage-sessions)
and [custom-claim propagation guidance](https://firebase.google.com/docs/auth/admin/custom-claims).

Before approving wider testing, check these cases on the preview:

- An ordinary account has Exact Canvas and saved maps, with paid AI controls hidden.
- An explicitly approved account can see the experimental controls when both switches are on.
- Switching from that tester to an ordinary account immediately hides paid controls.
- A direct request without a tester claim receives 401 or 403 before body/vendor processing.
- A manually queued unapproved job is rejected by the worker without changing usage counters.
- Revoked or disabled accounts are denied by the worker; saved output remains readable.

Do not run a paid render merely to check visibility or rejection. The repository tests use mocked
claims and inspect enforcement order without contacting image providers.
