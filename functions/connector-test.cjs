const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw Error('Use isolated Firebase emulators. Production testing is forbidden by this probe.');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: 'fieldproof-sa', storageBucket: 'fieldproof-sa.appspot.com' });
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const db = getFirestore(), auth = getAuth();
const base = 'http://127.0.0.1:5101', resource = 'http://127.0.0.1:4246/api/assistant/mcp';
const digest = b => createHash('sha256').update(b).digest('hex');
let checks = 0;
function ok(condition, message) { assert.ok(condition, message); checks++; }
async function request(path, body, token, method) {
  const res = await fetch(base + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
  let value; try { value = await res.json(); } catch { value = null; }
  return { res, value };
}
async function login(email, password) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-connector-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await r.json(); assert.ok(data.idToken, JSON.stringify(data)); return data.idToken;
}
const fixture = { siteA: 'site:-28.12345,30.12345', siteB: 'site:-28.54321,30.54321' };
async function seed(id, role, org, operator = false) {
  const email = `${id}@connector.example.test`, password = 'Emulator-only-connector-9842';
  try { await auth.createUser({ uid: id, email, password, displayName: id }); } catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  await auth.setCustomUserClaims(id, operator ? { aiMapMaster: true } : {});
  await db.doc(`profiles/${id}`).set({ role, org_id: org, full_name: `Synthetic ${id}`, language: 'en' });
  const places = [{ id: 'fixture-a', name: 'Synthetic demonstration site', lat: -28.12345, lon: 30.12345, biome: '', rainfall: 0, elevation: 0, savedAt: '2026-01-01T00:00:00.000Z', updatedAt: 1, notes: 'Fixture data; not farming advice' }, { id: 'fixture-b', name: 'Unselected synthetic site', lat: -28.54321, lon: 30.54321, biome: '', rainfall: 0, elevation: 0, savedAt: '2026-01-01T00:00:00.000Z', updatedAt: 1 }];
  await db.doc(`user_map_data/${id}/data/places`).set({ places });
  const state = { siteId: fixture.siteA, frame: { centerLat: -28.12345, centerLng: 30.12345, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.5 }, step: 'base', updatedAt: '2026-01-01T00:00:00.000Z', rev: 1, items: [{ id: 'tank-a', defId: 'tank', x: 0.6, y: 0.3, status: 'existing' }], zones: [{ id: 'roof-a', zone: 0, feature: 'house', points: [[0.2,0.2],[0.4,0.2],[0.4,0.4],[0.2,0.4]], name: 'Synthetic roof', status: 'existing' }], lines: [] };
  await db.doc(`user_map_data/${id}/data/design_canvas`).set({ designCanvasJson: JSON.stringify({ [fixture.siteA]: state }) });
  return { id, email, password, idToken: await login(email, password) };
}
async function oauth(user, scope = 'field:read field:write field:org', selected = [fixture.siteA]) {
  const reg = await request('/register', { client_name: 'ImbewuField integration test', redirect_uris: ['http://127.0.0.1:7777/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code','refresh_token'], response_types: ['code'] });
  assert.equal(reg.res.status, 201, JSON.stringify(reg.value));
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const query = new URLSearchParams({ client_id: reg.value.client_id, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', redirect_uri: 'http://127.0.0.1:7777/callback', resource, scope, state: randomBytes(12).toString('hex') });
  const authz = await request(`/authorize?${query}`);
  assert.equal(authz.res.status, 302, JSON.stringify(authz.value));
  const consentUrl = authz.res.headers.get('location'), requestId = new URL(consentUrl).searchParams.get('request');
  const info = await request(`/consent?request=${requestId}`, null, user.idToken); assert.equal(info.res.status, 200);
  const decision = await request('/consent', { request: requestId, approved: true, siteIds: selected }, user.idToken);
  if (decision.res.status !== 200) return { decision, consentUrl };
  const code = new URL(decision.value.redirect).searchParams.get('code');
  assert.equal(new URL(decision.value.redirect).searchParams.get('state'), query.get('state'));
  const payload = { grant_type: 'authorization_code', client_id: reg.value.client_id, code, code_verifier: verifier, redirect_uri: 'http://127.0.0.1:7777/callback', resource };
  const wrong = await request('/token', { ...payload, code_verifier: randomBytes(32).toString('base64url') }); ok(wrong.res.status === 400, 'wrong PKCE refused');
  const token = await request('/token', payload); assert.equal(token.res.status, 200, JSON.stringify(token.value));
  const replay = await request('/token', payload); ok(replay.res.status === 400, 'authorization code cannot be reused');
  return { ...token.value, clientId: reg.value.client_id, consentUrl, payload, decision };
}
async function connect(tokens) {
  const client = new Client({ name: 'imbewu-connector-probe', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  return client;
}
async function tool(client, name, args = {}, expectError = false) {
  const result = await client.callTool({ name, arguments: args });
  assert.equal(Boolean(result.isError), expectError, `${name}: ${JSON.stringify(result)}`); checks++;
  if (result.structuredContent) return result.structuredContent;
  try { return JSON.parse(result.content[0].text); } catch { return { message: result.content[0].text }; }
}
(async () => {
  for (const collection of await db.listCollections()) if (collection.id.startsWith('assistant_')) await db.recursiveDelete(collection);
  const users = {};
  for (const [id, role, org, operator] of [['connector-a','farmer','org-a'],['connector-b','farmer','org-b'],['connector-ngo','ngo','org-a'],['connector-funder','funder','funder-a'],['connector-owner','admin',null,true]]) users[id] = await seed(id, role, org, operator);
  for (const id of ['org-a','org-b','funder-a']) await db.doc(`organizations/${id}`).set({ name: `Synthetic ${id}`, kind: id === 'funder-a' ? 'funder' : 'ngo' });
  await db.doc('grants/funder-a_org-a').set({ funder_org_id: 'funder-a', ngo_org_id: 'org-a' });
  for (const org of ['org-a','org-b']) {
    const common = { observedOn: '2026-01-01', vegetableM2: 20, stapleM2: 30, boundaryM2: 100, evidence: 'Synthetic measured observation', updatedAt: '2026-01-01', updatedBy: 'synthetic' };
    await db.doc(`production_sites/${org}/sites/published`).set({ ...common, code: 'published', name: 'Named synthetic garden', published: true });
    await db.doc(`production_sites/${org}/sites/private`).set({ ...common, code: 'private', name: 'Private synthetic garden', published: false });
  }
  const unauth = await request('/mcp'); ok(unauth.res.status === 401 && unauth.res.headers.get('www-authenticate').includes('resource_metadata'), 'auth discovery challenge');
  const metadata = await request('/authorization-metadata'); ok(metadata.value.code_challenge_methods_supported.includes('S256'), 'S256 discovery');
  const evil = await fetch(base + '/mcp', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }); ok(evil.status === 403, 'browser origin rejected');
  const unauthCall = await request('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_profile', arguments: {} } }); ok(unauthCall.value.result._meta['mcp/www_authenticate'].length === 1, 'native OAuth tool challenge exposed');
  const a = await oauth(users['connector-a']); const client = await connect(a);
  try {
    const list = await client.listTools(); ok(list.tools.length >= 14 && list.tools.every(t => t._meta.securitySchemes?.length), 'discoverable scoped schemas');
    ok(!list.tools.some(t => t.name === 'set_ai_map_kill_switch'), 'ordinary account has no operator tools');
    const profile = await tool(client, 'get_profile'); ok(profile.id === 'connector-a', 'stable identity');
    const sites = await tool(client, 'list_sites'); ok(sites.sites.length === 1 && sites.sites[0].id === fixture.siteA, 'only consented site appears');
    await tool(client, 'get_site', { siteId: fixture.siteB }, true);
    const site = await tool(client, 'get_site', { siteId: fixture.siteA });
    ok(site.site.name === 'Synthetic demonstration site', 'actual saved place returned');
    const summary = await tool(client, 'get_design', { siteId: fixture.siteA });
    const old = JSON.parse((await db.doc('user_map_data/connector-a/data/design_canvas').get()).data().designCanvasJson);
    const args = { siteId: fixture.siteA, section: 'zones', featureId: 'roof-a', label: 'Existing classroom', expectedRevision: summary.revision, retryKey: 'roof-label', apply: false };
    await tool(client, 'update_feature', args);
    ok(JSON.stringify(old) === (await db.doc('user_map_data/connector-a/data/design_canvas').get()).data().designCanvasJson, 'preview has no write');
    const saved = await tool(client, 'update_feature', { ...args, apply: true });
    const replay = await tool(client, 'update_feature', { ...args, apply: true }); ok(saved.revision === replay.revision, 'write retries replay original receipt');
    await tool(client, 'update_feature', { ...args, retryKey: 'stale-change', apply: true }, true);
    const changed = JSON.parse((await db.doc('user_map_data/connector-a/data/design_canvas').get()).data().designCanvasJson);
    ok(JSON.stringify(changed[fixture.siteA].zones[0].points) === JSON.stringify(old[fixture.siteA].zones[0].points), 'saved geometry is identical');
    await tool(client, 'update_feature', { ...args, section: 'items', featureId: 'tank-a', retryKey: 'species-rename', expectedRevision: saved.revision, apply: true }, true);
    await tool(client, 'update_site_notes', { siteId: fixture.siteA, notes: 'Original file reviewed in a synthetic test.', expectedUpdatedAt: 1, apply: true, retryKey: 'notes' });
    await tool(client, 'update_site_notes', { siteId: fixture.siteA, notes: 'Conflict', expectedUpdatedAt: 1, apply: true, retryKey: 'notes-conflict' }, true);
    await tool(client, 'get_organization_production', { organizationId: 'org-b' }, true);
    // Use the specifically authorised local source only against synthetic emulator records.
    const original = process.env.CONNECTOR_TEST_ORIGINAL;
    if (!original) throw Error('Set CONNECTOR_TEST_ORIGINAL to the explicitly authorised bounded source photograph.');
    const bytes = fs.readFileSync(original), sha = digest(bytes);
    const upload = await tool(client, 'prepare_upload', { siteId: fixture.siteA, retryKey: 'original-photo', name: 'historical-test-original.jpg', mime: 'image/jpeg', size: bytes.length, sha256: sha, source: { kind: 'local_file', reference: 'Authorised Ubhejane historical archive photograph; synthetic test attachment only', authorisation: 'Rory authorised this bounded source file for connector testing; real site records remain untouched.' } });
    await tool(client, 'finish_upload', { uploadId: upload.uploadId }, true);
    const bad = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('not the photo') }); ok(bad.status === 422, 'wrong bytes rejected');
    const preparationPath = '/tmp/imbewu-connector-upload-fixture.json';
    fs.writeFileSync(preparationPath,JSON.stringify(upload),{mode:0o600});
    const transfer = require('node:child_process').execFileSync(process.execPath,[require('node:path').join(__dirname,'../plugins/imbewu-field/skills/field-work/scripts/transfer-original.mjs'),original,preparationPath],{env:{...process.env,IMBEWU_CONNECTOR_EMULATOR:'1'},encoding:'utf8'});
    ok(JSON.parse(transfer).status === 'bytes_received','packaged helper transfers the exact authorised original');
    fs.unlinkSync(preparationPath);
    const finished = await tool(client, 'finish_upload', { uploadId: upload.uploadId }); ok(finished.status === 'complete', 'original imported only after verification');
    await tool(client, 'finish_upload', { uploadId: upload.uploadId });
    const attachment = await tool(client, 'get_attachment', { assetId: finished.assetId });
    const downloaded = Buffer.from(await (await fetch(attachment.downloadUrl)).arrayBuffer()); ok(digest(downloaded) === sha && downloaded.equals(bytes), 'download equals original byte for byte');
    const currentDesign = await tool(client, 'get_design', { siteId: fixture.siteA });
    const registration = await tool(client, 'prepare_photo_registration', { siteId: fixture.siteA, assetId: finished.assetId, expectedRevision: currentDesign.revision, controls: [{source:[0,0],target:[0,0]},{source:[4000,0],target:[960,0]},{source:[0,3000],target:[0,640]}], note: 'Synthetic corner fit for connector testing, not an alignment claim about the real historical site.', retryKey: 'test-registration' });
    ok(registration.status === 'needs-visual-review' && registration.rmsPixels < 1e-8, 'registration persists as an explicitly unverified historical draft');
    const registrations = await tool(client, 'list_photo_registrations', { siteId: fixture.siteA }); ok(registrations.registrations.length === 1, 'historical draft is discoverable after save');
    ok((await tool(client, 'get_design', { siteId: fixture.siteA })).revision === currentDesign.revision, 'registration never moves the saved design');
    await db.doc('render_jobs/connector-progress-fixture').set({ uid: 'connector-a', siteId: fixture.siteA, status: 'running', engine: 'gemini', sheets: [{key:'base',label:'Existing Site',status:'running'}] });
    const running = await tool(client, 'get_render_job', { jobId: 'connector-progress-fixture' }); ok(running.status === 'running' && !running.finalMapVerified, 'async job accurately reports running');
    await db.doc('render_jobs/connector-progress-fixture').update({ status: 'complete', sheets: [{key:'base',label:'Existing Site',status:'done',outputPath:'renders/connector-a/connector-progress-fixture/output-base.png'}] });
    const completed = await tool(client, 'get_render_job', { jobId: 'connector-progress-fixture' }); ok(completed.status === 'complete' && !completed.finalMapVerified, 'worker completion never claims final visual approval');
    const assets = await tool(client, 'list_attachments', { siteId: fixture.siteA }); ok(assets.assets.length === 1 && assets.assets[0].source.authorisation.includes('Rory authorised'), 'provenance persists');
    const same = await tool(client, 'prepare_upload', { siteId: fixture.siteA, retryKey: 'same-original-again', name: 'same.jpg', mime: 'image/jpeg', size: bytes.length, sha256: sha, source: { kind: 'local_file', reference: 'Same test original', authorisation: 'Bounded test fixture' } }); ok(same.deduplicated && same.assetId === finished.assetId, 'content dedup prevents duplicate attachment');
    const b = await oauth(users['connector-b']); const clientB = await connect(b);
    try { await tool(clientB, 'get_attachment', { assetId: finished.assetId }, true); } finally { await clientB.close(); }
    const nonce = digest(a.access_token);
    await db.doc(`assistant_access/${nonce}`).update({ expiresAt: Date.now() - 1 });
    const expired = await request('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, a.access_token); ok(expired.res.status === 401, 'expired access refused');
    const refresh = await request('/token', { grant_type: 'refresh_token', client_id: a.clientId, refresh_token: a.refresh_token, resource }); assert.equal(refresh.res.status, 200, JSON.stringify(refresh.value)); checks++;
    const renewed = await connect(refresh.value); try { ok((await tool(renewed, 'get_profile')).id === profile.id, 'refresh keeps stable profile identity'); } finally { await renewed.close(); }
    const reused = await request('/token', { grant_type: 'refresh_token', client_id: a.clientId, refresh_token: a.refresh_token, resource }); ok(reused.res.status === 400, 'refresh replay rejected');
    ok((await fetch(attachment.downloadUrl)).status === 401, 'revocation stops earlier file links');
  } finally { await client.close(); }
  for (const who of ['connector-ngo', 'connector-funder']) {
    const tokens = await oauth(users[who]); const c = await connect(tokens);
    try {
      const result = await tool(c, 'get_organization_production', { organizationId: 'org-a' });
      if (who === 'connector-funder') ok(!('sites' in result) && result.summary.sites === 1 && !JSON.stringify(result).includes('Private'), 'funder receives published aggregate only');
      else ok(result.sites.length === 2, 'authorised NGO sees own production observations');
      await tool(c, 'get_organization_production', { organizationId: 'org-b' }, true);
    } finally { await c.close(); }
  }
  const deniedOperator = await oauth(users['connector-a'], 'field:read field:operator'); ok(deniedOperator.decision.res.status === 403, 'profile cannot grant operator scope');
  const owner = await oauth(users['connector-owner'], 'field:read field:operator'); const operator = await connect(owner);
  try {
    const tools = await operator.listTools(); ok(tools.tools.some(t => t.name === 'get_platform_health'), 'custom-claim owner discovers diagnostics');
    const initial = await tool(operator, 'get_platform_health');
    const change = { enabled: !initial.enabled, expectedEnabled: initial.enabled, retryKey: 'owner-switch', apply: false };
    await tool(operator, 'set_ai_map_kill_switch', change);
    ok(((await db.doc('app_config/renders').get()).data()?.enabled === true) === initial.enabled, 'owner preview cannot change the global switch');
    const saved = await tool(operator, 'set_ai_map_kill_switch', { ...change, apply: true });
    const replay = await tool(operator, 'set_ai_map_kill_switch', { ...change, apply: true });
    ok(JSON.stringify(saved) === JSON.stringify(replay), 'owner retry returns the same receipt rather than applying twice');
    ok((await tool(operator, 'get_platform_health')).enabled === !initial.enabled, 'the applied owner switch is read back from app configuration');
    await tool(operator, 'set_ai_map_kill_switch', { ...change, retryKey: 'stale-owner-switch', apply: true }, true);
    await tool(operator, 'set_ai_map_kill_switch', { enabled: initial.enabled, expectedEnabled: !initial.enabled, retryKey: 'restore-owner-switch', apply: true });
    ok((await tool(operator, 'get_platform_health')).enabled === initial.enabled, 'the test restores its initial emulator switch state');
  } finally { await operator.close(); }
  const ownerReadOnly = await oauth(users['connector-owner'], 'field:read'); const ownerReader = await connect(ownerReadOnly);
  try { await tool(ownerReader, 'get_platform_health', {}, true); } finally { await ownerReader.close(); }
  const readonly = await oauth(users['connector-a'], 'field:read'); const reader = await connect(readonly);
  try { await tool(reader, 'update_site_notes', { siteId: fixture.siteA, notes: 'Forbidden', expectedUpdatedAt: 1, apply: true, retryKey: 'readonly' }, true); } finally { await reader.close(); }
  const wide = await oauth(users['connector-a']);
  const narrow = await request('/token', {grant_type:'refresh_token',client_id:wide.clientId,refresh_token:wide.refresh_token,scope:'field:read',resource});
  assert.equal(narrow.res.status,200); const narrowClient = await connect(narrow.value);
  try { await tool(narrowClient,'update_site_notes',{siteId:fixture.siteA,notes:'Forbidden downscope',expectedUpdatedAt:1,apply:true,retryKey:'narrow'},true); } finally { await narrowClient.close(); }
  const disabled = await oauth(users['connector-b']); await auth.updateUser('connector-b',{disabled:true});
  const disabledResponse = await request('/mcp',{jsonrpc:'2.0',id:11,method:'tools/list'},disabled.access_token); ok(disabledResponse.res.status===401,'disabled account loses connector access');
  await auth.updateUser('connector-b',{disabled:false});
  const wrongTenant = await oauth(users['connector-b']); await db.doc('profiles/connector-b').update({ org_id: 'org-c' });
  const changedOrg = await request('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/list' }, wrongTenant.access_token); ok(changedOrg.res.status === 401, 'tenant move forces reconnect');
  const fresh = await oauth(users['connector-a']);
  const account = await request('/account', null, users['connector-a'].idToken);
  const connection = account.value.connections.find(c => !c.revoked);
  const nativeDisconnect = await request('/disconnect', { id: connection.id }, users['connector-a'].idToken); ok(nativeDisconnect.res.status === 200, 'native account can disconnect own grant');
  fs.writeFileSync('/tmp/imbewu-connector-test-browser.json', JSON.stringify({ user: users['connector-a'], consentUrl: (await oauth(users['connector-a'])).consentUrl, resource, fixture }), { mode: 0o600 });
  console.log(JSON.stringify({ checks, outcome: 'passed', fixture: 'isolated Firebase auth/firestore/storage emulators', original: 'bounded authorised JPG, exact bytes verified', productionWrites: 0 }));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.terminate());
