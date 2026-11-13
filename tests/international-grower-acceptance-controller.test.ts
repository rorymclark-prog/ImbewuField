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
import { createSavedProvisionalProfile, provisionalSiteConditions } from '../lib/international/provisional-profile.ts';
import { currentPlanningSupport } from '../lib/international/planning-support.ts';
import { prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import { sanitiseNurserySettings } from '../lib/nursery-settings.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting, normaliseGrowerCycleAttachment } from '../lib/international/grower-cycle.ts';
import { prepareGrowerNurseryBatchReferenceChanges, type GrowerNurseryBatchReferenceChange } from '../lib/international/grower-nursery.ts';
import type { GrowerSavedNurseryReview, GrowerNurseryReferenceAcknowledgement } from '../components/crops/useGrowerWorkflow.ts';

const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// The real Next Link schedules browser idle work after a confirmed receipt mounts.
// Supply its browser global while keeping the real component and every writer assertion.
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
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
const { harvestTargetsSourceKey } = await import('../lib/nursery-save-receipt.ts');
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
beforeEach(reset); after(() => {
  hooks.deregister(); cleanup();
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else Reflect.deleteProperty(globalThis, 'self');
});

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
const names = ['plannerActorIsCurrent','growerActorIsCurrent','readCurrentGrowerBook','commitGrowerAcceptance','commitNurseryBatchReferences','rememberStoredPlan','saveGrowerProfiles','saveScopedGrowerInputs'];
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
    surveySiteId:siteId,planningWorkspaceId:null,currentPlanningSupport,provisionalSiteConditions,
    growerOwner:account.activeAccountUid(),growerSample:samples.isSampleMode(),growerScope:scope,growerScopeKey:growerPlanningScopeKey(scope),productionSiteId:resourceSiteId,
    growerWriteScope:{current:{key:growerPlanningScopeKey(scope),owner:account.activeAccountUid(),sample:samples.isSampleMode()}},
    growerBookContext:{current:{siteId:resourceSiteId,owner:account.activeAccountUid(),sample:samples.isSampleMode(),scopeKey:growerPlanningScopeKey(scope)}},
    activeAccountUid:account.activeAccountUid,isSampleMode:samples.isSampleMode,isBackendConfigured:()=>probe.configured,getFirebase:()=>({auth:{currentUser:probe.actor?{uid:probe.actor}:null}}),
    readRawCropPlanReceipt:crop.readRawCropPlanReceipt,loadCropPlanWithWriteAdmission:crop.loadCropPlanWithWriteAdmission,cropPlanWriteAdmissionMatches:crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless:crop.cropPlanWriteCandidateIsLossless,cropPlanWriteToken:crop.cropPlanWriteToken,saveCropPlanWithReceipt:crop.saveCropPlanWithReceipt,
    prepareGrowerWorkflowAcceptance,prepareGrowerNurseryBatchReferenceChanges,growerPlanningScopeKey,normaliseGrowerPlanningProfiles,sanitiseHarvestTargets:crop.sanitiseHarvestTargets,sanitiseNurserySettings,harvestTargetsSourceKey,
    clearTimeout(){},setPlan(value:any){state.plan=typeof value==='function'?value(state.plan):value;notify();},setPlanSaveConflict(value:boolean){state.planSaveConflict=value;},setPlanSaveFailed(value:boolean){state.planSaveFailed=value;},
    setDesign(){},loadFacilitatorState:()=>null,setCurrentMonth(){},setCurrentYear(){},setFavouriteCropKeys(){},loadFavouriteCropKeys:()=>new Set(),
    setAllowBedSharing(){},loadAllowBedSharing:()=>false,setPriceOverrides(){},loadCropPriceOverrides:()=>({}),setCashflowSettings(){},loadCashflowSettings:()=>({}),setMounted(){},
    myDesigns:()=>Promise.resolve([]),setMyDesignsList(){},setStudioChoices(){},studioPlanChoices:()=>[],loadPlaces:()=>[],loadCanvasState:()=>null};
  const functions=Function('state',`with(state){${compiled};return {${names.join(',')},runMount};}`)(state);
  functions.runMount();assert.equal(state.planSaveConflict,false,'canonical fixture must have actual loaded admission');
  return {state,...functions,notify(callback:()=>void){notify=callback;}};
}
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(item=>text(item as ReactTestInstance|string)).join('');
function mounted(controller:ReturnType<typeof parent>, withProvisionalContext = false) {
  let current=controller,renderer!:ReactTestRenderer,latest!:ReturnType<typeof useGrowerWorkflow>,counter=0;
  let reviewPending:Promise<GrowerWorkflowReview>|null=null,acceptPending:Promise<unknown>|null=null;
  let id=()=>`persistent-${++counter}`;let selection:Parameters<typeof useGrowerWorkflow>[0]['selection']={kind:'studio-canvas',sourceId:siteId};
  function App(){const [,render]=React.useState(0),expectedActor=current.growerActorIsCurrent;current.notify(()=>render(value=>value+1));
    latest=useGrowerWorkflow({selection,scope,...(withProvisionalContext?{provisionalSiteConditions:provisionalSiteConditions(currentPlanningSupport(siteId)),readCurrentProvisionalSiteConditions:()=>provisionalSiteConditions(currentPlanningSupport(siteId))}:{}),resourceSiteId:current.state.productionSiteId,book:current.state.plan,actorIsCurrent:()=>expectedActor(),readCurrentBook:current.readCurrentGrowerBook,commitAcceptance:current.commitGrowerAcceptance,commitNurseryReferences:current.commitNurseryBatchReferences,createPlantingId:()=>id()});
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
    async review(request=draft()){let result!:GrowerWorkflowReview;await act(async()=>{result=await latest.onReview(request);});assert.equal(result.status,'review',result.issues.join(','));if(result.status!=='review')throw Error('fixture held');return result;},
    async accept(review:Extract<GrowerWorkflowReview,{status:'review'}>,guard=()=>true){let result!:Awaited<ReturnType<typeof latest.onAccept>>;await act(async()=>{result=await latest.onAccept(review,guard);});return result;},
    async readNursery(acknowledgement?:GrowerNurseryReferenceAcknowledgement){let result!:Awaited<ReturnType<typeof latest.onReadSavedNursery>>;await act(async()=>{result=await latest.onReadSavedNursery(acknowledgement);});return result;},
    async checkNursery(view:GrowerSavedNurseryReview){let result=false;await act(async()=>{result=await latest.onCheckSavedNurseryCurrent(view);});return result;},
    async saveNursery(view:GrowerSavedNurseryReview,changes:readonly GrowerNurseryBatchReferenceChange[],guard=()=>true){let result!:Awaited<ReturnType<typeof latest.onSaveNurseryBatchReferences>>;await act(async()=>{result=await latest.onSaveNurseryBatchReferences(view,changes,guard);});return result;},
    dispose(){act(()=>renderer.unmount());}};
}
async function ready() {const f=await fixture();local.setItem(studioKey(),JSON.stringify(studio()));const c=parent(f.book),ui=mounted(c);await ui.refresh();return {...f,c,ui};}

async function markedReady() {
  const f = await fixture(); local.setItem(studioKey(), JSON.stringify(studio()));
  const c = parent(f.book), ui = mounted(c, true); await ui.refresh(); const source = ui.latest.source; assert.ok(source);
  const original = f.book.growerPlanningProfiles![0], recordedAt = '2026-11-04T12:00:00.000Z';
  const own = (value: unknown, unit: string) => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } });
  const saved = createSavedProvisionalProfile({ profileId: 'provisional-preview', cropKey: original.cropKey,
    context: { scope, countryCode: null, agriculturalRegionReference: null, establishment: 'direct', waterRegime: 'irrigated' },
    recordedAt, asOf: '2026-11-04', candidates: [], overrides: original.inputs,
    measuredAreaM2: { ...own(8, 'm2'), arithmeticBasis: source.measuredAreas[0].arithmeticBasis },
    fieldEntryDate: own('2028-12-01', 'utc-date') }, 'marked-profile', '2026-11-04T12:01:00.000Z', source, source.beds[0].id, source.beds[0].label);
  assert.ok(saved); const initial = crop.loadCropPlanWithWriteAdmission();
  const next = { ...initial.book, growerPlanningProfiles: [...initial.book.growerPlanningProfiles!, saved] };
  const permit = crop.createGrowerProfileChangePermit(initial.admission, initial.book, next,
    { kind: 'edit', profileId: saved.profileId, expectedProfile: null }); assert.ok(permit);
  act(() => { assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: permit }).saved, true); });
  const loaded = crop.loadCropPlanWithWriteAdmission(); c.state.plan = loaded.book;
  c.state.planWriteBase.current = { ...c.state.planWriteBase.current, token: loaded.token, planKey: JSON.stringify(loaded.book), admission: loaded.admission };
  ui.rerender(); await ui.refresh();
  const request = { ...draft(), targetProfiles: [{ targetId: 'buyer', profileId: saved.profileId }] };
  const review = await ui.review(request); assert.equal(review.proposal.status, 'ready', review.issues.join(','));
  return { ...f, c, ui, saved, review };
}

test('the actual mounted controller and page writer adopt an intact marked profile once and reload its evidence without treating own events as revocation', async () => {
  const f = await markedReady(); try {
    const writes = local.writes, before = crop.loadCropPlan(); const result = await f.ui.accept(f.review);
    assert.equal(result.status, 'confirmed', JSON.stringify(result)); assert.equal(local.writes, writes + 1);
    const saved = crop.loadCropPlan(); assert.deepEqual(saved.growerPlanningProfiles, before.growerPlanningProfiles);
    assert.deepEqual(saved.plantings[0], f.foreign);
    for (const row of saved.plantings.slice(1)) {
      const attachment = normaliseGrowerCycleAttachment(row.growerCycle); assert.ok(attachment);
      assert.deepEqual(attachment.assessmentSnapshot.profile, f.saved);
      assert.equal(attachment.assessmentSnapshot.provisionalReview?.context.countryCode, null);
      assert.equal(attachment.assessmentSnapshot.provisionalReview?.context.asOf, new Date().toISOString().slice(0, 10));
    }
    const after = local.writes; assert.equal((await f.ui.accept(f.review)).status, 'held'); assert.equal(local.writes, after);
    assert.equal(f.c.state.planSaveConflict, false);
  } finally { f.ui.dispose(); }
});

test('crossing UTC midnight during the actual acceptance source read retires the marked review before any write', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-13T23:59:59.900Z') });
  const f = await markedReady(); try {
    const before = readCanonicalCropPlanFixtureRaw(), writes = local.writes, gate = pauseHashes();
    let pending!: ReturnType<typeof f.ui.latest.onAccept>;
    act(() => { pending = f.ui.latest.onAccept(f.review, () => true); }); await gate.started;
    t.mock.timers.tick(1000);
    let result!: Awaited<typeof pending>; await act(async () => { gate.resume(); result = await pending; });
    assert.equal(result.status, 'held'); assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  } finally { f.ui.dispose(); }
});

test('the final raw writer guard prevents a marked write if the review day changes after page preparation', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-13T23:59:59.900Z') });
  const f = await markedReady(); try {
    const before = readCanonicalCropPlanFixtureRaw(), writes = local.writes;
    const actual = f.c.state.saveCropPlanWithReceipt;
    f.c.state.saveCropPlanWithReceipt = (book: CropPlanState, options: Parameters<typeof crop.saveCropPlanWithReceipt>[1]) => {
      t.mock.timers.tick(1000); return actual(book, options);
    };
    assert.equal((await f.ui.accept(f.review)).status, 'held');
    assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  } finally { f.ui.dispose(); }
});

test('source revocation during a completed marked write reports superseded without installing stale plan state', async () => {
  const f = await markedReady(); try {
    const base = f.c.state.planWriteBase.current, plan = f.c.state.plan, writes = local.writes;
    events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT, () => events.dispatchEvent(new Event('permamap-places-changed')), { once: true });
    assert.equal((await f.ui.accept(f.review)).status, 'superseded'); assert.equal(local.writes, writes + 1);
    assert.equal(f.c.state.planWriteBase.current, base); assert.equal(f.c.state.plan, plan);
    const after = local.writes; assert.equal((await f.ui.accept(f.review)).status, 'held'); assert.equal(local.writes, after);
  } finally { f.ui.dispose(); }
});
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

// Use accepted own transplants for nursery references. The earlier ownRow
// fixture intentionally remains direct-sown for every original acceptance test.
async function savedNurseryFixture() {
  const f = await fixture(), raw = studio();
  raw.items.push({ ...raw.items[0], id: 'bed-b', x: 0.8 });
  const own = await ownRow(raw);
  const provided = <T,U extends string>(value:T,unit:U) => ({state:'provided' as const,value,unit,
    provenance:{kind:'grower-estimate' as const,recordedAt:'2026-11-05T12:00:00.000Z'}});
  const profile = { ...own.row.growerCycle.assessmentSnapshot.profile, inputs: {
    ...own.row.growerCycle.assessmentSnapshot.profile.inputs, establishment:provided('transplant' as const,'method'),nurseryDays:provided(10,'days') } };
  const proposal = generateGrowerAutoPlan({requestedAt:'2026-11-05T12:00:00.000Z',scope,geometryFingerprint:own.source.geometryFingerprint,
    profiles:[profile],beds:own.source.beds.map(bed=>({bed,scope,measuredAreaM2:provided(bed.areaM2,'m2')})),
    planningStart:provided('2028-12-01','utc-date'),planningEndExclusive:provided('2029-01-01','utc-date'),
    availability:own.source.beds.map(bed=>({bedId:bed.id,scope,window:provided({start:'2028-12-01',endExclusive:'2029-01-01'},'utc-date-window')})),
    reserved:[],demands:[{demandId:'buyer',profileId:profile.profileId,scope,totalKg:provided(17,'kg-total'),
      harvestWindow:provided({start:'2028-12-20',endExclusive:'2028-12-22'},'utc-date-window')}],maxAssessments:1000});
  assert.equal(proposal.status,'ready');assert.equal(proposal.cycles.length,2);
  const rows=proposal.cycles.map((cycle,index)=>{const row=createGrowerCyclePlanting(cycle,{plantingId:`saved-nursery-${index}`,
    acceptedAt:'2026-11-05T12:00:00.000Z',geometryFingerprint:own.source.geometryFingerprint});assert.ok(row);return row;});
  const foreign={...f.foreign,privateOtherMetadata:{retained:[null,0,'Unrelated original row']}};
  const book={...f.book,plantings:[foreign,...rows],growerPlanningProfiles:[profile]};
  return {...f,book,raw,rows,foreign};
}
async function readySavedNursery() {
  const f=await savedNurseryFixture();local.setItem(studioKey(),JSON.stringify(f.raw));const c=parent(f.book),ui=mounted(c);
  await ui.refresh();const result=await ui.readNursery();assert.equal(result.status,'ready',result.status==='held'?result.reason:'');
  if(result.status!=='ready'){ui.dispose();throw Error('Saved nursery source held');}
  assert.equal(result.view.references.length,2);assert.ok(result.view.references.every(row=>row.reference.status==='ready'));
  return {...f,c,ui,view:result.view};
}
const referenceChanges=(view:GrowerSavedNurseryReview):GrowerNurseryBatchReferenceChange[]=>view.references.map((row,index)=>({plantingId:row.plantingId,
  variety:`User variety ${index+1}`,seedLotReference:`User lot ${index+1}`,raisingBatchReference:`User raising ${index+1}`}));

test('actual saved-nursery bulk save retains sibling identity and counts, and opaque acknowledgement reopens only its real readback',async()=>{
 const {ui,c,view,book,rows,foreign}=await readySavedNursery();try{
  assert.equal(await ui.checkNursery(view),true);const writes=local.writes,changes=referenceChanges(view);
  const result=await ui.saveNursery(view,changes);assert.equal(result.status,'confirmed');
  if(result.status!=='confirmed')throw Error('Actual nursery writer failed');
  assert.equal(result.rows,2);assert.equal(result.sample,false);assert.equal(local.writes,writes+1);
  const stored=JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
  assert.deepEqual(stored.plantings[0],foreign);
  for(const [index,change]of changes.entries()){
   const row=stored.plantings.find(row=>row.id===change.plantingId)!;
   assert.equal(row.variety,change.variety);assert.equal((row.nurseryBatchReference as Record<string,unknown>).seedLotReference,change.seedLotReference);
   assert.deepEqual(row.growerCycle,rows[index].growerCycle,'reference editing cannot change the accepted arithmetic or dates');
  }
  for(const key of ['nursery','productionRecords','preservedProducts','planNotes','planNotesAt','rainPattern'])assert.deepEqual(stored[key as keyof CropPlanState],book[key as keyof CropPlanState],key);
  assert.equal(crop.cropPlanWriteAdmissionMatches(c.state.planWriteBase.current.admission,c.state.planWriteBase.current.planKey,c.state.planWriteBase.current.token),true);
  assert.equal((await ui.saveNursery(view,changes)).status,'held');assert.equal(local.writes,writes+1);
  ui.rerender();assert.equal((await ui.readNursery({...result.acknowledgement})).status,'held','public brand alone cannot forge the private receipt');
  const refreshed=await ui.readNursery(result.acknowledgement);assert.equal(refreshed.status,'ready');
  if(refreshed.status!=='ready')throw Error('Actual acknowledged readback held');
  assert.deepEqual(refreshed.view.references.map(row=>row.reference.status==='ready'&&row.reference.fields.seedLotReference),['User lot 1','User lot 2']);
  assert.equal(await ui.checkNursery(refreshed.view),true);assert.equal((await ui.readNursery(result.acknowledgement)).status,'held','acknowledgement handoff is consumed once');
  assert.equal(local.writes,writes+1);
 }finally{ui.dispose();}
});

test('actual unchanged reference requests perform no write, while explicit clearing affects only the selected saved sibling',async()=>{
 const {ui,view}=await readySavedNursery();try{
  const writes=local.writes,empty=view.references.map(row=>({plantingId:row.plantingId,variety:null,seedLotReference:null,raisingBatchReference:null}));
  assert.equal((await ui.saveNursery(view,[])).status,'unchanged');assert.equal((await ui.saveNursery(view,empty)).status,'unchanged');
  assert.equal(local.writes,writes);assert.equal(await ui.checkNursery(view),true);
  const saved=await ui.saveNursery(view,referenceChanges(view));assert.equal(saved.status,'confirmed');if(saved.status!=='confirmed')throw Error('Fixture save failed');
  const fresh=await ui.readNursery(saved.acknowledgement);assert.equal(fresh.status,'ready');if(fresh.status!=='ready')throw Error('Readback held');
  const previous=JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
  const result=await ui.saveNursery(fresh.view,[{plantingId:fresh.view.references[0].plantingId,variety:null,seedLotReference:null,raisingBatchReference:null}]);
  assert.equal(result.status,'confirmed');const current=JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
  const cleared=current.plantings.find(row=>row.id===fresh.view.references[0].plantingId)!;
  assert.equal(Object.hasOwn(cleared,'variety'),false);assert.equal(Object.hasOwn(cleared,'nurseryBatchReference'),false);
  assert.deepEqual(current.plantings.filter(row=>row.id!==cleared.id),previous.plantings.filter(row=>row.id!==cleared.id));
  assert.equal(local.writes,writes+2);
 }finally{ui.dispose();}
});

test('copied, mutated or replaced saved-nursery views cannot acquire a fresh original reference binding',async()=>{
 const {ui,view}=await readySavedNursery();try{
  const changes=referenceChanges(view),bytes=readCanonicalCropPlanFixtureRaw(),writes=local.writes;
  assert.equal((await ui.saveNursery({...view},changes)).status,'held');
  const next=await ui.readNursery();assert.equal(next.status,'ready');assert.equal(await ui.checkNursery(view),false);
  assert.equal((await ui.saveNursery(view,changes)).status,'held');
  if(next.status!=='ready')throw Error('New explicit read held');
  (next.view.references[0] as {startDate:string}).startDate='2028-12-02';
  assert.equal((await ui.saveNursery(next.view,changes)).status,'held');assert.equal(local.writes,writes);assert.equal(readCanonicalCropPlanFixtureRaw(),bytes);
 }finally{ui.dispose();}
});

test('source, actor, raw token, draft, selection and unmount races during real source hashing withhold saved-reference writes',async()=>{
 for(const mutation of ['source','actor','token','draft','selection','unmount']){await reset();const {ui,view,raw,book}=await readySavedNursery();let disposed=false;
  try{const bytes=readCanonicalCropPlanFixtureRaw(),writes=local.writes,gate=pauseHashes();let displayed=true,pending!:ReturnType<typeof ui.latest.onSaveNurseryBatchReferences>;
   act(()=>{pending=ui.latest.onSaveNurseryBatchReferences(view,referenceChanges(view),()=>displayed);});await gate.started;
   if(mutation==='source'){const moved=structuredClone(raw);moved.items[0].x+=0.1;local.setItem(studioKey(),JSON.stringify(moved));}
   if(mutation==='actor')probe.actor='owner-b';
   if(mutation==='token')replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:123456}));
   if(mutation==='draft')displayed=false;
   if(mutation==='selection')ui.select(null);
   if(mutation==='unmount'){ui.dispose();disposed=true;}
   await act(async()=>{gate.resume();assert.equal((await pending).status,'held',mutation);});
   assert.equal(local.writes,writes+(['source','token'].includes(mutation)?1:0),mutation);
   if(mutation!=='token')assert.equal(readCanonicalCropPlanFixtureRaw(),bytes,mutation);
  }finally{if(!disposed)ui.dispose();}}
});

test('concurrent saved-reference callbacks cannot double-write and failed or overwritten writes do not mint a confirmed acknowledgement',async()=>{
 for(const scenario of ['duplicate','quota','overwrite']){await reset();const {ui,c,view,book}=await readySavedNursery();try{
  const bytes=readCanonicalCropPlanFixtureRaw(),writes=local.writes,changes=referenceChanges(view);
  if(scenario==='duplicate'){
   let first!:ReturnType<typeof ui.latest.onSaveNurseryBatchReferences>,second!:typeof first;
   let outcomes!:Awaited<typeof first>[];
   await act(async()=>{first=ui.latest.onSaveNurseryBatchReferences(view,changes);second=ui.latest.onSaveNurseryBatchReferences(view,changes);outcomes=await Promise.all([first,second]);});
   assert.deepEqual(outcomes.map(result=>result.status),['confirmed','held']);assert.equal(local.writes,writes+1);
  }else if(scenario==='quota'){
   const actual=local.setItem;local.setItem=()=>{throw Error('Synthetic reference quota');};
   try{const result=await ui.saveNursery(view,changes);assert.equal(result.status,'failed');assert.equal('acknowledgement'in result,false);}finally{local.setItem=actual;}
   assert.equal(readCanonicalCropPlanFixtureRaw(),bytes);assert.equal(local.writes,writes);
   assert.equal((await ui.saveNursery(view,changes)).status,'confirmed');assert.equal(local.writes,writes+1);
  }else{
   const overwrite=()=>replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:987654}));events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,overwrite,{once:true});
   const result=await ui.saveNursery(view,changes);assert.equal(result.status,'superseded');assert.equal('acknowledgement'in result,false);
   assert.equal(c.state.planSaveConflict,true);const after=local.writes;assert.equal((await ui.saveNursery(view,changes)).status,'held');assert.equal(local.writes,after);
  }
 }finally{ui.dispose();}}
});

test('saved-reference acknowledgements cannot follow a later source, raw book or account into a newly read view',async()=>{
 for(const mutation of ['source','book','actor']){await reset();const {ui,view,raw,book}=await readySavedNursery();try{
  const saved=await ui.saveNursery(view,referenceChanges(view));assert.equal(saved.status,'confirmed');if(saved.status!=='confirmed')throw Error('Actual save held');
  ui.rerender();
  if(mutation==='source'){const moved=structuredClone(raw);moved.items[0].x+=0.1;local.setItem(studioKey(),JSON.stringify(moved));}
  if(mutation==='book')replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:654321}));
  if(mutation==='actor')probe.actor='owner-b';
  const writes=local.writes;assert.equal((await ui.readNursery(saved.acknowledgement)).status,'held',mutation);assert.equal(local.writes,writes);
 }finally{ui.dispose();}}
});

test('sample saved-reference edits and acknowledgement readback stay in memory, and exit during an edit revokes its original view',async()=>{
 for(const scenario of ['save','exit']){await reset();const real=await fixture();replaceCanonicalCropPlanFixtureRaw(JSON.stringify(real.book));const physical=JSON.stringify([...local.rows]);
  assert.equal(samples.enterSampleMode(),true);const {ui,view}=await readySavedNursery();try{
   if(scenario==='save'){
    const result=await ui.saveNursery(view,referenceChanges(view));assert.equal(result.status,'confirmed');if(result.status!=='confirmed')throw Error('Sample labels held');
    assert.equal(result.sample,true);ui.rerender();const readback=await ui.readNursery(result.acknowledgement);assert.equal(readback.status,'ready');
    if(readback.status!=='ready')throw Error('Sample readback held');assert.ok(readback.view.references.every(row=>row.reference.status==='ready'&&row.reference.fields.seedLotReference!==null));
    assert.ok(samples.getSandboxCropPlan().plantings.some(row=>Object.hasOwn(row,'nurseryBatchReference')));
   }else{
    const gate=pauseHashes();let pending!:ReturnType<typeof ui.latest.onSaveNurseryBatchReferences>;
    act(()=>{pending=ui.latest.onSaveNurseryBatchReferences(view,referenceChanges(view));});await gate.started;samples.exitSampleMode();
    await act(async()=>{gate.resume();assert.equal((await pending).status,'held');});
   }
   assert.equal(JSON.stringify([...local.rows]),physical,scenario);
  }finally{ui.dispose();samples.exitSampleMode();}}
});

test('the real parent rechecks original source, actor, raw token and draft after preparing reference changes',async()=>{
 for(const mutation of ['source','actor','token','draft']){await reset();const {ui,c,view,raw,book}=await readySavedNursery();try{
  const bytes=readCanonicalCropPlanFixtureRaw(),writes=local.writes,actual=c.state.prepareGrowerNurseryBatchReferenceChanges;
  let fired=false,displayed=true;
  c.state.prepareGrowerNurseryBatchReferenceChanges=(...args:Parameters<typeof prepareGrowerNurseryBatchReferenceChanges>)=>{
   const result=actual(...args);assert.equal(result.status,'prepared');
   if(!fired){fired=true;
    if(mutation==='source'){const moved=structuredClone(raw);moved.items[0].x+=0.1;local.setItem(studioKey(),JSON.stringify(moved));}
    if(mutation==='actor')probe.actor='owner-b';
    if(mutation==='token')replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:246810}));
    if(mutation==='draft')displayed=false;
   }
   return result;
  };
  const result=await ui.saveNursery(view,referenceChanges(view),()=>displayed);assert.equal(fired,true);assert.equal(result.status,'held',mutation);
  assert.equal(local.writes,writes+(['source','token'].includes(mutation)?1:0),mutation);
  if(mutation!=='token')assert.equal(readCanonicalCropPlanFixtureRaw(),bytes,mutation);
 }finally{ui.dispose();}}
});

test('source withdrawal reentered by a real saver storage read cannot physically write reference labels',async()=>{
 const {ui,c,view}=await readySavedNursery();try{
  const bytes=readCanonicalCropPlanFixtureRaw(),writes=local.writes,actual=c.state.saveCropPlanWithReceipt as typeof crop.saveCropPlanWithReceipt;
  let fired=false;
  c.state.saveCropPlanWithReceipt=(...args:Parameters<typeof crop.saveCropPlanWithReceipt>)=>{
   local.onRead=()=>{
    if(fired)return;fired=true;
    events.dispatchEvent(new Event('imbewu-design-canvas-changed'));
   };
   try{return actual(...args);}finally{local.onRead=null;}
  };
  const result=await ui.saveNursery(view,referenceChanges(view));
  assert.equal(fired,true,'the control must reach an actual storage read inside the real saver');
  assert.ok(result.status==='held'||result.status==='failed',result.status);
  assert.equal('acknowledgement'in result,false);assert.equal(local.writes,writes);assert.equal(readCanonicalCropPlanFixtureRaw(),bytes);
  assert.equal((await ui.saveNursery(view,referenceChanges(view))).status,'held');assert.equal(local.writes,writes);
 }finally{local.onRead=null;ui.dispose();}
});
