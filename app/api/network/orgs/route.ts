/*
 * WHICH ORGS MAY THIS CALLER ASK ABOUT — the companion to /api/network/farmers.
 *
 * That route takes an `org_id` and refuses one outside the caller's portfolio. Nothing told the
 * client which ids were legal, so the only way to use it was to already know an org id, which an
 * NGO dashboard cannot. This returns exactly the set the caller is entitled to and nothing more,
 * so the picker in the UI is populated from the authorisation decision itself rather than from a
 * client-side guess that the farmers route would then have to reject.
 *
 * THE ADMIN CASE IS WHY THIS IS NOT JUST `[myOrg]`. A platform admin's org_id is null — that is
 * the NORMAL state for an account that belongs to no tenant — and `decideNetworkAccess` grants it
 * `allOrgs`. For that caller the entitled set is every organisation on the platform, which cannot
 * be derived from the caller's own profile at all; it has to be read. See lib/network-access.ts.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN: farmer counts, totals, or anything derived from farmer
 * documents. A count is an aggregate over people who may not have consented, and this route
 * exists to populate a dropdown. Numbers come from /api/network/farmers, after the consent
 * projection has run.
 */

import { NextRequest } from 'next/server';
import { resolveNetworkCaller } from '@/lib/network-caller';
import type { NetworkOrgOption } from '@/lib/network';

export const runtime = 'nodejs';
const ROUTE = 'network/orgs';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET(req: NextRequest) {
  const caller = await resolveNetworkCaller(req, ROUTE);
  if (!caller.ok) return caller.response;
  const { db, access } = caller;

  let orgs: NetworkOrgOption[];

  if (access.allOrgs) {
    // Admin only. Reading the whole collection is correct here precisely because the admin
    // wildcard means there is no narrower entitled set to compute.
    const snap = await db.collection('organizations').get();
    orgs = snap.docs.map((d) => {
      const data = d.data() as { name?: string; kind?: 'ngo' | 'funder' };
      return { id: d.id, name: data.name ?? 'Unnamed organisation', kind: data.kind ?? null };
    });
  } else {
    // Fetched by id rather than queried: the entitled set is already decided, and a query would
    // re-derive it from document contents — a second authorisation path, and the one that would
    // be wrong if the two ever disagreed.
    const snaps = await Promise.all(
      access.visibleOrgIds.map((id) => db.collection('organizations').doc(id).get()),
    );
    orgs = snaps
      .filter((s) => s.exists)
      .map((s) => {
        const data = s.data() as { name?: string; kind?: 'ngo' | 'funder' };
        return { id: s.id, name: data.name ?? 'Unnamed organisation', kind: data.kind ?? null };
      });
    // An id in the portfolio with no organisation document is a provisioning fault, not a
    // permission one — say so in the log rather than silently shortening the list.
    if (orgs.length !== access.visibleOrgIds.length) {
      const missing = access.visibleOrgIds.filter((id) => !orgs.some((o) => o.id === id));
      console.warn(`[${ROUTE}] ${caller.uid} is entitled to org(s) with no document: ${missing.join(', ')}`);
    }
  }

  orgs.sort((a, b) => a.name.localeCompare(b.name, 'en-ZA'));

  return json({ orgs, allOrgs: access.allOrgs, role: access.role }, 200);
}
