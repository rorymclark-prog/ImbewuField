/*
 * STEPS (i) AND (ii) OF THE AUTHORISED PORTFOLIO READ, IN ONE PLACE.
 *
 * `app/api/network/farmers/route.ts` established the four-step shape: verify the token, load the
 * caller's OWN profile server-side and decide access from it, then scope and project. Every
 * further portfolio route needs the first two steps identically, and "identically" is the whole
 * point — a second route that re-implements the preamble is a second place for the authorisation
 * model to drift, and drift on this boundary is a POPIA incident rather than a bug.
 *
 * So the preamble lives here and the routes call it. What it deliberately does NOT do is decide
 * anything about the specific resource being asked for: it answers "who is this caller and which
 * orgs may they see", and the route answers "may they see THIS one" via canSeeOrg(). Keeping that
 * split means this file never needs to know what a route returns.
 *
 * SERVER ONLY. It imports firebase-admin; importing it from a client component would both fail to
 * build and, if it somehow did, hand the Admin SDK to the browser.
 */

import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { decideNetworkAccess, type CallerProfile, type AccessGranted } from '@/lib/network-access';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export type ResolvedCaller =
  | { ok: true; db: Firestore; uid: string; access: AccessGranted }
  | { ok: false; response: Response };

/**
 * Verify the caller and decide which orgs their role entitles them to. Returns either a granted
 * access decision or the exact Response the route should return — the route never builds its own
 * refusal, so every portfolio endpoint refuses in the same words with the same status.
 */
export async function resolveNetworkCaller(req: NextRequest, routeName: string): Promise<ResolvedCaller> {
  // ── (i) identity ────────────────────────────────────────────────────────────
  const auth = await guardPaidApiRequest(req, routeName);
  if (auth.response) return { ok: false, response: auth.response };
  if (!auth.uid) {
    // Reached only when REQUIRE_API_AUTH is unset. Log-only auth is acceptable for the AI routes
    // it was written for; it is not acceptable for one that reads other people's money.
    console.warn(`[${routeName}] refused an unauthenticated request (REQUIRE_API_AUTH is not set)`);
    return { ok: false, response: json({ error: 'Authentication required.' }, 401) };
  }

  let db: Firestore;
  try {
    db = getFirestore(getApps().length > 0 ? getApp() : initializeApp());
  } catch (e) {
    console.error(`[${routeName}] no Admin SDK credentials:`, e instanceof Error ? e.message : e);
    // 503, never an empty success: an empty portfolio reads as "the programme has no farmers".
    return { ok: false, response: json({ error: 'Portfolio data is unavailable.' }, 503) };
  }

  // ── (ii) authorisation, from the caller's OWN profile — never from the request ──
  // Fields are copied ACROSS EXPLICITLY rather than spread. A spread would carry whatever else the
  // profile document happens to hold into the authorisation input, so a future writable profile
  // field named like an authorisation one would start deciding access.
  const callerSnap = await db.collection('profiles').doc(auth.uid).get();
  const callerData = callerSnap.exists ? (callerSnap.data() as Record<string, unknown>) : null;
  let caller: CallerProfile | null = callerData
    ? {
        id: callerSnap.id,
        role: callerData.role as CallerProfile['role'],
        org_id: (callerData.org_id as string | null) ?? null,
      }
    : null;

  // A funder's reach comes from /grants, NOT from anything on its own profile. The grant docs are
  // `allow write: if false` in firestore.rules, so only an Admin-SDK script can mint one
  // (scripts/provision-org.mjs --fund) — a funder cannot widen its own portfolio by editing a
  // document it owns. This mirrors `grantedOrg()` in the rules exactly; if the two ever disagree,
  // the rules win and the route simply returns rows the client then cannot re-read.
  if (caller && caller.role === 'funder' && caller.org_id) {
    const grantSnap = await db.collection('grants')
      .where('funder_org_id', '==', caller.org_id).get();
    caller = {
      ...caller,
      fundedOrgIds: grantSnap.docs
        .map((d) => (d.data() as { ngo_org_id?: string }).ngo_org_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    };
  }

  const access = decideNetworkAccess(caller);
  if (!access.ok) return { ok: false, response: json({ error: access.reason }, access.status) };

  return { ok: true, db, uid: auth.uid, access };
}
