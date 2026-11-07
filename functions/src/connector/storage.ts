import { getFirestore, type Firestore, type Transaction, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { fail, hash, secret, siteId, parseStore, assertSite, identifier } from './policy';

export type Grant = { uid: string; clientId: string; scopes: string[]; siteIds: string[]; orgId: string | null; createdAt: number; expiresAt: number; revoked: boolean };
export type Context = { grant: Grant; grantId: string; profile: Record<string, any>; operator: boolean };
export class ConnectorStorage {
  constructor(readonly db: Firestore = getFirestore()) {}
  ref(kind: string, id: string) { return this.db.collection(`assistant_${kind}`).doc(hash(id)); }
  async get(kind: string, id: string) { return (await this.ref(kind, id).get()).data(); }
  async put(kind: string, id: string, value: object) { await this.ref(kind, id).set(JSON.parse(JSON.stringify(value))); }
  map(uid: string, name: string) { return this.db.doc(`user_map_data/${identifier(uid)}/data/${name}`); }
  async context(grantId: string): Promise<Context> {
    const grant = await this.get('grants', grantId) as Grant | undefined;
    if (!grant || grant.revoked || grant.expiresAt <= Date.now()) fail('Connection expired or revoked. Reconnect ImbewuField.', 401);
    const user = await getAuth().getUser(grant.uid);
    if (user.disabled || Date.parse(user.tokensValidAfterTime ?? '') > grant.createdAt) fail('Account access was revoked. Reconnect ImbewuField.', 401);
    const profile = (await this.db.doc(`profiles/${grant.uid}`).get()).data();
    if (!profile) fail('Complete your ImbewuField account profile before connecting.', 403);
    // A connection cannot follow a person into a different tenant without fresh consent.
    if ((profile.org_id ?? null) !== grant.orgId) fail('Organisation membership changed. Reconnect ImbewuField.', 401);
    return { grant, grantId, profile, operator: user.customClaims?.aiMapMaster === true };
  }
  async sites(uid: string) {
    const [places, canvas] = await Promise.all([this.map(uid, 'places').get(), this.map(uid, 'design_canvas').get()]);
    const rows: Record<string, { id: string; name: string; lat: number; lon: number; placeId: string | null; hasDesign: boolean }> = {};
    const store = parseStore(canvas.data()?.designCanvasJson);
    for (const p of places.data()?.places ?? []) {
      if (typeof p.lat === 'number' && Number.isFinite(p.lat) && typeof p.lon === 'number' && Number.isFinite(p.lon)) {
        const id = siteId(p); rows[id] = { id, name: String(p.name ?? 'Unnamed site'), lat: p.lat, lon: p.lon, placeId: p.id, hasDesign: Boolean(store[id]) };
      }
    }
    for (const [id, state] of Object.entries(store)) {
      if (rows[id] || !/^site:-?\d+\.\d{5},-?\d+\.\d{5}$/.test(id)) continue;
      const [lat, lon] = id.slice(5).split(',').map(Number);
      rows[id] = { id, name: String(state.name ?? id), lat, lon, placeId: null, hasDesign: true };
    }
    return Object.values(rows);
  }
  async requireSite(c: Context, id: string) {
    assertSite(c.grant, id);
    const site = (await this.sites(c.grant.uid)).find(s => s.id === id);
    if (!site) fail('Site no longer exists in this account.', 404);
    return site;
  }
  async once(c: Context, key: string, operation: string, input: object, run: (tx: Transaction) => Promise<object>) {
    identifier(key);
    const ref = this.ref('receipts', `${c.grant.uid}:${operation}:${key}`);
    const fingerprint = hash(JSON.stringify(input));
    return this.db.runTransaction(async tx => {
      const old = (await tx.get(ref)).data();
      if (old) { if (old.fingerprint !== fingerprint) fail('This retry key was already used for a different request.', 409); return old.result as object; }
      const currentGrant = (await tx.get(this.ref('grants', c.grantId))).data();
      const currentProfile = (await tx.get(this.db.doc(`profiles/${c.grant.uid}`))).data();
      if (!currentProfile || (currentProfile.org_id ?? null) !== c.grant.orgId) fail('Organisation membership changed. Reconnect.', 401);
      if (!currentGrant || currentGrant.revoked || currentGrant.expiresAt <= Date.now()) fail('Connection expired or revoked.', 401);
      const result = JSON.parse(JSON.stringify(await run(tx))) as object;
      tx.set(ref, { uid: c.grant.uid, operation, fingerprint, result, createdAt: Date.now(), expiresAt: Date.now() + 90 * 86400000 });
      tx.set(this.db.collection('assistant_audit').doc(), { uid: c.grant.uid, grant: hash(c.grantId), operation, createdAt: FieldValue.serverTimestamp() });
      return result;
    });
  }
  bucket() { return getStorage().bucket(); }
  async issueTokens(grantId: string, clientId: string, tokenScopes: string[], tx: Transaction) {
    const access = secret(), refresh = secret();
    const createdAt = Date.now();
    tx.set(this.ref('access', access), { grantId, clientId, scopes: tokenScopes, expiresAt: createdAt + 3600_000 });
    tx.set(this.ref('refresh', refresh), { grantId, clientId, scopes: tokenScopes, expiresAt: createdAt + 30 * 86400000 });
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope: tokenScopes.join(' ') };
  }
}
