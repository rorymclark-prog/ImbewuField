import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { jsPDF } from 'jspdf';
import { inflateSync } from 'node:zlib';

const external = { builds: 0, deliveries: 0, pending: null as null | (() => void), delay: false };
Object.assign(globalThis, { __internationalConsumerExternal: external });
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.css')) return { shortCircuit: true, url: moduleUrl('export default new Proxy({}, {get: (_, key)=>key});') };
    if ((specifier === './firebase/init' || specifier === '@/lib/firebase/init')) return { shortCircuit: true,
      url: moduleUrl('export const getFirebase=()=>null; export const isBackendConfigured=()=>false;') };
    if (context.parentURL?.endsWith('/components/report/ReportCropPlan.tsx')) {
      if (specifier === '@/lib/i18n') return { shortCircuit: true, url: moduleUrl("export const useLanguage=()=>({lang:'en',t:key=>key});") };
      if (specifier === '@/lib/crop-export-pdf') return { shortCircuit: true, url: moduleUrl(`
        export async function buildCropPlanPdf() { const p=globalThis.__internationalConsumerExternal; p.builds++;
          if(p.delay) await new Promise(resolve=>{p.pending=resolve}); return new Blob(['fixture']); }
        export const cropPlanPdfFilename=()=> 'fixture.pdf';`) };
      if (specifier === '@/lib/report-pdf') return { shortCircuit: true, url: moduleUrl('export async function deliverPdf(){globalThis.__internationalConsumerExternal.deliveries++;}') };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(new URL('../', import.meta.url).href) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText };
    return next(url, context);
  },
});
const { CROPS } = await import('../lib/crop-catalog.ts');
const { buildDemoFacilitatorState } = await import('../lib/demo-farm.ts');
const { saveCropPlan, loadCropPlan } = await import('../lib/crop-plan.ts');
const { createSiteCountryContext } = await import('../lib/international/site-context.ts');
const { updateSiteCountryContext, loadPlaces } = await import('../lib/saved-places.ts');
const { loadCropBoardTasks, loadCropBoardYear, downloadTaskIcs } = await import('../lib/task-board.ts');
const { captureReportCropPlan, currentReportCropSupport, projectReportPlanningFacts } = await import('../lib/report-crop-plan.ts');
const { collectReportCropSnapshot } = await import('../lib/report-site-facts-collect.ts');
const { drawReportCropSummary } = await import('../lib/report-crop-pdf.ts');
const { buildReportPdf } = await import('../lib/report-pdf.ts');
const { default: ReportCropPlan } = await import('../components/report/ReportCropPlan.tsx');
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { SavedPlace } from '../lib/saved-places.ts';
import type { FactCropPlan } from '../lib/report-site-facts.ts';

after(()=> { hooks.deregister(); Reflect.deleteProperty(globalThis,'__internationalConsumerExternal'); });
class Storage {
  rows = new Map<string,string>();
  get length() { return this.rows.size; }
  key(index:number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key:string) { return this.rows.get(key) ?? null; }
  setItem(key:string,value:string) { this.rows.set(key,String(value)); }
  removeItem(key:string) { this.rows.delete(key); }
}
const siteId = 'site:0.00000,0.00000';
const crop = CROPS.find(candidate=>candidate.transplant && candidate.timingVerified !== false)!;
const canvas = (id=siteId, bedId='fixture-bed'):DesignCanvasState => ({siteId:id,
  frame:{centerLng:0,centerLat:0,zoom:18,imgW:960,imgH:640,mPerPx:0.4},
  items:[{id:bedId,defId:'veg_bed',x:0.5,y:0.5,label:'Fixture bed'}],zones:[],lines:[],step:'review',updatedAt:'2026-01-01T00:00:00.000Z',rev:1});
const place=(id='fixture-site',lat=0):SavedPlace=>({id,name:'Fictional test site',lat,lon:0,biome:'',rainfall:0,elevation:0,savedAt:'2026-01-01T00:00:00.000Z',updatedAt:100});
function browser() {
  const local=new Storage(), session=new Storage(); const target=Object.assign(new EventTarget(),{localStorage:local,sessionStorage:session});
  Object.assign(globalThis,{window:target,localStorage:local,sessionStorage:session});
  local.setItem('permamap_saved_places',JSON.stringify([place()]));
  local.setItem('imbewu_design_canvas_'+siteId,JSON.stringify(canvas()));
  saveCropPlan({version:1,updatedAt:1,plantings:[{id:'fixture-sowing',bedId:'fixture-bed',cropKey:crop.key,sowMonth:1}]});
  return {local,target};
}
function country(code:string,id=siteId) {
  const context=createSiteCountryContext({siteId:id,countryCode:code,confirmed:true})!;
  assert.equal(updateSiteCountryContext(id,context).status,'local-saved');
}
function fact():FactCropPlan {
  const plan=loadCropPlan();
  return {plantingCount:plan.plantings.length,bedsPlanted:1,crops:[{name:crop.name,sowMonths:['Jan'],bedLabels:['Fixture bed'],alreadyGrowing:false,firstSeasonOnlyMonths:[]}],
    snapshot:captureReportCropPlan(canvas(),plan,siteId,new Date('2026-11-02T12:00:00.000Z'))};
}
async function pdfText(blob:Blob) {
  const body=Buffer.from(await blob.arrayBuffer()).toString('latin1');
  return body + [...body.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match=>{
    try { return inflateSync(Buffer.from(match[1],'latin1')).toString('latin1'); } catch { return match[1]; }
  }).join('\n');
}

test('task storage consumers withhold unsupported sowings without deleting their saved rows',()=>{
  browser(); const before=JSON.stringify(loadCropPlan());
  assert.equal(loadCropBoardTasks(new Set()).length,0);
  assert.equal(loadCropBoardYear(new Set()).withheldPlantings,1);
  for(const code of ['KE','GB','US','BR']) { country(code); assert.equal(loadCropBoardTasks(new Set()).length,0,code); }
  assert.equal(JSON.stringify(loadCropPlan()),before);
  country('ZA'); assert.ok(loadCropBoardTasks(new Set()).length>0);
  country('US'); assert.equal(loadCropBoardTasks(new Set()).length,0);
});

test('a shared bed id cannot borrow an allowed calendar from another physical site',()=>{
  const {local}=browser(); const otherId='site:1.00000,0.00000';
  local.setItem('permamap_saved_places',JSON.stringify([place(),place('other',1)]));
  local.setItem('imbewu_design_canvas_'+otherId,JSON.stringify(canvas(otherId)));
  country('ZA');country('ZA',otherId);
  assert.equal(loadCropBoardTasks(new Set()).length,0);
  assert.equal(loadCropBoardYear(new Set()).withheldPlantings,1);
});

test('explicit unmapped reference planning keeps its tasks but never approves a mapped foreign site',()=>{
  const {local}=browser(); local.setItem('permamap_saved_places','[]');
  const plan=loadCropPlan(); plan.plantings[0].bedId='virtual-bed-1';
  plan.workspaceReferences=[{workspaceId:'virtual-bed',basis:'south-african-reference',acknowledgedAt:new Date().toISOString()}];
  saveCropPlan(plan);
  assert.ok(loadCropBoardTasks(new Set()).length>0);
  local.setItem('permamap_saved_places',JSON.stringify([place()])); country('KE');
  local.setItem('imbewu_design_canvas_'+siteId,JSON.stringify(canvas(siteId,'virtual-bed-1')));
  assert.equal(loadCropBoardTasks(new Set()).length,0);
});

test('a report snapshot cannot approve its own planning basis or another report location',()=>{
  browser(); const cropFact=fact();
  assert.equal(currentReportCropSupport(cropFact.snapshot,siteId).allowCataloguePlanning,false);
  country('ZA'); assert.equal(currentReportCropSupport(cropFact.snapshot,siteId).allowCataloguePlanning,true);
  assert.equal(currentReportCropSupport(cropFact.snapshot,'site:1.00000,0.00000').allowCataloguePlanning,false);
  country('KE'); assert.equal(currentReportCropSupport(cropFact.snapshot,siteId).allowCataloguePlanning,false);
});

test('unsupported collection keeps raw sowings and outlines while withholding derived annual production',()=>{
  browser(); const plan=loadCropPlan(), before=JSON.stringify(plan), mapped=canvas();
  const held=collectReportCropSnapshot(mapped,plan,siteId,new Date('2026-11-02T12:00:00.000Z'));
  assert.deepEqual(held.plantings,plan.plantings);assert.equal(held.beds.length,1);assert.equal(held.outlines.length,1);
  assert.equal(held.annualProduction,undefined);assert.equal(held.planNotes,undefined);assert.equal(JSON.stringify(plan),before);
  country('ZA');assert.ok(collectReportCropSnapshot(mapped,plan,siteId).annualProduction);
});

test('unsupported crop PDF contains saved records and no regenerated sowing or production calendar',()=>{
  browser(); const cropFact=fact(), doc=new jsPDF({unit:'pt',format:'a4'});
  drawReportCropSummary(doc,cropFact,0,'en',false);
  const output=doc.output();assert.match(output,/Saved sowing records/);assert.match(output,/Local crop guidance/);
  assert.doesNotMatch(output,/Seasonal sowing calendar|SITE REPORT \/ ANNUAL PRODUCTION|Check seedlings/);
  const enabled=new jsPDF({unit:'pt',format:'a4'});drawReportCropSummary(enabled,cropFact,0,'en',true);
  assert.match(enabled.output(),/Seasonal sowing calendar/);
});

test('whole report PDF checks current site identity before adding working crop instructions',async()=>{
  browser();const cropFact=fact();
  const meta={biome:'Fixture',lat:0,lon:0,rainfallMm:0,meanTempC:0,dateLabel:'Fixture date',cropPlan:cropFact,includeCropWorkingPlan:true};
  const before=JSON.stringify(cropFact);
  const held=await pdfText(await buildReportPdf('# Fixture report\n\nSaved document.',meta));
  assert.match(held,/Saved sowing records/);assert.doesNotMatch(held,/Seasonal sowing calendar/);
  country('ZA');const approved=await pdfText(await buildReportPdf('# Fixture report\n\nSaved document.',meta));
  assert.match(approved,/Seasonal sowing calendar/);
  const mismatched=await pdfText(await buildReportPdf('# Fixture report\n\nSaved document.',{...meta,lat:1}));
  assert.doesNotMatch(mismatched,/Seasonal sowing calendar/);
  assert.equal(JSON.stringify(cropFact),before);
});

test('report UI rejects both stale country changes and changes while its PDF is being prepared',async()=>{
  const {target}=browser();country('ZA');const cropFact=fact();external.builds=0;external.deliveries=0;external.delay=false;
  let renderer!:ReactTestRenderer;
  act(()=>{renderer=create(React.createElement(ReportCropPlan,{crop:cropFact,siteName:'Fixture',siteId,includeWorking:false,onIncludeWorking:()=>{}}));});
  const button=renderer.root.findAllByType('button')[0];assert.ok(button);
  const staleAction=button.props.onClick;
  country('KE');
  await act(async()=>{await staleAction();});
  assert.equal(external.builds,0);assert.equal(external.deliveries,0);
  country('ZA');act(()=>{target.dispatchEvent(new Event('permamap-places-changed'));});
  external.delay=true;
  await act(async()=>{renderer.root.findAllByType('button')[0].props.onClick();await Promise.resolve();});
  assert.equal(external.builds,1);country('US');
  await act(async()=>{external.pending?.();await Promise.resolve();});
  assert.equal(external.deliveries,0);
  act(()=>renderer.unmount());external.delay=false;external.pending=null;
});


test('unsupported summary projections preserve saved report bytes and raw sowings without product forecasts',()=>{
  browser();const cropFact=fact(), facts={crop:cropFact}, before=JSON.stringify(facts);
  assert.ok(cropFact.snapshot?.annualProduction);
  const projected=projectReportPlanningFacts(facts,false)!;
  assert.equal(projected.crop?.snapshot?.annualProduction,undefined);
  assert.equal(projected.crop?.snapshot?.planNotes,undefined);
  assert.deepEqual(projected.crop?.snapshot?.plantings,cropFact.snapshot?.plantings);
  assert.deepEqual(projected.crop?.snapshot?.outlines,cropFact.snapshot?.outlines);
  assert.equal(JSON.stringify(facts),before);
  assert.equal(projectReportPlanningFacts(facts,true),facts);
});


test('a long saved-record allocation wraps over real PDF pages without dropping its final bed',()=>{
  browser();const cropFact=fact();
  cropFact.snapshot=undefined;
  cropFact.crops[0].bedLabels=Array.from({length:500},(_,index)=>`Fixture growing space ${index+1}`);
  const doc=new jsPDF({unit:'pt',format:'a4'});
  drawReportCropSummary(doc,cropFact,0,'en',false);
  assert.ok(doc.getNumberOfPages()>2);
  const output=doc.output();assert.match(output,/Fixture growing space 500/);assert.match(output.replaceAll('\\(', '(').replaceAll('\\)', ')'),/Saved sowing records \(continued\)/);
  assert.doesNotMatch(output,/Seasonal sowing calendar/);
});


test('a cached Home task cannot create an ICS after its country becomes unsupported',()=>{
  browser();country('ZA');const task=loadCropBoardTasks(new Set())[0];assert.ok(task);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');let downloads=0;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    createElement:()=>({click(){downloads++;}}),body:{appendChild(){},removeChild(){}},
  }});
  try {
    assert.equal(downloadTaskIcs(task),true);assert.equal(downloads,1);
    country('KE');assert.equal(downloadTaskIcs(task),false);assert.equal(downloads,1);
  } finally {if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});


test('task references use the persisted design identity and cannot borrow the generic local workspace',()=>{
  const {local}=browser();local.setItem('permamap_saved_places','[]');
  const {bgSite:_site,...design}=buildDemoFacilitatorState();design.designId='stable-reference';
  local.setItem('imbewu_facilitator_design_v1',JSON.stringify(design));
  const bed=design.items.find(item=>item.type==='bed')!;assert.ok(bed);
  const plan=loadCropPlan();plan.plantings[0].bedId=bed.id;
  plan.workspaceReferences=[{workspaceId:'design:stable-reference',basis:'south-african-reference',acknowledgedAt:new Date().toISOString()}];
  saveCropPlan(plan);assert.ok(loadCropBoardTasks(new Set()).length>0);
  plan.workspaceReferences=[{workspaceId:'design:local',basis:'south-african-reference',acknowledgedAt:new Date().toISOString()}];
  saveCropPlan(plan);assert.equal(loadCropBoardTasks(new Set()).length,0);
  design.designId='../invalid';local.setItem('imbewu_facilitator_design_v1',JSON.stringify(design));
  assert.equal(loadCropBoardTasks(new Set()).length,0);
});
