import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

const tokenUser = (uid: string) => ({ uid, getIdToken: async () => `fixture-${uid}` });
const userA = tokenUser('owner-a'), userB = tokenUser('owner-b');
const probe = {
  user: userA as typeof userA | null, owner: 'owner-a' as string | null, sample: false, allowed: true,
  country: 'country-confirmation-a', raw: null as DesignCanvasState | null,
  evaluated: [] as Array<unknown[]>, headerUsers: [] as unknown[], requests: [] as RequestInit[],
  headers: async () => ({ Authorization: 'Bearer fixture-owner-a' } as Record<string, string>),
  fetcher: async (_init: RequestInit): Promise<Response> => Response.json({}),
};
Object.assign(globalThis, { __designAdviceUiProbe: probe });
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const advisor = context.parentURL?.endsWith('/components/design/DesignAdvisor.tsx');
    if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return { shortCircuit: true,
      url: moduleUrl('export const getFirebase=()=>({auth:{currentUser:globalThis.__designAdviceUiProbe.user}});export const isBackendConfigured=()=>false;') };
    if (advisor) {
      if (specifier === '@/lib/auth') return { shortCircuit: true, url: moduleUrl('export const useAuth=()=>({user:globalThis.__designAdviceUiProbe.user});') };
      if (specifier === '@/lib/i18n') return { shortCircuit: true, url: moduleUrl('export const useLanguage=()=>({lang:"en",t:key=>key});') };
      if (specifier === '@/lib/account-local-storage') return { shortCircuit: true, url: moduleUrl('export const activeAccountUid=()=>globalThis.__designAdviceUiProbe.owner;') };
      if (specifier === '@/lib/sample-mode') return { shortCircuit: true, url: moduleUrl('export const isSampleMode=()=>globalThis.__designAdviceUiProbe.sample;export const SAMPLE_MODE_EVENT="imbewu-sample-mode-changed";') };
      if (specifier === '@/lib/international/planning-support') return { shortCircuit: true, url: moduleUrl(`export const currentPlanningSupport=()=>{
        const p=globalThis.__designAdviceUiProbe;return {allowCataloguePlanning:p.allowed,mode:p.allowed?'south-african-site':'unavailable',fingerprint:p.country};};`) };
      if (specifier === '@/lib/design-canvas') return { shortCircuit: true, url: moduleUrl(`export const DESIGN_CANVAS_CHANGED_EVENT='imbewu-design-canvas-changed';
        export const readCanvasSourceReceipt=()=>{const p=globalThis.__designAdviceUiProbe;return p.raw?{status:'ready',raw:p.raw,ownerUid:p.owner,sample:p.sample,revision:'fixture'}:{status:'held',reasons:['missing-source']};};`) };
      if (specifier === '@/lib/design-rules') return { shortCircuit: true, url: moduleUrl(`export function evaluateDesign(...args){
        globalThis.__designAdviceUiProbe.evaluated.push(args);return [{severity:'tip',msg:'Controlled same-source tip',layer:'general'}];}`) };
      if (specifier === '@/lib/api-client-auth') return { shortCircuit: true, url: moduleUrl(`export async function paidApiHeaders(user){
        const p=globalThis.__designAdviceUiProbe;p.headerUsers.push(user);return p.headers();}`) };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/design/DesignAdvisor.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Advisor } = await import('../components/design/DesignAdvisor.tsx');
const { buildDemoDesignCanvasState } = await import('../lib/demo-farm.ts');
const originalGlobals = new Map(['window', 'document', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget(), fetch: async (_url: unknown, init: RequestInit) => {
  probe.requests.push(init); return probe.fetcher(init);
} });
test.after(() => {
  hooks.deregister(); Reflect.deleteProperty(globalThis, '__designAdviceUiProbe');
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
function canvas(): DesignCanvasState {
  return { siteId: 'site:0.00000,0.00000', frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
    items: [{ id: 'fixture-bed', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4 }],
    zones: [{ id: 'fixture-house', feature: 'house', zone: 0, points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]] }], lines: [],
    step: 'planting', updatedAt: '2026-11-04T12:00:00.000Z' };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(raw = canvas()) {
  const props = { state: raw, site: { windFromSummer: 'STALE-SITE-WIND', slopeDeg: 55, rainfallMm: 999999 },
    houseXY: [0.9, 0.9] as [number, number], lastChangeId: raw.updatedAt };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Advisor, props)); });
  return { props, get renderer() { return renderer; }, text: () => text(renderer.root),
    askButton() { const found = renderer.root.findAllByType('button').find(button => text(button).startsWith('designAdvisorAskLima') || text(button).startsWith('Ask Lima about'));
      assert.ok(found, 'Missing actual advisor Ask action'); return found; },
    startAsk() { let promise!: Promise<void>; act(() => { promise = this.askButton().props.onClick(); }); return promise; },
    update(raw = props.state) { props.state = raw; props.lastChangeId = raw.updatedAt; act(() => { renderer.update(React.createElement(Advisor, props)); }); },
    event(name: string) { act(() => { window.dispatchEvent(new Event(name)); }); },
    dispose() { act(() => renderer.unmount()); },
  };
}
function success(init: RequestInit, suggestions = ['Only the current context may see this']) {
  const body = JSON.parse(init.body as string);
  return Response.json({ ...body, suggestions });
}
test.beforeEach(() => {
  probe.user = userA; probe.owner = userA.uid; probe.sample = false; probe.allowed = true; probe.country = 'country-confirmation-a';
  probe.raw = canvas(); probe.evaluated.length = 0; probe.headerUsers.length = 0; probe.requests.length = 0;
  probe.headers = async () => ({ Authorization: 'Bearer fixture-owner-a' }); probe.fetcher = async init => success(init);
});

test('the actual advisor never runs inherited regional rules for an unsupported country or damaged device source', () => {
  probe.allowed = false;
  const screen = mount();
  try {
    assert.equal(probe.evaluated.length, 0); assert.match(screen.text(), /Local design advice needs a supported saved site/);
    assert.equal(screen.renderer.root.findAllByType('button').length, 0);
    probe.allowed = true; probe.raw = canvas(); probe.raw.items.push({ ...probe.raw.items[0] }); screen.update();
    assert.equal(probe.evaluated.length, 0); assert.match(screen.text(), /Your drawing remains available/);
  } finally { screen.dispose(); }
});

test('local eligible geometry keeps its traced-house advice, omits unbound site and map-house props, and labels the regional basis', () => {
  const screen = mount();
  try {
    assert.equal(probe.evaluated.length, 1);
    const args = probe.evaluated[0]; assert.equal(args[2], undefined);
    const extras = args[3] as { houseXY: number[] };
    assert.deepEqual(extras.houseXY, [1 / 6, 2 / 15]);
    assert.notDeepEqual(extras.houseXY, screen.props.houseXY);
    assert.match(screen.text(), /Existing South African references/); assert.match(screen.text(), /grower-confirmed country; local agronomy is unverified/);
    assert.equal(screen.askButton().props.disabled, false);
  } finally { screen.dispose(); }
});

test('the mounted advisor captures the actual signed-in user and sends only semantic source references', async () => {
  const screen = mount();
  try {
    await act(async () => { await screen.startAsk(); });
    assert.deepEqual(probe.headerUsers, [userA]); assert.equal(probe.requests.length, 1);
    const payload = JSON.parse(probe.requests[0].body as string);
    assert.equal(payload.mode, 'personal-site'); assert.equal(payload.designSummary, undefined); assert.equal(payload.site, undefined);
    assert.match(screen.text(), /Only the current context may see this/);
  } finally { screen.dispose(); }
});

test('account switching while the captured token resolves cannot submit or show the previous account request', async () => {
  const screen = mount(), token = deferred<Record<string, string>>(), entered = deferred<void>();
  probe.headers = () => { entered.resolve(); return token.promise; };
  try {
    const pending = screen.startAsk(); await entered.promise;
    probe.user = userB; probe.owner = userB.uid; screen.update();
    await act(async () => { token.resolve({ Authorization: 'Bearer fixture-owner-a' }); await pending; });
    assert.deepEqual(probe.headerUsers, [userA]); assert.equal(probe.requests.length, 0);
    assert.doesNotMatch(screen.text(), /Only the current context/);
  } finally { screen.dispose(); }
});

test('source, country, sample and view changes discard a mounted advisor response that arrives late', async () => {
  for (const change of ['source', 'country', 'sample', 'step', 'account']) {
    probe.user = userA; probe.owner = userA.uid; probe.sample = false; probe.allowed = true; probe.country = 'country-confirmation-a'; probe.raw = canvas();
    const screen = mount(), network = deferred<Response>(), entered = deferred<RequestInit>();
    probe.fetcher = init => { entered.resolve(init); return network.promise; };
    try {
      const pending = screen.startAsk(), init = await entered.promise;
      if (change === 'source') { const next = canvas(); next.items[0].x = 0.6; probe.raw = next; screen.update(next); }
      if (change === 'country') { probe.country = 'country-confirmation-b'; screen.event('permamap-places-changed'); }
      if (change === 'sample') { probe.sample = true; probe.owner = null; screen.event('imbewu-sample-mode-changed'); }
      if (change === 'step') { const next = canvas(); next.step = 'water'; probe.raw = next; screen.update(next); }
      if (change === 'account') { probe.user = userB; probe.owner = userB.uid; screen.update(); }
      await act(async () => { network.resolve(success(init, ['Obsolete private result'])); await pending; });
      assert.doesNotMatch(screen.text(), /Obsolete private result/, change);
      assert.equal((init.signal as AbortSignal).aborted, true, change);
    } finally { screen.dispose(); }
  }
});

test('an edited signed-in sample keeps ordinary token selection and labels paid advice as the original reference only', async () => {
  const raw = buildDemoDesignCanvasState(); raw.items[0].x += 0.01;
  probe.raw = raw; probe.sample = true; probe.owner = null; probe.allowed = false;
  const screen = mount(raw);
  try {
    assert.match(text(screen.askButton()), /original sample layout/);
    await act(async () => { await screen.startAsk(); });
    assert.deepEqual(probe.headerUsers, [userA]);
    const payload = JSON.parse(probe.requests[0].body as string); assert.equal(payload.mode, 'original-demo-reference');
    assert.match(screen.text(), /Original sample layout reference/); assert.match(screen.text(), /your edits were not analysed/);
  } finally { screen.dispose(); }
});
