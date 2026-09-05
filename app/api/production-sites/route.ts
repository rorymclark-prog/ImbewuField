import { NextRequest } from 'next/server';
import { resolveNetworkCaller } from '@/lib/network-caller';
import { canSeeOrg } from '@/lib/network-access';
import { type MelPermission } from '@/lib/mel';
import { productionAreaAccess, productionAreaSummary, validProductionSite, type ProductionSite } from '@/lib/production-sites';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function scope(req: NextRequest) {
  const caller = await resolveNetworkCaller(req, 'production-sites');
  if (!caller.ok) return { response: caller.response };
  const org = req.nextUrl.searchParams.get('org') ?? '';
  if (!org || org.includes('/') || !canSeeOrg(caller.access, org)) return { response: json({ error: 'This organisation is outside your access.' }, 403) };
  const controls = await caller.db.collection('organization_controls').doc(org).get();
  const permission = await caller.db.collection('org_permissions').doc(caller.uid).get();
  const policy = productionAreaAccess(caller.access, org, permission.data() as MelPermission | null, controls.data()?.funderAccess !== false, req.nextUrl.searchParams.get('published') === 'true');
  if (!policy) return { response: json({ error: 'This view is unavailable under the organisation’s permissions.' }, 403) };
  return { ...caller, org, ...policy };
}
export async function GET(req: NextRequest) {
  const c = await scope(req); if ('response' in c) return c.response;
  const snapshot = await c.db.collection('production_sites').doc(c.org).collection('sites').get();
  const rows = snapshot.docs.map(d => d.data() as ProductionSite);
  // Funder projection contains only aggregates: no site names, notes, staff IDs or drafts.
  return json({ summary: productionAreaSummary(rows, c.publishedOnly), ...(c.publishedOnly ? {} : { sites: rows, canManage: c.manage }) });
}
export async function POST(req: NextRequest) {
  const c = await scope(req); if ('response' in c) return c.response;
  if (!c.manage || c.publishedOnly || !['ngo', 'admin'].includes(c.access.role)) return json({ error: 'NGO management access is required.' }, 403);
  const raw = await req.text(); if (raw.length > 8000) return json({ error: 'Entry is too large.' }, 413);
  let body: Record<string, unknown>; try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid entry.' }, 400); }
  if (!body || typeof body !== 'object' || body.confirmed !== true || !validProductionSite(body.site, new Date().toISOString().slice(0, 10))) return json({ error: 'Check the site code, date, areas and measurement note. Confirm that the areas do not overlap.' }, 400);
  const s = body.site;
  const site: ProductionSite = { code: s.code, name: s.name.trim(), observedOn: s.observedOn, vegetableM2: s.vegetableM2, stapleM2: s.stapleM2, boundaryM2: s.boundaryM2, evidence: s.evidence.trim(), published: s.published, updatedAt: new Date().toISOString(), updatedBy: c.uid };
  const ref = c.db.collection('production_sites').doc(c.org).collection('sites').doc(site.code);
  // Append a history entry and replace this site's current observation atomically.
  // Repeated seasons update the same physical site instead of accumulating hectares.
  await c.db.runTransaction(async tx => {
    const old = await tx.get(ref);
    tx.set(ref.collection('history').doc(), { previous: old.exists ? old.data() : null, next: site });
    tx.set(ref, site);
  });
  return json({ saved: true });
}
