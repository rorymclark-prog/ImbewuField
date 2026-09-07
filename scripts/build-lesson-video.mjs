#!/usr/bin/env node
// Include every continuation under its ORIGINAL narration block. The previous exporter
// accepted one raster per recording and silently omitted surplus visual files.
//
// node --import ./tests/register-alias.mjs scripts/build-lesson-video.mjs <module> <lang> <slides-dir|--course-deck> [out.mp4]
// --course-deck uses the same cover, demonstrations and readings the app presents.
// Custom directories: slide-01.png/jpg/jpeg/webp/svg OR slide-01.mp4/mov;
// optional slide-01-continuation.svg, slide-01-continuation-2.svg, etc.
// Ambiguous alternatives and unmatched numbers are errors, never silently skipped.
//
// Existing recordings have no word timestamps. Several cards share their block's duration
// equally; no intra-sentence synchronization is claimed. Review transitions before release.
// Short motion holds its last frame; long motion is reported and trimmed. Its audio is
// discarded. The retained South African narration remains the only audio track.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { narrationHoldReason } from '../lib/course-audio.ts';
import { collectSlideFrames, frameSchedule } from './lesson-video-assets.mjs';
const FPS = 24;
const SIZE = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xF6F0E3,setsar=1';
const quote = file => `file '${file.replace(/'/g, "'\\''")}'`;
function ffmpeg(args, label) {
  try { execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']}); }
  catch(error) { throw new Error(`${label}: ${(error.stderr?.toString() || error.message).split('\n').slice(-8).join('\n')}`); }
}
function duration(file) {
  const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}).trim());
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error(`Could not read duration: ${file}`);
  return seconds;
}
async function main() {
  const [moduleId,lang,slidesArg,outArg]=process.argv.slice(2);
  if(!moduleId||!lang||!slidesArg)throw new Error('Usage: build-lesson-video.mjs <module> <lang> <slides-dir|--course-deck> [out.mp4]');
  const held=narrationHoldReason(moduleId,lang);
  if(held)throw new Error(`Narration withheld for ${moduleId}/${lang}: ${held}`);
  const audioDir=resolve('public/course-audio',moduleId,lang);
  if(!existsSync(audioDir))throw new Error(`No recorded narration: ${audioDir}`);
  const numbers=readdirSync(audioDir).filter(file=>/^slide-\d+\.mp3$/.test(file)).map(file=>Number(/\d+/.exec(file)[0])).sort((a,b)=>a-b);
  if(!numbers.length||numbers.some((n,i)=>n!==i+1))throw new Error('Narration must be non-empty and contiguous from slide 1.');
  let groups;
  if(slidesArg==='--course-deck'){
    const { deckFor, slideImagesFor, animationUrls }=await import('../lib/course-deck.ts');
    const deck=deckFor(moduleId);
    if(!deck||deck.slides.length!==numbers.length)throw new Error('Deck and narration block counts differ.');
    groups=new Map(numbers.map(n=>{
      const frames=slideImagesFor(moduleId,lang,n).map(f=>({path:resolve('public',f.url.slice(1)),kind:'image'}));
      const animation=animationUrls(moduleId,n);
      // Retain both the demonstration and reading cards in the original spoken block.
      if(animation)frames.unshift({path:resolve('public',animation.video.slice(1)),kind:'video'});
      if(!frames.length)throw new Error(`No visual frames for slide ${n}.`);
      return[n,frames];
    }));
  }else groups=collectSlideFrames(resolve(slidesArg.replace(/^~/,homedir())),numbers);
  const blocks=numbers.map(n=>{
    const audio=join(audioDir,`slide-${String(n).padStart(2,'0')}.mp3`);
    const frames=groups.get(n);
    frames.forEach(frame=>{if(!existsSync(frame.path))throw new Error(`Missing teaching asset: ${frame.path}`);});
    return{n,audio,seconds:duration(audio),frames};
  });
  const schedule=frameSchedule(blocks.map(b=>b.seconds),blocks.map(b=>b.frames.length),FPS);
  if(slidesArg==='--course-deck')blocks.forEach((block,i)=>block.frames.forEach((frame,j)=>{
    if(frame.kind==='video' && duration(frame.path)>schedule[i][j]/FPS+1/FPS) {
      throw new Error(`Slide ${block.n}: the complete demonstration and reading cards do not fit this recording. Review the narration/visual timing before export; the course exporter will not cut the final teaching action.`);
    }
  }));
  const out=resolve((outArg||join(homedir(),'Downloads',`${moduleId}-${lang}.mp4`)).replace(/^~/,homedir()));
  const work=mkdtempSync(join(tmpdir(),'imbewu-video-'));
  try{
    const segments=[];
    let sharp;
    if(blocks.some(b=>b.frames.some(f=>extname(f.path)==='.svg')))sharp=createRequire(import.meta.url)('sharp');
    for(const [i,block]of blocks.entries()){
      console.log(`Slide ${block.n}: ${block.frames.length} visual frame(s), one ${block.seconds.toFixed(2)}s recording.`);
      for(const [j,frame]of block.frames.entries()){
        const frameCount=schedule[i][j],seconds=frameCount/FPS;
        let input=frame.path;
        if(extname(input)==='.svg'){
          input=join(work,`raster-${i}-${j}.png`);
          await sharp(frame.path).resize(1280,720,{fit:'contain',background:'#F6F0E3'}).png().toFile(input);
        }
        const video=frame.kind==='video';
        if(video){const clip=duration(input);if(clip>seconds+1/FPS)console.warn(`Slide ${block.n}: motion trimmed from ${clip.toFixed(2)}s to ${seconds.toFixed(2)}s; review the final action.`);}
        const segment=join(work,`segment-${i}-${j}.mp4`);
        ffmpeg([...(video?[]:['-loop','1']),'-i',input,'-vf',`${SIZE},fps=${FPS}${video?`,tpad=stop_mode=clone:stop_duration=${seconds}`:''}`,
          '-frames:v',String(frameCount),'-an','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p',segment],`slide ${block.n}, frame ${j+1}`);
        segments.push(segment);
      }
    }
    const segmentList=join(work,'segments.txt'),audioList=join(work,'audio.txt');
    writeFileSync(segmentList,segments.map(quote).join('\n'));
    writeFileSync(audioList,blocks.map(b=>quote(b.audio)).join('\n'));
    ffmpeg(['-f','concat','-safe','0','-i',segmentList,'-f','concat','-safe','0','-i',audioList,
      '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',out],'joining picture and narration');
    console.log(`Saved ${out} (${(statSync(out).size/1e6).toFixed(2)} MB). Review transitions with the narration before release.`);
  }finally{rmSync(work,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
