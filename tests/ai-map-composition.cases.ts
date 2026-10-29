import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { hybridProtectionPolicy, geometryLockCompositionPolicy, AI_MAP_REVIEW_NOTICE } from '../lib/render-policy.ts';
import { canopyForegroundAlpha, assertMatchingImageAspects } from '../lib/image-producer.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { itemInFilter, isContextElement, zonesInFilter } from '../lib/glossy-filters.ts';

// Execute the actual production helpers. A source-pattern test cannot see a photo strip or
// prove that a completed job's old mask is replaced. No private farm records or native dependency.
const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function helper(name: string, scope: Record<string, unknown>): any {
  let code = '';
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) code = n.getText(tree);
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
    rect(x: number,y: number,w: number,h: number) { paths.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]); },
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

test('photo and plain-paper contracts never acquire painted exterior or lose source structures', () => {
  for(const [style,photo] of [['photo_plan',true],['precision_atlas',false]] as const){
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
  assert.equal(await build(undefined,state,{...frame,satDataUrl:null},refs,300,300,'precision_atlas',false),'paper-roof');
  assert.deepEqual(calls,['photo','paper']);
});

test('completed OpenAI and Gemini jobs rebuild the mask from their frozen scene before restoring', async () => {
  for(const engine of ['openai','gemini']) {
    const calls:unknown[][]=[];
    let badStoredMask=false;
    const scene={state,frame,refLayers:refs,site:null,placeName:'Fictional test',labelMode:'onplant'};
    const finish=helper('finishStyledSheet',{
      state,frame,refLayers:refs,site:null,placeName:scene.placeName,labelMode:'codes',SCALE:3,
      boundaryPresentationContext:async(...args:unknown[])=>{calls.push(['scene',...args]);return {state,frame,refLayers:refs};},
      isModelChromeStyle:()=>false,paidPolishNeedsChromePass:()=>false,
      GLOSSY_FILTERS:[],geometryLockCompositionPolicy,lockedProtectMaskOptions:hybridProtectionPolicy,
      loadImage:async(value:string)=>({width:300,height:value==='stored-mask'&&badStoredMask?200:300}),
      releaseImageSource:()=>{},assertMatchingImageAspects,
      buildProtectMask:async(...args:unknown[])=>{calls.push(['mask',...args]);return 'rebuilt-mask';},
      restoreProtectedPixels:async(...args:unknown[])=>{calls.push(['restore',...args]);return 'restored';},
      buildGeometryLockStructureOverlay:async()=>undefined,stackOverlayImages:async()=>undefined,
      compositeAccurateMap:async()=> 'composite',burnPaintedBoundary:async()=> 'bounded',
      burnExactLabelLayer:async(map:string)=>({map}),
      composeStyleSheet:async(...args:unknown[])=>{calls.push(['chrome',...args]);return 'sheet';},
      REFERENCE_SHEET_LABEL:{all:'Whole'},
    });
    assert.equal(await finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false),'sheet',engine);
    const restore=calls.find(c=>c[0]==='restore')!;
    assert.deepEqual(restore,['restore','photo','model','rebuilt-mask']);
    const mask=calls.find(c=>c[0]==='mask')!;
    assert.equal(mask[1],state); assert.equal(mask[4],'all'); assert.equal(mask[6],'model');
    const chrome=calls.find(c=>c[0]==='chrome')!;
    assert.equal((chrome.at(-1) as {aiArtwork:boolean}).aiArtwork,true);
    badStoredMask=true;
    await assert.rejects(()=>finish('model','all',{key:'precision_atlas',label:'Reference Blueprint'},false,'input','stored-mask',true,false,scene,()=>false),/mask aspect/);
  }
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
