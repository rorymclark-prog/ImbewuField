import type { FeatureCollection, Polygon } from 'geojson';
import { computeCanvasFrame, normaliseRotation, type DesignCanvasState, type ZoneShape } from './design-canvas';
import type { DesignLayer } from './design-studio';
import { coordinateSiteIdParts } from './site-id';

// The layout uses a fictional anchor. The original geographic origin and imagery
// are deliberately absent; these offsets retain the source drawing's scale.
export const RIVIER_UITSIG_SITE_ID = 'site:0.50000,0.50000';
// Keep the anchor independent of Design Studio initialization. Server routes
// can reach sample mode while the shared design modules are still loading.
export const RIVIER_UITSIG_SITE = Object.freeze({ name: 'Rivier Uitsig', ...coordinateSiteIdParts(RIVIER_UITSIG_SITE_ID)! });
export const RIVIER_UITSIG_LAYOUT_PROVENANCE = Object.freeze({
  imageryDate: '2026-10-05',
  attribution: 'Google Earth imagery, Airbus and AfriGIS',
  source: 'Tatsfield-field-and-bed-example.kml',
  sourceSha256: '01fa4864f3a60bfdc28014268f8d0076f5e19b7fdf7d856d7e19b76eec6159b2',
  basis: 'Approximate imagery-based field outlines and illustrative bed placements.',
});
const STAMP = RIVIER_UITSIG_LAYOUT_PROVENANCE.imageryDate + 'T00:00:00.000Z';
const METRES_PER_DEGREE = 111_320;
type MetrePoint = readonly [east: number, north: number];
type MetreRing = readonly MetrePoint[];

export const RIVIER_UITSIG_FIELDS = [
  { id: 'F01', approximateAreaHa: 1.04, outlineM: [[61.999, 125.347], [208.592, 194.511], [233.345, 139.3], [86.112, 63.153], [61.999, 125.347]] },
  { id: 'F02', approximateAreaHa: 1.36, outlineM: [[89.489, 56.07], [237.78, 135.321], [266.549, 63.095], [130.398, -22.551], [89.489, 56.07]] },
  { id: 'F03', approximateAreaHa: 1.242, outlineM: [[314.566, 193.079], [340.553, 217.796], [414.067, 177.857], [474.907, 146.808], [563.644, 97.368], [559.838, 40.96], [483.783, 84.059], [391.883, 139.839], [314.566, 193.079]] },
  { id: 'V01', approximateAreaHa: 0.846, outlineM: [[-57.947, 30.2], [-1.909, 49.941], [10.191, 28.293], [40.117, 38.48], [56.671, -33.479], [-14.649, -62.764], [-32.475, -50.671], [-57.947, 30.2]] },
] as const;

export const RIVIER_UITSIG_BANKS = [
  { id: 'A', outlineM: [[-21.034, 8.94], [-7.838, 13.74], [1.74, -12.574], [-11.457, -17.374], [-21.034, 8.94]] },
  { id: 'B', outlineM: [[5.068, -18.449], [18.274, -13.638], [27.852, -39.953], [14.645, -44.763], [5.068, -18.449]] },
] as const;

const BED_RINGS = [
  ['A01', [[-19.744, 7.278], [-18.618, 7.688], [-10.409, -14.869], [-11.535, -15.279], [-19.744, 7.278]]],
  ['A02', [[-18.191, 7.843], [-17.066, 8.253], [-8.856, -14.303], [-9.982, -14.714], [-18.191, 7.843]]],
  ['A03', [[-16.639, 8.408], [-15.513, 8.818], [-7.304, -13.738], [-8.43, -14.148], [-16.639, 8.408]]],
  ['A04', [[-15.086, 8.974], [-13.961, 9.384], [-5.751, -13.173], [-6.877, -13.583], [-15.086, 8.974]]],
  ['A05', [[-13.543, 9.539], [-12.408, 9.949], [-4.199, -12.608], [-5.334, -13.018], [-13.543, 9.539]]],
  ['A06', [[-11.991, 10.104], [-10.865, 10.514], [-2.656, -12.042], [-3.782, -12.452], [-11.991, 10.104]]],
  ['A07', [[-10.438, 10.669], [-9.313, 11.08], [-1.103, -11.477], [-2.229, -11.887], [-10.438, 10.669]]],
  ['A08', [[-8.886, 11.224], [-7.76, 11.645], [0.449, -10.912], [-0.676, -11.322], [-8.886, 11.224]]],
  ['B01', [[6.368, -20.101], [7.494, -19.69], [15.703, -42.247], [14.577, -42.657], [6.368, -20.101]]],
  ['B02', [[7.921, -19.535], [9.046, -19.125], [17.256, -41.682], [16.13, -42.092], [7.921, -19.535]]],
  ['B03', [[9.464, -18.97], [10.599, -18.56], [18.808, -41.116], [17.673, -41.527], [9.464, -18.97]]],
  ['B04', [[11.016, -18.416], [12.142, -18.006], [20.351, -40.551], [19.225, -40.961], [11.016, -18.416]]],
  ['B05', [[12.569, -17.85], [13.694, -17.44], [21.903, -39.986], [20.778, -40.396], [12.569, -17.85]]],
  ['B06', [[14.121, -17.285], [15.247, -16.875], [23.456, -39.42], [22.33, -39.831], [14.121, -17.285]]],
  ['B07', [[15.674, -16.72], [16.799, -16.31], [25.009, -38.855], [23.883, -39.265], [15.674, -16.72]]],
  ['B08', [[17.217, -16.155], [18.352, -15.744], [26.561, -38.301], [25.426, -38.711], [17.217, -16.155]]],
] as const satisfies ReadonlyArray<readonly [string, MetreRing]>;

export const RIVIER_UITSIG_BEDS = BED_RINGS.map(([label, outlineM]) => ({
  id: `rivier-uitsig-bed-${label.toLowerCase()}`,
  label,
  nominalWidthM: 1.2,
  nominalLengthM: 24,
  outlineM,
}));

function samplePoint([east, north]: MetrePoint): [number, number] {
  const longitudinalMetres = METRES_PER_DEGREE * Math.cos(RIVIER_UITSIG_SITE.lat * Math.PI / 180);
  return [RIVIER_UITSIG_SITE.lon + east / longitudinalMetres, RIVIER_UITSIG_SITE.lat + north / METRES_PER_DEGREE];
}

function bedCentre(outline: MetreRing): MetrePoint {
  const vertices = outline.slice(0, -1);
  return [vertices.reduce((sum, point) => sum + point[0], 0) / vertices.length,
    vertices.reduce((sum, point) => sum + point[1], 0) / vertices.length];
}

function bedAngle(outline: MetreRing): number {
  // Average both long edges in the same direction. Screen Y increases southward.
  const [a, b, c, d] = outline;
  return Math.atan2(a[1] + b[1] - c[1] - d[1], c[0] + d[0] - a[0] - b[0]) * 180 / Math.PI;
}

function bankId(bank: string): string {
  return `rivier-uitsig-bank-${bank.toLowerCase()}`;
}

export function buildRivierUitsigStorageSeeds(): Record<string, string> {
  const siteId = RIVIER_UITSIG_SITE_ID;
  const shapes: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: RIVIER_UITSIG_FIELDS.map(field => ({
      type: 'Feature',
      id: `rivier-uitsig-outline-${field.id.toLowerCase()}`,
      geometry: { type: 'Polygon', coordinates: [field.outlineM.map(samplePoint)] },
      properties: {
        featureType: 'site', siteId,
        name: field.id === 'V01' ? 'V01 · Approximate vegetable field' : `${field.id} · Approximate field`,
      },
    })),
  };
  const layers: DesignLayer[] = shapes.features.map((feature, index) => {
    const id = String(feature.id);
    const field = RIVIER_UITSIG_FIELDS[index];
    return {
      id, featureId: id, siteId, name: String(feature.properties?.name), layerType: 'cultivation', featureType: 'site',
      geometryType: 'Polygon', geometry: feature.geometry, areaM2: field.approximateAreaHa * 10_000,
      areaLabel: `≈${field.approximateAreaHa} ha`, source: 'manual_map', confidenceScore: 0, approved: false,
      locked: false, color: '#54824e', updatedAt: STAMP,
    };
  });
  const { frame, project } = computeCanvasFrame(layers, RIVIER_UITSIG_SITE.lat, RIVIER_UITSIG_SITE.lon);
  const projectMetres = (point: MetrePoint) => project(samplePoint(point));
  const zones: ZoneShape[] = RIVIER_UITSIG_BANKS.map(bank => {
    const beds = RIVIER_UITSIG_BEDS.filter(bed => bed.label.startsWith(bank.id));
    const first = beds[0];
    const [firstX, firstY] = bedCentre(first.outlineM);
    const [lastX, lastY] = bedCentre(beds[beds.length - 1].outlineM);
    const pitch = Math.hypot(lastX - firstX, lastY - firstY) / (beds.length - 1);
    return {
      id: bankId(bank.id), name: `Bank ${bank.id} · Practice beds`, zone: 1,
      feature: 'staple_garden', status: 'proposed',
      points: bank.outlineM.slice(0, -1).map(projectMetres),
      fieldBlock: {
        mode: 'beds', bedLengthM: first.nominalLengthM, bedWidthM: first.nominalWidthM,
        pathWidthM: Math.round((pitch - first.nominalWidthM) * 100) / 100,
        angleDeg: bedAngle(first.outlineM),
      },
    };
  });
  const canvas: DesignCanvasState = {
    siteId, frame, baseMode: 'blank', blankMPerPx: frame.mPerPx,
    items: RIVIER_UITSIG_BEDS.map(bed => {
      const [x, y] = projectMetres(bedCentre(bed.outlineM));
      return {
        id: bed.id, label: bed.label, fieldBlockId: bankId(bed.label[0]), defId: 'veg_bed', status: 'proposed',
        x, y, wM: bed.nominalWidthM, hM: bed.nominalLengthM, rot: normaliseRotation(bedAngle(bed.outlineM) - 90),
      };
    }),
    zones, lines: [], step: 'review', updatedAt: STAMP, rev: 1,
  };
  return {
    imbewu_farm_shapes: JSON.stringify(shapes),
    [`imbewu_design_canvas_${siteId}`]: JSON.stringify(canvas),
    imbewu_map_tips_seen: '1',
    permamap_onboarded: '1',
  };
}
