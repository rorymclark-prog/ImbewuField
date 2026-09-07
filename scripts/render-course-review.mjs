#!/usr/bin/env node
// One portable review file: no hosting, network requests, audio autoplay or draft-language activation.
import {readFileSync,readdirSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {COURSE_NARRATION} from '../lib/course-audio.ts';
const modules=JSON.parse(readFileSync('docs/course-production/isiZulu-drafts/status.json','utf8'));
const data=[];
for(const {module} of modules){
  const entry={id:module,languages:{}};
  for(const lang of ['en','zu']){
    const dir=lang==='en'?`public/course-decks/${module}/en`:`docs/course-production/isiZulu-drafts/${module}`;
    const names=readdirSync(dir);
    entry.languages[lang]=COURSE_NARRATION[module].tracks.map(track=>{
      const stem=`slide-${String(track.slide).padStart(2,'0')}`;
      const front=`${stem}-front.jpg`;
      const image=names.includes(front)?front:track.slide===1&&names.includes('cover.jpg')?'cover.jpg':null;
      const readings=names.filter(n=>n===`${stem}.svg`||n===`${stem}-continuation.svg`||new RegExp(`^${stem}-continuation-\\d+\\.svg$`).test(n)).sort((a,b)=>{
        const part=n=>n===`${stem}.svg`?0:n===`${stem}-continuation.svg`?1:Number(n.match(/-(\d+)\.svg$/)[1]);return part(a)-part(b);
      });
      if(!readings.length)throw new Error(`Missing readings ${module}/${lang}/${track.slide}`);
      const files=[...(image?[image]:[]),...readings];
      return {number:track.slide,frames:files.map(name=>({kind:name.endsWith('.jpg')?'illustration':'reading',src:`data:${name.endsWith('.jpg')?'image/jpeg':'image/svg+xml'};base64,${readFileSync(`${dir}/${name}`).toString('base64')}`}))};
    });
  }
  data.push(entry);
}
const output=resolve(process.argv[2]||'../exports/Imbewu-Deck-Review.html');mkdirSync(dirname(output),{recursive:true});
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imbewu deck review</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f7f2e9;color:#20190f;font:16px system-ui,sans-serif}header,main{max-width:1100px;margin:auto;padding:18px}h1{font:700 28px Georgia,serif;color:#1f4d2b;margin:0 0 12px}p{line-height:1.5}.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}select,button{font:inherit;padding:10px;border:1px solid #b8ab92;border-radius:8px;background:white;color:#20190f}button{cursor:pointer}button:disabled{opacity:.4}figure{margin:16px 0}img{display:block;width:100%;height:auto}figcaption{font-size:14px;margin:8px 0;color:#51452f}.status{border-left:4px solid #b07a1e;padding:10px 14px;background:#eee5d5}nav{position:sticky;top:0;background:#f7f2e9;padding:12px 0;z-index:1}</style>
<header><h1>Imbewu lesson deck review</h1><p class="status">Production draft. English: nine reading decks with covers; Soil Health has 18 illustrated teaching fronts. Its wattle-pod identification image remains pending. isiZulu: all nine reading decks are drafts requiring reconciliation and first-language review. This file contains stills only; animations and narration remain separate.</p><div class="controls"><label>Module <select id="module"></select></label><label>Language <select id="language"><option value="en">English</option><option value="zu">isiZulu · DRAFT</option></select></label></div></header>
<main><nav class="controls"><button id="previous">Previous</button><label>Slide <select id="slide"></select></label><button id="next">Next</button><span id="counter"></span></nav><section id="frames" aria-live="polite"></section></main>
<script>const decks=${JSON.stringify(data).replace(/</g,'\\u003c')};const moduleSelect=document.getElementById('module'),language=document.getElementById('language'),slide=document.getElementById('slide'),frames=document.getElementById('frames');let index=0;decks.forEach((d,i)=>moduleSelect.add(new Option(d.id.replaceAll('-',' '),i)));moduleSelect.value=String(decks.findIndex(d=>d.id==='soil-health'));
function current(){return decks[Number(moduleSelect.value)].languages[language.value]}function draw(){const blocks=current();index=Math.max(0,Math.min(index,blocks.length-1));slide.replaceChildren(...blocks.map((b,i)=>new Option(String(b.number),i)));slide.value=String(index);frames.replaceChildren();blocks[index].frames.forEach((f,i)=>{const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=(language.value==='zu'?'isiZulu draft · ':'')+(f.kind==='illustration'?'Teaching illustration':'Reading frame')+' · '+(i+1);img.src=f.src;img.alt='Slide '+blocks[index].number+', '+f.kind+' '+(i+1);figure.append(caption,img);frames.append(figure)});document.getElementById('counter').textContent=(index+1)+' / '+blocks.length;document.getElementById('previous').disabled=index===0;document.getElementById('next').disabled=index===blocks.length-1}
moduleSelect.onchange=()=>{index=0;draw()};language.onchange=()=>draw();slide.onchange=()=>{index=Number(slide.value);draw()};document.getElementById('previous').onclick=()=>{index--;draw()};document.getElementById('next').onclick=()=>{index++;draw()};draw();</script></html>`;
writeFileSync(output,html);console.log(output,Buffer.byteLength(html),'bytes');
