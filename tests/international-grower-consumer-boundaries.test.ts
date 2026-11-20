import { provisionalCalendarFixture } from './provisional-calendar-fixture.ts';
import { buildGrowerBoardTasks, buildGrowerTasksIcs, buildTaskIcs } from '../lib/task-board.ts';
import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import GrowerCycleIntent from '../components/crops/GrowerCycleIntent.ts';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS, cropByKey } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { buildPlanYieldBenchmark, readRawCropPlanReceipt, cropPlanWriteToken, loadCropPlanWithWriteAdmission, cropPlanWriteAdmissionMatches, confirmOnceSowing, restampEditedOnce, tasksForPlan, type CropPlanState, type HarvestTarget, type Planting } from '../lib/crop-plan.ts';
import { activeAccountUid, activeAccountLocalStorageKey } from '../lib/account-local-storage.ts';
import { isSampleMode } from '../lib/sample-mode.ts';
import { getFirebase, isBackendConfigured } from '../lib/firebase/init.ts';
import { hasGrowerCycleMarker, isProvenForeignGrowerCycle, createGrowerCyclePlanting, normaliseGrowerCycleAttachment } from '../lib/international/grower-cycle.ts';
import { createSavedProvisionalProfile, createProvisionalCycleContext } from '../lib/international/provisional-profile.ts';
import { buildProvisionalCycleEvidence } from '../lib/international/provisional-crop-export.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { growerPlanningScopeKey, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft } from '../lib/international/grower-workflow.ts';
import { buildBedPlanRows, buildBuyingSchedule, buildProductionGuide } from '../lib/crop-export-schedule.ts';
import { buildPlanDashboard, buildPlanTableRows, idleBedMonths } from '../lib/crop-export-benchmark.ts';
import { drawCropPlanPages, type CropPlanPdfInput } from '../lib/crop-export-pdf.ts';

// Engineering fixtures only. These short durations and quantities are not crop guidance.
const recordedAt = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic arithmetic fixture.' } });
async function fixture(siteId = 'site:1.00000,1.00000', bedPrefix = 'current') {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId;
  canvas.frame.centerLat = Number(siteId.slice(5).split(',')[0]); canvas.frame.centerLng = Number(siteId.split(',')[1]);
  const first = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [1, 2].map(index => ({ ...first, id: `${bedPrefix}-${index}`, x: index / 3, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'synthetic-private-source-receipt' }));
  assert.equal(source.status, 'ready');
  if (source.status !== 'ready') throw Error('Synthetic source fixture was held');
  const scope = { kind: 'mapped-site', siteId } as const;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'profile-a', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const target: HarvestTarget = { id: 'target-a', siteId, cropKey: profile.cropKey, startMonth: '2028-02', endMonth: '2028-02', weeklyKg: 7, marketablePercent: 50 };
  const book: CropPlanState = { version: 1, plantings: [], growerPlanningProfiles: [profile], harvestTargets: [target], updatedAt: 123,
    planNotes: [{ kind: 'basis', text: 'Preserve this accepted explanation.' }], planNotesAt: Date.UTC(2026, 10, 5) };
  const draft: GrowerWorkflowDraft = { planningStart: '2028-02-01', planningEndExclusive: '2028-03-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: target.id, profileId: profile.profileId }], available: source.beds.map(bed => ({ bedId: bed.id,
      start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true })), assumptionsConfirmed: true };
  return { scope, source, book, draft, recordedAt, profile, target, canvas };
}
async function ownFixture() {
  const f = await fixture(), review = assembleGrowerWorkflowReview(f);
  assert.equal(review.status,'review'); if(review.status!=='review') throw Error('Fixture held');
  const row=createGrowerCyclePlanting(review.proposal.cycles[0],{plantingId:'saved-own-row',acceptedAt:recordedAt,geometryFingerprint:f.source.geometryFingerprint})!;
  assert.ok(row);return{...f,row,beds:f.source.beds.map(bed=>({...bed}))};
}
const pageText=readFileSync(new URL('../app/facilitator/crops/page.tsx',import.meta.url),'utf8');
const page=ts.createSourceFile('page.tsx',pageText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function functionText(name:string){let found:ts.FunctionDeclaration|undefined;function visit(node:ts.Node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit);}visit(page);assert.ok(found,`Actual handler ${name} missing`);return found.getText(page);}
function variableText(name:string){let found:ts.VariableDeclaration|undefined;function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(page)===name)found=node;ts.forEachChild(node,visit);}visit(page);assert.ok(found,`Actual derived control ${name} missing`);return 'const '+found.getText(page)+';';}
const transpile=(s:string,jsx=false)=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:jsx?ts.JsxEmit.React:undefined}}).outputText;

// Execute the current page's actual mutation bodies and derived row partition.
// Only its state writer/history/navigation admission are controlled boundaries;
// this catches removal of the fresh setter guard as well as visual-only guards.
function handlers(book:CropPlanState,beds:any[],binding?:{owner:string|null;sample:boolean;token:string|null;planKey:string;admission:ReturnType<typeof loadCropPlanWithWriteAdmission>['admission']}){
  let current=book;const snapshot=structuredClone(book),state:any={plan:snapshot,beds,useMemo:(f:()=>unknown)=>f(),hasGrowerCycleMarker,
    growerScopeKey:'',growerScope:null,selectedGrowerSource:null,growerPlanningScopeKey,isProvenForeignGrowerCycle,
    currentPlanningScopeAllowed:()=>true,pushPlanHistory(){},setterCalls:0,setPlan(fn:any){state.setterCalls++;current=typeof fn==='function'?fn(current):fn;},
    planWriteBase:{current:binding??null},planSaveConflict:false,activeAccountUid,isSampleMode,getFirebase,isBackendConfigured,cropPlanWriteToken,cropPlanWriteAdmissionMatches,
    suggestedPlanHistory:{current:new WeakMap()},
    genId:()=> 'new-legacy-id',restampEditedOnce,confirmOnceSowing,currentMonth:2,currentYear:2028,
    setAutoResult(){},setAutoPhase(){},setConfirmingClear(){},hasOwnRecords:false,suggestionScopeRef:{current:'same'},planningScopeKey:'same',autoResult:{plantings:[],notes:[]},pattern:'summer'};
  const names=['addPlanting','updatePlanting','removePlanting','confirmPastSowing','clearAllPlantings','acceptAutoSuggest','plannerActorIsCurrent','stageSuggestedPlanHistory','planHistoryMetadataKey'];
  const source=transpile(['currentBedIds','plantings','legacyPlantings','legacyAddBlocked'].map(variableText).join('\n')+'\n'+names.map(functionText).join('\n'));
  const result=Function('state',`with(state){${source};return {${names.join(',')}};}`)(state);
  return{...result,state,get book(){return current;},replaceBook(book:CropPlanState){current=book;}};
}
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(c=>text(c as ReactTestInstance|string)).join('');
const SavedRows=Function('React','useState','projectGrowerCycles','cropByKey','Link','GrowerCycleIntent','createProvisionalCycleContext','normaliseGrowerCycleAttachment','buildProvisionalCycleEvidence',transpile(functionText('SavedGrowerRows'),true)+'\nreturn SavedGrowerRows;')(React,React.useState,projectGrowerCycles,cropByKey,(props:any)=>React.createElement('a',props,props.children),GrowerCycleIntent,createProvisionalCycleContext,normaliseGrowerCycleAttachment,buildProvisionalCycleEvidence);
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

test('the actual saved-record view retains accepted evidence when current country use is held and offers a separate historical download', async () => {
  const f = await fixture(), bed = f.source.beds[0];
  const saved = createSavedProvisionalProfile({ profileId: 'provisional-preview', cropKey: f.profile.cropKey,
    context: { scope: f.scope, countryCode: 'DE', agriculturalRegionReference: null, establishment: 'direct', waterRegime: 'irrigated' },
    recordedAt, asOf: recordedAt.slice(0, 10), candidates: [], overrides: f.profile.inputs,
    measuredAreaM2: { ...own(bed.areaM2, 'm2'), arithmeticBasis: f.source.measuredAreas[0].arithmeticBasis },
    fieldEntryDate: own('2028-02-01', 'utc-date') }, 'private-historical-profile', '2026-11-05T12:01:00.000Z', f.source, bed.id, bed.label);
  assert.ok(saved);
  const conditions = { countryCode: 'DE', agriculturalRegionReference: null, policyFingerprint: 'private-historical-policy', knownPlantingRestriction: null };
  const review = assembleGrowerWorkflowReview({ ...f, book: { ...f.book, growerPlanningProfiles: [saved] },
    recordedAt: '2026-11-06T12:00:00.000Z', provisionalSiteConditions: conditions,
    draft: { ...f.draft, targetProfiles: [{ targetId: f.target.id, profileId: saved.profileId }] } });
  assert.equal(review.status, 'review', review.issues.join(',')); if (review.status !== 'review') throw Error('Fixture held');
  const row = createGrowerCyclePlanting(review.proposal.cycles[0], { plantingId: 'private-historical-row',
    acceptedAt: '2026-11-06T12:01:00.000Z', geometryFingerprint: f.source.geometryFingerprint }); assert.ok(row);
  let renderer!: ReturnType<typeof create>, exports = 0;
  const props = { rows: [row], wholeBookRows: [row], source: f.source, scope: f.scope, conditions,
    onExport: async (candidate: Planting) => { assert.equal(candidate, row); exports++; return true; } };
  try {
    await act(async () => { renderer = create(React.createElement(SavedRows, props)); });
    assert.match(text(renderer.root), /Own estimates: field entry/);
    assert.match(text(renderer.root), /Original evidence as of \(UTC\): 2026-11-05/);
    assert.match(text(renderer.root), /New evidence review as of \(UTC\): 2026-11-06/);
    await act(async () => renderer.update(React.createElement(SavedRows, { ...props, conditions: { ...conditions, countryCode: 'GB' } })));
    assert.match(text(renderer.root), /Held:/); assert.doesNotMatch(text(renderer.root), /Own estimates: field entry/);
    assert.match(text(renderer.root), /Country: DE/); assert.doesNotMatch(text(renderer.root), /Country: GB/);
    assert.doesNotMatch(text(renderer.root), /private-historical|[a-f0-9]{64}/);
    const download = renderer.root.findAllByType('button').find(button => text(button) === 'Download historical record'); assert.ok(download);
    await act(async () => { await download.props.onClick(); }); assert.equal(exports, 1);
    assert.match(text(renderer.root), /Historical record download requested/);
  } finally { if (renderer) await act(async () => renderer.unmount()); }
});

test('the actual saved-row screen reads back requested weight and window after JSON without substituting allocated bed capacity',async()=>{
 const f=await fixture();
 const draft:GrowerWorkflowDraft={...f.draft,targetProfiles:[],demands:[{kind:'grower-entered',entryId:'private-ui-entry',purpose:'household',
  cropKey:f.profile.cropKey,profileId:f.profile.profileId,grossKg:'12.34567',harvestStart:'2028-02-01',harvestEndExclusive:'2028-03-01'}]};
 const review=assembleGrowerWorkflowReview({...f,draft});assert.equal(review.status,'review');if(review.status!=='review')return;
 const prepared=prepareGrowerWorkflowAcceptance({review,binding:{source:f.source,draft,recordedAt},scope:f.scope,source:f.source,book:f.book,
  acceptedAt:recordedAt,plantingIds:review.proposal.cycles.map((cycle,index)=>({cycleId:cycle.cycleId,plantingId:`ui-row-${index}`}))});
 assert.equal(prepared.status,'prepared');if(prepared.status!=='prepared')return;
 const rows=JSON.parse(JSON.stringify(prepared.rows));let renderer:any;
 try{
  await act(async()=>{renderer=create(React.createElement(SavedRows,{rows,wholeBookRows:rows,source:f.source,scope:f.scope}));});
  assert.match(text(renderer.root),/Planning purpose: household food/);
  // Original entered input is now lossless across the common public presenter.
  // Keep this actual screen assertion stricter than the former rounded readback.
  assert.match(text(renderer.root),/Original request for all cycles in this demand: 12\.34567 kg gross/);
  assert.doesNotMatch(text(renderer.root),/≈12\.346 kg gross/);
  assert.match(text(renderer.root),/2028-02-01 to before 2028-03-01 \(UTC\)/);
  assert.doesNotMatch(text(renderer.root),/private-ui-entry|profile-a|synthetic-private-source-receipt/);
  await act(async()=>renderer.update(React.createElement(SavedRows,{rows,wholeBookRows:rows,source:{...f.source,geometryFingerprint:'moved'},scope:f.scope})));
  assert.match(text(renderer.root),/Held:/);assert.doesNotMatch(text(renderer.root),/Original request for all cycles/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('actual page clear/remove/edit/confirmation retain own, foreign and malformed-marker records',async()=>{
 const f=await ownFixture(),legacy={id:'legacy',bedId:f.row.bedId,cropKey:f.row.cropKey,sowMonth:2};
 const foreign={...f.row,id:'foreign-protected',growerCycle:{...f.row.growerCycle,plantingId:'foreign-protected',assessmentSnapshot:{...f.row.growerCycle.assessmentSnapshot,scope:{kind:'mapped-site',siteId:'site:2.00000,2.00000'}}}};
 const malformed={...f.row,id:'malformed-protected',growerCycle:null};
 const book={...f.book,plantings:[legacy,f.row,foreign,malformed]},before=JSON.stringify(book),h=handlers(book,f.beds);
 for(const row of [f.row,foreign,malformed]){h.updatePlanting(row.id,row.cropKey,3,1,true,'changed');h.removePlanting(row.id);h.confirmPastSowing(row.id);assert.equal(JSON.stringify(h.book),before);}
 h.clearAllPlantings();assert.deepEqual(h.book.plantings,[f.row,foreign,malformed]);assert.equal(JSON.stringify(book),before);
});

test('actual stale callbacks recheck fresh rows before deleting, overwriting or adding to own occupied ground',async()=>{
 const f=await ownFixture(),legacy={id:'formerly-legacy',bedId:f.row.bedId,cropKey:f.row.cropKey,sowMonth:2};
 const old={...f.book,plantings:[legacy]},now={...f.book,plantings:[{...f.row,id:legacy.id,growerCycle:{...f.row.growerCycle,plantingId:legacy.id}}]};
 for(const action of ['clearAllPlantings','removePlanting','updatePlanting','confirmPastSowing']){
  const h=handlers(old,f.beds);h.replaceBook(now);
  if(action==='updatePlanting')h[action](legacy.id,legacy.cropKey,3,1,true,'changed');else h[action](legacy.id);
  assert.equal(h.book,now,action+' must preserve the fresh own row');
 }
 // A missing new admission must not let this regression pass at the outer
 // guard. Establish the real saved base, then simulate a fresher pending React
 // setter value while durable bytes/lease still match that original render.
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),rows=new Map<string,string>();
 const memory={getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},removeItem:(key:string)=>{rows.delete(key);}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:memory,sessionStorage:memory}});
 try{
  memory.setItem(activeAccountLocalStorageKey('imbewu_crop_plan_v1'),JSON.stringify(old));
  await initialiseCropPlanFixture();const loaded=loadCropPlanWithWriteAdmission();assert.equal(loaded.admission.status,'ready');assert.ok(loaded.token);
  const binding={owner:activeAccountUid(),sample:isSampleMode(),token:loaded.token,planKey:JSON.stringify(loaded.book),admission:loaded.admission};
  assert.equal(cropPlanWriteAdmissionMatches(binding.admission,binding.planKey,binding.token),true);
  const h=handlers(loaded.book,f.beds,binding);h.replaceBook({...old,plantings:[legacy,f.row]});const before=h.book;
  h.addPlanting(f.row.bedId,f.row.cropKey,3,1,false,'');assert.equal(h.book,before);
  const calls=h.state.setterCalls;
  h.state.autoResult.plantings=[{...legacy,id:'suggested'}];h.acceptAutoSuggest();assert.equal(h.book,before);
  assert.equal(h.state.setterCalls,calls+1,'a valid original admission must reach the actual fresh-row setter guard');
  assert.equal(cropPlanWriteToken(),binding.token,'the hold must come from fresh pending rows, not a stale durable token');
  const positive=handlers(loaded.book,f.beds,binding);positive.state.autoResult.plantings=[{...legacy,id:'allowed-suggestion'}];positive.acceptAutoSuggest();
  assert.equal(positive.book.plantings.length,loaded.book.plantings.length+1,'the same real admitted context still accepts a supported ordinary proposal');
  assert.equal(positive.state.suggestedPlanHistory.current.has(positive.book),true);
 }finally{releaseCropPlanFixture();if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');}
});

test('duplicate identities and changed foreign rows are never cleared by a stale bed-id selection',async()=>{
 const f=await ownFixture(),legacy={id:'shared',bedId:f.row.bedId,cropKey:f.row.cropKey,sowMonth:2};
 const original={...f.book,plantings:[legacy]},other={...legacy,bedId:'foreign-bed'};
 const h=handlers(original,f.beds);h.replaceBook({...original,plantings:[legacy,other]});const fresh=h.book;h.clearAllPlantings();assert.equal(h.book,fresh);
 const late=handlers(original,f.beds);late.replaceBook({...original,plantings:[other]});const changed=late.book;late.removePlanting(legacy.id);late.clearAllPlantings();assert.equal(late.book,changed);
});

test('ordinary shown legacy actions still work while unrelated foreign beds remain saved',async()=>{
 const f=await ownFixture(),legacy={id:'legacy',bedId:f.row.bedId,cropKey:f.row.cropKey,sowMonth:2},foreign={...legacy,id:'foreign-legacy',bedId:'different-bed'};
 const h=handlers({...f.book,plantings:[legacy,foreign]},f.beds);h.updatePlanting(legacy.id,legacy.cropKey,3,1,false,'fixture');
 assert.equal(h.book.plantings[0].sowMonth,3);assert.deepEqual(h.book.plantings[1],foreign);
 const clear=handlers({...f.book,plantings:[legacy,foreign]},f.beds);clear.clearAllPlantings();assert.deepEqual(clear.book.plantings,[foreign]);
 const add=handlers({...f.book,plantings:[]},f.beds);add.addPlanting(f.row.bedId,f.row.cropKey,2,1,false,'');assert.equal(add.book.plantings.length,1);
});

test('own occupied ground prevents the actual gap-fill producer from running rather than borrowing catalogue availability',async()=>{
 const f=await ownFixture();let calls=0;
 const source=transpile(variableText('gapFills'));
 const env={useMemo:(fn:()=>unknown)=>fn(),allowCataloguePlanning:true,hasOwnRecords:true,suggestGapFills(){calls++;throw Error('own ground cannot reach catalogue gap fills');},yearOfFood:{},beds:f.beds,plantings:[f.row],pattern:'summer',currentMonth:2,yearGate:null,siteSurvey:null};
 const result=Function('state',`with(state){${source};return gapFills;}`)(env);assert.deepEqual(result,[]);assert.equal(calls,0);
});

test('actual saved-row rendering is explicit when source context is absent, foreign or stale, and dated only when checked',async()=>{
 const f=await ownFixture();let renderer:any;
 try{
  await act(async()=>{renderer=create(React.createElement(SavedRows,{rows:[f.row],wholeBookRows:[f.row],source:null,scope:f.scope}));});
  assert.match(text(renderer.root),/Current saved source not checked/);assert.match(text(renderer.root),/Held:/);assert.equal(renderer.root.findByType('a').props.href,'/cropplan');
  assert.ok(!text(renderer.root).includes(f.source.sourceRevision));
  await act(async()=>renderer.update(React.createElement(SavedRows,{rows:[f.row],wholeBookRows:[f.row],source:f.source,scope:f.scope})));
  assert.match(text(renderer.root),new RegExp('field entry '+projectGrowerCycles([f.row],{scope:f.scope,beds:f.beds,geometryFingerprint:f.source.geometryFingerprint}).ownCycles[0].assessment.schedule.fieldEntryDate));
  await act(async()=>renderer.update(React.createElement(SavedRows,{rows:[f.row],wholeBookRows:[f.row],source:{...f.source,geometryFingerprint:'changed'},scope:f.scope})));
  assert.match(text(renderer.root),/Held:/);assert.ok(!text(renderer.root).includes('Own estimates: field entry'));
  await act(async()=>renderer.update(React.createElement(SavedRows,{rows:[f.row],wholeBookRows:[f.row],source:f.source,scope:{kind:'mapped-site',siteId:'site:2.00000,2.00000'}})));
  assert.match(text(renderer.root),/Held:/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('PDF table, bed rows, production advice and idle coverage preserve held evidence without dates, quantities or empty-land claims',async()=>{
 const f=await ownFixture();
 for(const row of [f.row,{...f.row,growerCycle:null},{...f.row,growerCycle:undefined},{...f.row,finishedOnceSowing:true as const}]){
  const rows=buildPlanTableRows([row],f.beds),r=rows.find(r=>r.area===f.beds[0].label)!;
  assert.equal(r.establish,'Own dated record');assert.equal(r.intoField,'Check saved source');assert.equal(r.harvest,'Not a catalogue schedule');assert.equal(r.yieldKg,null);
  const bed=buildBedPlanRows([row],f.beds).find(b=>b.bedId===row.bedId)!;assert.deepEqual(bed.crops,[]);assert.deepEqual(bed.heldGrowerPlantingIds,[row.id]);
  assert.deepEqual(buildBuyingSchedule([row],f.beds,2),[]);
  const guide=buildProductionGuide(null,[row],[],2);assert.equal(guide.cropChoices.length,1);assert.equal(guide.cropChoices[0].title,'Own dated records retained');
  for(const now of [undefined,2])assert.equal(idleBedMonths([row],f.beds,now).count,null);
  const dashboard=buildPlanDashboard([row],f.beds,[],{nowMonth:2});assert.equal(dashboard.grossKg,null);assert.ok(dashboard.stats.some(s=>s.value==='Unknown'));assert.ok(!dashboard.signals.some(s=>/have no crop in the ground/.test(s)));
  assert.equal(buildPlanYieldBenchmark([row],f.beds).knownKg,null);
 }
 const legacy={id:'legacy',bedId:f.row.bedId,cropKey:f.row.cropKey,sowMonth:2};assert.notEqual(buildPlanTableRows([legacy],f.beds)[0].establish,'Own dated record');assert.equal(typeof idleBedMonths([legacy],f.beds,2).count,'number');
});

test('a real PDF includes own/held disclosure in section-only prints and never prints catalogue storage advice or zero yield for them',async()=>{
 const f=await ownFixture(),storage=CROPS.find(c=>c.storageMonths&&c.storageConditions)!;assert.ok(storage);
 const row={...f.row,cropKey:storage.key}; // A mismatched marked identity is held, never repaired to legacy.
 const {jsPDF}=await import('jspdf');
 const input:CropPlanPdfInput={plantings:[row],beds:f.beds,tasks:[],sections:['plan','calendar','numbers','fieldsheets'],now:new Date('2028-02-01T12:00:00.000Z'),meta:{planTitle:'Synthetic own record',siteLine:'Synthetic engineering example',locationLine:'Synthetic site',climateLine:'No guidance in this fixture',bedsSummary:'Measured fixture',dateLabel:'Synthetic date',estimatedKgPerYear:null,lossPercent:0}};
 const doc=new jsPDF({unit:'pt',format:'a4'}),printed:string[]=[];
 const actualText=doc.text.bind(doc);doc.text=((value:any,...args:any[])=>{printed.push(Array.isArray(value)?value.join(' '):String(value));return (actualText as any)(value,...args);}) as typeof doc.text;
 drawCropPlanPages(doc,input);assert.ok(doc.output().startsWith('%PDF-'));const pdf=printed.join(' ').replace(/\s+/g,' ');
 assert.match(pdf,/Saved own records retained/i);assert.match(pdf,/Own dated record/);assert.match(pdf,/Not a catalogue schedule/);assert.match(pdf,/Complete fresh-picking coverage is unknown/);
 assert.ok(!pdf.includes('sourced storage window'));assert.ok(!pdf.includes('No plantings yet'));assert.ok(!pdf.includes('No dated crop reserved here'));assert.match(pdf,/Own dated records held/);assert.ok(!pdf.includes('have no crop in the ground'));assert.ok(!pdf.includes('0.0 kg'));
 assert.ok(doc.getNumberOfPages()>1);
});


test('the shared foreign proof excludes only intact explicitly other-scope rows disjoint from eligible and held beds', async()=>{
 const f=await ownFixture(),foreign=await fixture('site:2.00000,2.00000','foreign');
 const review=assembleGrowerWorkflowReview(foreign);assert.equal(review.status,'review');if(review.status!=='review')throw Error('Foreign fixture held');
 const row=createGrowerCyclePlanting(review.proposal.cycles[0],{plantingId:'foreign-intact',acceptedAt:recordedAt,geometryFingerprint:foreign.source.geometryFingerprint})!;
 const ids=new Set(f.beds.map(b=>b.id));assert.equal(isProvenForeignGrowerCycle(row,f.scope,ids),true);
 for(const currentScope of [null,{} as any,foreign.scope])assert.equal(isProvenForeignGrowerCycle(row,currentScope,ids),false);
 assert.equal(isProvenForeignGrowerCycle(row,f.scope,new Set([...ids,row.bedId])),false,'held-bed collisions are not foreign exemptions');
 assert.equal(isProvenForeignGrowerCycle({...row,cropKey:CROPS[1].key},f.scope,ids),false);
 for(const marker of [null,undefined,{version:999}])assert.equal(isProvenForeignGrowerCycle({...row,growerCycle:marker},f.scope,ids),false);
 let reads=0;const accessor={...row};Object.defineProperty(accessor,'growerCycle',{enumerable:true,get(){reads++;return row.growerCycle;}});
 assert.equal(isProvenForeignGrowerCycle(accessor,f.scope,ids),false);assert.equal(reads,0);
 const scopeAccessor={...f.scope};Object.defineProperty(scopeAccessor,'siteId',{enumerable:true,get(){reads++;return f.scope.siteId;}});assert.equal(isProvenForeignGrowerCycle(row,scopeAccessor,ids),false);assert.equal(reads,0);
 const inherited=Object.create(row);assert.equal(isProvenForeignGrowerCycle(inherited,f.scope,ids),false);
});

test('scoped orphan and unreadable-association markers remain visible evidence rather than a complete empty plan',async()=>{
 const f=await ownFixture(),orphan={...f.row,bedId:'deleted-bed',growerCycle:{...f.row.growerCycle,bedId:'deleted-bed'}};
 const h=handlers({...f.book,plantings:[orphan]},f.beds);h.addPlanting(f.beds[0].id,f.row.cropKey,2,1,false,'');assert.equal(h.book.plantings.length,1);
 assert.equal(buildPlanDashboard([orphan],f.beds,[],{nowMonth:2}).grossKg,null);
 assert.equal(idleBedMonths([orphan],f.beds,2).count,null);
});

// This exercises the actual parent reader with the real authored JSON reader.
// A normalizer is deliberately unavailable: falling back to a reconstructed
// empty display book would erase the malformed row and reservation evidence.
test('actual parent review reader retains null rows, reservations and duplicate identities or explicitly holds them',async()=>{
 const f=await ownFixture(),original=Object.getOwnPropertyDescriptor(globalThis,'window');
 const rows=new Map<string,string>();const storage={getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);},removeItem:(k:string)=>{rows.delete(k);},get length(){return rows.size;},key:(i:number)=>[...rows.keys()][i]??null};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage,sessionStorage:storage}});
 try{
  await initialiseCropPlanFixture();
  const read=Function('state',`with(state){${transpile(functionText('readCurrentGrowerBook'))};return readCurrentGrowerBook;}`);
  for(const plantings of [[null,f.row],[f.row,{...f.row,id:f.row.id}]]){
   const raw={...f.book,plantings},bytes=JSON.stringify(raw);replaceCanonicalCropPlanFixtureRaw(bytes);
   const token=cropPlanWriteToken();assert.ok(token);
   const display={...f.book,plantings:[]};const base={owner:null,sample:false,planKey:JSON.stringify(display),token};
   const env={plan:display,growerActorIsCurrent:()=>true,planWriteBase:{current:base},growerOwner:null,growerSample:false,planSaveConflict:false,cropPlanWriteToken,readRawCropPlanReceipt,loadCropPlan(){throw Error('display normalizer must not grant review admission');}};
   const result=read(env)();assert.equal(result.status,'ready');assert.deepEqual(result.book.plantings,plantings);
   assert.equal(readCanonicalCropPlanFixtureRaw(),bytes);
   const recheck=assembleGrowerWorkflowReview({...f,book:result.book});assert.equal(recheck.status,'held','retained invalid rows cannot become reviewable empty occupancy');
   result.book.plantings.pop();assert.equal(readCanonicalCropPlanFixtureRaw(),bytes,'returned raw book is detached');
  }
 }finally{releaseCropPlanFixture();if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');}
});


test('accepted provisional sources and unknowns survive both calendar writers without changing dates or exposing structural identities', async () => {
  const f = await provisionalCalendarFixture(), before = JSON.stringify(f.row);
  const result = buildGrowerBoardTasks([f.row], [f.context], new Date('2028-02-01T00:00:00Z'), new Set());
  assert.equal(result.heldPlantings, 0); assert.equal(result.tasks.length, 6);
  for (const task of result.tasks) {
    assert.deepEqual(task.provisionalEvidenceLines, f.evidence.lines);
    assert.match(task.subtitle, /Provisional plan/);
  }
  const file = buildGrowerTasksIcs(result.tasks, { now: new Date('2031-01-01T00:00:00Z'), sample: true });
  const bodies = [...file.replace(/\r\n[ \t]/g, '').matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)\r\nEND:VEVENT/g)].map(match => match[1]);
  assert.equal(bodies.length, 6);
  for (const body of bodies) {
    assert.match(body, /provisional planned cycle/); assert.match(body, /not recorded work/);
    assert.match(body, /mipmcar9781.pdf/); assert.match(body, /Great Lakes States/);
    assert.match(body, /publication and revision date unknown/); assert.match(body, /not.*local suitability/);
    assert.match(body, /Original evidence as of.*2026-11-12/); assert.match(body, /New evidence review as of.*2026-11-13/);
    assert.match(body, /Variety: Unknown/);
    assert.doesNotMatch(body, /private-calendar|private-saved|policyFingerprint|geometryFingerprint|assessmentSnapshot/);
  }
  for (const task of result.tasks) {
    const single = buildTaskIcs(task, new Date('2031-01-01T00:00:00Z')).replace(/\r\n[ \t]/g, '');
    assert.match(single, /provisional planned cycle/); assert.match(single, /mipmcar9781.pdf/);
    assert.ok(single.includes('DTSTART;VALUE=DATE:' + task.dueDate!.replaceAll('-', '')));
  }
  const held = buildGrowerBoardTasks([f.row], [{ ...f.context, provisionalContext: { ...f.context.provisionalContext, countryCode: 'GB' } }], new Date(), new Set());
  assert.equal(held.tasks.length, 0); assert.equal(held.heldPlantings, 1);
  assert.equal(buildGrowerTasksIcs(held.tasks), ''); assert.equal(JSON.stringify(f.row), before);
});
