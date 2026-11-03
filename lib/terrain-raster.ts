import { TILE_SIZE, TILE_ZOOM } from '@/lib/contour-cache-key';

/** Raw posted pixels, not contours or a fitted slope. Coordinates refer to pixel centres. */
export interface TerrainRaster {
  source: 'mapbox.terrain-rgb';
  zoom: number;
  tileSize: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  elevations: number[];
  verticalDatum: 'mixed-unverified';
}

export function terrainPixel(lon:number,lat:number):[number,number] {
  const size=TILE_SIZE*2**TILE_ZOOM,rad=lat*Math.PI/180;
  return [(lon+180)/360*size,(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*size];
}

export function terrainPixelLonLat(x:number,y:number):[number,number] {
  const size=TILE_SIZE*2**TILE_ZOOM;
  return [x/size*360-180,180/Math.PI*Math.atan(Math.sinh(Math.PI-2*Math.PI*y/size))];
}

/** One surrounding pixel supports interpolation at the requested edge. A raw response is capped
 * independently of the existing contour budget so a large bbox cannot return megabytes of pixels. */
export function terrainRasterWindow(minLon:number,minLat:number,maxLon:number,maxLat:number) {
  if(![minLon,minLat,maxLon,maxLat].every(Number.isFinite)||minLon>=maxLon||minLat>=maxLat
    ||minLon< -180||maxLon>180||minLat< -85||maxLat>85)return null;
  const [left,top]=terrainPixel(minLon,maxLat),[right,bottom]=terrainPixel(maxLon,minLat);
  const originX=Math.floor(left-.5)-1,originY=Math.floor(top-.5)-1;
  const width=Math.ceil(right-.5)+2-originX+1,height=Math.ceil(bottom-.5)+2-originY+1;
  return width<=128&&height<=128?{originX,originY,width,height}:null;
}

export function extractTerrainRaster(grid:number[][],gridOriginX:number,gridOriginY:number,window:NonNullable<ReturnType<typeof terrainRasterWindow>>):TerrainRaster|null {
  const elevations:number[]=[];
  for(let y=0;y<window.height;y++)for(let x=0;x<window.width;x++){
    const value=grid[window.originY+y-gridOriginY]?.[window.originX+x-gridOriginX];
    if(!Number.isFinite(value))return null;
    elevations.push(value);
  }
  return {source:'mapbox.terrain-rgb',zoom:TILE_ZOOM,tileSize:TILE_SIZE,...window,elevations,verticalDatum:'mixed-unverified'};
}

export function validTerrainRaster(value:unknown):value is TerrainRaster {
  if(!value||typeof value!=='object')return false;
  const r=value as TerrainRaster;
  return r.source==='mapbox.terrain-rgb'&&r.zoom===TILE_ZOOM&&r.tileSize===TILE_SIZE
    &&r.verticalDatum==='mixed-unverified'&&[r.originX,r.originY,r.width,r.height].every(Number.isInteger)
    &&r.width>=2&&r.height>=2&&r.width<=128&&r.height<=128
    &&Array.isArray(r.elevations)&&r.elevations.length===r.width*r.height&&r.elevations.every(Number.isFinite);
}

/** Return the supporting pixels too: plotting many interpolated points must never masquerade as
 * many independent ground observations. Null means missing coverage, never a sea-level fallback. */
export function sampleTerrainRaster(r:TerrainRaster,lon:number,lat:number):{elevationM:number;cells:string[]}|null {
  const [px,py]=terrainPixel(lon,lat),x=px-r.originX-.5,y=py-r.originY-.5;
  const col=Math.floor(x),row=Math.floor(y),fx=x-col,fy=y-row;
  if(!Number.isFinite(x)||!Number.isFinite(y)||col<0||row<0||col+1>=r.width||row+1>=r.height)return null;
  const cells=[[col,row],[col+1,row],[col,row+1],[col+1,row+1]];
  const values=cells.map(([cx,cy])=>r.elevations[cy*r.width+cx]);
  if(values.some(v=>!Number.isFinite(v)))return null;
  return {elevationM:(values[0]*(1-fx)+values[1]*fx)*(1-fy)+(values[2]*(1-fx)+values[3]*fx)*fy,
    cells:cells.map(([cx,cy])=>`${r.originX+cx},${r.originY+cy}`)};
}

export function terrainGridSpacingM(lat:number):number {
  return 2*Math.PI*6378137*Math.cos(lat*Math.PI/180)/(TILE_SIZE*2**TILE_ZOOM);
}
