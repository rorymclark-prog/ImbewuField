import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBoundaryPresentationCrop,
  calculateBoundaryPresentationLayout,
  calculatePhasingSheetSize,
  MAX_PRESENTATION_MAP_ASPECT,
  MAX_PRESENTATION_SHEET_ASPECT,
  PAPER_SHEET_RATIO,
  paperSheetCanvas,
} from '@/lib/reference-presentation';

const FRAME = { imgW: 960, imgH: 640, mPerPx: 0.4 };
const SQUARE_BOUNDARY: Array<[number, number]> = [
  [0.4, 0.35],
  [0.6, 0.35],
  [0.6, 0.65],
  [0.4, 0.65],
];
const WIDE_BOUNDARY: Array<[number, number]> = [
  [0.3, 0.425],
  [0.7, 0.425],
  [0.7, 0.575],
  [0.3, 0.575],
];
const TALL_BOUNDARY: Array<[number, number]> = [
  [0.45, 0.2],
  [0.55, 0.2],
  [0.55, 0.8],
  [0.45, 0.8],
];

test('compact properties fill the finished sheet instead of staying at the old 24% floor', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.45, 0.46],
    [0.55, 0.46],
    [0.55, 0.54],
    [0.45, 0.54],
  ]);

  assert.ok(crop);
  assert.ok(crop.cropFraction < 0.24);
  assert.ok(crop.cropFraction >= 0.08);
});

test('presentation crop stays inside the source image near an edge', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.01, 0.01],
    [0.13, 0.01],
    [0.13, 0.12],
    [0.01, 0.12],
  ]);

  assert.ok(crop);
  assert.equal(crop.cropX, 0);
  assert.equal(crop.cropY, 0);
  assert.ok(crop.cropX + crop.cropFraction <= 1);
  assert.ok(crop.cropY + crop.cropFraction <= 1);
});

test('large properties retain the original frame', () => {
  assert.equal(calculateBoundaryPresentationCrop([
    [0.05, 0.05],
    [0.90, 0.05],
    [0.90, 0.90],
    [0.05, 0.90],
  ]), null);
});

test('a farm of any shape lands on A-series paper with no cream band left to pad', () => {
  // This used to assert the OPPOSITE — that a long-thin farm and a square farm got different
  // sheet shapes, because the plot chose the map shape and the paper was added afterwards as
  // margin. Rory, looking at a rendered plan: "when we do a map it does[n't] fill out the A3
  // ratio, we need to make the satellite image bigger so there is no blank space." Standard
  // paper means every sheet is the SAME shape; the farm's shape shows in the boundary, not in
  // the trim. So the surplus is now more aerial photograph, and padToPaperSheet has nothing
  // left to do.
  for (const boundary of [SQUARE_BOUNDARY, WIDE_BOUNDARY, TALL_BOUNDARY]) {
    const layout = calculateBoundaryPresentationLayout(boundary, FRAME);
    assert.ok(layout);
    assert.ok(
      Math.abs(layout.sheetAspect - PAPER_SHEET_RATIO) < 0.01,
      `sheet aspect ${layout.sheetAspect} is not A-series`,
    );

    // Not pixel-exact, and it does not need to be: imgW/imgH and the legend width are all
    // rounded to whole pixels, so the achieved ratio lands a couple of pixels off √2. What
    // matters is that the residual band is invisible — half a percent of the sheet is well
    // under a millimetre on A2 — not that it is literally zero.
    const sheetW = layout.imgW * 2 + layout.legendWidth;
    const sheetH = layout.imgH * 2;
    const paper = paperSheetCanvas(sheetW, sheetH);
    assert.ok(
      paper.width - sheetW <= sheetW * 0.005,
      `${sheetW}x${sheetH} still needs ${paper.width - sheetW}px of width padding`,
    );
    assert.ok(
      paper.height - sheetH <= sheetH * 0.005,
      `${sheetW}x${sheetH} still needs ${paper.height - sheetH}px of height padding`,
    );
  }
});

test('a photo too small to cover A-series degrades to a smaller sheet, never to nothing', () => {
  // The guarantee that makes the paper ratio safe to chase. A boundary filling most of the
  // source leaves no room to widen the crop toward the paper shape — and the first A-series
  // attempt returned null exactly here, which silently dropped the sheet to an unframed
  // fallback. It must come back with a real (if under-sized) layout whose crop is still wholly
  // inside the photo; padToPaperSheet then adds the margin, as it always did.
  const nearlyFull: Array<[number, number]> = [
    [0.06, 0.06],
    [0.94, 0.06],
    [0.94, 0.94],
    [0.06, 0.94],
  ];
  const layout = calculateBoundaryPresentationLayout(nearlyFull, FRAME);

  assert.ok(layout, 'a too-small photo must not blank the sheet');
  assert.ok(layout.cropX >= 0 && layout.cropY >= 0);
  assert.ok(layout.cropX + layout.cropWidth <= 1 + 1e-9, 'crop must stay inside the photo');
  assert.ok(layout.cropY + layout.cropHeight <= 1 + 1e-9, 'crop must stay inside the photo');
});

test('every derived viewport keeps one truthful metres-per-pixel scale on both axes', () => {
  for (const boundary of [SQUARE_BOUNDARY, WIDE_BOUNDARY, TALL_BOUNDARY]) {
    const layout = calculateBoundaryPresentationLayout(boundary, FRAME);
    assert.ok(layout);
    const xMetresPerPixel = (layout.cropWidth * FRAME.imgW * FRAME.mPerPx) / layout.imgW;
    const yMetresPerPixel = (layout.cropHeight * FRAME.imgH * FRAME.mPerPx) / layout.imgH;
    const expected = FRAME.mPerPx * layout.sourcePixelsPerOutputPixel;

    assert.ok(Math.abs(xMetresPerPixel - yMetresPerPixel) < 1e-12);
    assert.ok(Math.abs(xMetresPerPixel - expected) < 1e-12);
  }
});

test('a four-to-one wide farm is letterboxed before the complete sheet can exceed three-to-one', () => {
  const layout = calculateBoundaryPresentationLayout(WIDE_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.ok(layout.imgW / layout.imgH <= MAX_PRESENTATION_MAP_ASPECT + 0.01);
  assert.ok(layout.sheetAspect <= MAX_PRESENTATION_SHEET_ASPECT);
});

test('a one-to-four tall farm keeps the readable minimum legend width', () => {
  const layout = calculateBoundaryPresentationLayout(TALL_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.ok(layout.sheetAspect <= MAX_PRESENTATION_SHEET_ASPECT);
  assert.ok(layout.legendWidth >= 360);
});

test('sheet 08 adds the same panel column as the rest of a tall plan set', () => {
  const layout = calculateBoundaryPresentationLayout(TALL_BOUNDARY, FRAME);
  const sheet = calculatePhasingSheetSize(TALL_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.equal(sheet.mapW, layout.imgW * 2);
  assert.equal(sheet.mapH, layout.imgH * 2);
  assert.equal(sheet.W, sheet.mapW + sheet.legendWidth);
  assert.ok(sheet.W > sheet.mapW, 'the schedule must own a column instead of covering the map');
  assert.equal(sheet.aspect, layout.sheetAspect);
  assert.ok(sheet.aspect <= MAX_PRESENTATION_SHEET_ASPECT);
});

test('a one-to-six plot fills the paper with neighbouring ground instead of a tall letterbox', () => {
  // Previously asserted `sheet.mapH / sheet.mapW > 4` — a map as tall and thin as the plot,
  // which left the sheet nowhere near A-series and so printed inside two wide cream bands. The
  // sliver of land is now framed by the ground around it, which is where a farmer's water
  // arrives from and where the wind comes over, and the sheet fills the page.
  const boundary: Array<[number, number]> = [
    [0.475, 0.275],
    [0.525, 0.275],
    [0.525, 0.725],
    [0.475, 0.725],
  ];
  const sheet = calculatePhasingSheetSize(boundary, FRAME);

  assert.ok(Math.abs(sheet.aspect - PAPER_SHEET_RATIO) < 0.01, `sheet aspect ${sheet.aspect}`);
  assert.ok(sheet.aspect <= MAX_PRESENTATION_SHEET_ASPECT);
  assert.ok(sheet.legendWidth >= 360);
});

test('every finished sheet is padded to A-series landscape, and padding only ever ADDS paper', () => {
  // A2 landscape, on Rory's call. The ratio is what matters to a renderer working in pixels: a
  // root-2 sheet drops onto A2, A3 or A4 with no re-layout.
  for (const [w, h] of [[2496, 1280], [1600, 1600], [1200, 2400], [3000, 900], [1414, 1000]]) {
    const paper = paperSheetCanvas(w, h);
    assert.ok(paper.width >= w, `padding must never crop width (${w}x${h})`);
    assert.ok(paper.height >= h, `padding must never crop height (${w}x${h})`);
    assert.ok(
      Math.abs(paper.width / paper.height - PAPER_SHEET_RATIO) < 0.005,
      `${w}x${h} padded to ${paper.width}x${paper.height} is not A-series`,
    );
    assert.ok(paper.width > paper.height, 'landscape, not portrait');
  }
  // Degenerate input must not produce a zero or non-finite canvas — a sheet that cannot be drawn
  // is worse than an unpadded one.
  for (const [w, h] of [[0, 100], [100, 0], [Number.NaN, 100]]) {
    const paper = paperSheetCanvas(w, h);
    assert.ok(Number.isFinite(paper.width) && paper.width >= 1);
    assert.ok(Number.isFinite(paper.height) && paper.height >= 1);
  }
});
