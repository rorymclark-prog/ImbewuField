// Isolated source-bound UI-RUNTIME-01 harness. Actual Advisor, client, writer and
// AST-extracted real parent callback execute. Only auth/country/rule/provider
// boundaries are synthetic; no actual cloud or AI call can be made.
function controlledAdvisorSource(source:string) {
 // Instrument calls to React's real setters; no replacement state machine.
 source=source.replace('useRef, useState, type','useRef, useState as realUseState, type');
 source='function useState(initial){const [value,set]=realUseState(initial);return [value,(next)=>{globalThis.__designAdviceUiProbe.setterCalls++;return set(next);}];}\n'+source;
 if(process.env.ADVISOR_CONTROL==='coalesce-before-revocation') {
  const immediate=(source.includes('      latestInvalidationVersion = ++requestVersion.current;')?'      latestInvalidationVersion = ++requestVersion.current;':'      ++requestVersion.current;')+'\n      pending.current?.abort();';
  assert.ok(source.includes(immediate),'negative control must alter actual coalescing order');
  source=source.replace('      if (refreshQueued) return;','').replace(immediate,'      if (refreshQueued) return;\n'+immediate);
 }
 if(process.env.ADVISOR_CONTROL==='unconditional-loading-clear') {
  const guarded='setLoadingKey(current => requestVersion.current === invalidationVersion ? null : current);';
  assert.ok(source.includes(guarded),'negative control must remove the real version-sensitive loading setter');
  source=source.replace(guarded,'setLoadingKey(null);');
 }
 if(process.env.ADVISOR_CONTROL==='first-event-version') {
  const eachEvent='      latestInvalidationVersion = ++requestVersion.current;';
  assert.ok(source.includes(eachEvent),'negative control must freeze the real coalesced-event version');
  source=source.replace(eachEvent,'      ++requestVersion.current;').replace('      if (refreshQueued) return;','      if (refreshQueued) return;\n      latestInvalidationVersion = requestVersion.current;');
 }
 if(process.env.ADVISOR_CONTROL==='ignore-unmount') {
  assert.ok(source.includes('        if (!active) return;'),'negative control must alter actual unmount guard');
  source=source.replace('        if (!active) return;','');
 }

 if(process.env.ADVISOR_CONTROL==='defer-revocation') {
  const immediate=(source.includes('      latestInvalidationVersion = ++requestVersion.current;')?'      latestInvalidationVersion = ++requestVersion.current;':'      ++requestVersion.current;')+'\n      pending.current?.abort();';
  assert.ok(source.includes(immediate),'negative control must alter actual revocation');
  return source.replace(immediate,'').replace('        refreshQueued = false;','        refreshQueued = false;\n'+immediate);
 }
 return source;
}
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
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
      if (specifier === '@/lib/design-rules') return { shortCircuit: true, url: moduleUrl(`export function evaluateDesign(...args){
        globalThis.__designAdviceUiProbe.evaluated.push(args);return [{severity:'tip',msg:'Controlled same-source tip',layer:'general'}];}`) };
      if (specifier === '@/lib/api-client-auth') return { shortCircuit: true, url: moduleUrl(`export async function paidApiHeaders(user){
        const p=globalThis.__designAdviceUiProbe;p.headerUsers.push(user);return p.headers();}`) };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/design/DesignAdvisor.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule('const queueMicrotask = fn => globalThis.__designAdviceUiProbe.queueMicrotask(fn);\n'+controlledAdvisorSource(readFileSync(new URL(url), 'utf8')), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Advisor } = await import('../components/design/DesignAdvisor.tsx');
const { buildDemoDesignCanvasState } = await import('../lib/demo-farm.ts');
const originalGlobals = new Map(['window', 'document', 'fetch', 'localStorage', 'queueMicrotask', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const storageRows = new Map<string,string>();
const storage = { getItem:(key:string)=>storageRows.get(key)??null, setItem:(key:string,value:string)=>{storageRows.set(key,value);}, removeItem:(key:string)=>{storageRows.delete(key);} };
const browser = Object.assign(new EventTarget(),{localStorage:storage,sessionStorage:{getItem:()=>null}});
const queued: Array<()=>void> = [];
Object.assign(probe,{setterCalls:0,queueMicrotask:(fn:()=>void)=>{queued.push(fn);}});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT:true, window: browser, localStorage:storage, document: new EventTarget(), fetch: async (_url: unknown, init: RequestInit) => {
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


const realCanvas=await import('../lib/design-canvas.ts');
const {saveCanvasNavigation,readCanvasSourceReceipt,DESIGN_CANVAS_CHANGED_EVENT}=realCanvas;
// Compile verbatim production declarations, including the parent useCallback.
// The shell supplies ordinary React hooks, not a duplicate navigation algorithm.
const pageUrl=new URL('../app/design/page.tsx',import.meta.url), page=readFileSync(pageUrl,'utf8');
const parsed=ts.createSourceFile(pageUrl.pathname,page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const named=new Map<string,string>();
function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name))named.set(node.name.text,node.getText(parsed));if(ts.isFunctionDeclaration(node)&&node.name)named.set(node.name.text,node.getText(parsed));ts.forEachChild(node,visit);}
visit(parsed);
const declarations=['DEFAULT_WATER_INFRASTRUCTURE_VISIBILITY','ELEMENT_LAYER_KEYS','CATEGORY_TO_LAYER','selfSaveInProgress'].map(name=>{assert.ok(named.has(name),name);return `let ${named.get(name)};`;}).join('\n');
const functions=['layersOfferedVia','applyStepFocus','withSelfSaveFlag'].map(name=>{assert.ok(named.has(name),name);return named.get(name);}).join('\n');
const callback=named.get('setStep');assert.ok(callback);assert.match(callback,/withSelfSaveFlag\(\(\) => saveCanvasNavigation\(next\)\)/);
const extracted=`import React,{useCallback,useState} from '${import.meta.resolve('react')}';
import Advisor from '${new URL('../components/design/DesignAdvisor.tsx',import.meta.url).href}';
import {ELEMENT_CATALOG} from '${new URL('../lib/design-elements.ts',import.meta.url).href}';
import {saveCanvasNavigation} from '${new URL('../lib/design-canvas.ts',import.meta.url).href}';
${declarations}\n${functions}
export function DesignStudioInner({raw,show=true}){
 const [canvasState,setCanvasState]=useState(raw);
 const [,setGlossyAutoBlocked]=useState(true),[,setAreaFeature]=useState(null),[,setZoneAdvice]=useState([]),[,setSelectedIds]=useState([]),[,setActiveLayers]=useState({}),[,setWaterInfrastructureVisibility]=useState({});
 const ${callback};
 return React.createElement(React.Fragment,null,
 React.createElement('button',{onClick:()=>setStep('planting')},'Planting'),
 React.createElement('button',{onClick:()=>setStep('water')},'Water'),
 show?React.createElement(Advisor,{state:canvasState,site:null,houseXY:null,lastChangeId:canvasState.updatedAt}):null);
}`;
const compiled=ts.transpileModule(extracted,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const {DesignStudioInner}=await import(moduleUrl(compiled));
if(process.env.ADVISOR_EVIDENCE_DIR)writeFileSync(process.env.ADVISOR_EVIDENCE_DIR+'/extracted-parent-navigation.tsx.txt',extracted);
async function flush(){await act(async()=>{while(queued.length)queued.shift()!();await Promise.resolve();});}
function mountParent(strict=false,concurrent=false){
 const raw={...canvas(),step:'review' as const,rev:7};saveCanvasNavigation(raw);
 let renderer!:ReactTestRenderer;
 const element=(show=true)=>strict?React.createElement(React.StrictMode,null,React.createElement(DesignStudioInner,{raw,show})):React.createElement(DesignStudioInner,{raw,show});
 const concurrentOptions: NonNullable<Parameters<typeof create>[1]> & {unstable_isConcurrent:boolean} = {unstable_isConcurrent:true,createNodeMock:()=>null};
 act(()=>{renderer=create(element(),concurrent?concurrentOptions:undefined);});
 return {renderer,raw,text:()=>text(renderer.root),
 step(name='Planting'){act(()=>{renderer.root.findAllByType('button').find(b=>text(b)===name)!.props.onClick();});},
 ask(){let pending!:Promise<void>;act(()=>{const b=renderer.root.findAllByType('button').find(b=>text(b).startsWith('designAdvisorAskLima'));assert.ok(b,'actual Advisor Ask button');pending=b.props.onClick();});return pending;},
 hide(){act(()=>renderer.update(element(false)));},dispose(){act(()=>renderer.unmount());}};
}
const warnings:unknown[][]=[],oldConsoleError=console.error;
console.error=(...args:unknown[])=>{warnings.push(args);};
test.after(()=>{console.error=oldConsoleError;if(process.env.ADVISOR_EVIDENCE_DIR)writeFileSync(process.env.ADVISOR_EVIDENCE_DIR+'/react-console.json',JSON.stringify(warnings,null,2)+'\n');});

test('real parent Review to Planting callback must not set Advisor state while the parent renders',async()=>{
 const screen=mountParent(),before=warnings.length;
 try{screen.step();await flush();assert.doesNotMatch(warnings.slice(before).flat().join(' '),/Cannot update a component.*while rendering a different component/);
 const receipt=readCanvasSourceReceipt(screen.raw.siteId);assert.equal(receipt.status,'ready');if(receipt.status==='ready'){const saved=receipt.raw as DesignCanvasState;assert.equal(saved.step,'planting');assert.equal(saved.updatedAt,screen.raw.updatedAt);assert.equal(saved.rev,screen.raw.rev);assert.deepEqual(saved.items,screen.raw.items);}}
 finally{screen.dispose();await flush();}
});

test('actual writer event revokes a pending real-client response synchronously before deferred UI work',async()=>{
 const screen=mountParent(),network=deferred<Response>(),entered=deferred<RequestInit>();probe.fetcher=init=>{entered.resolve(init);return network.promise;};
 try{const pending=screen.ask(),init=await entered.promise;let abortedInsideWriter=false;
 const observe=()=>{abortedInsideWriter=(init.signal as AbortSignal).aborted;};window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT,observe);
 saveCanvasNavigation(screen.raw);window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT,observe);
 assert.equal(abortedInsideWriter,true,'abort must be synchronous inside writer, before UI microtask');
 let decoded=0;const response=success(init,['Obsolete private response']),decode=response.json.bind(response);response.json=()=>{decoded++;return decode();};
 await act(async()=>{network.resolve(response);await pending;});assert.equal(decoded,0,'real client must reject before decoding');assert.doesNotMatch(screen.text(),/Obsolete private response/);await flush();}
 finally{screen.dispose();await flush();}
});

test('events coalesce UI work and unmount discards the old effect generation across StrictMode remount',async()=>{
 const screen=mountParent(true);try{for(let i=0;i<5;i++)saveCanvasNavigation(screen.raw);assert.equal(queued.length,1,'one refresh microtask per effect generation');screen.hide();const calls=(probe as typeof probe & {setterCalls:number}).setterCalls;await flush();assert.equal((probe as typeof probe & {setterCalls:number}).setterCalls,calls,'queued old generation must not invoke React setters after unmount');assert.equal(queued.length,0);}
 finally{screen.dispose();await flush();}
 const next=mountParent(true);try{saveCanvasNavigation(next.raw);assert.equal(queued.length,1);await flush();assert.match(next.text(),/Existing South African references/);}finally{next.dispose();await flush();}
});

test('a still-current real-client response displays after normal navigation and deferred refresh',async()=>{
 const screen=mountParent();try{screen.step();await flush();await act(async()=>{await screen.ask();});assert.match(screen.text(),/Only the current context may see this/);assert.equal(probe.requests.length,1);}finally{screen.dispose();await flush();}
});

test('a second event still aborts a new request while the first UI refresh is already queued',async()=>{
 const screen=mountParent(),network=deferred<Response>(),entered=deferred<RequestInit>();probe.fetcher=init=>{entered.resolve(init);return network.promise;};
 try{
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);
  const pending=screen.ask(),init=await entered.promise;
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);
  assert.equal((init.signal as AbortSignal).aborted,true,'coalescing UI updates must not coalesce away request revocation');
  await act(async()=>{network.resolve(success(init,['Obsolete second-event response']));await pending;});
  assert.doesNotMatch(screen.text(),/Obsolete second-event response/);await flush();
 }finally{screen.dispose();await flush();}
});

function loadingStatus(screen:ReturnType<typeof mountParent>) {
 const ask=screen.renderer.root.findAllByType('button').find(b=>text(b).startsWith('designAdvisorAskLima'));
 assert.ok(ask,'actual Advisor Ask button remains mounted');
 return {disabled:ask.props.disabled,spinners:ask.findAllByType('svg').filter(svg=>String(svg.props.className).includes('animate-spin')).length};
}

test('an older queued UI refresh preserves a newer valid request spinner until its real response completes',async()=>{
 const screen=mountParent(),network=deferred<Response>(),entered=deferred<RequestInit>();probe.fetcher=init=>{entered.resolve(init);return network.promise;};
 try {
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);
  const pending=screen.ask(),init=await entered.promise;
  assert.deepEqual(loadingStatus(screen),{disabled:true,spinners:1});
  await flush();
  assert.equal((init.signal as AbortSignal).aborted,false,'old UI work must not abort a newer request');
  assert.deepEqual(loadingStatus(screen),{disabled:true,spinners:1},'old refresh must not hide the new request or re-enable its Ask button');
  await act(async()=>{network.resolve(success(init,['Newer current advice']));await pending;});
  assert.match(screen.text(),/Newer current advice/);assert.deepEqual(loadingStatus(screen),{disabled:false,spinners:0});
 }finally{screen.dispose();await flush();}
});

test('the latest coalesced invalidation clears an aborted newer request spinner and discards its late response',async()=>{
 const screen=mountParent(),network=deferred<Response>(),entered=deferred<RequestInit>();probe.fetcher=init=>{entered.resolve(init);return network.promise;};
 try {
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);
  const pending=screen.ask(),init=await entered.promise;assert.deepEqual(loadingStatus(screen),{disabled:true,spinners:1});
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);assert.equal((init.signal as AbortSignal).aborted,true,'every event must revoke immediately');
  await flush();assert.deepEqual(loadingStatus(screen),{disabled:false,spinners:0},'latest coalesced event must clear the request it just revoked');
  let decoded=0;const response=success(init,['Obsolete loading-state result']),decode=response.json.bind(response);response.json=()=>{decoded++;return decode();};
  await act(async()=>{network.resolve(response);await pending;});assert.equal(decoded,0);assert.doesNotMatch(screen.text(),/Obsolete loading-state result/);
 }finally{screen.dispose();await flush();}
});

test('a queued functional loading update cannot clear a newer Ask when actual concurrent React processes it later',async()=>{
 const screen=mountParent(false,true),network=deferred<Response>(),entered=deferred<RequestInit>();probe.fetcher=init=>{entered.resolve(init);return network.promise;};
 let pending!:Promise<void>;
 try {
  saveCanvasNavigation(screen.raw);assert.equal(queued.length,1);
  act(()=>{
   const tip=screen.renderer.root.findAllByType('button').find(b=>String(b.props['aria-label']).startsWith('designAdvisorTapToRead'));
   assert.ok(tip,'the actual local-tip control provides an ordinary pending React update');
   tip.props.onClick();
   queued.shift()!();
   pending=screen.ask();
  });
  const init=await entered.promise;
  assert.equal((init.signal as AbortSignal).aborted,false);
  assert.deepEqual(loadingStatus(screen),{disabled:true,spinners:1});
  await act(async()=>{network.resolve(success(init,['Concurrent current advice']));await pending;});
  assert.match(screen.text(),/Concurrent current advice/);assert.deepEqual(loadingStatus(screen),{disabled:false,spinners:0});
 }finally{screen.dispose();await flush();}
});
