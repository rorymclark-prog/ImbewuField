#!/usr/bin/env node
// Wordless teaching sequences matched to the existing numbered narration blocks.
// These are explanatory drawings, not crop prescriptions or measured site designs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
const { C, progress, circle, line, shape, box, grass, tree, flow, rain, frame: baseFrame } = require('./render-water-demonstrations.cjs');
const ROOT = path.resolve(__dirname, '..');
const QA = process.env.COURSE_QA_DIR || path.join(os.tmpdir(), 'imbewu-course-qa');
const gold = '#C29239', red = '#AD604E';
const frame = inner => baseFrame('<defs>'+[C.blue,C.grey,C.grass,C.deep,C.soil,gold].map(color=>`<marker id="arrow-${color.slice(1)}" markerWidth="22" markerHeight="22" refX="20" refY="11" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 1L21 11L0 21L6 11Z" fill="${color}"/></marker>`).join('')+'</defs>'+inner);
const group = (x,y,s,inner,extra='') => `<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${inner}</g>`;
const reveal = (inner,t,a,b=a+1) => `<g opacity="${progress(t,a,b)}">${inner}</g>`;
function arrow(d,t,color=C.blue,width=8) {
  return line(d,color,width,`opacity=".25"`)+flow(d,t,{color,width})+line(d,color,.1,`marker-end="url(#arrow-${color.slice(1)})"`);
}
function sprout(x,y,s=1,type=0) {
  return group(x,y,s,line('M0 0 Q5 -40 0 -78',C.grass,6)+
    shape('M1 -44 Q-48 -85 -39 -32 Q-12 -14 1 -44 Z',type===1?C.light:C.grass)+
    shape('M2 -59 Q42 -108 45 -57 Q26 -31 2 -59 Z',C.light)+
    (type===2?circle(0,-82,13,gold):''));
}
function flower(x,y,s=1) {
  let petals='';for(let i=0;i<6;i++){const a=i*Math.PI/3;petals+=circle(Math.cos(a)*18,-80+Math.sin(a)*18,14,red);}
  return group(x,y,s,line('M0 0 Q-5 -37 0 -80',C.grass,6)+shape('M-2 -31 Q-51 -60 -36 -19 Q-14 -6 -2 -31Z',C.light)+petals+circle(0,-80,10,gold));
}
function person(x,y,s=1,shirt=C.grass) {
  return group(x,y,s,circle(0,-98,18,'#805333')+shape('M-20 -71 Q0 -81 20 -71 L28 -12 H-28Z',shirt)+line('M-12 -12 L-17 25 M13 -12 L18 25','#493A2D',10)+line('M-21 -61 L-42 -24 M20 -60 L44 -33','#805333',10));
}
function house(x,y,s=1) {
  return group(x,y,s,box(-60,-75,120,100,'#DBC4A1',2)+shape('M-77 -76 L0 -133 L78 -76Z',red)+box(-13,-25,27,50,C.deep,2)+box(-44,-54,24,24,C.paper,1));
}
function basket(x,y,s=1) {
  return group(x,y,s,shape('M-43 -17 L-33 32 H33 L43 -17Z',C.soil)+line('M-38 -5H38 M-34 10H34',C.deep,3)+sprout(-20,-17,.4)+sprout(12,-17,.45,2));
}
function heap(x,y,s=1,green=false) {
  return group(x,y,s,shape('M-110 0 Q-87 -50 -40 -75 Q-6 -126 40 -72 Q89 -62 110 0Z',green?C.grass:C.deep)+line('M-70 -25 l35 -10 M5 -45 l38 15 M-5 -83 l19 5',green?C.light:C.soil,5));
}
function chicken(x,y,s=1) {
  return group(x,y,s,shape('M-25 -25 Q-43 -53 -44 -56 L-15 -47 Q15 -65 27 -42 L35 -66 Q56 -70 52 -44 L42 -13 Q-3 16 -25 -25Z','#D6A957')+circle(47,-61,4,C.ink)+shape('M53 -56 L68 -52 L53 -47Z',red)+line('M2 -5 L-2 14 M22 -7 L26 12',C.deep,4));
}
function bee(x,y,t,s=1) {
  return group(x,y,s,`<ellipse cx="-10" cy="-15" rx="17" ry="${8+4*Math.sin(t*22)}" fill="${C.pale}" stroke="${C.ink}" stroke-width="2"/><ellipse cx="12" cy="-15" rx="16" ry="${9+4*Math.cos(t*22)}" fill="${C.pale}" stroke="${C.ink}" stroke-width="2"/><ellipse cx="0" cy="0" rx="24" ry="14" fill="${gold}" stroke="${C.ink}" stroke-width="3"/>`+line('M-8 -11 V11 M5 -12 V12',C.ink,5)+circle(23,-1,10,C.ink));
}
function soil(x,y,w,h,dark=true) {
  return box(x,y,w,h,dark?'#805B3D':'#C9AE86',3)+box(x,y,w,h,'url(#earth)',3)+line(`M${x} ${y} H${x+w}`,C.deep,4);
}
function mulch(x,y,w,t=12) {
  let s='';for(let i=0;i<Math.floor(w/13);i++)s+=line(`M${x+i*13} ${y+(i%3)*6} l17 -6`,i%2?C.soil:gold,5,`opacity="${progress(t,0,2)}"`);return s;
}
function pathDot(ax,ay,bx,by,t,start,end,icon) {
  const p=progress(t,start,end);return p>0&&p<1?group(ax+(bx-ax)*p,ay+(by-ay)*p,1,icon):'';
}
const scenes=[];
function add(module,slide,name,description,render) { scenes.push({module,slide,name,description,render:t=>frame(render(t))}); }

add('soil-health',5,'soil-observation',"Look for soil crumbs, roots and open channels. Compare these with the tightly packed sample. Feel and smell your own soil too: colour alone does not tell the whole story.",t=>{
  let s=soil(75,310,520,300)+soil(685,310,520,300,false);
  for(const x of [190,355,510])s+=sprout(x,310,.75)+line(`M${x} 316 q-50 60 -20 180 M${x} 316 q48 72 30 130`,C.soil,5);
  for(let i=0;i<15;i++)s+=circle(108+i*29,350+i*43%220,9+(i%3)*3,'#BD946C');
  s+=line('M158 340 Q211 405 165 465 T202 587 M395 353 Q461 414 402 500', '#48372A',12);
  s+=line('M740 362 H1138 M756 430 H1160 M724 513 H1145', '#AC8C62',8);
  s+=line(`M${176+12*Math.sin(t)} 411 q-14 10 -5 24 q12 9 17 22`,'#D29A80',8);
  const p=progress(t,1,5);s+=circle(330,465,98,'none',`stroke="${gold}" stroke-width="6" opacity="${p}"`)+line('M402 538 l54 57',gold,13,`opacity="${p}"`);
  return s;
});
add('soil-health',10,'compost-building',"Build with dry brown material and fresh green material. Add enough water to keep the heap moist, while leaving air spaces. Follow the lesson when choosing and mixing the materials.",t=>{
  let s=line('M100 595 H1180',C.deep,5)+heap(190,310,.6)+heap(1085,310,.6,true);
  let level=595;for(let i=0;i<6;i++){const p=progress(t,1+i*.9,2+i*.9),h=i%2?22:51;level-=h+4;s+=box(405+i*9,level,470-i*18,h,(i%2?C.grass:C.soil),8,`opacity="${p}"`);}
  s+=pathDot(190,260,580,485,t,1,3,line('M-20 0l45 -10 M-10 15l35 -4',C.soil,8));
  s+=pathDot(1070,260,715,388,t,3,5,sprout(0,0,.5));
  s+=reveal(rain(t,470,350,190,120,.8),t,6,7);
  s+=reveal(arrow('M300 506 Q368 470 465 468 M977 471 Q910 426 822 432',t,C.grey,5),t,8,9);
  return s;
});
add('soil-health',14,'mulch-and-rain',"Both soil sections receive the same rain. On the bare side, raindrops strike the surface and soil moves with runoff. Mulch cushions the soil and slows that movement.",t=>{
  let s=soil(65,385,530,220)+soil(680,385,530,220)+rain(t,75,510,90,260)+rain(t,690,510,90,250)+mulch(694,363,495);
  s+=arrow('M105 381 Q354 370 580 405',t,C.blue,7)+arrow('M728 380 Q770 400 785 458 M976 380 Q999 414 1009 468',t,C.blue,5);
  for(let i=0;i<14;i++){const p=(t*.16+i/14)%1;s+=circle(105+p*474,374+31*p,4,C.deep);}
  for(let i=0;i<8;i++)s+=line(`M${112+i*61} 381 l${9*Math.sin(t*4+i)} -18`,C.soil,4,`opacity="${.45+.25*Math.sin(t*4+i)}"`);
  return s;
});
add('plant-guilds',5,'root-nodules',"The close-up shows nodules on a legume root. Rhizobia living there help the plant use nitrogen from the air. Plant material and roots feed the soil as they break down.",t=>{
  let s=soil(100,345,1080,280)+sprout(360,345,2)+line('M360 350 Q289 436 305 568 M360 350 Q450 420 451 563 M360 350 V604 M317 409 L222 462 M410 424 L515 494',C.soil,9);
  for(const [x,y]of [[323,405],[307,461],[362,485],[423,437],[451,529]])s+=circle(x,y,12,gold,`opacity="${.55+.4*progress(t,1,4)}"`);
  s+=line('M468 469 L730 362',gold,3)+circle(878,284,155,C.paper,`stroke="${gold}" stroke-width="5"`);
  s+=line('M796 209 Q903 255 944 355',C.soil,19)+circle(885,280,46,gold);
  for(let i=0;i<9;i++)s+=line(`M${854+i*11%63} ${260+i*17%42} l8 3`,C.ink,4,`opacity="${progress(t,3,5)}"`);
  return s;
});
add('plant-guilds',10,'chop-and-drop',"Cut suitable leaves and spread them over exposed ground around living plants. Keep the crown and trunk clear. Soil life gradually breaks the leaves down.",t=>{
  const cut=progress(t,2,4),decay=progress(t,8,11);let s=soil(80,486,1120,155)+sprout(930,486,1.3);
  s+=grass(320,486,1.5*(1-.65*cut));
  s+=reveal(line('M238 370 l157 -30',C.grey,10)+box(210,368,47,16,C.deep,5),t,1,2);
  for(let i=0;i<8;i++){const p=progress(t,3+i*.17,5+i*.17),x=330+(230+i*46)*p,y=370+112*p-90*Math.sin(p*Math.PI);s+=group(x,y,.65,shape('M-24 0 Q-5 -42 30 -6 Q5 20 -24 0Z',i%2?C.light:C.grass),`opacity="${1-decay*.85}"`);}
  s+=mulch(561,479,270,progress(t,7,10)*12);
  for(let i=0;i<11;i++)s+=circle(589+i*23,514+i*13%45,4,C.deep,`opacity="${decay}"`);
  return s;
});
add('plant-guilds',15,'tree-guild-roles',"Start with the central fruit tree. Add plants that supply mulch, support helpful insects and cover the soil. The two views show these roles from above and from the side; use the lesson to choose suitable plants.",t=>{
  let s=circle(350,357,243,'#E5E6CA')+circle(350,357,111,C.grass)+circle(323,333,78,C.light)+line('M660 80 V635','#D5CBB6',2)+soil(720,513,485,112)+tree(969,510,1.5);
  const positions=[[214,212],[485,212],[153,437],[527,443]];
  positions.forEach(([x,y],i)=>{s+=reveal(circle(x,y,43,i<2?C.grass:gold)+grass(x,y+20,.56),t,1+i*.65);});
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;s+=reveal(flower(350+210*Math.cos(a),357+210*Math.sin(a),.35),t,4,5);}
  s+=reveal(mulch(759,505,135)+sprout(1151,510,.72)+flower(772,510,.7),t,4,6);
  for(const x of [240,445])s+=reveal(arrow(`M${x} 256 Q${x-30} 324 ${x} 384`,t,C.soil,5),t,6,7);
  return s;
});
function bush(x,y) { return group(x,y,1,line('M0 0V-64 M0 -21L-28 -55 M0 -17L31 -49',C.deep,6)+circle(-28,-73,30,C.grass)+circle(28,-73,30,C.grass)+circle(0,-100,36,C.light)); }
function groundCover(x,y) { return group(x,y,1,line('M-53 -6 Q0 -22 53 -5',C.grass,5)+Array.from({length:5},(_,i)=>sprout(-48+i*24,-4,.26)).join('')); }
function layers(t,staged=false) {
  const stage=i=>staged?progress(t,i,i+1):1;
  let s=soil(85,495,1110,151)+mulch(95,485,1075,staged?t:12);
  const items=[tree(360,495,staged?.45+1.45*progress(t,2,6):1.9),tree(658,495,staged?.32+.81*progress(t,3,7):1.13),bush(848,495),flower(1010,495,.8),groundCover(1135,495),line('M620 500 q-55 43 -90 83 M632 500 q44 59 88 75',C.soil,8),line('M452 492 Q397 449 423 397 T418 298 T415 214',C.grass,9)];
  items.forEach((item,i)=>{s+=`<g opacity="${stage(staged?(i<2?2+i:5+(i-2)*.7):0)}">${item}</g>`;});
  if(!staged){const i=Math.min(6,Math.floor(t/1.65));const points=[[360,187],[658,341],[848,412],[1010,431],[1135,475],[680,559],[424,351]];const [x,y]=points[i];s+=circle(x,y,61,'none',`stroke="${gold}" stroke-width="5"`);}
  return s;
}
add('food-forest',5,'seven-growing-layers',"Follow the highlight: canopy, smaller tree, shrub, herb, ground cover, roots and climber. Notice how each uses a different part of the growing space. The plants are spread apart here so you can see them clearly.",t=>layers(t));
add('food-forest',10,'climate-and-selection',"The left site is exposed to cold; the right site is warm. Choose plants that suit the conditions where they will grow. Check each choice before planting.",t=>{
  let s=box(70,110,530,500,'#E3E8DE',22)+box(680,110,530,500,'#EEE5C8',22)+group(340,542,1.5,bush(0,0))+tree(950,542,1.35);
  for(let i=0;i<8;i++){const x=120+i*60,y=160+((i*31+t*25)%100);s+=line(`M${x-9} ${y}h18 M${x} ${y-9}v18 M${x-6} ${y-6}l12 12 M${x-6} ${y+6}l12 -12`,C.grey,3);}
  s+=circle(950,191,47,gold);
  for(const x of [185,1085])s+=box(x-12,340,24,133,C.paper,12,`stroke="${C.ink}" stroke-width="3"`)+circle(x,478,25,C.paper,`stroke="${C.ink}" stroke-width="3"`)+line(`M${x} 478V${x===185?424:369}`,x===185?C.blue:red,12);
  s+=reveal(box(267,570,145,47,C.paper,8)+box(877,570,145,47,C.paper,8),t,5,6);
  for(const x of [310,920])s+=reveal(line(`M${x} 590l12 12 24 -27`,C.grass,6),t,6,7);
  return s;
});
add('food-forest',15,'food-forest-establishment',"Prepare and mulch the ground. Establish suitable pioneers and fruit trees, then add lower plants, ground cover and climbers as shelter develops. These are stages to plan around your own conditions.",t=>layers(t,true));

add('reading-landscape',5,'follow-rainwater',"Follow rainfall down the slope. Some water soaks in; some spreads and gathers before excess water leaves. Walk your own site after rain and trace these paths.",t=>{
  const ground='M70 262 Q300 294 476 437 Q585 495 690 495 L800 495 Q890 505 984 545 L1205 595 V645 H70Z';
  let s=shape(ground,C.soil)+shape(ground,'url(#earth)')+rain(t,100,850,65,163)+tree(317,317,.62);
  s+=arrow('M115 260 Q306 298 463 412',t,C.blue,9)+arrow('M474 427 Q595 489 766 489',t,C.blue,13)+reveal(arrow('M793 489 Q891 498 978 537 L1183 585',t,C.blue,8),t,4,5);
  for(const [x,y]of [[337,370],[602,510],[725,510]])s+=reveal(arrow(`M${x} ${y}v69`,t,C.blue,5),t,2,3);
  s+=`<ellipse cx="701" cy="489" rx="${40+progress(t,2,8)*54}" ry="6" fill="${C.blue}" opacity=".5"/>`;return s;
});
add('reading-landscape',9,'sun-and-shadow',"Compare the higher and lower northern sun. The lower sun casts longer shadows towards the south. Both side views look east: north is on the left and south on the right.",t=>{
  let s='';for(let side=0;side<2;side++){const x=65+side*625,sy=side?270:120,shadow=side?205:80;s+=box(x,65,550,565,side?'#E8E7D7':'#F1E8CC',20)+line(`M${x+20} 521H${x+525}`,C.deep,4);s+=shape(`M${x+192} 521l${shadow} -17 55 17Z`,'#A5A386')+shape(`M${x+315} 521l${Math.min(shadow,175)} -14 35 14Z`,'#A5A386');s+=house(x+201,500,.75)+tree(x+332,520,.64)+circle(x+77,sy,37,gold);s+=line(`M${x+105} ${sy+24} L${x+188} 435 M${x+110} ${sy+15} L${x+310} 400`,gold,3,`opacity="${.4+.25*Math.sin(t*.8)}"`);}
  return s;
});
add('reading-landscape',13,'wind-and-cold-air',"Thin grey arrows show wind over the ridges and through the gap. The broad blue arrows show cold air moving downhill and gathering in low ground. Look for exposed places, shelter and frost pockets on your site.",t=>{
  let s=shape('M60 474 Q248 168 458 448 Q645 594 849 309 Q1046 168 1220 469V633H60Z','#DBD1B4');
  for(let i=0;i<4;i++)s+=line(`M70 ${476+i*33} Q248 ${232+i*44} 458 ${472+i*20} Q645 ${587+i*10} 849 ${369+i*30} Q1046 ${232+i*44} 1210 ${469+i*30}`,'#BCAF8D',3);
  s+=arrow('M88 219 Q243 126 400 269 Q609 352 791 226 Q1009 109 1180 219',t,C.grey,6)+arrow('M119 381 Q301 313 455 390 Q691 423 803 347',t,C.grey,5);
  s+=reveal(arrow('M295 296 Q356 394 502 478 Q584 516 640 525 M993 291 Q922 412 770 494 L654 527',t,C.blue,14),t,2,3);
  s+=`<ellipse cx="639" cy="540" rx="${60+progress(t,4,10)*85}" ry="32" fill="${C.blue}" opacity=".24"/>`;
  s+=grass(608,512,.6)+tree(1032,329,.55);return s;
});
add('reading-landscape',17,'map-existing-features',"Trace the boundary, building and access route. Add existing water, slope information and a direction arrow. Record what is already there before drawing a new design.",t=>{
  let s=box(120,95,1040,545,'#E7E5CC',26)+house(450,297,.95)+line('M145 581 Q318 471 423 325',C.stone,53)+shape('M897 218 Q1016 204 1060 293 Q1061 387 974 367 Q895 363 880 297Z',C.pale)+tree(767,430,.9);
  s+=reveal(line('M155 135 H1109 V592 H155Z',C.ink,7,`stroke-dasharray="18 10"`),t,.5,2);
  s+=reveal(line('M387 190 H514V327H387Z',gold,6),t,2,3);
  s+=reveal(line('M145 581 Q318 471 423 325',gold,5),t,3,4);
  s+=reveal(line('M897 218 Q1016 204 1060 293 Q1061 387 974 367 Q895 363 880 297Z',C.blue,5),t,4,5);
  for(let i=0;i<3;i++)s+=reveal(line(`M611 ${174+i*40}Q707 ${215+i*40} 810 ${166+i*40}`,C.deep,3),t,5,6);
  s+=reveal(line('M235 288 V191 M235 191 l-14 23 M235 191l14 23',C.ink,6),t,7,8);return s;
});

add('intro-permaculture',7,'sharing-and-monitoring',"Neighbours share water while someone checks the source level. Agree who can collect water and how use will be monitored. Change the arrangement when the source or household needs change.",t=>{
  let s=soil(80,487,1120,154)+box(308,501,645,88,C.pale,1)+line('M581 529 V287 H693V333',C.grey,18)+box(566,264,80,32,C.ink,8);
  const p=progress(t,1,8);s+=box(306,530+p*7,648,57-p*7,C.blue,0)+line('M384 332V593',gold,5);
  for(let i=0;i<4;i++)s+=line(`M373 ${537+i*16}h25`,C.ink,3);
  s+=person(319,464,.9)+person(740,462,1)+person(866,465,.88,C.blue)+person(991,466,.82,red);
  s+=shape('M660 432h66l-8 55h-50Z',C.soil)+box(670,482-36*progress(t%6,0,3),46,36*progress(t%6,0,3),C.blue,2)+arrow('M693 337 V430',t,C.blue,6)+pathDot(693,454,864,454,t,3,5,shape('M-27 -17H27L20 29H-20Z',C.soil)+box(-17,-9,34,20,C.blue,2))+pathDot(693,454,991,454,t,8,11,shape('M-27 -17H27L20 29H-20Z',C.soil)+box(-17,-9,34,20,C.blue,2));
  s+=reveal(line('M306 408 L375 388',C.deep,8),t,3,4);
  s+=reveal(line('M803 271 Q880 217 966 275',gold,5),t,6,7);return s;
});
add('intro-permaculture',13,'diversity-and-disturbance',"Both beds face the same disturbance. The uniform planting responds in a similar way; the mixed planting shows different responses, including damage. Diversity spreads risk, but a severe storm can still damage the whole garden.",t=>{
  let s=box(65,145,540,463,'#ECE5D0',20)+box(675,145,540,463,'#ECE5D0',20)+soil(90,485,490,105)+soil(700,485,490,105);
  const damage=progress(t,4,7);
  for(let j=0;j<2;j++)for(let i=0;i<5;i++){const x=142+j*610+i*95,type=j?i%3:0,rot=damage*(j?(i%3===0?49:i%3===1?16:4):49);s+=group(x,485,1,(j?(type===1?grass(0,0,1):type===2?flower(0,0,1):sprout(0,0,.8)):sprout(0,0,1)),`transform-origin="0 0"` ).replace('scale(1)','scale(1) rotate('+rot+')');}
  if(t>2&&t<8)for(let j=0;j<2;j++)for(let i=0;i<21;i++)s+=circle(105+j*610+i*83%453,195+(i*71+t*151)%228,5,C.paper,`stroke="${C.grey}" stroke-width="2"`);
  return s;
});
add('intro-permaculture',19,'windward-shelter',"Wind enters both plans from the upper left. On the left, the windbreak stands between it and the crops. On the right, the crops are exposed before wind reaches the trees. Observe the damaging wind on your own site before placing shelter.",t=>{
  let s='';for(let j=0;j<2;j++){const x=55+j*625;s+=box(x,105,550,500,'#E5E5CB',22);
    for(let i=0;i<4;i++)for(let r=0;r<3;r++)s+=sprout(x+225+i*69,318+r*91,.52);
    const bx=j?x+466:x+130,by=j?531:217;
    for(let i=0;i<6;i++)s+=circle(bx+(i-2.5)*20,by-(i-2.5)*20,20,C.grass);
    for(let i=0;i<3;i++){s+=arrow(`M${x+42+i*51} 116 L${x+153+i*51} 258`,t,C.grey,7);s+=arrow(`M${x+176+i*54} 294 L${x+342+i*54} 486`,t,C.grey,j?8:3);}
  }return s;
});

add('small-livestock',4,'moving-chicken-tractor',"Move the enclosure across an empty bed, keeping feed, water and shelter with the birds. Scratching disturbs old material and manure is left behind. Agree a safe manure and planting plan before growing food in the bed.",t=>{
  const move=progress(t,5,9)*525;
  let s=soil(80,460,1120,148)+mulch(98,453,1080);
  s+=box(135,461,Math.max(1,move),85,C.deep,3);
  for(let i=0;i<14;i++){const x=156+i*36;if(x<145+move)s+=circle(x,491+(i%3)*17,4,C.ink);}
  s+=group(180+move,445,1,chicken(65,0,.8)+chicken(163,0,.8)+chicken(256,0,.8)+shape('M-14 -177 H117L133 -67H-14Z',C.soil)+line('M-14 -177 H327V19H-14Z M-14 -67H327',C.ink,5)+box(224,-17,51,16,C.blue,5)+box(137,-17,48,16,gold,5));
  for(let i=0;i<11;i++)s+=line(`M${180+move+i*31} 272V460`,C.grey,2);
  s+=reveal(person(1140,439,.84),t,4,5);return s;
});
add('small-livestock',9,'bees-and-flowers',"Follow the bee from the hive to one flower and then another. Pollen picked up at the first flower travels with it. The bee and pollen are enlarged so you can see the action.",t=>{
  let s=soil(75,580,1130,59)+box(101,337,165,158,gold,5)+line('M103 389H265 M103 441H265',C.deep,5)+box(92,322,184,20,C.deep,4)+box(170,478,48,10,C.ink,3)+line('M133 496V578 M235 496V578',C.deep,12);
  s+=flower(641,579,2.45)+flower(1044,579,2.45);
  const p=progress(t,.5,4),q=progress(t,5,8),r=progress(t,9,12);let x,y;
  if(t<5){x=195+(643-195)*p;y=480-134*p-125*Math.sin(p*Math.PI);}else if(t<9){x=643+402*q;y=346-115*Math.sin(q*Math.PI);}else{x=1045-850*r;y=346+134*r-140*Math.sin(r*Math.PI);}
  s+=bee(x,y,t,1.2);
  if(t>4&&t<8.8)for(let i=0;i<6;i++)s+=circle(x-15+i*6,y+20+(i%2)*5,3,gold);
  s+=reveal(circle(1044,383,12,gold),t,8,9);return s;
});
add('small-livestock',14,'livestock-nutrient-cycle',"Follow suitable plant material to the animals, manure to composting, and finished compost back to the bed. Feed choices and manure handling need care. The composting stage comes before material returns to food-growing soil.",t=>{
  let s=soil(102,288,273,75)+sprout(161,288,1)+sprout(286,288,1,2)+chicken(970,270,1.6)+Array.from({length:13},(_,i)=>circle(910+i*31%109,528+i*19%43,9,C.deep)).join('')+heap(260,574,.9);
  const paths=['M399 211 H806','M1015 327 V420','M807 534 H420','M247 432 V372'];
  paths.forEach((d,i)=>s+=reveal(arrow(d,t,i===2?C.deep:C.grass,10),t,i*2,i*2+1));
  s+=reveal(sprout(180,288,.7),t,8,10);
  for(let i=0;i<6;i++)s+=reveal(circle(123+i*41,313+(i%2)*18,5,C.deep),t,8,9);return s;
});

function recordIcon(kind,x,y,s=1) {
  if(kind===0)return house(x,y,s*.55);
  if(kind===1)return group(x,y,s,circle(0,-10,25,gold,`stroke="${C.deep}" stroke-width="3"`)+circle(0,-10,15,'none',`stroke="${C.deep}" stroke-width="2"`));
  if(kind===2)return group(x,y,s,box(-30,-33,60,53,C.soil,4)+line('M0 -33V20 M-30 -10H30',C.paper,5));
  return heap(x,y,s*.35);
}
add('market-community',4,'harvest-record',"Each harvest gets a record. Follow the columns for household food, sales, gifts and compost. Add new rows as harvests happen, using your actual quantities and money amounts.",t=>{
  let s=basket(167,285,1.65)+box(360,100,815,522,'#FFFCF2',15,`stroke="${C.deep}" stroke-width="4"`);
  for(let i=0;i<4;i++){const x=490+i*184;s+=recordIcon(i,x,193,.85)+line(`M${x-89} 248V599`,'#D9C9AB',2);}
  for(let r=0;r<4;r++){const y=294+r*81;s+=line(`M387 ${y+49} H1150`,'#D9C9AB',2);for(let c=0;c<4;c++)if((r+c)%3!==0)s+=reveal(line(`M${476+c*184} ${y+17} l27 -9`,C.ink,6),t,1+r*2,2+r*2);}
  s+=arrow('M223 311H344',t,C.grass,7);return s;
});
function stall(x,y,s=1) {
  return group(x,y,s,box(-76,-94,152,32,red,3)+line('M-67 -61V47 M65 -61V47',C.deep,7)+box(-75,0,150,17,C.soil,2)+basket(0,-23,.65));
}
function truck(x,y,s=1) {
  return group(x,y,s,box(-78,-64,119,63,C.grass,4)+shape('M42 -49H80L101 -17V1H42Z',C.light)+box(52,-40,25,23,C.pale,3)+circle(-42,9,17,C.ink)+circle(71,9,17,C.ink));
}
add('market-community',9,'surplus-routes',"Follow the harvest to three possible destinations: a roadside stall, a group delivery to a shop, or a box delivered to a household. Compare the work and costs of each route.",t=>{
  let s=basket(223,403,2.4)+stall(961,207,1)+truck(882,397,.9)+house(1081,379,.55)+box(1039,348,85,12,red,2)+box(1053,370,56,12,C.soil,2)+house(1020,585,.73)+basket(875,590,.7);
  const paths=['M353 347 Q529 200 799 190','M354 384 H767','M351 417 Q533 574 790 567'];
  paths.forEach((d,i)=>s+=reveal(arrow(d,t,C.grass,9),t,1+i*3,2+i*3));return s;
});
add('market-community',14,'neighbour-sharing',"Neighbours contribute seed, tools, learning and transport. Each contribution strengthens the local food network. Agree responsibilities and keep records of the sharing.",t=>{
  let s='';const homes=[[202,240],[1078,240],[202,566],[1078,566]];
  homes.forEach(([x,y],i)=>s+=house(x,y,.85)+person(x+(i%2?-115:115),y,.64));
  s+=basket(640,379,1.5);
  const paths=['M319 227 Q484 198 581 306','M961 227 Q801 198 700 306','M321 552 Q474 538 579 427','M963 552 Q793 538 704 427'];
  paths.forEach((d,i)=>s+=reveal(arrow(d,t,i%2?gold:C.grass,7),t,1+i*2,2+i*2));
  s+=reveal(box(453,179,45,55,C.soil,5)+circle(476,206,7,C.deep),t,2,3);
  s+=reveal(line('M808 178l48 72 M800 186l28 -21',C.deep,8),t,4,5);
  s+=reveal(person(473,539,.55)+person(515,539,.55,C.blue),t,6,7);
  s+=reveal(truck(827,542,.5),t,8,9);return s;
});

async function main() {
  const filter=process.argv[2];
  const selected=scenes.filter(s=>!filter||s.module===filter||s.name===filter);
  if(!selected.length)throw new Error(`No demonstration matches ${filter}`);
  fs.mkdirSync(QA,{recursive:true});
  const report=[];
  for(const scene of selected){
    const out=path.join(ROOT,'public/course-animations',scene.module);fs.mkdirSync(path.join(out,'posters'),{recursive:true});
    const movie=path.join(out,scene.name+'.mp4');
    const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate','15','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','inherit','inherit']});
    const done=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('exit',code=>code===0?resolve():reject(new Error(`${scene.name}: ffmpeg exited ${code}`)));});
    for(let n=0;n<180;n++){
      const png=await sharp(Buffer.from(scene.render(n/15))).png().toBuffer();
      if(!ff.stdin.write(png))await new Promise(resolve=>ff.stdin.once('drain',resolve));
    }
    ff.stdin.end();await done;
    await sharp(Buffer.from(scene.render(10))).resize(960,540).jpeg({quality:78}).toFile(path.join(out,'posters',scene.name+'.jpg'));
    const panels=await Promise.all([0,2,4,6,8,11.9].map(async(t,i)=>({input:await sharp(Buffer.from(scene.render(t))).resize(640,360).png().toBuffer(),left:i%2*640,top:Math.floor(i/2)*360})));
    await sharp({create:{width:1280,height:1080,channels:3,background:C.paper}}).composite(panels).png().toFile(path.join(QA,scene.name+'.png'));
    fs.writeFileSync(path.join(QA,scene.name+'.svg'),scene.render(10));
    report.push({module:scene.module,slide:scene.slide,name:scene.name,description:scene.description,bytes:fs.statSync(movie).size,seconds:12});
    process.stdout.write(JSON.stringify({name:scene.name,bytes:report.at(-1).bytes})+'\n');
  }
  fs.writeFileSync(path.join(QA,'manifest'+(filter?'-'+filter:'')+'.json'),JSON.stringify(report,null,2)+'\n');
}
module.exports = { scenes };
if(require.main===module)main().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
