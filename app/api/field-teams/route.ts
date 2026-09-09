import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { melCan, type MelPermission } from '@/lib/mel';
import { canReadFieldVisit, fieldVisitDocumentId, projectFieldWorkspace, validFieldId, validFieldTeam, validFieldVisit, type FieldTeam, type FieldVisit, type FieldMember } from '@/lib/field-teams';
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
    if (!write && (req.nextUrl.searchParams.get('mode')==='photos' || req.nextUrl.searchParams.has('visit'))) {
      const id=req.nextUrl.searchParams.get('id') ?? req.nextUrl.searchParams.get('visit');
      if (!validFieldId(id)) fail('Choose a visit record.');
      const visit=(await db.collection('field_team_visits').doc(id!).get()).data() as (FieldVisit & {orgId:string}) | undefined;
      if (!visit || visit.orgId!==orgId) return json({error:'Visit unavailable.'},403);
      const [team,farmer]=await Promise.all([teamCollection.doc(auth.uid).get(),db.collection('profiles').doc(visit.farmerId).get()]);
      const assigned=new Set<string>(farmer.data()?.org_id===orgId && ['farmer','student'].includes(farmer.data()?.role) ? team.data()?.farmerIds ?? [] : []);
      if (!canReadFieldVisit(visit,auth.uid,manage,assigned)) fail('Visit unavailable.',403);
      return json({photos:(await db.collection('field_team_visit_photos').doc(id!).get()).data()?.photos ?? []});
    }
    if (!write) {
      const teamDocs = manage ? (await teamCollection.limit(251).get()).docs : [await teamCollection.doc(auth.uid).get()].filter(d => d.exists);
      if (teamDocs.length > 250) fail('Choose a smaller field programme.', 422);
      const teams = teamDocs.map(d => ({ ...d.data(), mentorId: d.id })) as FieldTeam[];
      const ids = [...new Set(teams.flatMap(t => [t.mentorId, ...t.farmerIds]))];
      const peopleDocs = manage ? (await db.collection('profiles').where('org_id', '==', orgId).limit(501).get()).docs : ids.length ? await db.getAll(...ids.map(id => db.collection('profiles').doc(id))) : [];
      if (peopleDocs.length > 500) fail('Choose a smaller member directory.', 422);
      const people = peopleDocs.filter(d => d.exists && d.data()?.org_id === orgId).map(d => ({ id: d.id, name: d.data()?.full_name ?? 'Unnamed member', role: d.data()?.role, photoUrl: typeof d.data()?.photo_url === 'string' ? d.data()!.photo_url : null })) as FieldMember[];
      const allowed = new Set(people.filter(x => x.role === 'farmer' || x.role === 'student').map(x => x.id));
      const currentTeams = teams.map(t => ({ ...t, farmerIds: t.farmerIds.filter(id => allowed.has(id)) }));
      const visitsQuery = db.collection('field_team_visits').where('orgId', '==', orgId);
      const cursor=req.nextUrl.searchParams.get('cursor');
      if(cursor && !validFieldId(cursor))fail('Choose a valid visit page.');
      let query=(manage ? visitsQuery : visitsQuery.where('mentorId', '==', auth.uid)).orderBy(FieldPath.documentId());
      if(cursor)query=query.startAfter(cursor);
      const visits=await query.limit(201).get();
      const page=visits.docs.slice(0,200);
      return json(projectFieldWorkspace({ people, teams: currentTeams, visits: page.map(d => ({ ...(d.data() as FieldVisit), photos:[], id: d.id })), visitCursor:visits.size>200?page[page.length-1].id:'', canManage: manage, selfId: auth.uid, sample: false }, auth.uid, manage));
    }
    const raw = await req.text();
    if (raw.length > 650000) fail('Use up to three smaller visit photos.', 413);
    const b = JSON.parse(raw), now = new Date().toISOString();
    let savedVisit:FieldVisit|undefined;
    if (b.action === 'team') {
      if (raw.length > 20000) fail('This team update is too large.', 413);
      if (!manage) fail('Only an organisation access manager can assign field teams.', 403);
      if (!validFieldTeam(b.team)) fail('Choose a mentor, location and unique farmer assignments.');
      const team: FieldTeam = { programme:b.team.programme ?? 'general', mentorId: b.team.mentorId, location: b.team.location.trim(), farmerIds: b.team.farmerIds, guidance: b.team.guidance.trim(), updatedAt: now };
      await db.runTransaction(async tx => {
        const members = await tx.getAll(...[team.mentorId, ...team.farmerIds].map(id => db.collection('profiles').doc(id)));
        if (members.some(d => !d.exists || d.data()?.org_id !== orgId) || members[0].data()?.role !== 'mentor' || members.slice(1).some(d => !['farmer', 'student'].includes(d.data()?.role))) fail('Choose a mentor and farmers from this organisation.', 403);
        tx.set(teamCollection.doc(team.mentorId), team);
        tx.create(db.collection('org_access_audit').doc(), { orgId, actor: auth.uid, action: 'field_team', mentorId: team.mentorId, farmerIds: team.farmerIds, at: now });
      });
    } else if (b.action === 'visit') {
      const visit={...b,mentorId:auth.uid} as FieldVisit;
      if (role !== 'mentor' || !validFieldVisit(visit,now.slice(0,10))) fail('Check the assigned farmer, date, observations, follow-up and photo captions.');
      const ref=db.collection('field_team_visits').doc(fieldVisitDocumentId(auth.uid,visit.id));
      await db.runTransaction(async tx => {
        const [team, farmer, old] = await tx.getAll(teamCollection.doc(auth.uid!), db.collection('profiles').doc(visit.farmerId),ref);
        if (!team.data()?.farmerIds?.includes(visit.farmerId) || farmer.data()?.org_id !== orgId || !['farmer', 'student'].includes(farmer.data()?.role)) fail('This farmer is not in your assigned team.', 403);
        if (old.exists && (old.data()?.orgId!==orgId || old.data()?.mentorId!==auth.uid)) fail('You can edit your own visits within this organisation.',403);
        if (old.exists && old.data()?.updatedAt!==b.expectedUpdatedAt) fail('This visit changed in another window. Reopen it before saving.',409);
        const optionalFields=Object.fromEntries((['supportRequested','observations','agreedAction','responsiblePerson','followUpDate','location','practicalSkill','skillResult','actionCompletedOn','actionOutcome'] as const).map(key=>[key,(visit[key] ?? old.data()?.[key] ?? (key==='skillResult'?'not-assessed':'')).trim()]));
        const next={orgId,mentorId:visit.mentorId,farmerId:visit.farmerId,date:visit.date,notes:visit.notes.trim(),originalNotes:visit.originalNotes ?? old.data()?.originalNotes ?? '',...optionalFields,
          focus:visit.focus ?? old.data()?.focus ?? [],latitude:visit.latitude===undefined?old.data()?.latitude??null:visit.latitude,longitude:visit.longitude===undefined?old.data()?.longitude??null:visit.longitude,photoCount:visit.photos?.length ?? old.data()?.photoCount ?? 0,updatedAt:now};
        if(!validFieldVisit({...next,id:visit.id},now.slice(0,10)))fail('Check the saved action and follow-up date for this visit.');
        tx.set(ref,next);
        savedVisit={...next,id:ref.id,photos:visit.photos??[]};
        // Like training evidence, image bytes live outside the list document and
        // are returned only after the organisation and assignment checks above.
        if (visit.photos!==undefined) tx.set(db.collection('field_team_visit_photos').doc(ref.id),{orgId,mentorId:auth.uid,photos:visit.photos.map(photo=>({image:photo.image,caption:photo.caption.trim()}))});
      });
    } else fail('Unknown field team action.');
    return json({ saved: true, ...(savedVisit?{visit:savedVisit}:{}) });
  } catch (e) { const status = e instanceof SyntaxError ? 400 : (e as { status?: number }).status ?? 503; return json({ error: status === 503 ? 'Field team service unavailable. Changes have not been confirmed.' : (e as Error).message }, status); }
}
export const GET = (req: NextRequest) => handle(req, false);
export const POST = (req: NextRequest) => handle(req, true);
