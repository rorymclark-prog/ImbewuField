import type { Response } from 'express';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { ConnectorStorage, type Grant } from './storage';
import { getAuth } from 'firebase-admin/auth';
import { SCOPES, CUSTOMER_SCOPES, scopes, safeRedirect, secret, hash, fail } from './policy';

export class ConnectorAuth implements OAuthServerProvider {
  readonly resource: string;
  constructor(readonly store: ConnectorStorage, readonly issuer: string, readonly appOrigin: string) { this.resource = `${issuer}/mcp`; }
  get clientsStore() {
    return {
      getClient: async (id: string) => await this.store.get('clients', id) as OAuthClientInformationFull | undefined,
      registerClient: async (client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>) => {
        if (!client.redirect_uris.length || client.redirect_uris.length > 10 || !client.redirect_uris.every(safeRedirect)) throw new InvalidClientMetadataError('Use HTTPS callbacks or an HTTP loopback callback.');
        if (client.token_endpoint_auth_method !== 'none') throw new InvalidClientMetadataError('This connector uses public clients with PKCE (token_endpoint_auth_method: none).');
        const info: OAuthClientInformationFull = { ...client, client_id: secret(), client_id_issued_at: Math.floor(Date.now() / 1000), client_name: (client.client_name ?? 'MCP assistant').slice(0, 100) };
        // No expiring per-client secret: reconnect must not fail because a registration aged out.
        delete info.client_secret; delete info.client_secret_expires_at;
        await this.store.put('clients', info.client_id, info); return info;
      },
    };
  }
  private target(resource?: URL) {
    if (resource?.href !== this.resource) throw new InvalidTargetError('resource must identify this ImbewuField MCP endpoint.');
  }
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    this.target(params.resource);
    let requested: string[];
    try { requested = scopes(params.scopes); } catch { throw new InvalidScopeError('Choose supported ImbewuField scopes.'); }
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidGrantError('S256 PKCE is required.');
    const requestId = secret();
    await this.store.put('requests', requestId, { clientId: client.client_id, clientName: client.client_name ?? 'MCP assistant', scopes: requested, redirectUri: params.redirectUri, state: params.state ?? '', challenge: params.codeChallenge, expiresAt: Date.now() + 10 * 60_000, used: false });
    res.redirect(`${this.appOrigin}/connect/imbewu?request=${encodeURIComponent(requestId)}`);
  }
  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const row = await this.store.get('codes', code);
    if (!row || row.clientId !== client.client_id || row.used || row.expiresAt <= Date.now()) throw new InvalidGrantError('Code expired or already used.');
    return row.challenge as string;
  }
  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL) {
    this.target(resource);
    const row = await this.store.get('codes', code);
    if (!row) throw new InvalidGrantError('Code unavailable.');
    try { await this.store.context(row.grantId); } catch { throw new InvalidGrantError('Connection unavailable. Reconnect.'); }
    return this.store.db.runTransaction(async tx => {
      const ref = this.store.ref('codes', code);
      const current = (await tx.get(ref)).data();
      if (!current || current.clientId !== client.client_id || current.used || current.expiresAt <= Date.now() || current.redirectUri !== redirectUri) throw new InvalidGrantError('Code expired, used or does not match this callback.');
      const grant = (await tx.get(this.store.ref('grants', current.grantId))).data();
      if (!grant || grant.revoked || grant.expiresAt <= Date.now()) throw new InvalidGrantError('Connection revoked.');
      tx.update(ref, { used: true });
      return this.store.issueTokens(current.grantId, client.client_id, current.scopes, tx);
    });
  }
  async exchangeRefreshToken(client: OAuthClientInformationFull, token: string, requested?: string[], resource?: URL) {
    this.target(resource);
    const initial = await this.store.get('refresh', token);
    if (!initial) throw new InvalidGrantError('Refresh token unavailable. Reconnect.');
    try { await this.store.context(initial.grantId); } catch { throw new InvalidGrantError('Connection unavailable. Reconnect.'); }
    const result = await this.store.db.runTransaction(async tx => {
      const ref = this.store.ref('refresh', token);
      const row = (await tx.get(ref)).data();
      if (!row || row.clientId !== client.client_id || row.expiresAt <= Date.now()) throw new InvalidGrantError('Refresh token expired or belongs to a different client.');
      const grantRef = this.store.ref('grants', row.grantId);
      const grant = (await tx.get(grantRef)).data();
      if (!grant || grant.revoked || grant.expiresAt <= Date.now()) throw new InvalidGrantError('Connection revoked.');
      if (row.used) { tx.update(grantRef, { revoked: true }); return null; }
      const selected = requested ?? row.scopes as string[];
      if (selected.some((s: string) => !row.scopes.includes(s))) throw new InvalidScopeError('Refresh cannot add permissions. Reconnect to request them.');
      tx.update(ref, { used: true });
      return this.store.issueTokens(row.grantId, client.client_id, selected, tx);
    });
    if (!result) throw new InvalidGrantError('Refresh token replay detected. Reconnect.');
    return result;
  }
  async verifyAccessToken(token: string) {
    const row = await this.store.get('access', token);
    if (!row || row.expiresAt <= Date.now()) throw new InvalidTokenError('Access token expired. Refresh or reconnect ImbewuField.');
    try { await this.store.context(row.grantId); } catch { throw new InvalidTokenError('Connection unavailable. Reconnect ImbewuField.'); }
    return { token, clientId: row.clientId as string, scopes: row.scopes as string[], expiresAt: Math.floor(row.expiresAt / 1000), resource: new URL(this.resource), extra: { grantId: row.grantId } };
  }
  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    for (const kind of ['access', 'refresh']) {
      const row = await this.store.get(kind, request.token);
      if (row?.clientId === client.client_id) await this.store.ref('grants', row.grantId).update({ revoked: true });
    }
  }
  async consent(requestId: string, uid: string, selectedSites: string[], approved: boolean) {
    const request = await this.store.get('requests', requestId);
    if (!request || request.used || request.expiresAt <= Date.now()) fail('This connection request expired. Start connecting again.', 410);
    const profile = (await this.store.db.doc(`profiles/${uid}`).get()).data();
    if (!profile) fail('Complete your ImbewuField account first.', 403);
    if (request.scopes.includes('field:operator') && (await getAuth().getUser(uid)).customClaims?.aiMapMaster !== true) fail('Platform owner permission is required for operator access.', 403);
    const actual = await this.store.sites(uid);
    if (selectedSites.length > 250 || selectedSites.some(s => !actual.some(a => a.id === s))) fail('Select sites in this account.', 403);
    const grantId = secret(), code = secret();
    const now = Date.now();
    const grant: Grant = { uid, clientId: request.clientId, scopes: request.scopes, siteIds: [...new Set(selectedSites)], orgId: profile.org_id ?? null, createdAt: now, expiresAt: now + 90 * 86400000, revoked: false };
    await this.store.db.runTransaction(async tx => {
      const ref = this.store.ref('requests', requestId);
      const current = (await tx.get(ref)).data();
      if (!current || current.used || current.expiresAt <= Date.now()) fail('Connection request expired or already answered.', 410);
      tx.update(ref, { used: true });
      if (approved) {
        tx.set(this.store.ref('grants', grantId), { ...grant, id: hash(grantId), clientName: request.clientName });
        tx.set(this.store.ref('codes', code), { grantId, clientId: request.clientId, scopes: request.scopes, challenge: request.challenge, redirectUri: request.redirectUri, expiresAt: now + 60_000, used: false });
      }
    });
    const callback = new URL(request.redirectUri);
    callback.searchParams.set(approved ? 'code' : 'error', approved ? code : 'access_denied');
    if (request.state) callback.searchParams.set('state', request.state);
    callback.searchParams.set('iss', this.issuer);
    return callback.href;
  }
  metadata() {
    return { issuer: this.issuer, authorization_endpoint: `${this.issuer}/authorize`, token_endpoint: `${this.issuer}/token`, registration_endpoint: `${this.issuer}/register`, revocation_endpoint: `${this.issuer}/revoke`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: CUSTOMER_SCOPES };
  }
}
