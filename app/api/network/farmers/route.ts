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
import { canSeeOrg } from '@/lib/network-access';
import { resolveNetworkCaller } from '@/lib/network-caller';
import { applyConsent, consentState, type FarmerConsent } from '@/lib/consent';
import { buildFarmerMetrics, coarsenFarmerLocation, type NetworkFarmer } from '@/lib/network';

export const runtime = 'nodejs';
const ROUTE = 'network/farmers';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET(req: NextRequest) {
  // Steps (i) and (ii) — token, caller profile, role decision, funder /grants resolution — are
  // shared with every other portfolio route and live in lib/network-caller.ts so there is exactly
  // one implementation of them. See that file for why duplicating them would be a hazard.
  const caller = await resolveNetworkCaller(req, ROUTE);
  if (!caller.ok) return caller.response;
  const { db, access } = caller;

  // ── (iii) scope + consent, per farmer ───────────────────────────────────────
  const orgId = req.nextUrl.searchParams.get('org_id');
  if (!orgId) return json({ error: 'org_id is required.' }, 400);
  if (!canSeeOrg(access, orgId)) {
    console.warn(`[${ROUTE}] ${caller.uid} (${access.role}) asked for org ${orgId}, outside its portfolio`);
    return json({ error: 'That organisation is not in your portfolio.' }, 403);
  }

  const farmerSnap = await db.collection('profiles')
    .where('role', '==', 'farmer').where('org_id', '==', orgId).get();

  const out = [];
  let withheldEntirely = 0;
  let adminBypassed = 0;

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

    const raw = {
      farmer,
      metrics: buildFarmerMetrics(farmer, {
        production: rows(production), sales: rows(sales), expenses: rows(expenses),
        courses: rows(courses), surveys: rows(surveys),
      }),
    };

    if (access.role === 'admin') {
      // THE ADMIN BYPASS, MATCHING firestore.rules EXACTLY. `staffConsentedAccess()` there is
      // `isAdmin() || (staffOrgAccess(d) && consentGranted(...))` — an unconditional admin
      // short-circuit — and its comment states the reason: the platform operator's own access is
      // not the third-party disclosure that POPIA consent exists to gate. Without this branch the
      // route contradicted the rules it was written to mirror, and the contradiction was invisible
      // because it only showed up as an empty dashboard, which is also what a real empty programme
      // looks like. The consent STATE is still reported on the row, so the UI can say plainly that
      // a farmer has not agreed to share — the operator sees the figure and sees that fact.
      adminBypassed++;
      out.push({ farmer: { ...raw.farmer, consent: consentState(consent) }, metrics: raw.metrics });
      continue;
    }

    const summary = applyConsent(raw, consent, coarsenFarmerLocation);

    // A farmer who granted nothing at all is not listed as an empty card — an all-null row
    // still discloses that this person is enrolled, which is itself their information.
    if (summary.farmer.consent === 'granted') out.push(summary);
    else withheldEntirely++;
  }

  if (withheldEntirely > 0) {
    console.info(`[${ROUTE}] org ${orgId}: ${withheldEntirely} farmer(s) omitted — no consent on record`);
  }
  if (adminBypassed > 0) {
    // Logged every time, deliberately. An operator reading figures a farmer has not agreed to
    // share is permitted, but it should never be silent — this is the only record that it happened.
    console.info(`[${ROUTE}] ADMIN BYPASS: ${caller.uid} read ${adminBypassed} farmer(s) in org ${orgId} without applying the consent projection`);
  }
  return json({
    farmers: out,
    // Stated, not silent: a shorter list than the org's roll is a consent outcome, not attrition.
    withheldForConsent: withheldEntirely,
  }, 200);
}
