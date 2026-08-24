import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminFirestore } from '@/lib/admin-auth';
import type { UserRole } from '@/lib/db/types';

// Platform admin: list/search profiles and reassign a user's role/org_id. This is the trusted
// path the rules comments already call for — client-side writes to profiles.role/org_id are
// immutable by design (see firestore.rules), so an Admin-SDK route behind requireAdmin() is the
// only way to change them, replacing hand-editing the Firestore console.

const ROLES: readonly UserRole[] = ['farmer', 'mentor', 'student', 'ngo', 'funder', 'admin'];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/users');
  if (auth.response) return auth.response;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const roleFilter = req.nextUrl.searchParams.get('role');
  const orgFilter = req.nextUrl.searchParams.get('org_id');

  const snap = await getAdminFirestore().collection('profiles').get();
  let users = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      full_name: typeof data.full_name === 'string' ? data.full_name : null,
      role: (data.role ?? null) as UserRole | null,
      org_id: (data.org_id ?? null) as string | null,
    };
  });

  // Firestore has no case-insensitive substring search — filtering in memory is fine at this
  // platform's scale (smallholder farmer counts, not millions of rows).
  if (q) users = users.filter((u) => (u.full_name ?? '').toLowerCase().includes(q));
  if (roleFilter) users = users.filter((u) => u.role === roleFilter);
  if (orgFilter) users = users.filter((u) => u.org_id === orgFilter);

  users.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));

  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, '/api/admin/users');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.uid !== 'string' || !body.uid) return badRequest('uid is required.');
  if (body.role === undefined && body.org_id === undefined) {
    return badRequest('Provide role and/or org_id to update.');
  }

  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return badRequest(`role must be one of: ${ROLES.join(', ')}.`);
    patch.role = body.role;
  }
  if (body.org_id !== undefined) {
    if (body.org_id !== null && typeof body.org_id !== 'string') return badRequest('org_id must be a string or null.');
    patch.org_id = body.org_id;
  }

  const db = getAdminFirestore();
  const ref = db.collection('profiles').doc(body.uid);
  const existing = await ref.get();
  if (!existing.exists) return NextResponse.json({ error: 'No profile found for that uid.' }, { status: 404 });

  await ref.update(patch);
  return NextResponse.json({ ok: true, uid: body.uid, ...patch });
}
