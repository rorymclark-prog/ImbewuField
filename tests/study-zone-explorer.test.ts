import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { LESSON_INDEX } from '../lib/course-modules.ts';
import { studyZoneSourceBefore } from './study-zone-history-checks.ts';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../components/studies/ZoneExplorer.tsx',import.meta.url),'utf8');
const text=(node:ReactTestInstance):string=>node.children.map(c=>typeof c==='string'?c:text(c)).join('');
function load() {
  const timers=new Map<number,()=>void>();let serial=0;
  const window={setTimeout:(fn:()=>void)=>{timers.set(++serial,fn);return serial;},clearTimeout:(id:number)=>timers.delete(id)};
  const module={exports:{} as any};
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports','window',js)((id:string)=>{
    if(id==='@/lib/course-modules')return{LESSON_INDEX};
    if(id.endsWith('.module.css'))return{default:{}};
    if(id==='./Summary')return{default:({children}:any)=>React.createElement('summary',null,children)};
    return require(id);
  },module,module.exports,window);
  return{Component:module.exports.default,areas:module.exports.ZONE_MAP_AREAS as Array<{id:string;points:string;x:number;y:number}>,tour:module.exports.ZONE_TOUR as string[],timers};
}
// Match the accessible name: decorative icons can leave whitespace in JSX text.
function button(r:ReactTestRenderer,label:string){return r.root.findAllByType('button').find(b=>text(b).trim()===label)!;}
function shown(r:ReactTestRenderer){return r.root.findAllByType('polygon').filter(p=>p.props['data-visible']).map(p=>p.props['data-zone-area']);}
async function mount(props:Record<string,unknown>={}) {
  const loaded=load();let renderer!:ReactTestRenderer;
  await act(async()=>{renderer=create(React.createElement(loaded.Component,props));});
  const disclosure=()=>renderer.root.findAllByType('details')[0];
  const open=async(value=true)=>act(async()=>disclosure().props.onToggle({currentTarget:{open:value}}));
  const click=async(label:string)=>act(async()=>button(renderer,label).props.onClick());
  return{...loaded,renderer,open,click,dispose:()=>act(async()=>renderer.unmount())};
}

test('the large farm picture loads only when the learner opens the interactive example',async()=>{
  const ui=await mount({lang:'zu'});
  assert.equal(ui.renderer.root.findAllByType('img').length,0);
  await ui.open();
  assert.equal(ui.renderer.root.findByType('img').props.src,'/study-images/zone-explorer/holding.webp');
  assert.match(text(ui.renderer.root),/English interactive example/);
  assert.ok(statSync('public/study-images/zone-explorer/holding.webp').size<800_000);
  await ui.dispose();
});

test('each zone can be switched off and back on without forcing the other highlights to change',async()=>{
  const ui=await mount();await ui.open();
  assert.equal(shown(ui.renderer).length,9);
  await ui.click('1 · Picking garden');
  assert.ok(!shown(ui.renderer).includes('1'));assert.ok(shown(ui.renderer).includes('2'));
  await ui.click('1 · Picking garden');assert.ok(shown(ui.renderer).includes('1'));
  const body=LESSON_INDEX.get('intro-permaculture-l3')!.lesson.body;
  const description=ui.renderer.root.findByProps({'aria-live':'polite'});
  assert.ok(body.includes(text(description).replace('Zone 1 · Picking garden','')),'the definition must come from the checked course');
  await ui.click('Clear highlights');assert.deepEqual(shown(ui.renderer),[]);
  await ui.click('Show all');assert.equal(shown(ui.renderer).length,9);
  await ui.dispose();
});

test('food forest, fruit trees and kraal are findable features, not extra numbered zones',async()=>{
  const ui=await mount({initialFeature:'food-forest'});await ui.open();
  assert.deepEqual(shown(ui.renderer),['food-forest']);
  assert.match(text(ui.renderer.root.findByProps({'aria-live':'polite'})),/layered planting/);
  await ui.click('T · Fruit trees');assert.ok(shown(ui.renderer).includes('fruit-trees'));
  assert.match(text(ui.renderer.root.findByProps({'aria-live':'polite'})),/care and harvesting/);
  await ui.click('K · Kraal · cow + goats');assert.ok(shown(ui.renderer).includes('kraal'));
  assert.deepEqual(ui.areas.filter(a=>/^\d$/.test(a.id)).map(a=>a.id),['0','1','2','3','4','5']);
  await ui.dispose();
});

test('the map tour moves the image and overlays together and stops at the final wild-zone view',async()=>{
  const ui=await mount();await ui.open();await ui.click('Start map tour');
  const first=ui.renderer.root.findAll(n=>n.props.className===undefined&&n.props.style?.transform?.startsWith('translate('))[0];
  assert.ok(first);assert.equal(first.findAllByType('img').length,1);assert.equal(first.findAllByType('svg').length,1);
  assert.deepEqual(shown(ui.renderer),['0']);
  const firstTransform=first.props.style.transform;
  await ui.click('Next');assert.deepEqual(shown(ui.renderer),['1']);
  const moved=ui.renderer.root.findAll(n=>n.props.style?.transform?.startsWith('translate('))[0];
  assert.notEqual(moved.props.style.transform,firstTransform);
  for(let i=2;i<ui.tour.length;i++)await ui.click('Next');
  assert.deepEqual(shown(ui.renderer),['5']);assert.equal(button(ui.renderer,'Next').props.disabled,true);
  assert.equal(button(ui.renderer,'Play tour').props.disabled,true);
  await ui.click('Previous');assert.deepEqual(shown(ui.renderer),['fruit-trees']);
  await ui.dispose();
});

test('playback is opt-in, pauses on manual selection, and cannot keep running after the example closes',async()=>{
  const ui=await mount();await ui.open();assert.equal(ui.timers.size,0);
  await ui.click('Start map tour');assert.equal(ui.timers.size,0);
  await ui.click('Play tour');assert.equal(ui.timers.size,1);
  await act(async()=>{const [id,tick]=ui.timers.entries().next().value!;ui.timers.delete(id);tick();});
  assert.deepEqual(shown(ui.renderer),['1']);
  await ui.click('F · Food forest');assert.equal(ui.timers.size,0);
  await ui.click('Start map tour');await ui.click('Play tour');await ui.open(false);
  assert.equal(ui.timers.size,0);assert.equal(ui.renderer.root.findAllByType('img').length,0);
  await ui.dispose();
});

test('a missing photograph keeps definitions available and the explorer is wired into both related Study lessons',async()=>{
  const ui=await mount();await ui.open();
  await act(async()=>ui.renderer.root.findByType('img').props.onError());
  assert.match(text(ui.renderer.root),/image could not load/);
  await ui.click('3 · Main field · maize');assert.match(text(ui.renderer.root),/Zone 3 is the main field/);
  const page=readFileSync('app/student/page.tsx','utf8');
  assert.match(page,/lesson\.id === 'intro-permaculture-l3' \|\| lesson\.id === 'food-forest-l1'/);
  assert.match(page,/<ZoneExplorer lang=\{lang\}/);
  assert.match(source,/href="\/student\/zones"/);
  assert.match(readFileSync('app/student/zones/page.tsx','utf8'),/<ZoneExplorer lang=\{lang\} initiallyOpen/);
  const css=readFileSync('components/studies/ZoneExplorer.module.css','utf8');
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  await ui.dispose();
});

test('the additive explorer cannot hide a change to old lesson wiring or theme behaviour from the history guards',()=>{
  const live=readFileSync('app/student/page.tsx','utf8');
  const before=studyZoneSourceBefore('app/student/page.tsx',live);
  assert.ok(!before.includes('const ZoneExplorer = dynamic'));
  assert.throws(()=>studyZoneSourceBefore('app/student/page.tsx',live.replace("color: 'var(--on-forest-800)'","color: 'red'")),/preserve every other/);
  assert.throws(()=>studyZoneSourceBefore('app/student/page.tsx',live.replace("lesson.id === 'intro-permaculture-l3'","lesson.id === 'changed-lesson'")),/approved import and mount/);
});
