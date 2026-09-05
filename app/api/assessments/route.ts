import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { analyseAssessment, canChangeOrgRole, matchedChange, melCan, validAnswers, MEL_STAGES, type MelAssessment, type MelPermission, type MelResponse, type MelStage } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import type { UserRole } from '@/lib/db/types';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const safeId = (s: unknown): s is string => typeof s === 'string' && /^[\w-]{1,128}$/.test(s);
const short = (s: unknown, max = 160): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const date = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s).getTime()) && new Date(s).toISOString().slice(0, 10) === s;

async function caller(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, 'assessments');
  if (auth.response) return { response: auth.response };
  if (!auth.uid) return { response: json({ error: 'Sign in to use project assessments.' }, 401) };
  const db = getFirestore(getApps().length ? getApp() : initializeApp());
  const [p, permission] = await Promise.all([db.collection('profiles').doc(auth.uid).get(), db.collection('org_permissions').doc(auth.uid).get()]);
  const profile = p.data();
  const selectedOrg = profile?.role === 'admin' ? req.nextUrl.searchParams.get('org') ?? profile.org_id : profile?.org_id;
  if (!profile || !safeId(selectedOrg)) return { response: json({ error: profile?.role === 'admin' ? 'Choose an organisation to review.' : 'Ask your organisation to link your account to its project.' }, 403) };
  const role = profile.role as UserRole;
  const permissions = permission.data() as MelPermission | undefined;
  return { db, uid: auth.uid, role, orgId: selectedOrg as string, permissions: permissions ?? null };
}

async function handle(req: NextRequest, write: boolean) {
  try {
    const c = await caller(req);
    if (c.response) return c.response;
    const { db, uid, role, orgId, permissions } = c;
    const can = (key: keyof MelPermission) => melCan(role, permissions, key);
    const assessment = async (id: unknown): Promise<MelAssessment> => {
      if (!safeId(id)) fail('Choose an assessment.');
      const snap = await db.collection('mel_assessments').doc(id as string).get();
      if (!snap.exists || snap.data()?.orgId !== orgId) fail('Assessment unavailable.', 403);
      return { ...snap.data(), id: snap.id } as MelAssessment;
    };
    const responseRows = async (a: MelAssessment) => {
      const rows = await db.collection('mel_assessments').doc(a.id).collection('responses').get();
      return rows.docs.map(d => d.data() as MelResponse);
    };
    if (!write) {
      const mode = req.nextUrl.searchParams.get('mode');
      if (mode === 'participants') {
        if (!can('manage')) fail('Managing assessments is restricted.', 403);
        const people = await db.collection('profiles').where('org_id', '==', orgId).limit(1001).get();
        if (people.size > 1000) fail('This participant list needs a project filter. Contact the platform administrator.', 422);
        return json({ people: people.docs.filter(p => ['farmer', 'student'].includes(p.data().role)).map(p => ({ id: p.id, name: p.data().full_name ?? 'Unnamed member' })) });
      }
      if (mode === 'published') {
        const target = req.nextUrl.searchParams.get('org') ?? orgId;
        if (!safeId(target)) fail('Choose an organisation.');
        if (role === 'funder') {
          const [grant, control] = await Promise.all([db.collection('grants').doc(`${orgId}_${target}`).get(), db.collection('organization_controls').doc(target).get()]);
          if (!(target === orgId || grant.exists) || control.data()?.funderAccess === false) fail('This organisation has not shared its dashboard with you.', 403);
        } else if (target !== orgId || !can('analyse')) fail('Access denied.', 403);
        const published = await db.collection('mel_assessments').where('orgId', '==', target).where('published', '==', true).limit(201).get();
        if (published.size > 200) fail('Choose a smaller reporting portfolio.', 422);
        return json({ assessments: await Promise.all(published.docs.map(async d => {
          const a = { ...d.data(), id: d.id } as MelAssessment;
          return { id: a.id, title: a.title, project: a.project, stage: a.stage, due: a.due, updatedAt: a.updatedAt, ...analyseAssessment(a, MEL_TEMPLATES[a.stage], await responseRows(a), true) };
        })) });
      }
      if (mode === 'people') {
        if (!['ngo', 'admin'].includes(role) || !can('people')) fail('Organisation access management is restricted.', 403);
        const [people, control] = await Promise.all([db.collection('profiles').where('org_id', '==', orgId).limit(251).get(), db.collection('organization_controls').doc(orgId).get()]);
        if (people.size > 250) fail('This organisation exceeds the 250-person access editor. Contact the platform administrator.', 422);
        const records = await Promise.all(people.docs.map(async p => {
          const permission = await db.collection('org_permissions').doc(p.id).get();
          return { id: p.id, name: p.data().full_name ?? 'Unnamed member', role: p.data().role, permissions: permission.data() ?? null };
        }));
        return json({ people: records, funderAccess: control.data()?.funderAccess !== false, selfId: uid });
      }
      if (mode === 'analysis') {
        if (!can('analyse')) fail('Assessment analysis is restricted.', 403);
        const a = await assessment(req.nextUrl.searchParams.get('id'));
        const rows = await responseRows(a);
        const compareId = req.nextUrl.searchParams.get('compare');
        let comparison = null;
        if (compareId) {
          const b = await assessment(compareId);
          const allowed = (b.stage === 'baseline' && ['midpoint', 'closeout'].includes(a.stage)) || (b.stage === 'course_before' && a.stage === 'course_after') || (b.stage === 'app_midpoint' && a.stage === 'app_closeout');
          if (!allowed || b.project !== a.project) fail('Compare matching stages from the same project.');
          const earlier = await responseRows(b);
          comparison = MEL_TEMPLATES[a.stage].questions.filter(q => q.kind === 'number' || (q.options?.every(o => o.value === 'na' || Number.isFinite(Number(o.value))) ?? false)).map(q => ({ id: q.id, en: q.en + (q.kind === 'choice' ? ' (self-reported score)' : ''), ...matchedChange(b, a, earlier, rows, q.id) }));
        }
        return json({ assessment: a, ...analyseAssessment(a, MEL_TEMPLATES[a.stage], rows), comparison,
          comments: rows.flatMap(r => MEL_TEMPLATES[a.stage].questions.filter(q => q.kind === 'text' && r.answers[q.id]?.trim()).map(q => ({ question: q.en, text: r.answers[q.id] }))),
          funderPreview: analyseAssessment(a, MEL_TEMPLATES[a.stage], rows, true) });
      }
      const staff = can('manage') || can('analyse');
      if (role === 'funder') fail('Use approved funder summaries.', 403);
      const query = db.collection('mel_assessments').where('orgId', '==', orgId);
      const snap = await (staff ? query : query.where('participantIds', 'array-contains', uid)).limit(201).get();
      if (snap.size > 200) fail('This assessment list exceeds 200 entries. Contact your programme administrator.', 422);
      const list = await Promise.all(snap.docs.map(async d => {
        const a = { ...d.data(), id: d.id } as MelAssessment;
        if (!staff && a.state === 'draft') return null;
        if (staff) {
          const count = await d.ref.collection('responses').count().get();
          return { ...a, assigned: a.participantIds.length, completed: count.data().count };
        }
        const r = await d.ref.collection('responses').doc(uid).get();
        return { id: a.id, title: a.title, project: a.project, stage: a.stage, due: a.due, state: a.state, response: r.exists ? r.data() : null };
      }));
      return json({ assessments: list.filter(Boolean), permissions: { manage: can('manage'), analyse: can('analyse'), people: ['ngo', 'admin'].includes(role) && can('people') } });
    }
    const raw = await req.text();
    if (raw.length > 40000) fail('This assessment request is too large.', 413);
    const b = JSON.parse(raw);
    const now = new Date().toISOString();
    if (b.action === 'withdraw') {
      const a = await assessment(b.id);
      if (!a.participantIds.includes(uid)) fail('This assessment is not assigned to your account.', 403);
      await db.collection('mel_assessments').doc(a.id).collection('responses').doc(uid).delete();
      return json({ saved: true });
    }
    if (b.action === 'respond') {
      if (!safeId(b.id)) fail('Choose an assessment.');
      const ref = db.collection('mel_assessments').doc(b.id);
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const a = snap.data() as MelAssessment | undefined;
        if (!a || a.orgId !== orgId || a.state !== 'open' || !a.participantIds.includes(uid)) fail('This assessment is not open for your account.', 403);
        if (b.consent !== true || !['en', 'zu'].includes(b.language) || !validAnswers(MEL_TEMPLATES[a.stage], b.answers) || !Object.values(b.answers).some(v => typeof v === 'string' && v.trim())) fail('Agree to the assessment notice and answer at least one question.');
        // Deterministic ID + transaction: retries replace one response, never inflate completion.
        tx.set(ref.collection('responses').doc(uid), { assessmentId: b.id, participantId: uid, orgId, version: a.version, language: b.language, consent: true, answers: b.answers, submittedAt: now } satisfies MelResponse);
      });
      return json({ saved: true });
    }
    if (b.action === 'person' || b.action === 'sharing') {
      if (!['ngo', 'admin'].includes(role) || !can('people')) fail('Organisation access management is restricted.', 403);
      if (b.action === 'sharing') {
        if (typeof b.funderAccess !== 'boolean') fail('Choose whether funder access is enabled.');
        const batch = db.batch();
        batch.set(db.collection('organization_controls').doc(orgId), { funderAccess: b.funderAccess, updatedBy: uid, updatedAt: now }, { merge: true });
        batch.create(db.collection('org_access_audit').doc(), { orgId, actor: uid, action: 'funder_access', enabled: b.funderAccess, at: now });
        await batch.commit(); return json({ saved: true });
      }
      if (!safeId(b.id) || !b.permissions || (b.permissions.training !== undefined && typeof b.permissions.training !== 'boolean') || !['manage', 'analyse', 'people'].every(k => typeof b.permissions[k] === 'boolean')) fail('Choose a member and their permissions.');
      await db.runTransaction(async tx => {
        const ref = db.collection('profiles').doc(b.id);
        const target = (await tx.get(ref)).data();
        if (!target || !canChangeOrgRole({ id: uid, role, orgId }, { id: b.id, role: target.role, orgId: target.org_id }, b.role)) fail('You can change another member of your NGO, but cannot assign platform or funder powers.', 403);
        const previousPermissions = (await tx.get(db.collection('org_permissions').doc(b.id))).data();
        tx.update(ref, { role: b.role });
        tx.set(db.collection('org_permissions').doc(b.id), { manage: b.permissions.manage, analyse: b.permissions.analyse, people: b.permissions.people, training: b.permissions.training ?? previousPermissions?.training ?? (b.role === 'ngo') });
        tx.create(db.collection('org_access_audit').doc(), { orgId, actor: uid, target: b.id, action: 'member_access', previousRole: target.role, role: b.role, permissions: b.permissions, at: now });
      }); return json({ saved: true });
    }
    if (!can('manage')) fail('Managing assessments is restricted.', 403);
    if (b.action === 'create') {
      if (!MEL_STAGES.includes(b.stage) || !short(b.project) || !short(b.title) || !date(b.due)) fail('Choose a stage, project, title and valid due date.');
      const created = await db.collection('mel_assessments').add({ orgId, project: b.project.trim(), title: b.title.trim(), stage: b.stage as MelStage, version: 1, due: b.due, participantIds: [], state: 'draft', published: false, createdAt: now, updatedAt: now, createdBy: uid, action: '', actionOwner: '', actionDue: '', actionDone: false });
      return json({ id: created.id }, 201);
    }
    const a = await assessment(b.id);
    const ref = db.collection('mel_assessments').doc(a.id);
    if (b.action === 'open') {
      if (a.state !== 'draft') fail('Only a draft can be assigned.');
      // The explicit selection is frozen when opened, so later joiners do not silently
      // change the denominator or gain access to an earlier cohort's assessment.
      if (!Array.isArray(b.participantIds) || !b.participantIds.length || b.participantIds.length > 250 || !b.participantIds.every(safeId)) fail('Select between 1 and 250 participants.');
      const ids = [...new Set<string>(b.participantIds)];
      const people = await db.getAll(...ids.map(id => db.collection('profiles').doc(id)));
      if (people.some(p => !p.exists || p.data()?.org_id !== orgId || !['farmer', 'student'].includes(p.data()?.role))) fail('Only farmers and students in your organisation can be assigned.', 403);
      await db.runTransaction(async tx => {
        const latest = await tx.get(ref);
        if (latest.data()?.state !== 'draft') fail('This assessment has already been opened.', 409);
        tx.update(ref, { state: 'open', participantIds: ids, updatedAt: now });
      });
    } else if (b.action === 'close') {
      await ref.update({ state: 'closed', updatedAt: now });
    } else if (b.action === 'publish') {
      if (typeof b.published !== 'boolean' || (b.published && a.state !== 'closed')) fail('Close the assessment before publishing its summary.');
      await ref.update({ published: b.published, updatedAt: now, publishedBy: uid });
    } else if (b.action === 'learning') {
      if (typeof b.text !== 'string' || b.text.length > 2000 || typeof b.owner !== 'string' || b.owner.length > 160 || (b.due !== '' && !date(b.due)) || typeof b.done !== 'boolean') fail('Check the learning action, owner and due date.');
      await ref.update({ action: b.text, actionOwner: b.owner, actionDue: b.due, actionDone: b.done, updatedAt: now });
    } else fail('Unknown assessment action.');
    return json({ saved: true });
  } catch (e) {
    const status = e instanceof SyntaxError ? 400 : (e as { status?: number }).status ?? 503;
    // No raw responses, request bodies or tokens in logs.
    return json({ error: status === 503 ? 'Assessment service unavailable. Your changes have not been confirmed.' : (e as Error).message }, status);
  }
}
export const GET = (req: NextRequest) => handle(req, false);
export const POST = (req: NextRequest) => handle(req, true);
