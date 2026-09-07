// Exercise the real component's media events: missing the final action is a teaching failure.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { deckFor } from '@/lib/course-deck';

Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){}}});
const url=new URL('../components/course/DeckPlayer.tsx',import.meta.url).href;
const hooks=registerHooks({load(file,context,nextLoad){
  if(file===url)return{format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(file),'utf8'),{
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:'DeckPlayer.tsx',
  }).outputText};
  return nextLoad(file,context);
}});
const {default:DeckPlayer}=await import('../components/course/DeckPlayer.tsx');
hooks.deregister();

class Media {
  paused=false;ended=false;currentTime=0;
  pause(){this.paused=true;}
  play(){this.paused=false;return Promise.resolve();}
}
function mount(moduleId:string){
  const audio=new Media(),video=new Media();let renderer:ReactTestRenderer;
  act(()=>{renderer=create(createElement(DeckPlayer,{moduleId,lang:'en'}),{createNodeMock(element){
    return element.type==='audio'?audio:element.type==='video'?video:null;
  }});});
  return {renderer:renderer!,audio,video};
}
function next(renderer:ReactTestRenderer,count=1){
  for(let i=0;i<count;i++)act(()=>renderer.root.findAllByType('button').find(b=>b.props.children==='Next ›')!.props.onClick());
}
function watch(renderer:ReactTestRenderer){
  act(()=>renderer.root.findAllByType('button').find(b=>b.props.style?.position==='absolute')!.props.onClick());
}
const heading=(renderer:ReactTestRenderer)=>renderer.root.findByType('h3').props.children;

test('an illustrated Watch slide shows its teaching front before playback and retains the reading',()=>{
  const {renderer}=mount('soil-health');
  try{
    next(renderer,9);
    const images=renderer.root.findAllByType('img');
    assert.ok(images[0].props.src.endsWith('/slide-10-front.jpg'));
    assert.ok(images.some(img=>img.props.src.endsWith('/slide-10.svg')));
    watch(renderer);
    assert.ok(renderer.root.findByType('video').props.src.endsWith('/compost-building.mp4'));
    assert.ok(renderer.root.findAllByType('img').some(img=>img.props.src.endsWith('/slide-10.svg')));
  }finally{act(()=>renderer.unmount());}
});

test('a short narration waits for the selected demonstration, and simultaneous endings advance only once',()=>{
  const {renderer,audio,video}=mount('seeds-sovereignty');
  try{
    next(renderer,4);watch(renderer);
    const before=heading(renderer);
    audio.ended=true;
    act(()=>renderer.root.findByType('audio').props.onEnded());
    assert.equal(heading(renderer),before,'the demonstration must finish before the page turns');
    video.ended=true;
    act(()=>{renderer.root.findByType('video').props.onEnded();renderer.root.findByType('audio').props.onEnded();});
    assert.equal(heading(renderer),deckFor('seeds-sovereignty')!.slides[5].title,'two media endings still mean one page turn');
  }finally{act(()=>renderer.unmount());}
});

test('Stop pauses narration and the demonstration together',()=>{
  const {renderer,audio,video}=mount('seeds-sovereignty');
  try{
    next(renderer,4);watch(renderer);
    act(()=>renderer.root.findByProps({'aria-label':'Stop the lesson'}).props.onClick());
    assert.equal(audio.paused,true);assert.equal(video.paused,true);
  }finally{act(()=>renderer.unmount());}
});

test('the last narrated slide can be replayed and still stops at its end',()=>{
  const {renderer,audio}=mount('seeds-sovereignty');
  try{
    next(renderer,deckFor('seeds-sovereignty')!.slides.length-1);
    for(let replay=0;replay<2;replay++){
      if(replay)act(()=>renderer.root.findByProps({'aria-label':'Play the lesson'}).props.onClick());
      audio.ended=true;
      act(()=>renderer.root.findByType('audio').props.onEnded());
      assert.ok(renderer.root.findByProps({'aria-label':'Play the lesson'}),'finishing again must stop play-through');
    }
  }finally{act(()=>renderer.unmount());}
});

test('silent slides schedule each next page and cannot cut off a chosen video',()=>{
  const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
  const timers=new Map<number,()=>void>();let number=0;
  Object.assign(globalThis,{setTimeout:(callback:()=>void)=>{timers.set(++number,callback);return number;},clearTimeout:(id:number)=>timers.delete(id)});
  const {renderer,video}=mount('water-harvesting');
  try{
    act(()=>renderer.root.findByProps({'aria-label':'Play the lesson'}).props.onClick());
    for(let i=0;i<3;i++){
      const callback=[...timers.values()].at(-1)!;
      assert.ok(callback,'every silent page needs a fresh timer');
      act(callback);
    }
    assert.equal(heading(renderer),deckFor('water-harvesting')!.slides[3].title);
    watch(renderer);
    const before=heading(renderer);
    video.ended=true;
    act(()=>renderer.root.findByType('video').props.onEnded());
    assert.equal(heading(renderer),before,'a quick video must not skip the silent reading time');
    video.ended=false;
    act([...timers.values()].at(-1)!);
    assert.equal(heading(renderer),before);
    video.ended=true;
    act(()=>renderer.root.findByType('video').props.onEnded());
    assert.equal(heading(renderer),deckFor('water-harvesting')!.slides[4].title);
  }finally{act(()=>renderer.unmount());Object.assign(globalThis,{setTimeout:originalSet,clearTimeout:originalClear});}
});
