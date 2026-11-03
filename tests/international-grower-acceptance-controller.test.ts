import { initialiseCropPlanFixture, readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import { crop, account, samples, local, events, probe, bookKey, studioKey, studio, facilitator, ownRow, reset, cleanup, siteId, pauseHashes } from './international-grower-operations-fixture.ts';
import { growerPlanningScopeKey, normaliseGrowerPlanningProfiles } from '../lib/international/grower-planning.ts';
import { prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import { sanitiseNurserySettings } from '../lib/nursery-settings.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';

const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return data(`export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/crops/GrowerAutoPlanPanel.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
beforeEach(reset); after(() => { hooks.deregister(); cleanup(); });

// All quantities, dates, IDs and geometry are synthetic engineering fixtures.
// The actual hook, source reader/hash, assembler, acceptance preparation and
// parent writer execute; only auth/network, React state and memory IO are bounded.
const scope = { kind: 'mapped-site' as const, siteId };
const otherSite = 'site:2.00000,2.00000';
const target = (id = 'buyer', site = siteId): Extract<HarvestTarget,{weeklyKg:number}> => ({ id, siteId: site, cropKey: CROPS[0].key,
  startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 7, marketablePercent: 100 });
const draft = (): GrowerWorkflowDraft => ({ planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
  targetProfiles: [{ targetId: 'buyer', profileId: 'own-estimate' }], available: [{ bedId: 'bed-a', start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true }], assumptionsConfirmed: true });
async function fixture() {
  const own = await ownRow(), foreignRaw = studio(); foreignRaw.siteId = otherSite; foreignRaw.frame.centerLat = 2; foreignRaw.frame.centerLng = 2; foreignRaw.items[0].id = 'foreign-bed';
  const foreign = await ownRow(foreignRaw, 'studio-canvas', otherSite, 'foreign-record');
  const nursery = sanitiseNurserySettings({ version: 1, spaces: [], profiles: [], containers: [
    { id: 'ambiguous', siteId, name: 'Current fixture', cells: 12 }, { id: 'ambiguous', siteId: otherSite, name: 'Foreign fixture', cells: 24 }] });
  const book: CropPlanState = { version: 1, updatedAt: 7, plantings: [foreign.row], growerPlanningProfiles: [own.row.growerCycle.assessmentSnapshot.profile],
    harvestTargets: [target(), target('other-buyer', otherSite)], nursery,
    rainPattern: 'summer', planNotes: [{ kind: 'basis', text: 'Prior saved explanation' }], planNotesAt: Date.UTC(2025,0,1),
    productionRecords: [{ id: 'actual-record', siteId, sourceIconKey: `crop:${CROPS[0].key}`, label: 'Recorded fixture', date: { year: 2025, month: 1 }, quantity: 3, unit: 'kg', status: 'actual', provenance: 'farm-record' }], preservedProducts: [] };
  return { book, foreign: foreign.row };
}
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent','growerActorIsCurrent','readCurrentGrowerBook','commitGrowerAcceptance','rememberStoredPlan','saveGrowerProfiles','saveScopedGrowerInputs'];
const bodies = new Map<string,string>(); let mount = '';
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) bodies.set(node.name.text,node.getText(page));
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect' && node.arguments[0]?.getText(page).includes('setDesign(loadFacilitatorState())')) mount=node.arguments[0].getText(page);
  ts.forEachChild(node,visit);
}
visit(page); assert.equal(bodies.size,names.length); assert.ok(mount);
const compiled=ts.transpileModule([...bodies.values(),`const runMount=${mount};`].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function parent(book: unknown, resourceSiteId=siteId) {
  if(samples.isSampleMode()) samples.setSandboxCropPlan(book as CropPlanState); else replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book));
  let notify=()=>{};
  const state:any={plan:null,planWriteBase:{current:null},planSaveConflict:false,planSaveFailed:false,saveTimer:{current:null},
    growerOwner:account.activeAccountUid(),growerSample:samples.isSampleMode(),growerScope:scope,growerScopeKey:growerPlanningScopeKey(scope),productionSiteId:resourceSiteId,
    growerWriteScope:{current:{key:growerPlanningScopeKey(scope),owner:account.activeAccountUid(),sample:samples.isSampleMode()}},
    growerBookContext:{current:{siteId:resourceSiteId,owner:account.activeAccountUid(),sample:samples.isSampleMode(),scopeKey:growerPlanningScopeKey(scope)}},
    activeAccountUid:account.activeAccountUid,isSampleMode:samples.isSampleMode,isBackendConfigured:()=>probe.configured,getFirebase:()=>({auth:{currentUser:probe.actor?{uid:probe.actor}:null}}),
    readRawCropPlanReceipt:crop.readRawCropPlanReceipt,loadCropPlanWithWriteAdmission:crop.loadCropPlanWithWriteAdmission,cropPlanWriteAdmissionMatches:crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless:crop.cropPlanWriteCandidateIsLossless,cropPlanWriteToken:crop.cropPlanWriteToken,saveCropPlanWithReceipt:crop.saveCropPlanWithReceipt,
    prepareGrowerWorkflowAcceptance,growerPlanningScopeKey,normaliseGrowerPlanningProfiles,sanitiseHarvestTargets:crop.sanitiseHarvestTargets,sanitiseNurserySettings,
    clearTimeout(){},setPlan(value:any){state.plan=typeof value==='function'?value(state.plan):value;notify();},setPlanSaveConflict(value:boolean){state.planSaveConflict=value;},setPlanSaveFailed(value:boolean){state.planSaveFailed=value;},
    setDesign(){},loadFacilitatorState:()=>null,setCurrentMonth(){},setCurrentYear(){},setFavouriteCropKeys(){},loadFavouriteCropKeys:()=>new Set(),
    setAllowBedSharing(){},loadAllowBedSharing:()=>false,setPriceOverrides(){},loadCropPriceOverrides:()=>({}),setCashflowSettings(){},loadCashflowSettings:()=>({}),setMounted(){},
    myDesigns:()=>Promise.resolve([]),setMyDesignsList(){},setStudioChoices(){},studioPlanChoices:()=>[],loadPlaces:()=>[],loadCanvasState:()=>null};
  const functions=Function('state',`with(state){${compiled};return {${names.join(',')},runMount};}`)(state);
  functions.runMount();assert.equal(state.planSaveConflict,false,'canonical fixture must have actual loaded admission');
  return {state,...functions,notify(callback:()=>void){notify=callback;}};
}
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(item=>text(item as ReactTestInstance|string)).join('');
function mounted(controller:ReturnType<typeof parent>) {
  let current=controller,renderer!:ReactTestRenderer,latest!:ReturnType<typeof useGrowerWorkflow>,counter=0;
  let reviewPending:Promise<GrowerWorkflowReview>|null=null,acceptPending:Promise<unknown>|null=null;
  let id=()=>`persistent-${++counter}`;let selection:Parameters<typeof useGrowerWorkflow>[0]['selection']={kind:'studio-canvas',sourceId:siteId};
  function App(){const [,render]=React.useState(0),expectedActor=current.growerActorIsCurrent;current.notify(()=>render(value=>value+1));
    latest=useGrowerWorkflow({selection,scope,resourceSiteId:current.state.productionSiteId,book:current.state.plan,actorIsCurrent:()=>expectedActor(),readCurrentBook:current.readCurrentGrowerBook,commitAcceptance:current.commitGrowerAcceptance,createPlantingId:()=>id()});
    return React.createElement(Panel,{scope,source:latest.source,sourceName:'Synthetic garden',sourceIssue:latest.sourceIssue,checking:latest.checking,contextRevision:latest.contextRevision,
      profiles:current.state.plan.growerPlanningProfiles??[],targets:current.state.plan.harvestTargets??[],targetSiteId:current.state.productionSiteId,onRefresh:latest.onRefresh,onReview:(value:GrowerWorkflowDraft)=>{reviewPending=latest.onReview(value);return reviewPending;},onAccept:(review:Extract<GrowerWorkflowReview,{status:'review'}>,guard:()=>boolean)=>{acceptPending=latest.onAccept(review,guard);return acceptPending as ReturnType<typeof latest.onAccept>;},acceptance:latest.acceptance});}
  act(()=>{renderer=create(React.createElement(App));});
  const field=(label:string)=>{const node=renderer.root.findAllByType('label').find(item=>text(item).startsWith(label));assert.ok(node,label);return node.findAll(item=>item.type==='input'||item.type==='select')[0];};
  const find=(label:string)=>{const node=renderer.root.findAllByType('button').find(item=>text(item)===label);assert.ok(node,label);return node;};
  return {controller,get pending(){return acceptPending;},get latest(){return latest;},get renderer(){return renderer;},text:()=>text(renderer.root),
    field,change(label:string,value:string){act(()=>field(label).props.onChange({target:{value}}));},check(label:string){act(()=>field(label).props.onChange({target:{checked:true}}));},
    async click(label:string){const previous=reviewPending;await act(async()=>{await find(label).props.onClick();if(reviewPending!==previous)await reviewPending;});},button:find,
    setIds(fn:()=>string){id=fn;},select(value:typeof selection){selection=value;act(()=>renderer.update(React.createElement(App)));},
    replace(next:ReturnType<typeof parent>){current=next;act(()=>renderer.update(React.createElement(App)));},
    rerender(){act(()=>renderer.update(React.createElement(App)));},
    async refresh(){await act(async()=>{await latest.onRefresh();});},
    async review(){let result!:GrowerWorkflowReview;await act(async()=>{result=await latest.onReview(draft());});assert.equal(result.status,'review',result.issues.join(','));if(result.status!=='review')throw Error('fixture held');return result;},
    async accept(review:Extract<GrowerWorkflowReview,{status:'review'}>,guard=()=>true){let result!:Awaited<ReturnType<typeof latest.onAccept>>;await act(async()=>{result=await latest.onAccept(review,guard);});return result;},
    dispose(){act(()=>renderer.unmount());}};
}
async function ready() {const f=await fixture();local.setItem(studioKey(),JSON.stringify(studio()));const c=parent(f.book),ui=mounted(c);await ui.refresh();return {...f,c,ui};}
function fill(ui:ReturnType<typeof mounted>){ui.check(`Include ${CROPS[0].name}`);ui.change('Growing estimate for this target','own-estimate');ui.change('First planning date','2028-12-01');ui.change('Planning ends before','2029-01-01');ui.change('Search work limit','1000');ui.check('I confirm availability');ui.change('Available from','2028-12-01');ui.change('Available until','2029-01-01');ui.check('I supply these planning dates');}

test('actual mounted review save appends every canonical cycle once and preserves foreign evidence, nursery claims and observed records',async()=>{
  const {ui,c,book,foreign}=await ready();try{fill(ui);await ui.click('Review automatic crop plan');const save=ui.renderer.root.findAllByType('button').find(node=>text(node).startsWith('Save all '));assert.ok(save);const writes=local.writes;
   await act(async()=>{save.props.onClick();save.props.onClick();await ui.pending;});
   const saved=JSON.parse(readCanonicalCropPlanFixtureRaw());assert.ok(saved.plantings.length>2);assert.equal(local.writes,writes+1);assert.deepEqual(saved.plantings[0],foreign);
   assert.equal(new Set(saved.plantings.map((row:any)=>row.id)).size,saved.plantings.length);for(const row of saved.plantings.slice(1)){assert.ok(row.id.startsWith('persistent-'));assert.equal(row.existing,undefined);assert.equal(row.confirmedOnceSowing,undefined);assert.equal(row.harvestTargetId,'buyer');}
   for(const key of ['nursery','productionRecords','preservedProducts','planNotes','planNotesAt','rainPattern'])assert.deepEqual(saved[key],book[key as keyof CropPlanState],key);
   assert.match(ui.text(),/planned crop cycles saved on this device/);assert.match(ui.text(),/No sowing, harvest, stock or sales have been recorded/);assert.doesNotMatch(ui.text(),/No crop cycle has been added/);assert.equal(c.state.planSaveConflict,false);
   ui.change('First planning date','2028-12-02');assert.doesNotMatch(ui.text(),/planned crop cycles saved on this device/,'a new draft must not inherit the prior save claim');
  }finally{ui.dispose();}
 });

test('copied or altered review identities and foreign/new persistent-ID collisions cannot save a subset',async()=>{
 const {ui,c,foreign}=await ready();try{const review=await ui.review(),before=local.getItem(bookKey()),writes=local.writes;
  assert.equal((await ui.accept({...review})).status,'held');assert.equal((await ui.accept(review,()=>{throw Error('synthetic revoked display');})).status,'held');const altered={...review,targetMetadata:review.targetMetadata.map((row,index)=>index===0?{...row,buyerTotalKg:row.buyerTotalKg+1}:row)};assert.equal((await ui.accept(altered)).status,'held');ui.setIds(()=>foreign.id);assert.equal((await ui.accept(review)).status,'held');ui.setIds(()=> 'duplicate-new-id');assert.equal((await ui.accept(review)).status,'held');assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);assert.equal(c.state.planSaveConflict,false);
 }finally{ui.dispose();}
});

test('a raw Firebase transition and an identical later account cannot adopt the original private review',async()=>{
 const {ui,book}=await ready();try{const review=await ui.review(),retainedSource=ui.latest.source;assert.ok(retainedSource);ui.rerender();assert.equal(ui.latest.source,retainedSource,'new inline actor callbacks alone must not revoke a checked source');probe.actor='owner-b';const old=local.getItem(bookKey()),writes=local.writes;assert.equal((await ui.accept(review)).status,'held');assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),old);
  account.bindMountedAccountLocalStorageUid('owner-b');await initialiseCropPlanFixture();local.setItem(studioKey(),JSON.stringify(studio()));const next=parent(book);ui.replace(next);assert.equal(ui.latest.source,null,'the same selection cannot retain the earlier account’s checked source');assert.match(ui.text(),/No current design has been checked/);assert.match(ui.text(),/No eligible saved bed or field-plot measurements/);await ui.refresh();const nextWrites=local.writes,nextBytes=local.getItem(bookKey());assert.equal((await ui.accept(review)).status,'held');assert.equal(local.writes,nextWrites);assert.equal(local.getItem(bookKey()),nextBytes);
 }finally{ui.dispose();}
});

test('source movement, dismissed draft and unmount while actual hashing waits cannot write a withdrawn proposal',async()=>{
 for(const change of ['source','draft','unmount']){await reset();const {ui}=await ready();let disposed=false;try{fill(ui);await ui.click('Review automatic crop plan');const node=ui.renderer.root.findAllByType('button').find(item=>text(item).startsWith('Save all '));assert.ok(node);const bytes=local.getItem(bookKey()),writes=local.writes,gate=pauseHashes();
  let pending!:Promise<void>;act(()=>{node.props.onClick();pending=ui.pending as Promise<void>;});await gate.started;
  if(change==='source'){const moved=studio();moved.items[0].x+=0.1;local.setItem(studioKey(),JSON.stringify(moved));}
  if(change==='draft')ui.change('Search work limit','500');if(change==='unmount'){ui.dispose();disposed=true;}
  await act(async()=>{gate.resume();await pending;});assert.equal(local.writes,writes+(change==='source'?1:0),change);assert.equal(local.getItem(bookKey()),bytes,change);if(change==='source')assert.equal(ui.latest.source,null,'a detected changed source must no longer look checked');
 }finally{if(!disposed)ui.dispose();}}
});

test('final source revocation, dirty book, fresh occupancy and save-event overwrite retain truthful write outcomes',async()=>{
 for(const change of ['final-source','final-actor','final-base','final-token','dirty','external','superseded']){await reset();const {ui,c,book}=await ready();try{const review=await ui.review(),before=local.getItem(bookKey()),writes=local.writes;
  let changed=false,id=0;
  if(change.startsWith('final-'))ui.setIds(()=>{if(!changed){changed=true;
   if(change==='final-source'){const moved=studio();moved.items[0].x+=0.1;local.setItem(studioKey(),JSON.stringify(moved));}
   if(change==='final-actor')probe.actor='owner-b';if(change==='final-base')c.state.planWriteBase.current={...c.state.planWriteBase.current};
   if(change==='final-token')replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:1234}));
  }return `new-id-${++id}`;});
  if(change==='dirty')c.state.plan={...c.state.plan,updatedAt:99};
  if(change==='external')replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,plantings:[...book.plantings,{id:'late-legacy',bedId:'bed-a',cropKey:CROPS[0].key,sowMonth:12}]}));
  const overwrite=()=>replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:1234}));if(change==='superseded')events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,overwrite,{once:true});
  const result=await ui.accept(review);assert.equal(result.status,change==='superseded'?'superseded':'held',change);if(change==='final-source')assert.equal(ui.latest.source,null);
  if(change==='dirty')assert.equal(local.getItem(bookKey()),before);if(change==='superseded'){assert.equal(c.state.planSaveConflict,true);assert.match(ui.text(),/write completed, but the current saved plan could not be confirmed/);assert.equal((await ui.accept(review)).status,'held');}
  else assert.ok(local.writes===writes+(['external','final-source','final-token'].includes(change)?1:0),change);
 }finally{ui.dispose();}}
});

test('failed real storage retains the review for a manual retry and a successful receipt cannot replay',async()=>{
 const {ui,c}=await ready();try{const review=await ui.review(),before=local.getItem(bookKey()),base=c.state.planWriteBase.current;const actual=local.setItem;
  local.setItem=()=>{throw Error('synthetic quota');};try{assert.equal((await ui.accept(review)).status,'failed');}finally{local.setItem=actual;}
  assert.equal(local.getItem(bookKey()),before);assert.equal(c.state.planWriteBase.current,base);assert.match(ui.text(),/could not be saved/);
  assert.equal((await ui.accept(review)).status,'confirmed');const writes=local.writes;assert.equal((await ui.accept(review)).status,'held');assert.equal(local.writes,writes);
 }finally{ui.dispose();}
});


test('sample acceptance stays in its example book and late unsafe replacement or exit cannot inherit its original review',async()=>{
 for(const change of ['save','unsafe','exit']){await reset();const real=await fixture();replaceCanonicalCropPlanFixtureRaw(JSON.stringify(real.book));const physical=JSON.stringify([...local.rows]);assert.equal(samples.enterSampleMode(),true);
  const {ui,c}=await ready();try{const review=await ui.review();
   if(change==='unsafe'){let calls=0;const unsafe:any={...samples.getSandboxCropPlan()};Object.defineProperty(unsafe,'hiddenEvidence',{enumerable:true,get(){calls++;return undefined;}});samples.setSandboxCropPlan(unsafe);assert.equal((await ui.accept(review)).status,'held');assert.equal(calls,0);assert.equal(samples.getSandboxCropPlan(),unsafe);}
   else if(change==='exit'){const gate=pauseHashes();let pending!:ReturnType<typeof ui.latest.onAccept>;act(()=>{pending=ui.latest.onAccept(review);});await gate.started;samples.exitSampleMode();await act(async()=>{gate.resume();assert.equal((await pending).status,'held');});}
   else{const result=await ui.accept(review);assert.equal(result.status,'confirmed');if(result.status==='confirmed')assert.equal(result.sample,true);assert.match(ui.text(),/DEMO.*planned crop cycles saved in the example workspace/);assert.ok(samples.getSandboxCropPlan().plantings.length>real.book.plantings.length);assert.equal(c.state.planSaveConflict,false);}
   assert.equal(JSON.stringify([...local.rows]),physical,change);
  }finally{ui.dispose();samples.exitSampleMode();}
 }
});

test('acceptance installs the legitimately settled display and preserves an admitted newer nursery namespace without recreating an old book',async()=>{
 for(const change of ['settlement','equipment']){await reset();const f=await fixture(),legacy={id:'old-unconfirmed',bedId:'outside-selected-beds',cropKey:CROPS[0].key,sowMonth:1,once:'2020-01'};
  local.setItem(studioKey(),JSON.stringify(studio()));const c=parent({...f.book,plantings:[...f.book.plantings,legacy]}),ui=mounted(c);try{await ui.refresh();const review=await ui.review();assert.equal(c.state.plan.plantings[1].awaitingSowingConfirmation,true);
   if(change==='equipment'){const external={...JSON.parse(readCanonicalCropPlanFixtureRaw()),nursery:{...c.state.plan.nursery,spaces:[{id:'new-foreign-space',siteId:otherSite,name:'New independent fixture',usableM2:4}]},updatedAt:Date.now()};assert.equal(crop.saveCropPlan(external),true);
    const own={...c.state.plan.nursery,spaces:[{id:'own-new-space',siteId,name:'Own fixture',usableM2:2}]};let saved=false;await act(async()=>{saved=c.saveScopedGrowerInputs('nursery',own);});assert.equal(saved,true);}
   const nursery=structuredClone(c.state.plan.nursery);assert.equal((await ui.accept(review)).status,'confirmed',change);assert.equal(c.state.planSaveConflict,false);assert.equal(c.state.plan.plantings[1].awaitingSowingConfirmation,true);assert.equal(c.state.plan.plantings[1].existing,undefined);assert.deepEqual(c.state.plan.nursery,nursery);
   assert.equal(crop.cropPlanWriteAdmissionMatches(c.state.planWriteBase.current.admission,c.state.planWriteBase.current.planKey,c.state.planWriteBase.current.token),true);
  }finally{ui.dispose();}
 }
});

test('a late real cloud-source fetch cannot cross raw-account, sample, selection or equal-area source changes',async()=>{
 for(const change of ['account','sample','selection','source']){await reset();const f=await fixture(),resource='design:owned-design',cloud={id:'owned-design',owner_id:'owner-a',data:facilitator(true)};
  probe.cloud=async()=>[cloud];const c=parent({...f.book,harvestTargets:[target('buyer',resource)]},resource),ui=mounted(c);try{ui.select({kind:'facilitator-cloud',sourceId:'owned-design'});await ui.refresh();const review=await ui.review(),bytes=local.getItem(bookKey()),writes=local.writes;
   let release!:(rows:unknown[])=>void,started!:()=>void;const start=new Promise<void>(done=>{started=done;});probe.cloud=()=>{started();return new Promise(done=>{release=done;});};
   let pending!:ReturnType<typeof ui.latest.onAccept>;act(()=>{pending=ui.latest.onAccept(review);});await start;
   if(change==='account')probe.actor='owner-b';if(change==='sample')samples.enterSampleMode();if(change==='selection')ui.select({kind:'studio-canvas',sourceId:siteId});if(change==='source')cloud.data.items[0].x+=1;
   await act(async()=>{release([cloud]);assert.equal((await pending).status,'held',change);});assert.equal(local.writes,writes);if(change==='sample')samples.exitSampleMode();assert.equal(local.getItem(bookKey()),bytes);
  }finally{ui.dispose();samples.exitSampleMode();}
 }
});

test('incomplete actual engine results remain reviews without a save button and cannot pass the controller writer',async()=>{
 const f=await fixture();f.book.harvestTargets![0]={...target(),weeklyKg:100000};local.setItem(studioKey(),JSON.stringify(studio()));const c=parent(f.book),ui=mounted(c);
 try{await ui.refresh();fill(ui);ui.change('Search work limit','1');await ui.click('Review automatic crop plan');assert.equal(ui.renderer.root.findAllByType('button').some(node=>text(node).startsWith('Save all ')),false);
  const review=await ui.review();assert.notEqual(review.proposal.status,'ready');const bytes=local.getItem(bookKey()),writes=local.writes;assert.equal((await ui.accept(review)).status,'held');assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),bytes);
 }finally{ui.dispose();}
});


test('a retained original acceptance callback cannot acquire a new epoch after its hook has unmounted',async()=>{
 const {ui}=await ready(),review=await ui.review(),before=local.getItem(bookKey()),writes=local.writes,accept=ui.latest.onAccept;ui.dispose();
 assert.equal((await accept(review)).status,'held');assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);
});


test('a later externally replaced book clears a prior confirmed save claim without disguising an unconfirmed write as a retry',async()=>{
 const {ui,book}=await ready();try{const review=await ui.review();assert.equal((await ui.accept(review)).status,'confirmed');assert.match(ui.text(),/planned crop cycles saved on this device/);
  await act(async()=>{assert.equal(crop.saveCropPlan({...book,updatedAt:Date.now()}),true);});assert.equal(ui.latest.acceptance.status,'idle');assert.doesNotMatch(ui.text(),/planned crop cycles saved on this device/);assert.match(ui.text(),/saved plan changed or has unresolved edits/);
 }finally{ui.dispose();}
});
