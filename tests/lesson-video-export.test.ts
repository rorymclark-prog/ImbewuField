import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectSlideFrames, frameSchedule } from '../scripts/lesson-video-assets.mjs';

function fixture(files: string[], check: (dir: string) => void) {
  const dir=mkdtempSync(join(tmpdir(),'course-export-test-'));
  try { files.forEach(file=>writeFileSync(join(dir,file),''));check(dir); }
  finally { rmSync(dir,{recursive:true,force:true}); }
}

test('a long reading exports every continuation without inventing another narration number',()=>{
  fixture(['slide-01.svg','slide-01-continuation-2.svg','slide-01-continuation.svg','slide-02.jpg'],dir=>{
    const frames=collectSlideFrames(dir,[1,2]);
    assert.deepEqual([...frames.keys()],[1,2]);
    assert.deepEqual(frames.get(1).map((f:{part:number})=>f.part),[0,1,2]);
    assert.equal(frames.get(2).length,1);
  });
});

test('an extra slide, an omitted middle card or competing image/video choices stop the export',()=>{
  fixture(['slide-01.svg','slide-02.svg'],dir=>assert.throws(()=>collectSlideFrames(dir,[1]),/no matching narration/));
  fixture(['slide-01.svg','slide-01-continuation-2.svg'],dir=>assert.throws(()=>collectSlideFrames(dir,[1]),/Missing continuation/));
  fixture(['slide-01.svg','slide-01.mp4'],dir=>assert.throws(()=>collectSlideFrames(dir,[1]),/multiple images\/videos/));
  fixture(['slide-01.jpg','slide-01.png'],dir=>assert.throws(()=>collectSlideFrames(dir,[1]),/multiple images\/videos/));
  fixture(['slide-01-continuation.svg'],dir=>assert.throws(()=>collectSlideFrames(dir,[1]),/Missing base/));
});

test('continuation timing conserves the complete recorded course duration to one video frame',()=>{
  const durations=Array.from({length:185},(_,i)=>2.017+(i%19)*.113);
  const counts=durations.map((_,i)=>i%3+1);
  const schedule=frameSchedule(durations,counts,24);
  schedule.forEach((parts:number[],i:number)=>{assert.equal(parts.length,counts[i]);assert.ok(parts.every(n=>n>0));});
  const pictureSeconds=schedule.flat().reduce((a:number,b:number)=>a+b,0)/24;
  const spokenSeconds=durations.reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(pictureSeconds-spokenSeconds)<=1/24);
  assert.throws(()=>frameSchedule([.01],[3],24),/too short/);
});
