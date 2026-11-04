import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { sowMarksForPattern } from '../lib/crop-calendar.ts';

const probe = { patterns: [] as string[], scrolls: 0, sowMarksForPattern };
Object.assign(globalThis,{__internationalCalendar:probe});
const moduleUrl=(source:string)=>'data:text/javascript,'+encodeURIComponent(source);
const hooks=registerHooks({
  resolve(specifier,context,next){
    if (context.parentURL?.endsWith('/app/calendar/page.tsx')) {
      if(specifier==='@/lib/i18n')return{shortCircuit:true,url:moduleUrl("export const useLanguage=()=>({lang:'en',t:key=>key});")};
      if(specifier==='@/lib/app-level')return{shortCircuit:true,url:moduleUrl("export const useAppLevel=()=> 'all';")};
      if(specifier==='@/lib/crop-calendar')return{shortCircuit:true,url:moduleUrl(`export function sowMarksForPattern(key,pattern){const p=globalThis.__internationalCalendar;p.patterns.push(pattern);return p.sowMarksForPattern(key,pattern);}`)};
      // The shared account subscription has its own runtime tests. This screen
      // must use its public callback, not mount a second map/auth sync pathway.
      if(specifier.startsWith('@/components/') && !specifier.endsWith('WorkspaceReferencePanel') && !specifier.endsWith('IsiZuluDraftSource'))return{shortCircuit:true,url:moduleUrl('export default function Component(){return null;}')};
    }
    if(specifier==='./firebase/init' || specifier==='@/lib/firebase/init')return{shortCircuit:true,url:moduleUrl('export const getFirebase=()=>null;export const isBackendConfigured=()=>false;')};
    if(specifier.endsWith('.css'))return{shortCircuit:true,url:moduleUrl('export default new Proxy({}, {get:(_,key)=>key});')};
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.startsWith(new URL('../',import.meta.url).href)&&url.endsWith('.tsx'))return{format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
    return next(url,context);
  },
});
const {default:Calendar}=await import('../app/calendar/page.tsx');
const {loadCropPlan,saveCropPlan}=await import('../lib/crop-plan.ts');
const {loadPlaces,updateSiteCountryContext}=await import('../lib/saved-places.ts');
const {createSiteCountryContext,bindSiteContext,resolveSiteCountryContext}=await import('../lib/international/site-context.ts');
const {createWorkspacePlanningReference}=await import('../lib/international/workspace-context.ts');
const {CROPS}=await import('../lib/crop-catalog.ts');
import type { CropPlanState } from '../lib/crop-plan.ts';

after(()=>{hooks.deregister();Reflect.deleteProperty(globalThis,'__internationalCalendar');});
class Storage{
  rows=new Map<string,string>();fail=false;
  get length(){return this.rows.size;}
  key(index:number){return [...this.rows.keys()][index]??null;}
  getItem(key:string){return this.rows.get(key)??null;}
  setItem(key:string,value:string){if(this.fail)throw Error('quota');this.rows.set(key,String(value));}
  removeItem(key:string){this.rows.delete(key);}
}
const siteId='site:0.00000,0.00000';
function browser(){
  const local=new Storage(),session=new Storage(),target=Object.assign(new EventTarget(),{localStorage:local,sessionStorage:session});
  Object.assign(globalThis,{window:target,localStorage:local,sessionStorage:session});
  local.setItem('permamap_saved_places',JSON.stringify([{id:'fixture-site',name:'Fictional calendar site',lat:0,lon:0,biome:'',rainfall:0,elevation:0,savedAt:'2026-01-01T00:00:00.000Z',updatedAt:100}]));
  const plan:CropPlanState={version:1,plantings:[{id:'fixture-sowing',bedId:'fixture-bed',cropKey:CROPS[0].key,sowMonth:1}],updatedAt:1,rainPattern:'summer'};
  saveCropPlan(plan);probe.patterns=[];probe.scrolls=0;
  return{local,target};
}
function country(code:string){assert.equal(updateSiteCountryContext(siteId,createSiteCountryContext({siteId,countryCode:code,confirmed:true})).status,'local-saved');}
function text(node:ReactTestInstance|string):string{return typeof node==='string'?node:node.children.map(child=>text(child as ReactTestInstance|string)).join('');}
function screen(){
  let renderer!:ReactTestRenderer;
  act(()=>{renderer=create(React.createElement(Calendar),{createNodeMock:()=>({scrollIntoView(){probe.scrolls++;}})});});
  const select=(label:string)=>{const element=renderer.root.findAllByType('label').find(node=>typeof node.children[0]==='string'&&node.children[0].trim()===label);assert.ok(element,`Missing ${label}; labels=${renderer.root.findAllByType('label').map(node=>String(node.children[0])).join(';')}; screen=${text(renderer.root).slice(0,1100)}`);return element.findByType('select');};
  return{renderer,text:()=>text(renderer.root),select,
    choose(label:string,value:string){act(()=>select(label).props.onChange({target:{value}}));},
    acknowledge(){
      const checkbox=renderer.root.findByType('input');act(()=>checkbox.props.onChange({target:{checked:true}}));
      const form=renderer.root.findByType('form');act(()=>form.props.onSubmit({preventDefault(){}}));
    },
    dispose(){act(()=>renderer.unmount());},
  };
}
function held(ui:ReturnType<typeof screen>){
  assert.ok(ui.renderer.root.findAll(node=>node.props['aria-label']==='Calendar unavailable').length>0);
  assert.equal(ui.renderer.root.findAllByType('table').length,0);
  assert.doesNotMatch(ui.text(),/Plant now|No planting recommended this month|12-Month Planting Grid|Lima says/);
}

test('a saved global summer pattern never chooses a calendar site, reference or planting window',()=>{
  browser();country('ZA');const ui=screen();try{
    held(ui);assert.equal(ui.select('Calendar context').props.value,'');assert.deepEqual(probe.patterns,[]);
    ui.choose('Calendar context',siteId);held(ui);assert.equal(ui.select('South African reference pattern').props.value,'');assert.deepEqual(probe.patterns,[]);
  }finally{ui.dispose();}
});

test('explicit supported site and reference pattern retain the same South African reference arithmetic',()=>{
  browser();country('ZA');const ui=screen();try{
    ui.choose('Calendar context',siteId);
    for(const pattern of ['summer','winter','all-year','mild-frost']){
      probe.patterns=[];ui.choose('South African reference pattern',pattern);
      assert.ok(ui.renderer.root.findAllByType('table').length>0);assert.ok(ui.text().includes('Plant now'));
      assert.ok(probe.patterns.length>0);assert.ok(probe.patterns.every(value=>value===pattern));
      assert.ok(probe.scrolls>0,'the selected month is brought into view when the held guide opens');
    }
  }finally{ui.dispose();}
});

test('foreign or unknown sites cannot inherit an acknowledged unmapped guide or a previously selected pattern',()=>{
  browser();const plan=loadCropPlan();plan.workspaceReferences=[createWorkspacePlanningReference('design:calendar-reference',true)!];saveCropPlan(plan);
  const ui=screen();try{
    ui.choose('Calendar context','reference:calendar');ui.choose('South African reference pattern','winter');assert.ok(ui.renderer.root.findAllByType('table').length>0);
    for(const code of ['KE','GB','US','BR']){
      act(()=>country(code));ui.choose('Calendar context',siteId);held(ui);
      assert.equal(ui.renderer.root.findAllByType('select').length,1);
    }
  }finally{ui.dispose();}
});

test('a country change or removed site immediately withholds the guide without selecting another saved site',()=>{
  const {local,target}=browser();country('ZA');const ui=screen();try{
    ui.choose('Calendar context',siteId);ui.choose('South African reference pattern','summer');
    act(()=>country('KE'));held(ui);
    act(()=>country('ZA'));assert.equal(ui.select('South African reference pattern').props.value,'');held(ui);
    ui.choose('South African reference pattern','summer');
    local.setItem('permamap_saved_places',JSON.stringify([{id:'other',name:'Different fixture site',lat:1,lon:0,biome:'',rainfall:0,elevation:0,savedAt:'2026-01-01T00:00:00.000Z'}]));
    act(()=>{target.dispatchEvent(new Event('storage'));});held(ui);assert.equal(ui.select('Calendar context').props.value,siteId);
  }finally{ui.dispose();}
});

test('separate guide acknowledgement saves only that reference in the existing plan and survives reload without auto-selection',()=>{
  const {local}=browser();const before=structuredClone(loadCropPlan()),places=local.getItem('permamap_saved_places');
  let ui=screen();try{
    ui.choose('Calendar context','reference:calendar');held(ui);ui.acknowledge();held(ui);
    const saved=loadCropPlan();assert.deepEqual(saved.plantings,before.plantings);assert.equal(saved.rainPattern,before.rainPattern);
    assert.equal(saved.workspaceReferences?.[0].workspaceId,'design:calendar-reference');assert.equal(local.getItem('permamap_saved_places'),places);
    ui.choose('South African reference pattern','all-year');assert.ok(ui.renderer.root.findAllByType('table').length>0);
    ui.dispose();ui=screen();held(ui);assert.equal(ui.select('Calendar context').props.value,'');
    ui.choose('Calendar context','reference:calendar');held(ui);assert.equal(ui.select('South African reference pattern').props.value,'');
  }finally{ui.dispose();}
});

test('failed acknowledgement preserves prior data and a stale guide callback cannot write after choosing a mapped site',()=>{
  const {local}=browser();const before=local.getItem('imbewu_crop_plan_v1');const ui=screen();try{
    ui.choose('Calendar context','reference:calendar');local.fail=true;ui.acknowledge();held(ui);
    assert.match(ui.text(),/could not be saved/);assert.equal(local.getItem('imbewu_crop_plan_v1'),before);local.fail=false;
    const form=ui.renderer.root.findByType('form');const staleSubmit=form.props.onSubmit;
    ui.choose('Calendar context',siteId);act(()=>staleSubmit({preventDefault(){}}));held(ui);
    assert.equal(local.getItem('imbewu_crop_plan_v1'),before);
  }finally{local.fail=false;ui.dispose();}
});

test('conflicting aliases never allow the calendar to choose the first country record',()=>{
  const {local,target}=browser();country('ZA');const original=loadPlaces()[0];
  const alias={...original,id:'other-alias'};
  // Each confirmed alias must name its own saved-place base; otherwise this
  // would test an unbound record rather than two genuinely conflicting ones.
  const context=bindSiteContext(createSiteCountryContext({siteId,countryCode:'KE',confirmed:true})!,alias);
  local.setItem('permamap_saved_places',JSON.stringify([original,{...alias,siteCountryContext:context}]));
  assert.equal(resolveSiteCountryContext(loadPlaces(),siteId).status,'conflict');
  const ui=screen();try{ui.choose('Calendar context',siteId);act(()=>{target.dispatchEvent(new Event('storage'));});held(ui);assert.deepEqual(probe.patterns,[]);}finally{ui.dispose();}
});


test('an empty plan shows the named general guide only after supported context and pattern are explicitly chosen',()=>{
  browser();saveCropPlan({version:1,plantings:[],updatedAt:1});country('ZA');const ui=screen();try{
    held(ui);assert.doesNotMatch(ui.text(),/Showing the general planting guide/);
    ui.choose('Calendar context',siteId);held(ui);
    ui.choose('South African reference pattern','winter');
    assert.match(ui.text(),/Showing the general planting guide/);
    assert.ok(ui.renderer.root.findAllByType('table').length>0);
    assert.deepEqual(loadCropPlan().plantings,[]);
  }finally{ui.dispose();}
});
