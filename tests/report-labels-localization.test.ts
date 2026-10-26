import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {registerHooks}from 'node:module';
import {ELEMENTS_BY_ID}from '../lib/design-elements.ts';
import {plantTakesCode}from '../lib/plant-codes.ts';
import {ROUTE_LABELS,summariseDesignStudio}from '../lib/design-studio-report.ts';
import {buildDemoDesignCanvasState}from '../lib/demo-farm.ts';
import {collectReportSiteFacts}from '../lib/report-site-facts-collect.ts';
import {normaliseReportSiteFacts,buildReportHeaderMarkdown}from '../lib/report-site-facts.ts';
import {REPORT_VISUAL_COPY,reportElementDisplayName,reportRouteShortName,reportVisualText,siteReportVisuals,reportChartAlt,reportChartSvg}from '../lib/report-visuals.ts';
import {reportDocumentText}from '../lib/report-localisation.ts';
import {TANK_IDS,statedTankCapacityLitres}from '../lib/water-system.ts';
import type{ReportHeaderInput}from '../lib/report-site-facts.ts';
import type{LocationData}from '../lib/types.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/report-labels-translation/source-cases.json')) as {sourceSha:string;cases:Array<{name:string;input:ReportHeaderInput;english:string;visuals:ReturnType<typeof siteReportVisuals>}>;location:LocationData};
const languages=['zu','st','ts','ve']as const;
const packet=JSON.parse(read('docs/translation/four-language-completion/report-labels-drafts.json'));

test('the catalogue label pass preserves exact English output and every earlier legacy or custom name',()=>{
 assert.equal(fixture.sourceSha,'ac308edb2c7b2e4c5bda9c41ebdf611804bead35');assert.equal(packet.sourceSha,fixture.sourceSha);assert.match(packet.status,/Unreviewed/);
 for(const c of fixture.cases){assert.equal(buildReportHeaderMarkdown(c.input),c.english);assert.equal(buildReportHeaderMarkdown(c.input,'af'),c.english);assert.deepEqual(siteReportVisuals(c.input.facts!,fixture.location),c.visuals);}
 for(const row of packet.entries){assert.deepEqual(REPORT_VISUAL_COPY.find(r=>r.english===row.english),row);for(const lang of languages){assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);assert.deepEqual(row[lang].match(/\d+/g),row.english.match(/\d+/g));}}
});

test('standard equipment translates only on an exact recorded catalogue identity while every plant remains canonical',()=>{
 const defaults=Object.values(ELEMENTS_BY_ID);
 for(const def of defaults)for(const lang of languages){
  const plant=def.category==='growing'||Boolean(def.botanical)||plantTakesCode(def.id);const actual=reportElementDisplayName(def.name,def.id,lang);
  if(plant)assert.equal(actual,def.name,`${def.id}: species/plant identity`);
  else {assert.equal(actual,reportVisualText(def.name,lang));assert.notEqual(actual,def.name,`${def.id}: missing equipment draft`);}
  assert.equal(reportElementDisplayName(def.name,undefined,lang),def.name);
  for(const id of ['unknown','constructor','__proto__','toString'])assert.equal(reportElementDisplayName(def.name,id,lang),def.name);
  assert.equal(reportElementDisplayName('Named '+def.name,def.id,lang),'Named '+def.name);
  assert.equal(reportElementDisplayName(def.name,def.id,'af'),def.name);
  const other=defaults.find(d=>d.id!==def.id&&d.name!==def.name)!;assert.equal(reportElementDisplayName(def.name,other.id,lang),def.name);
 }
});

test('every route uses the summary producer identity and legacy/custom labels retain the earlier shortening rule',()=>{
 for(const [kind,label]of Object.entries(ROUTE_LABELS))for(const lang of languages){const short=label.replace(/ \(.*\)$/,'');assert.equal(reportRouteShortName(label,kind,lang),reportVisualText(short,lang));assert.notEqual(reportRouteShortName(label,kind,lang),short,kind);
  assert.equal(reportRouteShortName(label,kind,'en'),short);assert.equal(reportRouteShortName(label,undefined,lang),short);assert.equal(reportRouteShortName('Named '+label,kind,lang),'Named '+short);
  for(const other of ['unknown','constructor','__proto__','toString',...Object.keys(ROUTE_LABELS).filter(k=>k!==kind)])assert.equal(reportRouteShortName(label,other,lang),short);
 }
});

test('the table translates equipment and routes but does not mutate source data or reinterpret a legacy name',()=>{
 for(const c of fixture.cases)for(const lang of languages){const before=JSON.stringify(c.input);const markdown=buildReportHeaderMarkdown(c.input,lang);for(const g of c.input.facts!.design!.elements)assert.ok(markdown.includes(reportElementDisplayName(g.name,g.defId,lang)+' x'+g.count));for(const r of c.input.facts!.design!.routes)assert.ok(markdown.includes(reportRouteShortName(r.label,r.kind,lang)));
  if(c.name!=='catalogue')for(const g of c.input.facts!.design!.elements)assert.ok(markdown.includes(g.name));assert.equal(JSON.stringify(c.input),before);
 }
});

test('tank catalogue IDs survive collection and API normalization without changing names, capacity, count or status',()=>{
 const canvas=buildDemoDesignCanvasState();const template=canvas.items[0];canvas.items=[];
 for(const id of TANK_IDS)for(const status of ['existing','proposed']as const){const def=ELEMENTS_BY_ID[id];canvas.items.push({...template,id:'qa-'+id+status,defId:id,status,label:undefined});canvas.items.push({...template,id:'qa-custom-'+id+status,defId:id,status,label:'Named '+def.name});}
 const before=JSON.stringify(canvas),summary=summariseDesignStudio(canvas);const facts=collectReportSiteFacts({siteId:'qa-labels',lat:fixture.location.lat,lon:fixture.location.lon,canvas,waterPoints:[],cropPlan:null});assert.equal(JSON.stringify(canvas),before);
 const expected=summary.elements.filter(r=>TANK_IDS.has(r.defId)).map(r=>({name:r.name,defId:r.defId,count:r.count,status:r.status,statedLitres:statedTankCapacityLitres(ELEMENTS_BY_ID[r.defId])}));assert.deepEqual(facts.water!.tanks,expected);const normalized=normaliseReportSiteFacts(facts)!;assert.deepEqual(normalized.water,facts.water);
 assert.equal(normalized.water!.statedStorageLitres,expected.reduce((sum,r)=>sum+(r.statedLitres??0)*r.count,0));assert.equal(normalized.water!.tanksOfUnknownCapacity,expected.filter(r=>r.statedLitres===null).length);
 for(const lang of languages){const header=buildReportHeaderMarkdown({...fixture.cases[0].input,facts:normalized},lang),chart=siteReportVisuals(normalized,fixture.location,lang).charts.find(c=>c.id==='water')!;
  // A default name is intentionally shared by existing and proposed rows. Match the full state
  // and retain both rows, so this check detects accidental status folding rather than picking the first.
  assert.equal(chart.rows.length,expected.filter(t=>t.statedLitres!==null).length);
  for(const tank of expected){const name=reportElementDisplayName(tank.name,tank.defId,lang);assert.ok(header.includes(name+' x'+tank.count));if(tank.statedLitres!==null){const row=chart.rows.find(r=>r.label===name+' ×'+tank.count&&r.detail===reportVisualText(tank.status,lang));assert.ok(row);assert.equal(row.value,tank.statedLitres*tank.count);assert.equal(row.detail,reportVisualText(tank.status,lang));assert.ok(reportChartAlt(chart).includes(name));assert.ok(reportChartSvg(chart).svg);}}
 }
 const legacy=structuredClone(facts);for(const tank of legacy.water!.tanks)delete tank.defId;assert.ok(normaliseReportSiteFacts(legacy)!.water!.tanks.every(t=>!Object.hasOwn(t,'defId')));
 for(const defId of [42,{},[],false,null]){const copy=structuredClone(facts)as any;copy.water.tanks[0].defId=defId;assert.ok(!Object.hasOwn(normaliseReportSiteFacts(copy)!.water!.tanks[0],'defId'));}
});

test('the real report API retains tank IDs and reaches the native equipment/route display with mocked generation',async()=>{
 const source=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);const hooks=registerHooks({resolve(s,c,next){if(s==='@anthropic-ai/sdk')return{url:source('export default class Anthropic{}'),shortCircuit:true};if(s==='next/server')return{url:source('export class NextRequest{}'),shortCircuit:true};if(s==='@/lib/api-auth')return{url:source('export async function guardPaidApiRequest(){return {uid:"labels-test"}}'),shortCircuit:true};if(s==='@/lib/metered-ai')return{url:source("export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async()=>({usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nMocked response.'}]})}}}}"),shortCircuit:true};return next(s,c);}});const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
 try{const{POST}=await import('../app/api/generate-report/route.ts');const facts=structuredClone(fixture.cases[0].input.facts!);const def=ELEMENTS_BY_ID['jojo_2500'];facts.water!.tanks=[{name:def.name,defId:def.id,count:1,statedLitres:2500,status:'proposed'}];for(const lang of languages){const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language:lang,locationData:fixture.location,siteFacts:facts,sections:['Executive Summary']})})as any);assert.equal(response.status,200);const text=await response.text();const start=text.indexOf('## '+reportDocumentText('Site at a Glance',lang));const table=text.slice(start,text.indexOf('## 1. Mocked body'));assert.ok(start>=0);assert.ok(table.includes(reportElementDisplayName(def.name,def.id,lang)));for(const g of facts.design!.elements)assert.ok(table.includes(reportElementDisplayName(g.name,g.defId,lang)));for(const route of facts.design!.routes)assert.ok(table.includes(reportRouteShortName(route.label,route.kind,lang)));}}
 finally{hooks.deregister();globalThis.fetch=old;}
});
