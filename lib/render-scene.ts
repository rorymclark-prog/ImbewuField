// A paid render can outlive the Studio and its current design. Keep the exact scene that was
// submitted, including the identity of its base image, so reconnecting never mixes revisions.
import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import type { SheetLabelMode } from '@/lib/plant-codes';
import type { SectorSite } from '@/lib/sector';
import type { SheetUnderlay } from '@/lib/sheet-underlay';

export const MAX_RENDER_SCENE_BYTES = 500 * 1024;
const SCENE_VERSION = 1;
const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

export interface RenderSceneRefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean;
}

export interface RenderSceneInput {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: RenderSceneRefLayers;
  site: SectorSite | null;
  placeName?: string;
  labelMode: SheetLabelMode;
  underlay: SheetUnderlay;
  outputScale: number;
  renderRecipe: string;
  planVersion: string;
  cacheSuffix?: string;
}

export interface RenderSceneSnapshot extends RenderSceneInput {
  schemaVersion: 1;
  sourceImageDigest: string | null;
}

type StoredRenderScene = Omit<RenderSceneSnapshot, 'frame'> & {
  frame: Omit<CanvasFrame, 'satDataUrl' | 'underlayDataUrl'>;
};

/** The image is uploaded separately; only sceneJson and its digest belong in Firestore. */
export interface PreparedRenderSceneSnapshot {
  sceneJson: string;
  designRevision: string;
  sourceDataUrl?: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Reject numbers JSON would silently turn into null. Sort object keys so property insertion
 * order cannot change a revision, while retaining authored array order and every coordinate. */
function canonicalCopy(value: unknown, depth = 0): unknown {
  if (depth > 40) throw new Error('The render scene is too deeply nested.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('The render scene contains a non-finite number.');
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalCopy(entry, depth + 1));
  if (record(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const entries = Object.keys(value).sort().filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalCopy(value[key], depth + 1)] as const);
    return Object.fromEntries(entries);
  }
  throw new Error('The render scene contains data that cannot be saved.');
}

function frameWithoutImages(frame: Omit<CanvasFrame, 'satDataUrl'>): StoredRenderScene['frame'] {
  // Select fields rather than spread: state.frame can also contain underlayDataUrl on old saves.
  return {
    centerLng: frame.centerLng, centerLat: frame.centerLat, zoom: frame.zoom,
    imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx,
  };
}

function validFrame(value: unknown): boolean {
  if (!record(value)) return false;
  return finite(value.centerLng) && Math.abs(value.centerLng) <= 180
    && finite(value.centerLat) && Math.abs(value.centerLat) <= 90
    && finite(value.zoom) && value.zoom >= 0
    && finite(value.imgW) && Number.isSafeInteger(value.imgW) && value.imgW > 0
    && finite(value.imgH) && Number.isSafeInteger(value.imgH) && value.imgH > 0
    && finite(value.mPerPx) && value.mPerPx > 0
    && !('satDataUrl' in value) && !('underlayDataUrl' in value);
}

function validPoints(value: unknown): boolean {
  // Some valid designs extend past the image edge. Reject corrupt coordinates, never clamp or
  // move a farmer's points to make them fit a serialization rule.
  return Array.isArray(value) && value.every((point) => Array.isArray(point)
    && point.length === 2 && point.every(finite));
}

function validScene(value: unknown): value is StoredRenderScene {
  if (!record(value) || value.schemaVersion !== SCENE_VERSION || !validFrame(value.frame)) return false;
  if (!(value.sourceImageDigest === null || (typeof value.sourceImageDigest === 'string' && SHA256.test(value.sourceImageDigest)))) return false;
  if (!record(value.state) || !nonEmpty(value.state.siteId) || !validFrame(value.state.frame)) return false;
  const state = value.state;
  if (!Array.isArray(state.items) || !Array.isArray(state.zones) || !Array.isArray(state.lines)) return false;
  if (!nonEmpty(state.updatedAt) || !['base', 'sector', 'water', 'earthworks', 'zones', 'planting', 'structures', 'review', 'glossy'].includes(String(state.step))) return false;
  if (state.rev !== undefined && (!Number.isSafeInteger(state.rev) || (state.rev as number) < 0)) return false;
  const ids = new Set<string>();
  for (const item of [...state.items, ...state.zones, ...state.lines]) {
    if (!record(item) || !nonEmpty(item.id) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  for (const item of state.items) {
    if (!record(item) || !nonEmpty(item.defId) || !finite(item.x) || !finite(item.y)) return false;
    if (['wM', 'hM'].some((key) => item[key] !== undefined && (!finite(item[key]) || (item[key] as number) <= 0))) return false;
  }
  if (!state.zones.every((zone) => record(zone) && validPoints(zone.points)
    && Number.isInteger(zone.zone) && (zone.zone as number) >= 0 && (zone.zone as number) <= 5)) return false;
  if (!state.lines.every((line) => record(line) && validPoints(line.points)
    && ['swale', 'fence', 'path', 'bedpath', 'pipe', 'drip', 'windbreak', 'greywater'].includes(String(line.kind)))) return false;
  if (!record(value.refLayers) || !['boundary', 'house', 'driveway'].every((key) => validPoints(value.refLayers && (value.refLayers as Record<string, unknown>)[key]))) return false;
  if (value.refLayers.drivewayClosed !== undefined && typeof value.refLayers.drivewayClosed !== 'boolean') return false;
  if (value.site !== null && !record(value.site)) return false;
  if (value.placeName !== undefined && typeof value.placeName !== 'string') return false;
  return ['codes', 'names', 'onplant'].includes(String(value.labelMode))
    && ['photo', 'satellite', 'plain'].includes(String(value.underlay))
    && finite(value.outputScale) && value.outputScale > 0 && value.outputScale <= 8
    && nonEmpty(value.renderRecipe) && value.renderRecipe.length <= 128
    && typeof value.planVersion === 'string' && /^v\d+$/.test(value.planVersion)
    && (value.cacheSuffix === undefined || (typeof value.cacheSuffix === 'string' && value.cacheSuffix.length <= 512));
}

/** Synchronous schema check for untrusted subscription data. Hash verification happens before
 * using the scene, in decodeRenderSceneSnapshot, so it also protects reloads and recovered jobs. */
export function parseRenderSceneJson(sceneJson: unknown, designRevision: unknown): StoredRenderScene | null {
  if (typeof sceneJson !== 'string' || new TextEncoder().encode(sceneJson).byteLength > MAX_RENDER_SCENE_BYTES
    || typeof designRevision !== 'string' || !SHA256.test(designRevision)) return null;
  try {
    const value = canonicalCopy(JSON.parse(sceneJson));
    return validScene(value) ? value : null;
  } catch {
    return null;
  }
}

async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure render snapshot storage is unavailable. Please use a secure connection.');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sourceDigest(sourceDataUrl: string): Promise<string> {
  const match = IMAGE_DATA_URL.exec(sourceDataUrl);
  if (!match || match[1].length % 4 !== 0) throw new Error('The render scene has an invalid source image.');
  const binary = atob(match[1]);
  return digest(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function sceneRevisionBytes(scene: StoredRenderScene): Uint8Array<ArrayBuffer> {
  // Opening Review or receiving an identical sync copy changes these fields, but does not change
  // the farm. Keep them for recovery without labelling the same drawing as a different design.
  const { step: _step, updatedAt: _updatedAt, rev: _rev, ...design } = scene.state;
  return new TextEncoder().encode(JSON.stringify(canonicalCopy({ ...scene, state: design })));
}

export async function createRenderSceneSnapshot(input: RenderSceneInput): Promise<PreparedRenderSceneSnapshot> {
  // Copy before the first await: a drag or a new background arriving while hashing must not leak
  // into the paid attempt. Images are immutable strings and are captured in the same turn.
  const sourceDataUrl = input.frame.satDataUrl ?? undefined;
  const detached = canonicalCopy({
    ...input,
    state: { ...input.state, frame: frameWithoutImages(input.state.frame) },
    frame: frameWithoutImages(input.frame),
    schemaVersion: SCENE_VERSION,
    sourceImageDigest: null,
  }) as StoredRenderScene;
  if (!validScene(detached)) throw new Error('The render scene has invalid geometry or settings.');
  if (sourceDataUrl) detached.sourceImageDigest = await sourceDigest(sourceDataUrl);
  const sceneJson = JSON.stringify(canonicalCopy(detached));
  const bytes = new TextEncoder().encode(sceneJson);
  if (bytes.byteLength > MAX_RENDER_SCENE_BYTES) throw new Error('This design is too large to snapshot for AI rendering. Your saved design is unchanged.');
  return { sceneJson, designRevision: await digest(sceneRevisionBytes(detached)), ...(sourceDataUrl ? { sourceDataUrl } : {}) };
}

export async function decodeRenderSceneSnapshot(
  sceneJson: string,
  designRevision: string,
  sourceDataUrl?: string,
): Promise<RenderSceneSnapshot> {
  const scene = parseRenderSceneJson(sceneJson, designRevision);
  if (!scene) throw new Error('The saved render scene is invalid.');
  const actualRevision = await digest(sceneRevisionBytes(scene));
  if (actualRevision !== designRevision) throw new Error('The saved render scene revision does not match this job.');
  if (scene.sourceImageDigest) {
    if (!sourceDataUrl || await sourceDigest(sourceDataUrl) !== scene.sourceImageDigest) {
      throw new Error('The saved render source image does not match this job.');
    }
  } else if (sourceDataUrl !== undefined) {
    throw new Error('This render scene did not contain a source image.');
  }
  return { ...scene, frame: { ...scene.frame, satDataUrl: sourceDataUrl ?? null } };
}
