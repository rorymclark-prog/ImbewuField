import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { hybridProtectionPolicy, geometryLockCompositionPolicy, legacyPaperArtworkNeedsRoof, AI_MAP_REVIEW_NOTICE } from '../lib/render-policy.ts';
import { canopyForegroundAlpha, assertMatchingImageAspects } from '../lib/image-producer.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { itemInFilter, isContextElement, zonesInFilter, lineInFilter } from '../lib/glossy-filters.ts';
import { statusOf } from '../lib/design-canvas.ts';
import { authoritativeHouseFootprints, sameFootprint } from '../lib/house-footprints.ts';
import polygonClipping from 'polygon-clipping';

// Execute the actual production helpers. A source-pattern test cannot see a photo strip or
// prove that a completed job's old mask is replaced. No private farm records or native dependency.
const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function helper(name: string, scope: Record<string, unknown>): any {
  let code = '';
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) code = n.getText(tree).replace(/^export\s+/, '');
    if (ts.isVariableDeclaration(n) && n.name.getText(tree) === name) {
      const call = n.initializer as ts.CallExpression;
      code = `const ${name} = ${call.arguments[0].getText(tree)};`;
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  assert.ok(code, `missing production helper ${name}`);
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), js + `; return ${name};`)(...Object.values(scope));
}

type Point = [number, number];
const drivewayGuideLines = helper('drivewayGuideLines', { polygonClipping, ringArea: helper('ringArea', {}) });
const glossyArtworkState = helper('glossyArtworkState', { drivewayGuideLines });

test('a duplicate closed driveway guide stays editable while genuine paths remain in glossy inputs and briefs', () => {
  const area:Point[]=[[.2,.2],[.5,.2],[.5,.5],[.2,.5],[.2,.2]];
  const walking:Point[]=[[.7,.7],[.9,.7],[.9,.9],[.7,.9],[.7,.7]];
  const circuit:Point[]=[[0,0],[1,0],[1,1],[0,1],[0,0]];
  const lines=[{id:'guide',kind:'path',points:area},{id:'open',kind:'path',points:area.slice(0,-1)},
    {id:'walking',kind:'path',points:walking},{id:'circuit',kind:'path',points:circuit}];
  const saved={items:[],zones:[],lines};
  const refs={boundary:[],house:[],driveway:area,drivewayClosed:true};
  const frozen=JSON.stringify({saved,refs});
  assert.deepEqual(drivewayGuideLines(saved,refs).map((line:any)=>line.id),['guide']);
  assert.deepEqual(glossyArtworkState(saved,refs).lines.map((line:any)=>line.id),['open','walking','circuit']);
  assert.equal(glossyArtworkState(saved,{...refs,driveway:[]}),saved,'without a recorded driveway no path is silently hidden');
  assert.deepEqual(drivewayGuideLines({...saved,zones:[{feature:'driveway',points:area}]},{...refs,driveway:[]})
    .map((line:any)=>line.id),['guide'],'Studio-traced driveways use the same guide rule');
  const brief=helper('buildDesignBrief',{drivewayGuideLines,glossyArtworkState,
    compass8:helper('compass8',{}),COMPASS_ORDER:[],LINE_BRIEF_LABELS:{path:'walking path'},BRIEF_MAX:10000});
  const text=brief(saved,refs,'Fictional',null);
  assert.match(text,/DRIVEWAY GUIDE OMITTED:/);
  assert.match(text,/3× walking path/,'the real open path and separate walking loops stay in the register');
  assert.doesNotMatch(brief(saved,{...refs,driveway:[]},'Fictional',null),/DRIVEWAY GUIDE OMITTED:/);
  const draw=helper('drawMarks',{glossyArtworkState,RENDERED_DRIVEWAY_EDGE:false,TAR:'#12140F',SCALE:3,
    authoritativeHouseFootprints,zoneBadgePositions:()=>new Map(),lineInFilter,LINE_COLORS:{path:'#C4A74E'}});
  for(const line of [lines[0],lines[1]]) {
    const canvas=probeCanvas([[100,100]]),ctx:any=canvas.getContext(),dashes:unknown[]=[];
    ctx.setLineDash=(value:unknown)=>dashes.push(value);
    draw(ctx,{...saved,lines:[line]},{imgW:300,imgH:300,mPerPx:1,satDataUrl:'photo'},refs,300,300);
    assert.equal(dashes.length,line.id==='guide'?0:2,
      'the actual model-input painter omits the duplicate dash loop, while open paths remain visible');
  }
  assert.equal(JSON.stringify({saved,refs}),frozen,'presentation must not delete or move the editable source guide');
});
const frame = { imgW: 100, imgH: 100, mPerPx: 1, satDataUrl: 'photo' };
const refs = { boundary: [[.1,.1],[.85,.1],[.85,.9],[.1,.9]], house: [], driveway: [] };
const state = { items: [{ id: 'crown', defId: 'tree_other', x: .84, y: .7, wM: 70/3, hM: 70/3 }],
  lines: [], zones: [{ id: 'zone', zone: 1, points: [[.2,.25],[.75,.25],[.75,.4],[.2,.4]] }] };

/** Small vector recorder evaluates probe points independently of canvas antialiasing. Polygon
 * fill uses even/odd crossings; outline uses distance to each segment. It can fail on a band
 * added anywhere, not just on a policy flag. Real browser/native pixels are inspected separately. */
function probeCanvas(points: Point[]) {
  let alpha = points.map(() => 0), paths: Point[][] = [], current: Point[] = [], ellipse: number[] | null = null;
  let transform: Point = [0, 0], operation = 'source-over';
  const saved: Array<[Point, string]> = [];
  function inside(p: Point, ring: Point[]) {
    let hit = false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
    }
    return hit;
  }
  function paint(hits: boolean[]) { alpha = alpha.map((a,i) => hits[i] ? operation === 'destination-out' ? 0 : 255 : a); }
  const ctx: any = {
    lineWidth: 1,
    get globalCompositeOperation() { return operation; }, set globalCompositeOperation(v: string) { operation=v; },
    clearRect() { alpha.fill(0); }, fillRect() { paint(points.map(()=>true)); },
    beginPath() { paths=[]; current=[]; ellipse=null; },
    moveTo(x: number,y: number) { current=[[x+transform[0],y+transform[1]]]; paths.push(current); },
    lineTo(x: number,y: number) { current.push([x+transform[0],y+transform[1]]); },
    rect(x: number,y: number,w: number,h: number) { x+=transform[0]; y+=transform[1]; paths.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]); },
    ellipse(x: number,y: number,rx: number,ry: number) { ellipse=[x+transform[0],y+transform[1],rx,ry]; },
    closePath() { if(current.length) current.push(current[0]); },
    fill(rule?: string) { paint(points.map(p=>ellipse ? ((p[0]-ellipse[0])/ellipse[2])**2+((p[1]-ellipse[1])/ellipse[3])**2<1
      : rule==='evenodd' ? paths.reduce((n,r)=>n+Number(inside(p,r)),0)%2===1 : paths.some(r=>inside(p,r)))); },
    stroke() { paint(points.map(p=>paths.some(r=>r.slice(1).some((b,i)=>{
      const a=r[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<=ctx.lineWidth/2;
    })))); },
    save() { saved.push([[...transform],operation]); }, restore() { [transform,operation]=saved.pop()!; },
    translate(x: number,y: number) { transform=[transform[0]+x,transform[1]+y]; }, rotate() {},
  };
  return { width: 0,height: 0,getContext:()=>ctx, snapshot:()=>[...alpha] };
}

test('painted Whole removes zone photo strips and allows only saved canopy windows outside', async () => {
  const points: Point[] = [[150,120],[278,210],[295,210],[40,40],[150,30]];
  const canvas = probeCanvas(points);
  const scope: Record<string, unknown> = { SCALE: 3, ELEMENTS_BY_ID, itemInFilter,isContextElement,zonesInFilter,
    authoritativeHouseFootprints:()=>[],document:{createElement:()=>canvas},releaseCanvas:()=>{},
    drainCanvasToDataUrl:()=>canvas.snapshot() };
  scope.paintPlannedCanopyFootprints=helper('paintPlannedCanopyFootprints',scope);
  const build=helper('buildProtectMask',scope);
  const original=JSON.stringify(state);
  assert.deepEqual(await build(state,frame,refs,'all',hybridProtectionPolicy('all','precision_atlas',true)),[0,0,255,0,0]);
  assert.equal((await build(state,frame,refs,'zones',hybridProtectionPolicy('zones','precision_atlas',true)))[0],255,
    'dedicated Zones must retain its surveyed analysis outline');
  for(const filter of ['water','earthworks','planting','structures'] as const) {
    const result=await build(state,frame,refs,filter,hybridProtectionPolicy(filter,'precision_atlas',true));
    assert.equal(result[0],0,filter+' must not restore an effort-zone photo strip');
    assert.equal(result[2],255,filter+' must retain distant exterior');
  }
  assert.equal(JSON.stringify(state),original,'mask generation must not move trees or saved zones');
});

test('a plain-input building is visible to the model without painting over a photographed roof', () => {
  const saved={items:[],lines:[],zones:[]};
  const rings={boundary:[],house:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],driveway:[]};
  const before=JSON.stringify({saved,rings});
  const draw=helper('drawMarks',{RENDERED_DRIVEWAY_EDGE:false,
    glossyArtworkState,
    authoritativeHouseFootprints:()=>[rings.house],zoneBadgePositions:()=>new Map(),SCALE:3});
  for(const hasPhoto of [false,true]){
    const canvas=probeCanvas([[150,150]]);
    draw(canvas.getContext(),saved,{...frame,satDataUrl:hasPhoto?'photo':null},rings,300,300,'earthworks',false);
    assert.deepEqual(canvas.snapshot(),[hasPhoto?0:255],
      'white-on-white must not hide a paper roof, while an existing aerial keeps its own roof pixels');
  }
  assert.equal(JSON.stringify({saved,rings}),before);
});

test('a courtyard input reads as warm paving rather than another grey roof', () => {
  const saved={items:[],lines:[],zones:[{id:'patio',feature:'patio',points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]}]};
  const rings={boundary:[],house:[],driveway:[]};
  const before=JSON.stringify(saved),canvas=probeCanvas([[150,150]]),ctx:any=canvas.getContext();
  const fills:string[]=[];const fill=ctx.fill;ctx.fill=()=>{fills.push(ctx.fillStyle);fill();};
  helper('drawMarks',{glossyArtworkState,RENDERED_DRIVEWAY_EDGE:false,SCALE:3,authoritativeHouseFootprints,
    GROUND_FEATURES:{patio:{color:'#EEEEEE'}},zoneBadgePositions:()=>new Map()})(ctx,saved,{...frame,satDataUrl:null},rings,300,300,'water',false);
  assert.equal(fills.length,1);
  assert.match(fills[0],/^#[\dA-F]{6}$/i,'paving guide must be opaque, not a near-white wash');
  const [r,g,b]=fills[0].slice(1).match(/../g)!.map(c=>parseInt(c,16));
  assert.ok(r>g&&g>b,'courtyard must be visibly distinct from neutral-grey roof markers');
  fills.length=0;
  helper('drawMarks',{glossyArtworkState,RENDERED_DRIVEWAY_EDGE:false,SCALE:3,authoritativeHouseFootprints,
    GROUND_FEATURES:{patio:{color:'#EEEEEE'}},zoneBadgePositions:()=>new Map()})(ctx,saved,frame,rings,300,300,'water',false);
  assert.deepEqual(fills,['#EEEEEE33'],'a photo keeps its visible paving instead of receiving an opaque guide');
  assert.equal(JSON.stringify(saved),before);
});

test('boundary foreground includes tank tops and rectangular planting but respects each sheet', () => {
  const points:Point[]=[[100,70],[100,50],[190,100],[216,100],[20,20]];
  const canvas=probeCanvas(points);
  const paint=helper('paintPlannedCanopyFootprints',{ELEMENTS_BY_ID,itemInFilter,isContextElement});
  const plants={items:[{defId:'veg_bed',x:2/3,y:1/3,wM:10,hM:10}]};
  const tanks={items:[{defId:'jojo_5000',x:1/3,y:1/3,wM:10,hM:10}]};
  const before=JSON.stringify({plants,tanks});
  paint(canvas.getContext(),plants,frame,'planting',300,300);
  assert.deepEqual(canvas.snapshot(),[0,0,255,255,0],'rectangular plant leaves get a bounded halo');
  const ctx=canvas.getContext();ctx.clearRect();
  paint(ctx,tanks,frame,'water',300,300,'tanks');
  assert.deepEqual(canvas.snapshot(),[255,255,0,0,0],'tank tops project above their ground position');
  ctx.clearRect();paint(ctx,tanks,frame,'planting',300,300,'tanks');
  assert.deepEqual(canvas.snapshot(),[255,255,0,0,0],'existing tank artwork is physical context on Planting too');
  ctx.clearRect();paint(ctx,tanks,frame,'zones',300,300,'tanks');
  assert.deepEqual(canvas.snapshot(),[0,0,0,0,0],'Zones retains its outline-only contract');
  assert.equal(JSON.stringify({plants,tanks}),before,'presentation must not move or resize the saved objects');
});

test('tank colour selection is local and foliage expansion rejects disconnected neighbouring trees', () => {
  const w=15,h=7,art=new Uint8ClampedArray(w*h*4),plants=new Uint8ClampedArray(art.length);
  const tanks=new Uint8ClampedArray(art.length),seeds=new Uint8ClampedArray(art.length);
  const at=(x:number,y:number)=>(y*w+x)*4;
  for(let i=0;i<w*h;i++) art.set([160,100,45,255],i*4);
  for(let y=0;y<h;y++) for(let x=0;x<7;x++)plants[at(x,y)+3]=255;
  for(let x=1;x<=3;x++)art.set([70,130,50,255],at(x,3));
  seeds[at(1,3)+3]=255;
  art.set([55,130,50,255],at(6,0));
  art.set([40,105,115,255],at(11,3));tanks[at(11,3)+3]=255;
  art.set([140,170,150,255],at(11,4));tanks[at(11,4)+3]=255;
  for(let x=1;x<=3;x++) art.set([220,225,225,255],at(x,0));
  art.set([40,105,115,255],at(14,3));
  const alpha=canopyForegroundAlpha(art,plants,w,h,tanks,seeds);
  assert.equal(alpha[3*w+3],255,'connected crown can grow beyond its saved ground footprint');
  assert.equal(alpha[6],0,'a disconnected green neighbour must remain factual context');
  assert.equal(alpha[3*w+11],255,'teal plastic within a saved tank window survives');
  assert.equal(alpha[4*w+11],255,'sunlit tank lids must not acquire missing wedges');
  assert.equal(alpha[2],0,'pale model fence strokes must not return as ghost lines');
  assert.equal(alpha[3*w+14],0,'same colour away from a saved object stays protected');
  assert.equal(alpha[6*w+11],0,'brown ground never becomes a tank window');
  assert.throws(()=>canopyForegroundAlpha(art,plants,w,h,new Uint8ClampedArray(4)),/size mismatch/);
});

test('canopy foreground keeps leaves but rejects soil and never escapes the saved envelope', () => {
  const w=9,h=3, art=new Uint8ClampedArray(w*h*4), footprint=new Uint8ClampedArray(art.length);
  for(let i=0;i<w*h;i++){art.set([160,100,45,255],i*4);footprint.set([255,255,255,255],i*4);}
  art.set([62,148,61,255],(w+2)*4); art.set([30,130,30,255],(w+8)*4);
  footprint[(w+8)*4+3]=0;
  const alpha=canopyForegroundAlpha(art,footprint,w,h);
  assert.equal(alpha[w+2],255);
  assert.equal(alpha[w+5],0,'brown ground cannot make a circular exterior tile');
  assert.equal(alpha[w+8],0,'even foliage is factual exterior beyond the saved footprint');
  assert.ok(alpha[w+3]>0 && alpha[w+3]<255,'nearby fine branches have a soft edge');
  assert.throws(()=>canopyForegroundAlpha(art,footprint,2,2),/size mismatch/);
});

test('Photo Plan retains its source photograph or paper fallback rather than painting the exterior', () => {
  for(const [style,photo] of [['photo_plan',true],['photo_plan',false]] as const){
    const policy=hybridProtectionPolicy('all',style,photo);
    assert.equal(policy.allowCanopyOverhang,false); assert.equal(policy.protectOutside,true);
    assert.equal(policy.protectBoundary,true); assert.equal(policy.protectHouse,true); assert.equal(policy.protectUnmarkedGround,true);
  }
});

test('painted roofs have one appearance owner while photo and paper keep their structure passes', async () => {
  const calls:string[]=[];
  const build=helper('buildGeometryLockStructureOverlay',{
    geometryLockCompositionPolicy,
    buildLockedStructureOverlay:async()=>{calls.push('photo');return 'photo-roof';},
    buildPaintedStructureOverlay:async()=>{calls.push('paper');return 'paper-roof';},
  });
  assert.equal(await build('photo',state,frame,refs,300,300,'precision_atlas',false),undefined);
  assert.deepEqual(calls,[],'no extra grey roof over already painted AI material');
  assert.equal(await build('photo',state,frame,refs,300,300,'photo_plan',true),'photo-roof');
  assert.equal(await build(undefined,state,{...frame,satDataUrl:null},refs,300,300,'precision_atlas',false),undefined,
    'the new painted paper job owns its own roof, just like the photographic painted input');
  assert.equal(await build(undefined,state,{...frame,satDataUrl:null},refs,300,300,'photo_plan',false),'paper-roof');
  assert.deepEqual(calls,['photo','paper']);
});

test('completed jobs recover painted photo and paper interiors from the frozen scene without flat ground stamps', async () => {
  for(const engine of ['openai','gemini']) for(const hasPhoto of [true,false]) {
    const calls:unknown[][]=[];
    let badStoredMask=false;
    const renderFrame={...frame,satDataUrl:hasPhoto?'photo':null};
    const scene={state,frame:renderFrame,refLayers:refs,site:null,placeName:'Fictional test',labelMode:'onplant'};
    const frozen=JSON.stringify(scene);
    const finish=helper('finishStyledSheet',{
      glossyArtworkState,
      state,frame:renderFrame,refLayers:refs,site:null,placeName:scene.placeName,labelMode:'codes',SCALE:3,
      boundaryPresentationContext:async(...args:unknown[])=>{calls.push(['scene',...args]);return {state,frame:renderFrame,refLayers:refs};},
      isModelChromeStyle:()=>false,paidPolishNeedsChromePass:()=>false,
      GLOSSY_FILTERS:[],geometryLockCompositionPolicy,lockedProtectMaskOptions:hybridProtectionPolicy,
      loadImage:async(value:string)=>({width:300,height:value==='stored-mask'&&badStoredMask?200:300}),
      releaseImageSource:()=>{},assertMatchingImageAspects,
      buildProtectMask:async(...args:unknown[])=>{calls.push(['mask',...args]);return 'rebuilt-mask';},
      restoreProtectedPixels:async(...args:unknown[])=>{calls.push(['restore',...args]);return 'restored';},
      legacyPaperArtworkNeedsRoof,
      buildPaintedStructureOverlay:async(...args:unknown[])=>{calls.push(['legacy-roof',...args]);return 'paper-roof';},
      buildExactLayerOverlay:()=>{throw Error('flat ground must not cover paid painted artwork');},
      buildGeometryLockStructureOverlay:async()=>undefined,stackOverlayImages:async()=>undefined,
      compositeAccurateMap:async(options:any)=>{calls.push(['composite',options]);return 'composite';},burnPaintedBoundary:async()=> 'bounded',
      burnExactLabelLayer:async(map:string)=>({map}),
      composeStyleSheet:async(...args:unknown[])=>{calls.push(['chrome',...args]);return 'sheet';},
      REFERENCE_SHEET_LABEL:{all:'Whole',water:'Water'},waterReferenceFooterText:()=> 'Water notes',
    });
    assert.equal(await finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false),'sheet',engine);
    const restore=calls.find(c=>c[0]==='restore')!;
    assert.deepEqual(restore,['restore',hasPhoto?'photo':'input','model','rebuilt-mask']);
    const mask=calls.find(c=>c[0]==='mask')!;
    assert.equal(mask[1],state); assert.equal(mask[4],'all'); assert.equal(mask[6],'model');
    const chrome=calls.find(c=>c[0]==='chrome')!;
    assert.equal((chrome.at(-1) as {aiArtwork:boolean}).aiArtwork,true);
    assert.equal((chrome.at(-1) as {preserveLegacyPathGuides:boolean}).preserveLegacyPathGuides,true,
      'reassembly cannot claim to erase a guide already baked into old paid pixels');
    assert.equal(calls.filter(c=>c[0]==='legacy-roof').length,0,'new painted jobs keep the model roof');
    if(!hasPhoto){
      assert.equal(await finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false,'KEEP THE PAPER WHITE: original paid contract'),'sheet');
      const roof=calls.find(c=>c[0]==='legacy-roof')!;
      assert.equal(roof.at(-1),false,'old paper recovery restores only the missing exact roof, not a driveway/ground stamp');
    }
    assert.equal(JSON.stringify(scene),frozen,'free reassembly cannot change the saved design');
    calls.length=0;
    const reference={overlay:'factual-seven-section-roof',credit:'Roof reference: test imagery'};
    await finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false,'KEEP THE PAPER WHITE: original paid contract',reference);
    assert.equal(calls.filter(c=>c[0]==='legacy-roof').length,0,
      'an available factual roof must replace the generic two-pitch fallback');
    const roofChrome=calls.find(c=>c[0]==='chrome')!;
    assert.equal((roofChrome.at(-1) as {footerText:string}).footerText,hasPhoto?'':reference.credit,
      'only a roof actually used in the composition may claim the extra imagery credit');
    calls.length=0;
    await finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,
      scene,()=>false,'DRIVEWAY GUIDE OMITTED: duplicate editor trace');
    assert.equal((calls.find(c=>c[0]==='chrome')!.at(-1) as {preserveLegacyPathGuides:boolean}).preserveLegacyPathGuides,false,
      'only the durable new prompt tells recovery that the model input omitted the guide');
    calls.length=0;
    await finish('model','water',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,
      scene,()=>false,'new illustrated-property contract',reference);
    const waterComposite=calls.find(c=>c[0]==='composite')![1] as any;
    assert.equal(waterComposite.contextTreatment,hasPhoto?'precision_atlas':'original',
      'plain paper must not receive the photographic palette treatment');
    assert.equal(Boolean(waterComposite.focusBoundaryPx),hasPhoto,
      'the Water focus wash must not darken white paper or the paid property artwork');
    const waterChrome=calls.find(c=>c[0]==='chrome')!.at(-1) as any;
    assert.equal(waterChrome.footerText,'Water notes',
      'new completed roofs must not be replaced or credited as satellite patches');
    assert.equal(calls.filter(c=>c[0]==='legacy-roof').length,0);
    badStoredMask=true;
    await assert.rejects(()=>finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false),/mask aspect/);
  }
});

test('plain-paper recovery uses the frozen aerial roof and excludes proposed houses without changing the crop', async () => {
  const primary:Point[]=[[.2,.2],[.5,.2],[.5,.5],[.2,.5]];
  const proposed:Point[]=[[.6,.6],[.8,.6],[.8,.8],[.6,.8]];
  const saved={...state,zones:[{id:'new',feature:'house',status:'proposed',points:proposed}]};
  const snapshot={state:saved,frame:{...frame,satDataUrl:null},refLayers:{...refs,house:primary}};
  const frozen=JSON.stringify(snapshot),calls:unknown[][]=[];
  let unavailable=false;
  const build=helper('buildPaperRoofReference',{
    SCALE:3,statusOf,authoritativeHouseFootprints,sameFootprint,process:{env:{}},
    loadImage:async()=>({width:frame.imgW,height:frame.imgH}),releaseImageSource:()=>{},assertMatchingImageAspects,
    buildSatelliteUrl:(...args:unknown[])=>{calls.push(['url',...args]);return 'licensed-url';},
    fetchImageAsDataUrl:()=>{},fetchBasemapForFrame:async(...args:unknown[])=>{
      calls.push(['fetch',...args]);if(unavailable)throw Error('imagery unavailable');return 'frozen-frame-photo';},
    boundaryPresentationContext:async(s:any,f:any,r:any)=>{
      calls.push(['presentation',s,f,r]);return {state:s,frame:{...f,imgW:400,imgH:200},refLayers:r};},
    buildHouseOverlay:async(...args:unknown[])=>{calls.push(['roof',...args]);return 'roof-pixels';},
    basemapAttribution:()=> 'Imagery: licensed provider',
  });
  assert.deepEqual(await build(snapshot),{overlay:'roof-pixels',credit:'Roof reference from satellite imagery. Imagery: licensed provider'});
  assert.equal(calls.find(c=>c[0]==='fetch')![1],snapshot.frame,'use the immutable job frame, never the open design');
  assert.equal(calls.find(c=>c[0]==='presentation')![1],saved,'all saved features still determine the identical crop');
  const roof=calls.find(c=>c[0]==='roof')!;
  assert.equal(roof[1],'frozen-frame-photo');
  assert.deepEqual((roof[2] as any).zones,[],'proposed roofs cannot be replaced by old ground in satellite imagery');
  assert.deepEqual(roof.slice(4),[1200,600,'source'],'preserve real roof detail, without the charcoal veil');
  assert.equal(JSON.stringify(snapshot),frozen);
  calls.length=0;
  assert.equal(await build({...snapshot,frame:{...snapshot.frame,satDataUrl:'original-photo'}}),undefined);
  assert.deepEqual(calls,[],'an existing photo path keeps its original source contract');
  assert.equal(await build({...snapshot,refLayers:{...snapshot.refLayers,house:[]}}),undefined);
  assert.deepEqual(calls,[],'a proposed house alone is never a reason to fetch satellite roof pixels');
  const promoted={...snapshot,state:{...saved,zones:[{...saved.zones[0],points:primary}]}};
  assert.equal(await build(promoted),undefined,'a proposed polygon promoted into the primary trace stays proposed');
  unavailable=true;
  await assert.rejects(()=>build(snapshot),/imagery unavailable/,
    'failed imagery cannot be credited as an available factual roof; the caller retains the old fallback');
});

test('standalone paid exports cannot silently claim exact model-drawn counts', () => {
  assert.match(AI_MAP_REVIEW_NOTICE,/AI illustration/); assert.match(AI_MAP_REVIEW_NOTICE,/positions and counts/);
  assert.doesNotMatch(AI_MAP_REVIEW_NOTICE,/are exact|No unsaved/);
  const compose=source.slice(source.indexOf('async function composeStyleSheet('),source.indexOf('// real sheet in any case:'));
  assert.match(compose,/const footerText = options.aiArtwork/);
  assert.match(compose,/AI_MAP_REVIEW_NOTICE, options.footerText/,'review notice must survive Water notes');
  assert.doesNotMatch(compose,/and elements are exact/);
  assert.match(source,/sheetHasPlantCodes && sheetElementNaming\(filter\) === 'individual'/,
    'Whole must not promise individual labels its grouped renderer omits');
});

test('reassembling a saved paid map reconnects only its existing job and clears every paid handoff', () => {
  const item={jobId:'existing-paid-job',rawOutputPath:'existing-output',resultKind:'hybrid',provider:'openai'};
  function run(overrides: Record<string,unknown>={}) {
    const calls:unknown[][]=[];
    const refs=Object.fromEntries(['exactAfterFlipRef','hybridAfterExactRef','hybridAfterFlipRef','polishAfterHybridRef','polishAfterFlipRef','hybridResultRef'].map(k=>[k,{current:true}]));
    const scope:Record<string,unknown>={...refs,loading:null,queueJobId:null,gallerySiteId:'farm',state:{siteId:'farm'},isSampleMode:()=>false};
    for(const name of ['setHybridHandoffReady','setLockedPolishStage','setError','setResumeGaveUp','clearResumeAttempts','clearResumeGaveUp','persistJobId','closeGallery','setNotice','setLoading','setQueueJobId']) {
      scope[name]=(...args:unknown[])=>calls.push([name,...args]);
    }
    const store={setItem:(...args:unknown[])=>calls.push(['pointer',...args])};
    const persist=helper('persistJobId',{...scope,localStorage:store,queueJobKey:(site:string)=>'job:'+site});
    scope.persistJobId=(...args:unknown[])=>{calls.push(['persistJobId',...args]);persist(...args);};
    const callback=helper('reassembleSavedArtwork',{...scope,...overrides});
    callback(item);
    return {calls,refs};
  }
  const {calls,refs}=run();
  assert.deepEqual(calls.find(c=>c[0]==='persistJobId'),['persistJobId','farm','existing-paid-job']);
  assert.deepEqual(calls.find(c=>c[0]==='setQueueJobId'),['setQueueJobId','existing-paid-job']);
  for(const [key,value] of Object.entries(refs)) assert.equal(value.current,key==='hybridResultRef'?null:false,key);
  assert.ok(calls.some(c=>c[0]==='setLockedPolishStage' && c[1]===null));
  assert.ok(calls.some(c=>c[0]==='clearResumeAttempts' && c[2]==='farm'));
  for(const blocked of [{loading:'gemini'},{queueJobId:'running-job'},{gallerySiteId:'other-farm'},{isSampleMode:()=>true}]) {
    assert.deepEqual(run(blocked).calls,[],'must not replace an active job or cross site/sample boundaries');
  }
  const start=source.indexOf('  const reassembleSavedArtwork = useCallback(');
  const callback=source.slice(start,source.indexOf('  const handleStageDownload',start));
  assert.doesNotMatch(callback,/enqueueRenderJob|runCurrentSheet|runLockedPolishFlow|requestProducer|requestRender/,
    'a free reassembly can subscribe to the old job but must never buy another generation');
});
