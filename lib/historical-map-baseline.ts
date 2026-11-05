import type { CanvasFrame } from '@/lib/design-canvas';
import { makeMercatorUnprojector, projectorForFrame } from '@/lib/design-canvas';

export type PhotoPoint = readonly [number, number];
export const HISTORICAL_BASELINE_MARKER = 'UBHEJANE BEFORE-WORKS PHOTO v1';

// Rory approved this archive extraction on 3 November 2026. The camera original/EXIF date was
// not found. Keep this version immutable: a completed job must recover its original photo facts.
export const UBHEJANE_BEFORE_WORKS = {
  id: 'ubhejane-before-works-v1',
  siteId: 'site:-27.72619,31.96317',
  image: '/case-studies/ubhejane/before-works-archive.jpg',
  width: 4000, height: 3000,
  sha256: '7ad1313428b8b3968c44b71866655db29bddae5cc4480257a96b697f80f179bc',
  referenceFrame: { centerLat: -27.72619, centerLng: 31.96317, zoom: 18.099359683859355,
    imgW: 960, imgH: 640, mPerPx: 0.237085053989525 },
  referencePixels: { width: 2880, height: 1920 },
  // Eight visually identified roof corners on the two unchanged classrooms. This is an image
  // registration, not a ground-control survey or orthorectification; ground-height parallax remains.
  sourceToReference: [-0.21919119897831696, -0.10705683089889706,
    0.12293638291653197, -0.22311131866160344, 1681.9254966084993, 1539.2668252096228],
  controls: [
    { source: [2342,1545], target: [1358,943] }, { source: [2584,1449], target: [1293,942] },
    { source: [2772,1784], target: [1294,843] }, { source: [2528,1888], target: [1360,845] },
    { source: [1738,2192], target: [1570,861] }, { source: [1962,2112], target: [1515,860] },
    { source: [2045,2302], target: [1516,811] }, { source: [1817,2383], target: [1575,812] },
  ],
  features: [
    { id: 'classroom-1', label: 'Existing classroom 1', point: [2557,1668], kind: 'roof' },
    { id: 'classroom-2', label: 'Existing classroom 2', point: [1894,2249], kind: 'roof' },
    { id: 'slab', label: 'Existing bare slab', point: [1980,1920], kind: 'surface' },
    { id: 'play', label: 'Existing play area', point: [2020,1580], kind: 'surface' },
    { id: 'toilet', label: 'Existing toilet', point: [2590,1090], kind: 'roof' },
    { id: 'tank', label: 'Existing water tank', point: [2530,1420], kind: 'water' },
    { id: 'road', label: 'Existing dirt road', point: [1120,1800], kind: 'line' },
    { id: 'fence', label: 'Existing fence — visible portion', point: [1570,1940], kind: 'line' },
  ],
  // Only the clearly visible post run is traced. The current design extent is a different line;
  // neither these photo annotations nor their apparent widths are saved farming measurements.
  fence: [[1465,1684],[1570,1940],[1685,2230],[1760,2450]],
  provenance: 'Archive before-works photograph. Published comparison labels it July 2019; camera capture date is unverified. Embedded in the earthworks PDF created 7 October 2019.',
  alignment: 'Aligned to the two classroom roofs; approximate image registration, not a survey. Ground-height parallax remains. Current design extent is shown separately from the photographed fence.',
  coverage: 'The photograph does not cover the northeast and southwest tips of the current design extent. Unphotographed areas are left blank; no landscape is invented there.',
} as const;
export type HistoricalBaseline = typeof UBHEJANE_BEFORE_WORKS;

export function historicalBaselineForSite(siteId: string): HistoricalBaseline | null {
  // The public practice fixture has schematic geometry at a nearby coordinate. It must never
  // acquire a false photographic alignment merely because its name also says Ubhejane.
  return siteId === UBHEJANE_BEFORE_WORKS.siteId ? UBHEJANE_BEFORE_WORKS : null;
}

export function historicalBaselineFromPrompt(prompt?: string): HistoricalBaseline | null {
  return prompt?.includes(HISTORICAL_BASELINE_MARKER) ? UBHEJANE_BEFORE_WORKS : null;
}

export function historicalPhotoPoint(frame: Pick<CanvasFrame, 'centerLng'|'centerLat'|'zoom'|'imgW'|'imgH'|'mPerPx'>,
  point: PhotoPoint, baseline: HistoricalBaseline = UBHEJANE_BEFORE_WORKS): [number, number] {
  const [a,b,c,d,e,f] = baseline.sourceToReference;
  const ref = baseline.referenceFrame;
  const unproject = makeMercatorUnprojector(ref.centerLng,ref.centerLat,ref.zoom,ref.imgW,ref.imgH);
  const lngLat = unproject([(a*point[0]+c*point[1]+e)/baseline.referencePixels.width,
    (b*point[0]+d*point[1]+f)/baseline.referencePixels.height]);
  return projectorForFrame(frame)(lngLat);
}

export function historicalPhotoTransform(frame: CanvasFrame, scale: number, baseline: HistoricalBaseline = UBHEJANE_BEFORE_WORKS): [number,number,number,number,number,number] {
  const origin=historicalPhotoPoint(frame,[0,0],baseline), x=historicalPhotoPoint(frame,[1,0],baseline),y=historicalPhotoPoint(frame,[0,1],baseline);
  const W=frame.imgW*scale,H=frame.imgH*scale;
  return [(x[0]-origin[0])*W,(x[1]-origin[1])*H,(y[0]-origin[0])*W,(y[1]-origin[1])*H,origin[0]*W,origin[1]*H];
}

export function historicalPhotoExtent(frame: CanvasFrame, baseline: HistoricalBaseline = UBHEJANE_BEFORE_WORKS): Array<[number,number]> {
  return [[0,0],[baseline.width,0],[baseline.width,baseline.height],[0,baseline.height]].map(point=>historicalPhotoPoint(frame,point as [number,number],baseline));
}

export function historicalBaselinePrompt(): string {
  return `${HISTORICAL_BASELINE_MARKER}. This is the historic BEFORE-WORKS site photograph, not the completed garden. Preserve its two classrooms, bare slab, one existing tank, play equipment, toilet, dirt road, visible fence and scattered existing vegetation. Add no later vegetable beds, swales, food forest, insectary or other proposed interventions. Blank areas beyond the photograph are unknown coverage, not bare land: keep them white, never extend or invent the landscape. Preserve the source camera, crop and the positions of every photographed feature.`;
}
