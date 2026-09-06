import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { melCan, programmeCapabilities, type MelPermission } from '@/lib/mel';
import { validFieldId } from '@/lib/field-teams';
import { blankBranding, publishedTraining, validProgrammeBranding, validProgrammeMilestone, validTrainingRecord, type TrainingRecord, type ProgrammeMilestone, type ProgrammeBranding } from '@/lib/programme-evidence';
import type { UserRole } from '@/lib/db/types';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (message: string, status = 400): never => { throw Object.assign(Error(message), { status }); };
async function handle(req: NextRequest, write: boolean) {
  try {
    const auth = await guardPaidApiRequest(req, 'programme-evidence');
    if (auth.response) return auth.response;
    if (!auth.uid) return json({ error: 'Sign in to use programme evidence.' }, 401);
    const db = getFirestore(getApps().length ? getApp() : initializeApp());
    const [profile, permission] = await Promise.all([db.collection('profiles').doc(auth.uid).get(), db.collection('org_permissions').doc(auth.uid).get()]);
    const p = profile.data(), role = p?.role as UserRole, permissions = permission.data() as MelPermission ?? null;
    if (!['ngo','mentor','admin','funder'].includes(role)) fail('Programme access is required.',403);
    const requested = req.nextUrl.searchParams.get('org');
    const org = ['admin','funder'].includes(role) ? requested ?? p?.org_id : p?.org_id;
    if (!validFieldId(org) || (requested && requested!==org)) fail('Choose an organisation within your access.',403);
    if (role === 'funder') {
      if (!validFieldId(p?.org_id)) fail('Funder organisation is not configured.',403);
      const [grant, controls] = await Promise.all([db.collection('grants').doc(`${p!.org_id}_${org}`).get(), db.collection('organization_controls').doc(org).get()]);
      if (!grant.exists || controls.data()?.funderAccess === false) fail('The organisation has not shared this programme.',403);
    }
    const { manage, brand, record } = programmeCapabilities(role, permissions);
    if (role!=='funder' && !record && !brand && !melCan(role,permissions,'analyse')) fail('Your organisation has not granted access to these records.',403);
    const root = db.collection('programme_evidence').doc(org);
    const mode=req.nextUrl.searchParams.get('mode');
    const branding = await root.collection('settings').doc('branding').get();
    if (!write && mode === 'branding') return json({ branding: branding.data()?.branding ?? blankBranding(), canBrand:brand });
    if (!write && role !== 'funder' && !record && !melCan(role, permissions, 'analyse')) {
      if (brand) return json({brandingOnly:true,sessions:[],milestones:[],people:[],assessments:[],branding:branding.data()?.branding ?? blankBranding(),canManage:false,canRecord:false,canBrand:true,sample:false,revision:''});
      fail('Training evidence access is not enabled for this account.', 403);
    }
    const team = role==='mentor' ? (await db.collection('field_teams').doc(org).collection('mentors').doc(auth.uid).get()).data() : null;
    const allowed = new Set<string>(team?.farmerIds ?? []);
    if (!write && mode==='photos') {
      const id=req.nextUrl.searchParams.get('id'); if (!validFieldId(id)) fail('Choose a training record.');
      const session=(await root.collection('sessions').doc(id!).get()).data() as TrainingRecord | undefined;
      if (!session || role==='funder' && !session.published || role==='mentor' && session.ownerId!==auth.uid) fail('Training record unavailable.',403);
      return json({ photos:(await root.collection('photos').doc(id!).get()).data()?.photos ?? [] });
    }
    if (!write) {
      const q=root.collection('sessions');
      const [sessionDocs,milestoneDocs,peopleDocs,assessmentDocs] = await Promise.all([
        (role==='mentor' ? q.where('ownerId','==',auth.uid) : role==='funder' ? q.where('published','==',true) : q).limit(501).get(),
        (role==='funder' ? root.collection('milestones').where('published','==',true) : root.collection('milestones')).limit(201).get(),
        role==='funder' ? null : db.collection('profiles').where('org_id','==',org).limit(501).get(),
        role==='funder' ? null : db.collection('mel_assessments').where('orgId','==',org).limit(201).get(),
      ]);
      if (sessionDocs.size>500 || milestoneDocs.size>200 || (peopleDocs?.size ?? 0)>500 || (assessmentDocs?.size ?? 0)>200) fail('This programme needs paginated reporting. No partial total is shown; contact the administrator.',422);
      const sessions=sessionDocs.docs.map(d=>d.data() as TrainingRecord);
      return json({ sessions:role==='funder' ? sessions.map(publishedTraining) : sessions, milestones:milestoneDocs.docs.map(d=> { const m=d.data() as ProgrammeMilestone; return role==='funder' ? {...m,owner:''} : m; }), branding:branding.data()?.branding ?? blankBranding(),
        people:peopleDocs?.docs.filter(d=>['farmer','student'].includes(d.data().role) && (role!=='mentor' || allowed.has(d.id))).map(d=>({id:d.id,name:d.data().full_name ?? 'Unnamed member'})) ?? [],
        assessments:assessmentDocs?.docs.map(d=>({id:d.id,title:d.data().title})) ?? [], canManage:manage,canRecord:record,canBrand:brand,sample:false,revision:'' });
    }
    if (role==='funder') fail('Funders can read published reports.',403);
    const raw=await req.text(); if (raw.length>800000) fail('Please use smaller images.',413);
    const b=JSON.parse(raw), now=new Date().toISOString(), today=now.slice(0,10);
    if (b.action==='branding') {
      if (!brand) fail('Manage people access is required to change organisation branding.',403);
      if (!validProgrammeBranding(b.branding)) fail('Choose names and supported PNG/JPEG logos.');
      const clean=Object.fromEntries(Object.entries(b.branding as ProgrammeBranding).map(([key,value])=>[key,{label:value.label.trim(),image:value.image}]));
      await db.runTransaction(async tx => {
        const ref=root.collection('settings').doc('branding'), old=await tx.get(ref);
        tx.set(ref,{branding:clean,updatedAt:now,updatedBy:auth.uid});
        tx.create(root.collection('history').doc(),{kind:'branding',previousNames:Object.fromEntries(Object.entries((old.data()?.branding ?? {}) as ProgrammeBranding).map(([k,v])=>[k,v.label])),nextNames:Object.fromEntries(Object.entries(clean).map(([k,v])=>[k,v.label])),actor:auth.uid,at:now});
      });
    } else if (b.action==='session') {
      if (!record || !validTrainingRecord(b.session,today)) fail('Check the session, attendance, photo captions and date.',400);
      const s=b.session as TrainingRecord; if (s.published && (!manage || b.reviewed!==true)) fail('An organisation manager must review the summary and images before sharing.',403);
      const ref=root.collection('sessions').doc(s.id);
      await db.runTransaction(async tx=> {
        const old=await tx.get(ref);
        if (old.exists && old.data()?.updatedAt!==b.expectedUpdatedAt) fail('This record changed. Reload before saving.',409);
        if (role==='mentor' && old.exists && old.data()?.ownerId!==auth.uid) fail('You can edit your own training records.',403);
        const linked= s.assessmentId ? await tx.get(db.collection('mel_assessments').doc(s.assessmentId)) : null;
        if (linked && (!linked.exists || linked.data()?.orgId!==org)) fail('Choose an assessment from this organisation.',403);
        const currentTeam=role==='mentor' ? await tx.get(db.collection('field_teams').doc(org).collection('mentors').doc(auth.uid!)) : null;
        const registeredIds=s.attendance.filter(a=>!a.id.startsWith('guest-')).map(a=>a.id);
        const members=registeredIds.length ? await tx.getAll(...registeredIds.map(id=>db.collection('profiles').doc(id))) : [];
        if (members.some(d=>!d.exists || d.data()?.org_id!==org || !['farmer','student'].includes(d.data()?.role) || role==='mentor' && !currentTeam?.data()?.farmerIds?.includes(d.id))) fail('Attendance must use members of this organisation and your assigned group.',403);
        const next:TrainingRecord={id:s.id,project:s.project.trim(),title:s.title.trim(),date:s.date,venue:s.venue.trim(),latitude:s.latitude,longitude:s.longitude,facilitator:s.facilitator.trim(),ownerId:old.data()?.ownerId ?? auth.uid!,attendance:s.attendance.map(a=>({id:a.id,name:a.name.trim(),present:a.present})),presentCount:s.attendance.filter(a=>a.present).length,registeredCount:s.attendance.length,report:s.report.trim(),nextSteps:s.nextSteps.trim(),assessmentId:s.assessmentId,published:s.published,photos:[],photoCount:s.photos.length,updatedAt:now};
        tx.set(ref,next); tx.set(root.collection('photos').doc(s.id),{photos:s.photos.map(p=>({image:p.image,caption:p.caption.trim()}))});
        tx.create(root.collection('history').doc(),{kind:'session',id:s.id,previous:old.data() ?? null,next,actor:auth.uid,at:now});
      });
    } else if (b.action==='milestone') {
      if (!manage || !validProgrammeMilestone(b.milestone,today)) fail('Management access and a valid indicator, method and dated evidence are required.');
      const m=b.milestone as ProgrammeMilestone,ref=root.collection('milestones').doc(m.id);
      await db.runTransaction(async tx=> {
        const old=await tx.get(ref); if(old.exists && old.data()?.updatedAt!==b.expectedUpdatedAt) fail('This milestone changed. Reload before saving.',409);
        const next:ProgrammeMilestone={id:m.id,project:m.project.trim(),title:m.title.trim(),...(m.category?{category:m.category}:{}),unit:m.unit.trim(),baseline:m.baseline,target:m.target,due:m.due,owner:m.owner.trim(),method:m.method.trim(),published:m.published,observations:m.observations.map(o=>{const prior=(old.data()?.observations as ProgrammeMilestone['observations'] | undefined)?.find(p=>p.date===o.date&&p.actual===o.actual&&p.evidence===o.evidence.trim());return {date:o.date,actual:o.actual,evidence:o.evidence.trim(),recordedAt:prior?.recordedAt ?? now};}),updatedAt:now};
        tx.set(ref,next);tx.create(root.collection('history').doc(),{kind:'milestone',id:m.id,previous:old.data() ?? null,next,actor:auth.uid,at:now});
      });
    } else fail('Unknown programme action.');
    return json({saved:true});
  } catch(e) { const status=e instanceof SyntaxError ? 400 : (e as {status?:number}).status ?? 503; return json({error:status===503 ? 'Programme evidence is unavailable. Your save has not been confirmed.' : (e as Error).message},status); }
}
export const GET=(req:NextRequest)=>handle(req,false);
export const POST=(req:NextRequest)=>handle(req,true);
