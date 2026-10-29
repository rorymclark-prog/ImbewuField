import { onRequest } from 'firebase-functions/v2/https';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { AI_MAP_ROLES, canManageAiMapOrganization, decideManagedAiRenderAccess, type AiMapPolicyContext } from '../../lib/ai-render/access';

const safeId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,128}$/.test(id);
function fail(message: string, status = 403): never { throw Object.assign(new Error(message), { status }); }

// Used by both the settings service and the job worker. These documents are server-only under
// the existing rules; a writable profile, request body or role preview cannot issue a grant.
export async function loadAiMapContext(db: Firestore, user: UserRecord, tx?: Transaction) {
  const read = (ref: DocumentReference) => tx ? tx.get(ref) : ref.get();
  const [config, profile, personal, member, permissions] = await Promise.all([
    read(db.doc('app_config/renders')), read(db.doc(`profiles/${user.uid}`)),
    read(db.doc(`ai_map_accounts/${user.uid}`)), read(db.doc(`ai_map_members/${user.uid}`)),
    read(db.doc(`org_permissions/${user.uid}`)),
  ]);
  const p = profile.data();
  const orgId = safeId(p?.org_id) ? p.org_id : null;
  const org = orgId ? (await read(db.doc(`ai_map_organizations/${orgId}`))).data() : undefined;
  const policy: AiMapPolicyContext = {
    uid: user.disabled ? null : user.uid,
    master: !user.disabled && user.customClaims?.aiMapMaster === true,
    tester: !user.disabled && user.customClaims?.aiRenderTester === true,
    enabled: config.data()?.enabled === true,
    personalEnabled: personal.data()?.enabled === true,
    personalGranted: personal.data()?.granted === true,
    role: typeof p?.role === 'string' ? p.role : null, orgId,
    orgEnabled: org?.enabled === true,
    orgRoles: Array.isArray(org?.roles) ? org.roles.filter((r: unknown) => typeof r === 'string' && (AI_MAP_ROLES as readonly string[]).includes(r)) : [],
    memberGrant: orgId && member.data()?.orgId === orgId && typeof member.data()?.granted === 'boolean' ? member.data()!.granted as boolean : null,
  };
  return { policy, people: permissions.data()?.people ?? p?.role === 'ngo' };
}

export const aiMapAccess = onRequest({ region: 'europe-west1', invoker: 'public', maxInstances: 3, timeoutSeconds: 60 }, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
    const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
    if (!token) fail('Sign in to manage AI glossy maps.', 401);
    const verified = await getAuth().verifyIdToken(token[1], true).catch(() => fail('Sign in again to manage AI glossy maps.', 401));
    const user = await getAuth().getUser(verified.uid);
    if (user.disabled) fail('This account is disabled.', 401);
    const db = getFirestore();
    if (req.method === 'POST') {
      const b = req.body;
      if (!b || typeof b !== 'object' || Array.isArray(b)) fail('Choose a settings action.', 400);
      await db.runTransaction(async tx => {
        const { policy: c, people } = await loadAiMapContext(db, user, tx);
        const actor = { role: c.role, orgId: c.orgId, people: people === true };
        let target: DocumentReference;
        let change: Record<string, unknown>;
        if (b.action === 'personal' && typeof b.enabled === 'boolean') {
          target = db.doc(`ai_map_accounts/${user.uid}`); change = { enabled: b.enabled };
        } else if (b.action === 'global' && c.master && typeof b.enabled === 'boolean') {
          target = db.doc('app_config/renders'); change = { enabled: b.enabled };
        } else if (b.action === 'organization' && c.master && safeId(b.orgId) && typeof b.enabled === 'boolean') {
          if (!(await tx.get(db.doc(`organizations/${b.orgId}`))).exists) fail('Organisation not found.', 404);
          target = db.doc(`ai_map_organizations/${b.orgId}`); change = { enabled: b.enabled };
        } else if (b.action === 'roles' && safeId(b.orgId) && canManageAiMapOrganization(c.master, actor, b.orgId)) {
          const org = await tx.get(db.doc(`ai_map_organizations/${b.orgId}`));
          if (!c.master && org.data()?.enabled !== true) fail('The platform has disabled AI maps for this organisation.');
          if (!(await tx.get(db.doc(`organizations/${b.orgId}`))).exists) fail('Organisation not found.', 404);
          if (!Array.isArray(b.roles) || b.roles.length > AI_MAP_ROLES.length || !b.roles.every((r: unknown) => (AI_MAP_ROLES as readonly unknown[]).includes(r))) fail('Choose valid member roles.', 400);
          target = db.doc(`ai_map_organizations/${b.orgId}`); change = { roles: [...new Set(b.roles)] };
        } else if (b.action === 'member' && safeId(b.orgId) && safeId(b.uid) && canManageAiMapOrganization(c.master, actor, b.orgId)) {
          const [org, person] = await Promise.all([tx.get(db.doc(`ai_map_organizations/${b.orgId}`)), tx.get(db.doc(`profiles/${b.uid}`))]);
          if (!c.master && org.data()?.enabled !== true) fail('The platform has disabled AI maps for this organisation.');
          if (person.data()?.org_id !== b.orgId) fail('This member does not belong to this organisation.');
          if (b.granted !== null && typeof b.granted !== 'boolean') fail('Choose an individual access rule.', 400);
          target = db.doc(`ai_map_members/${b.uid}`); change = { orgId: b.orgId, granted: b.granted };
        } else fail('You cannot change this AI map permission.');
        tx.set(target, { ...change, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(db.collection('ai_map_audit').doc(), { action: b.action, target: target.path, change, actor: user.uid, createdAt: FieldValue.serverTimestamp() });
      });
      res.json({ saved: true }); return;
    }
    const { policy: c, people } = await loadAiMapContext(db, user);
    const access = decideManagedAiRenderAccess(c);
    if (req.query.mode !== 'settings') { res.json(access); return; }
    const orgs = c.master ? await db.collection('organizations').limit(251).get() : null;
    if (orgs && orgs.size > 250) fail('Filter the organisation list before managing AI access.', 422);
    const ids = c.master ? orgs!.docs.map(d => d.id) : c.orgId ? [c.orgId] : [];
    const actor = { role: c.role, orgId: c.orgId, people: people === true };
    const canManage = c.master || Boolean(c.orgId && canManageAiMapOrganization(false, actor, c.orgId));
    const organizations = canManage ? await Promise.all(ids.map(async id => {
      const [org, policy] = await Promise.all([db.doc(`organizations/${id}`).get(), db.doc(`ai_map_organizations/${id}`).get()]);
      return { id, name: org.data()?.name ?? 'Unnamed organisation', enabled: policy.data()?.enabled === true, roles: policy.data()?.roles ?? [] };
    })) : [];
    organizations.sort((a, b) => a.name.localeCompare(b.name));
    const selectedOrg = typeof req.query.org === 'string' ? req.query.org : organizations[0]?.id;
    if (selectedOrg && !ids.includes(selectedOrg)) fail('Organisation access is restricted.');
    let members: { id: string; name: string; role: string; granted: boolean | null }[] = [];
    if (canManage && selectedOrg) {
      const rows = await db.collection('profiles').where('org_id', '==', selectedOrg).limit(501).get();
      if (rows.size > 500) fail('This organisation needs a filtered member list. Contact the platform administrator.', 422);
      members = await Promise.all(rows.docs.map(async d => {
        const permission = (await db.doc(`ai_map_members/${d.id}`).get()).data();
        return { id: d.id, name: d.data().full_name ?? 'Unnamed member', role: d.data().role ?? 'farmer', granted: permission?.orgId === selectedOrg && typeof permission.granted === 'boolean' ? permission.granted : null };
      }));
    }
    res.json({ access, master: c.master, canManage, globalEnabled: c.enabled, personalEnabled: c.personalEnabled, organizations, selectedOrg: selectedOrg ?? null, members });
  } catch (e) {
    const status = typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : 503;
    res.status(status).json({ error: status === 503 ? 'AI map settings are temporarily unavailable. Nothing has been enabled.' : (e as Error).message });
  }
});
