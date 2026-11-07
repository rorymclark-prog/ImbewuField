// REVIEW-017 additive repro (scratch only, not part of the frozen candidate).
// Executes the real AST-extracted facilitator parent writer
// (commitNurseryBatchReferences and its guards), the real useGrowerWorkflow hook
// and the real SavedGrowerNurseryReviewPanel together. Bounded boundaries (same
// as the existing controller/panel suites): in-memory Storage/EventTarget window,
// fixture Firebase auth, React state stand-ins for the page, the cloud design
// query, and the panel's field-worksheet/file-delivery leaves (budget panel only).
import { readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import { crop, account, samples, local, events, probe, studioKey, studio, ownRow, reset, cleanup, siteId } from './international-grower-operations-fixture.ts';
import { growerPlanningScopeKey, normaliseGrowerPlanningProfiles } from '../lib/international/grower-planning.ts';
import { prepareGrowerWorkflowAcceptance } from '../lib/international/grower-workflow.ts';
import { sanitiseNurserySettings } from '../lib/nursery-settings.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { prepareGrowerNurseryBatchReferenceChanges } from '../lib/international/grower-nursery.ts';

const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return data(`export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();`);
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === './GrowerFieldSeedSourcingSection') return data('export default function FieldWorksheetBoundary(){return null;}');
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === '@/lib/file-delivery') return data('export function downloadFile(){return "downloaded";}');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { harvestTargetsSourceKey } = await import('../lib/nursery-save-receipt.ts');
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
const { default: SavedPanel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
beforeEach(reset); after(() => {
  hooks.deregister(); cleanup();
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else Reflect.deleteProperty(globalThis, 'self');
});

// ---- Same synthetic fixture as tests/international-grower-acceptance-controller.test.ts ----
const scope = { kind: 'mapped-site' as const, siteId };
const otherSite = 'site:2.00000,2.00000';
const target = (id = 'buyer', site = siteId): Extract<HarvestTarget,{weeklyKg:number}> => ({ id, siteId: site, cropKey: CROPS[0].key,
  startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 7, marketablePercent: 100 });
async function baseFixture() {
  const foreignRaw = studio(); foreignRaw.siteId = otherSite; foreignRaw.frame.centerLat = 2; foreignRaw.frame.centerLng = 2; foreignRaw.items[0].id = 'foreign-bed';
  const own = await ownRow();
  const foreign = await ownRow(foreignRaw, 'studio-canvas', otherSite, 'foreign-record');
  const nursery = sanitiseNurserySettings({ version: 1, spaces: [], profiles: [], containers: [
    { id: 'ambiguous', siteId, name: 'Current fixture', cells: 12 }, { id: 'ambiguous', siteId: otherSite, name: 'Foreign fixture', cells: 24 }] });
  const book: CropPlanState = { version: 1, updatedAt: 7, plantings: [foreign.row], growerPlanningProfiles: [own.row.growerCycle.assessmentSnapshot.profile],
    harvestTargets: [target(), target('other-buyer', otherSite)], nursery,
    rainPattern: 'summer', planNotes: [{ kind: 'basis', text: 'Prior saved explanation' }], planNotesAt: Date.UTC(2025,0,1),
    productionRecords: [], preservedProducts: [] };
  return { book, foreign: foreign.row };
}
async function savedNurseryFixture() {
  const f = await baseFixture(), raw = studio();
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
  const book={...f.book,plantings:[f.foreign,...rows],growerPlanningProfiles:[profile]};
  return {...f,book,raw,rows};
}

// ---- Actual parent functions extracted from app/facilitator/crops/page.tsx (unchanged bodies) ----
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent','growerActorIsCurrent','readCurrentGrowerBook','commitGrowerAcceptance','commitNurseryBatchReferences','rememberStoredPlan','saveGrowerProfiles','saveScopedGrowerInputs','refreshAdmittedStoredPlan'];
const bodies = new Map<string,string>(); let mountEffect = '';
(function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) bodies.set(node.name.text,node.getText(page));
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect' && node.arguments[0]?.getText(page).includes('setDesign(loadFacilitatorState())')) mountEffect=node.arguments[0].getText(page);
  ts.forEachChild(node,visit);
})(page);
assert.equal(bodies.size,names.length); assert.ok(mountEffect);
const compiled=ts.transpileModule([...bodies.values(),`const runMount=${mountEffect};`].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function parent(book: unknown) {
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book));
  let notify=()=>{};
  const state:any={plan:null,planWriteBase:{current:null},planSaveConflict:false,planSaveFailed:false,saveTimer:{current:null},
    growerOwner:account.activeAccountUid(),growerSample:samples.isSampleMode(),growerScope:scope,growerScopeKey:growerPlanningScopeKey(scope),productionSiteId:siteId,
    growerWriteScope:{current:{key:growerPlanningScopeKey(scope),owner:account.activeAccountUid(),sample:samples.isSampleMode()}},
    growerBookContext:{current:{siteId,owner:account.activeAccountUid(),sample:samples.isSampleMode(),scopeKey:growerPlanningScopeKey(scope)}},
    activeAccountUid:account.activeAccountUid,isSampleMode:samples.isSampleMode,isBackendConfigured:()=>probe.configured,getFirebase:()=>({auth:{currentUser:probe.actor?{uid:probe.actor}:null}}),
    readRawCropPlanReceipt:crop.readRawCropPlanReceipt,loadCropPlanWithWriteAdmission:crop.loadCropPlanWithWriteAdmission,cropPlanWriteAdmissionMatches:crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless:crop.cropPlanWriteCandidateIsLossless,cropPlanWriteToken:crop.cropPlanWriteToken,saveCropPlanWithReceipt:crop.saveCropPlanWithReceipt,
    prepareGrowerWorkflowAcceptance,prepareGrowerNurseryBatchReferenceChanges,growerPlanningScopeKey,normaliseGrowerPlanningProfiles,sanitiseHarvestTargets:crop.sanitiseHarvestTargets,sanitiseNurserySettings,harvestTargetsSourceKey,
    // Inert UI/history leaves used by the actual admitted-storage recovery function. None
    // changes actor, source, storage admission, tokens or planSaveConflict directly.
    suggestionScopeRef:{current:null},planHistoryContext:{current:new WeakMap()},suggestedPlanHistory:{current:new WeakMap()},
    setAutoPhase(){},setAutoResult(){},setIdealMeta(){},setAutoGenerating(){},setPickerBedId(){},setPickerCrop(){},setActivePlanting(){},setPlanHistory(){},
    clearTimeout(){},setPlan(value:any){state.plan=typeof value==='function'?value(state.plan):value;notify();},setPlanSaveConflict(value:boolean){state.planSaveConflict=value;notify();},setPlanSaveFailed(value:boolean){state.planSaveFailed=value;},
    setDesign(){},loadFacilitatorState:()=>null,setCurrentMonth(){},setCurrentYear(){},setFavouriteCropKeys(){},loadFavouriteCropKeys:()=>new Set(),
    setAllowBedSharing(){},loadAllowBedSharing:()=>false,setPriceOverrides(){},loadCropPriceOverrides:()=>({}),setCashflowSettings(){},loadCashflowSettings:()=>({}),setMounted(){},
    myDesigns:()=>Promise.resolve([]),setMyDesignsList(){},setStudioChoices(){},studioPlanChoices:()=>[],loadPlaces:()=>[],loadCanvasState:()=>null};
  const functions=Function('state',`with(state){${compiled};return {${names.join(',')},runMount};}`)(state);
  functions.runMount();assert.equal(state.planSaveConflict,false,'canonical fixture must have actual loaded admission');
  return {state,...functions,notify(callback:()=>void){notify=callback;}};
}
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(item=>text(item as ReactTestInstance|string)).join('');
const tick=()=>new Promise(resolve=>setTimeout(resolve,2));

// Mount the real hook and the real saved-nursery panel with the same props the
// facilitator page passes at app/facilitator/crops/page.tsx:2414-2423.
async function mountedSavedPanel() {
  const f=await savedNurseryFixture();local.setItem(studioKey(),JSON.stringify(f.raw));const c=parent(f.book);
  let renderer!:ReactTestRenderer,latest!:ReturnType<typeof useGrowerWorkflow>,counter=0;
  // Observation-only wrapper: records the real parent writer's returned status, changes nothing.
  const outcomes:string[]=[];const commitNurseryReferences=(request:Parameters<typeof c.commitNurseryBatchReferences>[0])=>{const result=c.commitNurseryBatchReferences(request);outcomes.push(result.status);return result;};
  const selection={kind:'studio-canvas' as const,sourceId:siteId};
  function App(){const [,render]=React.useState(0),expectedActor=c.growerActorIsCurrent;c.notify(()=>render(value=>value+1));
    latest=useGrowerWorkflow({selection,scope,resourceSiteId:c.state.productionSiteId,book:c.state.plan,actorIsCurrent:()=>expectedActor(),readCurrentBook:c.readCurrentGrowerBook,
      commitAcceptance:c.commitGrowerAcceptance,commitNurseryReferences,createPlantingId:()=>`persistent-${++counter}`});
    return React.createElement(SavedPanel,{review:latest.savedNurseryReview,checking:latest.savedNurseryChecking,settings:c.state.plan?.nursery,
      contextRevision:latest.contextRevision,sample:c.state.growerSample,onRefresh:latest.onReadSavedNursery,onCheckCurrent:latest.onCheckSavedNurseryCurrent,
      onCheckBindingCurrent:latest.onCheckSavedNurseryBindingCurrent,onSaveReferences:latest.onSaveNurseryBatchReferences,
      onRecordSowing:latest.onRecordNurserySowing,onRecordProgress:latest.onRecordNurseryProgress,onRecordFieldPlanting:latest.onRecordNurseryFieldPlanting});}
  act(()=>{renderer=create(React.createElement(App));});
  const button=(label:string)=>{const node=renderer.root.findAllByType('button').find(item=>text(item)===label);assert.ok(node,label);return node;};
  const settle=async(done:()=>boolean)=>{for(let i=0;i<400&&!done();i++)await act(async()=>{await tick();});assert.ok(done(),'panel did not settle: status="'+ui.status()+'" buttons='+JSON.stringify(renderer.root.findAllByType('button').map(item=>text(item)))+' review='+!!latest.savedNurseryReview+' rev='+latest.contextRevision+' conflict='+c.state.planSaveConflict);};
  const status=()=>renderer.root.findAll(node=>node.type==='p'&&node.props.role==='status'&&node.props['aria-live']==='polite')[0];
  const ui={c,f,outcomes,get latest(){return latest;},text:()=>text(renderer.root),status:()=>text(status()),
    retainSaveCallback:()=>button('Save all touched references').props.onClick as ()=>void,
    async check(){await act(async()=>{button('Check saved nursery batches').props.onClick();});await settle(()=>!!latest.savedNurseryReview&&!latest.savedNurseryChecking&&text(button('Check saved nursery batches'))==='Check saved nursery batches');},
    enter(batch:number,label:string,value:string){const input=renderer.root.findAll(node=>node.type==='input'&&node.props['aria-label']===`${label} — saved batch ${batch}`)[0];assert.ok(input,label);act(()=>input.props.onChange({target:{value}}));},
    async save(){const writes=local.writes;await act(async()=>{button('Save all touched references').props.onClick();});
      // Settled = no save in flight, a visible outcome, and no pending readback;
      // then let any parent/hook rerender (source withdrawal) land before reading.
      await settle(()=>!renderer.root.findAllByType('button').some(item=>text(item)==='Saving touched batch references…')
        &&ui.status()!==''&&!/^Checking the confirmed write/.test(ui.status()));
      for(let i=0;i<25;i++)await act(async()=>{await tick();});return local.writes-writes;},
    dispose(){act(()=>renderer.unmount());}};
  await ui.check();
  assert.equal(latest.savedNurseryReview?.references.length,2);
  return ui;
}
const enterAll=(ui:Awaited<ReturnType<typeof mountedSavedPanel>>)=>{ui.enter(1,'Your variety / cultivar (optional)','REVIEW-017 variety');ui.enter(1,'Your seed-lot reference (optional)','REVIEW-017 lot');};
const FALSE_NEGATIVE=/could not be saved in this context|have not been applied to current saved batches/;
const persistedLabels=()=>{const saved=JSON.parse(readCanonicalCropPlanFixtureRaw());return JSON.stringify(saved.plantings).includes('REVIEW-017 lot');};

test('R-A1 post-write readback fault: real parent returns superseded after the labels persisted; panel must not say they were not saved', async()=>{
  const ui=await mountedSavedPanel();try{
    enterAll(ui);
    // One-shot synthetic storage readback fault delivered after the real write
    // dispatches CROP_PLAN_CHANGED_EVENT (lib/crop-plan.ts:907). The stored bytes stay.
    events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,()=>{local.onRead=()=>{local.onRead=null;throw Error('synthetic post-write readback fault');};},{once:true});
    const wrote=await ui.save();
    assert.equal(wrote,1,'exactly one real storage write');
    assert.deepEqual(ui.outcomes,['superseded'],'real parent result');
    assert.equal(ui.c.state.planSaveConflict,true,'real parent marks the saved plan as unconfirmed (superseded)');
    assert.equal(persistedLabels(),true,'the user labels are physically in the canonical saved book');
    const message=ui.status();
    assert.doesNotMatch(message,FALSE_NEGATIVE,`panel denies a completed write: "${message}"`);
    assert.match(message,/write completed/i,`panel must disclose the completed write: "${message}"`);
    assert.doesNotMatch(ui.text(),/unsaved and held separately/,'retained entries were written, not unsaved');
  }finally{ui.dispose();}
});

test('R-A2 post-write overwrite (existing controller trigger): superseded must be reported as a completed but unconfirmed write', async()=>{
  const ui=await mountedSavedPanel();try{
    enterAll(ui);const {book}=ui.f;
    events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,()=>replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:987654})),{once:true});
    const wrote=await ui.save();
    assert.ok(wrote>=1,'the real writer wrote before the overwrite');
    assert.deepEqual(ui.outcomes,['superseded'],'real parent result');
    assert.equal(ui.c.state.planSaveConflict,true);
    const message=ui.status();
    assert.doesNotMatch(message,FALSE_NEGATIVE,`panel misstates the outcome: "${message}"`);
    assert.match(message,/write completed/i);
  }finally{ui.dispose();}
});

test('R-A-NC1 negative control: a real pre-write hold (external book change) performs no write and keeps the not-saved wording', async()=>{
  const ui=await mountedSavedPanel();try{
    enterAll(ui);const {book}=ui.f;
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({...book,updatedAt:555}));
    const before=readCanonicalCropPlanFixtureRaw();
    const wrote=await ui.save();
    assert.equal(wrote,0,'held path must not write');
    assert.ok(ui.outcomes.every(status=>status==='held'),'no parent write admitted');
    assert.equal(readCanonicalCropPlanFixtureRaw(),before);
    assert.equal(persistedLabels(),false);
    assert.match(ui.status(),/could not be saved in this context|have not been applied/);
    assert.doesNotMatch(ui.status(),/write completed/i);
  }finally{ui.dispose();}
});

test('R-A-NC2 negative control: a real confirmed save still reaches the checked success message', async()=>{
  const ui=await mountedSavedPanel();try{
    enterAll(ui);
    const wrote=await ui.save();
    assert.equal(wrote,1);assert.deepEqual(ui.outcomes,['confirmed']);assert.equal(persistedLabels(),true);assert.equal(ui.c.state.planSaveConflict,false);
    assert.match(ui.status(),/References saved and current saved batches checked/);
  }finally{ui.dispose();}
});

test('R-A-NC3 negative control: a real storage write failure keeps the not-confirmed wording and no write', async()=>{
  const ui=await mountedSavedPanel();try{
    enterAll(ui);
    const actual=local.setItem;local.setItem=()=>{throw Error('Synthetic reference quota');};
    let wrote:number;try{wrote=await ui.save();}finally{local.setItem=actual;}
    assert.equal(persistedLabels(),false);assert.deepEqual(ui.outcomes,['failed']);
    assert.match(ui.status(),/The save outcome is not confirmed\. Your entries are retained/);
    assert.doesNotMatch(ui.status(),/write completed/i);
    void wrote;
  }finally{ui.dispose();}
});

// REVIEW-A extension. Recovery uses the actual ninth AST-extracted parent function;
// no conflict flag/token/admission is directly reset and no acknowledgement is forged.
test('R-A3 completed unconfirmed write recovers through actual admitted refresh and a fresh private hook view, then explicit new edit saves once', async()=>{
  const ui=await mountedSavedPanel();try{
    const originalView=ui.latest.savedNurseryReview;assert.ok(originalView);
    enterAll(ui);const retainedSubmit=ui.retainSaveCallback();
    events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT,()=>{local.onRead=()=>{local.onRead=null;throw Error('synthetic one-shot recovery readback fault');};},{once:true});
    const first=await ui.save();assert.equal(first,1);assert.deepEqual(ui.outcomes,['superseded']);
    assert.equal(ui.c.state.planSaveConflict,true);assert.equal(persistedLabels(),true);assert.match(ui.status(),/write completed/i);

    // Run the same clean-view re-admission function used by the real page's storage
    // revision effect. It re-reads canonical storage and all of its original guards.
    const storedBeforeRecovery=readCanonicalCropPlanFixtureRaw();
    await act(async()=>{ui.c.refreshAdmittedStoredPlan();});
    assert.equal(ui.c.state.planSaveConflict,false,'actual admitted refresh cleared conflict');
    assert.equal(readCanonicalCropPlanFixtureRaw(),storedBeforeRecovery,'re-admission did not rewrite the plan');
    assert.equal(ui.c.readCurrentGrowerBook().status,'ready','actual parent read authority is current');
    await ui.check();const freshView=ui.latest.savedNurseryReview;assert.ok(freshView);assert.notEqual(freshView,originalView);
    assert.equal(await ui.latest.onCheckSavedNurseryCurrent(freshView),true,'new private hook binding passes actual recheck');

    const writesBeforeRetained=local.writes;
    await act(async()=>{retainedSubmit();await tick();});
    assert.equal(local.writes,writesBeforeRetained,'old submitted callback cannot write against fresh admission');
    assert.deepEqual(ui.outcomes,['superseded']);
    ui.enter(1,'Your seed-lot reference (optional)','REVIEW-A recovered lot');
    const second=await ui.save();assert.equal(second,1);assert.deepEqual(ui.outcomes,['superseded','confirmed']);
    assert.match(ui.status(),/References saved and current saved batches checked/);
    assert.equal(JSON.stringify(JSON.parse(readCanonicalCropPlanFixtureRaw()).plantings).includes('REVIEW-A recovered lot'),true);
  }finally{ui.dispose();}
});
