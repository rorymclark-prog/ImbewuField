import assert from 'node:assert/strict';
import test, { beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import React, { useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { crop, account, samples, probe, local, events, reset, cleanup, siteId } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, readCanonicalCropPlanFixtureRaw, initialiseCropPlanFixture, releaseCropPlanFixture } from './crop-plan-storage-fixture.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { CROPS } from '../lib/crop-catalog.ts';
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/lib/nursery-save-receipt.ts') && specifier === 'firebase/auth') return { shortCircuit: true,
    url: 'data:text/javascript,' + encodeURIComponent(`export function onAuthStateChanged(_auth,callback){const p=globalThis.__growerOperationsFixture;p.auth.add(callback);return()=>p.auth.delete(callback);}`) };
  return next(specifier, context);
} });
const api = await import('../lib/nursery-save-receipt.ts');
const storage = await import('../lib/crop-plan-storage.ts');
const { createHarvestSaveFixture } = await import('./nursery-save-fixture.ts');
beforeEach(reset); after(() => { hooks.deregister(); cleanup(); });
const otherSite = 'site:2.00000,2.00000';
// Quantities and dates are synthetic receipt fixtures, not farming guidance.
const target = (id = 'own-target', site = siteId, kg = 2): HarvestTarget => ({ id, siteId: site, cropKey: CROPS[0].key,
  startMonth: '2028-12', endMonth: '2028-12', weeklyKg: kg, marketablePercent: 50, outlet: 'Synthetic buyer' });
const nursery = (): NurserySettings => ({ version: 1, spaces: [{ id: 'own-space', siteId, name: 'Synthetic surface', usableM2: 2 },
  { id: 'other-space', siteId: otherSite, name: 'Other synthetic surface', usableM2: 3 }], containers: [], profiles: [] });
const book = (): CropPlanState => ({ version: 1, plantings: [], updatedAt: 7, harvestTargets: [target(), target('other-target', otherSite)], nursery: nursery() });
function parent(raw = book()) { replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw)); return createHarvestSaveFixture(siteId); }
const nextTargets = (c: ReturnType<typeof parent>, kg = 5): HarvestTarget[] => c.state.plan.harvestTargets.map((row: HarvestTarget) => row.siteId === siteId ? { ...row, weeklyKg: kg } : row);
const request = (c: ReturnType<typeof parent>, next: HarvestTarget[]) => { const value = api.createHarvestSaveRequest(c.context(), next); assert.ok(value); return value; };
const readBook = () => JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
function install(c: ReturnType<typeof parent>, confirmed: NonNullable<ReturnType<typeof api.readHarvestSaveConfirmation>>) {
  c.state.planWriteBase.current = { ...c.state.planWriteBase.current, token: confirmed.token, admission: confirmed.admission, planKey: JSON.stringify(confirmed.book) };
  c.state.plan = confirmed.book; c.state.nurseryProducerLive.current = { plan: confirmed.book, conflict: false };
}
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const calls: { onTargets: string; onSaveTargets: string }[] = [], effects: Record<string,string> = {}, refreshBodies = new Map<string,string>();
let targetComparison = '';
function inspect(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'HarvestTargetsPanel') {
    const attributes = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(page),
      attribute.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression?.getText(page) : undefined]));
    assert.equal(attributes.saveContext, 'harvestSaveContext');
    assert.ok(attributes.onTargets && attributes.onSaveTargets); calls.push({ onTargets: attributes.onTargets!, onSaveTargets: attributes.onSaveTargets! });
  }
  if (ts.isFunctionDeclaration(node) && node.body && node.name && ['plannerActorIsCurrent','refreshAdmittedStoredPlan'].includes(node.name.text)) refreshBodies.set(node.name.text,node.getText(page));
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === 'sameTargetData') targetComparison = node.initializer?.getText(page) ?? '';
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect') {
    const body = node.arguments[0]?.getText(page) ?? '';
    if (body.includes('const authority = createNurserySaveAuthority')) effects.authority = body;
    if (body.includes('setNurserySaveContext(createNurserySaveContext')) effects.nursery = body;
    if (body.includes('setHarvestSaveContext(createHarvestSaveContext')) effects.harvest = body;
    if (node.arguments[1]?.getText(page) === '[planStorageRevision, plan]') effects.readiness = body;
    if (body.includes('setPlanStorageRevision(value => value + 1)')) effects.listeners = body;
  }
  ts.forEachChild(node,inspect);
}
inspect(page); assert.equal(calls.length,2); assert.equal(refreshBodies.size,2); assert.equal(Object.keys(effects).length,5); assert.ok(targetComparison);
const effectCode = ts.transpileModule([...refreshBodies.values(), ...Object.entries(effects).map(([name,body]) => `const ${name}Effect=${body};`)].join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

test('both actual route target callbacks use request-bound persistence for changes and deletion instead of the old direct proposal bypass', async () => {
  for (const caller of calls) for (const name of ['onTargets','onSaveTargets'] as const) {
    await reset(); const c = parent(); try {
      const callback = Function('saveHarvestTargets',`return (${caller[name]});`)((value: HarvestTarget[], bound?: import('../lib/nursery-save-receipt.ts').HarvestSaveRequest) => c.submit(value,bound));
      const next = name === 'onTargets' ? nextTargets(c) : c.state.plan.harvestTargets.filter((row: HarvestTarget) => row.siteId !== siteId);
      const original = c.context(), bound = request(c,next), result = callback(next,bound);
      assert.equal(result.status,'confirmed'); assert.equal(api.harvestSaveContextIsCurrent(original),false);
      assert.equal(api.harvestSaveResultMatches(result,bound),'device'); assert.equal(api.harvestSaveResultMatches(result,bound),null);
      assert.deepEqual(readBook().harvestTargets?.filter(row => row.siteId === siteId),next.filter((row: HarvestTarget) => row.siteId === siteId));
      const writes=local.writes;assert.notEqual(callback(next).status,'confirmed');assert.equal(local.writes,writes,'an unbound direct callback is only a held proposal');
    } finally {c.dispose();}
  }
});

test('fresh foreign target and nursery changes are retained while the original admitted harvest request and its actual merged source are confirmed', () => {
  const c=parent();try{
    const next=nextTargets(c),bound=request(c,next),base=c.state.planWriteBase.current;
    const fresh=book();fresh.harvestTargets![1].weeklyKg=17;fresh.nursery!.spaces[0].usableM2=11;fresh.updatedAt=Date.now();
    assert.equal(crop.saveCropPlan(fresh),true);assert.equal(c.state.planWriteBase.current,base);assert.equal(api.harvestSaveContextIsCurrent(c.context()),true);
    const result=c.submit(next,bound);assert.equal(result.status,'confirmed');const saved=readBook();
    assert.equal(saved.harvestTargets?.find(row=>row.siteId===otherSite)?.weeklyKg,17);assert.equal(saved.nursery?.spaces[0].usableM2,11);
    assert.equal(api.harvestSaveResultSourceKey(result,bound),api.harvestTargetsSourceKey(siteId,saved.harvestTargets));
    assert.notEqual(api.harvestSaveResultSourceKey(result,bound),api.harvestTargetsSourceKey(siteId,next));
    assert.equal(api.harvestSaveResultMatches(result,bound),'device');assert.ok(api.harvestSaveResultSourceKey(result,bound));
  }finally{c.dispose();}
});

test('one actual authority creates two closed contexts without letting create, begin, commit, read, result or source proofs cross purposes', () => {
  const observers=probe.auth.size,c=parent();try{
    assert.equal(probe.auth.size,observers+1);const h=c.context(),n=c.nurseryContext(),next=nextTargets(c),settings=nursery();
    assert.equal(api.harvestSaveContextIsCurrent(n as unknown as typeof h),false);assert.equal(api.nurserySaveContextIsCurrent(h as unknown as typeof n),false);
    assert.equal(api.createHarvestSaveRequest(n as unknown as typeof h,next),null);assert.equal(api.createNurserySaveRequest(h as unknown as typeof n,settings),null);
    assert.equal(api.createHarvestSaveRequest(h,settings as unknown as HarvestTarget[]),null);assert.equal(api.createNurserySaveRequest(n,[] as unknown as NurserySettings),null);
    const hr=request(c,next),nr=api.createNurserySaveRequest(n,settings);assert.ok(nr);
    assert.equal(api.beginNurserySaveRequest(hr as unknown as typeof nr,n,settings),null);assert.equal(api.beginHarvestSaveRequest(nr as unknown as typeof hr,h,next),null);
    assert.ok(api.beginHarvestSaveRequest(hr,h,next));assert.equal(api.nurserySaveRequestIsCurrent(hr as unknown as typeof nr),false);
    assert.ok(api.beginNurserySaveRequest(nr,n,settings));assert.equal(api.harvestSaveRequestIsCurrent(nr as unknown as typeof hr),false);
    const candidate={...c.state.plan,harvestTargets:next,updatedAt:Date.now()},token=crop.cropPlanWriteToken();assert.ok(token);const writes=local.writes;
    assert.equal(api.commitNurserySaveRequest(hr as unknown as typeof nr,candidate,token).status,'held');assert.equal(local.writes,writes);assert.equal(api.harvestSaveRequestIsCurrent(hr),true);
    assert.equal(api.commitHarvestSaveRequest(nr as unknown as typeof hr,candidate,token).status,'held');assert.equal(api.nurserySaveRequestIsCurrent(nr),true);assert.equal(local.writes,writes);
    const result=api.commitHarvestSaveRequest(hr,candidate,token);assert.equal(result.status,'confirmed');
    assert.equal(api.readNurserySaveConfirmation(result,hr as unknown as typeof nr),null);assert.equal(api.nurserySaveResultSourceKey(result,hr as unknown as typeof nr),null);
    assert.equal(api.nurserySaveResultMatches(result,hr as unknown as typeof nr),null);const confirmed=api.readHarvestSaveConfirmation(result,hr);assert.ok(confirmed);install(c,confirmed);
    assert.equal(api.harvestSaveResultMatches({...result},hr),null);assert.equal(api.harvestSaveResultMatches(result,hr),'device');
    c.reissueContext();const n2=c.nurseryContext(),settings2={...nursery(),spaces:[...nursery().spaces,{id:'new-space',siteId,name:'Synthetic second surface',usableM2:1}]};
    const nr2=api.createNurserySaveRequest(n2,settings2);assert.ok(nr2);const nResult=c.submitNursery(settings2,nr2);assert.equal(nResult.status,'confirmed');
    assert.equal(api.readHarvestSaveConfirmation(nResult,nr2 as unknown as typeof hr),null);assert.equal(api.harvestSaveResultSourceKey(nResult,nr2 as unknown as typeof hr),null);
    assert.equal(api.harvestSaveResultMatches(nResult,nr2 as unknown as typeof hr),null);assert.equal(api.nurserySaveResultMatches(nResult,nr2),'device');
    assert.equal(probe.auth.size,observers+1,'contexts and both saves must not create another actor observer');
  }finally{c.dispose();}assert.equal(probe.auth.size,observers);
});

test('a closed request cannot confirm collateral changes to the other field, unrelated metadata or foreign rows in either direction', async () => {
  for(const purpose of ['harvestTargets','nursery'] as const)for(const damage of ['other-field','metadata','foreign'] as const){
    await reset();const c=parent();try{
      const next=nextTargets(c),settings={...nursery(),spaces:nursery().spaces.map(row=>row.siteId===siteId?{...row,usableM2:5}:row)};
      const bound=purpose==='harvestTargets'?api.createHarvestSaveRequest(c.context(),next):api.createNurserySaveRequest(c.nurseryContext(),settings);assert.ok(bound);
      const prepared=purpose==='harvestTargets'?api.beginHarvestSaveRequest(bound as import('../lib/nursery-save-receipt.ts').HarvestSaveRequest,c.context(),next):api.beginNurserySaveRequest(bound as import('../lib/nursery-save-receipt.ts').NurserySaveRequest,c.nurseryContext(),settings);assert.ok(prepared);
      const candidate=structuredClone(c.state.plan) as CropPlanState;candidate.updatedAt=Date.now();
      if(purpose==='harvestTargets')candidate.harvestTargets=structuredClone(next);else candidate.nursery=structuredClone(settings);
      if(damage==='metadata')candidate.rainPattern='summer';
      if(damage==='other-field'){if(purpose==='harvestTargets')candidate.nursery!.spaces[0].usableM2=99;else candidate.harvestTargets![0].weeklyKg=99;}
      if(damage==='foreign'){if(purpose==='harvestTargets')candidate.harvestTargets!.find(row=>row.siteId===otherSite)!.weeklyKg=99;else candidate.nursery!.spaces.find(row=>row.siteId===otherSite)!.usableM2=99;}
      const before=readCanonicalCropPlanFixtureRaw(),writes=local.writes,token=crop.cropPlanWriteToken();assert.ok(token);
      assert.equal(purpose==='harvestTargets'?api.harvestSaveRequestIsCurrent(bound as import('../lib/nursery-save-receipt.ts').HarvestSaveRequest):api.nurserySaveRequestIsCurrent(bound as import('../lib/nursery-save-receipt.ts').NurserySaveRequest),true,'reach the collateral evidence check with a valid original intent');
      assert.equal(crop.cropPlanWriteCandidateIsLossless(candidate),true,'the failure must be scoped intent, not generic malformed-candidate rejection');
      const result=purpose==='harvestTargets'?api.commitHarvestSaveRequest(bound as import('../lib/nursery-save-receipt.ts').HarvestSaveRequest,candidate,token):api.commitNurserySaveRequest(bound as import('../lib/nursery-save-receipt.ts').NurserySaveRequest,candidate,token);
      assert.equal(result.status,'held',`${purpose}:${damage}`);if(result.status!=='held')throw Error('Unexpected performed collateral write');assert.equal(result.reason,'saved-source-changed');assert.equal(local.writes,writes);assert.equal(readCanonicalCropPlanFixtureRaw(),before);
    }finally{c.dispose();}
  }
});

test('the successful field keeps its own acknowledgment while another panel original dirty request stays retained and held after the shared base changes', () => {
  const c=parent();try{
    const nContext=c.nurseryContext(),draft={...nursery(),spaces:nursery().spaces.map(row=>row.siteId===siteId?{...row,name:'Retain this private unfinished name'}:row)},before=JSON.stringify(draft);
    const pending=api.createNurserySaveRequest(nContext,draft);assert.ok(pending);const next=nextTargets(c),bound=request(c,next),result=c.submit(next,bound);
    assert.equal(result.status,'confirmed');assert.equal(api.harvestSaveResultMatches(result,bound),'device');assert.equal(api.nurserySaveContextIsCurrent(nContext),false);
    const writes=local.writes;assert.notEqual(c.submitNursery(draft,pending).status,'confirmed');assert.equal(local.writes,writes);assert.equal(JSON.stringify(draft),before);
  }finally{c.dispose();}
});

test('an equivalent private context reissue and a harmless fresh same-byte admission do not invalidate the original exact harvest acknowledgment', () => {
  const c=parent();try{
    const context=c.context(),next=nextTargets(c),bound=request(c,next);c.state.plan=structuredClone(c.state.plan);c.state.nurseryProducerLive.current.plan=c.state.plan;
    assert.notEqual(c.reissueContext(),context);assert.equal(api.harvestSaveContextIsCurrent(context),true);
    const result=c.submit(next,bound);assert.equal(result.status,'confirmed');const loaded=crop.loadCropPlanWithWriteAdmission();
    c.state.planWriteBase.current={...c.state.planWriteBase.current,admission:loaded.admission};assert.equal(api.harvestSaveResultMatches(result,bound),'device');
  }finally{c.dispose();}
});

test('changed readback or a real write throwing afterwards stays performed-unconfirmed and cannot be automatically duplicated', async () => {
  for(const mode of ['readback','throw'] as const){await reset();const c=parent(),set=local.setItem;let changed=false;try{
    const next=nextTargets(c),bound=request(c,next);
    local.setItem=function(key,value){set.call(this,key,value);if(!changed&&key.includes('imbewu_crop_plan_v2')){changed=true;if(mode==='throw')throw Error('Synthetic postwrite failure');
      const envelope=JSON.parse(value),saved=JSON.parse(envelope.bookRaw);saved.harvestTargets.find((row:HarvestTarget)=>row.siteId===siteId).weeklyKg=99;this.rows.set(key,JSON.stringify({...envelope,bookRaw:JSON.stringify(saved)}));}};
    const result=c.submit(next,bound);assert.equal(result.status,'performed-unconfirmed');assert.equal(api.harvestSaveResultMatches(result,bound),null);
    assert.equal(api.harvestSaveResultSourceKey(result,bound),null);assert.equal(c.state.planSaveConflict,true);assert.equal(c.state.plan.harvestTargets.find((row:HarvestTarget)=>row.siteId===siteId).weeklyKg,2);
    local.setItem=set;assert.equal(readBook().harvestTargets?.find(row=>row.siteId===siteId)?.weeklyKg,mode==='throw'?5:99);
    const writes=local.writes;c.submit(next,bound);assert.equal(local.writes,writes);
  }finally{local.setItem=set;c.dispose();}}
});

test('fresh own source changes, dirty original display, live actor/site/scope revocation and same-value lease replacement cannot lend a new write grant', async () => {
  for(const change of ['own-source','dirty','actor','site','scope','lease','cleanup'] as const){await reset();const c=parent();try{
    const next=nextTargets(c),bound=request(c,next);
    if(change==='own-source'){const fresh=book();fresh.harvestTargets![0].weeklyKg=9;fresh.updatedAt=Date.now();assert.equal(crop.saveCropPlan(fresh),true);}
    if(change==='dirty'){c.state.plan={...c.state.plan,updatedAt:999};c.state.nurseryProducerLive.current.plan=c.state.plan;}
    if(change==='actor')probe.actor='owner-b';if(change==='site')c.state.growerBookContext.current.siteId=otherSite;if(change==='scope')c.state.growerBookContext.current.scopeKey='another-source';
    if(change==='cleanup')c.dispose();if(change==='lease'){releaseCropPlanFixture();await initialiseCropPlanFixture();}
    const writes=local.writes,result=c.submit(next,bound);assert.notEqual(result.status,'confirmed',change);assert.equal(local.writes,writes,change);
  }finally{c.dispose();}}
});

test('sample and account ABA transitions revoke both closed purposes through the same lifecycle without reviving old requests', () => {
  for(const mode of ['sample','account'] as const){const c=parent();try{
    const next=nextTargets(c),bound=request(c,next),n=c.nurseryContext();
    if(mode==='sample'){sessionStorage.setItem('imbewu_sample_mode','1');events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT));sessionStorage.removeItem('imbewu_sample_mode');events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT));}
    else for(const uid of ['owner-b','owner-a']){probe.actor=uid;account.bindMountedAccountLocalStorageUid(uid);for(const observer of probe.auth)observer({uid});}
    const writes=local.writes;assert.notEqual(c.submit(next,bound).status,'confirmed');assert.equal(api.nurserySaveContextIsCurrent(n),false);assert.equal(local.writes,writes);
  }finally{c.dispose();}}
});

test('sample harvest confirmation is bound to sample memory and never writes physical device records', () => {
  assert.equal(samples.enterSampleMode(),true);samples.setSandboxCropPlan(book());const c=createHarvestSaveFixture(siteId);try{
    // Authored sample objects are valid even when their property insertion
    // order differs from the existing target normalizer's returned objects.
    const raw=c.state.plan.harvestTargets as HarvestTarget[],normalised=crop.sanitiseHarvestTargets(raw);
    assert.notEqual(JSON.stringify(raw.filter(row=>row.siteId!==siteId)),JSON.stringify(normalised.filter(row=>row.siteId!==siteId)));
    assert.equal(api.harvestTargetsSourceKey(siteId,raw),api.harvestTargetsSourceKey(siteId,normalised));
    const before=JSON.stringify([...local.rows]),writes=local.writes,next=nextTargets(c),bound=request(c,next),result=c.submit(next,bound);
    assert.equal(result.status,'confirmed');assert.equal(result.sample,true);assert.equal(api.harvestSaveResultMatches(result,bound),'sample');assert.equal(JSON.stringify([...local.rows]),before);assert.equal(local.writes,writes);
  }finally{c.dispose();}
});

test('absence and valid empty targets permit explicit creation, while duplicate, malformed and metadata-bearing raw claims remain held without being erased', async () => {
  for(const absent of [true,false]){await reset();const raw=book();if(absent)delete raw.harvestTargets;else raw.harvestTargets=[];const c=parent(raw);try{
    const next=[target()],bound=request(c,next),result=c.submit(next,bound);assert.equal(result.status,'confirmed');assert.equal(api.harvestSaveResultMatches(result,bound),'device');
  }finally{c.dispose();}}
  for(const damage of ['duplicate','null-row','metadata'] as const){await reset();const c=parent();try{
    const next=nextTargets(c),bound=request(c,next),raw=book() as CropPlanState & {unknownClaim?:unknown};
    if(damage==='duplicate')raw.harvestTargets!.push({...raw.harvestTargets![0]});if(damage==='null-row')(raw.harvestTargets as unknown[]).unshift(null);if(damage==='metadata')raw.unknownClaim={preserve:'all raw evidence'};
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw));const loaded=crop.loadCropPlanWithWriteAdmission();assert.equal(loaded.admission.status,'held');
    c.state.plan=loaded.book;c.state.nurseryProducerLive.current.plan=loaded.book;c.state.planWriteBase.current={...c.state.planWriteBase.current,token:loaded.token,admission:loaded.admission,planKey:JSON.stringify(loaded.book)};
    assert.equal(api.createHarvestSaveContext(c.state.nurserySaveAuthority),null);const before=readCanonicalCropPlanFixtureRaw(),writes=local.writes;
    assert.notEqual(c.submit(next,bound).status,'confirmed');assert.equal(local.writes,writes);assert.equal(readCanonicalCropPlanFixtureRaw(),before);
  }finally{c.dispose();}}
});

test('descriptor-safe source and intent reads execute no target accessor, and raw evidence identity never silently deduplicates targets', () => {
  const c=parent();try{
    const next=nextTargets(c);let getters=0;Object.defineProperty(next[0],'weeklyKg',{enumerable:true,get(){++getters;return 5;}});
    assert.equal(api.harvestTargetsSourceKey(siteId,next),null);assert.equal(api.createHarvestSaveRequest(c.context(),next),null);assert.equal(getters,0);
    assert.notEqual(api.harvestTargetsSourceKey(siteId,[target(),target()]),api.harvestTargetsSourceKey(siteId,[target()]));
    assert.equal(api.createHarvestSaveRequest({kind:'harvest-save-context'},[]),null);
    const code=ts.transpileModule(`const compare=${targetComparison};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    const compare=Function('harvestTargetsSourceKey','productionSiteId',`${code};return compare;`)(api.harvestTargetsSourceKey,siteId);
    assert.equal(compare(next,next),false,'two unreadable null identities cannot be treated as equal');assert.equal(getters,0);
  }finally{c.dispose();}
});

test('the raw-data namespace comparison still rejects foreign value, metadata and array-order edits before the actual writer', async () => {
  for(const damage of ['value','metadata','order'] as const){await reset();const raw=book();raw.harvestTargets!.push(target('second-foreign',otherSite,7));const c=parent(raw);try{
    let next=structuredClone(nextTargets(c));const foreign=next.filter(row=>row.siteId!==siteId);
    if(damage==='value')foreign[0].weeklyKg=17;if(damage==='metadata')foreign[0].outlet='Another synthetic buyer';
    if(damage==='order')next=[...next.filter(row=>row.siteId===siteId),...foreign.reverse()];
    const fresh=crop.loadCropPlanWithWriteAdmission().book,normalised=crop.sanitiseHarvestTargets(next);
    assert.equal(crop.cropPlanWriteCandidateIsLossless({...fresh,harvestTargets:next},{...fresh,harvestTargets:normalised}),true,'reach namespace comparison with fully valid raw metadata');
    const bound=request(c,next),before=readCanonicalCropPlanFixtureRaw(),writes=local.writes,result=c.submit(next,bound);
    assert.equal(result,false,damage);assert.equal(api.harvestSaveRequestIsCurrent(bound),true,'the actual producer must have consumed the original request before rejecting foreign changes');
    assert.equal(local.writes,writes);assert.equal(readCanonicalCropPlanFixtureRaw(),before);
  }finally{c.dispose();}}
});

test('actual mounted shared parent effects deliver cold contexts after asynchronous readiness, keep one actor observer and renew only a clean same-byte lease', async () => {
  const observers=probe.auth.size,c=parent();c.dispose();releaseCropPlanFixture();await Promise.resolve();
  const held=crop.loadCropPlanWithWriteAdmission();assert.equal(held.admission.status,'held');
  c.state.plan=held.book;c.state.planWriteBase.current={...c.state.planWriteBase.current,token:held.token,admission:held.admission,planKey:JSON.stringify(held.book)};
  Object.assign(c.state,{createNurserySaveAuthority:api.createNurserySaveAuthority,revokeNurserySaveAuthority:api.revokeNurserySaveAuthority,
    createNurserySaveContext:api.createNurserySaveContext,createHarvestSaveContext:api.createHarvestSaveContext,
    CROP_PLAN_CHANGED_EVENT:crop.CROP_PLAN_CHANGED_EVENT,CROP_PLAN_STORAGE_EVENT:storage.CROP_PLAN_STORAGE_EVENT,
    SAMPLE_MODE_EVENT:samples.SAMPLE_MODE_EVENT,
    planStorageRevision:0,handledPlanStorageRevision:{current:0}});
  const actual=Function('state',`with(state){${effectCode};return {authorityEffect,nurseryEffect,harvestEffect,readinessEffect,listenersEffect};}`)(c.state);
  let renderer!:ReactTestRenderer,observedContext:import('../lib/nursery-save-receipt.ts').HarvestSaveContext|null=null,destination:string|null=null;
  function Lifecycle(){
    const [authority,setAuthority]=useState<import('../lib/nursery-save-receipt.ts').NurserySaveAuthority|null>(null);
    const [hContext,setHarvest]=useState<import('../lib/nursery-save-receipt.ts').HarvestSaveContext|null>(null);
    const [nContext,setNursery]=useState<import('../lib/nursery-save-receipt.ts').NurserySaveContext|null>(null);
    const [plan,setPlan]=useState(c.state.plan),[conflict,setConflict]=useState(true),[revision,setRevision]=useState(0);
    Object.assign(c.state,{nurserySaveAuthority:authority,harvestSaveContext:hContext,nurserySaveContext:nContext,
      plan,planSaveConflict:conflict,planStorageRevision:revision,setPlan,setPlanSaveConflict:setConflict,setPlanStorageRevision:setRevision,
      setNurserySaveAuthority:setAuthority,setHarvestSaveContext:setHarvest,setNurserySaveContext:setNursery});
    c.state.nurseryProducerLive.current={plan,conflict};observedContext=hContext;
    useEffect(actual.listenersEffect,[]);useEffect(actual.readinessEffect,[revision,plan]);
    useEffect(actual.authorityEffect,[c.state.growerOwner,c.state.growerSample,c.state.productionSiteId,c.state.growerScopeKey,conflict]);
    useEffect(actual.nurseryEffect,[authority,plan,conflict,revision]);useEffect(actual.harvestEffect,[authority,plan,conflict,revision]);
    return React.createElement('div',{},React.createElement('button',{disabled:!api.harvestSaveContextIsCurrent(hContext),onClick(){
      const next=nextTargets(c,6),bound=api.createHarvestSaveRequest(hContext,next);assert.ok(bound);
      const result=c.submit(next,bound);destination=api.harvestSaveResultMatches(result,bound);
    }},'Save through actual parent'),React.createElement('button',{onClick(){setPlan({...plan,harvestTargets:nextTargets(c,13),updatedAt:Date.now()+1});}},'Leave an unsaved display edit'));
  }
  try{
    act(()=>{renderer=create(React.createElement(Lifecycle));});assert.equal(renderer.root.findAllByType('button')[0].props.disabled,true);assert.equal(observedContext,null);
    await act(async()=>{await initialiseCropPlanFixture();});assert.equal(renderer.root.findAllByType('button')[0].props.disabled,false);assert.equal(probe.auth.size,observers+1);
    act(()=>renderer.root.findAllByType('button')[0].props.onClick());assert.equal(destination,'device');const old=observedContext,bytes=readCanonicalCropPlanFixtureRaw();assert.ok(old);
    act(()=>releaseCropPlanFixture());assert.equal(api.harvestSaveContextIsCurrent(old),false);assert.equal(renderer.root.findAllByType('button')[0].props.disabled,true);
    await act(async()=>{await initialiseCropPlanFixture();});assert.equal(readCanonicalCropPlanFixtureRaw(),bytes);assert.equal(renderer.root.findAllByType('button')[0].props.disabled,false);
    assert.equal(api.harvestSaveContextIsCurrent(old),false);assert.equal(probe.auth.size,observers+1);act(()=>renderer.root.findAllByType('button')[0].props.onClick());assert.equal(destination,'device');
    const writes=local.writes;act(()=>renderer.root.findAllByType('button')[1].props.onClick());
    act(()=>{events.dispatchEvent(new Event(crop.CROP_PLAN_CHANGED_EVENT));});
    assert.equal(c.state.plan.harvestTargets.find((row:HarvestTarget)=>row.siteId===siteId).weeklyKg,13,'a source event cannot erase the dirty display');
    assert.equal(renderer.root.findAllByType('button')[0].props.disabled,true);assert.equal(local.writes,writes);assert.equal(readBook().harvestTargets?.find(row=>row.siteId===siteId)?.weeklyKg,6);
  }finally{if(renderer)act(()=>renderer.unmount());c.dispose();}assert.equal(probe.auth.size,observers);
});
