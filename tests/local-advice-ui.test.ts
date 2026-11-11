import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { LocationData } from '../lib/types.ts';
import { bindSiteContext, createSiteCountryContext } from '../lib/international/site-context.ts';
import { resolvePlanningSupport } from '../lib/international/planning-policy.ts';

// Mount the real consumers, context hook, header builder and buffered client.
// Stores, authentication and transport are controlled boundaries; this is not browser QA.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const point = { lat: 0.123456, lon: 0.654321 };
const location = () => ({ ...point, marker: 'Synthetic location fixture' }) as unknown as LocationData;
const siteId = `site:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
function place(country = 'ZA') {
  const row = { id: 'fixture-place', ...point, updatedAt: 100, savedAt: '2026-11-01T12:00:00.000Z' };
  return { ...row, siteCountryContext: bindSiteContext(createSiteCountryContext({ siteId, countryCode: country,
    confirmed: true }, '2026-11-02T12:00:00.000Z')!, row)! };
}
const user = (uid: string) => ({ uid, getIdToken: async () => { probe.tokenUsers.push(uid); return probe.token(uid); } });
const userA = user('ui-owner-a'), userB = user('ui-owner-b');
const probe = {
  React, user: userA as typeof userA | null, owner: userA.uid as string | null, authLoading: false, sample: false,
  places: [place()], storage: new Map<string, string>(),
  tokenUsers: [] as string[], token: async (uid: string) => `synthetic-${uid}`,
  production: async (): Promise<unknown[]> => [], sales: async (): Promise<unknown[]> => [], consent: async (): Promise<unknown> => null,
  localProduction: [] as unknown[], localSales: [] as unknown[], project: null as unknown, reports: [] as unknown[],
  requests: [] as Array<{ url: string; init: RequestInit }>, fetcher: async (_url: string, init: RequestInit): Promise<Response> => response(init),
  urls: [] as string[], revoked: [] as string[], fileClicks: 0,
};
Object.assign(globalThis, { __localAdviceUiProbe: probe });
const moduleUrl = (code: string) => 'data:text/javascript,' + encodeURIComponent(code);
const sourceRootUrl = new URL('../', import.meta.url).href;
const virtual = new Map<string, string>([
  ['auth', 'export const useAuth=()=>({user:globalThis.__localAdviceUiProbe.user,loading:globalThis.__localAdviceUiProbe.authLoading});'],
  ['firebase', 'export const getFirebase=()=>({auth:{currentUser:globalThis.__localAdviceUiProbe.user}});export const isBackendConfigured=()=>true;'],
  ['account', 'export const activeAccountUid=()=>globalThis.__localAdviceUiProbe.owner;export const activeAccountLocalStorageKey=key=>key;'],
  ['sample', 'export const isSampleMode=()=>globalThis.__localAdviceUiProbe.sample;export const enterSampleMode=()=>false;export const SAMPLE_MODE_EVENT="imbewu-sample-mode-changed";'],
  ['places', 'export const loadPlaces=()=>globalThis.__localAdviceUiProbe.places;'],
  ['crop', 'export const loadCropPlan=()=>({workspaceReferences:[]});'],
  ['reports', 'export const loadReports=()=>globalThis.__localAdviceUiProbe.reports;'],
  ['records', 'export const myProduction=()=>globalThis.__localAdviceUiProbe.production();export const mySales=()=>globalThis.__localAdviceUiProbe.sales();export const getMyConsent=()=>globalThis.__localAdviceUiProbe.consent();'],
  ['localRecords', 'export const getLocalProduction=()=>globalThis.__localAdviceUiProbe.localProduction;export const getLocalSales=()=>globalThis.__localAdviceUiProbe.localSales;export const getLocalProject=()=>globalThis.__localAdviceUiProbe.project;export const hasSampleData=()=>false;export const loadSampleFarmData=()=>{};export const clearSampleFarmData=()=>{};'],
  ['last', 'export const getLastSite=()=>null;'],
  ['language', 'export const useLanguage=()=>({lang:"en",t:key=>key});'],
  ['link', 'export default function Link(props){return globalThis.__localAdviceUiProbe.React.createElement("a",props,props.children);}'],
  ['css', 'export default {};'],
]);
const aliases = new Map([
  ['@/lib/auth', 'auth'], ['./auth', 'auth'], ['@/lib/firebase/init', 'firebase'], ['./firebase/init', 'firebase'],
  ['@/lib/account-local-storage', 'account'], ['./account-local-storage', 'account'],
  ['@/lib/sample-mode', 'sample'], ['./sample-mode', 'sample'],
  ['@/lib/saved-places', 'places'], ['../saved-places', 'places'],
  ['../crop-plan', 'crop'], ['@/lib/saved-reports', 'reports'], ['@/lib/db/queries', 'records'],
  ['@/lib/demo-data', 'localRecords'], ['@/lib/last-site', 'last'], ['@/lib/i18n', 'language'], ['next/link', 'link'],
]);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const key = specifier.endsWith('.module.css') ? 'css' : aliases.get(specifier);
    if (key) return { shortCircuit: true, url: moduleUrl(virtual.get(key)!) };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx') && url.startsWith(sourceRootUrl)) return {
      shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});
const { default: Chat } = await import('../components/ChatPanel.tsx');
const { default: Insights } = await import('../components/InsightsPanel.tsx');
const { default: Design } = await import('../components/SiteDesign.tsx');

class WindowBoundary extends EventTarget {
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (listener) { const group = this.listeners.get(type) ?? new Set(); group.add(listener); this.listeners.set(type, group); }
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (listener) this.listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, group) => sum + group.size, 0); }
}
class ReaderBoundary {
  result = '';
  onload?: (event: { target: { result: string } }) => void;
  readAsDataURL(file: File) { this.result = `data:image/png;base64,${file.name}`; queueMicrotask(() => this.onload?.({ target: { result: this.result } })); }
}
class ImageBoundary {
  width = 100; height = 100; onload?: () => void; value = '';
  set src(value: string) { this.value = value; queueMicrotask(() => this.onload?.()); }
}
const originalGlobals = new Map(['window', 'document', 'localStorage', 'FileReader', 'Image', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
let windowBoundary: WindowBoundary;
Object.assign(globalThis, {
  FileReader: ReaderBoundary, Image: ImageBoundary,
  document: { createElement(name: string) {
    assert.equal(name, 'canvas'); let image: ImageBoundary;
    return { width: 0, height: 0, getContext: () => ({ drawImage(value: ImageBoundary) { image = value; } }),
      toDataURL: () => `data:image/jpeg;base64,${Buffer.from(image.value).toString('base64')}` };
  } },
  localStorage: { getItem: (key: string) => probe.storage.get(key) ?? null },
  fetch: async (url: string, init: RequestInit) => { probe.requests.push({ url, init }); return probe.fetcher(url, init); },
});
URL.createObjectURL = () => { const url = `blob:local-advice-fixture-${probe.urls.length}`; probe.urls.push(url); return url; };
URL.revokeObjectURL = value => { probe.revoked.push(value); };
test.after(() => {
  hooks.deregister(); Reflect.deleteProperty(globalThis, '__localAdviceUiProbe');
  URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
test.beforeEach(() => {
  probe.user = userA; probe.owner = userA.uid; probe.authLoading = false; probe.sample = false; probe.places = [place()]; probe.storage.clear();
  probe.production = async () => []; probe.sales = async () => []; probe.consent = async () => null;
  probe.localProduction = []; probe.localSales = []; probe.project = null; probe.reports = [];
  probe.tokenUsers.length = 0; probe.token = async uid => `synthetic-${uid}`; probe.requests.length = 0; probe.fetcher = async (_url, init) => response(init);
  probe.urls.length = 0; probe.revoked.length = 0; probe.fileClicks = 0;
  windowBoundary = new WindowBoundary(); Object.assign(globalThis, { window: windowBoundary });
});
function response(init: RequestInit, text = 'Only current context may display this answer') {
  const payload = JSON.parse(init.body as string);
  return new Response(text, { headers: { 'X-Imbewu-Advice-Mode': payload.adviceContext.mode } });
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
async function mount(kind: 'chat' | 'insights' | 'design', extra: Record<string, unknown> = {}) {
  const Component = { chat: Chat, insights: Insights, design: Design }[kind] as React.ComponentType<any>;
  const props = { locationData: location(), ...extra }; let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Component, props), {
    createNodeMock: element => element.type === 'input' && (element.props as { type?: string }).type === 'file'
      ? { click() { probe.fileClicks++; } } : { scrollIntoView() {} },
  }); });
  return {
    renderer, props, text: () => text(renderer.root),
    button(label: string) { const button = renderer.root.findAllByType('button').find(node => text(node).includes(label)); assert.ok(button, label); return button; },
    input: () => renderer.root.findAllByType('input').find(node => node.props.type !== 'file')!,
    async update(patch: Record<string, unknown> = {}) { Object.assign(props, patch); await act(async () => { renderer.update(React.createElement(Component, props)); }); },
    async event(name: string) { await act(async () => { window.dispatchEvent(new Event(name)); }); },
    async dispose() { await act(async () => { renderer.unmount(); }); },
  };
}
async function submit(screen: Awaited<ReturnType<typeof mount>>, question: string) {
  // Typing and submitting are separate user events. One outer act would batch
  // the input update and submit through the previous render's empty value.
  await act(async () => { screen.input().props.onChange({ target: { value: question } }); });
  await act(async () => {
    screen.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
    // The actual form handler does not return send's promise. Drain only this
    // controlled, immediately resolving transport, without a time delay.
    await new Promise<void>(resolve => setImmediate(resolve));
  });
}
async function upload(screen: Awaited<ReturnType<typeof mount>>) {
  const file = new File(['synthetic image bytes'], 'private-fixture.png', { type: 'image/png' });
  await act(async () => { await screen.renderer.root.findAllByType('input').find(node => node.props.type === 'file')!.props.onChange({ target: { files: [file], value: 'fixture' } }); });
}

test('the mounted chat general scope sends no farm context, personal history or attached photo', async () => {
  probe.localProduction = [{ crop: 'PRIVATE_RECORD', kg: 1 }]; probe.reports = [{ name: 'PRIVATE_REPORT', savedAt: '2026-11-01', report: 'PRIVATE_TEXT' }];
  const screen = await mount('chat');
  try {
    await submit(screen, 'PRIVATE_PERSONAL_HISTORY');
    assert.equal(probe.requests.length, 1); assert.match(screen.text(), /Only current context/);
    await upload(screen); assert.ok(screen.renderer.root.findAllByType('img').length > 0);
    act(() => { screen.renderer.root.findByType('select').props.onChange({ target: { value: 'general-help' } }); });
    assert.equal(screen.renderer.root.findAllByType('img').length, 0);
    await submit(screen, 'How do I use the account screen?');
    const payload = JSON.parse(probe.requests.at(-1)!.init.body as string);
    assert.deepEqual(payload.adviceContext, { mode: 'general-help' }); assert.deepEqual(payload.context, { language: 'en' });
    assert.deepEqual(payload.messages, [{ role: 'user', content: 'How do I use the account screen?' }]);
    assert.equal(payload.image, undefined); assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_/);
  } finally { await screen.dispose(); }
});

test('a LimaBar question remains editable through auth loading and late account records without an automatic charge', async () => {
  const records = deferred<unknown[]>(); probe.production = () => records.promise; probe.authLoading = true; let consumed = 0;
  const screen = await mount('chat', { initialQuery: 'Retain this intended question', onInitialConsumed: () => { consumed++; } });
  try {
    assert.equal(screen.input().props.value, 'Retain this intended question'); assert.equal(consumed, 1); assert.equal(probe.requests.length, 0);
    probe.authLoading = false; await screen.update();
    await act(async () => { records.resolve([{ crop: 'Late own record', kg: 1 }]); await records.promise; });
    assert.equal(screen.input().props.value, 'Retain this intended question'); assert.equal(probe.requests.length, 0);
    await submit(screen, screen.input().props.value);
    assert.equal(probe.requests.length, 1); assert.match(screen.text(), /Only current context/);
  } finally { await screen.dispose(); }
});

test('the mounted insights envelope uses canonical country context, while a token-wait account change cannot submit', async () => {
  const screen = await mount('insights');
  try {
    await act(async () => { await screen.button('insightsAnalyseSite').props.onClick(); });
    const payload = JSON.parse(probe.requests[0].init.body as string);
    assert.deepEqual(payload.locationData, location());
    assert.deepEqual(payload.adviceContext, { mode: 'personal-site', siteId,
      countryFingerprint: resolvePlanningSupport({ siteId, places: probe.places }).fingerprint });
    assert.deepEqual(probe.tokenUsers, [userA.uid]); assert.match(screen.text(), /Only current context/);
    const token = deferred<string>(), entered = deferred<void>(); probe.token = () => { entered.resolve(); return token.promise; };
    let pending!: Promise<void>; act(() => { pending = screen.button('buttonRegenerate').props.onClick(); }); await entered.promise;
    probe.user = userB; probe.owner = userB.uid; await screen.update();
    await act(async () => { token.resolve('synthetic-old-owner-token'); await pending; });
    assert.equal(probe.requests.length, 1); assert.doesNotMatch(screen.text(), /Only current context/);
  } finally { await screen.dispose(); }
});

test('actual insights chunks stay private when country, source or actor changes before completion', async () => {
  for (const change of ['country', 'source', 'actor']) {
    probe.user = userA; probe.owner = userA.uid; probe.places = [place()];
    const entered = deferred<RequestInit>(); let controller!: ReadableStreamDefaultController<Uint8Array>;
    probe.fetcher = async (_url, init) => { entered.resolve(init); return new Response(new ReadableStream({ start(value) { controller = value; } }), {
      headers: { 'X-Imbewu-Advice-Mode': 'personal-site' },
    }); };
    const screen = await mount('insights'); let pending!: Promise<void>;
    try {
      act(() => { pending = screen.button('insightsAnalyseSite').props.onClick(); }); const init = await entered.promise;
      await act(async () => { controller.enqueue(new TextEncoder().encode('OBSOLETE_PRIVATE_CHUNK')); });
      assert.doesNotMatch(screen.text(), /OBSOLETE_PRIVATE_CHUNK/);
      if (change === 'country') { probe.places = [place('KE')]; await screen.event('permamap-places-changed'); }
      if (change === 'source') await screen.update({ locationData: { ...location(), marker: 'Changed raw source' } });
      if (change === 'actor') { probe.user = userB; probe.owner = userB.uid; await screen.update(); }
      await act(async () => { controller.close(); await pending; });
      assert.doesNotMatch(screen.text(), /OBSOLETE_PRIVATE_CHUNK/); assert.equal(init.signal!.aborted, true, change);
    } finally { await screen.dispose(); }
  }
});

test('chat and sketch attachments cannot render or submit in a different actor or country scope', async () => {
  const chat = await mount('chat');
  try {
    await upload(chat); assert.ok(chat.renderer.root.findAllByType('img').length > 0);
    probe.user = userB; probe.owner = userB.uid; await chat.update();
    assert.equal(chat.renderer.root.findAllByType('img').length, 0);
    await submit(chat, 'New account question');
    assert.equal(JSON.parse(probe.requests.at(-1)!.init.body as string).image, undefined);
  } finally { await chat.dispose(); }
  probe.user = userA; probe.owner = userA.uid; probe.requests.length = 0;
  const design = await mount('design');
  try {
    await upload(design); assert.ok(design.renderer.root.findAllByType('img').length > 0);
    await act(async () => { await design.button('siteDesignGenerateButton').props.onClick(); });
    assert.equal(probe.requests[0].url, '/api/design'); assert.equal(JSON.parse(probe.requests[0].init.body as string).images.length, 1);
    assert.match(design.text(), /Only current context/);
    probe.places = [place('KE')]; await design.event('permamap-places-changed');
    assert.equal(design.renderer.root.findAllByType('img').length, 0); assert.doesNotMatch(design.text(), /Only current context/);
    assert.equal(design.renderer.root.findAllByType('button').some(button => text(button).includes('siteDesignGenerateButton')), false);
  } finally { await design.dispose(); }
  assert.deepEqual(probe.revoked, probe.urls);
});

test('unmount retires a token-wait request and removes the hook and consumer listeners', async () => {
  const token = deferred<string>(), entered = deferred<void>(); probe.token = () => { entered.resolve(); return token.promise; };
  const screen = await mount('insights'); let pending!: Promise<void>;
  act(() => { pending = screen.button('insightsAnalyseSite').props.onClick(); }); await entered.promise;
  await screen.dispose(); await act(async () => { token.resolve('synthetic-owner-token'); await pending; });
  assert.equal(probe.requests.length, 0); assert.equal(windowBoundary.listenerCount, 0);
});
