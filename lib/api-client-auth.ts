'use client';

import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { SAMPLE_REQUEST_HEADER } from '@/lib/api-auth-shared';

/**
 * Headers for a call that spends money.
 *
 * THREE CASES, and the middle one is the reason this file is more than one line:
 *
 *   signed in            → the Firebase ID token. The only real credential here.
 *   sample mode, no user → `x-imbewu-sample: 1`. Sample mode has NO Firebase user by design
 *     (lib/sample-mode.ts), so once REQUIRE_API_AUTH is set the demo farm's AI features would 401
 *     with nothing to send. This header is what admits them to the demo-safe routes listed in
 *     GUEST_LANE_ROUTES — see the trust model in lib/api-auth.ts: it is not a credential, it is a
 *     declaration, and what protects the routes behind it is the allowlist plus a small per-address
 *     rate limit.
 *   neither              → nothing, exactly as before.
 *
 * The sample branch is checked only when there is NO user: a signed-in farmer who wandered into the
 * sample farm sends their token, and the server prefers a verified uid over any declaration.
 */
export async function paidApiHeaders(
  // Access checks bind their response to a particular user. Capture that same user's token,
  // even if Firebase switches accounts while the request is awaiting authentication.
  forUser?: { getIdToken(): Promise<string> } | null,
): Promise<Record<string, string>> {
  const user = forUser === undefined ? getFirebase()?.auth.currentUser : forUser;
  if (!user) return isSampleMode() ? { [SAMPLE_REQUEST_HEADER]: '1' } : {};
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}
