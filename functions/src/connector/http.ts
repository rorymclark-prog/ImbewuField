import express, { type Request, type Response, type NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { ConnectorAuth } from './auth';
import { ConnectorStorage, type Context } from './storage';
import { ConnectorMedia } from './media';
import { ConnectorRegistrations } from './registrations';
import { connectorTools } from './tools';
import { SCOPES, CUSTOMER_SCOPES, fail, identifier, hash } from './policy';

const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
export function createConnectorApp(options: { issuer: string; appOrigin: string; transferOrigin: string; store?: ConnectorStorage }) {
  const store = options.store ?? new ConnectorStorage();
  const provider = new ConnectorAuth(store, options.issuer, options.appOrigin);
  const media = new ConnectorMedia(store, options.transferOrigin);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    if (origin && ![options.appOrigin, 'https://chatgpt.com', 'https://claude.ai'].includes(origin)) { res.status(403).json({ error: 'This browser origin is not allowed.' }); return; }
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Session-Id');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; } next();
  });
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.get('/health', (_req, res) => { res.json({ service: 'ImbewuField connector', version: '1.0.0', transport: 'streamable-http', resource: provider.resource }); });
  app.get('/authorization-metadata', (_req, res) => { res.json(provider.metadata()); });
  app.get('/resource-metadata', (_req, res) => { res.json({ resource: provider.resource, authorization_servers: [provider.issuer], scopes_supported: CUSTOMER_SCOPES, resource_name: 'ImbewuField', resource_documentation: `${options.appOrigin}/connect/imbewu` }); });
  app.use('/register', clientRegistrationHandler({ clientsStore: provider.clientsStore, clientSecretExpirySeconds: 0 }));
  app.use('/authorize', authorizationHandler({ provider }));
  app.use('/token', tokenHandler({ provider }));
  app.use('/revoke', revocationHandler({ provider }));
  async function signedIn(req: Request) {
    const raw = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
    if (!raw) fail('Sign in to ImbewuField.', 401);
    try { return await getAuth().verifyIdToken(raw[1], true); } catch { return fail('Sign in again to ImbewuField.', 401); }
  }
  app.get('/account', asyncRoute(async (req, res) => {
    const user = await signedIn(req);
    const profile = (await store.db.doc(`profiles/${user.uid}`).get()).data();
    if (!profile) fail('Complete your account profile before connecting.', 403);
    const connections = (await store.db.collection('assistant_grants').where('uid', '==', user.uid).limit(251).get()).docs.map(d => ({ id: d.id, clientName: d.data().clientName, scopes: d.data().scopes, siteIds: d.data().siteIds, expiresAt: d.data().expiresAt, revoked: d.data().revoked }));
    if (connections.length > 250) fail('This account needs a filtered connection history. Contact the platform owner.', 422);
    res.json({ profile: { id: user.uid, name: profile.full_name ?? null, role: profile.role, organizationId: profile.org_id ?? null }, sites: await store.sites(user.uid), connections });
  }));
  app.get('/consent', asyncRoute(async (req, res) => {
    await signedIn(req);
    const r = await store.get('requests', identifier(req.query.request));
    if (!r || r.used || r.expiresAt <= Date.now()) fail('This request expired. Start connecting again.', 410);
    res.json({ clientName: r.clientName, callbackHost: new URL(r.redirectUri).host, scopes: r.scopes.map((id: keyof typeof SCOPES) => ({ id, description: SCOPES[id] })), expiresAt: r.expiresAt });
  }));
  app.post('/consent', asyncRoute(async (req, res) => {
    const user = await signedIn(req);
    if (typeof req.body?.approved !== 'boolean' || !Array.isArray(req.body?.siteIds) || !req.body.siteIds.every((v: unknown) => typeof v === 'string')) fail('Choose sites and a connection decision.');
    res.json({ redirect: await provider.consent(identifier(req.body.request), user.uid, req.body.siteIds, req.body.approved) });
  }));
  app.get('/site-assets', asyncRoute(async (req, res) => {
    const user = await signedIn(req), site = identifier(req.query.site);
    if (!(await store.sites(user.uid)).some(s => s.id === site)) fail('Site not found in this account.', 404);
    const rows = (await store.db.collection('assistant_assets').where('uid', '==', user.uid).limit(501).get()).docs;
    if (rows.length > 500) fail('This account needs a filtered attachment view.', 422);
    res.json({ assets: rows.map(d => d.data()).filter(a => a.siteId === site).map(({ path: _path, uid: _uid, ...a }) => a) });
  }));
  app.get('/site-registrations', asyncRoute(async (req, res) => {
    const user = await signedIn(req), site = identifier(req.query.site);
    if (!(await store.sites(user.uid)).some(s => s.id === site)) fail('Site not found in this account.', 404);
    const registrations = await new ConnectorRegistrations(store, media, options.appOrigin).forAccount(user.uid, site);
    const state = JSON.parse((await store.map(user.uid, 'design_canvas').get()).data()?.designCanvasJson ?? '{}')[site];
    res.json({ registrations, design: state ? { frame: state.frame, items: state.items, zones: state.zones, lines: state.lines } : null });
  }));
  app.get('/account-attachment', asyncRoute(async (req, res) => {
    const user = await signedIn(req);
    const a = await store.get('assets', identifier(req.query.asset));
    if (!a || a.uid !== user.uid || !(await store.sites(user.uid)).some(s => s.id === a.siteId)) fail('Attachment not found.', 404);
    const [bytes] = await store.bucket().file(a.path).download();
    if (hash(bytes) !== a.sha256) fail('Original file verification failed.', 422);
    res.set('Content-Type', a.mime); res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`); res.send(bytes);
  }));
  app.post('/disconnect', asyncRoute(async (req, res) => {
    const user = await signedIn(req); const id = identifier(req.body?.id);
    const ref = store.db.collection('assistant_grants').doc(id);
    await store.db.runTransaction(async tx => {
      const g = (await tx.get(ref)).data();
      if (!g || g.uid !== user.uid) fail('Connection not found.', 404);
      tx.update(ref, { revoked: true });
    }); res.json({ disconnected: true });
  }));
  app.put('/upload/:cap', express.raw({ type: '*/*', limit: '25mb' }), asyncRoute(async (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body : (req as Request & { rawBody?: Buffer }).rawBody;
    if (!bytes) fail('Send the original file bytes as application/octet-stream.');
    res.json(await media.upload(String(req.params.cap), bytes));
  }));
  app.get('/download/:cap', asyncRoute(async (req, res) => {
    const { metadata, file } = await media.readDownload(String(req.params.cap));
    res.set('Content-Type', metadata.mime); res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`);
    const [bytes] = await file.download();
    if (hash(bytes) !== metadata.sha256) fail('Original file verification failed.', 422);
    res.send(bytes);
  }));
  const challenge = (error: string) => `Bearer resource_metadata="${options.issuer}/resource-metadata", error="${error}", error_description="Connect or reconnect ImbewuField", scope="field:read"`;
  app.all('/mcp', asyncRoute(async (req, res) => {
    if (req.method === 'DELETE') { res.status(405).end(); return; }
    if (req.method === 'GET') { res.set('WWW-Authenticate', challenge('invalid_token')); res.status(req.get('authorization') ? 405 : 401).end(); return; }
    if (req.method !== 'POST') { res.status(405).end(); return; }
    let c: Context | null = null;
    const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
    if (token) {
      try {
        const info = await provider.verifyAccessToken(token[1]);
        if (!info.scopes.includes('field:read')) fail('field:read permission is missing.', 401);
        c = await store.context(String(info.extra.grantId));
        c = { ...c, grant: { ...c.grant, scopes: info.scopes } };
      } catch { res.set('WWW-Authenticate', challenge('invalid_token')); res.status(401).json({ error: 'Connect or reconnect ImbewuField.' }); return; }
    }
    if (!c && req.body?.method === 'tools/call') {
      res.json({ jsonrpc: '2.0', id: req.body.id ?? null, result: { isError: true, content: [{ type: 'text', text: 'Connect ImbewuField to use account tools.' }], _meta: { 'mcp/www_authenticate': [challenge('invalid_token')] } } }); return;
    }
    if (!c && !['initialize', 'notifications/initialized', 'ping', 'tools/list'].includes(req.body?.method)) { res.set('WWW-Authenticate', challenge('invalid_token')); res.status(401).end(); return; }
    const publicContext: Context = { grantId: '', grant: { uid: '', clientId: '', scopes: [], siteIds: [], orgId: null, createdAt: 0, expiresAt: 0, revoked: true }, profile: {}, operator: false };
    const server = connectorTools(store, media, c ?? publicContext, options.issuer);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport); await transport.handleRequest(req, res, req.body);
  }));
  app.use((_req, res) => { res.status(404).json({ error: 'Connector route not found.' }); });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const status = (error as { status?: number }).status ?? 503;
    res.status(status).json({ error: status >= 500 ? 'ImbewuField could not confirm the operation. Retry with the same key after checking its state.' : (error as Error).message });
  });
  return { app, provider, media, store };
}
