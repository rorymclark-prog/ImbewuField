#!/usr/bin/env node
// New, wordless explanatory diagrams. Coordinates are illustrative, never construction sizes.
// Reproduce with Node + sharp + ffmpeg. See docs/WATER-DEMONSTRATIONS-2026-09-07.md.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public/course-animations/water-harvesting');
const QA = process.env.WATER_QA_DIR || path.join(os.tmpdir(), 'imbewu-water-qa');
const C = { paper:'#F6F0E3', ink:'#264638', soil:'#BB8B5F', deep:'#8C603F', grass:'#48794F', light:'#8BA969', blue:'#438FA4', pale:'#C0DFDD', stone:'#D2C8AD', grey:'#788B89' };
const clamp = n => Math.max(0, Math.min(1, n));
const progress = (t, a, b) => clamp((t-a)/(b-a));
const circle = (x,y,r,fill,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const line = (d,stroke,width=5,extra='') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const shape = (d,fill,extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const box = (x,y,w,h,fill,r=12,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
function grass(x,y,s=1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${line('M0 0 Q-22 -35 -21 -62 M0 0 Q8 -47 21 -72 M0 0 Q-3 -50 2 -79 M0 0 Q28 -26 35 -47 M0 0 Q-30 -15 -37 -40',C.grass,5)}</g>`;
}
function tree(x,y,s=1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${line('M0 0 L0 -105 M0 -45 L-32 -89 M0 -60 L36 -108',C.deep,12)}${circle(-42,-126,48,C.grass)}${circle(35,-140,54,C.grass)}${circle(0,-174,53,C.light)}${circle(-15,-123,41,C.grass)}${circle(40,-116,7,'#D6A34D')}${circle(-36,-139,7,'#D6A34D')}${circle(9,-172,7,'#D6A34D')}</g>`;
}
function flow(d,t,{width=7,color=C.blue,opacity=1}={}) {
  return line(d,color,width,`opacity="${opacity}" stroke-dasharray="14 25" stroke-dashoffset="${-t*58}"`);
}
function rain(t,x=110,w=1050,y=75,h=150,amount=1) {
  let s='';
  for(let i=0;i<35;i++) {
    const px=x+(i*173%w), py=y+((i*47+t*160)%h);
    s+=line(`M${px} ${py} l-6 17`,C.blue,3,`opacity="${0.35*amount}"`);
  }
  return s;
}
function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><pattern id="earth" width="47" height="39" patternUnits="userSpaceOnUse"><circle cx="8" cy="12" r="1.4" fill="#6C4D31" opacity=".22"/><path d="M30 29l5-2" stroke="#E5C69D" stroke-width="2"/></pattern><linearGradient id="soil" x2="0" y2="1"><stop stop-color="#C79A6A"/><stop offset="1" stop-color="#986B48"/></linearGradient></defs>${box(0,0,1280,720,C.paper,0)}${inner}${line('M48 680 H1232','#DBD0B7',1)}</svg>`;
}
const SCENES = {
  'swale-infiltration': t => {
    const fill=progress(t,1,4)*(1-.7*progress(t,7,11));
    const soil='M60 348 L380 405 L428 418 Q455 429 473 485 Q480 515 510 520 L587 520 Q611 520 627 480 L651 430 Q683 367 719 383 Q745 396 774 457 L1220 555 L1220 648 L60 648 Z';
    const bowl='M428 418 Q455 429 473 485 Q480 515 510 520 L587 520 Q611 520 627 480 L651 430 Z';
    let s=box(60,50,1160,186,'#ECE7D6',20)+line('M115 108 H1160 M115 190 H1160','#B6B497',3);
    s+=box(135,137,1000,25,C.deep,4)+box(135,162-fill*25,1000,fill*25,C.blue,1);
    // Equal-height marks: the top strip is a view along the same contour, not a drain.
    for(const x of [135,385,635,885,1135]) s+=line(`M${x} 117 v65`,C.ink,2)+circle(x,137,4,C.ink);
    s+=shape(soil,'url(#soil)')+shape(soil,'url(#earth)')+line(soil,C.deep,4);
    s+=`<clipPath id="bowl"><path d="${bowl}"/></clipPath><g clip-path="url(#bowl)">${box(420,520-fill*86,245,100,C.blue,0)}</g>`;
    s+=tree(710,391,.66)+line('M704 419 Q676 475 637 507 M714 424 Q761 484 805 494',C.deep,4);
    s+=rain(t,90,370,264,95,1-progress(t,5,7));
    if(t<7)s+=flow('M125 327 L366 372 Q424 386 466 440',t,{opacity:progress(t,.2,1)});
    for(const [x,y] of [[487,540],[540,551],[591,540]])s+=flow(`M${x} ${y} v56`,t,{width:5,opacity:progress(t,3,5)});
    s+=`<ellipse cx="552" cy="561" rx="${75+progress(t,3,11)*95}" ry="${15+progress(t,3,11)*35}" fill="${C.blue}" opacity=".15"/>`;
    return frame(s);
  },
  'safe-overflow': t => {
    let s='';
    for(let y=130;y<670;y+=105)s+=line(`M60 ${y} Q640 ${y-80} 1220 ${y}`, '#D8C9A8',3);
    s+=rain(t,130,900,65,130);
    const upper='M200 221 Q540 173 902 226 Q936 254 901 276 Q550 310 207 270 Z';
    const lower='M259 441 Q645 396 1044 440 Q1098 470 1047 503 Q643 550 264 496 Z';
    s+=shape(upper,C.pale)+shape(lower,C.pale);
    s+=shape(upper,C.blue,`opacity="${.2+.65*progress(t,0,4)}"`)+shape(lower,C.blue,`opacity="${.1+.65*progress(t,5,10)}"`);
    s+=line('M193 279 Q520 324 901 281',C.soil,28)+line('M255 509 Q659 562 1053 515',C.soil,28);
    s+=line('M925 250 C1070 265 1063 370 1029 443',C.stone,53);
    for(let i=0;i<19;i++){ const a=i/18; const x=950+80*Math.sin(a*Math.PI);const y=266+a*157;s+=circle(x+(i%2?15:-15),y,8,'#ACA58F'); }
    s+=flow('M354 83 L354 207 M614 83 L614 204 M833 93 L833 216',t,{opacity:.6});
    s+=flow('M906 250 C1044 265 1053 365 1029 442',t,{width:15,opacity:progress(t,4,5.5)});
    for(const x of [330,510,700,870])s+=grass(x,320,.35)+grass(x+50,564,.35);
    return frame(s);
  },
  'contour-vegetation': t => {
    const soil='M85 236 L1195 600 V650 H85 Z';
    let s=rain(t,95,930,75,165)+shape(soil,'url(#soil)')+shape(soil,'url(#earth)')+line('M85 236 L1195 600',C.deep,4);
    const barriers=[[358,326],[626,414],[895,502]];
    for(const [x,y] of barriers){
      s+=shape(`M${x-75} ${y-25} Q${x-25} ${y-35} ${x} ${y} Z`,'#D5AF79',`opacity="${progress(t,2,9)}"`);
      s+=line(`M${x-9} ${y+6} q-40 55 -22 108 M${x+2} ${y+5} q15 65 2 104`,C.deep,3);
      for(let i=-2;i<=2;i++)s+=grass(x+i*11,y+i*3.6,.92);
    }
    for(const [a,b] of [[120,298],[405,566],[670,835],[945,1150]]){
      const y=x=>236+(x-85)*364/1110;
      s+=flow(`M${a} ${y(a)-14} L${b} ${y(b)-14}`,t,{width:7,opacity:.8});
      // Sediment travels to, and accumulates immediately above, each living barrier.
      const p=((t*.19)%1),x=a+(b-a)*p;
      s+=circle(x,y(x)-12,5,C.deep);
    }
    for(const [x,y]of barriers)s+=flow(`M${x-32} ${y+19} v46`,t,{width:4,opacity:progress(t,2,4)*.6});
    return frame(s);
  },
  'dam-spillway': t => {
    let s='';
    for(let i=0;i<5;i++)s+=line(`M${70+i*37} 78 Q${110+i*27} ${478-i*18} 268 630 M${1200-i*25} 75 Q${1160-i*24} 292 ${1150-i*9} 647`,'#D7CAAD',3);
    const reservoir='M591 178 C441 210 366 310 346 470 Q563 528 855 471 Q892 316 755 211 Q686 158 591 178 Z';
    s+=shape(reservoir,C.pale)+shape(reservoir,C.blue,`opacity="${.2+.65*progress(t,0,4)}"`);
    s+=line('M326 503 Q580 570 880 504',C.deep,66)+line('M326 494 Q580 561 880 495',C.soil,36);
    // Spillway passes around the abutment, never across the earthen wall.
    s+=line('M855 385 C967 348 1001 421 1000 502 S1023 582 1137 628',C.stone,59);
    for(let i=0;i<13;i++)s+=grass(342+i*41,541+29*Math.sin(i/12*Math.PI),.25);
    s+=flow('M448 84 Q479 129 537 181 M723 78 Q702 122 674 164',t,{width:10});
    s+=flow('M855 385 C967 348 1001 421 1000 502 S1023 582 1137 628',t,{width:16,opacity:progress(t,4,6)});
    for(let i=0;i<7;i++)s+=line(`M${440+i*43} ${299+(i%2)*65} h38`, '#B2D9D8',3,`opacity="${.5+.3*Math.sin(t+i)}"`);
    return frame(s);
  },
  'first-flush': t => {
    const filling=progress(t,.7,4.5), toTank=progress(t,5,10.5);
    let s=box(85,265,400,330,'#E8DEBF',5)+shape('M60 269 L259 116 L511 263 Z','#93A59D');
    for(let i=0;i<8;i++)s+=line(`M${99+i*45} 266 L${259+(i-3)*22} ${131+Math.abs(i-3)*16}`,'#657D72',2);
    s+=box(154,389,115,206,C.deep,4)+box(326,340,95,90,C.pale,5);
    s+=line('M63 276 H650 V341',C.ink,23)+line('M63 276 H650 V341','#DDD8C6',16);
    s+=line('M650 310 H903 V332',C.ink,23)+line('M650 310 H903 V332','#DDD8C6',16);
    s+=box(615,342,70,215,'#D9DED2',18,`stroke="${C.ink}" stroke-width="5"`);
    s+=box(622,550-filling*193,56,filling*193,'#A58A66',8);
    s+=circle(650,536-filling*179,18,'#E6C55B',`stroke="${C.ink}" stroke-width="3"`);
    s+=line('M618 341 H634 M666 341 H682',C.ink,8);
    // Service drain is closed during collection. Reset only after the storm.
    s+=line('M650 557 V604 H710',C.ink,10)+line('M640 582 H660',C.deep,5)+circle(650,582,7,C.deep);
    s+=box(854,336,331,275,'#ACC3AD',24,`stroke="${C.ink}" stroke-width="4"`);
    s+=box(869,590-toTank*185,300,toTank*185,C.blue,15,`opacity=".7"`);
    s+=box(849,326,340,24,C.grass,8)+box(921,306,96,23,C.grass,6);
    for(let i=0;i<5;i++)s+=line(`M869 ${382+i*43} H1170`,'#719681',3);
    // An inset cutaway reveals stored water; the real tank is opaque and covered.
    s+=line('M1188 360 H1214 V573',C.ink,8)+line('M881 611 v22 M1155 611 v22',C.ink,9);
    s+=rain(t,120,365,30,165);
    s+=flow('M315 220 L494 276 H650 V339',t,{color:t<4.7?'#A28053':C.blue,width:8});
    if(t<4.7)s+=flow('M650 371 V507',t,{color:C.deep,width:5,opacity:1-filling});
    if(t>=4.7)s+=flow('M662 310 H903 V326',t,{width:9,opacity:progress(t,4.7,5.4)});
    return frame(s);
  },
  'greywater-under-mulch': t => {
    let s=box(70,110,400,307,'#EAE1C9',8)+line('M72 415 H464',C.deep,8);
    s+=shape('M136 239 H327 Q312 303 238 303 Q159 303 136 239 Z','#D3DAD2',`stroke="${C.ink}" stroke-width="4"`);
    s+=line('M183 223 V194 Q184 174 207 175 H231',C.ink,11);
    s+=box(72,428,1140,220,'url(#soil)',0)+box(72,428,1140,220,'url(#earth)',0);
    s+=line('M238 304 V470 H716 Q744 470 744 493',C.ink,25)+line('M238 304 V470 H716 Q744 470 744 493','#D9D9CB',17);
    s+=tree(990,424,1.1);
    s+=line('M985 442 Q950 504 861 539 M995 445 Q1048 516 1138 552 M980 465 Q940 556 960 611',C.deep,7);
    s+=shape('M681 416 Q758 434 856 416 L856 456 Q766 471 681 454 Z','#8B653F');
    for(let i=0;i<32;i++){const x=688+i*31%163,y=425+i*17%28;s+=line(`M${x} ${y} l12 -3`,'#C49C63',3);}
    s+=`<ellipse cx="794" cy="532" rx="${20+progress(t,2,10)*91}" ry="${10+progress(t,2,10)*60}" fill="${C.grey}" opacity=".38"/>`;
    s+=flow('M238 310 V470 H716 Q744 470 744 493',t,{color:C.grey,width:7});
    if(t>2)s+=flow('M744 497 Q758 515 805 540',t,{color:C.grey,width:5,opacity:.8});
    // Mulch does not disinfect: water keeps the same grey colour below the surface.
    return frame(s);
  },
};

async function main() {
  fs.mkdirSync(path.join(OUT,'posters'),{recursive:true});
  fs.mkdirSync(QA,{recursive:true});
  const only=process.argv[2];
  const report=[];
  for(const [name,render] of Object.entries(SCENES)) {
    if(only && name!==only)continue;
    const movie=path.join(OUT,name+'.mp4');
    const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate','15','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','inherit','inherit']});
    const done=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('exit',code=>code===0?resolve():reject(new Error(`ffmpeg ${name}: ${code}`)));});
    for(let n=0;n<180;n++){
      const png=await sharp(Buffer.from(render(n/15))).png().toBuffer();
      if(!ff.stdin.write(png))await new Promise(resolve=>ff.stdin.once('drain',resolve));
    }
    ff.stdin.end();await done;
    await sharp(Buffer.from(render(8))).jpeg({quality:85}).toFile(path.join(OUT,'posters',name+'.jpg'));
    // Inspect the complete sequence as six storyboard frames, including both endpoints.
    const times=[0,2,4,6,8,11.9];
    const panels=await Promise.all(times.map(async(t,i)=>({input:await sharp(Buffer.from(render(t))).resize(640,360).png().toBuffer(),left:(i%2)*640,top:Math.floor(i/2)*360})));
    await sharp({create:{width:1280,height:1080,channels:3,background:C.paper}}).composite(panels).png().toFile(path.join(QA,name+'.png'));
    fs.writeFileSync(path.join(QA,name+'.svg'),render(8));
    report.push({name,bytes:fs.statSync(movie).size,seconds:12});
    process.stdout.write(JSON.stringify(report.at(-1))+'\n');
  }
  fs.writeFileSync(path.join(QA,'manifest.json'),JSON.stringify(report,null,2)+'\n');
}
module.exports = { C, clamp, progress, circle, line, shape, box, grass, tree, flow, rain, frame };
if (require.main === module) main().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
