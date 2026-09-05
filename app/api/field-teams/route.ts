import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { melCan, type MelPermission } from '@/lib/mel';
import { projectFieldWorkspace, validFieldId, validFieldTeam, type FieldTeam, type FieldVisit, type FieldMember } from '@/lib/field-teams';
import type { UserRole } from '@/lib/db/types';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (message: string, status = 400): never => { throw Object.assign(Error(message), { status }); };
async function handle(req: NextRequest, write: boolean) {
  try {
    const auth = await guardPaidApiRequest(req, 'field-teams');
    if (auth.response) return auth.response;
    if (!auth.uid) return json({ error: 'Sign in to use field teams.' }, 401);
    const db = getFirestore(getApps().length ? getApp() : initializeApp());
    const [profile, permission] = await Promise.all([db.collection('profiles').doc(auth.uid).get(), db.collection('org_permissions').doc(auth.uid).get()]);
    const p = profile.data();
    const role = p?.role as UserRole;
    const orgId = role === 'admin' ? req.nextUrl.searchParams.get('org') ?? p?.org_id : p?.org_id;
    if (!validFieldId(orgId) || !['ngo', 'admin', 'mentor'].includes(role)) return json({ error: 'Your organisation must link your account to its field team.' }, 403);
    const manage = ['ngo', 'admin'].includes(role) && melCan(role, permission.data() as MelPermission ?? null, 'people');
    const teamCollection = db.collection('field_teams').doc(orgId).collection('mentors');
    if (!write) {
      const teamDocs = manage ? (await teamCollection.limit(251).get()).docs : [await teamCollection.doc(auth.uid).get()].filter(d => d.exists);
      if (teamDocs.length > 250) fail('Choose a smaller field programme.', 422);
      const teams = teamDocs.map(d => ({ ...d.data(), mentorId: d.id })) as FieldTeam[];
      const ids = [...new Set(teams.flatMap(t => [t.mentorId, ...t.farmerIds]))];
      const peopleDocs = manage ? (await db.collection('profiles').where('org_id', '==', orgId).limit(501).get()).docs : ids.length ? await db.getAll(...ids.map(id => db.collection('profiles').doc(id))) : [];
      if (peopleDocs.length > 500) fail('Choose a smaller member directory.', 422);
      const people = peopleDocs.filter(d => d.exists && d.data()?.org_id === orgId).map(d => ({ id: d.id, name: d.data()?.full_name ?? 'Unnamed member', role: d.data()?.role })) as FieldMember[];
      const allowed = new Set(people.filter(x => x.role === 'farmer' || x.role === 'student').map(x => x.id));
      const currentTeams = teams.map(t => ({ ...t, farmerIds: t.farmerIds.filter(id => allowed.has(id)) }));
      const visitsQuery = db.collection('field_team_visits').where('orgId', '==', orgId);
      const visits = await (manage ? visitsQuery : visitsQuery.where('mentorId', '==', auth.uid)).limit(501).get();
      if (visits.size > 500) fail('This report needs a shorter visit period. Contact your administrator.', 422);
      return json(projectFieldWorkspace({ people, teams: currentTeams, visits: visits.docs.map(d => ({ ...d.data(), id: d.id })) as FieldVisit[], canManage: manage, selfId: auth.uid, sample: false }, auth.uid, manage));
    }
    const raw = await req.text();
    if (raw.length > 20000) fail('This update is too large.', 413);
    const b = JSON.parse(raw), now = new Date().toISOString();
    if (b.action === 'team') {
      if (!manage) fail('Only an organisation access manager can assign field teams.', 403);
      if (!validFieldTeam(b.team)) fail('Choose a mentor, location and unique farmer assignments.');
      const team: FieldTeam = { mentorId: b.team.mentorId, location: b.team.location.trim(), farmerIds: b.team.farmerIds, guidance: b.team.guidance.trim(), updatedAt: now };
      await db.runTransaction(async tx => {
        const members = await tx.getAll(...[team.mentorId, ...team.farmerIds].map(id => db.collection('profiles').doc(id)));
        if (members.some(d => !d.exists || d.data()?.org_id !== orgId) || members[0].data()?.role !== 'mentor' || members.slice(1).some(d => !['farmer', 'student'].includes(d.data()?.role))) fail('Choose a mentor and farmers from this organisation.', 403);
        tx.set(teamCollection.doc(team.mentorId), team);
        tx.create(db.collection('org_access_audit').doc(), { orgId, actor: auth.uid, action: 'field_team', mentorId: team.mentorId, farmerIds: team.farmerIds, at: now });
      });
    } else if (b.action === 'visit') {
      if (role !== 'mentor' || !validFieldId(b.farmerId) || !validFieldId(b.id) || typeof b.notes !== 'string' || !b.notes.trim() || b.notes.length > 4000 || typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !Number.isFinite(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0, 10) !== b.date || b.date > now.slice(0, 10)) fail('Choose an assigned farmer, visit date and notes.');
      await db.runTransaction(async tx => {
        const [team, farmer] = await tx.getAll(teamCollection.doc(auth.uid!), db.collection('profiles').doc(b.farmerId));
        if (!team.data()?.farmerIds?.includes(b.farmerId) || farmer.data()?.org_id !== orgId || !['farmer', 'student'].includes(farmer.data()?.role)) fail('This farmer is not in your assigned team.', 403);
        tx.set(db.collection('field_team_visits').doc(`${auth.uid}_${b.id}`), { orgId, mentorId: auth.uid, farmerId: b.farmerId, date: b.date, notes: b.notes.trim(), updatedAt: now });
      });
    } else fail('Unknown field team action.');
    return json({ saved: true });
  } catch (e) { const status = e instanceof SyntaxError ? 400 : (e as { status?: number }).status ?? 503; return json({ error: status === 503 ? 'Field team service unavailable. Changes have not been confirmed.' : (e as Error).message }, status); }
}
export const GET = (req: NextRequest) => handle(req, false);
export const POST = (req: NextRequest) => handle(req, true);
