import type { CanvasFrame } from '@/lib/design-canvas';
import type { SheetContourResult } from '@/lib/sheet-contours';

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
