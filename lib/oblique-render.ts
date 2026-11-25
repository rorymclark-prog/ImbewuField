import { isTankDefId } from '@/lib/reference-feature-art';
import { ringAreaOf, type CanvasFrame, type DesignCanvasState, type PlacedItem } from '@/lib/design-canvas';
import { authoritativeHouseFootprints, sameFootprint, type HouseFootprintRefLayers } from '@/lib/house-footprints';
import { ridgeAngleOf } from '@/lib/water-story';
import type { SectorSite } from '@/lib/sector';
import type { SheetContourResult } from '@/lib/sheet-contours';
import { STYLE_LINES, type StylePreset } from '@/lib/producer-prompt';

export type AiMapView = 'top-down' | 'oblique';
const OBLIQUE_PITCH_DEG = 45;
const PREFIX = 'oblique:v1:';

// The view belongs to the durable job, never the picker at the time a background job finishes.
export function obliqueJobStyle(style: StylePreset): string { return `${PREFIX}${style}`; }
export function obliqueStyleFromJob(style: string): StylePreset | null {
  if (!style.startsWith(PREFIX)) return null;
  const preset = style.slice(PREFIX.length);
  return Object.hasOwn(STYLE_LINES, preset) ? preset as StylePreset : null;
}

export function isObliqueJobStyle(style: string): boolean { return style.startsWith('oblique:'); }

export interface ObliqueTerrainEvidence {
  kind: 'contours' | 'indicative-slope' | 'unavailable';
  note: string;
}

export function obliqueTerrainEvidence(contours: SheetContourResult, site: SectorSite | null): ObliqueTerrainEvidence {
  const heights = [...new Set(contours.lines.map((line) => line.elevM).filter(Number.isFinite))].sort((a, b) => a - b);
  if (contours.source === 'mapbox-terrain-rgb' && contours.status === 'ok' && heights.length >= 2) {
    return { kind: 'contours', note: `Terrain-RGB contour reference, ${contours.intervalM} m interval. Labelled elevations in the terrain panel are metres. This is modelled terrain, not a field survey; do not exaggerate relief.` };
  }
  const elevation = site?.elevation;
  if (elevation?.directionConfidence === 'site-local-indicative'
    && Number.isFinite(elevation.slopeDeg) && elevation.slopeDeg >= 0 && elevation.slopeDeg < 90
    && Number.isFinite(elevation.aspectDeg) && elevation.aspectDeg >= 0 && elevation.aspectDeg < 360) {
    return { kind: 'indicative-slope', note: `Indicative local slope only: ${elevation.slopeDeg} degrees downhill towards bearing ${elevation.aspectDeg} degrees clockwise from north. No detailed terrain surface is available. Use only a modest continuous fall; do not invent terraces, gullies or hills.` };
  }
  return { kind: 'unavailable', note: 'Terrain elevations unavailable or insufficient. Landform is illustrative; do not infer measured flat ground, hills, terraces or drainage gradients.' };
}

const OBLIQUE_LOOK: Record<StylePreset, string> = {
  editorial_atlas: 'Clean architectural landscape illustration with fine ink detail, restrained sage and teal colours and light neutral materials.',
  precision_atlas: 'Polished naturalistic landscape illustration, crisp detailed foliage and roofs, restrained realistic colours.',
  photo_plan: 'Naturalistic photographic garden visualisation, realistic foliage, roofs and ground materials.',
  satellite_overlay: 'Naturalistic aerial garden visualisation with crisp realistic detail.',
  field_ledger: 'Fine hand-inked landscape illustration with restrained watercolour.',
  homestead_storybook: 'Warm detailed storybook landscape illustration with natural colours.',
  extension_blueprint: 'Clear architectural landscape illustration with restrained blue and green ink.',
  karoo_folk: 'Bold warm folk-art landscape illustration.',
  chatgpt_atlas: 'Polished editorial landscape illustration with rich natural detail.',
  master_atlas: 'Fine engraved landscape illustration with restrained natural colour.',
};

// The picker and generation request describe the same angled appearance. Top-down blurbs can
// promise exact geometry or untouched satellite pixels, neither of which belongs to this view.
export function obliqueStyleDescription(style: StylePreset): string { return OBLIQUE_LOOK[style]; }

export const OBLIQUE_REVIEW_NOTICE = 'Oblique AI illustration — positions, heights and terrain need review against the measured top-down plan. Not to scale. Legend lists the saved design; hidden features may not be visible.';

type ObliqueAnchor = { kind: 'tank' | 'hive' | 'gate'; x: number; y: number };
const ANCHOR_INK = { tank: '#006B96', hive: '#B2480C', gate: '#9E245D' } as const;

// These small fixtures were moved to opposite ends of the farm even when their counts were
// correct. The board and its caption must describe the very same saved positions.
export function obliqueAnchors(items: readonly Pick<PlacedItem, 'defId' | 'x' | 'y'>[]): ObliqueAnchor[] {
  return items.flatMap(({ defId, x, y }): ObliqueAnchor[] => {
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return [];
    if (isTankDefId(defId)) return [{ kind: 'tank', x, y }];
    if (defId === 'gate') return [{ kind: 'gate', x, y }];
    return defId === 'beehive' ? [{ kind: 'hive', x, y }] : [];
  });
}

export function obliqueAnchorBrief(anchors: readonly ObliqueAnchor[]): string {
  if (!anchors.length) return '';
  const groups = new Map<string, number>();
  for (const { kind, x, y } of anchors) {
    const depth = y < 1 / 3 ? 'far / north' : y > 2 / 3 ? 'near / south' : 'middle depth';
    const side = x < 1 / 3 ? 'left / west' : x > 2 / 3 ? 'right / east' : 'centre';
    const key = `${kind} (${depth}, ${side})`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return 'GROUND FIXTURES in the lower-left guide, viewed from the south. '
    + Array.from(groups, ([key, count]) => `${count} × ${key}`).join('; ')
    + '. Keep every fixture at its coloured mark, including any behind canopy. Leave the guide symbols out of the artwork.'
    + (anchors.some(a => a.kind === 'gate') ? ' The diamond marks a saved gate. Show the opening there. A garden gate can be separate from the vehicle entrance. Use the aerial or a driveway trace to locate vehicle access. The gate alone gives no vehicle-route width or destination.' : '');
}

type RoofGuide = ReturnType<typeof obliqueRoofGuides>[number];

export function obliqueRoofGuides(state: Pick<DesignCanvasState, 'zones'>, refs: HouseFootprintRefLayers,
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>) {
  if (!(frame.imgW > 0 && frame.imgH > 0)) return [];
  return authoritativeHouseFootprints(state, refs).filter(ring => ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) && ringAreaOf(ring) > 0)
    .sort((a, b) => ringAreaOf(b) - ringAreaOf(a)).map((ring, index) => {
      const name = state.zones.find(z => z.feature === 'house' && sameFootprint(z.points, ring))?.name?.trim() || `Building ${index + 1}`;
      // The crop and the oblique view have different x/y scales. Find the long wall in
      // real ground proportions before projecting it, or even a rectangular roof can turn 90°.
      const pixels = ring.map(([u, v]): [number, number] => [u * frame.imgW, v * frame.imgH]);
      const angle = ridgeAngleOf(pixels);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const span = (a: number, b: number) => {
        const values = pixels.map(([x, y]) => a * x + b * y);
        return Math.max(...values) - Math.min(...values);
      };
      const bearing = (Math.round(angle * 180 / Math.PI + 90) % 180 + 180) % 180;
      const axis = ['north–south', 'northeast–southwest', 'east–west', 'northwest–southeast'][Math.round(bearing / 45) % 4];
      const along = span(cos, sin), across = span(-sin, cos);
      return { name, ring, angle, bearing, axis, elongated: along > across * 1.12,
        alongM: along * frame.mPerPx, acrossM: across * frame.mPerPx };
    });
}

export function obliqueRoofBrief(roofs: readonly RoofGuide[]): string {
  if (!roofs.length) return '';
  return roofs.slice(0, 10).map(({ name, axis, bearing, elongated, alongM, acrossM }, i) => {
    const extent = Number.isFinite(alongM) && alongM > 0 && acrossM > 0
      ? ` Its traced ground extents along and across this wall are ${alongM.toFixed(1)} m by ${acrossM.toFixed(1)} m.` : '';
    const view = !elongated ? 'Keep the corners and the proportions of the compact footprint.'
      : axis === 'north–south' ? 'From the southern camera the short end faces the viewer. The long walls run away from the viewer toward the back; do not present a long broadside facade.'
      : axis === 'east–west' ? 'From the southern camera the long side runs across the view.' : 'Keep the diagonal orientation in the projected guide.';
    return `R${i + 1} "${name.slice(0, 80)}": its longest traced wall runs ${axis}, bearing ${bearing}°/${bearing + 180}° from true north.${extent} ${view} Keep roof details consistent with the registered aerial.`;
  }).join('\n');
}

export function buildObliquePrompt(input: {
  style: StylePreset; elements: string; designBrief: string; terrain: ObliqueTerrainEvidence; hasPhoto: boolean; roofBrief?: string;
}): string {
  return `${obliqueStyleDescription(input.style)}
Create ONE finished oblique aerial illustration of this saved garden design. Camera south of the plot looking north, approximately ${OBLIQUE_PITCH_DEG} degrees above the ground: north at the back, east on the right. Show building sides and tree/tank volume. Keep the whole property and complete tree crowns/tanks in frame, with breathing room around every edge. This is an illustrative viewpoint, not a measured 3D reconstruction.
The supplied reference board has four labelled panels. UPPER LEFT: saved top-down DESIGN, the authority for boundary shape, planted beds, feature counts, footprints and relative positions. LOWER LEFT: the same saved footprints projected into the requested camera angle. Use this as the ground-plane layout for the result: keep the same boundary corners, openings, separate buildings, bed groups and their order. Raise the objects from those footprints. The projection shows no heights or terrain relief. Where marked, the violet outlines follow the exact corners of ground-level paving. Keep the paved surface open and preserve how it meets the buildings, including shared edges and recesses. The outline is a guide only; do not add a raised border, roof or separate rectangular platform. ${input.hasPhoto ? 'Outside the traced boundary it carries the registered ground photo. Preserve visible vehicle access on its actual side: follow the through-road past the property and any photographed driveway branching through the boundary to the yard. Keep the entrance open where the road meets the yard. Follow the photographed surface. A road can be real even when it has no saved design symbol. Add no route where neither a trace nor the aerial shows one.' : 'Use saved access traces only; the empty exterior carries no road evidence.'} ${input.roofBrief ? 'Its outlined buildings and the enlarged R1 roof detail lock their ground orientation. The highlighted sides of the detail follow the longest traced wall. Diagram wall height is illustrative. ' : ''}TOP RIGHT: ${input.hasPhoto ? 'registered site aerial/drone PHOTO, appearance and surrounding context only; the planned design takes priority over old bare ground. Photographic inset seams and blurred repeated strips are not physical fences or paths; do not reproduce them.' : 'no photo is available; use restrained illustrative materials.'} BOTTOM RIGHT: TERRAIN reference, with real contour elevation labels only when available. Panel titles are reference instructions, not text to reproduce.
Reconstruct the design in oblique perspective; do not return a tilted flat map or a copy of this board. Keep all placed tanks, buildings, beds, orchard rows, routes and plants, including features touching the boundary. Tree crowns may overlap the boundary naturally. Retain hidden features in their saved positions rather than moving them to face the camera. Building and vegetation heights are illustrative unless explicitly measured in the supplied facts. Do not turn footprint dimensions or catalogue species heights into surveyed object heights.
TERRAIN EVIDENCE: ${input.terrain.note}
Draw only the artwork: no panel divisions, text, plant codes, legend, scale bar, compass, border or cream paper. The app adds a white presentation sheet and the saved-design inventory afterwards. Do not invent additional buildings, tanks, ponds, crops or roads. Surrounding context should agree with the photo where available.
SAVED DESIGN FACTS:
${input.designBrief}${input.roofBrief ? '\nBUILDING DIRECTIONS:\n' + input.roofBrief : ''}
INVENTORY:
${input.elements}`;
}

/** Geometry shared by the board painter and contour labels. Fit, never stretch or crop references. */
export function fitObliqueReference(width: number, height: number, box: { x: number; y: number; w: number; h: number }) {
  if (![width, height, box.w, box.h].every((n) => Number.isFinite(n) && n > 0)) throw new Error('Invalid oblique reference dimensions.');
  const scale = Math.min(box.w / width, box.h / height);
  return { x: box.x + (box.w - width * scale) / 2, y: box.y + (box.h - height * scale) / 2, w: width * scale, h: height * scale };
}

export const OBLIQUE_BOARD = { width: 1920, height: 1280,
  design: { x: 24, y: 64, w: 1200, h: 710 },
  groundView: { x: 24, y: 846, w: 1200, h: 410 },
  roof: { x: 808, y: 894, w: 378, h: 268 },
  photo: { x: 1256, y: 64, w: 640, h: 550 },
  terrain: { x: 1256, y: 700, w: 640, h: 490 },
} as const;

function paintObliqueRoofDetail(ctx: CanvasRenderingContext2D, roof: RoofGuide, frame: CanvasFrame,
  photo?: CanvasImageSource & { width: number; height: number }) {
  const pitch = Math.sin(OBLIQUE_PITCH_DEG * Math.PI / 180);
  const xs = roof.ring.map(([u]) => u), ys = roof.ring.map(([, v]) => v);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  const r = fitObliqueReference(width * frame.imgW, height * frame.imgH * pitch, OBLIQUE_BOARD.roof);
  const points = roof.ring.map(([u, v]) => [r.x + (u - left) / width * r.w, r.y + (v - top) / height * r.h]);
  const trace = (offset: number) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y + offset) : ctx.moveTo(x, y + offset)); ctx.closePath();
  };
  ctx.save();
  // This small extrusion only distinguishes the viewer-facing end. Its height is schematic.
  trace(16); ctx.fillStyle = '#B6C2C9'; ctx.fill();
  trace(0); ctx.fillStyle = '#DFE7EA'; ctx.fill();
  if (photo) {
    ctx.save(); ctx.clip();
    ctx.drawImage(photo, left * photo.width, top * photo.height, width * photo.width, height * photo.height, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const dx = (xs[next] - xs[i]) * frame.imgW, dy = (ys[next] - ys[i]) * frame.imgH;
    const along = Math.abs(dx * Math.cos(roof.angle) + dy * Math.sin(roof.angle));
    ctx.strokeStyle = along > .95 * Math.hypot(dx, dy) ? '#B34516' : '#274659';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(points[i][0], points[i][1]); ctx.lineTo(points[next][0], points[next][1]); ctx.stroke();
  }
  ctx.fillStyle = '#203C28'; ctx.font = 'bold 19px Arial';
  ctx.fillText(`R1 · ${roof.name}`, 800, 875, 407);
  ctx.fillText(`Long wall: ${roof.axis}`, 800, 1215);
  ctx.font = '16px Arial'; ctx.fillText('From south · wall height schematic', 800, 1240);
  ctx.restore();
}

function appendObliquePath(ctx: CanvasRenderingContext2D, points: readonly [number, number][],
  box: { x: number; y: number; w: number; h: number }) {
  points.forEach(([u, v], i) => {
    const x = box.x + u * box.w, y = box.y + v * box.h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
}

export function paintObliqueReferenceBoard(ctx: CanvasRenderingContext2D, input: {
  design: CanvasImageSource & { width: number; height: number };
  photo?: CanvasImageSource & { width: number; height: number };
  contours: SheetContourResult; frame: CanvasFrame; terrain: ObliqueTerrainEvidence;
  boundary: Array<[number, number]>; driveway?: readonly [number, number][]; drivewayClosed?: boolean;
  paving?: ReadonlyArray<Array<[number, number]>>; anchors?: readonly ObliqueAnchor[]; roofs?: readonly RoofGuide[];
}): void {
  const b = OBLIQUE_BOARD;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, b.width, b.height);
  ctx.fillStyle = '#203C28'; ctx.font = 'bold 25px Arial';
  ctx.fillText('DESIGN — north up', 24, 38);
  ctx.fillText('GROUND FOOTPRINTS — looking north from the south', 24, 823);
  ctx.fillText(input.photo ? 'SITE PHOTO — north up' : 'NO SITE PHOTO', 1256, 38);
  ctx.fillText('TERRAIN — north up', 1256, 670);
  const draw = (image: typeof input.design, box: typeof b.design | typeof b.photo) => {
    const r = fitObliqueReference(image.width, image.height, box);
    ctx.drawImage(image, r.x, r.y, r.w, r.h);
    return r;
  };
  const designFrame = draw(input.design, b.design);
  // The numeric bed register spans the source image, including any quiet margin inside it.
  // A faint image frame distinguishes that extent from the much wider white board panel.
  ctx.strokeStyle = '#C1C9C2'; ctx.lineWidth = 1;
  ctx.strokeRect(designFrame.x, designFrame.y, designFrame.w, designFrame.h);
  // Both panels use the same pixels: an orthographic south view shortens north–south
  // distances by the sine of the camera pitch. Elevations belong to the terrain panel.
  const projected = fitObliqueReference(input.design.width,
    input.design.height * Math.sin(OBLIQUE_PITCH_DEG * Math.PI / 180),
    input.roofs?.length ? { ...b.groundView, w: 735 } : b.groundView);
  ctx.drawImage(input.design, projected.x, projected.y, projected.w, projected.h);
  if (input.photo && input.boundary.length >= 3) {
    // A blank exterior erased the photographed dirt road beside Ubhejane. Keep these
    // pixels registered to the same crop while preserving every proposed feature inside.
    ctx.save(); ctx.beginPath(); ctx.rect(projected.x, projected.y, projected.w, projected.h);
    appendObliquePath(ctx, input.boundary, projected); ctx.closePath(); ctx.clip('evenodd');
    ctx.drawImage(input.photo, projected.x, projected.y, projected.w, projected.h);
    ctx.restore();
  }
  const paving = (input.paving ?? []).filter(ring => ring.length >= 3 && ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    && ringAreaOf(ring) > 0);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#70419A';
  for (const ring of paving) {
    ctx.beginPath(); appendObliquePath(ctx, ring, projected); ctx.closePath(); ctx.stroke();
  }
  if (paving.length) {
    ctx.fillStyle = ctx.strokeStyle; ctx.font = '17px Arial';
    ctx.fillText('Violet outline · ground-level paving', 24, 1276);
  }
  if (input.driveway && input.driveway.length >= 2) {
    ctx.beginPath(); appendObliquePath(ctx, input.driveway, projected);
    if (input.drivewayClosed) ctx.closePath();
    ctx.strokeStyle = '#B55C17'; ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.font = '17px Arial';
    ctx.fillText('Ochre line · saved driveway trace', 382, 1276);
  }
  ctx.restore();
  if (input.roofs?.length) {
    ctx.save(); ctx.strokeStyle = '#274659'; ctx.lineWidth = 2; ctx.fillStyle = '#183246'; ctx.font = 'bold 13px Arial';
    for (const [i, roof] of input.roofs.entries()) {
      ctx.beginPath();
      roof.ring.forEach(([u, v], j) => {
        const x = projected.x + u * projected.w, y = projected.y + v * projected.h;
        if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.stroke();
      if (i < 10) ctx.fillText(`R${i + 1}`, projected.x + roof.ring[0][0] * projected.w, projected.y + roof.ring[0][1] * projected.h - 3);
    }
    ctx.restore();
    paintObliqueRoofDetail(ctx, input.roofs[0], input.frame, input.photo);
  }
  const anchors = input.anchors ?? [];
  ctx.save();
  for (const { kind, x, y } of anchors) {
    const ax = projected.x + x * projected.w;
    const ay = projected.y + y * projected.h;
    ctx.fillStyle = ANCHOR_INK[kind]; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (kind === 'tank') ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    else if (kind === 'gate') {
      ctx.moveTo(ax, ay - 7); ctx.lineTo(ax + 7, ay); ctx.lineTo(ax, ay + 7); ctx.lineTo(ax - 7, ay); ctx.closePath();
    } else ctx.rect(ax - 5, ay - 5, 10, 10);
    ctx.fill(); ctx.stroke();
  }
  ctx.font = 'bold 20px Arial';
  if (anchors.some(a => a.kind === 'tank')) {
    ctx.fillStyle = ANCHOR_INK.tank; ctx.fillText('●  Tank', 845, 823);
  }
  if (anchors.some(a => a.kind === 'hive')) {
    ctx.fillStyle = ANCHOR_INK.hive; ctx.fillText('■  Beehive', 980, 823);
  }
  if (anchors.some(a => a.kind === 'gate')) {
    ctx.fillStyle = ANCHOR_INK.gate; ctx.fillText('◆  Gate', 1124, 823);
  }
  ctx.restore();
  if (input.photo) {
    const photoBox = draw(input.photo, b.photo);
    ctx.save();
    if (input.boundary.length >= 3) {
      ctx.beginPath(); appendObliquePath(ctx, input.boundary, photoBox); ctx.closePath();
      ctx.strokeStyle = '#465B35'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    if (input.driveway && input.driveway.length >= 2) {
      ctx.beginPath(); appendObliquePath(ctx, input.driveway, photoBox);
      if (input.drivewayClosed) ctx.closePath();
      ctx.strokeStyle = '#B55C17'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '18px Arial'; ctx.fillStyle = '#734016'; ctx.fillText('Ochre line: saved driveway trace', b.photo.x, 639);
    }
    ctx.restore();
  }
  const r = fitObliqueReference(input.frame.imgW, input.frame.imgH, b.terrain);
  const path = (points: Array<[number, number]>) => {
    ctx.beginPath();
    appendObliquePath(ctx, points, r);
  };
  ctx.save(); ctx.beginPath(); ctx.rect(b.terrain.x, b.terrain.y, b.terrain.w, b.terrain.h); ctx.clip();
  ctx.strokeStyle = '#294F32'; ctx.lineWidth = 2;
  path(input.boundary); ctx.closePath(); ctx.stroke();
  if (input.terrain.kind === 'contours') {
    ctx.strokeStyle = '#987040'; ctx.fillStyle = '#72512B'; ctx.font = '18px Arial';
    for (const line of input.contours.lines) {
      path(line.points); ctx.stroke();
      const point = line.points.find(([u, v]) => u > 0.05 && u < 0.9 && v > 0.05 && v < 0.9);
      if (point) ctx.fillText(`${line.elevM} m`, r.x + point[0] * r.w, r.y + point[1] * r.h);
    }
  }
  ctx.restore(); ctx.fillStyle = '#444444'; ctx.font = '19px Arial';
  ctx.fillText(input.terrain.kind === 'contours' ? 'Modelled contours, not surveyed' : input.terrain.kind === 'indicative-slope' ? 'Indicative slope only — see supplied facts' : 'Elevation unavailable — illustrative ground', 1256, 1234);
}
