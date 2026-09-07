#!/usr/bin/env node
// Draft translations must be reviewable without advertising them as finished language coverage.
import {renderDeck} from './render-course-deck.mjs';
import {mkdirSync,writeFileSync,readdirSync,unlinkSync} from 'node:fs';
const modules=['intro-permaculture','reading-landscape','water-harvesting','soil-health','plant-guilds','food-forest','vegetables-staples','small-livestock','market-community'];
const report=[];
for(const module of modules){
  const frames=renderDeck(module,'zu');
  const dir=`docs/course-production/isiZulu-drafts/${module}`;
  mkdirSync(dir,{recursive:true});
  const keep=new Set(frames.map(f=>f.file));
  for(const file of readdirSync(dir))if(file.endsWith('.svg')&&!keep.has(file))unlinkSync(`${dir}/${file}`);
  for(const frame of frames)writeFileSync(`${dir}/${frame.file}`,frame.svg);
  report.push({module,blocks:frames.filter(f=>!f.continuation).length,readingFrames:frames.length,status:'Unreviewed isiZulu draft; not registered in the live deck manifest'});
}
writeFileSync('docs/course-production/isiZulu-drafts/status.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
