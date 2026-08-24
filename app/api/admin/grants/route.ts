import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminFirestore } from '@/lib/admin-auth';
import type { Grant } from '@/lib/db/types';

// Platform admin: create/delete Grant docs — a funder org's standing permission to read one NGO
// org's data (lib/db/types.ts's Grant doc comment). Client-side rules deny all writes to
// /grants; this Admin-SDK route is the only writer, matching the plan.

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function grantId(funderOrgId: string, ngoOrgId: string): string {
  return `${funderOrgId}_${ngoOrgId}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/grants');
  if (auth.response) return auth.response;

  const snap = await getAdminFirestore().collection('grants').get();
  const grants: Grant[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Grant, 'id'>) }));
  return NextResponse.json({ grants });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/grants');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const funderOrgId = typeof body?.funder_org_id === 'string' ? body.funder_org_id : '';
  const ngoOrgId = typeof body?.ngo_org_id === 'string' ? body.ngo_org_id : '';
  if (!funderOrgId) return badRequest('funder_org_id is required.');
  if (!ngoOrgId) return badRequest('ngo_org_id is required.');

  const db = getAdminFirestore();
  const [funderSnap, ngoSnap] = await Promise.all([
    db.collection('organizations').doc(funderOrgId).get(),
    db.collection('organizations').doc(ngoOrgId).get(),
  ]);
  if (!funderSnap.exists || funderSnap.data()?.kind !== 'funder') return badRequest('funder_org_id must name an existing funder org.');
  if (!ngoSnap.exists || ngoSnap.data()?.kind !== 'ngo') return badRequest('ngo_org_id must name an existing ngo org.');

  const id = grantId(funderOrgId, ngoOrgId);
  const grant: Grant = {
    id,
    funder_org_id: funderOrgId,
    ngo_org_id: ngoOrgId,
    created_at: new Date().toISOString(),
    created_by: auth.uid as string,
  };
  await db.collection('grants').doc(id).set({
    funder_org_id: grant.funder_org_id,
    ngo_org_id: grant.ngo_org_id,
    created_at: grant.created_at,
    created_by: grant.created_by,
  });

  return NextResponse.json({ grant }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/grants');
  if (auth.response) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  const funderOrgId = req.nextUrl.searchParams.get('funder_org_id');
  const ngoOrgId = req.nextUrl.searchParams.get('ngo_org_id');
  const targetId = id ?? (funderOrgId && ngoOrgId ? grantId(funderOrgId, ngoOrgId) : null);
  if (!targetId) return badRequest('Provide id, or both funder_org_id and ngo_org_id.');

  const ref = getAdminFirestore().collection('grants').doc(targetId);
  const existing = await ref.get();
  if (!existing.exists) return NextResponse.json({ error: 'No grant found for that id.' }, { status: 404 });

  await ref.delete();
  return NextResponse.json({ ok: true, id: targetId });
}
