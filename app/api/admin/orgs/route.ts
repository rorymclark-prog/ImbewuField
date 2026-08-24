import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminFirestore } from '@/lib/admin-auth';
import type { Organization } from '@/lib/db/types';

// Platform admin: list/create Organization docs (the org an ngo/funder profile's org_id points
// at). No update/delete here by design — the plan scopes admin controls to role + org
// assignment only, not general org lifecycle management.

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/orgs');
  if (auth.response) return auth.response;

  const snap = await getAdminFirestore().collection('organizations').orderBy('name').get();
  const orgs: Organization[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Organization, 'id'>) }));
  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/orgs');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const kind = body?.kind;
  if (!name) return badRequest('name is required.');
  if (kind !== 'ngo' && kind !== 'funder') return badRequest("kind must be 'ngo' or 'funder'.");

  const db = getAdminFirestore();
  const ref = db.collection('organizations').doc();
  const org: Organization = { id: ref.id, name, kind, created_at: new Date().toISOString() };
  await ref.set({ name: org.name, kind: org.kind, created_at: org.created_at });

  return NextResponse.json({ org }, { status: 201 });
}
