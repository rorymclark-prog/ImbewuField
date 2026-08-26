/*
 * THE AUTHORISED READ PATH FOR THE FUNDER PORTFOLIO — precondition (A) of lib/network.ts.
 *
 * Before this route, `lib/network.ts` was fed demo data only, and its header said plainly that
 * wiring it to real farmers without a server-side authorised read is "a POPIA data breach, not a
 * feature". This is that read. The four steps it names, in order:
 *
 *   (i)   verify the caller's Firebase ID token                  — guardPaidApiRequest
 *   (ii)  load /profiles/{callerUid} SERVER-SIDE, assert role    — decideNetworkAccess
 *   (iii) assert the farmer's org is visible AND that the farmer consented, per scope
 *   (iv)  read with the Admin SDK and return a PROJECTION        — applyConsent
 *
 * WHAT THIS ROUTE DELIBERATELY NEVER RETURNS: raw Firestore documents, free-text survey answers,
 * and — unless the farmer granted the location scope — an exact homestead coordinate. The client
 * receives derived numbers and nothing else, so a bug in a dashboard component cannot expose a
 * field the farmer withheld.
 *
 * DEPLOYMENT PRECONDITIONS, both of which are OFF by default and neither of which this file can
 * assert for itself:
 *   • REQUIRE_API_AUTH=1 — otherwise lib/api-auth.ts is LOG-ONLY and an unauthenticated caller
 *     reaches step (ii) with uid null. This route refuses a null uid outright, so it fails closed
 *     either way, but the flag is what makes the refusal a 401 rather than a log line.
 *   • Admin SDK credentials in the environment (FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_
 *     CREDENTIALS). Without them getFirestore() throws and this returns 503 rather than pretending
 *     an empty portfolio — an empty list here reads as "the programme has no farmers".
 *
 * KNOWN COST: this reads six queries PER FARMER (consent + five log collections), so an org of
 * 44 farmers costs ~264 document reads per call. That is fine at the current single-org scale and
 * is not fine at fifty orgs; the fix when it matters is a collectionGroup query per collection
 * filtered by org_id, then a group-by in memory. Left as the simple shape deliberately — the
 * correctness of the consent projection is what this route exists for, and batching it before
 * anyone depends on it would make that harder to review.
 */

import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { decideNetworkAccess, canSeeOrg, type CallerProfile } from '@/lib/network-access';
import { applyConsent, type FarmerConsent } from '@/lib/consent';
import { buildFarmerMetrics, coarsenFarmerLocation, type NetworkFarmer } from '@/lib/network';

export const runtime = 'nodejs';
const ROUTE = 'network/farmers';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET(req: NextRequest) {
  // ── (i) identity ────────────────────────────────────────────────────────────
  const auth = await guardPaidApiRequest(req, ROUTE);
  if (auth.response) return auth.response;
  if (!auth.uid) {
    // Reached only when REQUIRE_API_AUTH is unset. Log-only auth is acceptable for the AI
    // routes it was written for; it is not acceptable for one that reads other people's money.
    console.warn(`[${ROUTE}] refused an unauthenticated request (REQUIRE_API_AUTH is not set)`);
    return json({ error: 'Authentication required.' }, 401);
  }

  let db;
  try {
    db = getFirestore(getApps().length > 0 ? getApp() : initializeApp());
  } catch (e) {
    console.error(`[${ROUTE}] no Admin SDK credentials:`, e instanceof Error ? e.message : e);
    return json({ error: 'Portfolio data is unavailable.' }, 503);
  }

  // ── (ii) authorisation, from the caller's OWN profile — never from the request ──
  // Fields are copied ACROSS EXPLICITLY rather than spread. A spread would carry whatever else
  // the profile document happens to hold into the authorisation input, so a future writable
  // profile field named like an authorisation one would start deciding access.
  const callerSnap = await db.collection('profiles').doc(auth.uid).get();
  const callerData = callerSnap.exists ? (callerSnap.data() as Record<string, unknown>) : null;
  let caller: CallerProfile | null = callerData
    ? {
        id: callerSnap.id,
        role: callerData.role as CallerProfile['role'],
        org_id: (callerData.org_id as string | null) ?? null,
      }
    : null;

  // A funder's reach comes from /grants, NOT from anything on its own profile. The grant docs
  // are `allow write: if false` in firestore.rules, so only an Admin-SDK script can mint one
  // (scripts/provision-org.mjs --fund) — a funder cannot widen its own portfolio by editing a
  // document it owns. This mirrors `grantedOrg()` in the rules exactly; if the two ever
  // disagree, the rules win and this route simply returns rows the client then cannot re-read.
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
  if (!access.ok) return json({ error: access.reason }, access.status);

  // ── (iii) scope + consent, per farmer ───────────────────────────────────────
  const orgId = req.nextUrl.searchParams.get('org_id');
  if (!orgId) return json({ error: 'org_id is required.' }, 400);
  if (!canSeeOrg(access, orgId)) {
    console.warn(`[${ROUTE}] ${auth.uid} (${access.role}) asked for org ${orgId}, outside its portfolio`);
    return json({ error: 'That organisation is not in your portfolio.' }, 403);
  }

  const farmerSnap = await db.collection('profiles')
    .where('role', '==', 'farmer').where('org_id', '==', orgId).get();

  const out = [];
  let withheldEntirely = 0;

  for (const doc of farmerSnap.docs) {
    const consentSnap = await db.collection('farmer_consents').doc(doc.id).get();
    const consent = (consentSnap.exists ? consentSnap.data() : null) as FarmerConsent | null;

    // ── (iv) read, derive, project ──
    const [production, sales, expenses, courses, surveys] = await Promise.all([
      db.collection('production_logs').where('profile_id', '==', doc.id).get(),
      db.collection('sales_logs').where('profile_id', '==', doc.id).get(),
      db.collection('expense_logs').where('profile_id', '==', doc.id).get(),
      db.collection('course_progress').where('profile_id', '==', doc.id).get(),
      db.collection('survey_responses').where('profile_id', '==', doc.id).get(),
    ]);
    const rows = <T,>(s: FirebaseFirestore.QuerySnapshot) =>
      s.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as T[];

    const farmer = {
      id: doc.id,
      name: (doc.data().full_name as string) ?? 'Unnamed',
      orgId,
      ...(doc.data().network ?? {}),
    } as unknown as NetworkFarmer;

    const summary = applyConsent(
      { farmer, metrics: buildFarmerMetrics(farmer, {
        production: rows(production), sales: rows(sales), expenses: rows(expenses),
        courses: rows(courses), surveys: rows(surveys),
      }) },
      consent,
      coarsenFarmerLocation,
    );

    // A farmer who granted nothing at all is not listed as an empty card — an all-null row
    // still discloses that this person is enrolled, which is itself their information.
    if (summary.farmer.consent === 'granted') out.push(summary);
    else withheldEntirely++;
  }

  if (withheldEntirely > 0) {
    console.info(`[${ROUTE}] org ${orgId}: ${withheldEntirely} farmer(s) omitted — no consent on record`);
  }
  return json({
    farmers: out,
    // Stated, not silent: a shorter list than the org's roll is a consent outcome, not attrition.
    withheldForConsent: withheldEntirely,
  }, 200);
}
