import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { hybridProtectionPolicy, geometryLockCompositionPolicy, legacyPaperArtworkNeedsRoof, AI_MAP_REVIEW_NOTICE, recommendedSheetSettings } from '../lib/render-policy.ts';
import { PHASING_ARTWORK_PROMPT_MARKER, buildPhasingRestylePrompt } from '../lib/producer-prompt.ts';
import { UBHEJANE_BEFORE_WORKS, historicalBaselineForSite, historicalBaselineFromPrompt, historicalPhotoPoint, historicalPhotoTransform, historicalPhotoExtent, historicalBaselinePrompt } from '../lib/historical-map-baseline.ts';
import { createHash } from 'node:crypto';
import { sectorOverviewContours, sectorTerrainProfile, rasterTerrainProfile, rasterTerrainSections, fetchProfileTerrain } from '../lib/sheet-terrain-profile.ts';
import { terrainPixel, terrainRasterWindow, extractTerrainRaster, sampleTerrainRaster, type TerrainRaster } from '../lib/terrain-raster.ts';
import { makeMercatorUnprojector } from '../lib/design-canvas.ts';
import { sheetRenderRoute, DEFAULT_PRODUCER_STYLE } from '../lib/sheet-render-route.ts';
import { canopyForegroundAlpha, assertMatchingImageAspects } from '../lib/image-producer.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { itemInFilter, isContextElement, zonesInFilter, lineInFilter, exactSheetElementRegister, EXACT_CONTEXT_ALPHA } from '../lib/glossy-filters.ts';
import { statusOf } from '../lib/design-canvas.ts';
import { authoritativeHouseFootprints, sameFootprint } from '../lib/house-footprints.ts';
import polygonClipping from 'polygon-clipping';

// Execute the actual production helpers. A source-pattern test cannot see a photo strip or
// prove that a completed job's old mask is replaced. No private farm records or native dependency.
const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function helper(name: string, scope: Record<string, unknown>): any {
  scope = { exactSheetElementRegister, EXACT_CONTEXT_ALPHA, ...scope };
  let code = '';
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) code = n.getText(tree).replace(/^export\s+/, '');
    if (ts.isVariableDeclaration(n) && n.name.getText(tree) === name) {
      const call = n.initializer as ts.CallExpression;
      code = `const ${name} = ${ts.isArrowFunction(n.initializer!) ? n.initializer!.getText(tree) : call.arguments[0].getText(tree)};`;
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

test('switching maps applies recommendations once and remembers manual choices without queuing a render', () => {
  const sheets=[{no:'08',filter:'all'},{no:'05',filter:'earthworks'},{no:'04',filter:'water'},{no:'02',exact:'sector'}];
  const ui:any={selectedNo:'08',underlay:'photo',producerStyle:'master_atlas',labelMode:'onplant',aiView:'oblique'};
  const remembered={current:new Map()},state={siteId:'test-site'},frameProp={satDataUrl:'drone',underlayDataUrl:'satellite'};
  const setter=(key:string)=>(value:any)=>{ui[key]=typeof value==='function'?value(ui[key]):value;};
  const scope=()=>({...ui,state,frameProp,loading:null,sheetSettingsRef:remembered,DESIGN_SHEETS:sheets,recommendedSheetSettings,DEFAULT_PRODUCER_STYLE,sheetRenderRoute,
    historicalEnabled:true,historicalBaselineForSite,setUnderlay:setter('underlay'),setLabelMode:setter('labelMode'),setAiView:setter('aiView'),setProducerStyle:setter('producerStyle'),
    enqueueRenderJobCapped:()=>{throw Error('selection must never spend');}});
  const apply=()=>helper('applySheet',{...scope(),setSelectedNo:setter('selectedNo'),setExactSheet:setter('exactSheet'),setAnalysisStyle:setter('analysisStyle'),setFilter:setter('filter')});
  const choose=(sheet:any,mode='ai',loading:any=null)=>helper('chooseSheet',{...scope(),loading,applySheet:apply()})(sheet,mode);
  choose(sheets[1]);
  assert.deepEqual([ui.selectedNo,ui.underlay,ui.producerStyle,ui.labelMode,ui.aiView],['05','photo',DEFAULT_PRODUCER_STYLE,'codes','top-down']);
  Object.assign(ui,{underlay:'satellite',producerStyle:'homestead_storybook',labelMode:'names',aiView:'oblique'});
  choose(sheets[2]);
  assert.deepEqual([ui.selectedNo,ui.underlay,ui.producerStyle,ui.labelMode,ui.aiView],['04','photo',DEFAULT_PRODUCER_STYLE,'names','top-down']);
  choose(sheets[1]);
  assert.deepEqual([ui.underlay,ui.producerStyle,ui.labelMode,ui.aiView],['satellite','homestead_storybook','names','oblique']);
  ui.underlay='photo';choose(sheets[1]);
  assert.equal(ui.underlay,'photo','the current sheet and its exact/AI transitions must not reset a manual background');
  choose(sheets[3],'ai','busy');assert.equal(ui.selectedNo,'05','settings cannot change under an in-flight job');
  choose(sheets[0]);
  assert.deepEqual([ui.underlay,ui.producerStyle,ui.labelMode,ui.aiView],['photo','master_atlas','onplant','oblique']);
  assert.match(source,/if \(next\) chooseSheet\(next, mode\)/,'desktop dropdown must use the remembered-settings navigation');
  assert.match(source,/onClick=\{\(\) => chooseSheet\(sheet, mode\)\}/,'compact buttons must use the same navigation');
});

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

test('the AI Earthworks input uses the exact digging painter instead of green beds and blue routes at every scale', () => {
  const saved={items:[{id:'bed',defId:'veg_bed',x:.4,y:.5}],zones:[],lines:[]};
  const refs={boundary:[],house:[],driveway:[]};
  const frozen=JSON.stringify(saved);
  for(const scale of [1,2,3]) for(const photo of [true,false]) {
    const calls:Array<{kind:string,x:number,y:number,ppm:number}>=[];
    const draw=helper('drawMarks',{glossyArtworkState,RENDERED_DRIVEWAY_EDGE:false,SCALE:scale,authoritativeHouseFootprints,
      ELEMENTS_BY_ID,itemInFilter,lineInFilter,isShadeClothStructure:()=>false,
      zoneBadgePositions:()=>new Map(),drawFilteredLines:(_ctx:any,source:any,filter:string,px:any,py:any,ppm:number)=>{
        assert.equal(source,saved);assert.equal(filter,'earthworks');calls.push({kind:'swales',x:px(.4),y:py(.5),ppm});
      },drawEarthworksFeatures:(_ctx:any,source:any,filter:string,px:any,py:any,ppm:number)=>{
        assert.equal(source,saved);assert.equal(filter,'earthworks');calls.push({kind:'soil-and-pits',x:px(.4),y:py(.5),ppm});
      }});
    draw(probeCanvas([]).getContext(),saved,{...frame,satDataUrl:photo?'photo':null},refs,100*scale,100*scale,'earthworks',true,{showHouseMark:false,showDrivewayMark:false,showToolGlyphs:false});
    assert.deepEqual(calls,[{kind:'swales',x:40*scale,y:50*scale,ppm:scale},{kind:'soil-and-pits',x:40*scale,y:50*scale,ppm:scale}]);
  }
  assert.equal(JSON.stringify(saved),frozen);
});

test('Water, Zones and Structures show their saved planting context instead of asking the model to guess it', () => {
  const saved={items:[{id:'bed',defId:'veg_bed',x:.4,y:.5,wM:12,hM:2,rot:17}],zones:[],lines:[]};
  const refs={boundary:[],house:[],driveway:[]};
  const frozen=JSON.stringify(saved);
  const draw=helper('drawMarks',{glossyArtworkState,RENDERED_DRIVEWAY_EDGE:false,SCALE:2,authoritativeHouseFootprints,
    zoneBadgePositions:()=>new Map(),ELEMENTS_BY_ID,itemInFilter,lineInFilter});
  for(const [filter,alpha] of [['water',EXACT_CONTEXT_ALPHA.water],['zones',EXACT_CONTEXT_ALPHA.zones],['structures',EXACT_CONTEXT_ALPHA.structures]] as const) {
    const ctx:any=probeCanvas([]).getContext(),marks:unknown[]=[];
    ctx.fillRect=(...rect:number[])=>marks.push({rect,alpha:ctx.globalAlpha});ctx.strokeRect=()=>{};ctx.rotate=()=>{};
    draw(ctx,saved,frame,refs,200,200,filter,true,{showHouseMark:false,showDrivewayMark:false,showToolGlyphs:false});
    assert.deepEqual(marks,[{rect:[-12,-2,24,4],alpha}],`${filter} keeps the same bed as subordinate context`);
  }
  assert.equal(JSON.stringify(saved),frozen);
});

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
  assert.equal((await build(state,frame,refs,'zones',hybridProtectionPolicy('zones','precision_atlas',true)))[0],0,
    'painted Zones must not restore photograph strips through the artwork; its exact regions are burned afterwards');
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
      glossyArtworkState,buildRecordedShadeCoverOverlay:()=>undefined,
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

// These checks execute the actual painters. They fail when post-processing hides a paid
// illustration, even if the provider returned a visibly different picture.
function artProbe() {
  const calls: any[] = [];
  const ctx: any = new Proxy({}, {
    get: (target:any,key) => key in target ? target[key] : (...args:any[]) => { calls.push([key,...args]); },
    set: (target:any,key,value) => { calls.push(['set',key,value]); target[key]=value; return true; },
  });
  const canvas={width:0,height:0,getContext:()=>ctx};
  return {ctx,canvas,calls};
}

test('Sector keeps paid colour and contrast while exact analysis still uses its quiet factual base', async () => {
  const probe=artProbe(),p={state:{items:[],lines:[],zones:[]},frame:{imgW:100,imgH:120,mPerPx:1,satDataUrl:'photo'},
    refLayers:{boundary:[],house:[],driveway:[]}};
  let quiet=0,options:any;
  const compose=helper('composeSectorSheet',{
    SCALE:1,document:{createElement:()=>probe.canvas},boundaryPresentationContext:async()=>p,
    fetchSectorPresentationContours:async()=>({lines:[]}),loadImage:async(src:string)=>({src}),
    drawPaperWash:()=>{throw Error('a paid illustration must not receive the photo veil');},
    drawAnalysisBase:async()=>{quiet++;},authoritativeHouseFootprints:()=>[],drawBlueprintBoundary:()=>{},
    BOUNDARY_LINE_GREEN:'#95B34F',
    drawSectorAnalysis:()=>({rows:[{color:'#95B34F',label:'Site boundary',style:'line'}],contextLabel:'Evidence',noteText:'Real analysis'}),
    drainCanvasToDataUrl:()=> 'map-art',composeStyleSheet:async(...args:any[])=>{options=args.at(-1);return 'sheet';},
  });
  await compose('painted-result',p.state,p.frame,p.refLayers,null,'Fictional');
  assert.ok(probe.calls.some(c=>c[0]==='drawImage'&&c[1].src==='painted-result'));
  assert.ok(!probe.calls.some(c=>c[0]==='set'&&c[1]==='filter'),'AI materials must not be desaturated again');
  assert.equal(options.aiArtwork,true,'the download must disclose AI artwork');
  assert.equal(options.legendRows[0].lineKind,'fence','the key must match the green survey boundary rather than a beige pipe');
  await compose(null,p.state,p.frame,p.refLayers,null,'Fictional');
  assert.equal(quiet,1,'the exact renderer still owns its factual base');
  assert.equal(options.aiArtwork,false);
});

test('new Phasing artwork keeps model materials, exact phase positions and the saved source unchanged', async () => {
  const probe=artProbe(),saved={items:[{id:'tree',x:.25,y:.7}],lines:[],zones:[]};
  const refs={house:[],driveway:[],boundary:[[0,0],[1,0],[1,1],[0,1]]};
  const before=JSON.stringify({saved,refs}),plan={phases:[{n:1,key:'setout',colour:'#aaa',itemIds:['tree']}]};
  let overlays=0,boundaries=0;
  const draw=helper('drawPhasingExactContent',{
    buildExactLayerOverlay:async()=>{overlays++;return undefined;},drawBlueprintHouse:()=>{},drawBlueprintDriveway:()=>{},
    drawBlueprintBoundary:()=>{boundaries++;},readableTextOn:()=> '#000',SHEET_BODY_FONT:'Arial',
  });
  await draw(probe.ctx,saved,{imgW:100,imgH:100,mPerPx:1},refs,plan,100,100,true);
  assert.equal(overlays,0,'SVG beds and trees must not cover the new painted materials');
  assert.equal(boundaries,1,'the measured boundary remains app-owned');
  assert.ok(probe.calls.some(c=>c[0]==='arc'&&c[1]===25&&c[2]===70),'phase pin must keep its saved centroid');
  assert.ok(probe.calls.some(c=>c[0]==='fillText'&&c[1]==='1'));
  await draw(probe.ctx,saved,{imgW:100,imgH:100,mPerPx:1},refs,plan,100,100,false);
  assert.equal(overlays,2,'the exact/legacy drawing still restores its ground and feature layers');
  assert.equal(JSON.stringify({saved,refs}),before);
});

test('Phasing model input contains unlettered feature guides and no phase pins or schedule facts', async () => {
  const probe=artProbe(),p={state:{items:[],lines:[],zones:[]},frame:{},refLayers:{}};
  let guideArgs:any[],blanked=false;
  const build=helper('buildPhasingHybridInput',{
    boundaryPresentationContext:async()=>p,phasingSheetSize:()=>({W:150,H:120,mapW:100,mapH:120}),
    buildComposite:async(...args:any[])=>{guideArgs=args;return 'feature-guides';},polishModelInputMarks:()=>({showToolGlyphs:false}),
    document:{createElement:()=>probe.canvas},phasingPanelRect:()=>({mapX:0}),loadImage:async(src:string)=>({src}),
    releaseImageSource:()=>{},drainCanvasToDataUrl:()=> 'blank-sheet-with-map',
    blankPhasingPanel:async(value:string)=>{blanked=true;return value;},
    buildImplementationMap:()=>{throw Error('schedule and numbered pins must never be copied into the model input');},
  });
  assert.equal(await build(p.state,p.frame,p.refLayers,null),'blank-sheet-with-map');
  assert.deepEqual(guideArgs!.slice(3),['all',true,{showToolGlyphs:false}]);
  assert.equal(blanked,true,'the separate panel erasure defence remains');
});

test('AI defaults preserve aerial evidence after plain Phasing invented a courtyard roof, while manual paper still wins', () => {
  for(const style of ['precision_atlas','field_ledger','extension_blueprint'] as const) {
    for(const sheet of ['base','sector','zones','water','earthworks','planting','structures','all','implementation'] as const) {
      assert.equal(recommendedSheetSettings(sheet,{satDataUrl:'aerial'},style).underlay,'satellite');
      assert.equal(recommendedSheetSettings(sheet,{satDataUrl:'own-aerial',underlayDataUrl:'satellite'},style).underlay,'photo');
      assert.equal(recommendedSheetSettings(sheet,{satDataUrl:null},style).underlay,'plain','without evidence no photo may be invented');
    }
    assert.equal(recommendedSheetSettings('zones',{satDataUrl:'aerial'},style,'exact').underlay,'plain',
      'the no-AI numbered zone drawing still benefits from clean paper');
  }
  const current:any={underlay:'photo',style:null};
  const manualUnderlaysRef={current:new Set<string>()};
  const scope:any={selectedSheet:{no:'07',filter:'structures'},loading:null,aiView:'top-down',state:{siteId:'test'},frameProp:{satDataUrl:'aerial'},
    manualUnderlaysRef,recommendedSheetSettings,sheetRenderRoute,DEFAULT_PRODUCER_STYLE,
    setUnderlay:(v:string)=>current.underlay=v,setProducerStyle:(v:string)=>current.style=v,setAnalysisStyle:()=>{},setExactSheet:()=>{},setResultImage:()=>{},
    enqueueRenderJobCapped:()=>{throw Error('a style change must not spend');}};
  helper('chooseStyle',scope)('field_ledger');assert.equal(current.underlay,'satellite');
  current.underlay='plain';manualUnderlaysRef.current.add('test:07');
  helper('chooseStyle',scope)('extension_blueprint');assert.equal(current.underlay,'plain','manual white-paper choice survives style changes');
});


test('Sector restoration preserves roofs and access without bringing effort-zone photo seams back', async () => {
  const probes: Point[] = [[150,75],[15,15],[75,150],[225,150]];
  const canvas=probeCanvas(probes);
  const saved={items:[],lines:[],zones:[{zone:1,points:[[.2,.25],[.8,.25],[.8,.8],[.2,.8]]}]};
  const rings={boundary:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],house:[[.2,.4],[.3,.4],[.3,.6],[.2,.6]],driveway:[[.7,.4],[.8,.4],[.8,.6],[.7,.6]],drivewayClosed:true};
  const before=JSON.stringify({saved,rings});
  const build=helper('buildProtectMask',{SCALE:3,zonesInFilter,authoritativeHouseFootprints,
    document:{createElement:()=>canvas},releaseCanvas:()=>{},drainCanvasToDataUrl:()=>canvas.snapshot()});
  const options=helper('sectorProtectMaskOptions',{})();
  assert.deepEqual(await build(saved,frame,rings,'all',options),[0,0,255,255],
    'the AI can paint both sides of an effort-zone edge and the exterior while recorded roofs/access remain factual');
  assert.equal(JSON.stringify({saved,rings}),before);
});

test('Phasing recovery uses the frozen artwork contract instead of changing old paid copies', async () => {
  const calls:any[]=[];
  const finish=helper('finishPhasingSheet',{PRODUCER_STYLES:[{key:'field_ledger',label:'Field Ledger'}],PHASING_ARTWORK_PROMPT_MARKER,composePhasingSheet:(...args:any[])=>{calls.push(args);return Promise.resolve('sheet');}});
  const snapshot={state:{},frame:{},refLayers:{},site:{},placeName:'Test'};
  for(const prompt of ['old job',buildPhasingRestylePrompt('precision_atlas'),PHASING_ARTWORK_PROMPT_MARKER+'. polish']) {
    await finish('art',snapshot,prompt,'field_ledger');
  }
  assert.deepEqual(calls.map(args=>args[7]),['Field Ledger','Field Ledger','Field Ledger'],'credit must name the selected style, never a hard-coded Reference Blueprint');
  assert.deepEqual(calls.map(args=>args[6]),[false,true,true],
    'both new stages retain painted materials, legacy jobs retain the original symbol contract');
});


test('Phasing paper styles retain a white page while illustrated property styles can paint inside it', () => {
  const paper=buildPhasingRestylePrompt('photo_plan','Test','Saved footprints','paper');
  assert.match(paper,/WHITE PAPER FINISH/);assert.match(paper,/All space between and beyond features stays pure white/);
  assert.doesNotMatch(paper,/PHOTOGRAPHIC FINISH|existing ground and already-marked/);
  const painted=buildPhasingRestylePrompt('field_ledger','Test','Saved footprints','paper');
  assert.match(painted,/ILLUSTRATED PROPERTY/);assert.match(painted,/surrounding page pure white/);
  const photo=buildPhasingRestylePrompt('photo_plan','Test','Saved footprints','photo');
  assert.match(photo,/PHOTOGRAPHIC FINISH/);assert.doesNotMatch(photo,/WHITE PAPER FINISH/);
});

test('Site keeps paid painted roofs visible while Photo Plan retains its factual source materials', async () => {
  const probe=artProbe();let ground=0,source=0,items=0,options:any;
  const structure=helper('buildGeometryLockStructureOverlay',{geometryLockCompositionPolicy,
    buildLockedStructureOverlay:async()=>{source++;return 'source-roofs';},buildPaintedStructureOverlay:async()=> 'paper-roofs'});
  const snapshot={state:{items:[],lines:[],zones:[]},frame:{imgW:100,imgH:120,mPerPx:1,satDataUrl:'photo'},
    refLayers:{boundary:[],house:[],driveway:[]},site:null,placeName:'Fictional'};
  const finish=helper('finishSiteSheet',{SCALE:1,geometryLockCompositionPolicy,buildGeometryLockStructureOverlay:structure,
    boundaryPresentationContext:async()=>snapshot,document:{createElement:()=>probe.canvas},loadImage:async(src:string)=>({src}),
    buildExactLayerOverlay:async()=>{ground++;return 'ground';},drawBlueprintBoundary:()=>{},drawExistingSiteItems:()=>{items++;},
    existingSiteGroundRings:()=>[],existingSiteItemRows:()=>[],groundLabelsForSheet:()=>[],drawBlueprintLabelPills:()=>{},
    existingSiteGroundLegendGroups:()=>[],PRODUCER_STYLES:[],drainCanvasToDataUrl:()=> 'map-art',
    composeStyleSheet:async(...args:any[])=>{options=args.at(-1);return 'sheet';}});
  await finish('paid-art','precision_atlas',snapshot);
  assert.deepEqual([ground,source,items],[0,0,0],'painted roofs and ground must not be covered by exact symbols or photo patches');
  assert.equal(options.aiArtwork,true,'AI Site must never say Exact Plan in its footer');
  await finish('paid-art','photo_plan',snapshot);
  assert.deepEqual([ground,source,items],[1,1,1],'Photo Plan must preserve its distinct factual photograph contract');
});


test('the historical baseline is the byte-identical approved archive image and never attaches to a schematic sample', () => {
  const b=UBHEJANE_BEFORE_WORKS;
  const bytes=readFileSync(new URL('../public'+b.image,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),b.sha256,'preserve the approved extraction, do not replace it with AI artwork');
  assert.equal(historicalBaselineForSite(b.siteId),b);
  for(const id of ['site:-27.72623,31.96304','demo-place-ubhejane','other-farm'])assert.equal(historicalBaselineForSite(id),null);
  assert.equal(historicalBaselineFromPrompt('old paid job'),null,'past completed artwork cannot silently receive a new historical source');
  assert.equal(historicalBaselineFromPrompt(historicalBaselinePrompt()),b);
  assert.match(b.provenance,/capture date is unverified/);assert.match(b.alignment,/not a survey/);
});

test('classroom control points align at both quality scales without moving any saved coordinate', () => {
  const b=UBHEJANE_BEFORE_WORKS,f={...b.referenceFrame,satDataUrl:'current-photo'};
  const frozen=JSON.stringify(f);
  for(const scale of [2,3]) {
    const [a,bb,c,d,e,ff]=historicalPhotoTransform(f,scale);
    for(const point of b.controls) {
      const actual=[a*point.source[0]+c*point.source[1]+e,bb*point.source[0]+d*point.source[1]+ff];
      const expected=point.target.map(v=>v*scale/3);
      assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<5*scale/3,
        'a mirrored, transposed or differently-scaled source must fail the real landmark check');
    }
  }
  assert.equal(JSON.stringify(f),frozen);
});

test('historical coverage leaves both unphotographed tips protected instead of extending invented terrain', async () => {
  const b=UBHEJANE_BEFORE_WORKS,f={...b.referenceFrame,satDataUrl:'historical-photo'};
  const roof=historicalPhotoPoint(f,b.features[0].point),tips:Point[]=[[.5963126359966395,.32016613775290137],[.38536477725973095,.690637586082968]];
  const points=[roof,...tips].map(([x,y])=>[x*f.imgW*3,y*f.imgH*3] as Point),canvas=probeCanvas(points);
  const build=helper('buildHistoricalCoverageMask',{SCALE:3,historicalPhotoExtent,document:{createElement:()=>canvas},releaseCanvas:()=>{},drainCanvasToDataUrl:()=>canvas.snapshot()});
  assert.deepEqual(await build(f,b),[0,255,255],'the classrooms are editable; the northeast and southwest missing areas stay factual white');
  assert.match(historicalBaselinePrompt(),/Add no later vegetable beds, swales, food forest, insectary/);
  assert.match(historicalBaselinePrompt(),/never extend or invent the landscape/);
});

test('preparing the historical photo is cached presentation work and leaves the proposed design source intact', async () => {
  const b=UBHEJANE_BEFORE_WORKS,f={...b.referenceFrame,satDataUrl:'current-garden'},before=JSON.stringify(f),probe=artProbe();let reads=0;
  const build=helper('buildHistoricalBaselineFrame',{historicalFrameCache:new WeakMap(),SCALE:3,historicalPhotoTransform,
    loadImage:async(src:string)=>{reads++;assert.equal(src,b.image);return {src};},document:{createElement:()=>probe.canvas},
    releaseCanvas:()=>{},releaseImageSource:()=>{},drainCanvasToDataUrl:()=> 'historic-registered'});
  const first=await build(f,b),second=await build(f,b);
  assert.equal(first,second);assert.equal(reads,1);
  assert.equal(first.satDataUrl,'historic-registered');assert.equal(f.satDataUrl,'current-garden');assert.equal(JSON.stringify(f),before);
});

test('historical photo markers follow the photograph crop instead of projecting against resized frame metadata', () => {
  const b=UBHEJANE_BEFORE_WORKS,f={...b.referenceFrame,satDataUrl:'archive'},state={items:[],lines:[],zones:[]},refs={boundary:[[.3,.3],[.7,.3],[.7,.8],[.3,.8]]};
  const point=helper('historicalPresentationPhotoPoint',{SCALE:3,historicalPhotoPoint,
    presentationExtentRing:()=>refs.boundary,calculateBoundaryPresentationLayout:()=>({cropX:.25,cropY:.2,cropWidth:.5,cropHeight:.6})});
  for(const feature of b.features){const [x,y]=historicalPhotoPoint(f,feature.point,b);assert.deepEqual(point(state,f,refs,feature.point,b),[(x-.25)/.5,(y-.2)/.6]);}
});

test('historical photo inventory and map use the same eight numbered landmarks without covering them with long plaques', () => {
  const probe=artProbe(),pins:any[]=[];
  const draw=helper('drawHistoricalPhotoFacts',{historicalPresentationPhotoPoint:(_s:any,_f:any,_r:any,p:any)=>p,
    drawHistoricalPhotoPin:(...args:any[])=>pins.push(args)});
  const b={features:UBHEJANE_BEFORE_WORKS.features.map((v,i)=>({...v,point:[i/10,i/20]})),fence:[[0,0],[1,1]]};
  draw(probe.ctx,{}, {},{},100,200,b);assert.deepEqual(pins.map(v=>[v[1],v[2],v[4]]),b.features.map((v,i)=>[v.point[0]*100,v.point[1]*200,i+1]));
  assert.equal(probe.calls.filter(v=>v[0]==='fillText').length,0,'the compositor must not add long overlapping feature names');
  draw(probe.ctx,{},{},{},100,200,b,false);assert.equal(pins.length,8,'Sector analysis does not duplicate the Site inventory');
});

test('the paid historical coverage mask uses the same crop as photo annotations', async () => {
  const canvas=probeCanvas([[25,50],[150,150],[275,250]]),source={state:{},frame:{},refLayers:{}};let calls=0;
  const build=helper('buildHistoricalCoverageMask',{SCALE:3,document:{createElement:()=>canvas},releaseCanvas:()=>{},
    drainCanvasToDataUrl:()=>canvas.snapshot(),historicalPhotoExtent:()=>{throw Error('a cropped frame is not a geographic source');},
    historicalPresentationPhotoPoint:(s:any,f:any,r:any,p:any)=>{assert.equal(s,source.state);assert.equal(f,source.frame);assert.equal(r,source.refLayers);calls++;return[p[0]/4000*.4+.3,p[1]/3000*.4+.3];}});
  assert.deepEqual(await build({imgW:100,imgH:100},UBHEJANE_BEFORE_WORKS,source),[255,0,255]);assert.equal(calls,4);
});

test('named historical areas have readable leader labels and keep the photo facts and geometry unchanged', () => {
  const probe=artProbe(),b=UBHEJANE_BEFORE_WORKS,before=JSON.stringify(b);let pins=0;probe.ctx.measureText=(text:string)=>({width:text.length*20});
  const draw=helper('drawHistoricalPhotoFacts',{SHEET_BODY_FONT:'Arial',historicalPresentationPhotoPoint:(_s:any,_f:any,_r:any,p:any)=>[p[0]/4000,p[1]/3000],drawHistoricalPhotoPin:()=>{pins++;}});
  draw(probe.ctx,{},{},{},1200,1000,b,true,true);
  const text=probe.calls.filter(v=>v[0]==='fillText').map(v=>v[1]);assert.deepEqual(text,['Classroom 1','Classroom 2','Bare slab','Play area','Toilet','Water tank','Dirt road','Fence']);
  assert.equal(pins,0,'names must not leave misleading number-only pins behind');
  assert.equal(probe.calls.filter(v=>v[0]==='strokeRect').length,8,'every name has a light backing, not lettering lost against grass');
  assert.equal(JSON.stringify(b),before,'moving label placement cannot move source facts');
});

test('regional Sector overview does not advertise fine encoded height steps as ground accuracy', () => {
  const raw:any={status:'ok',source:'mapbox-terrain-rgb',intervalM:1,tooFlat:false,lines:[101,102,105,110].map(elevM=>({elevM,points:[[0,.2],[1,.2]],major:false}))},before=JSON.stringify(raw);
  const overview=sectorOverviewContours(raw);assert.equal(overview.intervalM,5);assert.deepEqual(overview.lines.map(line=>line.elevM),[105,110]);assert.equal(JSON.stringify(raw),before);
  assert.equal(sectorOverviewContours({...raw,intervalM:0}).status,'unavailable');
  assert.equal(sectorOverviewContours({...raw,lines:raw.lines.slice(0,2)}).status,'too-flat');
});

test('regional profile plots actual contour crossings and never invents north or south endpoint heights', () => {
  const result:any={status:'ok',source:'mapbox-terrain-rgb',intervalM:5,lines:[{elevM:110,points:[[0,.25],[1,.25]]},{elevM:105,points:[[0,.75],[1,.75]]}]};
  const boundary:any=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],frame={imgW:100,imgH:100,mPerPx:2},before=JSON.stringify({result,boundary,frame});
  const p=sectorTerrainProfile(result,boundary,frame)!;assert.deepEqual(p.a,[.5,.1]);assert.deepEqual(p.b,[.5,.9]);assert.equal(p.lengthM,160);
  assert.deepEqual(p.points,[{distanceM:30,elevationM:110},{distanceM:130,elevationM:105}]);assert.equal(JSON.stringify({result,boundary,frame}),before);
  assert.equal(sectorTerrainProfile({...result,lines:result.lines.slice(0,1)},boundary,frame),null,'a lone level cannot describe a hillside');
  assert.equal(sectorTerrainProfile({...result,source:null},boundary,frame),null);
});

test('Sector contour geography uses the original saved frame and only crops the paint coordinates', async () => {
  const frame={imgW:960,imgH:640,mPerPx:.24},refs={boundary:[[.3,.3],[.7,.3],[.7,.8],[.3,.8]]},state={items:[],lines:[],zones:[]};let queried=false;
  const run=helper('fetchSectorPresentationContours',{SCALE:3,sectorOverviewContours,presentationExtentRing:()=>refs.boundary,
    calculateBoundaryPresentationLayout:()=>({cropX:.2,cropY:.1,cropWidth:.5,cropHeight:.6}),paidApiHeaders:async()=>({Authorization:'owner'}),
    fetchSheetContours:async(f:any,b:any)=>{assert.equal(f,frame);assert.equal(b,refs.boundary);queried=true;return{status:'ok',source:'mapbox-terrain-rgb',intervalM:1,lines:[{elevM:105,points:[[.3,.4],[.6,.7]]}]};}});
  const out=await run(state,frame,refs,null);assert.equal(queried,true);assert.equal(out.intervalM,5);assert.deepEqual(out.lines[0].points,[[.19999999999999996,.5000000000000001],[.7999999999999999,1]]);
});

test('Structures recovery adds only recorded permeable shade covers while retaining painted beds and saved dimensions', () => {
  const probe=artProbe(),symbols:any[]=[];let allocated=0;
  const state={items:[{id:'net',defId:'shade_house',x:.3,y:.4,wM:10,hM:15,rot:4},{id:'bed',defId:'raised_bed',x:.3,y:.4}],zones:[],lines:[]};
  const before=JSON.stringify(state),draw=helper('buildRecordedShadeCoverOverlay',{ELEMENTS_BY_ID:{shade_house:{id:'shade_house',wM:3,hM:3}},SHADE_CLOTH_ALPHA:.5,
    isShadeClothStructure:(id:string)=>id==='shade_house',document:{createElement:()=>{allocated++;return probe.canvas;}},releaseCanvas:()=>{},drainCanvasToDataUrl:()=> 'net-only',
    drawCartographicStructureSymbol:(...args:any[])=>symbols.push(args)});
  assert.equal(draw(state,{imgW:100,mPerPx:1},'planting',300,300),undefined);assert.equal(allocated,0);
  assert.equal(draw({...state,items:[]},{imgW:100,mPerPx:1},'structures',300,300),undefined);assert.equal(allocated,0);
  assert.equal(draw(state,{imgW:100,mPerPx:1},'structures',300,300),'net-only');assert.equal(symbols.length,1);assert.deepEqual(symbols[0].slice(2,4),[30,45]);
  assert.ok(probe.calls.some(v=>v[0]==='set'&&v[1]==='globalAlpha'&&v[2]===.5),'beds must remain visible through the net');
  assert.ok(probe.calls.some(v=>v[0]==='rotate'&&v[1]===4*Math.PI/180));assert.equal(JSON.stringify(state),before);
});


test('raw terrain sampling honours pixel centres and retains a real raster peak instead of fitting a straight slope',()=>{
  const size=256*2**14;
  const lon=(x:number)=>x/size*360-180,lat=(y:number)=>180/Math.PI*Math.atan(Math.sinh(Math.PI-2*Math.PI*y/size));
  const r:TerrainRaster={source:'mapbox.terrain-rgb',zoom:14,tileSize:256,originX:100,originY:100,width:3,height:3,elevations:[0,0,0,0,12,0,0,0,0],verticalDatum:'mixed-unverified'};
  const peak=sampleTerrainRaster(r,lon(101.5),lat(101.5))!;assert.ok(Math.abs(peak.elevationM-12)<1e-6);
  assert.ok(Math.abs(sampleTerrainRaster(r,lon(101),lat(101))!.elevationM-3)<1e-6,'a half pixel shift must be visible');
  assert.equal(sampleTerrainRaster(r,lon(99),lat(100)),null,'outside coverage is unknown, never zero metres');
  assert.equal(terrainRasterWindow(-180,-86,180,86),null);assert.equal(terrainRasterWindow(30,-28,31,-27),null,'raw payload has its own strict pixel budget');
  assert.equal(extractTerrainRaster([[1]],0,0,{originX:0,originY:0,width:2,height:2}),null);
});

test('sampled section crosses both saved classrooms, plots actual varying raster values and preserves plan geometry',()=>{
  const frame:any={centerLng:31.96317,centerLat:-27.72619,zoom:18,imgW:200,imgH:200,mPerPx:.5};
  const unproject=makeMercatorUnprojector(frame.centerLng,frame.centerLat,frame.zoom,frame.imgW,frame.imgH);
  const boundary:Point[]=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],ll=boundary.map(unproject),window=terrainRasterWindow(Math.min(...ll.map(p=>p[0])),Math.min(...ll.map(p=>p[1])),Math.max(...ll.map(p=>p[0])),Math.max(...ll.map(p=>p[1])))!;
  const r:TerrainRaster={source:'mapbox.terrain-rgb',zoom:14,tileSize:256,...window,elevations:Array.from({length:window.width*window.height},(_,i)=>300+(i%window.width)**2),verticalDatum:'mixed-unverified'};
  const buildings=[{label:'Classroom 1',ring:[[.25,.4],[.35,.4],[.35,.6],[.25,.6]] as Point[]},{label:'Classroom 2',ring:[[.65,.4],[.75,.4],[.75,.6],[.65,.6]] as Point[]}];
  const before=JSON.stringify({frame,boundary,buildings,r}),p=rasterTerrainProfile(r,boundary,buildings,frame)!;
  assert.ok(p);assert.ok(Math.abs(p.lengthM-80)<1e-8);assert.equal(p.buildings.length,2);
  assert.ok(Math.abs(p.buildings[0].startM-15)<1e-8);assert.ok(Math.abs(p.buildings[0].endM-25)<1e-8);
  assert.ok(Math.abs(p.buildings[1].startM-55)<1e-8);assert.ok(Math.abs(p.buildings[1].endM-65)<1e-8);
  assert.ok(p.points.length>30);assert.ok(p.supportingPixelCount<p.points.length,'interpolation is not independent samples');
  const mid=p.points[Math.floor(p.points.length/2)];assert.ok(Math.abs(mid.elevationM-(p.points[0].elevationM+p.points.at(-1)!.elevationM)/2)>.01,'real nonlinearity must survive');
  assert.equal(JSON.stringify({frame,boundary,buildings,r}),before);
  assert.equal(rasterTerrainProfile({...r,elevations:[]},boundary,buildings,frame),null);
});

test('profile fetch requests original-frame posted pixels and rejects contour-only or incomplete responses',async()=>{
  const f:any={centerLng:31.9,centerLat:-27.7,zoom:18,imgW:960,imgH:640,mPerPx:.24},b:Point[]=[[.3,.3],[.7,.3],[.7,.7],[.3,.7]];
  let requested='';assert.equal(await fetchProfileTerrain(f,b,async url=>{requested=url;return{ok:true,json:async()=>({type:'FeatureCollection',features:[]})};}),null);
  const params=new URL(requested,'https://example.test').searchParams,unproject=makeMercatorUnprojector(f.centerLng,f.centerLat,f.zoom,f.imgW,f.imgH);
  assert.equal(params.get('terrain'),'pixels');assert.equal(Number(params.get('minLon')),unproject(b[0])[0]);
  assert.equal(await fetchProfileTerrain(f,b,async()=>({ok:false,json:async()=>{throw Error('must not parse failure');}})),null);
  const route=readFileSync(new URL('../app/api/contours/route.ts',import.meta.url),'utf8');
  assert.ok(route.indexOf("guardPaidApiRequest(req, 'contours')")<route.indexOf('CACHE.get(cacheKey)'),'raw pixels share the existing authenticated gate before any cache read');
  assert.match(route,/pixels:\$\{rasterWindow.originX\},\$\{rasterWindow.originY\},\$\{rasterWindow.width\},\$\{rasterWindow.height\}/,'raster cache identity must include the actual returned window');
});


test('profile raster uses the supported unbuffered tileset and refuses unexpected tile dimensions',async()=>{
  const route=readFileSync(new URL('../app/api/contours/route.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('route.ts',route,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='fetchTileElevations')!;
  const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let requested='',width=256;const data=new Uint8Array(256*256*4);for(let i=0;i<data.length;i+=4){data[i]=1;data[i+1]=150;data[i+2]=160;data[i+3]=255;}
  const get=new Function('fetch','PNG','TILE_SIZE','Buffer',js+';return fetchTileElevations;')(async(url:string)=>{requested=url;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};},{sync:{read:()=>({width,height:256,data})}},256,Buffer);
  const rows=await get(14,9646,9506,'fixture-token',true);assert.match(requested,/\/mapbox\.terrain-rgb\/14\/9646\/9506\.pngraw/);assert.ok(rows?.length===256);assert.ok(Math.abs(rows[0][0]-409.6)<1e-6);
  width=258;assert.equal(await get(14,9646,9506,'fixture-token',true),null,'SDK buffered pixels cannot masquerade as a 256-pixel georeferenced tile');
});


test('main section follows the property-wide downhill fit separately from the two-classroom cut',()=>{
  const frame:any={centerLng:31.96317,centerLat:-27.72619,zoom:18,imgW:200,imgH:200,mPerPx:.5};
  const b:Point[]=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],ll=b.map(makeMercatorUnprojector(frame.centerLng,frame.centerLat,frame.zoom,frame.imgW,frame.imgH));
  const win=terrainRasterWindow(Math.min(...ll.map(p=>p[0])),Math.min(...ll.map(p=>p[1])),Math.max(...ll.map(p=>p[0])),Math.max(...ll.map(p=>p[1])))!;
  const r:TerrainRaster={source:'mapbox.terrain-rgb',zoom:14,tileSize:256,...win,elevations:Array.from({length:win.width*win.height},(_,i)=>350-2*Math.floor(i/win.width)+(i===Math.floor(win.width*win.height/2)?1.4:0)),verticalDatum:'mixed-unverified'};
  const buildings=[{label:'Classroom 1',ring:[[.25,.4],[.35,.4],[.35,.6],[.25,.6]] as Point[]},{label:'Classroom 2',ring:[[.65,.4],[.75,.4],[.75,.6],[.65,.6]] as Point[]}];
  const out=rasterTerrainSections(r,b,buildings,frame)!;
  assert.ok(out&&out.fitPosts>=6);assert.ok(out.downhill.a[1]<.2&&out.downhill.b[1]>.8);assert.ok(Math.abs(out.downhill.a[0]-out.downhill.b[0])<.05,'one pixel cannot turn the site axis sideways');
  assert.ok(out.downhill.points[0].elevationM>out.downhill.points.at(-1)!.elevationM);assert.equal(out.downhill.buildings.length,0,'off-line footprints must not appear on the downhill cut');
  assert.equal(out.buildingsSection?.buildings.length,2);assert.ok(Math.abs(out.buildingsSection!.a[1]-out.buildingsSection!.b[1])<1e-8);
  assert.equal(rasterTerrainSections({...r,elevations:r.elevations.map(()=>330)},b,buildings,frame),null,'flat data cannot invent a main fall');
});
