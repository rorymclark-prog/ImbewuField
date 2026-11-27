import { makeMercatorUnprojector, designBaseMode, statusOf, type CanvasFrame, type DesignCanvasState } from './design-canvas';
import { ELEMENTS_BY_ID } from './design-elements';
import type { RenderSceneRefLayers } from './render-scene';

type Shape = DesignCanvasState['items'][number] | DesignCanvasState['zones'][number] | DesignCanvasState['lines'][number];
type Frame = Omit<CanvasFrame,'satDataUrl'>;
interface Drawing {state:DesignCanvasState; refLayers:RenderSceneRefLayers; frame:Frame}
export interface DesignChange { action:'Added'|'Removed'|'Moved'|'Reshaped'|'Updated'; name:string; count:number }

function label(shape: Shape) {
  if ('defId' in shape) return shape.label?.trim() || ELEMENTS_BY_ID[shape.defId]?.name || shape.defId.replace(/_/g,' ');
  return shape.name?.trim() || ('kind' in shape ? shape.kind : shape.feature?.replace(/_/g,' ') || 'Zone ' + shape.zone);
}

function details(shape: Shape) {
  if ('defId' in shape) {
    const {id, x, y, ...rest} = shape;
    return {...rest,status:statusOf(shape)};
  }
  const {id, points, ...rest} = shape;
  return {...rest,status:statusOf(shape)};
}

// Stored snapshots sort object keys. The live canvas retains insertion order.
function same(a: unknown, b: unknown) {
  const ordered = (_key: string, v: unknown) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([x],[y]) => x.localeCompare(y))) : v;
  return JSON.stringify(a,ordered) === JSON.stringify(b,ordered);
}

function coordinates(frame: Frame) {
  const unproject = makeMercatorUnprojector(frame.centerLng,frame.centerLat,frame.zoom,frame.imgW,frame.imgH);
  return (points: [number,number][]) => points.map(p => unproject(p));
}
function samePoints(a: number[][], b: number[][]) {
  // Convert back to geographic positions before comparing. Merely reframing the canvas must
  // never report that every tree moved. The tolerance absorbs Mercator round-trip noise.
  return a.length === b.length && a.every((p,i) => p.every((v,j) => Math.abs(v-b[i][j]) < 1e-8));
}
function kind(shape: Shape) {
  return 'defId' in shape ? 'item:'+shape.defId : 'kind' in shape ? 'line:'+shape.kind : 'zone:'+(shape.feature ?? 'effort');
}
export function savedDesignChanges(before: Drawing, now: Drawing): DesignChange[] | null {
  if (before.state.siteId !== now.state.siteId) return null;
  const changes: DesignChange[] = [];
  function add(action: DesignChange['action'], name: string) {
    const group = changes.find(g => g.action === action && g.name === name);
    if (group) group.count++;
    else changes.push({action,name,count:1});
  }
  const all = (s:DesignCanvasState): Shape[] => [...s.items,...s.zones,...s.lines];
  const originals = new Map(all(before.state).map(s => [s.id,s]));
  // Paper and a grower's imported photo anchor the drawing to image pixels. Studio's
  // migrateStateToFrame keeps those coordinates fixed when the satellite frame is recomputed.
  const base = designBaseMode(before.state);
  const imageAnchored = base === designBaseMode(now.state) && (base === 'blank' ||
    (base === 'photo' && !!before.state.customBase && !!now.state.customBase));
  const unchanged = (points:[number,number][]) => points;
  const oldPoints = imageAnchored ? unchanged : coordinates(before.state.frame);
  const newPoints = imageAnchored ? unchanged : coordinates(now.state.frame);
  for (const shape of all(now.state)) {
    const old = originals.get(shape.id);
    originals.delete(shape.id);
    if (!old || kind(old) !== kind(shape)) {
      if (old) add('Removed',label(old));
      add('Added',label(shape)); continue;
    }
    if ('x' in old && 'x' in shape) {
      if (!samePoints(oldPoints([[old.x,old.y]]),newPoints([[shape.x,shape.y]]))) add('Moved',label(shape));
    } else if ('points' in old && 'points' in shape && !samePoints(oldPoints(old.points),newPoints(shape.points))) {
      add('Reshaped',label(shape));
    }
    if (!same(details(old),details(shape))) add('Updated',label(shape));
  }
  for (const old of originals.values()) add('Removed',label(old));
  const originalRefs = coordinates(before.frame), currentRefs = coordinates(now.frame);
  for (const [key,name] of [['boundary','Site boundary'],['house','Building outline'],['driveway','Driveway outline']] as const) {
    const left = before.refLayers[key], right = now.refLayers[key];
    if (!samePoints(originalRefs(left),currentRefs(right)) ||
      (key === 'driveway' && right.length > 0 && !!before.refLayers.drivewayClosed !== !!now.refLayers.drivewayClosed)) {
      add(!left.length ? 'Added' : !right.length ? 'Removed' : 'Reshaped',name);
    }
  }
  for (const [key,name] of [['localWind','Local wind observation'],['dailyWaterUseL','Daily water use'],
    ['customBase','Site photo or alignment'],['useCustomBase','Active site photo'],['scaleFactor','Ground scale'],
    ['blankMPerPx','Paper scale'],['baseMode','Design base']] as const) {
    const value = (s:DesignCanvasState) => key === 'scaleFactor' ? s[key] ?? 1 : key === 'useCustomBase' ? !!s[key] : s[key] ?? null;
    if (!same(value(before.state),value(now.state))) add('Updated',name);
  }
  return changes;
}
