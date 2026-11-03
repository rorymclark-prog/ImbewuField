import { readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, beforeEach } from 'node:test';
import ts from 'typescript';
import { crop, account, samples, local, events, probe, bookKey, ownRow, reset, cleanup, siteId, stamp } from './international-grower-operations-fixture.ts';
import { normaliseGrowerPlanningProfiles, growerPlanningScopeKey } from '../lib/international/grower-planning.ts';
import { sanitiseNurserySettings } from '../lib/nursery-settings.ts';
import { createWorkspacePlanningReference, replaceWorkspacePlanningReference, sanitiseWorkspacePlanningReferences } from '../lib/international/workspace-context.ts';
import { hasGrowerCycleMarker } from '../lib/international/grower-cycle.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
beforeEach(reset); after(cleanup);

// All quantities, dates and identities here are synthetic engineering fixtures,
// never crop guidance. Every book read/write uses the real in-memory authorities.
const otherSite = 'site:2.00000,2.00000';
function target(id = 'own-target', site = siteId): HarvestTarget {
  return { id, siteId: site, cropKey: CROPS[0].key, startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 1, marketablePercent: 100 };
}
async function canonical() {
  const f = await ownRow();
  const profile = f.row.growerCycle.assessmentSnapshot.profile;
  const book: CropPlanState = { version: 1, plantings: [f.row], updatedAt: 7,
    growerPlanningProfiles: [profile], harvestTargets: [target(), target('foreign-target', otherSite)],
    nursery: { version: 1, spaces: [{ id: 'own-space', siteId, name: 'Own fixture', usableM2: 2 },
      { id: 'foreign-space', siteId: otherSite, name: 'Foreign fixture', usableM2: 3 }], containers: [], profiles: [] } };
  return { ...f, book, profile };
}
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'rememberStoredPlan', 'saveGrowerProfiles',
  'saveWorkspaceReference', 'saveScopedGrowerInputs', 'pushPlanHistory', 'planHistoryMetadataKey', 'stageSuggestedPlanHistory', 'undoLastChange', 'acceptAutoSuggest'];
const bodies = new Map<string,string>(); let autosave = '', mount = '', targetAccept = '', historyCommit = '';
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) bodies.set(node.name.text, node.getText(page));
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect') {
    if (node.arguments[1]?.getText(page) === '[plan, planSaveConflict]') autosave = node.arguments[0].getText(page);
    if (node.arguments[0]?.getText(page).includes('setDesign(loadFacilitatorState())')) mount = node.arguments[0].getText(page);
    if (node.arguments[1]?.getText(page) === '[plan]' && node.arguments[0]?.getText(page).includes('suggestedPlanHistory.current.get(plan)')) historyCommit = node.arguments[0].getText(page);
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'HarvestTargetsPanel') {
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(page) === 'onAccept');
    if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression?.getText(page).includes('stageSuggestedPlanHistory')) targetAccept = attribute.initializer.expression.getText(page);
  }
  ts.forEachChild(node, visit);
}
visit(page); assert.equal(bodies.size,names.length); assert.ok(autosave); assert.ok(mount); assert.ok(targetAccept); assert.ok(historyCommit);
const compiled = ts.transpileModule([...bodies.values(), `const runAutosave=${autosave}; const runMount=${mount}; const runTargetAccept=${targetAccept}; const commitHistory=${historyCommit};`].join('\n'),
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;

/** Actual mount, debounce and parent writer bodies. Only external UI startup,
 * Firebase identity and the state/timer boundary are controlled; no alternate
 * write-admission implementation or guessed loaded token exists in this harness. */
function parent(raw?: unknown) {
  if (raw !== undefined) replaceCanonicalCropPlanFixtureRaw(typeof raw === 'string' ? raw : JSON.stringify(raw));
  const queued: Array<()=>void> = [];
  const scope = {kind:'mapped-site' as const,siteId};
  const state: any = { plan:null,planWriteBase:{current:null},planSaveConflict:false,planSaveFailed:false,
    planHistory:[],planHistoryContext:{current:new WeakMap()},suggestedPlanHistory:{current:new WeakMap()},PLAN_HISTORY_LIMIT:10,planningScopeKey:'fixture-selected-source',beds:[{id:'bed-a',label:'Fixture bed',areaM2:8},{id:'legacy-shown',label:'Legacy fixture',areaM2:8}],
    growerOwner:account.activeAccountUid(),growerSample:samples.isSampleMode(),growerScopeKey:growerPlanningScopeKey(scope),productionSiteId:siteId,
    surveySiteId:null,planningWorkspaceId:'virtual-bed',growerWriteScope:{current:{key:growerPlanningScopeKey(scope),owner:account.activeAccountUid(),sample:samples.isSampleMode()}},
    growerBookContext:{current:{siteId,owner:account.activeAccountUid(),sample:samples.isSampleMode(),scopeKey:growerPlanningScopeKey(scope)}},
    hasOwnRecords:false,pattern:'winter',autoResult:null,suggestionScopeRef:{current:'fixture-selected-source'},
    setAutoResult(value:any){state.autoResult=value;},setAutoPhase(){},
    saveTimer:{current:null},setTimeout(fn:()=>void){queued.push(fn);return queued.length;},clearTimeout(){},
    activeAccountUid:account.activeAccountUid,isSampleMode:samples.isSampleMode,isBackendConfigured:()=>probe.configured,
    getFirebase:()=>({auth:{currentUser:probe.actor?{uid:probe.actor}:null}}),
    loadCropPlanWithWriteAdmission:crop.loadCropPlanWithWriteAdmission,cropPlanWriteAdmissionMatches:crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless:crop.cropPlanWriteCandidateIsLossless,cropPlanWriteToken:crop.cropPlanWriteToken,
    saveCropPlanWithReceipt:crop.saveCropPlanWithReceipt,hasGrowerCycleMarker,
    normaliseGrowerPlanningProfiles,growerPlanningScopeKey,sanitiseHarvestTargets:crop.sanitiseHarvestTargets,sanitiseNurserySettings,
    replaceWorkspacePlanningReference,sanitiseWorkspacePlanningReferences,currentPlanningScopeAllowed:()=>true,
    setPlan(value:any){state.plan=typeof value==='function'?value(state.plan):value;},setPlanHistory(fn:any){state.planHistory=fn(state.planHistory);},
    setPlanSaveConflict(value:boolean){state.planSaveConflict=value;},setPlanSaveFailed(value:boolean){state.planSaveFailed=value;},
    setDesign(){},loadFacilitatorState:()=>null,setCurrentMonth(){},setCurrentYear(){},setFavouriteCropKeys(){},loadFavouriteCropKeys:()=>new Set(),
    setAllowBedSharing(){},loadAllowBedSharing:()=>false,setPriceOverrides(){},loadCropPriceOverrides:()=>({}),setCashflowSettings(){},loadCashflowSettings:()=>({}),setMounted(){},
    myDesigns:()=>Promise.resolve([]),setMyDesignsList(){},setStudioChoices(){},studioPlanChoices:()=>[],loadPlaces:()=>[],loadCanvasState:()=>null };
  const functions=Function('state',`with(state){${compiled};return {${names.join(',')},runAutosave,runMount,runTargetAccept,commitHistory};}`)(state);
  functions.runMount();
  return {state,...functions,flush(){while(queued.length)queued.shift()!();}};
}
function callWriter(controller:any,writer:string) {
  const state=controller.state;
  if(writer==='autosave'){controller.runAutosave();controller.flush();return undefined;}
  if(writer==='profiles')return controller.saveGrowerProfiles(state.plan.growerPlanningProfiles??[]);
  if(writer==='workspace')return controller.saveWorkspaceReference(createWorkspacePlanningReference('virtual-bed',true,stamp));
  if(writer==='targets')return controller.saveScopedGrowerInputs('harvestTargets',state.plan.harvestTargets??[]);
  return controller.saveScopedGrowerInputs('nursery',state.plan.nursery??{version:1,spaces:[],containers:[],profiles:[]});
}
const writers=['autosave','profiles','workspace','targets','nursery'];

test('actual mount and every parent writer hold a lossy nonempty raw book rather than overwrite its rows or metadata',async()=>{
 const f=await canonical(),raw={...f.book,plantings:[null,f.row],unrecognisedMetadata:{preserve:'all raw evidence'}};
 for(const writer of writers){await reset();const c=parent(raw),before=local.getItem(bookKey()),writes=local.writes;
  assert.equal(c.state.plan.plantings.length,0);assert.equal(c.state.planSaveConflict,true);assert.equal(c.state.planWriteBase.current.admission.status,'held');
  // Neither a new visible row nor withdrawing an alert can change load provenance.
  c.state.plan={...c.state.plan,plantings:[{id:'new-local-edit',bedId:'legacy-shown',cropKey:f.row.cropKey,sowMonth:12}]};c.state.planSaveConflict=false;
  if(writer!=='autosave')c.state.planWriteBase.current.planKey=JSON.stringify(c.state.plan);
  const saved=callWriter(c,writer);if(writer!=='autosave')assert.equal(saved,false,writer);assert.equal(local.writes,writes,writer);assert.equal(local.getItem(bookKey()),before,writer);
  assert.equal(c.state.planSaveConflict,true,writer);
 }
});

test('unknown raw metadata and dropped profile claims hold even when loaded rows remain nonempty',async()=>{
 const f=await canonical();
 for(const raw of [{...f.book,unknownProjectMetadata:{keep:true}},
  {...f.book,growerPlanningProfiles:[{...f.profile,unrecognisedEvidence:'retain this claim'}]},
  {...f.book,planNotes:[{kind:'unknown-kind',text:'Do not silently erase'}],planNotesAt:Date.UTC(2026,0,1)}]){
  await reset();const c=parent(raw),before=local.getItem(bookKey()),writes=local.writes;
  assert.ok(c.state.plan.plantings.length>0);assert.equal(c.state.planWriteBase.current.admission.status,'held');
  c.state.planSaveConflict=false;c.runAutosave();c.flush();assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);assert.equal(c.state.planSaveConflict,true);
 }
});

test('newly initialized and valid empty canonical books permit real creation while unreadable bytes never acquire admission',async()=>{
 // Initialization now durably records an empty canonical book before a writer mounts.
 for(const raw of [undefined,{version:1,plantings:[],updatedAt:7}]){
  await reset();const c=parent(raw);assert.equal(c.state.planSaveConflict,false);assert.equal(c.state.planWriteBase.current.admission.source,'present');
  c.state.plan={...c.state.plan,plantings:[{id:'new-user-row',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12}],updatedAt:Date.now()};
  c.runAutosave();c.flush();assert.equal(JSON.parse(readCanonicalCropPlanFixtureRaw()).plantings.length,1);assert.equal(c.state.planSaveConflict,false);
 }
 for(const bytes of ['', '{invalid-json',JSON.stringify({version:9,plantings:[],updatedAt:7})]){
  await reset();const c=parent(bytes),before=local.getItem(bookKey()),writes=local.writes;assert.equal(c.state.planWriteBase.current.admission.status,'held');c.runAutosave();c.flush();assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);
 }
});

test('a fresh valid token or forged ready object cannot bless the original lossy or dirty loaded base',async()=>{
 const f=await canonical(),c=parent({...f.book,plantings:[null,f.row]});
 // The global saver now also refuses to erase a lossy current book. Model an
 // independent current-book replacement explicitly, then keep the original
 // loaded admission: fresh bytes/token must not retroactively grant authority.
 assert.equal(crop.saveCropPlan(f.book),false);
 replaceCanonicalCropPlanFixtureRaw(JSON.stringify(f.book));c.state.planSaveConflict=false;c.state.planWriteBase.current.token=crop.cropPlanWriteToken();
 const before=local.getItem(bookKey()),writes=local.writes;c.runAutosave();c.flush();assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);
 assert.equal(crop.cropPlanWriteAdmissionMatches({status:'ready',source:'present'},JSON.stringify(f.book),crop.cropPlanWriteToken()),false);
 const loaded=crop.loadCropPlanWithWriteAdmission();assert.equal(crop.cropPlanWriteAdmissionMatches(loaded.admission,JSON.stringify({...loaded.book,updatedAt:999}),loaded.token),false);
});

test('the exact legacy settlement authority can be persisted without inferring that a past sowing happened',async()=>{
 const row={id:'unconfirmed-once',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:1,once:'2020-01'};
 const raw={version:1,plantings:[row],updatedAt:7};const c=parent(raw);
 assert.equal(c.state.planSaveConflict,false);assert.equal(c.state.plan.plantings[0].awaitingSowingConfirmation,true);
 assert.equal(c.state.plan.plantings[0].existing,undefined);assert.equal(c.state.plan.plantings[0].confirmedOnceSowing,undefined);
 c.runAutosave();c.flush();const saved=JSON.parse(readCanonicalCropPlanFixtureRaw());assert.equal(saved.plantings[0].awaitingSowingConfirmation,true);assert.equal(saved.plantings[0].existing,undefined);assert.equal(saved.plantings[0].once,row.once);
});

test('duplicate rows, own markers and canonical foreign held nursery evidence remain intact through unrelated saves',async()=>{
 const f=await canonical();const nursery=sanitiseNurserySettings({version:1,spaces:[],containers:[
  {id:'ambiguous',siteId,name:'Current raw claim',cells:12,metadata:{preserve:true}},
  {id:'ambiguous',siteId:otherSite,name:'Foreign raw claim',cells:24}],profiles:[]});assert.ok(nursery.heldInputs?.length);
 const raw={...f.book,plantings:[f.row,f.row],nursery};const c=parent(raw);assert.equal(c.state.planSaveConflict,false);
 const beforeRows=JSON.stringify(raw.plantings),beforeHeld=JSON.stringify(nursery.heldInputs);
 assert.equal(c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles),true);
 const saved=JSON.parse(readCanonicalCropPlanFixtureRaw());assert.equal(JSON.stringify(saved.plantings),beforeRows);assert.equal(JSON.stringify(saved.nursery.heldInputs),beforeHeld);
});

test('a valid original admission permits a lossless foreign-preserving rebase but a newly lossy current book holds',async()=>{
 const f=await canonical(),c=parent(f.book),foreign=target('new-foreign-target',otherSite);
 assert.equal(crop.saveCropPlan({...f.book,harvestTargets:[...f.book.harvestTargets!,foreign],updatedAt:Date.now()}),true);
 const changed=c.state.plan.growerPlanningProfiles.map((p:any)=>({...p,inputs:{...p.inputs,yieldKgPerM2:{...p.inputs.yieldKgPerM2,value:3}}}));
 assert.equal(c.saveGrowerProfiles(changed),true);assert.deepEqual(JSON.parse(readCanonicalCropPlanFixtureRaw()).harvestTargets.at(-1),foreign);
 const loss={...JSON.parse(readCanonicalCropPlanFixtureRaw()),plantings:[null,f.row]};replaceCanonicalCropPlanFixtureRaw(JSON.stringify(loss));const before=local.getItem(bookKey()),writes=local.writes;
 assert.equal(c.saveScopedGrowerInputs('harvestTargets',c.state.plan.harvestTargets),false);assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);assert.equal(c.state.planSaveConflict,true);
});

test('candidate normalization cannot silently remove newly supplied profile, target, reference or nursery metadata',async()=>{
 const f=await canonical();
 for(const writer of ['profiles','targets','workspace','nursery']){
  await reset();const c=parent(f.book),before=local.getItem(bookKey()),writes=local.writes;let saved:boolean;
  if(writer==='profiles')saved=c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles.map((p:any)=>({...p,newEvidence:'Keep or hold'})));
  else if(writer==='targets')saved=c.saveScopedGrowerInputs('harvestTargets',c.state.plan.harvestTargets.map((p:any)=>({...p,newEvidence:'Keep or hold'})));
  else if(writer==='workspace')saved=c.saveWorkspaceReference({...createWorkspacePlanningReference('virtual-bed',true,stamp),newEvidence:'Keep or hold'});
  else saved=c.saveScopedGrowerInputs('nursery',{...c.state.plan.nursery,newEvidence:'Keep or hold'});
  assert.equal(saved,false,writer);assert.equal(local.writes,writes,writer);assert.equal(local.getItem(bookKey()),before,writer);
 }
 let calls=0;const candidate:any={...f.book};Object.defineProperty(candidate,'newEvidence',{enumerable:true,get(){calls++;return 'unsafe';}});
 assert.equal(crop.cropPlanWriteCandidateIsLossless(candidate),false);assert.equal(calls,0);
 const hidden:any={...f.book};Object.defineProperty(hidden,'newEvidence',{value:'Keep or hold'});assert.equal(crop.cropPlanWriteCandidateIsLossless(hidden),false);
 const executable:any={...f.book,newEvidence:()=>{calls++;}};assert.equal(crop.cropPlanWriteCandidateIsLossless(executable),false);assert.equal(calls,0);
 assert.equal(crop.cropPlanWriteCandidateIsLossless({...f.book,plantings:[{id:'new-legacy',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12,existing:undefined,variety:undefined}]}),true);
});

test('every real writer rejects the raw Firebase transition before reading another mounted book',async()=>{
 const f=await canonical();for(const writer of writers){await reset();const c=parent(f.book),before=local.getItem(bookKey()),writes=local.writes;let reads=0;
  c.state.loadCropPlanWithWriteAdmission=()=>{reads++;return crop.loadCropPlanWithWriteAdmission();};probe.actor='owner-b';assert.equal(account.activeAccountUid(),'owner-a');
  assert.equal(callWriter(c,writer),writer==='autosave'?undefined:false,writer);assert.equal(reads,0,writer);assert.equal(local.writes,writes,writer);assert.equal(local.getItem(bookKey()),before,writer);
 }
});

test('late actor/base/token changes cannot authorize a writer after its fresh admission read',async()=>{
 const f=await canonical();for(const change of ['actor','base','token']){await reset();const c=parent(f.book),before=local.getItem(bookKey()),writes=local.writes;
  c.state.loadCropPlanWithWriteAdmission=()=>{const loaded=crop.loadCropPlanWithWriteAdmission();if(change==='actor')probe.actor='owner-b';else if(change==='base')c.state.planWriteBase.current={...c.state.planWriteBase.current};else replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...f.book,updatedAt:8}));return loaded;};
  assert.equal(c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles),false,change);assert.equal(local.writes,writes+(change==='token'?1:0),change);
  if(change!=='token')assert.equal(local.getItem(bookKey()),before,change);
 }
});

test('an external overwrite during the actual save event never becomes the next admitted base',async()=>{
 const f=await canonical(),c=parent(f.book),external={...f.book,updatedAt:99,harvestTargets:[target('external')]};
 const overwrite=()=>replaceCanonicalCropPlanFixtureRaw(JSON.stringify(external));events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,overwrite,{once:true});
 assert.equal(c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles),true);const before=local.getItem(bookKey()),writes=local.writes;
 assert.equal(c.state.planSaveConflict,true);assert.equal(c.saveScopedGrowerInputs('harvestTargets',c.state.plan.harvestTargets),false);assert.equal(local.writes,writes);assert.equal(local.getItem(bookKey()),before);
});

test('actual undo preserves newer metadata, own rows and foreign beds while restoring only the bound legacy subset',async()=>{
 const f=await canonical(),legacy={id:'legacy-edit',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12},foreign={...legacy,id:'foreign-legacy',bedId:'not-shown'};
 const c=parent({...f.book,plantings:[f.row,legacy,foreign]});c.pushPlanHistory();
 c.state.plan={...c.state.plan,plantings:[f.row,{...legacy,variety:'Edited fixture'},foreign]};c.runAutosave();c.flush();
 assert.equal(crop.saveCropPlan({...JSON.parse(readCanonicalCropPlanFixtureRaw()),harvestTargets:[...f.book.harvestTargets!,target('new-foreign',otherSite)],updatedAt:Date.now()}),true);
 assert.equal(c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles),true);const targets=structuredClone(c.state.plan.harvestTargets);
 c.undoLastChange();assert.deepEqual(c.state.plan.harvestTargets,targets);assert.deepEqual(c.state.plan.plantings,[f.row,foreign,legacy]);
 c.runAutosave();c.flush();assert.deepEqual(JSON.parse(readCanonicalCropPlanFixtureRaw()).harvestTargets,targets);
});

test('undo cannot cross its original source/owner binding or revive a lossy loaded book',async()=>{
 const f=await canonical(),legacy={id:'legacy-edit',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12};
 for(const change of ['source','actor']){await reset();const c=parent({...f.book,plantings:[legacy]});c.pushPlanHistory();c.state.plan={...c.state.plan,plantings:[]};const before=c.state.plan;
  if(change==='source')c.state.planningScopeKey='another-source';else probe.actor='owner-b';c.undoLastChange();assert.equal(c.state.plan,before);assert.equal(c.state.planSaveConflict,true);
 }
 await reset();const c=parent({...f.book,plantings:[null,f.row]});c.pushPlanHistory();c.state.plan={...c.state.plan,plantings:[legacy]};const bytes=local.getItem(bookKey());c.undoLastChange();c.runAutosave();c.flush();assert.equal(local.getItem(bookKey()),bytes);assert.equal(c.state.planSaveConflict,true);
});


test('every direct parent writer can add to a freshly initialized canonical book without mistaking generated display time for newer data',async()=>{
 for(const writer of ['profiles','workspace','targets','nursery']){await reset();const c=parent();assert.equal(c.state.planWriteBase.current.admission.source,'present');
  assert.equal(callWriter(c,writer),true,writer);const raw=JSON.parse(readCanonicalCropPlanFixtureRaw());assert.equal(raw.version,1);assert.deepEqual(raw.plantings,[]);assert.equal(c.state.planSaveConflict,false,writer);
 }
});

test('sample admission remains isolated and a queued sample write cannot run after returning to the real account',async()=>{
 const f=await canonical();replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...f.book,plantings:[null,f.row]}));const realKey=bookKey(),realBytes=local.rows.get(realKey);
 assert.equal(samples.enterSampleMode(),true);
 try{const c=parent();assert.equal(c.state.planWriteBase.current.admission.status,'ready');
  c.state.plan={...c.state.plan,plantings:[{id:'sample-only',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12,existing:undefined,variety:undefined}]};c.runAutosave();c.flush();assert.equal(local.rows.get(realKey),realBytes);assert.equal(c.state.planSaveConflict,false);
  const sampleReceipt=crop.readRawCropPlanReceipt();assert.equal(sampleReceipt.status,'ready');if(sampleReceipt.status==='ready')assert.equal((sampleReceipt.raw as CropPlanState).plantings[0].id,'sample-only');
  c.state.plan={...c.state.plan,plantings:[]};c.runAutosave();samples.exitSampleMode();const writes=local.writes;c.flush();assert.equal(local.writes,writes);assert.equal(local.rows.get(realKey),realBytes);
 }finally{samples.exitSampleMode();}
});


test('sample raw receipts retain malformed array evidence while unsafe fields hold before executing',async()=>{
 assert.equal(samples.enterSampleMode(),true);
 try{for(const kind of ['getter','function','undefined-array']){let calls=0;const raw:any={version:1,plantings:[],updatedAt:7};
  if(kind==='getter')Object.defineProperty(raw,'newEvidence',{enumerable:true,get(){calls++;return 'unsafe';}});
  else if(kind==='function')raw.newEvidence=()=>{calls++;};
  else raw.plantings=[undefined];
  samples.setSandboxCropPlan(raw);const c=parent();assert.equal(c.state.planWriteBase.current.admission.status,'held',kind);assert.equal(c.state.planSaveConflict,true,kind);assert.equal(calls,0,kind);
 }
 const row={id:'sample-evidence',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12};
 for(const plantings of [[null,row],[row,row],[17]]){samples.setSandboxCropPlan({version:1,plantings,updatedAt:7} as any);
  const receipt=crop.readRawCropPlanReceipt();assert.equal(receipt.status,'ready');if(receipt.status==='ready')assert.deepEqual((receipt.raw as CropPlanState).plantings,plantings);
 }
 }finally{samples.exitSampleMode();}
});


test('an unsafe sample replacement after safe load cannot hide behind an unchanged JSON token or an already queued writer',async()=>{
 assert.equal(samples.enterSampleMode(),true);
 try{for(const kind of ['getter','function']){
  samples.setSandboxCropPlan({version:1,plantings:[],updatedAt:7});const c=parent();assert.equal(c.state.planSaveConflict,false);c.runAutosave();
  const originalToken=c.state.planWriteBase.current.token;let calls=0;const replaced:any={version:1,plantings:[],updatedAt:7};
  if(kind==='getter')Object.defineProperty(replaced,'newEvidence',{enumerable:true,get(){calls++;return undefined;}});else replaced.newEvidence=()=>{calls++;};
  samples.setSandboxCropPlan(replaced);assert.equal(crop.cropPlanWriteToken(),null,kind);assert.equal(calls,0,kind);
  c.flush();assert.equal(samples.getSandboxCropPlan(),replaced,kind);assert.equal(c.state.planSaveConflict,true,kind);assert.equal(c.state.planWriteBase.current.token,originalToken,kind);assert.equal(calls,0,kind);
 }}finally{samples.exitSampleMode();}
});

function acceptSuggestion(c:any,kind:string,result:any){
 c.state.autoResult=result;if(kind==='auto')c.acceptAutoSuggest();else c.runTargetAccept(result);
 // The real effect grants history only after the returned plan commits.
 c.commitHistory();
}
function metadata(book:any){return {rainPattern:book.rainPattern,planNotes:book.planNotes,planNotesAt:book.planNotesAt,
 presence:['rainPattern','planNotes','planNotesAt'].map(key=>Object.hasOwn(book,key))};}

test('both actual suggestion actions undo their own notes, date and rainfall basis rather than leave explanations for removed rows',async()=>{
 const legacy={id:'suggested-fixture',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12};
 const foreign={...legacy,id:'foreign-legacy',bedId:'not-shown'};
 for(const kind of ['auto','targets'])for(const prior of [false,true]){await reset();
  const raw={version:1,plantings:[foreign],updatedAt:7,...(prior?{rainPattern:'summer',planNotes:[{kind:'basis',text:'Prior fixture explanation'}],planNotesAt:Date.UTC(2025,0,1)}:{})};
  const c=parent(raw),before=metadata(c.state.plan),result={plantings:[legacy],notes:[{kind:'choice',text:'New fixture explanation'}]};
  acceptSuggestion(c,kind,result);assert.equal(c.state.planHistory.length,1,kind);assert.equal(c.state.plan.rainPattern,'winter');assert.deepEqual(c.state.plan.planNotes,result.notes);
  c.runAutosave();c.flush();c.undoLastChange();assert.deepEqual(c.state.plan.plantings,[foreign],kind);assert.deepEqual(metadata(c.state.plan),before,kind);
  c.runAutosave();c.flush();const saved=JSON.parse(readCanonicalCropPlanFixtureRaw());assert.deepEqual(saved.plantings,[foreign],kind);assert.deepEqual(metadata(saved),before,kind);
 }
});

test('actual suggestion history is detached, grants nothing for a guarded or empty action and cannot roll back a genuinely newer metadata group',async()=>{
 const legacy={id:'suggested-fixture',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12};
 for(const kind of ['auto','targets']){await reset();const priorNotes=[{kind:'basis',text:'Prior fixture explanation'}];
  const c=parent({version:1,plantings:[],updatedAt:7,rainPattern:'summer',planNotes:priorNotes,planNotesAt:Date.UTC(2025,0,1)});
  const beforePlan=c.state.plan,result={plantings:[legacy],notes:[{kind:'choice',text:'Action explanation'}]};
  acceptSuggestion(c,kind,result);assert.equal(c.state.planHistory.length,1);c.runAutosave();c.flush();
  beforePlan.planNotes[0].text='Mutated old reference';
  c.undoLastChange();assert.equal(c.state.plan.planNotes[0].text,'Prior fixture explanation',kind);c.runAutosave();c.flush();
  acceptSuggestion(c,kind,result);c.runAutosave();c.flush();
  const newer={...JSON.parse(readCanonicalCropPlanFixtureRaw()),rainPattern:'all-year',planNotes:[{kind:'basis',text:'Newer independent explanation'}],planNotesAt:Date.UTC(2027,0,1),harvestTargets:[target('new-foreign',otherSite)],updatedAt:Date.now()};
  assert.equal(crop.saveCropPlan(newer),true);assert.equal(c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles??[]),true);const current=metadata(c.state.plan),targets=structuredClone(c.state.plan.harvestTargets);
  c.undoLastChange();assert.deepEqual(c.state.plan.plantings,[]);assert.deepEqual(metadata(c.state.plan),current,kind);assert.deepEqual(c.state.plan.harvestTargets,targets,kind);c.runAutosave();c.flush();
  const empty=parent({version:1,plantings:[],updatedAt:7});acceptSuggestion(empty,kind,{plantings:[],notes:result.notes});assert.equal(empty.state.planHistory.length,0,kind);
  empty.state.hasOwnRecords=true;acceptSuggestion(empty,kind,result);assert.equal(empty.state.planHistory.length,0,kind);assert.deepEqual(empty.state.plan.plantings,[]);
 }
});


test('actual abandoned or replayed suggestion updaters cannot create history for an uncommitted plan or duplicate its grant',async()=>{
 const row={id:'suggested-fixture',bedId:'legacy-shown',cropKey:CROPS[0].key,sowMonth:12},result={plantings:[row],notes:[{kind:'choice',text:'Action explanation'}]};
 for(const kind of ['auto','targets']){await reset();const abandoned=parent({version:1,plantings:[],updatedAt:7}),original=abandoned.state.plan;
  abandoned.state.setPlan=(updater:any)=>{updater(abandoned.state.plan);};acceptSuggestion(abandoned,kind,result);assert.equal(abandoned.state.plan,original,kind);assert.equal(abandoned.state.planHistory.length,0,kind);
  const replayed=parent({version:1,plantings:[],updatedAt:7});replayed.state.setPlan=(updater:any)=>{updater(replayed.state.plan);replayed.state.plan=updater(replayed.state.plan);};
  acceptSuggestion(replayed,kind,result);replayed.commitHistory();assert.equal(replayed.state.planHistory.length,1,kind);assert.equal(replayed.state.plan.plantings.length,1,kind);
  const guarded=parent({version:1,plantings:[{...row,growerCycle:{}}],updatedAt:7}),before=guarded.state.plan;acceptSuggestion(guarded,kind,result);assert.equal(guarded.state.plan,before,kind);assert.equal(guarded.state.planHistory.length,0,kind);
 }
 await reset();const duplicateOnly=parent({version:1,plantings:[row],updatedAt:7});const before=duplicateOnly.state.plan;acceptSuggestion(duplicateOnly,'targets',result);assert.equal(duplicateOnly.state.plan,before);assert.equal(duplicateOnly.state.planHistory.length,0);
});
