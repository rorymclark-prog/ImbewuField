import type { CanvasFrame } from '@/lib/design-canvas';
import { makeMercatorUnprojector, pointInRing, projectorForFrame } from '@/lib/design-canvas';
import { polygonAreaCentroid } from '@/lib/boundary-geometry';
import type { SheetContourResult } from '@/lib/sheet-contours';
import { sampleTerrainRaster, terrainGridSpacingM, terrainPixelLonLat, validTerrainRaster, type TerrainRaster } from '@/lib/terrain-raster';
import { isoLines } from 'marchingsquares';
import { buildThresholds } from '@/lib/contour-thresholds';

export const TERRAIN_CONTOUR_INK='#815138';
export const TERRAIN_SUPPLEMENTAL_INK='#A97653';

export interface SectorTerrainProfile {
  a: [number,number];
  b: [number,number];
  lengthM: number;
  points: Array<{ distanceM:number; elevationM:number }>;
}

// A one-metre isoline is not evidence of one-metre ground accuracy. This is a broad regional
// overview, never an excavation/set-out plan. Keep original provider data untouched for recovery.
export function sectorOverviewContours(result:SheetContourResult):SheetContourResult {
  if(result.status!=='ok')return result;
  if(!Number.isFinite(result.intervalM)||result.intervalM<=0)return {...result,lines:[],status:'unavailable',tooFlat:false};
  const intervalM=Math.max(result.intervalM,Math.ceil(5/result.intervalM)*result.intervalM);
  const lines=result.lines.filter(line=>Math.abs(line.elevM/intervalM-Math.round(line.elevM/intervalM))<1e-6);
  return {...result,intervalM,lines,tooFlat:lines.length===0,status:lines.length?'ok':'too-flat'};
}

function crossings(points:Array<[number,number]>,x:number,closed=false):number[] {
  const ys:number[]=[];
  for(let i=1;i<points.length+(closed?1:0);i++){
    const a=points[i-1],b=points[i%points.length];
    if(a[0]===b[0] || x<Math.min(a[0],b[0]) || x>=Math.max(a[0],b[0]))continue;
    const t=(x-a[0])/(b[0]-a[0]);ys.push(a[1]+t*(b[1]-a[1]));
  }
  return ys.sort((a,b)=>a-b);
}

/** A north-to-south transect through the longest interior run near the plot centre.
 * Heights exist ONLY at actual contour crossings. Do not invent endpoint heights or smooth a
 * dense hillside out of the five-point SRTM slope. Gaps remain unknown; plotted joins are dashed. */
export function sectorTerrainProfile(result:SheetContourResult,boundary:Array<[number,number]>,frame:Pick<CanvasFrame,'imgW'|'imgH'|'mPerPx'>):SectorTerrainProfile|null {
  if(result.status!=='ok'||result.source!=='mapbox-terrain-rgb'||boundary.length<3
    ||![frame.imgW,frame.imgH,frame.mPerPx].every(n=>Number.isFinite(n)&&n>0)
    ||boundary.some(p=>p.some(n=>!Number.isFinite(n))))return null;
  const xs=boundary.map(p=>p[0]),minX=Math.min(...xs),spanX=Math.max(...xs)-minX;
  let best:SectorTerrainProfile|null=null;
  for(const fraction of [.5,.35,.65]){
    const x=minX+spanX*fraction,ys=crossings(boundary,x,true);
    for(let i=0;i+1<ys.length;i+=2){
      const yA=ys[i],yB=ys[i+1],lengthM=(yB-yA)*frame.imgH*frame.mPerPx;
      if(!Number.isFinite(lengthM)||!(lengthM>0))continue;
      const points=result.lines.flatMap(line=>Number.isFinite(line.elevM)?crossings(line.points,x)
        .filter(y=>y>=yA&&y<=yB).map(y=>({distanceM:(y-yA)*frame.imgH*frame.mPerPx,elevationM:line.elevM})):[])
        .sort((a,b)=>a.distanceM-b.distanceM);
      const unique=points.filter((p,index)=>index===0||Math.abs(p.distanceM-points[index-1].distanceM)>.01);
      if(unique.length<2 || new Set(unique.map(p=>p.elevationM)).size<2)continue;
      const relief=Math.max(...unique.map(p=>p.elevationM))-Math.min(...unique.map(p=>p.elevationM));
      if(!Number.isFinite(relief)||relief<=0)continue;
      // Conflicting heights at one location are corrupt/ambiguous data, not a vertical cliff.
      if(points.some((p,index)=>index>0&&Math.abs(p.distanceM-points[index-1].distanceM)<=.01&&Math.abs(p.elevationM-points[index-1].elevationM)>.01))continue;
      if(!best || lengthM>best.lengthM)best={a:[x,yA],b:[x,yB],lengthM,points:unique};
    }
  }
  return best;
}

type Point = [number,number];
export interface ProfileBuilding { label:string; ring:Point[] }
export interface RasterTerrainProfile extends SectorTerrainProfile {
  gridSpacingM:number;
  supportingPixelCount:number;
  buildings:Array<{label:string;ring:Point[];startM:number;endM:number}>;
}

/** Original geographic frame ONLY. A cropped display frame retains the old centre/zoom, so
 * unprojecting it silently samples a different hillside. No state or measurements are changed. */
export async function fetchProfileTerrain(frame:CanvasFrame,boundary:Point[],fetcher:(url:string)=>Promise<{ok:boolean;json:()=>Promise<unknown>}>):Promise<TerrainRaster|null> {
  if(boundary.length<3||boundary.some(p=>p.some(n=>!Number.isFinite(n))))return null;
  const unproject=makeMercatorUnprojector(frame.centerLng,frame.centerLat,frame.zoom,frame.imgW,frame.imgH);
  const geo=boundary.map(unproject),xs=geo.map(p=>p[0]),ys=geo.map(p=>p[1]);
  const params=new URLSearchParams({minLon:String(Math.min(...xs)),maxLon:String(Math.max(...xs)),minLat:String(Math.min(...ys)),maxLat:String(Math.max(...ys)),terrain:'pixels'});
  try{const response=await fetcher(`/api/contours?${params}`);if(!response.ok)return null;const raster=await response.json();return validTerrainRaster(raster)?raster:null;}catch{return null;}
}

/** A straight section through the two principal saved buildings, not a screen-vertical line that
 * misses the classrooms. Positions and footprint widths use the plan's existing metric scale;
 * height/roof shape is deliberately absent because no measured building heights were supplied. */
export function rasterTerrainProfile(raster:TerrainRaster,boundary:Point[],buildings:ProfileBuilding[],frame:CanvasFrame,axis?:{origin:Point;vector:Point}):RasterTerrainProfile|null {
  if(!validTerrainRaster(raster)||boundary.length<3||boundary.some(p=>p.some(n=>!Number.isFinite(n)))
    ||![frame.imgW,frame.imgH,frame.mPerPx].every(n=>Number.isFinite(n)&&n>0))return null;
  const toM=([x,y]:Point):Point=>[x*frame.imgW*frame.mPerPx,y*frame.imgH*frame.mPerPx];
  const fromM=([x,y]:Point):Point=>[x/(frame.imgW*frame.mPerPx),y/(frame.imgH*frame.mPerPx)];
  const centre=(ring:Point[]):Point=>[ring.reduce((s,p)=>s+p[0],0)/ring.length,ring.reduce((s,p)=>s+p[1],0)/ring.length];
  const area=(ring:Point[])=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0));
  const structures=buildings.filter(b=>b.ring.length>=3&&b.ring.every(p=>p.every(Number.isFinite))).map(b=>({...b,ring:b.ring.map(toM)})).sort((a,b)=>area(b.ring)-area(a.ring));
  const ring=boundary.map(toM),origin=axis?toM(axis.origin):centre(structures[0]?.ring??ring),other=structures[1]?centre(structures[1].ring):[origin[0],origin[1]+1];
  let [dx,dy]=axis?.vector??[other[0]-origin[0],other[1]-origin[1]],norm=Math.hypot(dx,dy);
  if(norm<.001){dx=0;dy=1;norm=1;}
  dx/=norm;dy/=norm;if(!axis&&(dy<0||(Math.abs(dy)<1e-8&&dx<0))){dx=-dx;dy=-dy;}
  const hits=(polygon:Point[])=>{
    const ts:number[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-9)continue;
      const ax=a[0]-origin[0],ay=a[1]-origin[1],u=(ax*dy-ay*dx)/den;
      if(u<0||u>=1)continue;
      ts.push((ax*ey-ay*ex)/den);
    }
    return ts.sort((a,b)=>a-b).filter((t,i,all)=>i===0||Math.abs(t-all[i-1])>.001);
  };
  const edges=hits(ring);let start=0,end=0;
  for(let i=0;i+1<edges.length;i+=2){
    if(edges[i]<=0&&edges[i+1]>=0){start=edges[i];end=edges[i+1];break;}
    if(axis&&edges[i+1]-edges[i]>end-start){start=edges[i];end=edges[i+1];}
  }
  const lengthM=end-start;if(!Number.isFinite(lengthM)||lengthM<=0||lengthM>10000)return null;
  const point=(t:number):Point=>fromM([origin[0]+dx*t,origin[1]+dy*t]);
  const a=point(start),b=point(end),unproject=makeMercatorUnprojector(frame.centerLng,frame.centerLat,frame.zoom,frame.imgW,frame.imgH);
  const points:RasterTerrainProfile['points']=[],cells=new Set<string>();
  // Approximately 1 m plotting steps interpolate the posted raster; the caption reports both
  // that spacing and the coarser native grid. These are not 1 m survey observations.
  const steps=Math.max(2,Math.min(500,Math.ceil(lengthM)));
  for(let i=0;i<=steps;i++){
    const distanceM=lengthM*i/steps,[lon,lat]=unproject(point(start+distanceM));
    const sample=sampleTerrainRaster(raster,lon,lat);if(!sample)return null;
    points.push({distanceM,elevationM:sample.elevationM});sample.cells.forEach(cell=>cells.add(cell));
  }
  const bands:RasterTerrainProfile['buildings']=[];
  for(const building of structures){const ts=hits(building.ring);for(let i=0;i+1<ts.length;i+=2){const lo=Math.max(start,ts[i]),hi=Math.min(end,ts[i+1]);if(hi>lo)bands.push({label:building.label,ring:building.ring.map(fromM),startM:lo-start,endM:hi-start});}}
  return {a,b,lengthM,points,buildings:bands,gridSpacingM:terrainGridSpacingM(frame.centerLat),supportingPixelCount:cells.size};
}

/** Fit the broad fall across native in-site DEM posts. A noisy local derivative (roof/tree or one
 * interpolated pixel) must not turn the whole-property section around. The fit selects direction
 * only; every plotted height still comes directly from the raster. */
export function terrainFallAxis(raster:TerrainRaster,boundary:Point[],frame:CanvasFrame):{origin:Point;vector:Point;posts:number}|null {
  if(!validTerrainRaster(raster)||boundary.length<3)return null;
  const project=projectorForFrame(frame),posts:Array<[number,number,number]>=[];
  for(let row=0;row<raster.height;row++)for(let col=0;col<raster.width;col++){
    const coord=terrainPixelLonLat(raster.originX+col+.5,raster.originY+row+.5),p=project(coord);
    if(pointInRing(p,boundary))posts.push([p[0]*frame.imgW*frame.mPerPx,p[1]*frame.imgH*frame.mPerPx,raster.elevations[row*raster.width+col]]);
  }
  if(posts.length<6)return null;
  const [mx,my,mz]=[0,1,2].map(i=>posts.reduce((s,p)=>s+p[i],0)/posts.length);
  let xx=0,xy=0,yy=0,xz=0,yz=0;
  for(const [px,py,pz] of posts){const x=px-mx,y=py-my,z=pz-mz;xx+=x*x;xy+=x*y;yy+=y*y;xz+=x*z;yz+=y*z;}
  const determinant=xx*yy-xy*xy;
  if(!Number.isFinite(determinant)||determinant<=1e-8)return null;
  const dx=-(yy*xz-xy*yz)/determinant,dy=-(xx*yz-xy*xz)/determinant;
  if(![dx,dy].every(Number.isFinite)||Math.hypot(dx,dy)<1e-6)return null;
  return {origin:polygonAreaCentroid(boundary),vector:[dx,dy],posts:posts.length};
}

export function rasterTerrainSections(raster:TerrainRaster,boundary:Point[],buildings:ProfileBuilding[],frame:CanvasFrame){
  const fall=terrainFallAxis(raster,boundary,frame);
  const downhill=fall?rasterTerrainProfile(raster,boundary,[],frame,fall):null;
  // A low-confidence/discordant axis should not be labelled "uphill to downhill" if its actual
  // end samples contradict that label. It is better to return unavailable than quietly swap it.
  if(!fall||!downhill||downhill.points[0].elevationM<=downhill.points.at(-1)!.elevationM)return null;
  const cross=buildings.length>=2?rasterTerrainProfile(raster,boundary,buildings,frame):null;
  const buildingsSection=cross&&new Set(cross.buildings.map(b=>b.label)).size>=2?cross:null;
  return {downhill,buildingsSection,fitPosts:fall.posts};
}

/** Return only actual in-property runs. Clipping segments, rather than testing their vertices,
 * keeps a real contour that crosses a narrow field between two DEM grid posts. */
function clipTerrainContour(points:Point[],boundary:Point[]):Point[][] {
  const runs:Point[][]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],ts=[0,1];
    for(let edge=0;edge<boundary.length;edge++){
      const p=boundary[edge],q=boundary[(edge+1)%boundary.length],ex=q[0]-p[0],ey=q[1]-p[1],det=dx*ey-dy*ex;
      if(Math.abs(det)<1e-14)continue;
      const x=p[0]-a[0],y=p[1]-a[1],t=(x*ey-y*ex)/det,u=(x*dy-y*dx)/det;
      if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
    }
    ts.sort((a,b)=>a-b);
    const at=(t:number):Point=>[a[0]+t*dx,a[1]+t*dy];
    for(let j=1;j<ts.length;j++){
      if(ts[j]-ts[j-1]<1e-9||!pointInRing(at((ts[j]+ts[j-1])/2),boundary))continue;
      const start=at(ts[j-1]),end=at(ts[j]),last=runs.at(-1),prev=last?.at(-1);
      if(last&&prev&&Math.hypot(start[0]-prev[0],start[1]-prev[1])<1e-8)last.push(end);
      else runs.push([start,end]);
    }
  }
  return runs;
}

// Open marching-squares output can arrive as cell runs. Join only matching endpoints before
// judging a line's length; closing the paths would invent long edges along the raster window.
function joinTerrainContourRuns(runs:number[][][]):number[][][] {
  const key=([x,y]:number[])=>`${Math.round(x*1e8)},${Math.round(y*1e8)}`;
  const byEnd=new Map<string,number[]>(),used=new Set<number>();
  const paths=runs.filter(run=>run.length>=2);
  paths.forEach((run,i)=>{for(const end of new Set([key(run[0]),key(run.at(-1)!)]))byEnd.set(end,[...(byEnd.get(end)??[]),i]);});
  const extend=(line:number[][])=>{
    while(true){
      const end=key(line.at(-1)!),next=(byEnd.get(end)??[]).filter(i=>!used.has(i));
      if(next.length!==1)return;
      const i=next[0];used.add(i);const run=paths[i];
      const ordered=key(run[0])===end?run:[...run].reverse();
      line.push(...ordered.slice(1));
    }
  };
  const result:number[][][]=[];
  paths.forEach((run,i)=>{if(used.has(i))return;used.add(i);const line=[...run];extend(line);line.reverse();extend(line);result.push(line.reverse());});
  return result;
}

/** Same raw pixel centres as the section plot. Finer contour intervals describe interpolated
 * relief only; short supplemental slivers below the posted spacing are omitted as visual noise. */
export function rasterTerrainContours(raster:TerrainRaster,boundary:Point[],frame:CanvasFrame){
  const lines:SheetContourResult['lines']=[];
  if(!validTerrainRaster(raster)||boundary.length<3||boundary.some(point=>point.some(n=>!Number.isFinite(n))))return lines;
  const grid=Array.from({length:raster.height},(_,row)=>raster.elevations.slice(row*raster.width,(row+1)*raster.width));
  const min=Math.min(...raster.elevations),max=Math.max(...raster.elevations),interval=2.5;
  if(max-min<interval||Math.ceil((max-min)/interval)>80)return lines;
  const project=projectorForFrame(frame),spacing=terrainGridSpacingM(frame.centerLat);
  for(const level of buildThresholds(min,max,interval,84)){
    if(level<=min||level>=max)continue;
    const major=level%5===0;
    for(const path of joinTerrainContourRuns(isoLines(grid,level,{noQuadTree:true,noFrame:true,linearRing:false}))){
      const points=path.map(([x,y])=>project(terrainPixelLonLat(raster.originX+x+.5,raster.originY+y+.5)));
      for(const run of clipTerrainContour(points,boundary)){
        const length=run.slice(1).reduce((sum,p,i)=>sum+Math.hypot((p[0]-run[i][0])*frame.imgW,(p[1]-run[i][1])*frame.imgH)*frame.mPerPx,0);
        if(length<(major?spacing*.2:spacing))continue;
        lines.push({points:run,elevM:level,major});
      }
    }
  }
  return lines;
}
