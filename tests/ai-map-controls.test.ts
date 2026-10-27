import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import typescript from 'typescript';
import { decideManagedAiRenderAccess, canManageAiMapOrganization, type AiMapPolicyContext } from '../lib/ai-render/access.ts';
import * as policy from '../lib/ai-render/access.ts';
import React from 'react';
import { createRequire } from 'node:module';
import TestRenderer, { act } from 'react-test-renderer';

const base: AiMapPolicyContext = { uid: 'farmer', master: false, tester: false, enabled: true, personalEnabled: true, personalGranted: false, role: 'farmer', orgId: 'org-a', orgEnabled: true, orgRoles: ['farmer'], memberGrant: null };

test('organisation suspension beats every tenant grant, including legacy tester claims', () => {
  for (const tester of [false, true]) for (const memberGrant of [null, false, true]) {
    assert.equal(decideManagedAiRenderAccess({ ...base, tester, memberGrant, orgEnabled: false }).reason, 'organization-disabled');
  }
});
test('personal spending requires opt-in even for the master account', () => {
  for (const master of [false, true]) assert.equal(decideManagedAiRenderAccess({ ...base, master, personalEnabled: false }).reason, 'personal-off');
  assert.equal(decideManagedAiRenderAccess({ ...base, master: true, enabled: false }).reason, 'disabled');
  assert.equal(decideManagedAiRenderAccess({ ...base, master: true, orgEnabled: false }).allowed, true);
  assert.equal(decideManagedAiRenderAccess({ ...base, master: true, uid: null }).allowed, false);
});
test('member blocks beat role grants, and individual grants can admit only their current tenant', () => {
  assert.equal(decideManagedAiRenderAccess({ ...base, memberGrant: false }).allowed, false);
  assert.equal(decideManagedAiRenderAccess({ ...base, orgRoles: [], memberGrant: true }).allowed, true);
  assert.equal(decideManagedAiRenderAccess({ ...base, role: 'mentor' }).allowed, false);
  assert.equal(decideManagedAiRenderAccess({ ...base, orgId: null }).allowed, false);
  assert.equal(decideManagedAiRenderAccess({ ...base, orgId: null, personalGranted: true }).allowed, true);
});
test('only the master or trusted people managers in the same organisation may delegate', () => {
  for (const role of ['farmer', 'mentor', 'student', 'funder', 'admin']) assert.equal(canManageAiMapOrganization(false, { role, orgId: 'org-a', people: true }, 'org-a'), false);
  assert.equal(canManageAiMapOrganization(false, { role: 'ngo', orgId: 'org-a', people: true }, 'org-b'), false);
  assert.equal(canManageAiMapOrganization(false, { role: 'ngo', orgId: 'org-a', people: false }, 'org-a'), false);
  assert.equal(canManageAiMapOrganization(false, { role: 'ngo', orgId: 'org-a', people: true }, 'org-a'), true);
});

// Execute the deployed HTTP handler with an in-memory database, rather than asserting that
// its source contains an authorization word. Removing any checked guard must change a result.
function service() {
  const records = new Map<string, Record<string, unknown>>([
    ['app_config/renders', { enabled: true }],
    ['profiles/master', { role: 'admin', org_id: null }],
    ['profiles/manager', { role: 'ngo', org_id: 'org-a' }],
    ['profiles/farmer', { role: 'farmer', org_id: 'org-a' }],
    ['profiles/other', { role: 'farmer', org_id: 'org-b' }],
    ['organizations/org-a', { name: 'Org A' }], ['organizations/org-b', { name: 'Org B' }],
    ['ai_map_organizations/org-a', { enabled: true, roles: ['farmer'] }],
    ['ai_map_accounts/master', { enabled: true }], ['ai_map_accounts/farmer', { enabled: true }],
  ]);
  const users = new Map(['master', 'manager', 'farmer', 'other'].map(uid => [uid, { uid, disabled: false, customClaims: uid === 'master' ? { aiMapMaster: true } : {} }]));
  let counter = 0;
  const doc = (path: string): any => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path) });
  const snapshot = (path: string): any => ({ ...doc(path), exists: records.has(path), data: () => records.get(path) });
  const collection = (path: string, filter?: [string, unknown], limit = Infinity): any => ({
    doc: (id = `audit-${++counter}`) => doc(`${path}/${id}`),
    where: (key: string, _op: string, value: unknown) => collection(path, [key, value], limit),
    limit: (n: number) => collection(path, filter, n),
    get: async () => {
      const docs = [...records.keys()].filter(p => p.startsWith(`${path}/`) && p.split('/').length === path.split('/').length + 1)
        .filter(p => !filter || records.get(p)?.[filter[0]] === filter[1]).slice(0, limit).map(snapshot);
      return { docs, size: docs.length };
    },
  });
  const db = { doc, collection, runTransaction: async (fn: (tx: any) => unknown) => {
    const writes: [string, Record<string, unknown>][] = [];
    await fn({ get: (ref: any) => ref.get(), set: (ref: any, value: Record<string, unknown>) => writes.push([ref.path, value]) });
    for (const [path, value] of writes) records.set(path, { ...records.get(path), ...value });
  } };
  const dependencies: Record<string, unknown> = {
    'firebase-functions/v2/https': { onRequest: (_opts: unknown, fn: unknown) => fn },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async (uid: string) => { if (!users.has(uid)) throw new Error('bad token'); return { uid }; }, getUser: async (uid: string) => users.get(uid) }) },
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => 1 } },
    '../../lib/ai-render/access': policy,
  };
  const source = readFileSync(new URL('../functions/src/ai-map-access.ts', import.meta.url), 'utf8');
  const js = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', js)((id: string) => { if (!(id in dependencies)) throw new Error(`Unmocked ${id}`); return dependencies[id]; }, module, module.exports);
  async function call(uid: string, body?: Record<string, unknown>, query: Record<string, string> = { mode: 'settings' }) {
    let status = 200, result: any;
    const res = { set: () => {}, status: (s: number) => { status = s; return res; }, json: (r: unknown) => { result = r; return res; } };
    await module.exports.aiMapAccess({ method: body ? 'POST' : 'GET', body, query, get: () => uid ? `Bearer ${uid}` : '' }, res);
    return { status, result };
  }
  return { records, users, call, load: (uid: string) => module.exports.loadAiMapContext(db, users.get(uid)) };
}

test('the actual service refuses self-issued master privileges and cross-tenant delegation', async () => {
  const s = service();
  for (const body of [
    { action: 'global', enabled: false },
    { action: 'organization', orgId: 'org-a', enabled: true },
    { action: 'roles', orgId: 'org-b', roles: ['farmer'] },
    { action: 'member', orgId: 'org-b', uid: 'other', granted: true },
  ]) {
    assert.equal((await s.call('manager', body)).status, 403);
    assert.equal((await s.call('farmer', body)).status, 403);
  }
  assert.equal((await s.call('', { action: 'personal', enabled: true })).status, 401);
  assert.equal(s.records.get('app_config/renders')?.enabled, true);
  assert.equal([...s.records.keys()].filter(k => k.startsWith('ai_map_audit/')).length, 0);
});
test('personal settings accept only the preference and cannot manufacture a grant', async () => {
  const s = service();
  assert.equal((await s.call('farmer', { action: 'personal', enabled: false, granted: true, aiMapMaster: true, orgId: 'org-b' })).status, 200);
  assert.equal(s.records.get('ai_map_accounts/farmer')?.granted, undefined);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.reason, 'personal-off');
  assert.equal((await s.call('farmer', { action: 'personal', enabled: true })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, true);
});
test('master suspension immediately revokes access and prevents staff changing grants', async () => {
  const s = service();
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, true);
  assert.equal((await s.call('master', { action: 'organization', orgId: 'org-a', enabled: false })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.reason, 'organization-disabled');
  assert.equal((await s.call('manager', { action: 'roles', orgId: 'org-a', roles: ['farmer', 'mentor'] })).status, 403);
  assert.equal((await s.call('manager', { action: 'member', orgId: 'org-a', uid: 'farmer', granted: true })).status, 403);
  assert.equal((await s.call('master', { action: 'organization', orgId: 'org-a', enabled: true })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, true);
});
test('member overrides stay inside the current organization and survive personal toggles', async () => {
  const s = service();
  assert.equal((await s.call('manager', { action: 'member', orgId: 'org-a', uid: 'other', granted: true })).status, 403);
  assert.equal((await s.call('manager', { action: 'member', orgId: 'org-a', uid: 'farmer', granted: false })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, false);
  assert.equal((await s.call('farmer', { action: 'personal', enabled: true })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, false);
  assert.equal((await s.call('manager', { action: 'member', orgId: 'org-a', uid: 'farmer', granted: null })).status, 200);
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, true);
  s.records.set('profiles/farmer', { role: 'farmer', org_id: 'org-b' });
  assert.equal((await s.call('farmer', undefined, { mode: 'access' })).result.allowed, false);
});
test('settings never return another organization’s members to a tenant manager', async () => {
  const s = service();
  const response = await s.call('manager');
  assert.equal(response.status, 200);
  assert.deepEqual(response.result.organizations.map((o: any) => o.id), ['org-a']);
  assert.ok(!response.result.members.some((m: any) => m.id === 'other'));
  assert.equal((await s.call('manager', undefined, { mode: 'settings', org: 'org-b' })).status, 403);
  const master = await s.call('master');
  assert.equal(master.result.master, true);
  assert.equal(master.result.organizations.length, 2);
});
test('disabled accounts cannot keep master access through an old signed token', async () => {
  const s = service();
  s.users.get('master')!.disabled = true;
  assert.equal((await s.call('master', { action: 'global', enabled: false })).status, 401);
});

test('the real Settings component saves personal, master and organisation switches through the service', async () => {
  const s = service();
  const require = createRequire(import.meta.url);
  const settingsUser = { uid: 'master' };
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { useAuth: () => ({ user: settingsUser }) },
    '@/lib/api-client-auth': { paidApiHeaders: async () => ({ Authorization: 'Bearer master' }) },
    '@/lib/sample-mode': { isSampleMode: () => false },
    '@/lib/ai-render/access': policy,
    '@/lib/i18n': { useLanguage: () => ({ lang: 'en' }) },
  };
  const source = readFileSync(new URL('../components/AiMapSettings.tsx', import.meta.url), 'utf8');
  const js = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, jsx: typescript.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', js)((id: string) => dependencies[id] ?? require(id), module, module.exports);
  const originalFetch = globalThis.fetch;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => {} } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), 'https://example.invalid');
    const result = await s.call('master', init?.body ? JSON.parse(String(init.body)) : undefined, { mode: 'settings', ...(url.searchParams.get('org') ? { org: url.searchParams.get('org')! } : {}) });
    return Response.json(result.result, { status: result.status });
  };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(module.exports.default)); });
    const switchFor = (name: string) => renderer!.root.findByProps({ 'aria-label': name });
    assert.equal(switchFor('Enable AI glossy maps for my account').props.checked, true);
    await act(async () => { switchFor('Enable AI glossy maps for my account').props.onChange({ target: { checked: false } }); });
    assert.equal(s.records.get('ai_map_accounts/master')?.enabled, false);
    await act(async () => { switchFor('Allow paid AI maps across the platform').props.onChange({ target: { checked: false } }); });
    assert.equal(s.records.get('app_config/renders')?.enabled, false);
    await act(async () => { switchFor('Allow AI maps for Org A').props.onChange({ target: { checked: false } }); });
    assert.equal(s.records.get('ai_map_organizations/org-a')?.enabled, false);
    assert.ok(renderer!.root.findAllByProps({ role: 'status' }).some(n => String(n.children).includes('saved')));
  } finally {
    await act(async () => { renderer?.unmount(); });
    globalThis.fetch = originalFetch;
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else delete (globalThis as any).window;
  }
});
